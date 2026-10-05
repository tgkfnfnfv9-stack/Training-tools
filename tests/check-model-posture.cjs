'use strict';
// Independent physical checks of the displayed model, including real Canvas
// vertices. The support solver remains the source of the teaching heights.
const assert=require('node:assert/strict');
const irregularHeightOracle=require('./irregular-height-oracle.cjs');
const {registry:r,read,json,storage}=require('./leveling-dom-env.cjs')({pureLeveling:true});
let width=302,height=305,path=[],polygons=[],texts=[],arcs=[],lastBox=null;
const ctx={
 scale(){},setLineDash(){},beginPath(){path=[];},closePath(){},fill(){},
 moveTo(x,y){assert(Number.isFinite(x)&&Number.isFinite(y));path.push([x,y]);},
 lineTo(x,y){assert(Number.isFinite(x)&&Number.isFinite(y));path.push([x,y]);},
 stroke(){if(this.lineWidth===.6)polygons.push(path.map(p=>p.slice()));},
 arc(x,y,radius){assert([x,y,radius].every(Number.isFinite));arcs.push({x,y,radius});},
 fillRect(x,y,w,h){if(x===0&&y===0&&w===width&&h===height){polygons=[];texts=[];arcs=[];lastBox=null;}else lastBox={x,y,w,h};},
 fillText(text,x,y){texts.push({text,x,y,box:lastBox});lastBox=null;},
 measureText(text){const px=Number(/(\d+)px/.exec(this.font||'10px')?.[1]||10);return {width:[...text].reduce((n,ch)=>n+(/[\x00-\x7f]/.test(ch)?.56:1)*px,0)};}
};
r.scene.getContext=()=>ctx;r.scene.getBoundingClientRect=()=>({width,height});
const variants=[[0,'compact'],[1,''],[2,''],[3,'l3-3000'],[4,''],[5,''],[6,'']];
const subtract=(a,b)=>a.map((v,i)=>v-b[i]);
const unit=v=>v.map(q=>q/Math.hypot(...v));
const near=(a,b,e=1e-8)=>assert(Math.abs(a-b)<=e,`${a} != ${b}`);
const pointNear=(a,b,e=1e-8)=>assert(Math.hypot(...subtract(a,b))<=e,`${JSON.stringify(a)} != ${JSON.stringify(b)}`);
const literal=JSON.stringify;
const result={checks:{projection:0,surfaceNormals:0,groundContact:0,rigidMotion:0,axisLabels:0},failures:[]};
let name='';
function check(kind,fn){try{fn();result.checks[kind]++;}catch(e){result.failures.push({kind,name,message:e.message});}}
function open(index,mode){storage.clear();read(`openMachine(machines[${index}]);`);if(mode)r.machineMode.change(mode);}
function setHeights(expression){read(`supportHeights=supports.map(${expression});updateLeveling(false);`);}
function world(p,f){return json(`levelMappedBodyVisualPoint(displayTransformedPoint(${literal(p)},${literal(f.axes)},current,positions,${literal(f.pose||'bed')}),${literal(f.pose||'bed')})`);}
function screenFunction(){
 const yaw=read('yaw'),view=read('sceneView'),pitch=view==='oblique'?.24:0;
 const project=p=>{const [x,y,z]=p,xx=x*Math.cos(yaw)+z*Math.sin(yaw),zz=-x*Math.sin(yaw)+z*Math.cos(yaw);return [xx/11,-((y-1.65)*Math.cos(pitch)+zz*Math.sin(pitch))/11];};
 const fit=json('displayFramingPoints(current,createGeometry(current))').map(project);
 const minX=Math.min(...fit.map(p=>p[0])),maxX=Math.max(...fit.map(p=>p[0])),minY=Math.min(...fit.map(p=>p[1])),maxY=Math.max(...fit.map(p=>p[1]));
 const margin=Math.min(56,width*.16),scale=Math.min((width-2*margin)/(maxX-minX),Math.max(24,height-48)/(maxY-minY))*read('sceneZoom');
 const cx=width/2-(minX+maxX)*scale/2,cy=(height-20)/2-(minY+maxY)*scale/2;
 return p=>{const q=project(p);return [cx+q[0]*scale,cy+q[1]*scale];};
}
function matchPolygon(f){
 const screen=screenFunction(),expected=f.v.map(p=>screen(world(p,f)));
 assert(polygons.some(ps=>ps.length===expected.length&&ps.every((p,i)=>Math.hypot(p[0]-expected[i][0],p[1]-expected[i][1])<1e-7)),'Canvas face does not match independently projected physical vertices');
 return screen;
}
function columnEdge(){
 const candidates=[];
 for(const f of json('createGeometry(current).faces').filter(f=>['tool','leftColumn','rightColumn'].includes(f.pose)))for(let j=0;j<f.v.length;j++){
  const a=f.v[j],b=f.v[(j+1)%f.v.length],d=subtract(b,a);
  if(Math.abs(d[0])<1e-10&&Math.abs(d[2])<1e-10&&Math.abs(d[1])>=1)candidates.push({f,a:d[1]>=0?a:b,b:d[1]>=0?b:a,length:Math.abs(d[1])});
 }
 candidates.sort((a,b)=>b.length-a.length);assert(candidates.length);return candidates[0];
}
function observeColumn(){
 read('drawScene();');const {f,a,b}=columnEdge(),screen=matchPolygon(f),wa=world(a,f),wb=world(b,f),sa=screen(wa),sb=screen(wb);
 return {wa,wb,sa,sb,dx:sb[0]-sa[0],dy:sa[1]-sb[1]};
}
// Orthographic observation removes perspective lean and keeps water-level
// signs readable in the defined positive world directions, at every scale.
for(const [index,mode] of variants){
 open(index,mode);name=read('current.kind');setHeights('()=>0');const saved=json('levelRecord()');
 for(const view of ['front','side','oblique']){
  r.sceneView.change(view);
  for(const zoom of [.65,1,1.8]){read(`sceneZoom=${zoom};`);name=read('current.kind')+'/'+view+'/'+zoom;
   check('projection',()=>{const p=observeColumn();near(p.wb[0]-p.wa[0],0);near(p.wb[2]-p.wa[2],0);near(p.dx,0);assert(p.dy>0);assert.deepEqual(json('levelRecord()'),saved);});
  }
  if(view!=='oblique')check('axisLabels',()=>{
   // The axis aligned with the line of sight appears as a dot, retaining its
   // name. Overlapping supports can still be selected through the lower map.
   assert(arcs.some(a=>a.radius===3),'view-aligned linear axis needs a visible dot');
   for(const button of r.supportMap.querySelectorAll('[data-support]')){button.click();assert.equal(read('selected'),Number(button.dataset.support));}
   assert.deepEqual(json('levelRecord()'),saved);
  });
 }
 read('sceneZoom=1;');
 for(const view of ['front','side'])for(const sign of [-1,1]){
  r.sceneView.change(view);setHeights(`s=>{const c=levelCoordinates(s.x,s.z);return c.${view==='front'?'x':'z'}*.03*${sign};}`);name=read('current.kind')+'/'+view+'/tilt/'+sign;
  check('projection',()=>{const p=observeColumn(),component=view==='front'?0:2;assert(Math.sign(p.wb[component]-p.wa[component])===-sign);assert(Math.sign(p.dx)===-sign);assert(p.dy>0);const bubble=view==='front'?parseFloat(r.coarseBubbleLR.style.left)-50:50-parseFloat(r.coarseBubbleFB.style['--bubble-position']);assert(Math.sign(bubble)===sign);});
 }
 r.sceneView.change('side');const before=json('levelRecord()');read('rotate(0);');
 check('projection',()=>assert.equal(read('sceneView'),'side'));
 read('rotate(.1);');check('projection',()=>{assert.equal(read('sceneView'),'oblique');assert.deepEqual(json('levelRecord()'),before);});
}
// Derive surface gradients from heights, rather than repeating the body
// rotation formula. Portal tool posture uses the mean of both column sites.
const heightPatterns=[
 '()=>0','s=>.3*s.x/(current.w*.4)','s=>.3*s.z/(current.d*.4)',
 's=>.24*(s.x/(current.w*.4)+s.z/(current.d*.4))',
 '(s,i)=>[.5,-.5,0][i%3]','()=>-.5','()=>.5'
];
for(const [index,mode] of variants){
 open(index,mode);const kind=read('current.kind'),defaultDimensions=json('[levelConfig.width,levelConfig.depth]');
 for(const [w,d] of [defaultDimensions,[.5,.5],[.5,20],[20,.5],[20,20]])for(const exaggerated of [false,true]){
  read(`levelConfig.width=${w};levelConfig.depth=${d};$('exaggerate').checked=${exaggerated};`);
  let fixedClearance;
  for(const heights of heightPatterns){
   setHeights(heights);name=kind+'/'+w+'x'+d+'/exaggerated='+exaggerated+'/'+heights;
   check('surfaceNormals',()=>{
    const poses=json('levelGeometry.poses'),factor=read('displayFactor()');
    const config=json('levelConfig'),size=json('[current.w*.8,current.d*.8]');
    const mapping=p=>[p.x/size[0]*config.width,p.z/size[1]*config.depth];
    const samples=json('({tool:levelGeometry.toolPoints,work:[levelGeometry.workPoint]})');
    const curved=read("current.supportLayout==='irregular'")?irregularHeightOracle(json('supports.map((s,i)=>({...levelCoordinates(s.x,s.z),h:supportHeights[i]}))')):null;
    for(const [pose,info] of Object.entries(poses)){
     const points=samples[pose]||[info.anchor],slopes=points.map(p=>{
      const [x,z]=mapping(p),eps=1e-5,h=read(`levelSolution.heightAt(${x},${z})`);
      if(curved){const gradient=curved.slopeAt(x,z);return [gradient.lr,gradient.fb];}
      return [(read(`levelSolution.heightAt(${x+eps},${z})`)-h)/eps,(read(`levelSolution.heightAt(${x},${z+eps})`)-h)/eps];
     });
     const gradient=[0,1].map(k=>slopes.reduce((sum,s)=>sum+s[k]/slopes.length,0)*factor/1000),expected=unit([-gradient[0],1,-gradient[1]]);
     const a=[info.anchor.x,.66,info.anchor.z],b=[info.anchor.x,1.66,info.anchor.z];
     const actual=unit(subtract(json(`levelBodyVisualPoint(${literal(b)},${literal(pose)})`),json(`levelBodyVisualPoint(${literal(a)},${literal(pose)})`)));
     // Connected portal frames and seats have independent endpoint/analytic
     // coverage in check-structural-invariants; this suite checks Canvas wiring.
     pointNear(actual,read('!!levelGeometry.portal')?json(`displayPoseFrame('${pose}').up`):expected,2e-8);
    }
    // Each raw support coordinate lands on the solver's physical coordinate.
    for(const s of json('supports')){const [x,z]=mapping(s),p=json(`levelVisualPoint([${s.x},.66,${s.z}])`);if(read('!!levelGeometry.portal'))pointNear(p,json(`displaySurfacePoint(${x},${z})`));else {near(p[0],x);near(p[2],z);near(p[1],.66+read('displayClearance()')+factor*read(`levelSolution.heightAt(${x},${z})`)/1000);}}
   });
   check('groundContact',()=>{
    const clearance=read('displayClearance()');if(fixedClearance===undefined)fixedClearance=clearance;else near(clearance,fixedClearance);
    const faces=json('createGeometry(current).faces'),padBottoms=faces.filter(f=>f.pose.startsWith('pad:')&&f.v.every(p=>Math.abs(p[1])<1e-10));
    assert.equal(padBottoms.length,read('supports.length'));
    for(const f of padBottoms)for(const p of f.v)near(world(p,f)[1],0);
    for(const f of faces.filter(f=>f.pose==='bed'))for(const p of f.v)assert(world(p,f)[1]>=.115-1e-8,'bed intersects support pads');
    for(const s of json('supports')){
     const x=s.x,z=s.z,top=json(`levelVisualPoint([${x},.195,${z}],'bed')`);
     pointNear(json(`levelVisualPoint([${x},.07,${z}],'support:0')`),json(`displayCoordinates([${x},.09,${z}])`));
     pointNear(json(`levelVisualPoint([${x},.29,${z}],'support:0')`),top);
    }
   });
  }
  // Match contact faces to actual Canvas, then verify annotation anchors use
  // the same world point as the top centre of each support screw.
  name=kind+'/'+w+'x'+d+'/groundCanvas';read('drawScene();');
  check('groundContact',()=>{
   const screen=screenFunction();
   for(const f of json('createGeometry(current).faces').filter(f=>f.pose.startsWith('pad:')&&f.v.every(p=>Math.abs(p[1])<1e-10)))matchPolygon(f);
   const surface=json('levelSurfaceFaces(current)[0]');assert(surface);matchPolygon(surface);
   const supportArcs=arcs.filter(a=>a.radius===13),rawSupports=json('supports'),dense=rawSupports.length>8;
   assert.equal(supportArcs.length,dense?1:rawSupports.length);
   rawSupports.forEach((s,i)=>{const q=screen(json(`levelVisualPoint([${s.x},.29,${s.z}],'support:${i}')`));
    const radius=dense&&i!==read('selected')?3:13;
    assert(arcs.some(a=>a.radius===radius&&Math.abs(a.x-q[0])<1e-8&&Math.abs(a.y-q[1]-10)<1e-8),'support '+i+' must retain its true scene anchor');
   });
  });
 }
}
// Average water levels can differ from a column's local slope on a twisted
// bed. Keep this distinction rather than forcing the column to the average.
open(1,'');setHeights('s=>{const p=levelCoordinates(s.x,s.z);return .06*p.x-.08*p.x*p.z;}');r.sceneView.change('front');
name='horizontal/average-versus-local';
check('surfaceNormals',()=>{const p=observeColumn();assert(read('levelSolution.lr')>0);assert(read('levelGeometry.poses.tool.slope.lr')<0);assert(parseFloat(r.coarseBubbleLR.style.left)>50);assert(p.dx>0);});
// Mapping the physical dimensions before A/C rotation preserves every rigid
// face even with a forty-fold width/depth aspect ratio.
open(5,'');
for(const [w,d] of [[.5,20],[20,.5]]){
 read(`levelConfig.width=${w};levelConfig.depth=${d};positions={X:0,Y:0,Z:0,A:0,C:0};`);setHeights('s=>.2*s.x/(current.w*.4)-.1*s.z/(current.d*.4)');
 const rotating=json('createGeometry(current).faces').filter(f=>f.axes.includes('A')||f.axes.includes('C'));
 const lengths=rotating.map(f=>f.v.map((p,i)=>Math.hypot(...subtract(world(p,f),world(f.v[(i+1)%f.v.length],f)))));
 for(const A of [-100,0,100])for(const C of [-100,-50,0,50,100]){
  read(`positions.A=${A};positions.C=${C};updateLeveling(false);`);name='five/'+w+'x'+d+'/A='+A+'/C='+C;
  check('rigidMotion',()=>{rotating.forEach((f,j)=>f.v.forEach((p,i)=>near(Math.hypot(...subtract(world(p,f),world(f.v[(i+1)%f.v.length],f))),lengths[j][i],1e-8)));matchPolygon(rotating.find(f=>f.axes.includes('C')));});
 }
}
// Fixed views may collapse a direction to a point, but keep its axis name.
for(const [index,mode] of variants){
 open(index,mode);const kind=read('current.kind'),axes=json('axisConfig(current).map(a=>a.key)');
 for(const dimensions of [[.5,20],[20,.5]]){
  read(`levelConfig.width=${dimensions[0]};levelConfig.depth=${dimensions[1]};positions={X:100,Y:-100,Z:100,A:100,C:100};`);setHeights('(s,i)=>[.5,-.5,0][i%3]');
  for(const size of [[232,102],[232,151],[302,305],[384,210],[623,687]])for(const view of ['front','side','oblique']){
   [width,height]=size;r.sceneView.change(view);name=kind+'/'+dimensions.join('x')+'/'+view+'/'+size.join('x');
   check('axisLabels',()=>{
    const labels=texts.filter(t=>/^[XYZAC]軸$/.test(t.text));assert.deepEqual(labels.map(t=>t.text.slice(0,1)).sort(),[...axes].sort());
    for(const label of labels){assert(label.box,'axis has a readable label background');const b=label.box;assert(b.x>=0&&b.y>=0&&b.x+b.w<=width&&b.y+b.h<=height,'axis name clips outside Canvas');}
   });
  }
 }
}
console.log(JSON.stringify(result,null,2));if(result.failures.length)process.exitCode=1;

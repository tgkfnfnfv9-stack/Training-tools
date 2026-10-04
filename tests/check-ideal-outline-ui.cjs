'use strict';
// Compare the real Canvas paint operations with the ideal overlay on/off.
// The overlay may add subdued dashed strokes, but cannot move or recolor
// the current model, support marks, axes, or labels.
const assert=require('node:assert/strict');
const {registry:r,read,json,storage}=require('./leveling-dom-env.cjs')();
read('Math.random=()=>.271828;');
let width=302,height=305,path=[],operations=[],frames=0,coordinates=0;
const savedStyles=[],styleKeys=['strokeStyle','fillStyle','lineWidth','font','textAlign','textBaseline','globalAlpha'];
const ctx={strokeStyle:'#000000',fillStyle:'#000000',lineWidth:1,globalAlpha:1,dash:[],
 scale(x,y){finite(x,y);},
 save(){savedStyles.push({values:Object.fromEntries(styleKeys.map(k=>[k,this[k]])),dash:[...this.dash]});},
 restore(){assert(savedStyles.length,'unbalanced Canvas restore');const s=savedStyles.pop();Object.assign(this,s.values);this.dash=s.dash;},
 setLineDash(dash){finite(...dash);this.dash=[...dash];},
 beginPath(){path=[];},closePath(){path.push(['close']);},
 moveTo(x,y){finite(x,y);path.push(['move',x,y]);},lineTo(x,y){finite(x,y);path.push(['line',x,y]);},
 arc(x,y,radius,start,end){finite(x,y,radius,start,end);path.push(['arc',x,y,radius,start,end]);},
 stroke(){paint({type:'stroke',style:this.strokeStyle,width:this.lineWidth,dash:[...this.dash],alpha:this.globalAlpha,path:path.map(p=>[...p])});},
 fill(){paint({type:'fill',style:this.fillStyle,alpha:this.globalAlpha,path:path.map(p=>[...p])});},
 fillRect(x,y,w,h){finite(x,y,w,h);if(x===0&&y===0&&w===width&&h===height){assert.equal(savedStyles.length,0);operations=[];frames++;}paint({type:'rect',style:this.fillStyle,alpha:this.globalAlpha,x,y,w,h});},
 fillText(text,x,y){finite(x,y);paint({type:'text',text,x,y,font:this.font,align:this.textAlign,baseline:this.textBaseline,style:this.fillStyle,alpha:this.globalAlpha});},
 measureText(text){const px=Number(/(\d+)px/.exec(this.font||'10px')?.[1]||10);return {width:[...text].reduce((n,ch)=>n+(/[\x00-\x7f]/.test(ch)?.56:1)*px,0)};}
};
function finite(...values){assert(values.every(Number.isFinite),'non-finite Canvas coordinate');coordinates+=values.length;}
function paint(op){operations.push({...op,signature:JSON.stringify(op)});}
r.scene.getContext=()=>ctx;r.scene.getBoundingClientRect=()=>({width,height});
const variants=[[0,'standard'],[0,'compact'],[1,''],[2,''],[3,'long'],[3,'cross'],[4,''],[5,''],[6,'']];
const sizes=[[232,100],[232,151],[302,305],[384,210],[669,720]];
let checks=0,maximumIdealSegments=0,maximumIdealToCurrentRatio=0;
function check(name,fn){try{fn();checks++;}catch(error){throw new Error(name+': '+error.message);}}
function toggle(on){r.showIdealOutline.checked=on;r.showIdealOutline.onchange();assert.equal(savedStyles.length,0);return operations.map(op=>({...op}));}
function addedPaint(on,off){
 let next=0;const extras=[];
 on.forEach((op,index)=>{if(op.signature===off[next]?.signature)next++;else extras.push({op,index});});
 assert.equal(next,off.length,'enabling the outline changes an existing Canvas operation');return extras;
}
function alpha(op){
 const rgba=/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/.exec(op.style),hex=/^#[\da-f]{6}([\da-f]{2})$/i.exec(op.style);
 return (rgba?Number(rgba[1]):hex?parseInt(hex[1],16)/255:1)*op.alpha;
}
function segments(paints){
 const lines=[];
 for(const paint of paints){let previous;
  for(const p of paint.path||[]){if(p[0]==='move')previous=p.slice(1);else if(p[0]==='line'){if(previous)lines.push([previous,p.slice(1)]);previous=p.slice(1);}else previous=undefined;}
 }
 return lines;
}
const longest=paints=>Math.max(...segments(paints).map(([a,b])=>Math.hypot(a[0]-b[0],a[1]-b[1])));
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
check('default-on comparison control remains in independently scrollable controls',()=>{
 assert(r.showIdealOutline?.checked);assert.equal(typeof r.showIdealOutline.onchange,'function');
 const row=r.showIdealOutline.closest('#idealComparison');assert(row);assert.equal(row.parentElement,r.trainingControls);assert.equal(row,r.trainingControls.children[0]);
 assert.equal(r.showIdealOutline.closest('.pinned-visual'),null);assert.equal(r.showIdealOutline.closest('#sceneToolbar'),null);
 assert(row.querySelectorAll('label').some(label=>label.getAttribute('for')==='showIdealOutline'||r.showIdealOutline.closest('label')===label),'checkbox needs an associated clickable label');
 assert.match(row.textContent,/理想/);assert.match(row.textContent,/破線/);
 assert.equal(r.viewerLevels.parentElement,r.sceneViewport.parentElement);assert.equal(r.scene.parentElement,r.sceneViewport);
});
for(const [index,mode] of variants){
 storage.clear();read(`openMachine(machines[${index}]);`);if(mode)r.machineMode.change(mode);
 const kind=read('current.kind'),axes=json('axisConfig(current).map(a=>a.key)');
 read('positions={X:100,Y:-100,Z:100,A:100,C:50};supportHeights=supports.map((s,i)=>[.35,-.35,0][i%3]);updateLeveling(false);');
 for(const size of sizes)for(const view of ['front','side','oblique']){
  [width,height]=size;r.sceneView.change(view);const lengths=[];
  for(const zoom of [.65,1,1.8]){
   read(`sceneZoom=${zoom};`);const before=json('levelRecord()'),bubbles=[r.coarseBubbleLR.style.left,r.coarseBubbleFB.style['--bubble-position']];
   const off=toggle(false),on=toggle(true),extras=addedPaint(on,off),name=kind+'/'+size.join('x')+'/'+view+'/'+zoom;
   check('subdued line-only overlay '+name,()=>{
    assert(extras.length,'ideal outline is absent');
    for(const {op} of extras){assert.equal(op.type,'stroke','outline must not add opaque fills or text');assert(op.width>0&&op.width<=1.2,'outline should remain a thin line');assert(op.dash.length>=2&&op.dash.every(d=>d>0),'outline must be dashed');assert(alpha(op)>0&&alpha(op)<=.5,'outline is too prominent');assert(op.path.some(p=>p[0]==='line'),'outline contains no visible edges');}
    assert.deepEqual(json('levelRecord()'),before);assert.deepEqual([r.coarseBubbleLR.style.left,r.coarseBubbleFB.style['--bubble-position']],bubbles);
   });
   check('existing annotations retain priority '+name,()=>{
    const lastIdeal=Math.max(...extras.map(e=>e.index));
    const firstSupport=on.findIndex(op=>(op.path||[]).some(p=>p[0]==='arc'&&p[3]===13));
    const firstText=on.findIndex(op=>op.type==='text');assert(firstSupport>lastIdeal&&firstText>lastIdeal,'ideal lines cover support marks or labels');
    const axisLabels=on.filter(op=>op.type==='text'&&/^[XYZAC]軸$/.test(op.text));assert.deepEqual(axisLabels.map(op=>op.text.slice(0,1)).sort(),[...axes].sort());
    axisLabels.forEach(label=>assert(label.x>=20&&label.x<=width-20&&label.y>=11&&label.y<=height-11,'axis label clips outside the Canvas'));
   });
   const ideal=extras.map(e=>e.op),current=off.filter(op=>op.type==='stroke'&&op.width===.6),idealCount=segments(ideal).length,currentCount=segments(current).length;
   maximumIdealSegments=Math.max(maximumIdealSegments,idealCount);maximumIdealToCurrentRatio=Math.max(maximumIdealToCurrentRatio,idealCount/currentCount);lengths.push(longest(ideal));
  }
  check('screen overlay follows the viewing scale '+kind+'/'+size.join('x')+'/'+view,()=>{assert(lengths.every(l=>l>0));near(lengths[0]/lengths[1],.65);near(lengths[2]/lengths[1],1.8);});
 }
}
read('openMachine(machines[5]);');
for(const axis of ['A','C']){
 read(`positions={X:0,Y:0,Z:0,A:0,C:0};selectedAxis=${JSON.stringify(axis)};updateLeveling(false);`);const zero=addedPaint(toggle(true),toggle(false)).map(e=>e.op.signature);
 read(`positions.${axis}=100;updateLeveling(false);`);const moved=addedPaint(toggle(true),toggle(false)).map(e=>e.op.signature);
 check('rotary position changes the displayed ideal outline '+axis,()=>assert.notDeepEqual(moved,zero));
}
// A planar triangulation does not create an extra comparison seam.
const face=v=>({v,axes:[],pose:'tool',color:'#8b9da3',shade:1});
const square={faces:[face([[-1,1,-1],[1,1,-1],[1,1,1]]),face([[-1,1,-1],[1,1,1],[-1,1,1]])]};
check('coplanar internal edge is absent',()=>{
 const edges=json(`idealOutlineEdges(${JSON.stringify(square)})`);assert.equal(edges.length,4);assert(edges.every(e=>!e.smooth));
});
// Smooth cylinder facets need only the two visible body sides. Keeping cap
// rims without those two sides would make an upright cylinder look broken.
const rings=[0,1].map(k=>Array.from({length:20},(_,i)=>{const a=i*Math.PI/10;return [Math.cos(a),k*2,Math.sin(a)];}));
const cylinder={faces:[face(rings[0]),face(rings[1]),...rings[0].map((p,i)=>face([p,rings[0][(i+1)%20],rings[1][(i+1)%20],rings[1][i]]))]};
check('cylinder edge candidates distinguish cap rims from smooth facets',()=>{
 const edges=json(`idealOutlineEdges(${JSON.stringify(cylinder)})`);assert.equal(edges.filter(e=>!e.smooth).length,40);assert.equal(edges.filter(e=>e.smooth).length,20);
});
for(const [view,angle] of [['front',0],['side',Math.PI/2],['oblique',-.45]])check('cylinder keeps two body silhouette edges '+view,()=>{
 const lines=json(`idealOutlineSegments(idealOutlineEdges(${JSON.stringify(cylinder)}),idealDisplayContext(current),${angle},${JSON.stringify(view)})`);
 assert.equal(lines.length,42);assert.equal(lines.filter(e=>Math.abs(e.b[1]-e.a[1])>1).length,2);
});
console.log(JSON.stringify({checks,frames,finiteCanvasCoordinates:coordinates,maximumIdealSegments,maximumIdealToCurrentRatio},null,2));

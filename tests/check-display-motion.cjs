'use strict';
// Measure the displacement of the same physical vertices used by render(),
// independently of the displayMovement compensation formula. A guide arrow
// must match every assembly on a common plane. On a twisted bed, moving column
// roots retain local contact while fixed-anchor slides follow their guides.
const assert=require('node:assert/strict');
const MachineAccuracy=require('../src/machine-accuracy.js');
const {registry:r,read,json,storage}=require('./leveling-dom-env.cjs')({pureLeveling:true});
const variants=[[0,'compact'],[1,''],[2,''],[3,'l3-3000'],[4,''],[5,''],[6,'']];
const literal=JSON.stringify,sub=(a,b)=>a.map((v,i)=>v-b[i]),length=v=>Math.hypot(...v),unit=v=>v.map(q=>q/length(v));
const result={checks:{planarMotion:0,localContact:0,fixedAnchorMotion:0,averageVersusLocal:0},maximumDirectionDifference:0,maximumContactDifference:0,failures:[]};
let name='';
function check(kind,fn){try{fn();result.checks[kind]++;}catch(e){result.failures.push({kind,name,message:e.message});}}
function near(a,b,tolerance=1e-8){assert(Math.abs(a-b)<=tolerance,`${a} != ${b}`);}
function pointNear(a,b,tolerance=1e-8){assert(length(sub(a,b))<=tolerance,`${literal(a)} != ${literal(b)}`);}
function open(index,mode){storage.clear();read(`openMachine(machines[${index}]);`);if(mode)r.machineMode.change(mode);}
function profile(){const p=MachineAccuracy.generate('used',123,json('machineLinearKeys()'),read('supports.length'));read(`machineProfile=${literal(p)};machineReference=null;`);}
function setState(state){read(`positions=${literal(state)};updateLeveling(false);`);}
function rawSize(){return json('[current.w*.8,current.d*.8]');}
function physical(p){const size=rawSize(),dimensions=json('[levelConfig.width,levelConfig.depth]');return [p[0]/size[0]*dimensions[0],p[1],p[2]/size[1]*dimensions[1]];}
function heights(fn){const ss=json('supports');read(`supportHeights=${literal(ss.map(fn))};updateLeveling(false);`);}
function groups(key){
 const list=new Map();
 for(const face of json(`createGeometry(current).faces.filter(f=>f.axes.includes(${literal(key)}))`)){
  const id=literal([face.pose,face.axes]);if(!list.has(id))list.set(id,{pose:face.pose,axes:face.axes,points:[]});list.get(id).points.push(...face.v);
 }
 assert(list.size,'linear axis has no moving assembly');return [...list.values()];
}
function centroids(list){return json(`(${literal(list)}).map(group=>{const points=group.points.map(p=>levelMappedBodyVisualPoint(displayTransformedPoint(p,group.axes,current,positions,group.pose),group.pose));return [0,1,2].map(i=>points.reduce((s,p)=>s+p[i]/points.length,0));})`);}
function arrowDirection(key){return json(`(()=>{const a=axisIndicators(current,createGeometry(current)).find(q=>q.key===${literal(key)}),o=a.points[0].map((v,i)=>(v+a.points[1][i])/2),p=a.points.map(q=>levelAxisVisualPoint(q,o,a.pose,a.bodyOrigin));return p[1].map((v,i)=>v-p[0][i]);})()`);}
function compareMotion(delta,arrow,expectedLength){
 assert(length(delta)>1e-8,'slide did not move');
 const error=length(sub(unit(delta),unit(arrow)));result.maximumDirectionDifference=Math.max(result.maximumDirectionDifference,error);
 assert(error<2e-8,`motion differs from its arrow by ${error} in unit direction`);
 near(length(delta),expectedLength,5e-9*Math.max(1,expectedLength));
}
const originState={X:37,Y:-23,Z:19,A:44,C:-36};
// Compound slopes exercise the second-order difference between graph tangents
// and an orthonormal support frame. Unequal support dimensions also exercise
// physical mapping before rotary motion and linear-stroke conversion.
for(const [index,mode] of variants){
 open(index,mode);profile();const kind=read('current.kind'),defaultSize=json('[levelConfig.width,levelConfig.depth]');
 read('levelConfig.columnX=35;levelConfig.columnZ=-21;');
 for(const [width,depth] of [defaultSize,[.5,20],[20,.5]])for(const plane of [[0,0],[.18,.12],[-.16,.13]])for(const exaggerated of [false,true]){
  read(`levelConfig.width=${width};levelConfig.depth=${depth};$('exaggerate').checked=${exaggerated};`);
  const size=rawSize();heights(s=>plane[0]*s.x/(size[0]/2)+plane[1]*s.z/(size[1]/2));
  assert(read('levelSolution.residual')<1e-10&&Math.abs(read('levelSolution.twist'))<1e-10,'common-plane fixture is not planar');
  for(const axis of json('axisConfig(current).filter(a=>["X","Y","Z"].includes(a.key))')){
   const list=groups(axis.key),beforeState={...originState,[axis.key]:originState[axis.key]-1},afterState={...originState,[axis.key]:originState[axis.key]+1};
   setState(beforeState);const before=centroids(list);setState(afterState);const after=centroids(list),arrow=arrowDirection(axis.key),amplitude=length(physical(axis.vector))*axis.amp*.02;
   list.forEach((group,i)=>{name=`${kind}/${width}x${depth}/plane=${plane}/exaggerated=${exaggerated}/${axis.key}/${group.pose}/${group.axes}`;check('planarMotion',()=>compareMotion(sub(after[i],before[i]),arrow,amplitude));});
  }
 }
}
// Pure twist and middle-support deformation can change local posture as a
// column travels. A single average guide cannot erase that change: roots must
// remain on the height graph. Internal slides have fixed anchors and do match
// their representative guide, even inside a group with a nonzero parent move.
for(const [index,mode] of variants){
 open(index,mode);if(read('supports.length')===3)continue;profile();const kind=read('current.kind'),defaultSize=json('[levelConfig.width,levelConfig.depth]');
 read('levelConfig.columnX=35;levelConfig.columnZ=-21;');
 for(const [width,depth] of [defaultSize,[.5,20],[20,.5]])for(const deformation of ['twist','middle'])for(const exaggerated of [false,true]){
  read(`levelConfig.width=${width};levelConfig.depth=${depth};$('exaggerate').checked=${exaggerated};`);
  const size=rawSize();heights(s=>{const x=s.x/(size[0]/2),z=s.z/(size[1]/2);return .2*x*z+(deformation==='middle'?.08*x-.06*z+((Math.abs(x)<.99||Math.abs(z)<.99)?.09:0):0);});
  assert(read('levelSolution.residual')>1e-10||Math.abs(read('levelSolution.twist'))>1e-10,'nonuniform fixture is planar');
  for(const axis of json('axisConfig(current).filter(a=>["X","Y","Z"].includes(a.key))')){
   const list=groups(axis.key),beforeState={...originState,[axis.key]:originState[axis.key]-1},afterState={...originState,[axis.key]:originState[axis.key]+1};
   setState(beforeState);const before=centroids(list),beforePoses=json('levelGeometry.poses');
   setState(afterState);const after=centroids(list),afterPoses=json('levelGeometry.poses'),arrow=arrowDirection(axis.key),amplitude=length(physical(axis.vector))*axis.amp*.02;
   list.forEach((group,i)=>{
    const a=beforePoses[group.pose]||beforePoses.tool,b=afterPoses[group.pose]||afterPoses.tool;
    if(length([a.anchor.x-b.anchor.x,a.anchor.z-b.anchor.z])>1e-12)return;
    name=`${kind}/${width}x${depth}/${deformation}/exaggerated=${exaggerated}/${axis.key}/${group.pose}/${group.axes}`;
    check('fixedAnchorMotion',()=>compareMotion(sub(after[i],before[i]),arrow,amplitude));
   });
  }
  if(!['travel','horizontal','gantry'].includes(kind))continue;
  const poses=kind==='gantry'?['leftColumn','rightColumn']:['tool'];
  setState({...originState,X:0});const basePoses=json('levelGeometry.poses'),offset=json('columnLayoutOffset(current)');
  for(const pose of poses){
   // The nominal root at y=.66 is the anchor of the tall column. The real
   // column's small nominal bottom clearance is separate from support tilt.
   const a=basePoses[pose].anchor,root=[a.x-(pose==='tool'?offset.x:0),.66,a.z-(pose==='tool'?offset.z:0)];
   const columnFaces=json(`createGeometry(current).faces.filter(f=>f.pose===${literal(pose)}&&f.axes.length===1&&f.axes[0]==='X')`);
   assert(columnFaces.some(f=>Math.max(...f.v.map(p=>p[1]))-Math.min(...f.v.map(p=>p[1]))>=2.49),'root fixture needs a real tall moving column');
   for(const X of [-100,-57,0,43,100]){
    setState({...originState,X});name=`${kind}/${width}x${depth}/${deformation}/exaggerated=${exaggerated}/${pose}/root X=${X}`;
    check('localContact',()=>{
     const actual=json(`levelMappedBodyVisualPoint(displayTransformedPoint(${literal(root)},['X'],current,positions,${literal(pose)}),${literal(pose)})`),a=json(`levelGeometry.poses.${pose}.anchor`),mapped=physical([a.x,.66,a.z]);
     const surface=[mapped[0],.66+read('displayClearance()')+read('displayFactor()')*read(`levelSolution.heightAt(${mapped[0]},${mapped[2]})`)/1000,mapped[2]];
     result.maximumContactDifference=Math.max(result.maximumContactDifference,length(sub(actual,surface)));pointNear(actual,surface,2e-8);
    });
   }
  }
 }
}
// A centred average front/back vial does not force each local column vertical.
// At the centre of a symmetric horizontal MC the front/back lean is zero;
// moving X on a twisted bed creates a local front/back lean of the correct sign.
open(1,'');
for(const exaggerated of [false,true]){
 read(`$('exaggerate').checked=${exaggerated};`);const size=rawSize();heights(s=>.2*s.x/(size[0]/2)*s.z/(size[1]/2));
 for(const X of [0,70]){
  setState({X,Y:0,Z:0,A:0,C:0});name=`horizontal/meanFB0/local/X=${X}/exaggerated=${exaggerated}`;
  check('averageVersusLocal',()=>{
   near(read('levelSolution.fb'),0,1e-12);near(parseFloat(r.coarseBubbleFB.style['--bubble-position']),50,1e-9);
   const a=json('levelGeometry.poses.tool.anchor'),base=json(`levelBodyVisualPoint([${a.x},.66,${a.z}],'tool')`),top=json(`levelBodyVisualPoint([${a.x},1.66,${a.z}],'tool')`),up=sub(top,base),fb=read('levelGeometry.poses.tool.slope.fb');
   if(X===0){near(fb,0,1e-12);near(up[2],0,1e-10);}else{assert(fb>0);assert(up[2]<0,'back-high local support must lean the column toward the front');}
  });
 }
}
// Solid-body intrinsic error remains after the support plane is level.
open(0,'compact');profile();heights(()=>0);setState({X:0,Y:0,Z:0,A:0,C:0});name='vertical/flat-support/intrinsic-remains';
check('averageVersusLocal',()=>{near(read('levelSolution.fb'),0);near(read('levelGeometry.toolSlope.fb'),0);const a=json('levelGeometry.poses.tool.anchor'),p=json(`levelBodyVisualPoint([${a.x},1.66,${a.z}],'tool')`),o=json(`levelBodyVisualPoint([${a.x},.66,${a.z}],'tool')`);assert(Math.abs(p[2]-o[2])>1e-6,'intrinsic front lean was incorrectly removed');});
console.log(JSON.stringify(result,null,2));if(result.failures.length)process.exitCode=1;

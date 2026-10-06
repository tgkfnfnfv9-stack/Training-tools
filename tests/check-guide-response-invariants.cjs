'use strict';
// Independent guide/carriage checks. An analytic bilinear surface and finite
// differences of displayed datum points provide the expected guide direction.
// There is deliberately no rule that every axis pair must change.
const assert=require('node:assert/strict');
const makeEnvironment=require('./leveling-dom-env.cjs');
const MachineAccuracy=require('../src/machine-accuracy.js');
let checks=0;const failures=[];
function check(name,fn){checks++;try{fn();}catch(error){failures.push(name+': '+error.message);}}
const near=(a,b,t=1e-8)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,`${a} != ${b}`);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const unit=a=>a.map(v=>v/Math.hypot(...a));
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const vectorNear=(a,b,t=1e-8)=>a.forEach((v,i)=>near(v,b[i],t));
const pure=makeEnvironment({pureLeveling:true});
const open=(e,index)=>e.read(`openMachine(machines[${index}]);`);
const values=e=>e.json('levelGeometry.pairs.map(p=>p.deviationMicroradians)');
const direction=(e,key)=>e.json(`levelGeometry.directions.find(a=>a.key==='${key}').direction`);
function setSurface(e,expression,state={X:0,Y:0,Z:0,A:0,C:0}){e.read(`positions=${JSON.stringify(state)};supportHeights=supports.map((s,i)=>{const q=levelCoordinates(s.x,s.z);return ${expression};});updateLeveling();`);}
function arrow(e,key){return unit(e.json(`(()=>{const a=axisIndicators(current,createGeometry(current)).find(a=>a.key==='${key}'),o=a.points[0].map((v,i)=>(v+a.points[1][i])/2),p=a.points.map(q=>levelAxisVisualPoint(q,o,a.pose,a.bodyOrigin,a.key));return p[1].map((v,i)=>v-p[0][i]);})()`));}
function world(e,p,axes,pose='tool'){return e.json(`levelMappedBodyVisualPoint(displayTransformedPoint(${JSON.stringify(p)},${JSON.stringify(axes)},current,positions,'${pose}'),'${pose}')`);}

for(const index of [0,1,2,6]){
 open(pure,index);
 for(const expression of ['.04','.04+.017*q.x-.023*q.z','.02+.031*q.z']){
  setSurface(pure,expression);
  check(`${index} one support plane cannot create pair errors ${expression}`,()=>values(pure).forEach(v=>near(v,0,1e-7)));
 }
 setSurface(pure,'.02*q.x*q.z');const initial=values(pure);
 pure.read('supportHeights=supportHeights.map(h=>h+.01);updateLeveling();');
 check(`${index} uniform lift preserves pair errors`,()=>vectorNear(values(pure),initial,1e-7));
 setSurface(pure,'.02*q.x*q.z');
 check(`${index} operation reversal restores pair errors`,()=>vectorNear(values(pure),initial,1e-8));
}

open(pure,2);
for(const k of [-.02,.02])for(const X of [-100,0,100])for(const gain of [false,true]){
 pure.registry.exaggerate.checked=gain;
 setSurface(pure,`${k}*q.x*q.z+.031*q.x+.017*q.z`,{X,Y:0,Z:0,A:0,C:0});
 const x=pure.read('levelCoordinates(-.5+positions.X/100,0).x');
 const railZ=pure.read('levelCoordinates(0,current.d*.22).z');
 const columnZ=pure.read('levelCoordinates(0,current.d*.29).z');
 const a=k*railZ+.031,ac=k*columnZ+.031,b=k*x+.017;
 const expectedX=unit([1,a/1000,0]),expectedZ=unit([-ac/1000,1,-b/1000]);
 const expectedXZ=-Math.asin(dot(expectedX,expectedZ))*1e6;
 check(`travel X is analytic rail datum tangent ${k}/${X}/${gain}`,()=>vectorNear(direction(pure,'X'),expectedX,1e-10));
 check(`travel Z follows distinct column seat ${k}/${X}/${gain}`,()=>vectorNear(direction(pure,'Z'),expectedZ,1e-10));
 check(`travel XZ is independently computed relative angle ${k}/${X}/${gain}`,()=>near(pure.read("levelGeometry.pairs.find(p=>p.key==='XZ').deviationMicroradians"),expectedXZ,1e-7));
 check(`travel rigid YZ remains orthogonal ${k}/${X}/${gain}`,()=>near(pure.read("levelGeometry.pairs.find(p=>p.key==='YZ').deviationMicroradians"),0,1e-7));
 // Use y=.66 datum: rendered thickness is a normal extrusion, not another
 // independently defined rail reference line.
 const rawX=-.5+X/100,eps=.0001,d=pure.read('current.d');
 const means=[-eps,eps].map(delta=>{
  const pair=[-1,1].map(side=>pure.json(`levelVisualPoint([${rawX+delta},.66,${d*.22+side*.1}],'bed')`));
  return pair[0].map((v,i)=>(v+pair[1][i])/2);
 });
 check(`travel drawn rail datum tangent agrees with X arrow ${k}/${X}/${gain}`,()=>vectorNear(unit(sub(means[1],means[0])),arrow(pure,'X'),1e-8));
 for(const key of ['Y','Z']){
  pure.read('positions.Y=0;positions.Z=0;updateLeveling();');
  const point=[-.5,2.45,-.25],axes=['X','Y','Z'],low=world(pure,point,axes);
  pure.read(`positions.${key}=1;updateLeveling();`);const high=world(pure,point,axes);
  check(`travel actual ${key} slide direction follows arrow ${k}/${X}/${gain}`,()=>vectorNear(unit(sub(high,low)),arrow(pure,key),1e-8));
 }
}

// Horizontal machine: X follows the two drawn rails; vertical Y follows the
// column seat. h=k*x*z gives exact, independently known gradients at both.
open(pure,1);
for(const k of [-.02,.02])for(const X of [-100,0,100])for(const gain of [false,true]){
 pure.registry.exaggerate.checked=gain;
 setSurface(pure,`${k}*q.x*q.z+.031*q.x+.017*q.z`,{X,Y:0,Z:0,A:0,C:0});
 const x=pure.read('levelCoordinates(.55*positions.X/100,0).x');
 const railZ=pure.read('levelCoordinates(0,current.d*.28).z'),columnZ=pure.read('levelCoordinates(0,current.d*.29).z');
 const a=k*railZ+.031,ac=k*columnZ+.031,b=k*x+.017;
 const expectedX=unit([1,a/1000,0]),expectedY=unit([-ac/1000,1,-b/1000]);
 check(`horizontal X is analytic rail tangent ${k}/${X}/${gain}`,()=>vectorNear(direction(pure,'X'),expectedX,1e-10));
 check(`horizontal Y follows its column seat ${k}/${X}/${gain}`,()=>vectorNear(direction(pure,'Y'),expectedY,1e-10));
 check(`horizontal XY equals independent angle, without a minimum forced error ${k}/${X}/${gain}`,()=>near(pure.read("levelGeometry.pairs.find(p=>p.key==='XY').deviationMicroradians"),-Math.asin(dot(expectedX,expectedY))*1e6,1e-7));
 const rawX=.55*X/100,eps=.0001,d=pure.read('current.d');
 const means=[-eps,eps].map(delta=>{
  const pair=[-1,1].map(side=>pure.json(`levelVisualPoint([${rawX+delta},.66,${d*.28+side*.13}],'bed')`));
  return pair[0].map((v,i)=>(v+pair[1][i])/2);
 });
 check(`horizontal drawn rail datum tangent agrees with X arrow ${k}/${X}/${gain}`,()=>vectorNear(unit(sub(means[1],means[0])),arrow(pure,'X'),1e-8));
 const low=world(pure,[0,2.55,.25],['X','Y']);
 pure.read('positions.Y=1;updateLeveling();');const high=world(pure,[0,2.55,.25],['X','Y']);
 check(`horizontal vertical slide follows Y arrow ${k}/${X}/${gain}`,()=>vectorNear(unit(sub(high,low)),arrow(pure,'Y'),1e-8));
}

// The upper compact X table moves across its Y saddle without relocating
// the saddle's support datum. Y moves that datum on the machine bed.
open(pure,0);
for(const Y of [-100,0,100]){
 let baseline,anchor;
 for(const X of [-100,0,100]){
  setSurface(pure,'.02*q.x*q.z+.03*q.z',{X,Y,Z:0,A:0,C:0});
  const work=pure.json('levelGeometry.workPoint');
  if(!baseline){baseline=pure.json('levelGeometry.poses.work');anchor=work;}
  check(`compact upper-table X preserves saddle datum and posture ${Y}/${X}`,()=>{near(work.x,0);assert.deepEqual(work,anchor);assert.deepEqual(pure.json('levelGeometry.poses.work'),baseline);});
 }
}
setSurface(pure,'.02*q.x*q.z',{X:0,Y:-100,Z:0,A:0,C:0});const compactFront=pure.json('levelGeometry.poses.work');
setSurface(pure,'.02*q.x*q.z',{X:0,Y:100,Z:0,A:0,C:0});
check('compact Y changes saddle datum and transverse bed slope',()=>{const back=pure.json('levelGeometry.poses.work');assert.notEqual(compactFront.anchor.z,back.anchor.z);assert.notEqual(compactFront.slope.lr,back.slope.lr);});
for(const gain of [false,true]){
 pure.registry.exaggerate.checked=gain;setSurface(pure,'.02*q.x*q.z',{X:0,Y:23,Z:0,A:0,C:0});
 const low=world(pure,[0,1.06,-.27],['X','Y'],'work');
 pure.read('positions.X=1;updateLeveling();');const high=world(pure,[0,1.06,-.27],['X','Y'],'work');
 check(`compact upper table still moves along X arrow ${gain}`,()=>vectorNear(unit(sub(high,low)),arrow(pure,'X'),1e-8));
}

// Moving the cross-slide X does not relocate the carriage's bearing seat.
// Z moves that seat along the bed; the rendered cross-slide still moves in X.
open(pure,6);
for(const Z of [-100,0,100]){
 let baseline,anchor;
 for(const X of [-100,0,100]){
  setSurface(pure,'.02*q.x*q.z+.03*q.x',{X,Y:0,Z,A:0,C:0});
  const work=pure.json('levelGeometry.workPoint');
  if(!baseline){baseline=values(pure);anchor=work;}
  check(`lathe X leaves bed-seat location and precision unchanged ${Z}/${X}`,()=>{near(work.z,-.15);assert.deepEqual(work,anchor);vectorNear(values(pure),baseline,1e-8);});
 }
}
setSurface(pure,'.02*q.x*q.z',{X:0,Y:0,Z:-100,A:0,C:0});
const front=pure.json('levelGeometry.poses.work');
setSurface(pure,'.02*q.x*q.z',{X:0,Y:0,Z:100,A:0,C:0});
check('lathe Z still relocates carriage and samples its bed posture',()=>{const back=pure.json('levelGeometry.poses.work');assert.notEqual(front.anchor.x,back.anchor.x);assert.notEqual(front.slope.fb,back.slope.fb);});
for(const gain of [false,true]){
 pure.registry.exaggerate.checked=gain;setSurface(pure,'.02*q.x*q.z',{X:0,Y:0,Z:23,A:0,C:0});
 const low=world(pure,[.08,1.18,-.58],['X','Z'],'work');
 pure.read('positions.X=1;updateLeveling();');const high=world(pure,[.08,1.18,-.58],['X','Z'],'work');
 check(`lathe actual cross-slide movement still follows X arrow ${gain}`,()=>vectorNear(unit(sub(high,low)),arrow(pure,'X'),1e-8));
}

// The same travel-seat distortion can improve or worsen a pre-existing XZ.
open(pure,2);const trends=[];
for(const sign of [-1,1]){
 const profile={squareness:{XY:{microns:0},XZ:{microns:sign*100},YZ:{microns:0}}};
 setSurface(pure,'0');const initial=pure.read(`geometryModel(positions,levelSolution,${JSON.stringify(profile)}).pairs.find(p=>p.key==='XZ').deviationMicroradians`);
 setSurface(pure,'.02*q.x*q.z');const current=pure.read(`geometryModel(positions,levelSolution,${JSON.stringify(profile)}).pairs.find(p=>p.key==='XZ').deviationMicroradians`);
 trends.push(Math.abs(current)-Math.abs(initial));
}
check('same travel deformation improves or worsens according to intrinsic sign',()=>assert.ok(trends[0]*trends[1]<0));

(async()=>{
 const live=makeEnvironment();
 for(const [index,id] of [[0,'compact-table-path-v3'],[1,'horizontal-guide-v2'],[2,'travel-guide-v2'],[6,'lathe-carriage-v2']]){
  open(live,index);const keys=live.json('machineLinearKeys()');
  const profile=MachineAccuracy.generate('used',67123+index,keys,live.read('supports.length'));
  live.read(`initializeMachineAccuracy(${JSON.stringify(profile)});supportHeights=supports.map(()=>0);updateLeveling();`);const flat=values(live);
  setSurface(live,'.03+.017*q.x-.023*q.z');
  check(`${id} common plane preserves intrinsic squareness`,()=>vectorNear(values(live),flat,1e-7));
  live.read('setTrainingMenuOpen(false);supportHeights=supports.map(()=>0);selected=0;updateLeveling();');const before=values(live);
  live.registry.coarseAdjust.click();live.registry.raiseSupport.click();const adjusted=values(live);live.registry.lowerSupport.click();
  check(`${id} actual support buttons restore geometry`,()=>vectorNear(values(live),before,1e-7));
  live.registry.raiseSupport.click();const saved=live.json('levelRecord()');
  check(`${id} calculation identity distinguishes changed semantics`,()=>assert.equal(saved.calculationModel,id));
  live.read(`applyLevelRecord(${JSON.stringify(saved)});updateLeveling();`);
  check(`${id} save/reload preserves geometry and profile`,()=>{assert.deepEqual(live.json('levelRecord()'),saved);vectorNear(values(live),adjusted,1e-7);});
  const old={...saved,calculationModel:'connected-frames-v1'},bytes=JSON.stringify(old),oldKey=live.read("'training-level-connected-frames-v1:'+current.id+':'+machineMode+(current.layoutId?':'+current.layoutId:'')");
  live.storage.set(oldKey,bytes);
  await live.registry.importLevel.onchange({target:{value:'old',files:[{size:bytes.length,text:async()=>bytes}]}});
  check(`${id} old-model JSON rejected without reinterpretation`,()=>{assert.deepEqual(live.json('levelRecord()'),saved);assert.match(live.registry.levelInputMessage.textContent,/旧|計算/);});
  open(live,index);check(`${id} old-model storage is preserved`,()=>assert.equal(live.storage.get(oldKey),bytes));
 }
 console.log(JSON.stringify({checks,failures},null,2));if(failures.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});

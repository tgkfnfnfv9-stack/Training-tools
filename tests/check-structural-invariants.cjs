'use strict';
// Independent structural audit. Expectations are rigid-body invariants and
// Euclidean geometry, not snapshots of the current solver's answers.
const assert=require('node:assert/strict');
const makeEnvironment=require('./leveling-dom-env.cjs');
const MachineAccuracy=require('../src/machine-accuracy.js');
const fs=require('node:fs');
let checks=0;const failures=[];
function check(name,fn){checks++;try{fn();}catch(error){failures.push(name+': '+error.message);}}
const near=(a,b,t=1e-8)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,`${a} != ${b} (tol ${t})`);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const unit=a=>a.map(v=>v/Math.hypot(...a));
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const vectorNear=(a,b,t=1e-10)=>a.forEach((v,i)=>near(v,b[i],t));
const open=(e,i)=>e.read(`openMachine(machines[${i}]);`);
const pairValues=e=>e.json('levelGeometry.pairs.map(p=>p.deviationMicroradians)');
const setHeights=(e,h)=>e.read(`supportHeights=${JSON.stringify(h)};updateLeveling();`);
const pure=makeEnvironment({pureLeveling:true});
for(let i=0;i<7;i++){
 open(pure,i);const id=pure.read('current.id'),n=pure.read('supports.length');
 const heights=Array.from({length:n},(_,j)=>[.021,-.017,.006,-.011,.013,-.009][j%6]);
 setHeights(pure,heights);const original=pairValues(pure);
 setHeights(pure,heights.map(h=>h+.01));
 check(id+' uniform support translation preserves all angles',()=>vectorNear(pairValues(pure),original,1e-7));
 setHeights(pure,heights);
 check(id+' reversed operation restores geometry',()=>vectorNear(pairValues(pure),original,1e-8));
 for(const [a,b] of [[.037,0],[0,-.023],[.037,-.023]]){
  pure.read(`supportHeights=supports.map(s=>{const q=levelCoordinates(s.x,s.z);return .04+${a}*q.x+${b}*q.z;});updateLeveling();`);
  check(id+' a single affine plane cannot create squareness '+a+'/'+b,()=>pairValues(pure).forEach(v=>near(v,0,1e-7)));
 }
 setHeights(pure,heights);const before=pairValues(pure);
 pure.registry.exaggerate.checked=false;pure.registry.exaggerate.onchange();
 pure.read('setTrainingMenuOpen(true);setTrainingMenuOpen(false);');
 check(id+' display exaggeration and menu preserve calculation',()=>vectorNear(pairValues(pure),before,1e-8));
}

// Profile squareness is independent of support errors. A common rigid tilt
// preserves those fixed pairwise angles even though every body is tilted.
const live=makeEnvironment();
for(let i=0;i<7;i++){
 open(live,i);const id=live.read('current.id');
 const profile=MachineAccuracy.generate('used',1234+i,live.json('machineLinearKeys()'),live.read('supports.length'));
 live.read(`initializeMachineAccuracy(${JSON.stringify(profile)});supportHeights=supports.map(s=>{const q=levelCoordinates(s.x,s.z);return .03+.017*q.x-.021*q.z;});updateLeveling();`);
 check(id+' common rigid tilt preserves intrinsic pair angles',()=>{
  for(const p of live.json('levelGeometry.pairs'))near(p.deviationMicroradians,profile.squareness[p.key].microns/.3,1e-7);
 });
}

// A joined portal has one position at each shared connection. Test this
// directly in displayed coordinates, also with intrinsic errors present.
for(const environment of [pure,live])for(const index of [3,4]){
 open(environment,index);
 const cases=index===3?[
  "s.group==='column-left'?.01:0",
  "s.group==='column-right'?.01:0",
  "s.id==='column-left-front'?.01:s.id==='column-left-back'?-.01:0",
  "s.id==='column-right-front'?.01:s.id==='column-right-back'?-.01:0",
  "s.group==='bed'?.01:0"
 ]:[".01*s.x*s.z","i===0?.01:0"];
 for(const pattern of cases)for(const X of [-100,0,100])for(const exaggerate of [false,true]){
  environment.registry.exaggerate.checked=exaggerate;
  environment.read(`positions={X:${X},Y:43,Z:-37,A:0,C:0};supportHeights=supports.map((s,i)=>${pattern});updateLeveling();`);
  const points=environment.json("[-1,1].map(k=>{const z=current.kind==='gantry'?positions.X*.7/100:current.columnZ;const p=[k*(current.columnX??current.w*.4),3.17,z];return {column:levelBodyVisualPoint(p,k<0?'leftColumn':'rightColumn'),beam:levelBodyVisualPoint(p,'tool')};})");
  check(`connected portal ${index} ${pattern} X${X} gain${exaggerate} intrinsic${environment===live}`,()=>points.forEach(p=>vectorNear(p.column,p.beam,1e-9)));
 }
}

// Independently recover a beam direction from the two rendered endpoints;
// its geometric Y direction must be the same direction used for precision.
open(pure,3);pure.registry.exaggerate.checked=false;
for(const pattern of ["s.group==='column-left'?.01:0","s.id==='column-left-front'?.01:s.id==='column-left-back'?-.01:0","s.group==='column-right'?.01:0"]){
 pure.read(`supportHeights=supports.map(s=>${pattern});updateLeveling();`);
 const endpoints=pure.json("[-1,1].map(k=>levelBodyVisualPoint([k*current.columnX,3.17,current.columnZ],k<0?'leftColumn':'rightColumn'))");
 const y=unit(sub(endpoints[1],endpoints[0]));
 check('Y guide follows joined beam '+pattern,()=>vectorNear(y,pure.json("levelGeometry.directions.find(a=>a.key==='Y').direction"),1e-9));
 const x=pure.json("levelGeometry.directions.find(a=>a.key==='X').direction");
 const expected=-Math.asin(Math.max(-1,Math.min(1,dot(x,y))))*1e6;
 check('XY is the actual joined beam / bed angle '+pattern,()=>near(pure.read("levelGeometry.pairs.find(p=>p.key==='XY').deviationMicroradians"),expected,1e-7));
}

// With a flat long bed, left-column fore/aft seat differences must change
// beam yaw. Reversing the same operation reverses that yaw; this is not an
// instruction that XY must become worse for every initial machine.
const yaw=[];
for(const sign of [-1,1]){
 pure.read(`supportHeights=supports.map(s=>s.id==='column-left-front'?${sign*.01}:s.id==='column-left-back'?${-sign*.01}:0);updateLeveling();`);
 yaw.push(pure.read("levelGeometry.pairs.find(p=>p.key==='XY').deviationMicroradians"));
}
check('column fore/aft adjustment creates first-order beam yaw',()=>assert.ok(Math.min(...yaw.map(Math.abs))>1));
check('reversing column fore/aft adjustment reverses beam yaw',()=>assert.ok(yaw[0]*yaw[1]<0));
const outcomes=[];
for(const sign of [-1,1]){
 const profile={squareness:{XY:{microns:sign*100},XZ:{microns:0},YZ:{microns:0}}};
 pure.read(`supportHeights=supports.map(()=>0);updateLeveling();`);
 const start=pure.read(`geometryModel(positions,levelSolution,${JSON.stringify(profile)}).pairs.find(p=>p.key==='XY').deviationMicroradians`);
 pure.read("supportHeights=supports.map(s=>s.id==='column-left-front'?.001:s.id==='column-left-back'?-.001:0);updateLeveling();");
 const finish=pure.read(`geometryModel(positions,levelSolution,${JSON.stringify(profile)}).pairs.find(p=>p.key==='XY').deviationMicroradians`);
 outcomes.push(Math.abs(finish)-Math.abs(start));
}
check('same support action can improve or worsen XY according to intrinsic sign',()=>assert.ok(outcomes[0]*outcomes[1]<0));

// The detailed vial measures the actual central bed, whose nine supports
// remain flat here. A column seating change must not be mistaken for a bed
// gradient by sampling the old whole-foundation interpolation sheet.
open(pure,3);
for(const side of ['left','right']){
 pure.read(`supportHeights=supports.map(s=>s.id==='column-${side}-front'?.01:s.id==='column-${side}-back'?-.01:0);updateLeveling();`);
 for(const position of [-1,0,1]){
  pure.registry.measurePos.change(String(position));
  check(`flat bed local vials ignore ${side} column seat change at ${position}`,()=>{
   near(Number.parseFloat(pure.registry.localLevel.textContent),0,1e-12);
   near(Number.parseFloat(pure.registry.localLevelFB.textContent),0,1e-12);
   near(Number.parseFloat(pure.registry.bubble.style.left),50,1e-10);
   near(Number.parseFloat(pure.registry.bubbleFB.style.left),50,1e-10);
  });
 }
}

// Analytic bilinear surface h=.02*x*z+.031*x+.017*z (mm). Its derivatives
// are known independently. A travelling X guide samples the moving carriage,
// not the fixed table. Recover the orthonormal tangent without engine helpers.
for(const index of [2,4])for(const X of [-100,0,100]){
 open(pure,index);
 pure.read(`positions={X:${X},Y:0,Z:0,A:0,C:0};supportHeights=supports.map(s=>{const q=levelCoordinates(s.x,s.z);return .02*q.x*q.z+.031*q.x+.017*q.z;});updateLeveling();`);
 const anchors=pure.json(`(current.kind==='travel'?[-1,1].map(k=>({x:-.5+positions.X/100,z:current.d*.22+k*.1})):levelGeometry.toolPoints).map(p=>levelCoordinates(p.x,p.z))`);
 const x=anchors.reduce((s,p)=>s+p.x/anchors.length,0),z=anchors.reduce((s,p)=>s+p.z/anchors.length,0);
 const a=(.02*z+.031)/1000,b=(.02*x+.017)/1000;
 const right=unit([1,a,0]),up=unit([-a,1,-b]);
 const back=[right[1]*up[2]-right[2]*up[1],right[2]*up[0]-right[0]*up[2],right[0]*up[1]-right[1]*up[0]];
 const expected=index===2?right:back;
 check(`travelling guide X is analytic local tangent ${index}/${X}`,()=>vectorNear(pure.json("levelGeometry.directions.find(a=>a.key==='X').direction"),expected,1e-10));
}

// Persistence checks use legal quantized heights; rejecting an old calculation
// contract must neither mutate the current state nor overwrite the old bytes.
(async()=>{
 // Exercise the actual up/down button handlers. A correct machineSolution
 // alone is insufficient if updateLeveling retains a different old solver.
 for(let i=0;i<7;i++){
  open(live,i);live.read('setTrainingMenuOpen(false);supportHeights=supports.map(()=>0);updateLeveling();');
  for(const selected of (i===3?[0,9,10,12]:[0])){
   const before=pairValues(live);live.read(`selected=${selected};`);
   live.registry.coarseAdjust.click();live.registry.raiseSupport.click();
   check(`UI raise uses actual step ${i}/${selected}`,()=>near(live.read(`supportHeights[${selected}]`),.01,1e-12));
   check(`UI and reference evaluator use same geometry ${i}/${selected}`,()=>{
    vectorNear(pairValues(live),live.json('geometryModel(positions,machineSolution(supportHeights)).pairs.map(p=>p.deviationMicroradians)'),1e-7);
    vectorNear(live.json('levelGeometry.columns.flatMap(c=>[c.front,c.right])'),live.json('geometryModel(positions,machineSolution(supportHeights)).columns.flatMap(c=>[c.front,c.right])'),1e-7);
   });
   live.registry.lowerSupport.click();
   check(`UI reverse restores angles ${i}/${selected}`,()=>vectorNear(pairValues(live),before,1e-7));
  }
 }
 for(let i=0;i<7;i++){
  open(live,i);const id=live.read('current.id');
  live.read('supportHeights=supports.map((s,i)=>[.021,-.017,.006][i%3]);positions={X:23,Y:-47,Z:51,A:19,C:-31};updateLeveling();');
  const record=live.json('levelRecord()'),pairs=pairValues(live);
  check(id+' current record is valid',()=>assert.equal(live.read('validLevelRecord(levelRecord())'),true));
  live.read(`applyLevelRecord(${JSON.stringify(record)});updateLeveling();`);
  check(id+' save and reload preserve state and geometry',()=>{assert.deepEqual(live.json('levelRecord()'),record);vectorNear(pairValues(live),pairs,1e-8);});
  const legacy={...record};delete legacy.calculationModel;delete legacy.calculationVersion;
  // Use the actual previous format, independent of the new version number.
  legacy.version=record.supportLayout?3:2;
  for(const key of Object.keys(legacy))if(/model|calculation/i.test(key)&&key!=='machineProfile')delete legacy[key];
  const bytes=JSON.stringify(legacy),oldKey=live.read("'training-level-v1:'+current.id+':'+machineMode+(current.layoutId?':'+current.layoutId:'')");
  live.storage.set(oldKey,bytes);
  await live.registry.importLevel.onchange({target:{value:'legacy',files:[{size:bytes.length,text:async()=>bytes}]}});
  check(id+' old calculation JSON is rejected without mutation',()=>{assert.deepEqual(live.json('levelRecord()'),record);assert.match(live.registry.levelInputMessage.textContent,/読込できません|計算|旧/);});
  open(live,i);
  check(id+' old storage bytes remain intact',()=>assert.equal(live.storage.get(oldKey),bytes));
 }
 const summary={checks,failures};
 if(process.env.STRUCTURAL_AUDIT_OUTPUT)fs.writeFileSync(process.env.STRUCTURAL_AUDIT_OUTPUT,JSON.stringify(summary,null,2));
 console.log(JSON.stringify(summary,null,2));if(failures.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});

'use strict';
// Second-review integration contracts. These checks deliberately do NOT claim
// an independent physical oracle: renderer/scan consistency can share a model
// error. Analytic contact tests below use explicit geometry instead.
const assert=require('node:assert/strict');
const env=require('./leveling-dom-env.cjs')();
const M=require('../src/reference-measurement.js');
let checks=0,scans=0,roundTrips=0,maxMovementResidual=0;
const near=(a,b,t=2e-9,label='')=>{checks++;assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t,`${label}: ${a} versus ${b}`);};
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
for(const kind of ['compact','horizontal','travel','double','gantry','five','lathe']){
 env.storage.clear();env.read(`openMachine(machines.find(m=>m.kind==='${kind}'));initializeMachineAccuracy(window.MachineAccuracy.generate('used',20261007,machineLinearKeys(),supports.length));$('exaggerate').checked=false;`);
 const dimensions=env.json('({width:levelConfig.width,depth:levelConfig.depth})');
 for(const sign of [-1,1])for(const scale of [1,.83]){
  const state={X:sign*29,Y:sign*-37,Z:sign*43,A:0,C:0};
  env.read(`levelConfig.width=${dimensions.width}*${scale};levelConfig.depth=${dimensions.depth}*${2-scale};levelConfig.columnX=17;levelConfig.columnZ=-21;supportHeights=supports.map((p,i)=>Math.round(${sign}*40*Math.sin(i*2.1))/1000);positions=${JSON.stringify(state)};updateLeveling();`);
  const record=env.json('levelRecord()'),pairs=kind==='lathe'?['XZ']:['XY','XZ','YZ'];
  assert.equal(env.read(`validLevelRecord(${JSON.stringify(record)})`),true,kind+' actual saved record valid');checks++;
  const baseline=pairs.map(pair=>env.json(`referenceScan({key:'${pair}'})`));
  for(const [index,pair] of pairs.entries()){
   env.read(`positions=${JSON.stringify(state)};updateLeveling();`);
   const m=baseline[index],label=`${kind}/${pair}/${sign}/${scale}`;
   assert.equal(m.valid,true,label+' '+m.reason);checks++;
   const before=env.json(`referenceScan({key:'${pair}'},positions,levelInitialSolution)`);
   near(m.startPosition,before.startPosition,1e-12,label+' initial comparison start');
   near(m.endPosition,before.endPosition,1e-12,label+' initial comparison end');
   const pose=m.setup.owner==='master'||kind==='lathe'?'work':'tool';
   const raw=kind==='compact'&&m.setup.scan==='Y'?{p:[0,1.16,-env.read('current.d')*.1],axes:['X','Y']}:kind==='horizontal'&&m.setup.scan==='Z'?{p:[0,1.27,-.85],axes:['Z']}:env.json(`(()=>{const f=createGeometry(current).faces.find(f=>f.pose==='${pose}'&&f.axes.includes('${m.setup.scan}'));return {p:f.v[0],axes:f.axes};})()`);
   const half=env.read(`(()=>{const a=axisConfig(current).find(a=>a.key==='${m.setup.scan}'),q=levelCoordinates(a.vector[0]*a.amp,a.vector[2]*a.amp);return Math.hypot(q.x,a.vector[1]*a.amp,q.z);})()`);
   const points=[m.startPosition,m.endPosition].map(s=>{
    // The displayed renderer uses live levelGeometry and positions. Advance
    // actual application state at each endpoint, as real slider input does.
    env.read(`positions={...${JSON.stringify(state)},${m.setup.scan}:${s/half*100}};updateLeveling();`);
    return env.json(`displayedModelPoint(${JSON.stringify(raw.p)},${JSON.stringify(raw.axes)},current,positions,'${pose}')`);
   });
   const actual=sub(points[1],points[0]),expected=m.setup.owner==='master'?m.end.point:sub(m.end.body,m.start.body);
   actual.forEach((v,i)=>near(v,expected[i],2e-9,label+' finite member movement'));
   maxMovementResidual=Math.max(maxMovementResidual,Math.hypot(...sub(actual,expected)));scans++;
  }
  env.read(`applyLevelRecord(${JSON.stringify(record)});updateLeveling();`);
  assert.deepEqual(pairs.map(pair=>env.json(`referenceScan({key:'${pair}'})`)),baseline,kind+' save/restore all finite scan data');checks++;roundTrips++;
 }
}
// Explicit fixed face x=0. Move the gauge normally by d and tangentially by
// 300 mm. At the right side extension is 10 mm+d, so indication is -d.
for(const side of [-1,1])for(const d of [-.000023,.000023]){
 const a={point:[0,0,0],normal:[1,0,0],body:[side*.01,0,0],probe:[-side,0,0]},b={...a,body:[side*.01+d,.3,0]};
 near(M.compare(a,b).microns,-side*d*1e6,1e-8,'explicit opposing contact');
 near(M.compare(b,a).microns,side*d*1e6,1e-8,'fixed fixture reversed, re-zero only');
}
console.log(JSON.stringify({checks,finiteScanContracts:scans,savedRoundTrips:roundTrips,maxMovementResidualMetres:maxMovementResidual,scope:'integration consistency plus explicit fixed-plane contact; not an elastic-machine proof'},null,2));

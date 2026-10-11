'use strict';
// Contract/regression checks. Raw-value correctness is audited by a different
// author's input-only oracle in audit-independent-fixture-horizontal-20261011.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
process.chdir(path.resolve(__dirname,'..'));
const e=require('./leveling-dom-env.cjs')({pureLeveling:true});let checks=0;
const check=(value,message)=>{checks++;assert.ok(value,message);};
e.read("openMachine(machines.find(m=>m.kind==='horizontal'));supportHeights.fill(0);levelSolution=machineSolution(supportHeights);machineProfile=null;");
const before=e.json('positions'),invalid=e.json('horizontalCaptureFixtures().rows');e.read('globalThis.initiallyInvalid=horizontalCaptureFixtures();');
check(invalid.every(q=>!q.valid),'central position must not manufacture an extended fixture');
check(JSON.stringify(before)===JSON.stringify(e.json('positions')),'measurement must not move axes silently');
e.read('positions=horizontalMeasurementStation().positions;');
check(e.json('horizontalEvaluateHeld(initiallyInvalid).rows').every(q=>!q.valid),'an invalid captured installation must not be silently replaced after moving axes');
const station=e.json('horizontalMeasurementStation()');
check(station.valid&&!station.needsMove,'explicit station lies in travel');
check(Math.abs(station.physical.Z+.4)<1e-12,'standard station is physically Z=-400 mm');
check(station.positions.Y===-100,'measurement starts at the real lower head position');
const rawRows=()=>e.json('horizontalCaptureFixtures().rows');
for(const mode of [null,'new','used']){
 e.read(`machineProfile=${mode?`window.MachineAccuracy.generate('${mode}',123456,['X','Y','Z'],8)`:'null'};supportHeights.fill(0);levelSolution=machineSolution(supportHeights);globalThis.fixedSetup=horizontalCaptureFixtures();`);
 const initial=rawRows(),serialized=e.read('JSON.stringify(fixedSetup)');check(initial.length===8&&initial.every(q=>q.valid),'all eight R/S/bar measurements valid at standard station');
 for(let i=0;i<8;i++)for(const increment of [-.01,-.001,.001,.01]){
  e.read(`supportHeights.fill(0);supportHeights[${i}]=${increment};levelSolution=machineSolution(supportHeights);`);
  const fresh=rawRows(),held=e.json('horizontalEvaluateHeld(fixedSetup).rows');
  check(fresh.every(q=>q.valid)&&held.every(q=>q.valid),`${mode}/${i}/${increment}: finite fixture remains in range`);
  check(e.read('JSON.stringify(fixedSetup)')===serialized,'support operation may not rewrite captured mounting or zero');
  check(held.every(q=>Number.isFinite(q.microns)&&Number.isFinite(q.zero)&&Number.isFinite(q.endpoint)),'held values expose the original zero and new endpoint');
 }
 e.read('supportHeights.fill(0);levelSolution=machineSolution(supportHeights);');
 const restored=e.json('horizontalEvaluateHeld(fixedSetup).rows');
 check(restored.every((q,i)=>Math.abs(q.microns-initial[i].microns)<1e-7),'returning supports restores the old-zero readings');
 e.read('supportHeights.fill(.01);levelSolution=machineSolution(supportHeights);');
 const translated=e.json('horizontalEvaluateHeld(fixedSetup).rows');
 check(translated.every((q,i)=>Math.abs(q.microns-initial[i].microns)<1e-7),'uniform translation must not force dial numbers to change');
}
e.read("supportHeights.fill(0);machineProfile=window.MachineAccuracy.generate('used',123456,['X','Y','Z'],8);levelSolution=machineSolution(supportHeights);globalThis.fixedSetup=horizontalCaptureFixtures();supportHeights[1]=.01;levelSolution=machineSolution(supportHeights);");
const initial=e.json('fixedSetup.rows'),fresh=rawRows(),held=e.json('horizontalEvaluateHeld(fixedSetup).rows'),xy=rows=>rows.find(q=>q.key==='square.XY');
check(Math.abs(xy(fresh).microns-xy(initial).microns)<1e-7,'the renewed XY can legitimately stay unchanged');
check(Math.abs(xy(held).microns-xy(initial).microns)>1,'the retained XY zero measures a distinct physical displacement');
for(const key of ['XY','XZ','YZ','bar'])for(const stage of ['R','S'])for(const fraction of [0,1]){
 const g=e.json(`horizontalFixtureSceneGeometry('${key}','${stage}',${fraction})`);
 check(g.valid&&g.boxes.length>8&&g.contacts.length>0,'finite geometry, real contact and housing are exposed to the picture');
 check(g.boxes.every(b=>b.size.every(v=>Number.isFinite(v)&&v>0)),'picture uses finite positive dimensions');
}
const bar=e.json('horizontalParallelism()');
check(Math.abs(bar.bar.axialMax-bar.bar.axialMin-.4)<1e-12,'bar is 400 mm');
check(Math.abs(bar.a.last.axial-.3)<1e-3,'Z feeds through 300 mm of the bar');
const tir=e.json('horizontalRunoutFixtureGeometry()');
check(tir.valid&&tir.root.distanceMm===50&&tir.tip.distanceMm===350,'TIR uses actual 50/350 mm fixture locations');
e.read('levelConfig.columnX=100;');
const unreachable=e.json('horizontalMeasurementStation()');
check(!unreachable.valid&&unreachable.positions.X< -100,'out-of-travel station is rejected rather than clipped');
e.read('levelConfig.columnX=0;levelConfig.width=.5;levelConfig.depth=.5;');
check(!e.json('horizontalMeasurementStation()').valid,'tiny dimensions reject the finite table fixture');
const report={scope:'Station/no-silent-move, immutable captured mounting/zero, uniform rigid translation, standard support operations, honest unchanged renewed XY, scene geometry, actual bar/TIR distances, and reach limits. Numerical oracle is a separate independently authored test.',checks,failures:0};
fs.mkdirSync('docs/qa-fixtures-20261011',{recursive:true});fs.writeFileSync('docs/qa-fixtures-20261011/horizontal-regression.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));

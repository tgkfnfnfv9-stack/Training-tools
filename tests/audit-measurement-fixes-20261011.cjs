'use strict';
// Regression checks for confirmed audit fixes. Physical expectations are
// independently reconstructed in audit-independent-{milling,horizontal-lathe}.
const assert=require('node:assert/strict'),fs=require('node:fs');
const e=require('./leveling-dom-env.cjs')({pureLeveling:true});
const Lathe=require('../src/lathe-inspection.js');
let checks=0;
const near=(actual,expected,label,tolerance=1e-8)=>{assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=tolerance,`${label}: ${actual} != ${expected}`);checks++;};
const ok=(condition,label)=>{assert.ok(condition,label);checks++;};

// A normal ray has a 10 mm extension. Moving the face away by 11 mm
// exceeds the 20 mm stroke, even though the infinite-plane root exists.
const pose={body:[.01,0,0],probe:[-1,0,0],point:[0,0,0],normal:[1,0,0]};
near(Lathe.planeContact(pose).extension,.01,'ordinary contact');
ok(!Lathe.planeContact({...pose,point:[-.011,0,0]}).valid,'out-of-stroke contact is invalid');
ok(!Lathe.planeContact({...pose,probe:[0,1,0]}).valid,'parallel contact is invalid');
ok(!Lathe.planeContact({...pose,point:[.011,0,0]}).valid,'negative extension is invalid');

e.read("openMachine(machines[0]);positions={X:0,Y:0,Z:0,A:0,C:0};machineProfile=window.MachineAccuracy.generate('new',123456,['X','Y','Z'],4);supportHeights=[.01,0,0,0];updateLeveling();");
const compact=e.json("({finite:referenceDisplayScan({key:'YZ'}),physical:referenceScan({key:'YZ'}),sweep:spindleSweepGeometry(),model:geometryModel(),profile:machineProfile,heights:supportHeights})");
near(compact.finite.microns,12.528086201176,'independent support-derived YZ audit example',1e-7);
near(compact.finite.microns,compact.physical.microns,'display uses the model posture');
ok(compact.finite.responseGain===1,'measurement-only response gain removed');
const z=compact.model.directions.find(a=>a.key==='Z').direction;
compact.sweep.measurement.axis.forEach((v,i)=>near(v,z[i],'sweep and feed share physical spindle direction',1e-12));
const live=e.registry.liveSquareness.querySelectorAll('.live-pair-values').find(node=>node.dataset.pair==='YZ');
ok(live.querySelectorAll('.live-pair-error-value')[0].textContent==='+13','round the unamplified raw value to an integer');

// All milling improvement rows must compare the displayed finite quantity.
for(const kind of ['compact','horizontal','travel','double','gantry','five']){
 e.read(`openMachine(machines.find(m=>m.kind==='${kind}'));machineProfile=window.MachineAccuracy.generate('used',123456,['X','Y','Z'],supports.length);supportHeights=supports.map((s,i)=>i===0?.01:0);positions={X:0,Y:0,Z:0,A:0,C:0};updateLeveling();`);
 for(const row of e.registry.finePrecisionSummary.querySelectorAll('.fine-pair-reading')){
  const measured=e.json(`referenceDisplayScan({key:'${row.dataset.pair}'})`);
  ok(row.dataset.model==='finite-scan',kind+' improvement is a finite-scan comparison');
  if(measured.valid)near(Number(row.dataset.current),measured.microns,kind+' improvement value');
  else ok(row.dataset.current==='','invalid scan has no numeric improvement');
 }
}

e.read(fs.readFileSync('src/lathe-inspection.js','utf8'));
e.read(fs.readFileSync('src/lathe-inspection-ui.js','utf8'));
e.read("updateLatheInspectionUI=()=>{};openMachine(machines.find(m=>m.kind==='lathe'));machineProfile=null;supportHeights=supports.map(()=>0);positions={X:0,Y:0,Z:0,A:0,C:0};");
const inspect=(width,depth)=>{e.read(`levelConfig.width=${width};levelConfig.depth=${depth};updateLeveling();`);return e.json('latheInspectionGeometry()');};
let lathe=inspect(4,1.68);
ok(lathe.faceScan.valid&&lathe.flatScan.valid,'standard finite turret faces fit both scans');
near(lathe.face,0,'ideal face X');near(lathe.flat,0,'ideal face Z');
lathe=inspect(3.2,1.68);
ok(lathe.validZ&&!lathe.flatScan.valid&&lathe.flat===null,'Z travel exists but shortened turret face does not');
ok(lathe.flatScan.samples.some(sample=>sample.material&&sample.material[0]<-.09*3.2/4),'contact leaves the material face');
ok(lathe.side.valid&&lathe.top.valid,'face invalidity does not invalidate separate bar fixtures');
lathe=inspect(4,.8);
ok(lathe.validX&&!lathe.faceScan.valid&&lathe.face===null,'X travel exists but the front polygon is too small');
lathe=inspect(3.75,1.68);
ok(lathe.flatScan.valid,'Z scan ending exactly at the turret edge remains valid');
lathe=inspect(3.74,1.68);
ok(!lathe.flatScan.valid,'Z scan beyond the turret edge is invalid');
console.log(JSON.stringify({checks,scope:'regression integration and finite contact boundaries; independent physical derivations are separate audit scripts'},null,2));

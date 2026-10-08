'use strict';
// Diagnostic alternatives ONLY. This deliberately does not replace production
// referenceScan or assert that the co-located R/S point is a buildable master.
const fs=require('node:fs');
const env=require('./leveling-dom-env.cjs')({pureLeveling:true});
env.read("openMachine(machines.find(m=>m.kind==='horizontal'));$('exaggerate').checked=false;");
env.read(`
function diagnoseHorizontalReference(key,lift=0,finiteChord=false){
 const M=window.ReferenceMeasurement,setup=referenceSetup({key}),scanAxis=axisConfig(current).find(a=>a.key===setup.scan),baseAxis=axisConfig(current).find(a=>a.key===setup.base);
 const halfFor=a=>{const p=levelCoordinates(a.vector[0]*a.amp,a.vector[2]*a.amp);return Math.hypot(p.x,a.vector[1]*a.amp,p.z);};
 const half=halfFor(scanAxis),baseHalf=halfFor(baseAxis),start=Math.max(-half,Math.min(half-.3,positions[setup.scan]*half/100));
 const state0={...positions,[setup.scan]:start/half*100},g0=geometryModel(state0,levelSolution,machineProfile),tool=s=>horizontalSpindleFixture(s,levelSolution,machineProfile),pallet=s=>horizontalPalletPoint([0,1.27+lift,-.85],s,levelSolution,machineProfile);
 const asFrame=t=>({right:t.right,up:t.up,back:t.axis,rotate:v=>t.right.map((q,i)=>q*v[0]+t.up[i]*v[1]+t.axis[i]*v[2])});
 const t0=tool(state0),T0=asFrame(t0),p0=pallet(state0),bracket=M.sub(p0,t0.nose),material=s=>{const t=tool(s);return M.add(t.nose,M.transport(bracket,T0,asFrame(t)));};
 const baseStart=Math.max(-baseHalf,Math.min(baseHalf-.3,positions[setup.base]*baseHalf/100)),baseEnd=baseStart+.3,bs0={...state0,[setup.base]:baseStart/baseHalf*100},bs1={...state0,[setup.base]:baseEnd/baseHalf*100};
 const q0=material(bs0),q1=material(bs1),chord=M.unit(M.sub(q1,q0)),representative=g0.directions.find(a=>a.key===setup.base).direction,scanDirection=g0.directions.find(a=>a.key===setup.scan).direction;
 const n=finiteChord?chord:representative,probe=M.scale(n,-1),first={point:p0,normal:n,body:M.add(p0,M.scale(n,.01)),probe};
 const s1={...state0,[setup.scan]:(start+.3)/half*100},g1=geometryModel(s1,levelSolution,machineProfile),t1=tool(s1),T1=asFrame(t1),W0=referenceRigidFrame(g0.workFrame),W1=referenceRigidFrame(g1.workFrame);
 const last={point:pallet(s1),normal:M.transport(n,W0,W1),body:M.add(t1.nose,M.transport(M.sub(first.body,t0.nose),T0,T1)),probe:M.transport(probe,T0,T1)};
 const reading=M.compare(first,last),Rnormal=M.unit(M.sub(scanDirection,M.scale(representative,M.dot(scanDirection,representative)))),r0={point:q0,normal:Rnormal,body:M.add(q0,M.scale(Rnormal,.01)),probe:M.scale(Rnormal,-1)},tb0=tool(bs0),tb1=tool(bs1),rb=M.add(tb1.nose,M.transport(M.sub(r0.body,tb0.nose),asFrame(tb0),asFrame(tb1))),ru=M.transport(r0.probe,asFrame(tb0),asFrame(tb1));
 const oldR=M.compare(r0,{point:q0,normal:Rnormal,body:rb,probe:ru});
 return {key,lift,finiteChord,microns:reading.microns,valid:reading.valid,representative,chord,oldRDriftMicrons:oldR.microns,baseInterval:[baseStart,baseEnd],scanInterval:[start,start+.3],contactPoint:p0,headBracketAtS:M.sub(first.body,t0.nose)};
}
`);
const cases=[
 {name:'ideal',height:'0',profile:'null'},
 {name:'common_rigid_tilt',height:'.03*q.x+.04*q.z',profile:'null'},
 {name:'twist_001',height:'.01*q.x*q.z',profile:'null'},
 {name:'twist_005',height:'.05*q.x*q.z',profile:'null'},
 {name:'twist_minus_005',height:'-.05*q.x*q.z',profile:'null'},
 {name:'used_flat',height:'0',profile:"window.MachineAccuracy.generate('used',123456,['X','Y','Z'],8)"},
 {name:'used_B_plus_001',height:'i===1?.01:0',profile:"window.MachineAccuracy.generate('used',123456,['X','Y','Z'],8)"},
 {name:'used_twist_005_Xminus',height:'.05*q.x*q.z',profile:"window.MachineAccuracy.generate('used',123456,['X','Y','Z'],8)",X:-100},
 {name:'used_twist_005_Xplus',height:'.05*q.x*q.z',profile:"window.MachineAccuracy.generate('used',123456,['X','Y','Z'],8)",X:100},
 {name:'used_twist_005_Yminus',height:'.05*q.x*q.z',profile:"window.MachineAccuracy.generate('used',123456,['X','Y','Z'],8)",Y:-100},
 {name:'used_twist_005_Yplus',height:'.05*q.x*q.z',profile:"window.MachineAccuracy.generate('used',123456,['X','Y','Z'],8)",Y:100}
];
const rows=cases.map(c=>{
 env.read(`machineProfile=${c.profile};positions={X:${c.X??0},Y:${c.Y??0},Z:0,A:0,C:0};supportHeights=supports.map((p,i)=>{const q=levelCoordinates(p.x,p.z);return ${c.height}});updateLeveling();`);
 return {name:c.name,original:env.json("['XY','XZ','YZ'].map(key=>referenceScan({key}).microns)"),parallel:env.json('(()=>{const p=horizontalParallelism();return [p.a.microns,p.b.microns]})()'),alternatives:env.json("['XY','XZ','YZ'].map(key=>({key,oldPoint:diagnoseHorizontalReference(key,0,false),raisedPoint:diagnoseHorizontalReference(key,.05,false),finiteChordOldPoint:diagnoseHorizontalReference(key,0,true),finiteChordRaisedPoint:diagnoseHorizontalReference(key,.05,true)}))")};
});
const result={scope:'Diagnostic only: old virtual co-located R/S point and 50 mm higher sensitivity. Not a validated finite-thickness L-master configuration.',rows};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(rows.map(r=>({name:r.name,original:r.original,parallel:r.parallel,raised:r.alternatives.map(a=>a.raisedPoint.microns),finiteChordOld:r.alternatives.map(a=>a.finiteChordOldPoint.microns),finiteChordRaised:r.alternatives.map(a=>a.finiteChordRaisedPoint.microns),oldRDrift:r.alternatives.map(a=>a.oldPoint.oldRDriftMicrons)})),null,2));

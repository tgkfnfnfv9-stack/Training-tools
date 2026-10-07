'use strict';
// Independent physical oracle. Expectations come from a material point H above
// a support surface h=x*g(z), not production direction tables or the renderer.
const assert=require('node:assert/strict');
const create=require('./leveling-dom-env.cjs');
const M=require('../src/reference-measurement.js');
const baseline=require('./fixtures/reference-v2-mechanical-states.json');
const palletBaseline=require('./fixtures/reference-v2-pallet-visuals.json');
let checks=0;
const near=(actual,expected,tolerance=1e-7,label='number')=>{
 checks++;assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=tolerance,`${label}: ${actual} != ${expected}`);
};
const vec=(actual,expected,tolerance=1e-10,label='vector')=>actual.forEach((n,i)=>near(n,expected[i],tolerance,`${label}[${i}]`));
const e=create({pureLeveling:true});
const state={X:0,Y:0,Z:0,A:0,C:0};
e.read("openMachine(machines.find(m=>m.kind==='horizontal'));$('exaggerate').checked=false;");
// At x=0 the surface is at height zero and its cross-slope is g(z).
// theta=atan(g); a rigid point H above it is (-H sin(theta),H cos(theta),z).
// X alignment is sampled on the two column rails; Y is the column up vector.
function expectedMaterial(g,z,H){const t=Math.atan(g(z));return [-H*Math.sin(t),.66+H*Math.cos(t),z];}
function expectedReading(g,pair,startPosition,endPosition,H=.61){
 const z0=-.85+startPosition,z1=-.85+endPosition;
 const t0=Math.atan(g(z0)),t1=Math.atan(g(z1)),delta=t1-t0;
 const align=pair==='XZ'?Math.atan((g(4.6*(.28-.13))+g(4.6*(.28+.13)))/2):Math.PI/2+Math.atan(g(4.6*.29));
 const p0=expectedMaterial(g,z0,H),p1=expectedMaterial(g,z1,H);
 const n=[Math.cos(align+delta),Math.sin(align+delta),0];
 // The body is fixed at .01*n_start; its probe points -n_start.
 return n.reduce((s,v,i)=>s+v*(p1[i]-p0[i]),0)/Math.cos(delta)*1e6;
}
const cases=[];
for(const k of [-.00008,0,.00008])cases.push({name:`bilinear ${k}`,g:z=>k*z,expression:`1000*q.x*${k}*q.z`});
const nodes=[-1.84,-1.84/3,1.84/3,1.84],values=[.00015,-.0002,.00025,-.0001];
function piecewise(z){let j=0;while(j<nodes.length-2&&z>=nodes[j+1])j++;return values[j]+(values[j+1]-values[j])*(z-nodes[j])/(nodes[j+1]-nodes[j]);}
cases.push({name:'support-cell gradient changes',g:piecewise,expression:`1000*q.x*${piecewise.toString().replaceAll('nodes',JSON.stringify(nodes)).replaceAll('values',JSON.stringify(values))}(q.z)`});
for(const fixture of cases){
 e.read(`supportHeights=supports.map(p=>{const q=levelCoordinates(p.x,p.z);return ${fixture.expression};});positions=${JSON.stringify(state)};updateLeveling();`);
 for(const Z of [-100,0,100])for(const pair of ['XZ','YZ']){
  const lo=Math.max(-.45,Math.min(.15,Z*.45/100)),hi=lo+.3;
  const actual=e.json(`referenceScan({key:'${pair}'},{...positions,Z:${Z}})`);
  assert.equal(actual.valid,true,fixture.name+pair+actual.reason);
  near(actual.startPosition,lo,1e-12,'start position');near(actual.endPosition,hi,1e-12,'end position');
  near(actual.microns,expectedReading(fixture.g,pair,lo,hi),2e-7,`${fixture.name} ${pair} slider ${Z}`);
  const p0=expectedMaterial(fixture.g,-.85+lo,.61),p1=expectedMaterial(fixture.g,-.85+hi,.61);
  vec(actual.end.point,p1.map((v,i)=>v-p0[i]),1e-11,`${fixture.name} fixture origin travel`);
 }
 // Height is a physical lever arm, not a fitted multiplier on the reading.
 for(const H of [0,.61,1.22])for(const Z of [-100,0,100]){
  const actual=e.json(`horizontalPalletPoint([0,${.66+H},-.85],{...positions,Z:${Z}},levelSolution,null,1)`);
  vec(actual,expectedMaterial(fixture.g,-.85+.45*Z/100,H),1e-11,`${fixture.name} H=${H} Z=${Z}`);
 }
}

// The actual crossed support-cell boundary must be sampled on both sides.
const boundaryT=(-1.84/3+.85)/.3;
const boundarySamples=e.json("referenceScan({key:'XZ'},{...positions,Z:0}).samples");
assert.ok(boundarySamples.some(s=>Math.abs(s.t-boundaryT)<1e-12));
assert.ok(boundarySamples.some(s=>s.t<boundaryT&&boundaryT-s.t<1e-6));
assert.ok(boundarySamples.some(s=>s.t>boundaryT&&s.t-boundaryT<1e-6));

// Diagnostic sampling fixture only, not a claim that current support controls
// can generate this trajectory. Keep both endpoint extensions at 10 mm while
// an analytic moving-master path makes the midpoint extension 35 mm.
// P_x(t)=-25 mm*sin(pi*t), so lambda(t)=10 mm+25 mm*sin(pi*t).
e.storage.clear();e.read("openMachine(machines.find(m=>m.kind==='compact'));supportHeights=supports.map(()=>0);positions={X:0,Y:0,Z:0,A:0,C:0};updateLeveling();globalThis.fixtureOriginalCompactPoint=compactTablePathPoint;");
try{
 e.read('compactTablePathPoint=function(s){const z=.4*s.Y/100,t=(.3-z)/.3;return [-.025*Math.sin(Math.PI*t),0,z];};');
 const scan=e.json("referenceScan({key:'XY'})");
 assert.equal(M.compare(scan.start,scan.end).valid,true,'diagnostic endpoints remain in contact');
 assert.equal(scan.samples[0].valid,true,'diagnostic start valid');
 assert.equal(scan.samples.at(-1).valid,true,'diagnostic end valid');
 assert.equal(scan.samples.find(s=>s.t===.5).valid,false,'diagnostic midpoint exceeds extension range');
 assert.equal(scan.valid,false,'interior invalidity suppresses the scan despite valid endpoints');
 assert.equal(scan.reason,'測定子の範囲外');
}finally{
 e.read('compactTablePathPoint=fixtureOriginalCompactPoint;delete globalThis.fixtureOriginalCompactPoint;');
}
assert.equal(e.json("referenceScan({key:'XY'})").valid,true,'restore the actual compact path after diagnostic fixture');

// Hand-check the audit counterexample independently of the old drawing output.
const auditK=.0002/(1.36*1.84),auditExpected=expectedReading(z=>auditK*z,'XZ',0,.3);
near(auditExpected,-14.625958965,2e-6,'audit analytic reading');

// Same fixed fixture, reversed and re-zeroed, including changed probe attitude.
const zero={point:[0,0,0],normal:[1,0,0],body:[.01,0,0],probe:[-1,0,0]};
const theta=.04,end={...zero,body:[.01,.3,0],probe:[-Math.cos(theta),Math.sin(theta),0]};
near(M.compare(zero,end).microns,10000*(1-1/Math.cos(theta)),1e-7,'attitude-only reading');
near(M.compare(end,zero).microns,-M.compare(zero,end).microns,1e-9,'same-fixture reverse');
const rotate=v=>[-v[1],v[2],-v[0]],shift=[.7,-.4,.2];
const transform=q=>({...q,point:rotate(q.point).map((v,i)=>v+shift[i]),body:rotate(q.body).map((v,i)=>v+shift[i]),normal:rotate(q.normal),probe:rotate(q.probe)});
near(M.compare(transform(zero),transform(end)).microns,M.compare(zero,end).microns,1e-7,'shared rigid transform');

// Pure signed angular errors with rigid supports. Geometric convention:
// angle(a,b)=pi/2+delta; n dot b=-sin(delta), hence I=r*L*sin(delta).
// r comes from the physical traversal definition: XY towards +comparison,
// XZ/YZ towards -comparison. This is not a rendered/readout sign table.
for(const kind of ['compact','horizontal','travel','double','gantry','five','lathe']){
 e.storage.clear();e.read(`openMachine(machines.find(m=>m.kind==='${kind}'));supportHeights=supports.map(()=>0);updateLeveling();`);
 const pairs=kind==='lathe'?['XZ']:['XY','XZ','YZ'];
 for(const pair of pairs)for(const q of [-10,0,10]){
  const profile={squareness:Object.fromEntries(pairs.map(key=>[key,{microns:key===pair?q:0}]))};
  const m=e.json(`referenceScan({key:'${pair}'},positions,levelSolution,${JSON.stringify(profile)})`);
  assert.equal(m.valid,true,kind+pair+m.reason);
  near(m.microns,(pair==='XY'?1:-1)*300000*Math.sin(q/300000),1e-5,`${kind} ${pair} pure q=${q}`);
 }
}

// Diagram direction comes from actual body/probe geometry, never the reported
// microns. A tilted probe at the same normal body distance changes extension
// while the body x position must stay fixed. Positive along tilt puts its
// contact ahead of the body, hence the body is lower on this developed view.
e.read("openMachine(machines.find(m=>m.kind==='travel'));supportHeights=supports.map(()=>0);updateLeveling();");
function diagramOf(endPose,reportedMicrons){
 const contact=M.contact(endPose);
 const m={valid:true,microns:reportedMicrons,start:zero,end:endPose,last:contact,alongEnd:[0,1,0]};
 return e.json(`(()=>{const m=${JSON.stringify(m)};m.setup=referenceSetup({key:'XY'});const div=document.createElement('div');div.innerHTML=referenceDiagram(m);const body=div.querySelectorAll('.scan-body')[0],hit=div.querySelectorAll('.scan-contact')[0],geometry=div.querySelectorAll('.scan-geometry')[0];return {x:Number(body.getAttribute('x')),y:Number(body.getAttribute('y'))+3,contactY:Number(hit.getAttribute('cy')),normal:Number(geometry.dataset.bodyNormalM),probeNormal:Number(geometry.dataset.probeNormal),probeAlong:Number(geometry.dataset.probeAlong)};})()`);
}
const probeAngle=.0001,tiltedPose={...zero,body:[.01,.3,0],probe:[-Math.cos(probeAngle),Math.sin(probeAngle),0]};
const tiltedDrawing=diagramOf(tiltedPose,-.00005),sameDrawing=diagramOf(tiltedPose,9999);
assert.deepEqual(tiltedDrawing,sameDrawing,'diagram must not derive body movement from the readout');
near(tiltedDrawing.x,34,1e-12,'pure probe tilt leaves body normal screen position');
near(tiltedDrawing.normal,.01,1e-12,'body normal geometry');
near(tiltedDrawing.probeNormal,-Math.cos(probeAngle),1e-12,'probe normal geometry');
near(tiltedDrawing.probeAlong,Math.sin(probeAngle),1e-12,'probe along geometry');
assert.ok(tiltedDrawing.y>tiltedDrawing.contactY,'positive probe along contact is above its body');
const approachingDrawing=diagramOf({...zero,body:[.00999,.3,0]},10);
assert.ok(approachingDrawing.x<34,'body approaching S draws closer to S');
// New measurement SVGs must not carry legacy angle-diagram coordinate/sign
// metadata that disagrees with their physical zero and probe convention.
for(const svg of e.registry.liveSquareness.querySelectorAll('svg')){
 for(const attr of ['data-zero-location','data-positive-direction','data-negative-direction','data-projection','data-tip-x','data-tip-y'])assert.equal(svg.getAttribute(attr),null,attr+' is obsolete on measurement SVG');
 assert.equal(svg.dataset.measurementModel,'reference-scan-v3');
}

// These are genuine deterministic records captured from committed v2 source,
// not records generated by the new implementation. Preserve local geometry and
// evaluation exactly; old finite readings are only a regression comparison.
const physicalChecks=checks;
const restore=create();
for(const old of baseline.states){
 restore.storage.clear();restore.read(`openMachine(machines.find(m=>m.kind==='${old.kind}'));`);
 assert.equal(restore.read(`validLevelRecord(${JSON.stringify(old.record)})`),true,old.kind+' accepts old saved record');
 restore.read(`applyLevelRecord(${JSON.stringify(old.record)});updateLeveling();`);
 assert.deepEqual(restore.json('levelRecord()'),old.record,old.kind+' saved coordinate meaning');
 assert.deepEqual(restore.json('levelGeometry.pairs'),old.local,old.kind+' local angle geometry unchanged');
 assert.deepEqual(restore.json('levelGeometry.directions.map(a=>({key:a.key,direction:a.direction}))'),old.directions,old.kind+' directions unchanged');
 assert.deepEqual(restore.json('machineEvaluation(supportHeights).values'),old.evaluation,old.kind+' support evaluation unchanged');
 for(const pair of old.finite){
  const m=restore.json(`referenceScan({key:'${pair.key}'})`);
  if(old.kind!=='horizontal'||pair.key==='XY'){
   assert.equal(m.valid,pair.measurement.valid,old.kind+pair.key+' validity');
   if(m.valid)near(m.microns,pair.measurement.microns,1e-7,old.kind+pair.key+' preserved finite reading');
  }
 }
}
// Extracting the material-point map must preserve the existing model movement.
// This is explicitly a regression test, not the analytic physical oracle above.
restore.storage.clear();restore.read("openMachine(machines.find(m=>m.kind==='horizontal'));initializeMachineAccuracy(window.MachineAccuracy.generate('used',20261008,machineLinearKeys(),supports.length));");
for(const old of palletBaseline.states){
 restore.read(`levelConfig.width=${old.size[0]};levelConfig.depth=${old.size[1]};supportHeights=supports.map((p,i)=>${old.uniform}?.1:[.02,-.03,.04,-.01,.05,-.04,.01,-.02][i]);positions={X:19,Y:-21,Z:${old.Z},A:0,C:0};$('exaggerate').checked=${old.factor};updateLeveling();`);
 palletBaseline.raw.forEach((p,i)=>vec(restore.json(`displayedModelPoint(${JSON.stringify(p)},['Z'],current,positions,'work')`),old.points[i],1e-10,`pallet model regression ${old.size}/${old.uniform}/${old.factor}/${old.Z}`));
}
console.log(`Reference fixtures: ${physicalChecks} independent geometry comparisons, ${checks-physicalChecks} v2 regression comparisons, plus fixture validity and 7 saved-state compatibility groups passed.`);

'use strict';
// Audit only. Expectations below are analytic plane equations, NOT drawing
// functions or production sign tables. Run from the repository root.
const assert = require('node:assert/strict');
const M = require('../../src/reference-measurement.js');
const create = require('../../tests/leveling-dom-env.cjs');
const results = [];
function check(name, actual, expected, tolerance = 1e-7) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < tolerance,
    `${name}: ${actual} != ${expected}`);
  results.push({name, actual, expected, tolerance});
}
// World x is normal to S; world y is along S. Indicator is on x>0,
// extension points -x. Therefore lambda=x_body-x_surface, independently
// of any machine-axis naming. Increasing compression is decreasing lambda.
const p = (x, y=0) => ({point:[0,0,0],normal:[1,0,0],body:[x,y,0],probe:[-1,0,0]});
const start = p(.01), toward = p(.00999,.3), away = p(.01001,.3);
check('ideal', M.compare(start,p(.01,.3)).microns,0);
check('body approaches fixed S by 10 um', M.compare(start,toward).microns,10);
check('body recedes from fixed S by 10 um', M.compare(start,away).microns,-10);
// Rotation of path away from S by theta: x=.01+L*sin(theta).
for (const theta of [-1/30000,1/30000]) {
  check(`signed path angle ${theta}`,M.compare(start,p(.01+.3*Math.sin(theta),.3*Math.cos(theta))).microns,-300000*Math.sin(theta));
}
// Put the indicator on the opposite side. Same +10 um world-x translation
// now approaches S, so +X cannot itself mean dial-plus.
const opposite = {...p(-.01),probe:[1,0,0]};
check('opposite side; same +x displacement',M.compare(opposite,{...opposite,body:[-.00999,.3,0]}).microns,10);
check('same fixed setup reversed and re-zeroed',M.compare(toward,start).microns,-10);
// Changing probe attitude matters even with the same body-to-plane distance:
// lambda=h/cos(theta). Endpoint reversal remains exactly antisymmetric.
const theta=.04,tilted={...p(.01,.3),probe:[-Math.cos(theta),Math.sin(theta),0]};
check('probe attitude changes with no normal translation',M.compare(start,tilted).microns,10000*(1-1/Math.cos(theta)));
check('reverse with attitude changes, fixture held',M.compare(tilted,start).microns,-M.compare(start,tilted).microns);
// Shared rigid rotation and translation preserve intersections and extension.
const rotate=v=>[-v[1],v[2],-v[0]],shift=[.123,-.456,.789];
const transform=q=>({...q,point:rotate(q.point).map((v,i)=>v+shift[i]),body:rotate(q.body).map((v,i)=>v+shift[i]),normal:rotate(q.normal),probe:rotate(q.probe)});
check('shared rigid transform',M.compare(transform(start),transform(toward)).microns,10);
// S: x=beta*y, B: x=h+alpha*y. Then I=(beta-alpha)*L.
const alpha=2e-5,beta=5e-5,L=.3;
const sloped={...start,normal:[1,-beta,0]};
check('machine path error alone',M.compare(start,p(.01+alpha*L,L)).microns,-alpha*L*1e6);
check('alignment error alone',M.compare(sloped,{...sloped,body:[.01,L,0]}).microns,beta*L*1e6);
check('both errors; one reading cannot identify both',M.compare(sloped,{...sloped,body:[.01+alpha*L,L,0]}).microns,(beta-alpha)*L*1e6);
// Curvature x=h+k*y^2: finite I=-k*L^2; local tangent at start is 0,
// and local tangent at end converted over L is -2*k*L^2.
const k=1e-4;
check('curved path finite reading',M.compare(start,p(.01+k*L*L,L)).microns,-k*L*L*1e6);
check('curved path fixed-fixture reverse',M.compare(p(.01+k*L*L,L),start).microns,k*L*L*1e6);
// Integration of a discontinuous tangent uses a known analytic integral.
check('support-cell boundary integration',M.integrate(t=>[t<.37?1e-4:-2e-4,1,0],L,[.37]).value[0],L*(.37*1e-4-.63*2e-4),1e-12);
assert.equal(M.contact({...start,probe:[0,1,0]}).valid,false);
assert.equal(M.contact(p(.021)).valid,false);
// Fixture-level safety limitation: endpoint validity does not imply that an
// entire path maintained contact. This is an abstract counterexample, not a
// claim that this curve is reachable with the current machine controls.
assert.equal(M.compare(start,p(.01,L)).valid,true);
assert.equal(M.contact(p(.01+.025*Math.sin(Math.PI/2),L/2)).valid,false);

// Application invariants use a zero-error machine, whose expected readings
// are all zero without any signs inferred from production drawing metadata.
const e=create({pureLeveling:true});
const kinds=['compact','horizontal','travel','double','gantry','five','lathe'];
for(const kind of kinds){
  e.storage.clear();
  e.read(`openMachine(machines.find(m=>m.kind==='${kind}')); supportHeights=supports.map(()=>0); updateLeveling();`);
  const pairs=kind==='lathe'?['XZ']:['XY','XZ','YZ'];
  for(const key of pairs)for(const position of [-100,0,100]){
    const m=e.json(`referenceScan({key:'${key}'},{X:${position},Y:${position},Z:${position},A:0,C:0})`);
    assert.equal(m.valid,true,kind+key+m.reason);
    check(`${kind} ${key} ideal at slider ${position}`,m.microns,0);
  }
  e.read('supportHeights=supports.map((s,i)=>[.031,-.022,.013,-.004][i%4]); updateLeveling();');
  const baseline=e.json(`levelGeometry.pairs.map(p=>referenceScan(p).microns)`);
  e.read("$('exaggerate').checked=!$('exaggerate').checked; sceneZoom=2.3; yaw+=1.1; updateLeveling();");
  const display=e.json(`levelGeometry.pairs.map(p=>referenceScan(p).microns)`);
  baseline.forEach((n,i)=>check(`${kind} exaggeration/zoom/camera invariant ${i}`,display[i],n));
  e.read('supportHeights[0]+=.001;updateLeveling();supportHeights[0]-=.001;updateLeveling();');
  const restored=e.json(`levelGeometry.pairs.map(p=>referenceScan(p).microns)`);
  baseline.forEach((n,i)=>check(`${kind} support round trip ${i}`,restored[i],n));
  e.read('globalThis.auditRecord=JSON.parse(JSON.stringify(levelRecord()));supportHeights=supports.map(()=>0);updateLeveling();applyLevelRecord(auditRecord);updateLeveling();');
  const loaded=e.json(`levelGeometry.pairs.map(p=>referenceScan(p).microns)`);
  baseline.forEach((n,i)=>check(`${kind} save/load round trip ${i}`,loaded[i],n));
}
e.read("openMachine(machines.find(m=>m.kind==='five'));");
for(const [A,C] of [[1,0],[0,1],[-100,100]])for(const key of ['XY','XZ','YZ']){
  const m=e.json(`referenceScan({key:'${key}'},{...positions,A:${A},C:${C}})`);
  assert.equal(m.valid,false);assert.equal(m.reason,'A/Cを0にして測定');
}
console.log(JSON.stringify({numericChecks:results.length,status:'PASS',results,
  limitations:['No physical fixture fit/collision verification','Endpoint contact does not prove continuous-path contact','Browser pixels and NC command semantics are outside this independent geometry script','Current adapter assumes zero direction-alignment error; cannot estimate it independently']},null,2));

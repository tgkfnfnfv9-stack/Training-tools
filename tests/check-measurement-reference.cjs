'use strict';
// Independent plane/point examples; expected numbers are hand-calculated.
const assert=require('node:assert/strict'),M=require('../src/reference-measurement.js'),create=require('./leveling-dom-env.cjs');
let checks=0;const near=(a,b,t=1e-6)=>{checks++;assert.ok(Number.isFinite(a)&&Math.abs(a-b)<t,`${a} != ${b}`);};
const zero={point:[0,0,0],normal:[1,0,0],body:[.01,0,0],probe:[-1,0,0]},end=x=>({...zero,body:[x,.3,0]});
near(M.compare(zero,end(.01)).microns,0);
near(M.compare(zero,end(.00999)).microns,10);
near(M.compare(zero,end(.01001)).microns,-10);
near(M.compare(end(.00999),zero).microns,-10);
const opposite={...zero,body:[-.01,0,0],probe:[1,0,0]};
near(M.compare(opposite,{...opposite,body:[-.01001,.3,0]}).microns,-10);
near(M.compare(zero,{...zero,point:[-.00001,.3,0]}).microns,-10);
const turn=v=>[-v[1],v[2],-v[0]],translation=[4,-2,7],pose=p=>({point:turn(p.point).map((v,i)=>v+translation[i]),body:turn(p.body).map((v,i)=>v+translation[i]),normal:turn(p.normal),probe:turn(p.probe)});
near(M.compare(pose(zero),pose(end(.00999))).microns,10);
// Camera has no input in geometry; arbitrary view metadata must be irrelevant.
near(M.compare({...zero,camera:99},{...end(.00999),camera:-5}).microns,10);
const misplaced={...zero,normal:[1,-1/30000,0]};
near(M.compare(misplaced,{...misplaced,body:[.01,.3,0]}).microns,10);
near(M.compare(misplaced,{...misplaced,body:[.01001,.3,0]}).microns,0);
near(M.compare(zero,end(.01001)).microns,-10); // after direction alignment
// x(y)=-0.0001*y^2: finite result9; tangent conversion at start0/end18.
near(M.compare(zero,end(.01-.0001*.3**2)).microns,9);
near(M.integrate(t=>[-.0002*.3*t,1,0],.3).value[0],-.000009,1e-12);
assert.equal(M.contact({...zero,probe:[0,1,0]}).valid,false);
assert.equal(M.contact({...zero,body:[.03,0,0]}).valid,false);
// All 19 actual UI adapters under rigid zero-support conditions. Fixture owners
// are stated independently as moving table or moving indicator, not renderer data.
const e=create({pureLeveling:true}),owners={compact:{XY:'table',XZ:'head',YZ:'head'},horizontal:{XY:'head',XZ:'table',YZ:'table'},travel:{XY:'head',XZ:'head',YZ:'head'},double:{XY:'head',XZ:'head',YZ:'head'},gantry:{XY:'head',XZ:'head',YZ:'head'},five:{XY:'table',XZ:'head',YZ:'head'},lathe:{XZ:'head'}};
const memberTravel={compact:{XY:-1,XZ:-1,YZ:-1},horizontal:{XY:1,XZ:1,YZ:1},travel:{XY:1,XZ:-1,YZ:-1},double:{XY:1,XZ:-1,YZ:-1},gantry:{XY:1,XZ:-1,YZ:-1},five:{XY:-1,XZ:-1,YZ:-1},lathe:{XZ:-1}};
let pairs=0;
for(const [kind,entries] of Object.entries(owners)){
 e.storage.clear();e.read(`openMachine(machines.find(m=>m.kind==='${kind}'));supportHeights=supports.map(()=>0);updateLeveling();`);
 for(const [key,owner] of Object.entries(entries)){
  pairs++;
  for(const angle of [-10/300000,0,10/300000]){
   const profile={squareness:Object.fromEntries(Object.keys(entries).map(k=>[k,{microns:k===key?angle*300000:0}]))};
   const scan=e.json(`referenceScan({key:'${key}'},positions,levelSolution,${JSON.stringify(profile)})`);
   assert.equal(scan.valid,true,kind+key+scan.reason);
   assert.equal(Math.sign(scan.endPosition-scan.startPosition),memberTravel[kind][key]);
   const crossing=-.3*Math.sin(angle)*memberTravel[kind][key]; // normal component of positive member motion
   const gapChange=owner==='head'?crossing:-crossing;
   near(scan.microns,-gapChange*1e6,1e-5);
  }
 }
}
assert.equal(pairs,19);
console.log(`Reference plane geometry: ${checks} numeric assertions; 19 setups x ideal/positive/negative; independent invariants passed.`);
// A grid-gradient jump is integrated on its two open cells, with known area.
near(M.integrate(t=>[t<.37?1e-4:-2e-4,1,0],.3,[.37]).value[0],.3*(.37*1e-4-.63*2e-4),1e-12);
// The horizontal master now follows the pallet top material point, H=.61 m
// above its support datum. For h=k*x*z at x=0, its x/y coordinates are
// [-H*sin(atan(k*z)), H*cos(atan(k*z))]; this is an analytic rigid lever arm.
const k=.00008,H=.61,z0=-.85,z1=-.55,t0=Math.atan(k*z0),t1=Math.atan(k*z1),delta=t1-t0;
e.read(`openMachine(machines[1]);supportHeights=supports.map(s=>{const q=levelCoordinates(s.x,s.z);return 1000*${k}*q.x*q.z;});positions={X:0,Y:0,Z:0,A:0,C:0};updateLeveling();`);
for(const key of ['XZ','YZ']){
 const scan=e.json(`referenceScan({key:'${key}'})`);assert.equal(scan.valid,true,scan.reason);
 const align=key==='XZ'?Math.atan(k*4.6*.28):Math.PI/2+Math.atan(k*4.6*.29);
 const dx=-H*(Math.sin(t1)-Math.sin(t0)),dy=H*(Math.cos(t1)-Math.cos(t0));
 const expected=(Math.cos(align+delta)*dx+Math.sin(align+delta)*dy)/Math.cos(delta)*1e6;
 near(scan.microns,expected,2e-7);
}
console.log('Support-grid crossing: piecewise integral and analytic pallet material-point oracle passed.');

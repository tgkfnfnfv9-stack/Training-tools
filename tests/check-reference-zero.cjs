'use strict';
const assert=require('node:assert/strict'),create=require('./leveling-dom-env.cjs');
const e=create({pureLeveling:true}),r=e.registry;let checks=0;
// Expected physical locations are specified independently of the setup helper.
const expected={
 compact:{XY:['手前・右側','奥',-1],XZ:['上・右側','下',-1],YZ:['上・奥側','下',-1]},
 travel:{XY:['手前・右側','奥',1],XZ:['上・右側','下',-1],YZ:['上・奥側','下',-1]},
 five:{XY:['手前・右側','奥',-1],XZ:['上・右側','下',-1],YZ:['上・奥側','下',-1]},
 horizontal:{XY:['下・右側','上',1],XZ:['奥・右側','手前',1],YZ:['奥・上側','手前',1]},
 double:{XY:['左・奥側','右',1],XZ:['上・奥側','下',-1],YZ:['上・右側','下',-1]},
 gantry:{XY:['左・奥側','右',1],XZ:['上・奥側','下',-1],YZ:['上・右側','下',-1]},
 lathe:{XZ:['奥・右側','手前',-1]}
};
for(const [kind,pairs] of Object.entries(expected)){
 e.storage.clear();e.read(`openMachine(machines.find(m=>m.kind==='${kind}'));supportHeights=supports.map(()=>0);updateLeveling();`);
 for(const [pair,[zero,direction,memberSign]] of Object.entries(pairs)){
  const svg=r.liveSquareness.querySelectorAll('svg').find(s=>s.dataset.pair===pair),start=svg.querySelectorAll('.scan-zero')[0],finish=svg.querySelectorAll('.scan-contact')[0];
  assert.equal(svg.dataset.zeroLocationMeasurement,zero);assert.equal(svg.dataset.relativeDirection,direction);
  assert.equal(Number(start.getAttribute('cy')),pair==='XY'?31:14);assert(Math.abs(Number(finish.getAttribute('cy'))-(pair==='XY'?14:31))<1e-9);
  assert.match(svg.getAttribute('aria-label'),new RegExp(zero));checks++;
  for(const position of [-100,0,100]){
   const m=e.json(`referenceScan({key:'${pair}'},{X:${position},Y:${position},Z:${position},A:0,C:0})`);assert(m.valid);
   const axis=kind==='lathe'?'X':pair[1],half=e.read(`(()=>{const a=axisConfig(current).find(a=>a.key==='${axis}'),p=levelCoordinates(a.vector[0]*a.amp,a.vector[2]*a.amp);return Math.hypot(p.x,a.vector[1]*a.amp,p.z)})()`);
   const oldLow=Math.max(-half,Math.min(half-.3,position*half/100));
   assert(Math.abs(Math.min(m.startPosition,m.endPosition)-oldLow)<1e-12);
   assert(Math.abs(Math.abs(m.endPosition-m.startPosition)-.3)<1e-12);
   assert.equal(Math.sign(m.endPosition-m.startPosition),memberSign);assert(Math.abs(m.microns)<1e-7);checks++;
  }
 }
}
console.log(`Reference zero locations: ${checks} checks, all19 physical directions, SVG zero ends and both travel limits passed.`);

'use strict';
// Independent endpoint/continuity constraints. Expected values come from
// geometric connectivity, not from the model's computed accuracy numbers.
const assert=require('node:assert/strict');
const environment=require('./leveling-dom-env.cjs');
const env=environment({pureLeveling:true});
let checks=0,maxJoin=0,maxFoot=0,maxBoundaryStep=0;
const patterns={
 uniform:'.1',
 left:'s.x<0?.2:0',
 right:'s.x>0?.2:0',
 opposed:'s.x<0?(s.z>0?.2:-.2):0',
 bed:'s.group==="bed"?(s.z>0?.15:0):0'
};
for(const index of [3,4])for(const [name,pattern] of Object.entries(patterns))for(const exaggerated of [false,true]){
 env.storage.clear();
 env.read(`openMachine(machines[${index}]);positions={X:37,Y:23,Z:-12,A:0,C:0};supportHeights=supports.map((s,i)=>${pattern});updateLeveling();`);
 env.registry.exaggerate.checked=exaggerated;env.registry.exaggerate.onchange();
 // The centreline of each column meets the same beam centreline at y=3.17.
 // Its foot must meet the actual seating surface at y=.66. These nominal
 // dimensions are part of the existing drawing, independent of deformation.
 const errors=env.json(`levelGeometry.toolPoints.map((a,i)=>{
  const p=[a.x,3.17,a.z],foot=[a.x,.66,a.z],pose=i?'rightColumn':'leftColumn';
  const distance=(x,y)=>Math.hypot(...x.map((v,k)=>v-y[k]));
  return {top:distance(levelBodyVisualPoint(p,pose),levelBodyVisualPoint(p,'tool')),foot:distance(levelBodyVisualPoint(foot,pose),levelBodyVisualPoint(foot,'bed'))};
 })`);
 for(const value of errors){
  assert.ok(value.top<1e-10,`${index}/${name}/${exaggerated}: beam/column separation`);
  assert.ok(value.foot<1e-10,`${index}/${name}/${exaggerated}: column/seat separation`);
  maxJoin=Math.max(maxJoin,value.top);maxFoot=Math.max(maxFoot,value.foot);checks+=2;
 }
 if(index!==3)continue;
 // A continuous surface approaches the same point from either side.
 // Include the removed sharp split at .89 as well as the blend endpoints.
 for(const boundary of [-1.06,-.89,-.77,.77,.89,1.06]){
  const points=env.json(`[${boundary}-1e-8,${boundary}+1e-8].map(x=>levelBodyVisualPoint([x,.66,current.columnZ],'bed'))`);
  const delta=Math.hypot(...points[0].map((v,i)=>v-points[1][i]));
  assert.ok(delta<1e-6,`${name}/${exaggerated}: discontinuity at x=${boundary}`);
  maxBoundaryStep=Math.max(maxBoundaryStep,delta);checks++;
 }
 // Blending must never displace an actual support away from its own height.
 const seats=env.json(`supports.map((s,i)=>{const p=levelCoordinates(s.x,s.z);return {actual:structuralSurface(p.x,p.z).heightAt(p.x,p.z),expected:supportHeights[i]};})`);
 for(const seat of seats){assert.ok(Math.abs(seat.actual-seat.expected)<1e-10,'support interpolation lost');checks++;}
}
console.log(`Structural connections: ${checks} checks passed. ${JSON.stringify({maxJoin,maxFoot,maxBoundaryStep})}`);

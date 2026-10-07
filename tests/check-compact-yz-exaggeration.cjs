'use strict';
// Cross-layer regression: compare actual rendered column vertices and actual
// rendered P material-point displacement, not the arrow/diagram sign table.
// This checks illustration consistency, not real-machine elasticity.
const assert=require('node:assert/strict');
const env=require('./leveling-dom-env.cjs')({pureLeveling:true});
env.read(`openMachine(machines[0]);positions={X:0,Y:0,Z:0,A:0,C:0};`);
const rows=[];
function sample(exaggerate){
 env.read(`$('exaggerate').checked=${exaggerate};updateLeveling();`);
 return env.json(`(()=>{
  const ref=createGeometry(current).references.find(r=>r.pose==='tool');
  const a=displayedModelPoint(ref.base,ref.axes,current,positions,ref.pose),b=displayedModelPoint(ref.tip,ref.axes,current,positions,ref.pose),u=b.map((v,i)=>v-a[i]);
  const e=.001,s0={...positions,Y:-e},s1={...positions,Y:e};
  const p0=compactTablePathPoint(s0,levelSolution,machineProfile,displayFactor()),p1=compactTablePathPoint(s1,levelSolution,machineProfile,displayFactor()),v=p1.map((q,i)=>q-p0[i]);
  return {factor:displayFactor(),microns:referenceScan({key:'YZ'}).microns,dot:u.reduce((s,q,i)=>s+q*v[i],0)/Math.hypot(...u)/Math.hypot(...v)};
 })()`);
}
for(const intrinsicYZ of [-15,0,15]){
 const group=[];
 for(const a of [-.5,-.1,0,.1,.5]){
  env.read(`machineProfile={guides:{},initialHeights:supports.map(()=>0),squareness:{XY:{microns:33},XZ:{microns:75},YZ:{microns:${intrinsicYZ}}}};supportHeights=[${a},0,0,0];`);
  const physical=sample(false),visual=sample(true),label=`YZ intrinsic ${intrinsicYZ}, A ${a}`;
  // In this fixed YZ configuration, descending .3 m on the back contact
  // yields compression .3*(unitY dot unitZ), independently of diagram code.
  assert.ok(Math.abs(physical.microns-300000*physical.dot)<.00002,`${label}: physical mesh/contact mismatch`);
  assert.equal(visual.microns,physical.microns,`${label}: exaggeration changed measurement`);
  if(Math.abs(physical.dot)>1e-8)assert.equal(Math.sign(visual.dot),Math.sign(physical.dot),`${label}: exaggeration reversed YZ angle`);
  group.push({a,physical,visual});rows.push({intrinsicYZ,a,physical,visual});
 }
 for(let i=1;i<group.length;i++){
  const p=group[i].physical.dot-group[i-1].physical.dot,v=group[i].visual.dot-group[i-1].visual.dot;
  if(Math.abs(p)>1e-8)assert.equal(Math.sign(v),Math.sign(p),`YZ intrinsic ${intrinsicYZ}: exaggeration reversed A adjustment effect`);
 }
}
console.log(JSON.stringify({cases:rows.length,measurementsInvariant:true,meshSignsAndAdjustmentDirectionsMatch:true}));

'use strict';
// The compact column has no X/Y ownership. Changing table position may change
// the local Y path angle, but must not animate the fixed column itself.
const assert=require('node:assert/strict');
const env=require('./leveling-dom-env.cjs')({pureLeveling:true});
env.read(`openMachine(machines[0]);machineProfile={guides:{},initialHeights:supports.map(()=>0),squareness:{XY:{microns:33},XZ:{microns:75},YZ:{microns:-15}}};supportHeights=[.5,0,0,0];`);
let cases=0;
for(const exaggerate of [false,true]){
 let baseline;
 for(const X of [-100,0,100])for(const Y of [-100,0,100]){
  env.read(`$('exaggerate').checked=${exaggerate};positions={X:${X},Y:${Y},Z:0,A:0,C:0};updateLeveling();`);
  const points=env.json(`(()=>{const r=createGeometry(current).references.find(q=>q.pose==='tool');return [r.base,r.tip].map(p=>displayedModelPoint(p,r.axes,current,positions,r.pose));})()`);
  if(!baseline)baseline=points;
  for(let i=0;i<points.length;i++)assert.ok(Math.hypot(...points[i].map((v,j)=>v-baseline[i][j]))<1e-10,`fixed column moved when table moved; exaggerate=${exaggerate}, X=${X}, Y=${Y}`);
  cases++;
 }
}
console.log(JSON.stringify({cases,fixedColumnInvariant:true}));

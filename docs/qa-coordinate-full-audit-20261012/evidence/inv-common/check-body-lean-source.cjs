'use strict';
// Which intrinsic squareness terms feed "コラムの倒れ（本体）" / lathe spindle direction, flat supports.
process.chdir('/home/user/Training-tools');
const env=require('/home/user/Training-tools/tests/leveling-dom-env.cjs');
const out={};
for(const mi of [0,1,2,3,4,5]){
 const e=env({});e.read(`openMachine(machines[${mi}]);`);const id=e.read('current.id');
 const keys=e.json('Object.keys(machineProfile.squareness)');out[id]={};
 for(const k of keys){
  e.read(`for(const q of Object.keys(machineProfile.squareness))machineProfile.squareness[q].microns=(q==='${k}'?30:0);supportHeights=supports.map(()=>0);accuracyKey='';updateLeveling(false);`);
  out[id][k+'=+30µm/300']=e.json('({intrinsic:levelGeometry.bodyIntrinsicPosture,front:document.getElementById("fineLeanFront").textContent,right:document.getElementById("fineLeanRight").textContent,sweep:supportsSpindleSweep()?spindleSweepGeometry(positions,levelSolution,machineProfile,1,false).cardinal.map(p=>Math.round(p.readingMicrons*1000)/1000):null})');
 }
 console.log(id,JSON.stringify(out[id],(k,v)=>typeof v==='number'?Math.round(v*100)/100:v));
}
require('fs').writeFileSync(__dirname+'/body-lean-source.json',JSON.stringify(out,null,1));

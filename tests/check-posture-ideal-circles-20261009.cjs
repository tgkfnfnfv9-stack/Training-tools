'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const env=require('./leveling-dom-env.cjs')({pureLeveling:true});
for(const file of ['lathe-inspection.js','lathe-inspection-ui.js'])env.read(fs.readFileSync('src/'+file,'utf8'));
env.read('updateLatheInspectionUI=()=>{};');
const result={cases:0,vertices:0,maxOutlineErrorM:0};
for(const id of ['horizontal','lathe'])for(const [sx,sz]of[[1,1],[.5,2],[2,.5]])for(const state of [{X:0,Y:0,Z:0},{X:73,Y:-62,Z:-37}]){
 env.read(`openMachine(machines.find(m=>m.id==='${id}'));machineProfile=null;supportHeights=supports.map(()=>0);positions=${JSON.stringify({...state,A:0,C:0})};levelConfig.width=current.w*.8*${sx};levelConfig.depth=current.d*.8*${sz};$('exaggerate').checked=false;updateLeveling(false);`);
 const vertices=env.json(`(()=>{const C=idealDisplayContext(current);return createGeometry(current).faces.filter(f=>f.circular||f.pose==='latheTestBar').flatMap(f=>f.v.map(p=>({draw:displayedModelPoint(p,f.axes,current,positions,f.pose,f.circular),ideal:idealDisplayPoint(p,f.axes,f.pose,C,f.circular)})));})()`);
 for(const p of vertices){const error=Math.hypot(...p.draw.map((q,i)=>q-p.ideal[i]));result.maxOutlineErrorM=Math.max(result.maxOutlineErrorM,error);assert.ok(error<1e-12,id+' ideal contour and material geometry differ');result.vertices++;}
 result.cases++;
}
fs.writeFileSync('docs/qa-posture-20261009/structure/ideal-circles.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));

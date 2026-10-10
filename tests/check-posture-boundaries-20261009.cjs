'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const env=require('./leveling-dom-env.cjs')({pureLeveling:true});
const rows=[];
for(const id of ['horizontal','lathe']){
 env.read(`openMachine(machines.find(m=>m.id==='${id}'));supportHeights=supports.map((p,i)=>i===0?-.01:0);updateLeveling(false);`);
 const row=env.json(`(()=>{const p=levelCoordinates(supports[current.kind==='horizontal'?2:1].x,supports[current.kind==='horizontal'?2:1].z),x=current.kind==='lathe'?p.x:.1,z=current.kind==='horizontal'?p.z:.1,samples=[-1e-8,-Number.EPSILON,0,Number.EPSILON,1e-8].map(d=>({d,s:levelSolution.slopeAt(x+(current.kind==='lathe'?d:0),z+(current.kind==='horizontal'?d:0))}));return {machine:current.id,x,z,samples};})()`);
 assert.deepEqual(row.samples[1].s,row.samples[2].s);assert.deepEqual(row.samples[3].s,row.samples[2].s);assert.notDeepEqual(row.samples[0].s,row.samples[2].s);assert.deepEqual(row.samples[4].s,row.samples[2].s);rows.push(row);
}
for(const id of ['vertical','travel','gate','gantry','five']){
 env.read(`openMachine(machines.find(m=>m.id==='${id}'));supportHeights=supports.map((p,i)=>i===0?-.01:0);updateLeveling(false);`);
 // Wrapping is restricted to the two targets. For compact bending and the
 // irregular portal there are established extra maps; inspect their function
 // source to ensure they have not received the new snap wrapper either.
 assert.equal(env.read('String(levelSolution.slopeAt).includes("snap(")'),false);
}
fs.writeFileSync('docs/qa-posture-20261009/structure/boundaries.json',JSON.stringify(rows,null,2));console.log(JSON.stringify({targets:rows.length,otherFiveUnaffected:true},null,2));

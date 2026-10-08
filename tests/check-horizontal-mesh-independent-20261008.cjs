'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const env=require('./leveling-dom-env.cjs')({pureLeveling:true});
const baseline=fs.readFileSync(process.argv[2]||'/tmp/horizontal-baseline-app-b56dbbd.js','utf8');
const start=baseline.indexOf('function createGeometry(m){'),end=baseline.indexOf('\nfunction idealFaceNormal',start);
assert.ok(start>0&&end>start);env.read(baseline.slice(start,end).replace('function createGeometry(m)','function baselineGeometry(m)'));
let assertions=0;
for(const id of env.json('machines.map(m=>m.id)')){
 env.read(`openMachine(machines.find(m=>m.id==='${id}'));`);
 if(env.read('current.kind')!=='horizontal'){
  assert.deepEqual(env.json('createGeometry(current)'),env.json('baselineGeometry(current)'),`${id} raw geometry unchanged`);assertions++;
 }
}
env.read("openMachine(machines.find(m=>m.kind==='horizontal'));machineProfile={guides:{},initialHeights:supports.map(()=>0),squareness:{XY:{microns:33},XZ:{microns:-75},YZ:{microns:45}}};");
const mesh=env.json("createGeometry(current).faces.filter(f=>f.axes.join(',')==='X')");
const verts=color=>mesh.filter(f=>f.color===color).flatMap(f=>f.v);
const rail=verts('#c8d6d9'),column=verts('#799198');
const bound=(list,i,f)=>Math[f](...list.map(v=>v[i]));
assert.ok(Math.abs(bound(rail,2,'min')-.768)<1e-12,'head-side guide face retained');assertions++;
assert.ok(bound(rail,2,'max')>bound(column,2,'min'),'rail extends into column');assertions++;
assert.ok(bound(rail,2,'min')<.8,'guide meets head back');assertions++;
for(const h of ['0','.08*q.x+.06*q.z','.04*q.x*q.z','-.04*q.x*q.z'])for(const X of [-100,0,100])for(const Y of [-100,0,100])for(const Z of [-100,100])for(const emphasized of [false,true]){
 env.read(`positions={X:${X},Y:${Y},Z:${Z},A:0,C:0};supportHeights=supports.map(p=>{const q=levelCoordinates(p.x,p.z);return ${h}});$('exaggerate').checked=${emphasized};updateLeveling();`);
 // Same point in the guide and head overlap, expressed in each rigid member.
 const got=env.json(`(()=>{const p=displayedModelPoint([0,2.55,.784],['X','Y'],current,positions,'tool'),q=displayedModelPoint([0,${2.55+.3*Y/100},.784],['X'],current,positions,'tool');return Math.hypot(...p.map((v,i)=>v-q[i]));})()`);
 assert.ok(got<1e-10,`head/guide map continuous h=${h} X${X}Y${Y}Z${Z}, emphasized=${emphasized}: ${got}`);assertions++;
}

// Independently recover up and spindle directions from actual transformed
// pairs of material points. Expected normal is built directly from h slopes.
for(const h of ['.08*q.x+.06*q.z','-.08*q.x-.06*q.z','.04*q.x*q.z','-.04*q.x*q.z'])for(const X of [-100,0,100])for(const Z of [-100,-50,0,100])for(const emphasized of [false,true]){
 env.read(`machineProfile=null;positions={X:${X},Y:0,Z:${Z},A:0,C:0};supportHeights=supports.map(p=>{const q=levelCoordinates(p.x,p.z);return ${h}});$('exaggerate').checked=${emphasized};updateLeveling();`);
 const F=env.read('displayFactor()');
 for(const pose of ['tool','work']){
  const slope=env.json(pose==='tool'?`levelSolution.slopeAt(${.55*X/100},${4.6*.29})`:`levelSolution.slopeAt(0,${-.85+.45*Z/100})`);
  const n=[-slope.lr*F/1000,1,-slope.fb*F/1000],norm=Math.hypot(...n),expected=n.map(v=>v/norm);
  const vectors=env.json(pose==='tool'?`(()=>{const o=displayedModelPoint([0,2.55,-.93],['X','Y'],current,positions,'tool');return [[0,2.65,-.93],[0,2.55,-.83]].map(p=>displayedModelPoint(p,['X','Y'],current,positions,'tool').map((v,i)=>v-o[i]));})()`:`(()=>{const o=displayedModelPoint([0,1.27,-.85],['Z'],current,positions,'work');return [[0,1.37,-.85],[0,1.27,-.75]].map(p=>displayedModelPoint(p,['Z'],current,positions,'work').map((v,i)=>v-o[i]));})()`);
  const up=vectors[0].map(v=>v/Math.hypot(...vectors[0]));
  assert.ok(Math.hypot(...up.map((v,i)=>v-expected[i]))<1e-10,`${pose} support normal sign X${X}Z${Z} F${F}`);assertions++;
  const back=vectors[1].map(v=>v/Math.hypot(...vectors[1]));
  assert.ok(Math.abs(back.reduce((v,q,i)=>v+q*expected[i],0))<1e-10,`${pose} spindle/pallet longitudinal remains perpendicular to up`);assertions++;
 }
}
console.log(JSON.stringify({passed:true,assertions,scope:'Actual mesh overlap; all axis extremes; ±twist; flat/tilted; display exaggeration normal signs; other6 raw meshes exact baseline equality'}));

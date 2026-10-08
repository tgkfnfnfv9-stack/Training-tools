'use strict';
// Structural invariants use separating planes of real mesh volumes, not a rendering sign table.
const assert=require('node:assert/strict'),fs=require('node:fs');
const env=require('./leveling-dom-env.cjs')({pureLeveling:true});
const baseline=fs.readFileSync(process.argv[2]||'/tmp/structure-baseline-app-edda.js','utf8');
const start=baseline.indexOf('function createGeometry(m){'),end=baseline.indexOf('\nfunction idealFaceNormal',start);
env.read(baseline.slice(start,end).replace('function createGeometry(m)','function baselineGeometry(m)'));
for(const id of env.json('machines.filter(m=>m.kind!=="horizontal").map(m=>m.id)')){env.read(`openMachine(machines.find(m=>m.id==='${id}'));`);assert.deepEqual(env.json('createGeometry(current)'),env.json('baselineGeometry(current)'),id+' geometry unchanged');}

env.read("openMachine(machines[1]);");
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>a.map(v=>v/Math.hypot(...a));
function info(faces){const verts=faces.flat(),ns=[],es=[];for(const f of faces){const a=sub(f[1],f[0]),b=sub(f[2],f[0]);if(Math.hypot(...cross(a,b))>1e-12)ns.push(unit(cross(a,b)));for(let j=0;j<f.length;j++)es.push(unit(sub(f[(j+1)%f.length],f[j])));}return {verts,ns,es};}
function overlap(aa,bb){const a=info(aa),b=info(bb),axes=[...a.ns,...b.ns];for(const e of a.es)for(const f of b.es){const c=cross(e,f);if(Math.hypot(...c)>1e-9)axes.push(unit(c));}let min=Infinity;for(const ax of axes){const av=a.verts.map(v=>dot(v,ax)),bv=b.verts.map(v=>dot(v,ax)),ol=Math.min(Math.max(...av),Math.max(...bv))-Math.max(Math.min(...av),Math.min(...bv));if(ol<0)return ol;min=Math.min(min,ol);}return min;}
const failed=[],cases=[];
for(const intrinsic of [false,true])for(const h of ['0','.05*p.x*p.z','-.05*p.x*p.z','.08*p.x+.06*p.z','-.08*p.x-.06*p.z'])for(const X of [-100,0,100])for(const Y of [-100,0,100])for(const Z of [-100,0,100])for(const ex of [false,true]){
 env.read(`machineProfile=${intrinsic?"window.MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length)":'null'};positions={X:${X},Y:${Y},Z:${Z},A:0,C:0};supportHeights=supports.map(p=>${h});$('exaggerate').checked=${ex};updateLeveling(false);`);
 const polys=env.json(`(()=>{const m=createGeometry(current);const world=f=>f.v.map(p=>displayedModelPoint(p,f.axes,current,positions,f.pose));const spindle=m.faces.filter(f=>f.axes.join(',')==='X,Y'&&f.color==='#dfab62');return {work:m.faces.filter(f=>f.color==='#d1ddd7').map(world),head:m.faces.filter(f=>f.axes.join(',')==='X,Y'&&f.color==='#799198').map(world),spindle:spindle.slice(0,22).map(world),tool:spindle.slice(22).map(world),factor:displayFactor()};})()`);
 for(const key of ['head','spindle','tool']){const ol=overlap(polys.work,polys[key]);if(ol>1e-9)failed.push({intrinsic,h,X,Y,Z,ex,key,ol,factor:polys.factor});}
 cases.push({intrinsic,h,X,Y,Z,ex});
}
assert.deepEqual(failed,[],'example workpiece must not intersect head/spindle/tool');
const result={cases:cases.length,convexPairs:cases.length*3,intersections:failed,otherSixMeshesUnchanged:true};


env.read('machineProfile=null;');
let gaps=[],min=Infinity,max=-Infinity,railCases=0;
for(const h of ['0','.05*p.x*p.z','-.05*p.x*p.z','.08*p.x+.06*p.z','-.08*p.x-.06*p.z'])for(const Z of [-100,0,100])for(const ex of [false,true]){env.read(`supportHeights=supports.map(p=>${h});positions={X:0,Y:0,Z:${Z},A:0,C:0};$('exaggerate').checked=${ex};updateLeveling(false);`);const samples=env.json(`(()=>{const out=[];for(const x of [-.56,.56])for(const dz of [-.6,0,.6]){const p=displayedModelPoint([x,.685,-.85+dz],['Z'],current,positions,'work'),q=displayedModelPoint([x,.72,-.85+dz+.45*positions.Z/100],[],current,positions,'bed'),u=displayedModelPoint([x,1.685,-.85+dz],['Z'],current,positions,'work').map((v,i)=>v-p[i]);out.push({x,dz,overlap:q.reduce((s,v,i)=>s+(v-p[i])*u[i],0),factor:displayFactor()});}return out;})()`);for(const s of samples){min=Math.min(min,s.overlap);max=Math.max(max,s.overlap);railCases++;if(s.overlap<0)gaps.push({h,Z,ex,...s});}}
assert.deepEqual(gaps,[],'carriage must remain in contact with the Z guides');
result.railContacts={samples:railCases,minOverlapM:min,maxOverlapM:max,gaps};
console.log(JSON.stringify(result,null,2));

'use strict';
// Independent fixture audit: only scalar support heights/slopes are read from
// the application. Expected vectors, rigid frames, bracket transport and
// contact geometry below never call rendering, geometryModel, or sign tables.
const assert=require('node:assert/strict');
const env=require('./leveling-dom-env.cjs')({pureLeveling:true});
env.read("openMachine(machines.find(m=>m.kind==='horizontal'));$('exaggerate').checked=false;");
let count=0;
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,k)=>a.map(v=>v*k),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>mul(a,1/Math.hypot(...a));
const near=(a,b,name,t=2e-6)=>{assert.ok(Number.isFinite(a)&&Math.abs(a-b)<t,`${name}: ${a} != ${b}`);count++;};
function frame(x,z){const s=env.json(`levelSolution.slopeAt(${x},${z})`),up=unit([-s.lr/1000,1,-s.fb/1000]),right=unit([1,s.lr/1000,0]);return [right,up,cross(right,up)];}
const turn=(F,p)=>F.reduce((r,v,i)=>add(r,mul(v,p[i])),[0,0,0]);
const local=(F,p)=>F.map(v=>dot(v,p));
const at=(x,z)=>env.read(`levelSolution.heightAt(${x},${z})`)/1000;
function pallet(z){const F=frame(0,-.85+z),nonflat=env.read('levelSolution.residual>1e-10||Math.abs(levelSolution.twist)>1e-10');return nonflat?add([0,.66+at(0,-.85+z),-.85+z],mul(F[1],.61)):add(add([0,.66+at(0,-.85),-.85],mul(F[1],.61)),mul(F[2],z));}
function zeroCylinder(body,probe,origin,axis){
 const distance=e=>Math.hypot(...cross(sub(add(body,mul(probe,e)),origin),axis));
 let a=0,b=.02;assert.ok(distance(a)>.025&&distance(b)<.025,'near-side contact bracket');
 for(let n=0;n<70;n++){const m=(a+b)/2;if(distance(m)>.025)a=m;else b=m;}return (a+b)/2;
}
const cases=[{name:'ideal',h:'0'},{name:'rigid+',h:'.08*q.x+.06*q.z+.02'},{name:'rigid-',h:'-.08*q.x-.06*q.z-.02'},{name:'saddle+',h:'.04*q.x*q.z'},{name:'saddle-',h:'-.04*q.x*q.z'},...Array.from({length:8},(_,i)=>[-1,1].map(sign=>({name:`support${i}${sign}`,h:`i===${i}?${sign}*.04:0`}))).flat()];
for(const c of cases)for(const Z of [-100,-50,0,50,100]){
 env.read(`machineProfile=null;positions={X:0,Y:0,Z:${Z},A:0,C:0};supportHeights=supports.map((p,i)=>{const q=levelCoordinates(p.x,p.z);return ${c.h}});updateLeveling();`);
 const start=Math.max(-.45,Math.min(.15,Z*.45/100)),end=start+.3,F0=frame(0,-.85+start),F1=frame(0,-.85+end),p0=pallet(start),p1=pallet(end),T=frame(0,4.6*.29);
 const rails=[4.6*(.28-.13),4.6*(.28+.13)].map(z=>env.json(`levelSolution.slopeAt(0,${z})`)),gx=unit([1,(rails[0].lr+rails[1].lr)/2000,0]);
 const normals={XZ:gx,YZ:T[1]};
 for(const key of ['XZ','YZ']){
  const n0=normals[key],n1=turn(F1,local(F0,n0)),body=add(p0,mul(n0,.01));
  const extension=dot(n1,sub(body,p1))/dot(n1,n0),expected=(.01-extension)*1e6;
  const got=env.json(`referenceScan({key:'${key}'})`);assert.ok(got.valid,`${c.name} ${key} valid`);near(got.microns,expected,`${c.name} Z${Z} ${key}`);
 }
 const xy=-.3*dot(gx,T[1])*1e6;
 near(env.json("referenceScan({key:'XY'})").microns,xy,`${c.name} XY`);
 // Physical column on its local seat, spindle protruding toward -world Z.
 const nose=add([0,.66+at(0,4.6*.29),4.6*.29],turn(T,[0,2.55-.66,-.93-4.6*.29])),origin=sub(nose,mul(T[2],.31));
 const got=env.json('horizontalParallelism()');
 for(const [key,probe] of [['a',T[0]],['b',T[1]]]){
  const firstBody=sub(origin,mul(probe,.035)),lastBody=add(p1,turn(F1,local(F0,sub(firstBody,p0)))),lastProbe=turn(F1,local(F0,probe));
  const e0=zeroCylinder(firstBody,probe,origin,T[2]),e1=zeroCylinder(lastBody,lastProbe,origin,T[2]);
  assert.ok(got[key].valid,`${c.name} ${key} valid`);near(got[key].microns,(e0-e1)*1e6,`${c.name} Z${Z} parallel ${key}`);
 }
}
// Positive angle means >90 degrees. Construct isolated errors geometrically:
// Y tilts left for XY, Z tilts left for XZ and downward for YZ.
for(const key of ['XY','XZ','YZ'])for(const angle of [-.0002,.0002]){
 env.read(`machineProfile={guides:{},initialHeights:supports.map(()=>0),squareness:{XY:{microns:0},XZ:{microns:0},YZ:{microns:0}}};machineProfile.squareness['${key}'].microns=${angle*300000};supportHeights=supports.map(()=>0);positions={X:0,Y:0,Z:0,A:0,C:0};updateLeveling();`);
 const expected=(key==='XY'?1:-1)*.3*Math.sin(angle)*1e6;
 near(env.json(`referenceScan({key:'${key}'})`).microns,expected,`known signed ${key}`);
}
console.log(JSON.stringify({passed:true,assertions:count,cases:cases.length,scope:'Independent scalar-support→rigid-fixture→plane/cylinder contact; all 8 supports ±; ±twist; rigid plane; Z bounds; signed isolated angles'}));

'use strict';
// Independent reviewer tests. TIR expectations follow circle/contact geometry;
// surface expectations use Gram-Schmidt projection, not production coefficients.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const I=require('../src/intrinsic-inspection.js');
const A=require('../src/machine-accuracy.js');
let checks=0;
function near(actual,expected,tolerance=1e-9,label=''){assert.ok(Math.abs(actual-expected)<=tolerance,`${label}: ${actual} != ${expected}`);checks++;}
function equal(actual,expected,label){assert.deepEqual(actual,expected,label);checks++;}
function yes(value,label){assert.ok(value,label);checks++;}
const points=[];for(const y of [1,0,-1])for(const x of [-1,0,1])points.push([x,y]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
function independentSurface(h){
 const columns=[points.map(()=>1),points.map(p=>p[0]),points.map(p=>p[1])],basis=[];
 for(const column of columns){let v=column.slice();for(const q of basis){const c=dot(v,q);v=v.map((a,i)=>a-c*q[i]);}const length=Math.sqrt(dot(v,v));basis.push(v.map(a=>a/length));}
 let residual=h.slice();for(const q of basis){const coefficient=dot(h,q);residual=residual.map((v,i)=>v-coefficient*q[i]);}
 const zero=residual[3];return residual.map(v=>v-zero);
}
// For a circular cylinder whose rotating centre is (u,v), the incoming
// surface on a fixed radial indicator line is u*cosθ-v*sinθ + sqrt(R² -
// (u*sinθ+v*cosθ)²). Its extrema lie with the centre on the indicator line.
// Evaluate those actual surface intersections, including opposite contact side.
function circleTir(e,t,L,side){
 const u=e[0]+t[0]*(L/1000),v=e[1]+t[1]*(L/1000),R=25000;
 const phase=-Math.atan2(v,u),reading=theta=>{
  const along=u*Math.cos(theta)-v*Math.sin(theta),across=u*Math.sin(theta)+v*Math.cos(theta);
  return along+side*Math.sqrt(R*R-across*across);
 };
 return Math.abs(reading(phase)-reading(phase+Math.PI));
}
for(const [e,t,L,expected] of [
 [[0,0],[0,0],300,0],[[3,4],[0,0],0,10],[[0,0],[10,0],300,6],
 [[3,0],[-10,0],300,0],[[3,0],[-20,0],300,6],[[3,4],[0,10],300,2*Math.sqrt(58)]
])near(I.runoutAt(e,t,L),expected,1e-10,'known eccentricity and angular cancellation');
for(let n=0;n<101;n++){
 const e=[5*Math.sin(n),3*Math.cos(n*.71)],t=[30*Math.cos(n*.32),-15*Math.sin(n*.14)];
 for(const L of [0,300])for(const side of [-1,1])near(I.runoutAt(e,t,L),circleTir(e,t,L,side),1e-8,'circle incoming contact extrema');
 const r=I.runout(e,t);near(r.rootMicrons,circleTir(e,t,0,1),1e-8);near(r.tipMicrons,circleTir(e,t,300,1),1e-8);
 const angle=.37*n,rotate=v=>[Math.cos(angle)*v[0]-Math.sin(angle)*v[1],Math.sin(angle)*v[0]+Math.cos(angle)*v[1]];
 near(I.runoutAt(rotate(e),rotate(t),300),r.tipMicrons,1e-10,'common transverse rigid rotation');
}
for(const [name,h] of [
 ['zero',points.map(()=>0)],['plane',points.map(([x,y])=>7+9*x-3*y)],
 ['saddle',points.map(([x,y])=>6*x*y)],['symmetric bowl',points.map(([x,y])=>4*(x*x+y*y))]
]){
 const result=I.surface(h),expected=independentSurface(h);
 result.points.forEach((p,i)=>near(p.microns,expected[i],1e-10,name));
 if(['zero','plane'].includes(name))near(result.rangeMicrons,0,1e-10,name+' zero range');
 if(name==='saddle')near(result.rangeMicrons,12,1e-10,'saddle peak-valley');
 if(name==='symmetric bowl')near(result.rangeMicrons,8,1e-10,'bowl peak-valley');
}
for(let n=0;n<50;n++){
 const h=points.map((_,i)=>10*Math.sin((n+1)*(i+1)*.731)),base=I.surface(h);
 const tilted=I.surface(h.map((v,i)=>v+23*points[i][0]-17*points[i][1]+900));
 const expected=independentSurface(h);
 base.points.forEach((p,i)=>{
  near(p.microns,expected[i],1e-10,'independent least squares projection');
  near(tilted.points[i].microns,p.microns,5e-12,'rigid plane addition invariant');
 });
 near(base.points[3].microns,0,0,'left-middle reference exactly zero');
 near(base.rangeMicrons,Math.max(...expected)-Math.min(...expected),1e-10,'peak valley unaffected by gauge zero');
}
// Frozen version-3 profile hashes (2026-10-13: installed heights on the 0.01 mm grid).
// Seed stream, shape and save compatibility from this version on.
const fixtures=[
 ['new',0,['X','Y','Z'],4,'27fc147e0aff7526dbe98f9c6adf970c541d562e6b210cacd66f1fbf066ccc18'],
 ['new',4294967295,['X','Y','Z'],15,'6ba6a4188fa838321cdf3ba5b418b992c7e72aba8e28f350d5634f088f2bdc6b'],
 ['new',12345,['X','Z'],6,'6b35b9ebc476913c505615ac333707fac6181fb3271d2792122c2f604ae98ba1'],
 ['used',0,['X','Y','Z'],4,'e62b7e5216acd7c5e6f50ff006902cdb55386d1b44e2fe9f47343ee8fc9b2ba5'],
 ['used',4294967295,['X','Y','Z'],15,'f6c87b3b1459eba71048dc9387492587b80d0ce561761854119d2cafb0d51eb3'],
 ['used',12345,['X','Z'],6,'77ad794cb2b0a4dd2ba3de62c00d0068d7ff1ed3cd28f03eb43602b7ba0384eb']
];
for(const [condition,seed,keys,count,hash] of fixtures){
 const p=A.generate(condition,seed,keys,count),before=JSON.stringify(p),inspection=I.fromProfile(p);
 equal(crypto.createHash('sha256').update(before).digest('hex'),hash,'existing profile unchanged');
 yes(A.valid(p,keys,count),'existing profile validation remains valid');
 equal(I.fromProfile(JSON.parse(before)),inspection,'saved profile recreates inspection');
 equal(JSON.stringify(p),before,'inspection never mutates profile');
 const modified={...p,initialHeights:Array(count).fill(.5),supportHeights:Array(count).fill(-.5),positions:{X:100,Y:-100,Z:30,A:90,C:180},camera:{zoom:8}};
 equal(I.fromProfile(modified),inspection,'support/axis/rotary/camera state not inspection inputs');
}
for(const condition of ['new','used'])for(const seed of [0,1,2,3,100,12345,4294967295]){
 const p=A.generate(condition,seed,['X','Y','Z'],4),inspection=I.fromProfile(p);
 equal(I.fromProfile(p),inspection,'same seed and condition stable');
 const other=I.fromProfile({...p,seed:seed===4294967295?0:seed+1});yes(JSON.stringify(other)!==JSON.stringify(inspection),'different seed changes inspection');
 const switched=I.fromProfile({...p,condition:condition==='new'?'used':'new'});yes(JSON.stringify(switched)!==JSON.stringify(inspection),'condition changes teaching ranges');
 yes(inspection.runout.rootMicrons>=0&&inspection.runout.tipMicrons>=0,'TIR nonnegative');
}
for(const bad of [null,{}, {version:2,condition:'new',seed:1},{version:1,condition:'new',seed:-1},{version:1,condition:'new',seed:2**32},{version:1,condition:'unknown',seed:1}])equal(I.fromProfile(bad),null,'invalid profile safely absent');
console.log(JSON.stringify({passed:true,checks,independent:'circle contact extrema; Gram-Schmidt least-squares plane; frozen legacy profile SHA256',limits:'browser support/save/gesture integration verified separately; this is intrinsic teaching geometry, not actual machine metrology'}));

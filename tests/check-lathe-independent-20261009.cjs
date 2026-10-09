'use strict';
// Independent lathe geometry: input support heights -> nodal interpolation ->
// explicit rigid transforms -> distance/bisection contacts. Product rendering,
// geometryModel, frame helpers and measurement signs are not expected values.
const assert=require('node:assert/strict'),fs=require('node:fs');
const env=require('./leveling-dom-env.cjs')({pureLeveling:true});
env.read(fs.readFileSync('src/lathe-inspection.js','utf8'));
env.read(fs.readFileSync('src/lathe-inspection-ui.js','utf8'));
env.read('updateLatheInspectionUI=()=>{};');
env.read("openMachine(machines.find(m=>m.kind==='lathe'));$('exaggerate').checked=false;");
const API=require('../src/lathe-inspection.js'),Intrinsic=require('../src/intrinsic-inspection.js');
let assertions=0,cases=0,maxError=0;
const near=(a,b,label,t=4e-6)=>{assert.ok(Number.isFinite(a)&&Math.abs(a-b)<t,`${label}: ${a} != ${b}`);assertions++;maxError=Math.max(maxError,Math.abs(a-b));},ok=(a,label)=>{assert.ok(a,label);assertions++;};
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),scale=(a,t)=>a.map(v=>v*t),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>Math.hypot(...a),unit=a=>scale(a,1/norm(a));
const frame=(a,b)=>{const x=unit([1,a,0]),y=unit([-a,1,-b]);return [x,y,cross(x,y)];},turn=(F,v)=>F.reduce((sum,q,i)=>add(sum,scale(q,v[i])),[0,0,0]),inverse=(F,v)=>F.map(q=>dot(q,v));
const ry=(v,a)=>[Math.cos(a)*v[0]+Math.sin(a)*v[2],v[1],-Math.sin(a)*v[0]+Math.cos(a)*v[2]];
function independentSurface(heights,width=4,depth=1.68){
 const xs=[-width/2,0,width/2],zs=[-depth/2,depth/2],points=zs.flatMap((z,j)=>xs.map((x,i)=>({x,z,h:heights[3*j+i]/1000})));
 const a=points.reduce((v,q)=>v+q.x*q.h,0)/points.reduce((v,q)=>v+q.x*q.x,0),b=points.reduce((v,q)=>v+q.z*q.h,0)/points.reduce((v,q)=>v+q.z*q.z,0),c=heights.reduce((s,h)=>s+h,0)/6000;
 return {a,b,c,at:(x,z)=>{
  const i=x>=0?1:0,u=(x-xs[i])/(xs[i+1]-xs[i]),v=(z-zs[0])/depth,H=[heights[i],heights[i+1],heights[i+3],heights[i+4]].map(q=>q/1000);
  return {h:dot(H,[(1-u)*(1-v),u*(1-v),(1-u)*v,u*v]),a:dot(H,[-(1-v),1-v,-v,v])/(width/2),b:dot(H,[-(1-u),-u,1-u,u])/depth};
 }};
}
function mount(raw,owner,state,S,profile,width=4,depth=1.68){
 const spatial=p=>[p[0]*width/4,p[1],p[2]*depth/1.68],seat0=spatial(owner==='tool'?[-1.75,.66,0]:owner==='tailstock'?[1.65,.66,0]:[.08,.66,-.15]),seat=[...seat0];
 if(owner==='work')seat[0]+=.7*state.Z/100*width/4;
 const s=S.at(seat[0],seat[2]),C=frame(S.a,S.b),F=frame(s.a-S.a,s.b-S.b),angle=owner==='tool'?(profile?.squareness?.XZ?.microns||0)/300000:0;
 const R=v=>turn(C,turn(F,ry(v,angle))),basis=[[1,0,0],[0,1,0],[0,0,1]].map(R),p=sub(spatial(raw),seat0);
 if(owner==='work')p[2]+=.35*state.X/100*depth/1.68;
 const origin=add(turn(C,[seat[0],s.h-S.a*seat[0]-S.b*seat[2]-S.c,seat[2]]),[0,.66+S.c,0]);
 return {point:add(origin,R(p)),R,basis};
}
function rootContact(body,probe,point,normal){
 const distance=e=>dot(sub(add(body,scale(probe,e)),point),normal);let lo=0,hi=.02;
 ok(distance(lo)*distance(hi)<=0,'plane root in plunger stroke');
 for(let i=0;i<65;i++){const mid=(lo+hi)/2;if(distance(lo)*distance(mid)<=0)hi=mid;else lo=mid;}return (lo+hi)/2;
}
function planeReading(first,last,n0,n1){const body=add(first,scale(n0,.01)),probe=scale(n0,-1);return (rootContact(body,probe,first,n0)-rootContact(body,probe,last,n1))*1e6;}
// Viewed from spindle (-internal x) towards turret (+internal x), +internal z
// is screen LEFT. The axis names and screen directions are deliberately split.
function boreReadings(dx,dy){
 const centre=[dx,dy],R=.025;
 if(Math.hypot(dx,dy)>=R)return null;
 const extensions=[[1,0],[0,1],[-1,0],[0,-1]].map(ray=>{
  const outside=e=>Math.hypot(ray[0]*e-centre[0],ray[1]*e-centre[1])-R;let lo=0,hi=.05;
  for(let i=0;i<65;i++){const mid=(lo+hi)/2;if(outside(mid)>0)hi=mid;else lo=mid;}return (lo+hi)/2;
 });return extensions.map(e=>(extensions[0]-e)*1e6);
}
function oracle(heights,state,profile,width=4,depth=1.68){
 const S=independentSurface(heights,width,depth),at=(p,owner,s=state)=>mount(p,owner,s,S,profile,width,depth);
 // Intrinsic amplitudes are supplied fixed input data. Only geometry and the
 // resulting signs are independently derived; this does not validate RNG stats.
 const fixed=API.intrinsic(profile),X0={...state,X:Math.min(state.X,100-.3/(.35*depth/1.68)*100)},Z0={...state,Z:Math.min(state.Z,100-.3/(.7*width/4)*100)},X1={...X0,X:X0.X+.3/(.35*depth/1.68)*100},Z1={...Z0,Z:Z0.Z+.3/(.7*width/4)*100};
 const face0=at([-.09,1.5,-1],'work',X0),face1=at([-.09,1.5,-1],'work',X1),N=[-Math.cos(fixed.face),0,Math.sin(fixed.face)],flat0=at([.23,1.5,-1.43],'work',Z0),flat1=at([.23,1.5,-1.43],'work',Z1),M=[Math.sin(fixed.flat),0,-Math.cos(fixed.flat)];
 const head=at([-1.075,1.5,0],'tool'),axis=head.R([1,0,0]),radial=head.R([0,0,1]),up=head.R([0,1,0]),holeMount=at([-.09,1.5,-.20],'work',{...state,X:.20/.35*100}),hole=add(holeMount.point,holeMount.R([0,fixed.holeY,fixed.holeX])),delta=sub(hole,head.point),dx=dot(delta,radial),dy=dot(delta,up),tail=at([1.125,1.5,0],'tailstock');
 const cut=u=>{
  u=unit(u);const r=unit(sub(radial,scale(u,dot(radial,u)))),a=add(add(head.point,scale(u,dot(sub(flat0.point,head.point),u))),scale(r,-.025)),offset=inverse(flat0.basis,sub(a,flat0.point)),b=add(flat1.point,turn(flat1.basis,offset));
  return 2*(norm(cross(sub(b,head.point),u))-norm(cross(sub(a,head.point),u)))*1e6;
 };
 return {face:planeReading(face0.point,face1.point,face0.R(N),face1.R(N)),flat:planeReading(flat0.point,flat1.point,flat0.R(M),flat1.R(M)),dx:dx*1e6,dy:dy*1e6,bore:boreReadings(dx,dy),unsupported:cut(axis),supported:cut(sub(tail.point,head.point)),X0,Z0};
}
// Contact signs and fixed-configuration reversal are physical constraints.
for(const sign of [-1,1]){
 near(API.planeScan([0,0,0],[sign*10e-6,.3,0],[1,0,0],[1,0,0]),sign*10,'moving plane approaches fixed body');
 near(API.diameterDifference([0,0,.025],[.3,0,.025+sign*5e-6],[0,0,0],[1,0,0]),sign*10,'diameter is twice radial distance');
 near(API.diameterDifference([.3,0,.025+sign*5e-6],[0,0,.025],[0,0,0],[1,0,0]),-sign*10,'same fixed cutter reversed');
}
const profile=env.json("window.MachineAccuracy.generate('used',123456,['X','Z'],6)"),profileSnapshot=JSON.stringify(profile),runoutSnapshot=JSON.stringify(Intrinsic.fromProfile(profile).runout);
const supportCases=[{name:'ideal',h:()=>0},{name:'rigid',h:(x,z)=>.04*x-.05*z+.03},{name:'saddle+',h:(x,z)=>.05*x*z},{name:'saddle-',h:(x,z)=>-.05*x*z},{name:'saddle+plane',h:(x,z)=>.05*x*z+.04*x-.05*z+.03},...Array.from({length:6},(_,i)=>[-1,1].map(sign=>({name:`support${i}/${sign}`,h:(x,z,j)=>j===i?sign*.08:0}))).flat()];
const rows=[];
for(const [width,depth] of [[4,1.68],[5.2,1.2]])for(const c of supportCases)for(const used of [false,true]){
 const heights=[-depth/2,depth/2].flatMap((z,j)=>[-width/2,0,width/2].map((x,i)=>c.h(x,z,j*3+i))),p=used?profile:null;
 env.read(`levelConfig.width=${width};levelConfig.depth=${depth};machineProfile=${JSON.stringify(p)};supportHeights=${JSON.stringify(heights)};`);
 for(const X of [-100,0,100])for(const Z of [-100,-.08/.7*100-1e-5,-.08/.7*100+1e-5,0,100]){
  const state={X,Y:0,Z,A:0,C:0};env.read(`positions=${JSON.stringify(state)};updateLeveling();`);
  const actual=env.json('latheInspectionGeometry()'),expected=oracle(heights,state,p,width,depth);
  near(actual.xStart.Z,state.Z,'X scan retains requested Z position',1e-12);
  near(actual.zStart.X,state.X,'Z scan retains requested X position',1e-12);
  for(const key of ['face','flat','dx','dy','unsupported','supported'])near(actual[key],expected[key],`${c.name} ${used} ${width}/${depth} X${X}Z${Z} ${key}`);
  ok(actual.bore.valid===!!expected.bore,'bore contact validity');
  if(expected.bore){expected.bore.forEach((n,i)=>near(actual.bore.readings[i],n,`${c.name} X${X}Z${Z} bore ${i}`));near((actual.bore.readings[2]-actual.bore.readings[0])/2,actual.dx,'c-a follows positive member X');near((actual.bore.readings[3]-actual.bore.readings[1])/2,actual.dy,'d-b follows positive height');}
  near(actual.face,.3*Math.sin(API.intrinsic(p).face)*1e6,'X face intrinsic/common-pose invariance');
  if(!used&&(c.name==='ideal'||c.name==='rigid'))for(const key of ['face','flat','dx','dy','unsupported','supported'])near(actual[key],0,`ideal/common rigid ${key}`);
  if(width===4&&X===0&&Z===0&&['ideal','saddle+','saddle-'].includes(c.name))rows.push({name:c.name,used,face:actual.face,flat:actual.flat,dx:actual.dx,dy:actual.dy,unsupported:actual.unsupported,supported:actual.supported});
  cases++;
 }
}
// The whole deformed arrangement receives one common transform when a rigid
// plane is added. It must not create a measurement difference.
for(const X of [-100,100])for(const Z of [-100,100]){
 const state={X,Y:0,Z,A:0,C:0},h=[-.84,.84].flatMap(z=>[-2,0,2].map(x=>.05*x*z)),tilted=[-.84,.84].flatMap(z=>[-2,0,2].map(x=>.05*x*z+.03*x+.04*z+.02));
 const a=oracle(h,state,profile),b=oracle(tilted,state,profile);
 for(const key of ['face','flat','dx','dy','unsupported','supported'])near(a[key],b[key],`rigid tilt of deformed arrangement ${key}`);
}
assert.equal(JSON.stringify(profile),profileSnapshot,'profile unmodified');assertions++;
assert.equal(JSON.stringify(Intrinsic.fromProfile(profile).runout),runoutSnapshot,'spindle TIR retains individual');assertions++;
// User-configurable support dimensions also scale travel. Never fabricate an
// off-slider 300 mm interval when the complete motion range is shorter.
let shortTravelCases=0;
for(const [width,depth] of [[.5,1.68],[4,.5],[.5,.5],[6/7,.72],[6/7-1e-7,.72-1e-7]])for(const X of [-100,100])for(const Z of [-100,100]){
 env.read(`levelConfig.width=${width};levelConfig.depth=${depth};supportHeights=supports.map(()=>0);machineProfile=null;positions={X:${X},Y:0,Z:${Z},A:0,C:0};updateLeveling();`);
 const a=env.json('latheInspectionGeometry()'),validX=.7*depth/1.68>=.3-1e-12,validZ=1.4*width/4>=.3-1e-12;
 assert.equal(a.validX,validX);assertions++;assert.equal(a.validZ,validZ);assertions++;
 for(const pair of [['xStart','X'],['xEnd','X'],['zStart','Z'],['zEnd','Z']])ok(a[pair[0]][pair[1]]>=-100&&a[pair[0]][pair[1]]<=100,'scan endpoint within actual slider');
 if(!validX){assert.equal(a.face,null,'insufficient X travel is unavailable');assertions++;}
 if(!validZ)for(const key of ['flat','supported','unsupported']){assert.equal(a[key],null,'insufficient Z travel is unavailable');assertions++;}
 if(validX)near(a.face,0,'ideal face at exact minimum travel');
 if(validZ)for(const key of ['flat','supported','unsupported'])near(a[key],0,'ideal Z read at exact minimum travel');
 const markup=env.read('latheInspectionMarkup(latheInspectionGeometry(),{rootMicrons:0,tipMicrons:0})');
 if(!validX)ok(markup.includes('X —'),'invalid X is a dash, not a fabricated zero');
 if(!validZ)ok(markup.includes('Z —'),'invalid Z is a dash, not a fabricated zero');
 shortTravelCases++;
}
console.log(JSON.stringify({passed:true,assertions,cases,shortTravelCases,maxError,rows,scope:'Independent nodal support surface, common/local rigid mounts, plane-distance bisection, view-correct hole circle bisection, cutter distances; no physical elasticity or tilted-bore contact claim.'},null,2));

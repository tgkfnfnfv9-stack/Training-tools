'use strict';
// Independent oracle: support input -> piecewise bilinear surface -> rigid
// mounts -> signed distance / ray-to-cylinder bisection. No renderer, app
// frame, app sign table, or old test result is used to make expected values.
const assert=require('node:assert/strict');
const Plane=require('../src/reference-measurement.js');
const Cylinder=require('../src/horizontal-parallelism.js');
const env=require('./leveling-dom-env.cjs')({pureLeveling:true});
env.read("openMachine(machines.find(m=>m.kind==='horizontal'));$('exaggerate').checked=false;");
let assertions=0;
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,k)=>a.map(v=>v*k),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>mul(a,1/Math.hypot(...a));
const near=(a,b,label,t=3e-6)=>{assert.ok(Number.isFinite(a)&&Math.abs(a-b)<t,`${label}: ${a} != ${b}`);assertions++;};
const check=(q,label)=>{assert.ok(q,label);assertions++;};
const rotate=(f,v)=>f.reduce((r,q,i)=>add(r,mul(q,v[i])),[0,0,0]),local=(f,v)=>f.map(q=>dot(q,v));
const transport=(v,a,b)=>rotate(b,local(a,v));
const rz=(v,a)=>[Math.cos(a)*v[0]-Math.sin(a)*v[1],Math.sin(a)*v[0]+Math.cos(a)*v[1],v[2]];
// Bilinear interpolant from four nodal shape functions, explicitly using the
// eight input heights. One-sided derivative belongs to the rear cell at a seam.
const xs=[-1.36,1.36],zs=[-1.84,-1.84/3,1.84/3,1.84];
function surface(heights){
 return (x,z)=>{
  let j=zs.slice(1,-1).filter(q=>z>=q).length;
  const u=(x-xs[0])/(xs[1]-xs[0]),v=(z-zs[j])/(zs[j+1]-zs[j]);
  const h=[heights[2*j],heights[2*j+1],heights[2*j+2],heights[2*j+3]];
  return {height:dot(h,[(1-u)*(1-v),u*(1-v),(1-u)*v,u*v])/1000,
   dx:dot(h,[-(1-v),1-v,-v,v])/(xs[1]-xs[0])/1000,
   dz:dot(h,[-(1-u),-u,1-u,u])/(zs[j+1]-zs[j])/1000};
 };
}
function frame(s,x,z){const q=s(x,z),right=unit([1,q.dx,0]),up=unit([-q.dx,1,-q.dz]);return [right,up,cross(right,up)];}
function axes(profile){
 const a=k=>(profile?.squareness[k]?.microns||0)/300000,A=a('XY'),B=a('XZ'),C=a('YZ');
 const y=[-Math.sin(A),Math.cos(A),0],z=[-Math.sin(B),(-Math.sin(C)-Math.sin(B)*Math.sin(A))/Math.cos(A),0];z[2]=Math.sqrt(1-z[0]**2-z[1]**2);
 return {y,z,A};
}
function pallet(surface,travel,intrinsic,uniform,H=.61){
 const z=-.85+travel,F=frame(surface,0,z);
 if(uniform)return add(add([0,.66+surface(0,-.85).height,-.85],mul(F[1],H)),mul(rotate(F,intrinsic.z),travel));
 return add([0,.66+surface(0,z).height,z],rotate(F,add([0,H,0],mul(sub(intrinsic.z,[0,0,1]),travel))));
}
function column(surface,X,Y,intrinsic,uniform){
 const c=.55*X/100,y=.3*Y/100,zC=4.6*.29,F=frame(surface,c,zC),R=v=>rotate(F,rz(v,intrinsic.A));
 const nose=uniform?add(add([0,.66+surface(0,zC).height,zC],R([0,1.89,-.93-zC])),add(mul(F[0],c),mul(rotate(F,intrinsic.y),y))):add([c,.66+surface(c,zC).height,zC],R([0,1.89+y,-.93-zC]));
 return {nose,right:R([1,0,0]),up:R([0,1,0]),back:R([0,0,1]),F};
}
function planeExtension(pose){return dot(pose.normal,sub(pose.point,pose.body))/dot(pose.normal,pose.probe);}
function cylinderExtension(body,probe,origin,axis,r=.025){
 const residual=e=>Math.hypot(...cross(sub(add(body,mul(probe,e)),origin),axis))-r;
 let lo=0,hi=.02;check(residual(lo)>=0&&residual(hi)<=0,'near-side root brackets contact');
 for(let i=0;i<65;i++){const mid=(lo+hi)/2;if(residual(mid)>0)lo=mid;else hi=mid;}
 return (lo+hi)/2;
}
const signed=[];
// These expectations come from distance to a fixed plane, with bodies on
// either side. Moving closer retracts the plunger; moving away extends it.
for(const side of [-1,1])for(const delta of [-12e-6,12e-6]){
 const start={point:[0,0,0],normal:[1,0,0],body:[side*.01,0,0],probe:[-side,0,0]},end={...start,body:[side*(.01-delta),.3,0]};
 const got=Plane.compare(start,end);check(got.valid,'plane contact');near(got.microns,delta*1e6,'approach/recede both sides');
 near(Plane.compare(end,start).microns,-got.microns,'same fixed setup, exchanged endpoints and new zero');signed.push({side,deltaUm:delta*1e6,readUm:got.microns});
 // A common non-axis-aligned rotation plus translation preserves the read.
 const axis=unit([1,2,3]),angle=.43,R=v=>add(add(mul(v,Math.cos(angle)),mul(cross(axis,v),Math.sin(angle))),mul(axis,dot(axis,v)*(1-Math.cos(angle)))),t=[.7,-1.2,2.3],T=p=>({point:add(R(p.point),t),normal:R(p.normal),body:add(R(p.body),t),probe:R(p.probe)});
 near(Plane.compare(T(start),T(end)).microns,got.microns,'common rigid motion leaves plane read invariant');
}
for(const side of [-1,1])for(const delta of [-12e-6,12e-6]){
 const bar={axis:[0,0,1],origin:[0,0,0],radius:.025},samples=[{body:[side*.035,0,0],probe:[-side,0,0]},{body:[side*(.035-delta),0,.3],probe:[-side,0,0]}];
 const got=Cylinder.measure({...bar,samples});check(got.valid,'cylinder contact');near(got.microns,delta*1e6,'cylinder approach/recede either side');near(Cylinder.measure({...bar,samples:[...samples].reverse()}).microns,-got.microns,'fixed cylinder endpoints reversed');
}
const cases=[{name:'ideal',uniform:true,h:()=>0},{name:'rigid+',uniform:true,h:(x,z)=>.03*x+.04*z+.02},{name:'rigid-',uniform:true,h:(x,z)=>-.03*x-.04*z-.02},{name:'twist+',h:(x,z)=>.05*x*z},{name:'twist-',h:(x,z)=>-.05*x*z},...Array.from({length:8},(_,i)=>[-1,1].map(sign=>({name:`support-${i}-${sign}`,h:(x,z,j)=>i===j?sign*.04:0}))).flat()];
const used=env.json("window.MachineAccuracy.generate('used',123456,['X','Y','Z'],8)");
cases.push({name:'used-flat',uniform:true,h:()=>0,profile:used},{name:'used-B+',h:(x,z,i)=>i===1?.01:0,profile:used},{name:'used-twist+',h:(x,z)=>.05*x*z,profile:used});
let machineCases=0,maximumOracleError=0;
const rows=[],seam=(zs[1]+.85)/.45*100;
for(const c of cases){
 const heights=zs.flatMap(z=>xs.map(x=>c.h(x,z,zs.indexOf(z)*2+xs.indexOf(x)))),S=surface(heights),I=axes(c.profile);
 env.read(`machineProfile=${JSON.stringify(c.profile||null)};supportHeights=${JSON.stringify(heights)};updateLeveling();`);
 for(const X of [-100,0,100])for(const Y of [-100,100])for(const Z of [-100,seam-1e-5,seam,seam+1e-5,100]){
  const state={X,Y,Z,A:0,C:0};env.read(`positions=${JSON.stringify(state)};updateLeveling();`);
  const start=Math.max(-.45,Math.min(.15,Z*.45/100)),end=start+.3,F0=frame(S,0,-.85+start),F1=frame(S,0,-.85+end),P0=pallet(S,start,I,c.uniform),P1=pallet(S,end,I,c.uniform),T=column(S,X,Y,I,c.uniform);
  const gx=unit([1,(S(.55*X/100,4.6*.28-.13).dx+S(.55*X/100,4.6*.28+.13).dx)/2,0]);
  const expect={XY:-.3*dot(gx,rotate(T.F,I.y))*1e6};
  for(const [key,n] of [['XZ',gx],['YZ',rotate(T.F,I.y)]]){
   const pose={point:P1,normal:transport(n,F0,F1),body:add(P0,mul(n,.01)),probe:mul(n,-1)};expect[key]=(.01-planeExtension(pose))*1e6;
  }
  const got=env.json("({XY:referenceScan({key:'XY'}),XZ:referenceScan({key:'XZ'}),YZ:referenceScan({key:'YZ'}),parallel:horizontalParallelism()})");
  for(const key of ['XY','XZ','YZ']){check(got[key].valid,`${c.name} ${key} valid`);maximumOracleError=Math.max(maximumOracleError,Math.abs(got[key].microns-expect[key]));near(got[key].microns,expect[key],`${c.name} ${X}/${Y}/${Z} ${key}`);if(c.uniform&&!c.profile)near(got[key].microns,0,'ideal/common rigid plane');}
  const O=sub(T.nose,mul(T.back,.31));
  for(const [key,u] of [['a',T.right],['b',T.up]]){
   const B0=sub(O,mul(u,.035)),B1=add(P1,transport(sub(B0,P0),F0,F1)),u1=transport(u,F0,F1),expected=(cylinderExtension(B0,u,O,T.back)-cylinderExtension(B1,u1,O,T.back))*1e6;
   check(got.parallel[key].valid,`${c.name} parallel ${key}`);maximumOracleError=Math.max(maximumOracleError,Math.abs(got.parallel[key].microns-expected));near(got.parallel[key].microns,expected,`${c.name} ${X}/${Y}/${Z} ${key}`);if(c.uniform&&!c.profile)near(got.parallel[key].microns,0,'rigid plane cylinder');
  }
  if(c.name.startsWith('twist')&&X===0&&Z===-100)rows.push({case:c.name,X,Y,Z,...expect,a:got.parallel.a.microns,b:got.parallel.b.microns});machineCases++;
 }
}
// Known isolated nonorthogonality: Y leans left for +XY; Z leans left
// for +XZ and down for +YZ. These chosen directions define the sign oracle.
for(const key of ['XY','XZ','YZ'])for(const sign of [-1,1]){
 const angle=sign*.0002,profile={squareness:{XY:{microns:0},XZ:{microns:0},YZ:{microns:0}},guides:{},initialHeights:Array(8).fill(0)};profile.squareness[key].microns=angle*300000;
 env.read(`machineProfile=${JSON.stringify(profile)};supportHeights=supports.map(()=>0);positions={X:0,Y:0,Z:0,A:0,C:0};updateLeveling();`);
 near(env.json(`referenceScan({key:'${key}'})`).microns,(key==='XY'?1:-1)*.3*Math.sin(angle)*1e6,`known ${key} ${sign}`);
}
// Diagnosis only: a rigid material point fixed to the head at a selected
// height has an X trace different from a representative guide. A finite
// secant, not the production normal, is computed from independent mounts.
const diagnostic=[];
for(const H of [.61,1.89]){
 const k=.01,S=surface(zs.flatMap(z=>xs.map(x=>k*x*z))),I=axes(null),F0=frame(S,0,4.6*.29),C0=[0,.66,4.6*.29],P0=[0,.66+H,-.85],localMount=local(F0,sub(P0,C0));
 const P=x=>add([x,.66+S(x,4.6*.29).height,4.6*.29],rotate(frame(S,x,4.6*.29),localMount));
 const v=unit(sub(P(.15),P(-.15))),guide=unit([1,k*4.6*.28/1000,0]);
 diagnostic.push({heightAboveSupportM:H,finiteXTraceMicroradians:[v[1]/v[0]*1e6,v[2]/v[0]*1e6],representativeXMicroradians:[guide[1]/guide[0]*1e6,guide[2]/guide[0]*1e6]});
 check(Math.abs(v[2]-guide[2])>5e-6,'physical R trace demonstrably differs from representative guide');
}
// Re-zeroing a fixed apparatus reverses its difference. Re-setting its plane
// normal at the other end is a different apparatus and generally does not.
const theta=.002,normal0=[1,0,0],normal1=[Math.cos(theta),0,Math.sin(theta)],p0=[0,0,0],p1=[-.00003,0,.3],b=add(p0,mul(normal0,.01)),start={point:p0,normal:normal0,body:b,probe:mul(normal0,-1)},end={point:p1,normal:normal1,body:b,probe:mul(normal0,-1)};
const forward=Plane.compare(start,end).microns,reverseFixed=Plane.compare(end,start).microns;
const resetStart={point:p1,normal:normal0,body:add(p1,mul(normal0,.01)),probe:mul(normal0,-1)},resetEnd={point:p0,normal:[Math.cos(theta),0,-Math.sin(theta)],body:resetStart.body,probe:resetStart.probe},reverseRealigned=Plane.compare(resetStart,resetEnd).microns;
near(reverseFixed,-forward,'fixed realigned diagnosis reversal');check(Math.abs(reverseRealigned+forward)>.1,'realignment is not mere zeroing');
// Independently review the correction author's finite-chord diagnostic. Its
// S reading is a valid mathematical alternative, not an approved real fixture.
const fs=require('node:fs'),candidateFile='docs/horizontal-alignment-diagnostic-20261008.json';
let candidateComparisons=0,maximumCandidateError=0;
if(fs.existsSync(candidateFile))for(const row of JSON.parse(fs.readFileSync(candidateFile)).rows){
 const twist=row.name.includes('minus_005')?-.05:row.name.includes('005')?.05:row.name.includes('001')&&!row.name.includes('B_plus')?.01:0;
 const profile=row.name.startsWith('used')?used:null,I=axes(profile),uniform=row.name==='ideal'||row.name==='common_rigid_tilt'||row.name==='used_flat';
 const heights=zs.flatMap((z,j)=>xs.map((x,i)=>row.name==='common_rigid_tilt'?.03*x+.04*z:row.name==='used_B_plus_001'?(2*j+i===1?.01:0):twist*x*z)),S=surface(heights);
 const X=row.name.endsWith('Xminus')?-100:row.name.endsWith('Xplus')?100:0,Y=row.name.endsWith('Yminus')?-100:row.name.endsWith('Yplus')?100:0;
 for(const item of row.alternatives)for(const [field,H] of [['finiteChordOldPoint',.61],['finiteChordRaisedPoint',.66]]){
  const q=item[field],key=item.key,scanY=key==='XY',start=scanY?Math.max(-.3,Math.min(0,Y*.003)):0,Y0=scanY?start/.003:Y;
  const T0=column(S,X,Y0,I,uniform),P0=pallet(S,0,I,uniform,H),mount=local([T0.right,T0.up,T0.back],sub(P0,T0.nose));
  const baseLo=key==='YZ'?Math.max(-.3,Math.min(0,Y*.003)):Math.max(-.55,Math.min(.25,X*.0055));
  const touched=d=>{const T=column(S,key==='YZ'?X:d/.0055,key==='YZ'?d/.003:Y0,I,uniform);return add(T.nose,rotate([T.right,T.up,T.back],mount));};
  const chord=unit(sub(touched(baseLo+.3),touched(baseLo)));
  for(let i=0;i<3;i++)near(chord[i],q.chord[i],`${row.name}/${key} diagnostic chord`,2e-12);
  let expected;
  if(scanY)expected=-.3*dot(chord,rotate(T0.F,I.y))*1e6;
  else {const W0=frame(S,0,-.85),W1=frame(S,0,-.55),P1=pallet(S,.3,I,uniform,H);expected=(.01-planeExtension({point:P1,normal:transport(chord,W0,W1),body:add(P0,mul(chord,.01)),probe:mul(chord,-1)}))*1e6;}
  near(expected,q.microns,`${row.name}/${key} independent diagnostic`,3e-6);maximumCandidateError=Math.max(maximumCandidateError,Math.abs(expected-q.microns));candidateComparisons++;
 }
}
// New horizontal-only mesh repair: check the actual authored mesh as output,
// and demand attachment, clearance and ownership from physical constraints.
env.read("machineProfile=null;supportHeights=supports.map(()=>0);positions={X:0,Y:0,Z:0,A:0,C:0};$('exaggerate').checked=false;updateLeveling();");
const mesh=env.json('createGeometry(current)'),bounds=faces=>[0,1,2].map(i=>[Math.min(...faces.flatMap(f=>f.v.map(p=>p[i]))),Math.max(...faces.flatMap(f=>f.v.map(p=>p[i]))) ]);
const work=mesh.faces.filter(f=>f.color==='#d1ddd7'),carriage=mesh.faces.filter(f=>f.color==='#799198'&&f.pose==='work'),table=mesh.faces.filter(f=>f.color==='#4c9b8b'&&f.pose==='work');
const rails=mesh.faces.filter(f=>f.color==='#c8d6d9'&&f.pose==='bed'&&f.v.every(p=>Math.abs(p[0])<=.631&&p[2]<=.501));
check(rails.length>0,'Z guide present');check(rails.every(f=>f.axes.length===0),'Z guide remains bed-owned');
const bw=bounds(work),bc=bounds(carriage),bt=bounds(table),br=bounds(rails);
near(bw[1][0],bt[1][1],'workpiece seated on pallet',1e-12);check(bt[1][0]<=bc[1][1],'rotary seat enters carriage');check(br[1][0]<=.645&&br[1][1]>=bc[1][0],'Z guide connects bed and carriage');
check(br[2][0]<=bc[2][0]-.45&&br[2][1]>=bc[2][1]+.45,'Z guide covers full pallet travel');
const spindle=mesh.faces.filter(f=>f.color==='#dfab62'&&f.pose==='tool'),head=mesh.faces.filter(f=>f.color==='#799198'&&f.axes.join(',')==='X,Y');
check(bounds(spindle)[1][0]-.3>bw[1][1],'all spindle surfaces clear workpiece at lowest Y');check(bounds(head)[1][0]-.3>bw[1][1],'head clears workpiece at lowest Y');
let fixedRailStates=0;
for(const h of ['0','.05*q.x*q.z','-.05*q.x*q.z','.03*q.x+.04*q.z']){
 env.read(`supportHeights=supports.map(p=>{const q=levelCoordinates(p.x,p.z);return ${h}});updateLeveling();`);
 let reference;
 for(const X of [-100,100])for(const Y of [-100,100])for(const Z of [-100,100]){
  env.read(`positions={X:${X},Y:${Y},Z:${Z},A:0,C:0};updateLeveling();`);
  const observed=env.json(`(${JSON.stringify(rails)}).map(f=>f.v.map(p=>displayedModelPoint(p,f.axes,current,positions,f.pose)))`);
  if(reference){assert.deepEqual(observed,reference,'fixed Z rails do not follow any linear axis');assertions++;}else reference=observed;fixedRailStates++;
 }
}
console.log(JSON.stringify({passed:true,assertions,machineCases,maximumOracleError,candidateComparisons,maximumCandidateError,fixedRailStates,rows,diagnostic,reverse:{forward,reverseFixed,reverseRealigned},scope:'Input-height independent bilinear interpolation, plane/cylinder contact, both sides, fixed reversal, rigid transforms, all axis ends and support seam; R mount diagnosis is not a new production fixture.'},null,2));

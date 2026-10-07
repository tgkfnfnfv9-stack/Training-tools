'use strict';
const assert=require('node:assert/strict');
const env=require('./leveling-dom-env.cjs')({pureLeveling:true});
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((v,q,i)=>v+q*b[i],0);
const unit=a=>a.map(v=>v/Math.hypot(...a));
const near=(a,b,t,label)=>assert.ok(Math.abs(a-b)<=t,`${label}: ${a} vs ${b}`);
const result=[];
// This first block is a cross-layer equality check, not an independent physics
// oracle: model vertices and measurement poses are both production outputs.
// Independent physical expectations follow below.
for(const kind of ['compact','horizontal','travel','double','gantry','five','lathe']) {
 env.storage.clear();env.read(`openMachine(machines.find(m=>m.kind==='${kind}'));$('exaggerate').checked=false;`);
 const pairs=kind==='lathe'?['XZ']:['XY','XZ','YZ'];
 for(const dimension of [0,1])for(const sign of [-1,1]) {
  env.read(`levelConfig.width=current.w*.8*${dimension?1.33:1};levelConfig.depth=current.d*.8*${dimension?.79:1};levelConfig.columnX=${dimension?63:-47};levelConfig.columnZ=${dimension?-71:36};supportHeights=supports.map(p=>{const q=levelCoordinates(p.x,p.z);return ${sign}*.055*q.x*q.z+.017*q.x-.031*q.z;});machineProfile={guides:{},initialHeights:supports.map(()=>0),squareness:${JSON.stringify(Object.fromEntries(pairs.map((pair,i)=>[pair,{microns:(i===1?-1:1)*(70+i*11)}])))}};positions={X:43,Y:-67,Z:26,A:0,C:0};updateLeveling();`);
  for(const pair of pairs) {
   const state=env.json('positions'),scan=env.json(`referenceScan({key:'${pair}'})`);
   assert.equal(scan.valid,true,`${kind}/${pair}`);
   const axis=kind==='lathe'?'X':pair[1],member=env.json(`axisConfig(current).find(a=>a.key==='${axis}')`);
   const half=env.json(`(()=>{const q=levelCoordinates(${member.vector[0]*member.amp},${member.vector[2]*member.amp});return Math.hypot(q.x,${member.vector[1]*member.amp},q.z)})()`);
   const master=kind==='compact'&&axis==='Y'||kind==='horizontal'&&axis==='Z'||kind==='five'&&axis==='Y',pose=master||kind==='lathe'?'work':'tool';
   const vertex=master&&kind==='compact'?env.json('({p:[0,1.16,-current.d*.1],axes:["X","Y"]})'):master&&kind==='horizontal'?{p:[0,1.27,-.85],axes:['Z']}:env.json(`(()=>{const f=createGeometry(current).faces.find(f=>f.pose==='${pose}'&&f.axes.includes('${axis}'));return {p:f.v[0],axes:f.axes}})()`);
   const s0={...state,[axis]:scan.startPosition/half*100},s1={...state,[axis]:scan.endPosition/half*100};
   const point=s=>{env.read(`positions=${JSON.stringify(s)};updateLeveling();`);return env.json(`displayedModelPoint(${JSON.stringify(vertex.p)},${JSON.stringify(vertex.axes)},current,positions,'${pose}')`);};
   const p0=point(s0),p1=point(s1),actual=sub(p1,p0),expected=master?sub(scan.end.point,scan.start.point):sub(scan.end.body,scan.start.body);
   const error=Math.hypot(...sub(actual,expected))*1e6;
   result.push({kind,pair,dimension,sign,errorMicrons:error,actual,expected});
   env.read(`positions=${JSON.stringify(state)};updateLeveling();`);
  }
 }
}

// Independent geometry for the travelling-column and horizontal-head scans.
// The support law is imposed in physical metres, its derivative is analytic;
// no production sign table, direction, diagram or rendered vertex is an oracle.
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const add=(a,b)=>a.map((v,i)=>v+b[i]),mul=(a,s)=>a.map(v=>v*s);
function basis(a,b) {const r=unit([1,a/1000,0]),u=unit([-a/1000,1,-b/1000]),f=cross(r,u);return v=>add(add(mul(r,v[0]),mul(u,v[1])),mul(f,v[2]));}
const angle=[70,-81,92].map(v=>v/300000),sy=-Math.sin(angle[0]),cy=Math.cos(angle[0]),zx=-Math.sin(angle[1]),zy=(-Math.sin(angle[2])-zx*sy)/cy,zz=Math.sqrt(1-zx*zx-zy*zy);
let analyticScans=0;
for(const kind of ['travel','horizontal','lathe'])for(const sign of [-1,1])for(const edge of [-91,43,97]) {
 env.storage.clear();env.read(`openMachine(machines.find(m=>m.kind==='${kind}'));$('exaggerate').checked=false;levelConfig.width=current.w*.8*1.33;levelConfig.depth=current.d*.8*.79;levelConfig.columnX=63;levelConfig.columnZ=-71;supportHeights=supports.map(p=>{const q=levelCoordinates(p.x,p.z);return ${sign}*.055*q.x*q.z+.017*q.x-.031*q.z;});machineProfile={guides:{},initialHeights:supports.map(()=>0),squareness:${JSON.stringify(kind==='lathe'?{XZ:{microns:70}}:{XY:{microns:70},XZ:{microns:-81},YZ:{microns:92}})}};positions={X:${edge},Y:-67,Z:26,A:0,C:0};updateLeveling();`);
 const meta=env.json('({w:current.w,d:current.d,sx:levelConfig.width/(current.w*.8),sz:levelConfig.depth/(current.d*.8)})'),s=env.json('positions');
 const k=sign*.055,rot=(x,z)=>basis(k*z+.017,k*x-.031),intrinsic=kind==='travel'?[[1,0,0],[sy,0,cy],[zx,zz,zy]]:kind==='horizontal'?[[1,0,0],[sy,cy,0],[zx,zy,zz]]:null;
 let vectors;
 if(kind==='lathe') {
  const T=rot(-meta.w*.35*meta.sx,0),W=rot((.08+.7*s.Z/100)*meta.sx,-.15*meta.sz);
  vectors={X:W([0,0,1]),Z:T([Math.cos(angle[0]),0,-Math.sin(angle[0])])};
 } else {
  const x=((kind==='travel'?-.5+s.X/100:.55*s.X/100)+meta.w*.2*.63)*meta.sx,z=meta.d*(.29-.071)*meta.sz,T=rot(x,z),G=rot(x,meta.d*(kind==='travel'?.22:.28)*meta.sz);
  vectors={X:G(intrinsic[0]),Y:T(intrinsic[1]),Z:T(intrinsic[2])};
 }
 for(const pair of kind==='lathe'?['XZ']:['XY','XZ','YZ']) {
  const base=kind==='lathe'?'Z':pair[0],axis=kind==='lathe'?'X':pair[1],distance=pair==='XY'?.3:-.3;
  // lambda at the contact equals body normal distance, because probe=-normal.
  // Positive compression is lambda_start-lambda_end.
  let expected=-dot(vectors[base],vectors[axis])*distance*1e6;
  if(kind==='horizontal'&&axis==='Z') {
   const half=.45*meta.sz,lo=Math.max(-half,Math.min(half-.3,s.Z*half/100)),hi=lo+.3;
   const at=q=>{const z=-.85*meta.sz+q,R=rot(0,z),delta=sub(intrinsic[2],[0,0,1]);return {R,point:add(R(add([0,.61,0],mul(delta,q))),[0,.66+(-.031*z)/1000,z])};};
   const a=at(lo),b=at(hi),n=vectors[base],axes=[[1,0,0],[0,1,0],[0,0,1]],local=axes.map(q=>dot(n,a.R(q))),endNormal=b.R(local),masterTranslation=sub(b.point,a.point),body=mul(n,.01),probe=mul(n,-1);
   const extension=dot(endNormal,sub(masterTranslation,body))/dot(endNormal,probe);
   expected=(.01-extension)*1e6;
  }
  const actual=env.json(`referenceScan({key:'${pair}'})`);
  near(actual.microns,expected,2e-6,`${kind}/${pair}/mixed analytic/${sign}/${edge}`);analyticScans++;
 }
}
let rigidScans=0;
for(const kind of ['compact','horizontal','travel','double','gantry','five','lathe']) {
 env.storage.clear();env.read(`openMachine(machines.find(m=>m.kind==='${kind}'));$('exaggerate').checked=false;levelConfig.columnX=63;levelConfig.columnZ=-71;supportHeights=supports.map(p=>{const q=levelCoordinates(p.x,p.z);return .071*q.x-.039*q.z+.04;});machineProfile={guides:{},initialHeights:supports.map(()=>0),squareness:${JSON.stringify(kind==='lathe'?{XZ:{microns:70}}:{XY:{microns:70},XZ:{microns:-81},YZ:{microns:92}})}};positions={X:-61,Y:87,Z:-95,A:0,C:0};updateLeveling();`);
 for(const pair of kind==='lathe'?['XZ']:['XY','XZ','YZ']) {
  const a=(kind==='lathe'?70:({XY:70,XZ:-81,YZ:92}[pair]))/300000,expected=(pair==='XY'?1:-1)*.3*Math.sin(a)*1e6,actual=env.json(`referenceScan({key:'${pair}'})`);
  near(actual.microns,expected,2e-6,`${kind}/${pair}/coupled intrinsic with rigid tilt`);rigidScans++;
 }
}
assert.ok(result.every(x=>x.errorMicrons<1e-3));
console.log(JSON.stringify({mixedMaterialMotionCases:result.length,maxMovementMismatchMicrons:Math.max(...result.map(x=>x.errorMicrons)),analyticMixedScans:analyticScans,coupledIntrinsicRigidTiltScans:rigidScans}));

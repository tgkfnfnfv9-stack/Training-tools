'use strict';
// Independent reviewer: all 19 finite scans. Expectations are constructed from
// h(x,z), rigid material-point kinematics and ray/plane intersection. Production
// direction/sign tables, rendered arrows and referenceScan do not build them.
const assert=require('node:assert/strict');
const env=require('./leveling-dom-env.cjs')({pureLeveling:true});
const bending=require('./compact-bending-oracle.cjs');
const M=require('../src/reference-measurement.js');
let checks=0,scans=0,motions=0;
const near=(a,b,t=1e-7,label='')=>{checks++;assert.ok(Number.isFinite(a)&&Math.abs(a-b)<t,`${label}: ${a} vs ${b}`);};
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),unit=a=>mul(a,1/Math.hypot(...a)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const vec=(a,b,t=1e-9,label='')=>a.forEach((v,i)=>near(v,b[i],t,label+`[${i}]`));
// Solve plane least-squares by elimination in physical coordinates, independent
// of the normalized production solve. The 3-point case is exact seating.
function plane(points){
 const A=Array.from({length:3},()=>[0,0,0,0]);
 for(const p of points){const v=[p.x,p.z,1];for(let i=0;i<3;i++){for(let j=0;j<3;j++)A[i][j]+=v[i]*v[j];A[i][3]+=v[i]*p.h;}}
 for(let i=0;i<3;i++){let j=i;for(let k=i+1;k<3;k++)if(Math.abs(A[k][i])>Math.abs(A[j][i]))j=k;[A[i],A[j]]=[A[j],A[i]];const d=A[i][i];A[i]=A[i].map(v=>v/d);for(let k=0;k<3;k++)if(k!==i){const f=A[k][i];A[k]=A[k].map((v,l)=>v-f*A[i][l]);}}
 const [a,b,c]=A.map(row=>row[3]);return {a,b,c,heightAt:(x,z)=>a*x+b*z+c,slopeAt:()=>({lr:a,fb:b})};
}
// A surface normal and its x tangent determine a right-handed frame.
const frame=(r,u,b)=>({r,u,b,apply:v=>add(add(mul(r,v[0]),mul(u,v[1])),mul(b,v[2]))});
function surfaceFrame(s){const r=unit([1,s.lr/1000,0]),u=unit([-s.lr/1000,1,-s.fb/1000]);return frame(r,u,cross(r,u));}
const compose=(a,b)=>frame(a.apply(b.r),a.apply(b.u),a.apply(b.b));
const bracket=f=>{const u=unit(f.u),r=unit(sub(f.r,mul(u,dot(f.r,u))));return frame(r,u,cross(r,u));};
const carry=(v,a,b)=>b.apply([dot(v,a.r),dot(v,a.u),dot(v,a.b)]);
const lambda=q=>dot(q.n,sub(q.p,q.b))/dot(q.n,q.u);
const read=(a,b)=>(lambda(a)-lambda(b))*1e6;
const kinds=['compact','horizontal','travel','double','gantry','five','lathe'];
const zero={X:0,Y:0,Z:0,A:0,C:0};
function independentMachine(kind,meta,points,k,surface){
 const {w,d,sx,sz}=meta,common=plane(points),R=surfaceFrame({lr:common.a,fb:common.b});
 let h=surface||{heightAt:(x,z)=>k*x*z,slopeAt:(x,z)=>({lr:k*z,fb:k*x})};
 if(kind==='five')h=common;if(kind==='compact')h=bending(points);
 const local=(x,z)=>surfaceFrame(h.slopeAt(x,z));
 const residual=(x,z,surface=h)=>{const s=surface.slopeAt(x,z);return compose(R,surfaceFrame({lr:s.lr-common.a,fb:s.fb-common.b}));};
 function compactPoint(s){const x=.45*s.X/100*sx,z=(-d*.1+.4*s.Y/100)*sz,f=residual(0,z),origin=R.apply([0,(h.heightAt(0,z)-common.heightAt(0,z))/1000,z]);return add(origin,f.apply([x,.5,0]));}
 function horizontalPoint(s){const z=(-.85+.45*s.Z/100)*sz;return add([0,h.heightAt(0,z)/1000,z],local(0,z).apply([0,.61,0]));}
 function geometry(s){
  let T,W,dirs,columnUps;
  if(kind==='compact'){
   const z=(-d*.1+.4*s.Y/100)*sz;T=residual(0,d*.29*sz);W=residual(0,z);
   const eps=.1,pp=compactPoint({...s,Y:s.Y+2*eps}),p=compactPoint({...s,Y:s.Y+eps}),m=compactPoint({...s,Y:s.Y-eps}),mm=compactPoint({...s,Y:s.Y-2*eps}),dY=add(mul(sub(p,m),8),sub(mm,pp));
   dirs={X:W.r,Y:unit(dY),Z:T.u};
  }else if(kind==='horizontal'){
   const x=.55*s.X/100*sx;T=local(x,d*.29*sz);W=local(0,(-.85+.45*s.Z/100)*sz);
   const rails=[-.13,.13].map(offset=>h.slopeAt(x,(d*.28+offset)*sz)),guide={lr:(rails[0].lr+rails[1].lr)/2,fb:(rails[0].fb+rails[1].fb)/2};dirs={X:surfaceFrame(guide).r,Y:T.u,Z:W.b};
  }else if(kind==='travel'){
   const x=(-.5+s.X/100)*sx;T=local(x,d*.29*sz);W=local(0,-d*.18*sz);
   dirs={X:surfaceFrame(h.slopeAt(x,d*.22*sz)).r,Y:T.b,Z:T.u};
  }else if(kind==='double'||kind==='gantry'){
   const z=(kind==='double'?.825:.7*s.X/100)*sz,x=(kind==='double'?1.10:w*.4)*sx;
   const cols=[-1,1].map(sign=>{
    const seat=kind==='double'?plane(points.filter(p=>p.group===(sign<0?'column-left':'column-right'))):h;
    const slope=seat.slopeAt(sign*x,z),relative=surfaceFrame({lr:slope.lr-common.a,fb:slope.fb-common.b});
    return {relative,top:add([sign*x,(seat.heightAt(sign*x,z)-common.heightAt(sign*x,z))/1000,z],mul(relative.u,2.51))};
   });
   columnUps=cols.map(c=>R.apply(c.relative.u));const r=unit(sub(cols[1].top,cols[0].top)),u=unit(add(cols[0].relative.u,cols[1].relative.u));T=compose(R,frame(r,u,unit(cross(r,u))));
   W=kind==='double'?residual(0,.7*s.X/100*sz):local(0,0);
   const guide=surfaceFrame({lr:k*z,fb:0});dirs={X:kind==='double'?W.b:guide.b,Y:T.r,Z:T.u};
  }else if(kind==='five'){
   T=local(0,d*.3*sz);W=local(.35*s.X/100*sx,(-.45+.35*s.Y/100)*sz);dirs={X:W.r,Y:W.b,Z:T.u};
  }else{
   T=local(-w*.35*sx,0);W=local((.08+.7*s.Z/100)*sx,-.15*sz);dirs={X:W.b,Z:T.r};
  }
  return {T,W,dirs,columnUps};
 }
 function scan(pair,state){
  const base=kind==='lathe'?'Z':pair[0],axis=kind==='lathe'?'X':pair[1];
  // Mechanical ownership: table Y on compact/five; pallet Z on horizontal.
  const masterMoves=(['compact','five'].includes(kind)&&axis==='Y')||(kind==='horizontal'&&axis==='Z');
  const relative=pair==='XY'?1:-1,member=masterMoves?-relative:relative;
  const amp=kind==='lathe'?.35*sz:axis==='Z'?(['double','gantry'].includes(kind)?.28:kind==='horizontal'?.45*sz:.3):kind==='horizontal'?.3:['double','gantry'].includes(kind)?.65*sx:(kind==='compact'?.4:.35)*sz;
  const lo=Math.max(-amp,Math.min(amp-.3,state[axis]*amp/100)),hi=lo+.3,start=member>0?lo:hi,end=member>0?hi:lo;
  const s0={...state,[axis]:start/amp*100},s1={...state,[axis]:end/amp*100},g0=geometry(s0),g1=geometry(s1),n=g0.dirs[base];
  let travel=mul(g0.dirs[axis],end-start);
  if(kind==='compact'&&axis==='Y')travel=sub(compactPoint(s1),compactPoint(s0));
  if(kind==='horizontal'&&axis==='Z')travel=sub(horizontalPoint(s1),horizontalPoint(s0));
  const f0=bracket(masterMoves?g0.W:kind==='lathe'?g0.W:g0.T),f1=bracket(masterMoves?g1.W:kind==='lathe'?g1.W:g1.T);
  const begin={n,p:[0,0,0],b:mul(n,.01),u:mul(n,-1)};
  const last=masterMoves?{n:carry(n,f0,f1),p:travel,b:begin.b,u:begin.u}:{n,p:[0,0,0],b:add(travel,carry(begin.b,f0,f1)),u:carry(begin.u,f0,f1)};
  return {microns:read(begin,last),begin,last,start,end,s0,s1,travel,g0};
 }
 return {geometry,scan,compactPoint,horizontalPoint,h};
}
const results=[];
for(const kind of kinds){
 env.storage.clear();env.read(`openMachine(machines.find(m=>m.kind==='${kind}'));$('exaggerate').checked=false;`);
 const meta=env.json('({w:current.w,d:current.d,sx:levelConfig.width/(current.w*.8),sz:levelConfig.depth/(current.d*.8)})');
 const raw=env.json('supports.map(p=>({...p,...levelCoordinates(p.x,p.z)}))');
 const pairs=kind==='lathe'?['XZ']:['XY','XZ','YZ'];
 for(const k of [-.06,0,.06]){
  const points=raw.map(p=>({...p,h:k*p.x*p.z}));env.read(`supportHeights=${JSON.stringify(points.map(p=>p.h))};updateLeveling();`);
  const expected=independentMachine(kind,meta,points,k);
  for(const edge of [-100,0,100]){
   const state={...zero,X:edge,Y:edge,Z:edge},eg=expected.geometry(state),ag=env.json(`geometryModel(${JSON.stringify(state)},levelSolution,null)`);
   for(const [key,direction] of Object.entries(eg.dirs))vec(ag.directions.find(a=>a.key===key).direction,direction,2e-9,`${kind}/${key}/k=${k}/edge=${edge} axis`);
   vec(ag.toolFrame.up,eg.T.u,2e-10,kind+' column/ram up');vec(ag.workFrame.up,eg.W.u,2e-10,kind+' saddle/pallet up');
   if(eg.columnUps)eg.columnUps.forEach((up,i)=>vec(ag.portal.columns[i].frame.up,up,2e-10,kind+' separate column '+i));
   for(const pair of pairs){
    const oracle=expected.scan(pair,state),actual=env.json(`referenceScan({key:'${pair}'},${JSON.stringify(state)},levelSolution,null)`),label=`${kind}/${pair}/k=${k}/edge=${edge}`;
    assert.equal(actual.valid,true,label+': '+actual.reason);
    near(actual.microns,oracle.microns,2e-5,label);near(actual.startPosition,oracle.start,1e-12,label+' start');near(actual.endPosition,oracle.end,1e-12,label+' end');
    vec(actual.start.normal,oracle.begin.n,2e-9,label+' normal');vec(actual.end.point,oracle.last.p,1e-10,label+' master translation');
    scans++;
    if(edge===0)results.push({kind,pair,k,microns:actual.microns});
    // Independently compare the finite movement of a real rendered vertex to
    // the physical prediction. Renderer output is actual, never the oracle.
    const axis=kind==='lathe'?'X':pair[1],master=kind==='compact'&&axis==='Y'||kind==='horizontal'&&axis==='Z'||kind==='five'&&axis==='Y';
    {
     const pose=master||kind==='lathe'?'work':'tool';
     const sample=master&&kind==='compact'?{p:[0,1.16,-meta.d*.1],axes:['X','Y']}:master&&kind==='horizontal'?{p:[0,1.27,-.85],axes:['Z']}:env.json(`(()=>{const f=createGeometry(current).faces.find(f=>f.pose==='${pose}'&&f.axes.includes('${axis}'));return {p:f.v[0],axes:f.axes};})()`);
     const world=s=>{env.read(`positions=${JSON.stringify(s)};updateLeveling();`);return env.json(`displayedModelPoint(${JSON.stringify(sample.p)},${JSON.stringify(sample.axes)},current,positions,'${pose}')`);};
     const p0=world(oracle.s0),p1=world(oracle.s1);vec(sub(p1,p0),oracle.travel,2e-9,label+' actual model finite movement');motions++;
    }
   }
  }
 }
 // Common tilted plane: no relative angle or finite error can be introduced.
 env.read('supportHeights=supports.map(p=>{const q=levelCoordinates(p.x,p.z);return .035*q.x-.024*q.z+.07;});positions={X:29,Y:-37,Z:41,A:0,C:0};updateLeveling();');
 for(const pair of pairs){const actual=env.json(`referenceScan({key:'${pair}'})`);assert.equal(actual.valid,true);near(actual.microns,0,1e-6,kind+pair+' rigid seating plane');}
}
// A kink in the horizontal support interpolation. Heights stay continuous;
// gradients can jump. Use independent piecewise h=x*g(z), including both sides
// of a crossed support boundary and the 0.61 m height lever arm.
env.storage.clear();env.read("openMachine(machines.find(m=>m.kind==='horizontal'));$('exaggerate').checked=false;");
const hm=env.json('({w:current.w,d:current.d,sx:levelConfig.width/(current.w*.8),sz:levelConfig.depth/(current.d*.8)})');
const hp=env.json('supports.map(p=>({...p,...levelCoordinates(p.x,p.z)}))'),knots=[...new Set(hp.map(p=>p.z))].sort((a,b)=>a-b),values=[.08,-.13,.16,-.05];
function piecewise(z){let i=0;while(i<knots.length-2&&z>=knots[i+1])i++;const derivative=(values[i+1]-values[i])/(knots[i+1]-knots[i]);return {value:values[i]+derivative*(z-knots[i]),derivative};}
const hs={heightAt:(x,z)=>x*piecewise(z).value,slopeAt:(x,z)=>({lr:piecewise(z).value,fb:x*piecewise(z).derivative})},hpoints=hp.map(p=>({...p,h:hs.heightAt(p.x,p.z)}));
env.read(`supportHeights=${JSON.stringify(hpoints.map(p=>p.h))};positions={X:0,Y:0,Z:0,A:0,C:0};updateLeveling();`);
const ho=independentMachine('horizontal',hm,hpoints,0,hs);
for(const edge of [-100,-33,0,66,100])for(const pair of ['XZ','YZ']){
 const state={...zero,Z:edge},expected=ho.scan(pair,state),actual=env.json(`referenceScan({key:'${pair}'},${JSON.stringify(state)})`);assert.equal(actual.valid,true);near(actual.microns,expected.microns,2e-6,`horizontal boundary/${pair}/${edge}`);
 for(const q of actual.samples){const z=(-.85+(expected.start+(expected.end-expected.start)*q.t))*hm.sz;assert.ok(Number.isFinite(hs.heightAt(0,z)));}
}
const crossing=(knots[1]+.85*hm.sz)/.3,contactTimes=env.json("referenceScan({key:'XZ'},positions).samples.map(p=>p.t)");
assert.ok(contactTimes.some(t=>Math.abs(t-crossing)<1e-12));assert.ok(contactTimes.some(t=>t<crossing&&crossing-t<1e-6));assert.ok(contactTimes.some(t=>t>crossing&&t-crossing<1e-6));
for(const height of [0,.61,1.22])for(const Z of [-100,0,100]){
 const z=(-.85+.45*Z/100)*hm.sz,theta=Math.atan(piecewise(z).value/1000),expected=[-height*Math.sin(theta),.66+height*Math.cos(theta),z],actual=env.json(`horizontalPalletPoint([0,${.66+height},-.85],{X:0,Y:0,Z:${Z},A:0,C:0},levelSolution,null)`);vec(actual,expected,1e-10,'height lever arm');
}
// Probe physics without any machine sign convention.
for(const side of [-1,1])for(const step of [-.000012,.000012]){
 const a={n:[1,0,0],p:[0,0,0],b:[side*.01,0,0],u:[-side,0,0]},b={...a,b:[side*.01+step,.3,0]};
 near(read(a,b),-side*step*1e6,1e-9,'opposite contact side');
 const production=q=>({point:q.p,normal:q.n,body:q.b,probe:q.u});near(M.compare(production(a),production(b)).microns,read(a,b),1e-9,'probe contact formula');
 near(M.compare(production(b),production(a)).microns,-read(a,b),1e-9,'same fixture reversed and re-zeroed');
 const transform=q=>({...q,n:[-q.n[1],q.n[2],-q.n[0]],u:[-q.u[1],q.u[2],-q.u[0]],p:add([-q.p[1],q.p[2],-q.p[0]],[2,-3,7]),b:add([-q.b[1],q.b[2],-q.b[0]],[2,-3,7])});near(read(transform(a),transform(b)),read(a,b),1e-8,'shared rigid transformation');
}
// An ideal straight guide acquires a reading when the master is misaligned.
// This is fixture setup error, without injecting any machine angular error.
for(const angle of [-.0001,.0001]){
 const n=[Math.cos(angle),Math.sin(angle),0],a={point:[0,0,0],normal:n,body:mul(n,.01),probe:mul(n,-1)},b={...a,body:add(a.body,[0,.3,0])};
 near(M.compare(a,b).microns,-.3*Math.sin(angle)*1e6,1e-8,'master alignment error on ideal guide');
}
// Curved path x=c*y^2. Realignment at the new zero changes the plane itself;
// merely reversing endpoints of a fixed fixture must not do that.
const c=.0001,L=.3,theta=Math.atan(2*c*L),forward={n:[1,0,0],p:[0,0,0],b:[.01,0,0],u:[-1,0,0]},end={...forward,b:[.01+c*L*L,L,0]};
near(read(forward,end),-9,1e-8,'curved path fixed alignment');near(read(end,forward),9,1e-8,'curved path reverse fixed alignment');
const realignedNormal=[Math.cos(theta),-Math.sin(theta),0],a={n:realignedNormal,p:[0,0,0],b:mul(realignedNormal,.01),u:mul(realignedNormal,-1)},b={...a,b:add(a.b,[-c*L*L,-L,0])};
near(read(a,b),-9*Math.cos(theta),1e-8,'reverse after alignment is not sign flip');
// Independent pure known angles. Only one angular relation is injected at a
// time; with fixed posture n·v=-sin(delta), and relative scan determines travel.
for(const kind of kinds){env.storage.clear();env.read(`openMachine(machines.find(m=>m.kind==='${kind}'));supportHeights=supports.map(()=>0);positions={X:0,Y:0,Z:0,A:0,C:0};updateLeveling();`);const pairs=kind==='lathe'?['XZ']:['XY','XZ','YZ'];
 for(const pair of pairs)for(const angle of [-.0001,.0001]){const profile={squareness:Object.fromEntries(pairs.map(key=>[key,{microns:key===pair?angle*300000:0}]))},actual=env.json(`referenceScan({key:'${pair}'},positions,levelSolution,${JSON.stringify(profile)})`);assert.equal(actual.valid,true);near(actual.microns,(pair==='XY'?1:-1)*.3*Math.sin(angle)*1e6,2e-5,kind+pair+' known angle');}
 if(kind==='five')for(const state of [{...zero,A:1},{...zero,C:-1}])for(const pair of pairs)assert.equal(env.json(`referenceScan({key:'${pair}'},${JSON.stringify(state)})`).valid,false,'rotated five-axis linear scan suppressed');
}
console.log(JSON.stringify({checks,finiteScans:scans,renderedFiniteMotions:motions,centreTwistReadings:results},null,2));

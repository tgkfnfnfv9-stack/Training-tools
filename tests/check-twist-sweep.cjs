'use strict';
// New independent oracle: physical probe-body distance to an explicitly
// specified plane. No renderer, production sign table, Leveling.orientation,
// or production sweep output is used to construct expected values.
const assert=require('node:assert/strict');
const Sweep=require('../src/spindle-sweep.js');
const environment=require('./leveling-dom-env.cjs');
let checks=0;const failures=[];
const check=(name,fn)=>{checks++;try{fn();}catch(e){failures.push(name+': '+e.message);}};
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,t)=>a.map(v=>v*t);
const unit=a=>mul(a,1/Math.hypot(...a));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const near=(a,b,t=2e-7)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,`${a} != ${b}`);
const vector=(a,b,t)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>near(v,b[i],t));};
// Free tip extends 0.2 m down from a body on a 0.15 m radius ring. The
// reference compression is immaterial: only changes after front-zero count.
function probeOracle(axis,normal,right,origin=[0,0,0],planePoint=[0,0,0]){
 const s=unit(axis),n=unit(normal),u=unit(sub(right,mul(s,dot(right,s)))),v=cross(u,s);
 const body=[[1,0],[0,1],[-1,0],[0,-1]].map(([a,b])=>add(origin,add(mul(s,.1),mul(add(mul(u,a),mul(v,b)),.15))));
 const distance=body.map(p=>dot(n,sub(p,planePoint))/dot(n,s));
 const compression=distance.map(d=>.2-d);
 return compression.map(c=>(c-compression[3])*1e6);
}
const values=m=>m.cardinal.map(p=>p.readingMicrons);
for(const p of [-.0002,0,.0002])for(const q of [-.0003,0,.0003]){
 const axis=[0,1,0],normal=[-p,1,-q],right=[1,0,0],actual=Sweep.measure({axis,tableNormal:normal,right});
 check(`fixed top plane p=${p} q=${q}: compression and front zero`,()=>{
  vector(values(actual),[.15*(p+q)*1e6,.3*q*1e6,.15*(q-p)*1e6,0]);
  vector(values(actual),probeOracle(axis,normal,right));assert.equal(actual.cardinal[3].readingMicrons,0);
 });
 const opposite=Sweep.measure({axis:[0,-1,0],tableNormal:mul(normal,-1),right});
 check(`opposite contact side p=${p} q=${q}: same physical front is 90 degrees`,()=>{
  const mapping=[0,270,180,90],front=opposite.at(90).readingMicrons;
  vector(mapping.map(a=>opposite.at(a).readingMicrons-front),values(actual).map(v=>-v));
 });
 for(const offset of [[13,-.7,22],[-.01,1e3,.004]])check(`common rigid translation ${p}/${q}/${offset}`,()=>vector(values(actual),probeOracle(axis,normal,right,offset,offset),2e-4));
}
// Body approaching a fixed face shortens tip extension: positive compression.
for(const displacement of [-.00003,.00003])check(`body approaching plane ${displacement}`,()=>{
 const before=.2-.1,after=.2-(.1-displacement);near((after-before)*1e6,displacement*1e6);
 const n=[0,1,0],r=[1,0,0],s=[0,1,0];
 vector(probeOracle(s,n,r,[0,-displacement,0]),[0,0,0,0]); // equal shift cancels on all four points
});
for(const sign of [-1,1]){
 const t=sign*.00017,s=[Math.sin(t),Math.cos(t),0],r=[Math.cos(t),-Math.sin(t),0];
 check(`known spindle angle ${t}`,()=>vector(values(Sweep.measure({axis:s,tableNormal:[0,1,0],right:r})),[.15*Math.tan(t)*1e6,0,-.15*Math.tan(t)*1e6,0]));
}

const env=environment({pureLeveling:true}),zero={X:0,Y:0,Z:0,A:0,C:0};
function open(kind){env.read(`openMachine(machines.find(m=>m.kind==='${kind}'));machineProfile=null;positions=${JSON.stringify(zero)};supportHeights=supports.map(()=>0);updateLeveling();`);env.registry.exaggerate.checked=false;}
// Analytic saddle h=k*x*z in millimetres. Expected rigid seating normals
// follow the tangent vectors (1,k*z/1000,0),(0,k*x/1000,1). For a portal the
// beam joins the two actual column tops; its direction is not guessed from Z.
function saddleExpected(kind,state,k,m,c){
 const sx=c.width/(m.w*.8),sz=c.depth/(m.d*.8),normal=(x,z)=>unit([-k*z/1000,1,-k*x/1000]),right=(x,z)=>unit([1,k*z/1000,0]);
 let tool,work,mark;
 if(kind==='compact'){
  const tx=0,tz=m.d*.29*sz,wx=0,wz=(-m.d*.1+.4*state.Y/100)*sz;
  tool=normal(tx,tz);work=normal(wx,wz);mark=right(tx,tz);
 }else if(kind==='travel'){
  const tx=(-.5+state.X/100)*sx,tz=m.d*.29*sz,wx=0,wz=-m.d*.18*sz;
  tool=normal(tx,tz);work=normal(wx,wz);mark=right(tx,tz);
 }else{
  const x=(m.columnX??m.w*.4)*sx,z=(kind==='gantry'?.7*state.X/100:(m.columnZ??0))*sz;
  const nL=normal(-x,z),nR=normal(x,z);
  const topL=add([-x,-k*x*z/1000,z],mul(nL,2.51)),topR=add([x,k*x*z/1000,z],mul(nR,2.51));
  tool=unit(add(nL,nR));mark=unit(sub(topR,topL));
  work=normal(0,kind==='double'?.7*state.X/100*sz:0);
 }
 return {axis:tool,normal:work,right:mark,readings:probeOracle(tool,work,mark)};
}
for(const kind of ['compact','travel','double','gantry']){
 open(kind);const m=env.json('current'),config=env.json('levelConfig');
 for(const k of [-.06,.06])for(const X of [-100,-.00001,0,.00001,100])for(const Y of [-100,100]){
  const state={...zero,X,Y,Z:X},expected=saddleExpected(kind,state,k,m,config);
  // Synthetic surface deliberately does not invoke compact Ritz bending or
  // the fixed-portal 15-point interpolant. Those are separate support tests.
  env.read(`globalThis.analyticSaddle={lr:0,fb:0,twist:${k},residual:.1,plane:{a:0,b:0,c:0},heightAt:(x,z)=>${k}*x*z,slopeAt:(x,z)=>({lr:${k}*z,fb:${k}*x}),hessianAt:()=>({xx:0,xz:${k},zz:0})};`);
  const actual=env.json(`spindleSweepGeometry(${JSON.stringify(state)},analyticSaddle,null)`);
  check(`analytic saddle ${kind}/${k}/${X}/${Y}: body/plane contact geometry`,()=>{
   assert.equal(actual.valid,true);vector(actual.measurement.axis,expected.axis,1e-12);vector(actual.tableNormal,expected.normal,1e-12);vector(values(actual.measurement),expected.readings);
  });
 }
}
// Real regular-grid interpolation must reproduce a bilinear saddle exactly.
// The travelling-column seat crosses the x=0 interpolation seam at X=50.
for(const kind of ['travel','gantry']){
 open(kind);const m=env.json('current'),config=env.json('levelConfig');
 for(const k of [-.06,.06])for(const X of [-100,0,49.99999,50,50.00001,100]){
  const state={...zero,X},expected=saddleExpected(kind,state,k,m,config);
  env.read(`positions=${JSON.stringify(state)};supportHeights=supports.map(s=>{const q=levelCoordinates(s.x,s.z);return ${k}*q.x*q.z;});updateLeveling();`);
  check(`real bilinear supports ${kind}/${k}/${X}`,()=>vector(env.json('spindleSweepGeometry().cardinal.map(p=>p.readingMicrons)'),expected.readings));
 }
}
// Actual supports: these exercise each real interpolation, compact bending,
// and separate fixed-portal seats without deriving expected values from it.
const integration=[];
for(const kind of ['compact','travel','double','gantry','five']){
 open(kind);
 check(kind+' ideal state is zero',()=>vector(env.json('spindleSweepGeometry().cardinal.map(p=>p.readingMicrons)'),[0,0,0,0]));
 for(const sign of [-1,1])for(const X of [-100,-.00001,0,.00001,100]){
  env.read(`positions={X:${X},Y:0,Z:${X},A:0,C:0};supportHeights=supports.map((s,i)=>${sign}*[.06,-.04,.01,-.02,.03,-.01][i%6]);updateLeveling();`);
  const actual=env.json('spindleSweepGeometry()');
  check(`actual support ${kind}/${sign}/${X}: finite and front-reference UI`,()=>{
   assert.equal(actual.valid,true);assert.equal(actual.cardinal[3].readingMicrons,0);
   actual.cardinal.forEach((p,i)=>{assert.ok(Number.isFinite(p.readingMicrons));const raw=env.registry['sweepValue'+i].getAttribute('data-reading-microns');if(actual.cardinal[3].onTable&&p.onTable)near(Number(raw),p.readingMicrons);else assert.equal(raw,'');});
   near(actual.cardinal[0].readingMicrons+actual.cardinal[2].readingMicrons,actual.cardinal[1].readingMicrons);
  });
  if(kind==='five')check(`three supports cannot create twist ${sign}/${X}`,()=>{near(env.read('levelSolution.twist'),0,1e-12);vector(values(actual.measurement),[0,0,0,0]);});
  if(X===0){
   const baseline=values(actual.measurement);env.read('supportHeights=supportHeights.map(h=>h+.01);updateLeveling();');
   check(`${kind}/${sign}: common support lift`,()=>vector(env.json('spindleSweepGeometry().cardinal.map(p=>p.readingMicrons)'),baseline));
   env.read('supportHeights=supportHeights.map(h=>h-.01);updateLeveling();');
   check(`${kind}/${sign}: reversing support operation`,()=>vector(env.json('spindleSweepGeometry().cardinal.map(p=>p.readingMicrons)'),baseline));
   const beforeView=env.json('spindleSweepGeometry()');env.registry.exaggerate.checked=true;env.read('yaw=1.12;sceneZoom=1.7;updateLeveling();');
   check(`${kind}/${sign}: camera zoom exaggeration`,()=>assert.deepEqual(env.json('spindleSweepGeometry()'),beforeView));env.registry.exaggerate.checked=false;
   integration.push({kind,sign,readingMicrons:baseline,onTable:actual.cardinal.map(p=>p.onTable)});
  }
 }
 // A plane shared by every seat must not be misreported as a relative twist.
 env.read('positions={X:0,Y:0,Z:0,A:0,C:0};supportHeights=supports.map(s=>{const q=levelCoordinates(s.x,s.z);return .02+.03*q.x-.02*q.z;});updateLeveling();');
 check(kind+' shared rigid seating plane',()=>vector(env.json('spindleSweepGeometry().cardinal.map(p=>p.readingMicrons)'),[0,0,0,0]));
}
open('five');
for(const A of [-100,-50,0,50,100])for(const C of [-100,0,100]){
 env.read(`positions.A=${A};positions.C=${C};updateLeveling();`);
 const a=.45*A/100,expected=[-.15*Math.tan(a)*1e6,-.3*Math.tan(a)*1e6,-.15*Math.tan(a)*1e6,0];
 check(`5-axis commanded tilt is not a machine error ${A}/${C}`,()=>vector(env.json('spindleSweepGeometry().cardinal.map(p=>p.readingMicrons)'),expected));
}
for(const kind of ['horizontal','lathe']){open(kind);check(kind+' remains excluded',()=>{assert.equal(env.read('supportsSpindleSweep()'),false);assert.equal(env.registry.spindleSweepPanel.hidden,true);});}
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log(JSON.stringify({checks,failures,integration},null,2));

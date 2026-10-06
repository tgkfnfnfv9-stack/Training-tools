'use strict';
// The oracle integrates the stated plate energy in closed form. Production
// uses Gauss quadrature; these expected values never call its bending solver.
const assert=require('node:assert/strict'),L=require('../src/leveling.js');
const makeEnvironment=require('./leveling-dom-env.cjs'),MA=require('../src/machine-accuracy.js');
let checks=0;const failures=[];
const check=(name,fn)=>{checks++;try{fn();}catch(error){failures.push(name+': '+error.message);}};
const near=(a,b,t=1e-8)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,`${a} != ${b}`);
const unit=v=>v.map(x=>x/Math.hypot(...v)),sub=(a,b)=>a.map((x,i)=>x-b[i]),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const vectorNear=(a,b,t=1e-8)=>a.forEach((x,i)=>near(x,b[i],t));
const angle=(a,b)=>-Math.asin(dot(unit(a),unit(b)))*3e5;
function closed(a,b,t,alpha=.5,nu=.3){
 const A=(16/(3*a**4)+32*(1-nu)/(3*a*a*b*b))*a*b;
 const B=(16/(5*a**4)+32*(1-2*nu)/(3*a*a*b*b))*a*b;
 const C=(16/(7*a**4)+128/(5*b**4)+(96-160*nu)/(5*a*a*b*b))*a*b;
 const f=-16*(1-nu)*alpha*t/(3*a*b),det=A*C-B*B;
 return {K:[[A,B],[B,C]],f:[f,f],q:[-(C-B)*f/det,-(A-B)*f/det],energy:q=>(A*q[0]**2+2*B*q[0]*q[1]+C*q[1]**2)/2+f*(q[0]+q[1])};
}
const corners=(a,b,heights)=>[[-a,-b],[a,-b],[-a,b],[a,b]].map(([x,z],i)=>({x,z,h:heights[i]}));
for(const [a,b] of [[1.04,1.08],[.25,10],[10,.25],[2.8,.55]])for(const alpha of [-.5,0,.5])for(const t of [-.125,0,.125]){
 const points=corners(a,b,[t,-t,-t,t]).map(p=>({...p,h:p.h+.037+.023*p.x-.017*p.z}));
 const base=L.solve(points),actual=L.compactBending(base,2*a,2*b,{asymmetry:alpha,poisson:.3}),m=actual.bending,o=closed(a,b,t,alpha);
 const tag=`${a}/${b}/${alpha}/${t}`;
 check('energy Hessian equals closed integral '+tag,()=>m.K.forEach((row,i)=>vectorNear(row,o.K[i],1e-8)));
 check('forcing equals closed integral '+tag,()=>vectorNear(m.forcing,o.f,1e-8));
 check('unique minimum coefficients '+tag,()=>{vectorNear([m.q1,m.q3],o.q,1e-10);assert.ok(o.K[0][0]>0&&o.K[0][0]*o.K[1][1]>o.K[0][1]**2);for(const d of [[.1,0],[0,.1],[-.1,.2]])assert.ok(o.energy(o.q.map((x,i)=>x+d[i]))>o.energy(o.q));});
 check('all support heights are exact '+tag,()=>points.forEach(p=>near(actual.heightAt(p.x,p.z),p.h,1e-10)));
 for(const [X,Z] of [[0,-.6],[.37,.49],[-.83,.72]]){
  const x=a*X,z=b*Z,h=.00003,expected=base.heightAt(x,z)+(1-X*X)*(o.q[0]*Z+o.q[1]*Z**3),s=actual.slopeAt(x,z),H=actual.hessianAt(x,z);
  check('height follows solved modes '+tag+'/'+X,()=>near(actual.heightAt(x,z),expected,1e-10));
  check('analytic slope agrees with independent surface difference '+tag+'/'+X,()=>{near(s.lr,(actual.heightAt(x+h,z)-actual.heightAt(x-h,z))/(2*h),1e-6);near(s.fb,(actual.heightAt(x,z+h)-actual.heightAt(x,z-h))/(2*h),1e-6);});
  check('analytic Hessian agrees with independent slope difference '+tag+'/'+X,()=>{near(H.xx,(actual.slopeAt(x+h,z).lr-actual.slopeAt(x-h,z).lr)/(2*h),1e-6);near(H.zz,(actual.slopeAt(x,z+h).fb-actual.slopeAt(x,z-h).fb)/(2*h),1e-6);near(H.xz,(actual.slopeAt(x,z+h).lr-actual.slopeAt(x,z-h).lr)/(2*h),1e-6);});
 }
 if(alpha===0)check('symmetric stiffness reduces to old bilinear geometry '+tag,()=>{near(m.q1,0);near(m.q3,0);near(actual.heightAt(.2*a,.4*b),base.heightAt(.2*a,.4*b));});
}
// All combinations at the legal height endpoints and midpoint. The problem
// is linear in support heights, so these also exercise superposition bounds.
for(let code=0;code<81;code++){
 let n=code;const heights=Array.from({length:4},()=>{const v=[-.5,0,.5][n%3];n=Math.floor(n/3);return v;});
 const points=corners(1.04,1.08,heights),base=L.solve(points),s=L.compactBending(base,2.08,2.16),t=(heights[0]-heights[1]-heights[2]+heights[3])/4,o=closed(1.04,1.08,t);
 check('four-support combination '+code,()=>{points.forEach(p=>near(s.heightAt(p.x,p.z),p.h));vectorNear([s.bending.q1,s.bending.q3],o.q);});
}

const e=makeEnvironment({pureLeveling:true});e.read('openMachine(machines[0]);');
const zero={X:0,Y:0,Z:0,A:0,C:0};
function surface(expr,state=zero,env=e){env.read(`positions=${JSON.stringify(state)};supportHeights=supports.map((s,i)=>{const q=levelCoordinates(s.x,s.z);return ${expr};});updateLeveling();`);}
const values=(env=e)=>env.json('levelGeometry.pairs.map(p=>p.deviationMicroradians*.3)');
function tangent(key,env=e){
 const state=env.json('positions'),p=[];
 for(const sign of [-1,1]){env.read(`positions.${key}=${state[key]+sign*.01};updateLeveling();`);p.push(env.json(key==='Z'?"levelMappedBodyVisualPoint(displayTransformedPoint([0,2,0],['Z'],current,positions,'tool'),'tool')":"levelMappedBodyVisualPoint(displayTransformedPoint([0,1.16,-current.d*.1],['X','Y'],current,positions,'work'),'work')"));}
 env.read(`positions=${JSON.stringify(state)};updateLeveling();`);return unit(sub(p[1],p[0]));
}
const axis=(key,env=e)=>unit(env.json(`displayAxisFrame('${key}').rotate(accuracyVisualVector('${key}'))`));
for(const gain of [false,true])for(const X of [-100,0,100])for(const Y of [-100,0,100]){
 e.registry.exaggerate.checked=gain;surface('i===2?.15:0',{...zero,X,Y});const d={};
 for(const key of ['X','Y','Z']){d[key]=tangent(key);check(`actual ${key} movement equals arrow ${gain}/${X}/${Y}`,()=>vectorNear(d[key],axis(key),3e-7));}
 if(!gain)for(const [i,pair]of ['XY','XZ','YZ'].entries())check(`actual drawn ${pair} angle equals metric ${X}/${Y}`,()=>near(angle(d[pair[0]],d[pair[1]]),values()[i],3e-5));
}
e.registry.exaggerate.checked=false;
surface('i===2?.01:0');const coarse=values();
// A first-order prediction is derived from the solved cubic mode and the
// two physical z stations. Its small higher-order rotation terms are bounded.
const a=1.04,b=1.08,q=closed(a,b,-.01/4).q;
const expectedYZ=300*3*q[1]/b*((.783/b)**2-(-.27/b)**2);
check('C coarse step has physically derived central YZ sensitivity',()=>near(coarse[2],expectedYZ,2e-6));
surface('i===2?-.01:0');check('reversing C reverses the leading YZ deformation',()=>near(values()[2],-expectedYZ,2e-6));
surface('i===2?.5:0');const high=values()[2];surface('i===2?-.5:0');const low=values()[2];
check('full C range creates central YZ response without gain fitting',()=>{near(high,expectedYZ*50,.003);near(low,-expectedYZ*50,.003);assert.ok(Math.abs(high-low)>2);});
surface('i===2?.01:0');e.read('supportHeights=supportHeights.map(h=>h+.27);updateLeveling();');check('uniform lift preserves all angles',()=>vectorNear(values(),coarse,1e-7));
surface('i===2?.01:0');check('support reversal restores angles',()=>vectorNear(values(),coarse));
surface('0');check('flat support has no manufactured errors',()=>values().forEach(v=>near(v,0)));

const live=makeEnvironment();live.read('openMachine(machines[0]);');
const profile=MA.generate('used',78129,['X','Y','Z'],4);live.read(`initializeMachineAccuracy(${JSON.stringify(profile)});`);
surface('0',zero,live);const intrinsic=values(live);
surface('.05+.13*q.x-.27*q.z',zero,live);check('common plane preserves intrinsic errors',()=>vectorNear(values(live),intrinsic,1e-7));
surface('.02*q.x*q.z',{...zero,X:36,Y:-42},live);const deformed=values(live);
surface('.02*q.x*q.z+.05+.13*q.x-.27*q.z',{...zero,X:36,Y:-42},live);check('common rotation preserves already deformed intrinsic errors',()=>vectorNear(values(live),deformed,1e-7));
for(const gain of [false,true]){
 live.registry.exaggerate.checked=gain;surface('.02*q.x*q.z',{...zero,X:36,Y:-42},live);
 for(const key of ['X','Y','Z'])check(`profile once in actual ${key} motion ${gain}`,()=>vectorNear(tangent(key,live),axis(key,live),3e-7));
 check(`visual exaggeration is absent from calculations ${gain}`,()=>vectorNear(values(live),deformed,1e-7));
}
const before=values(live),record=live.json('levelRecord()');
live.read('setTrainingMenuOpen(true);sceneZoom=1.7;yaw=.9;setTrainingMenuOpen(false);updateLeveling();');
check('camera and sidebar leave calculated and saved state unchanged',()=>{vectorNear(values(live),before);assert.deepEqual(live.json('levelRecord()'),record);});

const oldOtherSix=[[.9199999985078794,.0006993799993696259,4.06999999417705],[-.000071343999908735,3.6399999967867096,0],[48.374545402677406,0,0],[50.19991187076952,0,0],[0,0,0],[.000038639999989665835]];
for(let index=1;index<7;index++){
 e.read(`openMachine(machines[${index}]);`);surface('.02*q.x*q.z+.013*q.x-.017*q.z',{X:37,Y:-29,Z:18,A:0,C:0});
 check('other-machine published regression '+index,()=>vectorNear(e.json('levelGeometry.pairs.map(p=>p.deviationMicroradians)'),oldOtherSix[index-1],1e-8));
}
(async()=>{
 check('changed bending assumptions have their own model ID',()=>assert.equal(record.calculationModel,'compact-asymmetric-bending-v4'));
 surface('0',zero,live);live.read(`applyLevelRecord(${JSON.stringify(record)});updateLeveling();`);
 check('save reload reproduces all data and angles',()=>{assert.deepEqual(live.json('levelRecord()'),record);vectorNear(values(live),before);});
 for(const id of ['compact-table-path-v3','compact-saddle-v2','connected-frames-v1']){
  const bytes=JSON.stringify({...record,calculationModel:id}),key=live.read(`'training-level-${id}:'+current.id+':'+machineMode+(current.layoutId?':'+current.layoutId:'')`);live.storage.set(key,bytes);
  await live.registry.importLevel.onchange({target:{value:'old',files:[{size:bytes.length,text:async()=>bytes}]}});
  check(`${id} refuses silent reinterpretation`,()=>{assert.deepEqual(live.json('levelRecord()'),record);assert.match(live.registry.levelInputMessage.textContent,/旧|計算/);assert.equal(live.storage.get(key),bytes);});
 }
 console.log(JSON.stringify({checks,failures},null,2));if(failures.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});

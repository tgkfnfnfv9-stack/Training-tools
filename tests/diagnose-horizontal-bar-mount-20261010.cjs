'use strict';
// Trace the current a/b mounts, without inferring their owners from a sign
// table. Cylinder contact is independently solved by radial-distance bisection.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');process.chdir(root);
const env=require('./leveling-dom-env.cjs')({pureLeveling:true});
env.read("openMachine(machines.find(m=>m.kind==='horizontal'));machineReference=null;machineSavedBest=null;");
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,k)=>a.map(v=>v*k),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const local=(f,v)=>[f.right,f.up,f.back].map(axis=>dot(v,axis));
const checks=[],observations=[];let maxError=0;
function check(name,actual,expected,tolerance=1e-9){const error=Math.abs(actual-expected);maxError=Math.max(maxError,error);checks.push({name,actual,expected,error,tolerance});assert.ok(Number.isFinite(actual)&&error<=tolerance,`${name}: ${actual} != ${expected}`);}
function vector(name,actual,expected,tolerance=1e-10){actual.forEach((v,i)=>check(`${name}[${i}]`,v,expected[i],tolerance));}
function contact(body,probe,bar){
 const residual=t=>{const q=sub(add(body,mul(probe,t)),bar.origin),a=dot(q,bar.axis);return Math.hypot(...sub(q,mul(bar.axis,a)))-bar.radius;};
 let lo=0,hi=.02;assert.ok(residual(lo)>=0&&residual(hi)<=0,'external contact bracket');
 for(let i=0;i<65;i++){const t=(lo+hi)/2;if(residual(t)>0)lo=t;else hi=t;}return (lo+hi)/2;
}
function set(profile,pattern,state){
 env.read(`machineProfile=${profile?"window.MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length)":'null'};positions=${JSON.stringify(state)};supportHeights=supports.map((p,i)=>{const q=levelCoordinates(p.x,p.z);return ${pattern};});updateLeveling(false);`);
}
function capture(){return env.json(`(()=>{const m=horizontalParallelism(),axis=axisConfig(current).find(a=>a.key==='Z'),half=levelCoordinates(0,axis.amp).z;return {m,frames:m.a.samples.map(q=>{const s={...positions,Z:(m.startPosition+.3*q.t)/half*100};return {t:q.t,p:horizontalPalletPoint([0,1.27,-.85],s,levelSolution,machineProfile),f:referenceRigidFrame(geometryModel(s).workFrame),nose:horizontalSpindleFixture(s,levelSolution,machineProfile).nose};})};})()`);}
const patterns=['0','i===1?.001:0','i===1?-.001:0','i===1?.01:0','i===1?-.01:0','.01*q.x*q.z','-.01*q.x*q.z','i>=6?.01:0','i>=6?-.01:0'];
const states=[{X:0,Y:0,Z:0,A:0,C:0},{X:-100,Y:-100,Z:-100,A:0,C:0},{X:100,Y:100,Z:100,A:0,C:0},{X:57,Y:43,Z:-29,A:0,C:0}];
for(const profile of [false,true])for(const pattern of patterns)for(const state of states){
 set(profile,pattern,state);const {m,frames}=capture();assert.ok(m.valid);
 for(const f of frames)vector('bar nose stays fixed through table Z scan',f.nose,m.tool.nose);
 for(const key of ['a','b']){
  const row=m[key],first=row.samples[0],localArm=local(frames[0].f,sub(first.body,frames[0].p)),localProbe=local(frames[0].f,first.probe);
  // At the initial contact, a is on spindle-left and b below the bar.
  const radial=sub(first.body,m.bar.origin),outward=key==='a'?m.tool.right:m.tool.up;
  check(`${key} starts outside negative side`,dot(radial,outward),-.035,1e-10);vector(`${key} probe toward bar`,first.probe,outward);
  for(let i=0;i<row.samples.length;i++){
   const sample=row.samples[i],f=frames[i];
   vector(`${key} rigid bracket local coordinates`,local(f.f,sub(sample.body,f.p)),localArm);
   vector(`${key} rigid probe local coordinates`,local(f.f,sample.probe),localProbe);
   check(`${key} cylinder extension`,sample.extension,contact(sample.body,sample.probe,m.bar),1e-11);
  }
  const expected=(contact(first.body,first.probe,m.bar)-contact(row.last.body,row.last.probe,m.bar))*1e6;
  check(`${key} start zero`,row.zero.extension,.01,1e-10);check(`${key} compression-positive result`,row.microns,expected,3e-8);
  const displayed=env.read(`$('sweepValue${key==='a'?0:1}').textContent`),rounded=Math.floor(Math.abs(expected)+.5),expectedText=rounded?`${expected<0?'-':'+'}${rounded}`:'0';assert.equal(displayed,expectedText);
  observations.push({profile:profile?'used/123456':'ideal',pattern,state,key,rawMicrons:row.microns,displayed,independentMicrons:expected,zeroExtensionMm:first.extension*1000,lastExtensionMm:row.last.extension*1000,barOrigin:m.bar.origin,barAxis:m.bar.axis,localArm,localProbe,firstBody:first.body,lastBody:row.last.body});
 }
}
// Separate axis changes from the automatic remount performed for a new scan.
const motion={};for(const axis of ['Y','Z']){
 const captures=[];for(const value of [-100,0,100]){set(false,'0',{X:0,Y:0,Z:0,A:0,C:0,[axis]:value});captures.push({value,...capture()});}
 if(axis==='Z')for(const q of captures){vector('Z does not move spindle/bar',q.m.bar.origin,captures[0].m.bar.origin);vector('new Z start gets fresh mounting body',q.m.a.zero.body,captures[0].m.a.zero.body);}
 if(axis==='Y'){
  const delta=sub(captures[2].m.bar.origin,captures[0].m.bar.origin);vector('Y follows spindle +600 mm',delta,[0,.6,0]);
  vector('table datum stays fixed under Y',captures[2].m.palletOrigin,captures[0].m.palletOrigin);
  vector('fresh table arm is set at new bar height',sub(captures[2].m.a.zero.body,captures[0].m.a.zero.body),[0,.6,0]);
 }
 motion[axis]=captures.map(q=>({value:q.value,barOrigin:q.m.bar.origin,palletOrigin:q.m.palletOrigin,scanStart:q.m.startPosition,scanEnd:q.m.endPosition,aStartBody:q.m.a.zero.body,bStartBody:q.m.b.zero.body,a:q.m.a.microns,b:q.m.b.microns}));
}
const sourceFiles=['horizontal-parallelism.js','horizontal-parallelism-ui.js','spindle-sweep-ui.js'];
const output={scope:'Current horizontal test-bar ownership and remount tracing. Contact is independent radial-distance bisection; support/frame transport is taken from application and requires the separate independent ownership review.',states:patterns.length*states.length*2,checks:checks.length,maxError,sourceHashes:Object.fromEntries(sourceFiles.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync('src/'+f)).digest('hex')])),observations,motion};
fs.mkdirSync('docs/qa-horizontal-fixture-20261010',{recursive:true});fs.writeFileSync('docs/qa-horizontal-fixture-20261010/bar-mount.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({states:output.states,checks:checks.length,maxError,motion},null,2));

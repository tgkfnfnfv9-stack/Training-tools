'use strict';
// Independent fixture oracle. The input-to-support/assembly reconstruction was
// authored for the preceding audit; it does not call the application's pose,
// support solver, contact, or measurement functions. The NEW bore contact is
// obtained from 3-D point-to-line distance, using bisection (not its quadratic).
const fs=require('node:fs'),path=require('node:path');
const prior=require('./audit-independent-horizontal-lathe-20261011.cjs');
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(v,s)=>v.map(q=>q*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=v=>mul(v,1/Math.hypot(...v)),apply=(F,v)=>[0,1,2].map(i=>F.reduce((s,a,j)=>s+a[i]*v[j],0));
const mm=1e-3,um=1e-6;
function offsets(profile){let seed=((profile?.seed||0)^0x4c415431)>>>0;const a=[];for(let i=0;i<4;i++){seed=(1664525*seed+1013904223)>>>0;a.push(profile?(seed/2**32*2-1)*(profile.condition==='used'?30:10)*um:0);}return {face:a[0],flat:a[1],holeX:a[2],holeY:a[3]};}
function source(input){
 const g=prior.geometry(input),head=g.tool(input.state),work=g.work(input.state,[-.09,1.5,.20]),k=offsets(input.profile),mount=add(work.p,apply(work.F,[0,k.holeY,k.holeX])),axis=work.F[0],entry=add(mount,mul(axis,-.150));
 return {g,head,work,mount,axis,entry};
}
// A spherical tip has its centre 1 mm inward from a 25 mm internal wall.
// With the tip centre inside the bore, the first outward crossing is unique.
function sphereContact({body,probe,entry,axis,radius=.025,depth=.060,ball=.001,stroke=.020}){
 const distance=e=>Math.hypot(...cross(sub(add(body,mul(probe,e)),entry),axis)),target=radius-ball;
 if(Math.hypot(...cross(probe,axis))<1e-6)return {valid:false,reason:'parallel'};
 if(distance(0)>target+1e-12)return {valid:false,reason:'tip-body-outside'};
 if(distance(stroke)<target-1e-12)return {valid:false,reason:'stroke'};
 let lo=0,hi=stroke;for(let i=0;i<70;i++){const mid=(lo+hi)/2;if(distance(mid)>target)hi=mid;else lo=mid;}
 const extension=(lo+hi)/2,centre=add(body,mul(probe,extension)),axial=dot(sub(centre,entry),axis),radial=sub(sub(centre,entry),mul(axis,axial)),point=add(centre,mul(unit(radial),ball));
 if(axial<ball-1e-12||axial>depth-ball+1e-12)return {valid:false,reason:'depth',extension,centre,point,axial};
 return {valid:true,extension,centre,point,axial};
}
function fixture(input){const q=source(input),reach=dot(sub(add(q.entry,mul(q.axis,.030)),q.head.p),q.head.F[0]);return {reach,zeroExtension:null,setupState:{...input.state}};}
function measurement(input,held=null){
 const q=source(input),f=held||fixture(input),centre=add(q.head.p,mul(q.head.F[0],f.reach)),dirs=[q.head.F[2],q.head.F[1],mul(q.head.F[2],-1),mul(q.head.F[1],-1)];
 const samples=dirs.map(probe=>sphereContact({body:add(centre,mul(probe,.014)),probe,entry:q.entry,axis:q.axis}));
 const frameCos=dot(q.head.F[0],q.axis),frameSin=Math.hypot(...cross(q.head.F[0],q.axis)),lineDistance=p=>Math.hypot(...cross(sub(p,q.entry),q.axis)),carrierEnds=[-.003,.003].map(d=>add(centre,mul(q.head.F[0],d))),carrierRadial=Math.max(...carrierEnds.map(lineDistance))+.017,carrierAxial=dot(sub(centre,q.entry),q.axis),carrierMargin=.003*Math.abs(frameCos)+.017*frameSin;
 const shaftEntryReach=dot(sub(q.entry,q.head.p),q.axis)/frameCos,shaftEntry=add(q.head.p,mul(q.head.F[0],shaftEntryReach)),shaftRadial=Math.max(lineDistance(shaftEntry),lineDistance(centre))+.008/Math.abs(frameCos);
 const adapterLength=.32*q.g.S.sz,adapterSeatX=.16*q.g.S.sx,adapterSeatZ=.30*q.g.S.sz;
 const constraints={
  initial:held?.valid!==false,
  reach:f.reach>=.100-1e-12&&f.reach<=.350+1e-12,
  adapter:adapterLength>=.100-1e-12&&adapterLength<=.450+1e-12&&adapterSeatX>=.080-1e-12&&adapterSeatZ>=.080-1e-12,
  carrierRadial:carrierRadial<=.025+1e-12,
  carrierDepth:carrierAxial-carrierMargin>=-1e-12&&carrierAxial+carrierMargin<=.060+1e-12,
  shaft:frameCos>0&&shaftEntryReach>=0&&shaftEntryReach<=f.reach&&shaftRadial<=.025+1e-12,
  contacts:samples.every(s=>s.valid)
 },valid=Object.values(constraints).every(Boolean);
 const zero=held?.zeroExtension??samples[0]?.extension,readings=valid?samples.map(s=>(zero-s.extension)/um):null;
 return {valid,reason:valid?'':Object.keys(constraints).find(k=>!constraints[k]),fixture:{...f,valid:held?held.valid:valid,zeroExtension:zero},readings,dx:readings?(readings[2]-readings[0])/2:null,dy:readings?(readings[3]-readings[1])/2:null,samples,centre,entry:q.entry,axis:q.axis,reach:f.reach,source:q,constraints,clearance:{carrierRadial,carrierAxial,carrierMargin,shaftEntryReach,shaftRadial,adapterLength,adapterSeatX,adapterSeatZ}};
}
module.exports={source,fixture,measurement,sphereContact,round:prior.round};
function corpus(common,profile){
 const state={X:-.20/.35*100,Y:0,Z:-100,A:0,C:0},base={kind:'lathe',config:{...common.config},supports:common.supports,heights:common.supports.map(()=>0),state,profile},out=[];
 const addCase=(name,patch={})=>out.push({name,input:{...base,...patch}});
 addCase('setup');
 for(let i=0;i<base.supports.length;i++)for(const change of [-.100,-.010,-.001,.001,.010,.100])addCase(`support-${i}-${change}`,{heights:base.heights.map((h,j)=>i===j?change:0)});
 for(const X of [-100,state.X-.008/.35*100-1e-5,state.X-.008/.35*100+1e-5,state.X-.002/.35*100,state.X,state.X+.002/.35*100,state.X+.008/.35*100-1e-5,state.X+.008/.35*100+1e-5,0,100])for(const Z of [-100,-73.5714285714-1e-5,-73.5714285714+1e-5,0,100])addCase(`axis-${X}-${Z}`,{state:{...state,X,Z}});
 for(const width of [1.999999,2,2.000001,3.2,4,4.8])for(const depth of [.524999,.525,.525001,.8,1.68,2.362499,2.3625,2.362501])addCase(`dimension-${width}-${depth}`,{config:{...base.config,width,depth}});
 for(const [a,b,c] of [[.01,0,0],[0,.01,0],[.01,-.02,.5],[-.01,.02,-.5]])addCase(`rigid-${a}-${b}-${c}`,{heights:base.supports.map(s=>s.x*a+s.z*b+c)});
 for(const sign of [-1,1])for(const amount of [.01,.1,1])addCase(`twist-${sign}-${amount}`,{heights:base.supports.map(s=>s.x*s.z*sign*amount)});
 return out;
}
function summaryOnly(v){return {valid:v.valid,reason:v.reason,readings:v.readings,dx:v.dx,dy:v.dy,reach:v.reach,fixture:v.fixture,constraints:v.constraints,clearance:v.clearance,extensions:v.samples.map(s=>s.extension??null),contacts:v.samples.map(s=>({valid:s.valid,axial:s.axial??null,centre:s.centre??null,point:s.point??null}))};}
module.exports.corpus=corpus;
module.exports.summaryOnly=summaryOnly;
if(require.main===module){
 process.chdir(path.resolve(__dirname,'..'));
 const env=require('./leveling-dom-env.cjs')({pureLeveling:true});
 for(const file of ['lathe-inspection.js','lathe-inspection-ui.js'])env.read(fs.readFileSync('src/'+file,'utf8'));
 env.read("openMachine(machines.find(m=>m.kind==='lathe'));updateLatheInspectionUI=()=>{};");
 const common=env.json('({config:levelConfig,supports})'),rows=[],failures=[];let checks=0,maxErrorUm=0;
 const load=input=>env.read(`levelConfig=${JSON.stringify(input.config)};positions=${JSON.stringify(input.state)};machineProfile=${JSON.stringify(input.profile)};supportHeights=${JSON.stringify(input.heights)};updateLeveling(false);`);
 function compare(name,mode,actual,expected){
  const errors=[];checks++;if(Boolean(actual.valid)!==expected.valid)errors.push('validity');if(!expected.valid){checks++;if(actual.readings!==null)errors.push('invalid-readings-must-be-null');}
  if(expected.valid){for(let i=0;i<4;i++){checks++;const errorUm=actual.readings?.[i]-expected.readings[i];if(Number.isFinite(errorUm))maxErrorUm=Math.max(maxErrorUm,Math.abs(errorUm));if(!Number.isFinite(errorUm)||Math.abs(errorUm)>3e-6)errors.push('raw-'+i);checks++;if(prior.round(actual.readings?.[i])!==prior.round(expected.readings[i]))errors.push('integer-'+i);}}
  if(expected.valid){for(let i=0;i<4;i++){const a=actual.contacts?.[i],e=expected.samples[i];for(const [productKey,expectedKey] of [['sphereCentre','centre'],['point','point']])for(let j=0;j<3;j++){checks++;if(!Number.isFinite(a?.[productKey]?.[j])||Math.abs(a[productKey][j]-e[expectedKey][j])>3e-12)errors.push(`contact-${i}-${productKey}-${j}`);}checks++;if(Math.abs(a?.axial-e.axial)>3e-12)errors.push(`axial-${i}`);}}
  const row={name,mode,actual:{valid:actual.valid,reason:actual.reason,readings:actual.readings,dx:actual.dx,dy:actual.dy,reach:actual.reach??actual.fixture?.reach},expected:summaryOnly(expected),errors};rows.push(row);if(errors.length)failures.push(row);
 }
 const inputs={};
 for(const condition of ['ideal','new','used'])for(const seed of condition==='ideal'?[0]:[123456,41007]){
  const profile=condition==='ideal'?null:env.json(`window.MachineAccuracy.generate('${condition}',${seed},['X','Z'],6)`);
  for(const scenario of corpus(common,profile)){
   const input=scenario.input,name=`${condition}-${seed}-${scenario.name}`,zero={...input,heights:input.heights.map(()=>0)},initial=measurement(zero),remount=measurement(input);inputs[name]=input;
   load(zero);const actualFixture=env.json('latheBoreFixture()');
   load(input);const actual=env.json('latheBoreMeasurement()');compare(name,'remount-rezero',actual,remount);
   {const held=measurement(input,initial.fixture),heldActual=env.json(`latheBoreMeasurement(positions,levelSolution,machineProfile,${JSON.stringify(actualFixture)})`);compare(name,initial.valid?'held-original-zero':'invalid-initial-capture',heldActual,held);if(held.valid){const reset=measurement(input,{...initial.fixture,zeroExtension:held.samples[0].extension}),resetActual=env.json(`latheBoreMeasurement(positions,levelSolution,machineProfile,${JSON.stringify({...actualFixture,zeroExtension:heldActual.contacts?.[0]?.extension})})`);compare(name,'held-fixture-a-rezero-only',resetActual,reset);}}
  }
 }
 // An invalid initial capture has no zero to retain. After the support change
 // clears the interference, only a fresh setup may start a valid measurement.
 {const restored={kind:'lathe',config:{...common.config},supports:common.supports,heights:common.supports.map(()=>0),state:{X:-.20/.35*100+.007999/.35*100,Y:0,Z:-100,A:0,C:0},profile:null},blocked={...restored,heights:restored.heights.map((h,i)=>i===0?-.01:0)},initial=measurement(blocked);inputs['invalid-capture-blocked']=blocked;inputs['invalid-capture-restored']=restored;load(blocked);const initialActual=env.json('latheBoreFixture()');load(restored);compare('invalid-capture-restored','invalid-initial-does-not-revive',env.json(`latheBoreMeasurement(positions,levelSolution,machineProfile,${JSON.stringify(initialActual)})`),measurement(restored,initial.fixture));compare('invalid-capture-restored','fresh-setup-clears-invalid-initial',env.json('latheBoreMeasurement()'),measurement(restored));}
 const primitiveRows=[],API=require('../src/lathe-inspection.js');
 const primitiveCases=[];
 for(const axial of [-.001,.001-1e-9,.001,.030,.059,.059+1e-9,.061])primitiveCases.push({name:'finite-depth-'+axial,body:[axial,0,.014],probe:[0,0,1],entry:[0,0,0],axis:[1,0,0]});
 for(const extension of [0,.000000001,.010,.020,.020000001])primitiveCases.push({name:'finite-stroke-'+extension,body:[.030,0,.024-extension],probe:[0,0,1],entry:[0,0,0],axis:[1,0,0]});
 for(const tilt of [-.8,-.2,-.001,.001,.2,.8])for(const azimuth of [0,.4,1.2,2.4]){const axis=unit([1,tilt,tilt/2]),probe=[0,Math.sin(azimuth),Math.cos(azimuth)],entry=[-.04,.002,-.003],centre=add(entry,mul(axis,.030));primitiveCases.push({name:`inclined-${tilt}-${azimuth}`,body:add(centre,mul(probe,.014)),probe,entry,axis});}
 primitiveCases.push({name:'parallel',body:[.030,0,.014],probe:[1,0,0],entry:[0,0,0],axis:[1,0,0]});
 for(const c of primitiveCases){const expected=sphereContact(c),actual=API.internalCylinderContact({body:c.body,probe:c.probe,origin:c.entry,direction:c.axis}),errors=[];checks++;if(actual.valid!==expected.valid)errors.push('validity');if(expected.valid&&actual.valid){checks++;if(Math.abs(actual.extension-expected.extension)>3e-12)errors.push('extension');for(const [a,e] of [['sphereCentre','centre'],['point','point']])for(let i=0;i<3;i++){checks++;if(Math.abs(actual[a][i]-expected[e][i])>3e-12)errors.push(a+'-'+i);}}const row={...c,actual,expected,errors};primitiveRows.push(row);if(errors.length)failures.push({name:c.name,mode:'contact-boundary',actual,expected,errors});}
 const report={sourceHashes:Object.fromEntries(['src/lathe-inspection.js','src/lathe-inspection-ui.js','index.html'].map(file=>[file,require('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex')])),scope:'Saved input to independent support/assembly reconstruction; finite sphere/cylinder contact by 3-D distance bisection; carrier and shaft conservative envelopes independently derived from finite owner geometry. No production contact, pose, or support result is used as an expectation.',states:Object.keys(inputs).length,cases:rows.length,primitiveCases:primitiveRows.length,checks,maxErrorUm,failureCount:failures.length,failures,inputs,rows,primitiveRows};
 fs.mkdirSync('docs/qa-fixtures-20261011',{recursive:true});fs.writeFileSync('docs/qa-fixtures-20261011/lathe-independent-results.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({states:report.states,cases:rows.length,checks,maxErrorUm,failureCount:failures.length,firstFailures:failures.slice(0,4).map(r=>({name:r.name,mode:r.mode,errors:r.errors,actual:r.actual,expected:r.expected}))},null,2));if(failures.length)process.exitCode=1;
}

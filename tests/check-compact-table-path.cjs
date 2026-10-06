'use strict';
// Independent geometry checks for the fixed table-top measuring point P.
// Bilinear analytic expectations exercise the declared alpha=0 limit. The
// production alpha=.5 energy model is independently tested in compact-bending.
// The final six-machine fixture is only a pre-change regression comparison.
const assert=require('node:assert/strict');
const makeEnvironment=require('./leveling-dom-env.cjs');
const MachineAccuracy=require('../src/machine-accuracy.js');
let checks=0;const failures=[];
const check=(name,fn)=>{checks++;try{fn();}catch(error){failures.push(name+': '+error.message);}};
const near=(a,b,t=1e-7)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,`${a} != ${b}`);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const unit=a=>a.map(v=>v/Math.hypot(...a));
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const vectorNear=(a,b,t=1e-8)=>a.forEach((v,i)=>near(v,b[i],t));
const angle=(a,b)=>-Math.asin(Math.max(-1,Math.min(1,dot(unit(a),unit(b)))))*1e6;
const e=makeEnvironment({pureLeveling:true});
const open=(env,i=0)=>env.read(`openMachine(machines[${i}]);`);
const state={X:0,Y:0,Z:0,A:0,C:0};
function surface(expression,s=state,env=e){env.read(`positions=${JSON.stringify(s)};supportHeights=supports.map((s,i)=>{const q=levelCoordinates(s.x,s.z);return ${expression};});updateLeveling();`);}
const values=(env=e)=>env.json('levelGeometry.pairs.map(p=>p.deviationMicroradians)');
const direction=(key,env=e)=>env.json(`levelGeometry.directions.find(a=>a.key==='${key}').direction`);
function arrow(key,env=e){return unit(env.json(`(()=>{const a=axisIndicators(current,createGeometry(current)).find(a=>a.key==='${key}'),o=a.points[0].map((v,i)=>(v+a.points[1][i])/2),p=a.points.map(q=>levelAxisVisualPoint(q,o,a.pose,a.bodyOrigin,a.key));return p[1].map((v,i)=>v-p[0][i]);})()`));}
function drawnTangent(key,{height=.5,eps=.003,env=e}={}){
 const before=env.json('positions'),points=[];
 for(const sign of [-1,1]){
  env.read(`positions.${key}=${before[key]+sign*eps};updateLeveling();`);
  points.push(env.json(`levelMappedBodyVisualPoint(displayTransformedPoint([0,${.66+height},-current.d*.1],['X','Y'],current,positions,'work'),'work')`));
 }
 env.read(`positions=${JSON.stringify(before)};updateLeveling();`);
 return unit(sub(points[1],points[0]));
}

// Limit only the explicitly bilinear tests below to symmetric stiffness.
// Restore the production model before position/display/profile/save checks.
e.read(`const pathRegressionOriginalSolution=machineSolution;
 machineSolution=function(heights){if(current.kind!=='compact')return pathRegressionOriginalSolution(heights);
 const base=window.Leveling.solve(supports.map((s,i)=>({...levelCoordinates(s.x,s.z),h:heights[i]})));
 return window.Leveling.compactBending(base,levelConfig.width,levelConfig.depth,{asymmetry:0});};`);
open(e);e.registry.exaggerate.checked=false;
// h=k*x*z, x=0: a=k*z/1000, the table-top trajectory gives
// delta=atan(H*(k/1000)/(1+a*a)). The common plane is a rigid rotation.
for(const k of [-.02,0,.02])for(const Y of [-100,0,100]){
 surface(`${k}*q.x*q.z`,{...state,Y});
 const z=e.read('levelCoordinates(0,-current.d*.1+.4*positions.Y/100).z');
 const expected=Math.atan(.5*k/1000/(1+(k*z/1000)**2))*1e6;
 check(`analytic finite-height XY ${k}/${Y}`,()=>near(values()[0],expected,2e-5));
 check(`drawn P tangent gives same actual XY ${k}/${Y}`,()=>near(angle(drawnTangent('X'),drawnTangent('Y')),expected,2e-5));
}
surface('.02*q.x*q.z');
check('300 mm conversion of analytic twist is +3 micrometres',()=>near(values()[0]*.3,3,1e-7));
for(const height of [0,.5,1]){
 const actual=angle(drawnTangent('X',{height}),drawnTangent('Y',{height}));
 check(`Abbe contribution at height ${height} follows independently defined lever arm`,()=>near(actual,height*20,2e-5));
}

// A single lifted corner's mixed derivative comes from its rectangle area.
// Adjacent corners reverse its sign; the opposite corner retains its sign.
const corners=e.json('supports.map(s=>levelCoordinates(s.x,s.z))');
const spanX=Math.max(...corners.map(p=>p.x))-Math.min(...corners.map(p=>p.x));
const spanZ=Math.max(...corners.map(p=>p.z))-Math.min(...corners.map(p=>p.z));
for(let i=0;i<4;i++)for(const sign of [-1,1]){
 surface(`i===${i}?${sign*.01}:0`);
 const k=sign*.01*Math.sign(corners[i].x*corners[i].z)/(spanX*spanZ);
 check(`corner ${i} sign ${sign} gives signed bilinear term`,()=>near(values()[0]*.3,.5*k*300,2e-5));
}
surface('i===0?.01:0');
check('one coarse A step can legitimately round to zero micrometres',()=>{near(Math.abs(values()[0]*.3),.333865,2e-5);assert.equal(e.read('squarenessMicronText(levelGeometry.pairs[0].deviationMicroradians*.3)'), '0');});
const adjusted=values();
e.read('supportHeights=supportHeights.map(h=>h+.27);updateLeveling();');
check('common height lift cannot alter any angle',()=>vectorNear(values(),adjusted,2e-6));
surface('i===0?.01:0');check('reversing a common lift restores every angle',()=>vectorNear(values(),adjusted));
surface('0');check('reversing the corner adjustment restores zero errors',()=>values().forEach(v=>near(v,0)));
e.read('machineSolution=pathRegressionOriginalSolution;updateLeveling();');

for(const dims of [[2.72,2.16],[1.4,4.2],[5.6,1.1]])for(const gain of [false,true]){
 e.read(`levelConfig.width=${dims[0]};levelConfig.depth=${dims[1]};`);e.registry.exaggerate.checked=gain;
 for(const s of [{...state,X:-67,Y:-81},{...state,X:0,Y:0},{...state,X:74,Y:86}]){
  surface('.02*q.x*q.z',s);const metric=values();
  for(const key of ['X','Y']){
   check(`drawn P derivative matches ${key} arrow ${dims}/${gain}/${s.X}`,()=>vectorNear(drawnTangent(key),arrow(key),2e-7));
   const physicalGain=e.registry.exaggerate.checked;e.registry.exaggerate.checked=false;e.read('updateLeveling();');
   check(`physical P derivative matches calculated ${key} ${dims}/${gain}/${s.X}`,()=>vectorNear(drawnTangent(key),direction(key),2e-7));
   e.registry.exaggerate.checked=physicalGain;e.read('updateLeveling();');
  }
  check(`gain is absent from metric ${dims}/${gain}/${s.X}`,()=>vectorNear(values(),metric));
  const coarse=drawnTangent('Y',{eps:.01}),fine=drawnTangent('Y',{eps:.001});
  check(`independent derivative converges ${dims}/${gain}/${s.X}`,()=>vectorNear(coarse,fine,3e-7));
 }
}

const live=makeEnvironment();open(live);
const profile=MachineAccuracy.generate('used',78129,['X','Y','Z'],4);
live.read(`initializeMachineAccuracy(${JSON.stringify(profile)});`);
surface('0',state,live);const intrinsic=values(live);
for(const expression of ['.037','.037+.13*q.x-.27*q.z','.02*q.x+.03*q.z']){
 surface(expression,state,live);
 check(`proper common-plane rotation preserves intrinsic errors ${expression}`,()=>vectorNear(values(live),intrinsic,1e-6));
}
surface('.02*q.x*q.z',{...state,X:37,Y:-41},live);const deformed=values(live);
surface('.02*q.x*q.z+.07+.13*q.x-.27*q.z',{...state,X:37,Y:-41},live);
check('common rigid rotation also preserves already deformed intrinsic geometry',()=>vectorNear(values(live),deformed,2e-6));
const trends=[];
for(const sign of [-1,1]){
 const simple={squareness:{XY:{microns:sign*100},XZ:{microns:0},YZ:{microns:0}}};
 surface('0');const before=e.read(`geometryModel(positions,levelSolution,${JSON.stringify(simple)}).pairs[0].deviationMicroradians`);
 surface('.02*q.x*q.z');const after=e.read(`geometryModel(positions,levelSolution,${JSON.stringify(simple)}).pairs[0].deviationMicroradians`);
 trends.push(Math.abs(after)-Math.abs(before));
}
check('the same support operation improves or worsens depending on intrinsic error',()=>assert.ok(trends[0]*trends[1]<0));
for(const gain of [false,true]){
 live.registry.exaggerate.checked=gain;surface('.02*q.x*q.z',{...state,X:47,Y:-62},live);
 for(const key of ['X','Y'])check(`intrinsic and support combine once in drawn ${key} ${gain}`,()=>vectorNear(drawnTangent(key,{env:live}),arrow(key,live),2e-7));
}
live.registry.exaggerate.checked=false;surface('0',state,live);
const configured=live.json('window.MachineAccuracy.directions(axisConfig(current).filter(a=>["X","Y","Z"].includes(a.key)),machineProfile)');
for(const pair of [['X','Y'],['X','Z'],['Y','Z']])check(`flat intrinsic ${pair} applied exactly once`,()=>near(live.read(`levelGeometry.pairs.find(p=>p.key==='${pair.join('')}').deviationMicroradians`),angle(configured.find(a=>a.key===pair[0]).vector,configured.find(a=>a.key===pair[1]).vector),1e-6));

// Values captured on the last published calculation model before this change.
// These are compatibility fixtures, not evidence of real-machine accuracy.
const oldOtherSix=[[.9199999985078794,.0006993799993696259,4.06999999417705],[-.000071343999908735,3.6399999967867096,0],[48.374545402677406,0,0],[50.19991187076952,0,0],[0,0,0],[.000038639999989665835]];
for(let index=1;index<7;index++){
 open(e,index);surface('.02*q.x*q.z+.013*q.x-.017*q.z',{X:37,Y:-29,Z:18,A:0,C:0});
 check(`other machine ${index} keeps published numerical behavior`,()=>vectorNear(values(),oldOtherSix[index-1],1e-8));
}

(async()=>{
 open(live);surface('.02*q.x*q.z',{...state,X:41,Y:-53},live);
 const saved=live.json('levelRecord()'),before=values(live);
 check('new bending semantics have a distinct calculation identity',()=>assert.equal(saved.calculationModel,'compact-asymmetric-bending-v4'));
 surface('0',state,live);live.read(`applyLevelRecord(${JSON.stringify(saved)});updateLeveling();`);
 check('save restores exact data and trajectory angles',()=>{assert.deepEqual(live.json('levelRecord()'),saved);vectorNear(values(live),before,1e-7);});
 for(const id of ['compact-table-path-v3','compact-saddle-v2','connected-frames-v1']){
  live.read(`applyLevelRecord(${JSON.stringify(saved)});updateLeveling();`);
  const old={...saved,calculationModel:id},bytes=JSON.stringify(old),key=live.read(`'training-level-${id}:'+current.id+':'+machineMode+(current.layoutId?':'+current.layoutId:'')`);
  live.storage.set(key,bytes);
  await live.registry.importLevel.onchange({target:{value:'old',files:[{size:bytes.length,text:async()=>bytes}]}});
  check(`${id} import is refused without changing current state`,()=>{assert.deepEqual(live.json('levelRecord()'),saved);assert.match(live.registry.levelInputMessage.textContent,/旧|計算/);});
  open(live);check(`${id} storage remains byte-for-byte intact`,()=>assert.equal(live.storage.get(key),bytes));
 }
 console.log(JSON.stringify({checks,failures},null,2));if(failures.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});

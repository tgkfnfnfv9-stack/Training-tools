'use strict';
// Scope/serialization regression against an immutable commit archive. This is
// deliberately not a physics oracle for the newly arranged horizontal YZ test.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const [mode,rootArg,outArg,legacyArg]=process.argv.slice(2);
const root=path.resolve(rootArg||'.'),out=path.resolve(outArg||'/tmp/fixture-compatibility.json');
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
if(mode==='compare'){
 const before=JSON.parse(fs.readFileSync(root)),after=JSON.parse(fs.readFileSync(out)),failures=[];
 const check=(label,a,b)=>{if(hash(a)!==hash(b))failures.push({label,before:a,after:b});};
 const allowedSourceChanges=['src/reference-measurement-ui.js','src/spindle-sweep-ui.js','src/horizontal-parallelism-ui.js','src/index.html'];
 for(const file of Object.keys(before.sourceHashes).filter(f=>!allowedSourceChanges.includes(f)))check('protected source/'+file,before.sourceHashes[file],after.sourceHashes[file]);
 assert.equal(after.cases.length,before.cases.length);
 for(let i=0;i<before.cases.length;i++){
  const a=before.cases[i],b=after.cases[i],label=[a.id,a.used,a.pattern,a.state,a.exaggerated].join('/');
  for(const key of ['input','meshHash','worldHash','physicalHash','uiHash','protectedReadings'])check(label+'/'+key,a[key],b[key]);
 }
 check('seed/intrinsic cases',before.profiles,after.profiles);check('schema',before.schema,after.schema);
 assert.equal(after.legacy.length,7);
 for(const loaded of after.legacy){
  assert.ok(loaded.accepted&&loaded.exactInput&&loaded.unchangedSeed,loaded.id+' old input restore');
  const old=before.saved.find(s=>s.record.machine===loaded.id);
  // The synthetic states contain all five UI axis keys, while serialization
  // correctly includes only a machine's real axes. Unimplemented lathe Y/A/C
  // have no geometric effect and reset to zero on import; do not call their
  // diagnostic copies in xStart/zStart a changed measurement.
  const normalized=value=>{const copy=JSON.parse(JSON.stringify(value));if(copy.lathe)for(const field of ['xStart','xEnd','zStart','zEnd'])copy.lathe[field]=Object.fromEntries(Object.entries(copy.lathe[field]).filter(([key])=>Object.hasOwn(old.record.axisPositions,key)));return copy;};
  check(loaded.id+'/legacy protected readings',normalized(old.protectedReadings),normalized(loaded.protectedReadings));
 }
 const yz=after.cases.filter(s=>s.id==='horizontal').map(s=>{const old=before.cases.find(t=>t.id===s.id&&t.used===s.used&&t.pattern===s.pattern&&t.state===s.state&&t.exaggerated===s.exaggerated);return {used:s.used,pattern:s.pattern,state:s.state,exaggerated:s.exaggerated,before:old.yz,after:s.yz};});
 const summary={states:after.cases.length,otherFiveStates:240,latheStates:48,horizontalProtectedStates:48,legacyImports:after.legacy.length,profileCases:after.profiles.length,allowedSourceChanges,changedSources:Object.keys(before.sourceHashes).filter(f=>before.sourceHashes[f]!==after.sourceHashes[f]),failures,legacyYZ:after.legacy.find(s=>s.id==='horizontal')?.yz,yz};
 fs.writeFileSync(path.join(path.dirname(out),'compatibility-comparison.json'),JSON.stringify(summary,null,2));
 assert.deepEqual(failures,[],'scope violation (see compatibility-comparison.json for concrete values/hashes)');
 console.log(JSON.stringify({...summary,yz:undefined},null,2));process.exit(0);
}
assert.equal(mode,'capture');process.chdir(root);
const sourceHashes=()=>Object.fromEntries(fs.readdirSync('src').sort().filter(f=>fs.statSync('src/'+f).isFile()).map(f=>['src/'+f,crypto.createHash('sha256').update(fs.readFileSync('src/'+f)).digest('hex')]));
const started=new Date().toISOString(),sourceBefore=sourceHashes();
const env=require(path.join(root,'tests/leveling-dom-env.cjs'))({pureLeveling:true});
for(const file of ['intrinsic-inspection.js','lathe-inspection.js','lathe-inspection-ui.js'])env.read(fs.readFileSync('src/'+file,'utf8'));
// Only extend the light DOM harness's selector convenience. No production
// measuring, geometry, support, seed, save, or display code is replaced.
env.body.constructor.prototype.querySelector=function(selector){return this.querySelectorAll(selector)[0]||null;};
const ids=['vertical','travel','gate','gantry','five','lathe','horizontal'];
const cases=[],profiles=[],saved=[],schema=[],legacy=[];
const states=[{X:0,Y:0,Z:0,A:0,C:0},{X:-100,Y:100,Z:-100,A:-100,C:100},{X:37,Y:-62,Z:81,A:45,C:-33}];
const patterns=['0','i===1?.01:0','.01*q.x*q.z','.02*q.x-.03*q.z+.01'];
const protectedReadings=()=>env.json(`(()=>{
 const g=geometryModel(),pairs=g.pairs.filter(p=>current.kind!=='horizontal'||p.key!=='YZ').map(p=>{const q=referenceDisplayScan(p);return {key:p.key,valid:q.valid,raw:q.microns??null,text:q.valid?squarenessMicronText(q.microns):'—'};});
 if(current.kind==='lathe'){const d=latheInspectionGeometry();return {lathe:d,intrinsic:window.IntrinsicInspection.fromProfile(machineProfile)};}
 if(current.kind==='horizontal'){const p=horizontalParallelism();return {pairs,parallel:{a:{valid:p.a.valid,raw:p.a.microns??null,text:p.a.valid?spindleSweepReading(p.a.microns):'—'},b:{valid:p.b.valid,raw:p.b.microns??null,text:p.b.valid?spindleSweepReading(p.b.microns):'—'}},intrinsic:window.IntrinsicInspection.fromProfile(machineProfile)};}
 return {pairs,sweep:spindleSweepGeometry(positions,levelSolution,machineProfile,1,current.kind==='compact'),intrinsic:window.IntrinsicInspection.fromProfile(machineProfile)};
})()`);
const yz=()=>env.json(`(()=>{if(current.kind!=='horizontal')return null;const r=referenceDisplayScan(geometryModel().pairs.find(p=>p.key==='YZ'));return {valid:r.valid,raw:r.microns??null,text:r.valid?squarenessMicronText(r.microns):'—',setup:r.setup,model:r.model};})()`);
function refresh(){env.read("updateAxisValues();updateLeveling(false);if(current.kind==='lathe')updateLatheInspectionUI();");}
for(const id of ids){
 env.read(`openMachine(machines.find(m=>m.id===${JSON.stringify(id)}));`);
 for(const used of [false,true]){
  env.read(`machineProfile=${used?"window.MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length)":'null'};machineReference=null;machineSavedBest=null;`);
  for(let pattern=0;pattern<patterns.length;pattern++)for(let state=0;state<states.length;state++)for(const exaggerated of [false,true]){
   env.read(`positions=${JSON.stringify(states[state])};supportHeights=supports.map((p,i)=>{const q=levelCoordinates(p.x,p.z);return Math.round((${patterns[pattern]})*1000)/1000;});$('exaggerate').checked=${exaggerated};`);refresh();
   const input=env.json('({supportHeights,positions,levelConfig,machineProfile})');
   const mesh=env.json('createGeometry(current)');
   const world=env.json('(()=>{const g=createGeometry(current);return {faces:g.faces.map(f=>f.v.map(p=>displayedModelPoint(p,f.axes,current,positions,f.pose))),labels:g.labels.map(l=>({name:l.name,p:displayedModelPoint(l.p,l.axes,current,positions,l.pose)}))};})()');
   const physical=env.json(`({g:geometryModel(),evaluation:machineEvaluation(supportHeights),scan:current.kind==='horizontal'?null:geometryModel().pairs.map(p=>({key:p.key,physical:referenceScan(p),display:referenceDisplayScan(p)})),extra:current.kind==='lathe'?latheInspectionGeometry():current.kind==='horizontal'?null:spindleSweepGeometry(positions,levelSolution,machineProfile,1,current.kind==='compact')})`);
   // Horizontal fixture descriptions/pictures may change; protected horizontal
   // values and all 3D vertices are compared separately. Six other UIs match.
   const ui=id==='horizontal'?null:env.json(`Object.fromEntries(['liveSquareness','accuracyDiagram','accuracyMetrics','finePrecisionSummary','geometryStatus','lr','fb','twist','residual','latheInspectionSecond','measurementReferenceCards','sweepMeasurementNote','spindleSweepMini','sweepValue0','sweepValue1','sweepValue2','sweepValue3','sweepContactStatus'].filter(id=>$(id)).map(id=>[id,{text:$(id).textContent,markup:$(id).innerHTML,hidden:$(id).hidden,attrs:$(id).attrs}]))`);
   cases.push({id,used,pattern,state,exaggerated,input,meshHash:hash(mesh),worldHash:hash(world),physicalHash:hash(physical),uiHash:hash(ui),protectedReadings:protectedReadings(),yz:yz()});
  }
 }
 console.log(JSON.stringify({captured:id,states:cases.length}));
}
const machineSource=fs.readFileSync('src/machine-accuracy-ui.js','utf8');env.read(machineSource.slice(machineSource.indexOf('function initializeMachineAccuracy('),machineSource.indexOf('function machineSolution(')));
for(const id of ids){
 env.read(`openMachine(machines.find(m=>m.id===${JSON.stringify(id)}));machineProfile=window.MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length);machineReference=null;machineSavedBest=null;positions={X:37,Y:-62,Z:81,A:45,C:-33};supportHeights=supports.map((p,i)=>i===1?.013:i===2?-.017:0);$('exaggerate').checked=false;$('adjustStep').value='0.001';`);refresh();
 const record=env.json('levelRecord()');assert.equal(env.read('validLevelRecord(levelRecord())'),true,id+' save valid');
 saved.push({record,protectedReadings:protectedReadings(),yz:yz()});schema.push({id,keys:Object.keys(record).sort(),version:record.version,model:record.calculationModel,profileKeys:Object.keys(record.machineProfile).sort(),axisKeys:Object.keys(record.axisPositions)});
 for(const condition of ['new','used'])for(const seed of [0,123456,4294967295])profiles.push({id,condition,seed,value:env.json(`(()=>{const profile=window.MachineAccuracy.generate('${condition}',${seed},machineLinearKeys(),supports.length);return {profile,intrinsic:window.IntrinsicInspection.fromProfile(profile)};})()`)});
 const profile=env.json('machineProfile'),heights=env.json('supportHeights');
 env.read("selected=1;trainingMenuOpen=false;$('raiseSupport').onclick();");assert.notDeepEqual(env.json('supportHeights'),heights,id+' support operation really changes input');assert.deepEqual(env.json('machineProfile'),profile,id+' support operation does not reroll');
 env.read("$('lowerSupport').onclick();");assert.deepEqual(env.json('supportHeights'),heights,id+' support roundtrip');
}
if(legacyArg){
 for(const old of JSON.parse(fs.readFileSync(path.resolve(legacyArg))).saved){const record=old.record;
  env.read(`openMachine(machines.find(m=>m.id===${JSON.stringify(record.machine)}));`);const accepted=env.read(`validLevelRecord(${JSON.stringify(record)})`);assert.equal(accepted,true,record.machine+' old record accepted');
  env.read(`applyLevelRecord(${JSON.stringify(record)});`);refresh();const restored=env.json('levelRecord()'),state=r=>Object.fromEntries(Object.entries(r).filter(([k])=>k!=='bestState'));
  legacy.push({id:record.machine,accepted,exactInput:hash(state(restored))===hash(state(record)),unchangedSeed:restored.machineProfile.seed===record.machineProfile.seed,protectedReadings:protectedReadings(),yz:yz()});
 }
}
const sourceAfter=sourceHashes();assert.deepEqual(sourceAfter,sourceBefore,'production source unchanged while capturing');
const result={root,started,finished:new Date().toISOString(),sourceHashes:sourceBefore,cases,profiles,schema,saved,legacy};fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2));
console.log(JSON.stringify({output:out,states:cases.length,saved:saved.length,profiles:profiles.length,legacy:legacy.length}));

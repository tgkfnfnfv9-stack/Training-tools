'use strict';
// Scope regression, not a physics oracle: preserve the five out-of-scope
// machines exactly, and restore the input state of legacy JSON records.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const [mode,rootArg,outArg,legacyArg]=process.argv.slice(2);
const root=path.resolve(rootArg||'.'),out=path.resolve(outArg||'/tmp/posture-compatibility.json');
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
if(mode==='compare'||mode==='compare-inputs'){
 const before=JSON.parse(fs.readFileSync(root)),after=JSON.parse(fs.readFileSync(out));
 if(mode==='compare')assert.deepEqual(after.regression,before.regression,'other five raw values, displayed geometry, UI markup and input state unchanged');
 assert.deepEqual(after.profiles,before.profiles,'same seed produces exactly the same fixed individual');
 assert.deepEqual(after.schema,before.schema,'saved input schema and calculation model compatibility retained');
 assert.equal(after.legacy.length,7,'all seven legacy records imported');
 assert.ok(after.legacy.every(r=>r.accepted&&r.exactInput&&r.unchangedSeed),'old JSON restores input/seed exactly');
 console.log(JSON.stringify({otherFiveCases:after.regression.length,legacyImports:after.legacy.length,profileCases:after.profiles.length,exactlyUnchanged:true},null,2));
 process.exit(0);
}
assert.ok(['capture','capture-inputs'].includes(mode));process.chdir(root);
const env=require(path.join(root,'tests/leveling-dom-env.cjs'))({pureLeveling:true});
for(const file of ['intrinsic-inspection.js','lathe-inspection.js','lathe-inspection-ui.js'])env.read(fs.readFileSync('src/'+file,'utf8'));
// The DOM harness has no canvas; numeric/markup inspection does not call its
// rendering hooks. All 3D vertices are nevertheless transformed below.
const ids=['vertical','travel','gate','gantry','five'];
const regression=[],profiles=[],saved=[],schema=[],legacy=[];
const states=[{X:0,Y:0,Z:0,A:0,C:0},{X:-100,Y:100,Z:-100,A:-100,C:100},{X:37,Y:-62,Z:81,A:45,C:-33}];
const patterns=['0','i===1?.01:0','.01*q.x*q.z','.02*q.x-.03*q.z+.01'];
for(const id of mode==='capture'?ids:[]){
 env.read(`openMachine(machines.find(m=>m.id===${JSON.stringify(id)}));`);
 for(const used of [false,true]){
  env.read(`machineProfile=${used?"window.MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length)":'null'};machineReference=null;machineSavedBest=null;`);
  for(let pattern=0;pattern<patterns.length;pattern++)for(let state=0;state<states.length;state++)for(const exaggerated of [false,true]){
   env.read(`positions=${JSON.stringify(states[state])};supportHeights=supports.map((p,i)=>{const q=levelCoordinates(p.x,p.z);return Math.round((${patterns[pattern]})*1000)/1000;});$('exaggerate').checked=${exaggerated};updateAxisValues();updateLeveling(false);`);
   const input=env.json('({supportHeights,positions,levelConfig,machineProfile})');
   const geometry=env.json('createGeometry(current)');
   const displayed=env.json('(()=>{const g=createGeometry(current);return {faces:g.faces.map(f=>f.v.map(p=>displayedModelPoint(p,f.axes,current,positions,f.pose))),labels:g.labels.map(l=>({name:l.name,p:displayedModelPoint(l.p,l.axes,current,positions,l.pose)}))};})()');
   const numeric=env.json('({g:geometryModel(),evaluation:machineEvaluation(supportHeights),scan:geometryModel().pairs.map(p=>({key:p.key,physical:referenceScan(p),display:referenceDisplayScan(p)}))})');
   const ui=env.json(`Object.fromEntries(['liveSquareness','accuracyDiagram','accuracyMetrics','finePrecisionSummary','bodyLean','geometryStatus','lr','fb','twist','residual'].filter(id=>$(id)).map(id=>[id,{text:$(id).textContent,markup:$(id).innerHTML}]))`);
   regression.push({id,used,pattern,state,exaggerated,input,geometryHash:hash(geometry),displayedHash:hash(displayed),numericHash:hash(numeric),uiHash:hash(ui)});
  }
 }
 console.log(JSON.stringify({captured:id,cases:regression.length}));
}
// Keep real restore behavior for JSON checks; opening machines remains ideal.
env.read(fs.readFileSync('src/machine-accuracy-ui.js','utf8').slice(fs.readFileSync('src/machine-accuracy-ui.js','utf8').indexOf('function initializeMachineAccuracy('),fs.readFileSync('src/machine-accuracy-ui.js','utf8').indexOf('function machineSolution(')));
for(const id of [...ids,'horizontal','lathe']){
 env.read(`openMachine(machines.find(m=>m.id===${JSON.stringify(id)}));machineProfile=window.MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length);machineReference=null;machineSavedBest=null;positions={X:37,Y:-62,Z:81,A:45,C:-33};supportHeights=supports.map((p,i)=>i===1?.013:i===2?-.017:0);$('exaggerate').checked=false;$('adjustStep').value='0.001';updateAxisValues();updateLeveling(false);`);
 const record=env.json('levelRecord()');
 assert.equal(env.read(`validLevelRecord(${JSON.stringify(record)})`),true,id+' save is valid');
 saved.push(record);schema.push({id,keys:Object.keys(record).sort(),version:record.version,model:record.calculationModel,profileKeys:Object.keys(record.machineProfile).sort(),axisKeys:Object.keys(record.axisPositions)});
 for(const condition of ['new','used'])for(const seed of [0,123456,4294967295])profiles.push({id,condition,seed,value:env.json(`window.MachineAccuracy.generate('${condition}',${seed},machineLinearKeys(),supports.length)`)});
 const profile=env.json('machineProfile');
 env.read("selected=1;trainingMenuOpen=false;$('raiseSupport').onclick();$('lowerSupport').onclick();");
 assert.deepEqual(env.json('machineProfile'),profile,id+' supports do not redraw the individual');
}
if(legacyArg){
 for(const record of JSON.parse(fs.readFileSync(path.resolve(legacyArg))).saved){
  env.read(`openMachine(machines.find(m=>m.id===${JSON.stringify(record.machine)}));`);
  const accepted=env.read(`validLevelRecord(${JSON.stringify(record)})`);
  assert.equal(accepted,true,record.machine+' legacy input accepted');
  env.read(`applyLevelRecord(${JSON.stringify(record)});updateLeveling(false);`);
  const restored=env.json('levelRecord()');
  // bestState may improve under a corrected measurement. It is a candidate
// support arrangement, never a stored measurement or frozen objective.
  const state=r=>Object.fromEntries(Object.entries(r).filter(([k])=>k!=='bestState'));
  legacy.push({id:record.machine,accepted,exactInput:hash(state(restored))===hash(state(record)),unchangedSeed:restored.machineProfile.seed===record.machineProfile.seed});
 }
}
const result={root,regression,profiles,schema,saved,legacy};fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2));
console.log(JSON.stringify({output:out,cases:regression.length,saved:saved.length,profiles:profiles.length,legacy:legacy.length}));

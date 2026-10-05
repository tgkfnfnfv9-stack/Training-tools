'use strict';
// Exercise the visible support controls and relocated settings through their
// DOM events. Drawer state is viewing state; imported legacy step values are
// preserved until the first visible adjustment adopts the selected stage's
// fixed step. Hidden compatibility controls keep their previous contract.
const assert=require('node:assert/strict');
const {registry:r,read,json,storage,context,downloads}=require('./leveling-dom-env.cjs')();
const variants=[[0,'compact'],[1,''],[2,''],[3,'l3-3000'],[4,''],[5,''],[6,'']];
const result={checks:{drawerState:0,supportSelection:0,stageSteps:0,limits:0,axisControls:0,demo:0,saveImportExport:0,legacyStep:0,settings:0},failures:[]};
let name='',seed=79120,sequence=0;
let shellWidth=390,shellHeight=640;r.trainingShell.getBoundingClientRect=()=>({width:shellWidth,height:shellHeight});
context.window.crypto={getRandomValues(values){values[0]=seed++;return values;}};
const frames=new Map();context.requestAnimationFrame=fn=>{frames.set(++sequence,fn);return sequence;};context.cancelAnimationFrame=id=>frames.delete(id);
function tick(time){const pending=[...frames.values()];frames.clear();for(const fn of pending)fn(time);}
function check(kind,fn){try{fn();result.checks[kind]++;}catch(e){result.failures.push({kind,name,message:e.message});}}
function near(actual,expected,tolerance=1e-9){assert(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);}
function snapshot(){return json('({record:levelRecord(),solution:levelSolution,geometry:levelGeometry,initialGeometry:levelInitialGeometry,initialSolution:levelInitialSolution,range:accuracyRange,profile:machineProfile,reference:machineReference,best:machineSavedBest,fineStart:fineStartEvaluation,stage:adjustmentStage,positions,supportHeights,levelConfig})');}
function record(){return json('levelRecord()');}
function identity(){return json('({profile:machineProfile,initialHeights:machineProfile.initialHeights,initialGeometry:levelInitialGeometry,initialSolution:levelInitialSolution})');}
function selectedButton(index){const b=r.supportMap.querySelectorAll('.map-point').find(b=>Number(b.dataset.support)===index);assert(b,'support selector is absent');return b;}
function shimFocus(){for(const el of Object.values(r))el.focus=options=>{context.document.activeElement=el;el.focusOptions=options;};}
function open(index,mode){storage.clear();read(`openMachine(machines[${index}]);`);if(mode)r.machineMode.change(mode);frames.clear();shimFocus();}
function commonRaise(){r.raiseSupport.click();}
function commonLower(){r.lowerSupport.click();}
async function importRecord(data){r.importLevel.files=[{size:JSON.stringify(data).length,text:async()=>JSON.stringify(data)}];await r.importLevel.onchange({target:r.importLevel});}
async function main(){
 for(const [index,mode] of variants){
  open(index,mode);const kind=read('current.kind'),count=read('supports.length'),keys=json('axisConfig(current).map(a=>a.key)');name=kind+'/initial';
  check('drawerState',()=>{
   assert(r.trainingDrawer.hidden);assert.equal(r.openTrainingMenu.getAttribute('aria-expanded'),'false');assert.equal(r.trainingMain.inert,false);assert.equal(r.openTrainingMenu.getAttribute('aria-controls'),'trainingDrawer');
   assert.equal(r.trainingControls.closest('#trainingDrawer'),r.trainingDrawer);
   for(const id of ['machineMode','axisSliders','playAxis','resetAxes','supportWidth','supportDepth','columnX','columnZ','drawMachine','importLevel','exportLevel','showIdealOutline','sceneView'])assert.equal(r[id].closest('#trainingDrawer'),r.trainingDrawer,id);
   for(const id of ['coarseAdjust','fineAdjust','supportMap','selectedSupportLabel','raiseSupport','lowerSupport'])assert.equal(r[id].closest('#trainingDrawer'),null,id);
   assert(r.supportControls.hidden,'per-support compatibility controls must be hidden');
   assert.deepEqual(r.drawerAxisSelect.children.map(o=>o.value),keys);
  });
  read('setSceneZoom(1.37);setSceneView("side");');const savedView=json('({sceneZoom,sceneView,yaw})');
  for(let round=0;round<3;round++){
   shellWidth=[320,844,1440][round];read('refreshTrainingLayout();');const before=snapshot(),saved=[...storage];name=kind+'/drawer-round='+round;r.openTrainingMenu.click();
   check('drawerState',()=>{assert(!r.trainingDrawer.hidden);assert.equal(r.openTrainingMenu.getAttribute('aria-expanded'),'true');assert.equal(r.trainingMain.inert,true);assert(read('trainingMainScale')>0&&read('trainingMainScale')<1,'drawer does not actually reduce the main view');assert.match(r.trainingMain.style.transform,/^scale\(/);assert.deepEqual(snapshot(),before);assert.deepEqual([...storage],saved);assert.deepEqual(json('({sceneZoom,sceneView,yaw})'),savedView);});
   r.closeTrainingMenu.click();
   check('drawerState',()=>{assert(r.trainingDrawer.hidden);assert.equal(r.openTrainingMenu.getAttribute('aria-expanded'),'false');assert.equal(r.trainingMain.inert,false);near(read('trainingMainScale'),1);assert.deepEqual(snapshot(),before);assert.deepEqual([...storage],saved);assert.deepEqual(json('({sceneZoom,sceneView,yaw})'),savedView);});
  }
  // Selection has no computational effect. Up/down changes only that point,
  // at the exact stage step, for every support in every mechanical variant.
  for(let i=0;i<count;i++){
   const before=snapshot(),saved=[...storage];selectedButton(i).click();name=kind+'/support='+i;
   check('supportSelection',()=>{assert.equal(read('selected'),i);assert.deepEqual(snapshot(),before);assert.deepEqual([...storage],saved);assert.match(r.selectedSupportLabel.textContent,new RegExp(String.fromCharCode(65+i)));assert.equal(r.supportMap.querySelectorAll('.map-point').filter(b=>b.getAttribute('aria-pressed')==='true').length,1);});
   for(const [stage,step] of [['coarseAdjust',.01],['fineAdjust',.001]]){
    const heights=json('supportHeights'),profile=json('machineProfile'),initial=json('levelInitialGeometry'),initialSolution=json('levelInitialSolution');r[stage].click();const stageBefore=json('supportHeights');name=kind+'/support='+i+'/'+stage;
    check('stageSteps',()=>{assert.deepEqual(stageBefore,heights);near(read("Number($('adjustStep').value)"),step);assert.equal(read('selected'),i);assert.deepEqual(json('machineProfile'),profile);assert.deepEqual(json('levelInitialGeometry'),initial);assert.deepEqual(json('levelInitialSolution'),initialSolution);});
    commonRaise();check('stageSteps',()=>{const actual=json('supportHeights');actual.forEach((h,j)=>near(h,stageBefore[j]+(j===i?step:0)));near(record().step,step);assert.equal(read('selected'),i);});
    commonLower();check('stageSteps',()=>assert.deepEqual(json('supportHeights'),stageBefore));
   }
  }
  // Boundary states refresh the common control according to the selected
  // point, rather than a stale point or another point at the opposite limit.
  selectedButton(count-1).click();read(`setSupportHeight(${count-1},.5);`);name=kind+'/upper-limit';
  check('limits',()=>{assert(r.raiseSupport.disabled);assert(!r.lowerSupport.disabled);const before=json('supportHeights');commonRaise();assert.deepEqual(json('supportHeights'),before);});
  selectedButton(0).click();name=kind+'/different-point-from-limit';check('limits',()=>assert(!r.raiseSupport.disabled));
  read('setSupportHeight(0,-.5);');name=kind+'/lower-limit';check('limits',()=>{assert(r.lowerSupport.disabled);assert(!r.raiseSupport.disabled);const before=json('supportHeights');commonLower();assert.deepEqual(json('supportHeights'),before);});
  read('supportHeights=[...machineProfile.initialHeights];updateLeveling();');
  // Every machine-specific axis is still selected and moved from the drawer.
  r.openTrainingMenu.click();
  for(const [i,key] of keys.entries()){
   const before=snapshot(),saved=[...storage];r.drawerAxisSelect.change(key);name=kind+'/drawer-axis='+key;
   check('axisControls',()=>{assert.equal(read('selectedAxis'),key);assert.equal(r.drawerAxisSelect.value,key);assert.deepEqual(snapshot(),before);assert.deepEqual([...storage],saved);assert.equal(r['axis-'+key].parentElement.hidden,false);});
   const oldPositions=json('positions'),value=37+i*7,input=r['axis-'+key];input.value=String(value);input.events.input({target:input});name=kind+'/axis-position='+key;
   check('axisControls',()=>{const actual=json('positions');Object.keys(actual).forEach(k=>near(actual[k],k===key?value:oldPositions[k]));near(record().axisPositions[key],value);assert.equal(read('selectedAxis'),key);assert.equal(r.drawerAxisSelect.value,key);assert(read('validLevelRecord(levelRecord())'));assert.deepEqual(JSON.parse(storage.get(read('levelKey()'))),record());});
  }
  const profile=json('machineProfile'),heights=json('supportHeights');r.resetAxes.click();name=kind+'/axes-reset';check('axisControls',()=>{assert(json('Object.values(positions)').every(p=>p===0));assert.deepEqual(json('machineProfile'),profile);assert.deepEqual(json('supportHeights'),heights);});
  // Demo timing uses the real requestAnimationFrame callback, including the
  // final return to centre and automatic save. Drawer operations add no motion.
  r.drawerAxisSelect.change(keys.at(-1));frames.clear();r.playAxis.click();name=kind+'/demo-start';check('demo',()=>{assert.equal(r.playAxis.getAttribute('aria-pressed'),'true');assert.notEqual(read('motionFrame'),null);});
  tick(0);tick(875);name=kind+'/demo-motion';check('demo',()=>{assert(read(`positions.${keys.at(-1)}`)>80);assert.deepEqual(json('supportHeights'),heights);assert.deepEqual(json('machineProfile'),profile);});
  tick(3500);frames.clear();name=kind+'/demo-finish';check('demo',()=>{assert.equal(read('motionFrame'),null);near(read(`positions.${keys.at(-1)}`),0);assert.equal(r.playAxis.getAttribute('aria-pressed'),'false');assert.deepEqual(JSON.parse(storage.get(read('levelKey()'))),record());});
  // Export/import retain all stored fields, including nonstandard legacy
  // steps. Only the first visible up/down adopts the binary UI's fixed step.
  r.openTrainingMenu.click();const original=record(),downloadCount=downloads.length;r.exportLevel.click();const exported=JSON.parse(await context.exportedBlob.text());name=kind+'/export';
  check('saveImportExport',()=>{assert.equal(downloads.length,downloadCount+1);assert.deepEqual(exported,original);for(const key of ['trainingMenuOpen','menuOpen','drawerOpen','sceneZoom','showIdealOutline'])assert.equal(Object.hasOwn(exported,key),false);});
  r.closeTrainingMenu.click();r.coarseAdjust.click();selectedButton(count-1).click();commonRaise();r.openTrainingMenu.click();await importRecord(exported);name=kind+'/import';
  check('saveImportExport',()=>{assert.deepEqual(record(),exported);assert.match(r.levelInputMessage.textContent,/読み込み/);assert(read('validLevelRecord(levelRecord())'));assert.deepEqual(json('machineProfile'),exported.machineProfile);});
  for(const legacy of [.005,.05,.1]){
   const data=structuredClone(exported);data.step=legacy;await importRecord(data);const currentIdentity=identity();name=kind+'/legacy-load='+legacy;
   check('legacyStep',()=>assert.deepEqual(record(),data));
   r.closeTrainingMenu.click();selectedButton(count-1).click();const before=json('supportHeights'),canonical=legacy>=.01?.01:.001;commonRaise();name=kind+'/legacy-first-visible='+legacy;
   check('legacyStep',()=>{const actual=json('supportHeights');actual.forEach((h,i)=>near(h,before[i]+(i===count-1?canonical:0)));near(record().step,canonical);assert.deepEqual(identity(),currentIdentity);assert(read('validLevelRecord(levelRecord())'));});
   commonLower();name=kind+'/legacy-next-visible='+legacy;check('legacyStep',()=>{assert.deepEqual(json('supportHeights'),before);near(record().step,canonical);});
   r.openTrainingMenu.click();
  }
  // A restored browser save also refreshes the selected-support and phase UI.
  r.closeTrainingMenu.click();r.fineAdjust.click();selectedButton(count-1).click();commonRaise();const saved=record();read(`openMachine(machines[${index}]);`);if(mode)r.machineMode.change(mode);frames.clear();shimFocus();name=kind+'/automatic-restore';
  check('saveImportExport',()=>{assert.deepEqual(record(),saved);assert.equal(read('selected'),0);assert.match(r.selectedSupportLabel.textContent,/A/);near(read("Number($('adjustStep').value)"),.001);});
 }
 // Relocated detailed inputs continue to change their existing teaching
 // parameters; the drawer itself does not alter any of them.
 open(5,'');r.openTrainingMenu.click();const intrinsic=json('machineProfile'),axisBefore=json('positions');
 r.supportWidth.change('4.5');r.supportDepth.change('3.75');r.columnX.value='53';r.columnX.oninput({target:r.columnX});r.columnZ.value='-27';r.columnZ.oninput({target:r.columnZ});name='five/relocated-dimensions-and-layout';
 check('settings',()=>{near(read('levelConfig.width'),4.5);near(read('levelConfig.depth'),3.75);near(read('levelConfig.columnX'),53);near(read('levelConfig.columnZ'),-27);assert.deepEqual(json('machineProfile'),intrinsic);assert.deepEqual(json('positions'),axisBefore);assert(read('validLevelRecord(levelRecord())'));});
 const beforeView=snapshot();r.showIdealOutline.checked=false;r.showIdealOutline.change();r.sceneView.change('front');r.resetSceneZoom.click();name='five/relocated-view-settings';check('settings',()=>{assert.deepEqual(snapshot(),beforeView);assert.equal(read('sceneView'),'front');near(read('sceneZoom'),1);});
 r.machineCondition.change('used');name='five/relocated-individual-draw';check('settings',()=>{assert.equal(read('machineProfile.condition'),'used');assert.notDeepEqual(json('machineProfile'),intrinsic);assert.deepEqual(json('supportHeights'),json('machineProfile.initialHeights'));assert(json('Object.values(positions)').every(v=>v===0));});
 for(const [index,mode,kind,count,removed] of [[0,'compact','compact',4,'standard'],[3,'l3-3000','double',15,'cross']]){
  open(index,mode);r.openTrainingMenu.click();const before=snapshot();r.machineMode.change(removed);name='single-model/'+mode;
  check('settings',()=>{assert(r.machineModeBox.hidden);assert.equal(read('machineMode'),mode);assert.equal(read('current.kind'),kind);assert.equal(r.supportMap.querySelectorAll('.map-point').length,count);assert.deepEqual(snapshot(),before);});
 }
 console.log(JSON.stringify(result,null,2));if(result.failures.length)process.exitCode=1;
}
main().catch(error=>{result.failures.push({kind:'execution',name,message:error.stack||error.message});console.log(JSON.stringify(result,null,2));process.exitCode=1;});

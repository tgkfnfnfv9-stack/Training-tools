'use strict';
const assert=require('node:assert/strict');
const create=require('./leveling-dom-env.cjs');
let checks=0,nextSeed=1000;
const listeners={};
const env=create({window:{crypto:{getRandomValues(a){a[0]=++nextSeed;return a;}},addEventListener(type,fn){listeners[type]=fn;}}});
const {read,json,registry:r,storage}=env;
const check=(name,fn)=>{fn();checks++;};
const state=()=>json('levelRecord()');
function fresh(previous,label){
 check(label+' new seed',()=>assert.notEqual(read('machineProfile.seed'),previous.machineProfile.seed));
 check(label+' heights and comparison baseline',()=>{assert.deepEqual(json('supportHeights'),json('machineProfile.initialHeights'));assert.deepEqual(json('machineReference.initial'),json('machineEvaluation(machineProfile.initialHeights)'));});
 check(label+' neutral axes and default adjustment',()=>{assert(json('Object.values(positions)').every(v=>v===0));assert.equal(read('adjustmentStage'),'coarse');assert.equal(state().step,.01);assert.equal(read('fineStartEvaluation'),null);assert.equal(read('levelConfig.columnX'),0);assert.equal(read('levelConfig.columnZ'),0);assert.equal(read('levelConfig.width'),read('Number((current.w*.8).toFixed(2))'));assert.equal(read('levelConfig.depth'),read('Number((current.d*.8).toFixed(2))'));});
}
(async()=>{
 for(let index=0;index<7;index++){
  read(`openMachine(machines[${index}])`);
  r.fineAdjust.click();r.raiseSupport.click();r.supportWidth.change('7.1');read('positions.X=41;updateAxisValues();saveLeveling();');
  const adjusted=state();
  r.openTrainingMenu.click();r.closeTrainingMenu.click();read("selectAxis('Z');sceneZoom=1.7;drawScene();");
  check(index+' ordinary controls preserve individual and data',()=>assert.deepEqual(state(),adjusted));
  listeners.pageshow({persisted:false});check(index+' ordinary pageshow preserves state',()=>assert.deepEqual(state(),adjusted));
  r.changeMachine.click();r.machineGrid.children[index].click();fresh(adjusted,index+' catalogue return');
  const before=state();r.navHome.click();read("navigate('training',{fromHistory:true})");fresh(before,index+' history entry');
  const beforeCache=state();listeners.pageshow({persisted:true});fresh(beforeCache,index+' BFCache restore');
  r.importLevel.files=[{size:100,text:async()=>JSON.stringify(adjusted)}];await r.importLevel.onchange({target:r.importLevel});
  check(index+' explicit JSON restores exact state',()=>assert.deepEqual(state(),adjusted));
  r.openTrainingMenu.click();r.exportLevel.click();const exported=JSON.parse(await env.context.exportedBlob.text());
  check(index+' explicit export preserves data',()=>assert.deepEqual(exported,adjusted));
  const reload=create({window:{crypto:{getRandomValues(a){a[0]=++nextSeed;return a;}}}});
  for(const [key,value]of storage)reload.storage.set(key,value);
  reload.read(`openMachine(machines[${index}])`);
  check(index+' reload ignores previous browser snapshot',()=>{assert.notEqual(reload.read('machineProfile.seed'),adjusted.machineProfile.seed);assert.deepEqual(reload.json('supportHeights'),reload.json('machineProfile.initialHeights'));assert(reload.json('Object.values(positions)').every(v=>v===0));});
 }
 console.log(`Page-entry redraw: ${checks} assertions across all 7 machines passed; explicit JSON round trips preserved.`);
})().catch(error=>{console.error(error);process.exitCode=1;});

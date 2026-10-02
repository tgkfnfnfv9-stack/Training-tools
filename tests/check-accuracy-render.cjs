'use strict';
// Exercise every Canvas branch even in an environment without Chromium.
const assert=require('node:assert/strict');
const createEnvironment=require('./leveling-dom-env.cjs');
const env=createEnvironment(),{registry:r,read,storage}=env;
let calls=0,frames=0,path=[],framePaths=[];
const coordinates=values=>{calls++;for(const v of values)assert.ok(Number.isFinite(v),'Canvas coordinate must be finite');};
const ctx={scale:(...v)=>coordinates(v),fillRect(...v){coordinates(v);if(v[0]===0&&v[1]===0){framePaths=[];frames++;}},beginPath(){path=[];},closePath(){},moveTo(...v){coordinates(v);path.push(v);},lineTo(...v){coordinates(v);path.push(v);},arc(...v){coordinates(v);},fill(){framePaths.push(path);},stroke(){},fillText(text,...v){assert.equal(typeof text,'string');coordinates(v);},measureText(text){return {width:text.length*7};}};
r.scene.getContext=()=>ctx;
let width=390,height=340;r.scene.getBoundingClientRect=()=>({width,height});
for(const size of [[390,340],[320,225],[720,500]]){
 [width,height]=size;
 for(let i=0;i<7;i++){
  storage.clear();read(`openMachine(machines[${i}])`);
  for(const mode of i===0?['standard','compact']:i===3?['long','cross']:['']){
   if(mode)r.machineMode.change(mode);
   read('selectedAxis="Z";drawScene()');
   if(!r.demoTwist.disabled)r.demoTwist.click();
   r.demoColumn.click();
   assert.ok(framePaths.length>30,'machine faces are actually rendered');
   r.zero.click();
   r.supportWidth.change('.5');r.supportDepth.change('.5');
   read('positions.X=100;positions.Y=-100;positions.Z=100;drawScene()');
   r.exaggerate.checked=false;r.exaggerate.onchange();
   r.labels.checked=false;r.labels.onchange();
  }
 }
}
assert.ok(frames>100&&calls>10000);
console.log(`Accuracy Canvas: ${frames} rendered frames, ${calls} finite drawing operations passed (3 sizes, 7 machines, 2 extra modes).`);

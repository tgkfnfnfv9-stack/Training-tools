'use strict';
// Identical saved states rendered by the old and new built pages must retain
// the same physics, dial readings, local-angle values and save representation.
const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const urls=[process.env.BEFORE_URL||'http://127.0.0.1:8765/tmp/before/index.html',process.env.AFTER_URL||'http://127.0.0.1:8765/index.html'];
const output=process.env.INVARIANCE_OUTPUT||'tmp/qa-live-diagrams/calculation-invariance.json';
const result={urls,checks:0,failures:[],machines:[],calculationChanged:false};
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 const states=[];
 for(const url of urls){const context=await browser.newContext(),p=await context.newPage();await p.goto(url,{waitUntil:'networkidle'});const machineStates=[];
  for(const kind of ['compact','horizontal','travel','double','gantry','five','lathe']){
   const state=await p.evaluate(kind=>{localStorage.clear();openMachine(machines.find(m=>m.kind===kind));initializeMachineAccuracy(window.MachineAccuracy.generate('used',78129,current.kind==='lathe'?['X','Z']:['X','Y','Z'],supports.length));positions={X:current.kind==='gantry'?80:0,Y:current.kind==='gantry'?20:0,Z:0,A:0,C:0};supportHeights=supports.map((s,i)=>[.025,-.012,.018,-.009,.005,-.011][i%6]);updateAxisValues();updateLeveling();const sweep=spindleSweepGeometry();return{kind,record:levelRecord(),pairs:levelGeometry.pairs,sweep:sweep.valid?sweep.cardinal:[],pairValues:[...document.querySelectorAll('.live-pair-error-value')].map(e=>e.getAttribute('data-current-error-300')),dialValues:document.getElementById('spindleSweepPanel').hidden?[]:[0,1,2,3].map(i=>document.getElementById('sweepValue'+i).getAttribute('data-reading-microns'))};},kind);machineStates.push(state);
  }states.push(machineStates);await context.close();
 }
 for(let i=0;i<states[0].length;i++){result.checks++;const before=states[0][i],after=states[1][i];try{assert.deepEqual(after,before);result.machines.push({kind:after.kind,identical:true,pairValues:after.pairValues,dialValues:after.dialValues});}catch(e){result.calculationChanged=true;result.failures.push({kind:after.kind,message:e.message});}}
}finally{await browser.close();}})().catch(e=>result.failures.push({execution:e.stack||e.message})).finally(()=>{fs.mkdirSync(require('node:path').dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(result.failures.length)process.exitCode=1;});

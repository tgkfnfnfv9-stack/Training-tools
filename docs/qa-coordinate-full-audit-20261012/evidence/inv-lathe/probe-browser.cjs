'use strict';
// Real-browser probe of what the lathe UI shows (file:// index.html built from src at e0e62e7).
const fs=require('fs'),path=require('path'),{chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox']});
 const p=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('file:///home/user/Training-tools/index.html',{waitUntil:'load'});
 const snap=()=>p.evaluate(()=>({
  dataset:JSON.parse($('liveSquareness').dataset.lathe||'null'),
  liveText:$('liveSquareness').textContent.replace(/\s+/g,' '),
  secondText:$('latheInspectionSecond').textContent.replace(/\s+/g,' '),
  refCards:{xzCards:$('measurementReferenceCards').querySelectorAll('[data-reference-pair]').length,latheDetail:!!$('measurementReferenceCards').querySelector('.lathe-inspection-detail')},
  metrics:$('accuracyMetrics').textContent.replace(/\s+/g,' '),
  intrinsicColumnsDisplay:getComputedStyle(document.querySelector('.intrinsic-inspection-columns')).display,
  localLevel:$('localLevel').textContent+' | '+$('localLevelFB').textContent+' | measurePos='+$('measurePos').value+' | twist '+$('twist').textContent,
  measurePosOptions:[...$('measurePos').options].map(o=>o.textContent),
  calc:currentCalculationModel(),
  storageKeyPrefix:levelStoragePrefix()
 }));
 await p.evaluate(()=>{openMachine(machines.find(m=>m.kind==='lathe'));machineProfile=MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length);positions={X:0,Y:0,Z:0,A:0,C:0};supportHeights=supports.map(()=>0);levelInitialSolution=machineSolution(supportHeights);updateAxisValues();updateLeveling(false);});
 const before=await snap();
 await p.evaluate(()=>{supportHeights[3]=.1;updateLeveling(false);});
 const after=await snap();
 // Level gauge at the three measurePos values (front/centre/rear) after change
 const levels=[];for(const v of ['-1','0','1'])levels.push(await p.evaluate(v=>{$('measurePos').value=v;updateLeveling(false);return v+': '+$('localLevel').textContent+' | '+$('localLevelFB').textContent;},v));
 await p.screenshot({path:path.join(__dirname,'lathe-after-support3.png')});
 const res={errors,before,after,levels};
 fs.writeFileSync(path.join(__dirname,'probe-browser.json'),JSON.stringify(res,null,1));console.log(JSON.stringify(res,null,1));
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});

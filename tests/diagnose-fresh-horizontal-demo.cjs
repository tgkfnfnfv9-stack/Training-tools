'use strict';
// Browser runtime diagnostic of shared state during start/run/stop/end.
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'}),errors=[],records=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://trace.test/**',route=>route.fulfill({contentType:'text/html',body:fs.readFileSync('index.html')}));
 await page.goto('http://trace.test/');
 await page.evaluate(()=>{openMachine(machines.find(m=>m.kind==='horizontal'));machineProfile=MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length);supportHeights=supports.map(p=>.05*p.x*p.z);positions={X:0,Y:0,Z:0,A:0,C:0};$('exaggerate').checked=false;updateAxisValues();updateLeveling(false);});
 const capture=async name=>records.push(await page.evaluate(name=>{
  const clearance=displayClearance(),physical=horizontalSpindleFixture(positions,levelSolution,machineProfile).nose,drawn=displayedModelPoint([0,2.55,-.93],['X','Y'],current,positions,'tool').map((v,i)=>v-(i===1?clearance:0));
  return {name,positions:{...positions},running:motionFrame!==null,status:$('axisDemoStatus').textContent,physicalNose:physical,drawnNose:drawn,
   values:[...document.querySelectorAll('#liveSquareness .live-pair-values')].map(el=>{const key=el.dataset.pair,live=el.querySelector('.live-pair-error-value'),m=referenceScan({key});return {key,domRaw:Number(live.dataset.readingMicrons),domText:live.textContent,rawAtCurrentState:m.microns,range:[m.startPosition,m.endPosition]};}),
   parallel:[0,1].map((n)=>({domRaw:Number($('sweepValue'+n).dataset.readingMicrons),rawAtCurrentState:horizontalParallelism()[n?'b':'a'].microns}))};
 },name));
 await capture('before');
 await page.evaluate(()=>{selectAxis('X');$('playAxis').click();});
 for(let i=0;i<5;i++){await page.waitForTimeout(180);await capture('running-'+i);}
 await page.evaluate(()=>$('playAxis').click());await capture('stopped');
 await page.waitForTimeout(250);await capture('stopped-later');
 await page.evaluate(()=>{selectAxis('Z');$('playAxis').click();});
 await page.waitForFunction(()=>motionFrame===null,{},{timeout:12000});await capture('completed-Z');
 await browser.close();
 const result={errors,records,maxSquareDomError:Math.max(...records.flatMap(r=>r.values.map(v=>Math.abs(v.domRaw-v.rawAtCurrentState)))),maxParallelDomError:Math.max(...records.flatMap(r=>r.parallel.map(v=>Math.abs(v.domRaw-v.rawAtCurrentState)))),maxNoseDifference:Math.max(...records.map(r=>Math.hypot(...r.drawnNose.map((v,i)=>v-r.physicalNose[i]))))};
 const out=path.resolve('docs/qa-fresh-audit-20261010');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'trace-demo.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({errors,records:records.length,maxSquareDomError:result.maxSquareDomError,maxParallelDomError:result.maxParallelDomError,maxNoseDifference:result.maxNoseDifference},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});

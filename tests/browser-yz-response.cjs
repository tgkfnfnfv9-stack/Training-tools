'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const input=path.resolve(process.argv[2]||'index.html'),phase=process.argv[3]||'after';
const out=path.resolve('docs/qa-yz-response-20261007','browser-'+phase);fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync(input),checks=[],states=[],errors=[];
const check=(name,ok,detail)=>checks.push({name,ok,...(detail===undefined?{}:{detail})});
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://localhost:8765/**',r=>r.fulfill({contentType:'text/html',body:html}));await page.goto('http://localhost:8765/');
 const setup=()=>page.evaluate(()=>{stopMotion();openMachine(machines[0]);machineProfile={squareness:{XY:{microns:33},XZ:{microns:75},YZ:{microns:-15}},guides:{},initialHeights:supports.map(()=>0)};machineReference=null;machineSavedBest=null;positions={X:0,Y:0,Z:0,A:0,C:0};supportHeights=supports.map(()=>0);updateLeveling(false);selectSupport(0);});
 const snapshot=()=>page.evaluate(()=>({heights:[...supportHeights],readings:levelGeometry.pairs.map(p=>({pair:p.key,raw:referenceScan(p).microns,shown:Number(document.querySelector(`.live-pair-values[data-pair="${p.key}"] .live-pair-error-value`).dataset.readingMicrons),text:document.querySelector(`.live-pair-values[data-pair="${p.key}"] .live-pair-error-value`).textContent})),profile:machineProfile,record:levelRecord(),inset:!!document.querySelector('#columnLeanInset'),note:document.querySelector('#liveSquarenessUnits')?.textContent,body:document.body.innerText}));
 for(const [width,height]of [[1280,900],[390,844],[320,568],[320,480]]){
  await page.setViewportSize({width,height});await setup();await page.locator('#coarseAdjust').click();const before=await snapshot();
  await page.screenshot({path:path.join(out,`compact-${width}-${height}-start.png`)});
  await page.locator('#raiseSupport').click();const after=await snapshot();states.push({width,height,before,after});
  check(`${width}x${height}: coarse actual button moves support A by 0.01 mm`,Math.abs(after.heights[0]-before.heights[0]-.01)<1e-12);
  check(`${width}x${height}: XY/XZ shown match raw finite readings`,after.readings.filter(r=>r.pair!=='YZ').every(r=>Math.abs(r.raw-r.shown)<1e-10),after.readings);
  const yz0=before.readings.find(r=>r.pair==='YZ'),yz1=after.readings.find(r=>r.pair==='YZ');
  if(phase!=='before'){
   check(`${width}x${height}: unwanted column inset fully removed`,!after.inset);
   check(`${width}x${height}: YZ support response is 50 times independent before/after raw delta`,Math.abs((yz1.shown-yz0.shown)-50*(yz1.raw-yz0.raw))<1e-8,{before:yz0,after:yz1});
   check(`${width}x${height}: one coarse click changes YZ shown by more than 1 micrometre`,Math.abs(yz1.shown-yz0.shown)>1,{before:yz0,after:yz1});
   check(`${width}x${height}: YZ baseline intrinsic value preserved`,Math.abs(yz0.shown-yz0.raw)<1e-8,{before:yz0});
   check(`${width}x${height}: training multiplier visibly explained`,/50/.test(after.body)&&/YZ/.test(after.body));
  }
  const targets=await page.locator('#supportMap button, #raiseSupport, #lowerSupport').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{text:e.textContent,height:r.height,bottom:r.bottom,right:r.right,reachable:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};}));
  check(`${width}x${height}: support controls reachable and at least 44px tall`,targets.every(t=>t.height>=44&&t.bottom<=height+.5&&t.right<=width+.5&&t.reachable),targets);
  await page.screenshot({path:path.join(out,`compact-${width}-${height}-raise.png`)});
  await page.locator('#lowerSupport').click();const restored=await snapshot();check(`${width}x${height}: actual down button restores all readings`,JSON.stringify(restored.readings)===JSON.stringify(before.readings));
 }
 await page.setViewportSize({width:390,height:844});await setup();await page.locator('#fineAdjust').click();const fineBefore=await snapshot();await page.locator('#raiseSupport').click();const fineAfter=await snapshot();states.push({fineBefore,fineAfter});
 check('fine actual button retains 0.001 mm',Math.abs(fineAfter.heights[0]-.001)<1e-12);
 if(phase!=='before')check('fine YZ gain is also 50',Math.abs((fineAfter.readings[2].shown-fineBefore.readings[2].shown)-50*(fineAfter.readings[2].raw-fineBefore.readings[2].raw))<1e-8);
 for(const id of ['horizontal','travel','gate','gantry','five','lathe']){
  await page.evaluate(id=>openMachine(machines.find(m=>m.id===id)),id);const s=await snapshot();states.push({id,...s});
  check(`${id}: displayed values retain raw finite readings`,s.readings.every(r=>Math.abs(r.shown-r.raw)<1e-8),s.readings);
  if(phase!=='before')check(`${id}: no unwanted inset`,!s.inset);
 }
 await setup();const seedBefore=await page.evaluate(()=>{openMachine(machines[0]);return machineProfile.seed;});await page.locator('#changeMachine').click();await page.locator('.machine-card').first().click();const reentry=await page.evaluate(()=>({seed:machineProfile.seed,heights:[...supportHeights],initial:machineProfile.initialHeights}));check('real machine page reentry redraws random individual',seedBefore!==reentry.seed,{seedBefore,...reentry});check('real page reentry resets supports',JSON.stringify(reentry.heights)===JSON.stringify(reentry.initial));
 check('no browser exceptions',errors.length===0,errors);
 const result={input,phase,sha256:crypto.createHash('sha256').update(html).digest('hex'),browser:browser.version(),checks,states,errors};fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));await browser.close();console.log(JSON.stringify({phase,total:checks.length,passed:checks.filter(c=>c.ok).length,failed:checks.filter(c=>!c.ok)},null,2));process.exitCode=checks.some(c=>!c.ok)?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});

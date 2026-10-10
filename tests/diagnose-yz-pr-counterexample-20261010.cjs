'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto'),{chromium}=require('playwright');
const root=path.resolve('docs/qa-yz-sign-recheck-20261010/browser');
(async()=>{
 const html=zlib.gunzipSync(fs.readFileSync(path.join(root,'pr/index.html.gz'))),browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),page=await browser.newPage({viewport:{width:1280,height:1000},reducedMotion:'reduce'});
 await page.route('http://audit.test/**',r=>r.fulfill({contentType:'text/html',body:html}));await page.goto('http://audit.test/');
 const result=await page.evaluate(()=>{
  openMachine(machines.find(m=>m.kind==='horizontal'));machineProfile=null;positions={X:0,Y:0,Z:0,A:0,C:0};const failures=[],counts={evaluated:0,valid:0,positive:0};
  const inspect=()=>{
   levelSolution=machineSolution(supportHeights);const m=referenceDisplayScan(geometryModel().pairs.find(p=>p.key==='YZ'));counts.evaluated++;if(!m.valid)return;counts.valid++;if(m.microns>0)counts.positive++;
   const element=document.createElement('div');element.innerHTML='<svg>'+referenceDiagram(m)+'</svg>';const probe=element.querySelector('.scan-probe'),p=probe.getAttribute('d').match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi).map(Number),length=Math.hypot(p[2]-p[0],p[3]-p[1]);
   if(m.microns>.01&&length>11.000001){const dot=(a,b)=>a.reduce((r,v,i)=>r+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]),unit=a=>a.map(v=>v/Math.hypot(...a)),extension=p=>dot(unit(p.normal),sub(p.point,p.body))/dot(unit(p.normal),unit(p.probe));failures.push({supports:[...supportHeights],positions:{...positions},profile:machineProfile,raw:m.microns,integer:squarenessMicronText(m.microns),length,lengthDelta:length-11,diagram:{...element.querySelector('.scan-geometry').dataset},independentExtensionStart:extension(m.start),independentExtensionEnd:extension(m.end),independentMicrons:(extension(m.start)-extension(m.end))*1e6,start:m.start,end:m.end,zero:m.zero,last:m.last});}
  };
  // Two support adjustments at the central axes, on the actual 1 µm UI grid.
  for(const a of [.02,.05,.099,.1,.15,.2])for(let e=Math.round(a*1.812*1000)-3;e<=Math.round(a*1.812*1000)+3;e++){supportHeights=supports.map(()=>0);supportHeights[0]=a;supportHeights[4]=e/1000;inspect();}
  return {counts,failures};
 });
 if(result.failures.length){const fixture=result.failures.find(f=>f.diagram.diagramLimited==='false')||result.failures[0];result.illustrated=fixture;
  await page.evaluate(()=>{positions={X:0,Y:0,Z:0,A:0,C:0};supportHeights=supports.map(()=>0);machineProfile=null;updateAxisValues();updateLeveling(false);});await page.screenshot({path:path.join(root,'pr-counterexample-flat.png')});
  await page.locator('#supportMap .map-point').nth(0).click();await page.locator('#coarseAdjust').click();for(let i=0;i<5;i++)await page.locator('#raiseSupport').click();
  await page.locator('#supportMap .map-point').nth(4).click();for(let i=0;i<9;i++)await page.locator('#raiseSupport').click();await page.locator('#fineAdjust').click();await page.locator('#raiseSupport').click();
  result.realOperation=await page.evaluate(()=>{const pair=geometryModel().pairs.find(p=>p.key==='YZ'),m=referenceDisplayScan(pair),svg=document.querySelector('#liveSquareness svg[data-pair="YZ"]'),p=svg.querySelector('.scan-probe').getAttribute('d').match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi).map(Number);return {sequence:'ideal flat axes 0; select A, coarse raise 5 clicks; select E, coarse raise 9 clicks; fine raise 1 click',supports:[...supportHeights],positions:{...positions},raw:m.microns,integer:document.querySelector('#liveSquareness .live-pair-values[data-pair="YZ"] .live-pair-error-value').textContent,svgLength:Math.hypot(p[2]-p[0],p[3]-p[1]),startExtension:m.zero.extension,endExtension:m.last.extension};});
  await page.screenshot({path:path.join(root,'pr-counterexample.png')});await page.locator('#liveSquareness').screenshot({path:path.join(root,'pr-counterexample-diagrams.png')});
 }
 fs.writeFileSync(path.join(root,'pr-counterexample.json'),JSON.stringify({sha256:crypto.createHash('sha256').update(html).digest('hex'),method:'Central axes, ideal profile, two supports on 0.001 mm UI grid. Candidate inputs seeded via evaluate; independent plane-line contact calculation checks captured poses. Final selected counterexample replayed with actual UI buttons from ideal flat state. No product edits.',...result},null,2));console.log(JSON.stringify({counts:result.counts,failures:result.failures.length,realOperation:result.realOperation}));await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});

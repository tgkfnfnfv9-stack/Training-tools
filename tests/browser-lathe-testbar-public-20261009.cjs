'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('node:assert/strict'),{execFileSync}=require('child_process'),{chromium}=require('playwright');
const out=path.resolve('docs/qa-lathe-testbar-20261009/public'),expected='42a265f8fce434a7b589cb745184b7d918c43e26dacb299b9d1bc27d610b818b';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const url='https://tgkfnfnfv9-stack.github.io/Training-tools/',html=execFileSync('curl',['--fail','--silent','--show-error',url+'?testbar-audit='+Date.now()],{maxBuffer:8*1024*1024});
 assert.equal(crypto.createHash('sha256').update(html).digest('hex'),expected);
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const result={url,sourceCommit:process.argv[2]||null,sha256:expected,access:'TLS-verified public response downloaded by curl, then the exact bytes replayed in Chromium; no browser TLS bypass.',states:[],errors:[]};
 for(const width of [390,1280]){
  const p=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});p.on('pageerror',e=>result.errors.push(e.message));
  await p.route('http://lathe-public.test/**',r=>r.fulfill({contentType:'text/html',body:html}));await p.goto('http://lathe-public.test');
  await p.evaluate(()=>{openMachine(machines.find(m=>m.kind==='lathe'));machineProfile=MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length);positions={X:0,Y:0,Z:0,A:0,C:0};supportHeights=supports.map(()=>0);updateAxisValues();updateLeveling(false);});
  const values=()=>p.evaluate(()=>JSON.parse($('liveSquareness').dataset.lathe)),initial=await values();assert.equal(Math.round(initial.barSide),-17);assert.ok(Math.abs(initial.barTop)<.5);
  await p.locator('#inspectionNext').click();assert.equal(await p.evaluate(()=>intrinsicInspectionPage),1);assert.ok((await p.locator('#latheInspectionSecond').innerText()).includes('テストバー測定'));assert.ok(!/テスト加工|心押|片持ち/.test(await p.locator('#latheInspectionSecond').innerText()));
  const labels=await p.evaluate(()=>createGeometry(current).labels);assert.ok(labels.find(l=>l.name==='タレット').p[2]>0);assert.ok(labels.some(l=>l.name==='テストバー'));assert.ok(!labels.some(l=>l.name==='心押台'));
  await p.screenshot({path:path.join(out,`lathe-${width}-bar.png`)});
  await p.locator('#supportMap .map-point').nth(1).click();await p.locator('#raiseSupport').click();const raised=await values();assert.equal(Math.round(raised.barSide),-16);assert.equal(Math.round(raised.barTop),1);assert.deepEqual(raised.runout,initial.runout);await p.locator('#lowerSupport').click();assert.deepEqual(await values(),initial);
  await p.locator('#inspectionPrevious').click();await p.locator('#openTrainingMenu').click();if(!await p.locator('#axisMenuSection').evaluate(e=>e.open))await p.locator('#axisMenuSection summary').click();await p.locator('#drawerAxisSelect').selectOption('X');await p.locator('#axis-X').fill('100');await p.locator('#axis-X').dispatchEvent('input');await p.locator('#closeTrainingMenu').click();assert.equal(await p.evaluate(()=>positions.X),100);
  result.states.push({width,initial,raised,X100:await values()});await p.close();
 }
 assert.deepEqual(result.errors,[]);result.passed=true;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2)+'\n');await browser.close();console.log(JSON.stringify({passed:true,hash:expected,widths:[390,1280],errors:result.errors}));
})().catch(e=>{console.error(e);process.exitCode=1;});

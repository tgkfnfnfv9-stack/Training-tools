'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const out=path.resolve('docs/qa-lathe-turret-20261009/public'),expected='c0375aa2db3d1ec4268055e79cf1c79fae3d5cb48a821e1c36f3017ab1ef0007';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox'],proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY}:undefined});
 const result={url:'https://tgkfnfnfv9-stack.github.io/Training-tools/',sourceCommit:'1270aa0f43a995aced55faf727ab7e1d6d29d179',expected,access:'Direct public HTTPS in Chromium, proxy CA error bypassed; separately curl verifies TLS and identical HTML hash.',states:[],errors:[]};
 for(const width of [390,1280]){
  const p=await browser.newPage({viewport:{width,height:900},ignoreHTTPSErrors:true,reducedMotion:'reduce'});p.on('pageerror',e=>result.errors.push(e.message));
  const r=await p.goto(result.url+'?lathe-public-check='+Date.now(),{waitUntil:'networkidle'});assert.equal(r.status(),200);assert.equal(crypto.createHash('sha256').update(await r.body()).digest('hex'),expected);
  await p.evaluate(()=>{openMachine(machines.find(m=>m.kind==='lathe'));machineProfile=MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length);positions={X:0,Y:0,Z:0,A:0,C:0};supportHeights=supports.map(()=>0);updateAxisValues();updateLeveling(false);});
  const values=()=>p.evaluate(()=>JSON.parse($('liveSquareness').dataset.lathe));const initial=await values();assert.equal(Math.round(initial.flat),8);assert.equal(Math.round(initial.face),4);
  await p.screenshot({path:path.join(out,`lathe-${width}-first.png`)});await p.locator('#inspectionNext').click();await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>intrinsicInspectionPage),1);await p.screenshot({path:path.join(out,`lathe-${width}-second.png`)});
  await p.locator('#supportMap .map-point').nth(1).click();await p.locator('#raiseSupport').click();const raised=await values();assert.equal(Math.round(raised.flat),9);assert.deepEqual(raised.runout,initial.runout);await p.locator('#lowerSupport').click();assert.deepEqual(await values(),initial);
  await p.locator('#inspectionPrevious').click();await p.locator('#openTrainingMenu').click();if(!await p.locator('#axisMenuSection').evaluate(e=>e.open))await p.locator('#axisMenuSection summary').click();await p.locator('#drawerAxisSelect').selectOption('Z');await p.locator('#axis-Z').fill('100');await p.locator('#axis-Z').dispatchEvent('input');await p.locator('#closeTrainingMenu').click();assert.equal(await p.evaluate(()=>positions.Z),100);
  result.states.push({width,initial,raised,Z100:await values()});await p.close();
 }
 assert.deepEqual(result.errors,[]);result.passed=true;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2)+'\n');await browser.close();console.log(JSON.stringify({passed:true,hash:expected,widths:[390,1280],errors:result.errors}));
})().catch(e=>{console.error(e);process.exitCode=1;});

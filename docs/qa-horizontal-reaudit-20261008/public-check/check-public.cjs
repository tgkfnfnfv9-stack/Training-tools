'use strict';
const {chromium}=require('playwright'),fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');
const path=require('path'),out=__dirname,expected='da86f2a79085d098fe7fb075f275550830a71d2d31aab04876c532d311353c29';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox'],proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY}:undefined});
 const result={url:'https://tgkfnfnfv9-stack.github.io/Training-tools/',accessMode:'HTTPS curl with TLS verification, exact downloaded response replayed in Chromium; direct Chromium HTTPS blocked by ERR_CERT_AUTHORITY_INVALID',commit:'0b8e3f4bf409fca2b6f97d424cb1dac59900144a',expected,states:[],errors:[]};
 for(const width of [390,1280]){
  const p=await browser.newPage({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce'});p.on('pageerror',e=>result.errors.push(e.message));
  await p.route('http://localhost:8766/**',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(out,'index.html'))}));
  const response=await p.goto('http://localhost:8766/',{waitUntil:'networkidle'}),html=await response.body(),hash=crypto.createHash('sha256').update(html).digest('hex');assert.equal(response.status(),200);assert.equal(hash,expected);result.receivedHash=hash;
  await p.evaluate(()=>{openMachine(machines.find(m=>m.kind==='horizontal'));machineProfile=MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length);machineReference=null;machineSavedBest=null;positions={X:0,Y:0,Z:0,A:0,C:0};supportHeights=supports.map(()=>0);updateLeveling(false);});
  const values=()=>p.evaluate(()=>[...document.querySelectorAll('#liveSquareness .live-pair-error-value')].map(e=>e.textContent).concat([0,1].map(i=>$('sweepValue'+i).textContent)));
  const flat=await values();assert.deepEqual(flat,['+17','+8','+14','+8','+14']);
  await p.locator('#supportMap .map-point').nth(1).click();await p.locator('#raiseSupport').click();const raised=await values();assert.deepEqual(raised,['+17','+9','+12','+9','+12']);await p.locator('#lowerSupport').click();assert.deepEqual(await values(),flat);
  for(const key of ['X','Y','Z']){
   await p.locator('#openTrainingMenu').click();if(!await p.locator('#axisMenuSection').evaluate(e=>e.open))await p.locator('#axisMenuSection summary').click();await p.locator('#drawerAxisSelect').selectOption(key);await p.locator('#axis-'+key).fill('-100');await p.locator('#axis-'+key).dispatchEvent('input');await p.locator('#closeTrainingMenu').click();assert.equal(await p.evaluate(k=>positions[k],key),-100);
  }
  await p.screenshot({path:path.join(out,'public-'+width+'.png')});
  result.states.push({width,flat,raised,afterSliders:await values(),positions:await p.evaluate(()=>positions)});await p.close();
 }
 assert.deepEqual(result.errors,[]);result.passed=true;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2)+'\n');await browser.close();console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});

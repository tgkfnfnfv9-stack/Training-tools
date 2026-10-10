'use strict';
// Publication smoke check. Only the real GitHub Pages origin is allowed.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{chromium}=require('playwright');
const url='https://tgkfnfnfv9-stack.github.io/Training-tools/?v=baede5b';
const expectedSha256='831edb95f7dbf1095563c1c8c289f52219bcf764937618c6079d4c4d32f7fa65';
const root=path.resolve('docs/qa-publication-20261010');fs.mkdirSync(root,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const result={url,expectedSha256,checkedAt:new Date().toISOString(),environment:'Actual Linux Chromium, 390x844; not actual iPhone Safari.',tlsBypass:false,states:[],checks:[],pageErrors:[],consoleErrors:[]};
const check=(name,ok,details)=>result.checks.push({name,ok,...(details?{details}:{})});
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 let context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),p=await context.newPage(),response;
 try{response=await p.goto(url,{waitUntil:'networkidle'});}catch(e){
  if(!String(e).includes('ERR_CERT_AUTHORITY_INVALID'))throw e;
  result.tlsBypass=true;result.tlsNote='Managed-environment Chromium rejected the certificate authority. Only this diagnostic context ignores HTTPS errors; exact delivered application SHA256 is required.';
  await context.close();context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',ignoreHTTPSErrors:true});p=await context.newPage();
  response=await p.goto(url,{waitUntil:'networkidle'});
 }
 p.on('pageerror',e=>result.pageErrors.push(e.message));p.on('console',e=>{if(e.type()==='error')result.consoleErrors.push(e.text());});
 // Reload with listeners installed so initialization errors are captured too.
 response=await p.reload({waitUntil:'networkidle'});const html=await response.body();
 Object.assign(result,{finalUrl:p.url(),status:response.status(),contentType:response.headers()['content-type'],sha256:hash(html)});
 check('real production URL',p.url()===url);check('HTTP 200',response.status()===200);check('delivered exact approved HTML',result.sha256===expectedSha256);
 if(!result.checks.every(c=>c.ok)){await p.screenshot({path:path.join(root,'unexpected-publication.png')});throw Error('Production HTML is not the approved publication');}
 await p.evaluate(()=>{openMachine(machines.find(m=>m.id==='horizontal'));machineProfile=MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length);machineReference=null;machineSavedBest=null;supportHeights=supports.map(()=>0);positions={X:0,Y:0,Z:0,A:0,C:0};selected=6;updateAxisValues();updateLeveling(false);setSceneView('front');selectAxis('X');});
 await p.evaluate(()=>document.fonts.ready);
 const read=()=>p.evaluate(()=>({record:levelRecord(),supports:[...supportHeights],positions:{...positions},label:$('liveSquarenessName').textContent,note:$('squarenessMeasurementNote').textContent,readings:geometryModel().pairs.map(pair=>{const m=referenceDisplayScan(pair),el=document.querySelector('#liveSquareness .live-pair-values[data-pair="'+pair.key+'"] .live-pair-error-value'),interval=document.querySelector('#measurementReferenceCards [data-reference-pair="'+pair.key+'"] .measurement-interval');return {key:pair.key,raw:m.microns,display:el.textContent,domRaw:Number(el.dataset.readingMicrons),startPosition:m.startPosition,endPosition:m.endPosition,interval:interval?{...interval.dataset}:null};})}));
 const snap=async name=>{const s={name,...await read()};result.states.push(s);await p.screenshot({path:path.join(root,name+'.png')});check(name+' endpoint label',s.label==='測定の終点値');for(const r of s.readings)check(name+' '+r.key+' DOM raw matches calculated reading',r.raw===r.domRaw);return s;};
 const axis=async value=>{await p.locator('#axisTabs .axis-tab').filter({hasText:'Y軸'}).click();await p.locator('#openTrainingMenu').click();if(!await p.locator('#axisMenuSection').evaluate(e=>e.open))await p.locator('#axisMenuSection summary').click();await p.locator('#axis-Y').fill(String(value));await p.locator('#axis-Y').dispatchEvent('input');await p.locator('#closeTrainingMenu').click();};
 const before=await snap('flat');await p.locator('#supportMap .map-point').nth(6).click();await p.locator('#coarseAdjust').click();await p.locator('#lowerSupport').click();const after=await snap('G-lower');
 check('actual G down button lowers 0.010mm',after.supports[6]===-.01);
 check('flat XY verified expected raw and integer',Math.abs(before.readings[0].raw-16.958999991)<1e-6&&before.readings[0].display.trim()==='+17',before.readings[0]);
 check('G down XY verified expected raw and integer',Math.abs(after.readings[0].raw-18.922717507)<1e-6&&after.readings[0].display.trim()==='+19',after.readings[0]);
 for(const value of [-100,100]){await axis(value);const s=await snap(value<0?'Y-minus100':'Y-plus100');for(const r of s.readings.filter(q=>q.key==='XY'||q.key==='YZ')){const d=r.interval,current=value*3,start=Math.min(current,0);check('Y '+value+' '+r.key+' interval matches current/zero/end/return',d&&Number(d.currentPositionMm)===current&&Number(d.zeroPositionMm)===start&&Number(d.endPositionMm)===start+300&&Number(d.returnTravelMm)===start-current,d);}}
 const saveState=await read();await p.locator('#openTrainingMenu').click();if(!await p.locator('.level-storage').evaluate(e=>e.open))await p.locator('.level-storage summary').click();
 const downloadPromise=p.waitForEvent('download');await p.locator('#exportLevel').click();const download=await downloadPromise,savedPath=path.join(root,'saved-horizontal.json');await download.saveAs(savedPath);
 const saved=JSON.parse(fs.readFileSync(savedPath));check('native JSON download matches current record',JSON.stringify(saved)===JSON.stringify(saveState.record));await p.locator('#closeTrainingMenu').click();
 await p.locator('#raiseSupport').click();await p.locator('#importLevel').setInputFiles(savedPath);await p.waitForFunction(()=>$('levelInputMessage').textContent.includes('読み込みました')||$('levelInputMessage').textContent.includes('読込できません'));
 const restored=await snap('restored');check('JSON read accepted',await p.locator('#levelInputMessage').textContent().then(t=>t.includes('読み込みました')));check('JSON load restores complete record',JSON.stringify(restored.record)===JSON.stringify(saveState.record));
 result.downloadName=download.suggestedFilename();check('no browser page exceptions',result.pageErrors.length===0);check('no browser console errors',result.consoleErrors.length===0);
 fs.writeFileSync(path.join(root,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({sha256:result.sha256,tlsBypass:result.tlsBypass,states:result.states.length,checks:result.checks.length,failures:result.checks.filter(c=>!c.ok)},null,2));await browser.close();process.exitCode=result.checks.every(c=>c.ok)?0:1;
})().catch(e=>{result.error=String(e.stack||e);fs.writeFileSync(path.join(root,'failed-run.json'),JSON.stringify(result,null,2));console.error(e);process.exitCode=1;});

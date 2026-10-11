'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const out=path.resolve('docs/qa-all-measurements-20261011/preview');fs.mkdirSync(out,{recursive:true});
const url='https://raw.githack.com/tgkfnfnfv9-stack/Training-tools/fc51b761c2677fcfe43bdbae1a279ecb25541d06/index.html',expectedSha256='a70468b143711048184e8983e0e5dc823da7db4fa3fa2babdd44a96ac081ba6c';
const report={url,commit:'fc51b761c2677fcfe43bdbae1a279ecb25541d06',expectedSha256,environment:'Linux real Chromium; 1280x1000; preview only, not GitHub Pages publication',tls:'TLS verification enabled; inherited environment proxy; environment CA trust',checks:{},errors:[]};
function write(){fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');}
(async()=>{let browser;try{
 const proxyURL=process.env.HTTPS_PROXY||process.env.HTTP_PROXY,proxy=proxyURL?new URL(proxyURL):null;
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox'],...(proxy?{proxy:{server:proxy.origin,...(proxy.username?{username:decodeURIComponent(proxy.username),password:decodeURIComponent(proxy.password)}:{})}}:{})});
 report.browser=browser.version();const page=await browser.newPage({viewport:{width:1280,height:1000},reducedMotion:'reduce'});page.setDefaultTimeout(20000);page.on('pageerror',error=>report.errors.push(error.message));
 let response=await page.goto(url,{waitUntil:'networkidle',timeout:45000});
 report.externalContentNotice=(await page.title()).includes('External Content Notice');
 if(report.externalContentNotice){await page.screenshot({path:path.join(out,'external-notice.png')});const navigation=page.waitForNavigation({waitUntil:'networkidle',timeout:45000});await page.getByText('Open the page',{exact:true}).click();response=await navigation;}
 report.finalUrl=page.url();report.httpStatus=response.status();report.contentType=response.headers()['content-type'];report.sha256=crypto.createHash('sha256').update(await response.body()).digest('hex');
 assert.equal(report.httpStatus,200);assert.equal(report.sha256,expectedSha256);report.checks.exactRemoteHTML=true;
 await page.locator('#mechanical').click();await page.locator('#leveling').click();await page.locator('#machineGrid .machine-card').filter({has:page.locator('#thumb-vertical')}).click();
 await page.evaluate(()=>{stopMotion();machineProfile=MachineAccuracy.generate('new',123456,machineLinearKeys(),supports.length);machineReference=null;machineSavedBest=null;supportHeights=supports.map(()=>0);positions={X:0,Y:0,Z:0,A:0,C:0};updateAxisValues();updateLeveling(false);});
 const compact=()=>page.evaluate(()=>({record:levelRecord(),YZ:{raw:referenceDisplayScan({key:'YZ'}).microns,dom:document.querySelector('.live-pair-values[data-pair="YZ"] .live-pair-error-value').textContent},supportHeights:[...supportHeights]}));
 report.compact={setup:'diagnostic reproducible new seed123456, all supports0, axes0; subsequent support movement uses real UI buttons',before:await compact()};
 await page.locator('#supportMap .map-point').nth(0).click();await page.locator('#coarseAdjust').click();await page.locator('#raiseSupport').click();report.compact.after=await compact();
 assert.deepEqual(report.compact.after.supportHeights,[.01,0,0,0]);assert.equal(report.compact.after.YZ.dom,'+13');assert.ok(Math.abs(report.compact.after.YZ.raw-12.528086201176)<1e-7);assert.equal(report.compact.after.record.machineProfile.seed,123456);report.checks.compactRealButtonYZ13=true;
 await page.screenshot({path:path.join(out,'compact-new-seed123456-A-plus0010.png')});fs.writeFileSync(path.join(out,'compact.input.json'),JSON.stringify(report.compact.after.record,null,2)+'\n');
 await page.evaluate(()=>{openMachine(machines.find(m=>m.id==='lathe'));stopMotion();machineProfile=null;machineReference=null;machineSavedBest=null;supportHeights=supports.map(()=>0);positions={X:0,Y:0,Z:0,A:0,C:0};updateAxisValues();updateLeveling(false);});
 report.lathe=[];
 for(const [width,depth,key] of [[3.2,1.68,'Z'],[4,.8,'X']]){
  await page.evaluate(({width,depth})=>{for(const [id,value] of [['supportWidth',width],['supportDepth',depth]]){const input=document.getElementById(id);input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));}},{width,depth});
  const state=await page.evaluate(()=>{const measured=latheInspectionGeometry();return {record:levelRecord(),faceX:measured.face,faceZ:measured.flat,validX:measured.faceScan.valid,validZ:measured.flatScan.valid,reasonX:measured.faceScan.reason,reasonZ:measured.flatScan.reason,dom:[...document.querySelectorAll('#liveSquareness svg')][1].querySelector('text:last-child').textContent,note:[...document.querySelectorAll('#liveSquareness section')][1].querySelector('p').textContent};});
  assert.equal(state['face'+key],null);assert.equal(state['valid'+key],false);assert.ok(state.dom.includes(key+' —'));assert.ok(state.note.includes('タレット面'+key+'の範囲外'));report.lathe.push({setup:'ideal diagnostic profile=null; zero supports and axes; hidden dimension input event',width,depth,invalidFace:key,...state});
 }
 report.checks.latheFiniteFacesInvalid=true;assert.equal(report.errors.length,0);report.checks.noBrowserErrors=true;report.passed=true;
 }catch(error){report.passed=false;report.failure=error.stack||String(error);process.exitCode=1;}finally{write();if(browser)await browser.close();console.log(JSON.stringify({...report,compact:report.compact?{before:report.compact.before.YZ,after:report.compact.after?.YZ}:undefined,lathe:report.lathe?.map(s=>({width:s.width,depth:s.depth,invalidFace:s.invalidFace,dom:s.dom,note:s.note})),failure:report.failure?.split('\n').slice(0,4).join('\n')},null,2));}})();

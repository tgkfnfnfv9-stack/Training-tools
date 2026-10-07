// New browser observations only; no expected dial signs derived from application tables.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const dir=__dirname,repo=path.resolve(dir,'../../..');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const out={date:new Date().toISOString(),source:'Public HTML fetched via HTTPS, then served verbatim by Playwright route in Chromium; not a live network page navigation.',localHash:hash(repo+'/index.html'),publicHash:hash(dir+'/published-index.html'),machines:[],checks:[],pageErrors:[]};
const check=(name,pass,details)=>out.checks.push({name,pass,details});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:3});
 page.on('pageerror',e=>out.pageErrors.push(e.message));
 await page.route('http://coordinate.audit/**',r=>r.fulfill({body:fs.readFileSync(dir+'/published-index.html'),contentType:'text/html'}));
 await page.goto('http://coordinate.audit/');
 const snapshot=()=>page.evaluate(()=>({positions:{...positions},heights:[...supportHeights],readings:levelGeometry.pairs.map(p=>{const m=referenceScan(p);return {pair:p.key,valid:m.valid,microns:m.microns,reason:m.reason}}),sweep:supportsSpindleSweep()?spindleSweepGeometry().cardinal?.map(p=>({reading:p.readingMicrons,onTable:p.onTable})):null}));
 for(const kind of ['compact','horizontal','travel','double','gantry','five','lathe']){
  await page.evaluate(kind=>{localStorage.clear();openMachine(machines.find(m=>m.kind===kind));initializeMachineAccuracy(MachineAccuracy.generate('used',78129,current.kind==='lathe'?['X','Z']:['X','Y','Z'],supports.length));positions={X:0,Y:0,Z:0,A:0,C:0};supportHeights=supports.map((s,i)=>[.025,-.012,.018,-.009,.005,-.011][i%6]);updateAxisValues();updateLeveling();},kind);
  const baseline=await snapshot();
  await page.screenshot({path:dir+'/'+kind+'-main.png'});
  const live=page.locator('.live-squareness-item');
  for(let i=0;i<await live.count();i++){const item=live.nth(i),pair=await item.locator('svg').getAttribute('data-pair');await item.screenshot({path:dir+'/'+kind+'-'+pair+'-live.png'});}
  await page.locator('#measurementReferenceToggle').click();
  const detail=await page.evaluate(()=>({name:current.name,axes:axisConfig(current),cards:[...document.querySelectorAll('.measurement-reference-card')].map(e=>({pair:e.dataset.referencePair,text:e.innerText,svg:e.querySelector('svg').outerHTML})),live:[...document.querySelectorAll('.live-squareness-diagram')].map(e=>({pair:e.dataset.pair,attributes:{...e.dataset},svg:e.outerHTML})),measurements:levelGeometry.pairs.map(p=>referenceScan(p))}));
  await page.locator('#closeMeasurementReference').click();
  await page.evaluate(()=>{yaw+=.63;sceneZoom=1.7;document.getElementById('exaggerate').checked=false;updateLeveling();});
  check(kind+' camera/zoom/exaggeration invariant',JSON.stringify(await snapshot())===JSON.stringify(baseline));
  await page.evaluate(()=>{changeSupportHeight(0,.01);changeSupportHeight(0,-.01);});
  check(kind+' support roundtrip',JSON.stringify(await snapshot())===JSON.stringify(baseline));
  const dl=page.waitForEvent('download');await page.evaluate(()=>document.getElementById('exportLevel').click());const download=await dl;const save=dir+'/'+kind+'-state.json';await download.saveAs(save);
  await page.evaluate(()=>{changeSupportHeight(0,.01);positions.X=53;updateLeveling();});
  await page.locator('#importLevel').setInputFiles(save);await page.waitForFunction(()=>document.getElementById('levelSaveStatus').textContent.includes('読み込みました'));
  check(kind+' real JSON export/import',JSON.stringify(await snapshot())===JSON.stringify(baseline));
  const limits=[];
  for(const axis of detail.axes.filter(a=>['X','Y','Z'].includes(a.key)))for(const value of [-100,100]){
   await page.evaluate(({key,value})=>{positions={X:0,Y:0,Z:0,A:0,C:0};positions[key]=value;updateAxisValues();updateLeveling();},{key:axis.key,value});
   limits.push({axis:axis.key,value,snapshot:await snapshot()});
  }
  check(kind+' travel endpoints finite or suppressed',limits.every(q=>q.snapshot.readings.every(m=>!m.valid||Number.isFinite(m.microns))),limits);
  const poses=[];
  if(kind==='five'){
   for(const state of [{A:20,C:0},{A:0,C:20},{A:20,C:35},{A:0,C:0}]){
    await page.evaluate(state=>{positions={X:0,Y:0,Z:0,A:0,C:0,...state};updateAxisValues();updateLeveling();},state);poses.push({state,snapshot:await snapshot()});
   }
   check('five rotated linear scans suppressed',poses.slice(0,3).every(q=>q.snapshot.readings.every(m=>!m.valid&&m.reason==='A/Cを0にして測定')));
   check('five A=C=0 restores readings',JSON.stringify(poses[3].snapshot)===JSON.stringify(baseline));
   await page.evaluate(()=>{positions.A=20;updateLeveling();});await page.screenshot({path:dir+'/five-A20-suppressed.png'});
  }
  out.machines.push({kind,baseline,...detail,poses});
 }
 await browser.close();fs.writeFileSync(dir+'/observations.json',JSON.stringify(out,null,2));
 console.log(JSON.stringify({publicMatchesLocal:out.localHash===out.publicHash,machines:out.machines.length,cards:out.machines.reduce((n,m)=>n+m.cards.length,0),checks:out.checks.length,failed:out.checks.filter(c=>!c.pass),pageErrors:out.pageErrors},null,2));
})().catch(e=>{fs.writeFileSync(dir+'/observations-error.txt',e.stack);console.error(e);process.exitCode=1});

'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const {chromium}=require('playwright'),{PNG}=require('pngjs');
const [mode,htmlArg,outArg,beforeArg]=process.argv.slice(2),out=path.resolve(outArg),beforeDir=beforeArg&&path.resolve(beforeArg);
const bytes=fs.readFileSync(path.resolve(htmlArg)),html=htmlArg.endsWith('.gz')?zlib.gunzipSync(bytes):bytes,hash=v=>crypto.createHash('sha256').update(v).digest('hex');
assert.ok(['before','after'].includes(mode));fs.mkdirSync(out,{recursive:true});
const smoke=process.env.FIXTURE_COMPAT_SMOKE==='1',ids=smoke?['vertical','lathe']:['vertical','travel','gate','gantry','five','lathe'],all=[...ids,'horizontal'];
const result={mode,smoke,htmlSha256:hash(html),snapshots:[],saves:[],errors:[],checks:[]};
const check=(name,ok,details)=>{result.checks.push({name,ok,details});};
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:1000},reducedMotion:'reduce'});page.on('pageerror',e=>result.errors.push(e.message));
 await page.route('http://fixture-compat.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 const init=async id=>{await page.goto('http://fixture-compat.test/');await page.evaluate(id=>{openMachine(machines.find(m=>m.id===id));machineProfile=MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length);machineReference=null;machineSavedBest=null;supportHeights=supports.map((p,i)=>i===1?.013:i===2?-.017:0);positions={X:37,Y:-62,Z:81,A:45,C:-33};$('exaggerate').checked=false;$('adjustStep').value='0.001';updateAxisValues();updateLeveling(false);},id);await page.evaluate(()=>document.fonts.ready);};
 const state=()=>page.evaluate(()=>({record:levelRecord(),readings:{squares:[...document.querySelectorAll('#liveSquareness .live-pair-values')].map(e=>({pair:e.dataset.pair,text:e.querySelector('.live-pair-error-value')?.textContent,raw:e.querySelector('.live-pair-error-value')?.dataset.readingMicrons})),lathe:$('liveSquareness').dataset.lathe?JSON.parse($('liveSquareness').dataset.lathe):null,sweep:[0,1,2,3].map(i=>({text:$('sweepValue'+i).textContent,raw:$('sweepValue'+i).dataset.readingMicrons}))}}));
 const snap=async name=>{await page.waitForTimeout(100);await page.screenshot({path:path.join(out,name+'.png')});result.snapshots.push({name,state:await state()});};
 for(const width of smoke?[390]:[1280,390]){
  await page.setViewportSize({width,height:width===1280?1000:844});
  for(const id of ids){await init(id);await snap(`${id}-${width}-first`);await page.locator('#inspectionNext').click();await snap(`${id}-${width}-second`);}
 }
 await page.setViewportSize({width:1280,height:1000});
 for(const id of all){
  await init(id);
  if(mode==='after'){
   // Deliberately diverge first, then use the native input's actual upload path.
   await page.locator('#supportMap .map-point').nth(0).click();await page.locator('#raiseSupport').click();
   await page.locator('#importLevel').setInputFiles(path.join(beforeDir,`saved-${id}.json`));
   await page.waitForFunction(()=>$('levelInputMessage').textContent.includes('読み込みました')||$('levelInputMessage').textContent.includes('読込できません'));
   check(id+' actual old JSON upload accepted',await page.locator('#levelInputMessage').textContent().then(t=>t.includes('読み込みました')));
  }
  const restored=await state();
  await page.locator('#openTrainingMenu').click();await page.locator('.level-storage summary').click();
  const downloadPromise=page.waitForEvent('download');await page.locator('#exportLevel').click();const download=await downloadPromise;
  const savedPath=path.join(out,`saved-${id}.json`);await download.saveAs(savedPath);const downloaded=JSON.parse(fs.readFileSync(savedPath));
  check(id+' native download contains current record',JSON.stringify(downloaded)===JSON.stringify(restored.record));
  result.saves.push({id,...restored,download:download.suggestedFilename()});
 }
 if(mode==='after'){
  const before=JSON.parse(fs.readFileSync(path.join(beforeDir,'results.json'))),input=r=>Object.fromEntries(Object.entries(r).filter(([k])=>k!=='bestState'));
  for(const snapshot of result.snapshots){
   const old=before.snapshots.find(s=>s.name===snapshot.name);check(snapshot.name+' browser state unchanged',JSON.stringify(snapshot.state)===JSON.stringify(old.state));
   const a=PNG.sync.read(fs.readFileSync(path.join(beforeDir,snapshot.name+'.png'))),b=PNG.sync.read(fs.readFileSync(path.join(out,snapshot.name+'.png')));let differing=-1;
   if(a.width===b.width&&a.height===b.height){differing=0;for(let i=0;i<a.data.length;i+=4)if(a.data[i]!==b.data[i]||a.data[i+1]!==b.data[i+1]||a.data[i+2]!==b.data[i+2]||a.data[i+3]!==b.data[i+3])differing++;}
   check(snapshot.name+' pixels identical',differing===0,{differingPixels:differing});
  }
  for(const restored of result.saves){
   const old=before.saves.find(s=>s.id===restored.id),protectedReadings=r=>({...r,squares:r.squares.filter(p=>restored.id!=='horizontal'||p.pair!=='YZ')});
   check(restored.id+' legacy inputs fully restored',JSON.stringify(input(restored.record))===JSON.stringify(input(old.record)));
   check(restored.id+' protected legacy readings unchanged',JSON.stringify(protectedReadings(restored.readings))===JSON.stringify(protectedReadings(old.readings)));
  }
 }
 check('no browser errors',result.errors.length===0,result.errors);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));await browser.close();
 console.log(JSON.stringify({mode,htmlSha256:result.htmlSha256,snapshots:result.snapshots.length,saves:result.saves.length,checks:result.checks.length,failed:result.checks.filter(c=>!c.ok)},null,2));process.exitCode=result.checks.some(c=>!c.ok)?1:0;
})().catch(error=>{fs.writeFileSync(path.join(out,'failed-run.json'),JSON.stringify({...result,error:String(error.stack||error)},null,2));console.error(error);process.exitCode=1;});

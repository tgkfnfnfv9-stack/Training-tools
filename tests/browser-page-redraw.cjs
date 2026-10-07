'use strict';
// Independent user-operation browser checks. State reads are observations only;
// transitions are clicks, keyboard input, file imports and browser navigation.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const html=fs.readFileSync(path.resolve(process.argv[2]||'index.html'));
const out=path.resolve('docs/qa-yz-redraw-20261007');fs.mkdirSync(out,{recursive:true});
const checks=[],events=[],errors=[];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const physicalRecord=r=>Object.fromEntries(Object.entries(r).filter(([k])=>k!=='bestState'));
const check=(name,ok,detail)=>checks.push({name,ok,...(detail===undefined?{}:{detail})});
(async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(req.url==='/away'?'<title>Away</title><p>Navigation test outside training</p>':html);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox'],ignoreDefaultArgs:['--disable-back-forward-cache']});
 const context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{window.auditPageshows=[];addEventListener('pageshow',e=>auditPageshows.push({persisted:e.persisted,when:performance.now()}));});
 const state=()=>p.evaluate(()=>({id:current.id,record:levelRecord(),selected,stage:adjustmentStage,positions:{...positions},initial:levelInitialGeometry?.pairs,current:levelGeometry?.pairs,view:{sceneView,sceneZoom},seed:machineProfile.seed}));
 const card=i=>p.locator('#machineGrid .machine-card').nth(i);
 const catalog=async()=>{if(await p.locator('#home').isVisible()){await p.locator('#mechanical').click();await p.locator('#leveling').click();}else if(await p.locator('#training').isVisible())await p.locator('#changeMachine').click();};
 const open=async i=>{await catalog();await card(i).click();await p.locator('#scene').waitFor({state:'visible'});return state();};
 const drawer=async()=>{if(!await p.locator('#trainingDrawer').isVisible())await p.locator('#openTrainingMenu').click();};
 const close=async()=>{if(await p.locator('#trainingDrawer').isVisible())await p.locator('#closeTrainingMenu').click();};
 const section=async selector=>{await drawer();if(!await p.locator(selector).getAttribute('open').then(v=>v!==null))await p.locator(selector+' > summary').click();};
 const imported=async data=>{await section('.level-storage');await p.locator('#importLevel').setInputFiles({name:'state.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await p.waitForFunction(seed=>machineProfile.seed===seed,data.machineProfile.seed);await p.waitForFunction(()=>document.querySelector('#levelInputMessage').textContent.includes('読み込みました'));};
 const fresh=(name,old,now,base)=>{
  check(name+' draws another individual',now.seed!==old.seed,{old:old.seed,new:now.seed});
  check(name+' support values reset to new initial values',same(now.record.heights,now.record.machineProfile.initialHeights));
  check(name+' axes reset',Object.values(now.positions).every(v=>v===0));
  check(name+' dimensions reset',now.record.width===base.record.width&&now.record.depth===base.record.depth&&now.record.columnX===0&&now.record.columnZ===0);
  check(name+' first support and coarse step reset',now.selected===0&&now.stage==='coarse'&&now.record.step===.01);
  check(name+' initial comparison is new current zero-travel state',same(now.initial,now.current),{initial:now.initial,current:now.current});
 };
 await p.goto(origin);
 if(process.argv[3]==='smoke'){
  const base=await open(0);await drawer();await close();check('final drawer preserves record',same((await state()).record,base.record));
  await p.locator('#raiseSupport').click();const old=await state(),now=await open(0);fresh('final same-card entry',old,now,base);
  check('no browser exceptions',errors.length===0,errors);
  const result={sha256:crypto.createHash('sha256').update(html).digest('hex'),checks,errors};
  fs.writeFileSync(path.join(out,'navigation-smoke-final.json'),JSON.stringify(result,null,2));await p.screenshot({path:path.join(out,'navigation-smoke-final.png')});
  await browser.close();await new Promise(resolve=>server.close(resolve));console.log(JSON.stringify(result,null,2));process.exitCode=checks.some(c=>!c.ok)?1:0;return;
 }
 for(let i=0;i<7;i++){
  const base=await open(i),id=base.id;
  await drawer();await close();check(id+' drawer preserves individual and full record',same((await state()).record,base.record));
  await p.locator('#supportMap button').last().click();await p.locator('#fineAdjust').click();await p.locator('#raiseSupport').click();
  let adjusted=await state();check(id+' support adjustment preserves seed and changes height',adjusted.seed===base.seed&&!same(adjusted.record.heights,base.record.heights));
  await section('#axisMenuSection');await p.locator('#drawerAxisSelect').selectOption('X');await p.locator('#axis-X').focus();await p.keyboard.press('Home');await p.keyboard.press('ArrowRight');
  check(id+' axis movement keeps individual', (await state()).seed===base.seed);
  await p.locator('#playAxis').click();await p.waitForTimeout(160);await section('#axisMenuSection');await p.locator('#playAxis').click();
  check(id+' live demo preserves individual', (await state()).seed===base.seed);
  await close();await p.locator('#measurementReferenceToggle').click();await p.locator('#closeMeasurementReference').click();
  check(id+' measurement panel preserves individual', (await state()).seed===base.seed);
  // Dimensions have no visible editor. Explicit JSON import is the supported
  // user path for non-default dimensions, and is independently round-tripped.
  // The old saved optimization hint is stale after editing dimensions; omit
  // that optional hint in the fixture so it can be recomputed. All physical fields must load exactly, and the resulting
  // complete record must then remain unchanged during drawer operations.
  const record=(await state()).record;record.width=3.21;record.depth=4.32;record.columnX=31;record.columnZ=-27;delete record.bestState;
  await imported(record);let loaded=await state();check(id+' explicit JSON restores physical state and individual',same(physicalRecord(loaded.record),physicalRecord(record)),{changedFields:Object.keys(record).filter(k=>!same(loaded.record[k],record[k]))});
  await close();await drawer();await close();check(id+' imported state survives drawer',same((await state()).record,loaded.record));
  const reentry=await open(i);fresh(id+' same-card reentry',loaded,reentry,base);
  events.push({id,initialSeed:base.seed,reentrySeed:reentry.seed});console.log(id+' complete');
 }
 // Different-machine entry followed by return to machine 1.
 let old=await open(0),base=old;await open(1);let now=await open(0);fresh('different-card roundtrip',old,now,base);
 await p.screenshot({path:path.join(out,'navigation-new-entry.png')});
 // Browser back from catalogue to a valid training history entry must reroll.
 old=await state();await p.locator('#changeMachine').click();await p.goBack();await p.locator('#training').waitFor({state:'visible'});now=await state();fresh('browser back',old,now,base);
 old=now;await p.goBack();await p.locator('#catalog').waitFor({state:'visible'});await p.goForward();await p.locator('#training').waitFor({state:'visible'});now=await state();fresh('browser forward',old,now,base);
 // Reload returns to the home entry; selecting machine 1 creates a fresh exercise.
 old=now;await p.reload();now=await open(0);fresh('reload then entry',old,now,base);
 // Navigate from an active exercise to another actual document,
 // and use native Back. This observes real persisted pageshow, not a synthetic event.
 old=await state();await p.goto(origin+'/away');await p.evaluate(()=>history.back());await p.waitForFunction(()=>document.querySelector('#home'));await p.waitForTimeout(200);
 const restoredTraining=await p.locator('#training').isVisible();if(!restoredTraining)now=await open(0);else now=await state();
 fresh('external document back',old,now,base);
 const bfcache=await p.evaluate(()=>auditPageshows);check('actual BFCache restore is exercised',bfcache.some(e=>e.persisted),bfcache);
 await p.screenshot({path:path.join(out,'navigation-browser-back.png')});
 // Export through real download, change support, then restore through the file picker.
 await section('.level-storage');const expected=(await state()).record;const downloadPromise=p.waitForEvent('download');await p.locator('#exportLevel').click();const download=await downloadPromise;const payload=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
 check('download preserves complete record',same(payload,expected));await close();await p.locator('#raiseSupport').click();await imported(payload);check('downloaded JSON import restores adjusted individual',same((await state()).record,payload));
 await p.screenshot({path:path.join(out,'navigation-explicit-import.png')});
 check('no browser JavaScript exceptions',errors.length===0,errors);
 const result={sha256:crypto.createHash('sha256').update(html).digest('hex'),browser:browser.version(),checks,events,bfcache,errors};fs.writeFileSync(path.join(out,'navigation-browser.json'),JSON.stringify(result,null,2));
 await browser.close();await new Promise(resolve=>server.close(resolve));
 console.log(JSON.stringify({checks:checks.length,passed:checks.filter(c=>c.ok).length,failed:checks.filter(c=>!c.ok),bfcache,sha256:result.sha256},null,2));process.exitCode=checks.some(c=>!c.ok)?1:0;
})().catch(e=>{console.error(e);process.exit(1);});

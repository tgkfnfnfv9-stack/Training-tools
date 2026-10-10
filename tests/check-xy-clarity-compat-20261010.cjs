'use strict';
// Targeted scope regression only: this comparison is not a physical sign oracle.
// Usage: node tests/check-xy-clarity-compat-20261010.cjs [immutable-before.html] [after.html]
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const beforePath=path.resolve(process.argv[2]||'/tmp/xy-clarity-compat-ea7498e/index.html'),afterPath=path.resolve(process.argv[3]||'index.html');
const out=path.resolve('docs/qa-xy-clarity-20261010'),hash=v=>crypto.createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v)).digest('hex');
const html={before:fs.readFileSync(beforePath),after:fs.readFileSync(afterPath)};
const ids=['vertical','travel','gate','gantry','five','lathe','horizontal'];
const result={scope:'Targeted regression against ea7498e; no physical correctness claim',environment:'Linux Chromium 1280x1000, real native JSON download/upload; not iPhone Safari',started:new Date().toISOString(),beforePath,afterPath,htmlSha256:Object.fromEntries(Object.entries(html).map(([k,v])=>[k,hash(v)])),captures:{before:[],after:[]},checks:[],errors:[]};
fs.mkdirSync(out,{recursive:true});
const check=(name,a,b)=>{const ok=JSON.stringify(a)===JSON.stringify(b);result.checks.push({name,ok,...(!ok?{before:a,after:b}:{})});};
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:1000},reducedMotion:'reduce'});
 page.on('pageerror',e=>result.errors.push(e.message));
 await page.route('http://xy-clarity-compat.test/**',route=>route.fulfill({contentType:'text/html',body:html[new URL(route.request().url()).pathname.slice(1)]}));
 const read=()=>page.evaluate(()=>{
  const g=geometryModel(),squares=g.pairs.map(pair=>{const m=referenceDisplayScan(pair);return {key:pair.key,valid:m.valid,raw:m.microns??null,text:m.valid?squarenessMicronText(m.microns):'—'};});
  const p=current.kind==='horizontal'?horizontalParallelism():null;
  const readings={squares,bar:p?{a:{valid:p.a.valid,raw:p.a.microns??null},b:{valid:p.b.valid,raw:p.b.microns??null}}:null,lathe:current.kind==='lathe'?latheInspectionGeometry():null,sweep:[0,1,2,3].map(i=>({text:$('sweepValue'+i).textContent,raw:$('sweepValue'+i).dataset.readingMicrons??null}))};
  const live=[...document.querySelectorAll('#liveSquareness .live-pair-values')].map(e=>({pair:e.dataset.pair,text:e.querySelector('.live-pair-error-value')?.textContent,raw:e.querySelector('.live-pair-error-value')?.dataset.readingMicrons}));
  const ui=Object.fromEntries(['liveSquareness','liveSquarenessName','liveSquarenessUnits','accuracyDiagram','accuracyMetrics','finePrecisionSummary','geometryStatus','measurementReferenceCards','squarenessMeasurementNote','sweepMeasurementNote','spindleSweepMini','sweepContactStatus','latheInspectionSecond'].filter(id=>$(id)).map(id=>[id,{text:$(id).textContent,markup:$(id).innerHTML,hidden:$(id).hidden}]));
  return {record:levelRecord(),readings,live,ui};
 });
 for(const phase of ['before','after'])for(const id of ids)for(const mode of ['new-central','used-offset']){
  await page.goto('http://xy-clarity-compat.test/'+phase);
  await page.evaluate(({id,mode})=>{
   openMachine(machines.find(m=>m.id===id));
   machineProfile=MachineAccuracy.generate(mode==='new-central'?'new':'used',123456,machineLinearKeys(),supports.length);
   machineReference=null;machineSavedBest=null;
   supportHeights=supports.map((p,i)=>mode==='new-central'?0:i===1?.013:i===2?-.017:0);
   positions=mode==='new-central'?{X:0,Y:0,Z:0,A:0,C:0}:{X:37,Y:-62,Z:81,A:45,C:-33};
   $('exaggerate').checked=false;$('adjustStep').value='0.001';updateAxisValues();updateLeveling(false);
  },{id,mode});
  const current=await read(),name=id+'/'+mode;
  const captured={id,mode,record:current.record,readings:current.readings,live:current.live,ui:Object.fromEntries(Object.entries(current.ui).map(([id,ui])=>[id,{text:ui.text,hash:hash(ui)}]))};
  // Exercise the browser's actual download, then upload that old record into
  // the new page after deliberately altering supports. The displayed values
  // after restoration are read afresh from the app.
  await page.locator('#openTrainingMenu').click();await page.locator('.level-storage summary').click();
  const downloading=page.waitForEvent('download');await page.locator('#exportLevel').click();const downloaded=await downloading;
  const savePath=path.join('/tmp','xy-clarity-compat-'+phase+'-'+id+'-'+mode+'.json');await downloaded.saveAs(savePath);
  captured.downloadedRecord=JSON.parse(fs.readFileSync(savePath));check(phase+'/'+name+' native download matches current record',captured.downloadedRecord,current.record);
  if(phase==='after'){
   const old=result.captures.before.find(s=>s.id===id&&s.mode===mode);
   check(name+' all raw measurement values unchanged',old.readings,current.readings);
   check(name+' integer measured display unchanged',old.live,current.live);
   check(name+' full save record unchanged',old.record,current.record);
   if(id!=='horizontal')check(name+' all protected measurement DOM/text unchanged',old.ui,captured.ui);
   await page.locator('#closeTrainingMenu').click();await page.locator('#supportMap .map-point').nth(0).click();await page.locator('#raiseSupport').click();
   const changed=await page.evaluate(()=>levelRecord());assert.notDeepEqual(changed.heights,current.record.heights,name+' support input actually diverged');
   await page.locator('#importLevel').setInputFiles(path.join('/tmp','xy-clarity-compat-before-'+id+'-'+mode+'.json'));
   await page.waitForFunction(()=>$('levelInputMessage').textContent.includes('読み込みました')||$('levelInputMessage').textContent.includes('読込できません'));
   captured.importMessage=await page.locator('#levelInputMessage').textContent();check(name+' actual old file upload accepted',true,captured.importMessage.includes('読み込みました'));
   const loaded=await read();captured.loaded={record:loaded.record,readings:loaded.readings,live:loaded.live};
   check(name+' restored full record',old.record,loaded.record);
   // Serialization excludes axes absent on a given machine. Their diagnostic
   // copies in lathe scan start/end metadata are normalized, never raw values.
   const normalize=(readings,record)=>{const copy=JSON.parse(JSON.stringify(readings));if(copy.lathe)for(const key of ['xStart','xEnd','zStart','zEnd'])if(copy.lathe[key])copy.lathe[key]=Object.fromEntries(Object.entries(copy.lathe[key]).filter(([axis])=>Object.hasOwn(record.axisPositions,axis)));return copy;};
   check(name+' restored raw measurements',normalize(old.readings,old.record),normalize(loaded.readings,loaded.record));
   check(name+' restored integer displays',old.live,loaded.live);
  }
  result.captures[phase].push(captured);
 }
 check('No browser exceptions',[],result.errors);check('Candidate HTML not edited during run',result.htmlSha256.after,hash(fs.readFileSync(afterPath)));
 result.finished=new Date().toISOString();fs.writeFileSync(path.join(out,'compatibility.json'),JSON.stringify(result,null,2));await browser.close();
 console.log(JSON.stringify({statesPerVersion:result.captures.before.length,checks:result.checks.length,failures:result.checks.filter(c=>!c.ok).map(c=>c.name),hashes:result.htmlSha256},null,2));process.exitCode=result.checks.some(c=>!c.ok)?1:0;
})().catch(e=>{fs.writeFileSync(path.join(out,'compatibility-failed.json'),JSON.stringify({...result,error:String(e.stack||e)},null,2));console.error(e);process.exitCode=1;});

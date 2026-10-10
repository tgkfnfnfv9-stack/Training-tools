'use strict';
// Real-browser independent check of the repaired qualitative measurement
// comparison. Expected compression comes from bisection of captured plane
// distances, not the production contact/compare or qualitative helper.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve('.'),html=fs.readFileSync(process.argv[2]||'index.html'),out=path.resolve(process.argv[3]||'docs/qa-yz-sign-recheck-20261010/browser/fine-summary/after');
fs.mkdirSync(out,{recursive:true});
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),distance=p=>t=>dot(p.normal,p.body.map((v,i)=>v+p.probe[i]*t-p.point[i]));
function extension(p){const f=distance(p);let lo=0,hi=.02,fl=f(lo);assert.ok(fl*f(hi)<=0,'physical contact must bracket within probe stroke');for(let i=0;i<65;i++){const mid=(lo+hi)/2;if(fl*f(mid)<=0)hi=mid;else{lo=mid;fl=f(mid);}}return (lo+hi)/2;}
const records=[],checks=[];let maxContactError=0;const check=(condition,message,detail={})=>{checks.push({message,pass:!!condition,...detail});assert.ok(condition,message);};
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),page=await browser.newPage({viewport:{width:1280,height:1000},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route('http://fine-audit.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 const init=async seed=>{await page.goto('http://fine-audit.test/');await page.evaluate(seed=>{openMachine(machines.find(m=>m.id==='horizontal'));machineProfile=seed===null?null:MachineAccuracy.generate('used',seed,machineLinearKeys(),supports.length);machineReference=null;machineSavedBest=null;positions={X:0,Y:0,Z:75,A:0,C:0};supportHeights=machineProfile?[...machineProfile.initialHeights]:supports.map(()=>0);$('adjustStep').value='0.01';updateAxisValues();updateLeveling(false);},seed);};
 const capture=async(name,screenshot=false)=>{
  const data=await page.evaluate(()=>{
   const g=geometryModel(),m=pair=>{const a=referenceDisplayScan(pair),b=levelInitialSolution?referenceDisplayScan(pair,positions,levelInitialSolution):null;return {key:pair.key,local:pair.deviationMicroradians,current:a,initial:b,row:{text:document.querySelector('#finePrecisionSummary [data-pair="'+pair.key+'"]').textContent,...document.querySelector('#finePrecisionSummary [data-pair="'+pair.key+'"]').dataset},integer:document.querySelector('#liveSquareness .live-pair-values[data-pair="'+pair.key+'"] .live-pair-error-value').textContent};};
   return {seed:machineProfile?.seed??null,positions:{...positions},heights:[...supportHeights],depth:levelConfig.depth,measurements:g.pairs.map(m),summary:document.querySelector('#finePrecisionSummary').innerHTML,localDiagram:document.querySelector('#accuracyDiagram').innerHTML};
  });
  for(const m of data.measurements){
   let current=null,initial=null;
   if(m.current.valid){current=(extension(m.current.start)-extension(m.current.end))*1e6;maxContactError=Math.max(maxContactError,Math.abs(current-m.current.microns));check(Math.abs(current-m.current.microns)<1e-6,name+' '+m.key+' raw agrees with independent contact');}
   if(m.initial?.valid){initial=(extension(m.initial.start)-extension(m.initial.end))*1e6;maxContactError=Math.max(maxContactError,Math.abs(initial-m.initial.microns));check(Math.abs(initial-m.initial.microns)<1e-6,name+' '+m.key+' initial agrees with independent contact');}
   const valid=current!==null&&initial!==null;
   if(valid){
    check(Math.abs(m.current.startPosition-m.initial.startPosition)<1e-12&&Math.abs(m.current.endPosition-m.initial.endPosition)<1e-12,name+' '+m.key+' initial/current same scan interval');
    const change=Math.abs(current)-Math.abs(initial),expected=Math.abs(change)<1e-8?'similar':change<-.01?'better':change>.01?'worse':null;
    if(expected)check(m.row.trend===expected,name+' '+m.key+' qualitative compares measured absolute reading',{expected,actual:m.row.trend,change});
    check(Math.abs(Number(m.row.current)-current)<1e-6&&Math.abs(Number(m.row.before)-initial)<1e-6,name+' '+m.key+' row metadata stores measurement um');
    check(m.row.model==='finite-scan'&&m.row.unit==='µm'&&m.row.text.startsWith(m.key+'測定：'),name+' '+m.key+' named quantity is measurement');
   }else{
    check(m.row.trend==='unavailable'&&m.row.valid==='false',name+' '+m.key+' invalid/no-baseline does not become zero comparison');
    if(current===null)check(m.row.current===''&&m.integer==='—',name+' '+m.key+' invalid measurement has no numeric zero');
    if(initial===null)check(m.row.before==='',name+' '+m.key+' missing initial has no numeric zero');
   }
   m.independent={current,initial,absoluteChange:valid?Math.abs(current)-Math.abs(initial):null};
  }
  records.push({name,...data});if(screenshot)await page.screenshot({path:path.join(out,name+'.png')});return data;
 };
 const drawer=async open=>{if(await page.locator('#trainingDrawer').isVisible()!==open)await page.locator(open?'#openTrainingMenu':'#closeTrainingMenu').click();};
 const unfold=async selector=>{if(!await page.locator(selector).evaluate(e=>e.open))await page.locator(selector+' > summary').click();};
 for(const seed of [2,3]){
  await init(seed);await capture('seed'+seed+'-initial',true);
  await drawer(true);await unfold('.adjustment-menu');await page.locator('#coarseExample').click();await drawer(false);await page.locator('#fineAdjust').click();const flat=await capture('seed'+seed+'-flat-main',true);
  check(flat.measurements.find(m=>m.key==='YZ').row.trend===(seed===2?'better':'worse'),'known opposite local/finite example seed'+seed+' repaired');
  await drawer(true);await page.locator('#finePrecisionSummary').scrollIntoViewIfNeeded();await capture('seed'+seed+'-flat-fine',true);await unfold('#finePanel .geometry-notes');await page.locator('#accuracyDiagram').scrollIntoViewIfNeeded();await capture('seed'+seed+'-flat-local',true);
  await unfold('#axisMenuSection');await page.locator('#drawerAxisSelect').selectOption('Z');await page.locator('#axis-Z').focus();
  for(const [key,suffix] of [['Home','minus100'],['End','plus100'],['ArrowLeft','plus99']]){await page.locator('#axis-Z').press(key);await capture('seed'+seed+'-axis-Z-'+suffix);}
  await page.locator('#drawerAxisSelect').selectOption('Y');await page.locator('#axis-Y').focus();await page.locator('#axis-Y').press('Home');await capture('seed'+seed+'-axis-Y-minus100');
  await drawer(false);await page.locator('#supportMap .map-point').nth(6).click();const before=await capture('seed'+seed+'-support-G-before');await page.locator('#raiseSupport').click();await capture('seed'+seed+'-support-G-plus001');await page.locator('#lowerSupport').click();const restored=await capture('seed'+seed+'-support-G-restored');
  for(let i=0;i<3;i++){check(Math.abs(restored.measurements[i].current.microns-before.measurements[i].current.microns)<1e-8,'seed'+seed+' '+before.measurements[i].key+' support reversal restores raw');check(restored.measurements[i].row.text===before.measurements[i].row.text,'seed'+seed+' '+before.measurements[i].key+' support reversal restores summary');}
  // Depth controls are intentionally hidden in product UI; this is an explicit
  // saved-state diagnostic fixture, not a claimed user click on a hidden input.
  await page.evaluate(()=>{levelConfig.depth=.5;$('supportDepth').value='.5';updateLeveling(false);});const invalid=await capture('seed'+seed+'-short-Z-invalid');check(invalid.measurements.find(m=>m.key==='YZ').current.valid===false,'short Z gives an actual physically invalid 300mm scan');
 }
 await init(null);await capture('ideal-no-initial-baseline');
 check(errors.length===0,'no browser page errors',{errors});
 const result={sha256:crypto.createHash('sha256').update(html).digest('hex'),states:records.length,checks:checks.length,maxContactErrorMicrons:maxContactError,errors,checksDetail:checks,records};fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));fs.writeFileSync(path.join(out,'index.html.gz'),zlib.gzipSync(html));console.log(JSON.stringify({sha256:result.sha256,states:result.states,checks:result.checks,maxContactErrorMicrons:maxContactError,errors},null,2));await browser.close();
})().catch(e=>{fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:e.stack,checks,records},null,2));console.error(e);process.exitCode=1;});

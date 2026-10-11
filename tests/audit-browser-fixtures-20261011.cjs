'use strict';
// Browser observations, NOT an independent physical oracle. All support changes
// in basic response matrix use Playwright real button clicks. null profile is a
// diagnostic (not a normally saved new/used individual). Fixture geometry/zero
// retention must be assessed by the separate independent audit.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{chromium}=require('playwright');
const tag=process.env.AUDIT_TAG||'before',root=process.env.AUDIT_ROOT||'/workspace/Training-tools-fixtures-before';
const html=fs.readFileSync(path.join(root,'index.html')),out=path.resolve('docs/qa-fixtures-20261011/browser',tag);
fs.mkdirSync(out,{recursive:true});const states=[],checks=[],errors=[],cases=[];
const check=(name,ok,detail)=>checks.push({name,ok,detail}),ids=process.env.AUDIT_IDS?process.env.AUDIT_IDS.split(','):['horizontal','lathe'];
const sha256=crypto.createHash('sha256').update(html).digest('hex'),commit=process.env.AUDIT_COMMIT||'c3768bc1a73832e73ae256fe598ba02a3fffd574';
function csvCell(v){return '"'+String(v??'').replaceAll('"','""')+'"';}
function write(){
 const report={tag,commit,sha256,environment:'Chromium /usr/bin/chromium Linux; desktop 1280x1000; touch-emulated mobile 390x844; real iPhone/Safari untested',semantics:'Main UI readings are fresh setup / start re-zero finite scans or explicitly located intrinsic components. Where available, comparison records separately show initial / retained fixture and zero / remounted readings; captureRecord, when present, gives the actual initial machine input. Product observations are not independent expectations.',states,checks,errors,cases};
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report));
 const rows=[['state','machine','condition','operation','measurement','raw_um','DOM','valid','reason','input_ref']];
 for(const s of states)for(const [key,m] of Object.entries(s.measurements))rows.push([s.name,s.id,s.condition,s.operation,key,m.raw,m.dom,m.valid,m.reason,s.name]);
 fs.writeFileSync(path.join(out,'measurements.csv'),rows.map(r=>r.map(csvCell).join(',')).join('\n')+'\n');
 const responseRows=[['state','machine','condition','support_operation','measurement','procedure','before_raw_um','after_raw_um','delta_um','before_DOM','after_DOM','classification','independent_expected_um','independent_status','input_ref']];
 const baselines=states.filter(s=>s.name.endsWith('-base')&&!s.name.includes('-view-')).sort((a,b)=>b.name.length-a.name.length);
 for(const state of states)if(state.operation.startsWith('real support button ')){const baseline=baselines.find(s=>s.id===state.id&&s.condition===state.condition&&state.name.startsWith(s.name.slice(0,-4)));if(!baseline)continue;for(const [key,value] of Object.entries(state.measurements)){const pre=baseline.measurements[key],valid=pre.valid&&value.valid,delta=valid?value.raw-pre.raw:null,classification=!valid?'invalid':Math.abs(delta)<1e-9?'raw-invariant':pre.dom===value.dom?'raw-changed-rounded-same':'integer-changed';responseRows.push([state.name,state.id,state.condition,state.operation,key,key.startsWith('TIR.')||key.startsWith('surface.')?'intrinsic component':key.startsWith('bore.')?(tag.startsWith('before')?'legacy nominal center circular section; a-left re-zero':'actual X/Z finite bore; a-left re-zero; retained-zero column recorded separately'):'UI fresh setup / start re-zero',pre.raw,value.raw,delta,pre.dom,value.dom,classification,'','separate independent audit; not a product-derived expected value',state.name]);}}
 fs.writeFileSync(path.join(out,'support-responses.csv'),responseRows.map(r=>r.map(csvCell).join(',')).join('\n')+'\n');
 const comparisonRows=[['state','machine','condition','operation','measurement','initial_raw_um','initial_DOM','held_raw_um','held_DOM','remounted_raw_um','remounted_DOM','holding','independent_expected_status']];
 for(const s of states)for(const row of s.comparison?.rows||[])comparisonRows.push([s.name,s.id,s.condition,s.operation,row.key,row.values.initial?.raw,row.values.initial?.dom,row.values.held?.raw,row.values.held?.dom,row.values.remounted?.raw,row.values.remounted?.dom,s.comparison.holding,'observed product UI; independent audit joins saved input separately']);
 fs.writeFileSync(path.join(out,'fixture-comparisons.csv'),comparisonRows.map(r=>r.map(csvCell).join(',')).join('\n')+'\n');
 fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({tag,commit,sha256,states:states.length,measurementRows:rows.length-1,checks:checks.length,failed:checks.filter(c=>!c.ok),errors},null,2));
}
(async()=>{
 if(process.env.AUDIT_SCOPE==='compare'){
  const dir=path.dirname(out),report={comparisons:[],checks:[]},csv=[['scope','state','measurement','before_raw_um','after_raw_um','difference_um','before_DOM','after_DOM','before_valid','after_valid','reason']];
  const physical=r=>Object.fromEntries(['machine','mode','width','depth','heights','axisPositions','machineProfile','columnX','columnZ','offset'].map(k=>[k,r[k]]));
  for(const suffix of ['', '-focus','-details','-stations','-fixture-stations','-boundaries']){
   const a=JSON.parse(fs.readFileSync(path.join(dir,'before'+suffix,'results.json'))),b=JSON.parse(fs.readFileSync(path.join(dir,'after'+suffix,'results.json'))),map=new Map(b.states.map(x=>[x.name,x])),stats={scope:suffix||'matrix',beforeStates:a.states.length,afterStates:b.states.length,matchedStates:0,matchedMeasurements:0,rawChanges:0,DOMChanges:0,becameInvalid:0,unchanged:0,byMachine:{}};
   for(const x of a.states){const y=map.get(x.name)||(suffix==='-details'?b.states.find(q=>q.id===x.id&&JSON.stringify(physical(q.record))===JSON.stringify(physical(x.record))&&JSON.stringify(q.ui.viewport)===JSON.stringify(x.ui.viewport)):undefined);if(y&&x.name.endsWith('-axis-demo-moving')){const p=physical(x.record),q=physical(y.record);delete p.axisPositions;delete q.axisPositions;report.checks.push({name:stats.scope+' '+x.name+' same individual/support/dimensions; timed axis position recorded separately',ok:JSON.stringify(p)===JSON.stringify(q)});(stats.nonComparableTimedMotion||=[]).push({name:x.name,beforeAxes:x.record.axisPositions,afterAxes:y.record.axisPositions,reason:'wall-clock animation sample; each state is checked against its actual input, but not treated as a same-position before/after pair'});continue;}report.checks.push({name:stats.scope+' '+x.name+' matched physical input',ok:!!y&&JSON.stringify(physical(x.record))===JSON.stringify(physical(y.record))});if(!y)continue;stats.matchedStates++;const mstats=stats.byMachine[x.id]||=( {measurements:0,rawChanges:0,DOMChanges:0,becameInvalid:0} );for(const [key,m] of Object.entries(x.measurements)){const n=y.measurements[key];if(!n){(stats.nonComparableMeasurementDefinitions||=[]).push({state:x.name,key,reason:'measurement location/definition changed; retained separately, not compared as the same quantity'});continue;}stats.matchedMeasurements++;mstats.measurements++;const rawChange=m.valid!==n.valid||(m.raw!==null&&n.raw!==null&&Math.abs(m.raw-n.raw)>1e-9),domChange=m.dom!==n.dom;if(rawChange){stats.rawChanges++;mstats.rawChanges++;}else stats.unchanged++;if(domChange){stats.DOMChanges++;mstats.DOMChanges++;}if(m.valid&&!n.valid){stats.becameInvalid++;mstats.becameInvalid++;}if(rawChange||domChange)csv.push([stats.scope,x.name,key,m.raw,n.raw,m.raw!==null&&n.raw!==null?n.raw-m.raw:null,m.dom,n.dom,m.valid,n.valid,n.reason]);}}
   const shots=kind=>fs.readdirSync(path.join(dir,kind+suffix)).filter(p=>p.endsWith('.png')).sort();if(suffix!=='-details')report.checks.push({name:stats.scope+' identical image filenames',ok:JSON.stringify(shots('before'))===JSON.stringify(shots('after'))});else stats.detailImagePairing='text length changes scroll count; compare same machine/input/viewport and retain complete before/after scroll sequences';stats.beforeImages=shots('before').length;stats.afterImages=shots('after').length;report.comparisons.push(stats);
  }
  report.failed=report.checks.filter(c=>!c.ok);fs.writeFileSync(path.join(dir,'comparison.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(dir,'before-after-changed-measurements.csv'),csv.map(r=>r.map(csvCell).join(',')).join('\n')+'\n');console.log(JSON.stringify({comparisons:report.comparisons,checks:report.checks.length,failed:report.failed}));process.exitCode=report.failed.length?1:0;return;
 }
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),page=await browser.newPage({viewport:{width:1280,height:1000},hasTouch:true,reducedMotion:'reduce',acceptDownloads:true});
 page.setDefaultTimeout(15000);await page.route('http://all-measurements.local/**',r=>r.fulfill({contentType:'text/html',body:html}));page.on('pageerror',e=>errors.push(e.message));
 let fixtureCapturedRecord=null;
 async function init(id,condition){fixtureCapturedRecord=null;await page.goto('http://all-measurements.local/');await page.locator('#mechanical').click();await page.locator('#leveling').click();await page.locator('#machineGrid .machine-card').filter({has:page.locator('#thumb-'+id)}).click();await page.evaluate(condition=>{stopMotion();machineProfile=condition==='ideal'?null:MachineAccuracy.generate(condition,123456,machineLinearKeys(),supports.length);machineReference=null;machineSavedBest=null;supportHeights=supports.map(()=>0);positions={X:0,Y:0,Z:0,A:0,C:0};updateAxisValues();updateLeveling(false);},condition);}
 async function menu(){if(!await page.locator('#closeTrainingMenu').isVisible())await page.locator('#openTrainingMenu').click();}
 async function closeMenu(){if(await page.locator('#closeTrainingMenu').isVisible())await page.locator('#closeTrainingMenu').click();}
 async function reveal(selector){await menu();await page.locator(selector).evaluate(e=>{for(let p=e.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});}
 async function slider(axis,value){await closeMenu();await page.locator('#axisTabs .axis-tab').filter({hasText:axis+'軸'}).click();await menu();await reveal('#axis-'+axis);await page.locator('#axis-'+axis).fill(String(value));await page.locator('#axis-'+axis).dispatchEvent('input');await closeMenu();}
 async function support(index,delta){await page.locator('#supportMap .map-point').nth(index).click();await page.locator(Math.abs(delta)===.001?'#fineAdjust':'#coarseAdjust').click();await page.locator(delta>0?'#raiseSupport':'#lowerSupport').click();}
 async function reset(){await page.evaluate(()=>{stopMotion();supportHeights=supports.map(()=>0);positions={X:0,Y:0,Z:0,A:0,C:0};updateAxisValues();updateLeveling(false);});}
 async function read(includeGeometry=false){const observation=await page.evaluate(includeGeometry=>{
  const measurements={},text=selector=>document.querySelector(selector)?.textContent.trim()??null,add=(k,raw,dom,valid=Number.isFinite(raw),reason=null)=>measurements[k]={raw:Number.isFinite(raw)?raw:null,dom,valid,reason};
  const intrinsic=IntrinsicInspection.fromProfile(machineProfile),g=geometryModel(),layout=axisConfig(current).map(a=>({key:a.key,part:a.part,vector:a.vector,amp:a.amp}));
  if(current.kind==='lathe'){
   const l=latheInspectionGeometry(),svg=[...document.querySelectorAll('#liveSquareness svg')],sections=[...document.querySelectorAll('#latheInspectionSecond section')];
   const runText=(svg[0]?[...svg[0].querySelectorAll('text')].map(e=>e.textContent).find(t=>/^a\s/.test(t)):null)??'',faceText=svg[1]?.querySelector('text:last-child')?.textContent??'';
   const runMatch=runText.match(/a\s+([^\s]+)\s+b\s+([^\s]+)/),faceMatch=faceText.match(/X\s+([^\s]+)\s+Z\s+([^\s]+)/);
   const runData=JSON.parse(document.querySelector('#liveSquareness').dataset.lathe||'{}').runout||intrinsic?.runout,finiteRunout=!!runData?.rootAxialMm;add(finiteRunout?'TIR.at50':'TIR.root',runData?.rootMicrons??(finiteRunout?null:0),runMatch?.[1]??runText,finiteRunout?runData.valid:true,finiteRunout?runData.reason:null);add(finiteRunout?'TIR.at350':'TIR.tip300',runData?.tipMicrons??(finiteRunout?null:0),runMatch?.[2]??runText,finiteRunout?runData.valid:true,finiteRunout?runData.reason:null);
   add('face.X',l.face,faceMatch?.[1],l.faceScan.valid,l.faceScan.reason);add('face.Z',l.flat,faceMatch?.[2],l.flatScan.valid,l.flatScan.reason);
   const boreText=sections[0]?[...sections[0].querySelectorAll('svg text')].map(t=>t.textContent):[],boreNote=sections[0]?.querySelector('p')?.textContent??'',noteMatch=boreNote.match(/(?:芯差|対向指示差) X\s+([^\s]+)／高さ\s+([^\s]+)/);
   ['a','b','c','d'].forEach((k,i)=>add('bore.'+k,l.bore.valid?l.bore.readings[i]:null,boreText[i]?.replace(/^[abcd]\s*/,''),!!l.bore.valid,l.bore.reason));add('bore.X',l.dx,noteMatch?.[1]);add('bore.height',l.dy,noteMatch?.[2]);
   const barText=sections[1]?[...sections[1].querySelectorAll('svg text')].map(t=>t.textContent):[];
   add('bar.side',l.barSide,barText.find(t=>t.startsWith('側面'))?.replace(/^側面（奥）\s*/,''),l.side.valid,l.side.reason);add('bar.top',l.barTop,barText.find(t=>t.startsWith('上面'))?.replace(/^上面\s*/,''),l.top.valid,l.top.reason);
  }else{
   for(const pair of g.pairs){const r=referenceDisplayScan(pair);add('square.'+pair.key,r.microns,text('.live-pair-values[data-pair="'+pair.key+'"] .live-pair-error-value'),r.valid,r.reason);}
   if(current.kind==='horizontal'){const h=horizontalParallelism();['a','b'].forEach((k,i)=>add('parallel.'+k,h[k].microns,text('#sweepValue'+i),h[k].valid,h[k].reason));}
   else {const s=spindleSweepGeometry(positions,levelSolution,machineProfile,1,current.kind==='compact'),zero=s.valid&&s.cardinal?.[3]?.onTable;['right','back','left','front'].forEach((k,i)=>{const q=s.cardinal?.[i],valid=!!(zero&&q?.onTable);add('sweep.'+k,valid?q.readingMicrons:null,text('#sweepValue'+i),valid,!zero?'zero-off-surface':!q?.onTable?'off-surface':null);});}
   const runTexts=[...document.querySelectorAll('#intrinsicRunoutDiagram svg text')].map(e=>e.textContent.replace(/^根元\s*|^300 mm先\s*|^50 mm\s*|^350 mm\s*/,'')),runDataset=document.querySelector('#intrinsicRunoutDiagram')?.dataset.runout,displayRunout=runDataset?JSON.parse(runDataset):intrinsic?.runout,finiteRunout=displayRunout&&'rootValid' in displayRunout;
   add(finiteRunout?'TIR.at50':'TIR.root',displayRunout?.rootMicrons,intrinsic?runTexts[0]:null,!!intrinsic&&(!finiteRunout||displayRunout.rootValid),!intrinsic?'profile-null: intrinsic page hidden':finiteRunout?displayRunout.reason:null);add(finiteRunout?'TIR.at350':'TIR.tip300',displayRunout?.tipMicrons,intrinsic?runTexts[1]:null,!!intrinsic&&(!finiteRunout||displayRunout.tipValid),!intrinsic?'profile-null: intrinsic page hidden':finiteRunout?displayRunout.reason:null);
   const surfaceTexts=[...document.querySelectorAll('#intrinsicSurfaceDiagram svg text')].map(e=>e.textContent);
   for(let i=0;i<9;i++)add('surface.p'+i,intrinsic?.surface.points[i]?.microns,intrinsic?surfaceTexts[i+2]:null,!!intrinsic,intrinsic?null:'profile-null: intrinsic page hidden');
   add('surface.range',intrinsic?.surface.rangeMicrons,intrinsic?surfaceTexts.at(-1)?.replace(/^差\s*/,''):null,!!intrinsic,intrinsic?null:'profile-null: intrinsic page hidden');
  }
  const fixtureObservations=!includeGeometry?null:current.kind==='lathe'?latheInspectionGeometry():{squares:Object.fromEntries(g.pairs.map(p=>{const r=referenceDisplayScan(p);return [p.key,{valid:r.valid,reason:r.reason,model:r.model,setup:r.setup,master:r.master,bracket:r.bracket,startPosition:r.startPosition,endPosition:r.endPosition,start:r.start,end:r.end,alignment:r.alignment}];})),parallel:horizontalParallelism()};
  const comparisonHost=document.querySelector('#fixtureComparison'),comparison=comparisonHost?{holding:comparisonHost.dataset.holding==='true',status:document.querySelector('#fixtureComparisonStatus')?.textContent,model:comparisonHost.dataset.comparison?JSON.parse(comparisonHost.dataset.comparison):null,rows:[...comparisonHost.querySelectorAll('[data-fixture-measurement]')].map(e=>({key:e.dataset.fixtureMeasurement,values:Object.fromEntries([...e.querySelectorAll('[data-reading]')].map(q=>[q.dataset.reading,{raw:q.dataset.raw,dom:q.querySelector('strong')?.textContent,detail:q.querySelector('small')?.textContent}]))}))}:null;
  const record=levelRecord();return {comparison,fixtureObservations:JSON.parse(JSON.stringify(fixtureObservations)),id:current.id,kind:current.kind,condition:machineProfile?.condition||'ideal',seed:machineProfile?.seed??null,record,supports:supports.map((s,i)=>({...s,height:supportHeights[i]})),layout,measurements,localAngles:g.pairs.map(p=>({key:p.key,microradians:p.deviationMicroradians})),ui:{fixture:document.querySelector('#fixtureSetup')?{selection:$('fixtureSelection').value,positionEnabled:!$('fixturePosition').disabled,setupStatus:$('fixtureSetupStatus').textContent,geometryOpen:!!($('fixtureGeometryDialog')?.open||$('fixtureGeometryDetails')?.open),geometry:($('fixtureGeometryDialog')?.open||$('fixtureGeometryDetails')?.open)&&$('fixtureGeometryCanvas').dataset.fixture?JSON.parse($('fixtureGeometryCanvas').dataset.fixture):null,geometryStatus:$('fixtureGeometryStatus').textContent,stage:$('fixtureStage').value,fraction:$('fixtureFraction').value,projection:$('fixtureProjection').value,framing:$('fixtureFraming')?.value}:null,page:intrinsicInspectionPage,selected,adjustmentStage,viewport:[innerWidth,innerHeight],overflow:document.documentElement.scrollWidth>innerWidth,storageStatus:$('levelSaveStatus').textContent}};
 },includeGeometry);if(observation.comparison)observation.comparison.captureRecord=observation.comparison.holding?fixtureCapturedRecord:null;return observation;}
 async function captureFixture(){await page.locator('#fixtureCapture').click();fixtureCapturedRecord=(await read()).record;}
 async function take(name,operation,shot=false,detail=false){const state={name,operation,...await read(shot)};states.push(state);if(shot){await page.screenshot({path:path.join(out,name+'.png')});fs.writeFileSync(path.join(out,name+'.input.json'),JSON.stringify(state.record,null,2));}if(detail)fs.writeFileSync(path.join(out,name+'.details.txt'),await page.locator('#measurementReference').innerText());return state;}
 const raw=s=>Object.fromEntries(Object.entries(s.measurements).map(([k,m])=>[k,m.raw]));
 for(const id of (['focus','details','settings','stations','interaction','fixture-stations','boundaries','paired-station-images'].includes(process.env.AUDIT_SCOPE)?[]:process.env.AUDIT_IDS?process.env.AUDIT_IDS.split(','):ids))for(const condition of (process.env.AUDIT_CONDITIONS?process.env.AUDIT_CONDITIONS.split(','):['ideal','new','used'])){
  await init(id,condition);const base=await take(`${id}-${condition}-base`,'diagnostic setup: all supports zero, implemented axes center');const count=base.supports.length,profileJSON=JSON.stringify(base.record.machineProfile??null);cases.push({id,condition,supportCount:count,baseline:base.name});
  for(let i=0;i<(process.env.AUDIT_SKIP_MATRIX?0:count);i++)for(const delta of [.001,-.001,.010,-.010]){
   const name=`${id}-${condition}-${String.fromCharCode(65+i)}${delta>0?'+':''}${delta.toFixed(3)}`;
   await support(i,delta);const after=await take(name,'real support button '+delta+' mm');
   check(name+' input',after.supports.every((s,j)=>Math.abs(s.height-(j===i?delta:0))<1e-12),after.supports.map(s=>s.height));check(name+' seed/profile retained',JSON.stringify(after.record.machineProfile??null)===profileJSON);
   await support(i,-delta);const back=await take(name+'-returned','real inverse support button');check(name+' round trip',JSON.stringify(raw(base))===JSON.stringify(raw(back))&&back.supports.every(s=>s.height===0));
  }
  if(condition==='used'){
   for(const axis of base.layout.map(a=>a.key))for(const v of [-100,100]){await slider(axis,v);const q=await take(`${id}-used-axis-${axis}${v}`,'real implemented axis range input');check(q.name+' input',q.record.axisPositions[axis]===v);await slider(axis,0);}
   if(id==='five'){await slider('A',25);await slider('C',40);await take('five-used-AC-nonzero','real A=25 C=40 slider positions');await slider('A',0);await slider('C',0);}
   for(const kind of ['uniform','right-plane','back-plane','twist-positive','twist-negative']){
    await page.evaluate(kind=>{supportHeights=supports.map(s=>kind==='uniform'?.01:kind==='right-plane'?.01*s.x:kind==='back-plane'?.01*s.z:(kind==='twist-positive'?1:-1)*.01*s.x*s.z);updateLeveling(false);},kind);await take(`${id}-used-${kind}`,'analytic diagnostic supports (not all points lie on UI lattice)');}
   await reset();
   // Display-only controls are real UI controls; save records contain the
   // existing exaggerate view preference, so compare physical inputs separately.
   const viewBase=await take(`${id}-used-view-base`,'display invariance baseline');
   for(const v of ['front','side','oblique']){await reveal('#sceneView');await page.locator('#sceneView').selectOption(v);await closeMenu();const q=await take(`${id}-used-view-${v}`,'real view select');check(q.name+' physical unchanged',JSON.stringify(raw(q))===JSON.stringify(raw(viewBase)));}
   for(const selector of ['#exaggerate','#showIdealOutline']){await reveal(selector);await page.locator(selector).uncheck();await closeMenu();const q=await take(`${id}-used-view-${selector.slice(1)}-off`,'real display checkbox');check(q.name+' physical unchanged',JSON.stringify(raw(q))===JSON.stringify(raw(viewBase)));await reveal(selector);await page.locator(selector).check();await closeMenu();}
   await page.locator('#scene').focus();await page.keyboard.press('+');const zoom=await take(`${id}-used-view-zoom`,'real canvas zoom key');check(zoom.name+' physical unchanged',JSON.stringify(raw(zoom))===JSON.stringify(raw(viewBase)));await page.keyboard.press('Home');
   await slider(base.layout[0].key,0);await reveal('#playAxis');await page.locator('#playAxis').click();await page.waitForTimeout(600);const moving=await take(`${id}-used-axis-demo-moving`,'real axis demo mid-motion');await page.waitForFunction(()=>motionFrame===null,{},{timeout:6500});const ended=await take(`${id}-used-axis-demo-ended`,'real axis demo completed');check(id+' demo moved',moving.record.axisPositions[base.layout[0].key]!==0);check(id+' demo returned',JSON.stringify(raw(ended))===JSON.stringify(raw(viewBase)));
   await closeMenu();
   // Dimensions are hidden in this UI. Record explicit diagnostic events,
   // without pretending these are visible user-operated controls.
   await page.evaluate(()=>{const e=$('supportWidth');e.value=String(levelConfig.width*1.1);e.dispatchEvent(new Event('input',{bubbles:true}));});await take(`${id}-used-width110pct`,'hidden dimension input event diagnostic');
   await page.evaluate(width=>{const e=$('supportWidth');e.value=String(width);e.dispatchEvent(new Event('input',{bubbles:true}));},base.record.width);
   await support(0,.01);const savedState=await take(`${id}-used-save-source`,'real A +0.010 then export');await reveal('#exportLevel');const downloadPromise=page.waitForEvent('download');await page.locator('#exportLevel').click();const download=await downloadPromise,savePath=path.join(out,`${id}-used-download.json`);await download.saveAs(savePath);const downloaded=JSON.parse(fs.readFileSync(savePath));check(id+' download exact input',JSON.stringify(downloaded)===JSON.stringify(savedState.record));await closeMenu();await support(0,.01);await reveal('#importLevel');await page.locator('#importLevel').setInputFiles(savePath);await page.waitForFunction(()=>$('levelSaveStatus').textContent.includes('読み込みました'));await closeMenu();const loaded=await take(`${id}-used-save-loaded`,'real file import');check(id+' save-load measurement/seed round trip',JSON.stringify(raw(savedState))===JSON.stringify(raw(loaded))&&JSON.stringify(savedState.record.machineProfile)===JSON.stringify(loaded.record.machineProfile));
   if(tag==='after'){
    const legacyFile=path.resolve(out,'../before',`${id}-used-download.json`);
    if(fs.existsSync(legacyFile)){
     const legacy=JSON.parse(fs.readFileSync(legacyFile)),expectedReject=legacy.calculationModel!==loaded.record.calculationModel;
     await reveal('#importLevel');await page.locator('#importLevel').setInputFiles(legacyFile);await page.waitForFunction(()=>$('levelSaveStatus').textContent.includes('読み込みました')||$('levelSaveStatus').textContent.includes('読込できません'));await closeMenu();
     const legacyState=await take(`${id}-used-legacy-import`,'real import of actual before download; reject only changed calculation model');
     check(id+' legacy import status',expectedReject?legacyState.ui.storageStatus.includes('計算仕様が異なる旧版'):legacyState.ui.storageStatus.includes('読み込みました'),{oldModel:legacy.calculationModel,newModel:loaded.record.calculationModel,status:legacyState.ui.storageStatus});
     check(id+' legacy import retains expected input and current readings',JSON.stringify(raw(legacyState))===JSON.stringify(raw(loaded))&&JSON.stringify(legacyState.record.machineProfile)===JSON.stringify(loaded.record.machineProfile));
    }
   }

   await reset();
   const boundaries=await page.evaluate(()=>{const found=[];for(const axis of axisConfig(current).filter(a=>['X','Y','Z'].includes(a.key))){const lo=geometryModel({...positions,[axis.key]:-100}),hi=geometryModel({...positions,[axis.key]:100}),starts=[...lo.toolPoints,lo.workPoint],ends=[...hi.toolPoints,hi.workPoint];for(let i=0;i<starts.length;i++)for(const coord of ['x','z']){const d=ends[i][coord]-starts[i][coord];if(Math.abs(d)<1e-12)continue;for(const s of supports){const fraction=(s[coord]-starts[i][coord])/d,value=-100+200*fraction;if(value>-99&&value<99&&!found.some(f=>f.axis===axis.key&&Math.abs(f.value-value)<1e-5))found.push({axis:axis.key,value,coordinate:coord,support:s.id||s.name,point:i});}}}return found;});
   for(const boundary of boundaries)for(const eps of [-1e-5,1e-5]){await page.evaluate(({axis,value})=>{positions={X:0,Y:0,Z:0,A:0,C:0,[axis]:value};supportHeights=supports.map(s=>.01*s.x*s.z);updateAxisValues();updateLeveling(false);},{axis:boundary.axis,value:boundary.value+eps});await take(`${id}-used-boundary-${boundary.axis}-${boundary.value.toFixed(5)}-${eps>0?'after':'before'}`,'diagnostic precise position at support-cell boundary '+JSON.stringify(boundary));}
   await reset();
   for(const demo of ['demoTwist','demoColumn']){await reveal('#'+demo);if(await page.locator('#'+demo).isDisabled()){check(id+' '+demo+' disabled constraint',id==='five');await closeMenu();continue;}await page.locator('#'+demo).click();await closeMenu();const q=await take(`${id}-used-${demo}`,'real posture/support demo button');check(q.name+' profile retained',JSON.stringify(q.record.machineProfile)===profileJSON);await page.evaluate(()=>{levelConfig.columnX=0;levelConfig.columnZ=0;$('columnX').value='0';$('columnZ').value='0';});await reset();}
  }
  console.log(`${tag}: ${id} ${condition}: ${states.length} states`);write();
 }
 if(!process.env.AUDIT_IDS&&!['focus','details','settings','stations','interaction','fixture-stations','boundaries','paired-station-images'].includes(process.env.AUDIT_SCOPE))for(const id of ids)for(const width of [1280,390]){
  await page.setViewportSize({width,height:width===390?844:1000});await init(id,'used');await support(1,.01);
  const prefix=`${id}-used-B+0.010-width${width}`;
  const first=await take(prefix+'-first','same fixed image input: used seed123456 B+0.010 axes center',true);check(prefix+' no document overflow',!first.ui.overflow);
  await page.locator('#measurementReferenceToggle').click();await take(prefix+'-reference','real measurement detail open',true,true);await page.locator('#closeMeasurementReference').click();
  await page.locator('#inspectionNext').click();await take(prefix+'-second','real second measurement page',true);await page.locator('#inspectionPrevious').click();
  if(id!=='lathe'){await page.locator('#spindleSweepToggle').click();await take(prefix+'-sweep-detail','real sweep/parallel detail open',true);fs.writeFileSync(path.join(out,prefix+'-sweep-detail.txt'),await page.locator('#spindleSweepSelection').innerText());await page.locator('#closeSpindleSweepSelection').click();}
  write();
 }
 if(process.env.AUDIT_SCOPE==='settings')for(const id of ids){
  await page.setViewportSize({width:1280,height:1000});await init(id,'used');await support(1,.01);await page.locator('#fineAdjust').click();await reveal('#finePanel');
  const prefix=`${id}-used-B+0.010-settings`,state=await take(prefix,'real B+0.010 and fine-stage selection; settings DOM capture');
  state.settingsDOM=await page.evaluate(()=>{
   const ids=['fineOverallProgress','fineHint','finePrecisionSummary','localSquarenessNote','comparisonContext','accuracyMetrics','accuracyComparison','machineProgress','geometryStatus','fineStatus'];
   const nodes=Object.fromEntries(ids.map(id=>{const e=$(id);return [id,{text:e.textContent,visible:!!(e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'),hidden:!!e.closest('[hidden]'),dataset:{...e.dataset}}];}));
   const rows=[...$('finePrecisionSummary').children].map(e=>({text:e.textContent,data:{...e.dataset}})),localAngles=[...$('accuracyDiagram').querySelectorAll('g[data-pair]')].map(e=>({...e.dataset}));
   const initialFinite=current.kind==='lathe'?null:Object.fromEntries(geometryModel(positions,levelInitialSolution,machineProfile).pairs.map(p=>{const r=referenceDisplayScan(p,positions,levelInitialSolution,machineProfile);return [p.key,{valid:r.valid,microns:r.microns,reason:r.reason}];}));
   return {nodes,rows,localAngles,initialFinite,rangeSamples:accuracyRange.map(s=>({state:s.state,pairs:s.geometry.pairs.map(p=>({key:p.key,errorMicrons:p.errorMicrons,deviationMicroradians:p.deviationMicroradians}))})),rangeDOM:[...$('accuracyMetrics').children].map(e=>({text:e.textContent,values:[...e.querySelectorAll('[data-value]')].map(v=>({id:v.id,value:Number(v.dataset.value)}))})),referenceCards:[...$('measurementReferenceCards').children].map(e=>e.textContent),axisControls:axisConfig(current).map(a=>{const e=$('axis-'+a.key);return {key:a.key,min:e.min,max:e.max,step:e.step,value:e.value,part:a.part};}),evaluation:{current:machineEvaluationFrom(accuracyRange,levelSolution),best:machineReference?.best.metric,initial:machineReference?.initial,bestHeights:machineReference?.best.heights},labelNote:'hidden DOM metrics are explicitly marked; they are not forced visible for screenshots'};
  });
  if(tag.startsWith('after'))for(const row of state.settingsDOM.rows){const key=row.data.pair;if(id==='lathe'){check(prefix+' lathe local-angle label',row.text.includes('局所角度'));continue;}const current=state.measurements['square.'+key],initial=state.settingsDOM.initialFinite[key];check(prefix+' '+key+' fine comparison is displayed finite scan',row.data.model==='finite-scan'&&Number(row.data.current)===current.raw&&Number(row.data.before)===initial.microns,{data:row.data,current:current.raw,initial:initial.microns});}
  await reveal('#finePanel');await page.locator('#fineStageTitle').scrollIntoViewIfNeeded();await take(prefix+'-fine','real settings fine-comment view',true);
  await reveal('#accuracyDiagram');await page.locator('#accuracyDiagram').scrollIntoViewIfNeeded();await take(prefix+'-local-angle','real settings local-angle view',true);
  await reveal('#machineProgress');await page.locator('#machineProgress').scrollIntoViewIfNeeded();await take(prefix+'-reference','real settings reference-adjustment view; hidden numeric table remains hidden',true);
  fs.writeFileSync(path.join(out,prefix+'.settings.json'),JSON.stringify(state.settingsDOM,null,2));await closeMenu();write();
 }
 if(process.env.AUDIT_SCOPE==='details')for(const id of ids)for(const width of [1280,390]){
  await page.setViewportSize({width,height:width===390?844:1000});await init(id,'used');await support(1,.01);await page.locator('#measurementReferenceToggle').click();
  const prefix=`${id}-used-B+0.010-width${width}-reference`,n=await page.locator('#measurementReferenceCards>.measurement-reference-card').count();
  for(let i=0;i<n;i++){
   const card=page.locator('#measurementReferenceCards>.measurement-reference-card').nth(i);
   const offsets=await card.evaluate(e=>{const sc=$('adjustmentSelectionScroll'),r=e.getBoundingClientRect(),s=sc.getBoundingClientRect(),top=sc.scrollTop+r.top-s.top;const svg=e.querySelector('svg'),diagram=svg?sc.scrollTop+svg.getBoundingClientRect().top-s.top:top+Math.max(0,(e.clientHeight-sc.clientHeight)/2);const last=top+Math.max(0,e.clientHeight-sc.clientHeight),offsets=[];for(let y=top;y<last;y+=Math.max(60,sc.clientHeight*.8))offsets.push(y);offsets.push(last);return offsets;});
   for(let j=0;j<offsets.length;j++){await page.locator('#adjustmentSelectionScroll').evaluate((e,v)=>e.scrollTop=v,offsets[j]);await take(prefix+`-card${i+1}-scroll${j+1}`,'real detail panel scroll; same supports/seed/axes',true);}
  }
  write();
 }
 if(process.env.AUDIT_SCOPE==='paired-station-images'){
  await page.setViewportSize({width:1280,height:1000});await init('horizontal','used');
  const manifest=JSON.parse(fs.readFileSync(path.resolve(out,'../station-manifest.json'))),station=manifest.stations.find(s=>s.id==='horizontal');
  if(tag.startsWith('after')){await page.locator('#fixtureSelection').selectOption('YZ');await page.locator('#fixturePosition').click();}
  else await page.evaluate(axes=>{positions={X:0,Y:0,Z:0,A:0,C:0,...axes};updateAxisValues();updateLeveling(false);},station.axes);
  await support(1,.010);const state=await take('horizontal-used-station-B+0.010-width1280-first','same standard dimensions / used123456 / actual station axes / real B+0.010 before and after',true);
  check('paired image actual axes',JSON.stringify(state.record.axisPositions)===JSON.stringify(station.axes));
 }
 if(process.env.AUDIT_SCOPE==='interaction'){
  for(const width of [1280,390])for(const id of ids){
   await page.setViewportSize({width,height:width===390?844:1000});await init(id,'used');
   const keys=(await page.locator('#fixtureSelection option').evaluateAll(es=>es.map(e=>e.value))).filter(key=>!process.env.AUDIT_FIXTURE_KEYS||process.env.AUDIT_FIXTURE_KEYS.split(',').includes(key));
   for(const key of keys){
    await init(id,'used');await page.locator('#fixtureSelection').selectOption(key);await page.locator('#fixturePosition').click();
    const prefix=`${id}-used-fixture-${key}-width${width}`,base=await take(prefix+'-station','real fixture selection and measurement-position button',true);
    await page.locator('#fixtureComparison>summary').click();await captureFixture();await support(1,.010);const supported=await take(prefix+'-B+0.010-held','real capture then support B+0.010',true);check(prefix+' support keeps fixture zero',supported.comparison.holding);
    const comparisonCount=await page.locator('#fixtureComparisonRows>[data-fixture-measurement]').count();
    for(let i=0;i<(process.env.AUDIT_FAST_SMOKE?Math.min(1,comparisonCount):comparisonCount);i++){await page.locator('#fixtureComparisonRows>[data-fixture-measurement]').nth(i).scrollIntoViewIfNeeded();await take(prefix+'-comparison-'+i,'real comparison row scroll',true);}
    if(await page.locator('#fixtureGeometryOpen').count())await page.locator('#fixtureGeometryOpen').click();else await page.locator('#fixtureGeometryDetails>summary').click();
    const stages=id==='horizontal'&&key!=='bar'&&!process.env.AUDIT_FAST_SMOKE?['S','R']:['S'];
    for(const stage of stages){if(stages.length>1)await page.locator('#fixtureStage').selectOption(stage);for(const fraction of (process.env.AUDIT_FAST_SMOKE?[0]:id==='lathe'&&key==='bore'?[0,25,50,75,100]:[0,100])){await page.locator('#fixtureFraction').fill(String(fraction));await page.locator('#fixtureFraction').dispatchEvent('input');for(const projection of ['oblique','front','side']){await page.locator('#fixtureProjection').selectOption(projection);await page.locator('#fixtureGeometryCanvas').scrollIntoViewIfNeeded();const viewed=await take(prefix+`-geometry-${stage}-${fraction}-${projection}`,'real fixture stage/scan/projection controls',true);check(viewed.name+' geometry controls preserve input/hold',JSON.stringify(viewed.record)===JSON.stringify(supported.record)&&viewed.comparison.holding);check(viewed.name+' no document overflow',!viewed.ui.overflow);if(!process.env.AUDIT_FAST_SMOKE||process.env.AUDIT_SMOKE_CHECK_GEOMETRY){const scene=viewed.ui.fixture.geometry;check(viewed.name+' finite selected fixture shapes and contact',!!scene&&scene.valid&&!scene.preview&&(scene.boxes?.length||scene.cylinders?.length||scene.segments?.length)&&(scene.contacts?.length||scene.contact),{valid:scene?.valid,reason:scene?.reason,preview:scene?.preview});const visible=await page.locator('#fixtureGeometryCanvas').evaluate(e=>{const r=e.getBoundingClientRect();let left=0,top=0,right=innerWidth,bottom=innerHeight;for(let p=e.parentElement;p;p=p.parentElement){const style=getComputedStyle(p);if(/auto|scroll|hidden|clip/.test(style.overflow+style.overflowX+style.overflowY)){const q=p.getBoundingClientRect();left=Math.max(left,q.left);right=Math.min(right,q.right);top=Math.max(top,q.top);bottom=Math.min(bottom,q.bottom);}}return {ok:r.left>=left-.5&&r.right<=right+.5&&r.top>=top-.5&&r.bottom<=bottom+.5,canvas:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},clip:{left,right,top,bottom}};});check(viewed.name+' entire canvas visible',visible.ok,visible);}}}}
    if(!process.env.AUDIT_FAST_SMOKE&&await page.locator('#fixtureFraming').count()){const prior=await page.locator('#fixtureFraming').inputValue();await page.locator('#fixtureFraming').selectOption(prior==='full'?'contact':'full');await page.locator('#fixtureProjection').selectOption('oblique');const framed=await take(prefix+'-geometry-alternate-framing','real full/contact framing select',true);check(framed.name+' framing preserves input/hold',JSON.stringify(framed.record)===JSON.stringify(supported.record)&&framed.comparison.holding);}
    if(await page.locator('#closeFixtureGeometry').isVisible())await page.locator('#closeFixtureGeometry').click();
    // Saving stores machine input; the intentionally temporary fixture/zero is
    // verified through real export/import rather than a direct state reset.
    if(key===keys[0]&&!process.env.AUDIT_FAST_SMOKE){
     const source=await take(prefix+'-save-source','held fixture + support B+0.010 before real export');await reveal('#exportLevel');const promise=page.waitForEvent('download');await page.locator('#exportLevel').click();const download=await promise,savePath=path.join(out,prefix+'-held-download.json');await download.saveAs(savePath);const saved=JSON.parse(fs.readFileSync(savePath));check(prefix+' export contains exact machine input',JSON.stringify(saved)===JSON.stringify(source.record));await closeMenu();
     await reveal('#importLevel');await page.locator('#importLevel').setInputFiles(savePath);await page.waitForFunction(()=>$('levelSaveStatus').textContent.includes('読み込みました'));await closeMenu();const imported=await take(prefix+'-save-imported','real import of held-fixture export',true);check(prefix+' import keeps machine input and clears temporary fixture',JSON.stringify(imported.record)===JSON.stringify(source.record)&&!imported.comparison.holding,{status:imported.ui.storageStatus,holding:imported.comparison.holding});
    }
    await captureFixture();const capture=await take(prefix+'-axis-release-before','real recapture before axis move');const axis=id==='horizontal'?'X':'Z',currentAxis=capture.record.axisPositions[axis],value=Math.max(-100,Math.min(100,Math.round(currentAxis)+(currentAxis>=99?-1:1)));await slider(axis,value);const moved=await take(prefix+'-axis-release-after','real axis slider move releases held fixture',true);check(prefix+' axis change clears fixture/zero',!moved.comparison.holding&&moved.record.axisPositions[axis]===value,{holding:moved.comparison.holding,status:moved.comparison.status});
    write();console.log(`${tag}: ${prefix}: ${states.length} states`);
   }
  }
 }
 if(process.env.AUDIT_SCOPE==='boundaries'){
  const manifestPath=path.resolve(out,'../boundary-manifest.json'),beforeManifest=tag.startsWith('before')?JSON.parse(fs.readFileSync(manifestPath)):null,manifest=[];
  const definitions=[{key:'width',boundary:.64/1.45*2.72,validAbove:true},{key:'depth',boundary:.32/.37*3.68,validAbove:true},{key:'columnX',boundary:(.55-.15)/.68*100,validAbove:false},{key:'columnZ',boundary:(-.45+.08+.32)/.46*100,validAbove:true}];
  const cases=definitions.flatMap(d=>[-.000001,.000001].map(e=>({key:d.key,value:d.boundary+e,valid:e>0?d.validAbove:!d.validAbove,method:'diagnostic exact finite-station boundary'}))).concat([{key:'columnX',value:58,valid:true},{key:'columnX',value:59,valid:false},{key:'columnZ',value:-11,valid:false},{key:'columnZ',value:-10,valid:true}].map(x=>({...x,method:'real integer column-position slider'})));
  for(const width of [1280,390])for(const c of cases){
   await page.setViewportSize({width,height:width===390?844:1000});await init('horizontal','ideal');const name=`horizontal-ideal-station-boundary-${c.key}-${c.value.toFixed(6)}-width${width}`;
   if(tag.startsWith('after')){
    if(c.method.startsWith('real')){await reveal('#'+c.key);await page.locator('#'+c.key).fill(String(c.value));await page.locator('#'+c.key).dispatchEvent('input');await closeMenu();}
    else await page.evaluate(c=>{if(c.key==='width'||c.key==='depth'){const el=$(c.key==='width'?'supportWidth':'supportDepth');el.value=String(c.value);el.dispatchEvent(new Event('input',{bubbles:true}));}else {levelConfig[c.key]=c.value;$(c.key).value=String(c.value);updateLeveling(false);}},c);
    const available=await page.locator('#fixturePosition').isEnabled();check(name+' independently specified station availability',available===c.valid,{expected:c.valid,actual:available});if(available)await page.locator('#fixturePosition').click();
   }else {
    const r=beforeManifest.find(x=>x.name===name).record;await page.evaluate(r=>{for(const [id,v] of [['supportWidth',r.width],['supportDepth',r.depth]]){const el=$(id);el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));}levelConfig.columnX=r.columnX;levelConfig.columnZ=r.columnZ;positions={X:0,Y:0,Z:0,A:0,C:0,...r.axisPositions};updateAxisValues();updateLeveling(false);},r);
   }
   const state=await take(name,c.method+'; before uses exactly the after input',true);manifest.push({name,expectedAvailable:c.valid,record:state.record});
  }
  if(tag.startsWith('after'))fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2));
 }
 if(process.env.AUDIT_SCOPE==='fixture-stations'){
  const manifestPath=path.resolve(out,'../station-manifest.json');let manifest;
  if(tag.startsWith('after')){
   const selections=[];
   for(const id of ids){await init(id,'used');const choices=await page.locator('#fixtureSelection option').evaluateAll(es=>es.map(e=>({key:e.value,label:e.textContent})));for(const choice of choices){await init(id,'used');await page.locator('#fixtureSelection').selectOption(choice.key);await page.locator('#fixturePosition').click();const value=await read();selections.push({id,...choice,axes:value.record.axisPositions,width:value.record.width,depth:value.record.depth});}}
   const stations=[];for(const selection of selections){const existing=stations.find(s=>s.id===selection.id&&JSON.stringify(s.axes)===JSON.stringify(selection.axes));if(existing)existing.coveredFixtures.push(selection.key);else stations.push({...selection,coveredFixtures:[selection.key]});}
   manifest={source:'actual revised UI fixture select + measurement-position button; observed destinations only, not expected measurements',sha256,selections,stations};fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2));
  }else manifest=JSON.parse(fs.readFileSync(manifestPath));
  for(const item of manifest.stations)for(const condition of ['ideal','new','used']){
   await init(item.id,condition);
   if(tag.startsWith('after')){await page.locator('#fixtureSelection').selectOption(item.key);await page.locator('#fixturePosition').click();await page.locator('#fixtureComparison>summary').click();await captureFixture();}
   else await page.evaluate(axes=>{stopMotion();positions={X:0,Y:0,Z:0,A:0,C:0,...axes};updateAxisValues();updateLeveling(false);},item.axes);
   const prefix=`${item.id}-${condition}-fixture-${item.key}`,base=await take(prefix+'-base',tag.startsWith('after')?'real measurement-position and fixture/zero capture buttons':'before diagnostic actual axes matching revised fixture station');
   check(prefix+' expected destination input',JSON.stringify(base.record.axisPositions)===JSON.stringify(item.axes));if(tag.startsWith('after'))check(prefix+' holding enabled',base.comparison.holding);
   cases.push({id:item.id,condition,fixture:item.key,coveredFixtures:item.coveredFixtures,baseline:base.name});
   for(let i=0;i<base.supports.length;i++)for(const delta of [.001,-.001,.010,-.010]){
    const name=`${prefix}-${String.fromCharCode(65+i)}${delta>0?'+':''}${delta.toFixed(3)}`;
    await support(i,delta);const after=await take(name,'real support button '+delta+' mm');check(name+' support input',after.supports.every((s,j)=>Math.abs(s.height-(j===i?delta:0))<1e-12));if(tag.startsWith('after'))check(name+' old fixture and zero retained',after.comparison.holding&&JSON.stringify(after.comparison.model.initial)===JSON.stringify(base.comparison.model.initial));
    await support(i,-delta);const back=await take(name+'-returned','real inverse support button');check(name+' input/raw round trip',JSON.stringify(raw(back))===JSON.stringify(raw(base))&&back.supports.every(s=>s.height===0));
   }
   write();console.log(`${tag}: ${prefix}: ${states.length} states`);
  }
 }
 if(process.env.AUDIT_SCOPE==='stations'){
  async function station(){
   if(tag.startsWith('after')&&process.env.AUDIT_LATHE_BORE_BUTTON){await closeMenu();await page.locator(process.env.AUDIT_LATHE_BORE_BUTTON).click();}
   else await page.evaluate(()=>{stopMotion();positions={X:-.20/.35*100,Y:0,Z:-100,A:0,C:0};updateAxisValues();updateLeveling(false);});
  }
  for(const condition of ['ideal','new','used']){
   await init('lathe',condition);await station();const base=await take(`lathe-${condition}-station-bore-base`,tag.startsWith('after')&&process.env.AUDIT_LATHE_BORE_BUTTON?'real hole measurement-position button':'before diagnostic actual axes matching revised hole measurement station');
   check(base.name+' actual axes',Math.abs(base.record.axisPositions.X+.20/.35*100)<1e-10&&base.record.axisPositions.Z===-100);
   for(let i=0;i<base.supports.length;i++)for(const delta of [.001,-.001,.010,-.010]){
    const name=`lathe-${condition}-station-bore-${String.fromCharCode(65+i)}${delta>0?'+':''}${delta.toFixed(3)}`;
    await support(i,delta);await take(name,'real support button '+delta+' mm');await support(i,-delta);const back=await take(name+'-returned','real inverse support button');check(name+' same input round trip',JSON.stringify(raw(back))===JSON.stringify(raw(base))&&back.supports.every(s=>s.height===0));
   }
   for(const epsilon of [-.00001,0,.00001]){const value=(.350-.865)/.007+epsilon;await page.evaluate(Z=>{positions.Z=Z;updateAxisValues();updateLeveling(false);},value);await take(`lathe-${condition}-station-bore-reach350-${epsilon}`,'diagnostic exact tool-reach boundary Z='+value);}
   write();
  }
  for(const width of [1280,390])for(const condition of ['ideal','new','used']){
   await page.setViewportSize({width,height:width===390?844:1000});await init('lathe',condition);await station();await support(1,.010);
   const prefix=`lathe-${condition}-station-bore-B+0.010-width${width}`;
   await take(prefix+'-first','station support B+0.010 same actual axes',true);await page.locator('#inspectionNext').click();await take(prefix+'-second','real second page at hole measurement station',true);await page.locator('#inspectionPrevious').click();await page.locator('#measurementReferenceToggle').click();await take(prefix+'-reference','real measurement detail at hole station',true,true);await page.locator('#closeMeasurementReference').click();
   write();
  }
 }
 if(process.env.AUDIT_SCOPE==='focus'){
  for(const width of [1280,390])for(const id of ids){
   await page.setViewportSize({width,height:width===390?844:1000});
   for(const condition of ['ideal','new','used']){
    await init(id,condition);await take(`${id}-${condition}-center-width${width}-first`,'focus all supports0 axes0',true);
    await support(1,.010);await take(`${id}-${condition}-B+0.010-width${width}-first`,'focus real B+0.010',true);
    await page.locator('#measurementReferenceToggle').click();await take(`${id}-${condition}-B+0.010-width${width}-reference`,'focus real finite fixture detail',true,true);await page.locator('#closeMeasurementReference').click();
    if(await page.locator('#inspectionNext').isVisible()){await page.locator('#inspectionNext').click();await take(`${id}-${condition}-B+0.010-width${width}-second`,'focus real second page',true);await page.locator('#inspectionPrevious').click();}
   }
   const dims=id==='lathe'?[[3.2,1.68],[4,.8],[.5,.5],[20,20]]:[[.5,.5],[2.72,2.64],[20,20]];
   for(const pair of dims){
    await init(id,'ideal');await page.evaluate(([width,depth])=>{for(const [id,value] of [['supportWidth',width],['supportDepth',depth]]){const e=$(id);e.value=String(value);e.dispatchEvent(new Event('input',{bubbles:true}));}},pair);
    const prefix=`${id}-ideal-width${pair[0]}-depth${pair[1]}-viewport${width}`;
    await take(prefix+'-first','focus hidden dimension input event; ideal supports0 axes0',true);
    await page.locator('#measurementReferenceToggle').click();await take(prefix+'-reference','focus finite fixture detail',true,true);await page.locator('#closeMeasurementReference').click();
    if(await page.locator('#inspectionNext').isVisible()){await page.locator('#inspectionNext').click();await take(prefix+'-second','focus second page / bore',true);await page.locator('#inspectionPrevious').click();}
   }
   write();
  }
 }
 for(const state of states)for(const [key,m] of Object.entries(state.measurements))if(m.valid){const rounded=Math.round(Math.abs(m.raw))*(m.raw<0?-1:1);check(state.name+' '+key+' DOM integer',m.dom!==null&&Number(m.dom)===rounded,{raw:m.raw,dom:m.dom,rounded});}
 for(const state of states)for(const row of state.comparison?.rows||[])for(const [column,reading] of Object.entries(row.values)){if(reading.raw!==''){const raw=Number(reading.raw),rounded=Math.round(Math.abs(raw))*(raw<0?-1:1);check(state.name+' '+row.key+' '+column+' comparison DOM integer',Number(reading.dom)===rounded,{raw,dom:reading.dom});check(state.name+' '+row.key+' '+column+' raw display',Math.abs(Number(reading.detail.replace(/^生値\s*/,''))-raw)<=.00000051,{raw,detail:reading.detail});}else check(state.name+' '+row.key+' '+column+' invalid comparison DOM',reading.dom==='—',reading);}
 for(const state of states)for(const [key,m] of Object.entries(state.measurements))if(!m.valid&&!String(m.reason).includes('profile-null'))check(state.name+' '+key+' invalid DOM',m.dom==='—',{dom:m.dom,reason:m.reason});
 check('no browser exceptions',errors.length===0,errors);write();await browser.close();console.log(JSON.stringify({tag,states:states.length,checks:checks.length,failed:checks.filter(c=>!c.ok),errors}));process.exitCode=checks.some(c=>!c.ok)?1:0;
})().catch(e=>{errors.push(e.stack);write();console.error(e);process.exit(1);});

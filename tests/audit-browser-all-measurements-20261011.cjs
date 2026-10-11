'use strict';
// Browser observations, NOT an independent physical oracle. All support changes
// in basic response matrix use Playwright real button clicks. null profile is a
// diagnostic (not a normally saved new/used individual). Fixture geometry/zero
// retention must be assessed by the separate independent audit.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{chromium}=require('playwright');
const tag=process.env.AUDIT_TAG||'before',root=process.env.AUDIT_ROOT||'/workspace/Training-tools-before';
const html=fs.readFileSync(path.join(root,'index.html')),out=path.resolve('docs/qa-all-measurements-20261011/browser',tag);
fs.mkdirSync(out,{recursive:true});const states=[],checks=[],errors=[],cases=[];
const check=(name,ok,detail)=>checks.push({name,ok,detail}),ids=['vertical','horizontal','travel','gate','gantry','five','lathe'];
const sha256=crypto.createHash('sha256').update(html).digest('hex'),commit=process.env.AUDIT_COMMIT||'baede5bfafed034f5f7d21ec9957e344dc7c8c98';
function csvCell(v){return '"'+String(v??'').replaceAll('"','""')+'"';}
function write(){
 const report={tag,commit,sha256,environment:'Chromium /usr/bin/chromium Linux; desktop 1280x1000; touch-emulated mobile 390x844; real iPhone/Safari untested',semantics:'UI readings are fresh setup / start re-zero finite scan or intrinsic components. This browser capture does not claim initial fixture/zero retention.',states,checks,errors,cases};
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report));
 const rows=[['state','machine','condition','operation','measurement','raw_um','DOM','valid','reason','input_ref']];
 for(const s of states)for(const [key,m] of Object.entries(s.measurements))rows.push([s.name,s.id,s.condition,s.operation,key,m.raw,m.dom,m.valid,m.reason,s.name]);
 fs.writeFileSync(path.join(out,'measurements.csv'),rows.map(r=>r.map(csvCell).join(',')).join('\n')+'\n');
 const responseRows=[['state','machine','condition','support_operation','measurement','procedure','before_raw_um','after_raw_um','delta_um','before_DOM','after_DOM','classification','independent_expected_um','independent_status','input_ref']];
 const baselines=new Map(states.filter(s=>s.name.endsWith('-base')&&!s.name.includes('-view-')).map(s=>[s.id+'|'+s.condition,s]));
 for(const state of states)if(state.operation.startsWith('real support button ')){const baseline=baselines.get(state.id+'|'+state.condition);if(!baseline)continue;for(const [key,value] of Object.entries(state.measurements)){const pre=baseline.measurements[key],valid=pre.valid&&value.valid,delta=valid?value.raw-pre.raw:null,classification=!valid?'invalid':Math.abs(delta)<1e-9?'raw-invariant':pre.dom===value.dom?'raw-changed-rounded-same':'integer-changed';responseRows.push([state.name,state.id,state.condition,state.operation,key,key.startsWith('TIR.')||key.startsWith('surface.')?'intrinsic component':key.startsWith('bore.')?'fixed nominal center; a-left re-zero':'UI fresh setup / start re-zero',pre.raw,value.raw,delta,pre.dom,value.dom,classification,'','separate independent audit; not a product-derived expected value',state.name]);}}
 fs.writeFileSync(path.join(out,'support-responses.csv'),responseRows.map(r=>r.map(csvCell).join(',')).join('\n')+'\n');
 fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({tag,commit,sha256,states:states.length,measurementRows:rows.length-1,checks:checks.length,failed:checks.filter(c=>!c.ok),errors},null,2));
}
(async()=>{
 if(process.env.AUDIT_SCOPE==='compare'){
  const dir=path.dirname(out),report={comparisons:[],checks:[]},csv=[['scope','state','measurement','before_raw_um','after_raw_um','difference_um','before_DOM','after_DOM','before_valid','after_valid','reason']];
  const physical=r=>Object.fromEntries(['machine','mode','width','depth','heights','axisPositions','machineProfile','columnX','columnZ','offset'].map(k=>[k,r[k]]));
  for(const suffix of ['', '-focus','-details','-settings']){
   const a=JSON.parse(fs.readFileSync(path.join(dir,'before'+suffix,'results.json'))),b=JSON.parse(fs.readFileSync(path.join(dir,'after'+suffix,'results.json'))),map=new Map(b.states.map(x=>[x.name,x])),stats={scope:suffix||'matrix',beforeStates:a.states.length,afterStates:b.states.length,matchedStates:0,matchedMeasurements:0,rawChanges:0,DOMChanges:0,becameInvalid:0,unchanged:0,byMachine:{}};
   for(const x of a.states){const y=map.get(x.name);if(y&&x.name.endsWith('-axis-demo-moving')){const p=physical(x.record),q=physical(y.record);delete p.axisPositions;delete q.axisPositions;report.checks.push({name:stats.scope+' '+x.name+' same individual/support/dimensions; timed axis position recorded separately',ok:JSON.stringify(p)===JSON.stringify(q)});(stats.nonComparableTimedMotion||=[]).push({name:x.name,beforeAxes:x.record.axisPositions,afterAxes:y.record.axisPositions,reason:'wall-clock animation sample; each state is checked against its actual input, but not treated as a same-position before/after pair'});continue;}report.checks.push({name:stats.scope+' '+x.name+' matched physical input',ok:!!y&&JSON.stringify(physical(x.record))===JSON.stringify(physical(y.record))});if(!y)continue;stats.matchedStates++;const mstats=stats.byMachine[x.id]||=( {measurements:0,rawChanges:0,DOMChanges:0,becameInvalid:0} );for(const [key,m] of Object.entries(x.measurements)){const n=y.measurements[key];stats.matchedMeasurements++;mstats.measurements++;const rawChange=m.valid!==n.valid||(m.raw!==null&&n.raw!==null&&Math.abs(m.raw-n.raw)>1e-9),domChange=m.dom!==n.dom;if(rawChange){stats.rawChanges++;mstats.rawChanges++;}else stats.unchanged++;if(domChange){stats.DOMChanges++;mstats.DOMChanges++;}if(m.valid&&!n.valid){stats.becameInvalid++;mstats.becameInvalid++;}if(rawChange||domChange)csv.push([stats.scope,x.name,key,m.raw,n.raw,m.raw!==null&&n.raw!==null?n.raw-m.raw:null,m.dom,n.dom,m.valid,n.valid,n.reason]);}}
   const shots=kind=>fs.readdirSync(path.join(dir,kind+suffix)).filter(p=>p.endsWith('.png')).sort();report.checks.push({name:stats.scope+' identical image filenames',ok:JSON.stringify(shots('before'))===JSON.stringify(shots('after'))});stats.beforeImages=shots('before').length;stats.afterImages=shots('after').length;report.comparisons.push(stats);
  }
  report.failed=report.checks.filter(c=>!c.ok);fs.writeFileSync(path.join(dir,'comparison.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(dir,'before-after-changed-measurements.csv'),csv.map(r=>r.map(csvCell).join(',')).join('\n')+'\n');console.log(JSON.stringify({comparisons:report.comparisons,checks:report.checks.length,failed:report.failed}));process.exitCode=report.failed.length?1:0;return;
 }
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),page=await browser.newPage({viewport:{width:1280,height:1000},hasTouch:true,reducedMotion:'reduce',acceptDownloads:true});
 page.setDefaultTimeout(15000);await page.route('http://all-measurements.local/**',r=>r.fulfill({contentType:'text/html',body:html}));page.on('pageerror',e=>errors.push(e.message));
 async function init(id,condition){await page.goto('http://all-measurements.local/');await page.locator('#mechanical').click();await page.locator('#leveling').click();await page.locator('#machineGrid .machine-card').filter({has:page.locator('#thumb-'+id)}).click();await page.evaluate(condition=>{stopMotion();machineProfile=condition==='ideal'?null:MachineAccuracy.generate(condition,123456,machineLinearKeys(),supports.length);machineReference=null;machineSavedBest=null;supportHeights=supports.map(()=>0);positions={X:0,Y:0,Z:0,A:0,C:0};updateAxisValues();updateLeveling(false);},condition);}
 async function menu(){if(!await page.locator('#closeTrainingMenu').isVisible())await page.locator('#openTrainingMenu').click();}
 async function closeMenu(){if(await page.locator('#closeTrainingMenu').isVisible())await page.locator('#closeTrainingMenu').click();}
 async function reveal(selector){await menu();await page.locator(selector).evaluate(e=>{for(let p=e.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});}
 async function slider(axis,value){await closeMenu();await page.locator('#axisTabs .axis-tab').filter({hasText:axis+'軸'}).click();await menu();await reveal('#axis-'+axis);await page.locator('#axis-'+axis).fill(String(value));await page.locator('#axis-'+axis).dispatchEvent('input');await closeMenu();}
 async function support(index,delta){await page.locator('#supportMap .map-point').nth(index).click();await page.locator(Math.abs(delta)===.001?'#fineAdjust':'#coarseAdjust').click();await page.locator(delta>0?'#raiseSupport':'#lowerSupport').click();}
 async function reset(){await page.evaluate(()=>{stopMotion();supportHeights=supports.map(()=>0);positions={X:0,Y:0,Z:0,A:0,C:0};updateAxisValues();updateLeveling(false);});}
 async function read(){return page.evaluate(()=>{
  const measurements={},text=selector=>document.querySelector(selector)?.textContent.trim()??null,add=(k,raw,dom,valid=Number.isFinite(raw),reason=null)=>measurements[k]={raw:Number.isFinite(raw)?raw:null,dom,valid,reason};
  const intrinsic=IntrinsicInspection.fromProfile(machineProfile),g=geometryModel(),layout=axisConfig(current).map(a=>({key:a.key,part:a.part,vector:a.vector,amp:a.amp}));
  if(current.kind==='lathe'){
   const l=latheInspectionGeometry(),svg=[...document.querySelectorAll('#liveSquareness svg')],sections=[...document.querySelectorAll('#latheInspectionSecond section')];
   const runText=(svg[0]?[...svg[0].querySelectorAll('text')].map(e=>e.textContent).find(t=>/^a\s/.test(t)):null)??'',faceText=svg[1]?.querySelector('text:last-child')?.textContent??'';
   const runMatch=runText.match(/a\s+([−+\-\d]+)\s+b\s+([−+\-\d]+)/),faceMatch=faceText.match(/X\s+([^\s]+)\s+Z\s+([^\s]+)/);
   add('TIR.root',intrinsic?.runout.rootMicrons??0,runMatch?.[1]??runText);add('TIR.tip300',intrinsic?.runout.tipMicrons??0,runMatch?.[2]??runText);
   add('face.X',l.face,faceMatch?.[1]);add('face.Z',l.flat,faceMatch?.[2]);
   const boreText=sections[0]?[...sections[0].querySelectorAll('svg text')].map(t=>t.textContent):[],boreNote=sections[0]?.querySelector('p')?.textContent??'',noteMatch=boreNote.match(/芯差 X\s+([^\s]+)／高さ\s+([^\s]+)/);
   ['a','b','c','d'].forEach((k,i)=>add('bore.'+k,l.bore.valid?l.bore.readings[i]:null,boreText[i]?.replace(/^[abcd]\s*/,''),!!l.bore.valid,l.bore.reason));add('bore.X',l.dx,noteMatch?.[1]);add('bore.height',l.dy,noteMatch?.[2]);
   const barText=sections[1]?[...sections[1].querySelectorAll('svg text')].map(t=>t.textContent):[];
   add('bar.side',l.barSide,barText.find(t=>t.startsWith('側面'))?.replace(/^側面（奥）\s*/,''),l.side.valid,l.side.reason);add('bar.top',l.barTop,barText.find(t=>t.startsWith('上面'))?.replace(/^上面\s*/,''),l.top.valid,l.top.reason);
  }else{
   for(const pair of g.pairs){const r=referenceDisplayScan(pair);add('square.'+pair.key,r.microns,text('.live-pair-values[data-pair="'+pair.key+'"] .live-pair-error-value'),r.valid,r.reason);}
   if(current.kind==='horizontal'){const h=horizontalParallelism();['a','b'].forEach((k,i)=>add('parallel.'+k,h[k].microns,text('#sweepValue'+i),h[k].valid,h[k].reason));}
   else {const s=spindleSweepGeometry(positions,levelSolution,machineProfile,1,current.kind==='compact'),zero=s.valid&&s.cardinal?.[3]?.onTable;['right','back','left','front'].forEach((k,i)=>{const q=s.cardinal?.[i],valid=!!(zero&&q?.onTable);add('sweep.'+k,valid?q.readingMicrons:null,text('#sweepValue'+i),valid,!zero?'zero-off-surface':!q?.onTable?'off-surface':null);});}
   const runTexts=[...document.querySelectorAll('#intrinsicRunoutDiagram svg text')].map(e=>e.textContent.replace(/^根元\s*|^300 mm先\s*/,''));
   add('TIR.root',intrinsic?.runout.rootMicrons,intrinsic?runTexts[0]:null,!!intrinsic,intrinsic?null:'profile-null: intrinsic page hidden');add('TIR.tip300',intrinsic?.runout.tipMicrons,intrinsic?runTexts[1]:null,!!intrinsic,intrinsic?null:'profile-null: intrinsic page hidden');
   const surfaceTexts=[...document.querySelectorAll('#intrinsicSurfaceDiagram svg text')].map(e=>e.textContent);
   for(let i=0;i<9;i++)add('surface.p'+i,intrinsic?.surface.points[i]?.microns,intrinsic?surfaceTexts[i+2]:null,!!intrinsic,intrinsic?null:'profile-null: intrinsic page hidden');
   add('surface.range',intrinsic?.surface.rangeMicrons,intrinsic?surfaceTexts.at(-1)?.replace(/^差\s*/,''):null,!!intrinsic,intrinsic?null:'profile-null: intrinsic page hidden');
  }
  const record=levelRecord();return {id:current.id,kind:current.kind,condition:machineProfile?.condition||'ideal',seed:machineProfile?.seed??null,record,supports:supports.map((s,i)=>({...s,height:supportHeights[i]})),layout,measurements,localAngles:g.pairs.map(p=>({key:p.key,microradians:p.deviationMicroradians})),ui:{page:intrinsicInspectionPage,selected,adjustmentStage,viewport:[innerWidth,innerHeight],overflow:document.documentElement.scrollWidth>innerWidth,storageStatus:$('levelSaveStatus').textContent}};
 });}
 async function take(name,operation,shot=false,detail=false){const state={name,operation,...await read()};states.push(state);if(shot){await page.screenshot({path:path.join(out,name+'.png')});fs.writeFileSync(path.join(out,name+'.input.json'),JSON.stringify(state.record,null,2));}if(detail)fs.writeFileSync(path.join(out,name+'.details.txt'),await page.locator('#measurementReference').innerText());return state;}
 const raw=s=>Object.fromEntries(Object.entries(s.measurements).map(([k,m])=>[k,m.raw]));
 for(const id of (['focus','details','settings'].includes(process.env.AUDIT_SCOPE)?[]:process.env.AUDIT_IDS?process.env.AUDIT_IDS.split(','):ids))for(const condition of (process.env.AUDIT_CONDITIONS?process.env.AUDIT_CONDITIONS.split(','):['ideal','new','used'])){
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
 if(!process.env.AUDIT_IDS&&!['focus','details','settings'].includes(process.env.AUDIT_SCOPE))for(const id of ids)for(const width of [1280,390]){
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
   const offsets=await card.evaluate(e=>{const sc=$('adjustmentSelectionScroll'),r=e.getBoundingClientRect(),s=sc.getBoundingClientRect(),top=sc.scrollTop+r.top-s.top;const svg=e.querySelector('svg'),diagram=svg?sc.scrollTop+svg.getBoundingClientRect().top-s.top:top+Math.max(0,(e.clientHeight-sc.clientHeight)/2);return [top,diagram,top+Math.max(0,e.clientHeight-sc.clientHeight)];});
   for(let j=0;j<offsets.length;j++){await page.locator('#adjustmentSelectionScroll').evaluate((e,v)=>e.scrollTop=v,offsets[j]);await take(prefix+`-card${i+1}-scroll${j+1}`,'real detail panel scroll; same supports/seed/axes',true);}
  }
  write();
 }
 if(process.env.AUDIT_SCOPE==='focus'){
  for(const width of [1280,390]){
   await page.setViewportSize({width,height:width===390?844:1000});
   await init('vertical','new');await take(`vertical-new-focus-baseline-width${width}`,'focused baseline seed123456 supports0 axes0',true);await support(0,.01);await take(`vertical-new-A+0.010-width${width}-first`,'focused real A+0.010 same input before/after',true);await page.locator('#measurementReferenceToggle').click();await take(`vertical-new-A+0.010-width${width}-reference`,'focused real detail',true,true);await page.locator('#closeMeasurementReference').click();
   for(const condition of ['ideal','used'])for(const position of [-100,-30,30,100]){await init('five',condition);await slider('A',position);await take(`five-${condition}-A${position}-width${width}-first`,'focused A slider normalized position; C=0',true);if(width===1280){await page.locator('#spindleSweepToggle').click();await take(`five-${condition}-A${position}-width${width}-sweep-detail`,'focused real tilted-table sweep detail',true);await page.locator('#closeSpindleSweepSelection').click();}}
   for(const dims of [[3.2,1.68],[4,.8]]){await init('lathe','ideal');await page.evaluate(([width,depth])=>{for(const [id,value] of [['supportWidth',width],['supportDepth',depth]]){const e=$(id);e.value=String(value);e.dispatchEvent(new Event('input',{bubbles:true}));}},dims);const name=`lathe-ideal-width${dims[0]}-depth${dims[1]}-viewport${width}`;await take(name+'-first','focused hidden dimension input event, ideal supports0 axes0',true);await page.locator('#measurementReferenceToggle').click();await take(name+'-reference','focused real finite-face detail',true,true);await page.locator('#closeMeasurementReference').click();}
   await init('horizontal','ideal');await page.locator('#measurementReferenceToggle').click();await take(`horizontal-ideal-default-width${width}-reference`,'focused real reference detail at supports0 axes0 default dimensions',true,true);await page.locator('#closeMeasurementReference').click();
   write();
  }
 }
 for(const state of states)for(const [key,m] of Object.entries(state.measurements))if(m.valid){const rounded=Math.round(Math.abs(m.raw))*(m.raw<0?-1:1);check(state.name+' '+key+' DOM integer',m.dom!==null&&Number(m.dom)===rounded,{raw:m.raw,dom:m.dom,rounded});}
 check('no browser exceptions',errors.length===0,errors);write();await browser.close();console.log(JSON.stringify({tag,states:states.length,checks:checks.length,failed:checks.filter(c=>!c.ok),errors}));process.exitCode=checks.some(c=>!c.ok)?1:0;
})().catch(e=>{errors.push(e.stack);write();console.error(e);process.exit(1);});

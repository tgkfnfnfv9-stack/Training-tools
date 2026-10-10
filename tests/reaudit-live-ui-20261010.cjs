'use strict';
// Independent UI audit: freeze the reviewed HTML, drive real controls, observe
// the actual rendered material coordinates and visible/accessibility text.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{chromium}=require('playwright');
const html=fs.readFileSync(process.env.AUDIT_HTML||'/tmp/reaudit-live-ui-index.html'),tag=process.env.AUDIT_TAG||'before';
const out=path.resolve('docs/qa-motion-reference-20261010/browser',tag);fs.mkdirSync(out,{recursive:true});
const states=[],checks=[],errors=[],check=(name,ok,detail)=>checks.push({name,ok,detail});
const expected={horizontal:{X:['コラム','主軸頭'],Y:['主軸頭'],Z:['パレット台','パレット']},lathe:{X:['Xスライド','タレット','工具ホルダ','工具'],Z:['往復台','Xスライド','タレット','工具ホルダ','工具']}};
(async()=>{
 if(process.env.AUDIT_SCOPE==='compare'){
  const dir=path.resolve('docs/qa-motion-reference-20261010/browser'),a=JSON.parse(fs.readFileSync(path.join(dir,'before/results.json'))),z=JSON.parse(fs.readFileSync(path.join(dir,'after/results.json')));
  check('before complete and all input/motion checks pass',a.states.length===82&&a.checks.every(c=>c.ok)&&a.errors.length===0);
  check('after complete and all input/motion checks pass',z.states.length===82&&z.checks.every(c=>c.ok)&&z.errors.length===0);
  for(const s of a.states){const t=z.states.find(q=>q.name===s.name);check(s.name+' exists in after',!!t);if(t)for(const key of ['positions','supports','raw','labels','refs','parallel','lathe'])check(s.name+' '+key+' unchanged',JSON.stringify(s[key])===JSON.stringify(t[key]));}
  const beforeText=JSON.parse(fs.readFileSync(path.join(dir,'before/text-compatibility.json'))),afterText=JSON.parse(fs.readFileSync(path.join(dir,'after/text-compatibility.json'))),measurementText=r=>r.readout.replace(r.screenreaderNote.text,'').split('\n').filter(s=>s.trim()).join('\n');
  for(let i=0;i<beforeText.records.length;i++){const x=beforeText.records[i],y=afterText.records[i],id=x.id;check(`${i} ${id}: readout unchanged excluding edited screenreader description`,measurementText(x)===measurementText(y));
   if(!['horizontal','lathe'].includes(id))check(`${i} ${id}: all text and visibility exactly restored`,JSON.stringify(x)===JSON.stringify(y));
   else if(id==='lathe'){check(`${i} lathe: obsolete note hidden`,y.screenreaderNote.hidden&&y.screenreaderNote.display==='none');check(`${i} lathe: rear turret details, no visible obsolete flange/front turret`,y.reference.includes('タレットは奥側')&&!y.reference.includes('精密フランジ')&&!y.reference.includes('手前側刃物台'));}
   else {check(`${i} horizontal: finite fixture description replaces old model/flange`,y.intros.every(q=>!q.text.includes('精密フランジ')&&!q.text.includes('reference-scan-v3'))&&y.reference.includes('320×320'));check(`${i} horizontal: current accessibility note exposed`,!y.screenreaderNote.hidden&&!y.screenreaderNote.text.includes('精密フランジ'));}
  }
  const result={before:a.sha256,after:z.sha256,checks,failed:checks.filter(c=>!c.ok)};fs.writeFileSync(path.join(dir,'comparison.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({checks:checks.length,failed:result.failed}));process.exitCode=result.failed.length?1:0;return;
 }
 const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),p=await b.newPage({viewport:{width:1280,height:1000},hasTouch:true,reducedMotion:'reduce'});
 await p.route('http://motion-reference.local/**',r=>r.fulfill({contentType:'text/html',body:html}));p.on('pageerror',e=>errors.push(e.message));
 const init=async(kind,profile)=>{await p.goto('http://motion-reference.local/');await p.locator('#mechanical').click();await p.locator('#leveling').click();await p.locator('#machineGrid .machine-card').filter({has:p.locator('#thumb-'+kind)}).click();await p.evaluate(profile=>{machineProfile=profile==='ideal'?null:MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length);machineReference=null;machineSavedBest=null;supportHeights=supports.map(()=>0);positions={X:0,Y:0,Z:0,A:0,C:0};updateAxisValues();updateLeveling(false);},profile);};
 const menu=async()=>{if(!await p.locator('#closeTrainingMenu').isVisible())await p.locator('#openTrainingMenu').click();};
 if(process.env.AUDIT_SCOPE==='text'){
  const records=[];await p.goto('http://motion-reference.local/');await p.locator('#mechanical').click();await p.locator('#leveling').click();
  for(const id of ['horizontal','lathe','vertical','horizontal','travel','lathe','gate','horizontal','gantry','lathe','five','horizontal']){
   await p.locator('#machineGrid .machine-card').filter({has:p.locator('#thumb-'+id)}).click();await p.evaluate(()=>{machineProfile=MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length);machineReference=null;machineSavedBest=null;supportHeights=supports.map((s,i)=>i===1?.01:0);positions={X:100,Y:100,Z:100,A:0,C:0};updateAxisValues();updateLeveling(false);});await p.locator('#measurementReferenceToggle').click();
   records.push(await p.evaluate(()=>({id:current.id,kind:current.kind,position:{...positions},intros:[...document.querySelectorAll('#measurementReference>.reference-intro')].map(e=>({text:e.textContent,display:getComputedStyle(e).display})),screenreaderNote:{text:$('squarenessValuesNote').textContent,hidden:$('squarenessValuesNote').hidden,display:getComputedStyle($('squarenessValuesNote')).display},reference:$('measurementReference').innerText,readout:$('precisionReadouts').innerText,latheOldCard:!!$('measurementReferenceCards').querySelector('[data-reference-pair]')})));
   if(['lathe','horizontal'].includes(id)){await p.screenshot({path:path.join(out,`switch-${records.length}-${id}.png`)});}
   await p.locator('#closeMeasurementReference').click();await p.locator('#changeMachine').click();
  }
  fs.writeFileSync(path.join(out,'text-compatibility.json'),JSON.stringify({sha256:crypto.createHash('sha256').update(html).digest('hex'),records,errors},null,2));await b.close();console.log(JSON.stringify({records:records.length,errors}));return;
 }
 const slider=async(key,value)=>{await p.locator('#axisTabs .axis-tab').filter({hasText:key+'軸'}).click();await menu();if(!await p.locator('#axisMenuSection').evaluate(e=>e.open))await p.locator('#axisMenuSection summary').click();await p.locator('#axis-'+key).fill(String(value));await p.locator('#axis-'+key).dispatchEvent('input');await p.locator('#closeTrainingMenu').click();};
 const read=()=>p.evaluate(()=>{const geo=createGeometry(current),g=geometryModel(),refs=current.kind==='horizontal'?g.pairs.map(pair=>({pair:pair.key,scan:referenceDisplayScan(pair)})):null,parallel=current.kind==='horizontal'?horizontalParallelism():null,lathe=current.kind==='lathe'?latheInspectionGeometry():null;
  return {kind:current.kind,profile:machineProfile?.condition||'ideal',positions:{...positions},supports:supports.map((s,i)=>({...s,height:supportHeights[i]})),display:{factor:displayFactor(),view:sceneView,selectedAxis},labels:geo.labels.map(l=>({name:l.name,axes:l.axes,pose:l.pose,p:l.p,world:displayedModelPoint(l.p,l.axes,current,positions,l.pose)})),arrows:axisConfig(current).map(a=>({key:a.key,part:a.part,vector:a.vector})),refs,parallel,lathe,raw:lathe?{face:lathe.face,flat:lathe.flat,dx:lathe.dx,dy:lathe.dy,barSide:lathe.barSide,barTop:lathe.barTop}:Object.fromEntries([...refs.map(r=>[r.pair,r.scan.microns]),['a',parallel.a.microns],['b',parallel.b.microns]]),dom:{first:$('precisionReadouts').innerText,second:$('intrinsicInspectionPage').innerText,reference:$('measurementReference').innerText,referenceIntros:[...document.querySelectorAll('#measurementReference>.reference-intro')].map(e=>({text:e.textContent,display:getComputedStyle(e).display})),screenreaderNote:{text:$('squarenessValuesNote').textContent,hidden:$('squarenessValuesNote').hidden,display:getComputedStyle($('squarenessValuesNote')).display},comparison:$('comparisonContext').innerText,initialHeights:machineProfile?.initialHeights,localNote:$('localSquarenessNote').innerText},overflow:document.documentElement.scrollWidth>innerWidth};});
 const take=async(name,shot=false)=>{const s={name,...await read()};states.push(s);if(shot){await p.waitForTimeout(70);await p.screenshot({path:path.join(out,name+'.png')});}return s;};
 const openReference=async name=>{await p.locator('#measurementReferenceToggle').click();await take(name,true);fs.writeFileSync(path.join(out,name+'.txt'),await p.locator('#measurementReference').innerText());await p.locator('#closeMeasurementReference').click();};
 for(const kind of ['horizontal','lathe'])for(const profile of ['ideal','used']){
  await init(kind,profile);
  for(const posture of ['flat','twist']){
   if(posture==='twist')await p.evaluate(()=>{supportHeights=supports.map(s=>.05*s.x*s.z);updateLeveling(false);});
   const base=await take(`${kind}-${profile}-${posture}-center`,true);
   for(const axis of Object.keys(expected[kind]))for(const value of [-100,100]){
    await slider(axis,value);const next=await take(`${kind}-${profile}-${posture}-${axis}${value}`,profile==='used');
    for(const label of base.labels){const after=next.labels.find(l=>l.name===label.name),distance=Math.hypot(...after.world.map((v,i)=>v-label.world[i])),moving=expected[kind][axis].includes(label.name);check(`${next.name}: ${label.name} ${moving?'moves':'fixed'}`,moving?distance>1e-5:distance<1e-12,{distance,delta:after.world.map((v,i)=>v-label.world[i])});}
    check(`${next.name}: slider input accepted`,next.positions[axis]===value);await slider(axis,0);
   }
  }
  // Operational checks start on the UI's 0.001 mm lattice. Analytic twist
  // fixtures above have extra decimals and intentionally bypass that UI grid.
  await p.evaluate(()=>{supportHeights=supports.map(()=>0);updateLeveling(false);});
  await p.locator('#supportMap .map-point').nth(1).click();await p.locator('#coarseAdjust').click();const pre=await take(`${kind}-${profile}-B-before`);await p.locator('#raiseSupport').click();const post=await take(`${kind}-${profile}-B-plus`,true);check(`${kind}-${profile}: selected B+0.010`,post.supports.every((s,i)=>Math.abs(s.height-pre.supports[i].height-(i===1?.01:0))<1e-12));await p.locator('#lowerSupport').click();const back=await take(`${kind}-${profile}-B-restored`);check(`${kind}-${profile}: support round trip`,JSON.stringify(back.raw)===JSON.stringify(pre.raw));
  for(const axis of Object.keys(expected[kind]))await slider(axis,100);await openReference(`${kind}-${profile}-end-reference`);
  if(profile==='used'){
   await menu();if(!await p.locator('.adjustment-menu').evaluate(e=>e.open))await p.locator('.adjustment-menu>summary').click();await p.locator('#restoreInitialLevel').scrollIntoViewIfNeeded();await p.locator('#restoreInitialLevel').click();await p.locator('#closeTrainingMenu').click();const reset=await take(`${kind}-restore-initial`,true);check(`${kind}: restore initial retains axes`,Object.keys(expected[kind]).every(axis=>reset.positions[axis]===100));check(`${kind}: restore exact original heights`,JSON.stringify(reset.supports.map(s=>s.height))===JSON.stringify(reset.dom.initialHeights));await openReference(`${kind}-restored-reference`);
  }
  console.log(`${kind} ${profile} complete`);fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify({states,checks,errors}));
 }
 for(const kind of ['horizontal','lathe'])for(const width of [390,1280]){
  await p.setViewportSize({width,height:width===390?844:1000});await init(kind,'used');await p.evaluate(()=>{supportHeights=supports.map(s=>.05*s.x*s.z);updateLeveling(false);});await slider('X',100);await slider('Z',100);if(kind==='horizontal')await slider('Y',100);const first=await take(`${kind}-width${width}-first`,true);check(`${kind}-${width}: no overflow`,!first.overflow);await openReference(`${kind}-width${width}-reference`);
  await p.locator('#inspectionNext').click();await take(`${kind}-width${width}-second`,true);await p.locator('#inspectionPrevious').click();
  if(kind==='horizontal'){await p.locator('#spindleSweepToggle').click();await take(`${kind}-width${width}-parallel-detail`,true);fs.writeFileSync(path.join(out,`${kind}-width${width}-parallel.txt`),await p.locator('#spindleSweepSelection').innerText());await p.locator('#closeSpindleSweepSelection').click();}
 }
 check('no browser exceptions',errors.length===0,errors);const report={tag,sha256:crypto.createHash('sha256').update(html).digest('hex'),environment:'Linux Chromium / real controls / emulated touch viewport; real iPhone Safari untested',states,checks,errors};fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report));fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({tag,sha256:report.sha256,states:states.length,checks:checks.length,failed:checks.filter(c=>!c.ok),errors},null,2));await b.close();console.log(JSON.stringify({states:states.length,checks:checks.length,failed:checks.filter(c=>!c.ok),errors}));process.exitCode=checks.some(c=>!c.ok)?1:0;
})().catch(e=>{console.error(e);fs.writeFileSync(path.join(out,'failure.txt'),e.stack);process.exit(1);});

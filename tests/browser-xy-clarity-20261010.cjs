'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto'),{chromium}=require('playwright');
const phase=process.argv[2],input=process.argv[3]||(phase==='before'?'docs/qa-xy-clarity-20261010/browser/before/index.html.gz':'index.html');
if(!['before','after'].includes(phase))throw Error('Specify before or after');
const root=path.resolve('docs/qa-xy-clarity-20261010/browser'),out=path.join(root,phase);fs.mkdirSync(out,{recursive:true});
const bytes=fs.readFileSync(input),html=input.endsWith('.gz')?zlib.gunzipSync(bytes):bytes,hash=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.writeFileSync(path.join(out,'index.html.gz'),zlib.gzipSync(html,{mtime:0}));
const result={phase,sha256:hash(html),environment:'Actual Linux Chromium, 390x844 and 1280x1000. Not real iPhone Safari.',states:[],cards:[],other:[],checks:[],errors:[]};
const check=(name,ok,details)=>result.checks.push({name,ok,...(details?{details}:{})});
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),p=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 p.on('pageerror',e=>result.errors.push(e.message));await p.route('http://xy-clarity.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 const init=async(profile='used',id='horizontal')=>{await p.goto('http://xy-clarity.test/');await p.evaluate(({profile,id})=>{openMachine(machines.find(m=>m.id===id));machineProfile=profile==='ideal'?null:MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length);machineReference=null;machineSavedBest=null;supportHeights=supports.map(()=>0);positions={X:0,Y:0,Z:0,A:0,C:0};selected=6<supports.length?6:0;updateAxisValues();updateLeveling(false);setSceneView('front');selectAxis('X');},{profile,id});await p.evaluate(()=>document.fonts.ready);};
 const read=()=>p.evaluate(()=>{
  const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),extension=q=>dot(q.normal,sub(q.point,q.body))/dot(q.normal,q.probe);
  const refs=geometryModel().pairs.map(pair=>{const m=referenceDisplayScan(pair),el=document.querySelector('#liveSquareness .live-pair-values[data-pair="'+pair.key+'"] .live-pair-error-value'),card=document.querySelector('#measurementReferenceCards [data-reference-pair="'+pair.key+'"]'),interval=card.querySelector('.measurement-interval');return {key:pair.key,raw:m.microns,display:el?.textContent,domRaw:Number(el?.dataset.readingMicrons),valid:m.valid,independentContact:m.valid?(extension(m.start)-extension(m.end))*1e6:null,startPosition:m.startPosition,endPosition:m.endPosition,startState:m.startState,endState:m.endState,returnState:m.returnState,setup:m.setup,interval:interval?{data:{...interval.dataset},text:interval.textContent}:null,card:card.textContent};});
  const b=horizontalParallelism();return {record:levelRecord(),positions:{...positions},supports:[...supportHeights],selected,refs,bar:{a:b.a.microns,b:b.b.microns},barDisplay:[0,1].map(i=>$('sweepValue'+i).textContent),label:$('liveSquarenessName').textContent,note:$('squarenessMeasurementNote').textContent,head:displayedModelPoint([0,2.55,.25],['X','Y'],current,positions,'tool')};
 });
 const snap=async(name,shot=false)=>{const s={name,...await read()};result.states.push(s);if(shot){await p.screenshot({path:path.join(out,name+'.png')});await p.locator('#liveSquareness').screenshot({path:path.join(out,name+'-diagrams.png')});}for(const r of s.refs){check(name+' '+r.key+' raw matches independently solved captured plane/line',r.valid&&Math.abs(r.raw-r.independentContact)<1e-6);check(name+' '+r.key+' DOM raw matches calculation',r.domRaw===r.raw);if(phase==='after'){check(name+' '+r.key+' local angle value removed from measurement card',!r.card.includes('従来の局所角度差'));if(r.setup.scan==='Y'){const current=s.positions.Y*3,start=Math.min(current,0),end=start+300,d=r.interval?.data||{};check(name+' '+r.key+' Y interval independently matches slider travel mm',{...d}&&Number(d.currentPositionMm)===current&&Number(d.zeroPositionMm)===start&&Number(d.endPositionMm)===end&&Number(d.returnTravelMm)===start-current,{expected:{current,start,end,returnTravel:start-current},actual:d});}}}return s;};
 const support=async direction=>{await p.locator('#supportMap .map-point').nth(6).click();await p.locator('#coarseAdjust').click();await p.locator('#'+direction+'Support').click();};
 const axis=async value=>{await p.locator('#axisTabs .axis-tab').filter({hasText:'Y軸'}).click();await p.locator('#openTrainingMenu').click();if(!await p.locator('#axisMenuSection').evaluate(e=>e.open))await p.locator('#axisMenuSection summary').click();await p.locator('#axis-Y').fill(String(value));await p.locator('#axis-Y').dispatchEvent('input');await p.locator('#closeTrainingMenu').click();};
 for(const profile of ['ideal','used']){
  await init(profile);await snap(profile+'-flat',true);
  for(const d of ['lower','raise']){await support(d);await snap(profile+'-G-'+d,true);await axis(-100);await snap(profile+'-G-'+d+'-Yminus100',profile==='used'&&d==='lower');await axis(100);await snap(profile+'-G-'+d+'-Yplus100',profile==='used'&&d==='lower');await axis(0);await support(d==='lower'?'raise':'lower');}
 }
 // Actual fixed DOM scroll, no font/layout manipulation. Top and bottom slices
 // expose the prior local-angle sign and the new measurement-position guidance.
 await init('used');
 for(const width of [390,1280]){
  await p.setViewportSize({width,height:width===390?844:1000});await p.screenshot({path:path.join(out,'used-flat-'+width+'.png')});await p.locator('#measurementReferenceToggle').click();
  for(const key of ['XY','XZ','YZ'])for(const where of ['top','bottom']){
   const data=await p.evaluate(({key,where})=>{const c=document.querySelector('#measurementReferenceCards [data-reference-pair="'+key+'"]'),s=$('adjustmentSelectionScroll');let cr=c.getBoundingClientRect(),sr=s.getBoundingClientRect();s.scrollTop+=where==='top'?cr.top-sr.top:cr.bottom-sr.bottom;cr=c.getBoundingClientRect();sr=s.getBoundingClientRect();const left=Math.max(cr.left,sr.left,0),top=Math.max(cr.top,sr.top,0),right=Math.min(cr.right,sr.right,innerWidth),bottom=Math.min(cr.bottom,sr.bottom,innerHeight);return {text:c.textContent,card:{width:cr.width,height:cr.height},scrollTop:s.scrollTop,clip:{x:left,y:top,width:Math.max(0,right-left),height:Math.max(0,bottom-top)},fontSizes:[...c.querySelectorAll('p,dt,dd,h3')].map(e=>({text:e.textContent.slice(0,80),px:parseFloat(getComputedStyle(e).fontSize)}))};},{key,where});
   await p.screenshot({path:path.join(out,`detail-${key}-${width}-${where}.png`)});result.cards.push({width,key,where,...data});
  }
  await p.locator('#closeMeasurementReference').click();
 }
 // Save download + same input loaded on after via the real file-input handler.
 await init('used');await support('lower');await axis(-100);const saveState=await read();
 if(phase==='after'){
  await support('raise');await p.locator('#importLevel').setInputFiles(path.join(root,'before/saved-horizontal.json'));await p.waitForFunction(()=>$('levelInputMessage').textContent.includes('読み込みました')||$('levelInputMessage').textContent.includes('読込できません'));
  check('before JSON loaded through actual file input',await p.locator('#levelInputMessage').textContent().then(t=>t.includes('読み込みました')));
  const loaded=await read();check('loaded positions and supports match',JSON.stringify([loaded.positions,loaded.supports])===JSON.stringify([saveState.positions,saveState.supports]));result.loaded=loaded;
 }
 await p.locator('#openTrainingMenu').click();await p.locator('.level-storage summary').click();const downloaded=p.waitForEvent('download');await p.locator('#exportLevel').click();await (await downloaded).saveAs(path.join(out,'saved-horizontal.json'));result.saved=JSON.parse(fs.readFileSync(path.join(out,'saved-horizontal.json')));check('native download matches current record',JSON.stringify(result.saved)===JSON.stringify((await read()).record));
 // One deterministic state per untouched type catches accidental shared UI
 // and value changes. This is a targeted regression, not a full machine audit.
 await p.setViewportSize({width:390,height:844});
 for(const id of ['vertical','travel','gate','gantry','five','lathe']){await init('used',id);const state=await p.evaluate(()=>({record:levelRecord(),squares:$('liveSquareness').innerHTML,labels:[$('liveSquarenessName').textContent,$('liveSquarenessUnits').textContent],note:$('squarenessMeasurementNote').textContent,cards:$('measurementReferenceCards').innerHTML}));const shot=await p.screenshot({path:path.join(out,'other-'+id+'.png')});result.other.push({id,state,imageHash:hash(shot)});}
 if(phase==='after'){
  const old=JSON.parse(fs.readFileSync(path.join(root,'before/results.json')));
  for(const s of result.states){const b=old.states.find(t=>t.name===s.name),values=t=>[t.positions,t.supports,t.refs.map(r=>[r.key,r.raw,r.display,r.startState,r.endState]),t.bar,t.barDisplay];check(s.name+' measurement values and scan states unchanged',JSON.stringify(values(s))===JSON.stringify(values(b)));}
  for(const o of result.other){const b=old.other.find(t=>t.id===o.id);check(o.id+' untouched state and markup unchanged',JSON.stringify(o.state)===JSON.stringify(b.state));check(o.id+' untouched screen pixels unchanged',o.imageHash===b.imageHash);}
  check('saved full record unchanged',JSON.stringify(result.saved)===JSON.stringify(old.saved));
 }
 check('no browser exceptions',result.errors.length===0);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({phase,sha256:result.sha256,states:result.states.length,cards:result.cards.length,checks:result.checks.length,failures:result.checks.filter(c=>!c.ok)},null,2));await browser.close();process.exitCode=result.checks.some(c=>!c.ok)?1:0;
})().catch(e=>{fs.writeFileSync(path.join(out,'failed-run.json'),JSON.stringify({...result,error:String(e.stack||e)},null,2));console.error(e);process.exitCode=1;});

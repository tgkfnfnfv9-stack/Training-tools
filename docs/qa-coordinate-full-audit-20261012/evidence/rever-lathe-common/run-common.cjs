'use strict';
// All six machines in real Chromium: page errors, coarse/fine raise/lower, axis sliders,
// NaN/undefined scan, layout vs main e0e62e7, save/load model IDs, signs and rigid-tilt invariance.
const fs=require('fs'),path=require('path'),{chromium}=require('playwright');
const OUT=__dirname,SHOT=path.join(OUT,'shots');fs.mkdirSync(SHOT,{recursive:true});
const URLS={branch:'file:///home/user/Training-tools/index.html',main:'file:///tmp/claude-0/-home-user-Training-tools/4989ebb2-0dd1-5f7d-84eb-5fc1dc0607ea/scratchpad/main-wt/index.html'};
const IDS=['vertical','horizontal','travel','gate','gantry','lathe'];
const VIEWS={pc:{width:1440,height:1000},phone:{width:390,height:844}};
const seeded=`(()=>{let s=20261012>>>0;Math.random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};})();`;
const bad=t=>/NaN|undefined|Infinity/.test(t);
async function openPage(browser,version,view,id){
 const ctx=await browser.newContext({viewport:VIEWS[view],acceptDownloads:true,hasTouch:view==='phone',isMobile:view==='phone'});await ctx.addInitScript(seeded);
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push('console:'+m.text());});
 await p.goto(URLS[version]);await p.locator('#mechanical').click();await p.locator('#leveling').click();
 const idx=IDS.indexOf(id);await p.locator('#machineGrid .machine-card').nth(idx).click();await p.waitForTimeout(150);
 return {ctx,p,errors};
}
const readAll=p=>p.evaluate(()=>{
 const t=document.querySelector('#training').innerText;
 const dataR=[...document.querySelectorAll('#training [data-reading-microns]')].map(e=>e.dataset.readingMicrons);
 return {text:t,heights:[...supportHeights],positions:{...positions},lathe:$('liveSquareness').dataset.lathe||null,readings:dataR,
  sweep:[0,1,2,3].map(i=>$('sweepValue'+i)?.textContent??null),live:[...document.querySelectorAll('#liveSquareness .live-pair-error-value')].map(e=>e.textContent),
  stage:{lr:$('stageAverageLR').dataset.value,fb:$('stageAverageFB').dataset.value,lrText:$('stageAverageLR').textContent,fbText:$('stageAverageFB').textContent,bubbleLR:$('coarseBubbleLR').style.left,bubbleFB:$('coarseBubbleFB').style.getPropertyValue('--bubble-position'),twist:$('fineTwist').dataset.current,twistText:$('fineTwist').textContent,leanFront:$('fineLeanFront').dataset.current,leanRight:$('fineLeanRight').dataset.current,leanFrontText:$('fineLeanFront').textContent,leanRightText:$('fineLeanRight').textContent,columnLean:$('columnLean').textContent}};
});
const layout=p=>p.evaluate(()=>{const out={};for(const e of document.querySelectorAll('body [id]')){const r=e.getBoundingClientRect(),st=getComputedStyle(e);const vis=r.width>0&&r.height>0&&st.visibility!=='hidden'&&st.display!=='none';if(vis)out[e.id]={x:Math.round(r.x),y:Math.round(r.y+scrollY),w:Math.round(r.width),h:Math.round(r.height)};}
 return {els:out,scrollW:document.documentElement.scrollWidth,innerW:innerWidth,docH:document.documentElement.scrollHeight};});
async function slider(p,key,value){
 await p.locator('#openTrainingMenu').click();
 if(!await p.locator('#axisMenuSection').evaluate(e=>e.open))await p.locator('#axisMenuSection summary').click();
 await p.locator('#drawerAxisSelect').selectOption(key).catch(()=>{});
 const s=p.locator('#axis-'+key);await s.fill(String(value));await s.dispatchEvent('input');
 await p.locator('#closeTrainingMenu').click();await p.waitForTimeout(60);
}
async function ops(p){
 const log=[],r0=await readAll(p);
 const step=async(name,fn)=>{let err=null;try{await fn();}catch(e){err=e.message.split('\n')[0];}await p.waitForTimeout(40);const r=await readAll(p);log.push({name,err,heights:r.heights,positions:r.positions,changed:r.text!==prev.text,nan:bad(r.text),readings:r.readings.slice(0,8),live:r.live,sweep:r.sweep,lathe:r.lathe});prev=r;return r;};
 let prev=r0;
 await step('select support A',()=>p.locator('#supportMap .map-point').nth(0).click());
 await step('coarse mode',()=>p.locator('#coarseAdjust').click());
 const cu=await step('coarse raise',()=>p.locator('#raiseSupport').click());
 await step('coarse lower',()=>p.locator('#lowerSupport').click());
 await step('coarse lower 2',()=>p.locator('#lowerSupport').click());
 await step('coarse raise back',()=>p.locator('#raiseSupport').click());
 await step('fine mode',()=>p.locator('#fineAdjust').click());
 await step('fine raise',()=>p.locator('#raiseSupport').click());
 await step('fine lower',()=>p.locator('#lowerSupport').click());
 await step('fine lower 2',()=>p.locator('#lowerSupport').click());
 await step('fine raise back',()=>p.locator('#raiseSupport').click());
 const rBack=prev;
 const keys=await p.evaluate(()=>axisConfig(current).map(a=>a.key));
 for(const k of keys){await step('slider '+k+' +60',()=>slider(p,k,60));await step('slider '+k+' -100',()=>slider(p,k,-100));await step('slider '+k+' 0',()=>slider(p,k,0));}
 const h0=r0.heights,dh=(a,b)=>a.map((v,i)=>Math.round((v-b[i])*1e6)/1e6);
 const s=name=>log.find(l=>l.name===name);
 const checks={
  coarseRaiseDelta:dh(s('coarse raise').heights,h0),fineRaiseDelta:dh(s('fine raise').heights,s('fine mode').heights),
  coarseRaiseChangedText:s('coarse raise').changed,fineRaiseChangedText:s('fine raise').changed,
  netZeroRestoresText:rBack.text===(await (async()=>r0.text)()),
  sliderChanged:Object.fromEntries(keys.map(k=>[k,s('slider '+k+' +60').changed&&s('slider '+k+' -100').changed])),
  sliderPositions:Object.fromEntries(keys.map(k=>[k,[s('slider '+k+' +60').positions[k],s('slider '+k+' -100').positions[k],s('slider '+k+' 0').positions[k]]])),
  anyNaN:log.some(l=>l.nan)||bad(r0.text),errors:log.filter(l=>l.err).map(l=>l.name+': '+l.err)};
 return {checks,log};
}
async function saveLoad(browser,version,id){
 const {ctx,p,errors}=await openPage(browser,version,'pc',id);
 await p.locator('#supportMap .map-point').nth(1).click();await p.locator('#raiseSupport').click();
 const keys=await p.evaluate(()=>axisConfig(current).map(a=>a.key));await slider(p,keys[0],37);
 const before=await readAll(p);
 await p.locator('#openTrainingMenu').click();const det=p.locator('.level-storage');if(!await det.evaluate(e=>e.open))await det.locator('summary').click();
 const dl=p.waitForEvent('download');await p.locator('#exportLevel').click();const d=await dl,file=path.join(OUT,`saved-${version}-${id}.json`);await d.saveAs(file);
 await p.locator('#closeTrainingMenu').click();
 const rec=JSON.parse(fs.readFileSync(file,'utf8'));
 // perturb then import
 await p.locator('#raiseSupport').click();await slider(p,keys[0],-20);
 const perturbed=await readAll(p);
 const doImport=async f=>{await p.locator('#openTrainingMenu').click();if(!await det.evaluate(e=>e.open))await det.locator('summary').click();await p.locator('#importLevel').setInputFiles(f);await p.waitForTimeout(250);const msg=await p.evaluate(()=>$('levelInputMessage').textContent+' | '+$('levelSaveStatus').textContent);await p.locator('#closeTrainingMenu').click();return msg;};
 const msg=await doImport(file),after=await readAll(p);
 const out={calculationModel:rec.calculationModel,version:rec.version,importMessage:msg,roundTrip:JSON.stringify([before.heights,before.positions,before.live,before.sweep,before.lathe,before.readings])===JSON.stringify([after.heights,after.positions,after.live,after.sweep,after.lathe,after.readings]),textDiff:diffWords(before.text.replace(/\s+/g,' '),after.text.replace(/\s+/g,' ')),saved:{heights:rec.heights,axisPositions:rec.axisPositions},restored:{heights:after.heights,positions:after.positions},perturbedDiffered:perturbed.text!==before.text,errors};
 await ctx.close();return out;
}
async function importInto(browser,id,file,label){
 const {ctx,p,errors}=await openPage(browser,'branch','pc',id);const before=await readAll(p);
 await p.locator('#openTrainingMenu').click();const det=p.locator('.level-storage');if(!await det.evaluate(e=>e.open))await det.locator('summary').click();
 await p.locator('#importLevel').setInputFiles(file);await p.waitForTimeout(250);
 const msg=await p.evaluate(()=>$('levelInputMessage').textContent);await p.locator('#closeTrainingMenu').click();const after=await readAll(p);
 await ctx.close();return {label,message:msg,stateUnchanged:JSON.stringify([before.heights,before.positions])===JSON.stringify([after.heights,after.positions]),errors};
}
// Signs and rigid tilt (branch, pc)
async function signs(browser,id){
 const {ctx,p,errors}=await openPage(browser,'branch','pc',id);
 const res=await p.evaluate(()=>{
  const base=[...supportHeights],pts=supports.map(s=>levelCoordinates(s.x,s.z));
  const snap=()=>({lr:levelSolution.lr,fb:levelSolution.fb,twist:levelSolution.twist,lrText:$('stageAverageLR').textContent,fbText:$('stageAverageFB').textContent,bubbleLR:parseFloat($('coarseBubbleLR').style.left),bubbleFB:parseFloat($('coarseBubbleFB').style.getPropertyValue('--bubble-position')),twistText:$('fineTwist').textContent,
   leanF:Number($('fineLeanFront').dataset.current),leanR:Number($('fineLeanRight').dataset.current),leanFText:$('fineLeanFront').textContent,leanRText:$('fineLeanRight').textContent,columnLean:$('columnLean').textContent,
   readings:[...document.querySelectorAll('#precisionReadouts [data-reading-microns], #liveSquareness [data-reading-microns]')].map(e=>e.dataset.readingMicrons),
   physical:[...document.querySelectorAll('#liveSquareness [data-physical-reading-microns]')].map(e=>e.dataset.physicalReadingMicrons),
   readout:$('precisionReadouts').innerText.replace(/\s+/g,' '),sweep:[0,1,2,3].map(i=>$('sweepValue'+i)?.textContent??null),lathe:$('liveSquareness').dataset.lathe||null,
   geo:(()=>{const g=geometryModel();return g.pairs.map(q=>q.key+':'+q.deviationMicroradians.toFixed(6));})()});
  const set=h=>{supportHeights=h;updateLeveling(false);return snap();};
  const zero=set(supports.map(()=>0));
  const plane=(a,b)=>pts.map(q=>a*q.x+b*q.z);
  const out={zero};
  out.rightHigh=set(plane(.1,0));out.backHigh=set(plane(0,.1));
  // twist: raise only back-right-most support(s)
  const xmax=Math.max(...pts.map(q=>q.x)),zmax=Math.max(...pts.map(q=>q.z));
  out.backRightCorner=set(pts.map(q=>Math.abs(q.x-xmax)<1e-9&&Math.abs(q.z-zmax)<1e-9?.1:0));
  // rigid tilt invariance about the actual (random) state
  out.base=set([...base]);
  out.rigid=[[.05,0],[0,.08],[-.07,.06]].map(([a,b])=>({a,b,...set(base.map((h,i)=>h+a*pts[i].x+b*pts[i].z))}));
  set(base);return out;
 });
 await ctx.close();
 const z=res.zero,R=res.rightHigh,B=res.backHigh,T=res.backRightCorner;
 const lathe=id==='lathe';
 const checks={
  bubbleRightHigh_movesRight:R.bubbleLR>z.bubbleLR&&R.lrText.includes('右'),
  bubbleBackHigh_movesUp:B.bubbleFB<z.bubbleFB&&B.fbText.includes('奥'),
  twistBackRight_positive:T.twist>0&&T.twistText.includes('奥が手前より右高'),
  // physical: right side high -> column top leans left (up_x<0); lathe spindle (+x) tips up
  leanRightHigh:lathe?{expect:'上下 +100 µrad',got:R.leanF-z.leanF,ok:Math.abs(R.leanF-z.leanF-100)<1}:{expect:'right -100 µrad (左倒れ)',got:R.leanR-z.leanR,ok:Math.abs(R.leanR-z.leanR+100)<1},
  leanBackHigh:lathe?{expect:'上下 ~0',got:B.leanF-z.leanF,ok:Math.abs(B.leanF-z.leanF)<1}:{expect:'front +100 µrad (前倒れ)',got:B.leanF-z.leanF,ok:Math.abs(B.leanF-z.leanF-100)<1},
  rigidInvariant:res.rigid.map(r=>({a:r.a,b:r.b,readingsSame:JSON.stringify(r.readings)===JSON.stringify(res.base.readings),physicalSame:JSON.stringify(r.physical)===JSON.stringify(res.base.physical),sweepSame:JSON.stringify(r.sweep)===JSON.stringify(res.base.sweep),latheSame:latheEq(r.lathe,res.base.lathe),geoMaxDiff:Math.max(0,...r.geo.map((g,i)=>Math.abs(Number(g.split(':')[1])-Number(res.base.geo[i].split(':')[1])))),twistDiff:r.twist-res.base.twist,leanDelta:[r.leanF-res.base.leanF,r.leanR-res.base.leanR],readoutDiff:diffWords(res.base.readout,r.readout)}))};
 return {checks,raw:res,errors};
}
function latheEq(a,b){if(!a&&!b)return true;const x=JSON.parse(a),y=JSON.parse(b);return ['face','flat','dx','dy','barSide','barTop'].every(k=>Math.abs(x[k]-y[k])<1e-6);}
function diffWords(a,b){const A=a.split(' '),B=b.split(' ');const d=[];for(let i=0;i<Math.max(A.length,B.length);i++)if(A[i]!==B[i])d.push([A[i],B[i]]);return d.slice(0,12);}
(async()=>{
 const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 const res={ui:{},layout:{},saveLoad:{},oldFiles:[],signs:{}};
 if(!process.env.SKIP_UI)for(const id of IDS)for(const view of Object.keys(VIEWS)){
  const per={};
  for(const version of ['branch','main']){
   const {ctx,p,errors}=await openPage(browser,version,view,id);
   const L=await layout(p);await p.screenshot({path:path.join(SHOT,`${id}-${view}-${version}.png`),fullPage:true});
   const o=await ops(p);per[version]={layout:L,errors:[...errors],ops:o.checks,opsLog:o.log.map(l=>({name:l.name,err:l.err,heights:l.heights,positions:l.positions,changed:l.changed,nan:l.nan,live:l.live,sweep:l.sweep}))};
   await ctx.close();
  }
  const a=per.branch.layout.els,b=per.main.layout.els,missing=Object.keys(b).filter(k=>!a[k]),added=Object.keys(a).filter(k=>!b[k]);
  const moved=Object.keys(a).filter(k=>b[k]).map(k=>({id:k,dx:a[k].x-b[k].x,dy:a[k].y-b[k].y,dw:a[k].w-b[k].w,dh:a[k].h-b[k].h})).filter(m=>Math.max(Math.abs(m.dx),Math.abs(m.dy),Math.abs(m.dw),Math.abs(m.dh))>4);
  res.layout[id+'-'+view]={missing,added,moved:moved.slice(0,40),movedCount:moved.length,overflow:{branch:per.branch.layout.scrollW>per.branch.layout.innerW,main:per.main.layout.scrollW>per.main.layout.innerW},docH:[per.branch.layout.docH,per.main.layout.docH]};
  res.ui[id+'-'+view]={branch:{errors:per.branch.errors,...per.branch.ops},main:{errors:per.main.errors,...per.main.ops},log:per.branch.opsLog};
  console.log(id,view,'errors',per.branch.errors.length,per.main.errors.length,'nan',per.branch.ops.anyNaN,'layout missing/added/moved',missing.length,added.length,moved.length,'opsErr',per.branch.ops.errors.length);
 }
 for(const id of IDS){
  res.saveLoad[id]=await saveLoad(browser,'branch',id);
  const mainSave=await saveLoad(browser,'main',id);res.saveLoad[id+'-main']=mainSave;
  res.oldFiles.push(await importInto(browser,id,path.join(OUT,`saved-main-${id}.json`),`${id}: file exported by main e0e62e7 (${mainSave.calculationModel})`));
  const rec=JSON.parse(fs.readFileSync(path.join(OUT,`saved-branch-${id}.json`),'utf8'));
  for(const old of {vertical:['compact-asymmetric-bending-v3'],horizontal:['horizontal-guide-v2'],travel:['travel-guide-v1'],gate:['portal-shear-v2'],gantry:['portal-shear-v2'],lathe:['lathe-carriage-v2','lathe-carriage-v1']}[id]){
   const f=path.join(OUT,`old-${id}-${old}.json`);fs.writeFileSync(f,JSON.stringify({...rec,calculationModel:old}));res.oldFiles.push(await importInto(browser,id,f,`${id}: branch file relabelled ${old}`));}
  const f=path.join(OUT,`nomodel-${id}.json`);const {calculationModel,...rest}=rec;fs.writeFileSync(f,JSON.stringify(rest));res.oldFiles.push(await importInto(browser,id,f,`${id}: no calculationModel`));
  res.signs[id]=await signs(browser,id);
  console.log('saveload',id,JSON.stringify(res.saveLoad[id]).slice(0,300));
 }
 await browser.close();
 const file=path.join(OUT,'common-results.json');if(process.env.SKIP_UI){const prev=JSON.parse(fs.readFileSync(file,'utf8'));res.ui=prev.ui;res.layout=prev.layout;}fs.writeFileSync(file,JSON.stringify(res,null,1));
})();

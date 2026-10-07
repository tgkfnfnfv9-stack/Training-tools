'use strict';
// Actual Chromium audit; no production renderer is used as a numerical oracle.
// Run: node tests/browser-twist-audit.cjs [html] [before|after]
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=path.resolve(process.argv[2]||'index.html'),label=process.argv[3]||'after',out=path.resolve('docs/qa-twist-audit-20261007',label);
fs.mkdirSync(out,{recursive:true});
const htmlBuffer=fs.readFileSync(html),sourceSHA=crypto.createHash('sha256').update(htmlBuffer).digest('hex');
const checks=[],evidence=[],errors=[];const check=(name,ok,data)=>{checks.push({name,ok,...(data?{data}:{})});};
const near=(a,b,tol=1e-7)=>Math.abs(a-b)<=tol;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://localhost:8765/**',r=>r.fulfill({contentType:'text/html',body:htmlBuffer}));
 await page.goto('http://localhost:8765/');
 const snapshot=()=>page.evaluate(()=>({kind:current.kind,positions:{...positions},supports:supports.map((s,i)=>({...s,h:supportHeights[i]})),twist:levelSolution.twist,residual:levelSolution.residual,columns:levelGeometry.columns,pairs:levelGeometry.pairs.map(p=>({key:p.key,local:p.deviationMicroradians,measurement:referenceScan(p)})),sweep:supportsSpindleSweep()?spindleSweepGeometry():null,sweepText:supportsSpindleSweep()?[0,1,2,3].map(i=>$('sweepValue'+i).textContent):null,sweepData:supportsSpindleSweep()?[0,1,2,3].map(i=>$('sweepValue'+i).getAttribute('data-reading-microns')):null,live:$('liveSquareness').innerText,cardText:$('measurementReferenceCards').innerText}));
 async function shot(name){await page.evaluate(()=>{document.getElementById('measurementReference').hidden=true;window.scrollTo(0,0);drawScene();});await page.screenshot({path:path.join(out,name+'-model.png')});await page.evaluate(()=>{document.getElementById('measurementReference').hidden=false;});await page.locator('#liveSquareness').screenshot({path:path.join(out,name+'-measurement.png')});await page.evaluate(()=>document.getElementById('measurementReference').hidden=true);}
 const ids=await page.evaluate(()=>machines.map(m=>m.id));
 for(const id of ids){
  await page.evaluate(id=>{localStorage.clear();openMachine(machines.find(m=>m.id===id));machineProfile=null;machineReference=null;machineSavedBest=null;supportHeights=supports.map(()=>0);updateLeveling(false);},id);
  let ideal=await snapshot();evidence.push({case:id+'-ideal',...ideal});check(id+' ideal all finite scans zero',ideal.pairs.every(p=>p.measurement.valid&&near(p.measurement.microns,0)));if(ideal.kind==='five')check('5-axis twist preset disabled',await page.locator('#twistPreset').isDisabled());
  for(const sign of [-1,1]){
   await page.evaluate(sign=>{positions={X:0,Y:0,Z:0,A:0,C:0};supportHeights=supports.map(p=>Math.round(sign*.1*(p.x/(current.w*.4))*(p.z/(current.d*.4))*1000)/1000);updateLeveling(false);},sign);
   const baseline=await snapshot(),caseName=id+(sign>0?'-positive':'-negative');evidence.push({case:caseName,...baseline});await shot(caseName);
   if(baseline.kind==='five')check(caseName+' three points form a plane',near(baseline.twist,0)&&near(baseline.residual,0));
   const readings=x=>x.pairs.map(p=>[p.measurement.valid,p.measurement.microns,p.measurement.reason]);
   await page.evaluate(()=>{yaw=1.2;sceneZoom=1.6;sceneView='side';$('exaggerate').checked=false;updateLeveling(false);});
   let viewed=await snapshot();check(caseName+' camera zoom exaggeration invariant',JSON.stringify(readings(viewed))===JSON.stringify(readings(baseline))&&JSON.stringify(viewed.sweepData)===JSON.stringify(baseline.sweepData));
   await page.evaluate(()=>{yaw=-.45;sceneZoom=1;sceneView='oblique';$('exaggerate').checked=true;updateLeveling(false);});
   const heights=baseline.supports.map(s=>s.h);await page.evaluate(()=>{changeSupportHeight(0,.01);changeSupportHeight(0,-.01);});const reverted=await snapshot();check(caseName+' support round trip',JSON.stringify(reverted.supports.map(s=>s.h))===JSON.stringify(heights)&&JSON.stringify(readings(reverted))===JSON.stringify(readings(baseline)));
   for(const edge of [-100,100]){
    await page.evaluate(edge=>{for(const a of axisConfig(current))if(['X','Y','Z'].includes(a.key))positions[a.key]=edge;updateLeveling(false);},edge);
    const end=await snapshot();evidence.push({case:caseName+'-all-axes-'+edge,...end});check(caseName+' edge '+edge+' no invalid numbers',end.pairs.every(p=>!p.measurement.valid||Number.isFinite(p.measurement.microns)));
    if(end.sweep?.valid&&!end.sweep.cardinal[3].onTable)check(caseName+' front outside suppresses all sweep values',end.sweepData.every(x=>x===''));
   }
  }
  // Genuine generated individual for public JSON export/import compatibility.
  await page.evaluate(()=>{positions={X:17,Y:current.kind==='lathe'?0:-19,Z:23,A:0,C:0};initializeMachineAccuracy(window.MachineAccuracy.generate('new',20261007,machineLinearKeys(),supports.length));supportHeights=supports.map((s,i)=>i%2?.05:-.05);updateLeveling();});
  const saved=await snapshot(),record=await page.evaluate(()=>levelRecord());
  check(id+' exported JSON accepted',await page.evaluate(r=>validLevelRecord(r),record));
  await page.evaluate(()=>{supportHeights=supports.map(()=>0);positions={X:0,Y:0,Z:0,A:0,C:0};updateLeveling();});
  await page.locator('#importLevel').setInputFiles({name:'audit.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(record))});
  await page.waitForFunction(()=>$('levelInputMessage').textContent.includes('読み込みました'));
  const loaded=await snapshot();check(id+' real file import restores support positions and measurements',JSON.stringify(saved.supports)===JSON.stringify(loaded.supports)&&JSON.stringify(saved.positions)===JSON.stringify(loaded.positions)&&JSON.stringify(saved.pairs)===JSON.stringify(loaded.pairs));
  if(id==='five')for(const ac of [[50,0],[0,50],[50,50]]){await page.evaluate(ac=>{positions.A=ac[0];positions.C=ac[1];updateLeveling(false);},ac);const s=await snapshot();evidence.push({case:'five-rotary-'+ac.join('-'),...s});check('5-axis posture '+ac+' linear scans suppressed',s.pairs.every(p=>!p.measurement.valid&&p.measurement.reason.includes('A/C')));if(s.sweep?.valid&&!s.sweep.cardinal[3].onTable)check('5-axis posture '+ac+' front outside suppresses sweep',s.sweepData.every(x=>x===''));}
 }
 // Display defects with a non-corner input; corners alone cannot show this shape.
 for(const id of ['horizontal','lathe','gate']){
  await page.evaluate(id=>{localStorage.clear();openMachine(machines.find(m=>m.id===id));machineProfile=null;machineReference=null;machineSavedBest=null;supportHeights=supports.map(s=>current.id==='gate'?(s.group==='column-left'?.2:0):(Math.abs(s.x)<current.w*.35||Math.abs(s.z)<current.d*.35?.15:0));positions={X:0,Y:0,Z:0,A:0,C:0};updateLeveling(false);},id);
  evidence.push({case:id+'-intermediate',...await snapshot()});await shot(id+'-intermediate');
 }
 // Hand-derived ray-plane contacts: extension lambda = n·(P-B)/n·u.
 // Increasing extension means less compression and therefore negative reading.
 const contactCases=await page.evaluate(()=>{
  const M=window.ReferenceMeasurement,z={point:[0,0,0],normal:[1,0,0],body:[.01,0,0],probe:[-1,0,0]},end={...z,body:[.00998,.3,0]},op={point:[0,0,0],normal:[-1,0,0],body:[-.01,0,0],probe:[1,0,0]},opEnd={...op,body:[-.01002,.3,0]};
  const theta=.002,tilt={...z,body:[.01,.3,0],probe:[-Math.cos(theta),Math.sin(theta),0]},rot=v=>[-v[1],v[2],-v[0]],shift=[.3,-.9,.7],transform=p=>({...p,point:rot(p.point).map((v,i)=>v+shift[i]),body:rot(p.body).map((v,i)=>v+shift[i]),normal:rot(p.normal),probe:rot(p.probe)});
  return {approach:M.compare(z,end),away:M.compare(end,z),opposite:M.compare(op,opEnd),reverse:M.compare(end,z),rigid:M.compare(transform(z),transform(end)),attitude:M.compare(z,tilt),attitudeReverse:M.compare(tilt,z)};
 });
 for(const [name,expected] of [['approach',20],['away',-20],['opposite',-20],['reverse',-20],['rigid',20],['attitude',10000*(1-1/Math.cos(.002))],['attitudeReverse',-10000*(1-1/Math.cos(.002))]])check('independent contact '+name,contactCases[name].valid&&near(contactCases[name].microns,expected),{actual:contactCases[name].microns,expected});
 check('no browser JavaScript exceptions',errors.length===0,errors);
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>openMachine(machines[0]));await page.screenshot({path:path.join(out,'mobile.png')});
 const mobile=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,touch:getComputedStyle($('scene')).touchAction}));check('mobile no horizontal document overflow',mobile.scroll<=mobile.width+1,mobile);
 const result={label,source:html,sha256:sourceSHA,browser:browser.version(),checks,evidence,contactCases,errors};
 fs.writeFileSync(path.join(out,'browser-audit.json'),JSON.stringify(result,null,2));await browser.close();console.log(JSON.stringify({label,checks:checks.length,passed:checks.filter(x=>x.ok).length,failed:checks.filter(x=>!x.ok),cases:evidence.length,out},null,2));
 process.exitCode=checks.some(x=>!x.ok)?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});

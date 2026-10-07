'use strict';
// Focused browser evidence for machine 1. Expected physical directions and the
// pure-angle contact formula are supplied here, not read from a production sign table.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const input=path.resolve(process.argv[2]||'index.html');
const out=path.resolve('docs/qa-yz-redraw-20261007');fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync(input),checks=[],states=[],errors=[];
const check=(name,ok,detail)=>checks.push({name,ok,...(detail===undefined?{}:{detail})});
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://localhost:8765/**',r=>r.fulfill({contentType:'text/html',body:html}));await page.goto('http://localhost:8765/');
 const cases=[{id:'ideal',angle:0,twist:0},{id:'yz-positive-angle',angle:30,twist:0},{id:'yz-negative-angle',angle:-30,twist:0},{id:'positive-twist',angle:0,twist:.12},{id:'negative-twist',angle:0,twist:-.12}];
 for(const c of cases){
  await page.evaluate(c=>{openMachine(machines[0]);machineProfile=c.angle?{squareness:{XY:{microns:0},XZ:{microns:0},YZ:{microns:c.angle}},guides:{},initialHeights:supports.map(()=>0)}:null;machineReference=null;machineSavedBest=null;positions={X:0,Y:0,Z:0,A:0,C:0};supportHeights=supports.map(p=>c.twist*(p.x/(current.w*.4))*(p.z/(current.d*.4)));updateLeveling(false);},c);
  const read=()=>page.evaluate(()=>({measurements:levelGeometry.pairs.map(p=>{const m=referenceScan(p);return{pair:p.key,valid:m.valid,value:m.microns,angle:p.deviationMicroradians};}),diagrams:[...document.querySelectorAll('#liveSquareness svg')].map(e=>({pair:e.dataset.pair,right:e.dataset.viewRight,up:e.dataset.viewUp,relative:e.dataset.relativeDirection,zeroLocation:e.dataset.zeroLocationMeasurement,zero:+e.querySelector('.scan-zero').getAttribute('cy'),contact:+e.querySelector('.scan-contact').getAttribute('cy'),bodyNormal:+e.querySelector('.scan-geometry').dataset.bodyNormalM,reading:+e.dataset.readingMicrons,display:e.parentElement.querySelector('.live-pair-error-value').textContent})),yzCard:document.querySelector('[data-reference-pair="YZ"]').innerText}));
  const initial=await read();states.push({case:c,...initial});
  const yz=initial.measurements.find(m=>m.pair==='YZ');
  check(`${c.id}: all three contacts valid`,initial.measurements.every(m=>m.valid));
  if(!c.twist){
   // Positive YZ angle >90° tilts +Z toward front. Downward Z then travels
   // toward rear (away from rear-facing S), so the spindle extends: negative.
   const expected=-.3*Math.sin(c.angle/300000)*1e6;
   check(`${c.id}: independent ray-plane compression`,Math.abs(yz.value-expected)<1e-6,{expected,actual:yz.value});
   check(`${c.id}: XY and XZ stay zero`,initial.measurements.filter(m=>m.pair!=='YZ').every(m=>Math.abs(m.value)<1e-6));
  }
  check(`${c.id}: YZ explanation states rear-side upper zero and downward travel`,/上・奥側/.test(initial.yzCard)&&/部材−Z・下/.test(initial.yzCard)&&/図の右＝奥、図の上＝上/.test(initial.yzCard));
  for(const [width,height] of [[1280,1000],[320,568]]){
   await page.setViewportSize({width,height});const snapshot=await read();
   const d=snapshot.diagrams.find(d=>d.pair==='YZ');
   check(`${c.id}/${width}: YZ fixed physical projection`,d.right==='奥'&&d.up==='上'&&d.relative==='下'&&d.zeroLocation==='上・奥側'&&d.zero===14&&d.contact>30&&d.contact<33);
   check(`${c.id}/${width}: viewport does not change values`,JSON.stringify(snapshot.measurements)===JSON.stringify(initial.measurements));
   check(`${c.id}/${width}: visible rounded YZ reading`,Number(d.display)===Math.round(yz.value));
   await page.screenshot({path:path.join(out,`compact-${c.id}-${width}.png`)});
   await page.locator('#liveSquareness').screenshot({path:path.join(out,`compact-${c.id}-${width}-diagrams.png`)});
  }
  const saved=await page.evaluate(()=>({yaw,sceneZoom,exaggerate:$('exaggerate').checked}));
  await page.evaluate(()=>{yaw+=.4;sceneZoom=1.2;$('exaggerate').checked=!$('exaggerate').checked;drawScene();});
  check(`${c.id}: camera zoom exaggeration preserve readings`,JSON.stringify((await read()).measurements)===JSON.stringify(initial.measurements));
  await page.evaluate(s=>{yaw=s.yaw;sceneZoom=s.sceneZoom;$('exaggerate').checked=s.exaggerate;drawScene();},saved);
 }
 const tiltCases=[];
 await page.setViewportSize({width:1280,height:1000});
 for(const [id,slope] of [['front',.15],['upright',-.1],['back',-.35]]){
  await page.evaluate(slope=>{openMachine(machines[0]);machineProfile={squareness:{XY:{microns:0},XZ:{microns:0},YZ:{microns:30}},guides:{},initialHeights:supports.map(()=>0)};machineReference=null;machineSavedBest=null;positions={X:0,Y:0,Z:0,A:0,C:0};supportHeights=supports.map(p=>slope*levelCoordinates(p.x,p.z).z);updateLeveling(false);selectAxis('Z');setSceneView('side');},slope);
  const q=await page.evaluate(()=>({heights:[...supportHeights],columnFrontMicroradians:levelGeometry.bodyPosture.front,tableFrontMicroradians:Math.atan2(-levelGeometry.workFrame.up[2],levelGeometry.workFrame.up[1])*1e6,measuredYDirection:levelGeometry.directions.find(a=>a.key==='Y').direction,zDirection:levelGeometry.directions.find(a=>a.key==='Z').direction,yz:referenceScan({key:'YZ'}).microns}));
  tiltCases.push({id,slope,...q});
  check(`${id}: rigid front/back leveling cannot remove intrinsic YZ angle`,Math.abs(q.yz+ .3*Math.sin(30/300000)*1e6)<1e-6,q);
  await page.screenshot({path:path.join(out,`compact-common-tilt-${id}-side.png`)});
 }
 check('column actually crosses front/upright/back in three browser states',tiltCases[0].columnFrontMicroradians>200&&Math.abs(tiltCases[1].columnFrontMicroradians)<.01&&tiltCases[2].columnFrontMicroradians< -200,tiltCases);
 fs.writeFileSync(path.join(out,'browser-compact-yz-common-tilt.json'),JSON.stringify(tiltCases,null,2));
 await page.evaluate(()=>toggleMeasurementReference(true));
 const explanation=page.locator('[data-reference-pair="YZ"] p').filter({hasText:'コラムの前後倒れは床に対する姿勢'});
 const explanationText=await explanation.innerText();
 check('YZ explanation distinguishes common tilt and limited adjustment response',/相対関係/.test(explanationText)&&/値は変わりません/.test(explanationText)&&/中央付近/.test(explanationText)&&/初期の寸法・コラム配置/.test(explanationText)&&/固有誤差の大きさによっては調整しきれません/.test(explanationText));
 await explanation.scrollIntoViewIfNeeded();
 await page.screenshot({path:path.join(out,'compact-yz-explanation.png')});
 await explanation.screenshot({path:path.join(out,'compact-yz-explanation-text.png')});
 check('no browser exceptions',errors.length===0,errors);
 const report={input,sha256:crypto.createHash('sha256').update(html).digest('hex'),browser:browser.version(),checks,states,errors};
 fs.writeFileSync(path.join(out,'browser-compact-yz.json'),JSON.stringify(report,null,2));await browser.close();
 console.log(JSON.stringify({checks:checks.length,passed:checks.filter(c=>c.ok).length,failed:checks.filter(c=>!c.ok),sha256:report.sha256}));process.exitCode=checks.some(c=>!c.ok)?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});

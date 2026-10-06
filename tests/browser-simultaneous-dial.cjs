'use strict';
// End-to-end Chromium checks against the built single-file page.
// This verifies browser layout and real event handlers, not physical phone gestures.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.DIAL_BASE_URL||'http://127.0.0.1:8765/index.html';
const output='tmp/qa-dial';
fs.mkdirSync(output,{recursive:true});
const summary={url:base,checks:0,failures:[],browserErrors:[],layouts:[],screenshots:[],physicalPhoneGestures:'not tested'};
let browser,context,p;
function check(name,fn){summary.checks++;try{fn();}catch(error){summary.failures.push({name,message:error.message});}}
function near(a,b,t=1e-8){assert(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,a+' != '+b);}
function valuesNear(a,b,t=1e-8){assert.equal(a.length,b.length);a.forEach((v,i)=>near(v,b[i],t));}
async function screenshot(name){
 const image=await p.screenshot({path:path.join(output,name+'.png'),fullPage:false});
 summary.screenshots.push(name+'.png');
 if(process.env.EMIT_SCREENSHOTS==='1')console.log('SCREENSHOT:'+name+':'+image.toString('base64'));
}
async function snapshot(){return p.evaluate(()=>{
 const g=spindleSweepGeometry(),values=Array.from({length:4},(_,i)=>document.getElementById('sweepValue'+i).getAttribute('data-reading-microns'));
 return {
  record:levelRecord(),sweep:values.map(v=>v===''?null:Number(v)),
  geometry:g.valid?g.cardinal.map(v=>v.readingMicrons):[],
  onTable:g.valid?g.cardinal.map(v=>v.onTable):[],
  pairRaw:[...document.querySelectorAll('.live-pair-error-value')].map(el=>Number(el.getAttribute('data-current-error-300'))),
  pairGeometry:levelGeometry.pairs.map(pair=>pair.deviationMicroradians*.3),
  model:levelGeometry.bodyCombinedDirection,
  bubble:[document.getElementById('coarseBubbleLR').style.left,document.getElementById('coarseBubbleFB').style.getPropertyValue('--bubble-position')],
  angle:spindleSweepAngle,zoom:sceneZoom,yaw,selectedAxis,
  canvas:document.getElementById('scene').toDataURL(),
  mode:spindleSweepMode,version:currentCalculationModel()
 };
});}
async function assertReadings(name){
 const state=await snapshot();
 check(name+' direct model and both DOM readings agree',()=>{
  assert(state.onTable[0]);valuesNear(state.sweep,state.geometry);valuesNear(state.pairRaw,state.pairGeometry);
 });
 return state;
}
async function layout(name){
 const metrics=await p.evaluate(()=>{
  const ids=['precisionReadouts','liveSquareness','liveSquarenessUnits','spindleSweepPanel','sweepCurrentValue','sweepContactStatus','sceneViewport','scene','viewerLevels','sceneToolbar','axisTabs','runSpindleSweep','mainAdjustment','lowerSupport','raiseSupport','openTrainingMenu'];
  const rectangles={};
  for(const id of ids){
   const el=document.getElementById(id),b=el?.getBoundingClientRect();
   rectangles[id]=b?{x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom,visible:el.checkVisibility({checkVisibilityCSS:true}),overflow:el.scrollWidth-el.clientWidth}:null;
  }
  const ids2=['sweepPosition0','sweepPosition1','sweepPosition2','sweepPosition3','lowerSupport','raiseSupport','runSpindleSweep'];
  const buttons=ids2.map(id=>{
   const el=document.getElementById(id),b=el.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);
   return {id,width:b.width,height:b.height,hit:!!hit&&(hit===el||el.contains(hit)),right:b.right,bottom:b.bottom};
  });
  const pairs=[...document.querySelectorAll('#liveSquareness .live-squareness-item')].map(el=>{
   const b=el.getBoundingClientRect(),svg=el.querySelector('svg'),value=el.querySelector('.live-pair-error-value');
   return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,overflow:el.scrollWidth-el.clientWidth,svgVisible:svg.checkVisibility({checkVisibilityCSS:true}),text:value.textContent};
  });
  const textOverflow=[...document.querySelectorAll('#liveSquareness .live-pair-error-value,#spindleSweepPanel button span,#spindleSweepPanel button strong')].filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.textContent);
  return {width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight,rectangles,buttons,pairs,textOverflow};
 });
 summary.layouts.push({name,...metrics});
 const r=metrics.rectangles;
 check(name+' both readout panels and fixed controls visible',()=>{
  for(const id of ['liveSquareness','liveSquarenessUnits','spindleSweepPanel','scene','viewerLevels','axisTabs','runSpindleSweep','lowerSupport','raiseSupport']){
   assert(r[id]?.visible,id+' hidden');assert(r[id].width>0&&r[id].height>0,id+' empty');
   assert(r[id].x>=-1&&r[id].y>=-1&&r[id].right<=metrics.width+1&&r[id].bottom<=metrics.height+1,id+' outside viewport: '+JSON.stringify(r[id]));
  }
  assert.equal(metrics.pairs.length,3);assert(metrics.pairs.every(v=>v.svgVisible));
 });
 check(name+' dial stays right of squareness above model',()=>{
  assert(r.spindleSweepPanel.x>=r.liveSquareness.right-1,'dial is not right of squareness');
  assert(Math.max(r.liveSquareness.bottom,r.spindleSweepPanel.bottom)<=r.sceneViewport.y+1,'readout overlaps model');
  assert(r.sceneToolbar.y>=r.sceneViewport.bottom-1,'axis controls overlay model');
  assert(r.scene.width>=110&&r.scene.height>=45,'model canvas too small '+r.scene.width+'x'+r.scene.height);
 });
 check(name+' no horizontal overflow or clipped readings',()=>{
  assert(metrics.documentWidth<=metrics.width+1,'horizontal document overflow');assert.equal(metrics.textOverflow.length,0,metrics.textOverflow.join(', '));
  assert(metrics.pairs.every(v=>v.overflow<=1),'squareness item overflow');
 });
 check(name+' measured point and adjustment buttons remain tappable',()=>{
  for(const b of metrics.buttons){assert(b.width>=43&&b.height>=43,b.id+' smaller than 44px');assert(b.hit,b.id+' occluded');}
 });
 await screenshot(name);
}
(async()=>{
 browser=await chromium.launch({headless:true});
 context=await browser.newContext({viewport:{width:1366,height:900},deviceScaleFactor:1,hasTouch:true,acceptDownloads:true});
 p=await context.newPage();
 p.on('pageerror',error=>summary.browserErrors.push(error.message));
 await p.goto(base,{waitUntil:'networkidle'});
 await p.evaluate(()=>{
  localStorage.clear();openMachine(machines[0]);
  initializeMachineAccuracy(window.MachineAccuracy.generate('used',78129,['X','Y','Z'],4));
  positions={X:0,Y:0,Z:0,A:0,C:0};supportHeights=[0,0,.1,0];updateAxisValues();updateLeveling();
 });
 await p.locator('#spindleSweepPanel').waitFor({state:'visible'});
 await p.evaluate(()=>document.fonts.ready);
 for(const [name,width,height] of [
  ['pc-1366x900',1366,900],['mobile-320x480',320,480],['mobile-320x568',320,568],
  ['mobile-390x844',390,844],['landscape-568x320',568,320],['landscape-844x390',844,390]
 ]){
  await p.setViewportSize({width,height});await p.waitForTimeout(200);await layout(name);
 }
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(200);
 check('old replacement-mode toggle removed',()=>{});
 check('browser starts without script errors',()=>assert.deepEqual(summary.browserErrors,[]));
 assert.equal(await p.locator('#toggleSpindleSweep').count(),0);
 const before=await assertReadings('initial');
 await p.locator('#supportMap button').nth(2).click();
 await p.locator('#coarseAdjust').click();
 await p.locator('#raiseSupport').click();
 const raised=await assertReadings('support raised');
 check('coarse support step changes model, level, squareness and dial',()=>{
  near(raised.record.heights[2]-before.record.heights[2],.01);
  assert(raised.geometry.some((v,i)=>Math.abs(v-before.geometry[i])>.001),'dial did not respond');
  assert(raised.pairRaw.some((v,i)=>Math.abs(v-before.pairRaw[i])>.001),'squareness did not respond');
  assert.notDeepEqual(raised.model,before.model);assert.notDeepEqual(raised.bubble,before.bubble);
  assert.notEqual(raised.canvas,before.canvas,'model image unchanged');
 });
 await p.locator('#lowerSupport').click();
 const restored=await assertReadings('support restored');
 check('reverse support adjustment restores both measurements and machine',()=>{
  assert.deepEqual(restored.record.heights,before.record.heights);valuesNear(restored.geometry,before.geometry);valuesNear(restored.pairRaw,before.pairRaw);
 });
 await p.locator('#fineAdjust').click();await p.locator('#raiseSupport').click();
 const fine=await snapshot();check('fine step remains 0.001 mm',()=>near(fine.record.heights[2]-restored.record.heights[2],.001));
 await p.locator('#lowerSupport').click();await p.locator('#coarseAdjust').click();
 for(let i=0;i<4;i++){
  await p.locator('#sweepPosition'+i).click();
  const current=await p.locator('#sweepCurrentValue').getAttribute('data-reading-microns');
  const pressed=await p.locator('#sweepPosition'+i).getAttribute('aria-pressed');
  const angle=await p.locator('#sweepCurrentAngle').textContent();
  check('select '+(i*90)+' degrees',()=>{assert.equal(angle,i*90+'°');assert.equal(pressed,'true');near(Number(current),restored.geometry[i]);});
 }
 const beforeRun=await snapshot();
 await p.locator('#runSpindleSweep').click();
 await p.waitForFunction(()=>spindleSweepTimer===null&&document.getElementById('runSpindleSweep').textContent==='1周回す',{},{timeout:15000});
 const afterRun=await snapshot();
 check('one full rotation returns to start with unchanged machine and readings',()=>{
  near(afterRun.angle,beforeRun.angle);assert.deepEqual(afterRun.record,beforeRun.record);valuesNear(afterRun.sweep,beforeRun.sweep);valuesNear(afterRun.pairRaw,beforeRun.pairRaw);
 });
 for(const key of ['Y','Z','X']){
  await p.locator('#axisTabs button').filter({hasText:key+'軸'}).click();
  const state=await snapshot();check('axis '+key+' remains selectable beside dial',()=>{assert.equal(state.selectedAxis,key);valuesNear(state.sweep,afterRun.sweep);valuesNear(state.pairRaw,afterRun.pairRaw);});
 }
 const stable=await snapshot();
 await p.locator('#openTrainingMenu').click();await p.locator('#closeTrainingMenu').click();
 await p.locator('#scene').hover();await p.mouse.wheel(0,-100);
 const box=await p.locator('#scene').boundingBox();
 await p.mouse.move(box.x+box.width*.35,box.y+box.height*.5);await p.mouse.down();await p.mouse.move(box.x+box.width*.65,box.y+box.height*.5,{steps:5});await p.mouse.up();
 const viewed=await snapshot();
 check('sidebar, mouse wheel and drag affect viewing only',()=>{
  assert.notEqual(viewed.zoom,stable.zoom);assert.notEqual(viewed.yaw,stable.yaw);assert.deepEqual(viewed.record,stable.record);valuesNear(viewed.sweep,stable.sweep);valuesNear(viewed.pairRaw,stable.pairRaw);
 });
 await p.locator('#openTrainingMenu').click();
 await p.locator('#modelDisplaySettings > summary').click();
 await p.locator('#exaggerate').uncheck();await p.locator('#closeTrainingMenu').click();
 const plain=await snapshot();check('display exaggeration does not change measurements',()=>{valuesNear(plain.sweep,viewed.sweep);valuesNear(plain.pairRaw,viewed.pairRaw);});
 // Real download and file input handlers exercise persisted data, with a mutation in between.
 await p.locator('#openTrainingMenu').click();await p.locator('.level-storage > summary').click();
 const downloadPromise=p.waitForEvent('download');await p.locator('#exportLevel').click();const download=await downloadPromise;
 const savedFile=path.join(output,'saved-level.json');await download.saveAs(savedFile);
 const saved=JSON.parse(fs.readFileSync(savedFile,'utf8')),savedReadings=await snapshot();
 await p.locator('#closeTrainingMenu').click();await p.locator('#raiseSupport').click();
 await p.locator('#openTrainingMenu').click();
 await p.locator('#importLevel').setInputFiles(savedFile);
 await p.waitForFunction(()=>document.getElementById('levelSaveStatus').textContent.includes('読み込みました'));
 await p.locator('#closeTrainingMenu').click();const reloaded=await snapshot();
 check('JSON download and upload reproduce calculation state and both values',()=>{
  assert.deepEqual(reloaded.record,saved);assert.deepEqual(reloaded.record,savedReadings.record);valuesNear(reloaded.sweep,savedReadings.sweep);valuesNear(reloaded.pairRaw,savedReadings.pairRaw);
 });
 await p.reload({waitUntil:'networkidle'});await p.evaluate(()=>openMachine(machines[0]));const reopened=await snapshot();
 check('browser storage restores after page reload',()=>{assert.deepEqual(reopened.record,saved);valuesNear(reopened.sweep,savedReadings.sweep);valuesNear(reopened.pairRaw,savedReadings.pairRaw);});
 // Set the actual Y slider via its native input event, moving the front contact off-table.
 await p.locator('#openTrainingMenu').click();await p.locator('#axisMenuSection > summary').click();await p.locator('#drawerAxisSelect').selectOption('Y');
 await p.locator('#axis-Y').evaluate(el=>{el.value='100';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await p.locator('#closeTrainingMenu').click();await p.locator('#sweepPosition3').click();
 const off=await snapshot(),offText=await p.locator('#sweepValue3').textContent(),currentText=await p.locator('#sweepCurrentValue').textContent();
 check('off-table contact has no normal displayed reading',()=>{assert.equal(off.onTable[3],false);assert.equal(off.sweep[3],null);assert.equal(offText,'面外');assert.equal(currentText,'測定できません');});
 await screenshot('off-table-390x844');
 await p.locator('#openTrainingMenu').click();await p.locator('#resetAxes').click();await p.locator('#closeTrainingMenu').click();await assertReadings('after recenter');
 const expectedCounts=[4,8,6,15,8,3,6];
 for(let i=0;i<7;i++){
  await p.evaluate(index=>openMachine(machines[index]),i);
  const machine=await p.evaluate(()=>({count:supports.length,keys:axisConfig(current).map(a=>a.key),mode:spindleSweepMode,panel:!document.getElementById('spindleSweepPanel').hidden,run:!document.getElementById('runSpindleSweep').hidden,square:!document.getElementById('liveSquareness').hidden,groups:supports.reduce((acc,s)=>{acc[s.group]=(acc[s.group]||0)+1;return acc;},{})}));
  check('machine '+i+' retains support count, axes and applicability',()=>{
   assert.equal(machine.count,expectedCounts[i]);assert.equal(machine.mode,i===0);assert.equal(machine.panel,i===0);assert.equal(machine.run,i===0);assert.equal(machine.square,true);
   if(i===5)assert.deepEqual(machine.keys,['X','Y','Z','A','C']);if(i===6)assert.deepEqual(machine.keys,['X','Z']);
   if(i===3)assert.equal(Object.values(machine.groups).reduce((a,b)=>a+b,0),15);
  });
 }
 check('all browser events finish without script errors',()=>assert.deepEqual(summary.browserErrors,[]));
})().catch(error=>summary.failures.push({name:'browser suite execution',message:error.stack||error.message})).finally(async()=>{
 fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify(summary,null,2));
 console.log('BROWSER_SUMMARY:'+JSON.stringify(summary));
 if(browser)await browser.close();if(summary.failures.length)process.exitCode=1;
});

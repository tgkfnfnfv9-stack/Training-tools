'use strict';
// End-to-end Chromium checks against the built single-file page.
// This verifies browser layout and real event handlers, not physical phone gestures.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.DIAL_BASE_URL||'http://127.0.0.1:8765/index.html';
const output='tmp/qa-dial';
fs.mkdirSync(output,{recursive:true});
// These canvas heights were verified on the last published main. Shrinking
// the measurements must give the machine real additional room on every size.
const previousCanvasHeights={'pc-1366x900':385,'mobile-320x480':98,'mobile-320x568':117,'mobile-390x844':330,'landscape-568x320':98,'landscape-844x390':168};
const summary={url:base,comparisonCommit:'ddf6492bc002592fd2f39991311fd0dc7816025e',previousCanvasHeights,checks:0,failures:[],browserErrors:[],layouts:[],screenshots:[],physicalPhoneGestures:'not tested'};
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
  const ids=['precisionReadouts','liveSquareness','liveSquarenessUnits','spindleSweepPanel','sweepContactStatus','sceneViewport','scene','viewerLevels','sceneToolbar','axisTabs','mainAdjustment','lowerSupport','raiseSupport','openTrainingMenu'];
  const rectangles={};
  for(const id of ids){
   const el=document.getElementById(id),b=el?.getBoundingClientRect();
   rectangles[id]=b?{x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom,visible:el.checkVisibility({checkVisibilityCSS:true}),overflow:el.scrollWidth-el.clientWidth}:null;
  }
  const ids2=['sweepPosition0','sweepPosition1','sweepPosition2','sweepPosition3','lowerSupport','raiseSupport'];
  const buttons=ids2.map(id=>{
   const el=document.getElementById(id),b=el.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);
   return {id,width:b.width,height:b.height,hit:!!hit&&(hit===el||el.contains(hit)),right:b.right,bottom:b.bottom};
  });
  const pairs=[...document.querySelectorAll('#liveSquareness .live-squareness-item')].map(el=>{
   const b=el.getBoundingClientRect(),svg=el.querySelector('svg'),value=el.querySelector('.live-pair-error-value');
   return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,overflow:el.scrollWidth-el.clientWidth,svgVisible:svg.checkVisibility({checkVisibilityCSS:true}),text:value.textContent};
  });
  const textOverflow=[...document.querySelectorAll('#liveSquareness .live-pair-error-value,#spindleSweepPanel button span,#spindleSweepPanel button strong')].filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.textContent);
  const gaugeChildren=[...document.querySelectorAll('#viewerLevels *')].filter(el=>el.checkVisibility({checkVisibilityCSS:true})).map(el=>{
   const b=el.getBoundingClientRect();return {className:el.className,text:el.children.length?'':el.textContent,x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height};
  }).filter(b=>b.width>0&&b.height>0);
  const scroll=document.getElementById('adjustmentSelectionScroll'),sb=scroll.getBoundingClientRect();
  return {width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight,rectangles,buttons,pairs,textOverflow,gaugeChildren,selectionScroll:{y:sb.y,bottom:sb.bottom,height:sb.height,clientHeight:scroll.clientHeight,scrollHeight:scroll.scrollHeight}};
 });
 summary.layouts.push({name,...metrics});
 const r=metrics.rectangles;
 check(name+' both readout panels and fixed controls visible',()=>{
  for(const id of ['liveSquareness','liveSquarenessUnits','spindleSweepPanel','scene','viewerLevels','axisTabs','lowerSupport','raiseSupport']){
   assert(r[id]?.visible,id+' hidden');assert(r[id].width>0&&r[id].height>0,id+' empty');
   assert(r[id].x>=-1&&r[id].y>=-1&&r[id].right<=metrics.width+1&&r[id].bottom<=metrics.height+1,id+' outside viewport: '+JSON.stringify(r[id]));
  }
  assert.equal(metrics.pairs.length,3);assert(metrics.pairs.every(v=>v.svgVisible));
 });
 check(name+' dial stays right of squareness above model',()=>{
  assert(r.spindleSweepPanel.x>=r.liveSquareness.right-1,'dial is not right of squareness');
  assert(Math.max(r.liveSquareness.bottom,r.spindleSweepPanel.bottom)<=r.sceneViewport.y+1,'readout overlaps model');
  assert(r.sceneToolbar.y>=r.sceneViewport.bottom-1,'axis controls overlay model');
  assert(r.scene.width>=110&&r.scene.height>=90,'model canvas too small '+r.scene.width+'x'+r.scene.height);
 });
 check(name+' compact measurements give the machine more height than previous main',()=>{
  assert(r.scene.height>previousCanvasHeights[name]+1,'model height '+r.scene.height+' did not improve on '+previousCanvasHeights[name]);
 });
 check(name+' no horizontal overflow or clipped readings',()=>{
  assert(metrics.documentWidth<=metrics.width+1,'horizontal document overflow');assert.equal(metrics.textOverflow.length,0,metrics.textOverflow.join(', '));
  assert(metrics.pairs.every(v=>v.overflow<=1),'squareness item overflow');
 });
 check(name+' level gauge contents remain inside their model row',()=>{
  for(const child of metrics.gaugeChildren){
   assert(child.x>=r.viewerLevels.x-1&&child.right<=r.viewerLevels.right+1,'gauge horizontal overflow '+JSON.stringify(child));
   assert(child.y>=r.viewerLevels.y-1&&child.bottom<=r.viewerLevels.bottom+1,'gauge overlaps toolbar '+JSON.stringify(child));
   assert(child.bottom<=metrics.height+1,'gauge outside viewport');
  }
 });
 check(name+' scrolling choice area can contain a complete touch target',()=>{
  assert(metrics.selectionScroll.clientHeight>=44,'choice area too short: '+metrics.selectionScroll.clientHeight);
 });
 check(name+' measured point and adjustment buttons remain tappable',()=>{
  for(const b of metrics.buttons){assert(b.width>=43&&b.height>=43,b.id+' smaller than 44px');assert(b.hit,b.id+' occluded');}
 });
 await screenshot(name);
}
async function smallViewportControls(name){
 const before=await snapshot(),sceneBefore=await p.locator('#scene').boundingBox();
 for(const [selector,index] of [['#coarseAdjust',0],['#fineAdjust',0],['#supportMap button',3],['#supportMap button',0],['#coarseAdjust',0]]){
  const control=p.locator(selector).nth(index);await control.scrollIntoViewIfNeeded();
  const box=await control.boundingBox(),scrollBox=await p.locator('#adjustmentSelectionScroll').boundingBox();
  check(name+' full control visible after internal scroll '+selector+'/'+index,()=>{
   assert(box.height>=44);assert(box.y>=scrollBox.y-1&&box.y+box.height<=scrollBox.y+scrollBox.height+1,'control remains clipped');
  });
  await control.click();
  const value=await control.getAttribute('aria-pressed');check(name+' scroll control responds '+selector+'/'+index,()=>assert.equal(value,'true'));
 }
 await p.locator('#raiseSupport').click();await p.locator('#lowerSupport').click();
 const after=await snapshot(),sceneAfter=await p.locator('#scene').boundingBox();
 check(name+' scrolling choices and support operations preserve fixed model and restore measurements',()=>{
  assert.deepEqual(sceneAfter,sceneBefore);assert.deepEqual(after.record,before.record);valuesNear(after.sweep,before.sweep);valuesNear(after.pairRaw,before.pairRaw);
 });
 await p.locator('#adjustmentSelectionScroll').evaluate(el=>{el.scrollTop=0;});
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
 const beforeResizing=await snapshot();
 for(const [name,width,height] of [
  ['pc-1366x900',1366,900],['mobile-320x480',320,480],['mobile-320x568',320,568],
  ['mobile-390x844',390,844],['landscape-568x320',568,320],['landscape-844x390',844,390]
 ]){
  await p.setViewportSize({width,height});await p.waitForTimeout(200);
  await p.locator('#adjustmentSelectionScroll').evaluate(el=>{el.scrollTop=0;});
  if(name==='mobile-320x480'||name==='landscape-568x320')await smallViewportControls(name);
  await layout(name);
  const afterResizing=await snapshot();
  check(name+' resizing preserves physical state and both measurements',()=>{assert.deepEqual(afterResizing.record,beforeResizing.record);valuesNear(afterResizing.sweep,beforeResizing.sweep);valuesNear(afterResizing.pairRaw,beforeResizing.pairRaw);});
 }
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(200);
 const oldToggleCount=await p.locator('#toggleSpindleSweep').count();
 check('old replacement-mode toggle removed',()=>assert.equal(oldToggleCount,0));
 const removed=await p.evaluate(()=>({
  elements:['runSpindleSweep','sweepDial','sweepCurrentAngle','sweepCurrentValue'].filter(id=>document.getElementById(id)),
  draw:typeof drawSpindleSweep,markup:typeof sweepDialMarkup,run:typeof runSpindleSweep,stop:typeof stopSpindleSweep,timer:typeof spindleSweepTimer,
  pictures:document.querySelectorAll('#spindleSweepPanel svg,#spindleSweepPanel canvas,#spindleSweepPanel img').length
 }));
 check('round operation and both dial drawings are completely removed',()=>{assert.deepEqual(removed,{elements:[],draw:'undefined',markup:'undefined',run:'undefined',stop:'undefined',timer:'undefined',pictures:0});});
 check('browser starts without script errors',()=>assert.deepEqual(summary.browserErrors,[]));
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
  const state=await snapshot(),pressed=await p.locator('.sweep-positions button').evaluateAll(buttons=>buttons.map(b=>b.getAttribute('aria-pressed')));
  check('select '+(i*90)+' degrees without changing measurements',()=>{assert.equal(state.angle,i*90);assert.deepEqual(pressed,[0,1,2,3].map(j=>String(j===i)));valuesNear(state.sweep,restored.geometry);assert.deepEqual(state.record,restored.record);});
 }
 const afterSelection=await snapshot();
 for(const key of ['Y','Z','X']){
  await p.locator('#axisTabs button').filter({hasText:key+'軸'}).click();
  const state=await snapshot();check('axis '+key+' remains selectable beside dial',()=>{assert.equal(state.selectedAxis,key);valuesNear(state.sweep,afterSelection.sweep);valuesNear(state.pairRaw,afterSelection.pairRaw);});
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
 const off=await snapshot(),offText=await p.locator('#sweepValue3').textContent(),status=await p.locator('#sweepContactStatus').textContent();
 check('off-table contact has no normal displayed reading',()=>{assert.equal(off.onTable[3],false);assert.equal(off.sweep[3],null);assert.equal(offText,'面外');assert.match(status,/面外/);assert.equal(off.angle,270);});
 await screenshot('off-table-390x844');
 await p.locator('#openTrainingMenu').click();await p.locator('#resetAxes').click();await p.locator('#closeTrainingMenu').click();await assertReadings('after recenter');
 const expectedCounts=[4,8,6,15,8,3,6];
 for(let i=0;i<7;i++){
  await p.evaluate(index=>openMachine(machines[index]),i);
  const machine=await p.evaluate(()=>({count:supports.length,keys:axisConfig(current).map(a=>a.key),mode:spindleSweepMode,panel:!document.getElementById('spindleSweepPanel').hidden,run:document.getElementById('runSpindleSweep'),square:!document.getElementById('liveSquareness').hidden,groups:supports.reduce((acc,s)=>{acc[s.group]=(acc[s.group]||0)+1;return acc;},{})}));
  check('machine '+i+' retains support count, axes and applicability',()=>{
   assert.equal(machine.count,expectedCounts[i]);assert.equal(machine.mode,![1,6].includes(i));assert.equal(machine.panel,![1,6].includes(i));assert.equal(machine.run,null);assert.equal(machine.square,true);
   if(i===5)assert.deepEqual(machine.keys,['X','Y','Z','A','C']);if(i===6)assert.deepEqual(machine.keys,['X','Z']);
   if(i===3)assert.deepEqual(Object.values(machine.groups).sort((a,b)=>a-b),[3,3,9]);
  });
 }
 check('all browser events finish without script errors',()=>assert.deepEqual(summary.browserErrors,[]));
})().catch(error=>summary.failures.push({name:'browser suite execution',message:error.stack||error.message})).finally(async()=>{
 fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify(summary,null,2));
 console.log('BROWSER_SUMMARY:'+JSON.stringify(summary));
 if(browser)await browser.close();if(summary.failures.length)process.exitCode=1;
});

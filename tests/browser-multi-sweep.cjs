'use strict';
// End-to-end Chromium checks against the built single-file page.
// This verifies browser layout and real event handlers, not physical phone gestures.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.DIAL_BASE_URL||'http://127.0.0.1:8765/index.html';
const output='tmp/qa-multi-sweep';
fs.mkdirSync(output,{recursive:true});
const summary={url:base,comparisonCommit:'156a25fecdfd7cb621e47f314aef71fa0c70031d',checks:0,failures:[],browserErrors:[],layouts:[],screenshots:[],physicalPhoneGestures:'not tested'};
let browser,context,p;
function check(name,fn){summary.checks++;try{fn();}catch(error){summary.failures.push({name,message:error.message});}}
function near(a,b,t=1e-8){assert(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,a+' != '+b);}
function valuesNear(a,b,t=1e-8){assert.equal(a.length,b.length);a.forEach((v,i)=>v===null||b[i]===null?assert.equal(v,b[i]):near(v,b[i],t));}
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
 for(const [selector,index] of [['#coarseAdjust',0],['#fineAdjust',0],['#supportMap button',(await p.locator('#supportMap button').count())-1],['#supportMap button',0],['#coarseAdjust',0]]){
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
 p=await context.newPage();p.on('pageerror',e=>summary.browserErrors.push(e.message));
 await p.goto(base,{waitUntil:'networkidle'});
 const sizes=[['pc-1366x900',1366,900],['mobile-320x480',320,480],['mobile-320x568',320,568],['mobile-390x844',390,844],['landscape-568x320',568,320],['landscape-844x390',844,390]];
 for(const [index,kind,count] of [[0,'compact',4],[2,'travel',6],[3,'double',15],[4,'gantry',8],[5,'five',3]]){
  await p.evaluate(index=>{localStorage.clear();openMachine(machines[index]);initializeMachineAccuracy(window.MachineAccuracy.generate('used',78129,['X','Y','Z'],supports.length));positions={X:current.kind==='gantry'?80:0,Y:current.kind==='gantry'?20:0,Z:0,A:0,C:0};supportHeights=supports.map((s,i)=>i===2?.1:0);updateAxisValues();updateLeveling();},index);
  await p.locator('#spindleSweepPanel').waitFor({state:'visible'});await p.evaluate(()=>document.fonts.ready);
  const initial=await assertReadings(kind+' initial');
  for(const [name,width,height] of sizes){
   await p.setViewportSize({width,height});await p.waitForTimeout(150);
   await smallViewportControls(kind+'--'+name);await layout(kind+'--'+name);
   const s=await snapshot();check(kind+' '+name+' layout changes do not change measurements',()=>{assert.deepEqual(s.record,initial.record);valuesNear(s.sweep,initial.sweep);valuesNear(s.pairRaw,initial.pairRaw);});
  }
  await p.setViewportSize({width:390,height:844});await p.waitForTimeout(150);
  const n=await p.locator('#supportMap button').count();check(kind+' support count unchanged',()=>assert.equal(n,count));
  // Scroll the last support fully into the internal selection viewport before tapping.
  const adjustmentIndex=kind==='gantry'?2:kind==='travel'?0:count-1,chosen=p.locator('#supportMap button').nth(adjustmentIndex);await chosen.scrollIntoViewIfNeeded();await chosen.click();
  await p.locator('#coarseAdjust').scrollIntoViewIfNeeded();await p.locator('#coarseAdjust').click();
  const before=await snapshot();await p.locator('#raiseSupport').click();const up=await snapshot();
  check(kind+' support adjustment reaches geometry, level and drawing',()=>{
   near(up.record.heights[adjustmentIndex]-before.record.heights[adjustmentIndex],.01);assert.notDeepEqual(up.bubble,before.bubble);assert.notEqual(up.canvas,before.canvas);
   valuesNear(up.pairRaw,up.pairGeometry);valuesNear(up.sweep,up.geometry);
   // Three supports determine a rigid plane; a five-axis table need not acquire relative error.
   if(kind!=='five'){assert(up.sweep.some((v,i)=>Math.abs(v-before.sweep[i])>1e-6),'dial unchanged');assert(up.pairRaw.some((v,i)=>Math.abs(v-before.pairRaw[i])>1e-6),'squareness unchanged');}
  });
  await p.locator('#lowerSupport').click();const restored=await snapshot();check(kind+' reverse adjustment restores exact state',()=>{assert.deepEqual(restored.record,before.record);valuesNear(restored.sweep,before.sweep);valuesNear(restored.pairRaw,before.pairRaw);});
  await p.locator('#fineAdjust').scrollIntoViewIfNeeded();await p.locator('#fineAdjust').click();await p.locator('#raiseSupport').click();const fine=await snapshot();check(kind+' fine step 0.001 mm',()=>near(fine.record.heights[adjustmentIndex]-before.record.heights[adjustmentIndex],.001));await p.locator('#lowerSupport').click();
  for(let i=0;i<4;i++){await p.locator('#sweepPosition'+i).click();const s=await snapshot();check(kind+' fixed point '+i+' selection',()=>{assert.equal(s.angle,i*90);valuesNear(s.sweep,before.sweep);valuesNear(s.pairRaw,before.pairRaw);});}
  const expectedAxes=kind==='five'?['X','Y','Z','A','C']:['X','Y','Z'];
  for(const key of expectedAxes){await p.locator('#axisTabs button').filter({hasText:key+'軸'}).click();const s=await snapshot();check(kind+' '+key+' selectable',()=>{assert.equal(s.selectedAxis,key);valuesNear(s.sweep,before.sweep);});}
  const stable=await snapshot();await p.locator('#openTrainingMenu').click();await p.locator('#closeTrainingMenu').click();await p.locator('#scene').hover();await p.mouse.wheel(0,-100);
  const box=await p.locator('#scene').boundingBox();await p.mouse.move(box.x+box.width*.3,box.y+box.height*.5);await p.mouse.down();await p.mouse.move(box.x+box.width*.6,box.y+box.height*.5,{steps:4});await p.mouse.up();
  await p.locator('#openTrainingMenu').click();await p.locator('#modelDisplaySettings').evaluate(e=>e.open=true);await p.locator('#exaggerate').uncheck();await p.locator('#closeTrainingMenu').click();
  const viewed=await snapshot();check(kind+' sidebar, camera, exaggeration preserve measurements',()=>{assert.equal(stable.record.exaggerate,true);assert.equal(viewed.record.exaggerate,false);const {exaggerate:beforeExaggerate,...beforePhysics}=stable.record,{exaggerate:afterExaggerate,...afterPhysics}=viewed.record;assert.deepEqual(afterPhysics,beforePhysics);valuesNear(viewed.sweep,stable.sweep);valuesNear(viewed.pairRaw,stable.pairRaw);assert.notEqual(viewed.zoom,stable.zoom);assert.notEqual(viewed.yaw,stable.yaw);});
  await p.locator('#openTrainingMenu').click();await p.locator('.level-storage').evaluate(e=>e.open=true);const downloadPromise=p.waitForEvent('download');await p.locator('#exportLevel').click();const download=await downloadPromise;
  const savedFile=path.join(output,kind+'-saved.json');await download.saveAs(savedFile);const saved=JSON.parse(fs.readFileSync(savedFile,'utf8')),savedValues=await snapshot();
  await p.locator('#closeTrainingMenu').click();await p.locator('#raiseSupport').click();await p.locator('#openTrainingMenu').click();await p.locator('#importLevel').setInputFiles(savedFile);await p.waitForFunction(()=>document.getElementById('levelSaveStatus').textContent.includes('読み込みました'));await p.locator('#closeTrainingMenu').click();
  const loaded=await snapshot();check(kind+' real JSON export/import restores calculation',()=>{assert.deepEqual(loaded.record,saved);valuesNear(loaded.sweep,savedValues.sweep);valuesNear(loaded.pairRaw,savedValues.pairRaw);});
  await p.reload({waitUntil:'networkidle'});await p.evaluate(i=>openMachine(machines[i]),index);const reopened=await snapshot();check(kind+' persistent browser storage restores calculation',()=>{assert.deepEqual(reopened.record,saved);valuesNear(reopened.sweep,savedValues.sweep);});
  // Drive real axis input handlers to inspect travel extrema. Not all large tables need lose contact.
  let offCount=0;
  await p.locator('#openTrainingMenu').click();await p.locator('#axisMenuSection').evaluate(e=>e.open=true);
  for(const key of ['X','Y'])for(const value of [-100,100]){
   await p.locator('#drawerAxisSelect').selectOption(key);await p.locator('#axis-'+key).evaluate((e,v)=>{e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}));},value);
   const s=await snapshot();const readable=s.onTable[0];
   check(kind+' '+key+'='+value+' off-table readings never presented as normal',()=>{for(let i=0;i<4;i++){if(!readable||!s.onTable[i]){assert.equal(s.sweep[i],null);offCount++;}else near(s.sweep[i],s.geometry[i]);}});
  }
  await p.locator('#resetAxes').click();
  if(kind==='gantry'){
   // Support dimensions remain a valid saved-data setting; their old input is
   // intentionally hidden. Exercise this supported range through real JSON import.
   const original=await snapshot();
   await p.locator('.level-storage').evaluate(e=>e.open=true);
   for(const y of [-100,100]){
    const narrow={...original.record,width:.5,axisPositions:{...original.record.axisPositions,Y:y}};
    const narrowFile=path.join(output,'gantry-narrow-'+y+'.json');fs.writeFileSync(narrowFile,JSON.stringify(narrow));
    await p.locator('#importLevel').setInputFiles(narrowFile);
    await p.waitForFunction(expected=>levelConfig.width===.5&&positions.Y===expected,y);
    await p.locator('#closeTrainingMenu').click();
    const narrowState=await snapshot(),labels=await p.locator('.sweep-positions button strong').allTextContents();
    check('gantry narrow valid dimensions Y='+y+' exercises actual off-table suppression',()=>{
     assert(narrowState.onTable.some(v=>!v),'test must actually cross a table edge');
     if(y===-100){assert.equal(narrowState.onTable[0],true);assert.equal(narrowState.onTable[2],false);assert.equal(narrowState.sweep[2],null);assert.equal(labels[2],'面外');}
     else{assert.equal(narrowState.onTable[0],false);assert(narrowState.sweep.every(v=>v===null));assert.equal(labels[0],'面外');}
     for(let i=0;i<4;i++){if(!narrowState.onTable[0]||!narrowState.onTable[i])assert.equal(narrowState.sweep[i],null);else near(narrowState.sweep[i],narrowState.geometry[i]);}
    });
    await screenshot('gantry--off-table-'+y+'-390x844');
    await p.locator('#openTrainingMenu').click();
   }
   const originalFile=path.join(output,'gantry-original-dimensions.json');fs.writeFileSync(originalFile,JSON.stringify(original.record));
   await p.locator('#importLevel').setInputFiles(originalFile);
   await p.waitForFunction(expected=>levelConfig.width===expected.width&&positions.Y===expected.axisPositions.Y,original.record);
   const recovered=await snapshot();check('gantry restoring original dimensions restores calculation state',()=>{assert.deepEqual(recovered.record,original.record);valuesNear(recovered.sweep,original.sweep);valuesNear(recovered.pairRaw,original.pairRaw);});
  }
  if(kind==='five'){
   const neutral=await snapshot();
   await p.locator('#drawerAxisSelect').selectOption('A');await p.locator('#axis-A').evaluate(e=>{e.value='50';e.dispatchEvent(new Event('input',{bubbles:true}));});const tilted=await snapshot();
   check('five A inclination changes actual plane readings',()=>{assert(tilted.geometry.some((v,i)=>Math.abs(v-neutral.geometry[i])>1));for(let i=0;i<4;i++){if(!tilted.onTable[0]||!tilted.onTable[i])assert.equal(tilted.sweep[i],null);else near(tilted.sweep[i],tilted.geometry[i]);}});
   await p.locator('#drawerAxisSelect').selectOption('C');await p.locator('#axis-C').evaluate(e=>{e.value='50';e.dispatchEvent(new Event('input',{bubbles:true}));});const spun=await snapshot();
   check('five C rotates within the A-tilted plane',()=>valuesNear(spun.geometry,tilted.geometry,1e-6));
   await p.locator('#resetAxes').click();
   for(const width of [320,390]){
    await p.setViewportSize({width,height:568});
    for(const [a,c] of [[100,50],[-100,-100]]){
     for(const [key,value] of [['A',a],['C',c]]){await p.locator('#drawerAxisSelect').selectOption(key);await p.locator('#axis-'+key).evaluate((e,v)=>{e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}));},value);}
     await p.locator('#closeTrainingMenu').click();const state=await snapshot();
     const clipped=await p.locator('#spindleSweepPanel button strong').evaluateAll(els=>els.filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent));
     check('five full A/C travel readable at '+width+' '+a+'/'+c,()=>{assert.equal(clipped.length,0,clipped.join(','));for(let i=0;i<4;i++){if(!state.onTable[0]||!state.onTable[i])assert.equal(state.sweep[i],null);else near(state.sweep[i],state.geometry[i]);}});
     await p.locator('#openTrainingMenu').click();
    }
   }
   await p.locator('#resetAxes').click();
  }
  await p.locator('#closeTrainingMenu').click();
  summary.layouts.push({name:kind+' off-table travel checks',offCount});
 }
 for(const index of [1,6]){await p.evaluate(i=>openMachine(machines[i]),index);const s=await p.evaluate(()=>({panel:document.getElementById('spindleSweepPanel').hidden,valid:spindleSweepGeometry().valid,mode:spindleSweepMode,count:supports.length,axes:axisConfig(current).map(a=>a.key)}));check('excluded machine '+index+' has no misleading sweep',()=>{assert.equal(s.panel,true);assert.equal(s.valid,false);assert.equal(s.mode,false);assert.equal(s.count,index===1?8:6);if(index===6)assert.deepEqual(s.axes,['X','Z']);});}
 check('all browser events complete without script errors',()=>assert.deepEqual(summary.browserErrors,[]));
})().catch(error=>summary.failures.push({name:'browser suite execution',message:error.stack||error.message})).finally(async()=>{
 fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify(summary,null,2));console.log('BROWSER_SUMMARY:'+JSON.stringify(summary));if(browser)await browser.close();if(summary.failures.length)process.exitCode=1;
});

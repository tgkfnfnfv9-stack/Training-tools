'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{chromium}=require('playwright'),{PNG}=require('pngjs');
const mode=process.argv[2]||'after',root=path.resolve('docs/qa-lathe-turret-20261009'),out=path.join(root,mode);fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync(mode==='before'?path.join(out,'index.html'):path.resolve('index.html'));
const checks=[],states=[],errors=[];const check=(name,ok,detail)=>checks.push({name,ok,...(detail===undefined?{}:{detail})});
const diff=(a,b)=>{a=PNG.sync.read(a);b=PNG.sync.read(b);if(a.width!==b.width||a.height!==b.height)return -1;let n=0;for(let i=0;i<a.data.length;i+=4)if(a.data[i]!==b.data[i]||a.data[i+1]!==b.data[i+1]||a.data[i+2]!==b.data[i+2])n++;return n;};
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));await p.route('http://lathe.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 const init=async(kind='lathe')=>{await p.goto('http://lathe.test/');await p.evaluate(kind=>{openMachine(machines.find(m=>m.kind===kind));machineProfile=MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length);machineReference=null;machineSavedBest=null;positions={X:0,Y:0,Z:0,A:0,C:0};supportHeights=supports.map(()=>0);selected=0;updateAxisValues();updateLeveling(false);},kind);await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(100);};
 const read=()=>p.evaluate(()=>({kind:current.kind,positions:{...positions},heights:[...supportHeights],numeric:$('liveSquareness').dataset.lathe?JSON.parse($('liveSquareness').dataset.lathe):null,squares:[...document.querySelectorAll('#liveSquareness .live-pair-error-value')].map(e=>({text:e.textContent,value:e.dataset.readingMicrons})),sweep:[0,1,2,3].map(i=>({text:$('sweepValue'+i)?.textContent,value:$('sweepValue'+i)?.dataset.readingMicrons})),first:$('precisionReadouts').innerText,second:$('intrinsicInspectionPage').innerText,page:intrinsicInspectionPage,sceneAria:$('scene').getAttribute('aria-label'),labels:createGeometry(current).labels.map(l=>({name:l.name,axes:l.axes,point:displayedModelPoint(l.p,l.axes,current,positions,l.pose)}))}));
 const snap=async name=>{await p.waitForTimeout(60);const s=await read();states.push({name,...s});await p.screenshot({path:path.join(out,name+'.png')});fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify({checks,states,errors}));return s;};
 const openAxis=async key=>{await p.locator('#axisTabs .axis-tab').filter({hasText:key+'軸'}).click();await p.locator('#openTrainingMenu').click();if(!await p.locator('#axisMenuSection').evaluate(e=>e.open))await p.locator('#axisMenuSection summary').click();};
 const slider=async(key,value)=>{await openAxis(key);await p.locator('#axis-'+key).fill(String(value));await p.locator('#axis-'+key).dispatchEvent('input');await p.locator('#closeTrainingMenu').click();};
 // Six other machines: same individual, support plane and central axes.
 
 await p.goto('http://lathe.test/');const kinds=await p.evaluate(()=>machines.filter(m=>m.kind!=='lathe').map(m=>m.kind));
 for(const width of [390,1280]){await p.setViewportSize({width,height:width===390?844:1000});for(const kind of kinds){await init(kind);await snap(`other-${kind}-${width}-first`);if(await p.locator('#inspectionNext').isVisible()){await p.locator('#inspectionNext').click();await snap(`other-${kind}-${width}-second`);}}}
 for(const width of [320,390,1280]){
  await p.setViewportSize({width,height:width===1280?1000:844});await init();await snap(`lathe-${width}-first`);
  check(`${width} document has no horizontal overflow`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(await p.locator('#inspectionNext').isVisible()){await p.locator('#inspectionNext').click();await snap(`lathe-${width}-second`);check(`${width} left-page button opens second`,await p.evaluate(()=>intrinsicInspectionPage===1));await p.locator('#inspectionPrevious').click();check(`${width} right-page button restores first`,await p.evaluate(()=>intrinsicInspectionPage===0));}
  if(mode==='after'){
   check(`${width} requested first two inspection headings`,await p.locator('#liveSquareness h2').allTextContents().then(x=>x.length===2&&x[0].startsWith('主軸振れ')&&x[1].startsWith('刃物台精度')));
   check(`${width} requested second two inspection headings`,await p.locator('#latheInspectionSecond h2').allTextContents().then(x=>x.join('|')==='主軸と刃物台の穴芯|テスト加工'));
   check(`${width} old squareness small diagram removed`,await p.locator('#liveSquareness .live-squareness-diagram').count()===0);
   const bounds=await p.evaluate(()=>{const v=$('inspectionViewport').getBoundingClientRect();return [...document.querySelectorAll('.lathe-inspection-columns svg text')].map(t=>{const b=t.getBBox();const box=t.ownerSVGElement.viewBox.baseVal;return {text:t.textContent,x:b.x,y:b.y,w:b.width,h:b.height,inside:b.x>=-1&&b.y>=-1&&b.x+b.width<=box.width+1&&b.y+b.height<=box.height+1};});});
   check(`${width} all inspection SVG text inside viewBox`,bounds.every(x=>x.inside),bounds.filter(x=>!x.inside));
  }
 }
 await p.setViewportSize({width:390,height:844});await init();const central=await read();
 for(const key of ['X','Z'])for(const sign of [-100,100]){await init();await slider(key,sign);check(`${key}${sign} actual slider state`,await p.evaluate(({key,sign})=>positions[key]===sign,{key,sign}));await snap(`lathe-${key}${sign}`);}
 for(const X of [-100,100])for(const Z of [-100,100]){await init();await slider('X',X);await slider('Z',Z);await snap(`lathe-combined-X${X}-Z${Z}`);}
 for(const key of ['X','Z']){
  await init();await openAxis(key);await p.locator('#playAxis').click();await p.waitForFunction(key=>positions[key]>75,key);await p.locator('#openTrainingMenu').click();await p.locator('#playAxis').click();await p.locator('#closeTrainingMenu').click();const demo=await snap(`lathe-demo-${key}`);
  if(mode==='after'){const round=Math.round(demo.positions[key]);await slider(key,round);const replay=await read(),limit=(key==='X'?.35:.7)*Math.abs(round-demo.positions[key])/100+1e-9;check(`${key} demo and slider labels follow same assemblies`,demo.labels.every(l=>{const q=replay.labels.find(m=>m.name===l.name);return Math.hypot(...l.point.map((v,i)=>v-q.point[i]))<=limit;}));}
  check(`${key} demo changes selected axis only`,Math.abs(demo.positions[key])>1&&demo.positions[key==='X'?'Z':'X']===0);
  await openAxis(key);await p.locator('#resetAxes').click();await p.locator('#closeTrainingMenu').click();check(`${key} reset brings both axes central`,await p.evaluate(()=>positions.X===0&&positions.Z===0));
 }
 await init();await p.locator('#supportMap .map-point').nth(1).click();const original=await snap('lathe-support-B-start');await p.locator('#raiseSupport').click();const raised=await snap('lathe-support-B-raised');await p.locator('#lowerSupport').click();const restored=await snap('lathe-support-B-restored');
 check('support B raises only selected support by coarse .010',raised.heights.every((h,i)=>Math.abs(h-(i===1?.01:0))<1e-12));
 check('support up/down restores all readings',JSON.stringify([original.numeric,original.squares,original.sweep])===JSON.stringify([restored.numeric,restored.squares,restored.sweep]));
 if(mode==='after'){
  check('support B preserves intrinsic rotation TIR',JSON.stringify(original.numeric.runout)===JSON.stringify(raised.numeric.runout));
  check('support B changes support-dependent readings',JSON.stringify(original.numeric)!==JSON.stringify(raised.numeric));
  check('face X intrinsic stays fixed under support change',Math.abs(original.numeric.face-raised.numeric.face)<1e-6);
 }
 await slider('X',35);await slider('Z',-62);await p.locator('#raiseSupport').click();const exportState=await read();await p.locator('#openTrainingMenu').click();await p.locator('.level-storage summary').click();const downloadPromise=p.waitForEvent('download');await p.locator('#exportLevel').click();const download=await downloadPromise,file=path.join(out,'saved-state.json');await download.saveAs(file);await p.locator('#closeTrainingMenu').click();await slider('X',-100);await p.locator('#lowerSupport').click();await p.locator('#importLevel').setInputFiles(file);await p.waitForFunction(()=>$('levelInputMessage').textContent.includes('読み込みました'));const imported=await snap('lathe-import-restored');
 check('actual download and upload restore state and values',JSON.stringify([exportState.positions,exportState.heights,exportState.numeric,exportState.squares])===JSON.stringify([imported.positions,imported.heights,imported.numeric,imported.squares]));
 if(mode==='after'){
  await init();const viewport=await p.locator('#inspectionViewport').boundingBox(),y=viewport.y+viewport.height/2;
  await p.mouse.move(viewport.x+viewport.width*.85,y);await p.mouse.down();await p.mouse.move(viewport.x+viewport.width*.15,y,{steps:12});await p.mouse.up();await p.waitForTimeout(350);await snap('lathe-mouse-slide-left');check('actual left drag reaches page two',await p.evaluate(()=>intrinsicInspectionPage===1));
  await p.mouse.move(viewport.x+viewport.width*.15,y);await p.mouse.down();await p.mouse.move(viewport.x+viewport.width*.85,y,{steps:12});await p.mouse.up();await p.waitForTimeout(350);await snap('lathe-mouse-slide-right');check('actual right drag reaches page one',await p.evaluate(()=>intrinsicInspectionPage===0));
  await p.locator('#inspectionViewport').focus();await p.keyboard.press('ArrowRight');check('keyboard left slide reaches second',await p.evaluate(()=>intrinsicInspectionPage===1));await p.keyboard.press('ArrowLeft');check('keyboard right slide reaches first',await p.evaluate(()=>intrinsicInspectionPage===0));
  const cdp=await p.context().newCDPSession(p);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:viewport.x+viewport.width*.85,y}]});for(let i=1;i<=10;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:viewport.x+viewport.width*(.85-.07*i),y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(500);await snap('lathe-touch-slide-left');check('Chromium touch left swipe reaches second',await p.evaluate(()=>intrinsicInspectionPage===1));
  await p.locator('#inspectionPrevious').click();await p.waitForTimeout(550);await p.locator('#measurementReferenceToggle').click();await snap('lathe-details');check('existing detail panel explains four inspection families',await p.locator('#measurementReference').isVisible());
 }
 if(mode==='after'){
  for(const key of ['X','Z']){const a=states.find(s=>s.name===`lathe-${key}-100`),b=states.find(s=>s.name===`lathe-${key}100`);const moving=key==='X'?['タレット','Xスライド','工具ホルダ','工具']:['往復台','タレット','Xスライド','工具ホルダ','工具'];const expected=key==='X'?[0,0,.7]:[1.4,0,0];for(const l of a.labels){const q=b.labels.find(v=>v.name===l.name),delta=q.point.map((v,i)=>v-l.point[i]);check(`${key} labelled part ${l.name} correct motion`,delta.every((v,i)=>Math.abs(v-(moving.includes(l.name)?expected[i]:0))<1e-8),delta);}}
  check('turret actual mesh has twelve-sided caps',await p.evaluate(()=>createGeometry(current).faces.filter(f=>f.axes.join(',')==='X,Z'&&f.color==='#4c9b8b'&&f.v.length===12).length===2));
  await init();await p.locator('#supportMap .map-point').nth(1).click();await p.locator('#lowerSupport').click();await snap('lathe-support-B-negative');await p.locator('#raiseSupport').click();await p.locator('#raiseSupport').click();const original=await read();
  for(const view of ['front','side','oblique']){await p.locator('#openTrainingMenu').click();if(!await p.locator('#modelDisplaySettings').evaluate(e=>e.open))await p.locator('#modelDisplaySettings summary').first().click();await p.locator('#sceneView').selectOption(view);await p.locator('#closeTrainingMenu').click();await snap('lathe-view-'+view);check(view+' camera leaves values unchanged',JSON.stringify((await read()).numeric)===JSON.stringify(original.numeric));}
  const box=await p.locator('#scene').boundingBox();await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.wheel(0,-220);await p.waitForTimeout(100);check('wheel zoom leaves values unchanged',JSON.stringify((await read()).numeric)===JSON.stringify(original.numeric));
  await p.locator('#openTrainingMenu').click();await p.locator('#exaggerate').uncheck();await p.locator('#showIdealOutline').uncheck();await p.locator('#closeTrainingMenu').click();await snap('lathe-exaggeration-off');check('display exaggeration and ideal outline leave values unchanged',JSON.stringify((await read()).numeric)===JSON.stringify(original.numeric));
 }
 if(mode==='after'){
  const before=JSON.parse(fs.readFileSync(path.join(root,'before/results.json')));
  for(const s of states.filter(s=>s.kind!=='lathe')){const old=before.states.find(t=>t.name===s.name);check(s.name+' state unchanged',JSON.stringify(s)===JSON.stringify(old));const pixels=diff(fs.readFileSync(path.join(root,'before',s.name+'.png')),fs.readFileSync(path.join(out,s.name+'.png')));check(s.name+' pixels unchanged',pixels===0,pixels);}
 }
 check('no browser exceptions',errors.length===0,errors);
 const result={mode,sha256:crypto.createHash('sha256').update(html).digest('hex'),checks,states,errors,environment:'Chromium Linux; touch emulation, not actual iPhone Safari'};fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));await browser.close();console.log(JSON.stringify({checks:checks.length,failed:checks.filter(c=>!c.ok),sha256:result.sha256}));process.exitCode=checks.some(c=>!c.ok)?1:0;
})().catch(e=>{console.error(e);process.exit(1);});

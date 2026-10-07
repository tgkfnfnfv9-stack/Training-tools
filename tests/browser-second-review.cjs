'use strict';
// Fresh browser audit of settings-open views, all finite contact diagrams, and
// real demo motion. Physical display directions are independently enumerated.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const input=path.resolve(process.argv[2]||'index.html'),label=process.argv[3]||'after';
const out=path.resolve('docs/qa-twist-second-review-20261007',label);fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync(input),checks=[],snapshots=[],errors=[];
const check=(name,ok,detail)=>checks.push({name,ok,...(detail===undefined?{}:{detail})});
const axes={vertical:{X:'右',Y:'奥',Z:'上'},horizontal:{X:'右',Y:'上',Z:'奥'},travel:{X:'右',Y:'奥',Z:'上'},gate:{X:'奥',Y:'右',Z:'上'},gantry:{X:'奥',Y:'右',Z:'上'},five:{X:'右',Y:'奥',Z:'上'},lathe:{X:'奥',Z:'右'}};
const opposite={右:'左',奥:'手前',上:'下'};
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const p=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});
 p.on('pageerror',e=>errors.push(e.message));await p.route('http://localhost:8765/**',r=>r.fulfill({contentType:'text/html',body:html}));await p.goto('http://localhost:8765/');
 const values=()=>p.evaluate(()=>({scan:levelGeometry.pairs.map(p=>referenceScan(p)),sweep:supportsSpindleSweep()?spindleSweepGeometry():null}));
 for(const id of Object.keys(axes)){
  await p.evaluate(id=>{localStorage.clear();openMachine(machines.find(m=>m.id===id));machineProfile=null;machineReference=null;machineSavedBest=null;supportHeights=supports.map(s=>.12*(s.x/(current.w*.4))*(s.z/(current.d*.4)));positions={X:-53,Y:41,Z:27,A:0,C:0};updateLeveling(false);},id);
  const baseline=await values();
  for(const [width,height] of [[1280,900],[320,568]]){
   await p.setViewportSize({width,height});await p.evaluate(()=>setTrainingMenuOpen(false));
   const diagrams=await p.evaluate(()=>[...document.querySelectorAll('#liveSquareness svg')].map(e=>({pair:e.dataset.pair,right:e.dataset.viewRight,up:e.dataset.viewUp,relative:e.dataset.relativeDirection,zeroLocation:e.dataset.zeroLocationMeasurement,zero:+e.querySelector('.scan-zero').getAttribute('cy'),contact:+e.querySelector('.scan-contact').getAttribute('cy'),move:e.querySelector('.scan-move').getAttribute('d'),normal:+e.querySelector('.scan-geometry').dataset.bodyNormalM,probeNormal:+e.querySelector('.scan-geometry').dataset.probeNormal,probeAlong:+e.querySelector('.scan-geometry').dataset.probeAlong,reading:e.dataset.readingMicrons,oldLocalShapes:e.querySelectorAll('.pair-plane,.measurement-origin,.pair-current').length,text:[...e.querySelectorAll('text')].map(t=>{const b=t.getBBox();return {text:t.textContent,x:b.x,y:b.y,right:b.x+b.width,bottom:b.y+b.height};})})));
   snapshots.push({id,width,height,diagrams});
   for(const d of diagrams){
    const base=id==='lathe'?'Z':d.pair[0],scan=id==='lathe'?'X':d.pair[1],down=d.pair!=='XY';
    check(`${id}/${width}/${d.pair} physical face projection and zero direction`,d.right===axes[id][base]&&d.up===axes[id][scan]&&d.relative===(down?opposite[axes[id][scan]]:axes[id][scan])&&d.zero===(down?14:31));
    check(`${id}/${width}/${d.pair} diagram labels inside viewBox`,d.text.every(t=>t.x>=0&&t.y>=-.1&&t.right<=64&&t.bottom<=45),d.text.filter(t=>t.x<0||t.y<-.1||t.right>64||t.bottom>45));
    check(`${id}/${width}/${d.pair} no old local angle paths in finite diagram`,d.oldLocalShapes===0);
   }
   await p.locator('#openTrainingMenu').click();await p.waitForTimeout(70);
   const box=await p.evaluate(()=>{const b=$('scene').getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height,w:innerWidth,h:innerHeight,inert:$('trainingMain').inert};});
   check(`${id}/${width} settings retains model within viewport and blocks background`,box.width>50&&box.height>50&&box.x>=0&&box.right<=box.w+1&&box.y>=0&&box.bottom<=box.h+1&&box.inert,box);
   check(`${id}/${width} settings scaling preserves physical measurements`,JSON.stringify(baseline)===JSON.stringify(await values()));
   await p.screenshot({path:path.join(out,`${id}-${width}-settings.png`)});
   await p.locator('#closeTrainingMenu').click();
   check(`${id}/${width} closing settings preserves physical measurements`,JSON.stringify(baseline)===JSON.stringify(await values()));
  }
  await p.setViewportSize({width:1280,height:900});await p.locator('#liveSquareness').screenshot({path:path.join(out,`${id}-live.png`)});
  // Real animation: changed position must drive current endpoint contact values.
  await p.evaluate(()=>{selectAxis(current.kind==='lathe'?'Z':current.kind==='horizontal'?'Z':'Y');$('playAxis').click();});
  await p.waitForTimeout(450);const motion=await p.evaluate(()=>({running:motionFrame!==null,position:positions[selectedAxis],rendered:[...document.querySelectorAll('#liveSquareness svg')].map(e=>e.dataset.readingMicrons),computed:levelGeometry.pairs.map(p=>{const m=referenceScan(p);return m.valid?String(m.microns):'';})}));
  check(`${id} running demo refreshes contact readings`,motion.running&&Math.abs(motion.position)>1&&JSON.stringify(motion.rendered)===JSON.stringify(motion.computed),motion);await p.evaluate(()=>stopMotion());
 }
 // Evidence of contradictory explanatory text, readable through actual menus.
 await p.evaluate(()=>{openMachine(machines.find(m=>m.id==='lathe'));machineProfile=null;machineReference=null;machineSavedBest=null;supportHeights=supports.map(()=>0);updateLeveling(false);setTrainingMenuOpen(true);document.querySelector('.lesson-menu').open=true;});
 await p.locator('.lesson-menu > .ui-notice').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(out,'lathe-lesson-path-wording.png')});
 const help=await p.locator('.lesson-menu > .ui-notice').innerText();check('path legend distinguishes endpoint connector from a continuous trajectory',!help.includes('計器本体の相対経路')&&/始終|始点.*終点/.test(help),help);
 await p.evaluate(()=>{setTrainingMenuOpen(false);toggleMeasurementReference(true);});await p.locator('#measurementReference > .reference-intro').first().scrollIntoViewIfNeeded();await p.screenshot({path:path.join(out,'lathe-reference-intro.png')});
 const intro=await p.locator('#measurementReference > .reference-intro').first().innerText();check('common finite introduction accounts for lathe flange',intro.includes('フランジ'),intro);
 await p.evaluate(()=>{toggleMeasurementReference(false);openMachine(machines.find(m=>m.id==='gate'));machineProfile=null;machineReference=null;machineSavedBest=null;supportHeights=supports.map(()=>0);updateLeveling(false);setTrainingMenuOpen(true);$('modelDisplaySettings').open=true;document.querySelector('.viewer-help').open=true;});await p.locator('.viewer-help .viewer-caption').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(out,'gate-model-description.png')});
 const caption=await p.locator('.viewer-help .viewer-caption').innerText();check('gate spindle intrinsic posture is included in viewer explanation',/(ラム・主軸は固有直角差|固有直角差は.{0,30}(ラム|主軸))/.test(caption),caption);
 check('no browser exceptions',errors.length===0,errors);
 const result={input,sha256:crypto.createHash('sha256').update(html).digest('hex'),label,browser:browser.version(),checks,snapshots,errors};fs.writeFileSync(path.join(out,'browser-second-review.json'),JSON.stringify(result,null,2));await browser.close();console.log(JSON.stringify({label,checks:checks.length,passed:checks.filter(c=>c.ok).length,failed:checks.filter(c=>!c.ok),out},null,2));process.exitCode=checks.some(c=>!c.ok)?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});

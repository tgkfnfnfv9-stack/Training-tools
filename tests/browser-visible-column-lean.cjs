'use strict';
// Independent visual audit: h=b*z has floor-normal (0,1,-b/1000),
// so a column parallel to that normal leans forward by atan(b/1000).
// Read actual mesh endpoints separately from the new enlarged diagram.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const input=path.resolve(process.argv[2]||'index.html'),phase=process.argv[3]||'after';
const out=path.resolve('docs/qa-visible-column-lean-20261007','browser-'+phase);fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync(input),checks=[],states=[],errors=[];
const check=(name,ok,detail)=>checks.push({name,ok,...(detail===undefined?{}:{detail})});
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://localhost:8765/**',r=>r.fulfill({contentType:'text/html',body:html}));await page.goto('http://localhost:8765/');
 const setup=async(slope,a=null,intrinsic=false)=>page.evaluate(({slope,a,intrinsic})=>{
  stopMotion();openMachine(machines[0]);machineProfile=intrinsic?{squareness:{XY:{microns:33},XZ:{microns:75},YZ:{microns:-15}},guides:{},initialHeights:supports.map(()=>0)}:null;
  machineReference=null;machineSavedBest=null;positions={X:0,Y:0,Z:0,A:0,C:0};supportHeights=supports.map((s,i)=>a===null?slope*levelCoordinates(s.x,s.z).z:i===0?a:0);$('exaggerate').checked=true;updateLeveling(false);setSceneView('side');selectAxis('Z');selectSupport(0);
 },{slope,a,intrinsic});
 const snapshot=async()=>page.evaluate(()=>{
  const model=createGeometry(current),r=model.references.find(r=>r.pose==='tool'),base=displayedModelPoint(r.base,r.axes,current,positions,r.pose),tip=displayedModelPoint(r.tip,r.axes,current,positions,r.pose),d=tip.map((v,i)=>v-base[i]);
  const panel=document.querySelector('#columnLeanInset'),shape=document.querySelector('#columnLeanInsetColumn');
  return {heights:[...supportHeights],column:[base,tip],columnFront:Math.atan2(-d[2],d[1]),readings:levelGeometry.pairs.map(p=>referenceScan(p).microns),record:levelRecord(),inset:panel?{hidden:panel.hidden,transform:shape?.getAttribute('transform'),shapeTop:(()=>{if(!shape)return null;const m=shape.getCTM(),svg=shape.ownerSVGElement,p=svg.createSVGPoint();p.x=70;p.y=10;const top=p.matrixTransform(m);p.y=65;const foot=p.matrixTransform(m);return {x:top.x-foot.x,y:top.y-foot.y};})(),svg:document.querySelector('#columnLeanInsetDiagram')?.outerHTML,html:panel.innerHTML,text:panel.textContent,data:{...panel.dataset},bounds:(()=>{const r=panel.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};})()}:null};
 });
 for(const [width,height] of [[1280,900],[390,844]]){
  await page.setViewportSize({width,height});const tilts=[];
  for(const [name,slope] of [['front',.4],['upright',0],['back',-.4]]){
   await setup(slope);const s=await snapshot();tilts.push(s);states.push({name,width,...s});
   check(`${width}/${name}: actual column agrees with independent plane normal`,Math.abs(s.columnFront-Math.atan(slope/1000))<1e-11,{actual:s.columnFront,expected:Math.atan(slope/1000)});
   check(`${width}/${name}: common rigid tilt keeps all squareness readings zero`,s.readings.every(v=>Math.abs(v)<1e-6),s.readings);
   if(phase!=='before'){
    const d=s.inset?.data,display=d?Number(d.displayAngleDegrees):NaN;
    check(`${width}/${name}: enlarged diagram derives from actual column angle`,d&&Math.abs(Number(d.frontMicroradians)-s.columnFront*1e6)<1e-5,d);
    check(`${width}/${name}: fixed 2000x diagram angle matches actual column`,Math.abs(display-s.columnFront*2000*180/Math.PI)<1e-6,{display,physical:s.columnFront});
    check(`${width}/${name}: diagram and physical directions agree`,s.inset&&Math.sign(display)===Math.sign(s.columnFront));
    check(`${width}/${name}: actual transformed SVG column top goes toward front-left/back-right`,s.inset&&Math.abs(s.columnFront)<1e-12?Math.abs(s.inset.shapeTop.x)<1e-9:s.inset&&Math.sign(s.inset.shapeTop.x)===-Math.sign(s.columnFront),s.inset?.shapeTop);
    check(`${width}/${name}: inset visible and within viewport width`,s.inset&&!s.inset.hidden&&s.inset.bounds.width>0&&s.inset.bounds.x>=0&&s.inset.bounds.x+s.inset.bounds.width<=width+.5,s.inset?.bounds);
   }
   await page.screenshot({path:path.join(out,`compact-${width}-${name}.png`)});
  }
  check(`${width}: forward/upright/back mesh signs`,tilts[0].columnFront>0&&Math.abs(tilts[1].columnFront)<1e-12&&tilts[2].columnFront<0);
 }
 for(const a of [-.5,0,.5]){await setup(0,a,true);const s=await snapshot();states.push({name:'support-A',a,...s});}
 // Real controls: coarse and fine keep support amounts. We also capture diagram
 // change and check it against physical column motion, never a production sign table.
 for(const [name,step] of [['coarse',.01],['fine',.001]]){
  await setup(0,0,false);await page.locator(name==='coarse'?'#coarseAdjust':'#fineAdjust').click();const before=await snapshot();
  await page.locator('#raiseSupport').click();const after=await snapshot();states.push({name,step,before,after});
  check(`${name}: real support button changes A by requested amount`,Math.abs(after.heights[0]-before.heights[0]-step)<1e-12);
  check(`${name}: actual column moves`,Math.abs(after.columnFront-before.columnFront)>1e-9);
  if(phase!=='before')check(`${name}: enlarged diagram updates immediately`,before.inset&&after.inset&&before.inset.html!==after.inset.html);
 }
 await setup(0,-.5,true);const fixed=await snapshot();
 for(const key of ['X','Y','Z']){
  await page.evaluate(key=>{positions[key]=78;updateLeveling(false);},key);const moved=await snapshot();
  check(`${key}: fixed physical column unchanged by linear feed`,JSON.stringify(moved.column)===JSON.stringify(fixed.column));
  if(phase!=='before')check(`${key}: enlarged fixed-column diagram unchanged by linear feed`,moved.inset&&fixed.inset&&moved.inset.html===fixed.inset.html);
 }
 const beforeDisplay=await snapshot();for(const action of ['camera','zoom','labels','emphasis']){
  await page.evaluate(action=>{if(action==='camera')rotate(.7);if(action==='zoom')setSceneZoom(1.18);if(action==='labels')$('labels').checked=!$('labels').checked;if(action==='emphasis')$('exaggerate').checked=!$('exaggerate').checked;drawScene();},action);
  const after=await snapshot();check(`${action}: display action preserves finite measurements`,JSON.stringify(after.readings)===JSON.stringify(beforeDisplay.readings));
 }
 // JSON public record and restore: independent of newly introduced presentation.
 await page.evaluate(()=>{openMachine(machines[0]);machineReference=null;machineSavedBest=null;supportHeights=[.123,0,0,0];updateLeveling(false);});const saved=await snapshot();const round=await page.evaluate(()=>{const r=JSON.parse(JSON.stringify(levelRecord()));const valid=validLevelRecord(r);supportHeights=supports.map(()=>0);updateLeveling(false);applyLevelRecord(r);updateLeveling(false);return{valid,record:levelRecord()};});const restored=await snapshot();
 check('saved record remains accepted',round.valid);check('save/restore preserves public record',JSON.stringify(round.record)===JSON.stringify(saved.record));check('save/restore preserves readings and column',JSON.stringify(restored.readings)===JSON.stringify(saved.readings)&&JSON.stringify(restored.column)===JSON.stringify(saved.column));
 if(phase!=='before')check('save/restore reproduces enlarged column diagram',restored.inset&&saved.inset&&restored.inset.html===saved.inset.html);

 if(phase!=='before'){
  await page.setViewportSize({width:320,height:568});await setup(.4);
  const boxes=await page.evaluate(()=>Object.fromEntries(['scene','columnLeanInset','raiseSupport','lowerSupport'].map(id=>{const e=$(id),r=e.getBoundingClientRect();return[id,{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}];})));
  check('320x568: enlarged diagram and physical canvas do not overlap',boxes.columnLeanInset.bottom<=boxes.scene.y+.5,boxes);
  check('320x568: physical canvas retains usable height',boxes.scene.height>=100,boxes.scene);
  check('320x568: both support buttons stay onscreen',boxes.raiseSupport.bottom<=568.5&&boxes.lowerSupport.bottom<=568.5,boxes);
  await page.screenshot({path:path.join(out,'compact-320-front.png')});
  for(const height of [568,480]){
   await page.setViewportSize({width:320,height});
   const targets=await page.locator('#supportMap button').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),points=[[r.x+r.width/2,r.y+3],[r.x+r.width/2,r.bottom-3],[r.x+r.width/2,r.y+r.height/2]];return {text:e.textContent,height:r.height,bottom:r.bottom,reachable:points.every(([x,y])=>e.contains(document.elementFromPoint(x,y)))};}));
   check(`320x${height}: entire support selection button remains reachable`,targets.every(q=>q.height>=44&&q.bottom<=height&&q.reachable),targets);
   await page.screenshot({path:path.join(out,`compact-320-${height}-controls.png`)});
  }
  await page.setViewportSize({width:320,height:568});

  await page.evaluate(()=>{supportHeights=supports.map(s=>s.z>0?.5:-.5);levelConfig.depth=.5;updateLeveling(false);});const clipped=await snapshot();
  check('extreme dimension: clipped enlarged diagram is explicitly labelled',clipped.inset?.data.rangeExceeded==='true'&&clipped.inset.text.includes('図の範囲外')&&Math.abs(Number(clipped.inset.data.displayAngleDegrees))===65,clipped.inset?.data);
  for(const id of ['horizontal','travel','gate','gantry','five','lathe']){
   await page.evaluate(id=>openMachine(machines.find(m=>m.id===id)),id);
   const hidden=await page.evaluate(()=>$('columnLeanInset').hidden&&$('columnLeanInset').getBoundingClientRect().height===0);
   check(`${id}: compact-only diagram takes no space`,hidden);
  }
  const previous=JSON.parse(fs.readFileSync(path.resolve('docs/qa-visible-column-lean-20261007/browser-before/results.json')));
  for(let i=0;i<states.length;i++){
   const extract=s=>s.before?{before:extract(s.before),after:extract(s.after)}:{heights:s.heights,column:s.column,readings:s.readings,record:s.record};
   check(`before/after ${i}: support state, mesh, measurements and saved record unchanged`,JSON.stringify(extract(states[i]))===JSON.stringify(extract(previous.states[i])));
  }
 }
 check('no browser exceptions',errors.length===0,errors);
 const result={input,phase,sha256:crypto.createHash('sha256').update(html).digest('hex'),browser:browser.version(),checks,states,errors};fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));await browser.close();console.log(JSON.stringify({phase,total:checks.length,passed:checks.filter(c=>c.ok).length,failed:checks.filter(c=>!c.ok)},null,2));process.exitCode=checks.some(c=>!c.ok)?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});

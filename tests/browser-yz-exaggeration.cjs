'use strict';
// Read browser-rendered material points and mesh vertices. Independent expectation:
// at the documented upper-back contact, a downward scan has sign(unit Y dot unit Z).
// This audits the teaching illustration; it is not an elasticity validation.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const input=path.resolve(process.argv[2]||'index.html'),label=process.argv[3]||'after';
const out=path.resolve('docs/qa-yz-sign-20261007','browser-'+label);fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync(input),checks=[],rows=[],errors=[];const check=(name,ok,detail)=>checks.push({name,ok,detail});
(async()=>{
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:1280,height:900}});p.on('pageerror',e=>errors.push(e.message));await p.route('http://localhost:8765/**',r=>r.fulfill({contentType:'text/html',body:html}));await p.goto('http://localhost:8765/');
await p.evaluate(()=>{localStorage.clear();openMachine(machines[0]);positions={X:0,Y:0,Z:0,A:0,C:0};setSceneView('side');});
const setup=async(a,yz)=>p.evaluate(({a,yz})=>{stopMotion();positions={X:0,Y:0,Z:0,A:0,C:0};machineProfile={guides:{},initialHeights:supports.map(()=>0),squareness:{XY:{microns:33},XZ:{microns:75},YZ:{microns:yz}}};machineReference=null;machineSavedBest=null;supportHeights=[a,0,0,0];$('exaggerate').checked=true;updateLeveling(false);}, {a,yz});
const sample=async(exaggerate)=>p.evaluate(exaggerate=>{
$('exaggerate').checked=exaggerate;updateLeveling(false);
const unit=v=>{const n=Math.hypot(...v);return v.map(q=>q/n)},sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),model=createGeometry(current),ref=model.references.find(r=>r.pose==='tool');
const base=displayedModelPoint(ref.base,ref.axes,current,positions,ref.pose),tip=displayedModelPoint(ref.tip,ref.axes,current,positions,ref.pose),z=unit(sub(tip,base));
const lo=compactTablePathPoint({...positions,Y:positions.Y-.001},levelSolution,machineProfile,displayFactor()),hi=compactTablePathPoint({...positions,Y:positions.Y+.001},levelSolution,machineProfile,displayFactor()),y=unit(sub(hi,lo));
const ai=axisIndicators(current,model).find(a=>a.key==='Z'),origin=ai.points[0].map((v,i)=>(v+ai.points[1][i])/2),ar=ai.points.map(q=>levelAxisVisualPoint(q,origin,ai.pose,ai.bodyOrigin,ai.key)),arrow=unit(sub(ar[1],ar[0]));
return {factor:displayFactor(),yzDot:dot(y,z),column:z,tableY:y,zArrowDot:dot(z,arrow),readings:levelGeometry.pairs.map(pair=>referenceScan(pair).microns),labels:[...document.querySelectorAll('#liveSquareness svg')].map(e=>({pair:e.dataset.pair,reading:Number(e.dataset.readingMicrons)}))};
},exaggerate);
for(const yz of [-15,0,15]){
let prev;
for(const a of [-.5,-.1,0,.1,.5]){
await setup(a,yz);const physical=await sample(false),visual=await sample(true);rows.push({yz,a,physical,visual});
check(`YZ ${yz} A ${a}: exaggerated mesh angle sign`,Math.abs(physical.yzDot)<1e-8||Math.sign(physical.yzDot)===Math.sign(visual.yzDot),{physical:physical.yzDot,visual:visual.yzDot});
check(`YZ ${yz} A ${a}: exaggeration preserves measurement`,JSON.stringify(physical.readings)===JSON.stringify(visual.readings));
check(`YZ ${yz} A ${a}: Z arrow parallel to column mesh`,visual.zArrowDot>1-1e-10,visual.zArrowDot);
check(`YZ ${yz} A ${a}: displayed numbers equal finite readings`,visual.labels.every((q,i)=>q.reading===visual.readings[i]));
if(prev)check(`YZ ${yz} A ${prev.a} to ${a}: visible adjustment direction`,Math.sign(visual.yzDot-prev.visual.yzDot)===Math.sign(physical.yzDot-prev.physical.yzDot));prev={a,physical,visual};
}}
for(const [width,height] of [[1280,900],[390,844]]){
await p.setViewportSize({width,height});for(const a of [-.5,0,.5]){await setup(a,-15);await p.evaluate(()=>{setSceneView('side');selectAxis('Z');selectSupport(0);});await p.screenshot({path:path.join(out,`vertical-side-${width}-A${a}.png`)});}
await p.locator('#supportMap button[data-support="2"]').click();check(`${width}: support selection retained`,await p.evaluate(()=>selected===2&&document.querySelector('#supportMap button[data-support="2"]').getAttribute('aria-pressed')==='true'));
}
await setup(-.5,-15);const unchanged=(await sample(true)).readings;
for(const change of ['camera','zoom','outline','labels','exaggeration']){
await p.evaluate(change=>{if(change==='camera')rotate(.9);if(change==='zoom')setSceneZoom(1.15);if(change==='outline')$('showIdealOutline').checked=!$('showIdealOutline').checked;if(change==='labels')$('labels').checked=!$('labels').checked;if(change==='exaggeration')$('exaggerate').checked=false;drawScene();},change);
check(`${change}: finite values invariant`,JSON.stringify(unchanged)===JSON.stringify(await p.evaluate(()=>levelGeometry.pairs.map(pair=>referenceScan(pair).microns))));}
await setup(-.5,-15);
for(const key of ['X','Y','Z']){
await p.evaluate(key=>{positions={X:0,Y:0,Z:0,A:0,C:0};selectAxis(key);$('playAxis').click();},key);await p.waitForTimeout(220);
const first=await p.evaluate(()=>{const model=createGeometry(current),f=model.faces.find(f=>f.axes.includes(selectedAxis)),r=model.references.find(r=>r.pose==='tool');return {position:positions[selectedAxis],running:motionFrame!==null,point:displayedModelPoint([0,1.8,0],['Z'],current,positions,'tool'),moving:displayedModelPoint(f.v[0],f.axes,current,positions,f.pose),column:[displayedModelPoint(r.base,r.axes,current,positions,r.pose),displayedModelPoint(r.tip,r.axes,current,positions,r.pose)]};});await p.waitForTimeout(180);
const second=await p.evaluate(()=>{const model=createGeometry(current),f=model.faces.find(f=>f.axes.includes(selectedAxis)),r=model.references.find(r=>r.pose==='tool');return {position:positions[selectedAxis],point:displayedModelPoint([0,1.8,0],['Z'],current,positions,'tool'),moving:displayedModelPoint(f.v[0],f.axes,current,positions,f.pose),column:[displayedModelPoint(r.base,r.axes,current,positions,r.pose),displayedModelPoint(r.tip,r.axes,current,positions,r.pose)],values:[...document.querySelectorAll('#liveSquareness svg')].map(e=>Number(e.dataset.readingMicrons)),expected:levelGeometry.pairs.map(pair=>referenceScan(pair).microns)};});await p.evaluate(()=>stopMotion());
check(`${key}: live demo changes axis position and updates finite values`,first.running&&Math.abs(second.position-first.position)>1&&JSON.stringify(second.values)===JSON.stringify(second.expected));
check(`${key}: actual moving part moves`,Math.hypot(...second.moving.map((v,i)=>v-first.moving[i]))>1e-5);
check(`${key}: fixed column vertices remain fixed during demo`,Math.max(...second.column.flat().map((v,i)=>Math.abs(v-first.column.flat()[i])))<1e-10);
if(key==='Z'){const geometry=await sample(true),d=second.point.map((v,i)=>v-first.point[i]),cos=d.reduce((s,v,i)=>s+v*geometry.column[i],0)/Math.hypot(...d);check('Z demo: actual tool material displacement parallel to column',cos>1-1e-9,cos);}
}
if(label!=='before'){
await setup(-.5,-15);await p.evaluate(()=>{setSceneView('side');sceneZoom=1;});
const displayState=async(flag)=>p.evaluate(flag=>{$('exaggerate').checked=flag;updateLeveling(false);const model=createGeometry(current);return {factor:displayFactor(),vertices:model.faces.flatMap(f=>f.v.map(q=>displayedModelPoint(q,f.axes,current,positions,f.pose))),finiteShapes:[...document.querySelectorAll('#liveSquareness .scan-body')].map(e=>[e.getAttribute('x'),e.getAttribute('y'),e.getAttribute('transform')]),localShapes:$('accuracyDiagram').innerHTML,values:levelGeometry.pairs.map(pair=>referenceScan(pair).microns),label:$('exaggerate').closest('label').innerText};},flag);
const on=await displayState(true);await p.screenshot({path:path.join(out,'compact-diagram-emphasis-on.png')});const off=await displayState(false);await p.screenshot({path:path.join(out,'compact-diagram-emphasis-off.png')});
check('compact: checkbox label describes diagram emphasis',on.label.includes('直角図'),on.label);
check('compact: diagram emphasis never changes 3D vertex geometry',on.factor===1&&off.factor===1&&JSON.stringify(on.vertices)===JSON.stringify(off.vertices));
check('compact: emphasis changes finite contact drawing',JSON.stringify(on.finiteShapes)!==JSON.stringify(off.finiteShapes));
check('compact: emphasis changes local angle drawing',on.localShapes!==off.localShapes);
check('compact: emphasis never changes numeric readings',JSON.stringify(on.values)===JSON.stringify(off.values));
await p.evaluate(()=>{setTrainingMenuOpen(true);$('modelDisplaySettings').open=true;});await p.locator('#exaggerateLabel').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(out,'compact-display-settings.png')});await p.evaluate(()=>setTrainingMenuOpen(false));
for(const id of ['horizontal','travel','gate','gantry','five','lathe']){
await p.evaluate(id=>{openMachine(machines.find(m=>m.id===id));machineProfile=null;supportHeights=supports.map((s,i)=>i%2?.08:-.08);updateLeveling(false);},id);
const enabled=await displayState(true),disabled=await displayState(false);
check(`${id}: existing model exaggeration remains available`,enabled.factor>1&&disabled.factor===1&&!enabled.label.includes('直角図'),{factor:enabled.factor,label:enabled.label});
check(`${id}: exaggeration keeps finite values unchanged`,JSON.stringify(enabled.values)===JSON.stringify(disabled.values));
}
}
check('no browser exceptions',errors.length===0,errors);
const result={input,label,sha256:crypto.createHash('sha256').update(html).digest('hex'),browser:b.version(),checks,rows,errors};fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));await b.close();console.log(JSON.stringify({label,total:checks.length,passed:checks.filter(c=>c.ok).length,failed:checks.filter(c=>!c.ok)},null,2));process.exitCode=checks.some(c=>!c.ok)?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});

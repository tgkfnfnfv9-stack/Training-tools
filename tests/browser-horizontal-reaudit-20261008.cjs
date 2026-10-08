'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{chromium}=require('playwright'),{PNG}=require('pngjs');
const mode=process.argv[2]||'before',root=path.resolve('docs/qa-horizontal-reaudit-20261008'),out=path.join(root,mode);fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync(mode==='before'?path.join(out,'index.html'):path.resolve('index.html'));
const checks=[],states=[],errors=[];const check=(name,ok,detail)=>checks.push({name,ok,detail});
function pixelDiff(a,b){const x=PNG.sync.read(a),y=PNG.sync.read(b);if(x.width!==y.width||x.height!==y.height)return -1;let n=0;for(let i=0;i<x.data.length;i+=4)if(x.data[i]!==y.data[i]||x.data[i+1]!==y.data[i+1]||x.data[i+2]!==y.data[i+2])n++;return n;}
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const p=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));await p.route('http://localhost:8765/**',r=>r.fulfill({contentType:'text/html',body:html}));
const init=async(i=1)=>{await p.goto('http://localhost:8765/');await p.evaluate(i=>{openMachine(machines[i]);machineProfile=MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length);machineReference=null;machineSavedBest=null;positions={X:0,Y:0,Z:0,A:0,C:0};supportHeights=supports.map(()=>0);selected=0;updateLeveling(false);},i);await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(100);};
const read=()=>p.evaluate(()=>({kind:current.kind,positions:{...positions},heights:[...supportHeights],squares:[...document.querySelectorAll('#liveSquareness .live-pair-error-value')].map(e=>({text:e.textContent,value:e.dataset.readingMicrons})),parallel:[0,1].map(i=>({text:$('sweepValue'+i).textContent,value:$('sweepValue'+i).dataset.readingMicrons})),intrinsic:$('intrinsicInspectionPage').innerText,labels:createGeometry(current).labels.map(l=>({...l})),setups:levelGeometry.pairs.map(p=>referenceSetup(p)),sceneAria:$('scene').getAttribute('aria-label')}));
const snap=async(name)=>{const state=await read();states.push({name,...state});await p.screenshot({path:path.join(out,name+'.png')});return state;};
for(const width of [390,1280]){await p.setViewportSize({width,height:width===390?844:1000});for(const i of [0,1,2,3,4,5,6]){await init(i);await p.evaluate(()=>{supportHeights=supports.map((s,k)=>k%2?.03:-.02);updateLeveling(false);});await snap(`machine-${i}-${width}`);if(await p.locator('#inspectionNext').isVisible())await p.locator('#inspectionNext').click();await p.waitForTimeout(100);await snap(`intrinsic-${i}-${width}`);}}
await p.setViewportSize({width:390,height:844});await init();await snap('horizontal-flat');
for(const key of ['X','Y','Z'])for(const sign of [-100,100]){await init();await p.locator('#openTrainingMenu').click();await p.locator('#axisMenuSection summary').click();await p.locator('#drawerAxisSelect').selectOption(key);await p.locator('#axis-'+key).fill(String(sign));await p.locator('#axis-'+key).dispatchEvent('input');await p.locator('#closeTrainingMenu').click();check(`${key}${sign} real slider`,await p.evaluate(({key,sign})=>positions[key]===sign,{key,sign}));await snap('motion-'+key+'-'+sign);}
for(const key of ['X','Y','Z'])for(const sign of [-100,100]){await init();await p.evaluate(()=>{supportHeights=supports.map(s=>.05*s.x*s.z);updateLeveling(false);});await p.locator('#openTrainingMenu').click();await p.locator('#axisMenuSection summary').click();await p.locator('#drawerAxisSelect').selectOption(key);await p.locator('#axis-'+key).fill(String(sign));await p.locator('#axis-'+key).dispatchEvent('input');await p.locator('#closeTrainingMenu').click();await snap('twist-motion-'+key+'-'+sign);}
for(const posture of ['flat','plane','twist-positive','twist-negative'])for(const z of [-100,0,100]){await init();await p.evaluate(({posture,z})=>{machineProfile=null;supportHeights=supports.map(s=>posture==='flat'?0:posture==='plane'?.03*s.x+.04*s.z:(posture==='twist-positive'?1:-1)*.05*s.x*s.z);positions.Z=z;updateAxisValues();updateLeveling(false);},{posture,z});await snap(`${posture}-Z${z}`);}
await init();await p.locator('#supportMap .map-point').nth(1).click();await snap('support-B-start');await p.locator('#raiseSupport').click();await snap('support-B-plus001');await p.locator('#lowerSupport').click();await snap('support-B-restored');
for(const sign of [-1,1])for(const view of ['front','side']){await init();await p.evaluate(({sign,view})=>{machineProfile=null;supportHeights=supports.map(s=>sign*.05*s.x*s.z);updateLeveling(false);setSceneView(view);setSceneZoom(1.6);},{sign,view});await snap(`twist-${sign}-${view}`);}
await init();for(const view of ['front','side','oblique']){await p.evaluate(view=>setSceneView(view),view);await snap('view-'+view);}
await p.locator('#spindleSweepToggle').click();await snap('parallel-detail');await p.evaluate(()=>{const e=$('horizontalParallelFixture'),s=$('adjustmentSelectionScroll');s.scrollTop+=e.getBoundingClientRect().top-s.getBoundingClientRect().top;});await snap('parallel-detail-contact');await p.locator('#closeSpindleSweepSelection').click();
const numeric=s=>JSON.stringify([s.squares,s.parallel]);
for(const posture of ['flat','plane'])for(const z of [-100,0,100]){const state=states.find(s=>s.name===`${posture}-Z${z}`);check(`${posture} Z${z} independent ideal/rigid plane zero`,[...state.squares,...state.parallel].every(v=>Math.abs(Number(v.value))<1e-6));}
const viewValues=states.filter(s=>s.name.startsWith('view-'));check('camera front side oblique leaves measurements unchanged',viewValues.every(s=>numeric(s)===numeric(viewValues[0])));
await init();const initial=await read();await p.locator('#raiseSupport').click();const raised=await read();check('real support adjustment changes geometry readings',numeric(raised)!==numeric(initial));check('support adjustment preserves intrinsic inspection',raised.intrinsic===initial.intrinsic);await p.locator('#lowerSupport').click();check('support up down reproduces readings',numeric(await read())===numeric(initial));
const saved=await p.evaluate(()=>{saveLeveling();return JSON.parse(localStorage.getItem(levelKey()));});await p.locator('#raiseSupport').click();await p.locator('#importLevel').setInputFiles({name:'horizontal-audit-save.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});await p.waitForFunction(()=>$('levelInputMessage').textContent.includes('読み込みました')||$('levelInputMessage').textContent.includes('読込できません'));const restored=await read();check('saved support/profile import reproduces readings',numeric(restored)===numeric(initial),{initial:numeric(initial),restored:numeric(restored),message:await p.locator('#levelInputMessage').innerText()});check('saved import reproduces intrinsic inspection',(await read()).intrinsic===initial.intrinsic);
await p.locator('#inspectionNext').click();check('intrinsic second page reachable',await p.evaluate(()=>intrinsicInspectionPage===1));check('intrinsic page has no decimal micron values',!/[+-]?\d+\.\d+/.test(await p.locator('#intrinsicInspectionPage').innerText()));await p.locator('#inspectionPrevious').click();check('measurement first page reachable again',await p.evaluate(()=>intrinsicInspectionPage===0));

// New audit: expected moving assemblies are written from the mechanical
// structure, not copied from the drawing's axis-membership metadata.
const material=()=>p.evaluate(()=>{
 const q=(point,axes,pose)=>displayedModelPoint(point,axes,current,positions,pose);
 const m=createGeometry(current);
 return {positions:{...positions},selectedAxis,zoom:sceneZoom,view:sceneView,
  labels:Object.fromEntries(m.labels.map(l=>[l.name,q(l.p,l.axes,l.pose)])),
  groups:Object.fromEntries(['','X','X,Y','Z'].map(key=>[key,m.faces.filter(f=>f.axes.join(',')===key).flatMap(f=>f.v.map(v=>q(v,f.axes,f.pose)))])),
  arrows:axisIndicators(current,m).map(a=>({key:a.key,origin:a.bodyOrigin,points:a.points})),
  scale:[levelConfig.width/(current.w*.8),levelConfig.depth/(current.d*.8)],
  support:supports.map((s,i)=>({name:String.fromCharCode(65+i),...s,height:supportHeights[i]})),
  part:{column:q([0,1.95,1.334],['X'],'tool'),head:q([0,2.55,.25],['X','Y'],'tool'),nose:q([0,2.55,-.93],['X','Y'],'tool'),pallet:q([0,1.27,-.85],['Z'],'work'),work:q([0,1.75,-.85],['Z'],'work'),base:q([0,.42,0],[],'bed')}
 };});
const near=(a,b,t=1e-9)=>Math.hypot(...a.map((v,i)=>v-b[i]))<t;
const openAxis=async key=>{await p.locator('#axisTabs .axis-tab').filter({hasText:key+'軸'}).click();await p.locator('#openTrainingMenu').click();if(!await p.locator('#axisMenuSection').evaluate(e=>e.open))await p.locator('#axisMenuSection summary').click();};
const slider=async(key,value)=>{await openAxis(key);await p.locator('#axis-'+key).fill(String(value));await p.locator('#axis-'+key).dispatchEvent('input');await p.locator('#closeTrainingMenu').click();};
const ideal=async()=>{await init();await p.evaluate(()=>{machineProfile=null;$('exaggerate').checked=false;updateLeveling(false);});};
const mechanics=[];
for(const key of ['X','Y','Z']){
 await ideal();await slider(key,-100);const a=await material();await snap('physical-'+key+'-negative');
 await slider(key,100);const b=await material();await snap('physical-'+key+'-positive');
 const expectedMove=key==='X'?[1.1*a.scale[0],0,0]:key==='Y'?[0,.6,0]:[0,0,.9*a.scale[1]];
 const expectedParts=key==='X'?['column','head','nose']:key==='Y'?['head','nose']:['pallet','work'];
 for(const name of Object.keys(a.part)){const delta=b.part[name].map((v,i)=>v-a.part[name][i]);check(`${key} physical ${name} follows correct assembly`,near(delta,expectedParts.includes(name)?expectedMove:[0,0,0]),delta);}
 const expectedLabels=key==='X'?['コラム','主軸頭']:key==='Y'?['主軸頭']:['パレット台','パレット'];
 for(const name of Object.keys(a.labels)){const delta=b.labels[name].map((v,i)=>v-a.labels[name][i]);check(`${key} label ${name} follows correct assembly`,near(delta,expectedLabels.includes(name)?expectedMove:[0,0,0]),delta);}
 for(const group of Object.keys(a.groups)){const moving=group.split(',').includes(key);check(`${key} all mesh vertices group ${group||'fixed'} move consistently`,a.groups[group].every((v,i)=>near(b.groups[group][i].map((x,j)=>x-v[j]),moving?expectedMove:[0,0,0])));}
 mechanics.push({key,negative:a,positive:b});
}
fs.writeFileSync(path.join(out,'mechanics.json'),JSON.stringify(mechanics));
// Exercise the actual button and animation. Freeze the finite animation by
// reopening the menu and clicking its stop button; replay the nearest whole
// slider position and compare every observed mesh vertex with the demo.
const demos=[];
for(const key of ['X','Y','Z']){
 await ideal();const zero=await material();await openAxis(key);await p.locator('#playAxis').click();
 await p.waitForFunction(key=>positions[key]>75,key);await p.locator('#openTrainingMenu').click();await p.locator('#playAxis').click();await p.locator('#closeTrainingMenu').click();
 const demo=await material();await snap('demo-'+key+'-stopped');
 check(`${key} demo actual selected axis moved`,Math.abs(demo.positions[key])>1);
 check(`${key} demo other axes stay at zero`,['X','Y','Z'].filter(k=>k!==key).every(k=>demo.positions[k]===0));
 const rounded=Math.round(demo.positions[key]);await slider(key,rounded);const replay=await material();
 const distance=(key==='X'?.55*demo.scale[0]:key==='Y'?.3:.45*demo.scale[1])*Math.abs(rounded-demo.positions[key])/100;
 for(const group of Object.keys(demo.groups))check(`${key} slider/demo mesh group ${group||'fixed'} agrees`,demo.groups[group].every((v,i)=>near(v,replay.groups[group][i],distance+1e-9)));
 check(`${key} axis button and drawer agree`,replay.selectedAxis===key&&await p.locator('#drawerAxisSelect').inputValue()===key);
 demos.push({key,zero,demo,replay,roundingDistanceMetres:distance});
 await openAxis(key);await p.locator('#resetAxes').click();await p.locator('#closeTrainingMenu').click();check(`${key} reset returns all axes central`,await p.evaluate(()=>['X','Y','Z'].every(k=>positions[k]===0)));
}
fs.writeFileSync(path.join(out,'demos.json'),JSON.stringify(demos));
// Combined endpoints and both twist signs; snapshots retain all five values.
for(const sign of [-1,1])for(const X of [-100,100])for(const Y of [-100,100])for(const Z of [-100,100]){
 await init();await p.evaluate(sign=>{supportHeights=supports.map(s=>sign*.05*s.x*s.z);updateLeveling(false);},sign);
 for(const [key,value] of Object.entries({X,Y,Z}))await slider(key,value);
 await snap(`combined-twist${sign}-X${X}-Y${Y}-Z${Z}`);
}
// Local interpolation boundary crossed by a material pallet point: record
// both physical posture and displayed readings, do not assume continuity of
// a derivative across a piecewise support model.
const boundary=[];
for(const z of [51,52,53,54]){
 await init();await p.evaluate(()=>{supportHeights=supports.map((s,i)=>i===3?.03:i===5?-.02:0);updateLeveling(false);});await slider('Z',z);
 boundary.push({z,mechanics:await material(),state:await snap('boundary-Z'+z)});
}
fs.writeFileSync(path.join(out,'boundary.json'),JSON.stringify(boundary));
// Real front/side selectors, keyboard rotation, wheel zoom, and display-only
// settings must not change unrounded measurements.
await init();await p.evaluate(()=>{supportHeights=supports.map(s=>.05*s.x*s.z);updateLeveling(false);});const displayInitial=await read();
for(const view of ['front','side','oblique']){
 await p.locator('#openTrainingMenu').click();if(!await p.locator('#modelDisplaySettings').evaluate(e=>e.open))await p.locator('#modelDisplaySettings summary').first().click();await p.locator('#sceneView').selectOption(view);await p.locator('#closeTrainingMenu').click();await snap('real-view-'+view);
 check('real '+view+' selector leaves readings unchanged',numeric(await read())===numeric(displayInitial));
}
const scene=await p.locator('#scene').boundingBox();await p.mouse.move(scene.x+scene.width/2,scene.y+scene.height/2);await p.mouse.wheel(0,-220);await p.waitForTimeout(100);await snap('real-wheel-zoom');check('wheel zoom changes size only',numeric(await read())===numeric(displayInitial)&&await p.evaluate(()=>sceneZoom>1));
await p.locator('#scene').focus();await p.keyboard.press('ArrowRight');await p.keyboard.press('+');await snap('real-keyboard-rotate-zoom');check('keyboard camera and zoom readings unchanged',numeric(await read())===numeric(displayInitial));
await p.locator('#openTrainingMenu').click();if(!await p.locator('#modelDisplaySettings').evaluate(e=>e.open))await p.locator('#modelDisplaySettings summary').first().click();await p.locator('#exaggerate').uncheck();await p.locator('#showIdealOutline').uncheck();await p.locator('#closeTrainingMenu').click();await snap('display-unexaggerated');check('exaggeration and outline do not affect readings',numeric(await read())===numeric(displayInitial));
// Every support is selected through the map, with coarse and fine round trips.
await init();const supportsInitial=await read();
for(let i=0;i<8;i++)for(const [button,step] of [['coarseAdjust',.01],['fineAdjust',.001]]){
 await p.locator('#supportMap .map-point').nth(i).click();await p.locator('#'+button).click();const old=await read();await p.locator('#raiseSupport').click();const raised=await read();
 check(`support ${String.fromCharCode(65+i)} ${step} raises selected only`,raised.heights.every((h,j)=>Math.abs(h-old.heights[j]-(j===i?step:0))<1e-10));
 check(`support ${i} ${step} leaves intrinsic unchanged`,raised.intrinsic===supportsInitial.intrinsic);await p.locator('#lowerSupport').click();check(`support ${i} ${step} round trip`,numeric(await read())===numeric(old));
}
// Actual browser download and file-input import, including noncentral axes.
await init();await slider('X',37);await slider('Y',-62);await slider('Z',80);await p.locator('#supportMap .map-point').nth(3).click();await p.locator('#raiseSupport').click();const exportState=await read();
await p.locator('#openTrainingMenu').click();await p.locator('.level-storage summary').click();const downloaded=p.waitForEvent('download');await p.locator('#exportLevel').click();const download=await downloaded;const file=path.join(out,'saved-state.json');await download.saveAs(file);await p.locator('#closeTrainingMenu').click();await slider('X',-100);await p.locator('#lowerSupport').click();
await p.locator('#importLevel').setInputFiles(file);await p.waitForFunction(()=>$('levelInputMessage').textContent.includes('読み込みました'));const importState=await read();check('actual export/import restores axes supports and raw readings',JSON.stringify([exportState.positions,exportState.heights,exportState.squares,exportState.parallel])===JSON.stringify([importState.positions,importState.heights,importState.squares,importState.parallel]));await snap('real-import-restored');
// Narrowest responsive check; actual iPhone Safari is explicitly not tested.
await p.setViewportSize({width:320,height:740});await init();await snap('horizontal-320');check('320px page has no horizontal document overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));

check('no page errors',errors.length===0,errors);
if(mode==='after'){const before=JSON.parse(fs.readFileSync(path.join(root,'before/results.json')));for(const state of states.filter(s=>s.kind==='horizontal')){const old=before.states.find(s=>s.name===state.name);const left=[...state.squares,...state.parallel],right=[...old.squares,...old.parallel];check(state.name+' horizontal raw measurements unchanged',left.every((v,i)=>v.text===right[i].text&&Math.abs(Number(v.value)-Number(right[i].value))<1e-9));}for(const state of states.filter(s=>s.name.startsWith('machine-')||s.name.startsWith('intrinsic-'))){if(state.kind==='horizontal')continue;const old=before.states.find(s=>s.name===state.name);check(state.name+' other machine values',JSON.stringify(state)===JSON.stringify(old));const diff=pixelDiff(fs.readFileSync(path.join(root,'before',state.name+'.png')),fs.readFileSync(path.join(out,state.name+'.png')));check(state.name+' other machine pixel unchanged',diff===0,diff);}}
const result={mode,sha256:crypto.createHash('sha256').update(html).digest('hex'),checks,states,errors};fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));await browser.close();console.log(JSON.stringify({checks:checks.length,failed:checks.filter(c=>!c.ok),sha256:result.sha256}));process.exitCode=checks.some(c=>!c.ok)?1:0;})().catch(e=>{console.error(e);process.exit(1);});

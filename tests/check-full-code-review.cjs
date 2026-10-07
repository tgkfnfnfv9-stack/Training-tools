'use strict';
// Independent checks for cross-page lifecycle, actual animated frames, axis
// hierarchy, random-profile persistence, intrinsic-axis arrows, and asynchronous
// import ordering. No browser or network required.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const createEnvironment=require('./leveling-dom-env.cjs');
let checks=0;const failures=[];
function check(name,fn){checks++;try{fn();}catch(error){failures.push(name+': '+error.message);}}
function near(a,b,t=1e-8){assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<t,`${a} != ${b}`);}
async function main(){
 const env=createEnvironment(),{registry:r,read,json,context,storage}=env;
 // The bundled page should have no required relative script or stylesheet URL.
 const built=fs.readFileSync('index.html','utf8');
 check('standalone build has all modules and no external local dependency',()=>{
  assert.doesNotMatch(built,/<script\s+src=|<link[^>]+rel="stylesheet"/);
  const scripts=[...built.matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,11);
  for(const match of scripts)new vm.Script(match[1]);
  assert.doesNotMatch(built,/<!-- TESTER_LESSON -->/);
  for(const file of ['leveling.js','machine-accuracy.js','reference-measurement.js','reference-measurement-ui.js','app.js','leveling-ui.js','accuracy-ui.js','machine-accuracy-ui.js','tester.js'])assert.ok(built.includes(fs.readFileSync('src/'+file,'utf8')),file+' latest source is missing from bundled page');
 });
 check('source and bundled markup have balanced tags and unique static IDs',()=>{
  const source=fs.readFileSync('src/index.html','utf8').replace('<!-- TESTER_LESSON -->',fs.readFileSync('src/tester.html','utf8'));
  const voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  for(const html of [source,built]){
   const markup=html.replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<style\b[\s\S]*?<\/style>/gi,'');
   const ids=[...markup.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
   const stack=[];for(const [token] of markup.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/?[a-z][^>]*>/gi)){
    if(token.startsWith('<!'))continue;const tag=/^<\/?([a-z][\w-]*)/i.exec(token)[1].toLowerCase();
    if(token.startsWith('</'))assert.equal(stack.pop(),tag,'closing '+tag);else if(!voids.has(tag)&&!token.endsWith('/>'))stack.push(tag);
   }assert.deepEqual(stack,[]);
  }
 });
 // Run real electrical code in the same DOM/context as mechanical navigation.
 // Standard DOM exposes SELECT.options; the minimal fixture omits this property.
 r.testerPolarity.options=r.testerPolarity.children;
 vm.runInContext(fs.readFileSync('src/tester.js','utf8'),context,{filename:'tester.js'});
 const trigger=(id,type='click',value)=>{const el=r[id];if(value!==undefined)el.value=value;assert(!el.disabled,id+' disabled');if(el.events[type])return el.events[type]({target:el});return el['on'+type]?.({target:el});};
 const button=(attr,value)=>r.tester.querySelectorAll('['+attr+']').find(el=>el.attrs[attr]===value);
 const clickButton=el=>{assert(!el.disabled);el.events.click({target:el});};
 r.electric.click();r.testerEntry.click();
 check('integrated tester entry, labels and fixed-view class',()=>{assert.equal(read('page'),'tester');assert(context.document.body.classList.contains('in-lab'));assert.equal(r.tester.hidden,false);assert.match(r.testerResult.textContent,/未測定/);assert.equal(r.testerPolarity.options[0].textContent,'赤を＋、黒を−');});
 clickButton(button('data-tester-case','current'));trigger('testerBlackLead','change','com');trigger('testerRedLead','change','a');clickButton(button('data-tester-mode','dca'));r.testerPrepared.checked=true;trigger('testerPrepared','change');trigger('testerMeasure');
 check('integrated current connection shows energized serial diagram',()=>{assert.match(r.testerResult.textContent,/25.00 mA/);assert.match(r.testerDiagram.innerHTML,/直列 · 模擬電源ON/);assert(r.testerRedLead.disabled);});
 trigger('testerDisconnect');trigger('testerRedLead','change','vohm');clickButton(button('data-tester-mode','off'));
 check('integrated electrical completion reaches 1 of 5',()=>assert.match(r.testerProgress.textContent,/1 \/ 5/));
 r.testerBack.click();read("navigate('home')");r.mechanical.click();r.leveling.click();r.machineGrid.children[0].click();
 check('electrical to mechanical navigation hides old lesson',()=>{assert.equal(read('page'),'training');assert.equal(r.tester.hidden,true);assert.equal(r.training.hidden,false);});
 // Axis transforms must keep every unrelated component fixed, and preserve
 // rigid distances even for nested A/C rotary movement.
 for(const [index,mode] of [[0,'compact'],[1,''],[2,''],[3,'l3-3000'],[4,''],[5,''],[6,'']]){
  storage.clear();read(`openMachine(machines[${index}])`);if(mode)r.machineMode.change(mode);
  for(const axis of json('axisConfig(current)')){
   const base={X:0,Y:0,Z:0,A:0,C:0},moved={...base,[axis.key]:73};
   for(const face of json('createGeometry(current).faces')){
    const original=json(`transformedPoint(${JSON.stringify(face.v[0])},${JSON.stringify(face.axes)},current,${JSON.stringify(base)})`),position=json(`transformedPoint(${JSON.stringify(face.v[0])},${JSON.stringify(face.axes)},current,${JSON.stringify(moved)})`);
    if(!face.axes.includes(axis.key))assert.deepEqual(position,original);
    const second=json(`transformedPoint(${JSON.stringify(face.v[1])},${JSON.stringify(face.axes)},current,${JSON.stringify(moved)})`);
    near(Math.hypot(...second.map((v,i)=>v-position[i])),Math.hypot(...face.v[1].map((v,i)=>v-face.v[0][i])));
   }
   checks++;
  }
 }
 // Use a controllable animation scheduler rather than the fixture's immediate RAF.
 const pending=new Map();let nextId=0;context.requestAnimationFrame=fn=>{const id=++nextId;pending.set(id,fn);return id;};context.cancelAnimationFrame=id=>pending.delete(id);
 const tick=t=>{const [id,fn]=pending.entries().next().value;pending.delete(id);fn(t);};
 read('openMachine(machines[0])');pending.clear();read("selectAxis('X')");r.playAxis.click();tick(1000);tick(2750);tick(4500);
 check('single round trip ends at center and saves final position',()=>{near(read('positions.X'),0);assert.equal(read('motionFrame'),null);assert.equal(pending.size,0);assert.equal(r.playAxis.getAttribute('aria-pressed'),'false');near(JSON.parse(storage.get(read('levelKey()'))).axisPositions.X,0);});
 r.playAxis.click();tick(5000);tick(5750);const beforeStop=read('positions.X');r.changeMachine.click();
 check('leaving training cancels next animated frame and saves last pose',()=>{assert.ok(beforeStop>20);assert.equal(read('motionFrame'),null);assert.equal(pending.size,1); // catalog thumbnail redraw only
  near(JSON.parse(storage.get(read('levelKey()'))).axisPositions.X,beforeStop);});pending.clear();
 r.machineGrid.children[0].click();pending.clear();
 check('returning to a machine resets its stopped axis readout',()=>{near(read('positions.X'),0);near(Number(r['axis-X'].value),0);});
 r.playAxis.click();tick(6500);tick(7000);trigger('axis-Y','input','24');
 check('manual different-axis movement stops animation and synchronizes selection',()=>{assert.equal(read('motionFrame'),null);assert.equal(pending.size,0);assert.equal(read('selectedAxis'),'Y');near(read('positions.Y'),24);near(Number(r['axis-Y'].value),24);});
 // A late file completion must never overwrite the most recently chosen file
 // or the state of a newly opened/reset training problem.
 const valid=json('levelRecord()');let resolveFirst;
 const older=structuredClone(valid),newer=structuredClone(valid);older.heights[0]=.11;newer.heights[0]=.22;
 r.importLevel.files=[{size:100,text:()=>new Promise(resolve=>resolveFirst=resolve)}];const first=r.importLevel.onchange({target:r.importLevel});
 r.importLevel.files=[{size:100,text:async()=>JSON.stringify(newer)}];await r.importLevel.onchange({target:r.importLevel});const latest=json('levelRecord()');resolveFirst(JSON.stringify(older));await first;
 check('latest import wins when files finish out of order',()=>{assert.deepEqual(json('levelRecord()'),latest);near(read('supportHeights[0]'),.22);});
 const oldSession=structuredClone(valid);oldSession.heights[0]=.33;let resolveAfterOpen;r.importLevel.files=[{size:100,text:()=>new Promise(resolve=>resolveAfterOpen=resolve)}];const pendingOpen=r.importLevel.onchange({target:r.importLevel});
 read('openMachine(machines[1]);openMachine(machines[0]);');pending.clear();const reopened=json('levelRecord()');resolveAfterOpen(JSON.stringify(oldSession));await pendingOpen;
 check('late import cannot mutate a subsequently reopened machine',()=>assert.deepEqual(json('levelRecord()'),reopened));
 let resolveAfterExercise;r.importLevel.files=[{size:100,text:()=>new Promise(resolve=>resolveAfterExercise=resolve)}];const pendingExercise=r.importLevel.onchange({target:r.importLevel});r.startLevelExercise.click();const exercise=json('levelRecord()');resolveAfterExercise(JSON.stringify(older));await pendingExercise;
 check('late import cannot replace a newly generated exercise',()=>assert.deepEqual(json('levelRecord()'),exercise));
 // CSS guards and DOM separation are checked here; actual device layout still
 // requires a browser and is not claimed by these no-browser checks.
 const css=fs.readFileSync('src/style.css','utf8');
 check('mobile lesson uses separate fixed picture and scrolling control areas',()=>{assert.match(css,/body\.in-lab\{height:100vh;height:100dvh;overflow:hidden/);assert.match(css,/body\.in-lab \.scroll-controls\{[^}]*overflow-y:auto/);assert.match(css,/orientation:landscape/);assert.equal(r.scene.closest('#trainingMain'),r.trainingMain);assert.equal(r.mainAdjustment.closest('#trainingMain'),r.trainingMain);assert.equal(r.trainingControls.closest('#trainingDrawer'),r.trainingDrawer);assert.equal(r.scene.closest('.scroll-controls'),null);});

 // Seed the user-facing profiles deterministically so this integration suite
 // verifies the same identities and JSON shapes on every run.
 let seed=13001;context.window.crypto={getRandomValues:values=>{values[0]=seed++;return values;}};
 const layouts=[[0,'compact'],[1,''],[2,''],[3,'l3-3000'],[4,''],[5,''],[6,'']];
 for(const [index,mode] of layouts){
  storage.clear();read(`openMachine(machines[${index}])`);if(mode)r.machineMode.change(mode);pending.clear();
  const initial=json('machineProfile'),keys=json('machineLinearKeys()');
  check('random initial profile and immediate persistence '+index+' '+mode,()=>{
   assert.equal(initial.condition,'new');assert.deepEqual(json('supportHeights'),initial.initialHeights);assert(initial.initialHeights.some(v=>v!==0));
   assert.equal(read('levelRecord().version'),[0,1,3].includes(index)?3:2);assert(read('validLevelRecord(levelRecord())'));
   assert.deepEqual(JSON.parse(storage.get(read('levelKey()'))).machineProfile,initial);
   assert.equal(Number(r.machineIdentity.getAttribute('data-seed')),initial.seed);assert.doesNotMatch(r.machineIdentity.textContent,/[0-9]/);assert.equal(r.guideMetrics.children.length,keys.length);
   assert.equal(r.accuracyComparison.children.length,2);for(const row of r.accuracyComparison.children){assert.equal(row.children.length,4);for(const cell of row.children.slice(1,3))assert(Number.isFinite(Number(cell.textContent)));assert.equal(row.children[3].textContent,'固定成分');}
  });
  const guideText=r.guideMetrics.textContent;
  r.height0.change('0.003');r.adjustStep.change('0.005');r.up0.click();
  trigger('axis-'+keys[0],'input','37');r.scene.events.keydown({key:'ArrowRight',preventDefault(){}});
  check('fine support movement retains intrinsic profile '+index+' '+mode,()=>{
   near(read('supportHeights[0]'),initial.initialHeights[0]+.008);assert.equal(r.height0.value,'0.008');assert.equal(r.height0.getAttribute('step'),'0.001');
   assert.deepEqual(json('machineProfile'),initial);assert.equal(r.guideMetrics.textContent,guideText);assert(read('validLevelRecord(levelRecord())'));
  });
  r.machineCondition.change('used');const used=json('machineProfile');
  check('used selection changes individual and resets axes '+index+' '+mode,()=>{assert.equal(used.condition,'used');assert.notEqual(used.seed,initial.seed);assert.deepEqual(json('supportHeights'),used.initialHeights);assert(json('Object.values(positions)').every(v=>v===0));assert.equal(r.machineCondition.value,'used');});
  r.zero.click();
  check('flat support retains every intrinsic squareness and guide '+index+' '+mode,()=>{
   assert.deepEqual(json('machineProfile'),used);assert(json('supportHeights').every(v=>v===0));
   for(const pair of json('levelGeometry.pairs'))near(pair.errorMicrons,used.squareness[pair.key].microns*read('levelConfig.offset')/.3,1e-7);
  });
  const record=json('levelRecord()'),angles=json('levelGeometry.pairs');
  r.exportLevel.click();const exported=JSON.parse(await context.exportedBlob.text());
  check('export includes exact used profile '+index+' '+mode,()=>assert.deepEqual(exported,record));
  read(`openMachine(machines[${(index+1)%7}]);openMachine(machines[${index}]);`);if(mode)r.machineMode.change(mode);pending.clear();
  r.importLevel.files=[{size:100,text:async()=>JSON.stringify(record)}];await r.importLevel.onchange({target:r.importLevel});
  check('profile and precision reproduce after explicit JSON import '+index+' '+mode,()=>{assert.deepEqual(json('levelRecord()'),record);assert.deepEqual(json('levelGeometry.pairs'),angles);assert.equal(r.machineCondition.value,'used');assert.match(r.levelInputMessage.textContent,/読み込み/);});
  const corrupted=structuredClone(record);corrupted.machineProfile.guides[keys[0]].microns+=.001;
  r.importLevel.files=[{size:100,text:async()=>JSON.stringify(corrupted)}];await r.importLevel.onchange({target:r.importLevel});
  check('tampered intrinsic profile is rejected atomically '+index+' '+mode,()=>{assert.deepEqual(json('levelRecord()'),record);assert.match(r.levelInputMessage.textContent,/読込できません/);});
 }
 // Legacy records keep their adjusted supports while acquiring a valid new
 // profile; opening them cannot reinstate the old perfect-machine assumption.
 const legacy=json('levelRecord()');legacy.version=1;delete legacy.machineProfile;delete legacy.columnX;delete legacy.columnZ;delete legacy.axisPositions;
 r.importLevel.files=[{size:100,text:async()=>JSON.stringify(legacy)}];await r.importLevel.onchange({target:r.importLevel});
 check('legacy import preserves adjustment and creates a persisted profile',()=>{assert.deepEqual(json('supportHeights'),legacy.heights);assert.equal(read('levelRecord().version'),2);assert(read('validLevelRecord(levelRecord())'));assert.equal(read('machineProfile.condition'),'new');assert.equal(read('levelConfig.columnX'),0);assert(json('Object.values(positions)').every(v=>v===0));});
 // Compare the renderer's actual two-point selected-axis stroke with the axis
 // used by the numerical model, for both true scale and the visual exaggeration.
 const strokes=[];let canvasPath=[];
 const canvas={scale(){},fillRect(){},beginPath(){canvasPath=[];},moveTo(x,y){assert(Number.isFinite(x)&&Number.isFinite(y));canvasPath.push([x,y]);},lineTo(x,y){assert(Number.isFinite(x)&&Number.isFinite(y));canvasPath.push([x,y]);},closePath(){},arc(){},fill(){},fillText(){},measureText(text){return {width:text.length*5};},stroke(){if(this.lineWidth===4&&canvasPath.length===2)strokes.push(canvasPath.map(p=>[...p]));}};
 r.scene.getBoundingClientRect=()=>({width:390,height:340});r.scene.getContext=()=>canvas;
 const unit=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);},sub=(a,b)=>a.map((v,i)=>v-b[i]);
 for(const [index,mode] of layouts){
  read(`openMachine(machines[${index}])`);if(mode)r.machineMode.change(mode);pending.clear();r.machineCondition.change('used');r.zero.click();
  for(const exaggerate of [false,true]){
   r.exaggerate.checked=exaggerate;r.exaggerate.onchange();
   const keys=json('machineLinearKeys()'),vectors=json('machineLinearKeys().map(key=>accuracyVisualVector(key))'),factor=exaggerate?read('levelGeometry.visualFactor'):1,profile=json('machineProfile');
   check('drawn intrinsic-axis angles use the stated exaggeration '+index+' '+mode+' '+exaggerate,()=>{
    for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++){
     const dot=vectors[i].reduce((sum,v,k)=>sum+v*vectors[j][k],0);// Lathe arrows describe NC feed X/Z; its separate squareness lesson
     // compares spindle Z against feed X and retains the intrinsic defect.
     near(-Math.asin(dot),index===6?0:profile.squareness[keys[i]+keys[j]].microns/.3/1e6*factor,1e-10);
    }
   });
   for(const key of keys){
    strokes.length=0;read(`selectAxis('${key}')`);
    const faces=json(`createGeometry(current).faces.filter(f=>f.axes.includes('${key}')).flatMap(f=>f.v.map(p=>displayTransformedPoint(p,f.axes,current,positions,f.pose)))`),origin=[0,1,2].map(i=>(Math.min(...faces.map(p=>p[i]))+Math.max(...faces.map(p=>p[i])))/2),vector=vectors[keys.indexOf(key)],pose=json('levelGeometry.axes').find(a=>a.key===key).source;
    const supportOrigin=json(`levelMappedVisualPoint(${JSON.stringify(origin)},'${pose}')`),bodyPoints=json(`createGeometry(current).faces.filter(f=>f.axes.includes('${key}')).flatMap(f=>f.v.map(p=>levelMappedBodyVisualPoint(displayTransformedPoint(p,f.axes,current,positions,f.pose),f.pose)))`),bodyOrigin=[0,1,2].map(i=>(Math.min(...bodyPoints.map(p=>p[i]))+Math.max(...bodyPoints.map(p=>p[i])))/2);
    const endpoints=[-1,1].map(sign=>json(`levelMappedVisualPoint(${JSON.stringify(origin.map((v,i)=>v+sign*vector[i]*.6))},'${pose}')`).map((v,i)=>v+bodyOrigin[i]-supportOrigin[i]));
    const yaw=read('yaw'),project=p=>{const x=p[0]*Math.cos(yaw)+p[2]*Math.sin(yaw),z=-p[0]*Math.sin(yaw)+p[2]*Math.cos(yaw),y=(p[1]-1.65)*Math.cos(.24)+z*Math.sin(.24),depth=11+z*Math.cos(.24)-(p[1]-1.65)*Math.sin(.24);return [x/11,-y/11];};
    check('Canvas arrow agrees with intrinsic model '+index+' '+mode+' '+key+' '+exaggerate,()=>{assert.equal(strokes.length,1);const actual=unit(sub(strokes[0][1],strokes[0][0])),expected=unit(sub(project(endpoints[1]),project(endpoints[0])));assert(Math.hypot(...sub(actual,expected))<1e-10);});
   }
  }
 }
 r.scene.getBoundingClientRect=()=>({width:0,height:0});
 // Include incomplete manual edits, individual redraws, late old errors, and
 // newly started motion in the asynchronous-import lifecycle checks.
 for(const action of ['height','heightBlank','width','widthBlank','depth','offsetBlank','preset','zero','exercise','restoreInitial','applyBest','draw','condition','reopen','leave','animate','newInvalid']){
  read('openMachine(machines[0])');pending.clear();r.drawMachine.click();
  const stale=json('levelRecord()');stale.heights[0]=.444;let complete;
  r.importLevel.files=[{size:100,text:()=>new Promise(resolve=>complete=resolve)}];const importing=r.importLevel.onchange({target:r.importLevel});
  if(action==='height')r.height0.change('.003');
  if(action==='heightBlank'){r.height0.value='';r.height0.oninput({target:r.height0});}
  if(action==='width')r.supportWidth.change('3');
  if(action==='depth')r.supportDepth.change('5');
  if(action==='widthBlank'){r.supportWidth.value='';r.supportWidth.oninput();}
  if(action==='offsetBlank'){r.impactOffset.value='';r.impactOffset.oninput();}
  if(action==='preset')read("applyLevelPreset('twist')");
  if(action==='zero')r.zero.click();
  if(action==='exercise')r.startLevelExercise.click();
  if(action==='restoreInitial')r.restoreInitialLevel.click();
  if(action==='applyBest')r.applyBestLevel.click();
  if(action==='draw')r.drawMachine.click();
  if(action==='condition')r.machineCondition.change('used');
  if(action==='reopen')read('openMachine(machines[1]);openMachine(machines[0]);');
  if(action==='leave')r.changeMachine.click();
  if(action==='animate'){pending.clear();r.playAxis.click();}
  if(action==='newInvalid'){r.importLevel.files=[{size:100,text:async()=>'{invalid'}];await r.importLevel.onchange({target:r.importLevel});}
  const before=json('levelRecord()'),message=r.levelInputMessage.textContent;complete(JSON.stringify(stale));await importing;
  check('late profile import cannot replace newer action '+action,()=>{assert.deepEqual(json('levelRecord()'),before);assert.equal(r.levelInputMessage.textContent,message);});
  read('stopMotion()');pending.clear();
 }
 // A fresh page entry must still work while browser writes fail (quota or policy).
 const persistedProfile=json('machineProfile'),originalSetter=context.localStorage.setItem;
 context.localStorage.setItem=()=>{throw Error('write denied');};read('openMachine(machines[0])');pending.clear();
 check('new individual keeps automatic-save failure visible',()=>{assert.notEqual(read('machineProfile.seed'),persistedProfile.seed);assert.match(r.levelSaveStatus.textContent,/自動保存できません/);});
 context.localStorage.setItem=originalSetter;
 if(failures.length){console.error(`${checks} full-code checks run; ${failures.length} failed:\n`+failures.join('\n'));process.exitCode=1;}else console.log(`Full code review: ${checks} integration checks passed.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});

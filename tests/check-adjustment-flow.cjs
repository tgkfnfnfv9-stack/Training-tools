'use strict';
// Exercise the learning flow through real UI events. Scores remain those of
// the existing engines; the UI cannot complete the exercise by toggling a tab.
const assert=require('node:assert/strict');
const createEnvironment=require('./leveling-dom-env.cjs');
const MachineAccuracy=require('../src/machine-accuracy.js');
const e=createEnvironment(),{registry:r,read,json,storage}=e;
const variants=[[0,'compact'],[1,''],[2,''],[3,'l3-3000'],[4,''],[5,''],[6,'']];
let checks=0;
function check(name,fn){try{fn();checks++;}catch(error){throw new Error(name+': '+error.message,{cause:error});}}
function near(a,b,tolerance=1e-7){assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance,`${a} != ${b}`);}
// Numeric exceptions are restricted to exact, verified measurement elements.
let sweepTextExceptions=new Map(),sweepAriaExceptions=new Map();
const sweepSceneDescription='主軸とテーブル上面の相対傾きを直径300ミリで比較する4点のダイヤル測定値も同時に表示します。0度は右、90度は奥、180度は左、270度は手前。上の直角図は300ミリ換算、隣の4点は手前270度基準の相対読みです。';
function prepareSweepExceptions(){
 sweepTextExceptions=new Map();sweepAriaExceptions=new Map();
 if(!['compact','travel','double','gantry','five'].includes(read('current.kind')))return;
 const g=json('(()=>{const m=spindleSweepGeometry();return {valid:m.valid,cardinal:m.cardinal,point:m.valid?m.pointAt(spindleSweepAngle):null,angle:spindleSweepAngle};})()'),zero=g.valid&&g.cardinal[3].onTable;
 const number=v=>{const magnitude=Math.round(Math.abs(v));return magnitude===0?'0':(v<0?'-':'+')+magnitude;};
 const direction=['右','奥','左','手前'];
 for(let i=0;i<4;i++){
  const point=g.cardinal?.[i],readable=zero&&point?.onTable,text=readable?number(point.readingMicrons):point&&!point.onTable?'面外':'—';
  const button=r['sweepPosition'+i],value=r['sweepValue'+i];assert.equal(button.children.length,2);
  sweepTextExceptions.set(button.children[0],i*90+'° '+direction[i]);sweepTextExceptions.set(value,text);
  sweepAriaExceptions.set(button,i*90+'度・'+direction[i]+'、'+(readable?text+'マイクロメートル':text));
  assert.equal(value.getAttribute('data-reading-microns'),readable?String(point.readingMicrons):'');
 }
 for(const id of ['sweepCurrentAngle','sweepCurrentValue','sweepDial','runSpindleSweep'])assert.equal(r[id],undefined);
 const diameter=r.spindleSweepPanel.querySelectorAll('.sweep-diameter');assert.equal(diameter.length,1);sweepTextExceptions.set(diameter[0],'直径300 mm');
 sweepTextExceptions.set(r.sweepContactStatus,!g.valid?'測定不可・主軸と上面の姿勢を確認':!zero?'手前が面外・軸を中央へ':!g.point?.onTable?'測定子が面外・軸を中央へ':'手前基準・µm（0.001 mm）');
 sweepTextExceptions.set(r.sweepMeasurementNote,'主軸と理想平面の相対傾きを直径300 mmで測ります。0°は右、90°は奥、180°は左、270°は手前です。手前270°をゼロ基準とします。プラスは測定子の押込み側です。門形の模型は支持姿勢を簡略表示し、測定は固有差を含む代表主軸方向で計算します。5軸はA/Cの姿勢を反映したテーブル上面を測ります。実際の上面の凹凸、主軸の回転振れ、測定子の荷重は再現しません。');
}
// Only the dedicated position labels and approved current 300 mm readings
// may contain numbers. Adjustment amounts and initial/delta values stay hidden.
const positionLabels={'measurement-start':'0','measurement-end':'300 mm','measurement-start-note':'0','measurement-origin-note':'O（0,0）','measurement-length-note':'300 mm'};
function visibleText(el){
 if(el.hidden)return '';
 if(sweepTextExceptions.has(el)){assert.equal(el.textContent.trim(),sweepTextExceptions.get(el));return '';}
 // Model identifiers, support counts and station names are not precision or
 // adjustment measurements. Their exact identities have separate UI checks.
 if(['machineTitle','machineSubtitle','structureText','supportNote','sourceLinks','selectedSupportLabel'].includes(el.id))return '';
 if(el.id==='liveSquarenessUnits'){assert.equal(el.textContent,'300 mm換算・µm（1 µm＝0.001 mm）');assert.equal(el.children.length,0);return '';}
 if(el.classList.contains('live-pair-base-value')||el.classList.contains('live-pair-error-value')){
  const parent=el.closest('.live-pair-values');assert(parent&&parent.closest('#liveSquareness'));assert.equal(el.children.length,0);assert.equal(el.tagName,'SPAN');
  const key=parent.getAttribute('data-pair'),pair=json('levelGeometry.pairs').find(p=>p.key===key);assert(pair);
  const lathe=read("current.kind==='lathe'"),base=lathe?'Z':key[0],other=[...key].find(a=>a!==base),value=pair.deviationMicroradians*.3,magnitude=Math.round(Math.abs(value)),number=magnitude===0?'0':(value<0?'-':'+')+magnitude;
  assert.equal(el.textContent,el.classList.contains('live-pair-base-value')?(lathe?'主軸Z':base)+'基準 0':other+'直角差 '+number);return '';
 }
 for(const [className,label] of Object.entries(positionLabels))if(el.classList.contains(className)){assert.equal(el.textContent,label);assert.equal(el.children.length,0);assert(['TEXT','SPAN'].includes(el.tagName));return '';}
 return el._text+' '+el.children.map(visibleText).join(' ');
}
function visibleElements(el,out=[]){if(el.hidden)return out;out.push(el);for(const child of el.children)visibleElements(child,out);return out;}
function compactCoach(){
 const coarse=read('adjustmentStage')==='coarse',hint=coarse?r.coarseHint:r.fineHint,ready=(coarse?r.stageStatus.getAttribute('data-coarse-ready'):r.fineStatus.getAttribute('data-target'))==='true';
 assert.equal(r.supportStageStatus.getAttribute('data-stage'),coarse?'coarse':'fine');assert.equal(r.supportStageStatus.getAttribute('data-ready'),String(ready));assert.match(r.supportStageStatus.textContent,coarse?/粗調整/:/微調整/);
 const reminder=r.supportStageHint,mode=ready?'goal':hint.getAttribute('data-support')!==''?'candidate':'stalled';assert.equal(reminder.getAttribute('data-mode'),mode);assert.ok(reminder.textContent.length<=20);assert.ok(r.supportStageStatus.textContent.length<=20);
 if(mode==='candidate'){assert.equal(reminder.getAttribute('data-support'),hint.getAttribute('data-support'));assert.equal(reminder.getAttribute('data-direction'),hint.getAttribute('data-direction'));assert.match(reminder.textContent,new RegExp(String.fromCharCode(65+Number(hint.getAttribute('data-support')))+'を少し'+(Number(hint.getAttribute('data-direction'))>0?'上げる':'下げる')));}
 else{assert.equal(reminder.getAttribute('data-support'),'');assert.equal(reminder.getAttribute('data-direction'),'');assert.match(reminder.textContent,mode==='goal'?/残る誤差/:/単独候補なし/);}
}
function nonnumeric(){
 compactCoach();prepareSweepExceptions();
 const text=visibleText(r.training).replace(/(?:5|2)軸/g,'');
 assert.doesNotMatch(text,/[0-9０-９%％°µμ]|\bmm\b|\brad\b/);
 for(const el of visibleElements(r.training)){
  let label=el.getAttribute('aria-label')||'';
  if(sweepAriaExceptions.has(el)){assert.equal(label,sweepAriaExceptions.get(el));label='';}
  if(el===r.scene&&['compact','travel','double','gantry','five'].includes(read('current.kind'))){assert.ok(label.endsWith(sweepSceneDescription));label=label.slice(0,-sweepSceneDescription.length);}
  let aria=label.replace(/(?:5|2)軸/g,'').replace(/15か所/g,'');
  for(const identity of [read('current.name'),...json('supports.map(s=>s.name)')])aria=aria.split(identity).join('');
  assert.doesNotMatch(aria,/[0-9０-９%％°µμ]|\bmm\b|\brad\b/);
  if(el.type==='range')assert(el.getAttribute('aria-valuetext'));
 }
 for(const el of [r.adjustStep,r.supportWidth,r.supportDepth,r.impactOffset,r.levelSensitivity,r.measurePos,...r.supportControls.querySelectorAll('input')])assert(el.hidden||el.closest('.accuracy-card')?.hidden||el.closest('.level-dimensions')?.hidden||el.closest('.gauge-details')?.hidden);
}
function loadProfile(index,mode,condition='new',seed=42){
 storage.clear();read(`openMachine(machines[${index}])`);if(mode)r.machineMode.change(mode);
 const profile=MachineAccuracy.generate(condition,seed,json('machineLinearKeys()'),read('supports.length'));
 read(`initializeMachineAccuracy(${JSON.stringify(profile)});supportHeights=[...machineProfile.initialHeights];resetAdjustmentProgress();updateLeveling();`);
 return profile;
}
function hintCandidate(id,stage){
 const hint=r[id],index=hint.getAttribute('data-support');if(index==='')return;
 const heights=json('supportHeights'),i=Number(index),direction=Number(hint.getAttribute('data-direction')),step=Number(hint.getAttribute('data-step'));
 const next=[...heights];next[i]=Math.round((next[i]+direction*step)*1000)/1000;
 const score=h=>stage==='coarse'?read(`(()=>{const s=machineSolution(${JSON.stringify(h)});return s.lr*s.lr+s.fb*s.fb;})()`):read(`machineEvaluation(${JSON.stringify(h)}).objective`);
 assert(score(next)<score(heights));near(Number(hint.getAttribute('data-before-score')),score(heights),1e-10);near(Number(hint.getAttribute('data-after-score')),score(next),1e-10);
}
function verifyDiagrams(){
 const current=json('levelGeometry.pairs'),before=json('levelInitialGeometry.pairs');
 for(const [i,svg] of r.liveSquareness.querySelectorAll('svg').entries()){
  const p=current[i],b=before.find(q=>q.key===p.key);near(Number(svg.getAttribute('data-before')),b.deviationMicroradians);near(Number(svg.getAttribute('data-current')),p.deviationMicroradians);near(Number(svg.getAttribute('data-delta')),p.deviationMicroradians-b.deviationMicroradians);
  for(const [className,dev] of [['pair-current',p.deviationMicroradians],['pair-before',b.deviationMicroradians]]){
   const line=svg.querySelectorAll('.'+className)[0],dx=Number(line.getAttribute('x2'))-Number(line.getAttribute('x1')),dy=Number(line.getAttribute('y1'))-Number(line.getAttribute('y2'));
   near(Math.hypot(dx,dy),28,1e-10);near(Math.atan2(-dx,dy),Math.max(-.65,Math.min(.65,dev*Number(svg.getAttribute('data-gain'))/1e6)),1e-12);
  }
  if(Math.abs(p.deviationMicroradians-b.deviationMicroradians)<=1e-6){assert.equal(svg.getAttribute('data-direction'),'unchanged');assert.equal(svg.querySelectorAll('.pair-change-area').length,0);}
  assert.equal(svg.querySelectorAll('.measurement-start')[0].textContent,'0');assert.equal(svg.querySelectorAll('.measurement-end')[0].textContent,'300 mm');
  near(Number(svg.getAttribute('data-current-error-300')),p.deviationMicroradians*.3);near(Number(svg.getAttribute('data-before-error-300')),b.deviationMicroradians*.3);near(Number(svg.getAttribute('data-delta-error-300')),(p.deviationMicroradians-b.deviationMicroradians)*.3);
  assert.doesNotMatch(visibleText(svg)+svg.getAttribute('aria-label'),/[0-9°µμ]/);
 }
}
for(const [index,mode] of variants)for(const condition of ['new','used']){
 const profile=loadProfile(index,mode,condition),label=index+'/'+mode+'/'+condition;
 check('fresh coarse and all-detail numeric suppression '+label,()=>{assert.equal(read('levelRecord().step'),.01);assert.equal(r.coarsePanel.hidden,false);assert.equal(r.finePanel.hidden,true);nonnumeric();hintCandidate('coarseHint','coarse');});
 const original=json('levelRecord()'),initial=json('levelInitialGeometry');
 r.fineAdjust.click();r.coarseAdjust.click();
 check('tabs preserve individual, support heights and initial diagram '+label,()=>{assert.deepEqual(json('levelRecord()'),original);assert.deepEqual(json('levelInitialGeometry'),initial);assert.equal(r.coarseAdjust.getAttribute('aria-pressed'),'true');assert.equal(r.finePanel.hidden,true);});
 const height=read('supportHeights[0]');r.up0.click();
 check('coarse step moves actual support and mean bubble '+label,()=>{near(read('supportHeights[0]'),height+.01,1e-12);assert.equal(r.supportState0.textContent,'上げた');compactCoach();hintCandidate('coarseHint','coarse');verifyDiagrams();});
 r.coarseExample.click();
 check('coarse example actually levels the support plane '+label,()=>{near(read('levelSolution.lr'),0);near(read('levelSolution.fb'),0);compactCoach();assert.equal(r.stageStatus.getAttribute('data-coarse-ready'),'true');assert.deepEqual(json('machineProfile'),profile);assert.deepEqual(json('supportHeights'),profile.initialHeights.map(()=>0));});
 const coarseScore=read('machineEvaluation(supportHeights).objective');r.fineAdjust.click();
 check('fine entry has its own aggregate comparison, not a new initial angle '+label,()=>{near(Number(r.fineOverallProgress.getAttribute('data-before')),coarseScore);assert.equal(r.fineOverallProgress.getAttribute('data-trend'),'similar');assert.equal(r.coarsePanel.hidden,true);assert.equal(r.finePanel.hidden,false);assert.equal(read('levelRecord().step'),.001);hintCandidate('fineHint','fine');});
 const actualBest=json('machineBestHeights()');if(!r.fineExample.disabled)r.fineExample.click();
 check('reference example applies real heights and real target '+label,()=>{assert.deepEqual(json('supportHeights'),actualBest);assert(read('machineEvaluation(supportHeights).objective')<=coarseScore+1e-8);assert.equal(r.fineStatus.getAttribute('data-target'),'true');near(Number(r.fineStatus.getAttribute('data-gap')),read('updateMachineAccuracy().gap'));assert.match(r.fineStatus.textContent,/目安内/);assert.doesNotMatch(r.fineStatus.textContent,/完全|合格|すべて改善/);assert.deepEqual(json('machineProfile'),profile);verifyDiagrams();nonnumeric();});
 if(index===5)check('planar supports cannot fabricate pair changes '+label,()=>{for(const svg of r.liveSquareness.querySelectorAll('svg')){near(Number(svg.getAttribute('data-delta')),0,1e-7);assert.equal(svg.getAttribute('data-direction'),'unchanged');assert.equal(svg.querySelectorAll('.pair-change-area').length,0);}assert.match(r.fineTwist.textContent,/平面/);});
 const saved=json('levelRecord()');read(`applyLevelRecord(${JSON.stringify(saved)});buildSupports();updateLeveling();`);
 check('JSON restores real data and discards unsaved fine-entry history '+label,()=>{assert.deepEqual(json('levelRecord()'),saved);assert.equal(read('fineStartEvaluation'),null);assert.match(r.fineOverallProgress.textContent,/まだありません/);assert.equal(r.finePanel.hidden,false);verifyDiagrams();});
 r.coarseAdjust.click();r.fineAdjust.click();r.startLevelExercise.click();
 check('another support exercise preserves initial angles but invalidates fine history '+label,()=>{assert.equal(read('fineStartEvaluation'),null);assert.deepEqual(json('machineProfile'),profile);verifyDiagrams();});
 r.restoreInitialLevel.click();check('restore returns unchanged pairs and no old completion '+label,()=>{assert.deepEqual(json('supportHeights'),profile.initialHeights);assert.equal(read('fineStartEvaluation'),null);verifyDiagrams();nonnumeric();});
}
// Fixed portal, seed 42: initial seating happens to nearly cancel XY while
// XZ/YZ remain large. A balanced reference improves the aggregate after the
// coarse plane, yet gives up part of that local XY cancellation. Verify both
// inequalities from measured states, rather than assuming a trend by seed.
loadProfile(3,'l3-3000','new',42);
const initialXY=Math.abs(read("levelGeometry.pairs.find(p=>p.key==='XY').errorMicrons"));
r.coarseExample.click();const beforeFinishing=read('machineEvaluation(supportHeights).objective');r.fineAdjust.click();r.fineExample.click();
check('overall finishing can improve while a current pair is farther than initial',()=>{
 assert(read('machineEvaluation(supportHeights).objective')<beforeFinishing-.1);
 assert(Math.abs(read("levelGeometry.pairs.find(p=>p.key==='XY').errorMicrons"))>initialXY+.1);
 assert.equal(r.fineOverallProgress.getAttribute('data-trend'),'better');const xy=r.liveSquareness.querySelectorAll('svg').find(s=>s.getAttribute('data-pair')==='XY');assert.equal(xy.getAttribute('data-trend'),'worse');assert.match(r.finePrecisionSummary.textContent,/初期より直角から離れた/);assert.equal(r.fineStatus.getAttribute('data-target'),'true');
});
// A used individual retains a deliberately substantial intrinsic/guide floor.
loadProfile(0,'compact','used',4);r.fineAdjust.click();r.fineExample.click();
check('large combined remainder is not blamed only on the machine body',()=>{assert.equal(r.fineStatus.getAttribute('data-target'),'true');assert.equal(r.fineStatus.getAttribute('data-body-significant'),'true');assert.match(r.fineStatus.textContent,/残る誤差/);assert.doesNotMatch(r.fineStatus.textContent,/本体の誤差は残ります/);});
loadProfile(0,'compact','used',36);read('levelConfig.width=20;levelConfig.depth=20;updateLeveling();');r.fineAdjust.click();r.fineExample.click();
read('setSupportHeight(0,supportHeights[0]+.05);');
check('small RMS difference cannot hide significant remaining adjustment',()=>{
 const now=read('machineEvaluation(supportHeights).objective'),best=read('machineReference.best.metric.objective'),gap=Math.sqrt(Math.max(0,now*now-best*best));
 assert(now-best<.1);assert(gap>.1);near(Number(r.fineStatus.getAttribute('data-gap')),gap);assert.equal(r.fineStatus.getAttribute('data-target'),'false');assert.doesNotMatch(r.fineStatus.textContent,/目安内/);
});
for(const [index,mode,condition,heights] of [[2,'','new',[-.097,-.107,-.067,-.077,-.079,-.089]]])check('single-support candidates match exhaustive neighbours; reference can help '+index+'/'+condition,()=>{
 const profile=loadProfile(index,mode,condition,42);r.fineAdjust.click();read(`supportHeights=${JSON.stringify(heights)};updateLeveling();`);
 compactCoach();assert(Number(r.fineStatus.getAttribute('data-gap'))>.1);assert.equal(r.fineStatus.getAttribute('data-target'),'false');assert.doesNotMatch(r.fineStatus.textContent,/目安内/);
 const before=read('machineEvaluation(supportHeights).objective');
 let improving=false;for(let i=0;i<heights.length;i++)for(const direction of [-1,1]){const candidate=[...heights];candidate[i]=Math.round((candidate[i]+direction*.001)*1000)/1000;if(read(`machineEvaluation(${JSON.stringify(candidate)}).objective`)<before-Math.max(1e-12,Math.abs(before)*1e-10))improving=true;}
 if(improving){assert.notEqual(r.fineHint.getAttribute('data-support'),'');hintCandidate('fineHint','fine');}else{assert.equal(r.fineHint.getAttribute('data-support'),'');assert.match(r.fineHint.textContent,/複数の支持点/);assert.equal(r.fineStatus.getAttribute('data-target'),'false');}
 const wanted=json('machineBestHeights()');r.fineExample.click();assert.deepEqual(json('supportHeights'),wanted);assert.notDeepEqual(json('supportHeights'),heights);assert.equal(r.fineStatus.getAttribute('data-target'),'true');assert.deepEqual(json('machineProfile'),profile);nonnumeric();
});
for(const step of [.001,.005,.01,.05,.1])check('legacy step retained and stage inferred '+step,()=>{
 const data=json('levelRecord()');data.step=step;delete data.machineProfile;delete data.bestState;data.version=1;
 read(`applyLevelRecord(${JSON.stringify(data)});buildSupports();updateLeveling();`);assert.equal(read('levelRecord().step'),step);assert.equal(r.coarsePanel.hidden,step<.01);assert.equal(r.finePanel.hidden,step>=.01);assert.equal(read('fineStartEvaluation'),null);nonnumeric();
});
for(const [name,mutation] of [['width','levelConfig.width=.5'],['depth','levelConfig.depth=.5'],['layout','levelConfig.columnX=37'],['evaluation','levelConfig.offset=1']])check('context change discards finishing history '+name,()=>{r.coarseAdjust.click();r.fineAdjust.click();assert(read('fineStartEvaluation'));read(mutation+';updateLeveling();');assert.equal(read('fineStartEvaluation'),null);});
for(const [before,current,trend,direction] of [[-20,-10,'better','opened'],[10,-20,'worse','closed'],[-20,20,'similar','opened'],[20,-20,'similar','closed'],[0,0,'similar','unchanged'],[-200,-150,'better','opened'],[200,150,'better','closed'],[200,0,'better','closed'],[0,-200,'worse','closed'],[0,200,'worse','opened']])check('signed change, absolute improvement and both range limits '+before+'/'+current,()=>{
 const now={pairs:[{key:'XZ',deviationMicroradians:current}]},initial={pairs:[{key:'XZ',deviationMicroradians:before}]};read(`accuracyDiagram(${JSON.stringify(now)},${JSON.stringify(initial)})`);
 const svg=r.liveSquareness.querySelectorAll('svg')[0];assert.equal(svg.getAttribute('data-trend'),trend);assert.equal(svg.getAttribute('data-direction'),direction);near(Number(svg.getAttribute('data-delta')),current-before);
 assert.equal(svg.getAttribute('data-before-limited'),String(Math.abs(before*5000/1e6)>.65));assert.equal(svg.getAttribute('data-limited'),String(Math.abs(current*5000/1e6)>.65));assert.equal(svg.getAttribute('data-any-limited'),String(Math.max(Math.abs(before),Math.abs(current))*5000/1e6>.65));
 if(Math.max(Math.abs(before),Math.abs(current))*5000/1e6>.65)assert.match(svg.getAttribute('aria-label'),/図の範囲外/);
});
check('position-label exception cannot hide numeric precision or other positions',()=>{
 loadProfile(0,'compact');nonnumeric();
 const leak=e.context.document.createElement('span');leak.textContent='0 µm';r.training.append(leak);assert.throws(nonnumeric);leak.remove();
 const marker=r.liveSquareness.querySelectorAll('.measurement-end')[0];marker.textContent='300 mm 0 µm';assert.throws(nonnumeric);marker.textContent='400 mm';assert.throws(nonnumeric);marker.textContent='300 mm';nonnumeric();
 const start=r.liveSquareness.querySelectorAll('.measurement-start')[0];start.textContent='0.001';assert.throws(nonnumeric);start.textContent='0';nonnumeric();
});
check('approved dial exceptions cannot hide wrong values or unrelated numeric output',()=>{
 loadProfile(0,'compact');nonnumeric();
 const number=r.sweepValue1.textContent;r.sweepValue1.textContent='123456';assert.throws(nonnumeric);r.sweepValue1.textContent=number;
 const label=r.sweepPosition1.getAttribute('aria-label');r.sweepPosition1.setAttribute('aria-label',label+' 999');assert.throws(nonnumeric);r.sweepPosition1.setAttribute('aria-label',label);
 const leak=e.context.document.createElement('span');leak.textContent='99 µm';r.spindleSweepPanel.append(leak);assert.throws(nonnumeric);leak.remove();
 const sceneLabel=r.scene.getAttribute('aria-label');r.scene.setAttribute('aria-label','999 '+sceneLabel);assert.throws(nonnumeric);r.scene.setAttribute('aria-label',sceneLabel);nonnumeric();
});
console.log('Adjustment flow: '+checks+' nonnumeric, actual-improvement, invariant-pair and legacy checks passed.');

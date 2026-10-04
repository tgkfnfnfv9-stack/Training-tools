'use strict';
// Exercise the learning flow through real UI events. Scores remain those of
// the existing engines; the UI cannot complete the exercise by toggling a tab.
const assert=require('node:assert/strict');
const createEnvironment=require('./leveling-dom-env.cjs');
const MachineAccuracy=require('../src/machine-accuracy.js');
const e=createEnvironment(),{registry:r,read,json,storage}=e;
const variants=[[0,'standard'],[0,'compact'],[1,''],[2,''],[3,'long'],[3,'cross'],[4,''],[5,''],[6,'']];
let checks=0;
function check(name,fn){try{fn();checks++;}catch(error){throw new Error(name+': '+error.message,{cause:error});}}
function near(a,b,tolerance=1e-7){assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance,`${a} != ${b}`);}
function visibleText(el){if(el.hidden)return '';return el._text+' '+el.children.map(visibleText).join(' ');}
function visibleElements(el,out=[]){if(el.hidden)return out;out.push(el);for(const child of el.children)visibleElements(child,out);return out;}
function compactCoach(){
 const coarse=read('adjustmentStage')==='coarse',hint=coarse?r.coarseHint:r.fineHint,ready=(coarse?r.stageStatus.getAttribute('data-coarse-ready'):r.fineStatus.getAttribute('data-target'))==='true';
 assert.equal(r.supportStageStatus.getAttribute('data-stage'),coarse?'coarse':'fine');assert.equal(r.supportStageStatus.getAttribute('data-ready'),String(ready));assert.match(r.supportStageStatus.textContent,coarse?/粗調整/:/精調整/);
 const reminder=r.supportStageHint,mode=ready?'goal':hint.getAttribute('data-support')!==''?'candidate':'stalled';assert.equal(reminder.getAttribute('data-mode'),mode);assert.ok(reminder.textContent.length<=20);assert.ok(r.supportStageStatus.textContent.length<=20);
 if(mode==='candidate'){assert.equal(reminder.getAttribute('data-support'),hint.getAttribute('data-support'));assert.equal(reminder.getAttribute('data-direction'),hint.getAttribute('data-direction'));assert.match(reminder.textContent,new RegExp(String.fromCharCode(65+Number(hint.getAttribute('data-support')))+'を少し'+(Number(hint.getAttribute('data-direction'))>0?'上げる':'下げる')));}
 else{assert.equal(reminder.getAttribute('data-support'),'');assert.equal(reminder.getAttribute('data-direction'),'');assert.match(reminder.textContent,mode==='goal'?/残る誤差/:/単独候補なし/);}
}
function nonnumeric(){
 compactCoach();
 const text=visibleText(r.training).replace(/(?:5|2)軸/g,'');
 assert.doesNotMatch(text,/[0-9０-９%％°µμ]|\bmm\b|\brad\b/);
 for(const el of visibleElements(r.training)){
  const aria=(el.getAttribute('aria-label')||'').replace(/(?:5|2)軸/g,'');assert.doesNotMatch(aria,/[0-9０-９%％°µμ]|\bmm\b|\brad\b/);
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
  assert.doesNotMatch(svg.textContent+svg.getAttribute('aria-label'),/[0-9°µμ]/);
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
loadProfile(0,'standard','new',3587474176);r.coarseExample.click();r.fineAdjust.click();r.fineExample.click();
check('overall finishing can improve while a current pair is farther than initial',()=>{assert.equal(r.fineOverallProgress.getAttribute('data-trend'),'better');const xz=r.liveSquareness.querySelectorAll('svg').find(s=>s.getAttribute('data-pair')==='XZ');assert.equal(xz.getAttribute('data-trend'),'worse');assert.match(r.finePrecisionSummary.textContent,/初期より直角から離れた/);assert.equal(r.fineStatus.getAttribute('data-target'),'true');});
loadProfile(0,'standard','new',4);r.fineAdjust.click();r.fineExample.click();
check('large combined remainder is not blamed only on the machine body',()=>{assert.equal(r.fineStatus.getAttribute('data-target'),'true');assert.equal(r.fineStatus.getAttribute('data-body-significant'),'true');assert.match(r.fineStatus.textContent,/残る誤差/);assert.doesNotMatch(r.fineStatus.textContent,/本体の誤差は残ります/);});
loadProfile(0,'standard','used',36);read('levelConfig.width=20;levelConfig.depth=20;updateLeveling();');r.fineAdjust.click();r.fineExample.click();
read('setSupportHeight(0,supportHeights[0]+.05);');
check('small RMS difference cannot hide significant remaining adjustment',()=>{
 const now=read('machineEvaluation(supportHeights).objective'),best=read('machineReference.best.metric.objective'),gap=Math.sqrt(Math.max(0,now*now-best*best));
 assert(now-best<.1);assert(gap>.1);near(Number(r.fineStatus.getAttribute('data-gap')),gap);assert.equal(r.fineStatus.getAttribute('data-target'),'false');assert.doesNotMatch(r.fineStatus.textContent,/目安内/);
});
for(const [index,mode,condition,heights] of [[2,'','new',[-.097,-.107,-.067,-.077,-.079,-.089]],[3,'long','used',[.036,-.015,.074,.173,-.009,.09]]])check('single-support stagnation is not completed, real reference can help '+index+'/'+condition,()=>{
 const profile=loadProfile(index,mode,condition,42);r.fineAdjust.click();read(`supportHeights=${JSON.stringify(heights)};updateLeveling();`);
 compactCoach();assert(Number(r.fineStatus.getAttribute('data-gap'))>.1);assert.equal(r.fineStatus.getAttribute('data-target'),'false');assert.equal(r.fineHint.getAttribute('data-support'),'');assert.match(r.fineHint.textContent,/複数の支持点/);assert.doesNotMatch(r.fineStatus.textContent,/目安内/);
 const before=read('machineEvaluation(supportHeights).objective');
 for(let i=0;i<heights.length;i++)for(const direction of [-1,1]){const candidate=[...heights];candidate[i]=Math.round((candidate[i]+direction*.001)*1000)/1000;assert(read(`machineEvaluation(${JSON.stringify(candidate)}).objective`)>=before-1e-10);}
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
console.log('Adjustment flow: '+checks+' nonnumeric, actual-improvement, invariant-pair and legacy checks passed.');

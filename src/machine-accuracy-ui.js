'use strict';
let machineProfile=null,machineReference=null,machineSavedBest=null;
function machineLinearKeys(){return axisConfig(current).filter(a=>['X','Y','Z'].includes(a.key)).map(a=>a.key);}
function machineSeed(){
 const values=new Uint32Array(1);
 if(window.crypto&&typeof window.crypto.getRandomValues==='function')window.crypto.getRandomValues(values);
 else values[0]=Math.floor(Math.random()*4294967296);
 if(machineProfile&&values[0]===machineProfile.seed)values[0]=(values[0]+1)>>>0;
 return values[0];
}
function initializeMachineAccuracy(profile,bestState){
 const restored=profile&&window.MachineAccuracy.valid(profile,machineLinearKeys(),supports.length);
 machineProfile=restored?JSON.parse(JSON.stringify(profile)):machineDrawProfile('new');
 machineReference=null;machineSavedBest=restored&&bestState?JSON.parse(JSON.stringify(bestState)):null;
 $('machineCondition').value=machineProfile.condition;
 if(!restored)supportHeights=[...machineProfile.initialHeights];
 levelExercise={solved:false};
}
function machineSolution(heights){
 const points=supports.map((s,i)=>({...levelCoordinates(s.x,s.z),h:heights[i]})),solution=window.Leveling.solve(points,{layout:current.supportLayout});
 // A finite scan can reach the same support boundary through different sums.
 // Canonicalize only roundoff-sized (one picometre) differences so its local
 // posture always uses the solver's existing right/back cell convention.
 // Heights remain continuous and real samples on either side remain distinct.
 if(['horizontal','lathe'].includes(current.kind)){
  const xs=[...new Set(points.map(p=>p.x))],zs=[...new Set(points.map(p=>p.z))],slopeAt=solution.slopeAt;
  const snap=(value,knots)=>knots.find(k=>Math.abs(value-k)<=1e-12)??value;
  solution.slopeAt=(x,z)=>slopeAt(snap(x,xs),snap(z,zs));
 }
 // The interpolating sheet is an input diagram, not an elastic casting. The
 // L3 teaching foundation has a bed and two distinct three-point column seats.
 if(current.kind==='double'&&current.supportLayout==='irregular'){
  solution.parts=Object.fromEntries(['bed','column-left','column-right'].map(group=>[group,window.Leveling.solve(points.filter((p,i)=>supports[i].group===group))]));
 }
 if(current.layoutId==='compact-six-v1')return compactSixSolution(points,solution);
 return current.kind==='compact'?window.Leveling.compactBending(solution,levelConfig.width,levelConfig.depth):solution;
}
// Six-point vertical (compact-six-sag-v1). The four corner bolts seat the bed
// with the compact twist plate. Each middle bolt that departs from that seat
// by r bends the bed front-to-back as a sag mode (1-Z^2), with the share
// compactSixSagShare of r (bed vs bolt stiffness ratio). This share is a
// declared teaching assumption: one middle bolt +0.1 mm gives about 10 µm YZ
// over 300 mm at the axis centre. A support plane (all six on one plane) gives
// r=0, so a rigid tilt never bends the bed. Common seating uses the six-point
// least-squares plane of the solver.
const compactSixSagShare=.5;
function compactSixSolution(points,solution){
 const zs=[...new Set(points.map(p=>p.z))].sort((a,b)=>a-b),xs=[...new Set(points.map(p=>p.x))].sort((a,b)=>a-b),zm=zs[1],a=(xs[1]-xs[0])/2,b=(zs[2]-zs[0])/2,xm=(xs[0]+xs[1])/2;
 const corners=points.filter(p=>p.z!==zm),bent=window.Leveling.compactBending(window.Leveling.solve(corners),levelConfig.width,levelConfig.depth);
 const middle=side=>{const p=points.find(q=>q.z===zm&&q.x===xs[side]);return p.h-bent.heightAt(p.x,p.z);},rL=middle(0),rR=middle(1),k=compactSixSagShare;
 const q=(x,z)=>{const X=(x-xm)/a,Z=(z-zm)/b;return {X,Z,m:k*(rL*(1-X)+rR*(1+X))/2,dm:k*(rR-rL)/(2*a)};};
 const heightAt=(x,z)=>{const s=q(x,z);return bent.heightAt(x,z)+s.m*(1-s.Z*s.Z);};
 const slopeAt=(x,z)=>{const s=q(x,z),base=bent.slopeAt(x,z);return {lr:base.lr+s.dm*(1-s.Z*s.Z),fb:base.fb-2*s.m*s.Z/b};};
 const hessianAt=(x,z)=>{const s=q(x,z),H=bent.hessianAt(x,z);return {xx:H.xx,zz:H.zz-2*s.m/(b*b),xz:H.xz-2*s.dm*s.Z/b};};
 return {...solution,heightAt,slopeAt,hessianAt,bending:{...bent.bending,kind:'corner-ritz-plus-middle-sag',sagShare:k,middleResidual:[rL,rR]}};
}
// Teaching tolerance for every displayed dial value (µm, = 0.02 mm). The
// average level enters with 0.02 mm/m treated like 20 µm.
const machineTolerance=20;
// Fine-adjustment decisions use the dial values at the standard measurement
// position (every axis at its centre), the same position a new draw starts at.
function machineStandardState(){return Object.fromEntries(Object.keys(positions).map(k=>[k,0]));}
// Every leveling-dependent dial value shown on the page, from the same
// measurement functions as the display. No gain or offset is applied.
function machineReadings(heights,profile=machineProfile,state=machineStandardState()){
 const solution=machineSolution(heights),readings=[],add=(key,label,value)=>readings.push({key,label,microns:Number.isFinite(value)?value:null});
 if(current.kind==='lathe'){
  if(typeof latheInspectionGeometry==='function'){const L=latheInspectionGeometry(state,solution,profile);add('face','刃物台X送り',L.face);add('flat','往復台Z送り',L.flat);add('barSide','テストバー側面',L.barSide);add('barTop','テストバー上面',L.barTop);add('dx','穴芯X',L.dx);add('dy','穴芯高さ',L.dy);}
 }else{
  for(const p of geometryModel(state,solution,profile).pairs){const m=referenceScan(p,state,solution,profile);add(p.key,'直角'+p.key,m.valid?m.microns:null);}
  if(current.kind==='horizontal'){const h=horizontalParallelism(state,solution,profile);add('parallelA','Z平行・横',h.a?.microns);add('parallelB','Z平行・縦',h.b?.microns);}
  else if(supportsSpindleSweep()){const w=spindleSweepGeometry(state,solution,profile,1);for(let i=0;i<3;i++)add('sweep'+i,'触れ・'+sweepDirections[i],w.valid&&w.cardinal[i].onTable?w.cardinal[i].readingMicrons:null);}
 }
 return {solution,readings};
}
function machineEvaluation(heights,profile=machineProfile){
 const {solution,readings}=machineReadings(heights,profile),level=[solution.lr*1000,solution.fb*1000];
 const values=[...readings.map(r=>r.microns??0),...level],maxReading=Math.max(0,...readings.map(r=>Math.abs(r.microns??0)));
 return {readings,level,values,objective:window.MachineAccuracy.rms(values),maxReading,maxSquareness:maxReading,worst:Math.max(maxReading,...level.map(Math.abs))};
}
// Linear sensitivity of every value to each support (finite difference about
// level supports). It only steers searches and hints; results are re-evaluated.
let machineLinearCache=null;
function machineLinearModel(profile=machineProfile){
 const key=JSON.stringify([current.id,current.kind,supports.length,levelConfig]);
 if(machineLinearCache?.key===key)return machineLinearCache;
 const zeros=supports.map(()=>0),base=machineEvaluation(zeros,profile).values,step=.05;
 const columns=zeros.map((_,i)=>{const h=[...zeros];h[i]=step;return machineEvaluation(h,profile).values.map((v,j)=>(v-base[j])/step);});
 machineLinearCache={key,matrix:base.map((_,j)=>columns.map(c=>c[j]))};
 return machineLinearCache;
}
function machineBestSearch(profile,start){
 const {matrix}=machineLinearModel(profile);let heights=[...start],metric=machineEvaluation(heights,profile),best={heights,metric};
 for(let round=0;round<3;round++){
  const bias=metric.values.map((v,j)=>v-matrix[j].reduce((sum,q,i)=>sum+q*heights[i],0));
  const next=window.MachineAccuracy.optimize(matrix,bias,heights).heights,nextMetric=machineEvaluation(next,profile);
  if(!(nextMetric.objective<best.metric.objective-1e-9))break;
  best={heights:next,metric:nextMetric};heights=next;metric=nextMetric;
 }
 return best;
}
function findMachineReference(key){
 const zeros=supports.map(()=>0),searched=machineBestSearch(machineProfile,machineProfile.initialHeights);
 const saved=machineSavedBest&&['width','depth','columnX','columnZ'].every(k=>machineSavedBest[k]===levelConfig[k])?[machineSavedBest.heights]:[];
 const candidates=[searched,...[zeros,machineProfile.initialHeights,...saved].map(heights=>({heights:[...heights],metric:machineEvaluation(heights)}))];
 const best=candidates.reduce((a,b)=>a.metric.objective<=b.metric.objective?a:b);
 return {key,initial:machineEvaluation(machineProfile.initialHeights),best};
}
// Draw individuals until one is adjustable: after coarse leveling (a rigid
// plane change, which leaves every dial value unchanged) at least one value
// exceeds 20 µm, and the best support setting brings all of them within 15 µm.
// The accepted seed alone is saved, so a restore regenerates the same profile.
function machineCandidate(condition,seed){
 const profile=window.MachineAccuracy.generate(condition,seed,machineLinearKeys(),supports.length),inspection=window.IntrinsicInspection?.fromProfile(profile);
 const fixed=[...Object.values(profile.guides).map(g=>g.microns),...(inspection?[inspection.runout.rootMicrons,inspection.runout.tipMicrons,inspection.surface.rangeMicrons]:[])];
 if(Math.max(...fixed)>machineTolerance)return {profile,ok:false,score:Infinity};
 const initial=machineEvaluation(profile.initialHeights,profile);
 if(initial.maxReading<=machineTolerance)return {profile,ok:false,score:Infinity};
 const best=machineBestSearch(profile,profile.initialHeights);
 return {profile,ok:best.metric.maxReading<=machineTolerance*.75&&best.metric.worst<=machineTolerance,score:best.metric.worst};
}
function machineDrawProfile(condition){
 const seed=machineSeed();let fallback=null;
 for(let k=0;k<60;k++){const next=(seed+k)>>>0;if(machineProfile&&next===machineProfile.seed)continue;const c=machineCandidate(condition,next);if(c.ok)return c.profile;if(Number.isFinite(c.score)&&(!fallback||c.score<fallback.score))fallback=c;}
 return (fallback||{profile:window.MachineAccuracy.generate(condition,seed,machineLinearKeys(),supports.length)}).profile;
}
// One support, one signed amount: the move that most lowers the largest value
// in the linear model, then confirmed by a full re-evaluation.
function machineFineHint(heights=supportHeights){
 const {matrix}=machineLinearModel(),now=machineEvaluation(heights),worst=v=>Math.max(...v.map(Math.abs));let best=null;
 for(let i=0;i<heights.length;i++)for(let k=-500;k<=500;k++){
  const delta=k/1000,height=Math.round((heights[i]+delta)*1000)/1000;if(!k||Math.abs(height)>.5)continue;
  const values=now.values.map((v,j)=>v+matrix[j][i]*delta),score=worst(values)+1e-4*Math.abs(delta);
  if(!best||score<best.score)best={i,delta,score,predicted:values};
 }
 const label=values=>{const items=[...now.readings.map((r,j)=>({label:r.label,value:values[j]})),{label:'平均の左右傾き',value:values[now.readings.length],level:true},{label:'平均の前後傾き',value:values[now.readings.length+1],level:true}];return items.reduce((a,b)=>Math.abs(b.value)>Math.abs(a.value)?b:a);};
 const current=label(now.values),apply=(i,delta)=>{const next=[...heights];next[i]=Math.round((heights[i]+delta)*1000)/1000;return machineEvaluation(next);};
 if(best&&best.score<worst(now.values)-.5){const after=apply(best.i,best.delta);if(after.worst<now.worst)return {now,current,move:{i:best.i,delta:best.delta,after,worstAfter:after.worst}};}
 // When no single move lowers the largest value, step one support toward the
 // reference setting; several values then fall together in later steps.
 if(machineReference){
  const target=machineBestHeights(),order=heights.map((h,i)=>({i,delta:Math.round((target[i]-h)*1000)/1000})).filter(q=>Math.abs(q.delta)>=.001).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
  for(const q of order){const after=apply(q.i,q.delta);if(after.objective<now.objective-1e-6)return {now,current,move:{i:q.i,delta:q.delta,after,worstAfter:after.worst,towardReference:true}};}
 }
 return {now,current,move:null};
}
function updateMachineAccuracy(){
 if(!machineProfile){$('machineScenario').hidden=true;return null;}
 $('machineScenario').hidden=false;
 const key=JSON.stringify([current.id,current.kind,machineProfile,levelConfig.width,levelConfig.depth,levelConfig.columnX,levelConfig.columnZ]);
 if(!machineReference||machineReference.key!==key)machineReference=findMachineReference(key);
 const metric=machineEvaluation(supportHeights);
 // A manually discovered better result becomes the reference, too.
 if(metric.objective<machineReference.best.metric.objective-1e-8)machineReference.best={heights:[...supportHeights],metric:machineEvaluation(supportHeights)};
 const best=machineReference.best,initial=machineReference.initial;
 // Target: every displayed value and the average level within 0.02 mm.
 const gap=Math.sqrt(Math.max(0,metric.objective**2-best.metric.objective**2)),target=metric.worst<=machineTolerance+1e-6;
 const total=Math.max(.000001,Math.sqrt(Math.max(0,initial.objective**2-best.metric.objective**2)));
 const progress=Math.max(0,Math.min(100,(1-gap/total)*100));
 const condition=machineProfile.condition==='new'?'新品':'中古';
 $('machineIdentity').textContent=condition+'の学習個体です。抽選した本体の固有成分を保持し、支持姿勢の影響を重ねます。';$('machineIdentity').setAttribute('data-seed',String(machineProfile.seed));
 $('guideMetrics').replaceChildren();
 for(const [axis,item] of Object.entries(machineProfile.guides)){
  const row=document.createElement('p');row.className='guide-metric';row.textContent=axis+'ガイド曲がり成分：この個体の固定成分です。';$('guideMetrics').append(row);
 }
 $('intrinsicMetrics').textContent=Object.keys(machineProfile.squareness).join('・')+'の固有直角差を保持しています。初期差の数値は示しません。';
 $('accuracyComparison').replaceChildren();
 const guideMax=Math.max(...Object.values(machineProfile.guides).map(q=>q.microns));
 for(const [label,measure] of [['現在',metric],['参考最良',best.metric]]){
  const row=document.createElement('tr');
  for(const value of [label,cleanNumber(measure.maxSquareness,2),cleanNumber(measure.objective,2),'固定成分']){const cell=document.createElement(row.children.length?'td':'th');if(!row.children.length)cell.setAttribute('scope','row');cell.textContent=value;row.append(cell);}
  $('accuracyComparison').append(row);
 }
 $('machineProgress').textContent=(target?'この個体の参考調整の目安内です。':'この個体の参考調整の目安まで余地があります。')+' 今の直角図と姿勢の変化を確認してください。本体の直角差とガイドの曲がり成分は残る場合があります。';
 const adjustment=machineBestHeights();
 $('applyBestLevel').disabled=adjustment.every((h,i)=>Math.abs(h-supportHeights[i])<.0005);
 const hints=adjustment.map((h,i)=>({i,delta:Math.round((h-supportHeights[i])*1000)/1000})).filter(q=>Math.abs(q.delta)>=.0005);
 const hint=hints.length?hints.map(q=>String.fromCharCode(65+q.i)+'を '+cleanNumber(Math.abs(q.delta),3)+' mm'+(q.delta>0?'上げる':'下げる')).join('、')+'。探索で得た調整例です。':'探索例と同じ支持高さの関係です。一様な高さ変更は不要です。';
 machineSavedBest=machineBestRecord();
 return {target,hint,gap,progress};
}
function machineBestHeights(){
 const heights=machineReference.best.heights;
 // A common height offset changes position, not accuracy. Keep the current
 // common height where the support limits allow it, and recommend only the
 // relative adjustment needed for the reference geometry.
 const average=supportHeights.reduce((sum,h,i)=>sum+(h-heights[i])/heights.length,0);
 const lower=Math.max(...heights.map(h=>-.5-h)),upper=Math.min(...heights.map(h=>.5-h));
 const offset=Math.round(Math.max(lower,Math.min(upper,average))*1000)/1000;
 return heights.map(h=>Math.round((h+offset)*1000)/1000);
}
function machineBestRecord(){
 if(!machineReference)return null;
 return {width:levelConfig.width,depth:levelConfig.depth,columnX:levelConfig.columnX,columnZ:levelConfig.columnZ,heights:[...machineReference.best.heights]};
}
function validMachineBest(record){
 const b=record.bestState;if(b===undefined)return true;
 return b&&typeof b==='object'&&!Array.isArray(b)&&Object.keys(b).length===5&&['width','depth','columnX','columnZ'].every(k=>b[k]===(record[k]??0))&&Array.isArray(b.heights)&&b.heights.length===supports.length&&b.heights.every(h=>bounded(h,-.5,.5)&&Math.abs(h*1000-Math.round(h*1000))<1e-7);
}
function drawMachine(condition){
 stopMotion();invalidateLevelImport();resetAdjustmentProgress();$('adjustStep').value='0.01';adjustmentStage='coarse';
 machineProfile=machineDrawProfile(condition);machineReference=null;machineSavedBest=null;
 supportHeights=[...machineProfile.initialHeights];positions={X:0,Y:0,Z:0,A:0,C:0};updateAxisValues();levelExercise={solved:false};
 $('machineCondition').value=condition;$('levelInputMessage').textContent=(condition==='used'?'中古':'新品')+'の別個体と据付状態を抽選しました。';updateLeveling();
}
$('machineCondition').onchange=()=>drawMachine($('machineCondition').value);
$('drawMachine').onclick=()=>drawMachine($('machineCondition').value);
$('restoreInitialLevel').onclick=()=>{stopMotion();invalidateLevelImport();resetAdjustmentProgress();supportHeights=[...machineProfile.initialHeights];levelExercise={solved:false};$('levelInputMessage').textContent='同じ個体の抽選時の支持高さへ戻しました。寸法・コラム配置・軸位置は現在の設定で比較します。';updateLeveling();};
$('applyBestLevel').onclick=()=>{stopMotion();invalidateLevelImport();updateMachineAccuracy();supportHeights=machineBestHeights();$('levelInputMessage').textContent='探索で得た参考調整を適用しました。本体や支持姿勢に残る誤差も確認してください。';updateLeveling();};

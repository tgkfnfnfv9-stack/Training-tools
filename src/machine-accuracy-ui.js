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
 machineProfile=restored?JSON.parse(JSON.stringify(profile)):window.MachineAccuracy.generate('new',machineSeed(),machineLinearKeys(),supports.length);
 machineReference=null;machineSavedBest=restored&&bestState?JSON.parse(JSON.stringify(bestState)):null;
 $('machineCondition').value=machineProfile.condition;
 if(!restored)supportHeights=[...machineProfile.initialHeights];
 levelExercise={solved:false};
}
function machineSolution(heights){
 const points=supports.map((s,i)=>({...levelCoordinates(s.x,s.z),h:heights[i]})),solution=window.Leveling.solve(points,{layout:current.supportLayout});
 // The interpolating sheet is an input diagram, not an elastic casting. The
 // L3 teaching foundation has a bed and two distinct three-point column seats.
 if(current.kind==='double'&&current.supportLayout==='irregular'){
  solution.parts=Object.fromEntries(['bed','column-left','column-right'].map(group=>[group,window.Leveling.solve(points.filter((p,i)=>supports[i].group===group))]));
 }
 return solution;
}
function machineEvaluation(heights){
 const solution=machineSolution(heights),samples=geometrySamples(solution,machineProfile,window.MachineAccuracy.referenceLength);
 return machineEvaluationFrom(samples,solution);
}
function machineEvaluationFrom(samples,solution){
 const values=[];
 for(const {geometry:g} of samples){
  g.pairs.forEach(p=>values.push(p.deviationMicroradians*.3));
  // Relative posture is a supplementary objective; paired-axis errors take
  // priority. Gate disagreement cannot disappear behind an average frame.
  values.push(g.relativeLean.front*.3*.25,g.relativeLean.right*.3*.25);
  if(g.columns.length===2)values.push((g.columns[1].front-g.columns[0].front)*.3);
 }
 const weight=Math.sqrt(samples.length)*.15;
 values.push(solution.lr*300*weight,solution.fb*300*weight);
 return {values,objective:window.MachineAccuracy.rms(values),maxSquareness:Math.max(...samples.flatMap(s=>s.geometry.pairs.map(p=>Math.abs(p.deviationMicroradians*.3))))};
}
function findMachineReference(key){
 const zeros=supports.map(()=>0),bias=machineEvaluation(zeros).values;
 const columns=zeros.map((_,i)=>{
  const plus=[...zeros],minus=[...zeros];plus[i]=.05;minus[i]=-.05;
  const a=machineEvaluation(plus).values,b=machineEvaluation(minus).values;
  return a.map((v,j)=>(v-b[j])/.1);
 });
 const matrix=bias.map((_,i)=>columns.map(c=>c[i]));
 const searched=window.MachineAccuracy.optimize(matrix,bias,machineProfile.initialHeights);
 const saved=machineSavedBest&&['width','depth','columnX','columnZ'].every(k=>machineSavedBest[k]===levelConfig[k])?[machineSavedBest.heights]:[];
 const candidates=[searched.heights,zeros,machineProfile.initialHeights,...saved].map(heights=>({heights:[...heights],metric:machineEvaluation(heights)}));
 const best=candidates.reduce((a,b)=>a.metric.objective<=b.metric.objective?a:b);
 return {key,initial:machineEvaluation(machineProfile.initialHeights),best};
}
function updateMachineAccuracy(){
 if(!machineProfile){$('machineScenario').hidden=true;return null;}
 $('machineScenario').hidden=false;
 const key=JSON.stringify([current.id,current.kind,machineProfile,levelConfig.width,levelConfig.depth,levelConfig.columnX,levelConfig.columnZ]);
 if(!machineReference||machineReference.key!==key)machineReference=findMachineReference(key);
 const metric=machineEvaluationFrom(accuracyRange,levelSolution);
 // A manually discovered better result becomes the reference, too.
 if(metric.objective<machineReference.best.metric.objective-1e-8)machineReference.best={heights:[...supportHeights],metric:machineEvaluation(supportHeights)};
 const best=machineReference.best,initial=machineReference.initial;
 const gap=Math.sqrt(Math.max(0,metric.objective**2-best.metric.objective**2)),target=gap<=.1;
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
 machineProfile=window.MachineAccuracy.generate(condition,machineSeed(),machineLinearKeys(),supports.length);machineReference=null;machineSavedBest=null;
 supportHeights=[...machineProfile.initialHeights];positions={X:0,Y:0,Z:0,A:0,C:0};updateAxisValues();levelExercise={solved:false};
 $('machineCondition').value=condition;$('levelInputMessage').textContent=(condition==='used'?'中古':'新品')+'の別個体と据付状態を抽選しました。';updateLeveling();
}
$('machineCondition').onchange=()=>drawMachine($('machineCondition').value);
$('drawMachine').onclick=()=>drawMachine($('machineCondition').value);
$('restoreInitialLevel').onclick=()=>{stopMotion();invalidateLevelImport();resetAdjustmentProgress();supportHeights=[...machineProfile.initialHeights];levelExercise={solved:false};$('levelInputMessage').textContent='同じ個体の抽選時の支持高さへ戻しました。寸法・コラム配置・軸位置は現在の設定で比較します。';updateLeveling();};
$('applyBestLevel').onclick=()=>{stopMotion();invalidateLevelImport();updateMachineAccuracy();supportHeights=machineBestHeights();$('levelInputMessage').textContent='探索で得た参考調整を適用しました。本体や支持姿勢に残る誤差も確認してください。';updateLeveling();};

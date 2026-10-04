'use strict';
// Geometry lesson: sampled support slopes are assumed to set each rigid assembly's
// posture. This is deliberately separate from an elastic/load model of a machine.
const singleColumnKinds=['vertical','compact','travel','horizontal','five'];
let accuracyKey='',accuracyRangeKey='',accuracyRange=null,levelInitialGeometry=null,levelInitialSolution=null;
let visualReferenceKey='',visualReferenceFactor=1;
function scaledAccuracyProfile(profile,factor){
 return profile?{squareness:Object.fromEntries(Object.entries(profile.squareness).map(([pair,item])=>[pair,{microns:item.microns*factor}]))}:null;
}
// A representative column/spindle direction provides a rigid body pose. It is
// derived from the existing individual, rather than drawing another defect.
// The nonorthogonal NC directions remain separate for precision and arrows.
function intrinsicBodyFrame(axes,profile,factor=1){
 const axis=axes.find(a=>Math.abs(a.vector[1])===1)||axes.find(a=>a.key==='Z');
 const direction=window.MachineAccuracy.directions(axes,scaledAccuracyProfile(profile,factor)).find(a=>a.key===axis.key).vector;
 const from=axis.vector,to=direction,cross=[from[1]*to[2]-from[2]*to[1],from[2]*to[0]-from[0]*to[2],from[0]*to[1]-from[1]*to[0]],squared=cross.reduce((s,v)=>s+v*v,0),cosine=from.reduce((s,v,i)=>s+v*to[i],0);
 const rotate=v=>{
  if(squared<1e-24)return [...v];
  const dot=cross.reduce((s,q,i)=>s+q*v[i],0),turn=[cross[1]*v[2]-cross[2]*v[1],cross[2]*v[0]-cross[0]*v[2],cross[0]*v[1]-cross[1]*v[0]];
  return v.map((q,i)=>q*cosine+turn[i]+cross[i]*dot*(1-cosine)/squared);
 };
 return {axisKey:axis.key,nominal:from,direction,rotate};
}
function directionLean(up){return {front:Math.atan2(-up[2],up[1])*1e6,right:Math.atan2(up[0],up[1])*1e6};}
function spindleLean(direction){return {front:Math.atan2(direction[1],Math.hypot(direction[0],direction[2]))*1e6,right:Math.atan2(direction[2],direction[0])*1e6};}
function columnLayoutOffset(m){
 if(!levelConfig||!singleColumnKinds.includes(m.kind))return {x:0,z:0};
 return {x:m.w*.2*levelConfig.columnX/100,z:m.d*.1*levelConfig.columnZ/100};
}
function geometryModel(state=positions,solution=levelSolution,profile=machineProfile,length=levelConfig.offset){
 const m=current,W=m.w,D=m.d,layout=columnLayoutOffset(m),move=(key)=>{const a=axisConfig(m).find(v=>v.key===key);return a?a.amp*state[key]/100:0;};
 let toolPoints,workPoint,toolAxes;
 if(['vertical','compact','five','portal'].includes(m.kind)){
  const gate=m.kind==='portal',cz=D*(gate?.24:m.kind==='five'?.3:.29);
  toolPoints=gate?[-1,1].map(k=>({x:k*W*.4,z:cz})):[{x:layout.x,z:cz+layout.z}];
  workPoint={x:move('X'),z:(gate?0:m.kind==='five'?-.45:-D*.1)+move('Y')};toolAxes=['Z'];
 }else if(m.kind==='travel'){
  toolPoints=[{x:-.5+move('X')+layout.x,z:D*.29+layout.z}];workPoint={x:0,z:-D*.18};toolAxes=['Y','Z'];
 }else if(m.kind==='horizontal'){
  toolPoints=[{x:move('X')+layout.x,z:D*.29+layout.z}];workPoint={x:0,z:-.85+move('Z')};toolAxes=['X','Y'];
 }else if(['double','gantry'].includes(m.kind)){
  toolPoints=[-1,1].map(k=>({x:k*W*.4,z:m.kind==='gantry'?move('X'):0}));
  workPoint={x:0,z:m.kind==='double'?move('X'):0};toolAxes=['Y','Z'];
 }else{
  toolPoints=[{x:-W*.35,z:0}];workPoint={x:.08+move('Z'),z:-.58+move('X')};toolAxes=['Z'];
 }
 const axes=axisConfig(m).filter(a=>['X','Y','Z'].includes(a.key)).map(a=>({key:a.key,vector:a.vector,source:toolAxes.includes(a.key)?'tool':'work'}));
 const intrinsicAxes=window.MachineAccuracy.directions(axes,profile);
 const options={toolPoints:toolPoints.map(p=>levelCoordinates(p.x,p.z)),workPoints:[levelCoordinates(workPoint.x,workPoint.z)],axes:intrinsicAxes,length};
 const metric=window.Leveling.geometry(solution,options);
 const levelPairs=profile?window.Leveling.geometry(solution,{...options,axes}).pairs:metric.pairs;
 const average=points=>({x:points.reduce((s,p)=>s+p.x/points.length,0),z:points.reduce((s,p)=>s+p.z/points.length,0)});
 const poses={tool:{anchor:average(toolPoints),slope:metric.toolSlope},work:{anchor:workPoint,slope:metric.workSlope}};
 if(toolPoints.length===2)toolPoints.forEach((p,i)=>{const q=levelCoordinates(p.x,p.z);poses[i?'rightColumn':'leftColumn']={anchor:p,slope:solution.slopeAt(q.x,q.z)};});
 const bodyFrame=intrinsicBodyFrame(axes,profile),intrinsicUp=bodyFrame.rotate([0,1,0]),combinedUp=metric.toolFrame.rotate(intrinsicUp),combinedDirection=metric.toolFrame.rotate(bodyFrame.direction);
 const bodyLean=directionLean(combinedUp),bodyIntrinsicLean=directionLean(intrinsicUp),bodyColumns=toolPoints.map(p=>{const q=levelCoordinates(p.x,p.z);return directionLean(window.Leveling.orientation(solution.slopeAt(q.x,q.z)).rotate(intrinsicUp));});
 const lathe=m.kind==='lathe',bodyPosture=lathe?spindleLean(combinedDirection):bodyLean,bodyIntrinsicPosture=lathe?spindleLean(bodyFrame.direction):bodyIntrinsicLean,bodySupportPosture=lathe?spindleLean(metric.toolFrame.rotate(bodyFrame.nominal)):directionLean(metric.toolFrame.rotate([0,1,0]));
 return {...metric,poses,toolPoints,workPoint,axes:intrinsicAxes,levelPairs,bodyLean,bodyColumns,bodyIntrinsicLean,bodyPosture,bodyIntrinsicPosture,bodySupportPosture,bodyIntrinsicDirection:bodyFrame.direction,bodyCombinedDirection:combinedDirection};
}
function geometrySamples(solution=levelSolution,profile=machineProfile,length=levelConfig.offset){
 const keys=axisConfig(current).filter(a=>['X','Y','Z'].includes(a.key)).map(a=>a.key);
 let states=[{X:0,Y:0,Z:0,A:0,C:0}];
 for(const key of keys)states=states.flatMap(state=>[-100,0,100].map(value=>({...state,[key]:value})));
 return states.map(state=>({state,geometry:geometryModel(state,solution,profile,length)}));
}
function fixedVisualFactor(initialSolution){
 const key=JSON.stringify([current.id,current.kind,current.w,current.d,levelConfig.width,levelConfig.depth,levelConfig.columnX,levelConfig.columnZ,machineProfile]);
 if(key===visualReferenceKey)return visualReferenceFactor;
 visualReferenceKey=key;
 const initial=geometrySamples(initialSolution||machineSolution(supports.map(()=>0))),initialMaximum=Math.max(.001,...initial.flatMap(s=>Object.values(s.geometry.poses).map(p=>Math.hypot(p.slope.lr,p.slope.fb))));
 // Local support gradients are linear in the support heights. Their coefficient
 // absolute sums bound every allowed +/-0.500 mm adjustment, including travel.
 const basisSolutions=supports.map((_,i)=>machineSolution(supports.map((s,j)=>i===j?1:0))),coefficients=basisSolutions.map(s=>geometrySamples(s,null));
 let allowedMaximum=Math.max(.001,Math.hypot(basisSolutions.reduce((s,q)=>s+Math.abs(q.lr)*.5,0),basisSolutions.reduce((s,q)=>s+Math.abs(q.fb)*.5,0)));
 for(let i=0;i<initial.length;i++)for(const pose of Object.keys(initial[i].geometry.poses)){
  const lr=coefficients.reduce((s,list)=>s+Math.abs(list[i].geometry.poses[pose].slope.lr)*.5,0),fb=coefficients.reduce((s,list)=>s+Math.abs(list[i].geometry.poses[pose].slope.fb)*.5,0);
  allowedMaximum=Math.max(allowedMaximum,Math.hypot(lr,fb));
 }
 const intrinsicAngle=machineProfile?Math.max(...Object.values(machineProfile.squareness).map(q=>Math.abs(q.microns)/300000)):.000001;
 visualReferenceFactor=Math.min(1000,200/Math.max(initialMaximum,allowedMaximum),.15/Math.max(intrinsicAngle,.000001));
 return visualReferenceFactor;
}
function signed(value,d=1){const text=cleanNumber(value,d);return (value>0&&Number(text)!==0?'+':'')+text;}
function changeNumber(value,d=2){
 if(Math.abs(value)<1e-8)return cleanNumber(0,d);
 let digits=d;while(value!==0&&Number(cleanNumber(value,digits))===0&&digits<6)digits++;
 return value!==0&&Number(cleanNumber(value,digits))===0?(value>0?'＋':'−')+'表示桁未満':signed(value,digits);
}
function accuracyChange(before,current){
 const delta=current-before,absoluteChange=Math.abs(current)-Math.abs(before),trend=absoluteChange<-.005?'better':absoluteChange>.005?'worse':'similar';
 return {delta,absoluteChange,trend,text:trend==='better'?'初期より直角に近づいた':trend==='worse'?'初期より直角から離れた':'初期からほぼ同じ'};
}
function leanDescription(value,negative,positive){return Math.abs(value)<.00001?'倒れは表示桁未満':(value>0?positive:negative)+' '+cleanNumber(Math.abs(value),2)+' µrad';}
function postureComparison(id,rows,unit,digits=2){
 const box=$(id);box.hidden=!levelInitialGeometry;box.replaceChildren();if(!levelInitialGeometry)return;
 for(const row of rows){
  const p=document.createElement('p');p.className='posture-comparison-row';
  p.setAttribute('data-metric',row.key);p.setAttribute('data-before',String(row.before));p.setAttribute('data-current',String(row.current));p.setAttribute('data-delta',String(row.current-row.before));
  p.textContent=row.label+'：現在 '+signed(row.current,digits)+' '+unit;box.append(p);
 }
}
// Each pair is a two-dimensional relative-angle comparison, independent of
// camera rotation. The fixed gain makes support adjustments comparable.
const squarenessDiagramGain=5000,squarenessDiagramLimit=.65,squarenessMeasurementLength=.3;
function squarenessPlot(pair){
 const base=current.kind==='lathe'?'Z':pair.key[0],other=[...pair.key].find(key=>key!==base),raw=pair.deviationMicroradians/1e6*squarenessDiagramGain;
 const angle=Math.max(-squarenessDiagramLimit,Math.min(squarenessDiagramLimit,raw)),x=32,y=54,length=28;
 return {base,other,angle,gain:squarenessDiagramGain,limited:Math.abs(raw)>squarenessDiagramLimit,origin:[x,y],tip:[x-length*Math.sin(angle),y-length*Math.cos(angle)]};
}
function squarenessMarkup(pair,plot,beforePlot){
 const [x,y]=plot.origin,[tx,ty]=plot.tip,[bx,by]=beforePlot.tip,changed=Math.abs(pair.deviationMicroradians-beforePlot.deviation)>1e-6;
 const ux=(tx-x)/28,uy=(ty-y)/28;
 return `<path d="M${x},26V${y}H88" fill="none" stroke="#81949d" stroke-width="1" stroke-dasharray="3 3" class="pair-ideal"/><line x1="${x}" y1="${y}" x2="88" y2="${y}" stroke="${axisColors[plot.base]}" stroke-width="2" class="pair-base"/>${changed?`<path d="M${x},${y}L${bx},${by}L${tx},${ty}Z" fill="${axisColors[plot.other]}" class="pair-change-area"/>`:''}<line x1="${x}" y1="${y}" x2="${bx}" y2="${by}" stroke="${axisColors[plot.other]}" stroke-width="4" class="pair-before"/><line x1="${x}" y1="${y}" x2="${tx}" y2="${ty}" stroke="${axisColors[plot.other]}" stroke-width="2.5" class="pair-current"/><path d="M${tx},${ty}H60V24" fill="none" stroke="#71828b" stroke-width=".8" class="measurement-end-guide"/><line x1="${x}" y1="26" x2="${tx}" y2="${ty}" stroke="#536776" stroke-width="1.4" class="measurement-gap"/><circle cx="${x}" cy="26" r="2.8" fill="white" stroke="#81949d" stroke-width="1" class="measurement-ideal-tip"/><path d="M${tx-4*ux-2*uy},${ty-4*uy+2*ux}L${tx},${ty}L${tx-4*ux+2*uy},${ty-4*uy-2*ux}" fill="none" stroke="${axisColors[plot.other]}" stroke-width="1.4" class="measurement-direction"/><circle cx="${tx}" cy="${ty}" r="1.8" fill="${axisColors[plot.other]}" class="measurement-current-tip"/><circle cx="${x}" cy="${y}" r="2.3" fill="#536776" class="measurement-origin"/><text x="22" y="58" text-anchor="end" class="measurement-start">0</text><text x="61" y="21" class="measurement-end">300 mm</text><text x="95" y="58" fill="${axisColors[plot.base]}" class="pair-axis">${plot.base}</text><text x="${tx}" y="${ty-4}" fill="${axisColors[plot.other]}" text-anchor="middle" class="pair-axis">${plot.other}</text>`;
}
function diagramComparison(pair,initial){
 const before=initial?.pairs.find(p=>p.key===pair.key)||pair,plot=squarenessPlot(pair),beforePlot={...squarenessPlot(before),deviation:before.deviationMicroradians};
 const delta=pair.deviationMicroradians-before.deviationMicroradians,absoluteChange=Math.abs(pair.deviationMicroradians)-Math.abs(before.deviationMicroradians),epsilon=.005/(levelConfig?.offset||.5);
 const trend=absoluteChange < -epsilon?'better':absoluteChange>epsilon?'worse':'similar',direction=Math.abs(delta)<=1e-6?'unchanged':delta>0?'opened':'closed';
 const text=trend==='better'?'初期より直角に近づいた':trend==='worse'?'初期より直角から離れた':'初期からほぼ同じ';
 const range=plot.limited&&beforePlot.limited?'初期・現在が図の範囲外':plot.limited?'現在が図の範囲外':beforePlot.limited?'初期が図の範囲外':'';
 return {before,plot,beforePlot,delta,absoluteChange,trend,direction,text,range};
}
function accuracyDiagram(g,initial=levelInitialGeometry){
 const live=[];
 const columns=g.pairs.map((pair,i)=>{
  const c=diagramComparison(pair,initial),{plot,beforePlot}=c;
  const description=pair.key+'、基準'+plot.base+'。'+(pair.deviationMicroradians>0?'直角より広い':pair.deviationMicroradians<0?'直角より狭い':'直角')+'。測る軸'+plot.other+'を共通の合わせ始点から比較終点へ伸ばし、理想の直角との終点差を見る模式図。'+c.text+(c.direction==='unchanged'?'。軸間の変化はほぼありません':c.direction==='opened'?'。初期から広がる方向へ変化':'。初期から狭まる方向へ変化')+(c.range?'。'+c.range:'');
  // This fixed comparison length describes the local angle only. It does not
  // change the engine's evaluation length or simulate an NC travel/guide scan.
  const attributes=Object.entries({pair:pair.key,base:plot.base,other:plot.other,'measure-axis':plot.other,'measure-start':'0,0','measurement-length-m':squarenessMeasurementLength,'ideal-tip-x':plot.origin[0],'ideal-tip-y':26,'before-error-300':c.before.deviationMicroradians*squarenessMeasurementLength,'current-error-300':pair.deviationMicroradians*squarenessMeasurementLength,'delta-error-300':c.delta*squarenessMeasurementLength,gain:plot.gain,deviation:pair.deviationMicroradians,before:c.before.deviationMicroradians,current:pair.deviationMicroradians,delta:c.delta,trend:c.trend,direction:c.direction,limited:plot.limited,'before-limited':beforePlot.limited,'any-limited':plot.limited||beforePlot.limited,'origin-x':plot.origin[0],'origin-y':plot.origin[1],'tip-x':plot.tip[0],'tip-y':plot.tip[1],'before-tip-x':beforePlot.tip[0],'before-tip-y':beforePlot.tip[1]}).map(([name,value])=>`data-${name}="${value}"`).join(' ');
  const markup=squarenessMarkup(pair,plot,beforePlot)+(c.range?'<text x="110" y="43" text-anchor="end" class="live-pair-limit">範囲外</text>':'<text x="80" y="43" text-anchor="middle" class="right-angle">直角</text>');
  live.push(`<div class="live-squareness-item"><span class="live-pair-title">${pair.key} 基準${plot.base}</span><svg class="live-squareness-diagram" viewBox="0 8 112 54" role="img" aria-label="${description}" aria-describedby="squarenessMeasurementNote" ${attributes}>${markup}</svg></div>`);
  return `<g transform="translate(${i*112},0)" ${attributes}><text x="56" y="14" text-anchor="middle" class="pair-title">${pair.key} 基準${plot.base}</text><g transform="translate(0,15)">${markup}</g></g>`;
 });
 $('liveSquareness').innerHTML=live.join('');
 $('accuracyDiagram').style.setProperty('--diagram-min-width',g.pairs.length*88+'px');
 $('accuracyDiagram').setAttribute('viewBox',`0 0 ${g.pairs.length*112} 79`);$('accuracyDiagram').innerHTML=columns.join('');
 $('accuracyDiagram').setAttribute('aria-label',g.pairs.map(p=>p.key+'、基準'+squarenessPlot(p).base+'で直角と初期からの変化を比較').join('。'));
}
function updateFineQualitative(g,initial){
 const lathe=current.kind==='lathe';
 for(const [key,id,negative,positive,label] of [['front','fineLeanFront',lathe?'下向き':'後ろ倒れ',lathe?'上向き':'前倒れ',lathe?'主軸の上下方向':'本体＋支持の前後倒れ'],['right','fineLeanRight',lathe?'左向き':'左倒れ',lathe?'右向き':'右倒れ',lathe?'主軸の水平面方向':'本体＋支持の左右倒れ']]){
  const value=g.bodyPosture[key];$(id).textContent=label+'：'+(Math.abs(value)<=20.000001?'小さめ':value>0?positive:negative);$(id).setAttribute('data-current',String(value));
 }
 const twist=levelSolution.twist;$('fineTwist').textContent='支持面のねじれ：'+(supports.length===3?'この支持配置は平面です':Math.abs(twist)<=.020000001?'小さめ':twist>0?'奥が手前より右高':'奥が手前より左高');$('fineTwist').setAttribute('data-current',String(twist));
 $('fineFixedBody').textContent='本体の固有直角差・'+(lathe?'主軸の方向':'コラムの倒れ')+'・ガイドの曲がりは、この個体の固定成分です。支持姿勢を重ねた変化を見ます。';
 $('finePrecisionSummary').replaceChildren();
 for(const pair of g.pairs){
  const c=diagramComparison(pair,initial),row=document.createElement('p');row.className='fine-pair-reading '+c.trend;
  for(const [name,value] of Object.entries({pair:pair.key,before:c.before.deviationMicroradians,current:pair.deviationMicroradians,delta:c.delta,trend:c.trend,direction:c.direction}))row.setAttribute('data-'+name,String(value));
  row.textContent=pair.key+'：'+c.text+(c.direction==='unchanged'?'（軸間の関係はほぼ不変）':'')+(c.range?' · '+c.range:'');$('finePrecisionSummary').append(row);
 }
}
function updateAccuracy(){
 if(!levelSolution||!levelConfig)return;
 const rangeKey=JSON.stringify([current.id,current.kind,supportHeights,levelConfig,machineProfile]);
 const key=rangeKey+JSON.stringify([positions.X,positions.Y,positions.Z]);
 if(key===accuracyKey&&levelGeometry)return;
 accuracyKey=key;
 if(rangeKey!==accuracyRangeKey||!accuracyRange){accuracyRangeKey=rangeKey;accuracyRange=geometrySamples();}
 const g=geometryModel();
 // The comparison is pointwise: both states use the current axis position,
 // dimensions, layout and evaluation length. The reference-search aggregate
 // is deliberately not used for this initial/current comparison.
 levelInitialSolution=machineProfile?machineSolution(machineProfile.initialHeights):null;
 levelInitialGeometry=levelInitialSolution?geometryModel(positions,levelInitialSolution,machineProfile,levelConfig.offset):null;
 const initial=levelInitialGeometry;
 g.visualFactor=fixedVisualFactor(levelInitialSolution);levelGeometry=g;
 const lengthMm=Math.round(levelConfig.offset*1000),maxError=Math.max(...g.pairs.map(p=>Math.abs(p.errorMicrons)));
 $('accuracyLength').textContent=lengthMm+' mmで確認';
 $('comparisonContext').hidden=!initial;
 if(initial)$('comparisonContext').textContent=(machineProfile.condition==='new'?'新品':'中古')+'個体 #'+machineProfile.seed+'：初期の差は数値で示しません。今の軸位置、寸法、コラム配置、評価長で現在の精度を確認します。';
 const columnDifference=g.columns.length===2?Math.abs(g.columns[1].front-g.columns[0].front):0;
 $('geometryStatus').textContent=g.pairs.map(p=>p.key+' '+diagramComparison(p,initial).text).join(' ／ ');
 $('accuracyMetrics').replaceChildren();
 for(const p of g.pairs){
  const samples=accuracyRange.map(s=>s.geometry.pairs.find(q=>q.key===p.key).errorMicrons),low=Math.min(...samples),high=Math.max(...samples),box=document.createElement('div');
  const before=initial?.pairs.find(q=>q.key===p.key),change=before?accuracyChange(before.errorMicrons,p.errorMicrons):null;
  box.className='accuracy-metric'+(change?.trend==='worse'?' changed':change?.trend==='better'?' improved':'');
  const label=document.createElement('span'),value=document.createElement('strong'),angle=document.createElement('small'),travel=document.createElement('small');
  label.textContent=current.kind==='lathe'?'主軸Z基準–X方向':p.key+' 直角度';value.textContent=signed(p.errorMicrons,2)+' µm';
  value.setAttribute('id','accuracy-current-'+p.key);value.setAttribute('data-value',String(p.errorMicrons));
  angle.textContent=cleanNumber(p.angleDegrees,6)+'° · 90°との差';travel.textContent='端・中央の比較 '+signed(low,2)+' 〜 '+signed(high,2)+' µm';box.append(label,value);
  if(before){
   const baseline=document.createElement('small'),delta=document.createElement('small'),trend=document.createElement('small');
   baseline.setAttribute('id','accuracy-before-'+p.key);baseline.setAttribute('data-value',String(before.errorMicrons));baseline.hidden=true;
   delta.setAttribute('id','accuracy-delta-'+p.key);delta.setAttribute('data-value',String(change.delta));delta.className='accuracy-delta';delta.hidden=true;
   trend.setAttribute('id','accuracy-trend-'+p.key);trend.setAttribute('data-trend',change.trend);trend.setAttribute('data-absolute-change',String(change.absoluteChange));trend.className='accuracy-trend '+change.trend;trend.textContent=change.text;
   box.append(baseline,delta,trend);
  }
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='角度・端/中央';details.className='accuracy-detail';details.append(summary,angle,travel);
  if(machineProfile){const split=document.createElement('small');split.textContent='本体の固有成分と支持姿勢を重ねた現在の測定値です。';details.append(split);}
  box.append(details);$('accuracyMetrics').append(box);
 }
 const lathe=current.kind==='lathe',postureLabels=lathe?['主軸の上下方向差','主軸の水平面方向差']:['前後倒れ','左右倒れ'];
 $('bodyLeanHeading').textContent=lathe?'主軸の方向：本体＋支持姿勢':'コラムの倒れ：本体＋支持姿勢';
 $('bodyLeanValues').replaceChildren();
 for(const [i,key] of ['front','right'].entries()){
  const row=document.createElement('p');row.className='body-lean-row';row.setAttribute('data-metric',key);
  for(const [name,value] of [['intrinsic',g.bodyIntrinsicPosture[key]],['support',g.bodySupportPosture[key]],['combined',g.bodyPosture[key]]])row.setAttribute('data-'+name,String(value));
  row.textContent=postureLabels[i]+'：現在 '+signed(g.bodyPosture[key],2)+' µrad';$('bodyLeanValues').append(row);
 }
 postureComparison('bodyLeanComparison',initial?['front','right'].map((key,i)=>({key,label:postureLabels[i],before:initial.bodyPosture[key],current:g.bodyPosture[key]})):[],'µrad');
 $('bodyLeanNote').textContent=lathe?'固有XZ差は水平面内の主軸の方向ずれです。主軸方向に支持姿勢を重ねた模式表示で、コラムの鉛直倒れとは区別します。':'本体は抽選した固有直角差から求めたコラムの代表方向、支持はこの位置の据付姿勢です。合成は両方を回転として重ねた実値です。平均レベルが揃っても本体の倒れは残ります。';
 $('columnLean').textContent=lathe?'上下 '+signed(g.bodyPosture.front,2)+' µrad ／ 水平面 '+signed(g.bodyPosture.right,2)+' µrad':leanDescription(g.bodyLean.front,'後ろ倒れ','前倒れ')+' ／ '+leanDescription(g.bodyLean.right,'左倒れ','右倒れ');
 $('relativeLean').textContent='前後 '+signed(g.relativeLean.front,2)+' µrad ／ 左右 '+signed(g.relativeLean.right,2)+' µrad';
 const dual=g.columns.length===2;$('columnDifference').hidden=!dual;
 $('postureHeading').textContent=current.kind==='lathe'?'支持による主軸台の倒れとねじれ':dual?'支持による左右コラムの倒れとねじれ':'支持によるコラムの倒れとねじれ';
 $('demoColumn').textContent=current.kind==='lathe'?'主軸台の姿勢を見る':'コラムの倒れを見る';
 if(dual)$('columnDifference').textContent='支持による左コラム：'+leanDescription(g.columns[0].front,'後ろ倒れ','前倒れ')+' ／ 右コラム：'+leanDescription(g.columns[1].front,'後ろ倒れ','前倒れ')+'。支持による左右の前後倒れ差 '+cleanNumber(Math.abs(g.columns[1].front-g.columns[0].front),2)+' µrad';
 postureComparison('columnLeanComparison',initial?[
  {key:'front',label:'支持による前後倒れ',before:initial.toolLean.front,current:g.toolLean.front},
  {key:'right',label:'支持による左右倒れ',before:initial.toolLean.right,current:g.toolLean.right}
 ]:[],'µrad');
 postureComparison('relativeLeanComparison',initial?[
  {key:'front',label:'支持による案内との前後姿勢差',before:initial.relativeLean.front,current:g.relativeLean.front},
  {key:'right',label:'支持による案内との左右姿勢差',before:initial.relativeLean.right,current:g.relativeLean.right}
 ]:[],'µrad');
 postureComparison('columnDifferenceComparison',initial&&dual?[{key:'frontDifference',label:'門の前後倒れ差（右−左）',before:initial.columns[1].front-initial.columns[0].front,current:g.columns[1].front-g.columns[0].front}]:[],'µrad');
 $('columnDifferenceComparison').hidden=!initial||!dual;
 postureComparison('twistComparison',initial?[{key:'twist',label:'支持面のねじれ（奥−手前）',before:levelInitialSolution.twist,current:levelSolution.twist}]:[],'mm/m',6);
 if(initial&&supports.length===3){const note=document.createElement('p');note.className='hint';note.textContent='3点支持モデルは必ず平面なので、ねじれは常に0です。倒れの変化を見比べます。';$('twistComparison').append(note);}
 const coordinates=p=>{const q=levelCoordinates(p.x,p.z);return '左右 '+signed(q.x,2)+' m・前後 '+signed(q.z,2)+' m';};
 $('geometryPosition').textContent=(dual?'門中心':current.kind==='lathe'?'主軸台':'コラム')+'：'+coordinates(g.poses.tool.anchor)+' ／ '+(current.kind==='lathe'?'刃物台':'テーブル基準')+'：'+coordinates(g.workPoint);
 const rangeMax=Math.max(...accuracyRange.flatMap(s=>s.geometry.pairs.map(p=>Math.abs(p.errorMicrons))));
 const postureDifference=Math.hypot(g.relativeLean.front,g.relativeLean.right);
 $('accuracyDiagnosis').textContent=initial?(dual?'支持点を少し動かし、直角図と左右コラムの変化を見比べてください。':'支持点を少し動かし、固定表示の直角図と現在の倒れ・ねじれを見比べてください。')+' 90°からのずれの大小は絶対値で判断し、倒れの減少だけで全精度の改善とはしません。':columnDifference>.001?'左右コラムが違う姿勢です。平均の直角度だけでは門のねじれを見落とすため、左右の前後倒れ差も確認してください。':maxError<.00001?(rangeMax>.001?'今の位置では直角です。端・中央の比較では直角度が変わります。軸を動かして確認してください。':postureDifference>.001?'表示した軸間の直角差は0ですが、工具側とテーブル側の姿勢差は残っています。前後・左右の姿勢差も確認してください。':'工具側と案内側が同じ姿勢です。全体が傾いても、相対直角度は保たれています。'):'支持面の局所姿勢が違うため、直角度が変化しています。支持点を調整して、端・中央の値を比べてください。';
 const localSource=key=>g.axes.filter(a=>a.source===key).map(a=>a.key).join('・');
 $('geometryAssumption').textContent=current.kind==='lathe'?'主軸台のZ方向と刃物台側のX方向を比べる教材です。Y軸はありません。':localSource('tool')+'はコラム／主軸側、'+localSource('work')+'はテーブル／案内側の参照姿勢を使う教材です。同じ剛体側の軸対は共通の傾きでは関係が変わりません。'+(current.kind==='five'?'A/Cの旋回誤差は含みません。':'');
 $('columnLayout').hidden=!singleColumnKinds.includes(current.kind);
 $('columnXValue').textContent=levelConfig.columnX===0?'標準':levelConfig.columnX<0?'左寄り':'右寄り';$('columnX').setAttribute('aria-valuetext',$('columnXValue').textContent);
 $('columnZValue').textContent=levelConfig.columnZ===0?'標準':levelConfig.columnZ<0?'手前寄り':'奥寄り';$('columnZ').setAttribute('aria-valuetext',$('columnZValue').textContent);
 $('demoTwist').disabled=supports.length===3;
 accuracyDiagram(g,initial);updateFineQualitative(g,initial);
}
for(const id of ['columnX','columnZ'])$(id).oninput=()=>{const value=Number($(id).value);if(!bounded(value,-100,100)||!Number.isInteger(value))return;stopMotion();levelConfig[id]=value;updateLeveling();};
$('resetColumn').onclick=()=>{stopMotion();levelConfig.columnX=0;levelConfig.columnZ=0;$('columnX').value='0';$('columnZ').value='0';updateLeveling();};
$('demoTwist').onclick=()=>{
 if(supports.length===3)return;stopMotion();applyLevelPreset('twist');
 const preferred=current.kind==='vertical'||current.kind==='compact'?'YZ':null;
 const score=s=>Math.max(...s.geometry.pairs.filter(p=>!preferred||p.key===preferred).map(p=>Math.abs(p.errorMicrons)));
 const best=accuracyRange.reduce((a,b)=>score(a)>=score(b)?a:b);positions={...best.state};updateAxisValues();
 $('levelInputMessage').textContent=score(best)>.001?'対角ねじれを設定し、直角度の差が出る軸位置へ動かしました。':'対角ねじれを設定しました。左右コラムの姿勢差を確認してください。';updateLeveling();
};
$('demoColumn').onclick=()=>{
 stopMotion();positions={X:0,Y:0,Z:0,A:0,C:0};updateAxisValues();
 const rear=Math.max(...supports.map(s=>s.z)),index=supports.findIndex(s=>s.z===rear);
 supportHeights=supports.map((s,i)=>i===index?.3:0);levelExercise=null;
 if(singleColumnKinds.includes(current.kind)){levelConfig.columnX=60;levelConfig.columnZ=0;$('columnX').value='60';$('columnZ').value='0';}
 $('levelInputMessage').textContent=current.kind==='lathe'?'奥側の支持点を上げました。主軸台と刃物台の姿勢差を比べてください。':'奥側の支持点を上げました。コラムの倒れと、テーブルとの姿勢差を比べてください。';updateLeveling();
};

function accuracyVisualVector(key){
 const axes=axisConfig(current).filter(a=>['X','Y','Z'].includes(a.key));
 const factor=$('exaggerate').checked?levelGeometry.visualFactor:1;
 const profile=scaledAccuracyProfile(machineProfile,factor);
 return window.MachineAccuracy.directions(axes,profile).find(a=>a.key===key).vector;
}

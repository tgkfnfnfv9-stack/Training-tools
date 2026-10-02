'use strict';
// Geometry lesson: sampled support slopes are assumed to set each rigid assembly's
// posture. This is deliberately separate from an elastic/load model of a machine.
const singleColumnKinds=['vertical','compact','travel','horizontal','five'];
let accuracyKey='',accuracyRangeKey='',accuracyRange=null;
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
 return {...metric,poses,toolPoints,workPoint,axes:intrinsicAxes,levelPairs};
}
function geometrySamples(solution=levelSolution,profile=machineProfile,length=levelConfig.offset){
 const keys=axisConfig(current).filter(a=>['X','Y','Z'].includes(a.key)).map(a=>a.key);
 let states=[{X:0,Y:0,Z:0,A:0,C:0}];
 for(const key of keys)states=states.flatMap(state=>[-100,0,100].map(value=>({...state,[key]:value})));
 return states.map(state=>({state,geometry:geometryModel(state,solution,profile,length)}));
}
function signed(value,d=1){return (value>Math.pow(10,-d)/2?'+':'')+cleanNumber(value,d);}
function leanDescription(value,negative,positive){return Math.abs(value)<.00001?'倒れなし':(value>0?positive:negative)+' '+cleanNumber(Math.abs(value),1)+' µrad';}
function accuracyDiagram(g){
 const pairs=g.pairs.filter(p=>p.key.includes(current.kind==='horizontal'?'Y':'Z'));
 const columns=pairs.map((p,i)=>{
  const x=38+i*150,y=120,len=75,dx=Math.max(-30,Math.min(30,-p.deviationMicroradians/1e6*1000*len)),vertical=p.key[1],horizontal=p.key[0];
  return `<g><text x="${x+48}" y="17" text-anchor="middle">${current.kind==='lathe'?'主軸基準 XZ':p.key+' 直角度'}</text><path d="M${x},${y-len}V${y}H${x+100}" fill="none" stroke="#9daeb7" stroke-width="2" stroke-dasharray="5 4"/><path d="M${x},${y}H${x+100}" stroke="${axisColors[horizontal]}" stroke-width="3"/><path d="M${x},${y}L${x+dx},${y-len}" stroke="${axisColors[vertical]}" stroke-width="4"/><text x="${x+110}" y="${y+4}" fill="${axisColors[horizontal]}">${horizontal}</text><text x="${x+dx}" y="${y-len-8}" text-anchor="middle" fill="${axisColors[vertical]}">${vertical}</text><text x="${x+48}" y="150" text-anchor="middle">90°から ${signed(p.deviationMicroradians)} µrad</text></g>`;
 });
 $('accuracyDiagram').setAttribute('viewBox',`0 0 ${pairs.length*150+30} 165`);
 $('accuracyDiagram').innerHTML=columns.join('');
 $('accuracyDiagram').setAttribute('aria-label',pairs.map(p=>p.key+'の90度からの差 '+cleanNumber(p.deviationMicroradians,1)+' マイクロラジアン').join('。'));
}
function updateAccuracy(){
 if(!levelSolution||!levelConfig)return;
 const rangeKey=JSON.stringify([current.id,current.kind,supportHeights,levelConfig,machineProfile]);
 const key=rangeKey+JSON.stringify([positions.X,positions.Y,positions.Z]);
 if(key===accuracyKey&&levelGeometry)return;
 accuracyKey=key;
 if(rangeKey!==accuracyRangeKey||!accuracyRange){accuracyRangeKey=rangeKey;accuracyRange=geometrySamples();}
 const g=geometryModel(),maximumSlope=Math.max(.001,Math.hypot(levelSolution.lr,levelSolution.fb),...Object.values(g.poses).map(p=>Math.hypot(p.slope.lr,p.slope.fb)),...accuracyRange.flatMap(s=>Object.values(s.geometry.poses).map(p=>Math.hypot(p.slope.lr,p.slope.fb))));
 const intrinsicAngle=machineProfile?Math.max(...Object.values(machineProfile.squareness).map(q=>Math.abs(q.microns)/300000)):.000001;
 g.visualFactor=Math.min(1000,200/maximumSlope,.15/Math.max(intrinsicAngle,.000001));levelGeometry=g;
 const lengthMm=Math.round(levelConfig.offset*1000),maxError=Math.max(...g.pairs.map(p=>Math.abs(p.errorMicrons)));
 $('accuracyLength').textContent=lengthMm+' mmで確認';
 const columnDifference=g.columns.length===2?Math.abs(g.columns[1].front-g.columns[0].front):0;
 $('geometryStatus').textContent=columnDifference>.001?'直角差 '+cleanNumber(maxError,1)+' µm ／ 左右コラム差 '+cleanNumber(columnDifference,1)+' µrad':g.pairs.map(p=>p.key+' '+cleanNumber(Math.abs(p.errorMicrons),1)+' µm').join(' ／ ');
 $('accuracyMetrics').replaceChildren();
 for(const p of g.pairs){
  const samples=accuracyRange.map(s=>s.geometry.pairs.find(q=>q.key===p.key).errorMicrons),low=Math.min(...samples),high=Math.max(...samples),box=document.createElement('div');
  box.className='accuracy-metric'+(Math.abs(p.deviationMicroradians)>20?' changed':'');
  const label=document.createElement('span'),value=document.createElement('strong'),angle=document.createElement('small'),travel=document.createElement('small');
  label.textContent=current.kind==='lathe'?'主軸Z基準–X方向':p.key+' 直角度';value.textContent=signed(p.errorMicrons)+' µm';
  angle.textContent=cleanNumber(p.angleDegrees,6)+'° · 90°との差';travel.textContent='端・中央の比較 '+signed(low)+' 〜 '+signed(high)+' µm';
  if(machineProfile){const split=document.createElement('small'),base=machineProfile.squareness[p.key].microns*levelConfig.offset/window.MachineAccuracy.referenceLength,lev=g.levelPairs.find(q=>q.key===p.key).errorMicrons;split.textContent='固有 '+signed(base)+' ／ 支持姿勢 '+signed(lev)+' µm（微小角の内訳）';box.append(label,value,angle,travel,split);}else box.append(label,value,angle,travel);$('accuracyMetrics').append(box);
 }
 $('columnLean').textContent=leanDescription(g.toolLean.front,'後ろ倒れ','前倒れ')+' ／ '+leanDescription(g.toolLean.right,'左倒れ','右倒れ');
 $('relativeLean').textContent='前後 '+signed(g.relativeLean.front)+' µrad ／ 左右 '+signed(g.relativeLean.right)+' µrad';
 const dual=g.columns.length===2;$('columnDifference').hidden=!dual;
 $('postureHeading').textContent=current.kind==='lathe'?'主軸台の姿勢':dual?'左右コラムの姿勢':'コラム／主軸側の姿勢';
 $('demoColumn').textContent=current.kind==='lathe'?'主軸台の姿勢を見る':'コラムの倒れを見る';
 if(dual)$('columnDifference').textContent='左コラム：'+leanDescription(g.columns[0].front,'後ろ倒れ','前倒れ')+' ／ 右コラム：'+leanDescription(g.columns[1].front,'後ろ倒れ','前倒れ')+'。左右の前後倒れ差 '+cleanNumber(Math.abs(g.columns[1].front-g.columns[0].front),1)+' µrad';
 const coordinates=p=>{const q=levelCoordinates(p.x,p.z);return '左右 '+signed(q.x,2)+' m・前後 '+signed(q.z,2)+' m';};
 $('geometryPosition').textContent=(dual?'門中心':current.kind==='lathe'?'主軸台':'コラム')+'：'+coordinates(g.poses.tool.anchor)+' ／ '+(current.kind==='lathe'?'刃物台':'テーブル基準')+'：'+coordinates(g.workPoint);
 const rangeMax=Math.max(...accuracyRange.flatMap(s=>s.geometry.pairs.map(p=>Math.abs(p.errorMicrons))));
 const postureDifference=Math.hypot(g.relativeLean.front,g.relativeLean.right);
 $('accuracyDiagnosis').textContent=columnDifference>.001?'左右コラムが違う姿勢です。平均の直角度だけでは門のねじれを見落とすため、左右の前後倒れ差も確認してください。':maxError<.00001?(rangeMax>.001?'今の位置では直角です。端・中央の比較では直角度が変わります。軸を動かして確認してください。':postureDifference>.001?'表示した軸間の直角差は0ですが、工具側とテーブル側の姿勢差は残っています。前後・左右の姿勢差も確認してください。':'工具側と案内側が同じ姿勢です。全体が傾いても、相対直角度は保たれています。'):(machineProfile?'個体固有の直角差と、支持調整による姿勢変化を合わせた値です。端・中央を比べ、個体の参考最良へ近づけてください。':'支持面の局所姿勢が違うため、直角度が変化しています。支持点を調整して、端・中央の値を比べてください。');
 const localSource=key=>g.axes.filter(a=>a.source===key).map(a=>a.key).join('・');
 $('geometryAssumption').textContent=current.kind==='lathe'?'主軸台のZ方向と刃物台側のX方向を比べる教材です。Y軸はありません。':localSource('tool')+'はコラム／主軸側、'+localSource('work')+'はテーブル／案内側の参照姿勢を使う教材です。'+(current.kind==='five'?'A/Cの旋回誤差は含みません。':'');
 $('columnLayout').hidden=!singleColumnKinds.includes(current.kind);
 $('columnXValue').textContent=levelConfig.columnX===0?'標準':(levelConfig.columnX<0?'左':'右')+'へ '+Math.abs(levelConfig.columnX)+'%';
 $('columnZValue').textContent=levelConfig.columnZ===0?'標準':(levelConfig.columnZ<0?'手前':'奥')+'へ '+Math.abs(levelConfig.columnZ)+'%';
 $('demoTwist').disabled=supports.length===3;
 accuracyDiagram(g);
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
 const profile=machineProfile?{squareness:Object.fromEntries(Object.entries(machineProfile.squareness).map(([pair,item])=>[pair,{microns:item.microns*factor}]))}:null;
 return window.MachineAccuracy.directions(axes,profile).find(a=>a.key===key).vector;
}

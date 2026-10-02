'use strict';
// All dimensions are teaching parameters. mm never enter the 3D geometry without conversion.
let supportHeights=[],levelSolution=null,levelConfig=null,levelExercise=null,levelGeometry=null;
const levelStoragePrefix='training-level-v1:';
const cleanNumber=(v,d=3)=>Math.abs(v)<Math.pow(10,-d)/2?(0).toFixed(d):v.toFixed(d);
const bounded=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
function levelKey(){return levelStoragePrefix+current.id+':'+machineMode;}
function levelRecord(){return {version:1,machine:current.id,mode:machineMode,width:levelConfig.width,depth:levelConfig.depth,heights:[...supportHeights],sensitivity:Number($('levelSensitivity').value),measurePos:Number($('measurePos').value),offset:levelConfig.offset,columnX:levelConfig.columnX,columnZ:levelConfig.columnZ,axisPositions:Object.fromEntries(axisConfig(current).map(a=>[a.key,positions[a.key]])),step:Number($('adjustStep').value),exaggerate:$('exaggerate').checked};}
function validLevelRecord(r){
 const keys=axisConfig(current).map(a=>a.key),axisValid=r?.axisPositions===undefined||r.axisPositions&&typeof r.axisPositions==='object'&&!Array.isArray(r.axisPositions)&&Object.keys(r.axisPositions).length===keys.length&&keys.every(k=>bounded(r.axisPositions[k],-100,100));
 return r&&r.version===1&&r.machine===current.id&&r.mode===machineMode&&bounded(r.width,.5,20)&&bounded(r.depth,.5,20)&&Array.isArray(r.heights)&&r.heights.length===supports.length&&r.heights.every(h=>bounded(h,-.5,.5)&&Math.abs(h*100-Math.round(h*100))<1e-7)&&[.02,.05,.1].includes(r.sensitivity)&&[-1,0,1].includes(r.measurePos)&&bounded(r.offset,.1,2)&&['columnX','columnZ'].every(k=>r[k]===undefined||bounded(r[k],-100,100)&&Number.isInteger(r[k]))&&axisValid&&[.01,.05,.1].includes(r.step)&&typeof r.exaggerate==='boolean';
}
function applyLevelRecord(r){
 levelConfig={width:r.width,depth:r.depth,offset:r.offset,columnX:r.columnX??0,columnZ:r.columnZ??0};supportHeights=[...r.heights];
 positions={X:0,Y:0,Z:0,A:0,C:0,...r.axisPositions};updateAxisValues();
 $('supportWidth').value=r.width;$('supportDepth').value=r.depth;$('levelSensitivity').value=String(r.sensitivity);$('measurePos').value=String(r.measurePos);$('impactOffset').value=r.offset;$('columnX').value=levelConfig.columnX;$('columnZ').value=levelConfig.columnZ;$('adjustStep').value=String(r.step);$('exaggerate').checked=r.exaggerate;
}
function initializeLeveling(){
 supportHeights=supports.map(()=>0);levelConfig={width:Number((current.w*.8).toFixed(2)),depth:Number((current.d*.8).toFixed(2)),offset:.5,columnX:0,columnZ:0};levelExercise=null;levelGeometry=null;
 $('supportWidth').value=levelConfig.width;$('supportDepth').value=levelConfig.depth; $('levelSensitivity').value='0.05';$('adjustStep').value='0.01';$('impactOffset').value=.5;$('columnX').value='0';$('columnZ').value='0';$('exaggerate').checked=true;
 $('levelInputMessage').textContent='';
 $('twistPreset').disabled=supports.length===3;$('twistPreset').title=supports.length===3?'3点支持は平面になるため、ねじれパターンはありません。':'';
 const hasMiddle=!!current.grid&&(current.grid[0]>2||current.grid[1]>2);
 $('middlePreset').disabled=!hasMiddle;$('middlePreset').title=hasMiddle?'':'この支持配置には中間支持点がありません。';
 let restored=false;
 try{const raw=localStorage.getItem(levelKey());if(raw){const data=JSON.parse(raw);if(validLevelRecord(data)){applyLevelRecord(data);restored=true;}}}catch{}
 $('levelSaveStatus').textContent=restored?'前回の調整をこのブラウザから復元しました。':'調整はこのブラウザに自動保存します。';
 buildSupports();updateLeveling(false);
}
function levelCoordinates(x,z){return {x:x/(current.w*.8)*levelConfig.width,z:z/(current.d*.8)*levelConfig.depth};}
function levelVisualPoint(p,pose='bed'){
 if(!levelSolution||!levelConfig||!levelGeometry)return p;
 const factor=$('exaggerate').checked?levelGeometry.visualFactor:1,plane=levelSolution.plane;
 const common=window.Leveling.orientation({lr:plane.a*factor,fb:plane.b*factor}),base=[0,.66,0];
 const commonPoint=q=>{const r=common.rotate([q[0],q[1]-base[1],q[2]]);return [r[0],r[1]+base[1]+plane.c/1000*factor,r[2]];};
 const heightResidual=q=>{const c=levelCoordinates(q[0],q[2]);return (levelSolution.heightAt(c.x,c.z)-(plane.a*c.x+plane.b*c.z+plane.c))/1000*factor;};
 if(pose==='bed'){const q=commonPoint(p);q[1]+=heightResidual(p);return q;}
 const info=levelGeometry.poses[pose]||levelGeometry.poses.tool,offset=pose==='tool'?columnLayoutOffset(current):{x:0,z:0};
 const point=[p[0]+offset.x,p[1],p[2]+offset.z],anchor=[info.anchor.x,.66,info.anchor.z],origin=commonPoint(anchor);
 origin[1]+=heightResidual(anchor);
 const frame=window.Leveling.orientation({lr:info.slope.lr*factor,fb:info.slope.fb*factor}),q=frame.rotate(point.map((v,i)=>v-anchor[i]));
 return q.map((v,i)=>v+origin[i]);
}
// A subdivided teaching surface makes middle supports visible, unlike an unsplit box.
function levelSurfaceFaces(m){
 if(!levelSolution||!$('showLevelSurface').checked)return [];
 const points=supportList(m),y=.66;
 const face=v=>{const heights=v.map(p=>{const q=levelCoordinates(p[0],p[2]);return levelSolution.heightAt(q.x,q.z);});return {v,axes:[],shade:1,surface:true,height:heights.reduce((a,b)=>a+b,0)/heights.length};};
 if(points.length===3){
  const [a,b,c]=points,n=4,out=[];
  const v=(i,j)=>[a.x+(b.x-a.x)*i/n+(c.x-a.x)*j/n,y,a.z+(b.z-a.z)*i/n+(c.z-a.z)*j/n];
  for(let i=0;i<n;i++)for(let j=0;i+j<n;j++){out.push(face([v(i,j),v(i+1,j),v(i,j+1)]));if(i+j<n-1)out.push(face([v(i+1,j),v(i+1,j+1),v(i,j+1)]));}
  return out;
 }
 const subdivide=values=>{const a=[...new Set(values)].sort((x,z)=>x-z),out=[a[0]];for(let i=1;i<a.length;i++)for(let j=1;j<=4;j++)out.push(a[i-1]+(a[i]-a[i-1])*j/4);return out;};
 const xs=subdivide(points.map(p=>p.x)),zs=subdivide(points.map(p=>p.z)),faces=[];
 for(let i=1;i<xs.length;i++)for(let j=1;j<zs.length;j++)faces.push(face([[xs[i-1],y,zs[j-1]],[xs[i],y,zs[j-1]],[xs[i],y,zs[j]],[xs[i-1],y,zs[j]]]));
 return faces;
}
function refreshSupportControls(editingIndex=-1){
 supports.forEach((s,i)=>{const input=$('height'+i);if(!input)return;if(i!==editingIndex)input.value=cleanNumber(supportHeights[i],2);input.closest('.support-row').classList.toggle('selected',selected===i);$('down'+i).disabled=supportHeights[i]<=-.5+1e-9;$('up'+i).disabled=supportHeights[i]>=.5-1e-9;});
 $('supportMap').querySelectorAll('.map-point').forEach((b,i)=>{const index=Number(b.dataset.support);b.classList.toggle('active',index===selected);b.setAttribute('aria-pressed',String(index===selected));});
}
function setSupportHeight(i,value,editing=false){
 if(!bounded(value,-.5,.5)){$('levelInputMessage').textContent='高さは−0.50〜＋0.50 mmの数値で入力してください。';$('height'+i).value=cleanNumber(supportHeights[i],2);refreshSupportControls();return;}
 supportHeights[i]=Math.round(value*100)/100;if(!editing)$('height'+i).value=cleanNumber(supportHeights[i],2);selected=i;$('levelInputMessage').textContent=String.fromCharCode(65+i)+'を '+cleanNumber(supportHeights[i],2)+' mmに調整しました。';updateLeveling(true,editing?i:-1);
}
function changeSupportHeight(i,delta){setSupportHeight(i,Math.max(-.5,Math.min(.5,Math.round((supportHeights[i]+delta)*100)/100)));}
function updateLeveling(save=true,editingIndex=-1){
 const points=supports.map((s,i)=>({...levelCoordinates(s.x,s.z),h:supportHeights[i]}));
 levelSolution=window.Leveling.solve(points);refreshSupportControls(editingIndex);
 updateAccuracy();
 const z=Number($('measurePos').value)*levelConfig.depth/2,local=levelSolution.slopeAt(0,z);
 $('lr').textContent=cleanNumber(levelSolution.lr)+' mm/m';$('fb').textContent=cleanNumber(levelSolution.fb)+' mm/m';$('twist').textContent=cleanNumber(levelSolution.twist)+' mm/m';$('residual').textContent=cleanNumber(levelSolution.residual)+' mm';
 const sensitivity=Number($('levelSensitivity').value);
 function gauge(value,bubble,readout,text,negative,positive){
  $(readout).textContent=cleanNumber(value)+' mm/m';const divisions=value/sensitivity;$(bubble).style.left=(50+Math.max(-40,Math.min(40,divisions*7)))+'%';
  $(text).textContent=Math.abs(value)<1e-8?'水平（気泡は中央）':(value>0?positive:negative)+'が高い · '+cleanNumber(Math.abs(divisions),1)+'目盛'+(Math.abs(divisions)>40/7?'（表示範囲外）':'');
 }
 gauge(local.lr,'bubble','localLevel','bubbleText','左側','右側');gauge(local.fb,'bubbleFB','localLevelFB','bubbleTextFB','手前','奥');
 const xs=[...new Set(points.map(p=>p.x))],zs=[...new Set(points.map(p=>p.z))].sort((a,b)=>a-b);const sampleZ=[...zs,...zs.slice(1).map((v,i)=>(v+zs[i])/2)];
 let maxSlope=0;for(const x of [...xs,0])for(const q of sampleZ){const slope=levelSolution.slopeAt(x,q);maxSlope=Math.max(maxSlope,Math.abs(slope.lr),Math.abs(slope.fb));}
 const notices=[];
 if(Math.hypot(levelSolution.lr,levelSolution.fb)>.02)notices.push('全体の傾きが残っています。右／奥が高いと数値は正になります。');
 if(Math.abs(levelSolution.twist)>.02)notices.push('手前と奥で左右傾きが違います。測定位置を切り替えて比較してください。');
 if(levelSolution.residual>.01)notices.push('支持点が同じ平面に揃っていません。中間支持の高さも確認してください。');
 if(maxSlope>.02&&Math.hypot(levelSolution.lr,levelSolution.fb)<=.02&&Math.abs(levelSolution.twist)<=.02)notices.push('平均傾き・両端のねじれ差が小さくても、局所的な傾きが残っています。');
 if(supports.length===3)notices.push('この3点支持モデルは必ず平面です。ねじれ・平面偏差は0になります。');
 const maxAngle=Math.max(...accuracyRange.flatMap(s=>s.geometry.pairs.map(p=>Math.abs(p.deviationMicroradians))));
 const maxPosture=Math.max(...accuracyRange.flatMap(s=>[Math.abs(s.geometry.relativeLean.front),Math.abs(s.geometry.relativeLean.right),s.geometry.columns.length===2?Math.abs(s.geometry.columns[1].front-s.geometry.columns[0].front):0]));
 if(maxAngle>20.000001)notices.push('端・中央の比較で直角差が残っています。上の精度表示も確認してください。');
 if(maxPosture>20.000001)notices.push('相対姿勢差・左右コラムの倒れ差が残っています。平均値だけでなく、個別の姿勢も確認してください。');
 const target=maxSlope<=.020000001&&Math.abs(levelSolution.twist)<=.020000001&&levelSolution.residual<=.010000001&&maxAngle<=20.000001&&maxPosture<=20.000001;
 if(target)notices.unshift('教材の調整目標内です。実機の精度・合否を示すものではありません。');
 $('diagnosis').replaceChildren();notices.forEach(text=>{const p=document.createElement('p');p.className='diagnosis-item'+(target?' neutral':'');p.textContent=text;$('diagnosis').append(p);});
 const example=window.Leveling.impact(levelSolution,{span:levelConfig.width,offset:levelConfig.offset});
 $('tiltExample').textContent=cleanNumber(example.tiltOffsetMicrons,1)+' µm';$('twistExample').textContent=cleanNumber(example.twistOffsetMicrons,1)+' µm';$('straightExample').textContent=cleanNumber(example.straightnessMicrons,1)+' µm';
 const average=supportHeights.reduce((a,b)=>a+b,0)/supportHeights.length;
 const hints=supportHeights.map((h,i)=>({i,delta:average-h})).filter(q=>Math.abs(q.delta)>=.005).map(q=>String.fromCharCode(65+q.i)+'を約'+cleanNumber(Math.abs(q.delta),2)+' mm'+(q.delta>0?'上げる':'下げる'));
 $('levelHint').textContent=hints.length?hints.join('、')+'と、支持高さを同じ平均値へ揃えられます。':'支持高さは揃っています。';
 if(levelExercise){if(target)levelExercise.solved=true;$('levelExerciseStatus').textContent=levelExercise.solved?(target?'調整練習を達成しました。別の問題にも挑戦できます。':'達成後に再調整しています。現在は目標外です。'):'練習中：支持点を調整して、教材目標へ近づけてください。';}
 else $('levelExerciseStatus').textContent='問題を出し、支持点を手動で調整して目標へ近づけましょう。';
 if(save)saveLeveling();
 drawScene();
}
function saveLeveling(){
 if(!levelConfig||!levelSolution)return;
 try{localStorage.setItem(levelKey(),JSON.stringify(levelRecord()));$('levelSaveStatus').textContent='支持高さ・コラム配置・軸位置をこのブラウザに自動保存しました。';}catch{$('levelSaveStatus').textContent='このブラウザでは自動保存できません。JSONで保存できます。';}
}
function applyLevelPreset(type){
 if(type==='twist'&&supports.length===3||type==='middle'&&(!current.grid||(current.grid[0]<3&&current.grid[1]<3)))return;
 levelExercise=null;
 supportHeights=supports.map(s=>{
  const x=s.x/(current.w*.4),z=s.z/(current.d*.4);
  return Math.round((type==='right'?.1*x:type==='front'?-.1*z:type==='twist'?.1*x*z:Math.abs(x)<.99||Math.abs(z)<.99?.15:0)*100)/100;
 });$('levelInputMessage').textContent='状態パターンを設定しました。';updateLeveling();
}
$('zero').onclick=()=>{supportHeights=supports.map(()=>0);levelExercise=null;$('levelInputMessage').textContent='全支持点を0.00 mmへ戻しました。';updateLeveling();};
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>applyLevelPreset(b.dataset.preset));
$('measurePos').onchange=()=>updateLeveling();$('levelSensitivity').onchange=()=>updateLeveling();$('exaggerate').onchange=()=>updateLeveling();$('showLevelSurface').onchange=()=>drawScene();$('adjustStep').onchange=()=>updateLeveling();
for(const [id,key,min,max] of [['supportWidth','width',.5,20],['supportDepth','depth',.5,20]]){const apply=()=>{const value=Number($(id).value);if(!bounded(value,min,max))return false;levelConfig[key]=value;$('levelInputMessage').textContent='支持寸法を更新しました。';updateLeveling();return true;};$(id).oninput=apply;$(id).onchange=()=>{if(!apply()){$(id).value=levelConfig[key];$('levelInputMessage').textContent='支持幅は0.50〜20.00 mで入力してください。';}};}
$('impactOffset').oninput=()=>{const value=Number($('impactOffset').value);if(bounded(value,.1,2)){levelConfig.offset=value;updateLeveling();}};
$('impactOffset').onchange=()=>{const value=Number($('impactOffset').value);if(!bounded(value,.1,2)){$('impactOffset').value=levelConfig.offset;$('levelInputMessage').textContent='評価長は0.10〜2.00 mです。直前の有効値へ戻しました。';}else levelConfig.offset=value;updateLeveling();};
$('startLevelExercise').onclick=()=>{supportHeights=supports.map(()=>Math.round((Math.random()*.4-.2)*100)/100);const sign=Math.random()<.5?-1:1;supportHeights[0]=-.4*sign;supportHeights[1]=.4*sign;levelExercise={solved:false};$('levelInputMessage').textContent='新しい調整問題を設定しました。';updateLeveling();};
$('exportLevel').onclick=()=>{const blob=new Blob([JSON.stringify(levelRecord(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='leveling-'+current.id+'-'+(machineMode||'standard')+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('levelSaveStatus').textContent='調整データのダウンロードを開始しました。';};
$('importLevel').onchange=async event=>{const file=event.target.files[0];event.target.value='';if(!file)return;try{if(file.size>250000)throw Error('大きすぎる');const data=JSON.parse(await file.text());if(!validLevelRecord(data))throw Error('不正な調整データ');stopMotion();applyLevelRecord(data);levelExercise=null;updateLeveling();$('levelInputMessage').textContent='調整データを読み込みました。';}catch{$('levelInputMessage').textContent='読込できません。同じ機械・方式の調整JSONと、数値範囲を確認してください。'}};

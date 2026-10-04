'use strict';
// All dimensions are teaching parameters. mm never enter the 3D geometry without conversion.
let supportHeights=[],levelSolution=null,levelConfig=null,levelExercise=null,levelGeometry=null;
const levelStoragePrefix='training-level-v1:';
// An asynchronous file may finish after another import or a newer training state.
let levelImportRequest=0,levelSessionEpoch=0,levelRevision=0;
function invalidateLevelImport(){levelRevision++;}
const cleanNumber=(v,d=3)=>Math.abs(v)<Math.pow(10,-d)/2?(0).toFixed(d):v.toFixed(d);
const bounded=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
function levelKey(){return levelStoragePrefix+current.id+':'+machineMode;}
function levelRecord(){return {version:machineProfile?2:1,...(machineProfile?{machineProfile,...(machineReference?{bestState:machineBestRecord()}:{})}:{}),machine:current.id,mode:machineMode,width:levelConfig.width,depth:levelConfig.depth,heights:[...supportHeights],sensitivity:Number($('levelSensitivity').value),measurePos:Number($('measurePos').value),offset:levelConfig.offset,columnX:levelConfig.columnX,columnZ:levelConfig.columnZ,axisPositions:Object.fromEntries(axisConfig(current).map(a=>[a.key,positions[a.key]])),step:Number($('adjustStep').value),exaggerate:$('exaggerate').checked};}
function validLevelRecord(r){
 const keys=axisConfig(current).map(a=>a.key),axisValid=r?.axisPositions===undefined||r.axisPositions&&typeof r.axisPositions==='object'&&!Array.isArray(r.axisPositions)&&Object.keys(r.axisPositions).length===keys.length&&keys.every(k=>bounded(r.axisPositions[k],-100,100));
 return r&&((r.version===1&&r.machineProfile===undefined)||(r.version===2&&window.MachineAccuracy.valid(r.machineProfile,machineLinearKeys(),supports.length)&&validMachineBest(r)))&&r.machine===current.id&&r.mode===machineMode&&bounded(r.width,.5,20)&&bounded(r.depth,.5,20)&&Array.isArray(r.heights)&&r.heights.length===supports.length&&r.heights.every(h=>bounded(h,-.5,.5)&&Math.abs(h*1000-Math.round(h*1000))<1e-7)&&[.02,.05,.1].includes(r.sensitivity)&&[-1,0,1].includes(r.measurePos)&&bounded(r.offset,.1,2)&&['columnX','columnZ'].every(k=>r[k]===undefined||bounded(r[k],-100,100)&&Number.isInteger(r[k]))&&axisValid&&[.001,.005,.01,.05,.1].includes(r.step)&&typeof r.exaggerate==='boolean';
}
function applyLevelRecord(r){
 levelConfig={width:r.width,depth:r.depth,offset:r.offset,columnX:r.columnX??0,columnZ:r.columnZ??0};supportHeights=[...r.heights];
 initializeMachineAccuracy(r.version===2?r.machineProfile:null,r.bestState);supportHeights=[...r.heights];
 positions={X:0,Y:0,Z:0,A:0,C:0,...r.axisPositions};updateAxisValues();
 $('supportWidth').value=r.width;$('supportDepth').value=r.depth;$('levelSensitivity').value=String(r.sensitivity);$('measurePos').value=String(r.measurePos);$('impactOffset').value=r.offset;$('columnX').value=levelConfig.columnX;$('columnZ').value=levelConfig.columnZ;$('adjustStep').value=String(r.step);$('exaggerate').checked=r.exaggerate;
}
function initializeLeveling(){
 levelSessionEpoch++;invalidateLevelImport();
 supportHeights=supports.map(()=>0);levelConfig={width:Number((current.w*.8).toFixed(2)),depth:Number((current.d*.8).toFixed(2)),offset:.5,columnX:0,columnZ:0};levelExercise=null;levelGeometry=null;
 $('supportWidth').value=levelConfig.width;$('supportDepth').value=levelConfig.depth; $('levelSensitivity').value='0.05';$('adjustStep').value='0.001';$('impactOffset').value=.5;$('columnX').value='0';$('columnZ').value='0';$('exaggerate').checked=true;
 $('levelInputMessage').textContent='';
 $('twistPreset').disabled=supports.length===3;$('twistPreset').title=supports.length===3?'3点支持は平面になるため、ねじれパターンはありません。':'';
 const hasMiddle=!!current.grid&&(current.grid[0]>2||current.grid[1]>2);
 $('middlePreset').disabled=!hasMiddle;$('middlePreset').title=hasMiddle?'':'この支持配置には中間支持点がありません。';
 initializeMachineAccuracy();
 let restored=false;
 try{const raw=localStorage.getItem(levelKey());if(raw){const data=JSON.parse(raw);if(validLevelRecord(data)){applyLevelRecord(data);restored=true;}}}catch{}
 $('levelSaveStatus').textContent=restored?'前回の調整をこのブラウザから復元しました。':'調整はこのブラウザに自動保存します。';
 buildSupports();updateLeveling(false);const saved=saveLeveling();
 if(restored)$('levelSaveStatus').textContent=saved?'前回の個体・調整をこのブラウザから復元しました。':'前回の個体・調整を復元しました。このブラウザでは自動保存できません。JSONで保存できます。';
}
function levelCoordinates(x,z){return {x:x/(current.w*.8)*levelConfig.width,z:z/(current.d*.8)*levelConfig.depth};}
function levelVisualPoint(p,pose='bed'){
 if(!levelSolution||!levelConfig||!levelGeometry)return p;
 const factor=$('exaggerate').checked?levelGeometry.visualFactor:1,plane=levelSolution.plane;
 const common=window.Leveling.orientation({lr:plane.a*factor,fb:plane.b*factor}),base=[0,.66,0];
 const commonPoint=q=>{const r=common.rotate([q[0],q[1]-base[1],q[2]]);return [r[0],r[1]+base[1]+plane.c/1000*factor,r[2]];};
 // The outline stays the same size when virtual support dimensions change.
 // Subtract the plane actually drawn in that outline, rather than a plane in
 // virtual metres, so equal support heights remain equal in the height map.
 const heightResidual=q=>{const c=levelCoordinates(q[0],q[2]),drawn=common.rotate([q[0],0,q[2]])[1]+plane.c/1000*factor;return levelSolution.heightAt(c.x,c.z)/1000*factor-drawn;};
 if(pose==='bed'){const q=commonPoint(p);q[1]+=heightResidual(p);return q;}
 const info=levelGeometry.poses[pose]||levelGeometry.poses.tool,offset=pose==='tool'?columnLayoutOffset(current):{x:0,z:0};
 const point=[p[0]+offset.x,p[1],p[2]+offset.z],anchor=[info.anchor.x,.66,info.anchor.z],origin=commonPoint(anchor);
 origin[1]+=heightResidual(anchor);
 const frame=window.Leveling.orientation({lr:info.slope.lr*factor,fb:info.slope.fb*factor}),q=frame.rotate(point.map((v,i)=>v-anchor[i]));
 return q.map((v,i)=>v+origin[i]);
}
let bodyVisualFrame=null,bodyVisualFrameProfile=null,bodyVisualFrameKind='',bodyVisualFrameFactor=0;
function levelBodyVisualPoint(p,pose='bed'){
 if(!levelGeometry||!machineProfile||pose==='bed'||pose==='work')return levelVisualPoint(p,pose);
 const factor=$('exaggerate').checked?levelGeometry.visualFactor:1;
 if(machineProfile!==bodyVisualFrameProfile||current.kind!==bodyVisualFrameKind||factor!==bodyVisualFrameFactor){bodyVisualFrameProfile=machineProfile;bodyVisualFrameKind=current.kind;bodyVisualFrameFactor=factor;bodyVisualFrame=intrinsicBodyFrame(axisConfig(current).filter(a=>['X','Y','Z'].includes(a.key)),machineProfile,factor);}
 const info=levelGeometry.poses[pose]||levelGeometry.poses.tool,offset=pose==='tool'?columnLayoutOffset(current):{x:0,z:0},anchor=[info.anchor.x,.66,info.anchor.z];
 const relative=[p[0]+offset.x-anchor[0],p[1]-anchor[1],p[2]+offset.z-anchor[2]],rotated=bodyVisualFrame.rotate(relative);
 return levelVisualPoint([rotated[0]+anchor[0]-offset.x,rotated[1]+anchor[1],rotated[2]+anchor[2]-offset.z],pose);
}
function levelAxisVisualPoint(p,origin,pose,bodyOrigin=levelBodyVisualPoint(origin,pose)){
 const q=levelVisualPoint(p,pose),supportOrigin=levelVisualPoint(origin,pose);
 // Move only the arrow's centre with its body. Its direction already contains
 // the intrinsic defect and must receive the support rotation just once.
 return q.map((v,i)=>v+bodyOrigin[i]-supportOrigin[i]);
}
function updateLevelStages(){
 const averageLevel=Math.max(Math.abs(levelSolution.lr),Math.abs(levelSolution.fb)),coarse=averageLevel<=.020000001;
 $('stageStatus').textContent=coarse?'平均レベルの目安内 · 残る精度を確認':'まず平均レベルを粗調整';
 $('stageStatus').className='stage-status'+(coarse?' within':'');
 $('stageAverageLR').textContent=Math.abs(levelSolution.lr)<=.020000001?'目安内':levelSolution.lr>0?'右が高い':'左が高い';
 $('stageAverageFB').textContent=Math.abs(levelSolution.fb)<=.020000001?'目安内':levelSolution.fb>0?'奥が高い':'手前が高い';
 $('stageAverageLR').setAttribute('data-value',String(levelSolution.lr));$('stageAverageFB').setAttribute('data-value',String(levelSolution.fb));
 $('stageStatus').setAttribute('data-coarse-ready',String(coarse));
 $('stageResidual').textContent=coarse?'平均の傾きが揃っても、本体の固有精度は残ります。局所姿勢差・支持面のねじれも別に確認し、同じ支持点を微調整します。':'初期状態はランダムな支持高さと、本体の固有精度を重ねています。支持点を動かし、まず平均の左右・前後傾きを目安へ近づけます。';
 for(const [id,value] of [['coarseAdjust',.01],['fineAdjust',.001]])$(id).setAttribute('aria-pressed',String(Number($('adjustStep').value)===value));
}
// The input shows what the learner has moved, while the solver and saved
// record continue to use the original absolute support heights.
function supportBaseline(i){return machineProfile?.initialHeights[i]??0;}
function supportAdjustment(i){return Math.round((supportHeights[i]-supportBaseline(i))*1000)/1000;}
function supportHeightFromAdjustment(i,value){return Number.isFinite(value)?supportBaseline(i)+value:NaN;}
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
 supports.forEach((s,i)=>{const input=$('height'+i);if(!input)return;if(i!==editingIndex)input.value=cleanNumber(supportAdjustment(i),3);input.setAttribute('min',String(-.5-supportBaseline(i)));input.setAttribute('max',String(.5-supportBaseline(i)));input.closest('.support-row').classList.toggle('selected',selected===i);$('down'+i).disabled=supportHeights[i]<=-.5+1e-9;$('up'+i).disabled=supportHeights[i]>=.5-1e-9;});
 $('supportMap').querySelectorAll('.map-point').forEach((b,i)=>{const index=Number(b.dataset.support);b.classList.toggle('active',index===selected);b.setAttribute('aria-pressed',String(index===selected));});
}
function setSupportHeight(i,value,editing=false){
 invalidateLevelImport();stopMotion();
 if(!bounded(value,-.5,.5)){$('levelInputMessage').textContent='調整可能な範囲の数値を入力してください。直前の調整量へ戻しました。';$('height'+i).value=cleanNumber(supportAdjustment(i),3);refreshSupportControls();return;}
 supportHeights[i]=Math.round(value*1000)/1000;if(!editing)$('height'+i).value=cleanNumber(supportAdjustment(i),3);selected=i;$('levelInputMessage').textContent=String.fromCharCode(65+i)+'の調整量 '+signed(supportAdjustment(i),3)+' mm。絵と現在の測定を確認してください。';updateLeveling(true,editing?i:-1);
}
function changeSupportHeight(i,delta){setSupportHeight(i,Math.max(-.5,Math.min(.5,Math.round((supportHeights[i]+delta)*1000)/1000)));}
function updateLeveling(save=true,editingIndex=-1){
 const points=supports.map((s,i)=>({...levelCoordinates(s.x,s.z),h:supportHeights[i]}));
 levelSolution=window.Leveling.solve(points);refreshSupportControls(editingIndex);
 updateAccuracy();
 updateLevelStages();
 const z=Number($('measurePos').value)*levelConfig.depth/2,local=levelSolution.slopeAt(0,z);
 $('lr').textContent=cleanNumber(levelSolution.lr,4)+' mm/m';$('fb').textContent=cleanNumber(levelSolution.fb,4)+' mm/m';$('twist').textContent=cleanNumber(levelSolution.twist,6)+' mm/m';$('residual').textContent=cleanNumber(levelSolution.residual)+' mm';
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
 const machineResult=updateMachineAccuracy();
 const target=machineResult?machineResult.target:maxSlope<=.020000001&&Math.abs(levelSolution.twist)<=.020000001&&levelSolution.residual<=.010000001&&maxAngle<=20.000001&&maxPosture<=20.000001;
 if(target)notices.unshift(machineResult?'補助の参考探索では最良近傍です。倒れ・ねじれ・直角度の変化を主表示で見比べてください。':'教材の調整目標内です。実機の精度・合否を示すものではありません。');
 $('diagnosis').replaceChildren();notices.forEach(text=>{const p=document.createElement('p');p.className='diagnosis-item'+(target?' neutral':'');p.textContent=text;$('diagnosis').append(p);});
 const example=window.Leveling.impact(levelSolution,{span:levelConfig.width,offset:levelConfig.offset});
 $('tiltExample').textContent=cleanNumber(example.tiltOffsetMicrons,1)+' µm';$('twistExample').textContent=cleanNumber(example.twistOffsetMicrons,1)+' µm';$('straightExample').textContent=cleanNumber(example.straightnessMicrons,1)+' µm';
 const average=supportHeights.reduce((a,b)=>a+b,0)/supportHeights.length;
 const hints=supportHeights.map((h,i)=>({i,delta:average-h})).filter(q=>Math.abs(q.delta)>=.005).map(q=>String.fromCharCode(65+q.i)+'を約'+cleanNumber(Math.abs(q.delta),2)+' mm'+(q.delta>0?'上げる':'下げる'));
 $('levelHint').textContent=machineResult?machineResult.hint:hints.length?hints.join('、')+'と、支持高さを同じ平均値へ揃えられます。':'支持高さは揃っています。';
 if(levelExercise){
  if(target)levelExercise.solved=true;
  $('levelExerciseStatus').textContent=machineResult?'支持点を少し動かし、初期と現在の変化を読み取る練習です。比較基準は抽選時の支持高さです。'+(target?'補助の参考探索は達成しました。':'補助の参考探索も必要に応じて確認できます。'):levelExercise.solved?(target?'調整練習を達成しました。別の問題にも挑戦できます。':'達成後に再調整しています。現在は目標外です。'):'練習中：支持点を調整して、教材目標へ近づけてください。';
 }else $('levelExerciseStatus').textContent=machineResult?'支持点を少し動かし、抽選時からの変化を読み取ってみましょう。':'問題を出し、支持点を手動で調整して目標へ近づけましょう。';
 if(save)saveLeveling();
 drawScene();
}
function saveLeveling(){
 if(!levelConfig||!levelSolution)return;
 invalidateLevelImport();
 try{localStorage.setItem(levelKey(),JSON.stringify(levelRecord()));$('levelSaveStatus').textContent='個体・支持高さ・コラム配置・軸位置をこのブラウザに自動保存しました。';return true;}catch{$('levelSaveStatus').textContent='このブラウザでは自動保存できません。JSONで保存できます。';return false;}
}
function applyLevelPreset(type){
 if(type==='twist'&&supports.length===3||type==='middle'&&(!current.grid||(current.grid[0]<3&&current.grid[1]<3)))return;
 invalidateLevelImport();stopMotion();levelExercise=null;
 supportHeights=supports.map(s=>{
  const x=s.x/(current.w*.4),z=s.z/(current.d*.4);
  return Math.round((type==='right'?.1*x:type==='front'?-.1*z:type==='twist'?.1*x*z:Math.abs(x)<.99||Math.abs(z)<.99?.15:0)*1000)/1000;
 });$('levelInputMessage').textContent='状態パターンを設定しました。';updateLeveling();
}
$('zero').onclick=()=>{invalidateLevelImport();stopMotion();supportHeights=supports.map(()=>0);levelExercise=null;$('levelInputMessage').textContent='全支持点を同じ高さへ揃えました。各欄は抽選時からの調整量です。';updateLeveling();};
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>applyLevelPreset(b.dataset.preset));
$('measurePos').onchange=()=>updateLeveling();$('levelSensitivity').onchange=()=>updateLeveling();$('exaggerate').onchange=()=>updateLeveling();$('showLevelSurface').onchange=()=>drawScene();$('adjustStep').onchange=()=>updateLeveling();
for(const [id,value] of [['coarseAdjust',.01],['fineAdjust',.001]])$(id).onclick=()=>{$('adjustStep').value=String(value);$('levelInputMessage').textContent=(value===.01?'粗調整':'微調整')+'：ボタン1回 '+cleanNumber(value)+' mmに切り替えました。支持高さはそのままです。';updateLeveling();};
for(const [id,key,min,max] of [['supportWidth','width',.5,20],['supportDepth','depth',.5,20]]){const apply=()=>{invalidateLevelImport();const value=Number($(id).value);if(!bounded(value,min,max))return false;levelConfig[key]=value;$('levelInputMessage').textContent='支持寸法を更新しました。';updateLeveling();return true;};$(id).oninput=apply;$(id).onchange=()=>{if(!apply()){$(id).value=levelConfig[key];$('levelInputMessage').textContent='支持幅は0.50〜20.00 mで入力してください。';}};}
$('impactOffset').oninput=()=>{invalidateLevelImport();const value=Number($('impactOffset').value);if(bounded(value,.1,2)){levelConfig.offset=value;updateLeveling();}};
$('impactOffset').onchange=()=>{const value=Number($('impactOffset').value);if(!bounded(value,.1,2)){$('impactOffset').value=levelConfig.offset;$('levelInputMessage').textContent='評価長は0.10〜2.00 mです。直前の有効値へ戻しました。';}else levelConfig.offset=value;updateLeveling();};
$('startLevelExercise').onclick=()=>{invalidateLevelImport();stopMotion();supportHeights=supports.map(()=>Math.round((Math.random()*.4-.2)*1000)/1000);const sign=Math.random()<.5?-1:1;supportHeights[0]=-.4*sign;supportHeights[1]=.4*sign;levelExercise={solved:false};$('levelInputMessage').textContent=machineProfile?'同じ個体で別の支持状態を設定しました。比較基準は抽選時の支持高さのままです。':'新しい調整問題を設定しました。';updateLeveling();};
$('exportLevel').onclick=()=>{
 let url=null,link=null;
 try{
  const blob=new Blob([JSON.stringify(levelRecord(),null,2)],{type:'application/json'});
  url=URL.createObjectURL(blob);link=document.createElement('a');link.href=url;link.download='leveling-'+current.id+'-'+(machineMode||'standard')+'.json';link.hidden=true;
  document.body.append(link);link.click();
  // Keep the Blob available while the browser starts the download. The link
  // belongs to the live document only for the synchronous click itself.
  const downloadUrl=url;setTimeout(()=>URL.revokeObjectURL(downloadUrl),30000);url=null;
  $('levelSaveStatus').textContent='調整データのダウンロードを開始しました。';
 }catch{
  if(url)URL.revokeObjectURL(url);
  $('levelSaveStatus').textContent='保存を開始できませんでした。もう一度「調整データを保存」を押してください。';
 }finally{if(link)link.remove();}
};
$('importLevel').onchange=async event=>{
 const file=event.target.files[0];event.target.value='';if(!file)return;
 stopMotion();
 const request=++levelImportRequest,epoch=levelSessionEpoch,revision=levelRevision,key=levelKey();
 const isCurrent=()=>request===levelImportRequest&&epoch===levelSessionEpoch&&revision===levelRevision&&key===levelKey()&&page==='training'&&motionFrame===null;
 try{
  if(file.size>250000)throw Error('大きすぎる');
  const text=await file.text();if(!isCurrent())return;
  const data=JSON.parse(text);if(!validLevelRecord(data))throw Error('不正な調整データ');
  applyLevelRecord(data);updateLeveling();$('levelInputMessage').textContent='調整データを読み込みました。';
 }catch{if(isCurrent())$('levelInputMessage').textContent='読込できません。同じ機械・方式の調整JSONと、数値範囲を確認してください。';}
};

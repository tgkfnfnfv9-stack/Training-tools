'use strict';
// All dimensions are teaching parameters. mm never enter the 3D geometry without conversion.
let supportHeights=[],levelSolution=null,levelConfig=null,levelExercise=null,levelGeometry=null;
const levelCalculationModel='connected-frames-v1';
function currentCalculationModel(){return ['double','gantry'].includes(current.kind)?'portal-shear-v2':current.kind==='travel'?'travel-guide-v2':current.kind==='horizontal'?'horizontal-guide-v2':current.kind==='compact'?'compact-asymmetric-bending-v4':current.kind==='lathe'?'lathe-carriage-v2':levelCalculationModel;}
function levelStoragePrefix(){return 'training-level-'+currentCalculationModel()+':';}
// An asynchronous file may finish after another import or a newer training state.
let levelImportRequest=0,levelSessionEpoch=0,levelRevision=0;
let adjustmentStage='coarse',adjustmentHintKey='',adjustmentHintValue=null,fineStartEvaluation=null;
function adjustmentContextKey(){return JSON.stringify([current.id,current.kind,current.w,current.d,machineProfile,levelConfig]);}
function resetAdjustmentProgress(){fineStartEvaluation=null;adjustmentHintKey='';adjustmentHintValue=null;}
function captureFineStart(){fineStartEvaluation={key:adjustmentContextKey(),objective:machineEvaluation(supportHeights).objective};}
function invalidateLevelImport(){levelRevision++;}
const cleanNumber=(v,d=3)=>Math.abs(v)<Math.pow(10,-d)/2?(0).toFixed(d):v.toFixed(d);
const bounded=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
function levelKey(){return levelStoragePrefix()+current.id+':'+machineMode+(current.layoutId?':'+current.layoutId:'');}
function supportLayoutRecord(){return {id:current.layoutId,points:supports.map(s=>({id:s.id,x:s.x,z:s.z,group:s.group}))};}
function legacyCompactRecord(r){return current.id==='vertical'&&machineMode==='compact'&&r?.machine==='vertical'&&r.mode==='compact'&&(r.version===1||r.version===2)&&r.supportLayout===undefined;}
function compatibleSupportLayout(r){
 if(!current.layoutId)return r?.version===1||r?.version===2;
 if(legacyCompactRecord(r))return true;
 const expected=supportLayoutRecord(),actual=r?.supportLayout;
 return r?.version===3&&actual?.id===expected.id&&Array.isArray(actual.points)&&actual.points.length===expected.points.length&&expected.points.every((p,i)=>['id','x','z','group'].every(k=>actual.points[i]?.[k]===p[k]));
}


function levelRecord(){return {calculationModel:currentCalculationModel(),version:current.layoutId?3:machineProfile?2:1,...(current.layoutId?{supportLayout:supportLayoutRecord()}:{}),...(machineProfile?{machineProfile,...(machineReference?{bestState:machineBestRecord()}:{})}:{}),machine:current.id,mode:machineMode,width:levelConfig.width,depth:levelConfig.depth,heights:[...supportHeights],sensitivity:Number($('levelSensitivity').value),measurePos:Number($('measurePos').value),offset:levelConfig.offset,columnX:levelConfig.columnX,columnZ:levelConfig.columnZ,axisPositions:Object.fromEntries(axisConfig(current).map(a=>[a.key,positions[a.key]])),step:Number($('adjustStep').value),exaggerate:$('exaggerate').checked};}
function validLevelRecord(r){
 const keys=axisConfig(current).map(a=>a.key),axisValid=r?.axisPositions===undefined||r.axisPositions&&typeof r.axisPositions==='object'&&!Array.isArray(r.axisPositions)&&Object.keys(r.axisPositions).length===keys.length&&keys.every(k=>bounded(r.axisPositions[k],-100,100));
 return r&&r.calculationModel===currentCalculationModel()&&compatibleSupportLayout(r)&&((r.version===1&&r.machineProfile===undefined)||((r.version===2||r.version===3)&&window.MachineAccuracy.valid(r.machineProfile,machineLinearKeys(),supports.length)&&validMachineBest(r)))&&r.machine===current.id&&r.mode===machineMode&&bounded(r.width,.5,20)&&bounded(r.depth,.5,20)&&Array.isArray(r.heights)&&r.heights.length===supports.length&&r.heights.every(h=>bounded(h,-.5,.5)&&Math.abs(h*1000-Math.round(h*1000))<1e-7)&&[.02,.05,.1].includes(r.sensitivity)&&[-1,0,1].includes(r.measurePos)&&bounded(r.offset,.1,2)&&['columnX','columnZ'].every(k=>r[k]===undefined||bounded(r[k],-100,100)&&Number.isInteger(r[k]))&&axisValid&&[.001,.005,.01,.05,.1].includes(r.step)&&typeof r.exaggerate==='boolean';
}
function applyLevelRecord(r){
 resetAdjustmentProgress();
 levelConfig={width:r.width,depth:r.depth,offset:r.offset,columnX:r.columnX??0,columnZ:r.columnZ??0};supportHeights=[...r.heights];
 initializeMachineAccuracy(r.version>=2?r.machineProfile:null,r.bestState);supportHeights=[...r.heights];
 positions={X:0,Y:0,Z:0,A:0,C:0,...r.axisPositions};updateAxisValues();
 $('supportWidth').value=r.width;$('supportDepth').value=r.depth;$('levelSensitivity').value=String(r.sensitivity);$('measurePos').value=String(r.measurePos);$('impactOffset').value=r.offset;$('columnX').value=levelConfig.columnX;$('columnZ').value=levelConfig.columnZ;$('adjustStep').value=String(r.step);$('exaggerate').checked=r.exaggerate;adjustmentStage=r.step>=.01?'coarse':'fine';
}
function initializeLeveling(){
 levelSessionEpoch++;invalidateLevelImport();resetAdjustmentProgress();adjustmentStage='coarse';
 supportHeights=supports.map(()=>0);levelConfig={width:Number((current.w*.8).toFixed(2)),depth:Number((current.d*.8).toFixed(2)),offset:.5,columnX:0,columnZ:0};levelExercise=null;levelGeometry=null;
 $('supportWidth').value=levelConfig.width;$('supportDepth').value=levelConfig.depth; $('levelSensitivity').value='0.05';$('adjustStep').value='0.01';$('impactOffset').value=.5;$('columnX').value='0';$('columnZ').value='0';$('exaggerate').checked=true;
 $('levelInputMessage').textContent='';
 $('twistPreset').disabled=supports.length===3;$('twistPreset').title=supports.length===3?'この支持配置は平面になるため、ねじれパターンはありません。':'';
 const hasMiddle=!!current.supportLayout||!!current.grid&&(current.grid[0]>2||current.grid[1]>2);
 $('middlePreset').disabled=!hasMiddle;$('middlePreset').title=hasMiddle?'':'この支持配置には中間支持点がありません。';
 initializeMachineAccuracy();
 // A page entry is a new exercise. Browser snapshots are written below but
 // never applied automatically; only an explicit JSON import restores a state.
 buildSupports();updateLeveling(false);const saved=saveLeveling();
 $('levelSaveStatus').textContent='新しい個体を抽選しました。ページを開き直すと再抽選します。同じ調整を続ける場合はJSONを保存・読込してください。'+(saved?'':'このブラウザでは自動保存できません。');
}
function levelCoordinates(x,z){return {x:x/(current.w*.8)*levelConfig.width,z:z/(current.d*.8)*levelConfig.depth};}
// Display coordinates use the same physical support dimensions as the solver.
// Mapping happens before rigid rotary motion; precision and stored raw positions
// retain their existing coordinate contract.
function displayCoordinates(p){
 if(!levelConfig)return [...p];const q=levelCoordinates(p[0],p[2]);return [q.x,p[1],q.z];
}
function displayFactor(){return $('exaggerate').checked&&levelGeometry?levelGeometry.visualFactor:1;}
let displayClearanceKey='',displayClearanceValue=0;
function displayClearance(){
 if(!levelSolution||!levelGeometry)return 0;
 const factor=displayFactor(),key=JSON.stringify([current.kind,current.w,current.d,levelConfig.width,levelConfig.depth,factor]);
 if(key===displayClearanceKey)return displayClearanceValue;
 const bedPoints=createGeometry(current).faces.filter(f=>f.pose==='bed').flatMap(f=>f.v);
 const basis=supports.map((_,i)=>machineSolution(supports.map((s,j)=>i===j?1:0)));
 let heightBound=.5,thickness=0;
 for(const p of bedPoints){const q=levelCoordinates(p[0],p[2]);heightBound=Math.max(heightBound,basis.reduce((sum,solution)=>sum+Math.abs(structuralSurface(q.x,q.z,solution).heightAt(q.x,q.z))*.5,0));thickness=Math.max(thickness,.66-p[1]);}
 // Bound extrapolated perimeter heights as well as actual support heights.
 // This fixed margin never follows the current supports or moving-axis state.
 displayClearanceKey=key;displayClearanceValue=Math.max(0,factor*heightBound/1000+thickness+.09+.025-.66);return displayClearanceValue;
}
function structuralSurface(x,z,solution=levelSolution){
 if(!solution.parts)return solution;
 const bed=solution.parts.bed;
 const blend=(qx,qz)=>{
  const rawX=qx*(current.w*.8)/levelConfig.width,rawZ=qz*(current.d*.8)/levelConfig.depth,dx=(current.w*.8)/levelConfig.width,dz=(current.d*.8)/levelConfig.depth;
  const smooth=t=>{const u=Math.max(0,Math.min(1,t));return {v:u*u*(3-2*u),d:t>0&&t<1?6*u*(1-u):0};};
  const a=smooth((Math.abs(rawX)-.77)/.29),b=smooth((.39-Math.abs(rawZ-current.columnZ))/.065);
  return {part:solution.parts[rawX<0?'column-left':'column-right'],w:a.v*b.v,wx:a.d*Math.sign(rawX)*dx/.29*b.v,wz:-b.d*Math.sign(rawZ-current.columnZ)*dz/.065*a.v};
 };
 return {heightAt:(qx,qz)=>{const q=blend(qx,qz),h=bed.heightAt(qx,qz);return h+q.w*(q.part.heightAt(qx,qz)-h);},slopeAt:(qx,qz)=>{const q=blend(qx,qz),a=bed.slopeAt(qx,qz),b=q.part.slopeAt(qx,qz),d=q.part.heightAt(qx,qz)-bed.heightAt(qx,qz);return {lr:a.lr+q.w*(b.lr-a.lr)+q.wx*d,fb:a.fb+q.w*(b.fb-a.fb)+q.wz*d};}};
}
function displaySurfacePoint(x,z){
 if(current.kind==='compact')return compactSurfacePoint(levelSolution,x,z,displayFactor()).map((v,i)=>v+(i===1?displayClearance():0));
 if(levelGeometry?.portal){const factor=displayFactor(),plane=levelSolution.plane,h=structuralSurface(x).heightAt(x,z)-(plane.a*x+plane.b*z+plane.c);return displayPortal().world([x,h*factor/1000,z]).map((v,i)=>v+(i===1?displayClearance():0));}
 return [x,.66+displayClearance()+displayFactor()*levelSolution.heightAt(x,z)/1000,z];
}
function displaySupportFrame(slope){const factor=displayFactor();return window.Leveling.orientation({lr:slope.lr*factor,fb:slope.fb*factor});}
let portalDisplayCache=null,portalDisplayGeometry=null,portalDisplayFactor=0;
function displayPortal(){
 const factor=displayFactor();
 if(portalDisplayGeometry!==levelGeometry||portalDisplayFactor!==factor){portalDisplayGeometry=levelGeometry;portalDisplayFactor=factor;portalDisplayCache=connectedPortal(levelSolution,levelGeometry.toolPoints,factor);}
 return portalDisplayCache;
}
function displayPoseFrame(pose){
 if(current.kind==='compact'){const p=(levelGeometry.poses[pose]||levelGeometry.poses.tool).anchor,q=levelCoordinates(p.x,p.z);return compactSupportFrame(levelSolution,q.x,q.z,displayFactor());}
 if(levelGeometry.portal){const p=displayPortal();if(pose==='tool')return p.frame;if(pose==='leftColumn'||pose==='rightColumn')return p.columns[pose==='rightColumn'?1:0].frame;
  if(pose==='work'&&levelSolution.parts){const q=levelCoordinates(levelGeometry.workPoint.x,levelGeometry.workPoint.z),s=levelSolution.parts.bed.slopeAt(q.x,q.z),factor=displayFactor();return window.Leveling.compose(p.common,window.Leveling.orientation({lr:(s.lr-levelSolution.lr)*factor,fb:(s.fb-levelSolution.fb)*factor}));}}
 return displaySupportFrame((levelGeometry.poses[pose]||levelGeometry.poses.tool).slope);
}
let compactDisplayFrames=null,compactDisplayGeometry=null,compactDisplayFactor=0;
function displayAxisFrame(key){
 if(current.kind==='compact'&&key==='Y'){const factor=displayFactor();if(compactDisplayGeometry!==levelGeometry||compactDisplayFactor!==factor){compactDisplayGeometry=levelGeometry;compactDisplayFactor=factor;compactDisplayFrames=compactPathFrames(positions,levelSolution,machineProfile,factor);}return compactDisplayFrames.Y;}
 if(key==='X'&&levelGeometry.guideSlope)return displaySupportFrame(levelGeometry.guideSlope);
 if(current.kind==='lathe'&&key==='Z')return displayPoseFrame('work');
 return displayPoseFrame(levelGeometry.axes.find(a=>a.key===key).source);
}
function portalVisualPoint(p,pose){
 const gate=displayPortal(),i=pose==='rightColumn'?1:0,clearance=displayClearance();let local;
 if(pose==='leftColumn'||pose==='rightColumn'){
  const anchor=levelCoordinates(levelGeometry.toolPoints[i].x,levelGeometry.toolPoints[i].z),column=gate.columns[i],relative=[p[0]-anchor.x,p[1]-.66,p[2]-anchor.z];
  local=column.relative.rotate(relative).map((v,j)=>v+column.foot[j]);
 }else{
  const anchor=levelCoordinates(levelGeometry.poses.tool.anchor.x,levelGeometry.poses.tool.anchor.z),nominalSpan=levelCoordinates(levelGeometry.toolPoints[1].x,0).x-levelCoordinates(levelGeometry.toolPoints[0].x,0).x;
  local=gate.local.rotate([(p[0]-anchor.x)*gate.span/nominalSpan,p[1]-3.17,p[2]-anchor.z]).map((v,j)=>v+gate.centre[j]);
 }
 return gate.world(local).map((v,j)=>v+(j===1?clearance:0));
}
function levelMappedVisualPoint(p,pose='bed'){
 if(!levelSolution||!levelConfig||!levelGeometry)return [...p];
 if(pose.startsWith('pad:'))return [...p];
 if(levelGeometry.portal&&['tool','leftColumn','rightColumn'].includes(pose))return portalVisualPoint(p,pose);
 if(pose.startsWith('support:')){
  const top=levelMappedVisualPoint([p[0],.195,p[2]],'bed'),bottom=[p[0],.09,p[2]],t=(p[1]-.07)/.22;
  return bottom.map((v,i)=>v+(top[i]-v)*t);
 }
 if(current.kind==='compact'&&pose==='work')return compactWorkVisualPoint(p,positions,levelSolution,machineProfile,displayFactor()).map((v,i)=>v+(i===1?displayClearance():0));
 if(pose==='bed'){
  const top=displaySurfacePoint(p[0],p[2]),slope=structuralSurface(p[0]).slopeAt(p[0],p[2]),normal=current.kind==='compact'?compactSupportFrame(levelSolution,p[0],p[2],displayFactor()).up:levelGeometry.portal?window.Leveling.compose(displayPortal().common,displaySupportFrame({lr:slope.lr-levelSolution.lr,fb:slope.fb-levelSolution.fb})).up:displaySupportFrame(slope).up,thickness=p[1]-.66;
  return top.map((v,i)=>v+normal[i]*thickness);
 }
 const info=levelGeometry.poses[pose]||levelGeometry.poses.tool,rawOffset=pose==='tool'?columnLayoutOffset(current):{x:0,z:0},offset=displayCoordinates([rawOffset.x,0,rawOffset.z]);
 const anchor=displayCoordinates([info.anchor.x,.66,info.anchor.z]),origin=pose==='work'&&levelSolution.parts?(()=>{const gate=displayPortal(),h=levelSolution.parts.bed.heightAt(anchor[0],anchor[2])-(levelSolution.plane.a*anchor[0]+levelSolution.plane.b*anchor[2]+levelSolution.plane.c);return gate.world([anchor[0],h*displayFactor()/1000,anchor[2]]).map((v,i)=>v+(i===1?displayClearance():0));})():displaySurfacePoint(anchor[0],anchor[2]),point=[p[0]+offset[0],p[1],p[2]+offset[2]];
 const q=displayPoseFrame(pose).rotate(point.map((v,i)=>v-anchor[i]));return q.map((v,i)=>v+origin[i]);
}
function levelVisualPoint(p,pose='bed'){return levelMappedVisualPoint(displayCoordinates(p),pose);}
let bodyVisualFrame=null,bodyVisualFrameProfile=null,bodyVisualFrameKind='',bodyVisualFrameFactor=0;
function displayBodyFrame(){
 const factor=displayFactor();
 if(machineProfile!==bodyVisualFrameProfile||current.kind!==bodyVisualFrameKind||factor!==bodyVisualFrameFactor){bodyVisualFrameProfile=machineProfile;bodyVisualFrameKind=current.kind;bodyVisualFrameFactor=factor;bodyVisualFrame=intrinsicBodyFrame(axisConfig(current).filter(a=>['X','Y','Z'].includes(a.key)),machineProfile,factor);}
 return bodyVisualFrame;
}
function levelMappedBodyVisualPoint(p,pose='bed'){
 if(!levelGeometry||levelGeometry.portal||!machineProfile||pose==='bed'||pose==='work'||pose.startsWith('pad:')||pose.startsWith('support:'))return levelMappedVisualPoint(p,pose);
 const info=levelGeometry.poses[pose]||levelGeometry.poses.tool,rawOffset=pose==='tool'?columnLayoutOffset(current):{x:0,z:0},offset=displayCoordinates([rawOffset.x,0,rawOffset.z]),anchor=displayCoordinates([info.anchor.x,.66,info.anchor.z]);
 const relative=[p[0]+offset[0]-anchor[0],p[1]-anchor[1],p[2]+offset[2]-anchor[2]],rotated=displayBodyFrame().rotate(relative);
 return levelMappedVisualPoint([rotated[0]+anchor[0]-offset[0],rotated[1]+anchor[1],rotated[2]+anchor[2]-offset[2]],pose);
}
function levelBodyVisualPoint(p,pose='bed'){return levelMappedBodyVisualPoint(displayCoordinates(p),pose);}
function levelAxisVisualPoint(p,origin,pose,bodyOrigin=levelMappedBodyVisualPoint(origin,pose),key){
 if(key&&levelGeometry){const input=p.map((q,i)=>q-origin[i]),v=displayAxisFrame(key).rotate(input),scale=levelGeometry.portal&&Math.hypot(...v)>0?Math.hypot(...input)/Math.hypot(...v):1;return v.map((q,i)=>q*scale+bodyOrigin[i]);}
 const q=levelMappedVisualPoint(p,pose),supportOrigin=levelMappedVisualPoint(origin,pose);
 // Arrow points are already physical and contain intrinsic direction once.
 return q.map((v,i)=>v+bodyOrigin[i]-supportOrigin[i]);
}
function updateLevelStages(machineResult=null,target=false){
 const averageLevel=Math.max(Math.abs(levelSolution.lr),Math.abs(levelSolution.fb)),coarse=averageLevel<=.020000001;
 adjustmentStage=Number($('adjustStep').value)>=.01?'coarse':'fine';
 $('coarsePanel').hidden=adjustmentStage!=='coarse';$('finePanel').hidden=adjustmentStage!=='fine';
 $('supportPhaseTitle').textContent=adjustmentStage==='coarse'?'粗調整で支持点を動かす':'微調整で支持点を少し動かす';
 $('stageStatus').textContent=coarse?'平均レベルの目安内 · 微調整へ':'まず平均の傾きを整える';
 $('stageStatus').className='stage-status'+(coarse?' within':'');
 $('stageAverageLR').textContent=Math.abs(levelSolution.lr)<=.020000001?'目安内':levelSolution.lr>0?'右が高い':'左が高い';
 $('stageAverageFB').textContent=Math.abs(levelSolution.fb)<=.020000001?'目安内':levelSolution.fb>0?'奥が高い':'手前が高い';
 $('stageAverageLR').setAttribute('data-value',String(levelSolution.lr));$('stageAverageFB').setAttribute('data-value',String(levelSolution.fb));
 $('stageStatus').setAttribute('data-coarse-ready',String(coarse));
 $('stageResidual').textContent=coarse?'平均の傾きが揃っても、本体の固有精度は残ります。局所姿勢差・支持面のねじれも別に確認し、同じ支持点を微調整します。':'初期状態はランダムな支持高さと、本体の固有精度を重ねています。支持点を動かし、まず平均の左右・前後傾きを目安へ近づけます。';
 $('coarseAdjust').setAttribute('aria-pressed',String(adjustmentStage==='coarse'));$('fineAdjust').setAttribute('aria-pressed',String(adjustmentStage==='fine'));
 $('coarseAdjust').setAttribute('aria-controls','coarsePanel');$('fineAdjust').setAttribute('aria-controls','finePanel');
 const bubbleOffset=value=>Math.max(-32,Math.min(32,value/.02*6));
 $('coarseBubbleLR').style.left=(50+bubbleOffset(levelSolution.lr))+'%';
 // Positive front/back slope is high at the back: the vertical bubble moves up.
 $('coarseBubbleFB').style.setProperty('--bubble-position',(50-bubbleOffset(levelSolution.fb))+'%');
 const significant=machineProfile&&Math.max(...accuracyRange.flatMap(s=>s.geometry.pairs.map(p=>Math.abs(p.deviationMicroradians*.3))),...Object.values(machineProfile.guides).map(g=>g.microns))>20.000001;
 $('fineStatus').textContent=target?(significant?'支持姿勢の調整目安内。残る誤差も確認':'微調整の目安内。本体や支持姿勢に残る誤差を確認'):'直角と姿勢を見ながら微調整';
 $('fineStatus').setAttribute('data-target',String(target));$('fineStatus').setAttribute('data-body-significant',String(!!significant));if(machineResult)$('fineStatus').setAttribute('data-gap',String(machineResult.gap));
 $('fineStatus').className='stage-status'+(target&&!significant?' within':'');
 $('fineAverageNotice').textContent=coarse?'平均の傾きは粗調整の目安内です。微調整では直角と姿勢を整えるため、平均の傾きが少し動く場合があります。':'平均の傾きが粗調整の目安から外れています。微調整では直角と姿勢との釣り合いも見ます。必要なら粗調整に戻って比較してください。';
 $('fineExample').disabled=$('applyBestLevel').disabled;
 const progress=$('fineOverallProgress');
 if(fineStartEvaluation?.key!==adjustmentContextKey())fineStartEvaluation=null;
 const currentScore=machineEvaluation(supportHeights).objective;
 if(fineStartEvaluation){
  const delta=currentScore-fineStartEvaluation.objective,trend=delta < -1e-8?'better':delta>1e-8?'worse':'similar';
  progress.textContent='微調整を始めた状態からの総合評価：'+(trend==='better'?'良くなりました':trend==='worse'?'悪くなっています':'ほぼ同じです')+'。初期からの直角図とは別に、代表位置全体の直角と姿勢を比べます。';
  progress.setAttribute('data-before',String(fineStartEvaluation.objective));progress.setAttribute('data-current',String(currentScore));progress.setAttribute('data-delta',String(delta));progress.setAttribute('data-trend',trend);
 }else{progress.textContent='微調整開始時の比較基準はまだありません。代表位置全体の直角と姿勢を総合して調整の目安を確認します。';for(const name of ['before','current','delta','trend'])progress.setAttribute('data-'+name,'');}
 const supportStatus=$('supportStageStatus');
 supportStatus.textContent=adjustmentStage==='coarse'?'粗調整 · '+(coarse?'平均の目安内':'平均の傾き調整中'):'微調整 · '+(target?(significant?'目安内・残る誤差':'調整の目安内'):'直角と姿勢を調整中');
 supportStatus.setAttribute('data-stage',adjustmentStage);supportStatus.setAttribute('data-ready',String(adjustmentStage==='coarse'?coarse:target));
 updateAdjustmentHint(coarse,target);
}
function updateAdjustmentHint(coarse,target){
 const step=Number($('adjustStep').value),key=JSON.stringify([current.id,current.kind,supportHeights,levelConfig,machineProfile,step]);
 const score=heights=>adjustmentStage==='coarse'?(()=>{const s=machineSolution(heights);return s.lr*s.lr+s.fb*s.fb;})():machineEvaluation(heights).objective;
 if(key!==adjustmentHintKey){
  const before=score(supportHeights),threshold=Math.max(1e-12,Math.abs(before)*1e-10);let best=null;
  for(let i=0;i<supports.length;i++)for(const direction of [-1,1]){
   const next=[...supportHeights],height=Math.round((next[i]+direction*step)*1000)/1000;if(!bounded(height,-.5,.5)||height===next[i])continue;next[i]=height;
   const after=score(next);if(after<before-threshold&&(!best||after<best.after))best={i,direction,before,after,step};
  }
  adjustmentHintKey=key;adjustmentHintValue=best;
 }
 const hint=$(adjustmentStage==='coarse'?'coarseHint':'fineHint'),best=adjustmentHintValue;
 hint.setAttribute('data-support',best?String(best.i):'');hint.setAttribute('data-direction',best?String(best.direction):'');for(const [name,value] of [['before-score',best?.before],['after-score',best?.after],['step',best?.step]])hint.setAttribute('data-'+name,value===undefined?'':String(value));
 hint.textContent=adjustmentStage==='coarse'&&coarse?'平均の傾きが揃いました。微調整へ切り替え、本体や支持姿勢に残る誤差を見ます。':adjustmentStage==='fine'&&target?'この個体の調整目安に近づきました。直角の変化と、本体や支持姿勢に残る誤差を確認します。':best?String.fromCharCode(65+best.i)+'を少し'+(best.direction>0?'上げる':'下げる')+'方向を試せます。'+(adjustmentStage==='fine'?'代表位置全体の総合評価が良くなる候補です。今の位置の各直角がすべて改善するとは限りません。':'平均の傾きが小さくなる候補です。'):'単独の支持点を少し動かすだけでは改善する候補がありません。複数の支持点の関係を見直すか、調整例を試してください。';
 // Keep the support-card reminder short while the full lesson stays above.
 const reminder=$('supportStageHint'),ready=adjustmentStage==='coarse'?coarse:target,mode=ready?'goal':best?'candidate':'stalled';
 reminder.textContent=ready?(adjustmentStage==='coarse'?'微調整へ。残る誤差を確認':'初期との差・残る誤差を確認'):best?String.fromCharCode(65+best.i)+'を少し'+(best.direction>0?'上げる':'下げる')+'方向へ':'単独候補なし · 参考例を比較';
 reminder.setAttribute('data-mode',mode);reminder.setAttribute('data-support',mode==='candidate'?String(best.i):'');reminder.setAttribute('data-direction',mode==='candidate'?String(best.direction):'');
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
 const face=v=>{const heights=v.map(p=>{const q=levelCoordinates(p[0],p[2]);return structuralSurface(q.x).heightAt(q.x,q.z);});return {v,axes:[],shade:1,surface:true,height:heights.reduce((a,b)=>a+b,0)/heights.length};};
 if(points.length===3){
  const [a,b,c]=points,n=4,out=[];
  const v=(i,j)=>[a.x+(b.x-a.x)*i/n+(c.x-a.x)*j/n,y,a.z+(b.z-a.z)*i/n+(c.z-a.z)*j/n];
  for(let i=0;i<n;i++)for(let j=0;i+j<n;j++){out.push(face([v(i,j),v(i+1,j),v(i,j+1)]));if(i+j<n-1)out.push(face([v(i+1,j),v(i+1,j+1),v(i,j+1)]));}
  return out;
 }
 if(m.supportLayout==='irregular'){
  const faces=[],nx=12,nz=32,x0=-1.56,x1=1.56,z0=-3.55,z1=3.55;
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
   const a=x0+(x1-x0)*i/nx,b=x0+(x1-x0)*(i+1)/nx,c=z0+(z1-z0)*j/nz,d=z0+(z1-z0)*(j+1)/nz;
   const x=(a+b)/2,z=(c+d)/2;if(Math.abs(x)>.89&&Math.abs(z-m.columnZ)>.39)continue;
   faces.push(face([[a,y,c],[b,y,c],[b,y,d],[a,y,d]]));
  }
  return faces;
 }
 const subdivide=values=>{const a=[...new Set(values)].sort((x,z)=>x-z),out=[a[0]];for(let i=1;i<a.length;i++)for(let j=1;j<=4;j++)out.push(a[i-1]+(a[i]-a[i-1])*j/4);return out;};
 const xs=subdivide(points.map(p=>p.x)),zs=subdivide(points.map(p=>p.z)),faces=[];
 for(let i=1;i<xs.length;i++)for(let j=1;j<zs.length;j++)faces.push(face([[xs[i-1],y,zs[j-1]],[xs[i],y,zs[j-1]],[xs[i],y,zs[j]],[xs[i-1],y,zs[j]]]));
 return faces;
}
function refreshSupportControls(editingIndex=-1){
 supports.forEach((s,i)=>{const input=$('height'+i);if(!input)return;if(i!==editingIndex)input.value=cleanNumber(supportAdjustment(i),3);input.setAttribute('min',String(-.5-supportBaseline(i)));input.setAttribute('max',String(.5-supportBaseline(i)));input.closest('.support-row').classList.toggle('selected',selected===i);$('supportState'+i).textContent=supportAdjustment(i)>0?'上げた':supportAdjustment(i)<0?'下げた':'未調整';$('down'+i).disabled=supportHeights[i]<=-.5+1e-9;$('up'+i).disabled=supportHeights[i]>=.5-1e-9;});
 $('supportMap').querySelectorAll('.map-point').forEach((b,i)=>{const index=Number(b.dataset.support);b.classList.toggle('active',index===selected);b.setAttribute('aria-pressed',String(index===selected));});
 const support=supports[selected];$('selectedSupportLabel').textContent=support?'支持点 '+String.fromCharCode(65+selected)+'・'+support.name:'';
 $('lowerSupport').disabled=!support||supportHeights[selected]<=-.5+1e-9;$('raiseSupport').disabled=!support||supportHeights[selected]>=.5-1e-9;
 $('lowerSupport').setAttribute('aria-label',support?String.fromCharCode(65+selected)+'・'+support.name+'を下げる':'支持点を下げる');$('raiseSupport').setAttribute('aria-label',support?String.fromCharCode(65+selected)+'・'+support.name+'を上げる':'支持点を上げる');
}
function setSupportHeight(i,value,editing=false){
 invalidateLevelImport();stopMotion();
 if(!bounded(value,-.5,.5)){$('levelInputMessage').textContent='調整可能な範囲の数値を入力してください。直前の調整量へ戻しました。';$('height'+i).value=cleanNumber(supportAdjustment(i),3);refreshSupportControls();return;}
 supportHeights[i]=Math.round(value*1000)/1000;if(!editing)$('height'+i).value=cleanNumber(supportAdjustment(i),3);selected=i;$('levelInputMessage').textContent=String.fromCharCode(65+i)+'を調整しました。模型と直角の変化を確認してください。';updateLeveling(true,editing?i:-1);
}
function changeSupportHeight(i,delta){setSupportHeight(i,Math.max(-.5,Math.min(.5,Math.round((supportHeights[i]+delta)*1000)/1000)));}
function updateLeveling(save=true,editingIndex=-1){
 const points=supports.map((s,i)=>({...levelCoordinates(s.x,s.z),h:supportHeights[i]}));
 levelSolution=machineSolution(supportHeights);refreshSupportControls(editingIndex);
 updateAccuracy();
 const z=Number($('measurePos').value)*levelConfig.depth/2,local=structuralSurface(0).slopeAt(0,z);
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
 updateLevelStages(machineResult,target);
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
 try{localStorage.setItem(levelKey(),JSON.stringify(levelRecord()));$('levelSaveStatus').textContent='現在の状態をブラウザに記録しました。ページを開き直すと再抽選します。同じ調整を続ける場合はJSONを保存・読込してください。';return true;}catch{$('levelSaveStatus').textContent='このブラウザでは自動保存できません。JSONで保存できます。';return false;}
}
function applyLevelPreset(type){
 if(type==='twist'&&supports.length===3||type==='middle'&&!current.supportLayout&&(!current.grid||(current.grid[0]<3&&current.grid[1]<3)))return;
 invalidateLevelImport();stopMotion();levelExercise=null;
 supportHeights=supports.map(s=>{
  if(type==='middle'&&current.supportLayout==='irregular')return s.group==='bed'&&/^bed-(?:left|center|right)-2$/.test(s.id)? .15:0;
  const x=s.x/(current.w*.4),z=s.z/(current.d*.4);
  return Math.round((type==='right'?.1*x:type==='front'?-.1*z:type==='twist'?.1*x*z:Math.abs(x)<.99||Math.abs(z)<.99?.15:0)*1000)/1000;
 });$('levelInputMessage').textContent='状態パターンを設定しました。';updateLeveling();
}
$('zero').onclick=()=>{invalidateLevelImport();stopMotion();supportHeights=supports.map(()=>0);levelExercise=null;$('levelInputMessage').textContent='全支持点を同じ高さへ揃えました。各欄は初期からの上げ下げを示します。';updateLeveling();};
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>applyLevelPreset(b.dataset.preset));
$('measurePos').onchange=()=>updateLeveling();$('levelSensitivity').onchange=()=>updateLeveling();$('exaggerate').onchange=()=>updateLeveling();$('showLevelSurface').onchange=()=>drawScene();$('adjustStep').onchange=()=>updateLeveling();
for(const [id,value] of [['coarseAdjust',.01],['fineAdjust',.001]])$(id).onclick=()=>{if(trainingMenuOpen)return;stopMotion();if(value===.001&&adjustmentStage==='coarse')captureFineStart();$('adjustStep').value=String(value);$('levelInputMessage').textContent=(value===.01?'粗調整':'微調整')+'へ切り替えました。同じ個体と支持点で続けます。';updateLeveling();};
for(const [id,direction] of [['lowerSupport',-1],['raiseSupport',1]])$(id).onclick=()=>{if(trainingMenuOpen||$(id).disabled)return;stopMotion();const step=adjustmentStage==='coarse'?.01:.001;$('adjustStep').value=String(step);changeSupportHeight(selected,direction*step);};
$('coarseExample').onclick=()=>{$('zero').onclick();$('levelInputMessage').textContent='粗調整の手本を適用しました。支持点を同じ高さへ揃えた例です。次は残る直角と姿勢を見ます。';};
$('fineExample').onclick=()=>{$('applyBestLevel').onclick();$('levelInputMessage').textContent='微調整の参考例を適用しました。実際の支持高さを変えた手本です。本体や支持姿勢に残る誤差も見比べてください。';};
for(const [id,key,min,max] of [['supportWidth','width',.5,20],['supportDepth','depth',.5,20]]){const apply=()=>{invalidateLevelImport();const value=Number($(id).value);if(!bounded(value,min,max))return false;levelConfig[key]=value;$('levelInputMessage').textContent='支持寸法を更新しました。';updateLeveling();return true;};$(id).oninput=apply;$(id).onchange=()=>{if(!apply()){$(id).value=levelConfig[key];$('levelInputMessage').textContent='支持幅は0.50〜20.00 mで入力してください。';}};}
$('impactOffset').oninput=()=>{invalidateLevelImport();const value=Number($('impactOffset').value);if(bounded(value,.1,2)){levelConfig.offset=value;updateLeveling();}};
$('impactOffset').onchange=()=>{const value=Number($('impactOffset').value);if(!bounded(value,.1,2)){$('impactOffset').value=levelConfig.offset;$('levelInputMessage').textContent='評価長は0.10〜2.00 mです。直前の有効値へ戻しました。';}else levelConfig.offset=value;updateLeveling();};
$('startLevelExercise').onclick=()=>{invalidateLevelImport();stopMotion();resetAdjustmentProgress();supportHeights=supports.map(()=>Math.round((Math.random()*.4-.2)*1000)/1000);const sign=Math.random()<.5?-1:1;supportHeights[0]=-.4*sign;supportHeights[1]=.4*sign;levelExercise={solved:false};$('levelInputMessage').textContent=machineProfile?'同じ個体で別の支持状態を設定しました。比較基準は抽選時の支持高さのままです。':'新しい調整問題を設定しました。';updateLeveling();};
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
  const data=JSON.parse(text);if(data.calculationModel!==currentCalculationModel())throw Error('calculation-model');if(!compatibleSupportLayout(data))throw Error('support-layout');if(!validLevelRecord(data))throw Error('不正な調整データ');
  applyLevelRecord(data);updateLeveling();$('levelInputMessage').textContent='調整データを読み込みました。';$('levelSaveStatus').textContent='同じ機種・支持配置の調整データを読み込みました。';
 }catch(error){if(isCurrent()){const message=error.message==='calculation-model'?'読込できません。計算仕様が異なる旧版データです。旧データは変更していません。新しい仕様で保存したJSONを選んでください。':error.message==='support-layout'?'読込できません。支持配置が異なる旧版データです。同じ機種・支持配置で保存したJSONを選んでください。':'読込できません。同じ機械・方式の調整JSONと、数値範囲を確認してください。';$('levelInputMessage').textContent=message;$('levelSaveStatus').textContent=message;}}
};

'use strict';
// 編集する場合、機械の名称・説明・モデル種別はこの一覧で変更できます。
const machines = [
{id:'vertical',name:'小型立形・4点支持',tag:'テーブルXY・主軸頭Z',example:'ロボドリル系を参考にした小型教材',kind:'compact',w:2.6,d:2.7,grid:[2,2],defaultMode:'compact',layoutId:'compact-four-v1',structure:'片側コラムから主軸頭が張り出す小型立形。テーブルがX・Y、主軸頭がZ方向へ移動します。標準サイズは扱いません。',focus:'4点支持の平均傾きと、ベースのねじれ。',impact:'全体の傾きと、案内面の相対関係が変わるねじれを分けて学びます。',supportEvidence:'4点の教材用配置です。特定のロボドリル型式の基礎図や荷重配分の再現ではありません。',source:'https://www.fanuc.co.jp/ja/product/robodrill/alphadibplus.html'},
{id:'horizontal',name:'横形・Haas EC-630',tag:'NGC・8点支持',example:'Haas EC-630（NGC）の据付手順を参考',kind:'horizontal',w:3.4,d:4.6,grid:[2,4],layoutId:'haas-ec630-ngc-eight-v1',structure:'横向き主軸と回転パレットを備える横形。Haas EC-630（NGC）の据付手順にある四隅4本と中央4本、合計8本を反映します。',focus:'8点の支持関係と、移動位置による姿勢の違い。',impact:'直線軸の幾何関係と支持面の変化を確認します。',supportEvidence:'支持数8本はHaas公式据付手順で確認。間隔・寸法は教材用の概略配置です。主支持・補助支持の荷重配分、パレット交換機構は再現しません。',source:'https://www.haascnc.com/service/troubleshooting-and-how-to/how-to/-ec-630--installation---ngc.html'},
{id:'travel',name:'立形・移動コラム',tag:'テーブル固定・コラム移動',example:'固定テーブルの長尺加工機',kind:'travel',w:5.4,d:2.6,grid:[3,2],structure:'テーブルとワークは固定。コラムがX方向に走り、主軸頭側がY・Z方向に移動します。',focus:'長いベッドの各位置と、コラムの移動に伴う姿勢。',impact:'端だけでなく、中間位置の案内精度・姿勢も確認します。',source:'https://www.mazak.com/jp-ja/products/vtc/'},
{id:'gate',name:'固定門形・L3 3000',tag:'L3構造参考・教材用15点',example:'長手ベッド9点＋左右柱側各3点',kind:'double',w:3.5625,d:8.55,grid:null,defaultMode:'l3-3000',layoutId:'hwacheon-l3-3000-teaching-15point-v1',previousLayouts:['hwacheon-l3-3000-foundation-r139'],supportLayout:'irregular',columnZ:.825,columnX:1.10,structure:'長手ベッドと左右柱側の張り出しを持つ固定門形。テーブルX、主軸サドルY、ラムZの構成です。L3 3000の構造を参考に、長手ベッドを3×3の9点、左右柱側を各3点とした合計15点の教材用配置です。',focus:'長手ベッド9点と、左右柱側各3点の支持関係。',impact:'不規則な支持面の幾何補間により姿勢を比較します。実機の剛性・荷重・基礎アンカー・弾性変形を再現する解析ではありません。',supportEvidence:'メーカー作成L-SERIES Rev1.39の基礎図は24か所ですが、この教材は長手ベッドを9点に簡略化しています。柱側6点は同図の座標を参考にしています。実機の15点支持を示すものではなく、主支持／補助支持や荷重配分は再現しません。',source:'https://hmeholdings.com/wp-content/uploads/2023/03/L-SERIES.pdf'},
{id:'gantry',name:'移動門形・ガントリー',tag:'テーブル固定・門全体が移動',example:'固定門形とは動く側が逆',kind:'gantry',w:4,d:5.8,grid:[2,4],structure:'テーブルとワークは固定。左右の走行レール上を門全体がX方向に移動します。',focus:'左右走行レールの相対姿勢と、移動範囲の基礎・支持。',impact:'左右レールの関係と門の姿勢を確認します。同期駆動などの機種固有の調整は別途必要です。',source:'https://www.shibaura-machine.co.jp/jp/product/machinetool/lineup/s_new/spec.html'},
{id:'five',name:'5軸・テーブル旋回形',tag:'XYZ＋A/Cの旋回',example:'テーブルXY・主軸頭Zの学習モデル',kind:'five',w:3.4,d:3.3,grid:null,structure:'XYZの直線移動に、テーブルの傾斜Aと回転Cを加えた構成。ここではテーブル側XY・主軸頭Zを採用しています。',focus:'指定支持点での据付と、直線軸・回転軸の幾何関係。',impact:'回転中心や旋回軸の確認が必要です。軸の分担・名称は実機により異なります。',source:'https://us.dmgmori.com/products/machines/milling/5-axis-milling/monoblock/dmu-75-monoblock-2nd'},
{id:'lathe',name:'NC旋盤・2軸',tag:'X径方向・Z主軸方向',example:'基本の2軸旋盤（Y軸なし）',kind:'lathe',w:5,d:2.1,grid:[3,2],structure:'主軸台を固定し、刃物台をZ（主軸方向）・X（径方向）に動かします。このモデルにY軸はありません。',focus:'ベッド長手方向の各位置での横断方向の水準器。',impact:'ベッドのねじれと主軸・案内の関係を確認します。テーパの原因は据付以外にもあります。',source:'https://www.haascnc.com/service/online-operator-s-manuals/lathe-operator-s-manual/lathe---introduction.html'}
];
// 内部の描画座標は左右=x、上=y、奥=z。工作機械の軸名は機構ごとに明示して割り当てる。
const axisColors={X:'#d35455',Y:'#208768',Z:'#397ed1',A:'#8e5caf',C:'#bc6a2f'};
let positions={X:0,Y:0,Z:0,A:0,C:0}, selectedAxis='X', machineMode='compact';
function displayMachine(base){return {...base};}
function axisConfig(m){
 const a=(key,part,direction,vector,amp)=>({key,part,direction,vector,amp});
 if(['vertical','compact','portal'].includes(m.kind))return [a('X','テーブル','左右',[1,0,0],.45),a('Y','サドル＋テーブル','前後',[0,0,1],.4),a('Z','主軸頭＋工具','上下',[0,1,0],.3)];
 if(m.kind==='travel')return [a('X','コラム＋主軸頭','長手（左右）',[1,0,0],1.0),a('Y','主軸頭の前後スライド','前後',[0,0,1],.35),a('Z','主軸頭＋工具','上下',[0,1,0],.3)];
 if(m.kind==='horizontal')return [a('X','コラム＋主軸頭','左右',[1,0,0],.55),a('Y','主軸頭＋工具','上下',[0,1,0],.3),a('Z','パレット台＋ワーク','主軸方向（前後）',[0,0,1],.45)];
 if(['double','gantry'].includes(m.kind))return [a('X',m.kind==='double'?'テーブル＋ワーク':'門全体＋主軸側','長手（前後）',[0,0,1],.7),a('Y','主軸サドル＋ラム','門幅（左右）',[1,0,0],.65),a('Z','ラム＋主軸・工具','上下',[0,1,0],.28)];
 if(m.kind==='five')return [a('X','トラニオン一式','左右',[1,0,0],.35),a('Y','サドル＋トラニオン一式','前後',[0,0,1],.35),a('Z','主軸頭＋工具','上下',[0,1,0],.3),a('A','揺りかご＋テーブル','X軸回りの傾斜',[1,0,0],.55),a('C','回転テーブル＋ワーク','テーブル軸回りの回転',[0,1,0],1.1)];
 return [a('X','刃物台','径方向',[0,0,1],.35),a('Z','往復台＋刃物台','主軸方向（左右）',[1,0,0],.7)];
}
function transformedPoint(p,axes,m,state=positions){
 let q=[...p];
 // C回転はA傾斜前のテーブル座標で適用し、Aの親子関係を保つ。
 const pivot=[0,1.25,-.45];
 if(axes.includes('C')){const t=state.C*Math.PI/100,dx=q[0]-pivot[0],dz=q[2]-pivot[2];q[0]=pivot[0]+dx*Math.cos(t)+dz*Math.sin(t);q[2]=pivot[2]-dx*Math.sin(t)+dz*Math.cos(t);}
 if(axes.includes('A')){const t=state.A*.45/100,dy=q[1]-pivot[1],dz=q[2]-pivot[2];q[1]=pivot[1]+dy*Math.cos(t)-dz*Math.sin(t);q[2]=pivot[2]+dy*Math.sin(t)+dz*Math.cos(t);}
 for(const a of axisConfig(m).filter(a=>['X','Y','Z'].includes(a.key)))if(axes.includes(a.key))q=q.map((v,i)=>v+a.vector[i]*a.amp*state[a.key]/100);
 return q;
}
function displayRotatedPoint(p,axes,state=positions){
 let q=displayCoordinates(p);const pivot=displayCoordinates([0,1.25,-.45]);
 if(axes.includes('C')){const t=state.C*Math.PI/100,dx=q[0]-pivot[0],dz=q[2]-pivot[2];q[0]=pivot[0]+dx*Math.cos(t)+dz*Math.sin(t);q[2]=pivot[2]-dx*Math.sin(t)+dz*Math.cos(t);}
 if(axes.includes('A')){const t=state.A*.45/100,dy=q[1]-pivot[1],dz=q[2]-pivot[2];q[1]=pivot[1]+dy*Math.cos(t)-dz*Math.sin(t);q[2]=pivot[2]+dy*Math.sin(t)+dz*Math.cos(t);}
 return q;
}
function inverseDisplayRotation(frame,v){const basis=[[1,0,0],[0,1,0],[0,0,1]].map(q=>frame.rotate(q));return basis.map(q=>q.reduce((sum,n,i)=>sum+n*v[i],0));}
const displayMovementCache=new Map();let displayMovementKey='',displayMovementGeometry=null;
function prepareDisplayMovement(){
 if(displayMovementGeometry===levelGeometry)return;
 const key=JSON.stringify([current.id,current.kind,levelConfig,displayFactor(),supportHeights,machineProfile]);
 if(key!==displayMovementKey){displayMovementKey=key;displayMovementCache.clear();}
 displayMovementGeometry=levelGeometry;
}
function displayMovement(axes,m,state,pose){
 if(!levelGeometry||pose==='bed'||pose.startsWith('pad:')||pose.startsWith('support:'))return [0,0,0];
 if(m.kind==='compact')return axisConfig(m).filter(a=>axes.includes(a.key)&&['X','Y','Z'].includes(a.key)).reduce((sum,a)=>{const v=displayCoordinates(a.vector);return sum.map((q,i)=>q+v[i]*a.amp*state[a.key]/100);},[0,0,0]);
 if(levelGeometry.portal)return axisConfig(m).filter(a=>axes.includes(a.key)&&['X','Y','Z'].includes(a.key)).reduce((sum,a)=>{
  const nominal=displayCoordinates(a.vector),length=Math.hypot(...nominal)*a.amp*state[a.key]/100;
  let v=pose==='tool'&&a.key!=='X'?accuracyVisualVector(a.key):a.vector;
  if(pose==='tool'&&a.key!=='X'){const p=displayPortal(),span=levelCoordinates(levelGeometry.toolPoints[1].x,0).x-levelCoordinates(levelGeometry.toolPoints[0].x,0).x,norm=Math.hypot(...p.local.rotate(v));v=[v[0]*span/p.span/norm,v[1]/norm,v[2]/norm];}
  return sum.map((q,i)=>q+v[i]*length);
 },[0,0,0]);
 prepareDisplayMovement();
 const groupKey=JSON.stringify([axes,state,pose]);if(displayMovementCache.has(groupKey))return displayMovementCache.get(groupKey);
 const active=axisConfig(m).filter(a=>axes.includes(a.key)&&['X','Y','Z'].includes(a.key)),baseState={...state};active.forEach(a=>baseState[a.key]=0);
 const g=state===positions?levelGeometry:geometryModel(state),before=geometryModel(baseState),info=g.poses[pose]||g.poses.tool,baseInfo=before.poses[pose]||before.poses.tool;
 const anchor=displayCoordinates([info.anchor.x,.66,info.anchor.z]),baseAnchor=displayCoordinates([baseInfo.anchor.x,.66,baseInfo.anchor.z]),dA=anchor.map((v,i)=>v-baseAnchor[i]);
 const s=displaySurfacePoint(anchor[0],anchor[2]),s0=displaySurfacePoint(baseAnchor[0],baseAnchor[2]),dS=s.map((v,i)=>v-s0[i]),desired=[0,0,0],transport=[0,0,0],nonuniform=levelSolution.residual>1e-10||Math.abs(levelSolution.twist)>1e-10;
 for(const a of active){
  const source=g.axes.find(q=>q.key===a.key).source,axisFrame=displayAxisFrame(a.key),amplitude=Math.hypot(...displayCoordinates(a.vector))*a.amp*state[a.key]/100,direction=axisFrame.rotate(accuracyVisualVector(a.key));direction.forEach((v,i)=>desired[i]+=v*amplitude);
  if(nonuniform){
   const axisBase=geometryModel({...state,[a.key]:0}),axisInfo=axisBase.poses[pose]||axisBase.poses.tool,axisAnchor=displayCoordinates([axisInfo.anchor.x,.66,axisInfo.anchor.z]),axisDA=anchor.map((v,i)=>v-axisAnchor[i]),movesAnchor=Math.hypot(...axisDA)>1e-12,nominal=axisFrame.rotate(a.vector);
   const axisWorld=direction.map((v,i)=>(v-(movesAnchor?nominal[i]:0))*amplitude),parent=inverseDisplayRotation(displayPoseFrame(pose),axisWorld),local=machineProfile&&pose!=='work'?inverseDisplayRotation(displayBodyFrame(),parent):parent;
   local.forEach((v,i)=>transport[i]+=v+(movesAnchor?axisDA[i]:0));
  }
 }
 // On a nonuniform support surface, preserve the nominal contact transport.
 // Only the intrinsic guide-direction difference is added. Local posture
 // changes naturally add vertex motion beyond a representative guide arrow.
 if(nonuniform){displayMovementCache.set(groupKey,transport);return transport;}
 const parentDelta=inverseDisplayRotation(displayPoseFrame(pose),desired.map((v,i)=>v-dS[i])),localDelta=machineProfile&&pose!=='work'?inverseDisplayRotation(displayBodyFrame(),parentDelta):parentDelta;
 const result=dA.map((v,i)=>v+localDelta[i]);displayMovementCache.set(groupKey,result);return result;
}
function displayTransformedPoint(p,axes,m,state=positions,pose='bed'){
 const q=displayRotatedPoint(p,axes,state),move=displayMovement(axes,m,state,pose);return q.map((v,i)=>v+move[i]);
}
let portalSpindleVisualCache=null;
function portalSpindleVisualFrame(m=current,state=positions){
 if(!levelGeometry?.portal||!machineProfile||!['double','gantry'].includes(m.kind))return null;
 const factor=displayFactor(),keys=['X','Y','Z','A','C'];
 if(portalSpindleVisualCache?.geometry===levelGeometry&&portalSpindleVisualCache.factor===factor&&portalSpindleVisualCache.kind===m.kind&&keys.every((k,i)=>portalSpindleVisualCache.state[i]===state[k]))return portalSpindleVisualCache;
 const unit=v=>{const n=Math.hypot(...v);return v.map(q=>q/n);},frame=displayAxisFrame('Z');
 const from=unit(frame.rotate([0,1,0])),to=unit(frame.rotate(accuracyVisualVector('Z'))),turn=[from[1]*to[2]-from[2]*to[1],from[2]*to[0]-from[0]*to[2],from[0]*to[1]-from[1]*to[0]],squared=turn.reduce((s,v)=>s+v*v,0),cosine=from.reduce((s,v,i)=>s+v*to[i],0);
 const axes=m.kind==='gantry'?['X','Y','Z']:['Y','Z'],rawNose=[.15,1.91,(m.columnZ??0)-.23];
 const nose=levelMappedBodyVisualPoint(displayTransformedPoint(rawNose,axes,m,state,'tool'),'tool');
 const rotate=v=>{if(squared<1e-24)return [...v];const dot=turn.reduce((s,q,i)=>s+q*v[i],0),cross=[turn[1]*v[2]-turn[2]*v[1],turn[2]*v[0]-turn[0]*v[2],turn[0]*v[1]-turn[1]*v[0]];return v.map((q,i)=>q*cosine+cross[i]+turn[i]*dot*(1-cosine)/squared);};
 portalSpindleVisualCache={geometry:levelGeometry,factor,kind:m.kind,state:keys.map(k=>state[k]),nose,from,to,rotate};return portalSpindleVisualCache;
}
function portalZVisualPoint(point,axes,pose,m=current,state=positions){
 if(pose!=='tool'||!axes.includes('Z'))return point;
 const frame=portalSpindleVisualFrame(m,state);if(!frame)return point;
 // Correct the support-only mesh about its existing nose. Translation and
 // measurement geometry stay untouched; the rotation preserves part shape.
 return frame.rotate(point.map((v,i)=>v-frame.nose[i])).map((v,i)=>v+frame.nose[i]);
}
function displayedModelPoint(p,axes,m=current,state=positions,pose='bed'){
 if(m.kind==='horizontal'&&pose==='work'&&levelGeometry)return horizontalPalletPoint(p,state,levelSolution,machineProfile,displayFactor()).map((v,i)=>v+(i===1?displayClearance():0));
 return portalZVisualPoint(levelMappedBodyVisualPoint(displayTransformedPoint(p,axes,m,state,pose),pose),axes,pose,m,state);
}
// The ideal comparison is a separate display transform. It never replaces
// support heights, intrinsic data, the initial comparison or the saved state.
function idealDisplayContext(m,state=positions){
 const scaleX=levelConfig.width/(m.w*.8),scaleZ=levelConfig.depth/(m.d*.8),offset=columnLayoutOffset(m);
 return {scaleX,scaleZ,state:{...state},axes:axisConfig(m),offset:[offset.x*scaleX,0,offset.z*scaleZ],lift:displayClearance()+displayFactor()*supportHeights.reduce((sum,h)=>sum+h,0)/(1000*Math.max(1,supportHeights.length))};
}
function idealDisplayPoint(p,axes,pose,context){
 const {scaleX,scaleZ,state,offset,lift}=context,q=[p[0]*scaleX,p[1],p[2]*scaleZ],pivot=[0,1.25,-.45*scaleZ];
 if(axes.includes('C')){const t=state.C*Math.PI/100,dx=q[0]-pivot[0],dz=q[2]-pivot[2];q[0]=pivot[0]+dx*Math.cos(t)+dz*Math.sin(t);q[2]=pivot[2]-dx*Math.sin(t)+dz*Math.cos(t);}
 if(axes.includes('A')){const t=state.A*.45/100,dy=q[1]-pivot[1],dz=q[2]-pivot[2];q[1]=pivot[1]+dy*Math.cos(t)-dz*Math.sin(t);q[2]=pivot[2]+dy*Math.sin(t)+dz*Math.cos(t);}
 for(const a of context.axes)if(['X','Y','Z'].includes(a.key)&&axes.includes(a.key)){
  const distance=a.amp*state[a.key]/100;q[0]+=a.vector[0]*scaleX*distance;q[1]+=a.vector[1]*distance;q[2]+=a.vector[2]*scaleZ*distance;
 }
 if(pose==='tool'){q[0]+=offset[0];q[2]+=offset[2];}q[1]+=lift;return q;
}
const $=id=>document.getElementById(id);
let current=displayMachine(machines[0]), page='home', yaw=-0.45, selected=0, supports=[];
// Viewing scale is deliberately separate from machine, leveling and saved state.
const SCENE_ZOOM_MIN=.65,SCENE_ZOOM_MAX=1.8;
let sceneZoom=1;
let sceneView='oblique';
let trainingMenuOpen=false,trainingMainScale=1;
// L3 structure reference: a teaching-only 3×3 bed plus six drawing-based column points, in metres.
// The NC long axis X is the display z direction; Y spans the bridge (display x).
function l3Supports(){
 const points=[],add=(id,x,z,name,group)=>points.push({id,x,z:z-3.420,name,group});
 const stations=[.240,3.440,6.600];
 stations.forEach((z,i)=>{for(const [side,x,label] of [['left',-.770,'左'],['center',0,'中央'],['right',.770,'右']])add('bed-'+side+'-'+(i+1),x,z,'長手ベッド'+label+' '+(i+1),'bed');});
 for(const [side,sign,label] of [['left',-1,'左'],['right',1,'右']]){
  add('column-'+side+'-front',sign*1.060,3.965,label+'柱側・手前','column-'+side);
  add('column-'+side+'-back',sign*1.060,4.515,label+'柱側・奥','column-'+side);
  add('column-'+side+'-outer',side==='left'?-1.425:1.420,4.245,label+'柱側・外端','column-'+side);
 }
 return points;
}
function supportList(m){
 if(m.layoutId==='hwacheon-l3-3000-teaching-15point-v1')return l3Supports();
 if(!m.grid)return [{x:-m.w*.4,z:-m.d*.4,name:'左・手前'},{x:m.w*.4,z:-m.d*.4,name:'右・手前'},{x:0,z:m.d*.4,name:'奥・中央'}];
 const [nx,nz]=m.grid,list=[];
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++)list.push({x:(i/(nx-1)-.5)*m.w*.8,z:(j/(nz-1)-.5)*m.d*.8,name:`${nx===2?(i?'右':'左'):(['左','中央','右'][i])}・${j===0?'手前':j===nz-1?'奥':'中間'}`});
 return m.layoutId?list.map((p,i)=>({...p,name:m.id==='horizontal'?p.name.replace('中間','中間'+Math.floor(i/2)):p.name,id:m.layoutId+'-p'+(i+1),group:'bed'})):list;
}
const pageParents={topics:'home',catalog:'topics',training:'catalog',electricTopics:'home',tester:'electricTopics'};
const pageTitles={home:'トップ',topics:'機械',catalog:'機種選択',training:'レベル調整',electricTopics:'電気',tester:'テスターの使い方'};
let machineSessionInitialized=false;
function resetTrainingPanels(){
 const walk=node=>{for(const child of node.children||[]){if(child.tagName==='DETAILS')child.open=false;walk(child);}};walk($('trainingControls'));
 $('trainingControls').scrollTop=0;
}
function navigate(next,{fromHistory=false,initializedTraining=false}={}){
 if(!Object.prototype.hasOwnProperty.call(pageTitles,next))next='home';
 if(next==='training'&&page!==next&&machineSessionInitialized&&!initializedTraining){openMachine(machines.find(m=>m.id===current.id),{fromHistory});return;}
 const previous=page;
 clearScenePointers();setAxisMenuOpen(false);
 if(next!==previous){resetTrainingPanels();document.activeElement?.blur?.();if(next==='tester'&&window.resetTesterLesson)window.resetTesterLesson();}
 if(next!=='training')stopMotion();if(next!==previous)$('axisDemoStatus').textContent='';page=next;for(const id of Object.keys(pageTitles))$(id).hidden=id!==next;
 document.body.classList.toggle('in-lab',next==='training'||next==='tester');
 document.body.classList.toggle('in-mechanical-lab',next==='training');
 const controls=$(next+'Controls');if(controls)controls.scrollTop=0;
 $('navHome').hidden=next==='home';$('navBack').hidden=next==='home'||next==='training';$('changeMachine').hidden=next!=='training';
 $('navBack').onclick=()=>navigate(pageParents[page]||'home');
 const paths=next==='electricTopics'||next==='tester'?[['home','トップ'],['electricTopics','電気'],['tester','テスターの使い方']]:[['home','トップ'],['topics','機械'],['catalog','機種選択'],['training','レベル調整']];
 const depth=paths.findIndex(([dest])=>dest===next);
 $('crumbs').replaceChildren();paths.slice(0,depth+1).forEach(([dest,label],i)=>{
  if(depth>0&&i===0)return;
  if(i>1){const separator=document.createElement('span');separator.className='crumb-separator';separator.textContent='›';separator.hidden=next==='training'||next==='tester';$('crumbs').append(separator);}
  const el=document.createElement(i===depth?'span':'button');el.textContent=label;
  if(i===depth){el.setAttribute('id','navCurrent');el.setAttribute('aria-current','page');el.setAttribute('tabindex','-1');}else{el.hidden=next==='training'||next==='tester';el.onclick=()=>navigate(dest);}
  $('crumbs').append(el);
 });
 document.title=pageTitles[next]+'｜社内訓練ツール';
 if(!fromHistory&&window.history?.pushState){
  const state={trainingTools:true,page:next,machineId:next==='training'?current.id:null};
  if(!window.history.state?.trainingTools)window.history.replaceState(state,'');else if(next!==previous)window.history.pushState(state,'');
 }
 window.scrollTo({top:0,behavior:'instant'});
 if(next==='catalog')requestAnimationFrame(drawThumbnails);
 if(next==='training')requestAnimationFrame(()=>{refreshTrainingLayout();drawScene();});
 if(next!==previous)$('navCurrent')?.focus?.({preventScroll:true});
}
$('navHome').onclick=()=>navigate('home');
window.addEventListener('popstate',event=>{
 const state=event.state;if(!state?.trainingTools)return;
 const next=state.page==='training'&&(!machineSessionInitialized||state.machineId!==current.id)?'catalog':state.page;
 navigate(next,{fromHistory:true});
});
$('mechanical').onclick=()=>navigate('topics');$('electric').onclick=()=>navigate('electricTopics');$('leveling').onclick=()=>navigate('catalog');$('changeMachine').onclick=()=>navigate('catalog');
$('testerEntry').onclick=()=>navigate('tester');
$('testerBack').onclick=()=>navigate('electricTopics');
// Each catalogue entry starts a new individual, including the same machine.
function resumeOrOpenMachine(m){openMachine(m);}
function openMachine(m,{fromHistory=false}={}){
 if(typeof spindleSweepMode!=='undefined'){spindleSweepMode=false;spindleSweepAngle=270;}
 stopMotion();sceneZoom=1;sceneView='oblique';machineMode=m.defaultMode||(m.modes?m.modes[0][0]:'');current=displayMachine(m);positions={X:0,Y:0,Z:0,A:0,C:0};selectedAxis='X';selected=0;yaw=-.45;populateMachine();navigate('training',{fromHistory,initializedTraining:true});
}
function populateMachine(){
 machineSessionInitialized=true;resetTrainingPanels();$('axisDemoStatus').textContent='';
 const m=current;supports=supportList(m);levelSolution=null;levelGeometry=null;
 $('machineTitle').textContent=m.name;$('machineSubtitle').textContent=m.example+' ｜ '+m.tag;
 $('structureText').textContent=m.structure;$('motionText').textContent=axisConfig(m).map(a=>a.key+'：'+a.part+'（'+a.direction+'）').join(' ／ ');$('focusText').textContent=m.focus;
 $('impactText').textContent=m.impact;$('supportNote').textContent=m.supportEvidence||'丸い印は学習用の支持点です。実機の支持点位置・個数・荷重配分を再現したものではありません。';
 $('sourceLinks').innerHTML=`<div class="source-links"><a href="${m.source}" target="_blank" rel="noopener noreferrer">メーカー資料で代表例を確認 ↗</a></div>`;
 $('measurePos').value='0'; $('labels').checked=true;
 
 
 buildAxisUI();buildModeUI();initializeLeveling();setTrainingMenuOpen(false,trainingMenuOpen);
}
function selectSupport(i){if(!Number.isInteger(i)||i<0||i>=supports.length)return;selected=i;refreshSupportControls();drawScene();}
function buildSupports(){
 const map=$('supportMap');map.replaceChildren();map.classList.toggle('many-supports',supports.length>8);map.setAttribute('aria-label',supports.length>8?supports.length+'か所の支持点。上下にスクロールして選択':'調整する支持点');supports.forEach((s,i)=>{const b=document.createElement('button');b.className='map-point'+(selected===i?' active':'');b.textContent=String.fromCharCode(65+i);b.setAttribute('aria-label',String.fromCharCode(65+i)+'、'+s.name+'の支持点を選択');b.setAttribute('aria-pressed',selected===i?'true':'false');b.dataset.support=String(i);b.onclick=()=>{if(!trainingMenuOpen)selectSupport(i);};map.append(b);});
 const controls=$('supportControls');controls.replaceChildren();supports.forEach((s,i)=>{const row=document.createElement('div');row.className='support-row'+(i===selected?' selected':'');const id=String.fromCharCode(65+i);row.innerHTML=`<label><span class="point-id">${id}</span>${s.name}</label><button id="down${i}" aria-label="${id}を下げる">下げる</button><span id="supportState${i}" class="support-adjustment-state"></span><input hidden type="number" id="height${i}" aria-label="${id}の抽選時からの調整量" min="${-.5-supportBaseline(i)}" max="${.5-supportBaseline(i)}" step="0.001" value="${supportAdjustment(i)}"><button id="up${i}" aria-label="${id}を上げる">上げる</button>`;controls.append(row);$('down'+i).onclick=()=>changeSupportHeight(i,-Number($('adjustStep').value));$('up'+i).onclick=()=>changeSupportHeight(i,Number($('adjustStep').value));$('height'+i).onchange=()=>setSupportHeight(i,supportHeightFromAdjustment(i,$('height'+i).value.trim()===''?NaN:Number($('height'+i).value)));$('height'+i).oninput=()=>{invalidateLevelImport();const field=$('height'+i),value=supportHeightFromAdjustment(i,field.value.trim()===''?NaN:Number(field.value));if(bounded(value,-.5,.5))setSupportHeight(i,value,true);};});
}
const grid=$('machineGrid');machines.forEach(m=>{const card=document.createElement('button');card.className='machine-card';card.setAttribute('aria-label',m.name+'の訓練画面へ');card.innerHTML=`<canvas class="thumbnail" id="thumb-${m.id}" aria-label="${m.name}の構造模式図"></canvas><div class="content"><span class="pill">${m.tag}</span><h2>${m.name}</h2><p>${m.example}</p><span class="go">この構造を見てみる →</span></div>`;card.onclick=()=>resumeOrOpenMachine(m);grid.append(card);});
// 部品に軸の親子関係を持たせ、固定部は動かさない。
function createGeometry(m){
 const faces=[],labels=[],references=[],c={base:'#80949c',fixed:'#799198',table:'#4c9b8b',spindle:'#dfab62',rail:'#c8d6d9',work:'#d1ddd7'};
 let group=[],pose='bed';
 function withGroup(axes,fn,partPose=pose){const prev=group,previousPose=pose;group=axes;pose=partPose;fn();group=prev;pose=previousPose;}
 function label(p,name){labels.push({p,axes:[...group],pose,name,text:name+(group.length?'［'+group.join('/')+'］':'［固定］')});}
 function box(x,y,z,w,h,d,color,text){const v=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([a,b,e])=>[x+a*w/2,y+b*h/2,z+e*d/2]);[[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]].forEach((ix,i)=>faces.push({v:ix.map(j=>v[j]),axes:[...group],pose,color,shade:[.83,.85,.65,1.08,.88,.94][i]}));if(text)label([x,y+h/2,z],text);
  if(text==='主軸台')references.push({base:[x-w/2,y,z-d/2],tip:[x+w/2,y,z-d/2],direction:[1,0,0],length:w,axes:[...group],pose});
  else if(text==='コラム'||pose==='leftColumn'||pose==='rightColumn')references.push({base:[x+w/2,y-h/2,z-d/2],tip:[x+w/2,y+h/2,z-d/2],direction:[0,1,0],length:h,axes:[...group],pose});
 }
 function cyl(x,y,z,r,len,color,axis='y',text){const n=20,ring=[[],[]];for(let k=0;k<2;k++)for(let i=0;i<n;i++){const a=i*2*Math.PI/n,cs=Math.cos(a)*r,sn=Math.sin(a)*r,t=(k-.5)*len;ring[k].push(axis==='x'?[x+t,y+cs,z+sn]:axis==='z'?[x+cs,y+sn,z+t]:[x+cs,y+t,z+sn]);}faces.push({v:ring[0],axes:[...group],pose,color,shade:.8},{v:ring[1],axes:[...group],pose,color,shade:1.08});for(let i=0;i<n;i++)faces.push({v:[ring[0][i],ring[0][(i+1)%n],ring[1][(i+1)%n],ring[1][i]],axes:[...group],pose,color,shade:.8+.2*(Math.cos(i*2*Math.PI/n)+1)/2});if(text)label([x,y+r+.1,z],text);}
 // Exterior faces only. Include every support station inside the part so
 // middle deformation and bilinear-cell boundaries remain in the bed/guide mesh.
 function curvedBox(x,y,z,w,h,d,color,text,nx=4,nz=8){
  const knots=(center,size,n,key)=>[...new Set([...Array.from({length:n+1},(_,i)=>center-size/2+size*i/n),...supportList(m).map(p=>p[key]).filter(v=>v>center-size/2&&v<center+size/2)])].sort((a,b)=>a-b);
  const xs=knots(x,w,nx,'x'),zs=knots(z,d,nz,'z'),lo=y-h/2,hi=y+h/2;nx=xs.length-1;nz=zs.length-1;
  const face=(v,shade)=>faces.push({v,axes:[...group],pose,color,shade});
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
   const a=xs[i],b=xs[i+1],c=zs[j],e=zs[j+1];
   face([[a,hi,c],[b,hi,c],[b,hi,e],[a,hi,e]],1.08);face([[a,lo,c],[a,lo,e],[b,lo,e],[b,lo,c]],.65);
  }
  for(let i=0;i<nx;i++){const a=xs[i],b=xs[i+1],f=zs[0],r=zs[nz];face([[a,lo,f],[b,lo,f],[b,hi,f],[a,hi,f]],.83);face([[a,lo,r],[a,hi,r],[b,hi,r],[b,lo,r]],.85);}
  for(let j=0;j<nz;j++){const a=zs[j],b=zs[j+1],l=xs[0],r=xs[nx];face([[l,lo,a],[l,hi,a],[l,hi,b],[l,lo,b]],.88);face([[r,lo,a],[r,lo,b],[r,hi,b],[r,hi,a]],.94);}
  if(text)label([x,y+h/2,z],text);
 }
 const W=m.w,D=m.d;
 if(m.supportLayout==='irregular'){
  // Split the connected base at its seating/transition boundaries, so its
  // visible faces share the same continuous structural surface as the seats.
  const points=supportList(m),sorted=values=>[...new Set(values)].sort((a,b)=>a-b);
  const xs=sorted([-1.56,-1.06,-.89,-.77,0,.77,.89,1.06,1.56,...points.map(p=>p.x)]),zs=sorted([-3.55,m.columnZ-.39,m.columnZ-.325,m.columnZ,m.columnZ+.325,m.columnZ+.39,3.55,...points.map(p=>p.z)]);
  for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++){const x=(xs[i]+xs[i+1])/2,z=(zs[j]+zs[j+1])/2;if(Math.abs(x)>.89&&Math.abs(z-m.columnZ)>.39)continue;box(x,.42,z,xs[i+1]-xs[i],.45,zs[j+1]-zs[j],c.base);}
  label([0,.645,-1.4],'長手ベッド');label([1.3,.645,m.columnZ],'柱側ベース');
 }
 else if(m.kind==='compact'){
  curvedBox(0,.42,0,W,.45,D,c.base,'ベース');
  // Painted legend for the assumed rightward stiffness gradient, not another
  // support or a dimensioned physical reinforcing member.
  for(let j=0;j<8;j++){const z=-D*.47+j*D*.94/8,back=z+D*.94/8;faces.push({v:[[W*.46,.648,z],[W*.495,.648,z],[W*.495,.648,back],[W*.46,.648,back]],axes:[],pose:'bed',color:c.spindle,shade:1.08});}
  label([W*.48,.648,0],'高剛性側（仮定）');
 }else curvedBox(0,.42,0,W,.45,D,c.base,m.kind==='lathe'?'ベッド':'ベース');
 function spindle(x,y,z,axes){withGroup(axes,()=>{cyl(x,y,z,.16,.42,c.spindle,'y');cyl(x,y-.3,z,.045,.18,c.spindle);},'tool');}
 function table(width,depth,y,z,axes){withGroup(axes,()=>{box(0,y,z,width,.2,depth,c.table,'テーブル');const detailStart=faces.length;for(let i=-3;i<=3;i++)box(i*width*.11,y+.105,z,.018,.012,depth*.97,c.rail);box(0,y+.3,z,.42,.38,.36,c.work);for(let i=detailStart;i<faces.length;i++)faces[i].tableDetail=true;},'work');}
 if(['vertical','compact','travel'].includes(m.kind)){
 const travel=m.kind==='travel',cx=travel?-.5:0;
 [-1,1].forEach(k=>m.kind==='compact'?curvedBox(k*.36,.7,-D*.05,.1,.1,D*.7,c.rail,null,1,8):curvedBox(travel?0:k*.36,.7,travel?D*.22+k*.1:-D*.05,travel?W*.9:.1,.1,travel?.09:D*.7,c.rail));
 withGroup(travel?['X']:[],()=>{box(cx,1.97,D*.29,.85,2.6,.68,c.fixed,'コラム');box(cx,2.2,D*.17,.2,2.0,.1,c.rail);},'tool');
 if(travel){withGroup(['X','Y'],()=>box(cx,2.85,.13,.72,.6,1.05,c.fixed,'前後スライド'),'tool');withGroup(['X','Y','Z'],()=>box(cx,2.45,-.25,.67,.55,.65,c.fixed,'主軸頭'),'tool');spindle(cx,2.04,-.3,['X','Y','Z']);table(W*.93,D*.39,1,-D*.18,[]);}
 else {withGroup(['Z'],()=>box(0,2.85,.05,.75,.6,1.1,c.fixed,'主軸頭'),'tool');spindle(0,2.37,-.3,['Z']);withGroup(['Y'],()=>box(0,.81,-D*.1,W*.58,.22,D*.45,c.fixed,'サドル'),'work');table(W*.78,D*.42,1.06,-D*.1,['X','Y']);}
 }else if(['portal','double','gantry'].includes(m.kind)){
 const gate=m.kind==='gantry',cross=m.kind==='portal',gateAxes=gate?['X']:[],gz=m.columnZ??(cross?D*.24:0),columnX=m.columnX??W*.4;
 [-1,1].forEach(k=>curvedBox(k*(gate?W*.4:m.supportLayout==='irregular'?.52:W*.17),.72,0,.14,.12,(m.supportLayout==='irregular'?6.8:D*.91),c.rail,k===1?(gate?'走行レール':'案内レール'):null));
 withGroup(gateAxes,()=>{[-1,1].forEach(k=>withGroup(gateAxes,()=>box(k*columnX,1.96,gz,.5,2.6,.65,c.fixed,k===-1?'門／コラム':null),k===-1?'leftColumn':'rightColumn'));box(0,3.17,gz,m.supportLayout==='irregular'?2.8:W*.94,.55,.65,c.fixed,'梁');box(0,2.9,gz-.37,W*.83,.1,.1,c.rail);},'tool');
 const headAxes=cross?['Z']:gate?['X','Y','Z']:['Y','Z'];
 if(!cross)withGroup(gate?['X','Y']:['Y'],()=>box(.15,2.76,gz-.2,.72,.65,.65,c.fixed,'主軸サドル'),'tool');
 withGroup(headAxes,()=>box(.15,2.67,gz-.23,.42,.9,.45,c.fixed,'ラム／主軸頭'),'tool');spindle(.15,2.3,gz-.23,headAxes);
 if(cross)withGroup(['Y'],()=>box(0,.82,0,W*.6,.23,D*.6,c.fixed,'サドル'),'work');
 table(m.supportLayout==='irregular'?1.45:W*.57,m.supportLayout==='irregular'?3.20:D*(cross?.43:.65),1.02,0,cross?['X','Y']:gate?[]:['X']);
 }else if(m.kind==='horizontal'){
 [-1,1].forEach(k=>curvedBox(0,.7,D*.28+k*.13,W*.86,.12,.1,c.rail));
 withGroup(['X'],()=>{box(0,1.95,D*.29,.95,2.5,.7,c.fixed,'コラム');box(0,2,D*.18,.16,2.0,.12,c.rail);},'tool');
 withGroup(['X','Y'],()=>{box(0,2.55,.25,.75,.62,1.1,c.fixed,'主軸頭');cyl(0,2.55,-.45,.2,.6,c.spindle,'z');cyl(0,2.55,-.83,.045,.2,c.spindle,'z');},'tool');
 withGroup(['Z'],()=>{box(0,.8,-.85,1.6,.23,1.6,c.fixed,'パレット台');cyl(0,1.03,-.85,.73,.2,c.table);box(0,1.2,-.85,1.45,.14,1.45,c.table,'パレット');box(0,1.75,-.85,.72,.95,.72,c.work);},'work');
 }else if(m.kind==='five'){
 withGroup([],()=>box(0,1.95,D*.3,1.0,2.6,.6,c.fixed,'コラム'),'tool');withGroup(['Z'],()=>box(0,2.95,0,.72,.65,1.1,c.fixed,'主軸頭'),'tool');spindle(0,2.54,-.3,['Z']);
 withGroup(['Y'],()=>box(0,.77,-.45,2.6,.18,1.5,c.fixed,'サドル'),'work');
 withGroup(['X','Y'],()=>{box(0,.91,-.45,2.4,.13,1.25,c.table);[-1,1].forEach(k=>box(k*.95,1.23,-.45,.3,.66,1.0,c.fixed,k===-1?'トラニオン支持':null));},'work');
 withGroup(['X','Y','A'],()=>{cyl(0,1.25,-.45,.3,1.6,c.table,'x');box(0,1.19,-.45,1.45,.15,1.15,c.table,'揺りかご');},'work');
 withGroup(['X','Y','A','C'],()=>{cyl(0,1.47,-.45,.65,.18,c.table,'y','回転テーブル');box(.18,1.68,-.45,.45,.25,.32,c.work);},'work');
 }else {
 [-1,1].forEach(k=>curvedBox(0,.72,k*.4,W*.93,.11,.13,c.rail));withGroup([],()=>{box(-W*.35,1.22,0,.8,1.25,1.3,c.fixed,'主軸台');cyl(-W*.24,1.5,0,.4,.25,c.spindle,'x');cyl(0,1.5,0,.14,W*.45,c.work,'x');},'tool');box(W*.33,1.13,0,.55,.9,.65,c.fixed,'心押台');cyl(W*.2,1.5,0,.1,.4,c.spindle,'x');
 withGroup(['Z'],()=>box(.08,.87,-.15,.8,.22,1.35,c.fixed,'往復台'),'work');withGroup(['X','Z'],()=>{box(.08,1.18,-.58,.64,.5,.55,c.table,'刃物台');box(.08,1.45,-.33,.08,.08,.38,c.spindle);},'work');
 }
 supportList(m).forEach((t,i)=>{withGroup([],()=>cyl(t.x,.18,t.z,.14,.22,'#7d8991'),'support:'+i);withGroup([],()=>cyl(t.x,.045,t.z,.23,.09,'#52616d'),'pad:'+i);});
 return {faces,labels,references};
}
function idealFaceNormal(points){
 const a=points[1].map((v,i)=>v-points[0][i]),b=points[2].map((v,i)=>v-points[0][i]),n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=Math.hypot(...n);return length?n.map(v=>v/length):[0,0,0];
}
function idealOutlineEdges(model){
 const edges=new Map(),pointKey=p=>p.map(v=>Math.round(v*1e9)).join(',');
 for(const f of model.faces){
  // Floor pads, adjustable rods, height maps and small rail details remain
  // solely on the current model, keeping the posture comparison uncluttered.
  if(f.surface||!['bed','tool','work','leftColumn','rightColumn'].includes(f.pose)||f.color==='#c8d6d9')continue;
  for(let i=0;i<f.v.length;i++){
   const a=f.v[i],b=f.v[(i+1)%f.v.length],pa=pointKey(a),pb=pointKey(b),key=f.pose+':'+f.axes.join('/')+':'+[pa,pb].sort().join('|');
   if(edges.has(key))edges.get(key).faces.push(f);else edges.set(key,{a,b,axes:f.axes,pose:f.pose,faces:[f],smooth:false});
  }
 }
 return [...edges.values()].filter(edge=>{
  if(edge.faces.length!==2)return true;
  const a=idealFaceNormal(edge.faces[0].v),b=idealFaceNormal(edge.faces[1].v),dot=Math.abs(a.reduce((sum,v,i)=>sum+v*b[i],0));
  if(dot>1-1e-8)return false;edge.smooth=dot>Math.cos(Math.PI/6);return true;
 });
}
function idealOutlineSegments(edges,context,angle,view){
 const pitch=scenePitch(view),sight=[-Math.sin(angle)*Math.cos(pitch),-Math.sin(pitch),Math.cos(angle)*Math.cos(pitch)],normals=new Map();
 const facing=f=>{
  if(!normals.has(f)){const n=idealFaceNormal(f.v.slice(0,3).map(p=>idealDisplayPoint(p,f.axes,f.pose,context)));normals.set(f,n.reduce((sum,v,i)=>sum+v*sight[i],0));}return normals.get(f);
 };
 return edges.filter(edge=>!edge.smooth||facing(edge.faces[0])*facing(edge.faces[1])<0).map(edge=>({a:idealDisplayPoint(edge.a,edge.axes,edge.pose,context),b:idealDisplayPoint(edge.b,edge.axes,edge.pose,context)}));
}
const idealOutlineCache=new Map();
function drawIdealOutline(ctx,m,model,screen,angle,view){
 const key=m.kind+':'+m.w+':'+m.d;
 if(!idealOutlineCache.has(key)){if(idealOutlineCache.size>=24)idealOutlineCache.clear();idealOutlineCache.set(key,idealOutlineEdges(model));}
 const segments=idealOutlineSegments(idealOutlineCache.get(key),idealDisplayContext(m),angle,view),points=new Map(),edges=[],dedup=new Set(),pointKey=p=>p.map(v=>Math.round(v*100)).join(',');
 for(const segment of segments){
  const a=screen(segment.a),b=screen(segment.b);if(Math.hypot(a[0]-b[0],a[1]-b[1])<.4)continue;
  const ka=pointKey(a.slice(0,2)),kb=pointKey(b.slice(0,2)),edgeKey=[ka,kb].sort().join('|');if(dedup.has(edgeKey))continue;dedup.add(edgeKey);
  const edge={a:a.slice(0,2),b:b.slice(0,2),ka,kb,used:false};edges.push(edge);
  for(const k of [ka,kb]){if(!points.has(k))points.set(k,[]);points.get(k).push(edge);}
 }
 ctx.strokeStyle='rgba(57,111,142,.34)';ctx.lineWidth=1;ctx.setLineDash?.([4,4]);
 // Join degree-two rim segments so dashes continue around a cylinder instead
 // of restarting on every short polygon edge. Box corners stay distinct.
 const trace=(first,start)=>{
  let edge=first,k=start;ctx.beginPath();ctx.moveTo(...(k===edge.ka?edge.a:edge.b));
  while(edge&&!edge.used){edge.used=true;k=k===edge.ka?edge.kb:edge.ka;ctx.lineTo(...(k===edge.ka?edge.a:edge.b));const adjoining=points.get(k);edge=adjoining.length===2?adjoining.find(e=>!e.used):null;}
  ctx.stroke();
 };
 for(const edge of edges)if(!edge.used&&(points.get(edge.ka).length!==2||points.get(edge.kb).length!==2))trace(edge,points.get(edge.ka).length!==2?edge.ka:edge.kb);
 for(const edge of edges)if(!edge.used)trace(edge,edge.ka);
 ctx.setLineDash?.([]);
}
function tone(hex,s){const v=hex.slice(1).match(/../g).map(x=>Math.min(255,Math.round(parseInt(x,16)*s)));return `rgb(${v.join(',')})`;}
// Cache a fixed movement envelope, so operating an axis never auto-zooms the machine.
const framingCache=new Map();
function framingPoints(m,model){
 const key=m.kind+':'+m.w+':'+m.d;if(framingCache.has(key))return framingCache.get(key);
 const ends=[];for(const X of [-100,100])for(const Y of [-100,100])for(const Z of [-100,100])ends.push({X,Y,Z,A:0,C:0});
 const points=model.faces.flatMap(f=>f.v.flatMap(p=>f.axes.length?ends.map(state=>transformedPoint(p,f.axes,m,state)):[[...p]]));
 framingCache.set(key,points);return points;
}
const displayFramingCache=new Map();
function displayFramingPoints(m,model){
 const clearance=displayClearance(),key=JSON.stringify([m.kind,m.w,m.d,levelConfig.width,levelConfig.depth,levelConfig.columnX,levelConfig.columnZ,displayFactor(),clearance]);if(displayFramingCache.has(key))return displayFramingCache.get(key);
 const points=[];
 for(const f of model.faces)for(const p of f.v){
  const rotations=f.axes.includes('C')?[-100,-50,0,50,100]:[0],tilts=f.axes.includes('A')?[-100,0,100]:[0];
  for(const A of tilts)for(const C of rotations){const q=displayRotatedPoint(p,f.axes,{A,C});if(f.pose==='tool'){const offset=columnLayoutOffset(m),mapped=displayCoordinates([offset.x,0,offset.z]);q[0]+=mapped[0];q[2]+=mapped[2];}const amplitude=[0,0,0];for(const a of axisConfig(m))if(f.axes.includes(a.key)&&['X','Y','Z'].includes(a.key)){const vector=displayCoordinates(a.vector);vector.forEach((v,i)=>amplitude[i]+=Math.abs(v*a.amp));}
   for(const sign of [-1,1])points.push(q.map((v,i)=>v+(i===1&&!f.pose.startsWith('pad:')?clearance:0)+sign*(amplitude[i]+(i===1?.63+clearance:.55))));
  }
 }
 if(displayFramingCache.size>=24)displayFramingCache.clear();displayFramingCache.set(key,points);return points;
}
// Every available axis has an indicator on its moving assembly. C follows
// the A parent tilt; neither rotary arrow is drawn as a linear slide.
function axisIndicators(m,model){
 return axisConfig(m).map(a=>{
  if(['X','Y','Z'].includes(a.key)){
   const movingFaces=model.faces.filter(f=>f.axes.includes(a.key)),moved=movingFaces.flatMap(f=>f.v.map(p=>displayTransformedPoint(p,f.axes,m,positions,f.pose)));
   const origin=[0,1,2].map(i=>(Math.min(...moved.map(p=>p[i]))+Math.max(...moved.map(p=>p[i])))/2);
   const bodyPoints=levelGeometry?movingFaces.flatMap(f=>f.v.map(p=>displayedModelPoint(p,f.axes,m,positions,f.pose))):moved,bodyOrigin=[0,1,2].map(i=>(Math.min(...bodyPoints.map(p=>p[i]))+Math.max(...bodyPoints.map(p=>p[i])))/2);
   const vector=levelGeometry?accuracyVisualVector(a.key):a.vector,pose=levelGeometry?(current.kind==='lathe'&&a.key==='Z'?'work':levelGeometry.axes.find(q=>q.key===a.key).source):'bed';
   return {key:a.key,pose,bodyOrigin,curved:false,points:[-1,1].map(sign=>origin.map((v,i)=>v+sign*vector[i]*.6))};
  }
  const points=Array.from({length:25},(_,i)=>{
   const t=-Math.PI*.65+i/24*Math.PI*1.3;
   const p=a.key==='A'?[-1.2,1.25+Math.cos(t)*.72,-.45+Math.sin(t)*.72]:[Math.cos(t)*.8,1.68,-.45+Math.sin(t)*.8];
   return displayTransformedPoint(p,a.key==='A'?['X','Y']:['X','Y','A'],m,positions,'work');
  });
  return {key:a.key,pose:'work',curved:true,points};
 });
}
// Keep each reference direction separate from the model and from the other axes.
// Only the viewing angle is projected here; support posture and accuracy stay on the model.
function scenePitch(view=sceneView){return view==='front'||view==='side'?0:.24;}
function sceneProject(p,angle,view='oblique',perspective=false){
 const [x,y,z]=p,pitch=scenePitch(view),xx=x*Math.cos(angle)+z*Math.sin(angle),zz=-x*Math.sin(angle)+z*Math.cos(angle);
 const yy=(y-1.65)*Math.cos(pitch)+zz*Math.sin(pitch),depth=11+zz*Math.cos(pitch)-(y-1.65)*Math.sin(pitch);
 // A shared divisor preserves the scale convention without perspective lean.
 const divisor=perspective?depth:11;return [xx/divisor,-yy/divisor,depth];
}
function orientationArrows(m,angle){
 const pitch=scenePitch();
 return axisConfig(m).filter(a=>['X','Y','Z'].includes(a.key)).map(a=>{
  const [x,y,z]=a.vector,dx=x*Math.cos(angle)+z*Math.sin(angle),dy=-y*Math.cos(pitch)-(-x*Math.sin(angle)+z*Math.cos(angle))*Math.sin(pitch),length=Math.hypot(dx,dy),depth=length<1e-8;
  return {key:a.key,dx:depth?0:dx/length,dy:depth?0:dy/length,depth};
 });
}
function drawOrientationGuide(){
 const guide=$('orientationGuide');guide.hidden=!$('showAxes').checked;if(guide.hidden)return;
 $('orientationRotaryNote').hidden=current.kind!=='five';
 $('orientationAxes').innerHTML=orientationArrows(current,yaw).map(({key,dx,dy,depth})=>{
  const x=48+dx*28,y=72+dy*28,color=axisColors[key],backX=x-dx*9,backY=y-dy*9;
  const direction=depth?`<title>画面の奥行方向</title><circle cx="48" cy="72" r="5" fill="none" stroke="${color}" stroke-width="2"/>`:`<line x1="48" y1="72" x2="${x}" y2="${y}" stroke="${color}" stroke-width="3"/><path d="M ${x} ${y} L ${backX-dy*4.5} ${backY+dx*4.5} L ${backX+dy*4.5} ${backY-dx*4.5} Z" fill="${color}"/>`;
  return `<svg class="orientation-axis" viewBox="0 0 96 116" role="img" aria-label="${key}軸の向きの目安"><text x="48" y="19" text-anchor="middle" fill="${color}">${key}軸</text>${direction}<circle cx="48" cy="72" r="3" fill="#526e7b"/></svg>`;
 }).join('');
}
function render(canvas,m,angle,showLabels,active){
 const measured=canvas.getBoundingClientRect(),mainCanvas=canvas===$('scene'),rect=mainCanvas?{width:canvas.clientWidth||measured.width/trainingMainScale,height:canvas.clientHeight||measured.height/trainingMainScale}:measured;if(!rect.width||!rect.height)return;
 const ratio=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(rect.height*ratio);
 const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);const width=rect.width,height=rect.height;
 ctx.fillStyle='#f1f0ed';ctx.fillRect(0,0,width,height);
 const model=createGeometry(m),training=canvas===$('scene')&&active>=0;
 const compactShortCanvas=training&&['compact','travel','double','gantry','five'].includes(m.kind)&&height<160;
 const project=p=>sceneProject(p,angle,training?sceneView:'oblique',!training);
 const fitPoints=training?displayFramingPoints(m,model):model.faces.flatMap(f=>f.v.map(p=>[...p]));if(active<0)fitPoints.push([-m.w*.7,.0,-m.d*.7],[m.w*.7,3.8,m.d*.7]);const points=fitPoints.map(project);const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));
 // Fit the machine and its fixed movement envelope, without the empty ground around it.
 // Compact views use the width freed by the simpler measurement display too.
 // The framing envelope still contains the complete machine and moving axes;
 // label placement independently keeps every visible label inside the Canvas.
 const compactView=training&&['compact','travel','double','gantry','five'].includes(m.kind);
 const margin=showLabels?Math.min(compactView?44:56,width*(compactView?.12:.16)):18,verticalSpace=active>=0?height-(compactShortCanvas?12:48):height-75;
 const fitScale=Math.min((width-margin*2)/(maxX-minX),Math.max(24,verticalSpace)/(maxY-minY));
 const scale=fitScale*(canvas===$('scene')?sceneZoom:1);const cx=width/2-(minX+maxX)*scale/2,cy=(active>=0?(height-(compactShortCanvas?4:20))/2:height*.48)-(minY+maxY)*scale/2;
 const screen=p=>{const q=project(p);return [cx+q[0]*scale,cy+q[1]*scale,q[2]]};const surfacePoint=(p,pose='bed')=>active>=0?levelMappedVisualPoint(p,pose):p;const movingScreen=(p,axes,pose)=>screen(active>=0?displayedModelPoint(p,axes,m,positions,pose||'bed'):transformedPoint(p,axes,m));
 // 地面は回転に追従する格子。モデルを動かさず視点だけを左右に回す。
 ctx.strokeStyle='#d7e1e5';ctx.lineWidth=.7;
 for(let i=-4;i<=4;i++){for(const pair of [[[i,0,-4],[i,0,4]],[[-4,0,i],[4,0,i]]]){const a=screen(pair[0]),b=screen(pair[1]);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();}}
 if(active>=0)model.faces.push(...levelSurfaceFaces(m));
 model.faces.map(f=>({...f,p:f.v.map(p=>movingScreen(p,f.axes,f.pose))})).sort((a,b)=>b.p.reduce((s,p)=>s+p[2],0)/b.p.length-a.p.reduce((s,p)=>s+p[2],0)/a.p.length).forEach(f=>{ctx.beginPath();f.p.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();const highlight=active>=0&&f.axes.includes(selectedAxis);const color=highlight?axisColors[selectedAxis]:f.axes.length?'#bfd0d6':'#8b9da3';if(f.surface){const low=Math.min(...supportHeights),high=Math.max(...supportHeights),t=high-low<1e-9?.5:Math.max(0,Math.min(1,(f.height-low)/(high-low)));ctx.fillStyle=`rgba(${Math.round(42+199*t)},${Math.round(129+86*t)},${Math.round(113+17*t)},.8)`;}else ctx.fillStyle=tone(color,f.shade);ctx.fill();ctx.strokeStyle=f.surface?'#17685c66':'#35546933';ctx.lineWidth=.6;ctx.stroke();});
 if(training&&$('showIdealOutline').checked)drawIdealOutline(ctx,m,model,screen,angle,sceneView);
 // Reserve support markers before placing any text. Labels use the entire
 // Canvas now that the operation bar has its own row below it.
 const labelBoxes=[],freeLabel=(box)=>box.x>=4&&box.y>=4&&box.x+box.w<=width-4&&box.y+box.h<=height-4&&!labelBoxes.some(b=>box.x<b.x+b.w+2&&b.x<box.x+box.w+2&&box.y<b.y+b.h+2&&b.y<box.y+box.h+2);
 if(training){
  ctx.strokeStyle='#536d786e';ctx.lineWidth=.8;ctx.setLineDash?.([3,3]);
  for(const ref of model.references){
   const from=levelMappedBodyVisualPoint(displayTransformedPoint(ref.base,ref.axes,m,positions,ref.pose),ref.pose),physicalLength=Math.hypot(...displayCoordinates(ref.direction.map(v=>v*ref.length))),to=from.map((v,i)=>v+ref.direction[i]*physicalLength),a=screen(from),b=screen(to),dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
   if(length<4)continue;const offset=[-dy/length*5,dx/length*5];
   ctx.beginPath();ctx.moveTo(a[0]+offset[0],a[1]+offset[1]);ctx.lineTo(b[0]+offset[0],b[1]+offset[1]);ctx.stroke();
  }
  ctx.setLineDash?.([]);
 }
 if(active>=0){supportList(m).forEach((s,i)=>{const p=screen(levelVisualPoint([s.x,.195,s.z]));if(supports.length>8&&i!==active){ctx.beginPath();ctx.arc(p[0],p[1]+10,3,0,Math.PI*2);ctx.fillStyle='#6c604b';ctx.fill();return;}labelBoxes.push({x:p[0]-14,y:p[1]-4,w:28,h:28});ctx.beginPath();ctx.arc(p[0],p[1]+10,13,0,Math.PI*2);ctx.fillStyle=active===i?'#ffda794d':'#ffffff26';ctx.fill();ctx.strokeStyle=active===i?'#ba8d20':'#80949f';ctx.lineWidth=active===i?2:1;ctx.stroke();ctx.fillStyle='#23404e';ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String.fromCharCode(65+i),p[0],p[1]+10);});}
 // P is a fixed material point on the compact table top. Its moving path,
 // rather than an undeformed saddle triad, defines the compact X/Y readings.
 const measurementPixel=training&&m.kind==='compact'&&levelSolution&&levelGeometry?screen(compactTablePathPoint(positions,levelSolution,machineProfile,displayFactor()).map((v,i)=>v+(i===1?displayClearance():0))):null;
 if(measurementPixel)labelBoxes.push({x:measurementPixel[0]-5,y:measurementPixel[1]-5,w:10,h:10});
 if(active>=0&&$('showAxes').checked){
 const labels=[];
 function arrow(p,q){const t=Math.atan2(p[1]-q[1],p[0]-q[0]);ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(p[0]-9*Math.cos(t-.45),p[1]-9*Math.sin(t-.45));ctx.lineTo(p[0]-9*Math.cos(t+.45),p[1]-9*Math.sin(t+.45));ctx.closePath();ctx.fill();}
 for(const a of axisIndicators(m,model)){
  const origin=a.curved?null:a.points[0].map((v,i)=>(v+a.points[1][i])/2),path=a.points.map(p=>screen(origin?levelAxisVisualPoint(p,origin,a.pose,a.bodyOrigin,a.key):surfacePoint(p,a.pose)));
  ctx.strokeStyle=axisColors[a.key];ctx.fillStyle=axisColors[a.key];ctx.lineWidth=a.key===selectedAxis?4:2.5;
  if(!a.curved&&Math.hypot(path[1][0]-path[0][0],path[1][1]-path[0][1])<2){ctx.beginPath();ctx.arc(path[0][0],path[0][1],3,0,Math.PI*2);ctx.stroke();}
  else{ctx.beginPath();path.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke();arrow(path[0],path[1]);arrow(path[path.length-1],path[path.length-2]);}
  const p=a.curved?path[Math.floor(path.length/2)]:[(path[0][0]+path[1][0])/2,(path[0][1]+path[1][1])/2];labels.push({key:a.key,p});
 }
 ctx.font='12px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
 labels.sort((a,b)=>Number(b.key===selectedAxis)-Number(a.key===selectedAxis));
 for(const label of labels){
  const candidates=[[0,-18],[28,-18],[-28,-18],[0,-44],[28,10],[-28,10],[0,-70]].map(([dx,dy])=>[Math.max(24,Math.min(width-24,label.p[0]+dx)),Math.max(15,Math.min(height-15,label.p[1]+dy))]);
  const columns=Math.max(1,Math.floor((width-48)/44)+1),rows=Math.max(1,Math.floor((height-30)/26)+1);
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++)candidates.push([columns===1?width/2:24+x*(width-48)/(columns-1),rows===1?height/2:15+y*(height-30)/(rows-1)]);
  candidates.sort((a,b)=>Math.hypot(a[0]-label.p[0],a[1]-label.p[1])-Math.hypot(b[0]-label.p[0],b[1]-label.p[1]));
  let place=candidates.find(([x,y])=>freeLabel({x:x-20,y:y-11,w:40,h:22}));
  // At short heights, the coarse rows can miss a usable gap between support
  // markers and the four earlier axis labels. Search that remaining space
  // before dropping an axis name; preserve the same readable label size.
  if(!place){let distance=Infinity;for(let y=15;y<=height-15;y+=2)for(let x=24;x<=width-24;x+=2){const d=Math.hypot(x-label.p[0],y-label.p[1]);if(d<distance&&freeLabel({x:x-20,y:y-11,w:40,h:22})){place=[x,y];distance=d;}}}
  if(!place)continue;
  const [tx,ty]=place;labelBoxes.push({x:tx-20,y:ty-11,w:40,h:22});ctx.fillStyle='#ffffff26';ctx.fillRect(tx-20,ty-11,40,22);ctx.fillStyle=tone(axisColors[label.key],.55);ctx.fillText(label.key+'軸',tx,ty);
 }
 }
 if(measurementPixel){
  const p=measurementPixel;ctx.beginPath();ctx.arc(p[0],p[1],4,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle='#b34800';ctx.lineWidth=2;ctx.stroke();
  const candidates=[[28,-18],[-28,-18],[28,18],[-28,18],[0,-36],[0,36]].map(([dx,dy])=>({x:p[0]+dx-20,y:p[1]+dy-9,w:40,h:18}));
  for(let y=6;y+18<=height-4;y+=20)for(let x=6;x+40<=width-4;x+=44)candidates.push({x,y,w:40,h:18});
  candidates.sort((a,b)=>Math.hypot(a.x+20-p[0],a.y+9-p[1])-Math.hypot(b.x+20-p[0],b.y+9-p[1]));
  const box=candidates.find(freeLabel);
  if(box){labelBoxes.push(box);ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(box.x+20,box.y+9);ctx.strokeStyle='#b3480080';ctx.lineWidth=.8;ctx.stroke();ctx.fillStyle='#fff8ee';ctx.fillRect(box.x,box.y,box.w,box.h);ctx.font='10px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#7d3300';ctx.fillText('測定P',box.x+20,box.y+9);}
 }
 if(showLabels&&!compactShortCanvas){
  // A short compact view keeps support, axis and measurement labels; part names
  // return when there is more room, without altering zoom or measurements.
  // Prefer the selected moving assembly and the base/column. A short Canvas
  // omits lower-priority part names rather than compressing their 18px boxes.
  const priority=l=>(active>=0&&l.axes.includes(selectedAxis)?10:0)+(/^(コラム|門|ベース|ベッド|主軸台)/.test(l.text)?2:0),labs=model.labels.map(l=>({...l,screen:movingScreen(l.p,l.axes,l.pose)})).sort((a,b)=>priority(b)-priority(a));
  ctx.font='10px sans-serif';ctx.textBaseline='middle';
  const rows=Math.max(1,Math.floor((height-26)/20)+1);
  for(const l of labs){
   const tw=ctx.measureText(l.text).width,side=l.screen[0]>=width/2?1:0,candidates=[];
   for(const k of [side,1-side])for(let y=0;y<rows;y++){const ly=rows===1?height/2:13+y*(height-26)/(rows-1);candidates.push({k,ly,x:k?width-14-tw:6,y:ly-9,w:tw+8,h:18});}
   candidates.sort((a,b)=>Math.abs(a.ly-l.screen[1])-Math.abs(b.ly-l.screen[1])+(a.k===side?0:12)-(b.k===side?0:12));
   const box=candidates.find(freeLabel);if(!box)continue;labelBoxes.push(box);
   const lx=box.k?width-10:10;ctx.strokeStyle='#65818b40';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(l.screen[0],l.screen[1]);ctx.lineTo(box.k?lx-5:lx+5,box.ly);ctx.stroke();ctx.textAlign=box.k?'right':'left';ctx.fillStyle='#f8fbf91f';ctx.fillRect(box.x,box.y,box.w,box.h);ctx.fillStyle='#365564';ctx.fillText(l.text,lx,box.ly);
  }
 }
 if(active<0){ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#526e7b';ctx.font='10px sans-serif';ctx.fillText('外装を省いた構造模式図',width/2,height-15);}
}
function drawThumbnails(){const previous=positions;positions={X:0,Y:0,Z:0,A:0,C:0};machines.forEach(m=>render($('thumb-'+m.id),m,-.55,false,-1));positions=previous;}
function updateSceneViewUI(){
 $('sceneView').value=sceneView;
 $('sceneDirection').textContent=sceneView==='front'?'正面：左 → 右':sceneView==='side'?'側面：手前 → 奥':'斜め：左右回転';
 $('scene').setAttribute('aria-label',current.name+'の構造模型。'+$('sceneDirection').textContent+'。正投影で表示し、部材のそばの破線は床に対する鉛直・水平の基準。薄い破線の理想輪郭は'+($('showIdealOutline').checked?'表示中':'非表示')+'。左上の設定メニューで切り替えます。一本指またはマウスの左右ドラッグ、左右矢印キーで回転。二本指のピンチまたはマウスホイール、＋・−キーで拡大縮小。Homeキーで表示倍率を戻す。'+axisConfig(current).map(a=>a.key).join('・')+'軸の色付き矢印。選択中の'+selectedAxis+'軸で動く部品を同色で強調。');
 if(current.kind==='compact')$('scene').setAttribute('aria-label',$('scene').getAttribute('aria-label')+'測定Pはテーブル上面中央の固定点です。X・Yの比較はこの点の送り方向を使い、送り中の傾き変化による横ずれを含みます。');
 if(typeof spindleSweepMode!=='undefined'&&spindleSweepMode&&current.kind==='horizontal')$('scene').setAttribute('aria-label',$('scene').getAttribute('aria-label')+'主軸に固定したテストバーに対するZ方向300ミリの平行度も表示します。パレット上の計器を主軸側へ動かし、aは左右、bは上下の押込み差を始点ゼロで測ります。主軸は回しません。');
 if(typeof spindleSweepMode!=='undefined'&&spindleSweepMode&&current.kind!=='horizontal')$('scene').setAttribute('aria-label',$('scene').getAttribute('aria-label')+'主軸とテーブル上面の相対傾きを直径300ミリで比較する4点のダイヤル測定値も同時に表示します。右・奥・左・手前の4方向です。上の3枠は基準器を使う300ミリの仮想走査、隣の4点は手前基準の相対読みです。');
}
function drawScene(){if(levelSolution)updateAccuracy();if(typeof updateSpindleSweep==='function')updateSpindleSweep();if(page==='training'){updateSceneViewUI();drawOrientationGuide();render($('scene'),current,yaw,$('labels').checked,selected);}}
function setSceneView(view){
 if(!['oblique','front','side'].includes(view))return;clearScenePointers();sceneView=view;
 yaw=view==='front'?0:view==='side'?Math.PI/2:-.45;updateSceneViewUI();drawScene();
}
function rotate(delta){if(!Number.isFinite(delta)||delta===0)return;sceneView='oblique';yaw+=delta;drawScene();}
$('sceneView').onchange=()=>setSceneView($('sceneView').value);
$('labels').onchange=drawScene;$('showAxes').onchange=drawScene;$('showIdealOutline').onchange=drawScene;
const scenePointers=new Map();let scenePinch=null;
function scenePointerDistance(){const [a,b]=[...scenePointers.values()];return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;}
function resetSceneGesture(){scenePinch=scenePointers.size>=2?{distance:scenePointerDistance(),zoom:sceneZoom}:null;}
function clearScenePointers(){const ids=[...scenePointers.keys()];scenePointers.clear();scenePinch=null;for(const id of ids)if($('scene').hasPointerCapture?.(id))$('scene').releasePointerCapture(id);}
function setSceneZoom(value){if(!Number.isFinite(value))return;const next=Math.max(SCENE_ZOOM_MIN,Math.min(SCENE_ZOOM_MAX,value));if(next===sceneZoom)return;sceneZoom=next;if(page==='training')render($('scene'),current,yaw,$('labels').checked,selected);}
$('scene').addEventListener('pointerdown',e=>{
 if(trainingMenuOpen||e.button!==0||e.pointerType!=='touch'&&e.isPrimary===false)return;scenePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});$('scene').setPointerCapture(e.pointerId);resetSceneGesture();
});
$('scene').addEventListener('pointermove',e=>{
 const point=scenePointers.get(e.pointerId);if(!point)return;const dx=e.clientX-point.x;point.x=e.clientX;point.y=e.clientY;
 if(scenePointers.size>=2){if(!scenePinch||scenePinch.distance<1)resetSceneGesture();else setSceneZoom(scenePinch.zoom*scenePointerDistance()/scenePinch.distance);}
 else rotate(dx*.009);
});
function endScenePointer(e){if(scenePointers.delete(e.pointerId))resetSceneGesture();}
$('scene').addEventListener('pointerup',endScenePointer);$('scene').addEventListener('pointercancel',endScenePointer);$('scene').addEventListener('lostpointercapture',endScenePointer);
window.addEventListener('blur',clearScenePointers);
$('scene').addEventListener('wheel',e=>{
 if(trainingMenuOpen||!e.deltaY)return;e.preventDefault();const pixels=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?$('scene').getBoundingClientRect().height:1);
 setSceneZoom(sceneZoom*Math.exp(-Math.max(-300,Math.min(300,pixels))*.0015));
},{passive:false});
$('scene').addEventListener('keydown',e=>{
 if(trainingMenuOpen)return;
 if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();rotate(e.key==='ArrowLeft'?-.12:.12);}
 else if(['+','=','-','_','Home'].includes(e.key)){e.preventDefault();setSceneZoom(e.key==='Home'?1:sceneZoom*(e.key==='-'||e.key==='_'?1/1.12:1.12));}
});
$('resetSceneZoom').onclick=()=>setSceneZoom(1);
function buildModeUI(){
 const base=machines.find(m=>m.id===current.id),box=$('machineModeBox');box.hidden=!base.modes;
 const select=$('machineMode');select.replaceChildren();(base.modes||[]).forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);});select.value=machineMode;
}
$('machineMode').onchange=()=>{const base=machines.find(m=>m.id===current.id);if($('machineMode').value===machineMode||!base.modes?.some(([value])=>value===$('machineMode').value))return;stopMotion();machineMode=$('machineMode').value;current=displayMachine(machines.find(m=>m.id===current.id));positions={X:0,Y:0,Z:0,A:0,C:0};selectedAxis='X';selected=0;populateMachine();setAxisMenuOpen(false,true);drawScene();};
function axisPositionDirections(a){
 if(!['X','Y','Z'].includes(a.key))return ['負側','正側'];
 return a.vector[1]?['下','上']:a.vector[0]?['左','右']:['手前','奥'];
}
function buildAxisUI(){
 const axes=axisConfig(current);$('axisTabs').replaceChildren();$('axisSliders').replaceChildren();$('drawerAxisSelect').replaceChildren();
 axes.forEach(a=>{const option=document.createElement('option');option.value=a.key;option.textContent=a.key+'軸';$('drawerAxisSelect').append(option);const btn=document.createElement('button');btn.textContent=a.key+'軸';btn.className='axis-tab';btn.style.setProperty('--axis',axisColors[a.key]);btn.setAttribute('aria-pressed',a.key===selectedAxis?'true':'false');btn.onclick=()=>{if(!trainingMenuOpen)selectAxis(a.key);};$('axisTabs').append(btn);
 const [negative,positive]=axisPositionDirections(a),row=document.createElement('div');row.className='axis-row';row.style.setProperty('--axis',axisColors[a.key]);row.innerHTML=`<label for="axis-${a.key}"><strong>${a.key}軸</strong><span>${a.part}<small>${a.direction}</small></span><output id="value-${a.key}">中央</output></label><input type="range" id="axis-${a.key}" min="-100" max="100" step="1" value="${positions[a.key]}" aria-label="${a.key}軸の部品位置"><div class="range-ends"><span>部材− ${negative}</span><span>部材＋ ${positive}</span></div>`;$('axisSliders').append(row);
 $('axis-'+a.key).addEventListener('input',e=>{stopMotion();positions[a.key]=Number(e.target.value);selectAxis(a.key);updateAxisValues();saveLeveling();drawScene();});});
 updateAxisValues();selectAxis(selectedAxis);
}
function updateAxisValues(){for(const a of axisConfig(current)){const sides=axisPositionDirections(a),label=positions[a.key]===0?'中央':sides[positions[a.key]>0?1:0];$('axis-'+a.key).value=positions[a.key];$('axis-'+a.key).setAttribute('aria-valuetext','部材位置・'+label);$('value-'+a.key).textContent=label;}}
function selectAxis(key){
 const a=axisConfig(current).find(a=>a.key===key);if(!a)return;stopMotion();selectedAxis=key;
 Array.from($('axisTabs').children).forEach(b=>b.setAttribute('aria-pressed',b.textContent===key+'軸'?'true':'false'));
 for(const axis of axisConfig(current))$('axis-'+axis.key).parentElement.hidden=axis.key!==key;
 $('axisMenuTitle').textContent=key+'軸の操作';
 $('drawerAxisSelect').value=key;
 updateSceneViewUI();drawScene();
}
function refreshTrainingLayout(){
 const shell=$('trainingShell'),rect=shell.getBoundingClientRect();if(!rect.width||!rect.height)return;
 const drawerWidth=trainingMenuOpen?Math.min(320,Math.max(184,rect.width*.42),rect.width*.64):0;
 trainingMainScale=(rect.width-drawerWidth)/rect.width;shell.style.setProperty('--drawer-width',drawerWidth+'px');
 const main=$('trainingMain');main.style.width=rect.width+'px';main.style.height=rect.height+'px';main.style.transform='scale('+trainingMainScale+')';
}
function trainingMenuFocusables(){
 const found=[],walk=node=>{
  if(node.hidden||node.disabled)return;
  const tag=node.tagName,tab=node.getAttribute?.('tabindex');
  if(['BUTTON','INPUT','SELECT','TEXTAREA','SUMMARY'].includes(tag)||tag==='A'&&node.getAttribute('href')!==null||tab!==null&&Number(tab)>=0)found.push(node);
  for(const child of node.children||[])if(tag!=='DETAILS'||node.open||child.tagName==='SUMMARY')walk(child);
 };walk($('trainingDrawer'));return found;
}
function setTrainingMenuOpen(open,restoreFocus=false){
 open=!!open;clearScenePointers();trainingMenuOpen=open;
 $('trainingDrawer').hidden=!open;$('trainingShell').classList.toggle('menu-open',open);$('openTrainingMenu').setAttribute('aria-expanded',String(open));
 $('axisControlsToggle').setAttribute('aria-expanded',String(open));$('trainingMain').inert=open;$('trainingMain').setAttribute('aria-hidden',String(open));$('trainingMainShield').hidden=!open;
 refreshTrainingLayout();
 if(open){$('trainingControls').scrollTop=0;$('closeTrainingMenu').focus?.({preventScroll:true});}
 else if(restoreFocus)$('openTrainingMenu').focus?.({preventScroll:true});
 if(page==='training')drawScene();
}
function setAxisMenuOpen(open,focusToggle=false){
 if(open)$('axisMenuSection').open=true;setTrainingMenuOpen(open,focusToggle);
}
$('openTrainingMenu').onclick=()=>setTrainingMenuOpen(!trainingMenuOpen,true);
$('closeTrainingMenu').onclick=()=>setTrainingMenuOpen(false,true);
$('trainingMainShield').onclick=()=>setTrainingMenuOpen(false,true);
$('drawerAxisSelect').onchange=()=>selectAxis($('drawerAxisSelect').value);
$('axisControlsToggle').onclick=()=>setAxisMenuOpen(!trainingMenuOpen);
$('closeAxisControls').onclick=()=>setAxisMenuOpen(false,true);
function trainingMenuKeydown(e){
 if(!trainingMenuOpen)return;
 if(e.key==='Escape'){e.preventDefault();setTrainingMenuOpen(false,true);return;}
 // This is a non-modal settings panel: Tab can reach the shared site navigation.

}
$('trainingDrawer').addEventListener('keydown',trainingMenuKeydown);
$('axisMenu').addEventListener('keydown',trainingMenuKeydown);
if(typeof ResizeObserver==='function')new ResizeObserver(()=>{if(page==='training'){refreshTrainingLayout();drawScene();}}).observe($('trainingShell'));
let motionFrame=null,motionStart=null;
function stopMotion(){const running=motionFrame!==null;if(running)cancelAnimationFrame(motionFrame);motionFrame=null;motionStart=null;if($('playAxis')){$('playAxis').textContent='選んだ軸を動かす';$('playAxis').setAttribute('aria-pressed','false');}if(running){$('axisDemoStatus').textContent=selectedAxis+'軸の動作を終了しました。';if(typeof saveLeveling==='function')saveLeveling();}}
$('playAxis').onclick=()=>{if(motionFrame!==null){stopMotion();return;}$('playAxis').textContent='動きを止める';$('playAxis').setAttribute('aria-pressed','true');const key=selectedAxis;
 setAxisMenuOpen(false,true);$('axisDemoStatus').textContent=key+'軸の動作を確認中です。設定メニューの軸位置・デモから停止できます。';
 // A single round trip demonstrates the chosen part; no endless motion.
 function step(t){if(motionStart===null)motionStart=t;const progress=Math.min((t-motionStart)/3500,1);positions[key]=Math.sin(progress*2*Math.PI)*85;updateAxisValues();drawScene();if(progress<1)motionFrame=requestAnimationFrame(step);else{positions[key]=0;updateAxisValues();stopMotion();drawScene();}}
 motionFrame=requestAnimationFrame(step);
};
$('resetAxes').onclick=()=>{stopMotion();positions={X:0,Y:0,Z:0,A:0,C:0};updateAxisValues();saveLeveling();drawScene();};
window.addEventListener('pageshow',event=>{if(event.persisted&&page==='training')openMachine(machines.find(m=>m.id===current.id),{fromHistory:true});});
window.addEventListener('pagehide',stopMotion);document.addEventListener('visibilitychange',()=>{if(document.hidden)stopMotion();});
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(page==='catalog')drawThumbnails();refreshTrainingLayout();drawScene();},80);});
navigate('home');

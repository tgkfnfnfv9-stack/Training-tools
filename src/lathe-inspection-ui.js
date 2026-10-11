'use strict';
// Lathe-only rigid assemblies on the existing support surface. Separating the
// common rotation makes a rigid tilt a common transform, not an alignment error.
function latheAssembly(raw,pose,state=positions,solution=levelSolution,profile=machineProfile,factor=1){
 const V=window.LatheInspection,L=window.Leveling,scale=p=>{const q=levelCoordinates(p[0],p[2]);return [q.x,p[1],q.z];};
 const bar=pose==='latheTestBar';if(bar)pose='tool';
 const base=scale(pose==='tool'?[-current.w*.35,.66,0]:[.08,.66,.15]);
 const travel=pose==='work'?scale([.7*state.Z/100,0,.35*state.X/100]):[0,0,0],seat=V.add(base,[travel[0],0,0]);
 const common=L.orientation({lr:solution.lr*factor,fb:solution.fb*factor}),slope=solution.slopeAt(seat[0],seat[2]),local=L.orientation({lr:(slope.lr-solution.lr)*factor,fb:(slope.fb-solution.fb)*factor});
 const body=pose==='tool'?intrinsicBodyFrame(axisConfig(current),profile,factor):{rotate:v=>v};
 const rotate=v=>common.rotate(local.rotate(body.rotate(v)));
 const plane=solution.plane,residual=solution.heightAt(seat[0],seat[2])-(plane.a*seat[0]+plane.b*seat[2]+plane.c);
 const origin=V.add(common.rotate([seat[0],residual*factor/1000,seat[2]]),[0,.66+plane.c*factor/1000,0]);
 // Support dimensions scale the machine layout and bar length, but never the
 // calibrated 50 mm circular cross-section around the spindle centre line.
 const material=scale(raw);if(bar)material[2]=raw[2];
 const relative=V.add(V.sub(material,base),[0,0,travel[2]]);
 return {point:V.add(origin,rotate(relative)),rotate};
}
function latheInspectionGeometry(state=positions,solution=levelSolution,profile=machineProfile){
 const V=window.LatheInspection,{add,sub,mul,dot,unit}=V,k=V.intrinsic(profile),length=.3;
 const at=(p,pose,s=state)=>latheAssembly(p,pose,s,solution,profile),sx=levelCoordinates(0,.35).z,sz=levelCoordinates(.7,0).x;
 // At a travel end, keep a full 300 mm scan inside the slider's range.
 const validX=2*sx>=length-1e-12,validZ=2*sz>=length-1e-12;
 const xStart={...state,X:Math.max(-100,Math.min(state.X,100-length/sx*100))},zStart={...state,Z:Math.max(-100,Math.min(state.Z,100-length/sz*100))};
 const xEnd={...xStart,X:Math.min(100,xStart.X+length/sx*100)},zEnd={...zStart,Z:Math.min(100,zStart.Z+length/sz*100)};
 const front=[-.09,1.5,1],flat=[.23,1.5,1.43];
 const n=[-Math.cos(k.face),0,-Math.sin(k.face)],nz=[Math.sin(k.flat),0,Math.cos(k.flat)];
 const widthScale=levelCoordinates(1,0).x,depthScale=levelCoordinates(0,1).z;
 function faceScan(raw,normal,start,end,key,travelValid){
  if(!travelValid)return {valid:false,microns:null,reason:'300 mmの走査範囲不足',samples:[]};
  const first=at(raw,'work',start),body=add(first.point,mul(first.rotate(normal),.01)),probe=mul(first.rotate(normal),-1);
  const fractions=new Set(Array.from({length:17},(_,i)=>i/16));
  if(key==='Z'){
   const startX=levelCoordinates(.08+.7*start.Z/100,0).x;
   for(const p of supports){const t=(levelCoordinates(p.x,p.z).x-startX)/length;if(t>0&&t<1)for(const d of [-1e-8,0,1e-8])fractions.add(Math.max(0,Math.min(1,t+d)));}
  }
  const samples=[...fractions].sort((a,b)=>a-b).map(t=>{
   const state={...start,[key]:start[key]+(end[key]-start[key])*t},plane=at(raw,'work',state),pose={body,probe,point:plane.point,normal:plane.rotate(normal)},hit=V.planeContact(pose);
   if(!hit.valid)return {...hit,t,state,pose};
   const delta=sub(hit.point,plane.point),local=[[1,0,0],[0,1,0],[0,0,1]].map(e=>dot(plane.rotate(e),delta));
   const material=add([raw[0]*widthScale,raw[1],raw[2]*depthScale],local);
   // Match the drawn 12-sided turret: front x=-.09, rear x=.25,
   // apothem .43, and the outer Z face centred at z=1.43. The intrinsic
   // face angle tilts this finite surface, without inventing a larger face.
   const onFace=key==='X'?Array.from({length:12},(_,i)=>i*Math.PI/6).every(a=>Math.cos(a)*(material[1]-1.5)+Math.sin(a)*(material[2]/depthScale-1)<=.43+1e-9):material[0]>=-.09*widthScale-1e-9&&material[0]<=.25*widthScale+1e-9&&Math.abs(material[1]-1.5)<=.43*Math.tan(Math.PI/12)+1e-9;
   return {...hit,t,state,pose,material,...(!onFace?{valid:false,reason:'タレット面'+key+'の範囲外'}:{})};
  });
  const bad=samples.find(p=>!p.valid),zero=samples[0],last=samples.at(-1);
  return bad?{valid:false,microns:null,reason:bad.reason,failureT:bad.t,samples}:{valid:true,microns:(zero.extension-last.extension)*1e6,zero,last,samples};
 }
 const faceMeasurement=faceScan(front,n,xStart,xEnd,'X',validX),flatMeasurement=faceScan(flat,nz,zStart,zEnd,'Z',validZ),face=faceMeasurement.microns,flatReading=flatMeasurement.microns;
 const head=at([-current.w*.24+.125,1.5,0],'tool'),axis=unit(head.rotate([1,0,0])),radial=unit(head.rotate([0,0,1])),up=unit(head.rotate([0,1,0]));
 // Fixed nominal X centre position; never re-centred against a tilted spindle.
 // The inspection holder is now on the rear (+internal z) side.
 const holeState={...state,X:-.20/.35*100},hole=at([-.09,1.5,.20],'work',holeState);
 const centre=add(hole.point,hole.rotate([0,k.holeY,k.holeX])),delta=sub(centre,head.point),dx=dot(delta,radial),dy=dot(delta,up);
 // Looking from spindle towards turret (+internal x), screen right is -z.
 const bore=V.bore(-dx,dy);
 // Bar stays on the spindle. Mount a plunger on the turret at a, then transport
 // BOTH its body and its direction with the same rigid bracket throughout Z.
 // This is extension difference, not a diameter or a doubled radial error.
 const mountRaw=[.08,1.5,.20],mount=at(mountRaw,'work',zStart),inverse=v=>[[1,0,0],[0,1,0],[0,0,1]].map(e=>dot(mount.rotate(e),v));
 const centreA=add(head.point,mul(axis,dot(sub(mount.point,head.point),axis))),barLength=levelCoordinates(current.w*.225-(-current.w*.24+.125),0).x;
 const barScan=normal=>{
  if(!validZ)return {valid:false,microns:null,reason:'travel-range'};
  const body0=add(centreA,mul(normal,.035)),probe0=mul(normal,-1),bodyLocal=inverse(sub(body0,mount.point)),probeLocal=inverse(probe0);
  const fractions=new Set(Array.from({length:17},(_,i)=>i/16));
  // Include support-cell boundaries and both sides of their slope transition.
  const startX=levelCoordinates(.08+.7*zStart.Z/100,0).x;
  for(const p of supports){const f=(levelCoordinates(p.x,p.z).x-startX)/length;if(f>0&&f<1)for(const d of [-1e-8,0,1e-8])fractions.add(Math.max(0,Math.min(1,f+d)));}
  const samples=[...fractions].sort((a,b)=>a-b).map(t=>{
   const m=at(mountRaw,'work',{...zStart,Z:zStart.Z+(zEnd.Z-zStart.Z)*t}),body=add(m.point,m.rotate(bodyLocal)),probe=m.rotate(probeLocal);
   return {t,body,probe,...V.cylinderContact(body,probe,head.point,axis,.025,barLength)};
  });
  if(samples.some(s=>!s.valid))return {valid:false,microns:null,reason:samples.find(s=>!s.valid).reason,samples};
  return {valid:true,microns:(samples[0].extension-samples.at(-1).extension)*1e6,samples};
 };
 const side=barScan(radial),top=barScan(up);
 return {model:V.model,face,flat:flatReading,faceScan:faceMeasurement,flatScan:flatMeasurement,dx:dx*1e6,dy:dy*1e6,bore,barSide:side.microns,barTop:top.microns,side,top,validX,validZ,xStart,zStart,xEnd,zEnd,head:head.point,hole:centre,barLength};
}
function latheInspectionMarkup(data,runout,second=false){
 const n=v=>Number.isFinite(v)?squarenessMicronText(v):'—',svg=(label,body)=>`<svg viewBox="0 0 180 100" role="img" aria-label="${label}"><title>${label}</title>${body}</svg>`;
 const panel=(title,body,note)=>`<section><h2>${title}</h2>${body}<p>${note}</p></section>`;
 const polygon='<path d="M55 12L85 12L108 35L108 65L85 86L55 86L32 65L32 35Z" fill="#fff6ec" stroke="#6c5a4a"/>';
 if(!second)return panel('主軸振れ・µm',svg('主軸回転TIR。根元と300 mm先の固有成分でレベル調整では不変。取付けと最初のゼロを保持した瞬間の総指示ではありません。',`<g fill="#fff6ec" stroke="#6c5a4a"><path d="M15 18H45V74H15ZM45 39H158V53H45Z"/></g><path d="M54 30V60M146 30V60" stroke="#c45a09"/><text x="53" y="23" text-anchor="middle">a</text><text x="146" y="23" text-anchor="middle">b</text><text x="30" y="90">a ${Math.round(runout.rootMicrons)}　b ${Math.round(runout.tipMicrons)}</text><text x="99" y="72" text-anchor="middle">↻ 回転TIR</text>`),'固有値・レベルでは不変')+panel('刃物台精度・µm',svg('計器は主軸台側に固定。Xは前面、Zは外側フラット。始点ゼロ、押込み増加がプラス。',`${polygon}<path d="M108 35L145 23V53L108 65M85 12L122 2L145 23" fill="#fffaf4" stroke="#6c5a4a"/><path d="M60 62H94M121 56L138 42" stroke="#c45a09"/><text x="50" y="58">a → b</text><text x="119" y="77">c → d</text><text x="61" y="38">X</text><text x="122" y="35">Z</text><text x="4" y="94">X ${n(data.face)}　Z ${n(data.flat)}</text>`),data.faceScan.valid&&data.flatScan.valid?'300 mm・始点再ゼロ後':`測定不可：${!data.faceScan.valid?'X '+data.faceScan.reason+' ':''}${!data.flatScan.valid?'Z '+data.flatScan.reason:''}`);
 const marks=data.bore.valid?data.bore.readings.map(n):['—','—','—','—'];
 return panel('主軸と刃物台の穴芯',svg('主軸から刃物台を見る。a左、b上、c右、d下。Xは固定の公称芯位置。aでゼロ。',`${polygon}<circle cx="70" cy="49" r="17" fill="white" stroke="#6c5a4a"/><path d="M44 49H96M70 23V75" stroke="#a49386"/><circle cx="70" cy="49" r="2" fill="#c45a09"/><text x="0" y="52">a ${marks[0]}</text><text x="65" y="14">b ${marks[1]}</text><text x="110" y="52">c ${marks[2]}</text><text x="65" y="94">d ${marks[3]}</text>`),`芯差 X ${n(data.dx)}／高さ ${n(data.dy)} µm`) +panel('テストバー測定・µm',svg('主軸固定のテストバーに、タレット側のダイヤルを接触。側面は奥側から、上面は上から測る。主軸側aを0にして先端側bへZを300 mm送り、押込み増加がプラス。',`<g fill="#fff6ec" stroke="#6c5a4a"><path d="M5 13H27V33H5ZM27 24H160V29H27Z"/><rect x="121" y="5" width="26" height="12" rx="2"/></g><path d="M134 17V24M127 11H141M133 8L137 14" stroke="#c45a09" fill="none"/><path d="M45 18H110l-5,-3m5,3l-5,3" stroke="#c45a09" fill="none"/><text x="39" y="43">a 0</text><text x="130" y="43">b</text><text x="55" y="12" font-size="9">Z 300 mm →</text><text x="8" y="66">側面（奥） ${n(data.barSide)}</text><text x="8" y="85">上面 ${n(data.barTop)}</text>`),data.validZ?(data.side.valid&&data.top.valid?'バー固定・ダイヤルをZ送り':'接触範囲外・詳細は▽'):'300 mmのZ走査範囲不足');
}
let latheInspectionLastKey='';
function updateLatheInspectionUI(){
 const data=latheInspectionGeometry(),intrinsic=window.IntrinsicInspection.fromProfile(machineProfile),runout=intrinsic?.runout||{rootMicrons:0,tipMicrons:0};
 const key=JSON.stringify([data,runout]);
 if(key!==latheInspectionLastKey||!$('liveSquareness').querySelector('.lathe-inspection-columns')){
  latheInspectionLastKey=key;$('liveSquareness').innerHTML='<div class="lathe-inspection-columns">'+latheInspectionMarkup(data,runout)+'</div>';
  $('latheInspectionSecond').innerHTML='<div class="lathe-inspection-columns">'+latheInspectionMarkup(data,runout,true)+'</div>';
 }
 $('liveSquareness').dataset.lathe=JSON.stringify({face:data.face,flat:data.flat,dx:data.dx,dy:data.dy,barSide:data.barSide,barTop:data.barTop,runout});
 if(!$('measurementReferenceCards').querySelector('.lathe-inspection-detail'))$('measurementReferenceCards').innerHTML='<article class="measurement-reference-card lathe-inspection-detail"><h3>タレット旋盤の検査・µm</h3><p>Haas STシリーズの検査配置を参考にした汎用2軸模型です。12角タレットは工具1番で固定し、割出し動作は実装していません。6点支持と寸法は教材用で、特定型式の再現ではありません。</p><p>主軸振れ：主軸を回転し、テストバーの根元aと300 mm先bの最大−最小（TIR）。同じ個体の固有値で、支持調整では変わりません。計器の取付点・腕は定義しておらず、取付けとゼロを保持した瞬間の総指示ではありません。</p><p>刃物台精度：計器は主軸台側に固定。Xはタレット前面をa→b、Zは外側フラットをc→dへ送ります。300 mmは教材の設定で、メーカーの検査距離ではありません。計器は始点の面法線に合わせてゼロ。押込み増加が＋。Xの面傾斜は同じ剛体内の固有差で、Zは移動中の往復台姿勢と取付高さ0.84 mも反映します。端では走査軸の始点だけを内側へ戻し、全区間を確保します。全行程が300 mm未満なら走査不足、途中で模型の有限タレット面を外れたり測定子範囲を外れたりすれば測定不可（—）と表示します。</p><p>穴芯：仮想ホルダを公称X芯位置へ戻し、現在のZ位置で主軸側の計器を回して内径を測ります。図は主軸から刃物台を見る向きでa左／b上／c右／d下。aでゼロ、押込み増加が＋。芯差X=(c−a)/2、高さ=(d−b)/2。Xスライダーとは独立の芯位置検査で、支持を変えても芯合わせは取り直しません。主軸直交面の円断面による偏心検査の近似で、穴軸傾きによる楕円断面は含みません。孔径50 mm、取付高さ0.84 m。数値のXは部材の径方向（模型内部＋z、図の左向き）で、NCの直径指令の正負ではありません。タレットは奥側にあり、Xスライダーの＋は部材が主軸から離れる向き、Zの＋は主軸台から離れる向きです。</p><p>テストバー測定：バーは主軸に固定し、主軸は回さず、タレットに固定したダイヤルをZの＋（主軸側aから先端側b）へ300 mm送ります。側面は奥側から手前向き、上面は上から下向きに測定子を当てます。側面と上面は計器を付け替える別の検査です。aでゼロ、測定子の伸びが減る押込み側を＋としてbの指示を表示します。棒の直径差ではなくダイヤルの指示差で、値を2倍しません。バーは理想円筒φ50 mm。回転振れの固有値とは別の、Z送りに対する平行度の測定です。</p><p>支持・軸位置・寸法・個体を変えると、面測定の取付け・方向合わせと始点ゼロを取り直します。表示は300 mm走査の終点で、器具と最初のゼロを保持した支持操作中の指示ではありません。バー測定も始点の軸位置に計器を取り付け直し、10 mmの伸びで接触ゼロを設定します。そこから終点までは計器本体と測定子方向を同じブラケットで運び、途中で再ゼロしません。模型の取付基準（支持から0.84 m）から接触位置までの腕の長さを計算に含めます。16分割に加え、支持補間境界の両側で接触・20 mmの測定子範囲・バー長を確認し、成立しないときは—を表示します。連続経路の治具干渉やバーの自重たわみは再現しません。穴芯の公称Xは固定です。各図の測定器・ホルダは検査用の仮想配置で、模型に検査治具の干渉やブラケット寸法は再現していません。面接触は模型の12角前面と外側フラットの有限範囲を確認します。16分割とZ走査の支持境界両側で接触・20 mm測定子範囲を判定しますが、全治具干渉や連続経路の保証はしません。表示は整数µmなので微小な変化が同じ整数になることがあります。</p><p><a href="https://www.haascnc.com/service/troubleshooting-and-how-to/how-to/st-lathe-alignment-indicating-zones-.html" target="_blank" rel="noopener">Haas公式：ST Lathe Alignment Indicating Zones</a></p></article>';
 $('inspectionCarousel').style.setProperty('--inspection-height',$('precisionReadouts').getBoundingClientRect().height+'px');
}

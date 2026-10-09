'use strict';
// Lathe-only rigid assemblies on the existing support surface. Separating the
// common rotation makes a rigid tilt a common transform, not a taper error.
function latheAssembly(raw,pose,state=positions,solution=levelSolution,profile=machineProfile,factor=1){
 const V=window.LatheInspection,L=window.Leveling,scale=p=>{const q=levelCoordinates(p[0],p[2]);return [q.x,p[1],q.z];};
 const base=scale(pose==='tool'?[-current.w*.35,.66,0]:pose==='tailstock'?[current.w*.33,.66,0]:[.08,.66,-.15]);
 const travel=pose==='work'?scale([.7*state.Z/100,0,.35*state.X/100]):[0,0,0],seat=V.add(base,[travel[0],0,0]);
 const common=L.orientation({lr:solution.lr*factor,fb:solution.fb*factor}),slope=solution.slopeAt(seat[0],seat[2]),local=L.orientation({lr:(slope.lr-solution.lr)*factor,fb:(slope.fb-solution.fb)*factor});
 const body=pose==='tool'?intrinsicBodyFrame(axisConfig(current),profile,factor):{rotate:v=>v};
 const rotate=v=>common.rotate(local.rotate(body.rotate(v)));
 const plane=solution.plane,residual=solution.heightAt(seat[0],seat[2])-(plane.a*seat[0]+plane.b*seat[2]+plane.c);
 const origin=V.add(common.rotate([seat[0],residual*factor/1000,seat[2]]),[0,.66+plane.c*factor/1000,0]);
 const relative=V.add(V.sub(scale(raw),base),[0,0,travel[2]]);
 return {point:V.add(origin,rotate(relative)),rotate};
}
function latheInspectionGeometry(state=positions,solution=levelSolution,profile=machineProfile){
 const V=window.LatheInspection,{add,sub,mul,dot,unit}=V,k=V.intrinsic(profile),length=.3;
 const at=(p,pose,s=state)=>latheAssembly(p,pose,s,solution,profile),sx=levelCoordinates(0,.35).z,sz=levelCoordinates(.7,0).x;
 // At a travel end, keep a full 300 mm scan inside the slider's range.
 const validX=2*sx>=length-1e-12,validZ=2*sz>=length-1e-12;
 const xStart={...state,X:Math.max(-100,Math.min(state.X,100-length/sx*100))},zStart={...state,Z:Math.max(-100,Math.min(state.Z,100-length/sz*100))};
 const xEnd={...xStart,X:Math.min(100,xStart.X+length/sx*100)},zEnd={...zStart,Z:Math.min(100,zStart.Z+length/sz*100)};
 const front=[-.09,1.5,-1],flat=[.23,1.5,-1.43];
 const f0=at(front,'work',xStart),f1=at(front,'work',xEnd),n=[-Math.cos(k.face),0,Math.sin(k.face)];
 const z0=at(flat,'work',zStart),z1=at(flat,'work',zEnd),nz=[Math.sin(k.flat),0,-Math.cos(k.flat)];
 const face=validX?V.planeScan(f0.point,f1.point,f0.rotate(n),f1.rotate(n)):null;
 const flatReading=validZ?V.planeScan(z0.point,z1.point,z0.rotate(nz),z1.rotate(nz)):null;
 const head=at([-current.w*.24+.125,1.5,0],'tool'),axis=unit(head.rotate([1,0,0])),radial=unit(head.rotate([0,0,1])),up=unit(head.rotate([0,1,0]));
 // Stored nominal X centre position; never re-centred against a tilted spindle.
 // The inspection hole is a temporary holder, .20 raw units toward the front.
 const holeState={...state,X:.20/.35*100},hole=at([-.09,1.5,-.20],'work',holeState);
 const centre=add(hole.point,hole.rotate([0,k.holeY,k.holeX])),delta=sub(centre,head.point),dx=dot(delta,radial),dy=dot(delta,up);
 // Looking from spindle towards turret (+internal x), screen right is -z.
 const bore=V.bore(-dx,dy);
 // Virtual test cut: set the cutter at a to R=25 mm, then preserve its local
 // mounting for the Z scan. No forces, chuck compliance or thermal effects.
 const cut=(origin,direction)=>{
  const u=unit(direction),rad=unit(sub(radial,mul(u,dot(radial,u))));
  const centreA=add(origin,mul(u,dot(sub(z0.point,origin),u))),first=add(centreA,mul(rad,-.025));
  const worldOffset=sub(first,z0.point),localOffset=[[1,0,0],[0,1,0],[0,0,1]].map(e=>dot(z0.rotate(e),worldOffset));
  const last=add(z1.point,z1.rotate(localOffset));
  return V.diameterDifference(first,last,origin,u);
 };
 const tail=at([current.w*.225,1.5,0],'tailstock');
 return {model:V.model,face,flat:flatReading,dx:dx*1e6,dy:dy*1e6,bore,unsupported:validZ?cut(head.point,axis):null,supported:validZ?cut(head.point,sub(tail.point,head.point)):null,validX,validZ,xStart,zStart,xEnd,zEnd,head:head.point,hole:centre,tail:tail.point};
}
function latheInspectionMarkup(data,runout,second=false){
 const n=v=>Number.isFinite(v)?squarenessMicronText(v):'—',svg=(label,body)=>`<svg viewBox="0 0 180 100" role="img" aria-label="${label}"><title>${label}</title>${body}</svg>`;
 const panel=(title,body,note)=>`<section><h2>${title}</h2>${body}<p>${note}</p></section>`;
 const polygon='<path d="M55 12L85 12L108 35L108 65L85 86L55 86L32 65L32 35Z" fill="#fff6ec" stroke="#6c5a4a"/>';
 if(!second)return panel('主軸振れ・µm',svg('主軸回転TIR。根元と300 mm先。レベル調整では不変。',`<g fill="#fff6ec" stroke="#6c5a4a"><path d="M15 18H45V74H15ZM45 39H158V53H45Z"/></g><path d="M54 30V60M146 30V60" stroke="#c45a09"/><text x="53" y="23" text-anchor="middle">a</text><text x="146" y="23" text-anchor="middle">b</text><text x="30" y="90">a ${Math.round(runout.rootMicrons)}　b ${Math.round(runout.tipMicrons)}</text><text x="99" y="72" text-anchor="middle">↻ 回転TIR</text>`),'固有値・レベルでは不変')+panel('刃物台精度・µm',svg('計器は主軸台側に固定。Xは前面、Zは外側フラット。始点ゼロ、押込み増加がプラス。',`${polygon}<path d="M108 35L145 23V53L108 65M85 12L122 2L145 23" fill="#fffaf4" stroke="#6c5a4a"/><path d="M60 62H94M121 56L138 42" stroke="#c45a09"/><text x="50" y="58">a → b</text><text x="119" y="77">c → d</text><text x="61" y="38">X</text><text x="122" y="35">Z</text><text x="4" y="94">X ${n(data.face)}　Z ${n(data.flat)}</text>`),data.validX&&data.validZ?'300 mm・Xは固有／Zは支持も反映':`300 mm：${!data.validX?'X走査不足 ':''}${!data.validZ?'Z走査不足':''}`);
 const marks=data.bore.valid?data.bore.readings.map(n):['—','—','—','—'];
 return panel('主軸と刃物台の穴芯',svg('主軸から刃物台を見る。a左、b上、c右、d下。Xは固定の公称芯位置。aでゼロ。',`${polygon}<circle cx="70" cy="49" r="17" fill="white" stroke="#6c5a4a"/><path d="M44 49H96M70 23V75" stroke="#a49386"/><circle cx="70" cy="49" r="2" fill="#c45a09"/><text x="0" y="52">a ${marks[0]}</text><text x="65" y="14">b ${marks[1]}</text><text x="110" y="52">c ${marks[2]}</text><text x="65" y="94">d ${marks[3]}</text>`),`芯差 X ${n(data.dx)}／高さ ${n(data.dy)} µm`)+panel('テスト加工',svg('a主軸側からbへ300 mm。bの直径からaの直径を引いた幾何成分。心押ありは両端中心を結ぶ直線の仮定。',`<g fill="#fff6ec" stroke="#6c5a4a"><path d="M8 9H30V40H8ZM30 20H137V30H30ZM137 25L152 18V32ZM8 59H30V90H8ZM30 70H137V80H30Z"/></g><g fill="#c45a09"><text x="38" y="17">a</text><text x="128" y="17">b</text><text x="38" y="67">a</text><text x="128" y="67">b</text></g><text x="34" y="46">心押あり ${n(data.supported)}</text><text x="34" y="94">片持ち ${n(data.unsupported)}</text>`),data.validZ?'径差 b−a・µm／たわみは含まない':'300 mmのZ走査範囲不足');
}
let latheInspectionLastKey='';
function updateLatheInspectionUI(){
 const data=latheInspectionGeometry(),intrinsic=window.IntrinsicInspection.fromProfile(machineProfile),runout=intrinsic?.runout||{rootMicrons:0,tipMicrons:0};
 const key=JSON.stringify([data,runout]);
 if(key!==latheInspectionLastKey||!$('liveSquareness').querySelector('.lathe-inspection-columns')){
  latheInspectionLastKey=key;$('liveSquareness').innerHTML='<div class="lathe-inspection-columns">'+latheInspectionMarkup(data,runout)+'</div>';
  $('latheInspectionSecond').innerHTML='<div class="lathe-inspection-columns">'+latheInspectionMarkup(data,runout,true)+'</div>';
 }
 $('liveSquareness').dataset.lathe=JSON.stringify({face:data.face,flat:data.flat,dx:data.dx,dy:data.dy,supported:data.supported,unsupported:data.unsupported,runout});
 if(!$('measurementReferenceCards').querySelector('.lathe-inspection-detail'))$('measurementReferenceCards').innerHTML='<article class="measurement-reference-card lathe-inspection-detail"><h3>タレット旋盤の検査・µm</h3><p>Haas STシリーズの検査配置を参考にした汎用2軸模型です。12角タレットは工具1番で固定し、割出し動作は実装していません。6点支持と寸法は教材用で、特定型式の再現ではありません。</p><p>主軸振れ：主軸を回転し、テストバーの根元aと300 mm先bの最大−最小（TIR）。同じ個体の固有値で、支持調整では変わりません。</p><p>刃物台精度：計器は主軸台側に固定。Xはタレット前面をa→b、Zは外側フラットをc→dへ送ります。300 mmは教材の設定で、メーカーの検査距離ではありません。計器は始点の面法線に合わせてゼロ。押込み増加が＋。Xの面傾斜は同じ剛体内の固有差で、Zは移動中の往復台姿勢と取付高さ0.84 mも反映します。端では走査軸の始点だけを内側へ戻し、全区間を確保します。全行程が300 mm未満になる寸法では数値を出さず走査不足と表示します。</p><p>穴芯：仮想ホルダを公称X芯位置へ戻し、現在のZ位置で主軸側の計器を回して内径を測ります。図は主軸から刃物台を見る向きでa左／b上／c右／d下。aでゼロ、押込み増加が＋。芯差X=(c−a)/2、高さ=(d−b)/2。Xスライダーとは独立の芯位置検査で、支持を変えても芯合わせは取り直しません。主軸直交面の円断面による偏心検査の近似で、穴軸傾きによる楕円断面は含みません。孔径50 mm、取付高さ0.84 m。数値のXは部材の径方向（模型内部＋z、図の左向き）で、NCの直径指令の正負ではありません。Xスライダーの＋は部材が主軸側へ進む向き、Zの＋は主軸台から離れる向きです。</p><p>テスト加工：aで直径50 mmとなる工具位置を設定し、同じ固定取付けでZを300 mm送り、径差Db−Daを計算します。＋はbが太い。片持ちは主軸中心線、心押ありは主軸鼻端と心押中心を結ぶ直線を仮定します。心押ありの値は実際のチャック支持材のたわみを解いたものではありません。切削力・弾性・熱・刃先摩耗は含まず、径の絶対値や実加工テーパを保証しません。</p><p>支持・軸位置を変えると、面測定の方向合わせと始点ゼロ、加工のa径設定を取り直します。穴芯の公称Xは固定です。各図の測定器・ホルダは検査用の仮想配置で、模型に検査治具の干渉やブラケット寸法は再現していません。面接触は無限平面の近似で、支持寸法を縮めたときなどの有限タレット面からの測定子の脱落は判定しません。表示は整数µmなので微小な変化が同じ整数になることがあります。</p><p><a href="https://www.haascnc.com/service/troubleshooting-and-how-to/how-to/st-lathe-alignment-indicating-zones-.html" target="_blank" rel="noopener">Haas公式：ST Lathe Alignment Indicating Zones</a></p></article>';
 $('inspectionCarousel').style.setProperty('--inspection-height',$('precisionReadouts').getBoundingClientRect().height+'px');
}

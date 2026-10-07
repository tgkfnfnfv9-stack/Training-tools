'use strict';
// Fixed teaching fixtures. Member ownership describes mechanics, never a sign table.
function referenceSetup(pair){
 const lathe=current.kind==='lathe',gate=['double','gantry','portal'].includes(current.kind),base=lathe?'Z':pair.key[0],scan=lathe?'X':pair.key[1];
 const owner=key=>lathe?'body':current.kind==='horizontal'?(key==='Z'?'master':'body'):['compact','vertical','five'].includes(current.kind)?(key==='Z'?'body':'master'):current.kind==='double'?(key==='X'?'master':'body'):'body';
 const member=axisConfig(current).find(a=>a.key===scan),direction=v=>v[1]?'上':v[0]?'右':'奥',normalDirection=direction(axisConfig(current).find(a=>a.key===base).vector),positiveScanDirection=direction(member.vector),opposite={上:'下',右:'左',奥:'手前'};
 // Desired contact traversal in the developed face: XY low->high, XZ/YZ
 // high->low. Derive member movement from fixture ownership, not dial signs.
 const relativeSign=pair.key==='XY'?1:-1,memberSign=relativeSign*(owner(scan)==='master'?-1:1),relativeDirection=relativeSign>0?positiveScanDirection:opposite[positiveScanDirection];
 const zeroLocation=(relativeSign>0?opposite[positiveScanDirection]:positiveScanDirection)+'・'+normalDirection+'側';
 return {base,scan,owner:owner(scan),member:member.part,normalDirection,positiveScanDirection,scanDirection:memberSign>0?positiveScanDirection:opposite[positiveScanDirection],relativeDirection,relativeSign,memberSign,zeroLocation,
  body:lathe?'刃物台':gate?'ラム':'主軸頭',mount:lathe?'主軸':current.kind==='horizontal'?'パレット':['travel','gantry'].includes(current.kind)?'固定テーブル':'テーブル',
  artifact:lathe?'精密フランジ':'直角マスタ',shortBody:lathe?'刃物台':gate?'ラム':'頭',lathe};
}
function referenceRigidFrame(frame){
 // Portal frames include affine shear. A rigid bracket follows its up direction;
 // its right direction is orthogonalized separately from the machine guide axes.
 const M=window.ReferenceMeasurement,up=M.unit(frame.up),right=M.unit(M.sub(frame.right,M.scale(up,M.dot(frame.right,up)))),back=[right[1]*up[2]-right[2]*up[1],right[2]*up[0]-right[0]*up[2],right[0]*up[1]-right[1]*up[0]];
 return {right,up,back,rotate:v=>right.map((q,i)=>q*v[0]+up[i]*v[1]+back[i]*v[2])};
}
function referenceScan(pair,state=positions,solution=levelSolution,profile=machineProfile){
 const M=window.ReferenceMeasurement,setup=referenceSetup(pair),axis=axisConfig(current).find(a=>a.key===setup.scan),physical=levelCoordinates(axis.vector[0]*axis.amp,axis.vector[2]*axis.amp),half=Math.hypot(physical.x,axis.vector[1]*axis.amp,physical.z),length=.3;
 if(current.kind==='five'&&(Math.abs(state.A)>1e-9||Math.abs(state.C)>1e-9))return {valid:false,reason:'A/Cを0にして測定',setup};
 if(2*half<length)return {valid:false,reason:'300 mmの走査範囲不足',setup};
 // Keep the same 300 mm interval as v1, then select its requested zero end.
 const lowerPosition=Math.max(-half,Math.min(half-length,state[setup.scan]*half/100)),upperPosition=lowerPosition+length;
 const startPosition=setup.memberSign>0?lowerPosition:upperPosition,endPosition=setup.memberSign>0?upperPosition:lowerPosition,travelLength=endPosition-startPosition;
 const startState={...state,[setup.scan]:startPosition/half*100},cache=new Map();
 const stateAt=t=>({...startState,[setup.scan]:(startPosition+travelLength*t)/half*100});
 const at=t=>{if(!cache.has(t))cache.set(t,geometryModel(stateAt(t),solution,profile,.3));return cache.get(t);};
 // Only these scans relocate a sampled support anchor in geometryModel.
 const varies=(current.kind==='compact'&&setup.scan==='Y')||(current.kind==='horizontal'&&setup.scan==='Z')||(current.kind==='five'&&setup.scan==='Y');
 const first=at(0),normal=first.directions.find(a=>a.key===setup.base).direction,probe=M.scale(normal,-1),scanDirection=first.directions.find(a=>a.key===setup.scan).direction;
 const tangent=M.unit(M.sub(scanDirection,M.scale(normal,M.dot(normal,scanDirection))));
 const frames=g=>({body:referenceRigidFrame(setup.lathe?g.workFrame:g.toolFrame),master:referenceRigidFrame(setup.lathe?g.toolFrame:g.workFrame)}),f0=frames(first);
 // Moving masters follow a specified material point. Do not integrate a guide
 // tangent and silently drop the fixture height's rotational displacement.
 const breaks=current.kind==='horizontal'&&setup.scan==='Z'?supports.map(p=>(levelCoordinates(p.x,p.z).z-levelCoordinates(0,-.85).z-startPosition)/travelLength):[];
 const anchor=current.kind==='compact'&&setup.scan==='Y'?s=>compactTablePathPoint(s,solution,profile):current.kind==='horizontal'&&setup.scan==='Z'?s=>horizontalPalletPoint([0,1.27,-.85],s,solution,profile):null,origin=anchor?anchor(startState):null;
 const start={point:[0,0,0],normal,body:M.scale(normal,.01),probe};
 const sample=t=>{
  const f=frames(varies?at(t):first),travel=anchor?M.sub(anchor(stateAt(t)),origin):M.scale(scanDirection,travelLength*t);
  const point=setup.owner==='master'?travel:[0,0,0],bodyAnchor=setup.owner==='body'?travel:[0,0,0];
  const pose={point,normal:M.transport(normal,f0.master,f.master),body:M.add(bodyAnchor,M.transport(start.body,f0.body,f.body)),probe:M.transport(probe,f0.body,f.body)};
  const along=M.transport(tangent,f0.master,f.master),contact=M.contact(pose);
  if(contact.valid){
   const cross=[pose.normal[1]*along[2]-pose.normal[2]*along[1],pose.normal[2]*along[0]-pose.normal[0]*along[2],pose.normal[0]*along[1]-pose.normal[1]*along[0]],relative=M.sub(contact.point,pose.point),distance=M.dot(relative,along)*setup.relativeSign;
   if(distance<-.01||distance>.31||Math.abs(M.dot(relative,cross))>.025)return {valid:false,reason:'基準面の範囲外',t};
  }
  return {...contact,t,pose,along};
 };
 // Check interior contacts too, including both sides of support-gradient jumps.
 // This is finite sampling, not a claim of continuous-path collision checking.
 const times=[...new Set([0,1,...(varies?Array.from({length:15},(_,i)=>(i+1)/16):[]),...breaks.filter(t=>t>0&&t<1).flatMap(t=>[Math.max(0,t-1e-8),t,Math.min(1,t+1e-8)])])].sort((a,b)=>a-b),samples=times.map(sample),end=samples[samples.length-1].pose;
 const bad=samples.find(p=>!p.valid),result=bad?{valid:false,reason:bad.reason,failurePosition:startPosition+travelLength*bad.t}:M.compare(start,end);
 return {...result,setup,startPosition,endPosition,length,model:M.model,start,end,samples,alongStart:tangent,alongEnd:samples[samples.length-1].along,fixture:anchor?(current.kind==='horizontal'?'horizontal-pallet-top':'compact-table-P'):'representative-fixed-posture'};
}
// A display response, not a replacement for the finite contact calculation.
// Keep raw poses/contacts and the displayed teaching value separate.
const compactYZResponseGain=50;
let referenceBaselineKey='',referenceBaselineValue=null;
function referenceReading(pair,measurement,state=positions,profile=machineProfile){
 const teaching=current.kind==='compact'&&pair.key==='YZ',gain=teaching?compactYZResponseGain:1;
 const reading={valid:measurement.valid,reason:measurement.reason,microns:measurement.microns,physicalMicrons:measurement.microns,gain,model:teaching?'compact-yz-response-v1':window.ReferenceMeasurement.model};
 if(!teaching||!measurement.valid)return reading;
 // Current and initial-support comparisons share this zero-support baseline.
 // Supports are intentionally absent from the key; axis/config/profile changes
 // must still recompute alignment and contact zero at the same 300 mm interval.
 const key=JSON.stringify([current.id,current.kind,current.w,current.d,supports,levelConfig,state,profile]);
 if(key!==referenceBaselineKey){
  referenceBaselineKey=key;
  referenceBaselineValue=referenceScan(pair,state,machineSolution(supports.map(()=>0)),profile);
 }
 const baseline=referenceBaselineValue;
 if(!baseline.valid)return {...reading,valid:false,reason:'教材基準：'+baseline.reason,microns:undefined};
 return {...reading,baselineMicrons:baseline.microns,microns:baseline.microns+gain*(measurement.microns-baseline.microns)};
}
function referenceDiagram(measurement){
 const s=measurement.setup,M=window.ReferenceMeasurement,down=s.relativeSign<0,y0=down?14:31;
 const emphasized=current.kind!=='compact'||$('exaggerate').checked,normalGain=emphasized?1e6/6:17/.3,tiltGain=emphasized?1000:1;
 let bx=34,cy=down?31:14,tilt=0,bodyNormal=.01,probeNormal=-1,probeAlong=0,limited=false;
 const clip=(v,limit)=>{if(Math.abs(v)>limit)limited=true;return Math.max(-limit,Math.min(limit,v));};
 if(measurement.valid){
  const end=measurement.end,relative=M.sub(end.body,end.point),contact=M.sub(measurement.last.point,end.point),along=measurement.alongEnd;
  bodyNormal=M.dot(relative,end.normal);probeNormal=M.dot(end.probe,end.normal);probeAlong=M.dot(end.probe,along);
  // Draw the body displacement and probe attitude independently. A change in
  // extension alone does not imply lateral body motion (e.g. cosine error).
  bx+=clip((bodyNormal-.01)*normalGain,4);
  cy=y0-17*M.dot(contact,along)/.3;
  cy=Math.max(12,Math.min(33,cy));
  tilt=clip(-11*probeAlong/probeNormal*tiltGain,1);
 }
 const by=cy+tilt,angle=Math.atan2(tilt,bx-23)*180/Math.PI;
 const arrow=(x,y,ex,ey,css)=>{const dx=ex-x,dy=ey-y,l=Math.hypot(dx,dy),u=dx/l,v=dy/l;return `<path d="M${x},${y}L${ex},${ey}m${-2*u-1.5*v},${-2*v+1.5*u}l${2*u+1.5*v},${2*v-1.5*u}l${-2*u+1.5*v},${-2*v-1.5*u}" class="${css}"/>`;};
 const master=s.lathe?'<path d="M3,18H17V11H23V34H17V27H3Z" class="scan-master"/>':'<path d="M3,11H23V34H3Z" class="scan-master"/><path d="M3,34H23" class="scan-reference-face"/><text x="6" y="32" class="scan-label scan-r-label">R</text>';
 return `<g class="scan-geometry" data-projection-mode="master-frame" data-deviation-emphasized="${emphasized}" data-normal-gain="${normalGain}" data-tilt-gain="${tiltGain}" data-body-normal-m="${bodyNormal}" data-probe-normal="${probeNormal}" data-probe-along="${probeAlong}" data-diagram-limited="${limited}"><text x="2" y="9" class="scan-label">${s.lathe?'XZ':s.base+s.scan}</text><text x="15" y="8" class="scan-view-direction">↑${s.positiveScanDirection}</text><text x="34" y="9" class="scan-label">${s.lathe?'刃物台':s.shortBody+'固定'}</text>${master}<path d="M23,11V34" class="scan-face"/><text x="16" y="24" class="scan-label scan-s-label">S</text><circle cx="23" cy="${y0}" r="1.6" class="scan-zero"/><text x="25" y="${y0+3}" class="scan-label measurement-start">0</text><g opacity="${measurement.valid?1:.3}"><path d="M34,${y0}L${bx},${by}" class="scan-path"/><circle cx="23" cy="${cy}" r="1.6" class="scan-contact"/><path d="M23,${cy}L${bx},${by}" class="scan-probe"/><rect x="${bx}" y="${by-3}" width="11" height="6" rx="1" transform="rotate(${angle} ${bx} ${by})" class="scan-body"/></g>${arrow(61,y0,61,down?31:14,'scan-move')}<text x="51" y="26" text-anchor="middle" class="scan-label">${s.relativeDirection}</text>${arrow(29,40,40,40,'scan-press')}<text x="2" y="42" class="scan-label">押込＋</text><text x="44" y="42" class="scan-label">${s.normalDirection}</text></g>`;
}

function referenceCard(pair,m,before,display=referenceReading(pair,m),beforeDisplay=referenceReading(pair,before)){
 const s=m.setup,alignment=current.kind==='compact'?'測定Pの'+s.base+'局所送り接線':s.base+'の代表案内方向',reading=display.valid?squarenessMicronText(display.microns)+' µm':display.reason,teaching=display.gain!==1,span=m.startPosition===undefined?'':`${signed(m.startPosition*1000,1)} → ${signed(m.endPosition*1000,1)} mm（${s.scan}部材位置・中央0）`;
 return `<section class="measurement-reference-card" data-reference-pair="${pair.key}"><h3>${s.lathe?'主軸基準XZ':pair.key} <span>${reading}</span></h3><svg class="reference-diagram" viewBox="0 0 64 45" role="img" aria-label="${s.artifact}と${s.body}の測定配置">${referenceDiagram(m)}</svg><p>${s.artifact}：${s.mount}上／計器：${s.body}に固定。${s.normalDirection}側からS面に接触。</p><p>① ${s.lathe?'回転中心線Zに直角な校正済みフランジ面を使用。往復台Z送りとは別。':'R面を開始位置の'+alignment+'に平行に方向合わせ。RとSの直角が保証されたマスタを使用。平定盤の側面を代用しない。'}<br>② ${s.zeroLocation}の●0でゼロ合わせ。<br>③ ${s.member}を部材${s.memberSign>0?'＋':'−'}${s.scan}・${s.scanDirection}へ300 mm（NC指令の符号ではありません）。基準器に対する計器は${s.relativeDirection}へ。測定子が本体へ${s.normalDirection}に引っ込むと＋、伸びると−。固定したS面へ本体が近づく向きとは区別します。</p><p>図の右＝${s.normalDirection}、図の上＝${s.positiveScanDirection}。S面に沿う展開図で、模型のカメラとは独立です。Rは方向合わせ面、Sは読みを比較する面（旋盤はSのみ）。${current.kind==='compact'?'「直角図のずれを強調」で本体の法線変位と測定子の傾きの強調を切り替えます。小型の模型姿勢と接触計算は実寸です。器具の寸法は強調を外しても模式図です。':'本体の法線変位と測定子の傾きを別々に誇張します。'}図の変位・傾きは枠内に制限します。${teaching?'図は元の接触配置を示し、数値の支持変化50倍とは別です。':'数値には誇張を掛けません。'}破線は本体の始終位置を結ぶ目安で、連続軌跡ではありません。</p><p>${span}。スライダーの現在位置と接触ゼロ位置は同じとは限りません。${m.valid?'':' '+m.reason}</p><p>${s.lathe?'現模型は手前側刃物台です。部材−Xは手前・径外向き。ゼロの絶対半径・実寸フランジは再現しません。':current.kind==='horizontal'?'Z走査のマスタ原点はパレット上面中心（支持基準から0.61 m）。模型と同じ点の移動・姿勢を使います。':current.kind==='compact'?'Y走査は模型の測定Pの移動を使います。':'この走査区間では取付部の姿勢が一定の代表点を使います。代表案内方向を、任意の取付高さの材料点接線や主軸回転中心線と同一視しません。実物の固定具寸法は再現しません。'}</p>${teaching?'<p>YZの数値は支持変化×50の教材値です。同じ個体・軸位置・寸法で全支持を同じ高さにした元の有限測定値を I0、現在の元の有限測定値を I とし、I0＋50×(I−I0) を表示します。固有誤差を含む I0 は増幅しません。元の有限測定値：'+(m.valid?squarenessMicronText(m.microns)+' µm':m.reason)+'。実測値や実機の調整感度ではありません。コラムの前後倒れは床に対する姿勢で、Y送りとZ送りが同じだけ傾く調整ではYZは変わりません。局所角度・調整評価・参考最良は元の計算値です。</p>':''}<p>初期支持状態：${beforeDisplay.valid?squarenessMicronText(beforeDisplay.microns)+' µm':beforeDisplay.reason}／現在：${reading}（同じ区間で各々ゼロ${teaching?'・ともに支持変化×50の教材値':''}）。</p><p>従来の局所角度差：${squarenessMicronText(pair.deviationMicroradians*.3)} µm／300 mm換算。上の表示値とは別です。</p></section>`;
}

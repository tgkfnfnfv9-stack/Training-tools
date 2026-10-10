'use strict';
let referenceMeasurementCopyDefaults;
function updateReferenceMeasurementCopy(){
 const intros=[...$('measurementReference').querySelectorAll(':scope > .reference-intro')],note=$('squarenessValuesNote');
 if(!referenceMeasurementCopyDefaults)referenceMeasurementCopyDefaults={intros:intros.map(el=>el.textContent),note:note.textContent};
 const horizontal=current.kind==='horizontal',texts=horizontal?[
  'パレット上の直角マスタに主軸頭固定の計器を当てます。XYは頭をY＋（上）へ、XZ/YZはパレットとマスタをZ＋（奥・主軸側）へ300 mm動かします。後者の計器の相対移動はマスタから見て手前です。●0でゼロ、＋は押込み増加、−は減少。黒は基準面、オレンジは計器の相対移動です。',
  '320×320 mm・厚み50 mmの教材用直角マスタです。支持・軸位置の変更ごとに、R用の頭固定計器をXY/XZはX、YZはYへ300 mm送り、両端等指示に方向合わせします。S用の腕へ付け替えて始点ゼロを取り、走査途中は再ゼロしません。初期伸び10 mm、計算範囲0〜20 mm。有限面の接触を16分割と支持境界の両側で確認します。全治具の干渉や弾性は再現しません。保存した機械状態から毎回再計算します。Z平行度a/bは主軸固定バーとパレット側計器の別配置です。'
 ]:referenceMeasurementCopyDefaults.intros;
 intros.forEach((el,i)=>{if(el.textContent!==texts[i])el.textContent=texts[i];});
 const noteText=horizontal?'1 µm＝0.001 mm。パレット上の直角マスタと主軸頭固定の計器による300 mmの指示差です。XYは頭をY＋へ、XZ/YZはパレットをZ＋へ動かします。支持・軸位置の変更ごとにR方向合わせとSの始点ゼロを取り直し、走査途中は再ゼロしません。＋は押込み増加、−は減少。1 µm刻みで四捨五入。Z平行度a/bは主軸固定バーとパレット側計器の別配置です。':referenceMeasurementCopyDefaults.note;
 if(note.textContent!==noteText)note.textContent=noteText;
}
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
// Finite horizontal square fixture. R is actually swept by a head-fixed arm;
// S is read with a separate arm after R alignment. Dimensions are metres.
// The square is 320 x 320 x 50 mm. Its mounting feet leave its R datum
// 50 mm above the pallet for XY/YZ; XZ's thickness centre is 50 mm high.
function horizontalReferenceScan(pair,state,solution,profile){
 const M=window.ReferenceMeasurement,setup=referenceSetup(pair),length=.3,axes=axisConfig(current),axis=key=>axes.find(a=>a.key===key);
 const half=key=>{const a=axis(key),p=levelCoordinates(a.vector[0]*a.amp,a.vector[2]*a.amp);return Math.hypot(p.x,a.vector[1]*a.amp,p.z);};
 const scanHalf=half(setup.scan),baseHalf=half(setup.base),invalid=reason=>({valid:false,reason,setup,model:'horizontal-finite-square-v1'});
 if(2*scanHalf<length-1e-12||2*baseHalf<length-1e-12)return invalid('300 mmの走査範囲不足');
 const startPosition=Math.max(-scanHalf,Math.min(scanHalf-length,state[setup.scan]*scanHalf/100)),endPosition=startPosition+length;
 const startState={...state,[setup.scan]:startPosition/scanHalf*100},stateAt=t=>({...startState,[setup.scan]:(startPosition+length*t)/scanHalf*100});
 const tool=s=>{const t=horizontalSpindleFixture(s,solution,profile);return {...t,frame:{right:t.right,up:t.up,back:t.axis,rotate:v=>t.right.map((q,i)=>q*v[0]+t.up[i]*v[1]+t.axis[i]*v[2])}};};
 const pallet=s=>({point:horizontalPalletPoint([0,1.27,-.85],s,solution,profile),frame:referenceRigidFrame(geometryModel(s,solution,profile).workFrame)}),p0=pallet(startState);
 const offset=pair.key==='XY'?[-.15,.05,0]:pair.key==='XZ'?[-.15,.05,.16]:[0,.05,.16],q0=M.add(p0.point,p0.frame.rotate(offset));
 const baseStart=Math.max(-baseHalf,Math.min(baseHalf-length,state[setup.base]*baseHalf/100)),baseEnd=baseStart+length;
 const baseAt=t=>({...startState,[setup.base]:(baseStart+length*t)/baseHalf*100}),rTool0=tool(baseAt(0)),rBracket=M.sub(q0,rTool0.nose);
 const contactMaterial=t=>{const a=tool(baseAt(t));return M.add(a.nose,M.transport(rBracket,rTool0.frame,a.frame));};
 const q1=contactMaterial(1),normal=M.unit(M.sub(q1,q0)),nominalAlong=pair.key==='XY'?p0.frame.up:M.scale(p0.frame.back,-1);
 const rNormal=M.unit(M.sub(nominalAlong,M.scale(normal,M.dot(nominalAlong,normal)))),cross=[normal[1]*rNormal[2]-normal[2]*rNormal[1],normal[2]*rNormal[0]-normal[0]*rNormal[2],normal[0]*rNormal[1]-normal[1]*rNormal[0]];
 const timesFor=(key,start,span)=>{
  const fractions=new Set(Array.from({length:17},(_,i)=>i/16));
  // Include both sides of support slope jumps in the two moving seats.
  if(key==='X'||key==='Z')for(const p of supports){
   const q=levelCoordinates(p.x,p.z),origin=key==='X'?levelCoordinates(columnLayoutOffset(current).x,0).x:levelCoordinates(0,-.85).z;
   const t=((key==='X'?q.x:q.z)-origin-start)/span;if(t>0&&t<1)for(const d of [-1e-8,0,1e-8])fractions.add(Math.max(0,Math.min(1,t+d)));
  }
  return [...fractions].sort((a,b)=>a-b);
 };
 const rBody0=M.sub(q0,M.scale(rNormal,.01)),rProbe0=rNormal;
 const alignmentSamples=timesFor(setup.base,baseStart,length).map(t=>{
  const a=tool(baseAt(t)),pose={point:q0,normal:rNormal,body:M.add(a.nose,M.transport(M.sub(rBody0,rTool0.nose),rTool0.frame,a.frame)),probe:M.transport(rProbe0,rTool0.frame,a.frame)},hit=M.contact(pose);
  if(hit.valid){const d=M.sub(hit.point,q0),along=M.dot(d,normal),across=M.dot(d,cross);if(along<-.010000001||along>.310000001||Math.abs(across)>.025000001)return {...hit,valid:false,reason:'R面の範囲外',t,pose};}
  return {...hit,t,pose};
 });
 const rBad=alignmentSamples.find(s=>!s.valid);if(rBad)return {...invalid(rBad.reason),alignmentSamples};
 const alignment=M.compare(alignmentSamples[0].pose,alignmentSamples.at(-1).pose);
 const point=M.add(M.add(q0,M.scale(normal,.31)),M.scale(rNormal,.01)),t0=tool(startState),body=M.add(point,M.scale(normal,.01)),probe=M.scale(normal,-1);
 const start={point,normal,body,probe},alongStart=M.scale(rNormal,setup.relativeSign);
 const samples=timesFor(setup.scan,startPosition,length).map(t=>{
  const s=stateAt(t),p=pallet(s),a=tool(s),pose={point:M.add(p.point,M.transport(M.sub(point,p0.point),p0.frame,p.frame)),normal:M.transport(normal,p0.frame,p.frame),body:M.add(a.nose,M.transport(M.sub(body,t0.nose),t0.frame,a.frame)),probe:M.transport(probe,t0.frame,a.frame)};
  const along=M.transport(alongStart,p0.frame,p.frame),hit=M.contact(pose);
  if(hit.valid){const d=M.sub(hit.point,pose.point),distance=M.dot(d,along)*setup.relativeSign,across=M.dot(d,M.transport(cross,p0.frame,p.frame));if(distance<-.010000001||distance>.310000001||Math.abs(across)>.025000001)return {...hit,valid:false,reason:'S面の範囲外',t,pose,along};}
  return {...hit,t,pose,along};
 });
 const bad=samples.find(s=>!s.valid),end=samples.at(-1).pose,result=bad?{valid:false,reason:bad.reason,failurePosition:startPosition+length*bad.t}:M.compare(start,end);
 return {...result,setup,startPosition,endPosition,length,model:'horizontal-finite-square-v1',start,end,samples,alongStart,alongEnd:samples.at(-1).along,fixture:'horizontal-finite-square',alignment:{...alignment,startPosition:baseStart,endPosition:baseEnd,samples:alignmentSamples},master:{corner:q0,Rnormal:rNormal,Snormal:normal,width:.32,height:.32,thickness:.05,contactOffset:.01,palletOrigin:p0.point},autoZero:true};
}
function referenceScan(pair,state=positions,solution=levelSolution,profile=machineProfile,geometryProvider=geometryModel){
 if(current.kind==='horizontal')return horizontalReferenceScan(pair,state,solution,profile);
 const M=window.ReferenceMeasurement,setup=referenceSetup(pair),axis=axisConfig(current).find(a=>a.key===setup.scan),physical=levelCoordinates(axis.vector[0]*axis.amp,axis.vector[2]*axis.amp),half=Math.hypot(physical.x,axis.vector[1]*axis.amp,physical.z),length=.3;
 if(current.kind==='five'&&(Math.abs(state.A)>1e-9||Math.abs(state.C)>1e-9))return {valid:false,reason:'A/Cを0にして測定',setup};
 if(2*half<length)return {valid:false,reason:'300 mmの走査範囲不足',setup};
 // Keep the same 300 mm interval as v1, then select its requested zero end.
 const lowerPosition=Math.max(-half,Math.min(half-length,state[setup.scan]*half/100)),upperPosition=lowerPosition+length;
 const startPosition=setup.memberSign>0?lowerPosition:upperPosition,endPosition=setup.memberSign>0?upperPosition:lowerPosition,travelLength=endPosition-startPosition;
 const startState={...state,[setup.scan]:startPosition/half*100},cache=new Map();
 const stateAt=t=>({...startState,[setup.scan]:(startPosition+travelLength*t)/half*100});
 const at=t=>{if(!cache.has(t))cache.set(t,geometryProvider(stateAt(t),solution,profile,.3));return cache.get(t);};
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
// Both finite scanning and spindle sweep use the same fixed teaching posture.
// No multiplier is applied to the resulting indicator displacement.
function referenceDisplayScan(pair,state=positions,solution=levelSolution,profile=machineProfile){
 const teaching=current.kind==='compact';
 const result=referenceScan(pair,state,solution,profile,teaching?compactMeasurementGeometry:geometryModel);
 return {...result,model:teaching?'compact-shared-posture-v1':result.model,responseGain:teaching?compactMeasurementResponseGain:1};
}
function referenceDiagram(measurement){
 const s=measurement.setup,M=window.ReferenceMeasurement,down=s.relativeSign<0,y0=down?14:31,horizontal=current.kind==='horizontal';
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
 const master=s.lathe?'<path d="M3,18H17V11H23V34H17V27H3Z" class="scan-master"/>':'<path d="M3,11H23V34H3Z" class="scan-master"/><path d="M3,'+(horizontal&&down?11:34)+'H23" class="scan-reference-face"/><text x="6" y="'+(horizontal&&down?16:32)+'" class="scan-label scan-r-label">R</text>';
 return `<g class="scan-geometry" data-projection-mode="master-frame" data-deviation-emphasized="${emphasized}" data-normal-gain="${normalGain}" data-tilt-gain="${tiltGain}" data-body-normal-m="${bodyNormal}" data-probe-normal="${probeNormal}" data-probe-along="${probeAlong}" data-diagram-limited="${limited}"><text x="2" y="9" class="scan-label">${s.lathe?'XZ':s.base+s.scan}</text><text x="15" y="8" class="scan-view-direction">↑${s.positiveScanDirection}</text><text x="34" y="9" class="scan-label">${s.lathe?'刃物台':horizontal?'計器:頭':s.shortBody+'固定'}</text>${master}<path d="M23,11V34" class="scan-face"/><text x="16" y="24" class="scan-label scan-s-label">S</text><circle cx="23" cy="${y0}" r="1.6" class="scan-zero"/><text x="25" y="${y0+3}" class="scan-label measurement-start">0</text><g opacity="${measurement.valid?1:.3}"><path d="M34,${y0}L${bx},${by}" class="scan-path"/><circle cx="23" cy="${cy}" r="1.6" class="scan-contact"/><path d="M23,${cy}L${bx},${by}" class="scan-probe"/><rect x="${bx}" y="${by-3}" width="11" height="6" rx="1" transform="rotate(${angle} ${bx} ${by})" class="scan-body"/></g>${arrow(61,y0,61,down?31:14,'scan-move')}${horizontal?'<text x="55" y="18" text-anchor="middle" class="scan-view-direction">相対</text>':''}<text x="51" y="26" text-anchor="middle" class="scan-label">${s.relativeDirection}</text>${arrow(29,40,40,40,'scan-press')}<text x="2" y="42" class="scan-label">押込＋</text><text x="44" y="42" class="scan-label">${s.normalDirection}</text></g>`;
}

function referenceCard(pair,m,before,physical=m){
 const display=m,beforeDisplay=before,horizontal=current.kind==='horizontal';
 const s=m.setup,alignment=horizontal?'頭固定のR用計器を'+s.base+'へ300 mm送った始終点':current.kind==='compact'?'測定Pの'+s.base+'局所送り接線':s.base+'の代表案内方向',reading=display.valid?squarenessMicronText(display.microns)+' µm':display.reason,teaching=current.kind==='compact',span=m.startPosition===undefined?'':`${signed(m.startPosition*1000,1)} → ${signed(m.endPosition*1000,1)} mm（${s.scan}部材位置・中央0）`;
 const horizontalNote=horizontal?`<p>小図の「計器:頭」は計器を主軸頭へ取り付ける意味です。${s.scan==='Y'?'XYでは主軸頭そのものを上へ動かし、パレットとマスタは静止します。':'XZ/YZでは主軸頭は静止し、パレットとマスタを奥（主軸側）へ動かします。'}オレンジの「相対」矢印はマスタから見た計器の動きです。表示の＋X/＋Y/＋Zとスライダーは部材の移動方向で、NC指令の正負を表しません。</p><p>320×320 mm・厚み50 mmの教材用直角マスタを、XYは立て、XZは寝かせ、YZは立ててパレットに載せます。頭に固定したR用計器を${s.base}へ300 mm送り、始終点が等指示になる向きへ合わせます。途中の接触も確認しますが、途中の指示まで0とは限りません。次にS用の腕へ付け替えて始点をゼロにし、本体と測定子を同じ頭の剛体姿勢で運びます。代表案内や鼻端の接線への置換ではありません。</p>`:'';
 return `<section class="measurement-reference-card" data-reference-pair="${pair.key}"><h3>${s.lathe?'主軸基準XZ':pair.key} <span>${reading}</span></h3><svg class="reference-diagram" viewBox="0 0 64 45" role="img" aria-label="${s.artifact}と${s.body}の測定配置">${referenceDiagram(m)}</svg><p>${s.artifact}：${s.mount}上／計器：${s.body}に固定。${s.normalDirection}側からS面に接触。</p>${horizontalNote}<p>① ${s.lathe?'回転中心線Zに直角な校正済みフランジ面を使用。往復台Z送りとは別。':(horizontal?'R用の頭固定腕を'+s.base+'へ300 mm送り、両端で等指示に方向合わせ。':'R面を開始位置の'+alignment+'に平行に方向合わせ。')+'RとSの直角が保証されたマスタを使用。平定盤の側面を代用しない。'}<br>② ${s.zeroLocation}の●0でゼロ合わせ。<br>③ ${s.member}を部材${s.memberSign>0?'＋':'−'}${s.scan}・${s.scanDirection}へ300 mm（NC指令の符号ではありません）。基準器に対する計器は${s.relativeDirection}へ。測定子が本体へ${s.normalDirection}に引っ込むと＋、伸びると−。固定したS面へ本体が近づく向きとは区別します。</p><p>図の右＝${s.normalDirection}、図の上＝${s.positiveScanDirection}。S面に沿う展開図で、模型のカメラとは独立です。Rは方向合わせ面、Sは読みを比較する面（旋盤はSのみ）。${current.kind==='compact'?'「直角図のずれを強調」で本体の法線変位と測定子の傾きの強調を切り替えます。小型の接触計算は、直角測定と触れに共通の仮想主軸姿勢を使います。模型と局所角度は元の姿勢です。器具の寸法は強調を外しても模式図です。':'本体の法線変位と測定子の傾きを別々に誇張します。'}図の変位・傾きは枠内に制限します。${teaching?'図と数値は同じ仮想測定姿勢から求めます。数値に後から倍率を掛けません。':'数値には誇張を掛けません。'}破線は本体の始終位置を結ぶ目安で、連続軌跡ではありません。</p><p>${span}。スライダーの現在位置と接触ゼロ位置は同じとは限りません。${m.valid?'':' '+m.reason}</p><p>${s.lathe?'現模型は手前側刃物台です。部材−Xは手前・径外向き。ゼロの絶対半径・実寸フランジは再現しません。':horizontal?('R面の300 mm区間は両端10 mmの余白を取り、S面も端から10 mm→310 mmを走査します。厚み方向の接触は中央±25 mmの範囲です。理想時のS接触高さはパレット上面から'+(pair.key==='XY'?'60→360 mm':pair.key==='XZ'?'50 mm':'360 mm')+'。器具下面の支持脚によるすき間はXY 50／XZ 25／YZ 40 mmで、厚み50 mmとは別です。支持・軸位置変更でR合わせとSの付替え・始点ゼロを取り直します。軸端ではRとSの300 mm区間をそれぞれ確保し、各始点の頭姿勢へ腕を取り付けます。S走査中は再方向合わせ・再ゼロしません。器具と腕の位置は有限寸法の教材仮定で、全治具干渉・弾性は再現しません。Z平行度は主軸固定バーとパレット側計器の別配置です。'):current.kind==='compact'?'Y走査は模型の測定Pの移動を使います。':'この走査区間では取付部の姿勢が一定の代表点を使います。代表案内方向を、任意の取付高さの材料点接線や主軸回転中心線と同一視しません。実物の固定具寸法は再現しません。'}</p>${teaching?'<p>小型は前後の支持応答を中央位置で約5倍とする共通の仮想主軸姿勢です。支持のみの中央YZ角差δに対して、主軸とZ送りを基準X軸まわりに追加で4δ回し、300 mmの走査と直径300 mmの触れをそれぞれ接触から計算します。固有誤差は増幅しません。補正姿勢は支持・寸法ごとに固定し、テーブル送りで変えません。全位置の数値が厳密に5倍になる仕様ではありません。中央以外ではXZにも微小な交差影響があります。元の有限測定値：'+(physical.valid?squarenessMicronText(physical.microns)+' µm':physical.reason)+'。実機感度の再現ではありません。共通の剛体傾斜では補正せず、模型・局所角度・調整評価・参考最良は元の計算です。</p>':''}<p>初期支持状態：${beforeDisplay.valid?squarenessMicronText(beforeDisplay.microns)+' µm':beforeDisplay.reason}／現在：${reading}（同じ区間で各々ゼロ${teaching?'・ともに共通の仮想主軸姿勢':''}）。</p><p>従来の局所角度差：${squarenessMicronText(pair.deviationMicroradians*.3)} µm／300 mm換算。上の表示値とは別です。</p></section>`;
}

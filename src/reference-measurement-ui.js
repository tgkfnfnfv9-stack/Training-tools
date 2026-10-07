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
 const startState={...state,[setup.scan]:startPosition/half*100},endState={...state,[setup.scan]:endPosition/half*100},cache=new Map();
 const at=t=>{if(!cache.has(t))cache.set(t,geometryModel({...startState,[setup.scan]:(startPosition+travelLength*t)/half*100},solution,profile,.3));return cache.get(t);};
 // Only these scans relocate a sampled support anchor in geometryModel.
 const varies=(current.kind==='compact'&&setup.scan==='Y')||(current.kind==='horizontal'&&setup.scan==='Z')||(current.kind==='five'&&setup.scan==='Y');
 const first=at(0),last=varies?at(1):first,normal=first.directions.find(a=>a.key===setup.base).direction,probe=M.scale(normal,-1),scanDirection=first.directions.find(a=>a.key===setup.scan).direction;
 const tangent=M.unit(M.sub(scanDirection,M.scale(normal,M.dot(normal,scanDirection))));
 const frames=g=>({body:referenceRigidFrame(setup.lathe?g.workFrame:g.toolFrame),master:referenceRigidFrame(setup.lathe?g.toolFrame:g.workFrame)}),f0=frames(first),f1=frames(last);
 // Each direction is the velocity of the specified contact anchor. In compact
 // Y it already includes the height of P, so use the exact P trajectory once.
 const breaks=current.kind==='horizontal'&&setup.scan==='Z'?supports.map(p=>(levelCoordinates(p.x,p.z).z-levelCoordinates(0,-.85).z-startPosition)/travelLength):[];
 const travel=current.kind==='compact'&&setup.scan==='Y'?{valid:true,value:M.sub(compactTablePathPoint(endState,solution,profile),compactTablePathPoint(startState,solution,profile))}:!varies?{valid:true,value:M.scale(scanDirection,travelLength)}:M.integrate(t=>at(t).directions.find(a=>a.key===setup.scan).direction,travelLength,breaks);
 if(!travel.valid)return {...travel,setup,startPosition,endPosition};
 const start={point:[0,0,0],normal,body:M.scale(normal,.01),probe};
 const point=setup.owner==='master'?travel.value:[0,0,0],bodyAnchor=setup.owner==='body'?travel.value:[0,0,0];
 const end={point,normal:M.transport(normal,f0.master,f1.master),body:M.add(bodyAnchor,M.transport(start.body,f0.body,f1.body)),probe:M.transport(probe,f0.body,f1.body)};
 let result=M.compare(start,end);
 if(result.valid){
  const along=M.transport(tangent,f0.master,f1.master),cross=[end.normal[1]*along[2]-end.normal[2]*along[1],end.normal[2]*along[0]-end.normal[0]*along[2],end.normal[0]*along[1]-end.normal[1]*along[0]],relative=M.sub(result.last.point,end.point),distance=M.dot(relative,along)*setup.relativeSign;
  if(distance<-.01||distance>.31||Math.abs(M.dot(relative,cross))>.025)result={valid:false,reason:'基準面の範囲外'};
 }
 return {...result,setup,startPosition,endPosition,length,model:M.model,start,end};
}
function referenceDiagram(measurement){
 const s=measurement.setup,down=s.relativeSign<0,y0=down?14:31,y1=down?31:14,reading=measurement.valid?measurement.microns:0;
 // Fixed S face; exaggerated body displacement shows compression, not an axis.
 const shift=Math.max(-4,Math.min(4,reading/6)),bx=34-shift;
 const arrow=(x,y,ex,ey,css)=>{const dx=ex-x,dy=ey-y,l=Math.hypot(dx,dy),u=dx/l,v=dy/l;return `<path d="M${x},${y}L${ex},${ey}m${-2*u-1.5*v},${-2*v+1.5*u}l${2*u+1.5*v},${2*v-1.5*u}l${-2*u+1.5*v},${-2*v-1.5*u}" class="${css}"/>`;};
 return `<text x="2" y="9" class="scan-label">${s.lathe?'XZ':s.base+s.scan}</text><text x="34" y="9" class="scan-label">${s.lathe?'刃物台':s.shortBody+'固定'}</text>${s.lathe?'<path d="M3,18H17V11H23V34H17V27H3Z" class="scan-master"/><path d="M23,11V34" class="scan-face"/>':'<path d="M3,11H23V34H3Z" class="scan-master"/><path d="M3,34H23V11" class="scan-face"/>'}<text x="${s.lathe?17:5}" y="26" class="scan-label">${s.lathe?'S':'直角'}</text><circle cx="23" cy="${y0}" r="1.6" class="scan-zero"/><text x="25" y="${y0+3}" class="scan-label measurement-start">0</text><path d="M34,${y0}L${bx},${y1}" class="scan-path"/>${arrow(61,y0,61,y1,'scan-move')}<text x="51" y="25" text-anchor="middle" class="scan-label">${s.relativeDirection}</text><circle cx="23" cy="${y1}" r="1.6" class="scan-contact"/><path d="M23,${y1}H${bx}" class="scan-probe"/><rect x="${bx}" y="${y1-3}" width="11" height="6" rx="1" class="scan-body"/>${arrow(29,40,40,40,'scan-press')}<text x="2" y="42" class="scan-label">押込＋</text><text x="44" y="42" class="scan-label">${s.normalDirection}</text>`;
}

function referenceCard(pair,m,before){
 const s=m.setup,reading=m.valid?squarenessMicronText(m.microns)+' µm':m.reason,span=m.startPosition===undefined?'':`${signed(m.startPosition*1000,1)} → ${signed(m.endPosition*1000,1)} mm（${s.scan}部材位置・中央0）`;
 return `<section class="measurement-reference-card" data-reference-pair="${pair.key}"><h3>${s.lathe?'主軸基準XZ':pair.key} <span>${reading}</span></h3><svg class="reference-diagram" viewBox="0 0 64 45" role="img" aria-label="${s.artifact}と${s.body}の測定配置">${referenceDiagram(m)}</svg><p>${s.artifact}：${s.mount}上／計器：${s.body}に固定。${s.normalDirection}側からS面に接触。</p><p>① ${s.lathe?'回転中心線Zに直角な校正済みフランジ面を使用。往復台Z送りとは別。':'R面を開始位置の'+s.base+'移動の接線に平行に方向合わせ（局所合わせ）。RとSの直角が保証されたマスタを使用。平定盤の側面を代用しない。'}<br>② ${s.zeroLocation}の●0でゼロ合わせ。<br>③ ${s.member}を${s.memberSign>0?'＋':'−'}${s.scan}・${s.scanDirection}へ300 mm。基準器に対する計器は${s.relativeDirection}へ。押込み${s.normalDirection}が増えると＋、減ると−。</p><p>図の右＝${s.normalDirection}、図の上＝${s.positiveScanDirection}。図は基準面に沿う展開図です。</p><p>${span}${m.valid?'':' '+m.reason}</p><p>初期支持状態：${before.valid?squarenessMicronText(before.microns)+' µm':before.reason}／現在：${reading}（同じ区間で各々ゼロ）。</p><p>従来の局所角度差：${squarenessMicronText(pair.deviationMicroradians*.3)} µm／300 mm換算。上の有限走査値とは別です。</p></section>`;
}

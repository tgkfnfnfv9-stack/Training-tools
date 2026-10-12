'use strict';
// Compact vertical (id=vertical, kind=compact) audit script.
// Product values are read through tests/leveling-dom-env.cjs (read-only).
// The "oracle" below is an independent reconstruction from INPUT data only
// (support coordinates/heights, levelConfig, seed-generated squareness).
// It does not call geometryModel/referenceScan/compactMeasurement*/spindleSweep*/Leveling.geometry.
const fs=require('node:fs'),path=require('node:path');
const OUT=__dirname;
process.chdir('/home/user/Training-tools');
const e=require('/home/user/Training-tools/tests/leveling-dom-env.cjs')();
const MA=require('/home/user/Training-tools/src/machine-accuracy.js');// generate() = input data (seed->profile)

// ---------- vector helpers ----------
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),unit=a=>mul(a,1/Math.hypot(...a));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function basisFrame(a,b){const right=unit([1,a,0]),up=unit([-a,1,-b]),back=cross(right,up);return {right,up,back,rot:v=>add(add(mul(right,v[0]),mul(up,v[1])),mul(back,v[2])),inv:v=>[dot(right,v),dot(up,v),dot(back,v)]};}
function compose(A,B){return {rot:v=>A.rot(B.rot(v)),inv:v=>B.inv(A.inv(v))};}
function rodrigues(axis,angle){const c=Math.cos(angle),s=Math.sin(angle);return v=>add(add(mul(v,c),mul(cross(axis,v),s)),mul(axis,dot(axis,v)*(1-c)));}

// ---------- independent oracle ----------
// Ritz two-mode plate: stated in src/leveling.js comments (D=1+0.5X, nu=0.3,
// modes vanishing at the 4 corners). Integrated here by exact monomial moments.
const poly=(...t)=>t,product=(p,q)=>p.flatMap(([i,j,c])=>q.map(([k,l,d])=>[i+k,j+l,c*d])),integral=p=>p.reduce((s,[i,j,c])=>s+(i%2||j%2?0:4*c/(i+1)/(j+1)),0);
function ritz(a,b,t){
 const modes=[[[],[],poly([0,0,1/a/b])],[poly([0,1,-2/a/a]),[],poly([1,0,-2/a/b])],[poly([0,3,-2/a/a]),poly([0,1,6/b/b],[2,1,-6/b/b]),poly([1,2,-6/a/b])]];
 const D=poly([0,0,1],[1,0,.5]);
 const energy=(u,v)=>{let s=0;for(const [i,j,c] of [[0,0,1],[1,1,1],[0,1,.3],[1,0,.3],[2,2,1.4]])s+=c*integral(product(D,product(u[i],v[j])));return s*a*b;};
 const aa=energy(modes[1],modes[1]),bb=energy(modes[1],modes[2]),cc=energy(modes[2],modes[2]),u=-t*energy(modes[1],modes[0]),v=-t*energy(modes[2],modes[0]),det=aa*cc-bb*bb;
 return [(u*cc-bb*v)/det,(aa*v-bb*u)/det];
}
function oracleModel(inp,opts={}){
 const {heights,width,depth,W,Dm,columnX,columnZ,squareness}=inp,rigid=!!opts.rigid,noProfile=!!opts.noProfile;
 const a=width/2,b=depth/2,[h00,h10,h01,h11]=heights;
 const pa=(h10+h11-h00-h01)/(4*a),pb=(h01+h11-h00-h10)/(4*b),t=(h00+h11-h10-h01)/4,mean=(h00+h10+h01+h11)/4,[q1,q3]=ritz(a,b,t);
 // residual shape (mm) relative to the least-squares plane, and its gradient (mm/m)
 const shape=(x,z)=>{if(rigid)return {h:0,dx:0,dz:0};const X=x/a,Z=z/b;return {h:t*X*Z+(1-X*X)*(q1*Z+q3*Z**3),dx:(t*Z-2*X*(q1*Z+q3*Z**3))/a,dz:(t*X+(1-X*X)*(q1+3*q3*Z*Z))/b};};
 const common=basisFrame(pa/1000,pb/1000),local=(x,z)=>{const s=shape(x,z);return basisFrame(s.dx/1000,s.dz/1000);},frameAt=(x,z)=>compose(common,local(x,z));
 const sq=noProfile?{XY:0,XZ:0,YZ:0}:squareness;
 const xy=sq.XY/300000,xz=sq.XZ/300000,yz=sq.YZ/300000,Yint=[-Math.sin(xy),0,Math.cos(xy)],zx=-Math.sin(xz),zy=(-Math.sin(yz)-zx*Yint[0])/Yint[2],Zint=[zx,Math.sqrt(1-zx*zx-zy*zy),zy];
 const Xint=[1,0,0];
 // body rotation: minimal rotation e_y -> Zint (rigid "column" representative)
 const ey=[0,1,0],cr=cross(ey,Zint),sn=Math.hypot(...cr),cs=dot(ey,Zint),Bint=sn<1e-15?(v=>v):rodrigues(mul(cr,1/sn),Math.atan2(sn,cs));
 const sx=width/(W*.8),sz=depth/(Dm*.8),z0=-Dm*.1*sz;
 const colX=W*.2*columnX/100*sx,colZ=(Dm*.29+Dm*.1*columnZ/100)*sz;
 const lift=p=>add(p,[0,.66+(rigid?mean:mean)/1000,0]);
 // material point on the table: raw offset from the saddle seat anchor (x,0.5 above datum)
 const tablePoint=(xRaw,s,offsetY=.5)=>{const z=z0+s,sh=shape(0,z),offset=add([xRaw,offsetY,0],mul(sub(Yint,[0,0,1]),s));return lift(common.rot(add([0,sh.h/1000,z],local(0,z).rot(offset))));};
 const P=(state)=>tablePoint(.45*state.X/100*sx,.4*state.Y/100*sz);
 const Ytan=(state)=>{const x=.45*state.X/100*sx,s=.4*state.Y/100*sz,h=1e-4;const f=d=>tablePoint(x,s+d);return unit(mul(sub(mul(sub(f(h),f(-h)),8),sub(f(2*h),f(-2*h))),1/(12*h)));};
 const workFrame=state=>frameAt(0,z0+.4*state.Y/100*sz),toolFrame=frameAt(colX,colZ);
 const Xdir=state=>workFrame(state).rot(Xint),Zdir=toolFrame.rot(Zint);
 // head material point whose nominal raw position (relative to datum .66) is cRaw
 const headPoint=cRaw=>{const sh=shape(colX,colZ),rel=sub(cRaw,[colX,0,colZ]);return lift(common.rot(add([colX,sh.h/1000,colZ],local(colX,colZ).rot(Bint(rel)))));};
 const tablePointRaw=(cRaw)=>{ // table material point at nominal raw position, Y=0 stroke assumed in cRaw
  const s=cRaw[2]-z0;return tablePoint(cRaw[0],s,cRaw[1]);};
 return {common,local,frameAt,workFrame,toolFrame,Xint,Yint,Zint,Bint,Xdir,Ytan,Zdir,P,headPoint,sx,sz,z0,colX,colZ,pa,pb,t,q1,q3,mean};
}
// δ: support-only YZ pitch at datum, about the pure-model X direction (independent reconstruction)
function oracleDelta(inp){
 const pure=oracleModel(inp,{noProfile:true}),rig=oracleModel(inp,{noProfile:true,rigid:true}),s0={X:0,Y:0,Z:0};
 const axis=pure.Xdir(s0);
 const pitch=m=>{const proj=v=>sub(v,mul(axis,dot(axis,v)));const z=proj(m.Zdir),y=proj(m.Ytan(s0));return Math.atan2(dot(z,y),dot(axis,cross(z,y)));};
 const d=pitch(pure)-pitch(rig);return {delta:Math.abs(d)<1e-14?0:d,axis};
}
function oracleScans(inp,state,gain){
 const m=oracleModel(inp),{delta,axis}=oracleDelta(inp),R=rodrigues(axis,(gain-1)*delta);
 const Z=gain===1?m.Zdir:R(m.Zdir),out={delta,extraAngle:(gain-1)*delta};
 // XY: Y scan moves the table+square; dial fixed on head. start=upper, end=lower (product traversal).
 const half=.4*m.sz,lower=Math.max(-half,Math.min(half-.3,state.Y*half/100)),upper=lower+.3;
 const st=y=>({...state,Y:y/half*100}),S=st(upper),E=st(lower);
 const n0=m.Xdir(S),P0=m.P(S),P1=m.P(E),W0=m.workFrame(S),W1=m.workFrame(E),n1=W1.rot(W0.inv(n0));
 const body=mul(n0,.01),probe=mul(n0,-1);// relative to P0
 const ext1=dot(n1,sub(sub(P1,P0),body))/dot(n1,probe);
 out.XY={startY_m:upper,endY_m:lower,zeroExtension_m:.01,endExtension_m:ext1,contactEnd:add(body,mul(probe,ext1)),microns:(.01-ext1)*1e6};
 // XZ / YZ: Z scan moves head (dial) down by 0.3 m along Z; square fixed.
 const zl=Math.max(-.3,Math.min(0,state.Z*.3/100));
 for(const [key,n] of [['XZ',m.Xdir(state)],['YZ',m.Ytan(state)]]){
  const bodyEnd=add(mul(n,.01),mul(Z,-.3)),extEnd=dot(n,sub([0,0,0],bodyEnd))/dot(n,mul(n,-1));
  out[key]={startZ_m:zl+.3,endZ_m:zl,zeroExtension_m:.01,endExtension_m:extEnd,microns:(.01-extEnd)*1e6};
 }
 // spindle rotation sweep r=0.15 about spindle axis; table normal from saddle seat frame
 const axisS=gain===1?m.toolFrame.rot(m.Bint([0,1,0])):R(m.toolFrame.rot(m.Bint([0,1,0]))),right=gain===1?m.toolFrame.rot(m.Bint([1,0,0])):R(m.toolFrame.rot(m.Bint([1,0,0])));
 const nT=m.workFrame(state).rot([0,1,0]),first=unit(sub(right,mul(axisS,dot(right,axisS)))),e90=unit(cross(first,axisS)),e0=unit(cross(axisS,e90));
 const lambda=phi=>{const p=mul(add(mul(e0,Math.cos(phi)),mul(e90,Math.sin(phi))),.15);return dot(nT,mul(p,-1))/dot(nT,axisS);};
 out.sweep=[0,90,180,270].map(d=>(lambda(d*Math.PI/180)-lambda(3*Math.PI/2))*1e6);
 // local angles (300 mm conversion), physical posture
 const ang=(u,v)=>-Math.asin(dot(u,v))*.3e6;
 out.local300={XY:ang(m.Xdir(state),m.Ytan(state)),XZ:ang(m.Xdir(state),m.Zdir),YZ:ang(m.Ytan(state),m.Zdir)};
 out.columnLean={front:Math.atan2(-m.Zdir[2],m.Zdir[1])*1e6,right:Math.atan2(m.Zdir[0],m.Zdir[1])*1e6};
 return out;
}
// Condition C (same mount, orientations transported with their members, zero re-taken at start)
function oracleConditionC(inpBefore,inpAfter,state){
 const A=oracleModel(inpBefore),B=oracleModel(inpAfter),out={};
 const tr=(fNew,fOld,v)=>fNew.rot(fOld.inv(v));
 // XZ / YZ
 for(const [key,nOld] of [['XZ',A.Xdir(state)],['YZ',A.Ytan(state)]]){
  const n=tr(B.workFrame(state),A.workFrame(state),nOld),probe=tr(B.toolFrame,A.toolFrame,mul(nOld,-1));
  const body0=mul(probe,-.01),ext0=dot(n,sub([0,0,0],body0))/dot(n,probe),bodyEnd=add(body0,mul(B.Zdir,-.3)),ext1=dot(n,sub([0,0,0],bodyEnd))/dot(n,probe);
  out[key]={reZeroExtension_m:ext0,endExtension_m:ext1,microns:(ext0-ext1)*1e6,normalChange_urad:Math.acos(Math.min(1,dot(n,key==='XZ'?B.Xdir(state):B.Ytan(state))))*1e6};
 }
 // XY
 const half=.4*A.sz,lower=Math.max(-half,Math.min(half-.3,state.Y*half/100)),upper=lower+.3,st=y=>({...state,Y:y/half*100}),S=st(upper),E=st(lower);
 const nOld=A.Xdir(S),nS=tr(B.workFrame(S),A.workFrame(S),nOld),probe=tr(B.toolFrame,A.toolFrame,mul(nOld,-1)),body=mul(probe,-.01);
 const nE=tr(B.workFrame(E),B.workFrame(S),nS),PS=B.P(S),PE=B.P(E);
 const ext0=dot(nS,sub([0,0,0],body))/dot(nS,probe),ext1=dot(nE,sub(sub(PE,PS),body))/dot(nE,probe);
 out.XY={reZeroExtension_m:ext0,endExtension_m:ext1,microns:(ext0-ext1)*1e6};
 return out;
}
// Hypothesis H (NOT defined by the product): contact material point = table-top P (raw)
// at the scan start; dial rigid with the head, square rigid with the table.
function hypothesisAZeroShift(inpBefore,inpAfter,state){
 const A=oracleModel(inpBefore),B=oracleModel(inpAfter),out={};
 const half=.4*A.sz,lower=Math.max(-half,Math.min(half-.3,state.Y*half/100)),upper=lower+.3;
 const cases={XY:{s:{...state,Y:upper/half*100},n:s=>A.Xdir(s)},XZ:{s:state,n:s=>A.Xdir(s)},YZ:{s:state,n:s=>A.Ytan(s)}};
 for(const [key,c] of Object.entries(cases)){
  const s=c.s,cRaw=[.45*s.X/100*A.sx,.5,A.z0+.4*s.Y/100*A.sz];
  const dHead=sub(B.headPoint(cRaw),A.headPoint(cRaw)),dTable=sub(B.P(s),A.P(s)),n=c.n(s);
  // ext = n.(body-point): body follows head, point follows table
  const dExt=dot(n,sub(dHead,dTable));
  out[key]={dHead_um:mul(dHead,1e6),dTable_um:mul(dTable,1e6),startExtensionChange_um:dExt*1e6,startReadingShift_um:-dExt*1e6};
 }
 return out;
}

// ---------- product readout ----------
function setup(seed,condition,heights,state,layout={columnX:0,columnZ:0}){
 const profile=MA.generate(condition,seed,['X','Y','Z'],4);
 e.read(`openMachine(machines[0]);initializeMachineAccuracy(${JSON.stringify(profile)});levelConfig.columnX=${layout.columnX};levelConfig.columnZ=${layout.columnZ};supportHeights=${JSON.stringify(heights||profile.initialHeights)};positions=${JSON.stringify({A:0,C:0,...state})};updateAxisValues();updateLeveling(false);`);
 return profile;
}
function productRead(){
 return e.json(`(()=>{
  const pick=r=>r.valid?{valid:true,microns:r.microns,text:squarenessMicronText(r.microns),zeroExtension_m:r.zero.extension,endExtension_m:r.last.extension,zeroContact:r.zero.point,endContact:r.last.point,startPosition:r.startPosition,endPosition:r.endPosition,model:r.model,fixture:r.fixture,responseGain:r.responseGain}:{valid:false,reason:r.reason};
  const out={supportHeights:[...supportHeights],adjustment:(({gain,angle,supportAngle,axis})=>({gain,angle,supportAngle,axis}))(compactMeasurementAdjustment()),pairs:{}};
  for(const key of ['XY','XZ','YZ']){const pair=levelGeometry.pairs.find(p=>p.key===key);const s=referenceSetup(pair);
   out.pairs[key]={setup:{base:s.base,scan:s.scan,owner:s.owner,member:s.member,body:s.body,mount:s.mount,normalDirection:s.normalDirection,relativeDirection:s.relativeDirection,memberSign:s.memberSign,relativeSign:s.relativeSign,zeroLocation:s.zeroLocation,scanDirection:s.scanDirection},
    physical:pick(referenceScan(pair)),display:pick(referenceDisplayScan(pair)),local300_um:pair.deviationMicroradians*.3,levelPairLocal300_um:levelGeometry.levelPairs.find(p=>p.key===key).deviationMicroradians*.3,
    initialDisplay:levelInitialSolution?pick(referenceDisplayScan(pair,positions,levelInitialSolution)):null};
  }
  const dom=[...document.querySelectorAll('.live-pair-error-value')].map(x=>({text:x.textContent,reading:x.getAttribute('data-reading-microns'),physical:x.getAttribute('data-physical-reading-microns'),model:x.getAttribute('data-reading-model'),gain:x.getAttribute('data-support-response-gain')}));
  const sweepT=spindleSweepGeometry(positions,levelSolution,machineProfile,1,true),sweepP=spindleSweepGeometry(positions,levelSolution,machineProfile,1,false);
  out.sweep={display:sweepT.cardinal.map(p=>({deg:p.degrees,reading:p.readingMicrons,onTable:p.onTable})),physical:sweepP.cardinal.map(p=>({deg:p.degrees,reading:p.readingMicrons,onTable:p.onTable})),dom:[0,1,2,3].map(i=>({label:$('sweepLabel'+i).textContent,text:$('sweepValue'+i).textContent,reading:$('sweepValue'+i).getAttribute('data-reading-microns')}))};
  out.dom=dom;
  out.lean={bodyLean:levelGeometry.bodyLean,bodyPosture:levelGeometry.bodyPosture,bodyIntrinsic:levelGeometry.bodyIntrinsicPosture,bodySupport:levelGeometry.bodySupportPosture,toolLean:levelGeometry.toolLean,relativeLean:levelGeometry.relativeLean,columnLeanText:$('columnLean').textContent,bodyLeanRows:$('bodyLeanValues').children.map(c=>c.textContent)};
  const ins=window.IntrinsicInspection?window.IntrinsicInspection.fromProfile(machineProfile):null;
  out.intrinsic=ins?{runout:ins.runout,surfaceRange:ins.surface.rangeMicrons}:'IntrinsicInspection not loaded in env';
  return out;})()`);
}

const results={commit:'e0e62e7c19dd78a4afab08d5d94a24d3b723cf36',machine:'vertical(kind compact)',cases:[]};
const scenarios=[
 {name:'new-seed20261012-center',seed:20261012,condition:'new',state:{X:0,Y:0,Z:0},op:{index:0,delta:.1}},
 {name:'new-seed20261012-offcenter',seed:20261012,condition:'new',state:{X:50,Y:-60,Z:40},op:{index:0,delta:.1}},
 {name:'used-seed7-center-D',seed:7,condition:'used',state:{X:0,Y:0,Z:0},op:{index:3,delta:.1}},
 {name:'zero-heights-noOp-check-pure-rigid',seed:20261012,condition:'new',state:{X:0,Y:0,Z:0},heights:[0,0,0,0],op:{index:0,delta:.1}},
 {name:'rigid-tilt-check(all+0.1 on left)',seed:20261012,condition:'new',state:{X:0,Y:0,Z:0},op:{indices:[0,2],delta:.1}},
];
// IntrinsicInspection is not loaded by the env; load it into the same context for readout.
e.read(fs.readFileSync('src/intrinsic-inspection.js','utf8'));
for(const sc of scenarios){
 const profile=setup(sc.seed,sc.condition,sc.heights,sc.state);
 const sq=Object.fromEntries(Object.entries(profile.squareness).map(([k,v])=>[k,v.microns]));
 const before=productRead();
 const hBefore=[...before.supportHeights],hAfter=[...hBefore];
 for(const i of sc.op.indices||[sc.op.index])hAfter[i]=Math.round((hAfter[i]+sc.op.delta)*1000)/1000;
 // emulate the UI action (same code path as the 上げる button)
 for(const i of sc.op.indices||[sc.op.index])e.read(`changeSupportHeight(${i},${sc.op.delta});`);
 const after=productRead();
 const inp=h=>({heights:h,width:2.08,depth:2.16,W:2.6,Dm:2.7,columnX:0,columnZ:0,squareness:sq});
 const oracle={before:{g1:oracleScans(inp(hBefore),sc.state,1),g5:oracleScans(inp(hBefore),sc.state,5)},after:{g1:oracleScans(inp(hAfter),sc.state,1),g5:oracleScans(inp(hAfter),sc.state,5)}};
 const C=oracleConditionC(inp(hBefore),inp(hAfter),sc.state),H=hypothesisAZeroShift(inp(hBefore),inp(hAfter),sc.state);
 const check={};
 for(const [tag,prod] of [['before',before],['after',after]])for(const key of ['XY','XZ','YZ']){
  check[tag+'.'+key+'.physical']=prod.pairs[key].physical.microns-oracle[tag].g1[key].microns;
  check[tag+'.'+key+'.display']=prod.pairs[key].display.microns-oracle[tag].g5[key].microns;
  check[tag+'.'+key+'.local300']=prod.pairs[key].local300_um-oracle[tag].g1.local300[key];
 }
 for(const [tag,prod] of [['before',before],['after',after]]){
  check[tag+'.sweep.display.maxAbsDiff']=Math.max(...prod.sweep.display.map((p,i)=>Math.abs(p.reading-oracle[tag].g5.sweep[i])));
  check[tag+'.sweep.physical.maxAbsDiff']=Math.max(...prod.sweep.physical.map((p,i)=>Math.abs(p.reading-oracle[tag].g1.sweep[i])));
  check[tag+'.delta']=prod.adjustment.supportAngle-oracle[tag].g5.delta;
  check[tag+'.columnLean.front']=prod.lean.bodyLean.front-oracle[tag].g1.columnLean.front;
 }
 const conditionA={status:'条件不足',reason:'小型の直角マスタの寸法・テーブル上の設置位置、接触点の高さ、計器腕の取付点が製品に定義されていない（referenceScanは開始接触点を原点[0,0,0]・本体を法線方向0.01 mに置く抽象配置）。',hypothesisH_onlyForScale:H,
  hypothesisH_note:'仮定H（製品未定義・本報告者の仮定）: 開始接触点の材料点=テーブル上面P、計器は主軸頭と剛体、マスタはテーブルと剛体。A≈C+startReadingShift。参考の桁評価のみ。'};
 results.cases.push({scenario:sc,profileSquareness_um:sq,heightsBefore:hBefore,heightsAfter:hAfter,product:{before,after},oracle,conditionC:C,conditionA,checkDiff_productMinusOracle:check});
}
fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(results,null,1));
// short console summary
for(const c of results.cases){
 const b=c.product.before,a=c.product.after;
 console.log('\n==',c.scenario.name,'sq',JSON.stringify(c.profileSquareness_um),'h',JSON.stringify(c.heightsBefore),'->',JSON.stringify(c.heightsAfter));
 console.log(' delta(urad) before/after',(b.adjustment.supportAngle*1e6).toFixed(4),(a.adjustment.supportAngle*1e6).toFixed(4),'extra angle(urad)',(a.adjustment.angle*1e6).toFixed(4));
 for(const k of ['XY','XZ','YZ'])console.log(' ',k,'phys',b.pairs[k].physical.microns.toFixed(4),'->',a.pairs[k].physical.microns.toFixed(4),'| disp',b.pairs[k].display.microns.toFixed(4),'->',a.pairs[k].display.microns.toFixed(4),'text',b.pairs[k].display.text,'->',a.pairs[k].display.text,'| local300',b.pairs[k].local300_um.toFixed(4),'->',a.pairs[k].local300_um.toFixed(4),'| C',c.conditionC[k].microns.toFixed(4),'| H shift',c.conditionA.hypothesisH_onlyForScale[k].startReadingShift_um.toFixed(3));
 console.log('  sweep disp',b.sweep.display.map(p=>p.reading.toFixed(3)).join(','),'->',a.sweep.display.map(p=>p.reading.toFixed(3)).join(','));
 console.log('  sweep phys',b.sweep.physical.map(p=>p.reading.toFixed(3)).join(','),'->',a.sweep.physical.map(p=>p.reading.toFixed(3)).join(','));
 console.log('  dom',JSON.stringify(a.dom.map(d=>d.text)),JSON.stringify(a.sweep.dom.map(d=>d.text)));
 console.log('  lean',JSON.stringify(b.lean.columnLeanText),'->',JSON.stringify(a.lean.columnLeanText));
 console.log('  maxAbs check',Math.max(...Object.values(c.checkDiff_productMinusOracle).map(Math.abs)));
}

'use strict';
// Horizontal (Haas EC-630, kind=horizontal) investigation.
// Run from repo root:  cd /home/user/Training-tools && node <this file> [seed] [condition]
// Product values come from the product functions (observation only).
// The "independent" values are re-computed here from INPUT data only
// (support coordinates, support heights, seed-generated intrinsic microns,
// axis positions) using the stated rigid-body kinematics of this model and
// the PRODUCT-ASSUMED fixture dimensions (which the user did not specify).
const fs=require('node:fs'),path=require('node:path');
const env=require('/home/user/Training-tools/tests/leveling-dom-env.cjs')();
const OUT=path.dirname(__filename);
const SEED=Number(process.argv[2]??20261012),COND=process.argv[3]??'used';
env.read("openMachine(machines.find(m=>m.kind==='horizontal'));");

// ---------- vector helpers (own) ----------
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const norm=a=>Math.hypot(...a),unit=a=>mul(a,1/norm(a)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const frameOf=(r,u,b)=>({r,u,b,to:v=>add(add(mul(r,v[0]),mul(u,v[1])),mul(b,v[2])),from:v=>[dot(v,r),dot(v,u),dot(v,b)]});
const compose=(A,B)=>frameOf(A.to(B.r),A.to(B.u),A.to(B.b));
const intText=v=>{const m=Math.round(Math.abs(v));return m===0?'0':(v<0?'-':'+')+m;};

// ---------- input data ----------
const supports=env.json('supports.map(s=>({x:s.x,z:s.z,name:s.name}))');
const machine=env.json('({w:current.w,d:current.d,levelConfig})');
const profile=env.json(`window.MachineAccuracy.generate(${JSON.stringify(COND)},${SEED},machineLinearKeys(),supports.length)`);

// ---------- independent kinematics ----------
function surfaceModel(heights){
 const xs=[...new Set(supports.map(p=>p.x))].sort((a,b)=>a-b),zs=[...new Set(supports.map(p=>p.z))].sort((a,b)=>a-b);
 const H=(x,z)=>heights[supports.findIndex(p=>p.x===x&&p.z===z)];
 const idx=(v,k)=>{let i=0;while(i<k.length-2&&v>=k[i+1]-1e-12)i++;return i;};
 const cell=(x,z)=>{const i=idx(x,xs),j=idx(z,zs),x0=xs[i],x1=xs[i+1],z0=zs[j],z1=zs[j+1];return {u:(x-x0)/(x1-x0),v:(z-z0)/(z1-z0),dx:x1-x0,dz:z1-z0,a:H(x0,z0),b:H(x1,z0),c:H(x0,z1),d:H(x1,z1)};};
 const h=(x,z)=>{const q=cell(x,z);return (q.a*(1-q.u)+q.b*q.u)*(1-q.v)+(q.c*(1-q.u)+q.d*q.u)*q.v;};
 const slope=(x,z)=>{const q=cell(x,z);return {lr:((q.b-q.a)*(1-q.v)+(q.d-q.c)*q.v)/q.dx,fb:((q.c-q.a)*(1-q.u)+(q.d-q.b)*q.u)/q.dz};};
 const point=(x,z)=>[x,.66+h(x,z)/1000,z];
 const frame=(x,z)=>{const s=slope(x,z),a=s.lr/1000,b=s.fb/1000,u=unit([-a,1,-b]),r=unit([1,a,0]);return frameOf(r,u,cross(r,u));};
 return {h,slope,point,frame};
}
const L=.3;
const xy=profile.squareness.XY.microns/300000,xz=profile.squareness.XZ.microns/300000,yz=profile.squareness.YZ.microns/300000;
const Yi=[-Math.sin(xy),Math.cos(xy),0];
const zx=-Math.sin(xz),zy=(-Math.sin(yz)-Yi[0]*zx)/Yi[1],Zi=[zx,zy,Math.sqrt(1-zx*zx-zy*zy)];
const Bbody=frameOf([Math.cos(xy),Math.sin(xy),0],Yi,[0,0,1]);// rotation about z taking e_y -> Yi
const D=machine.d,ZC=D*.29;
function kin(heights){
 const s=surfaceModel(heights);
 const tool=st=>{const xc=.55*st.X/100,F=s.frame(xc,ZC),T=compose(F,Bbody);
  return {nose:add(s.point(xc,ZC),T.to([0,1.89+.3*st.Y/100,-.93-ZC])),T,seat:[xc,ZC],seatSlope:s.slope(xc,ZC)};};
 const pallet=st=>{const tr=.45*st.Z/100,zp=-.85+tr,F=s.frame(0,zp);
  return {datum:add(s.point(0,zp),F.to(add([0,.61,0],mul(sub(Zi,[0,0,1]),tr)))),P:F,seat:[0,zp],seatSlope:s.slope(0,zp)};};
 return {s,tool,pallet};
}
function planeContact(point,normal,body,probe){const den=dot(normal,probe);if(Math.abs(den)<1e-8)return {valid:false,reason:'parallel'};const e=dot(normal,sub(point,body))/den;return e<0||e>.02?{valid:false,reason:'測定子の範囲外',extension:e}:{valid:true,extension:e,point:add(body,mul(probe,e))};}
// own bisection on point-to-axis distance (no shared quadratic)
function barContact(origin,axis,radius,body,probe){
 const f=t=>norm(cross(sub(add(body,mul(probe,t)),origin),axis))-radius;
 if(f(0)<=0)return {valid:false,reason:'body inside'};
 // scan for first sign change in [0, .02]
 let prev=0,found=null;for(let k=1;k<=400;k++){const t=.02*k/400;if(f(t)<=0){found=[prev,t];break;}prev=t;}
 if(!found)return {valid:false,reason:'範囲外(0-20mm内で接触せず)'};
 let [lo,hi]=found;for(let n=0;n<80;n++){const m=(lo+hi)/2;if(f(m)>0)lo=m;else hi=m;}
 const e=(lo+hi)/2,pt=add(body,mul(probe,e));return {valid:true,extension:e,point:pt,axial:dot(sub(pt,origin),axis)};
}

// ---------- product-assumed fixtures, independent re-implementation ----------
function startOf(stateVal,half){return Math.max(-half,Math.min(half-L,stateVal*half/100));}
const HALF={X:.55,Y:.3,Z:.45};
function setupXYXZ(K,pair,state,offsetOverride){
 const base='X',scan=pair==='XY'?'Y':'Z';
 const sStart=startOf(state[scan],HALF[scan]),bStart=startOf(state[base],HALF[base]);
 const startState={...state,[scan]:sStart/HALF[scan]*100},endState={...startState,[scan]:(sStart+L)/HALF[scan]*100};
 const baseAt=t=>({...startState,[base]:(bStart+L*t)/HALF[base]*100});
 const p0=K.pallet(startState),offset=offsetOverride||(pair==='XY'?[-.15,.05,0]:[-.15,.05,.16]),q0=add(p0.datum,p0.P.to(offset));
 const r0=K.tool(baseAt(0)),r1=K.tool(baseAt(1)),brLocal=r0.T.from(sub(q0,r0.nose)),q1=add(r1.nose,r1.T.to(brLocal));
 const n=unit(sub(q1,q0)),nominal=pair==='XY'?p0.P.u:mul(p0.P.b,-1),rN=unit(sub(nominal,mul(n,dot(nominal,n))));
 // R reading check at both ends of the X sweep (dial on spindle, R face fixed on the static pallet)
 const rBody0=sub(q0,mul(rN,.01)),rBL=r0.T.from(sub(rBody0,r0.nose)),rPL=r0.T.from(rN);
 const rRead=[r0,r1].map(t=>planeContact(q0,rN,add(t.nose,t.T.to(rBL)),t.T.to(rPL)));
 const point=add(add(q0,mul(n,.31)),mul(rN,.01)),body=add(point,mul(n,.01)),probe=mul(n,-1),t0=K.tool(startState);
 return {pair,base,scan,startState,endState,master:{pointLocal:p0.P.from(sub(point,p0.datum)),normalLocal:p0.P.from(n),cornerWorld:q0},dial:{bodyLocal:t0.T.from(sub(body,t0.nose)),probeLocal:t0.T.from(probe)},ext0:.01,rAlignmentMicrons:rRead.every(r=>r.valid)?(rRead[0].extension-rRead[1].extension)*1e6:null,armLengthM:norm(sub(q0,r0.nose))};
}
function setupYZ(K,state){
 const sStart=startOf(state.Y,HALF.Y),bStart=startOf(state.Z,HALF.Z);
 const startState={...state,Y:sStart/HALF.Y*100},endState={...startState,Y:(sStart+L)/HALF.Y*100},baseAt=t=>({...startState,Z:(bStart+L*t)/HALF.Z*100});
 const pR0=K.pallet(baseAt(0)),pR1=K.pallet(baseAt(1)),cornerLocal=[0,.37,.15],C=add(pR0.datum,pR0.P.to(cornerLocal));
 const c1=pR1.P.from(sub(C,pR1.datum)),sL=unit(sub(cornerLocal,c1)),rL=unit(sub([0,1,0],mul(sL,sL[1])));
 const p0=K.pallet(startState),t0=K.tool(startState),corner=add(p0.datum,p0.P.to(cornerLocal)),n=p0.P.to(sL),along=p0.P.to(rL);
 const point=add(add(corner,mul(n,.01)),mul(along,-.31)),body=add(point,mul(n,.01)),probe=mul(n,-1);
 return {pair:'YZ',base:'Z',scan:'Y',startState,endState,master:{pointLocal:p0.P.from(sub(point,p0.datum)),normalLocal:sL,cornerWorld:corner},dial:{bodyLocal:t0.T.from(sub(body,t0.nose)),probeLocal:t0.T.from(probe)},ext0:.01,armLengthM:norm(sub(body,t0.nose))};
}
function readSquare(K,setup,st){
 const p=K.pallet(st),t=K.tool(st),point=add(p.datum,p.P.to(setup.master.pointLocal)),normal=p.P.to(setup.master.normalLocal);
 const body=add(t.nose,t.T.to(setup.dial.bodyLocal)),probe=t.T.to(setup.dial.probeLocal),c=planeContact(point,normal,body,probe);
 return {...c,body,probe,micronsFromZero:c.valid?(setup.ext0-c.extension)*1e6:null};
}
function setupParallel(K,state){
 const zStart=startOf(state.Z,HALF.Z),startState={...state,Z:zStart/HALF.Z*100},endState={...startState,Z:(zStart+L)/HALF.Z*100};
 const t0=K.tool(startState),p0=K.pallet(startState),axis=t0.T.b,origin=sub(t0.nose,mul(axis,.31));
 const dials={a:t0.T.r,b:t0.T.u};const out={startState,endState,barLocal:{origin:[0,0,-.31],axis:[0,0,1]},dials:{}};
 for(const k of ['a','b']){const probe=dials[k],body=sub(origin,mul(probe,.035));out.dials[k]={bodyLocal:p0.P.from(sub(body,p0.datum)),probeLocal:p0.P.from(probe),bracketM:norm(sub(body,p0.datum))};}
 out.ext0=.01;return out;
}
function readParallel(K,setup,k,st){
 const t=K.tool(st),p=K.pallet(st),origin=add(t.nose,t.T.to(setup.barLocal.origin)),axis=t.T.to(setup.barLocal.axis);
 const d=setup.dials[k],body=add(p.datum,p.P.to(d.bodyLocal)),probe=p.P.to(d.probeLocal),c=barContact(origin,axis,.025,body,probe);
 const inBar=c.valid&&c.axial>=-.01-1e-10&&c.axial<=.31+1e-10;
 return {...c,valid:c.valid&&inBar,reason:c.valid&&!inBar?'テストバーの校正区間外':c.reason,micronsFromZero:c.valid&&inBar?(setup.ext0-c.extension)*1e6:null};
}

// ---------- product observation ----------
function productSet(heights,pos){
 env.read(`machineProfile=window.MachineAccuracy.generate(${JSON.stringify(COND)},${SEED},machineLinearKeys(),supports.length);supportHeights=${JSON.stringify(heights)};positions={X:${pos.X},Y:${pos.Y},Z:${pos.Z},A:0,C:0};updateLeveling(false);if(typeof updateSpindleSweep==='function')updateSpindleSweep();`);
 const scans={};
 for(const k of ['XY','XZ','YZ'])scans[k]=env.json(`(()=>{const m=referenceScan({key:'${k}'});return {valid:m.valid,reason:m.reason,microns:m.microns,display:m.valid?squarenessMicronText(m.microns):'—',autoZero:m.autoZero,model:m.model,fixture:m.fixture,startPosition:m.startPosition,zeroExt:m.zero?.extension,lastExt:m.last?.extension,zeroPoint:m.zero?.point,lastPoint:m.last?.point,startBody:m.start?.body,endBody:m.end?.body,alignmentMicrons:m.alignment?.microns,masterCorner:m.master?.corner}})()`);
 const par=env.json(`(()=>{const q=horizontalParallelism();const f=r=>({valid:r.valid,reason:r.reason,microns:r.microns,display:r.valid?squarenessMicronText(r.microns):'—',zeroExt:r.zero?.extension,lastExt:r.last?.extension,zeroPoint:r.zero?.point,lastPoint:r.last?.point,zeroAxial:r.zero?.axial,lastAxial:r.last?.axial});return {valid:q.valid,reason:q.reason,a:f(q.a),b:f(q.b),autoZero:q.autoZero,fixture:q.fixture,startPosition:q.startPosition,nose:q.tool?.nose,axis:q.tool?.axis,palletOrigin:q.palletOrigin}})()`);
 const ui=env.json(`(()=>{const html=$('liveSquareness').innerHTML;const r=[...html.matchAll(/data-pair="(\\w+)"[^>]*class="live-pair-values"|class="live-pair-error-value"[^>]*>([^<]*)</g)].map(m=>m[2]).filter(v=>v!==undefined);return {liveReadings:r,sweep:[0,1,2,3].map(i=>$('sweepLabel'+i).textContent+'='+$('sweepValue'+i).textContent),sweepStatus:$('sweepContactStatus').textContent,columnLean:$('columnLean').textContent,fine:$('finePrecisionSummary').children.map(c=>c.textContent)}})()`);
 const g=env.json(`(()=>{const g=geometryModel();return {pairs:g.pairs.map(p=>({key:p.key,deviationMicroradians:p.deviationMicroradians,per300:p.deviationMicroradians*.3})),bodyLean:g.bodyLean,toolLean:g.toolLean,guideSlope:g.guideSlope,toolSlope:g.toolSlope,workSlope:g.workSlope,directions:g.directions.map(d=>({key:d.key,direction:d.direction}))}})()`);
 return {scans,par,ui,g};
}

// ---------- independent local-angle (for 300 mm conversion comparison) ----------
function localAngles(heights,pos){
 const s=surfaceModel(heights),xc=.55*pos.X/100,zp=-.85+.45*pos.Z/100;
 const rail=[-1,1].map(k=>s.slope(xc,D*.28+k*.13)),guide={lr:(rail[0].lr+rail[1].lr)/2,fb:(rail[0].fb+rail[1].fb)/2};
 const fr=sl=>{const a=sl.lr/1000,b=sl.fb/1000,u=unit([-a,1,-b]),r=unit([1,a,0]);return frameOf(r,u,cross(r,u));};
 const Xd=fr(guide).to([1,0,0]),Yd=s.frame(xc,ZC).to(Yi),Zd=s.frame(0,zp).to(Zi);
 const dev=(a,b)=>-Math.asin(dot(a,b))*1e6;
 // seat path (finite-scan) X direction: chord of seat point
 const seatChord=unit(sub(s.point(xc+.3,ZC),s.point(xc,ZC)));
 return {railX:{XY:dev(Xd,Yd),XZ:dev(Xd,Zd)},YZ:dev(Yd,Zd),seatX:{XY:dev(seatChord,Yd),XZ:dev(seatChord,Zd)},guideSlope:guide,seatSlope:s.slope(xc,ZC)};
}

// ---------- experiment ----------
const pos={X:0,Y:0,Z:0};
const h0=[...profile.initialHeights];
const cases=[];
for(const [index,step] of [[0,.1],[4,.1],[6,.1],[7,-.1],[6,.01]]){
 const h1=[...h0];h1[index]=Math.round((h1[index]+step)*1000)/1000;
 const K0=kin(h0),K1=kin(h1);
 const prod0=productSet(h0,pos),prod1=productSet(h1,pos);
 const sq={};
 for(const pair of ['XY','XZ','YZ']){
  const S0=pair==='YZ'?setupYZ(K0,pos):setupXYXZ(K0,pair,pos),S1=pair==='YZ'?setupYZ(K1,pos):setupXYXZ(K1,pair,pos);
  const before={start:readSquare(K0,S0,S0.startState),end:readSquare(K0,S0,S0.endState)};
  const afterB={start:readSquare(K1,S1,S1.startState),end:readSquare(K1,S1,S1.endState)};
  const afterA={start:readSquare(K1,S0,S0.startState),end:readSquare(K1,S0,S0.endState)};// keep master/dial mount and old zero
  const pick=r=>({valid:r.valid,reason:r.reason,extensionMm:r.valid?r.extension*1000:null,contact:r.point,microns:r.micronsFromZero,display:r.valid?intText(r.micronsFromZero):'—(無効:'+r.reason+')'});
  sq[pair]={
   productAssumedArmM:S0.armLengthM,rAlignmentMicronsIndependent:S0.rAlignmentMicrons??null,
   before:{product:prod0.scans[pair],independentB:{start:pick(before.start),end:pick(before.end)}},
   after:{product:prod1.scans[pair],
    B_independent:{start:pick(afterB.start),end:pick(afterB.end)},
    A_holdMountAndZero:{start:pick(afterA.start),end:pick(afterA.end)},
    C_sameMountRezeroAtStart:afterA.start.valid&&afterA.end.valid?{microns:afterA.end.micronsFromZero-afterA.start.micronsFromZero,display:intText(afterA.end.micronsFromZero-afterA.start.micronsFromZero)}:{valid:false}},
   check:{productMinusIndependentB_before:prod0.scans[pair].valid?prod0.scans[pair].microns-before.end.micronsFromZero:null,productMinusIndependentB_after:prod1.scans[pair].valid?prod1.scans[pair].microns-afterB.end.micronsFromZero:null}
  };
 }
 const P0=setupParallel(K0,pos),P1=setupParallel(K1,pos),par={};
 for(const k of ['a','b']){
  const pick=r=>({valid:r.valid,reason:r.reason,extensionMm:r.valid?r.extension*1000:null,contact:r.point,axialMm:r.valid?r.axial*1000:null,microns:r.micronsFromZero,display:r.valid?intText(r.micronsFromZero):'—(無効:'+r.reason+')'});
  const b0={start:readParallel(K0,P0,k,P0.startState),end:readParallel(K0,P0,k,P0.endState)},bB={start:readParallel(K1,P1,k,P1.startState),end:readParallel(K1,P1,k,P1.endState)},bA={start:readParallel(K1,P0,k,P0.startState),end:readParallel(K1,P0,k,P0.endState)};
  par[k]={bracketLengthM:P0.dials[k].bracketM,before:{product:prod0.par[k],independentB:{start:pick(b0.start),end:pick(b0.end)}},after:{product:prod1.par[k],B_independent:{start:pick(bB.start),end:pick(bB.end)},A_holdMountAndZero:{start:pick(bA.start),end:pick(bA.end)},C_sameMountRezeroAtStart:bA.start.valid&&bA.end.valid?{microns:bA.end.micronsFromZero-bA.start.micronsFromZero,display:intText(bA.end.micronsFromZero-bA.start.micronsFromZero)}:{valid:false}},
   check:{before:prod0.par[k].valid?prod0.par[k].microns-b0.end.micronsFromZero:null,after:prod1.par[k].valid?prod1.par[k].microns-bB.end.micronsFromZero:null}};
 }
 cases.push({operation:{support:index,name:supports[index].name,x:supports[index].x,z:supports[index].z,stepMm:step,heightBefore:h0[index],heightAfter:h1[index]},
  squareness:sq,parallelism:par,
  ui:{before:prod0.ui,after:prod1.ui},
  localAngle:{before:{product:prod0.g.pairs,independent:localAngles(h0,pos)},after:{product:prod1.g.pairs,independent:localAngles(h1,pos)}},
  leanIndependent:[K0,K1].map(K=>{const u=K.tool(pos).T.u,ax=K.tool(pos).T.b,pz=K.pallet(pos).P;return {columnFront:Math.atan2(-u[2],u[1])*1e6,columnRight:Math.atan2(u[0],u[1])*1e6,spindleAxisPitch:Math.atan2(ax[1],ax[2])*1e6,palletUpFront:Math.atan2(-pz.u[2],pz.u[1])*1e6,palletUpRight:Math.atan2(pz.u[0],pz.u[1])*1e6,palletZdirPitch:Math.atan2(pz.to(Zi)[1],pz.to(Zi)[2])*1e6};}),
  lean:{before:prod0.g.bodyLean,after:prod1.g.bodyLean,toolLeanBefore:prod0.g.toolLean,toolLeanAfter:prod1.g.toolLean}});
}

// ---------- out-of-range behaviour ----------
function rangeProbe(heights,label){const p=productSet(heights,pos);return {label,heights,scans:Object.fromEntries(Object.entries(p.scans).map(([k,v])=>[k,{valid:v.valid,reason:v.reason,display:v.display}])),par:{a:{valid:p.par.a.valid,reason:p.par.a.reason,display:p.par.a.display},b:{valid:p.par.b.valid,reason:p.par.b.reason,display:p.par.b.display}},ui:p.ui};}
const extremes=[];
for(const k of [[0,.5],[6,.5],[6,-.5],[7,.5]]){const h=[...h0];h[k[0]]=k[1];extremes.push(rangeProbe(h,`support ${k[0]} = ${k[1]} mm (UI上限 ±0.5)`));}
// extreme saddle (all within ±0.5 UI limit)
extremes.push(rangeProbe(supports.map(p=>p.x*p.z>0?.5:-.5),'saddle ±0.5 mm'));
extremes.push(rangeProbe(supports.map(p=>p.z>0?.5:-.5),'front/back ±0.5 mm'));

// ---------- condition A large-adjustment validity (independent, product-assumed fixture) ----------
function aValidity(heights){const K0=kin(h0),K1=kin(heights),out={};
 for(const pair of ['XY','XZ','YZ']){const S0=pair==='YZ'?setupYZ(K0,pos):setupXYXZ(K0,pair,pos);const s=readSquare(K1,S0,S0.startState),e=readSquare(K1,S0,S0.endState);out[pair]={start:s.valid?intText(s.micronsFromZero):'無効:'+s.reason,end:e.valid?intText(e.micronsFromZero):'無効:'+e.reason,startExtMm:s.extension*1000,endExtMm:e.extension*1000};}
 const P0=setupParallel(K0,pos);for(const k of ['a','b']){const s=readParallel(K1,P0,k,P0.startState),e=readParallel(K1,P0,k,P0.endState);out['par_'+k]={start:s.valid?intText(s.micronsFromZero):'無効:'+s.reason,end:e.valid?intText(e.micronsFromZero):'無効:'+e.reason};}
 return out;}
const aLarge=[{label:'support 6 +0.5',h:(()=>{const h=[...h0];h[6]=.5;return h;})()},{label:'front/back ±0.5',h:supports.map(p=>p.z>0?.5:-.5)}].map(c=>({label:c.label,result:aValidity(c.h)}));

// ---------- fixture sensitivity (B, independent): same seed/heights/positions, only the assumed master location changes ----------
const sens=[];
for(const pair of ['XY','XZ'])for(const dz of [-.3,-.15,0,.15,.3])for(const dy of [0,.2]){
 const base=pair==='XY'?[-.15,.05,0]:[-.15,.05,.16],off=[base[0],base[1]+dy,base[2]+dz],K=kin(h0),S=setupXYXZ(K,pair,pos,off),e=readSquare(K,S,S.endState);
 sens.push({pair,offsetLocal:off,B_end_microns:e.micronsFromZero,display:intText(e.micronsFromZero)});
}
// ---------- invalid range: shrink support width so X half < 150 mm ----------
const invalidUI=(()=>{env.read(`levelConfig.width=0.5;supportHeights=${JSON.stringify(h0)};positions={X:0,Y:0,Z:0,A:0,C:0};updateLeveling(false);updateSpindleSweep();`);
 const r=env.json(`(()=>{const s=['XY','XZ','YZ'].map(k=>{const m=referenceScan({key:k});return {k,valid:m.valid,reason:m.reason}});const p=horizontalParallelism();return {s,par:{valid:p.valid,reason:p.reason},live:[...$('liveSquareness').innerHTML.matchAll(/class="live-pair-error-value"[^>]*>([^<]*)</g)].map(m=>m[1]),sweep:[0,1,2,3].map(i=>$('sweepValue'+i).textContent),status:$('sweepContactStatus').textContent}})()`);
 env.read(`levelConfig.width=${machine.levelConfig.width};updateLeveling(false);`);return r;})();
// ---------- geometry facts ----------
const facts=env.json(`(()=>{const f=horizontalSpindleFixture(positions,levelSolution,machineProfile);return {nose:f.nose,axis:f.axis,palletDatum:horizontalPalletPoint([0,1.27,-.85]),columnSeat:geometryModel().toolPoints,workPoint:geometryModel().workPoint,guidePoints:geometryModel().guidePoints}})()`);
productSet(h0,pos);
const intrinsic=require('/home/user/Training-tools/src/intrinsic-inspection.js').fromProfile(profile);
const result={commit:'e0e62e7c19dd78a4afab08d5d94a24d3b723cf36',seed:SEED,condition:COND,profile,supports,machine,positions:pos,facts,intrinsic,cases,extremes,aLarge,sens,invalidUI};
fs.writeFileSync(path.join(OUT,`result-seed${SEED}-${COND}.json`),JSON.stringify(result,null,1));
// short console summary
const r=x=>x==null?null:Math.round(x*1000)/1000;
console.log('seed',SEED,COND,'squareness',profile.squareness);
for(const c of cases){
 console.log(`\n# support ${c.operation.support} (${c.operation.name}) ${c.operation.heightBefore} -> ${c.operation.heightAfter}`);
 for(const p of ['XY','XZ','YZ']){const q=c.squareness[p];console.log(p,'prodB before',r(q.before.product.microns),q.before.product.display,'after',r(q.after.product.microns),q.after.product.display,'| indepB after',r(q.after.B_independent.end.microns),'| A start',q.after.A_holdMountAndZero.start.display,r(q.after.A_holdMountAndZero.start.microns),'A end',q.after.A_holdMountAndZero.end.display,'C',q.after.C_sameMountRezeroAtStart.display,'| diff',r(q.check.productMinusIndependentB_before),r(q.check.productMinusIndependentB_after),'arm',r(q.productAssumedArmM));}
 for(const k of ['a','b']){const q=c.parallelism[k];console.log('par',k,'prodB before',r(q.before.product.microns),'after',r(q.after.product.microns),q.after.product.display,'| A start',q.after.A_holdMountAndZero.start.display,'A end',q.after.A_holdMountAndZero.end.display,'C',q.after.C_sameMountRezeroAtStart.display,'| diff',r(q.check.before),r(q.check.after),'bracket',r(q.bracketLengthM));}
 console.log('local300 prod after',c.localAngle.after.product.map(p=>p.key+':'+r(p.per300)).join(' '),'indep rail',JSON.stringify(c.localAngle.after.independent.railX),'YZ',r(c.localAngle.after.independent.YZ*.3),'seatX',JSON.stringify(c.localAngle.after.independent.seatX));
 console.log('lean prod',JSON.stringify(c.lean.before),JSON.stringify(c.lean.after),'indep',JSON.stringify(c.leanIndependent));console.log('UI after',JSON.stringify(c.ui.after.liveReadings),c.ui.after.sweep.join(' '),'|',c.ui.after.columnLean);
}
console.log('\nextremes');for(const e of extremes)console.log(e.label,JSON.stringify(e.scans),JSON.stringify(e.par),e.ui.liveReadings,e.ui.sweep.join(' '),e.ui.sweepStatus);
console.log('\nA large',JSON.stringify(aLarge,null,0));
console.log('sens',JSON.stringify(sens));console.log('invalidUI',JSON.stringify(invalidUI));console.log('facts',JSON.stringify(facts));

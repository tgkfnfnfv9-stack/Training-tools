'use strict';
// Independent oracle for the horizontal machine (Haas EC-630, kind=horizontal).
// Inputs: dimensions, 2x4 support grid, heights, seeded squareness, drawn
// material points (rail centre line 0.28D+/-0.13, spindle nose, pallet, master).
const {add,sub,mul,dot,unit,cross,app,inv,comp,slopeFrame,minimalRotation,intrinsicAxes,lsqPlane}=require('./lib.cjs');
const W=3.4,D=4.6;
function surface(cfg,heights){
 const hw=cfg.width/2,zs=[0,1,2,3].map(j=>(j/3-.5)*cfg.depth),xs=[-hw,hw];
 const pts=[];for(let j=0;j<4;j++)for(let i=0;i<2;i++)pts.push({x:xs[i],z:zs[j],h:heights[j*2+i]});
 const pl=lsqPlane(pts),plane=(x,z)=>pl.a*x+pl.b*z+pl.c;
 const snap=(v,k)=>k.find(q=>Math.abs(v-q)<=1e-12)??v;
 const cell=(x,z)=>{let j=0;while(j<2&&z>=zs[j+1])j++;const H=(i,jj)=>heights[jj*2+i];return {u:(x-xs[0])/(xs[1]-xs[0]),v:(z-zs[j])/(zs[j+1]-zs[j]),dx:xs[1]-xs[0],dz:zs[j+1]-zs[j],h00:H(0,j),h10:H(1,j),h01:H(0,j+1),h11:H(1,j+1)};};
 const h=(x,z)=>{const q=cell(x,z),f=q.h00+(q.h10-q.h00)*q.u,b=q.h01+(q.h11-q.h01)*q.u;return f+(b-f)*q.v;};
 const slope=(x,z)=>{const q=cell(snap(x,xs),snap(z,zs));return {lr:((q.h10-q.h00)*(1-q.v)+(q.h11-q.h01)*q.v)/q.dx,fb:((q.h01-q.h00)*(1-q.u)+(q.h11-q.h10)*q.u)/q.dz};};
 const C=slopeFrame(pl.a,pl.b),S=(x,z)=>{const s=slope(x,z);return comp(C,slopeFrame(s.lr-pl.a,s.fb-pl.b));};
 const Sp=(x,z)=>add(app(C,[x,(h(x,z)-plane(x,z))/1000,z]),[0,.66+pl.c/1000,0]);
 return {pl,h,slope,S,Sp,C,zs,xs};
}
function model(cfg,heights,profile,opts={}){
 const kx=cfg.width/(W*.8),kz=cfg.depth/(D*.8),lx=x=>x*kx,lz=z=>z*kz,s=surface(cfg,heights);
 const [Xi,Yi,Zi]=intrinsicAxes([1,0,0],[0,1,0],[0,0,1],profile.XY,profile.XZ,profile.YZ);
 const body=minimalRotation([0,1,0],Yi);
 const layout={x:W*.2*(cfg.columnX||0)/100,z:D*.1*(cfg.columnZ||0)/100};
 const seatZ=opts.seatZ??.28; // column seat line (fraction of D); rails at .28D+/-.13
 const anchor=st=>({x:lx(layout.x+.55*st.X/100),z:lz(D*seatZ+layout.z)});
 const tool={
  frame:st=>{const a=anchor(st);return comp(s.S(a.x,a.z),body);},
  T:st=>{const a=anchor(st);return s.S(a.x,a.z);},
  point:(l,st)=>{const a=anchor(st),T=s.S(a.x,a.z);return add(add(s.Sp(a.x,a.z),app(comp(T,body),l)),mul(app(T,Yi),.3*st.Y/100));},
  local:(p,st)=>{const a=anchor(st),T=s.S(a.x,a.z);return inv(comp(T,body),sub(sub(p,s.Sp(a.x,a.z)),mul(app(T,Yi),.3*st.Y/100)));},
 };
 tool.raw=r=>[lx(r[0]),r[1]-.66,lz(r[2])-lz(D*seatZ)];
 tool.nose=st=>tool.point(tool.raw([0,2.55,-.93]),st);
 tool.dirs=st=>{const F=tool.frame(st);return {right:F.r,up:F.u,axis:F.b};};
 const pAnchor=st=>{const travel=lz(.45*st.Z/100);return {x:0,z:lz(-.85)+travel,travel};};
 const pallet={
  frame:st=>{const a=pAnchor(st);return s.S(a.x,a.z);},
  point:(l,st)=>{const a=pAnchor(st),F=s.S(a.x,a.z);return add(s.Sp(a.x,a.z),app(F,add(l,mul(sub(Zi,[0,0,1]),a.travel))));},
  local:(p,st)=>{const a=pAnchor(st),F=s.S(a.x,a.z);return sub(inv(F,sub(p,s.Sp(a.x,a.z))),mul(sub(Zi,[0,0,1]),a.travel));},
 };
 pallet.origin=st=>pallet.point([0,.61,0],st);
 // rail mean guide (two rails at seat line +/-0.13 m raw)
 const guide=st=>{const xr=lx(layout.x+.55*st.X/100),sl=[-1,1].map(k=>s.slope(xr,lz(D*.28+layout.z+k*.13)));const lr=(sl[0].lr+sl[1].lr)/2,fb=(sl[0].fb+sl[1].fb)/2;return comp(s.C,slopeFrame(lr-s.pl.a,fb-s.pl.b));};
 const dirs=st=>({X:app(guide(st),Xi),Y:app(tool.T(st),Yi),Z:app(pallet.frame(st),Zi)});
 return {cfg,s,Xi,Yi,Zi,body,layout,lx,lz,kx,kz,tool,pallet,guide,dirs,anchor,halfX:.55*kx,halfY:.3,halfZ:.45*kz};
}
function contact(point,normal,body,probe){const den=dot(normal,probe);if(Math.abs(den)<1e-8)return {valid:false,reason:'parallel'};const ext=dot(normal,sub(point,body))/den;if(!(ext>=0&&ext<=.02))return {valid:false,reason:'probe range',ext};return {valid:true,ext,point:add(body,mul(probe,ext))};}
const clampStart=(pos,half)=>Math.max(-half,Math.min(half-.3,pos));
const T17=Array.from({length:17},(_,i)=>i/16);
// Setup (B): align R and zero S in model m at state. Returns material mount + world geometry.
function setupXYXZ(m,key,state){
 const scan=key[1],hs=key==='XY'?m.halfY:m.halfZ,start=clampStart(state[scan]*hs/100,hs),startState={...state,[scan]:start/hs*100};
 const p0=m.pallet.origin(startState),W0=m.pallet.frame(startState),offset=key==='XY'?[-.15,.05,0]:[-.15,.05,.16],q0=add(p0,app(W0,offset));
 const bStart=clampStart(state.X*m.halfX/100,m.halfX),baseAt=t=>({...startState,X:(bStart+.3*t)/m.halfX*100});
 const tipLocal=m.tool.local(q0,baseAt(0)),q1=m.tool.point(tipLocal,baseAt(1)),normal=unit(sub(q1,q0));
 const nominal=key==='XY'?W0.u:mul(W0.b,-1),rN=unit(sub(nominal,mul(normal,dot(nominal,normal)))),cr=cross(normal,rN);
 // R alignment validity (dial carried by the tool along X; master fixed on pallet)
 const rBodyL=m.tool.local(sub(q0,mul(rN,.01)),baseAt(0)),rProbeL=inv(m.tool.frame(baseAt(0)),rN);
 let rValid=true;const rRead=[];
 for(const t of T17){const st=baseAt(t),c=contact(q0,rN,m.tool.point(rBodyL,st),app(m.tool.frame(st),rProbeL));if(!c.valid){rValid=false;break;}const d=sub(c.point,q0),al=dot(d,normal),ac=dot(d,cr);rRead.push(c.ext);if(al<-.010000001||al>.310000001||Math.abs(ac)>.025000001){rValid=false;break;}}
 const point=add(add(q0,mul(normal,.31)),mul(rN,.01)),bodyW=add(point,mul(normal,.01));
 return {key,scan,start,end:start+.3,startState,stateAt:t=>({...startState,[scan]:(start+.3*t)/hs*100}),rValid,
  rAlignmentEndsEqual:rRead.length?(rRead[0]-rRead[rRead.length-1])*1e6:null,
  master:{l:m.pallet.local(point,startState),n:inv(W0,mul(normal,1)),along:inv(W0,key==='XY'?rN:mul(rN,-1)),cross:inv(W0,cr)},
  dial:{l:m.tool.local(bodyW,startState),p:inv(m.tool.frame(startState),mul(normal,-1))},relSign:key==='XY'?1:-1};
}
function setupYZ(m,state){
 const start=clampStart(state.Y*m.halfY/100,m.halfY),startState={...state,Y:start/m.halfY*100};
 const bStart=clampStart(state.Z*m.halfZ/100,m.halfZ),baseAt=t=>({...startState,Z:(bStart+.3*t)/m.halfZ*100});
 const corner=[0,.37,.15],pW=st=>m.pallet.frame(st),cornerW=st=>add(m.pallet.origin(st),app(pW(st),corner));
 const c0=cornerW(baseAt(0)),c1L=inv(pW(baseAt(1)),sub(c0,m.pallet.origin(baseAt(1)))),sL=unit(sub(corner,c1L)),rL=unit(sub([0,1,0],mul(sL,sL[1]))),xL=cross(sL,rL);
 const bodyR=add(c0,mul(app(pW(baseAt(0)),rL),.01)),bL=m.tool.local(bodyR,baseAt(0)),pL=inv(m.tool.frame(baseAt(0)),mul(app(pW(baseAt(0)),rL),-1));
 let rValid=true;const rr=[];
 for(const t of T17){const st=baseAt(t),F=pW(st),cw=cornerW(st),c=contact(cw,app(F,rL),m.tool.point(bL,st),app(m.tool.frame(st),pL));if(!c.valid){rValid=false;break;}const d=inv(F,sub(c.point,cw)),al=dot(d,sL),ac=dot(d,xL);rr.push(c.ext);if(al<-.310000001||al>.010000001||Math.abs(ac)>.025000001){rValid=false;break;}}
 const F0=pW(startState),cw=cornerW(startState),normal=app(F0,sL),along=app(F0,rL),point=add(add(cw,mul(normal,.01)),mul(along,-.31)),bodyW=add(point,mul(normal,.01));
 return {key:'YZ',scan:'Y',start,end:start+.3,startState,stateAt:t=>({...startState,Y:(start+.3*t)/m.halfY*100}),rValid,rAlignmentEndsEqual:rr.length?(rr[0]-rr[rr.length-1])*1e6:null,
  master:{l:m.pallet.local(point,startState),n:sL,along:rL,cross:xL},dial:{l:m.tool.local(bodyW,startState),p:inv(m.tool.frame(startState),mul(normal,-1))},relSign:1};
}
function setup(m,key,state){return key==='YZ'?setupYZ(m,state):setupXYXZ(m,key,state);}
function readAt(m,su,st){
 const F=m.pallet.frame(st),point=m.pallet.point(su.master.l,st),normal=app(F,su.master.n),body=m.tool.point(su.dial.l,st),probe=app(m.tool.frame(st),su.dial.p),c=contact(point,normal,body,probe);
 if(!c.valid)return c;
 const d=sub(c.point,point),dist=dot(d,app(F,su.master.along))*su.relSign,ac=dot(d,app(F,su.master.cross));
 if(dist<-.010000001||dist>.310000001||Math.abs(ac)>.025000001)return {...c,valid:false,reason:'S range'};
 return c;
}
function scanRead(m,su){
 const breaks=[];for(const z of m.s.zs){}
 const reads=T17.map(t=>readAt(m,su,su.stateAt(t)));const bad=reads.find(r=>!r.valid);
 if(bad||!su.rValid)return {valid:false,reason:bad?.reason||'R range'};
 return {valid:true,ext0:reads[0].ext,ext1:reads.at(-1).ext,microns:(reads[0].ext-reads.at(-1).ext)*1e6,contact0:reads[0].point,contact1:reads.at(-1).point};
}
function squareness(mB,key,state,m0){
 const hs={XY:mB.halfY,XZ:mB.halfZ,YZ:mB.halfY}[key];
 if(2*hs<.3-1e-12||2*mB.halfX<.3-1e-12&&key!=='YZ'||key==='YZ'&&2*mB.halfZ<.3-1e-12)return {key,B:{valid:false,reason:'range'}};
 const su=setup(mB,key,state),B=scanRead(mB,su),out={key,B,startPosition:su.start,endPosition:su.end,rAlignmentEnds:su.rAlignmentEndsEqual};
 if(m0){
  const so=setup(m0,key,state),z=readAt(m0,so,so.stateAt(0)),a0=readAt(mB,so,so.stateAt(0)),a1=readAt(mB,so,so.stateAt(1));
  out.A=z.valid&&a0.valid&&a1.valid?{zeroExtBefore:z.ext,contactBefore:z.point,extStart:a0.ext,extEnd:a1.ext,contactStart:a0.point,contactEnd:a1.point,zeroPointMicrons:(z.ext-a0.ext)*1e6,endMicrons:(z.ext-a1.ext)*1e6}:{valid:false,reasons:[z.reason,a0.reason,a1.reason]};
  out.C=a0.valid&&a1.valid?{microns:(a0.ext-a1.ext)*1e6}:{valid:false};
 }
 return out;
}
// Cylinder contact (bar radius 25 mm, calibrated -0.01..0.31 m from origin)
function cyl(axis,origin,body,probe){
 const q=sub(body,origin),rad=v=>sub(v,mul(axis,dot(v,axis))),u=rad(probe),v=rad(q),A=dot(u,u),B=2*dot(u,v),C=dot(v,v)-.025*.025,disc=B*B-4*A*C;
 if(disc<0||C<-1e-12)return {valid:false};const t=(-B-Math.sqrt(disc))/(2*A);if(!(t>=-1e-12)||t>.02)return {valid:false};
 const p=add(body,mul(probe,t)),ax=dot(sub(p,origin),axis);if(ax<-.01-1e-10||ax>.31+1e-10)return {valid:false,reason:'axial'};return {valid:true,ext:t,point:p,axial:ax};
}
function parallelSetup(m,state){
 const hz=m.halfZ;if(2*hz<.3)return null;
 const start=clampStart(state.Z*hz/100,hz),stateAt=t=>({...state,Z:(start+.3*t)/hz*100}),s0=stateAt(0),d=m.tool.dirs(s0),nose=m.tool.nose(s0),origin=sub(nose,mul(d.axis,.31));
 const F0=m.pallet.frame(s0);
 const mk=probe=>({l:m.pallet.local(sub(origin,mul(probe,.035)),s0),p:inv(F0,probe)});
 return {start,stateAt,bar:{originL:m.tool.local(origin,s0),axisL:inv(m.tool.frame(s0),d.axis)},a:mk(d.right),b:mk(d.up)};
}
function parallelRead(m,su,ch,st){
 const origin=m.tool.point(su.bar.originL,st),axis=app(m.tool.frame(st),su.bar.axisL),body=m.pallet.point(su[ch].l,st),probe=app(m.pallet.frame(st),su[ch].p);
 return cyl(axis,origin,body,probe);
}
function parallelism(mB,state,m0){
 const su=parallelSetup(mB,state);if(!su)return {valid:false};
 const out={};
 for(const ch of ['a','b']){
  const r=T17.map(t=>parallelRead(mB,su,ch,su.stateAt(t)));
  out[ch]=r.every(q=>q.valid)?{valid:true,microns:(r[0].ext-r.at(-1).ext)*1e6,ext0:r[0].ext,ext1:r.at(-1).ext,contact0:r[0].point,contact1:r.at(-1).point}:{valid:false};
  if(m0){const so=parallelSetup(m0,state),z=parallelRead(m0,so,ch,so.stateAt(0)),a0=parallelRead(mB,so,ch,so.stateAt(0)),a1=parallelRead(mB,so,ch,so.stateAt(1));
   out[ch].A=z.valid&&a0.valid&&a1.valid?{zeroExtBefore:z.ext,extStart:a0.ext,extEnd:a1.ext,contactStart:a0.point,contactEnd:a1.point,zeroPointMicrons:(z.ext-a0.ext)*1e6,endMicrons:(z.ext-a1.ext)*1e6}:{valid:false};
   out[ch].C=a0.valid&&a1.valid?{microns:(a0.ext-a1.ext)*1e6}:{valid:false};}
 }
 out.startPosition=su.start;return out;
}
module.exports={model,squareness,parallelism,surface};

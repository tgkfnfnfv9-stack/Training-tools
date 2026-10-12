'use strict';
// Independent lathe model (kind=lathe). Uses ONLY input data from the product:
//  - MachineAccuracy.generate (seed -> XZ squareness, initial heights)
//  - LatheInspection.intrinsic (seed -> turret face/flat/hole intrinsic angles/offsets)
//  - IntrinsicInspection.fromProfile(...).runout.eccentricityMicrons/tiltMicroradians (input vectors only; TIR recomputed here)
// Dimensions/coordinates read from src/app.js (machine w=5,d=2.1, grid 3x2, part raw coordinates).
// Units: m for coordinates, mm for support heights, mm/m for slopes, µm for readings.
const MA=require('/home/user/Training-tools/src/machine-accuracy.js');
const LI=require('/home/user/Training-tools/src/lathe-inspection.js');
const II=require('/home/user/Training-tools/src/intrinsic-inspection.js');
const W=5,D=2.1,WIDTH=W*.8,DEPTH=D*.8; // levelConfig default -> scale 1
const xs=[-WIDTH/2,0,WIDTH/2],zs=[-DEPTH/2,DEPTH/2];
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>Math.hypot(...a),unit=a=>mul(a,1/norm(a));
// ---- support surface: bilinear on 3x2 grid + least-squares mean plane ----
function surface(h){ // h[j*3+i] at (xs[i],zs[j]), mm
 const P=[];for(let j=0;j<2;j++)for(let i=0;i<3;i++)P.push({x:xs[i],z:zs[j],h:h[j*3+i]});
 const n=P.length,mx=P.reduce((s,p)=>s+p.x,0)/n,mz=P.reduce((s,p)=>s+p.z,0)/n,mh=P.reduce((s,p)=>s+p.h,0)/n;
 let Sxx=0,Szz=0,Sxz=0,Sxh=0,Szh=0;for(const p of P){const x=p.x-mx,z=p.z-mz,q=p.h-mh;Sxx+=x*x;Szz+=z*z;Sxz+=x*z;Sxh+=x*q;Szh+=z*q;}
 const det=Sxx*Szz-Sxz*Sxz,a=(Sxh*Szz-Szh*Sxz)/det,b=(Szh*Sxx-Sxh*Sxz)/det,c=mh-a*mx-b*mz; // h ≈ a x + b z + c (mm; a,b mm/m)
 // cell: interior boundary x=0 belongs to the right cell (model convention); outside -> extend outer cell
 const cell=x=>x>=xs[1]?1:0;
 const at=(x,z)=>{const i=cell(x),dx=xs[i+1]-xs[i],dz=zs[1]-zs[0],u=(x-xs[i])/dx,v=(z-zs[0])/dz;
  const h00=h[i],h10=h[i+1],h01=h[3+i],h11=h[3+i+1];
  return {h:h00*(1-u)*(1-v)+h10*u*(1-v)+h01*(1-u)*v+h11*u*v,lr:((h10-h00)*(1-v)+(h11-h01)*v)/dx,fb:((h01-h00)*(1-u)+(h11-h10)*u)/dz};};
 return {a,b,c,at};
}
// rigid frame for a support gradient (mm/m): x-axis stays in the x-y plane, y = surface normal
function frame(lr,fb){const a=lr/1000,b=fb/1000,r=unit([1,a,0]),u=unit([-a,1,-b]),k=cross(r,u);return {cols:[r,u,k],apply:v=>add(add(mul(r,v[0]),mul(u,v[1])),mul(k,v[2]))};}
const compose=(A,B)=>{const cols=B.cols.map(c=>A.apply(c));return {cols,apply:v=>add(add(mul(cols[0],v[0]),mul(cols[1],v[1])),mul(cols[2],v[2]))};};
const transpose=F=>v=>F.cols.map(c=>dot(c,v));
const Ry=t=>({cols:[[Math.cos(t),0,-Math.sin(t)],[0,1,0],[Math.sin(t),0,Math.cos(t)]],apply(v){return add(add(mul(this.cols[0],v[0]),mul(this.cols[1],v[1])),mul(this.cols[2],v[2]));}});
// member seated at seat (x,z) on the support surface: common plane rotation C, then local residual slope F
function member(S,seat,intrinsic){
 const C=frame(S.a,S.b),q=S.at(seat[0],seat[2]),F=frame(q.lr-S.a,q.fb-S.b);
 let R=compose(C,F);if(intrinsic)R=compose(R,intrinsic);
 const res=q.h-(S.a*seat[0]+S.b*seat[2]+S.c);
 const origin=add(C.apply([seat[0],res/1000,seat[2]]),[0,.66+S.c/1000,0]);
 return {R,origin,map:rel=>add(origin,R.apply(rel))};
}
// Headstock (fixed, seat x=-W*.35, z=0). Intrinsic XZ squareness turns the spindle direction about +y.
function headstock(S,theta){const base=[-W*.35,.66,0],m=member(S,base,Ry(theta));return {...m,point:raw=>m.map(sub(raw,base)),base};}
// Carriage (Z moves seat along x, X slide translates along carriage-local z)
function carriage(S,state){const base=[.08,.66,.15],seat=[base[0]+.7*state.Z/100,.66,base[2]],m=member(S,seat,null);
 return {...m,point:raw=>m.map(add(sub(raw,base),[0,0,.35*state.X/100])),seat};}
const planeExt=(body,probe,P,n)=>dot(sub(P,body),n)/dot(probe,n);
function cylExt(body,probe,N,s,R){ // first external contact from body along probe; axis through N dir s
 const q=sub(body,N),qp=sub(q,mul(s,dot(q,s))),pp=sub(probe,mul(s,dot(probe,s)));
 const A=dot(pp,pp),B=2*dot(qp,pp),Cc=dot(qp,qp)-R*R,Dd=B*B-4*A*Cc;
 if(Cc<=0||Dd<0||A<1e-14)return {valid:false,reason:'no contact'};
 const e=2*Cc/(-B+Math.sqrt(Dd));const pt=add(body,mul(probe,e));
 return {valid:e>=0&&e<=.02,ext:e,axial:dot(sub(pt,N),s),point:pt,reason:e<0||e>.02?'stroke':''};
}
const clampStart=(pos,half,len)=>Math.max(-half,Math.min(half-len,pos)); // member position (m)
function compute(cfg,heights){
 const prof=MA.generate(cfg.condition,cfg.seed,['X','Z'],6),k=LI.intrinsic(prof),theta=prof.squareness.XZ.microns/.3e6;
 const S=surface(heights),H=headstock(S,theta),st={X:cfg.X,Z:cfg.Z};
 const xs0=clampStart(.35*st.X/100,.35,.3),zs0=clampStart(.7*st.Z/100,.7,.3);
 const Xst={...st,X:xs0/.35*100},Xen={...st,X:(xs0+.3)/.35*100},Zst={...st,Z:zs0/.7*100},Zen={...st,Z:(zs0+.3)/.7*100};
 const spindle=H.R.apply([1,0,0]),radial=H.R.apply([0,0,1]),up=H.R.apply([0,1,0]),nose=H.point([-W*.24+.125,1.5,0]);
 // turret faces (material points & local normals on the carriage/turret body)
 const front=[-.09,1.5,1],nF=[-Math.cos(k.face),0,-Math.sin(k.face)],flat=[.23,1.5,1.43],nZ=[Math.sin(k.flat),0,Math.cos(k.flat)];
 const face=(Pm,nl,s0,s1)=>{const K0=carriage(S,s0),K1=carriage(S,s1),P0=K0.point(Pm),n0=K0.R.apply(nl),P1=K1.point(Pm),n1=K1.R.apply(nl);
  return {P0,n0,P1,n1,K0,K1};};
 const fx=face(front,nF,Xst,Xen),fz=face(flat,nZ,Zst,Zen);
 // XZ flange: normal = spindle direction; turret translates along carriage-local z, from X upper to lower (product's zero end)
 const Kx=carriage(S,st),dX=Kx.R.apply([0,0,1]);
 // bore
 const Kh=carriage(S,{...st,X:-.20/.35*100}),hc=add(Kh.point([-.09,1.5,.20]),Kh.R.apply([0,k.holeY,k.holeX]));
 const c=sub(hc,nose),cr=dot(c,radial),cu=dot(c,up);
 // test bar mount (turret bracket at zStart, current X)
 const Km=carriage(S,Zst),Mw=Km.point([.08,1.5,.20]);
 const ru=II.fromProfile(prof).runout;
 return {prof,k,theta,S,H,st,Xst,Xen,Zst,Zen,spindle,radial,up,nose,fx,fz,dX,Kx,hc,cr,cu,Km,Mw,ru};
}
function runoutTIR(e,t,L){const c=[e[0]+t[0]*L/1000,e[1]+t[1]*L/1000];return 2*Math.hypot(...c);}
function boreReadings(cr,cu,R=.025){ // a=+radial(left from spindle looking at turret), b=up, c=-radial, d=-up
 const r=Math.hypot(cr,cu);if(r>=R)return null;
 return [[1,0],[0,1],[-1,0],[0,-1]].map(([p,q])=>{const t=p*cr+q*cu;return t+Math.sqrt(R*R-r*r+t*t);});
}
// --------- conditions A/B/C for one before/after pair ---------
function evaluate(cfg){
 const b=compute(cfg,cfg.before),a=compute(cfg,cfg.after),E=1e6,res={};
 // map a headstock-fixed point/vector from before-state to after-state (rigid bracket on headstock)
 const hsP=p=>a.H.map(b.H.R.cols.map(col=>dot(col,sub(p,b.H.origin)))),hsV=v=>a.H.R.apply(b.H.R.cols.map(col=>dot(col,v)));
 const kP=(Kb,Ka,p)=>Ka.map(Kb.R.cols.map(col=>dot(col,sub(p,Kb.origin)))),kV=(Kb,Ka,v)=>Ka.R.apply(Kb.R.cols.map(col=>dot(col,v)));
 // ---- turret faces, instrument on headstock ----
 for(const [key,fb,fa] of [['face',b.fx,a.fx],['flat',b.fz,a.fz]]){
  const bodyB=add(fb.P0,mul(fb.n0,.01)),probeB=mul(fb.n0,-1),zeroB=planeExt(bodyB,probeB,fb.P0,fb.n0);
  const endB=planeExt(bodyB,probeB,fb.P1,fb.n1);
  const bodyBa=add(fa.P0,mul(fa.n0,.01)),probeBa=mul(fa.n0,-1),endBa=planeExt(bodyBa,probeBa,fa.P1,fa.n1);
  const bodyA=hsP(bodyB),probeA=hsV(probeB),sA=planeExt(bodyA,probeA,fa.P0,fa.n0),eA=planeExt(bodyA,probeA,fa.P1,fa.n1);
  // contact location on the turret (carriage-local) at end of scan, after B
  const cp=add(bodyBa,mul(probeBa,endBa)),loc=fa.K1.R.cols.map(col=>dot(col,sub(cp,fa.K1.origin)));
  res[key]={before:{zeroExt:zeroB,endExt:endB,B:(zeroB-endB)*E},
   after:{B:{zeroExt:.01,endExt:endBa,microns:(.01-endBa)*E},
          A:{startExt:sA,endExt:eA,start:(zeroB-sA)*E,end:(zeroB-eA)*E,valid:[sA,eA].every(e=>e>=0&&e<=.02)},
          C:{startExt:sA,endExt:eA,microns:(sA-eA)*E}},
   endContactLocalAfter:loc};
 }
 // ---- XZ flange (directions only; contact position not defined by product) ----
 for(const [tag,s] of [['before',b],['after',a]]){
  const n=s.spindle,delta=mul(s.dX,-.3),probe=mul(n,-1),body=mul(n,.01),e0=planeExt(body,probe,[0,0,0],n),e1=planeExt(add(body,delta),probe,[0,0,0],n);
  res['xz_'+tag]={B:(e0-e1)*E,dot:dot(s.dX,n),angleErr05:-Math.asin(dot(s.dX,n))*1e6*.5,angleErr03:-Math.asin(dot(s.dX,n))*1e6*.3};
 }
 { // C: probe direction transported with carriage from before
  const pb=mul(b.spindle,-1),pC=kV(b.Kx,a.Kx,pb),n=a.spindle,delta=mul(a.dX,-.3),body=mul(n,.01),e0=planeExt(body,pC,[0,0,0],n),e1=planeExt(add(body,delta),pC,[0,0,0],n);
  res.xz_after.C=(e0-e1)*E;res.xz_after.A='条件不足';
 }
 // ---- bore ----
 const rb=boreReadings(b.cr,b.cu),ra=boreReadings(a.cr,a.cu);
 res.bore={before:{dx:b.cr*E,dy:b.cu*E,B:rb&&rb.map(v=>(rb[0]-v)*E)},
  after:{dx:a.cr*E,dy:a.cu*E,B:ra&&ra.map(v=>(ra[0]-v)*E),A:rb&&ra&&ra.map(v=>(rb[0]-v)*E)}};
 // ---- test bar (bar on spindle, dial bracket on turret) ----
 const L=2.2,Rb=.025;
 const bar=(s,dirKey)=>{const nrm=s[dirKey],cA=add(s.nose,mul(s.spindle,dot(sub(s.Mw,s.nose),s.spindle)));
  const body0=add(cA,mul(nrm,.035)),probe0=mul(nrm,-1);return {body0,probe0,bl:s.Km.R.cols.map(col=>dot(col,sub(body0,s.Km.origin))),pl:s.Km.R.cols.map(col=>dot(col,probe0))};};
 for(const dirKey of ['radial','up']){
  const out={};
  const ts=[...new Set([...Array.from({length:17},(_,i)=>i/16)])];
  const run=(s,heights,mnt)=>{ // mnt: bracket local coords relative to carriage frame (origin-based)
   const S=s.S,H=s.H;const rows=[];
   // add the support-cell boundary x=0 of the carriage seat (both sides)
   const zs0=.7*s.Zst.Z/100,tb=(0-(.08+zs0))/.3;const tt=[...ts];if(tb>0&&tb<1)tt.push(tb-1e-9,tb+1e-9);tt.sort((p,q)=>p-q);
   for(const t of tt){const K=carriage(S,{...s.Zst,Z:s.Zst.Z+(s.Zen.Z-s.Zst.Z)*t}),body=K.map(mnt.bl),probe=K.R.apply(mnt.pl);
    const c=cylExt(body,probe,s.nose,s.spindle,Rb);rows.push({t,...c,validAxial:c.axial>=0&&c.axial<=L});}
   return rows;};
  const mB=bar(b,dirKey),rowsB=run(b,cfg.before,mB);
  const mBa=bar(a,dirKey),rowsBa=run(a,cfg.after,mBa);
  const rowsA=run(a,cfg.after,mB); // same bracket (carriage-local) as before -> condition A/C
  const ok=r=>r.every(q=>q.valid&&q.validAxial);
  out.before={zeroExt:rowsB[0].ext,endExt:rowsB.at(-1).ext,B:(rowsB[0].ext-rowsB.at(-1).ext)*E,valid:ok(rowsB),axial:[rowsB[0].axial,rowsB.at(-1).axial]};
  out.after={B:{zeroExt:rowsBa[0].ext,endExt:rowsBa.at(-1).ext,microns:(rowsBa[0].ext-rowsBa.at(-1).ext)*E,valid:ok(rowsBa)},
   A:{startExt:rowsA[0].ext,endExt:rowsA.at(-1).ext,start:(rowsB[0].ext-rowsA[0].ext)*E,end:(rowsB[0].ext-rowsA.at(-1).ext)*E,valid:ok(rowsA)},
   C:{microns:(rowsA[0].ext-rowsA.at(-1).ext)*E}};
  res[dirKey==='radial'?'barSide':'barTop']=out;
 }
 // ---- runout (intrinsic, support independent) ----
 res.runout={root:runoutTIR(b.ru.eccentricityMicrons,b.ru.tiltMicroradians,0),tip:runoutTIR(b.ru.eccentricityMicrons,b.ru.tiltMicroradians,300),
  barTiltAt300:Math.hypot(...b.ru.tiltMicroradians)*.3};
 res.inputs={XZmicrons:b.prof.squareness.XZ.microns,intrinsic:b.k,initialHeights:b.prof.initialHeights,plane_before:{a:b.S.a,b:b.S.b,c:b.S.c},plane_after:{a:a.S.a,b:a.S.b,c:a.S.c},
  Xscan:[b.Xst.X,b.Xen.X],Zscan:[b.Zst.Z,b.Zen.Z]};
 return res;
}
module.exports={evaluate,compute,surface,frame};
if(require.main===module){console.log(JSON.stringify(evaluate(JSON.parse(process.argv[2])),null,1));}

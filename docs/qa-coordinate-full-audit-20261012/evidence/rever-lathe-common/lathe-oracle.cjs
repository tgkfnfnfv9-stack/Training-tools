'use strict';
// Independent re-verification model of the NC lathe (kind=lathe), written from the
// stated physical arrangement. Product calculation functions are NOT used.
// Allowed product inputs: seed -> profile (MachineAccuracy.generate: XZ squareness µm,
// initial heights), LatheInspection.intrinsic (seed -> turret face/flat/hole intrinsic),
// IntrinsicInspection.fromProfile(..).runout input vectors (eccentricity, tilt).
// Units: coordinates m, support heights mm, slopes mm/m, readings µm.
const MA=require('/home/user/Training-tools/src/machine-accuracy.js');
const LI=require('/home/user/Training-tools/src/lathe-inspection.js');
const II=require('/home/user/Training-tools/src/intrinsic-inspection.js');

const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>mul(a,1/Math.hypot(...a));

// Machine dims (src/app.js lathe w=5,d=2.1, grid 3x2). Support footprint width/depth
// can be changed by the user; default 4.0 x 1.68 m.
function machine(width=4,depth=1.68){
 const W=5,D=2.1,sx=width/(W*.8),sz=depth/(D*.8);
 const xs=[-width/2,0,width/2],zs=[-depth/2,depth/2];
 return {W,D,sx,sz,xs,zs,scale:p=>[p[0]*sx,p[1],p[2]*sz]};
}
// Least-squares plane through arbitrary points {x,z,h}: h = a x + b z + c (a,b mm/m)
function lsPlane(P){
 const n=P.length,mx=P.reduce((s,p)=>s+p.x,0)/n,mz=P.reduce((s,p)=>s+p.z,0)/n,mh=P.reduce((s,p)=>s+p.h,0)/n;
 let Sxx=0,Szz=0,Sxz=0,Sxh=0,Szh=0;for(const p of P){const x=p.x-mx,z=p.z-mz,q=p.h-mh;Sxx+=x*x;Szz+=z*z;Sxz+=x*z;Sxh+=x*q;Szh+=z*q;}
 const det=Sxx*Szz-Sxz*Sxz,a=(Sxh*Szz-Szh*Sxz)/det,b=(Szh*Sxx-Sxh*Sxz)/det;
 return {a,b,c:mh-a*mx-b*mz,at:(x,z)=>mh+a*(x-mx)+b*(z-mz)};
}
// Support sheet: bilinear on the 3x2 grid; h index j*3+i (j=0 front z<0).
function surface(M,h){
 const {xs,zs}=M,P=[];for(let j=0;j<2;j++)for(let i=0;i<3;i++)P.push({x:xs[i],z:zs[j],h:h[j*3+i]});
 const plane=lsPlane(P);
 const height=(x,z)=>{const i=x<xs[1]?0:1,u=(x-xs[i])/(xs[i+1]-xs[i]),v=(z-zs[0])/(zs[1]-zs[0]);
  return h[i]*(1-u)*(1-v)+h[i+1]*u*(1-v)+h[3+i]*(1-u)*v+h[4+i]*u*v;};
 // gradient at a point (one-cell; at x=0 exactly the right cell)
 const grad=(x,z)=>{const i=x<xs[1]?0:1,dx=xs[i+1]-xs[i],dz=zs[1]-zs[0],u=(x-xs[i])/dx,v=(z-zs[0])/dz;
  return {lr:((h[i+1]-h[i])*(1-v)+(h[4+i]-h[3+i])*v)/dx,fb:((h[3+i]-h[i])*(1-u)+(h[4+i]-h[i+1])*u)/dz};};
 return {plane,height,grad,points:P};
}
// Minimal rotation (Rodrigues) that tilts +y onto the normal of slope (lr,fb) mm/m.
function tilt(lr,fb){
 const n=unit([-lr/1000,1,-fb/1000]),k=[n[2],0,-n[0]],s=Math.hypot(...k),c=n[1];
 if(s<1e-18)return mat([[1,0,0],[0,1,0],[0,0,1]]);
 const K=unit(k),[x,y,z]=K,C=1-c;
 return mat([[c+x*x*C,x*y*C-z*s,x*z*C+y*s],[y*x*C+z*s,c+y*y*C,y*z*C-x*s],[z*x*C-y*s,z*y*C+x*s,c+z*z*C]]);
}
function mat(R){return {R,apply:v=>R.map(r=>dot(r,v)),T:v=>[0,1,2].map(j=>R[0][j]*v[0]+R[1][j]*v[1]+R[2][j]*v[2])};}
const mmul=(A,B)=>mat(A.R.map(r=>[0,1,2].map(j=>r[0]*B.R[0][j]+r[1]*B.R[1][j]+r[2]*B.R[2][j])));
const rotY=t=>mat([[Math.cos(t),0,Math.sin(t)],[0,1,0],[-Math.sin(t),0,Math.cos(t)]]); // [1,0,0]->[cos,0,-sin]

// Headstock: rigid casting seated at its single drawn seat (x=-0.35W, z=0).
function headstock(M,S,theta){
 const base=M.scale([-M.W*.35,.66,0]),g=S.grad(base[0],base[2]),R=mmul(tilt(g.lr,g.fb),rotY(theta));
 const origin=[base[0],.66+S.height(base[0],base[2])/1000,base[2]];
 return {R,origin,base,point:raw=>add(origin,R.apply(sub(M.scale(raw),base)))};
}
// Carriage: rigid 0.8 m saddle on two rails z=+/-0.4 m; 4 pads at centre +/-0.4 m.
// mode 'pads' (fixed spec) or 'seat' (old: single seat tangent) for comparison.
function carriage(M,S,st,mode='pads'){
 const base=M.scale([.08,.66,.15]),xc=M.scale([.08+.7*st.Z/100,0,0])[0],seat=[xc,.66,base[2]];
 let lr,fb,hseat;
 if(mode==='pads'){const P=[];for(const i of [-1,1])for(const k of [-1,1]){const q=M.scale([.08+.7*st.Z/100+i*.4,0,k*.4]);P.push({x:q[0],z:q[2],h:S.height(q[0],q[2])});}
  const pl=lsPlane(P);lr=pl.a;fb=pl.b;hseat=pl.at(seat[0],seat[2]);}
 else{const g=S.grad(seat[0],seat[2]);lr=g.lr;fb=g.fb;hseat=S.height(seat[0],seat[2]);}
 const R=tilt(lr,fb),origin=[seat[0],.66+hseat/1000,seat[2]],xTravel=M.scale([0,0,.35*st.X/100])[2];
 return {R,origin,lr,fb,hseat,point:raw=>add(origin,R.apply(add(sub(M.scale(raw),base),[0,0,xTravel]))),dir:v=>R.apply(v)};
}
// Plane contact: extension of probe from body along probe dir to plane (point P, normal n).
const planeExt=(body,probe,P,n)=>dot(sub(P,body),n)/dot(probe,n);
// Ray / finite cylinder: smallest non-negative t where |(body+t*probe - N) x s| = R.
function cylExt(body,probe,N,s,R,L){
 const q=sub(body,N),qa=sub(q,mul(s,dot(q,s))),pa=sub(probe,mul(s,dot(probe,s)));
 const A=dot(pa,pa),B=2*dot(qa,pa),C=dot(qa,qa)-R*R,D=B*B-4*A*C;
 if(C<=0)return {valid:false,reason:'inside-bar'};if(D<0||A<1e-14)return {valid:false,reason:'miss'};
 const r1=(-B-Math.sqrt(D))/(2*A),r2=(-B+Math.sqrt(D))/(2*A),t=r1>=0?r1:r2;
 // numerically stable variant of the near root
 const t2=(2*C)/(-B+Math.sqrt(D));
 const e=Math.abs(t-t2)<1e-9?t2:t;
 if(!(e>=0&&e<=.02))return {valid:false,reason:'stroke',ext:e};
 const axial=dot(sub(add(body,mul(probe,e)),N),s);if(axial<0||axial>L)return {valid:false,reason:'bar-length',ext:e,axial};
 return {valid:true,ext:e,axial};
}
function profileFor(seed,condition='used'){return MA.generate(condition,seed,['X','Z'],6);}

// Full independent evaluation. opts.mode: 'pads'|'seat'. opts.width/depth.
function evaluate({seed,condition='used',heights,X=0,Z=0,mode='pads',width=4,depth=1.68}){
 const M=machine(width,depth),prof=profileFor(seed,condition),k=LI.intrinsic(prof),theta=prof.squareness.XZ.microns/.3e6;
 const S=surface(M,heights),H=headstock(M,S,theta),car=st=>carriage(M,S,st,mode);
 const L=.3,xHalf=.35*M.sz,zHalf=.7*M.sx;
 const validX=2*xHalf>=L-1e-12,validZ=2*zHalf>=L-1e-12;
 const x0=Math.max(-xHalf,Math.min(xHalf-L,X/100*xHalf)),z0=Math.max(-zHalf,Math.min(zHalf-L,Z/100*zHalf));
 const Xs={X:x0/xHalf*100,Z},Xe={X:(x0+L)/xHalf*100,Z},Zs={X,Z:z0/zHalf*100},Ze={X,Z:(z0+L)/zHalf*100};
 const axis=H.R.apply([1,0,0]),radial=H.R.apply([0,0,1]),up=H.R.apply([0,1,0]),nose=H.point([-M.W*.24+.125,1.5,0]);
 // --- turret X face (front) and Z outer flat; dial world/headstock fixed; zero at start, aligned to start normal
 const faceScan=(raw,nLocal,s0,s1)=>{const c0=car(s0),c1=car(s1),P0=c0.point(raw),n0=c0.dir(nLocal),P1=c1.point(raw),n1=c1.dir(nLocal);
  const body=add(P0,mul(n0,.01)),probe=mul(n0,-1);return {P0,n0,P1,n1,body,probe,e0:planeExt(body,probe,P0,n0),e1:planeExt(body,probe,P1,n1)};};
 const nF=[-Math.cos(k.face),0,-Math.sin(k.face)],nZ=[Math.sin(k.flat),0,Math.cos(k.flat)];
 const fX=faceScan([-.09,1.5,1],nF,Xs,Xe),fZ=faceScan([.23,1.5,1.43],nZ,Zs,Ze);
 const face=validX?(fX.e0-fX.e1)*1e6:null,flat=validZ?(fZ.e0-fZ.e1)*1e6:null;
 // --- bore: holder at fixed nominal X centre (-0.20 m), current Z; rotating indicator on spindle axis
 const ch=car({X:-.20/.35*100,Z}),hc=add(ch.point([-.09,1.5,.20]),ch.dir([0,k.holeY,k.holeX])),d=sub(hc,nose);
 const dz=dot(d,radial),dy=dot(d,up); // dz: +internal z (back) = left when looking spindle->turret
 const R=.025,o=[dz,dy],r2=dz*dz+dy*dy;
 const dirs=[[1,0],[0,1],[-1,0],[0,-1]]; // a=left(+z), b=up, c=right(-z), d=down
 const ext=u=>{const t=u[0]*o[0]+u[1]*o[1];return t+Math.sqrt(R*R-r2+t*t);};
 const boreReadings=Math.sqrt(r2)<R?dirs.map(u=>(ext(dirs[0])-ext(u))*1e6):null;
 // --- test bar parallelism (product-assumed fixture: bar phi50 on spindle, 2.2 m from nose; bracket at carriage material point)
 const barLength=M.scale([M.W*.225-(-M.W*.24+.125),0,0])[0];
 const mountRaw=[.08,1.5,.20];
 const barScan=normal=>{
  if(!validZ)return {valid:false};
  const c0=car(Zs),m0=c0.point(mountRaw),foot=add(nose,mul(axis,dot(sub(m0,nose),axis)));
  const body0=add(foot,mul(normal,.035)),probe0=mul(normal,-1);
  const bl=c0.R.T(sub(body0,m0)),pl=c0.R.T(probe0);
  const at=st=>{const c=car(st),m=c.point(mountRaw),body=add(m,c.R.apply(bl)),probe=c.R.apply(pl);return {body,probe,...cylExt(body,probe,nose,axis,.025,barLength)};};
  // dense sampling incl. pad boundary crossings
  const ts=[];for(let i=0;i<=64;i++)ts.push(i/64);
  const S0=at(Zs),S1=at(Ze),mid=ts.map(t=>at({X,Z:Zs.Z+(Ze.Z-Zs.Z)*t}));
  const bad=mid.find(s=>!s.valid);
  return {valid:!bad&&S0.valid&&S1.valid,reason:bad?.reason,microns:S0.valid&&S1.valid?(S0.ext-S1.ext)*1e6:null,e0:S0.ext,e1:S1.ext,axial0:S0.axial,axial1:S1.axial,bl,pl,mount:m0};
 };
 const side=barScan(radial),top=barScan(up);
 // --- spindle-based XZ: angle between carriage X direction and spindle Z direction
 const cNow=car({X,Z}),xDir=cNow.dir([0,0,1]),cosXZ=dot(xDir,axis),xzMicroradians=-Math.asin(cosXZ)*1e6;
 // runout: TIR of an ideal bar = 2|e + tilt*L| from input vectors
 const ru=II.fromProfile(prof).runout,tir=L=>2*Math.hypot(...ru.eccentricityMicrons.map((v,i)=>v+ru.tiltMicroradians[i]*L/1000));
 return {face,flat,dx:dz*1e6,dy:dy*1e6,bore:boreReadings,barSide:side.valid?side.microns:null,barTop:top.valid?top.microns:null,side,top,xzMicroradians,
  runout:{root:tir(0),tip:tir(300)},carriage:{lr:cNow.lr,fb:cNow.fb,h:cNow.hseat},head:{origin:H.origin},nose,hole:hc,Xs,Xe,Zs,Ze,barLength,
  _internal:{M,S,H,car,fX,fZ,nF,nZ,k}};
}
// Conditions A / C: instruments installed (B) at state s0 (heights h0), then supports changed to h1
// without touching the instruments. Dial for turret face/flat is fixed to the HEADSTOCK; test-bar dial
// is fixed to the CARRIAGE bracket. Readings are reported relative to the original zero (A) and after
// re-zeroing at the start with the same mounting (C).
function conditionAC({seed,condition='used',h0,h1,X=0,Z=0,mode='pads'}){
 const e0=evaluate({seed,condition,heights:h0,X,Z,mode}),e1=evaluate({seed,condition,heights:h1,X,Z,mode});
 const I0=e0._internal,I1=e1._internal,out={};
 const H0=I0.H,H1=I1.H,toHead0=p=>H0.R.T(sub(p,H0.origin)),fromHead1=v=>add(H1.origin,H1.R.apply(v)),dirHead=v=>H1.R.apply(H0.R.T(v));
 for(const [key,f0,raw,nl,s0,s1] of [['face',I0.fX,[-.09,1.5,1],I0.nF,e0.Xs,e0.Xe],['flat',I0.fZ,[.23,1.5,1.43],I0.nZ,e0.Zs,e0.Ze]]){
  const body=fromHead1(toHead0(f0.body)),probe=dirHead(f0.probe);
  const ca=I1.car(s0),cb=I1.car(s1),ea=planeExt(body,probe,ca.point(raw),ca.dir(nl)),eb=planeExt(body,probe,cb.point(raw),cb.dir(nl));
  out[key]={zeroExtension_mm:f0.e0*1e3,A_startExtension_mm:ea*1e3,A_endExtension_mm:eb*1e3,A_start:(f0.e0-ea)*1e6,A_end:(f0.e0-eb)*1e6,C:(ea-eb)*1e6,B_before:e0[key],B_after:e1[key],
   A_end_int:Math.round(Math.abs((f0.e0-eb)*1e6))*Math.sign((f0.e0-eb)*1e6),B_after_int:e1[key]==null?null:Math.round(Math.abs(e1[key]))*Math.sign(e1[key])};
 }
 for(const key of ['side','top']){
  const s=e0[key];if(!s.valid){out['bar'+key]={valid:false,reason:'B invalid before'};continue;}
  const at=st=>{const c=I1.car(st),m=c.point([.08,1.5,.20]),body=add(m,c.R.apply(s.bl)),probe=c.R.apply(s.pl);const ax=e1._internal.H.R.apply([1,0,0]);return cylExt(body,probe,e1.nose,ax,.025,e1.barLength);};
  const a=at(e0.Zs),b=at(e0.Ze);
  out['bar_'+key]={zeroExtension_mm:s.e0*1e3,A_startExtension_mm:a.valid?a.ext*1e3:null,A_endExtension_mm:b.valid?b.ext*1e3:null,A_validity:[a.valid?'ok':a.reason,b.valid?'ok':b.reason],A_start:a.valid?(s.e0-a.ext)*1e6:null,A_end:b.valid?(s.e0-b.ext)*1e6:null,C:a.valid&&b.valid?(a.ext-b.ext)*1e6:null,B_before:s.microns,B_after:e1[key].microns};
 }
 // bore: indicator rides on spindle; zero kept at original a
 if(e0.bore&&e1.bore){
  const R=.025,ext=(o,u)=>{const t=u[0]*o[0]+u[1]*o[1];return t+Math.sqrt(R*R-o[0]*o[0]-o[1]*o[1]+t*t);};
  const o0=[e0.dx/1e6,e0.dy/1e6],o1=[e1.dx/1e6,e1.dy/1e6],dirs=[[1,0],[0,1],[-1,0],[0,-1]],za=ext(o0,dirs[0]);
  out.bore={A:dirs.map(u=>(za-ext(o1,u))*1e6),C_equals_B:e1.bore,B_before:e0.bore};
 }
 return out;
}
module.exports={evaluate,conditionAC,profileFor,surface,machine,tilt};

'use strict';
// Independent oracle for horizontal (Haas EC-630, kind=horizontal).
// Uses ONLY: dimensions, support grid, support heights, seed -> MachineAccuracy.generate (input data).
// Does NOT call geometryModel / horizontal*Point / referenceScan / horizontalParallelism / Leveling.*.
// World frame W: x right, y up, z back (toward column). Lengths in metres, heights in mm.

// ---------- vector helpers ----------
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>Math.hypot(...a),unit=a=>mul(a,1/norm(a));
// 3x3 matrices as arrays of rows
const mv=(M,v)=>M.map(r=>dot(r,v));
const mT=M=>[0,1,2].map(j=>[0,1,2].map(i=>M[i][j]));
const mm=(A,B)=>A.map(r=>[0,1,2].map(j=>r[0]*B[0][j]+r[1]*B[1][j]+r[2]*B[2][j]));
const I3=[[1,0,0],[0,1,0],[0,0,1]];
// Minimal (tilt-only) rotation taking unit a to unit b (Rodrigues).
function rotFromTo(a,b){
 const v=cross(a,b),c=dot(a,b),K=[[0,-v[2],v[1]],[v[2],0,-v[0]],[-v[1],v[0],0]],K2=mm(K,K),f=1/(1+c);
 return I3.map((r,i)=>r.map((q,j)=>q+K[i][j]+K2[i][j]*f));
}

// ---------- model definition (read from src as *definition*, not results) ----------
const W=3.4,D=4.6;                    // app.js machines[horizontal] w,d
const width=W*.8,depth=D*.8;          // default levelConfig width/depth -> scale 1
const xs=[-width/2,width/2];
const zs=[0,1,2,3].map(j=>(j/3-.5)*depth); // grid [2,4]; index = j*2+i
const DATUM=.66;                      // bed support datum height (m)
const COLUMN_Z=D*.29;                 // column seat (columnZ=0)
const COLUMN_X0=0;                    // columnX=0
const NOSE=[0,2.55,-.93];             // spindle nose material point (nominal)
const PALLET_SEAT_Z=-.85;             // pallet seat nominal z
const PALLET_TOP=[0,1.27,-.85];       // pallet top datum material point
const AMP={X:.55,Y:.3,Z:.45};         // axis amplitudes (m at 100 %)

// ---------- support surface ----------
function surface(heights){
 if(heights.length!==8)throw new Error('8 heights');
 const H=(i,j)=>heights[j*2+i];
 const cellZ=z=>{let j=0;while(j<zs.length-2&&z>=zs[j+1])j++;return j;};
 const at=(x,z)=>{
  const j=cellZ(z),dx=xs[1]-xs[0],dz=zs[j+1]-zs[j],u=(x-xs[0])/dx,v=(z-zs[j])/dz;
  const h00=H(0,j),h10=H(1,j),h01=H(0,j+1),h11=H(1,j+1);
  const h=h00*(1-u)*(1-v)+h10*u*(1-v)+h01*(1-u)*v+h11*u*v;
  const hx=((h10-h00)*(1-v)+(h11-h01)*v)/dx,hz=((h01-h00)*(1-u)+(h11-h10)*u)/dz; // mm/m
  return {h,hx,hz,cell:j};
 };
 // Least-squares mean plane (reported only; posture uses the full surface gradient)
 const pts=heights.map((h,k)=>({x:xs[k%2],z:zs[Math.floor(k/2)],h}));
 const n=pts.length,mx=pts.reduce((s,p)=>s+p.x,0)/n,mz=pts.reduce((s,p)=>s+p.z,0)/n,mh=pts.reduce((s,p)=>s+p.h,0)/n;
 let xx=0,zz=0,xz=0,xh=0,zh=0;for(const p of pts){const X=p.x-mx,Z=p.z-mz,Hh=p.h-mh;xx+=X*X;zz+=Z*Z;xz+=X*Z;xh+=X*Hh;zh+=Z*Hh;}
 const det=xx*zz-xz*xz,a=(xh*zz-zh*xz)/det,b=(zh*xx-xh*xz)/det;
 return {at,plane:{lr:a,fb:b,c:mh-a*mx-b*mz}};
}
// Seat pose of a rigid member resting on the surface at (x,z): origin and tilt rotation.
function seat(S,x,z){
 const q=S.at(x,z),a=q.hx/1000,b=q.hz/1000,n=unit([-a,1,-b]);
 return {P:[x,DATUM+q.h/1000,z],R:rotFromTo([0,1,0],n),q};
}

// ---------- intrinsic axis directions from squareness (input data) ----------
// Convention (as defined by the product's data): angle(i,j)=90deg+eps_ij, eps=microns/300 mm.
// X = e_x. Y in the x-y plane. Z solved from dot(X,Z)=-sin eps_XZ, dot(Y,Z)=-sin eps_YZ.
function intrinsic(sq){
 const e=k=>sq[k].microns/300000;
 const X=[1,0,0],Y=[-Math.sin(e('XY')),Math.cos(e('XY')),0];
 const zx=-Math.sin(e('XZ')),zy=(-Math.sin(e('YZ'))-zx*Y[0])/Y[1],Z=[zx,zy,Math.sqrt(1-zx*zx-zy*zy)];
 return {X,Y,Z,Rb:rotFromTo([0,1,0],Y)};
}

// ---------- kinematics ----------
// Pallet carriage: seat follows the surface at (0,-.85+s); its in-seat displacement is s*Zint
// (nominal part s*e_z realized by sliding the seat).  Frame F_p = R_seat.
function pallet(S,ax,st){
 const s=AMP.Z*st.Z/100,se=seat(S,0,PALLET_SEAT_Z+s);
 const origin=add(se.P,mv(se.R,mul(sub(ax.Z,[0,0,1]),s)));
 const toWorld=local=>add(origin,mv(se.R,local)); // local relative to nominal seat base [0,.66,-.85]
 const top=toWorld(sub(PALLET_TOP,[0,DATUM,PALLET_SEAT_Z]));
 return {F:se.R,top,origin,cell:se.q.cell};
}
// Column+head: column seat at (X travel, D*.29); head body rotated by Rb (intrinsic XY) inside column;
// Y travel along column-frame Yint.  Head frame F_h = R_col*Rb.
function head(S,ax,st){
 const xc=COLUMN_X0+AMP.X*st.X/100,se=seat(S,xc,COLUMN_Z),dY=AMP.Y*st.Y/100;
 const r=sub(NOSE,[0,DATUM,COLUMN_Z]);
 const nose=add(se.P,mv(se.R,add(mv(ax.Rb,r),mul(ax.Y,dY))));
 return {F:mm(se.R,ax.Rb),Fc:se.R,nose,cell:se.q.cell};
}
// Attach a world point/direction to a member at a reference pose and transport it.
const attachPoint=(pose,origin,w)=>mv(mT(pose.F),sub(w,origin));
const placePoint=(pose,origin,l)=>add(origin,mv(pose.F,l));
const attachDir=(pose,w)=>mv(mT(pose.F),w),placeDir=(pose,l)=>mv(pose.F,l);

// Plane contact: probe ray from body B along p hits plane (Q,n).
function planeContact(B,p,Q,n){const den=dot(n,p),ext=dot(n,sub(Q,B))/den;return {ext,point:add(B,mul(p,ext)),valid:Number.isFinite(ext)&&ext>=0&&ext<=.02};}
// Cylinder contact: axis unit a through O, radius r.
function cylContact(B,p,O,a,r){
 const rad=v=>sub(v,mul(a,dot(v,a))),u=rad(p),v=rad(sub(B,O)),A=dot(u,u),Bq=2*dot(u,v),C=dot(v,v)-r*r,disc=Bq*Bq-4*A*C;
 if(disc<0)return {valid:false,reason:'miss'};
 const t=(-Bq-Math.sqrt(disc))/(2*A),pt=add(B,mul(p,t));
 return {ext:t,point:pt,axial:dot(sub(pt,O),a),valid:t>=0&&t<=.02};
}
// Scan start (clamped so 300 mm fits), as a nominal travel in metres.
const startOf=(key,st)=>{const half=AMP[key];return Math.max(-half,Math.min(half-.3,st[key]*half/100));};
const posOf=(key,m)=>m/AMP[key]*100;
// secant solve f(phi)=0 (f is ~linear)
function solve(f){let a=0,b=1e-4,fa=f(a),fb=f(b);for(let k=0;k<40&&Math.abs(fb)>1e-15;k++){const c=b-fb*(b-a)/(fb-fa);a=b;fa=fb;b=c;fb=f(b);}return b;}

// ---------- squareness measurements ----------
// Every function returns {mount, zeroExt, ...}. mount = member-local definitions (master on pallet,
// dial on head) so that A/C can reuse them after a support change.
const MASTER_LOCAL={XY:[-.15,.05,0],XZ:[-.15,.05,.16],YZ:[0,.37,.15]}; // product's assumed corner offsets from pallet top, pallet frame

function alignAndMount(key,S,ax,st){
 const sY=startOf('Y',st),st0={...st,Y:posOf('Y',sY)}; // scan start state (Y) for XY/YZ; XZ keeps Y
 if(key==='XY'||key==='XZ'){
  const stS=key==='XY'?st0:{...st,Z:posOf('Z',startOf('Z',st))}; // state at S-scan start
  const xb=startOf('X',st),stR0={...stS,X:posOf('X',xb)},stR1={...stS,X:posOf('X',xb+.3)};
  const P=pallet(S,ax,stR0),c=MASTER_LOCAL[key];
  // master local axes as function of in-plane angle phi (pallet frame)
  const geo=phi=>key==='XY'
   ?{u:[Math.cos(phi),Math.sin(phi),0],nR:[-Math.sin(phi),Math.cos(phi),0]}      // rotate about pallet z; R face normal ~up
   :{u:[Math.cos(phi),0,-Math.sin(phi)],nR:[Math.sin(phi),0,Math.cos(phi)]};     // rotate about pallet y; R face normal ~+z
  const cornerW=placePoint(P,P.top,c);
  // R dial: body 10 mm off the R face along nominal face normal, probe toward face; fixed to head at stR0
  const nR0=placeDir(P,key==='XY'?[0,1,0]:[0,0,1]);
  const bodyR=key==='XY'?sub(cornerW,mul(nR0,.01)):add(cornerW,mul(nR0,.01)),probeR=key==='XY'?nR0:mul(nR0,-1);
  const H0=head(S,ax,stR0),H1=head(S,ax,stR1),bL=attachPoint(H0,H0.nose,bodyR),pL=attachDir(H0,probeR);
  const Rread=(phi,H)=>{const g=geo(phi),n=placeDir(P,g.nR);return planeContact(placePoint(H,H.nose,bL),placeDir(H,pL),cornerW,n);};
  const phi=solve(ph=>Rread(ph,H1).ext-Rread(ph,H0).ext),g=geo(phi);
  const r0=Rread(phi,H0),r1=Rread(phi,H1),alongR=dot(sub(r1.point,cornerW),placeDir(P,g.u));
  // S face: plane through corner+0.31u, normal u (pallet-local).  Dial start point 10 mm from corner line.
  const Qloc=add(c,mul(g.u,.31)),nloc=g.u;
  const Hs=head(S,ax,stS),Ps=pallet(S,ax,stS);
  const Qw=placePoint(Ps,Ps.top,Qloc),nw=placeDir(Ps,nloc),off=key==='XY'?placeDir(Ps,g.nR):mul(placeDir(Ps,g.nR),-1);
  const startPt=add(Qw,mul(off,.01)),body=add(startPt,mul(nw,.01)),probe=mul(nw,-1);
  return {key,phi,alignment:{zeroExt:r0.ext,endExt:r1.ext,alongEnd_mm:alongR*1e3,valid:r0.valid&&r1.valid},
   master:{Qloc,nloc,uRloc:g.nR,corner:c},dial:{bL:attachPoint(Hs,Hs.nose,body),pL:attachDir(Hs,probe)},stS};
 }
 // YZ: R = top face, aligned by Z feed with head static; S = spindle-side vertical face, Y scan.
 const zb=startOf('Z',st),stR0={...st0,Z:posOf('Z',zb)},stR1={...st0,Z:posOf('Z',zb+.3)},c=MASTER_LOCAL.YZ;
 const geo=phi=>({mS:[0,Math.sin(phi),Math.cos(phi)],mR:[0,Math.cos(phi),-Math.sin(phi)]}); // rotate about pallet x
 const H=head(S,ax,stR0),P0=pallet(S,ax,stR0),P1=pallet(S,ax,stR1);
 const cornerW0=placePoint(P0,P0.top,c),up0=placeDir(P0,[0,1,0]);
 const bodyR=add(cornerW0,mul(up0,.01)),probeR=mul(up0,-1); // fixed to the (static) head
 const Rread=(phi,P)=>planeContact(bodyR,probeR,placePoint(P,P.top,c),placeDir(P,geo(phi).mR));
 const phi=solve(ph=>Rread(ph,P1).ext-Rread(ph,P0).ext),g=geo(phi);
 const r0=Rread(phi,P0),r1=Rread(phi,P1);
 const alongR=dot(mv(mT(P1.F),sub(r1.point,placePoint(P1,P1.top,c))),g.mS);
 const Qloc=add(c,mul(g.mS,.01)),nloc=g.mS;
 const Hs=head(S,ax,st0),Ps=pallet(S,ax,st0);
 const startPt=add(placePoint(Ps,Ps.top,Qloc),mul(placeDir(Ps,g.mR),-.31)),nw=placeDir(Ps,nloc),body=add(startPt,mul(nw,.01)),probe=mul(nw,-1);
 return {key,phi,alignment:{zeroExt:r0.ext,endExt:r1.ext,alongEnd_mm:alongR*1e3,valid:r0.valid&&r1.valid},
  master:{Qloc,nloc,uRloc:g.mR,corner:c},dial:{bL:attachPoint(Hs,Hs.nose,body),pL:attachDir(Hs,probe)},stS:st0};
}
// Read the S face with a given mount at scan fraction t (0 start, 1 end)
function readS(mount,S,ax,t){
 const st=mount.stS,key=mount.key,scan=key==='XZ'?'Z':'Y',s0=startOf(scan,st),stt={...st,[scan]:posOf(scan,s0+.3*t)};
 const P=pallet(S,ax,stt),H=head(S,ax,stt),Q=placePoint(P,P.top,mount.master.Qloc),n=placeDir(P,mount.master.nloc);
 const B=placePoint(H,H.nose,mount.dial.bL),p=placeDir(H,mount.dial.pL),c=planeContact(B,p,Q,n);
 // face coordinates of the contact (pallet local, relative to corner): along the R normal direction / along S-plane
 const l=mv(mT(P.F),sub(c.point,P.top)),rel=sub(l,mount.master.corner);
 return {...c,faceAlong_mm:dot(rel,mount.master.uRloc)*1e3,faceNormal_mm:dot(rel,mount.master.nloc)*1e3,palletCell:P.cell,headCell:H.cell};
}

// ---------- Z parallelism (product-assumed bar: 320 mm, r=25 mm, origin 310 mm in front of the nose) ----------
function parallelMount(S,ax,st){
 const z0=startOf('Z',st),st0={...st,Z:posOf('Z',z0)},H=head(S,ax,st0),P=pallet(S,ax,st0);
 const axis=placeDir(H,[0,0,1]); // = R_col*Rb*e_z (product assumption: spindle axis = head-frame z)
 const O=sub(H.nose,mul(axis,.31)),right=placeDir(H,[1,0,0]),up=placeDir(H,[0,1,0]);
 const bar={OL:attachPoint(H,H.nose,O),aL:attachDir(H,axis),r:.025};
 const dial=dir=>{const B=sub(O,mul(dir,.035));return {bL:attachPoint(P,P.top,B),pL:attachDir(P,dir)};};
 return {st0,bar,a:dial(right),b:dial(up)};
}
function readParallel(mount,which,S,ax,t){
 const st={...mount.st0,Z:posOf('Z',startOf('Z',mount.st0)+.3*t)},H=head(S,ax,st),P=pallet(S,ax,st);
 const O=placePoint(H,H.nose,mount.bar.OL),a=placeDir(H,mount.bar.aL),d=mount[which];
 const c=cylContact(placePoint(P,P.top,d.bL),placeDir(P,d.pL),O,a,mount.bar.r);
 return {...c,axial_mm:c.axial*1e3,palletCell:P.cell};
}

module.exports={surface,intrinsic,pallet,head,alignAndMount,readS,parallelMount,readParallel,startOf,zs,xs};

'use strict';
// Independent physical oracle for the compact vertical machine (kind=compact).
// Uses ONLY: machine dimensions / support coordinates / support heights / axis
// positions and the intrinsic squareness microns (input data). All support
// surfaces, member postures, contacts and the plate bending are implemented here.
// Units: positions m, heights mm, slopes mm/m (=mrad), readings um.
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],norm=a=>Math.hypot(...a),unit=a=>mul(a,1/norm(a));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

// ---- machine definition (read from src/app.js as model definition) ----
const W=2.6,Dm=2.7;
const CFG={width:W*.8,depth:Dm*.8};            // 2.08 x 2.16 m support rectangle
const A=CFG.width/2,B=CFG.depth/2;              // half spans 1.04, 1.08
const SUPPORTS=[[-A,-B],[A,-B],[-A,B],[A,B]];   // LF, RF, LB, RB  (x right, z back)
const DATUM_Y=.66;                              // support datum height of base top
const TOOL_SEAT=[0,Dm*.29];                     // column seat (x,z)  columnX=columnZ=0
const SADDLE_Z0=-Dm*.1;                         // saddle seat z at Y=0
const AMP={X:.45,Y:.4,Z:.3};                    // half travels (m) for slider +-100
const TABLE_TOP_ABOVE_DATUM=.50;                // product's table point P (1.16-0.66)
const NOSE_REL=[0,1.98-DATUM_Y,-.3-Dm*.29];     // spindle nose rel. to column seat at Z=0
const SWEEP_R=.15;                              // product's assumed sweep radius
const TABLE_HALF=[W*.78/2,Dm*.42/2];

// ---- 2-mode Ritz plate (own implementation, midpoint integration) ----
let ritzCache=null;
function ritz(){
 if(ritzCache)return ritzCache;
 const alpha=.5,nu=.3,N=600,a=A,b=B;
 // physical curvatures [wxx,wzz,wxz] per unit amplitude for modes 0(XZ),1,3
 const curv=(X,Z)=>[[0,0,1/(a*b)],[-2*Z/(a*a),0,-2*X/(a*b)],[-2*Z**3/(a*a),6*Z*(1-X*X)/(b*b),-6*X*Z*Z/(a*b)]];
 const inner=(p,q)=>p[0]*q[0]+p[1]*q[1]+nu*(p[0]*q[1]+p[1]*q[0])+2*(1-nu)*p[2]*q[2];
 const K=[[0,0],[0,0]],f=[0,0],h=2/N;
 for(let i=0;i<N;i++)for(let j=0;j<N;j++){
  const X=-1+(i+.5)*h,Z=-1+(j+.5)*h,c=curv(X,Z),w=(1+alpha*X)*h*h*a*b;
  for(let m=0;m<2;m++){f[m]+=w*inner(c[m+1],c[0]);for(let n=0;n<2;n++)K[m][n]+=w*inner(c[m+1],c[n+1]);}
 }
 // minimise 1/2 q'Kq + q'f t  ->  q = -K^-1 f t
 const det=K[0][0]*K[1][1]-K[0][1]*K[1][0];
 ritzCache=[-(K[1][1]*f[0]-K[0][1]*f[1])/det,-(-K[1][0]*f[0]+K[0][0]*f[1])/det];
 return ritzCache;
}
function surface(h,{bending=true}={}){
 const [h00,h10,h01,h11]=h,t=(h00+h11-h10-h01)/4,[c1,c3]=bending?ritz():[0,0],q1=c1*t,q3=c3*t;
 const height=(x,z)=>{const u=(x+A)/(2*A),v=(z+B)/(2*B),X=x/A,Z=z/B;
  return h00*(1-u)*(1-v)+h10*u*(1-v)+h01*(1-u)*v+h11*u*v+(1-X*X)*(q1*Z+q3*Z**3);};
 const slope=(x,z)=>{const u=(x+A)/(2*A),v=(z+B)/(2*B),X=x/A,Z=z/B;
  return [((h10-h00)*(1-v)+(h11-h01)*v)/(2*A)-2*X/A*(q1*Z+q3*Z**3),((h01-h00)*(1-u)+(h11-h10)*u)/(2*B)+(1-X*X)*(q1+3*q3*Z*Z)/B];};
 return {height,slope,t,q1,q3};
}
// Least-squares plane through the supports (own normal equations)
function lsPlane(h){
 const n=4;let sx=0,sz=0,sh=0;SUPPORTS.forEach(([x,z],i)=>{sx+=x;sz+=z;sh+=h[i];});
 const xm=sx/n,zm=sz/n,hm=sh/n;let xx=0,zz=0,xz=0,xh=0,zh=0;
 SUPPORTS.forEach(([x,z],i)=>{const X=x-xm,Z=z-zm,H=h[i]-hm;xx+=X*X;zz+=Z*Z;xz+=X*Z;xh+=X*H;zh+=Z*H;});
 const det=xx*zz-xz*xz,a=(xh*zz-zh*xz)/det,b=(zh*xx-xh*xz)/det;
 return {a,b,c:hm-a*xm-b*zm};
}
function planeHeights(h){const p=lsPlane(h);return SUPPORTS.map(([x,z])=>p.a*x+p.b*z+p.c);}
// Seating rotation: minimal rotation that takes world up to the surface normal.
function seatRotation(s){
 const n=unit([-s[0]/1000,1,-s[1]/1000]),e=[0,1,0],ax=cross(e,n),sn=norm(ax),c=dot(e,n);
 if(sn<1e-18)return {m:[[1,0,0],[0,1,0],[0,0,1]],apply:v=>[...v],inv:v=>[...v]};
 const k=mul(ax,1/sn),rod=(v,s_)=>{const kv=cross(k,v),kd=dot(k,v);return v.map((q,i)=>q*c+kv[i]*s_+k[i]*kd*(1-c));};
 return {apply:v=>rod(v,sn),inv:v=>rod(v,-sn)};
}
// Intrinsic axis directions from squareness microns over 300 mm (input data)
function intrinsic(sq){
 const th=k=>sq[k]/300000,X=[1,0,0],Y=[-Math.sin(th('XY')),0,Math.cos(th('XY'))];
 const zx=-Math.sin(th('XZ')),zz=(-Math.sin(th('YZ'))-zx*Y[0])/Y[2];
 return {X,Y,Z:[zx,Math.sqrt(1-zx*zx-zz*zz),zz]};
}
// ---- machine state -> member maps ----
function machine(h,sq,opt={}){
 const S=surface(h,opt),I=intrinsic(sq);
 const seatPoint=(x,z)=>[x,DATUM_Y+S.height(x,z)/1000,z];
 const saddle=st=>{const zs=SADDLE_Z0+AMP.Y*st.Y/100,R=seatRotation(S.slope(0,zs)),O=seatPoint(0,zs),travel=AMP.Y*st.Y/100,xt=AMP.X*st.X/100;
  // table material point with local offset q (relative to saddle seat, table at X=Y=0)
  const local=q=>add(add(q,[xt,0,0]),mul(sub(I.Y,[0,0,1]),travel));
  return {R,O,zs,toWorld:q=>add(O,R.apply(local(q))),dirToWorld:v=>R.apply(v),
   toLocal:p=>sub(sub(R.inv(sub(p,O)),[xt,0,0]),mul(sub(I.Y,[0,0,1]),travel)),dirToLocal:v=>R.inv(v)};};
 const RT0=seatRotation(S.slope(...TOOL_SEAT)),OT=seatPoint(...TOOL_SEAT);
 // optional hypothesis: extra head pitch phi about unit axis k (used ONLY to test the gain-5 explanation)
 const rotK=(v,k,phi)=>{const c=Math.cos(phi),s_=Math.sin(phi),kv=cross(k,v),kd=dot(k,v);return v.map((q,i)=>q*c+kv[i]*s_+k[i]*kd*(1-c));};
 const RT=opt.extraPitch?{apply:v=>rotK(RT0.apply(v),opt.extraPitch.axis,opt.extraPitch.phi),inv:v=>RT0.inv(rotK(v,opt.extraPitch.axis,-opt.extraPitch.phi))}:RT0;
 const head=st=>{const zt=AMP.Z*st.Z/100;
  return {R:RT,O:OT,toWorld:q=>add(OT,RT.apply(add(q,mul(I.Z,zt)))),dirToWorld:v=>RT.apply(v),
   toLocal:p=>sub(RT.inv(sub(p,OT)),mul(I.Z,zt)),dirToLocal:v=>RT.inv(v)};};
 const P=st=>saddle(st).toWorld([0,TABLE_TOP_ABOVE_DATUM,0]);
 // feed directions (world)
 const Xdir=st=>saddle(st).dirToWorld([1,0,0]);
 const Ytan=st=>{const e=1e-3,d=k=>P({...st,Y:st.Y+k*e/AMP.Y*100});return unit(mul(sub(mul(sub(d(1),d(-1)),8),sub(d(2),d(-2))),1/(12*e)));};
 const Zdir=()=>RT.apply(I.Z);
 return {S,I,saddle,head,P,Xdir,Ytan,Zdir,tableNormal:st=>saddle(st).dirToWorld([0,1,0])};
}
// ---- squareness scan (product's stated interval/zero end; physical contact) ----
const PAIRS={XY:{base:'X',scan:'Y',owner:'master',dir:-1},XZ:{base:'X',scan:'Z',owner:'body',dir:-1},YZ:{base:'Y',scan:'Z',owner:'body',dir:-1}};
function interval(st,key){
 const half=AMP[PAIRS[key].scan],lower=Math.max(-half,Math.min(half-.3,st[PAIRS[key].scan]*half/100)),upper=lower+.3;
 // dir -1: member moves negative (XY: table toward front; XZ/YZ: head down)
 return {start:upper,end:lower,state:pos=>({...st,[PAIRS[key].scan]:pos/half*100})};
}
// Mount fixture under machine m at the scan start: returns local (attached) descriptions.
function mount(m,st,key,align='tangent'){
 const p=PAIRS[key],iv=interval(st,key),s0=iv.state(iv.start);
 let n;
 if(p.base==='X')n=m.Xdir(s0);
 else if(align==='tangent')n=m.Ytan(s0);
 else{ // chord of P over the 300 mm Y interval containing the current Y (alignment by traverse)
  const half=AMP.Y,lo=Math.max(-half,Math.min(half-.3,st.Y*half/100));
  const a=m.P({...s0,Y:lo/half*100}),b=m.P({...s0,Y:(lo+.3)/half*100});n=unit(sub(b,a));
 }
 const C=m.P(s0),body=add(C,mul(n,.01)),probe=mul(n,-1);
 const tab=m.saddle(s0),hd=m.head(s0);
 return {key,st,iv,master:{c:tab.toLocal(C),n:tab.dirToLocal(n)},dial:{b:hd.toLocal(body),p:hd.dirToLocal(probe)}};
}
function extension(m,fx,s){
 const tab=m.saddle(s),hd=m.head(s),C=tab.toWorld(fx.master.c),n=tab.dirToWorld(fx.master.n),Bd=hd.toWorld(fx.dial.b),pr=hd.dirToWorld(fx.dial.p);
 const e=dot(n,sub(C,Bd))/dot(n,pr),contact=add(Bd,mul(pr,e));
 const along=dot(sub(contact,C),unit(sub(m.P(fx.iv.state(fx.iv.end)),m.P(fx.iv.state(fx.iv.start)))));
 return {e,contact,offsetFromC:norm(sub(contact,C))};
}
function scan(mBefore,mAfter,st,key,align){
 // B: mount+align+zero on mAfter.  A: mount+zero on mBefore, measure on mAfter. C: A mount, zero at start on mAfter.
 const fxB=mount(mAfter,st,key,align),fxA=mount(mBefore,st,key,align),iv=fxB.iv,s0=iv.state(iv.start),s1=iv.state(iv.end);
 const eB0=extension(mAfter,fxB,s0).e,eB1=extension(mAfter,fxB,s1).e;
 const eA0before=extension(mBefore,fxA,s0).e,eA0=extension(mAfter,fxA,s0).e,eA1=extension(mAfter,fxA,s1).e;
 // finite-face check: sample the path, record contact along-face offset range
 let maxOff=0;for(let i=0;i<=16;i++){const s=iv.state(iv.start+(iv.end-iv.start)*i/16);maxOff=Math.max(maxOff,extension(mAfter,fxB,s).offsetFromC);}
 return {key,interval:[iv.start,iv.end],
  B:{e0:eB0*1e3,e1:eB1*1e3,um:(eB0-eB1)*1e6},
  A:{e0zero:eA0before*1e3,e0:eA0*1e3,e1:eA1*1e3,startUm:(eA0before-eA0)*1e6,um:(eA0before-eA1)*1e6},
  C:{e0:eA0*1e3,e1:eA1*1e3,um:(eA0-eA1)*1e6},maxContactTravel:maxOff};
}
// ---- spindle sweep: dial on spindle nose, rotate about spindle axis, read table top ----
function sweepGeom(m,st){
 const hd=m.head(st),u=m.Zdir(),nose=hd.toWorld(NOSE_REL),right=hd.dirToWorld([1,0,0]);
 const e0=unit(sub(right,mul(u,dot(right,u)))),e90=cross(e0,u);
 return {u,nose,e0,e90};
}
function lambda(m,st,g,deg){
 const r=deg*Math.PI/180,ring=add(g.nose,add(mul(g.e0,SWEEP_R*Math.cos(r)),mul(g.e90,SWEEP_R*Math.sin(r))));
 const n=m.tableNormal(st),P=m.P(st),l=dot(n,sub(ring,P))/dot(n,g.u),contact=sub(ring,mul(g.u,l));
 const tab=m.saddle(st),d=sub(contact,P),lx=dot(d,tab.dirToWorld([1,0,0])),lz=dot(d,tab.dirToWorld([0,0,1]));
 return {l,onTable:Math.abs(lx)<=TABLE_HALF[0]&&Math.abs(lz)<=TABLE_HALF[1]};
}
function sweep(mBefore,mAfter,st){
 const gA=sweepGeom(mAfter,st),gB=sweepGeom(mBefore,st),angles=[0,90,180,270];
 // A: the dial stays on the spindle (moves with head); the zero taken before the change at the front is kept.
 const zeroBefore=lambda(mBefore,st,gB,270).l,front=lambda(mAfter,st,gA,270);
 return angles.map(a=>{const q=lambda(mAfter,st,gA,a);return {deg:a,onTable:q.onTable&&front.onTable,ext_mm:q.l*1e3,B:(front.l-q.l)*1e6,A:(zeroBefore-q.l)*1e6};});
}
// ---- local angles (300 mm conversion) ----
function local(m,st){
 const X=m.Xdir(st),Y=m.Ytan(st),Z=m.Zdir(),n=m.tableNormal(st);
 const dev=(a,b)=>-Math.asin(dot(a,b))*1e6*.3;   // um per 300 mm, product sign convention (-asin(dot))
 // spindle axis relative to table normal, expressed in table frame: + = axis leans to +x / +z
 const tab=m.saddle(st),ul=tab.dirToLocal(Z);
 return {XY:dev(X,Y),XZ:dev(X,Z),YZ:dev(Y,Z),spindleVsTable_x_um300:Math.atan2(ul[0],ul[1])*1e6*.3,spindleVsTable_z_um300:Math.atan2(ul[2],ul[1])*1e6*.3};
}
// pitch of Z relative to Y about X (for the gain hypothesis only)
function pitch(m,st){const X=m.Xdir(st),pr=v=>sub(v,mul(X,dot(X,v))),z=pr(m.Zdir()),y=pr(m.Ytan(st));return Math.atan2(dot(z,y),dot(X,cross(z,y)));}
module.exports={pitch,machine,scan,sweep,local,lsPlane,planeHeights,ritz,surface,PAIRS,SUPPORTS};

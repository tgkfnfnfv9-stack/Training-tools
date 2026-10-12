'use strict';
// Independent physical model for travel / gate(kind double, L3) / gantry.
// Allowed inputs only: machine dimensions & axis amplitudes (stated here from
// the machine definitions), support coordinates, support heights, levelConfig,
// seed squareness microns. No product function (geometryModel, referenceScan,
// spindleSweep*, connectedPortal, Leveling.*, MachineAccuracy.directions) is called.
// World = drawing frame: x right, y up, z back. Lengths m, heights mm, slopes mm/m.
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>Math.hypot(...a),unit=a=>mul(a,1/norm(a));
const F=(r,u,b)=>({r,u,b,apply:v=>add(add(mul(r,v[0]),mul(u,v[1])),mul(b,v[2])),inv:v=>[dot(r,v),dot(u,v),dot(b,v)]});
// Rigid body seated on a surface of gradient (lr,fb) mm/m, no rotation about vertical.
function seat(s){const a=s.lr/1000,b=s.fb/1000,u=unit([-a,1,-b]),r=unit([1,a,0]);return F(r,u,cross(r,u));}
// ---- support surfaces ----
function bilinear(pts){
 const xs=[...new Set(pts.map(p=>p.x))].sort((a,b)=>a-b),zs=[...new Set(pts.map(p=>p.z))].sort((a,b)=>a-b);
 const H=(x,z)=>pts.find(p=>p.x===x&&p.z===z).h,idx=(v,k)=>{let i=0;while(i<k.length-2&&v>=k[i+1])i++;return i;};
 const cell=(x,z)=>{const i=idx(x,xs),j=idx(z,zs),dx=xs[i+1]-xs[i],dz=zs[j+1]-zs[j];return {u:(x-xs[i])/dx,v:(z-zs[j])/dz,dx,dz,a:H(xs[i],zs[j]),b:H(xs[i+1],zs[j]),c:H(xs[i],zs[j+1]),d:H(xs[i+1],zs[j+1])};};
 return {h:(x,z)=>{const q=cell(x,z);return (q.a*(1-q.u)+q.b*q.u)*(1-q.v)+(q.c*(1-q.u)+q.d*q.u)*q.v;},
  s:(x,z)=>{const q=cell(x,z);return {lr:((q.b-q.a)*(1-q.v)+(q.d-q.c)*q.v)/q.dx,fb:((q.c-q.a)*(1-q.u)+(q.d-q.b)*q.u)/q.dz};}};
}
function plane3(p){
 const [p0,p1,p2]=p,u=[p1.x-p0.x,p1.z-p0.z,p1.h-p0.h],v=[p2.x-p0.x,p2.z-p0.z,p2.h-p0.h],det=u[0]*v[1]-u[1]*v[0];
 const a=(u[2]*v[1]-v[2]*u[1])/det,b=(u[0]*v[2]-v[0]*u[2])/det;
 return {h:(x,z)=>p0.h+a*(x-p0.x)+b*(z-p0.z),s:()=>({lr:a,fb:b})};
}
// ---- machine data (from src/app.js machine list and axisConfig; inputs) ----
const AX={travel:{X:{v:[1,0,0],amp:1.0},Y:{v:[0,0,1],amp:.35},Z:{v:[0,1,0],amp:.3}},
 double:{X:{v:[0,0,1],amp:.7},Y:{v:[1,0,0],amp:.65},Z:{v:[0,1,0],amp:.28}},gantry:{X:{v:[0,0,1],amp:.7},Y:{v:[1,0,0],amp:.65},Z:{v:[0,1,0],amp:.28}}};
// Intrinsic axis directions in the member's nominal frame. Definition: dot(Xi,Yi)=-sin(XY/0.3 m), etc.
function intrinsic(kind,sq){
 const n=AX[kind],t=k=>sq[k].microns/.3/1e6,X=n.X.v,Yn=n.Y.v,Zn=n.Z.v;
 const sxy=Math.sin(t('XY')),Y=add(mul(Yn,Math.cos(t('XY'))),mul(X,-sxy));
 const al=-Math.sin(t('XZ')),be=(-Math.sin(t('YZ'))+sxy*al)/Math.cos(t('XY')),ga=Math.sqrt(1-al*al-be*be),Z=add(add(mul(X,al),mul(Yn,be)),mul(Zn,ga));
 return {X,Y,Z};
}
// Minimal rotation taking a to b (unit vectors): body posture of a column whose vertical is the intrinsic Z.
function minimalRotation(a,b){
 const k=cross(a,b),s=norm(k),c=dot(a,b);if(s<1e-15)return v=>[...v];const n=mul(k,1/s);
 return v=>add(add(mul(v,c),mul(cross(n,v),s)),mul(n,dot(n,v)*(1-c)));
}
// ---- model ----
// cfg: {kind,w,d,columnX,columnZ,levelConfig,supports:[{x,z,group}],sq}
function model(cfg,heights){
 const {kind,w,d,levelConfig:lc}=cfg,LX=x=>x/(w*.8)*lc.width,LZ=z=>z/(d*.8)*lc.depth,L=(x,z)=>({x:LX(x),z:LZ(z)});
 const pts=cfg.supports.map((p,i)=>({...L(p.x,p.z),h:heights[i],group:p.group}));
 const I=intrinsic(kind,cfg.sq),amp=(k,st)=>AX[kind][k].amp*st[k]/100;
 const P=(q,surf)=>[q.x,.66+surf.h(q.x,q.z)/1000,q.z];
 let surf,bed,cols;
 if(kind==='double'){bed=bilinear(pts.filter(p=>p.group==='bed'));cols=[plane3(pts.filter(p=>p.group==='column-left')),plane3(pts.filter(p=>p.group==='column-right'))];}
 else{surf=bilinear(pts);bed=surf;cols=[surf,surf];}
 // Tool member pose at state st: {o: reference origin (world), T: frame}, plus intrinsic travel of the head inside it.
 function pose(st){
  if(kind==='travel'){
   const lay={x:w*.2*lc.columnX/100,z:d*.1*lc.columnZ/100};
   const c=L(-.5+amp('X',st)+lay.x,d*.29+lay.z),T=seat(surf.s(c.x,c.z)),o=P(c,surf);
   const rails=[-1,1].map(k=>{const q=L(-.5+amp('X',st)+lay.x,d*.22+k*.1);return surf.s(q.x,q.z);}),G=seat({lr:(rails[0].lr+rails[1].lr)/2,fb:(rails[0].fb+rails[1].fb)/2});
   const w0=L(0,-d*.18),Wf=seat(surf.s(w0.x,w0.z)),table=add(P(w0,surf),Wf.apply([0,.44,0]));
   const body=minimalRotation([0,1,0],I.Z);
   const head=add(mul(I.Y,LZ(amp('Y',st))),mul(I.Z,amp('Z',st)));  // |coordinate(vector)| scaling for Y (z-direction)
   const noseLocal=add(body([0,.99,LZ(-.3)-LZ(d*.29)]),head);
   return {o,T,G,W:Wf,table,head,noseLocal,nose:add(o,T.apply(noseLocal)),Xdir:G.apply(I.X),body,seat:c};
  }
  // portals: columns seated on their own surfaces, beam joins the column tops; ram rigid with beam.
  const gz=kind==='gantry'?amp('X',st):cfg.columnZ,cx=kind==='gantry'?w*.4:cfg.columnX;
  const C=[-1,1].map((k,i)=>{const q=L(k*cx,gz),s=cols[i].s(q.x,q.z),R=seat(s),foot=P(q,cols[i]);return {q,s,R,foot,top:add(foot,mul(R.u,2.51))};});
  const r=unit(sub(C[1].top,C[0].top)),mu=mul(add(C[0].R.u,C[1].R.u),.5),u=unit(sub(mu,mul(r,dot(mu,r)))),T=F(r,u,cross(r,u)),o=mul(add(C[0].top,C[1].top),.5);
  const wq=L(0,kind==='double'?amp('X',st):0),Wf=seat(bed.s(wq.x,wq.z)),table=add(P(wq,bed),Wf.apply([0,.46,0]));
  const head=add(mul(I.Y,LX(amp('Y',st))),mul(I.Z,amp('Z',st)));
  const noseLocal=add([LX(.15),1.91-3.17,LZ(-.23)],head);
  let Xdir;
  if(kind==='double')Xdir=Wf.apply(I.X);else{const m={lr:(C[0].s.lr+C[1].s.lr)/2,fb:(C[0].s.fb+C[1].s.fb)/2};Xdir=seat(m).apply(I.X);}
  return {o,T,W:Wf,table,head,noseLocal,nose:add(o,T.apply(noseLocal)),Xdir,cols:C,body:minimalRotation([0,1,0],I.Z)};
 }
 const half=k=>{const a=AX[kind][k],v=a.v;return Math.hypot(LX(v[0]*a.amp),v[1]*a.amp,LZ(v[2]*a.amp));};
 return {pose,I,half,LX,LZ,kind};
}
// ---- squareness setup (ownership per user spec: master on table, dial on spindle side) ----
// XY: base X, scan Y, head moves +Y (low->high). XZ: base X, scan Z, head moves -Z (high->low). YZ: base Y, scan Z, -Z.
const PAIRS={XY:{base:'X',scan:'Y',sign:1},XZ:{base:'X',scan:'Z',sign:-1},YZ:{base:'Y',scan:'Z',sign:-1}};
const LEN=.3;
function intervalOf(M,key,value,sign){const h=M.half(key),lo=Math.max(-h,Math.min(h-LEN,value*h/100));return sign>0?[lo,lo+LEN]:[lo+LEN,lo];}
const toState=(M,st,key,pos)=>({...st,[key]:pos/M.half(key)*100});
// R alignment by real X feed: dial tip rigid with the spindle side (bracket tip = table-top centre at
// alignment start), square carried by the table-top centre. R = chord of tip seen in the square's frame.
function alignX(M,sStart){
 const h=M.half('X'),x0=Math.max(-h,Math.min(h-LEN,sStart.X*h/100)),a=M.pose(toState(M,sStart,'X',x0)),b=M.pose(toState(M,sStart,'X',x0+LEN));
 const tipLocal=a.T.inv(sub(a.table,a.o)),tip=p=>add(p.o,p.T.apply(tipLocal));
 const chord=sub(b.W.inv(sub(tip(b),b.table)),a.W.inv(sub(tip(a),a.table)));
 return {xStart:x0,xEnd:x0+LEN,chordLocal:chord,tipLocal,tips:[tip(a),tip(b)],tables:[a.table,b.table],valid:2*h>=LEN-1e-12};
}
// mounting at state st (heights in M): returns master-local normal, face point (master local rel. table centre),
// body point & probe in tool-local coordinates (rel. tool origin, minus the head travel at sStart).
function mount(M,pair,st){
 const P=PAIRS[pair],[s0]=intervalOf(M,P.scan,st[P.scan],P.sign),sStart=toState(M,st,P.scan,s0);
 const p=M.pose(sStart);let nW,al=null,tipLocal;
 if(P.base==='X'){al=alignX(M,sStart);nW=p.W.apply(unit(al.chordLocal));if(dot(nW,p.Xdir)<0)nW=mul(nW,-1);tipLocal=al.tipLocal;}
 else{nW=unit(p.T.apply(M.I.Y));tipLocal=p.T.inv(sub(p.table,p.o));} // YZ: R from the head's Y direction; contact assumed at the tool point on the table centre
 const tip=add(p.o,p.T.apply(tipLocal)),body=add(tip,mul(nW,.01));
 const scanW=unit(p.T.apply(M.I[P.scan])),tangent=unit(sub(scanW,mul(nW,dot(nW,scanW))));
 return {pair,sStart,nLocal:p.W.inv(nW),faceLocal:p.W.inv(sub(tip,p.table)),bodyLocal:sub(p.T.inv(sub(body,p.o)),p.head),probeLocal:p.T.inv(mul(nW,-1)),tangentLocal:p.W.inv(mul(tangent,P.sign)),alignment:al,nWorld:nW,tipWorld:tip};
}
// Read the dial for a mounting at state st on model M (contact with the S face).
function read(M,mt,st){
 const p=M.pose(st),n=p.W.apply(mt.nLocal),face=add(p.table,p.W.apply(mt.faceLocal)),body=add(p.o,p.T.apply(add(mt.bodyLocal,p.head))),probe=p.T.apply(mt.probeLocal);
 const den=dot(n,probe);if(Math.abs(den)<1e-8)return {valid:false,reason:'parallel'};
 const ext=dot(n,sub(face,body))/den,contact=add(body,mul(probe,ext)),rel=p.W.inv(sub(contact,face));
 const along=dot(rel,mt.tangentLocal),across=dot(rel,unit(cross(mt.nLocal,mt.tangentLocal)));
 const valid=ext>=0&&ext<=.02&&along>=-.010000001&&along<=.310000001&&Math.abs(across)<=.025000001;
 return {valid,ext,contact,along,across,reason:valid?null:(ext<0||ext>.02?'伸び範囲外':'面外')};
}
function scanStates(M,pair,st){const P=PAIRS[pair],[s0,s1]=intervalOf(M,P.scan,st[P.scan],P.sign);return [toState(M,st,P.scan,s0),toState(M,st,P.scan,s1)];}
// B: re-align and re-zero on model M at state st.
function squarenessB(M,pair,st){
 const P=PAIRS[pair];
 if(2*M.half(P.scan)<LEN-1e-12)return {valid:false,reason:'scan range < 300 mm',zero:{},last:{},mount:{}};
 if(P.base==='X'&&2*M.half('X')<LEN-1e-12)return {valid:false,reason:'X alignment range < 300 mm',zero:{},last:{},mount:{}};
 const mt=mount(M,pair,st),[a,b]=scanStates(M,pair,st),r0=read(M,mt,a),r1=read(M,mt,b);
 return {valid:r0.valid&&r1.valid,microns:(r0.ext-r1.ext)*1e6,zero:r0,last:r1,mount:mt};
}
// ---- spindle sweep: dial on spindle, spindle rotated, radius 0.15 m, table top, front zero ----
function sweepRect(cfg,kind){const lc=cfg.levelConfig,LX=x=>x/(cfg.w*.8)*lc.width,LZ=z=>z/(cfg.d*.8)*lc.depth;
 if(kind==='travel')return [LX(cfg.w*.93/2),LZ(cfg.d*.39/2)];
 if(cfg.supportLayout==='irregular')return [LX(1.45/2),LZ(3.2/2)];
 return [LX(cfg.w*.57/2),LZ(cfg.d*.65/2)];}
// mounting: ring on the tool (rotating about the spindle axis), plane on the table; ring 10 mm above the table plane.
function sweepMount(M,st){
 const p=M.pose(st),a=unit(p.T.apply(M.I.Z)),right=p.T.apply(p.body([1,0,0])),n=p.W.u;
 const e0=unit(sub(right,mul(a,dot(right,a)))),e90=unit(cross(e0,a));
 const lam=dot(n,sub(p.table,p.nose))/dot(n,a),centre=add(p.nose,mul(a,lam+.01/dot(n,a)));
 const L=v=>p.T.inv(v);
 return {centreLocal:sub(L(sub(centre,p.o)),p.head),aLocal:L(a),e0Local:L(e0),e90Local:L(e90),tableLocal:{n:p.W.inv(n)}};
}
function sweepRead(M,mt,st,rect){
 const p=M.pose(st),a=p.T.apply(mt.aLocal),centre=add(p.o,p.T.apply(add(mt.centreLocal,p.head))),e0=p.T.apply(mt.e0Local),e90=p.T.apply(mt.e90Local),n=p.W.u;
 return [0,90,180,270].map(th=>{const c=[1,0,-1,0][th/90],s=[0,1,0,-1][th/90],ring=add(centre,mul(add(mul(e0,c),mul(e90,s)),.15));
  const ext=dot(n,sub(ring,p.table))/dot(n,a),contact=sub(ring,mul(a,ext)),dl=sub(contact,p.table);
  return {ext,contact,onTable:Math.abs(dot(dl,p.W.r))<=rect[0]+1e-10&&Math.abs(dot(dl,p.W.b))<=rect[1]+1e-10};});
}
function sweepB(M,st,rect){const mt=sweepMount(M,st),r=sweepRead(M,mt,st,rect);return r.map(q=>({...q,microns:(r[3].ext-q.ext)*1e6}));}
module.exports={add,sub,mul,dot,cross,unit,norm,model,PAIRS,mount,read,scanStates,squarenessB,sweepMount,sweepRead,sweepB,sweepRect,intervalOf,toState,alignX};

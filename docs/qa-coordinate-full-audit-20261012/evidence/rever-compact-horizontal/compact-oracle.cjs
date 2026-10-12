'use strict';
// Independent physical oracle for the compact vertical machine (kind=compact).
// Uses only: machine dimensions, support coordinates, support heights, the
// seeded squareness values, the stated stiffness D=1+0.5X, nu=0.3, and the
// drawn material-point positions (tool seat, saddle seat, table top P, spindle nose).
const L=require('./lib.cjs');
const {add,sub,mul,dot,unit,cross,app,inv,comp,slopeFrame,minimalRotation,intrinsicAxes,lsqPlane,ritz}=L;
const W=2.6,D=2.7;
function surface(cfg,heights){
 const hw=cfg.width/2,hd=cfg.depth/2;
 const pts=[[-hw,-hd],[hw,-hd],[-hw,hd],[hw,hd]].map(([x,z],i)=>({x,z,h:heights[i]}));
 const pl=lsqPlane(pts),t=(heights[0]+heights[3]-heights[1]-heights[2])/4,[q1u,q3u]=ritz(hw,hd,.5,.3),q1=q1u*t,q3=q3u*t;
 const plane=(x,z)=>pl.a*x+pl.b*z+pl.c;
 const h=(x,z)=>{const X=x/hw,Z=z/hd;return plane(x,z)+t*X*Z+(1-X*X)*(q1*Z+q3*Z**3);};
 const slope=(x,z)=>{const X=x/hw,Z=z/hd;return {lr:pl.a+t*Z/hw-2*X*(q1*Z+q3*Z**3)/hw,fb:pl.b+t*X/hd+(1-X*X)*(q1+3*q3*Z*Z)/hd};};
 const C=slopeFrame(pl.a,pl.b);
 const S=(x,z)=>{const s=slope(x,z);return comp(C,slopeFrame(s.lr-pl.a,s.fb-pl.b));};
 const Sp=(x,z)=>add(app(C,[x,(h(x,z)-plane(x,z))/1000,z]),[0,.66+pl.c/1000,0]);
 return {pl,t,q1,q3,h,slope,S,Sp,C};
}
function model(cfg,heights,profile){
 const kx=cfg.width/(W*.8),kz=cfg.depth/(D*.8),lx=x=>x*kx,lz=z=>z*kz;
 const s=surface(cfg,heights);
 const [Xi,Yi,Zi]=intrinsicAxes([1,0,0],[0,0,1],[0,1,0],profile.XY,profile.XZ,profile.YZ);
 const body=minimalRotation([0,1,0],Zi);
 const layout={x:W*.2*(cfg.columnX||0)/100,z:D*.1*(cfg.columnZ||0)/100};
 const toolSeat={x:lx(layout.x),z:lz(D*.29+layout.z)};
 const T=s.S(toolSeat.x,toolSeat.z),O=s.Sp(toolSeat.x,toolSeat.z);
 const head={T,O,body,frame:comp(T,body)};
 // head material map: local l (in body frame, relative to tool seat), Z feed along body ey
 head.point=(l,st)=>add(O,app(head.frame,add(l,[0,.3*st.Z/100,0])));
 head.dir=l=>app(head.frame,l);
 head.local=(p,st)=>sub(inv(head.frame,sub(p,O)),[0,.3*st.Z/100,0]);
 head.localDir=v=>inv(head.frame,v);
 const zdir=app(T,Zi);
 // table material map: saddle seat moves with Y; X is a cross slide on the saddle
 const seat=st=>{const travel=lz(.4*st.Y/100);return {x:0,z:lz(-D*.1)+travel,travel};};
 const table={
  frame:st=>{const q=seat(st);return s.S(q.x,q.z);},
  point:(l,st)=>{const q=seat(st),Wf=s.S(q.x,q.z);return add(s.Sp(q.x,q.z),app(Wf,add(l,mul(sub(Yi,[0,0,1]),q.travel))));},
  local:(p,st)=>{const q=seat(st),Wf=s.S(q.x,q.z);return sub(inv(Wf,sub(p,s.Sp(q.x,q.z))),mul(sub(Yi,[0,0,1]),q.travel));},
 };
 const Plocal=st=>[lx(.45*st.X/100),.5,0];
 const P=st=>table.point(Plocal(st),st);
 const xdir=st=>app(table.frame(st),Xi);
 // Y feed direction: derivative of the table material point with respect to Y travel (4th-order central difference)
 const ydir=st=>{
  const halfY=lz(.4),e=1e-4,at=d=>table.point(Plocal(st),{...st,Y:st.Y+d/halfY*100});
  const d1=sub(at(e),at(-e)),d2=sub(at(2*e),at(-2*e));
  return unit(sub(mul(d1,8),d2));
 };
 return {cfg,s,Xi,Yi,Zi,head,table,P,Plocal,xdir,ydir,zdir,lx,lz,kx,kz,layout,toolSeat};
}
function contactExt(point,normal,body,probe){return dot(normal,sub(point,body))/dot(normal,probe);}
// Squareness measurement. mode: 'B' (fresh alignment+zero after), or given a
// 'mount' captured in another model (A/C): square fixed to the table, dial to the head.
function scanSetup(key,state){
 const base=key[0],scan=key[1];
 if(scan==='Y'){const half=.4;/* level-coordinate half will be applied */return {base,scan};}
 return {base,scan};
}
function scanStates(m,key,state){
 const scan=key[1];
 if(scan==='Y'){
  const half=m.lz(.4),lower=Math.max(-half,Math.min(half-.3,state.Y*half/100)),start=lower+.3,end=lower; // table member goes -Y (memberSign -1)
  return {start:{...state,Y:start/half*100},end:{...state,Y:end/half*100},startPos:start,endPos:end};
 }
 const half=.3,lower=Math.max(-half,Math.min(half-.3,state.Z*half/100)),start=lower+.3,end=lower; // head goes down for XZ/YZ
 return {start:{...state,Z:start/half*100},end:{...state,Z:end/half*100},startPos:start,endPos:end};
}
// Capture the physical mount (material coordinates) for pair key at aligned/zeroed state in model m.
function mount(m,key,state){
 const ss=scanStates(m,key,state),st=ss.start,base=key[0];
 const n=base==='X'?m.xdir(st):m.ydir(st);
 const C=m.P(st),B=add(C,mul(n,.01));
 return {key,ss,square:{l:m.table.local(C,st),n:inv(m.table.frame(st),n)},dial:{l:m.head.local(B,st),p:m.head.localDir(mul(n,-1))}};
}
function read(m,mt,st){
 const point=m.table.point(mt.square.l,st),normal=app(m.table.frame(st),mt.square.n),body=m.head.point(mt.dial.l,st),probe=m.head.dir(mt.dial.p);
 const ext=contactExt(point,normal,body,probe);
 return {ext,contact:add(body,mul(probe,ext)),body,point,normal};
}
function squareness(mB,key,state,mBefore){
 const ss=scanStates(mB,key,state);
 const fresh=mount(mB,key,state),b0=read(mB,fresh,ss.start),b1=read(mB,fresh,ss.end);
 const out={key,startPosition:ss.startPos,endPosition:ss.endPos,B:{zeroExt:b0.ext,endExt:b1.ext,microns:(b0.ext-b1.ext)*1e6,contactStart:b0.contact,contactEnd:b1.contact}};
 const closed=key==='XZ'?.3*dot(mB.xdir(ss.start),mB.zdir)*1e6:key==='YZ'?.3*dot(mB.ydir(ss.start),mB.zdir)*1e6:null;
 if(closed!==null)out.B.closedForm=closed;
 if(mBefore){
  const old=mount(mBefore,key,state),z0=read(mBefore,old,ss.start),a0=read(mB,old,ss.start),a1=read(mB,old,ss.end);
  out.before={zeroExt:z0.ext,contact:z0.contact};
  out.A={zeroPointMicrons:(z0.ext-a0.ext)*1e6,endMicrons:(z0.ext-a1.ext)*1e6,extStart:a0.ext,extEnd:a1.ext,contactStart:a0.contact,contactEnd:a1.contact};
  out.C={microns:(a0.ext-a1.ext)*1e6};
 }
 return out;
}
// Spindle sweep (radius 150 mm ring about the spindle axis, front zero).
function sweepGeom(m,state){
 const st=state,axis=m.head.dir([0,1,0]),right=m.head.dir([1,0,0]),q=m.lz(-D*.1)+m.lz(.4*st.Y/100),Wf=m.table.frame(st),n=Wf.u;
 const nose=m.head.point([0,1.98-.66,m.lz(-.3+m.layout.z)-m.toolSeat.z],st);
 const P=m.table.point([m.lx(.45*st.X/100),.5,0],st);
 const first=unit(sub(right,mul(axis,dot(axis,right)))),e90=unit(cross(first,axis)),e0=unit(cross(axis,e90));
 return {axis,e0,e90,nose,P,Wf,n};
}
const angles=[0,90,180,270];
function ring(g,deg){const r=deg*Math.PI/180,c=deg===90||deg===270?0:Math.cos(r),s=deg===0||deg===180?0:Math.sin(r);return add(mul(g.e0,.15*c),mul(g.e90,.15*s));}
function sweep(mB,state,mBefore){
 const g=sweepGeom(mB,state),hw=mB.lx(W*.78/2),hd=mB.lz(D*.42/2);
 const d=(gg,deg,tableG)=>{const rp=add(gg.nose,ring(gg,deg));return dot(tableG.n,sub(rp,tableG.P))/dot(tableG.n,gg.axis);};
 const B=angles.map(deg=>{
  const dist=d(g,deg,g),contact=sub(add(g.nose,ring(g,deg)),mul(g.axis,dist)),delta=sub(contact,g.P);
  const onTable=Math.abs(dot(delta,g.Wf.r))<=hw+1e-10&&Math.abs(dot(delta,g.Wf.b))<=hd+1e-10;
  return {deg,dist,contact,onTable};
 });
 const ref=B[3].dist;
 const out={B:B.map(p=>({deg:p.deg,microns:(ref-p.dist)*1e6,onTable:p.onTable,contact:p.contact}))};
 if(mBefore){
  // A: ring points/axis are head material; re-express before-state ring through head map.
  const gb=sweepGeom(mBefore,state),refBefore=d(gb,270,gb);
  const A=angles.map(deg=>{
   const lp=mBefore.head.local(add(gb.nose,ring(gb,deg)),state),la=mBefore.head.localDir(gb.axis);
   const rp=mB.head.point(lp,state),ax=mB.head.dir(la),dist=dot(g.n,sub(rp,g.P))/dot(g.n,ax);
   return {deg,microns:(refBefore-dist)*1e6,ringPoint:rp,contact:sub(rp,mul(ax,dist)),extensionChange:(dist-refBefore)};
  });
  out.A=A;out.C=A.map(p=>({deg:p.deg,microns:p.microns-A[3].microns}));
 }
 return out;
}
module.exports={model,squareness,sweep,surface,scanStates};

'use strict';
// Physical sensitivity checks beyond the product's model definition (not used as product expected values).
const fs=require('node:fs'),I=require('./indep.cjs'),LI=require('/home/user/Training-tools/src/lathe-inspection.js'),MA=require('/home/user/Training-tools/src/machine-accuracy.js');
const results=JSON.parse(fs.readFileSync(__dirname+'/results.json','utf8'));
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const out={};
// (a) carriage posture from 4 rail pads (x±0.4, z=±0.4; drawn carriage length 0.8 m, rails at z=±0.4) instead of one seat point (x,0.15)
function padSurface(S){ // returns a surface object whose 'at' gives pad-averaged posture at the carriage seat
 return {...S,at:(x,z)=>{const P=[[x-.4,-.4],[x+.4,-.4],[x-.4,.4],[x+.4,.4]].map(([px,pz])=>S.at(px,pz).h);
  const lr=((P[1]-P[0])+(P[3]-P[2]))/2/.8,fb=((P[2]-P[0])+(P[3]-P[1]))/2/.8,hm=P.reduce((s,v)=>s+v,0)/4;
  return {h:hm+fb*(z-0),lr,fb};}};
}
function variantB(cfg,heights){
 // re-run the product-definition independent model but with the pad-averaged carriage surface
 const orig=I.surface;const S=orig(heights),Sp=padSurface(S);
 const prof=MA.generate(cfg.condition,cfg.seed,['X','Z'],6),k=LI.intrinsic(prof),th=prof.squareness.XZ.microns/.3e6;
 const member=(Sx,seat,intr)=>{const C=I.frame(Sx.a,Sx.b),q=Sx.at(seat[0],seat[2]),F=I.frame(q.lr-Sx.a,q.fb-Sx.b);
  const cmp=(A,B)=>({cols:B.cols.map(c=>A.apply(c)),apply(v){return add(add(mul(this.cols[0],v[0]),mul(this.cols[1],v[1])),mul(this.cols[2],v[2]));}});
  let R=cmp(C,F);if(intr)R=cmp(R,intr);const res=q.h-(Sx.a*seat[0]+Sx.b*seat[2]+Sx.c);
  return {R,origin:add(C.apply([seat[0],res/1000,seat[2]]),[0,.66+Sx.c/1000,0])};};
 const Ry={cols:[[Math.cos(th),0,-Math.sin(th)],[0,1,0],[Math.sin(th),0,Math.cos(th)]]};
 const H=member(S,[-1.75,.66,0],Ry),Hp=raw=>add(H.origin,H.R.apply(sub(raw,[-1.75,.66,0])));
 const K=(st,surf)=>{const seat=[.08+.7*st.Z/100,.66,.15],m=member(surf,seat,null);return {...m,point:raw=>add(m.origin,m.R.apply(add(sub(raw,[.08,.66,.15]),[0,0,.35*st.X/100])))};};
 const z0=Math.max(-.7,Math.min(.4,.7*cfg.Z/100)),Zs={X:cfg.X,Z:z0/.7*100},Ze={X:cfg.X,Z:(z0+.3)/.7*100};
 const flatB=surf=>{const a=K(Zs,surf),b=K(Ze,surf),n0=a.R.apply([Math.sin(k.flat),0,Math.cos(k.flat)]),n1=b.R.apply([Math.sin(k.flat),0,Math.cos(k.flat)]),P0=a.point([.23,1.5,1.43]),P1=b.point([.23,1.5,1.43]);
  const body=add(P0,mul(n0,.01)),pr=mul(n0,-1);return (.01-dot(sub(P1,body),n1)/dot(pr,n1))*1e6;};
 const s=H.R.apply([1,0,0]),N=Hp([-1.075,1.5,0]);
 const bore=surf=>{const Kh=K({X:-.2/.35*100,Z:cfg.Z},surf),c=sub(add(Kh.point([-.09,1.5,.2]),Kh.R.apply([0,k.holeY,k.holeX])),N);return [dot(c,H.R.apply([0,0,1]))*1e6,dot(c,H.R.apply([0,1,0]))*1e6];};
 const bar=(surf,dir)=>{const Km=K(Zs,surf),M=Km.point([.08,1.5,.2]),nrm=H.R.apply(dir),cA=add(N,mul(s,dot(sub(M,N),s))),body0=add(cA,mul(nrm,.035)),bl=Km.R.cols.map(c=>dot(c,sub(body0,Km.origin))),pl=Km.R.cols.map(c=>dot(c,mul(nrm,-1)));
  const ext=st=>{const Kt=K(st,surf),body=add(Kt.origin,Kt.R.apply(bl)),probe=Kt.R.apply(pl),q=sub(body,N),qp=sub(q,mul(s,dot(q,s))),pp=sub(probe,mul(s,dot(probe,s)));const A=dot(pp,pp),B=2*dot(qp,pp),C=dot(qp,qp)-.025*.025;return 2*C/(-B+Math.sqrt(B*B-4*A*C));};
  return (ext(Zs)-ext(Ze))*1e6;};
 return {seatPoint:{flat:flatB(S),bore:bore(S),barSide:bar(S,[0,0,1]),barTop:bar(S,[0,1,0])},pads:{flat:flatB(Sp),bore:bore(Sp),barSide:bar(Sp,[0,0,1]),barTop:bar(Sp,[0,1,0])}};
}
out.padVariant=results.filter((r,i)=>r.case.op==='op1').map(r=>({seed:r.case.seed,X:r.case.X,Z:r.case.Z,before:variantB(r.case,r.case.before),after:variantB(r.case,r.case.after)}));
// (b) self-weight sag of the product's 2.2 m x Ø50 mm steel bar (cantilever from spindle nose)
{const E=2.06e11,rho=7850,g=9.81,d=.05,L=2.2,A=Math.PI*d*d/4,Iy=Math.PI*d**4/64,w=rho*g*A,defl=x=>w*x*x*(6*L*L-4*L*x+x*x)/(24*E*Iy);
 out.sag={w_N_per_m:w,tip_mm:defl(L)*1000,interval:results.slice(0,3).map(r=>{const a=r.indep.barTop.before.axial;return {Z:r.case.Z,axial:a,dSag_um:(defl(a[1])-defl(a[0]))*1e6,topReadingContribution_um:-(defl(a[1])-defl(a[0]))*1e6};}),
  bar300:{tip_um:w*.3**4/(8*E*Iy)*1e6}};}
// (c) reachability of a 300 mm bar: axial position of the product's bracket over the full Z stroke
out.reach={axialMin:(.08-.7)-(-1.075),axialMax:(.08+.7)-(-1.075),note:'scan start clamps to Z<=57.1%; with a 0.30 m bar no Z position gives contact'};
// (d) X-scan contact path on drawn turret front (turret-local radius from turret axis)
out.frontPath={hubDisk:{radius:.18,protrusion_mm:(-.09-(-.125))*1000},pocket:{centreRadius:.33,radius:.045,innerEdge:.33-.045},pathRadius:[0,.30]};
fs.writeFileSync(__dirname+'/physics.json',JSON.stringify(out,null,1));console.log(JSON.stringify(out,null,1));

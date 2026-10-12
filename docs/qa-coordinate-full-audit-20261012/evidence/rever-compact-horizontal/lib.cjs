'use strict';
// Independent geometry helpers (no production code). Lengths m, heights mm, slopes mm/m.
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const norm=a=>Math.hypot(...a),unit=a=>mul(a,1/norm(a));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
// Rotation matrix stored as columns {r,u,b}; apply = r*v0+u*v1+b*v2
const R=(r,u,b)=>({r,u,b});
const app=(F,v)=>[0,1,2].map(i=>F.r[i]*v[0]+F.u[i]*v[1]+F.b[i]*v[2]);
const inv=(F,v)=>[dot(F.r,v),dot(F.u,v),dot(F.b,v)];
const comp=(A,B)=>R(app(A,B.r),app(A,B.u),app(A,B.b));
// Seating posture for a slope (lr,fb) in mm/m: the member's up is the surface normal,
// its right lies in the x-y plane along the surface (no yaw), back completes a right-handed set.
function slopeFrame(lr,fb){
 const a=lr/1000,b=fb/1000,up=unit([-a,1,-b]),right=unit([1,a,0]);
 return R(right,up,cross(right,up));
}
// Minimal rotation that carries unit vector p onto unit vector q (Rodrigues).
function minimalRotation(p,q){
 const k=cross(p,q),s=norm(k),c=dot(p,q);
 if(s<1e-15)return R([1,0,0],[0,1,0],[0,0,1]);
 const n=mul(k,1/s),rot=v=>add(add(mul(v,c),mul(cross(n,v),s)),mul(n,dot(n,v)*(1-c)));
 return R(rot([1,0,0]),rot([0,1,0]),rot([0,0,1]));
}
// Intrinsic NC axis directions from three signed squareness values (um over 300 mm).
// Axis order (first, second, third) with nominal vectors e1,e2,e3.
function intrinsicAxes(e1,e2,e3,s12,s13,s23){
 const a12=s12/.3/1e6,a13=s13/.3/1e6,a23=s23/.3/1e6;
 const yx=-Math.sin(a12),yy=Math.cos(a12),v1=[...e1],v2=add(mul(e2,yy),mul(e1,yx));
 const zx=-Math.sin(a13),zy=(-Math.sin(a23)-zx*yx)/yy,zz=Math.sqrt(1-zx*zx-zy*zy);
 const v3=add(add(mul(e3,zz),mul(e2,zy)),mul(e1,zx));
 return [v1,v2,v3];
}
// Least-squares plane through support points {x,z,h}.
function lsqPlane(points){
 const n=points.length,xm=points.reduce((s,p)=>s+p.x,0)/n,zm=points.reduce((s,p)=>s+p.z,0)/n,hm=points.reduce((s,p)=>s+p.h,0)/n;
 let xx=0,zz=0,xz=0,xh=0,zh=0;for(const p of points){const x=p.x-xm,z=p.z-zm,h=p.h-hm;xx+=x*x;zz+=z*z;xz+=x*z;xh+=x*h;zh+=z*h;}
 const det=xx*zz-xz*xz,a=(xh*zz-zh*xz)/det,b=(zh*xx-xh*xz)/det;
 return {a,b,c:hm-a*xm-b*zm};
}
// Exact integral of a polynomial in X,Z over [-1,1]^2. Poly = array of [i,j,c].
const pmul=(p,q)=>p.flatMap(([i,j,c])=>q.map(([k,l,d])=>[i+k,j+l,c*d]));
const pint=p=>p.reduce((s,[i,j,c])=>s+(i%2||j%2?0:4*c/((i+1)*(j+1))),0);
const pdX=p=>p.filter(([i])=>i>0).map(([i,j,c])=>[i-1,j,c*i]);
const pdZ=p=>p.filter(([,j])=>j>0).map(([i,j,c])=>[i,j-1,c*j]);
// Two-mode Ritz plate: w = t*X*Z + (1-X^2)(q1 Z + q3 Z^3), stiffness D=1+alpha*X, Poisson nu.
// Energy density D*(kxx^2+kzz^2+2nu kxx kzz+2(1-nu) kxz^2), x=aX, z=bZ.
function ritz(a,b,alpha=.5,nu=.3){
 const modes=[[[1,1,1]],[[0,1,1],[2,1,-1]],[[0,3,1],[2,3,-1]]];
 const curv=p=>[pdX(pdX(p)).map(([i,j,c])=>[i,j,c/(a*a)]),pdZ(pdZ(p)).map(([i,j,c])=>[i,j,c/(b*b)]),pdX(pdZ(p)).map(([i,j,c])=>[i,j,c/(a*b)])];
 const D=[[0,0,1],[1,0,alpha]];
 const E=(p,q)=>{const u=curv(p),v=curv(q);const t=(x,y,w)=>w*pint(pmul(D,pmul(x,y)));return a*b*(t(u[0],v[0],1)+t(u[1],v[1],1)+t(u[0],v[1],nu)+t(u[1],v[0],nu)+t(u[2],v[2],2*(1-nu)));};
 const K=[[E(modes[1],modes[1]),E(modes[1],modes[2])],[E(modes[2],modes[1]),E(modes[2],modes[2])]],f=[E(modes[1],modes[0]),E(modes[2],modes[0])];
 const det=K[0][0]*K[1][1]-K[0][1]*K[1][0];
 // minimise 0.5 q^T K q + t f^T q  => q = -t K^{-1} f ; return per unit t
 return [-(K[1][1]*f[0]-K[0][1]*f[1])/det,-(-K[1][0]*f[0]+K[0][0]*f[1])/det];
}
module.exports={add,sub,mul,dot,norm,unit,cross,R,app,inv,comp,slopeFrame,minimalRotation,intrinsicAxes,lsqPlane,ritz};

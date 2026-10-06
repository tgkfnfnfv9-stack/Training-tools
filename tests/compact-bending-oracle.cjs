'use strict';
// Independent test oracle: closed integrals of the two plate-curvature modes.
// Production uses Gauss quadrature; no production solver/frame is called here.
module.exports=function compactBendingOracle(points,alpha=.5,nu=.3){
 const xs=points.map(p=>p.x),zs=points.map(p=>p.z),a=(Math.max(...xs)-Math.min(...xs))/2,b=(Math.max(...zs)-Math.min(...zs))/2,cx=(Math.max(...xs)+Math.min(...xs))/2,cz=(Math.max(...zs)+Math.min(...zs))/2;
 const mean=fn=>points.reduce((s,p)=>s+fn(p)/4,0),plane={a:mean(p=>(p.x-cx)*p.h)/(a*a),b:mean(p=>(p.z-cz)*p.h)/(b*b),c:mean(p=>p.h)};
 const t=mean(p=>p.h*(p.x-cx)/a*(p.z-cz)/b);
 const K11=16*b/(3*a**3)+32*(1-nu)/(3*a*b),K13=16*b/(5*a**3)+32*(1-2*nu)/(3*a*b),K33=16*b/(7*a**3)+128*a/(5*b**3)+32*(3-5*nu)/(5*a*b),f=-16*alpha*(1-nu)*t/(3*a*b),det=K11*K33-K13*K13;
 const q1=-f*(K33-K13)/det,q3=-f*(K11-K13)/det;
 const heightAt=(x,z)=>{const X=(x-cx)/a,Z=(z-cz)/b;return plane.c+plane.a*(x-cx)+plane.b*(z-cz)+t*X*Z+(1-X*X)*(q1*Z+q3*Z**3);};
 const slopeAt=(x,z)=>{const X=(x-cx)/a,Z=(z-cz)/b;return {lr:plane.a+t*Z/a-2*X*(q1*Z+q3*Z**3)/a,fb:plane.b+t*X/b+(1-X*X)*(q1+3*q3*Z*Z)/b};};
 const hessianAt=(x,z)=>{const X=(x-cx)/a,Z=(z-cz)/b;return {xx:-2*(q1*Z+q3*Z**3)/(a*a),xz:t/(a*b)-2*X*(q1+3*q3*Z*Z)/(a*b),zz:6*q3*Z*(1-X*X)/(b*b)};};
 return {heightAt,slopeAt,hessianAt,plane,q1,q3,K:[[K11,K13],[K13,K33]],forcing:[f,f],t};
};

'use strict';
// Independent compact YZ oracle. Do not use production axes/sign tables or
// rendered points as expected values. Integrate the stated Ritz curvature
// energy by exact monomial moments, then differentiate an independently
// constructed material point and intersect a fixed plane with a probe ray.
const assert=require('node:assert/strict');
const e=require('./leveling-dom-env.cjs')({pureLeveling:true});
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),unit=a=>mul(a,1/Math.hypot(...a));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const poly=(...terms)=>terms;
const product=(p,q)=>p.flatMap(([i,j,c])=>q.map(([k,l,d])=>[i+k,j+l,c*d]));
const integral=p=>p.reduce((s,[i,j,c])=>s+(i%2||j%2?0:4*c/(i+1)/(j+1)),0);
function basis(a,b){const right=unit([1,a,0]),up=unit([-a,1,-b]),back=cross(right,up);return v=>add(add(mul(right,v[0]),mul(up,v[1])),mul(back,v[2]));}
function coefficients(a,b,t){
 const modes=[[[],[],poly([0,0,1/a/b])],[poly([0,1,-2/a/a]),[],poly([1,0,-2/a/b])],[poly([0,3,-2/a/a]),poly([0,1,6/b/b],[2,1,-6/b/b]),poly([1,2,-6/a/b])]];
 const D=poly([0,0,1],[1,0,.5]);
 const energy=(u,v)=>{let s=0;for(const [i,j,c] of [[0,0,1],[1,1,1],[0,1,.3],[1,0,.3],[2,2,1.4]])s+=c*integral(product(D,product(u[i],v[j])));return s*a*b;};
 const aa=energy(modes[1],modes[1]),bb=energy(modes[1],modes[2]),cc=energy(modes[2],modes[2]),u=-t*energy(modes[1],modes[0]),v=-t*energy(modes[2],modes[0]),det=aa*cc-bb*bb;
 return [(u*cc-bb*v)/det,(aa*v-bb*u)/det];
}
function oracle(heights,meta,profile){
 const a=meta.width/2,b=meta.depth/2,[h00,h10,h01,h11]=heights,pa=(h10+h11-h00-h01)/(4*a),pb=(h01+h11-h00-h10)/(4*b),t=(h00+h11-h10-h01)/4,[q1,q3]=coefficients(a,b,t);
 const shape=(x,z)=>{const X=x/a,Z=z/b;return {h:t*X*Z+(1-X*X)*(q1*Z+q3*Z**3),dx:(t*Z-2*X*(q1*Z+q3*Z**3))/a,dz:(t*X+(1-X*X)*(q1+3*q3*Z*Z))/b};};
 const common=basis(pa/1000,pb/1000),local=(x,z)=>{const s=shape(x,z);return basis(s.dx/1000,s.dz/1000);};
 const xy=profile.XY/300000,xz=profile.XZ/300000,yz=profile.YZ/300000,Y=[-Math.sin(xy),0,Math.cos(xy)],zx=-Math.sin(xz),zz=(-Math.sin(yz)-zx*Y[0])/Y[2],Z=[zx,Math.sqrt(1-zx*zx-zz*zz),zz];
 const sx=meta.width/(2.6*.8),sz=meta.depth/(2.7*.8),x=.45*meta.X/100*sx,z0=-.27*sz,travel=.4*meta.Y/100*sz;
 const point=s=>{const z=z0+s,h=shape(0,z).h/1000,R=local(0,z),offset=add([x,.5,0],mul(sub(Y,[0,0,1]),s));return common(add([0,h,z],R(offset)));};
 // Five-point derivative of material P. Numerical differentiation is independent
 // of production's analytic Hessian adapter; subtract first to avoid roundoff.
 const eps=.0001,p0=point(travel),d1=sub(point(travel+eps),point(travel-eps)),d2=sub(point(travel+2*eps),point(travel-2*eps)),normal=unit(mul(sub(mul(d1,8),d2),1/(12*eps)));
 const colX=2.6*.2*meta.columnX/100*sx,colZ=(2.7*.29+2.7*.1*meta.columnZ/100)*sz,zAxis=common(local(colX,colZ)(Z));
 const body0=mul(normal,.01),body1=add(body0,mul(zAxis,-.3)),probe=mul(normal,-1),extension=dot(normal,mul(body1,-1))/dot(normal,probe);
 return {reading:(.01-extension)*1e6,normal,zAxis,point:p0,q1,q3};
}
let count=0,maxError=0;const examples=[];
e.read('openMachine(machines[0]);');
for(const scale of [1,.77,1.31])for(const heights of [[0,0,0,0],[.1,0,0,0],[-.1,0,0,0],[.1,-.1,-.1,.1],[-.1,.1,.1,-.1],[.12,-.06,.03,-.11]])for(const location of [{X:0,Y:0,columnX:0,columnZ:0},{X:81,Y:-94,columnX:63,columnZ:-71},{X:-91,Y:97,columnX:-87,columnZ:89}])for(const profile of [{XY:0,XZ:0,YZ:0},{XY:70,XZ:-81,YZ:92},{XY:-70,XZ:81,YZ:-92}]){
 const meta={...location,width:2.08*scale,depth:2.16/scale};
 e.read(`levelConfig.width=${meta.width};levelConfig.depth=${meta.depth};levelConfig.columnX=${meta.columnX};levelConfig.columnZ=${meta.columnZ};positions={X:${meta.X},Y:${meta.Y},Z:97,A:0,C:0};supportHeights=${JSON.stringify(heights)};machineProfile={initialHeights:[0,0,0,0],guides:{},squareness:${JSON.stringify(Object.fromEntries(Object.entries(profile).map(([k,v])=>[k,{microns:v}])))}};updateLeveling();`);
 const actual=e.json('referenceScan({key:"YZ"})'),expected=oracle(heights,meta,profile);assert.equal(actual.valid,true);const error=Math.abs(actual.microns-expected.reading);maxError=Math.max(maxError,error);assert.ok(error<.00001,`${JSON.stringify({meta,heights,profile})}: ${actual.microns} vs ${expected.reading}`);count++;
 if(scale===1&&location.X===0&&profile.XY===0)examples.push({heights,reading:actual.microns,independent:expected.reading});
 // Recompute the fixed fixture from the opposite side: compression reverses.
 const n=mul(expected.normal,-1),probe=mul(n,-1),body=add(mul(n,.01),mul(expected.zAxis,-.3)),extension=dot(n,mul(body,-1))/dot(n,probe);assert.ok(Math.abs((.01-extension)*1e6+expected.reading)<1e-7);
 // Swap fixed endpoints, retain normal/probe, and zero the new start.
 const upperBody=mul(expected.normal,.01),lowerBody=add(upperBody,mul(expected.zAxis,-.3)),p=mul(expected.normal,-1),rayLength=b=>dot(expected.normal,mul(b,-1))/dot(expected.normal,p);assert.ok(Math.abs((rayLength(lowerBody)-rayLength(upperBody))*1e6+expected.reading)<1e-7);
}
const pureAngle=[];
for(const microns of [-60,60]){
 e.read(`levelConfig.width=2.08;levelConfig.depth=2.16;levelConfig.columnX=0;levelConfig.columnZ=0;positions={X:0,Y:0,Z:0,A:0,C:0};supportHeights=[0,0,0,0];machineProfile={initialHeights:[0,0,0,0],guides:{},squareness:{XY:{microns:0},XZ:{microns:0},YZ:{microns:${microns}}}};updateLeveling();`);
 const actual=e.json('referenceScan({key:"YZ"}).microns'),expected=-300000*Math.sin(microns/300000);assert.ok(Math.abs(actual-expected)<1e-8);pureAngle.push({intrinsicMicrons:microns,reading:actual,expected});
}
console.log(JSON.stringify({pureAngle,cases:count,maxErrorMicrons:maxError,oppositeSideAndRezeroCases:count*2,examples},null,2));

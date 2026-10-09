(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.LatheInspection=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),unit=a=>mul(a,1/Math.hypot(...a));
 // Fixed probe body/direction, moving plane. Positive = less extension,
 // i.e. more plunger compression. All positions and extensions are metres.
 function extension(body,probe,point,normal){const d=dot(probe,normal);return Math.abs(d)<1e-10?NaN:dot(sub(point,body),normal)/d;}
 function planeScan(first,last,normalFirst,normalLast){const body=add(first,mul(normalFirst,.01)),probe=mul(normalFirst,-1);return (extension(body,probe,first,normalFirst)-extension(body,probe,last,normalLast))*1e6;}
 // Spindle-centred rotating indicator, outward probe against an internal bore.
 // a=left, b=up, c=right, d=down, viewed from spindle towards turret.
 function bore(dx,dy,radius=.025){
  if(Math.hypot(dx,dy)>=radius)return {valid:false,readings:null};
  const e=[[-1,0],[0,1],[1,0],[0,-1]].map(([x,y])=>{const t=x*dx+y*dy;return t+Math.sqrt(radius*radius-dx*dx-dy*dy+t*t);});
  return {valid:true,readings:e.map(v=>(e[0]-v)*1e6)};
 }
 // External plunger against a fixed finite cylindrical test bar. The nearest
 // forward ray intersection is the contact; an absent/out-of-stroke contact
 // cannot be converted into a dial reading. Units: metres.
 function cylinderContact(body,probe,origin,direction,radius=.025,length=Infinity){
  const axis=unit(direction),ray=unit(probe),q=sub(body,origin),along=dot(q,axis),axialRay=dot(ray,axis);
  const radial=sub(q,mul(axis,along)),transverse=sub(ray,mul(axis,axialRay));
  const A=dot(transverse,transverse),B=2*dot(radial,transverse),C=dot(radial,radial)-radius*radius,D=B*B-4*A*C;
  if(A<1e-12||D<0||C<=0)return {valid:false,reason:'no-external-contact'};
  // This form avoids subtracting nearly equal numbers for a small extension.
  const far=(-B+Math.sqrt(D))/(2*A),extension=far?C/(A*far):NaN,axial=along+extension*axialRay;
  if(!Number.isFinite(extension)||extension<0||extension>.02)return {valid:false,reason:'plunger-range'};
  if(axial<0||axial>length)return {valid:false,reason:'bar-length'};
  return {valid:true,extension,axial,point:add(body,mul(ray,extension))};
 }
 function intrinsic(profile){
  if(!profile)return {face:0,flat:0,holeX:0,holeY:0};
  let s=(profile.seed^0x4c415431)>>>0;const next=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296*2-1;},scale=profile.condition==='used'?30:10;
  return {face:next()*scale/1e6,flat:next()*scale/1e6,holeX:next()*scale/1e6,holeY:next()*scale/1e6};
 }
 return Object.freeze({model:'lathe-testbar-v2',add,sub,mul,dot,unit,extension,planeScan,bore,cylinderContact,intrinsic});
});

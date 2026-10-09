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
 function distance(point,origin,direction){const d=sub(point,origin),u=unit(direction);return Math.hypot(...sub(d,mul(u,dot(d,u))));}
 // Both endpoints use ONE fixed cutter mounting. No re-zero at b.
 function diameterDifference(first,last,origin,direction){return 2*(distance(last,origin,direction)-distance(first,origin,direction))*1e6;}
 function intrinsic(profile){
  if(!profile)return {face:0,flat:0,holeX:0,holeY:0};
  let s=(profile.seed^0x4c415431)>>>0;const next=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296*2-1;},scale=profile.condition==='used'?30:10;
  return {face:next()*scale/1e6,flat:next()*scale/1e6,holeX:next()*scale/1e6,holeY:next()*scale/1e6};
 }
 return Object.freeze({model:'lathe-inspection-v1',add,sub,mul,dot,unit,extension,planeScan,bore,distance,diameterDifference,intrinsic});
});

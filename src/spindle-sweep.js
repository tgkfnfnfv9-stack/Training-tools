(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.SpindleSweep=api;
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const invalid=reason=>({valid:false,reason});
 // Rescaling first avoids overflow/underflow while accepting any finite,
 // nonzero vector magnitude. All caller-owned vectors remain untouched.
 function unit(v){
  if(!Array.isArray(v)||v.length!==3||![0,1,2].every(i=>Number.isFinite(v[i])))return null;
  const scale=Math.max(...v.map(Math.abs));if(scale===0)return null;
  const scaled=v.map(q=>q/scale),length=Math.hypot(...scaled);
  return scaled.map(q=>q/length);
 }
 const fixed=v=>Object.freeze([...v]);
 function measure(options){
  if(!options||typeof options!=='object')return invalid('invalid-options');
  const axis=unit(options.axis),tableNormal=unit(options.tableNormal),right=unit(options.right),radius=options.radius??.15;
  if(!axis)return invalid('invalid-axis');
  if(!tableNormal)return invalid('invalid-table-normal');
  if(!right)return invalid('invalid-right');
  if(!Number.isFinite(radius)||radius<=0)return invalid('invalid-radius');
  const alignment=dot(tableNormal,axis);
  // The tip follows the positive spindle axis into an upward-facing plane.
  // A parallel axis has no unique contact; a reversed normal is not that face.
  if(Math.abs(alignment)<1e-10)return invalid('parallel-contact');
  if(alignment<0)return invalid('opposed-table-normal');
  const along=dot(right,axis),projected=right.map((v,i)=>v-along*axis[i]);
  if(Math.hypot(...projected)<1e-10)return invalid('parallel-right');
  const first=unit(projected),e90=unit(cross(first,axis)),e0=unit(cross(axis,e90));
  // The reference ring lies in the plane normal to the spindle axis. A line
  // p + lambda * axis intersects the table plane n.p = 0 at:
  // lambda = -n.p / (n.axis). Plane translations add the same lambda to every
  // angle and cancel when the dial is zeroed at 0 degrees.
  const a=-radius*dot(tableNormal,e0)/alignment,b=-radius*dot(tableNormal,e90)/alignment;
  const tirMicrons=2*Math.hypot(a,b)*1e6;
  if(!Number.isFinite(tirMicrons))return invalid('out-of-range');
  function at(degrees){
   if(!Number.isFinite(degrees))return invalid('invalid-angle');
   const angle=((degrees%360)+360)%360;
   // Exact cardinal coefficients keep opposite-pair identities free of the
   // sin(pi) round-off, including the exact zero reading used for calibration.
   let cosine,sine;
   if(angle===0){cosine=1;sine=0;}
   else if(angle===90){cosine=0;sine=1;}
   else if(angle===180){cosine=-1;sine=0;}
   else if(angle===270){cosine=0;sine=-1;}
   else{const radians=angle*Math.PI/180;cosine=Math.cos(radians);sine=Math.sin(radians);}
   const axialOffsetMetres=a*cosine+b*sine;
   const ringPoint=e0.map((v,i)=>radius*(v*cosine+e90[i]*sine));
   const contactPoint=ringPoint.map((v,i)=>v+axialOffsetMetres*axis[i]);
   // Positive is increased plunger compression: a higher table contact point
   // relative to the spindle-normal ring. Metres are converted to micrometres
   // only here; renderer magnification does not enter this calculation.
   const readingMicrons=angle===0?0:(axialOffsetMetres-a)*1e6;
   if(!Number.isFinite(readingMicrons)||!ringPoint.every(Number.isFinite)||!contactPoint.every(Number.isFinite))return invalid('out-of-range');
   return Object.freeze({valid:true,degrees:angle,readingMicrons:readingMicrons===0?0:readingMicrons,axialOffsetMetres,ringPoint:fixed(ringPoint),contactPoint:fixed(contactPoint)});
  }
  const cardinal=[0,90,180,270].map(at);
  if(cardinal.some(p=>!p.valid))return invalid('out-of-range');
  const readings=cardinal.map(p=>p.readingMicrons),fourPointRangeMicrons=Math.max(...readings)-Math.min(...readings);
  return Object.freeze({valid:true,radius,axis:fixed(axis),tableNormal:fixed(tableNormal),e0:fixed(e0),e90:fixed(e90),zeroOffsetMetres:a,cardinal:Object.freeze(cardinal),tirMicrons,fourPointRangeMicrons,at});
 }
 return Object.freeze({measure});
});

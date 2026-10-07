'use strict';
(function(root){
 const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),scale=(v,s)=>v.map(q=>q*s);
 const vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite),unit=v=>vector(v)&&Math.hypot(...v)>0?scale(v,1/Math.hypot(...v)):null;
 const invalid=reason=>({valid:false,reason});
 // The probe is a ray from its body toward the cylindrical test bar. Positive
 // dial change is a reduction of extension, not a signed machine-axis travel.
 function contact({axis,origin,radius=.025,axialMin=-.01,axialMax=.31,body,probe,maxExtension=.02}={}){
  axis=unit(axis);probe=unit(probe);
  if(!axis||!probe||!vector(origin)||!vector(body)||![radius,axialMin,axialMax,maxExtension].every(Number.isFinite)||radius<=0||axialMin>=axialMax||maxExtension<=0)return invalid('測定配置が不正');
  const q=sub(body,origin),radial=v=>sub(v,scale(axis,dot(v,axis))),u=radial(probe),v=radial(q),A=dot(u,u),B=2*dot(u,v),C=dot(v,v)-radius*radius;
  if(A<1e-16)return invalid('測定子がテストバーと平行');
  if(C<-1e-12)return invalid('計器本体がテストバー内');
  const discriminant=B*B-4*A*C;
  if(discriminant<0)return invalid('テストバーの接触範囲外');
  const roots=[(-B-Math.sqrt(discriminant))/(2*A),(-B+Math.sqrt(discriminant))/(2*A)].filter(t=>t>=-1e-12).sort((a,b)=>a-b),extension=roots.length?Math.max(0,roots[0]):NaN;
  if(!Number.isFinite(extension)||extension>maxExtension)return invalid('測定子の範囲外');
  const point=add(body,scale(probe,extension)),axial=dot(sub(point,origin),axis);
  if(axial<axialMin-1e-10||axial>axialMax+1e-10)return invalid('テストバーの校正区間外');
  return {valid:true,extension,point,axial,body:[...body],probe};
 }
 function measure({samples,...bar}={}){
  if(!Array.isArray(samples)||samples.length<2)return invalid('走査点が不足');
  const points=samples.map(sample=>({...contact({...bar,...sample}),t:sample.t})),bad=points.find(p=>!p.valid);
  if(bad)return {...invalid(bad.reason),samples:points,failureT:bad.t};
  const zero=points[0],last=points[points.length-1],microns=(zero.extension-last.extension)*1e6;
  return {valid:true,microns:Math.abs(microns)<1e-8?0:microns,zero,last,samples:points};
 }
 const api={model:'horizontal-parallelism-v1',contact,measure};
 if(typeof module!=='undefined')module.exports=api;
 root.HorizontalParallelism=api;
})(typeof window!=='undefined'?window:globalThis);

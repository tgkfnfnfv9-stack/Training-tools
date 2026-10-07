'use strict';
// Independent, unexaggerated plane/probe geometry. All lengths are metres.
(function(root){
 const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),scale=(v,s)=>v.map(q=>q*s);
 const unit=v=>scale(v,1/Math.hypot(...v));
 function contact({point,normal,body,probe}){
  const denominator=dot(normal,probe);
  if(!Number.isFinite(denominator)||Math.abs(denominator)<1e-8)return {valid:false,reason:'接触方向が面と平行'};
  const extension=dot(normal,sub(point,body))/denominator;
  if(!Number.isFinite(extension)||extension<0||extension>.02)return {valid:false,reason:'測定子の範囲外'};
  return {valid:true,extension,point:add(body,scale(probe,extension))};
 }
 function compare(start,end){
  const zero=contact(start),last=contact(end);
  return zero.valid&&last.valid?{valid:true,microns:(zero.extension-last.extension)*1e6,zero,last}:{valid:false,reason:zero.valid?last.reason:zero.reason};
 }
 // Rotate a vector with an assembly from its starting orthonormal frame.
 function transport(v,from,to){return to.rotate([dot(v,from.right),dot(v,from.up),dot(v,from.back)]);}
 // Integrate inside each smooth support cell. Interior Gauss nodes avoid
 // assigning a discontinuous grid-boundary gradient to the wrong segment.
 function integrate(direction,length,breaks=[]){
  const edges=[0,...new Set(breaks.filter(t=>t>0&&t<1)),1].sort((a,b)=>a-b);
  const nodes=[-.8611363115940526,-.3399810435848563,.3399810435848563,.8611363115940526],weights=[.3478548451374538,.6521451548625461,.6521451548625461,.3478548451374538];
  let previous=null;
  for(let count=1;count<=32;count*=2){
   let sum=[0,0,0];
   for(let part=0;part<edges.length-1;part++){
    const width=(edges[part+1]-edges[part])/count;
    for(let i=0;i<count;i++)for(let j=0;j<4;j++){
     const t=edges[part]+width*(i+(nodes[j]+1)/2);
     sum=add(sum,scale(direction(t),weights[j]*width*length/2));
    }
   }
   if(previous&&Math.hypot(...sub(sum,previous))<1e-9)return {valid:true,value:sum};
   previous=sum;
  }
  return {valid:false,reason:'走査計算の収束範囲外'};
 }
 const api={model:'reference-scan-v3',dot,add,sub,scale,unit,contact,compare,transport,integrate};
 if(typeof module!=='undefined')module.exports=api;
 root.ReferenceMeasurement=api;
})(typeof window!=='undefined'?window:globalThis);

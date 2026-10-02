(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.Leveling=api;
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const finite=(value,name)=>{if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError(name+'は有限の数値で指定してください。');return value;};
 const checked=(value)=>{if(!Number.isFinite(value))throw new RangeError('入力の桁が大きすぎるか、支持点間隔が小さすぎて計算できません。');return value;};
 const mean=values=>checked(values.reduce((sum,v)=>sum+v/values.length,0));
 function solve(input){
  if(!Array.isArray(input)||input.length<3)throw new TypeError('3点以上の支持点が必要です。');
  const points=input.map((p,i)=>{if(!p||typeof p!=='object')throw new TypeError('支持点'+i+'が不正です。');return {x:finite(p.x,'x'),z:finite(p.z,'z'),h:finite(p.h,'h')};});
  const seen=new Set();
  for(const p of points){const key=p.x+','+p.z;if(seen.has(key))throw new RangeError('支持点の座標が重複しています。');seen.add(key);}
  const xs=[...new Set(points.map(p=>p.x))].sort((a,b)=>a-b),zs=[...new Set(points.map(p=>p.z))].sort((a,b)=>a-b);
  if(xs.length<2||zs.length<2)throw new RangeError('支持点が一直線に並んでいます。');
  const xm=mean(points.map(p=>p.x)),zm=mean(points.map(p=>p.z));
  const sx=Math.max(...points.map(p=>Math.abs(checked(p.x-xm)))),sz=Math.max(...points.map(p=>Math.abs(checked(p.z-zm))));
  if(sx===0||sz===0)throw new RangeError('支持点間隔が不足しています。');
  // 座標と高さを正規化して、大きな原点・高さに対する丸め誤差を抑える。
  const hs=Math.max(...points.map(p=>Math.abs(p.h)))||1,hm=points.every(p=>p.h===points[0].h)?points[0].h/hs:mean(points.map(p=>p.h/hs));
  let xx=0,zz=0,xz=0,xh=0,zh=0;
  for(const p of points){const x=(p.x-xm)/sx,z=(p.z-zm)/sz,h=p.h/hs-hm;xx+=x*x;zz+=z*z;xz+=x*z;xh+=x*h;zh+=z*h;}
  const det=xx*zz-xz*xz;
  if(det<=Number.EPSILON*64*xx*zz)throw new RangeError('支持点が一直線、またはほぼ一直線に並んでいます。');
  const an=(xh*zz-zh*xz)/det,bn=(zh*xx-xh*xz)/det;
  const a=checked(an*hs/sx),b=checked(bn*hs/sz),heightMean=checked(hm*hs);
  const planeHeight=(x,z)=>checked(heightMean+checked(a*(x-xm))+checked(b*(z-zm)));
  const c=checked(heightMean-checked(a*xm)-checked(b*zm));
  let heightAt,slopeAt;
  if(points.length===3){
   heightAt=(x,z)=>planeHeight(finite(x,'x'),finite(z,'z'));
   slopeAt=(x,z)=>{finite(x,'x');finite(z,'z');return {lr:a,fb:b};};
  }else{
   if(points.length!==xs.length*zs.length)throw new RangeError('4点以上は欠けのない長方形格子で指定してください。');
   const rows=zs.map(z=>xs.map(x=>points.find(p=>p.x===x&&p.z===z).h));
   // 内部境界では右／奥側のセル、最外境界では内側のセルを使う。
   // 範囲外も最外セルを延長し、ゼロ勾配になるclampは行わない。
   const interval=(values,value)=>{let i=0;while(i<values.length-2&&value>=values[i+1])i++;return i;};
   const cell=(x,z)=>{
    finite(x,'x');finite(z,'z');const i=interval(xs,x),j=interval(zs,z),dx=checked(xs[i+1]-xs[i]),dz=checked(zs[j+1]-zs[j]);
    return {u:checked((x-xs[i])/dx),v:checked((z-zs[j])/dz),dx,dz,h00:rows[j][i],h10:rows[j][i+1],h01:rows[j+1][i],h11:rows[j+1][i+1]};
   };
   heightAt=(x,z)=>{const q=cell(x,z),front=q.h00+(q.h10-q.h00)*q.u,back=q.h01+(q.h11-q.h01)*q.u;return checked(front+(back-front)*q.v);};
   slopeAt=(x,z)=>{const q=cell(x,z);return {lr:checked(((q.h10-q.h00)*(1-q.v)+(q.h11-q.h01)*q.v)/q.dx),fb:checked(((q.h01-q.h00)*(1-q.u)+(q.h11-q.h10)*q.u)/q.dz)};};
  }
  const x0=xs[0],x1=xs[xs.length-1],z0=zs[0],z1=zs[zs.length-1],width=checked(x1-x0);
  const frontSlope=checked((heightAt(x1,z0)-heightAt(x0,z0))/width),backSlope=checked((heightAt(x1,z1)-heightAt(x0,z1))/width);
  const twist=points.length===3?0:checked(backSlope-frontSlope);
  const residual=points.length===3?0:Math.max(...points.map(p=>Math.abs(checked(p.h-planeHeight(p.x,p.z)))));
  return {lr:a,fb:b,twist,residual,plane:{a,b,c},heightAt,slopeAt};
 }
 function impact(solution,options){
  if(!solution||!options)throw new TypeError('計算結果とspan/offsetを指定してください。');
  const lr=finite(solution.lr,'lr'),fb=finite(solution.fb,'fb'),twist=finite(solution.twist,'twist'),residual=finite(solution.residual,'residual');
  const span=finite(options.span,'span'),offset=finite(options.offset,'offset');
  if(span<0||offset<0||residual<0)throw new RangeError('span、offset、residualは0以上にしてください。');
  return {tiltOffsetMicrons:checked(Math.hypot(lr,fb)*offset*1000),twistOffsetMicrons:checked(Math.abs(twist)*span*1000),straightnessMicrons:checked(residual*1000)};
 }
 return Object.freeze({solve,impact});
});

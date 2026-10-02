(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.MachineAccuracy=api;
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 // Teaching probabilities per error item, NOT measured market statistics.
 // Angular errors are signed micrometres over a fixed 300 mm reference.
 const referenceLength=.3;
 const distributions={new:[{weight:95,min:1,max:20},{weight:5,min:20,max:40}],used:[{weight:60,min:5,max:20},{weight:30,min:20,max:60},{weight:10,min:60,max:150}]};
 const quantize=v=>Math.round(v*1000)/1000;
 function random(seed){let value=seed>>>0;return ()=>{value=(value+0x6D2B79F5)>>>0;let t=value;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
 function generate(condition,seed,keys,count){
  if(!distributions[condition]||!Number.isInteger(seed)||seed<0||seed>4294967295||!Array.isArray(keys)||keys.length<2||new Set(keys).size!==keys.length||keys.some(k=>!['X','Y','Z'].includes(k))||!Number.isInteger(count)||count<3||count>8)throw new TypeError('個体の抽選条件が不正です。');
  const rng=random(seed),draw=()=>{
   const roll=rng()*100;let limit=0,index=distributions[condition].findIndex(q=>{limit+=q.weight;return roll<limit;});
   if(index<0)index=distributions[condition].length-1;
   const q=distributions[condition][index];return {band:index,microns:Math.round((q.min+(q.max-q.min)*rng())*1000)/1000};
  };
  const squareness={},guides={};
  for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++){const q=draw();squareness[keys[i]+keys[j]]={...q,microns:q.microns*(rng()<.5?-1:1)};}
  for(const key of keys)guides[key]=draw();
  const initialHeights=Array.from({length:count},()=>quantize(rng()*.3-.15));
  // A nonzero installation fault is guaranteed, independently of guide accuracy.
  initialHeights[0]=-.15;initialHeights[1]=.15;
  return {version:1,condition,seed,keys:[...keys],squareness,guides,initialHeights};
 }
 // Persist the seed, not caller-supplied defect values. Recreate and compare the
 // entire generated profile to reject partial, altered or incompatible profiles.
 function valid(profile,keys,count){
  try{
   const expected=generate(profile.condition,profile.seed,keys,count);
   const same=(a,b)=>{
    if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return a===b;
    if(Array.isArray(a)!==Array.isArray(b))return false;
    const ka=Object.keys(a),kb=Object.keys(b);return ka.length===kb.length&&ka.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));
   };
   return same(profile,expected);
  }catch{return false;}
 }
 function directions(axes,profile){
  if(!profile)return axes.map(a=>({...a,vector:[...a.vector]}));
  const angle=(i,j)=>{
   const key=axes[i].key+axes[j].key,reverse=axes[j].key+axes[i].key;
   const item=profile.squareness[key]||profile.squareness[reverse];
   if(!item||!Number.isFinite(item.microns))throw new TypeError('固有直角度が不正です。');
   return item.microns/referenceLength/1e6;
  };
  const x=axes[0].vector,y=axes[1].vector,xy=angle(0,1),yx=-Math.sin(xy),yy=Math.cos(xy);
  const vectors=[x,y.map((q,k)=>q*yy+x[k]*yx)];
  if(axes.length===3){
   const zx=-Math.sin(angle(0,2)),zy=(-Math.sin(angle(1,2))-zx*yx)/yy,zz=Math.sqrt(1-zx*zx-zy*zy);
   if(!Number.isFinite(zz))throw new RangeError('固有直角度を方向へ換算できません。');
   vectors.push(axes[2].vector.map((q,k)=>q*zz+y[k]*zy+x[k]*zx));
  }
  return axes.map((a,i)=>({...a,vector:vectors[i]}));
 }
 function rms(values){return Math.sqrt(values.reduce((s,v)=>s+v*v,0)/values.length);}
 // Convex quadratic approximation, bounded and quantized coordinate descent.
 // Multiple starts and two-leg polishing reduce grid traps; this is a reference
 // search result, not a certificate of a global optimum for the exact geometry.
 function optimize(matrix,bias,initial){
  const n=initial.length,m=bias.length;
  if(!n||!m||matrix.length!==m||!bias.every(Number.isFinite)||matrix.some(r=>r.length!==n||!r.every(Number.isFinite))||!initial.every(v=>Number.isFinite(v)&&Math.abs(v)<=.5))throw new TypeError('探索の入力が不正です。');
  const columns=Array.from({length:n},(_,j)=>matrix.map(r=>r[j]));
  const diagonal=columns.map(c=>c.reduce((s,v)=>s+v*v,0));
  const clamp=v=>quantize(Math.max(-.5,Math.min(.5,v)));
  const residual=h=>bias.map((v,i)=>v+matrix[i].reduce((s,q,j)=>s+q*h[j],0));
  const score=r=>r.reduce((s,v)=>s+v*v,0);
  let best=null;
  for(const start of [Array(n).fill(0),initial]){
   const heights=start.map(clamp),r=residual(heights);
   for(let sweep=0;sweep<120;sweep++){
    let changed=false;
    for(let j=0;j<n;j++){
     if(diagonal[j]<1e-15)continue;
     const gradient=columns[j].reduce((s,v,i)=>s+v*r[i],0),next=clamp(heights[j]-gradient/diagonal[j]),delta=next-heights[j];
     if(Math.abs(delta)>.0005&&2*gradient*delta+diagonal[j]*delta*delta< -1e-12){heights[j]=next;for(let i=0;i<m;i++)r[i]+=columns[j][i]*delta;changed=true;}
    }
    if(!changed)break;
   }
   for(let sweep=0;sweep<30;sweep++){
    let chosen=null,improvement=-1e-12;
    for(let a=0;a<n;a++)for(let b=a+1;b<n;b++)for(const da of [-.001,.001])for(const db of [-.001,.001]){
     if(Math.abs(heights[a]+da)>.50000001||Math.abs(heights[b]+db)>.50000001)continue;
     let change=0;for(let i=0;i<m;i++){const d=columns[a][i]*da+columns[b][i]*db;change+=2*r[i]*d+d*d;}
     if(change<improvement){improvement=change;chosen={a,b,da,db};}
    }
    if(!chosen)break;
    const {a,b,da,db}=chosen;heights[a]=clamp(heights[a]+da);heights[b]=clamp(heights[b]+db);for(let i=0;i<m;i++)r[i]+=columns[a][i]*da+columns[b][i]*db;
   }
   const value=score(r);if(!best||value<best.value)best={heights:[...heights],value};
  }
  return best;
 }
 return Object.freeze({referenceLength,distributions,random,generate,valid,directions,rms,optimize});
});

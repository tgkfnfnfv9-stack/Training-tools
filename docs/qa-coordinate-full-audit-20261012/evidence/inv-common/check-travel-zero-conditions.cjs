'use strict';
// Travel column (table fixed, column moves X on rails, head Y/Z on column), no intrinsic error.
// Own bilinear surface + own plane-normal frames. Compare:
//  local-angle x300 (settings), finite scan (live, product = re-aligned & re-zeroed = condition B),
//  own condition B, own condition A difference (master kept as aligned at the initial flat state,
//  fixed to the table, start zero kept: only end-start change is computable).
process.chdir('/home/user/Training-tools');
const env=require('/home/user/Training-tools/tests/leveling-dom-env.cjs');
const e=env({pureLeveling:true});e.read('openMachine(machines[2]);');
const sup=e.json('supports.map(s=>({...levelCoordinates(s.x,s.z),name:s.name}))'),D=2.6;
const xs=[...new Set(sup.map(p=>p.x))].sort((a,b)=>a-b),zs=[...new Set(sup.map(p=>p.z))].sort((a,b)=>a-b);
function slope(h,x,z){const iv=(v,q)=>{let i=0;while(i<v.length-2&&q>=v[i+1])i++;return i;};const i=iv(xs,x),j=iv(zs,z),H=(a,b)=>h[sup.findIndex(p=>p.x===xs[a]&&p.z===zs[b])];
 const dx=xs[i+1]-xs[i],dz=zs[j+1]-zs[j],u=(x-xs[i])/dx,v=(z-zs[j])/dz;
 return {lr:((H(i+1,j)-H(i,j))*(1-v)+(H(i+1,j+1)-H(i,j+1))*v)/dx,fb:((H(i,j+1)-H(i,j))*(1-u)+(H(i+1,j+1)-H(i+1,j))*u)/dz};}
const unit=v=>{const n=Math.hypot(...v);return v.map(q=>q/n);},dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function frame(s){const a=s.lr/1000,b=s.fb/1000,up=unit([-a,1,-b]),right=unit([1,a,0]),back=cross(right,up);return {right,up,back};}
const results=[];
for(const [label,k,dh] of [['raise 左・奥 +0.100',sup.findIndex(p=>p.name==='左・奥'),.1],['raise 中央・手前 +0.100',sup.findIndex(p=>p.name==='中央・手前'),.1],['raise 右・奥 +0.100',sup.findIndex(p=>p.name==='右・奥'),.1]]){
 const h=sup.map((_,i)=>i===k?dh:0);
 e.read(`positions={X:0,Y:0,Z:0,A:0,C:0};supportHeights=${JSON.stringify(h)};accuracyKey='';updateLeveling(false);`);
 const tool={x:-.5,z:D*.29},rails=[-1,1].map(q=>({x:-.5,z:D*.22+q*.1})),work={x:0,z:-D*.18};
 const sT=slope(h,tool.x,tool.z),sR=rails.map(p=>slope(h,p.x,p.z)),sG={lr:(sR[0].lr+sR[1].lr)/2,fb:(sR[0].fb+sR[1].fb)/2},sW=slope(h,work.x,work.z);
 const T=frame(sT),G=frame(sG),W=frame(sW);
 const dir={X:G.right,Y:T.back,Z:T.up};
 const flatW=frame({lr:0,fb:0}),masterA={X:W.right,Y:W.back}; // master faces rotate with the (fixed) table seat
 const obs=e.json(`levelGeometry.pairs.map(p=>{const m=referenceDisplayScan(p);return {key:p.key,local300:p.deviationMicroradians*.3,scan:m.microns,valid:m.valid,relSign:m.setup.relativeSign,base:m.setup.base,scan_axis:m.setup.scan}})`);
 for(const o of obs){
  const n=dir[o.base],S=dir[o.scan_axis];
  const ownLocal=-Math.asin(dot(dir[o.key[0]],dir[o.key[1]]))*.3e6;
  const ownB=-dot(n,S)*o.relSign*.3e6;
  const ownAdiff=-dot(masterA[o.base],S)*o.relSign*.3e6;
  const row={case:label,pair:o.key,ownLocal300:ownLocal,productLocal300:o.local300,ownB:ownB,productScanB:o.scan,ownA_endMinusStart:ownAdiff,A_minus_B:ownAdiff-ownB};
  results.push(row);console.log(JSON.stringify(row,(k,v)=>typeof v==='number'?Math.round(v*1000)/1000:v));
 }
 results.push({case:label,slopes:{tool:sT,guide:sG,work:sW},productToolLean:e.json('levelGeometry.toolLean'),productRelLean:e.json('levelGeometry.relativeLean'),ownToolLean:{front:Math.atan(sT.fb/1000)*1e6,right:-Math.atan(sT.lr/1000)*1e6}});
 console.log(JSON.stringify(results.at(-1)));
}
require('fs').writeFileSync(__dirname+'/travel-zero-conditions.json',JSON.stringify(results,null,1));

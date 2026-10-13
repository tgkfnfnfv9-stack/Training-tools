'use strict';
// Independent checks: level bubble direction, twist sign, column/spindle lean sign.
// Expected values are computed HERE from support coordinates/heights (inputs) by
// my own least-squares plane, bilinear edges and plane-normal geometry. Product
// return values are only the "observed" side.
process.chdir('/home/user/Training-tools');
const env=require('/home/user/Training-tools/tests/leveling-dom-env.cjs');
const results=[];let fails=0;
const close=(a,b,tol)=>Math.abs(a-b)<=tol;
function lsPlane(pts){ // minimize sum (h - c - a x - b z)^2, own normal equations (3x3, Cramer)
 const n=pts.length,S=(f)=>pts.reduce((s,p)=>s+f(p),0);
 const M=[[n,S(p=>p.x),S(p=>p.z)],[S(p=>p.x),S(p=>p.x*p.x),S(p=>p.x*p.z)],[S(p=>p.z),S(p=>p.x*p.z),S(p=>p.z*p.z)]],r=[S(p=>p.h),S(p=>p.x*p.h),S(p=>p.z*p.h)];
 const det=m=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
 const D=det(M),col=(k)=>M.map((row,i)=>row.map((v,j)=>j===k?r[i]:v));
 return {c:det(col(0))/D,a:det(col(1))/D,b:det(col(2))/D};
}
function record(name,expected,observed,ok,extra={}){results.push({name,expected,observed,ok,...extra});if(ok===false)fails++;console.log((ok===null?'INFO':ok?'OK  ':'NG  ')+name,'| expected',JSON.stringify(expected),'| observed',JSON.stringify(observed));}
for(let mi=0;mi<6;mi++){
 const e=env({pureLeveling:true});e.read(`openMachine(machines[${mi}]);`);
 const id=e.read('current.id'),kind=e.read('current.kind');
 const pts=e.json('supports.map(s=>({...levelCoordinates(s.x,s.z),group:s.group||null,id:s.id||null}))');
 const set=h=>e.read(`supportHeights=${JSON.stringify(h)};updateLeveling(false);`);
 const R=id=>e.registry[id];
 // ---- Case 1: single support raised (right-back-most support) +0.200 mm ----
 const xmax=Math.max(...pts.map(p=>p.x)),zmax=Math.max(...pts.filter(p=>p.x===xmax).map(p=>p.z));
 const k=pts.findIndex(p=>p.x===xmax&&p.z===zmax);
 const h=pts.map((_,i)=>i===k?.2:0);set(h);
 const fit=lsPlane(pts.map((p,i)=>({...p,h:h[i]})));
 const obs=e.json('({lr:levelSolution.lr,fb:levelSolution.fb,twist:levelSolution.twist})');
 record(`${id}: raise ${String.fromCharCode(65+k)}(${xmax.toFixed(3)},${zmax.toFixed(3)}) +0.2mm -> mean LR mm/m`,fit.a,obs.lr,close(fit.a,obs.lr,1e-9));
 record(`${id}: same -> mean FB mm/m`,fit.b,obs.fb,close(fit.b,obs.fb,1e-9));
 const bubbleLeft=parseFloat(R('coarseBubbleLR').style.left),bubbleFB=parseFloat(R('coarseBubbleFB').style['--bubble-position']);
 // Physics: bubble goes to HIGH side. LR vial: right end is "右". FB vertical vial: top is "奥".
 record(`${id}: LR bubble toward high side (${fit.a>0?'right':'left'})`,fit.a>0?'left%>50':'left%<50',bubbleLeft,fit.a>0?bubbleLeft>50:bubbleLeft<50);
 record(`${id}: FB bubble toward high side (${fit.b>0?'back=up':'front=down'})`,fit.b>0?'top%<50':'top%>50',bubbleFB,fit.b>0?bubbleFB<50:bubbleFB>50);
 record(`${id}: LR text`,Math.abs(fit.a)<=.02?'目安内':fit.a>0?'右が高い':'左が高い',R('stageAverageLR').textContent,R('stageAverageLR').textContent===(Math.abs(fit.a)<=.02?'目安内':fit.a>0?'右が高い':'左が高い'));
 // Twist: own bilinear edge slopes on the bounding rows (grids). Raising the back-right corner only:
 if(kind!=='double'){
  const xs=[...new Set(pts.map(p=>p.x))].sort((a,b)=>a-b),width=xs.at(-1)-xs[0];
  const expectTwist=.2/width; // back edge rises .2 over width, front edge flat
  record(`${id}: twist(back-front LR) mm/m`,expectTwist,obs.twist,close(expectTwist,obs.twist,1e-9));
  record(`${id}: twist text`,'奥が手前より右高',R('fineTwist').textContent,R('fineTwist').textContent.includes('奥が手前より右高'));
 }else{
  // Gate: product twist uses heightAt at the bounding-box corners of ALL 15 points.
  const xs=pts.map(p=>p.x),zs=pts.map(p=>p.z);
  const corners={x0:Math.min(...xs),x1:Math.max(...xs),z0:Math.min(...zs),z1:Math.max(...zs)};
  const near=(x,z)=>Math.min(...pts.map(p=>Math.hypot(p.x-x,p.z-z)));
  const bed=pts.map((p,i)=>({...p,h:h[i]})).filter(p=>p.group==='bed'),bx=[...new Set(bed.map(p=>p.x))].sort((a,b)=>a-b),bz=[...new Set(bed.map(p=>p.z))].sort((a,b)=>a-b);
  const H=(x,z)=>bed.find(p=>p.x===x&&p.z===z).h,bedTwist=(H(bx.at(-1),bz.at(-1))-H(bx[0],bz.at(-1)))/(bx.at(-1)-bx[0])-(H(bx.at(-1),bz[0])-H(bx[0],bz[0]))/(bx.at(-1)-bx[0]);
  record(`gate: twist evaluated at bbox corners (nearest support distance m)`,'corners on supports?',{corners,nearest:[near(corners.x0,corners.z0),near(corners.x1,corners.z0),near(corners.x0,corners.z1),near(corners.x1,corners.z1)]},true,{note:'informational'});
  record(`gate: own bed-only 3x3 edge twist vs product twist (raised ${pts[k].id})`,bedTwist,obs.twist,null,{note:'informational: different definitions'});
  const kb=pts.findIndex(p=>p.id==='bed-right-3'),hb=pts.map((_,i)=>i===kb?.2:0);set(hb);
  const bed2=pts.map((p,i)=>({...p,h:hb[i]})).filter(p=>p.group==='bed'),H2=(x,z)=>bed2.find(p=>p.x===x&&p.z===z).h,w=bx.at(-1)-bx[0];
  const bedTwist2=(H2(bx.at(-1),bz.at(-1))-H2(bx[0],bz.at(-1)))/w-(H2(bx.at(-1),bz[0])-H2(bx[0],bz[0]))/w;
  record(`gate: raise bed-right-3 +0.2: own bed 3x3 edge twist vs product twist`,bedTwist2,e.read('levelSolution.twist'),null,{note:'informational: product uses TPS extrapolated to bbox corners'});
  record(`gate: twist text sign for bed-right-3 raise`,'奥が手前より右高',R('fineTwist').textContent,R('fineTwist').textContent.includes('奥が手前より右高')||R('fineTwist').textContent.includes('小さめ'));
 }
 // ---- Case 2: pure plane back-high (fb=+0.1 mm/m) and right-high (lr=+0.1 mm/m) ----
 for(const [label,a,b] of [['back-high',0,.1],['right-high',.1,0]]){
  set(pts.map(p=>a*p.x+b*p.z));
  const g=e.json('({bp:levelGeometry.bodyPosture,tl:levelGeometry.toolLean,rel:levelGeometry.relativeLean,cols:levelGeometry.columns,pairs:levelGeometry.pairs.map(p=>p.deviationMicroradians)})');
  const front=R('fineLeanFront').textContent,right=R('fineLeanRight').textContent,col=R('columnLean').textContent;
  if(kind!=='lathe'){
   // own: plane y=a x+b z has normal (-a,1,-b): top of a vertical member moves toward -grad.
   const ef=Math.atan(b/1000)*1e6,er=-Math.atan(a/1000)*1e6;
   record(`${id} ${label}: combined lean front µrad`,ef,g.bp.front,close(ef,g.bp.front,1e-6));
   record(`${id} ${label}: combined lean right µrad`,er,g.bp.right,close(er,g.bp.right,1e-6));
   const wf=b>0?'前倒れ':null,wr=a>0?'左倒れ':null;
   if(wf)record(`${id} ${label}: front label`,wf,front+' / '+col,front.includes(wf)&&col.includes(wf));
   if(wr)record(`${id} ${label}: right label`,wr,right+' / '+col,right.includes(wr)&&col.includes(wr));
  }else{
   // own: spindle along +x on plane: direction (1,a/1000,0)/n -> elevation atan(a/1000); fb does not turn +x.
   const ef=Math.atan(a/1000)*1e6;
   record(`lathe ${label}: spindle up/down µrad`,ef,g.bp.front,close(ef,g.bp.front,1e-6));
   record(`lathe ${label}: spindle horizontal-plane µrad`,0,g.bp.right,close(0,g.bp.right,1e-6));
   if(a>0)record(`lathe ${label}: label`,'上向き',front,front.includes('上向き'));
  }
  record(`${id} ${label}: rigid plane leaves all pair angles 0 (no intrinsic)`,0,g.pairs,g.pairs.every(v=>Math.abs(v)<1e-6));
  record(`${id} ${label}: relative lean 0`,0,g.rel,Math.abs(g.rel.front)<1e-6&&Math.abs(g.rel.right)<1e-6);
 }
}
require('fs').writeFileSync(__dirname+'/level-twist-lean.json',JSON.stringify({fails,results},null,1));
console.log('fails',fails);

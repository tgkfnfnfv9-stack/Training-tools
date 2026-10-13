'use strict';
// Audit probe for travel / gate(double, L3 15pt) / gantry.
// Run from repo root: node <this> > results.json
// Independent oracle (own*) uses ONLY: dimensions, support coordinates, support heights,
// seed-generated intrinsic squareness microns (input), stated axis assignments.
// It re-derives slopes, frames, directions and dial contacts with its own code.
const path=require('node:path');
const repo='/home/user/Training-tools';process.chdir(repo);
const e=require(path.join(repo,'tests/leveling-dom-env.cjs'))();
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),norm=a=>Math.hypot(...a),unit=a=>mul(a,1/norm(a));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const frameOf=(r,u,b)=>({right:r,up:u,back:b,rot:v=>add(add(mul(r,v[0]),mul(u,v[1])),mul(b,v[2]))});
// own orientation for a slope (mm/m): up = surface normal, right in x-y plane
function ownOrient(lr,fb){const a=lr/1000,b=fb/1000,u=unit([-a,1,-b]),r=unit([1,a,0]);return frameOf(r,u,cross(r,u));}
const compose=(A,B)=>frameOf(A.rot(B.right),A.rot(B.up),A.rot(B.back));
const T=(F,v)=>[dot(F.right,v),dot(F.up,v),dot(F.back,v)];// inverse of orthonormal frame
const intText=v=>{const m=Math.round(Math.abs(v));return m===0?'0':(v<0?'-':'+')+m;};
// own LSQ plane h=a x+b z+c
function lsq(pts){const n=pts.length,xm=pts.reduce((s,p)=>s+p.x,0)/n,zm=pts.reduce((s,p)=>s+p.z,0)/n,hm=pts.reduce((s,p)=>s+p.h,0)/n;let xx=0,zz=0,xz=0,xh=0,zh=0;for(const p of pts){const x=p.x-xm,z=p.z-zm,h=p.h-hm;xx+=x*x;zz+=z*z;xz+=x*z;xh+=x*h;zh+=z*h;}const d=xx*zz-xz*xz,a=(xh*zz-zh*xz)/d,b=(zh*xx-xh*xz)/d;return {a,b,c:hm-a*xm-b*zm,h:(x,z)=>hm+a*(x-xm)+b*(z-zm)};}
// own bilinear grid (cell choice: right/back cell on interior lines, extend outer cells)
function grid(pts){const xs=[...new Set(pts.map(p=>p.x))].sort((a,b)=>a-b),zs=[...new Set(pts.map(p=>p.z))].sort((a,b)=>a-b);const H=(x,z)=>pts.find(p=>p.x===x&&p.z===z).h;
 const iv=(vs,v)=>{let i=0;while(i<vs.length-2&&v>=vs[i+1])i++;return i;};
 const cell=(x,z)=>{const i=iv(xs,x),j=iv(zs,z),dx=xs[i+1]-xs[i],dz=zs[j+1]-zs[j];return {u:(x-xs[i])/dx,v:(z-zs[j])/dz,dx,dz,h00:H(xs[i],zs[j]),h10:H(xs[i+1],zs[j]),h01:H(xs[i],zs[j+1]),h11:H(xs[i+1],zs[j+1])};};
 return {height:(x,z)=>{const q=cell(x,z),f=q.h00+(q.h10-q.h00)*q.u,b=q.h01+(q.h11-q.h01)*q.u;return f+(b-f)*q.v;},
  slope:(x,z)=>{const q=cell(x,z);return {lr:((q.h10-q.h00)*(1-q.v)+(q.h11-q.h01)*q.v)/q.dx,fb:((q.h01-q.h00)*(1-q.u)+(q.h11-q.h10)*q.u)/q.dz};}};}
function plane3(pts){const p=lsq(pts);return {height:p.h,slope:()=>({lr:p.a,fb:p.b})};}
// intrinsic directions from squareness microns (individual definition: angle=microns/300mm)
function intrinsic(vecs,sq){const ang=k=>sq[k].microns/.3/1e6,[x,y,z]=vecs,xy=ang('XY'),yx=-Math.sin(xy),yy=Math.cos(xy),Y=add(mul(y,yy),mul(x,yx));const zx=-Math.sin(ang('XZ')),zy=(-Math.sin(ang('YZ'))-zx*yx)/yy,zz=Math.sqrt(1-zx*zx-zy*zy);return [x,Y,add(add(mul(z,zz),mul(y,zy)),mul(x,zx))];}
function minimalRotation(from,to){const c=cross(from,to),s2=dot(c,c),co=dot(from,to);return v=>{if(s2<1e-24)return [...v];const d=dot(c,v),t=cross(c,v);return v.map((q,i)=>q*co+t[i]+c[i]*d*(1-co)/s2);};}

// ---- own model of each machine (declared posture assumptions of the teaching model) ----
function ownModel(kind,m,cfg,pts,heights,state,profile){
 const P=pts.map((p,i)=>({x:p.x,z:p.z,h:heights[i],group:p.group}));
 const g=lsq(P),common=ownOrient(g.a,g.b);
 const vecs=[[1,0,0],kind==='travel'?[0,0,1]:[1,0,0],[0,1,0]];if(kind!=='travel')vecs[0]=[0,0,1];
 // axis vectors: travel X=[1,0,0] Y=[0,0,1] Z=[0,1,0]; double/gantry X=[0,0,1] Y=[1,0,0] Z=[0,1,0]
 const amp=kind==='travel'?{X:1,Y:.35,Z:.3}:{X:.7,Y:.65,Z:.28},move=k=>amp[k]*state[k]/100;
 const sx=cfg.width/(m.w*.8),sz=cfg.depth/(m.d*.8);
 const iv=intrinsic(vecs,profile.squareness);
 let X,Y,Z,tool,work,toolRigid,seatInfo={};
 if(kind==='travel'){
  const s=grid(P),D=m.d,cx=-.5+move('X');
  const rails=[-1,1].map(k=>s.slope(cx*sx,(D*.22+k*.1)*sz)),gs={lr:(rails[0].lr+rails[1].lr)/2,fb:(rails[0].fb+rails[1].fb)/2};
  const seat=s.slope(cx*sx,D*.29*sz);tool=ownOrient(seat.lr,seat.fb);work=(()=>{const w=s.slope(0,-D*.18*sz);return ownOrient(w.lr,w.fb);})();
  X=unit(ownOrient(gs.lr,gs.fb).rot(iv[0]));Y=unit(tool.rot(iv[1]));Z=unit(tool.rot(iv[2]));toolRigid=tool;seatInfo={columnX:cx*sx,railSlope:gs,seatSlope:seat};
 }else{
  const parts=kind==='double';
  const surf=parts?{bed:grid(P.filter(p=>p.group==='bed')),left:plane3(P.filter(p=>p.group==='column-left')),right:plane3(P.filter(p=>p.group==='column-right'))}:null,s=parts?null:grid(P);
  const cols=[-1,1].map(k=>({x:k*(m.columnX??m.w*.4)*sx,z:(kind==='gantry'?move('X'):(m.columnZ??0))*sz}));
  const columns=cols.map((p,i)=>{const S=parts?(i?surf.right:surf.left):s,sl=S.slope(p.x,p.z),rel=ownOrient(sl.lr-g.a,sl.fb-g.b),res=S.height(p.x,p.z)-g.h(p.x,p.z),foot=[p.x,res/1000,p.z];return {foot,top:add(foot,mul(rel.up,2.51)),rel,slope:sl};});
  const right=unit(sub(columns[1].top,columns[0].top)),up=unit(mul(add(columns[0].rel.up,columns[1].rel.up),.5)),back=unit(cross(right,up));
  tool=compose(common,frameOf(right,up,back));// affine (right not orthogonal to up)
  const wq={x:0,z:(kind==='double'?move('X'):0)*sz};
  if(parts){const sl=surf.bed.slope(wq.x,wq.z);work=compose(common,ownOrient(sl.lr-g.a,sl.fb-g.b));}else{const sl=s.slope(wq.x,wq.z);work=ownOrient(sl.lr,sl.fb);}
  if(kind==='gantry'){const gs=columns.map(c=>c.slope),m2={lr:(gs[0].lr+gs[1].lr)/2,fb:(gs[0].fb+gs[1].fb)/2};X=unit(ownOrient(m2.lr,m2.fb).rot(iv[0]));}else X=unit(work.rot(iv[0]));
  Y=unit(tool.rot(iv[1]));Z=unit(tool.rot(iv[2]));
  const u=unit(tool.up),r=unit(sub(tool.right,mul(u,dot(tool.right,u))));toolRigid=frameOf(r,u,cross(r,u));
  seatInfo={columns:columns.map(c=>({slope:c.slope,lean:{front:Math.atan2(-c.rel.up[2],c.rel.up[1])*1e6,right:Math.atan2(c.rel.up[0],c.rel.up[1])*1e6}}))};
 }
 const body=minimalRotation([0,1,0],iv[2]);
 const spindle=unit(tool.rot(iv[2])),spRight=tool.rot(body([1,0,0])),tableNormal=unit(cross(work.back,work.right));
 return {X,Y,Z,tool,toolRigid,work,spindle,spRight,tableNormal,common,seatInfo};
}
// own dial-on-plane contact (S face through origin, normal n; dial body b; probe p)
const ext=(n,b,p)=>dot(n,mul(b,-1))/dot(n,p);
// own spindle sweep: ring radius r in plane normal to axis, dial tip reaches table plane along -axis
function ownSweep(axis,n,right,r=.15){const first=unit(sub(right,mul(axis,dot(right,axis)))),e90=unit(cross(first,axis)),e0=unit(cross(axis,e90));
 const h=th=>{const c=Math.cos(th*Math.PI/180),s=Math.sin(th*Math.PI/180),ring=mul(add(mul(e0,c),mul(e90,s)),r);return -dot(n,ring)/dot(n,axis);};
 const zero=h(270);return [0,90,180,270].map(t=>(h(t)-zero)*1e6);}

const machines={travel:'travel',gate:'double',gantry:'gantry'};
const pairs=['XY','XZ','YZ'],dirOf=(o,k)=>o[k];
function setState(id,seed,cond,heights,pos){
 e.read(`openMachine(machines.find(m=>m.id==='${id}'));machineProfile=window.MachineAccuracy.generate('${cond}',${seed},machineLinearKeys(),supports.length);machineReference=null;supportHeights=${heights?JSON.stringify(heights):'[...machineProfile.initialHeights]'};positions=${JSON.stringify({X:0,Y:0,Z:0,A:0,C:0,...pos})};updateLeveling(false);`);
}
function snapshot(id,kind){
 const meta=e.json('({m:current,cfg:levelConfig,pts:supports.map(s=>({...levelCoordinates(s.x,s.z),group:s.group||null})),h:supportHeights,state:positions,profile:machineProfile})');
 const own=ownModel(kind,meta.m,meta.cfg,meta.pts,meta.h,meta.state,meta.profile);
 const scans={};
 for(const k of pairs){
  const r=e.json(`(()=>{const r=referenceScan({key:'${k}'});return {valid:r.valid,reason:r.reason,microns:r.microns,fixture:r.fixture,model:r.model,setup:r.setup,startPosition:r.startPosition,endPosition:r.endPosition,zero:r.zero,last:r.last,start:r.start,end:r.end,sampleTimes:r.samples?.map(s=>s.t)}})()`);
  const local=e.json(`geometryModel().pairs.find(p=>p.key==='${k}').deviationMicroradians`)*.3;
  const L=r.endPosition-r.startPosition,n=own[k[0]],S=own[k[1]];
  // own: S face normal = base axis at current state (product's declared re-alignment B), dial body at +10 mm, probe -n, carried with scan member by S*L
  const e0=ext(n,mul(n,.01),mul(n,-1)),e1=ext(n,add(mul(S,L),mul(n,.01)),mul(n,-1));
  const ownMicrons=(e0-e1)*1e6;
  scans[k]={...r,display:r.valid?intText(r.microns):'—',localAngle300:local,ownMicrons,ownDisplay:intText(ownMicrons),diffVsOwn:r.microns-ownMicrons,
   setupSummary:{base:r.setup.base,scan:r.setup.scan,owner:r.setup.owner,member:r.setup.member,body:r.setup.body,mount:r.setup.mount,scanDirection:r.setup.scanDirection,relativeDirection:r.setup.relativeDirection,zeroLocation:r.setup.zeroLocation,normalDirection:r.setup.normalDirection,memberSign:r.setup.memberSign}};
 }
 const sw=e.json(`(()=>{const g=spindleSweepGeometry(positions,levelSolution,machineProfile,1,false);return g.valid?{valid:true,cardinal:g.cardinal.map(c=>({deg:c.degrees,reading:c.readingMicrons,onTable:c.onTable,contact:c.contact})),nose:g.nose,centre:g.centre,tableCentre:g.tableCentre,axis:g.measurement.axis,tableNormal:g.tableNormal,tir:g.measurement.tirMicrons}:g})()`);
 const ownSw=ownSweep(own.spindle,own.tableNormal,own.spRight);
 const lean=e.json('(()=>{const g=geometryModel();return {bodyLean:g.bodyLean,columns:g.columns,toolLean:g.toolLean,relativeLean:g.relativeLean,bodyColumns:g.bodyColumns}})()');
 return {state:meta.state,heights:meta.h,scans,sweep:{...sw,display:sw.valid?sw.cardinal.map(c=>c.onTable?intText(c.reading):'面外'):null,own:ownSw,ownDisplay:ownSw.map(intText)},lean,own:{X:own.X,Y:own.Y,Z:own.Z,spindle:own.spindle,tableNormal:own.tableNormal,seatInfo:own.seatInfo,spindleVsZ_microrad:Math.acos(Math.min(1,dot(own.spindle,own.Z)))*1e6},_own:own};
}
// Condition A increment: keep master (on table) orientation and dial (on spindle) orientation from BEFORE,
// transport them rigidly with their carriers, scan with the AFTER scan direction. Start translation is
// 条件不足 (master location on table / dial arm undefined in non-horizontal referenceScan), so only the
// scan increment is reported.
function conditionA(before,after,k,L){
 const b=before._own,a=after._own,n0=b[k[0]],p0=mul(n0,-1);
 const nA=a.work.rot(T(b.work,n0)),pA=a.toolRigid.rot(T(b.toolRigid,p0)),S=a[k[1]];
 const incA=-(ext(nA,add(mul(S,L),[0,0,0]),pA)-ext(nA,[0,0,0],pA))*1e6;
 return {A_scanIncrement:incA,A_display:intText(incA),note:'始点の並進分は条件不足（マス設置位置・測定腕未定義）'};
}
const out={commit:require('node:child_process').execSync('git rev-parse HEAD').toString().trim(),seed:20261012,condition:'new',support:'各機種で指定の支持（1始まり番号）を+0.100 mm。travel:1,2 gate:1,5,10 gantry:1,3',cases:{}};
for(const [id,kind] of Object.entries(machines)){
 const cases=[{name:'axis0',pos:{}},{name:'axisMoved',pos:id==='travel'?{X:45,Y:-50,Z:60}:{X:60,Y:-50,Z:60}}];
 out.cases[id]={};
 for(const c of cases){
  for(const idx of ({travel:[0,1],gate:[0,4,9],gantry:[0,2]})[id]){
  setState(id,20261012,'new',null,c.pos);const before=snapshot(id,kind);
  const h=[...before.heights];h[idx]=Math.round((h[idx]+.1)*1000)/1000;setState(id,20261012,'new',h,c.pos);const after=snapshot(id,kind);
  const A={};for(const k of pairs){const L=after.scans[k].endPosition-after.scans[k].startPosition;A[k]={...conditionA(before,after,k,L),B_productAfter:after.scans[k].microns,B_productBefore:before.scans[k].microns};}
  // Sweep condition A at front (needs nose-table axial distance): uses PRODUCT-ASSUMED points (reference only)
  const sweepA=before.sweep.valid&&after.sweep.valid?(()=>{const nb=before.sweep,na=after.sweep;const front=s=>{const ax=s.axis,n=s.tableNormal,c=s.cardinal[3].contact;return dot(sub(c,s.nose),ax);};return {frontAxialChange_um_productPoints:(front(na)-front(nb))*1e6,note:'製品の描画点(nose/tableCentre)を使った参考値。独立期待値ではない'};})():null;
  delete before._own;delete after._own;
  out.cases[id][c.name+'_support'+(idx+1)]={operated:{index:idx,support:idx+1,delta_mm:.1},before,after,conditionA:A,sweepA};
  }
 }
}
// R-alignment over finite 300 mm X travel vs local tangent (product B uses tangent at current X)
out.rAlignment={};
for(const [id,kind] of Object.entries(machines)){
 const res=[];
 for(const op of [null,...({travel:[0,1],gate:[4,9],gantry:[2]})[id]])for(const X0 of [0,30,45,60]){
  setState(id,20261012,'new',null,{X:X0});if(op!==null)e.read(`supportHeights[${op}]=Math.round((supportHeights[${op}]+.1)*1000)/1000;updateLeveling(false);`);const meta=e.json('({m:current,cfg:levelConfig,pts:supports.map(s=>({...levelCoordinates(s.x,s.z),group:s.group||null})),h:supportHeights,profile:machineProfile})');
  const amp=kind==='travel'?1:.7,dX=.3/amp*100;
  const m0=ownModel(kind,meta.m,meta.cfg,meta.pts,meta.h,{X:X0,Y:0,Z:0},meta.profile),m1=ownModel(kind,meta.m,meta.cfg,meta.pts,meta.h,{X:X0+dX,Y:0,Z:0},meta.profile);
  // chord of guide direction (own integration, 64 steps)
  let chord=[0,0,0];for(let i=0;i<64;i++){const mm=ownModel(kind,meta.m,meta.cfg,meta.pts,meta.h,{X:X0+dX*(i+.5)/64,Y:0,Z:0},meta.profile);chord=add(chord,mul(mm.X,.3/64));}
  const cu=unit(chord),tangentVsChord=Math.acos(Math.min(1,dot(cu,m0.X)))*1e6;
  // carrier rotation over the travel (column/gate for travel/gantry, table for double): change of carrier frame
  const C0=kind==='double'?m0.work:m0.toolRigid,C1=kind==='double'?m1.work:m1.toolRigid;
  const rot=[[1,0,0],[0,1,0],[0,0,1]].map(v=>sub(C1.rot(T(C0,v)),v));// (R-I) columns approx skew
  const lever=kind==='travel'?[0,.99,-1.054]:kind==='double'?[0,.46,0]:[0,-1.26,-.23];// product-assumed points: nose/table-centre relative to carrier pivot
  const dTip=[0,1,2].map(i=>rot[0][i]*lever[0]+rot[1][i]*lever[1]+rot[2][i]*lever[2]);
  res.push({operatedSupport:op===null?null:op+1,X0,X1:X0+dX,tangentVsChord_urad:tangentVsChord,tangentVsChord_um300:tangentVsChord*.3,carrierRotation_dTip_um:mul(dTip,1e6),lever_m:lever,leverSource:'製品のspindleSweepMachineGeometry描画点からの推定（ユーザー未指定）'});
 }
 out.rAlignment[id]=res;
}
// range / out-of-table checks
out.ranges={};
for(const [id,kind] of Object.entries(machines)){
 const r=[];
 for(const pos of [{X:-100,Y:-100,Z:-100},{X:100,Y:100,Z:100},{X:100,Y:-100,Z:0}])for(const hs of ['init','max']){
  setState(id,20261012,'used',null,pos);if(hs==='max')e.read('supportHeights=supportHeights.map((h,i)=>i%2?.5:-.5);updateLeveling(false);');
  const v=e.json(`(()=>{const s=['XY','XZ','YZ'].map(k=>{const r=referenceScan({key:k});return {k,valid:r.valid,reason:r.reason,microns:r.microns,ext0:r.zero?.extension,ext1:r.last?.extension}});const g=spindleSweepGeometry(positions,levelSolution,machineProfile,1,false);return {s,sweep:g.valid?g.cardinal.map(c=>({deg:c.degrees,reading:c.readingMicrons,onTable:c.onTable})):g.reason}})()`);
  r.push({pos,heights:hs,...v});
 }
 out.ranges[id]=r;
}
console.log(JSON.stringify(out,null,1));

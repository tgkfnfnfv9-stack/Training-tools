'use strict';
const ROOT=process.env.ROOT||'/home/user/Training-tools';
process.chdir(ROOT);
const O=require('./horizontal-oracle.cjs'),L=require('./lib.cjs');
const e=require(ROOT+'/tests/leveling-dom-env.cjs')();
const MA=require(ROOT+'/src/machine-accuracy.js');
e.read('openMachine(machines[1]);');
const intText=v=>{const m=Math.round(Math.abs(v));return m===0?'0':(v<0?'-':'+')+m;};
function setProduct(cfg,prof,heights,state){
 e.read(`levelConfig.width=${cfg.width};levelConfig.depth=${cfg.depth};levelConfig.columnX=${cfg.columnX};levelConfig.columnZ=${cfg.columnZ};machineProfile=${JSON.stringify(prof)};supportHeights=${JSON.stringify(heights)};positions=${JSON.stringify({...state,A:0,C:0})};updateLeveling();`);
 const sq=e.body.querySelectorAll('.live-pair-error-value').map(el=>{let n=el;while(n&&!n.classList.contains('live-squareness-item'))n=n.parentElement;const svg=n.querySelectorAll('svg')[0];return {pair:svg.getAttribute('data-pair'),local:Number(svg.getAttribute('data-local-angle-microradians')),value:el.getAttribute('data-reading-microns'),text:el.textContent};});
 const par=[0,1].map(i=>({value:e.registry['sweepValue'+i].getAttribute('data-reading-microns'),text:e.registry['sweepValue'+i].textContent}));
 return {sq,par};
}
const seeds=[['new',7],['used',20261012],['used',424242]];
const states=[{X:0,Y:0,Z:0},{X:70,Y:-60,Z:45},{X:-100,Y:100,Z:-100},{X:100,Y:-100,Z:100}];
const cfgs=[{width:2.72,depth:3.68,columnX:0,columnZ:0},{width:2.72,depth:3.68,columnX:55,columnZ:-80},{width:2.2,depth:4.2,columnX:-30,columnZ:100}];
const ops=[{name:'A+0.100',f:h=>h.map((v,i)=>i===0?v+.1:v)},{name:'mid3-0.080',f:h=>h.map((v,i)=>i===3?v-.08:v)},{name:'H+0.050',f:h=>h.map((v,i)=>i===7?v+.05:v)},{name:'zero',f:h=>h.map(()=>0)}];
const res={cases:[],maxErr:{sq:0,par:0,local:0,text:0},mismatches:[]};
for(const [cond,seed] of seeds){
 const prof=MA.generate(cond,seed,['X','Y','Z'],8),sq={XY:prof.squareness.XY.microns,XZ:prof.squareness.XZ.microns,YZ:prof.squareness.YZ.microns};
 for(const cfg of cfgs)for(const state of states)for(const op of ops){
  if(cfg!==cfgs[0]&&state!==states[0]&&state!==states[1])continue;
  const before=prof.initialHeights,after=op.f(before).map(v=>Math.round(Math.max(-.5,Math.min(.5,v))*1000)/1000);
  const p=setProduct(cfg,prof,after,state),mB=O.model(cfg,after,sq),m0=O.model(cfg,before,sq);
  const dirs=mB.dirs(state),loc={XY:-Math.asin(L.dot(dirs.X,dirs.Y))*1e6,XZ:-Math.asin(L.dot(dirs.X,dirs.Z))*1e6,YZ:-Math.asin(L.dot(dirs.Y,dirs.Z))*1e6};
  const row={cond,seed,cfg,state,op:op.name,heightsBefore:before,heightsAfter:after,squareness:{},parallelism:{}};
  for(const key of ['XY','XZ','YZ']){
   const o=O.squareness(mB,key,state,m0),d=p.sq.find(q=>q.pair===key);
   const exp=o.B.valid?intText(o.B.microns):'—';
   if(d.text!==exp){res.maxErr.text++;res.mismatches.push({cond,seed,cfg,state,op:op.name,key,product:d,oracle:o.B});}
   if(o.B.valid&&d.value!==''){const err=Math.abs(Number(d.value)-o.B.microns);res.maxErr.sq=Math.max(res.maxErr.sq,err);if(err>1e-6)res.mismatches.push({cond,seed,cfg,state,op:op.name,key,product:d,oracle:o.B.microns});}
   else if(o.B.valid!==(d.value!==''))res.mismatches.push({cond,seed,cfg,state,op:op.name,key,validity:true,product:d,oracle:o.B});
   const le=Math.abs(d.local-loc[key]);res.maxErr.local=Math.max(res.maxErr.local,le);
   row.squareness[key]={product:{raw:d.value===''?null:Number(d.value),text:d.text,localAngle_urad:d.local},B:o.B.valid?{raw:o.B.microns,int:intText(o.B.microns),zeroExt_m:o.B.ext0,endExt_m:o.B.ext1,contactStart:o.B.contact0,contactEnd:o.B.contact1}:o.B,
    localAngleOracle_urad:loc[key],localAngleTimes300mm_um:loc[key]*.3,startPosition_m:o.startPosition,endPosition_m:o.endPosition,
    A:o.A&&o.A.endMicrons!==undefined?{...o.A,endInt:intText(o.A.endMicrons)}:o.A,C:o.C&&o.C.microns!==undefined?{raw:o.C.microns,int:intText(o.C.microns)}:o.C};
  }
  const par=O.parallelism(mB,state,m0);
  ['a','b'].forEach((ch,i)=>{const d=p.par[i],o=par[ch];const exp=o?.valid?intText(o.microns):'—';
   if(d.text!==exp){res.maxErr.text++;res.mismatches.push({cond,seed,state,op:op.name,ch,product:d,oracle:o});}
   if(o?.valid&&d.value!==''){const err=Math.abs(Number(d.value)-o.microns);res.maxErr.par=Math.max(res.maxErr.par,err);if(err>1e-6)res.mismatches.push({cond,seed,cfg,state,op:op.name,ch,product:d,oracle:o.microns});}
   row.parallelism[ch]={product:d,B:o?.valid?{raw:o.microns,int:intText(o.microns),zeroExt_m:o.ext0,endExt_m:o.ext1,contactStart:o.contact0,contactEnd:o.contact1}:o,A:o?.A?.endMicrons!==undefined?{...o.A,endInt:intText(o.A.endMicrons)}:o?.A,C:o?.C};
  });
  res.cases.push(row);
 }
}
// Rail centre line: column seat path (finite X feed) vs rail-mean guide direction (local angle)
const prof=MA.generate('used',20261012,['X','Y','Z'],8),sq={XY:prof.squareness.XY.microns,XZ:prof.squareness.XZ.microns,YZ:prof.squareness.YZ.microns};
const lineCheck=[];
for(const cfg of cfgs)for(const heights of [prof.initialHeights,[.1,-.05,.2,-.1,.0,.15,-.2,.05]])for(const X of [-100,-40,0,55,100])for(const seatZ of [.28,.29]){
 const m=O.model(cfg,heights,sq,{seatZ}),st={X,Y:0,Z:0},a=x=>{const q=m.anchor({...st,X:x});return m.s.Sp(q.x,q.z);},e1=1e-3;
 const path=L.unit(L.sub(a(X+e1),a(X-e1))),guide=L.app(m.guide(st),[1,0,0]);
 // nose path direction (includes the seat frame turning with X)
 const nose=x=>m.tool.nose({...st,X:x}),np=L.unit(L.sub(nose(X+e1),nose(X-e1)));
 lineCheck.push({cfg,heights,X,seatZ,seatPathVsRailGuide_urad:Math.acos(Math.min(1,L.dot(path,guide)))*1e6,nosePathVsRailGuide_urad:Math.acos(Math.min(1,L.dot(np,guide)))*1e6});
}
res.railLine={max_028:Math.max(...lineCheck.filter(q=>q.seatZ===.28).map(q=>q.seatPathVsRailGuide_urad)),max_029_oldDefinition:Math.max(...lineCheck.filter(q=>q.seatZ===.29).map(q=>q.seatPathVsRailGuide_urad)),maxNose_028:Math.max(...lineCheck.filter(q=>q.seatZ===.28).map(q=>q.nosePathVsRailGuide_urad)),rows:lineCheck};
// product geometry points (inputs only): guide points and tool seat
res.productLinePoints=[cfgs[0],cfgs[1],cfgs[2]].map(cfg=>{setProduct(cfg,prof,prof.initialHeights,{X:30,Y:0,Z:0});return e.json('({toolPoints:levelGeometry.toolPoints,guidePoints:levelGeometry.guidePoints,D:current.d})');});
// Common rigid tilt invariance
{
 const cfg=cfgs[1],st={X:70,Y:-60,Z:45},base=prof.initialHeights,hw=cfg.width/2,zs=[0,1,2,3].map(j=>(j/3-.5)*cfg.depth);
 const tilt=base.map((v,i)=>Math.round((v+.03*[-1,1][i%2]+.02*(Math.floor(i/2)-1.5)+.01)*1000)/1000);
 const pa=setProduct(cfg,prof,base,st),pb=setProduct(cfg,prof,tilt,st),ma=O.model(cfg,base,sq),mb=O.model(cfg,tilt,sq);
 res.rigidTilt={tilt,productBase:pa,productTilted:pb,maxSqDiff:Math.max(...pa.sq.map((q,i)=>Math.abs(Number(q.value)-Number(pb.sq[i].value)))),maxParDiff:Math.max(...pa.par.map((q,i)=>Math.abs(Number(q.value)-Number(pb.par[i].value)))),
  oracleA:['XY','XZ','YZ'].map(k=>{const o=O.squareness(mb,k,st,ma);return {k,Aend:o.A.endMicrons,AzeroPoint:o.A.zeroPointMicrons,Bbase:O.squareness(ma,k,st).B.microns};}),
  oracleParA:(()=>{const o=O.parallelism(mb,st,ma),b=O.parallelism(ma,st);return ['a','b'].map(ch=>({ch,Aend:o[ch].A.endMicrons,Bbase:b[ch].microns}));})()};
}
// Out-of-range: depth too small for 300 mm Z travel
{
 const cfg={width:2.72,depth:1.0,columnX:0,columnZ:0},p=setProduct(cfg,prof,prof.initialHeights,{X:0,Y:0,Z:0}),m=O.model(cfg,prof.initialHeights,sq);
 res.outOfRange={cfg,product:p,oracle:['XY','XZ','YZ'].map(k=>({k,valid:O.squareness(m,k,{X:0,Y:0,Z:0}).B.valid})),oraclePar:O.parallelism(m,{X:0,Y:0,Z:0}).valid};
}
require('fs').writeFileSync(__dirname+'/'+(process.env.OUT||'results-horizontal.json'),JSON.stringify(res,null,1));
console.log(JSON.stringify({n:res.cases.length,maxErr:res.maxErr,mismatches:res.mismatches.slice(0,6),railLine:{a:res.railLine.max_028,b:res.railLine.max_029_oldDefinition,c:res.railLine.maxNose_028},linePts:res.productLinePoints,rigid:{sq:res.rigidTilt.maxSqDiff,par:res.rigidTilt.maxParDiff,A:res.rigidTilt.oracleA,P:res.rigidTilt.oracleParA},oor:res.outOfRange},null,1));

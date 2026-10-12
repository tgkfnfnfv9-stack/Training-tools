'use strict';
process.chdir('/home/user/Training-tools');
const O=require('./compact-oracle.cjs');
const createEnv=require('/home/user/Training-tools/tests/leveling-dom-env.cjs');
const MA=require('/home/user/Training-tools/src/machine-accuracy.js');
const e=createEnv();
e.read('openMachine(machines[0]);');
const intText=v=>{const m=Math.round(Math.abs(v));return m===0?'0':(v<0?'-':'+')+m;};
function setProduct(cfg,profileObj,heights,state){
 e.read(`levelConfig.width=${cfg.width};levelConfig.depth=${cfg.depth};levelConfig.columnX=${cfg.columnX};levelConfig.columnZ=${cfg.columnZ};machineProfile=${JSON.stringify(profileObj)};supportHeights=${JSON.stringify(heights)};positions=${JSON.stringify({...state,A:0,C:0})};updateLeveling();`);
 const sq=e.body.querySelectorAll('.live-pair-error-value').map(el=>{let n=el;while(n&&!n.classList.contains('live-squareness-item'))n=n.parentElement;const svg=n?n.querySelectorAll('svg')[0]:null;return {pair:svg?.getAttribute('data-pair'),value:el.getAttribute('data-reading-microns'),text:el.textContent,model:el.getAttribute('data-reading-model'),gain:el.getAttribute('data-support-response-gain'),physical:el.getAttribute('data-physical-reading-microns')};});
 const sw=[0,1,2,3].map(i=>({value:e.registry['sweepValue'+i].getAttribute('data-reading-microns'),text:e.registry['sweepValue'+i].textContent}));
 return {sq,sw};
}
const seeds=[['new',7],['used',20261012],['used',424242],['new',99]];
const states=[{X:0,Y:0,Z:0},{X:60,Y:-70,Z:40},{X:-90,Y:95,Z:-80},{X:100,Y:-100,Z:100}];
const cfgs=[{width:2.08,depth:2.16,columnX:0,columnZ:0},{width:2.08,depth:2.16,columnX:63,columnZ:-71},{width:1.6,depth:2.6,columnX:-40,columnZ:30}];
const ops=[
 {name:'A+0.100',f:h=>h.map((v,i)=>i===0?v+.1:v)},
 {name:'D-0.050',f:h=>h.map((v,i)=>i===3?v-.05:v)},
 {name:'front-back(C,D +0.1)',f:h=>h.map((v,i)=>i>=2?v+.1:v)},
 {name:'twist+0.1',f:h=>h.map((v,i)=>v+[.1,-.1,-.1,.1][i])},
 {name:'zero',f:h=>h.map(()=>0)},
];
const results={cases:[],maxErr:{sq:0,sqText:0,sw:0,swText:0,closedForm:0},mismatches:[]};
for(const [cond,seed] of seeds){
 const prof=MA.generate(cond,seed,['X','Y','Z'],4),sq={XY:prof.squareness.XY.microns,XZ:prof.squareness.XZ.microns,YZ:prof.squareness.YZ.microns};
 for(const cfg of cfgs)for(const state of states)for(const op of ops){
  if(cfg!==cfgs[0]&&state!==states[0]&&state!==states[1])continue; // keep size moderate
  const before=prof.initialHeights,after=op.f(before).map(v=>Math.round(Math.max(-.5,Math.min(.5,v))*1000)/1000);
  const prod=setProduct(cfg,prof,after,state),mB=O.model(cfg,after,sq),m0=O.model(cfg,before,sq);
  const pairs=['XY','XZ','YZ'].map(k=>O.squareness(mB,k,state,m0)),sw=O.sweep(mB,state,m0);
  const row={cond,seed,cfg,state,op:op.name,heightsBefore:before,heightsAfter:after,squareness:{},sweep:{}};
  for(const p of pairs){
   const d=prod.sq.find(q=>q.pair===p.key),pv=Number(d.value),err=Math.abs(pv-p.B.microns);
   results.maxErr.sq=Math.max(results.maxErr.sq,err);if(p.B.closedForm!==undefined)results.maxErr.closedForm=Math.max(results.maxErr.closedForm,Math.abs(p.B.closedForm-p.B.microns));
   const textOk=d.text===intText(p.B.microns);if(!textOk)results.maxErr.sqText++;
   if(err>1e-6||!textOk)results.mismatches.push({cond,seed,cfg,state,op:op.name,pair:p.key,product:d,oracle:p.B.microns});
   row.squareness[p.key]={product:{raw:pv,text:d.text,model:d.model,gain:d.gain},B:{raw:p.B.microns,int:intText(p.B.microns),zeroExt_m:p.B.zeroExt,endExt_m:p.B.endExt,contactStart:p.B.contactStart,contactEnd:p.B.contactEnd},startPosition_m:p.startPosition,endPosition_m:p.endPosition,
    A:{zeroPointRaw:p.A.zeroPointMicrons,endRaw:p.A.endMicrons,endInt:intText(p.A.endMicrons),extBeforeZero_m:p.before.zeroExt,extAfterStart_m:p.A.extStart,extAfterEnd_m:p.A.extEnd,contactBeforeZero:p.before.contact,contactAfterStart:p.A.contactStart,contactAfterEnd:p.A.contactEnd},
    C:{raw:p.C.microns,int:intText(p.C.microns)}};
  }
  const names=['右','奥','左','手前'];
  sw.B.forEach((p,i)=>{
   const d=prod.sw[i],exp=p.onTable&&sw.B[3].onTable?intText(p.microns):(!p.onTable?'面外':'—');
   if(d.value!==''){const err=Math.abs(Number(d.value)-p.microns);results.maxErr.sw=Math.max(results.maxErr.sw,err);if(err>1e-6)results.mismatches.push({cond,seed,state,op:op.name,sweep:names[i],product:d,oracle:p.microns});}
   if(d.text!==exp){results.maxErr.swText++;results.mismatches.push({cond,seed,state,op:op.name,sweep:names[i],productText:d.text,expected:exp});}
   row.sweep[names[i]]={product:d,B:{raw:p.microns,onTable:p.onTable,contact:p.contact},A:{raw:sw.A[i].microns,int:intText(sw.A[i].microns),contact:sw.A[i].contact,axialExtensionChange_m:sw.A[i].extensionChange},C:{raw:sw.C[i].microns,int:intText(sw.C[i].microns)}};
  });
  results.cases.push(row);
 }
}
// Gain trace: response of YZ (and sweep) to a pure front/back support change at the centre.
const prof=MA.generate('new',7,['X','Y','Z'],4),sq={XY:0,XZ:0,YZ:0},cfg=cfgs[0];
const zeroProf={...prof,squareness:{XY:{...prof.squareness.XY},XZ:{...prof.squareness.XZ},YZ:{...prof.squareness.YZ}}};
const trace=[];
for(const [delta,H] of [['A+0.1',[.1,0,0,0]],['D+0.1',[0,0,0,.1]],['twist0.1',[.1,-.1,-.1,.1]],['rigid front-back C,D+0.1',[0,0,.1,.1]]]){
 const p0=setProduct(cfg,prof,[0,0,0,0],{X:0,Y:0,Z:0}),p1=setProduct(cfg,prof,H,{X:0,Y:0,Z:0});
 const s={XY:prof.squareness.XY.microns,XZ:prof.squareness.XZ.microns,YZ:prof.squareness.YZ.microns};
 const o0=O.model(cfg,[0,0,0,0],s),o1=O.model(cfg,H,s);
 const yz0=O.squareness(o0,'YZ',{X:0,Y:0,Z:0}).B.microns,yz1=O.squareness(o1,'YZ',{X:0,Y:0,Z:0}).B.microns;
 // physical relative angle change between Y feed tangent and Z feed (independent of contacts)
 const ang=m=>Math.asin(O.model(cfg,m,s).ydir({X:0,Y:0,Z:0}).reduce((a,v,i)=>a+v*O.model(cfg,m,s).zdir[i],0))*1e6;
 const dAngle=ang(H)-ang([0,0,0,0]);
 const pyz0=Number(p0.sq.find(q=>q.pair==='YZ').value),pyz1=Number(p1.sq.find(q=>q.pair==='YZ').value);
 const sw0=O.sweep(o0,{X:0,Y:0,Z:0}).B,sw1=O.sweep(o1,{X:0,Y:0,Z:0}).B;
 trace.push({op:delta,productYZChange:pyz1-pyz0,oracleYZChange:yz1-yz0,physicalAngleChange_urad:dAngle,expectedFrom300mm:dAngle*.3,ratioProductToPhysical:(pyz1-pyz0)/(yz1-yz0),productXY:[p0,p1].map(p=>Number(p.sq.find(q=>q.pair==='XY').value)),productXZ:[p0,p1].map(p=>Number(p.sq.find(q=>q.pair==='XZ').value)),
  productSweepBackChange:Number(p1.sw[1].value)-Number(p0.sw[1].value),oracleSweepBackChange:sw1[1].microns-sw0[1].microns});
}
results.gainTrace=trace;
// Common rigid tilt invariance (B and A) at a non-central state
{
 const s={XY:prof.squareness.XY.microns,XZ:prof.squareness.XZ.microns,YZ:prof.squareness.YZ.microns},st={X:60,Y:-70,Z:40},base=[.03,-.07,.12,-.02];
 const hw=1.04,hd=1.08,tilt=base.map((v,i)=>Math.round((v+.08*[-1,1,-1,1][i]*1+(-.05)*[-1,-1,1,1][i]+.02)*1000)/1000);
 const a=setProduct(cfg,prof,base,st),b=setProduct(cfg,prof,tilt,st);
 const oa=O.model(cfg,base,s),ob=O.model(cfg,tilt,s);
 const Arig=['XY','XZ','YZ'].map(k=>({k,A:O.squareness(ob,k,st,oa).A.endMicrons,Bbase:O.squareness(oa,k,st).B.microns}));
 results.rigidTilt={heightsBase:base,heightsTilted:tilt,productBase:a,productTilted:b,maxProductSqDiff:Math.max(...a.sq.map((q,i)=>Math.abs(Number(q.value)-Number(b.sq[i].value)))),maxProductSweepDiff:Math.max(...a.sw.map((q,i)=>q.value===''?0:Math.abs(Number(q.value)-Number(b.sw[i].value)))),oracleA_afterRigidTilt:Arig,
  sweepA:O.sweep(ob,st,oa).A.map(p=>p.microns)};
}
results.ritzCoefficientsPerUnitTwist=require('./lib.cjs').ritz(1.04,1.08);
require('fs').writeFileSync(__dirname+'/results-compact.json',JSON.stringify(results,null,1));
console.log(JSON.stringify({n:results.cases.length,maxErr:results.maxErr,mismatches:results.mismatches.slice(0,8),gainTrace:results.gainTrace,rigid:{sq:results.rigidTilt.maxProductSqDiff,sw:results.rigidTilt.maxProductSweepDiff,A:results.rigidTilt.oracleA_afterRigidTilt,sweepA:results.rigidTilt.sweepA}},null,1));

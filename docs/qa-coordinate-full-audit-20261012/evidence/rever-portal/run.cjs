'use strict';
const {execFileSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const O=require('./oracle.cjs');
const DIR=__dirname,txt=v=>{const m=Math.round(Math.abs(v));return m===0?'0':(v<0?'-':'+')+m;};
const SEEDS=[20261012,12345,987654321];
const POS=[{X:0,Y:0,Z:0},{X:37,Y:-45,Z:60},{X:-100,Y:100,Z:-100},{X:100,Y:-100,Z:100},{X:50,Y:30,Z:-20}];
const OPS={
 travel:{A_colBack:[[4,.1]],B_bedFront:[[1,-.15]],C_mix:[[3,.2],[2,-.1]],D_colRight:[[5,-.25]]},
 gate:{A_colLeftFront:[[9,.1]],B_bedCentre2:[[4,-.15]],C_colRightOuter_bedL3:[[14,.2],[6,-.1]],D_bothColumns:[[13,-.2],[10,.15]],E_bedRow1:[[0,.2],[1,.2],[2,.2]]},
 gantry:{A_leftMidFront:[[2,.1]],B_rightMidBack:[[5,-.15]],C_corners:[[0,.2],[7,-.1]],D_mid:[[3,.15],[4,-.15]]}
};
const KIND={travel:'travel',gate:'double',gantry:'gantry'};
const TILT={lr:.03,fb:-.02,c:.01};
const results={cases:[],tilt:[],extreme:[],summary:{}};
let maxSq=0,maxSw=0,intMismatch=[],stateMismatch=[];
for(const id of ['travel','gate','gantry'])for(const seed of SEEDS){
 // first a probe run to obtain the inputs (supports/initial heights/config)
 const scenarios=[];
 for(const p of POS){scenarios.push({label:'init',positions:p});for(const [k,ops] of Object.entries(OPS[id]))scenarios.push({label:k,positions:p,ops});}
 const meta=JSON.parse(execFileSync('node',[path.join(DIR,'product.cjs'),JSON.stringify({id,seed,scenarios:[]})],{maxBuffer:1e9}).toString());
 const H0=meta.initialHeights,cfg={kind:KIND[id],w:meta.machine.w,d:meta.machine.d,columnX:meta.machine.columnX,columnZ:meta.machine.columnZ,supportLayout:meta.machine.supportLayout,levelConfig:meta.levelConfig,supports:meta.supports,sq:meta.profile.squareness};
 const lc=meta.levelConfig,LXZ=p=>({x:p.x/(cfg.w*.8)*lc.width,z:p.z/(cfg.d*.8)*lc.depth});
 // rigid tilt scenarios (exact, injected)
 const tiltH=H0.map((h,i)=>{const q=LXZ(meta.supports[i]);return h+TILT.lr*q.x+TILT.fb*q.z+TILT.c;});
 for(const p of POS){scenarios.push({label:'tilt-base',positions:p,heights:H0,exact:true});scenarios.push({label:'tilt',positions:p,heights:tiltH,exact:true});}
 // extreme synthetic heights (beyond UI limits) to exercise invalid display
 const rng=(()=>{let s=seed>>>0;return ()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};})();
 const extremes=[];for(let k=0;k<6;k++){const amp=[20,60,120,200,300,400][k];extremes.push(H0.map(()=>Math.round((rng()*2-1)*amp*1000)/1000));}
 for(const H of extremes)for(const p of [POS[0],POS[2]])scenarios.push({label:'extreme',positions:p,heights:H,exact:true});
 const prod=JSON.parse(execFileSync('node',[path.join(DIR,'product.cjs'),JSON.stringify({id,seed,scenarios})],{maxBuffer:1e9}).toString());
 const rect=O.sweepRect(cfg,cfg.kind);
 for(const sc of prod.scenarios){
  const st={X:sc.positions.X,Y:sc.positions.Y,Z:sc.positions.Z},H=sc.heights,M=O.model(cfg,H),M0=O.model(cfg,H0);
  if(JSON.stringify(H)!==JSON.stringify(sc.requested))stateMismatch.push({id,seed,label:sc.label,requested:sc.requested,actual:H});
  const sq={};
  for(const pair of ['XY','XZ','YZ']){
   const b=O.squarenessB(M,pair,st),d=sc.dom.sq.find(q=>q.pair===pair),domRaw=d.raw===''?null:Number(d.raw);
   const expText=b.valid?txt(b.microns):'—',diff=b.valid&&domRaw!==null?domRaw-b.microns:null;
   if(diff!==null&&sc.label!=='extreme')maxSq=Math.max(maxSq,Math.abs(diff));
   if(expText!==d.text)intMismatch.push({id,seed,label:sc.label,positions:st,pair,expected:expText,expectedRaw:b.valid?b.microns:null,dom:d.text,domRaw});
   const row={B:b.valid?b.microns:null,Btext:expText,dom:d.text,domRaw,diff,zeroExt_mm:b.zero.ext*1e3,lastExt_mm:b.last.ext*1e3,validity:b.valid?'valid':(b.zero.reason||b.last.reason),
    alignment:b.mount.alignment?{xStart_mm:b.mount.alignment.xStart*1e3,xEnd_mm:b.mount.alignment.xEnd*1e3,chordLocal_mm:b.mount.alignment.chordLocal.map(v=>v*1e3)}:null,
    productAlignmentDiag:sc.diag[pair].alignment?{start_mm:sc.diag[pair].alignment.startPosition*1e3,chordLocal_mm:sc.diag[pair].alignment.chordLocal.map(v=>v*1e3)}:null};
   // A and C (only for ordinary op scenarios): mounting from initial heights H0 at this position
   if(!['extreme','tilt','tilt-base'].includes(sc.label)){
    const mt=O.mount(M0,pair,st),[a,e]=O.scanStates(M0,pair,st),z0=O.read(M0,mt,a),z0e=O.read(M0,mt,e),s1=O.read(M,mt,a),e1=O.read(M,mt,e);
    row.A={valid:z0.valid&&e1.valid,raw:(z0.ext-e1.ext)*1e6,text:z0.valid&&e1.valid?txt((z0.ext-e1.ext)*1e6):'—',ext_mm:{initialZero:z0.ext*1e3,afterStart:s1.ext*1e3,afterEnd:e1.ext*1e3},
     contact:{initialStart:z0.contact,afterStart:s1.contact,afterEnd:e1.contact,afterEndAlong_mm:e1.along*1e3,afterEndAcross_mm:e1.across*1e3},startJump:(z0.ext-s1.ext)*1e6};
    row.C={valid:s1.valid&&e1.valid,raw:(s1.ext-e1.ext)*1e6,text:s1.valid&&e1.valid?txt((s1.ext-e1.ext)*1e6):'—'};
    row.Binitial=(z0.ext-z0e.ext)*1e6;
    // sensitivity of A to the (unspecified) S contact point: same tool/master, contact moved 0.3 m along the scan
    const mt2={...mt,faceLocal:O.add(mt.faceLocal,O.mul(mt.tangentLocal,.0)),};
    const shiftUp=O.mul(O.unit(M0.pose(a).T.apply(M0.I.Z)),.3);
    const p0=M0.pose(a),mt3={...mt,faceLocal:O.add(mt.faceLocal,p0.W.inv(shiftUp)),bodyLocal:O.add(mt.bodyLocal,p0.T.inv(shiftUp))};
    const z3=O.read(M0,mt3,a),e3=O.read(M,mt3,e);row.A_contactUp300={raw:(z3.ext-e3.ext)*1e6,valid:z3.valid&&e3.valid};
   }
   sq[pair]=row;
  }
  // sweep
  const sw=O.sweepB(M,st,rect),zeroValid=sw[3].onTable;
  const swRows=sw.map((q,i)=>{const d=sc.dom.sweep[i],readable=zeroValid&&q.onTable,exp=readable?txt(q.microns):(!q.onTable?'面外':'—'),domRaw=d.raw===''?null:Number(d.raw);
   const diff=readable&&domRaw!==null?domRaw-q.microns:null;if(diff!==null&&sc.label!=='extreme')maxSw=Math.max(maxSw,Math.abs(diff));
   if(exp!==d.text)intMismatch.push({id,seed,label:sc.label,positions:st,sweep:i,expected:exp,expectedRaw:q.microns,dom:d.text,domRaw});
   return {B:q.microns,Btext:exp,dom:d.text,domRaw,diff,onTable:q.onTable};});
  let swA=null;
  if(!['extreme','tilt','tilt-base'].includes(sc.label)){const mt=O.sweepMount(M0,st),r0=O.sweepRead(M0,mt,st,rect),r1=O.sweepRead(M,mt,st,rect);
   swA={A:r1.map(q=>(r0[3].ext-q.ext)*1e6),C:r1.map(q=>(r1[3].ext-q.ext)*1e6),ext_mm:{initialFront:r0[3].ext*1e3,after:r1.map(q=>q.ext*1e3)}};}
  const rec={id,seed,label:sc.label,positions:st,heights:H,sq,sweep:swRows,sweepAC:swA};
  (sc.label==='extreme'?results.extreme:sc.label.startsWith('tilt')?results.tilt:results.cases).push(rec);
 }
}
results.summary={cases:results.cases.length,tiltScenarios:results.tilt.length,extremeScenarios:results.extreme.length,maxAbsSquarenessDiffMicrons:maxSq,maxAbsSweepDiffMicrons:maxSw,displayMismatches:intMismatch,heightStateMismatches:stateMismatch};
fs.writeFileSync(path.join(DIR,'results.json'),JSON.stringify(results,null,1));
console.log(JSON.stringify({...results.summary,displayMismatches:intMismatch.slice(0,30),nMismatch:intMismatch.length},null,1));

'use strict';
// Independent segment/solid-distance audit of the actual finite arm routes.
// Machine/master poses are observations here, not independent posture truth.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),root=path.resolve(__dirname,'..');process.chdir(root);
const {segmentBoxDistance}=require('./check-horizontal-fixture-independent-20261010.cjs');
const env=require('./leveling-dom-env.cjs')({pureLeveling:true});env.read("openMachine(machines.find(m=>m.kind==='horizontal'));$('exaggerate').checked=false;");
const profile=env.json("window.MachineAccuracy.generate('used',123456,['X','Y','Z'],8)"),source=fs.readFileSync('src/reference-measurement-ui.js');
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),sub=(a,b)=>a.map((x,i)=>x-b[i]),norm=v=>Math.hypot(...v),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dims=[[2.72,3.68],[.5,1.23]],cases=[['flat',()=>0],['twist+', (x,z)=>.05*x*z],['twist-', (x,z)=>-.05*x*z],...Array.from({length:8},(_,i)=>[-.5,.5].map(h=>['support'+i+':'+h,(_x,_z,j)=>i===j?h:0])).flat()];
const states=[{X:0,Y:0,Z:0},...[-100,100].flatMap(X=>[-100,100].flatMap(Y=>[-100,100].map(Z=>({X,Y,Z})))),...[-1e-5,0,1e-5].map(d=>({X:57,Y:43,Z:(-.6133333333333333+.85)/.45*100+d}))];
const summary={states:0,Rsegments:0,Ssegments:0,minRadiusClearanceM:Infinity,maxArmSegmentLengthChangeM:0,maxRzeroUm:0,maxRinteriorUm:0,minMasterBottomM:Infinity,minPalletEdgeMarginM:Infinity,maxBottomSpreadM:0},failures=[],worst=[];
for(const [width,depth]of dims)for(const [name,h]of cases)for(const used of [false,true])for(const state of states){
 const zs=[-depth/2,-depth/6,depth/6,depth/2],nodes=zs.flatMap(z=>[-width/2,width/2].map(x=>({x,z}))),heights=nodes.map((p,i)=>h(p.x,p.z,i));
 env.read(`levelConfig.width=${width};levelConfig.depth=${depth};levelConfig.columnX=0;levelConfig.columnZ=0;machineProfile=${JSON.stringify(used?profile:null)};supportHeights=${JSON.stringify(heights)};positions=${JSON.stringify({...state,A:0,C:0})};levelSolution=machineSolution(supportHeights);`);
 const obs=env.json(`(()=>{const m=referenceScan({key:'YZ'});if(!m.valid)return m;return {...m,Rboxes:m.alignment.samples.map(q=>({corner:q.pose.point,nR:q.pose.normal,nS:geometryModel(q.state).workFrame.rotate(m.master.localSnormal)}))}})()`),key={width,depth,name,used,state};summary.states++;
 if(!obs.valid){failures.push({...key,reason:'invalid measurement',detail:obs.reason});continue;}
 if(obs.bracket.sectionRadius!==.004)failures.push({...key,reason:'declared arm radius differs from 4 mm'});
 summary.maxRzeroUm=Math.max(summary.maxRzeroUm,Math.abs(obs.alignment.microns));
 for(const [stage,samples]of [['R',obs.alignment.samples],['S',obs.samples]])for(let k=0;k<samples.length;k++){
  const q=samples[k],box=stage==='R'?obs.Rboxes[k]:{corner:obs.master.corner,nR:obs.master.Rnormal,nS:obs.master.Snormal},axes=[box.nS,box.nR,cross(box.nS,box.nR)],local=p=>axes.map(n=>dot(sub(p,box.corner),n));
  if(stage==='R')summary.maxRinteriorUm=Math.max(summary.maxRinteriorUm,Math.abs((samples[0].extension-q.extension)*1e6));
  for(let j=1;j<q.arm.length;j++){
   summary[stage+'segments']++;const distance=segmentBoxDistance(local(q.arm[j-1]),local(q.arm[j]),[[-.31,.01],[-.32,0],[-.025,.025]]),clearance=distance-.004;
   if(clearance<summary.minRadiusClearanceM){summary.minRadiusClearanceM=clearance;worst[0]={...key,stage,t:q.t,segment:j-1,clearance};}
   if(clearance<-1e-10)failures.push({...key,stage,t:q.t,segment:j-1,reason:'4 mm radius arm intersects finite master',clearance});
   const oldLength=norm(sub(samples[0].arm[j],samples[0].arm[j-1])),length=norm(sub(q.arm[j],q.arm[j-1]));summary.maxArmSegmentLengthChangeM=Math.max(summary.maxArmSegmentLengthChangeM,Math.abs(length-oldLength));
  }
 }
 const m=obs.master,nT=cross(m.localSnormal,m.localRnormal),vertices=[];for(const s of m.boundsS)for(const r of m.boundsR)for(const t of m.boundsThickness)vertices.push(m.localCorner.map((v,i)=>v+s*m.localSnormal[i]+r*m.localRnormal[i]+t*nT[i]));
 const bottom=vertices.filter((_,i)=>i%4<2),minY=Math.min(...vertices.map(v=>v[1])),margin=Math.min(...vertices.flatMap(v=>[1.45*width/2.72/2-Math.abs(v[0]),1.45*depth/3.68/2-Math.abs(v[2])]));summary.minMasterBottomM=Math.min(summary.minMasterBottomM,minY);summary.minPalletEdgeMarginM=Math.min(summary.minPalletEdgeMarginM,margin);summary.maxBottomSpreadM=Math.max(summary.maxBottomSpreadM,Math.max(...bottom.map(v=>v[1]))-Math.min(...bottom.map(v=>v[1])));
 if(minY<=0||margin<=0)failures.push({...key,reason:'master below pallet or outside footprint',minY,margin});
}
const report={scope:'Exact line-segment to oriented rectangular solid minimum distance, with 4 mm arm radius subtracted. Includes first nose segment and all R/S sampled positions. Observed machine poses; this is not independent support-posture validation or full-machine collision certification.',sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),summary,worst,failures};fs.writeFileSync('docs/qa-horizontal-fixture-20261010/physical-arms.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({summary,worst,failureCount:failures.length,firstFailures:failures.slice(0,3)},null,2));if(failures.length)process.exitCode=1;

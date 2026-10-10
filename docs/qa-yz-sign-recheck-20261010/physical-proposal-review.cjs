'use strict';
const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'../..');process.chdir(root);
const env=require(root+'/tests/leveling-dom-env.cjs')({pureLeveling:true});
const candidate=fs.readFileSync(root+'/docs/qa-yz-sign-recheck-20261010/proposed-fixture.cjs','utf8');
let code=candidate.slice(candidate.indexOf('function proposedYZ'),candidate.indexOf('\nenv.read(proposedYZ.toString())'));
code=code.replaceAll('return {t,...hit','return {t,pose,...hit').replace('return {valid:R.every','return {debug:{rP0,rP1,pS,tS,rT0,bodyR,probeR,bodyS,probeS},valid:R.every');env.read(code);
env.read("openMachine(machines.find(m=>m.kind==='horizontal'));$('exaggerate').checked=false;");
const profile=env.json("window.MachineAccuracy.generate('used',123456,['X','Y','Z'],8)");
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]),plus=(a,b)=>a.map((v,i)=>v+b[i]),mul=(a,k)=>a.map(x=>x*k),norm=a=>Math.hypot(...a),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const trans=(f,v)=>[0,1,2].map(i=>f.right[i]*v[0]+f.up[i]*v[1]+f.back[i]*v[2]),inverse=(f,v)=>[f.right,f.up,f.back].map(q=>dot(q,v));
function rootAt(p){let lo=0,hi=.02;const f=e=>dot(p.normal,sub(plus(p.body,mul(p.probe,e)),p.point));let flo=f(lo);if(flo*f(hi)>0)return null;for(let n=0;n<60;n++){const mid=(lo+hi)/2;if(flo*f(mid)<=0)hi=mid;else{lo=mid;flo=f(mid);}}return (lo+hi)/2;}
const states=[{X:0,Y:0,Z:0},{X:0,Y:0,Z:-100},{X:100,Y:100,Z:100},{X:-100,Y:-100,Z:-100},{X:57,Y:43,Z:29}],cases=[['flat',()=>0],['GH+',(_x,_z,i)=>i>=6?.01:0],['GH-',(_x,_z,i)=>i>=6?-.01:0],...Array.from({length:8},(_,i)=>[-.5,.5].map(h=>['support'+i+':'+h,(_x,_z,j)=>i===j?h:0])).flat()];
const summary={states:0,contacts:0,maxRayErrorM:0,maxRendpointDistanceM:0,maxArmLocalDeltaM:0,maxSZeroErrorM:0,minMasterBottomPalletM:1,minFootprintMarginM:1,maxRArmM:0,maxSArmM:0,maxBottomHeightDifferenceM:0},rows=[],failures=[];
for(const [w,d]of [[2.72,3.68],[.5,1.23]])for(const [name,H]of cases)for(const used of [false,true])for(const state of states){
 const nodes=[-d/2,-d/6,d/6,d/2].flatMap(z=>[-w/2,w/2].map(x=>({x,z}))),heights=nodes.map((q,i)=>H(q.x,q.z,i));env.read(`levelConfig.width=${w};levelConfig.depth=${d};levelConfig.columnX=0;levelConfig.columnZ=0;machineProfile=${JSON.stringify(used?profile:null)};supportHeights=${JSON.stringify(heights)};positions=${JSON.stringify({...state,A:0,C:0})};levelSolution=machineSolution(supportHeights);`);
 const m=env.json('proposedYZ()');summary.states++;const key={w,d,name,used,state};if(!m.valid){failures.push({...key,reason:'contact invalid'});continue;}
 for(const stage of ['R','S'])for(const q of m[stage]){summary.contacts++;const e=rootAt(q.pose),err=e===null?1:Math.abs(e-q.extension);summary.maxRayErrorM=Math.max(summary.maxRayErrorM,err);if(err>1e-10)failures.push({...key,reason:'ray mismatch',stage,t:q.t,err});}
 summary.maxRendpointDistanceM=Math.max(summary.maxRendpointDistanceM,norm(sub(m.R[0].point,m.R.at(-1).point)));
 summary.maxSZeroErrorM=Math.max(summary.maxSZeroErrorM,Math.abs(m.S[0].extension-.01));
 const geometry=m.master,vertices=[];for(const s of geometry.boundsS)for(const r of geometry.boundsR)for(const t of geometry.boundsT)vertices.push(plus(geometry.c0,plus(mul(geometry.nS,s),plus(mul(geometry.nR,r),mul(cross(geometry.nS,geometry.nR),t)))));
 const bottom=vertices.filter((_,i)=>i%4<2),minY=Math.min(...vertices.map(v=>v[1])),footprintMargin=Math.min(...vertices.flatMap(v=>[1.45*w/2.72/2-Math.abs(v[0]),1.45*d/3.68/2-Math.abs(v[2])]));
 summary.minMasterBottomPalletM=Math.min(summary.minMasterBottomPalletM,minY);summary.minFootprintMarginM=Math.min(summary.minFootprintMarginM,footprintMargin);summary.maxBottomHeightDifferenceM=Math.max(summary.maxBottomHeightDifferenceM,Math.max(...bottom.map(v=>v[1]))-Math.min(...bottom.map(v=>v[1])));
 summary.maxRArmM=Math.max(summary.maxRArmM,norm(sub(m.debug.bodyR,m.debug.rT0.point)));summary.maxSArmM=Math.max(summary.maxSArmM,norm(sub(m.debug.bodyS,m.debug.tS.point)));
 const first=m.S[0].pose,second=m.S.at(-1).pose,head0=m.debug.tS.point,head1=env.json(`horizontalSpindleFixture({...positions,Y:${m.SendYmm/.3/10}},levelSolution,machineProfile).nose`);summary.maxArmLocalDeltaM=Math.max(summary.maxArmLocalDeltaM,norm(sub(sub(first.body,head0),sub(second.body,head1))));
 if((name==='GH+'||name==='GH-')&&!used&&w===2.72&&state.Z===-100&&state.X===0)rows.push({...key,raw:m.microns,RendpointUm:m.Rmicrons,zero:m.S[0].extension,firstPoint:m.S[0].point,lastPoint:m.S.at(-1).point});
 if(minY<=0||footprintMargin<0)failures.push({...key,reason:'master support clearance/footprint',minY,footprintMargin});
}
// A literal straight rod from the spindle nose to the S indicator crosses the
// proposed master at the upper-axis state; a bent/reaching arm is required.
env.read("levelConfig.width=2.72;levelConfig.depth=3.68;machineProfile=null;supportHeights=supports.map(()=>0);positions={X:0,Y:100,Z:100,A:0,C:0};levelSolution=machineSolution(supportHeights);");const m=env.json('proposedYZ()'),q0=inverse(m.debug.pS.frame,sub(m.debug.tS.point,m.debug.pS.point)),q1=inverse(m.debug.pS.frame,sub(m.debug.bodyS,m.debug.pS.point)),crossings=[];
for(let i=0;i<=1000;i++){const t=i/1000,p=plus(q0,mul(sub(q1,q0),t)),r=sub(p,m.master.c0),c=[dot(r,m.master.nS),dot(r,m.master.nR),dot(r,cross(m.master.nS,m.master.nR))];if(c[0]>-.31&&c[0]<.01&&c[1]>-.32&&c[1]<0&&Math.abs(c[2])<.025)crossings.push({t,local:p});}
const straightRod={state:{X:0,Y:100,Z:100},noseLocal:q0,bodyLocal:q1,firstIntersection:crossings[0],lastIntersection:crossings.at(-1),intersectionSamples:crossings.length};
const report={candidateSha256:require('crypto').createHash('sha256').update(candidate).digest('hex'),sourceSha256:require('crypto').createHash('sha256').update(fs.readFileSync(root+'/src/reference-measurement-ui.js')).digest('hex'),summary,GH:rows,failures,straightRod,limitations:'Candidate machine poses are observations. Plane intersections use independent bisection; known-GH expected values come from separate physical.json ramp derivation. This does not validate all possible bracket shapes or elastic stiffness.'};fs.writeFileSync(root+'/docs/qa-yz-sign-recheck-20261010/physical-proposal-review.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));

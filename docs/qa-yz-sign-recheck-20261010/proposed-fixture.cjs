'use strict';
// DESIGN EXPERIMENT ONLY. This does not alter the app or assert the user's setup.
// Machine material positions come from the current app. The candidate fixture,
// moving-master R alignment and ray/plane extension are calculated here.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');process.chdir(root);
const env=require(path.join(root,'tests/leveling-dom-env.cjs'))({pureLeveling:true});
function proposedYZ(state=positions,solution=levelSolution,profile=machineProfile){
 const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,k)=>a.map(v=>v*k),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),unit=a=>mul(a,1/Math.hypot(...a)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const rotate=(f,v)=>add(add(mul(f.right,v[0]),mul(f.up,v[1])),mul(f.back,v[2])),local=(f,v)=>[dot(v,f.right),dot(v,f.up),dot(v,f.back)],transport=(v,a,b)=>rotate(b,local(a,v));
 const tool=s=>{const t=horizontalSpindleFixture(s,solution,profile);return {point:t.nose,frame:{right:t.right,up:t.up,back:t.axis}};};
 const pallet=s=>{const g=geometryModel(s,solution,profile),up=unit(g.workFrame.up),right=unit(sub(g.workFrame.right,mul(up,dot(g.workFrame.right,up)))),back=cross(right,up);return {point:horizontalPalletPoint([0,1.27,-.85],s,solution,profile),frame:{right,up,back}};};
 const half=key=>{const a=axisConfig(current).find(a=>a.key===key),p=levelCoordinates(a.vector[0]*a.amp,a.vector[2]*a.amp);return Math.hypot(p.x,a.vector[1]*a.amp,p.z);};
 const yHalf=half('Y'),zHalf=half('Z'),length=.3;
 if(2*yHalf<length-1e-12||2*zHalf<length-1e-12)return {valid:false,reason:'300 mm travel unavailable'};
 const y0=Math.max(-yHalf,Math.min(yHalf-length,state.Y*yHalf/100)),z0=Math.max(-zHalf,Math.min(zHalf-length,state.Z*zHalf/100));
 const s0={...state,Y:y0/yHalf*100},rState=t=>({...s0,Z:(z0+length*t)/zHalf*100}),sState=t=>({...s0,Y:(y0+length*t)/yHalf*100});
 const rP0=pallet(rState(0)),rP1=pallet(rState(1)),rT0=tool(rState(0));
 // R is the top horizontal face; start is 10 mm in from its spindle-side end.
 const c0=[0,.37,.15],C=add(rP0.point,rotate(rP0.frame,c0)),c1=local(rP1.frame,sub(C,rP1.point));
 const nS=unit(sub(c0,c1)),nR=unit(sub([0,1,0],mul(nS,dot([0,1,0],nS)))),nT=cross(nS,nR);
 const bodyR=add(C,mul(rotate(rP0.frame,nR),.01)),probeR=mul(rotate(rP0.frame,nR),-1);
 const ray=pose=>{const length=dot(pose.normal,sub(pose.point,pose.body))/dot(pose.normal,pose.probe);return {extension:length,point:add(pose.body,mul(pose.probe,length)),valid:Number.isFinite(length)&&length>=0&&length<=.02};};
 const sampleTimes=[...new Set([0,1,...Array.from({length:15},(_,i)=>(i+1)/16),...supports.flatMap(p=>{const z=levelCoordinates(p.x,p.z).z,origin=levelCoordinates(0,-.85).z,t=(z-origin-z0)/length;return t>0&&t<1?[t-1e-8,t,t+1e-8]:[];})])].sort((a,b)=>a-b);
 const R=sampleTimes.map(t=>{const p=pallet(rState(t)),a=tool(rState(t)),pose={point:add(p.point,rotate(p.frame,c0)),normal:rotate(p.frame,nR),body:add(a.point,transport(sub(bodyR,rT0.point),rT0.frame,a.frame)),probe:transport(probeR,rT0.frame,a.frame)},hit=ray(pose),q=local(p.frame,sub(hit.point,p.point)),d=sub(q,c0),coord=[dot(d,nS),dot(d,nR),dot(d,nT)];return {t,...hit,coord,valid:hit.valid&&coord[0]>=-.310000001&&coord[0]<=.010000001&&Math.abs(coord[2])<=.025000001};});
 // Return pallet to the selected Z, keeping the aligned master attached. Y is
 // at the clamped S start. Attach a distinct rigid S arm and zero only here.
 const pS=pallet(s0),tS=tool(s0),sLocal=add(add(c0,mul(nS,.01)),mul(nR,-.31)),sPoint=add(pS.point,rotate(pS.frame,sLocal)),sNormal=rotate(pS.frame,nS),sUp=rotate(pS.frame,nR),bodyS=add(sPoint,mul(sNormal,.01)),probeS=mul(sNormal,-1);
 const S=Array.from({length:17},(_,i)=>i/16).map(t=>{const a=tool(sState(t)),pose={point:sPoint,normal:sNormal,body:add(a.point,transport(sub(bodyS,tS.point),tS.frame,a.frame)),probe:transport(probeS,tS.frame,a.frame)},hit=ray(pose),d=sub(hit.point,sPoint),coord=[dot(d,sNormal),dot(d,sUp)-.31,dot(d,rotate(pS.frame,nT))];return {t,...hit,coord,valid:hit.valid&&coord[1]>=-.320000001&&coord[1]<=.000000001&&Math.abs(coord[2])<=.025000001};});
 return {valid:R.every(q=>q.valid)&&S.every(q=>q.valid),microns:(S[0].extension-S.at(-1).extension)*1e6,Rmicrons:(R[0].extension-R.at(-1).extension)*1e6,RinteriorMaxUm:Math.max(...R.map(q=>Math.abs((R[0].extension-q.extension)*1e6))),startState:s0,RstartZmm:z0*1000,RendZmm:(z0+length)*1000,SstartYmm:y0*1000,SendYmm:(y0+length)*1000,master:{nS,nR,c0,boundsS:[-.31,.01],boundsR:[-.32,0],boundsT:[-.025,.025]},R,S};
}
env.read(proposedYZ.toString());env.read(`openMachine(machines.find(m=>m.kind==='horizontal'));$('exaggerate').checked=false;`);
const profile=env.json(`window.MachineAccuracy.generate('used',123456,['X','Y','Z'],8)`),rows=[],failures=[];
const dimensions=[[2.72,3.68],[3.8,2.7]],states=[{X:0,Y:0,Z:0},{X:-100,Y:-100,Z:-100},{X:100,Y:100,Z:100},{X:57,Y:43,Z:29}];
const cases=[['flat',()=>0],['twist+', (x,z)=>.05*x*z],['twist-',(x,z)=>-.05*x*z],['plane+', (x,z)=>.08*x+.06*z],['B+',(_x,_z,i)=>i===1?.01:0],['B-',(_x,_z,i)=>i===1?-.01:0],['E+',(_x,_z,i)=>i===4?.01:0]];
for(const [width,depth] of dimensions)for(const [name,height] of cases)for(const used of [false,true])for(const state of states){
 const nodes=[-depth/2,-depth/6,depth/6,depth/2].flatMap(z=>[-width/2,width/2].map(x=>({x,z}))),heights=nodes.map((p,i)=>height(p.x,p.z,i));
 env.read(`levelConfig.width=${width};levelConfig.depth=${depth};machineProfile=${JSON.stringify(used?profile:null)};supportHeights=${JSON.stringify(heights)};positions=${JSON.stringify({...state,A:0,C:0})};levelSolution=machineSolution(supportHeights);`);
 const old=env.json(`referenceScan({key:'YZ'})`),next=env.json(`proposedYZ()`);
 const row={dimensions:{width,depth},case:name,profile:used?'used/123456':'ideal',state,heightsMm:heights,old:{rawUm:old.microns,display:env.json(`squarenessMicronText(referenceScan({key:'YZ'}).microns)`),valid:old.valid},proposed:{rawUm:next.microns,display:env.json(`squarenessMicronText(proposedYZ().microns)`),valid:next.valid,RendpointUm:next.Rmicrons,RinteriorMaxUm:next.RinteriorMaxUm,RstartZmm:next.RstartZmm,RendZmm:next.RendZmm,SstartYmm:next.SstartYmm,SendYmm:next.SendYmm}};
 rows.push(row);if(!next.valid||Math.abs(next.Rmicrons)>1e-6)failures.push({...row,contacts:next});
}
const report={scope:'Unimplemented candidate: Z-aligned top R and spindle-side vertical S, head +Y scan. Fixture and contact calculation independent of production referenceScan. Machine pose providers are shared; this is a design feasibility sample, not independent validation of machine posture.',sourceSha256:crypto.createHash('sha256').update(fs.readFileSync('src/reference-measurement-ui.js')).digest('hex'),cases:rows.length,failureCount:failures.length,rows,failures};
fs.writeFileSync(path.join(__dirname,'proposed-fixture.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({cases:rows.length,failureCount:failures.length,maxRendpointUm:Math.max(...rows.map(r=>Math.abs(r.proposed.RendpointUm))),maxRinteriorUm:Math.max(...rows.map(r=>r.proposed.RinteriorMaxUm)),samples:rows.filter(r=>r.dimensions.width===2.72&&r.state.X===0&&r.profile==='used/123456')},null,2));
if(failures.length)process.exitCode=1;

'use strict';
// Independent physical oracle in a symmetric yz section. Support heights,
// planar rigid rotations and a scalar angle search determine the fixture.
// No production support/frame/alignment/contact function supplies expectations.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');process.chdir(root);
const phase=process.argv.includes('--before')?'before':'after';
const plus=(a,b)=>a.map((x,i)=>x+b[i]),minus=(a,b)=>a.map((x,i)=>x-b[i]),scale=(a,k)=>a.map(x=>x*k),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
// Coordinates below are (y,z). A surface rising toward +z has an upward
// normal tilted toward -z. Local y/z are rotated by -atan(surface slope).
const rotate=(a,v)=>[Math.cos(a)*v[0]+Math.sin(a)*v[1],-Math.sin(a)*v[0]+Math.cos(a)*v[1]];
// Exact minimum distance from a segment to an axis-aligned box. Split at
// each coordinate's entry/exit parameter; squared distance is quadratic on
// each interval. This is independent of the fixture's routed-arm builder.
function segmentBoxDistance(a,b,bounds){
 const d=minus(b,a),breaks=new Set([0,1]);for(let i=0;i<3;i++)if(d[i])for(const edge of bounds[i]){const t=(edge-a[i])/d[i];if(t>0&&t<1)breaks.add(t);}
 const ts=[...breaks].sort((a,b)=>a-b),distance=t=>Math.hypot(...a.map((v,i)=>{const x=v+t*d[i];return x<bounds[i][0]?x-bounds[i][0]:x>bounds[i][1]?x-bounds[i][1]:0;}));let best=Infinity;
 for(let j=0;j<ts.length-1;j++){const lo=ts[j],hi=ts[j+1],mid=(lo+hi)/2;let aa=0,bb=0;for(let i=0;i<3;i++){const x=a[i]+d[i]*mid,edge=x<bounds[i][0]?bounds[i][0]:x>bounds[i][1]?bounds[i][1]:null;if(edge!==null){aa+=d[i]*d[i];bb+=d[i]*(a[i]-edge);}}const t=aa?Math.max(lo,Math.min(hi,-bb/aa)):mid;best=Math.min(best,distance(lo),distance(hi),distance(t));}
 return best;
}
function section({depth,heightsMm,intrinsicYZ=0,columnZ=0}){
 const zs=[-depth/2,-depth/6,depth/6,depth/2],hs=heightsMm.map(x=>x/1000),b=zs.reduce((s,z,i)=>s+z*hs[i],0)/zs.reduce((s,z)=>s+z*z,0),c=hs.reduce((s,h)=>s+h,0)/4;
 function surface(z){z=zs.find(v=>Math.abs(v-z)<1e-12)??z;let k=0;while(k<2&&z>=zs[k+1])k++;const m=(hs[k+1]-hs[k])/(zs[k+1]-zs[k]);return {h:hs[k]+m*(z-zs[k]),m};}
 const common=Math.atan(b),headZ=(1.334+.46*columnZ/100)*depth/3.68,headAngle=common+Math.atan(surface(headZ).m-b),headY=rotate(headAngle,[1,0]);
 const travelHalf=.45*depth/3.68,baseZ=-.85*depth/3.68,profileAngle=intrinsicYZ/300000,guide=[-Math.sin(profileAngle),Math.cos(profileAngle)];
 function pallet(percent){const travel=percent*travelHalf/100,z=baseZ+travel,s=surface(z),angle=common+Math.atan(s.m-b),seat=plus(rotate(common,[s.h-b*z-c,z]),[.66+c,0]),top=plus(seat,rotate(angle,[.61+travel*guide[0],travel*(guide[1]-1)]));return {top,angle,z};}
 return {zs,hs,b,c,headY,headAngle,pallet,travelHalf,baseZ};
}
function fixture(input,state){
 const m=section(input),L=.3;if(2*m.travelHalf<L-1e-12)return {valid:false,reason:'short travel'};
 const z0=Math.max(-m.travelHalf,Math.min(m.travelHalf-L,state.Z*m.travelHalf/100)),y0=Math.max(-.3,Math.min(0,state.Y*.3/100));
 const p0=m.pallet(z0/m.travelHalf*100),p1=m.pallet((z0+L)/m.travelHalf*100),c0=[.37,.15],C=plus(p0.top,rotate(p0.angle,c0));
 // Find the physical angle of an orthogonal rectangular square by rotating
 // its R face until the fixed dial-tip point C lies on that face at BOTH
 // table endpoints. This angle search does not use the implementation's
 // inverse-coordinate chord or its fitted normal.
 const residual=angle=>dot(rotate(p1.angle,rotate(angle,[1,0])),minus(C,plus(p1.top,rotate(p1.angle,c0))));
 let lo=-.1,hi=.1,flo=residual(lo);if(flo*residual(hi)>0)throw Error('R angle not bracketed');
 for(let k=0;k<70;k++){const mid=(lo+hi)/2,fmid=residual(mid);if(flo*fmid<=0)hi=mid;else{lo=mid;flo=fmid;}}
 const angle=(lo+hi)/2,nR=rotate(angle,[1,0]),nS=rotate(angle,[0,1]),Rbody=plus(C,scale(rotate(p0.angle,nR),.01)),Rprobe=scale(rotate(p0.angle,nR),-1);
 function extension(body,probe,point,normal){const f=e=>dot(normal,minus(plus(body,scale(probe,e)),point));let lo=0,hi=.02,flo=f(lo);if(flo*f(hi)>0)return null;for(let k=0;k<60;k++){const mid=(lo+hi)/2;if(flo*f(mid)<=0)hi=mid;else{lo=mid;flo=f(mid);}}return (lo+hi)/2;}
 const times=new Set(Array.from({length:17},(_,i)=>i/16));for(const z of m.zs){const t=(z-m.baseZ-z0)/L;if(t>0&&t<1)for(const d of [-1e-8,0,1e-8])times.add(t+d);}
 const R=[...times].sort((a,b)=>a-b).map(t=>{const p=m.pallet((z0+L*t)/m.travelHalf*100),point=plus(p.top,rotate(p.angle,c0)),normal=rotate(p.angle,nR),e=extension(Rbody,Rprobe,point,normal);return {t,extension:e,point,normal,contact:e===null?null:plus(Rbody,scale(Rprobe,e))};});
 const returned=m.pallet(state.Z),normal=rotate(returned.angle,nS),up=rotate(returned.angle,nR),sLocal=plus(plus(c0,scale(nS,.01)),scale(nR,-.31)),point=plus(returned.top,rotate(returned.angle,sLocal)),body=plus(point,scale(normal,.01)),probe=scale(normal,-1);
 const S=Array.from({length:17},(_,i)=>{const t=i/16,b=plus(body,scale(m.headY,L*t)),e=extension(b,probe,point,normal);return {t,extension:e,body:b,point,normal,probe,contact:e===null?null:plus(b,scale(probe,e))};});
 // The square is now stationary. Y feed is a rigid head translation; moving
 // away from the +Z-facing S plane lengthens the plunger and reads negative.
 const expectedUm=-L*dot(normal,m.headY)*1e6;
 return {valid:R.every(q=>q.extension!==null)&&S.every(q=>q.extension!==null),expectedUm,angle,nR,nS,point,normal,up,R,S,headY:m.headY,returnedZPercent:state.Z,RstartMm:z0*1000,RendMm:(z0+L)*1000,SstartMm:y0*1000,SendMm:(y0+L)*1000};
}
if(require.main===module){
const env=require(path.join(root,'tests/leveling-dom-env.cjs'))({pureLeveling:true});env.read("openMachine(machines.find(m=>m.kind==='horizontal'));$('exaggerate').checked=false;");
const sourceStart=fs.readFileSync(phase==='before'?'docs/qa-horizontal-fixture-20261010/physical-baseline-reference-ui.js':'src/reference-measurement-ui.js');
// This task changes only this measurement adapter. Reinstall the immutable
// pre-change adapter when capturing "before"; concurrent implementation work
// must not silently replace the recorded baseline with the new arrangement.
if(phase==='before')env.read(sourceStart.toString().replace('let referenceMeasurementCopyDefaults;',''));
const rows=[],failures=[],summary={states:0,comparisons:0,maxReadingErrorUm:0,maxContactCoordinateErrorM:0,maxREndpointUm:0,maxRInteriorUm:0,armSegments:0,minArmSurfaceClearanceM:Infinity};
const close=(got,want,label,tolerance)=>{summary.comparisons++;if(!Number.isFinite(got)||Math.abs(got-want)>tolerance)failures.push({label,got,want,difference:got-want});};
const inputs=[['flat',[0,0,0,0]],['rear+',[0,0,0,.01]],['rear-',[0,0,0,-.01]],['front+',[.01,0,0,0]],['front-',[ -.01,0,0,0]],['middle+',[0,.01,.01,0]],['alternating',[.05,-.05,.05,-.05]],['max-alternating',[.5,-.5,.5,-.5]],['common-plane',null]];
for(const depth of [3.68,2.7,1.23])for(const [name,rawHeights]of inputs)for(const intrinsicYZ of [0,30,-30])for(const state0 of [{X:0,Y:0,Z:-100},{X:0,Y:0,Z:0},{X:0,Y:100,Z:100},{X:0,Y:-100,Z:57}]){
 const heightsMm=rawHeights??[-depth/2,-depth/6,depth/6,depth/2].map(z=>.1*z),state={...state0},input={depth,heightsMm,intrinsicYZ},expected=fixture(input,state),heights=heightsMm.flatMap(h=>[h,h]),profile=intrinsicYZ?{squareness:{XY:{microns:0},XZ:{microns:0},YZ:{microns:intrinsicYZ}}}:null;
 env.read(`levelConfig.width=2.72;levelConfig.depth=${depth};levelConfig.columnX=0;levelConfig.columnZ=0;machineProfile=${JSON.stringify(profile)};supportHeights=${JSON.stringify(heights)};positions=${JSON.stringify({...state,A:0,C:0})};levelSolution=machineSolution(supportHeights);`);
 const actual=env.json("referenceScan({key:'YZ'})");summary.states++;
 const key=`${depth}/${name}/${intrinsicYZ}/${state.Y},${state.Z}`,row={key,input,state,oldOrNew:{valid:actual.valid,rawUm:actual.microns,setup:actual.setup},independent:{valid:expected.valid,rawUm:expected.expectedUm,RstartMm:expected.RstartMm,RendMm:expected.RendMm,SstartMm:expected.SstartMm,SendMm:expected.SendMm,returnedZPercent:expected.returnedZPercent,angle:expected.angle}};rows.push(row);
 if(phase==='before')continue;
 if(!actual.valid||!expected.valid){failures.push({label:key,reason:'unexpected invalid',actual:actual.reason,expected:expected.reason});continue;}
 if(actual.setup.base!=='Z'||actual.setup.scan!=='Y'||actual.setup.owner!=='body'||actual.setup.memberSign!==1)failures.push({label:key,reason:'wrong moving-member/setup ownership',setup:actual.setup});
 if(actual.returnState.Z!==state.Z)failures.push({label:key,reason:'pallet did not return to selected Z',returnState:actual.returnState,state});
 close(actual.microns,expected.expectedUm,key+'/reading',2e-6);summary.maxReadingErrorUm=Math.max(summary.maxReadingErrorUm,Math.abs(actual.microns-expected.expectedUm));
 close(actual.zero.extension,.01,key+'/S zero',1e-10);
 const R=actual.alignment?.samples,S=actual.samples;
 if(!R||!S){failures.push({label:key,reason:'missing R/S sample observations'});continue;}
 close(actual.alignment.microns,0,key+'/R equal endpoints',2e-6);summary.maxREndpointUm=Math.max(summary.maxREndpointUm,Math.abs(actual.alignment.microns));
 for(const [stage,want,got]of [['R',expected.R,R],['S',expected.S,S]])for(const w of want){const g=got.find(q=>Math.abs(q.t-w.t)<1e-10);if(!g){failures.push({label:key+'/'+stage,reason:'missing sample',t:w.t});continue;}close(g.extension,w.extension,key+'/'+stage+'/'+w.t+'/extension',2e-12);if(w.contact&&g.point)for(let i=0;i<2;i++){const e=Math.abs(g.point[i+1]-w.contact[i]);summary.maxContactCoordinateErrorM=Math.max(summary.maxContactCoordinateErrorM,e);close(g.point[i+1],w.contact[i],key+'/'+stage+'/'+w.t+'/contact'+i,2e-10);}if(stage==='R')summary.maxRInteriorUm=Math.max(summary.maxRInteriorUm,Math.abs((got[0].extension-g.extension)*1e6));
  if(stage==='R'){
   if(g.state.X!==state.X||g.state.Y!==actual.startState.Y)failures.push({label:key,reason:'head moved during R table scan',state:g.state});
   for(let i=0;i<3;i++)close(g.pose.body[i],got[0].pose.body[i],key+'/R head-fixed body'+i,1e-12);
  }else if(g.state.X!==state.X||g.state.Z!==state.Z)failures.push({label:key,reason:'table moved during S head-Y scan',state:g.state});
  // Use the independently reconstructed rectangle, rather than the box normal
  // copied from the arm builder, for every R/S segment clearance in this section.
  const nS=stage==='R'?[0,-w.normal[1],w.normal[0]]:[0,...expected.normal],nR=stage==='R'?[0,...w.normal]:[0,...expected.up],corner=stage==='R'?[0,...w.point]:plus(plus([0,...expected.point],scale(nS,-.01)),scale(nR,.31)),nT=[-1,0,0],local=p=>{const v=minus(p,corner);return [dot(v,nS),dot(v,nR),dot(v,nT)];};
  if(!g.arm){failures.push({label:key+'/'+stage,reason:'missing finite arm'});continue;}
  for(let j=1;j<g.arm.length;j++){summary.armSegments++;const distance=segmentBoxDistance(local(g.arm[j-1]),local(g.arm[j]),[[-.31,.01],[-.32,0],[-.025,.025]]),clearance=distance-.004;summary.minArmSurfaceClearanceM=Math.min(summary.minArmSurfaceClearanceM,clearance);if(clearance<-1e-10)failures.push({label:key+'/'+stage+'/'+w.t,reason:'arm radius intersects square',segment:j-1,clearance});}
 }
 env.read("$('exaggerate').checked=true;");const exaggerated=env.json("referenceScan({key:'YZ'}).microns");close(exaggerated,actual.microns,key+'/display exaggeration independence',0);env.read("$('exaggerate').checked=false;");
}
const report={phase,sourceSha256:crypto.createHash('sha256').update(sourceStart).digest('hex'),scope:'Independent yz-section support oracle, angle root for moving-table R calibration, and stationary-square/head-Y S contact. Product pose/alignment functions are observations only.',summary,failureCount:failures.length,rows,failures};
fs.writeFileSync(`docs/qa-horizontal-fixture-20261010/physical-${phase}-oracle.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({phase,...summary,failureCount:failures.length,firstFailures:failures.slice(0,5)},null,2));if(phase==='after'&&failures.length)process.exitCode=1;
}
module.exports={section,fixture,segmentBoxDistance};

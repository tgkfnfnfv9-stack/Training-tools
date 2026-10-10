'use strict';
// Fresh measurement ownership/fixture audit. Expected poses below come from
// support-node interpolation and explicit assembly mounts. Production geometry,
// contact, and the previous audit's oracle are not called for expected values.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
process.chdir(path.resolve(__dirname,'..'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const env=require('./leveling-dom-env.cjs')({pureLeveling:true});
for(const file of ['lathe-inspection.js','lathe-inspection-ui.js'])env.read(fs.readFileSync('src/'+file,'utf8'));
env.read('updateLatheInspectionUI=()=>{};');
const sum=(a,b)=>a.map((v,i)=>v+b[i]),diff=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,k)=>a.map(v=>v*k),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>Math.hypot(...a),unit=a=>mul(a,1/norm(a));
const xyz=[[1,0,0],[0,1,0],[0,0,1]],rot=(F,v)=>F.reduce((a,b,i)=>sum(a,mul(b,v[i])),[0,0,0]),inv=(F,v)=>F.map(a=>dot(a,v));
const basis=(a,b)=>{const r=unit([1,a,0]),u=unit(cross([0,b,1],r));return [r,u,cross(r,u)];};
function nodesSurface(nodes){
 // Symmetric complete rectangular supports: least-squares plane coefficients
 // are three independent scalar moments. Local surface is bilinear in each cell.
 const mean=nodes.reduce((s,p)=>s+p.h/nodes.length,0)/1000;
 const ax=nodes.reduce((s,p)=>s+p.x*p.h/1000,0)/nodes.reduce((s,p)=>s+p.x*p.x,0);
 const az=nodes.reduce((s,p)=>s+p.z*p.h/1000,0)/nodes.reduce((s,p)=>s+p.z*p.z,0);
 const common=basis(ax,az),xs=[...new Set(nodes.map(p=>p.x))].sort((a,b)=>a-b),zs=[...new Set(nodes.map(p=>p.z))].sort((a,b)=>a-b);
 const interval=(a,v)=>{const knot=a.find(q=>Math.abs(q-v)<=1e-12);if(knot!==undefined)v=knot;let i=0;while(i+1<a.length-1&&v>=a[i+1])i++;return [i,v];};
 return (x,z)=>{
  const [i,X]=interval(xs,x),[j,Z]=interval(zs,z),dx=xs[i+1]-xs[i],dz=zs[j+1]-zs[j],u=(X-xs[i])/dx,v=(Z-zs[j])/dz;
  const h=(a,b)=>nodes.find(p=>p.x===xs[i+a]&&p.z===zs[j+b]).h/1000;
  const h00=h(0,0),h10=h(1,0),h01=h(0,1),h11=h(1,1),height=h00*(1-u)*(1-v)+h10*u*(1-v)+h01*(1-u)*v+h11*u*v;
  const sx=((h10-h00)*(1-v)+(h11-h01)*v)/dx,sz=((h01-h00)*(1-u)+(h11-h10)*u)/dz,F=basis(sx-ax,sz-az).map(a=>rot(common,a));
  return {point:sum(rot(common,[x,height-ax*x-az*z-mean,z]),[0,.66+mean,0]),F};
 };
}
function apparatus(kind,nodes,width,depth,profile,layout){
 const sx=width/(kind==='horizontal'?2.72:4),sz=depth/(kind==='horizontal'?3.68:1.68),physical=p=>[p[0]*sx,p[1],p[2]*sz],seat=nodesSurface(nodes);
 const A=(profile?.squareness.XY?.microns||0)/300000,B=(profile?.squareness.XZ?.microns||0)/300000,C=(profile?.squareness.YZ?.microns||0)/300000;
 const X=[1,0,0],Y=[-Math.sin(A),Math.cos(A),0],Z=[-Math.sin(B),(-Math.sin(C)-Math.sin(A)*Math.sin(B))/Math.cos(A),0];Z[2]=Math.sqrt(1-Z[0]**2-Z[1]**2);
 const rigid=kind==='horizontal'?[[Math.cos(A),Math.sin(A),0],Y,[0,0,1]]:[[Math.cos(B),0,-Math.sin(B)],[0,1,0],[Math.sin(B),0,Math.cos(B)]];
 function at(raw,owner,s){
  let base,travel,relative;
  if(kind==='horizontal'){
   base=physical(owner==='head'?[layout.x,.66,1.334+layout.z]:[0,.66,-.85]);
   travel=owner==='head'?[.55*sx*s.X/100,0,0]:[0,0,.45*sz*s.Z/100];
   relative=diff(physical(sum(raw,owner==='head'?[layout.x,0,layout.z]:[0,0,0])),base);
   if(owner==='head')relative[1]+=.3*s.Y/100;
   else relative=sum(relative,mul(diff(Z,[0,0,1]),travel[2]));
  }else{
   base=physical(owner==='head'?[-1.75,.66,0]:[.08,.66,.15]);travel=owner==='head'?[0,0,0]:[.7*sx*s.Z/100,0,0];relative=diff(physical(raw),base);
   if(owner!=='head')relative[2]+=.35*sz*s.X/100;
  }
  const q=sum(base,travel),mount=seat(q[0],q[2]),F=owner==='head'?rigid.map(a=>rot(mount.F,a)):mount.F;
  return {point:sum(mount.point,rot(F,relative)),F};
 }
 return {at,sx,sz};
}
// Intersect through signed distance bisection; no product contact algebra.
function plane(pose){let lo=0,hi=.02;const f=t=>dot(diff(sum(pose.body,mul(pose.probe,t)),pose.point),pose.normal);if(f(lo)*f(hi)>0)return null;const increasing=f(hi)>f(lo);for(let i=0;i<60;i++){const t=(lo+hi)/2;if((f(t)>0)===increasing)hi=t;else lo=t;}return (lo+hi)/2;}
function cylinder(body,probe,origin,axis,low,high){let lo=0,hi=.02;const f=t=>norm(cross(diff(sum(body,mul(probe,t)),origin),axis))-.025;if(f(lo)<0||f(hi)>0)return null;for(let i=0;i<60;i++){const t=(lo+hi)/2;if(f(t)>0)lo=t;else hi=t;}const extension=(lo+hi)/2,point=sum(body,mul(probe,extension)),axial=dot(diff(point,origin),axis);return axial<low-1e-10||axial>high+1e-10?null:{extension,point,axial};}
const span=(value,half)=>{const a=Math.max(-half,Math.min(half-.3,value*half/100));return [a/half*100,(a+.3)/half*100];};
const relative=(from,to,v)=>rot(to.F,inv(from.F,v));
function horizontal(m,state,key,times,rTimes){
 const half=a=>a==='X'?.55*m.sx:a==='Y'?.3:.45*m.sz,base=key[0],scan=key[1],[s0,s1]=span(state[scan],half(scan)),s={...state,[scan]:s0},[r0,r1]=span(state[base],half(base));
 const p=m.at([0,1.27,-.85],'carriage',s),rHead=m.at([0,2.55,-.93],'head',{...s,[base]:r0}),rHead1=m.at([0,2.55,-.93],'head',{...s,[base]:r1});
 const Q=sum(p.point,rot(p.F,key==='XY'?[-.15,.05,0]:key==='XZ'?[-.15,.05,.16]:[0,.05,.16]));
 const Q1=sum(rHead1.point,relative(rHead,rHead1,diff(Q,rHead.point))),nS=unit(diff(Q1,Q)),nominal=key==='XY'?p.F[1]:mul(p.F[2],-1),nR=unit(diff(nominal,mul(nS,dot(nominal,nS)))),nT=cross(nS,nR);
 const rBody=diff(Q,mul(nR,.01)),head=m.at([0,2.55,-.93],'head',s),S=sum(sum(Q,mul(nS,.31)),mul(nR,.01)),body=sum(S,mul(nS,.01)),probe=mul(nS,-1);
 const R=rTimes.map(t=>{const h=m.at([0,2.55,-.93],'head',{...s,[base]:r0+(r1-r0)*t}),pose={point:Q,normal:nR,body:sum(h.point,relative(rHead,h,diff(rBody,rHead.point))),probe:relative(rHead,h,nR)};const e=plane(pose);return {pose,extension:e,contact:sum(pose.body,mul(pose.probe,e)),head:h};});
 const samples=times.map(t=>{
  const st={...s,[scan]:s0+(s1-s0)*t},h=m.at([0,2.55,-.93],'head',st),q=m.at([0,1.27,-.85],'carriage',st);
  const pose={point:sum(q.point,relative(p,q,diff(S,p.point))),normal:relative(p,q,nS),body:sum(h.point,relative(head,h,diff(body,head.point))),probe:relative(head,h,probe)},e=plane(pose),corner=sum(q.point,relative(p,q,diff(Q,p.point))),F=[relative(p,q,nS),relative(p,q,nR),relative(p,q,nT)];
  return {pose,extension:e,contact:sum(pose.body,mul(pose.probe,e)),corner,F,head:h,pallet:q};
 });
 return {Q,nS,nR,nT,R,samples,microns:(samples[0].extension-samples.at(-1).extension)*1e6};
}
function bar(m,state,kind,key,times){
 const [s0,s1]=span(state.Z,kind==='horizontal'?.45*m.sz:.7*m.sx),head=m.at(kind==='horizontal'?[0,2.55,-.93]:[-1.075,1.5,0],'head',state),axis=head.F[kind==='horizontal'?2:0],origin=kind==='horizontal'?diff(head.point,mul(axis,.31)):head.point;
 const raw=kind==='horizontal'?[0,1.27,-.85]:[.08,1.5,.20],mount0=m.at(raw,'carriage',{...state,Z:s0}),centre=kind==='horizontal'?origin:sum(origin,mul(axis,dot(diff(mount0.point,origin),axis)));
 const outward=kind==='horizontal'?mul(head.F[key==='a'?0:1],-1):head.F[key==='side'?2:1],body0=sum(centre,mul(outward,.035)),probe0=mul(outward,-1);
 const samples=times.map(t=>{const mount=m.at(raw,'carriage',{...state,Z:s0+(s1-s0)*t}),body=sum(mount.point,relative(mount0,mount,diff(body0,mount0.point))),probe=relative(mount0,mount,probe0);return {body,probe,mount,...cylinder(body,probe,origin,axis,kind==='horizontal'?-.01:0,kind==='horizontal'?.31:2.2*m.sx)};});
 return {samples,microns:(samples[0].extension-samples.at(-1).extension)*1e6};
}
function fixedLathe(profile){if(!profile)return {face:0,flat:0,holeX:0,holeY:0};let seed=(profile.seed^0x4c415431)>>>0;const r=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed/2147483648-1)*(profile.condition==='used'?30:10)/1e6;};return {face:r(),flat:r(),holeX:r(),holeY:r()};}
function face(m,state,key,fixed){const scan=key==='face'?'X':'Z',[a,b]=span(state[scan],key==='face'?.35*m.sz:.7*m.sx),raw=key==='face'?[-.09,1.5,1]:[.23,1.5,1.43],normal=key==='face'?[-Math.cos(fixed.face),0,-Math.sin(fixed.face)]:[Math.sin(fixed.flat),0,Math.cos(fixed.flat)],first=m.at(raw,'carriage',{...state,[scan]:a}),last=m.at(raw,'carriage',{...state,[scan]:b}),n=rot(first.F,normal),body=sum(first.point,mul(n,.01)),probe=mul(n,-1),p0={body,probe,point:first.point,normal:n},p1={body,probe,point:last.point,normal:rot(last.F,normal)};return {microns:(plane(p0)-plane(p1))*1e6,poses:[p0,p1]};}
function bore(m,state,fixed){const head=m.at([-1.075,1.5,0],'head',state),hole=m.at([-.09,1.5,.20],'carriage',{...state,X:-.2/.35*100}),centre=sum(hole.point,rot(hole.F,[0,fixed.holeY,fixed.holeX])),d=diff(centre,head.point),dx=dot(d,head.F[2]),dy=dot(d,head.F[1]);const extensions=[[1,0],[0,1],[-1,0],[0,-1]].map(ray=>{let lo=0,hi=.05;for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(Math.hypot(ray[0]*mid-dx,ray[1]*mid-dy)>.025)hi=mid;else lo=mid;}return (lo+hi)/2;});return {dx:dx*1e6,dy:dy*1e6,readings:extensions.map(e=>(extensions[0]-e)*1e6)};}
const failures=[],examples=[],summary={states:0,checks:0,fixtureContacts:0,barContacts:0,reverseScans:0,maxReadingErrorUm:0,maxPointErrorM:0,maxArmDriftM:0,maxRemainderUm:0};
function equal(a,b,label,tol=2e-7){summary.checks++;const error=Math.abs(a-b);summary.maxReadingErrorUm=Math.max(summary.maxReadingErrorUm,error);if(!Number.isFinite(error)||error>tol)failures.push({label,actual:a,expected:b,error,tolerance:tol});}
function point(a,b,label,tol=2e-11){summary.checks++;const error=norm(diff(a,b));summary.maxPointErrorM=Math.max(summary.maxPointErrorM,error);if(!Number.isFinite(error)||error>tol)failures.push({label,actual:a,expected:b,error,tolerance:tol});}
function check(value,label,data){summary.checks++;if(!value)failures.push({label,...data});}
function contactPlane(actual,expected,label){for(const k of ['body','probe','point','normal'])point(actual.pose[k],expected.pose[k],label+'/'+k);equal(actual.extension*1e6,expected.extension*1e6,label+'/extension');point(actual.point,expected.contact,label+'/hit');}
function reversal(list,reading,label){const raw=(list.at(-1).extension-list[0].extension)*1e6;equal(raw,-reading,label+'/same-mount-reverse');summary.reverseScans++;}
function rigidArm(list,get,owner,label){const initial=get(list[0]),local0=inv(list[0][owner].F,diff(initial.body,list[0][owner].point)),dir0=inv(list[0][owner].F,initial.probe);for(const entry of list){const p=get(entry),local=inv(entry[owner].F,diff(p.body,entry[owner].point)),direction=inv(entry[owner].F,p.probe),drift=norm(diff(local0,local));summary.maxArmDriftM=Math.max(summary.maxArmDriftM,drift);point(local,local0,label+'/fixed-arm');point(direction,dir0,label+'/fixed-direction');}}
const states=[{X:0,Y:0,Z:0},{X:-100,Y:-100,Z:-100},{X:100,Y:100,Z:100},{X:57,Y:43,Z:29},{X:-31,Y:71,Z:-63}],layouts=[{columnX:0,columnZ:0},{columnX:67,columnZ:-43}];
const sourceAtStart=Object.fromEntries(['src/accuracy-ui.js','src/reference-measurement-ui.js','src/horizontal-parallelism-ui.js','src/lathe-inspection-ui.js','src/lathe-inspection.js','src/machine-accuracy-ui.js','index.html'].map(p=>[p,sha(p)]));
for(const kind of ['horizontal','lathe']){
 env.read(`openMachine(machines.find(m=>m.kind==='${kind}'));$('exaggerate').checked=false;`);
 const profiles=[null,env.json(`window.MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length)`)],sizes=kind==='horizontal'?[[2.72,3.68],[3.8,2.7]]:[[4,1.68],[3.1,2.1]];
 for(const [width,depth] of sizes)for(const profile of profiles)for(const layout of (kind==='horizontal'?layouts:[layouts[0]]))for(const state of states){
  const xs=kind==='horizontal'?[-width/2,width/2]:[-width/2,0,width/2],zs=kind==='horizontal'?[-depth/2,-depth/6,depth/6,depth/2]:[-depth/2,depth/2];
  for(const input of ['flat','twist+','twist-','plane','A+','B-','E+','checker']){
   const nodes=zs.flatMap(z=>xs.map(x=>({x,z}))).map((p,i)=>({...p,h:input==='flat'?0:input==='twist+'?.05*p.x*p.z:input==='twist-'?-.05*p.x*p.z:input==='plane'?.1*p.x-.07*p.z:input==='A+'?(i===0?.01:0):input==='B-'?(i===1?-.01:0):input==='E+'?(i===4?.01:0):((i%3)-1)*.05}));
   const s={...state,A:0,C:0},layoutRaw={x:3.4*.2*layout.columnX/100,z:4.6*.1*layout.columnZ/100};
   env.read(`levelConfig.width=${width};levelConfig.depth=${depth};levelConfig.columnX=${layout.columnX};levelConfig.columnZ=${layout.columnZ};machineProfile=${JSON.stringify(profile)};supportHeights=${JSON.stringify(nodes.map(p=>p.h))};positions=${JSON.stringify(s)};levelSolution=machineSolution(supportHeights);`);
   const m=apparatus(kind,nodes,width,depth,profile,layoutRaw),label=`${kind}/${width},${depth}/${profile?'used':'ideal'}/${layout.columnX}/${input}/${state.X},${state.Y},${state.Z}`,record={kind,width,depth,profile:profile?'used/123456':'ideal',layout,input,state:s,heightsMm:nodes.map(p=>p.h),readings:{}};
   if(kind==='horizontal'){
    const rows=env.json(`['XY','XZ','YZ'].map(key=>({key,m:referenceScan({key})}))`);
    for(const {key,m:actual} of rows){
     check(actual.valid,label+'/'+key+'/valid',{reason:actual.reason});if(!actual.valid)continue;
     const expected=horizontal(m,s,key,actual.samples.map(q=>q.t),actual.alignment.samples.map(q=>q.t));equal(actual.microns,expected.microns,label+'/'+key+'/reading');point(actual.master.corner,expected.Q,label+'/'+key+'/corner');
     check(Math.abs(dot(expected.nS,expected.nR))<1e-12,label+'/'+key+'/one-orthogonal-solid');
     for(let i=0;i<actual.samples.length;i++){
      const a=actual.samples[i],e=expected.samples[i];contactPlane(a,e,label+'/'+key+'/'+i);const coords=inv(e.F,diff(e.contact,e.corner));equal(coords[0],.31,label+'/'+key+'/S-solid-face',1e-11);check(coords[1]>=-1e-9&&coords[1]<=.320000001&&Math.abs(coords[2])<=.025000001,label+'/'+key+'/S-solid-bounds',{coords});summary.fixtureContacts++;
     }
     for(let i=0;i<actual.alignment.samples.length;i++){
      const a=actual.alignment.samples[i],e=expected.R[i];contactPlane(a,e,label+'/'+key+'/R/'+i);const d=diff(e.contact,expected.Q),u=dot(d,expected.nS),v=dot(d,expected.nR),w=dot(d,expected.nT);check(u>=-.010000001&&u<=.310000001&&Math.abs(v)<1e-11&&Math.abs(w)<=.025000001,label+'/'+key+'/R-solid-bounds',{u,v,w});summary.fixtureContacts++;
     }
     const rRead=(expected.R[0].extension-expected.R.at(-1).extension)*1e6;equal(rRead,0,label+'/'+key+'/R-equal');summary.maxRemainderUm=Math.max(summary.maxRemainderUm,...expected.R.map(v=>Math.abs((expected.R[0].extension-v.extension)*1e6)));
     rigidArm(expected.samples,e=>e.pose,'head',label+'/'+key+'/S');rigidArm(expected.R,e=>e.pose,'head',label+'/'+key+'/R');reversal(expected.samples,actual.microns,label+'/'+key);record.readings[key]={actual:actual.microns,expected:expected.microns,display:env.json(`squarenessMicronText(${actual.microns})`)};
    }
    const observed=env.json('horizontalParallelism()');
    for(const key of ['a','b']){const actual=observed[key];check(actual.valid,label+'/'+key+'/valid',{reason:actual.reason});if(!actual.valid)continue;const expected=bar(m,s,kind,key,actual.samples.map(q=>q.t));equal(actual.microns,expected.microns,label+'/'+key+'/reading');for(let i=0;i<actual.samples.length;i++){const a=actual.samples[i],e=expected.samples[i];point(a.body,e.body,label+'/'+key+'/body');point(a.probe,e.probe,label+'/'+key+'/probe');point(a.point,e.point,label+'/'+key+'/hit');equal(a.extension*1e6,e.extension*1e6,label+'/'+key+'/extension');summary.barContacts++;}rigidArm(expected.samples,e=>e,'mount',label+'/'+key);reversal(expected.samples,actual.microns,label+'/'+key);record.readings[key]={actual:actual.microns,expected:expected.microns,display:env.json(`squarenessMicronText(${actual.microns})`)};}
   }else{
    const actual=env.json('latheInspectionGeometry()'),fixed=fixedLathe(profile);
    for(const key of ['face','flat']){const expected=face(m,s,key,fixed);equal(actual[key],expected.microns,label+'/'+key);const reversed=(plane(expected.poses[1])-plane(expected.poses[0]))*1e6;equal(reversed,-actual[key],label+'/'+key+'/same-mount-reverse');summary.reverseScans++;record.readings[key]={actual:actual[key],expected:expected.microns};}
    const expectedBore=bore(m,s,fixed);for(const key of ['dx','dy']){equal(actual[key],expectedBore[key],label+'/'+key);record.readings[key]={actual:actual[key],expected:expectedBore[key]};}for(let i=0;i<4;i++)equal(actual.bore.readings[i],expectedBore.readings[i],label+'/bore/'+i);equal((actual.bore.readings[2]-actual.bore.readings[0])/2,actual.dx,label+'/bore-X-sign');equal((actual.bore.readings[3]-actual.bore.readings[1])/2,actual.dy,label+'/bore-height-sign');
    for(const key of ['side','top']){const a=actual[key];check(a.valid,label+'/'+key+'/valid',{reason:a.reason});if(!a.valid)continue;const e=bar(m,s,kind,key,a.samples.map(q=>q.t));equal(a.microns,e.microns,label+'/'+key+'/reading');for(let i=0;i<a.samples.length;i++){point(a.samples[i].body,e.samples[i].body,label+'/'+key+'/body');point(a.samples[i].probe,e.samples[i].probe,label+'/'+key+'/probe');point(a.samples[i].point,e.samples[i].point,label+'/'+key+'/hit');equal(a.samples[i].extension*1e6,e.samples[i].extension*1e6,label+'/'+key+'/extension');summary.barContacts++;}rigidArm(e.samples,v=>v,'mount',label+'/'+key);reversal(e.samples,a.microns,label+'/'+key);record.readings[key]={actual:a.microns,expected:e.microns};}
   }
   if(state.X===0&&width===(kind==='horizontal'?2.72:4)&&layout.columnX===0)examples.push(record);summary.states++;
  }
 }
}
// A state-to-state comparison is intentionally not a dial left in place.
// Quantify the distinction with the same independent geometry: retain both
// original fixtures in their owners' material coordinates, then alter support E.
env.read("openMachine(machines.find(m=>m.kind==='horizontal'));");
const freezeProfile=env.json("window.MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length)"),freezeState={X:0,Y:0,Z:0},freezeNodes=[-1.84,-1.84/3,1.84/3,1.84].flatMap(z=>[-1.36,1.36].map(x=>({x,z,h:0}))),changedNodes=freezeNodes.map((p,i)=>({...p,h:i===4?.01:0})),beforeMachine=apparatus('horizontal',freezeNodes,2.72,3.68,freezeProfile,{x:0,z:0}),afterMachine=apparatus('horizontal',changedNodes,2.72,3.68,freezeProfile,{x:0,z:0});
const retainedMountComparison=['XY','XZ','YZ'].map(key=>{
 const original=horizontal(beforeMachine,freezeState,key,[0,1],[0,1]),reinstalled=horizontal(afterMachine,freezeState,key,[0,1],[0,1]),p0=original.samples[0].pallet,h0=original.samples[0].head,first=original.samples[0].pose;
 const frozen=reinstalled.samples.map(sample=>{const p=sample.pallet,h=sample.head,pose={point:sum(p.point,relative(p0,p,diff(first.point,p0.point))),normal:relative(p0,p,first.normal),body:sum(h.point,relative(h0,h,diff(first.body,h0.point))),probe:relative(h0,h,first.probe)};return plane(pose);});
 return {key,input:'flat to E +0.010 mm / used seed 123456 / axes centre',beforeUm:original.microns,afterAppReinstalledAndRezeroedUm:reinstalled.microns,retainedMountStartUsingOldZeroUm:(original.samples[0].extension-frozen[0])*1e6,retainedMountEndUsingOldZeroUm:(original.samples[0].extension-frozen[1])*1e6,retainedMountScanAfterStartRezeroUm:(frozen[0]-frozen[1])*1e6,interpretation:'The app repeats mounting and R alignment before start zero. Retaining the old mounting is a different, unsupported procedure; these values are explanatory counterfactuals, not failures.'};
});
const sourceAtEnd=Object.fromEntries(Object.keys(sourceAtStart).map(p=>[p,sha(p)]));check(JSON.stringify(sourceAtStart)===JSON.stringify(sourceAtEnd),'product-files-unchanged');
const report={passed:failures.length===0,scope:'Independent support/assembly/finite-solid/contact/reversal audit. No actual-machine dimensional validation; no browser execution in this script.',sourceSha256:sourceAtStart,testSha256:sha(__filename),summary,failureCount:failures.length,failures:failures.slice(0,100),retainedMountComparison,examples};
fs.mkdirSync('docs/qa-motion-reference-20261010',{recursive:true});fs.writeFileSync('docs/qa-motion-reference-20261010/reference-geometry.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,examples:undefined},null,2));if(failures.length)process.exitCode=1;

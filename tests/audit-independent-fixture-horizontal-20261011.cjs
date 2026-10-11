'use strict';
// Independent physical construction from input dimensions, supports and profile.
// No production support solver, pose, contact, referenceScan or fixture output
// supplies an expected position/reading. The test only calls product functions
// for the observed side of a comparison.
const fs=require('node:fs'),path=require('node:path');
process.chdir(path.resolve(__dirname,'..'));
const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),scale=(v,s)=>v.map(x=>x*s),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=v=>scale(v,1/Math.hypot(...v)),basis=[[1,0,0],[0,1,0],[0,0,1]],apply=(F,v)=>basis.map((_,i)=>F.reduce((s,a,j)=>s+a[i]*v[j],0)),local=(F,v)=>F.map(a=>dot(a,v));
const point=(mount,v)=>add(mount.p,apply(mount.F,v)),saved=(mount,v)=>local(mount.F,sub(v,mount.p));
function triad(a,b){const X=unit([1,a,0]),Y=unit(cross([0,b,1],[1,a,0]));return [X,Y,cross(X,Y)];}
function bed(input){
 const sx=input.config.width/2.72,sz=input.config.depth/3.68,nodes=input.supports.map((p,i)=>({x:p.x*sx,z:p.z*sz,h:input.heights[i]/1000})),xs=[...new Set(nodes.map(p=>p.x))].sort((a,b)=>a-b),zs=[...new Set(nodes.map(p=>p.z))].sort((a,b)=>a-b),A=nodes.reduce((s,p)=>s+p.x*p.h,0)/nodes.reduce((s,p)=>s+p.x*p.x,0),B=nodes.reduce((s,p)=>s+p.z*p.h,0)/nodes.reduce((s,p)=>s+p.z*p.z,0),C=nodes.reduce((s,p)=>s+p.h,0)/nodes.length,common=triad(A,B);
 const snap=(x,knots)=>knots.find(k=>Math.abs(k-x)<1e-12)??x;
 function seat(x,z){x=snap(x,xs);z=snap(z,zs);let i=0,j=0;while(i<xs.length-2&&x>=xs[i+1])i++;while(j<zs.length-2&&z>=zs[j+1])j++;const dx=xs[i+1]-xs[i],dz=zs[j+1]-zs[j],u=(x-xs[i])/dx,v=(z-zs[j])/dz,h=(ii,jj)=>nodes.find(p=>p.x===xs[ii]&&p.z===zs[jj]).h,H=[h(i,j),h(i+1,j),h(i,j+1),h(i+1,j+1)],elevation=dot(H,[(1-u)*(1-v),u*(1-v),(1-u)*v,u*v]),lr=dot(H,[-(1-v),1-v,-v,v])/dx,fb=dot(H,[-(1-u),-u,1-u,u])/dz;
 return {F:triad(lr-A,fb-B).map(v=>apply(common,v)),p:add(apply(common,[x,elevation-A*x-B*z-C,z]),[0,.66+C,0])};}
 return {sx,sz,nodes,seat};
}
function machine(input){
 const B=bed(input),err=k=>(input.profile?.squareness[k]?.microns||0)/300000,a=err('XY'),b=err('XZ'),c=err('YZ'),Y=[-Math.sin(a),Math.cos(a),0],zx=-Math.sin(b),zy=(-Math.sin(c)-Y[0]*zx)/Y[1],Z=[zx,zy,Math.sqrt(1-zx*zx-zy*zy)],rigid=v=>[Math.cos(a)*v[0]-Math.sin(a)*v[1],Math.sin(a)*v[0]+Math.cos(a)*v[1],v[2]],lx=.68*(input.config.columnX||0)/100,lz=.46*(input.config.columnZ||0)/100;
 function head(s){const S=B.seat((lx+.55*s.X/100)*B.sx,(1.334+lz)*B.sz),F=basis.map(v=>apply(S.F,rigid(v))),p=add(add(S.p,apply(F,[0,1.89,-2.264*B.sz])),scale(apply(S.F,Y),.3*s.Y/100));return {F,p};}
 function pallet(s){const travel=.45*B.sz*s.Z/100,S=B.seat(0,-.85*B.sz+travel);return {F:S.F,p:add(S.p,apply(S.F,add([0,.61,0],scale(sub(Z,[0,0,1]),travel))))};}
 const station={X:-lx/.55*100,Y:-100,Z:((-.08+lz)*B.sz-.32)/(.45*B.sz)*100,A:0,C:0};
 return {B,head,pallet,station};
}
// Bracketed scalar root: distances are not read from the production quadratic.
function root(f,lo,hi){let a=f(lo),b=f(hi);if(!Number.isFinite(a+b)||a*b>0)return null;for(let i=0;i<70;i++){const mid=(lo+hi)/2,m=f(mid);if(a*m<=0){hi=mid;b=m;}else{lo=mid;a=m;}}return (lo+hi)/2;}
function plane(body,direction,origin,normal){const e=root(t=>dot(sub(add(body,scale(direction,t)),origin),normal),0,.02);return e===null?null:{extension:e,p:add(body,scale(direction,e))};}
function externalCylinder(body,direction,origin,axis,radius,min,max){const distance=t=>Math.hypot(...cross(sub(add(body,scale(direction,t)),origin),axis))-radius;if(distance(0)<-1e-12)return null;const e=root(distance,0,.02);if(e===null)return null;const p=add(body,scale(direction,e)),axial=dot(sub(p,origin),axis);return axial<min-1e-10||axial>max+1e-10?null:{extension:e,p,axial};}
const integer=value=>{if(!Number.isFinite(value))return '—';const n=Math.round(Math.abs(value));return n?(value<0?'-':'+')+n:'0';};
module.exports={add,sub,scale,dot,cross,unit,apply,local,point,saved,bed,machine,root,plane,externalCylinder,integer};
function stationReason(input,G=machine(input)){
 const p=G.station,sx=G.B.sx,sz=G.B.sz,x=p.X*.55*sx/100,z=p.Z*.45*sz/100;
 if(Math.abs(x)+.15>.55*sx+1e-10)return 'x-travel';
 if(z<-.45*sz-1e-10||z+.3>.45*sz+1e-10)return 'z-travel';
 if(1.45*sx<.64||1.45*sz<.84)return 'tower-footprint';
 return null;
}
function makeSquare(input,key){
 const G=machine(input),s={...G.station},p=G.pallet(s),h=G.head(s),scan=key==='XZ'?'Z':'Y',end={...s,[scan]:s[scan]+(scan==='Y'?100:.3/(.45*G.B.sz)*100)},r0={...s},r1={...s};let corner,nR,nS;
 if(key==='YZ'){
  r0.Y=r1.Y=0;r1.Z+=.3/(.45*G.B.sz)*100;
  const w0=G.pallet(r0),w1=G.pallet(r1),C=[0,1.22,.15],first=point(w0,C),last=point(w1,C),chord=sub(first,last);
  // R must contain the stationary contact at both pallet endpoints, and its
  // thickness centre must also contain both contacts. Solve the two angles.
  const yaw=root(a=>dot(apply(w1.F,[-Math.cos(a),0,Math.sin(a)]),chord),-.1,.1),pitch=root(b=>dot(apply(w1.F,[-Math.sin(yaw)*Math.sin(b),Math.cos(b),-Math.cos(yaw)*Math.sin(b)]),chord),-.1,.1);
  const S=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)],R=[-Math.sin(yaw)*Math.sin(pitch),Math.cos(pitch),-Math.cos(yaw)*Math.sin(pitch)];
  corner=point(p,C);nS=apply(p.F,S);nR=apply(p.F,R);
 }else{
  r0.X-=.15/(.55*G.B.sx)*100;r1.X+=.15/(.55*G.B.sx)*100;if(key==='XY')r0.Y=r1.Y=0;
  corner=point(p,key==='XY'?[-.15,1.26,.12]:[-.15,.90,.16]);
  const firstHead=G.head(r0),lastHead=G.head(r1),material=saved(firstHead,corner),chord=sub(point(lastHead,material),corner);
  nS=unit(chord);const nominal=key==='XY'?p.F[1]:scale(p.F[2],-1);nR=unit(sub(nominal,scale(nS,dot(nominal,nS))));
 }
 const Ssurface=key==='YZ'?add(add(corner,scale(nS,.01)),scale(nR,-.31)):add(add(corner,scale(nS,.31)),scale(nR,key==='XY'?-.31:.01)),Sbody=add(Ssurface,scale(nS,.01)),Sprobe=scale(nS,-1),Rsurface=corner,Rprobe=key==='YZ'||key==='XY'?scale(nR,-1):nR,Rbody=sub(Rsurface,scale(Rprobe,.01));
 const stage=(name,begin,end,origin,normal,body,probe,tangent,bounds)=>({name,begin,end,origin:saved(G.pallet(begin),origin),normal:local(G.pallet(begin).F,normal),body:saved(G.head(begin),body),probe:local(G.head(begin).F,probe),tangent:local(G.pallet(begin).F,tangent),bounds});
 return {type:'square',key,s,end,master:{corner:saved(p,corner),nS:local(p.F,nS),nR:local(p.F,nR)},stages:[stage('R',r0,r1,Rsurface,nR,Rbody,Rprobe,nS,key==='YZ'?[-.31,.01]:[-.01,.31]),stage('S',s,end,Ssurface,nS,Sbody,Sprobe,nR,[-.01,.31])]};
}
function makeBar(input,key){
 const G=machine(input),s={...G.station},end={...s,Z:s.Z+.3/(.45*G.B.sz)*100},h=G.head(s),p=G.pallet(s),axis=h.F[2],origin=sub(h.p,scale(axis,.35)),direction=key==='a'?h.F[0]:h.F[1],body=sub(origin,scale(direction,.035));
 return {type:'bar',key,s,end,body:saved(p,body),probe:local(p.F,direction)};
}
function sampleStates(input,begin,end,count=64){
 const G=machine(input),times=new Set(Array.from({length:count+1},(_,i)=>i/count));
 for(const key of ['X','Z'])if(begin[key]!==end[key]){
  const scale=key==='X'?.55*G.B.sx:.45*G.B.sz,base=key==='X'?.68*(input.config.columnX||0)/100*G.B.sx:-.85*G.B.sz,start=base+scale*begin[key]/100,span=scale*(end[key]-begin[key])/100;
  for(const n of G.B.nodes){const t=((key==='X'?n.x:n.z)-start)/span;if(t>0&&t<1)for(const epsilon of [-1e-8,0,1e-8])times.add(Math.max(0,Math.min(1,t+epsilon)));}
 }
 return [...times].sort((a,b)=>a-b).map(t=>({t,state:Object.fromEntries(Object.keys(begin).map(k=>[k,begin[k]+(end[k]-begin[k])*t]))}));
}
function evaluateGeometry(input,fixture){
 const G=machine(input),f=fixture;
 if(f.type==='bar'){
  const samples=sampleStates(input,f.s,f.end).map(({state,t})=>{const h=G.head(state),p=G.pallet(state),origin=sub(h.p,scale(h.F[2],.35)),body=point(p,f.body),probe=apply(p.F,f.probe),contact=externalCylinder(body,probe,origin,h.F[2],.025,-.05,.35);return {t,state,body,probe,contact};});
  const first=samples[0].contact,last=samples.at(-1).contact,valid=samples.every(s=>s.contact);return {valid,first,last,samples,raw:valid?(first.extension-last.extension)*1e6:null,heldRaw:valid?(.01-last.extension)*1e6:null};
 }
 const stages=f.stages.map(stage=>{
  const samples=sampleStates(input,stage.begin,stage.end).map(({state,t})=>{const h=G.head(state),p=G.pallet(state),origin=point(p,stage.origin),normal=apply(p.F,stage.normal),body=point(h,stage.body),probe=apply(h.F,stage.probe),tangent=apply(p.F,stage.tangent);let contact=plane(body,probe,origin,normal);
   if(contact){const d=sub(contact.p,origin),along=dot(d,tangent),across=dot(d,cross(normal,tangent));if(along<stage.bounds[0]-1e-9||along>stage.bounds[1]+1e-9||Math.abs(across)>.025000001)contact=null;}
   return {t,state,body,probe,origin,normal,contact};
  });const valid=samples.every(s=>s.contact),first=samples[0].contact,last=samples.at(-1).contact;return {name:stage.name,samples,valid,raw:valid?(first.extension-last.extension)*1e6:null,heldRaw:valid?(.01-last.extension)*1e6:null};
 });
 const first=stages[1].samples[0].contact,last=stages[1].samples.at(-1).contact,valid=stages.every(s=>s.valid);return {valid,first,last,stages,raw:valid?(first.extension-last.extension)*1e6:null,heldRaw:valid?(.01-last.extension)*1e6:null};
}
Object.assign(module.exports,{stationReason,makeSquare,makeBar,sampleStates,evaluateGeometry});
function runCalculationAudit(){
 const env=require('./leveling-dom-env.cjs')({pureLeveling:true});env.read("openMachine(machines.find(m=>m.kind==='horizontal'));window.__auditSnapshot=null;");
 const before=JSON.parse(fs.readFileSync('docs/qa-fixtures-20261011/browser/before/results.json','utf8')),keys=['XY','XZ','YZ','a','b'],rows=[],failures=[];
 const install=input=>env.read(`Object.assign(levelConfig,${JSON.stringify(input.config)});machineProfile=${JSON.stringify(input.profile)};positions=${JSON.stringify(input.state)};supportHeights=${JSON.stringify(input.heights)};levelSolution=machineSolution(supportHeights);`);
 const read=()=>env.json(`(()=>{const row=m=>({valid:!!m.valid,raw:Number.isFinite(m.microns)?m.microns:null,reason:m.reason||'',samples:(m.samples||[]).map(s=>({valid:s.valid,reason:s.reason,t:s.t}))}),s=Object.fromEntries(['XY','XZ','YZ'].map(key=>{const m=referenceScan({key});return [key,{...row(m),R:row(m.alignment||{})}]})),p=horizontalParallelism(),held=window.__auditSnapshot?horizontalEvaluateHeld(window.__auditSnapshot).rows:[];return {rows:{...s,a:row(p.a),b:row(p.b)},held};})()`);
 for(const condition of ['ideal','new','used']){
  const state=before.states.find(s=>s.kind==='horizontal'&&s.condition===condition),record=state.record,config={width:record.width,depth:record.depth,columnX:0,columnZ:0},base={config,supports:record.supportLayout.points,profile:record.machineProfile||null,heights:record.heights.map(()=>0)};base.state=machine(base).station;
  install(base);env.read('window.__auditSnapshot=horizontalCaptureFixtures();');
  const mounts=Object.fromEntries(keys.map(k=>[k,k.length===1?makeBar(base,k):makeSquare(base,k)]));
  const cases=[{name:'flat',heights:base.heights},{name:'uniform+0.010',heights:base.heights.map(()=>.010)},{name:'rigid-X-tilt',heights:base.supports.map(p=>p.x/1.36*.010)},{name:'rigid-Z-tilt',heights:base.supports.map(p=>p.z/1.84*.010)},{name:'alternating-0.010',heights:base.heights.map((_,i)=>i%2?.010:-.010)},{name:'A+0.500',heights:base.heights.map((_,i)=>i?0:.5)},{name:'alternating-0.500',heights:base.heights.map((_,i)=>i%2?.5:-.5)}];for(let supportIndex=0;supportIndex<base.heights.length;supportIndex++)for(const delta of [-.010,-.001,.001,.010])cases.push({name:`support-${supportIndex}-${delta}`,supportIndex,delta,heights:base.heights.map((_,i)=>i===supportIndex?delta:0)});
  for(const test of cases){const input={...base,heights:test.heights};install(input);const actual=read();
   for(const key of keys){const renewedFixture=key.length===1?makeBar(input,key):makeSquare(input,key),renewed=evaluateGeometry(input,renewedFixture),held=evaluateGeometry(input,mounts[key]),observed=actual.rows[key],heldKey=key.length===1?'bar.'+key:'square.'+key,heldActual=actual.held.find(r=>r.key===heldKey),error=observed.valid&&renewed.valid?observed.raw-renewed.raw:null,heldError=heldActual?.valid&&held.valid?heldActual.microns-held.heldRaw:null;
    const row={condition,case:test.name,key,input,actual:observed,expected:{valid:renewed.valid,raw:renewed.raw,integer:integer(renewed.raw)},error,held:{actual:heldActual?.microns,actualValid:heldActual?.valid,expected:held.heldRaw,expectedValid:held.valid,error:heldError},rezeroOnly:held.raw};rows.push(row);
    if(!observed.valid||!renewed.valid||Math.abs(error)>1e-6||!heldActual?.valid||!held.valid||Math.abs(heldError)>1e-6)failures.push(row);
    if(key.length>1){const r=renewed.stages[0],hr=held.stages[0],ha=actual.held.find(v=>v.key===heldKey+'.R'),re=observed.R.raw-r.raw,he=ha?.microns-hr.heldRaw;const rowR={condition,case:test.name,key:key+'.R',input,actual:observed.R,expected:{valid:r.valid,raw:r.raw,integer:integer(r.raw)},error:re,held:{actual:ha?.microns,actualValid:ha?.valid,expected:hr.heldRaw,expectedValid:hr.valid,error:he},rezeroOnly:hr.raw};rows.push(rowR);if(!observed.R.valid||!r.valid||Math.abs(re)>1e-6||!ha?.valid||!hr.valid||Math.abs(he)>1e-6)failures.push(rowR);}
   }
  }
 }
 const summary={scope:'Support-input reconstruction, independently constructed finite fixture, bracketed-distance contacts; stationary old-zero and remount/re-zero compared separately. All standard fixtures must be valid, so over-rejection also fails.',rows:rows.length,comparisons:rows.length*2,maxErrorUm:Math.max(...rows.flatMap(r=>[Math.abs(r.error||0),Math.abs(r.held.error||0)])),failureCount:failures.length};
 fs.writeFileSync('docs/qa-fixtures-20261011/independent-horizontal-calculation.json',JSON.stringify({summary,failures,rows},null,2)+'\n');writeCalculationCSV({rows});console.log(JSON.stringify(summary,null,2));if(failures.length){console.log(JSON.stringify(failures.slice(0,8),null,2));process.exitCode=1;}
}
if(require.main===module)runCalculationAudit();

function writeCalculationCSV(report){const columns=['condition','case','key','beforeRaw','beforeInteger','actualRaw','actualInteger','independentExpectedRaw','expectedInteger','heldActualRaw','heldExpectedRaw','heldExpectedInteger','oldMountRezeroOnly','rawError','heldError'],rows=report.rows.map(r=>{const before=report.rows.find(b=>b.condition===r.condition&&b.case==='flat'&&b.key===r.key);return [r.condition,r.case,r.key,before?.actual.raw,integer(before?.actual.raw),r.actual.raw,integer(r.actual.raw),r.expected.raw,r.expected.integer,r.held.actual,r.held.expected,integer(r.held.expected),r.rezeroOnly,r.error,r.held.error];}),quote=v=>JSON.stringify(v===undefined||v===null?'':String(v));fs.writeFileSync('docs/qa-fixtures-20261011/independent-horizontal-calculation.csv',[columns,...rows].map(row=>row.map(quote).join(',')).join('\n')+'\n');}
module.exports.writeCalculationCSV=writeCalculationCSV;

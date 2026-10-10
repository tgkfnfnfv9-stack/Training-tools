'use strict';
// Independent expected geometry from support heights and declared fixture
// dimensions. No production support/frame/contact helper is used by the oracle.
// Production functions below are observations only, never expected values.
const fs=require('node:fs'),path=require('node:path');
const plus=(a,b)=>a.map((q,i)=>q+b[i]),minus=(a,b)=>a.map((q,i)=>q-b[i]),times=(a,k)=>a.map(q=>q*k),dot=(a,b)=>a.reduce((s,q,i)=>s+q*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>times(a,1/Math.hypot(...a));
const basis=[[1,0,0],[0,1,0],[0,0,1]],turn=(F,v)=>F.reduce((s,q,i)=>plus(s,times(q,v[i])),[0,0,0]),unturn=(F,v)=>F.map(q=>dot(q,v));
function seatAxes(dx,dz){
 // Unit normal to two independent surface tangents. Right is the section
 // at fixed z; this explicitly fixes yaw rather than inferring it from signs.
 const right=unit([1,dx,0]),up=unit(cross([0,dz,1],right));
 return [right,up,cross(right,up)];
}
function surface(nodes){
 const xs=[...new Set(nodes.map(q=>q.x))].sort((a,b)=>a-b),zs=[...new Set(nodes.map(q=>q.z))].sort((a,b)=>a-b);
 const A=Array.from({length:3},()=>[0,0,0,0]);
 for(const q of nodes){const row=[q.x,q.z,1];for(let i=0;i<3;i++){for(let j=0;j<3;j++)A[i][j]+=row[i]*row[j];A[i][3]+=row[i]*q.mm/1000;}}
 for(let i=0;i<3;i++){const k=A[i][i];for(let j=i;j<4;j++)A[i][j]/=k;for(let r=0;r<3;r++)if(r!==i){const f=A[r][i];for(let j=i;j<4;j++)A[r][j]-=f*A[i][j];}}
 const [a,b,c]=A.map(row=>row[3]),C=seatAxes(a,b);
 const sample=(x,z)=>{
  // The declared knot value belongs to the right/rear cell. Equivalent
  // decimal support coordinates must not select different one-sided limits.
  x=xs.find(v=>Math.abs(v-x)<1e-12)??x;z=zs.find(v=>Math.abs(v-z)<1e-12)??z;
  const cell=(v,q)=>Math.min(v.length-2,v.slice(1).filter(t=>q>=t).length),i=cell(xs,x),j=cell(zs,z),wx=xs[i+1]-xs[i],wz=zs[j+1]-zs[j],u=(x-xs[i])/wx,v=(z-zs[j])/wz;
  const H=[[xs[i],zs[j]],[xs[i+1],zs[j]],[xs[i],zs[j+1]],[xs[i+1],zs[j+1]]].map(([X,Z])=>nodes.find(q=>q.x===X&&q.z===Z).mm/1000);
  return {h:dot(H,[(1-u)*(1-v),u*(1-v),(1-u)*v,u*v]),dx:dot(H,[-(1-v),1-v,-v,v])/wx,dz:dot(H,[-(1-u),-u,1-u,u])/wz};
 };
 const mount=(x,z)=>{const s=sample(x,z),local=seatAxes(s.dx-a,s.dz-b);return {F:local.map(v=>turn(C,v)),p:plus(turn(C,[x,s.h-a*x-b*z-c,z]),[0,.66+c,0])};};
 return {sample,mount,C,a,b,c,nodes};
}
function machine(kind,nodes,state,profile,width,depth){
 const S=surface(nodes),wx=width/(kind==='horizontal'?2.72:4),wz=depth/(kind==='horizontal'?3.68:1.68),physical=p=>[p[0]*wx,p[1],p[2]*wz];
 const A=(profile?.squareness?.XY?.microns||0)/300000,B=(profile?.squareness?.XZ?.microns||0)/300000,C=(profile?.squareness?.YZ?.microns||0)/300000;
 const spin=(v,a,axis)=>{const n=basis[axis],c=Math.cos(a),s=Math.sin(a);return plus(plus(times(v,c),times(cross(n,v),s)),times(n,dot(n,v)*(1-c)));};
 const zIntrinsic=[-Math.sin(B),(-Math.sin(C)-Math.sin(B)*Math.sin(A))/Math.cos(A),0];zIntrinsic[2]=Math.sqrt(1-zIntrinsic[0]**2-zIntrinsic[1]**2);
 const at=(raw,owner,s=state)=>{
  let base,seat,relative,I=v=>v;
  if(kind==='horizontal'){
   base=physical(owner==='tool'?[0,.66,1.334]:[0,.66,-.85]);
   seat=plus(base,owner==='tool'?[.55*wx*s.X/100,0,0]:[0,0,.45*wz*s.Z/100]);
   relative=minus(physical(raw),base);
   if(owner==='tool'){relative[1]+=.3*s.Y/100;I=v=>spin(v,A,2);}
   else relative=plus(relative,times(minus(zIntrinsic,[0,0,1]),.45*wz*s.Z/100));
  }else{
   base=physical(owner==='tool'?[-1.75,.66,0]:owner==='tailstock'?[1.8,.66,0]:[.08,.66,.15]);
   seat=plus(base,owner==='work'?[.7*wx*s.Z/100,0,0]:[0,0,0]);
   relative=minus(physical(raw),base);
   if(owner==='work')relative[2]+=.35*wz*s.X/100;
   if(owner==='tool')I=v=>spin(v,B,1);
  }
  const m=S.mount(seat[0],seat[2]),F=basis.map(v=>turn(m.F,I(v)));
  return {point:plus(m.p,turn(F,relative)),F,seat,origin:m.p};
 };
 return {S,at,physical,wx,wz};
}
function planeHit(body,probe,point,normal){
 const f=e=>dot(minus(plus(body,times(probe,e)),point),normal);let l=0,r=.02,fl=f(l);
 if(fl*f(r)>0)return null;
 for(let i=0;i<60;i++){const m=(l+r)/2;if(fl*f(m)<=0)r=m;else {l=m;fl=f(m);}}
 return (l+r)/2;
}
function cylinderHit(body,probe,origin,axis,radius=.025,loAxial=-Infinity,hiAxial=Infinity){
 const f=e=>Math.hypot(...cross(minus(plus(body,times(probe,e)),origin),axis))-radius;
 let l=0,r=.02;if(f(l)<0||f(r)>0)return null;
 for(let i=0;i<60;i++){const m=(l+r)/2;if(f(m)>0)l=m;else r=m;}
 const extension=(l+r)/2,point=plus(body,times(probe,extension)),axial=dot(minus(point,origin),axis);
 return axial<loAxial-1e-10||axial>hiAxial+1e-10?null:{extension,point,axial};
}
const span=(value,half)=>{const start=Math.max(-half,Math.min(half-.3,value*half/100));return [start/half*100,(start+.3)/half*100];};
function fixtureBar(m,state,kind,details){
 const [z0,z1]=span(state.Z,kind==='horizontal'?.45*m.wz:.7*m.wx),s0={...state,Z:z0},s1={...state,Z:z1};
 const head=m.at(kind==='horizontal'?[0,2.55,-.93]:[-1.075,1.5,0],'tool'),axis=head.F[kind==='horizontal'?2:0];
 const origin=kind==='horizontal'?minus(head.point,times(axis,.31)):head.point;
 const raw=kind==='horizontal'?[0,1.27,-.85]:[.08,1.5,.20],mount0=m.at(raw,'work',s0),mount1=m.at(raw,'work',s1);
 const centre=kind==='horizontal'?origin:plus(origin,times(axis,dot(minus(mount0.point,origin),axis)));
 const result={};
 for(const [key,outward] of kind==='horizontal'?[['a',times(head.F[0],-1)],['b',times(head.F[1],-1)]]:[['barSide',head.F[2]],['barTop',head.F[1]]]){
  const b0=plus(centre,times(outward,.035)),u0=times(outward,-1),arm=unturn(mount0.F,minus(b0,mount0.point)),direction=unturn(mount0.F,u0);
  const b1=plus(mount1.point,turn(mount1.F,arm)),u1=turn(mount1.F,direction),lo=kind==='horizontal'?-.01:0,hi=kind==='horizontal'?.31:2.2*m.wx;
  const e0=cylinderHit(b0,u0,origin,axis,.025,lo,hi),e1=cylinderHit(b1,u1,origin,axis,.025,lo,hi);
  result[key]=e0&&e1?(e0.extension-e1.extension)*1e6:null;
  if(details){
   const physicalStart=kind==='horizontal'?(-.85+.45*z0/100)*m.wz:(.08+.7*z0/100)*m.wx,coordinate=kind==='horizontal'?'z':'x',ts=new Set(Array.from({length:17},(_,i)=>i/16));
   for(const p of m.S.nodes){const t=(p[coordinate]-physicalStart)/.3;if(t>0&&t<1)for(const delta of [-1e-8,0,1e-8])ts.add(t+delta);}
   details[key]={origin,axis,samples:[...ts].sort((a,b)=>a-b).map(t=>{const mount=m.at(raw,'work',{...s0,Z:z0+(z1-z0)*t}),body=plus(mount.point,turn(mount.F,arm)),probe=turn(mount.F,direction);return {t,body,probe,...cylinderHit(body,probe,origin,axis,.025,lo,hi)};})};
  }
 }
 return result;
}
function lathe(m,state,fixed){
 const [x0,x1]=span(state.X,.35*m.wz),[z0,z1]=span(state.Z,.7*m.wx),result=fixtureBar(m,state,'lathe');
 for(const [key,raw,start,end,normal] of [
  ['face',[-.09,1.5,1],{...state,X:x0},{...state,X:x1},[-Math.cos(fixed.face),0,-Math.sin(fixed.face)]],
  ['flat',[.23,1.5,1.43],{...state,Z:z0},{...state,Z:z1},[Math.sin(fixed.flat),0,Math.cos(fixed.flat)]]]){
  const a=m.at(raw,'work',start),b=m.at(raw,'work',end),n=turn(a.F,normal),body=plus(a.point,times(n,.01)),probe=times(n,-1);
  result[key]=(planeHit(body,probe,a.point,n)-planeHit(body,probe,b.point,turn(b.F,normal)))*1e6;
 }
 const head=m.at([-1.075,1.5,0],'tool'),hole=m.at([-.09,1.5,.20],'work',{...state,X:-.20/.35*100}),centre=plus(hole.point,turn(hole.F,[0,fixed.holeY,fixed.holeX])),delta=minus(centre,head.point);
 result.dx=dot(delta,head.F[2])*1e6;result.dy=dot(delta,head.F[1])*1e6;
 const centre2=[result.dx/1e6,result.dy/1e6];
 const ext=[[1,0],[0,1],[-1,0],[0,-1]].map(ray=>{let l=0,r=.05;for(let i=0;i<60;i++){const t=(l+r)/2;if(Math.hypot(ray[0]*t-centre2[0],ray[1]*t-centre2[1])>.025)r=t;else l=t;}return (l+r)/2;});
 result.bore=ext.map(v=>(ext[0]-v)*1e6);return result;
}
function horizontalReference(m,state){
 const values={},setups={};
 for(const key of ['XY','XZ','YZ']){
  const scan=key==='XY'?'Y':'Z',base=key==='YZ'?'Y':'X',half=axis=>axis==='X'?.55*m.wx:axis==='Y'?.3:.45*m.wz;
  const [s0,s1]=span(state[scan],half(scan)),start={...state,[scan]:s0},end={...state,[scan]:s1};
  const [r0,r1]=span(state[base],half(base)),beginR={...start,[base]:r0},endR={...start,[base]:r1};
  const pallet=m.at([0,1.27,-.85],'work',start),P=pallet.point,F=pallet.F;
  const offset=key==='XY'?[-.15,.05,0]:key==='XZ'?[-.15,.05,.16]:[0,.05,.16],Q=plus(P,turn(F,offset));
  const headR=m.at([0,2.55,-.93],'tool',beginR),headR1=m.at([0,2.55,-.93],'tool',endR),contactArm=unturn(headR.F,minus(Q,headR.point)),Q1=plus(headR1.point,turn(headR1.F,contactArm));
  const Snormal=unit(minus(Q1,Q)),relativeDirection=key==='XY'?F[1]:times(F[2],-1),Rnormal=unit(minus(relativeDirection,times(Snormal,dot(relativeDirection,Snormal))));
  const Rbody=minus(Q,times(Rnormal,.01)),Rprobe=Rnormal,Rarm=unturn(headR.F,minus(Rbody,headR.point)),RlocalProbe=unturn(headR.F,Rprobe);
  const rExtensions=[],rContacts=[];
  for(let i=0;i<=16;i++){
   const h=m.at([0,2.55,-.93],'tool',{...beginR,[base]:r0+(r1-r0)*i/16}),body=plus(h.point,turn(h.F,Rarm)),probe=turn(h.F,RlocalProbe),e=planeHit(body,probe,Q,Rnormal);
   rExtensions.push(e);rContacts.push(e===null?null:plus(body,times(probe,e)));
  }
  const S=plus(plus(Q,times(Snormal,.31)),times(Rnormal,.01)),head=m.at([0,2.55,-.93],'tool',start),body=plus(S,times(Snormal,.01)),probe=times(Snormal,-1),arm=unturn(head.F,minus(body,head.point)),direction=unturn(head.F,probe),masterPoint=unturn(F,minus(S,P)),masterNormal=unturn(F,Snormal);
  const samples=[],ts=new Set(Array.from({length:17},(_,i)=>i/16));
  if(scan==='Z')for(const p of m.S.nodes){const t=(p.z-(-.85+.45*s0/100)*m.wz)/.3;if(t>0&&t<1)for(const d of [-1e-8,0,1e-8])ts.add(t+d);}
  for(const t of [...ts].sort((a,b)=>a-b)){
   const s={...start,[scan]:s0+(s1-s0)*t},h=m.at([0,2.55,-.93],'tool',s),p=m.at([0,1.27,-.85],'work',s),b=plus(h.point,turn(h.F,arm)),u=turn(h.F,direction),q=plus(p.point,turn(p.F,masterPoint)),n=turn(p.F,masterNormal),e=planeHit(b,u,q,n);
   samples.push({t,extension:e,body:b,probe:u,point:q,normal:n});
  }
  values[key]=(samples[0].extension-samples.at(-1).extension)*1e6;
  setups[key]={Rmicrons:(rExtensions[0]-rExtensions.at(-1))*1e6,Rextensions:rExtensions,Rcontacts:rContacts,Ssamples:samples,Q,Q1,Snormal,Rnormal};
 }
 return {values,setups};
}
function run(){
 const root=path.resolve(process.env.TT_ROOT||path.join(__dirname,'..'));process.chdir(root);
 const env=require(path.join(root,'tests/leveling-dom-env.cjs'))({pureLeveling:true});
 for(const f of ['lathe-inspection.js','lathe-inspection-ui.js'])env.read(fs.readFileSync('src/'+f,'utf8'));env.read('updateLatheInspectionUI=()=>{};');
 const failures=[],rows=[],summary={states:0,comparisons:0,maxErrorUm:0,modelCoordinates:0};
 const compare=(got,want,label,tolerance=5e-6)=>{summary.comparisons++;const error=Math.abs(got-want);summary.maxErrorUm=Math.max(summary.maxErrorUm,error);if(got===null||!Number.isFinite(got)||error>tolerance)failures.push({label,got,want,error});};
 const Plane=require(path.join(root,'src/reference-measurement.js')),Cylinder=require(path.join(root,'src/horizontal-parallelism.js'));
 const rotAxis=unit([1,2,-3]),rotate=v=>plus(plus(times(v,Math.cos(.43)),times(cross(rotAxis,v),Math.sin(.43))),times(rotAxis,dot(rotAxis,v)*(1-Math.cos(.43)))),translate=[1.4,-.7,.3];
 const common=p=>({point:plus(rotate(p.point),translate),normal:rotate(p.normal),body:plus(rotate(p.body),translate),probe:rotate(p.probe)});
 for(const side of [-1,1])for(const delta of [-12e-6,12e-6]){
  const first={point:[0,0,0],normal:[1,0,0],body:[side*.01,0,0],probe:[-side,0,0]},last={...first,body:[side*(.01-delta),.3,0]};
  compare(Plane.compare(first,last).microns,delta*1e6,'analytic plane approach/recede either side');
  compare(Plane.compare(last,first).microns,-delta*1e6,'fixed plane exchange and re-zero');
  compare(Plane.compare(common(first),common(last)).microns,delta*1e6,'arbitrary external common rigid transform');
  for(const radial of [[0,1,0],[0,0,1]]){
   const outward=times(radial,side),a={body:plus([.1,0,0],times(outward,.035)),probe:times(outward,-1)},b={body:plus([.4,0,0],times(outward,.035-delta)),probe:a.probe},bar={origin:[0,0,0],axis:[1,0,0],axialMin:0,axialMax:.5};
   compare(Cylinder.measure({...bar,samples:[a,b]}).microns,delta*1e6,'analytic cylinder four contact sides');
   compare(Cylinder.measure({...bar,samples:[b,a]}).microns,-delta*1e6,'fixed bar exchange and re-zero');
   const T=p=>({body:plus(rotate(p.body),translate),probe:rotate(p.probe)});
   compare(Cylinder.measure({...bar,origin:translate,axis:rotate(bar.axis),samples:[T(a),T(b)]}).microns,delta*1e6,'arbitrary common rigid cylinder pose');
  }
 }
 for(const kind of ['horizontal','lathe']){
  env.read(`openMachine(machines.find(m=>m.kind==='${kind}'));$('exaggerate').checked=false;`);
  const standard=kind==='horizontal'?[2.72,3.68]:[4,1.68],count=kind==='horizontal'?8:6;
  const used=env.json(`window.MachineAccuracy.generate('used',123456,${JSON.stringify(kind==='horizontal'?['X','Y','Z']:['X','Z'])},${count})`);
  const fixedUsed=env.json('window.LatheInspection.intrinsic('+JSON.stringify(used)+')');
  for(const dims of [standard,kind==='horizontal'?[3.8,2.7]:[5.2,1.2]]){
   const [width,depth]=dims,xs=kind==='horizontal'?[-width/2,width/2]:[-width/2,0,width/2],zs=kind==='horizontal'?[-depth/2,-depth/6,depth/6,depth/2]:[-depth/2,depth/2];
   const inputs=[['flat',()=>0],['plane+',(x,z)=>.08*x+.06*z],['plane-',(x,z)=>-.08*x-.06*z],...[-.05,-.01,.01,.05].map(k=>['twist'+k,(x,z)=>k*x*z]),['twist+plane',(x,z)=>.05*x*z+.08*x+.06*z]];
   for(let s=0;s<count;s++)for(const d of [-.01,-.001,.001,.01])inputs.push([`support${s}:${d}`,(x,z,i)=>i===s?d:0]);
   for(const [name,h] of inputs)for(const profile of [null,used]){
    const nodes=zs.flatMap((z,j)=>xs.map((x,i)=>({x,z,mm:h(x,z,j*xs.length+i)}))),heights=nodes.map(q=>q.mm);
    const seam=kind==='horizontal'?(-depth/6/(depth/3.68)+.85)/.45*100:-.08/.7*100;
    const states=[{X:0,Y:0,Z:0},{X:-100,Y:-100,Z:-100},{X:100,Y:100,Z:100},{X:57,Y:43,Z:29},...[-1e-5,0,1e-5].map(d=>({X:-31,Y:67,Z:seam+d}))].map(s=>({...s,A:0,C:0}));
    // All individual support steps at central and asymmetric positions; full
    // endpoints/seams for each signed twist/plane and each support dimension.
    for(const state of name.startsWith('support')?[states[0],states[3]]:states){
     env.read(`levelConfig.width=${width};levelConfig.depth=${depth};machineProfile=${JSON.stringify(profile)};supportHeights=${JSON.stringify(heights)};positions=${JSON.stringify(state)};levelSolution=machineSolution(supportHeights);levelGeometry=geometryModel();levelGeometry.visualFactor=1;`);
     const m=machine(kind,nodes,state,profile,width,depth),reference=kind==='horizontal'?horizontalReference(m,state):null,bars={},barValues=fixtureBar(m,state,kind,bars),expect=kind==='horizontal'?{...barValues,...reference.values}:lathe(m,state,profile?fixedUsed:{face:0,flat:0,holeX:0,holeY:0});
     const observed=kind==='horizontal'?env.json(`(()=>{const p=horizontalParallelism(),refs=Object.fromEntries(['XY','XZ','YZ'].map(key=>[key,referenceScan({key})]));return {a:p.a.microns,b:p.b.microns,XY:refs.XY.microns,XZ:refs.XZ.microns,YZ:refs.YZ.microns,refs,bars:p}})()`):env.json('latheInspectionGeometry()');
     for(const key of Object.keys(expect).filter(k=>k!=='bore'))compare(observed[key],expect[key],`${kind}/${name}/${profile?'used':'ideal'}/${width},${depth}/${JSON.stringify(state)}/${key}`);
     if(reference)for(const key of ['XY','XZ','YZ']){
      compare(reference.setups[key].Rmicrons,0,`${kind}/${name}/${key} independent R endpoints equal`);
      if(observed.refs[key].alignment){
       compare(Plane.compare(observed.refs[key].end,observed.refs[key].start).microns,-expect[key],`${kind}/${name}/${key} fixed apparatus reversed and re-zeroed`);
       compare(observed.refs[key].alignment.microns,reference.setups[key].Rmicrons,`${kind}/${name}/${key} observed R equal endpoints`);
       for(const q of reference.setups[key].Ssamples){
        const a=observed.refs[key].samples.find(a=>Math.abs(a.t-q.t)<1e-9);
        if(q.extension===null||!a)failures.push({label:`${kind}/${name}/${key} independent S contact/missing sample`,t:q.t});
        else {compare(a.extension,q.extension,`${kind}/${name}/${key} S extension t=${q.t}`,2e-12);for(const field of ['body','probe','point','normal'])q[field].forEach((v,i)=>compare(a.pose[field][i],v,`${kind}/${name}/${key} S ${field}[${i}] t=${q.t}`,2e-10));}
       }
      }
     }
     for(const key of Object.keys(bars))for(const q of bars[key].samples){
      const samples=kind==='horizontal'?observed.bars[key].samples:observed[key==='barSide'?'side':'top'].samples,a=samples?.find(a=>Math.abs(a.t-q.t)<1e-9);
      if(!a||q.extension===undefined)failures.push({label:`${kind}/${name}/${key} bar contact/missing sample`,t:q.t});
      else {compare(a.extension,q.extension,`${kind}/${name}/${key} bar extension t=${q.t}`,2e-12);for(const field of ['body','probe'])q[field].forEach((v,i)=>compare(a[field][i],v,`${kind}/${name}/${key} ${field}[${i}] t=${q.t}`,2e-10));}
     }
     if(expect.bore)expect.bore.forEach((v,i)=>compare(observed.bore.readings[i],v,`${kind}/${name}/bore${i}`));
     if(state.X===0&&width===standard[0])rows.push({kind,input:name,individual:profile?'used/123456':'ideal',heightsMm:heights,state,rawUm:Object.fromEntries(Object.keys(observed).filter(k=>typeof observed[k]==='number').map(k=>[k,observed[k]])),displayUm:Object.fromEntries(Object.keys(observed).filter(k=>typeof observed[k]==='number').map(k=>[k,Math.round(observed[k])])),expectedUm:expect});
     for(const [raw,owner,axes,pose] of kind==='horizontal'?[[[0,2.55,-.93],'tool',['X','Y'],'tool'],[[0,1.27,-.85],'work',['Z'],'work']]:[[[-1.075,1.5,0],'tool',[],'tool'],[[.08,1.5,.2],'work',['X','Z'],'work'],[[1.8,.66,0],'tailstock',[],'latheTailstockVisual']]){
      const actual=env.json(`displayedModelPoint(${JSON.stringify(raw)},${JSON.stringify(axes)},current,positions,'${pose}').map((v,i)=>v-(i===1?displayClearance():0))`),wanted=m.at(raw,owner).point;
      actual.forEach((v,i)=>compare(v,wanted[i],`${kind}/${name}/mesh/${owner}/${i}`,2e-10));summary.modelCoordinates+=3;
     }
     summary.states++;
    }
   }
  }
 }
 summary.shortTravelStates=0;
 for(const kind of ['horizontal','lathe']){
  env.read(`openMachine(machines.find(m=>m.kind==='${kind}'));machineProfile=null;supportHeights=supports.map(()=>0);`);
  const minimum=kind==='horizontal'?[.3*2.72/1.1,.3*3.68/.9]:[6/7,.72],standard=kind==='horizontal'?[2.72,3.68]:[4,1.68];
  for(const [width,depth] of [[.5,standard[1]],[standard[0],.5],minimum,minimum.map(q=>q-1e-7),minimum.map(q=>q+1e-7)])for(const end of [-100,100]){
   env.read(`levelConfig.width=${width};levelConfig.depth=${depth};positions={X:${end},Y:0,Z:${end},A:0,C:0};levelSolution=machineSolution(supportHeights);levelGeometry=geometryModel();`);
   if(kind==='horizontal'){
    const x=1.1*width/2.72>=.3-1e-12,z=.9*depth/3.68>=.3-1e-12;
    for(const [key,want] of [['XY',x],['XZ',x&&z],['YZ',z]]){const got=env.json(`referenceScan({key:'${key}'})`);compare(Number(got.valid),Number(want),`${kind} finite square interval ${width}/${depth}/${key}`);if(want)compare(got.microns,0,`${kind} minimum exact interval ideal ${key}`);}
   }else{
    const got=env.json('latheInspectionGeometry()'),x=.7*depth/1.68>=.3-1e-12,z=1.4*width/4>=.3-1e-12;
    compare(Number(got.validX),Number(x),`${kind} finite X interval`);compare(Number(got.validZ),Number(z),`${kind} finite Z interval`);
    if(x)compare(got.face,0,`${kind} minimum interval ideal face`);if(z)for(const key of ['flat','barSide','barTop'])compare(got[key],0,`${kind} minimum interval ideal ${key}`);
   }
   summary.shortTravelStates++;
  }
 }
 summary.commonPlaneMaxDeltaUm=0;
 for(const a of rows.filter(r=>r.input==='twist0.05')){const b=rows.find(r=>r.kind===a.kind&&r.individual===a.individual&&r.input==='twist+plane');for(const key of Object.keys(a.expectedUm).filter(k=>k!=='bore'))summary.commonPlaneMaxDeltaUm=Math.max(summary.commonPlaneMaxDeltaUm,Math.abs(a.rawUm[key]-b.rawUm[key]));}
 const report={root,passed:failures.length===0,summary,failures:failures.slice(0,200),failureCount:failures.length,rows};
 const output=process.env.TT_REPORT;if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({...report,rows:undefined,failures:failures.slice(0,6)},null,2));
 if(failures.length&&!process.env.TT_BASELINE)process.exitCode=1;
}
module.exports={surface,machine,fixtureBar,lathe,horizontalReference,planeHit,cylinderHit,plus,minus,times,dot,cross,unit,turn,unturn,span};
if(require.main===module)run();

'use strict';
// Independent audit of declared teaching geometry, built from support INPUTS.
// No production geometry, contact, sign, or measurement function is used for
// expected values. The production DOM environment supplies inputs/observations.
const fs=require('node:fs'),path=require('node:path');
const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),mul=(a,s)=>a.map(x=>x*s),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>mul(a,1/Math.hypot(...a));
const eye=[[1,0,0],[0,1,0],[0,0,1]],rot=(f,v)=>f.reduce((a,q,i)=>add(a,mul(q,v[i])),[0,0,0]),inv=(f,v)=>f.map(q=>dot(q,v)),compose=(f,g)=>g.map(q=>rot(f,q));
const frame=(dx,dz)=>{const x=unit([1,dx,0]),y=unit(cross([0,dz,1],x));return [x,y,cross(x,y)];};
function solve(A,b){A=A.map((r,i)=>[...r,b[i]]);for(let i=0;i<b.length;i++){let p=i;for(let k=i+1;k<b.length;k++)if(Math.abs(A[k][i])>Math.abs(A[p][i]))p=k;[A[i],A[p]]=[A[p],A[i]];let d=A[i][i];for(let j=i;j<=b.length;j++)A[i][j]/=d;for(let k=0;k<b.length;k++)if(k!==i){d=A[k][i];for(let j=i;j<=b.length;j++)A[k][j]-=d*A[i][j];}}return A.map(r=>r.at(-1));}
function surface(nodes){
 const A=Array.from({length:3},()=>[0,0,0]),b=[0,0,0];for(const p of nodes){const r=[p.x,p.z,1];for(let i=0;i<3;i++){b[i]+=r[i]*p.h/1000;for(let j=0;j<3;j++)A[i][j]+=r[i]*r[j];}}
 const [a,c,d]=solve(A,b),xs=[...new Set(nodes.map(p=>p.x))].sort((a,b)=>a-b),zs=[...new Set(nodes.map(p=>p.z))].sort((a,b)=>a-b);
 const at=(x,z)=>{if(nodes.length===3)return {h:a*x+c*z+d,dx:a,dz:c};const cell=(v,x)=>Math.min(v.length-2,v.slice(1).filter(t=>x>=t).length),i=cell(xs,x),j=cell(zs,z),w=xs[i+1]-xs[i],h=zs[j+1]-zs[j],u=(x-xs[i])/w,v=(z-zs[j])/h;const q=[[i,j],[i+1,j],[i,j+1],[i+1,j+1]].map(([i,j])=>nodes.find(p=>p.x===xs[i]&&p.z===zs[j]).h/1000);return {h:dot(q,[(1-u)*(1-v),u*(1-v),(1-u)*v,u*v]),dx:dot(q,[-1+v,1-v,-v,v])/w,dz:dot(q,[-1+u,-u,1-u,u])/h};};return {a,c,d,at,C:frame(a,c)};
}
function compactSurface(S,width,depth){
 // Ritz energy of w=t XZ+q1(1-X²)Z+q3(1-X²)Z³;
 // five-point tensor Gauss quadrature integrates the polynomial energy exactly.
 const a=width/2,b=depth/2,G=[[-.906179845938664,.236926885056189],[-.538469310105683,.478628670499366],[0,.568888888888889],[.538469310105683,.478628670499366],[.906179845938664,.236926885056189]],K=[[0,0],[0,0]],f=[0,0];
 const curvature=(X,Z)=>[[0,0,1/(a*b)],[-2*Z/a**2,0,-2*X/(a*b)],[-2*Z**3/a**2,6*Z*(1-X**2)/b**2,-6*X*Z**2/(a*b)]],energy=(v,w)=>v[0]*w[0]+v[1]*w[1]+.3*(v[0]*w[1]+v[1]*w[0])+1.4*v[2]*w[2];
 for(const [X,wX] of G)for(const [Z,wZ] of G){const H=curvature(X,Z),w=wX*wZ*a*b*(1+.5*X);for(let i=0;i<2;i++){f[i]-=w*energy(H[i+1],H[0]);for(let j=0;j<2;j++)K[i][j]+=w*energy(H[i+1],H[j+1]);}}
 const t=(S.at(a,b).h-S.at(-a,b).h-S.at(a,-b).h+S.at(-a,-b).h)/4,[q1,q3]=solve(K,f).map(v=>v*t),old=S.at;
 return {...S,at:(x,z)=>{const X=x/a,Z=z/b,s=old(x,z),v=q1*Z+q3*Z**3;return {h:s.h+(1-X**2)*v,dx:s.dx-2*X*v/a,dz:s.dz+(1-X**2)*(q1+3*q3*Z**2)/b};}};
}
function intrinsic(profile,nominal){
 const theta=(p)=>profile?(profile.squareness[p]?.microns||0)/300000:0,A=theta('XY'),B=theta('XZ'),C=theta('YZ');
 // Solve the three pair dot-product constraints in the machine's nominal basis.
 const x=nominal[0],y=add(mul(nominal[0],-Math.sin(A)),mul(nominal[1],Math.cos(A))),zx=-Math.sin(B),zy=(-Math.sin(C)-dot(y,nominal[0])*zx)/dot(y,nominal[1]);
 return [x,y,add(add(mul(nominal[0],zx),mul(nominal[1],zy)),mul(nominal[2],Math.sqrt(1-zx*zx-zy*zy)))];
}
function model(input,nodes){
 const {kind,w,d,width,depth,profile}=input,layoutX=w*.2*(input.columnX||0)/100,layoutZ=d*.1*(input.columnZ||0)/100,sx=width/(w*.8),sz=depth/(d*.8),map=p=>[p[0]*sx,p[1],p[2]*sz],base=surface(nodes),S=kind==='compact'?compactSurface(base,width,depth):base;
 const gate=['double','gantry'].includes(kind),nominal=gate?[[0,0,1],[1,0,0],[0,1,0]]:[[1,0,0],[0,0,1],[0,1,0]],I=intrinsic(profile,nominal),seat=(s,x,z)=>{const v=s.at(x,z);return kind==='compact'||gate?compose(base.C,frame(v.dx-base.a,v.dz-base.c)):frame(v.dx,v.dz);};
 const point=(x,z,s=S)=>{const q=s.at(x,z);return add(rot(base.C,[x,q.h-base.a*x-base.c*z-base.d,z]),[0,.66+base.d,0]);};
 const tableP=state=>{const z=(-d*.1+.4*state.Y/100)*sz,F=seat(S,0,z),travel=.4*state.Y/100*sz,v=add([.45*state.X/100*sx,.5,0],mul(sub(I[1],[0,0,1]),travel));return add(point(0,z),rot(F,v));};
 const derivative=state=>{const h=.001,delta=h/(.4*sz)*100,at=k=>tableP({...state,Y:state.Y+k*delta});return unit(mul(add(sub(mul(at(1),8),mul(at(-1),8)),sub(at(-2),at(2))),1/(12*h)));};
 const frames=state=>{
  let tool,work,dirs;
  if(kind==='compact'){tool=seat(S,layoutX*sx,(d*.29+layoutZ)*sz);work=seat(S,0,(-d*.1+.4*state.Y/100)*sz);dirs=[rot(work,I[0]),derivative(state),rot(tool,I[2])];}
  else if(kind==='five'){tool=seat(S,layoutX*sx,(d*.3+layoutZ)*sz);work=seat(S,.35*state.X/100*sx,(-.45+.35*state.Y/100)*sz);dirs=[rot(work,I[0]),rot(work,I[1]),rot(tool,I[2])];}
  else if(kind==='travel'){const x=(-.5+state.X/100+layoutX)*sx;tool=seat(S,x,(d*.29+layoutZ)*sz);work=seat(S,0,-d*.18*sz);const slopes=[-.1,.1].map(k=>S.at(x,(d*.22+k)*sz)),guide=frame((slopes[0].dx+slopes[1].dx)/2,(slopes[0].dz+slopes[1].dz)/2);dirs=[rot(guide,I[0]),rot(tool,I[1]),rot(tool,I[2])];}
  else {
   const Z=kind==='double'?.825:.7*state.X/100,px=kind==='double'?1.10:w*.4;
   const columns=[-1,1].map(k=>{const subS=kind==='double'?surface(nodes.filter(p=>p.group===(k<0?'column-left':'column-right'))):S,x=k*px*sx,z=Z*sz,v=subS.at(x,z),F=frame(v.dx-base.a,v.dz-base.c),foot=[x,v.h-base.a*x-base.c*z-base.d,z];return {F,top:add(foot,mul(F[1],2.51)),v};});
   const right=unit(sub(columns[1].top,columns[0].top)),up=unit(add(columns[0].F[1],columns[1].F[1]));tool=compose(base.C,[right,up,unit(cross(right,up))]);
   const bed=kind==='double'?surface(nodes.filter(p=>p.group==='bed')):S;work=seat(bed,0,kind==='double'?.7*state.X/100*sz:0);
   const guide=kind==='gantry'?frame((columns[0].v.dx+columns[1].v.dx)/2,(columns[0].v.dz+columns[1].v.dz)/2):work;
   dirs=[rot(guide,I[0]),rot(tool,I[1]),rot(tool,I[2])];
  }
  return {tool,work,dirs:dirs.map(unit)};
 };
 return {S,base,map,frames,tableP,I,nominal};
}
function planeExtension(body,probe,point,normal){
 const f=e=>dot(sub(add(body,mul(probe,e)),point),normal);let a=0,b=.02,fa=f(a);if(fa*f(b)>0)return null;
 for(let i=0;i<55;i++){const c=(a+b)/2;if(fa*f(c)<=0)b=c;else {a=c;fa=f(c);}}return (a+b)/2;
}
function scan(m,input,state,key){
 const scan=key[1],base=key[0],index=k=>'XYZ'.indexOf(k),master=['compact','five'].includes(input.kind)&&scan==='Y',sign=key==='XY'?1:-1;
 const amp=scan==='Z'?(input.kind==='double'||input.kind==='gantry'?.28:.3):input.kind==='compact'?.4:input.kind==='five'?.35:input.kind==='travel'?.35:.65;
 const half=Math.hypot(...m.map(mul(m.nominal[index(scan)],amp))),lo=Math.max(-half,Math.min(half-.3,state[scan]/100*half)),hi=lo+.3,memberSign=sign*(master?-1:1),p0=memberSign>0?lo:hi,p1=memberSign>0?hi:lo,s0={...state,[scan]:p0/half*100},s1={...state,[scan]:p1/half*100},g0=m.frames(s0),g1=m.frames(s1),n=g0.dirs[index(base)],probe=mul(n,-1),body=mul(n,.01);
 const rigid=F=>{const u=unit(F[1]),r=unit(sub(F[0],mul(u,dot(F[0],u))));return [r,u,cross(r,u)];},T0=rigid(g0.tool),T1=rigid(g1.tool),W0=rigid(g0.work),W1=rigid(g1.work),transport=(v,F0,F1)=>rot(F1,inv(F0,v));
 const travel=input.kind==='compact'&&scan==='Y'?sub(m.tableP(s1),m.tableP(s0)):mul(g0.dirs[index(scan)],p1-p0),point=master?travel:[0,0,0],lastBody=add(master?[0,0,0]:travel,transport(body,T0,T1)),lastProbe=transport(probe,T0,T1),lastNormal=transport(n,W0,W1),e0=planeExtension(body,probe,[0,0,0],n),e1=planeExtension(lastBody,lastProbe,point,lastNormal);
 return {value:e0===null||e1===null?null:(e0-e1)*1e6,e0,e1,start:{body,probe,point:[0,0,0],normal:n},end:{body:lastBody,probe:lastProbe,point,normal:lastNormal},interval:[p0,p1]};
}
function sweep(m,state){
 const g=m.frames(state),axis=unit(rot(g.tool,m.I[2])),normal=rot(g.work,[0,Math.cos((state.A||0)*.45/100),Math.sin((state.A||0)*.45/100)]),from=m.nominal[2],to=m.I[2],axisOfRotation=cross(from,to),sin=Math.hypot(...axisOfRotation),cos=dot(from,to);
 const intrinsicRotate=v=>sin<1e-15?v:add(add(mul(v,cos),cross(axisOfRotation,v)),mul(axisOfRotation,dot(axisOfRotation,v)*(1-cos)/(sin*sin)));
 const right=rot(g.tool,intrinsicRotate([1,0,0])),r=unit(sub(right,mul(axis,dot(right,axis)))),back=unit(cross(r,axis));
 // Solve each line-to-plane intersection independently; zero at front only
 // after all four contacts have been found. No spindle-sweep formula is reused.
 const cardinal=[r,back,mul(r,-1),mul(back,-1)].map(v=>{const body=add(mul(v,.15),mul(axis,.01)),probe=mul(axis,-1),f=e=>dot(add(body,mul(probe,e)),normal);let lo=-1,hi=1;for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(f(mid)>0)lo=mid;else hi=mid;}return {body,probe,extension:(lo+hi)/2};});
 return {values:cardinal.map(p=>(cardinal[3].extension-p.extension)*1e6),cardinal,axis,normal};
}
function run(){
 const root=path.resolve(process.env.TT_ROOT||path.join(__dirname,'..'));process.chdir(root);const env=require(path.join(root,'tests/leveling-dom-env.cjs'))({pureLeveling:true}),failures=[],rows=[];let comparisons=0,maxError=0;
 const compare=(actual,wanted,label,tol=2e-5)=>{comparisons++;const error=Math.abs(actual-wanted);maxError=Math.max(maxError,error);if(!Number.isFinite(actual)||wanted===null||error>tol)failures.push({label,actual,wanted,error});};
 for(const id of ['vertical','travel','gate','gantry','five']){
  env.read(`openMachine(machines.find(m=>m.id==='${id}'));$('exaggerate').checked=false;`);
  const config=env.json('({kind:current.kind,w:current.w,d:current.d,width:levelConfig.width,depth:levelConfig.depth,nodes:supports.map(s=>({...levelCoordinates(s.x,s.z),group:s.group}))})');
  for(const condition of ['ideal','new','used']){
   const profile=condition==='ideal'?null:env.json(`window.MachineAccuracy.generate('${condition}',123456,['X','Y','Z'],supports.length)`),initial=profile?profile.initialHeights:config.nodes.map(()=>0),inputs=[{name:'before',heights:initial}];
   for(let i=0;i<initial.length;i++)for(const delta of [-.010,-.001,.001,.010])inputs.push({name:`support${i+1}:${delta}`,heights:initial.map((v,j)=>v+(i===j?delta:0)),support:i+1,delta});
   if(profile){inputs.push({name:'zero-before',heights:initial.map(()=>0)});for(let i=0;i<initial.length;i++)for(const delta of [-.010,-.001,.001,.010])inputs.push({name:`zero-support${i+1}:${delta}`,heights:initial.map((_,j)=>i===j?delta:0),support:i+1,delta});}
   for(const [name,fn] of [['uniform',p=>.01],['plane+',p=>.03*p.x+.02*p.z],['plane-',p=>-.03*p.x-.02*p.z],...(config.kind==='five'?[]:[['twist+',p=>.015*p.x*p.z],['twist-',p=>-.015*p.x*p.z]])])inputs.push({name,heights:config.nodes.map(fn)});
   for(const input of inputs)for(const state of [{X:0,Y:0,Z:0,A:0,C:0},{X:37,Y:-43,Z:27,A:0,C:0},...(!input.name.includes('support')?[{X:-100,Y:-100,Z:-100,A:0,C:0},{X:100,Y:100,Z:100,A:0,C:0}]:[])]){
    env.read(`machineProfile=${JSON.stringify(profile)};supportHeights=${JSON.stringify(input.heights)};positions=${JSON.stringify(state)};levelSolution=machineSolution(supportHeights);levelGeometry=geometryModel();`);
    const oracle=model({...config,profile},config.nodes.map((p,i)=>({...p,h:input.heights[i]}))),ref=Object.fromEntries(['XY','XZ','YZ'].map(k=>[k,scan(oracle,config,state,k)])),s=sweep(oracle,state);
    const observed=env.json(`(()=>{const refs=Object.fromEntries(['XY','XZ','YZ'].map(key=>[key,referenceDisplayScan({key})])),s=spindleSweepGeometry(positions,levelSolution,machineProfile,1,current.kind==='compact');return {refs:Object.fromEntries(Object.entries(refs).map(([k,r])=>[k,{value:r.microns,valid:r.valid,start:r.start,end:r.end,extensions:r.valid?[r.zero.extension,r.last.extension]:null}])),sweep:s.cardinal.map(p=>p.readingMicrons),sweepContact:s.cardinal.map(p=>p.onTable),display:Object.fromEntries([...Object.entries(refs).map(([k,r])=>[k,r.valid?squarenessMicronText(r.microns):null]),...s.cardinal.map((p,i)=>['sweep'+i,p.onTable?squarenessMicronText(p.readingMicrons):null])])}})()`);
    for(const key of ['XY','XZ','YZ'])compare(observed.refs[key].value,ref[key].value,`${id}/${condition}/${input.name}/${state.X}/${key}`);
    for(let i=0;i<4;i++)compare(observed.sweep[i],s.values[i],`${id}/${condition}/${input.name}/${state.X}/sweep${i}`);
    rows.push({machine:id,condition,seed:profile?.seed??null,input:input.name,support:input.support,deltaMm:input.delta,heightsMm:input.heights,state,rawUm:{...Object.fromEntries(Object.entries(observed.refs).map(([k,v])=>[k,v.value])),sweep:observed.sweep},display:observed.display,expectedUm:{...Object.fromEntries(Object.entries(ref).map(([k,v])=>[k,v.value])),sweep:s.values},oracleCoordinates:{scans:ref,sweep:s},observedCoordinates:observed.refs,contact:observed.sweepContact});
   }
  }
 }
 const rotary=[];env.read("openMachine(machines.find(m=>m.id==='five'));");const cfg=env.json('({kind:current.kind,w:current.w,d:current.d,width:levelConfig.width,depth:levelConfig.depth,nodes:supports.map(s=>({...levelCoordinates(s.x,s.z),group:s.group}))})');for(const [A,C] of [[0,0],[30,0],[-30,0],[0,50],[50,50],[-100,-100],[100,100]]){const state={X:0,Y:0,Z:0,A,C};env.read(`machineProfile=null;supportHeights=supports.map(()=>0);positions=${JSON.stringify(state)};levelSolution=machineSolution(supportHeights);`);const m=model({...cfg,profile:null},cfg.nodes.map(p=>({...p,h:0}))),expected=sweep(m,state),actual=env.json("({values:spindleSweepGeometry().cardinal.map(p=>p.readingMicrons),contact:spindleSweepGeometry().cardinal.map(p=>p.onTable),tableCentre:spindleSweepGeometry().tableCentre,tableRight:spindleSweepGeometry().tableRight,tableBack:spindleSweepGeometry().tableBack,tableNormal:spindleSweepGeometry().tableNormal,refs:['XY','XZ','YZ'].map(key=>referenceDisplayScan({key}).valid)})");actual.values.forEach((v,i)=>compare(v,expected.values[i],`five/rotary/${A}/${C}/sweep${i}`));actual.refs.forEach((v,i)=>compare(Number(v),Number(A===0&&C===0),`five/rotary/${A}/${C}/ref${i}`));const ca=Math.cos(A*.45/100),sa=Math.sin(A*.45/100),cc=Math.cos(C*Math.PI/100),sc=Math.sin(C*Math.PI/100),centre=[0,1.25+.31*ca,-.45+.31*sa],right=[cc,sc*sa,-sc*ca],back=[sc,-cc*sa,cc*ca],normal=[0,ca,sa];for(const [key,vector] of Object.entries({tableCentre:centre,tableRight:right,tableBack:back,tableNormal:normal}))vector.forEach((v,i)=>compare(actual[key][i],v,`five/rotary/${A}/${C}/${key}/${i}`,1e-12));const expectedContact=[[.15,0],[0,.15],[-.15,0],[0,-.15]].map(([x,dz])=>{const z=-.3+dz,y=centre[1]-(z-centre[2])*sa/ca,d=sub([x,y,z],centre);return (dot(d,right)/.65)**2+(dot(d,back)/.65)**2<=1+1e-10;});expectedContact.forEach((v,i)=>compare(Number(actual.contact[i]),Number(v),`five/rotary/${A}/${C}/contact${i}`));rotary.push({state,expectedUm:expected.values,expectedContact,expectedTable:{centre,right,back,normal},actual});}
 const report={rotary,scope:'five milling machines; 300 mm renewed-zero squareness and 300 mm diameter renewed-front-zero sweep; A=C=0; physical support-derived expectation',limitations:['Fixed-mount old-zero indication is undefined in the product because physical fixture mounting points and axial arm length are not specified.','Contact finite table bounds are observed separately, not independently certified by this orientation audit.','Ritz bending and portal seat assumptions are audited teaching geometry, not machine elasticity.'],states:rows.length,comparisons,maxErrorUm:maxError,passed:failures.length===0,failureCount:failures.length,failures,rows};
 if(process.env.TT_REPORT)fs.writeFileSync(process.env.TT_REPORT,JSON.stringify(report)+'\n');console.log(JSON.stringify({...report,rotary:undefined,rows:undefined,failures:failures.slice(0,12)},null,2));if(failures.length&&!process.env.TT_BASELINE)process.exitCode=1;
}
module.exports={model,scan,sweep,surface,compactSurface,planeExtension};if(require.main===module)run();

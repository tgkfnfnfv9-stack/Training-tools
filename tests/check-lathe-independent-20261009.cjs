'use strict';
// Independent lathe geometry: input support heights -> nodal interpolation ->
// explicit rigid transforms -> distance/bisection contacts. Product rendering,
// geometryModel, frame helpers and measurement signs are not expected values.
const assert=require('node:assert/strict'),fs=require('node:fs');
const env=require('./leveling-dom-env.cjs')({pureLeveling:true});
env.read(fs.readFileSync('src/lathe-inspection.js','utf8'));
env.read(fs.readFileSync('src/lathe-inspection-ui.js','utf8'));
env.read('updateLatheInspectionUI=()=>{};');
env.read("openMachine(machines.find(m=>m.kind==='lathe'));$('exaggerate').checked=false;");
const API=require('../src/lathe-inspection.js'),Intrinsic=require('../src/intrinsic-inspection.js');
let assertions=0,cases=0,maxError=0;
const near=(a,b,label,t=4e-6)=>{assert.ok(Number.isFinite(a)&&Math.abs(a-b)<t,`${label}: ${a} != ${b}`);assertions++;maxError=Math.max(maxError,Math.abs(a-b));},ok=(a,label)=>{assert.ok(a,label);assertions++;};
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),scale=(a,t)=>a.map(v=>v*t),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>Math.hypot(...a),unit=a=>scale(a,1/norm(a));
const frame=(a,b)=>{const x=unit([1,a,0]),y=unit([-a,1,-b]);return [x,y,cross(x,y)];},turn=(F,v)=>F.reduce((sum,q,i)=>add(sum,scale(q,v[i])),[0,0,0]),inverse=(F,v)=>F.map(q=>dot(q,v));
const ry=(v,a)=>[Math.cos(a)*v[0]+Math.sin(a)*v[2],v[1],-Math.sin(a)*v[0]+Math.cos(a)*v[2]];
function independentSurface(heights,width=4,depth=1.68){
 const xs=[-width/2,0,width/2],zs=[-depth/2,depth/2],points=zs.flatMap((z,j)=>xs.map((x,i)=>({x,z,h:heights[3*j+i]/1000})));
 const a=points.reduce((v,q)=>v+q.x*q.h,0)/points.reduce((v,q)=>v+q.x*q.x,0),b=points.reduce((v,q)=>v+q.z*q.h,0)/points.reduce((v,q)=>v+q.z*q.z,0),c=heights.reduce((s,h)=>s+h,0)/6000;
 return {a,b,c,at:(x,z)=>{
  const i=x>=0?1:0,u=(x-xs[i])/(xs[i+1]-xs[i]),v=(z-zs[0])/depth,H=[heights[i],heights[i+1],heights[i+3],heights[i+4]].map(q=>q/1000);
  return {h:dot(H,[(1-u)*(1-v),u*(1-v),(1-u)*v,u*v]),a:dot(H,[-(1-v),1-v,-v,v])/(width/2),b:dot(H,[-(1-u),-u,1-u,u])/depth};
 }};
}
function mount(raw,owner,state,S,profile,width=4,depth=1.68){
 const spatial=p=>[p[0]*width/4,p[1],p[2]*depth/1.68],seat0=spatial(owner==='tool'?[-1.75,.66,0]:[.08,.66,.15]),seat=[...seat0];
 if(owner==='work')seat[0]+=.7*state.Z/100*width/4;
 const s=S.at(seat[0],seat[2]),C=frame(S.a,S.b),F=frame(s.a-S.a,s.b-S.b),angle=owner==='tool'?(profile?.squareness?.XZ?.microns||0)/300000:0;
 const R=v=>turn(C,turn(F,ry(v,angle))),basis=[[1,0,0],[0,1,0],[0,0,1]].map(R),p=sub(spatial(raw),seat0);
 if(owner==='work')p[2]+=.35*state.X/100*depth/1.68;
 const origin=add(turn(C,[seat[0],s.h-S.a*seat[0]-S.b*seat[2]-S.c,seat[2]]),[0,.66+S.c,0]);
 return {point:add(origin,R(p)),R,basis};
}
function rootContact(body,probe,point,normal){
 const distance=e=>dot(sub(add(body,scale(probe,e)),point),normal);let lo=0,hi=.02;
 ok(distance(lo)*distance(hi)<=0,'plane root in plunger stroke');
 for(let i=0;i<65;i++){const mid=(lo+hi)/2;if(distance(lo)*distance(mid)<=0)hi=mid;else lo=mid;}return (lo+hi)/2;
}
function planeReading(first,last,n0,n1){const body=add(first,scale(n0,.01)),probe=scale(n0,-1);return (rootContact(body,probe,first,n0)-rootContact(body,probe,last,n1))*1e6;}
function cylinderContact(body,probe,origin,axis,radius=.025,length=Infinity){
 // First near-side intersection from an exterior indicator body. Binary
 // distance search is deliberately independent of the product quadratic.
 const outside=e=>norm(cross(sub(add(body,scale(probe,e)),origin),axis))-radius;
 let lo=0,hi=.02;
 if(outside(lo)<0||outside(hi)>0)return null;
 for(let i=0;i<65;i++){const mid=(lo+hi)/2;if(outside(mid)>0)lo=mid;else hi=mid;}
 const extension=(lo+hi)/2,point=add(body,scale(probe,extension)),axial=dot(sub(point,origin),axis);
 if(axial<0||axial>length)return null;
 return {extension,point,axial};
}
// Viewed from spindle (-internal x) towards turret (+internal x), +internal z
// is screen LEFT. The axis names and screen directions are deliberately split.
function boreReadings(dx,dy){
 const centre=[dx,dy],R=.025;
 if(Math.hypot(dx,dy)>=R)return null;
 const extensions=[[1,0],[0,1],[-1,0],[0,-1]].map(ray=>{
  const outside=e=>Math.hypot(ray[0]*e-centre[0],ray[1]*e-centre[1])-R;let lo=0,hi=.05;
  for(let i=0;i<65;i++){const mid=(lo+hi)/2;if(outside(mid)>0)hi=mid;else lo=mid;}return (lo+hi)/2;
 });return extensions.map(e=>(extensions[0]-e)*1e6);
}
function oracle(heights,state,profile,width=4,depth=1.68){
 const S=independentSurface(heights,width,depth),at=(p,owner,s=state)=>mount(p,owner,s,S,profile,width,depth);
 // Intrinsic amplitudes are supplied fixed input data. Only geometry and the
 // resulting signs are independently derived; this does not validate RNG stats.
 const fixed=API.intrinsic(profile),X0={...state,X:Math.min(state.X,100-.3/(.35*depth/1.68)*100)},Z0={...state,Z:Math.min(state.Z,100-.3/(.7*width/4)*100)},X1={...X0,X:X0.X+.3/(.35*depth/1.68)*100},Z1={...Z0,Z:Z0.Z+.3/(.7*width/4)*100};
 const face0=at([-.09,1.5,1],'work',X0),face1=at([-.09,1.5,1],'work',X1),N=[-Math.cos(fixed.face),0,-Math.sin(fixed.face)],flat0=at([.23,1.5,1.43],'work',Z0),flat1=at([.23,1.5,1.43],'work',Z1),M=[Math.sin(fixed.flat),0,Math.cos(fixed.flat)];
 const head=at([-1.075,1.5,0],'tool'),axis=head.R([1,0,0]),radial=head.R([0,0,1]),up=head.R([0,1,0]),holeMount=at([-.09,1.5,.20],'work',{...state,X:-.20/.35*100}),hole=add(holeMount.point,holeMount.R([0,fixed.holeY,fixed.holeX])),delta=sub(hole,head.point),dx=dot(delta,radial),dy=dot(delta,up);
 const bracket0=at([.08,1.5,.20],'work',Z0),bracket1=at([.08,1.5,.20],'work',Z1),centreA=add(head.point,scale(axis,dot(sub(bracket0.point,head.point),axis)));
 const barRead=normal=>{
  const firstBody=add(centreA,scale(normal,.035)),probe=scale(normal,-1),offset=inverse(bracket0.basis,sub(firstBody,bracket0.point)),localProbe=inverse(bracket0.basis,probe),lastBody=add(bracket1.point,turn(bracket1.basis,offset)),lastProbe=turn(bracket1.basis,localProbe);
  const first=cylinderContact(firstBody,probe,head.point,axis,.025,2.2*width/4),last=cylinderContact(lastBody,lastProbe,head.point,axis,.025,2.2*width/4);
  ok(first&&last,'fixed bar contacts within finite length');
  // Reinstall at b with a new radial probe instead of preserving the bracket.
  // This is a different arrangement from merely reversing and re-zeroing.
  const resetBody=add(head.point,add(scale(axis,dot(sub(bracket1.point,head.point),axis)),scale(normal,.035))),resetProbe=scale(normal,-1),resetOffset=inverse(bracket1.basis,sub(resetBody,bracket1.point)),resetLocalProbe=inverse(bracket1.basis,resetProbe),returnBody=add(bracket0.point,turn(bracket0.basis,resetOffset)),returnProbe=turn(bracket0.basis,resetLocalProbe),resetFirst=cylinderContact(resetBody,resetProbe,head.point,axis,.025,2.2*width/4),resetLast=cylinderContact(returnBody,returnProbe,head.point,axis,.025,2.2*width/4);
  ok(resetFirst&&resetLast,'remounted reverse contacts valid');
  return {microns:(first.extension-last.extension)*1e6,remountedReverse:(resetFirst.extension-resetLast.extension)*1e6,first,last,firstBody,lastBody,probe,lastProbe};
 };
 return {face:planeReading(face0.point,face1.point,face0.R(N),face1.R(N)),flat:planeReading(flat0.point,flat1.point,flat0.R(M),flat1.R(M)),dx:dx*1e6,dy:dy*1e6,bore:boreReadings(dx,dy),barSide:barRead(radial),barTop:barRead(up),X0,Z0};
}
// Contact signs and fixed-configuration reversal are physical constraints.
for(const sign of [-1,1]){
 near(API.planeScan([0,0,0],[sign*10e-6,.3,0],[1,0,0],[1,0,0]),sign*10,'moving plane approaches fixed body');
}
let cylinderCases=0;
for(const normal of [[0,0,1],[0,0,-1],[0,1,0],[0,-1,0]])for(const sign of [-1,1]){
 const origin=[0,0,0],axis=[1,0,0],body=add([.2,0,0],scale(normal,.035)),probe=scale(normal,-1),last=add(add(body,[.3,0,0]),scale(normal,-sign*10e-6));
 const a=API.cylinderContact(body,probe,origin,axis,.025,1),b=API.cylinderContact(last,probe,origin,axis,.025,1),goal=cylinderContact(last,probe,origin,axis,.025,1);
 ok(a.valid&&b.valid&&goal,'side/opposite/top/bottom contact valid');
 near((a.extension-b.extension)*1e6,sign*10,'body approaches fixed bar: compression positive');
 near(b.extension,goal.extension,'independent known radial displacement',1e-12);
 near((b.extension-a.extension)*1e6,-sign*10,'reverse fixed configuration zero at last');
 // An arbitrary common pose changes neither length nor indication.
 const C=frame(.3,-.2),translate=[3,-2,5],point=v=>add(turn(C,v),translate),vector=v=>turn(C,v),rotated=API.cylinderContact(point(last),vector(probe),point(origin),vector(axis),.025,1);
 ok(rotated.valid,'common rigid transform retains contact');near(rotated.extension,b.extension,'common rigid transform contact',1e-12);
 cylinderCases++;
}
// A known oblique fixed probe travels axially as it extends. This checks the
// cylindrical ray and the finite length at the actual contact, not at the body.
{
 const theta=.3,probe=[Math.sin(theta),0,-Math.cos(theta)],body=[.9,0,.035],hit=API.cylinderContact(body,probe,[0,0,0],[1,0,0],.025,1);
 near(hit.extension,.01/Math.cos(theta),'oblique probe extension',1e-12);near(hit.axial,.9+.01*Math.tan(theta),'oblique contact axial station',1e-12);
 ok(!API.cylinderContact(body,probe,[0,0,0],[1,0,0],.025,.901).valid,'contact beyond finite tip invalid even with body over bar');cylinderCases++;
}
for(const [body,probe,length,label] of [
 [[-.01,0,.035],[0,0,-1],1,'before spindle nose'],[[1.01,0,.035],[0,0,-1],1,'after bar tip'],
 [[.5,0,.046],[0,0,-1],1,'more than 20 mm extension'],[[.5,0,.02],[0,0,-1],1,'body inside bar'],
 [[.5,0,.035],[0,0,1],1,'probe points away'],[[.5,0,.035],[1,0,0],1,'parallel probe'],
 [[.5,0,.035],[0,1,0],1,'ray misses cylinder']]){ok(!API.cylinderContact(body,probe,[0,0,0],[1,0,0],.025,length).valid,label);cylinderCases++;}
const profile=env.json("window.MachineAccuracy.generate('used',123456,['X','Z'],6)"),profileSnapshot=JSON.stringify(profile),runoutSnapshot=JSON.stringify(Intrinsic.fromProfile(profile).runout);
const supportCases=[{name:'ideal',h:()=>0},{name:'rigid',h:(x,z)=>.04*x-.05*z+.03},{name:'saddle+',h:(x,z)=>.05*x*z},{name:'saddle-',h:(x,z)=>-.05*x*z},{name:'saddle+plane',h:(x,z)=>.05*x*z+.04*x-.05*z+.03},...Array.from({length:6},(_,i)=>[-1,1].map(sign=>({name:`support${i}/${sign}`,h:(x,z,j)=>j===i?sign*.08:0}))).flat()];
const rows=[];let remountDifference=0;
for(const [width,depth] of [[4,1.68],[5.2,1.2]])for(const c of supportCases)for(const used of [false,true]){
 const heights=[-depth/2,depth/2].flatMap((z,j)=>[-width/2,0,width/2].map((x,i)=>c.h(x,z,j*3+i))),p=used?profile:null;
 env.read(`levelConfig.width=${width};levelConfig.depth=${depth};machineProfile=${JSON.stringify(p)};supportHeights=${JSON.stringify(heights)};`);
 for(const X of [-100,0,100])for(const Z of [-100,-.08/.7*100-1e-5,-.08/.7*100+1e-5,0,100]){
  const state={X,Y:0,Z,A:0,C:0};env.read(`positions=${JSON.stringify(state)};updateLeveling();`);
  const actual=env.json('latheInspectionGeometry()'),expected=oracle(heights,state,p,width,depth);
  near(actual.xStart.Z,state.Z,'X scan retains requested Z position',1e-12);
  near(actual.zStart.X,state.X,'Z scan retains requested X position',1e-12);
  for(const key of ['face','flat','dx','dy'])near(actual[key],expected[key],`${c.name} ${used} ${width}/${depth} X${X}Z${Z} ${key}`);
  for(const [field,scan] of [['barSide','side'],['barTop','top']]){
   ok(actual[scan].valid,'ordinary bar interval has valid contact');
   remountDifference=Math.max(remountDifference,Math.abs(expected[field].remountedReverse+expected[field].microns));
   near(actual[field],expected[field].microns,`${c.name} ${used} ${width}/${depth} X${X}Z${Z} ${field}`);
   const samples=actual[scan].samples,first=samples[0],last=samples.at(-1),goal=expected[field];
   for(const [got,want,label] of [[first.body,goal.firstBody,'initial body'],[last.body,goal.lastBody,'final body'],[first.probe,goal.probe,'initial probe'],[last.probe,goal.lastProbe,'final probe']])got.forEach((v,i)=>near(v,want[i],`${field} ${label} ${i}`,1e-12));
   const S=independentSurface(heights,width,depth),head=mount([-1.075,1.5,0],'tool',state,S,p,width,depth),axis=head.R([1,0,0]);
   const initial=mount([.08,1.5,.20],'work',expected.Z0,S,p,width,depth),localBody=inverse(initial.basis,sub(goal.firstBody,initial.point)),localProbe=inverse(initial.basis,goal.probe);
   for(const sample of samples){
    const sampleState={...expected.Z0,Z:expected.Z0.Z+.3/(.7*width/4)*100*sample.t},placed=mount([.08,1.5,.20],'work',sampleState,S,p,width,depth),wantedBody=add(placed.point,turn(placed.basis,localBody)),wantedProbe=turn(placed.basis,localProbe);
    sample.body.forEach((v,i)=>near(v,wantedBody[i],`${field} intermediate body ${i}`,1e-12));sample.probe.forEach((v,i)=>near(v,wantedProbe[i],`${field} intermediate probe ${i}`,1e-12));
    const hit=cylinderContact(wantedBody,wantedProbe,head.point,axis,.025,2.2*width/4);ok(hit,'sample has independent cylinder contact');near(sample.extension,hit.extension,`${field} sample contact`,1e-12);near(sample.axial,hit.axial,`${field} sample axial`,1e-12);
   }
   // With the actual bracket held, exchanging the two ends and zeroing at b
   // must reverse the indicator change; this does not remount at b.
   near((goal.last.extension-goal.first.extension)*1e6,-actual[field],`${field} fixed-configuration reverse`);
  }
  ok(actual.bore.valid===!!expected.bore,'bore contact validity');
  if(expected.bore){expected.bore.forEach((n,i)=>near(actual.bore.readings[i],n,`${c.name} X${X}Z${Z} bore ${i}`));near((actual.bore.readings[2]-actual.bore.readings[0])/2,actual.dx,'c-a follows positive member X');near((actual.bore.readings[3]-actual.bore.readings[1])/2,actual.dy,'d-b follows positive height');}
  near(actual.face,-.3*Math.sin(API.intrinsic(p).face)*1e6,'X face intrinsic/common-pose invariance');
  if(!used&&(c.name==='ideal'||c.name==='rigid'))for(const key of ['face','flat','dx','dy','barSide','barTop'])near(actual[key],0,`ideal/common rigid ${key}`);
  if(width===4&&X===0&&Z===0&&['ideal','saddle+','saddle-'].includes(c.name))rows.push({name:c.name,used,face:actual.face,flat:actual.flat,dx:actual.dx,dy:actual.dy,barSide:actual.barSide,barTop:actual.barTop});
  cases++;
 }
}
// The whole deformed arrangement receives one common transform when a rigid
// plane is added. It must not create a measurement difference.
for(const X of [-100,100])for(const Z of [-100,100]){
 const state={X,Y:0,Z,A:0,C:0},h=[-.84,.84].flatMap(z=>[-2,0,2].map(x=>.05*x*z)),tilted=[-.84,.84].flatMap(z=>[-2,0,2].map(x=>.05*x*z+.03*x+.04*z+.02));
 const a=oracle(h,state,profile),b=oracle(tilted,state,profile);
 for(const key of ['face','flat','dx','dy'])near(a[key],b[key],`rigid tilt of deformed arrangement ${key}`);
 for(const key of ['barSide','barTop'])near(a[key].microns,b[key].microns,`rigid tilt of deformed arrangement ${key}`);
}
ok(remountDifference>1e-6,'remounting direction at b is not generally fixed-bracket reversal');
assert.equal(JSON.stringify(profile),profileSnapshot,'profile unmodified');assertions++;
assert.equal(JSON.stringify(Intrinsic.fromProfile(profile).runout),runoutSnapshot,'spindle TIR retains individual');assertions++;
// User-configurable support dimensions also scale travel. Never fabricate an
// off-slider 300 mm interval when the complete motion range is shorter.
let shortTravelCases=0;
for(const [width,depth] of [[.5,1.68],[4,.5],[.5,.5],[6/7,.72],[6/7-1e-7,.72-1e-7]])for(const X of [-100,100])for(const Z of [-100,100]){
 env.read(`levelConfig.width=${width};levelConfig.depth=${depth};supportHeights=supports.map(()=>0);machineProfile=null;positions={X:${X},Y:0,Z:${Z},A:0,C:0};updateLeveling();`);
 const a=env.json('latheInspectionGeometry()'),validX=.7*depth/1.68>=.3-1e-12,validZ=1.4*width/4>=.3-1e-12;
 assert.equal(a.validX,validX);assertions++;assert.equal(a.validZ,validZ);assertions++;
 for(const pair of [['xStart','X'],['xEnd','X'],['zStart','Z'],['zEnd','Z']])ok(a[pair[0]][pair[1]]>=-100&&a[pair[0]][pair[1]]<=100,'scan endpoint within actual slider');
 if(!validX){assert.equal(a.face,null,'insufficient X travel is unavailable');assertions++;}
 if(!validZ)for(const key of ['flat','barSide','barTop']){assert.equal(a[key],null,'insufficient Z travel is unavailable');assertions++;}
 if(validX)near(a.face,0,'ideal face at exact minimum travel');
 if(validZ)for(const key of ['flat','barSide','barTop'])near(a[key],0,'ideal Z read at exact minimum travel');
 const markup=env.read('latheInspectionMarkup(latheInspectionGeometry(),{rootMicrons:0,tipMicrons:0})');
 if(!validX)ok(markup.includes('X —'),'invalid X is a dash, not a fabricated zero');
 if(!validZ)ok(markup.includes('Z —'),'invalid Z is a dash, not a fabricated zero');
 shortTravelCases++;
}
// Recovered mesh points are checked against the declared physical bar. The
// nominal cylinder radius stays 25 mm when support layout dimensions scale.
let meshCases=0;
for(const [width,depth] of [[4,.5],[4,1.2],[4,1.68],[5.2,3.2]])for(const sign of [-1,0,1])for(const gain of [false,true])for(const end of [-100,100]){
 const heights=[-depth/2,depth/2].flatMap(z=>[-width/2,0,width/2].map(x=>sign*.05*x*z));
 env.read(`levelConfig.width=${width};levelConfig.depth=${depth};supportHeights=${JSON.stringify(heights)};machineProfile=${JSON.stringify(profile)};positions={X:${end},Y:0,Z:${end},A:0,C:0};$('exaggerate').checked=${gain};updateLeveling();`);
 const mesh=env.json(`(()=>{const model=createGeometry(current),caps=model.faces.filter(f=>f.pose==='latheTestBar'&&f.v.length===20),tail=model.faces.filter(f=>f.pose==='latheTailstockVisual'),context=idealDisplayContext(current);return {factor:displayFactor(),clearance:displayClearance(),lift:context.lift,labels:model.labels.map(l=>({name:l.name,pose:l.pose,axes:l.axes})),edges:idealOutlineEdges(model).filter(e=>e.pose==='latheTestBar').length,tail:tail.map(f=>({axes:f.axes,actual:f.v.map(p=>displayedModelPoint(p,f.axes,current,positions,f.pose)),other:f.v.map(p=>displayedModelPoint(p,f.axes,current,{...positions,X:-positions.X,Z:-positions.Z},f.pose))})),caps:caps.map(f=>({raw:f.v,actual:f.v.map(p=>displayedModelPoint(p,f.axes,current,positions,f.pose)),ideal:f.v.map(p=>idealDisplayPoint(p,f.axes,f.pose,context))}))};})()`);
 ok(mesh.caps.length===2,'finite bar has two mesh ends');ok(mesh.edges>0,'bar included in ideal outline');
 // The later user decision restored a visual-only tailstock. Its geometry
 // stays fixed under X/Z and cannot contribute to an inspection result.
 const tailstock=mesh.labels.find(l=>l.name.includes('心押'));ok(tailstock&&tailstock.pose==='latheTailstockVisual'&&tailstock.axes.length===0,'tailstock remains visual-only');ok(mesh.tail.length>0,'tailstock mesh present');
 for(const part of mesh.tail){assert.deepEqual(part.axes,[],'tailstock has no moving axes');assertions++;part.actual.forEach((p,i)=>p.forEach((v,k)=>near(v,part.other[i][k],'tailstock fixed under X/Z',1e-12)));}
 if(meshCases===0){
  const dependency=env.json(`(()=>{const saved=createGeometry,before=latheInspectionGeometry();try{createGeometry=m=>{const g=saved(m);return {...g,faces:g.faces.filter(f=>f.pose!=='latheTailstockVisual'),labels:g.labels.filter(l=>l.pose!=='latheTailstockVisual')};};createGeometry(current);return {before,without:latheInspectionGeometry()};}finally{createGeometry=saved;}})()`);
  assert.deepEqual(dependency.without,dependency.before,'removing decorative tailstock cannot alter any precision calculation');assertions++;
 }
 const barLabel=mesh.labels.find(l=>l.name==='テストバー');ok(barLabel&&barLabel.axes.length===0,'bar is fixed to spindle');
 const turret=mesh.labels.find(l=>l.name==='タレット');ok(turret.axes.join('/')==='X/Z','turret follows X and Z');
 const scaledProfile=JSON.parse(JSON.stringify(profile));scaledProfile.squareness.XZ.microns*=mesh.factor;
 const S=independentSurface(heights.map(h=>h*mesh.factor),width,depth),state={X:end,Y:0,Z:end,A:0,C:0},head=mount([-1.075,1.5,0],'tool',state,S,scaledProfile,width,depth),axis=head.R([1,0,0]);
 for(const cap of mesh.caps)for(let j=0;j<cap.raw.length;j++){
  const raw=cap.raw[j],expected=mount([raw[0],raw[1],raw[2]*1.68/depth],'tool',state,S,scaledProfile,width,depth).point;
  expected[1]+=mesh.clearance;cap.actual[j].forEach((v,k)=>near(v,expected[k],'bar point independent mounted pose',1e-11));
  const delta=sub(cap.actual[j],add(head.point,[0,mesh.clearance,0]));near(norm(cross(delta,axis)),.025,'bar circular radius all support dimensions/gain',1e-11);
  [raw[0]*width/4,raw[1]+mesh.lift,raw[2]].forEach((v,k)=>near(cap.ideal[j][k],v,'ideal bar radius/axis independently scaled',1e-12));
 }
 meshCases++;
}
console.log(JSON.stringify({passed:true,assertions,cases,shortTravelCases,cylinderCases,meshCases,maxError,remountDifference,rows,scope:'Independent nodal support surface, common/local rigid mounts, plane-distance bisection, view-correct hole circle bisection, fixed-bracket finite-cylinder distance bisection; no physical elasticity or tilted-bore contact claim.'},null,2));

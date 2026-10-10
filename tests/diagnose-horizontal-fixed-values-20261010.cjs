'use strict';
// Fixed-value investigation. Support input, raw contact, browser DOM and
// integer display are kept separate; no product source is changed.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const directory='docs/qa-horizontal-fixture-20261010',browser=JSON.parse(fs.readFileSync(directory+'/browser/after/results.json'));
const plus=(a,b)=>a.map((v,i)=>v+b[i]),minus=(a,b)=>a.map((v,i)=>v-b[i]),scale=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),unit=a=>scale(a,1/Math.hypot(...a)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const frame=(gx,gz)=>{const up=unit([-gx,1,-gz]),right=unit([1,gx,0]),back=cross(right,up);return {right,up,back,rotate:v=>plus(plus(scale(right,v[0]),scale(up,v[1])),scale(back,v[2]))};};
const compose=(a,b)=>({right:a.rotate(b.right),up:a.rotate(b.up),back:a.rotate(b.back),rotate:v=>a.rotate(b.rotate(v))});
const failures=[],checks=[];function close(label,actual,expected,tol=2e-9){const error=Array.isArray(actual)?Math.hypot(...minus(actual,expected)):Math.abs(actual-expected);checks.push({label,error,tol});if(!Number.isFinite(error)||error>tol)failures.push({label,actual,expected,error,tol});}
// Independent rectangular-node interpolation and least-squares plane; neither
// Leveling.solve nor the product's slope/frame/contact helpers are used here.
function supportModel(nodes){
 const xs=[...new Set(nodes.map(n=>n.x))].sort((a,b)=>a-b),zs=[...new Set(nodes.map(n=>n.z))].sort((a,b)=>a-b),height=(x,z)=>nodes.find(n=>n.x===x&&n.z===z).height/1000;
 const a=nodes.reduce((s,n)=>s+n.x*n.height/1000,0)/nodes.reduce((s,n)=>s+n.x*n.x,0),b=nodes.reduce((s,n)=>s+n.z*n.height/1000,0)/nodes.reduce((s,n)=>s+n.z*n.z,0),c=nodes.reduce((s,n)=>s+n.height/1000,0)/nodes.length,common=frame(a,b);
 function surface(x,z){let j=0;while(j<zs.length-2&&z>=zs[j+1])j++;const x0=xs[0],x1=xs[1],z0=zs[j],z1=zs[j+1],u=(x-x0)/(x1-x0),v=(z-z0)/(z1-z0),h00=height(x0,z0),h10=height(x1,z0),h01=height(x0,z1),h11=height(x1,z1);return {height:(1-v)*((1-u)*h00+u*h10)+v*((1-u)*h01+u*h11),gx:((1-v)*(h10-h00)+v*(h11-h01))/(x1-x0),gz:((1-u)*(h01-h00)+u*(h11-h10))/(z1-z0),cell:[x0,x1,z0,z1]};}
 function at(x,z){const s=surface(x,z);return compose(common,frame(s.gx-a,s.gz-b));}
 return {a,b,c,surface,at};
}
function rayPlane(pose){const f=e=>dot(pose.normal,minus(plus(pose.body,scale(pose.probe,e)),pose.point));let lo=0,hi=.02,fl=f(lo);assert.ok(fl*f(hi)<=0);for(let k=0;k<60;k++){const mid=(lo+hi)/2;if(fl*f(mid)<=0)hi=mid;else{lo=mid;fl=f(mid);}}return (lo+hi)/2;}
function rayCylinder(pose,bar){const f=e=>{const d=minus(plus(pose.body,scale(pose.probe,e)),bar.origin),radial=minus(d,scale(bar.axis,dot(d,bar.axis)));return dot(radial,radial)-.025*.025;};let lo=0,hi=.02,fl=f(lo);assert.ok(fl*f(hi)<=0);for(let k=0;k<60;k++){const mid=(lo+hi)/2;if(fl*f(mid)<=0)hi=mid;else{lo=mid;fl=f(mid);}}return (lo+hi)/2;}
const integer=v=>{const q=Math.floor(Math.abs(v)+.5);return q===0?'0':(v<0?'-':'+')+q;};
const rows=[];
for(const profile of ['ideal','used'])for(const action of ['flat','B-raise','B-lower','E-raise']){
 const name=profile+'-central-'+action,r=browser.states.find(r=>r.name===name);assert.ok(r,name);const m=supportModel(r.supports),xy=r.references.find(x=>x.key==='XY').measurement,headZ=1.334,headSlope=m.surface(0,headZ),tool=m.at(0,headZ),table=m.at(0,-.85),intrinsicAngle=(r.profile?.squareness.XY.microns||0)/300000;
 const row={name,method:r.method,raw:r.raw,dom:r.references.map(q=>({key:q.key,raw:q.dom.raw,reading:q.dom.reading})),parallelDom:r.dom.parallel,headCell:headSlope.cell,headLocalSlopes:{gx:headSlope.gx,gz:headSlope.gz},globalPlane:{a:m.a,b:m.b,c:m.c}};
 // For B, all four nodes of the rear head cell are zero. Every X-interval
 // anchor has the same rigid frame; X chord is its right direction. The Y
 // feed is that same frame applied to the individual's fixed XY angle.
 if(action!=='E-raise'){
  const nS=tool.right,nR=unit(minus(table.up,scale(nS,dot(nS,table.up)))),headY=tool.rotate([-Math.sin(intrinsicAngle),Math.cos(intrinsicAngle),0]),projection=dot(nS,headY),expected=-.3*projection*1e6;
  close(name+' rear local slope x',headSlope.gx,0,1e-18);close(name+' rear local slope z',headSlope.gz,0,1e-18);
  for(const x of [0,.15,.3])close(name+' rear X chord uses one rigid frame '+x,m.at(x,headZ).up,tool.up,1e-15);
  close(name+' independent S normal',xy.master.Snormal,nS,2e-12);close(name+' independent R normal',xy.master.Rnormal,nR,2e-12);
  close(name+' independent Y material displacement',minus(xy.end.body,xy.start.body),scale(headY,.3),2e-12);
  close(name+' independent XY reading',xy.microns,expected,2e-8);
  row.independentXY={nS,nR,headY,headDisplacement:scale(headY,.3),normalProjection:projection,expectedUm:expected,profileXY:r.profile?.squareness.XY.microns||0,scope:'Support nodes -> constant rear head frame -> R square direction -> Y material translation -> plunger extension.'};
 }
 for(const ref of r.references){const expected=(rayPlane(ref.measurement.start)-rayPlane(ref.measurement.end))*1e6;close(name+' '+ref.key+' independent contact',ref.measurement.microns,expected,2e-8);close(name+' '+ref.key+' DOM raw updates',ref.dom.raw,expected,2e-8);assert.equal(ref.dom.reading,integer(expected));row[ref.key+'ContactExpected']=expected;}
 rows.push(row);
}
const env=require('./leveling-dom-env.cjs')({pureLeveling:true});env.read(fs.readFileSync('src/intrinsic-inspection.js','utf8'));env.read("openMachine(machines.find(m=>m.kind==='horizontal'));$('exaggerate').checked=false;positions={X:0,Y:0,Z:0,A:0,C:0};");
const commonTilt=[];
for(const used of [false,true]){
 env.read(`machineProfile=${used?"window.MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length)":'null'};`);
 let baseline;
 for(const shape of ['flat','common-plane','B-only']){
  env.read(`supportHeights=supports.map((p,i)=>{const q=levelCoordinates(p.x,p.z);return ${shape==='flat'?'0':shape==='common-plane'?'.08*q.x-.05*q.z+.03':'i===1?.01:0'};});updateLeveling(false);`);
  const r=env.json("(()=>{const p=horizontalParallelism(),i=window.IntrinsicInspection.fromProfile(machineProfile);return {supports:supportHeights,raw:{a:p.a.microns,b:p.b.microns},zero:{a:p.a.zero.extension,b:p.b.zero.extension},display:{a:$('sweepValue0').textContent,b:$('sweepValue1').textContent},bar:p.bar,poses:{a:p.a.samples.map(s=>({body:s.body,probe:s.probe})),b:p.b.samples.map(s=>({body:s.body,probe:s.probe}))},runout:i?.runout||null};})()");
  if(shape==='flat')baseline=r;
  if(shape==='common-plane'){
   const rotation=frame(.00008,-.00005),point=p=>plus(rotation.rotate(minus(p,[0,.66,0])),[0,.66003,0]);
   close('common plane bar origin',r.bar.origin,point(baseline.bar.origin),1e-12);close('common plane bar axis',r.bar.axis,rotation.rotate(baseline.bar.axis),1e-12);
   for(const key of ['a','b']){close('common rigid plane used'+used+' '+key,r.raw[key],baseline.raw[key],2e-8);for(let i=0;i<r.poses[key].length;i++){close('common plane body '+key+'/'+i,r.poses[key][i].body,point(baseline.poses[key][i].body),1e-12);close('common plane probe '+key+'/'+i,r.poses[key][i].probe,rotation.rotate(baseline.poses[key][i].probe),1e-12);}}
  }
  r.independentCylinder={};for(const key of ['a','b']){const poses=r.poses[key],expected=(rayCylinder(poses[0],r.bar)-rayCylinder(poses.at(-1),r.bar))*1e6;r.independentCylinder[key]=expected;close('independent finite cylinder '+used+'/'+shape+'/'+key,r.raw[key],expected,2e-8);}
  if(used){assert.deepEqual(r.runout,baseline.runout);const e=r.runout.eccentricityMicrons,t=r.runout.tiltMicroradians;for(const [key,L]of [['rootMicrons',0],['tipMicrons',.3]]){const centre=plus(e,scale(t,L)),phase=Math.atan2(centre[1],centre[0]),reading=a=>centre[0]*Math.cos(a)+centre[1]*Math.sin(a),tir=reading(phase)-reading(phase+Math.PI);close('independent rotational max-min '+shape+' '+key,r.runout[key],tir,1e-12);}}
  commonTilt.push({used,shape,...r});
 }
}
const result={htmlSha256:crypto.createHash('sha256').update(fs.readFileSync('index.html')).digest('hex'),referenceSha256:crypto.createHash('sha256').update(fs.readFileSync('src/reference-measurement-ui.js')).digest('hex'),browserSourceSha256:browser.sha256,checks:checks.length,failures,rows,commonTilt,scope:'B central XY has a full independent support-to-reading calculation. XZ endpoint contact is independent with browser poses as observations; general asymmetric support-to-pose verification remains separate.'};
fs.writeFileSync(directory+'/fixed-values.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({checks:checks.length,failures,xy:rows.map(r=>({name:r.name,raw:r.raw.XY,expected:r.independentXY?.expectedUm})),commonTilt:commonTilt.map(r=>({used:r.used,shape:r.shape,raw:r.raw,display:r.display,runout:r.runout&&{root:r.runout.rootMicrons,tip:r.runout.tipMicrons}}))},null,2));if(failures.length)process.exitCode=1;

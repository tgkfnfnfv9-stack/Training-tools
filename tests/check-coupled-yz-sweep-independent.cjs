'use strict';
// Independent contact oracle for the compact shared teaching pose. Expected
// readings come from plane/ray intersections, never from rendered signs or
// multiplier tables. Physical Ritz-shape correctness has its separate oracle.
const assert=require('node:assert/strict');
const e=require('./leveling-dom-env.cjs')({pureLeveling:true});
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),unit=a=>mul(a,1/Math.hypot(...a));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
let checks=0,cases=0,maxContactError=0,maxXZCrossChange=0;
const close=(a,b,label,tol=2e-7)=>{assert.ok(Math.abs(a-b)<=tol,`${label}: ${a} vs ${b}`);checks++;};
const vector=(a,b,label,tol=1e-12)=>{assert.ok(Math.hypot(...sub(a,b))<tol,label);checks++;};
const ray=pose=>dot(pose.normal,sub(pose.point,pose.body))/dot(pose.normal,pose.probe);
const get=()=>e.json(`(()=>{const g=compactMeasurementGeometry(positions,levelSolution,machineProfile,.3),s=spindleSweepGeometry(positions,levelSolution,machineProfile,1,true);return {g:{directions:g.directions},s,m:referenceDisplayScan({key:'YZ'}),xz:referenceDisplayScan({key:'XZ'}),rawXZ:referenceScan({key:'XZ'}),rawXY:referenceScan({key:'XY'}),xy:referenceDisplayScan({key:'XY'})};})()`);
e.read('openMachine(machines[0]);');
for(const [width,depth] of [[2.08,2.16],[.5,.5],[20,.5],[.5,20]])for(const heights of [[0,0,0,0],[.1,0,0,0],[-.1,0,0,0],[.5,-.5,-.5,.5],[-.5,.5,.5,-.5]])for(const intrinsic of [false,true]){
 e.read(`levelConfig.width=${width};levelConfig.depth=${depth};levelConfig.columnX=0;levelConfig.columnZ=0;supportHeights=${JSON.stringify(heights)};machineProfile=${intrinsic?'{guides:{},initialHeights:[0,0,0,0],squareness:{XY:{microns:33},XZ:{microns:75},YZ:{microns:-15}}}':'null'};`);
 let fixedAxis;
 for(const pos of [{X:0,Y:0,Z:0,A:0,C:0},{X:-100,Y:-100,Z:-100,A:0,C:0},{X:100,Y:100,Z:100,A:0,C:0}]){
  e.read(`positions=${JSON.stringify(pos)};updateLeveling();`);const q=get();
  const z=q.g.directions.find(v=>v.key==='Z').direction,n=q.g.directions.find(v=>v.key==='Y').direction;
  assert.ok(q.s.valid,'valid shared spindle geometry');checks++;
  vector(q.s.measurement.axis,z,'reference feed and spindle share one taught axis');
  const noseEnds=e.json('[-.1,.1].map(delta=>spindleSweepGeometry({...positions,Z:positions.Z+delta},levelSolution,machineProfile,1,true).nose)');
  vector(unit(sub(noseEnds[1],noseEnds[0])),z,'virtual head material point follows same taught Z direction',1e-9);
  if(fixedAxis)vector(z,fixedAxis,'table/head travel cannot rotate fixed virtual spindle');else fixedAxis=z;
  if(q.m.valid){
   const expected=300000*dot(n,z),byContact=(ray(q.m.start)-ray(q.m.end))*1e6;
   close(q.m.microns,expected,'YZ finite fixed plane geometry',1e-6);close(q.m.microns,byContact,'YZ independent probe ray');
   const shift=[1.23,-.34,2.17],shifted=p=>({...p,point:add(p.point,shift),body:add(p.body,shift)});
   close((ray(shifted(q.m.start))-ray(shifted(q.m.end)))*1e6,q.m.microns,'shared rigid translation');
   const turn=v=>[v[1],v[2],v[0]],turned=p=>({point:turn(p.point),normal:turn(p.normal),body:turn(p.body),probe:turn(p.probe)});
   close((ray(turned(q.m.start))-ray(turned(q.m.end)))*1e6,q.m.microns,'shared rigid rotation');
   const reverse=(ray(q.m.end)-ray(q.m.start))*1e6;close(reverse,-q.m.microns,'new zero at old end');
   const mirror=p=>({...p,normal:mul(p.normal,-1),probe:mul(p.probe,-1),body:add(p.body,mul(p.normal,-.02))});
   close((ray(mirror(q.m.start))-ray(mirror(q.m.end)))*1e6,-q.m.microns,'opposite contact side');
  }
  const s=q.s,a=unit(s.measurement.axis),table=unit(s.tableNormal),right=s.measurement.e0,back=unit(cross(right,a)),radius=.15;
  const ring=[right,back,mul(right,-1),mul(back,-1)].map(v=>mul(v,radius));
  const lambda=ring.map(p=>-dot(table,p)/dot(table,a));
  for(let i=0;i<4;i++){
   const expected=(lambda[i]-lambda[3])*1e6,actual=s.cardinal[i].readingMicrons;
   maxContactError=Math.max(maxContactError,Math.abs(expected-actual));close(actual,expected,'four-point plane intersection');
   close(dot(table,sub(s.cardinal[i].contact,s.tableCentre)),0,'actual contact lies on table',1e-12);
  }
  close(s.cardinal[3].readingMicrons,0,'front zero',0);
  close(s.cardinal[0].readingMicrons+s.cardinal[2].readingMicrons,s.cardinal[1].readingMicrons,'opposite pair identity');
  if(!s.cardinal[3].onTable)for(let i=0;i<4;i++){assert.equal(e.registry['sweepValue'+i].dataset.readingMicrons,'','front off table suppresses every value');checks++;}
  if(q.xz.valid&&q.rawXZ.valid)maxXZCrossChange=Math.max(maxXZCrossChange,Math.abs(q.xz.microns-q.rawXZ.microns));
  assert.equal(q.xy.valid,q.rawXY.valid,'XY validity unchanged');checks++;if(q.xy.valid)close(q.xy.microns,q.rawXY.microns,'XY reading unchanged');
  cases++;
 }
}
// Reproduce actual button steps, roundtrip, zero-support intrinsic preservation,
// and immunity to camera/diagram gain. Neither test changes support step sizes.
e.read('levelConfig.width=2.08;levelConfig.depth=2.16;positions={X:0,Y:0,Z:0,A:0,C:0};machineProfile={guides:{},initialHeights:[0,0,0,0],squareness:{XY:{microns:33},XZ:{microns:75},YZ:{microns:-15}}};supportHeights=[0,0,0,0];updateLeveling();');
const flat=get();close(flat.m.microns,e.read("referenceScan({key:'YZ'}).microns"),'intrinsic baseline unchanged');
e.registry.raiseSupport.click();const raised=get();e.registry.lowerSupport.click();const returned=get();close(returned.m.microns,flat.m.microns,'support button roundtrip');
const coarse={yz:raised.m.microns-flat.m.microns,sweep:raised.s.cardinal.map((v,i)=>v.readingMicrons-flat.s.cardinal[i].readingMicrons)};
assert.ok(Math.abs(coarse.yz)>.1&&Math.abs(coarse.yz)<.15,'coarse YZ change about .12 um, well below old 1.19 um');checks++;
assert.ok(Math.abs(coarse.sweep[1])>.1&&Math.abs(coarse.sweep[1])<.15,'back sweep responds together');checks++;
e.read("sceneZoom=1.8;yaw=2.7;$('exaggerate').checked=false;updateAccuracy();updateSpindleSweep();");const camera=get();assert.deepEqual(camera,returned,'camera/zoom/emphasis leave measurements unchanged');checks++;
for(const sign of [-1,1]){
 e.read(`machineProfile=null;supportHeights=supports.map(s=>{const p=levelCoordinates(s.x,s.z);return ${sign}*(.2*p.x+.3*p.z)+.12;});updateLeveling();`);const plane=get();close(plane.m.microns,0,'rigid plane YZ remains ideal',1e-6);for(const p of plane.s.cardinal)close(p.readingMicrons,0,'rigid plane sweep remains ideal',1e-6);
}
console.log(JSON.stringify({checks,cases,maxContactErrorMicrons:maxContactError,maxXZCrossChangeMicrons:maxXZCrossChange,coarse,scope:'independent virtual plane/probe coherence, not proof of real-machine elasticity'},null,2));

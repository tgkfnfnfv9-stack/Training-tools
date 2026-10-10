'use strict';
// Expected seating points/normals come from input nodal heights, an independent
// bilinear interpolation and explicit orthonormal bases. Product transforms
// supply only actual values. Circle/ridigity checks operate on rendered meshes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sourceFiles=fs.readdirSync('src').filter(f=>/\.(js|html|css)$/.test(f)).sort(),sourceHashes=()=>Object.fromEntries(sourceFiles.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync('src/'+f)).digest('hex')])),startedSources=sourceHashes();
const env=require('./leveling-dom-env.cjs')({pureLeveling:true});
for(const file of ['lathe-inspection.js','lathe-inspection-ui.js'])env.read(fs.readFileSync('src/'+file,'utf8'));
// Rendering/measurement state is recalculated normally; omit unrelated lesson
// hint optimization so the geometry matrix does not repeatedly search a best
// adjustment for the same individual. Actual UI paths have separate browsers.
env.read('updateLatheInspectionUI=()=>{};updateMachineAccuracy=()=>null;updateLevelStages=()=>{};');
const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),mul=(a,s)=>a.map(x=>x*s),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),len=a=>Math.hypot(...a),unit=a=>mul(a,1/len(a)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const basis=(a,b)=>{const x=unit([1,a,0]),y=unit([-a,1,-b]);return [x,y,cross(x,y)];},rotate=(B,p)=>B.reduce((v,b,i)=>add(v,mul(b,p[i])),[0,0,0]);
function surface(points,heights){
 const xs=[...new Set(points.map(p=>p.x))].sort((a,b)=>a-b),zs=[...new Set(points.map(p=>p.z))].sort((a,b)=>a-b);
 const A=points.reduce((s,p,i)=>s+p.x*heights[i]/1000,0)/points.reduce((s,p)=>s+p.x*p.x,0),B=points.reduce((s,p,i)=>s+p.z*heights[i]/1000,0)/points.reduce((s,p)=>s+p.z*p.z,0),C=heights.reduce((a,b)=>a+b,0)/heights.length/1000;
 const interval=(knots,q)=>Math.max(0,Math.min(knots.length-2,knots.findIndex(k=>k>=q)-1<0?(q<=knots[0]?0:knots.length-2):knots.findIndex(k=>k>=q)-1));
 return {A,B,C,at(x,z){const i=interval(xs,x),j=interval(zs,z),dx=xs[i+1]-xs[i],dz=zs[j+1]-zs[j],u=(x-xs[i])/dx,v=(z-zs[j])/dz;
  const h=(ii,jj)=>heights[points.findIndex(p=>p.x===xs[ii]&&p.z===zs[jj])]/1000,H=[h(i,j),h(i+1,j),h(i,j+1),h(i+1,j+1)];
  return {height:dot(H,[(1-u)*(1-v),u*(1-v),(1-u)*v,u*v]),a:dot(H,[-(1-v),1-v,-v,v])/dx,b:dot(H,[-(1-u),-u,1-u,u])/dz};
 },point(x,z,y,f){const q=this.at(x,z),R=basis(A*f,B*f),S=basis((q.a-A)*f,(q.b-B)*f),v=add([x,(q.height-A*x-B*z-C)*f,z],rotate(S,[0,y-.66,0]));return add(rotate(R,v),[0,.66+C*f,0]);},up(x,z,f){const q=this.at(x,z);return rotate(basis(A*f,B*f),rotate(basis((q.a-A)*f,(q.b-B)*f),[0,1,0]));}};
}
const result={states:0,seatingComparisons:0,circularVertices:0,rigidityComparisons:0,maxSeatingErrorM:0,maxRadiusErrorM:0,minContactOverlapM:Infinity,otherFiveUnchanged:[]};
const checkNear=(actual,expected,t,label)=>assert.ok(Math.abs(actual-expected)<t,`${label}: ${actual} vs ${expected}`);
const states=[{X:0,Y:0,Z:0},{X:-100,Y:-100,Z:-100},{X:100,Y:100,Z:100},{X:37,Y:-61,Z:43},{X:100,Y:-100,Z:-100},{X:-100,Y:100,Z:100}];
const patterns=[['flat',()=>0],['plus01',p=>.01*p.x*p.z],['minus01',p=>-.01*p.x*p.z],['plus05',p=>.05*p.x*p.z],['minus05',p=>-.05*p.x*p.z],['plane',p=>.08*p.x+.06*p.z],['plane-minus',p=>-.08*p.x-.06*p.z]];
for(const id of ['horizontal','lathe'])for(const profile of [false,true])for(const scale of [[1,1],[1.5,.7],[.65,1.6]])for(const [pattern,height] of patterns)for(const state of states)for(const exaggerated of [false,true]){
 env.read(`openMachine(machines.find(m=>m.id==='${id}'));machineProfile=${profile?"window.MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length)":'null'};levelConfig.width=current.w*.8*${scale[0]};levelConfig.depth=current.d*.8*${scale[1]};positions=${JSON.stringify({...state,A:0,C:0})};$('exaggerate').checked=${exaggerated};`);
 const points=env.json('supports.map(p=>levelCoordinates(p.x,p.z))'),heights=points.map(height);env.read(`supportHeights=${JSON.stringify(heights)};updateLeveling(false);`);
 const input=env.json('({factor:displayFactor(),clearance:displayClearance(),w:current.w,d:current.d})'),S=surface(points,heights),f=input.factor,tag=[id,profile,scale,pattern,state.X,state.Y,state.Z,exaggerated].join('/');
 const seats=id==='horizontal'?[{raw:[0,.66,input.d*.29],axes:['X'],pose:'tool',at:[.55*state.X/100*scale[0],input.d*.29*scale[1]]},{raw:[0,.66,-.85],axes:['Z'],pose:'work',at:[0,(-.85+.45*state.Z/100)*scale[1]]}]:[{raw:[-1.75,.66,0],axes:[],pose:'tool',at:[-1.75*scale[0],0]},{raw:[.08,.66,.15],axes:['Z'],pose:'work',at:[(.08+.7*state.Z/100)*scale[0],.15*scale[1]]},{raw:[1.8,.66,0],axes:[],pose:'latheTailstockVisual',at:[1.8*scale[0],0]}];
 if(!profile)for(const seat of seats){const actual=env.json(`displayedModelPoint(${JSON.stringify(seat.raw)},${JSON.stringify(seat.axes)},current,positions,'${seat.pose}')`),expected=add(S.point(...seat.at,.66,f),[0,input.clearance,0]),error=len(sub(actual,expected));result.maxSeatingErrorM=Math.max(result.maxSeatingErrorM,error);assert.ok(error<1e-9,tag+' independent seat '+seat.pose+' '+error);result.seatingComparisons++;
  const upRaw=add(seat.raw,[0,1,0]),up=env.json(`displayedModelPoint(${JSON.stringify(upRaw)},${JSON.stringify(seat.axes)},current,positions,'${seat.pose}')`);assert.ok(len(sub(sub(up,actual),S.up(...seat.at,f)))<1e-9,tag+' independent normal '+seat.pose);result.seatingComparisons++;
 }
 // Cross-section radius and rigid side length come from actual rendered mesh.
 const rings=env.json(`(()=>{const model=createGeometry(current),point=(p,f)=>displayedModelPoint(p,f.axes,current,positions,f.pose,f.circular);return model.faces.filter(f=>(f.circular||f.pose==='latheTestBar')&&f.v.length>=16).map(f=>({raw:f.v,world:f.v.map(p=>point(p,f)),pose:f.pose,circular:f.circular}));})()`);
 for(const ring of rings){const centre=ring.world.reduce((s,p)=>add(s,mul(p,1/ring.world.length)),[0,0,0]),rawCentre=ring.raw.reduce((s,p)=>add(s,mul(p,1/ring.raw.length)),[0,0,0]),radius=len(sub(ring.raw[0],rawCentre));for(const p of ring.world){const error=Math.abs(len(sub(p,centre))-radius);result.maxRadiusErrorM=Math.max(result.maxRadiusErrorM,error);assert.ok(error<1e-9,tag+' round '+ring.pose);result.circularVertices++;}}
 // Each member remains rigid under changed supports at a fixed dimension.
 const parts=env.json(`(()=>{const model=createGeometry(current),point=(p,f)=>displayedModelPoint(p,f.axes,current,positions,f.pose,f.circular);return model.faces.filter(f=>!['bed'].includes(f.pose)&&!f.pose.includes(':')&&!f.circular&&f.pose!=='latheTestBar').map(f=>({raw:f.v,world:f.v.map(p=>point(p,f))}));})()`);
 for(const part of parts)for(let i=1;i<part.raw.length;i++){const d=sub(part.raw[i],part.raw[0]),expected=len([d[0]*scale[0],d[1],d[2]*scale[1]]);checkNear(len(sub(part.world[i],part.world[0])),expected,1e-9,tag+' rigid assembly');result.rigidityComparisons++;}
 if(!profile){const contacts=id==='horizontal'?[-.56,.56].flatMap(x=>[-.6,0,.6].map(dz=>({body:[x,.685,-.85+dz],axes:['Z'],pose:'work',bed:[x,.72,-.85+dz+.45*state.Z/100]}))):[-.3,0,.3].flatMap(dx=>[-.4,.4].map(z=>({body:[1.8+dx,.765,z],axes:[],pose:'latheTailstockVisual',bed:[1.8+dx,.775,z]})));
  for(const c of contacts){const values=env.json(`(()=>{const body=displayedModelPoint(${JSON.stringify(c.body)},${JSON.stringify(c.axes)},current,positions,'${c.pose}'),bed=displayedModelPoint(${JSON.stringify(c.bed)},[],current,positions,'bed'),up=displayedModelPoint(${JSON.stringify(add(c.body,[0,1,0]))},${JSON.stringify(c.axes)},current,positions,'${c.pose}');return {body,bed,up:up.map((v,i)=>v-body[i])};})()`),overlap=dot(sub(values.bed,values.body),values.up);result.minContactOverlapM=Math.min(result.minContactOverlapM,overlap);assert.ok(overlap>=-1e-9,tag+' seated on guide '+overlap);}
 }
 if(id==='horizontal'&&!exaggerated){const pair=env.json(`({nose:horizontalSpindleFixture(positions,levelSolution,machineProfile).nose,model:displayedModelPoint([0,2.55,-.93],['X','Y'],current,positions,'tool')})`);assert.ok(len(sub(pair.model,add(pair.nose,[0,input.clearance,0])))<1e-12,tag+' nose measurement/render');}
 result.states++;
}
// The five untargeted meshes, transforms, labels and arrows compare to the
// independent immutable main checkout, including both display modes.
const baseline=fs.readFileSync('/workspace/Training-tools-before/src/app.js','utf8'),start=baseline.indexOf('function createGeometry(m){'),end=baseline.indexOf('\nfunction idealFaceNormal',start);env.read(baseline.slice(start,end).replace('function createGeometry(m)','function baselineGeometry(m)'));
for(const id of ['vertical','travel','gate','gantry','five']){env.read(`openMachine(machines.find(m=>m.id==='${id}'));`);assert.deepEqual(env.json('createGeometry(current)'),env.json('baselineGeometry(current)'));result.otherFiveUnchanged.push(id);}
// The fixed nose remains exactly at the bar root; the chuck rear now reaches
// inside the headstock, in the same rigid tool frame at all support states.
env.read("openMachine(machines.find(m=>m.id==='lathe'));machineProfile=null;supportHeights=supports.map(()=>0);updateLeveling(false);");
const chuck=env.json("createGeometry(current).faces.filter(f=>f.circular&&f.pose==='tool').flatMap(f=>f.v).map(p=>p[0])");checkNear(Math.max(...chuck),-1.075,1e-12,'chuck nose preserved');assert.ok(Math.min(...chuck)<-1.35,'chuck meets headstock');result.chuckRearOverlapM=-1.35-Math.min(...chuck);
assert.deepEqual(sourceHashes(),startedSources,'product sources changed during verification');result.sourceHashes=startedSources;
const out=path.join('docs','qa-posture-20261009','structure','checks.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));

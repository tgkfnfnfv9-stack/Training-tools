'use strict';
// Fresh motion/reference audit. Expected coordinates below use input nodes,
// independent bilinear interpolation, explicit rotation matrices and the
// assembly mounting drawing. No product posture/contact function is an oracle.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const env=require('./leveling-dom-env.cjs')({pureLeveling:true});
for(const file of ['lathe-inspection.js','lathe-inspection-ui.js'])env.read(fs.readFileSync('src/'+file,'utf8'));
env.read('updateLatheInspectionUI=()=>{};updateMachineAccuracy=()=>null;updateLevelStages=()=>{};');
const plus=(a,b)=>a.map((v,i)=>v+b[i]),minus=(a,b)=>a.map((v,i)=>v-b[i]),times=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),norm=a=>Math.hypot(...a),unit=a=>times(a,1/norm(a)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const sources=Object.fromEntries(fs.readdirSync('src').filter(f=>f.endsWith('.js')).map(f=>[f,hash('src/'+f)]));
const geometricFiles=['app.js','accuracy-ui.js','leveling.js','leveling-ui.js','machine-accuracy.js','machine-accuracy-ui.js','lathe-inspection.js','lathe-inspection-ui.js','horizontal-parallelism.js','horizontal-parallelism-ui.js'];
// This audit samples transforms, not UI update timing. Use the real solver and
// geometry construction directly; separate browser coverage executes handlers.
const refresh='levelSolution=machineSolution(supportHeights);levelGeometry=geometryModel();levelInitialSolution=machineProfile?machineSolution(machineProfile.initialHeights):null;levelGeometry.visualFactor=fixedVisualFactor(levelInitialSolution);';
const rotate=(a,b,p)=>{const x=unit([1,a,0]),y=unit([-a,1,-b]),z=cross(x,y);return plus(plus(times(x,p[0]),times(y,p[1])),times(z,p[2]));};
function support(nodes,mm,factor){
 const xs=[...new Set(nodes.map(p=>p.x))].sort((a,b)=>a-b),zs=[...new Set(nodes.map(p=>p.z))].sort((a,b)=>a-b);
 // Symmetric full rectangular node grids: normal equations are diagonal.
 const mean=mm.reduce((s,v)=>s+v,0)/mm.length/1000,
  a=nodes.reduce((s,p,i)=>s+p.x*mm[i],0)/nodes.reduce((s,p)=>s+p.x*p.x,0)/1000,
  b=nodes.reduce((s,p,i)=>s+p.z*mm[i],0)/nodes.reduce((s,p)=>s+p.z*p.z,0)/1000;
 function axisIndex(list,value){const at=list.findIndex(q=>Math.abs(q-value)<=1e-12);if(at>=0)value=list[at];let i=0;while(i<list.length-2&&value>=list[i+1])i++;return {i,value};}
 return (x,z)=>{
  const X=axisIndex(xs,x),Z=axisIndex(zs,z),i=X.i,j=Z.i,u=(x-xs[i])/(xs[i+1]-xs[i]),v=(z-zs[j])/(zs[j+1]-zs[j]);
  const h=(ii,jj)=>mm[nodes.findIndex(q=>q.x===xs[ii]&&q.z===zs[jj])]/1000;
  const A=h(i,j),B=h(i+1,j),C=h(i,j+1),D=h(i+1,j+1),height=(1-u)*(1-v)*A+u*(1-v)*B+(1-u)*v*C+u*v*D;
  const sx=((1-v)*(B-A)+v*(D-C))/(xs[i+1]-xs[i]),sz=((1-u)*(C-A)+u*(D-B))/(zs[j+1]-zs[j]);
  return {origin:plus(rotate(a*factor,b*factor,[x,(height-a*x-b*z-mean)*factor,z]),[0,.66+mean*factor,0]),turn:p=>rotate(a*factor,b*factor,rotate((sx-a)*factor,(sz-b)*factor,p))};
 };
}
const parts={horizontal:[
 ['column-foot',[0,.66,1.334],['X'],'tool'],['column-top',[.475,3.2,1.684],['X'],'tool'],['Y-guide',[0,2,.881],['X'],'tool'],
 ['head-centre',[0,2.55,.25],['X','Y'],'tool'],['head-corner',[.375,2.86,.8],['X','Y'],'tool'],['nose',[0,2.55,-.93],['X','Y'],'tool'],
 ['pallet-seat',[0,.66,-.85],['Z'],'work'],['pallet-top',[0,1.27,-.85],['Z'],'work'],['workpiece-top',[.36,1.82,-.49],['Z'],'work'],
 ['fixed-guide',[1.462,.76,1.288],[],'bed'],['base-corner',[1.7,.645,2.3],[],'bed']],lathe:[
 ['head-seat',[-1.75,.66,0],[],'tool'],['head-top',[-1.35,1.845,.65],[],'tool'],['spindle-nose',[-1.075,1.5,0],[],'tool'],
 ['bar-tip',[1.125,1.5,0],[],'latheTestBar'],['bar-rim',[1.125,1.5,.025],[],'latheTestBar'],
 ['carriage-seat',[.08,.66,.15],['Z'],'work'],['carriage-top',[.48,.98,1.325],['Z'],'work'],['cross-slide',[.19,1.18,1],['X','Z'],'work'],
 ['turret-centre',[.08,1.5,1],['X','Z'],'work'],['holder',[-.09,1.5,.52],['X','Z'],'work'],['tool',[-.13,1.5,.25],['X','Z'],'work'],
 ['tailstock-seat',[1.8,.66,0],[],'latheTailstockVisual'],['tailstock-centre',[1.24,1.5,0],[],'latheTailstockVisual'],['fixed-guide',[0,.775,.4],[],'bed']]};
function expected(kind,part,input,nodes,heights){
 const [name,raw,axes,pose]=part,{state,sx,sz,factor,clearance,profile,layout}=input,phys=p=>[p[0]*sx,p[1],p[2]*sz],mount=support(nodes,heights,factor);
 let p=phys(raw),seat,relative,turn=p=>p;
 const angle=profile?(profile.squareness[kind==='horizontal'?'XY':'XZ'].microns/.3/1e6*factor):0,c=Math.cos(angle),s=Math.sin(angle);
 if(pose==='bed'){seat=mount(p[0],p[2]);relative=[0,p[1]-.66,0];}
 else if(kind==='horizontal'&&pose==='tool'){
  seat=mount((layout[0]+.55*state.X/100)*sx,(1.334+layout[1])*sz);
  relative=phys([raw[0],raw[1]-.66,raw[2]-1.334]);
  relative=[c*relative[0]-s*relative[1],s*relative[0]+c*relative[1],relative[2]];
  if(axes.includes('Y'))relative=plus(relative,times([-s,c,0],.3*state.Y/100));
 }else if(kind==='horizontal'){
  seat=mount(0,(-.85+.45*state.Z/100)*sz);relative=phys([raw[0],raw[1]-.66,raw[2]+.85]);
  const theta=p=>profile?profile.squareness[p].microns/.3/1e6*factor:0;
  const x=-Math.sin(theta('XZ')),y=(-Math.sin(theta('YZ'))+x*s)/c,z=Math.sqrt(1-x*x-y*y);
  relative=plus(relative,times([x,y,z-1],.45*state.Z/100*sz));
 }else if(pose==='latheTailstockVisual'){
  seat=mount(1.8*sx,0);relative=phys([raw[0]-1.8,raw[1]-.66,raw[2]]);
 }else if(pose==='tool'||pose==='latheTestBar'){
  seat=mount(-1.75*sx,0);relative=phys([raw[0]+1.75,raw[1]-.66,raw[2]]);if(pose==='latheTestBar')relative[2]=raw[2];
  relative=[c*relative[0]+s*relative[2],relative[1],-s*relative[0]+c*relative[2]];
 }else{
  seat=mount((.08+.7*state.Z/100)*sx,.15*sz);relative=phys([raw[0]-.08,raw[1]-.66,raw[2]-.15+(axes.includes('X')?.35*state.X/100:0)]);
 }
 return plus(plus(seat.origin,seat.turn(relative)),[0,clearance,0]);
}
const gitHead=fs.readFileSync('.git/HEAD','utf8').trim(),commit=gitHead.startsWith('ref: ')?fs.readFileSync('.git/'+gitHead.slice(5),'utf8').trim():gitHead;
const result={commit,sources,states:0,pointComparisons:0,maxErrorM:0,failures:[],examples:[],ownershipChecks:[],collisions:[]};
const stateCases=[{X:0,Y:0,Z:0},{X:-100,Y:100,Z:-100},{X:100,Y:-100,Z:100},{X:53,Y:27,Z:-61},{X:-87,Y:-43,Z:79}];let openedKind='';
for(const kind of ['horizontal','lathe'])for(const dims of [[1,1],[1.4,.7],[.5,2],[2,.5]])for(const used of [false,true])for(const pattern of ['flat','plane','twist','single','opposite'])for(const state of stateCases)for(const exaggerate of [false,true]){
 const sx=dims[0],sz=dims[1],layout=kind==='horizontal'?(pattern==='single'?[.68,.46]:pattern==='opposite'?[-.68,-.46]:[0,0]):[0,0];
 if(openedKind!==kind){env.read(`openMachine(machines.find(m=>m.id==='${kind}'));`);openedKind=kind;}
 env.read(`machineProfile=${used?"window.MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length)":'null'};levelConfig.width=current.w*.8*${sx};levelConfig.depth=current.d*.8*${sz};levelConfig.columnX=${layout[0]/.68*100};levelConfig.columnZ=${layout[1]/.46*100};positions=${JSON.stringify({...state,A:0,C:0})};$('exaggerate').checked=${exaggerate};`);
 const width=(kind==='horizontal'?2.72:4)*sx,depth=(kind==='horizontal'?3.68:1.68)*sz,xs=kind==='horizontal'?[-width/2,width/2]:[-width/2,0,width/2],zs=kind==='horizontal'?[-depth/2,-depth/6,depth/6,depth/2]:[-depth/2,depth/2],nodes=zs.flatMap(z=>xs.map(x=>({x,z})));
 const heights=nodes.map((p,i)=>pattern==='flat'?0:pattern==='plane'?.015*p.x+.01*p.z:pattern==='twist'?.01*p.x*p.z:pattern==='single'?(i===0?-.01:0):i%2?.013:-.019);
 env.read(`supportHeights=${JSON.stringify(heights)};${refresh}`);
 const info=env.json('({factor:displayFactor(),clearance:displayClearance(),profile:machineProfile})'),input={...info,sx,sz,state,layout},actual=env.json(`(${JSON.stringify(parts[kind])}).map(p=>displayedModelPoint(p[1],p[2],current,positions,p[3]))`);
 const row={kind,sx,sz,used,pattern,state,exaggerate,layout,factor:info.factor,heights,coordinates:[]};
 for(let i=0;i<parts[kind].length;i++){
  const want=expected(kind,parts[kind][i],input,nodes,heights),error=norm(minus(actual[i],want));result.maxErrorM=Math.max(result.maxErrorM,error);result.pointComparisons++;
  if(error>2e-10)result.failures.push({kind,sx,sz,used,pattern,state,exaggerate,part:parts[kind][i][0],actual:actual[i],expected:want,error});
  if(dims[0]===1&&dims[1]===1&&pattern==='twist'&&state.X===53&&!exaggerate)row.coordinates.push({part:parts[kind][i][0],actual:actual[i],expected:want});
 }
 if(row.coordinates.length)result.examples.push(row);result.states++;
}
// Per-axis ownership is measured from an unchanged flat support state. Only
// declared assembly membership determines the expected direction/distance.
for(const kind of ['horizontal','lathe']){
 env.read(`openMachine(machines.find(m=>m.id==='${kind}'));machineProfile=null;supportHeights=supports.map(()=>0);$('exaggerate').checked=false;positions={X:0,Y:0,Z:0,A:0,C:0};updateLeveling(false);`);
 const at=()=>env.json(`(${JSON.stringify(parts[kind])}).map(p=>displayedModelPoint(p[1],p[2],current,positions,p[3]))`),before=at();
 for(const axis of kind==='horizontal'?['X','Y','Z']:['X','Z']){
  env.read(`positions={X:0,Y:0,Z:0,A:0,C:0,${axis}:100};updateLeveling(false);`);const after=at();
  for(let i=0;i<parts[kind].length;i++){
   const expectedDelta=parts[kind][i][2].includes(axis)?kind==='horizontal'?axis==='X'?[.55,0,0]:axis==='Y'?[0,.3,0]:[0,0,.45]:axis==='X'?[0,0,.35]:[.7,0,0]:[0,0,0],delta=minus(after[i],before[i]);
   const error=norm(minus(delta,expectedDelta));result.ownershipChecks.push({kind,axis,part:parts[kind][i][0],actual:delta,expected:expectedDelta,error});if(error>2e-10)result.failures.push({ownership:true,kind,axis,part:parts[kind][i][0],delta,expectedDelta});
  }
 }
}
// Separate observation: the ornamental cutter/holder can enter the fixed
// inspection bar at an arbitrary X feed. This is not classified as a motion
// ownership error, and no collision interlock has been promised by the UI.
for(const X of [0,-25,-26,-98,-99,-100])for(const Z of [-100,0,100])for(const [part,cx,cz,wx,wz] of [['tool',-.13,.25,.075,.27],['holder',-.09,.52,.16,.30]]){
 const bounds={x:[cx+.7*Z/100-wx/2,cx+.7*Z/100+wx/2],z:[cz+.35*X/100-wz/2,cz+.35*X/100+wz/2]},radialGap=bounds.z[0]>.0?bounds.z[0]:bounds.z[1]<0?-bounds.z[1]:0;
 result.collisions.push({X,Z,part,bounds,bar:{x:[-1.075,1.125],radius:.025},intersects:bounds.x[1]>=-1.075&&bounds.x[0]<=1.125&&radialGap<.025,radialPenetrationM:Math.max(0,.025-radialGap)});
}
assert.deepEqual(Object.fromEntries(geometricFiles.map(f=>[f,hash('src/'+f)])),Object.fromEntries(geometricFiles.map(f=>[f,sources[f]])),'Geometry source changed during audit');
result.finishedSources=Object.fromEntries(Object.keys(sources).map(f=>[f,hash('src/'+f)]));
result.passed=result.failures.length===0;fs.mkdirSync('docs/qa-motion-reference-20261010',{recursive:true});fs.writeFileSync('docs/qa-motion-reference-20261010/moving-parts.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({passed:result.passed,states:result.states,pointComparisons:result.pointComparisons,maxErrorM:result.maxErrorM,ownershipChecks:result.ownershipChecks.length,failures:result.failures.slice(0,4)},null,2));if(!result.passed)process.exitCode=1;

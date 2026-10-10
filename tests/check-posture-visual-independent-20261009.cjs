'use strict';
const fs=require('node:fs'),path=require('node:path'),O=require('./check-posture-measurement-independent-20261009.cjs');
const root=path.resolve(process.env.TT_ROOT||path.join(__dirname,'..'));process.chdir(root);
const env=require(path.join(root,'tests/leveling-dom-env.cjs'))({pureLeveling:true});for(const file of ['lathe-inspection.js','lathe-inspection-ui.js'])env.read(fs.readFileSync('src/'+file,'utf8'));env.read('updateLatheInspectionUI=()=>{};');
let checks=0,maxPositionErrorM=0;const failures=[],rows=[];
for(const kind of ['horizontal','lathe']){
 env.read(`openMachine(machines.find(m=>m.kind==='${kind}'));`);
 const profile=env.json(`window.MachineAccuracy.generate('used',123456,${JSON.stringify(kind==='horizontal'?['X','Y','Z']:['X','Z'])},supports.length)`);
 for(const [width,depth] of kind==='horizontal'?[[2.72,3.68],[3.8,2.7]]:[[4,1.68],[5.2,1.2]])for(const k of [-.05,.05])for(const exaggerate of [false,true])for(const end of [-100,100]){
  const xs=kind==='horizontal'?[-width/2,width/2]:[-width/2,0,width/2],zs=kind==='horizontal'?[-depth/2,-depth/6,depth/6,depth/2]:[-depth/2,depth/2],nodes=zs.flatMap(z=>xs.map(x=>({x,z,mm:k*x*z+.08*x+.06*z}))),state={X:end,Y:end,Z:end,A:0,C:0};
  env.read(`levelConfig.width=${width};levelConfig.depth=${depth};machineProfile=${JSON.stringify(profile)};supportHeights=${JSON.stringify(nodes.map(q=>q.mm))};positions=${JSON.stringify(state)};$('exaggerate').checked=${exaggerate};updateLeveling();`);
  const factor=env.json('displayFactor()'),clearance=env.json('displayClearance()'),scaled=structuredClone(profile);for(const q of Object.values(scaled.squareness))q.microns*=factor;
  const m=O.machine(kind,nodes.map(q=>({...q,mm:q.mm*factor})),state,scaled,width,depth);
  const points=kind==='horizontal'?[
   {raw:[0,2.55,-.93],owner:'tool',axes:['X','Y'],pose:'tool'},
   {raw:[0,3.42,1.334],owner:'tool',axes:['X'],pose:'tool',state:{...state,Y:0}},
   {raw:[0,1.27,-.85],owner:'work',axes:['Z'],pose:'work'},
   {raw:[.3,1.27,-.5],owner:'work',axes:['Z'],pose:'work'}]:[
   {raw:[-1.075,1.5,0],owner:'tool',axes:[],pose:'tool'},
   {raw:[-1.75,2.1,.3],owner:'tool',axes:[],pose:'tool'},
   {raw:[.08,1.5,.2],owner:'work',axes:['X','Z'],pose:'work'},
   {raw:[1.8,.66,0],owner:'tailstock',axes:[],pose:'latheTailstockVisual'},
   {raw:[1.8,1.5,0],owner:'tailstock',axes:[],pose:'latheTailstockVisual'}];
  for(const p of points){
   const actual=env.json(`displayedModelPoint(${JSON.stringify(p.raw)},${JSON.stringify(p.axes)},current,positions,'${p.pose}')`),expected=m.at(p.raw,p.owner,p.state||state).point.map((q,i)=>q+(i===1?clearance:0));
   for(let i=0;i<3;i++){checks++;const error=Math.abs(actual[i]-expected[i]);maxPositionErrorM=Math.max(maxPositionErrorM,error);if(error>2e-10)failures.push({kind,width,depth,k,exaggerate,end,factor,raw:p.raw,coordinate:i,actual:actual[i],expected:expected[i],error});}
  }
  // Compare the bed datum itself, separately from a rigid body's attitude.
  const raw=kind==='horizontal'?[.55*end/100,.66,1.334]:[1.8,.66,0],q=m.physical(raw),expected=m.S.mount(q[0],q[2]).p.map((v,i)=>v+(i===1?clearance:0)),actual=env.json(`displayedModelPoint(${JSON.stringify(raw)},[],current,positions,'bed')`);
  actual.forEach((v,i)=>{checks++;const error=Math.abs(v-expected[i]);maxPositionErrorM=Math.max(maxPositionErrorM,error);if(error>2e-10)failures.push({kind,bedDatum:true,width,depth,k,exaggerate,end,factor,coordinate:i,actual:v,expected:expected[i],error});});
  rows.push({kind,width,depth,k,exaggerate,end,factor});
 }
}
const report={passed:failures.length===0,states:rows.length,checks,maxPositionErrorM,failures,rows};fs.writeFileSync(process.env.TT_REPORT||'docs/posture-visual-independent-20261009.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,rows:undefined,failures:failures.slice(0,5)},null,2));if(failures.length&&!process.env.TT_BASELINE)process.exitCode=1;

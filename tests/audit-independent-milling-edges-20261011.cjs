'use strict';
const fs=require('node:fs'),path=require('node:path'),{model,scan,sweep}=require('./audit-independent-milling-20261011.cjs');
const root=path.resolve(process.env.TT_ROOT||path.join(__dirname,'..'));process.chdir(root);const env=require(path.join(root,'tests/leveling-dom-env.cjs'))({pureLeveling:true}),rows=[],failures=[];let comparisons=0,maxErrorUm=0;
for(const id of ['vertical','travel','gate','gantry','five']){
 env.read(`openMachine(machines.find(m=>m.id==='${id}'));`);const c=env.json('({kind:current.kind,w:current.w,d:current.d,width:levelConfig.width,depth:levelConfig.depth,rawNodes:supports})');
 for(const factors of [[.75,1.35],[1.4,.7]])for(const condition of ['ideal','new','used']){
  const input={...c,width:c.width*factors[0],depth:c.depth*factors[1],profile:condition==='ideal'?null:env.json(`window.MachineAccuracy.generate('${condition}',123456,['X','Y','Z'],supports.length)`)},states=[{X:-100,Y:-100,Z:-100},{X:37,Y:-43,Z:27},{X:100,Y:100,Z:100}];
  if(id==='travel'||id==='gate')for(const d of [-1e-6,0,1e-6])states.push({X:(id==='travel'?50:0)+d,Y:0,Z:0});
  for(const source of ['support1+','support1-','plane','twist']){
   if(c.kind==='five'&&source==='twist')continue;
   const nodes=c.rawNodes.map((p,i)=>{const x=p.x/(c.w*.8)*input.width,z=p.z/(c.d*.8)*input.depth;return {x,z,group:p.group,h:source==='plane'?.03*x+.02*z:source==='twist'?.015*x*z:i===0?(source==='support1+'?.01:-.01):0};}),oracle=model(input,nodes);
   for(const s of states){const state={...s,A:0,C:0};env.read(`levelConfig.width=${input.width};levelConfig.depth=${input.depth};machineProfile=${JSON.stringify(input.profile)};supportHeights=${JSON.stringify(nodes.map(p=>p.h))};positions=${JSON.stringify(state)};levelSolution=machineSolution(supportHeights);`);const actual=env.json(`({refs:['XY','XZ','YZ'].map(key=>referenceDisplayScan({key}).microns),sweep:spindleSweepGeometry(positions,levelSolution,machineProfile,1,true).cardinal.map(p=>p.readingMicrons)})`),expected={refs:['XY','XZ','YZ'].map(key=>scan(oracle,input,state,key).value),sweep:sweep(oracle,state).values};for(const key of ['refs','sweep'])actual[key].forEach((v,i)=>{comparisons++;const error=Math.abs(v-expected[key][i]);maxErrorUm=Math.max(maxErrorUm,error);if(!Number.isFinite(v)||expected[key][i]===null||error>2e-5)failures.push({id,condition,factors,source,state,key,i,actual:v,expected:expected[key][i],error});});rows.push({id,condition,factors,source,state,actual,expected});}
  }
 }
}
const report={states:rows.length,comparisons,maxErrorUm,passed:failures.length===0,failures,rows};if(process.env.TT_REPORT)fs.writeFileSync(process.env.TT_REPORT,JSON.stringify(report)+'\n');console.log(JSON.stringify({...report,rows:undefined,failures:failures.slice(0,5)},null,2));if(failures.length&&!process.env.TT_BASELINE)process.exitCode=1;

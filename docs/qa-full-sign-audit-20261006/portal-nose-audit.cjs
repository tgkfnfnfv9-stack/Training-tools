'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),e=require('../../tests/leveling-dom-env.cjs')({pureLeveling:true}),MA=require('../../src/machine-accuracy.js');
const r={sourceSHA256:crypto.createHash('sha256').update(fs.readFileSync('index.html')).digest('hex'),checks:0,failures:[],maxNoseDifferenceMetres:0,cases:[]};
for(const i of [3,4])for(const s of [-1,1]){
 e.storage.clear();e.read(`openMachine(machines[${i}]);`);
 const p=MA.generate('used',78129,['X','Y','Z'],e.read('supports.length'));
 Object.values(p.squareness).forEach(q=>q.microns=s*10);p.initialHeights=e.json('supports.map(()=>0)');
 for(const Z of [-100,0,100]){
  e.read(`machineProfile=${JSON.stringify(p)};machineReference=null;positions={X:37,Y:-23,Z:${Z},A:0,C:0};supportHeights=supports.map((s,i)=>i===0?.01:0);$('exaggerate').checked=false;accuracyKey='';updateLeveling(false);`);
  const x=e.json("(()=>{const keys=current.kind==='gantry'?['X','Y','Z']:['Y','Z'],raw=[.15,1.91,(current.columnZ??0)-.23];return{kind:current.kind,actual:displayedModelPoint(raw,keys,current,positions,'tool'),expected:spindleSweepGeometry().nose.map((v,i)=>v+(i===1?displayClearance():0))};})()");
  const d=Math.hypot(...x.actual.map((v,i)=>v-x.expected[i]));r.maxNoseDifferenceMetres=Math.max(d,r.maxNoseDifferenceMetres);r.checks++;
  if(d>1e-8)r.failures.push({kind:x.kind,s,Z,d});r.cases.push({...x,s,Z,d});
 }
}
fs.mkdirSync('tmp/z-audit',{recursive:true});
fs.writeFileSync('tmp/z-audit/portal-nose-results.json',JSON.stringify(r));
console.log(JSON.stringify({sourceSHA256:r.sourceSHA256,checks:r.checks,failures:r.failures,maxNoseDifferenceMetres:r.maxNoseDifferenceMetres}));
if(r.failures.length)process.exitCode=1;

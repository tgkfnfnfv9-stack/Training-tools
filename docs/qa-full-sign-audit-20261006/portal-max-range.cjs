'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),make=require('../../tests/leveling-dom-env.cjs'),MA=require('../../src/machine-accuracy.js');
const e=make({pureLeveling:true}),sub=(a,b)=>a.map((v,i)=>v-b[i]),norm=a=>Math.hypot(...a);
const r={sourceSHA256:crypto.createHash('sha256').update(fs.readFileSync('index.html')).digest('hex'),description:'Maximum declared intrinsic 150µm in all three pairs, default and extreme dimension ratios, ±.5mm corner support, Z extremes, exaggerated portal mesh only; fixed envelope guard .55m.',checks:0,failures:[],cases:[],maximumCorrectionMetres:0};
for(const i of [3,4]){
 e.storage.clear();e.read(`openMachine(machines[${i}]);`);const kind=e.read('current.kind'),dims=e.json('[levelConfig.width,levelConfig.depth]');
 for(const size of [dims,[.5,20],[20,.5]])for(const errorSign of [-1,1])for(const support of [-.5,0,.5])for(const Z of [-100,100]){
  const p=MA.generate('used',78129,['X','Y','Z'],e.read('supports.length'));Object.values(p.squareness).forEach(q=>q.microns=errorSign*150);p.initialHeights=e.json('supports.map(()=>0)');
  e.read(`levelConfig.width=${size[0]};levelConfig.depth=${size[1]};machineProfile=${JSON.stringify(p)};machineReference=null;supportHeights=supports.map((s,i)=>i===0?${support}:0);positions={X:100,Y:-100,Z:${Z},A:0,C:0};$('exaggerate').checked=true;accuracyKey='';accuracyRangeKey='';visualReferenceKey='';updateLeveling(false);`);
  const data=e.json(`createGeometry(current).faces.filter(f=>f.pose==='tool'&&f.axes.includes('Z')).map(f=>({before:f.v.map(p=>levelMappedBodyVisualPoint(displayTransformedPoint(p,f.axes,current,positions,f.pose),f.pose)),after:f.v.map(p=>displayedModelPoint(p,f.axes,current,positions,f.pose))}))`);
  const correction=Math.max(...data.flatMap(f=>f.after.map((p,j)=>norm(sub(p,f.before[j])))));r.maximumCorrectionMetres=Math.max(r.maximumCorrectionMetres,correction);
  r.checks++;if(!Number.isFinite(correction)||correction>=.55)r.failures.push({kind,size,errorSign,support,Z,correction});
  r.cases.push({kind,size,errorSign,support,Z,factor:e.read('displayFactor()'),correction});
 }
}
fs.mkdirSync('tmp/z-audit',{recursive:true});
fs.writeFileSync('tmp/z-audit/portal-max-range-results.json',JSON.stringify(r));console.log(JSON.stringify({sourceSHA256:r.sourceSHA256,checks:r.checks,failures:r.failures,maximumCorrectionMetres:r.maximumCorrectionMetres}));if(r.failures.length)process.exitCode=1;

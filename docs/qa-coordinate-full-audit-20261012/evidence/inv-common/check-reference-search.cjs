'use strict';
process.chdir('/home/user/Training-tools');
const env=require('/home/user/Training-tools/tests/leveling-dom-env.cjs');
const out={};
for(let mi=0;mi<6;mi++){
 const e=env({});e.read(`openMachine(machines[${mi}]);`);const id=e.read('current.id');
 const r=e.json(`(()=>{const h0=[...supportHeights],o0=machineEvaluation(h0).objective,oC=machineEvaluation(h0.map(h=>h+.02)).objective;
  const ref=machineReference,best=ref.best.metric.objective,init=ref.initial.objective;
  document.getElementById('applyBestLevel').onclick();const applied=[...supportHeights],oA=machineEvaluation(applied).objective,mean=applied.reduce((s,h)=>s+h,0)/applied.length,mean0=h0.reduce((s,h)=>s+h,0)/h0.length;
  // brute local check: any single +-1um step improving objective by > 1e-6?
  let better=0;for(let i=0;i<applied.length;i++)for(const d of [-.001,.001]){const t=[...applied];t[i]=Math.round((t[i]+d)*1000)/1000;if(Math.abs(t[i])<=.5&&machineEvaluation(t).objective<oA-1e-6)better++;}
  return {initialObjective:init,constantOffsetInvariant:Math.abs(o0-oC)<1e-9,bestObjective:best,appliedObjective:oA,appliedEqualsBest:Math.abs(oA-best)<1e-6,meanHeightBefore:mean0,meanHeightAfter:mean,singleStepImprovements:better,
   evalSamples:geometrySamples().length,target:document.getElementById('fineStatus').getAttribute('data-target'),gap:document.getElementById('fineStatus').getAttribute('data-gap')};})()`);
 out[id]=r;console.log(id,JSON.stringify(r,(k,v)=>typeof v==='number'?Math.round(v*1e4)/1e4:v));
}
require('fs').writeFileSync(__dirname+'/reference-search.json',JSON.stringify(out,null,1));

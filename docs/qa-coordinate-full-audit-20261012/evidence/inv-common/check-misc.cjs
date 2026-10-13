'use strict';
// (a) compact gain=5: physical vs displayed (teaching) finite scan and sweep after a back support change
// (b) initial/current comparison: same interval? same zero? (B vs A)
// (c) save/load round trip and calculation-model id
process.chdir('/home/user/Training-tools');
const env=require('/home/user/Training-tools/tests/leveling-dom-env.cjs');
const out={};
{ const e=env({});e.read("openMachine(machines[0]);machineProfile=window.MachineAccuracy.generate('new',20261012,machineLinearKeys(),supports.length);machineReference=null;machineSavedBest=null;");
  const rows=[];
  for(const [label,h] of [['flat',[0,0,0,0]],['back-left +0.1 (twist)',[0,0,.1,0]],['both back +0.1 (plane fb)',[0,0,.1,.1]]]){
   e.read(`supportHeights=${JSON.stringify(h)};accuracyKey='';updateLeveling(false);`);
   const r=e.json(`({names:supports.map(s=>s.name),pairs:levelGeometry.pairs.map(p=>{const ph=referenceScan(p),d=referenceDisplayScan(p);return {key:p.key,local300:p.deviationMicroradians*.3,physical:ph.microns,displayed:d.microns};}),
     sweepPhysical:spindleSweepGeometry(positions,levelSolution,machineProfile,1,false).cardinal.map(p=>p.readingMicrons),
     sweepDisplayed:spindleSweepGeometry(positions,levelSolution,machineProfile,1,true).cardinal.map(p=>p.readingMicrons),
     adj:(({gain,angle,supportAngle})=>({gain,angle,supportAngle}))(compactMeasurementAdjustment()),
     modelDrawUsesGain:false})`);
   rows.push({label,h,...r});console.log(label,JSON.stringify(r,(k,v)=>typeof v==='number'?Math.round(v*1000)/1000:v));
  }
  out.compactGain=rows;
}
{ // (b) initial/current comparison on all machines
  out.comparison={};
  for(let mi=0;mi<6;mi++){const e=env({});e.read(`openMachine(machines[${mi}]);`);
   const id=e.read('current.id');
   e.read('supportHeights=supportHeights.map((h,i)=>i===0?Math.min(.5,h+.1):h);accuracyKey="";updateLeveling(false);');
   out.comparison[id]=e.json(`levelGeometry.pairs.map(p=>{const now=referenceDisplayScan(p),before=referenceDisplayScan(p,positions,levelInitialSolution);return {key:p.key,sameInterval:now.startPosition===before.startPosition&&now.endPosition===before.endPosition,start:now.startPosition,end:now.endPosition,nowZeroExt:now.zero&&now.zero.extension,beforeZeroExt:before.zero&&before.zero.extension,now:now.microns,before:before.microns,initialHeightsUsed:JSON.stringify(levelInitialSolution===null?null:machineProfile.initialHeights)}})`);
   console.log(id,JSON.stringify(out.comparison[id].map(r=>({k:r.key,sameInterval:r.sameInterval,zeroExt:[r.beforeZeroExt,r.nowZeroExt],before:r.before,now:r.now})),(k,v)=>typeof v==='number'?Math.round(v*1e4)/1e4:v));
  }
}
{ // (c) save/load
  out.saveLoad={};
  for(let mi=0;mi<6;mi++){const e=env({});e.read(`openMachine(machines[${mi}]);`);const id=e.read('current.id');
   e.read('supportHeights=supportHeights.map((h,i)=>Math.round((h+(i%2?.013:-.007))*1000)/1000);positions.X=37;accuracyKey="";updateLeveling(false);');
   const snap=()=>e.json('({lr:levelSolution.lr,fb:levelSolution.fb,twist:levelSolution.twist,pairs:levelGeometry.pairs.map(p=>p.deviationMicroradians),live:[...document.getElementById("liveSquareness").querySelectorAll(".live-pair-error-value")].map(x=>x.textContent)})');
   const before=snap(),rec=e.json('levelRecord()');
   e.read('supportHeights=supportHeights.map(()=>0);positions.X=0;accuracyKey="";updateLeveling(false);');
   const valid=e.read(`validLevelRecord(${JSON.stringify(rec)})`);e.read(`applyLevelRecord(${JSON.stringify(rec)});accuracyKey="";updateLeveling(false);`);
   const after=snap();const same=JSON.stringify(before)===JSON.stringify(after);
   const otherModel=e.read(`validLevelRecord(${JSON.stringify({...rec,calculationModel:'connected-frames-v1'})})`);
   out.saveLoad[id]={calculationModel:rec.calculationModel,version:rec.version,keys:Object.keys(rec),valid,same,rejectsOtherModel:!otherModel,savesOffset:rec.offset,savesProfileSeed:rec.machineProfile&&rec.machineProfile.seed};
   console.log(id,JSON.stringify(out.saveLoad[id]));
  }
}
require('fs').writeFileSync(__dirname+'/misc.json',JSON.stringify(out,null,1));

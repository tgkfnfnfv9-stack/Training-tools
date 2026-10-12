'use strict';
// Save -> load round trip, old-ID rejection, and out-of-range display, through the product UI handlers.
const ROOT='/home/user/Training-tools';process.chdir(ROOT);
const createEnv=require(ROOT+'/tests/leveling-dom-env.cjs'),MA=require(ROOT+'/src/machine-accuracy.js');
const read=e=>({sq:e.body.querySelectorAll('.live-pair-error-value').map(el=>[el.getAttribute('data-reading-microns'),el.textContent]),sw:[0,1,2,3].map(i=>[e.registry['sweepValue'+i].getAttribute('data-reading-microns'),e.registry['sweepValue'+i].textContent])});
async function roundTrip(index,seed,count,heights,state,cfg){
 const e=createEnv();e.read(`openMachine(machines[${index}]);`);
 const prof=MA.generate('used',seed,['X','Y','Z'],count);
 e.read(`levelConfig.columnX=${cfg.columnX};levelConfig.columnZ=${cfg.columnZ};$('columnX').value='${cfg.columnX}';$('columnZ').value='${cfg.columnZ}';machineProfile=${JSON.stringify(prof)};supportHeights=${JSON.stringify(heights)};positions=${JSON.stringify({...state,A:0,C:0})};updateLeveling();`);
 const before=read(e);
 e.registry.exportLevel.onclick();const text=await e.context.exportedBlob.text(),json=JSON.parse(text);
 // disturb state
 e.read(`supportHeights=supportHeights.map(h=>Math.max(-.5,Math.min(.5,Math.round((h+.07)*1000)/1000)));supportHeights[0]=0.2;positions={X:-50,Y:30,Z:-20,A:0,C:0};updateLeveling();`);
 const disturbed=read(e);
 const file=t=>({size:t.length,text:async()=>t});
 await e.registry.importLevel.onchange({target:{files:[file(text)],value:'x'}});
 const after=read(e),msg=e.registry.levelInputMessage.textContent;
 // old calculation id
 const old={...json,calculationModel:index===1?'horizontal-guide-v2':'compact-asymmetric-bending-v3'};
 e.read(`supportHeights=supportHeights.map(()=>0.011);updateLeveling();`);const pre=read(e);
 await e.registry.importLevel.onchange({target:{files:[file(JSON.stringify(old))],value:'x'}});
 const rej=read(e),rejMsg=e.registry.levelInputMessage.textContent;
 return {machine:json.machine,calculationModel:json.calculationModel,storageKey:e.json('levelKey()'),readingsBefore:before,readingsDisturbed:disturbed,readingsAfterImport:after,roundTripEqual:JSON.stringify(before)===JSON.stringify(after),importMessage:msg,
  oldId:old.calculationModel,oldRejectedMessage:rejMsg,stateUnchangedAfterReject:JSON.stringify(pre)===JSON.stringify(rej),savedFields:{heights:json.heights,axisPositions:json.axisPositions,columnX:json.columnX,columnZ:json.columnZ,seed:json.machineProfile?.seed}};
}
async function oor(){
 const e=createEnv();e.read('openMachine(machines[0]);');const prof=MA.generate('used',7,['X','Y','Z'],4);
 const out={};
 e.read(`levelConfig.depth=0.6;machineProfile=${JSON.stringify(prof)};supportHeights=${JSON.stringify(prof.initialHeights)};positions={X:0,Y:0,Z:0,A:0,C:0};updateLeveling();`);out.compactDepth06=read(e);
 e.read(`levelConfig.depth=2.16;positions={X:100,Y:100,Z:0,A:0,C:0};updateLeveling();`);out.compactX100Y100=read(e);
 e.read(`positions={X:-100,Y:-100,Z:0,A:0,C:0};updateLeveling();`);out.compactXm100Ym100=read(e);
 return out;
}
(async()=>{
 const r={compact:await roundTrip(0,20261012,4,[.012,-.033,.101,-.087],{X:40,Y:-55,Z:30},{columnX:20,columnZ:-10}),
  horizontal:await roundTrip(1,20261012,8,[.05,-.02,.11,-.07,.0,.03,-.04,.09],{X:70,Y:-60,Z:45},{columnX:55,columnZ:-80}),outOfRange:await oor()};
 require('fs').writeFileSync(__dirname+'/results-saveload.json',JSON.stringify(r,null,1));
 console.log(JSON.stringify(r,null,1).slice(0,6000));
})();

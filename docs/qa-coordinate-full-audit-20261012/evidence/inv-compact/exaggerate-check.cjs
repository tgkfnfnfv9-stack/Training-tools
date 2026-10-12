process.chdir('/home/user/Training-tools');
const e=require('/home/user/Training-tools/tests/leveling-dom-env.cjs')();const MA=require('/home/user/Training-tools/src/machine-accuracy.js');
const p=MA.generate('new',20261012,['X','Y','Z'],4);
e.read(`openMachine(machines[0]);initializeMachineAccuracy(${JSON.stringify(p)});supportHeights=${JSON.stringify(p.initialHeights)};updateLeveling(false);`);
const read=()=>e.json(`({dom:[...document.querySelectorAll(".live-pair-error-value")].map(x=>x.getAttribute("data-reading-microns")),sweep:[0,1,2,3].map(i=>$("sweepValue"+i).getAttribute("data-reading-microns")),factor:displayFactor(),scan:[...document.querySelectorAll(".scan-geometry")].slice(0,3).map(g=>[g.getAttribute("data-normal-gain"),g.getAttribute("data-tilt-gain")])})`);
const on=read();e.read(`$("exaggerate").checked=false;updateLeveling(false);`);const off=read();
console.log(JSON.stringify({exaggerateOn:on,exaggerateOff:off},null,1));
require('fs').writeFileSync(__dirname+'/exaggerate-check.json',JSON.stringify({exaggerateOn:on,exaggerateOff:off},null,1));

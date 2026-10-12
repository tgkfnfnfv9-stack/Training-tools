process.chdir('/home/user/Training-tools');
const e=require('/home/user/Training-tools/tests/leveling-dom-env.cjs')();
e.read('openMachine(machines[0]);');
console.log(e.json('{id:current.id,kind:current.kind,levelConfig,supports,supportHeights,profile:machineProfile,positions}'));
console.log(e.json('[...document.querySelectorAll(".live-pair-error-value")].map(x=>[x.textContent,x.getAttribute("data-reading-microns"),x.getAttribute("data-physical-reading-microns")])'));
console.log(e.json('[0,1,2,3].map(i=>[$("sweepLabel"+i).textContent,$("sweepValue"+i).textContent,$("sweepValue"+i).getAttribute("data-reading-microns")])'));
console.log(e.json('compactMeasurementAdjustment()'), e.read('compactMeasurementAdjustment().angle'));

process.chdir('/home/user/Training-tools');
const e=require('/home/user/Training-tools/tests/leveling-dom-env.cjs')();
e.read('openMachine(machines[0]);');
console.log(e.json('[current.kind,levelConfig,supports,machineProfile,supportHeights,positions]'));
const dom=()=>({sq:e.body.querySelectorAll('.live-pair-error-value').map(el=>[el.getAttribute('data-reading-microns'),el.textContent,el.getAttribute('data-reading-model'),el.getAttribute('data-support-response-gain')]),sw:[0,1,2,3].map(i=>[e.registry['sweepValue'+i].getAttribute('data-reading-microns'),e.registry['sweepValue'+i].textContent])});
console.log(JSON.stringify(dom()));
console.log(e.json('[spindleSweepMode, page]'));

const e=require('/home/user/Training-tools/tests/leveling-dom-env.cjs')();
e.read('openMachine(machines[0]);');
console.log(e.json('[current.id,current.kind,levelConfig,supports,machineProfile&&machineProfile.seed,supportHeights,page]'));
e.read(`machineProfile=window.MachineAccuracy.generate('new',12345,['X','Y','Z'],4);machineReference=null;supportHeights=[...machineProfile.initialHeights];positions={X:0,Y:0,Z:0,A:0,C:0};updateLeveling();drawScene();`);
console.log(e.json('machineProfile'));
const vals=e.body.querySelectorAll('.live-pair-value');
console.log(e.json('[0,1,2,3].map(i=>[$("sweepValue"+i).textContent,$("sweepValue"+i).getAttribute("data-reading-microns")])'));
const items=[];(function walk(el){for(const c of el.children){if(c.attrs&&c.attrs['data-reading-microns']!==undefined&&c.attrs['data-pair'])items.push([c.tagName,c.attrs['data-pair'],c.attrs['data-reading-microns'],c.attrs['data-physical-reading-microns'],c.textContent]);walk(c);}})(e.registry['liveSquareness']);
console.log(items);

const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:1440,height:1000}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/user/Training-tools/index.html');
const r=await p.evaluate(()=>{openMachine(machines.find(m=>m.kind==='lathe'));machineProfile=MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length);supportHeights=[...machineProfile.initialHeights];positions={X:0,Y:0,Z:0,A:0,C:0};updateAxisValues();updateLeveling(false);
return {lathe:$('liveSquareness').dataset.lathe,text:$('liveSquareness').innerText,second:$('latheInspectionSecond').innerText,heights:supportHeights,ml:machines.map(m=>m.id+':'+m.kind),acc:($('accuracy-current-XZ')||{}).textContent,cl:$('columnLean').textContent};});
console.log(JSON.stringify(r,null,1),errs);await b.close();})();

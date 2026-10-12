// Same-ID files (travel-guide-v2, compact-asymmetric-bending-v4) exported by main: load into main and branch, compare readings.
const {chromium}=require('playwright'),fs=require('fs');
const U={branch:'file:///home/user/Training-tools/index.html',main:'file:///tmp/claude-0/-home-user-Training-tools/4989ebb2-0dd1-5f7d-84eb-5fc1dc0607ea/scratchpad/main-wt/index.html'};
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});const out={};
for(const id of ['travel','vertical'])for(const v of ['main','branch']){const p=await b.newPage({viewport:{width:1440,height:1000}});await p.goto(U[v]);await p.locator('#mechanical').click();await p.locator('#leveling').click();await p.locator('#machineGrid .machine-card').nth(['vertical','horizontal','travel','gate','gantry','lathe'].indexOf(id)).click();
 await p.locator('#openTrainingMenu').click();await p.locator('.level-storage summary').click();await p.locator('#importLevel').setInputFiles(__dirname+'/saved-main-'+id+'.json');await p.waitForTimeout(300);
 out[id+'-'+v]=await p.evaluate(()=>({msg:$('levelInputMessage').textContent,live:[...document.querySelectorAll('#liveSquareness .live-pair-error-value')].map(e=>e.textContent+' ('+e.dataset.readingMicrons+')'),sweep:[0,1,2,3].map(i=>$('sweepValue'+i)?.textContent)}));await p.close();}
console.log(JSON.stringify(out,null,1));fs.writeFileSync(__dirname+'/same-id-load.json',JSON.stringify(out,null,1));await b.close();})();

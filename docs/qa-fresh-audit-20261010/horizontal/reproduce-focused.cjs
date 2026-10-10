const fs=require('fs'),{chromium}=require('playwright');const dir='/workspace/Training-tools/docs/qa-fresh-audit-20261010/horizontal';
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const out=[];
for(const [v,path] of [['pr','/workspace/Training-tools/index.html'],['public','/tmp/training-fresh-public.html']]){const p=await b.newPage({viewport:{width:1440,height:1000}});await p.route('http://audit.test/**',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(path)}));await p.goto('http://audit.test');await p.getByText('機械',{exact:true}).click();await p.getByText('工作機械のレベル出し',{exact:true}).click();await p.getByText('横形・Haas EC-630',{exact:true}).click();await p.evaluate(()=>{machineProfile=MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length);machineReference=null;machineSavedBest=null;positions={X:0,Y:0,Z:0,A:0,C:0};supportHeights=supports.map(()=>0);selected=0;updateAxisValues();updateLeveling(false);});
await p.locator('#liveSquareness').screenshot({path:dir+'/'+v+'-diagrams-flat.png'});
await p.locator('#measurementReferenceToggle').click();
const card=p.locator('[data-reference-pair="YZ"]');await card.locator('p').first().scrollIntoViewIfNeeded();await p.screenshot({path:dir+'/'+v+'-YZ-mount-text.png'});
await card.getByText(/① /).scrollIntoViewIfNeeded();await p.screenshot({path:dir+'/'+v+'-YZ-movement-steps.png'});
if(v==='pr'){
 const range=card.getByText(/0\.0 → \+300\.0 mm/);await range.scrollIntoViewIfNeeded();await p.screenshot({path:dir+'/pr-Y-central-range.png'});
 await p.locator('#closeMeasurementReference').click();await p.locator('#axisTabs').getByText('Y軸',{exact:true}).click();await p.locator('#openTrainingMenu').click();await p.locator('#axisMenuSection > summary').click();await p.locator('#axis-Y').fill('100');await p.locator('#axis-Y').dispatchEvent('input');await p.screenshot({path:dir+'/pr-Y-plus-controls.png'});await p.locator('#closeTrainingMenu').click();await p.locator('#measurementReferenceToggle').click();await range.scrollIntoViewIfNeeded();await p.screenshot({path:dir+'/pr-Y-plus-range.png'});
 out.push({name:'Y-plus',axis:await p.locator('#axis-Y').getAttribute('aria-valuetext'),range:await range.textContent(),diagrams:await p.locator('#liveSquareness').innerText()});
}
await p.close();}
fs.writeFileSync(dir+'/focused-observations.json',JSON.stringify(out,null,2));await b.close()})().catch(e=>{console.error(e);process.exit(1)});

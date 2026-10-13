'use strict';
const {chromium}=require('playwright'),fs=require('node:fs');
const results=JSON.parse(fs.readFileSync(__dirname+'/results.json','utf8'));
(async()=>{
 const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('file:///home/user/Training-tools/index.html');
 const out=[];
 for(const idx of [0,4,9]){const c=results[idx].case;
  for(const tag of ['before','after']){
   const r=await page.evaluate(({c,h})=>{
    openMachine(machines.find(m=>m.kind==='lathe'));
    machineProfile=window.MachineAccuracy.generate(c.condition,c.seed,['X','Z'],6);supportHeights=[...h];positions={X:c.X,Y:0,Z:c.Z,A:0,C:0};
    updateAxisValues();updateLeveling(false);drawScene();
    const t=id=>{const e=document.getElementById(id);return e?e.innerText.replace(/\s+/g,' ').trim():null;};
    const vis=id=>{const e=document.getElementById(id);if(!e)return null;const r=e.getBoundingClientRect();return {hidden:e.hidden||getComputedStyle(e).display==='none',w:r.width,h:r.height};};
    return {seed:machineProfile.seed,heights:supportHeights,dataset:document.getElementById('liveSquareness').dataset.lathe,
     liveSquareness:t('liveSquareness'),second:t('latheInspectionSecond'),accXZ:t('accuracy-current-XZ'),refCards:(t('measurementReferenceCards')||'').slice(0,120),
     accuracyDiagramText:(document.getElementById('accuracyDiagram')?.textContent||'').slice(0,200),visAcc:vis('accuracyDiagram'),visXZ:vis('accuracy-current-XZ')};
   },{c,h:c[tag]});
   out.push({idx,tag,case:{seed:c.seed,op:c.op,X:c.X,Z:c.Z},...r});
  }}
 fs.writeFileSync(__dirname+'/browser.json',JSON.stringify({errors,out},null,1));
 await browser.close();console.log(JSON.stringify({errors,out},null,1));
})();

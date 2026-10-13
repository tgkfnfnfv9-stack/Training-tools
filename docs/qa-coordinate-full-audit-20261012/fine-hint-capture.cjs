'use strict';
// Browser check of the version-2 individual draw and the fine-stage hint.
// Usage: node fine-hint-capture.cjs <index.html> <outDir>. Seed source fixed at 123456.
const fs=require('fs'),path=require('path'),{chromium}=require('playwright');
const input=path.resolve(process.argv[2]||'index.html'),out=path.resolve(process.argv[3]||'docs/qa-coordinate-full-audit-20261012/browser/fine-hint');
fs.mkdirSync(out,{recursive:true});
const ids=['vertical','horizontal','travel','gate','gantry','lathe'];
(async()=>{
 const html=fs.readFileSync(input),browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}),result={};
 for(const [vp,size] of [['pc',{width:1440,height:1000}],['phone',{width:390,height:844}]]){
  const page=await browser.newPage({viewport:size,reducedMotion:'reduce',deviceScaleFactor:vp==='phone'?2:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.crypto.getRandomValues=a=>{a[0]=123456;return a;};});
  await page.route('http://audit.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
  result[vp]={errors,machines:{}};
  for(const id of ids){
   await page.goto('http://audit.test/');
   const ms=await page.evaluate(id=>{localStorage.clear();const t=performance.now();openMachine(machines.find(m=>m.id===id));return performance.now()-t;},id);
   // Coarse leveling: remove the average tilt only (a rigid plane), as a trainee would.
   const state=await page.evaluate(()=>{
    const P=supports.map((s,i)=>({...levelCoordinates(s.x,s.z),h:supportHeights[i]})),n=P.length,m=k=>P.reduce((a,p)=>a+p[k],0)/n,mx=m('x'),mz=m('z'),mh=m('h');
    let a=0,b=0,c=0,d=0,e=0;for(const p of P){const x=p.x-mx,z=p.z-mz,h=p.h-mh;a+=x*x;b+=z*z;c+=x*z;d+=x*h;e+=z*h;}
    const det=a*b-c*c,sx=(d*b-e*c)/det,sz=(e*a-d*c)/det;supportHeights=P.map(p=>Math.round((p.h-sx*(p.x-mx)-sz*(p.z-mz))*100)/100);updateLeveling();
    document.getElementById('fineAdjust').click();
    const t=id=>document.getElementById(id)?.textContent.replace(/\s+/g,' ').trim();
    return {seed:machineProfile.seed,condition:machineProfile.condition,afterCoarse:machineEvaluation(supportHeights).readings.map(r=>[r.label,r.microns===null?null:Math.round(r.microns)]),bestMax:Math.round(machineReference.best.metric.maxReading*10)/10,fineHint:t('fineHint'),reminder:t('supportStageHint'),fineStatus:t('fineStatus')};
   });
   await page.screenshot({path:path.join(out,`${vp}-${id}-fine.png`)});
   // The hint itself lives in the existing settings drawer (layout unchanged).
   await page.evaluate(()=>{setTrainingMenuOpen(true);const d=document.getElementById('fineHint').closest('details');if(d)d.open=true;document.getElementById('fineHint').scrollIntoView({block:'center'});});
   await page.waitForTimeout(200);
   await page.screenshot({path:path.join(out,`${vp}-${id}-fine-hint.png`)});
   await page.evaluate(()=>setTrainingMenuOpen(false));
   result[vp].machines[id]={openMs:Math.round(ms),...state};
  }
  await page.close();
 }
 await browser.close();
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,1));
 console.log(JSON.stringify(Object.fromEntries(Object.entries(result).map(([k,v])=>[k,{errors:v.errors,open:Object.fromEntries(Object.entries(v.machines).map(([m,q])=>[m,q.openMs]))}]))));
})();

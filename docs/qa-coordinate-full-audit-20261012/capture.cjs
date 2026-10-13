'use strict';
// Read-only capture of displayed values. Usage: node capture.cjs <index.html> <outDir>
// Same individual (seed 123456, new), same axis positions; support A raised 10 x coarse (+0.100 mm) via real buttons.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{chromium}=require('playwright');
const input=path.resolve(process.argv[2]||'index.html'),out=path.resolve(process.argv[3]||'docs/qa-coordinate-full-audit-20261012/browser/before');
fs.mkdirSync(out,{recursive:true});
const ids=['vertical','horizontal','travel','gate','gantry','lathe'];
(async()=>{
 const html=fs.readFileSync(input),browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 const result={input,sha256:crypto.createHash('sha256').update(html).digest('hex'),seed:123456,condition:'new',viewports:{}};
 for(const [vp,size] of [['pc',{width:1440,height:1000}],['phone',{width:390,height:844}]]){
  const page=await browser.newPage({viewport:size,reducedMotion:'reduce',deviceScaleFactor:vp==='phone'?2:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.crypto.getRandomValues=a=>{a[0]=123456;return a;};});
  await page.route('http://audit.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
  result.viewports[vp]={machines:{},errors};
  for(const id of ids){
   await page.goto('http://audit.test/');
   await page.evaluate(id=>{localStorage.clear();openMachine(machines.find(m=>m.id===id));},id);
   await page.waitForTimeout(300);
   const read=()=>page.evaluate(()=>{
    const t=id=>document.getElementById(id)?.textContent.replace(/\s+/g,' ').trim();
    const live=[...document.querySelectorAll('#liveSquareness [data-pair], #liveSquareness svg')].map(e=>({pair:e.dataset.pair,text:e.closest('figure,div,section')?.textContent.replace(/\s+/g,' ').trim().slice(0,200)}));
    return {seed:machineProfile.seed,supportHeights:[...supportHeights],positions:{...positions},levelLR:t('stageAverageLR'),levelFB:t('stageAverageFB'),
     liveSquareness:t('liveSquareness'),sweep:[0,1,2,3].map(i=>t('sweepLabel'+i)+' '+t('sweepValue'+i)),sweepNote:t('sweepMeasurementNote')?.slice(0,120),
     inspection:t('intrinsicInspectionPage')?.slice(0,400),fine:{front:t('fineLeanFront'),right:t('fineLeanRight'),twist:t('fineTwist')},bodyLean:t('bodyLeanValues'),metrics:t('accuracyMetrics')?.slice(0,600),
     lathe:document.getElementById('liveSquareness').dataset.lathe||null};
   });
   const before=await read();
   await page.screenshot({path:path.join(out,`${vp}-${id}-initial.png`)});
   // Select support A via the map and raise by 10 coarse steps (real buttons).
   await page.locator('#supportMap .map-point').first().click();
   await page.locator('#coarseAdjust').click();
   for(let i=0;i<10;i++)await page.locator('#raiseSupport').click();
   await page.waitForTimeout(200);
   const after=await read();
   await page.screenshot({path:path.join(out,`${vp}-${id}-supportA+0.100.png`)});
   result.viewports[vp].machines[id]={initial:before,supportAplus100:after};
  }
  await page.close();
 }
 await browser.close();
 fs.writeFileSync(path.join(out,'values.json'),JSON.stringify(result,null,1));
 for(const [vp,v] of Object.entries(result.viewports)){console.log(vp,'errors',v.errors.length);for(const [id,m] of Object.entries(v.machines))console.log(vp,id,'|',m.initial.liveSquareness?.slice(0,140),'||',m.supportAplus100.liveSquareness?.slice(0,140));}
})().catch(e=>{console.error(e);process.exitCode=1;});

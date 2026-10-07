// Diagnostic fixture matching ../material-point-probe.cjs; UI is not modified.
const fs=require('node:fs'),{chromium}=require('playwright');
const dir=__dirname,repo=require('node:path').resolve(dir,'../../..');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:3});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://coordinate.audit/**',r=>r.fulfill({body:fs.readFileSync(repo+'/index.html'),contentType:'text/html'}));
 await page.goto('http://coordinate.audit/');
 await page.evaluate(()=>{
  localStorage.clear();openMachine(machines.find(m=>m.kind==='horizontal'));
  machineProfile=null;machineReference=null;machineSavedBest=null;
  supportHeights=[.2,-.2,.06666666666666668,-.06666666666666668,-.06666666666666667,.06666666666666667,-.2,.2];
  positions={X:0,Y:0,Z:0,A:0,C:0};document.getElementById('exaggerate').checked=false;
  updateAxisValues();updateLeveling(false);
 });
 const state=await page.evaluate(()=>({kind:current.kind,profile:machineProfile,heights:[...supportHeights],positions:{...positions},exaggerate:document.getElementById('exaggerate').checked,readings:levelGeometry.pairs.map(p=>{const m=referenceScan(p);return {pair:p.key,valid:m.valid,microns:m.microns,startPosition:m.startPosition,endPosition:m.endPosition,setup:m.setup}}),record:levelRecord()}));
 await page.screenshot({path:dir+'/horizontal-material-fixture-main.png'});
 await page.locator('.live-squareness-item').filter({has:page.locator('svg[data-pair="XZ"]')}).screenshot({path:dir+'/horizontal-material-fixture-XZ-live.png'});
 fs.writeFileSync(dir+'/fixture-state.json',JSON.stringify({note:'Diagnostic state matching material-point-probe. Fractional-micrometre heights are intentionally unrounded and do not satisfy the normal JSON import quantization constraint. This is a reproduction record, not an importable user save.',...state,pageErrors:errors},null,2));
 await browser.close();console.log(JSON.stringify({readings:state.readings,pageErrors:errors},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});

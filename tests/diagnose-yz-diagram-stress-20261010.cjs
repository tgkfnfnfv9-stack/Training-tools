'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),{chromium}=require('playwright');
const root=path.resolve('docs/qa-yz-sign-recheck-20261010/browser');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 for(const candidate of ['public','pr']){
  const out=path.join(root,candidate),html=zlib.gunzipSync(fs.readFileSync(path.join(out,'index.html.gz'))),page=await browser.newPage({viewport:{width:1280,height:1000},reducedMotion:'reduce'});
  await page.route('http://audit.test/**',r=>r.fulfill({contentType:'text/html',body:html}));await page.goto('http://audit.test/');
  const result=await page.evaluate(()=>{
   openMachine(machines.find(m=>m.kind==='horizontal'));let seed=894243,rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};const failures=[],states=[];
   for(let i=0;i<700;i++){
    machineProfile=i%2?MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length):null;positions={X:Math.floor(rand()*201)-100,Y:Math.floor(rand()*201)-100,Z:Math.floor(rand()*201)-100,A:0,C:0};supportHeights=supports.map(()=>Math.round((rand()-.5)*800)/1000);levelSolution=machineSolution(supportHeights);
    const rows=geometryModel().pairs.map(pair=>{const m=referenceDisplayScan(pair);if(!m.valid)return {pair:pair.key,valid:false,reason:m.reason};const element=document.createElement('div');element.innerHTML='<svg>'+referenceDiagram(m)+'</svg>';const probe=element.querySelector('.scan-probe'),p=probe.getAttribute('d').match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi).map(Number),length=Math.hypot(p[2]-p[0],p[3]-p[1]),lengthDelta=length-11,wrong=Math.abs(m.microns)>.01&&Math.abs(lengthDelta)>1e-6&&Math.sign(m.microns)===Math.sign(lengthDelta);return {pair:pair.key,valid:true,raw:m.microns,integer:squarenessMicronText(m.microns),length,lengthDelta,wrong,geometry:{...element.querySelector('.scan-geometry').dataset}};});
    const state={index:i,positions:{...positions},supportHeights:[...supportHeights],profile:machineProfile,rows};states.push(state);if(rows.some(r=>r.wrong))failures.push(state);
   }return {method:'Deterministic bulk fixtures through evaluate within ±0.400 mm and full allowed axis positions; no UI operation claim. Checks whether projected, independently exaggerated probe length implies opposite raw sign.',states,failures};
  });
  fs.writeFileSync(path.join(out,'diagram-stress.json'),JSON.stringify(result,null,2));
  const fixture=result.failures.find(s=>s.rows.some(r=>r.pair==='YZ'&&r.wrong))||result.failures[0];if(fixture){await page.evaluate(f=>{positions=f.positions;supportHeights=f.supportHeights;machineProfile=f.profile;updateAxisValues();updateLeveling(false);},fixture);await page.screenshot({path:path.join(out,'diagram-sign-counterexample.png')});await page.locator('#liveSquareness').screenshot({path:path.join(out,'diagram-sign-counterexample-diagrams.png')});}
  console.log(JSON.stringify({candidate,states:result.states.length,failures:result.failures.length,first:fixture}));await page.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});

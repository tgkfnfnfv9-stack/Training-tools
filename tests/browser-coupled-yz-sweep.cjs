'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const input=path.resolve(process.argv[2]||'index.html'),label=process.argv[3]||'after';
const out=path.resolve('docs/qa-coupled-yz-sweep-20261007',label);fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync(input),checks=[],states=[],errors=[];
const check=(name,ok,detail)=>checks.push({name,ok,detail});
(async()=>{
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:1000}});page.on('pageerror',e=>errors.push(e.message));
await page.route('http://localhost:8765/**',r=>r.fulfill({contentType:'text/html',body:html}));await page.goto('http://localhost:8765/');
const init=async(index=0,real=false)=>page.evaluate(({index,real})=>{openMachine(machines[index]);machineProfile=real?MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length):{squareness:{XY:{microns:33},XZ:{microns:75},YZ:{microns:-15}},guides:{},initialHeights:supports.map(()=>0)};machineReference=null;machineSavedBest=null;positions={X:0,Y:0,Z:0,A:0,C:0};supportHeights=supports.map(()=>0);selected=0;updateLeveling(false);},{index,real});
const read=()=>page.evaluate(()=>({kind:current.kind,heights:[...supportHeights],step:Number($('adjustStep').value),pairs:[...document.querySelectorAll('#liveSquareness .live-pair-values')].map(e=>({pair:e.dataset.pair,value:Number(e.querySelector('.live-pair-error-value').dataset.readingMicrons),text:e.querySelector('.live-pair-error-value').textContent})),sweep:[0,1,2,3].map(i=>({value:$('sweepValue'+i).dataset.readingMicrons===''?null:Number($('sweepValue'+i).dataset.readingMicrons),text:$('sweepValue'+i).textContent})),panelHidden:$('spindleSweepPanel').hidden,columnInset:!!document.getElementById('columnLeanInset')}));
const values=q=>JSON.stringify([q.pairs,q.sweep]);
for(const [width,height] of [[1280,1000],[390,844],[320,568]]){
await page.setViewportSize({width,height});await init();let before=await read();
check(width+': no additional column panel',!before.columnInset);
await page.screenshot({path:path.join(out,`compact-${width}-before.png`)});
for(let i=0;i<10;i++)await page.locator('#raiseSupport').click();let after=await read();states.push({width,before,after});
check(width+': ten real coarse clicks change A by .1 mm',Math.abs(after.heights[0]-.1)<1e-12,after.heights);
check(width+': front zero retained',after.sweep[3].value===0);
if(label!=='before'){
check(width+': YZ responds moderately',Math.abs(after.pairs[2].value-before.pairs[2].value)>.9&&Math.abs(after.pairs[2].value-before.pairs[2].value)<1.5,after.pairs[2].value-before.pairs[2].value);
check(width+': both visible rounded YZ and back sweep change',after.pairs[2].text!==before.pairs[2].text&&after.sweep[1].text!==before.sweep[1].text,{yz:[before.pairs[2].text,after.pairs[2].text],back:[before.sweep[1].text,after.sweep[1].text]});
}
await page.screenshot({path:path.join(out,`compact-${width}-after-10-coarse.png`)});
for(let i=0;i<10;i++)await page.locator('#lowerSupport').click();check(width+': ten-click roundtrip restores values',values(await read())===values(before));
for(let support=0;support<4;support++){
await page.locator(`#supportMap [data-support="${support}"]`).click();const base=await read();
await page.locator('#raiseSupport').click();const coarse=await read();check(`${width}/${support}: coarse .01`,Math.abs(coarse.heights[support]-base.heights[support]-.01)<1e-12);
await page.locator('#lowerSupport').click();check(`${width}/${support}: coarse roundtrip`,values(await read())===values(base));
await page.locator('#fineAdjust').click();await page.locator('#raiseSupport').click();const fine=await read();check(`${width}/${support}: fine .001`,Math.abs(fine.heights[support]-base.heights[support]-.001)<1e-12);check(`${width}/${support}: fine finite response`,fine.pairs.every(p=>Number.isFinite(p.value))&&fine.pairs[2].value!==base.pairs[2].value);
await page.locator('#lowerSupport').click();check(`${width}/${support}: fine roundtrip`,values(await read())===values(base));await page.locator('#coarseAdjust').click();
}
const boxes=await page.locator('#supportMap .map-point').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {height:r.height,width:r.width,top:r.top,bottom:r.bottom};}));check(`${width}: support buttons minimum 24px`,boxes.every(r=>r.height>=24&&r.width>=24),boxes);
check(`${width}: viewport not horizontally overflowing`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
}
await init();const original=await read();await page.evaluate(()=>{yaw+=.7;sceneZoom=1.5;$('exaggerate').checked=!$('exaggerate').checked;drawScene();updateAccuracy();updateSpindleSweep();});check('camera zoom emphasis values invariant',values(await read())===values(original));
// Invalid front reference must prevent every numeric cardinal reading.
let off=null;for(const x of [-100,100])for(const y of [-100,100]){await page.evaluate(({x,y})=>{positions.X=x;positions.Y=y;updateLeveling(false);},{x,y});const q=await read();if(q.sweep[3].value===null){off=q;break;}}
check('front off-table case reached',!!off,off);if(off)check('front off-table suppresses all four values',off.sweep.every(p=>p.value===null));
await init(0,true);await page.locator('#raiseSupport').click();await page.locator('#fineAdjust').click();await page.locator('#raiseSupport').click();const saved=await read();const record=await page.evaluate(()=>{saveLeveling();return JSON.parse(localStorage.getItem(levelKey()));});check('saved record valid',await page.evaluate(r=>validLevelRecord(r),record));await page.locator('#raiseSupport').click();await page.evaluate(r=>{applyLevelRecord(r);buildSupports();updateLeveling(false);},record);check('save load reproduces measurements',values(await read())===values(saved));
const otherMachines=[];for(let i=1;i<7;i++){await init(i);await page.evaluate(()=>{supportHeights=supports.map((s,i)=>i%2?.03:-.02);updateLeveling(false);});otherMachines.push(await read());}fs.writeFileSync(path.join(out,'other-machines.json'),JSON.stringify(otherMachines,null,2));
if(label!=='before'){const old=JSON.parse(fs.readFileSync(path.resolve(out,'../before/other-machines.json')));const visible=q=>q.map(v=>({...v,sweep:v.panelHidden?[]:v.sweep}));check('all other six machines unchanged',JSON.stringify(visible(old))===JSON.stringify(visible(otherMachines)));check('horizontal and lathe sweep stays hidden',otherMachines.filter(q=>['horizontal','lathe'].includes(q.kind)).every(q=>q.panelHidden));}
check('no browser exceptions',errors.length===0,errors);const report={input,label,sha256:crypto.createHash('sha256').update(html).digest('hex'),checks,states,errors};fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({checks:checks.length,passed:checks.filter(c=>c.ok).length,failed:checks.filter(c=>!c.ok),sha256:report.sha256}));process.exitCode=checks.some(c=>!c.ok)?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});

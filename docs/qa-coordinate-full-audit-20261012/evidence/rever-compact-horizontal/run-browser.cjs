'use strict';
// Real-browser (Chromium) check of built index.html against the independent oracles.
const fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const CO=require('./compact-oracle.cjs'),HO=require('./horizontal-oracle.cjs'),MA=require('/home/user/Training-tools/src/machine-accuracy.js');
const html=fs.readFileSync('/home/user/Training-tools/index.html');
const intText=v=>{const m=Math.round(Math.abs(v));return m===0?'0':(v<0?'-':'+')+m;};
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:1000},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://localhost:8765/**',r=>r.fulfill({contentType:'text/html',body:html}));await page.goto('http://localhost:8765/');
 const out={cases:[],errors,saveLoad:{}};let worst=0,textBad=0;
 const read=()=>page.evaluate(()=>({sq:[...document.querySelectorAll('.live-pair-error-value')].map(el=>({pair:el.closest('.live-squareness-item').querySelector('svg').dataset.pair,value:el.dataset.readingMicrons,text:el.textContent})),sw:[0,1,2,3].map(i=>({value:document.getElementById('sweepValue'+i).dataset.readingMicrons,text:document.getElementById('sweepValue'+i).textContent}))}));
 const cases=[
  {mi:0,seed:20261012,cfg:{width:2.08,depth:2.16,columnX:0,columnZ:0},state:{X:0,Y:0,Z:0},op:[.1,0,0,0]},
  {mi:0,seed:20261012,cfg:{width:2.08,depth:2.16,columnX:63,columnZ:-71},state:{X:81,Y:-94,Z:30},op:[0,0,0,-.08]},
  {mi:0,seed:7,cfg:{width:2.08,depth:2.16,columnX:0,columnZ:0},state:{X:100,Y:100,Z:0},op:[0,0,0,0]},
  {mi:0,seed:7,cfg:{width:2.08,depth:0.6,columnX:0,columnZ:0},state:{X:0,Y:0,Z:0},op:[0,0,0,0]},
  {mi:1,seed:20261012,cfg:{width:2.72,depth:3.68,columnX:0,columnZ:0},state:{X:0,Y:0,Z:0},op:[.1,0,0,0,0,0,0,0]},
  {mi:1,seed:424242,cfg:{width:2.72,depth:3.68,columnX:55,columnZ:-80},state:{X:70,Y:-60,Z:45},op:[0,0,0,-.08,0,0,0,0]},
  {mi:1,seed:7,cfg:{width:2.72,depth:1.0,columnX:0,columnZ:0},state:{X:0,Y:0,Z:0},op:[0,0,0,0,0,0,0,0]},
 ];
 for(const c of cases){
  const prof=MA.generate('used',c.seed,['X','Y','Z'],c.mi?8:4),sq={XY:prof.squareness.XY.microns,XZ:prof.squareness.XZ.microns,YZ:prof.squareness.YZ.microns};
  const heights=prof.initialHeights.map((h,i)=>Math.round((h+c.op[i])*1000)/1000);
  await page.evaluate(({c,prof,heights})=>{openMachine(machines[c.mi]);Object.assign(levelConfig,c.cfg);machineProfile=prof;supportHeights=heights;positions={...c.state,A:0,C:0};updateLeveling();},{c,prof,heights});
  const dom=await read(),row={case:c,heights,dom,oracle:{}};
  if(c.mi===0){
   const m=CO.model(c.cfg,heights,sq);
   for(const k of ['XY','XZ','YZ']){let o;try{const half=m.lz(.4);o=(k==='XY'&&2*half<.3)?null:CO.squareness(m,k,c.state).B.microns;}catch{o=null;}row.oracle[k]=o;const d=dom.sq.find(q=>q.pair===k);
    if(o===null){if(d.text!=='—')textBad++;}else{worst=Math.max(worst,Math.abs(Number(d.value)-o));if(d.text!==intText(o))textBad++;}}
   const sw=CO.sweep(m,c.state).B;row.oracle.sweep=sw.map(p=>({raw:p.microns,onTable:p.onTable}));
   sw.forEach((p,i)=>{const d=dom.sw[i],exp=p.onTable&&sw[3].onTable?intText(p.microns):!p.onTable?'面外':'—';if(d.text!==exp)textBad++;if(d.value)worst=Math.max(worst,Math.abs(Number(d.value)-p.microns));});
  }else{
   const m=HO.model(c.cfg,heights,sq);
   for(const k of ['XY','XZ','YZ']){const o=HO.squareness(m,k,c.state).B,d=dom.sq.find(q=>q.pair===k);row.oracle[k]=o.valid?o.microns:null;if(!o.valid){if(d.text!=='—')textBad++;}else{worst=Math.max(worst,Math.abs(Number(d.value)-o.microns));if(d.text!==intText(o.microns))textBad++;}}
   const p=HO.parallelism(m,c.state);['a','b'].forEach((ch,i)=>{const o=p.valid===false?null:p[ch],d=dom.sw[i];row.oracle[ch]=o?.valid?o.microns:null;if(!o?.valid){if(d.text!=='—')textBad++;}else{worst=Math.max(worst,Math.abs(Number(d.value)-o.microns));if(d.text!==intText(o.microns))textBad++;}});
  }
  out.cases.push(row);
 }
 out.worstRawDiffMicrons=worst;out.textMismatches=textBad;
 // real download -> upload round trip and old-ID upload (horizontal)
 for(const mi of [0,1]){
  const prof=MA.generate('used',20261012,['X','Y','Z'],mi?8:4);
  await page.evaluate(({mi,prof})=>{openMachine(machines[mi]);machineProfile=prof;supportHeights=prof.initialHeights.map((h,i)=>i===1?Math.round((h-.031)*1000)/1000:h);positions={X:35,Y:-20,Z:60,A:0,C:0};updateLeveling();},{mi,prof});
  const before=await read();
  const dl=page.waitForEvent('download');await page.evaluate(()=>$('exportLevel').onclick());const file=await (await dl).path(),saved=JSON.parse(fs.readFileSync(file,'utf8'));
  await page.evaluate(()=>{supportHeights=supportHeights.map(()=>0.02);positions={X:0,Y:0,Z:0,A:0,C:0};updateLeveling();});
  const disturbed=await read();
  await page.locator('#importLevel').setInputFiles({name:'saved.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
  await page.waitForFunction(()=>/読み込みました|読込できません/.test($('levelInputMessage').textContent));
  const after=await read(),msg=await page.evaluate(()=>$('levelInputMessage').textContent);
  await page.evaluate(()=>{$('levelInputMessage').textContent='';});
  const old={...saved,calculationModel:mi?'horizontal-guide-v2':'compact-asymmetric-bending-v3'};
  await page.locator('#importLevel').setInputFiles({name:'old.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(old))});
  await page.waitForFunction(()=>/読み込みました|読込できません/.test($('levelInputMessage').textContent));
  const rej=await read(),rejMsg=await page.evaluate(()=>$('levelInputMessage').textContent);
  out.saveLoad[mi?'horizontal':'compact']={calculationModel:saved.calculationModel,roundTrip:JSON.stringify(before)===JSON.stringify(after),changedWhenDisturbed:JSON.stringify(before)!==JSON.stringify(disturbed),importMessage:msg,oldId:old.calculationModel,rejectMessage:rejMsg,unchangedAfterReject:JSON.stringify(after)===JSON.stringify(rej),before,after};
 }
 await browser.close();
 fs.writeFileSync(__dirname+'/results-browser.json',JSON.stringify(out,null,1));
 console.log(JSON.stringify({worst:out.worstRawDiffMicrons,textBad:out.textMismatches,errors,saveLoad:Object.fromEntries(Object.entries(out.saveLoad).map(([k,v])=>[k,{...v,before:undefined,after:undefined}])),cases:out.cases.map(r=>({c:[r.case.mi,r.case.state,r.case.cfg.depth],dom:r.dom,oracle:r.oracle}))},null,0));
})().catch(e=>{console.error(e);process.exit(1);});

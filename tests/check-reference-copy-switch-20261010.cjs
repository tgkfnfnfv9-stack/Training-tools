'use strict';
// Regression for the reproduced reference-copy leak: real machine switches must
// restore the five untouched machines and retain the lathe accessibility hide.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{chromium}=require('playwright');
const before=fs.readFileSync(process.env.BEFORE_HTML||'/tmp/reaudit-live-ui-index.html'),after=fs.readFileSync('index.html');
const sequence=['horizontal','vertical','lathe','travel','horizontal','gate','lathe','gantry','horizontal','five','lathe','horizontal','vertical'];
const out='docs/qa-motion-reference-20261010/reference-copy-switch.json',checks=[],states=[];
const check=(name,ok,detail)=>checks.push({name,ok,...(detail===undefined?{}:{detail})});
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 for(const [tag,html] of [['before',before],['after',after]]){
  const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('http://reference-copy.local/**',r=>r.fulfill({contentType:'text/html',body:html}));
  await page.goto('http://reference-copy.local/');await page.locator('#mechanical').click();await page.locator('#leveling').click();
  for(const [index,kind] of sequence.entries()){
   if(index)await page.locator('#changeMachine').click();
   await page.locator('#machineGrid .machine-card').filter({has:page.locator('#thumb-'+kind)}).click();
   await page.locator('#measurementReferenceToggle').click();
   const read=()=>page.evaluate(()=>({intros:[...document.querySelectorAll('#measurementReference>.reference-intro')].map(e=>({text:e.textContent,display:getComputedStyle(e).display})),note:{text:$('squarenessValuesNote').textContent,hidden:$('squarenessValuesNote').hidden,display:getComputedStyle($('squarenessValuesNote')).display}}));
   const state={tag,index,kind,...await read()};states.push(state);
   if(tag==='after'){
    if(!['horizontal','lathe'].includes(kind)){
     const original=states.find(s=>s.tag==='before'&&s.index===index);
     check(`${index} ${kind}: original reference text and note restored`,JSON.stringify({intros:state.intros,note:state.note})===JSON.stringify({intros:original.intros,note:original.note}));
    }else if(kind==='horizontal'){
     const intro=state.intros.map(s=>s.text).join(' ');
     check(`${index} horizontal: current mounts and movement`,intro.includes('パレット上の直角マスタ')&&intro.includes('主軸頭固定')&&intro.includes('XYは頭をY＋')&&intro.includes('XZ/YZはパレットとマスタをZ＋')&&intro.includes('マスタから見て手前'));
     check(`${index} horizontal: finite fixture, R alignment and zero`,intro.includes('320×320 mm・厚み50 mm')&&intro.includes('XY/XZはX、YZはYへ300 mm')&&intro.includes('両端等指示')&&intro.includes('S用の腕へ付け替えて始点ゼロ')&&intro.includes('途中は再ゼロしません'));
     check(`${index} horizontal: obsolete visible/shared wording absent`,!/(精密フランジ|幅50 mmの仮想校正面|reference-scan-v3|他の走査は姿勢一定)/.test(intro+' '+state.note.text));
     check(`${index} horizontal: screenreader note available`,!state.note.hidden&&state.note.display!=='none');
    }else{
     check(`${index} lathe: generic reference intro hidden`,state.intros.every(s=>s.display==='none'));
     check(`${index} lathe: obsolete screenreader note hidden`,state.note.hidden&&state.note.display==='none');
    }
   }
   await page.locator('#closeMeasurementReference').click();
   if(kind==='lathe'){
    await page.locator('#raiseSupport').click();const changed=await read();
    if(tag==='after')check(`${index} lathe: support update preserves note hide`,changed.note.hidden&&changed.note.display==='none');
   }
  }
  check(`${tag}: no browser exceptions`,errors.length===0,errors);await page.close();
 }
 await browser.close();
 const report={beforeSha256:crypto.createHash('sha256').update(before).digest('hex'),afterSha256:crypto.createHash('sha256').update(after).digest('hex'),states,checks,failed:checks.filter(c=>!c.ok)};
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify({states:states.length,checks:checks.length,failed:report.failed}));if(report.failed.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});

'use strict';
// Regression for the reproduced reference-copy leak: real machine switches must
// restore the five untouched machines and retain the lathe accessibility hide.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),zlib=require('zlib'),{chromium}=require('playwright');
const beforePath=process.env.BEFORE_HTML||'docs/qa-horizontal-fixture-20261010/before/index.html.gz',beforeBytes=fs.readFileSync(beforePath),before=beforePath.endsWith('.gz')?zlib.gunzipSync(beforeBytes):beforeBytes,after=fs.readFileSync('index.html');
const sequence=['horizontal','vertical','lathe','travel','horizontal','gate','lathe','gantry','horizontal','five','lathe','horizontal','vertical'];
const out=process.env.TT_REPORT||'docs/qa-horizontal-fixture-20261010/reference-copy-switch.json',checks=[],states=[];
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
   const read=()=>page.evaluate(()=>{
    const el=$('squarenessMeasurementNote'),svg=document.querySelector('#liveSquareness svg[data-pair="YZ"]');
    return {intros:[...document.querySelectorAll('#measurementReference>.reference-intro')].map(e=>({text:e.textContent,display:getComputedStyle(e).display})),note:{text:$('squarenessValuesNote').textContent,hidden:$('squarenessValuesNote').hidden,display:getComputedStyle($('squarenessValuesNote')).display},scanNote:{text:el.textContent,display:getComputedStyle(el).display},yz:current.kind==='horizontal'?{setup:referenceSetup({key:'YZ'}),cardText:document.querySelector('[data-reference-pair="YZ"]').textContent,aria:svg.getAttribute('aria-label'),describedBy:svg.getAttribute('aria-describedby'),data:{...svg.dataset},diagram:svg.innerHTML}:null};
   });
   const state={tag,index,kind,...await read()};states.push(state);
   if(tag==='after'){
    if(!['horizontal','lathe'].includes(kind)){
     const original=states.find(s=>s.tag==='before'&&s.index===index);
     check(`${index} ${kind}: original reference text and both notes restored`,JSON.stringify({intros:state.intros,note:state.note,scanNote:state.scanNote})===JSON.stringify({intros:original.intros,note:original.note,scanNote:original.scanNote}));
    }else if(kind==='horizontal'){
     const intro=state.intros.map(s=>s.text).join(' ');
     check(`${index} horizontal: current mounts and movement`,intro.includes('テーブル（パレット）上の直角マスタ')&&intro.includes('主軸側へ固定')&&intro.includes('XY/YZは主軸頭をY＋')&&intro.includes('XZはパレットとマスタをZ＋')&&intro.includes('マスタから見て手前'));
     check(`${index} horizontal: finite fixture, R alignment, return and zero`,intro.includes('320×320 mm・厚み50 mm')&&intro.includes('XY/XZが主軸側計器のX送り')&&intro.includes('YZが計器を止めたパレットのZ送り')&&intro.includes('両端を等指示')&&intro.includes('選択Z位置へ戻し')&&intro.includes('Y区間始点でゼロ')&&intro.includes('途中は再ゼロしません'));
     check(`${index} horizontal: R endpoints also align the thickness centreline`,intro.includes('R走査の両端で測定子が厚み50 mmの中央線を通るよう横方向も合わせ')&&state.scanNote.text.includes('両端の測定子が厚み50 mmの中央線を通るよう横方向も合わせ')&&state.yz.cardText.includes('R走査両端で厚み50 mmの中央線を通るよう横方向も合わせ'));
     const setup=state.yz.setup;
     check(`${index} horizontal: YZ reference Z, head scan Y and spindle-side contact`,setup.base==='Z'&&setup.scan==='Y'&&setup.owner==='body'&&setup.mount==='パレット'&&setup.body==='主軸側'&&setup.normalDirection==='奥'&&setup.memberSign===1&&setup.relativeDirection==='上'&&setup.zeroLocation==='下・奥側');
     check(`${index} horizontal: YZ top R, lower zero and upwards relative scan`,state.yz.diagram.includes('>YZ</text>')&&!state.yz.diagram.includes('>ZY</text>')&&state.yz.diagram.includes('M3,11H23')&&state.yz.diagram.includes('cx="23" cy="31"')&&state.yz.diagram.includes('M61,31L61,14')&&state.yz.data.viewRight==='奥'&&state.yz.data.viewUp==='上');
     check(`${index} horizontal: accessible ownership and YZ sequence match visible instructions`,state.yz.aria.includes('計器は主軸側に固定')&&state.yz.describedBy==='squarenessMeasurementNote'&&state.scanNote.text.includes('YZのR合わせでは上面')&&state.scanNote.text.includes('選択したZ位置へ戻し')&&state.scanNote.text.includes('主軸頭のY＋送りで下の●0から上へ')&&state.yz.cardText.includes('パレットをZ＋へ300 mm'));
     check(`${index} horizontal: obsolete visible/shared wording absent`,!/(精密フランジ|幅50 mmの仮想校正面|reference-scan-v3|他の走査は姿勢一定|XZ\/YZはパレット|YZはYへ300 mm|YZ 40 mm)/.test(intro+' '+state.note.text+' '+state.scanNote.text+' '+state.yz.cardText));
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

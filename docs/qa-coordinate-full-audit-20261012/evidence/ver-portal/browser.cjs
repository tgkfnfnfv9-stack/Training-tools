'use strict';
// Real Chromium read of the DOM display (product). Seed fixed via getRandomValues override.
const fs=require('fs'),{chromium}=require('/opt/node-tools/node_modules/playwright');
const OUT='/tmp/claude-0/-home-user-Training-tools/4989ebb2-0dd1-5f7d-84eb-5fc1dc0607ea/scratchpad/ver-portal';
const cases={travel:{positions:{X:-50,Y:0,Z:0},ops:[[3,.2],[2,-.15]]},gate:{positions:{X:30,Y:0,Z:0},ops:[[8,.2],[9,-.15]]},gantry:{positions:{X:40,Y:0,Z:0},ops:[[5,.2],[0,-.15]]}};
(async()=>{
 const html=fs.readFileSync('/home/user/Training-tools/index.html');
 const browser=await chromium.launch({args:['--no-sandbox']});const res={};
 for(const [id,cs] of Object.entries(cases)){
  const p=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{const o=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=v=>{if(v instanceof Uint32Array&&v.length===1){v[0]=20261012;return v;}return o(v);};});
  await p.route('http://portal-audit.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
  await p.goto('http://portal-audit.test/');
  await p.evaluate(id=>{navigate('catalog');},id);
  const names={travel:'立形・移動コラム',gate:'固定門形・L3 3000',gantry:'移動門形・ガントリー'};
  await p.locator('.machine-card',{hasText:names[id]}).first().click();
  for(const k of ['X','Y','Z']){await p.evaluate(([k,v])=>{const el=document.getElementById('axis-'+k);el.value=String(v);el.dispatchEvent(new Event('input'));},[k,cs.positions[k]]);}
  const read=()=>p.evaluate(()=>({seed:machineProfile.seed,heights:[...supportHeights],positions:{...positions},sq:[...document.querySelectorAll('#liveSquareness .live-pair-error-value')].map(e=>({text:e.textContent,raw:e.dataset.readingMicrons})),sweep:[0,1,2,3].map(i=>({label:document.getElementById('sweepLabel'+i).textContent,text:document.getElementById('sweepValue'+i).textContent,raw:document.getElementById('sweepValue'+i).dataset.readingMicrons}))}));
  const before=await read();
  for(const [i,d] of cs.ops)await p.evaluate(([i,d])=>setSupportHeight(i,Math.round((supportHeights[i]+d)*1000)/1000),[i,d]);
  const after=await read();res[id]={before,after,errors};await p.close();
 }
 await browser.close();fs.writeFileSync(OUT+'/browser-results.json',JSON.stringify(res,null,1));
 for(const [id,r] of Object.entries(res))console.log(id,'seed',r.before.seed,'\n before',r.before.sq.map(q=>q.text+'('+(+q.raw).toFixed(4)+')').join(' '),'| sweep',r.before.sweep.map(q=>q.text).join(' '),'\n after ',r.after.sq.map(q=>q.text+'('+(+q.raw).toFixed(4)+')').join(' '),'| sweep',r.after.sweep.map(q=>q.text).join(' '),'errors',r.errors.length);
})().catch(e=>{console.error(e);process.exitCode=1;});

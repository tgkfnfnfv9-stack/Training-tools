const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const dir=__dirname,repo=path.resolve(dir,'../../..'),baseHtml=path.resolve(dir,'../before-index.html');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const kinds=['compact','horizontal','travel','double','gantry','five','lathe'];
// Physical orientation expectations written from the machine structure audit,
// independent of referenceSetup / drawing-function labels.
const views={compact:{XY:['右','奥','奥'],XZ:['右','上','下'],YZ:['奥','上','下']},travel:{XY:['右','奥','奥'],XZ:['右','上','下'],YZ:['奥','上','下']},five:{XY:['右','奥','奥'],XZ:['右','上','下'],YZ:['奥','上','下']},horizontal:{XY:['右','上','上'],XZ:['右','奥','手前'],YZ:['上','奥','手前']},double:{XY:['奥','右','右'],XZ:['奥','上','下'],YZ:['右','上','下']},gantry:{XY:['奥','右','右'],XZ:['奥','上','下'],YZ:['右','上','下']},lathe:{XZ:['右','奥','手前']}};
const sizes=[['pc',1440,1000],['mobile',390,844],['narrow',320,568],['short-landscape',568,320]];
const out={date:new Date().toISOString(),beforeSha:sha(baseHtml),afterSha:sha(repo+'/index.html'),layouts:[],checks:[],pageErrors:[],screenshots:[],sweepFrontOut:[]};
const check=(name,pass,details)=>out.checks.push({name,pass,...(details===undefined?{}:{details})});
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
async function setup(page,kind){await page.evaluate(kind=>{localStorage.clear();openMachine(machines.find(m=>m.kind===kind));initializeMachineAccuracy(MachineAccuracy.generate('used',78129,current.kind==='lathe'?['X','Z']:['X','Y','Z'],supports.length));positions={X:0,Y:0,Z:0,A:0,C:0};supportHeights=supports.map((s,i)=>[.025,-.012,.018,-.009,.005,-.011][i%6]);updateAxisValues();updateLeveling();},kind);}
const snapshot=page=>page.evaluate(()=>({positions:{...positions},heights:[...supportHeights],local:levelGeometry.pairs.map(p=>({key:p.key,angle:p.deviationMicroradians})),readings:levelGeometry.pairs.map(p=>{const m=referenceScan(p);return {pair:p.key,valid:m.valid,microns:m.microns,reason:m.reason}}),sweep:supportsSpindleSweep()?spindleSweepGeometry().cardinal?.map(p=>({reading:p.readingMicrons,onTable:p.onTable})):null}));
const layout=page=>page.evaluate(()=>{
 const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
 const textBounds=e=>[...e.querySelectorAll('text')].map(t=>{const r=t.getBoundingClientRect();return{text:t.textContent,...box(t)}});
 return {size:{width:innerWidth,height:innerHeight},overflow:document.documentElement.scrollWidth-innerWidth,controls:Object.fromEntries(['scene','lowerSupport','raiseSupport','axisTabs','openTrainingMenu'].map(id=>[id,{...box(document.getElementById(id)),visible:document.getElementById(id).checkVisibility()}])),diagrams:[...document.querySelectorAll('.live-squareness-diagram')].map(e=>({pair:e.dataset.pair,box:box(e),data:{...e.dataset},text:e.textContent,textBounds:textBounds(e),svg:e.outerHTML,r:e.querySelector('.scan-r-label')?.textContent,s:e.querySelector('.scan-s-label')?.textContent,zero:{x:Number(e.querySelector('.scan-zero').getAttribute('cx')),y:Number(e.querySelector('.scan-zero').getAttribute('cy'))},contact:{x:Number(e.querySelector('.scan-contact').getAttribute('cx')),y:Number(e.querySelector('.scan-contact').getAttribute('cy'))},move:e.querySelector('.scan-move').getAttribute('d'),probe:e.querySelector('.scan-probe').getAttribute('d')}))};
});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 async function newPage(html,label){const p=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:2,acceptDownloads:true});p.on('pageerror',e=>out.pageErrors.push({label,error:e.message}));await p.route('http://fix.audit/**',r=>r.fulfill({body:fs.readFileSync(html),contentType:'text/html'}));await p.goto('http://fix.audit/');return p;}
 const before=await newPage(baseHtml,'before'),after=await newPage(repo+'/index.html','after');
 for(const kind of kinds){
  await setup(before,kind);await setup(after,kind);
  const oldState=await snapshot(before),baseline=await snapshot(after);
  check(kind+' local angular metric unchanged',eq(oldState.local,baseline.local));
  check(kind+' supports and positions unchanged',eq(oldState.heights,baseline.heights)&&eq(oldState.positions,baseline.positions));
  for(const [size,width,height]of sizes){
   await before.setViewportSize({width,height});await after.setViewportSize({width,height});
   await Promise.all([before.waitForTimeout(130),after.waitForTimeout(130)]);
   const a=await layout(before),b=await layout(after);out.layouts.push({kind,size,before:a,after:b});
   const diffs=[];for(const id of Object.keys(a.controls))for(const key of ['x','y','width','height'])if(Math.abs(a.controls[id][key]-b.controls[id][key])>1.01)diffs.push({id,key,before:a.controls[id][key],after:b.controls[id][key]});
   check(kind+'/'+size+' critical UI dimensions unchanged',!diffs.length,diffs);
   check(kind+'/'+size+' critical controls visible',Object.values(b.controls).every(c=>c.visible&&c.x>=-.5&&c.y>=-.5&&c.right<=width+.5&&c.bottom<=height+.5)&&b.overflow<=1,b.controls);
   const legacy=['projection','zeroLocation','positiveDirection','negativeDirection','tipX','tipY','gain','currentError300','deviation'];
   check(kind+'/'+size+' no legacy local attributes',b.diagrams.every(d=>legacy.every(k=>!(k in d.data))),b.diagrams.map(d=>({pair:d.pair,legacy:legacy.filter(k=>k in d.data)})));
   check(kind+'/'+size+' explicit R/S and physical developed directions',b.diagrams.every(d=>{const [right,up,relative]=views[kind][d.pair];return d.s==='S'&&(kind==='lathe'?!d.r:d.r==='R')&&d.data.viewRight===right&&d.data.viewUp===up&&d.data.relativeDirection===relative&&d.text.includes('↑'+up);}),b.diagrams.map(d=>({pair:d.pair,r:d.r,s:d.s,data:d.data})));
   check(kind+'/'+size+' zero/contact/relative arrow consistent',b.diagrams.every(d=>{const y0=d.pair==='XY'?31:14,y1=d.pair==='XY'?14:31;return d.zero.x===23&&d.zero.y===y0&&d.contact.x===23&&Math.abs(d.contact.y-y1)<.02&&d.move.startsWith('M61,'+y0+'L61,'+y1)&&d.probe.startsWith('M23,');}),b.diagrams.map(d=>({pair:d.pair,zero:d.zero,contact:d.contact,move:d.move})));
   check(kind+'/'+size+' diagram text inside SVG',b.diagrams.every(d=>d.textBounds.every(t=>t.x>=d.box.x-.6&&t.right<=d.box.right+.6&&t.y>=d.box.y-.6&&t.bottom<=d.box.bottom+.6)),b.diagrams.map(d=>({pair:d.pair,outside:d.textBounds.filter(t=>!(t.x>=d.box.x-.6&&t.right<=d.box.right+.6&&t.y>=d.box.y-.6&&t.bottom<=d.box.bottom+.6))})));
   const screenshot=kind+'-'+size+'.png';await after.screenshot({path:dir+'/'+screenshot});out.screenshots.push(screenshot);
   if(size==='pc'){const items=after.locator('.live-squareness-item');for(let i=0;i<await items.count();i++){const item=items.nth(i),pair=await item.locator('svg').getAttribute('data-pair');await item.screenshot({path:dir+'/'+kind+'-'+pair+'-live.png'});}}
  }
  await after.setViewportSize({width:1440,height:1000});
  await after.evaluate(()=>{yaw+=.63;sceneZoom=1.7;document.getElementById('exaggerate').checked=false;updateLeveling();});
  check(kind+' view invariant',eq(await snapshot(after),baseline));
  await after.evaluate(()=>{changeSupportHeight(0,.01);changeSupportHeight(0,-.01);});
  check(kind+' support roundtrip',eq(await snapshot(after),baseline));
  const dl=before.waitForEvent('download');await before.evaluate(()=>document.getElementById('exportLevel').click());const downloaded=await dl;const oldSave=dir+'/'+kind+'-before-state.json';await downloaded.saveAs(oldSave);
  await after.evaluate(()=>{changeSupportHeight(0,.01);positions.X=53;updateLeveling();document.getElementById('levelSaveStatus').textContent='';});await after.locator('#importLevel').setInputFiles(oldSave);await after.waitForFunction(()=>document.getElementById('levelSaveStatus').textContent.includes('読み込みました'));
  check(kind+' old JSON imports and reproduces state',eq(await snapshot(after),baseline));
  const newDl=after.waitForEvent('download');await after.evaluate(()=>document.getElementById('exportLevel').click());const newDownload=await newDl;const newSave=dir+'/'+kind+'-after-state.json';await newDownload.saveAs(newSave);
  await after.evaluate(()=>{changeSupportHeight(0,-.01);positions.X=-37;updateLeveling();document.getElementById('levelSaveStatus').textContent='';});await after.locator('#importLevel').setInputFiles(newSave);await after.waitForFunction(()=>document.getElementById('levelSaveStatus').textContent.includes('読み込みました'));
  check(kind+' new JSON export/import reproduces state',eq(await snapshot(after),baseline));
  if(kind==='five'){
   for(const state of [{A:20,C:0},{A:0,C:20},{A:20,C:35}]){await after.evaluate(state=>{positions={X:0,Y:0,Z:0,A:0,C:0,...state};updateLeveling();},state);check('five pose '+JSON.stringify(state)+' suppresses linear scans',(await snapshot(after)).readings.every(m=>!m.valid));}
   await after.evaluate(()=>{positions={X:0,Y:0,Z:0,A:0,C:0};updateLeveling();});check('five zero pose restores',eq(await snapshot(after),baseline));
  }
  if(['compact','travel','double','gantry','five'].includes(kind)){
   const result=await after.evaluate(()=>{
    const inspect=()=>({positions:{...positions},frontOn:spindleSweepGeometry().cardinal?.[3].onTable,values:[0,1,2,3].map(i=>({text:document.getElementById('sweepValue'+i).textContent,raw:document.getElementById('sweepValue'+i).getAttribute('data-reading-microns')}))});
    for(const X of [-100,0,100])for(const Y of [-100,0,100]){positions={X,Y,Z:0,A:0,C:0};updateLeveling(false);const r=inspect();if(r.frontOn===false)return {physical:true,...r};}
    // A rendering-only injected flag checks propagation when no real tested position leaves the surface.
    const original=spindleSweepGeometry;spindleSweepGeometry=function(...args){const r=original(...args);return r.valid?{...r,cardinal:r.cardinal.map((p,i)=>i===3?{...p,onTable:false}:p)}:r};updateSpindleSweep();const result={physical:false,...inspect()};spindleSweepGeometry=original;updateSpindleSweep();return result;
   });out.sweepFrontOut.push({kind,...result});check(kind+' front-out suppresses all four DOM numbers',result.frontOn===false&&result.values.every(v=>v.raw===''&&!/[0-9]/.test(v.text)),result);
  }else check(kind+' has no new four-direction dial',await after.evaluate(()=>document.getElementById('spindleSweepPanel').hidden));
 }
 await browser.close();fs.writeFileSync(dir+'/results.json',JSON.stringify(out,null,2));console.log(JSON.stringify({checks:out.checks.length,failures:out.checks.filter(c=>!c.pass).map(c=>({name:c.name,details:c.details})),pageErrors:out.pageErrors,sweepFrontOut:out.sweepFrontOut},null,2));
})().catch(e=>{fs.writeFileSync(dir+'/error.txt',e.stack);console.error(e);process.exitCode=1});

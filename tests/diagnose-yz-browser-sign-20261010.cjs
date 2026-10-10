'use strict';
// Read-only real-browser audit. Fixed fetched public/PR HTML; real support clicks.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),zlib=require('zlib'),{chromium}=require('playwright');
const root=path.resolve('docs/qa-yz-sign-recheck-20261010/browser');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 for(const candidate of (process.env.CANDIDATES||'public,pr').split(',')){
  const out=path.join(root,candidate),html=fs.existsSync(path.join(out,'index.html'))?fs.readFileSync(path.join(out,'index.html')):zlib.gunzipSync(fs.readFileSync(path.join(out,'index.html.gz'))),page=await browser.newPage({viewport:{width:1280,height:1000},reducedMotion:'reduce'}),states=[],errors=[];
  await page.route('http://audit.test/**',r=>r.fulfill({contentType:'text/html',body:html}));page.on('pageerror',e=>errors.push(e.message));
  const init=async profile=>{await page.goto('http://audit.test/');await page.evaluate(profile=>{openMachine(machines.find(m=>m.kind==='horizontal'));machineProfile=profile==='ideal'?null:MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length);machineReference=null;machineSavedBest=null;positions={X:0,Y:0,Z:0,A:0,C:0};supportHeights=supports.map(()=>0);selected=0;updateAxisValues();updateLeveling(false);},profile);};
  const read=async(name,profile,shot=false)=>{
   const data=await page.evaluate(()=>{
    const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((r,v,i)=>r+v*b[i],0),norm=a=>Math.hypot(...a),unit=a=>a.map(v=>v/norm(a));
    // Independent plane-line intersection from captured poses, no contact()/compare().
    const extension=p=>dot(unit(p.normal),sub(p.point,p.body))/dot(unit(p.normal),unit(p.probe));
    const g=geometryModel(),measurements=g.pairs.map(pair=>{
     const m=referenceDisplayScan(pair),svg=document.querySelector('#liveSquareness svg[data-pair="'+pair.key+'"]'),graph=svg.querySelector('.scan-geometry'),probe=svg.querySelector('.scan-probe'),body=svg.querySelector('.scan-body'),p=probe.getAttribute('d').match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi).map(Number),visualLength=Math.hypot(p[2]-p[0],p[3]-p[1]);
     const ext0=extension(m.start),ext1=extension(m.end),expect=(ext0-ext1)*1e6;
     return {key:pair.key,valid:m.valid,raw:m.microns,integer:document.querySelector('#liveSquareness .live-pair-values[data-pair="'+pair.key+'"] .live-pair-error-value').textContent,independentMicrons:expect,independentExtensionStart:ext0,independentExtensionEnd:ext1,model:m.model,setup:m.setup,diagram:{viewRight:svg.dataset.viewRight,viewUp:svg.dataset.viewUp,probe:p,probeLength:visualLength,initialProbeLength:11,lengthChange:visualLength-11,bodyX:Number(body.getAttribute('x')),bodyY:Number(body.getAttribute('y')),geometry:{...graph.dataset},zero:{x:svg.querySelector('.scan-zero').getAttribute('cx'),y:svg.querySelector('.scan-zero').getAttribute('cy')},contact:{x:svg.querySelector('.scan-contact').getAttribute('cx'),y:svg.querySelector('.scan-contact').getAttribute('cy')},move:svg.querySelector('.scan-move').getAttribute('d'),press:svg.querySelector('.scan-press').getAttribute('d'),master:svg.querySelector('.scan-master').getAttribute('d'),reference:svg.querySelector('.scan-reference-face')?.getAttribute('d')},start:m.start,end:m.end,zero:m.zero,last:m.last,master:m.master,alongStart:m.alongStart,alongEnd:m.alongEnd,alignment:m.alignment?{start:m.alignment.samples[0],end:m.alignment.samples.at(-1),microns:m.alignment.microns}:null};
    });
    return {positions:{...positions},profile:machineProfile,selected,supports:supports.map((s,i)=>({...s,height:supportHeights[i]})),measurements};
   });states.push({name,profile,...data});if(shot){await page.screenshot({path:path.join(out,name+'.png')});await page.locator('#liveSquareness').screenshot({path:path.join(out,name+'-diagrams.png')});}return data;
  };
  for(const profile of ['ideal','used']){
   await init(profile);const flat=await read(profile+'-flat',profile,true);
   for(let i=0;i<flat.supports.length;i++)for(const [button,step] of [['fineAdjust',.001],['coarseAdjust',.01]]){
    await page.locator('#supportMap .map-point').nth(i).click();await page.locator('#'+button).click();
    for(const direction of ['raise','lower']){
     await page.locator('#'+direction+'Support').click();await read(`${profile}-support-${i}-${direction}-${step}`,profile,step===.01&&(i===1||i===4));await page.locator('#'+(direction==='raise'?'lower':'raise')+'Support').click();
    }
   }
  }
  const findings=[];for(const s of states)for(const m of s.measurements){if(Math.abs(m.raw-m.independentMicrons)>1e-6)findings.push({name:s.name,pair:m.key,type:'raw-contact-mismatch',raw:m.raw,independent:m.independentMicrons});if(Number(m.integer.replace('−','-'))!==Math.sign(m.raw)*Math.round(Math.abs(m.raw)))findings.push({name:s.name,pair:m.key,type:'integer-rounding',raw:m.raw,integer:m.integer});if(Math.abs(m.raw)>.01&&Math.sign(m.raw)===Math.sign(m.diagram.lengthChange)&&Math.abs(m.diagram.lengthChange)>1e-6)findings.push({name:s.name,pair:m.key,type:'diagram-length-sign',raw:m.raw,probeLengthDelta:m.diagram.lengthChange,limited:m.diagram.geometry.diagramLimited});}
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({candidate,sha256:crypto.createHash('sha256').update(html).digest('hex'),capturedAt:new Date().toISOString(),method:'Linux Chromium actual support map, coarse/fine, raise/lower buttons; profile and initial flat fixture via evaluate. Independent plane-line intersection uses captured endpoint poses, not independent posture.',errors,findings,states},null,2));
  fs.writeFileSync(path.join(out,'index.html.gz'),zlib.gzipSync(html));if(fs.existsSync(path.join(out,'index.html')))fs.unlinkSync(path.join(out,'index.html'));console.log(JSON.stringify({candidate,states:states.length,findings,errors}));await page.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});

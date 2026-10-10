'use strict';
// Real Chromium captures; the before tree is immutable. After HTML is assembled
// in memory from source so this task does not overwrite the integrated artifact.
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const mode=process.argv[2]||'after',root=path.resolve(__dirname,'..'),source=mode==='before'?'/workspace/Training-tools-before':root;
const out=path.join(root,'docs/qa-posture-20261009/structure',mode);fs.mkdirSync(out,{recursive:true});
let html=fs.readFileSync(path.join(source,'src/index.html'),'utf8').replace('<!-- TESTER_LESSON -->',fs.readFileSync(path.join(source,'src/tester.html'),'utf8'));
html=html.replace(/<link rel="stylesheet" href="([^"]+)">/g,(_,file)=>'<style>'+fs.readFileSync(path.join(source,'src',file),'utf8')+'</style>').replace(/<script src="([^"]+)"><\/script>/g,(_,file)=>'<script>'+fs.readFileSync(path.join(source,'src',file),'utf8')+'</script>');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[],records=[];page.on('pageerror',e=>errors.push(String(e)));await page.route('http://posture.local/**',r=>r.fulfill({contentType:'text/html',body:html}));await page.goto('http://posture.local/');
 for(const id of ['horizontal','lathe'])for(const [name,pattern,widthScale,depthScale] of [['flat','flat',1,1],['positive-twist','positive',1,1],['negative-twist','negative',1,1],['plane','plane',1,1],['dimensions','positive',id==='horizontal'?2:1,id==='lathe'?2:1]]){
  await page.evaluate(({id,pattern,widthScale,depthScale})=>{openMachine(machines.find(m=>m.id===id));machineProfile=window.MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length);machineReference=null;levelConfig.width=current.w*.8*widthScale;levelConfig.depth=current.d*.8*depthScale;supportHeights=supports.map(p=>{const q=levelCoordinates(p.x,p.z);return pattern==='flat'?0:pattern==='plane'?.08*q.x+.06*q.z:(pattern==='negative'?-.05:.05)*q.x*q.z;});positions={X:0,Y:0,Z:0,A:0,C:0};updateLeveling(false);setSceneZoom(1.4);setSceneView('oblique');}, {id,pattern,widthScale,depthScale});
  await page.screenshot({path:path.join(out,`${id}-${name}.png`)});
  records.push({id,name,...await page.evaluate(()=>({heights:supportHeights,dimensions:levelConfig,positions,factor:displayFactor(),labels:createGeometry(current).labels.map(l=>({...l,world:displayedModelPoint(l.p,l.axes,current,positions,l.pose)})),lathe:current.kind==='lathe'?latheInspectionGeometry():null,horizontal:current.kind==='horizontal'?horizontalParallelism():null}))});
 }
 fs.writeFileSync(path.join(out,'observations.json'),JSON.stringify({mode,records,errors},null,2));await browser.close();if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({mode,captures:records.length,out}));
})().catch(e=>{console.error(e);process.exitCode=1;});

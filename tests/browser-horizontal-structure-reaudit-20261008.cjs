const fs=require('fs'),path=require('path'),{chromium}=require('playwright');
// Geometry-only browser capture: keep the starting HTML and replace only app.js.
// Prepare /tmp/structure-baseline-{app,index}-edda.{js,html} with git show first.
const root=path.resolve(__dirname,'..'), mode=process.argv[2]||'after', out=path.join(root,'docs/qa-horizontal-reaudit-20261008',mode);
const baselineHTML=fs.readFileSync('/tmp/structure-baseline-index-edda.html','utf8'),baselineApp=fs.readFileSync('/tmp/structure-baseline-app-edda.js','utf8');
const html=mode==='before'?baselineHTML:baselineHTML.replace(baselineApp,fs.readFileSync(root+'/src/app.js','utf8'));
fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),p=await browser.newPage({viewport:{width:1280,height:1000}});await p.route('http://localhost:8872/**',r=>r.fulfill({contentType:'text/html',body:html}));await p.goto('http://localhost:8872/');await p.evaluate(()=>{openMachine(machines[1]);machineProfile=null;machineReference=null;supportHeights=supports.map(()=>0);positions={X:0,Y:0,Z:0,A:0,C:0};updateLeveling(false);setSceneZoom(1.6);});
const data=[];
const slider=async(key,v)=>{await p.locator('#openTrainingMenu').click();await p.evaluate(()=>{$('axisMenuSection').open=true;});await p.locator('#drawerAxisSelect').selectOption(key);await p.locator('#axis-'+key).fill(String(v));await p.locator('#axis-'+key).dispatchEvent('input');await p.locator('#closeTrainingMenu').click();};
async function snap(name){await p.screenshot({path:path.join(out,'structure-'+name+'.png')});data.push({name,...await p.evaluate(()=>({positions:{...positions},heights:supportHeights,labels:createGeometry(current).labels.map(l=>({...l,world:displayedModelPoint(l.p,l.axes,current,positions,l.pose)})),arrows:axisIndicators(current,createGeometry(current)),squares:[...document.querySelectorAll('#liveSquareness .live-pair-error-value')].map(e=>e.dataset.readingMicrons),parallel:[0,1].map(i=>$('sweepValue'+i).dataset.readingMicrons)}))});}
await snap('central');for(const key of ['X','Y','Z']){for(const v of [-100,100]){await slider(key,v);for(const view of ['front','side','oblique']){await p.evaluate(view=>setSceneView(view),view);await snap(key+v+'-'+view);}}await slider(key,0);}
for(const v of [-100,100]){for(const key of ['X','Y','Z'])await slider(key,v);await p.evaluate(()=>setSceneView('oblique'));await snap('xyz'+v);}
for(const twist of [-.05,.05]){await p.evaluate(twist=>{supportHeights=supports.map(s=>twist*s.x*s.z);updateLeveling(false);},twist);for(const key of ['X','Y','Z'])await slider(key,100);await snap('twist'+twist+'-xyz100');}
await p.setViewportSize({width:390,height:844});await snap('mobile-twist-positive-xyz100');fs.writeFileSync(out+'/structure-states.json',JSON.stringify(data,null,2));await browser.close();console.log(JSON.stringify({states:data.length,dir:out}));})().catch(e=>{console.error(e);process.exitCode=1});

'use strict';
// Browser supplement: expectations from analytic material-point / ray-plane
// geometry, not rendering functions or production direction/sign lookup tables.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {chromium}=require('playwright');
const html=fs.readFileSync('index.html'),sha256=crypto.createHash('sha256').update(html).digest('hex');
const out='docs/qa-twist-audit-20261007/edge-cases';fs.mkdirSync(out,{recursive:true});
const results={sha256,checks:[],boundary:[],outOfFace:[],contact:[],errors:[]};
const check=(name,ok,data)=>results.checks.push({name,ok,...(data?{data}:{})});
const near=(a,b,t=1e-6)=>Number.isFinite(a)&&Math.abs(a-b)<=t;
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});results.browser=browser.version();const p=await browser.newPage({viewport:{width:1440,height:1100}});p.on('pageerror',e=>results.errors.push(e.message));await p.route('http://localhost:8766/**',r=>r.fulfill({contentType:'text/html',body:html}));await p.goto('http://localhost:8766/');
 await p.evaluate(()=>{localStorage.clear();openMachine(machines.find(m=>m.kind==='horizontal'));machineProfile=null;machineReference=null;machineSavedBest=null;positions={X:0,Y:0,Z:0,A:0,C:0};});
 const metadata=await p.evaluate(()=>({w:current.w,d:current.d,width:levelConfig.width,depth:levelConfig.depth,points:supports.map(s=>({...s,...levelCoordinates(s.x,s.z)}))}));
 const knots=[...new Set(metadata.points.map(q=>q.z))].sort((a,b)=>a-b),values=[.08,-.13,.16,-.05],sz=metadata.depth/(metadata.d*.8);
 function g(z){let i=0;while(i<knots.length-2&&z>=knots[i+1])i++;return (values[i]+(values[i+1]-values[i])*(z-knots[i])/(knots[i+1]-knots[i]))/1000;}
 const heights=metadata.points.map(q=>q.x*g(q.z)*1000);
 await p.evaluate(heights=>{supportHeights=heights;updateLeveling(false);},heights);
 const z0=-.85*sz,z1=z0+.3,theta0=Math.atan(g(z0)),theta1=Math.atan(g(z1)),delta=theta1-theta0,H=.61;
 const deltaP=[-H*(Math.sin(theta1)-Math.sin(theta0)),H*(Math.cos(theta1)-Math.cos(theta0)),.3];
 for(const pair of ['XZ','YZ']){
  const align=pair==='XZ'?Math.atan((g((metadata.d*.28-.13)*sz)+g((metadata.d*.28+.13)*sz))/2):Math.PI/2+Math.atan(g(metadata.d*.29*sz));
  const normal=[Math.cos(align+delta),Math.sin(align+delta),0];
  const expected=normal.reduce((sum,v,i)=>sum+v*deltaP[i],0)/Math.cos(delta)*1e6;
  const actual=await p.evaluate(pair=>referenceScan({key:pair}),pair),crossing=(knots[1]-z0)/.3,times=actual.samples.map(q=>q.t);
  check('horizontal '+pair+' analytic H=.61 finite scan',actual.valid&&near(actual.microns,expected),{actual:actual.microns,expected});
  check('horizontal '+pair+' support boundary and both sides sampled',times.some(t=>near(t,crossing,1e-12))&&times.some(t=>t<crossing&&crossing-t<1e-6)&&times.some(t=>t>crossing&&t-crossing<1e-6),{crossing,times});
  results.boundary.push({pair,knots,values,heights,z0,z1,H,theta0,theta1,expected,actual});
 }
 await p.screenshot({path:path.join(out,'horizontal-boundary.png')});
 const contact=await p.evaluate(()=>{
  const M=window.ReferenceMeasurement,scale=(n,s)=>n.map(v=>v*s),sum=(a,b)=>a.map((v,i)=>v+b[i]);
  const c=.0001,L=.3,z={point:[0,0,0],normal:[1,0,0],body:[.01,0,0],probe:[-1,0,0]},end={...z,body:[.01+c*L*L,L,0]},theta=Math.atan(2*c*L),normal=[Math.cos(theta),-Math.sin(theta),0],r0={point:[0,0,0],normal,body:scale(normal,.01),probe:scale(normal,-1)},r1={...r0,body:sum(r0.body,[-c*L*L,-L,0])};
  return {forward:M.compare(z,end),fixedReverse:M.compare(end,z),realignedReverse:M.compare(r0,r1),alignment:[-.0001,.0001].map(angle=>{const n=[Math.cos(angle),Math.sin(angle),0],a={point:[0,0,0],normal:n,body:scale(n,.01),probe:scale(n,-1)},b={...a,body:sum(a.body,[0,.3,0])};return {angle,result:M.compare(a,b)};})};
 });
 for(const [name,expected] of [['forward',-9],['fixedReverse',9],['realignedReverse',-9*Math.cos(Math.atan(.00006))]]){check('curved path '+name,contact[name].valid&&near(contact[name].microns,expected,1e-8),{expected,actual:contact[name].microns});results.contact.push({name,expected,result:contact[name]});}
 for(const a of contact.alignment){const expected=-.3*Math.sin(a.angle)*1e6;check('ideal guide master alignment '+a.angle,a.result.valid&&near(a.result.microns,expected,1e-8),{actual:a.result.microns,expected});results.contact.push({...a,expected});}
 for(const kind of ['compact','travel','double','gantry','five']){
  await p.evaluate(kind=>{localStorage.clear();openMachine(machines.find(m=>m.kind===kind));machineProfile=null;machineReference=null;machineSavedBest=null;supportHeights=supports.map(()=>0);positions={X:0,Y:0,Z:0,A:0,C:0};updateLeveling(false);},kind);
  const found=await p.evaluate(()=>{
   const original={...levelConfig};
   for(const small of [false,true]){
    if(small){levelConfig.width=.5;levelConfig.depth=.5;levelSolution=machineSolution(supportHeights);}
    for(const X of [-100,0,100])for(const Y of [-100,0,100])for(const Z of [-100,0,100]){
     const state={X,Y,Z,A:0,C:0},g=spindleSweepGeometry(state,levelSolution,null);if(g.valid&&!g.cardinal[3].onTable){positions=state;updateLeveling(false);return {kind:current.kind,smallDimensions:small,width:levelConfig.width,depth:levelConfig.depth,originalWidth:original.width,originalDepth:original.depth,state,cardinal:g.cardinal,halfWidth:g.halfWidth,halfDepth:g.halfDepth,text:[0,1,2,3].map(i=>$('sweepValue'+i).textContent),data:[0,1,2,3].map(i=>$('sweepValue'+i).getAttribute('data-reading-microns')),status:$('sweepContactStatus').textContent};}
    }
   }return null;
  });
  check(kind+' actual front-outside state found',!!found);if(found){check(kind+' all four values suppressed',found.data.every(v=>v===''),found);results.outOfFace.push(found);await p.screenshot({path:path.join(out,kind+'-front-outside.png')});}
 }
 // Public coarse/fine buttons and public raise/lower controls, actual clicks.
 await p.evaluate(()=>{localStorage.clear();openMachine(machines.find(m=>m.kind==='compact'));supportHeights=supports.map(()=>0);updateLeveling(false);});
 const initial=await p.evaluate(()=>supportHeights[selected]);await p.locator('#coarseAdjust').click();await p.locator('#raiseSupport').click();const coarse=await p.evaluate(()=>supportHeights[selected]);check('coarse actual button +0.01 mm',near(coarse-initial,.01,1e-12),{initial,coarse});await p.locator('#fineAdjust').click();await p.locator('#raiseSupport').click();const fine=await p.evaluate(()=>supportHeights[selected]);check('fine actual button +0.001 mm',near(fine-coarse,.001,1e-12),{coarse,fine});await p.locator('#lowerSupport').click();const lowered=await p.evaluate(()=>supportHeights[selected]);check('fine actual button -0.001 mm',near(lowered,fine-.001,1e-12),{fine,lowered});
 const aria=await p.evaluate(()=>({localNote:!!$('localSquarenessNote'),localDescription:$('accuracyDiagram').getAttribute('aria-describedby'),localModel:$('accuracyDiagram').getAttribute('data-diagram-model'),localScanCount:$('accuracyDiagram').querySelectorAll('.scan-geometry').length,finite:[...document.querySelectorAll('#liveSquareness svg')].map(e=>({description:e.getAttribute('aria-describedby'),model:e.getAttribute('data-measurement-model'),hasScan:!!e.querySelector('.scan-geometry')}))}));
 check('local angle SVG has its own accessible explanation',aria.localNote&&aria.localDescription==='localSquarenessNote'&&aria.localModel==='local-angle',aria);
 check('finite SVGs retain finite explanation and scan content only',aria.localScanCount===0&&aria.finite.length===3&&aria.finite.every(e=>e.description==='squarenessMeasurementNote'&&e.model==='reference-scan-v3'&&e.hasScan),aria);
 results.aria=aria;
 check('browser no JavaScript exceptions',results.errors.length===0,results.errors);await browser.close();fs.writeFileSync(path.join(out,'browser-edge-cases.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({sha256,checks:results.checks.length,passed:results.checks.filter(c=>c.ok).length,failures:results.checks.filter(c=>!c.ok),outOfFace:results.outOfFace.map(q=>({kind:q.kind,smallDimensions:q.smallDimensions,state:q.state}))},null,2));process.exitCode=results.checks.some(c=>!c.ok)?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});

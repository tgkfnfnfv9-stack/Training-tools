'use strict';
// Independent intrinsic oracle: PRNG stream is the saved seed contract; geometry
// is solved here with circle/ray intersections and a general least-squares solve.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{chromium}=require('playwright');
const phase=process.argv[2]||'before',source=path.resolve(process.argv[3]||(phase==='before'?'/workspace/Training-tools-before/index.html':'index.html'));
const output=path.resolve('docs/qa-all-measurements-20261011/intrinsic-save-audit',phase);fs.mkdirSync(output,{recursive:true});
const html=fs.readFileSync(source),sha256=crypto.createHash('sha256').update(html).digest('hex');
const result={phase,source,sha256,environment:'Linux Chromium /usr/bin/chromium; 390 × 844 and 1280 × 1000; not a real phone',checks:[],machines:[],errors:[]};
const check=(name,ok,detail)=>result.checks.push({name,ok,...(detail===undefined?{}:{detail})});
const near=(a,b)=>Math.abs(a-b)<1e-8;
function seedInputs(profile){
 let state=(profile.seed^0x49535031)>>>0;
 const rand=()=>{state=(state+0x6D2B79F5)>>>0;let n=state;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return ((n^(n>>>14))>>>0)/2**32;};
 const used=profile.condition==='used',radial=(lo,hi)=>{const r=lo+(hi-lo)*rand(),a=2*Math.PI*rand();return [r*Math.cos(a),r*Math.sin(a)];};
 return {eccentricity:radial(used?1:.5,used?6:2.5),tilt:radial(used?5:2,used?40:15),heights:Array.from({length:9},()=>((used?12:4)*(2*rand()-1)))};
}
function independentTir(e,t,z){
 const c=e.map((q,i)=>q+t[i]*z/1000),angle=-Math.atan2(c[1],c[0]);
 const hit=a=>{const x=c[0]*Math.cos(a)-c[1]*Math.sin(a),y=c[0]*Math.sin(a)+c[1]*Math.cos(a);return x+Math.sqrt(25000**2-y*y);};
 return Math.abs(hit(angle)-hit(angle+Math.PI));
}
const grid=[1,0,-1].flatMap(y=>[-1,0,1].map(x=>[1,x,y]));
function independentSurface(h){
 const augmented=[0,1,2].map(i=>[...Array.from({length:3},(_,j)=>grid.reduce((sum,p)=>sum+p[i]*p[j],0)),grid.reduce((sum,p,k)=>sum+p[i]*h[k],0)]);
 for(let k=0;k<3;k++){const pivot=augmented[k][k];for(let j=k;j<4;j++)augmented[k][j]/=pivot;for(let i=0;i<3;i++)if(i!==k){const f=augmented[i][k];for(let j=k;j<4;j++)augmented[i][j]-=f*augmented[k][j];}}
 const plane=augmented.map(row=>row[3]),residual=h.map((v,i)=>v-grid[i].reduce((sum,x,j)=>sum+x*plane[j],0));
 const values=residual.map(v=>v-residual[3]);return {values,range:Math.max(...values)-Math.min(...values)};
}
function oracle(profile){const input=seedInputs(profile),surface=independentSurface(input.heights);return {input,raw:[independentTir(input.eccentricity,input.tilt,0),independentTir(input.eccentricity,input.tilt,300),...surface.values,surface.range]};}
const signed=v=>Math.round(v)===0?'0':(Math.round(v)>0?'+':'')+Math.round(v);
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 page.on('pageerror',e=>result.errors.push(e.message));await page.route('http://intrinsic-audit.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 for(const id of ['vertical','horizontal','travel','gate','gantry','five','lathe']){
  await page.goto('http://intrinsic-audit.test/');
  await page.evaluate(id=>{openMachine(machines.find(m=>m.id===id));machineProfile=MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length);machineReference=null;machineSavedBest=null;supportHeights=supports.map(()=>0);positions={X:0,Y:0,Z:0,A:0,C:0};updateAxisValues();updateLeveling(false);},id);
  const capture=()=>page.evaluate(()=>{const d=IntrinsicInspection.fromProfile(machineProfile),lathe=current.kind==='lathe';const runoutValues=lathe?document.querySelector('#liveSquareness .lathe-inspection-columns section svg').querySelectorAll('text')[2].textContent.match(/[0-9]+/g):[...$('intrinsicRunoutDiagram').querySelectorAll('svg text')].map(t=>t.textContent.match(/[0-9]+/g).at(-1));const surfaceValues=lathe?[]:[...$('intrinsicSurfaceDiagram').querySelectorAll('svg text')].slice(2,11).map(t=>t.textContent).concat([...$('intrinsicSurfaceDiagram').querySelectorAll('svg text')].at(-1).textContent.match(/[0-9]+/g).at(-1));return {display:[...runoutValues,...surfaceValues],record:levelRecord(),profile:machineProfile,supports:[...supportHeights],selected,raw:[d.runout.rootMicrons,d.runout.tipMicrons,...d.surface.points.map(q=>q.microns),d.surface.rangeMicrons],runoutText:lathe?document.querySelector('#liveSquareness .lathe-inspection-columns section').innerText:$('intrinsicRunoutDiagram').textContent,surfaceText:lathe?null:$('intrinsicSurfaceDiagram').textContent,runoutSvg:lathe?document.querySelector('#liveSquareness .lathe-inspection-columns section svg').outerHTML:$('intrinsicRunoutDiagram').innerHTML,surfaceSvg:lathe?null:$('intrinsicSurfaceDiagram').innerHTML,modeText:$('intrinsicInspectionPage').innerText};});
  const baseline=await capture(),expect=oracle(baseline.profile),row={id,baseline,independent:expect,states:[],saveChecks:[]};result.machines.push(row);
  check(id+' intrinsic baseline matches independently derived geometry',baseline.raw.every((v,i)=>near(v,expect.raw[i])));
  check(id+' root and tip actual DOM integers',id==='lathe'?baseline.runoutText.includes('a '+Math.round(expect.raw[0])+'　b '+Math.round(expect.raw[1])):baseline.runoutText.includes('根元 '+Math.round(expect.raw[0]))&&baseline.runoutText.includes('300 mm先 '+Math.round(expect.raw[1])));
  if(id!=='lathe'){
   const texts=await page.locator('#intrinsicSurfaceDiagram svg text').allTextContents();
   check(id+' nine actual DOM integers and range',expect.raw.slice(2,11).every((v,i)=>texts[i+2]===signed(v))&&texts.at(-1)==='差 '+Math.round(expect.raw[11]),texts);
   await page.locator('#inspectionNext').click();
  }
  for(const width of [390,1280]){await page.setViewportSize({width,height:width===390?844:1000});await page.screenshot({path:path.join(output,id+'-intrinsic-'+width+'.png')});}
  await page.setViewportSize({width:390,height:844});
  for(let i=0;i<baseline.supports.length;i++){
   await page.locator('#supportMap .map-point').nth(i).click();
   for(const [button,step] of [['coarseAdjust',.01],['fineAdjust',.001]]){
    await page.locator('#'+button).click();
    for(const direction of ['raise','lower']){
     await page.locator('#'+direction+'Support').click();const state=await capture();
     row.states.push({support:i,step,direction,heights:state.supports,raw:state.raw,display:state.display,runoutText:state.runoutText,surfaceText:state.surfaceText,independent:expect.raw,delta:state.raw.map((v,k)=>v-baseline.raw[k])});
     check(id+' support '+i+' '+step+' '+direction+' invariant definition',JSON.stringify(state.raw)===JSON.stringify(baseline.raw)&&state.runoutSvg===baseline.runoutSvg&&state.surfaceSvg===baseline.surfaceSvg);
     check(id+' support '+i+' '+step+' '+direction+' input reached',near(state.supports[i],direction==='raise'?step:0));
    }
   }
  }
  // Nonzero axes, size and camera do not enter the intrinsic definition.
  await page.evaluate(()=>{positions.X=100;positions.Y=-100;positions.Z=50;positions.A=70;positions.C=-55;levelConfig.width*=1.1;levelConfig.depth*=.9;updateAxisValues();updateLeveling(false);setSceneView('side');$('exaggerate').checked=false;updateLeveling(false);});
  const changed=await capture();check(id+' axes rotary dimension display invariance',JSON.stringify(changed.raw)===JSON.stringify(baseline.raw));
  if(phase==='before')fs.writeFileSync(path.join(output,id+'-saved.json'),JSON.stringify(changed.record,null,2));
  const fixture=path.resolve('docs/qa-all-measurements-20261011/intrinsic-save-audit/before/'+id+'-saved.json'),saved=JSON.parse(fs.readFileSync(fixture));
  await page.evaluate(()=>{supportHeights=supports.map(()=>.02);machineProfile=MachineAccuracy.generate('new',876543,machineLinearKeys(),supports.length);machineReference=null;updateLeveling(false);});
  await page.locator('#importLevel').setInputFiles(fixture);await page.waitForFunction(()=>$('levelInputMessage').textContent.includes('読み込みました')||$('levelInputMessage').textContent.includes('読込できません'));
  const loaded=await capture();row.loaded=loaded;
  check(id+' actual before JSON import accepted',await page.locator('#levelInputMessage').textContent().then(t=>t.includes('読み込みました')));
  check(id+' saved individual restored unchanged',JSON.stringify(loaded.profile)===JSON.stringify(saved.machineProfile));
  check(id+' saved intrinsic values restored unchanged',JSON.stringify(loaded.raw)===JSON.stringify(changed.raw));
  check(id+' saved inputs preserved',JSON.stringify([loaded.record.heights,loaded.record.axisPositions,loaded.record.width,loaded.record.depth])===JSON.stringify([saved.heights,saved.axisPositions,saved.width,saved.depth]));
  check(id+' saved schema preserved',JSON.stringify(Object.keys(loaded.record).sort())===JSON.stringify(Object.keys(saved).sort()));
  await page.locator('#openTrainingMenu').click();await page.locator('.level-storage summary').click();const downloading=page.waitForEvent('download');await page.locator('#exportLevel').click();await (await downloading).saveAs(path.join(output,id+'-download.json'));
  const download=JSON.parse(fs.readFileSync(path.join(output,id+'-download.json')));check(id+' real JSON download preserves profile',JSON.stringify(download.machineProfile)===JSON.stringify(saved.machineProfile));
  row.download=download;console.log(id+' intrinsic/support/save audit completed');
  if(id==='vertical'){
   const legacy={...saved,version:2};delete legacy.supportLayout;
   await page.locator('#importLevel').setInputFiles({name:'legacy-compact-v2.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});await page.waitForTimeout(50);
   check('legacy compact v2 without layout accepted',await page.locator('#levelInputMessage').textContent().then(t=>t.includes('読み込みました')));
  }
 }
 // Intrinsic surface invariance follows the projection definition, not supports.
 const h=[3,-4,1,9,-7,5,-2,8,6],a=independentSurface(h),b=independentSurface(h.map((v,i)=>v+91+13*grid[i][1]-7*grid[i][2]));
 check('independent surface residual rejects arbitrary rigid height plane',a.values.every((v,i)=>near(v,b.values[i]))&&near(a.range,b.range));
 check('no browser exceptions',result.errors.length===0);fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(result,null,2));
 const fields=['machine','support','step','direction','measurement','beforeRaw','afterRaw','beforeDisplay','afterDisplay','independent','delta'];
 const csv=[fields.join(',')];for(const m of result.machines)for(const s of m.states)for(let i=0;i<(m.id==='lathe'?2:12);i++)csv.push([m.id,s.support,s.step,s.direction,['TIR-root','TIR-300','top-back-left','top-back-mid','top-back-right','top-mid-left-zero','top-mid','top-mid-right','top-front-left','top-front-mid','top-front-right','top-range'][i],m.baseline.raw[i],s.raw[i],m.baseline.display[i],s.display[i],s.independent[i],s.delta[i]].join(','));fs.writeFileSync(path.join(output,'values.csv'),csv.join('\n')+'\n');
 await browser.close();console.log(JSON.stringify({phase,sha256,machines:result.machines.length,checks:result.checks.length,failures:result.checks.filter(q=>!q.ok)},null,2));process.exitCode=result.checks.some(q=>!q.ok)?1:0;
})().catch(e=>{fs.writeFileSync(path.join(output,'failed.json'),JSON.stringify({...result,error:String(e.stack||e)},null,2));console.error(e);process.exitCode=1;});

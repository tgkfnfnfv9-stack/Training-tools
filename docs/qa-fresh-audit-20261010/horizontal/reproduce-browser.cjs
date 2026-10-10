const fs=require('fs'),crypto=require('crypto'),{chromium}=require('playwright');
const dir='/workspace/Training-tools/docs/qa-fresh-audit-20261010/horizontal';
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 for (const [version,source] of [['pr','/workspace/Training-tools/index.html'],['public','/tmp/training-fresh-public.html']]){
 const p=await b.newPage({viewport:{width:1440,height:1000}}),html=fs.readFileSync(source);const states=[];
 await p.route('http://audit.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await p.goto('http://audit.test');
 await p.getByText('機械',{exact:true}).click();await p.getByText('工作機械のレベル出し',{exact:true}).click();await p.getByText('横形・Haas EC-630',{exact:true}).click();
 await p.evaluate(()=>{machineProfile=MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length);machineReference=null;machineSavedBest=null;positions={X:0,Y:0,Z:0,A:0,C:0};supportHeights=supports.map(()=>0);selected=0;updateAxisValues();updateLeveling(false);});
 const snap=async(name)=>{await p.waitForTimeout(150);await p.screenshot({path:dir+'/'+version+'-'+name+'.png'});states.push({name,...await p.evaluate(()=>({text:document.body.innerText,positions:{...positions},heights:[...supportHeights],cards:[...document.querySelectorAll('[data-reference-pair]')].map(e=>({pair:e.dataset.referencePair,text:e.textContent,rect:e.getBoundingClientRect().toJSON()})),diagrams:[...document.querySelectorAll('#liveSquareness svg')].map(e=>({text:e.textContent,aria:e.getAttribute('aria-label'),raw:e.dataset.readingMicrons})),fine:document.querySelector('#fineSummary')?.innerText}))});};
 await snap('flat');await p.locator('#measurementReferenceToggle').click();await snap('detail-open'); fs.writeFileSync(dir+'/'+version+'-details.txt',await p.locator('#measurementReference').innerText());
 console.log(version,await p.locator('#measurementReference').innerText());
 for(const key of ['XY','XZ','YZ']){const card=p.locator('[data-reference-pair="'+key+'"]');await card.scrollIntoViewIfNeeded();await snap('detail-'+key+'-top');await card.locator('p').last().scrollIntoViewIfNeeded();await snap('detail-'+key+'-bottom');}
 await p.locator('#closeMeasurementReference').click();
 await p.locator('#spindleSweepToggle').click();await snap('bar-detail');await p.locator('#closeSpindleSweepSelection').click();
 await p.locator('#axisTabs').getByText('Z軸',{exact:true}).click();
 await p.locator('#openTrainingMenu').click();
 await p.locator('#axisMenuSection > summary').click();
 console.log(version+' controls',await p.locator('#axisMenuSection').innerText());
 await snap('Z-controls');
 await p.locator('#axis-Z').fill('100');await p.locator('#axis-Z').dispatchEvent('input');await snap('Z-plus-controls');await p.locator('#closeTrainingMenu').click();await snap('Z-plus');
 await p.locator('#openTrainingMenu').click();await p.locator('#resetAxes').click();await p.locator('#drawerAxisSelect').selectOption('Y');await p.locator('#axis-Y').fill('100');await p.locator('#axis-Y').dispatchEvent('input');await p.locator('#closeTrainingMenu').click();await snap('Y-plus');
 await p.locator('#openTrainingMenu').click();await p.locator('#resetAxes').click();await p.locator('#drawerAxisSelect').selectOption('X');await p.locator('#axis-X').fill('100');await p.locator('#axis-X').dispatchEvent('input');await p.locator('#closeTrainingMenu').click();await snap('X-plus');
 await p.locator('#openTrainingMenu').click();await p.locator('#resetAxes').click();await p.locator('#closeTrainingMenu').click();
 await p.getByRole('button',{name:'B、右・手前の支持点を選択',exact:true}).click();await p.locator('#raiseSupport').click();await snap('B-coarse-plus');await p.locator('#lowerSupport').click();await snap('B-coarse-restored');
 await p.locator('#fineAdjust').click();await snap('fine-flat');await p.locator('#raiseSupport').click();await snap('B-fine-plus');await p.locator('#lowerSupport').click();await snap('B-fine-restored');
 fs.writeFileSync(dir+'/'+version+'-browser-observations.json',JSON.stringify({version,sha256:crypto.createHash('sha256').update(html).digest('hex'),states},null,2));await p.close();
 }
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});

'use strict';
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');process.chdir(root);
const {fixture}=require('./check-horizontal-fixture-independent-20261010.cjs');
const before=JSON.parse(fs.readFileSync('docs/qa-horizontal-fixture-20261010/browser/before/results.json')),after=JSON.parse(fs.readFileSync('docs/qa-horizontal-fixture-20261010/browser/after/results.json'));
const rows=[],skipped=[],failures=[],display=value=>{const n=Math.round(Math.abs(value));return n===0?'0':(value<0?'-':'+')+n;};
for(const q of after.states){
 if(q.profile){skipped.push({name:q.name,reason:'full generated 3D intrinsic profile outside this independent yz-section oracle'});continue;}
 const support=[...q.supports].sort((a,b)=>a.z-b.z||a.x-b.x),pairs=Array.from({length:4},(_,i)=>support.slice(2*i,2*i+2));
 if(pairs.some(p=>Math.abs(p[0].height-p[1].height)>1e-12)){skipped.push({name:q.name,reason:'left/right asymmetric support outside this independent yz-section oracle'});continue;}
 const expected=fixture({depth:q.config.depth,heightsMm:pairs.map(p=>p[0].height),intrinsicYZ:0,columnZ:q.config.columnZ||0},q.positions),actual=q.references.find(r=>r.key==='YZ'),old=before.states.find(b=>b.name===q.name)?.references.find(r=>r.key==='YZ');
 const row={name:q.name,method:q.method,heightsMm:support.map(p=>p.height),state:q.positions,config:q.config,beforeRawUm:old?.measurement.microns,beforeDisplay:old?.dom.reading,afterRawUm:actual.measurement.microns,afterDisplay:actual.dom.reading,independentExpectedUm:expected.expectedUm,independentDisplay:display(expected.expectedUm),errorUm:actual.measurement.microns-expected.expectedUm};rows.push(row);
 if(!expected.valid||!actual.measurement.valid||Math.abs(row.errorUm)>2e-6||row.afterDisplay!==row.independentDisplay)failures.push(row);
}
const report={sourceBrowserHtmlSha256:after.sha256,scope:'Only ideal individuals with left/right-equal support pairs are joined to the independent support-section oracle. Skipped cases are explicit, never counted as independent posture passes.',matchedStates:rows.length,skippedStates:skipped.length,maxErrorUm:Math.max(...rows.map(q=>Math.abs(q.errorUm))),rows,skipped,failures};fs.writeFileSync('docs/qa-horizontal-fixture-20261010/physical-browser.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({matchedStates:rows.length,skippedStates:skipped.length,maxErrorUm:report.maxErrorUm,failureCount:failures.length,examples:rows.filter(q=>q.name==='ideal-Zminus100-GH-raise'||q.name==='ideal-Zminus100-GH-lower')},null,2));if(failures.length)process.exitCode=1;

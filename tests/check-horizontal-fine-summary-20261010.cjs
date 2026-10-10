'use strict';
// The finite measurement and the local angle can move in opposite directions.
// These coarse-example handlers must describe the visible dial reading. Seeds
// 8/18 are the first opposite-trend examples found by searching seeds 1..100
// at Z75 after adopting the spindle-side S / head-Y fixture. Expected trends
// below are derived from independent plane intersections, not stored signs.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cases=[];
const env=require('./leveling-dom-env.cjs')({pureLeveling:true}),{read,json,registry:r}=env;
read("openMachine(machines.find(m=>m.id==='horizontal'));machineReference=null;machineSavedBest=null;");
const row=()=>r.finePrecisionSummary.children.find(p=>p.dataset.pair==='YZ');
const planeExtension=p=>{
 const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
 return dot(p.point.map((v,i)=>v-p.body[i]),p.normal)/dot(p.probe,p.normal);
};
const measurement=()=>json('referenceDisplayScan(levelGeometry.pairs.find(p=>p.key==="YZ"))');
const independentlyRead=m=>(planeExtension(m.start)-planeExtension(m.end))*1e6;
for(const seed of [8,18]){
 read(`machineProfile=window.MachineAccuracy.generate('used',${seed},machineLinearKeys(),supports.length);positions={X:0,Y:0,Z:75,A:0,C:0};supportHeights=[...machineProfile.initialHeights];updateLeveling(false);`);
 const before=measurement(),beforeRaw=independentlyRead(before);
 r.coarseExample.click();
 assert.deepEqual(json('supportHeights'),Array(8).fill(0),'actual coarse-example handler applied');
 const now=measurement(),currentRaw=independentlyRead(now),summary=row();
 const absoluteChange=Math.abs(currentRaw)-Math.abs(beforeRaw),expected=absoluteChange<-.005?'better':absoluteChange>.005?'worse':'similar';
 assert.notEqual(expected,'similar','the physical example has a material direction change');
 assert.ok(Math.abs(Number(summary.dataset.before)-beforeRaw)<1e-8);
 assert.ok(Math.abs(Number(summary.dataset.current)-currentRaw)<1e-8);
 assert.equal(summary.dataset.trend,expected);
 assert.equal(summary.textContent,'YZ測定：初期よりゼロ'+(expected==='better'?'に近づいた':'から離れた'));
 const localTrend=read("diagramComparison(levelGeometry.pairs.find(p=>p.key==='YZ'),levelInitialGeometry).trend");
 assert.equal(localTrend,expected==='better'?'worse':'better','a local-angle-only summary gives the opposite result');
 assert.equal(summary.dataset.model,'finite-scan');
 assert.equal(summary.dataset.unit,'µm');
 assert.ok(expected==='better'?Math.abs(currentRaw)<Math.abs(beforeRaw):Math.abs(currentRaw)>Math.abs(beforeRaw));
 cases.push({seed,positions:json('positions'),operation:'coarseExample actual onclick: initial supports to flat',beforeRawUm:beforeRaw,currentRawUm:currentRaw,absoluteChangeUm:absoluteChange,independentTrend:expected,localAngleTrend:localTrend,displayedTrend:summary.dataset.trend,text:summary.textContent,initialSupports:json('machineProfile.initialHeights')});
}
assert.deepEqual(new Set(cases.map(c=>c.independentTrend)),new Set(['better','worse']),'both directions have independently evaluated examples');
// A small change inside the same integer display bin is still a real change.
for(const [before,now,expected] of [[2.1,2.2,'worse'],[2.2,2.1,'better'],[2.1,2.104,'similar']]){
 read(`updateFineQualitative(levelGeometry,levelInitialGeometry,[{key:'YZ',before:{valid:true,microns:${before}},current:{valid:true,microns:${now}}}]);`);
 assert.equal(read(`squarenessMicronText(${before})`),read(`squarenessMicronText(${now})`));
 assert.equal(row().dataset.trend,expected);
}
// A missing contact or nonfinite reading is never substituted with zero.
for(const values of [
 {before:{valid:true,microns:2},current:{valid:false,microns:0}},
 {before:{valid:false,microns:0},current:{valid:true,microns:2}}
]){
 read(`updateFineQualitative(levelGeometry,levelInitialGeometry,[{key:'YZ',...${JSON.stringify(values)}}]);`);
 assert.equal(row().dataset.trend,'unavailable');
 assert.equal(row().dataset.delta,'');
 assert.equal(row().textContent,'YZ測定：測定が成立しないため比較できない');
 assert.equal(row().dataset[values.current.valid?'before':'current'],'');
}
read("updateFineQualitative(levelGeometry,levelInitialGeometry,[{key:'YZ',before:{valid:true,microns:2},current:{valid:true,microns:NaN}}]);");
assert.equal(row().dataset.trend,'unavailable');
assert.equal(row().dataset.current,'');
read('machineProfile=null;accuracyKey="";updateLeveling(false);');
assert.equal(row().textContent,'YZ測定：初期との比較基準なし');
assert.equal(row().dataset.before,'');
assert.equal(row().dataset.trend,'unavailable');
const output=process.env.TT_REPORT||'docs/qa-horizontal-fixture-20261010/fine-summary-regression.json';
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify({passed:true,referenceSourceSha256:crypto.createHash('sha256').update(fs.readFileSync('src/reference-measurement-ui.js')).digest('hex'),summarySourceSha256:crypto.createHash('sha256').update(fs.readFileSync('src/accuracy-ui.js')).digest('hex'),cases,sameIntegerCases:3,invalidCases:3,missingInitialCase:true},null,2)+'\n');
console.log('Horizontal finite summary: 2 opposite-trend support operations, 3 raw changes in one integer bin, 3 invalid readings and absent initial state passed.');

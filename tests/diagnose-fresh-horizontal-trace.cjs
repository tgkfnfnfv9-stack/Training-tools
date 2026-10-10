'use strict';
// Diagnostic observations only. No old expected values or sign tables are used
// as a physical oracle. Product files are not changed by this script.
const fs=require('node:fs'),path=require('node:path');
const env=require('./leveling-dom-env.cjs')({pureLeveling:true});
env.read("openMachine(machines.find(m=>m.kind==='horizontal'));$('exaggerate').checked=false;");
env.read(`
 function traceObservation(name){
  const g=geometryModel(),parallel=horizontalParallelism();
  return {name,profile:machineProfile?.seed??'ideal',positions:{...positions},heights:[...supportHeights],
   toolNose:horizontalSpindleFixture(positions,levelSolution,machineProfile).nose,
   palletTop:horizontalPalletPoint([0,1.27,-.85]),
   square:g.pairs.map(pair=>{const m=referenceScan(pair);return {key:pair.key,valid:m.valid,reason:m.reason,
    raw:m.microns,text:m.valid?squarenessMicronText(m.microns):m.reason,
    local300:pair.deviationMicroradians*.3,localConfigured:pair.errorMicrons,
    zeroExtension:m.zero?.extension,lastExtension:m.last?.extension,
    range:[m.startPosition,m.endPosition],rRange:[m.alignment?.startPosition,m.alignment?.endPosition],
    rResidual:m.alignment?.microns,zeroPoint:m.zero?.point,lastPoint:m.last?.point,
    zeroBody:m.start?.body,lastBody:m.end?.body,normal:m.start?.normal,probe:m.start?.probe,
    setup:m.setup,sampleCount:m.samples?.length};}),
   parallel:{range:[parallel.startPosition,parallel.endPosition],a:{raw:parallel.a.microns,valid:parallel.a.valid,text:squarenessMicronText(parallel.a.microns),zero:parallel.a.zero,last:parallel.a.last},b:{raw:parallel.b.microns,valid:parallel.b.valid,text:squarenessMicronText(parallel.b.microns),zero:parallel.b.zero,last:parallel.b.last}},
   evaluation:machineProfile?machineEvaluation(supportHeights):null,
   ui:{summary:$('finePrecisionSummary').children.map(e=>({text:e.textContent,data:e.dataset})),progress:$('fineOverallProgress').textContent,
    status:$('fineStatus').textContent,machineProgress:$('machineProgress').textContent,
    comparison:$('accuracyComparison').textContent}};
 }
`);
const observations=[];
function take(name){env.read('levelSolution=machineSolution(supportHeights);updateAccuracy();');observations.push(env.json(`traceObservation(${JSON.stringify(name)})`));}
const read=code=>env.read(code);
for(const profile of ['ideal','used']){
 read(profile==='ideal'?'machineProfile=null;':"machineProfile=window.MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length);");
 read('positions={X:0,Y:0,Z:0,A:0,C:0};supportHeights=supports.map(()=>0);');take(profile+'-flat');
 for(const step of [.001,.01])for(let i=0;i<8;i++)for(const sign of [-1,1]){
  read(`supportHeights=supports.map((p,i)=>i===${i}?${step*sign}:0);`);take(`${profile}-support-${String.fromCharCode(65+i)}-${step*sign}`);
 }
 for(const [name,formula]of [['plane','.03*p.x+.04*p.z+.02'],['twist-positive','.05*p.x*p.z'],['twist-negative','-.05*p.x*p.z']]){
  read('supportHeights=supports.map(p=>'+formula+');');take(profile+'-'+name);
 }
}
read("machineProfile=window.MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length);supportHeights=supports.map(p=>.05*p.x*p.z);");
for(const axis of ['X','Y','Z'])for(const value of [-100,-50,0,25,50,75,100]){
 read(`positions={X:0,Y:0,Z:0,A:0,C:0};positions.${axis}=${value};`);take(`axis-${axis}-${value}`);
}
read('positions={X:0,Y:0,Z:0,A:0,C:0};supportHeights=[...machineProfile.initialHeights];machineReference=null;machineSavedBest=null;updateLeveling(false);');take('initial-before-example');
read("$('fineAdjust').click();$('fineExample').click();");take('after-fine-example');
const result={head:process.argv[2]||'5d95690c5875efe53268d319efcac62dce22cce8',scope:'horizontal only; implementation observations, not physical expected-value certification',config:env.json('levelConfig'),supports:env.json('supports'),observations};
const out=path.resolve('docs/qa-fresh-audit-20261010');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'trace.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({output:path.join(out,'trace.json'),observations:observations.length,example:observations.slice(-2).map(o=>({name:o.name,values:o.square.map(s=>({key:s.key,raw:s.raw,local300:s.local300})),objective:o.evaluation?.objective,ui:o.ui}))},null,2));

'use strict';
// Fixed pre-change finite values and explicit independent affine arithmetic.
// No product gain/helper is used to construct expected values.
const assert=require('node:assert/strict');
const env=require('./leveling-dom-env.cjs')({window:{crypto:{getRandomValues(a){a[0]=923412;return a;}}}});
const {read,json,registry:r}=env;let checks=0;
const close=(a,b,label,tol=1e-7)=>{assert.ok(Math.abs(a-b)<tol,`${label}: ${a} != ${b}`);checks++;};
const check=(ok,label)=>{assert.ok(ok,label);checks++;};
const raw=key=>read(`referenceScan({key:'${key}'}).microns`);
const displayed=key=>read(`referenceReading({key:'${key}'},referenceScan({key:'${key}'})).microns`);
const live=key=>r.liveSquareness.querySelectorAll('.live-pair-values').find(x=>x.dataset.pair===key).querySelectorAll('.live-pair-error-value')[0];
const update=code=>read(code+';updateLeveling();');
read('openMachine(machines[0]);positions={X:0,Y:0,Z:0,A:0,C:0};machineProfile.squareness={XY:{microns:33},XZ:{microns:75},YZ:{microns:-15}};');
const frozen=[[-.1,15.237939150496496],[-.01,15.023786867383176],[0,14.999999993750915],[.01,14.976214685014435],[.1,14.762217326876742]],zero=frozen[2][1];
for(const [a,physical] of frozen){
 update(`supportHeights=[${a},0,0,0]`);const expected=zero+50*(physical-zero);
 close(raw('YZ'),physical,`frozen physical A=${a}`);close(displayed('YZ'),expected,`affine expected A=${a}`);
 close(Number(live('YZ').dataset.readingMicrons),expected,'live display');
 close(Number(live('YZ').dataset.physicalReadingMicrons),physical,'live raw evidence');
 for(const key of ['XY','XZ']){close(displayed(key),raw(key),key+' unchanged');close(Number(live(key).dataset.readingMicrons),raw(key),key+' DOM unchanged');}
}
update('supportHeights=[0,0,0,0]');const before=displayed('YZ');r.raiseSupport.click();const raised=displayed('YZ');
close(before-raised,1.189265436824,'coarse A increase about 1.19 um',1e-6);
const initialRaw=read("referenceScan({key:'YZ'},positions,levelInitialSolution).microns"),expectedInitial=zero+50*(initialRaw-zero);
close(read("referenceReading({key:'YZ'},referenceScan({key:'YZ'},positions,levelInitialSolution)).microns"),expectedInitial,'initial comparison uses same baseline and response');
const signedInteger=v=>Math.round(Math.abs(v))===0?'0':(v<0?'-':'+')+Math.round(Math.abs(v));
const initialCard=r.measurementReferenceCards.querySelectorAll('.measurement-reference-card').find(x=>x.dataset.referencePair==='YZ');
check(initialCard.textContent.includes('初期支持状態：'+signedInteger(expectedInitial)+' µm／現在：'+signedInteger(raised)+' µm'),'rendered initial/current comparison uses teaching values');
r.lowerSupport.click();close(displayed('YZ'),before,'coarse roundtrip');r.fineAdjust.click();r.raiseSupport.click();check(before-displayed('YZ')>.11&&before-displayed('YZ')<.13,'fine .001 mm response near .119 um');
r.lowerSupport.click();close(displayed('YZ'),before,'fine roundtrip');
for(const y of [-100,0,100])for(const intrinsic of [-15,0,15]){
 update(`positions.Y=${y};machineProfile.squareness.YZ.microns=${intrinsic};supportHeights=[.13,-.05,.02,-.08]`);
 const independentZero=read("referenceScan({key:'YZ'},positions,machineSolution(supports.map(()=>0))).microns");
 close(displayed('YZ'),independentZero+50*(raw('YZ')-independentZero),`baseline Y=${y} intrinsic=${intrinsic}`);
 update('supportHeights=[0,0,0,0]');close(displayed('YZ'),raw('YZ'),'uniform height retains intrinsic');
}
update('levelConfig.width*=1.2;levelConfig.depth*=1.1;supportHeights=[.02,0,0,0]');
const rezero=read("referenceScan({key:'YZ'},positions,machineSolution(supports.map(()=>0))).microns");close(displayed('YZ'),rezero+50*(raw('YZ')-rezero),'dimension-specific baseline');
update('positions.Y=0;machineProfile.squareness={XY:{microns:0},XZ:{microns:0},YZ:{microns:0}};supportHeights=[0,0,0,0]');
for(const sign of [-1,1]){update(`supportHeights=supports.map(s=>{const p=levelCoordinates(s.x,s.z);return ${sign}*(.2*p.x+.3*p.z)+.12;})`);close(displayed('YZ'),0,'ideal rigid plane stays zero',1e-6);}
update('supportHeights=[.1,0,0,0]');const measure=displayed('YZ'),saved=json('levelRecord()'),geometry=json('geometryModel()');
read("sceneZoom=1.8;$('exaggerate').checked=false;drawScene();updateAccuracy();");
close(displayed('YZ'),measure,'zoom/diagram emphasis invariance');assert.deepEqual(json('levelRecord()'),{...saved,exaggerate:false});checks++;assert.deepEqual(json('geometryModel()'),geometry);checks++;
const invalid=json("referenceReading({key:'YZ'},{valid:false,reason:'基準面の範囲外'})");check(!invalid.valid&&invalid.microns===undefined,'invalid raw stays invalid');
check(r.liveSquarenessName.textContent.includes('YZ支持変化×50'),'visible response annotation');check(!r.columnLeanInset,'unwanted column panel removed');
const card=r.measurementReferenceCards.querySelectorAll('.measurement-reference-card').find(x=>x.dataset.referencePair==='YZ');
check(card.textContent.includes('I0＋50×(I−I0)')&&card.textContent.includes('実測値や実機の調整感度ではありません'),'card explains formula and limitation');
for(let i=1;i<7;i++){
 read(`openMachine(machines[${i}]);positions.A=0;positions.C=0;updateLeveling();`);
 for(const key of json('geometryModel().pairs.map(p=>p.key)')){
  const q=json(`(()=>{const m=referenceScan({key:'${key}'});return {raw:m,display:referenceReading({key:'${key}'},m)}})()`);
  check(q.raw.valid===q.display.valid,`machine ${i} ${key} validity unchanged`);
  if(q.raw.valid)close(q.display.microns,q.raw.microns,`machine ${i} ${key} unchanged`);
 }
 check(!r.liveSquarenessName.textContent.includes('50'),`machine ${i} no gain label`);
}
console.log(JSON.stringify({checks,coarseDeltaMicrons:before-raised,meaning:'display response verified; finite physics unchanged; no real-machine elasticity claim'}));

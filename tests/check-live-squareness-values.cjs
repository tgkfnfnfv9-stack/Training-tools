'use strict';
const assert=require('node:assert/strict'),create=require('./leveling-dom-env.cjs');
const e=create(),r=e.registry;let checks=0;
const nodes=()=>r.liveSquareness.querySelectorAll('.live-pair-error-value'),snapshot=()=>nodes().map(n=>[n.textContent,n.dataset.readingMicrons]);
function verify(){
 for(const n of nodes()){
  const pair=n.parentElement.dataset.pair,m=e.json(`referenceScan({key:'${pair}'})`),expected=m.valid?(Math.round(Math.abs(m.microns))===0?'0':(m.microns<0?'-':'+')+Math.round(Math.abs(m.microns))):'—';
  assert.equal(n.textContent,expected);assert.equal(n.dataset.readingMicrons,m.valid?String(m.microns):'');
  assert.match(n.getAttribute('aria-label'),m.valid?/仮想測定/:/A\/C|範囲/);assert.equal(n.parentElement.querySelectorAll('.live-pair-unit')[0].textContent.trim(),'µm');checks++;
 }
}
for(let i=0;i<7;i++){
 e.storage.clear();e.read(`openMachine(machines[${i}])`);verify();const before=snapshot(),record=e.json('levelRecord()'),local=e.json('levelGeometry.pairs');
 for(const offset of [.1,.3,2]){e.read(`levelConfig.offset=${offset};updateLeveling()`);verify();assert.deepEqual(snapshot(),before);}
 r.exaggerate.checked=true;r.exaggerate.onchange();e.read('yaw=.9;setSceneZoom(1.4);setTrainingMenuOpen(true);setTrainingMenuOpen(false)');verify();assert.deepEqual(snapshot(),before);
 e.read(`applyLevelRecord(${JSON.stringify(record)});updateLeveling()`);r.raiseSupport.click();r.lowerSupport.click();verify();assert.deepEqual(snapshot(),before);assert.deepEqual(e.json('levelGeometry.pairs'),local);
 e.read('positions={X:73,Y:-49,Z:62,A:19,C:-23};updateLeveling()');verify();
 if(i===5)assert(nodes().every(n=>n.textContent==='—'));
 e.read(`applyLevelRecord(${JSON.stringify(record)});updateLeveling()`);verify();assert.deepEqual(snapshot(),before);assert.deepEqual(e.json('levelRecord()'),record);
}
for(const [raw,wanted] of [[-.5,'-1'],[-.49,'0'],[0,'0'],[.49,'0'],[.5,'+1'],[20.5,'+21'],[-20.5,'-21']]){assert.equal(e.read(`squarenessMicronText(${raw})`),wanted);checks++;}
assert.match(r.liveSquarenessUnits.textContent,/仮想測定/);assert.match(r.squarenessValuesNote.textContent,/押込み増加/);
console.log(`Live finite readings: ${checks} assertions, view invariance, support reversal and saved-state restoration passed.`);

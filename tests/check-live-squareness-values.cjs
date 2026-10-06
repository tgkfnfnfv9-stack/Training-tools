'use strict';
// Read the actual visible value nodes. Expected readings come from the fixed
// 300 mm measurement contract and explicit rounding examples, not UI helpers.
const assert=require('node:assert/strict');
const makeEnvironment=require('./leveling-dom-env.cjs');
const MachineAccuracy=require('../src/machine-accuracy.js');
const e=makeEnvironment(),r=e.registry;
let checks=0;const failures=[];
function check(name,fn){checks++;try{fn();}catch(error){failures.push(name+': '+error.message);}}
const near=(a,b,t=1e-8)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,`${a} != ${b}`);
const norm=s=>String(s).replace(/−/g,'-').replace(/μ/g,'µ');
const values=()=>r.liveSquareness.querySelectorAll('.live-pair-values');
// Check the visible number together with its explicit accessible plane/axis
// context and the adjacent unit, rather than requiring a repeated heading.
function reading(node,expectedContext){
 assert.equal(node.children.length,0);assert.equal(norm(node.getAttribute('aria-label')),expectedContext+norm(node.textContent)+' µm');
 const unit=node.parentElement.querySelectorAll('.live-pair-unit');assert.equal(unit.length,1);assert.equal(norm(unit[0].textContent).trim(),'µm');assert.equal(unit[0].getAttribute('aria-hidden'),'true');
 return norm(node.textContent).trim();
}
function isVisible(node){for(let n=node;n;n=n.parentElement)assert.equal(n.hidden,false,'value has a hidden ancestor');}
function observed(){return values().map(v=>({pair:v.dataset.pair,base:norm(v.querySelectorAll('.live-pair-base-value')[0].textContent),error:norm(v.querySelectorAll('.live-pair-error-value')[0].textContent)}));}
function verify(){
 const pairs=e.json('levelGeometry.pairs'),lathe=e.read("current.kind==='lathe'");
 assert.deepEqual(values().map(v=>v.dataset.pair),pairs.map(p=>p.key));
 for(const p of pairs){
  const v=values().find(v=>v.dataset.pair===p.key),base=v.querySelectorAll('.live-pair-base-value')[0],error=v.querySelectorAll('.live-pair-error-value')[0];
  const baseKey=lathe?'Z':p.key[0],other=[...p.key].find(k=>k!==baseKey),raw=p.deviationMicroradians*.3;
  const magnitude=Math.floor(Math.abs(raw)+.5),expected=magnitude===0?'0':(raw<0?'-':'+')+magnitude;
  assert.equal(norm(base.textContent),(lathe?'主軸Z':baseKey)+'基準 0');
  assert.equal(reading(error,p.key+' '+other+'直角差 '),expected);
  assert(base.classList.contains('visually-hidden'),'repeated external baseline text is visually suppressed');
  near(Number(error.getAttribute('data-current-error-300')),raw);
  isVisible(base);isVisible(error);
  // The accessible reading identifies the plane and measurement axis;
  // its number agrees with the visible reading and shared reference notes.
  const descriptions=(v.getAttribute('aria-describedby')||'').split(/\s+/).map(id=>r[id]?.textContent||'').join(' ');
  assert.match(norm(descriptions),/300\s*mm/);assert.match(norm(descriptions),/µm/);assert.match(descriptions,/0\.001\s*mm/);
  assert.match(descriptions,/現在.*理想/);assert.match(descriptions,/初期.*差分.*ではありません/);
  assert.doesNotMatch(reading(error,p.key+' '+other+'直角差 '),/[-+]0(?:\s|$)/);
 }
}

for(let index=0;index<7;index++){
 e.storage.clear();e.read(`openMachine(machines[${index}]);`);
 const profile=MachineAccuracy.generate('used',8765+index,e.json('machineLinearKeys()'),e.read('supports.length'));
 e.read(`initializeMachineAccuracy(${JSON.stringify(profile)});supportHeights=[...machineProfile.initialHeights];updateLeveling();`);
 check(`all visible pairs and accessible units machine ${index}`,verify);
 const before=observed(),record=e.json('levelRecord()');
 for(const offset of [.1,.3,.5,2]){
  e.read(`levelConfig.offset=${offset};updateLeveling();`);
  check(`300 mm values ignore configurable evaluation length ${index}/${offset}`,()=>{verify();assert.deepEqual(observed(),before);});
 }
 for(const exaggerate of [false,true]){
  r.exaggerate.checked=exaggerate;r.exaggerate.onchange();
  check(`values ignore visual exaggeration ${index}/${exaggerate}`,()=>{verify();assert.deepEqual(observed(),before);});
 }
 e.read('setTrainingMenuOpen(true);setTrainingMenuOpen(false);yaw=.73;setSceneZoom(1.4);');
 check(`menu/camera preserve values ${index}`,()=>{verify();assert.deepEqual(observed(),before);});
 e.read('positions={X:73,Y:-49,Z:62,A:19,C:-23};updateLeveling();');
 check(`values follow actual current axis position ${index}`,verify);
 r.coarseAdjust.click();r.raiseSupport.click();
 check(`values follow actual support adjustment ${index}`,verify);
 e.read(`applyLevelRecord(${JSON.stringify(record)});updateLeveling();`);
 check(`saved data restores numeric readings ${index}`,()=>{verify();assert.deepEqual(observed(),before);});
 check(`support adjustment/initial comparison values stay hidden ${index}`,()=>{
  assert(!/\d/.test(r.stageAverageLR.textContent));assert(!/\d/.test(r.stageAverageFB.textContent));
  for(const p of e.json('levelGeometry.pairs'))for(const part of ['before','delta'])assert.equal(r['accuracy-'+part+'-'+p.key].hidden,true);
 });
}

e.read('openMachine(machines[0]);');
// Fixed table, including negative halves and small negative values. This
// distinguishes symmetric half-away rounding from JavaScript's signed round.
for(const [raw,expected] of [[-900,'-900'],[-20.51,'-21'],[-20.5,'-21'],[-20.49,'-20'],[-.5,'-1'],[-.49,'0'],[-.001,'0'],[0,'0'],[.001,'0'],[.49,'0'],[.5,'+1'],[20.49,'+20'],[20.5,'+21'],[20.51,'+21'],[900,'+900']]){
 const g={pairs:[{key:'XY',deviationMicroradians:raw/.3}]},initial={pairs:[{key:'XY',deviationMicroradians:(raw+100)/.3}]};
 e.read(`accuracyDiagram(${JSON.stringify(g)},${JSON.stringify(initial)});`);
 check(`signed integer reading ${raw}`,()=>{
  const v=values()[0],value=v.querySelectorAll('.live-pair-error-value')[0];
  assert.equal(reading(value,'XY Y直角差 '),expected);near(Number(value.getAttribute('data-current-error-300')),raw);
  assert.equal(v.querySelectorAll('.live-pair-base-value')[0].textContent,'X基準 0');
  if(Math.abs(raw)===900){const svg=r.liveSquareness.querySelectorAll('svg')[0];assert.equal(svg.dataset.limited,'true');assert.equal(reading(value,'XY Y直角差 '),expected);}
 });
}
// A current +10 micron error must not become the -15 micron initial/current
// difference, even if the initial line or range changes.
for(const initial of [-1000,0,25,1000]){
 e.read(`accuracyDiagram({pairs:[{key:'XZ',deviationMicroradians:10/.3}]},{pairs:[{key:'XZ',deviationMicroradians:${initial}/.3}]});`);
 check(`current value is not initial delta ${initial}`,()=>assert.equal(reading(values()[0].querySelectorAll('.live-pair-error-value')[0],'XZ Z直角差 '),'+10'));
}
check('shared unit note defines thousandths of a millimetre',()=>{assert.equal(norm(r.liveSquarenessUnits.textContent).replace(/\s/g,''),'300mm・µm');assert.match(r.squarenessMeasurementNote.textContent,/局所角度/);assert.match(r.squarenessMeasurementNote.textContent,/実際の移動.*走査/);assert.match(norm(r.squarenessValuesNote.textContent),/1\s*µm[＝=]0\.001\s*mm/);isVisible(r.liveSquarenessUnits);});
e.read("current=machines[0];");
for(const [before,now,wanted] of [[10,9.976,true],[10,10,false],[10,10.0000001,false],[10,10.6,false],[-10,-9.976,true]]){
 e.read(`accuracyDiagram({pairs:[{key:'YZ',deviationMicroradians:${now}/.3}]},{pairs:[{key:'YZ',deviationMicroradians:${before}/.3}]});`);
 check(`compact micro change describes unrounded motion ${before}/${now}`,()=>{
  const note=values()[0].querySelectorAll('.live-pair-micro-change')[0];assert(note);assert.equal(note.getAttribute('data-micro-change'),String(wanted));
  assert.equal(note.textContent,wanted?'初期から微小変化':'');assert(!/[0-9]/.test(note.textContent));
  near(Number(values()[0].querySelectorAll('.live-pair-error-value')[0].getAttribute('data-current-error-300')),now);
 });
}
console.log(JSON.stringify({checks,failures},null,2));if(failures.length)process.exitCode=1;

'use strict';
// Verify the visible line against the measured relative angle, rather than
// duplicating the renderer's trigonometric endpoint calculation.
const assert=require('node:assert/strict');
const makeEnvironment=require('./leveling-dom-env.cjs');
const MachineAccuracy=require('../src/machine-accuracy.js');
const {registry:r,read,json,storage}=makeEnvironment();
const variants=[[0,'standard'],[0,'compact'],[1,''],[2,''],[3,'long'],[3,'cross'],[4,''],[5,''],[6,'']];
let checks=0,changedPairs=0;
function check(label,fn){fn();checks++;}
function near(a,b,tolerance=1e-9){assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance,`${a} != ${b}`);}
function diagrams(){return r.liveSquareness.querySelectorAll('svg');}
function verify(g){
 const svgs=diagrams();assert.deepEqual(svgs.map(svg=>svg.getAttribute('data-pair')),g.pairs.map(p=>p.key));
 for(const [index,pair] of g.pairs.entries()){
  const svg=svgs[index],base=r.accuracyDiagram.querySelectorAll('g').filter(g=>g.getAttribute('data-pair'))[index],line=svg.querySelectorAll('.pair-current')[0],datum=svg.querySelectorAll('.pair-base')[0];
  const x=Number(line.getAttribute('x1')),y=Number(line.getAttribute('y1')),dx=Number(line.getAttribute('x2'))-x,dy=y-Number(line.getAttribute('y2'));
  const visualAngle=Math.atan2(-dx,dy),limited=svg.getAttribute('data-limited')==='true';
  near(Math.hypot(dx,dy),28);near(Number(svg.getAttribute('data-deviation')),pair.deviationMicroradians);
  const expected=Math.max(-.65,Math.min(.65,pair.deviationMicroradians*.001));near(visualAngle,expected,1e-12);
  assert.equal(limited,Math.abs(pair.deviationMicroradians*.001)>.65);
  assert.equal(svg.getAttribute('data-gain'),'1000');assert.equal(datum.getAttribute('y1'),datum.getAttribute('y2'));
  const key=read('current.kind')==='lathe'?'Z':pair.key[0];assert.equal(svg.getAttribute('data-base'),key);assert.equal(base.getAttribute('data-base'),key);
  assert.equal(svg.getAttribute('data-other'),[...pair.key].find(k=>k!==key));
  assert.equal(svg.parentElement.querySelectorAll('.live-pair-title')[0].textContent.includes(pair.key+' 基準'+key),true);
  assert.equal(base.querySelectorAll('.pair-current')[0].getAttribute('x2'),line.getAttribute('x2'));
  assert.equal(base.querySelectorAll('.pair-current')[0].getAttribute('y2'),line.getAttribute('y2'));
  const match=/90度より(広い|狭い)|90度/.exec(svg.getAttribute('aria-label'));assert(match);
  assert.equal(match[1]??'90度',pair.deviationMicroradians>0?'広い':pair.deviationMicroradians<0?'狭い':'90度');
  if(limited)assert.match(svg.getAttribute('aria-label'),/図の範囲外/);
 }
}
for(const [index,mode] of variants){
 storage.clear();read(`openMachine(machines[${index}])`);if(mode)r.machineMode.change(mode);
 const profile=MachineAccuracy.generate('used',123,json('machineLinearKeys()'),read('supports.length'));read(`initializeMachineAccuracy(${JSON.stringify(profile)});supportHeights=[...machineProfile.initialHeights];updateLeveling();`);
 check('初期差を入力・平均状態・比較数字で明かさない '+index+'/'+mode,()=>{
  for(let i=0;i<profile.initialHeights.length;i++){assert.equal(r['height'+i].value,'0.000');assert.match(r['height'+i].getAttribute('aria-label'),/調整量/);}
  assert(!/[\d]/.test(r.stageAverageLR.textContent));assert(!/[\d]/.test(r.stageAverageFB.textContent));
  for(const pair of json('levelGeometry.pairs'))for(const part of ['before','delta']){const el=r['accuracy-'+part+'-'+pair.key];assert(el.hidden);assert.equal(el.textContent,'');}
  assert.doesNotMatch(r.geometryStatus.textContent,/抽選時|Δ/);assert.doesNotMatch(r.bodyLeanValues.textContent,/本体 [+-]?\d|支持 [+-]?\d/);
 });
 check('全ペアを同じ基準と倍率で常時表示 '+index+'/'+mode,()=>verify(json('levelGeometry')));
 const before=json('levelGeometry.pairs');r.up0.click();
 check('支持点の調整後に現在精度と図が同期 '+index+'/'+mode,()=>{
  near(Number(r.height0.value),.001,1e-12);near(read('supportHeights[0]'),profile.initialHeights[0]+.001,1e-12);verify(json('levelGeometry'));
  const pairs=json('levelGeometry.pairs');assert(pairs.every(p=>Number.isFinite(p.deviationMicroradians)));
  changedPairs+=pairs.filter((p,i)=>Math.abs(p.deviationMicroradians-before[i].deviationMicroradians)>1e-8).length;
 });
 r.zero.click();const afterZero=json('levelGeometry.pairs');
 read('supportHeights=supports.map(s=>{const p=levelCoordinates(s.x,s.z);return p.x*.02+p.z*.02;});updateLeveling();');
 check('共通の平面傾斜は軸間の固有直角差を増やさない '+index+'/'+mode,()=>{json('levelGeometry.pairs').forEach((p,i)=>near(p.deviationMicroradians,afterZero[i].deviationMicroradians,1e-7));verify(json('levelGeometry'));});
 r.zero.click();
 for(const key of json('machineLinearKeys()')){
  read(`positions.${key}=73;updateAxisValues();updateLeveling();`);
  check('軸位置が変わっても図が実値へ同期 '+index+'/'+mode+'/'+key,()=>verify(json('levelGeometry')));
 }
 const saved=json('levelRecord()');read(`applyLevelRecord(${JSON.stringify(saved)});buildSupports();updateLeveling();`);
 check('保存は絶対高さ、復元入力は初期からの調整量 '+index+'/'+mode,()=>{
  assert.deepEqual(json('levelRecord()'),saved);saved.heights.forEach((h,i)=>near(Number(r['height'+i].value),h-profile.initialHeights[i],.0000001));verify(json('levelGeometry'));
 });
 r.restoreInitialLevel.click();check('初期戻しは同じ個体の未調整表示へ戻る '+index+'/'+mode,()=>{assert.deepEqual(json('machineProfile'),profile);assert.deepEqual(json('supportHeights'),profile.initialHeights);for(let i=0;i<profile.initialHeights.length;i++)assert.equal(r['height'+i].value,'0.000');verify(json('levelGeometry'));});
}
check('実際の支持調整が複数の直角図を変える',()=>assert(changedPairs>=4));
read('openMachine(machines[0])');
for(const deviation of [-3000,-650,-300,-100,0,100,300,650,3000])check('正負とゼロの角度、固定倍率、範囲端 '+deviation,()=>{
 const g={pairs:[{key:'XY',deviationMicroradians:deviation}]};read(`accuracyDiagram(${JSON.stringify(g)})`);verify(g);
});
console.log('Squareness display: '+checks+' measured-angle, hidden-initial-value and relative-input checks passed.');

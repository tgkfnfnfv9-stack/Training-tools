'use strict';
const assert=require('node:assert/strict'),create=require('./leveling-dom-env.cjs');
const e=create(),r=e.registry;let checks=0;
for(let i=0;i<7;i++){
 e.storage.clear();e.read(`openMachine(machines[${i}])`);
 const pairs=e.json('levelGeometry.pairs'),svgs=r.liveSquareness.querySelectorAll('svg');
 assert.deepEqual(svgs.map(s=>s.dataset.pair),pairs.map(p=>p.key));
 for(const [index,svg] of svgs.entries()){
  assert.equal(svg.dataset.measurementModel,'reference-scan-v3');
  for(const c of ['scan-master','scan-face','scan-zero','scan-contact','scan-probe','scan-body','scan-path','scan-move','scan-press'])assert.equal(svg.querySelectorAll('.'+c).length,1);
  assert.equal(svg.querySelectorAll('.measurement-start')[0].textContent,'0');
  assert.equal(svg.parentElement.querySelectorAll('.live-pair-title').length,0);
  const card=r.measurementReferenceCards.querySelectorAll('.measurement-reference-card')[index];
  assert.match(card.textContent,/方向合わせ|回転中心線/);assert.match(card.textContent,/ゼロ合わせ/);assert.match(card.textContent,/初期支持状態/);assert.match(card.textContent,/局所角度差/);
  // Original angle comparison remains mathematically independent in its detail.
  const line=r.accuracyDiagram.querySelectorAll('.pair-current')[index],dx=+line.getAttribute('x2')-line.getAttribute('x1'),dy=+line.getAttribute('y1')-line.getAttribute('y2');
  assert(Math.abs(Math.atan2(-dx,dy)-Math.max(-.65,Math.min(.65,pairs[index].deviationMicroradians*.005)))<1e-12);checks++;
 }
 const before=r.liveSquareness.innerHTML;e.read('toggleMeasurementReference(true);toggleMeasurementReference(false)');assert.equal(r.liveSquareness.innerHTML,before);
}
console.log(`Measurement drawings: ${checks} planes, actual fixture/contact/zero/scan/compression labels and retained local comparisons passed.`);

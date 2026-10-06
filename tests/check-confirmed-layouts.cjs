'use strict';
// Regression coverage for confirmed support layouts and real legacy exports.
// Calculation expectations and foundation coordinates are independent of the UI.
// The fixture contains only nine original saves, not full rendered snapshots.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');process.chdir(root);
const {registry:r,read,json,storage,context}=require(path.join(root,'tests/leveling-dom-env.cjs'))();
const legacy=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/legacy-level-records-pre-layouts.json'),'utf8')).records;
const previousL3=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/legacy-l3-24-supports.json'),'utf8'));
const results={checks:0,legacyAccepted:0,legacyCompactMigrated:0,legacyRejected:0,legacyV1Rejected:0,legacyV1CompactMigrated:0,legacyKeysPreserved:0,supportsExercised:0,failures:[],timings:[]};
let label='',seed=902110;context.window.crypto={getRandomValues(a){a[0]=seed++;return a;}};
function test(fn){results.checks++;try{fn();}catch(e){results.failures.push({label,message:e.message});}}
function open(i){read(`openMachine(machines[${i}]);`);}
function record(){return json('levelRecord()');}
function near(a,b){assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);}
async function load(data){const text=JSON.stringify(data);r.importLevel.files=[{size:text.length,text:async()=>text}];await r.importLevel.onchange({target:r.importLevel});}
async function main(){
 // Both the foundation and the calculation contract matter. All fixtures
 // predate connected-frames-v1: even identical support counts do not authorize
 // silently interpreting their heights with a different structural model.
 for(const item of legacy){
  storage.clear();open(item.index);const old=item.values.record,before=record();
  label=`legacy/${item.index}/${item.mode}/${item.condition}/${item.stage}`;
  test(()=>assert.equal(Boolean(read(`validLevelRecord(${JSON.stringify(old)})`)),false));
  await load(old);
  results.legacyRejected++;test(()=>{assert.deepEqual(record(),before);assert.match(r.levelInputMessage.textContent,/配置|旧|対応|計算/);});
  const v1=structuredClone(old);v1.version=1;delete v1.machineProfile;delete v1.bestState;
  label+='/v1';test(()=>assert.equal(Boolean(read(`validLevelRecord(${JSON.stringify(v1)})`)),false));await load(v1);test(()=>assert.deepEqual(record(),before));results.legacyV1Rejected++;
 }
 for(const index of [0,1,2,3,4,5,6]){
  storage.clear();const records=legacy.filter(q=>q.index===index&&q.condition==='new'&&q.stage==='initial');
  for(const q of records)storage.set('training-level-v1:'+q.values.record.machine+':'+q.values.record.mode,JSON.stringify(q.values.record));
  const originals=[...storage];open(index);label=`old-local-key/${index}`;
  test(()=>{for(const [key,value]of originals){assert.equal(storage.get(key),value);assert.notEqual(read('levelKey()'),key);}assert.match(r.levelSaveStatus.textContent,/旧|計算|配置|対応/);});
  results.legacyKeysPreserved+=originals.length;
 }
 // The former 24-point v3 layout also needs explicit rejection: matching
 // machine/mode/version alone must never reinterpret its height array.
 storage.clear();const previousText=JSON.stringify(previousL3.record);storage.set(previousL3.key,previousText);open(3);
 label='L3/previous-24-point-local-save-is-preserved';const currentL3=record();
 test(()=>{assert.equal(storage.get(previousL3.key),previousText);assert.notEqual(read('levelKey()'),previousL3.key);assert.equal(currentL3.heights.length,15);assert.notEqual(currentL3.supportLayout.id,previousL3.record.supportLayout.id);assert.match(r.levelSaveStatus.textContent,/旧|配置|対応/);});
 label='L3/previous-24-point-import-is-rejected';test(()=>assert.equal(Boolean(read(`validLevelRecord(${JSON.stringify(previousL3.record)})`)),false));
 await load(previousL3.record);test(()=>{assert.deepEqual(record(),currentL3);assert.equal(storage.get(previousL3.key),previousText);assert.match(r.levelInputMessage.textContent,/旧|配置|対応/);});
 const counts=[4,8,6,15,8,3,6];
 for(let index=0;index<7;index++){
  storage.clear();let start=performance.now();open(index);results.timings.push({index,operation:'open',milliseconds:performance.now()-start});
  label=`current-layout/${index}`;const initial=record(),profile=json('machineProfile');
  test(()=>{assert.equal(read('supports.length'),counts[index]);assert.equal(initial.version,[0,1,3].includes(index)?3:2);assert.equal(initial.calculationModel,[3,4].includes(index)?'portal-shear-v2':index===2?'travel-guide-v2':index===6?'lathe-carriage-v2':index===1?'horizontal-guide-v2':index===0?'compact-table-path-v3':'connected-frames-v1');assert.equal(read('validLevelRecord(levelRecord())'),true);});
  if(index===3){
   label='L3/requested-nine-bed-points-and-original-column-coordinates';
   const stations=[240,3440,6600],expected=[...[-770,0,770].flatMap(x=>stations.map(z=>[x,z-3420])),...[-1060,1060].flatMap(x=>[3965,4515].map(z=>[x,z-3420])),[-1425,825],[1420,825]].map(([x,z])=>[x/1000,z/1000]);
   const actual=json('supports.map(s=>levelCoordinates(s.x,s.z))');
   test(()=>{assert.equal(actual.length,15);for(const p of expected)assert.equal(actual.filter(q=>Math.abs(q.x-p[0])<1e-12&&Math.abs(q.z-p[1])<1e-12).length,1,JSON.stringify(p));near(read('levelConfig.width'),2.85);near(read('levelConfig.depth'),6.84);assert.equal(read('supports.filter(s=>s.group==="bed").length'),9);assert.equal(read('supports.filter(s=>s.group==="column-left").length'),3);assert.equal(read('supports.filter(s=>s.group==="column-right").length'),3);});
  }
  const state=json('({profile:machineProfile,initial:levelInitialGeometry,initialSolution:levelInitialSolution})');
  const buttons=r.supportMap.querySelectorAll('.map-point');
  for(let point=0;point<counts[index];point++){
   label=`support/${index}/${point}`;buttons.find(b=>Number(b.dataset.support)===point).click();
   for(const [control,step]of [['coarseAdjust',.01],['fineAdjust',.001]]){
    r[control].click();const before=json('supportHeights');start=performance.now();r.raiseSupport.click();const elapsed=performance.now()-start;
    if(point===counts[index]-1)results.timings.push({index,operation:control+' raise',milliseconds:elapsed});
    test(()=>{json('supportHeights').forEach((v,i)=>near(v,before[i]+(i===point?step:0)));assert.deepEqual(json('({profile:machineProfile,initial:levelInitialGeometry,initialSolution:levelInitialSolution})'),state);assert.deepEqual(JSON.parse(storage.get(read('levelKey()'))),record());});
    r.lowerSupport.click();test(()=>assert.deepEqual(json('supportHeights'),before));
   }
   results.supportsExercised++;
  }
  label=`roundtrip/${index}`;const saved=record();r.raiseSupport.click();await load(saved);
  test(()=>assert.deepEqual(record(),saved));
  open(index);test(()=>assert.deepEqual(record(),saved));
  if(index===3){
   label='L3/middle-support-example-is-nonplanar';const individual=json('machineProfile'),initialShape=json('levelInitialGeometry');r.middlePreset.click();
   test(()=>{const heights=json('supportHeights');assert.equal(heights.filter(h=>h===.15).length,3);assert.equal(heights.filter(h=>h===0).length,12);assert(read('levelSolution.residual')>1e-4,'middle example must bend the surface rather than lift every support equally');assert.deepEqual(json('machineProfile'),individual);assert.deepEqual(json('levelInitialGeometry'),initialShape);});
   await load(saved);test(()=>assert.deepEqual(record(),saved));
  }
  if([0,1,3].includes(index)){
   label=`reordered-object-properties/${index}`;
   const reordered=structuredClone(saved);reordered.supportLayout={points:saved.supportLayout.points.map(p=>({group:p.group,z:p.z,id:p.id,x:p.x})),id:saved.supportLayout.id};
   test(()=>assert.equal(Boolean(read(`validLevelRecord(${JSON.stringify(reordered)})`)),true));await load(reordered);test(()=>assert.deepEqual(record(),saved));
   const mutate=[q=>q.supportLayout.id+='-wrong',q=>q.supportLayout.points.reverse(),q=>q.supportLayout.points[0].id+='-wrong',q=>q.supportLayout.points[0].x+=.001,q=>q.supportLayout.points[0].z+=.001,q=>q.supportLayout.points[0].group+='-wrong',q=>q.supportLayout.points.pop(),q=>{delete q.supportLayout;},q=>q.version=2];
   for(const [j,change]of mutate.entries()){
    label=`reject-mismatched-layout/${index}/${j}`;const invalid=structuredClone(saved);change(invalid);const before=record();
    test(()=>assert.equal(Boolean(read(`validLevelRecord(${JSON.stringify(invalid)})`)),false));await load(invalid);test(()=>assert.deepEqual(record(),before));
   }
  }
 }
 console.log(JSON.stringify(results,null,2));if(results.failures.length)process.exitCode=1;
}
main().catch(e=>{results.failures.push({label,message:e.stack});console.log(JSON.stringify(results,null,2));process.exitCode=1;});

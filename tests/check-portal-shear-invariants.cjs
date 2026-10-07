'use strict';
// Independent tests for the mean-column shear teaching model. No solver/frame
// construction is reused as an oracle: visible lines, motion differences and
// Euclidean dot products define the expected angles.
const assert=require('node:assert/strict');
const makeEnvironment=require('./leveling-dom-env.cjs');
const MachineAccuracy=require('../src/machine-accuracy.js');
let checks=0;const failures=[];
function check(name,fn){checks++;try{fn();}catch(error){failures.push(name+': '+error.message);}}
const near=(a,b,t=1e-8)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,`${a} != ${b}`);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const unit=a=>a.map(v=>v/Math.hypot(...a));
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const vectorNear=(a,b,t=1e-8)=>a.forEach((v,i)=>near(v,b[i],t));
const pure=makeEnvironment({pureLeveling:true});
const open=(e,index)=>e.read(`openMachine(machines[${index}]);`);
const values=e=>e.json('levelGeometry.pairs.map(p=>p.deviationMicroradians)');
const direction=(e,key)=>e.json(`levelGeometry.directions.find(a=>a.key==='${key}').direction`);
const update=(e,pattern,Y=0,Z=0)=>e.read(`positions={X:0,Y:${Y},Z:${Z},A:0,C:0};supportHeights=supports.map((s,i)=>${pattern});updateLeveling();`);
const lateral="s.group?.startsWith('column-')?.02*(s.x-(s.x<0?-1.1:1.1)):0";
const opposite="s.group?.startsWith('column-')?(s.x<0?-1:1)*.02*(s.x-(s.x<0?-1.1:1.1)):0";
const foreaft="s.group==='column-left'?.02*(s.z-.825):0";
const leftOnly="s.group==='column-left'?.02*(s.x+1.1):0";

for(const index of [3,4]){
 open(pure,index);
 for(const plane of ['.04','.04+.017*s.x-.023*s.z','.02+.031*s.z']){
  update(pure,plane);
  check(`portal ${index} uniform/affine supports cannot create squareness ${plane}`,()=>values(pure).forEach(v=>near(v,0,1e-7)));
 }
 const pattern=index===3?leftOnly:'.01*s.x*s.z';
 update(pure,pattern);const before=values(pure);
 pure.read('supportHeights=supportHeights.map(h=>h+.01);updateLeveling();');
 check(`portal ${index} common vertical translation preserves angles`,()=>vectorNear(values(pure),before,1e-7));
 update(pure,pattern);
 check(`portal ${index} reversing a common vertical translation restores`,()=>vectorNear(values(pure),before,1e-8));
}

// Equal lateral lean of the columns is NOT a common rigid-machine rotation:
// the long bed is flat and the line joining their tops stays horizontal.
// That line and the mean column-up direction need not be perpendicular.
open(pure,3);pure.registry.exaggerate.checked=false;
update(pure,lateral);
check('same-direction lateral lean changes YZ at first order',()=>assert.ok(Math.abs(pure.read("levelGeometry.pairs.find(p=>p.key==='YZ').deviationMicroradians"))>1));
check('same-direction lateral lean with flat bed preserves XY',()=>near(pure.read("levelGeometry.pairs.find(p=>p.key==='XY').deviationMicroradians"),0,1e-7));
update(pure,opposite);
check('opposite symmetric lateral lean cancels in the mean-up model',()=>near(pure.read("levelGeometry.pairs.find(p=>p.key==='YZ').deviationMicroradians"),0,1e-5));
const reversed=[];
for(const sign of [-1,1]){
 update(pure,`(${foreaft})*(${sign})`);
 reversed.push(pure.read("levelGeometry.pairs.find(p=>p.key==='XY').deviationMicroradians"));
}
check('reversed fore/aft column lean reverses XY without an absolute-error rule',()=>assert.ok(reversed[0]*reversed[1]<0&&Math.min(...reversed.map(Math.abs))>1));

// World positions pass through the actual rendering path. A line tangent and
// a ram's finite displacement must agree with the displayed/calculated guide
// directions. Exaggeration may change visible angles but never metric angles.
function world(e,p,axes){return e.json(`levelMappedBodyVisualPoint(displayTransformedPoint(${JSON.stringify(p)},${JSON.stringify(axes)},current,positions,'tool'),'tool')`);}
function arrow(e,key){return e.json(`(()=>{const a=axisIndicators(current,createGeometry(current)).find(a=>a.key==='${key}'),o=a.points[0].map((v,i)=>(v+a.points[1][i])/2),p=a.points.map(q=>levelAxisVisualPoint(q,o,a.pose,a.bodyOrigin,a.key));return p[1].map((v,i)=>v-p[0][i]);})()`);}
for(const index of [3,4]){
 open(pure,index);
 for(const pattern of index===3?[lateral,opposite,foreaft,leftOnly]:['.01*s.x*s.z','i===0?.01:0']){
  let invariant;
  for(const Y of [-100,0,100])for(const exaggerated of [false,true]){
   pure.registry.exaggerate.checked=exaggerated;update(pure,pattern,Y,0);
   const g=values(pure);if(!invariant)invariant=g;
   check(`metric angle independent of Y and visual gain ${index}/${pattern}/${Y}/${exaggerated}`,()=>vectorNear(g,invariant,1e-7));
   const gz=pure.read('current.columnZ??0'),cx=.15+.65*Y/100;
   const ends=[cx-.1,cx+.1].map(x=>pure.json(`levelBodyVisualPoint([${x},2.9,${gz-.37}],'tool')`));
   const beamTangent=unit(sub(ends[1],ends[0]));
   check(`drawn Y guide agrees with its arrow ${index}/${pattern}/${Y}/${exaggerated}`,()=>vectorNear(beamTangent,unit(arrow(pure,'Y')),1e-8));
   const p=[.15,2.67,gz-.23],axes=index===3?['Y','Z']:['X','Y','Z'];
   const low=world(pure,p,axes);
   pure.read('positions.Z=1;updateLeveling();');const high=world(pure,p,axes),ramDirection=unit(sub(high,low));
   check(`ram displacement agrees with Z arrow ${index}/${pattern}/${Y}/${exaggerated}`,()=>vectorNear(ramDirection,unit(arrow(pure,'Z')),1e-8));
   if(!exaggerated){
    check(`physical rendered Y/Z directions match precision ${index}/${pattern}/${Y}`,()=>{vectorNear(beamTangent,direction(pure,'Y'),1e-8);vectorNear(ramDirection,direction(pure,'Z'),1e-8);});
    check(`local XY/XZ/YZ diagrams match rendered line angles ${index}/${pattern}/${Y}`,()=>{
     const directions={X:unit(arrow(pure,'X')),Y:beamTangent,Z:ramDirection};
     for(const pair of ['XY','XZ','YZ']){
      const expected=-Math.asin(Math.max(-1,Math.min(1,dot(directions[pair[0]],directions[pair[1]]))))*1e6;
      near(pure.read(`levelGeometry.pairs.find(p=>p.key==='${pair}').deviationMicroradians`),expected,1e-3);
      // The live cards now show finite contact scans. The local-angle diagram
      // remains in settings; its deviation is the quantity compared here.
      const diagram=pure.registry.accuracyDiagram.querySelectorAll('g').find(group=>group.dataset.pair===pair);
      near(Number(diagram.dataset.deviation),expected,1e-3);
     }
    });
   }
  }
 }
}

// One support action can improve or worsen the same pair depending on the
// initial fixed error. A synthetic signed profile isolates that requirement.
open(pure,3);pure.registry.exaggerate.checked=false;
const outcomes=[];
for(const sign of [-1,1]){
 const profile={squareness:{XY:{microns:0},XZ:{microns:0},YZ:{microns:sign*100}}};
 update(pure,'0');const start=pure.read(`geometryModel(positions,levelSolution,${JSON.stringify(profile)}).pairs.find(p=>p.key==='YZ').deviationMicroradians`);
 update(pure,lateral);const finish=pure.read(`geometryModel(positions,levelSolution,${JSON.stringify(profile)}).pairs.find(p=>p.key==='YZ').deviationMicroradians`);
 outcomes.push(Math.abs(finish)-Math.abs(start));
}
check('same lateral adjustment improves one signed intrinsic YZ and worsens the other',()=>assert.ok(outcomes[0]*outcomes[1]<0));

(async()=>{
 const live=makeEnvironment();open(live,3);
 const profile=MachineAccuracy.generate('used',38192,['X','Y','Z'],15);
 live.read(`initializeMachineAccuracy(${JSON.stringify(profile)});supportHeights=supports.map(()=>0);updateLeveling();`);
 const flat=values(live);
 update(live,'.02+.017*s.x-.023*s.z');
 check('common rigid plane preserves intrinsic pair values under shear model',()=>vectorNear(values(live),flat,1e-7));
 // Button-level reversible operation and JSON round trip.
 live.read('supportHeights=supports.map(()=>0);setTrainingMenuOpen(false);selected=11;updateLeveling();');
 const initial=values(live);live.registry.coarseAdjust.click();live.registry.raiseSupport.click();
 const changed=values(live);live.registry.lowerSupport.click();
 check('real support buttons reverse the shear state',()=>vectorNear(values(live),initial,1e-7));
 live.registry.raiseSupport.click();const record=live.json('levelRecord()');
 check('shear model does not retain the old calculation identifier',()=>assert.ok(record.calculationModel&&record.calculationModel!=='connected-frames-v1'));
 live.read(`applyLevelRecord(${JSON.stringify(record)});updateLeveling();`);
 check('new-model save/restore preserves data and angles',()=>{assert.deepEqual(live.json('levelRecord()'),record);vectorNear(values(live),changed,1e-7);});
 const legacy={...record,calculationModel:'connected-frames-v1'},bytes=JSON.stringify(legacy),oldKey=live.read("'training-level-connected-frames-v1:'+current.id+':'+machineMode+':'+current.layoutId");
 live.storage.set(oldKey,bytes);
 await live.registry.importLevel.onchange({target:{value:'legacy',files:[{size:bytes.length,text:async()=>bytes}]}});
 check('old connected-frame JSON is rejected without mutation',()=>{assert.deepEqual(live.json('levelRecord()'),record);assert.match(live.registry.levelInputMessage.textContent,/計算|旧/);});
 open(live,3);
 check('previous connected-frame save is retained byte-for-byte',()=>assert.equal(live.storage.get(oldKey),bytes));
 console.log(JSON.stringify({checks,failures},null,2));if(failures.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});

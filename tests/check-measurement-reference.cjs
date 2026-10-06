'use strict';
// Independent acceptance checks for the approved datum/sign convention.
// Nominal world axes and expected location words are listed here explicitly;
// expected signs do not come from the UI's reference helper.
const assert=require('node:assert/strict');
const createEnvironment=require('./leveling-dom-env.cjs');
const e=createEnvironment({pureLeveling:true}),r=e.registry;
let checks=0;const failures=[];
const check=(name,fn)=>{checks++;try{fn();}catch(error){failures.push(name+': '+error.message);}};
const near=(a,b,t=1e-8)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,`${a} != ${b}`);
const counts={compact:4,horizontal:8,travel:6,double:15,gantry:8,five:3,lathe:6};
const expected={
 compact:{XY:['X','Y','左手前','右','奥','左','右'],XZ:['X','Z','左下','右','上','左','右'],YZ:['Y','Z','手前下','奥','上','手前','奥']},
 horizontal:{XY:['X','Y','左下','右','上','左','右'],XZ:['X','Z','左手前','右','奥','左','右'],YZ:['Y','Z','手前下','上','奥','下','上']},
 double:{XY:['X','Y','左手前','奥','右','手前','奥'],XZ:['X','Z','手前下','奥','上','手前','奥'],YZ:['Y','Z','左下','右','上','左','右']},
 lathe:{XZ:['Z','X','左手前','右','奥','左','右']}
};
expected.travel=expected.compact;expected.five=expected.compact;expected.gantry=expected.double;
const values=()=>Array.from({length:4},(_,i)=>r['sweepValue'+i].getAttribute('data-reading-microns'));
const diagramState=()=>r.liveSquareness.querySelectorAll('svg').map(s=>({pair:s.dataset.pair,value:s.getAttribute('data-current-error-300'),tip:[s.dataset.tipX,s.dataset.tipY],projection:s.dataset.projection}));
// Bounds are checked on the rendered projected geometry, including the plate's
// far corner (which differs from its origin and compared-axis endpoint).
function projectedBounds(svg){
 const view=svg.getAttribute('viewBox').split(/[ ,]+/).map(Number),plane=svg.querySelectorAll('.pair-plane')[0];
 const parse=node=>node.getAttribute('transform').match(/matrix\(([^)]+)\)/)[1].split(/[ ,]+/).map(Number);
 const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
 // Include every display-only ancestor projection. The inner plane/data
 // projection remains independently checked against the physical directions.
 let m=parse(plane);for(let node=plane.parentElement;node&&node!==svg;node=node.parentElement)if(node.getAttribute('transform'))m=multiply(parse(node),m);
 const inside=(x,y,name)=>{assert.ok(x>=view[0]+1&&x<=view[0]+view[2]-1&&y>=view[1]+1&&y<=view[1]+view[3]-1,`${svg.dataset.pair} ${name} projected (${x},${y}) clips viewBox ${view}`);};
 const project=(x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
 const projectNode=(node,x,y)=>{if(!node.getAttribute('transform'))return project(x,y);const n=multiply(m,parse(node));return[n[0]*x+n[2]*y+n[4],n[1]*x+n[3]*y+n[5]];};
 const tokens=plane.querySelectorAll('.reference-board')[0].getAttribute('d').match(/[A-Za-z]|-?(?:\d*\.)?\d+/g);let x=0,y=0;
 for(let i=0;i<tokens.length;){const command=tokens[i++];if(command==='M'||command==='L'){x=Number(tokens[i++]);y=Number(tokens[i++]);}else if(command==='H')x=Number(tokens[i++]);else if(command==='V')y=Number(tokens[i++]);else if(command==='Z')continue;else throw Error('Unsupported board command '+command);inside(...project(x,y),'board corner');}
 for(const line of plane.querySelectorAll('line'))for(const suffix of ['1','2'])inside(...projectNode(line,Number(line.getAttribute('x'+suffix)),Number(line.getAttribute('y'+suffix))),'line endpoint');
 for(const dot of plane.querySelectorAll('circle')){const x=Number(dot.getAttribute('cx')),y=Number(dot.getAttribute('cy')),radius=Number(dot.getAttribute('r'));for(const [dx,dy] of [[radius,0],[-radius,0],[0,radius],[0,-radius]])inside(...projectNode(dot,x+dx,y+dy),'dot edge');}
}
for(const kind of Object.keys(counts)){
 e.storage.clear();e.read(`openMachine(machines.find(m=>m.kind==='${kind}'));supportHeights=supports.map((s,i)=>[.025,-.012,.018,-.009,.005,-.011][i%6]);updateLeveling();`);
 check(kind+' preserves support count',()=>assert.equal(e.read('supports.length'),counts[kind]));
 const record=e.json('levelRecord()'),before=e.json('levelGeometry.pairs'),drawn=diagramState(),sweep=values();
 for(const [key,wanted] of Object.entries(expected[kind])){
  check(kind+'/'+key+' reference agrees with approved machine-specific directions',()=>{
   const ref=e.json(`squarenessReference({key:'${key}'})`);
   assert.deepEqual([ref.zero,ref.baseDirection,ref.measureDirection,ref.positive,ref.negative],wanted.slice(2));
  });
  for(const deviation of [-3000,-100,-1,0,1,100,3000]){
   e.read(`accuracyDiagram({pairs:[{key:'${key}',deviationMicroradians:${deviation}}]},{pairs:[{key:'${key}',deviationMicroradians:0}]});`);
   check(kind+'/'+key+' signed local angle '+deviation,()=>{
    const svg=r.liveSquareness.querySelectorAll('svg')[0],line=svg.querySelectorAll('.pair-current')[0],base=svg.querySelectorAll('.pair-base')[0];
    const x=Number(line.getAttribute('x2'))-Number(line.getAttribute('x1')),y=Number(line.getAttribute('y2'))-Number(line.getAttribute('y1'));
    const bx=Number(base.getAttribute('x2'))-Number(base.getAttribute('x1')),by=Number(base.getAttribute('y2'))-Number(base.getAttribute('y1'));
    const dot=(x*bx+y*by)/Math.hypot(x,y)/Math.hypot(bx,by);
    // Positive means an obtuse opening, i.e. negative baseline projection.
    assert.equal(Math.sign(dot),deviation===0?0:-Math.sign(deviation));
    near((Math.acos(Math.max(-1,Math.min(1,dot)))-Math.PI/2),Math.max(-.65,Math.min(.65,deviation*.005)),1e-12);
    near(Number(svg.getAttribute('data-current-error-300')),deviation*.3);assert.equal(svg.dataset.base,wanted[0]);assert.equal(svg.dataset.other,wanted[1]);
    assert.deepEqual([svg.dataset.zeroLocation,svg.dataset.baseDirection,svg.dataset.measureDirection,svg.dataset.positiveDirection,svg.dataset.negativeDirection],wanted.slice(2));
    const plane=svg.querySelectorAll('.pair-plane')[0];assert(plane,'oblique plate projection is present');
    const matrix=(plane.getAttribute('transform').match(/matrix\(([^)]+)\)/)||[])[1]?.split(/[ ,]+/).map(Number);
    assert.equal(matrix?.length,6);assert.ok(matrix.every(Number.isFinite));assert.ok(Math.abs(matrix[0]*matrix[3]-matrix[1]*matrix[2])>.05,'projection is invertible');
    assert.deepEqual(svg.dataset.projection.split(',').map(Number),matrix);
    const physicalDirection=(v,label)=>{if(label==='右'){assert.ok(v[0]>0);near(v[1],0);}else if(label==='上'){near(v[0],0);assert.ok(v[1]<0);}else {assert.equal(label,'奥');assert.ok(v[0]>0&&v[1]<0);}};
    physicalDirection([matrix[0],matrix[1]],wanted[3]);physicalDirection([-matrix[2],-matrix[3]],wanted[4]);
    const detail=r.measurementReferenceCards.querySelectorAll('svg')[0];assert.equal(detail.dataset.projection,svg.dataset.projection);assert.equal(detail.getAttribute('data-current-error-300'),svg.getAttribute('data-current-error-300'));
    projectedBounds(svg);projectedBounds(detail);
    const card=detail.parentElement;assert.match(card.textContent,new RegExp('仮想の接触：'+wanted[5]+'側から'+wanted[6]+'向きに当てる'));
    const signLabels=detail.querySelectorAll('.reference-side-label');assert.equal(signLabels.length,2);assert.equal(signLabels[0].textContent,'＋ '+wanted[5]);assert.equal(signLabels[1].textContent,'− '+wanted[6]);
    const signedVector=[Number(signLabels[0].getAttribute('x'))-Number(signLabels[1].getAttribute('x')),Number(signLabels[0].getAttribute('y'))-Number(signLabels[1].getAttribute('y'))];assert.ok(signedVector[0]*matrix[0]+signedVector[1]*matrix[1]<0,'positive label lies opposite the datum arrow');
   });
  }
 }
 e.read('accuracyKey="";updateLeveling();');
 check(kind+' detail toggle preserves the machine and readings',()=>{r.measurementReferenceToggle.click();assert.equal(r.measurementReference.hidden,false);assert.equal(r.measurementReferenceToggle.getAttribute('aria-expanded'),'true');assert.deepEqual(e.json('levelRecord()'),record);assert.deepEqual(diagramState(),drawn);r.closeMeasurementReference.click();assert.equal(r.measurementReference.hidden,true);assert.equal(r.measurementReferenceToggle.getAttribute('aria-expanded'),'false');});
 r.raiseSupport.click();r.lowerSupport.click();
 check(kind+' inverse support adjustments restore numeric and drawn state',()=>{assert.deepEqual(e.json('levelGeometry.pairs'),before);assert.deepEqual(diagramState(),drawn);});
 e.read('yaw=-.91;setSceneZoom(1.7);setTrainingMenuOpen(true);setTrainingMenuOpen(false);');r.exaggerate.checked=true;r.exaggerate.onchange();
 check(kind+' view/zoom/sidebar/exaggeration do not change geometry, signs or saved data',()=>{assert.deepEqual(e.json('levelGeometry.pairs'),before);assert.deepEqual(diagramState(),drawn);assert.deepEqual(e.json('levelRecord()'),record);});
 e.read(`positions.X=37;supportHeights[0]+=.12;updateLeveling();applyLevelRecord(${JSON.stringify(record)});buildSupports();updateLeveling();`);
 check(kind+' save/load restores geometry and display',()=>{assert.deepEqual(e.json('levelRecord()'),record);assert.deepEqual(e.json('levelGeometry.pairs'),before);assert.deepEqual(diagramState(),drawn);});
 if(['horizontal','lathe'].includes(kind)){
  check(kind+' no dial added',()=>{assert.equal(r.spindleSweepPanel.hidden,true);assert.equal(e.read('spindleSweepGeometry().valid'),false);});continue;
 }
 check(kind+' angle notation removed from visible and accessible dial labels',()=>{
  assert.equal(r.spindleSweepPanel.hidden,false);
  for(let i=0;i<4;i++){const button=r['sweepPosition'+i],label=button.getAttribute('aria-label');assert.match(label,new RegExp('^'+['右','奥','左','手前'][i]));assert.doesNotMatch(label+button.textContent,/°|(?:0|90|180|270)度/);}
  assert.doesNotMatch(r.sweepMeasurementNote.textContent+r['scene-readout-sweep-note'].textContent,/°|(?:0|90|180|270)度/);
 });
 check(kind+' readings restore and front is exact zero when valid',()=>{assert.deepEqual(values(),sweep);const g=e.json('spindleSweepGeometry()');if(g.cardinal[3].onTable){assert.equal(Number(r.sweepValue3.dataset.readingMicrons),0);for(let i=0;i<4;i++)if(g.cardinal[i].onTable)near(Number(values()[i]),g.cardinal[i].readingMicrons);}});
 // Narrowing table depth creates a known front-reference miss while preserving
 // the same angle calculation. No forced production-helper return values.
 e.read(`levelConfig.depth=.5;positions={X:${kind==='gantry'?-100:100},Y:${kind==='travel'?-100:100},Z:0,A:0,C:0};updateLeveling();`);
 check(kind+' off-table front suppresses every numeric display',()=>{assert.equal(e.read('spindleSweepGeometry().cardinal[3].onTable'),false);assert.ok(values().every(v=>v===''));assert.match(r.sweepContactStatus.textContent,/手前.*面外/);});
}
console.log(JSON.stringify({checks,failures},null,2));if(failures.length)process.exitCode=1;

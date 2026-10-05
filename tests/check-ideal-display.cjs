'use strict';
// The ideal outline is a geometric reference, not another leveling state.
// Derive its points from physical dimensions and nominal mechanisms, then
// compare them to the production world points without using support frames,
// intrinsic-body rotations, or the ideal transform's implementation.
const assert=require('node:assert/strict');
const MachineAccuracy=require('../src/machine-accuracy.js');
const {registry:r,read,json,storage}=require('./leveling-dom-env.cjs')({pureLeveling:true});
const variants=[[0,'compact'],[1,''],[2,''],[3,'l3-3000'],[4,''],[5,''],[6,'']];
const states=[{X:0,Y:0,Z:0,A:0,C:0},{X:73,Y:-42,Z:55,A:-67,C:82},{X:-100,Y:100,Z:-100,A:100,C:-100}];
const literal=JSON.stringify,subtract=(a,b)=>a.map((v,i)=>v-b[i]),norm=v=>Math.hypot(...v),unit=v=>v.map(n=>n/norm(v));
const result={checks:{nominalGeometry:0,flatAgreement:0,supportAdjustment:0,intrinsicRemoval:0,linearMotion:0,rotaryRigidity:0,viewAndToggle:0},vertices:0,maximumPointDifference:0,failures:[]};
let name='';
function check(kind,fn){try{fn();result.checks[kind]++;}catch(e){result.failures.push({kind,name,message:e.message});}}
function pointNear(a,b,tolerance=1e-8){const d=norm(subtract(a,b));result.maximumPointDifference=Math.max(result.maximumPointDifference,d);assert(d<tolerance,`${literal(a)} != ${literal(b)} (${d})`);}
function open(index,mode){storage.clear();read(`openMachine(machines[${index}]);`);if(mode)r.machineMode.change(mode);}
function physicalState(){return json('({record:levelRecord(),solution:levelSolution,geometry:levelGeometry,initialGeometry:levelInitialGeometry,initialSolution:levelInitialSolution,range:accuracyRange,profile:machineProfile,reference:machineReference,best:machineSavedBest,fineStart:fineStartEvaluation,stage:adjustmentStage,positions,supportHeights,levelConfig})');}
function profile(){const p=MachineAccuracy.generate('used',123,json('machineLinearKeys()'),read('supports.length'));read(`machineProfile=${literal(p)};machineReference=null;`);}
function setState(state){read(`positions=${literal(state)};updateLeveling(false);`);}
function setHeights(fn){read(`supportHeights=${literal(json('supports').map((s,i)=>Math.round(fn(s,i)*1000)/1000))};updateLeveling(false);`);}
function bodyFaces(){return json("createGeometry(current).faces.filter(f=>!f.pose.startsWith('pad:')&&!f.pose.startsWith('support:'))");}
function idealFaces(faces){return json(`(()=>{const model=${literal(faces)},before=JSON.stringify(model),context=idealDisplayContext(current),contextBefore=JSON.stringify(context),points=model.map(f=>f.v.map(p=>idealDisplayPoint(p,f.axes,f.pose,context)));return {points,inputUnchanged:before===JSON.stringify(model),contextUnchanged:contextBefore===JSON.stringify(context)};})()`);}
function currentFaces(faces){return json(`(${literal(faces)}).map(f=>f.v.map(p=>levelMappedBodyVisualPoint(displayTransformedPoint(p,f.axes,current,positions,f.pose),f.pose)))`);}
function rotate(vector,axis,theta){
 const c=Math.cos(theta),s=Math.sin(theta),dot=vector.reduce((sum,v,i)=>sum+v*axis[i],0),cross=[axis[1]*vector[2]-axis[2]*vector[1],axis[2]*vector[0]-axis[0]*vector[2],axis[0]*vector[1]-axis[1]*vector[0]];
 return vector.map((v,i)=>v*c+cross[i]*s+axis[i]*dot*(1-c));
}
function parameters(){
 const m=json('current'),config=json('levelConfig'),state=json('positions'),heights=json('supportHeights'),sx=config.width/(m.w*.8),sz=config.depth/(m.d*.8),single=['vertical','compact','travel','horizontal','five'].includes(m.kind);
 return {m,config,state,sx,sz,axes:json('axisConfig(current)'),offset:single?[m.w*.2*config.columnX/100*sx,0,m.d*.1*config.columnZ/100*sz]:[0,0,0],lift:read('displayClearance()')+read('displayFactor()')*heights.reduce((sum,h)=>sum+h/heights.length,0)/1000};
}
function expectedPoint(raw,axes,pose,p){
 let q=[raw[0]*p.sx,raw[1],raw[2]*p.sz],pivot=[0,1.25,-.45*p.sz];
 if(axes.includes('C'))q=rotate(subtract(q,pivot),[0,1,0],p.state.C*Math.PI/100).map((v,i)=>v+pivot[i]);
 if(axes.includes('A'))q=rotate(subtract(q,pivot),[1,0,0],p.state.A*.45/100).map((v,i)=>v+pivot[i]);
 for(const a of p.axes)if(['X','Y','Z'].includes(a.key)&&axes.includes(a.key))q=q.map((v,i)=>v+a.vector[i]*[p.sx,1,p.sz][i]*a.amp*p.state[a.key]/100);
 if(pose==='tool')q=q.map((v,i)=>v+p.offset[i]);q[1]+=p.lift;return q;
}
function idealPoint(raw,axes=[],pose='tool'){return json(`idealDisplayPoint(${literal(raw)},${literal(axes)},${literal(pose)},idealDisplayContext(current))`);}
function currentPoint(raw,axes=[],pose='tool'){return json(`levelMappedBodyVisualPoint(displayTransformedPoint(${literal(raw)},${literal(axes)},current,positions,${literal(pose)}),${literal(pose)})`);}
assert.equal(r.showIdealOutline.checked,true,'the ideal reference starts enabled');
// Every actual model vertex retains nominal size, layout, linear positions and
// A/C hierarchy while both kinds of error are removed. A single vertical lift
// follows the current arithmetic mean support height; local heights do not.
for(const [index,mode] of variants){
 open(index,mode);profile();const kind=read('current.kind'),defaults=json('[levelConfig.width,levelConfig.depth]'),size=json('[current.w*.8,current.d*.8]');
 read('levelConfig.columnX=35;levelConfig.columnZ=-21;');
 for(const [width,depth] of [defaults,[.5,20],[20,.5]])for(const exaggerated of [false,true])for(const pattern of ['flat','tilt','twist','middle'])for(const state of states){
  read(`levelConfig.width=${width};levelConfig.depth=${depth};$('exaggerate').checked=${exaggerated};`);
  setHeights((s,i)=>pattern==='flat'?.17:pattern==='tilt'?.14*s.x/(size[0]/2)-.11*s.z/(size[1]/2):pattern==='twist'?.2*s.x/(size[0]/2)*s.z/(size[1]/2):[.31,-.28,.14,-.09,.23,-.17,.34,-.21][i%8]);setState(state);
  const faces=bodyFaces(),snapshot=physicalState(),saved=[...storage],actual=idealFaces(faces),p=parameters();name=`${kind}/${width}x${depth}/${pattern}/exaggerated=${exaggerated}/positions=${literal(state)}`;
  check('nominalGeometry',()=>{
   assert(actual.inputUnchanged&&actual.contextUnchanged,'ideal transformation mutates its inputs');
   faces.forEach((f,j)=>f.v.forEach((raw,i)=>{pointNear(actual.points[j][i],expectedPoint(raw,f.axes,f.pose,p));result.vertices++;}));
   assert.deepEqual(physicalState(),snapshot);assert.deepEqual([...storage],saved);
  });
 }
 // The ideal reference and current model coincide when installation and
 // intrinsic errors are absent, including nonzero mean height and all axes.
 read('machineProfile=null;machineReference=null;');
 for(const [width,depth] of [defaults,[.5,20],[20,.5]])for(const exaggerated of [false,true])for(const state of states){
  read(`levelConfig.width=${width};levelConfig.depth=${depth};$('exaggerate').checked=${exaggerated};`);setHeights(()=>.17);setState(state);
  const faces=bodyFaces(),ideal=idealFaces(faces).points,current=currentFaces(faces);name=`${kind}/${width}x${depth}/no-error/exaggerated=${exaggerated}/${literal(state)}`;
  check('flatAgreement',()=>faces.forEach((f,j)=>f.v.forEach((_,i)=>pointNear(ideal[j][i],current[j][i]))));
 }
}
for(const [index,mode] of variants){
 open(index,mode);profile();read('levelConfig.columnX=35;levelConfig.columnZ=-21;');setState(states[1]);
 const kind=read('current.kind'),size=json('[current.w*.8,current.d*.8]');setHeights(()=>.1);
 const q=[.13,.66,-.09],top=[.13,1.66,-.09],beforeIdeal=[idealPoint(q),idealPoint(top)],beforeCurrent=[currentPoint(q),currentPoint(top)],beforeLift=parameters().lift;
 setHeights(s=>.1+.16*s.x/(size[0]/2)-.09*s.z/(size[1]/2));name=kind+'/support-adjustment';
 check('supportAdjustment',()=>{
  const afterIdeal=[idealPoint(q),idealPoint(top)],afterCurrent=[currentPoint(q),currentPoint(top)],deltaLift=parameters().lift-beforeLift;
  pointNear(subtract(beforeIdeal[1],beforeIdeal[0]),[0,1,0]);pointNear(subtract(afterIdeal[1],afterIdeal[0]),[0,1,0]);
  beforeIdeal.forEach((point,i)=>pointNear(afterIdeal[i],point.map((v,k)=>v+(k===1?deltaLift:0))));
  assert(norm(subtract(subtract(afterCurrent[1],afterCurrent[0]),subtract(beforeCurrent[1],beforeCurrent[0])))>1e-5,'current column does not follow support adjustment');
 });
 // Inspect the representative solid-body direction. For the lathe it is
 // horizontal Z, so checking only a vertical edge would miss its intrinsic
 // error. The reference remains nominal while the current body keeps it.
 setState(states[0]);setHeights(()=>0);const p=parameters(),representative=p.axes.find(a=>Math.abs(a.vector[1])===1)||p.axes.find(a=>a.key==='Z'),end=q.map((v,i)=>v+representative.vector[i]);name=kind+'/intrinsic-only';
 check('intrinsicRemoval',()=>{
  const ideal=subtract(idealPoint(end),idealPoint(q)),current=subtract(currentPoint(end),currentPoint(q)),nominal=representative.vector.map((v,i)=>v*[p.sx,1,p.sz][i]);
  pointNear(unit(ideal),unit(nominal));if(['double','gantry'].includes(kind)){pointNear(unit(current),unit(nominal));assert(read('levelGeometry.pairs.some(p=>Math.abs(p.deviationMicroradians)>1e-6)'),'guide errors remain while connected skeleton omits them');}else assert(norm(subtract(unit(current),unit(nominal)))>1e-6,'current intrinsic body error was removed');
 });
 for(const axis of p.axes.filter(a=>['X','Y','Z'].includes(a.key))){
  const axes=axis.key==='X'?['X','Y']:axis.key==='Y'?['X','Y']:['X','Y','Z'],beforeState={...states[1],[axis.key]:-100},afterState={...states[1],[axis.key]:100};
  setState(beforeState);const a=idealPoint(q,axes,'work');setState(afterState);const b=idealPoint(q,axes,'work');name=kind+'/nominal-slide/'+axis.key;
  check('linearMotion',()=>pointNear(subtract(b,a),axis.vector.map((v,i)=>v*[p.sx,1,p.sz][i]*axis.amp*2)));
 }
 // View controls and the overlay checkbox are display state. They must not
 // change the calculation, initial comparison, profile, JSON or local save.
 const stateBefore=physicalState(),savedBefore=[...storage];
 for(const enabled of [false,true])for(const view of ['front','side','oblique'])for(const zoom of [.65,1,1.8]){
  r.showIdealOutline.checked=enabled;r.showIdealOutline.change();read(`setSceneView(${literal(view)});setSceneZoom(${zoom});`);name=kind+'/toggle='+enabled+'/'+view+'/zoom='+zoom;
  check('viewAndToggle',()=>{assert.deepEqual(physicalState(),stateBefore);assert.deepEqual([...storage],savedBefore);assert(read('validLevelRecord(levelRecord())'),'view operations produced an invalid saved record');assert.equal(Object.hasOwn(json('levelRecord()'),'showIdealOutline'),false);const p=parameters();pointNear(idealPoint(q,['X','Y'],'work'),expectedPoint(q,['X','Y'],'work',p));});
 }
}
// Rotary motion preserves physical rigid edges after anisotropic mapping.
// Compare real model faces, rather than repeating the angle transform only.
open(5,'');profile();setHeights((s,i)=>[.3,-.2,.1][i]);
for(const [width,depth] of [[.5,20],[20,.5]]){
 read(`levelConfig.width=${width};levelConfig.depth=${depth};`);setState(states[0]);const faces=bodyFaces().filter(f=>f.axes.includes('A')||f.axes.includes('C')),base=idealFaces(faces).points,lengths=base.map((points,j)=>points.map((p,i)=>norm(subtract(p,points[(i+1)%points.length]))));
 for(const A of [-100,-37,0,63,100])for(const C of [-100,-50,0,50,100]){
  setState({...states[1],A,C});const actual=idealFaces(faces).points;name=`five/${width}x${depth}/A=${A}/C=${C}`;
  check('rotaryRigidity',()=>faces.forEach((f,j)=>f.v.forEach((_,i)=>assert(Math.abs(norm(subtract(actual[j][i],actual[j][(i+1)%f.v.length]))-lengths[j][i])<1e-8,'rotary motion distorts physical edge length'))));
 }
}
console.log(JSON.stringify(result,null,2));if(result.failures.length)process.exitCode=1;

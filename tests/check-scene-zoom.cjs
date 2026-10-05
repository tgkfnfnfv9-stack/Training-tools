'use strict';
// Exercise the real pointer/wheel handlers and Canvas rendering. Zoom is a
// viewing operation: physical geometry, precision, initial comparison and JSON
// must remain identical, including after pointer cancellation and navigation.
const assert=require('node:assert/strict');
const {registry:r,read,json,context,storage}=require('./leveling-dom-env.cjs')();
let checks=0,frames=0,coordinates=0,seed=41000;
context.window.crypto={getRandomValues:values=>{values[0]=seed++;return values;}};
function check(name,fn){try{fn();checks++;}catch(error){throw new Error(name+': '+error.message);}}
function near(actual,expected){assert(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);}
const captures=new Set();
r.scene.setPointerCapture=id=>captures.add(id);
r.scene.hasPointerCapture=id=>captures.has(id);
r.scene.releasePointerCapture=id=>{captures.delete(id);r.scene.events.lostpointercapture({pointerId:id});};
const pointer=(id,x,y=100,extra={})=>({pointerId:id,clientX:x,clientY:y,pointerType:'touch',isPrimary:id===1,button:0,...extra});
const down=(id,x,y=100,extra={})=>r.scene.events.pointerdown(pointer(id,x,y,extra));
const move=(id,x,y=100)=>r.scene.events.pointermove(pointer(id,x,y));
function end(type,id){r.scene.events[type](pointer(id,0));captures.delete(id);}
function wheel(deltaY,deltaMode=0){let prevented=0;r.scene.events.wheel({deltaY,deltaMode,preventDefault(){prevented++;}});return prevented;}
function key(value){let prevented=0;r.scene.events.keydown({key:value,preventDefault(){prevented++;}});return prevented;}
function recorder(){
 const trace={points:[],supports:[]};
 const finite=(...values)=>{values.forEach(v=>assert(Number.isFinite(v),'non-finite Canvas coordinate'));coordinates+=values.length;};
 const ctx={scale(x,y){finite(x,y);},beginPath(){},closePath(){},fill(){},stroke(){},
  fillRect(x,y,w,h){finite(x,y,w,h);if(x===0&&y===0){trace.points=[];trace.supports=[];frames++;}},
  moveTo(x,y){finite(x,y);trace.points.push([x,y]);},lineTo(x,y){finite(x,y);trace.points.push([x,y]);},
  arc(x,y,radius,...angles){finite(x,y,radius,...angles);trace.supports.push([x,y]);},
  fillText(text,x,y){finite(x,y);},measureText(text){return {width:[...text].length*7};}
 };
 return {ctx,trace};
}
const scene=recorder(),thumbnail=recorder();
r.scene.getContext=()=>scene.ctx;
r.scene.getBoundingClientRect=()=>({width:390,height:340});
const span=()=>{assert(scene.trace.supports.length>=2);const [a,b]=scene.trace.supports;return Math.hypot(a[0]-b[0],a[1]-b[1]);};
const physical=()=>json('({record:levelRecord(),heights:supportHeights,positions,solution:levelSolution,geometry:levelGeometry,profile:machineProfile,reference:machineReference,stage:adjustmentStage,fineStart:fineStartEvaluation})');
function resetView(){read('clearScenePointers();setSceneZoom(1)');}
const variants=[[0,'compact'],[1,''],[2,''],[3,'l3-3000'],[4,''],[5,''],[6,'']];
for(const [index,mode] of variants){
 storage.clear();read(`openMachine(machines[${index}])`);if(mode)r.machineMode.change(mode);
 const before=physical(),saved=[...storage],yaw=read('yaw');
 read('setSceneZoom(1);drawScene()');const baseSpan=span();
 for(const zoom of [.65,1.25,1.8]){
  read(`setSceneZoom(${zoom})`);
  check(`rendered support spacing follows viewing scale ${index}/${mode}/${zoom}`,()=>near(span()/baseSpan,zoom));
 }
 const thumb=r['thumb-'+read('current.id')];thumb.getContext=()=>thumbnail.ctx;thumb.getBoundingClientRect=()=>({width:320,height:180});
 read("setSceneZoom(1);render($('thumb-'+current.id),current,yaw,false,-1)");const thumbAtOne=thumbnail.trace.points.map(p=>[...p]);
 read("setSceneZoom(1.8);render($('thumb-'+current.id),current,yaw,false,-1)");
 check(`catalog rendering stays independent of viewing zoom ${index}/${mode}`,()=>assert.deepEqual(thumbnail.trace.points,thumbAtOne));
 resetView();assert.equal(wheel(-80),1);assert(read('sceneZoom')>1);
 down(1,100);down(2,200);move(2,220);
 check(`pinch changes scale without rotating ${index}/${mode}`,()=>{near(read('sceneZoom'),Math.exp(.12)*1.2);near(read('yaw'),yaw);});
 end('pointerup',2);move(1,110);end('pointerup',1);
 check(`return to one-finger rotation changes only the view ${index}/${mode}`,()=>{near(read('yaw'),yaw+.09);assert.deepEqual(physical(),before);assert.deepEqual([...storage],saved);assert(!captures.size);});
 check(`selected axis keeps current gesture instructions ${index}/${mode}`,()=>{assert.match(r.scene.getAttribute('aria-label'),/二本指.*ピンチ.*ホイール/);assert.match(r.scene.getAttribute('aria-label'),/Home/);});
}
read('openMachine(machines[5])');
const original=physical();
check('secondary mouse/pen and right button cannot start gestures',()=>{
 for(const extra of [{pointerType:'mouse',isPrimary:false},{pointerType:'pen',isPrimary:false},{pointerType:'mouse',button:2}]){
  const yaw=read('yaw');down(20,100,100,extra);move(20,200);near(read('yaw'),yaw);assert.equal(read('scenePointers.size'),0);assert(!captures.has(20));
 }
});
check('primary mouse and pen drag while unrelated events are ignored',()=>{
 for(const pointerType of ['mouse','pen']){
  const yaw=read('yaw');down(1,100,100,{pointerType,isPrimary:true});move(99,200);end('pointerup',99);move(1,110);
  near(read('yaw'),yaw+.09);near(read('sceneZoom'),1);end('pointerup',1);move(1,200);near(read('yaw'),yaw+.09);
 }
});
check('second non-primary touch starts pinch without a rotation jump',()=>{
 resetView();const yaw=read('yaw');down(1,100);move(1,110);down(2,210,100,{isPrimary:false});move(2,230);
 near(read('sceneZoom'),1.2);near(read('yaw'),yaw+.09);assert(captures.has(1)&&captures.has(2));
 end('pointerup',99);assert.equal(read('scenePointers.size'),2);move(2,240);near(read('sceneZoom'),1.3);
});
check('vertical pinch distance enlarges and shrinks independently of rotation',()=>{
 resetView();const yaw=read('yaw');down(1,100,100);down(2,100,200);move(2,100,250);near(read('sceneZoom'),1.5);move(2,100,175);near(read('sceneZoom'),.75);near(read('yaw'),yaw);
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])for(const released of [1,2]){
 check(`${type} of either touch returns to rotation without stale deltas`,()=>{
  resetView();const yaw=read('yaw');down(1,100);down(2,200);move(1,90);near(read('sceneZoom'),1.1);
  const remaining=released===1?2:1,x=remaining===1?90:200;end(type,released);move(released,900);near(read('yaw'),yaw);near(read('sceneZoom'),1.1);
  move(remaining,x+10);near(read('yaw'),yaw+.09);near(read('sceneZoom'),1.1);end(type,remaining);move(remaining,x+100);near(read('yaw'),yaw+.09);assert.equal(read('scenePointers.size'),0);
 });
}
check('three touches preserve the first pair, then rebase to the remaining pair',()=>{
 resetView();const yaw=read('yaw');down(1,0);down(2,100);down(3,180);move(1,-20);near(read('sceneZoom'),1.2);move(3,200);near(read('sceneZoom'),1.2);
 end('pointerup',1);move(3,230);near(read('sceneZoom'),1.56);near(read('yaw'),yaw);end('pointerup',3);move(2,110);near(read('yaw'),yaw+.09);end('pointerup',2);
});
check('coincident fingers safely establish a distance before zooming',()=>{
 resetView();const yaw=read('yaw');down(1,100);down(2,100);move(2,120);near(read('sceneZoom'),1);move(2,130);near(read('sceneZoom'),1.5);near(read('yaw'),yaw);
});
check('pinch limits prevent oversized and undersized view scales',()=>{
 resetView();down(1,0);down(2,100);move(2,10000);near(read('sceneZoom'),1.8);move(2,1);near(read('sceneZoom'),.65);
});
check('wheel units normalize pixels, lines and pages and only prevent scene scroll',()=>{
 resetView();near(wheel(10),1);near(read('sceneZoom'),Math.exp(-.015));
 resetView();near(wheel(1,1),1);near(read('sceneZoom'),Math.exp(-.024));
 resetView();near(wheel(.25,2),1);near(read('sceneZoom'),Math.exp(-.1275));
 assert.equal(wheel(0),0);assert.equal(r.trainingControls.events.wheel,undefined);
});
check('repeated wheel and keyboard zoom reach but never exceed viewing limits',()=>{
 resetView();for(let i=0;i<20;i++)wheel(-10000);near(read('sceneZoom'),1.8);for(let i=0;i<20;i++)wheel(10000);near(read('sceneZoom'),.65);
 assert.equal(key('Home'),1);near(read('sceneZoom'),1);assert.equal(key('+'),1);near(read('sceneZoom'),1.12);assert.equal(key('-'),1);near(read('sceneZoom'),1);assert.equal(key('ArrowDown'),0);
 read('setSceneZoom(1.4)');r.resetSceneZoom.click();near(read('sceneZoom'),1);
 for(const bad of ['NaN','Infinity','-Infinity']){read('setSceneZoom('+bad+')');near(read('sceneZoom'),1);}
});
check('navigation releases every capture and ignores old motion when returning',()=>{
 resetView();down(1,100);down(2,200);read("navigate('catalog')");assert.equal(read('scenePointers.size'),0);assert(!captures.size);read("navigate('training')");const yaw=read('yaw');move(1,300);move(2,400);near(read('yaw'),yaw);near(read('sceneZoom'),1);down(1,100);move(1,110);near(read('yaw'),yaw+.09);end('pointerup',1);
});
check('all cancellation, limit and navigation paths preserve the teaching model and JSON',()=>assert.deepEqual(physical(),original));
check('opening settings cancels a pinch and blocks background gestures until closed',()=>{
 resetView();const before=physical(),saved=[...storage];down(1,100);down(2,200);move(2,220);
 const view=json('({yaw,sceneZoom,sceneView})');r.openTrainingMenu.click();
 assert(!r.trainingDrawer.hidden);assert(r.trainingMain.inert);assert.equal(read('scenePointers.size'),0);assert(!captures.size);
 move(1,900);move(2,1000);down(1,100);assert.equal(wheel(-80),0);assert.equal(key('+'),0);assert.equal(key('ArrowRight'),0);
 assert.equal(read('scenePointers.size'),0);assert.deepEqual(json('({yaw,sceneZoom,sceneView})'),view);assert.deepEqual(physical(),before);assert.deepEqual([...storage],saved);
 r.closeTrainingMenu.click();assert(r.trainingDrawer.hidden);assert(!r.trainingMain.inert);move(1,400);near(read('yaw'),view.yaw);near(read('sceneZoom'),view.sceneZoom);
 down(1,100);move(1,110);near(read('yaw'),view.yaw+.09);end('pointerup',1);assert.equal(wheel(-80),1);assert(read('sceneZoom')>view.sceneZoom);assert.deepEqual(physical(),before);assert.deepEqual([...storage],saved);
});
for(const view of ['front','side']){
 read('openMachine(machines[5])');const teaching=physical(),saved=[...storage];
 check(`${view} selection has an exact orthographic direction and preserves zoom/model`,()=>{
  read('setSceneZoom(1.25)');r.sceneView.change(view);assert.equal(read('sceneView'),view);near(read('yaw'),view==='front'?0:Math.PI/2);near(read('scenePitch()'),0);near(read('sceneZoom'),1.25);
  assert.equal(r.sceneView.closest('.viewer-settings').closest('#trainingControls'),r.trainingControls);assert.equal(r.sceneView.closest('#sceneToolbar'),null);assert.deepEqual(physical(),teaching);assert.deepEqual([...storage],saved);
 });
 check(`${view} viewing guides use depth dots instead of normalizing tiny vectors`,()=>{
  const depthComponent=view==='front'?2:0,depthKeys=json(`axisConfig(current).filter(a=>['X','Y','Z'].includes(a.key)&&Math.abs(a.vector[${depthComponent}])===1).map(a=>a.key)`);
  for(const key of depthKeys){const guide=r.orientationAxes.children.find(s=>s.getAttribute('aria-label')===key+'軸の向きの目安');assert(guide);assert.equal(guide.querySelectorAll('line').length,0);assert.equal(guide.querySelectorAll('path').length,0);assert.equal(guide.querySelectorAll('circle').length,2);assert.match(guide.textContent,/奥行方向/);}
 });
 check(`${view} wheel, pinch and zoom keys keep the fixed observation direction`,()=>{
  wheel(-50);down(1,100);down(2,200);move(2,210);end('pointerup',2);end('pointerup',1);key('+');key('-');key('Home');
  assert.equal(read('sceneView'),view);assert.equal(r.sceneView.value,view);near(read('yaw'),view==='front'?0:Math.PI/2);near(read('sceneZoom'),1);
 });
 check(`${view} stationary and vertical pointer events do not trigger free rotation`,()=>{
  down(1,100);move(1,100,110);assert.equal(read('sceneView'),view);near(read('yaw'),view==='front'?0:Math.PI/2);end('pointercancel',1);
 });
 check(`${view} single-finger drag returns to oblique rotation without stale pinch`,()=>{
  const yaw=read('yaw');down(1,100);down(2,200);move(2,210);end('pointerup',2);const zoom=read('sceneZoom');move(1,110);
  assert.equal(read('sceneView'),'oblique');assert.equal(r.sceneView.value,'oblique');near(read('yaw'),yaw+.09);near(read('scenePitch()'),.24);near(read('sceneZoom'),zoom);end('pointerup',1);assert.deepEqual(physical(),teaching);
 });
 check(`${view} switching observation mode releases a live gesture and keeps JSON`,()=>{
  down(1,100);down(2,200);r.sceneView.change(view);assert(!captures.size);assert.equal(read('scenePointers.size'),0);const yaw=read('yaw');move(1,300);move(2,400);near(read('yaw'),yaw);assert.deepEqual(physical(),teaching);assert.deepEqual([...storage],saved);
 });
 check(`${view} arrow keys intentionally resume oblique rotation`,()=>{
  assert.equal(key('ArrowLeft'),1);assert.equal(read('sceneView'),'oblique');near(read('yaw'),(view==='front'?0:Math.PI/2)-.12);assert.deepEqual(physical(),teaching);
 });
 check(`${view} invalid observation choices cannot corrupt the current view`,()=>{
  const state=json('({sceneView,yaw,sceneZoom})');read("setSceneView('invalid')");assert.deepEqual(json('({sceneView,yaw,sceneZoom})'),state);
 });
}
check('opening another machine starts with the normal viewing scale and fresh pointers',()=>{
 read("setSceneView('side');setSceneZoom(1.8)");down(1,100);read('openMachine(machines[6])');near(read('sceneZoom'),1);assert.equal(read('sceneView'),'oblique');assert.equal(r.sceneView.value,'oblique');assert.equal(read('scenePointers.size'),0);assert(!captures.size);assert.deepEqual(json('axisConfig(current).map(a=>a.key)'),['X','Z']);
});
console.log(`Scene zoom: ${checks} interaction/rendering checks passed; ${frames} Canvas frames and ${coordinates} finite coordinate values inspected.`);

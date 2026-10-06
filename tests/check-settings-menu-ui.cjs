'use strict';
// Exercise the real menu handlers with unscaled client dimensions and scaled
// browser rectangles. This catches double-shrinking Canvas paint, focus leaks,
// and accidental coupling between the settings pane and the current viewer.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {registry:r,body,context,read,json,storage}=require('./leveling-dom-env.cjs')();
read('Math.random=()=>.271828;');
const prototype=Object.getPrototypeOf(r.scene);
function visible(el){
 for(let node=el;node;node=node.parentElement){
  if(node.hidden||node.inert||node.getAttribute('aria-hidden')==='true')return false;
  const parent=node.parentElement;if(parent?.tagName==='DETAILS'&&!parent.open&&node.tagName!=='SUMMARY')return false;
 }
 return true;
}
prototype.focus=function(options){assert.equal(options?.preventScroll,true);assert(visible(this),'focus moved to a hidden/inert control: '+this.id);context.document.activeElement=this;};
prototype.contains=function(el){for(let node=el;node;node=node.parentElement)if(node===this)return true;return false;};
Object.defineProperty(prototype,'open',{configurable:true,get(){return this._open??Object.hasOwn(this.attrs,'open');},set(value){this._open=!!value;}});
context.document.activeElement=body;
let viewportWidth=390,viewportHeight=844,rawCanvasWidth=302,rawCanvasHeight=430,trace=[],frames=0,coordinates=0;
const scale=()=>Number(/^scale\(([^)]+)\)$/.exec(r.trainingMain.style.transform||'scale(1)')[1]);
const shellHeight=()=>viewportHeight-20;
r.trainingShell.getBoundingClientRect=()=>({width:viewportWidth,height:shellHeight()});
for(const [el,getWidth,getHeight] of [[r.trainingMain,()=>viewportWidth,shellHeight],[r.scene,()=>rawCanvasWidth,()=>rawCanvasHeight]]){
 Object.defineProperty(el,'clientWidth',{configurable:true,get:getWidth});Object.defineProperty(el,'clientHeight',{configurable:true,get:getHeight});
}
Object.defineProperty(r.trainingDrawer,'clientWidth',{configurable:true,get:()=>r.trainingDrawer.hidden?0:parseFloat(r.trainingShell.style['--drawer-width'])});
Object.defineProperty(r.trainingMainSlot,'clientWidth',{configurable:true,get:()=>viewportWidth-r.trainingDrawer.clientWidth});
r.scene.getBoundingClientRect=()=>({width:rawCanvasWidth*scale(),height:rawCanvasHeight*scale()});
const finite=(...v)=>{assert(v.every(Number.isFinite));coordinates+=v.length;};
const ctx={scale:finite,setLineDash(){},beginPath(){},closePath(){},fill(){},stroke(){},
 fillRect(x,y,w,h){finite(x,y,w,h);if(x===0&&y===0&&w===rawCanvasWidth&&h===rawCanvasHeight){trace=[];frames++;}trace.push(['rect',x,y,w,h]);},
 moveTo(x,y){finite(x,y);trace.push(['move',x,y]);},lineTo(x,y){finite(x,y);trace.push(['line',x,y]);},arc(...v){finite(...v);trace.push(['arc',...v]);},
 fillText(t,x,y){finite(x,y);trace.push(['text',t,x,y]);},measureText(t){return {width:[...t].length*7};}
};
r.scene.getContext=()=>ctx;
let checks=0;
function check(name,fn){try{fn();checks++;}catch(error){throw new Error(name+': '+error.message);}}
const near=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
function press(key,shiftKey=false,target=r.trainingDrawer){let prevented=0;target.events.keydown({key,shiftKey,preventDefault(){prevented++;}});return prevented;}
function state(){return json('({record:levelRecord(),selected,selectedAxis,sceneZoom,sceneView,yaw})');}
function open(){r.openTrainingMenu.focus({preventScroll:true});r.openTrainingMenu.click();}
function closed(){
 assert(r.trainingDrawer.hidden);assert(!read('trainingMenuOpen'));assert(!r.trainingShell.classList.contains('menu-open'));assert(!r.trainingMain.inert);assert.equal(r.trainingMain.getAttribute('aria-hidden'),'false');assert(r.trainingMainShield.hidden);assert.equal(r.openTrainingMenu.getAttribute('aria-expanded'),'false');near(scale(),1);
}
check('settings are outside the main viewer and leave site navigation accessible',()=>{
 assert.equal(r.trainingDrawer.getAttribute('role'),'dialog');assert.equal(r.trainingDrawer.getAttribute('aria-modal'),'false');assert.equal(r.trainingDrawer.getAttribute('aria-labelledby'),'trainingMenuTitle');
 assert.equal(r.openTrainingMenu.getAttribute('aria-controls'),'trainingDrawer');assert(r.openTrainingMenu.getAttribute('aria-label'));
 assert.equal(r.trainingDrawer.parentElement,r.trainingShell);assert.equal(r.trainingMainSlot.parentElement,r.trainingShell);assert.equal(r.trainingMain.parentElement,r.trainingMainSlot);assert.equal(r.trainingControls.parentElement,r.trainingDrawer);
 for(const id of ['scene','liveSquareness','viewerLevels','axisTabs','mainAdjustment','openTrainingMenu']){assert.equal(r[id].closest('#trainingMain'),r.trainingMain,id);assert.equal(r[id].closest('#trainingControls'),null,id);}
 for(const id of ['showIdealOutline','sceneView','playAxis','axisSliders','drawerAxisSelect','machineMode','supportWidth','supportDepth','coarseExample','fineExample','exportLevel','importLevel']){assert.equal(r[id].closest('#trainingControls'),r.trainingControls,id);assert.equal(r[id].closest('#trainingMain'),null,id);}
 assert.equal(r.changeMachine.closest('#siteNav'),r.siteNav);
 assert.equal(r.changeMachine.closest('#trainingDrawer'),null);
 assert(r.axisControlsToggle.hidden&&r.closeAxisControls.hidden,'legacy axis controls cannot occupy the visible axis bar');
 assert.deepEqual(r.axisTabs.querySelectorAll('button'),[],'axis tabs are generated later');
});
const css=fs.readFileSync('src/style.css','utf8');
check('touch targets and scroll/transform contracts are present',()=>{
 assert.match(css,/\.training-main\{[^}]*transform-origin:top left/);
 assert.match(css,/\.training-drawer[^{}]*\{[^}]*overflow:hidden/);
 assert(/\.training-drawer[^{}]*\.scroll-controls\{[^}]*overflow[^;}]*auto/.test(css),'drawer contents need independent scrolling');
 assert.match(css,/\.main-adjustment[^{}]*\.map-point\{[^}]*min-width:44px;[^}]*min-height:44px/);
 assert.match(css,/\.common-support-actions button\{[^}]*min-height:44px/);
 const toggleRule=/\.training-menu-toggle[^{}]*\{([^}]*)\}/.exec(css)[1];assert(/(?:min-width|width):44px/.test(toggleRule)&&/(?:min-height|height):44px/.test(toggleRule),'menu trigger needs a 44px touch target');
});
const variants=[[0,'compact'],[1,''],[2,''],[3,'l3-3000'],[4,''],[5,''],[6,'']];
const sizes=[[320,480,232,116],[320,568,232,240],[390,844,302,430],[568,320,232,132],[844,390,384,180],[1024,768,800,440],[1363,936,1000,600]];
for(const [index,mode] of variants){
 storage.clear();read(`openMachine(machines[${index}]);`);if(mode)r.machineMode.change(mode);const kind=read('current.kind');
 check('simple adjustment area has one shared pair and no precision values '+kind,()=>{
  const buttons=r.mainAdjustment.querySelectorAll('button'),supports=json('supports');assert.equal(buttons.length,supports.length+4);
  assert.equal(r.mainAdjustment.querySelectorAll('input').length,0);assert.equal(r.mainAdjustment.querySelectorAll('select').length,0);
  assert.equal(r.coarseAdjust.closest('#mainAdjustment'),r.mainAdjustment);assert.equal(r.fineAdjust.textContent,'微調整');assert.equal(r.lowerSupport.closest('#mainAdjustment'),r.mainAdjustment);assert.equal(r.raiseSupport.closest('#mainAdjustment'),r.mainAdjustment);
  assert.equal(r.selectedSupportLabel.getAttribute('role'),'status');assert.equal(r.selectedSupportLabel.textContent,'支持点 A・'+supports[0].name);assert(!/mm|µm|µrad/.test(r.selectedSupportLabel.textContent));
  assert.equal(r.supportControls.closest('#trainingMain'),null);assert(r.supportControls.hidden);
  assert.deepEqual(r.axisTabs.children.map(b=>b.textContent),json('axisConfig(current).map(a=>a.key+"軸")'));
 });
 for(const [w,h,cw,ch] of sizes){
  viewportWidth=w;viewportHeight=h;rawCanvasWidth=cw;rawCanvasHeight=ch;context.window.innerWidth=w;context.window.innerHeight=h;
  read('refreshTrainingLayout();drawScene();');closed();const before=state(),painting=JSON.stringify(trace),name=kind+'/'+w+'x'+h;
  open();
  check('whole main scales into the right slot without repaint shrinking '+name,()=>{
   assert(!r.trainingDrawer.hidden&&read('trainingMenuOpen'));assert(r.trainingShell.classList.contains('menu-open'));assert(r.trainingMain.inert);assert.equal(r.trainingMain.getAttribute('aria-hidden'),'true');assert(!r.trainingMainShield.hidden);assert.equal(r.openTrainingMenu.getAttribute('aria-expanded'),'true');
   near(Number.parseFloat(r.trainingMain.style.width),w);near(Number.parseFloat(r.trainingMain.style.height),shellHeight());near(scale(),r.trainingMainSlot.clientWidth/r.trainingMain.clientWidth);assert(scale()>0&&scale()<1);
   near(r.scene.getBoundingClientRect().width/r.scene.clientWidth,scale());assert.equal(JSON.stringify(trace),painting,'opening settings double-scales or changes the Canvas');assert.deepEqual(state(),before);assert.equal(context.document.activeElement,r.closeTrainingMenu);
  });
  const transformed=r.trainingMain.style.transform;r.trainingControls.scrollTop=920;
  check('settings scrolling leaves the viewer fixed '+name,()=>{read('refreshTrainingLayout();drawScene();');assert.equal(r.trainingControls.scrollTop,920);assert.equal(r.trainingMain.style.transform,transformed);assert.equal(JSON.stringify(trace),painting);assert.deepEqual(state(),before);});
  check('Escape closes the drawer and restores the main trigger '+name,()=>{assert.equal(press('Escape'),1);closed();assert.equal(context.document.activeElement,r.openTrainingMenu);assert.equal(JSON.stringify(trace),painting);assert.deepEqual(state(),before);});
 }
 check('hidden/disabled controls and closed details are excluded from focus '+kind,()=>{
  open();r.axisMenuSection.open=false;const focusable=read('trainingMenuFocusables()');assert(focusable.length>2);assert(focusable.includes(r.closeTrainingMenu));assert(!focusable.includes(r.axisControlsToggle));assert(!focusable.includes(r.closeAxisControls));assert(!focusable.includes(r.playAxis));assert(!focusable.some(el=>el.disabled||el.hidden));
  const first=focusable[0],last=focusable[focusable.length-1];
  // Site navigation remains operable while settings are open. Tab must use
  // the browser's normal traversal rather than trapping focus in the drawer.
  first.focus({preventScroll:true});assert.equal(press('Tab',true),0);
  last.focus({preventScroll:true});assert.equal(press('Tab'),0);
  const middle=focusable[1];middle.focus({preventScroll:true});assert.equal(press('Tab'),0);assert.equal(context.document.activeElement,middle);r.closeTrainingMenu.click();closed();assert.equal(context.document.activeElement,r.openTrainingMenu);
 });
 check('shield closes the drawer instead of activating the background '+kind,()=>{const before=state();open();r.trainingMainShield.click();closed();assert.equal(context.document.activeElement,r.openTrainingMenu);assert.deepEqual(state(),before);});
}
read('openMachine(machines[5]);');open();
check('active axis selection stays synchronized with the available five-axis model',()=>{assert.deepEqual(r.drawerAxisSelect.children.map(o=>o.value),['X','Y','Z','A','C']);r.drawerAxisSelect.change('C');assert.equal(read('selectedAxis'),'C');assert.equal(r.axisTabs.children.find(b=>b.getAttribute('aria-pressed')==='true').textContent,'C軸');assert(!r.trainingDrawer.hidden);});
r.closeTrainingMenu.click();read('openMachine(machines[6]);');open();
check('lathe drawer exposes XZ only',()=>assert.deepEqual(r.drawerAxisSelect.children.map(o=>o.value),['X','Z']));
r.changeMachine.click();
check('leaving the exercise closes settings and removes background inertness',()=>{assert.equal(read('page'),'catalog');closed();assert.equal(r.training.hidden,true);});
console.log(JSON.stringify({checks,frames,finiteCanvasCoordinates:coordinates,variants:variants.length,displaySizes:sizes.map(s=>s.slice(0,2))},null,2));

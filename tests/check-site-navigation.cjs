'use strict';
// Independent journey checks for the shared site navigation. The same real
// handlers used by the page must release the machine-only drawer on every exit.
const assert=require('node:assert/strict');
const createEnvironment=require('./leveling-dom-env.cjs');
const {registry:r,body,context,read,json,storage}=createEnvironment();
const pages=['home','electricTopics','tester','topics','catalog','training'];
let checks=0;
function check(name,fn){try{fn();checks++;}catch(error){throw new Error(name+': '+error.message);}}
function visiblePage(expected){
 assert.equal(read('page'),expected);
 for(const page of pages)assert.equal(r[page].hidden,page!==expected,page);
 assert.equal(body.classList.contains('in-mechanical-lab'),expected==='training');
 assert.equal(body.classList.contains('in-lab'),expected==='training'||expected==='tester');
 assert(r.navCurrent,'shared navigation must identify the current page');
 assert(r.navCurrent.textContent.trim(),'current page label must be readable');
 assert.equal(r.navCurrent.getAttribute('aria-current'),'page');
 assert.equal(r.navCurrent.closest('#siteNav'),r.siteNav);
 if(expected!=='home'){
  for(const id of ['navHome',expected==='training'?'changeMachine':'navBack']){
   assert(r[id]&&!r[id].hidden&&!r[id].disabled,id+' must provide an exit');
   assert.equal(r[id].closest('#trainingDrawer'),null,'site navigation must be outside the machine settings');
   assert.equal(r[id].closest('#trainingMain'),null,'site navigation must not shrink with the machine view');
  }
 }
}
function closedDrawer(){
 assert(r.trainingDrawer.hidden);assert(!read('trainingMenuOpen'));
 assert(!r.trainingMain.inert);assert(r.trainingMainShield.hidden);
 assert.equal(r.openTrainingMenu.getAttribute('aria-expanded'),'false');
}
function state(){return json('({record:levelRecord(),selected,selectedAxis,sceneZoom,sceneView,yaw})');}
check('initial home has one visible page and a location label',()=>visiblePage('home'));
check('electrical journey and shared back controls',()=>{
 r.electric.click();visiblePage('electricTopics');
 r.testerControls.scrollTop=300;r.testerEntry.click();visiblePage('tester');
 assert.equal(r.testerControls.scrollTop,0);assert.equal(context.resetCalls,1);
 r.navBack.click();visiblePage('electricTopics');
 r.navBack.click();visiblePage('home');
});
check('mechanical category has predictable parent navigation',()=>{
 r.mechanical.click();visiblePage('topics');r.leveling.click();visiblePage('catalog');
 r.navBack.click();visiblePage('topics');r.navHome.click();visiblePage('home');
});
for(let index=0;index<7;index++){
 r.mechanical.click();r.leveling.click();r.machineGrid.children[index].click();
 check('shared navigation remains outside settings for machine '+index,()=>visiblePage('training'));
 r.raiseSupport.click();r.fineAdjust.click();r.raiseSupport.click();
 const initial=state(),saved=[...storage];
 r.modelDisplaySettings.open=true;r.axisMenuSection.open=true;
 r.openTrainingMenu.click();
 check('opening and closing settings preserves the adjusted individual '+index,()=>{
  assert(!r.trainingDrawer.hidden&&r.trainingMain.inert);
  assert.deepEqual(state(),initial);assert.deepEqual([...storage],saved);
  r.closeTrainingMenu.click();closedDrawer();
  assert.deepEqual(state(),initial);assert.deepEqual([...storage],saved);
  assert(r.modelDisplaySettings.open&&r.axisMenuSection.open,'ordinary closing must retain the chosen settings section');
 });
 r.openTrainingMenu.click();r.trainingControls.scrollTop=450;
 check('back exits an open drawer and clears its presentation '+index,()=>{
  r.changeMachine.click();visiblePage('catalog');closedDrawer();
  assert.equal(r.trainingControls.scrollTop,0);
  assert(!r.modelDisplaySettings.open&&!r.axisMenuSection.open,'old settings sections must close on page exit');
 });
 check('selecting the same machine resets and draws a new individual '+index,()=>{
  r.machineGrid.children[index].click();visiblePage('training');closedDrawer();
  assert.notEqual(read('machineProfile.seed'),initial.record.machineProfile.seed);assert.deepEqual(json('supportHeights'),json('machineProfile.initialHeights'));
  r.openTrainingMenu.click();r.navHome.click();visiblePage('home');closedDrawer();
 });
}
check('switching machine while settings were open cannot leak old axis options',()=>{
 r.mechanical.click();r.leveling.click();r.machineGrid.children[5].click();
 r.openTrainingMenu.click();r.drawerAxisSelect.change('C');r.axisMenuSection.open=true;
 r.changeMachine.click();r.machineGrid.children[6].click();visiblePage('training');closedDrawer();
 assert.deepEqual(r.drawerAxisSelect.children.map(o=>o.value),['X','Z']);
 assert.equal(read('selectedAxis'),'X');assert(!r.axisMenuSection.open);
 const before=json('levelRecord()');r.raiseSupport.click();
 assert.notDeepEqual(json('levelRecord()'),before,'support operation must resume after changing machine');
 r.openTrainingMenu.click();r.navHome.click();r.electric.click();r.testerEntry.click();
 visiblePage('tester');closedDrawer();
});
// A demo notice describes one machine and must not follow a different lesson.
const demo=createEnvironment(),d=demo.registry;
demo.context.requestAnimationFrame=()=>1;demo.context.cancelAnimationFrame=()=>{};
check('finished C-axis demo notice does not follow navigation into the XZ lathe',()=>{
 d.mechanical.click();d.leveling.click();d.machineGrid.children[5].click();
 d.openTrainingMenu.click();d.drawerAxisSelect.change('C');d.playAxis.click();
 assert.match(d.axisDemoStatus.textContent,/C軸.*確認中/);
 d.openTrainingMenu.click();d.resetAxes.click();
 assert.match(d.axisDemoStatus.textContent,/C軸.*終了/);
 d.changeMachine.click();assert.equal(d.axisDemoStatus.textContent,'');
 d.machineGrid.children[6].click();assert.equal(d.axisDemoStatus.textContent,'');
 assert.deepEqual(demo.json('axisConfig(current).map(a=>a.key)'),['X','Z']);
});
check('leaving a running demo clears its notice after stopping the animation',()=>{
 d.openTrainingMenu.click();d.playAxis.click();assert.match(d.axisDemoStatus.textContent,/確認中/);
 d.navHome.click();assert.equal(demo.read('motionFrame'),null);assert.equal(d.axisDemoStatus.textContent,'');
 d.mechanical.click();d.leveling.click();d.machineGrid.children[6].click();assert.equal(d.axisDemoStatus.textContent,'');
});
check('direct machine initialization clears the former machine demo notice',()=>{
 d.openTrainingMenu.click();d.playAxis.click();
 demo.read('openMachine(machines[0])');assert.equal(d.axisDemoStatus.textContent,'');
});
// History is optional in the older lightweight tests. Here a stack exercises
// the registered browser callback and detects accidental history loops.
const listeners={},entries=[];
let historyIndex=-1,historyWrites=0;
const history={
 get state(){return entries[historyIndex]||null;},
 replaceState(value){historyWrites++;if(historyIndex<0)historyIndex=0;entries[historyIndex]=JSON.parse(JSON.stringify(value));},
 pushState(value){historyWrites++;entries.splice(historyIndex+1);entries.push(JSON.parse(JSON.stringify(value)));historyIndex++;}
};
const hist=createEnvironment({window:{history,addEventListener(name,handler){listeners[name]=handler;}}});
const h=hist.registry;
function traverse(delta){historyIndex+=delta;assert(historyIndex>=0&&historyIndex<entries.length);const writes=historyWrites;listeners.popstate({state:history.state});assert.equal(historyWrites,writes,'restoring browser history must not write another entry');}
check('history initializes home and records real page transitions',()=>{
 assert.equal(entries.length,1);assert.equal(history.state.page,'home');assert.equal(typeof listeners.popstate,'function');
 h.mechanical.click();h.leveling.click();h.machineGrid.children[0].click();
 assert.deepEqual(entries.map(e=>e.page),['home','topics','catalog','training']);
});
h.raiseSupport.click();h.fineAdjust.click();h.raiseSupport.click();
const adjusted=hist.json('levelRecord()');h.openTrainingMenu.click();
check('browser back closes settings and forward draws a new individual',()=>{
 traverse(-1);assert.equal(hist.read('page'),'catalog');assert(h.trainingDrawer.hidden&&!h.trainingMain.inert&&h.trainingMainShield.hidden);
 traverse(1);assert.equal(hist.read('page'),'training');assert(h.trainingDrawer.hidden);assert.notEqual(hist.read('machineProfile.seed'),adjusted.machineProfile.seed);assert.deepEqual(hist.json('supportHeights'),hist.json('machineProfile.initialHeights'));
 h.navHome.click();traverse(-1);assert.equal(hist.read('page'),'training');assert.notEqual(hist.read('machineProfile.seed'),adjusted.machineProfile.seed);assert.deepEqual(hist.json('supportHeights'),hist.json('machineProfile.initialHeights'));
});
check('history for a different machine goes to selection without re-drawing an individual',()=>{
 h.changeMachine.click();h.machineGrid.children[5].click();const active=hist.json('levelRecord()');
 traverse(-1);assert.equal(hist.read('page'),'catalog');
 traverse(-1);assert.equal(history.state.page,'training');assert.equal(hist.read('page'),'catalog');
 assert.deepEqual(hist.json('levelRecord()'),active,'an old history entry must not replace the current machine');
 traverse(1);traverse(1);assert.equal(hist.read('page'),'training');assert.notEqual(hist.read('machineProfile.seed'),active.machineProfile.seed);
});
check('browser history restores electrical lessons through the shared entry lifecycle',()=>{
 h.navHome.click();h.electric.click();h.testerEntry.click();const resets=hist.context.resetCalls;
 h.navHome.click();traverse(-1);assert.equal(hist.read('page'),'tester');
 assert.equal(hist.context.resetCalls,resets+1,'history entry must release stale probe connections just like the lesson card');
 traverse(-1);assert.equal(hist.read('page'),'electricTopics');traverse(1);assert.equal(hist.read('page'),'tester');
});
console.log(`Shared site navigation: ${checks} journeys/state/history checks passed across six pages and seven machines.`);

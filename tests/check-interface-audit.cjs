'use strict';
// Independent audit of visible meter directions and interactive state edges.
// Uses the real UI scripts; no product code is substituted.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const createEnvironment=require('./leveling-dom-env.cjs');
let checks=0;const failures=[];
function check(name,fn){checks++;try{fn();}catch(error){failures.push(name+': '+error.message);}}
function near(actual,expected){assert(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);}
async function main(){
 const env=createEnvironment(),{registry:r,read,json,context,storage}=env;
 let seed=23000;context.window.crypto={getRandomValues:values=>{values[0]=seed++;return values;}};
 // Non-primary mouse/pen and right-button pointers are not gestures. Touch
 // pointers have separate pinch coverage. Capture loss names the real pointer.
 read('openMachine(machines[0])');
 const saved=json('levelRecord()');let captured=null;
 r.scene.setPointerCapture=id=>captured=id;
 const event=(id,x,extra={})=>({pointerId:id,clientX:x,clientY:100,pointerType:'mouse',isPrimary:true,button:0,...extra});
 const yaw=read('yaw');
 r.scene.events.pointerdown(event(2,50,{isPrimary:false}));r.scene.events.pointermove(event(2,100));
 r.scene.events.pointerdown(event(22,50,{pointerType:'pen',isPrimary:false}));r.scene.events.pointermove(event(22,100));
 r.scene.events.pointerdown(event(3,50,{button:2}));r.scene.events.pointermove(event(3,100));
 check('non-primary mouse/pen and right pointer cannot rotate',()=>{near(read('yaw'),yaw);assert.equal(captured,null);assert.equal(read('scenePointers.size'),0);});
 r.scene.events.pointerdown(event(4,80));r.scene.events.pointermove(event(5,180));
 check('capture ignores another pointer',()=>{assert.equal(captured,4);near(read('yaw'),yaw);});
 r.scene.events.pointermove(event(4,140));
 check('primary drag rotates without changing the adjusted individual',()=>{near(read('yaw'),yaw+.54);assert.deepEqual(json('levelRecord()'),saved);});
 r.scene.events.pointercancel(event(4,140));r.scene.events.pointermove(event(4,190));
 check('cancelled touch cannot continue rotation',()=>near(read('yaw'),yaw+.54));
 r.scene.events.pointerdown(event(6,140));r.scene.events.lostpointercapture(event(6,140));r.scene.events.pointermove(event(6,190));
 check('lost capture cannot continue rotation',()=>near(read('yaw'),yaw+.54));
 r.scene.events.pointerdown(event(7,140));r.scene.events.pointerup(event(8,140));r.scene.events.pointermove(event(7,150));
 check('another pointer up does not cancel the primary drag',()=>near(read('yaw'),yaw+.63));
 r.scene.events.pointerup(event(7,150));r.scene.events.pointermove(event(7,190));
 check('released pointer cannot continue rotation',()=>near(read('yaw'),yaw+.63));
 let prevented=0;
 r.scene.events.keydown({key:'ArrowLeft',preventDefault(){prevented++;}});r.scene.events.keydown({key:'ArrowRight',preventDefault(){prevented++;}});r.scene.events.keydown({key:'ArrowDown',preventDefault(){prevented++;}});
 check('horizontal keys rotate and vertical key keeps its normal action',()=>{near(read('yaw'),yaw+.63);assert.equal(prevented,2);assert.deepEqual(json('levelRecord()'),saved);});
 // Starting an import and then changing the machine is a real session change,
 // even if the original machine is selected again before the file finishes.
 for(const index of [0,3]){
  storage.clear();read(`openMachine(machines[${index}])`);
  const stale=json('levelRecord()');stale.heights[0]=.444;let resolve;
  r.importLevel.files=[{size:100,text:()=>new Promise(done=>resolve=done)}];const loading=r.importLevel.onchange({target:r.importLevel});
  r.changeMachine.click();r.machineGrid.children[2].click();r.changeMachine.click();r.machineGrid.children[index].click();const current=json('levelRecord()'),message=r.levelInputMessage.textContent;
  resolve(JSON.stringify(stale));await loading;
  check('late JSON cannot replace a changed-and-returned machine '+index,()=>{assert.deepEqual(json('levelRecord()'),current);assert.equal(r.levelInputMessage.textContent,message);});
 }
 read('openMachine(machines[0])');let rejectRead;
 r.importLevel.files=[{size:100,text:()=>new Promise((resolve,reject)=>rejectRead=reject)}];const failedRead=r.importLevel.onchange({target:r.importLevel});
 r.machineCondition.change('used');const fresh=json('levelRecord()'),freshMessage=r.levelInputMessage.textContent;
 rejectRead(Error('file access failed'));await failedRead;
 check('late read failure cannot replace the new-individual message',()=>{assert.deepEqual(json('levelRecord()'),fresh);assert.equal(r.levelInputMessage.textContent,freshMessage);});
 // The desktop mechanical shell hides the document and scrolls its controls.
 // It must be released on every exit, including a direct electrical transition.
 check('mechanical fixed shell never leaks into the catalog or electrical lesson',()=>{
  for(const next of ['home','topics','catalog','electricTopics','tester']){
   read("navigate('training')");assert(context.document.body.classList.contains('in-mechanical-lab'));
   read(`navigate('${next}')`);assert(!context.document.body.classList.contains('in-mechanical-lab'),next);
   assert.equal(context.document.body.classList.contains('in-lab'),next==='tester',next);
  }
  read("navigate('home')");assert(!context.document.body.classList.contains('in-lab'));
 });
 // Help commands are intended for direct copy/paste; every local verification
 // file linked in the electrical guide must exist in this repository.
 check('electrical guide verification paths exist',()=>{
  const doc=fs.readFileSync('docs/tester_basics.md','utf8');
  const files=[...doc.matchAll(/`((?:tests|verification)\/check-[^` ]+\.cjs)`/g)].map(m=>m[1]);assert.equal(files.length,2);
  for(const file of files)assert(fs.existsSync(file),file+' does not exist');
 });
 if(failures.length){console.error(`${checks} interface audit checks run; ${failures.length} failed:\n`+failures.join('\n'));process.exitCode=1;}
 else console.log(`Interface audit: ${checks} independent interaction and diagram checks passed.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});

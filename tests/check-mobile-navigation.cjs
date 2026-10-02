const assert=require('node:assert/strict');
const {registry,body,context,read}=require('./leveling-dom-env.cjs')();
const bodyClasses={has:name=>body.classList.contains(name)};
assert.equal(read('page'),'home');assert(!bodyClasses.has('in-lab'));
registry.electric.onclick();assert.equal(read('page'),'electricTopics');assert.equal(registry.electricTopics.hidden,false);
registry.testerControls.scrollTop=300;registry.testerEntry.onclick();assert.equal(read('page'),'tester');assert(bodyClasses.has('in-lab'));assert.equal(registry.testerControls.scrollTop,0);assert.equal(context.resetCalls,1);
registry.testerBack.onclick();assert.equal(read('page'),'electricTopics');assert(!bodyClasses.has('in-lab'));
read("navigate('home')");registry.mechanical.onclick();registry.leveling.onclick();assert.equal(read('page'),'catalog');assert.equal(registry.machineGrid.children.length,7);
for(let i=0;i<7;i++){registry.trainingControls.scrollTop=600;registry.machineGrid.children[i].onclick();assert.equal(read('page'),'training');assert(bodyClasses.has('in-lab'));assert.equal(registry.trainingControls.scrollTop,0);assert.equal(registry.tester.hidden,true);registry.changeMachine.onclick();assert.equal(read('page'),'catalog');assert(!bodyClasses.has('in-lab'));}
console.log('電気／機械ナビ、両訓練画面のロック・解除、スクロール初期化、7カテゴリ：passed');

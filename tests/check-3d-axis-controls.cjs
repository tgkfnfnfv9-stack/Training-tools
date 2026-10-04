'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {registry:r,context,read,json}=require('./leveling-dom-env.cjs')();
let checks=0;
function check(name,fn){try{fn();checks++;}catch(e){throw new Error(name+': '+e.message);}}
const source=fs.readFileSync('src/index.html','utf8');
const css=fs.readFileSync('src/style.css','utf8');
check('viewer stacks its flexible Canvas vertically',()=>assert.match(css,/\.scene-viewport\{[^}]*display:flex;[^}]*flex-direction:column;/));
check('removed explanation is not hidden elsewhere',()=>{
 assert(!source.includes('どこが動く？どこが固定？'));assert(!source.includes('motion-card'));
 for(const id of ['movingText','movingParts','partMapHeading','partMapBody','partStateHeading','fixedText','absentAxis'])assert(!r[id],id);
});
check('Canvas is separate from the fixed axis bar and scrolling axis menu',()=>{
 assert.deepEqual(r.sceneViewport.children,[r.scene]);
 assert.equal(r.sceneToolbar.parentElement,r.sceneViewport.parentElement);
 const viewerChildren=r.sceneViewport.parentElement.children;
 assert(viewerChildren.indexOf(r.sceneToolbar)>viewerChildren.indexOf(r.sceneViewport));
 for(const id of ['axisTabs','axisControlsToggle'])assert.equal(r[id].closest('#sceneToolbar'),r.sceneToolbar,id);
 assert.equal(r.axisMenu.parentElement,r.trainingControls);
 assert.equal(r.trainingControls.children[0],r.idealComparison);
 assert.equal(r.trainingControls.children[1],r.axisMenu);
 assert.equal(r.showIdealOutline.closest('#sceneToolbar'),null);
 for(const id of ['axisMenu','playAxis','resetAxes','axisSliders','machineMode']){assert.equal(r[id].closest('#trainingControls'),r.trainingControls,id);assert.equal(r[id].closest('#sceneViewport'),null,id);}
 assert.equal(r.sceneViewport.closest('.pinned-visual').parentElement.closest('#training'),r.training);
 assert.equal(r.axisControlsToggle.getAttribute('aria-controls'),'axisMenu');
});
check('axis controls use normal flow and wrap within narrow viewer widths',()=>{
 for(const selector of ['scene-toolbar','axis-menu']){
  const rules=new RegExp('\\.'+selector+'\\{([^}]*)\\}').exec(css)[1];
  assert(!/position:(absolute|fixed)|transform:|bottom:|max-height:|overflow:auto/.test(rules),selector);
 }
 assert.match(css,/\.scene-toolbar\{[^}]*flex-wrap:wrap;/);
 assert.match(css,/\.scene-toolbar \.axis-tabs\{[^}]*flex-wrap:wrap/);
 assert.match(css,/\.scene-toolbar \.axis-tab\{[^}]*min-width:44px;min-height:44px/);
});
check('reference directions have their own wrapping area in the scrolling settings',()=>{
 assert.equal(r.orientationGuide.closest('.viewer-settings').closest('#trainingControls'),r.trainingControls);
 assert.equal(r.orientationGuide.closest('#sceneViewport'),null);
 assert.equal(r.orientationAxes.parentElement,r.orientationGuide);
 assert.equal(r.orientationGuide.getAttribute('aria-labelledby'),'orientationGuideTitle');
 assert.match(css,/\.orientation-axes\{[^}]*flex-wrap:wrap;[^}]*min-width:0/);
 assert.match(css,/\.orientation-axis\{[^}]*min-width:0;max-width:100%;height:auto/);
});
let focused=null;
for(const el of [r.closeAxisControls,r.axisControlsToggle])el.focus=options=>{assert.equal(options.preventScroll,true);focused=el;};
const pending=new Map();let sequence=0;
context.requestAnimationFrame=fn=>{pending.set(++sequence,fn);return sequence;};
context.cancelAnimationFrame=id=>pending.delete(id);
function tick(time){const entries=[...pending.values()];pending.clear();for(const fn of entries)fn(time);}
let paths=[],texts=[],path=[];
const canvas={scale(){},fillRect(){},beginPath(){path=[];},moveTo(x,y){assert(Number.isFinite(x)&&Number.isFinite(y));path.push([x,y]);},lineTo(x,y){assert(Number.isFinite(x)&&Number.isFinite(y));path.push([x,y]);},closePath(){},arc(){},fill(){},fillText(text,x,y){assert(Number.isFinite(x)&&Number.isFinite(y));texts.push(text);},measureText(text){return {width:text.length*6};},stroke(){if(this.lineWidth===4||this.lineWidth===2.5)paths.push({color:this.strokeStyle,width:this.lineWidth,points:path.map(p=>[...p])});}};
r.scene.getBoundingClientRect=()=>({width:390,height:340});r.scene.getContext=()=>canvas;
const layouts=[[0,'standard'],[0,'compact'],[1,''],[2,''],[3,'long'],[3,'cross'],[4,''],[5,''],[6,'']];
function referenceTips(){return r.orientationAxes.children.map(svg=>{
 const line=svg.querySelectorAll('line')[0];return [svg.getAttribute('aria-label'),Number(line.getAttribute('x2')),Number(line.getAttribute('y2'))];
});}
for(const [index,mode] of layouts){
 read(`openMachine(machines[${index}])`);if(mode)r.machineMode.change(mode);pending.clear();
 const keys=json('axisConfig(current).map(a=>a.key)'),colors=json('axisColors');
 check('available axes only '+index+' '+mode,()=>{
  assert.deepEqual(r.axisTabs.children.map(b=>b.textContent),keys.map(k=>k+'軸'));
  assert.deepEqual(json('axisIndicators(current,createGeometry(current)).map(a=>a.key)'),keys);
  assert.equal(r.machineModeBox.hidden,!read('machines.find(m=>m.id===current.id).modes'));
  assert(r.axisMenu.hidden);assert.equal(r.axisControlsToggle.getAttribute('aria-expanded'),'false');
 });
 for(const key of keys){
  const before=json('levelRecord()');paths=[];texts=[];read(`selectAxis('${key}')`);
  check('every arrow visible; selected assembly stays highlighted '+index+' '+mode+' '+key,()=>{
   assert.equal(paths.length,keys.length);assert.deepEqual(paths.map(p=>p.color),keys.map(k=>colors[k]));
   for(let i=0;i<keys.length;i++){assert(texts.includes(keys[i]+'軸'));assert.equal(paths[i].width,keys[i]===key?4:2.5);assert.equal(paths[i].points.length,['A','C'].includes(keys[i])?25:2);}
   const selected=r.axisTabs.children.filter(b=>b.getAttribute('aria-pressed')==='true');assert.equal(selected.length,1);assert.equal(selected[0].textContent,key+'軸');
   for(const k of keys)assert.equal(r['axis-'+k].parentElement.hidden,k!==key);
   assert.equal(r.axisMenuTitle.textContent,key+'軸の操作');assert.deepEqual(json('levelRecord()'),before);
  });
  r.trainingControls.scrollTop=900;r.axisControlsToggle.click();
  check('menu opens inside its scrolled pane without resetting precision '+index+' '+mode+' '+key,()=>{assert(!r.axisMenu.hidden);assert.equal(r.axisControlsToggle.getAttribute('aria-expanded'),'true');assert.equal(r.trainingControls.scrollTop,0);assert.equal(focused,r.closeAxisControls);assert.deepEqual(json('levelRecord()'),before);});
  r.axisMenu.events.keydown({key:'Escape',preventDefault(){}});
  check('Escape closes the selected-axis menu '+index+' '+mode+' '+key,()=>{assert(r.axisMenu.hidden);assert.equal(r.axisControlsToggle.getAttribute('aria-expanded'),'false');assert.equal(focused,r.axisControlsToggle);});
 }
 const linearKeys=keys.filter(k=>['X','Y','Z'].includes(k));
 check('reference axes are separate while actual motion arrows stay on the model '+index+' '+mode,()=>{
  assert(!r.orientationGuide.hidden);assert.equal(r.orientationRotaryNote.hidden,index!==5);
  assert.deepEqual(r.orientationAxes.children.map(svg=>svg.getAttribute('aria-label')),linearKeys.map(k=>k+'軸の向きの目安'));
  assert.equal(texts.filter(text=>linearKeys.includes(text)).length,0,'bare coordinate labels no longer occupy the Canvas');
  for(const svg of r.orientationAxes.children){assert.equal(svg.getAttribute('viewBox'),'0 0 96 116');assert.equal(svg.getAttribute('role'),'img');assert.equal(svg.querySelectorAll('line').length,1);assert.equal(svg.querySelectorAll('text')[0].getAttribute('y'),'19');}
 });
 const recordBeforeRotation=json('levelRecord()'),tipsBeforeRotation=referenceTips();
 r.scene.events.keydown({key:'ArrowRight',preventDefault(){}});
 check('keyboard viewing rotation updates reference directions without changing precision '+index+' '+mode,()=>{
  assert.notDeepEqual(referenceTips(),tipsBeforeRotation);assert.deepEqual(json('levelRecord()'),recordBeforeRotation);
 });
 read('yaw=Math.PI/2;drawScene()');
 const quarterTurn=index===6?{X:[76,72],Z:[48,100]}:index===1?{X:[48,100],Y:[48,44],Z:[76,72]}:(index===3&&mode==='long')||index===4?{X:[76,72],Y:[48,100],Z:[48,44]}:{X:[48,100],Y:[76,72],Z:[48,44]};
 check('reference directions preserve machine-specific assignments at a quarter turn '+index+' '+mode,()=>{
  referenceTips().forEach(([label,x,y],i)=>{assert.equal(label,linearKeys[i]+'軸の向きの目安');const expected=quarterTurn[linearKeys[i]];assert(Math.abs(x-expected[0])<1e-9);assert(Math.abs(y-expected[1])<1e-9);});
 });
 check('rotating reference lines stay below their fixed labels and inside each small diagram '+index+' '+mode,()=>{
  for(let step=-12;step<=12;step++){
   read(`yaw=${step}*Math.PI/6;drawScene()`);
   for(const [,x,y] of referenceTips()){assert(Number.isFinite(x)&&Number.isFinite(y));assert(x>=19&&x<=77);assert(y>=43&&y<=101);}
  }
 });
 r.showAxes.checked=false;paths=[];read('drawScene()');
 check('axis visibility option hides motion arrows and their separate reference guide '+index+' '+mode,()=>{assert.equal(paths.length,0);assert(r.orientationGuide.hidden);});
 r.showAxes.checked=true;read('drawScene()');
 check('axis visibility option restores the matching reference axes '+index+' '+mode,()=>{assert(!r.orientationGuide.hidden);assert.equal(paths.length,keys.length);assert.equal(r.orientationAxes.children.length,linearKeys.length);});
 const before=json('levelRecord()');read("selectAxis('B')");
 check('unavailable axis is ignored '+index+' '+mode,()=>assert.deepEqual(json('levelRecord()'),before));
}
const tipsBeforeZeroSize=referenceTips();r.scene.getBoundingClientRect=()=>({width:0,height:0});
read('rotate(.23)');
check('reference SVG updates even when the model or settings have no measurable size',()=>{assert.notDeepEqual(referenceTips(),tipsBeforeZeroSize);for(const svg of r.orientationAxes.children)assert.equal(svg.getAttribute('viewBox'),'0 0 96 116');});
r.scene.getBoundingClientRect=()=>({width:390,height:340});
read('openMachine(machines[5])');pending.clear();
for(const angle of [-90,0,75]){
 read(`positions.A=${angle};positions.X=42;positions.Y=-31;`);
 const indicator=json("axisIndicators(current,createGeometry(current)).find(a=>a.key==='C')"),state=json('positions');
 check('C curved arrow follows the tilted A parent '+angle,()=>{
  assert(indicator.curved);assert.equal(indicator.pose,'work');
  const pivot=json('displayCoordinates([0,1.25,-.45])'),translation=json("displayMovement(['X','Y','A'],current,positions,'work')");
  indicator.points.forEach((p,i)=>{
   const t=-Math.PI*.65+i/24*Math.PI*1.3,base=json(`displayCoordinates(${JSON.stringify([Math.cos(t)*.8,1.68,-.45+Math.sin(t)*.8])})`),a=angle*.45/100,dy=base[1]-pivot[1],dz=base[2]-pivot[2];
   const rotated=[base[0],pivot[1]+dy*Math.cos(a)-dz*Math.sin(a),pivot[2]+dy*Math.sin(a)+dz*Math.cos(a)],expected=rotated.map((v,j)=>v+translation[j]);
   p.forEach((v,j)=>assert(Math.abs(v-expected[j])<1e-12));
  });
 });
}
read('openMachine(machines[0])');pending.clear();
r.axisControlsToggle.click();r.closeAxisControls.click();
check('explicit close restores toolbar focus',()=>{assert(r.axisMenu.hidden);assert.equal(r.axisControlsToggle.getAttribute('aria-expanded'),'false');assert.equal(focused,r.axisControlsToggle);});
r.axisControlsToggle.click();r.scene.setPointerCapture=()=>{};
r.scene.events.pointerdown({isPrimary:true,button:0,pointerId:1,clientX:40,clientY:40});
check('model drag dismisses the controls menu',()=>assert(r.axisMenu.hidden));r.scene.events.pointerup({pointerId:1});
r.axisControlsToggle.click();r.playAxis.click();
check('demo starts with visible toolbar focus',()=>{assert(r.axisMenu.hidden);assert.equal(focused,r.axisControlsToggle);assert.equal(r.playAxis.getAttribute('aria-pressed'),'true');assert.match(r.axisDemoStatus.textContent,/X軸/);});
tick(0);tick(875);check('demo changes the selected part position',()=>assert(read('positions.X')>80));tick(3500);
check('single demo ends, keeps precision comparison live and saves center',()=>{assert.equal(read('motionFrame'),null);assert.equal(read('positions.X'),0);assert.equal(r.playAxis.getAttribute('aria-pressed'),'false');assert.equal(json('levelRecord()').axisPositions.X,0);assert(Number.isFinite(Number(r['accuracy-current-XZ'].getAttribute('data-value'))));});
r.axisControlsToggle.click();r.machineMode.change('compact');
check('mode change closes the controls menu and restores toolbar focus',()=>{assert(r.axisMenu.hidden);assert.equal(r.axisControlsToggle.getAttribute('aria-expanded'),'false');assert.equal(focused,r.axisControlsToggle);assert.equal(read('machineMode'),'compact');});
r.axisControlsToggle.click();read("navigate('catalog')");
check('leaving closes the controls menu',()=>{assert(r.axisMenu.hidden);assert.equal(r.axisControlsToggle.getAttribute('aria-expanded'),'false');});
console.log('3D axis controls: '+checks+' checks passed.');

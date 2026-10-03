'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {registry:r,context,read,json}=require('./leveling-dom-env.cjs')();
let checks=0;
function check(name,fn){try{fn();checks++;}catch(e){throw new Error(name+': '+e.message);}}
const source=fs.readFileSync('src/index.html','utf8');
check('viewer stacks its flexible Canvas vertically',()=>assert.match(fs.readFileSync('src/style.css','utf8'),/\.scene-viewport\{[^}]*display:flex;[^}]*flex-direction:column;/));
check('removed explanation is not hidden elsewhere',()=>{
 assert(!source.includes('どこが動く？どこが固定？'));assert(!source.includes('motion-card'));
 for(const id of ['movingText','movingParts','partMapHeading','partMapBody','partStateHeading','fixedText','absentAxis'])assert(!r[id],id);
});
check('all axis actions belong to the fixed 3D viewer',()=>{
 for(const id of ['axisTabs','axisMenu','playAxis','resetAxes','axisSliders','machineMode'])assert.equal(r[id].closest('#sceneViewport'),r.sceneViewport,id);
 assert.equal(r.sceneViewport.closest('.pinned-visual').parentElement.closest('#training'),r.training);
 assert.equal(r.axisControlsToggle.getAttribute('aria-controls'),'axisMenu');
});
const pending=new Map();let sequence=0;
context.requestAnimationFrame=fn=>{pending.set(++sequence,fn);return sequence;};
context.cancelAnimationFrame=id=>pending.delete(id);
function tick(time){const entries=[...pending.values()];pending.clear();for(const fn of entries)fn(time);}
let paths=[],texts=[],path=[];
const canvas={scale(){},fillRect(){},beginPath(){path=[];},moveTo(x,y){assert(Number.isFinite(x)&&Number.isFinite(y));path.push([x,y]);},lineTo(x,y){assert(Number.isFinite(x)&&Number.isFinite(y));path.push([x,y]);},closePath(){},arc(){},fill(){},fillText(text,x,y){assert(Number.isFinite(x)&&Number.isFinite(y));texts.push(text);},measureText(text){return {width:text.length*6};},stroke(){if(this.lineWidth===4||this.lineWidth===2.5)paths.push({color:this.strokeStyle,width:this.lineWidth,points:path.map(p=>[...p])});}};
r.scene.getBoundingClientRect=()=>({width:390,height:340});r.scene.getContext=()=>canvas;
const layouts=[[0,'standard'],[0,'compact'],[1,''],[2,''],[3,'long'],[3,'cross'],[4,''],[5,''],[6,'']];
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
  r.axisControlsToggle.click();
  check('menu opens without resetting precision '+index+' '+mode+' '+key,()=>{assert(!r.axisMenu.hidden);assert.equal(r.axisControlsToggle.getAttribute('aria-expanded'),'true');assert.deepEqual(json('levelRecord()'),before);});
  r.axisMenu.events.keydown({key:'Escape',preventDefault(){}});
  check('Escape closes the selected-axis menu '+index+' '+mode+' '+key,()=>{assert(r.axisMenu.hidden);assert.equal(r.axisControlsToggle.getAttribute('aria-expanded'),'false');});
 }
 r.showAxes.checked=false;paths=[];read('drawScene()');
 check('axis visibility option hides all motion arrows '+index+' '+mode,()=>assert.equal(paths.length,0));
 r.showAxes.checked=true;
 const before=json('levelRecord()');read("selectAxis('B')");
 check('unavailable axis is ignored '+index+' '+mode,()=>assert.deepEqual(json('levelRecord()'),before));
}
read('openMachine(machines[5])');pending.clear();
for(const angle of [-90,0,75]){
 read(`positions.A=${angle};positions.X=42;positions.Y=-31;`);
 const indicator=json("axisIndicators(current,createGeometry(current)).find(a=>a.key==='C')"),state=json('positions');
 check('C curved arrow follows the tilted A parent '+angle,()=>{
  assert(indicator.curved);assert.equal(indicator.pose,'work');
  indicator.points.forEach((p,i)=>{
   const t=-Math.PI*.65+i/24*Math.PI*1.3,x=Math.cos(t)*.8,y=1.68,z=-.45+Math.sin(t)*.8,a=angle*.45/100;
   const expected=[x+.35*state.X/100,1.25+(y-1.25)*Math.cos(a)-(z+.45)*Math.sin(a),-.45+(y-1.25)*Math.sin(a)+(z+.45)*Math.cos(a)+.35*state.Y/100];
   p.forEach((v,j)=>assert(Math.abs(v-expected[j])<1e-12));
  });
 });
}
read('openMachine(machines[0])');pending.clear();
r.axisControlsToggle.click();r.closeAxisControls.click();
check('explicit close restores closed toolbar state',()=>{assert(r.axisMenu.hidden);assert.equal(r.axisControlsToggle.getAttribute('aria-expanded'),'false');});
r.axisControlsToggle.click();r.scene.setPointerCapture=()=>{};
r.scene.events.pointerdown({isPrimary:true,button:0,pointerId:1,clientX:40,clientY:40});
check('model drag dismisses the overlay',()=>assert(r.axisMenu.hidden));r.scene.events.pointerup({pointerId:1});
r.axisControlsToggle.click();r.playAxis.click();
check('demo starts with the model unobscured',()=>{assert(r.axisMenu.hidden);assert.equal(r.playAxis.getAttribute('aria-pressed'),'true');assert.match(r.axisDemoStatus.textContent,/X軸/);});
tick(0);tick(875);check('demo changes the selected part position',()=>assert(read('positions.X')>80));tick(3500);
check('single demo ends, keeps precision comparison live and saves center',()=>{assert.equal(read('motionFrame'),null);assert.equal(read('positions.X'),0);assert.equal(r.playAxis.getAttribute('aria-pressed'),'false');assert.equal(json('levelRecord()').axisPositions.X,0);assert(Number.isFinite(Number(r['accuracy-current-XZ'].getAttribute('data-value'))));});
r.axisControlsToggle.click();read("navigate('catalog')");
check('leaving closes the viewer menu',()=>{assert(r.axisMenu.hidden);assert.equal(r.axisControlsToggle.getAttribute('aria-expanded'),'false');});
console.log('3D axis controls: '+checks+' checks passed.');

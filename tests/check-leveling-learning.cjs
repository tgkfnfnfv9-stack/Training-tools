'use strict';
// Independent checks for the lesson: an individual stays the same while
// leveling changes its posture and relative accuracy. The initial measurement
// is recomputed at the CURRENT position, size, layout, and evaluation length.
const assert=require('node:assert/strict');
const makeEnvironment=require('./leveling-dom-env.cjs');
const MachineAccuracy=require('../src/machine-accuracy.js');
const irregularHeightOracle=require('./irregular-height-oracle.cjs');
let checks=0;
const failures=[];
function check(name,fn){checks++;try{fn();}catch(error){failures.push(name+': '+error.message);}}
function near(a,b,tolerance=1e-7){assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance,`${a} != ${b}`);}
const dot=(a,b)=>a.reduce((s,q,i)=>s+q*b[i],0);
const add=(a,b)=>a.map((q,i)=>q+b[i]);
const scale=(a,s)=>a.map(q=>q*s);
const normalize=a=>scale(a,1/Math.hypot(...a));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const variants=[[0,'compact'],[1,''],[2,''],[3,'l3-3000'],[4,''],[5,''],[6,'']];
const env=makeEnvironment();
const {registry:r,read,json,storage}=env;
read('Math.random=()=>.271828;');
function open(index,mode){read(`openMachine(machines[${index}])`);if(mode)r.machineMode.change(mode);}
function setProfile(condition,seed){
 const profile=MachineAccuracy.generate(condition,seed,json('machineLinearKeys()'),read('supports.length'));
 read(`initializeMachineAccuracy(${JSON.stringify(profile)});supportHeights=[...machineProfile.initialHeights];updateLeveling();`);
 return profile;
}
// Solve the derivative from the stated piecewise bilinear/three-point model,
// rather than using geometryModel or before/after UI values. For irregular
// supports the independently differenced height graph is used (see helper).
function independentSlope(points,x,z){
 if(points.length===3){
  const [p,q,t]=points,dx=q.x-p.x,dz=q.z-p.z,tx=t.x-p.x,tz=t.z-p.z,dh=q.h-p.h,th=t.h-p.h,det=dx*tz-tx*dz;
  return {lr:(dh*tz-th*dz)/det,fb:(dx*th-tx*dh)/det};
 }
 const xs=[...new Set(points.map(p=>p.x))].sort((a,b)=>a-b),zs=[...new Set(points.map(p=>p.z))].sort((a,b)=>a-b);
 if(points.length!==xs.length*zs.length)return irregularHeightOracle(points).slopeAt(x,z);
 const interval=(values,value)=>{let i=0;while(i<values.length-2&&value>=values[i+1])i++;return i;};
 const i=interval(xs,x),j=interval(zs,z),dx=xs[i+1]-xs[i],dz=zs[j+1]-zs[j],u=(x-xs[i])/dx,v=(z-zs[j])/dz;
 const h=(x,z)=>points.find(p=>p.x===x&&p.z===z).h;
 const h00=h(xs[i],zs[j]),h10=h(xs[i+1],zs[j]),h01=h(xs[i],zs[j+1]),h11=h(xs[i+1],zs[j+1]);
 const bend=h11-h01-h10+h00;
 return {lr:(h10-h00+bend*v)/dx,fb:(h01-h00+bend*u)/dz};
}
function frame(slope){
 const a=slope.lr/1000,b=slope.fb/1000,right=normalize([1,a,0]),up=normalize([-a,1,-b]),back=cross(right,up);
 return vector=>add(add(scale(right,vector[0]),scale(up,vector[1])),scale(back,vector[2]));
}
function expected(heights){
 const m=json('current'),cfg=json('levelConfig'),profile=json('machineProfile'),g=json('levelGeometry'),support=json('supports');
 const coordinates=p=>({x:p.x/(m.w*.8)*cfg.width,z:p.z/(m.d*.8)*cfg.depth});
 const points=support.map((p,i)=>({...coordinates(p),h:heights[i]}));
 const avgSlope=list=>{
  const slopes=list.map(p=>{const q=coordinates(p);return independentSlope(points,q.x,q.z);});
  return {slopes,slope:{lr:slopes.reduce((s,p)=>s+p.lr/slopes.length,0),fb:slopes.reduce((s,p)=>s+p.fb/slopes.length,0)}};
 };
 const tool=avgSlope(g.toolPoints),work=avgSlope([g.workPoint]);
 const axes=json('axisConfig(current).filter(a=>["X","Y","Z"].includes(a.key))');
 const intrinsic=(i,j)=>profile.squareness[axes[i].key+axes[j].key].microns/300000;
 const xy=intrinsic(0,1),yx=-Math.sin(xy),yy=Math.cos(xy),vectors=[axes[0].vector,add(scale(axes[0].vector,yx),scale(axes[1].vector,yy))];
 if(axes.length===3){const zx=-Math.sin(intrinsic(0,2)),zy=(-Math.sin(intrinsic(1,2))-zx*yx)/yy,zz=Math.sqrt(1-zx*zx-zy*zy);vectors.push(add(add(scale(axes[0].vector,zx),scale(axes[1].vector,zy)),scale(axes[2].vector,zz)));}
 const rotateTool=frame(tool.slope),rotateWork=frame(work.slope),directions=axes.map((a,i)=>(g.axes.find(q=>q.key===a.key).source==='tool'?rotateTool:rotateWork)(vectors[i]));
 const pairs=[];
 for(let i=0;i<axes.length;i++)for(let j=i+1;j<axes.length;j++){
  const product=Math.max(-1,Math.min(1,dot(directions[i],directions[j]))),deviation=Math.abs(product)<1e-14?0:-Math.asin(product)*1e6;
  pairs.push({key:axes[i].key+axes[j].key,error:deviation*cfg.offset});
 }
 const lean=s=>({front:Math.atan(s.fb/1000)*1e6,right:-Math.atan(s.lr/1000)*1e6});
 const toolLean=lean(tool.slope),workLean=lean(work.slope),xs=points.map(p=>p.x),zs=points.map(p=>p.z);
 let twist=0;
 if(points.length>3){const x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs),h=new Set(xs).size*new Set(zs).size===points.length?(x,z)=>points.find(p=>p.x===x&&p.z===z).h:irregularHeightOracle(points).heightAt;twist=(h(x1,z1)-h(x0,z1)-h(x1,z0)+h(x0,z0))/(x1-x0);}
 return {pairs,toolLean,relativeLean:{front:toolLean.front-workLean.front,right:toolLean.right-workLean.right},columns:tool.slopes.map(lean),twist};
}
const data=(element,key)=>element?.getAttribute('data-'+key)??element?.dataset?.[key];
function rowMetrics(id){
 const found=[];
 function visit(element){if(data(element,'metric')!==undefined&&data(element,'metric')!==null)found.push(element);for(const child of element.children)visit(child);}
 visit(r[id]);return found;
}
function numericText(element){const match=/[+−-]?\d+(?:\.\d+)?/.exec(element.textContent);assert.ok(match,'数値の表示がない');return Number(match[0].replace('−','-'));}
function assertRowText(element,before,current,tolerance){
 const values=[...element.textContent.matchAll(/[+−-]?\d+(?:\.\d+)?/g)].map(m=>Number(m[0].replace('−','-')));
 assert.equal(values.length,1,'現在の測定値だけを表示する');near(values[0],current,tolerance);
 assert.match(element.textContent,/現在/);assert.doesNotMatch(element.textContent,/抽選時|Δ/);
}
function assertPairDOM(before,after){
 for(const p of after.pairs){
  const b=before.pairs.find(q=>q.key===p.key).error;
  for(const [part,value] of [['before',b],['current',p.error],['delta',p.error-b]]){
   const node=r[`accuracy-${part}-${p.key}`];assert.ok(node,`accuracy-${part}-${p.key}がない`);
   near(Number(data(node,'value')),value);
   if(part==='current')near(numericText(node),value,.0050001);
   else {assert.equal(node.hidden,true);assert.equal(node.textContent,'','初期と差分は数値表示しない');}
  }
  const trend=r[`accuracy-trend-${p.key}`];assert.ok(trend,'改善/悪化表示がない');
  const absolute=Math.abs(p.error)-Math.abs(b),expectedTrend=Math.abs(absolute)<=.005?'similar':absolute<0?'better':'worse';
  assert.equal(data(trend,'trend'),expectedTrend);
  near(Number(data(trend,'absolute-change')),absolute);
 }
}
function assertPostureDOM(id,before,after){
 for(const key of ['front','right']){
  const row=rowMetrics(id).find(p=>data(p,'metric')===key);assert.ok(row,`${id}の${key}行がない`);
  near(Number(data(row,'before')),before[key]);near(Number(data(row,'current')),after[key]);near(Number(data(row,'delta')),after[key]-before[key]);
  assertRowText(row,before[key],after[key],.0050001);
 }
}
function assertCurrentLesson(){
 const profile=json('machineProfile'),before=expected(profile.initialHeights),after=expected(json('supportHeights'));
 assertPairDOM(before,after);
 assertPostureDOM('columnLeanComparison',before.toolLean,after.toolLean);
 assertPostureDOM('relativeLeanComparison',before.relativeLean,after.relativeLean);
 const twistRows=rowMetrics('twistComparison'),twist=twistRows.find(p=>data(p,'metric')==='twist')??twistRows[0];assert.ok(twist,'ねじれの比較がない');
 near(Number(data(twist,'before')),before.twist);near(Number(data(twist,'current')),after.twist);near(Number(data(twist,'delta')),after.twist-before.twist);
 assertRowText(twist,before.twist,after.twist,.00000051);
 if(after.columns.length===2){
  const row=rowMetrics('columnDifferenceComparison').find(p=>data(p,'metric')==='frontDifference');assert.ok(row,'門の個別コラム差比較がない');
  const b=before.columns[1].front-before.columns[0].front,c=after.columns[1].front-after.columns[0].front;
  near(Number(data(row,'before')),b);near(Number(data(row,'current')),c);near(Number(data(row,'delta')),c-b);assertRowText(row,b,c,.0050001);
 }else assert.equal(r.columnDifferenceComparison.hidden,true);
 return {before,after};
}

for(const [index,mode] of variants){
 storage.clear();open(index,mode);const label=`${index}/${mode}`;
 const profile=setProfile(index%2?'used':'new',42+index);
 check(`全構造で初期と現在は同条件なら同じ ${label}`,()=>{
  const {before,after}=assertCurrentLesson();after.pairs.forEach((p,i)=>near(p.error,before.pairs[i].error));
  assert.equal(read('levelInitialSolution.twist'),read('levelSolution.twist'));
  assert.deepEqual(json('machineProfile'),profile);
  if(index===6){assert.equal(r.accuracyMetrics.querySelectorAll('#accuracy-before-XY').length,0);assert.equal(r.accuracyMetrics.querySelectorAll('#accuracy-before-YZ').length,0);}
 });
 read('setSupportHeight(0,supportHeights[0]+.001)');
 check(`1µm支持調整後の値とDOMは初期からの実差 ${label}`,()=>{
  assertCurrentLesson();assert.deepEqual(json('machineProfile'),profile);
  assert.deepEqual(json('machineProfile.initialHeights'),profile.initialHeights);
 });
 // Actual input events must refresh the initial measurement too. Changing
 // position can alter a before value even while the machine remains identical.
 for(const key of json('machineLinearKeys()')){
  r['axis-'+key].value=key==='X'?'61':key==='Y'?'-37':'24';r['axis-'+key].events.input({target:r['axis-'+key]});
  check(`軸位置変更は初期比較も同じ位置へ更新 ${label} ${key}`,()=>assertCurrentLesson());
 }
 if(['vertical','compact','travel','horizontal','five'].includes(read('current.kind'))){
  r.columnX.value='-71';r.columnX.oninput();r.columnZ.value='43';r.columnZ.oninput();
  check(`コラム配置変更は初期比較も現在配置へ更新 ${label}`,()=>assertCurrentLesson());
 }
 r.supportWidth.value='7.23';r.supportWidth.oninput();r.supportDepth.value='3.81';r.supportDepth.oninput();
 check(`仮想寸法変更は初期も現在も再計算 ${label}`,()=>assertCurrentLesson());
 const beforeLength=assertCurrentLesson();
 r.impactOffset.value='1.35';r.impactOffset.oninput();
 check(`評価長変更で初期・現在・差が同じ割合で換算 ${label}`,()=>{
  const afterLength=assertCurrentLesson();beforeLength.before.pairs.forEach((p,i)=>near(afterLength.before.pairs[i].error,p.error*2.7));beforeLength.after.pairs.forEach((p,i)=>near(afterLength.after.pairs[i].error,p.error*2.7));
  assert.deepEqual(json('machineProfile'),profile);
 });
 const record=json('levelRecord()');open(index,mode);
 check(`保存・再表示で個体と初期比較が厳密に戻る ${label}`,()=>{assert.deepEqual(json('levelRecord()'),record);assertCurrentLesson();});
 r.restoreInitialLevel.click();
 check(`初期戻しは現在の条件で差を0へ戻す ${label}`,()=>{assertCurrentLesson();assert.deepEqual(json('supportHeights'),profile.initialHeights);for(const p of json('levelGeometry.pairs'))near(Number(data(r['accuracy-delta-'+p.key],'value')),0);});
 r.drawMachine.click();
 check(`再抽選後の基準は新個体の初期支持高さ ${label}`,()=>{assert.notEqual(read('machineProfile.seed'),profile.seed);assertCurrentLesson();assert.deepEqual(json('supportHeights'),json('machineProfile.initialHeights'));});
}

storage.clear();open(0,'compact');const compact=setProfile('new',42);
read('positions={X:40,Y:-25,Z:20,A:0,C:0};levelConfig.columnX=20;levelConfig.columnZ=-15;updateAxisValues();updateLeveling();');
const beforeFine=assertCurrentLesson();
read('setSupportHeight(0,supportHeights[0]+.001)');
check('小型の1µm調整は倒れ・ねじれ・XZへ小さく連動する',()=>{
 const {before,after}=assertCurrentLesson();
 near(after.twist-before.twist,.00048076923076923074,1e-12);
 near(after.toolLean.front-before.toolLean.front,-.208333333030708,1e-7);
 near(after.pairs.find(p=>p.key==='XZ').error-before.pairs.find(p=>p.key==='XZ').error,.12380920513457,1e-7);
 assert.notEqual(Number(data(r['accuracy-delta-XZ'],'value')),0);assert.equal(r['accuracy-delta-XZ'].hidden,true);
 assert.deepEqual(json('machineProfile'),compact);
});
// These actual geometry cases cross zero or move a negative deviation toward
// zero. Their status must follow magnitude, never the sign of the change alone.
for(const [heights,key,status] of [[[.3,-.3,-.3,.3],'XZ','worse'],[[-.05,.05,.05,-.05],'XZ','better']]){
 read(`supportHeights=${JSON.stringify(heights)};updateLeveling();`);
 check(`実ジオメトリの符号付き差と精度の良否を混同しない ${status}`,()=>{
  const {before,after}=assertCurrentLesson(),b=before.pairs.find(p=>p.key===key).error,c=after.pairs.find(p=>p.key===key).error;
  assert.ok(c-b>0);assert.equal(data(r['accuracy-trend-'+key],'trend'),status);
 });
}
for(const [b,c,trend] of [[10,-20,'worse'],[-20,-10,'better'],[10,-10,'similar'],[0,0,'similar'],[10,10.003,'similar'],[10,10.02,'worse']]){
 check(`差の分類は独立した絶対値基準 ${b}→${c}`,()=>{
  const value=json(`accuracyChange(${b},${c})`);near(value.delta,c-b);near(value.absoluteChange,Math.abs(c)-Math.abs(b));assert.equal(value.trend,trend);
 });
}

// A three-support machine is always a single plane. Common rigid inclination
// can change its lean while preserving every intrinsic pair angle.
storage.clear();open(5);const three=setProfile('used',99);
read('supportHeights=supports.map(s=>Math.round((.05+.08*s.x/(current.w*.4)-.03*s.z/(current.d*.4))*1000)/1000);updateLeveling();');
check('3点は姿勢が変化してもねじれと相対直角度を増やさない',()=>{
 const {before,after}=assertCurrentLesson();near(before.twist,0);near(after.twist,0);
 after.pairs.forEach((p,i)=>near(p.error,before.pairs[i].error));assert.notEqual(after.toolLean.front,before.toolLean.front);
 assert.deepEqual(json('machineProfile'),three);
});
read('supportHeights=supportHeights.map(h=>h+.001);updateLeveling();');
check('共通の高さ移動は比較でも精度不変として扱う',()=>{assertCurrentLesson();for(const p of json('levelGeometry.pairs'))assert.equal(data(r['accuracy-trend-'+p.key],'trend'),'similar');});

async function finish(){
 storage.clear();open(0,'compact');setProfile('used',123);
 read('setSupportHeight(0,.169);positions={X:61,Y:-37,Z:24,A:0,C:0};updateAxisValues();levelConfig.columnX=-53;levelConfig.columnZ=-24;levelConfig.width=6.7;levelConfig.depth=1.5;levelConfig.offset=.7;updateLeveling();');
 const record=json('levelRecord()'),initialPairs=json('levelInitialGeometry.pairs'),currentPairs=json('levelGeometry.pairs');
 r.exportLevel.click();const exported=JSON.parse(await env.context.exportedBlob.text());
 check('JSON書き出しにも初期比較の個体・条件を保持',()=>assert.deepEqual(exported,record));
 async function importRecord(value){r.importLevel.files=[{size:JSON.stringify(value).length,text:async()=>JSON.stringify(value)}];await r.importLevel.onchange({target:r.importLevel});}
 r.drawMachine.click();await importRecord(exported);
 check('JSON復元は初期と現在の比較・表示も厳密に再現',()=>{
  assert.deepEqual(json('levelRecord()'),record);assert.deepEqual(json('levelInitialGeometry.pairs'),initialPairs);assert.deepEqual(json('levelGeometry.pairs'),currentPairs);assertCurrentLesson();
 });
 const invalid=structuredClone(record);invalid.machineProfile.seed++;await importRecord(invalid);
 check('不正な個体JSONで初期比較だけ更新されることもない',()=>{assert.deepEqual(json('levelRecord()'),record);assert.deepEqual(json('levelInitialGeometry.pairs'),initialPairs);assertCurrentLesson();});
 // A scheduled axis demo has no support-change event. Its drawScene path must
 // still refresh the initial state at the demo's current position every frame.
 const originalRAF=env.context.requestAnimationFrame,originalCancel=env.context.cancelAnimationFrame,scheduled=[],cancelled=new Set();
 env.context.requestAnimationFrame=f=>{const id=scheduled.length+1;scheduled.push({id,f});return id;};
 env.context.cancelAnimationFrame=id=>cancelled.add(id);
 r.playAxis.click();scheduled[0].f(0);const atZero=json('levelInitialGeometry.pairs');scheduled[1].f(875);
 check('軸デモ中も現在位置の初期比較を更新する',()=>{
  near(read('positions.X'),85);assertCurrentLesson();
  const now=json('levelInitialGeometry.pairs');assert.ok(now.some((p,i)=>Math.abs(p.errorMicrons-atZero[i].errorMicrons)>.001),'初期を軸0の位置へ固定している');
 });
 read('stopMotion()');env.context.requestAnimationFrame=originalRAF;env.context.cancelAnimationFrame=originalCancel;
 check('デモ停止後は最終位置と比較を保存して維持',()=>{assert.ok(cancelled.size>0);assert.equal(read('motionFrame'),null);assert.equal(json('levelRecord().axisPositions.X'),85);assertCurrentLesson();});
 const baselineBeforeExercise=json('machineProfile.initialHeights');r.startLevelExercise.click();
 check('別支持状態の練習でも比較基準は抽選時のまま',()=>{assert.deepEqual(json('machineProfile.initialHeights'),baselineBeforeExercise);assertCurrentLesson();assert.match(r.levelInputMessage.textContent,/抽選時/);});
 // A newer manual change wins over a file that finishes reading later; the
 // before/current card must continue describing the accepted current state.
 let finishReading;
 r.importLevel.files=[{size:100,text:()=>new Promise(resolve=>{finishReading=resolve;})}];
 const pending=r.importLevel.onchange({target:r.importLevel});
 r.height0.change('.121');const newer=json('levelRecord()'),newerPairs=json('levelGeometry.pairs');finishReading(JSON.stringify(record));await pending;
 check('遅れたJSON読み込みは新しい支持変更と比較を上書きしない',()=>{assert.deepEqual(json('levelRecord()'),newer);assert.deepEqual(json('levelGeometry.pairs'),newerPairs);assertCurrentLesson();});
 if(failures.length){console.error(`Leveling learning: ${checks} checks run; ${failures.length} failed.\n${failures.join('\n')}`);process.exitCode=1;}
 else console.log(`Leveling learning: ${checks} checks passed.`);
}
finish().catch(error=>{console.error(error);process.exitCode=1;});

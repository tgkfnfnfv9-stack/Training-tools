'use strict';
// Independent invariants for randomized machine defects, optimization, and
// durable training states. No sampled profile is assumed to be perfect.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const MachineAccuracy=require('../src/machine-accuracy.js');
const Leveling=require('../src/leveling.js');
const createEnvironment=require('./leveling-dom-env.cjs');
let checks=0;const failures=[];
function check(name,fn){checks++;try{fn();}catch(error){failures.push(name+': '+error.message);}}
function near(a,b,tolerance=1e-8){assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance,`${a} != ${b}`);}
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),norm=a=>Math.hypot(...a),sub=(a,b)=>a.map((v,i)=>v-b[i]),unit=a=>a.map(v=>v/norm(a));
const keys=['X','Y','Z'];
const axisVectors=[{key:'X',vector:[1,0,0],source:'work'},{key:'Y',vector:[0,0,1],source:'work'},{key:'Z',vector:[0,1,0],source:'tool'}];
check('抽選確率と300 mmの基準は教材設定どおり',()=>{
 assert.equal(MachineAccuracy.referenceLength,.3);
 assert.deepEqual(MachineAccuracy.distributions.new,[{weight:95,min:1,max:20},{weight:5,min:20,max:40}]);
 assert.deepEqual(MachineAccuracy.distributions.used,[{weight:60,min:5,max:20},{weight:30,min:20,max:60},{weight:10,min:60,max:150}]);
});
for(const condition of ['new','used']){
 const bins=MachineAccuracy.distributions[condition].map(()=>0);let positive=0,negative=0;
 for(let seed=0;seed<5000;seed++){
  const profile=MachineAccuracy.generate(condition,seed,keys,4);
  for(const item of [...Object.values(profile.squareness),...Object.values(profile.guides)]){
   const band=MachineAccuracy.distributions[condition][item.band];
   assert.ok(Math.abs(item.microns)>=band.min&&Math.abs(item.microns)<=band.max,'抽選レンジ外');bins[item.band]++;
  }
  for(const item of Object.values(profile.squareness))item.microns>0?positive++:negative++;
 }
 check(condition+'の頻度は5000個体でも設定率から大きく偏らない',()=>{
  const total=bins.reduce((a,b)=>a+b,0);bins.forEach((count,i)=>near(count/total*100,MachineAccuracy.distributions[condition][i].weight,1.5));near(positive/(positive+negative)*100,50,1.5);
 });
 for(const seed of [0,1,42,1024,4294967295]){
  const p=MachineAccuracy.generate(condition,seed,keys,4);
  check(condition+'の同じ種で個体が厳密に再現 '+seed,()=>{assert.deepEqual(MachineAccuracy.generate(condition,seed,keys,4),p);assert.equal(MachineAccuracy.valid(p,keys,4),true);});
  check(condition+'の単位ベクトルは指定した三つの固有角度を同時に保持 '+seed,()=>{
   const axes=MachineAccuracy.directions(axisVectors,p);axes.forEach(a=>near(norm(a.vector),1,1e-12));
   for(let i=0;i<axes.length;i++)for(let j=i+1;j<axes.length;j++)near(-Math.asin(dot(axes[i].vector,axes[j].vector))*300000,p.squareness[axes[i].key+axes[j].key].microns,1e-8);
  });
  check(condition+'の共通床傾斜は固有直角差を変えない '+seed,()=>{
   const solution=Leveling.solve([-1,1].flatMap(z=>[-1,1].map(x=>({x,z,h:.17*x-.09*z+.2}))));
   const g=Leveling.geometry(solution,{axes:MachineAccuracy.directions(axisVectors,p),toolPoints:[{x:.8,z:.8}],workPoints:[{x:-.7,z:-.8}],length:.3});
   g.pairs.forEach(item=>near(item.errorMicrons,p.squareness[item.key].microns,1e-8));
  });
 }
}
for(const args of [['old',1,keys,4],['new',-1,keys,4],['new',4294967296,keys,4],['new',.5,keys,4],['new',NaN,keys,4],['new',1,['X','X'],4],['new',1,['X','A'],4],['new',1,['X'],4],['new',1,keys,2],['new',1,keys,9]])check('不正な抽選条件を拒否 '+JSON.stringify(args),()=>assert.throws(()=>MachineAccuracy.generate(...args)));
const stable=MachineAccuracy.generate('used',42,keys,4);
for(const mutate of [p=>p.seed++,p=>p.version=2,p=>p.condition='new',p=>p.keys.reverse(),p=>p.squareness.XY.microns++,p=>p.guides.X.band++,p=>p.initialHeights[0]+=.001,p=>p.extra=1]){
 const p=structuredClone(stable);mutate(p);check('改ざんされた個体を受け入れない',()=>assert.equal(MachineAccuracy.valid(p,keys,4),false));
}
check('二軸旋盤の非直交方向はXZだけを保持',()=>{
 const p=MachineAccuracy.generate('used',99,['X','Z'],6),axes=MachineAccuracy.directions([{key:'X',vector:[0,0,1]},{key:'Z',vector:[1,0,0]}],p);
 assert.deepEqual(Object.keys(p.squareness),['XZ']);assert.deepEqual(Object.keys(p.guides),['X','Z']);near(-Math.asin(dot(axes[0].vector,axes[1].vector))*300000,p.squareness.XZ.microns,1e-8);
});
check('探索は独立した既知の最良解を0.001 mm刻みで見つける',()=>{
 const best=MachineAccuracy.optimize([[1,0],[0,1]],[-.021,.037],[-.4,.4]);assert.deepEqual(best.heights,[.021,-.037]);near(best.value,0,1e-18);
});
check('探索は上限下限と一様高さの自由度を扱える',()=>{
 assert.deepEqual(MachineAccuracy.optimize([[1,0],[0,1]],[-2,2],[.2,-.2]).heights,[.5,-.5]);
 const sum=MachineAccuracy.optimize([[1,1]],[.001],[0,0]);near(sum.heights[0]+sum.heights[1],-.001,1e-12);near(sum.value,0,1e-18);
});

async function main(){
 const env=createEnvironment(),{registry:r,read,json,storage,context}=env;
 read('Math.random=()=>.271828;');
 const open=(index,mode)=>{read(`openMachine(machines[${index}])`);if(mode)r.machineMode.change(mode);};
 const snapshot=()=>json('levelRecord()');
 const evalNow=()=>json('machineEvaluation(supportHeights)');
 const current=()=>json('levelGeometry');
 const guideValues=()=>json('machineProfile.guides');
 const setHeight=(i,value)=>r['height'+i].change(String(value));
 async function importRecord(record){r.importLevel.files=[{size:100,text:async()=>JSON.stringify(record)}];await r.importLevel.onchange({target:r.importLevel});}
 for(const [index,mode] of [[0,'standard'],[0,'compact'],[1,''],[2,''],[3,'long'],[3,'cross'],[4,''],[5,''],[6,'']]){
  storage.clear();open(index,mode);const first=snapshot(),profile=json('machineProfile');
  check('個体は初期表示時に直ちに保存 '+index+' '+mode,()=>{assert.equal(first.version,2);assert.deepEqual(JSON.parse(storage.get(read('levelKey()'))),first);assert.deepEqual(first.heights,profile.initialHeights);assert.equal(read('validLevelRecord(levelRecord())'),true);});
  open(index,mode);
  check('操作なしで開き直しても同じ個体 '+index+' '+mode,()=>{assert.deepEqual(snapshot(),first);assert.match(r.levelSaveStatus.textContent,/復元/);});
  check('全直線軸の端中央を漏れなく列挙 '+index+' '+mode,()=>{
   const states=json('accuracyRange.map(s=>s.state)'),axes=json('machineLinearKeys()');assert.equal(states.length,axes.length===2?9:27);
   for(const key of axes)assert.deepEqual([...new Set(states.map(s=>s[key]))].sort((a,b)=>a-b),[-100,0,100]);assert.equal(new Set(states.map(s=>axes.map(k=>s[k]).join(','))).size,states.length);
  });
  const initialMetric=evalNow(),best=json('machineReference.best'),guides=guideValues();
  check('参考探索は現在の据付より評価を悪化させない '+index+' '+mode,()=>{
   assert.ok(best.metric.objective<=initialMetric.objective+1e-8);assert.ok(best.heights.every(h=>Math.abs(h)<=.5&&Math.abs(h*1000-Math.round(h*1000))<1e-7));
  });
  r.applyBestLevel.click();
  check('参考調整は達成判定と数値が同期 '+index+' '+mode,()=>{
   near(evalNow().objective,json('machineReference.best.metric.objective'),1e-7);assert.equal(read('levelExercise.solved'),true);assert.equal(r.applyBestLevel.disabled,true);assert.match(r.machineProgress.textContent,/近傍/);assert.deepEqual(guideValues(),guides);
  });
  check('角度と表示長と300 mm評価を混同しない '+index+' '+mode,()=>{
   const metric=evalNow(),pairs=current().pairs,seed=read('machineProfile.seed');r.impactOffset.change('.1');const short=current().pairs;r.impactOffset.change('2');const long=current().pairs;
   pairs.forEach((p,i)=>{near(short[i].deviationMicroradians,p.deviationMicroradians);near(long[i].deviationMicroradians,p.deviationMicroradians);near(long[i].errorMicrons,short[i].errorMicrons*20,1e-7);});
   near(evalNow().objective,metric.objective,1e-10);assert.equal(read('machineProfile.seed'),seed);assert.equal(r.applyBestLevel.disabled,true);assert.deepEqual(guideValues(),guides);
  });
  check('調整余地は固有誤差床を二乗で差し引く '+index+' '+mode,()=>{
   const m=evalNow(),reference=json('machineReference.best.metric'),result=json('updateMachineAccuracy()');
   near(result.gap,Math.sqrt(Math.max(0,m.objective*m.objective-reference.objective*reference.objective)),1e-8);assert.equal(result.target,result.gap<=.1);
  });
  r.restoreInitialLevel.click();
  check('初期へ戻しても固有個体はそのまま '+index+' '+mode,()=>{assert.deepEqual(json('supportHeights'),profile.initialHeights);assert.deepEqual(json('machineProfile'),profile);assert.deepEqual(guideValues(),guides);});
  r.startLevelExercise.click();
  check('据付状態の再出題はガイドや固有直角度を再抽選しない '+index+' '+mode,()=>{assert.deepEqual(json('machineProfile'),profile);assert.deepEqual(guideValues(),guides);assert.equal(read('validLevelRecord(levelRecord())'),true);});
 }
 storage.clear();open(0,'compact');const unchanged=json('machineProfile'),before=read('supportHeights[0]');r.up0.click();
 check('最小調整量は0.001 mmで表示と保存が同期',()=>{near(read('supportHeights[0]'),before+.001);assert.equal(r.height0.value,(before+.001).toFixed(3));assert.deepEqual(snapshot().machineProfile,unchanged);});
 r.height0.value='.1234';r.height0.oninput({target:r.height0});
 check('入力中は表記を保ち計算を0.001 mmへ丸める',()=>{assert.equal(r.height0.value,'.1234');near(read('supportHeights[0]'),.123);});r.height0.change();
 check('入力確定後は三桁へ揃える',()=>assert.equal(r.height0.value,'0.123'));
 for(const value of ['', 'NaN', '0.5001', '-0.5001']){
  const before=snapshot();r.height0.change(value);check('不正高さは計算個体を変えない '+JSON.stringify(value),()=>{assert.deepEqual(snapshot(),before);assert.equal(r.height0.value,'0.123');});
 }
 setHeight(0,.5);r.up0.click();check('0.001 mm操作でも上限を守る',()=>near(read('supportHeights[0]'),.5));setHeight(0,-.5);r.down0.click();check('0.001 mm操作でも下限を守る',()=>near(read('supportHeights[0]'),-.5));
 r.machineCondition.change('used');const used=json('machineProfile');
 check('中古へ変更は新しい個体と初期据付を即保存',()=>{assert.equal(used.condition,'used');assert.notEqual(used.seed,unchanged.seed);assert.deepEqual(json('supportHeights'),used.initialHeights);assert.deepEqual(JSON.parse(storage.get(read('levelKey()'))).machineProfile,used);});
 r.drawMachine.click();check('別個体を抽選で種が必ず変わる',()=>assert.notEqual(read('machineProfile.seed'),used.seed));
 read('positions={X:37,Y:-29,Z:61,A:0,C:0};updateAxisValues();');r.columnX.value='-63';r.columnX.oninput();r.columnZ.value='47';r.columnZ.oninput();r.height0.change('.237');r.impactOffset.change('.7');
 const record=snapshot(),savedPairs=current().pairs;open(1);open(0,'compact');
 check('個体・配置・軸位置・調整精度は再表示で厳密に復元',()=>{assert.deepEqual(snapshot(),record);assert.deepEqual(current().pairs,savedPairs);});
 r.exportLevel.click();const exported=JSON.parse(await context.exportedBlob.text());
 check('JSON保存は個体の種と初期高さと現在高さを含む',()=>assert.deepEqual(exported,record));
 r.drawMachine.click();await importRecord(exported);
 check('JSON読込で同じ個体と角度を厳密に再現',()=>{assert.deepEqual(snapshot(),record);assert.deepEqual(current().pairs,savedPairs);assert.match(r.levelInputMessage.textContent,/読み込みました/);});
 const mutations=[p=>p.version=3,p=>p.machineProfile.seed++,p=>p.machineProfile.condition='new',p=>p.machineProfile.version=2,p=>p.machineProfile.guides.X.microns=0,p=>delete p.machineProfile.guides.Y,p=>p.machineProfile.squareness.XY.microns=1e300,p=>p.machineProfile.initialHeights[0]+=.001,p=>p.heights[0]=.1234,p=>p.heights[0]=null,p=>p.machineProfile.keys.push('A'),p=>p.machineProfile.extra='x',p=>p.machineProfile=null,p=>p.axisPositions.Z=101,
  p=>p.bestState=null,p=>p.bestState=[],p=>p.bestState.width+=1,p=>p.bestState.columnX+=1,p=>p.bestState.heights.pop(),p=>p.bestState.heights[0]=.1234,p=>p.bestState.heights[0]=.501,p=>p.bestState.extra=1];
 for(let i=0;i<mutations.length;i++){
  const invalid=structuredClone(record);mutations[i](invalid);await importRecord(invalid);
  check('不正個体JSONは状態を一切反映しない '+i,()=>{assert.deepEqual(snapshot(),record);assert.match(r.levelInputMessage.textContent,/読込できません/);});
 }
 const legacy=structuredClone(record);legacy.version=1;delete legacy.machineProfile;delete legacy.bestState;legacy.heights=[.1,-.1,.2,-.2];delete legacy.columnX;delete legacy.columnZ;delete legacy.axisPositions;legacy.step=.01;
 await importRecord(legacy);
 check('旧JSONは支持高さを保持し個体を生成して新版へ保存',()=>{assert.deepEqual(json('supportHeights'),legacy.heights);assert.equal(snapshot().version,2);assert.equal(read('validLevelRecord(levelRecord())'),true);assert.equal(read('levelConfig.columnX'),0);assert.equal(read('levelConfig.columnZ'),0);assert.deepEqual(snapshot().axisPositions,{X:0,Y:0,Z:0});assert.deepEqual(JSON.parse(storage.get(read('levelKey()'))),snapshot());});
 const migrated=snapshot();open(1);open(0,'compact');check('旧JSON移行後の個体も二度目の表示で再抽選しない',()=>assert.deepEqual(snapshot(),migrated));
 storage.clear();open(1);
 const highFloor=snapshot();delete highFloor.bestState;highFloor.width=20;highFloor.depth=20;highFloor.machineProfile=MachineAccuracy.generate('used',36,keys,4);highFloor.heights=[...highFloor.machineProfile.initialHeights];
 await importRecord(highFloor);
 check('固有誤差が大きい中古でも初期据付を誤って達成と判定しない',()=>{
  const m=evalNow(),best=json('machineReference.best.metric'),result=json('updateMachineAccuracy()');
  assert.ok(m.objective-best.objective<.1,'RMSの単純差なら誤判定する個体');assert.ok(result.gap>.1);assert.equal(result.target,false);assert.equal(read('levelExercise.solved'),false);
 });
 storage.clear();open(0,'compact');
 const preserved=snapshot(),preservedObjective=json('machineReference.best.metric.objective');
 check('最良の支持高さも個体と同じJSONへ保存する',()=>{assert.deepEqual(preserved.bestState,json('machineBestRecord()'));assert.ok(preservedObjective<read('machineEvaluation(supports.map(()=>0)).objective')-.0001);});
 // Simulate a weaker later search: a genuinely better saved candidate must
 // survive despite the current state being worse than that saved candidate.
 read('window.reviewOriginalAccuracy=window.MachineAccuracy;window.MachineAccuracy={...window.MachineAccuracy,optimize:()=>({heights:supports.map(()=>0),value:0})};');
 open(1);open(0,'compact');
 check('良い支持高さの保存後に悪い現在状態で戻っても最良を保持',()=>{assert.deepEqual(json('supportHeights'),preserved.heights);assert.deepEqual(json('machineReference.best.heights'),preserved.bestState.heights);near(json('machineReference.best.metric.objective'),preservedObjective,1e-8);});
 r.drawMachine.click();await importRecord(preserved);
 check('エクスポートした最良支持高さも再探索の候補として復元',()=>{assert.deepEqual(json('machineReference.best.heights'),preserved.bestState.heights);near(json('machineReference.best.metric.objective'),preservedObjective,1e-8);});
 read('window.MachineAccuracy=window.reviewOriginalAccuracy;delete window.reviewOriginalAccuracy;');
 const worseCandidate=structuredClone(preserved);worseCandidate.bestState.heights=[...worseCandidate.machineProfile.initialHeights];await importRecord(worseCandidate);
 check('保存された最良候補を無条件に信用せず実モデルで再評価',()=>{assert.ok(json('machineReference.best.metric.objective')<=preservedObjective+1e-8);assert.notDeepEqual(json('machineReference.best.heights'),worseCandidate.bestState.heights);});
 r.zero.click();r.exaggerate.checked=false;r.exaggerate.onchange();
 check('非誇張3D軸ベクトルは固有直角度の数値と一致',()=>{
  const g=current(),directions=g.axes.map(a=>{
   const vector=json(`accuracyVisualVector('${a.key}')`),anchor=g.poses[a.source].anchor,p=[anchor.x,.66,anchor.z];
   return {key:a.key,direction:unit(sub(json(`levelVisualPoint(${JSON.stringify(p.map((v,i)=>v+vector[i]))},'${a.source}')`),json(`levelVisualPoint(${JSON.stringify(p)},'${a.source}')`)))};
  });
   for(let i=0;i<directions.length;i++)for(let j=i+1;j<directions.length;j++)near(-Math.asin(dot(directions[i].direction,directions[j].direction))*1e6,g.pairs.find(p=>p.key===directions[i].key+directions[j].key).deviationMicroradians,1e-7);
 });
 check('Canvasの選択軸矢印も固有非直交方向を実際に使う',()=>{
  read("selectAxis('Z')");const strokes=[];let path=[];
  const ctx={scale(){},fillRect(){},beginPath(){path=[];},moveTo(x,y){path.push([x,y]);},lineTo(x,y){path.push([x,y]);},closePath(){},arc(){},fill(){},fillText(){},measureText(text){return {width:text.length*5};},stroke(){if(this.lineWidth===4&&path.length===2)strokes.push(path.map(p=>[...p]));}};
  r.scene.getBoundingClientRect=()=>({width:390,height:340});r.scene.getContext=()=>ctx;context.window.devicePixelRatio=1;read('drawScene()');assert.equal(strokes.length,1);
  const moved=json("createGeometry(current).faces.filter(f=>f.axes.includes('Z')).flatMap(f=>f.v.map(p=>transformedPoint(p,f.axes,current)))"),origin=[0,1,2].map(i=>(Math.min(...moved.map(p=>p[i]))+Math.max(...moved.map(p=>p[i])))/2),vector=json("accuracyVisualVector('Z')");
  const expected=[origin.map((v,i)=>v-vector[i]*.6),origin.map((v,i)=>v+vector[i]*.6)].map(p=>json(`levelVisualPoint(${JSON.stringify(p)},'tool')`));
  const yaw=read('yaw'),pitch=.24,project=p=>{const x=p[0]*Math.cos(yaw)+p[2]*Math.sin(yaw),z=-p[0]*Math.sin(yaw)+p[2]*Math.cos(yaw),y=(p[1]-1.65)*Math.cos(pitch)+z*Math.sin(pitch),depth=11+z*Math.cos(pitch)-(p[1]-1.65)*Math.sin(pitch);return [x/depth,-y/depth];};
  near(dot(unit(sub(strokes[0][1],strokes[0][0])),unit(sub(project(expected[1]),project(expected[0])))),1,1e-10);r.scene.getBoundingClientRect=()=>({width:0,height:0});
 });
 r.machineCondition.change('used');r.zero.click();r.exaggerate.checked=true;r.exaggerate.onchange();
 check('中古誇張表示でも全軸の方向が有限で単位長',()=>{for(const key of json('machineLinearKeys()'))near(norm(json(`accuracyVisualVector('${key}')`)),1,1e-12);assert.ok(read('levelGeometry.visualFactor')>0&&read('levelGeometry.visualFactor')<=1000);});
 check('UIは確率・ガイド残差・全最適の限界を説明',()=>{
  const html=fs.readFileSync('src/index.html','utf8');assert.match(html,/市場の実測統計ではありません/);assert.match(html,/ガイド真直度/);assert.match(html,/厳密な全球最適を保証しません/);assert.match(html,/評価長を変えてもこの判定は変わりません/);
 });
 if(failures.length){console.error(`${checks} random-accuracy checks run; ${failures.length} failed:\n`+failures.join('\n'));process.exitCode=1;}else console.log(`Random accuracy independent review: ${checks} checks passed.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});

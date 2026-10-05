'use strict';
// Independent geometric and interaction checks. These test physical invariants,
// signed examples and the renderer's actual axis path, not only DOM wiring.
const assert=require('node:assert/strict');
const {solve,orientation,geometry}=require('../src/leveling.js');
const createEnvironment=require('./leveling-dom-env.cjs');
let checks=0;const failures=[];
function check(name,fn){checks++;try{fn();}catch(error){failures.push(name+': '+error.message);}}
function near(a,b,t=1e-9){assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,`${a} != ${b}`);}
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]),norm=v=>Math.hypot(...v),unit=v=>v.map(q=>q/norm(v));
const grid=(fn)=>[-1,1].flatMap(z=>[-1,1].map(x=>({x,z,h:fn(x,z)})));
const verticalAxes=[{key:'X',vector:[1,0,0],source:'work'},{key:'Y',vector:[0,0,1],source:'work'},{key:'Z',vector:[0,1,0],source:'tool'}];
const pair=(g,key)=>{const p=g.pairs.find(p=>p.key===key);assert.ok(p,'missing '+key);return p;};
for(const slope of [{lr:0,fb:0},{lr:.4,fb:-.3},{lr:-120,fb:90}]){
 check('局所フレームは複合傾斜でも直交・単位長 '+JSON.stringify(slope),()=>{
  const f=orientation(slope);for(const a of [f.right,f.up,f.back])near(norm(a),1);
  near(dot(f.right,f.up),0);near(dot(f.right,f.back),0);near(dot(f.up,f.back),0);
  near(norm(f.rotate([2,-3,5])),Math.sqrt(38));
  near(f.up[0]/f.up[1],-slope.lr/1000);near(f.up[2]/f.up[1],-slope.fb/1000);
 });
}
for(const [a,b,c] of [[0,0,0],[.37,-.28,3],[-.2,.7,-4]]){
 check('同じ支持平面では参照位置を離しても直角保持 '+[a,b,c],()=>{
  const g=geometry(solve(grid((x,z)=>a*x+b*z+c)),{toolPoints:[{x:.8,z:.7}],workPoints:[{x:-.6,z:-.9}],axes:verticalAxes,length:.5});
  for(const p of g.pairs){near(p.errorMicrons,0);near(p.angleDegrees,90);}near(g.relativeLean.front,0);near(g.relativeLean.right,0);
 });
}
const saddle=solve(grid((x,z)=>.2*x*z));
check('四点ねじれは前後位置差から XZ 角度を作る',()=>{
 const g=geometry(saddle,{toolPoints:[{x:0,z:.8}],workPoints:[{x:0,z:-.6}],axes:verticalAxes,length:.5});
 const angle=Math.atan(.16/1000)-Math.atan(-.12/1000);
 near(pair(g,'XZ').deviationMicroradians,angle*1e6);near(pair(g,'XZ').errorMicrons,angle*5e5);near(pair(g,'YZ').errorMicrons,0);
});
check('四点ねじれは左右位置差から YZ 角度を作る',()=>{
 const g=geometry(saddle,{toolPoints:[{x:.7,z:0}],workPoints:[{x:-.4,z:0}],axes:verticalAxes,length:1.2});
 const angle=Math.atan(.14/1000)-Math.atan(-.08/1000);
 near(pair(g,'YZ').deviationMicroradians,angle*1e6);near(pair(g,'YZ').errorMicrons,angle*1.2e6);near(pair(g,'XZ').errorMicrons,0);
});
check('支持の一様上昇・評価長変更は姿勢角を変えない',()=>{
 const options={toolPoints:[{x:.7,z:.8}],workPoints:[{x:-.4,z:-.6}],axes:verticalAxes,length:.5};
 const a=geometry(saddle,options),b=geometry(solve(grid((x,z)=>.2*x*z+200)),{...options,length:1});
 a.pairs.forEach((p,i)=>{near(p.deviationMicroradians,b.pairs[i].deviationMicroradians);near(p.errorMicrons*2,b.pairs[i].errorMicrons);});
});
check('左右コラムの平均が水平でも反対の前後倒れを保持',()=>{
 const g=geometry(saddle,{toolPoints:[{x:-1,z:0},{x:1,z:0}],workPoints:[{x:0,z:0}],axes:verticalAxes,length:.5});
 near(g.toolLean.front,0);assert.ok(g.columns[0].front<0&&g.columns[1].front>0);near(g.columns[1].front-g.columns[0].front,2*Math.atan(.2/1000)*1e6);
});
for(const options of [{length:0},{length:-1},{length:NaN}])check('不正な評価長を拒否 '+options.length,()=>assert.throws(()=>geometry(saddle,{toolPoints:[{x:0,z:0}],workPoints:[{x:0,z:0}],axes:verticalAxes,...options})));

async function main(){
 const env=createEnvironment({pureLeveling:true}),{registry:r,read,json,storage}=env;
 const open=(index,mode)=>{storage.clear();read(`openMachine(machines[${index}])`);if(mode)r.machineMode.change(mode);};
 const preset=t=>read(`applyLevelPreset('${t}')`);
 const axis=(key,value)=>{const input=r['axis-'+key];input.value=String(value);input.events.input({target:input});};
 const layout=(key,value)=>{r[key].value=String(value);r[key].oninput({target:r[key]});};
 const current=()=>json('levelGeometry');
 function poseDirection(vector,pose){
  const anchor=json(`levelGeometry.poses.${pose}.anchor`),p=[anchor.x,.66,anchor.z];
  return sub(json(`levelVisualPoint(${JSON.stringify(p.map((v,i)=>v+vector[i]))},'${pose}')`),json(`levelVisualPoint(${JSON.stringify(p)},'${pose}')`));
 }
 for(const [index,mode] of [[0,'compact'],[1,''],[2,''],[3,'l3-3000'],[4,''],[5,''],[6,'']]){
  open(index,mode);
  read('supportHeights=supports.map(s=>{const p=levelCoordinates(s.x,s.z);return .027*p.x-.019*p.z+.05;});updateLeveling(false);');
  check('構造別・複合平面の直角保持 '+index+' '+mode,()=>{for(const p of current().pairs){near(p.errorMicrons,0);near(p.angleDegrees,90);}});
  check('構造別・床基準の倒れを相対角から分離 '+index+' '+mode,()=>{assert.ok(current().toolLean.front<0);assert.ok(current().toolLean.right<0);near(current().relativeLean.front,0);near(current().relativeLean.right,0);});
  r.exaggerate.checked=false;r.exaggerate.onchange();
  check('構造別・共通傾斜の描画も剛体直角 '+index+' '+mode,()=>{
   const directions=current().axes.map(a=>({...a,direction:poseDirection(a.vector,a.source)}));
   for(let i=0;i<directions.length;i++)for(let j=i+1;j<directions.length;j++)near(dot(unit(directions[i].direction),unit(directions[j].direction)),0,1e-12);
  });
 }
 open(0,'compact');preset('twist');
 check('小型四点ねじれの中央は YZ=0、XZ は変化',()=>{near(pair(current(),'YZ').errorMicrons,0);assert.ok(pair(current(),'XZ').errorMicrons>40);assert.equal(read('supports.length'),4);});
 axis('X',100);const yzRight=pair(current(),'YZ').errorMicrons;
 axis('X',-100);const yzLeft=pair(current(),'YZ').errorMicrons;
 check('小型四点ねじれの X 移動で YZ が反転',()=>{assert.ok(yzRight< -10&&yzLeft>10);near(yzRight,-yzLeft);});
 axis('X',0);layout('columnX',100);const movedColumn=current();
 check('コラム左右配置で YZ と床基準前倒れが変化',()=>{assert.ok(pair(movedColumn,'YZ').errorMicrons>20);assert.ok(movedColumn.toolLean.front>40);assert.match(r.columnLean.textContent,/前倒れ/);});
 layout('columnX',0);const xzBefore=pair(current(),'XZ').errorMicrons;layout('columnZ',100);
 check('コラム前後配置で XZ が変化',()=>assert.ok(pair(current(),'XZ').errorMicrons>xzBefore+10));
 r.resetColumn.click();check('配置リセットで初期の幾何状態へ戻る',()=>{near(read('levelConfig.columnX'),0);near(read('levelConfig.columnZ'),0);near(pair(current(),'YZ').errorMicrons,0);near(pair(current(),'XZ').errorMicrons,xzBefore);});
 r.demoTwist.click();
 check('ねじれデモは YZ が出る位置へ移動し表示が同期',()=>{assert.ok(Math.abs(pair(current(),'YZ').errorMicrons)>10);assert.notEqual(read('positions.X'),0);assert.equal(Number(r['axis-X'].value),read('positions.X'));});
 const sampleValues=json("accuracyRange.map(s=>s.geometry.pairs.find(p=>p.key==='YZ').errorMicrons)");
 check('端中央の比較は現在位置とは独立の代表値',()=>{
  const low=Math.min(...sampleValues),high=Math.max(...sampleValues),before=json('accuracyRange.map(s=>s.state)');axis('X',37);
  assert.deepEqual(json('accuracyRange.map(s=>s.state)'),before);assert.equal(json('geometrySamples()').length,27);
  const yzBox=r.accuracyMetrics.children.find(box=>box.children[0].textContent==='YZ 直角度');
  const rangeText=yzBox.querySelectorAll('small').find(el=>el.textContent.startsWith('端・中央の比較'));
  assert.ok(rangeText,'代表位置の比較値が表示されている');
  assert.match(rangeText.textContent,new RegExp(low.toFixed(2).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(rangeText.textContent,new RegExp(high.toFixed(2).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  near(Number.parseFloat(yzBox.children[1].textContent),pair(current(),'YZ').errorMicrons,.0051);
 });
 open(2);preset('twist');axis('X',-100);const travelLeft=pair(current(),'XZ').errorMicrons,travelLean=current().toolLean.front;axis('X',100);
 // For h=k*x*z, the local front/back slope changes with X. The X guide
 // tangent and the column's Z direction nevertheless belong to the same
 // orthonormal carriage frame in this rigid-carriage teaching model: a
 // common rotation changes posture, never their internal right angle.
 check('移動コラムは X 移動で姿勢が変わっても同一剛体の XZ を保持',()=>{near(travelLeft,0);near(pair(current(),'XZ').errorMicrons,0);assert.notEqual(current().toolLean.front,travelLean);near(current().toolPoints[0].x,.5);});
 open(1);preset('twist');axis('X',-100);const horizontalLeft=pair(current(),'YZ').errorMicrons;axis('X',100);
 check('横形は Y が上下、Z が前後の対応で直角度を表示',()=>{assert.ok(horizontalLeft*pair(current(),'YZ').errorMicrons<0);near(pair(current(),'XY').errorMicrons,0);assert.deepEqual(current().axes.find(a=>a.key==='Y').vector,[0,1,0]);});
 for(const [index,mode] of [[3,'l3-3000'],[4,'']]){
  open(index,mode);preset('twist');
  check('門形の左右逆向き倒れを保持 '+index+' '+mode,()=>{const g=current();assert.equal(g.columns.length,2);assert.ok(g.columns[0].front<0&&g.columns[1].front>0);assert.ok(!r.columnDifference.hidden);assert.match(r.columnDifference.textContent,/左右の前後倒れ差/);});
  if(mode!=='cross')check('門形の診断は平均の相殺を同じ姿勢と断定しない '+index,()=>{assert.doesNotMatch(r.accuracyDiagnosis.textContent,/工具側と案内側が同じ姿勢です/);assert.match(r.accuracyDiagnosis.textContent,/左右|コラム|門/);});
  r.demoTwist.click();
  if(current().pairs.every(p=>Math.abs(p.errorMicrons)<1e-8))check('門のねじれデモは直角差が出たと断定しない '+index,()=>{assert.doesNotMatch(r.levelInputMessage.textContent,/直角度の差が出る/);assert.match(r.levelInputMessage.textContent,/左右|コラム|門|姿勢/);});
 }
 open(3,'l3-3000');r.supportWidth.change('5');r.supportDepth.change('1.3');
 read('supportHeights=supports.map(s=>Math.round(.2*(s.x/(current.w*.4))*(s.z/(current.d*.4))*100)/100);levelExercise={solved:false};updateLeveling(false);');
 check('門の調整目標は平均の相殺で左右の倒れ差を見落とさない',()=>{const g=current();assert.ok(Math.abs(g.columns[1].front-g.columns[0].front)>20);assert.equal(read('levelExercise.solved'),false);assert.doesNotMatch(r.diagnosis.textContent,/教材の調整目標内/);});
 open(6);preset('twist');
 check('旋盤は主軸基準 XZ と NC 送り Z を区別し Y 軸を表示しない',()=>{assert.deepEqual(current().pairs.map(p=>p.key),['XZ']);assert.deepEqual(current().axes.map(p=>p.key),['X','Z']);assert.match(r.accuracyMetrics.textContent,/主軸基準XZ.*送りZとは別/);assert.match(r.geometryAssumption.textContent,/NC送りX–Zの案内直角度ではありません/);assert.match(r.geometryAssumption.textContent,/Y軸はありません/);assert.equal(r.columnLayout.hidden,true);});
 open(5);check('三点支持のねじれデモを無効化',()=>assert.equal(r.demoTwist.disabled,true));
 r.demoColumn.click();check('三点支持のコラム倒れデモも相対直角は保持',()=>{assert.ok(Math.abs(current().toolLean.front)>1);for(const p of current().pairs)near(p.errorMicrons,0);});

 open(0,'compact');r.demoColumn.click();r.exaggerate.checked=false;r.exaggerate.onchange();
 check('前倒れの描画符号は床基準角度と一致',()=>{const up=unit(poseDirection([0,1,0],'tool'));assert.ok(up[2]<0);near(Math.atan2(-up[2],up[1])*1e6,current().toolLean.front);});
 check('左右倒れの描画符号は床基準角度と一致',()=>{const up=unit(poseDirection([0,1,0],'tool'));near(Math.atan2(up[0],up[1])*1e6,current().toolLean.right);});
 check('現在位置の直角度と誇張なし 3D の軸間角度が一致',()=>{
  const directions=current().axes.map(a=>({...a,direction:unit(poseDirection(a.vector,a.source))}));
  for(let i=0;i<directions.length;i++)for(let j=i+1;j<directions.length;j++){
   const radians=Math.acos(Math.max(-1,Math.min(1,dot(directions[i].direction,directions[j].direction))))-Math.PI/2;
   near(radians*1e6,pair(current(),directions[i].key+directions[j].key).deviationMicroradians,1e-7);
  }
 });
 const savedAngles=current().pairs.map(p=>p.errorMicrons);r.exaggerate.checked=true;r.exaggerate.onchange();
 check('誇張切替は計算精度を変えない',()=>assert.deepEqual(current().pairs.map(p=>p.errorMicrons),savedAngles));
 check('選択軸矢印が支持面ではなく該当部品の姿勢に一致',()=>{
  read("selectAxis('Z')");
  const strokes=[];let path=[];
  const ctx={scale(){},fillRect(){},beginPath(){path=[];},moveTo(x,y){path.push([x,y]);},lineTo(x,y){path.push([x,y]);},closePath(){},arc(){},fill(){},fillText(){},measureText(text){return {width:text.length*5};},stroke(){if(this.lineWidth===4&&path.length===2)strokes.push(path.map(p=>[...p]));}};
  r.scene.getBoundingClientRect=()=>({width:460,height:320});r.scene.getContext=()=>ctx;env.context.window.devicePixelRatio=1;read('drawScene()');
  assert.equal(strokes.length,1);
  const moved=json("createGeometry(current).faces.filter(f=>f.axes.includes('Z')).flatMap(f=>f.v.map(p=>levelVisualPoint(transformedPoint(p,f.axes,current),f.pose)))"),center=[0,1,2].map(i=>(Math.min(...moved.map(p=>p[i]))+Math.max(...moved.map(p=>p[i])))/2),direction=poseDirection([0,1,0],'tool');
  const expected=[-1,1].map(sign=>center.map((v,i)=>v+sign*direction[i]*.6));
  const yaw=read('yaw'),pitch=.24;
  const project=p=>{const x=p[0]*Math.cos(yaw)+p[2]*Math.sin(yaw),z=-p[0]*Math.sin(yaw)+p[2]*Math.cos(yaw),y=(p[1]-1.65)*Math.cos(pitch)+z*Math.sin(pitch),depth=11+z*Math.cos(pitch)-(p[1]-1.65)*Math.sin(pitch);return [x/11,-y/11];};
  const actualDirection=unit(sub(strokes[0][1],strokes[0][0])),expectedDirection=unit(sub(project(expected[1]),project(expected[0])));
  near(dot(actualDirection,expectedDirection),1,1e-10);
  r.scene.getBoundingClientRect=()=>({width:0,height:0});
 });

 // Pure support records remain on an unchanged grid; v3 layouts require intrinsic profiles.
 open(2);preset('twist');layout('columnX',-63);layout('columnZ',47);axis('X',37);axis('Y',-29);axis('Z',61);const record=json('levelRecord()'),beforeRestore=current().pairs.map(p=>p.errorMicrons);
 read('openMachine(machines[1]);openMachine(machines[2]);');
 check('配置と支持高さは機械方式ごとに保存・復元',()=>{assert.deepEqual(json('levelRecord()'),record);assert.match(r.levelSaveStatus.textContent,/復元/);assert.equal(Number(r.columnX.value),-63);assert.equal(Number(r.columnZ.value),47);});
 check('軸位置と現在の直角度も保存復元で再現',()=>{assert.deepEqual(json('levelRecord().axisPositions'),{X:37,Y:-29,Z:61});assert.deepEqual(current().pairs.map(p=>p.errorMicrons),beforeRestore);for(const key of ['X','Y','Z'])assert.equal(Number(r['axis-'+key].value),record.axisPositions[key]);});
 const legacy=structuredClone(record);delete legacy.columnX;delete legacy.columnZ;delete legacy.axisPositions;
 async function importRecord(value){r.importLevel.files=[{size:100,text:async()=>JSON.stringify(value)}];await r.importLevel.onchange({target:r.importLevel});}
 await importRecord(legacy);
 check('旧 JSON は標準コラム位置と中央の軸位置で読める',()=>{assert.match(r.levelInputMessage.textContent,/読み込みました/);near(read('levelConfig.columnX'),0);near(read('levelConfig.columnZ'),0);assert.deepEqual(json('supportHeights'),legacy.heights);assert.deepEqual(json('levelRecord().axisPositions'),{X:0,Y:0,Z:0});});
 const valid=json('levelRecord()');
 for(const value of [null,'50',100.1,101,NaN]){
  const bad={...valid,columnX:value};await importRecord(bad);
  check('不正なコラム配置 JSON を拒否 '+JSON.stringify(value),()=>{assert.deepEqual(json('levelRecord()'),valid);assert.match(r.levelInputMessage.textContent,/読込できません/);});
 }
 for(const value of [null,[],{X:0,Y:0},{X:0,Y:0,Z:101},{X:0,Y:0,Z:0,A:0},{X:'0',Y:0,Z:0}]){
  await importRecord({...valid,axisPositions:value});
  check('不正な軸位置 JSON を拒否 '+JSON.stringify(value),()=>{assert.deepEqual(json('levelRecord()'),valid);assert.match(r.levelInputMessage.textContent,/読込できません/);});
 }
 r.exportLevel.click();check('JSON ダウンロード名は機械と方式を識別',()=>{assert.equal(env.downloads.length,1);assert.match(env.downloads[0].download,/leveling-travel-standard\.json/);});
 const exported=JSON.parse(await env.context.exportedBlob.text());check('エクスポート内容は現在の記録と一致',()=>assert.deepEqual(exported,valid));
 const animation=[];env.context.requestAnimationFrame=f=>{animation.push(f);return animation.length;};
 read("selectAxis('X')");r.playAxis.click();animation.shift()(1000);animation.shift()(1750);const animated=read('positions.X');r.playAxis.click();
 check('動作デモを止めた位置も保存',()=>{assert.ok(animated>20);near(JSON.parse(storage.get(read('levelKey()'))).axisPositions.X,animated);});
 r.playAxis.click();animation.length=0;
 await importRecord({...valid,axisPositions:{X:12,Y:-23,Z:45}});
 check('JSON 読込で旧動作デモを停止し読込位置を保持',()=>{assert.equal(read('motionFrame'),null);assert.deepEqual(json('levelRecord().axisPositions'),{X:12,Y:-23,Z:45});assert.equal(r.playAxis.textContent,'選んだ軸を動かす');});
 r.resetAxes.click();check('軸リセットは中央の値を保存',()=>assert.deepEqual(JSON.parse(storage.get(read('levelKey()'))).axisPositions,{X:0,Y:0,Z:0}));
 if(failures.length){console.error(`${checks} independent accuracy checks run; ${failures.length} failed:\n`+failures.join('\n'));process.exitCode=1;}else console.log(`Accuracy review: ${checks} independent checks passed.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});

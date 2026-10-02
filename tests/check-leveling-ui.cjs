'use strict';
const assert=require('node:assert/strict');
const createEnvironment=require('./leveling-dom-env.cjs');
let checks=0;const failures=[];
function check(name,fn){checks++;try{fn();}catch(error){failures.push(name+': '+error.message);}}
function near(a,b,tolerance=1e-9){assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);}
async function main(){
 const env=createEnvironment(),{registry:r,read,json,storage,context}=env;
 const open=i=>read(`openMachine(machines[${i}])`),preset=t=>context.document.querySelectorAll('[data-preset]').find(b=>b.dataset.preset===t).click();
 const counts=[4,4,6,6,8,3,6];
 for(let i=0;i<7;i++){
  storage.clear();open(i);
  check(`機種${i}:支持点数`,()=>assert.equal(read('supports.length'),counts[i]));
  check(`機種${i}:初期水平`,()=>{near(read('levelSolution.lr'),0);near(read('levelSolution.fb'),0);assert.equal(r.localLevel.textContent,'0.000 mm/m');});
  check(`機種${i}:支持面は全支持点を表示`,()=>{const mesh=json('levelSurfaceFaces(current)'),points=json('supports');assert.ok(mesh.length>0);for(const p of points)assert.ok(mesh.some(f=>f.v.some(v=>Math.abs(v[0]-p.x)<1e-10&&Math.abs(v[2]-p.z)<1e-10)));});
  r.up0.click();check(`機種${i}:高さ＋連動`,()=>{near(read('supportHeights[0]'),.01);assert.equal(r.height0.value,'0.01');assert.ok(read('levelSolution.heightAt(...[levelCoordinates(supports[0].x,supports[0].z).x,levelCoordinates(supports[0].x,supports[0].z).z])')>.009);});
  r.down0.click();check(`機種${i}:高さ−連動`,()=>near(read('supportHeights[0]'),0));
  check(`機種${i}:中間支持の可否`,()=>assert.equal(r.middlePreset.disabled,counts[i]<=4));
  check(`機種${i}:3点ねじれ無効`,()=>assert.equal(r.twistPreset.disabled,counts[i]===3));
  preset('right');check(`機種${i}:右高符号`,()=>{assert.ok(read('levelSolution.lr')>0);near(read('levelSolution.fb'),0);assert.ok(parseFloat(r.bubble.style.left)>50);assert.match(r.bubbleText.textContent,/右側/);});
  preset('front');check(`機種${i}:手前高符号`,()=>{assert.ok(read('levelSolution.fb')<0);near(read('levelSolution.lr'),0);assert.ok(parseFloat(r.bubbleFB.style.left)<50);assert.match(r.bubbleTextFB.textContent,/手前/);});
  if(counts[i]>3){preset('twist');r.measurePos.change('-1');const front=parseFloat(r.localLevel.textContent);r.measurePos.change('1');check(`機種${i}:位置切替ねじれ`,()=>{assert.ok(front<0);assert.ok(parseFloat(r.localLevel.textContent)>0);assert.ok(read('levelSolution.residual')>.09);});}
  else{const before=json('supportHeights');preset('twist');check(`機種${i}:無効プリセット無変更`,()=>assert.deepEqual(json('supportHeights'),before));}
  if(counts[i]>4){preset('middle');check(`機種${i}:全方向の中間支持反映`,()=>{assert.ok(read('supportHeights.some(h=>h===.15)'));assert.ok(read('levelSolution.residual')>.04);assert.ok(!r.diagnosis.textContent.includes('目標内'));assert.ok(read('levelSurfaceFaces(current).some(f=>f.height>.1)'));});}
  r.zero.click();check(`機種${i}:リセット`,()=>{assert.ok(read('supportHeights.every(h=>h===0)'));near(read('levelSolution.residual'),0);near(read('levelSolution.twist'),0);assert.ok(r.diagnosis.textContent.includes('目標内'));});
 }
 // 機械を選び直しても自動保存した高さと寸法が復元する。
 storage.clear();open(0);r.up0.click();r.supportWidth.change('5');const saved=json('levelRecord()');open(1);open(0);
 check('機械別自動保存復元',()=>{assert.deepEqual(json('levelRecord()'),saved);assert.match(r.levelSaveStatus.textContent,/復元/);});
 for(const [machine,mode,kind,count] of [[0,'compact','compact',4],[3,'cross','portal',4],[3,'long','double',6]]){
  open(machine);r.machineMode.change(mode);check(`方式${mode}:機構・支持点更新`,()=>{assert.equal(read('current.kind'),kind);assert.equal(read('supports.length'),count);assert.ok(Number.isFinite(read('levelSolution.lr')));});
 }
 storage.clear();open(0);
 r.adjustStep.change('0.1');r.up0.click();check('調整量切替',()=>near(read('supportHeights[0]'),.1));
 for(let n=0;n<8;n++)r.up0.click();check('＋上限制限',()=>{near(read('supportHeights[0]'),.5);assert.equal(r.up0.disabled,true);});
 for(let n=0;n<12;n++)r.down0.click();check('−下限制限',()=>{near(read('supportHeights[0]'),-.5);assert.equal(r.down0.disabled,true);});
 r.height0.change('.23');check('高さ数値入力',()=>{near(read('supportHeights[0]'),.23);assert.equal(r.height0.value,'0.23');});
 for(const value of ['', 'not-a-number','-0.51','0.51']){r.height0.change(value);check('無効高さ拒否 '+JSON.stringify(value),()=>{near(read('supportHeights[0]'),.23);assert.equal(r.height0.value,'0.23');assert.match(r.levelInputMessage.textContent,/−0.50/);});}
 const typeHeight=(i,value)=>{const input=r['height'+i];input.value=value;input.oninput({target:input});};
 const synchronized=()=>{const heights=json('supportHeights');heights.forEach((h,i)=>near(Number(r['height'+i].value),h));};
 const activeField=r.height0;typeHeight(0,'.5');check('inputイベントで上限と計算を即更新',()=>{near(read('supportHeights[0]'),.5);assert.equal(r.height0.value,'.5');assert.equal(r.up0.disabled,true);assert.equal(r.height0,activeField);assert.ok(read('levelSolution.residual')>.1);synchronized();});
 const beforeBlank=json('[levelSolution.lr,levelSolution.fb,levelSolution.twist,levelSolution.residual]');typeHeight(0,'');
 check('入力中の空欄は計算を維持',()=>{assert.equal(r.height0.value,'');near(read('supportHeights[0]'),.5);assert.deepEqual(json('[levelSolution.lr,levelSolution.fb,levelSolution.twist,levelSolution.residual]'),beforeBlank);});
 r.height0.change();check('空欄確定は拒否して最後の有効値を復元',()=>{assert.equal(r.height0.value,'0.50');near(read('supportHeights[0]'),.5);assert.match(r.levelInputMessage.textContent,/−0.50/);});
 typeHeight(0,'.004');check('入力途中は表記を保ち計算だけ丸める',()=>{near(read('supportHeights[0]'),0);assert.equal(r.height0.value,'.004');assert.equal(r.up0.disabled,false);near(read('levelSolution.residual'),0);});
 r.height0.change();check('確定時に二桁表示へ揃える',()=>assert.equal(r.height0.value,'0.00'));
 for(const value of ['0','0.1','0.12','0.123']){typeHeight(0,value);check('連続入力を途中で書き換えない '+value,()=>{assert.equal(r.height0.value,value);assert.equal(r.height0,activeField);near(read('supportHeights[0]'),Math.round(Number(value)*100)/100);});}
 typeHeight(0,'.6');check('入力中の範囲外は計算値を維持',()=>{assert.equal(r.height0.value,'.6');near(read('supportHeights[0]'),.12);});r.height0.change();
 check('範囲外確定は有効値の二桁表記を復元',()=>assert.equal(r.height0.value,'0.12'));
 typeHeight(0,'.333');preset('right');check('プリセットは編集中の欄も全同期',synchronized);
 typeHeight(0,'.333');r.zero.click();check('リセットは編集中の欄も全同期',()=>{synchronized();assert.equal(r.height0.value,'0.00');});
 const map=r.supportMap.querySelectorAll('.map-point');map[0].click();check('支持点選択対応',()=>{assert.equal(read('selected'),Number(map[0].dataset.support));assert.equal(r.supportMap.querySelectorAll('.map-point').filter(b=>b.getAttribute('aria-pressed')==='true').length,1);});
 r.zero.click();preset('right');const lr=read('levelSolution.lr'),width=read('levelConfig.width');r.supportWidth.change(String(width*2));
 check('支持幅2倍で傾き半分',()=>near(read('levelSolution.lr'),lr/2));
 const slope=read('levelSolution.lr');r.levelSensitivity.change('0.1');const bubble10=parseFloat(r.bubble.style.left);r.levelSensitivity.change('0.05');
 check('感度は計算値を変えず気泡目盛を変える',()=>{near(read('levelSolution.lr'),slope);near(parseFloat(r.bubble.style.left)-50,(bubble10-50)*2);});
 preset('front');const fb=read('levelSolution.fb'),depth=read('levelConfig.depth');r.supportDepth.change(String(depth*2));check('前後幅2倍で傾き半分',()=>near(read('levelSolution.fb'),fb/2));
 for(const value of ['', '0.49','20.01']){const old=read('levelConfig.width');r.supportWidth.change(value);check('無効寸法拒否 '+JSON.stringify(value),()=>near(read('levelConfig.width'),old));}
 const typeNumber=(id,value)=>{r[id].value=value;r[id].oninput({target:r[id]});};
 for(const [id,key,pattern,slopeKey] of [['supportWidth','width','right','lr'],['supportDepth','depth','front','fb']]){
  preset(pattern);const oldDimension=read('levelConfig.'+key),oldSlope=read('levelSolution.'+slopeKey);typeNumber(id,'6.00');
  check(id+'は入力中から傾きを再計算',()=>{near(read('levelConfig.'+key),6);near(read('levelSolution.'+slopeKey),oldSlope*oldDimension/6);assert.equal(r[id].value,'6.00');});
  for(const value of ['', '0.4','20.1','not-a-number']){
   const previousSlope=read('levelSolution.'+slopeKey);typeNumber(id,value);
   check(id+'の入力中無効値は有効状態を維持 '+JSON.stringify(value),()=>{near(read('levelConfig.'+key),6);near(read('levelSolution.'+slopeKey),previousSlope);assert.equal(read('levelRecord().'+key),6);assert.equal(read('Boolean(validLevelRecord(levelRecord()))'),true);});
   r.height0.value='.21';r.height0.oninput({target:r.height0});
   check(id+'入力未確定のまま高さ変更しても保存値は有効 '+JSON.stringify(value),()=>{assert.equal(read('levelRecord().'+key),6);assert.equal(read('Boolean(validLevelRecord(levelRecord()))'),true);});
   r[id].change();check(id+'無効値確定時に直前寸法を復元 '+JSON.stringify(value),()=>assert.equal(r[id].value,'6'));
  }
 }
 preset('right');const impact=Number.parseFloat(r.tiltExample.textContent);r.impactOffset.change('1');check('腕の長さと幾何例',()=>near(Number.parseFloat(r.tiltExample.textContent),impact*2,.11));
 const offsetExample=parseFloat(r.tiltExample.textContent);typeNumber('impactOffset','1.50');
 check('腕の長さは入力中から幾何例を更新',()=>{near(read('levelConfig.offset'),1.5);near(parseFloat(r.tiltExample.textContent),offsetExample*1.5,.11);assert.equal(r.impactOffset.value,'1.50');});
 for(const value of ['', '0.09','2.01','not-a-number']){
  const previousExample=r.tiltExample.textContent;typeNumber('impactOffset',value);
  check('腕の未確定無効値は計算・保存値を維持 '+JSON.stringify(value),()=>{assert.equal(r.tiltExample.textContent,previousExample);near(read('levelRecord().offset'),1.5);assert.equal(read('Boolean(validLevelRecord(levelRecord()))'),true);});
  r.height0.value='.23';r.height0.oninput({target:r.height0});
  check('腕の欄が無効でも高さ調整の結果は有限 '+JSON.stringify(value),()=>{assert.ok(Number.isFinite(parseFloat(r.tiltExample.textContent)));near(read('levelRecord().offset'),1.5);});
  r.impactOffset.change();check('腕の無効入力確定は0.5でなく直前値に戻る '+JSON.stringify(value),()=>{assert.equal(r.impactOffset.value,'1.5');near(read('levelConfig.offset'),1.5);});
 }
 preset('right');
 const metrics=json('[levelSolution.lr,levelSolution.fb,levelSolution.twist,levelSolution.residual]'),raised=json('levelVisualPoint([current.w*.4,1,0])');r.exaggerate.checked=false;r.exaggerate.onchange();
 check('誇張は数値計算を変えない',()=>{assert.deepEqual(json('[levelSolution.lr,levelSolution.fb,levelSolution.twist,levelSolution.residual]'),metrics);near((raised[1]-1)/(json('levelVisualPoint([current.w*.4,1,0])')[1]-1),100,1e-7);});
 r.showLevelSurface.checked=false;r.showLevelSurface.onchange();check('支持面の表示切替は計算値を変えない',()=>{assert.equal(read('levelSurfaceFaces(current).length'),0);assert.deepEqual(json('[levelSolution.lr,levelSolution.fb,levelSolution.twist,levelSolution.residual]'),metrics);});r.showLevelSurface.checked=true;r.showLevelSurface.onchange();
 r.startLevelExercise.click();check('調整問題は目標外から開始',()=>assert.equal(read('levelExercise.solved'),false));
 for(let i=0;i<counts[0];i++)r['height'+i].change('0');check('手動調整で練習達成',()=>{assert.equal(read('levelExercise.solved'),true);assert.match(r.levelExerciseStatus.textContent,/達成/);});
 storage.clear();open(5);r.supportWidth.change('20');r.supportDepth.change('20');read('Math.random=()=>.5');r.startLevelExercise.click();
 check('3点・最大寸法でも問題は目標外',()=>assert.equal(read('levelExercise.solved'),false));
 storage.clear();open(0);r.height0.change('0.2');const original=json('levelRecord()');
 const mutations=[r=>r.version=2,r=>r.machine='lathe',r=>r.mode='compact',r=>r.width='2',r=>r.depth=.49,r=>r.width=20.01,r=>r.heights.pop(),r=>r.heights[0]=.51,r=>r.heights[0]=null,r=>r.sensitivity=.03,r=>r.measurePos=.5,r=>r.offset=2.01,r=>r.step=.03,r=>r.exaggerate='false'];
 async function importData(data,size=100){r.importLevel.files=[{size,text:async()=>typeof data==='string'?data:JSON.stringify(data)}];await r.importLevel.onchange({target:r.importLevel});}
 for(let i=0;i<mutations.length;i++){const invalid=structuredClone(original);mutations[i](invalid);await importData(invalid);check('無効JSON拒否 '+i,()=>{assert.deepEqual(json('levelRecord()'),original);assert.match(r.levelInputMessage.textContent,/読込できません/);});}
 await importData('{broken');check('不正JSON拒否',()=>assert.deepEqual(json('levelRecord()'),original));
 await importData(original,250001);check('大きすぎるJSON拒否',()=>assert.deepEqual(json('levelRecord()'),original));
 const precise=structuredClone(original);precise.heights[0]=.123;await importData(precise);
 check('JSON値と表示値の桁が矛盾しない',()=>near(read('supportHeights[0]'),Number(r.height0.value)));
 const valid=structuredClone(original);valid.width=4;valid.depth=5;valid.heights=[.1,-.1,.2,-.2];valid.sensitivity=.1;valid.measurePos=-1;valid.offset=1.5;valid.step=.05;valid.exaggerate=false;
 typeHeight(0,'.333');await importData(valid);check('有効JSONのみ反映して編集中の欄も全同期',()=>{assert.deepEqual(json('levelRecord()'),valid);assert.match(r.levelInputMessage.textContent,/読み込みました/);synchronized();assert.equal(r.height0.value,'0.10');});
 r.exportLevel.click();check('JSONダウンロード開始',()=>{assert.equal(env.downloads.length,1);assert.match(env.downloads[0].download,/leveling-vertical-standard\.json/);});
 const exported=JSON.parse(await context.exportedBlob.text());check('エクスポート内容一致',()=>assert.deepEqual(exported,valid));
 env.timers.forEach(fn=>fn());check('エクスポートURL解放',()=>assert.equal(context.revokedUrl,'blob:test'));
 const oldSetter=context.localStorage.setItem;context.localStorage.setItem=()=>{throw new Error('Storage denied');};r.up0.click();
 check('保存不可でも操作継続',()=>{assert.match(r.levelSaveStatus.textContent,/自動保存できません/);assert.ok(Number.isFinite(read('levelSolution.lr')));});context.localStorage.setItem=oldSetter;
 storage.set(read('levelKey()'),'{bad JSON');open(0);check('壊れた自動保存を安全に無視',()=>assert.ok(read('supportHeights.every(h=>h===0)')));
 if(failures.length){console.error(`${checks} checks run; ${failures.length} failed:\n`+failures.join('\n'));process.exitCode=1;}else console.log(`Leveling UI: ${checks} checks passed (7 machines, 2 extra modes, controls, exercise, save/import/export).`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});

'use strict';
// Independent audit of visible support heights, rigid assemblies, and the
// mechanically irrelevant common support-height offset. These checks cover
// all structures and do not assume that a randomly generated machine is sound.
const assert=require('node:assert/strict');
const makeEnvironment=require('./leveling-dom-env.cjs');
const MachineAccuracy=require('../src/machine-accuracy.js');
const Leveling=require('../src/leveling.js');
let checks=0;
const failures=[];
function check(name,fn){checks++;try{fn();}catch(error){failures.push(name+': '+error.message);}}
function near(a,b,tolerance=1e-8){assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance,`${a} != ${b}`);}
const dot=(a,b)=>a.reduce((s,q,i)=>s+q*b[i],0);
const magnitude=a=>Math.hypot(...a);
const difference=(a,b)=>a.map((q,i)=>q-b[i]);
const variants=[[0,'compact'],[1,''],[2,''],[3,'l3-3000'],[4,''],[5,''],[6,'']];
function open(env,index,mode){env.read(`openMachine(machines[${index}])`);if(mode)env.registry.machineMode.change(mode);}
function setProfile(env,condition,seed){
 const profile=MachineAccuracy.generate(condition,seed,env.json('machineLinearKeys()'),env.read('supports.length'));
 env.read(`initializeMachineAccuracy(${JSON.stringify(profile)});supportHeights=[...machineProfile.initialHeights];updateLeveling();`);
 return profile;
}
const pure=makeEnvironment({pureLeveling:true});
for(const [index,mode] of variants){
 open(pure,index,mode);
 const label=`${index}/${mode}`;
 const count=pure.read('supports.length');
 const heights=Array.from({length:count},(_,i)=>[.2,.3,.2,-.3,.111,-.237,.407,-.101][i%8]);
 for(const [width,depth] of [[.5,.5],[20,20],[.5,20],[20,.5]]){
  pure.read(`levelConfig.width=${width};levelConfig.depth=${depth};supportHeights=${JSON.stringify(heights)};updateLeveling();`);
  for(const exaggerated of [false,true]){
   pure.registry.exaggerate.checked=exaggerated;pure.registry.exaggerate.onchange();
   const factor=exaggerated?pure.read('levelGeometry.visualFactor'):1;
   const rendered=pure.json('supports.map(s=>levelVisualPoint([s.x,.66,s.z]))');
   check(`支持面は仮想寸法でも入力高さ差を保つ ${label} ${width}x${depth} ${exaggerated}`,()=>{
    rendered.forEach((p,i)=>near(p[1]-rendered[0][1],(heights[i]-heights[0])*factor/1000,1e-8));
   });
   check(`仮想寸法変更後も工具・案内の局所変換は剛体 ${label} ${width}x${depth} ${exaggerated}`,()=>{
    for(const pose of ['tool','work']){
     const points=pure.json(`[[0,.66,0],[1,.66,0],[0,1.66,0],[0,.66,1]].map(p=>levelVisualPoint(p,'${pose}'))`);
     const vectors=points.slice(1).map(p=>difference(p,points[0]));
     const expectedLengths=[width/pure.read("current.w*.8"),1,depth/pure.read("current.d*.8")];vectors.forEach((v,i)=>near(magnitude(v),expectedLengths[i],1e-12));
     for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)near(dot(vectors[i],vectors[j]),0,1e-12);
    }
   });
  }
 }
}

const live=makeEnvironment();
live.read('Math.random=()=>.315159;');
for(const [index,mode] of variants){
 live.storage.clear();open(live,index,mode);const label=`${index}/${mode}`;
 for(const condition of ['new','used']){
  const profile=setProfile(live,condition,4294967295-index);
  check(`新品/中古とも固有値は初期高さと別に持つ ${label} ${condition}`,()=>{
   assert.deepEqual(live.json('machineProfile'),profile);
   assert.ok(Object.values(profile.squareness).every(q=>Math.abs(q.microns)>=1));
   assert.ok(Object.values(profile.guides).every(q=>q.microns>=1));
  });
  live.registry.applyBestLevel.click();
  const before=live.json('machineEvaluation(supportHeights)');
  const reference=live.json('supportHeights');
  // Move all feet together within the supported interval. Geometry and the
  // optimization objective are invariant to this uniform vertical translation.
  const roomUp=.5-Math.max(...reference),roomDown=Math.min(...reference)+.5;
  const delta=roomUp>=.1?.1:roomDown>=.1?-.1:0;
  if(delta!==0)live.read(`supportHeights=supportHeights.map(h=>Math.round((h+${delta})*1000)/1000);updateLeveling();`);
  else {
   // A 24-point optimum can occupy both allowed height limits. Check the
   // geometric invariant directly without saving an out-of-range UI state.
   const translated=reference.map(h=>h+.1);
   near(live.read(`machineEvaluation(${JSON.stringify(translated)}).objective`),before.objective,1e-7);
  }
  check(`共通の高さ移動は精度を変えず追加調整を要求しない ${label} ${condition}`,()=>{
   near(live.read('machineEvaluation(supportHeights).objective'),before.objective,1e-7);
   assert.equal(live.registry.applyBestLevel.disabled,true,'同じ精度で全支持点を戻す必要はない');
   assert.doesNotMatch(live.registry.levelHint.textContent,/を [0-9.]+ mm(?:上げる|下げる)/);
   assert.match(live.registry.machineProgress.textContent,/調整の目安内/);
  });
  check(`共通高さの変更後も個体とガイド値は再抽選しない ${label} ${condition}`,()=>{
   assert.deepEqual(live.json('machineProfile'),profile);
   assert.equal(live.read('validLevelRecord(levelRecord())'),true);
  });
  const translated=live.json('levelRecord()');
  open(live,index,mode);
  check(`共通高さと参考精度は再表示でも保持する ${label} ${condition}`,()=>{
   assert.deepEqual(live.json('levelRecord()'),translated);
   assert.equal(live.registry.applyBestLevel.disabled,true);
   near(live.read('machineEvaluation(supportHeights).objective'),before.objective,1e-7);
  });
  // A true single plane moves all assemblies by the same orthonormal frame;
  // the fixed machine squareness must remain even with changed virtual sizes.
  // Irregular foundation stations do not share a 0.001 mm height grid for an
  // arbitrary plane. Do not quantize this mathematical plane-invariance case.
  live.read('levelConfig.width=.5;levelConfig.depth=20;supportHeights=supports.map(s=>{const h=.08+.07*s.x/(current.w*.4)-.06*s.z/(current.d*.4);return current.supportLayout?h:Math.round(h*1000)/1000;});updateLeveling();');
  check(`共通平面では個体の直角差だけが残る ${label} ${condition}`,()=>{
   for(const p of live.json('levelGeometry.pairs'))near(p.errorMicrons,profile.squareness[p.key].microns*live.read('levelConfig.offset')/MachineAccuracy.referenceLength,1e-7);
  });
  // All current machine positions may be reached between the reference samples.
  // Keep positional changes from changing the individual or corrupting frames.
  live.read('positions={X:17,Y:-33,Z:88,A:100,C:-100};updateAxisValues();drawScene();');
  check(`端・中央以外の位置でも数値・各軸方向は有限 ${label} ${condition}`,()=>{
   const g=live.json('levelGeometry');
   g.pairs.forEach(p=>{assert.ok(Number.isFinite(p.errorMicrons));assert.ok(Number.isFinite(p.angleDegrees));});
   for(const key of live.json('machineLinearKeys()'))near(magnitude(live.json(`accuracyVisualVector('${key}')`)),1,1e-12);
   assert.deepEqual(live.json('machineProfile'),profile);
  });
 }
}

// Pure engine error handling is deliberately exercised independently of a DOM
// record, including grids large enough to make intermediate supports significant.
for(const nx of [2,3,4])for(const nz of [2,3,4]){
 const p=Array.from({length:nz},(_,j)=>Array.from({length:nx},(_,i)=>({x:i-.5,z:j-.25,h:.013*i-.023*j+.05}))).flat();
 const s=Leveling.solve(p);
 check(`補間セルが増えても共通平面を維持 ${nx}x${nz}`,()=>{
  for(const x of [-1,.3,1.6,3.8])for(const z of [-1,.6,1.3,3.8]){
   near(s.heightAt(x,z),.013*(x+.5)-.023*(z+.25)+.05,1e-12);
   near(s.slopeAt(x,z).lr,.013,1e-12);near(s.slopeAt(x,z).fb,-.023,1e-12);
  }
 });
}

// Check the whole allowed common-height interval independently by enumerating
// its 0.001 mm grid. No candidate may move the reference geometry's relative
// heights, or recommend a mean height farther from the current one than needed.
live.storage.clear();open(live,0,'compact');
for(const heights of [[-.5,.5,0,.123],[-.499,-.498,-.487,-.5],[.499,.5,.487,.498],[-.125,.126,.117,-.121]]){
 for(const current of [[.5,.5,.5,.5],[-.5,-.5,-.5,-.5],[.101,-.119,.427,-.351]]){
  live.read(`machineReference.best={heights:${JSON.stringify(heights)},metric:machineEvaluation(${JSON.stringify(heights)})};supportHeights=${JSON.stringify(current)};`);
  const adjusted=live.json('machineBestHeights()');
  check(`参考調整の共通高さは端の制約と最寄り格子を守る ${heights}/${current}`,()=>{
   const mean=a=>a.reduce((s,v)=>s+v/a.length,0);
   adjusted.forEach((h,i)=>{assert.ok(h>=-.5&&h<=.5);near(h*1000,Math.round(h*1000),1e-7);near(h-adjusted[0],heights[i]-heights[0],1e-12);});
   const distance=Math.abs(mean(adjusted)-mean(current));
   for(let n=-1000;n<=1000;n++){
    const shifted=heights.map(h=>h+n/1000);
    if(shifted.every(h=>h>=-.500000001&&h<=.500000001))assert.ok(distance<=Math.abs(mean(shifted)-mean(current))+1e-12,'共通高さの格子にもっと近い値がある');
   }
  });
 }
}
// A reproducible used-machine case actually reaches the -0.500 mm bound in
// the search. Test real application, invariance and restoration at that bound.
live.storage.clear();open(live,0,'compact');
setProfile(live,'used',16);
live.read('levelConfig.width=20;levelConfig.depth=20;updateLeveling();');
check('大きい中古誤差と長い支持幅で探索は実際に上限に達する',()=>assert.ok(live.json('machineReference.best.heights').some(h=>Math.abs(h)>=.499)));
live.registry.applyBestLevel.click();
const boundObjective=live.read('machineEvaluation(supportHeights).objective');
const boundReference=live.json('machineReference.best.heights');
check('上限を含む参考調整の適用後も合法で同じ参考精度',()=>{
 assert.ok(live.json('supportHeights').every(h=>h>=-.5&&h<=.5));
 near(boundObjective,live.read('machineReference.best.metric.objective'),1e-7);
 assert.equal(live.registry.applyBestLevel.disabled,true);
});
const boundHeights=live.json('supportHeights'),boundDelta=boundHeights.every(h=>h>=-.3)?-.2:.1;
assert.ok(boundHeights.every(h=>h+boundDelta>=-.500000001&&h+boundDelta<=.500000001));
live.read(`supportHeights=supportHeights.map(h=>Math.round((h+${boundDelta})*1000)/1000);updateLeveling();`);
const boundRecord=live.json('levelRecord()');
open(live,0,'compact');
check('境界の参考高さは共通移動後の保存・再評価でも保持',()=>{
 assert.deepEqual(live.json('levelRecord()'),boundRecord);
 assert.deepEqual(live.json('machineReference.best.heights'),boundReference);
 assert.equal(live.registry.applyBestLevel.disabled,true);
 near(live.read('machineEvaluation(supportHeights).objective'),boundObjective,1e-7);
});
if(failures.length){console.error(`Mechanical audit: ${checks} checks run; ${failures.length} failed.\n${failures.join('\n')}`);process.exitCode=1;}
else console.log(`Mechanical audit: ${checks} checks passed.`);

'use strict';
// Independent checks for rough leveling followed by residual-precision work.
// The expected directions use an explicit Gram construction and quaternion;
// they never call geometryModel, intrinsicBodyFrame, or Leveling.orientation.
const assert=require('node:assert/strict');
const createEnvironment=require('./leveling-dom-env.cjs');
const MachineAccuracy=require('../src/machine-accuracy.js');
const irregularHeightOracle=require('./irregular-height-oracle.cjs');
const env=createEnvironment(),{registry:r,read,json,storage}=env;
const variants=[[0,'compact'],[1,''],[2,''],[3,'l3-3000'],[4,''],[5,''],[6,'']];
let checks=0;
const failures=[];
function check(name,fn){checks++;try{fn();}catch(error){failures.push(name+': '+error.message);}}
function near(a,b,tolerance=1e-7){assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance,`${a} != ${b}`);}
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0),add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),scale=(a,s)=>a.map(v=>v*s),unit=a=>scale(a,1/Math.hypot(...a));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function independentSlope(points,x,z){
 if(points.length===3){
  const [p,q,t]=points,dx=q.x-p.x,dz=q.z-p.z,tx=t.x-p.x,tz=t.z-p.z,dh=q.h-p.h,th=t.h-p.h,det=dx*tz-tx*dz;
  return {lr:(dh*tz-th*dz)/det,fb:(dx*th-tx*dh)/det};
 }
 const xs=[...new Set(points.map(p=>p.x))].sort((a,b)=>a-b),zs=[...new Set(points.map(p=>p.z))].sort((a,b)=>a-b);
 if(points.length!==xs.length*zs.length)return irregularHeightOracle(points).slopeAt(x,z);
 const interval=(values,value)=>{let i=0;while(i<values.length-2&&value>=values[i+1])i++;return i;};
 const i=interval(xs,x),j=interval(zs,z),dx=xs[i+1]-xs[i],dz=zs[j+1]-zs[j],u=(x-xs[i])/dx,v=(z-zs[j])/dz;
 const h=(x,z)=>points.find(p=>p.x===x&&p.z===z).h,h00=h(xs[i],zs[j]),h10=h(xs[i+1],zs[j]),h01=h(xs[i],zs[j+1]),h11=h(xs[i+1],zs[j+1]),bend=h11-h01-h10+h00;
 return {lr:(h10-h00+bend*v)/dx,fb:(h01-h00+bend*u)/dz};
}
function supportRotation(slope){
 const a=slope.lr/1000,b=slope.fb/1000,right=unit([1,a,0]),up=unit([-a,1,-b]),back=cross(right,up);
 return vector=>add(add(scale(right,vector[0]),scale(up,vector[1])),scale(back,vector[2]));
}
function intrinsicDirections(axes,profile,factor=1){
 const angle=(i,j)=>profile.squareness[axes[i].key+axes[j].key].microns/300000*factor;
 const x=axes[0].vector,y=axes[1].vector,yx=-Math.sin(angle(0,1)),yy=Math.cos(angle(0,1)),out=[x,add(scale(x,yx),scale(y,yy))];
 if(axes.length===3){const zx=-Math.sin(angle(0,2)),zy=(-Math.sin(angle(1,2))-zx*yx)/yy,zz=Math.sqrt(1-zx*zx-zy*zy);out.push(add(add(scale(x,zx),scale(y,zy)),scale(axes[2].vector,zz)));}
 return out;
}
function shortestRotation(from,to){
 const w=Math.sqrt((1+dot(from,to))/2),q=scale(cross(from,to),1/(2*w));
 return vector=>{const turn=cross(q,vector);return add(vector,add(scale(turn,2*w),scale(cross(q,turn),2)));};
}
// Portal physical geometry is independently covered by check-structural-invariants;
// portal branches here verify wiring of body/guide/readout semantics.
function expected(heights,factor=1){
 const m=json('current'),cfg=json('levelConfig'),g=json('levelGeometry'),axes=json('axisConfig(current).filter(a=>["X","Y","Z"].includes(a.key))'),profile=json('machineProfile');
 const coordinate=p=>({x:p.x/(m.w*.8)*cfg.width,z:p.z/(m.d*.8)*cfg.depth}),points=json('supports').map((p,i)=>({...coordinate(p),h:heights[i]}));
 const slopes=g.toolPoints.map(p=>{const q=coordinate(p);return independentSlope(points,q.x,q.z);}),toolSlope={lr:slopes.reduce((sum,s)=>sum+s.lr/slopes.length,0),fb:slopes.reduce((sum,s)=>sum+s.fb/slopes.length,0)};
 const q=coordinate(g.workPoint),workSlope=independentSlope(points,q.x,q.z),directions=intrinsicDirections(axes,profile,factor),index=axes.findIndex(a=>Math.abs(a.vector[1])===1),representative=index<0?axes.findIndex(a=>a.key==='Z'):index;
 const bodyRotate=shortestRotation(axes[representative].vector,directions[representative]),toolRotate=g.portal?(v=>{const f=json(`connectedPortal(levelSolution,levelGeometry.toolPoints,${factor}).frame`);return add(add(scale(f.right,v[0]),scale(f.up,v[1])),scale(f.back,v[2]));}):supportRotation({lr:toolSlope.lr*factor,fb:toolSlope.fb*factor}),up=toolRotate(bodyRotate([0,1,0])),direction=toolRotate(directions[representative]);
 const posture=m.kind==='lathe'?{front:Math.atan2(direction[1],Math.hypot(direction[0],direction[2]))*1e6,right:Math.atan2(direction[2],direction[0])*1e6}:{front:Math.atan2(-up[2],up[1])*1e6,right:Math.atan2(up[0],up[1])*1e6};
 return {posture,up,toolSlope,workSlope,axes,directions,toolRotate,bodyRotate,slopes};
}
function open(index,mode){storage.clear();read(`openMachine(machines[${index}])`);if(mode)r.machineMode.change(mode);const profile=MachineAccuracy.generate('used',123,json('machineLinearKeys()'),read('supports.length'));read(`initializeMachineAccuracy(${JSON.stringify(profile)});supportHeights=[...machineProfile.initialHeights];updateLeveling();`);return profile;}
for(const [index,mode] of variants){
 const profile=open(index,mode),label=index+'/'+mode;
 check('初期は同じ個体精度と非水平な支持高さ '+label,()=>{assert.deepEqual(json('machineProfile'),profile);assert.deepEqual(json('supportHeights'),profile.initialHeights);assert.ok(Math.hypot(read('levelSolution.lr'),read('levelSolution.fb'))>.02);});
 check('粗/微切替は調整量だけを変える '+label,()=>{
  const record=json('levelRecord()');r.coarseAdjust.click();assert.deepEqual(json('levelRecord()'),{...record,step:.01});r.fineAdjust.click();assert.deepEqual(json('levelRecord()'),{...record,step:.001});
 });
 check('粗/微の高さボタンが選択した量を使う '+label,()=>{
  const before=read('supportHeights[0]');r.coarseAdjust.click();r.up0.click();near(read('supportHeights[0]')-before,.01,1e-12);r.fineAdjust.click();r.up0.click();near(read('supportHeights[0]')-before,.011,1e-12);assert.deepEqual(json('machineProfile'),profile);
 });
 check('本体＋据付の合成姿勢は独立計算と一致 '+label,()=>{
  const wanted=expected(json('supportHeights')),actual=json('levelGeometry.bodyPosture');for(const key of ['front','right'])near(actual[key],wanted.posture[key]);
  for(const row of r.bodyLeanValues.children){const key=row.getAttribute('data-metric');near(Number(row.getAttribute('data-combined')),wanted.posture[key]);}
 });
 r.zero.click();
 check('粗レベルの目安内でも本体精度とガイドPVは残る '+label,()=>{
  assert.equal(r.stageStatus.getAttribute('data-coarse-ready'),'true');assert.ok(Math.hypot(...Object.values(json('levelGeometry.bodyPosture')))>.1);assert.ok(json('levelGeometry.pairs').some(p=>Math.abs(p.errorMicrons)>.1));assert.deepEqual(json('machineProfile'),profile);assert.ok(Object.values(profile.guides).every(g=>g.microns>0));
  assert.match(r.stageResidual.textContent,/固有精度は残ります/);assert.doesNotMatch(r.stageResidual.textContent,/ねじれは.*残ります/);
 });
 check('倍率は支持調整と軸操作で一定、絵の傾きは半分へ近づく '+label,()=>{
  read('supportHeights=supports.map(s=>{const p=levelCoordinates(s.x,s.z);return Math.round((p.x*.12+p.z*.06)*1000)/1000;});updateLeveling();');
  const factor=read('levelGeometry.visualFactor'),first=json('levelBodyVisualPoint([0,3,0],"tool")');
  read('supportHeights=supportHeights.map(h=>Math.round(h/2*1000)/1000);updateLeveling();');near(read('levelGeometry.visualFactor'),factor,1e-12);const second=json('levelBodyVisualPoint([0,3,0],"tool")');assert.ok(Math.hypot(...sub(first,second))>.001);
  read('positions.X=100;positions.Z=-100;updateAxisValues();updateLeveling();');near(read('levelGeometry.visualFactor'),factor,1e-12);
 });
 for(const exaggerated of [false,true]){
  r.exaggerate.checked=exaggerated;r.exaggerate.onchange();
  check('3D実体の縦方向が固有＋支持姿勢の独立回転と一致 '+label+' '+exaggerated,()=>{
   const wanted=expected(json('supportHeights'),exaggerated?read('levelGeometry.visualFactor'):1),g=json('levelGeometry'),offset=json('columnLayoutOffset(current)'),p=[g.poses.tool.anchor.x-offset.x,.66,g.poses.tool.anchor.z-offset.z];
   const base=json(`levelBodyVisualPoint(${JSON.stringify(p)},'tool')`),top=json(`levelBodyVisualPoint(${JSON.stringify(add(p,[0,1,0]))},'tool')`),up=unit(sub(top,base));up.forEach((v,i)=>near(v,g.portal?wanted.toolRotate([0,1,0])[i]:wanted.up[i],1e-11));
  });
  check('矢印は固有方向を1回だけ、中心は実可動部へ追従 '+label+' '+exaggerated,()=>{
   const factor=exaggerated?read('levelGeometry.visualFactor'):1,wanted=expected(json('supportHeights'),factor),arrows=json('axisIndicators(current,createGeometry(current))');
   for(const a of arrows.filter(a=>!a.curved)){
    const origin=scale(add(...a.points),.5),endpoints=a.points.map(p=>json(`levelAxisVisualPoint(${JSON.stringify(p)},${JSON.stringify(origin)},'${a.pose}',${JSON.stringify(a.bodyOrigin)},'${a.key}')`)),actual=unit(sub(endpoints[1],endpoints[0])),slope=a.pose==='tool'?wanted.toolSlope:wanted.workSlope,expectedDirection=read('!!levelGeometry.portal')?unit(json(`displayAxisFrame('${a.key}').rotate(accuracyVisualVector('${a.key}'))`)):supportRotation({lr:(index===2&&a.key==='X'?wanted.toolSlope:slope).lr*factor,fb:(index===2&&a.key==='X'?wanted.toolSlope:slope).fb*factor})(index===6&&a.key==='Z'?wanted.axes.find(q=>q.key==='Z').vector:wanted.directions[wanted.axes.findIndex(q=>q.key===a.key)]);
    actual.forEach((v,i)=>near(v,expectedDirection[i],1e-11));scale(add(...endpoints),.5).forEach((v,i)=>near(v,a.bodyOrigin[i],1e-11));
    const bodyPoints=json(`createGeometry(current).faces.filter(f=>f.axes.includes('${a.key}')).flatMap(f=>f.v.map(p=>levelMappedBodyVisualPoint(displayTransformedPoint(p,f.axes,current,positions,f.pose),f.pose)))`),center=[0,1,2].map(i=>(Math.min(...bodyPoints.map(p=>p[i]))+Math.max(...bodyPoints.map(p=>p[i])))/2);center.forEach((v,i)=>near(v,a.bodyOrigin[i],1e-11));
   }
  });
 }
 check('同じ保存JSONを復元して合成姿勢と固定倍率が戻る '+label,()=>{
  const record=json('levelRecord()'),posture=json('levelGeometry.bodyPosture'),factor=read('levelGeometry.visualFactor');assert.equal(read('validLevelRecord(levelRecord())'),true);read(`applyLevelRecord(${JSON.stringify(record)});buildSupports();updateLeveling();`);assert.deepEqual(json('levelRecord()'),record);assert.deepEqual(json('levelGeometry.bodyPosture'),posture);near(read('levelGeometry.visualFactor'),factor,1e-12);
 });
 if(index===5)check('3点支持のねじれ0と本体精度の残存を両立',()=>{r.zero.click();near(read('levelSolution.twist'),0,0);near(read('levelSolution.residual'),0,0);assert.ok(Math.hypot(...Object.values(json('levelGeometry.bodyPosture')))>.1);});
}
open(0,'compact');
check('粗目安は局所読みに依存せず左右/前後の平均だけ',()=>{
 read('supportHeights=supports.map(s=>{const p=levelCoordinates(s.x,s.z);return p.x*.018+p.z*.018;});updateLeveling();');assert.equal(r.stageStatus.getAttribute('data-coarse-ready'),'true');
 r.levelSensitivity.change('0.1');r.measurePos.change('1');assert.equal(r.stageStatus.getAttribute('data-coarse-ready'),'true');
 read('supportHeights=supports.map(s=>levelCoordinates(s.x,s.z).x*.022);updateLeveling();');assert.equal(r.stageStatus.getAttribute('data-coarse-ready'),'false');
});
check('平均レベル0でも支持面の対角ねじれを消さない',()=>{r.twistPreset.click();assert.equal(r.stageStatus.getAttribute('data-coarse-ready'),'true');assert.ok(Math.abs(read('levelSolution.twist'))>.02);assert.match(r.stageResidual.textContent,/ねじれも別に確認/);});
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log(`Level stages: ${checks} independent checks passed.`);

'use strict';
const {execFileSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const dir=__dirname,MA=require('/home/user/Training-tools/src/machine-accuracy.js'),{evaluate}=require('./indep.cjs');
const seeds=[['new',20261012],['used',31415926],['new',7]];
const ops={op1:{2:+.100,4:-.080,0:+.050},op2:{5:+.300,3:-.200,1:+.100}};
const positions=[{X:0,Z:0},{X:40,Z:-50},{X:100,Z:100}];
const r3=v=>Math.round(v*1000)/1000;
const cases=[];
for(const [condition,seed] of seeds){const init=MA.generate(condition,seed,['X','Z'],6).initialHeights;
 for(const [opName,op] of Object.entries(ops))for(const p of positions){
  const after=init.map((h,i)=>r3(Math.max(-.5,Math.min(.5,h+(op[i]||0)))));
  cases.push({condition,seed,op:opName,X:p.X,Z:p.Z,before:init,after});
 }}
const prodIn=cases.flatMap(c=>[{condition:c.condition,seed:c.seed,heights:c.before,X:c.X,Z:c.Z},{condition:c.condition,seed:c.seed,heights:c.after,X:c.X,Z:c.Z}]);
const prod=JSON.parse(execFileSync('node',[path.join(dir,'product.cjs'),JSON.stringify(prodIn)],{cwd:'/home/user/Training-tools',maxBuffer:1<<28}).toString());
const results=cases.map((c,i)=>({case:c,indep:evaluate(c),product:{before:prod[2*i].product,after:prod[2*i+1].product}}));
fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(results,null,1));
// ---------- tables ----------
const disp=v=>v===null||v===undefined||!Number.isFinite(v)?'—':(Math.round(Math.abs(v))===0?'0':(v<0?'-':'+')+Math.round(Math.abs(v)));
const f=(v,d=3)=>typeof v==='number'?v.toFixed(d):String(v);
let md='';let maxDiff={};
const note=(k,d)=>{maxDiff[k]=Math.max(maxDiff[k]||0,Math.abs(d));};
for(const r of results){
 const c=r.case,I=r.indep,P=r.product;
 md+=`\n### seed ${c.seed} (${c.condition}) / ${c.op} / X=${c.X}% Z=${c.Z}%\n`;
 md+=`before heights [${c.before.join(', ')}] → after [${c.after.join(', ')}] mm; XZ固有 ${I.inputs.XZmicrons} µm/300mm; X走査 ${f(I.inputs.Xscan[0],2)}→${f(I.inputs.Xscan[1],2)}%, Z走査 ${f(I.inputs.Zscan[0],2)}→${f(I.inputs.Zscan[1],2)}%\n\n`;
 md+='| 測定 | 条件 | 接触/伸び (mm) | 独立 生値 µm | 独立 表示 | 製品 生値 µm (関数) | 製品 表示 (markup) | 差 µm |\n|---|---|---|---|---|---|---|---|\n';
 const row=(name,cond,ext,mine,prodv,prodText)=>{const d=(typeof mine==='number'&&typeof prodv==='number')?mine-prodv:null;if(d!==null)note(name+'/'+cond.split(' ')[0],d);
  md+=`| ${name} | ${cond} | ${ext} | ${typeof mine==='number'?f(mine,4):mine} | ${typeof mine==='number'?(name.startsWith('主軸振れ')?String(Math.round(mine)):disp(mine)):'—'} | ${typeof prodv==='number'?f(prodv,4):(prodv??'製品値なし')} | ${prodText??'—'} | ${d===null?'—':d.toExponential(1)} |\n`;};
 const ext=(a,b)=>`${f(a*1000,4)}→${f(b*1000,4)}`;
 for(const [key,label,pk] of [['face','刃物台X(前面)','face'],['flat','刃物台Z(フラット)','flat']]){
  const q=I[key];
  row(label,'B 前',ext(q.before.zeroExt,q.before.endExt),q.before.B,P.before[pk],disp(P.before[pk]));
  row(label,'B 後(再方向・再ゼロ)',ext(q.after.B.zeroExt,q.after.B.endExt),q.after.B.microns,P.after[pk],disp(P.after[pk]));
  row(label,'A 後 始点',ext(.01,q.after.A.startExt),q.after.A.start,null,null);
  row(label,'A 後 終点',ext(.01,q.after.A.endExt),q.after.A.end,null,null);
  row(label,'C 後(ゼロのみ)',ext(q.after.A.startExt,q.after.A.endExt),q.after.C.microns,null,null);
 }
 row('主軸基準XZ(フランジ,X300)','B 前','—',I.xz_before.B,P.before.refXZ.microns,disp(P.before.refXZ.microns));
 row('主軸基準XZ(フランジ,X300)','B 後','—',I.xz_after.B,P.after.refXZ.microns,disp(P.after.refXZ.microns));
 row('主軸基準XZ(フランジ,X300)','C 後','—',I.xz_after.C,null,null);
 row('主軸基準XZ(フランジ,X300)','A 後','—','条件不足',null,null);
 row('XZ角度×0.5m(詳細欄)','前','—',I.xz_before.angleErr05,P.before.pairXZ[0].err,P.before.markup.accXZ||null);
 row('XZ角度×0.5m(詳細欄)','後','—',I.xz_after.angleErr05,P.after.pairXZ[0].err,P.after.markup.accXZ||null);
 const B=I.bore,lab=['a','b','c','d'];
 for(const [tag,src,pp] of [['B 前',B.before.B,P.before],['B 後',B.after.B,P.after]])lab.forEach((l,j)=>row('穴芯 '+l,tag,'—',src?src[j]:'無効',pp.bore.valid?pp.bore.readings[j]:null,pp.bore.valid?disp(pp.bore.readings[j]):'—'));
 if(B.after.A)lab.forEach((l,j)=>row('穴芯 '+l,'A 後(前のaゼロ保持)','—',B.after.A[j],null,null));
 row('穴芯 芯差X(径,+z)','前','—',B.before.dx,P.before.dx,disp(P.before.dx));row('穴芯 芯差X(径,+z)','後','—',B.after.dx,P.after.dx,disp(P.after.dx));
 row('穴芯 高さ','前','—',B.before.dy,P.before.dy,disp(P.before.dy));row('穴芯 高さ','後','—',B.after.dy,P.after.dy,disp(P.after.dy));
 for(const [key,label,pk] of [['barSide','バー側面(奥→手前)','barSide'],['barTop','バー上面(上→下)','barTop']]){
  const q=I[key];
  row(label,'B 前',ext(q.before.zeroExt,q.before.endExt)+` axial ${f(q.before.axial[0],3)}–${f(q.before.axial[1],3)} m`,q.before.B,P.before[pk],disp(P.before[pk]));
  row(label,'B 後',ext(q.after.B.zeroExt,q.after.B.endExt),q.after.B.microns,P.after[pk],disp(P.after[pk]));
  row(label,'A 後 始点',ext(q.before.zeroExt,q.after.A.startExt),q.after.A.start,null,null);
  row(label,'A 後 終点',ext(q.before.zeroExt,q.after.A.endExt),q.after.A.end,null,null);
  row(label,'C 後',ext(q.after.A.startExt,q.after.A.endExt),q.after.C.microns,null,null);
 }
 row('主軸振れ a(根元)','A/B/C','—',I.runout.root,P.before.runout.rootMicrons,String(Math.round(P.before.runout.rootMicrons)));
 row('主軸振れ b(300mm)','A/B/C','—',I.runout.tip,P.after.runout.tipMicrons,String(Math.round(P.after.runout.tipMicrons)));
 md+=`\n製品markup(前): ${P.before.markup.first} ｜ ${P.before.markup.second}\n\n製品markup(後): ${P.after.markup.first} ｜ ${P.after.markup.second}\n`;
}
fs.writeFileSync(path.join(dir,'tables.md'),md);
console.log(JSON.stringify(maxDiff,null,1));

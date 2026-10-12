'use strict';
// Driver: independent oracle vs product (product read via DOM of the node env).
process.chdir('/home/user/Training-tools');
const O=require('./oracle.cjs');
const MA=require('/home/user/Training-tools/src/machine-accuracy.js'); // input data only (generate)
const fs=require('node:fs');
const SEED=Number(process.env.SEED||12345),COND='new';
const profile=MA.generate(COND,SEED,['X','Y','Z'],4);
const sq={XY:profile.squareness.XY.microns,XZ:profile.squareness.XZ.microns,YZ:profile.squareness.YZ.microns};
const sqZero={XY:0,XZ:0,YZ:0};
const base=[...profile.initialHeights];
const ops=[[0,+.1],[0,-.2],[3,+.1],[1,-.2],[2,+.2]];
const states=[{X:0,Y:0,Z:0},{X:40,Y:-60,Z:30},{X:0,Y:100,Z:0}];

// ---- product (DOM) ----
const env=require('/home/user/Training-tools/tests/leveling-dom-env.cjs')();
env.read('openMachine(machines[0]);');
env.read(`machineProfile=window.MachineAccuracy.generate('${COND}',${SEED},['X','Y','Z'],4);machineReference=null;`);
function product(heights,st){
 env.read(`supportHeights=${JSON.stringify(heights)};positions={X:${st.X},Y:${st.Y},Z:${st.Z},A:0,C:0};updateLeveling(false);drawScene();`);
 const out={sq:{},sweep:[],local:{}};
 (function walk(el){for(const c of el.children){
  if(c.className&&c.className.includes('live-pair-error-value'))out.sq[c.parentElement.attrs['data-pair']]={display:Number(c.attrs['data-reading-microns']),physical:Number(c.attrs['data-physical-reading-microns']),text:c.textContent,gain:c.attrs['data-support-response-gain']};
  walk(c);}})(env.registry['liveSquareness']);
 if(!Object.keys(out.sq).length)(function walk(el){for(const c of el.children){if(c.attrs&&c.attrs['data-pair']&&c.attrs['data-reading-microns']!==undefined)out.sq[c.attrs['data-pair']]={display:Number(c.attrs['data-reading-microns']),physical:Number(c.attrs['data-physical-reading-microns']),text:null};walk(c);}})(env.registry['liveSquareness']);
 (function walk(el){for(const c of el.children){if(c.attrs&&c.attrs['data-pair']&&c.attrs['data-current-error-300']!==undefined)out.local[c.attrs['data-pair']]=Number(c.attrs['data-current-error-300']);walk(c);}})(env.registry['accuracyDiagram']);
 for(let i=0;i<4;i++)out.sweep.push({text:env.registry['sweepValue'+i].textContent,um:env.registry['sweepValue'+i].getAttribute('data-reading-microns')});
 // gain-1 product sweep (product function, comparison only)
 out.sweepPhysical=env.json(`(()=>{const g=spindleSweepGeometry(positions,levelSolution,machineProfile,1,false);return g.valid?g.cardinal.map(p=>p.readingMicrons):null})()`);
 return out;
}
const rnd=v=>{const m=Math.round(Math.abs(v));return m===0?'0':(v<0?'-':'+')+m;};
const results=[];
for(const st of states){
 const mBase=O.machine(base,sq);
 for(const [idx,d] of [[null,0],...ops]){
  const after=[...base];if(idx!==null)after[idx]=Math.round((after[idx]+d)*1000)/1000;
  const mAfter=O.machine(after,sq);
  const row={state:st,support:idx===null?'初期(操作なし)':'P'+(idx+1)+(d>0?'+':'')+d.toFixed(3)+'mm',heights:after,scans:{},sweep:null,local:O.local(mAfter,st)};
  for(const key of ['XY','XZ','YZ']){row.scans[key]=O.scan(mBase,mAfter,st,key,'tangent');row.scans[key].Bchord=O.scan(mBase,mAfter,st,key,'chord').B.um;}
  row.sweep=O.sweep(mBase,mAfter,st);
  // gain-5 hypothesis: extra head pitch 4*delta about X (delta = support-only pitch at datum)
  const datum={X:0,Y:0,Z:0},mp=O.machine(after,sqZero),mr=O.machine(O.planeHeights(after),sqZero,{bending:false});
  const delta=O.pitch(mp,datum)-O.pitch(mr,datum),axis=mp.Xdir(datum);
  const mG=O.machine(after,sq,{extraPitch:{axis,phi:4*delta}}),mGb=O.machine(base,sq,{extraPitch:{axis,phi:4*(O.pitch(O.machine(base,sqZero),datum)-O.pitch(O.machine(O.planeHeights(base),sqZero,{bending:false}),datum))}});
  row.gainHyp={deltaUrad:delta*1e6,sq:Object.fromEntries(['XY','XZ','YZ'].map(k=>[k,O.scan(mGb,mG,st,k,'tangent').B.um])),sweep:O.sweep(mGb,mG,st).map(p=>p.B)};
  row.product=product(after,st);
  results.push(row);
 }
}
fs.writeFileSync(__dirname+'/results.json',JSON.stringify({seed:SEED,condition:COND,profile,results},null,1));
// ---- compact text table ----
const f=(v,d=3)=>Number.isFinite(v)?v.toFixed(d):String(v);
let out=`seed=${SEED} cond=${COND} squareness(um/300)=${JSON.stringify(sq)} initialHeights=${JSON.stringify(base)}\nritz q1/t,q3/t=${O.ritz().map(v=>v.toFixed(6))}\n`;
for(const r of results){
 out+=`\n### state ${JSON.stringify(r.state)} | ${r.support} | h=${JSON.stringify(r.heights)}\n`;
 out+='pair | B e0→e1 mm | B um | B int | Bchord um | A zero e(before) | A e0,e1 mm(after) | A start um | A end um | A int | C um | C int | prod display(int) | prod physical | gainHyp B | local mine | local prod\n';
 for(const k of ['XY','XZ','YZ']){const s=r.scans[k],p=r.product.sq[k]||{};
  out+=`${k} | ${f(s.B.e0,6)}→${f(s.B.e1,6)} | ${f(s.B.um)} | ${rnd(s.B.um)} | ${f(s.Bchord)} | ${f(s.A.e0zero,6)} | ${f(s.A.e0,6)},${f(s.A.e1,6)} | ${f(s.A.startUm)} | ${f(s.A.um)} | ${rnd(s.A.um)} | ${f(s.C.um)} | ${rnd(s.C.um)} | ${f(p.display)}(${p.text}) | ${f(p.physical)} | ${f(r.gainHyp.sq[k])} | ${f(r.local[k])} | ${f(r.product.local[k])}\n`;}
 out+='sweep deg | onTable | ext mm | B um | B int | A um | A int | prod display text(um) | prod gain1 | gainHyp B\n';
 r.sweep.forEach((p,i)=>{out+=`${p.deg} | ${p.onTable} | ${f(p.ext_mm,6)} | ${f(p.B)} | ${rnd(p.B)} | ${f(p.A)} | ${rnd(p.A)} | ${r.product.sweep[i].text}(${r.product.sweep[i].um===''?'':f(Number(r.product.sweep[i].um))}) | ${r.product.sweepPhysical?f(r.product.sweepPhysical[i]):'-'} | ${f(r.gainHyp.sweep[i])}\n`;});
 out+=`spindle vs table normal (um/300, table frame): x ${f(r.local.spindleVsTable_x_um300)} z ${f(r.local.spindleVsTable_z_um300)}; gain delta=${f(r.gainHyp.deltaUrad)} urad\n`;
}
fs.writeFileSync(__dirname+'/tables.txt',out);console.log(out);

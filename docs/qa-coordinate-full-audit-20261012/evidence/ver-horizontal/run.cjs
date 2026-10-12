'use strict';
// Run from /home/user/Training-tools (the DOM env reads src/ relative to cwd).
const path=require('node:path'),fs=require('node:fs');
const O=require('./oracle.cjs');
const REPO='/home/user/Training-tools';
const MA=require(path.join(REPO,'src/machine-accuracy.js'));
const SEED=Number(process.env.SEED||20261012);
const profile=MA.generate('new',SEED,['X','Y','Z'],8); // input data only
const ax=O.intrinsic(profile.squareness);
const base=[...profile.initialHeights];
const names=['A 左・手前','B 右・手前','C 左・中間1','D 右・中間1','E 左・中間2','F 右・中間2','G 左・奥','H 右・奥'];
const ops=[
 {label:'A(左手前・隅)+0.05',d:{0:.05}},{label:'B(右手前・隅)-0.05',d:{1:-.05}},
 {label:'G(左奥・隅)-0.05',d:{6:-.05}},{label:'H(右奥・隅)+0.05',d:{7:.05}},
 {label:'C(左中間1)+0.05',d:{2:.05}},{label:'F(右中間2)+0.05',d:{5:.05}},
 {label:'中央4本 C,D,E,F +0.05',d:{2:.05,3:.05,4:.05,5:.05}},{label:'E(左中間2)-0.10',d:{4:-.1}},
];
const states=[{X:0,Y:0,Z:0},{X:40,Y:-50,Z:-30}];
const r3=v=>Math.round(v*1e3)/1e3,int=v=>{const m=Math.round(Math.abs(v));return m===0?'0':(v<0?'-':'+')+m;};

// ---- product (functions + DOM) ----
const env=require(path.join(REPO,'tests/leveling-dom-env.cjs'))();
env.read("openMachine(machines.find(m=>m.kind==='horizontal'))");
function product(heights,st){
 env.read(`machineProfile=${JSON.stringify(profile)};machineReference=null;supportHeights=${JSON.stringify(heights)};positions={X:${st.X},Y:${st.Y},Z:${st.Z},A:0,C:0};updateLeveling(false);`);
 const f={};for(const k of ['XY','XZ','YZ']){const r=env.json(`(()=>{const r=referenceScan({key:'${k}'});return {valid:r.valid,microns:r.microns,reason:r.reason,z:r.start?r.samples?.[0]?.extension??null:null}})()`);f[k]=r;}
 const hp=env.json(`(()=>{const r=horizontalParallelism();return {a:{valid:r.a.valid,microns:r.a.microns,reason:r.a.reason},b:{valid:r.b.valid,microns:r.b.microns,reason:r.b.reason}}})()`);
 f.a=hp.a;f.b=hp.b;
 // DOM: live squareness svg data/aria + Z parallel readouts
 const dom={};
 for(const el of env.registry.liveSquareness.querySelectorAll('svg')){const k=el.getAttribute('data-pair');dom[k]={data:el.getAttribute('data-reading-microns'),aria:(el.getAttribute('aria-label')||'').match(/(測定の終点値 )([^ ]+) µm/)?.[2]??null};}
 env.read('spindleSweepMode=true;updateSpindleSweep();');
 dom.a={text:env.registry.sweepValue0.textContent,data:env.registry.sweepValue0.getAttribute('data-reading-microns')};
 dom.b={text:env.registry.sweepValue1.textContent,data:env.registry.sweepValue1.getAttribute('data-reading-microns')};
 env.read('spindleSweepMode=false;');
 return {f,dom};
}

// ---- oracle conditions ----
function oracleCase(hBefore,hAfter,st){
 const Sb=O.surface(hBefore),Sa=O.surface(hAfter),out={};
 for(const k of ['XY','XZ','YZ']){
  const mB=O.alignAndMount(k,Sb,ax,st),mA=O.alignAndMount(k,Sa,ax,st);
  const b0=O.readS(mB,Sb,ax,0),b1=O.readS(mB,Sb,ax,1);           // before (mounted, aligned, zeroed)
  const a0=O.readS(mB,Sa,ax,0),a1=O.readS(mB,Sa,ax,1);           // after, same mount (A and C)
  const n0=O.readS(mA,Sa,ax,0),n1=O.readS(mA,Sa,ax,1);           // after, re-aligned, re-mounted (B)
  out[k]={phiBefore_urad:mB.phi*1e6,phiAfter_urad:mA.phi*1e6,alignBefore:mB.alignment,alignAfter:mA.alignment,
   before:{ext0:b0.ext,ext1:b1.ext,um:(b0.ext-b1.ext)*1e6,c0:b0,c1:b1},
   A:{ext0:a0.ext,ext1:a1.ext,startUm:(b0.ext-a0.ext)*1e6,um:(b0.ext-a1.ext)*1e6,c0:a0,c1:a1},
   C:{um:(a0.ext-a1.ext)*1e6},
   B:{ext0:n0.ext,ext1:n1.ext,um:(n0.ext-n1.ext)*1e6,c0:n0,c1:n1}};
 }
 const pB=O.parallelMount(Sb,ax,st),pA=O.parallelMount(Sa,ax,st);
 for(const w of ['a','b']){
  const b0=O.readParallel(pB,w,Sb,ax,0),b1=O.readParallel(pB,w,Sb,ax,1),a0=O.readParallel(pB,w,Sa,ax,0),a1=O.readParallel(pB,w,Sa,ax,1),n0=O.readParallel(pA,w,Sa,ax,0),n1=O.readParallel(pA,w,Sa,ax,1);
  out[w]={before:{ext0:b0.ext,ext1:b1.ext,um:(b0.ext-b1.ext)*1e6,c0:b0,c1:b1},A:{ext0:a0.ext,ext1:a1.ext,startUm:(b0.ext-a0.ext)*1e6,um:(b0.ext-a1.ext)*1e6,c0:a0,c1:a1},C:{um:(a0.ext-a1.ext)*1e6},B:{ext0:n0.ext,ext1:n1.ext,um:(n0.ext-n1.ext)*1e6,c0:n0,c1:n1}};
 }
 return out;
}

const results=[];let maxDiff=0;const keys=['XY','XZ','YZ','a','b'];
for(const st of states){
 const pBefore=product(base,st);
 for(const op of ops){
  const after=base.map((h,i)=>Math.round((h+(op.d[i]||0))*1000)/1000);
  const o=oracleCase(base,after,st),pAfter=product(after,st);
  const row={state:st,op:op.label,after,items:{}};
  for(const k of keys){
   const q=o[k],pb=pBefore.f[k],pa=pAfter.f[k];
   const diffB=pa.valid?q.B.um-pa.microns:null,diffBefore=pb.valid?q.before.um-pb.microns:null;
   if(diffB!==null)maxDiff=Math.max(maxDiff,Math.abs(diffB));if(diffBefore!==null)maxDiff=Math.max(maxDiff,Math.abs(diffBefore));
   row.items[k]={oracle:q,product:{before:pb,after:pa,domBefore:pBefore.dom[k],domAfter:pAfter.dom[k]},diffB,diffBefore};
  }
  results.push(row);
 }
}
fs.writeFileSync(path.join(__dirname,'results.json'),JSON.stringify({seed:SEED,profile,intrinsic:ax,base,results,maxDiff},null,1));

// ---- tables ----
const L=[];
L.push(`seed=${SEED} squareness XY=${profile.squareness.XY.microns} XZ=${profile.squareness.XZ.microns} YZ=${profile.squareness.YZ.microns} µm/300mm; initialHeights=${JSON.stringify(base)}`);
L.push(`max |oracle B - product| (and before) = ${maxDiff.toExponential(3)} µm`);
for(const r of results){
 L.push(`\n### 状態 X=${r.state.X} Y=${r.state.Y} Z=${r.state.Z}  操作: ${r.op}`);
 L.push('| 項目 | 前:伸び始/終 mm | 前 生値µm(整数) | 製品前 関数/DOM | A:伸び始/終 mm | A 始点指示µm | A 終点µm(整数) | C µm(整数) | B:伸び始/終 mm | B µm(整数) | 製品後 関数µm | 製品後 DOM | B−製品 µm |');
 L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
 for(const k of keys){
  const it=r.items[k],q=it.oracle,P=it.product,f=v=>v==null?'—':(v*1e3).toFixed(4),pv=x=>x.valid?r3(x.microns):'無効('+x.reason+')';
  const dom=d=>d?(d.aria??d.text)+' ['+(d.data===''||d.data==null?'—':r3(Number(d.data)))+']':'—';
  const validA=q.A.c0.valid&&q.A.c1.valid?'':' ※範囲外';
  L.push(`| ${k} | ${f(q.before.ext0)}/${f(q.before.ext1)} | ${r3(q.before.um)} (${int(q.before.um)}) | ${pv(P.before)} / ${dom(P.domBefore)} | ${f(q.A.ext0)}/${f(q.A.ext1)}${validA} | ${r3(q.A.startUm)} | ${r3(q.A.um)} (${int(q.A.um)}) | ${r3(q.C.um)} (${int(q.C.um)}) | ${f(q.B.ext0)}/${f(q.B.ext1)} | ${r3(q.B.um)} (${int(q.B.um)}) | ${pv(P.after)} | ${dom(P.domAfter)} | ${it.diffB==null?'—':it.diffB.toExponential(2)} |`);
 }
}
fs.writeFileSync(path.join(__dirname,'tables.md'),L.join('\n'));
console.log(L.slice(0,2).join('\n'));

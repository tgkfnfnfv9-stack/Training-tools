// Compare instantaneous Y tangent (product's YZ R alignment) with a finite 300 mm Y chord
// (how an R face would be aligned by end-to-end equal readings). Independent oracle only.
const src=require('fs').readFileSync(__dirname+'/run.cjs','utf8');
// reuse oracle functions by evaluating the helper part only
const helper=src.split('// ---------- product readout ----------')[0].replace(/process\.chdir[^\n]*\n/,'').replace(/const e=require[^\n]*\n/,'');
const mod={};new Function('module','require','__dirname',helper+';module.oracleModel=oracleModel;module.MA=MA;')(mod,require,__dirname);
const MA=mod.MA,sq=Object.fromEntries(Object.entries(MA.generate('new',20261012,['X','Y','Z'],4).squareness).map(([k,v])=>[k,v.microns]));
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),unit=a=>mul(a,1/Math.hypot(...a));
const out=[];
for(const h of [[-0.15,0.15,0.021,-0.02],[-0.05,0.15,0.021,-0.02],[0.1,-0.1,-0.1,0.1]])for(const Y of [0,-60,50]){
 const m=mod.oracleModel({heights:h,width:2.08,depth:2.16,W:2.6,Dm:2.7,columnX:0,columnZ:0,squareness:sq});
 const st={X:0,Y,Z:0},half=.4,lower=Math.max(-half,Math.min(half-.3,Y*half/100));
 const chord=unit(sub(m.P({X:0,Y:(lower+.3)/half*100}),m.P({X:0,Y:lower/half*100}))),tan=m.Ytan(st);
 out.push({heights:h,Y,tangentYZ_um:.3e6*dot(tan,m.Zdir),chordYZ_um:.3e6*dot(chord,m.Zdir),diff_um:.3e6*(dot(chord,m.Zdir)-dot(tan,m.Zdir))});
}
console.log(JSON.stringify(out,null,1));require('fs').writeFileSync(__dirname+'/chord-check.json',JSON.stringify(out,null,1));

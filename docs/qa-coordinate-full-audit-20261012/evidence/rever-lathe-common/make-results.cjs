const fs=require('fs'),L=require('./lathe-results.json'),C=require('./common-results.json'),D=require('./dims-results.json');
const r2=v=>v==null?null:Math.round(v*100)/100;
const res={
 target:{branch:'fix/compact-physical-posture-20261012 (HEAD e464c7f)',base:'main e0e62e7',indexHtmlUpToDate:true,browser:'/opt/pw-browsers/chromium-1194 (playwright 1.56.1)'},
 lathe:{
  agreement:{cases:L.summary.cases,seeds:[123456,20261012,7,987654321],supportOps:['initial','C+0.1','D-0.2','B+0.1,E-0.1','zero','A+0.3,F-0.3'],positions:'12 (X,Z) incl. Z=-68.57/-11.43/+45.71 boundary crossings, ends',maxAbsDiff_um:L.summary.maxNumericDiff,worstPerKey:L.summary.worst,
   integerTextMismatches:L.summary.textMismatches.map(m=>({seed:m.seed,op:m.op,X:m.X,Z:m.Z,failed:Object.keys(m.textOK).filter(k=>!m.textOK[k]),note:'oracle value within 0.01 of .5 rounding boundary'})),
   pageErrors:L.summary.pageErrors,dims:D.out.map(o=>({width:o.width,depth:o.depth,X:o.X,Z:o.Z,maxDiff:Math.max(...Object.values(o.diff))}))},
  continuity:Object.fromEntries(Object.entries(L.sweeps).map(([k,v])=>[k,v.jumps?Object.fromEntries(Object.entries(v.jumps).map(([q,w])=>[q,{maxStep_um:w.maxStep,at:w.at}])):v])),
  conditions:L.conditions.map(c=>({seed:c.seed,op:c.op,X:c.X,Z:c.Z,h0:c.h0,h1:c.h1,product_B:{before:Object.fromEntries(['face','flat','dx','dy','barSide','barTop'].map(k=>[k,r2(c.productB.before[k])])),after:Object.fromEntries(['face','flat','dx','dy','barSide','barTop'].map(k=>[k,r2(c.productB.after[k])])),beforeText:c.productB.beforeText,afterText:c.productB.afterText},oracle_A_C:c.oracle})),
  rigidTilt:L.rigidTilt,buttons:L.buttons},
 common:{ui:Object.fromEntries(Object.entries(C.ui).map(([k,v])=>[k,{branch:v.branch,main:v.main}])),layout:C.layout,saveLoad:C.saveLoad,oldFiles:C.oldFiles,signs:Object.fromEntries(Object.entries(C.signs).map(([k,v])=>[k,{checks:v.checks,errors:v.errors}]))}
};
fs.writeFileSync(__dirname+'/results.json',JSON.stringify(res,null,1));console.log(fs.statSync(__dirname+'/results.json').size);

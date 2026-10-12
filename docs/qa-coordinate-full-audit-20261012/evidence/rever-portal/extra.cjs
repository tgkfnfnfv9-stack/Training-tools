'use strict';
// Non-default levelConfig (support width/depth scaling, travel column layout) and range-limit validity.
const {execFileSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const O=require('./oracle.cjs'),DIR=__dirname,txt=v=>{const m=Math.round(Math.abs(v));return m===0?'0':(v<0?'-':'+')+m;};
const KIND={travel:'travel',gate:'double',gantry:'gantry'};
const VAR={
 travel:[{width:4.0,depth:2.3,columnX:60,columnZ:-40},{width:5.0,depth:1.9,columnX:-80,columnZ:70},{width:0.6,depth:2.08},{width:4.32,depth:0.8}],
 gate:[{width:3.0,depth:6.0},{width:2.6,depth:7.5},{width:2.85,depth:1.0},{width:0.6,depth:6.84}],
 gantry:[{width:3.5,depth:5.0},{width:2.9,depth:4.2},{width:3.2,depth:0.8},{width:0.6,depth:4.64}]
};
const OPS={travel:[[3,.2],[1,-.1]],gate:[[10,.15],[5,-.1]],gantry:[[2,.1],[7,-.2]]};
const POS=[{X:0,Y:0,Z:0},{X:100,Y:-100,Z:100},{X:-100,Y:100,Z:-100},{X:-63,Y:22,Z:-71}];
const out=[];let maxd=0,mism=[];
for(const id of Object.keys(VAR)){
 const scen=[];for(const v of VAR[id])for(const p of POS)for(const ops of [[],OPS[id]])scen.push({label:JSON.stringify(v)+(ops.length?' op':''),levelConfig:v,positions:p,ops});
 const prod=JSON.parse(execFileSync('node',[path.join(DIR,'product.cjs'),JSON.stringify({id,seed:4242,scenarios:scen})],{maxBuffer:1e9}).toString());
 for(const sc of prod.scenarios){
  const cfg={kind:KIND[id],w:prod.machine.w,d:prod.machine.d,columnX:prod.machine.columnX,columnZ:prod.machine.columnZ,supportLayout:prod.machine.supportLayout,levelConfig:sc.levelConfig,supports:prod.supports,sq:prod.profile.squareness};
  const M=O.model(cfg,sc.heights),st={X:sc.positions.X,Y:sc.positions.Y,Z:sc.positions.Z},rect=O.sweepRect(cfg,cfg.kind);
  const row={id,label:sc.label,positions:st,sq:{},sweep:[]};
  for(const pair of ['XY','XZ','YZ']){const b=O.squarenessB(M,pair,st),d=sc.dom.sq.find(q=>q.pair===pair),exp=b.valid?txt(b.microns):'—',raw=d.raw===''?null:Number(d.raw);
   if(b.valid&&raw!==null)maxd=Math.max(maxd,Math.abs(raw-b.microns));if(exp!==d.text)mism.push({id,label:sc.label,st,pair,exp,dom:d.text,expRaw:b.microns,raw,reason:b.reason,prodReason:sc.diag[pair].reason});
   row.sq[pair]={exp,expRaw:b.valid?b.microns:null,dom:d.text,domRaw:raw,reason:b.valid?null:(b.reason||b.zero.reason||b.last.reason),productReason:sc.diag[pair].reason};}
  const sw=O.sweepB(M,st,rect),zv=sw[3].onTable;sw.forEach((q,i)=>{const d=sc.dom.sweep[i],ok=zv&&q.onTable,exp=ok?txt(q.microns):(!q.onTable?'面外':'—');if(ok&&d.raw!=='')maxd=Math.max(maxd,Math.abs(Number(d.raw)-q.microns));if(exp!==d.text)mism.push({id,label:sc.label,st,sweep:i,exp,dom:d.text});row.sweep.push({exp,dom:d.text});});
  out.push(row);
 }
}
fs.writeFileSync(path.join(DIR,'extra-results.json'),JSON.stringify({maxAbsDiffMicrons:maxd,mismatches:mism,rows:out},null,1));
console.log('scenarios',out.length,'max|diff|',maxd,'mismatches',mism.length);console.log(JSON.stringify(mism.slice(0,10),null,1));
const inv=out.flatMap(r=>Object.entries(r.sq).filter(([k,v])=>v.exp==='—'||v.dom==='—').map(([k,v])=>[r.id,r.label,JSON.stringify(r.positions),k,v.exp,v.dom,v.reason,v.productReason]));
console.log('invalid squareness displays',inv.length);console.log(inv.filter((x,i)=>i%4===0).slice(0,16).map(x=>x.join(' | ')).join('\n'));

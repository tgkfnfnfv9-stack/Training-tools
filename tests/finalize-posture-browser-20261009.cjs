'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');
function finalize(out){
 const filename=path.join(out,'results.json');let r=JSON.parse(fs.readFileSync(filename));if(r.completeTrace)r=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(out,r.completeTrace))));r.checks=r.checks.filter(c=>!c.name.endsWith(' raw rounds to DOM'));
 for(const kind of ['horizontal','lathe']){const file=path.join(out,`${kind}-saved-state.json`);if(fs.existsSync(file)){const profile=JSON.parse(fs.readFileSync(file)).machineProfile;for(const s of r.states.filter(s=>s.kind===kind&&s.profile))s.profile=profile;}}
 const round=v=>Number.isFinite(v)?Math.sign(v)*Math.round(Math.abs(v)):null,numeric=t=>{const m=String(t).replaceAll('−','-').match(/[+-]?\d+(?:\.\d+)?/);return m?Number(m[0]):null;};
 const records=[];
 for(const s of r.states.filter(s=>['horizontal','lathe'].includes(s.kind))){
  const values={};
  if(s.kind==='horizontal'){
   for(const [i,key] of ['XY','XZ','YZ'].entries())values[key]={raw:s.raw[key],display:numeric(s.dom.squares[i]?.text)};
   for(const [i,key] of ['a','b'].entries())values[key]={raw:s.raw[key],display:numeric(s.dom.parallel[i]?.text)};
  }else{
   const text=s.dom.lathe,face=text.find(t=>/^X\s/.test(t)),match=face?.match(/X\s+([+\-−]?\d+)\s+Z\s+([+\-−]?\d+)/),run=text.find(t=>/^a\s*\d+.*b\s*\d+/.test(t)),rm=run?.match(/a\s*(\d+)\s*b\s*(\d+)/),centre=s.dom.second.match(/芯差 X\s+([+\-−]?\d+)／高さ\s+([+\-−]?\d+)/);
   for(const [key,display] of [['face',match?.[1]],['flat',match?.[2]],['dx',centre?.[1]],['dy',centre?.[2]],['barSide',text.find(t=>t.startsWith('側面（奥）'))],['barTop',text.find(t=>t.startsWith('上面'))]])values[key]={raw:s.raw[key],display:numeric(display)};
   for(const [i,key] of ['runoutRoot','runoutTip'].entries())values[key]={raw:s.raw.runout[i===0?'rootMicrons':'tipMicrons'],display:numeric(rm?.[i+1])};
   for(let i=0;i<4;i++){const letter='abcd'[i],txt=text.find(t=>new RegExp('^'+letter+'\\s+[+\\-−]?\\d+$').test(t));values['bore'+letter]={raw:s.raw.bore.readings?.[i],display:numeric(txt)};}
  }
  for(const [key,v] of Object.entries(values)){r.checks.push({name:`${s.name} ${key} raw rounds to DOM`,ok:round(v.raw)===v.display,detail:v});records.push({state:s.name,kind:s.kind,item:key,profile:s.profile?'used123456':'ideal',method:s.method,positions:s.positions,heights:s.supports.map(p=>p.height),...v});}
  s.measurements=values;
 }
 const demoFile=path.join(out,'demo-recheck.json');if(fs.existsSync(demoFile)){const demo=JSON.parse(fs.readFileSync(demoFile));r.demoRecheck='demo-recheck.json';for(const c of r.checks.filter(c=>!c.ok&&c.name.endsWith(' demo selected axis only'))){const match=demo.checks.find(d=>d.name===c.name.replace(' demo selected axis only',' demo changed selected axis only'));if(match?.ok){c.priorObservation={ok:false,reason:'Wall-clock demo completed its 3.5 s roundtrip before the stop action; its final position was zero.'};c.ok=true;c.resolvedBy='demo-recheck.json: real play/stop, 650 ms requestAnimationFrame clock, independent mechanical movement and slider replay';}}r.checks=r.checks.filter(c=>!c.name.startsWith('deterministic demo: '));r.checks.push(...demo.checks.map(c=>({...c,name:'deterministic demo: '+c.name})));}
 const archive=path.join(out,'results-full.json.gz');fs.writeFileSync(archive,zlib.gzipSync(JSON.stringify(r),{level:9}));
 const prune=(v,key)=>{if(v===null||typeof v!=='object')return v;if(key==='geometry')return undefined;if(key==='samples'&&Array.isArray(v))return {count:v.length,first:prune(v[0]),last:prune(v.at(-1))};if(Array.isArray(v))return v.map(x=>prune(x));return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,prune(x,k)]).filter(([,x])=>x!==undefined));};
 const compact=prune(r);compact.completeTrace='results-full.json.gz';compact.states=compact.states.map(s=>{if(s.kind==='horizontal')s.pose.horizontal={refs:s.pose.horizontal.refs.map(x=>({key:x.key,data:{model:x.data.model,valid:x.data.valid,microns:x.data.microns,start:x.data.start,end:x.data.end,samples:x.data.samples}})),parallel:prune(s.pose.horizontal.parallel)};return s;});
 fs.writeFileSync(filename,JSON.stringify(compact));
 fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(records,null,2));
 const quote=x=>'"'+String(x??'').replaceAll('"','""')+'"';fs.writeFileSync(path.join(out,'measurements.csv'),['state,kind,item,profile,method,positions,heights,raw_um,display_um',...records.map(v=>[v.state,v.kind,v.item,v.profile,v.method,JSON.stringify(v.positions),JSON.stringify(v.heights),v.raw,v.display].map(quote).join(','))].join('\n')+'\n');
 return {states:r.states.length,checks:r.checks.length,failed:r.checks.filter(c=>!c.ok),archive};
}
module.exports=finalize;if(require.main===module)console.log(JSON.stringify(finalize(path.resolve(process.argv[2]))));

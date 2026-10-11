'use strict';
// Join real-browser INPUT records and raw/DOM observations to the independent
// support-derived oracle. No app geometry or measurement functions are loaded.
const fs=require('node:fs'),path=require('node:path'),{model,scan,sweep}=require('./audit-independent-milling-20261011.cjs');
const [source,output]=process.argv.slice(2);if(!source||!output)throw new Error('usage: node audit-independent-milling-browser-20261011.cjs browser/results.json report.json');
const data=JSON.parse(fs.readFileSync(source,'utf8')),dimensions={vertical:[2.6,2.7],travel:[5.4,2.6],gate:[3.5625,8.55],gantry:[4,5.8],five:[3.4,3.3]},rows=[],failures=[],skipped=[];
const integer=v=>{const n=Math.round(Math.abs(v));return n===0?'0':(v>0?'+':'-')+n;};
for(const record of data.states){
 if(!dimensions[record.id])continue;
 const r=record.record,[w,d]=dimensions[record.id],input={kind:record.kind,w,d,width:r.width,depth:r.depth,columnX:r.columnX,columnZ:r.columnZ,profile:r.machineProfile||null},nodes=record.supports.map((s,i)=>({x:s.x/(w*.8)*r.width,z:s.z/(d*.8)*r.depth,h:r.heights[i],group:s.group})),state={X:0,Y:0,Z:0,A:0,C:0,...r.axisPositions};
 const m=model(input,nodes),expected={...Object.fromEntries(['XY','XZ','YZ'].map(key=>['square.'+key,record.kind==='five'&&(state.A||state.C)?null:scan(m,input,state,key).value])),...Object.fromEntries(sweep(m,state).values.map((v,i)=>['sweep.'+['right','back','left','front'][i],v]))};
 for(const [measurement,value] of Object.entries(expected)){
  const actual=record.measurements[measurement];if(!actual)continue;
  const comparable=actual.valid&&typeof actual.raw==='number'&&value!==null,rawError=comparable?Math.abs(actual.raw-value):null,expectedDOM=comparable?integer(value):null;
  const rawPass=comparable?rawError<=2e-5:null,domPass=comparable?actual.dom===expectedDOM:null;
  const row={state:record.name,machine:record.id,condition:record.condition,seed:record.seed,measurement,rawUm:actual.raw,dom:actual.dom,valid:actual.valid,expectedUm:value,expectedDOM,rawErrorUm:rawError,rawPass,domPass};rows.push(row);if(rawPass===false||domPass===false)failures.push(row);
 }
}
const report={source,sourceSHA256:data.sha256,sourceCommit:data.commit,semantics:'Physical, renewed-zero oracle. Validity flags in this join are browser observations; see independent-milling-contact-after.json for the separate final-build intersection/bounds check. Fixed fixture and old zero remain unspecified.',rows:rows.length,comparisons:rows.filter(r=>r.rawPass!==null).length,maxErrorUm:Math.max(...rows.map(r=>r.rawErrorUm||0)),failureCount:failures.length,skipped,failures,results:rows};fs.writeFileSync(output,JSON.stringify(report)+'\n');
const keys=Object.keys(rows[0]),quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';fs.writeFileSync(output.replace(/\.json$/,'.csv'),[keys.join(','),...rows.map(r=>keys.map(k=>quote(r[k])).join(','))].join('\n')+'\n');console.log(JSON.stringify({...report,results:undefined,failures:failures.slice(0,3)},null,2));if(failures.length&&!process.env.TT_BASELINE)process.exitCode=1;

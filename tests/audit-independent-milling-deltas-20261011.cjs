'use strict';
// Reproducible projection of the full independent audit to support-operation deltas.
const fs=require('node:fs');
const [source,output]=process.argv.slice(2);if(!source||!output)throw new Error('usage: node audit-independent-milling-deltas-20261011.cjs after.json deltas.csv');
const report=JSON.parse(fs.readFileSync(source,'utf8')),key=(r,name=r.input)=>JSON.stringify([r.machine,r.condition,r.state,name]),lookup=new Map(report.rows.map(r=>[key(r),r])),rows=[];
for(const r of report.rows.filter(r=>r.input.includes('support'))){
 const b=lookup.get(key(r,r.input.startsWith('zero-')?'zero-before':'before'));
 for(const [i,measurement] of ['XY','XZ','YZ','sweep0','sweep1','sweep2','sweep3'].entries()){
  const value=(r,field)=>i<3?r[field][measurement]:r[field].sweep[i-3],beforeRawUm=value(b,'rawUm'),afterRawUm=value(r,'rawUm'),beforeExpectedUm=value(b,'expectedUm'),afterExpectedUm=value(r,'expectedUm'),beforeDisplay=b.display[measurement],afterDisplay=r.display[measurement],deltaExpectedUm=afterExpectedUm-beforeExpectedUm;
  rows.push({machine:r.machine,condition:r.condition,seed:r.seed,state:JSON.stringify(r.state),input:r.input,measurement,mode:'renewed-setup-and-zero',beforeRawUm,afterRawUm,deltaRawUm:afterRawUm-beforeRawUm,beforeDisplay,afterDisplay,beforeExpectedUm,afterExpectedUm,deltaExpectedUm,classification:Math.abs(deltaExpectedUm)<1e-6?'change-below-1e-6um':beforeDisplay===afterDisplay?'raw-changed-rounded-display-same':'raw-and-display-changed',heldFixtureOldZero:'undefined-mounting-dimensions'});
 }
}
const keys=Object.keys(rows[0]),quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';fs.writeFileSync(output,[keys.join(','),...rows.map(r=>keys.map(k=>quote(r[k])).join(','))].join('\n')+'\n');const counts={};for(const r of rows)counts[r.classification]=(counts[r.classification]||0)+1;console.log(JSON.stringify({rows:rows.length,counts},null,2));

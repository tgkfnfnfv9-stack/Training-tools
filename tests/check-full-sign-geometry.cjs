'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('fs'), e=require('./leveling-dom-env.cjs')({pureLeveling:true});
const {read,json,registry:r}=e;const lit=JSON.stringify, unit=a=>a.map(v=>v/Math.hypot(...a)), sub=(a,b)=>a.map((v,i)=>v-b[i]), dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const result={purpose:'Independent geometric audit; engine/source read-only',rows:[],motion:[],dial:[],findings:[],checks:0,failures:[],htmlSha256:crypto.createHash('sha256').update(fs.readFileSync('index.html')).digest('hex'),maximumPairOracleDifference:0};
const check=(name,fn)=>{result.checks++;try{fn();}catch(error){result.failures.push({name,message:error.message});}};
const near=(a,b,t=1e-8)=>assert(Math.abs(a-b)<=t,`${a} != ${b}`);
const setstate=s=>read(`positions=${lit(s)};levelGeometry=geometryModel();`);
function groups(k){const g=new Map;for(const f of json(`createGeometry(current).faces.filter(f=>f.axes.includes('${k}'))`)){const id=lit([f.pose,f.axes]);if(!g.has(id))g.set(id,{pose:f.pose,axes:f.axes,points:[]});g.get(id).points.push(...f.v);}return [...g.values()];}
function centres(g){return json(`(${lit(g)}).map(g=>{const p=g.points.map(p=>displayedModelPoint(p,g.axes,current,positions,g.pose));return [0,1,2].map(i=>p.reduce((sum,vertex)=>sum+vertex[i]/p.length,0));})`);}
for(const kind of ['compact','horizontal','travel','double','gantry','five','lathe']){
 e.storage.clear();read(`openMachine(machines.find(m=>m.kind==='${kind}'));$('exaggerate').checked=false;machineReference=null;`);
 const keys=json('machineLinearKeys()'), supports=json('supports'), zero={X:0,Y:0,Z:0,A:0,C:0};
 const profile=json("window.MachineAccuracy.generate('new',78129,machineLinearKeys(),supports.length)");
 for(const v of Object.values(profile.squareness))v.microns=0;for(const v of Object.values(profile.guides))v.microns=0;
 const cases=[{name:'neutral',heights:supports.map(()=>0),profile},...[-1,1].map(sign=>({name:'supportA'+(sign>0?'+':'-')+'.01',heights:supports.map((s,i)=>i===0?sign*.01:0),profile}))];
 for(const pair of Object.keys(profile.squareness))for(const sign of [-1,1]){const p=JSON.parse(lit(profile));p.squareness[pair].microns=sign*10;cases.push({name:pair+(sign>0?'+':'-')+'10um',heights:supports.map(()=>0),profile:p});}
 const halfX=Math.max(...supports.map(s=>Math.abs(s.x)));
 for(const sign of [-1,1])cases.push({name:'supportBow'+sign,heights:supports.map(s=>sign*.01*(s.x/halfX)**2),profile});
 for(const c of cases){read(`positions=${lit(zero)};machineProfile=${lit(c.profile)};supportHeights=${lit(c.heights)};updateLeveling(false);`);
 for(const key of keys)for(const value of [0,50,100]){
  const s={...zero,[key]:value};setstate(s);const g=json('levelGeometry');
  const pairs=g.pairs.map(p=>{const vectors=p.key.split('').map(k=>g.directions.find(d=>d.key===k).direction);const expected=(Math.acos(Math.max(-1,Math.min(1,dot(...vectors))))-Math.PI/2)*300000;
   check(kind+'/'+c.name+'/'+key+'/'+value+'/'+p.key+' independent world dot-angle gives signed 300mm reading',()=>near(expected,p.deviationMicroradians*.3));
   if(c.name===p.key+'+10um'||c.name===p.key+'-10um')check(kind+'/'+c.name+'/'+key+'/'+value+' isolated intrinsic fixture retains known signed angle',()=>near(p.deviationMicroradians*.3,c.name.includes('+')?10:-10));
   const diff=Math.abs(expected-p.deviationMicroradians*.3);result.maximumPairOracleDifference=Math.max(result.maximumPairOracleDifference,diff);
   const plot=json(`squarenessPlot({key:'${p.key}',deviationMicroradians:${p.deviationMicroradians}})`), live=json(`liveSquarenessTip({key:'${p.key}',deviationMicroradians:${p.deviationMicroradians}},squarenessPlot({key:'${p.key}',deviationMicroradians:${p.deviationMicroradians}}))`);
   check(kind+'/'+c.name+'/'+key+'/'+value+'/'+p.key+' current display follows physical positive-axis tangent',()=>{const zero=Math.round(Math.abs(p.deviationMicroradians*.3))===0;assert.deepEqual(live,zero?[32,26]:plot.tip);});
   const rawAngle=Math.acos(dot(unit(sub(plot.tip,plot.origin)),[1,0]))*180/Math.PI;
   const liveInnerAngle=Math.acos(dot(unit(sub(live,plot.origin)),[1,0]))*180/Math.PI;
   return {pair:p.key,reading:p.deviationMicroradians*.3,localConfiguredLengthError:p.errorMicrons,oracle:expected,directions:vectors,rawInnerAngle:rawAngle,liveInnerAngle};});
  result.rows.push({kind,fixture:c.name,axis:key,position:value,pairs,body:g.bodyCombinedDirection,P:kind==='compact'?json('compactTablePathPoint(positions,levelSolution,machineProfile,1)'):null});
  const gs=groups(key),centre=centres(gs);setstate({...s,[key]:value+.01});const plus=centres(gs);setstate({...s,[key]:value-.01});const minus=centres(gs);setstate(s);
  if(c.name==='neutral'||/^[XYZ]{2}[+-]10um$/.test(c.name))gs.forEach((a,i)=>check(kind+'/'+c.name+'/'+key+'/'+value+'/'+a.pose+'/'+a.axes+' real mesh movement follows its physical guide',()=>{const tangent=unit(sub(plus[i],minus[i])),expected=kind==='lathe'&&key==='Z'?[1,0,0]:g.directions.find(d=>d.key===key).direction;assert(Math.hypot(...sub(tangent,expected))<1e-8);}));
  result.motion.push({kind,fixture:c.name,axis:key,position:value,groups:gs.map((a,i)=>({pose:a.pose,axes:a.axes,centre:centre[i],tangent:unit(sub(plus[i],minus[i])),guide:g.directions.find(d=>d.key===key).direction,guideDifference:Math.hypot(...sub(unit(sub(plus[i],minus[i])),g.directions.find(d=>d.key===key).direction))}))});
  if(['compact','travel','double','gantry','five'].includes(kind)){
   const d=json(`(()=>{const g=spindleSweepGeometry();return {axis:g.measurement.axis,nose:g.nose,centre:g.centre,points:g.cardinal.map(p=>({contact:p.contact,ringPoint:p.ringPoint,reading:p.readingMicrons}))};})()`);
   const extension=d.points.map(p=>dot(sub(d.nose.map((v,i)=>v+p.ringPoint[i]),p.contact),d.axis));
   d.points.forEach((p,i)=>check(kind+'/'+c.name+'/'+key+'/'+value+'/dial'+i+' increased contact compression is positive',()=>near(p.reading,(extension[3]-extension[i])*1e6)));
   result.dial.push({kind,fixture:c.name,axis:key,position:value,rows:d.points.map((p,i)=>({reading:p.reading,compressionFromFront:(extension[3]-extension[i])*1e6})),holderSide:dot(sub(d.nose,d.centre),d.axis)});
  }
 }
 }
 console.log(kind+' done rows='+result.rows.length);
}
{const l=lit,u=unit,out={P:[],Z:[],guideOnly:[],bodyReferences:[]};
for(const kind of ['compact','horizontal','travel','double','gantry','five','lathe']){
 e.storage.clear();read(`openMachine(machines.find(m=>m.kind==='${kind}'));$('exaggerate').checked=false;machineReference=null;`);
 const p=json("window.MachineAccuracy.generate('new',78129,machineLinearKeys(),supports.length)");for(const q of Object.values(p.squareness))q.microns=0;for(const q of Object.values(p.guides))q.microns=0;
 for(const f of ['neutral','support+.01','support-.01','XZ+10','XZ-10','analyticBow+','analyticBow-']){
  const q=JSON.parse(l(p));if(f.startsWith('XZ'))q.squareness.XZ.microns=f==='XZ+10'?10:-10;
  read(`positions={X:0,Y:0,Z:0,A:0,C:0};machineProfile=${l(q)};supportHeights=supports.map((s,i)=>i===0?${f==='support+.01'?.01:f==='support-.01'?-.01:0}:0);accuracyKey="";updateLeveling(false);`);
  if(f.startsWith('analyticBow')){const a=f.endsWith('+')?.01:-.01;read(`levelSolution={...levelSolution,parts:undefined,lr:0,fb:0,residual:.01,twist:0,plane:{a:0,b:0,c:0},heightAt:(x,z)=>${a}*z*z/2,slopeAt:(x,z)=>({lr:0,fb:${a}*z}),hessianAt:()=>({xx:0,xz:0,zz:${a}})};levelGeometry=geometryModel();`);}
  const update=z=>read(`positions.Z=${z};levelGeometry=geometryModel();`);
  const snap=()=>json(`({pair300:levelGeometry.pairs.map(p=>[p.key,p.deviationMicroradians*.3]),direction:levelGeometry.directions.find(d=>d.key==='Z').direction,body:levelGeometry.bodyCombinedDirection,referenceMeshes:createGeometry(current).references.map(r=>({pose:r.pose,axes:r.axes,base:displayedModelPoint(r.base,r.axes,current,positions,r.pose),tip:displayedModelPoint(r.tip,r.axes,current,positions,r.pose)}))})`);
  const base=snap();update(-50);const down=snap();update(-100);const bottom=snap();update(0);const restored=snap();out.Z.push({kind,fixture:f,base,down,bottom,restoreExact:l(base)===l(restored)});check(kind+"/"+f+" Z down and back restores physical coordinates and signed values",()=>assert.deepEqual(restored,base));
  out.bodyReferences.push({kind,fixture:f,measuredBodyDirection:base.body,meshDirections:base.referenceMeshes.map(m=>({pose:m.pose,direction:u(sub(m.tip,m.base))}))});
  if(kind==='compact')for(const axis of ['X','Y'])for(const position of [0,50,100]){
   read(`positions={X:0,Y:0,Z:0,A:0,C:0};positions.${axis}=${position};levelGeometry=geometryModel();`);
   const measured=json(`levelGeometry.directions.find(a=>a.key==='${axis}').direction`),pos=json('positions');
   read(`positions.${axis}=${position+.01};`);const plus=json('compactTablePathPoint(positions,levelSolution,machineProfile,1)');read(`positions.${axis}=${position-.01};`);const minus=json('compactTablePathPoint(positions,levelSolution,machineProfile,1)');
   const difference=Math.hypot(...sub(measured,u(sub(plus,minus))));check(kind+'/'+f+'/'+axis+'/'+position+' actual drawn virtual P path tangent matches local axis',()=>assert(difference<1e-8));out.P.push({kind,fixture:f,axis,position,measured,tangent:u(sub(plus,minus)),difference});
  }
 }
 read(`machineProfile=${l(p)};positions={X:0,Y:0,Z:0,A:0,C:0};supportHeights=supports.map(()=>0);accuracyKey="";updateLeveling(false);`);
 const before=json('({pairs:levelGeometry.pairs,directions:levelGeometry.directions,geometry:createGeometry(current)})');for(const q of Object.values(p.guides))q.microns=10;read(`machineProfile=${l(p)};accuracyKey="";updateLeveling(false);`);const after=json('({pairs:levelGeometry.pairs,directions:levelGeometry.directions,geometry:createGeometry(current)})');check(kind+" unchanged fixed guide metric does not create a solved bow or alter squareness",()=>assert.deepEqual(after,before));out.guideOnly.push({kind,guideMetricChanged:true,physicalModelAndPairUnchanged:l(before)===l(after)});
}

result.pathAndRestore=out;}
const output=process.env.FULLSIGN_GEOMETRY_OUTPUT||'tmp/full-sign-geometry-results.json';fs.writeFileSync(output,JSON.stringify(result));if(result.failures.length)process.exitCode=1;
console.log(JSON.stringify({checks:result.checks,failures:result.failures.length,rows:result.rows.length,motion:result.motion.length,dial:result.dial.length,maximumPairOracleDifference:result.maximumPairOracleDifference}));

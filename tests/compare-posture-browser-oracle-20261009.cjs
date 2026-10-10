'use strict';
// Join real browser inputs/output with an independently solved measurement.
const fs=require('node:fs'),path=require('node:path');
const O=require('./check-posture-measurement-independent-20261009.cjs');
const mode=process.argv[2]||'after',dir=path.resolve(__dirname,'../docs/qa-posture-response-20261009',mode),filename=path.join(dir,'results.json');
const report=JSON.parse(fs.readFileSync(filename)),results={},failures=[];
// These are fixed individual inputs observed separately from the geometry.
// They are held constant while supports move; this check does not audit RNG.
const latheFixed={face:.000012526463661342859,flat:.000026089975093491374,holeX:.00002995657210238278,holeY:-.0000026572029339149596};
for(const s of report.states.filter(s=>['horizontal','lathe'].includes(s.kind))){
 const {width,depth}=s.config,base=s.kind==='horizontal'?[2.72,3.68]:[4,1.68],nodes=s.supports.map(q=>({x:q.x/base[0]*width,z:q.z/base[1]*depth,mm:q.height})),state=s.positions;
 if(s.profile&&s.profile.seed!==123456)throw new Error('No independently recorded individual input for seed '+s.profile.seed);
 if(s.profile?.condition&&s.profile.condition!=='used')throw new Error('This audit holds the used individual fixed; got '+s.profile.condition);
 const profile=s.profile?.squareness?s.profile:s.profile?{squareness:s.kind==='horizontal'?{XY:{microns:16.959},XZ:{microns:-8.129},YZ:{microns:-14.12}}:{XZ:{microns:16.959}}}:null;
 const m=O.machine(s.kind,nodes,state,profile,width,depth),expected=s.kind==='horizontal'?{...O.fixtureBar(m,state,s.kind),...O.horizontalReference(m,state).values}:O.lathe(m,state,profile?latheFixed:{face:0,flat:0,holeX:0,holeY:0});
 const display={},error={};
 if(s.kind==='horizontal'){
  for(const [i,key] of ['XY','XZ','YZ'].entries())display[key]=s.dom.squares[i]?.text;
  display.a=s.dom.parallel[0]?.text;display.b=s.dom.parallel[1]?.text;
 }else{
  const items=s.dom.lathe||[],face=items.find(x=>/^X [−+\-\d]/.test(x)),side=items.find(x=>x.startsWith('側面（奥） ')),top=items.find(x=>x.startsWith('上面 '));
  const pair=face?.match(/^X\s+(\S+)\s+Z\s+(\S+)/);display.face=pair?.[1];display.flat=pair?.[2];display.barSide=side?.replace('側面（奥） ','');display.barTop=top?.replace('上面 ','');
  display.bore=items.filter(x=>/^[abcd] [−+\-\d]/.test(x)).slice(1,5);
 }
 for(const key of Object.keys(expected).filter(k=>k!=='bore')){
  error[key]=s.raw[key]-expected[key];
  if(!Number.isFinite(s.raw[key])||Math.abs(error[key])>5e-6)failures.push({name:s.name,key,raw:s.raw[key],expected:expected[key],error:error[key]});
  if(display[key]!==undefined&&Number(display[key].replace('−','-'))!==Math.round(s.raw[key]))failures.push({name:s.name,key,display:display[key],raw:s.raw[key],type:'display-rounding'});
 }
 if(expected.bore)for(let i=0;i<4;i++){
  const key='bore'+['a','b','c','d'][i],got=s.raw.bore.readings[i],want=expected.bore[i],shown=display.bore[i]?.slice(2);
  error[key]=got-want;
  if(Math.abs(error[key])>5e-6)failures.push({name:s.name,key,raw:got,expected:want,error:error[key]});
  if(shown!==undefined&&Number(shown.replace('−','-'))!==Math.round(got))failures.push({name:s.name,key,display:shown,raw:got,type:'display-rounding'});
 }
 if(s.raw.runout){
  const want=profile?{rootMicrons:11.98505076393485,tipMicrons:14.39028429697391}:{rootMicrons:0,tipMicrons:0};
  for(const key of Object.keys(want))if(s.raw.runout[key]!==want[key])failures.push({name:s.name,key,raw:s.raw.runout[key],expected:want[key],type:'fixed-individual'});
 }
 results[s.name]={kind:s.kind,input:s.supports,positions:state,profile:profile?'used/123456':'ideal',rawUm:s.raw,displayUm:display,expectedUm:expected,errorUm:error};
}
for(const [name,row] of Object.entries(results)){
 const parts=name.match(/^(horizontal|lathe)-(ideal|used)-(\d+)-(0\.001|0\.01)-(plus|minus)$/);if(!parts)continue;
 const baselineName=`${parts[1]}-${parts[2]}-flat`,before=results[baselineName];if(!before)continue;
 row.supportOperation={index:Number(parts[3]),deltaMm:Number(parts[4])*(parts[5]==='plus'?1:-1),baselineName,changes:{}};
 for(const key of Object.keys(row.expectedUm).filter(k=>k!=='bore')){
  const rawDelta=row.rawUm[key]-before.rawUm[key],expectedDelta=row.expectedUm[key]-before.expectedUm[key],from=before.displayUm[key],to=row.displayUm[key];
  const number=t=>t===undefined?undefined:Number(t.replace('−','-'));
  const invariant=row.kind==='lathe'&&key==='face'||row.kind==='horizontal'&&key==='XY'&&Number(parts[3])<4;
  const cause=invariant?'GEOMETRIC_INVARIANT':Math.abs(expectedDelta)<1e-6?'BELOW_0.000001_UM':from!==undefined&&number(from)===number(to)?'INTEGER_ROUNDING':'SUPPORT_RESPONSE';
  row.supportOperation.changes[key]={rawBefore:before.rawUm[key],rawAfter:row.rawUm[key],rawDelta,displayBefore:from,displayAfter:to,expectedBefore:before.expectedUm[key],expectedAfter:row.expectedUm[key],expectedDelta,cause};
 }
}
const summary={mode,states:Object.keys(results).length,passed:failures.length===0,failureCount:failures.length,maximumErrorUm:Math.max(0,...Object.values(results).flatMap(q=>Object.values(q.errorUm).map(Math.abs))),failures:failures.slice(0,20)};
fs.writeFileSync(path.join(dir,'independent-oracle.json'),JSON.stringify({summary,results},null,2)+'\n');
console.log(JSON.stringify(summary,null,2));if(mode!=='before'&&failures.length)process.exitCode=1;

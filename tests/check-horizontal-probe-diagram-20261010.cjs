'use strict';
// Regression for an actual support-operation counterexample. Expected direction
// comes from an independently intersected physical plunger, not the SVG formula.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');process.chdir(root);
const env=require('./leveling-dom-env.cjs')({pureLeveling:true});
const sourceFile=process.env.TT_DIAGRAM_SOURCE||'src/reference-measurement-ui.js',sourceBytes=fs.readFileSync(sourceFile),source=sourceFile.endsWith('.gz')?require('node:zlib').gunzipSync(sourceBytes):sourceBytes;
if(process.env.TT_DIAGRAM_SOURCE){
 const text=source.toString(),start=text.indexOf('function referenceDiagram('),end=text.indexOf('\nfunction referenceCard(',start);
 env.read(text.slice(start,end));
}
const failures=[],rows=[];
const dot=(a,b)=>a.reduce((sum,q,i)=>sum+q*b[i],0),sub=(a,b)=>a.map((q,i)=>q-b[i]);
const extension=p=>dot(p.normal,sub(p.point,p.body))/dot(p.normal,p.probe);
const check=(ok,label,data)=>{if(!ok)failures.push({label,...data});};
function inspect(name,m,svg){
 const match=/<path d="M23,([^L]+)L([^,]+),([^"]+)" class="scan-probe"/.exec(svg),cy=Number(match[1]),bx=Number(match[2]),by=Number(match[3]),length=Math.hypot(bx-23,by-cy);
 const body=/<rect x="([^"]+)" y="([^"]+)" width="11" height="6" rx="1" transform="rotate\(([^ ]+) ([^ ]+) ([^)]+)\)" class="scan-body"/.exec(svg);
 check(Number.isFinite(length),name+'/finite',{length});
 check(Math.abs(Number(body[1])-bx)<1e-12&&Math.abs(Number(body[2])+3-by)<1e-12,name+'/shared-body-probe-endpoint',{bx,by,body:body.slice(1)});
 if(m.valid){
  const actualExtension=extension(m.end),initialExtension=extension(m.start),delta=actualExtension-initialExtension;
  check(Math.abs(m.microns+(delta*1e6))<1e-6,name+'/physical-reading',{raw:m.microns,independentRaw:-delta*1e6});
  if(Math.abs(delta)>1e-13)check(Math.sign(length-11)===Math.sign(delta),name+'/extension-direction',{raw:m.microns,delta,length});
  else check(Math.abs(length-11)<1e-10,name+'/unchanged-length',{delta,length});
  check(length>=7-1e-10&&length<=15+1e-10,name+'/display-bounds',{length});
  rows.push({name,valid:true,rawUm:m.microns,display:env.read(`squarenessMicronText(${m.microns})`),independentStartMm:initialExtension*1000,independentEndMm:actualExtension*1000,svgLength:length,limited:svg.includes('data-diagram-limited="true"')});
 }else{
  check(svg.includes('<g opacity="0.3">'),name+'/invalid-muted',{});check(Math.abs(length-11)<1e-10,name+'/invalid-neutral',{length});rows.push({name,valid:false,svgLength:length});
 }
}
env.read(`openMachine(machines.find(m=>m.kind==='horizontal'));machineProfile=null;machineReference=null;positions={X:0,Y:0,Z:0,A:0,C:0};`);
for(const [name,heights] of [['flat',Array(8).fill(0)],['A+.050 E+.091',[.05,0,0,0,.091,0,0,0]],['A-.050 E-.091',[-.05,0,0,0,-.091,0,0,0]],['B+.200 G/H-.129',[0,.2,0,0,0,0,-.129,-.129]],['B+.010',[0,.01,0,0,0,0,0,0]],['B-.010',[0,-.01,0,0,0,0,0,0]]]){
 env.read(`supportHeights=${JSON.stringify(heights)};levelSolution=machineSolution(supportHeights);`);
 for(const key of ['XY','XZ','YZ']){const m=env.json(`referenceScan({key:'${key}'})`),svg=env.read(`referenceDiagram(${JSON.stringify(m)})`);inspect(name+'/'+key,m,svg);}
}
// Physical boundary fixtures: oblique plungers at unchanged extension, each
// sign, and the 0/20 mm endpoints. These isolate cosine and clipping cases.
const setup=env.json(`referenceSetup({key:'XY'})`);
for(const angle of [-.0002,0,.0002])for(const endExtension of [0,.00999999,.01,.01000001,.02]){
 const probe=[-Math.cos(angle),Math.sin(angle),0],point=[0,.3,0],start={point:[0,0,0],normal:[1,0,0],body:[.01,0,0],probe:[-1,0,0]},end={point,normal:[1,0,0],body:point.map((q,i)=>q-endExtension*probe[i]),probe},m={valid:true,setup,start,end,zero:{extension:.01,point:[0,0,0]},last:{extension:endExtension,point},microns:(.01-endExtension)*1e6,alongEnd:[0,1,0]};
 inspect(`synthetic angle=${angle}, extension=${endExtension}`,m,env.read(`referenceDiagram(${JSON.stringify(m)})`));
}
inspect('invalid contact',{valid:false,setup},env.read(`referenceDiagram({valid:false,setup:referenceSetup({key:'XY'})})`));
// Cross-machine guard: same poses and complete SVG are byte-identical to the
// untouched historical renderer for every non-horizontal kind.
const legacySource=require('node:zlib').gunzipSync(fs.readFileSync('docs/qa-yz-sign-recheck-20261010/browser/pr/index.html.gz')).toString(),begin=legacySource.indexOf('function referenceDiagram('),end=legacySource.indexOf('\nfunction referenceCard(',begin);
env.read(legacySource.slice(begin,end).replace('function referenceDiagram(','function legacyReferenceDiagram('));
let otherMachineDiagrams=0;
for(const kind of env.json(`machines.filter(m=>m.kind!=='horizontal').map(m=>m.kind)`)){
 env.read(`current={...current,kind:'${kind}'};`);
 for(const value of [.0098,.01,.0102]){
  const m={valid:true,setup:{...setup,lathe:kind==='lathe'},start:{point:[0,0,0],normal:[1,0,0],body:[.01,0,0],probe:[-1,0,0]},end:{point:[0,.3,0],normal:[1,0,0],body:[value,.3,0],probe:[-1,0,0]},zero:{extension:.01,point:[0,0,0]},last:{extension:value,point:[0,.3,0]},microns:(.01-value)*1e6,alongEnd:[0,1,0]};
  check(env.read(`referenceDiagram(${JSON.stringify(m)})`)===env.read(`legacyReferenceDiagram(${JSON.stringify(m)})`),kind+'/legacy-svg-identical',{value});otherMachineDiagrams++;
 }
}
const report={passed:failures.length===0,sourceFile,sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),scope:'Horizontal probe visible extension sign, common probe/body endpoint, clipping, invalid contact; independent ray/plane extension from supplied poses. Other machine SVG exact preservation.',cases:rows.length,otherMachineDiagrams,failures,rows};
if(process.env.TT_REPORT)fs.writeFileSync(process.env.TT_REPORT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,rows:undefined},null,2));if(failures.length)process.exitCode=1;

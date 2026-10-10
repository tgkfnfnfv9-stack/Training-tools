'use strict';
// Independent fixture audit. The production result supplies observed poses;
// this audit checks declared finite faces, endpoint zeroing, screen projection
// and rigid-world invariance. Support-to-pose numerical truth is tested by
// check-posture-measurement-independent-20261009.cjs, not inferred here.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
process.chdir(path.resolve(__dirname,'..'));
const sha256=content=>crypto.createHash('sha256').update(content).digest('hex');
const sourceFiles=directory=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?sourceFiles(path.join(directory,entry.name)):[path.join(directory,entry.name)]).sort();
const sourceSnapshot=()=>{const files=Object.fromEntries(sourceFiles('src').map(file=>[file,sha256(fs.readFileSync(file))]));return {sha256:sha256(Object.entries(files).map(([file,hash])=>file+'\0'+hash+'\n').join('')),files};};
const startedAt=new Date().toISOString(),testedSource=sourceSnapshot(),testSha256=sha256(fs.readFileSync(__filename));
const env=require('./leveling-dom-env.cjs')({pureLeveling:true});
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,k)=>a.map(v=>v*k),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>Math.hypot(...a);
const failures=[],rows=[],summary={states:0,fixtures:0,contactSamples:0,worldTransforms:0,maxRendDifferenceUm:0,maxRinteriorDifferenceUm:0,maxWorldReadingErrorUm:0,maxWorldPointErrorM:0,maxFaceOutOfPlaneM:0};
const check=(condition,label,detail)=>{if(!condition)failures.push({label,detail});};
const near=(a,b,tol,label)=>check(Number.isFinite(a)&&Math.abs(a-b)<=tol,label,{observed:a,expected:b,tolerance:tol});
const range=(x,min,max,label)=>check(x>=min-1e-9&&x<=max+1e-9,label,{observed:x,min,max});
const hit=pose=>dot(pose.normal,sub(pose.point,pose.body))/dot(pose.normal,pose.probe);
const observe=()=>env.json(`['XY','XZ','YZ'].map(key=>{const m=referenceScan({key});return {key,m,diagram:referenceDiagram(m)}})`);
env.read(`openMachine(machines.find(m=>m.kind==='horizontal'));$('exaggerate').checked=false;`);
const used=env.json(`window.MachineAccuracy.generate('used',123456,['X','Y','Z'],8)`);
const dimensions=[[2.72,3.68],[3.8,2.7]],states=[{X:0,Y:0,Z:0},{X:-100,Y:-100,Z:-100},{X:100,Y:100,Z:100},{X:57,Y:43,Z:29}];
const cases=[['flat',()=>0],['twist+', (x,z)=>.05*x*z],['twist-',(x,z)=>-.05*x*z],['plane+', (x,z)=>.08*x+.06*z],['B+',(_x,_z,i)=>i===1?.01:0],['B-',(_x,_z,i)=>i===1?-.01:0]];
const worldCases=[{axis:[-.2,.5,.9],angle:.71,translation:[1.7,-.6,2.3]},{axis:[.8,-.1,.3],angle:-1.03,translation:[-2.8,1.2,-.7]}];
env.read(`const fixtureAuditOriginalTool=horizontalSpindleFixture,fixtureAuditOriginalPallet=horizontalPalletPoint,fixtureAuditOriginalGeometry=geometryModel;
function fixtureAuditSetWorld(axis,angle,translation){
 const norm=Math.hypot(...axis),n=axis.map(v=>v/norm),c=Math.cos(angle),s=Math.sin(angle);
 const turn=v=>{const dot=n.reduce((sum,q,i)=>sum+q*v[i],0),cross=[n[1]*v[2]-n[2]*v[1],n[2]*v[0]-n[0]*v[2],n[0]*v[1]-n[1]*v[0]];return v.map((q,i)=>q*c+cross[i]*s+n[i]*dot*(1-c));};
 const point=v=>turn(v).map((q,i)=>q+translation[i]);
 const frame=f=>({...f,right:turn(f.right),up:turn(f.up),back:turn(f.back),rotate:v=>turn(f.rotate(v))});
 horizontalSpindleFixture=(state,solution,profile)=>{const t=fixtureAuditOriginalTool(state,solution,profile,fixtureAuditOriginalGeometry(state,solution,profile));return {...t,nose:point(t.nose),axis:turn(t.axis),right:turn(t.right),up:turn(t.up)};};
 horizontalPalletPoint=(...args)=>point(fixtureAuditOriginalPallet(...args));
 geometryModel=(...args)=>{const g=fixtureAuditOriginalGeometry(...args);return {...g,toolFrame:frame(g.toolFrame),workFrame:frame(g.workFrame),directions:g.directions.map(a=>({...a,direction:turn(a.direction)}))};};
}
function fixtureAuditResetWorld(){horizontalSpindleFixture=fixtureAuditOriginalTool;horizontalPalletPoint=fixtureAuditOriginalPallet;geometryModel=fixtureAuditOriginalGeometry;}`);
for(const [width,depth] of dimensions)for(const [name,height] of cases)for(const profile of [null,used])for(const state of states){
 const nodes=[-depth/2,-depth/6,depth/6,depth/2].flatMap(z=>[-width/2,width/2].map(x=>({x,z}))),heights=nodes.map((p,i)=>height(p.x,p.z,i));
 env.read(`fixtureAuditResetWorld();levelConfig.width=${width};levelConfig.depth=${depth};machineProfile=${JSON.stringify(profile)};supportHeights=${JSON.stringify(heights)};positions=${JSON.stringify({...state,A:0,C:0})};levelSolution=machineSolution(supportHeights);`);
 const original=observe(),label=`${width},${depth}/${name}/${profile?'used':'ideal'}/${JSON.stringify(state)}`;
 for(const {key,m,diagram} of original){
  const tag=`${label}/${key}`;check(m.valid,tag+'/valid',m.reason);if(!m.valid)continue;
  summary.fixtures++;
  const master=m.master,nS=master.Snormal,nR=master.Rnormal,nT=cross(nS,nR),q0=master.corner;
  near(norm(nS),1,2e-12,tag+'/unit-S');near(norm(nR),1,2e-12,tag+'/unit-R');near(dot(nS,nR),0,2e-12,tag+'/square');
  near(master.width,.32,1e-15,tag+'/width');near(master.height,.32,1e-15,tag+'/height');near(master.thickness,.05,1e-15,tag+'/thickness');
  near(m.alignment.zero.extension,.01,1e-12,tag+'/R-zero');near(m.zero.extension,.01,1e-12,tag+'/S-zero');
  const rEnd=(m.alignment.zero.extension-m.alignment.last.extension)*1e6;
  near(rEnd,0,1e-7,tag+'/R-end-equal');summary.maxRendDifferenceUm=Math.max(summary.maxRendDifferenceUm,Math.abs(rEnd));
  for(const s of m.alignment.samples){
   summary.contactSamples++;
   const d=sub(s.point,q0),coord=[dot(d,nS),dot(d,nR),dot(d,nT)];
   range(coord[0],-.01,.31,tag+'/R-width');near(coord[1],0,1e-11,tag+'/R-plane');range(coord[2],-.025,.025,tag+'/R-thickness');
   near(s.extension,hit(s.pose),1e-12,tag+'/R-contact');summary.maxFaceOutOfPlaneM=Math.max(summary.maxFaceOutOfPlaneM,Math.abs(coord[2]));
   summary.maxRinteriorDifferenceUm=Math.max(summary.maxRinteriorDifferenceUm,Math.abs((m.alignment.zero.extension-s.extension)*1e6));
  }
  // The S face origin is its zero point. Its physical R-coordinate is +10mm.
  for(const s of m.samples){
   summary.contactSamples++;
   const d=sub(s.point,s.pose.point),r=mul(s.along,m.setup.relativeSign),t=cross(s.pose.normal,r),coord=[dot(d,s.pose.normal),dot(d,r)+.01,dot(d,t)];
   near(coord[0],0,1e-11,tag+'/S-plane');range(coord[1],0,.32,tag+'/S-height');range(coord[2],-.025,.025,tag+'/S-thickness');near(s.extension,hit(s.pose),1e-12,tag+'/S-contact');
   summary.maxFaceOutOfPlaneM=Math.max(summary.maxFaceOutOfPlaneM,Math.abs(coord[2]));
  }
  const halfBase=key==='YZ'?.3:.55*width/2.72,halfScan=key==='XY'?.3:.45*depth/3.68;
  near(m.alignment.startPosition,Math.max(-halfBase,Math.min(halfBase-.3,state[key[0]]*halfBase/100)),1e-12,tag+'/R-clamp');
  near(m.startPosition,Math.max(-halfScan,Math.min(halfScan-.3,state[key[1]]*halfScan/100)),1e-12,tag+'/S-clamp');
  check(diagram.includes(`M3,${key==='XY'?34:11}H23\" class=\"scan-reference-face`),tag+'/R-screen-edge');
  check(diagram.includes(`↑${key==='XY'?'上':'奥'}`),tag+'/screen-up');
  check(diagram.includes('計器:頭')&&diagram.includes('相対')&&diagram.includes('押込＋'),tag+'/screen-ownership-and-press');
  check(diagram.includes(`<circle cx=\"23\" cy=\"${key==='XY'?31:14}\" r=\"1.6\" class=\"scan-zero`),tag+'/S-screen-zero');
  check(diagram.includes(`M61,${key==='XY'?31:14}L61,${key==='XY'?14:31}`),tag+'/screen-relative-arrow');
  check(diagram.includes('M29,40L40,40'),tag+'/screen-press-arrow');
  const contactY=Number(/<circle cx="23" cy="([^"]+)" r="1.6" class="scan-contact/.exec(diagram)[1]),relativeContact=sub(m.last.point,m.end.point);
  // Along-end is needed when the pallet has moved. Reconstruct it from the
  // two reported face directions; screen-up remains opposite travel for Z.
  const endR=mul(m.alongEnd,m.setup.relativeSign),endScreenUp=mul(endR,m.setup.relativeSign);
  near(contactY,Math.max(12,Math.min(33,(key==='XY'?31:14)-17*dot(relativeContact,endScreenUp)/.3)),1e-11,tag+'/screen-contact-projection');
  const press=key==='YZ'?'上':'右';check(diagram.includes(`class=\"scan-label\">${press}</text>`),tag+'/screen-press-direction');
  check(m.setup.owner===(key==='XY'?'body':'master')&&m.setup.memberSign===1&&m.setup.relativeSign===(key==='XY'?1:-1),tag+'/physical-movement');
  if(!profile&&name==='flat'){
   const corners=[-.01,.31].flatMap(s=>[0,.32].flatMap(r=>[-.025,.025].map(t=>add(add(add(q0,mul(nS,s)),mul(nR,r)),mul(nT,t)))));
   const lowest=Math.min(...corners.map(p=>p[1]-master.palletOrigin[1]));
   near(lowest,{XY:.05,XZ:.025,YZ:.04}[key],1e-12,tag+'/finite-underface-height');
  }
 }
 for(const world of worldCases){
  env.read(`fixtureAuditSetWorld(${JSON.stringify(world.axis)},${world.angle},${JSON.stringify(world.translation)});`);
  const transformed=observe(),axis=mul(world.axis,1/norm(world.axis)),turn=v=>add(add(mul(v,Math.cos(world.angle)),mul(cross(axis,v),Math.sin(world.angle))),mul(axis,dot(axis,v)*(1-Math.cos(world.angle)))),move=v=>add(turn(v),world.translation);
  for(let i=0;i<original.length;i++){
   const a=original[i].m,b=transformed[i].m,tag=label+'/'+original[i].key+'/world';check(a.valid===b.valid,tag+'/valid');if(!a.valid||!b.valid)continue;
   const delta=Math.abs(a.microns-b.microns);summary.maxWorldReadingErrorUm=Math.max(summary.maxWorldReadingErrorUm,delta);near(a.microns,b.microns,1e-7,tag+'/reading');
   for(const key of ['point','body'])for(const end of ['start','end']){const error=norm(sub(move(a[end][key]),b[end][key]));summary.maxWorldPointErrorM=Math.max(summary.maxWorldPointErrorM,error);near(error,0,1e-11,tag+'/'+end+'/'+key);}
   for(const attr of ['data-body-normal-m','data-probe-normal','data-probe-along']){const number=svg=>Number(new RegExp(attr+'="([^"]+)"').exec(svg)[1]);near(number(original[i].diagram),number(transformed[i].diagram),1e-11,tag+'/'+attr);}
  }
  summary.worldTransforms++;
 }
 env.read('fixtureAuditResetWorld();');
 if(width===2.72&&state.X===0)rows.push({input:name,individual:profile?'used/123456':'ideal',heightsMm:heights,state,readings:original.map(({key,m})=>({pair:key,rawUm:m.microns,displayUm:Math.round(m.microns),rEndpointUm:m.alignment.microns,rInteriorMaxUm:Math.max(...m.alignment.samples.map(s=>Math.abs((m.alignment.zero.extension-s.extension)*1e6)))}))});
 summary.states++;
}
const finalSource=sourceSnapshot();check(testedSource.sha256===finalSource.sha256,'source-unchanged-during-run',{start:testedSource.sha256,end:finalSource.sha256});
const report={passed:failures.length===0,scope:'Finite R/S fixture audit, screen geometry, world rigid transforms. Independent support-to-pose oracle is a separate test.',verification:{startedAt,completedAt:new Date().toISOString(),runtime:'src files loaded through tests/leveling-dom-env.cjs; generated index.html is not executed by this test',sourceHashMethod:'SHA256 of sorted src file records: relative path + NUL + content SHA256 + LF',sourceSha256:testedSource.sha256,sourceUnchangedDuringRun:testedSource.sha256===finalSource.sha256,sourceFiles:testedSource.files,testSha256},summary,failureCount:failures.length,failures:failures.slice(0,100),rows};
if(process.env.TT_REPORT)fs.writeFileSync(process.env.TT_REPORT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,rows:undefined},null,2));if(failures.length)process.exitCode=1;

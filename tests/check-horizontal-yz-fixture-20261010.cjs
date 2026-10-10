'use strict';
// Fixed physical sign examples, actual finite faces and spindle-fixed dog-leg
// arm clearance. Does not replace the independent support/posture review.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
process.chdir(path.resolve(__dirname,'..'));
const create=require('./leveling-dom-env.cjs'),env=create({pureLeveling:true}),old=create({pureLeveling:true});
const baseline=zlib.gunzipSync(fs.readFileSync('docs/qa-horizontal-fixture-20261010/before/index.html.gz')).toString();
for(const name of ['referenceSetup','horizontalReferenceScan','referenceScan']){
 const start=baseline.indexOf('function '+name+'('),next=baseline.indexOf('\nfunction ',start+1);old.read(baseline.slice(start,next));
}
for(const e of [env,old])e.read(`openMachine(machines.find(m=>m.kind==='horizontal'));machineProfile=null;machineReference=null;positions={X:0,Y:0,Z:0,A:0,C:0};`);
const dot=(a,b)=>a.reduce((s,q,i)=>s+q*b[i],0),sub=(a,b)=>a.map((q,i)=>q-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],failures=[],rows=[];
const check=(ok,label,data={})=>{if(!ok)failures.push({label,...data});},near=(a,b,tol,label)=>check(Math.abs(a-b)<=tol,label,{actual:a,expected:b,tolerance:tol});
const ray=p=>dot(p.normal,sub(p.point,p.body))/dot(p.normal,p.probe);
// Segment vs inflated oriented box: a miss proves the radius-4 mm rod clears
// the master (box inflation is conservative near edges and corners).
function intersects(a,b,bounds,r){let lo=0,hi=1;for(let i=0;i<3;i++){const d=b[i]-a[i],min=bounds[i][0]-r,max=bounds[i][1]+r;if(Math.abs(d)<1e-15){if(a[i]<min||a[i]>max)return false;continue;}let x=(min-a[i])/d,y=(max-a[i])/d;if(x>y)[x,y]=[y,x];lo=Math.max(lo,x);hi=Math.min(hi,y);if(lo>hi)return false;}return hi>=0&&lo<=1;}
const summary={states:0,contacts:0,armSegments:0,unchangedXYXZ:0,maxRendpointUm:0,maxContactErrorUm:0};
const profile=env.json(`window.MachineAccuracy.generate('used',123456,['X','Y','Z'],8)`),cases=[['flat',()=>0],['G/H+',(_x,_z,i)=>i>=6?.01:0],['G/H-',(_x,_z,i)=>i>=6?-.01:0],['B+',(_x,_z,i)=>i===1?.01:0],['E+',(_x,_z,i)=>i===4?.01:0],['A+.5',(_x,_z,i)=>i===0?.5:0],['H-.5',(_x,_z,i)=>i===7?-.5:0],['twist',(x,z)=>.05*x*z],['plane',(x,z)=>.08*x+.06*z]],states=[{X:0,Y:0,Z:0},{X:0,Y:0,Z:-100},{X:-100,Y:-100,Z:-100},{X:100,Y:100,Z:100},{X:57,Y:43,Z:29}];
for(const [width,depth] of [[2.72,3.68],[.5,1.23]])for(const [name,height] of cases)for(const used of [false,true])for(const state of states){
 const nodes=[-depth/2,-depth/6,depth/6,depth/2].flatMap(z=>[-width/2,width/2].map(x=>({x,z}))),heights=nodes.map((p,i)=>height(p.x,p.z,i)),label=`${width}/${depth}/${name}/${used?'used':'ideal'}/${JSON.stringify(state)}`;
 for(const e of [env,old])e.read(`levelConfig.width=${width};levelConfig.depth=${depth};machineProfile=${JSON.stringify(used?profile:null)};supportHeights=${JSON.stringify(heights)};positions=${JSON.stringify({...state,A:0,C:0})};levelSolution=machineSolution(supportHeights);`);
 const m=env.json(`referenceScan({key:'YZ'})`);check(m.valid,label+'/valid',{reason:m.reason});if(!m.valid)continue;
 summary.states++;check(m.setup.base==='Z'&&m.setup.scan==='Y'&&m.setup.owner==='body'&&m.setup.relativeSign===1,label+'/ownership');near(m.startState.Z,state.Z,1e-12,label+'/returned-Z');near(m.endState.Z,state.Z,1e-12,label+'/fixed-pallet-Z');near(m.alignment.microns,0,1e-6,label+'/R-equal');summary.maxRendpointUm=Math.max(summary.maxRendpointUm,Math.abs(m.alignment.microns));
 near(ray(m.start),.01,1e-12,label+'/S-start-zero');near(m.microns,(ray(m.start)-ray(m.end))*1e6,1e-7,label+'/independent-ray');
 if(!used&&width===2.72&&state.X===0&&state.Y===0&&state.Z===-100&&['G/H+','G/H-'].includes(name)){
  // Rear-cell support gradient; front Z path is horizontal. This expected
  // value is fixed by the 2D physical derivation, not the product sign table.
  const expected=(name==='G/H+'?1:-1)*.3*Math.sin(Math.atan(.00001/(3.68/3)))*1e6;near(m.microns,expected,1e-6,label+'/independent-support-sign');
 }
 for(const [stage,samples] of [['R',m.alignment.samples],['S',m.samples]])for(const sample of samples){
  const data=stage==='S'?{corner:m.master.corner,nS:m.master.Snormal,nR:m.master.Rnormal}:env.json(`(()=>{const s=${JSON.stringify(sample.state)},p=horizontalPalletPoint([0,1.27,-.85],s,levelSolution,machineProfile),f=referenceRigidFrame(geometryModel(s,levelSolution,machineProfile).workFrame);return {corner:window.ReferenceMeasurement.add(p,f.rotate(${JSON.stringify(m.master.localCorner)})),nS:f.rotate(${JSON.stringify(m.master.localSnormal)}),nR:f.rotate(${JSON.stringify(m.master.localRnormal)})};})()`),nT=cross(data.nS,data.nR),coord=p=>{const d=sub(p,data.corner);return [dot(d,data.nS),dot(d,data.nR),dot(d,nT)];},hit=coord(sample.point),bounds=[m.master.boundsS,m.master.boundsR,m.master.boundsThickness];
  check(sample.valid,label+'/'+stage+'/contact-valid');near(ray(sample.pose),sample.extension,1e-12,label+'/'+stage+'/ray');summary.maxContactErrorUm=Math.max(summary.maxContactErrorUm,Math.abs(ray(sample.pose)-sample.extension)*1e6);near(hit[stage==='R'?1:0],stage==='R'?0:.01,1e-10,label+'/'+stage+'/plane');
  for(let i=0;i<3;i++)check(hit[i]>=bounds[i][0]-1e-9&&hit[i]<=bounds[i][1]+1e-9,label+'/'+stage+'/face-range',{t:sample.t,coordinate:i,value:hit[i],bounds:bounds[i]});
  for(let i=1;i<sample.arm.length;i++){check(!intersects(coord(sample.arm[i-1]),coord(sample.arm[i]),bounds,m.bracket.sectionRadius),label+'/'+stage+'/arm-master-clearance',{t:sample.t,segment:i});summary.armSegments++;}
  summary.contacts++;
 }
 for(const key of ['XY','XZ']){const snapshot=`(()=>{const m=referenceScan({key:'${key}'});delete m.setup.body;return JSON.stringify(m);})()`;check(env.read(snapshot)===old.read(snapshot),label+'/'+key+'/unchanged-except-mount-wording');summary.unchangedXYXZ++;}
 const svg=env.read(`referenceDiagram(${JSON.stringify(m)})`);check(svg.includes('>YZ</text>')&&!svg.includes('>ZY</text>')&&svg.includes('↑上')&&svg.includes('計器:主軸')&&svg.includes('テーブル上'),label+'/labels');check(svg.includes('M3,11H23" class="scan-reference-face')&&svg.includes('<circle cx="23" cy="31"')&&svg.includes('M61,31L61,14'),label+'/R-top-zero-bottom-up');
 if(width===2.72&&state.X===0&&state.Y===0)rows.push({name,profile:used?'used/123456':'ideal',state,heights,oldRawUm:old.json(`referenceScan({key:'YZ'}).microns`),newRawUm:m.microns,newDisplay:env.read(`squarenessMicronText(${m.microns})`),RendpointUm:m.alignment.microns,Rstart:m.alignment.startState,Rend:m.alignment.endState,Sstart:m.startState,Send:m.endState});
}
// Short travel reports invalid, rather than silently shortening the test.
env.read(`levelConfig.depth=.5;levelSolution=machineSolution(supportHeights);`);check(!env.json(`referenceScan({key:'YZ'}).valid`),'insufficient-Z-travel');
// The accessible note switches only for horizontal and returns byte-for-byte.
const dom=env.registry;env.read(`updateReferenceMeasurementCopy();`);const original=env.read('referenceMeasurementCopyDefaults.scanNote');check(dom.squarenessMeasurementNote.textContent.includes('YZのR合わせ')&&dom.squarenessMeasurementNote.textContent.includes('主軸頭のY＋'),'horizontal-note');
for(const kind of env.json(`machines.filter(m=>m.kind!=='horizontal').map(m=>m.kind)`)){env.read(`current={...current,kind:'${kind}'};updateReferenceMeasurementCopy();`);check(dom.squarenessMeasurementNote.textContent===original,kind+'/note-restored');}
const report={passed:failures.length===0,sourceSha256:crypto.createHash('sha256').update(fs.readFileSync('src/reference-measurement-ui.js')).digest('hex'),summary,failures,rows};
if(process.env.TT_REPORT)fs.writeFileSync(process.env.TT_REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,rows:undefined,failures:failures.slice(0,20)},null,2));if(failures.length)process.exitCode=1;

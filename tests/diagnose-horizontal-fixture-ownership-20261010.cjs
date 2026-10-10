'use strict';
// Independently audit ownership by inverting observed material-point motion.
// Fixture metadata and old owner/sign tables are not the expected transform.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(process.argv[2]||'.'),output=path.resolve(process.argv[3]||'docs/qa-horizontal-fixture-20261010/ownership-after.json'),stage=process.argv[4]||'after';process.chdir(root);
const env=require(path.join(root,'tests/leveling-dom-env.cjs'))({pureLeveling:true});for(const f of ['intrinsic-inspection.js','lathe-inspection.js','lathe-inspection-ui.js'])env.read(fs.readFileSync('src/'+f,'utf8'));env.read('updateLatheInspectionUI=()=>{};');
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),length=a=>Math.hypot(...a),unit=a=>a.map(v=>v/length(a)),local=(f,v)=>f.basis.map(a=>dot(a,sub(v,f.origin))),direction=(f,v)=>f.basis.map(a=>dot(a,v));
const checks=[],failures=[],rows=[],motion=[];let maximumLocalError=0;
function check(name,actual,expected,tol=2e-11){const error=Array.isArray(actual)?length(sub(actual,expected)):Math.abs(actual-expected);maximumLocalError=Math.max(maximumLocalError,error);checks.push({name,error});if(!Number.isFinite(error)||error>tol)failures.push({name,actual,expected,error});}
function material(kind,owner,state){
 const values=env.json(`(()=>{const state=${JSON.stringify(state)},raw=${kind==='horizontal'?(owner==='head'?'[0,2.55,-.93]':'[0,1.27,-.85]'):(owner==='head'?'[-current.w*.24+.125,1.5,0]':'[.08,1.5,.20]')},point=p=>${kind==='horizontal'?(owner==='head'?'horizontalToolPoint(p,state,levelSolution,machineProfile)':'horizontalPalletPoint(p,state,levelSolution,machineProfile)'):`latheAssembly(p,'${owner==='head'?'tool':'work'}',state).point`};return [point(raw),...[0,1,2].map(i=>point(raw.map((v,j)=>v+(i===j?.1:0))))];})()`);
 return {origin:values[0],basis:values.slice(1).map(p=>unit(sub(p,values[0])))};
}
const states=[{X:0,Y:0,Z:0,A:0,C:0},{X:57,Y:43,Z:29,A:0,C:0},{X:-100,Y:100,Z:-100,A:0,C:0}],patterns=['0','i===1?.01:0','.01*q.x*q.z','-.01*q.x*q.z'];
for(const kind of ['horizontal','lathe']){
 env.read(`openMachine(machines.find(m=>m.id==='${kind}'));machineReference=null;machineSavedBest=null;$('exaggerate').checked=false;`);
 const dimensions=env.json('({width:levelConfig.width,depth:levelConfig.depth})');
 for(const used of [false,true])for(let pat=0;pat<patterns.length;pat++)for(let stateIndex=0;stateIndex<states.length;stateIndex++)for(const scale of [1,.5]){
  const state=states[stateIndex],caseId=`${kind} used${used} p${pat} s${stateIndex} scale${scale}`;
  env.read(`machineProfile=${used?"MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length)".replace('MachineAccuracy','window.MachineAccuracy'):'null'};levelConfig.width=${dimensions.width*scale};levelConfig.depth=${dimensions.depth*scale};positions=${JSON.stringify(state)};supportHeights=supports.map((p,i)=>{const q=levelCoordinates(p.x,p.z);return ${patterns[pat]};});updateLeveling(false);`);
  if(kind==='horizontal'){
   const axes=env.json('axisConfig(current).map(a=>({key:a.key,half:Math.hypot(levelCoordinates(a.vector[0]*a.amp,a.vector[2]*a.amp).x,a.vector[1]*a.amp,levelCoordinates(a.vector[0]*a.amp,a.vector[2]*a.amp).z)}))'),half=key=>axes.find(a=>a.key===key).half;
   for(const key of ['XY','XZ','YZ']){
    const m=env.json(`referenceScan(geometryModel().pairs.find(p=>p.key==='${key}'))`);if(!m.valid){rows.push({caseId,key,valid:false,reason:m.reason});continue;}
    if(stage==='after'&&key==='YZ'){assert.equal(m.setup.base,'Z','new YZ aligns R by Z');assert.equal(m.setup.scan,'Y','new YZ reads S by Y');}
    const startState={...state,[m.setup.scan]:m.startPosition/half(m.setup.scan)*100},phaseObservations={};
    for(const [phase,samples,start,end,axis] of [['S',m.samples,m.startPosition,m.endPosition,m.setup.scan],['R',m.alignment.samples,m.alignment.startPosition,m.alignment.endPosition,m.setup.base]]){
     const observations=samples.map(s=>{const at={...startState,[axis]:(start+(end-start)*s.t)/half(axis)*100},head=material(kind,'head',at),pallet=material(kind,'table',at);if(s.state)for(const k of ['X','Y','Z'])assert.ok(Math.abs(s.state[k]-at[k])<1e-9,'explicit sample state matches actual alignment/scan axis');return {t:s.t,headArm:local(head,s.pose.body),headProbe:direction(head,s.pose.probe),masterPoint:local(pallet,s.pose.point),masterNormal:direction(pallet,s.pose.normal),routedArm:s.arm?.map(v=>local(head,v)),wrongBodyOwner:local(pallet,s.pose.body),wrongMasterOwner:local(head,s.pose.point),extension:s.extension};});
     for(const o of observations)for(const field of ['headArm','headProbe','masterPoint','masterNormal'])check(`${caseId} ${key} ${phase} ${field} t${o.t}`,o[field],observations[0][field]);
     for(const o of observations)if(o.routedArm)for(let v=0;v<o.routedArm.length;v++)check(`${caseId} ${key} ${phase} rigid routed arm vertex${v} t${o.t}`,o.routedArm[v],observations[0].routedArm[v]);
     phaseObservations[phase]=observations;
     rows.push({caseId,key,phase,valid:true,scanAxis:axis,raw:m.microns,sampleCount:samples.length,headArm:observations[0].headArm,headProbe:observations[0].headProbe,masterPoint:observations[0].masterPoint,masterNormal:observations[0].masterNormal,wrongBodyOwnerVariation:length(sub(observations.at(-1).wrongBodyOwner,observations[0].wrongBodyOwner)),wrongMasterOwnerVariation:length(sub(observations.at(-1).wrongMasterOwner,observations[0].wrongMasterOwner)),zeroExtension:observations[0].extension,endExtension:observations.at(-1).extension,...(stage==='after'&&key==='YZ'?{selectedState:state,returnState:m.returnState,startState:samples[0].state,endState:samples.at(-1).state}:{})});
    }
    if(stage==='after'&&key==='YZ'){
     const r=phaseObservations.R[0],s=phaseObservations.S[0];
     for(const axis of ['X','Y','Z']){
      check(caseId+' YZ returns to selected Z before S '+axis,m.returnState[axis],startState[axis]);
      check(caseId+' YZ R initial X/Y clamped once '+axis,m.alignment.startState[axis],axis==='Z'?m.alignment.startPosition/half('Z')*100:startState[axis]);
      check(caseId+' YZ S starts from returned material state '+axis,m.startState[axis],m.returnState[axis]);
     }
     check(caseId+' YZ R and S are the same perpendicular square',dot(r.masterNormal,s.masterNormal),0);
     check(caseId+' YZ S is the aligned square transported to selected Z',s.masterPoint,r.masterPoint.map((v,i)=>v+.01*s.masterNormal[i]-.31*r.masterNormal[i]));
     check(caseId+' YZ R initial extension is 10mm',r.extension,.01);
     check(caseId+' YZ S has a separate new 10mm zero',s.extension,.01);
    }
   }
   const bar=env.json('horizontalParallelism()');const head=material(kind,'head',state);check(caseId+' bar fixed spindle origin',local(head,bar.bar.origin),[0,0,-.31]);check(caseId+' bar fixed spindle direction',direction(head,bar.bar.axis),[0,0,1]);
   for(const key of ['a','b']){const r=bar[key];if(!r.valid){rows.push({caseId,key,valid:false,reason:r.reason});continue;}
    const obs=r.samples.map(s=>{const at={...state,Z:(bar.startPosition+(bar.endPosition-bar.startPosition)*s.t)/half('Z')*100},table=material(kind,'table',at),tool=material(kind,'head',at);return {t:s.t,arm:local(table,s.body),probe:direction(table,s.probe),barInHead:local(tool,bar.bar.origin),bodyInHead:local(tool,s.body),extension:s.extension};});
    for(const s of obs){check(caseId+' '+key+' fixed pallet arm '+s.t,s.arm,obs[0].arm);check(caseId+' '+key+' fixed pallet probe '+s.t,s.probe,obs[0].probe);check(caseId+' '+key+' bar stays spindle '+s.t,s.barInHead,[0,0,-.31]);}
    check(caseId+' '+key+' zero extension',obs[0].extension,.01);check(caseId+' '+key+' zero body side',direction(head,sub(r.samples[0].body,bar.bar.origin)),key==='a'?[-.035,0,0]:[0,-.035,0]);check(caseId+' '+key+' probe side',direction(head,r.samples[0].probe),key==='a'?[1,0,0]:[0,1,0]);
    rows.push({caseId,key,valid:true,raw:r.microns,samples:obs.length,tableArm:obs[0].arm,tableProbe:obs[0].probe,wrongHeadOwnerVariation:length(sub(obs.at(-1).bodyInHead,obs[0].bodyInHead)),zeroExtension:obs[0].extension,endExtension:obs.at(-1).extension});
   }
  }else{
   const d=env.json('latheInspectionGeometry()'),head=material(kind,'head',state);check(caseId+' lathe bar/head origin',d.head,head.origin);
   for(const key of ['side','top']){if(!d[key].valid){rows.push({caseId,key,valid:false,reason:d[key].reason});continue;}
    const obs=d[key].samples.map(s=>{const at={...d.zStart,Z:d.zStart.Z+(d.zEnd.Z-d.zStart.Z)*s.t},turret=material(kind,'table',at),tool=material(kind,'head',at);return {t:s.t,arm:local(turret,s.body),probe:direction(turret,s.probe),barInHead:local(tool,d.head),extension:s.extension};});
    for(const s of obs){check(caseId+' '+key+' fixed turret arm '+s.t,s.arm,obs[0].arm);check(caseId+' '+key+' fixed turret probe '+s.t,s.probe,obs[0].probe);check(caseId+' '+key+' fixed spindle origin '+s.t,s.barInHead,[0,0,0]);}
    check(caseId+' '+key+' start extension',obs[0].extension,.01);check(caseId+' '+key+' rear/top probe',direction(head,d[key].samples[0].probe),key==='side'?[0,0,-1]:[0,-1,0]);rows.push({caseId,key,valid:true,raw:d[key].microns,arm:obs[0].arm,probe:obs[0].probe,samples:obs.length});
   }
   const baseline=JSON.stringify(d);env.read('var ownershipSavedGeometry=createGeometry;createGeometry=()=>{throw new Error("measurement touched visual-only geometry");};');assert.equal(JSON.stringify(env.json('latheInspectionGeometry()')),baseline,'lathe inspection does not read tailstock/model geometry');env.read('createGeometry=ownershipSavedGeometry;');
  }
 }
 // Separate real model motion from the measurement's intentional remounting.
 env.read(`levelConfig.width=${dimensions.width};levelConfig.depth=${dimensions.depth};machineProfile=null;positions={X:0,Y:0,Z:0,A:0,C:0};supportHeights=supports.map(()=>0);updateLeveling(false);`);
 const baseline=env.json('(()=>{const g=createGeometry(current);return g.labels.map(l=>({name:l.name,p:displayedModelPoint(l.p,l.axes,current,positions,l.pose)}));})()');
 const expected=kind==='horizontal'?{'コラム':['X'],'主軸頭':['X','Y'],'パレット台':['Z'],'パレット':['Z']}:{'主軸台':[],'テストバー':[],'心押台':[],'往復台':['Z'],'Xスライド':['X','Z'],'タレット':['X','Z'],'工具ホルダ':['X','Z'],'工具':['X','Z']};
 for(const axis of kind==='horizontal'?['X','Y','Z']:['X','Z']){
  env.read(`positions={X:0,Y:0,Z:0,A:0,C:0};positions.${axis}=40;updateLeveling(false);`);const moved=env.json('(()=>{const g=createGeometry(current);return g.labels.map(l=>({name:l.name,p:displayedModelPoint(l.p,l.axes,current,positions,l.pose)}));})()');
  for(const [name,moving] of Object.entries(expected)){const a=baseline.find(l=>l.name===name),b=moved.find(l=>l.name===name);assert.ok(a&&b,'named actual model member exists: '+name);const delta=sub(b.p,a.p),nominal=kind==='horizontal'?{X:[.22,0,0],Y:[0,.12,0],Z:[0,0,.18]}:{X:[0,0,.14],Z:[.28,0,0]};check(kind+' actual labelled model '+name+' '+axis,delta,moving.includes(axis)?nominal[axis]:[0,0,0]);motion.push({kind,name,axis,delta,expected: moving.includes(axis)?nominal[axis]:[0,0,0]});}
 }
}
const files=['app.js','accuracy-ui.js','reference-measurement-ui.js','horizontal-parallelism-ui.js','lathe-inspection-ui.js','spindle-sweep-ui.js'],result={stage,root,states:2*2*4*3*2,checks:checks.length,maximumResidualNorm:maximumLocalError,residualUnits:"metres for positions; dimensionless for unit directions",failures,sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync('src/'+f)).digest('hex')])),method:'Inverse coordinates from transformed material points; no production transport helper or owner string supplies expected ownership.',motion,rows};fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({stage,states:result.states,checks:result.checks,maximumResidualNorm:maximumLocalError,residualUnits:"metres for positions; dimensionless for unit directions",failures},null,2));if(failures.length)process.exitCode=1;

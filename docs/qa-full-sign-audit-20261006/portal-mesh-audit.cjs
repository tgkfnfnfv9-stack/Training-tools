'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const make=require('../../tests/leveling-dom-env.cjs'),MA=require('../../src/machine-accuracy.js');
const e=make({pureLeveling:true});
const options={helper:process.env.PORTAL_AUDIT_HELPER||'displayedModelPoint',output:process.env.PORTAL_AUDIT_OUTPUT||'tmp/z-audit/portal-mesh-results.json'};
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]),norm=a=>Math.hypot(...a),unit=a=>a.map(v=>v/norm(a)),average=ps=>[0,1,2].map(i=>ps.reduce((s,p)=>s+p[i]/ps.length,0));
const result={sourceSHA256:crypto.createHash('sha256').update(fs.readFileSync('index.html')).digest('hex'),helper:options.helper,checks:0,failures:[],cases:[],maxDirectionError:0,maxPivotShift:0,maxRigidDistanceError:0,maxUnchangedBoneError:0,fixtureDescription:'Both portal machines; independent signed intrinsic fixtures, support A ±.01mm plus planar/twist supports, Z=-100,0,100; exaggeration off/on. Real mesh end-ring centers define spindle direction; unchanged old physical transform defines the pivot and rigid distances.'};
const check=(name,fn)=>{result.checks++;try{fn();}catch(error){result.failures.push({name,error:error.message});}};
function near(a,b,t=1e-8){if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a-b)>t)throw new Error(`${a} != ${b}, tolerance ${t}`);}
function vectorNear(a,b,t=1e-8){a.forEach((v,i)=>near(v,b[i],t));}
const baselineCall="levelMappedBodyVisualPoint(displayTransformedPoint(p,axes,current,positions,pose),pose)";
// Exercise the same final part pipeline used by Canvas.
const newCall=`${options.helper}(p,axes,current,positions,pose)`;
function parts(ps,axes,pose,newer=true){return e.json(`(${JSON.stringify(ps)}).map(p=>{const axes=${JSON.stringify(axes)},pose=${JSON.stringify(pose)};return ${newer?newCall:baselineCall};})`);}
function snapshot(){return e.json(`({pairs:levelGeometry.pairs,directions:levelGeometry.directions,lean:levelGeometry.bodyLean,record:levelRecord(),dial:spindleSweepGeometry().cardinal.map(p=>({valid:p.valid,onTable:p.onTable,readingMicrons:p.readingMicrons,contact:p.contact}))})`);}
const noHelper=e.read(`typeof ${options.helper}==='undefined'`);
if(noHelper){console.log(JSON.stringify({pending:true,message:'Portal helper is not present yet.',helper:options.helper}));process.exit(2);}
for(const index of [3,4]){
 e.storage.clear();e.read(`openMachine(machines[${index}]);`);const kind=e.read('current.kind'),supports=e.json('supports.map(s=>levelCoordinates(s.x,s.z))');
 const profileFixtures=[{name:'none',profile:null},...['XZ','YZ','XY'].flatMap(pair=>[-1,1].map(sign=>{const p=MA.generate('used',78129,['X','Y','Z'],supports.length);Object.values(p.squareness).forEach(q=>q.microns=0);p.squareness[pair].microns=sign*10;p.initialHeights=supports.map(()=>0);return{name:`pure-${pair}-${sign>0?'plus':'minus'}-10um`,profile:p};}))];
 const heights=[{name:'flat',heights:supports.map(()=>0)},...[-1,1].flatMap(sign=>[{name:`A-${sign>0?'plus':'minus'}`,heights:supports.map((p,i)=>i===0?sign*.01:0)},{name:`twist-${sign>0?'plus':'minus'}`,heights:supports.map(p=>sign*.02*p.x*p.z)},{name:`plane-${sign>0?'plus':'minus'}`,heights:supports.map(p=>sign*(.01*p.x-.015*p.z))}])];
 for(const pf of profileFixtures)for(const h of heights)for(const exaggerated of [false,true]){
  e.read(`machineProfile=${JSON.stringify(pf.profile)};machineReference=null;supportHeights=${JSON.stringify(h.heights)};$('exaggerate').checked=${exaggerated};accuracyKey='';accuracyRangeKey='';visualReferenceKey='';positions={X:37,Y:-23,Z:0,A:0,C:0};updateLeveling(false);`);
  for(const Z of [-100,0,100]){
   e.read(`positions.Z=${Z};updateLeveling(false);`);const name=`${kind}/${pf.name}/${h.name}/exaggerated=${exaggerated}/Z=${Z}`,before=snapshot(),model=e.json('createGeometry(current)'),gz=e.read('current.columnZ??0'),keys=kind==='gantry'?['X','Y','Z']:['Y','Z'];
   const nose=[.15,1.91,gz-.23],oldNose=parts([nose],keys,'tool',false)[0],newNose=parts([nose],keys,'tool',true)[0];
   const pivotError=norm(sub(newNose,oldNose));result.maxPivotShift=Math.max(result.maxPivotShift,pivotError);check(name+' tool nose pivot fixed',()=>near(pivotError,0,2e-9));
   const rings=model.faces.filter(f=>f.pose==='tool'&&f.axes.includes('Z')&&f.v.length===20&&f.v.every(p=>Math.abs(p[1]-f.v[0][1])<1e-10));
   const lower=rings.find(f=>Math.abs(f.v[0][1]-1.91)<1e-8),upper=rings.find(f=>Math.abs(f.v[0][1]-2.51)<1e-8);
   check(name+' actual cylinder end rings present',()=>{if(!lower||!upper)throw new Error('Missing lower/upper spindle ring');});
   const lo=average(parts(lower.v,lower.axes,lower.pose)),hi=average(parts(upper.v,upper.axes,upper.pose)),actual=unit(sub(hi,lo));
   // Independent Gram construction from the three configured microradian
   // angles, then apply the already unchanged support frame. No call to the
   // helper's internal direction or rotation implementation is an oracle.
   const factor=e.read('displayFactor()'),sq=pf.profile?.squareness,xy=(sq?.XY.microns||0)/300000*factor,xz=(sq?.XZ.microns||0)/300000*factor,yz=(sq?.YZ.microns||0)/300000*factor,yx=-Math.sin(xy),yy=Math.cos(xy),zx=-Math.sin(xz),zy=(-Math.sin(yz)-zx*yx)/yy,zz=Math.sqrt(1-zx*zx-zy*zy);
   // Portal nominal axes are X=back, Y=right, Z=up.
   const intrinsic=[zy,zz,zx],expected=unit(e.json(`displayAxisFrame('Z').rotate(${JSON.stringify(intrinsic)})`)),directionError=norm(sub(actual,expected));result.maxDirectionError=Math.max(result.maxDirectionError,directionError);check(name+' actual mesh spindle follows independent signed Z direction',()=>near(directionError,0,2e-8));
   if(!exaggerated)check(name+' nonexaggerated mesh matches measurement spindle axis',()=>vectorNear(actual,unit(e.json('spindleSweepGeometry().measurement.axis')),2e-8));
   check(name+' rendered nose ring center matches fixed pivot',()=>vectorNear(lo,newNose,2e-8));
   const faces=model.faces.filter(f=>f.pose==='tool'&&f.axes.includes('Z'));
   let rigidError=0;
   for(const face of faces){const old=parts(face.v,face.axes,face.pose,false),now=parts(face.v,face.axes,face.pose,true);for(let i=0;i<old.length;i++){const j=(i+1)%old.length;rigidError=Math.max(rigidError,Math.abs(norm(sub(now[i],now[j]))-norm(sub(old[i],old[j]))));}if(old.length>3)rigidError=Math.max(rigidError,Math.abs(norm(sub(now[0],now[2]))-norm(sub(old[0],old[2]))));}
   result.maxRigidDistanceError=Math.max(result.maxRigidDistanceError,rigidError);check(name+' every ram/spindle mesh face retains rigid edge distances',()=>near(rigidError,0,2e-8));
   // Every unchanged bone, work piece and support retains its exact old
   // transformed vertices; therefore shared column feet and beam seating
   // points keep their previous locations and incidences.
   let boneError=0;
   for(const face of model.faces.filter(f=>!(f.pose==='tool'&&f.axes.includes('Z')))){const old=parts(face.v,face.axes,face.pose,false),now=parts(face.v,face.axes,face.pose,true);old.forEach((p,i)=>boneError=Math.max(boneError,norm(sub(p,now[i]))));}
   result.maxUnchangedBoneError=Math.max(result.maxUnchangedBoneError,boneError);check(name+' all column beam bed work and support vertices unchanged',()=>near(boneError,0,1e-10));
   const after=snapshot();check(name+' all calculations dial values and saved state unchanged by drawing',()=>{if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Drawing mutated numerical or saved state');});
   result.cases.push({kind,fixture:pf.name,support:h.name,exaggerated,Z,factor,nose:oldNose,actualZ:actual,oracleZ:expected,directionError,pivotError,rigidError,boneError,positivePairValues:before.pairs.map(p=>({key:p.key,microns:p.deviationMicroradians*.3}))});
  }
 }
}
fs.mkdirSync(path.dirname(options.output),{recursive:true});
fs.writeFileSync(options.output,JSON.stringify(result));
console.log(JSON.stringify({sourceSHA256:result.sourceSHA256,cases:result.cases.length,checks:result.checks,failures:result.failures,maxDirectionError:result.maxDirectionError,maxPivotShift:result.maxPivotShift,maxRigidDistanceError:result.maxRigidDistanceError,maxUnchangedBoneError:result.maxUnchangedBoneError}));
if(result.failures.length)process.exitCode=1;

'use strict';
// This audit checks indicator polarity from actual probe extension, independently
// of the older sign tables and test expectations. It does NOT certify that an
// authored fixture is the fixture the user intended. See the separate YZ audit.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]||'.'),output=path.resolve(process.argv[3]||'docs/qa-yz-sign-recheck-20261010/all-measurements.json');process.chdir(root);
const P=require(path.join(root,'src/reference-measurement.js')),C=require(path.join(root,'src/horizontal-parallelism.js')),L=require(path.join(root,'src/lathe-inspection.js')),S=require(path.join(root,'src/spindle-sweep.js')),I=require(path.join(root,'src/intrinsic-inspection.js')),LV=require(path.join(root,'src/leveling.js'));
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,k)=>a.map(v=>v*k),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),unit=a=>mul(a,1/Math.hypot(...a));
const checks=[],rows=[],setups=[],failures=[];let maximumError=0;
function check(name,actual,expected,tolerance=3e-8){const error=Math.abs(actual-expected);maximumError=Math.max(maximumError,error);checks.push({name,actual,expected,error});if(!Number.isFinite(actual)||error>tolerance)failures.push({name,actual,expected,error});}
// Independent contact: search for a zero of the physical signed plane distance
// or radial distance. No production contact or production sign helper is used.
function bisect(f){let lo=0,hi=.02,flo=f(lo);assert.ok(flo*f(hi)<=0,'contact bracket');for(let j=0;j<65;j++){const mid=(lo+hi)/2;if(flo*f(mid)<=0)hi=mid;else{lo=mid;flo=f(mid);}}return (lo+hi)/2;}
const plane=p=>bisect(t=>dot(sub(add(p.body,mul(p.probe,t)),p.point),p.normal));
const cylinder=(p,bar)=>bisect(t=>{const q=sub(add(p.body,mul(p.probe,t)),bar.origin),along=dot(q,bar.axis);return Math.hypot(...sub(q,mul(bar.axis,along)))-bar.radius;});
const text=value=>{const a=Math.floor(Math.abs(value)+.5);return a?`${value<0?'-':'+'}${a}`:'0';};
// Explicit minimal counterexamples: the plane rises 5 um toward a downward
// probe => +5; recedes => -5. Body advancing along its probe has the same sign.
for(const normal of [[0,1,0],[1,0,0],[0,0,1],unit([1,2,3])])for(const um of [-5,5]){
 const start={point:[0,0,0],normal,body:mul(normal,.01),probe:mul(normal,-1)};
 for(const moved of ['master','body']){
  const end={...start,...(moved==='master'?{point:mul(normal,um/1e6)}:{body:mul(normal,.01-um/1e6)})};
  check(`plane ${normal} ${moved} approaches ${um} um`,P.compare(start,end).microns,um);
 }
 const first=[0,0,0],last=mul(normal,um/1e6);check(`lathe moving plane approaches ${um} um ${normal}`,L.planeScan(first,last,normal,normal),um);
}
for(const outward of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0]])for(const um of [-5,5]){
 const bar={origin:[0,0,0],axis:[0,0,1],radius:.025,axialMin:-1,axialMax:1},first={body:mul(outward,.035),probe:mul(outward,-1)},last={...first,body:mul(outward,.035-um/1e6)};
 check(`horizontal exterior ${outward} body approaches ${um} um`,C.measure({...bar,samples:[first,last]}).microns,um);
 const a=L.cylinderContact(first.body,first.probe,bar.origin,bar.axis),b=L.cylinderContact(last.body,last.probe,bar.origin,bar.axis);check(`lathe exterior ${outward} body approaches ${um} um`,(a.extension-b.extension)*1e6,um);
}
for(const um of [-5,5]){
 const rise=um/1e6,sweep=S.measure({axis:[0,1,0],right:[1,0,0],tableNormal:[-rise/.15,1,0],radius:.15});
 check(`top sweep right contact rises ${um} um`,sweep.at(0).readingMicrons,um);check(`top sweep left contact rises ${-um} um`,sweep.at(180).readingMicrons,-um);
 const bore=L.bore(um/1e6,0);check(`internal bore screen right ${um} um makes right wall farther`,bore.readings[2],-2*um);
 check(`internal bore screen up ${um} um`,L.bore(0,um/1e6).readings[3]-L.bore(0,um/1e6).readings[1],2*um);
}
const bump=I.surface([0,0,0,0,5,0,0,0,0]);check('intrinsic centre bump above left zero is +5',bump.points[4].microns,5);check('runout is unsigned range',I.runout([3,4],[0,0]).rootMicrons,10);
for(const k of [-1,1]){
 const nodes=[[-1,-1],[1,-1],[-1,1],[1,1]].map(([x,z])=>({x,z,h:k*(.01*x+.02*z+.03*x*z)})),q=LV.solve(nodes);
 check('known support plane lr '+k,q.lr,.01*k);check('known support plane fb '+k,q.fb,.02*k);check('known support twist back minus front '+k,q.twist,.06*k);check('known support absolute residual '+k,q.residual,.03);
 const a=LV.impact(q,{span:1,offset:1});check('unsigned tilt example '+k,a.tiltOffsetMicrons,Math.hypot(10,20));check('unsigned twist example '+k,a.twistOffsetMicrons,60);check('unsigned straightness example '+k,a.straightnessMicrons,30);
 const frame=LV.orientation({lr:.01*k,fb:.02*k});assert.equal(Math.sign(frame.up[0]),-k,'right-high makes upright lean left');assert.equal(Math.sign(frame.up[2]),-k,'back-high makes upright lean front');
}
const env=require(path.join(root,'tests/leveling-dom-env.cjs'))({pureLeveling:true});
for(const f of ['intrinsic-inspection.js','lathe-inspection.js','lathe-inspection-ui.js'])env.read(fs.readFileSync('src/'+f,'utf8'));env.read('updateLatheInspectionUI=()=>{};');
for(const value of [-2.5,-.5,-.4999,0,.4999,.5,2.5])assert.equal(env.read(`squarenessMicronText(${value})`),text(value));
const ids=['vertical','horizontal','travel','gate','gantry','five','lathe'];
const states=[{X:0,Y:0,Z:0,A:0,C:0},{X:57,Y:43,Z:29,A:0,C:0}],patterns=['0','i===1?.01:0','i===1?-.01:0','.01*q.x*q.z','-.01*q.x*q.z'];
const signExpectations={vertical:{XY:['master',-1,'右','奥'],XZ:['body',-1,'右','下'],YZ:['body',-1,'奥','下']},horizontal:{XY:['body',1,'右','上'],XZ:['master',1,'右','手前'],YZ:['master',1,'上','手前']},travel:{XY:['body',1,'右','奥'],XZ:['body',-1,'右','下'],YZ:['body',-1,'奥','下']},gate:{XY:['body',1,'奥','右'],XZ:['body',-1,'奥','下'],YZ:['body',-1,'右','下']},gantry:{XY:['body',1,'奥','右'],XZ:['body',-1,'奥','下'],YZ:['body',-1,'右','下']},five:{XY:['master',-1,'右','奥'],XZ:['body',-1,'右','下'],YZ:['body',-1,'奥','下']}};
for(const id of ids){
 env.read(`openMachine(machines.find(m=>m.id==='${id}'));machineReference=null;machineSavedBest=null;`);
 for(const used of [false,true])for(let pattern=0;pattern<patterns.length;pattern++)for(let state=0;state<states.length;state++){
  env.read(`machineProfile=${used?"window.MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length)":'null'};positions=${JSON.stringify(states[state])};supportHeights=supports.map((p,i)=>{const q=levelCoordinates(p.x,p.z);return ${patterns[pattern]};});updateLeveling(false);`);
  const base={id,used,pattern,state};
  const geometry=env.json('geometryModel()');for(const pair of geometry.pairs){const a=geometry.directions.find(v=>v.key===pair.key[0]).direction,b=geometry.directions.find(v=>v.key===pair.key[1]).direction,expected=(Math.acos(dot(a,b))-Math.PI/2)*300000;check(`${id} ${pair.key} local angle opened-positive ${used} ${pattern} ${state}`,pair.deviationMicroradians*.3,expected);}
  if(used){const intrinsic=env.json('window.IntrinsicInspection.fromProfile(machineProfile)');for(const [key,mm] of [['rootMicrons',0],['tipMicrons',300]]){const q=intrinsic.runout,e=q.eccentricityMicrons.map((v,i)=>v+q.tiltMicroradians[i]*mm/1000),expected=2*Math.hypot(...e);check(`${id} ${key} unsigned TIR ${pattern} ${state}`,q[key],expected);}assert.ok(intrinsic.surface.rangeMicrons>=0);}
  if(id!=='lathe'){
   const scans=env.json('geometryModel().pairs.map(p=>({key:p.key,localAngleMicroradians:p.deviationMicroradians,physical:referenceScan(p),display:referenceDisplayScan(p)}))');
   for(const s of scans){
    const d=s.display,k=`${id} ${s.key} used${used} pattern${pattern} state${state}`;
    if(!used&&pattern===0&&state===0){setups.push({id,key:s.key,...d.setup,probe:d.start.probe,Snormal:d.start.normal});assert.deepEqual([d.setup.owner,d.setup.memberSign,d.setup.normalDirection,d.setup.relativeDirection],signExpectations[id][s.key]);}
    if(!d.valid){rows.push({...base,key:s.key,valid:false,reason:d.reason});continue;}
    const zero=plane(d.start),last=plane(d.end),expected=(zero-last)*1e6;check(k,d.microns,expected);
    const diagram=env.read(`referenceDiagram(${JSON.stringify(d)})`),normal=Number(/data-body-normal-m="([^"]+)"/.exec(diagram)[1]);check(k+' SVG physical normal',normal,dot(sub(d.end.body,d.end.point),d.end.normal),1e-12);
    rows.push({...base,key:s.key,valid:true,raw:d.microns,display:text(d.microns),independent:expected,zeroExtension:zero,lastExtension:last,localAngleMicroradians:s.localAngleMicroradians,start:d.start,end:d.end});
   }
  }
  if(id==='horizontal'){
   const h=env.json('horizontalParallelism()');for(const key of ['a','b']){const r=h[key];if(!r.valid){rows.push({...base,key,valid:false,reason:r.reason});continue;}const e0=cylinder(r.samples[0],h.bar),e1=cylinder(r.samples.at(-1),h.bar),expected=(e0-e1)*1e6;check(`horizontal ${key} ${used} ${pattern} ${state}`,r.microns,expected);rows.push({...base,key,valid:true,raw:r.microns,display:text(r.microns),independent:expected,zeroExtension:e0,lastExtension:e1});}
  }else if(id==='lathe'){
   const d=env.json('latheInspectionGeometry()');
   for(const key of ['side','top']){const r=d[key];if(!r.valid){rows.push({...base,key,valid:false,reason:r.reason});continue;}const bar=env.json('(()=>{const h=latheAssembly([-current.w*.24+.125,1.5,0],"tool");return {origin:h.point,axis:h.rotate([1,0,0]),radius:.025};})()'),e0=cylinder(r.samples[0],bar),e1=cylinder(r.samples.at(-1),bar),expected=(e0-e1)*1e6;check(`lathe ${key} ${used} ${pattern} ${state}`,r.microns,expected);rows.push({...base,key,valid:true,raw:r.microns,display:text(r.microns),independent:expected});}
   for(const key of ['face','flat']){
    const input=env.json(`(()=>{const d=latheInspectionGeometry(),k=window.LatheInspection.intrinsic(machineProfile),raw=${key==='face'?'[-.09,1.5,1]':'[.23,1.5,1.43]'},n=${key==='face'?'[-Math.cos(k.face),0,-Math.sin(k.face)]':'[Math.sin(k.flat),0,Math.cos(k.flat)]'},a=latheAssembly(raw,'work',d.${key==='face'?'xStart':'zStart'}),b=latheAssembly(raw,'work',d.${key==='face'?'xEnd':'zEnd'});return {p0:a.point,p1:b.point,n0:a.rotate(n),n1:b.rotate(n)};})()`);
    const body=add(input.p0,mul(input.n0,.01)),probe=mul(input.n0,-1),expected=(plane({point:input.p0,normal:input.n0,body,probe})-plane({point:input.p1,normal:input.n1,body,probe}))*1e6;check(`lathe ${key} ${used} ${pattern} ${state}`,d[key],expected);rows.push({...base,key,valid:true,raw:d[key],display:text(d[key]),independent:expected});
   }
   if(d.bore.valid){const c=[-d.dx/1e6,d.dy/1e6],walls=[[-1,0],[0,1],[1,0],[0,-1]].map(u=>{let lo=0,hi=.05;for(let i=0;i<65;i++){const m=(lo+hi)/2;if(Math.hypot(u[0]*m-c[0],u[1]*m-c[1])>.025)hi=m;else lo=m;}return (lo+hi)/2;});for(let i=0;i<4;i++){const expected=(walls[0]-walls[i])*1e6;check(`lathe bore ${i} ${used} ${pattern} ${state}`,d.bore.readings[i],expected);rows.push({...base,key:'bore-'+i,valid:true,raw:d.bore.readings[i],display:text(d.bore.readings[i]),independent:expected});}check('lathe bore dx projection',(d.bore.readings[2]-d.bore.readings[0])/2,d.dx);check('lathe bore dy projection',(d.bore.readings[3]-d.bore.readings[1])/2,d.dy);}
  }else{
   const sweep=env.json(`spindleSweepGeometry(positions,levelSolution,machineProfile,1,${id==='vertical'})`);if(sweep.valid){const m=sweep.measurement;const values=m.cardinal.map(p=>{const body=add(p.ringPoint,mul(m.axis,.01));return plane({point:[0,0,0],normal:sweep.tableNormal,body,probe:mul(m.axis,-1)});});for(let i=0;i<4;i++){const expected=(values[3]-values[i])*1e6;check(`${id} sweep ${i} ${used} ${pattern} ${state}`,m.cardinal[i].readingMicrons,expected);rows.push({...base,key:'sweep-'+i,valid:sweep.cardinal[i].onTable,raw:m.cardinal[i].readingMicrons,display:text(m.cardinal[i].readingMicrons),independent:expected});}}
  }
 }
}
const sourceFiles=['reference-measurement.js','reference-measurement-ui.js','horizontal-parallelism.js','horizontal-parallelism-ui.js','lathe-inspection.js','lathe-inspection-ui.js','spindle-sweep.js','spindle-sweep-ui.js','intrinsic-inspection.js','intrinsic-inspection-ui.js','accuracy-ui.js','machine-accuracy.js','leveling.js'];
const result={audit:'extension-polarity-and-authored-fixture-observations',warning:'Matching the authored fixture does not prove that its datum or ownership is the physical inspection requested by the user.',sourceHashes:Object.fromEntries(sourceFiles.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync('src/'+f)).digest('hex')])),states:ids.length*2*patterns.length*states.length,checks:checks.length,rows:rows.length,maximumErrorMicrons:maximumError,failures,setups,examples:checks.slice(0,50),observations:rows};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({states:result.states,checks:result.checks,rows:result.rows,maximumErrorMicrons:maximumError,failures},null,2));if(failures.length)process.exitCode=1;

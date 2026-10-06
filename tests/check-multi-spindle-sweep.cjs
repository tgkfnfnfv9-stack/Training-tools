'use strict';
// Independent extension oracle: sample the existing renderer with exaggeration
// disabled, fit its real table plane and footprint, then intersect a 150 mm
// spindle-normal ring. No production sweep helper supplies expected readings.
const assert=require('node:assert/strict');
const makeEnvironment=require('./leveling-dom-env.cjs');
const MachineAccuracy=require('../src/machine-accuracy.js');
let checks=0;const failures=[];
const check=(name,fn)=>{checks++;try{fn();}catch(e){failures.push(name+': '+e.message);}};
const near=(a,b,t=1e-7)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,`${a} != ${b}`);
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),unit=v=>v.map(q=>q/Math.hypot(...v));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const vn=(a,b,t=1e-7)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>near(v,b[i],t));};
const zero={X:0,Y:0,Z:0,A:0,C:0};
function model(env){return env.json(`(()=>{
 const m=current,kind=m.kind,five=kind==='five',portal=['double','gantry'].includes(kind),travel=kind==='travel';
 const tableHeight=five?1.56:travel?1.1:portal?1.12:1.16;
 const face=createGeometry(m).faces.find(f=>f.pose==='work'&&f.color==='#4c9b8b'&&f.v.every(p=>Math.abs(p[1]-tableHeight)<1e-12)&&f.v.length===(five?20:4));
 if(!face)throw new Error('independent table face absent '+kind);
 const map=(p,axes,pose)=>displayedModelPoint(p,axes,m,positions,pose);
 const vertices=face.v.map(p=>map(p,face.axes,'work'));
 const rawCentre=face.v.reduce((sum,p)=>sum.map((v,i)=>v+p[i]/face.v.length),[0,0,0]),centre=map(rawCentre,face.axes,'work');
 const radius=five?.65:0,basis=five?[[radius,0,0],[0,0,radius]].map(v=>map(rawCentre.map((q,i)=>q+v[i]),face.axes,'work').map((q,i)=>q-centre[i])):null;
 const rawNose=travel?[-.5,1.65,-.3]:portal?[.15,1.91,(m.columnZ??0)-.23]:five?[0,2.15,-.3]:[0,1.98,-.3];
 const axes=travel?['X','Y','Z']:kind==='gantry'?['X','Y','Z']:portal?['Y','Z']:['Z'];
 const nose=map(rawNose,axes,'tool');
 const body=intrinsicBodyFrame(axisConfig(m).filter(a=>['X','Y','Z'].includes(a.key)),machineProfile);
 // Infer the physical spindle axis from its actual rendered endpoints for
 // every supported machine, including the corrected portal Z mesh.
 const direction=substitute();
 function substitute(){return map(rawNose.map((q,i)=>q+(i===1?.3:0)),axes,'tool').map((q,i)=>q-nose[i]);}
 const right=levelGeometry.toolFrame.rotate(body.rotate([1,0,0]));
 return {vertices,centre,basis,nose,direction,right,five};
})()`);}
function oracle(m){
 let normal=unit(cross(sub(m.vertices[1],m.vertices[0]),sub(m.vertices[2],m.vertices[0])));if(normal[1]<0)normal=normal.map(v=>-v);
 const axis=unit(m.direction),right=unit(m.right.map((v,i)=>v-dot(m.right,axis)*axis[i])),back=unit(cross(right,axis));
 const offsets=[[1,0],[0,1],[-1,0],[0,-1]].map(([c,s])=>right.map((v,i)=>.15*(c*v+s*back[i])));
 const t=dot(normal,sub(m.centre,m.nose))/dot(normal,axis),centre=m.nose.map((v,i)=>v+t*axis[i]);
 const heights=offsets.map(p=>-dot(normal,p)/dot(normal,axis));
 const points=offsets.map((p,j)=>p.map((v,i)=>v+centre[i]+heights[j]*axis[i]));
 const uv=p=>{const u=m.five?m.basis[0]:sub(m.vertices[1],m.vertices[0]),v=m.five?m.basis[1]:sub(m.vertices[3],m.vertices[0]),d=sub(p,m.five?m.centre:m.vertices[0]);const uu=dot(u,u),vv=dot(v,v),uv=dot(u,v),du=dot(d,u),dv=dot(d,v),den=uu*vv-uv*uv;return [(du*vv-dv*uv)/den,(dv*uu-du*uv)/den];};
 return {axis,normal,points,readings:heights.map(h=>(h-heights[3])*1e6),inside:points.map(p=>{const q=uv(p);return m.five?dot(q,q)<=1+1e-9:q.every(v=>v>=-1e-9&&v<=1+1e-9);})};
}
const env=makeEnvironment({pureLeveling:true});
for(const kind of ['compact','travel','double','gantry','five']){
 env.read(`openMachine(machines.find(m=>m.kind==='${kind}'));`);env.registry.exaggerate.checked=false;
 const count=env.read('supports.length'),profile=MachineAccuracy.generate('used',78612,['X','Y','Z'],count);
 env.read(`machineProfile=${JSON.stringify(profile)};machineReference=null;`);
 check(kind+' used-profile fixture actually includes intrinsic error',()=>assert.deepEqual(env.json('machineProfile'),profile));
 for(const [i,state] of [zero,{...zero,X:100,Y:-100,Z:100,A:71,C:37},{...zero,X:-83,Y:94,Z:-100,A:-62,C:-71}].entries()){
  env.read(`positions=${JSON.stringify(state)};supportHeights=supports.map((s,i)=>[.025,-.012,.018,-.009,.005,-.011][i%6]);updateLeveling();`);
  const actual=env.json('spindleSweepGeometry()'),drawn=model(env),expected=oracle(drawn),tag=kind+'/'+i;
  check(tag+' supported and radius 150 mm',()=>{assert.equal(actual.valid,true);near(actual.measurement.radius,.15,0);});
  check(tag+' physical table centre and spindle nose match unexaggerated renderer',()=>{vn(actual.tableCentre,drawn.centre,2e-12);vn(actual.nose,drawn.nose,2e-12);});
  check(tag+' signed four readings match independent plane intersections',()=>vn(actual.cardinal.map(p=>p.readingMicrons),expected.readings,3e-7));
  check(tag+' table normal and representative spindle axis match model',()=>{vn(actual.tableNormal,expected.normal,1e-11);vn(actual.measurement.axis,expected.axis,1e-11);});
  check(tag+' finite footprint and contact points match renderer',()=>actual.cardinal.forEach((p,j)=>{vn(p.contact,expected.points[j],2e-11);assert.equal(p.onTable,expected.inside[j]);}));
  check(tag+' explicit state/solution/profile inputs are independent of live axis state',()=>{
   env.read('globalThis.sweepOracleState={...positions};globalThis.sweepOracleSolution=levelSolution;globalThis.sweepOracleProfile=machineProfile;positions={X:13,Y:-27,Z:42,A:-17,C:61};');
   assert.deepEqual(env.json('spindleSweepGeometry(sweepOracleState,sweepOracleSolution,sweepOracleProfile)'),actual);
   env.read('positions={...sweepOracleState};');
  });
  check(tag+' display settings do not enter readings or contact state',()=>{env.registry.exaggerate.checked=true;env.read('yaw=.83;sceneZoom=1.4;updateLeveling();');const changed=env.json('spindleSweepGeometry()');assert.deepEqual(changed,actual);env.registry.exaggerate.checked=false;env.read('updateLeveling();');});
 }
 env.read('positions={X:0,Y:0,Z:0,A:0,C:0};supportHeights=supports.map(()=>0);updateLeveling();');
 const base=env.json('spindleSweepGeometry().cardinal.map(p=>p.readingMicrons)');
 env.read('supportHeights=supports.map(s=>{const q=levelCoordinates(s.x,s.z);return .04+.017*q.x-.023*q.z;});updateLeveling();');
 check(kind+' common rigid seating plane cannot create relative error',()=>vn(env.json('spindleSweepGeometry().cardinal.map(p=>p.readingMicrons)'),base,2e-7));
 env.read('supportHeights=supports.map(()=>0);updateLeveling();');
 check(kind+' restoring supports restores readings exactly',()=>vn(env.json('spindleSweepGeometry().cardinal.map(p=>p.readingMicrons)'),base,1e-10));
}
// An ideal five-axis top tilted about X is y=-tan(A)*z. C rotates the
// material footprint, not the infinite plane, so it cannot change readings.
env.read("openMachine(machines.find(m=>m.kind==='five'));machineProfile=null;supportHeights=supports.map(()=>0);positions={X:0,Y:0,Z:0,A:50,C:0};updateLeveling();");env.registry.exaggerate.checked=false;
for(const C of [-100,-31,0,47,100]){
 env.read(`positions.C=${C};updateLeveling();`);
 check('five A/C analytic slope '+C,()=>vn(env.json('spindleSweepGeometry().cardinal.map(p=>p.readingMicrons)'),[-.15*Math.tan(.225)*1e6,-.3*Math.tan(.225)*1e6,-.15*Math.tan(.225)*1e6,0],2e-7));
}
// Independent physical ellipse oracle after deliberately unequal support
// scaling. C rotates the ellipse and can change contact validity, although
// its plane (and therefore numerical ideal readings) stays the same.
let partialFootprints=0;
for(const [width,depth] of [[.9,3],[3,.8]])for(const A of [0,65])for(const C of [0,25,50]){
 env.read(`levelConfig.width=${width};levelConfig.depth=${depth};positions={X:0,Y:0,Z:0,A:${A},C:${C}};supportHeights=supports.map(()=>0);updateLeveling();`);
 const expected=oracle(model(env)),actual=env.json('spindleSweepGeometry()');
 if(expected.inside.some(Boolean)&&expected.inside.some(v=>!v))partialFootprints++;
 check(`five anisotropic physical footprint ${width}/${depth}/${A}/${C}`,()=>{vn(actual.tableCentre,model(env).centre,2e-12);actual.cardinal.forEach((p,j)=>{vn(p.contact,expected.points[j],2e-11);assert.equal(p.onTable,expected.inside[j]);});});
 check(`five unequal scaling retains plane-based values ${width}/${depth}/${A}/${C}`,()=>vn(actual.cardinal.map(p=>p.readingMicrons),expected.readings,3e-7));
}
check('ellipse tests include both inside and outside contacts on one table',()=>assert.ok(partialFootprints>0));
for(const kind of ['horizontal','lathe']){env.read(`openMachine(machines.find(m=>m.kind==='${kind}'));`);check(kind+' remains unsupported',()=>{assert.equal(env.json('spindleSweepGeometry()').valid,false);assert.equal(env.registry.spindleSweepPanel.hidden,true);});}
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log(`PASS multi-machine spindle sweep independent physics: ${checks} checks`);

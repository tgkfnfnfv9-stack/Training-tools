const auditRepository=require('node:path').resolve(__dirname,'../..');
const assert=require('node:assert/strict'),fs=require('node:fs');
process.chdir(auditRepository);
const M=require(auditRepository+'/src/reference-measurement.js');
const env=require(auditRepository+'/tests/leveling-dom-env.cjs')({pureLeveling:true});
const out={checks:[],failures:[]};const check=(name,fn)=>{try{fn();out.checks.push(name)}catch(e){out.failures.push({name,error:e.message})}};const near=(a,b,t=1e-7)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<t,`${a} != ${b}`);
const plane={point:[0,0,0],normal:[1,0,0],body:[.01,0,0],probe:[-1,0,0]};
check('ideal',()=>near(M.compare(plane,{...plane,body:[.01,.3,0]}).microns,0));
for(const s of [-1,1])check('approach '+s,()=>near(M.compare(plane,{...plane,body:[.01-s*.00001,.3,0]}).microns,s*10));
const end={...plane,body:[.00999,.3,0]};
check('reverse endpoint and fresh zero',()=>near(M.compare(end,plane).microns,-10));
check('opposite side',()=>near(M.compare({...plane,body:[-.01,0,0],normal:[-1,0,0],probe:[1,0,0]},{...plane,body:[-.01001,.3,0],normal:[-1,0,0],probe:[1,0,0]}).microns,-10));
check('parallel invalid',()=>assert.equal(M.compare(plane,{...end,probe:[0,1,0]}).valid,false));
check('out of range invalid',()=>assert.equal(M.compare(plane,{...end,body:[.03,.3,0]}).valid,false));
const tr=v=>[v[2]+2,v[0]-3,v[1]+5],rot=v=>[v[2],v[0],v[1]],pose=q=>({point:tr(q.point),body:tr(q.body),normal:rot(q.normal),probe:rot(q.probe)});
check('common rigid motion',()=>near(M.compare(pose(plane),pose(end)).microns,10,1e-6));
check('independent polynomial quadrature',()=>{const r=M.integrate(t=>[t*t,1,0],.3);assert(r.valid);near(r.value[0],.1);near(r.value[1],.3)});
const kinds=['compact','horizontal','travel','double','gantry','five','lathe'];
for(const kind of kinds){env.read(`openMachine(machines.find(m=>m.kind==='${kind}'));supportHeights=supports.map(()=>0);machineProfile=null;positions={X:0,Y:0,Z:0,A:0,C:0};updateLeveling();`);const pairs=env.json('levelGeometry.pairs.map(p=>p.key)');
for(const pair of pairs){for(const v of [0,-30,30]){env.read(`machineProfile={squareness:Object.fromEntries(${JSON.stringify(pairs)}.map(k=>[k,{microns:k==='${pair}'?${v}:0}]))};levelSolution=machineSolution(supportHeights);`);const result=env.json(`referenceScan({key:'${pair}'})`);const master=(kind==='compact'||kind==='five')&&pair==='XY'||kind==='horizontal'&&(pair==='XZ'||pair==='YZ');const expected=(master?-1:1)*Math.sin(v/300000)*300000;check(kind+'/'+pair+'/'+v,()=>{assert(result.valid,result.reason);near(result.microns,expected,1e-5)});}
}
}
fs.writeFileSync(__dirname+'/math.json',JSON.stringify(out,null,2));console.log(JSON.stringify({checks:out.checks.length,failures:out.failures}));

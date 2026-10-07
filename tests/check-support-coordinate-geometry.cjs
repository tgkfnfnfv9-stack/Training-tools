'use strict';
// Geometric oracle: plane and saddle derivatives come from h=a*x+b*z+c
// and h=k*x*z, independently of renderer vectors and measurement sign tables.
const assert=require('node:assert/strict'),environment=require('./leveling-dom-env.cjs');
const env=environment({pureLeveling:true});let checks=0;
const near=(a,b,t=1e-9)=>{assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);checks++;};
for(let index=0;index<7;index++){
 env.storage.clear();env.read(`openMachine(machines[${index}]);`);
 const data=env.json('({kind:current.kind,supports,vertices:createGeometry(current).faces.filter(f=>f.pose===\'bed\'&&f.color===\'#80949c\').flatMap(f=>f.v)})');
 for(const p of data.supports){assert.ok(data.vertices.some(v=>Math.abs(v[0]-p.x)<1e-10&&Math.abs(v[2]-p.z)<1e-10),`${data.kind}: missing support vertex ${p.x},${p.z}`);checks++;}
 for(const [a,b,c] of [[.03,0,.1],[-.03,.02,0],[0,-.04,-.1]]){
  env.read(`supportHeights=supports.map(s=>{const p=levelCoordinates(s.x,s.z);return ${a}*p.x+${b}*p.z+${c};});updateLeveling(false);`);
  const values=env.json('supports.map(s=>{const p=levelCoordinates(s.x,s.z),surface=structuralSurface(p.x,p.z);return {...p,h:surface.heightAt(p.x,p.z),slope:surface.slopeAt(p.x,p.z)};})');
  for(const p of values){near(p.h,a*p.x+b*p.z+c);near(p.slope.lr,a);near(p.slope.fb,b);}
 }
 // Three points define a plane; compact uses a separately tested bending law;
 // fixed portal separates its nine bed points and three-point column seats.
 if(['horizontal','travel','gantry','lathe'].includes(data.kind))for(const k of [-.08,.08]){
  env.read(`supportHeights=supports.map(s=>{const p=levelCoordinates(s.x,s.z);return ${k}*p.x*p.z;});updateLeveling(false);`);
  const samples=env.json('createGeometry(current).faces.filter(f=>f.pose===\'bed\'&&f.color===\'#80949c\').flatMap(f=>f.v).map(p=>{const q=levelCoordinates(p[0],p[2]),s=levelSolution.slopeAt(q.x,q.z);return {...q,y:p[1],v:levelBodyVisualPoint(p,\'bed\'),h:levelSolution.heightAt(q.x,q.z),s};})');
  const [factor,clearance]=env.json('[displayFactor(),displayClearance()]');
  for(const p of samples){
   near(p.h,k*p.x*p.z);near(p.s.lr,k*p.z);near(p.s.fb,k*p.x);
   const raw=[-factor*k*p.z/1000,1,-factor*k*p.x/1000],norm=Math.hypot(...raw),normal=raw.map(v=>v/norm),top=[p.x,.66+clearance+factor*k*p.x*p.z/1000,p.z];
   top.forEach((v,i)=>near(p.v[i],v+(p.y-.66)*normal[i]));
  }
 }
 if(data.kind==='five'){assert.equal(env.registry.twistPreset.disabled,true);checks++;}
}
// Raising only the portal seats leaves the central bed's structural surface flat.
// Its colour and drawn height must both use that bed surface, not a 15-point blend.
env.storage.clear();env.read('openMachine(machines[3]);supportHeights=supports.map(s=>s.group===\'bed\'?0:.2);updateLeveling(false);');
const central=env.json('levelSurfaceFaces(current).filter(f=>f.v.every(p=>Math.abs(p[0])<.77))');
assert.ok(central.length);for(const face of central)near(face.height,0);
const spans=env.json('[Math.max(...supports.map(s=>s.x))-Math.min(...supports.map(s=>s.x)),Math.max(...supports.map(s=>s.z))-Math.min(...supports.map(s=>s.z)),levelConfig.width,levelConfig.depth]');
[2.845,6.36,2.85,6.84].forEach((v,i)=>near(spans[i],v));
console.log(`Support coordinate geometry: ${checks} independent comparisons passed (mesh stations, planes, signed saddles, portal bed colours, three-point restriction, dimensions).`);

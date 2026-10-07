'use strict';
// Independent ideal direction expectations from the moving assemblies' mechanical description.
// No direction expectation is imported from axisConfig, geometryModel, or a drawing sign table.
const assert=require('node:assert/strict');
const {read,json,storage}=require('../../tests/leveling-dom-env.cjs')({pureLeveling:true});
const expected=[{X:[1,0,0],Y:[0,0,1],Z:[0,1,0]},{X:[1,0,0],Y:[0,1,0],Z:[0,0,1]},{X:[1,0,0],Y:[0,0,1],Z:[0,1,0]},{X:[0,0,1],Y:[1,0,0],Z:[0,1,0]},{X:[0,0,1],Y:[1,0,0],Z:[0,1,0]},{X:[1,0,0],Y:[0,0,1],Z:[0,1,0]},{X:[0,0,1],Z:[1,0,0]}];
const results=[];
for(let i=0;i<7;i++){
 storage.clear();read(`openMachine(machines[${i}]);supportHeights=supportHeights.map(()=>0);$('exaggerate').checked=false;positions={X:0,Y:0,Z:0,A:0,C:0};updateLeveling(false);`);
 for(const [key,want] of Object.entries(expected[i])){
  const groups=json(`createGeometry(current).faces.filter(f=>f.axes.includes('${key}')).map(f=>({p:f.v[0],axes:f.axes,pose:f.pose}))`);
  const unique=Array.from(new Map(groups.map(g=>[JSON.stringify([g.axes,g.pose]),g])).values());
  for(const g of unique){
   const expr=`displayedModelPoint(${JSON.stringify(g.p)},${JSON.stringify(g.axes)},current,positions,${JSON.stringify(g.pose)})`;
   read(`positions.${key}=0;updateLeveling(false);`);const a=json(expr);
   read(`positions.${key}=1;updateLeveling(false);`);const b=json(expr);
   const delta=b.map((v,j)=>v-a[j]),norm=Math.hypot(...delta),unit=delta.map(v=>v/norm);
   assert(norm>0&&Math.hypot(...unit.map((v,j)=>v-want[j]))<1e-8);
   results.push({machine:read('current.id'),axis:key,pose:g.pose,group:g.axes,delta});
   read(`positions.${key}=0;updateLeveling(false);`);
  }
 }
}
// Independent plane equation: y = k*x + m*z, vertical spindle.
// At front z=-r the height is -m*r, so right/front difference is r*(k+m).
const Sweep=require('../../src/spindle-sweep.js'),r=.15;
const sweeps=[];
for(const [k,m] of [[0,0],[1e-4,2e-4],[-1e-4,-2e-4]]){
 const result=Sweep.measure({axis:[0,1,0],tableNormal:[-k,1,-m],right:[1,0,0],radius:r});
 const want=[r*(k+m)*1e6,2*r*m*1e6,r*(-k+m)*1e6,0];
 assert(result.valid);result.cardinal.forEach((v,i)=>assert(Math.abs(v.readingMicrons-want[i])<1e-9));
 sweeps.push({slope:[k,m],expected:want,actual:result.cardinal.map(q=>q.readingMicrons)});
}
console.log(JSON.stringify({idealMovingGroupChecks:results.length,results,independentSweepPlaneChecks:sweeps},null,2));

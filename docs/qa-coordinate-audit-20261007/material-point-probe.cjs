const e=require('../../tests/leveling-dom-env.cjs')({pureLeveling:true});const {read,json,storage}=e;
const out=[];
for(const i of [1,5]){
 storage.clear();read(`openMachine(machines[${i}]);$('exaggerate').checked=false;supportHeights=supports.map(p=>.2*p.x/(current.w*.4)*p.z/(current.d*.4));positions={X:0,Y:0,Z:0,A:0,C:0};updateLeveling(false);`);
 const pair=i===1?'XZ':'XY';read(`globalThis.m=referenceScan(levelGeometry.pairs.find(p=>p.key==='${pair}'));`);
 const m=json('m');const axis=m.setup.scan;
 const raw=i===1?[0,1.27,-.85]:[0,1.56,-.45],axes=i===1?['Z']:['X','Y','A','C'];
 const points=[];
 for(const p of [m.startPosition,m.endPosition]){
  read(`positions.${axis}=${p}/Math.hypot(levelCoordinates(axisConfig(current).find(a=>a.key==='${axis}').vector[0]*axisConfig(current).find(a=>a.key==='${axis}').amp,axisConfig(current).find(a=>a.key==='${axis}').vector[2]*axisConfig(current).find(a=>a.key==='${axis}').amp).x,axisConfig(current).find(a=>a.key==='${axis}').vector[1]*axisConfig(current).find(a=>a.key==='${axis}').amp,levelCoordinates(axisConfig(current).find(a=>a.key==='${axis}').vector[0]*axisConfig(current).find(a=>a.key==='${axis}').amp,axisConfig(current).find(a=>a.key==='${axis}').vector[2]*axisConfig(current).find(a=>a.key==='${axis}').amp).z)*100;updateLeveling(false);`);
  points.push(json(`displayedModelPoint(${JSON.stringify(raw)},${JSON.stringify(axes)},current,positions,'work')`));
 }
 const delta=points[1].map((v,j)=>v-points[0][j]);
 const dot=(a,b)=>a.reduce((s,v,j)=>s+v*b[j],0);const rayLength=dot(m.end.normal,delta.map((v,j)=>v-m.end.body[j]))/dot(m.end.normal,m.end.probe);const rigidPointReading=(.01-rayLength)*1e6;
 out.push({rigidPointReading,machine:read('current.id'),pair,heights:json('supportHeights'),range:[m.startPosition,m.endPosition],raw,referenceTravel:m.end.point,modelMaterialPointTravel:delta,differenceMicrons:delta.map((v,j)=>(v-m.end.point[j])*1e6),reading:m.microns});
}
console.log(JSON.stringify(out,null,2));

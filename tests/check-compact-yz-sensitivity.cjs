'use strict';
const assert=require('node:assert/strict');
const e=require('./leveling-dom-env.cjs')({pureLeveling:true});
e.read(`openMachine(machines[0]);levelConfig.width=2.08;levelConfig.depth=2.16;levelConfig.columnX=0;levelConfig.columnZ=0;positions={X:0,Y:0,Z:0,A:0,C:0};machineProfile={initialHeights:[0,0,0,0],guides:{},squareness:{XY:{microns:0},XZ:{microns:0},YZ:{microns:12}}}`);
const sweep=[];
for(const shift of [.4,0,-.4]){
 e.read(`supportHeights=supports.map(p=>${shift}*p.z/1.08+.05*p.x*p.z/(1.04*1.08));updateLeveling()`);
 sweep.push(e.json(`({frontBackShift:${shift},heights:supportHeights,columnFrontMicroradians:levelGeometry.bodyLean.front,YUpMicroradians:Math.atan2(levelGeometry.directions.find(a=>a.key==='Y').direction[1],levelGeometry.directions.find(a=>a.key==='Y').direction[2])*1e6,finiteYZ:referenceScan({key:'YZ'}).microns})`));
}
assert.ok(sweep[0].columnFrontMicroradians>0&&sweep[2].columnFrontMicroradians<0);
assert.ok(sweep.every(q=>Math.abs(q.finiteYZ-sweep[0].finiteYZ)<1e-8));
const endpoints=[];
for(const pos of [[0,0],[100,100],[-100,-100],[100,-100],[-100,100]]){
 e.read(`positions.X=${pos[0]};positions.Y=${pos[1]}`);
 let min={value:Infinity},max={value:-Infinity};
 for(let mask=0;mask<16;mask++){
  e.read(`supportHeights=${JSON.stringify(Array.from({length:4},(_,i)=>(mask>>i&1)?.5:-.5))};updateLeveling()`);
  const v=e.json(`({value:referenceScan({key:'YZ'}).microns,heights:supportHeights})`);
  if(v.value<min.value)min=v;if(v.value>max.value)max=v;
 }
 endpoints.push({positions:pos,min,max});
}
assert.ok(endpoints[0].max.value<0);
assert.ok(endpoints.slice(1).every(q=>q.min.value<0&&q.max.value>0));
console.log(JSON.stringify({scope:'16 support endpoint combinations per position; not a proof of global extrema',sweep,endpoints},null,2));

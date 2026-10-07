'use strict';
// Independent review of the chosen actual-scale compact 3D representation.
// Model vertices/material-point displacement are compared to physical guide
// vectors, with position and dimension extremes; no diagram sign is an oracle.
const assert=require('node:assert/strict');
const env=require('./leveling-dom-env.cjs')({pureLeveling:true});
env.read('openMachine(machines[0]);');
const unit=v=>v.map(q=>q/Math.hypot(...v)),delta=(a,b)=>a.map((v,i)=>v-b[i]),distance=(a,b)=>Math.hypot(...delta(a,b));
let cases=0,axisChecks=0,maxDirectionError=0;
for(const [width,depth] of [[2.08,2.16],[.5,.5],[.5,20],[20,.5],[20,20]])for(const sign of [-1,1]){
 env.read(`levelConfig.width=${width};levelConfig.depth=${depth};levelConfig.columnX=${sign*100};levelConfig.columnZ=${sign*-100};supportHeights=[${sign*.5},${-sign*.49},${sign*.18},${-sign*.2}];machineProfile={guides:{},initialHeights:supports.map(()=>0),squareness:{XY:{microns:33},XZ:{microns:75},YZ:{microns:-15}}};`);
 let fixedColumn;
 for(const edge of [-100,0,100]){
  const state={X:edge,Y:-edge,Z:edge,A:0,C:0};let measurement,model;
  for(const exaggerated of [false,true]){
   const set=s=>env.read(`positions=${JSON.stringify(s)};$('exaggerate').checked=${exaggerated};updateLeveling();`);set(state);
   assert.equal(env.json('displayFactor()'),1,'compact 3D must remain actual scale');
   const points=env.json(`(()=>{const r=createGeometry(current).references.find(q=>q.pose==='tool');return [r.base,r.tip].map(p=>displayedModelPoint(p,r.axes,current,positions,r.pose));})()`);
   if(!fixedColumn)fixedColumn=points;
   for(let i=0;i<2;i++)assert.ok(distance(points[i],fixedColumn[i])<1e-10,'fixed column changed with table/head translation');
   const currentMeasurement=env.json(`['XY','XZ','YZ'].map(key=>referenceScan({key}))`);
   if(measurement)assert.deepEqual(currentMeasurement,measurement,'diagram emphasis changed measurement');else measurement=currentMeasurement;
   const currentModel=env.json(`({column:createGeometry(current).references.map(r=>[r.base,r.tip].map(p=>displayedModelPoint(p,r.axes,current,positions,r.pose))),P:compactTablePathPoint()})`);
   if(model)assert.deepEqual(currentModel,model,'diagram emphasis changed compact 3D');else model=currentModel;
   for(const axis of ['X','Y','Z']){
    set(state);const expected=env.json(`geometryModel().directions.find(a=>a.key==='${axis}').direction`);
    const raw=axis==='Z'?env.json(`(()=>{const f=createGeometry(current).faces.find(f=>f.pose==='tool'&&f.axes.includes('Z'));return {p:f.v[0],axes:f.axes,pose:f.pose}})()`):{p:[0,1.16,-2.7*.1],axes:['X','Y'],pose:'work'};
    const pair=[];
    for(const step of [-.001,.001]){set({...state,[axis]:state[axis]+step});pair.push(env.json(`displayedModelPoint(${JSON.stringify(raw.p)},${JSON.stringify(raw.axes)},current,positions,'${raw.pose}')`));}
    const error=distance(unit(delta(pair[1],pair[0])),unit(expected));maxDirectionError=Math.max(maxDirectionError,error);
    assert.ok(error<1e-7,`material motion differs from physical ${axis}: ${error}`);axisChecks++;
   }
   set(state);cases++;
  }
 }
}
console.log(JSON.stringify({cases,axisChecks,maxDirectionError,fixedColumnInvariant:true,measurementsInvariant:true}));

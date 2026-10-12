'use strict';
// Reads PRODUCT display values (DOM) and product function values for comparison only.
const path=require('node:path');
process.chdir('/home/user/Training-tools');
const createEnv=require('/home/user/Training-tools/tests/leveling-dom-env.cjs');
const cfg=JSON.parse(process.argv[2]);
const e=createEnv({window:{crypto:{getRandomValues:v=>{v[0]=cfg.seed;return v;}}}});
e.read(`openMachine(machines.find(m=>m.id==='${cfg.id}'));`);
const out={id:cfg.id,profile:e.json('machineProfile'),supports:e.json('supports'),levelConfig:e.json('levelConfig')};
function snapshot(label){
 const s={label,heights:e.json('supportHeights'),positions:e.json('positions')};
 const vals=e.body.querySelectorAll('.live-pair-error-value');
 s.dom=vals.map(v=>({text:v.textContent,raw:Number(v.getAttribute('data-reading-microns'))}));
 s.domPairs=e.body.querySelectorAll('.live-squareness-diagram').map(v=>v.getAttribute('data-pair'));
 s.sweep=[0,1,2,3].map(i=>({label:e.registry['sweepLabel'+i].textContent,text:e.registry['sweepValue'+i].textContent,raw:e.registry['sweepValue'+i].getAttribute('data-reading-microns')}));
 s.fn={};for(const k of ['XY','XZ','YZ']){const r=e.json(`(()=>{const q=referenceScan({key:'${k}'});return {valid:q.valid,microns:q.microns,start:q.startPosition,end:q.endPosition,zeroExt:q.zero&&q.zero.extension,lastExt:q.last&&q.last.extension,setup:q.setup};})()`);s.fn[k]=r;}
 s.localAngle=e.json('levelGeometry.pairs.map(p=>({key:p.key,dev:p.deviationMicroradians,err300:p.deviationMicroradians*.3}))');
 s.diag={directions:e.json('levelGeometry.directions.map(d=>({key:d.key,dir:d.direction}))'),sweepAxis:e.json('spindleSweepGeometry(positions,levelSolution,machineProfile,1,false).measurement.axis'),sweepNormal:e.json('spindleSweepGeometry(positions,levelSolution,machineProfile,1,false).tableNormal')};
 return s;
}
for(const k of ['X','Y','Z']){const el=e.registry['axis-'+k];if(el&&el.events.input)el.events.input({target:{value:String(cfg.positions[k])}});}
out.sweepModel=null;
out.before=snapshot('before');
for(const [i,d] of cfg.ops)e.read(`setSupportHeight(${i},Math.round((supportHeights[${i}]+(${d}))*1000)/1000);`);
out.after=snapshot('after');
console.log(JSON.stringify(out,null,1));

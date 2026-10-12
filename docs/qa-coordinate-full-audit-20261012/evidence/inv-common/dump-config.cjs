'use strict';
// Read-only dump of INPUT data per machine (supports, coordinate mapping, axis config, anchors, calc model id).
process.chdir('/home/user/Training-tools');
const env=require('/home/user/Training-tools/tests/leveling-dom-env.cjs');
const out={commit:require('child_process').execSync('git rev-parse HEAD').toString().trim(),machines:{}};
for(let i=0;i<6;i++){
 const e=env({});
 e.read(`openMachine(machines[${i}]);`);
 const d=e.json(`({id:current.id,kind:current.kind,w:current.w,d:current.d,grid:current.grid,layoutId:current.layoutId||null,supportLayout:current.supportLayout||null,calc:currentCalculationModel(),levelConfig,
  supports:supports.map((s,i)=>({label:String.fromCharCode(65+i),name:s.name,raw:{x:s.x,z:s.z},level:levelCoordinates(s.x,s.z),group:s.group||null})),
  axes:axisConfig(current).map(a=>({key:a.key,part:a.part,direction:a.direction,vector:a.vector,amp:a.amp})),
  sources:levelGeometry.axes.map(a=>({key:a.key,source:a.source})),
  toolPoints:levelGeometry.toolPoints,workPoint:levelGeometry.workPoint,guidePoints:levelGeometry.guidePoints||null,
  bodyAxis:intrinsicBodyFrame(axisConfig(current).filter(a=>['X','Y','Z'].includes(a.key)),machineProfile).axisKey,
  sweepSupported:supportsSpindleSweep(),
  profile:{seed:machineProfile.seed,squareness:machineProfile.squareness,initialHeights:machineProfile.initialHeights},
  record:Object.keys(levelRecord()),
  steps:[...document.getElementById('adjustStep').children].map(o=>o.value)})`);
 out.machines[d.id]=d;
}
require('fs').writeFileSync(__dirname+'/config-dump.json',JSON.stringify(out,null,1));
for(const [id,m] of Object.entries(out.machines))console.log(id,m.kind,m.calc,'supports',m.supports.length,'cfg',JSON.stringify(m.levelConfig),'sources',JSON.stringify(m.sources),'tool',JSON.stringify(m.toolPoints),'work',JSON.stringify(m.workPoint),'bodyAxis',m.bodyAxis,'sweep',m.sweepSupported,'steps',m.steps.join('/'));

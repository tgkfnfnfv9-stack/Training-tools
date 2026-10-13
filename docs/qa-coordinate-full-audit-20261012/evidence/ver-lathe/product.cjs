'use strict';
// Reads PRODUCT values (functions + fake-DOM text) for given cases. Not used as expected values.
process.chdir('/home/user/Training-tools');
const fs=require('node:fs');
const env=require('/home/user/Training-tools/tests/leveling-dom-env.cjs')();
env.read('ResizeObserver=class{observe(){}};matchMedia=()=>({matches:true});');
for(const f of ['intrinsic-inspection.js','lathe-inspection.js','lathe-inspection-ui.js'])env.read(fs.readFileSync('src/'+f,'utf8'));
env.read("openMachine(machines.find(m=>m.kind==='lathe'));");
const cases=JSON.parse(process.argv[2]);
const out=[];
for(const c of cases){
 env.context.__c=c;
 env.read(`machineProfile=window.MachineAccuracy.generate(__c.condition,__c.seed,['X','Z'],6);supportHeights=__c.heights.map(h=>h);positions={X:__c.X,Y:0,Z:__c.Z,A:0,C:0};updateLeveling(false);updateAccuracy&&updateAccuracy();`);
 const r=env.json(`(()=>{const d=latheInspectionGeometry();const pair={key:'XZ'};const rs=referenceScan(pair);const g=geometryModel();
  const strip=s=>s&&{valid:s.valid,microns:s.microns,reason:s.reason,ext0:s.samples&&s.samples[0].extension,ext1:s.samples&&s.samples.at(-1).extension};
  return {face:d.face,flat:d.flat,dx:d.dx,dy:d.dy,bore:d.bore,barSide:d.barSide,barTop:d.barTop,side:strip(d.side),top:strip(d.top),xStart:d.xStart,zStart:d.zStart,barLength:d.barLength,
   refXZ:{valid:rs.valid,microns:rs.microns,start:rs.startPosition,end:rs.endPosition},
   pairXZ:g.pairs.map(p=>({key:p.key,dev:p.deviationMicroradians,err:p.errorMicrons,len:g.length})),
   runout:window.IntrinsicInspection.fromProfile(machineProfile).runout,
   markup:{first:latheInspectionMarkup(d,window.IntrinsicInspection.fromProfile(machineProfile).runout),second:latheInspectionMarkup(d,null,true),accXZ:($('accuracy-current-XZ')||{}).textContent},
   profile:machineProfile.squareness,offset:levelConfig.offset};})()`);
 const strip=h=>h.replace(/<title>[^<]*<\/title>/g,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();r.markup.first=strip(r.markup.first);r.markup.second=strip(r.markup.second);
 out.push({case:c,product:r});
}
console.log(JSON.stringify(out,null,1));

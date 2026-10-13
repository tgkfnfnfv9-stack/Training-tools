'use strict';
// Decompose horizontal XY: finite-scan B vs local angle (rail-mean X guide). Independent oracle only.
const O=require('./horizontal-oracle.cjs'),L=require('./lib.cjs'),MA=require('/home/user/Training-tools/src/machine-accuracy.js');
const prof=MA.generate('used',20261012,['X','Y','Z'],8),sq={XY:prof.squareness.XY.microns,XZ:prof.squareness.XZ.microns,YZ:prof.squareness.YZ.microns};
const cfg={width:2.72,depth:3.68,columnX:0,columnZ:0},out=[];
for(const [name,h] of [['initial',prof.initialHeights],['after A+0.1',prof.initialHeights.map((v,i)=>i?v:v+.1)],['flat',[0,0,0,0,0,0,0,0]]]){
 const m=O.model(cfg,h,sq),st={X:0,Y:0,Z:0},d=m.dirs(st);
 const nose=x=>m.tool.nose({...st,X:x}),chord=L.unit(L.sub(nose(54.5455*0+.3/m.halfX*100),nose(0)));
 const T0=m.tool.T(st),T1=m.tool.T({...st,X:.3/m.halfX*100});
 const pitch=f=>Math.atan2(-f.u[2],f.u[1])*1e6;
 out.push({heights:name,B:O.squareness(m,'XY',st).B.microns,localX300:-Math.asin(L.dot(d.X,d.Y))*.3e6,chordX300:-Math.asin(L.dot(chord,d.Y))*.3e6,
  columnPitchChangeOver300mmX_urad:pitch(T1)-pitch(T0),noseOverhangZ_m:m.tool.raw([0,2.55,-.93])[2],noseHeight_m:m.tool.raw([0,2.55,-.93])[1]});
}
console.log(JSON.stringify(out,null,1));require('fs').writeFileSync(__dirname+'/results-horizontal-decompose.json',JSON.stringify(out,null,1));

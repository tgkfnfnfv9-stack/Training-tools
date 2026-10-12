'use strict';
// Runout: own simulation of a rigid bar rotating about the spindle axis with a fixed radial dial.
// Surface: own LS plane removal on the 3x3 heights. Support independence: API has no support input.
const II=require('/home/user/Training-tools/src/intrinsic-inspection.js'),MA=require('/home/user/Training-tools/src/machine-accuracy.js');
const out={};
for(const cond of ['new','used']){
 const prof=MA.generate(cond,20261012,['X','Y','Z'],4),d=II.fromProfile(prof);
 const own=L=>{const e=d.runout.eccentricityMicrons,t=d.runout.tiltMicroradians;let mx=-1e9,mn=1e9;
  for(let k=0;k<3600;k++){const a=2*Math.PI*k/3600,cx=e[0]+t[0]*L/1000,cy=e[1]+t[1]*L/1000,rx=cx*Math.cos(a)-cy*Math.sin(a);mx=Math.max(mx,rx);mn=Math.min(mn,rx);}return mx-mn;};
 // own surface: rebuild raw heights stream? not exposed -> check plane-removal invariance property using product points + arbitrary plane
 const pts=d.surface.points,plane=pts.map(p=>p.microns+5*p.x-3*p.back+7),re=II.surface(plane);
 out[cond]={rootTIR:d.runout.rootMicrons,ownRoot:own(0),tipTIR:d.runout.tipMicrons,ownTip:own(300),surfaceRange:d.surface.rangeMicrons,planeAddedInvariant:re.points.every((p,i)=>Math.abs(p.microns-pts[i].microns)<1e-9),fromProfileArgs:II.fromProfile.length,supportInputs:'none (signature fromProfile(profile))'};
 console.log(cond,JSON.stringify(out[cond]));
}
require('fs').writeFileSync(__dirname+'/intrinsic-inspection.json',JSON.stringify(out,null,1));

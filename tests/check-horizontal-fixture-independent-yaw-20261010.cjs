'use strict';
// Counterexample: a top-face indicator alone does not determine square yaw.
// Pure analytic flat-support construction; no product module is imported.
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');process.chdir(root);
const anglesUm={XY:16.959,XZ:-8.129,YZ:-14.12},A=anglesUm.XY/300000,B=anglesUm.XZ/300000,C=anglesUm.YZ/300000,Y=[-Math.sin(A),Math.cos(A),0],zx=-Math.sin(B),zy=(-Math.sin(C)-Y[0]*zx)/Y[1],Z=[zx,zy,Math.sqrt(1-zx*zx-zy*zy)],dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const rows=[];
for(const [label,yaw]of [['centre-line-aligned',Math.atan2(Z[0],Z[2])],['yaw-minus-0.05',-.05],['yaw-plus-0.05',.05]]){
 // R·Z=0 enforces equal top-face readings under the 300 mm table feed.
 const pitch=Math.atan2(Z[1],Math.sin(yaw)*Z[0]+Math.cos(yaw)*Z[2]),S=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)],R=[-Math.sin(yaw)*Math.sin(pitch),Math.cos(pitch),-Math.cos(yaw)*Math.sin(pitch)],T=[-Math.cos(yaw),0,Math.sin(yaw)],readingUm=-.3*dot(S,Y)*1e6;
 const tableR=-.3*dot(R,Z),tableAlong=-.3*dot(S,Z),tableAcross=-.3*dot(T,Z),headContact=Y.map((v,i)=>.3*(v-S[i]*dot(S,Y))),ScoordinateR=-.31+dot(headContact,R),ScoordinateThickness=dot(headContact,T);
 rows.push({label,yawRad:yaw,pitchRad:pitch,RendpointUm:tableR*1e6,RendAlongM:tableAlong,RendAcrossThicknessM:tableAcross,RendInsideFiniteFace:tableAlong>=-.31&&tableAlong<=.01&&Math.abs(tableAcross)<=.025,SreadingUm:readingUm,Sdisplay:(readingUm<0?'-':'+')+Math.round(Math.abs(readingUm)),SendCoordinateR:ScoordinateR,SendCoordinateThickness:ScoordinateThickness,SendInsideFiniteFace:ScoordinateR>=-.32&&ScoordinateR<=0&&Math.abs(ScoordinateThickness)<=.025});
}
const failures=rows.filter(q=>Math.abs(q.RendpointUm)>1e-8||!q.RendInsideFiniteFace||!q.SendInsideFiniteFace);
if(new Set(rows.map(q=>q.Sdisplay)).size!==3)failures.push({reason:'expected three distinct integer readings despite equal top-face endpoints'});
const report={scope:'Physical underdetermination counterexample, not three expected outputs for the adopted centred fixture.',input:{profile:'used123456',anglesUm,supportHeightsMm:Array(8).fill(0),positions:{X:0,Y:0,Z:0},scanLengthM:.3,square:{RalongBoundsM:[-.31,.01],SheightBoundsM:[-.32,0],thicknessBoundsM:[-.025,.025]}},formulas:{Y:'[-sin(A), cos(A), 0]',Z:'Solve X·Z=-sin(B), Y·Z=-sin(C), |Z|=1, Zz>0',pitch:'atan2(Zy, sin(yaw)*Zx+cos(yaw)*Zz), ensuring R·Z=0',readingUm:'-0.3*(S·Y)*1e6',centreLineCondition:'T·Z=0 at the two R endpoints'},rows,failures};fs.writeFileSync('docs/qa-horizontal-fixture-20261010/physical-yaw-alignment.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({rows,failureCount:failures.length},null,2));if(failures.length)process.exitCode=1;

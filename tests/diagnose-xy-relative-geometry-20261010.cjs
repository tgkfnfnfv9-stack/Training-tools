'use strict';
// New XY diagnosis. Expected results are independently reconstructed from nodal
// support heights and stored angle constraints, with no product pose/contact call.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
process.chdir(path.resolve(__dirname,'..'));
const env=require('./leveling-dom-env.cjs')({pureLeveling:true});
const {supportModel}=require('./check-horizontal-fixture-independent-3d-20261010.cjs');
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(v,k)=>v.map(q=>q*k),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),unit=v=>mul(v,1/Math.hypot(...v));
const map=(F,v)=>F[0].map((_,i)=>F.reduce((s,a,j)=>s+a[i]*v[j],0)),inverse=(F,v)=>F.map(a=>dot(a,v));
env.read("openMachine(machines.find(m=>m.kind==='horizontal'));positions={X:0,Y:0,Z:0,A:0,C:0};$('exaggerate').checked=false;");
function expected(input){
 // Symmetric default dimensions, X=Z=0. The 300 mm R sweep is X=0 -> .3 m.
 // q0 is a material point of R, 50 mm above the 610 mm-high pallet datum.
 const support=supportModel(input),t0=support.seat(0,1.334),t1=support.seat(.3,1.334),p=support.seat(0,-.85);
 const q0=add(p.point,map(p.F,[-.15,.66,0]));
 // A tip rigidly fixed to the head during R alignment transports with its
 // orthonormal seat frame. Constant intrinsic body rotation cancels here.
 const q1=add(t1.point,map(t1.F,inverse(t0.F,sub(q0,t0.point))));
 const n=unit(sub(q1,q0)),angle=(input.profile?.squareness.XY.microns||0)/300000,Y=map(t0.F,[-Math.sin(angle),Math.cos(angle),0]);
 const dy=mul(Y,.3),raw=-dot(n,dy)*1e6;
 // Head travels dy; the stationary master plane changes x with this y/z.
 const masterDx=-(n[1]*dy[1]+n[2]*dy[2])/n[0],relativeDx=dy[0]-masterDx;
 return {rawUm:raw,integer:Math.round(Math.abs(raw))?(raw<0?'-':'+')+Math.round(Math.abs(raw)):'0',Snormal:n,headY:Y,columnRightUmOver300:dy[0]*1e6,masterRightUmAtSameYZ:masterDx*1e6,bodyMinusMasterRightUm:relativeDx*1e6,zeroExtensionMm:10,lastExtensionMm:10-raw/1000,Rpoint0:q0,Rpoint1:q1};
}
const cases=[['flat','0'],['G-down','i===6?-.01:0'],['G-up','i===6?.01:0'],['common-right','-.1*p.x'],['twist-positive','.01*p.x*p.z'],['common-right-plus-twist','-.1*p.x+.01*p.x*p.z'],['twist-negative','-.01*p.x*p.z']];
const rows=[];
for(const used of [false,true])for(const [label,pattern] of cases)for(const y of label==='G-up'?[-100,0,100]:[0]){
 env.read(`machineProfile=${used?"window.MachineAccuracy.generate('used',123456,['X','Y','Z'],8)":'null'};supportHeights=supports.map((p,i)=>${pattern});positions.Y=${y};updateLeveling(false);`);
 const input=env.json('({config:{...levelConfig},positions:{...positions},supports:supports.map((p,i)=>({...p,height:supportHeights[i]})),profile:machineProfile})');
 const observed=env.json(`(()=>{const m=referenceScan({key:'XY'}),a=displayedModelPoint([0,.7,1.334],['X'],current,positions,'tool'),b=displayedModelPoint([0,3.2,1.334],['X'],current,positions,'tool'),head=horizontalToolPoint([0,2.55,-.93],positions),modelNose=displayedModelPoint([0,2.55,-.93],['X','Y'],current,positions,'tool');return {rawUm:m.microns,integer:squarenessMicronText(m.microns),Snormal:m.master.Snormal,headY:horizontalSpindleFixture(positions,levelSolution,machineProfile).up,columnFromDrawnVertices:b.map((q,i)=>(q-a[i])/2.5),nose:head,drawnNose:modelNose,displayClearance:displayClearance(),zeroExtensionMm:m.zero.extension*1000,lastExtensionMm:m.last.extension*1000,startPosition:m.startPosition,endPosition:m.endPosition,RendpointUm:m.alignment.microns,Yposition:positions.Y};})()`);
 const oracle=expected(input),rawErrorUm=observed.rawUm-oracle.rawUm,normalError=Math.hypot(...sub(observed.Snormal,oracle.Snormal)),modelDirectionError=Math.hypot(...sub(observed.columnFromDrawnVertices,oracle.headY)),modelNoseError=Math.hypot(...sub(sub(observed.drawnNose,observed.nose),[0,observed.displayClearance,0]));
 assert.ok(Math.abs(rawErrorUm)<1e-6,label+' raw');assert.equal(observed.integer,oracle.integer,label+' integer');assert.ok(normalError<1e-12,label+' R alignment');assert.ok(modelDirectionError<1e-12,label+' visual direction');assert.ok(modelNoseError<1e-12,label+' visual nose');
 rows.push({label,used,Y:y,input,expected:oracle,observed,rawErrorUm,normalError,modelDirectionError,modelNoseError});
}
const report={scope:'PR horizontal XY only; independent support tangent/chord/distance calculation; default dimensions and X=Z=0; drawn vertices checked without exaggeration.',helper:'The supportModel helper was re-read against bilinear interpolation and orthonormal tangent construction; prior numerical expectations are not used.',states:rows.length,maxRawErrorUm:Math.max(...rows.map(r=>Math.abs(r.rawErrorUm))),maxModelDirectionError:Math.max(...rows.map(r=>r.modelDirectionError)),rows};
fs.mkdirSync('docs/qa-xy-clarity-20261010',{recursive:true});fs.writeFileSync('docs/qa-xy-clarity-20261010/independent.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({states:report.states,maxRawErrorUm:report.maxRawErrorUm,maxModelDirectionError:report.maxModelDirectionError,rows:rows.map(r=>({label:r.label,used:r.used,Y:r.Y,raw:r.observed.rawUm,integer:r.observed.integer,col:r.expected.columnRightUmOver300,master:r.expected.masterRightUmAtSameYZ,relative:r.expected.bodyMinusMasterRightUm}))},null,2));

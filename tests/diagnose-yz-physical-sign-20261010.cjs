'use strict';
// A physical sign diagnosis, not a copy of the machine deformation oracle.
// y is up; z is toward the spindle. A head-mounted plunger is positive when
// its exposed length decreases. Independent expected values below use only
// distance changes between two straight rigid motions in the yz section.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const M=require(path.join(root,'src/reference-measurement.js'));
const rows=[],failures=[];
const add=(a,b)=>a.map((x,i)=>x+b[i]),scale=(a,k)=>a.map(x=>x*k);
const rotation=angle=>({right:[1,0,0],up:[0,Math.cos(angle),Math.sin(angle)],back:[0,-Math.sin(angle),Math.cos(angle)]});
function contextFor(yLean,zRise){
 const F=rotation(yLean),I=rotation(0),Y=F.up,Z=[0,Math.sin(zRise),Math.cos(zRise)];
 const context={window:{ReferenceMeasurement:M},current:{kind:'horizontal'},positions:{X:0,Y:0,Z:0},levelSolution:{},machineProfile:null,supports:[],
  axisConfig:()=>[{key:'X',vector:[1,0,0],amp:.55,part:'コラム'},{key:'Y',vector:[0,1,0],amp:.3,part:'主軸頭'},{key:'Z',vector:[0,0,1],amp:.45,part:'パレット'}],
  levelCoordinates:(x,z)=>({x,z}),horizontalSpindleFixture:s=>({nose:add(add([0,2.55,1],scale(Y,.3*s.Y/100)),[.55*s.X/100,0,0]),...F,axis:F.back}),
  horizontalPalletPoint:(p,s)=>add([0,1.27,-.85],scale(Z,.45*s.Z/100)),geometryModel:()=>({workFrame:I})};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'src/reference-measurement-ui.js'),'utf8'),context);
 return context;
}
// Sanity check independent of machine axes: a 10 mm plunger is compressed by
// +1 mm when a top face rises 1 mm; extending it by 1 mm reads -1000 um.
for(const topRiseMm of [-1,1]){
 const start={point:[0,0,0],normal:[0,1,0],body:[0,.01,0],probe:[0,-1,0]},end={...start,point:[0,topRiseMm/1000,0]};
 const expected=topRiseMm*1000,observed=M.compare(start,end).microns;
 rows.push({test:'stationary head, top face rises',topRiseMm,expectedUm:expected,observedUm:observed});
 if(Math.abs(expected-observed)>1e-8)failures.push(rows.at(-1));
}
for(const yLean of [-.001,0,.001])for(const zRise of [-.002,0,.002]){
 const context=contextFor(yLean,zRise),observed=vm.runInContext('horizontalReferenceScan({key:"YZ"},positions,levelSolution,machineProfile)',context);
 // Old/current arrangement: square vertical R follows Y; top S follows R's
 // perpendicular. On a +Z table move, the stationary top plunger compresses
 // by the projection of table movement onto Y.
 const oldExpected=.3*Math.sin(yLean+zRise)*1e6;
 // Alternative requested/intuitive arrangement: R follows table Z, S is its
 // perpendicular vertical side. The spindle-side dial points -Z. During +Y
 // head travel it moves away by the same projection and therefore decompresses.
 const spindleSideYScan=-.3*Math.sin(yLean+zRise)*1e6;
 // Touching the front side would reverse this reading again. Contact side is
 // a required physical specification; an unexplained sign flip cannot fix it.
 const frontSideYScan=-spindleSideYScan;
 const row={test:'two physically distinct YZ methods',yLeanRad:yLean,zRiseRad:zRise,currentArrangement:'Y-aligned R, top S, table +Z, downward plunger',currentValid:observed.valid,currentObservedUm:observed.microns,currentIndependentUm:oldExpected,alternativeArrangement:'Z-aligned R, spindle-side vertical S, head +Y, plunger toward -Z',alternativeIndependentUm:spindleSideYScan,frontSideAlternativeUm:frontSideYScan};
 rows.push(row);
 if(!observed.valid||Math.abs(observed.microns-oldExpected)>1e-6)failures.push(row);
}
// Real support input with no left/right twist: raise/lower both rear supports
// together while the table scan stays inside the unchanged front support cell.
// Expectation is a two-dimensional ramp construction from the eight heights.
// The actual application is evaluated only after this expectation is formed.
process.chdir(root);
const env=require(path.join(root,'tests/leveling-dom-env.cjs'))({pureLeveling:true});
env.read("openMachine(machines.find(m=>m.kind==='horizontal'));$('exaggerate').checked=false;");
for(const rearMm of [-.01,.01]){
 const depth=3.68,zs=[-depth/2,-depth/6,depth/6,depth/2],heights=[0,0,0,0,0,0,rearMm,rearMm];
 const commonSlope=zs.reduce((s,z,i)=>s+z*(i===3?rearMm/1000:0),0)/zs.reduce((s,z)=>s+z*z,0);
 const columnSlope=(rearMm/1000)/(zs[3]-zs[2]);
 const a=Math.atan(commonSlope),yLean=-a-Math.atan(columnSlope-commonSlope);
 const tableY=-commonSlope*Math.cos(a)+Math.sin(a),tableZ=commonSlope*Math.sin(a)+Math.cos(a);
 const projection=Math.cos(yLean)*tableY+Math.sin(yLean)*tableZ;
 const currentIndependent=.3*projection*1e6,alternativeIndependent=-.3*projection/Math.hypot(tableY,tableZ)*1e6;
 env.read(`supportHeights=${JSON.stringify(heights)};machineProfile=null;positions={X:0,Y:0,Z:-100,A:0,C:0};levelSolution=machineSolution(supportHeights);levelGeometry=geometryModel();`);
 const observed=env.json("(()=>{const m=referenceScan({key:'YZ'});return {valid:m.valid,microns:m.microns,start:m.start,end:m.end,zero:m.zero,last:m.last}})()");
 const row={test:'actual supports, rear pair only, no left/right twist',rearMm,heightsMm:heights,state:{X:0,Y:0,Z:-100},independentCommonSlope:commonSlope,independentColumnSlope:columnSlope,independentHeadYLeanRad:yLean,currentObservedUm:observed.microns,currentIndependentUm:currentIndependent,alternativeIndependentUm:alternativeIndependent,currentContact:observed};
 rows.push(row);if(!observed.valid||Math.abs(observed.microns-currentIndependent)>1e-6)failures.push(row);
}
const source=fs.readFileSync(path.join(root,'src/reference-measurement-ui.js'));
const output={scope:'Physical sign counterexamples: ideal straight axes and symmetric rear support pairs. Does not certify every support state or choose user intent.',sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),conclusion:'Current YZ is internally consistent for its top-contact/table-Z arrangement, but it reports the opposite sign to a spindle-side vertical-contact/head-Y measurement of the same nonorthogonality. Treating these two arrangements as interchangeable is incorrect.',rows,failures};
const outputFile=path.join(root,'docs/qa-yz-sign-recheck-20261010/physical.json');
fs.writeFileSync(outputFile,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({output:outputFile,checks:rows.length,failures:failures.length,positiveYLeanOnly:rows.find(q=>q.yLeanRad===.001&&q.zRiseRad===0)},null,2));
if(failures.length)process.exitCode=1;

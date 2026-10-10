'use strict';
// Public-main diagnostic: expected readings come from independent nodal slopes
// and distance to a fixed plane. No expected signs are copied from app tests.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'..'),baseline=path.resolve(process.argv[2]||'/workspace/Training-tools-before');
process.chdir(baseline);
const env=require(path.join(baseline,'tests/leveling-dom-env.cjs'))({pureLeveling:true});
env.read("openMachine(machines.find(m=>m.kind==='horizontal'));positions={X:0,Y:0,Z:0,A:0,C:0};machineProfile=null;supportHeights=supports.map(()=>0);updateLeveling(false);");
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),unit=a=>a.map(x=>x/Math.hypot(...a));
function expectedG(h){
 // G is the left rear node of the last 2.72 m × 1.226666… m support cell.
 // h is mm. Differentiate that node's bilinear shape function directly.
 const dz=3.68/3,zfront=3.68/6;
 const slope=z=>({a:-h*(z-zfront)/dz/2.72/1000,b:h*.5/dz/1000});
 const col=slope(4.6*.29),railA=slope(4.6*.28-.13),railB=slope(4.6*.28+.13);
 const n=unit([1,(railA.a+railB.a)/2,0]),u=unit([-col.a,1,-col.b]);
 return {planeNormal:n,headUp:u,columnRightUmOver300:u[0]*300000,
  masterRightUmOver300:(-n[1]/n[0])*.3*u[1]*1e6,expectedRaw:-.3*dot(n,u)*1e6};
}
const rows=[];
for(const h of [-.01,0,.01]){
 env.read(`supportHeights=supports.map((s,i)=>i===6?${h}:0);updateLeveling(false);`);
 const observed=env.json("(()=>{const m=referenceScan({key:'XY'});return {raw:m.microns,display:squarenessMicronText(m.microns),zeroExtension:m.zero.extension,lastExtension:m.last.extension,startPosition:m.startPosition,endPosition:m.endPosition};})()");
 const expected=expectedG(h);assert.ok(Math.abs(observed.raw-expected.expectedRaw)<1e-8);
 rows.push({case:'ideal G '+h+' mm',...observed,...expected,residual:observed.raw-expected.expectedRaw});
}
env.read(`supportHeights=supports.map(()=>0);updateLeveling(false);
 function rightTenProvider(){const s=10e-6/.3,c=Math.sqrt(1-s*s),toolFrame={right:[c,-s,0],up:[s,c,0],back:[0,0,1]},workFrame={right:[1,0,0],up:[0,1,0],back:[0,0,1]};return {directions:[{key:'X',direction:[1,0,0]},{key:'Y',direction:toolFrame.up},{key:'Z',direction:[0,0,1]}],toolFrame,workFrame};}
 var synthetic=referenceScan({key:'XY'},positions,levelSolution,null,rightTenProvider);`);
const synthetic=env.json('({raw:synthetic.microns,zeroExtension:synthetic.zero.extension,lastExtension:synthetic.last.extension,reverse:window.ReferenceMeasurement.compare(synthetic.end,synthetic.start).microns})');
assert.ok(Math.abs(synthetic.raw+10)<1e-9);assert.ok(Math.abs(synthetic.reverse-10)<1e-9);
// Both the column and the aligned square can lean right while XY stays zero.
env.read('supportHeights=supports.map(p=>-.01*p.x);updateLeveling(false);');
const commonRightLean=env.json("({raw:referenceScan({key:'XY'}).microns,columnUp:geometryModel().toolFrame.up,normal:referenceScan({key:'XY'}).start.normal})");
assert.ok(commonRightLean.columnUp[0]>0);assert.ok(Math.abs(commonRightLean.raw)<1e-8);
const result={scope:'Public horizontal XY only; the screenshot state is not reproduced because seed/support values are unknown.',
 htmlSha256:crypto.createHash('sha256').update(fs.readFileSync('index.html')).digest('hex'),
 independentPlaneExample:{fixedPlaneX:0,probeX:-1,lowerBody:[.01,0,0],upperBody:[.01001,Math.sqrt(.3**2-1e-10),0],
  upWithBottomZero:-10,downWithTopZero:10,downWithBottomZero:'-10 -> 0; negative readings persist until the original zero is reached'},
 publicSynthetic:synthetic,supportRows:rows,commonRightLean};
const output=path.join(repo,'docs/qa-public-xy-20261010/physical.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({output,synthetic,supportRows:rows,commonRightLean},null,2));

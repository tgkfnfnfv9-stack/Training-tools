'use strict';
// Run from the repository root. This compares the complete previous implementation
// from a git archive to the new implementation, never using the extracted helper
// as an oracle. No application source is edited by this script.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=process.cwd(),oldRoot=process.env.OLD_TRAINING_ROOT||'/tmp/training-tools-old127';
process.chdir(oldRoot);const old=require(path.join(oldRoot,'tests/leveling-dom-env.cjs'))({pureLeveling:true});
process.chdir(root);const now=require(path.join(root,'tests/leveling-dom-env.cjs'))({pureLeveling:true});
for(const e of [old,now])e.read('openMachine(machines[1]);');
const vertices=old.json("createGeometry(current).faces.filter(f=>f.pose==='work').flatMap(f=>f.v.map(p=>({p,axes:f.axes,pose:f.pose})))");
assert.deepEqual(now.json("createGeometry(current).faces.filter(f=>f.pose==='work').flatMap(f=>f.v.map(p=>({p,axes:f.axes,pose:f.pose})))"),vertices);
const MA=require(path.join(root,'src/machine-accuracy.js'));
const profiles=[null,MA.generate('new',1,['X','Y','Z'],8),MA.generate('used',123,['X','Y','Z'],8)];
const points=old.json('supports'),W=old.read('current.w'),D=old.read('current.d');
const heights=[points.map(()=>0),points.map(p=>.08*p.x/(W*.4)+.06*p.z/(D*.4)),points.map(p=>.2*p.x/(W*.4)*p.z/(D*.4)),points.map((p,i)=>i===2?.3:i===5?-.2:0),[.3,-.2,.1,.25,-.4,.2,-.15,.1]];
const dimensions=[old.json('[levelConfig.width,levelConfig.depth]'),[.5,20],[20,.5]];
const states=[{X:0,Y:0,Z:0,A:0,C:0},{X:100,Y:100,Z:100,A:0,C:0},{X:-100,Y:-100,Z:-100,A:0,C:0},{X:37,Y:-23,Z:19,A:0,C:0},{X:-57,Y:41,Z:-63,A:0,C:0}];
const call=`(${JSON.stringify(vertices)}).map(v=>displayedModelPoint(v.p,v.axes,current,positions,v.pose))`;
let cases=0,comparisons=0,maxDifference=0,worst=null;const failures=[];
for(let hi=0;hi<heights.length;hi++)for(let pi=0;pi<profiles.length;pi++)for(const exaggerated of [false,true])for(const dims of dimensions)for(const state of states){
 const setup=`supportHeights=${JSON.stringify(heights[hi])};machineProfile=${JSON.stringify(profiles[pi])};machineReference=null;levelConfig.width=${dims[0]};levelConfig.depth=${dims[1]};levelConfig.columnX=35;levelConfig.columnZ=-21;positions=${JSON.stringify(state)};$('exaggerate').checked=${exaggerated};updateLeveling(false);`;
 old.read(setup);now.read(setup);const a=old.json(call),b=now.json(call);let localMax=0;
 for(let j=0;j<a.length;j++){const delta=Math.hypot(...a[j].map((v,k)=>v-b[j][k]));comparisons++;localMax=Math.max(localMax,delta);if(delta>maxDifference){maxDifference=delta;worst={heightCase:hi,profileCase:pi,exaggerated,dims,state,vertex:vertices[j],old:a[j],new:b[j],delta};}}
 cases++;if(localMax>1e-10)failures.push({heightCase:hi,profileCase:pi,exaggerated,dims,state,maxDifference:localMax});
}
const hashes={};for(const file of ['src/spindle-sweep.js','src/spindle-sweep-ui.js']){const hash=dir=>crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,file))).digest('hex');hashes[file]={old:hash(oldRoot),new:hash(root)};assert.equal(hashes[file].old,hashes[file].new);}
const result={baselineCommit:'127b3ece7da64cab5d1fb9bbb998313d739fd905',verticesPerCase:vertices.length,cases,comparisons,maxDifference,worst,tolerance:1e-10,failures,unchangedSpindleSweepFiles:hashes};
fs.writeFileSync(path.join(root,'docs/qa-coordinate-fix-20261007/independent-horizontal-transform.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({cases,comparisons,maxDifference,failures:failures.length,spindleSweepIdentical:true},null,2));
assert.equal(failures.length,0,'The extracted helper changed horizontal model coordinates');

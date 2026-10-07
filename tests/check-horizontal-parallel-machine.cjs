'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const env=require('./leveling-dom-env.cjs')({pureLeveling:true});
for(const file of ['horizontal-parallelism.js','horizontal-parallelism-ui.js'])vm.runInContext(fs.readFileSync('src/'+file,'utf8'),env.context);
let assertions=0;
const near=(a,b,t=1e-7,label='')=>{assert.ok(Math.abs(a-b)<=t,`${label}: ${a} != ${b}`);assertions++;};
const yes=(a,label)=>{assert.ok(a,label);assertions++;};
env.read("openMachine(machines.find(m=>m.kind==='horizontal'));$('exaggerate').checked=false;");
function set({xy=0,xz=0,yz=0,height='0',X=0,Y=0,Z=0}={}){
 env.read(`machineProfile={guides:{},initialHeights:supports.map(()=>0),squareness:{XY:{microns:${xy}},XZ:{microns:${xz}},YZ:{microns:${yz}}}};supportHeights=supports.map(p=>{const q=levelCoordinates(p.x,p.z);return ${height}});positions={X:${X},Y:${Y},Z:${Z},A:0,C:0};updateLeveling();`);
 return env.json('horizontalParallelism()');
}
for(const xz of [-60,0,60])for(const yz of [-45,0,45]){
 const q=set({xz,yz});yes(q.valid,'known angles valid');
 // Flat supports and XY=0: Z travel has x=-sin(XZ/L), y=-sin(YZ/L).
 // A round bar adds the independent circle sag in the other cross-section.
 const dx=-.3*Math.sin(xz/300000),dy=-.3*Math.sin(yz/300000),r=.025;
 near(q.a.microns,(dx+Math.sqrt(r*r-dy*dy)-r)*1e6,2e-7,'a hand circle intersection');
 near(q.b.microns,(dy+Math.sqrt(r*r-dx*dx)-r)*1e6,2e-7,'b hand circle intersection');
}
for(const xy of [-80,80]){const q=set({xy});near(q.a.microns,0);near(q.b.microns,0);}
for(const height of ['0','.03*q.x+.04*q.z+.02','-.03*q.x-.04*q.z-.02']){
 const q=set({height});near(q.a.microns,0,1e-6,'rigid plane a');near(q.b.microns,0,1e-6,'rigid plane b');
}
for(const k of [-.0001,.0001]){
 const q=set({height:`${k}*q.x*q.z`});yes(q.valid,'positive/negative saddle valid');
 // h=k*x*z mm => left/right slope changes k*0.3 mm/m along scan.
 // Indicator is at barheight 2.55m: lever from support datum is1.89m,
 // NOT the pallet material datum height0.61m. First-order x motion=-k*.3*1.89/1000.
 near(q.a.microns,-k*.3*1.89*1000,1e-5,'saddle hand lever arm');
 near(q.b.microns,0,1e-5,'saddle central vertical first order');
}
{
 const q=set({height:'p.z<0?(p.x<0?.25:-.15):(p.x<0?-.3:.1)'});
 const boundary=(-.6133333333333334+.85)/.3;
 for(const row of [q.a,q.b])for(const t of [boundary-1e-8,boundary,boundary+1e-8])yes(row.samples.some(s=>Math.abs(s.t-t)<1e-12),'interpolation boundary and both sides sampled');
}
for(const height of ['0','.04*q.x+.03*q.z','.04*q.x*q.z'])for(const X of [-100,0,100])for(const Y of [-100,100])for(const Z of [-100,100]){
 const q=set({height,X,Y,Z,xy:22,xz:-38,yz:45});yes(q.valid,'limits and saddle valid');
 const drawn=env.json("[displayedModelPoint([0,2.55,-.93],['X','Y'],current,positions,'tool'),displayedModelPoint([0,2.55,-.83],['X','Y'],current,positions,'tool')].map(p=>p.map((v,i)=>v-(i===1?displayClearance():0)))");
 for(let i=0;i<3;i++)near(q.tool.nose[i],drawn[0][i],1e-11,'physical rendered nose');
 const v=drawn[1].map((x,i)=>x-drawn[0][i]),n=Math.hypot(...v);
 for(let i=0;i<3;i++)near(q.tool.axis[i],v[i]/n,1e-11,'actual spindle line vs rendered axis');
 near(q.endPosition-q.startPosition,.3,1e-12,'always full300mm');
 yes(q.startPosition>=-.45-1e-12&&q.endPosition<=.45+1e-12,'scan within physical travel');
 const end=q.bar.origin.map((v,i)=>v+q.bar.axis[i]*q.bar.axialMax);
 for(let i=0;i<3;i++)near(end[i],q.tool.nose[i],1e-12,'calibrated rod ends at nose, not through head');
 const before=[q.a.microns,q.b.microns];
 env.read("$('exaggerate').checked=true;yaw+=.4;sceneZoom=1.4;sceneView='side';");
 const after=env.json('horizontalParallelism()');near(after.a.microns,before[0],1e-9,'display invariant a');near(after.b.microns,before[1],1e-9,'display invariant b');
 env.read("$('exaggerate').checked=false;");
}
console.log(JSON.stringify({passed:true,assertions,scope:'ideal, known signed angles, rigid plane, saddle lever arm, physical rendered spindle, travel limits, display invariance'}));

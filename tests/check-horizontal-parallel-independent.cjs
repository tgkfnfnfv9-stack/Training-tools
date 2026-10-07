'use strict';
// Independent reviewer: expectations use distance-to-line bisection and hand
// signed translations, never the production quadratic or a drawing sign table.
const assert=require('node:assert/strict');
const H=require('../src/horizontal-parallelism.js');
let assertions=0;
function near(actual,expected,tolerance=1e-7,label=''){assert.ok(Math.abs(actual-expected)<=tolerance,`${label}: ${actual} != ${expected}`);assertions++;}
function yes(value,label){assert.ok(value,label);assertions++;}
const add=(a,b)=>a.map((v,i)=>v+b[i]),mul=(v,s)=>v.map(q=>q*s);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=v=>mul(v,1/Math.hypot(...v));
// Point-to-axis distance via cross product; first incoming contact is found
// numerically without sharing the engine's projected quadratic coefficients.
function independentExtension(o){
 const axis=unit(o.axis),probe=unit(o.probe),r=o.radius??.025;
 const f=t=>Math.hypot(...cross(add(add(o.body,mul(probe,t)),mul(o.origin,-1)),axis))-r;
 let lo=0,hi=.02; assert.ok(f(lo)>0&&f(hi)<0,'independent incoming bracket');
 for(let n=0;n<70;n++){const mid=(lo+hi)/2;if(f(mid)>0)lo=mid;else hi=mid;}
 return (lo+hi)/2;
}
const fixture={axis:[0,0,1],origin:[0,0,0],radius:.025,axialMin:-.01,axialMax:.31};
for(const lateral of [0,.00003,-.00003,.0002,-.0002]){
 for(const channel of ['a','b'])for(const side of [-1,1]){
  const n=channel==='a'?0:1,body=[0,0,.3],probe=[0,0,0];body[n]=side*.035+lateral;probe[n]=-side;
  const o={...fixture,body,probe},c=H.contact(o);yes(c.valid,'cardinal contact');
  near(c.extension,.01+side*lateral,1e-12,'known radial distance');
  near((.01-c.extension)*1e6,-side*lateral*1e6,1e-6,'compression sign / opposite side');
 }
}
for(let i=0;i<100;i++){
 const angle=i*.137,axis=unit([.15*Math.sin(angle),.18*Math.cos(angle),1]);
 const radial=unit(cross(axis,[Math.cos(angle),Math.sin(angle),0]));
 const origin=[Math.sin(i)*3,Math.cos(i)*2,.25*i],body=add(add(origin,mul(axis,.15)),mul(radial,.034+Math.sin(i)*.002));
 const probe=unit(add(mul(radial,-1),mul(axis,.07*Math.cos(i))));
 const o={...fixture,axis,origin,body,probe};
 const c=H.contact(o);yes(c.valid,'rotated translated cylinder contact');
 near(c.extension,independentExtension(o),2e-12,'independent bisection');
 const shifted=[7,-4,2],translated=H.contact({...o,origin:add(origin,shifted),body:add(body,shifted)});
 yes(translated.valid,'translated valid');near(translated.extension,c.extension,3e-12,'common translation invariant');
}
for(const [label,overrides] of [
 ['parallel probe',{probe:[0,0,1]}],['outside bar end',{body:[-.035,0,.5]}],
 ['too far',{body:[-.055,0,.15]}],['outward probe',{probe:[-1,0,0]}],
 ['zero axis',{axis:[0,0,0]}],['nonfinite body',{body:[NaN,0,.15]}]
])yes(!H.contact({...fixture,body:[-.035,0,.15],probe:[1,0,0],...overrides}).valid,label);
for(const slope of [-.0003,0,.0003]){
 const samples=[0,.25,.5,.75,1].map(t=>({t,body:[-.035+slope*.3*t,0,.3*t],probe:[1,0,0]}));
 const forward=H.measure({...fixture,samples}),reverse=H.measure({...fixture,samples:[...samples].reverse()});
 yes(forward.valid&&reverse.valid,'forward and fixed-fixture reverse valid');
 near(forward.microns,slope*.3*1e6,1e-7,'known guide angular drift');
 near(reverse.microns,-forward.microns,1e-7,'same fixture reversed and rezeroed');
 const broken=samples.map((s,i)=>i===2?{...s,body:[-.06,0,.15]}:s);
 yes(!H.measure({...fixture,samples:broken}).valid,'invalid interior suppresses endpoint difference');
}
console.log(JSON.stringify({passed:true,assertions,independent:'cross-product distance bisection, signed radial gap, rigid translation'}));

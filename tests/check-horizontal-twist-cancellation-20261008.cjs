'use strict';
const assert=require('node:assert/strict');
const env=require('./leveling-dom-env.cjs')({pureLeveling:true});
env.read("openMachine(machines.find(m=>m.kind==='horizontal'));machineProfile=window.MachineAccuracy.generate('used',123456,['X','Y','Z'],8);");
let assertions=0;
const near=(a,b,t,label)=>{assert.ok(Math.abs(a-b)<t,`${label}: ${a} != ${b}`);assertions++;};
const rows=[];
for(const X of [-100,0,100]){
 env.read(`positions={X:${X},Y:0,Z:0,A:0,C:0};supportHeights=supports.map(p=>{const q=levelCoordinates(p.x,p.z);return .05*q.x*q.z});updateLeveling();`);
 rows.push(env.json(`(()=>{const q=horizontalParallelism();return {X:${X},YZ:referenceScan({key:'YZ'}).microns,a:q.a.microns,b:q.b.microns};})()`));
}
// h=kxz: changing column lateral position c changes spindle vertical slope
// by k*c/1000. The pallet's roll over L rotates the lateral bracket by the
// same vertical amount c*k*L/1000. Hence b cancels to first order; a master
// at the pallet centre used in YZ does not have this lateral bracket term.
const k=.05,L=.3,c=.55,change=k*L*c*1000;
near(rows[0].YZ-rows[1].YZ,change,1e-6,'YZ c=-.55 analytic first-order term');
near(rows[2].YZ-rows[1].YZ,-change,1e-6,'YZ c=+.55 analytic first-order term');
near(rows[0].b,rows[2].b,2e-6,'bar slope and lateral bracket roll cancel');
for(const sign of [-1,1]){
 env.read(`machineProfile=null;positions={X:0,Y:0,Z:0,A:0,C:0};supportHeights=supports.map(p=>{const q=levelCoordinates(p.x,p.z);return ${sign*k}*q.x*q.z});updateLeveling();`);
 const measured=env.json('horizontalParallelism()');
 // In the fixed spindle cross-section the initial indicator and its probe
 // rotate through delta about the support datum. The bar centre is H above
 // that datum. Intersection with its radius r gives dial change:
 // H(1-cos(delta)) + sqrt(r*r-H*H*sin(delta)^2) - r.
 // This includes cylindrical sag AND rigid bracket/probe rotation.
 const delta=Math.atan(sign*k*(-.85+L)/1000)-Math.atan(sign*k*(-.85)/1000),H=1.89,r=.025,s=Math.sin(delta),root=Math.sqrt(r*r-H*H*s*s);
 const expected=(2*H*Math.sin(delta/2)**2-H*H*s*s/(root+r))*1e6;
 near(measured.b.microns,expected,1e-8,'exact cross-section rotation/cylinder formula');
 assert.ok(measured.b.microns<0,'second-order b has same sign for ±twist');assertions++;
}
console.log(JSON.stringify({passed:true,assertions,rows,scope:'X-dependent spindle slope cancels pallet-mounted bracket roll in b; exact second-order circular contact under ±pure twist'}));

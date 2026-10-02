'use strict';
const assert=require('node:assert/strict');
const {solve,geometry,orientation}=require('../src/leveling.js');
let checks=0;
const near=(actual,expected,tolerance=1e-8)=>{checks++;assert.ok(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);};
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const points=height=>[-1,1].flatMap(z=>[-1,1].map(x=>({x,z,h:height(x,z)})));
const axes=[{key:'X',vector:[1,0,0],source:'work'},{key:'Y',vector:[0,0,1],source:'work'},{key:'Z',vector:[0,1,0],source:'tool'}];
const options={axes,toolPoints:[{x:0,z:.7}],workPoints:[{x:.4,z:-.4}],length:.5};
// Arbitrary common plane tilt must not manufacture a relative squareness error.
for(const [a,b,c] of [[0,0,0],[.3,-.6,17],[-1,2,0],[123,-48,2]]){
 const g=geometry(solve(points((x,z)=>a*x+b*z+c)),options);
 for(const p of g.pairs){near(p.angleDegrees,90);near(p.errorMicrons,0);}
 near(g.relativeLean.front,0);near(g.relativeLean.right,0);
}
// The local frame is a true rotation; it preserves lengths and orthogonality.
for(const s of [{lr:0,fb:0},{lr:.3,fb:-.4},{lr:100,fb:200}]){
 const f=orientation(s);near(Math.hypot(...f.right),1);near(Math.hypot(...f.up),1);near(Math.hypot(...f.back),1);
 near(dot(f.right,f.up),0);near(dot(f.right,f.back),0);near(dot(f.up,f.back),0);
 near(Math.hypot(...f.rotate([2,3,4])),Math.hypot(2,3,4));
 checks++;assert.ok(f.up[0]*s.lr<=0&&f.up[2]*s.fb<=0,'top leans toward the low side');
}
const saddle=solve(points((x,z)=>.1*x*z)),g=geometry(saddle,options);
near(g.pairs.find(p=>p.key==='YZ').deviationMicroradians,-Math.atan(.04/1000)*1e6,1e-6);
near(g.pairs.find(p=>p.key==='XY').errorMicrons,0);
checks++;assert.ok(Math.abs(g.pairs.find(p=>p.key==='XZ').errorMicrons)>50);
const twice=geometry(saddle,{...options,length:1});
for(let i=0;i<g.pairs.length;i++)near(twice.pairs[i].errorMicrons,g.pairs[i].errorMicrons*2);
const shifted=geometry(solve(points((x,z)=>.1*x*z+.2)),options);
for(let i=0;i<g.pairs.length;i++)near(shifted.pairs[i].errorMicrons,g.pairs[i].errorMicrons);
const middle=geometry(saddle,{...options,workPoints:[{x:0,z:-.4}]});near(middle.pairs.find(p=>p.key==='YZ').errorMicrons,0);
const columns=geometry(saddle,{...options,toolPoints:[{x:-1,z:.7},{x:1,z:.7}]});
near(columns.toolLean.front,0);checks++;assert.ok(columns.columns[0].front<0&&columns.columns[1].front>0);
for(const bad of [{...options,length:0},{...options,length:NaN},{...options,toolPoints:[]},{...options,axes:[axes[0],axes[0]]},{...options,axes:[axes[0],{key:'Z',source:'tool',vector:[0,0,0]}]}]){checks++;assert.throws(()=>geometry(saddle,bad));}
console.log(`Accuracy engine: ${checks} checks passed.`);

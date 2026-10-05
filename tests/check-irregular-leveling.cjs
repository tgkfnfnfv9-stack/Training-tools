'use strict';
const assert=require('node:assert/strict');
const {solve,geometry}=require('../src/leveling.js');
let checks=0;
function near(a,b,tol=1e-9){checks++;assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`);}
// Revised L3 teaching layout: nine requested bed points and six unchanged column points.
const positions=[
 ...[-.770,0,.770].flatMap(x=>[.240,3.440,6.600].map(z=>({x,z:z-3.420}))),
 ...[-1.060,1.060].flatMap(x=>[3.965,4.515].map(z=>({x,z:z-3.420}))),
 {x:-1.425,z:4.245-3.420},{x:1.420,z:4.245-3.420}
];
const run=points=>solve(points,{layout:'irregular'});
const source=height=>positions.map(p=>({...p,h:height(p.x,p.z)}));
const probes=[{x:0,z:0},{x:-1,z:.6},{x:1,z:.9},{x:.2,z:-2},{x:.4,z:4}];
// An affine plane is preserved inside and outside the foundation, including
// tool/work relative orientation; a rigid tilt must not invent squareness error.
const plane=run(source((x,z)=>.2*x-.3*z+2));
for(const p of probes){near(plane.heightAt(p.x,p.z),.2*p.x-.3*p.z+2);near(plane.slopeAt(p.x,p.z).lr,.2);near(plane.slopeAt(p.x,p.z).fb,-.3);}
near(plane.twist,0);near(plane.residual,0);
const g=geometry(plane,{length:.3,toolPoints:probes.slice(1,3),workPoints:[probes[0]],axes:[{key:'X',source:'work',vector:[1,0,0]},{key:'Z',source:'tool',vector:[0,1,0]}]});
near(g.pairs[0].errorMicrons,0);
// Every independent support adjustment must interpolate its own height, keep
// all others fixed, and change the surface slope somewhere on the machine.
for(let active=0;active<positions.length;active++){
 const points=positions.map((p,i)=>({...p,h:i===active?.01:0})),s=run(points);
 for(const p of points)near(s.heightAt(p.x,p.z),p.h);
 checks++;assert.ok(probes.some(p=>{const q=s.slopeAt(p.x,p.z);return Math.hypot(q.lr,q.fb)>1e-8;}),`support ${active} has no slope effect`);
 for(const p of [...positions,...probes]){const q=s.slopeAt(p.x,p.z);checks++;assert.ok(Number.isFinite(q.lr)&&Number.isFinite(q.fb));}
}
// Nonplanar warp remains observable, height derivatives agree with the slope
// used by levels/geometry, and uniform elevation cannot change the lesson.
const warped=source((x,z)=>.02*x*z+.003*Math.sin(z)),s=run(warped),shift=run(warped.map(p=>({...p,h:p.h+12})));
checks++;assert.ok(Math.abs(s.twist)>.01&&s.residual>.01);
for(const p of probes){
 const q=s.slopeAt(p.x,p.z),d=1e-5;
 near(q.lr,(s.heightAt(p.x+d,p.z)-s.heightAt(p.x-d,p.z))/(2*d),1e-7);
 near(q.fb,(s.heightAt(p.x,p.z+d)-s.heightAt(p.x,p.z-d))/(2*d),1e-7);
 near(shift.heightAt(p.x,p.z),s.heightAt(p.x,p.z)+12);
 near(shift.slopeAt(p.x,p.z).lr,q.lr);near(shift.slopeAt(p.x,p.z).fb,q.fb);
}
near(shift.twist,s.twist);near(shift.residual,s.residual);
// Normalization must handle very small models and large coordinate offsets.
const tiny=run(positions.map(p=>({x:p.x*1e-8,z:p.z*1e-8,h:(.2*p.x-.3*p.z)*1e-8})));
near(tiny.slopeAt(0,0).lr,.2);near(tiny.slopeAt(0,0).fb,-.3);
const offset=run(warped.map(p=>({...p,x:p.x+1e6,z:p.z-1e6})));
for(const p of probes)near(offset.heightAt(p.x+1e6,p.z-1e6),s.heightAt(p.x,p.z),1e-8);
// Permuting points cannot change the solution; ordinary calls keep rejecting
// incomplete grids, so existing machines cannot silently switch interpolation.
const reversed=run([...warped].reverse());
for(const p of probes)near(reversed.heightAt(p.x,p.z),s.heightAt(p.x,p.z));
// Replacing the cached factorization must not mutate an older solved surface.
const before=probes.map(p=>[s.heightAt(p.x,p.z),s.slopeAt(p.x,p.z)]);
run(positions.map(p=>({x:p.x+.2*p.z,z:p.z,h:.01*p.x})));
run(source((x,z)=>x+z));
for(let i=0;i<probes.length;i++){
 const p=probes[i];near(s.heightAt(p.x,p.z),before[i][0],0);
 near(s.slopeAt(p.x,p.z).lr,before[i][1].lr,0);near(s.slopeAt(p.x,p.z).fb,before[i][1].fb,0);
}
const restored=run(warped);
for(const p of probes)near(restored.heightAt(p.x,p.z),s.heightAt(p.x,p.z),0);
checks++;assert.throws(()=>solve(warped));
checks++;assert.throws(()=>run([...warped,warped[0]]));
checks++;assert.throws(()=>run([{x:0,z:0,h:0},{x:1,z:1,h:0},{x:2,z:2,h:0},{x:3,z:3,h:0}]));
console.log(`Irregular leveling: ${checks} checks passed.`);

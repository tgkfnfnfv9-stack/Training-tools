'use strict';
// The irregular engine's interpolation constraints are tested separately in
// check-irregular-leveling. UI integration checks independently differentiate
// its HEIGHT graph (never its analytic slopeAt or orientation), then construct
// the expected rotations themselves. Six-point central differences retain the
// existing tight direction tolerances without copying the production derivative.
const {solve}=require('../src/leveling.js');
let lastKey='',lastSurface=null;
module.exports=function heightOracle(points){
 const key=JSON.stringify(points);
 if(key!==lastKey){lastSurface=solve(points,{layout:'irregular'});lastKey=key;}
 const surface=lastSurface;
 const spans=['x','z'].map(k=>Math.max(...points.map(p=>p[k]))-Math.min(...points.map(p=>p[k])));
 const derivative=(fn,step)=>(-fn(-3*step)+9*fn(-2*step)-45*fn(-step)+45*fn(step)-9*fn(2*step)+fn(3*step))/(60*step);
 return {heightAt:(x,z)=>surface.heightAt(x,z),slopeAt:(x,z)=>({
  lr:derivative(d=>surface.heightAt(x+d,z),spans[0]*1e-4),
  fb:derivative(d=>surface.heightAt(x,z+d),spans[1]*1e-4)
 })};
};

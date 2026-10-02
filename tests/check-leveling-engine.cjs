'use strict';
const assert=require('node:assert/strict');
const {solve,impact}=require('../src/leveling.js');
let checks=0;
function near(actual,expected,tolerance=1e-10){checks++;assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);}
function grid(xs,zs,height){return zs.flatMap(z=>xs.map(x=>({x,z,h:height(x,z)})));}
const planar=grid([-1,1],[-2,0,2],(x,z)=>.4*x-.2*z+3);
const plane=solve(planar);
near(plane.lr,.4);near(plane.fb,-.2);near(plane.twist,0);near(plane.residual,0);
near(plane.plane.a,.4);near(plane.plane.b,-.2);near(plane.plane.c,3);
near(plane.heightAt(.3,.8),2.96);near(plane.slopeAt(.3,.8).lr,.4);near(plane.slopeAt(.3,.8).fb,-.2);
// 全支持点の一様上昇は傾き・ねじれ・平面残差を変えない。
const shifted=solve(planar.map(p=>({...p,h:p.h+123})));
near(shifted.lr,plane.lr);near(shifted.fb,plane.fb);near(shifted.twist,plane.twist);near(shifted.residual,plane.residual);
near(shifted.heightAt(.3,.8)-plane.heightAt(.3,.8),123);
const uniform=solve(grid([-1,1],[-2,0,2],()=>10));
checks++;assert.equal(uniform.lr,0);checks++;assert.equal(uniform.fb,0);checks++;assert.equal(uniform.residual,0);checks++;assert.equal(uniform.twist,0);
// xは右が正、zは奥が正。前後で逆向きの左右勾配を持つ鞍形。
const saddle=solve(grid([-1,1],[-1,1],(x,z)=>x*z));
near(saddle.lr,0);near(saddle.fb,0);near(saddle.twist,2);near(saddle.residual,1);
near(saddle.slopeAt(0,-1).lr,-1);near(saddle.slopeAt(0,1).lr,1);near(saddle.heightAt(.5,.5),.25);
// 3点支持の面は一意の平面。三角形外も平面として延長される。
const triangle=solve([{x:-1,z:-1,h:1},{x:1,z:-1,h:3},{x:0,z:1,h:6}]);
near(triangle.lr,1);near(triangle.fb,2);near(triangle.twist,0);near(triangle.residual,0);
near(triangle.heightAt(4,2),12);near(triangle.slopeAt(4,2).fb,2);
// 6点、8点の中間支持点も補間する。両端だけの4点モデルに縮約しない。
for(const zs of [[-1,0,1],[-1,-.3,.3,1]]){
 const source=grid([-1,1],zs,(x,z)=>Math.abs(z)===1?0:1+.2*x);
 const solution=solve(source);
 for(const p of source)near(solution.heightAt(p.x,p.z),p.h);
 checks++;assert.ok(solution.residual>.4);
 near(solution.twist,0);
 checks++;assert.ok(solution.slopeAt(0,-.6).fb>0);
 checks++;assert.ok(solution.slopeAt(0,.6).fb<0);
}
const sixWide=solve(grid([-1,0,1],[-1,1],(x,z)=>x===0?2:0));
near(sixWide.heightAt(0,0),2);near(sixWide.slopeAt(-.5,0).lr,2);near(sixWide.slopeAt(.5,0).lr,-2);near(sixWide.residual,4/3);
// 境界外に延長しても傾斜平面の値・勾配を保つ。
near(plane.heightAt(5,-4),5.8);near(plane.slopeAt(5,-4).lr,.4);
// 入力を後から変更しても既に解いた結果は変わらない。
const source=grid([-1,1],[-1,1],()=>0),copy=solve(source);source[0].h=999;
near(copy.heightAt(-1,-1),0);
// m、mm、µmの換算を確認。
const unit=solve(grid([0,2],[0,1],(x,z)=>.1*x));near(unit.lr,.1);
const error=impact({lr:.3,fb:.4,twist:-.2,residual:.05},{span:2,offset:.4});
near(error.tiltOffsetMicrons,200);near(error.twistOffsetMicrons,400);near(error.straightnessMicrons,50);
const zeroError=impact(unit,{span:0,offset:0});near(zeroError.tiltOffsetMicrons,0);near(zeroError.twistOffsetMicrons,0);
// 大きな座標原点、小さい間隔、大きな高さでも有限の計算を確認。
const translated=solve(grid([1e8,1e8+2],[1e8,1e8+4],(x,z)=>.3*(x-1e8)-.5*(z-1e8)+12));
near(translated.lr,.3);near(translated.fb,-.5);near(translated.heightAt(1e8+1,1e8+2),11.3);
const tiny=solve(grid([0,1e-9],[0,2e-9],(x,z)=>2*x-3*z));near(tiny.lr,2);near(tiny.fb,-3);
const huge=solve(grid([-1e100,1e100],[-1e100,1e100],(x,z)=>x*1e50+z*2e50));
near(huge.lr/1e50,1);near(huge.fb/1e50,2);
for(const invalid of [[],[{x:0,z:0,h:0},{x:1,z:1,h:1},{x:2,z:2,h:2}],
 [{x:0,z:0,h:0},{x:0,z:0,h:1},{x:1,z:1,h:2}],
 [{x:0,z:0,h:0},{x:1,z:0,h:NaN},{x:0,z:1,h:2}],
 [{x:0,z:0,h:0},{x:Infinity,z:0,h:1},{x:0,z:1,h:2}],
 [{x:0,z:0,h:0},{x:1,z:0,h:0},{x:0,z:1,h:0},{x:.5,z:.5,h:0}],
 [{x:-1e308,z:0,h:0},{x:1e308,z:0,h:0},{x:0,z:1,h:1}]]){
 checks++;assert.throws(()=>solve(invalid));
}
checks++;assert.throws(()=>impact(plane,{span:-1,offset:0}));
checks++;assert.throws(()=>impact(plane,{span:1,offset:NaN}));
console.log(`Leveling engine: ${checks} checks passed.`);

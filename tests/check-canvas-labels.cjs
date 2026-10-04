'use strict';
// Independent Canvas inspection across the actual narrow and desktop sizes.
// Detect background overlap, missing axis names, overflow and support occlusion.
const makeEnvironment=require('./leveling-dom-env.cjs');
const {registry:r,read,json,storage}=makeEnvironment();
read('Math.random=()=>.271828;');
let width=320,height=153.5,rects=[],supports=[],lastBackground=null;
const ctx={
 scale(){},beginPath(){},closePath(){},moveTo(){},lineTo(){},fill(){},stroke(){},
 arc(x,y,radius){if(radius===13)supports.push({x,y,radius});},
 fillRect(x,y,w,h){
  if(x===0&&y===0&&w===width&&h===height){rects=[];supports=[];lastBackground=null;return;}
  // Background transparency must not make annotations disappear from the
  // inspection. Classify a real rectangle by its following text, not its color.
  lastBackground={x,y,w,h};
 },
 fillText(text){if(lastBackground){rects.push({...lastBackground,text,kind:/^[XYZAC]軸$/.test(text)?'axis':'part'});lastBackground=null;}},
 measureText(text){const px=Number(/(\d+)px/.exec(this.font||'10px')?.[1]||10);return {width:[...text].reduce((n,ch)=>n+(/[\x00-\x7f]/.test(ch)?.56:1)*px,0)};}
};
r.scene.getContext=()=>ctx;r.scene.getBoundingClientRect=()=>({width,height});
const overlap=(a,b)=>a.x<b.x+b.w-1e-7&&b.x<a.x+a.w-1e-7&&a.y<b.y+b.h-1e-7&&b.y<a.y+a.h-1e-7;
const circleOverlap=(a,c)=>{const nx=Math.max(a.x,Math.min(a.x+a.w,c.x)),ny=Math.max(a.y,Math.min(a.y+a.h,c.y));return (nx-c.x)**2+(ny-c.y)**2<(c.radius-1)**2;};
const variants=[[0,'standard'],[0,'compact'],[1,''],[2,''],[3,'long'],[3,'cross'],[4,''],[5,''],[6,'']];
const sizes=[[320,153.5],[284,119],[390,291.5],[422,237],[768,381.5],[757.21875,733.203125]];
let frames=0,collisionFrames=0,outsideFrames=0,missingAxisFrames=0,supportCollisionFrames=0;
let backgroundRectangles=0,axisRectangles=0,partRectangles=0,expectedAxisLabels=0;
const examples=[];
for(const [i,mode] of variants){
 storage.clear();read(`openMachine(machines[${i}])`);if(mode)r.machineMode.change(mode);
 const kind=read('current.kind'),axes=json('axisConfig(current).map(a=>a.key)');
 for(const [w,h] of sizes){width=w;height=h;for(const angle of [-.45,0,.35,1.1])for(const selectedAxis of axes){
  read(`yaw=${angle};selectedAxis=${JSON.stringify(selectedAxis)};positions={X:0,Y:0,Z:0,A:100,C:0};drawScene();`);frames++;
  const collisions=[];
  for(let a=0;a<rects.length;a++)for(let b=a+1;b<rects.length;b++)if(overlap(rects[a],rects[b]))collisions.push([rects[a].text,rects[b].text]);
  const outside=rects.filter(a=>a.x<0||a.y<0||a.x+a.w>width+1e-7||a.y+a.h>height+1e-7).map(a=>a.text);
  const missing=axes.filter(k=>!rects.some(a=>a.kind==='axis'&&a.text===k+'軸'));
  const supportHits=rects.filter(a=>supports.some(c=>circleOverlap(a,c))).map(a=>a.text);
  backgroundRectangles+=rects.length;axisRectangles+=rects.filter(a=>a.kind==='axis').length;partRectangles+=rects.filter(a=>a.kind==='part').length;expectedAxisLabels+=axes.length;
  if(collisions.length)collisionFrames++;if(outside.length)outsideFrames++;if(missing.length)missingAxisFrames++;if(supportHits.length)supportCollisionFrames++;
  if(examples.length<12&&(collisions.length||outside.length||missing.length||supportHits.length))examples.push({kind,mode,size:[width,height],angle,selectedAxis,collisions,outside,missing,supportHits});
 }}
}
console.log(JSON.stringify({frames,backgroundRectangles,axisRectangles,partRectangles,expectedAxisLabels,collisionFrames,outsideFrames,missingAxisFrames,supportCollisionFrames,examples},null,2));
if(collisionFrames||outsideFrames||missingAxisFrames||supportCollisionFrames||axisRectangles!==expectedAxisLabels||partRectangles===0)process.exitCode=1;

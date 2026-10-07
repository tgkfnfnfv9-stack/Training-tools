(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.IntrinsicInspection=api;
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const model='intrinsic-inspection-v1',lengthMm=300,referenceIndex=3;
 // This independent stream derives from the existing individual seed. It neither
 // consumes nor changes the version-1 profile's random sequence or saved schema.
 const seedSalt=0x49535031;
 function random(seed){let value=seed>>>0;return ()=>{value=(value+0x6D2B79F5)>>>0;let t=value;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
 const grid=Object.freeze([1,0,-1].flatMap(back=>[-1,0,1].map(x=>Object.freeze({x,back}))));
 function vector(value){return Array.isArray(value)&&value.length===2&&value.every(Number.isFinite);}
 // Ideal rigid cylindrical test bar, rotated through one revolution. e is the
 // radial centre offset (µm); tilt is µrad. At axial distance L (mm), the centre
 // vector is e + tilt*L/1000 in µm. TIR is max-min, hence 2*|centre|, never signed.
 // Both stations belong to the SAME bar. A smaller tip TIR is possible when its
 // eccentricity and angular contributions oppose each other.
 function runoutAt(eccentricityMicrons,tiltMicroradians,axialMm){
  if(!vector(eccentricityMicrons)||!vector(tiltMicroradians)||!Number.isFinite(axialMm))throw new TypeError('主軸振れの入力が不正です。');
  const centre=eccentricityMicrons.map((v,i)=>v+tiltMicroradians[i]*axialMm/1000);
  return 2*Math.hypot(...centre);
 }
 function runout(eccentricityMicrons,tiltMicroradians){
  const rootMicrons=runoutAt(eccentricityMicrons,tiltMicroradians,0);
  return {rootMicrons,tipMicrons:runoutAt(eccentricityMicrons,tiltMicroradians,lengthMm),lengthMm,eccentricityMicrons:[...eccentricityMicrons],tiltMicroradians:[...tiltMicroradians]};
 }
 // A 3×3 intrinsic surface map, independently levelled mathematically by its
 // least-squares plane. Symmetry gives sum(x²)=sum(back²)=6 and sum(x*back)=0.
 // Thus adding any rigid plane to every input height leaves the residual map
 // unchanged. The left-middle point is re-zeroed after plane subtraction.
 // The residual peak-to-valley range is NOT minimum-zone flatness and is not a
 // spindle-relative sweep, guide-motion error, load or elastic-deflection model.
 function surface(heightsMicrons){
  if(!Array.isArray(heightsMicrons)||heightsMicrons.length!==9||!heightsMicrons.every(Number.isFinite))throw new TypeError('上面精度の入力が不正です。');
  const mean=heightsMicrons.reduce((sum,v)=>sum+v,0)/9;
  const slopeX=heightsMicrons.reduce((sum,v,i)=>sum+v*grid[i].x,0)/6;
  const slopeBack=heightsMicrons.reduce((sum,v,i)=>sum+v*grid[i].back,0)/6;
  const residual=heightsMicrons.map((v,i)=>v-mean-slopeX*grid[i].x-slopeBack*grid[i].back);
  const zero=residual[referenceIndex];
  const points=grid.map((point,i)=>({...point,microns:i===referenceIndex?0:residual[i]-zero}));
  const values=points.map(point=>point.microns);
  return {points,referenceIndex,rangeMicrons:Math.max(...values)-Math.min(...values),method:'least-squares-plane-residual',plane:{meanMicrons:mean,slopeXMicrons:slopeX,slopeBackMicrons:slopeBack}};
 }
 // Invented teaching ranges, not machine specifications or market statistics:
 // new: eccentricity radius 0.5–2.5 µm, tilt 2–15 µrad, raw heights ±4 µm;
 // used: radius 1–6 µm, tilt 5–40 µrad, raw heights ±12 µm.
 // Independent directions retain cancellation naturally, with no value clamp.
 // No support, axis position, camera or rotary posture enters this model. The
 // five-axis chart represents the same A=C=0 intrinsic reference inspection.
 function fromProfile(profile){
  if(!profile||profile.version!==1||!Number.isInteger(profile.seed)||profile.seed<0||profile.seed>4294967295||!['new','used'].includes(profile.condition))return null;
  const rng=random((profile.seed^seedSalt)>>>0),used=profile.condition==='used';
  const radial=(minimum,maximum)=>{
   const magnitude=minimum+(maximum-minimum)*rng(),angle=2*Math.PI*rng();
   return [magnitude*Math.cos(angle),magnitude*Math.sin(angle)];
  };
  const eccentricity=used?radial(1,6):radial(.5,2.5);
  const tilt=used?radial(5,40):radial(2,15);
  const scale=used?12:4,heights=grid.map(()=>scale*(2*rng()-1));
  return {model,seed:profile.seed,condition:profile.condition,runout:runout(eccentricity,tilt),surface:surface(heights)};
 }
 return Object.freeze({model,lengthMm,referenceIndex,grid,runoutAt,runout,surface,fromProfile});
});

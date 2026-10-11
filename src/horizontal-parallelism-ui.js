'use strict';
// Physical (factor=1) point of the horizontal spindle assembly. This mirrors
// the existing assembly transform without depending on camera, clearance or
// the drawing exaggeration. Y is the column's vertical reference; its rigid
// frame rotates the nominal horizontal spindle, which is NOT the pallet Z axis.
function horizontalSpindleFixture(state,solution,profile,g=geometryModel(state,solution,profile)){
 const M=window.ReferenceMeasurement,axes=axisConfig(current).filter(a=>['X','Y','Z'].includes(a.key)),body=intrinsicBodyFrame(axes,profile),frame=g.toolFrame;
 const nose=horizontalToolPoint([0,2.55,-.93],state,solution,profile);
 return {nose,axis:M.unit(frame.rotate(body.rotate([0,0,1]))),right:M.unit(frame.rotate(body.rotate([1,0,0]))),up:M.unit(frame.rotate(body.rotate([0,1,0])))};
}
function horizontalParallelism(state=positions,solution=levelSolution,profile=machineProfile){
 const invalid=reason=>({valid:false,reason,a:{valid:false,reason},b:{valid:false,reason}});
 if(current?.kind!=='horizontal')return invalid('横形専用の測定');
 if(!levelConfig||!solution)return invalid('測定の準備中');
 const station=horizontalMeasurementStation(state);
 if(!station.valid||station.needsMove)return {...invalid(station.reason||'横形の測定位置へ移動してください'),station};
 const M=window.ReferenceMeasurement,H=window.HorizontalParallelism,length=.3,half=station.physical.Zhalf,startPosition=station.physical.Z,endPosition=startPosition+length;
 const stateAt=t=>({...state,Z:(startPosition+length*t)/half*100}),startState=stateAt(0),tool=horizontalFixtureTool(startState,solution,profile),p0=horizontalFixturePallet(startState,solution,profile);
 // A finite 400 mm bar: the measured section is 350 -> 50 mm in front of
 // the spindle face. Both the indicator housing and nose keep end clearance.
 const origin=M.sub(tool.nose,M.scale(tool.axis,.35)),bar={axis:tool.axis,origin,radius:.025,axialMin:-.05,axialMax:.35};
 const breaks=supports.map(p=>(levelCoordinates(p.x,p.z).z-levelCoordinates(0,-.85).z-startPosition)/length).filter(t=>t>0&&t<1),times=[...new Set([0,1,...Array.from({length:15},(_,i)=>(i+1)/16),...breaks.flatMap(t=>[Math.max(0,t-1e-8),t,Math.min(1,t+1e-8)])])].sort((a,b)=>a-b);
 const row=probe=>{
  const startBody=M.sub(origin,M.scale(probe,bar.radius+.01)),bodyLocal=horizontalFixtureLocal(startBody,p0),probeLocal=horizontalFixtureVectorLocal(probe,p0),startPose={body:startBody,probe},housing=horizontalFixtureHousing(startPose),housingLocal=horizontalFixtureLocal(housing.center,p0),armLocal=[[housingLocal[0],.85,housingLocal[2]],housingLocal];
  const poses=times.map(t=>{const s=stateAt(t),p=horizontalFixturePallet(s,solution,profile);return {t,state:s,body:horizontalFixtureWorld(bodyLocal,p),probe:p.frame.rotate(probeLocal)};}),measurement=H.measure({...bar,samples:poses});
  measurement.samples=measurement.samples.map((sample,i)=>({...poses[i],...sample,pose:poses[i],arm:armLocal.map(v=>horizontalFixtureWorld(v,horizontalFixturePallet(poses[i].state,solution,profile)))}));
  Object.assign(measurement,{startState,endState:stateAt(1),start:poses[0],end:poses.at(-1),fixture:{armLocal,stage:'bar'},bar});
  const bad=measurement.samples.find(q=>horizontalFixtureValidateBarSample(q,bar,solution,profile));
  if(bad){measurement.valid=false;measurement.microns=null;measurement.reason=horizontalFixtureValidateBarSample(bad,bar,solution,profile);}
  return measurement;
 };
 const a=row(tool.right),b=row(tool.up);
 return {valid:a.valid&&b.valid,reason:a.valid?b.reason:a.reason,a,b,startState,endState:stateAt(1),startPosition,endPosition,length,model:'horizontal-station-parallelism-v2',bar,tool,palletOrigin:p0.point,fixture:'400mm-cylinder-and-850mm-tower',autoZero:true,station};
}

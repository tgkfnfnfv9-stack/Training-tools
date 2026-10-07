'use strict';
// Physical (factor=1) point of the horizontal spindle assembly. This mirrors
// the existing assembly transform without depending on camera, clearance or
// the drawing exaggeration. Y is the column's vertical reference; its rigid
// frame rotates the nominal horizontal spindle, which is NOT the pallet Z axis.
function horizontalSpindleFixture(state,solution,profile,g=geometryModel(state,solution,profile)){
 const M=window.ReferenceMeasurement,axes=axisConfig(current).filter(a=>['X','Y','Z'].includes(a.key)),body=intrinsicBodyFrame(axes,profile),frame=g.toolFrame;
 const physical=p=>{const q=levelCoordinates(p[0],p[2]);return [q.x,p[1],q.z];},inverse=(f,v)=>[[1,0,0],[0,1,0],[0,0,1]].map(b=>M.dot(f.rotate(b),v));
 const layout=columnLayoutOffset(current),offset=physical([layout.x,0,layout.z]),anchor=physical([g.poses.tool.anchor.x,.66,g.poses.tool.anchor.z]),surface=p=>[p[0],.66+solution.heightAt(p[0],p[2])/1000,p[2]],origin=surface(anchor);
 const baseState={...state,X:0,Y:0},baseG=geometryModel(baseState,solution,profile),baseAnchor=physical([baseG.poses.tool.anchor.x,.66,baseG.poses.tool.anchor.z]),dA=M.sub(anchor,baseAnchor),dS=M.sub(origin,surface(baseAnchor));
 const nonuniform=solution.residual>1e-10||Math.abs(solution.twist)>1e-10;
 let move=[0,0,0],desired=[0,0,0];
 for(const a of axes.filter(a=>a.key==='X'||a.key==='Y')){
  const axisFrame=a.key==='X'?window.Leveling.orientation(g.guideSlope):frame,direction=axisFrame.rotate(g.axes.find(q=>q.key===a.key).vector),distance=Math.hypot(...physical(a.vector))*a.amp*state[a.key]/100;
  desired=M.add(desired,M.scale(direction,distance));
  if(nonuniform){
   const axisState={...state,[a.key]:0},axisG=geometryModel(axisState,solution,profile),axisAnchor=physical([axisG.poses.tool.anchor.x,.66,axisG.poses.tool.anchor.z]),axisDA=M.sub(anchor,axisAnchor),movesAnchor=Math.hypot(...axisDA)>1e-12;
   const world=M.scale(M.sub(direction,movesAnchor?axisFrame.rotate(a.vector):[0,0,0]),distance);
   move=M.add(move,M.add(inverse(body,inverse(frame,world)),axisDA));
  }
 }
 if(!nonuniform)move=M.add(dA,inverse(body,inverse(frame,M.sub(desired,dS))));
 const raw=physical([0,2.55,-.93]),relative=M.sub(M.add(M.add(raw,move),offset),anchor),nose=M.add(origin,frame.rotate(body.rotate(relative)));
 return {nose,axis:M.unit(frame.rotate(body.rotate([0,0,1]))),right:M.unit(frame.rotate(body.rotate([1,0,0]))),up:M.unit(frame.rotate(body.rotate([0,1,0])))};
}
function horizontalParallelism(state=positions,solution=levelSolution,profile=machineProfile){
 const invalid=reason=>({valid:false,reason,a:{valid:false,reason},b:{valid:false,reason}});
 if(current?.kind!=='horizontal')return invalid('横形専用の測定');
 if(!levelConfig||!solution)return invalid('測定の準備中');
 const M=window.ReferenceMeasurement,H=window.HorizontalParallelism,length=.3,axis=axisConfig(current).find(a=>a.key==='Z'),half=levelCoordinates(0,axis.amp).z;
 if(2*half<length)return invalid('300 mmの走査範囲不足');
 const startPosition=Math.max(-half,Math.min(half-length,state.Z*half/100)),endPosition=startPosition+length,stateAt=t=>({...state,Z:(startPosition+length*t)/half*100}),startState=stateAt(0),first=geometryModel(startState,solution,profile),tool=horizontalSpindleFixture(startState,solution,profile,first),pallet=s=>horizontalPalletPoint([0,1.27,-.85],s,solution,profile),p0=pallet(startState),f0=referenceRigidFrame(first.workFrame);
 // A virtual 320 mm calibrated bar extends in front of the spindle nose.
 // Scan from 310 mm in front to 10 mm in front; 10 mm end margins place the
 // complete cylinder outside the nose. No holder collision test is implied.
 // The rigid bracket reaches bar height; only its datum is 0.61 m high.
 const origin=M.sub(tool.nose,M.scale(tool.axis,.31)),bar={axis:tool.axis,origin,radius:.025,axialMin:-.01,axialMax:.31};
 const breaks=supports.map(p=>(levelCoordinates(p.x,p.z).z-levelCoordinates(0,-.85).z-startPosition)/length).filter(t=>t>0&&t<1),times=[...new Set([0,1,...Array.from({length:15},(_,i)=>(i+1)/16),...breaks.flatMap(t=>[Math.max(0,t-1e-8),t,Math.min(1,t+1e-8)])])].sort((a,b)=>a-b);
 const frames=times.map(t=>{const s=stateAt(t);return {t,point:pallet(s),frame:referenceRigidFrame(geometryModel(s,solution,profile).workFrame)};});
 const row=probe=>{
  const startBody=M.sub(origin,M.scale(probe,bar.radius+.01)),bracket=M.sub(startBody,p0);
  const samples=frames.map(f=>({t:f.t,body:M.add(f.point,M.transport(bracket,f0,f.frame)),probe:M.transport(probe,f0,f.frame)}));
  return H.measure({...bar,samples});
 };
 const a=row(tool.right),b=row(tool.up);
 return {valid:a.valid&&b.valid,a,b,startPosition,endPosition,length,model:H.model,bar,tool,palletOrigin:p0,fixture:'virtual-cylinder-on-physical-spindle',autoZero:true};
}

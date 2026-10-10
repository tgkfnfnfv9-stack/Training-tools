'use strict';
// Geometry lesson: sampled support slopes are assumed to set each rigid assembly's
// posture. This is deliberately separate from an elastic/load model of a machine.
const singleColumnKinds=['vertical','compact','travel','horizontal','five'];
let accuracyKey='',accuracyRangeKey='',accuracyRange=null,levelInitialGeometry=null,levelInitialSolution=null;
let visualReferenceKey='',visualReferenceFactor=1;
function scaledAccuracyProfile(profile,factor){
 return profile?{squareness:Object.fromEntries(Object.entries(profile.squareness).map(([pair,item])=>[pair,{microns:item.microns*factor}]))}:null;
}
// A representative column/spindle direction provides a rigid body pose. It is
// derived from the existing individual, rather than drawing another defect.
// The nonorthogonal NC directions remain separate for precision and arrows.
function intrinsicBodyFrame(axes,profile,factor=1){
 const axis=axes.find(a=>Math.abs(a.vector[1])===1)||axes.find(a=>a.key==='Z');
 const direction=window.MachineAccuracy.directions(axes,scaledAccuracyProfile(profile,factor)).find(a=>a.key===axis.key).vector;
 const from=axis.vector,to=direction,cross=[from[1]*to[2]-from[2]*to[1],from[2]*to[0]-from[0]*to[2],from[0]*to[1]-from[1]*to[0]],squared=cross.reduce((s,v)=>s+v*v,0),cosine=from.reduce((s,v,i)=>s+v*to[i],0);
 const rotate=v=>{
  if(squared<1e-24)return [...v];
  const dot=cross.reduce((s,q,i)=>s+q*v[i],0),turn=[cross[1]*v[2]-cross[2]*v[1],cross[2]*v[0]-cross[0]*v[2],cross[0]*v[1]-cross[1]*v[0]];
  return v.map((q,i)=>q*cosine+turn[i]+cross[i]*dot*(1-cosine)/squared);
 };
 return {axisKey:axis.key,nominal:from,direction,rotate};
}
function directionLean(up){return {front:Math.atan2(-up[2],up[1])*1e6,right:Math.atan2(up[0],up[1])*1e6};}
function spindleLean(direction){return {front:Math.atan2(direction[1],Math.hypot(direction[0],direction[2]))*1e6,right:Math.atan2(direction[2],direction[0])*1e6};}
function columnLayoutOffset(m){
 if(!levelConfig||!singleColumnKinds.includes(m.kind))return {x:0,z:0};
 return {x:m.w*.2*levelConfig.columnX/100,z:m.d*.1*levelConfig.columnZ/100};
}
// Connected portal geometry: separate seating planes, then join the actual
// column tops. This closes the frame kinematically without claiming stiffness.
function connectedPortal(solution,points,factor=1){
 const L=window.Leveling,common=L.orientation({lr:solution.lr*factor,fb:solution.fb*factor}),height=2.51;
 const seat=(p,i)=>solution.parts?.[i?'column-right':'column-left']||solution;
 const physical=points.map(p=>levelCoordinates(p.x,p.z));
 const columns=physical.map((p,i)=>{
  const surface=seat(p,i),slope=surface.slopeAt(p.x,p.z),relative=L.orientation({lr:(slope.lr-solution.lr)*factor,fb:(slope.fb-solution.fb)*factor});
  const residual=surface.heightAt(p.x,p.z)-(solution.plane.a*p.x+solution.plane.b*p.z+solution.plane.c);
  const foot=[p.x,residual*factor/1000,p.z],top=relative.up.map((v,j)=>foot[j]+height*v);
  return {foot,top,relative,frame:L.compose(common,relative),slope};
 });
 // A single affine shear map keeps the guide and ram directions distinct.
 // Do not orthogonalize Z against Y: column lean is allowed to change YZ.
 // This is geometric deformation, not a stiffness/load calculation.
 const unit=v=>{const n=Math.hypot(...v);return v.map(q=>q/n);};
 const right=unit(columns[1].top.map((v,i)=>v-columns[0].top[i])),up=unit(columns[0].relative.up.map((v,i)=>(v+columns[1].relative.up[i])/2));
 const back=unit([right[1]*up[2]-right[2]*up[1],right[2]*up[0]-right[0]*up[2],right[0]*up[1]-right[1]*up[0]]),local=L.frame(right,up,back),frame=L.compose(common,local);
 const centre=columns[0].top.map((v,i)=>(v+columns[1].top[i])/2),span=Math.hypot(...columns[1].top.map((v,i)=>v-columns[0].top[i]));
 const world=p=>common.rotate(p).map((v,i)=>v+(i===1?.66+solution.plane.c*factor/1000:0));
 return {common,local,frame,columns,centre,span,world,height};
}
// Compact table path: a fixed virtual point on the drawn table top (1.16 m).
// Its 0.50 m height above the support datum is geometry, not a fitted sensitivity.
// The common seating plane is a rigid rotation; only residual shape deforms parts.
function compactSupportFrame(solution,x,z,factor=1){
 const L=window.Leveling,s=solution.slopeAt(x,z);
 return L.compose(L.orientation({lr:solution.lr*factor,fb:solution.fb*factor}),L.orientation({lr:(s.lr-solution.lr)*factor,fb:(s.fb-solution.fb)*factor}));
}
function compactSurfacePoint(solution,x,z,factor=1){
 const plane=solution.plane,h=solution.heightAt(x,z)-(plane.a*x+plane.b*z+plane.c),R=window.Leveling.orientation({lr:solution.lr*factor,fb:solution.fb*factor});
 return R.rotate([x,h*factor/1000,z]).map((v,i)=>v+(i===1?.66+plane.c*factor/1000:0));
}
function compactWorkVisualPoint(p,state,solution,profile,factor=1){
 const base=levelCoordinates(0,-current.d*.1),travel=levelCoordinates(0,.4*state.Y/100).z,anchor=[0,.66,base.z+travel],R=compactSupportFrame(solution,anchor[0],anchor[2],factor),origin=compactSurfacePoint(solution,anchor[0],anchor[2],factor);
 const axes=axisConfig(current).filter(a=>['X','Y','Z'].includes(a.key)),Y=window.MachineAccuracy.directions(axes,scaledAccuracyProfile(profile,factor)).find(a=>a.key==='Y').vector;
 const relative=p.map((v,i)=>v-anchor[i]+travel*(Y[i]-(i===2?1:0)));
 return R.rotate(relative).map((v,i)=>v+origin[i]);
}
function compactTablePathPoint(state=positions,solution=levelSolution,profile=machineProfile,factor=1){
 const q=levelCoordinates(.45*state.X/100,-current.d*.1+.4*state.Y/100);
 return compactWorkVisualPoint([q.x,1.16,q.z],state,solution,profile,factor);
}
// A material point on the horizontal pallet, shared by the model and reference
// fixture. factor=1 is physical geometry; camera/clearance never enter here.
function horizontalPalletPoint(raw,state=positions,solution=levelSolution,profile=machineProfile,factor=1){
 const base=levelCoordinates(0,-.85),travel=levelCoordinates(0,.45*state.Z/100).z,z=base.z+travel;
 const frame=compactSupportFrame(solution,base.x,z,factor),origin=compactSurfacePoint(solution,base.x,z,factor);
 const q=levelCoordinates(raw[0],raw[2]),relative=[q.x-base.x,raw[1]-.66,q.z-base.z];
 const axes=axisConfig(current).filter(a=>['X','Y','Z'].includes(a.key)),direction=window.MachineAccuracy.directions(axes,scaledAccuracyProfile(profile,factor)).find(a=>a.key==='Z').vector;
 const local=relative.map((v,i)=>v+travel*(direction[i]-(i===2?1:0)));
 return frame.rotate(local).map((v,i)=>v+origin[i]);
}
// One rigid material-point map for the horizontal column, head and spindle.
// Common bed tilt is a rigid transform of the entire residual support shape;
// it must not be reapplied as a world-y height while the body rotates locally.
function horizontalToolPoint(raw,state=positions,solution=levelSolution,profile=machineProfile,factor=1,keys=['X','Y']){
 const M=window.ReferenceMeasurement,L=window.Leveling,active={...state,Y:keys.includes('Y')?state.Y:0},layout=columnLayoutOffset(current);
 const physical=p=>{const q=levelCoordinates(p[0],p[2]);return [q.x,p[1],q.z];};
 const axes=axisConfig(current).filter(a=>['X','Y','Z'].includes(a.key)),intrinsic=window.MachineAccuracy.directions(axes,scaledAccuracyProfile(profile,factor)),body=intrinsicBodyFrame(axes,profile,factor);
 const base=physical([layout.x,.66,current.d*.29+layout.z]),travel=physical([.55*active.X/100,0,0]),anchor=M.add(base,travel);
 const frame=compactSupportFrame(solution,anchor[0],anchor[2],factor),origin=compactSurfacePoint(solution,anchor[0],anchor[2],factor);
 const inverse=(f,v)=>[[1,0,0],[0,1,0],[0,0,1]].map(e=>M.dot(f.rotate(e),v));
 const railSlopes=[-1,1].map(k=>{const q=levelCoordinates(.55*active.X/100+layout.x,current.d*.28+k*.13);return solution.slopeAt(q.x,q.z);});
 const guide={lr:railSlopes.reduce((s,q)=>s+q.lr/2,0),fb:railSlopes.reduce((s,q)=>s+q.fb/2,0)};
 const guideFrame=L.compose(L.orientation({lr:solution.lr*factor,fb:solution.fb*factor}),L.orientation({lr:(guide.lr-solution.lr)*factor,fb:(guide.fb-solution.fb)*factor}));
 let correction=[0,0,0];
 for(const a of axes.filter(a=>keys.includes(a.key))){
  const f=a.key==='X'?guideFrame:frame,direction=f.rotate(intrinsic.find(q=>q.key===a.key).vector),distance=Math.hypot(...physical(a.vector))*a.amp*active[a.key]/100;
  const delta=M.scale(M.sub(direction,a.key==='X'?f.rotate(a.vector):[0,0,0]),distance);
  correction=M.add(correction,inverse(body,inverse(frame,delta)));
 }
 const material=M.add(physical(raw),physical([layout.x,0,layout.z])),relative=M.add(M.sub(material,base),correction);
 return M.add(origin,frame.rotate(body.rotate(relative)));
}
function compactPathFrames(state,solution,profile,factor=1){
 const q=levelCoordinates(0,-current.d*.1+.4*state.Y/100),work=compactSupportFrame(solution,q.x,q.z,factor);
 const axes=axisConfig(current).filter(a=>['X','Y','Z'].includes(a.key)),intrinsicAxes=window.MachineAccuracy.directions(axes,scaledAccuracyProfile(profile,factor)),Y=intrinsicAxes.find(a=>a.key==='Y').vector;
 // Differentiate the shared support map analytically. Differencing complete
 // world positions would let translation roundoff pollute microradian angles.
 const L=window.Leveling,s=solution.slopeAt(q.x,q.z),H=solution.hessianAt?solution.hessianAt(q.x,q.z):(()=>{const lo=solution.slopeAt(q.x,q.z-1),hi=solution.slopeAt(q.x,q.z+1);return {xz:(hi.lr-lo.lr)/2,zz:(hi.fb-lo.fb)/2};})(),a=(s.lr-solution.lr)*factor/1000,b=(s.fb-solution.fb)*factor/1000,da=H.xz*factor/1000,db=H.zz*factor/1000;
 const local=L.orientation({lr:a*1000,fb:b*1000}),nx=Math.hypot(1,a),nu=Math.hypot(a,1,b),nd=(a*da+b*db)/(nu*nu),rightDerivative=[-a*da/(nx*nx*nx),da/(nx*nx*nx),0],upDerivative=[-da/nu,0,-db/nu].map((v,i)=>v-local.up[i]*nd);
 const cross=(u,v)=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],c1=cross(rightDerivative,local.up),c2=cross(local.right,upDerivative),backDerivative=c1.map((v,i)=>v+c2[i]);
 const x=levelCoordinates(.45*state.X/100,0).x,travel=levelCoordinates(0,.4*state.Y/100).z,delta=Y.map((v,i)=>v-(i===2?1:0)),relative=[x,.50,0].map((v,i)=>v+travel*delta[i]),intrinsic=local.rotate(delta);
 const tangent=[0,b,1].map((v,i)=>v+rightDerivative[i]*relative[0]+upDerivative[i]*relative[1]+backDerivative[i]*relative[2]+intrinsic[i]),world=L.orientation({lr:solution.lr*factor,fb:solution.fb*factor}).rotate(tangent),norm=Math.hypot(...world),direction=world.map(v=>v/norm);
 // The Y-only adapter applies the intrinsic vector exactly once. It is not a
 // rigid assembly frame: its resulting vector is the measured path tangent.
 const back=direction.map((v,i)=>(v-work.right[i]*Y[0]-work.up[i]*Y[1])/Y[2]);
 return {work,Y:window.Leveling.frame(work.right,work.up,back),direction};
}
function geometryModel(state=positions,solution=levelSolution,profile=machineProfile,length=levelConfig.offset){
 const m=current,W=m.w,D=m.d,layout=columnLayoutOffset(m),move=(key)=>{const a=axisConfig(m).find(v=>v.key===key);return a?a.amp*state[key]/100:0;};
 let toolPoints,workPoint,toolAxes;
 if(['vertical','compact','five','portal'].includes(m.kind)){
  const gate=m.kind==='portal',cz=D*(gate?.24:m.kind==='five'?.3:.29);
  toolPoints=gate?[-1,1].map(k=>({x:k*W*.4,z:cz})):[{x:layout.x,z:cz+layout.z}];
  // Compact X is a cross-slide on the Y saddle: it does not relocate
  // that saddle's bed reference when no moving-load deformation is solved.
  workPoint={x:['vertical','compact'].includes(m.kind)?0:move('X'),z:(gate?0:m.kind==='five'?-.45:-D*.1)+move('Y')};toolAxes=['Z'];
 }else if(m.kind==='travel'){
  toolPoints=[{x:-.5+move('X')+layout.x,z:D*.29+layout.z}];workPoint={x:0,z:-D*.18};toolAxes=['Y','Z'];
 }else if(m.kind==='horizontal'){
  toolPoints=[{x:move('X')+layout.x,z:D*.29+layout.z}];workPoint={x:0,z:-.85+move('Z')};toolAxes=['X','Y'];
 }else if(['double','gantry'].includes(m.kind)){
  toolPoints=[-1,1].map(k=>({x:k*(m.columnX??W*.4),z:m.kind==='gantry'?move('X'):(m.columnZ??0)}));
  workPoint={x:0,z:m.kind==='double'?move('X'):0};toolAxes=['Y','Z'];
 }else{
  toolPoints=[{x:-W*.35,z:0}];// Cross-slide X moves on the carriage; it does not move the carriage's
  // mounting reference across the bed. Only longitudinal feed Z relocates it.
  workPoint={x:.08+move('Z'),z:.15};toolAxes=['Z'];
 }
 const axes=axisConfig(m).filter(a=>['X','Y','Z'].includes(a.key)).map(a=>({key:a.key,vector:a.vector,source:toolAxes.includes(a.key)?'tool':'work'}));
 const intrinsicAxes=window.MachineAccuracy.directions(axes,profile);
 const options={toolPoints:toolPoints.map(p=>levelCoordinates(p.x,p.z)),workPoints:[levelCoordinates(workPoint.x,workPoint.z)],axes:intrinsicAxes,length};
 const portal=toolPoints.length===2?connectedPortal(solution,toolPoints):null;
 const compact=m.kind==='compact'?compactPathFrames(state,solution,profile):null;
 if(m.kind==='lathe'||m.kind==='horizontal'){
  const t=options.toolPoints[0],w=options.workPoints[0];
  options.toolFrame=compactSupportFrame(solution,t.x,t.z);options.workFrame=compactSupportFrame(solution,w.x,w.z);
 }
 if(compact){const q=options.toolPoints[0];options.toolFrame=compactSupportFrame(solution,q.x,q.z);options.workFrame=compact.work;options.axes=options.axes.map(a=>a.key==='Y'?{...a,frame:compact.Y}:a);}
 if(portal){options.toolFrame=portal.frame;options.columnFrames=portal.columns.map(c=>c.frame);if(solution.parts){const q=options.workPoints[0],s=solution.parts.bed.slopeAt(q.x,q.z);options.workFrame=window.Leveling.compose(portal.common,window.Leveling.orientation({lr:s.lr-solution.lr,fb:s.fb-solution.fb}));}}
 // A travelling column's guide direction comes from the two drawn rails.
 // The column seat behind them may follow a different local support slope:
 // this represents a deformable mounting base, without solving its stiffness.
 const guidePoints=['travel','horizontal'].includes(m.kind)?[-1,1].map(k=>({x:toolPoints[0].x,z:D*(m.kind==='travel'?.22:.28)+k*(m.kind==='travel'?.1:.13)})):m.kind==='gantry'?toolPoints:null;
 let guideSlope=null;
 if(guidePoints){
  const slopes=guidePoints.map(p=>{const q=levelCoordinates(p.x,p.z);return solution.slopeAt(q.x,q.z);});
  guideSlope={lr:slopes.reduce((v,p)=>v+p.lr/slopes.length,0),fb:slopes.reduce((v,p)=>v+p.fb/slopes.length,0)};
  const guideFrame=m.kind==='horizontal'?window.Leveling.compose(window.Leveling.orientation({lr:solution.lr,fb:solution.fb}),window.Leveling.orientation({lr:guideSlope.lr-solution.lr,fb:guideSlope.fb-solution.fb})):window.Leveling.orientation(guideSlope);
  options.axes=options.axes.map(a=>a.key==='X'?{...a,frame:guideFrame}:a);
 }
 const metric=window.Leveling.geometry(solution,options);
 const pureCompact=compact&&profile?compactPathFrames(state,solution,null):null;
 const levelPairs=profile?window.Leveling.geometry(solution,{...options,axes:axes.map(a=>({...a,frame:pureCompact&&a.key==='Y'?pureCompact.Y:options.axes.find(q=>q.key===a.key).frame}))}).pairs:metric.pairs;
 const average=points=>({x:points.reduce((s,p)=>s+p.x/points.length,0),z:points.reduce((s,p)=>s+p.z/points.length,0)});
 const poses={tool:{anchor:average(toolPoints),slope:metric.toolSlope,frame:metric.toolFrame},work:{anchor:workPoint,slope:metric.workSlope,frame:metric.workFrame}};
 if(toolPoints.length===2)toolPoints.forEach((p,i)=>{const q=levelCoordinates(p.x,p.z);poses[i?'rightColumn':'leftColumn']={anchor:p,slope:portal?portal.columns[i].slope:solution.slopeAt(q.x,q.z),frame:portal?.columns[i].frame};});
 const bodyFrame=intrinsicBodyFrame(axes,profile),intrinsicUp=bodyFrame.rotate([0,1,0]),combinedUp=metric.toolFrame.rotate(intrinsicUp),combinedDirection=metric.toolFrame.rotate(bodyFrame.direction);
 const bodyLean=directionLean(combinedUp),bodyIntrinsicLean=directionLean(intrinsicUp),bodyColumns=portal?portal.columns.map(c=>directionLean(c.frame.up)):toolPoints.map(p=>{const q=levelCoordinates(p.x,p.z);return directionLean((compact||['horizontal','lathe'].includes(m.kind)?compactSupportFrame(solution,q.x,q.z):window.Leveling.orientation(solution.slopeAt(q.x,q.z))).rotate(intrinsicUp));});
 const lathe=m.kind==='lathe',bodyPosture=lathe?spindleLean(combinedDirection):bodyLean,bodyIntrinsicPosture=lathe?spindleLean(bodyFrame.direction):bodyIntrinsicLean,bodySupportPosture=lathe?spindleLean(metric.toolFrame.rotate(bodyFrame.nominal)):directionLean(metric.toolFrame.rotate([0,1,0]));
 return {...metric,portal,compact,poses,guidePoints,guideSlope,toolPoints,workPoint,axes:intrinsicAxes,levelPairs,bodyLean,bodyColumns,bodyIntrinsicLean,bodyPosture,bodyIntrinsicPosture,bodySupportPosture,bodyIntrinsicDirection:bodyFrame.direction,bodyCombinedDirection:combinedDirection};
}
// Measurement-only teaching posture. The physical support map, fixed column,
// saved individual and assessment geometry continue to use geometryModel.
// A single extra pitch is fixed by the supports and the central datum, never
// by the current table position. Both finite scans and the spindle sweep use
// this rotation; it is not an independent multiplier on their dial readings.
const compactMeasurementResponseGain=5;
const compactMeasurementAdjustmentCache=new WeakMap();
function compactMeasurementAdjustment(solution=levelSolution){
 const identity={gain:1,angle:0,axis:[1,0,0],supportAngle:0,rotate:v=>[...v]};
 if(current.kind!=='compact'||!solution)return identity;
 const key=JSON.stringify([current.id,current.w,current.d,levelConfig,supports]);
 const cached=compactMeasurementAdjustmentCache.get(solution);
 if(cached?.key===key)return cached.value;
 const M=window.ReferenceMeasurement,datum={X:0,Y:0,Z:0,A:0,C:0};
 const pure=geometryModel(datum,solution,null,.3);
 const axis=pure.directions.find(a=>a.key==='X').direction;
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const pitch=g=>{
  const projected=key=>{const v=g.directions.find(a=>a.key===key).direction;return M.sub(v,M.scale(axis,M.dot(axis,v)));};
  const z=projected('Z'),y=projected('Y');
  return Math.atan2(M.dot(z,y),M.dot(axis,cross(z,y)));
 };
 // Remove even the numerical residue of a common rigid seating plane.
 const plane=solution.plane,rigid={...solution,residual:0,twist:0,
  heightAt:(x,z)=>plane.a*x+plane.b*z+plane.c,
  slopeAt:()=>({lr:solution.lr,fb:solution.fb}),
  hessianAt:()=>({xx:0,xz:0,zz:0})};
 const difference=pitch(pure)-pitch(geometryModel(datum,rigid,null,.3));
 const supportAngle=Math.abs(difference)<1e-14?0:difference;
 const angle=(compactMeasurementResponseGain-1)*supportAngle,c=Math.cos(angle),s=Math.sin(angle);
 const rotate=v=>{
  const turn=cross(axis,v),along=M.dot(axis,v);
  return v.map((q,i)=>q*c+turn[i]*s+axis[i]*along*(1-c));
 };
 const value={gain:compactMeasurementResponseGain,angle,axis:[...axis],supportAngle,rotate};
 compactMeasurementAdjustmentCache.set(solution,{key,value});
 return value;
}
function compactMeasurementGeometry(state=positions,solution=levelSolution,profile=machineProfile,length=levelConfig.offset){
 const g=geometryModel(state,solution,profile,length);
 if(current.kind!=='compact')return g;
 const adjustment=compactMeasurementAdjustment(solution),R=adjustment.rotate;
 const toolFrame=window.Leveling.frame(R(g.toolFrame.right),R(g.toolFrame.up),R(g.toolFrame.back));
 // The original pairs/leans remain physical diagnostics. This provider is for
 // contact calculations only, which read directions and attachment frames.
 return {...g,measurementAdjustment:adjustment,toolFrame,
  poses:{...g.poses,tool:{...g.poses.tool,frame:toolFrame}},
  directions:g.directions.map(a=>a.key==='Z'?{...a,direction:R(a.direction)}:a),
  bodyCombinedDirection:R(g.bodyCombinedDirection)};
}
function geometrySamples(solution=levelSolution,profile=machineProfile,length=levelConfig.offset){
 const keys=axisConfig(current).filter(a=>['X','Y','Z'].includes(a.key)).map(a=>a.key);
 let states=[{X:0,Y:0,Z:0,A:0,C:0}];
 for(const key of keys)states=states.flatMap(state=>[-100,0,100].map(value=>({...state,[key]:value})));
 // On this fixed-bridge model only table X moves a sampled support anchor.
 // Preserve all 27 assessment states while sharing the identical Y/Z results.
 if(current.supportLayout==='irregular'&&current.kind==='double'){const cache=new Map();return states.map(state=>{if(!cache.has(state.X))cache.set(state.X,geometryModel(state,solution,profile,length));return {state,geometry:cache.get(state.X)};});}
 return states.map(state=>({state,geometry:geometryModel(state,solution,profile,length)}));
}
function fixedVisualFactor(initialSolution){
 if(current.kind==='compact')return 1;
 const key=JSON.stringify([current.id,current.kind,current.w,current.d,levelConfig.width,levelConfig.depth,levelConfig.columnX,levelConfig.columnZ,machineProfile]);
 if(key===visualReferenceKey)return visualReferenceFactor;
 visualReferenceKey=key;
 const initial=geometrySamples(initialSolution||machineSolution(supports.map(()=>0))),initialMaximum=Math.max(.001,...initial.flatMap(s=>Object.values(s.geometry.poses).map(p=>Math.hypot(p.slope.lr,p.slope.fb))));
 // Local support gradients are linear in the support heights. Their coefficient
 // absolute sums bound every allowed +/-0.500 mm adjustment, including travel.
 const basisSolutions=supports.map((_,i)=>machineSolution(supports.map((s,j)=>i===j?1:0))),coefficients=basisSolutions.map(s=>geometrySamples(s,null));
 let allowedMaximum=Math.max(.001,Math.hypot(basisSolutions.reduce((s,q)=>s+Math.abs(q.lr)*.5,0),basisSolutions.reduce((s,q)=>s+Math.abs(q.fb)*.5,0)));
 for(let i=0;i<initial.length;i++)for(const pose of Object.keys(initial[i].geometry.poses)){
  const lr=coefficients.reduce((s,list)=>s+Math.abs(list[i].geometry.poses[pose].slope.lr)*.5,0),fb=coefficients.reduce((s,list)=>s+Math.abs(list[i].geometry.poses[pose].slope.fb)*.5,0);
  allowedMaximum=Math.max(allowedMaximum,Math.hypot(lr,fb));
 }
 const intrinsicAngle=machineProfile?Math.max(...Object.values(machineProfile.squareness).map(q=>Math.abs(q.microns)/300000)):.000001;
 visualReferenceFactor=Math.min(['double','gantry','portal'].includes(current.kind)?30:1000,200/Math.max(initialMaximum,allowedMaximum),.15/Math.max(intrinsicAngle,.000001));
 return visualReferenceFactor;
}
function signed(value,d=1){const text=cleanNumber(value,d);return (value>0&&Number(text)!==0?'+':'')+text;}
function changeNumber(value,d=2){
 if(Math.abs(value)<1e-8)return cleanNumber(0,d);
 let digits=d;while(value!==0&&Number(cleanNumber(value,digits))===0&&digits<6)digits++;
 return value!==0&&Number(cleanNumber(value,digits))===0?(value>0?'＋':'−')+'表示桁未満':signed(value,digits);
}
function accuracyChange(before,current){
 const delta=current-before,absoluteChange=Math.abs(current)-Math.abs(before),trend=absoluteChange<-.005?'better':absoluteChange>.005?'worse':'similar';
 return {delta,absoluteChange,trend,text:trend==='better'?'初期より直角に近づいた':trend==='worse'?'初期より直角から離れた':'初期からほぼ同じ'};
}
function leanDescription(value,negative,positive){return Math.abs(value)<.00001?'倒れは表示桁未満':(value>0?positive:negative)+' '+cleanNumber(Math.abs(value),2)+' µrad';}
function postureComparison(id,rows,unit,digits=2){
 const box=$(id);box.hidden=!levelInitialGeometry;box.replaceChildren();if(!levelInitialGeometry)return;
 for(const row of rows){
  const p=document.createElement('p');p.className='posture-comparison-row';
  p.setAttribute('data-metric',row.key);p.setAttribute('data-before',String(row.before));p.setAttribute('data-current',String(row.current));p.setAttribute('data-delta',String(row.current-row.before));
  p.textContent=row.label+'：現在 '+signed(row.current,digits)+' '+unit;box.append(p);
 }
}
// Each pair is a two-dimensional relative-angle comparison, independent of
// camera rotation. The fixed gain makes support adjustments comparable.
const squarenessDiagramGain=5000,squarenessDiagramLimit=.65,squarenessMeasurementLength=.3;
function squarenessMicronText(value){
 const magnitude=Math.round(Math.abs(value));
 return magnitude===0?'0':(value<0?'-':'+')+magnitude;
}
function squarenessPlot(pair){
 const base=current.kind==='lathe'?'Z':pair.key[0],other=[...pair.key].find(key=>key!==base),gain=current.kind==='compact'&&!$('exaggerate').checked?1:squarenessDiagramGain,raw=pair.deviationMicroradians/1e6*gain;
 const angle=Math.max(-squarenessDiagramLimit,Math.min(squarenessDiagramLimit,raw)),x=32,y=54,length=28;
 return {base,other,angle,gain,limited:Math.abs(raw)>squarenessDiagramLimit,origin:[x,y],tip:[x-length*Math.sin(angle),y-length*Math.cos(angle)]};
}
// These directions describe the fixed teaching view, not NC commands or camera axes.
function squarenessReference(pair){
 const gate=['double','gantry','portal'].includes(current.kind),horizontal=current.kind==='horizontal',lathe=current.kind==='lathe';
 const rows=lathe?{XZ:['左手前','右','奥','左','右','水平']}:
 gate?{XY:['左手前','奥','右','手前','奥','水平'],XZ:['手前下','奥','上','手前','奥','垂直'],YZ:['左下','右','上','左','右','垂直']}:
 horizontal?{XY:['左下','右','上','左','右','垂直'],XZ:['左手前','右','奥','左','右','水平'],YZ:['手前下','上','奥','下','上','垂直']}:
 {XY:['左手前','右','奥','左','右','水平'],XZ:['左下','右','上','左','右','垂直'],YZ:['手前下','奥','上','手前','奥','垂直']};
 const [zero,baseDirection,measureDirection,positive,negative,plane]=rows[pair.key];
 // Project each physical direction in the same fixed world view: right is
 // screen-right, back recedes up-right, and up is screen-up. Display only.
 const directions={右:[1,0],奥:[.85,-.45],上:[0,-1]},b=directions[baseDirection],m=directions[measureDirection];
 const projection=[b[0],b[1],-m[0],-m[1],27-32*b[0]+54*m[0],67-32*b[1]+54*m[1]];
 return {zero,baseDirection,measureDirection,positive,negative,plane,projection};
}
function liveSquarenessFrame(pair){
 const m=squarenessReference(pair).projection;
 const up=true,sx=82/56,shear=-6/28,sy=1,originY=67;
 const displayProjection=[sx,0,shear,sy,27-32*sx-54*shear,originY-54*sy];
 // Every live card compares the measured positive directions from one origin.
 // Keep the presentation around the physical reference matrix, never in the
 // measured angle, machine position or saved geometry.
 const [a,b,c,d,e,f]=m,det=a*d-b*c,inv=[d/det,-b/det,-c/det,a/det,(c*f-d*e)/det,(b*e-a*f)/det];
 const outer=[sx*inv[0]+shear*inv[1],sy*inv[1],sx*inv[2]+shear*inv[3],sy*inv[3],sx*inv[4]+shear*inv[5]+displayProjection[4],sy*inv[5]+displayProjection[5]];
 return {up,displayProjection,transform:`matrix(${outer.join(' ')})`,viewBox:'-3 20 122 61'};
}
function liveSquarenessTip(pair,plot){
 // A rounded zero overlaps the ideal point; every signed current direction
 // retains the original angle and side relative to the positive datum.
 return squarenessMicronText(pair.deviationMicroradians*squarenessMeasurementLength)==='0'?[plot.origin[0],26]:plot.tip;
}
function squarenessMarkup(pair,plot,beforePlot,detailed=false,live=false){
 const [x,y]=plot.origin;
 // Match the rounded live reading at zero; raw angles/tips and the detailed
 // comparison keep the original precision, gain and range limit.
 const [tx,ty]=live?liveSquarenessTip(pair,plot):plot.tip,[bx,by]=beforePlot.tip,changed=Math.abs(pair.deviationMicroradians-beforePlot.deviation)>1e-6;
 const ux=(tx-x)/28,uy=(ty-y)/28,r=squarenessReference(pair),matrix=r.projection;
 const frame=live?liveSquarenessFrame(pair):null;
 const displayMatrix=live?frame.displayProjection:matrix;
 const project=(a,b)=>[displayMatrix[0]*a+displayMatrix[2]*b+displayMatrix[4],displayMatrix[1]*a+displayMatrix[3]*b+displayMatrix[5]],pt=project(tx,ty),o=project(x,y),ideal=project(x,26),base=project(88,y);
 // I and P labels are separated from their close-by dots; numeric readings
 // remain unscaled. The initial trace uses the same projection and gain.
 const projectedBase=[displayMatrix[0],displayMatrix[1]],baseLength=Math.hypot(...projectedBase);
 const baseVector=live?projectedBase.map(v=>v/baseLength):projectedBase,positive=ideal.map((v,i)=>v-(live?28:detailed?25:15)*baseVector[i]),negative=ideal.map((v,i)=>v+(live?28:detailed?25:15)*baseVector[i]);
 const signLabel=(point,text,positiveSide)=>`<text x="${point[0]}" y="${live?(frame.up?29:77):point[1]+(baseVector[1]<0?(positiveSide?10:-4):-3)}" text-anchor="${baseVector[0]===0?'middle':positiveSide?'end':'start'}" class="${detailed?'reference-side-label':'reference-plus'}">${text}</text>`;
 const signs=signLabel(positive,'＋'+(detailed?' '+r.positive:''),true)+signLabel(negative,'−'+(detailed?' '+r.negative:''),false);
 const far=project(88,26);
 const detail=detailed?`${signs}<path d="M${positive.join(',')}L${ideal.join(',')}L${negative.join(',')}" class="reference-sign-guide"/><text x="102" y="29" class="reference-direction-label">${plot.base} → ${r.baseDirection}</text><path d="M100,31L${base.join(',')}" class="reference-sign-guide"/><text x="102" y="48" class="reference-direction-label">${plot.other} → ${r.measureDirection}</text><path d="M100,50L${pt[0]+3},${pt[1]+3}" class="reference-sign-guide"/><text x="0" y="112" class="reference-direction-label">O：${r.zero} 0 ／ 黒い辺＝基準</text><text x="0" y="127" class="reference-contact-label">接触：${r.positive} → ● → ${r.negative}</text>`:live?`<text x="${ideal[0]+(frame.up?0:4)}" y="${frame.up?32:77}" class="pair-axis">＋${plot.other} ${r.measureDirection}</text>`:`${signs}<text x="${pt[0]-8}" y="${pt[1]+8}" text-anchor="end" class="pair-axis">${plot.other}</text>`;
 const arrow=(start,end,css)=>{const dx=end[0]-start[0],dy=end[1]-start[1],length=Math.hypot(dx,dy),u=dx/length,v=dy/length;return `<path d="M${end[0]-5*u-2.5*v},${end[1]-5*v+2.5*u}L${end.join(',')}L${end[0]-5*u+2.5*v},${end[1]-5*v-2.5*u}" class="${css}"/>`;};
 const arrows=live?arrow(o,base,'reference-base-arrow')+arrow(o,pt,'measurement-direction'):'';
 const markerTransform=(cx,cy)=>{
  if(!live)return '';
  // Keep every marker round despite the plate's display projection. The
  // circle centers remain the original measurement coordinates and labels.
  const [a,b,c,d]=displayMatrix,det=a*d-b*c;
  const u=d/det,v=-b/det,w=-c/det,z=a/det;
  return `transform="matrix(${u} ${v} ${w} ${z} ${cx-u*cx-w*cy} ${cy-v*cx-z*cy})"`;
 };
 const face=(points,css)=>`<path d="M${points.map(p=>p.join(',')).join('L')}Z" class="reference-board-edge ${css}"/>`;
 const offset=p=>[p[0]+3,p[1]+4],lowerLeft=live&&frame.up?o:ideal,lowerRight=live&&frame.up?base:far;
 const depth=live?face([lowerLeft,lowerRight,offset(lowerRight),offset(lowerLeft)],'live-board-side')+face([base,far,offset(far),offset(base)],'live-board-side-right'):'';
 const labels=live?'':`<text x="${pt[0]-3}" y="${pt[1]+12}" text-anchor="end" class="reference-current-label">P</text><text x="${ideal[0]+6}" y="${ideal[1]+2}" class="reference-ideal-label">I</text><text x="66" y="18" class="measurement-end">300 mm</text><text x="69" y="29" class="reference-conversion">換算点</text>`;
 return `${depth}${live?`<g class="live-plate-scale" transform="${frame.transform}">`:''}<g class="pair-plane" transform="matrix(${matrix.join(' ')})"><path d="M32,54H88V26H32Z" class="reference-board"/>${live?'':'<path d="M32,54v4h56v-4M88,58V30l0,-4" class="reference-board-edge"/>'}<path d="M${x},26V${y}H88" fill="none" stroke="#81949d" stroke-width="1" stroke-dasharray="${live?'':'3 3'}" class="pair-ideal"/><line x1="${x}" y1="${y}" x2="88" y2="${y}" stroke="#333" stroke-width="2" class="pair-base"/>${live?'':'<path d="M83,51l5,3l-5,3" class="reference-base-arrow"/>'}${!live&&changed?`<path d="M${x},${y}L${bx},${by}L${tx},${ty}Z" fill="#db6a19" class="pair-change-area"/>`:''}${live?'':`<line x1="${x}" y1="${y}" x2="${bx}" y2="${by}" stroke="#a95b26" stroke-width="4" class="pair-before"/>`}<line x1="${x}" y1="${y}" x2="${tx}" y2="${ty}" stroke="#cb5709" stroke-width="2.5" class="pair-current"/>${live?'':`<line x1="${x}" y1="26" x2="${tx}" y2="${ty}" stroke="#536776" stroke-width="1.4" class="measurement-gap"/>`}<circle cx="${x}" cy="26" ${markerTransform(x,26)} r="2.8" fill="white" stroke="#81949d" stroke-width="1" class="measurement-ideal-tip"/>${live?'':`<path d="M${tx-4*ux-2*uy},${ty-4*uy+2*ux}L${tx},${ty}L${tx-4*ux+2*uy},${ty-4*uy-2*ux}" fill="none" stroke="#cb5709" stroke-width="1.4" class="measurement-direction"/>`}<circle cx="${tx}" cy="${ty}" ${markerTransform(tx,ty)} r="1.8" fill="#cb5709" class="measurement-current-tip"/><circle cx="${x}" cy="${y}" ${markerTransform(x,y)} r="2.3" fill="#333" class="measurement-origin"/></g>${live?'</g>':''}${arrows}<text x="${o[0]-3}" y="${o[1]+11}" text-anchor="end" class="measurement-start">0</text><text x="${o[0]-4}" y="${o[1]-2}" text-anchor="end" class="reference-origin-label">O</text><text x="${live?base[0]-4:base[0]+4}" y="${live?base[1]+(frame.up?-3:10):base[1]+3}" text-anchor="${live?'end':'start'}" class="pair-axis">${live?(current.kind==='lathe'?'主軸Z':'＋'+plot.base)+' '+r.baseDirection:plot.base}</text>${labels}${detail}`;
}
function diagramComparison(pair,initial){
 const before=initial?.pairs.find(p=>p.key===pair.key)||pair,plot=squarenessPlot(pair),beforePlot={...squarenessPlot(before),deviation:before.deviationMicroradians};
 const delta=pair.deviationMicroradians-before.deviationMicroradians,absoluteChange=Math.abs(pair.deviationMicroradians)-Math.abs(before.deviationMicroradians),epsilon=.005/(levelConfig?.offset||.5);
 const trend=absoluteChange < -epsilon?'better':absoluteChange>epsilon?'worse':'similar',direction=Math.abs(delta)<=1e-6?'unchanged':delta>0?'opened':'closed';
 const text=trend==='better'?'初期より直角に近づいた':trend==='worse'?'初期より直角から離れた':'初期からほぼ同じ';
 const range=plot.limited&&beforePlot.limited?'初期・現在が図の範囲外':plot.limited?'現在が図の範囲外':beforePlot.limited?'初期が図の範囲外':'';
 return {before,plot,beforePlot,delta,absoluteChange,trend,direction,text,range};
}
function accuracyDiagram(g,initial=levelInitialGeometry){
 const live=[],referenceCards=[];
 const columns=g.pairs.map((pair,i)=>{
  const c=diagramComparison(pair,initial),{plot,beforePlot}=c;
  const reference=squarenessReference(pair);
  // This fixed comparison length describes the local angle only. It does not
  // change the engine's evaluation length or simulate an NC travel/guide scan.
  const attributes=Object.entries({'projection':reference.projection.join(','),'zero-location':reference.zero,'base-direction':reference.baseDirection,'measure-direction':reference.measureDirection,'positive-direction':reference.positive,'negative-direction':reference.negative,'reference-plane':reference.plane,pair:pair.key,base:plot.base,other:plot.other,'measure-axis':plot.other,'measure-start':'0,0','measurement-length-m':squarenessMeasurementLength,'ideal-tip-x':plot.origin[0],'ideal-tip-y':26,'before-error-300':c.before.deviationMicroradians*squarenessMeasurementLength,'current-error-300':pair.deviationMicroradians*squarenessMeasurementLength,'delta-error-300':c.delta*squarenessMeasurementLength,gain:plot.gain,deviation:pair.deviationMicroradians,before:c.before.deviationMicroradians,current:pair.deviationMicroradians,delta:c.delta,trend:c.trend,direction:c.direction,limited:plot.limited,'before-limited':beforePlot.limited,'any-limited':plot.limited||beforePlot.limited,'origin-x':plot.origin[0],'origin-y':plot.origin[1],'tip-x':plot.tip[0],'tip-y':plot.tip[1],'before-tip-x':beforePlot.tip[0],'before-tip-y':beforePlot.tip[1]}).map(([name,value])=>`data-${name}="${value}"`).join(' ');
  const markup=squarenessMarkup(pair,plot,beforePlot)+(c.range?'<text x="104" y="64" text-anchor="end" class="live-pair-limit">範囲外</text>':'');
  const physical=referenceScan(pair),measurement=referenceDisplayScan(pair),beforeMeasurement=referenceDisplayScan(pair,positions,levelInitialSolution||levelSolution);
  const display=measurement,reading=display.valid?squarenessMicronText(display.microns):'—';
  referenceCards.push(referenceCard(pair,measurement,beforeMeasurement,physical));
  const descriptionText=pair.key+'・'+(display.valid?measurement.setup.zeroLocation+'を0とした300 mmの仮想測定 '+reading+' µm'+(current.kind==='compact'?'（触れと共通の仮想主軸姿勢）':''):display.reason)+'。計器は'+measurement.setup.body+'に固定。基準器に対して'+measurement.setup.relativeDirection+'へ移動。押込み'+measurement.setup.normalDirection+'が増えると＋。';
  live.push(`<div class="live-squareness-item"><svg class="live-squareness-diagram" viewBox="0 0 64 45" role="img" aria-label="${descriptionText}" aria-describedby="squarenessMeasurementNote" data-pair="${pair.key}" data-base="${measurement.setup.base}" data-other="${measurement.setup.scan}" data-measurement-length-m="0.3" data-view-right="${measurement.setup.normalDirection}" data-view-up="${measurement.setup.positiveScanDirection}" data-local-angle-microradians="${pair.deviationMicroradians}" data-measurement-model="${measurement.model}" data-zero-location-measurement="${measurement.setup.zeroLocation}" data-relative-direction="${measurement.setup.relativeDirection}" data-reading-microns="${display.valid?display.microns:''}" data-physical-reading-microns="${physical.valid?physical.microns:''}" data-reading-model="${display.model}" data-support-response-gain="${display.responseGain}">${referenceDiagram(measurement)}</svg><div class="live-pair-values" data-pair="${pair.key}" aria-label="${pair.key}の仮想測定値" aria-describedby="liveSquarenessUnits squarenessValuesNote"><span class="live-pair-base-value visually-hidden">接触開始 0</span><span class="live-pair-error-value" data-reading-microns="${display.valid?display.microns:''}" data-physical-reading-microns="${physical.valid?physical.microns:''}" data-reading-model="${display.model}" data-support-response-gain="${display.responseGain}" aria-label="${descriptionText}">${reading}</span><span class="live-pair-unit" aria-hidden="true"> µm</span></div></div>`);
  return `<g transform="translate(${i*112},0)" ${attributes}><text x="56" y="14" text-anchor="middle" class="pair-title">${pair.key} · 局所角度</text><g transform="translate(0,30)">${markup}</g></g>`;
 });
 $('liveSquareness').innerHTML=live.join('');
 $('liveSquarenessName').textContent=current.kind==='compact'?'仮想測定（触れと共通姿勢）':'仮想測定';
 $('liveSquarenessUnits').setAttribute('aria-label',current.kind==='compact'?'300 mm・マイクロメートル。小型のZ送りと触れに共通の仮想主軸姿勢。前後の支持応答は中央で約5倍。数値への後掛け倍率はありません。':'仮想測定300 mm・マイクロメートル');
 $('measurementReferenceCards').innerHTML=referenceCards.join('');
 $('accuracyDiagram').style.setProperty('--diagram-min-width',g.pairs.length*88+'px');
 $('accuracyDiagram').setAttribute('viewBox',`0 0 ${g.pairs.length*112} 123`);$('accuracyDiagram').innerHTML=columns.join('');
 $('accuracyDiagram').setAttribute('data-diagram-model','local-angle');
 $('accuracyDiagram').setAttribute('aria-label','現在位置の局所軸角度の300 mm換算。接触ゼロを取る有限走査図とは別。'+g.pairs.map(p=>p.key+'、基準'+squarenessPlot(p).base+'で初期からの変化を比較').join('。'));
}
function updateFineQualitative(g,initial){
 const lathe=current.kind==='lathe';
 for(const [key,id,negative,positive,label] of [['front','fineLeanFront',lathe?'下向き':'後ろ倒れ',lathe?'上向き':'前倒れ',lathe?'主軸の上下方向':'本体＋支持の前後倒れ'],['right','fineLeanRight',lathe?'左向き':'左倒れ',lathe?'右向き':'右倒れ',lathe?'主軸の水平面方向':'本体＋支持の左右倒れ']]){
  const value=g.bodyPosture[key];$(id).textContent=label+'：'+(Math.abs(value)<=20.000001?'小さめ':value>0?positive:negative);$(id).setAttribute('data-current',String(value));
 }
 const twist=levelSolution.twist;$('fineTwist').textContent='支持面のねじれ：'+(supports.length===3?'この支持配置は平面です':Math.abs(twist)<=.020000001?'小さめ':twist>0?'奥が手前より右高':'奥が手前より左高');$('fineTwist').setAttribute('data-current',String(twist));
 $('fineFixedBody').textContent='本体の固有直角差・'+(lathe||g.portal?'主軸の方向':'コラムの倒れ')+'・ガイドの曲がりは、この個体の固定成分です。支持姿勢を重ねた変化を見ます。';
 $('finePrecisionSummary').replaceChildren();
 for(const pair of g.pairs){
  const c=diagramComparison(pair,initial),row=document.createElement('p');row.className='fine-pair-reading '+c.trend;
  for(const [name,value] of Object.entries({pair:pair.key,before:c.before.deviationMicroradians,current:pair.deviationMicroradians,delta:c.delta,trend:c.trend,direction:c.direction}))row.setAttribute('data-'+name,String(value));
  row.textContent=pair.key+'：'+c.text+(c.direction==='unchanged'?'（軸間の関係はほぼ不変）':'')+(c.range?' · '+c.range:'');$('finePrecisionSummary').append(row);
 }
}
function updateAccuracy(){
 if(!levelSolution||!levelConfig)return;
 const rangeKey=JSON.stringify([current.id,current.kind,supportHeights,levelConfig,machineProfile]);
 const key=rangeKey+JSON.stringify([positions.X,positions.Y,positions.Z,positions.A,positions.C])+(current.kind==='compact'?String($('exaggerate').checked):'');
 if(key===accuracyKey&&levelGeometry)return;
 accuracyKey=key;
 if(rangeKey!==accuracyRangeKey||!accuracyRange){accuracyRangeKey=rangeKey;accuracyRange=geometrySamples();}
 const g=geometryModel();
 $('exaggerateLabel').textContent=current.kind==='compact'?'直角図のずれを強調':'傾き・姿勢差を強調';
 $('modelSemantics').textContent=current.kind==='compact'?'模型の姿勢は実寸／微小差は直角図で確認':g.portal?'柱・梁＝支持姿勢／ラム・主軸＝固有差込み':'水準器＝平均／模型＝局所＋固有';
 // The comparison is pointwise: both states use the current axis position,
 // dimensions, layout and evaluation length. The reference-search aggregate
 // is deliberately not used for this initial/current comparison.
 levelInitialSolution=machineProfile?machineSolution(machineProfile.initialHeights):null;
 levelInitialGeometry=levelInitialSolution?geometryModel(positions,levelInitialSolution,machineProfile,levelConfig.offset):null;
 const initial=levelInitialGeometry;
 g.visualFactor=fixedVisualFactor(levelInitialSolution);levelGeometry=g;
 const lengthMm=Math.round(levelConfig.offset*1000),maxError=Math.max(...g.pairs.map(p=>Math.abs(p.errorMicrons)));
 $('accuracyLength').textContent=lengthMm+' mmで確認';
 $('comparisonContext').hidden=!initial;
 if(initial)$('comparisonContext').textContent=(machineProfile.condition==='new'?'新品':'中古')+'個体 #'+machineProfile.seed+'：初期の差は数値で示しません。今の軸位置、寸法、コラム配置、評価長で現在の精度を確認します。';
 const columnDifference=g.columns.length===2?Math.abs(g.columns[1].front-g.columns[0].front):0;
 $('geometryStatus').textContent=g.pairs.map(p=>p.key+' '+diagramComparison(p,initial).text).join(' ／ ');
 $('accuracyMetrics').replaceChildren();
 for(const p of g.pairs){
  const samples=accuracyRange.map(s=>s.geometry.pairs.find(q=>q.key===p.key).errorMicrons),low=Math.min(...samples),high=Math.max(...samples),box=document.createElement('div');
  const before=initial?.pairs.find(q=>q.key===p.key),change=before?accuracyChange(before.errorMicrons,p.errorMicrons):null;
  box.className='accuracy-metric'+(change?.trend==='worse'?' changed':change?.trend==='better'?' improved':'');
  const label=document.createElement('span'),value=document.createElement('strong'),angle=document.createElement('small'),travel=document.createElement('small');
  label.textContent=current.kind==='lathe'?'主軸基準XZ（送りZとは別）':p.key+' 直角度';value.textContent=signed(p.errorMicrons,2)+' µm';
  value.setAttribute('id','accuracy-current-'+p.key);value.setAttribute('data-value',String(p.errorMicrons));
  angle.textContent=cleanNumber(p.angleDegrees,6)+'° · 90°との差';travel.textContent='端・中央の比較 '+signed(low,2)+' 〜 '+signed(high,2)+' µm';box.append(label,value);
  if(before){
   const baseline=document.createElement('small'),delta=document.createElement('small'),trend=document.createElement('small');
   baseline.setAttribute('id','accuracy-before-'+p.key);baseline.setAttribute('data-value',String(before.errorMicrons));baseline.hidden=true;
   delta.setAttribute('id','accuracy-delta-'+p.key);delta.setAttribute('data-value',String(change.delta));delta.className='accuracy-delta';delta.hidden=true;
   trend.setAttribute('id','accuracy-trend-'+p.key);trend.setAttribute('data-trend',change.trend);trend.setAttribute('data-absolute-change',String(change.absoluteChange));trend.className='accuracy-trend '+change.trend;trend.textContent=change.text;
   box.append(baseline,delta,trend);
  }
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='角度・端/中央';details.className='accuracy-detail';details.append(summary,angle,travel);
  if(machineProfile){const split=document.createElement('small');split.textContent='本体の固有成分と支持姿勢を重ねた現在の測定値です。';details.append(split);}
  box.append(details);$('accuracyMetrics').append(box);
 }
 const lathe=current.kind==='lathe',postureLabels=lathe?['主軸の上下方向差','主軸の水平面方向差']:['前後倒れ','左右倒れ'];
 $('bodyLeanHeading').textContent=lathe?'主軸の方向：本体＋支持姿勢':'コラムの倒れ：本体＋支持姿勢';
 $('bodyLeanValues').replaceChildren();
 for(const [i,key] of ['front','right'].entries()){
  const row=document.createElement('p');row.className='body-lean-row';row.setAttribute('data-metric',key);
  for(const [name,value] of [['intrinsic',g.bodyIntrinsicPosture[key]],['support',g.bodySupportPosture[key]],['combined',g.bodyPosture[key]]])row.setAttribute('data-'+name,String(value));
  row.textContent=postureLabels[i]+'：現在 '+signed(g.bodyPosture[key],2)+' µrad';$('bodyLeanValues').append(row);
 }
 postureComparison('bodyLeanComparison',initial?['front','right'].map((key,i)=>({key,label:postureLabels[i],before:initial.bodyPosture[key],current:g.bodyPosture[key]})):[],'µrad');
 $('bodyLeanNote').textContent=lathe?'固有XZ差は水平面内の主軸の方向ずれです。主軸方向に支持姿勢を重ねた模式表示で、コラムの鉛直倒れとは区別します。':'本体は抽選した固有直角差から求めたコラムの代表方向、支持はこの位置の据付姿勢です。合成は両方を回転として重ねた実値です。平均レベルが揃っても本体の倒れは残ります。';
 if(current.kind==='compact')$('bodyLeanNote').textContent+=' 前後倒れは床の鉛直に対する姿勢です。YZは測定PのY送りに対するZ送りを測るため、両方が一緒に傾けば、前倒れから後ろ倒れへ変わっても値は改善しません。上段の直角測定と触れは共通の仮想主軸姿勢を使い、中央の前後支持応答を約5倍にしています。模型姿勢・局所角度・調整評価は元の計算です。';
 $('columnLean').textContent=lathe?'上下 '+signed(g.bodyPosture.front,2)+' µrad ／ 水平面 '+signed(g.bodyPosture.right,2)+' µrad':leanDescription(g.bodyLean.front,'後ろ倒れ','前倒れ')+' ／ '+leanDescription(g.bodyLean.right,'左倒れ','右倒れ');
 $('relativeLean').textContent='前後 '+signed(g.relativeLean.front,2)+' µrad ／ 左右 '+signed(g.relativeLean.right,2)+' µrad';
 const dual=g.columns.length===2;$('columnDifference').hidden=!dual;
 $('postureHeading').textContent=current.kind==='lathe'?'支持による主軸台の倒れとねじれ':dual?'支持による左右コラムの倒れとねじれ':'支持によるコラムの倒れとねじれ';
 $('demoColumn').textContent=current.kind==='lathe'?'主軸台の姿勢を見る':'コラムの倒れを見る';
 if(dual)$('columnDifference').textContent='支持による左コラム：'+leanDescription(g.columns[0].front,'後ろ倒れ','前倒れ')+' ／ 右コラム：'+leanDescription(g.columns[1].front,'後ろ倒れ','前倒れ')+'。支持による左右の前後倒れ差 '+cleanNumber(Math.abs(g.columns[1].front-g.columns[0].front),2)+' µrad';
 postureComparison('columnLeanComparison',initial?[
  {key:'front',label:'支持による前後倒れ',before:initial.toolLean.front,current:g.toolLean.front},
  {key:'right',label:'支持による左右倒れ',before:initial.toolLean.right,current:g.toolLean.right}
 ]:[],'µrad');
 postureComparison('relativeLeanComparison',initial?[
  {key:'front',label:'支持による案内との前後姿勢差',before:initial.relativeLean.front,current:g.relativeLean.front},
  {key:'right',label:'支持による案内との左右姿勢差',before:initial.relativeLean.right,current:g.relativeLean.right}
 ]:[],'µrad');
 postureComparison('columnDifferenceComparison',initial&&dual?[{key:'frontDifference',label:'門の前後倒れ差（右−左）',before:initial.columns[1].front-initial.columns[0].front,current:g.columns[1].front-g.columns[0].front}]:[],'µrad');
 $('columnDifferenceComparison').hidden=!initial||!dual;
 postureComparison('twistComparison',initial?[{key:'twist',label:'支持面のねじれ（奥−手前）',before:levelInitialSolution.twist,current:levelSolution.twist}]:[],'mm/m',6);
 if(initial&&supports.length===3){const note=document.createElement('p');note.className='hint';note.textContent='3点支持モデルは必ず平面なので、ねじれは常に0です。倒れの変化を見比べます。';$('twistComparison').append(note);}
 const coordinates=p=>{const q=levelCoordinates(p.x,p.z);return '左右 '+signed(q.x,2)+' m・前後 '+signed(q.z,2)+' m';};
 $('geometryPosition').textContent=(dual?'門中心':current.kind==='lathe'?'主軸台':'コラム')+'：'+coordinates(g.poses.tool.anchor)+' ／ '+(current.kind==='lathe'?'往復台基準':['vertical','compact'].includes(current.kind)?'サドル基準':'テーブル基準')+'：'+coordinates(g.workPoint);
 const rangeMax=Math.max(...accuracyRange.flatMap(s=>s.geometry.pairs.map(p=>Math.abs(p.errorMicrons))));
 const postureDifference=Math.hypot(g.relativeLean.front,g.relativeLean.right);
 $('accuracyDiagnosis').textContent=initial?(dual?'支持点を少し動かし、直角図と左右コラムの変化を見比べてください。':'支持点を少し動かし、固定表示の直角図と現在の倒れ・ねじれを見比べてください。')+' 90°からのずれの大小は絶対値で判断し、倒れの減少だけで全精度の改善とはしません。':columnDifference>.001?'左右コラムが違う姿勢です。平均の直角度だけでは門のねじれを見落とすため、左右の前後倒れ差も確認してください。':maxError<.00001?(rangeMax>.001?'今の位置では直角です。端・中央の比較では直角度が変わります。軸を動かして確認してください。':postureDifference>.001?'表示した軸間の直角差は0ですが、工具側とテーブル側の姿勢差は残っています。前後・左右の姿勢差も確認してください。':'工具側と案内側が同じ姿勢です。全体が傾いても、相対直角度は保たれています。'):'支持面の局所姿勢が違うため、直角度が変化しています。支持点を調整して、端・中央の値を比べてください。';
 const localSource=key=>g.axes.filter(a=>a.source===key).map(a=>a.key).join('・');
 $('geometryAssumption').textContent=current.kind==='lathe'?'上段はタレット旋盤の検査図です。この詳細欄の角度差は主軸基準XZ（主軸方向と刃物台Xの比較）です。NC送りX–Zの案内直角度ではありません。模型のZ矢印は往復台の送り方向です。Y軸はありません。':localSource('tool')+'はコラム／主軸側、'+localSource('work')+'はテーブル／案内側の参照姿勢を使う教材です。同じ剛体側の軸対は共通の傾きでは関係が変わりません。'+(current.kind==='five'?'A/Cの旋回誤差は含みません。':'');
 if(['travel','gantry'].includes(current.kind))$('geometryAssumption').textContent='Xは移動位置の走行案内、Y/Zはコラム・梁側の参照姿勢です。固定ワークの姿勢をX送りへ代用しません。';
 if(['travel','horizontal'].includes(current.kind))$('geometryAssumption').textContent='Xは二本の走行レール、'+(current.kind==='travel'?'Y/Zはコラム取付部':'Yはコラム取付部、Zはパレット側')+'の姿勢を使います。取付ベースの相対変形を幾何的に近似する教材で、剛性・荷重・水平面内の曲がりは計算しません。';
 if(['vertical','compact'].includes(current.kind))$('geometryAssumption').textContent+=' Xテーブル送りではサドルの支持参照は移動せず、Yサドル送りで移動します。';
 if(current.kind==='compact')$('geometryAssumption').textContent='右端：左端の相対曲げ剛性を3：1と仮定した、2モードの板曲げ教材です。支持4点を保持して曲率エネルギーを最小にする変形面を使います。実機の剛性を同定した値ではなく、自由板の厳密解・荷重や接触の構造解析ではありません。直角図のX/Yはテーブル上面中心の仮想測定点P（支持基準から0.50 m）の実際の送り接線、Zは主軸頭の送り方向です。サドルの倒れが位置で変わることによるアッベ影響と固有誤差を含みます。設定内の局所軸角度図は現在位置の送り角の300 mm換算です。常設の仮想測定欄は、方向合わせと接触ゼロを取り直した300 mmの有限走査を元にします。小型のZ送りと触れは共通の仮想主軸姿勢で測定し、中央の前後支持応答を約5倍にしています。局所角度と模型は元の姿勢のままです。どちらも補正済みの軸固有直角度ではありません。Xではサドル支持参照を動かさず、Yで移動します。剛性・荷重・接触を解く構造解析や実機精度検査の再現ではありません。';
 if(current.kind==='lathe')$('geometryAssumption').textContent+=' 径送りXでは往復台のベッド参照は移動せず、長手Zで移動します。ベッドのロールによる刃先高さ差と水平面内の曲がりは、この直角図には含みません。';
 if(dual){$('bodyLeanHeading').textContent='主軸の代表方向：本体＋支持姿勢';$('bodyLeanNote').textContent='門の骨格は接続した支持姿勢で描き、固有直角差はラム・主軸の向き、軸矢印と直角図へ重ねます。主軸方向の値と左右柱の支持倒れは別です。柱の平均倒れをラムZへ伝え、梁案内Yとの直角差を表示します。位置ごとの弾性ねじれ・主軸移動荷重は再現しません。';}
 if(dual)$('geometryAssumption').textContent+=' 左右柱の天端を梁で結び、平均倒れをラム方向へ伝えるせん断の幾何モデルです。柱・梁の接続中心を共有します。梁の反力・たわみ分布・接触荷重は計算しません。模型の門骨格は支持姿勢、ラム・主軸は固有直角差を含む代表方向に沿って描きます。';
 $('columnLayout').hidden=!singleColumnKinds.includes(current.kind);
 $('columnXValue').textContent=levelConfig.columnX===0?'標準':levelConfig.columnX<0?'左寄り':'右寄り';$('columnX').setAttribute('aria-valuetext',$('columnXValue').textContent);
 $('columnZValue').textContent=levelConfig.columnZ===0?'標準':levelConfig.columnZ<0?'手前寄り':'奥寄り';$('columnZ').setAttribute('aria-valuetext',$('columnZValue').textContent);
 $('demoTwist').disabled=supports.length===3;
 accuracyDiagram(g,initial);updateFineQualitative(g,initial);
}
for(const id of ['columnX','columnZ'])$(id).oninput=()=>{const value=Number($(id).value);if(!bounded(value,-100,100)||!Number.isInteger(value))return;stopMotion();levelConfig[id]=value;updateLeveling();};
$('resetColumn').onclick=()=>{stopMotion();levelConfig.columnX=0;levelConfig.columnZ=0;$('columnX').value='0';$('columnZ').value='0';updateLeveling();};
$('demoTwist').onclick=()=>{
 if(supports.length===3)return;stopMotion();applyLevelPreset('twist');
 const preferred=current.kind==='vertical'||current.kind==='compact'?'XZ':null;
 const score=s=>Math.max(...s.geometry.pairs.filter(p=>!preferred||p.key===preferred).map(p=>Math.abs(p.errorMicrons)));
 const best=accuracyRange.reduce((a,b)=>score(a)>=score(b)?a:b);positions={...best.state};updateAxisValues();
 $('levelInputMessage').textContent=score(best)>.001?'対角ねじれを設定し、直角度の差が出る軸位置へ動かしました。':'対角ねじれを設定しました。左右コラムの姿勢差を確認してください。';updateLeveling();
};
$('demoColumn').onclick=()=>{
 stopMotion();positions={X:0,Y:0,Z:0,A:0,C:0};updateAxisValues();
 const rear=Math.max(...supports.map(s=>s.z)),index=supports.findIndex(s=>s.z===rear);
 supportHeights=supports.map((s,i)=>i===index?.3:0);levelExercise=null;
 if(singleColumnKinds.includes(current.kind)){levelConfig.columnX=60;levelConfig.columnZ=0;$('columnX').value='60';$('columnZ').value='0';}
 $('levelInputMessage').textContent=current.kind==='lathe'?'奥側の支持点を上げました。主軸台と刃物台の姿勢差を比べてください。':'奥側の支持点を上げました。コラムの倒れと、テーブルとの姿勢差を比べてください。';updateLeveling();
};

function accuracyVisualVector(key){
 const axes=axisConfig(current).filter(a=>['X','Y','Z'].includes(a.key));
 if(current.kind==='lathe'&&key==='Z')return [...axes.find(a=>a.key==='Z').vector];
 const factor=displayFactor();
 const profile=scaledAccuracyProfile(machineProfile,factor);
 return window.MachineAccuracy.directions(axes,profile).find(a=>a.key===key).vector;
}

// The reference lesson lives in the existing lower scroll area; the model and
// support action buttons remain fixed. Opening it never alters a measurement.
let measurementReferenceScrollTop=0;
function toggleMeasurementReference(force){
 const panel=$('measurementReference'),open=force===undefined?panel.hidden:force,scroll=$('adjustmentSelectionScroll');
 if(open&&panel.hidden)measurementReferenceScrollTop=scroll.scrollTop;
 panel.hidden=!open;$('measurementReferenceToggle').setAttribute('aria-expanded',String(open));
 if(open){scroll.scrollTop=panel.offsetTop-scroll.offsetTop;panel.focus?.({preventScroll:true});}
 else scroll.scrollTop=measurementReferenceScrollTop;
}
$('measurementReferenceToggle').onclick=()=>toggleMeasurementReference();
$('closeMeasurementReference').onclick=()=>{toggleMeasurementReference(false);$('measurementReferenceToggle').focus?.({preventScroll:true});};

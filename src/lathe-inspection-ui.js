'use strict';
// Lathe-only rigid assemblies on the existing support surface. Separating the
// common rotation makes a rigid tilt a common transform, not an alignment error.
function latheAssembly(raw,pose,state=positions,solution=levelSolution,profile=machineProfile,factor=1){
 const V=window.LatheInspection,L=window.Leveling,scale=p=>{const q=levelCoordinates(p[0],p[2]);return [q.x,p[1],q.z];};
 const bar=pose==='latheTestBar';if(bar)pose='tool';
 const base=scale(pose==='tool'?[-current.w*.35,.66,0]:[.08,.66,.15]);
 const travel=pose==='work'?scale([.7*state.Z/100,0,.35*state.X/100]):[0,0,0],seat=V.add(base,[travel[0],0,0]);
 const common=L.orientation({lr:solution.lr*factor,fb:solution.fb*factor}),slope=solution.slopeAt(seat[0],seat[2]),local=L.orientation({lr:(slope.lr-solution.lr)*factor,fb:(slope.fb-solution.fb)*factor});
 const body=pose==='tool'?intrinsicBodyFrame(axisConfig(current),profile,factor):{rotate:v=>v};
 const rotate=v=>common.rotate(local.rotate(body.rotate(v)));
 const plane=solution.plane,residual=solution.heightAt(seat[0],seat[2])-(plane.a*seat[0]+plane.b*seat[2]+plane.c);
 const origin=V.add(common.rotate([seat[0],residual*factor/1000,seat[2]]),[0,.66+plane.c*factor/1000,0]);
 // Support dimensions scale the machine layout and bar length, but never the
 // calibrated 50 mm circular cross-section around the spindle centre line.
 const material=scale(raw);if(bar)material[2]=raw[2];
 const relative=V.add(V.sub(material,base),[0,0,travel[2]]);
 return {point:V.add(origin,rotate(relative)),rotate};
}
const latheFixtureSpec=Object.freeze({boreRadius:.025,boreDepth:.060,holderRadius:.035,holderLength:.150,inspectionDepth:.030,arborRadius:.008,minReach:.100,maxReach:.350,carrierRadius:.017,carrierHalfThickness:.003,probeBaseRadius:.014,ballRadius:.001,adapterMin:.100,adapterMax:.450,adapterWidth:.080,nominalX:-.20/.35*100});
function latheBoreMeasurement(state=positions,solution=levelSolution,profile=machineProfile,fixture=null){
 const V=window.LatheInspection,{add,sub,mul,dot,unit}=V,S=latheFixtureSpec,k=V.intrinsic(profile),head=latheAssembly([-current.w*.24+.125,1.5,0],'tool',state,solution,profile),mount=latheAssembly([-.09,1.5,.20],'work',state,solution,profile),seat=latheAssembly([-.09,1.5,.52],'work',state,solution,profile),axis=unit(head.rotate([1,0,0])),radial=unit(head.rotate([0,0,1])),up=unit(head.rotate([0,1,0])),holeAxis=unit(mount.rotate([1,0,0])),rear=add(mount.point,mount.rotate([0,k.holeY,k.holeX])),entry=sub(rear,mul(holeAxis,S.holderLength)),target=add(entry,mul(holeAxis,S.inspectionDepth)),reach=fixture?fixture.reach:dot(sub(target,head.point),axis),centre=add(head.point,mul(axis,reach)),cos=dot(axis,holeAxis),sin=Math.sqrt(Math.max(0,1-cos*cos)),adapterLength=Math.hypot(...sub(seat.point,mount.point));
 const axial=p=>dot(sub(p,entry),holeAxis),radialDistance=p=>Math.hypot(...sub(sub(p,entry),mul(holeAxis,axial(p)))),carrierEnds=[-1,1].map(sign=>add(centre,mul(axis,sign*S.carrierHalfThickness))),carrierAxialHalf=S.carrierHalfThickness*Math.abs(cos)+S.carrierRadius*sin,entranceReach=Math.abs(cos)>1e-12?-axial(head.point)/cos:NaN,entranceCentre=add(head.point,mul(axis,entranceReach)),carrierRadialClearance=S.boreRadius-Math.max(...carrierEnds.map(radialDistance))-S.carrierRadius,carrierEntryClearance=axial(centre)-carrierAxialHalf,carrierBottomClearance=S.boreDepth-axial(centre)-carrierAxialHalf,arborClearance=cos>0?S.boreRadius-Math.max(radialDistance(entranceCentre),radialDistance(centre))-S.arborRadius/cos:-Infinity;
 let reason=fixture&&!fixture.valid?'最初の取付けが無効：'+fixture.reason:!Number.isFinite(reach)||reach<S.minReach-1e-12||reach>S.maxReach+1e-12?'主軸治具の到達100〜350 mm範囲外':adapterLength<S.adapterMin-1e-12||adapterLength>S.adapterMax+1e-12?'ホルダ接続腕100〜450 mmの範囲外':levelCoordinates(.16,0).x<S.adapterWidth-1e-12||levelCoordinates(0,.30).z<S.adapterWidth-1e-12?'既存ホルダの80 mm取付座が不足':cos<=0||!Number.isFinite(entranceReach)||entranceReach<=0||entranceReach>reach?'穴入口へ主軸側から挿入できない':carrierRadialClearance<-1e-12?'回転ヘッドが穴の内壁と干渉':carrierEntryClearance<-1e-12||carrierBottomClearance<-1e-12?'回転ヘッドが穴の入口・底と干渉':arborClearance<-1e-12?'アーバが穴の入口・内壁と干渉':null;
 const directions=[radial,up,mul(radial,-1),mul(up,-1)],contacts=directions.map(probe=>{const body=add(centre,mul(probe,S.probeBaseRadius));return {body,probe,...V.internalCylinderContact({body,probe,origin:entry,direction:holeAxis,radius:S.boreRadius,length:S.boreDepth,ballRadius:S.ballRadius})};});
 if(!reason)reason=contacts.find(c=>!c.valid)?.reason||null;
 // Check the intervening rotation as well as the four displayed directions.
 // The carrier/shaft envelopes are continuous; tip/cavity contacts are sampled.
 if(!reason)for(let i=0;i<72;i++){const angle=i*Math.PI/36,probe=add(mul(radial,Math.cos(angle)),mul(up,Math.sin(angle))),body=add(centre,mul(probe,S.probeBaseRadius)),hit=V.internalCylinderContact({body,probe,origin:entry,direction:holeAxis,radius:S.boreRadius,length:S.boreDepth,ballRadius:S.ballRadius});if(!hit.valid){reason='回転途中：'+hit.reason;break;}}
 const valid=!reason,zeroExtension=fixture?fixture.zeroExtension:contacts[0].extension,readings=valid?contacts.map(c=>(zeroExtension-c.extension)*1e6):null,sectionAlong=Math.abs(cos)>1e-12?dot(sub(centre,entry),axis)/cos:NaN,sectionCentre=add(entry,mul(holeAxis,sectionAlong)),sectionDelta=sub(sectionCentre,centre),snapshot=fixture||{valid,reason,reach,zeroExtension:valid?zeroExtension:null,state:{...state}};
 return {valid,reason,readings,dx:valid?(readings[2]-readings[0])/2:null,dy:valid?(readings[3]-readings[1])/2:null,fixture:snapshot,head:head.point,axis,radial,up,entry,holeAxis,rear,centre,contacts,reach,adapterLength,adapterSeat:seat.point,clearance:{carrierRadial:carrierRadialClearance,carrierEntry:carrierEntryClearance,carrierBottom:carrierBottomClearance,arbor:arborClearance},geometricSectionCentreUm:{x:dot(sectionDelta,radial)*1e6,y:dot(sectionDelta,up)*1e6},spec:S};
}
function latheBoreFixture(state=positions,solution=levelSolution,profile=machineProfile){return latheBoreMeasurement(state,solution,profile).fixture;}
function latheSetInspectionPosition(kind){
 if(current.kind!=='lathe')return;
 if($('fixtureSelection'))$('fixtureSelection').value=kind;
 if(typeof moveToFixtureStation==='function'){moveToFixtureStation();return;}
 positions={...positions,X:latheFixtureSpec.nominalX,Z:-100};
 if(typeof resetFixtureComparison==='function')resetFixtureComparison('測定位置へ移動したため、取付けとゼロの保持を解除しました。');
 if(typeof invalidateLevelImport==='function')invalidateLevelImport();
 updateAxisValues();updateLeveling();if(typeof saveLeveling==='function')saveLeveling();
}
function latheHead(state,solution,profile){return latheAssembly([-current.w*.24+.125,1.5,0],'tool',state,solution,profile);}
function latheLocal(frame,p){const V=window.LatheInspection,d=V.sub(p,frame.point);return [[1,0,0],[0,1,0],[0,0,1]].map(e=>V.dot(frame.rotate(e),d));}
function latheDirectionLocal(frame,p){const V=window.LatheInspection;return [[1,0,0],[0,1,0],[0,0,1]].map(e=>V.dot(frame.rotate(e),p));}
function latheCarry(frame,p){return window.LatheInspection.add(frame.point,frame.rotate(p));}
function latheSampleFractions(start,end,key){
 const fractions=new Set(Array.from({length:33},(_,i)=>i/32));
 if(key==='Z'){
  const from=levelCoordinates(.08+.7*start.Z/100,0).x,to=levelCoordinates(.08+.7*end.Z/100,0).x;
  for(const p of supports){const t=(levelCoordinates(p.x,p.z).x-from)/(to-from);if(t>0&&t<1)for(const d of [-1e-8,0,1e-8])fractions.add(Math.max(0,Math.min(1,t+d)));}
 }
 return [...fractions].sort((a,b)=>a-b);
}
// A segment against the finite turret expanded by the fixture's bounding
// radius. Clipping all half-spaces is conservative for the circular beam body.
function latheTurretInterference(a,b,state,solution,profile,radius){
 const V=window.LatheInspection,F=latheAssembly([0,0,0],'work',state,solution,profile),A=latheLocal(F,a),B=latheLocal(F,b),delta=V.sub(B,A),sx=levelCoordinates(1,0).x,sz=levelCoordinates(0,1).z;
 const planes=[{n:[-1,0,0],c:.09*sx},{n:[1,0,0],c:.25*sx},...Array.from({length:12},(_,i)=>{const angle=i*Math.PI/6,c=Math.cos(angle),s=Math.sin(angle);return {n:[0,c,s/sz],c:.43+1.5*c+s};})];
 let lo=0,hi=1;
 for(const {n,c} of planes){const bound=c+radius*Math.hypot(...n)-V.dot(n,A),den=V.dot(n,delta);if(Math.abs(den)<1e-15){if(bound<0)return false;}else if(den>0)hi=Math.min(hi,bound/den);else lo=Math.max(lo,bound/den);if(lo>hi)return false;}
 return true;
}
function latheBarInterference(a,b,head,axis,radius,surfaceRadius=.025,minimum=0,maximum=.4){
 const V=window.LatheInspection,q=V.sub(a,head),d=V.sub(b,a),t0=V.dot(q,axis),dt=V.dot(d,axis),rad=V.sub(q,V.mul(axis,t0)),dr=V.sub(d,V.mul(axis,dt));let lo=0,hi=1;
 if(Math.abs(dt)<1e-15){if(t0<minimum||t0>maximum)return false;}else{const ends=[(minimum-t0)/dt,(maximum-t0)/dt].sort((x,y)=>x-y);lo=Math.max(lo,ends[0]);hi=Math.min(hi,ends[1]);if(lo>hi)return false;}
 const den=V.dot(dr,dr),t=den?Math.max(lo,Math.min(hi,-V.dot(rad,dr)/den)):lo;
 return Math.hypot(...V.add(rad,V.mul(dr,t)))<surfaceRadius+radius-1e-12;
}
function latheScanSetup(key,state=positions,solution=levelSolution,profile=machineProfile){
 const V=window.LatheInspection,{add,sub,mul,dot,unit}=V,face=key==='face.X'||key==='face.Z',travelKey=key==='face.X'?'X':'Z',half=travelKey==='X'?levelCoordinates(0,.35).z:levelCoordinates(.7,0).x,start={...state},end={...state,[travelKey]:state[travelKey]+.3/half*100},head=latheHead(start,solution,profile),k=V.intrinsic(profile);
 let reason=end[travelKey]>100+1e-9||start[travelKey]<-100-1e-9?'現在位置から300 mmの正方向走査ができない':null,owner,body,probe,path,raw,normal,root;
 if(face){
  raw=key==='face.X'?[-.09,1.5,1]:[.23,1.5,.57];normal=key==='face.X'?[-Math.cos(k.face),0,-Math.sin(k.face)]:[-Math.sin(k.flat),0,-Math.cos(k.flat)];
  const plane=latheAssembly(raw,'work',start,solution,profile);owner=head;probe=mul(plane.rotate(normal),-1);body=sub(plane.point,mul(probe,.01));root=latheAssembly([-current.w*.35+.4,1.5,.55],'tool',start,solution,profile).point;
  const tail=sub(body,mul(probe,.05)),d=latheDirectionLocal(head,sub(tail,root)),rootLocal=latheLocal(head,root),tailLocal=latheLocal(head,tail),safeZ=levelCoordinates(0,.10).z;
  // First go around the chuck at the headstock's outer front face, then
  // enter the clear space in front of it, before approaching the turret.
  path=[root,latheCarry(head,[.05,0,rootLocal[2]]),latheCarry(head,[.05,0,safeZ]),latheCarry(head,[tailLocal[0],0,safeZ]),latheCarry(head,[tailLocal[0],0,tailLocal[2]]),tail];
  if(!reason&&(d[0]<0||d[0]>.95+1e-12||Math.abs(d[2])>.7+1e-12||Math.abs(d[1])>.15+1e-12))reason='主軸台検査梁の到達範囲外（前950・横700・縦150 mm）';
 }else{
  owner=latheAssembly([-.09,1.5,.52],'work',start,solution,profile);root=owner.point;
  const axis=unit(head.rotate([1,0,0])),radial=unit(head.rotate([0,0,1])),up=unit(head.rotate([0,1,0])),n=key==='bar.side'?radial:up,first=add(head.point,mul(axis,.05)),rootAxis=add(head.point,mul(axis,dot(sub(root,head.point),axis)));
  body=add(first,mul(n,.035));probe=mul(n,-1);
  path=key==='bar.side'?[root,add(rootAxis,mul(n,.085)),add(first,mul(n,.085))]:[root,add(root,mul(up,.085-dot(sub(root,rootAxis),up))),add(rootAxis,mul(up,.085)),add(first,mul(up,.085))];
  const upstream=dot(sub(rootAxis,first),axis),crossSegments=path.slice(0,-2).map((p,i)=>Math.hypot(...sub(path[i+1],p)));
  if(!reason&&(upstream<0||upstream>.35+1e-12||crossSegments.some(length=>length>.45+1e-12)))reason='タレット計器腕の到達範囲外（軸350・横450 mm）';
  if(!reason&&(levelCoordinates(.16,0).x<.04-1e-12||levelCoordinates(0,.30).z<.04-1e-12))reason='既存ホルダの40 mm取付座が不足';
 }
 const fixture={key,kind:face?'face':'bar',valid:!reason,reason,start,end,travelKey,raw,normal,bodyLocal:latheLocal(owner,body),probeLocal:latheDirectionLocal(owner,probe),pathLocal:path.map(p=>latheLocal(owner,p)),zeroExtension:.01};
 if(!reason){const initial=latheEvaluateScan(fixture,solution,profile);if(!initial.valid){fixture.valid=false;fixture.reason=initial.reason;}else fixture.zeroExtension=initial.samples[0].extension;}
 return fixture;
}
function latheEvaluateScan(fixture,solution=levelSolution,profile=machineProfile){
 const V=window.LatheInspection,{add,sub,mul,dot,unit}=V,f=fixture,sx=levelCoordinates(1,0).x,sz=levelCoordinates(0,1).z;
 if(!f.valid)return {valid:false,reason:f.reason,microns:null,samples:[],fixture:f};
 const samples=latheSampleFractions(f.start,f.end,f.travelKey).map(t=>{
  const state={...f.start,[f.travelKey]:f.start[f.travelKey]+(f.end[f.travelKey]-f.start[f.travelKey])*t},head=latheHead(state,solution,profile),owner=f.kind==='face'?head:latheAssembly([-.09,1.5,.52],'work',state,solution,profile),body=latheCarry(owner,f.bodyLocal),probe=owner.rotate(f.probeLocal),path=f.pathLocal.map(p=>latheCarry(owner,p));let hit,reason;
  if(f.kind==='face'){
   const plane=latheAssembly(f.raw,'work',state,solution,profile);hit=V.planeContact({body,probe,point:plane.point,normal:plane.rotate(f.normal)});
   if(hit.valid){const local=latheLocal(plane,hit.point),material=add([f.raw[0]*sx,f.raw[1],f.raw[2]*sz],local),onFace=f.key==='face.X'?Array.from({length:12},(_,i)=>i*Math.PI/6).every(a=>Math.cos(a)*(material[1]-1.5)+Math.sin(a)*(material[2]/sz-1)<=.43+1e-9):material[0]>=-.09*sx-1e-9&&material[0]<=.25*sx+1e-9&&Math.abs(material[1]-1.5)<=.43*Math.tan(Math.PI/12)+1e-9;
    hit={...hit,material};if(!onFace)reason='タレット測定面の範囲外';
   }
   if(!reason&&path.some((p,i)=>i&&latheTurretInterference(path[i-1],p,state,solution,profile,.02)))reason='主軸台検査梁が移動タレットと干渉';
   if(!reason&&latheTurretInterference(path.at(-1),body,state,solution,profile,.008))reason='計器本体が移動タレットと干渉';
   const axis=unit(head.rotate([1,0,0])),chuckBack=-levelCoordinates(.28,0).x;
   if(!reason&&path.some((p,i)=>i&&latheBarInterference(path[i-1],p,head.point,axis,.02,.4,chuckBack,.02)))reason='主軸台検査梁がチャックと干渉';
   if(!reason&&latheBarInterference(path.at(-1),body,head.point,axis,.008,.4,chuckBack,.008))reason='計器本体がチャックと干渉';
  }else{
   const axis=unit(head.rotate([1,0,0]));hit=V.cylinderContact(body,probe,head.point,axis,.025,.4);
   if(path.some((p,i)=>i&&latheBarInterference(path[i-1],p,head.point,axis,.02)))reason='取付腕がテストバーと干渉';
   if(!reason&&latheBarInterference(path.at(-1),body,head.point,axis,.008))reason='計器本体がテストバーと干渉';
   // The chuck occupies the half-space behind its front face. Every finite
   // beam/body point, with radius allowance, must remain ahead of that face.
   if(!reason&&path.some(p=>dot(sub(p,head.point),axis)<.02-1e-12))reason='取付腕がチャック前面と干渉';
   if(!reason&&Math.min(dot(sub(body,head.point),axis),dot(sub(path.at(-1),head.point),axis))<.008-1e-12)reason='計器本体がチャック前面と干渉';
   if(!reason&&path.slice(1).some((p,i)=>i&&latheTurretInterference(path[i],p,state,solution,profile,.02)))reason='取付腕がタレットと干渉';
  }
  return {...hit,t,state,body,probe,path,...(reason?{valid:false,reason}:{})};
 });
 const bad=samples.find(s=>!s.valid),first=samples[0],last=samples.at(-1);
 return {valid:!bad,reason:bad?.reason||null,microns:bad?null:(f.zeroExtension-last.extension)*1e6,zero:first,last,samples,fixture:f};
}
function latheInspectionGeometry(state=positions,solution=levelSolution,profile=machineProfile){
 const faceScan=latheEvaluateScan(latheScanSetup('face.X',state,solution,profile),solution,profile),flatScan=latheEvaluateScan(latheScanSetup('face.Z',state,solution,profile),solution,profile),side=latheEvaluateScan(latheScanSetup('bar.side',state,solution,profile),solution,profile),top=latheEvaluateScan(latheScanSetup('bar.top',state,solution,profile),solution,profile),bore=latheBoreMeasurement(state,solution,profile);
 return {model:window.LatheInspection.model,face:faceScan.microns,flat:flatScan.microns,faceScan,flatScan,dx:bore.dx,dy:bore.dy,bore,barSide:side.microns,barTop:top.microns,side,top,validX:faceScan.fixture.end.X<=100,validZ:flatScan.fixture.end.Z<=100,xStart:faceScan.fixture.start,zStart:flatScan.fixture.start,xEnd:faceScan.fixture.end,zEnd:flatScan.fixture.end,head:latheHead(state,solution,profile).point,hole:bore.rear,barLength:.4};
}
function latheCaptureFixtures(state=positions,solution=levelSolution,profile=machineProfile){
 const scans=Object.fromEntries(['face.X','face.Z','bar.side','bar.top'].map(key=>[key,latheScanSetup(key,state,solution,profile)])),bore=latheBoreFixture(state,solution,profile),snapshot={state:{...state},scans,bore};return {...snapshot,rows:latheEvaluateHeld(snapshot,solution,profile).rows};
}
function latheEvaluateHeld(snapshot,solution=levelSolution,profile=machineProfile){
 const labels={'face.X':'タレット面X','face.Z':'タレット面Z','bar.side':'バー側面','bar.top':'バー上面'},rows=Object.entries(snapshot.scans).map(([key,f])=>{const s=latheEvaluateScan(f,solution,profile);return {key,label:labels[key],valid:s.valid,microns:s.microns,reason:s.reason};}),b=latheBoreMeasurement(snapshot.state,solution,profile,snapshot.bore);
 for(const [i,key] of ['a','b','c','d'].entries())rows.push({key:'bore.'+key,label:'穴 '+key,valid:b.valid,microns:b.valid?b.readings[i]:null,reason:b.reason});
 rows.push({key:'bore.X',label:'穴 対向指示差X',valid:b.valid,microns:b.dx,reason:b.reason},{key:'bore.height',label:'穴 対向指示差高さ',valid:b.valid,microns:b.dy,reason:b.reason});return {rows};
}
function latheMeasurementStation(key,state=positions){
 const X=key==='faceX'||key==='face.X'?-100:latheFixtureSpec.nominalX,next={...state,X,Z:-100};return {valid:true,reason:null,positions:next,needsMove:Math.abs(state.X-next.X)>1e-9||Math.abs(state.Z-next.Z)>1e-9};
}
function latheFixtureSceneGeometry(key,stage='S',fraction=0,state=positions,solution=levelSolution,profile=machineProfile){
 const V=window.LatheInspection,{add,sub,mul}=V,boxes=[],cylinders=[],segments=[],contacts=[],S=latheFixtureSpec,fraction01=Math.max(0,Math.min(1,fraction));let activeState={...state},valid=false,reason=null,measurement;
 if(key==='bore')measurement=latheBoreMeasurement(state,solution,profile);
 else{const scanKey=key==='faceX'?'face.X':key==='faceZ'?'face.Z':key==='barTop'?'bar.top':'bar.side',fixture=latheScanSetup(scanKey,state,solution,profile),scan=latheEvaluateScan(fixture,solution,profile);measurement=scan;activeState={...state,[fixture.travelKey]:state[fixture.travelKey]+(fixture.end[fixture.travelKey]-state[fixture.travelKey])*fraction01};}
 valid=measurement.valid;reason=measurement.reason;
 const head=latheHead(activeState,solution,profile),frameAxes=[[1,0,0],[0,1,0],[0,0,1]].map(e=>head.rotate(e)),body=latheAssembly([-current.w*.35,1.22,0],'tool',activeState,solution,profile);
 boxes.push({center:body.point,size:[levelCoordinates(.8,0).x,1.25,levelCoordinates(0,1.3).z],axes:frameAxes,color:'#becbd2',label:'主軸台・固定部'});
 cylinders.push({a:sub(head.point,mul(frameAxes[0],levelCoordinates(.28,0).x)),b:head.point,radius:.4,color:'#78909c',label:'チャック'});
 const work=p=>latheAssembly(p,'work',activeState,solution,profile),front=[],back=[];
 for(let i=0;i<12;i++){const a=(i+.5)*Math.PI/6,r=.43/Math.cos(Math.PI/12);front.push(work([-.09,1.5+r*Math.cos(a),1+r*Math.sin(a)]).point);back.push(work([.25,1.5+r*Math.cos(a),1+r*Math.sin(a)]).point);}
 boxes.push({vertices:front,color:'#c0d3d8'},{vertices:back,color:'#a7bdc4'});for(let i=0;i<12;i++)boxes.push({vertices:[front[i],front[(i+1)%12],back[(i+1)%12],back[i]],color:'#b5c9ce'});
 if(key==='bore'||key==='bar'||key==='barTop'){
  const holder=work([-.09,1.5,.52]);boxes.push({center:holder.point,size:[levelCoordinates(.16,0).x,.16,levelCoordinates(0,.30).z],axes:[[1,0,0],[0,1,0],[0,0,1]].map(e=>holder.rotate(e)),color:'#8199a4',label:'既存工具ホルダ・取付座'});
 }
 if(key==='bore'){
  const b=measurement,holeFrame=work([-.09,1.5,.20]),hy=holeFrame.rotate([0,1,0]),hz=holeFrame.rotate([0,0,1]),point=(axial,r,angle)=>add(add(b.entry,mul(b.holeAxis,axial)),add(mul(hy,r*Math.cos(angle)),mul(hz,r*Math.sin(angle))));
  // A longitudinal cutaway exposes the actual finite cavity and blind bottom.
  for(let i=0;i<18;i++){const a=i*Math.PI/12,c=(i+1)*Math.PI/12;boxes.push({vertices:[point(0,S.holderRadius,a),point(0,S.holderRadius,c),point(S.holderLength,S.holderRadius,c),point(S.holderLength,S.holderRadius,a)],color:'#caa67d'},{vertices:[point(0,S.boreRadius,a),point(S.boreDepth,S.boreRadius,a),point(S.boreDepth,S.boreRadius,c),point(0,S.boreRadius,c)],color:'#eed6b6'},{vertices:[point(0,S.boreRadius,a),point(0,S.holderRadius,a),point(0,S.holderRadius,c),point(0,S.boreRadius,c)],color:'#ae835b'},{vertices:[point(S.boreDepth,0,0),point(S.boreDepth,S.boreRadius,a),point(S.boreDepth,S.boreRadius,c)],color:'#ba9369'});}
  const mid=mul(add(b.adapterSeat,b.rear),.5);boxes.push({center:mid,size:[.08,.08,b.adapterLength],axes:[[1,0,0],[0,1,0],[0,0,1]].map(e=>holeFrame.rotate(e)),color:'#a0886c',label:'80角・接続腕'});
  // An unavailable arbor is shown only to its maximum manufactured reach.
  const shownReach=Math.max(S.minReach,Math.min(S.maxReach,b.reach)),shownCentre=add(b.head,mul(b.axis,shownReach));
  cylinders.push({a:b.head,b:shownCentre,radius:S.arborRadius,color:'#c66b27',label:'主軸固定アーバ φ16'});
  if(valid){cylinders.push({a:sub(b.centre,mul(b.axis,S.carrierHalfThickness)),b:add(b.centre,mul(b.axis,S.carrierHalfThickness)),radius:S.carrierRadius,color:'#d5955c',label:'回転ヘッド'});const angle=fraction01*Math.PI*2,probe=add(mul(b.radial,Math.cos(angle)),mul(b.up,Math.sin(angle))),probeBody=add(b.centre,mul(probe,S.probeBaseRadius)),hit=V.internalCylinderContact({body:probeBody,probe,origin:b.entry,direction:b.holeAxis,radius:S.boreRadius,length:S.boreDepth,ballRadius:S.ballRadius});if(hit.valid){segments.push({points:[probeBody,hit.sphereCentre],radius:.001,color:'#b63823',label:'a→b→c→d'});contacts.push(hit.point);}}
 }else{
  const f=measurement.fixture,owner=f.kind==='face'?head:work([-.09,1.5,.52]),path=f.pathLocal.map(p=>latheCarry(owner,p)),dialBody=latheCarry(owner,f.bodyLocal),probe=owner.rotate(f.probeLocal);
  segments.push({points:path,radius:.02,color:'#b2906f',label:!valid?'未成立の必要取付位置':f.kind==='face'?'主軸台の有限検査梁':'タレットの有限計器腕'});cylinders.push({a:path.at(-1),b:dialBody,radius:.008,color:'#da8e4b',label:'固定計器本体'});
  if(key==='bar'||key==='barTop')cylinders.push({a:head.point,b:add(head.point,mul(head.rotate([1,0,0]),.4)),radius:.025,color:'#7b9ca3',label:'主軸固定 φ50×400 mm'});
  let hit;if(f.kind==='face'){const plane=work(f.raw);hit=V.planeContact({body:dialBody,probe,point:plane.point,normal:plane.rotate(f.normal)});}else hit=V.cylinderContact(dialBody,probe,head.point,head.rotate([1,0,0]),.025,.4);
  if(valid&&hit.valid){segments.push({points:[dialBody,hit.point],radius:.001,color:'#b63823',label:'接触・押込みが＋'});contacts.push(hit.point);}
 }
 return {valid,reason,boxes,cylinders,segments,contacts,state:activeState,key,stage,fraction:fraction01,measurementConvention:'実寸・剛体教材の有限治具。変位の拡大なし。'};
}
function latheRunoutAtStations(data,profile=machineProfile){
 const I=window.IntrinsicInspection,r=I?.fromProfile(profile)?.runout,e=r?.eccentricityMicrons||[0,0],tilt=r?.tiltMicroradians||[0,0],root=I?I.runoutAt(e,tilt,50):0,tip=I?I.runoutAt(e,tilt,350):0,valid=data.top.valid;
 return {rootMicrons:valid?root:null,tipMicrons:valid?tip:null,valid,reason:valid?null:data.top.reason,rootAxialMm:50,tipAxialMm:350,intrinsicRootMicrons:root,intrinsicTipMicrons:tip,scope:'50/350 mm固有成分TIR。旧ゼロ保持中の総回転TIRではない。'};
}
function latheInspectionMarkup(data,runout,second=false){
 const n=v=>Number.isFinite(v)?squarenessMicronText(v):'—',svg=(label,body)=>`<svg viewBox="0 0 180 100" role="img" aria-label="${label}"><title>${label}</title>${body}</svg>`;
 const panel=(title,body,note)=>`<section><h2>${title}</h2>${body}<p>${note}</p></section>`;
 const polygon='<path d="M55 12L85 12L108 35L108 65L85 86L55 86L32 65L32 35Z" fill="#fff6ec" stroke="#6c5a4a"/>';
 if(!second)return panel('主軸振れ・µm',svg('主軸回転TIR。鼻端から50 mmと350 mmの固有成分でレベル調整では不変。取付けと最初のゼロを保持した瞬間の総指示ではありません。',`<g fill="#fff6ec" stroke="#6c5a4a"><path d="M15 18H45V74H15ZM45 39H158V53H45Z"/></g><path d="M54 30V60M146 30V60" stroke="#c45a09"/><text x="53" y="23" text-anchor="middle">a</text><text x="146" y="23" text-anchor="middle">b</text><text x="30" y="90">a ${n(runout.rootMicrons)}　b ${n(runout.tipMicrons)}</text><text x="99" y="72" text-anchor="middle">↻ 回転TIR</text>`),runout.valid?'50 / 350 mm・固有成分TIR':`測定不可：${runout.reason}`)+panel('刃物台精度・µm',svg('計器は主軸台側に固定。Xは前面、Zは主軸側フラット。始点ゼロ、押込み増加がプラス。',`${polygon}<path d="M108 35L145 23V53L108 65M85 12L122 2L145 23" fill="#fffaf4" stroke="#6c5a4a"/><path d="M60 62H94M121 56L138 42" stroke="#c45a09"/><text x="50" y="58">a → b</text><text x="119" y="77">c → d</text><text x="61" y="38">X</text><text x="122" y="35">Z</text><text x="4" y="94">X ${n(data.face)}　Z ${n(data.flat)}</text>`),data.faceScan.valid&&data.flatScan.valid?'300 mm・始点再ゼロ後':`測定不可：${!data.faceScan.valid?'X '+data.faceScan.reason+' ':''}${!data.flatScan.valid?'Z '+data.flatScan.reason:''}`);
 const marks=data.bore.valid?data.bore.readings.map(n):['—','—','—','—'];
 return panel('主軸と刃物台の穴芯',svg('主軸から刃物台を見る。主軸所有の回転計器を a左、b上、c右、d下へ回す。実際のX/Z位置で有限穴の内壁に接触し、再取付け後aでゼロ。',`${polygon}<circle cx="70" cy="49" r="17" fill="white" stroke="#6c5a4a"/><path d="M44 49H96M70 23V75" stroke="#a49386"/><circle cx="70" cy="49" r="2" fill="#c45a09"/><text x="0" y="52">a ${marks[0]}</text><text x="65" y="14">b ${marks[1]}</text><text x="110" y="52">c ${marks[2]}</text><text x="65" y="94">d ${marks[3]}</text>`),`対向指示差 X ${n(data.dx)}／高さ ${n(data.dy)} µm。${data.bore.valid?'有限穴・a再ゼロ後':'測定不可：'+data.bore.reason}<br><button type="button" id="latheBorePosition" onclick="latheSetInspectionPosition('bore')">穴測定位置へ（X公称・Z主軸側）</button><button type="button" id="latheBoreView" onclick="openFixtureGeometry('bore')">穴の取付図を見る</button>`) +panel('テストバー測定・µm',svg('主軸固定のテストバーに、タレット側のダイヤルを接触。側面は奥側から、上面は上から測る。主軸側aを0にして先端側bへZを300 mm送り、押込み増加がプラス。',`<g fill="#fff6ec" stroke="#6c5a4a"><path d="M5 13H27V33H5ZM27 24H160V29H27Z"/><rect x="121" y="5" width="26" height="12" rx="2"/></g><path d="M134 17V24M127 11H141M133 8L137 14" stroke="#c45a09" fill="none"/><path d="M45 18H110l-5,-3m5,3l-5,3" stroke="#c45a09" fill="none"/><text x="39" y="43">a 0</text><text x="130" y="43">b</text><text x="55" y="12" font-size="9">Z 300 mm →</text><text x="8" y="66">側面（奥） ${n(data.barSide)}</text><text x="8" y="85">上面 ${n(data.barTop)}</text>`),data.side.valid&&data.top.valid?'φ50×400 mm・a50→b350 mm':`測定不可：${!data.side.valid?data.side.reason:data.top.reason}`);
}
let latheInspectionLastKey='';
function updateLatheInspectionUI(){
 const data=latheInspectionGeometry(),runout=latheRunoutAtStations(data);
 const key=JSON.stringify([data,runout]);
 if(key!==latheInspectionLastKey||!$('liveSquareness').querySelector('.lathe-inspection-columns')){
  latheInspectionLastKey=key;$('liveSquareness').innerHTML='<div class="lathe-inspection-columns">'+latheInspectionMarkup(data,runout)+'</div>';
  $('latheInspectionSecond').innerHTML='<div class="lathe-inspection-columns">'+latheInspectionMarkup(data,runout,true)+'</div>';
 }
 $('liveSquareness').dataset.lathe=JSON.stringify({face:data.face,flat:data.flat,dx:data.dx,dy:data.dy,barSide:data.barSide,barTop:data.barTop,runout});
 if(!$('measurementReferenceCards').querySelector('.lathe-inspection-detail'))$('measurementReferenceCards').innerHTML='<article class="measurement-reference-card lathe-inspection-detail"><h3>タレット旋盤の検査・µm</h3><p>Haas STシリーズの配置を参考にした汎用2軸模型です。6点支持・機械寸法・以下の検査治具は教材の設定で、特定型式の再現ではありません。12角タレットは工具1番で固定し、割出しは実装していません。心押台は測定に使いません。</p><p>取付け：下の「測定配置」から検査を選び、「測定位置へ」で実際のX/Zを動かします。面XはX主軸側端、面Z・穴・バーはX公称芯位置、Zは主軸台側端が標準の検査位置です。現在位置からの300 mm正方向走査が軸端を超える場合も測定不可です。数値のために軸位置や支持を暗黙に変えることはありません。</p><p>面X：主軸台の前面に固定した計器にタレット前面を当て、タレットをX正方向へ300 mm送ります。面Z：工具とホルダを外し、主軸に近い内側フラットへ計器を当て、往復台をZ正方向へ300 mm送ります。両者とも始点の面法線へ計器を合わせ、10 mm伸びで接触、始点をゼロにします。伸び減少・押込み増加が＋。面Zは従来の外側とは接触側が逆です。主軸台実前面の取付座からφ40 mmの検査梁でチャックを外周へ迂回し、チャック前面から50 mm先で内側へ折れ、タレットへ接近します。前進950・横枝700・縦調整150 mmが有限の到達範囲です。計器本体は長さ50 mm・半径8 mm。移動中の有限12角タレット、チャック、面接触、伸び0〜20 mmを確認します。模型の取付基準から測定高さ840 mmまでの姿勢変化も計算します。</p><p>穴：切削工具とバーを外します。既存工具ホルダから80 mm角の腕（標準320 mm・許容100〜450 mm）を径方向へ渡し、外径70・内径50・突出150・盲穴深さ60 mmの教材ホルダを固定します。主軸には直径16 mmのアーバと回転計器を固定。鼻端から測定面への到達は100〜350 mm、目標面は入口から穴軸に沿って30 mm入った点を通る主軸直交面です。公称X・Z主軸側端では標準到達165 mm。現在の実X/Zを使い、支持を変えて芯を自動調整しません。主軸から見るa左→b上→c右→d下へ回します。基部半径14 mm・球半径1 mm・伸び0〜20 mmの測定子が傾いた有限円筒の内壁へ触れる位置を解き、aでゼロ、押込み増加を＋とします。X=(c−a)/2、高さ=(d−b)/2は対向指示差で、幾何学的な穴芯差とは区別します。半径17 mm・厚さ6 mmの回転ヘッド、アーバ、入口、底、接続腕、取付座の有限寸法と保守包絡を確認します。NCの直径指令の正負とは区別してください。</p><p>バー平行度：主軸にφ50×400 mmの理想バーを固定し、主軸は回しません。既存の工具ホルダにφ40 mmの有限腕を取り付けます。バーから85 mm離れた経路を通り、上流への腕は350 mm、径方向の各部は450 mm以内です。鼻端から50 mmのaで接触ゼロを取り、タレット側計器の本体と方向を固定したままZ正方向へ300 mm送り、350 mmのbを測ります。側面は奥側から、上面は上から当てる別取付けです。計器本体は長さ50 mm・半径8 mm、伸び0〜20 mm。値を直径誤差として2倍にしません。有限バー、チャック、タレットと腕・本体の干渉も確認します。</p><p>主軸振れ：同じ400 mmバーのa=50 mm、b=350 mmに計器を置く配置で、同じseedから生成された偏心と傾きによる固有成分TIR（1回転の最大−最小）を表示します。支持では固有成分を変えません。バー治具が成立しない場合は—です。固定取付け・旧ゼロ保持中の瞬間指示や総回転TIRとは別の量です。</p><p>上の通常値は、現在の支持・実軸位置で取付けと始点ゼロを取り直した測定です。「取付け・ゼロを保持」の比較欄は、最初の部材局所座標とゼロを保存し、支持変更後にも同じ取付けを運びます。穴の旧aも0とは限りません。最初から無効の取付けを後で勝手に有効にはしません。軸・寸法・個体を変えると保持を解除します。値が変わらない条件、丸めて同じ整数になる条件もそのまま表示します。</p><p>図は選んだ検査だけを装着した実寸の配置図です。面検査は工具・バーを外し、穴とバーも同時装着しません。接触は32分割とZ支持補間境界の両側で確認します。梁と部材の膨張包絡に接近する場合は保守的に不可とします。剛体教材であり、たわみ、接合剛性、熱、荷重を再現する実機保証ではありません。</p><p><a href="https://www.haascnc.com/service/troubleshooting-and-how-to/how-to/st-lathe-alignment-indicating-zones-.html" target="_blank" rel="noopener">Haas公式：ST Lathe Alignment Indicating Zones</a></p></article>';
 $('inspectionCarousel').style.setProperty('--inspection-height',$('precisionReadouts').getBoundingClientRect().height+'px');
}

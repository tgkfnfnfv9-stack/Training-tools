'use strict';
// Measuring/view state is deliberately separate from the saved installation.
let spindleSweepMode=false,spindleSweepAngle=270;
const sweepDirections=['右','奥','左','手前'];
const sweepDot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const spindleSweepKinds=['compact','travel','double','gantry','five'];
function supportsSpindleSweep(machine=current){return spindleSweepKinds.includes(machine.kind);}
function spindleSweepGeometry(state=positions,solution=levelSolution,profile=machineProfile,factor=1){
 if(!supportsSpindleSweep()||!solution)return {valid:false,reason:'unsupported-machine'};
 if(current.kind!=='compact')return spindleSweepMachineGeometry(state,solution,profile);
 const g=geometryModel(state,solution,profile),toolSeat=levelCoordinates(g.toolPoints[0].x,g.toolPoints[0].z),workSeat=levelCoordinates(g.workPoint.x,g.workPoint.z);
 const tool=compactSupportFrame(solution,toolSeat.x,toolSeat.z,factor),work=compactSupportFrame(solution,workSeat.x,workSeat.z,factor);
 const body=intrinsicBodyFrame(axisConfig(current).filter(a=>['X','Y','Z'].includes(a.key)),profile,factor);
 const axis=tool.rotate(body.rotate([0,1,0])),right=tool.rotate(body.rotate([1,0,0]));
 const measurement=window.SpindleSweep.measure({axis,tableNormal:work.up,right,radius:.15});
 if(!measurement.valid)return measurement;
 // These locations share the compact model's physical transforms. At factor=1
 // they contain no visual exaggeration, camera rotation, zoom or clearance.
 const layout=columnLayoutOffset(current),nosePlan=levelCoordinates(layout.x,-.3+layout.z),relative=[nosePlan.x-toolSeat.x,1.98+.3*state.Z/100-.66,nosePlan.z-toolSeat.z];
 const base=compactSurfacePoint(solution,toolSeat.x,toolSeat.z,factor),nose=tool.rotate(body.rotate(relative)).map((v,i)=>v+base[i]);
 const tableCentre=compactTablePathPoint(state,solution,profile,factor),along=sweepDot(work.up,tableCentre.map((v,i)=>v-nose[i]))/sweepDot(work.up,measurement.axis);
 const centre=nose.map((v,i)=>v+along*measurement.axis[i]);
 const halfWidth=levelCoordinates(current.w*.78/2,0).x,halfDepth=levelCoordinates(0,current.d*.42/2).z;
 const pointAt=degrees=>{
  const p=measurement.at(degrees);if(!p.valid)return p;
  const contact=p.contactPoint.map((v,i)=>v+centre[i]),delta=contact.map((v,i)=>v-tableCentre[i]);
  const onTable=Math.abs(sweepDot(delta,work.right))<=halfWidth+1e-10&&Math.abs(sweepDot(delta,work.back))<=halfDepth+1e-10;
  return {...p,contact,onTable};
 };
 return {valid:true,measurement,nose,centre,tableCentre,tableNormal:work.up,tableRight:work.right,tableBack:work.back,halfWidth,halfDepth,pointAt,cardinal:[0,90,180,270].map(pointAt)};
}
// Factor-one assembly transforms: measurement never reads drawing gain,
// clearance, camera, zoom, or global axis positions. Compact keeps its original
// physical path above; only the shared zero reference is changed to the front.
function spindleSweepMachineGeometry(state,solution,profile){
 const m=current,L=window.Leveling,g=geometryModel(state,solution,profile),axes=axisConfig(m).filter(a=>['X','Y','Z'].includes(a.key));
 const coordinate=p=>{const q=levelCoordinates(p[0],p[2]);return [q.x,p[1],q.z];};
 const add=(a,b)=>a.map((v,i)=>v+b[i]),subtract=(a,b)=>a.map((v,i)=>v-b[i]);
 const unit=v=>{const n=Math.hypot(...v);return v.map(q=>q/n);};
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const gate=g.portal,body=intrinsicBodyFrame(axes,profile),intrinsic=window.MachineAccuracy.directions(axes,profile);
 const poseFrame=pose=>(g.poses[pose]||g.poses.tool).frame;
 const axisFrame=a=>a.key==='X'&&g.guideSlope?L.orientation(g.guideSlope):poseFrame(g.axes.find(q=>q.key===a.key).source);
 const anchor=pose=>{const q=(g.poses[pose]||g.poses.tool).anchor;return coordinate([q.x,.66,q.z]);};
 const surface=(p,work=false)=>{
  const source=work&&solution.parts?solution.parts.bed:solution;
  if(gate){const plane=solution.plane,h=source.heightAt(p[0],p[2])-(plane.a*p[0]+plane.b*p[2]+plane.c);return gate.world([p[0],h/1000,p[2]]);}
  return [p[0],.66+source.heightAt(p[0],p[2])/1000,p[2]];
 };
 // These inverses apply only to orthonormal single-column/work frames.
 // The portal's affine shear is handled separately below.
 const inverse=(frame,v)=>[[1,0,0],[0,1,0],[0,0,1]].map(q=>sweepDot(frame.rotate(q),v));
 function movement(keys,pose){
  const active=axes.filter(a=>keys.includes(a.key));
  if(gate)return active.reduce((sum,a)=>{
   const length=Math.hypot(...coordinate(a.vector))*a.amp*state[a.key]/100;
   let v=pose==='tool'&&a.key!=='X'?intrinsic.find(q=>q.key===a.key).vector:a.vector;
   if(pose==='tool'&&a.key!=='X'){
    const span=levelCoordinates(g.toolPoints[1].x,0).x-levelCoordinates(g.toolPoints[0].x,0).x,norm=Math.hypot(...gate.local.rotate(v));
    v=[v[0]*span/gate.span/norm,v[1]/norm,v[2]/norm];
   }
   return add(sum,v.map(q=>q*length));
  },[0,0,0]);
  const baseState={...state};active.forEach(a=>baseState[a.key]=0);
  const before=geometryModel(baseState,solution,profile),info=before.poses[pose]||before.poses.tool;
  const nowAnchor=anchor(pose),baseAnchor=coordinate([info.anchor.x,.66,info.anchor.z]),dA=subtract(nowAnchor,baseAnchor),dS=subtract(surface(nowAnchor),surface(baseAnchor));
  let desired=[0,0,0],transport=[0,0,0];
  const nonuniform=solution.residual>1e-10||Math.abs(solution.twist)>1e-10;
  for(const a of active){
   const frame=axisFrame(a),amplitude=Math.hypot(...coordinate(a.vector))*a.amp*state[a.key]/100,direction=frame.rotate(intrinsic.find(q=>q.key===a.key).vector);
   desired=add(desired,direction.map(v=>v*amplitude));
   if(nonuniform){
    const base=geometryModel({...state,[a.key]:0},solution,profile),info=base.poses[pose]||base.poses.tool,axisAnchor=coordinate([info.anchor.x,.66,info.anchor.z]),axisDA=subtract(nowAnchor,axisAnchor),movesAnchor=Math.hypot(...axisDA)>1e-12,nominal=frame.rotate(a.vector);
    const world=direction.map((v,i)=>(v-(movesAnchor?nominal[i]:0))*amplitude),parent=inverse(poseFrame(pose),world),local=profile&&pose!=='work'?inverse(body,parent):parent;
    transport=add(transport,local.map((v,i)=>v+(movesAnchor?axisDA[i]:0)));
   }
  }
  if(nonuniform)return transport;
  const parent=inverse(poseFrame(pose),subtract(desired,dS)),local=profile&&pose!=='work'?inverse(body,parent):parent;
  return add(dA,local);
 }
 function rotary(v,keys){
  let q=[...v];
  if(keys.includes('C')){const t=state.C*Math.PI/100;q=[q[0]*Math.cos(t)+q[2]*Math.sin(t),q[1],-q[0]*Math.sin(t)+q[2]*Math.cos(t)];}
  if(keys.includes('A')){const t=state.A*.45/100;q=[q[0],q[1]*Math.cos(t)-q[2]*Math.sin(t),q[1]*Math.sin(t)+q[2]*Math.cos(t)];}
  return q;
 }
 function point(raw,keys,pose){
  const pivot=coordinate([0,1.25,-.45]),p=add(add(pivot,rotary(subtract(coordinate(raw),pivot),keys)),movement(keys,pose)),a=anchor(pose);
  if(gate&&pose==='tool'){
   const nominalSpan=levelCoordinates(g.toolPoints[1].x,0).x-levelCoordinates(g.toolPoints[0].x,0).x;
   return gate.world(add(gate.local.rotate([(p[0]-a[0])*gate.span/nominalSpan,p[1]-3.17,p[2]-a[2]]),gate.centre));
  }
  const offset=pose==='tool'?columnLayoutOffset(m):{x:0,z:0},relative=subtract(add(p,coordinate([offset.x,0,offset.z])),a),local=profile&&pose==='tool'?body.rotate(relative):relative;
  return add(surface(a,pose==='work'),poseFrame(pose).rotate(local));
 }
 const five=m.kind==='five',travel=m.kind==='travel',toolKeys=travel?['X','Y','Z']:five?['Z']:m.kind==='gantry'?['X','Y','Z']:['Y','Z'];
 const workKeys=five?['X','Y','A','C']:m.kind==='double'?['X']:[],gz=m.columnZ??0;
 const nose=point(travel?[-.5,1.65,-.3]:five?[0,2.15,-.3]:[.15,1.91,gz-.23],toolKeys,'tool');
 const tableCentre=point(travel?[0,1.1,-m.d*.18]:five?[0,1.56,-.45]:[0,1.12,0],workKeys,'work');
 const tableRight=poseFrame('work').rotate(rotary([1,0,0],workKeys)),tableBack=poseFrame('work').rotate(rotary([0,0,1],workKeys)),tableNormal=unit(cross(tableBack,tableRight));
 // The existing representative spindle includes intrinsic posture. Portal
 // cylinder meshes remain simplified support-only shapes, as before.
 const axis=g.bodyCombinedDirection,right=poseFrame('tool').rotate(body.rotate([1,0,0]));
 const measurement=window.SpindleSweep.measure({axis,tableNormal,right,radius:.15});
 if(!measurement.valid)return measurement;
 const along=sweepDot(tableNormal,subtract(tableCentre,nose))/sweepDot(tableNormal,measurement.axis),centre=add(nose,measurement.axis.map(v=>v*along));
 const halfWidth=levelCoordinates(five?.65:travel?m.w*.93/2:m.supportLayout==='irregular'?1.45/2:m.w*.57/2,0).x;
 const halfDepth=levelCoordinates(0,five?.65:travel?m.d*.39/2:m.supportLayout==='irregular'?3.20/2:m.d*.65/2).z;
 const pointAt=degrees=>{
  const p=measurement.at(degrees);if(!p.valid)return p;
  const contact=add(p.contactPoint,centre),delta=subtract(contact,tableCentre),x=sweepDot(delta,tableRight)/halfWidth,z=sweepDot(delta,tableBack)/halfDepth;
  const onTable=five?x*x+z*z<=1+1e-10:Math.abs(x)<=1+1e-10&&Math.abs(z)<=1+1e-10;
  return {...p,contact,onTable};
 };
 return {valid:true,measurement,nose,centre,tableCentre,tableNormal,tableRight,tableBack,halfWidth,halfDepth,tableShape:five?'ellipse':'rectangle',pointAt,cardinal:[0,90,180,270].map(pointAt)};
}
function spindleSweepReading(value){return squarenessMicronText(value);}
function updateSpindleSweep(){
 // Supported vertical-spindle machines show both measurements together. This is a view state,
 // not an installation or measurement-model setting.
 const available=supportsSpindleSweep();
 spindleSweepMode=available;
 $('trainingMain').classList.toggle('has-spindle-sweep',available);
 $('squarenessValuesNote').hidden=false;
 $('spindleSweepPanel').hidden=!available;$('liveSquareness').hidden=false;$('liveSquarenessUnits').hidden=false;
 $('axisTabs').hidden=false;
 $('scene-readout-sweep-note').hidden=!available;$('modelSemantics').hidden=false;
 if(!available){toggleSpindleSweepSelection(false);return;}
 const measured=spindleSweepGeometry(),zeroValid=measured.valid&&measured.cardinal[3].onTable;
 for(let i=0;i<4;i++){
  const p=measured.cardinal?.[i],readable=zeroValid&&p?.onTable,el=$('sweepValue'+i),button=$('sweepPosition'+i);
  el.textContent=readable?spindleSweepReading(p.readingMicrons):p&&!p.onTable?'面外':'—';
  el.setAttribute('data-reading-microns',readable?String(p.readingMicrons):'');
  button.setAttribute('aria-pressed',String(Math.abs(spindleSweepAngle-i*90)<.001));
  button.setAttribute('aria-label',sweepDirections[i]+(i===3?'・基準':'')+'、'+(readable?el.textContent+'マイクロメートル':el.textContent));
  $('sweepReadout'+i).setAttribute('data-selected',button.getAttribute('aria-pressed'));
 }
 $('spindleSweepToggle').setAttribute('aria-label','ダイヤル測定。'+sweepDirections.map((direction,i)=>direction+(i===3?'基準':'')+' '+$('sweepValue'+i).textContent+' マイクロメートル').join('、')+'。選択中 '+sweepDirections[Math.round(spindleSweepAngle/90)%4]+'。方向選択を'+($('spindleSweepSelection').hidden?'開く':'閉じる'));
 const point=measured.valid?measured.pointAt(spindleSweepAngle):null;
 $('sweepContactStatus').textContent=!measured.valid?'測定不可・主軸と上面の姿勢を確認':!zeroValid?'手前が面外・軸を中央へ':!point?.onTable?'測定子が面外・軸を中央へ':'手前基準・µm（0.001 mm）';
}
function redrawSpindleSweep(){
 updateSpindleSweep();if(page==='training'){updateSceneViewUI();render($('scene'),current,yaw,$('labels').checked,selected);}
}
function selectSpindleSweepAngle(degrees){
 if(!supportsSpindleSweep())return;
 spindleSweepAngle=degrees;redrawSpindleSweep();
}
function toggleSpindleSweepSelection(force){
 const panel=$('spindleSweepSelection'),open=force===undefined?panel.hidden:force;
 panel.hidden=!open;$('spindleSweepToggle').setAttribute('aria-expanded',String(open));
 if(open){const scroll=$('adjustmentSelectionScroll'),selected=$('sweepPosition'+Math.round(spindleSweepAngle/90)%4);scroll.scrollTop=panel.offsetTop-scroll.offsetTop;selected.focus?.({preventScroll:true});selected.scrollIntoView?.({block:'nearest',inline:'nearest'});if(selected.getBoundingClientRect&&scroll.getBoundingClientRect){const r=selected.getBoundingClientRect(),s=scroll.getBoundingClientRect();if(r.bottom>s.bottom)scroll.scrollTop+=r.bottom-s.bottom;if(r.top<s.top)scroll.scrollTop-=s.top-r.top;}}
}
$('spindleSweepToggle').onclick=()=>{toggleSpindleSweepSelection();updateSpindleSweep();};
$('closeSpindleSweepSelection').onclick=()=>{toggleSpindleSweepSelection(false);updateSpindleSweep();$('spindleSweepToggle').focus?.({preventScroll:true});};
$('spindleSweepSelection').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();toggleSpindleSweepSelection(false);updateSpindleSweep();$('spindleSweepToggle').focus?.({preventScroll:true});}});
for(let i=0;i<4;i++)$('sweepPosition'+i).onclick=()=>{selectSpindleSweepAngle(i*90);toggleSpindleSweepSelection(false);updateSpindleSweep();$('spindleSweepToggle').focus?.({preventScroll:true});};

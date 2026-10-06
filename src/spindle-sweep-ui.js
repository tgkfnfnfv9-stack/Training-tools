'use strict';
// Measuring/view state is deliberately separate from the saved installation.
let spindleSweepMode=false,spindleSweepAngle=0;
const sweepDirections=['右','奥','左','手前'];
const sweepDot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
function spindleSweepGeometry(state=positions,solution=levelSolution,profile=machineProfile,factor=1){
 if(current.kind!=='compact'||!solution)return {valid:false};
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
function spindleSweepReading(value){return squarenessMicronText(value);}
function updateSpindleSweep(){
 // Compact machines show both measurements together. This is a view state,
 // not an installation or measurement-model setting.
 const available=current.kind==='compact';
 spindleSweepMode=available;
 $('trainingMain').classList.toggle('has-spindle-sweep',available);
 $('squarenessValuesNote').hidden=false;
 $('spindleSweepPanel').hidden=!available;$('liveSquareness').hidden=false;$('liveSquarenessUnits').hidden=false;
 $('axisTabs').hidden=false;
 $('scene-readout-sweep-note').hidden=!available;$('modelSemantics').hidden=false;
 if(!available)return;
 const measured=spindleSweepGeometry(),zeroValid=measured.valid&&measured.cardinal[0].onTable;
 for(let i=0;i<4;i++){
  const p=measured.cardinal?.[i],readable=zeroValid&&p?.onTable,el=$('sweepValue'+i),button=$('sweepPosition'+i);
  el.textContent=readable?spindleSweepReading(p.readingMicrons):p&&!p.onTable?'面外':'—';
  el.setAttribute('data-reading-microns',readable?String(p.readingMicrons):'');
  button.setAttribute('aria-pressed',String(Math.abs(spindleSweepAngle-i*90)<.001));
  button.setAttribute('aria-label',i*90+'度・'+sweepDirections[i]+'、'+(readable?el.textContent+'マイクロメートル':el.textContent));
 }
 const point=measured.valid?measured.pointAt(spindleSweepAngle):null;
 $('sweepContactStatus').textContent=!zeroValid?'0°が面外・軸を中央へ':!point?.onTable?'測定子が面外・軸を中央へ':'0°基準・µm（0.001 mm）';
}
function redrawSpindleSweep(){
 updateSpindleSweep();if(page==='training'){updateSceneViewUI();render($('scene'),current,yaw,$('labels').checked,selected);}
}
function selectSpindleSweepAngle(degrees){
 if(current.kind!=='compact')return;
 spindleSweepAngle=degrees;redrawSpindleSweep();
}
for(let i=0;i<4;i++)$('sweepPosition'+i).onclick=()=>selectSpindleSweepAngle(i*90);

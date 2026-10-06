'use strict';
// Measuring/view state is deliberately separate from the saved installation.
let spindleSweepMode=false,spindleSweepAngle=0,spindleSweepTimer=null,spindleSweepProgress=0;
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
function sweepDialMarkup(reading){
 const theta=Number.isFinite(reading)?reading*Math.PI*2/100:0,tip=[32+22*Math.sin(theta),32-22*Math.cos(theta)];
 const ticks=Array.from({length:20},(_,i)=>{const a=i*Math.PI/10,inner=i%5===0?23:26;return `<line x1="${32+inner*Math.sin(a)}" y1="${32-inner*Math.cos(a)}" x2="${32+29*Math.sin(a)}" y2="${32-29*Math.cos(a)}"/>`;}).join('');
 return `<circle cx="32" cy="32" r="31" fill="#fff" stroke="#3a3a3a" stroke-width="2"/><g stroke="#777" stroke-width="1">${ticks}</g><text x="32" y="14" text-anchor="middle" fill="#333" font-size="8">0</text><line x1="32" y1="32" x2="${tip[0]}" y2="${tip[1]}" stroke="#b34800" stroke-width="2"/><circle cx="32" cy="32" r="3" fill="#333"/>`;
}
function updateSpindleSweep(){
 const available=current.kind==='compact';$('toggleSpindleSweep').hidden=!available;
 if(!available){spindleSweepMode=false;stopSpindleSweep();}
 $('toggleSpindleSweep').textContent=spindleSweepMode?'直角図へ':'ダイヤル測定';
 $('toggleSpindleSweep').setAttribute('aria-pressed',String(spindleSweepMode));
 $('spindleSweepPanel').hidden=!spindleSweepMode;$('liveSquareness').hidden=spindleSweepMode;$('liveSquarenessUnits').hidden=spindleSweepMode;
 $('runSpindleSweep').hidden=!spindleSweepMode;$('axisTabs').hidden=spindleSweepMode;
 $('scene-readout-sweep-note').hidden=!spindleSweepMode;$('modelSemantics').hidden=spindleSweepMode;
 if(!spindleSweepMode)return;
 const measured=spindleSweepGeometry(),zeroValid=measured.valid&&measured.cardinal[0].onTable;
 for(let i=0;i<4;i++){
  const p=measured.cardinal?.[i],readable=zeroValid&&p?.onTable,el=$('sweepValue'+i),button=$('sweepPosition'+i);
  el.textContent=readable?spindleSweepReading(p.readingMicrons):p&&!p.onTable?'面外':'—';
  el.setAttribute('data-reading-microns',readable?String(p.readingMicrons):'');
  button.setAttribute('aria-pressed',String(Math.abs(spindleSweepAngle-i*90)<.001));
  button.setAttribute('aria-label',i*90+'度・'+sweepDirections[i]+'、'+(readable?el.textContent+'マイクロメートル':el.textContent));
 }
 const point=measured.valid?measured.pointAt(spindleSweepAngle):null,readable=zeroValid&&point?.onTable;
 $('sweepCurrentAngle').textContent=Math.round(spindleSweepAngle)+'°';
 $('sweepCurrentValue').textContent=readable?spindleSweepReading(point.readingMicrons)+' µm':'測定できません';
 $('sweepCurrentValue').setAttribute('data-reading-microns',readable?String(point.readingMicrons):'');
 $('sweepDial').innerHTML=sweepDialMarkup(readable?point.readingMicrons:NaN);
 $('sweepDial').setAttribute('aria-label',Math.round(spindleSweepAngle)+'度のダイヤル、'+$('sweepCurrentValue').textContent+'。一回転100マイクロメートル。');
 $('sweepContactStatus').textContent=!zeroValid?'0°がテーブル外です。軸位置を中央へ戻してください。':!point?.onTable?'測定子がテーブル外です。軸位置を中央へ戻してください。':'0°基準・＋は押込み側・µm（0.001 mm）';
}
function redrawSpindleSweep(){
 updateSpindleSweep();if(page==='training'){updateSceneViewUI();render($('scene'),current,yaw,$('labels').checked,selected);}
}
function stopSpindleSweep(){
 if(spindleSweepTimer!==null)clearTimeout(spindleSweepTimer);spindleSweepTimer=null;
 if($('runSpindleSweep')){$('runSpindleSweep').textContent='1周回す';$('runSpindleSweep').setAttribute('aria-pressed','false');}
}
function setSpindleSweepMode(enabled){
 stopSpindleSweep();stopMotion();spindleSweepMode=!!enabled&&current.kind==='compact';spindleSweepAngle=0;drawScene();
}
function selectSpindleSweepAngle(degrees){
 stopSpindleSweep();spindleSweepAngle=degrees;redrawSpindleSweep();
}
function runSpindleSweep(){
 if(spindleSweepTimer!==null){stopSpindleSweep();return;}
 stopMotion();const start=spindleSweepAngle;spindleSweepProgress=0;
 $('runSpindleSweep').textContent='停止';$('runSpindleSweep').setAttribute('aria-pressed','true');
 const step=()=>{
  if(!spindleSweepMode||page!=='training'||document.hidden){stopSpindleSweep();return;}
  spindleSweepProgress=Math.min(360,spindleSweepProgress+3);spindleSweepAngle=(start+spindleSweepProgress)%360;redrawSpindleSweep();
  if(spindleSweepProgress<360)spindleSweepTimer=setTimeout(step,40);else stopSpindleSweep();
 };
 spindleSweepTimer=setTimeout(step,40);
}
function drawSpindleSweep(ctx,screen,labelBoxes){
 if(!spindleSweepMode||current.kind!=='compact')return;
 // Drawing uses the same transforms with the established posture exaggeration.
 // It does not feed those exaggerated directions back into measured numbers.
 const visual=spindleSweepGeometry(positions,levelSolution,machineProfile,displayFactor()),actual=spindleSweepGeometry();if(!visual.valid||!actual.valid)return;
 const lift=p=>p.map((v,i)=>v+(i===1?displayClearance():0)),at=visual.pointAt(spindleSweepAngle),real=actual.pointAt(spindleSweepAngle),axis=visual.measurement.axis;
 const hub=visual.centre.map((v,i)=>v+axis[i]*.28),arm=at.ringPoint.map((v,i)=>v+hub[i]),dial=at.ringPoint.map((v,i)=>v+visual.centre[i]+axis[i]*.15);
 const line=(a,b,color,width=2,dash=[])=>{const p=screen(lift(a)),q=screen(lift(b));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash?.(dash);ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);ctx.stroke();ctx.setLineDash?.([]);};
 // The holder extends from the drawn spindle nose; the plunger meets the table.
 line(visual.nose,hub,'#333',3);line(hub,arm,'#b34800',3);line(arm,dial,'#333',2);line(dial,at.contact,real.onTable?'#333':'#b34800',2,real.onTable?[]:[3,3]);
 ctx.strokeStyle='#b3480080';ctx.lineWidth=1;ctx.setLineDash?.([3,3]);ctx.beginPath();
 for(let d=0;d<=360;d+=6){const p=screen(lift(visual.pointAt(d).contact));if(d)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);}ctx.stroke();ctx.setLineDash?.([]);
 for(let i=0;i<4;i++){
  const p=screen(lift(visual.cardinal[i].contact));ctx.beginPath();ctx.arc(p[0],p[1],2.5,0,Math.PI*2);ctx.fillStyle=actual.cardinal[i].onTable?'#b34800':'#999';ctx.fill();
 }
 const p=screen(lift(dial)),r=9;labelBoxes.push({x:p[0]-r,y:p[1]-r,w:r*2,h:r*2});
 ctx.beginPath();ctx.arc(p[0],p[1],r,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle='#222';ctx.lineWidth=1.5;ctx.stroke();
 const theta=actual.cardinal[0].onTable&&real.onTable?real.readingMicrons*Math.PI*2/100:0;
 ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(p[0]+r*.75*Math.sin(theta),p[1]-r*.75*Math.cos(theta));ctx.strokeStyle='#b34800';ctx.stroke();
 const tip=screen(lift(at.contact));ctx.beginPath();ctx.arc(tip[0],tip[1],2,0,Math.PI*2);ctx.fillStyle=real.onTable?'#b34800':'#aaa';ctx.fill();
}
$('toggleSpindleSweep').onclick=()=>setSpindleSweepMode(!spindleSweepMode);
$('runSpindleSweep').onclick=runSpindleSweep;
for(let i=0;i<4;i++)$('sweepPosition'+i).onclick=()=>selectSpindleSweepAngle(i*90);
window.addEventListener('pagehide',stopSpindleSweep);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopSpindleSweep();});

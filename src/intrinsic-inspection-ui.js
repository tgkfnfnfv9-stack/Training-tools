'use strict';
// This page shows intrinsic components from the saved individual seed only.
// It deliberately has no support, axis-position, camera or measurement gain input.
let intrinsicInspectionKey='',intrinsicInspectionMachine=null,intrinsicInspectionProfile=null,intrinsicInspectionPage=0;
let intrinsicInspectionReady=false,intrinsicInspectionFrame=0;
// Match the existing readouts: whole micrometres, with no signed zero.
const inspectionSigned=squarenessMicronText;
function intrinsicRunoutMarkup(value,horizontal){
 const label=`主軸を回転させたときの最大指示と最小指示の差。根元 ${Math.round(value.rootMicrons)} µm、300 mm先 ${Math.round(value.tipMicrons)} µm。${horizontal?'既存のZ方向平行度':'既存の4方向の触れ'}とは別の固有成分です。`;
 const bar=horizontal?'<path d="M112 10H125V40H112ZM36 20H112V30H36Z"/><path d="M104 17V33M44 17V33" stroke="#b34800"/>':'<path d="M5 3H45V10H5ZM20 10H30V46H20Z"/><path d="M17 16H33M17 40H33" stroke="#b34800"/>';
 const text=horizontal?`<text x="129" y="13" text-anchor="end">根元 ${Math.round(value.rootMicrons)}</text><text x="30" y="44">300 mm先 ${Math.round(value.tipMicrons)}</text>`:`<text x="40" y="20">根元 ${Math.round(value.rootMicrons)}</text><text x="40" y="42">300 mm先 ${Math.round(value.tipMicrons)}</text>`;
 return `<svg viewBox="0 0 136 50" role="img" aria-label="${label}"><title>${label}</title><g fill="#fffaf6" stroke="#786452" stroke-width="1.2">${bar}</g><g fill="#302923" font-size="10">${text}</g></svg>`;
}
function intrinsicSurfaceMarkup(value,five){
 const label=`テーブル上面の固有形状。平均傾斜を除いた9点の高さ差、左中央を0。点間の最大差 ${Math.round(value.rangeMicrons)} µm。厳密な最小領域平面度ではありません。${five?'5軸はA=C=0の基準姿勢。':''}支持による変形や測定時の傾きは含めません。`;
 const marks=value.points.map((p,i)=>{const x=19+(p.x+1)*52,y=12+(1-p.back)*15;return `<circle cx="${x}" cy="${y}" r="1.7" fill="${i===3?'#b34800':'#302923'}"/><text x="${x+4}" y="${y+3}" fill="${i===3?'#984000':'#302923'}" font-size="9"${i===3?' font-weight="700"':''}>${inspectionSigned(p.microns)}</text>`;}).join('');
 return `<svg viewBox="0 0 158 58" role="img" aria-label="${label}"><title>${label}</title><rect x="14" y="5" width="140" height="43" fill="#fffaf6" stroke="#b9a28f"/><text x="1" y="13" font-size="7" fill="#775b48">奥</text><text x="0" y="46" font-size="7" fill="#775b48">前</text>${marks}<text x="15" y="55" font-size="7" fill="#775b48">傾き除去・左中0${five?'・A=C=0':''}</text><text x="154" y="55" text-anchor="end" font-size="8" fill="#775b48">差 ${Math.round(value.rangeMicrons)}</text></svg>`;
}
function inspectionSetPage(page,behavior='smooth'){
 const viewport=$('inspectionViewport');if(!$('inspectionCarousel').classList.contains('is-enabled'))return;
 intrinsicInspectionPage=page?1:0;
 viewport.scrollTo({left:intrinsicInspectionPage*viewport.clientWidth,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':behavior});
 inspectionUpdateNavigation();
}
function inspectionUpdateNavigation(){
 const enabled=$('inspectionCarousel').classList.contains('is-enabled'),second=intrinsicInspectionPage===1;
 $('inspectionNext').hidden=!enabled||second;$('inspectionPrevious').hidden=!enabled||!second;
 // Hidden pages remain measurable for stable layout, but are excluded from tab order.
 $('precisionReadouts').inert=enabled&&second;$('intrinsicInspectionPage').inert=!enabled||!second;
 $('inspectionPageStatus').textContent=enabled?(second?'2 / 2 主軸振れ・上面精度':'1 / 2 直角度・触れ'):'';
}
function initializeIntrinsicInspection(){
 if(intrinsicInspectionReady)return;intrinsicInspectionReady=true;
 const carousel=$('inspectionCarousel'),viewport=$('inspectionViewport');
 $('inspectionNext').addEventListener('click',()=>{viewport.focus({preventScroll:true});inspectionSetPage(1);});$('inspectionPrevious').addEventListener('click',()=>{viewport.focus({preventScroll:true});inspectionSetPage(0);});
 const resize=()=>{
  cancelAnimationFrame(intrinsicInspectionFrame);intrinsicInspectionFrame=requestAnimationFrame(()=>{
   if(!carousel.classList.contains('is-enabled'))return;
   carousel.style.setProperty('--inspection-height',$('precisionReadouts').getBoundingClientRect().height+'px');
   viewport.scrollTo({left:intrinsicInspectionPage*viewport.clientWidth,behavior:'instant'});
  });
 };
 new ResizeObserver(resize).observe($('precisionReadouts'));window.addEventListener('resize',resize);
 viewport.addEventListener('scroll',()=>{const next=viewport.scrollLeft>viewport.clientWidth/2?1:0;if(next!==intrinsicInspectionPage){intrinsicInspectionPage=next;inspectionUpdateNavigation();}},{passive:true});
 let gesture=null,suppressClickUntil=0;
 viewport.addEventListener('pointerdown',e=>{
  if(!carousel.classList.contains('is-enabled')||e.button>0)return;
  gesture={id:e.pointerId,x:e.clientX,y:e.clientY,left:viewport.scrollLeft,mouse:e.pointerType==='mouse',drag:false};
 });
 viewport.addEventListener('pointermove',e=>{
  if(!gesture||e.pointerId!==gesture.id)return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
  if(Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)){gesture.drag=true;suppressClickUntil=Date.now()+500;}
  if(gesture.mouse&&gesture.drag){viewport.setPointerCapture(e.pointerId);viewport.classList.add('is-dragging');viewport.scrollLeft=gesture.left-dx;e.preventDefault();}
 });
 const finish=e=>{if(!gesture||e.pointerId!==gesture.id)return;const g=gesture;gesture=null;viewport.classList.remove('is-dragging');if(g.mouse&&g.drag){const dx=e.clientX-g.x;inspectionSetPage(Math.abs(dx)>30?(dx<0?1:0):Math.round(viewport.scrollLeft/viewport.clientWidth));}};
 viewport.addEventListener('pointerup',finish);viewport.addEventListener('pointercancel',e=>{if(gesture&&gesture.id===e.pointerId){gesture=null;viewport.classList.remove('is-dragging');}});
 viewport.addEventListener('click',e=>{if(Date.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
 carousel.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();viewport.focus({preventScroll:true});inspectionSetPage(e.key==='ArrowRight'?1:0);}});
}
function updateIntrinsicInspectionUI(){
 if(typeof current==='undefined'||!current||typeof machineProfile==='undefined'||!$('inspectionCarousel')||!window.IntrinsicInspection)return;
 initializeIntrinsicInspection();
 const carousel=$('inspectionCarousel'),data=current.kind==='lathe'?null:window.IntrinsicInspection.fromProfile(machineProfile),enabled=!!data;
 carousel.classList.toggle('is-enabled',enabled);$('intrinsicInspectionPage').hidden=!enabled;$('inspectionViewport').tabIndex=enabled?0:-1;
 if(!enabled){intrinsicInspectionPage=0;$('inspectionViewport').scrollLeft=0;carousel.style.removeProperty('--inspection-height');inspectionUpdateNavigation();return;}
 const key=current.id+'|'+current.kind+'|'+data.seed+'|'+data.condition;
 if(key!==intrinsicInspectionKey||current!==intrinsicInspectionMachine||machineProfile!==intrinsicInspectionProfile){
  intrinsicInspectionKey=key;intrinsicInspectionMachine=current;intrinsicInspectionProfile=machineProfile;
  $('intrinsicRunoutDiagram').innerHTML=intrinsicRunoutMarkup(data.runout,current.kind==='horizontal');
  $('intrinsicSurfaceDiagram').innerHTML=intrinsicSurfaceMarkup(data.surface,current.kind==='five');
  carousel.dataset.seed=String(data.seed);inspectionSetPage(0,'instant');
 }
 carousel.style.setProperty('--inspection-height',$('precisionReadouts').getBoundingClientRect().height+'px');inspectionUpdateNavigation();
}

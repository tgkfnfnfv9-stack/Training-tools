'use strict';
let fixtureSelectionMachine='';
function selectedFixtureKey(){return $('fixtureSelection')?.value|| (current?.kind==='horizontal'?'YZ':'bore');}
function fixtureStationForSelection(){
 if(current?.kind==='horizontal'&&typeof horizontalMeasurementStation==='function')return horizontalMeasurementStation(positions);
 if(current?.kind==='lathe'&&typeof latheMeasurementStation==='function')return latheMeasurementStation(selectedFixtureKey(),positions);
 return {valid:false,reason:'測定配置の準備中'};
}
function moveToFixtureStation(){
 const station=fixtureStationForSelection();if(!station.valid||!station.positions)return;
 stopMotion();positions={...positions,...station.positions};
 if(typeof resetFixtureComparison==='function')resetFixtureComparison('測定位置へ移動したため、取付けとゼロの保持を解除しました。');
 updateAxisValues();saveLeveling();drawScene();
 $('fixtureSetupStatus').textContent='測定位置へ移動しました。ここで取り付け・ゼロ合わせを行います。';
}
function openFixtureGeometry(key){
 if(key)$('fixtureSelection').value=key;
 $('fixtureFraming').value=current.kind==='lathe'&&selectedFixtureKey()==='bore'?'contact':'full';
 const dialog=$('fixtureGeometryDialog');
 if(!dialog.open)dialog.showModal();
 drawFixtureGeometry();
}
function updateFixtureWorkflow(){
 const root=$('fixtureSetup');if(!root)return;
 root.hidden=!['horizontal','lathe'].includes(current?.kind)||!levelSolution;if(root.hidden)return;
 if(fixtureSelectionMachine!==current.kind){
  fixtureSelectionMachine=current.kind;
  const options=current.kind==='horizontal'?[['YZ','直角 YZ'],['XY','直角 XY'],['XZ','直角 XZ'],['bar','Z平行度・バー']]:[['bore','穴の内周'],['faceX','タレット面 X'],['faceZ','タレット面 Z'],['bar','バー側面'],['barTop','バー上面・回転TIR']];
  $('fixtureSelection').innerHTML=options.map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
  $('fixtureStage').value='S';$('fixtureFraction').value='0';
 }
 const station=fixtureStationForSelection();
 $('fixturePosition').disabled=!station.valid;
 const destination=station.positions?axisConfig(current).map(a=>`${a.key} ${Number(station.positions[a.key]??positions[a.key]).toFixed(2)}%`).join(' ／ '):'';
 $('fixtureSetupStatus').textContent=station.valid?(station.needsMove?'検査用の位置へ移動して、有限治具を取り付けます。':'規定の軸位置です。接触の成立は測定欄と取付図で確認できます。')+(destination?' '+destination:''):station.reason;
 $('fixtureStageControl').hidden=current.kind!=='horizontal'||selectedFixtureKey()==='bar';
 if($('fixtureGeometryDialog').open)drawFixtureGeometry();
}
// All geometry is in physical world metres. This view has no displacement gain.
// Shape metadata comes from the same finite fixtures used for the contact test.
function fixtureSceneData(){
 const args=[selectedFixtureKey(),$('fixtureStage').value,Number($('fixtureFraction').value)/100,positions,levelSolution,machineProfile];
 if(current.kind==='horizontal'&&typeof horizontalFixtureSceneGeometry==='function')return horizontalFixtureSceneGeometry(...args);
 if(current.kind==='lathe'&&typeof latheFixtureSceneGeometry==='function')return latheFixtureSceneGeometry(...args);
 return {valid:false,reason:'測定配置の準備中'};
}
function fixtureShapePolygons(data){
 const faces=[],lines=[],labels=[];
 const plus=(a,b)=>a.map((v,i)=>v+b[i]),scale=(a,k)=>a.map(v=>v*k),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>scale(a,1/Math.hypot(...a));
 for(const box of data.boxes||[]){
  if(box.vertices){faces.push({points:box.vertices,color:box.color||'#cad6db',label:box.label||''});continue;}
  if(!box.center||!box.size)continue;
  const axes=box.axes||[[1,0,0],[0,1,0],[0,0,1]],v=[];
  for(let i=0;i<8;i++){let p=[...box.center];for(let j=0;j<3;j++)p=plus(p,scale(axes[j],box.size[j]*(i&(1<<j)?.5:-.5)));v.push(p);}
  for(const indices of [[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]])faces.push({points:indices.map(i=>v[i]),color:box.color||'#c4d5dd',label:box.label||''});
  if(box.label)labels.push({point:box.center,text:box.label});
 }
 for(const cylinder of data.cylinders||[]){
  const a=cylinder.a||cylinder.start,b=cylinder.b||cylinder.end,r=cylinder.radius;if(!a||!b||!Number.isFinite(r)||r<=0)continue;
  const d=b.map((v,i)=>v-a[i]);if(Math.hypot(...d)<1e-12)continue;
  const axis=norm(d),u=norm(cross(axis,Math.abs(axis[1])<.8?[0,1,0]:[1,0,0])),v=cross(axis,u);
  const rings=[a,b].map(p=>Array.from({length:20},(_,i)=>{
   const angle=i*Math.PI/10;
   return plus(p,plus(scale(u,r*Math.cos(angle)),scale(v,r*Math.sin(angle))));
  }));
  faces.push({points:rings[0],color:cylinder.color||'#dfc8a8',label:cylinder.label||''},{points:rings[1],color:cylinder.color||'#dfc8a8',label:cylinder.label||''});
  for(let i=0;i<20;i++)faces.push({points:[rings[0][i],rings[0][(i+1)%20],rings[1][(i+1)%20],rings[1][i]],color:cylinder.color||'#dfc8a8',label:cylinder.label||''});
  if(cylinder.label)labels.push({point:a.map((q,i)=>(q+b[i])/2),text:cylinder.label});
 }
 for(const segment of data.segments||[]){const points=segment.points||(segment.a&&segment.b?[segment.a,segment.b]:null);if(points?.length){lines.push({points,color:segment.color||'#227486',radius:segment.radius||.004});if(segment.label)labels.push({point:points[Math.floor(points.length/2)],text:segment.label});}}
 const contacts=data.contacts|| (Array.isArray(data.contact)?[data.contact]:data.contact?.point?[data.contact.point]:[]);
 return {faces,lines,labels,contacts:contacts.map(p=>Array.isArray(p)?p:p.point).filter(Boolean)};
}
function drawFixtureGeometry(){
 const canvas=$('fixtureGeometryCanvas'),data=fixtureSceneData();
 $('fixtureGeometryStatus').textContent=(data.preview?'測定位置へ移動した後の配置予告です。実際の軸はまだ移動していません。 ':'')+(data.label?data.label+'。 ':'')+(data.reason|| (data.valid?'接触が成立しています。':'現在の位置では接触が成立しません。'));
 canvas.dataset.fixture=JSON.stringify(data);
 const rect=canvas.getBoundingClientRect();if(!rect.width)return;
 const width=rect.width,height=rect.height||300,ratio=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
 const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);ctx.fillStyle='#f7f6f1';ctx.fillRect(0,0,width,height);
 const {faces,lines,labels,contacts}=fixtureShapePolygons(data),view=$('fixtureProjection').value;
 $('fixtureGeometryLegend').textContent=[...new Set(labels.map(q=>q.text))].join(' ／ ');
 const project=p=>view==='front'?[p[0],-p[1],p[2]]:view==='side'?[p[2],-p[1],-p[0]]:[.82*p[0]-.57*p[2],-.90*p[1]-.25*p[0]-.36*p[2],.51*p[0]-.43*p[1]+.74*p[2]];
 const points=[...faces.flatMap(f=>f.points),...lines.flatMap(l=>l.points),...contacts];if(!points.length){ctx.fillStyle='#61574d';ctx.font='13px sans-serif';ctx.fillText('測定位置へ移動すると配置を確認できます。',14,30);return;}
 const detail=$('fixtureFraming').value==='contact'&&contacts.length>0;
 const fitPoints=detail?contacts.flatMap(p=>Array.from({length:8},(_,i)=>p.map((v,j)=>v+(i&(1<<j)?.13:-.13)))):points;
 const projected=fitPoints.map(project),lo=[0,1].map(i=>Math.min(...projected.map(p=>p[i]))),hi=[0,1].map(i=>Math.max(...projected.map(p=>p[i]))),scale=Math.min((width-32)/Math.max(.05,hi[0]-lo[0]),(height-50)/Math.max(.05,hi[1]-lo[1]));
 const screen=p=>{const q=project(p);return [width/2+(q[0]-(lo[0]+hi[0])/2)*scale,height/2+(q[1]-(lo[1]+hi[1])/2)*scale,q[2]];};
 faces.map(f=>({...f,p:f.points.map(screen)})).sort((a,b)=>b.p.reduce((s,p)=>s+p[2],0)/b.p.length-a.p.reduce((s,p)=>s+p[2],0)/a.p.length).forEach(f=>{
  const context=/主軸台|チャック|タレット|コラム|主軸頭|主軸胴|主軸鼻端|パレット|箱台/.test(f.label)||['#c0d3d8','#a7bdc4','#b5c9ce'].includes(f.color);
  ctx.globalAlpha=(detail&&context)?0.13:1;
  ctx.beginPath();f.p.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fillStyle=f.color;ctx.fill();ctx.strokeStyle='#354b5755';ctx.lineWidth=.6;ctx.stroke();
 });ctx.globalAlpha=1;
 for(const l of lines){ctx.beginPath();l.points.map(screen).forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.strokeStyle=l.color;ctx.lineWidth=Math.max(1,2*l.radius*scale);ctx.lineJoin='round';ctx.stroke();}
 for(const point of contacts){const p=screen(point);ctx.beginPath();ctx.arc(p[0],p[1],4,0,Math.PI*2);ctx.fillStyle='#c65317';ctx.fill();ctx.strokeStyle='white';ctx.lineWidth=1;ctx.stroke();}
 // A scale bar makes the distinction from the enlarged explanatory diagrams explicit.
 const bar=[.01,.02,.05,.1,.2,.5].filter(v=>v*scale<width*.3).at(-1)||.01;
 ctx.strokeStyle='#3a4c55';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(12,height-18);ctx.lineTo(12+bar*scale,height-18);ctx.stroke();ctx.font='11px sans-serif';ctx.fillStyle='#394b54';ctx.fillText(`${Math.round(bar*1000)} mm`,12,height-23);
}
$('fixturePosition').onclick=moveToFixtureStation;
$('fixtureSelection').onchange=()=>{updateFixtureWorkflow();drawFixtureGeometry();};
$('fixtureProjection').onchange=drawFixtureGeometry;
$('fixtureFraming').onchange=drawFixtureGeometry;
$('fixtureStage').onchange=drawFixtureGeometry;
$('fixtureFraction').oninput=drawFixtureGeometry;
$('fixtureGeometryOpen').onclick=()=>openFixtureGeometry();
$('closeFixtureGeometry').onclick=()=>$('fixtureGeometryDialog').close();

'use strict';
// Finite teaching fixtures, in metres. These are declared model dimensions,
// not dimensions or stiffness certified for the named example machine.
const horizontalFixtureSpec=Object.freeze({version:'horizontal-station-fixtures-v1',towerHeight:.85,armRadius:.004,housingRadius:.02,housingHalfThickness:.01,housingBack:.035,barLength:.4,barRadius:.025,barStart:.35,barEnd:.05});
function horizontalMeasurementStation(state=positions){
 const scaleX=levelConfig.width/(current.w*.8),scaleZ=levelConfig.depth/(current.d*.8),layout=columnLayoutOffset(current),xHalf=.55*scaleX,zHalf=.45*scaleZ;
 const x=-layout.x*scaleX,z=(-.08+layout.z)*scaleZ-.32,station={...state,X:x/xHalf*100,Y:-100,Z:z/zHalf*100};
 let reason='';
 if(Math.abs(x)+.15>xHalf+1e-10)reason='Xの測定位置とR合わせ300 mmが可動域外です。コラム位置または幅を戻してください';
 else if(z< -zHalf-1e-10||z+.3>zHalf+1e-10)reason='Zの測定位置と300 mm走査が可動域外です。コラム位置または奥行を戻してください';
 else if(1.45*scaleX<.64||1.45*scaleZ<.84)reason='600 mm箱台と20 mmの縁余裕をパレット内に置けません';
 const needsMove=['X','Y','Z'].some(k=>Math.abs((state[k]||0)-station[k])>1e-6);
 return {valid:!reason,reason,positions:station,physical:{X:x,Y:-.3,Z:z,Xhalf:xHalf,Zhalf:zHalf,RXstart:x-.15,RXend:x+.15,Zend:z+.3},needsMove};
}
function horizontalFixtureTool(state,solution,profile){const t=horizontalSpindleFixture(state,solution,profile);return {...t,point:t.nose,frame:{right:t.right,up:t.up,back:t.axis,rotate:v=>t.right.map((q,i)=>q*v[0]+t.up[i]*v[1]+t.axis[i]*v[2])}};}
function horizontalFixturePallet(state,solution,profile){return {point:horizontalPalletPoint([0,1.27,-.85],state,solution,profile),frame:referenceRigidFrame(geometryModel(state,solution,profile).workFrame)};}
function horizontalFixtureLocal(point,member){const M=window.ReferenceMeasurement,d=M.sub(point,member.point);return [M.dot(d,member.frame.right),M.dot(d,member.frame.up),M.dot(d,member.frame.back)];}
function horizontalFixtureVectorLocal(v,member){const M=window.ReferenceMeasurement;return [M.dot(v,member.frame.right),M.dot(v,member.frame.up),M.dot(v,member.frame.back)];}
function horizontalFixtureWorld(point,member){const M=window.ReferenceMeasurement;return M.add(member.point,member.frame.rotate(point));}
function horizontalFixtureCross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function horizontalFixtureBox(center,axes,half,label){return {center,axes,half,label};}
function horizontalFixtureBoxMap(box,member){return {...box,center:horizontalFixtureWorld(box.center,member),axes:box.axes.map(v=>member.frame.rotate(v))};}
function horizontalFixtureTower(){const axes=[[1,0,0],[0,1,0],[0,0,1]];return [horizontalFixtureBox([0,.01,-.1],axes,[.3,.01,.3],'箱台の脚板'),horizontalFixtureBox([0,.42,-.1],axes,[.2,.4,.2],'箱台の柱'),horizontalFixtureBox([0,.835,-.1],axes,[.3,.015,.25],'箱台の天板')];}
function horizontalFixtureMachineBoxes(state,solution,profile){
 const t=horizontalFixtureTool(state,solution,profile),M=window.ReferenceMeasurement,scaleX=levelConfig.width/(current.w*.8),scaleZ=levelConfig.depth/(current.d*.8),axes=[t.right,t.up,t.axis];
 const point=raw=>horizontalToolPoint(raw,state,solution,profile,1,['X']),front=current.d*.18-.06,back=current.d*.29-.35+.01;
 return [horizontalFixtureBox(M.add(t.nose,M.scale(t.axis,.1*scaleZ)),axes,[.045,.045,.1*scaleZ],'主軸鼻端（外接箱）'),horizontalFixtureBox(M.add(t.nose,M.scale(t.axis,.48*scaleZ)),axes,[.2,.2,.3*scaleZ],'主軸胴（外接箱）'),horizontalFixtureBox(M.add(t.nose,M.scale(t.axis,1.18*scaleZ)),axes,[.375*scaleX,.31,.55*scaleZ],'主軸頭'),horizontalFixtureBox(point([0,1.95,current.d*.29]),axes,[.475*scaleX,1.25,.35*scaleZ],'コラム'),horizontalFixtureBox(point([0,2,(front+back)/2]),axes,[.08*scaleX,1,(back-front)*scaleZ/2],'主軸頭案内')];
}
// Separating-axis test on two oriented finite boxes. Cylinders use enclosing
// boxes for clearance: a rejection may be conservative, never a passed overlap.
function horizontalFixtureBoxesOverlap(a,b,padding=0){
 const M=window.ReferenceMeasurement,d=M.sub(b.center,a.center),axes=[...a.axes,...b.axes,...a.axes.flatMap(u=>b.axes.map(v=>horizontalFixtureCross(u,v)))];
 return !axes.some(n=>{const length=Math.hypot(...n);if(length<1e-12)return false;const q=n.map(v=>v/length),ra=a.half.reduce((s,h,i)=>s+(h+padding)*Math.abs(M.dot(q,a.axes[i])),0),rb=b.half.reduce((s,h,i)=>s+h*Math.abs(M.dot(q,b.axes[i])),0);return Math.abs(M.dot(d,q))>=ra+rb-1e-10;});
}
function horizontalFixtureSegmentBox(a,b,box,radius=.004){
 const M=window.ReferenceMeasurement,p=box.axes.map(v=>M.dot(M.sub(a,box.center),v)),q=box.axes.map(v=>M.dot(M.sub(b,box.center),v));let lo=0,hi=1;
 for(let i=0;i<3;i++){const d=q[i]-p[i],h=box.half[i]+radius;if(Math.abs(d)<1e-14){if(Math.abs(p[i])>=h-1e-10)return false;}else {let a=(-h-p[i])/d,b=(h-p[i])/d;if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>=hi-1e-10)return false;}}
 return lo<hi-1e-10;
}
function horizontalFixtureHousing(pose){
 const M=window.ReferenceMeasurement,n=M.unit(pose.probe),seed=Math.abs(n[1])<.9?[0,1,0]:[1,0,0],u=M.unit(horizontalFixtureCross(n,seed)),v=horizontalFixtureCross(n,u);
 return horizontalFixtureBox(M.sub(pose.body,M.scale(n,horizontalFixtureSpec.housingBack)),[n,u,v],[.01,.02,.02],'計器本体（外接箱）');
}
// The head-side routes are finite and kept in the clear front half-space until
// they pass the side or above the square. No automatically extending arm.
function horizontalFixtureArm(pair,stage,pose,tool){
 const M=window.ReferenceMeasurement,h=horizontalFixtureHousing(pose).center,local=horizontalFixtureLocal(h,tool),hub=[0,0,-.08];
 const route=['XY','XZ'].includes(pair)&&stage==='S'?[hub,[.25,0,-.08],[.25,local[1],local[2]],local]:pair==='XY'&&stage==='R'?[hub,[0,local[1],-.08],local]:[hub,[local[0],local[1],-.08],local];
 return [tool.nose,...route.map(v=>horizontalFixtureWorld(v,tool))];
}
function horizontalFixtureMasterBox(scan,pallet){
 const M=window.ReferenceMeasurement,m=scan.master,nS=m.Snormal,nR=m.Rnormal,nT=horizontalFixtureCross(nS,nR),yz=scan.setup.pairKey==='YZ';
 // XY/YZ use the top R; XZ uses a side R. Thickness and the full
 // rectangular solid are kept distinct from the sampled contact interval.
 const center=yz?M.add(m.corner,M.add(M.scale(nS,-.15),M.scale(nR,-.16))):M.add(m.corner,M.add(M.scale(nS,.15),M.scale(nR,scan.setup.scan==='Y'?-.16:.16)));
 return horizontalFixtureBox(center,[nS,nR,nT],[.16,.16,.025],'直角マスタ');
}
function horizontalFixtureFeet(master,pair){
 const M=window.ReferenceMeasurement,index=pair==='XZ'?2:1,n=master.axes[index],sign=n[1]<0?-1:1,bottom=M.sub(master.center,M.scale(n,sign*master.half[index])),xs=pair==='YZ'?[-.01,.01]:[-.12,.12],zs=pair==='XY'?[.105,.135]:[-.12,.12],axes=[[1,0,0],[0,1,0],[0,0,1]];
 return xs.flatMap(x=>zs.map(z=>{const top=(M.dot(n,bottom)-n[0]*x-n[2]*z)/n[1];return horizontalFixtureBox([x,(.85+top)/2,z],axes,[.006,(top-.85)/2,.006],'球面座付き調整足');}));
}
function horizontalFixtureSquareReason(sample,masterLocal,feetLocal,solution,profile){
 if(!sample.valid)return sample.reason||'接触が成立しません';
 const M=window.ReferenceMeasurement,pallet=horizontalFixturePallet(sample.state,solution,profile),tool=horizontalFixtureTool(sample.state,solution,profile),master=horizontalFixtureBoxMap(masterLocal,pallet),tower=horizontalFixtureTower().map(b=>horizontalFixtureBoxMap(b,pallet)),feet=feetLocal.map(b=>horizontalFixtureBoxMap(b,pallet)),housing=horizontalFixtureHousing(sample.pose),machine=horizontalFixtureMachineBoxes(sample.state,solution,profile),arm=sample.arm;
 if(master.axes.some(n=>!n.every(Number.isFinite)))return 'マスタ姿勢が不正';
 if(feetLocal.some(b=>b.half[1]<=0||b.half[1]>.075||Math.abs(b.center[0])+.006>.3||b.center[2]+.006>.15||b.center[2]-.006<-.35))return '調整足を箱台の天板内に固定できません';
 if(sample.point){const d=M.sub(sample.point,master.center);if(master.axes.some((n,i)=>Math.abs(M.dot(d,n))>master.half[i]+1e-8))return '固定した有限マスタの面外';}
 if(tower.some(b=>horizontalFixtureBoxesOverlap(master,b)))return '直角マスタが箱台に干渉';
 if(machine.some(b=>horizontalFixtureBoxesOverlap(master,b)))return '直角マスタが主軸側に干渉';
 if([...tower,...feet].some(b=>machine.some(q=>horizontalFixtureBoxesOverlap(b,q))))return '箱台または調整足が主軸側に干渉';
 if([...tower,...feet,master,...machine].some(b=>horizontalFixtureBoxesOverlap(housing,b)))return '計器本体が器具または主軸側に干渉';
 if(arm.some((p,i)=>i&&[master,...tower,...feet].some(b=>horizontalFixtureSegmentBox(arm[i-1],p,b))))return '取付け腕が器具に干渉';
 if(arm.slice(2).some((p,j)=>machine.some(b=>horizontalFixtureSegmentBox(arm[j+1],p,b))))return '取付け腕が主軸側に干渉';
 if(Math.max(...arm.map(p=>Math.hypot(...M.sub(p,tool.nose))))>.45+1e-10)return '450 mm以内の取付け腕で届きません';
 return '';
}
function horizontalFixtureAttach(scan,solution,profile){
 if(!scan.valid||!scan.startState||!scan.master)return scan;
 const M=window.ReferenceMeasurement,p0=horizontalFixturePallet(scan.startState,solution,profile),masterWorld=horizontalFixtureMasterBox(scan,p0),masterLocal={...masterWorld,center:horizontalFixtureLocal(masterWorld.center,p0),axes:masterWorld.axes.map(v=>horizontalFixtureVectorLocal(v,p0))};
 const stages=[['R',scan.alignment],['S',scan]],bad=[];
 for(const [name,part]of stages){
  if(!part?.samples?.length)continue;
  const first=part.samples[0],firstState=first.state||part.startState,tool0=horizontalFixtureTool(firstState,solution,profile),arm=horizontalFixtureArm(scan.setup.pairKey||scan.setup.base+scan.setup.scan,name,first.pose,tool0),armLocal=arm.map(p=>horizontalFixtureLocal(p,tool0));
  const pair=scan.setup.pairKey||scan.setup.base+scan.setup.scan,feetLocal=horizontalFixtureFeet(masterLocal,pair);
  part.fixture={masterLocal,armLocal,feetLocal,stage:name,pair};
  for(const sample of part.samples){const tool=horizontalFixtureTool(sample.state,solution,profile);sample.arm=armLocal.map(p=>horizontalFixtureWorld(p,tool));
   const reason=horizontalFixtureSquareReason(sample,masterLocal,feetLocal,solution,profile);
   if(reason){sample.valid=false;sample.reason=reason;part.valid=false;part.reason=reason;part.microns=null;bad.push({stage:name,t:sample.t,reason});}
  }
 }
 scan.fixtureSpec=horizontalFixtureSpec;scan.masterLocal=masterLocal;
 scan.bracket={mount:'spindle',R:scan.alignment.samples[0].arm,S:scan.samples[0].arm,sectionRadius:.004};
 if(bad.length)return {...scan,valid:false,reason:bad[0].stage+'：'+bad[0].reason,fixtureFailures:bad};
 return scan;
}
function horizontalFixtureBarBox(bar){const M=window.ReferenceMeasurement,seed=Math.abs(bar.axis[1])<.9?[0,1,0]:[1,0,0],a=M.unit(horizontalFixtureCross(bar.axis,seed)),b=horizontalFixtureCross(bar.axis,a);return horizontalFixtureBox(M.add(bar.origin,M.scale(bar.axis,(bar.axialMin+bar.axialMax)/2)),[a,b,bar.axis],[bar.radius,bar.radius,(bar.axialMax-bar.axialMin)/2],'テストバー（外接箱）');}
function horizontalFixtureValidateBarSample(sample,bar,solution,profile){
 if(!sample.valid)return sample.reason;
 const p=horizontalFixturePallet(sample.state,solution,profile),tower=horizontalFixtureTower().map(b=>horizontalFixtureBoxMap(b,p)),housing=horizontalFixtureHousing(sample.pose),machine=horizontalFixtureMachineBoxes(sample.state,solution,profile),barBox=horizontalFixtureBarBox(bar),arm=sample.arm;
 if(tower.some(b=>[barBox,...machine].some(q=>horizontalFixtureBoxesOverlap(b,q))))return '箱台がバーまたは主軸側に干渉';
 if([...tower,barBox,...machine].some(b=>horizontalFixtureBoxesOverlap(housing,b)))return '計器本体が箱台・バー・主軸側に干渉';
 if(arm.some((q,i)=>i&&[barBox,...machine].some(b=>horizontalFixtureSegmentBox(arm[i-1],q,b))))return 'パレット側の短い支柱がバーまたは主軸側に干渉';
 const local=horizontalFixtureLocal(arm[0],p);
 if(Math.abs(local[0])>.28||local[2]<-.33||local[2]>.13)return '計器支柱を箱台の天板内に固定できません';
 if(Math.hypot(...window.ReferenceMeasurement.sub(arm.at(-1),arm[0]))>.2)return '200 mm以内の計器支柱で届きません';
 return '';
}
function horizontalCaptureFixtures(state=positions,solution=levelSolution,profile=machineProfile){
 const rows=[],payload=[];
 function capture(key,label,part,scan,kind){
  const valid=!!part?.valid&&!!part?.fixture&&!!part.samples?.length&&part.samples.every(q=>q.valid),reason=valid?'':part?.reason||scan?.reason||'初回の取付けが成立していません';
  rows.push({key,label,valid,microns:valid?part.microns:null,reason});
  if(!valid){payload.push({key,label,valid:false,reason});return;}
  const first=part.samples[0],s0=first.state,surface=kind==='bar'?horizontalFixtureTool(s0,solution,profile):horizontalFixturePallet(s0,solution,profile),bodyMember=kind==='bar'?horizontalFixturePallet(s0,solution,profile):horizontalFixtureTool(s0,solution,profile),pose=first.pose;
  const shape=kind==='bar'?{origin:horizontalFixtureLocal(scan.bar.origin,surface),axis:horizontalFixtureVectorLocal(scan.bar.axis,surface),radius:scan.bar.radius,axialMin:scan.bar.axialMin,axialMax:scan.bar.axialMax}:{point:horizontalFixtureLocal(pose.point,surface),normal:horizontalFixtureVectorLocal(pose.normal,surface),master:part.fixture.masterLocal,feet:part.fixture.feetLocal};
  payload.push({key,label,kind,valid:true,zero:first.extension,shape,body:horizontalFixtureLocal(pose.body,bodyMember),probe:horizontalFixtureVectorLocal(pose.probe,bodyMember),arm:part.fixture.armLocal,states:part.samples.map(q=>({t:q.t,state:q.state})),initialMicrons:part.microns});
 }
 for(const key of ['XY','XZ','YZ']){const scan=referenceScan({key},state,solution,profile);capture('square.'+key,key+' S・300 mm',scan,scan,'square');capture('square.'+key+'.R',key+' R・方向合わせ',scan.alignment||scan,scan,'square');}
 const bar=horizontalParallelism(state,solution,profile);for(const key of ['a','b'])capture('bar.'+key,'Z平行度 '+key,bar[key],bar,'bar');
 return {version:horizontalFixtureSpec.version,rows,payload,state:{...state}};
}
function horizontalEvaluateHeld(snapshot,solution=levelSolution,profile=machineProfile){
 const M=window.ReferenceMeasurement,rows=[];
 for(const data of snapshot.payload||[]){
  if(!data.valid){rows.push({key:data.key,label:data.label,valid:false,microns:null,reason:'初回取付け不可：'+data.reason});continue;}
  const samples=data.states.map(({t,state})=>{
   const pallet=horizontalFixturePallet(state,solution,profile),tool=horizontalFixtureTool(state,solution,profile),surface=data.kind==='bar'?tool:pallet,owner=data.kind==='bar'?pallet:tool,body=horizontalFixtureWorld(data.body,owner),probe=owner.frame.rotate(data.probe),arm=data.arm.map(p=>horizontalFixtureWorld(p,owner));
   if(data.kind==='bar'){const bar={...data.shape,origin:horizontalFixtureWorld(data.shape.origin,surface),axis:surface.frame.rotate(data.shape.axis)},pose={body,probe},hit=window.HorizontalParallelism.contact({...bar,...pose}),sample={...hit,t,state,pose,arm};const reason=horizontalFixtureValidateBarSample(sample,bar,solution,profile);return reason?{...sample,valid:false,reason}:sample;}
   const pose={point:horizontalFixtureWorld(data.shape.point,surface),normal:surface.frame.rotate(data.shape.normal),body,probe},hit=M.contact(pose),sample={...hit,t,state,pose,arm};
   const reason=horizontalFixtureSquareReason(sample,data.shape.master,data.shape.feet,solution,profile);
   return reason?{...sample,valid:false,reason}:sample;
  });
  const bad=samples.find(q=>!q.valid),endpoint=samples.at(-1),microns=bad?null:(data.zero-endpoint.extension)*1e6;
  rows.push({key:data.key,label:data.label,valid:!bad,microns,reason:bad?.reason||'',zero:data.zero,endpoint:bad?null:endpoint.extension,startExtension:samples[0].extension,samples});
 }
 return {rows};
}
function horizontalFixtureSceneGeometry(key='YZ',stage='S',fraction=0,state=positions,solution=levelSolution,profile=machineProfile){
 const station=horizontalMeasurementStation(state),M=window.ReferenceMeasurement;
 if(!station.valid)return {valid:false,reason:station.reason,boxes:[],segments:[],cylinders:[]};
 const preview=station.needsMove,measurementState=preview?station.positions:state,barMode=key==='bar'||key.startsWith('bar.'),scan=barMode?horizontalParallelism(measurementState,solution,profile):referenceScan({key},measurementState,solution,profile),part=barMode?scan.a:stage==='R'?scan.alignment:scan;
 if(!part?.samples?.length||!part?.fixture)return {valid:false,reason:scan.reason||part?.reason||'測定配置なし',boxes:[],segments:[],cylinders:[]};
 const sample=part.samples.reduce((a,b)=>Math.abs(a.t-fraction)<=Math.abs(b.t-fraction)?a:b),pallet=horizontalFixturePallet(sample.state,solution,profile),tool=horizontalFixtureTool(sample.state,solution,profile),colorBox=(box,color)=>({...box,size:box.half.map(v=>v*2),color}),scaleX=levelConfig.width/(current.w*.8),scaleZ=levelConfig.depth/(current.d*.8);
 const boxes=[colorBox(horizontalFixtureBoxMap(horizontalFixtureBox([0,-.07,0],[[1,0,0],[0,1,0],[0,0,1]],[.725*scaleX,.07,.725*scaleZ],'パレット'),pallet),'#6c8f92'),...horizontalFixtureTower().map(b=>colorBox(horizontalFixtureBoxMap(b,pallet),'#9aadb1')),...horizontalFixtureMachineBoxes(sample.state,solution,profile).map(b=>colorBox(b,'#b6c2c8'))],segments=[],cylinders=[],contacts=[];
 const displayValid=barMode?scan.valid:part.valid;
 const addIndicator=q=>{const contactValid=displayValid&&q.valid;boxes.push(colorBox(horizontalFixtureHousing(q.pose),'#e29d43'));segments.push({points:q.arm,radius:.004,color:'#525d68',label:barMode?'箱台側の支柱':'主軸側の短い腕'},{points:[q.pose.body,q.point||M.add(q.pose.body,M.scale(q.pose.probe,.01))],radius:.0025,color:contactValid?'#d26c31':'#8b9299',label:contactValid?'測定子':'未成立配置の測定子'});if(contactValid&&q.point)contacts.push(q.point);};
 if(barMode){cylinders.push({a:M.add(scan.bar.origin,M.scale(scan.bar.axis,scan.bar.axialMin)),b:M.add(scan.bar.origin,M.scale(scan.bar.axis,scan.bar.axialMax)),radius:scan.bar.radius,color:'#596b8d',label:'400 mmテストバー'});addIndicator(sample);const other=scan.b.samples?.find(q=>q.t===sample.t);if(other)addIndicator(other);}
 else {boxes.push(colorBox(horizontalFixtureBoxMap(part.fixture.masterLocal,pallet),'#486b83'),...part.fixture.feetLocal.map(b=>colorBox(horizontalFixtureBoxMap(b,pallet),'#526469')));addIndicator(sample);}
 return {valid:!!displayValid,reason:part.reason||scan.reason||'',preview,label:(barMode?'Z平行度 a/b':key+' '+stage)+'：'+(preview?'測定位置の予告・実軸は未移動':'測定配置')+'／'+Math.round(sample.t*300)+' mm',state:sample.state,boxes,segments,cylinders,contacts,contact:displayValid&&sample.valid?sample.point:null,zero:displayValid?part.samples[0].point:null,readout:part.microns,sampleFraction:sample.t};
}
// TIR is measured with the same finite table-side indicator at two different
// Z positions. Intrinsic runout values are computed separately from the seed
// at these actual distances, not copied from the former 0/300 mm labels.
function horizontalRunoutFixtureGeometry(state=positions,solution=levelSolution,profile=machineProfile){
 const scan=horizontalParallelism(state,solution,profile),row=scan.a;
 if(!row?.valid)return {valid:false,reason:row?.reason||scan.reason,root:{valid:false,reason:row?.reason||scan.reason},tip:{valid:false,reason:row?.reason||scan.reason}};
 const point=(sample,distanceMm)=>({valid:sample.valid,reason:sample.reason,distanceMm,state:sample.state,pose:sample.pose,contact:sample.point,extension:sample.extension,arm:sample.arm,bar:scan.bar});
 return {valid:true,bar:scan.bar,root:point(row.samples.at(-1),50),tip:point(row.samples[0],350),fixture:'same-850mm-tower-and-fixed-table-indicator',turns:'パレットを各測定位置で停止し、主軸を1回転'};
}
function horizontalReferenceCard(pair,m,before){
 const reading=m.valid?squarenessMicronText(m.microns)+' µm':m.reason,old=before.valid?squarenessMicronText(before.microns)+' µm':before.reason,station=horizontalMeasurementStation(),interval=horizontalReferenceInterval(m),yz=pair.key==='YZ',xy=pair.key==='XY';
 const r=yz?'Y中央で上面Rへ下向きに接触し、主軸頭を止めてパレットをZ＋へ300 mm送る。両端を等指示にし、厚み方向の中央線も合わせる。':xy?'Y中央で上面Rへ下向きに接触し、主軸頭をXへ300 mm送り、両端を等指示にする。':'Y下端で横向きRへ接触し、主軸頭をXへ300 mm送り、両端を等指示にする。';
 const s=pair.key==='XZ'?'主軸頭を止め、パレット・箱台・マスタをZ＋（主軸側）へ300 mm送る。':'パレット・箱台・マスタを止め、主軸頭・計器をY下端から中央へ300 mm上げる。',height=xy?'950→1250':yz?'910→1210':'900';
 return `<section class="measurement-reference-card" data-reference-pair="${pair.key}"><h3>${pair.key} <span>${reading}</span></h3><p class="measurement-interval"${interval?` data-current-position-mm="${interval.currentPosition*1000}" data-zero-position-mm="${interval.startPosition*1000}" data-end-position-mm="${interval.endPosition*1000}"`:''}><strong>300 mm測定の終点値（始点で再ゼロ）</strong>${interval?`<br>現在${interval.key} ${signed(interval.currentPosition*1000,1)} mm／始点 ${signed(interval.startPosition*1000,1)} mm → 終点 ${signed(interval.endPosition*1000,1)} mm。部材位置・中央0。`:'<br>'+m.reason}</p><svg class="reference-diagram" viewBox="0 0 64 45" role="img" aria-label="${pair.key}のS面と主軸側計器">${referenceDiagram(m)}</svg><p>マスタと850 mm箱台：パレット固定。計器：主軸側固定。① ${r}<br>② マスタを固定したまま規定のS始点へ戻し、S用の短い腕へ付け替えてゼロ。<br>③ ${s} 途中の再取付け・再ゼロはしません。</p><p>＋は測定子の押込み増加、−は減少です。支持調整後にR合わせ・S取付け・始点ゼロを取り直した値を主欄に表示します。「取付けとゼロを保持」の比較欄では最初の部材内取付座標とゼロを固定した終点指示を別に表示します。</p><p>箱台は脚板600×600×20 mm、柱400×400×800 mm、天板600×500×30 mm。マスタ320×320×50 mmを球面座付き調整足で固定します。標準・理想時のS接触はパレット上面から${height} mmです。計器本体は直径40 mm相当・厚さ20 mm、主軸側の腕の中心線は鼻端から450 mm以内、棒半径4 mm。初期伸び10 mm、可動範囲0〜20 mm。部材・治具・鼻端・主軸胴・頭・コラムの有限範囲を確認します。円筒の外接箱を使う干渉判定は保守的です。</p><p>「器具の取付け・接触を見る」で、R/Sと始点/終点の等縮尺配置を確認できます。上の小図はS面の展開図で、針の変化のみ拡大します。規定位置以外で腕を伸ばして値を成立させません。ワークを外し、検査ごとに治具を付け替える教材手順です。実機用治具の認定、弾性・測定力・固定ボルトの強度計算は含みません。</p><p>初期支持状態：${old}／現在：${reading}（同じ規定区間で各々再ゼロ）。</p>${!station.valid?`<p>${station.reason}</p>`:''}</section>`;
}

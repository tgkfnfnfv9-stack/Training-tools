'use strict';
// Independent spindle-sweep oracles. A plane y = px + qz under a vertical
// spindle has readings r*[0, q-p, -2p, -q-p] after zeroing on the right.
// A spindle inclined by theta above a horizontal table has opposite-point
// difference D*tan(theta). These expectations do not call the implementation
// to manufacture expected indicator values, frames, or surface normals.
const assert=require('node:assert/strict');
const Sweep=require('../src/spindle-sweep.js');
let checks=0;const failures=[];
const check=(name,fn)=>{checks++;try{fn();}catch(error){failures.push(name+': '+error.message);}};
const near=(a,b,t=1e-7)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,`${a} != ${b}`);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=v=>v.map(x=>x/Math.hypot(...v));
const vectorNear=(a,b,t=1e-7)=>{assert.equal(a.length,b.length);a.forEach((x,i)=>near(x,b[i],t));};
const readings=s=>s.cardinal.map(p=>p.readingMicrons);
const measured=(overrides={})=>Sweep.measure({axis:[0,1,0],tableNormal:[0,1,0],right:[1,0,0],...overrides});
function rotate(v,{x=0,y=0,z=0}={}){
 // Independent explicit Euler rotations, applied X then Y then Z.
 let [a,b,c]=v;
 [b,c]=[b*Math.cos(x)-c*Math.sin(x),b*Math.sin(x)+c*Math.cos(x)];
 [a,c]=[a*Math.cos(y)+c*Math.sin(y),-a*Math.sin(y)+c*Math.cos(y)];
 return [a*Math.cos(z)-b*Math.sin(z),a*Math.sin(z)+b*Math.cos(z),c];
}

check('horizontal aligned spindle and table read exactly zero at four angles',()=>{
 const s=measured();assert.equal(s.valid,true);assert.deepEqual(readings(s),[0,0,0,0]);near(s.tirMicrons,0);near(s.radius,.15,0);
});
for(const [p,q] of [[0,0],[.00004,0],[-.00004,0],[0,.00007],[0,-.00007],[.00004,.00007],[-.00004,.00007],[.04,-.07]]){
 const r=.15,expected=[0,r*(q-p),-2*r*p,-r*(q+p)].map(v=>v*1e6),s=measured({tableNormal:[-p,1,-q]}),tag=`${p}/${q}`;
 check('affine plane gives independently signed four-point readings '+tag,()=>{assert.equal(s.valid,true);vectorNear(readings(s),expected);});
 check('300 mm is the diameter of opposite measurement positions '+tag,()=>{near(s.cardinal[0].readingMicrons-s.cardinal[2].readingMicrons,.3*p*1e6);near(s.cardinal[1].readingMicrons-s.cardinal[3].readingMicrons,.3*q*1e6);near(Math.hypot(...sub(s.cardinal[0].ringPoint,s.cardinal[2].ringPoint)),.3,1e-14);});
 check('four-point midpoint identity and exact zero reference '+tag,()=>{assert.equal(s.cardinal[0].readingMicrons,0);near(expected[0]+expected[2],expected[1]+expected[3]);near(s.cardinal[0].readingMicrons+s.cardinal[2].readingMicrons,s.cardinal[1].readingMicrons+s.cardinal[3].readingMicrons);});
 check('full-circle range follows the resultant slope '+tag,()=>near(s.tirMicrons,.3*Math.hypot(p,q)*1e6));
 check('four-point range describes sampled points rather than full-circle range '+tag,()=>{near(s.fourPointRangeMicrons,Math.max(...expected)-Math.min(...expected));assert.ok(s.fourPointRangeMicrons<=s.tirMicrons+1e-7);});
 for(const angle of [17,43,122,231,315]){
  const theta=angle*Math.PI/180,expected=r*(p*(Math.cos(theta)-1)+q*Math.sin(theta))*1e6,point=s.at(angle);
  check(`arbitrary angle ${angle} follows affine-plane height ${tag}`,()=>near(point.readingMicrons,expected));
  check(`contact is on the independently defined plane ${angle}/${tag}`,()=>{near(point.contactPoint[1],p*point.contactPoint[0]+q*point.contactPoint[2],1e-14);near(dot(point.ringPoint,s.axis),0,1e-14);near(Math.hypot(...point.ringPoint),r,1e-14);vectorNear(sub(point.contactPoint,point.ringPoint),s.axis.map(v=>v*point.axialOffsetMetres),1e-14);});
 }
 for(const radius of [.075,.3]){
  const scaled=measured({tableNormal:[-p,1,-q],radius});
  check('radius changes physically scale all readings '+radius+'/'+tag,()=>{vectorNear(readings(scaled),expected.map(v=>v*radius/r));near(scaled.tirMicrons,s.tirMicrons*radius/r);});
 }
}

for(const angle of [-.21,-.001,-.00005,0,.00005,.001,.21]){
 const c=Math.cos(angle),s=Math.sin(angle),opposite=.3*Math.tan(angle)*1e6;
 const rightTilt=measured({axis:[s,c,0],right:[c,-s,0]});
 const backTilt=measured({axis:[0,c,s],right:[1,0,0]});
 check('right spindle lean produces D*tan(theta) with the correct zero-side sign '+angle,()=>vectorNear(readings(rightTilt),[0,-opposite/2,-opposite,-opposite/2]));
 check('back spindle lean changes the back/front readings '+angle,()=>vectorNear(readings(backTilt),[0,opposite/2,0,-opposite/2]));
 check('both directions distinguish right/back from left/front '+angle,()=>{near(rightTilt.tirMicrons,Math.abs(opposite));near(backTilt.tirMicrons,Math.abs(opposite));});
}

// Equal common rotation of the spindle, its zero mark, and the workplane
// cannot alter the indicated relative geometry. Rotations are deliberately
// large and noncommuting; the machine's tiny-angle support approximation is
// not reused for this independent engine test.
for(const angles of [{x:.7},{y:-1.2,z:.9},{x:1.1,y:-.8,z:2.2}]){
 const base={axis:[.02,1,-.03],tableNormal:[.01,1,.04],right:[1,-.02,0],radius:.15},before=Sweep.measure(base);
 const after=Sweep.measure({...base,axis:rotate(base.axis,angles),tableNormal:rotate(base.tableNormal,angles),right:rotate(base.right,angles)});
 check('common proper rigid rotation preserves every reading '+JSON.stringify(angles),()=>{vectorNear(readings(after),readings(before),1e-8);near(after.tirMicrons,before.tirMicrons,1e-8);for(const deg of [11,73,197,317])near(after.at(deg).readingMicrons,before.at(deg).readingMicrons,1e-8);});
 check('ring and contact geometry rotate with the same rigid motion '+JSON.stringify(angles),()=>{for(let i=0;i<4;i++){vectorNear(after.cardinal[i].ringPoint,rotate(before.cardinal[i].ringPoint,angles),1e-14);vectorNear(after.cardinal[i].contactPoint,rotate(before.cardinal[i].contactPoint,angles),1e-14);}});
}

const input={axis:[.001,1,-.002],tableNormal:[.004,1,.003],right:[1,-.001,0],radius:.15};
const snapshot=JSON.stringify(input),stable=Sweep.measure(input);
check('measurement and full rotation leave caller data unchanged',()=>{for(let a=-720;a<=720;a+=13)stable.at(a);assert.equal(JSON.stringify(input),snapshot);});
check('magnitude of vector inputs is irrelevant',()=>{const scaled=Sweep.measure({...input,axis:input.axis.map(v=>v*7e180),tableNormal:input.tableNormal.map(v=>v*3e-200),right:input.right.map(v=>v*2e32)});vectorNear(readings(scaled),readings(stable),1e-8);});
check('right-vector component along the spindle cannot alter the zero direction',()=>{const shifted=Sweep.measure({...input,right:input.right.map((v,i)=>v+input.axis[i]*.7)});vectorNear(readings(shifted),readings(stable),1e-8);});
check('negative and repeated-turn angles are periodic',()=>{for(const angle of [0,37,90,180,270])for(const turns of [-3,-1,1,4]){near(stable.at(angle+360*turns).readingMicrons,stable.at(angle).readingMicrons,1e-8);assert.equal(stable.at(angle+360*turns).degrees,angle);}});
check('zero has no signed-minus or floating residual',()=>{assert.ok(Object.is(stable.at(0).readingMicrons,0));assert.ok(Object.is(stable.at(360).readingMicrons,0));});
check('returned geometry cannot be mutated between numeric and model rendering',()=>{assert.ok(Object.isFrozen(stable));assert.ok(Object.isFrozen(stable.axis));assert.ok(Object.isFrozen(stable.cardinal));assert.ok(Object.isFrozen(stable.cardinal[0].contactPoint));});
for(const [name,overrides]of [['zero axis',{axis:[0,0,0]}],['sparse axis',{axis:Array(3)}],['nonfinite normal',{tableNormal:[0,Infinity,0]}],['zero normal',{tableNormal:[0,0,0]}],['parallel plane',{tableNormal:[1,0,0]}],['reversed plane',{tableNormal:[0,-1,0]}],['zero right',{right:[0,0,0]}],['parallel right',{right:[0,1,0]}],['negative radius',{radius:-.15}],['zero radius',{radius:0}],['nonfinite radius',{radius:NaN}]])check('invalid geometry refuses a fabricated reading: '+name,()=>assert.equal(measured(overrides).valid,false));
check('invalid angles refuse fabricated readings',()=>{assert.equal(stable.at(NaN).valid,false);assert.equal(stable.at(Infinity).valid,false);});

// Application integration checks are appended below after the independent
// pure engine suite. Their physical oracle will be the actually drawn table
// plane and spindle centreline, not the NC feed-direction squareness metrics.
const makeEnvironment=require('./leveling-dom-env.cjs');
const MachineAccuracy=require('../src/machine-accuracy.js');
const e=makeEnvironment({pureLeveling:true});
e.read('openMachine(machines[0]);');e.registry.exaggerate.checked=false;
const zero={X:0,Y:0,Z:0,A:0,C:0};
function surface(expression,state=zero,env=e){env.read(`positions=${JSON.stringify(state)};supportHeights=supports.map((s,i)=>{const q=levelCoordinates(s.x,s.z);return ${expression};});updateLeveling();`);}
function geometryReading(env=e){
 return env.json(`(()=>{const g=levelGeometry,body=intrinsicBodyFrame(axisConfig(current).filter(a=>['X','Y','Z'].includes(a.key)),machineProfile),right=g.toolFrame.rotate(body.rotate([1,0,0]));return window.SpindleSweep.measure({axis:g.bodyCombinedDirection,tableNormal:g.workFrame.up,right,radius:.15}).cardinal.map(p=>p.readingMicrons);})()`);
}
function actualModelVectors(env=e){
 return env.json(`(()=>{
  const m=current,face=createGeometry(m).faces.find(f=>f.pose==='work'&&f.axes.includes('X')&&f.axes.includes('Y')&&f.v.length===4&&f.v.every(p=>Math.abs(p[1]-1.16)<1e-12)),
   world=p=>levelMappedBodyVisualPoint(displayTransformedPoint(p,face.axes,m,positions,face.pose),face.pose),v=face.v.map(world),
   cylinder=[2.16,2.58].map(y=>levelMappedBodyVisualPoint(displayTransformedPoint([0,y,-.3],['Z'],m,positions,'tool'),'tool'));
  return {table:v,spindle:cylinder};
 })()`);
}
function drawnIndependentReadings(env=e){
 const model=actualModelVectors(env),p=model.table;
 let n=unit(cross(sub(p[1],p[0]),sub(p[2],p[0])));if(n[1]<0)n=n.map(v=>-v);
 const axis=unit(sub(model.spindle[1],model.spindle[0]));
 // The exact physical right mark is a point of the same rigid spindle body.
 const rightPoints=env.json(`[[0,2.37,-.3],[1,2.37,-.3]].map(p=>levelMappedBodyVisualPoint(displayTransformedPoint(p,['Z'],current,positions,'tool'),'tool'))`),right=unit(sub(rightPoints[1],rightPoints[0]));
 const back=unit(cross(right,axis));
 // A rotation to the spindle's own orthogonal coordinates turns the drawn
 // table into a simple plane y = px + qz, independently sampled from vertices.
 const inSpindle=p.map(v=>[dot(v,right),dot(v,axis),dot(v,back)]),a=sub(inSpindle[1],inSpindle[0]),b=sub(inSpindle[2],inSpindle[0]),det=a[0]*b[2]-b[0]*a[2],px=(a[1]*b[2]-b[1]*a[2])/det,qz=(a[0]*b[1]-b[0]*a[1])/det;
 return {readings:[0,.15*(qz-px),-.3*px,-.15*(qz+px)].map(v=>v*1e6),axis,normal:n};
}
for(const X of [-100,0,100])for(const Y of [-100,0,100])for(const corner of [0,2]){
 surface(`i===${corner}?.15:0`,{...zero,X,Y});
 const drawn=drawnIndependentReadings();
 check(`drawn table and spindle derive the numeric reading independently ${X}/${Y}/${corner}`,()=>vectorNear(geometryReading(),drawn.readings,2e-7));
 check(`spindle direction is the drawn cylinder axis ${X}/${Y}/${corner}`,()=>vectorNear(e.json('levelGeometry.bodyCombinedDirection'),drawn.axis,1e-13));
 check(`table normal is the drawn top face ${X}/${Y}/${corner}`,()=>vectorNear(e.json('levelGeometry.workFrame.up'),drawn.normal,1e-13));
}
surface('i===2?.1:0');
const adjusted=geometryReading();
surface('i===2?.1+.27:.27');
check('raising every support by the same height leaves all four readings unchanged',()=>vectorNear(geometryReading(),adjusted,1e-8));
surface('i===2?.1:0');
check('returning support heights restores each indicator reading',()=>vectorNear(geometryReading(),adjusted,1e-10));
surface('0');check('level supports without intrinsic defect give zero indicator values',()=>vectorNear(geometryReading(),[0,0,0,0],1e-8));
surface('.04+.17*q.x-.21*q.z');check('an overall rigid support-plane tilt gives no spindle-to-table defect',()=>vectorNear(geometryReading(),[0,0,0,0],1e-8));
const centre=(()=>{surface('i===2?.2:0');return geometryReading();})();
surface('i===2?.2:0',{...zero,Y:100});
check('Y travel changes readings when the saddle posture changes with bed curvature',()=>assert.ok(geometryReading().some((v,i)=>Math.abs(v-centre[i])>.01)));
surface('i===2?.2:0',{...zero,Z:100});
check('Z translation changes reach rather than spindle-table angle',()=>vectorNear(geometryReading(),centre,1e-8));

const live=makeEnvironment();live.read('openMachine(machines[0]);');live.registry.exaggerate.checked=false;
const profile=MachineAccuracy.generate('used',78129,['X','Y','Z'],4);live.read(`initializeMachineAccuracy(${JSON.stringify(profile)});`);
surface('0',zero,live);const intrinsic=geometryReading(live);
check('intrinsic spindle tilt is counted once in the actual model and readings',()=>vectorNear(intrinsic,drawnIndependentReadings(live).readings,2e-7));
surface('.04+.17*q.x-.21*q.z',zero,live);
check('common-plane rotation leaves existing intrinsic sweep unchanged',()=>vectorNear(geometryReading(live),intrinsic,1e-8));
surface('i===2?.2:0',{...zero,X:37,Y:-42},live);const deformed=geometryReading(live),record=live.json('levelRecord()');
surface('i===2?.2+.04+.17*q.x-.21*q.z:.04+.17*q.x-.21*q.z',{...zero,X:37,Y:-42},live);
check('common rotation leaves deformed spindle/table relative sweep unchanged',()=>vectorNear(geometryReading(live),deformed,1e-8));
surface('i===2?.2:0',{...zero,X:37,Y:-42},live);
for(const gain of [false,true]){
 live.registry.exaggerate.checked=gain;live.read('updateLeveling();');
 check('visual magnification never changes physical dial values '+gain,()=>vectorNear(geometryReading(live),deformed,1e-8));
}
live.registry.exaggerate.checked=false;live.read('updateLeveling();');
live.read('setTrainingMenuOpen(true);sceneZoom=1.7;yaw=.9;setTrainingMenuOpen(false);updateLeveling();');
check('view changes do not alter measurement or saved machine data',()=>{vectorNear(geometryReading(live),deformed,1e-8);assert.deepEqual(live.json('levelRecord()'),record);});
surface('0',zero,live);live.read(`applyLevelRecord(${JSON.stringify(record)});updateLeveling();`);
check('save and restore reproduce all four spindle dial readings',()=>{assert.deepEqual(live.json('levelRecord()'),record);vectorNear(geometryReading(live),deformed,1e-8);});

// Exercise the production geometry adapter and actual UI event handlers.
// The oracle obtains the physical rectangle from the existing model, so it
// can detect a wrong top height, translated contact, NC axis mixup, or a
// surface normal derived incorrectly from a moving point's feed trajectory.
function rectangleCoordinates(point,vertices){
 const u=sub(vertices[1],vertices[0]),v=sub(vertices[3],vertices[0]),d=sub(point,vertices[0]);
 const uu=dot(u,u),uv=dot(u,v),vv=dot(v,v),du=dot(d,u),dv=dot(d,v),det=uu*vv-uv*uv;
 return [(du*vv-dv*uv)/det,(dv*uu-du*uv)/det];
}
for(const X of [-100,0,100])for(const Y of [-100,0,100])for(const Z of [-100,100]){
 surface('i===2?.2:0',{...zero,X,Y,Z},live);
 const actual=live.json('spindleSweepGeometry()'),model=actualModelVectors(live),expected=drawnIndependentReadings(live),normal=expected.normal;
 check(`application adapter uses physically drawn spindle and surface ${X}/${Y}/${Z}`,()=>{assert.equal(actual.valid,true);vectorNear(actual.cardinal.map(p=>p.readingMicrons),expected.readings,2e-7);near(actual.measurement.radius,.15,0);});
 check(`spindle nose belongs to the actually drawn axis ${X}/${Y}/${Z}`,()=>{near(Math.hypot(...cross(sub(actual.nose,model.spindle[0]),expected.axis)),0,1e-12);vectorNear(actual.tableCentre,model.table.reduce((sum,p)=>sum.map((v,i)=>v+p[i]/4),[0,0,0]),1e-12);});
 check(`all contact positions and finite-face checks match drawn rectangle ${X}/${Y}/${Z}`,()=>{for(const p of actual.cardinal){near(dot(sub(p.contact,model.table[0]),normal),0,1e-12);const uv=rectangleCoordinates(p.contact,model.table),inside=uv.every(v=>v>=-1e-9&&v<=1+1e-9);assert.equal(p.onTable,inside);}});
}

surface('i===2?.2:0',zero,live);const modeRecord=live.json('levelRecord()');
check('compact machine shows squareness and four-position readings simultaneously',()=>{assert.equal(live.read('spindleSweepMode'),true);assert.equal(live.registry.spindleSweepPanel.hidden,false);assert.equal(live.registry.liveSquareness.hidden,false);assert.equal(live.registry.liveSquarenessUnits.hidden,false);assert.equal(live.registry.squarenessValuesNote.hidden,false);assert.equal(live.registry.axisTabs.hidden,false);assert.equal(live.registry.toggleSpindleSweep,undefined);});
check('UI four positions retain degree and direction labels',()=>{for(let i=0;i<4;i++)assert.match(live.registry['sweepPosition'+i].getAttribute('aria-label'),new RegExp(i*90+'度・'+['右','奥','左','手前'][i]));});
const uiValues=()=>Array.from({length:4},(_,i)=>Number(live.registry['sweepValue'+i].getAttribute('data-reading-microns')));
const displayed=geometryReading(live);
check('all four displayed raw values equal independent actual-model geometry',()=>vectorNear(uiValues(),drawnIndependentReadings(live).readings,2e-7));
check('mode selection does not rewrite installation or profile data',()=>assert.deepEqual(live.json('levelRecord()'),modeRecord));
for(let i=0;i<4;i++){
 live.registry['sweepPosition'+i].click();
 check('selecting '+i*90+' degrees updates its pressed state without changing readings',()=>{near(live.read('spindleSweepAngle'),i*90,0);for(let j=0;j<4;j++)assert.equal(live.registry['sweepPosition'+j].getAttribute('aria-pressed'),String(i===j));vectorNear(uiValues(),displayed,1e-8);assert.deepEqual(live.json('levelRecord()'),modeRecord);});
}
check('round operation, dial pictures and duplicate current readout are removed',()=>{for(const id of ['runSpindleSweep','sweepDial','sweepCurrentAngle','sweepCurrentValue'])assert.equal(live.registry[id],undefined);for(const name of ['runSpindleSweep','stopSpindleSweep','spindleSweepTimer','spindleSweepProgress','sweepDialMarkup','drawSpindleSweep'])assert.equal(live.read('typeof '+name),'undefined');assert.equal(live.registry.spindleSweepPanel.querySelectorAll('svg').length,0);});
check('selecting the four fixed points never starts an animation timer',()=>{const timers=live.timers.length;for(let i=0;i<4;i++)live.registry['sweepPosition'+i].click();assert.equal(live.timers.length,timers);vectorNear(uiValues(),displayed,1e-8);assert.deepEqual(live.json('levelRecord()'),modeRecord);});
live.read('selected=2;');live.registry.raiseSupport.click();
check('a support button immediately changes the dial readings through the common physical geometry',()=>{assert.ok(uiValues().some((v,i)=>Math.abs(v-displayed[i])>.001));vectorNear(uiValues(),drawnIndependentReadings(live).readings,2e-7);});
live.registry.lowerSupport.click();
check('reverse support operation restores all visible dial readings',()=>vectorNear(uiValues(),displayed,1e-8));
const plainReadings=uiValues();live.registry.exaggerate.checked=true;live.registry.exaggerate.onchange();
check('exaggeration checkbox cannot magnify UI dial values',()=>vectorNear(uiValues(),plainReadings,1e-8));
live.registry.exaggerate.checked=false;live.registry.exaggerate.onchange();
live.read('setTrainingMenuOpen(true);yaw=-1.1;sceneZoom=.7;setTrainingMenuOpen(false);drawScene();');
check('sidebar and camera leave live numeric readings unchanged',()=>vectorNear(uiValues(),plainReadings,1e-8));
const beforeClose=live.json('levelRecord()');live.read("selectAxis('Y');selectAxis('Z');selectAxis('X');");
check('axis selection keeps both readouts visible and all saved readings intact',()=>{assert.equal(live.registry.liveSquareness.hidden,false);assert.equal(live.registry.spindleSweepPanel.hidden,false);assert.equal(live.registry.axisTabs.hidden,false);assert.deepEqual(live.json('levelRecord()'),beforeClose);vectorNear(uiValues(),plainReadings,1e-8);});
surface('0',{...zero,Y:100},live);live.registry.sweepPosition3.click();
check('an off-table contact is marked and does not show an invented measurement',()=>{assert.equal(live.json('spindleSweepGeometry().cardinal[3].onTable'),false);assert.equal(live.registry.sweepValue3.textContent,'面外');assert.equal(live.registry.sweepValue3.getAttribute('data-reading-microns'),'');assert.match(live.registry.sweepContactStatus.textContent,/面外/);assert.equal(live.registry.sweepPosition3.getAttribute('aria-pressed'),'true');});
const oldWidth=live.read('levelConfig.width');live.read('levelConfig.width=.5;');surface('0',{...zero,X:-100},live);
check('loss of the zero reference prevents reading any other cardinal as calibrated',()=>{assert.equal(live.json('spindleSweepGeometry().cardinal[0].onTable'),false);for(let i=0;i<4;i++)assert.equal(live.registry['sweepValue'+i].getAttribute('data-reading-microns'),'');assert.match(live.registry.sweepContactStatus.textContent,/0°.*面外/);});
live.read(`levelConfig.width=${oldWidth};`);surface('0',zero,live);
for(let i=1;i<7;i++){
 live.read(`openMachine(machines[${i}]);`);
 check('unsupported machine '+i+' does not expose a misleading top-face measurement',()=>{assert.equal(live.registry.toggleSpindleSweep,undefined);assert.equal(live.registry.spindleSweepPanel.hidden,true);assert.equal(live.registry.runSpindleSweep,undefined);assert.equal(live.registry.liveSquareness.hidden,false);assert.equal(live.registry.axisTabs.hidden,false);assert.equal(live.read('spindleSweepMode'),false);assert.equal(live.read('spindleSweepGeometry().valid'),false);});
}

console.log(JSON.stringify({checks,failures},null,2));if(failures.length)process.exitCode=1;

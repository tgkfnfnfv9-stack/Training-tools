'use strict';
// Lathe (kind=lathe) audit. Product values come from src/ via tests/leveling-dom-env.cjs.
// The oracle below is written independently: it uses only input data (support
// coordinates, support heights, layout dimensions, seed -> intrinsic values) and
// explicit rigid-body transforms. It never calls geometryModel / referenceScan /
// latheInspectionGeometry / latheAssembly / Leveling.* / LatheInspection.* for expectations.
// Units: metres internally, heights mm, slopes mm/m, readings µm. +reading = plunger compressed.
const fs=require('node:fs'),path=require('node:path');
process.chdir('/home/user/Training-tools');
const env=require('/home/user/Training-tools/tests/leveling-dom-env.cjs')({pureLeveling:true});
env.read(fs.readFileSync('src/lathe-inspection.js','utf8'));
env.read(fs.readFileSync('src/lathe-inspection-ui.js','utf8'));
env.read('updateLatheInspectionUI=()=>{};');
env.read("openMachine(machines.find(m=>m.kind==='lathe'));$('exaggerate').checked=false;");
const MA=require('/home/user/Training-tools/src/machine-accuracy.js');

// ---------- independent vector helpers ----------
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>Math.hypot(...a),unit=a=>mul(a,1/norm(a));
const apply=(F,v)=>add(add(mul(F[0],v[0]),mul(F[1],v[1])),mul(F[2],v[2])),inv=(F,v)=>F.map(q=>dot(q,v));
// Tangent frame of a surface with gradient (a,b) (dimensionless). Columns: right(x), up(y), back(z).
function tangentFrame(a,b){const up=unit([-a,1,-b]),right=unit(sub([1,0,0],mul(up,up[0]))),back=cross(right,up);return [right,up,back];}
const yaw=(v,t)=>[Math.cos(t)*v[0]+Math.sin(t)*v[2],v[1],-Math.sin(t)*v[0]+Math.cos(t)*v[2]];

// ---------- independent support surface: bilinear on the 3x2 support grid ----------
// cellSide: 'right' = right/back cell at an interior knot (product convention), 'left' = other side.
function surface(pts,cellSide='right'){
 const xs=[...new Set(pts.map(p=>p.x))].sort((a,b)=>a-b),zs=[...new Set(pts.map(p=>p.z))].sort((a,b)=>a-b);
 const H=(x,z)=>pts.find(p=>Math.abs(p.x-x)<1e-12&&Math.abs(p.z-z)<1e-12).h;
 const idx=(k,v)=>{let i=0;while(i<k.length-2&&(cellSide==='right'?v>=k[i+1]-1e-12:v>k[i+1]+1e-12))i++;return i;};
 return (x,z)=>{const i=idx(xs,x),j=idx(zs,z),x0=xs[i],x1=xs[i+1],z0=zs[j],z1=zs[j+1],u=(x-x0)/(x1-x0),v=(z-z0)/(z1-z0);
  const h00=H(x0,z0),h10=H(x1,z0),h01=H(x0,z1),h11=H(x1,z1);
  return {h:h00*(1-u)*(1-v)+h10*u*(1-v)+h01*(1-u)*v+h11*u*v,lr:((h10-h00)*(1-v)+(h11-h01)*v)/(x1-x0),fb:((h01-h00)*(1-u)+(h11-h10)*u)/(z1-z0)};};
}
// Rigid member seated at (sx,sz) at nominal support datum y=.66. Material raw points are
// physical (dimensions scaled by width/4, depth/1.68 like the product layout).
function member(S,sx,sz,yawAngle=0){
 const s=S(sx,sz),F=tangentFrame(s.lr/1000,s.fb/1000),seat=[sx,.66+s.h/1000,sz];
 const R=v=>apply(F,yaw(v,yawAngle));
 return {point:p=>add(seat,R(sub(p,[sx,.66,sz]))),dir:v=>R(v),toLocal:P=>yaw(inv(F,sub(P,seat)),-yawAngle).map((v,i)=>v+[sx,.66,sz][i]),dirLocal:V=>yaw(inv(F,V),-yawAngle),slope:s};
}
// Intrinsic values (seed-derived input data); LCG re-implemented from its declared formula.
function latheIntrinsic(profile){if(!profile)return {face:0,flat:0,holeX:0,holeY:0};let s=(profile.seed^0x4c415431)>>>0;const next=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296*2-1;},k=profile.condition==='used'?30:10;return {face:next()*k/1e6,flat:next()*k/1e6,holeX:next()*k/1e6,holeY:next()*k/1e6};}
// Plunger contacts (independent forms).
function planeExt(body,probe,P,n){const d=dot(probe,n);return Math.abs(d)<1e-12?NaN:dot(sub(P,body),n)/d;}
function cylExt(body,probe,O,axis,r,len){ // bisection on distance to axis, nearest entry
 const dist=e=>norm(cross(sub(add(body,mul(probe,e)),O),axis))-r;let lo=0,hi=.02;
 if(dist(lo)<=0)return {valid:false,reason:'body inside bar'};if(dist(hi)>0)return {valid:false,reason:'no contact within 0-20 mm'};
 for(let i=0;i<80;i++){const m=(lo+hi)/2;if(dist(m)>0)lo=m;else hi=m;}
 const e=(lo+hi)/2,P=add(body,mul(probe,e)),axial=dot(sub(P,O),axis);if(axial<0||axial>len)return {valid:false,reason:'contact beyond bar length',e,P,axial};
 return {valid:true,e,P,axial};
}

function oracle(heights,state,profile,cfg,cellSide='right'){
 const W=5,D=2.1,sxk=cfg.width/(W*.8),szk=cfg.depth/(D*.8),phys=p=>[p[0]*sxk,p[1],p[2]*szk];
 const pts=cfg.supports.map((s,i)=>({x:s.x*sxk,z:s.z*szk,h:heights[i]})),S=surface(pts,cellSide);
 const theta=profile?profile.squareness.XZ.microns/.3/1e6:0,k=latheIntrinsic(profile);
 const head=member(S,...[phys([-W*.35,0,0])].map(p=>[p[0],p[2]])[0],theta);
 const carriageAt=st=>{const seat=phys([.08+.7*st.Z/100,0,.15]);const m=member(S,seat[0],seat[2]);
  // turret material: nominal raw point -> physical, carriage seat at Z, X slide along local z
  return {...m,mat:raw=>{const q=phys(raw);return m.point([q[0]+.7*st.Z/100*sxk,q[1],q[2]+.35*st.X/100*szk]);}};};
 const nose=head.point(phys([-W*.24+.125,1.5,0])),axis=head.dir([1,0,0]),radial=head.dir([0,0,1]),up=head.dir([0,1,0]);
 const barLen=(W*.225-(-W*.24+.125))*sxk;
 // scan ranges (300 mm, slider-limited) — same request as product text
 const hx=.35*szk,hz=.7*sxk,L=.3;
 const xStart={...state,X:Math.max(-100,Math.min(state.X,100-L/hx*100))},xEnd={...xStart,X:xStart.X+L/hx*100};
 const zStart={...state,Z:Math.max(-100,Math.min(state.Z,100-L/hz*100))},zEnd={...zStart,Z:zStart.Z+L/hz*100};
 return {S,head,carriageAt,nose,axis,radial,up,barLen,k,theta,xStart,xEnd,zStart,zEnd,phys};
}
// --- measurements built on a geometry snapshot G (one support state) ---
// Face: turret front face [-.09,1.5,1] (normal -x local rotated by k.face). Dial fixed to headstock.
function faceSetup(G){const c0=G.carriageAt(G.xStart),n0=c0.dir([-Math.cos(G.k.face),0,-Math.sin(G.k.face)]),P0=c0.mat([-.09,1.5,1]);const body=add(P0,mul(n0,.01)),probe=mul(n0,-1);return {bodyLocal:G.head.toLocal(body),probeLocal:G.head.dirLocal(probe),body,probe};}
function faceRead(G,setup,st){const c=G.carriageAt(st),n=c.dir([-Math.cos(G.k.face),0,-Math.sin(G.k.face)]),P=c.mat([-.09,1.5,1]),body=G.head.point(setup.bodyLocal),probe=G.head.dir(setup.probeLocal);const e=planeExt(body,probe,P,n);return {e,contact:add(body,mul(probe,e))};}
function flatSetup(G){const c0=G.carriageAt(G.zStart),n0=c0.dir([Math.sin(G.k.flat),0,Math.cos(G.k.flat)]),P0=c0.mat([.23,1.5,1.43]);const body=add(P0,mul(n0,.01)),probe=mul(n0,-1);return {bodyLocal:G.head.toLocal(body),probeLocal:G.head.dirLocal(probe),body,probe};}
function flatRead(G,setup,st){const c=G.carriageAt(st),n=c.dir([Math.sin(G.k.flat),0,Math.cos(G.k.flat)]),P=c.mat([.23,1.5,1.43]),body=G.head.point(setup.bodyLocal),probe=G.head.dir(setup.probeLocal);const e=planeExt(body,probe,P,n);return {e,contact:add(body,mul(probe,e))};}
// Bar: dial on carriage (product-assumed bracket at turret material [.08,1.5,.20]); body 35 mm from axis.
function barSetup(G,which){const c0=G.carriageAt(G.zStart),m0=c0.mat([.08,1.5,.20]),n=which==='side'?G.radial:G.up,cA=add(G.nose,mul(G.axis,dot(sub(m0,G.nose),G.axis)));const body=add(cA,mul(n,.035)),probe=mul(n,-1);
 // store in carriage-local material coordinates (inverse of mat at zStart)
 return {which,localBody:c0.toLocal(body),localProbe:c0.dirLocal(probe),zStartLocalShift:c0,body,probe};}
function barRead(G,setup,st,G0){ // G0: geometry in which the bracket was defined (for A); local coords are carriage-local
 const c=G.carriageAt(st),c0=G0.carriageAt(G0.zStart);
 // carriage-local coordinates are relative to the seat at the setup Z; moving along Z keeps the same local offset relative to the seat
 const dz=(st.Z-G0.zStart.Z)*.7/100*(G.phys([1,0,0])[0]);
 const body=c.point(add(setup.localBody,[dz,0,0])),probe=c.dir(setup.localProbe);
 return {...cylExt(body,probe,G.nose,G.axis,.025,G.barLen),body,probe};
}
// Bore: holder on turret at nominal X centre; dial rotates about spindle axis at the hole station.
function boreCentre(G){const st={...G.zStart,Z:G.zStart.Z===undefined?0:G.zStart.Z};return null;}
function bore(G,state){const c=G.carriageAt({...state,X:-.20/.35*100}),mountP=c.mat([-.09,1.5,.20]),centre=add(mountP,c.dir([0,G.k.holeY,G.k.holeX])),d=sub(centre,G.nose),dx=dot(d,G.radial),dy=dot(d,G.up);
 // rays in the head's radial plane; view from spindle to turret: a=left=+radial(z), b=up, c=right=-radial, d=down
 const rays=[[1,0],[0,1],[-1,0],[0,-1]],R=.025;const e=rays.map(([r,u])=>{const t=r*dx+u*dy,q=R*R-dx*dx-dy*dy+t*t;return q<0?NaN:t+Math.sqrt(q);});
 return {dx,dy,e};}
// XZ flange (referenceScan): flange face normal = spindle axis; dial on turret moves -X 300 mm.
function flangeB(G,state){const c=G.carriageAt(state),Xdir=c.dir([0,0,1]),n=G.axis;const body0=mul(n,.01),probe=mul(n,-1),body1=add(body0,mul(Xdir,-.3));
 const e0=planeExt(body0,probe,[0,0,0],n),e1=planeExt(body1,probe,[0,0,0],n);return (e0-e1)*1e6;}

// ---------- product readers ----------
function product(heights,state,profile,cfg){
 env.read(`levelConfig.width=${cfg.width};levelConfig.depth=${cfg.depth};machineProfile=${JSON.stringify(profile)};supportHeights=${JSON.stringify(heights)};positions=${JSON.stringify(state)};updateLeveling();`);
 const g=env.json(`(()=>{const d=latheInspectionGeometry();const pick=s=>s.valid?{valid:true,microns:s.microns,first:{ext:s.samples[0].extension,body:s.samples[0].body,point:s.samples[0].point,axial:s.samples[0].axial},last:{ext:s.samples.at(-1).extension,body:s.samples.at(-1).body,point:s.samples.at(-1).point,axial:s.samples.at(-1).axial}}:{valid:false,reason:s.reason,microns:s.microns};return {face:d.face,flat:d.flat,dx:d.dx,dy:d.dy,bore:d.bore,barSide:pick(d.side),barTop:pick(d.top),validX:d.validX,validZ:d.validZ,xStart:d.xStart,zStart:d.zStart,barLength:d.barLength}})()`);
 const xz=env.json(`(()=>{const r=referenceScan({key:'XZ'});return {valid:r.valid,microns:r.microns,zeroExt:r.zero&&r.zero.extension,lastExt:r.last&&r.last.extension,zeroPoint:r.zero&&r.zero.point,lastPoint:r.last&&r.last.point,startPosition:r.startPosition,endPosition:r.endPosition,setup:{base:r.setup.base,scan:r.setup.scan,owner:r.setup.owner,memberSign:r.setup.memberSign,relativeSign:r.setup.relativeSign,mount:r.setup.mount,body:r.setup.body,artifact:r.setup.artifact,scanDirection:r.setup.scanDirection,zeroLocation:r.setup.zeroLocation,normalDirection:r.setup.normalDirection},fixture:r.fixture}})()`);
 const metric=env.json(`(()=>{const g=geometryModel();return g.pairs.map(p=>({key:p.key,errorMicrons:p.errorMicrons,deviationMicroradians:p.deviationMicroradians,length:g.length}))})()`);
 const runout=require('/home/user/Training-tools/src/intrinsic-inspection.js').fromProfile(profile)?.runout;
 const markup=env.read(`latheInspectionMarkup(latheInspectionGeometry(),${JSON.stringify(runout||{rootMicrons:0,tipMicrons:0})})+latheInspectionMarkup(latheInspectionGeometry(),${JSON.stringify(runout||{rootMicrons:0,tipMicrons:0})},true)`);
 const txt=markup.replace(/<title>[\s\S]*?<\/title>/g,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
 return {g,xz,metric,runout:runout?{root:runout.rootMicrons,tip:runout.tipMicrons}:null,displayText:txt};
}
const r6=v=>Number.isFinite(v)?Math.round(v*1e6)/1e6:v,ri=v=>Number.isFinite(v)?(Math.round(Math.abs(v))===0?'0':(v<0?'-':'+')+Math.round(Math.abs(v))):'—';
const mm=v=>v.map(q=>Math.round(q*1e9)/1e6); // m -> mm, 1 nm resolution

// ---------- scenarios ----------
const cfg={width:4,depth:1.68,supports:env.json('supports')};
const profile=MA.generate('used',123456,['X','Z'],6);
const base=[0,0,0,0,0,0];
const ops=[{name:'support3(左・奥)+0.100mm',i:3,d:.1},{name:'support4(中央・奥)+0.100mm',i:4,d:.1},{name:'support2(右・手前)-0.100mm',i:2,d:-.1}];
const states=[{X:0,Y:0,Z:0,A:0,C:0},{X:60,Y:0,Z:-70,A:0,C:0}];
const report={commit:require('node:child_process').execSync('git rev-parse HEAD').toString().trim(),profile,supports:cfg.supports,cases:[]};
let maxB=0;
for(const state of states)for(const op of ops){
 const after=[...base];after[op.i]+=op.d;
 const P0=product(base,state,profile,cfg),P1=product(after,state,profile,cfg);
 const G0=oracle(base,state,profile,cfg),G1=oracle(after,state,profile,cfg);
 const row={state,op:op.name,product:{before:P0,after:P1},oracle:{}};
 // --- face (X scan) ---
 const fS0=faceSetup(G0),fS1=faceSetup(G1);
 const fB0=(faceRead(G0,fS0,G0.xStart).e-faceRead(G0,fS0,G0.xEnd).e)*1e6,fB1=(faceRead(G1,fS1,G1.xStart).e-faceRead(G1,fS1,G1.xEnd).e)*1e6;
 const fAa=faceRead(G1,fS0,G1.xStart),fAb=faceRead(G1,fS0,G1.xEnd),fZero=faceRead(G0,fS0,G0.xStart);
 row.oracle.face={B_before:fB0,B_after:fB1,A_at_a:(fZero.e-fAa.e)*1e6,A_at_b:(fZero.e-fAb.e)*1e6,C:(fAa.e-fAb.e)*1e6,ext_mm:{zero:fZero.e*1e3,A_a:fAa.e*1e3,A_b:fAb.e*1e3},contact_mm:{zero:mm(fZero.contact),A_a:mm(fAa.contact)}};
 // --- flat (Z scan) ---
 const lS0=flatSetup(G0),lS1=flatSetup(G1);
 const lB0=(flatRead(G0,lS0,G0.zStart).e-flatRead(G0,lS0,G0.zEnd).e)*1e6,lB1=(flatRead(G1,lS1,G1.zStart).e-flatRead(G1,lS1,G1.zEnd).e)*1e6;
 const lZero=flatRead(G0,lS0,G0.zStart),lAa=flatRead(G1,lS0,G1.zStart),lAb=flatRead(G1,lS0,G1.zEnd);
 row.oracle.flat={B_before:lB0,B_after:lB1,A_at_a:(lZero.e-lAa.e)*1e6,A_at_b:(lZero.e-lAb.e)*1e6,C:(lAa.e-lAb.e)*1e6,ext_mm:{zero:lZero.e*1e3,A_a:lAa.e*1e3,A_b:lAb.e*1e3}};
 // --- bar side/top ---
 for(const which of ['side','top']){
  const s0=barSetup(G0,which),s1=barSetup(G1,which);
  const z0a=barRead(G0,s0,G0.zStart,G0),z0b=barRead(G0,s0,G0.zEnd,G0),z1a=barRead(G1,s1,G1.zStart,G1),z1b=barRead(G1,s1,G1.zEnd,G1);
  const Aa=barRead(G1,s0,G1.zStart,G0),Ab=barRead(G1,s0,G1.zEnd,G0);
  row.oracle['bar_'+which]={B_before:(z0a.e-z0b.e)*1e6,B_after:(z1a.e-z1b.e)*1e6,A_at_a:(z0a.e-Aa.e)*1e6,A_at_b:(z0a.e-Ab.e)*1e6,C:(Aa.e-Ab.e)*1e6,
   ext_mm:{zero_before:z0a.e*1e3,end_before:z0b.e*1e3,A_a_after:Aa.e*1e3,A_b_after:Ab.e*1e3,B_zero_after:z1a.e*1e3,B_end_after:z1b.e*1e3},
   contact_mm:{zero_before:mm(z0a.P),A_a_after:mm(Aa.P),B_zero_after:mm(z1a.P)},axial_m:{zero:z0a.axial,end:z0b.axial},valid:[z0a,z0b,z1a,z1b,Aa,Ab].every(q=>q.valid)};
 }
 // --- bore ---
 const b0=bore(G0,state),b1=bore(G1,state);
 row.oracle.bore={before:{dx:b0.dx*1e6,dy:b0.dy*1e6,C_readings:b0.e.map(e=>(b0.e[0]-e)*1e6)},after:{dx:b1.dx*1e6,dy:b1.dy*1e6,C_readings:b1.e.map(e=>(b1.e[0]-e)*1e6),A_readings_keep_zero:b1.e.map(e=>(b0.e[0]-e)*1e6)}};
 // --- XZ flange ---
 row.oracle.flange={B_before:flangeB(G0,state),B_after:flangeB(G1,state),A:'条件不足（フランジ面と計器の取付位置が referenceScan に無い: 原点[0,0,0]の代表点）'};
 // --- comparisons product vs oracle (condition B) ---
 const cmp={face:[P0.g.face,fB0,P1.g.face,fB1],flat:[P0.g.flat,lB0,P1.g.flat,lB1],barSide:[P0.g.barSide.microns,row.oracle.bar_side.B_before,P1.g.barSide.microns,row.oracle.bar_side.B_after],barTop:[P0.g.barTop.microns,row.oracle.bar_top.B_before,P1.g.barTop.microns,row.oracle.bar_top.B_after],dx:[P0.g.dx,b0.dx*1e6,P1.g.dx,b1.dx*1e6],dy:[P0.g.dy,b0.dy*1e6,P1.g.dy,b1.dy*1e6],flange:[P0.xz.microns,row.oracle.flange.B_before,P1.xz.microns,row.oracle.flange.B_after]};
 row.productVsOracleB=Object.fromEntries(Object.entries(cmp).map(([k,v])=>{const e=Math.max(Math.abs(v[0]-v[1]),Math.abs(v[2]-v[3]));maxB=Math.max(maxB,e);return [k,{product_before:r6(v[0]),oracle_before:r6(v[1]),product_after:r6(v[2]),oracle_after:r6(v[3]),maxAbsDiff_um:e,int_display_before:ri(v[0]),int_display_after:ri(v[2])}];}));
 // product bar contact/extension details
 row.productBarDetail={before:{side:P0.g.barSide,top:P0.g.barTop},after:{side:P1.g.barSide,top:P1.g.barTop}};
 report.cases.push(row);
}
report.maxAbsDiffProductVsOracleB_um=maxB;

// ---------- level vial: what positions are available, and where the change shows ----------
{
 const lv=[];
 for(const op of [{i:3,d:.1},{i:5,d:.1}]){const h=[...base];h[op.i]+=op.d;
  env.read(`levelConfig.width=4;levelConfig.depth=1.68;supportHeights=${JSON.stringify(h)};positions={X:0,Y:0,Z:0,A:0,C:0};`);
  const pts=cfg.supports.map((s,i)=>({x:s.x,z:s.z,h:h[i]})),R=surface(pts,'right'),Lf=surface(pts,'left');
  const prod=[];for(const v of ['-1','0','1'])prod.push(env.read(`$('measurePos').value='${v}';updateLeveling();$('measurePos').value+': lr '+$('localLevel').textContent+' fb '+$('localLevelFB').textContent+' twist '+$('twist').textContent`));
  const bed=[-2,-1.75,-1,0,.08,1,2].map(x=>({x,crossLevel_fb_mm_per_m_rightCell:R(x,0).fb,leftCell:Lf(x,0).fb,lr:R(x,0).lr}));
  lv.push({support:op.i,delta:op.d,productGauge:prod,independentCrossLevelAlongBed:bed,crossLevelDifferenceHeadToTail_mm_per_m:R(2,0).fb-R(-2,0).fb});
 }
 env.read(`$('measurePos').value='0';`);
 report.level=lv;
}

// ---------- out-of-range / short travel handling ----------
{
 const res=[];
 for(const [w,d] of [[.5,1.68],[4,.5],[1.0,1.68]]){
  env.read(`levelConfig.width=${w};levelConfig.depth=${d};supportHeights=supports.map(()=>0);machineProfile=${JSON.stringify(profile)};positions={X:100,Y:0,Z:100,A:0,C:0};updateLeveling();`);
  const g=env.json('(()=>{const d=latheInspectionGeometry();return {face:d.face,flat:d.flat,barSide:d.barSide,barTop:d.barTop,validX:d.validX,validZ:d.validZ,sideReason:d.side.reason,topReason:d.top.reason,barLength:d.barLength}})()');
  const t=env.read(`latheInspectionMarkup(latheInspectionGeometry(),{rootMicrons:0,tipMicrons:0})+latheInspectionMarkup(latheInspectionGeometry(),{rootMicrons:0,tipMicrons:0},true)`).replace(/<title>[\s\S]*?<\/title>/g,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
  const xz=env.json(`(()=>{const r=referenceScan({key:'XZ'});return {valid:r.valid,reason:r.reason,microns:r.microns}})()`);
  res.push({width:w,depth:d,g,xz,displayExcerpt:t.match(/X [^ ]+ Z [^ ]+|側面（奥） [^ ]+ 上面 [^ ]+|300 mm[^ ]*[^ ]*/g)});
 }
 report.outOfRange=res;
}
fs.writeFileSync(path.join(__dirname,'lathe-audit.json'),JSON.stringify(report,null,1));
// console summary
for(const c of report.cases){
 console.log(`\n== state ${JSON.stringify({X:c.state.X,Z:c.state.Z})} ${c.op}`);
 for(const [k,v] of Object.entries(c.productVsOracleB))console.log(k.padEnd(7),'B prod',v.product_before.toFixed?v.product_before.toFixed(4):v.product_before,'->',v.product_after.toFixed?v.product_after.toFixed(4):v.product_after,'| oracle',v.oracle_before.toFixed(4),'->',v.oracle_after.toFixed(4),'| disp',v.int_display_before,'->',v.int_display_after,'| diff',v.maxAbsDiff_um.toExponential(2));
 for(const k of ['face','flat','bar_side','bar_top'])console.log(k.padEnd(9),'A@a',c.oracle[k].A_at_a.toFixed(3),'A@b',c.oracle[k].A_at_b.toFixed(3),'C',c.oracle[k].C.toFixed(3),'B',c.oracle[k].B_after.toFixed(3));
 console.log('bore after C',c.oracle.bore.after.C_readings.map(v=>v.toFixed(2)).join(','),'A(keep zero)',c.oracle.bore.after.A_readings_keep_zero.map(v=>v.toFixed(2)).join(','),'product',JSON.stringify(c.product.after.g.bore.readings.map(v=>+v.toFixed(2))));
}
console.log('\nmax |product-oracle| (B) µm =',maxB);
console.log('level',JSON.stringify(report.level,null,0));
console.log('outOfRange',JSON.stringify(report.outOfRange,null,0));

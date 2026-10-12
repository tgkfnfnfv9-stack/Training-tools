'use strict';
// (1) Flat supports, fixed seed: local-angle 300 mm value, finite-scan value and spindle sweep
//     vs OWN expectation built from the profile microns (input) and the stated fixture
//     (base face normal, scan axis, zero end, + = compression).
// (2) Rigid plane added to all supports: physics says every relative reading is unchanged
//     and the combined lean shifts by exactly the plane rotation.
process.chdir('/home/user/Training-tools');
const env=require('/home/user/Training-tools/tests/leveling-dom-env.cjs');
const SEED=20261012,out=[];let fails=0;
const log=(name,exp,obs,ok)=>{out.push({name,expected:exp,observed:obs,ok});if(ok===false)fails++;console.log((ok===null?'INFO':ok?'OK  ':'NG  ')+name,'| exp',JSON.stringify(exp),'| obs',JSON.stringify(obs));};
// own intrinsic directions in internal xyz from the declared convention: each later axis is
// tilted so that cos(angle between nominal-orthogonal pair) = -sin(theta), theta = microns/0.3 m.
function ownDirections(axes,sq){
 const th=(i,j)=>{const k=axes[i].key+axes[j].key;return sq[k].microns/0.3e6;};
 const X=axes[0].vector,Y=axes[1].vector,dots=v=>v;
 const y=Y.map((q,k)=>q*Math.cos(th(0,1))-X[k]*Math.sin(th(0,1)));
 const res=[X,y];
 if(axes.length===3){const Z=axes[2].vector,a=-Math.sin(th(0,2)),b=(-Math.sin(th(1,2))-a*(-Math.sin(th(0,1))))/Math.cos(th(0,1)),c=Math.sqrt(1-a*a-b*b);res.push(Z.map((q,k)=>q*c+Y[k]*b+X[k]*a));}
 return Object.fromEntries(axes.map((a,i)=>[a.key,res[i]]));
}
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),unit=v=>{const n=Math.hypot(...v);return v.map(q=>q/n);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function ownSweep(u,r=.15){ // dial on spindle, ring radius r normal to u, table normal +y (flat)
 const n=[0,1,0],eR=unit([1,0,0].map((v,i)=>v-dot([1,0,0],u)*u[i])),eB=unit(cross(eR,u)); // internal x × y = +z = back (90° = 奥)
 const lam=phi=>{const p=[0,1,2].map(i=>r*(Math.cos(phi)*eR[i]+Math.sin(phi)*eB[i]));return -dot(n,p)/dot(n,u);};
 return [0,90,180,270].map(d=>(lam(d*Math.PI/180)-lam(270*Math.PI/180))*1e6);
}
const summary={};
for(let mi=0;mi<6;mi++){
 const e=env({});e.read(`openMachine(machines[${mi}]);machineProfile=window.MachineAccuracy.generate('new',${SEED},machineLinearKeys(),supports.length);machineReference=null;machineSavedBest=null;`);
 const id=e.read('current.id'),kind=e.read('current.kind');
 const pts=e.json('supports.map(s=>levelCoordinates(s.x,s.z))');
 const set=h=>e.read(`supportHeights=${JSON.stringify(h)};accuracyKey='';updateLeveling(false);`);
 const snap=()=>e.json(`(()=>{const g=levelGeometry;return {pairs:g.pairs.map(p=>({key:p.key,dev:p.deviationMicroradians,conv300:p.deviationMicroradians*.3,errLen:p.errorMicrons})),
   scans:g.pairs.map(p=>{const m=referenceDisplayScan(p),ph=referenceScan(p);return {key:p.key,valid:m.valid,microns:m.microns,physical:ph.microns,relSign:m.setup&&m.setup.relativeSign,base:m.setup&&m.setup.base,scan:m.setup&&m.setup.scan,zero:m.setup&&m.setup.zeroLocation};}),
   sweep:(()=>{if(!supportsSpindleSweep())return null;const s=spindleSweepGeometry(positions,levelSolution,machineProfile,1,current.kind==='compact');return s.valid?s.cardinal.map(p=>p.readingMicrons):s.reason;})(),
   lean:g.bodyPosture,live:[...document.getElementById('liveSquareness').querySelectorAll('.live-pair-error-value')].map(x=>x.textContent)};})()`);
 const axes=e.json("axisConfig(current).filter(a=>['X','Y','Z'].includes(a.key))"),sq=e.json('machineProfile.squareness');
 const D=ownDirections(axes,sq);
 set(pts.map(()=>0));const flat=snap();summary[id]={flat};
 for(const p of flat.pairs){
  // own local angle: angle(i',j')-90deg = asin(-dot) sign flipped -> +theta ; 300 mm conversion
  const [a,b]=[p.key[0],p.key[1]],theta=-Math.asin(dot(D[a],D[b]));
  log(`${id} flat ${p.key}: local-angle x300mm µm`,theta*.3e6,p.conv300,Math.abs(theta*.3e6-p.conv300)<1e-6);
 }
 for(const s of flat.scans){
  // own: + = compression = -(n . instrument displacement rel. master); displacement = relSign*0.3*S'
  const n=D[s.base],S=D[s.scan],exp=-dot(n,S.map(v=>v*s.relSign*.3))*1e6;
  log(`${id} flat ${s.key}: finite scan (base ${s.base}, scan ${s.scan}, zero ${s.zero}) µm`,exp,s.microns,s.valid&&Math.abs(exp-s.microns)<1e-3);
 }
 if(flat.sweep&&Array.isArray(flat.sweep)){
  const bodyKey=axes.find(a=>Math.abs(a.vector[1])===1).key,exp=ownSweep(D[bodyKey]);
  log(`${id} flat sweep R/B/L/F µm (spindle=intrinsic ${bodyKey})`,exp,flat.sweep,exp.every((v,i)=>Math.abs(v-flat.sweep[i])<1e-3));
 }
 // rigid plane: a=+0.3 mm/m (right high), b=-0.2 mm/m (front high), offset +0.1 mm
 const A=.3,B=-.2;set(pts.map(p=>A*p.x+B*p.z+.1));const tilt=snap();summary[id].tilt=tilt;
 const maxd=(f)=>Math.max(...flat[f].map((p,i)=>Math.abs((p.dev??p.microns)-(tilt[f][i].dev??tilt[f][i].microns))));
 log(`${id} rigid plane: pair angles unchanged (max |Δ| µrad)`,0,maxd('pairs'),maxd('pairs')<1e-6);
 log(`${id} rigid plane: finite-scan readings unchanged (max |Δ| µm)`,0,maxd('scans'),maxd('scans')<1e-4);
 if(flat.sweep&&Array.isArray(flat.sweep)){const d=Math.max(...flat.sweep.map((v,i)=>Math.abs(v-tilt.sweep[i])));log(`${id} rigid plane: sweep unchanged (max |Δ| µm)`,0,d,d<1e-4);}
 if(kind!=='lathe'){const ef=Math.atan(B/1000)*1e6,er=-Math.atan(A/1000)*1e6,df=tilt.lean.front-flat.lean.front,dr=tilt.lean.right-flat.lean.right;
  log(`${id} rigid plane: combined lean shift = plane rotation (front,right µrad)`,[ef,er],[df,dr],Math.abs(df-ef)<.01&&Math.abs(dr-er)<.01);}
 else{const ef=Math.atan(A/1000)*1e6,df=tilt.lean.front-flat.lean.front;log(`lathe rigid plane: spindle up/down shift`,ef,df,Math.abs(df-ef)<.01);}
 log(`${id} settings metric uses evaluation length (errorMicrons/conv300 ratio, offset m)`,e.read('levelConfig.offset')/.3,flat.pairs.map(p=>p.errLen/p.conv300),null);
}
require('fs').writeFileSync(__dirname+'/intrinsic-invariance.json',JSON.stringify({seed:SEED,fails,checks:out,summary},null,1));
console.log('fails',fails);

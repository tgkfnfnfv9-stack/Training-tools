'use strict';
// Independent expected values for travel / gate(L3 double) / gantry.
// Allowed inputs only: dimensions, support coordinates (re-derived from app.js
// definitions), support heights, seed -> MachineAccuracy.generate (intrinsic
// squareness). No geometryModel / connectedPortal / referenceScan /
// spindleSweep* / Leveling.geometry / Leveling.orientation return values are used.
// World frame = internal drawing frame: x right, y up, z back. Lengths m, heights mm, slopes mm/m.
const MA=require('/home/user/Training-tools/src/machine-accuracy.js');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const OUT='/tmp/claude-0/-home-user-Training-tools/4989ebb2-0dd1-5f7d-84eb-5fc1dc0607ea/scratchpad/ver-portal';
// ---------- vector helpers ----------
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>Math.hypot(...a),unit=a=>mul(a,1/norm(a));
// Frame as three column vectors; apply = R v ; inv = R^T v (only for orthonormal frames)
const frame=(r,u,b)=>({r,u,b,apply:v=>add(add(mul(r,v[0]),mul(u,v[1])),mul(b,v[2])),inv:v=>[dot(r,v),dot(u,v),dot(b,v)]});
// Seating a rigid body on a surface with gradient (lr,fb) [mm/m], no rotation about the vertical:
// up = surface normal, right stays in the x-y plane, back = right x up.
function seat(lr,fb){const a=lr/1000,b=fb/1000,u=unit([-a,1,-b]),r=unit([1,a,0]);return frame(r,u,cross(r,u));}
// ---------- support surfaces (own implementations) ----------
function bilinear(points){ // rectangular grid, cell interpolation; outer cells extended
 const xs=[...new Set(points.map(p=>p.x))].sort((a,b)=>a-b),zs=[...new Set(points.map(p=>p.z))].sort((a,b)=>a-b);
 const H=(x,z)=>points.find(p=>p.x===x&&p.z===z).h;
 const idx=(v,k)=>{let i=0;while(i<k.length-2&&v>=k[i+1])i++;return i;}; // interior boundary -> right/back cell (same convention as declared in leveling.js comment)
 const cell=(x,z)=>{const i=idx(x,xs),j=idx(z,zs),dx=xs[i+1]-xs[i],dz=zs[j+1]-zs[j];return {u:(x-xs[i])/dx,v:(z-zs[j])/dz,dx,dz,h00:H(xs[i],zs[j]),h10:H(xs[i+1],zs[j]),h01:H(xs[i],zs[j+1]),h11:H(xs[i+1],zs[j+1])};};
 return {h:(x,z)=>{const c=cell(x,z);return (c.h00*(1-c.u)+c.h10*c.u)*(1-c.v)+(c.h01*(1-c.u)+c.h11*c.u)*c.v;},
  s:(x,z)=>{const c=cell(x,z);return {lr:((c.h10-c.h00)*(1-c.v)+(c.h11-c.h01)*c.v)/c.dx,fb:((c.h01-c.h00)*(1-c.u)+(c.h11-c.h10)*c.u)/c.dz};}};
}
function plane3(p){ // exact plane through 3 points h = c + a x + b z
 const [p0,p1,p2]=p,d1=[p1.x-p0.x,p1.z-p0.z,p1.h-p0.h],d2=[p2.x-p0.x,p2.z-p0.z,p2.h-p0.h],det=d1[0]*d2[1]-d1[1]*d2[0];
 const a=(d1[2]*d2[1]-d2[2]*d1[1])/det,b=(d1[0]*d2[2]-d2[0]*d1[2])/det;
 return {h:(x,z)=>p0.h+a*(x-p0.x)+b*(z-p0.z),s:()=>({lr:a,fb:b})};
}
// ---------- machine definitions (read from src/app.js as the model definition) ----------
function supportsOf(id){
 if(id==='gate'){
  const pts=[],add2=(id,x,z,group)=>pts.push({id,x,z:z-3.420,group});
  [.240,3.440,6.600].forEach((z,i)=>{for(const [s,x] of [['left',-.770],['center',0],['right',.770]])add2('bed-'+s+'-'+(i+1),x,z,'bed');});
  for(const [s,sg] of [['left',-1],['right',1]]){add2('column-'+s+'-front',sg*1.060,3.965,'column-'+s);add2('column-'+s+'-back',sg*1.060,4.515,'column-'+s);add2('column-'+s+'-outer',s==='left'?-1.425:1.420,4.245,'column-'+s);}
  return pts;
 }
 const m={travel:{w:5.4,d:2.6,grid:[3,2]},gantry:{w:4,d:5.8,grid:[2,4]}}[id],list=[];
 for(let j=0;j<m.grid[1];j++)for(let i=0;i<m.grid[0];i++)list.push({x:(i/(m.grid[0]-1)-.5)*m.w*.8,z:(j/(m.grid[1]-1)-.5)*m.d*.8});
 return list;
}
const NOM={travel:{X:[1,0,0],Y:[0,0,1],Z:[0,1,0]},gate:{X:[0,0,1],Y:[1,0,0],Z:[0,1,0]},gantry:{X:[0,0,1],Y:[1,0,0],Z:[0,1,0]}};
const AMP={travel:{X:1.0,Y:.35,Z:.3},gate:{X:.7,Y:.65,Z:.28},gantry:{X:.7,Y:.65,Z:.28}};
// intrinsic directions in the nominal (unrotated) member frame. Definition of the stored
// signed microns over 300 mm: angle between axes = 90deg + microns/300mm (rad).
function intrinsic(id,sq){
 const n=NOM[id],t=k=>sq[k].microns/.3/1e6,X=n.X;
 const yx=-Math.sin(t('XY')),yy=Math.sqrt(1-yx*yx),Y=add(mul(n.Y,yy),mul(X,yx));
 const zx=-Math.sin(t('XZ')),zy=(-Math.sin(t('YZ'))-zx*yx)/yy,zz=Math.sqrt(1-zx*zx-zy*zy),Z=add(add(mul(n.Z,zz),mul(n.Y,zy)),mul(X,zx));
 return {X,Y,Z};
}
// ---------- rigid body poses ----------
// pose: {R (frame), ref (world point), ref0 (nominal point)} ; world(p_nominal) = ref + R(p - ref0)
const at=(pose,p)=>add(pose.ref,pose.R.apply(sub(p,pose.ref0)));
function build(id,heights,state){
 const sup=supportsOf(id).map((p,i)=>({...p,h:heights[i]})),I=intrinsic(id,PROFILE[id].squareness);
 const mv=k=>AMP[id][k]*state[k]/100;
 if(id==='travel'){
  const S=bilinear(sup),c=-.5+mv('X'),zSeat=2.6*.29,zr=[2.6*.22-.1,2.6*.22+.1],zt=-2.6*.18;
  const sc=S.s(c,zSeat),Rc=seat(sc.lr,sc.fb);
  const sr=zr.map(z=>S.s(c,z)),rail={lr:(sr[0].lr+sr[1].lr)/2,fb:(sr[0].fb+sr[1].fb)/2},Rr=seat(rail.lr,rail.fb);
  const hr=(S.h(c,zr[0])+S.h(c,zr[1]))/2;
  const column={R:Rc,ref:[c,.66+hr/1000,(zr[0]+zr[1])/2],ref0:[c,.66,(zr[0]+zr[1])/2]};          // carriage on rails, posture from seat
  const columnSeat={R:Rc,ref:[c,.66+S.h(c,zSeat)/1000,zSeat],ref0:[c,.66,zSeat]};                // alternative vertical datum
  const st=S.s(0,zt),Rt=seat(st.lr,st.fb),table={R:Rt,ref:[0,.66+S.h(0,zt)/1000,zt],ref0:[0,.66,zt]};
  const dir={X:Rr.apply(I.X),Y:Rc.apply(I.Y),Z:Rc.apply(I.Z)};
  return {id,tool:column,toolAlt:columnSeat,table,dir,dirShear:dir,nose0:[c,1.65,-.3],tableTop:1.1,tableCentre0:[0,1.1,zt],slopes:{seat:sc,rail,table:st},rightRef:Rc.apply([1,0,0])};
 }
 // portals
 let colPts,colSurf,tableSurf,zt;
 if(id==='gate'){
  const bed=bilinear(sup.filter(p=>p.group==='bed')),L=plane3(sup.filter(p=>p.group==='column-left')),Rg=plane3(sup.filter(p=>p.group==='column-right'));
  colPts=[[-1.10,.825],[1.10,.825]];colSurf=[L,Rg];tableSurf=bed;zt=mv('X');
 }else{
  const S=bilinear(sup),zg=mv('X');colPts=[[-1.6,zg],[1.6,zg]];colSurf=[S,S];tableSurf=S;zt=0;
 }
 const cols=colPts.map(([x,z],i)=>{const s=colSurf[i].s(x,z),R=seat(s.lr,s.fb),foot=[x,.66+colSurf[i].h(x,z)/1000,z];return {s,R,foot,top:add(foot,mul(R.u,2.51)),top0:[x,.66+2.51,z]};});
 const ex=unit(sub(cols[1].top,cols[0].top)),um=unit(add(cols[0].R.u,cols[1].R.u)),ey=unit(sub(um,mul(ex,dot(um,ex)))),Rb=frame(ex,ey,cross(ex,ey));
 const centre=mul(add(cols[0].top,cols[1].top),.5),centre0=mul(add(cols[0].top0,cols[1].top0),.5);
 const bridge={R:Rb,ref:centre,ref0:centre0};
 // shear variant (product's stated assumption: Z follows mean column up, not orthogonalised to the beam)
 const Sh={apply:v=>add(add(mul(ex,v[0]),mul(um,v[1])),mul(unit(cross(ex,um)),v[2]))};
 const st=tableSurf.s(0,zt),Rt=seat(st.lr,st.fb),table={R:Rt,ref:[0,.66+tableSurf.h(0,zt)/1000,zt],ref0:[0,.66,zt]};
 let Xdir;
 if(id==='gate')Xdir=Rt.apply(I.X); // table guide tangent at the work point
 else{const m2={lr:(cols[0].s.lr+cols[1].s.lr)/2,fb:(cols[0].s.fb+cols[1].s.fb)/2};Xdir=seat(m2.lr,m2.fb).apply(I.X);} // two running rails
 const dir={X:Xdir,Y:Rb.apply(I.Y),Z:Rb.apply(I.Z)},dirShear={X:Xdir,Y:Sh.apply(I.Y),Z:Sh.apply(I.Z)};
 const gz=id==='gate'?.825:colPts[0][1];
 return {id,tool:bridge,table,dir,dirShear,nose0:[.15,1.91,gz-.23],tableTop:1.12,tableCentre0:[0,1.12,zt],slopes:{left:cols[0].s,right:cols[1].s,table:st},cols,rightRef:Rb.apply([1,0,0])};
}
// ---------- squareness measurement ----------
const PAIRS={XY:{base:'X',scan:'Y',sigma:1,master:'flat'},XZ:{base:'X',scan:'Z',sigma:-1,master:'standX'},YZ:{base:'Y',scan:'Z',sigma:-1,master:'standY'}};
const L=.3;
function masterPlaneNormalLocal(id,kind){ // normal (table-local) of the plane in which the master can be rotated for R alignment
 if(kind==='flat')return [0,1,0];
 const n=NOM[id];return kind==='standX'?n.Y:n.X; // standing master containing X&Z -> normal = machine Y ; containing Y&Z -> normal = machine X
}
let SENS={dh:0,dz:0,dx:0};
function contactHeights(m,kind){const d=SENS.dh;return kind==='flat'?{R:m.tableTop+.025+d,S0:m.tableTop+.025,S1:m.tableTop+.025}:{R:m.tableTop+.05+d,S0:m.tableTop+.31,S1:m.tableTop+.01};}
function memberRange(id,key,cur){const half=AMP[id][key];const lo=Math.max(-half,Math.min(half-L,cur*half/100));return [lo,lo+L];}
// tool-attached nominal point at given state (Y/Z motion inside the tool body along intrinsic directions)
// R alignment by physical 300 mm base traverse: chord of the dial tip in table-local coordinates, projected to master plane
function alignB2(id,heights,state,pair){
 const P=PAIRS[pair],I=intrinsic(id,PROFILE[id].squareness);
 const m0=build(id,heights,state),hgt=contactHeights(m0,P.master).R,np=masterPlaneNormalLocal(id,P.master);
 let chordLocal,range=null;
 if(P.base==='X'){
  range=memberRange(id,'X',state.X);
  const tipLocal=xm=>{const st={...state,X:xm/AMP[id].X*100},m=build(id,heights,st);
   // dial tip: nominal plan position under the spindle nose, at R contact height, fixed to the tool body
   const tipNom=[m.nose0[0]+SENS.dx,hgt,m.nose0[2]+SENS.dz],tip=at(m.tool,tipNom);return m.table.R.inv(sub(tip,m.table.ref));};
  chordLocal=sub(tipLocal(range[1]),tipLocal(range[0]));
 }else{ // Y traverse moves only the saddle/head: chord = dY
  chordLocal=m0.table.R.inv(mul(m0.dir.Y,L));
 }
 let proj=unit(sub(chordLocal,mul(np,dot(chordLocal,np))));
 if(dot(proj,m0.table.R.inv(m0.dir[P.base]))<0)proj=mul(proj,-1); // S normal points to the dial side (+base)
 return {nLocal:proj,chordLocal,range};
}
function squareness(id,H0,H1,state){
 const res={};
 for(const pair of Object.keys(PAIRS)){
  const P=PAIRS[pair],r={};
  for(const [tag,H] of [['before',H0],['after',H1]]){
   const m=build(id,H,state),s=m.dir[P.scan],nB1=m.dir[P.base];
   // B1: R aligned to the local base-axis direction at the current position (product's definition)
   const rB1=-P.sigma*L*dot(nB1,s)*1e6;
   // B2: R aligned by the physical 300 mm base traverse (moving member posture + lever arm included)
   const al=alignB2(id,H,state,pair),nB2=m.table.R.apply(al.nLocal),rB2=-P.sigma*L*dot(nB2,s)*1e6;
   // shear variant (portal only)
   const sS=m.dirShear[P.scan],nS=m.dirShear[P.base],rShear=-P.sigma*L*dot(nS,sS)*1e6;
   r[tag]={B1:rB1,B2:rB2,shearB1:rShear,nB2Local:al.nLocal,chord:al.chordLocal,range:al.range};
  }
  // C and A: keep the initial (before) B2 mounting; table carries master, tool carries dial
  const m0=build(id,H0,state),m1=build(id,H1,state),hg=contactHeights(m0,P.master);
  for(const variant of ['B2','B1']){
   const nLocal=variant==='B2'?r.before.nB2Local:m0.table.R.inv(m0.dir[P.base]);
   const n0=m0.table.R.apply(nLocal),p0=mul(n0,-1);
   const n1=m1.table.R.apply(nLocal),p1=m1.tool.R.apply(m0.tool.R.inv(p0));
   const s1=m1.dir[P.scan],s0=m0.dir[P.scan];
   // start contact: dial under the nose plan position at S start height (assumption), body 10 mm off the face
   const tip0=[m0.nose0[0],hg.S0,m0.nose0[2]],face0=tip0,body0=add(face0,mul(n0,.01));
   const e=(n,face,body,p)=>dot(n,sub(face,body))/dot(n,p);
   const e0=e(n0,face0,body0,p0); // = 0.010
   const C0end=e(n0,face0,add(body0,mul(s0,P.sigma*L)),p0);
   const face1=at(m1.table,m0.table.R.inv(sub(face0,m0.table.ref)).map((v,i)=>v+m0.table.ref0[i])); // carry face point with table
   const bodyLocal=add(m0.tool.R.inv(sub(body0,m0.tool.ref)),m0.tool.ref0),body1=at(m1.tool,bodyLocal);
   const e1s=e(n1,face1,body1,p1),e1e=e(n1,face1,add(body1,mul(s1,P.sigma*L)),p1);
   r['C_'+variant]=(e1s-e1e)*1e6;
   r['A_'+variant]=(e0-e1e)*1e6;r['Ajump_'+variant]=(e0-e1s)*1e6;r['before_check_'+variant]=(e0-C0end)*1e6;
   r['probeExt_'+variant]={before_start_mm:e0*1000,after_start_mm:e1s*1000,after_end_mm:e1e*1000};
   // sensitivity of the A jump to the (unspecified) contact height: +0.1 m
   const tipH=add(tip0,[0,.1,0]),bodyH=add(tipH,mul(n0,.01)),faceH1=at(m1.table,add(m0.table.R.inv(sub(tipH,m0.table.ref)),m0.table.ref0)),bodyH1=at(m1.tool,add(m0.tool.R.inv(sub(bodyH,m0.tool.ref)),m0.tool.ref0));
   r['AjumpPer100mm_'+variant]=((e0-e(n1,faceH1,bodyH1,p1))*1e6)-r['Ajump_'+variant];
  }
  res[pair]=r;
 }
 return res;
}
// ---------- spindle sweep (dial on spindle, spindle rotated, radius 0.15 m, table top) ----------
function sweep(id,H0,H1,state,shear){
 const out={};
 const run=(m,useAlt)=>{
  const a=unit(shear?m.dirShear.Z:m.dir.Z),u=m.table.R.u;
  const right=m.rightRef,e0=unit(sub(right,mul(a,dot(right,a)))),e90=unit(cross(e0,a));
  const lam=th=>{const t=th*Math.PI/180,rho=mul(add(mul(e0,Math.cos(t)),mul(e90,Math.sin(t))),.15);return -dot(u,rho)/dot(u,a);};
  return {a,u,e0,e90,lam,rel:[0,90,180,270].map(th=>(lam(th)-lam(270))*1e6)};
 };
 const m0=build(id,H0,state),m1=build(id,H1,state);
 const b=run(m0),c=run(m1);
 out.B_before=b.rel;out.B_after=c.rel;
 // A: keep initial front zero; ring points fixed on the tool body, table surface fixed on table.
 for(const datum of (id==='travel'?['rail','seat']:['bridge'])){
  const tool0=datum==='seat'?m0.toolAlt:m0.tool,tool1=datum==='seat'?m1.toolAlt:m1.tool;
  const nose=at(tool0,m0.nose0),tableTop0=at(m0.table,m0.tableCentre0);
  const along=dot(b.u,sub(tableTop0,nose))/dot(b.u,b.a),centre=add(nose,mul(b.a,along+.01)); // ring 10 mm above the table surface (extension 10 mm)
  const ring=th=>{const t=th*Math.PI/180;return add(centre,mul(add(mul(b.e0,Math.cos(t)),mul(b.e90,Math.sin(t))),.15));};
  const gap=(pt,aDir,u,surfPt)=>dot(u,sub(pt,surfPt))/dot(u,aDir);
  const g0=gap(ring(270),b.a,b.u,tableTop0);
  const carryT=p=>at(tool1,add(tool0.R.inv(sub(p,tool0.ref)),tool0.ref0));
  const a1=unit(tool1.R.apply(tool0.R.inv(b.a))),surf1=at(m1.table,add(m0.table.R.inv(sub(tableTop0,m0.table.ref)),m0.table.ref0));
  // after: spindle rotates about its (moved) axis; ring point at angle th measured from the carried e0
  out['A_after_'+datum]=[0,90,180,270].map(th=>(g0-gap(carryT(ring(th)),a1,m1.table.R.u,surf1))*1e6);
  out['A_before_'+datum]=[0,90,180,270].map(th=>(g0-gap(ring(th),b.a,b.u,tableTop0))*1e6);
 }
 out.relTilt={before:relTilt(b.a,b.u),after:relTilt(c.a,c.u)};
 return out;
}
function relTilt(a,u){return {axis:a,tableNormal:u,diff_urad:sub(a,u).map(v=>v*1e6)};}
// ---------- run ----------
const SEED=20261012;
const CASES={
 travel:{positions:{X:-50,Y:0,Z:0},ops:[[3,.2],[2,-.15]]},
 gate:{positions:{X:30,Y:0,Z:0},ops:[[8,.2],[9,-.15]]},
 gantry:{positions:{X:40,Y:0,Z:0},ops:[[5,.2],[0,-.15]]}
};
const PROFILE={};
const fmt=v=>{const m=Math.round(Math.abs(v));return m===0?'0':(v<0?'-':'+')+m;};
const results={};
for(const id of Object.keys(CASES)){
 const cs=CASES[id],nsup=supportsOf(id).length;PROFILE[id]=MA.generate('new',SEED,['X','Y','Z'],nsup);
 const H0=[...PROFILE[id].initialHeights],H1=[...H0];for(const [i,d] of cs.ops)H1[i]=Math.round((H1[i]+d)*1000)/1000;
 const state={...cs.positions,A:0,C:0};
 const prod=JSON.parse(execFileSync('node',[OUT+'/product.cjs',JSON.stringify({id,seed:SEED,positions:cs.positions,ops:cs.ops})],{cwd:'/home/user/Training-tools',maxBuffer:1e8}).toString());
 // sanity: support coordinates and heights equal to the product's inputs
 const sp=prod.supports,mine=supportsOf(id);
 const coordOK=sp.every((p,i)=>Math.abs(p.x-mine[i].x)<1e-12&&Math.abs(p.z-mine[i].z)<1e-12);
 const hOK=JSON.stringify(prod.before.heights)===JSON.stringify(H0)&&JSON.stringify(prod.after.heights)===JSON.stringify(H1);
 const sens={};for(const [k,v] of [['dh',{dh:.1,dz:0,dx:0}],['dz',{dh:0,dz:.1,dx:0}],['dx',{dh:0,dz:0,dx:.1}]]){SENS=v;const q=squareness(id,H0,H1,state);SENS={dh:0,dz:0,dx:0};sens[k]=q;}
 const sq=squareness(id,H0,H1,state),sw=sweep(id,H0,H1,state,false),swS=['gate','gantry'].includes(id)?sweep(id,H0,H1,state,true):null;
 const m0=build(id,H0,state),m1=build(id,H1,state);
 results[id]={sens,state,ops:cs.ops,H0,H1,coordOK,hOK,profile:PROFILE[id].squareness,slopes:{before:m0.slopes,after:m1.slopes},sq,sw,swS,prod};
}
fs.writeFileSync(OUT+'/results.json',JSON.stringify(results,null,1));
// ---------- tables ----------
let md='';
for(const [id,r] of Object.entries(results)){
 md+=`\n### ${id}  seed ${SEED}  state ${JSON.stringify(r.state)}  ops ${JSON.stringify(r.ops)}\n`;
 md+=`支持座標一致=${r.coordOK} 高さ一致=${r.hOK}  固有直角差µm XY ${r.profile.XY.microns} XZ ${r.profile.XZ.microns} YZ ${r.profile.YZ.microns}\n\n`;
 md+='| 対 | 状態 | 独立B1(局所方向合わせ) | 独立B2(300mm実走査で方向合わせ) | 門せん断仮定B1 | 製品DOM表示(生値) | 製品DOM−B1 | 製品DOM−B2 |\n|---|---|---|---|---|---|---|---|\n';
 ['XY','XZ','YZ'].forEach((k,i)=>{for(const tag of ['before','after']){const q=r.sq[k][tag],d=r.prod[tag].dom[i];
  md+=`| ${k} | ${tag} | ${q.B1.toFixed(4)} (${fmt(q.B1)}) | ${q.B2.toFixed(4)} (${fmt(q.B2)}) | ${['gate','gantry'].includes(id)?q.shearB1.toFixed(4)+' ('+fmt(q.shearB1)+')':'—'} | ${d.text} (${d.raw.toFixed(4)}) | ${(d.raw-q.B1).toFixed(4)} | ${(d.raw-q.B2).toFixed(4)} |\n`;}});
 md+='\nB2の取付仮定感度（R接触点を +0.1 m 動かしたときのB2変化 µm）\n\n| 対 | 状態 | 高さ+0.1m | 前後(z)+0.1m | 左右(x)+0.1m |\n|---|---|---|---|---|\n';
 for(const k of ['XY','XZ','YZ'])for(const tag of ['before','after'])md+=`| ${k} | ${tag} | ${(r.sens.dh[k][tag].B2-r.sq[k][tag].B2).toFixed(3)} | ${(r.sens.dz[k][tag].B2-r.sq[k][tag].B2).toFixed(3)} | ${(r.sens.dx[k][tag].B2-r.sq[k][tag].B2).toFixed(3)} |\n`;
 md+='\n| 対 | C_B2(取付保持・始点再ゼロ) | A_B2暫定(初期ゼロ保持) | Aの跳び(始点) | 跳びの接触高+100mm感度 | C_B1 | A_B1暫定 | 測定子伸び 前始点/後始点/後終点 mm(B2) |\n|---|---|---|---|---|---|---|---|\n';
 for(const k of ['XY','XZ','YZ']){const q=r.sq[k],pe=q.probeExt_B2;md+=`| ${k} | ${q.C_B2.toFixed(4)} (${fmt(q.C_B2)}) | ${q.A_B2.toFixed(3)} (${fmt(q.A_B2)}) | ${q.Ajump_B2.toFixed(3)} | ${q.AjumpPer100mm_B2.toFixed(3)} | ${q.C_B1.toFixed(4)} (${fmt(q.C_B1)}) | ${q.A_B1.toFixed(3)} (${fmt(q.A_B1)}) | ${pe.before_start_mm.toFixed(6)} / ${pe.after_start_mm.toFixed(6)} / ${pe.after_end_mm.toFixed(6)} |\n`;}
 md+='\n触れ（右/奥/左/手前基準, µm）\n\n| 状態 | 独立B(=C,手前再ゼロ) | 製品DOM | 差 |\n|---|---|---|---|\n';
 for(const tag of ['before','after']){const mine=r.sw['B_'+tag],p=r.prod[tag].sweep;md+=`| ${tag} | ${mine.map(v=>v.toFixed(3)+'('+fmt(v)+')').join(', ')} | ${p.map(x=>x.text+'('+Number(x.raw).toFixed(3)+')').join(', ')} | ${mine.map((v,i)=>(Number(p[i].raw)-v).toFixed(4)).join(', ')} |\n`;}
 if(r.swS)for(const tag of ['before','after']){const mine=r.swS['B_'+tag],p=r.prod[tag].sweep;md+=`| ${tag} せん断仮定 | ${mine.map(v=>v.toFixed(3)+'('+fmt(v)+')').join(', ')} | 同上 | ${mine.map((v,i)=>(Number(p[i].raw)-v).toFixed(4)).join(', ')} |\n`;}
 for(const key of Object.keys(r.sw).filter(k=>k.startsWith('A_')))md+=`| ${key} (初期手前ゼロ保持) | ${r.sw[key].map(v=>v.toFixed(3)+'('+fmt(v)+')').join(', ')} | 製品に該当表示なし | — |\n`;
}
fs.writeFileSync(OUT+'/tables.md',md);
console.log(md);

'use strict';
// Lathe: product display (real Chromium, branch index.html) vs independent oracle.
const fs=require('fs'),path=require('path'),{chromium}=require('playwright');
const O=require('./lathe-oracle.cjs');
const OUT=__dirname,BRANCH='file:///home/user/Training-tools/index.html',MAIN='file:///tmp/claude-0/-home-user-Training-tools/4989ebb2-0dd1-5f7d-84eb-5fc1dc0607ea/scratchpad/main-wt/index.html';
const int=v=>v==null||!Number.isFinite(v)?'—':(Math.round(Math.abs(v))===0?'0':(v<0?'-':'+')+Math.round(Math.abs(v)));
const q3=v=>Math.round(v*1000)/1000;
async function open(b,url){const p=await b.newPage({viewport:{width:1440,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(url);
 await p.evaluate(()=>openMachine(machines.find(m=>m.kind==='lathe')));return {p,errors};}
async function product(p,c){
 return p.evaluate(c=>{
  machineProfile=MachineAccuracy.generate(c.condition,c.seed,machineLinearKeys(),supports.length);machineReference=null;
  supportHeights=[...c.heights];positions={X:c.X,Y:0,Z:c.Z,A:0,C:0};updateAxisValues();updateLeveling(false);
  const g=geometryModel(),xz=g.pairs.find(q=>q.key==='XZ');
  return {lathe:JSON.parse($('liveSquareness').dataset.lathe),text:$('liveSquareness').innerText.replace(/\s+/g,' '),second:$('latheInspectionSecond').innerText.replace(/\s+/g,' '),
   heights:[...supportHeights],positions:{...positions},xzDev:xz.deviationMicroradians,accXZ:($('accuracy-current-XZ')||{}).textContent,columnLean:$('columnLean').textContent};
 },c);
}
function compare(c,P){
 const E=O.evaluate(c),diff={};
 for(const k of ['face','flat','dx','dy','barSide','barTop'])diff[k]=(P.lathe[k]==null&&E[k]==null)?0:(P.lathe[k]==null||E[k]==null)?Infinity:Math.abs(P.lathe[k]-E[k]);
 diff.runoutRoot=Math.abs(P.lathe.runout.rootMicrons-E.runout.root);diff.runoutTip=Math.abs(P.lathe.runout.tipMicrons-E.runout.tip);
 diff.xz=Math.abs(P.xzDev-E.xzMicroradians);
 // expected texts from oracle integers
 const expect={turret:`X ${int(E.face)}　Z ${int(E.flat)}`,bore:E.bore?`a ${int(E.bore[0])} b ${int(E.bore[1])} c ${int(E.bore[2])} d ${int(E.bore[3])}`:'—',centre:`芯差 X ${int(E.dx)}／高さ ${int(E.dy)} µm`,side:`側面（奥） ${int(E.barSide)}`,top:`上面 ${int(E.barTop)}`,runout:`a ${Math.round(E.runout.root)}　b ${Math.round(E.runout.tip)}`};
 const all=P.text+' '+P.second,textOK={};
 for(const [k,v] of Object.entries(expect))textOK[k]=all.replace(/\s+/g,' ').includes(v.replace(/\s+/g,' '));
 // nearness to .5 boundary (integer could legitimately flip on 1e-3 diffs)
 const near=['face','flat','dx','dy','barSide','barTop'].filter(k=>E[k]!=null&&Math.abs(Math.abs(E[k])%1-.5)<.01);
 return {oracle:{face:E.face,flat:E.flat,dx:E.dx,dy:E.dy,bore:E.bore,barSide:E.barSide,barTop:E.barTop,xz:E.xzMicroradians,runout:E.runout,carriage:E.carriage,barAxial:[E.side.axial0,E.side.axial1]},diff,maxDiff:Math.max(...Object.values(diff)),textOK,textAllOK:Object.values(textOK).every(Boolean),nearHalf:near};
}
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 const {p,errors}=await open(b,BRANCH);
 const results={cases:[],sweeps:{},conditions:[],buttons:{},errors};
 const seeds=[{seed:123456,condition:'used'},{seed:20261012,condition:'used'},{seed:7,condition:'new'},{seed:987654321,condition:'used'}];
 const clamp=h=>Math.max(-.5,Math.min(.5,Math.round(h*1000)/1000));
 const ops={initial:h=>h,'C+0.1':h=>h.map((v,i)=>i===2?v+.1:v),'D-0.2':h=>h.map((v,i)=>i===3?v-.2:v),'B+0.1,E-0.1':h=>h.map((v,i)=>i===1?v+.1:i===4?v-.1:v),'zero':h=>h.map(()=>0),'A+0.3,F-0.3':h=>h.map((v,i)=>i===0?v+.3:i===5?v-.3:v)};
 const posList=[[0,0],[0,-100],[0,-68.5714],[0,-11.4286],[0,45.7143],[0,57.1429],[0,100],[-100,0],[100,-11.4286],[35,-62],[-100,100],[100,-100]];
 for(const s of seeds){const init=O.profileFor(s.seed,s.condition).initialHeights;
  for(const [name,f] of Object.entries(ops))for(const [X,Z] of posList){
   const c={...s,heights:f([...init]).map(clamp),X,Z},P=await product(p,c),cmp=compare(c,P);
   results.cases.push({seed:s.seed,condition:s.condition,op:name,X,Z,heights:c.heights,product:{...P.lathe,xz:P.xzDev,text:P.text,second:P.second,accXZ:P.accXZ},...cmp});
  }}
 // Continuity sweeps across the support boundary x=0 (Z=-68.57 right pads, -11.43 seat, +45.71 left pads)
 const sweep=async(url,label,seed,heights,Zs)=>{
  const page=url===BRANCH?p:(await open(b,url)).p;const rows=[];
  for(const Z of Zs){const P=await product(page,{seed,condition:'used',heights,X:0,Z});rows.push({Z,...P.lathe,runout:undefined});}
  const keys=['flat','dx','dy','barSide','barTop'],jumps={};
  for(const k of keys){let m=0,at=null;for(let i=1;i<rows.length;i++){const d=Math.abs(rows[i][k]-rows[i-1][k]);if(d>m){m=d;at=[rows[i-1].Z,rows[i].Z];}}jumps[k]={maxStep:m,at};}
  if(url!==BRANCH)await page.close();
  return {label,seed,heights,step:Zs[1]-Zs[0],jumps,rows:rows.filter((r,i)=>i%10===0)};
 };
 const zs=(a,bb,st)=>{const r=[];for(let z=a;z<=bb+1e-9;z+=st)r.push(Math.round(z*1e4)/1e4);return r;};
 const hTwist=[0,0,0,0,.1,0]; // E (centre-back) raised: strong slope change at x=0
 const init=O.profileFor(20261012,'used').initialHeights;
 for(const [tag,h] of [['E+0.1',hTwist],['seed20261012-initial',init]]){
  for(const [win,Z0,Z1] of [['seat-x0',-14,-9],['rightpads-x0',-71,-66],['leftpads-x0',43,48]]){
   const Zl=zs(Z0,Z1,.05);
   results.sweeps[`${tag}:${win}:branch`]=await sweep(BRANCH,'branch',20261012,h,Zl);
   results.sweeps[`${tag}:${win}:main`]=await sweep(MAIN,'main e0e62e7',20261012,h,Zl);
   // oracle pads vs old seat
   const or=m=>{let mx={};const rows=Zl.map(Z=>O.evaluate({seed:20261012,heights:h,X:0,Z,mode:m}));for(const k of ['flat','dx','dy','barSide','barTop']){let v=0,at=null;for(let i=1;i<rows.length;i++){const d=Math.abs(rows[i][k]-rows[i-1][k]);if(d>v){v=d;at=[Zl[i-1],Zl[i]];}}mx[k]={maxStep:v,at};}
    let pl=0;for(let i=1;i<rows.length;i++)pl=Math.max(pl,Math.abs(rows[i].carriage.lr-rows[i-1].carriage.lr),Math.abs(rows[i].carriage.fb-rows[i-1].carriage.fb));mx.carriageSlopeMaxStep_mm_per_m=pl;return mx;};
   results.sweeps[`${tag}:${win}:oracle-pads`]=or('pads');results.sweeps[`${tag}:${win}:oracle-oldseat`]=or('seat');
  }
 }
 // Conditions A / C (oracle) and B (product) for support operations
 for(const s of [{seed:20261012,condition:'used'},{seed:123456,condition:'used'}]){
  const h0=O.profileFor(s.seed,s.condition).initialHeights;
  for(const [name,f] of [['C+0.1',ops['C+0.1']],['D-0.2',ops['D-0.2']],['E+0.1',h=>h.map((v,i)=>i===4?v+.1:v)]])for(const [X,Z] of [[0,0],[0,-11.4286],[35,-62]]){
   const h1=f([...h0]).map(clamp),before=await product(p,{...s,heights:h0,X,Z}),after=await product(p,{...s,heights:h1,X,Z});
   results.conditions.push({...s,op:name,X,Z,h0,h1,productB:{before:before.lathe,after:after.lathe,beforeText:before.text+' | '+before.second,afterText:after.text+' | '+after.second},oracle:O.conditionAC({...s,h0,h1,X,Z})});
  }
 }
 // Rigid common tilt: add a*x+b*z (exact on the grid) to all supports -> lathe readings unchanged
 {const xs=[-2,0,2],zz=[-.84,.84],init=O.profileFor(123456,'used').initialHeights,rig=[];
  for(const [a,bb] of [[.05,0],[0,.1],[-.075,.06]]){const h=init.map((v,i)=>v+a*xs[i%3]+bb*zz[Math.floor(i/3)]);
   for(const [X,Z] of [[0,0],[0,-40],[60,80]]){const P0=await product(p,{seed:123456,condition:'used',heights:init,X,Z}),P1=await product(p,{seed:123456,condition:'used',heights:h,X,Z});
    const d={};for(const k of ['face','flat','dx','dy','barSide','barTop'])d[k]=P1.lathe[k]-P0.lathe[k];d.xz=P1.xzDev-P0.xzDev;
    const E0=O.evaluate({seed:123456,heights:init,X,Z}),E1=O.evaluate({seed:123456,heights:h,X,Z}),od={};for(const k of ['face','flat','dx','dy','barSide','barTop'])od[k]=E1[k]-E0[k];
    rig.push({slope_mm_per_m:[a,bb],X,Z,productDelta:d,oracleDelta:od,textSame:P0.text===P1.text&&P0.second===P1.second,columnLean:[P0.columnLean,P1.columnLean]});}}
  results.rigidTilt=rig;}
 // Real button operations: coarse/fine raise/lower on support C, values update and restore
 {await p.evaluate(()=>{machineProfile=MachineAccuracy.generate('used',123456,machineLinearKeys(),supports.length);supportHeights=[...machineProfile.initialHeights];positions={X:0,Y:0,Z:0,A:0,C:0};updateAxisValues();updateLeveling(false);});
  const read=()=>p.evaluate(()=>({h:[...supportHeights],lathe:$('liveSquareness').dataset.lathe,text:$('liveSquareness').innerText+$('latheInspectionSecond').innerText}));
  await p.locator('#supportMap .map-point').nth(2).click();const r0=await read();
  await p.locator('#coarseAdjust').click();await p.locator('#raiseSupport').click();const r1=await read();
  await p.locator('#fineAdjust').click();await p.locator('#raiseSupport').click();const r2=await read();await p.locator('#lowerSupport').click();await p.locator('#lowerSupport').click();const r3=await read();
  await p.locator('#coarseAdjust').click();await p.locator('#lowerSupport').click();const r4=await read();
  const E=h=>{const e=O.evaluate({seed:123456,heights:h,X:0,Z:0});return {flat:e.flat,barTop:e.barTop,dx:e.dx};};
  results.buttons={r0:{h:r0.h,lathe:JSON.parse(r0.lathe),oracle:E(r0.h)},coarseUp:{h:r1.h,lathe:JSON.parse(r1.lathe),oracle:E(r1.h)},fineUp:{h:r2.h,lathe:JSON.parse(r2.lathe),oracle:E(r2.h)},fineDown2:{h:r3.h,lathe:JSON.parse(r3.lathe)},coarseDown:{h:r4.h,lathe:JSON.parse(r4.lathe)},restored:r4.lathe===r0.lathe,nanText:/NaN|undefined/.test(r0.text+r1.text+r2.text+r3.text+r4.text)};
 }
 await b.close();
 const cs=results.cases;
 results.summary={cases:cs.length,maxNumericDiff:Math.max(...cs.map(c=>c.maxDiff)),worst:cs.reduce((a,c)=>c.maxDiff>a.maxDiff?c:a).diff,textMismatches:cs.filter(c=>!c.textAllOK).map(c=>({seed:c.seed,op:c.op,X:c.X,Z:c.Z,textOK:c.textOK,nearHalf:c.nearHalf,text:c.product.text,second:c.product.second,oracle:c.oracle})),
  invalidCases:cs.filter(c=>c.product.barSide==null||c.product.barTop==null).map(c=>({seed:c.seed,op:c.op,X:c.X,Z:c.Z,barSide:c.product.barSide,barTop:c.product.barTop,oSide:c.oracle.barSide,oTop:c.oracle.barTop})),pageErrors:errors.length};
 fs.writeFileSync(path.join(OUT,'lathe-results.json'),JSON.stringify(results,null,1));
 console.log(JSON.stringify(results.summary,null,1));
 for(const [k,v] of Object.entries(results.sweeps))console.log(k,JSON.stringify(v.jumps||v));
})();

const fs=require('fs'),{chromium}=require('playwright'),O=require('./lathe-oracle.cjs');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('file:///home/user/Training-tools/index.html');await p.evaluate(()=>openMachine(machines.find(m=>m.kind==='lathe')));
const out=[];
for(const [width,depth] of [[3,1.2],[6,2.5],[4,1.68],[2.5,1.0]])for(const [X,Z] of [[0,0],[50,-80],[-30,90]]){
 const h=O.profileFor(20261012,'used').initialHeights.map((v,i)=>i===4?v+.1:v);
 const P=await p.evaluate(c=>{machineProfile=MachineAccuracy.generate('used',20261012,machineLinearKeys(),supports.length);levelConfig.width=c.width;levelConfig.depth=c.depth;supportHeights=[...c.h];positions={X:c.X,Y:0,Z:c.Z,A:0,C:0};updateAxisValues();updateLeveling(false);return JSON.parse($('liveSquareness').dataset.lathe);},{width,depth,h,X,Z});
 const E=O.evaluate({seed:20261012,heights:h,X,Z,width,depth});const d={};for(const k of ['face','flat','dx','dy','barSide','barTop'])d[k]=P[k]==null||E[k]==null?(P[k]===E[k]?0:`P=${P[k]} E=${E[k]}`):Math.abs(P[k]-E[k]);
 out.push({width,depth,X,Z,diff:d,P:{flat:P.flat,barSide:P.barSide,barTop:P.barTop,dx:P.dx},E:{flat:E.flat,barSide:E.barSide,barTop:E.barTop,dx:E.dx}});}
fs.writeFileSync(__dirname+'/dims-results.json',JSON.stringify({out,errors},null,1));for(const o of out)console.log(o.width,o.depth,o.X,o.Z,JSON.stringify(o.diff));console.log(errors);await b.close();})();

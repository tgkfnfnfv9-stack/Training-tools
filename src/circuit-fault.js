(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CircuitFault=api;
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 // Teaching model of a control panel for wire-break hunting with a tester.
 // Terminals are joined by wires (each one breakable). Closed contacts and
 // wires are ideal conductors; coils, lamps and motor windings are resistive
 // loads. AC voltages are solved as complex phasors (nodal analysis), so a
 // load with no current shows the full supply voltage on its far terminal,
 // and an open phase of a motor shows the midpoint voltage, as on a real
 // panel. Resistance readings are DC with the supply disconnected.
 const model='circuit-fault-v1';
 const C={add:(a,b)=>[a[0]+b[0],a[1]+b[1]],sub:(a,b)=>[a[0]-b[0],a[1]-b[1]],mul:(a,b)=>[a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]],div:(a,b)=>{const d=b[0]*b[0]+b[1]*b[1];return [(a[0]*b[0]+a[1]*b[1])/d,(a[1]*b[0]-a[0]*b[1])/d];},abs:a=>Math.hypot(a[0],a[1]),polar:(r,deg)=>[r*Math.cos(deg*Math.PI/180),r*Math.sin(deg*Math.PI/180)]};
 // DC resistance of loads by control voltage (teaching values).
 const loadOhms={100:{coil:220,timer:4700,lamp:2200},200:{coil:880,timer:9400,lamp:8200},24:{coil:36,timer:1200,lamp:560}};
 function random(seed){let value=seed>>>0;return ()=>{value=(value+0x6D2B79F5)>>>0;let t=value;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}

 // ---- Ladder layout -------------------------------------------------------
 // A block starts at the P bus. Its prefix runs along the first row; when it
 // has several rows, a vertical sub-bus after the prefix feeds every row, as in
 // a typical relay sequence drawing. An item is a device element or
 // {par:[[items],[items]]}, branches stacked downward and rejoined.
 const SLOT=64,ROW=46,LOADW=40;
 function Builder(){
  const b={terminals:{},wires:[],elements:[],labels:[],n:0};
  b.t=(x,y,extra={})=>{const id='t'+(b.n++);b.terminals[id]={id,x,y,...extra};return id;};
  b.wire=(a,c,pts)=>{const A=b.terminals[a],B=b.terminals[c];b.wires.push({id:'w'+b.wires.length,a,b:c,pts:pts||[[A.x,A.y],[B.x,B.y]]});};
  return b;
 }
 const isLoad=it=>it&&['coil','lamp','timer'].includes(it.type);
 function itemsWidth(items){return items.reduce((w,it)=>w+(it.par?Math.max(...it.par.map(itemsWidth))+18:isLoad(it)?0:SLOT),0);}
 function itemsHeight(items){return Math.max(1,...items.map(it=>it.par?it.par.reduce((h,br)=>h+itemsHeight(br),0):1));}
 // Place items from terminal `from` at (x,y); returns the last terminal.
 function placeSeries(b,items,from,x,y,endX){
  let cur=from,cx=x;
  for(const it of items){
   if(it.par){
    const w=Math.max(...it.par.map(itemsWidth)),jx=cx+8,ex=jx+w+10;let row=y;const ends=[];
    const split=b.t(jx,y,{junction:true}),C0=b.terminals[cur];b.wire(cur,split,[[C0.x,C0.y],[jx,y]]);
    it.par.forEach((br,k)=>{
     let s=split;
     if(k>0){s=b.t(jx,row,{junction:true});b.wire(split,s,[[jx,y],[jx,row]]);}
     const e=placeSeries(b,br,s,jx,row,null);
     ends.push({e,row});row+=itemsHeight(br)*ROW;
    });
    const join=b.t(ex,y,{junction:true});
    for(const {e,row:r} of ends){const E=b.terminals[e];b.wire(e,join,r===y?[[E.x,E.y],[ex,y]]:[[E.x,E.y],[ex,r],[ex,y]]);}
    cur=join;cx=ex;continue;
   }
   const lx=isLoad(it)?endX-LOADW-14:cx+10,rx=isLoad(it)?endX-14:cx+SLOT-10;
   const l=b.t(lx,y),r=b.t(rx,y);
   const L=b.terminals[cur];b.wire(cur,l,[[L.x,L.y],[lx,y]]);
   b.elements.push({...it,id:'e'+b.elements.length,pins:[l,r],x:(lx+rx)/2,y});
   cur=r;cx=isLoad(it)?endX:cx+SLOT;
  }
  return cur;
 }
 function ladder(blocks,opts){
  const b=Builder(),PX=34,NX=opts.width-34,top=54;let y=top;
  const pTaps=[],nTaps=[];
  for(const block of blocks){
   const rows=block.rows||[[]],prefix=block.prefix||[];
   const p=b.t(PX,y,{bus:'P'});pTaps.push(p);
   let after=placeSeries(b,prefix,p,PX,y,NX);
   const subX=PX+itemsWidth(prefix)+(rows.length>1?16:0);
   let rowY=y;const subTaps=[];
   rows.forEach((row,i)=>{
    let start=after;
    if(rows.length>1){
     const tap=b.t(subX,rowY,{junction:true});
     if(i===0){const A=b.terminals[after];b.wire(after,tap,[[A.x,A.y],[subX,rowY]]);}
     else b.wire(subTaps[i-1],tap,[[subX,subY(i-1)],[subX,rowY]]);
     subTaps.push(tap);start=tap;
    }
    const end=placeSeries(b,row,start,rows.length>1?subX:b.terminals[after].x,rowY,NX);
    const n=b.t(NX,rowY,{bus:'N'});nTaps.push(n);const E=b.terminals[end];b.wire(end,n,[[E.x,E.y],[NX,rowY]]);
    rowY+=itemsHeight(row)*ROW;
   });
   function subY(i){return b.terminals[subTaps[i]].y;}
   y=Math.max(rowY,y+itemsHeight(prefix)*ROW)+10;
  }
  // Bus segments between taps are ordinary (breakable) wires.
  const bus=(taps,x,name)=>{const top=b.t(x,top0,{bus:name,source:name});const sorted=[...taps].sort((a,c)=>b.terminals[a].y-b.terminals[c].y);let prev=top;for(const t of sorted){b.wire(prev,t);prev=t;}return top;};
  const top0=24;
  const P=bus(pTaps,PX,'P'),N=bus(nTaps,NX,'N');
  b.sources={[P]:'P',[N]:'N'};
  b.height=y+10;b.width=opts.width;
  b.labels.push({x:PX,y:14,text:'P'},{x:NX,y:14,text:'N'});
  return b;
 }

 // ---- Circuit catalogue --------------------------------------------------
 const pb=(dev,nc,label)=>({type:'contact',dev,nc:!!nc,device:'pb',label:label||dev});
 const a=(dev,label)=>({type:'contact',dev,nc:false,device:'relay',label:label||dev});
 const bb=(dev,label)=>({type:'contact',dev,nc:true,device:'relay',label:label||dev});
 const ta=(dev,label)=>({type:'contact',dev,nc:false,device:'timer',label:label||dev});
 const tb=(dev,label)=>({type:'contact',dev,nc:true,device:'timer',label:label||dev});
 const thr=(dev)=>({type:'contact',dev,nc:true,device:'thr',label:dev});
 const coil=(dev,label)=>({type:'coil',dev,label:label||dev});
 const timer=(dev,seconds)=>({type:'timer',dev,label:dev,seconds});
 const lamp=(dev,color,label)=>({type:'lamp',dev,color,label:label||dev});
 const catalogue=[
  {id:'selfhold',name:'自己保持回路（運転・停止）',normal:'PB1（運転）を押すとMCが入り、PB1を離しても自己保持でMCが入ったまま。RL（運転）点灯、GL（停止）消灯。PB0（停止）でMCが切れ、GL点灯に戻る。',
   pbs:{PB0:'停止（b）',PB1:'運転（a）'},
   blocks:[{prefix:[pb('PB0',true,'PB0'),{par:[[pb('PB1',false,'PB1')],[a('MC')]]}],rows:[[coil('MC')]]},{prefix:[a('MC')],rows:[[lamp('RL','#e34b3f','RL')]]},{prefix:[bb('MC')],rows:[[lamp('GL','#2f9e5b','GL')]]}]},
  {id:'interlock',name:'インターロック回路（正転・逆転）',normal:'PBF（正転）でMCF、PBR（逆転）でMCRが自己保持。相手のb接点でインターロックし、両方同時には入らない。PB0（停止）で両方切れる。正転RL・逆転YL点灯。',
   pbs:{PB0:'停止（b）',PBF:'正転（a）',PBR:'逆転（a）'},
   blocks:[{prefix:[pb('PB0',true,'PB0')],rows:[[{par:[[pb('PBF',false,'PBF')],[a('MCF')]]},bb('MCR'),coil('MCF')],[{par:[[pb('PBR',false,'PBR')],[a('MCR')]]},bb('MCF'),coil('MCR')]]},{prefix:[a('MCF')],rows:[[lamp('RL','#e34b3f','RL')]]},{prefix:[a('MCR')],rows:[[lamp('YL','#e2b100','YL')]]}]},
  {id:'signal',name:'信号機回路（タイマ2個）',normal:'B-PBSを押すとCR1が自己保持し、白（WL）と黄（YL）が点灯。T1（4秒）で白が消え、さらにT2（2秒）で黄が消えて緑（GL）が点灯。Y-PBSで全部消える。',
   pbs:{BPBS:'B-PBS（a）',YPBS:'Y-PBS（b）'},
   blocks:[{prefix:[{par:[[pb('BPBS',false,'B-PBS')],[a('CR1')]]}],rows:[[pb('YPBS',true,'Y-PBS'),coil('CR1')],[timer('T1',4)],[tb('T1'),lamp('WL','#f4f4f4','WL')],[tb('T2'),lamp('YL','#e2b100','YL')],[ta('T1'),timer('T2',2)],[ta('T2'),lamp('GL','#2f9e5b','GL')]]}]},
  {id:'stardelta',name:'スター・デルタ始動回路（制御回路）',normal:'PB1でMCとMCS（Y）が入りY始動、YL点灯。タイマT（5秒）でMCSが切れMCD（Δ）が入り、RL点灯。MCSとMCDは互いのb接点でインターロック。PB0で停止。',
   pbs:{PB0:'停止（b）',PB1:'始動（a）'},
   blocks:[{prefix:[thr('THR'),pb('PB0',true,'PB0'),{par:[[pb('PB1',false,'PB1')],[a('MC')]]}],rows:[[coil('MC')],[timer('T',5)],[tb('T'),bb('MCD'),coil('MCS')],[{par:[[ta('T')],[a('MCD')]]},bb('MCS'),coil('MCD')]]},{prefix:[a('MCS')],rows:[[lamp('YL','#e2b100','YL')]]},{prefix:[a('MCD')],rows:[[lamp('RL','#e34b3f','RL')]]}]},
  {id:'motor',name:'電動機の主回路（強電・3相200V）',three:true,normal:'MCCBを入れ、PB1でMCが自己保持すると、主回路のMC主接点が閉じて電動機Mが回る（RL点灯）。PB0で停止（GL点灯）。操作回路はR-S間の200V。',
   pbs:{PB0:'停止（b）',PB1:'運転（a）'}}
 ];
 const supplies=[{volts:100,label:'AC100V'},{volts:200,label:'AC200V'},{volts:24,label:'AC24V'}];

 // Three-phase main circuit with its operating circuit (R-S, 200 V).
 function motorCircuit(width){
  const b=Builder(),xs=[44,84,124],names=['R','S','T'],tops=xs.map((x,i)=>b.t(x,24,{bus:names[i],source:names[i]}));
  b.labels.push(...xs.map((x,i)=>({x,y:14,text:names[i]})));
  const pole=(el,y,dev)=>xs.map((x,i)=>{const l=b.t(x,y-14),r=b.t(x,y+14);b.elements.push({...el,id:'e'+b.elements.length,pins:[l,r],x,y,vertical:true,label:i===0?el.label:''});return [l,r];});
  const join=(from,to)=>from.forEach((f,i)=>b.wire(f,to[i]));
  const mccb=pole({type:'contact',dev:'MCCB',nc:false,device:'mccb',label:'MCCB'},70);
  join(tops,mccb.map(p=>p[0]));
  // Control taps after the MCCB on R and S.
  const tapR=b.t(xs[0],112,{junction:true}),tapS=b.t(xs[1],120,{junction:true});
  b.wire(mccb[0][1],tapR);b.wire(mccb[1][1],tapS);
  const mc=pole({type:'contact',dev:'MC',nc:false,device:'relay',label:'MC'},170);
  b.wire(tapR,mc[0][0]);b.wire(tapS,mc[1][0]);b.wire(mccb[2][1],mc[2][0]);
  const th=pole({type:'heater',dev:'THR',label:'THR'},240);
  join(mc.map(p=>p[1]),th.map(p=>p[0]));
  const motorY=330,uvw=xs.map((x,i)=>b.t(x,motorY-28,{label:['U','V','W'][i]}));
  join(th.map(p=>p[1]),uvw);
  const star=b.t(84,motorY+18,{internal:true});
  uvw.forEach((t,i)=>b.elements.push({type:'winding',dev:'M',id:'e'+b.elements.length,pins:[t,star],x:xs[i],y:motorY,hidden:true,label:''}));
  b.elements.push({type:'motor',dev:'M',id:'e'+b.elements.length,pins:[],x:84,y:motorY+4,label:'M 3~'});
  // Operating circuit as a ladder to the right, fed from R (P) and S (N).
  const PX=170,NX=width-30,rowsY=[150,196,242,288],P=b.t(PX,112,{junction:true}),N=b.t(NX,120,{junction:true});
  b.wire(tapR,P,[[xs[0],112],[PX,112]]);b.wire(tapS,N,[[xs[1],120],[NX,120]]);
  const pT=rowsY.map(y=>b.t(PX,y,{bus:'P'})),nT=rowsY.map(y=>b.t(NX,y,{bus:'N'}));
  [P,...pT].reduce((p,t)=>{b.wire(p,t);return t;});[N,...nT].reduce((p,t)=>{b.wire(p,t);return t;});
  const rung=(i,items)=>{const end=placeSeries(b,items,pT[i],PX,rowsY[i],NX);const E=b.terminals[end];b.wire(end,nT[i],[[E.x,E.y],[NX,rowsY[i]]]);};
  rung(0,[thr('THR'),pb('PB0',true,'PB0'),{par:[[pb('PB1',false,'PB1')],[a('MC')]]},coil('MC')]);
  rung(2,[a('MC'),lamp('RL','#e34b3f','RL')]);rung(3,[bb('MC'),lamp('GL','#2f9e5b','GL')]);
  b.labels.push({x:PX,y:104,text:'R'},{x:NX,y:104,text:'S'});
  b.sources=Object.fromEntries(tops.map((t,i)=>[t,names[i]]));
  b.height=380;b.width=width;
  return b;
 }

 function build(circuitId,volts,width=640){
  const def=catalogue.find(c=>c.id===circuitId);if(!def)throw new TypeError('回路が不正です。');
  const b=def.three?motorCircuit(width):ladder(def.blocks,{width});
  const supply=def.three?{label:'3相AC200V（操作回路 R-S 200V）',volts:200,three:true}:{...supplies.find(s=>s.volts===volts),three:false};
  const ohms=loadOhms[supply.three?200:supply.volts];
  for(const e of b.elements){
   if(e.type==='coil')e.ohms=ohms.coil;else if(e.type==='timer')e.ohms=ohms.timer;else if(e.type==='lamp')e.ohms=ohms.lamp;else if(e.type==='winding')e.ohms=4.2;
  }
  const devices={};
  for(const e of b.elements){
   if(e.type==='contact'&&e.device==='pb')devices[e.dev]={kind:'pb'};
   if(e.type==='coil')devices[e.dev]={kind:'relay'};
   if(e.type==='timer')devices[e.dev]={kind:'timer',seconds:e.seconds};
   if(e.device==='mccb')devices.MCCB={kind:'mccb'};
  }
  const circuit={model,id:def.id,name:def.name,normal:def.normal,pbs:def.pbs,supply,terminals:b.terminals,wires:b.wires,elements:b.elements,labels:b.labels,sources:b.sources,devices,width:b.width,height:b.height};
  circuit.numbers=wireNumbers(circuit);
  return circuit;
 }
 // 線番: one number per node of the intact wiring (contacts and loads separate
 // nodes). The supply buses keep their names.
 function wireNumbers(circuit){
  const groups=unionFind(Object.keys(circuit.terminals),circuit.wires.map(w=>[w.a,w.b]));
  const out={},names={};let next=1;
  for(const [t,s] of Object.entries(circuit.sources))names[groups.find(t)]=s;
  const order=Object.values(circuit.terminals).sort((p,q)=>p.y-q.y||p.x-q.x);
  for(const t of order){const g=groups.find(t.id);if(!(g in names))names[g]=String(next++);out[t.id]=names[g];}
  return out;
 }
 function unionFind(ids,pairs){
  const parent=Object.fromEntries(ids.map(i=>[i,i])),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  for(const [p,q] of pairs){const a=find(p),b=find(q);if(a!==b)parent[a]=b;}
  return {find};
 }

 // ---- State and solving ----------------------------------------------------
 function initialState(circuit){
  return {power:false,mccb:true,pressed:{},broken:[],relay:{},timer:{},thrTripped:false};
 }
 function contactClosed(circuit,state,e){
  let active=false;
  if(e.device==='pb')active=!!state.pressed[e.dev];
  else if(e.device==='relay')active=!!state.relay[e.dev];
  else if(e.device==='timer')active=(state.timer[e.dev]||0)>=circuit.devices[e.dev].seconds-1e-9;
  else if(e.device==='thr')active=!!state.thrTripped;
  else if(e.device==='mccb')return !!state.mccb;
  return e.nc?!active:active;
 }
 // Conductor groups for the present device states.
 function groupsOf(circuit,state){
  const broken=new Set(state.broken),pairs=circuit.wires.filter(w=>!broken.has(w.id)).map(w=>[w.a,w.b]);
  for(const e of circuit.elements){if((e.type==='contact'&&contactClosed(circuit,state,e))||e.type==='heater')pairs.push(e.pins);}
  return unionFind(Object.keys(circuit.terminals),pairs);
 }
 function sourcePhasor(circuit,name){
  const V=circuit.supply.volts;
  if(circuit.supply.three)return C.polar(V/Math.sqrt(3),{R:90,S:-30,T:210}[name]);
  return name==='P'?[V,0]:[0,0];
 }
 function loadEdges(circuit,groups){
  return circuit.elements.filter(e=>e.ohms).map(e=>({e,a:groups.find(e.pins[0]),b:groups.find(e.pins[1]),r:e.ohms}));
 }
 // Complex nodal solution. Unknown groups linked to a fixed group get a value;
 // isolated groups stay floating (null).
 function solve(circuit,state){
  const groups=groupsOf(circuit,state),fixed={};
  if(state.power)for(const [t,name] of Object.entries(circuit.sources))fixed[groups.find(t)]=sourcePhasor(circuit,name);
  const edges=loadEdges(circuit,groups),adj={};
  for(const ed of edges){(adj[ed.a]=adj[ed.a]||[]).push(ed.b);(adj[ed.b]=adj[ed.b]||[]).push(ed.a);}
  const reach=new Set(Object.keys(fixed)),queue=[...reach];
  while(queue.length){const g=queue.pop();for(const h of adj[g]||[])if(!reach.has(h)){reach.add(h);queue.push(h);}}
  const unknown=[...reach].filter(g=>!(g in fixed)),index=Object.fromEntries(unknown.map((g,i)=>[g,i])),n=unknown.length;
  const A=Array.from({length:n},()=>Array.from({length:n},()=>[0,0])),rhs=Array.from({length:n},()=>[0,0]);
  for(const {a,b,r} of edges){
   if(a===b)continue;const y=[1/r,0];
   for(const [p,q] of [[a,b],[b,a]]){
    if(!(p in index))continue;const i=index[p];A[i][i]=C.add(A[i][i],y);
    if(q in index)A[i][index[q]]=C.sub(A[i][index[q]],y);else if(q in fixed)rhs[i]=C.add(rhs[i],C.mul(y,fixed[q]));
   }
  }
  const x=gauss(A,rhs),potential={...fixed};unknown.forEach((g,i)=>potential[g]=x[i]);
  const at=t=>{const g=groups.find(t);return g in potential?potential[g]:null;};
  return {groups,at,edges,potential};
 }
 function gauss(A,b){
  const n=b.length,M=A.map((row,i)=>[...row.map(v=>[...v]),[...b[i]]]);
  for(let c=0;c<n;c++){
   let p=c;for(let r=c+1;r<n;r++)if(C.abs(M[r][c])>C.abs(M[p][c]))p=r;
   [M[c],M[p]]=[M[p],M[c]];const d=M[c][c];if(C.abs(d)<1e-15)continue;
   for(let j=c;j<=n;j++)M[c][j]=C.div(M[c][j],d);
   for(let r=0;r<n;r++)if(r!==c){const f=M[r][c];if(C.abs(f)===0)continue;for(let j=c;j<=n;j++)M[r][j]=C.sub(M[r][j],C.mul(f,M[c][j]));}
  }
  return M.map(row=>row[n]);
 }
 // Energized loads at the present state.
 function loadVoltages(circuit,solution){
  const out={};
  for(const ed of solution.edges){const pa=solution.at(ed.e.pins[0]),pb=solution.at(ed.e.pins[1]);out[ed.e.id]=pa&&pb?C.abs(C.sub(pa,pb)):0;}
  return out;
 }
 const rated=circuit=>circuit.supply.volts;
 // Advance the sequence by dt seconds: relays follow their coils (iterated to
 // a stable state), timers accumulate while their coil is energized.
 function step(circuit,state,dt=0){
  const on=(v,e)=>v[e.id]>=.7*rated(circuit);
  let v=loadVoltages(circuit,solve(circuit,state));
  for(const e of circuit.elements)if(e.type==='timer')state.timer[e.dev]=on(v,e)?(state.timer[e.dev]||0)+dt:0;
  for(let k=0;k<16;k++){
   v=loadVoltages(circuit,solve(circuit,state));let changed=false;
   for(const e of circuit.elements){
    if(e.type==='coil'&&!!state.relay[e.dev]!==on(v,e)){state.relay[e.dev]=on(v,e);changed=true;}
    if(e.type==='timer'&&!on(v,e)&&state.timer[e.dev]){state.timer[e.dev]=0;changed=true;}
   }
   if(!changed)break;
  }
  return status(circuit,state);
 }
 function status(circuit,state){
  const s=solve(circuit,state),v=loadVoltages(circuit,s),lit={},energized={};
  for(const e of circuit.elements){
   if(e.type==='lamp')lit[e.dev]=v[e.id]>=.7*rated(circuit);
   if(e.type==='coil'||e.type==='timer')energized[e.dev]=v[e.id]>=.7*rated(circuit);
  }
  const windings=circuit.elements.filter(e=>e.type==='winding').map(e=>v[e.id]);
  const phase=circuit.supply.volts/Math.sqrt(3);
  const motor=windings.length?(windings.every(w=>w>=.8*phase)?'run':windings.some(w=>w>.1*phase)?'hum':'stop'):null;
  return {lit,energized,motor,timer:{...state.timer}};
 }

 // ---- Tester ---------------------------------------------------------------
 function measure(circuit,state,red,black,mode){
  if(!red||!black)return {kind:'none',text:'リード未接続'};
  if(mode==='ohm'){
   if(state.power)return {kind:'danger',text:'危険：通電中にΩレンジで測らない',detail:'電源を切ってから抵抗を測ります（テスター破損・感電の危険）。'};
   const ohms=resistance(circuit,state,red,black);
   if(ohms===Infinity)return {kind:'ohm',value:Infinity,text:'OL',detail:'導通なし（開いている）'};
   return {kind:'ohm',value:ohms,text:ohms<1?'0.0 Ω':ohms<1000?ohms.toFixed(0)+' Ω':(ohms/1000).toFixed(2)+' kΩ',detail:ohms<1?'導通あり':'負荷を通って導通'};
  }
  if(!state.power)return {kind:'volt',value:0,text:'0.0 V',detail:'電源OFF'};
  const s=solve(circuit,state),pa=s.at(red),pb=s.at(black);
  if(!pa||!pb){
   if(s.groups.find(red)===s.groups.find(black))return {kind:'volt',value:0,text:'0.0 V',detail:''};
   return {kind:'float',value:0,text:'≈0 V',detail:'浮いている（どこにもつながらない）ため数字がふらつく'};
  }
  const value=C.abs(C.sub(pa,pb));
  return {kind:'volt',value,text:value.toFixed(1)+' V',detail:''};
 }
 // DC resistance between two terminals with the supply disconnected. Present
 // contact states (held push buttons, MCCB) apply; relays are released.
 function resistance(circuit,state,from,to){
  const off={...state,power:false,relay:{},timer:{}},groups=groupsOf(circuit,off),a=groups.find(from),b=groups.find(to);
  if(a===b)return 0;
  const edges=circuit.elements.filter(e=>e.ohms).map(e=>({a:groups.find(e.pins[0]),b:groups.find(e.pins[1]),g:1/e.ohms})).filter(e=>e.a!==e.b);
  const adj={};for(const e of edges){(adj[e.a]=adj[e.a]||[]).push(e.b);(adj[e.b]=adj[e.b]||[]).push(e.a);}
  const seen=new Set([a]),queue=[a];while(queue.length){const g=queue.pop();for(const h of adj[g]||[])if(!seen.has(h)){seen.add(h);queue.push(h);}}
  if(!seen.has(b))return Infinity;
  const nodes=[...seen].filter(g=>g!==b),index=Object.fromEntries(nodes.map((g,i)=>[g,i])),n=nodes.length;
  const A=Array.from({length:n},()=>Array.from({length:n},()=>[0,0])),rhs=Array.from({length:n},()=>[0,0]);
  for(const e of edges){if(!seen.has(e.a))continue;for(const [p,q] of [[e.a,e.b],[e.b,e.a]]){if(!(p in index))continue;const i=index[p];A[i][i]=C.add(A[i][i],[e.g,0]);if(q in index)A[i][index[q]]=C.sub(A[i][index[q]],[e.g,0]);}}
  rhs[index[a]]=[1,0];
  return gauss(A,rhs)[index[a]][0];
 }

 // ---- Problems --------------------------------------------------------------
 function generate(seed,breaks=2,width=640){
  const rng=random(seed),def=catalogue[Math.floor(rng()*catalogue.length)],volts=supplies[Math.floor(rng()*supplies.length)].volts;
  const circuit=build(def.id,volts,width),ids=circuit.wires.map(w=>w.id),broken=[];
  while(broken.length<Math.min(breaks,ids.length)){const id=ids[Math.floor(rng()*ids.length)];if(!broken.includes(id))broken.push(id);}
  return {seed,circuit,broken};
 }
 return Object.freeze({model,catalogue,supplies,build,generate,initialState,step,status,measure,resistance,solve,contactClosed,random});
});

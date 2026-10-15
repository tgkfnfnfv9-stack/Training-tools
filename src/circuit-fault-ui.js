'use strict';
// Wire-break hunting page. Draws the circuit with JIS-style symbols, places
// tester leads on terminals, and runs the sequence in real time.
(function(){
 const CF=window.CircuitFault;if(!CF||!document.getElementById('circuitDiagram'))return;
 const $c=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
 let active=false,problem=null,state=null,red=null,black=null,nextLead='red',mode='volt',answerMode=false,picked=new Set(),repaired=new Set(),measurements=0,lastKey='',timer=null,revealed=false;
 function seed(){const v=new Uint32Array(1);if(window.crypto?.getRandomValues)window.crypto.getRandomValues(v);else v[0]=Math.floor(Math.random()*4294967296);return v[0];}
 function newProblem(){
  problem=CF.generate(seed(),Number($c('circuitBreaks').value)||2);
  state=CF.initialState(problem.circuit);state.broken=[...problem.broken];
  red=black=null;nextLead='red';answerMode=false;picked=new Set();repaired=new Set();measurements=0;lastKey='';revealed=false;
  const c=problem.circuit;
  $c('circuitTitle').textContent=c.name;$c('circuitSupply').textContent=c.supply.three?c.supply.label:c.supply.label+'（操作回路）';
  $c('circuitName').textContent=c.name+'／'+(c.supply.three?c.supply.label:c.supply.label)+'／断線 '+problem.broken.length+'本';
  $c('circuitNormal').textContent=c.normal;$c('circuitResult').textContent='';
  $c('circuitMccb').hidden=!c.devices.MCCB;
  const box=$c('circuitButtons');box.replaceChildren();
  for(const [dev,label] of Object.entries(c.pbs)){const b=document.createElement('button');b.className='circuit-pb';b.dataset.pb=dev;b.setAttribute('aria-pressed','false');b.textContent=label;b.onclick=()=>{state.pressed[dev]=!state.pressed[dev];update();};box.append(b);}
  update();
 }
 const el=(name,attrs={},text)=>{const e=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;};
 function contactSymbol(g,e,closed){
  const T=problem.circuit.terminals,[l,r]=e.pins.map(p=>T[p]);
  if(e.vertical){
   const x=e.x,y0=l.y,y1=r.y,m=(y0+y1)/2;
   g.append(el('path',{d:`M${x},${y0}V${m-8}M${x},${m+8}V${y1}`,class:'cf-line'}));
   g.append(el('path',{d:closed?`M${x},${m-8}L${x},${m+8}`:`M${x},${m+8}L${x-9},${m-7}`,class:'cf-line'}));
   if(e.device==='mccb')g.append(el('path',{d:`M${x-4},${m-12}l8,8m0,-8l-8,8`,class:'cf-thin'}));
   if(e.label)g.append(el('text',{x:x-14,y:m+4,class:'cf-label','text-anchor':'end'},e.label));
   return;
  }
  const x=e.x,y=e.y;
  g.append(el('path',{d:`M${l.x},${y}H${x-9}M${x+9},${y}H${r.x}`,class:'cf-line'}));
  if(e.nc){g.append(el('path',{d:`M${x+9},${y}v7`,class:'cf-line'}));g.append(el('path',{d:closed?`M${x-9},${y}L${x+11},${y+2}`:`M${x-9},${y}L${x+12},${y-8}`,class:'cf-line'}));}
  else g.append(el('path',{d:closed?`M${x-9},${y}L${x+9},${y}`:`M${x-9},${y}L${x+9},${y-10}`,class:'cf-line'}));
  if(e.device==='pb'){g.append(el('path',{d:`M${x},${y-5}V${y-16}`,class:'cf-dash'}));g.append(el('path',{d:`M${x-6},${y-21}v5h12v-5`,class:'cf-thin'}));}
  if(e.device==='timer')g.append(el('path',{d:`M${x+2},${y-4}v-8m-6,0a6,5 0 0 1 12,0`,class:'cf-thin'}));
  if(e.device==='thr')g.append(el('path',{d:`M${x-3},${y-6}v-6h6v6`,class:'cf-thin'}));
  g.append(el('text',{x:x,y:y+(e.device==='pb'?-25:e.device==='timer'?-20:-14),class:'cf-label','text-anchor':'middle'},e.label));
 }
 function draw(st){
  const c=problem.circuit,T=c.terminals,svg=$c('circuitDiagram'),broken=new Set(revealed?problem.broken:[]);
  svg.setAttribute('viewBox',`0 0 ${c.width} ${c.height}`);svg.replaceChildren();
  svg.style.setProperty('--circuit-width',c.width+'px');
  const wires=el('g'),parts=el('g'),terms=el('g');
  for(const w of c.wires){
   const d='M'+w.pts.map(p=>p.join(',')).join('L'),cls='cf-wire'+(picked.has(w.id)?' picked':'')+(repaired.has(w.id)?' repaired':'')+(broken.has(w.id)&&!repaired.has(w.id)?' broken':'');
   wires.append(el('path',{d,class:cls}));
   const hit=el('path',{d,class:'cf-wire-hit','data-wire':w.id});hit.addEventListener('click',()=>{if(!answerMode)return;picked.has(w.id)?picked.delete(w.id):picked.add(w.id);update();});wires.append(hit);
   const mid=w.pts[Math.floor(w.pts.length/2)-(w.pts.length%2?0:1)],next=w.pts[Math.min(w.pts.length-1,Math.floor(w.pts.length/2))],mx=(mid[0]+next[0])/2,my=(mid[1]+next[1])/2;
   if(Math.hypot(next[0]-mid[0],next[1]-mid[1])>26)wires.append(el('text',{x:mx+2,y:my-3,class:'cf-number'},c.numbers[w.a]));
  }
  for(const e of c.elements){
   if(e.hidden)continue;const g=el('g',{class:'cf-part'});
   if(e.type==='contact')contactSymbol(g,e,false);
   else if(e.type==='coil'||e.type==='timer'){const [l,r]=e.pins.map(p=>T[p]),on=st.energized[e.dev];g.append(el('path',{d:`M${l.x},${e.y}H${e.x-14}M${e.x+14},${e.y}H${r.x}`,class:'cf-line'}));g.append(el('rect',{x:e.x-14,y:e.y-8,width:28,height:16,class:'cf-coil'+(on?' on':'')}));g.append(el('text',{x:e.x,y:e.y-12,class:'cf-label','text-anchor':'middle'},e.label+(e.type==='timer'?' '+e.seconds+'s':'')));}
   else if(e.type==='lamp'){const [l,r]=e.pins.map(p=>T[p]),on=st.lit[e.dev];g.append(el('path',{d:`M${l.x},${e.y}H${e.x-11}M${e.x+11},${e.y}H${r.x}`,class:'cf-line'}));g.append(el('circle',{cx:e.x,cy:e.y,r:11,class:'cf-lamp',style:on?`fill:${e.color}`:''}));g.append(el('text',{x:e.x,y:e.y+3.5,class:'cf-lamp-text','text-anchor':'middle'},e.label));}
   else if(e.type==='heater'){const [l,r]=e.pins.map(p=>T[p]);g.append(el('path',{d:`M${e.x},${l.y}V${e.y-6}h5v12h-5V${r.y}`,class:'cf-line'}));if(e.label)g.append(el('text',{x:e.x-14,y:e.y+4,class:'cf-label','text-anchor':'end'},e.label));}
   else if(e.type==='motor'){g.append(el('circle',{cx:e.x,cy:e.y,r:26,class:'cf-motor'+(st.motor==='run'?' run':st.motor==='hum'?' hum':'')}));g.append(el('text',{x:e.x,y:e.y+4,class:'cf-lamp-text','text-anchor':'middle'},st.motor==='hum'?'M うなる':e.label));}
   parts.append(g);
  }
  for(const l of c.labels)parts.append(el('text',{x:l.x,y:l.y,class:'cf-bus','text-anchor':'middle'},l.text));
  for(const t of Object.values(T)){
   if(t.internal)continue;
   terms.append(el('circle',{cx:t.x,cy:t.y,r:t.junction||t.bus?2.4:2.8,class:'cf-term'+(t.junction?' junction':'')}));
   if(t.label)terms.append(el('text',{x:t.x+6,y:t.y-4,class:'cf-label'},t.label));
   const hit=el('circle',{cx:t.x,cy:t.y,r:11,class:'cf-term-hit','data-term':t.id});
   hit.addEventListener('click',()=>{if(answerMode)return;if(nextLead==='red'){red=t.id;nextLead='black';}else{black=t.id;nextLead='red';}update();});
   terms.append(hit);
  }
  for(const [id,color,text] of [[red,'#d1343b','赤'],[black,'#222','黒']]){
   if(!id)continue;const t=T[id];terms.append(el('circle',{cx:t.x,cy:t.y,r:7,class:'cf-probe',style:`stroke:${color}`}));terms.append(el('text',{x:t.x,y:t.y-10,class:'cf-probe-text','text-anchor':'middle',style:`fill:${color}`},text));
  }
  svg.append(wires,parts,terms);
 }
 function update(){
  if(!problem)return;
  const c=problem.circuit,st=CF.step(c,state,0);
  draw(st);
  $c('circuitPower').textContent=state.power?'電源 ON':'電源 OFF';$c('circuitPower').setAttribute('aria-pressed',String(state.power));
  $c('circuitMccb').textContent=state.mccb?'MCCB 入':'MCCB 切';$c('circuitMccb').setAttribute('aria-pressed',String(state.mccb));
  for(const b of $c('circuitButtons').children){const on=!!state.pressed[b.dataset.pb];b.setAttribute('aria-pressed',String(on));b.textContent=c.pbs[b.dataset.pb]+(on?'：押している':'');}
  const chips=[...Object.entries(st.energized).map(([d,on])=>(on?'● ':'○ ')+d+(c.devices[d]?.kind==='timer'&&on?' '+Math.min(c.devices[d].seconds,state.timer[d]||0).toFixed(1)+'s':'')),...Object.entries(st.lit).map(([d,on])=>(on?'◉ ':'○ ')+d+(on?' 点灯':' 消灯'))];
  if(st.motor)chips.push('M：'+({run:'回転',hum:'うなる（欠相）',stop:'停止'}[st.motor]));
  $c('circuitStatus').replaceChildren(...chips.map(t=>{const s=document.createElement('span');s.textContent=t;s.className='circuit-chip'+(t[0]==='●'||t[0]==='◉'?' on':'');return s;}));
  const m=CF.measure(c,state,red,black,mode);
  $c('circuitMeterMode').textContent=mode==='ohm'?'Ω':'AC V';$c('circuitReading').textContent=m.text;$c('circuitReadingNote').textContent=m.detail||(red&&black?'赤 '+label(red)+'／黒 '+label(black):'端子をタップしてリードを当てる');
  $c('circuitMeter').dataset.kind=m.kind;
  const key=[red,black,mode,state.power].join('|');if(red&&black&&key!==lastKey){measurements++;lastKey=key;}
  $c('circuitCount').textContent='測定回数：'+measurements;
  $c('circuitLeadRed').setAttribute('aria-pressed',String(nextLead==='red'));$c('circuitLeadBlack').setAttribute('aria-pressed',String(nextLead==='black'));
  for(const b of document.querySelectorAll('[data-circuit-mode]'))b.setAttribute('aria-pressed',String(b.dataset.circuitMode===mode));
  $c('circuitAnswerMode').setAttribute('aria-pressed',String(answerMode));$c('circuitAnswerMode').textContent=answerMode?'線を選んでいます（タップで印）':'断線した線を選ぶ';
  $c('circuitPicked').textContent=picked.size?'選んだ線：'+[...picked].map(id=>wireName(id)).join('、'):'まだ選んでいません';
  $c('circuitDiagram').classList.toggle('answering',answerMode);
 }
 function label(id){const t=problem.circuit.terminals[id];return (t.label||'')+'線番'+problem.circuit.numbers[id];}
 function wireName(id){const w=problem.circuit.wires.find(x=>x.id===id);return '線番'+problem.circuit.numbers[w.a]+'の線';}
 function check(){
  const left=problem.broken.filter(id=>!repaired.has(id)),hits=[...picked].filter(id=>left.includes(id)),misses=[...picked].filter(id=>!left.includes(id));
  hits.forEach(id=>{repaired.add(id);state.broken=state.broken.filter(x=>x!==id);});picked=new Set();
  const remain=problem.broken.filter(id=>!repaired.has(id)).length;
  $c('circuitResult').textContent=(hits.length?'正解 '+hits.length+'本（緑の線は修理しました）。':'')+(misses.length?'違う線 '+misses.length+'本。':'')+(!hits.length&&!misses.length?'線を選んでから答え合わせをします。':'')+(remain?'残りの断線 '+remain+'本。':'全部見つけました！ 測定回数 '+measurements+'回。正常に動くか確かめましょう。');
  update();
 }
 function tick(){if(!problem||!active||document.getElementById('tester').hidden||!state.power)return;CF.step(problem.circuit,state,.25);update();}
 $c('circuitNew').onclick=newProblem;$c('circuitBreaks').onchange=newProblem;
 $c('circuitPower').onclick=()=>{state.power=!state.power;if(!state.power){state.relay={};state.timer={};}update();};
 $c('circuitMccb').onclick=()=>{state.mccb=!state.mccb;update();};
 for(const b of document.querySelectorAll('[data-circuit-mode]'))b.onclick=()=>{mode=b.dataset.circuitMode;update();};
 $c('circuitLeadRed').onclick=()=>{nextLead='red';update();};$c('circuitLeadBlack').onclick=()=>{nextLead='black';update();};
 $c('circuitClearLeads').onclick=()=>{red=black=null;nextLead='red';update();};
 $c('circuitAnswerMode').onclick=()=>{answerMode=!answerMode;update();};
 $c('circuitCheck').onclick=check;
 $c('circuitReveal').onclick=()=>{revealed=true;$c('circuitResult').textContent='赤い点線が断線です（'+problem.broken.map(wireName).join('、')+'）。';update();};
 // Practice tab on the tester page: the fault-finding diagram and cards replace
 // the single-part lesson while selected; the other tabs return to it.
 function setCircuitMode(on){
  active=on;$c('tester').classList.toggle('circuit-mode',on);$c('circuitVisual').hidden=!on;$c('circuitCards').hidden=!on;
  document.querySelector('[data-circuit-tab]').setAttribute('aria-pressed',String(on));
  if(on){document.querySelectorAll('[data-tester-case]').forEach(b=>b.setAttribute('aria-pressed','false'));if(!problem)newProblem();else update();}
 }
 document.querySelector('[data-circuit-tab]').addEventListener('click',()=>setCircuitMode(true));
 document.querySelectorAll('[data-tester-case]').forEach(b=>b.addEventListener('click',()=>{if(active)setCircuitMode(false);}));
 const resetTester=window.resetTesterLesson;window.resetTesterLesson=()=>{setCircuitMode(false);resetTester?.();};
 window.setCircuitMode=setCircuitMode;
 window.circuitFaultDebug=()=>({problem,state,red,black,mode,picked:[...picked],repaired:[...repaired]});
 timer=setInterval(tick,250);
})();

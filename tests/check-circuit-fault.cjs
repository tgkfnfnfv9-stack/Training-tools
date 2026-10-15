'use strict';
// Circuit fault trainer: sequences, tester physics and problem generation.
// Expected behaviour is written from the drawn circuits, not from the solver.
const assert=require('node:assert/strict');
const CF=require('../src/circuit-fault.js');
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.equal(a,b,m);checks++;},near=(a,b,t,m)=>{assert.ok(Math.abs(a-b)<=t,`${m}: ${a} vs ${b}`);checks++;};
const src=(c,name)=>Object.keys(c.sources).find(k=>c.sources[k]===name);
function run(c,st,pb,seconds){st.pressed[pb]=true;CF.step(c,st,0);st.pressed[pb]=false;let s=CF.step(c,st,0);for(let t=0;t<seconds;t+=.25)s=CF.step(c,st,.25);return s;}
for(const volts of [100,200,24]){
 // Self-hold: start latches MC, RL on; stop releases, GL on.
 let c=CF.build('selfhold',volts),st=CF.initialState(c);st.power=true;
 let s=CF.step(c,st,0);eq(s.energized.MC,false,'MC off at power-on');eq(s.lit.GL,true,'GL on when stopped');
 s=run(c,st,'PB1',0);eq(s.energized.MC,true,'MC latched');eq(s.lit.RL,true,'RL on');eq(s.lit.GL,false,'GL off');
 s=run(c,st,'PB0',0);eq(s.energized.MC,false,'stop releases');
 near(CF.measure(c,st,src(c,'P'),src(c,'N'),'volt').value,volts,1e-9,'P-N supply');
 // Interlock: MCF then MCR cannot both be on.
 c=CF.build('interlock',volts);st=CF.initialState(c);st.power=true;
 s=run(c,st,'PBF',0);eq(s.energized.MCF,true,'MCF latched');s=run(c,st,'PBR',0);eq(s.energized.MCR,false,'interlock blocks MCR');eq(s.lit.RL,true,'forward lamp');
 // Signal: white+yellow, white off after 4 s, green after 6 s, Y-PBS clears.
 c=CF.build('signal',volts);st=CF.initialState(c);st.power=true;
 s=run(c,st,'BPBS',1);ok(s.lit.WL&&s.lit.YL&&!s.lit.GL,'start: white and yellow');
 s=run(c,st,'BPBS',3.5);ok(!s.lit.WL&&s.lit.YL,'after T1: yellow only');
 s=run(c,st,'BPBS',2.5);ok(!s.lit.YL&&s.lit.GL,'after T2: green');
 s=run(c,st,'YPBS',0);ok(!s.lit.GL&&!s.energized.CR1,'Y-PBS clears');
 // Star-delta: Y then delta after 5 s, never both.
 c=CF.build('stardelta',volts);st=CF.initialState(c);st.power=true;
 s=run(c,st,'PB1',1);ok(s.energized.MCS&&!s.energized.MCD,'star start');
 s=run(c,st,'PB1',0);for(let t=0;t<5;t+=.25)s=CF.step(c,st,.25);ok(!s.energized.MCS&&s.energized.MCD,'delta after timer');
}
// Motor main circuit: runs; an open phase makes it hum with half line voltage.
{
 const c=CF.build('motor',200),st=CF.initialState(c);st.power=true;let s=run(c,st,'PB1',0);eq(s.motor,'run','motor runs');
 const uvw=Object.values(c.terminals).filter(t=>t.label).map(t=>t.id),wU=c.wires.find(w=>w.b===uvw[0]);
 st.broken=[wU.id];s=CF.step(c,st,0);eq(s.motor,'hum','open phase hums');
 near(CF.measure(c,st,uvw[0],uvw[1],'volt').value,100,1e-6,'open phase U-V = half line voltage');
 near(CF.measure(c,st,uvw[1],uvw[2],'volt').value,200,1e-6,'healthy V-W line voltage');
}
// Broken wire on a loaded rung: full voltage across the break, none across the load.
{
 const c=CF.build('selfhold',100),st=CF.initialState(c),coil=c.elements.find(e=>e.type==='coil'),w=c.wires.find(w=>w.a===coil.pins[1]);
 st.broken=[w.id];st.power=true;st.pressed.PB1=true;CF.step(c,st,0);
 near(CF.measure(c,st,w.a,w.b,'volt').value,100,1e-9,'break shows supply');near(CF.measure(c,st,coil.pins[0],coil.pins[1],'volt').value,0,1e-9,'no current, no load voltage');
 eq(CF.measure(c,st,w.a,w.b,'ohm').kind,'danger','ohm range on live circuit is refused');
 // With the break, its ends still connect through the coil, P bus, MC(b) and GL.
 st.power=false;near(CF.measure(c,st,w.a,w.b,'ohm').value,220+2200,1e-6,'break bypassed only through loads');near(CF.measure(c,st,coil.pins[0],coil.pins[1],'ohm').value,220,1e-6,'coil resistance');
}
// Random problems: intact wires read 0 V / 0 Ω, every broken wire is not 0 Ω.
for(let seed=1;seed<=300;seed++){
 const p=CF.generate(seed,2),c=p.circuit,st=CF.initialState(c);st.broken=[...p.broken];eq(new Set(p.broken).size,2,'two distinct breaks');
 for(const w of c.wires){const r=CF.resistance(c,st,w.a,w.b);if(p.broken.includes(w.id))ok(r>0,'broken wire not 0 Ω');else eq(r,0,'intact wire 0 Ω');}
 st.power=true;CF.step(c,st,0);
 for(const w of c.wires)if(!p.broken.includes(w.id)){const m=CF.measure(c,st,w.a,w.b,'volt');eq(m.value,0,'intact wire 0 V');}
}
console.log(JSON.stringify({passed:true,checks,model:CF.model}));

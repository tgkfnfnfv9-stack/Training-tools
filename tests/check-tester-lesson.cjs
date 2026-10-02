const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('src/tester.html','utf8');
class El {constructor(id,dataset={}){this.id=id;this.dataset=dataset;this.attrs={};this.events={};this.value='';this.textContent='';this.innerHTML='';this.checked=false;this.hidden=false;} addEventListener(k,f){this.events[k]=f;}setAttribute(k,v){this.attrs[k]=v;}fire(k){assert(!this.disabled,this.id+' disabled');assert(this.events[k],this.id+' '+k);this.events[k]({target:this});}}
const elements={};for(const m of html.matchAll(/\bid="([^"]+)"/g)){assert(!elements[m[1]],'duplicate id');elements[m[1]]=new El(m[1]);}
const cases=[...html.matchAll(/data-tester-case="([^"]+)"/g)].map(m=>new El(m[1],{testerCase:m[1]}));
const modes=[...html.matchAll(/data-tester-mode="([^"]+)"/g)].map(m=>new El(m[1],{testerMode:m[1]}));
elements.tester.querySelectorAll=selector=>selector==='[data-tester-case]'?cases:modes;
const ctx={document:{getElementById:id=>{assert(elements[id],'missing '+id);return elements[id];}},window:{}};vm.runInNewContext(fs.readFileSync('src/tester.js','utf8'),ctx);
let assertions=0;function expect(id,text){assert(elements[id].textContent.includes(text),id+' '+elements[id].textContent);assertions++;}
function change(id,value){elements[id].value=value;elements[id].fire('change');}
function click(id){elements[id].fire('click');}function mode(value){modes.find(x=>x.dataset.testerMode===value).fire('click');}function lesson(value){cases.find(x=>x.dataset.testerCase===value).fire('click');}
expect('testerResult','未測定');assert(elements.testerDiagram.innerHTML.includes('OFF'));assertions++;
click('testerMeasure');expect('testerFeedbackDetail','黒をCOM');
change('testerBlackLead','com');change('testerRedLead','a');mode('dcv');click('testerMeasure');expect('testerFeedbackDetail','短絡');expect('testerResult','設定を確認');assert(elements.testerDiagram.innerHTML.includes('プローブを対象から離した状態'));assertions++;
change('testerRedLead','vohm');mode('off');click('testerMeasure');expect('testerFeedbackDetail','V⎓');
mode('dcv');click('testerMeasure');expect('testerResult','1.500 V');assert(elements.testerDiagram.innerHTML.includes('プローブを両端に接続'));assertions++;
assert(elements.testerBlackLead.disabled);assert.throws(()=>mode('ohm'),/disabled/);assertions+=2;click('testerDisconnect');change('testerPolarity','reverse');expect('testerResult','未測定');click('testerMeasure');expect('testerResult','−1.500 V');click('testerDisconnect');expect('testerResult','未測定');
lesson('resistance');assert.equal(elements.testerBlackLead.value,'none');assertions++;change('testerBlackLead','com');change('testerRedLead','vohm');mode('ohm');click('testerMeasure');expect('testerFeedbackDetail','残留電圧');elements.testerPrepared.checked=true;elements.testerPrepared.fire('change');click('testerMeasure');expect('testerResult','1.000 kΩ');assert(elements.testerPrepared.disabled);assertions++;click('testerDisconnect');elements.testerPrepared.checked=false;elements.testerPrepared.fire('change');expect('testerResult','未測定');
lesson('continuity');change('testerBlackLead','com');change('testerRedLead','vohm');elements.testerPrepared.checked=true;elements.testerPrepared.fire('change');mode('dcv');click('testerMeasure');expect('testerFeedbackDetail','導通');mode('beep');click('testerMeasure');expect('testerResult','0.3 Ω · ブザーあり');click('testerDisconnect');change('testerWire','broken');expect('testerResult','未測定');click('testerMeasure');expect('testerResult','OL · ブザーなし');assert(!elements.testerDiagram.innerHTML.includes('♪'));assertions++;
click('testerReset');expect('testerResult','未測定');assert.equal(elements.testerPrepared.checked,false);assertions++;ctx.window.resetTesterLesson();assert.equal(elements.testerPolarityBox.hidden,false);assertions++;
console.log(JSON.stringify({passed:true,assertions,flows:['missing leads','A terminal blocked','wrong mode blocked','DC voltage','reverse polarity','disconnect','resistance preparation','1kΩ resistance','continuity connected/broken','reset/lesson reset']},null,2));

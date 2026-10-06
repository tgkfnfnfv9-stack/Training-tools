'use strict';
const fs=require('node:fs'),vm=require('node:vm');
module.exports=function createEnvironment(options={}){
 const registry={},storage=new Map(),downloads=[],timers=[],timerDelays=[];
 const voids=new Set(['input','br','hr','img','meta','link','source','wbr']);
 class El{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.id='';this.attrs={};this.events={};this.dataset={};this.className='';this.hidden=false;this.disabled=false;this.checked=false;this.scrollTop=0;this.style={setProperty(k,v){this[k]=v;}};this._value='';this._text='';this.type='';}
  get classList(){const self=this;return {contains:n=>self.className.split(/\s+/).includes(n),toggle(n,active){const set=new Set(self.className.split(/\s+/).filter(Boolean));if(active===undefined)active=!set.has(n);if(active)set.add(n);else set.delete(n);self.className=[...set].join(' ');return active;}};}
  set value(v){v=String(v);if(this.tagName==='SELECT')this._value=this.children.some(c=>c.value===v)?v:'';else if(this.type==='number'&&v!==''&&!Number.isFinite(Number(v)))this._value='';else this._value=v;}
  get value(){return this._value;}
  get selectedOptions(){return this.children.filter(c=>c.value===this.value);}
  set textContent(s){this._text=String(s);this.children=[];}
  get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
  set innerHTML(s){this._html=s;this.children=[];parse(s,this);}
  get innerHTML(){return this._html||'';}
  append(...els){for(const el of els){el.parentElement=this;this.children.push(el);if(this.tagName==='SELECT'&&this.children.length===1)this._value=el.value;}}
  remove(){if(this.parentElement){const parent=this.parentElement;parent.children=parent.children.filter(child=>child!==this);this.parentElement=null;}}
  replaceChildren(...els){this.children=[];this._text='';this.append(...els);}
  setAttribute(k,v){v=String(v);this.attrs[k]=v;if(k==='id'){this.id=v;registry[v]=this;}if(k==='class')this.className=v;if(k==='type')this.type=v;if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;}
  getAttribute(k){return this.attrs[k]??null;}
  addEventListener(k,f){this.events[k]=f;}
  matches(s){return s.startsWith('.')?this.classList.contains(s.slice(1)):s.startsWith('#')?this.id===s.slice(1):s.startsWith('[')?Object.hasOwn(this.attrs,s.slice(1,-1)):this.tagName===s.toUpperCase();}
  closest(s){let node=this;while(node){if(node.matches(s))return node;node=node.parentElement;}return null;}
  querySelectorAll(s){const found=[];function walk(el){for(const c of el.children){if(c.matches(s))found.push(c);walk(c);}}walk(this);return found;}
  getBoundingClientRect(){return {width:0,height:0};}
  click(){if(this.disabled)return;if(this.tagName==='A')downloads.push({href:this.href,download:this.download,connected:this.closest('body')!==null,hidden:this.hidden});if(this.onclick)return this.onclick({target:this});}
  change(v){if(v!==undefined)this.value=v;return this.onchange?.({target:this});}
 }
 function parse(html,parent){
  const stack=[parent];
  for(const match of html.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/?[^>]+>|[^<]+/g)){
   const token=match[0];if(token.startsWith('<!'))continue;
   if(token.startsWith('</')){if(stack.length>1)stack.pop();continue;}
   if(!token.startsWith('<')){stack[stack.length-1]._text+=token;continue;}
   const tag=/^<([\w-]+)/.exec(token)?.[1];if(!tag)continue;const el=new El(tag);
   const source=token.slice(tag.length+1,-1);
   let inputValue=null;
   for(const a of source.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)){
    const name=a[1],value=a[2]??a[3]??a[4]??'';el.setAttribute(name,value);
    if(name==='value')inputValue=value;if(['hidden','disabled','checked'].includes(name))el[name]=true;
   }
   if(inputValue!==null)el.value=inputValue;
   stack[stack.length-1].append(el);
   if(tag==='option'&&Object.hasOwn(el.attrs,'selected'))el.parentElement._value=el.value;
   if(!voids.has(tag)&&!token.endsWith('/>'))stack.push(el);
  }
 }
 const root=new El('document');
 const html=fs.readFileSync('src/index.html','utf8').replace('<!-- TESTER_LESSON -->',fs.readFileSync('src/tester.html','utf8')).replace(/<script[\s\S]*?<\/script>/g,'');parse(html,root);
 const body=root.querySelectorAll('body')[0];
 const context={document:{body,hidden:false,getElementById:id=>registry[id]||null,createElement:tag=>new El(tag),querySelectorAll:s=>root.querySelectorAll(s),addEventListener(){}},
  window:{scrollTo(){},addEventListener(){},resetTesterLesson(){context.resetCalls++;},...(options.window||{})},resetCalls:0,
  localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value))},
  requestAnimationFrame:f=>{f(0);return 1;},cancelAnimationFrame(){},setTimeout:(f,delay)=>{timers.push(f);timerDelays.push(delay);return timers.length;},clearTimeout(){},Blob,
  URL:{createObjectURL:blob=>{context.exportedBlob=blob;return 'blob:test';},revokeObjectURL:url=>{context.revokedUrl=url;}}};
 vm.createContext(context);
 for(const file of ['leveling.js','machine-accuracy.js','spindle-sweep.js','app.js','leveling-ui.js','accuracy-ui.js','machine-accuracy-ui.js','spindle-sweep-ui.js'])vm.runInContext(fs.readFileSync('src/'+file,'utf8'),context,{filename:file});
 if(options.pureLeveling)vm.runInContext('initializeMachineAccuracy=()=>{machineProfile=null;machineReference=null;};',context);
 return {registry,body,storage,downloads,timers,timerDelays,context,read:code=>vm.runInContext(code,context),json:code=>JSON.parse(vm.runInContext('JSON.stringify('+code+')',context))};
};

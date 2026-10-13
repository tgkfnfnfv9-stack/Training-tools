const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
for(const url of ['file:///home/user/Training-tools/index.html','file:///tmp/claude-0/-home-user-Training-tools/4989ebb2-0dd1-5f7d-84eb-5fc1dc0607ea/scratchpad/main-wt/index.html']){
const p=await b.newPage();await p.goto(url);
const r=await p.evaluate(()=>{openMachine(machines.find(m=>m.id==='gate'));const pts=supports.map(s=>({...levelCoordinates(s.x,s.z),g:s.group,name:s.name}));
const out=[];for(let i=0;i<pts.length;i++){supportHeights=supports.map((_,j)=>j===i?.1:0);updateLeveling(false);out.push({i,p:pts[i],twist:levelSolution.twist,text:$('fineTwist').textContent,lr:levelSolution.lr,fb:levelSolution.fb});}return out;});
console.log(url.includes('main')?'MAIN':'BRANCH');for(const o of r)console.log(o.i,o.p.g,o.p.x.toFixed(2),o.p.z.toFixed(2),'twist',o.twist.toFixed(4),o.text,'lr',o.lr.toFixed(4),'fb',o.fb.toFixed(4));}
await b.close();})();

'use strict';
// 編集する場合、機械の名称・説明・モデル種別はこの一覧で変更できます。
const machines = [
{id:'vertical',name:'立形・片側コラム',tag:'テーブルXY移動',example:'小型：ロボドリル系 ／ 標準：立形MC',kind:'vertical',w:3.4,d:3.3,grid:[2,2],modes:[['standard','標準サイズ'],['compact','小型（ロボドリル系）']],structure:'片側コラムから主軸頭が張り出す基本構造。ロボドリル系と標準立形はこの一つの項目にまとめ、サイズの例を切り替えます。',focus:'テーブルの移動位置ごとの姿勢と、ベースのねじれ。',impact:'全体の傾きと、案内面の相対関係が変わるねじれを分けて学びます。',source:'https://www.fanuc.co.jp/ja/product/robodrill/alphadibplus.html'},
{id:'horizontal',name:'横形マシニングセンタ',tag:'横向き主軸・回転パレット',example:'横マシの代表的な移動構成',kind:'horizontal',w:3.4,d:3.6,grid:[2,2],structure:'主軸が横向き。ここではコラムX移動・主軸頭Y移動・テーブルZ移動の構成を示します。',focus:'主軸側とパレット側の相対関係、移動範囲での姿勢。',impact:'直線軸・回転軸の幾何関係を確認する必要があります。',source:'https://www.makino.co.jp/ja-jp/machine-technology/machines/horizontal-4-axis/a51nx'},
{id:'travel',name:'立形・移動コラム',tag:'テーブル固定・コラム移動',example:'固定テーブルの長尺加工機',kind:'travel',w:5.4,d:2.6,grid:[3,2],structure:'テーブルとワークは固定。コラムがX方向に走り、主軸頭側がY・Z方向に移動します。',focus:'長いベッドの各位置と、コラムの移動に伴う姿勢。',impact:'端だけでなく、中間位置の案内精度・姿勢も確認します。',source:'https://www.mazak.com/jp-ja/products/vtc/'},
{id:'gate',name:'固定門形',tag:'門は固定・移動方式を比較',example:'門形構造の立形／大型門形を統合',kind:'double',w:4,d:5.8,grid:[2,3],modes:[['long','長手テーブルX＋主軸側Y'],['cross','テーブルXY移動']],structure:'左右コラムと梁からなる門は固定。似た外観でも、テーブルと主軸側の軸の分担が異なる2方式を切り替えて比較します。',focus:'長手方向のベッドの姿勢と、左右コラム側の支持。',impact:'門が固定でも、テーブル・主軸の相対関係を確認します。梁のたわみなどは別の確認項目です。',source:'https://www.shibaura-machine.co.jp/jp/product/machinetool/lineup/m_new/Line_up.html'},
{id:'gantry',name:'移動門形・ガントリー',tag:'テーブル固定・門全体が移動',example:'固定門形とは動く側が逆',kind:'gantry',w:4,d:5.8,grid:[2,4],structure:'テーブルとワークは固定。左右の走行レール上を門全体がX方向に移動します。',focus:'左右走行レールの相対姿勢と、移動範囲の基礎・支持。',impact:'左右レールの関係と門の姿勢を確認します。同期駆動などの機種固有の調整は別途必要です。',source:'https://www.shibaura-machine.co.jp/jp/product/machinetool/lineup/s_new/spec.html'},
{id:'five',name:'5軸・テーブル旋回形',tag:'XYZ＋A/Cの旋回',example:'テーブルXY・主軸頭Zの学習モデル',kind:'five',w:3.4,d:3.3,grid:null,structure:'XYZの直線移動に、テーブルの傾斜Aと回転Cを加えた構成。ここではテーブル側XY・主軸頭Zを採用しています。',focus:'指定支持点での据付と、直線軸・回転軸の幾何関係。',impact:'回転中心や旋回軸の確認が必要です。軸の分担・名称は実機により異なります。',source:'https://us.dmgmori.com/products/machines/milling/5-axis-milling/monoblock/dmu-75-monoblock-2nd'},
{id:'lathe',name:'NC旋盤・2軸',tag:'X径方向・Z主軸方向',example:'基本の2軸旋盤（Y軸なし）',kind:'lathe',w:5,d:2.1,grid:[3,2],structure:'主軸台を固定し、刃物台をZ（主軸方向）・X（径方向）に動かします。このモデルにY軸はありません。',focus:'ベッド長手方向の各位置での横断方向の水準器。',impact:'ベッドのねじれと主軸・案内の関係を確認します。テーパの原因は据付以外にもあります。',source:'https://www.haascnc.com/service/online-operator-s-manuals/lathe-operator-s-manual/lathe---introduction.html'}
];
// 内部の描画座標は左右=x、上=y、奥=z。工作機械の軸名は機構ごとに明示して割り当てる。
const axisColors={X:'#d35455',Y:'#208768',Z:'#397ed1',A:'#8e5caf',C:'#bc6a2f'};
let positions={X:0,Y:0,Z:0,A:0,C:0}, selectedAxis='X', machineMode='standard';
function displayMachine(base){
 const m={...base};
 if(base.id==='vertical'&&machineMode==='compact'){m.kind='compact';m.w=2.6;m.d=2.7;}
 if(base.id==='gate'&&machineMode==='cross'){m.kind='portal';m.w=3.6;m.d=3.5;m.grid=[2,2];}
 return m;
}
function axisConfig(m){
 const a=(key,part,direction,vector,amp)=>({key,part,direction,vector,amp});
 if(['vertical','compact','portal'].includes(m.kind))return [a('X','テーブル','左右',[1,0,0],.45),a('Y','サドル＋テーブル','前後',[0,0,1],.4),a('Z','主軸頭＋工具','上下',[0,1,0],.3)];
 if(m.kind==='travel')return [a('X','コラム＋主軸頭','長手（左右）',[1,0,0],1.0),a('Y','主軸頭の前後スライド','前後',[0,0,1],.35),a('Z','主軸頭＋工具','上下',[0,1,0],.3)];
 if(m.kind==='horizontal')return [a('X','コラム＋主軸頭','左右',[1,0,0],.55),a('Y','主軸頭＋工具','上下',[0,1,0],.3),a('Z','パレット台＋ワーク','主軸方向（前後）',[0,0,1],.45)];
 if(['double','gantry'].includes(m.kind))return [a('X',m.kind==='double'?'テーブル＋ワーク':'門全体＋主軸側','長手（前後）',[0,0,1],.7),a('Y','主軸サドル＋ラム','門幅（左右）',[1,0,0],.65),a('Z','ラム＋主軸・工具','上下',[0,1,0],.28)];
 if(m.kind==='five')return [a('X','トラニオン一式','左右',[1,0,0],.35),a('Y','サドル＋トラニオン一式','前後',[0,0,1],.35),a('Z','主軸頭＋工具','上下',[0,1,0],.3),a('A','揺りかご＋テーブル','X軸回りの傾斜',[1,0,0],.55),a('C','回転テーブル＋ワーク','テーブル軸回りの回転',[0,1,0],1.1)];
 return [a('X','刃物台','径方向',[0,0,1],.35),a('Z','往復台＋刃物台','主軸方向（左右）',[1,0,0],.7)];
}
function fixedParts(m){
 if(['vertical','compact','portal'].includes(m.kind))return 'ベース・コラム／門・案内レール';
 if(m.kind==='travel')return 'ベース・テーブル・ワーク・コラム走行レール';
 if(m.kind==='horizontal')return 'ベース・コラム／テーブルの案内レール';
 if(m.kind==='double')return 'ベース・左右コラム・梁・長手案内レール';
 if(m.kind==='gantry')return '基礎側ベース・テーブル・ワーク・走行レール';
 if(m.kind==='five')return 'ベース・コラム・案内レール';
 return 'ベッド・主軸台・心押台（加工中の位置）';
}
function transformedPoint(p,axes,m){
 let q=[...p];
 // C回転はA傾斜前のテーブル座標で適用し、Aの親子関係を保つ。
 const pivot=[0,1.25,-.45];
 if(axes.includes('C')){const t=positions.C*Math.PI/100,dx=q[0]-pivot[0],dz=q[2]-pivot[2];q[0]=pivot[0]+dx*Math.cos(t)+dz*Math.sin(t);q[2]=pivot[2]-dx*Math.sin(t)+dz*Math.cos(t);}
 if(axes.includes('A')){const t=positions.A*.45/100,dy=q[1]-pivot[1],dz=q[2]-pivot[2];q[1]=pivot[1]+dy*Math.cos(t)-dz*Math.sin(t);q[2]=pivot[2]+dy*Math.sin(t)+dz*Math.cos(t);}
 for(const a of axisConfig(m).filter(a=>['X','Y','Z'].includes(a.key)))if(axes.includes(a.key))q=q.map((v,i)=>v+a.vector[i]*a.amp*positions[a.key]/100);
 return q;
}
const $=id=>document.getElementById(id);
let current=displayMachine(machines[0]), page='home', yaw=-0.45, selected=0, supports=[];
function supportList(m){
 if(!m.grid)return [{x:-m.w*.4,z:-m.d*.4,name:'左・手前'},{x:m.w*.4,z:-m.d*.4,name:'右・手前'},{x:0,z:m.d*.4,name:'奥・中央'}];
 const [nx,nz]=m.grid,list=[];
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++)list.push({x:(i/(nx-1)-.5)*m.w*.8,z:(j/(nz-1)-.5)*m.d*.8,name:`${nx===2?(i?'右':'左'):(['左','中央','右'][i])}・${j===0?'手前':j===nz-1?'奥':`中間${j}`}`});
 return list;
}
function navigate(next){
 if(next!=='training')stopMotion();page=next; for(const id of ['home','topics','catalog','training','electricTopics','tester'])$(id).hidden=id!==next;
 document.body.classList.toggle('in-lab',next==='training'||next==='tester');
 const controls=$(next+'Controls');if(controls)controls.scrollTop=0;
 const paths=next==='electricTopics'||next==='tester'?[['home','トップ'],['electricTopics','電気'],['tester','テスターの使い方']]:[['home','トップ'],['topics','機械'],['catalog','レベル出し'],['training',current.name]];
 const depth=paths.findIndex(([dest])=>dest===next);
 $('crumbs').replaceChildren();paths.slice(0,depth+1).forEach(([dest,label],i)=>{if(i){const s=document.createElement('span');s.textContent='›';$('crumbs').append(s);}const el=document.createElement(i===depth?'span':'button');el.textContent=label;if(i!==depth)el.onclick=()=>navigate(dest);$('crumbs').append(el);});
 window.scrollTo({top:0,behavior:'instant'}); if(next==='catalog')requestAnimationFrame(drawThumbnails);if(next==='training')requestAnimationFrame(drawScene);
}
$('mechanical').onclick=()=>navigate('topics');$('electric').onclick=()=>navigate('electricTopics');$('leveling').onclick=()=>navigate('catalog');$('changeMachine').onclick=()=>navigate('catalog');
$('testerEntry').onclick=()=>{if(window.resetTesterLesson)window.resetTesterLesson();navigate('tester');};
$('testerBack').onclick=()=>navigate('electricTopics');
function openMachine(m){
 stopMotion();machineMode=m.modes?m.modes[0][0]:'';current=displayMachine(m);positions={X:0,Y:0,Z:0,A:0,C:0};selectedAxis='X';selected=0;yaw=-.45;populateMachine();navigate('training');
}
function populateMachine(){
 const m=current;supports=supportList(m);
 $('machineTitle').textContent=m.name;$('machineSubtitle').textContent=m.example+' ｜ '+m.tag;
 $('structureText').textContent=m.structure;$('motionText').textContent=axisConfig(m).map(a=>a.key+'：'+a.part+'（'+a.direction+'）').join(' ／ ');$('focusText').textContent=m.focus;
 $('impactText').textContent=m.impact;$('supportNote').textContent=`本図は学習用の${supports.length}点支持です。実機の支持点位置・個数・荷重配分を再現したものではありません。`;
 $('sourceLinks').innerHTML=`<div class="source-links"><a href="${m.source}" target="_blank" rel="noopener noreferrer">メーカー公式資料で代表例を確認 ↗</a></div>`;
 $('measurePos').value='0'; $('labels').checked=true;
 ['lr','fb','twist'].forEach(id=>$(id).textContent='— mm/m');$('residual').textContent='— mm';$('diagnosis').innerHTML='<p class="diagnosis-item neutral">訓練計算は今後追加。現在は画面構成を確認できます。</p>';
 $('bubbleText').textContent='中央に置いた水準器の表示例（測定値は未計算）';
 buildSupports();buildAxisUI();buildModeUI();
}
function selectSupport(i){selected=i;buildSupports();drawScene();}
function buildSupports(){
 const map=$('supportMap');map.replaceChildren();const caption=document.createElement('div');caption.className='map-caption';caption.textContent='奥 ｜ 上から見た支持点配置';map.append(caption);
 const groups=current.grid?Array.from({length:current.grid[1]},(_,j)=>supports.map((s,i)=>({s,i})).filter(v=>Math.floor(v.i/current.grid[0])===j)).reverse():[[{s:supports[2],i:2}],[{s:supports[0],i:0},{s:supports[1],i:1}]];
 groups.forEach(group=>{const row=document.createElement('div');row.className='map-row';group.forEach(({s,i})=>{const b=document.createElement('button');b.className='map-point'+(selected===i?' active':'');b.textContent=String.fromCharCode(65+i);b.setAttribute('aria-label',s.name+'の支持点を選択');b.setAttribute('aria-pressed',selected===i?'true':'false');b.onclick=()=>selectSupport(i);row.append(b);});map.append(row);});const front=document.createElement('div');front.className='map-caption';front.textContent='手前';map.append(front);
 const controls=$('supportControls');controls.replaceChildren();supports.forEach((s,i)=>{const row=document.createElement('div');row.className='support-row'+(i===selected?' selected':'');const id=String.fromCharCode(65+i);row.innerHTML=`<label for="height${i}"><span class="point-id">${id}</span>${s.name}</label><button disabled aria-label="${id}を下げる">−</button><input id="height${i}" aria-label="${id}の高さ mm" value="0.00 mm" disabled><button disabled aria-label="${id}を上げる">＋</button>`;controls.append(row);});
}
const grid=$('machineGrid');machines.forEach(m=>{const card=document.createElement('button');card.className='machine-card';card.setAttribute('aria-label',m.name+'の訓練画面へ');card.innerHTML=`<canvas class="thumbnail" id="thumb-${m.id}" aria-label="${m.name}の構造模式図"></canvas><div class="content"><span class="pill">${m.tag}</span><h2>${m.name}</h2><p>${m.example}</p><span class="go">この構造を見てみる →</span></div>`;card.onclick=()=>openMachine(m);grid.append(card);});
// 部品に軸の親子関係を持たせ、固定部は動かさない。
function createGeometry(m){
 const faces=[],labels=[],c={base:'#80949c',fixed:'#799198',table:'#4c9b8b',spindle:'#dfab62',rail:'#c8d6d9',work:'#d1ddd7'};
 let group=[];
 function withGroup(axes,fn){const prev=group;group=axes;fn();group=prev;}
 function label(p,name){labels.push({p,axes:[...group],name,text:name+(group.length?'［'+group.join('/')+'］':'［固定］')});}
 function box(x,y,z,w,h,d,color,text){const v=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([a,b,e])=>[x+a*w/2,y+b*h/2,z+e*d/2]);[[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]].forEach((ix,i)=>faces.push({v:ix.map(j=>v[j]),axes:[...group],color,shade:[.83,.85,.65,1.08,.88,.94][i]}));if(text)label([x,y+h/2,z],text);}
 function cyl(x,y,z,r,len,color,axis='y',text){const n=20,ring=[[],[]];for(let k=0;k<2;k++)for(let i=0;i<n;i++){const a=i*2*Math.PI/n,cs=Math.cos(a)*r,sn=Math.sin(a)*r,t=(k-.5)*len;ring[k].push(axis==='x'?[x+t,y+cs,z+sn]:axis==='z'?[x+cs,y+sn,z+t]:[x+cs,y+t,z+sn]);}faces.push({v:ring[0],axes:[...group],color,shade:.8},{v:ring[1],axes:[...group],color,shade:1.08});for(let i=0;i<n;i++)faces.push({v:[ring[0][i],ring[0][(i+1)%n],ring[1][(i+1)%n],ring[1][i]],axes:[...group],color,shade:.8+.2*(Math.cos(i*2*Math.PI/n)+1)/2});if(text)label([x,y+r+.1,z],text);}
 const W=m.w,D=m.d;
 box(0,.42,0,W,.45,D,c.base,m.kind==='lathe'?'ベッド':'ベース');
 function spindle(x,y,z,axes){withGroup(axes,()=>{cyl(x,y,z,.16,.42,c.spindle,'y');cyl(x,y-.3,z,.045,.18,c.spindle);});}
 function table(width,depth,y,z,axes){withGroup(axes,()=>{box(0,y,z,width,.2,depth,c.table,'テーブル');for(let i=-3;i<=3;i++)box(i*width*.11,y+.105,z,.018,.012,depth*.97,c.rail);box(0,y+.3,z,.42,.38,.36,c.work);});}
 if(['vertical','compact','travel'].includes(m.kind)){
 const travel=m.kind==='travel',cx=travel?-.5:0;
 [-1,1].forEach(k=>box(travel?0:k*.36,.7,travel?D*.22+k*.1:-D*.05,travel?W*.9:.1,.1,travel?.09:D*.7,c.rail));
 withGroup(travel?['X']:[],()=>{box(cx,1.97,D*.29,.85,2.6,.68,c.fixed,'コラム');box(cx,2.2,D*.17,.2,2.0,.1,c.rail);});
 if(travel){withGroup(['X','Y'],()=>box(cx,2.85,.13,.72,.6,1.05,c.fixed,'前後スライド'));withGroup(['X','Y','Z'],()=>box(cx,2.45,-.25,.67,.55,.65,c.fixed,'主軸頭'));spindle(cx,2.04,-.3,['X','Y','Z']);table(W*.93,D*.39,1,-D*.18,[]);}
 else {withGroup(['Z'],()=>box(0,2.85,.05,.75,.6,1.1,c.fixed,'主軸頭'));spindle(0,2.37,-.3,['Z']);withGroup(['Y'],()=>box(0,.81,-D*.1,W*.58,.22,D*.45,c.fixed,'サドル'));table(W*.78,D*.42,1.06,-D*.1,['X','Y']);}
 }else if(['portal','double','gantry'].includes(m.kind)){
 const gate=m.kind==='gantry',cross=m.kind==='portal',gateAxes=gate?['X']:[],gz=cross?D*.24:0;
 [-1,1].forEach(k=>box(k*(gate?W*.4:W*.17),.72,0,.14,.12,D*.91,c.rail,k===1?(gate?'走行レール':'案内レール'):null));
 withGroup(gateAxes,()=>{[-1,1].forEach(k=>box(k*W*.4,1.96,gz,.5,2.6,.65,c.fixed,k===-1?'門／コラム':null));box(0,3.17,gz,W*.94,.55,.65,c.fixed,'梁');box(0,2.9,gz-.37,W*.83,.1,.1,c.rail);});
 const headAxes=cross?['Z']:gate?['X','Y','Z']:['Y','Z'];
 if(!cross)withGroup(gate?['X','Y']:['Y'],()=>box(.15,2.76,gz-.2,.72,.65,.65,c.fixed,'主軸サドル'));
 withGroup(headAxes,()=>box(.15,2.67,gz-.23,.42,.9,.45,c.fixed,'ラム／主軸頭'));spindle(.15,2.3,gz-.23,headAxes);
 if(cross)withGroup(['Y'],()=>box(0,.82,0,W*.6,.23,D*.6,c.fixed,'サドル'));
 table(W*.57,D*(cross?.43:.65),1.02,0,cross?['X','Y']:gate?[]:['X']);
 }else if(m.kind==='horizontal'){
 [-1,1].forEach(k=>box(0,.7,D*.28+k*.13,W*.86,.12,.1,c.rail));
 withGroup(['X'],()=>{box(0,1.95,D*.29,.95,2.5,.7,c.fixed,'コラム');box(0,2,D*.18,.16,2.0,.12,c.rail);});
 withGroup(['X','Y'],()=>{box(0,2.55,.25,.75,.62,1.1,c.fixed,'主軸頭');cyl(0,2.55,-.45,.2,.6,c.spindle,'z');cyl(0,2.55,-.83,.045,.2,c.spindle,'z');});
 withGroup(['Z'],()=>{box(0,.8,-.85,1.6,.23,1.6,c.fixed,'パレット台');cyl(0,1.03,-.85,.73,.2,c.table);box(0,1.2,-.85,1.45,.14,1.45,c.table,'パレット');box(0,1.75,-.85,.72,.95,.72,c.work);});
 }else if(m.kind==='five'){
 box(0,1.95,D*.3,1.0,2.6,.6,c.fixed,'コラム');withGroup(['Z'],()=>box(0,2.95,0,.72,.65,1.1,c.fixed,'主軸頭'));spindle(0,2.54,-.3,['Z']);
 withGroup(['Y'],()=>box(0,.77,-.45,2.6,.18,1.5,c.fixed,'サドル'));
 withGroup(['X','Y'],()=>{box(0,.91,-.45,2.4,.13,1.25,c.table);[-1,1].forEach(k=>box(k*.95,1.23,-.45,.3,.66,1.0,c.fixed,k===-1?'トラニオン支持':null));});
 withGroup(['X','Y','A'],()=>{cyl(0,1.25,-.45,.3,1.6,c.table,'x');box(0,1.19,-.45,1.45,.15,1.15,c.table,'揺りかご');});
 withGroup(['X','Y','A','C'],()=>{cyl(0,1.47,-.45,.65,.18,c.table,'y','回転テーブル');box(.18,1.68,-.45,.45,.25,.32,c.work);});
 }else {
 [-1,1].forEach(k=>box(0,.72,k*.4,W*.93,.11,.13,c.rail));box(-W*.35,1.22,0,.8,1.25,1.3,c.fixed,'主軸台');cyl(-W*.24,1.5,0,.4,.25,c.spindle,'x');cyl(0,1.5,0,.14,W*.45,c.work,'x');box(W*.33,1.13,0,.55,.9,.65,c.fixed,'心押台');cyl(W*.2,1.5,0,.1,.4,c.spindle,'x');
 withGroup(['Z'],()=>box(.08,.87,-.15,.8,.22,1.35,c.fixed,'往復台'));withGroup(['X','Z'],()=>{box(.08,1.18,-.58,.64,.5,.55,c.table,'刃物台');box(.08,1.45,-.33,.08,.08,.38,c.spindle);});
 }
 supportList(m).forEach(t=>{cyl(t.x,.18,t.z,.14,.22,'#7d8991');cyl(t.x,.07,t.z,.23,.09,'#52616d');});
 return {faces,labels};
}
function tone(hex,s){const v=hex.slice(1).match(/../g).map(x=>Math.min(255,Math.round(parseInt(x,16)*s)));return `rgb(${v.join(',')})`;}
function render(canvas,m,angle,showLabels,active){
 const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
 const ratio=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(rect.height*ratio);
 const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);const width=rect.width,height=rect.height;
 ctx.fillStyle='#eaf0f2';ctx.fillRect(0,0,width,height);
 const model=createGeometry(m),pitch=.24;
 function project(p){const [x,y,z]=p;const xx=x*Math.cos(angle)+z*Math.sin(angle),zz=-x*Math.sin(angle)+z*Math.cos(angle);const yy=(y-1.65)*Math.cos(pitch)+zz*Math.sin(pitch),depth=11+zz*Math.cos(pitch)-(y-1.65)*Math.sin(pitch);return [xx/depth,-yy/depth,depth];}
 const fitPoints=model.faces.flatMap(f=>f.v.map(p=>[...p]));fitPoints.push([-m.w*.7,.0,-m.d*.7],[m.w*.7,3.8,m.d*.7]);const points=fitPoints.map(project);const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));
 const margin=showLabels?48:20,scale=Math.min((width-margin*2)/(maxX-minX),(height-75)/(maxY-minY));const cx=width/2-(minX+maxX)*scale/2,cy=height*.48-(minY+maxY)*scale/2;
 const screen=p=>{const q=project(p);return [cx+q[0]*scale,cy+q[1]*scale,q[2]]};const movingScreen=(p,axes)=>screen(transformedPoint(p,axes,m));
 // 地面は回転に追従する格子。モデルを動かさず視点だけを左右に回す。
 ctx.strokeStyle='#d7e1e5';ctx.lineWidth=.7;
 for(let i=-4;i<=4;i++){for(const pair of [[[i,0,-4],[i,0,4]],[[-4,0,i],[4,0,i]]]){const a=screen(pair[0]),b=screen(pair[1]);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();}}
 model.faces.map(f=>({...f,p:f.v.map(p=>movingScreen(p,f.axes))})).sort((a,b)=>b.p.reduce((s,p)=>s+p[2],0)/b.p.length-a.p.reduce((s,p)=>s+p[2],0)/a.p.length).forEach(f=>{ctx.beginPath();f.p.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();const highlight=active>=0&&f.axes.includes(selectedAxis);const color=highlight?axisColors[selectedAxis]:f.axes.length?'#bfd0d6':'#8b9da3';ctx.fillStyle=tone(color,f.shade);ctx.fill();ctx.strokeStyle='#35546933';ctx.lineWidth=.6;ctx.stroke();});
 if(active>=0){supportList(m).forEach((s,i)=>{const p=screen([s.x,.15,s.z]);ctx.beginPath();ctx.arc(p[0],p[1]+10,13,0,Math.PI*2);ctx.fillStyle=active===i?'#ffda79':'#ffffffed';ctx.fill();ctx.strokeStyle=active===i?'#ba8d20':'#80949f';ctx.lineWidth=active===i?2:1;ctx.stroke();ctx.fillStyle='#23404e';ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String.fromCharCode(65+i),p[0],p[1]+10);});}
 if(showLabels){
 const labs=model.labels.map(l=>({...l,screen:movingScreen(l.p,l.axes)}));const sides=[labs.filter(l=>l.screen[0]<width/2),labs.filter(l=>l.screen[0]>=width/2)];
 sides.forEach((side,k)=>{side.sort((a,b)=>a.screen[1]-b.screen[1]);let last=15;side.forEach(l=>{let ly=Math.max(last+24,Math.min(height-40,l.screen[1]-8));last=ly;const lx=k?width-10:10;ctx.strokeStyle='#65818b99';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(l.screen[0],l.screen[1]);ctx.lineTo(k?lx-5:lx+5,ly);ctx.stroke();ctx.font='10px sans-serif';ctx.textAlign=k?'right':'left';ctx.textBaseline='middle';const tw=ctx.measureText(l.text).width;ctx.fillStyle='#f8fbf9ed';ctx.fillRect(k?lx-tw-4:lx-4,ly-9,tw+8,18);ctx.fillStyle='#365564';ctx.fillText(l.text,lx,ly);});});
 }
 if(active>=0&&$('showAxes').checked){
 const a=axisConfig(m).find(a=>a.key===selectedAxis);if(a&&['X','Y','Z'].includes(a.key)){
 const moved=model.faces.filter(f=>f.axes.includes(a.key)).flatMap(f=>f.v.map(p=>transformedPoint(p,f.axes,m)));const origin=[0,1,2].map(i=>(Math.min(...moved.map(p=>p[i]))+Math.max(...moved.map(p=>p[i])))/2),len=.6,from=origin.map((v,i)=>v-a.vector[i]*len),to=origin.map((v,i)=>v+a.vector[i]*len),pa=screen(from),pb=screen(to);
 ctx.strokeStyle=axisColors[a.key];ctx.fillStyle=axisColors[a.key];ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(pa[0],pa[1]);ctx.lineTo(pb[0],pb[1]);ctx.stroke();
 function arrow(p,q){const t=Math.atan2(p[1]-q[1],p[0]-q[0]);ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(p[0]-12*Math.cos(t-.45),p[1]-12*Math.sin(t-.45));ctx.lineTo(p[0]-12*Math.cos(t+.45),p[1]-12*Math.sin(t+.45));ctx.closePath();ctx.fill();}arrow(pa,pb);arrow(pb,pa);
 ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';const tx=(pa[0]+pb[0])/2,ty=(pa[1]+pb[1])/2-18;ctx.fillStyle='#ffffffed';ctx.fillRect(tx-17,ty-11,34,22);ctx.fillStyle=axisColors[a.key];ctx.fillText(a.key+'軸',tx,ty);
 }
 // Always-visible machine-relative orientation triad rotates with the model; this is not CNC +/- motion.
 const o=[48,height-56];ctx.font='bold 12px sans-serif';ctx.textAlign='center';
 for(const a of axisConfig(m).filter(a=>['X','Y','Z'].includes(a.key))){const pa=project([0,1.5,0]),pb=project(a.vector.map((v,i)=>v*.75+[0,1.5,0][i]));let dx=pb[0]-pa[0],dy=pb[1]-pa[1],n=Math.hypot(dx,dy)||1;const p=[o[0]+dx/n*30,o[1]+dy/n*30];ctx.strokeStyle=axisColors[a.key];ctx.fillStyle=axisColors[a.key];ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(...o);ctx.lineTo(...p);ctx.stroke();ctx.fillText(a.key,p[0]+dx/n*10,p[1]+dy/n*10);}
 }
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#526e7b';ctx.font='10px sans-serif';ctx.fillText('外装を省いた構造模式図',width/2,height-15);
}
function drawThumbnails(){const previous=positions;positions={X:0,Y:0,Z:0,A:0,C:0};machines.forEach(m=>render($('thumb-'+m.id),m,-.55,false,-1));positions=previous;}
function drawScene(){if(page==='training')render($('scene'),current,yaw,$('labels').checked,selected);}
function rotate(delta){yaw+=delta;drawScene();}
$('rotateLeft').onclick=()=>rotate(-Math.PI/12);$('rotateRight').onclick=()=>rotate(Math.PI/12);$('viewReset').onclick=()=>{yaw=0;drawScene()};$('labels').onchange=drawScene;$('showAxes').onchange=drawScene;
$('measurePos').onchange=()=>{$('bubbleText').textContent=`${$('measurePos').selectedOptions[0].textContent}に置いた水準器の表示例（測定値は未計算）`;};
let drag=null;
$('scene').addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};$('scene').setPointerCapture(e.pointerId);});
$('scene').addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x;if(Math.abs(dx)>2)drag.moved=true;rotate(dx*.009);drag.x=e.clientX;});
function endDrag(e){if(drag&&drag.id===e.pointerId){drag=null;}}
$('scene').addEventListener('pointerup',endDrag);$('scene').addEventListener('pointercancel',endDrag);$('scene').addEventListener('lostpointercapture',()=>drag=null);
$('scene').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();rotate(e.key==='ArrowLeft'?-.12:.12)}});
function buildModeUI(){
 const base=machines.find(m=>m.id===current.id),box=$('machineModeBox');box.hidden=!base.modes;
 const select=$('machineMode');select.replaceChildren();(base.modes||[]).forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);});select.value=machineMode;
}
$('machineMode').onchange=()=>{stopMotion();machineMode=$('machineMode').value;current=displayMachine(machines.find(m=>m.id===current.id));positions={X:0,Y:0,Z:0,A:0,C:0};selectedAxis='X';selected=0;populateMachine();drawScene();};
function buildAxisUI(){
 const axes=axisConfig(current);$('axisTabs').replaceChildren();$('axisSliders').replaceChildren();
 axes.forEach(a=>{const btn=document.createElement('button');btn.textContent=a.key+'軸';btn.className='axis-tab';btn.style.setProperty('--axis',axisColors[a.key]);btn.setAttribute('aria-pressed',a.key===selectedAxis?'true':'false');btn.onclick=()=>selectAxis(a.key);$('axisTabs').append(btn);
 const row=document.createElement('div');row.className='axis-row';row.style.setProperty('--axis',axisColors[a.key]);row.innerHTML=`<label for="axis-${a.key}"><strong>${a.key}軸</strong><span>${a.part}<small>${a.direction}</small></span><output id="value-${a.key}">中央</output></label><input type="range" id="axis-${a.key}" min="-100" max="100" step="1" value="${positions[a.key]}" aria-label="${a.key}軸の部品位置"><div class="range-ends"><span>端1</span><span>端2</span></div>`;$('axisSliders').append(row);
 $('axis-'+a.key).addEventListener('input',e=>{stopMotion();positions[a.key]=Number(e.target.value);selectAxis(a.key);updateAxisValues();drawScene();});});
 $('fixedText').textContent=fixedParts(current);$('absentAxis').hidden=current.kind!=='lathe';updateAxisValues();selectAxis(selectedAxis);
}
function updateAxisValues(){for(const a of axisConfig(current)){$('axis-'+a.key).value=positions[a.key];$('value-'+a.key).textContent=positions[a.key]===0?'中央':positions[a.key]>0?'端2側 '+Math.abs(Math.round(positions[a.key]))+'%':'端1側 '+Math.abs(Math.round(positions[a.key]))+'%';}}
function updatePartMap(){
 const parts=createGeometry(current).labels;
 const moving=parts.filter(p=>p.axes.includes(selectedAxis));
 $('movingParts').replaceChildren();moving.forEach(p=>{const chip=document.createElement('span');chip.className='part-chip';chip.textContent=p.name;$('movingParts').append(chip);});
 $('movingParts').style.setProperty('--axis',axisColors[selectedAxis]);
 $('partMapHeading').textContent=selectedAxis+'軸で一緒に動く主な部品';
 $('partMapBody').replaceChildren();
 parts.forEach(p=>{const row=document.createElement('tr'),name=document.createElement('th'),axes=document.createElement('td'),state=document.createElement('td');name.setAttribute('scope','row');name.textContent=p.name;
 p.axes.forEach(key=>{const badge=document.createElement('span');badge.className='part-axis'+(key===selectedAxis?' selected':'');badge.style.setProperty('--axis',axisColors[key]);badge.textContent=key;axes.append(badge);});
 if(!p.axes.length)axes.textContent='固定';
 const moves=p.axes.includes(selectedAxis);row.className=moves?'moving-part':'';row.style.setProperty('--axis',axisColors[selectedAxis]);state.textContent=moves?'一緒に動く':'今回静止';row.append(name);row.append(axes);row.append(state);$('partMapBody').append(row);
 });
 $('partStateHeading').textContent=selectedAxis+'軸を動かすと';
}
function selectAxis(key){stopMotion();selectedAxis=key;const a=axisConfig(current).find(a=>a.key===key);Array.from($('axisTabs').children).forEach(b=>b.setAttribute('aria-pressed',b.textContent===key+'軸'?'true':'false'));$('movingText').textContent=key+'軸：'+a.part+'が'+a.direction+'に動く';$('movingText').style.setProperty('--axis',axisColors[key]);updatePartMap();drawScene();}
let motionFrame=null,motionStart=null;
function stopMotion(){if(motionFrame!==null)cancelAnimationFrame(motionFrame);motionFrame=null;motionStart=null;if($('playAxis')){$('playAxis').textContent='選んだ軸を動かす';$('playAxis').setAttribute('aria-pressed','false');}}
$('playAxis').onclick=()=>{if(motionFrame!==null){stopMotion();return;}$('playAxis').textContent='動きを止める';$('playAxis').setAttribute('aria-pressed','true');const key=selectedAxis;
 // A single round trip demonstrates the chosen part; no endless motion.
 function step(t){if(motionStart===null)motionStart=t;const progress=Math.min((t-motionStart)/3500,1);positions[key]=Math.sin(progress*2*Math.PI)*85;updateAxisValues();drawScene();if(progress<1)motionFrame=requestAnimationFrame(step);else{positions[key]=0;updateAxisValues();stopMotion();drawScene();}}
 motionFrame=requestAnimationFrame(step);
};
$('resetAxes').onclick=()=>{stopMotion();positions={X:0,Y:0,Z:0,A:0,C:0};updateAxisValues();drawScene();};
window.addEventListener('pagehide',stopMotion);document.addEventListener('visibilitychange',()=>{if(document.hidden)stopMotion();});
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(page==='catalog')drawThumbnails();drawScene();},80);});
navigate('home');

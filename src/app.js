'use strict';
// 編集する場合、機械の名称・説明・モデル種別はこの一覧で変更できます。
const machines = [
{id:'compact',name:'ロボドリル系・小型立形',tag:'小型 / 主軸が縦',example:'代表例：FANUC ROBODRILL',kind:'compact',w:2.3,d:2.6,grid:[2,2],structure:'後方のコラムに縦向きの主軸、手前にテーブルを持つ小型切削加工機の模式図。穴あけ・タップ・小物部品の加工をイメージしています。',motion:'テーブル側の左右・前後移動と、主軸頭の上下移動を示す一般化した構造。',focus:'左右・前後の傾きと、測定位置を変えたときの水準器の差。',impact:'全体が一緒に傾くことと、ベッドがねじれて案内の関係が変わることを分けて学びます。',source:'https://www.fanuc.co.jp/ja/product/robodrill/alphadibplus.html'},
{id:'vertical',name:'標準立形・片側コラム',tag:'立形 / 片側で支える',example:'代表例：Haas VFシリーズ',kind:'vertical',w:3.4,d:3.3,grid:[2,2],structure:'後方に1本のコラムが立ち、主軸頭がテーブルに向かって張り出す構造。外装を省き、ベース・コラム・テーブルの位置関係を見せています。',motion:'テーブル側の左右・前後移動、主軸頭の上下移動。',focus:'中央の水平だけでなく、テーブル移動範囲で傾きが変わらないか。',impact:'ねじれは案内面の姿勢や軸間の関係に影響する可能性があります。真直度・直角度は別途確認します。',source:'https://www.haascnc.com/machines/vertical-mills/vf-series/models/small/vf-2.html'},
{id:'portal',name:'門形構造の立形',tag:'立形 / 両側で支える',example:'代表例：オークマ GENOS M',kind:'portal',w:3.3,d:3.2,grid:[2,2],structure:'左右のコラムと上部の梁で主軸側を支える立形の模式図。「立形」という分類の中にも門形構造の機械があります。',motion:'本図はテーブルの左右・前後移動と、主軸頭の上下移動を示す一般化した模式図。',focus:'左右コラムを支えるベースの姿勢と、移動範囲での傾きの変化。',impact:'両側で支える構造でも据付状態の確認が必要です。水平が出たことだけでは加工精度を保証しません。',source:'https://www.okuma.co.jp/product/genos_m/'},
{id:'horizontal',name:'横形マシニングセンタ',tag:'横マシ / 主軸が横',example:'代表例：牧野フライス a51nx',kind:'horizontal',w:3.4,d:3.6,grid:[2,2],structure:'横向きの主軸と、その前に置いたパレット・回転テーブルが特徴。立形とは主軸とワークの向きが異なります。',motion:'直線軸の移動と、パレット側のB軸回転。直線軸の分担は機種により異なります。',focus:'ベースの姿勢と、主軸側・パレット側の相対関係。',impact:'主軸とテーブルの関係、回転軸を含む幾何精度を確認する必要があります。パレット交換精度も独立した確認項目です。',source:'https://www.makino.co.jp/ja-jp/machine-technology/machines/horizontal-4-axis/a51nx'},
{id:'travel',name:'移動コラム形・立形',tag:'長尺 / テーブル固定',example:'代表例：マザック VTC',kind:'travel',w:5.4,d:2.6,grid:[3,2],structure:'長い固定テーブルの後ろをコラム・主軸側が移動する構造。重いワークをテーブルごと動かさずに加工できます。',motion:'コラム・主軸側が長手方向へ移動。テーブルは固定。',focus:'長いベッドの端・中央と、コラムの移動位置ごとの姿勢。',impact:'長手方向の案内精度や位置による姿勢変化が学習対象です。端だけの測定では中間部を評価できません。',source:'https://www.mazak.com/jp-ja/products/vtc/'},
{id:'double',name:'固定門形・テーブル移動',tag:'門形 / 大型・多点支持',example:'代表例：芝浦機械 MPC系',kind:'double',w:4.0,d:5.8,grid:[2,3],structure:'左右のコラムと梁からなる門を固定し、長いテーブルが門の下を通る構造。大型部品や金型などを想定しています。',motion:'テーブルが長手方向へ移動。主軸頭が梁に沿って横移動し、ラムが上下移動。',focus:'長いベッドの各位置と、左右コラム側の支持・基礎。',impact:'ベッドの変形や左右差を確認します。梁のたわみなど、レベル調整だけで解決しない幾何誤差もあります。',source:'https://www.shibaura-machine.co.jp/jp/product/machinetool/lineup/m_new/Line_up.html'},
{id:'gantry',name:'移動門形・ガントリー',tag:'門形 / 門が移動',example:'代表例：芝浦機械 MG系',kind:'gantry',w:4.0,d:5.8,grid:[2,4],structure:'ワークを置くテーブルは固定し、左右のレール上を門全体が移動する構造。固定門形とは動く部分が異なります。',motion:'門全体が長手方向へ移動。主軸頭の横移動とラムの上下移動。',focus:'左右レールの高さ・姿勢と、移動範囲に沿った支持・基礎。',impact:'左右レールの関係は門の姿勢に影響する可能性があります。同期駆動や機械固有の調整も別途必要です。',source:'https://www.shibaura-machine.co.jp/jp/product/machinetool/lineup/s_new/spec.html'},
{id:'five',name:'5軸・テーブル旋回形',tag:'5軸 / 回転軸あり',example:'代表例：DMG MORI DMU系',kind:'five',w:3.4,d:3.3,grid:null,structure:'縦向きの主軸に加え、テーブル側が傾き・回転する5軸構造の模式図。支持点数も機種により異なり、本図は3点支持のUIを示します。',motion:'直線3軸に加え、テーブル側の傾斜・回転。具体的な軸名と構造は機種によります。',focus:'指定支持点での据付と、直線軸・回転軸の相対関係。',impact:'据付の後に回転中心や旋回軸の幾何関係を確認します。レベル出しだけで5軸の姿勢精度は決まりません。',source:'https://us.dmgmori.com/products/machines/milling/5-axis-milling/monoblock/dmu-75-monoblock-2nd'},
{id:'lathe',name:'NC旋盤',tag:'旋盤 / 長いベッド',example:'代表例：Haas STシリーズ',kind:'lathe',w:5.0,d:2.1,grid:[3,2],structure:'左に主軸台、右に心押台、間に刃物台を持つ旋盤の模式図。長手方向を軸としてワークが回転します。心押台の有無は実機により異なります。',motion:'ワークを主軸で回転。刃物台が主軸方向・径方向へ移動。',focus:'ベッド長手方向の各位置で、横断方向の水準器の値が変わらないか。',impact:'ベッドのねじれは案内と主軸の関係に影響する可能性があります。テーパの原因には工具・熱・ワークのたわみなどもあります。',source:'https://www.haascnc.com/service/troubleshooting-and-how-to/how-to/st-lathe-installation---ngc.html'}
];
const $=id=>document.getElementById(id);
let current=machines[0], page='home', yaw=-0.45, selected=0, supports=[];
function supportList(m){
 if(!m.grid)return [{x:-m.w*.4,z:-m.d*.4,name:'左・手前'},{x:m.w*.4,z:-m.d*.4,name:'右・手前'},{x:0,z:m.d*.4,name:'奥・中央'}];
 const [nx,nz]=m.grid,list=[];
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++)list.push({x:(i/(nx-1)-.5)*m.w*.8,z:(j/(nz-1)-.5)*m.d*.8,name:`${nx===2?(i?'右':'左'):(['左','中央','右'][i])}・${j===0?'手前':j===nz-1?'奥':`中間${j}`}`});
 return list;
}
function navigate(next){
 page=next; for(const id of ['home','topics','catalog','training'])$(id).hidden=id!==next;
 const paths=[['home','トップ'],['topics','機械'],['catalog','レベル出し'],['training',current.name]];
 const depth=['home','topics','catalog','training'].indexOf(next);
 $('crumbs').replaceChildren();paths.slice(0,depth+1).forEach(([dest,label],i)=>{if(i){const s=document.createElement('span');s.textContent='›';$('crumbs').append(s);}const el=document.createElement(i===depth?'span':'button');el.textContent=label;if(i!==depth)el.onclick=()=>navigate(dest);$('crumbs').append(el);});
 window.scrollTo({top:0,behavior:'instant'}); if(next==='catalog')requestAnimationFrame(drawThumbnails);if(next==='training')requestAnimationFrame(drawScene);
}
$('mechanical').onclick=()=>navigate('topics');$('electric').onclick=()=>{$('electricNote').hidden=false};$('leveling').onclick=()=>navigate('catalog');$('changeMachine').onclick=()=>navigate('catalog');
function openMachine(m){
 current=m;selected=0;yaw=-.45;supports=supportList(m);
 $('machineTitle').textContent=m.name;$('machineSubtitle').textContent=m.example+' ｜ '+m.tag;
 $('structureText').textContent=m.structure;$('motionText').textContent=m.motion;$('focusText').textContent=m.focus;
 $('impactText').textContent=m.impact;$('supportNote').textContent=`本図は学習用の${supports.length}点支持です。実機の支持点位置・個数・荷重配分を再現したものではありません。`;
 $('sourceLinks').innerHTML=`<div class="source-links"><a href="${m.source}" target="_blank" rel="noopener noreferrer">メーカー公式資料で代表例を確認 ↗</a></div>`;
 $('measurePos').value='0'; $('labels').checked=true;
 ['lr','fb','twist'].forEach(id=>$(id).textContent='— mm/m');$('residual').textContent='— mm';$('diagnosis').innerHTML='<p class="diagnosis-item neutral">訓練計算は今後追加。現在は画面構成を確認できます。</p>';
 $('bubbleText').textContent='中央に置いた水準器の表示例（測定値は未計算）';
 buildSupports();navigate('training');
}
function selectSupport(i){selected=i;buildSupports();drawScene();}
function buildSupports(){
 const map=$('supportMap');map.replaceChildren();const caption=document.createElement('div');caption.className='map-caption';caption.textContent='奥 ｜ 上から見た支持点配置';map.append(caption);
 const groups=current.grid?Array.from({length:current.grid[1]},(_,j)=>supports.map((s,i)=>({s,i})).filter(v=>Math.floor(v.i/current.grid[0])===j)).reverse():[[{s:supports[2],i:2}],[{s:supports[0],i:0},{s:supports[1],i:1}]];
 groups.forEach(group=>{const row=document.createElement('div');row.className='map-row';group.forEach(({s,i})=>{const b=document.createElement('button');b.className='map-point'+(selected===i?' active':'');b.textContent=String.fromCharCode(65+i);b.setAttribute('aria-label',s.name+'の支持点を選択');b.setAttribute('aria-pressed',selected===i?'true':'false');b.onclick=()=>selectSupport(i);row.append(b);});map.append(row);});const front=document.createElement('div');front.className='map-caption';front.textContent='手前';map.append(front);
 const controls=$('supportControls');controls.replaceChildren();supports.forEach((s,i)=>{const row=document.createElement('div');row.className='support-row'+(i===selected?' selected':'');const id=String.fromCharCode(65+i);row.innerHTML=`<label for="height${i}"><span class="point-id">${id}</span>${s.name}</label><button disabled aria-label="${id}を下げる">−</button><input id="height${i}" aria-label="${id}の高さ mm" value="0.00 mm" disabled><button disabled aria-label="${id}を上げる">＋</button>`;controls.append(row);});
}
const grid=$('machineGrid');machines.forEach(m=>{const card=document.createElement('button');card.className='machine-card';card.setAttribute('aria-label',m.name+'の訓練画面へ');card.innerHTML=`<canvas class="thumbnail" id="thumb-${m.id}" aria-label="${m.name}の構造模式図"></canvas><div class="content"><span class="pill">${m.tag}</span><h2>${m.name}</h2><p>${m.example}</p><span class="go">この構造を見てみる →</span></div>`;card.onclick=()=>openMachine(m);grid.append(card);});
// 外部ライブラリ不要。立体の面を投影し、奥から順に描く軽量な3D模式図。
function createGeometry(m){
 const faces=[],labels=[],c={base:'#8da1b0',fixed:'#49718a',table:'#46a18f',spindle:'#edb164',rail:'#d2e0e4',work:'#c5d5d2'};
 function box(x,y,z,w,h,d,color,label){const v=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([a,b,e])=>[x+a*w/2,y+b*h/2,z+e*d/2]);[[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]].forEach((ix,i)=>faces.push({v:ix.map(j=>v[j]),color,shade:[.83,.85,.65,1.08,.88,.94][i]}));if(label)labels.push({p:[x,y+h/2,z],text:label});}
 function cyl(x,y,z,r,len,color,axis='y',label){const n=24,ring=[[],[]];for(let k=0;k<2;k++)for(let i=0;i<n;i++){const a=i*2*Math.PI/n,cs=Math.cos(a)*r,sn=Math.sin(a)*r,t=(k-.5)*len;ring[k].push(axis==='x'?[x+t,y+cs,z+sn]:axis==='z'?[x+cs,y+sn,z+t]:[x+cs,y+t,z+sn]);}faces.push({v:ring[0],color,shade:.8},{v:ring[1],color,shade:1.08});for(let i=0;i<n;i++)faces.push({v:[ring[0][i],ring[0][(i+1)%n],ring[1][(i+1)%n],ring[1][i]],color,shade:.78+.25*(Math.cos(i*2*Math.PI/n)+1)/2});if(label)labels.push({p:[x,y+r+.12,z],text:label});}
 box(0,.42,0,m.w,.45,m.d,c.base,'ベース');
 const W=m.w,D=m.d;
 if(['compact','vertical','travel'].includes(m.kind)){
 const cx=m.kind==='travel'?-.7:0;
 box(cx,1.95,D*.27,m.kind==='compact'?.7:.95,2.55,.8,c.fixed,'コラム');box(cx,2.8,0,.8,.7,1.1,c.fixed);cyl(cx,2.23,-.32,.18,.5,c.spindle,'y','主軸');cyl(cx,1.86,-.32,.055,.25,c.spindle);
 box(0,1.02,-D*.15,m.kind==='travel'?W*.91:W*.79,.24,D*.45,c.table,'テーブル');box(0,.78,-D*.1,W*.5,.27,D*.48,c.fixed);
 for(let i=-3;i<=3;i++)box(i*W*.09,1.15,-D*.15,.018,.016,D*.44,c.rail);
 if(m.kind==='travel'){box(0,.74,D*.31,W*.94,.13,.12,c.rail);box(0,.74,D*.16,W*.94,.13,.12,c.rail);}
 }else if(['portal','double','gantry'].includes(m.kind)){
 const gateZ=m.kind==='portal'?D*.24:.1;
 [-1,1].forEach(s=>box(s*W*.39,1.94,gateZ,.55,2.6,.7,c.fixed,s===-1?'門／コラム':null));box(0,3.16,gateZ,W*.93,.6,.7,c.fixed);box(.2,2.67,gateZ-.1,.6,.9,.6,c.fixed);cyl(.2,2.1,gateZ-.1,.16,.5,c.spindle,'y','主軸');cyl(.2,1.75,gateZ-.1,.05,.24,c.spindle);box(0,1.0,0,W*.57,.24,D*.8,c.table,'テーブル');
 if(m.kind==='gantry')[-1,1].forEach(s=>box(s*W*.4,.74,0,.16,.13,D*.95,c.rail,s===1?'走行レール':null));else [-1,1].forEach(s=>box(s*W*.16,.75,0,.1,.12,D*.93,c.rail));
 }else if(m.kind==='horizontal'){
 box(0,1.85,D*.25,1.0,2.4,.9,c.fixed,'コラム');box(0,2.07,.14,.86,.7,1.1,c.fixed);cyl(0,2.0,-.5,.22,.65,c.spindle,'z','横向き主軸');cyl(0,2,-.93,.06,.22,c.spindle,'z');cyl(0,.95,-.8,.8,.42,c.table,'y','回転テーブル');box(0,1.22,-.8,1.48,.14,1.48,c.table);box(0,1.68,-.83,.74,.82,.75,c.work,'ワーク');
 }else if(m.kind==='five'){
 box(0,1.91,D*.29,1.12,2.5,.8,c.fixed,'コラム');box(0,2.7,0,.85,.8,1.15,c.fixed);cyl(0,2.18,-.3,.18,.44,c.spindle,'y','主軸');cyl(0,1.85,-.3,.045,.2,c.spindle);
 [-1,1].forEach(s=>box(s*.95,1.17,-.45,.32,.65,1.1,c.fixed));cyl(0,1.24,-.45,.36,1.6,c.table,'x');cyl(0,1.51,-.45,.68,.14,c.table,'y','旋回テーブル');box(0,1.7,-.45,.55,.28,.52,c.work);
 }else if(m.kind==='lathe'){
 [-1,1].forEach(s=>box(0,.73,s*.4,W*.93,.12,.14,c.rail));box(-W*.33,1.24,0,.92,1.3,1.26,c.fixed,'主軸台');cyl(-W*.21,1.5,0,.43,.22,c.spindle,'x','チャック');cyl(0,1.5,0,.16,W*.43,c.work,'x');box(W*.31,1.13,0,.6,.93,.7,c.fixed,'心押台');cyl(W*.19,1.5,0,.12,.48,c.spindle,'x');box(.12,1.18,-.6,.7,.64,.6,c.table,'刃物台');
 }
 supportList(m).forEach(s=>{cyl(s.x,.18,s.z,.14,.23,'#7d8991');cyl(s.x,.07,s.z,.24,.09,'#52616d');});
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
 const points=model.faces.flatMap(f=>f.v.map(project));const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));
 const margin=showLabels?58:20,scale=Math.min((width-margin*2)/(maxX-minX),(height-75)/(maxY-minY));const cx=width/2-(minX+maxX)*scale/2,cy=height*.48-(minY+maxY)*scale/2;
 const screen=p=>{const q=project(p);return [cx+q[0]*scale,cy+q[1]*scale,q[2]]};
 // 地面は回転に追従する格子。モデルを動かさず視点だけを左右に回す。
 ctx.strokeStyle='#d7e1e5';ctx.lineWidth=.7;
 for(let i=-4;i<=4;i++){for(const pair of [[[i,0,-4],[i,0,4]],[[-4,0,i],[4,0,i]]]){const a=screen(pair[0]),b=screen(pair[1]);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();}}
 model.faces.map(f=>({...f,p:f.v.map(screen)})).sort((a,b)=>b.p.reduce((s,p)=>s+p[2],0)/b.p.length-a.p.reduce((s,p)=>s+p[2],0)/a.p.length).forEach(f=>{ctx.beginPath();f.p.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fillStyle=tone(f.color,f.shade);ctx.fill();ctx.strokeStyle='#35546933';ctx.lineWidth=.6;ctx.stroke();});
 if(active>=0){supportList(m).forEach((s,i)=>{const p=screen([s.x,.15,s.z]);ctx.beginPath();ctx.arc(p[0],p[1]+10,13,0,Math.PI*2);ctx.fillStyle=active===i?'#ffda79':'#ffffffed';ctx.fill();ctx.strokeStyle=active===i?'#ba8d20':'#80949f';ctx.lineWidth=active===i?2:1;ctx.stroke();ctx.fillStyle='#23404e';ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String.fromCharCode(65+i),p[0],p[1]+10);});}
 if(showLabels){
 const labs=model.labels.map(l=>({...l,screen:screen(l.p)}));const sides=[labs.filter(l=>l.screen[0]<width/2),labs.filter(l=>l.screen[0]>=width/2)];
 sides.forEach((side,k)=>{side.sort((a,b)=>a.screen[1]-b.screen[1]);let last=15;side.forEach(l=>{let ly=Math.max(last+24,Math.min(height-40,l.screen[1]-8));last=ly;const lx=k?width-10:10;ctx.strokeStyle='#65818b99';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(l.screen[0],l.screen[1]);ctx.lineTo(k?lx-5:lx+5,ly);ctx.stroke();ctx.font='11px sans-serif';ctx.textAlign=k?'right':'left';ctx.textBaseline='middle';const tw=ctx.measureText(l.text).width;ctx.fillStyle='#f8fbf9ed';ctx.fillRect(k?lx-tw-4:lx-4,ly-9,tw+8,18);ctx.fillStyle='#365564';ctx.fillText(l.text,lx,ly);});});
 }
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#526e7b';ctx.font='10px sans-serif';ctx.fillText('外装を省いた構造模式図',width/2,height-15);
}
function drawThumbnails(){machines.forEach(m=>render($('thumb-'+m.id),m,-.55,false,-1));}
function drawScene(){if(page==='training')render($('scene'),current,yaw,$('labels').checked,selected);}
function rotate(delta){yaw+=delta;drawScene();}
$('rotateLeft').onclick=()=>rotate(-Math.PI/12);$('rotateRight').onclick=()=>rotate(Math.PI/12);$('viewReset').onclick=()=>{yaw=0;drawScene()};$('labels').onchange=drawScene;
$('measurePos').onchange=()=>{$('bubbleText').textContent=`${$('measurePos').selectedOptions[0].textContent}に置いた水準器の表示例（測定値は未計算）`;};
let drag=null;
$('scene').addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};$('scene').setPointerCapture(e.pointerId);});
$('scene').addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x;if(Math.abs(dx)>2)drag.moved=true;rotate(dx*.009);drag.x=e.clientX;});
function endDrag(e){if(drag&&drag.id===e.pointerId){drag=null;}}
$('scene').addEventListener('pointerup',endDrag);$('scene').addEventListener('pointercancel',endDrag);$('scene').addEventListener('lostpointercapture',()=>drag=null);
$('scene').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();rotate(e.key==='ArrowLeft'?-.12:.12)}});
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(page==='catalog')drawThumbnails();drawScene();},80);});
navigate('home');

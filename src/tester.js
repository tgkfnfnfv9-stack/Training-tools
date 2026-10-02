(()=>{
  'use strict';
  const root=document.getElementById('tester');
  if(!root)return;
  const $=id=>document.getElementById(id);
  const lessons={
    voltage:{title:'乾電池のDC電圧',mode:'dcv',goal:'1.5Vの乾電池を、DC電圧モードで測ってみましょう。',connection:'電圧は対象の両端へ並列接続。赤を＋、黒を−に当てます。',steps:['黒をCOM、赤をVΩに差す。','V⎓（DC電圧）を選ぶ。','赤を電池の＋、黒を−へ当て、単位Vと符号を読む。','プローブを離してからOFFに戻す。'],interpretation:'この教材の値は1.500 V。赤と黒を逆にすると−1.500 Vになり、極性が逆であることが分かります。値だけで電池の負荷時性能までは判断できません。'},
    resistance:{title:'単体抵抗の抵抗値',mode:'ohm',goal:'電源から切り離された1kΩの単体抵抗を測りましょう。',connection:'電源・残留電圧がないことを確認し、抵抗の両端へ当てます。',steps:['対象の電源を切り離し、残留電圧がないことを確認する。','黒をCOM、赤をVΩに差し、Ω（抵抗）を選ぶ。','単体抵抗の両端へ当て、kΩの単位も読む。','プローブを離してからOFFに戻す。'],interpretation:'この教材の値は1.000 kΩ＝1000 Ω。赤と黒の向きは問いません。回路につながったままでは、並列経路の影響で単体の抵抗値とは異なることがあります。'},
    continuity:{title:'配線の導通確認',mode:'beep',goal:'電源のない配線で、「つながる」と「切れる」を比較しましょう。',connection:'電源・残留電圧がないことを確認し、配線の両端へ当てます。',steps:['配線を電源から外し、残留電圧がないことを確認する。','黒をCOM、赤をVΩに差し、導通（ブザー）を選ぶ。','配線の両端へ当て、表示とブザーの有無を確認する。','プローブを離してから「途中で切れている」に替え、もう一度測る。'],interpretation:'つながる配線は0.3 Ω・ブザーあり、断線はOL・ブザーなしの模擬表示です。OLはこの教材では測定範囲を超える開放状態です。ブザーのしきい値は機種により違い、鳴るだけで配線の品質を保証するものではありません。'}
  };
  let state={lesson:'voltage',mode:'off',black:'none',red:'none',prepared:false,polarity:'normal',wire:'connected',measured:false,status:'idle',message:'下の操作欄で、リードと測定モードを選びましょう。'};
  const modes={off:'OFF',dcv:'V⎓',ohm:'Ω',beep:'導通'};
  function reading(){
    if(!state.measured)return state.mode==='off'?'OFF':'—';
    if(state.lesson==='voltage')return state.polarity==='reverse'?'−1.500 V':'1.500 V';
    if(state.lesson==='resistance')return '1.000 kΩ';
    return state.wire==='broken'?'OL':'0.3 Ω';
  }
  function fresh(message='設定を確認し、プローブを両端に当てて測りましょう。'){
    state.measured=false;state.status='idle';state.message=message;render();
  }
  function renderDiagram(){
    const measured=state.measured,reverse=state.lesson==='voltage'&&state.polarity==='reverse';
    const redX=reverse?535:350,blackX=reverse?350:535;
    const targetY=155,probeY=measured?targetY:214;
    const redJack=state.red==='a'?60:174;
    let target;
    if(state.lesson==='voltage'){
      target='<rect x="368" y="116" width="151" height="79" rx="10" fill="#eef0da" stroke="#879260" stroke-width="3"/><rect x="350" y="135" width="18" height="40" rx="3" fill="#bdc5a0" stroke="#879260" stroke-width="2"/><path d="M519 155H535" stroke="#687a82" stroke-width="4"/><text x="400" y="149" font-size="23" font-weight="700">1.5 V</text><text x="409" y="177" font-size="16">乾電池</text><text x="341" y="119" font-size="24" fill="#bb3636">＋</text><text x="524" y="120" font-size="26">−</text>';
    }else if(state.lesson==='resistance'){
      target='<path d="M350 155H400M488 155H535" stroke="#687a82" stroke-width="4"/><rect x="400" y="135" width="88" height="40" rx="5" fill="#e5d7a9" stroke="#8b774b" stroke-width="3"/><path d="M413 136V174" stroke="#8b4513" stroke-width="5"/><path d="M431 136V174" stroke="#222222" stroke-width="5"/><path d="M449 136V174" stroke="#c64242" stroke-width="5"/><path d="M477 136V174" stroke="#c5a342" stroke-width="4"/><text x="400" y="116" font-size="21" font-weight="700">1 kΩ</text><text x="373" y="200" font-size="15">電源から切り離した抵抗</text>';
    }else{
      target=state.wire==='broken'?'<path d="M350 155H429M459 155H535" stroke="#3a7370" stroke-width="7"/><path d="M435 145L448 166M447 145L434 166" stroke="#bd633b" stroke-width="3"/><text x="406" y="118" font-size="21" font-weight="700">断線</text>':'<path d="M350 155H535" stroke="#3a7370" stroke-width="7"/><text x="389" y="118" font-size="21" font-weight="700">導通する配線</text>';
      target+='<text x="389" y="199" font-size="15">電源のない配線</text>';
    }
    const angle={off:-65,dcv:-20,ohm:35,beep:75}[state.mode];
    const blackWire=state.black==='com'?`<path d="M117 218V270H${blackX}V${probeY}" fill="none" stroke="#2e3c47" stroke-width="5" stroke-linejoin="round"/><circle cx="117" cy="218" r="6" fill="#2e3c47"/>`:'';
    const redWire=state.red!=='none'?`<path d="M${redJack} 218V248H${redX}V${probeY}" fill="none" stroke="#c64242" stroke-width="5" stroke-linejoin="round"/><circle cx="${redJack}" cy="218" r="6" fill="#c64242"/>`:'';
    const probes=(state.black==='com'?`<rect x="${blackX-5}" y="${probeY+3}" width="10" height="20" rx="3" fill="#2e3c47"/><path d="M${blackX} ${probeY}v8" stroke="#8b9ca5" stroke-width="3"/>`:'')+(state.red!=='none'?`<rect x="${redX-5}" y="${probeY+3}" width="10" height="20" rx="3" fill="#c64242"/><path d="M${redX} ${probeY}v8" stroke="#8b9ca5" stroke-width="3"/>`:'');
    const beep=measured&&state.lesson==='continuity'&&state.wire==='connected';
    const description=`${lessons[state.lesson].title}。黒リードは${state.black==='com'?'COM':'未接続'}、赤リードは${state.red==='vohm'?'VΩ':state.red==='a'?'電流用A':'未接続'}。モード${modes[state.mode]}。${measured?'プローブを両端に接続し、表示'+reading():'プローブを対象から離した状態'}。${beep?'模擬ブザーあり':''}`;
    $('testerDiagram').innerHTML=`<title id="testerSvgTitle">テスターと測定対象の接続図</title><desc id="testerSvgDesc">${description}</desc><g fill="#203a47" font-family="system-ui,sans-serif"><rect x="25" y="17" width="189" height="215" rx="16" fill="#dbc45a" stroke="#a18f36" stroke-width="3"/><rect x="42" y="37" width="155" height="51" rx="5" fill="#e5eed7" stroke="#738363"/><text x="120" y="71" text-anchor="middle" font-family="monospace" font-size="24" font-weight="700">${reading()}</text><text x="57" y="119" font-size="13">OFF</text><text x="105" y="106" font-size="15">V⎓</text><text x="165" y="121" font-size="16">Ω</text><text x="169" y="152" font-size="12">導通</text><circle cx="119" cy="143" r="27" fill="#495b64"/><path d="M119 157V125" stroke="#faf6d9" stroke-width="6" stroke-linecap="round" transform="rotate(${angle} 119 143)"/><text x="49" y="191" font-size="15">A</text><text x="99" y="191" font-size="14">COM</text><text x="157" y="191" font-size="14">VΩ</text><circle cx="60" cy="213" r="9" fill="#883f37"/><circle cx="117" cy="213" r="9" fill="#283945"/><circle cx="174" cy="213" r="9" fill="#883f37"/>${target}${blackWire}${redWire}${probes}<circle cx="350" cy="155" r="5" fill="#879ca7"/><circle cx="535" cy="155" r="5" fill="#879ca7"/><text x="328" y="40" font-size="16" font-weight="650">測定対象の両端へ接続</text><text x="371" y="68" font-size="14">${state.lesson==='voltage'?'電圧は並列': '電源なし・残留電圧なし'}</text>${beep?'<text x="353" y="290" font-size="17" fill="#166f62" font-weight="700">♪ ブザーあり（表示のみ）</text>':''}</g>`;
  }
  function render(){
    const lesson=lessons[state.lesson];
    $('testerVisualTitle').textContent=lesson.title;
    $('testerGoal').textContent=lesson.goal;
    $('testerConnectionHint').textContent=lesson.connection;
    $('testerSteps').innerHTML=lesson.steps.map(text=>`<li>${text}</li>`).join('');
    $('testerInterpretation').textContent=lesson.interpretation;
    $('testerPreparationBox').hidden=state.lesson==='voltage';
    $('testerPolarityBox').hidden=state.lesson!=='voltage';
    $('testerWireBox').hidden=state.lesson!=='continuity';
    $('testerBlackLead').value=state.black;$('testerRedLead').value=state.red;
    $('testerPrepared').checked=state.prepared;$('testerPolarity').value=state.polarity;$('testerWire').value=state.wire;
    $('testerJackNotice').hidden=state.red!=='a';
    root.querySelectorAll('[data-tester-case]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.testerCase===state.lesson)));
    root.querySelectorAll('[data-tester-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.testerMode===state.mode)));
    $('testerReadout').dataset.status=state.status;
    $('testerResult').textContent=state.measured?reading()+(state.lesson==='continuity'?(state.wire==='connected'?' · ブザーあり':' · ブザーなし'):''):state.status==='blocked'?'設定を確認':'未測定';
    $('testerFeedback').textContent=state.status==='blocked'?'設定を確認してください。理由は下の操作欄へ。':state.measured?'単位と符号を確認し、測定後はプローブを離します。':'リードとモードを選び、下の操作欄で測定します。';
    $('testerFeedbackDetail').textContent=state.message;$('testerFeedbackDetail').dataset.status=state.status;
    for(const id of ['testerBlackLead','testerRedLead','testerPrepared','testerPolarity','testerWire'])$(id).disabled=state.measured;
    root.querySelectorAll('[data-tester-mode]').forEach(button=>button.disabled=state.measured);
    root.querySelectorAll('[data-tester-case]').forEach(button=>button.disabled=state.measured);
    $('testerMeasure').disabled=state.measured;$('testerMeasure').textContent=state.measured?'測定中 · プローブを離して終了':'プローブを両端に当てて測る';$('testerDisconnect').disabled=!state.measured;
    renderDiagram();
  }
  function measure(){
    let warning='';
    if(state.red==='a')warning='赤リードが電流用A端子です。電池や部品の両端への接続は短絡につながるため、VΩへ差し替えてください。';
    else if(state.black!=='com'||state.red!=='vohm')warning='黒をCOM、赤をVΩへ差してから測定します。';
    else if(state.lesson!=='voltage'&&!state.prepared)warning='抵抗・導通の測定前に、対象の電源を外し、残留電圧がないことを確認してください。';
    else if(state.mode!==lessons[state.lesson].mode)warning=`この測定は「${modes[lessons[state.lesson].mode]}」モードです。プローブを離した状態でモードを合わせてください。`;
    if(warning){state.measured=false;state.status='blocked';state.message=warning;}
    else{
      state.measured=true;state.status='success';
      state.message=state.lesson==='voltage'?(state.polarity==='reverse'?'−の符号は、プローブの極性が逆であることを示します。':'電池の両端へ並列接続。単位Vと＋／−の符号も確認します。'):state.lesson==='resistance'?'1.000 kΩは1000 Ω。単位のkを見落とさないようにします。':state.wire==='connected'?'低い抵抗値なので模擬ブザーあり。音は鳴らさず、表示で示しています。':'OL・模擬ブザーなし。この教材では配線が途中で切れています。';
    }
    render();
  }
  function reset(lesson=state.lesson){
    state={lesson,mode:'off',black:'none',red:'none',prepared:false,polarity:'normal',wire:'connected',measured:false,status:'idle',message:'下の操作欄で、リードと測定モードを選びましょう。'};render();
  }
  root.querySelectorAll('[data-tester-case]').forEach(button=>button.addEventListener('click',()=>reset(button.dataset.testerCase)));
  root.querySelectorAll('[data-tester-mode]').forEach(button=>button.addEventListener('click',()=>{if(state.measured)return;state.mode=button.dataset.testerMode;fresh();}));
  for(const [id,key] of [['testerBlackLead','black'],['testerRedLead','red'],['testerPolarity','polarity'],['testerWire','wire']])$(id).addEventListener('change',event=>{if(state.measured)return;state[key]=event.target.value;fresh();});
  $('testerPrepared').addEventListener('change',event=>{if(state.measured)return;state.prepared=event.target.checked;fresh();});
  $('testerMeasure').addEventListener('click',measure);
  $('testerDisconnect').addEventListener('click',()=>fresh('プローブを離しました。設定を変更するか、測定を終えてOFFに戻します。'));
  $('testerReset').addEventListener('click',()=>reset());
  window.resetTesterLesson=()=>reset('voltage');
  render();
})();

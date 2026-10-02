(()=>{
  'use strict';
  const root=document.getElementById('tester');
  if(!root)return;
  const $=id=>document.getElementById(id);
  const lessons={
    voltage:{title:'乾電池のDC電圧',mode:'dcv',goal:'まず乾電池のDC電圧を1回測り、接続解除・OFFまで練習します。追加練習では1.5Vと1.0V、逆向きの符号を比較します。',connection:'電圧は対象の両端へ並列接続。赤を＋、黒を−に当てます。',steps:['黒をCOM、赤をVΩに差す。','V⎓（DC電圧）を選ぶ。','電池の教材値と向きを選び、両端へ当ててVと符号を読む。','プローブを離し、OFFに戻すと練習完了。'],interpretation:'赤と黒を逆にすると負の表示になります。1.0Vと1.5Vは比較用の値です。電圧の値だけで電池の負荷時性能を判断できません。'},
    acvoltage:{title:'低電圧交流源のAC電圧',mode:'acv',goal:'画面内の6V実効値・50Hz正弦波交流源をAC電圧モードで測ります。',connection:'交流電圧も並列接続。端子1と端子2へ当て、向きを逆にしても同じ実効値です。',steps:['黒をCOM、赤をVΩに差す。','V〜（AC電圧）を選ぶ。','交流源の両端へ当て、6.000 V ACの実効値を読む。','プローブを離し、OFFに戻すと練習完了。'],interpretation:'6.000 V ACは正弦波の実効値（RMS）です。瞬間値やピーク値ではありません。プローブを逆にしても表示は同じです。教材は低電圧交流源の模擬測定で、コンセントの実習は含みません。'},
    current:{title:'低電圧回路のDC電流',mode:'dca',goal:'3Vの電池と120Ωの負荷の理想回路に、テスターを直列に入れて電流を読みます。',connection:'電源を切って回路を開き、切れ目へ直列接続します。電源の両端への並列接続は遮断します。',steps:['回路の電源を切り、無電圧・残留電圧なしを確認して回路を開く。','黒をCOM、赤を対応する電流用A端子へ差し、A⎓（DC電流）を選ぶ。','「切れ目へ直列」を選び、準備を確認する。','「直列接続して模擬電源を入れる」を押し、25.00 mAを読む。','「電源を切ってプローブを離す」を押し、VΩへ戻してからOFFにする。'],interpretation:'I＝V÷R＝3÷120＝0.025 A＝25.00 mA。テスターを流れる経路に直列に入れます。表示は理想計算で、実機の内部抵抗・ヒューズ・分解能は再現しません。実機は対応端子・レンジ・ヒューズ定格を確認します。'},
    resistance:{title:'単体抵抗の抵抗値',mode:'ohm',goal:'まず電源から切り離した単体抵抗を1回測り、接続解除・OFFまで練習します。追加練習では100Ω・1kΩ・10kΩの単位を比較します。',connection:'電源・残留電圧がないことを確認し、抵抗の両端へ当てます。',steps:['対象の電源を切り離し、残留電圧がないことを確認する。','黒をCOM、赤をVΩに差し、Ω（抵抗）を選ぶ。','抵抗の教材値を選び、両端へ当ててΩ・kΩの単位を読む。','プローブを離し、OFFに戻すと練習完了。'],interpretation:'1 kΩ＝1000 Ω、10 kΩ＝10000 Ω。プローブの向きは問いません。回路につながったままでは並列経路の影響で単体の抵抗値と異なる場合があります。'},
    continuity:{title:'配線の導通確認',mode:'beep',goal:'まず電源のない配線を1回測り、接続解除・OFFまで練習します。追加練習では「つながる」と「切れる」を比較します。',connection:'電源・残留電圧がないことを確認し、配線の両端へ当てます。',steps:['配線を電源から外し、残留電圧がないことを確認する。','黒をCOM、赤をVΩに差し、導通（ブザー）を選ぶ。','つながる配線と途中で切れた配線を、プローブを離して切り替える。','表示とブザーを読み、プローブを離してOFFに戻す。'],interpretation:'接続された配線は0.3 Ω・模擬ブザーあり、断線はOL・ブザーなし。OLはこの教材では開放状態です。ブザーのしきい値は機種により違い、音だけで配線品質を保証しません。音は鳴らさず表示で示します。'}
  };
  const modes={off:'OFF',dcv:'V⎓',acv:'V〜',dca:'A⎓',ohm:'Ω',beep:'導通'};
  // The same label centres determine the selected dial direction.
  const dialLabels={off:{x:52,y:121,size:11},dcv:{x:78,y:100,size:12},acv:{x:121,y:99,size:12},dca:{x:173,y:106,size:12},ohm:{x:180,y:133,size:13},beep:{x:175,y:165,size:11}};
  let completed={},state;
  const initial=lesson=>({lesson,mode:'off',black:'none',red:'none',prepared:false,polarity:'normal',wire:'connected',voltage:'1.5',resistance:'1000',connection:'series',measured:false,hadReading:false,disconnected:false,status:'idle',message:'下の操作欄で、リードと測定モードを選びましょう。'});
  function reading(){
    if(!state.measured)return state.mode==='off'?'OFF':'—';
    if(state.lesson==='voltage')return (state.polarity==='reverse'?'−':'')+Number(state.voltage).toFixed(3)+' V';
    if(state.lesson==='acvoltage')return '6.000 V AC';
    if(state.lesson==='current')return '25.00 mA';
    if(state.lesson==='resistance')return state.resistance==='100'?'100.0 Ω':(Number(state.resistance)/1000).toFixed(3)+' kΩ';
    return state.wire==='broken'?'OL':'0.3 Ω';
  }
  function finish(){
    if(state.hadReading&&state.disconnected&&state.mode==='off'&&(state.lesson!=='current'||state.red==='vohm')){
      completed[state.lesson]=true;
      state.message='練習完了。測定 → 接続解除 → OFFまで確認できました。';
    }
  }
  function fresh(message='設定を確認してから測りましょう。'){state.measured=false;state.status='idle';state.message=message;finish();render();}
  function renderDiagram(){
    const measured=state.measured,reverse=['voltage','acvoltage'].includes(state.lesson)&&state.polarity==='reverse';
    const redX=reverse?535:350,blackX=reverse?350:535,targetY=155,probeY=measured?targetY:214,redJack=state.red==='a'?60:174;
    let target;
    if(state.lesson==='voltage'){
      target=`<rect x="368" y="116" width="151" height="79" rx="10" fill="#eef0da" stroke="#879260" stroke-width="3"/><rect x="350" y="135" width="18" height="40" rx="3" fill="#bdc5a0"/><path d="M519 155H535" stroke="#687a82" stroke-width="4"/><text x="400" y="149" font-size="23" font-weight="700">${Number(state.voltage).toFixed(1)} V</text><text x="409" y="177" font-size="16">乾電池</text><text x="341" y="119" font-size="24" fill="#bb3636">＋</text><text x="524" y="120" font-size="26">−</text>`;
    }else if(state.lesson==='acvoltage'){
      target='<path d="M350 155H408M480 155H535" stroke="#687a82" stroke-width="4"/><circle cx="444" cy="155" r="36" fill="#e0ecf5" stroke="#4b80a5" stroke-width="3"/><path d="M420 155Q432 125 444 155T468 155" fill="none" stroke="#367ba8" stroke-width="3"/><text x="365" y="110" font-size="20" font-weight="700">6 V RMS · 50 Hz</text><text x="360" y="207" font-size="15">端子1　低電圧交流源　端子2</text>';
    }else if(state.lesson==='current'){
      target='<path d="M350 155V85H400M480 85H535V115M535 129V155" stroke="#687a82" stroke-width="4" fill="none"/><rect x="400" y="73" width="80" height="24" rx="4" fill="#e5d7a9" stroke="#8b774b" stroke-width="2"/><text x="410" y="64" font-size="18">120 Ω</text><path d="M517 115H553M525 129H545" stroke="#687a82" stroke-width="4"/><text x="552" y="130" font-size="16">3 V</text><text x="327" y="182" font-size="15">負荷側</text><text x="490" y="182" font-size="15">電池−側</text><text x="386" y="198" font-size="15">回路の切れ目</text>';
    }else if(state.lesson==='resistance'){
      const band={100:'#8b4513',1000:'#c64242',10000:'#e8a137'}[state.resistance],label=state.resistance==='100'?'100 Ω':Number(state.resistance)/1000+' kΩ';
      target=`<path d="M350 155H400M488 155H535" stroke="#687a82" stroke-width="4"/><rect x="400" y="135" width="88" height="40" rx="5" fill="#e5d7a9" stroke="#8b774b" stroke-width="3"/><path d="M413 136V174" stroke="#8b4513" stroke-width="5"/><path d="M431 136V174" stroke="#222222" stroke-width="5"/><path d="M449 136V174" stroke="${band}" stroke-width="5"/><path d="M477 136V174" stroke="#c5a342" stroke-width="4"/><text x="400" y="116" font-size="21" font-weight="700">${label}</text><text x="373" y="200" font-size="15">電源から切り離した抵抗</text>`;
    }else{
      target=state.wire==='broken'?'<path d="M350 155H429M459 155H535" stroke="#3a7370" stroke-width="7"/><path d="M435 145L448 166M447 145L434 166" stroke="#bd633b" stroke-width="3"/><text x="406" y="118" font-size="21" font-weight="700">断線</text>':'<path d="M350 155H535" stroke="#3a7370" stroke-width="7"/><text x="389" y="118" font-size="21" font-weight="700">導通する配線</text>';
      target+='<text x="389" y="199" font-size="15">電源のない配線</text>';
    }
    const dial=dialLabels[state.mode],angle=Math.atan2(dial.x-119,143-dial.y)*180/Math.PI;
    const labels=Object.entries(dialLabels).map(([key,p])=>`<text x="${p.x}" y="${p.y}" font-size="${p.size}" text-anchor="middle" dominant-baseline="middle">${modes[key]}</text>`).join('');
    const blackWire=state.black==='com'?`<path d="M117 218V270H${blackX}V${probeY}" fill="none" stroke="#2e3c47" stroke-width="5" stroke-linejoin="round"/>`:'';
    const redWire=state.red!=='none'?`<path d="M${redJack} 218V248H${redX}V${probeY}" fill="none" stroke="#c64242" stroke-width="5" stroke-linejoin="round"/>`:'';
    const probes=(state.black==='com'?`<rect x="${blackX-5}" y="${probeY+3}" width="10" height="20" rx="3" fill="#2e3c47"/><path d="M${blackX} ${probeY}v8" stroke="#8b9ca5" stroke-width="3"/>`:'')+(state.red!=='none'?`<rect x="${redX-5}" y="${probeY+3}" width="10" height="20" rx="3" fill="#c64242"/><path d="M${redX} ${probeY}v8" stroke="#8b9ca5" stroke-width="3"/>`:'');
    const beep=measured&&state.lesson==='continuity'&&state.wire==='connected';
    const current=state.lesson==='current';
    const description=`${lessons[state.lesson].title}。黒リードは${state.black==='com'?'COM':'未接続'}、赤リードは${state.red==='vohm'?'VΩ':state.red==='a'?'電流用A':'未接続'}。モード${modes[state.mode]}。${measured?(current?'回路の切れ目に直列接続し、模擬電源ON、表示':'プローブを両端に接続し、表示')+reading():'プローブを対象から離した状態'}。${beep?'模擬ブザーあり':''}`;
    const hint=current?(measured?'直列 · 模擬電源ON':state.connection==='parallel'?'並列は誤操作 · 測定を遮断':'模擬電源OFF · 直列の準備'):['voltage','acvoltage'].includes(state.lesson)?'電圧は並列':'電源なし・残留電圧なし';
    const svgReading=state.lesson==='acvoltage'&&measured?'6.000 V':reading();
    $('testerDiagram').innerHTML=`<title id="testerSvgTitle">テスターと測定対象の接続図</title><desc id="testerSvgDesc">${description}</desc><g fill="#203a47" font-family="system-ui,sans-serif"><rect x="25" y="17" width="189" height="215" rx="16" fill="#dbc45a" stroke="#a18f36" stroke-width="3"/><rect x="42" y="37" width="155" height="51" rx="5" fill="#e5eed7" stroke="#738363"/><text x="120" y="71" text-anchor="middle" font-family="monospace" font-size="23" font-weight="700">${svgReading}</text>${labels}<circle cx="119" cy="143" r="27" fill="#495b64"/><path d="M119 157V125" stroke="#faf6d9" stroke-width="6" stroke-linecap="round" transform="rotate(${angle} 119 143)"/><text x="49" y="191" font-size="15">A</text><text x="99" y="191" font-size="14">COM</text><text x="157" y="191" font-size="14">VΩ</text><circle cx="60" cy="213" r="9" fill="#883f37"/><circle cx="117" cy="213" r="9" fill="#283945"/><circle cx="174" cy="213" r="9" fill="#883f37"/>${target}${blackWire}${redWire}${probes}<circle cx="350" cy="155" r="5" fill="#879ca7"/><circle cx="535" cy="155" r="5" fill="#879ca7"/><text x="305" y="27" font-size="15" font-weight="650">${current?'回路の切れ目へ直列':'測定対象の両端へ接続'}</text><text x="304" y="46" font-size="12">${hint}</text>${beep?'<text x="353" y="290" font-size="17" fill="#166f62" font-weight="700">♪ ブザーあり（表示のみ）</text>':''}</g>`;
  }
  function render(){
    const lesson=lessons[state.lesson],current=state.lesson==='current';
    $('testerVisualTitle').textContent=lesson.title;$('testerGoal').textContent=lesson.goal;$('testerConnectionHint').textContent=lesson.connection;
    $('testerSteps').innerHTML=lesson.steps.map(text=>`<li>${text}</li>`).join('');$('testerInterpretation').textContent=lesson.interpretation;
    $('testerPreparationBox').hidden=['voltage','acvoltage'].includes(state.lesson);
    $('testerPreparationLabel').textContent=current?'模擬電源を切り、無電圧・残留電圧なしを確認して回路を開いた':'電源を外し、残留電圧がないことを確認した';
    $('testerPreparationHint').textContent=current?'準備後に直列接続し、測定時だけ模擬電源を入れます。解除ボタンで電源を切ってからプローブを離します。':'抵抗・導通は通電中に測りません。この教材の対象は電源から切り離されています。実機にコンデンサ等がある場合は所定の放電手順と無電圧確認が必要です。';
    $('testerPolarityBox').hidden=!['voltage','acvoltage'].includes(state.lesson);
    $('testerPolarityLabel').textContent=state.lesson==='acvoltage'?'端子の向き（交流の実効値は極性なし）':'プローブを当てる向き';
    const polarityOptions=$('testerPolarity').options;
    if(polarityOptions){polarityOptions[0].textContent=state.lesson==='acvoltage'?'赤を端子1、黒を端子2':'赤を＋、黒を−';polarityOptions[1].textContent=state.lesson==='acvoltage'?'赤を端子2、黒を端子1（比較）':'赤を−、黒を＋（比較）';}
    $('testerWireBox').hidden=state.lesson!=='continuity';$('testerVoltageCaseBox').hidden=state.lesson!=='voltage';$('testerResistanceCaseBox').hidden=state.lesson!=='resistance';$('testerCurrentConnectionBox').hidden=!current;
    for(const [id,key] of controls)$(id).value=state[key];$('testerPrepared').checked=state.prepared;$('testerJackNotice').hidden=state.red!=='a';
    root.querySelectorAll('[data-tester-case]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.testerCase===state.lesson));button.dataset.complete=String(!!completed[button.dataset.testerCase]);});
    root.querySelectorAll('[data-tester-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.testerMode===state.mode)));
    $('testerReadout').dataset.status=state.status;
    $('testerResult').textContent=state.measured?reading()+(state.lesson==='continuity'?(state.wire==='connected'?' · ブザーあり':' · ブザーなし'):''):state.status==='blocked'?'設定を確認':'未測定';
    $('testerFeedback').textContent=state.status==='blocked'?'設定を確認してください。理由は下の操作欄へ。':state.measured?'表示を読み、測定後は接続を解除します。':'端子 → モード → 接続 → 読み取り → 解除 → OFF';
    $('testerFeedbackDetail').textContent=state.message;$('testerFeedbackDetail').dataset.status=state.status;
    $('testerProgress').textContent=`完了 ${Object.keys(completed).length} / 5：${Object.keys(lessons).map(key=>(completed[key]?'✓ ':'○ ')+({voltage:'DC電圧',acvoltage:'AC電圧',current:'DC電流',resistance:'抵抗',continuity:'導通'}[key])).join(' ／ ')}`;
    const steps=[['測定して値を読む',state.hadReading],['プローブを離す',state.disconnected],...(current?[['赤をVΩに戻す',state.red==='vohm'&&state.disconnected]]:[]),['OFFに戻す',state.mode==='off'&&state.disconnected]];
    $('testerCompletionSteps').innerHTML=steps.map(([text,done])=>`<li>${done?'✓':'○'} ${text}</li>`).join('');
    for(const [id] of controls)$(id).disabled=state.measured;$('testerPrepared').disabled=state.measured;
    root.querySelectorAll('[data-tester-mode]').forEach(button=>button.disabled=state.measured);root.querySelectorAll('[data-tester-case]').forEach(button=>button.disabled=state.measured);
    $('testerMeasure').disabled=state.measured;$('testerMeasure').textContent=state.measured?'測定中 · 接続を解除して終了':current?'直列接続して模擬電源を入れる':'プローブを両端に当てて測る';
    $('testerDisconnect').disabled=!state.measured;$('testerDisconnect').textContent=current?'電源を切ってプローブを離す':'プローブを離す';renderDiagram();
  }
  function measure(){
    if(state.measured)return;
    const current=state.lesson==='current';let warning='';
    if(current&&state.connection==='parallel')warning='電流計を電源の両端へ並列接続すると短絡につながります。模擬電源は入りません。回路を開き、切れ目への直列接続を選んでください。';
    else if(!current&&state.red==='a')warning='赤リードが電流用A端子です。電池や部品の両端への接続は短絡につながるため、VΩへ差し替えてください。';
    else if(state.black!=='com'||state.red!==(current?'a':'vohm'))warning=current?'黒をCOM、赤を対応する電流用A端子に差してください。電圧用VΩ端子で電流を測りません。':'黒をCOM、赤をVΩへ差してから測定します。';
    else if(!['voltage','acvoltage'].includes(state.lesson)&&!state.prepared)warning=current?'電流測定は、電源を切り、無電圧・残留電圧なしを確認して回路を開いてから直列接続します。準備を確認してください。':'抵抗・導通の測定前に、対象の電源を外し、残留電圧がないことを確認してください。';
    else if(state.mode!==lessons[state.lesson].mode)warning=`この測定は「${modes[lessons[state.lesson].mode]}」モードです。プローブを離した状態でモードを合わせてください。`;
    if(warning){state.status='blocked';state.message=warning;}
    else{
      state.measured=true;state.hadReading=true;state.disconnected=false;state.status='success';
      state.message=current?'電源OFFで直列接続し、模擬電源をONにしました。3 V ÷ 120 Ω＝25.00 mA。解除は電源を切ってから行います。':state.lesson==='acvoltage'?'6.000 V ACは実効値です。逆向きでも同じ値になります。':state.lesson==='voltage'?(state.polarity==='reverse'?'−の符号は、プローブの極性が逆であることを示します。':'電池の両端へ並列接続。単位Vと＋／−の符号も確認します。'):state.lesson==='resistance'?`${reading()}。ΩとkΩの単位を確認します。`:state.wire==='connected'?'低い抵抗値なので模擬ブザーあり。音は鳴らさず、表示で示しています。':'OL・模擬ブザーなし。この教材では配線が途中で切れています。';
    }
    render();
  }
  function reset(lesson=state.lesson){state=initial(lesson);render();}
  const controls=[['testerBlackLead','black'],['testerRedLead','red'],['testerPolarity','polarity'],['testerWire','wire'],['testerVoltageCase','voltage'],['testerResistanceCase','resistance'],['testerCurrentConnection','connection']];
  root.querySelectorAll('[data-tester-case]').forEach(button=>button.addEventListener('click',()=>{if(!state.measured)reset(button.dataset.testerCase);}));
  root.querySelectorAll('[data-tester-mode]').forEach(button=>button.addEventListener('click',()=>{if(state.measured)return;state.mode=button.dataset.testerMode;fresh();}));
  for(const [id,key] of controls)$(id).addEventListener('change',event=>{if(state.measured)return;state[key]=event.target.value;fresh();});
  $('testerPrepared').addEventListener('change',event=>{if(state.measured)return;state.prepared=event.target.checked;fresh();});
  $('testerMeasure').addEventListener('click',measure);
  $('testerDisconnect').addEventListener('click',()=>{if(!state.measured)return;state.disconnected=true;fresh(state.lesson==='current'?'模擬電源をOFFにしてプローブを離しました。赤をVΩに戻し、OFFにしてください。':'プローブを離しました。OFFにすると練習完了です。');});
  $('testerReset').addEventListener('click',()=>reset());$('testerResetAll').addEventListener('click',()=>{completed={};reset('voltage');});
  window.resetTesterLesson=()=>reset('voltage');
  reset('voltage');
})();

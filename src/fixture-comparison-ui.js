'use strict';
// The snapshot contains material-frame fixture coordinates and the original
// zero. Only support changes keep it; a different setup requires a new capture.
let fixtureComparisonSnapshot=null,fixtureComparisonIdentity='',fixtureComparisonNotice='';
let fixtureComparisonCacheKey='',fixtureComparisonFresh=null,fixtureComparisonHeld=null;
const fixtureHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fixtureComparisonApi(){
 if(current?.kind==='horizontal'&&typeof horizontalCaptureFixtures==='function')return {capture:horizontalCaptureFixtures,held:horizontalEvaluateHeld};
 if(current?.kind==='lathe'&&typeof latheCaptureFixtures==='function')return {capture:latheCaptureFixtures,held:latheEvaluateHeld};
 return null;
}
function fixtureComparisonSetupKey(){
 return JSON.stringify([current.id,positions,levelConfig.width,levelConfig.depth,levelConfig.columnX,levelConfig.columnZ,machineProfile]);
}
function fixtureComparisonRows(value){return Array.isArray(value)?value:value?.rows||value?.measurements||[];}
function captureFixtureComparison(){
 const api=fixtureComparisonApi();if(!api)return;
 const snapshot=api.capture(positions,levelSolution,machineProfile),rows=fixtureComparisonRows(snapshot);
 if(!rows.some(row=>row.valid&&Number.isFinite(row.microns))){fixtureComparisonNotice='保持できる測定がありません。先に測定位置へ移動し、接触を確認してください。';updateFixtureComparison();return;}
 fixtureComparisonSnapshot=snapshot;fixtureComparisonIdentity=fixtureComparisonSetupKey();fixtureComparisonCacheKey='';fixtureComparisonNotice='取付けと初回ゼロを保持しました。支持点を上下して比較できます。';
 updateFixtureComparison();
}
function resetFixtureComparison(reason='保持を解除しました。'){fixtureComparisonSnapshot=null;fixtureComparisonIdentity='';fixtureComparisonCacheKey='';fixtureComparisonNotice=reason;}
function clearFixtureComparison(){resetFixtureComparison();updateFixtureComparison();}
function fixtureReadingMarkup(row){
 if(!row?.valid||!Number.isFinite(row.microns))return `<strong>—</strong><small>${fixtureHtml(row?.reason||'初回の接触が未成立')}</small>`;
 const raw=Object.is(row.microns,-0)?0:row.microns;
 return `<strong>${fixtureHtml(squarenessMicronText(raw))}</strong><small>生値 ${raw.toFixed(6)}</small>`;
}
function updateFixtureComparison(){
 const host=$('fixtureComparison');if(!host)return;
 const relevant=['horizontal','lathe'].includes(current?.kind);host.hidden=!relevant;if(!relevant){resetFixtureComparison('');return;}
 if(!levelConfig||!levelSolution)return;
 const api=fixtureComparisonApi();if(!api)return;
 if(fixtureComparisonSnapshot&&fixtureComparisonIdentity!==fixtureComparisonSetupKey()){
  resetFixtureComparison('軸位置・寸法・個体が変わったため、保持を解除しました。新しい配置で取り付けてください。');
 }
 const cacheKey=JSON.stringify([fixtureComparisonSetupKey(),supportHeights,!!fixtureComparisonSnapshot]);
 if(cacheKey!==fixtureComparisonCacheKey){
  fixtureComparisonFresh=fixtureComparisonRows(api.capture(positions,levelSolution,machineProfile));
  fixtureComparisonHeld=fixtureComparisonSnapshot?fixtureComparisonRows(api.held(fixtureComparisonSnapshot,levelSolution,machineProfile)):[];
  fixtureComparisonCacheKey=cacheKey;
 }
 const initial=fixtureComparisonRows(fixtureComparisonSnapshot),fresh=fixtureComparisonFresh,held=fixtureComparisonHeld;
 $('fixtureCapture').disabled=!fresh.some(row=>row.valid&&Number.isFinite(row.microns));
 $('fixtureRelease').disabled=!fixtureComparisonSnapshot;
 $('fixtureComparisonStatus').textContent=fixtureComparisonNotice||(fixtureComparisonSnapshot?'初回の取付け・ゼロを保持中':'測定位置を選び、接触が成立したら取付けとゼロを保持できます。');
 host.dataset.holding=String(!!fixtureComparisonSnapshot);
 const rows=fixtureComparisonSnapshot?initial:fresh;
 const markup=rows.map(row=>{
  const key=row.key,now=fresh.find(q=>q.key===key),fixed=held.find(q=>q.key===key);
  return `<article class="fixture-comparison-row" data-fixture-measurement="${fixtureHtml(key)}"><h4>${fixtureHtml(row.label||key)}</h4><div class="fixture-comparison-values"><div data-reading="initial" data-raw="${row.valid&&Number.isFinite(row.microns)?row.microns:''}"><span>${fixtureComparisonSnapshot?'操作前':'現在の再測定'}</span>${fixtureReadingMarkup(row)}</div><div data-reading="held" data-raw="${fixed?.valid&&Number.isFinite(fixed.microns)?fixed.microns:''}"><span>旧ゼロ保持</span>${fixtureReadingMarkup(fixtureComparisonSnapshot?fixed:{valid:false,reason:'保持操作後に表示'})}</div><div data-reading="remounted" data-raw="${now?.valid&&Number.isFinite(now.microns)?now.microns:''}"><span>再取付け・再ゼロ</span>${fixtureReadingMarkup(now)}</div></div></article>`;
 }).join('');
 if($('fixtureComparisonRows').innerHTML!==markup)$('fixtureComparisonRows').innerHTML=markup;
 // Publish the readings for browser inspection without copying each scan's
 // complete geometry into every DOM update. The actual snapshot stays intact.
 const observed=rows=>rows.map(({key,label,valid,microns,reason,zero,endpoint,startExtension})=>({key,label,valid,microns,reason,zero,endpoint,startExtension}));
 host.dataset.comparison=JSON.stringify({initial:observed(initial),held:observed(held),fresh:observed(fresh),holding:!!fixtureComparisonSnapshot});
}
$('fixtureCapture').onclick=captureFixtureComparison;
$('fixtureRelease').onclick=clearFixtureComparison;

'use strict';
// Product reader. Reads ONLY: inputs (supports, heights, levelConfig, seed
// profile) and displayed values (DOM). Product-function outputs are collected
// under "diag" for diagnosing differences and are never used as expectations.
// usage: node product.cjs '<json cfg>'   cfg={id,seed,scenarios:[{label,positions,heights?|ops?,exact?}]}
process.chdir('/home/user/Training-tools');
const createEnv=require('/home/user/Training-tools/tests/leveling-dom-env.cjs');
const cfg=JSON.parse(process.argv[2]);
const e=createEnv({window:{crypto:{getRandomValues:v=>{v[0]=cfg.seed;return v;}}}});
e.read(`openMachine(machines.find(m=>m.id==='${cfg.id}'));`);
const out={id:cfg.id,profile:e.json('machineProfile'),supports:e.json('supports.map(s=>({x:s.x,z:s.z,group:s.group||null,id:s.id||s.name}))'),levelConfig:e.json('levelConfig'),machine:e.json(`(()=>{const m=current;return {kind:m.kind,w:m.w,d:m.d,columnX:m.columnX??null,columnZ:m.columnZ??null,supportLayout:m.supportLayout||null};})()`),scenarios:[]};
const initial=e.json('supportHeights');out.initialHeights=initial;
function dom(){
 const vals=e.body.querySelectorAll('.live-pair-error-value');
 const sq=vals.map(v=>({pair:v.closest('.live-pair-values')?.getAttribute('data-pair'),text:v.textContent,raw:v.getAttribute('data-reading-microns')}));
 const sweep=[0,1,2,3].map(i=>({text:e.registry['sweepValue'+i].textContent,raw:e.registry['sweepValue'+i].getAttribute('data-reading-microns')}));
 return {sq,sweep,sweepStatus:e.registry['sweepContactStatus'].textContent};
}
function diag(){
 return e.json(`(()=>{const r={};for(const k of ['XY','XZ','YZ']){const q=referenceScan({key:k});r[k]={valid:q.valid,reason:q.reason||null,microns:q.microns,start:q.startPosition,end:q.endPosition,zeroExt:q.zero&&q.zero.extension,lastExt:q.last&&q.last.extension,model:q.model,alignment:q.alignment?{startPosition:q.alignment.startPosition,endPosition:q.alignment.endPosition,chordLocal:q.alignment.chordLocal,tip:q.alignment.tip,master:q.alignment.master}:null,normal:q.start&&q.start.normal};}
 const p=spindleSweepMachineGeometry(positions,levelSolution,machineProfile,true);r.points={nose:p.nose,table:p.tableCentre};return r;})()`);
}
const setPositions=p=>{for(const k of ['X','Y','Z']){const el=e.registry['axis-'+k];el.events.input({target:{value:String(p[k])}});}};
for(const sc of cfg.scenarios){
 if(sc.levelConfig){e.read(`Object.assign(levelConfig,${JSON.stringify(sc.levelConfig)});updateLeveling();drawScene();`);}
 setPositions(sc.positions);
 let H;
 if(sc.heights){H=sc.heights;}
 else{H=[...initial];for(const [i,d] of (sc.ops||[]))H[i]=Math.round((H[i]+d)*1000)/1000;}
 if(sc.exact){e.read(`supportHeights=${JSON.stringify(H)};updateLeveling();drawScene();`);}
 else{
  // UI path: reset to initial heights, then setSupportHeight for each changed support.
  e.read(`supportHeights=${JSON.stringify(initial)};updateLeveling();drawScene();`);
  H.forEach((h,i)=>{if(h!==initial[i])e.read(`setSupportHeight(${i},${h});`);});
  e.read('drawScene();');
 }
 const heights=e.json('supportHeights'),positions=e.json('positions');
 out.scenarios.push({label:sc.label,requested:H,heights,positions,levelConfig:e.json('levelConfig'),dom:dom(),diag:diag()});
}
console.log(JSON.stringify(out));

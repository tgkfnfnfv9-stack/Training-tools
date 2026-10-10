'use strict';
// Direct physical sign tests with independently prescribed straight head/table
// motions. Includes opposite contact side, endpoint re-zero, common rigid pose.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto'),root=path.resolve(__dirname,'..');process.chdir(root);
const source=fs.readFileSync('src/reference-measurement-ui.js','utf8'),M=require('../src/reference-measurement.js');
const plus=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),mul=(a,k)=>a.map(x=>x*k);
function turn(v,axis,a){const c=Math.cos(a),s=Math.sin(a),r=[...v],j=(axis+1)%3,k=(axis+2)%3;r[j]=c*v[j]-s*v[k];r[k]=s*v[j]+c*v[k];return r;}
const rows=[],failures=[];
for(const theta of [-.001,0,.001])for(const phi of [-.002,0,.002])for(const common of [false,true]){
 const J=v=>common?turn(turn(turn(v,0,.41),1,-.19),2,.27):v,move=p=>plus(J(p),common?[.7,-1.3,.2]:[0,0,0]);
 const R={right:[1,0,0],up:[0,Math.cos(theta),Math.sin(theta)],back:[0,-Math.sin(theta),Math.cos(theta)]},F={right:J(R.right),up:J(R.up),back:J(R.back)},I={right:J([1,0,0]),up:J([0,1,0]),back:J([0,0,1])},Y=R.up,Z=[0,Math.sin(phi),Math.cos(phi)];
 const context={window:{ReferenceMeasurement:M},current:{kind:'horizontal'},positions:{X:0,Y:0,Z:0},levelSolution:{},machineProfile:null,supports:[],axisConfig:()=>[{key:'X',vector:[1,0,0],amp:.55,part:'コラム'},{key:'Y',vector:[0,1,0],amp:.3,part:'主軸頭'},{key:'Z',vector:[0,0,1],amp:.45,part:'パレット'}],levelCoordinates:(x,z)=>({x,z}),horizontalSpindleFixture:s=>({nose:move(plus(plus([0,2.55,1],mul(Y,.3*s.Y/100)),[.55*s.X/100,0,0])),...F,axis:F.back}),horizontalPalletPoint:(p,s)=>move(plus([0,1.27,-.85],mul(Z,.45*s.Z/100))),geometryModel:()=>({workFrame:I})};
 vm.createContext(context);vm.runInContext(source,context);const got=vm.runInContext("referenceScan({key:'YZ'})",context),expected=-.3*Math.sin(theta+phi)*1e6;
 const reversed=M.compare(got.end,got.start).microns,normal=got.start.normal,oppositeStart={...got.start,body:sub(got.start.point,mul(normal,.01)),probe:normal},delta=sub(got.end.body,got.start.body),oppositeEnd={...oppositeStart,body:plus(oppositeStart.body,delta)},opposite=M.compare(oppositeStart,oppositeEnd).microns;
 const row={theta,phi,commonRigidTransform:common,expectedUm:expected,observedUm:got.microns,reversedUm:reversed,oppositeContactUm:opposite,RendpointUm:got.alignment.microns,zeroExtensionM:got.zero.extension};rows.push(row);
 for(const [label,a,b]of [['reading',got.microns,expected],['same fixture reversed and re-zeroed',reversed,-expected],['front side contact',opposite,-expected],['R endpoints',got.alignment.microns,0]])if(!Number.isFinite(a)||Math.abs(a-b)>1e-6)failures.push({...row,label,a,b});
 if(Math.abs(got.zero.extension-.01)>1e-12)failures.push({...row,label:'S zero'});
}
const report={sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),scope:'Expected sign = negative separation of a spindle-side dial from a stationary square during +Y. Expected values are analytic, independent of fixture/contact implementation.',rows,failures};fs.writeFileSync('docs/qa-horizontal-fixture-20261010/physical-sign.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({states:rows.length,failureCount:failures.length,maxErrorUm:Math.max(...rows.map(q=>Math.abs(q.observedUm-q.expectedUm))),firstFailures:failures.slice(0,3)},null,2));if(failures.length)process.exitCode=1;

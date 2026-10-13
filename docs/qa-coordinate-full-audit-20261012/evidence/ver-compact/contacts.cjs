const O=require('./oracle.cjs'),MA=require('/home/user/Training-tools/src/machine-accuracy.js');
const p=MA.generate('new',12345,['X','Y','Z'],4),sq={XY:p.squareness.XY.microns,XZ:p.squareness.XZ.microns,YZ:p.squareness.YZ.microns};
const base=[...p.initialHeights],after=[...base];after[0]=Math.round((after[0]-.2)*1000)/1000;
const mb=O.machine(base,sq),ma=O.machine(after,sq),st={X:0,Y:0,Z:0};
// re-implement contact listing using oracle internals via scan geometry
const f=v=>v.map(q=>q.toFixed(6)).join(', ');
for(const key of ['XY','XZ','YZ']){
 const r=O.scan(mb,ma,st,key,'tangent');
 console.log(key,'interval(m, scan member pos)',r.interval.map(v=>v.toFixed(3)).join('→'),'contact travel along face(m)',r.maxContactTravel.toFixed(4));
}
console.log('P(start, Y=0) before',f(mb.P(st)),' after',f(ma.P(st)));
console.log('head seat slope before/after (mm/m)',f(mb.S.slope(0,.783)),'/',f(ma.S.slope(0,.783)),' saddle seat slope', f(mb.S.slope(0,-.27)),'/',f(ma.S.slope(0,-.27)));
console.log('heights at seats before/after (mm): head',mb.S.height(0,.783).toFixed(4),ma.S.height(0,.783).toFixed(4),' saddle',mb.S.height(0,-.27).toFixed(4),ma.S.height(0,-.27).toFixed(4));
console.log('twist t before/after (mm)',mb.S.t.toFixed(4),ma.S.t.toFixed(4),'q1,q3 after',ma.S.q1.toFixed(5),ma.S.q3.toFixed(5));

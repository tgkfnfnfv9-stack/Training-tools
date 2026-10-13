// Diagnostic: is the <=0.014 µm oracle/product gap only the yaw-about-normal convention?
// Re-run the oracle with the alternative convention (x-axis kept in the x-y plane, common plane
// rotation composed with the local residual rotation) and compare to product values from lathe-results.json.
const O=require('./lathe-oracle.cjs'),R=require('./lathe-results.json');
const unit=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function orient(lr,fb){const a=lr/1000,b=fb/1000,up=unit([-a,1,-b]),right=unit([1,a,0]),back=cross(right,up);return [[right[0],up[0],back[0]],[right[1],up[1],back[1]],[right[2],up[2],back[2]]];}
const mm=(A,B)=>A.map(r=>[0,1,2].map(j=>r[0]*B[0][j]+r[1]*B[1][j]+r[2]*B[2][j]));
let plane=null;const origTilt=O.tilt;
// monkey-patch: tilt(lr,fb) -> common(plane) * local(lr-plane.a, fb-plane.b)
const M=require('./lathe-oracle.cjs');
const src=require('fs').readFileSync(__dirname+'/lathe-oracle.cjs','utf8').replace("function tilt(lr,fb){","function tilt(lr,fb){if(globalThis.__plane){const P=globalThis.__plane,C=__orient(P.a,P.b),L=__orient(lr-P.a,fb-P.b);return mat(__mm(C,L));}").replace("const plane=lsPlane(P);","const plane=lsPlane(P);globalThis.__plane=plane;");
const m={exports:{}};globalThis.__orient=orient;globalThis.__mm=mm;new Function('module','require',src)(m,require);
let worst=0;for(const c of R.cases){const E=m.exports.evaluate({seed:c.seed,condition:c.condition,heights:c.heights,X:c.X,Z:c.Z});for(const k of ['face','flat','dy','barSide','barTop'])if(E[k]!=null)worst=Math.max(worst,Math.abs(E[k]-c.product[k]));}
console.log('max |oracle(alt convention) - product| over',R.cases.length,'cases (face,flat,dy,barSide,barTop):',worst);
let wdx=0;for(const c of R.cases){const E=m.exports.evaluate({seed:c.seed,condition:c.condition,heights:c.heights,X:c.X,Z:c.Z});wdx=Math.max(wdx,Math.abs(E.dx-c.product.dx));}console.log('dx',wdx);

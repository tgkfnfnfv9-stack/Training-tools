'use strict';
// Independent 3D physical reconstruction from browser INPUTS only. No product
// geometry, frame, fixture, contact or scan function is called for expectations.
// Two angular roots place a rectangular square: its R surface and thickness
// middle plane must both contain the fixed dial-tip point after table Z feed.
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');process.chdir(root);
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),times=(a,k)=>a.map(v=>v*k),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>times(a,1/Math.hypot(...a));
const map=(F,p)=>add(add(times(F[0],p[0]),times(F[1],p[1])),times(F[2],p[2]));
function supportModel(input){
 const {width,depth}=input.config,zs=[-depth/2,-depth/6,depth/6,depth/2],xs=[-width/2,width/2],nodes=[...input.supports].sort((a,b)=>a.z-b.z||a.x-b.x),hs=nodes.map(n=>n.height/1000);
 // Symmetric rectangular node locations make the three least-squares columns
 // orthogonal; these are direct normal-equation sums, not product solver calls.
 const xyz=zs.flatMap(z=>xs.map(x=>({x,z}))),a=xyz.reduce((s,q,i)=>s+q.x*hs[i],0)/xyz.reduce((s,q)=>s+q.x*q.x,0),b=xyz.reduce((s,q,i)=>s+q.z*hs[i],0)/xyz.reduce((s,q)=>s+q.z*q.z,0),c=hs.reduce((s,h)=>s+h,0)/8;
 function surface(x,z){z=zs.find(v=>Math.abs(v-z)<1e-12)??z;let k=0;while(k<2&&z>=zs[k+1])k++;const u=(x-xs[0])/width,v=(z-zs[k])/(zs[k+1]-zs[k]),h00=hs[2*k],h10=hs[2*k+1],h01=hs[2*k+2],h11=hs[2*k+3];return {h:(1-u)*(1-v)*h00+u*(1-v)*h10+(1-u)*v*h01+u*v*h11,dx:((1-v)*(h10-h00)+v*(h11-h01))/width,dz:((1-u)*(h01-h00)+u*(h11-h10))/(zs[k+1]-zs[k])};}
 // Choose right along the constant-z support section; upward is the normal
 // to the two support tangents, and back completes a rigid orthonormal triad.
 function axes(dx,dz){const tx=[1,dx,0],tz=[0,dz,1],right=unit(tx),up=unit(cross(tz,tx));return [right,up,cross(right,up)];}
 const C=axes(a,b),seat=(x,z)=>{const s=surface(x,z),F=axes(s.dx-a,s.dz-b).map(q=>map(C,q)),point=add(map(C,[x,s.h-a*x-b*z-c,z]),[0,.66+c,0]);return {F,point};};
 return {seat};
}
function expectedYZ(input){
 const {width,depth,columnX=0,columnZ=0}=input.config,state=input.positions,support=supportModel(input),half=.45*depth/3.68,L=.3;
 if(2*half<L-1e-12)return {valid:false,reason:'short Z travel'};
 const errors=input.profile?.squareness||{},A=(errors.XY?.microns||0)/300000,B=(errors.XZ?.microns||0)/300000,C=(errors.YZ?.microns||0)/300000;
 // Pair angles are pi/2 + error. Set X=(1,0,0), then solve X·Y=-sin(A),
 // X·Z=-sin(B), Y·Z=-sin(C), and positive unit Z. This derives the intrinsic
 // axes directly from the stored angle constraints rather than a sign table.
 const Y=[-Math.sin(A),Math.cos(A),0],zx=-Math.sin(B),zy=(-Math.sin(C)-Y[0]*zx)/Y[1],Z=[zx,zy,Math.sqrt(1-zx*zx-zy*zy)];
 const headSeat=support.seat((.55*state.X/100+.68*columnX/100)*width/2.72,(1.334+.46*columnZ/100)*depth/3.68),headY=map(headSeat.F,Y);
 function pallet(percent){const t=half*percent/100,p=support.seat(0,-.85*depth/3.68+t),material=add([0,.61,0],times(sub(Z,[0,0,1]),t));return {F:p.F,point:add(p.point,map(p.F,material))};}
 const zStart=Math.max(-half,Math.min(half-L,state.Z*half/100)),p0=pallet(zStart/half*100),p1=pallet((zStart+L)/half*100),corner=[0,.37,.15],fixedTip=add(p0.point,map(p0.F,corner)),endCorner=add(p1.point,map(p1.F,corner));
 const rootAngle=f=>{let lo=-.05,hi=.05,flo=f(lo);if(flo*f(hi)>0)throw Error('fixture angle not bracketed');for(let i=0;i<75;i++){const mid=(lo+hi)/2;if(flo*f(mid)<=0)hi=mid;else{lo=mid;flo=f(mid);}}return (lo+hi)/2;};
 // The thickness direction stays horizontal in the pallet frame. First find
 // yaw so that the fixed tip stays in the square's thickness middle plane.
 const yaw=rootAngle(a=>dot(map(p1.F,[-Math.cos(a),0,Math.sin(a)]),sub(fixedTip,endCorner)));
 // Next tilt the rectangular square so its R top also contains that point.
 const R=a=>[-Math.sin(yaw)*Math.sin(a),Math.cos(a),-Math.cos(yaw)*Math.sin(a)],pitch=rootAngle(a=>dot(map(p1.F,R(a)),sub(fixedTip,endCorner))),S=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)];
 const returned=pallet(state.Z),normal=map(returned.F,S),reading=-L*dot(normal,headY)*1e6;
 return {valid:true,microns:reading,headY,Snormal:normal,yaw,pitch,RstartMm:zStart*1000,RendMm:(zStart+L)*1000,returnedZ:state.Z,RendPlaneResidualM:dot(map(p1.F,R(pitch)),sub(fixedTip,endCorner)),thicknessResidualM:dot(map(p1.F,[-Math.cos(yaw),0,Math.sin(yaw)]),sub(fixedTip,endCorner))};
}
if(require.main===module){
 const after=JSON.parse(fs.readFileSync('docs/qa-horizontal-fixture-20261010/browser/after/results.json')),before=JSON.parse(fs.readFileSync('docs/qa-horizontal-fixture-20261010/browser/before/results.json')),rows=[],failures=[];
 const rounded=v=>{const n=Math.round(Math.abs(v));return n?(v<0?'-':'+')+n:'0';};
 for(const input of after.states){const expected=expectedYZ(input),actual=input.references.find(r=>r.key==='YZ'),old=before.states.find(q=>q.name===input.name)?.references.find(r=>r.key==='YZ'),row={name:input.name,method:input.method,profile:input.profile,positions:input.positions,supportHeightsMm:input.supports.map(q=>q.height),config:input.config,beforeRawUm:old?.measurement.microns,beforeDisplay:old?.dom.reading,afterRawUm:actual.measurement.microns,afterDisplay:actual.dom.reading,independent:expected,independentDisplay:rounded(expected.microns),errorUm:actual.measurement.microns-expected.microns};rows.push(row);if(!expected.valid||!actual.measurement.valid||Math.abs(row.errorUm)>2e-6||row.afterDisplay!==row.independentDisplay)failures.push(row);}
 const report={scope:'Full 3D expectation from input support heights, stored intrinsic pair angles and axis state. Independent tangent-based seat frames; yaw/pitch solved by two plane residual roots. No production pose/scan/contact functions supplied expectations.',browserHtmlSha256:after.sha256,states:rows.length,maxErrorUm:Math.max(...rows.map(q=>Math.abs(q.errorUm))),failureCount:failures.length,rows,failures};fs.writeFileSync('docs/qa-horizontal-fixture-20261010/physical-browser-3d.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({states:rows.length,maxErrorUm:report.maxErrorUm,failureCount:failures.length,examples:rows.filter(q=>['used-central-flat','used-central-B-raise','used-central-E-raise'].includes(q.name)),firstFailures:failures.slice(0,3)},null,2));if(failures.length)process.exitCode=1;
}
module.exports={expectedYZ,supportModel};

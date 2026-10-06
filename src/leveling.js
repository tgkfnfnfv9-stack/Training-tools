(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.Leveling=api;
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const finite=(value,name)=>{if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError(name+'は有限の数値で指定してください。');return value;};
 const checked=(value)=>{if(!Number.isFinite(value))throw new RangeError('入力の桁が大きすぎるか、支持点間隔が小さすぎて計算できません。');return value;};
 const mean=values=>checked(values.reduce((sum,v)=>sum+v/values.length,0));
 // Smooth geometric interpolation for explicitly selected irregular foundations.
 // This matches every support and reproduces affine planes; it does not model
 // machine stiffness, contact forces or a finite-element structural solution.
 let irregularFactorization=null;
 function irregularSurface(points,xm,zm,sx,sz,hs,planeHeight,a,b){
  const nodes=points.map(p=>({x:(p.x-xm)/sx,z:(p.z-zm)/sz,h:(p.h-planeHeight(p.x,p.z))/hs}));
  const n=nodes.length,size=n+3;
  const kernel=(dx,dz)=>{const r2=dx*dx+dz*dz;return r2===0?0:.5*r2*Math.log(r2);};
  // Support geometry stays fixed during repeated adjustments and hint searches.
  // Cache only its elimination steps; each solve still owns fresh heights,
  // weights and query closures. A single entry keeps memory bounded.
  const key=JSON.stringify(nodes.map(p=>[p.x,p.z]));
  if(!irregularFactorization||irregularFactorization.key!==key){
  const matrix=Array.from({length:size},()=>Array(size).fill(0)),steps=[];
  for(let i=0;i<n;i++){
   for(let j=0;j<n;j++)matrix[i][j]=kernel(nodes[i].x-nodes[j].x,nodes[i].z-nodes[j].z);
   matrix[i][n]=matrix[n][i]=1;
   matrix[i][n+1]=matrix[n+1][i]=nodes[i].x;
   matrix[i][n+2]=matrix[n+2][i]=nodes[i].z;
  }
  // Partial pivoting in normalized coordinates avoids dependence on model units.
  for(let col=0;col<size;col++){
   let pivot=col;
   for(let row=col+1;row<size;row++)if(Math.abs(matrix[row][col])>Math.abs(matrix[pivot][col]))pivot=row;
   if(Math.abs(matrix[pivot][col])<Number.EPSILON*size*64)throw new RangeError('不規則支持点の間隔が近すぎて計算できません。');
   [matrix[col],matrix[pivot]]=[matrix[pivot],matrix[col]];
   const scale=matrix[col][col];
   const factors=[];
   for(let j=col;j<size;j++)matrix[col][j]=checked(matrix[col][j]/scale);
   for(let row=col+1;row<size;row++){
    const factor=matrix[row][col];
    factors.push(factor);
    for(let j=col;j<size;j++)matrix[row][j]=checked(matrix[row][j]-factor*matrix[col][j]);
   }
   steps.push({pivot,scale,factors});
  }
  irregularFactorization={key,matrix,steps};
  }
  const {matrix,steps}=irregularFactorization,rhs=[...nodes.map(p=>p.h),0,0,0];
  for(let col=0;col<size;col++){
   const {pivot,scale,factors}=steps[col];
   [rhs[col],rhs[pivot]]=[rhs[pivot],rhs[col]];
   rhs[col]=checked(rhs[col]/scale);
   for(let row=col+1;row<size;row++)rhs[row]=checked(rhs[row]-factors[row-col-1]*rhs[col]);
  }
  const weights=Array(size).fill(0);
  for(let i=size-1;i>=0;i--){let value=rhs[i];for(let j=i+1;j<size;j++)value-=matrix[i][j]*weights[j];weights[i]=checked(value);}
  const query=(x,z)=>({x:checked((finite(x,'x')-xm)/sx),z:checked((finite(z,'z')-zm)/sz)});
  const heightAt=(x,z)=>{
   const q=query(x,z);let value=weights[n]+weights[n+1]*q.x+weights[n+2]*q.z;
   for(let i=0;i<n;i++)value+=weights[i]*kernel(q.x-nodes[i].x,q.z-nodes[i].z);
   return checked(planeHeight(x,z)+value*hs);
  };
  const slopeAt=(x,z)=>{
   const q=query(x,z);let dx=weights[n+1],dz=weights[n+2];
   for(let i=0;i<n;i++){
    const u=q.x-nodes[i].x,v=q.z-nodes[i].z,r2=u*u+v*v;
    if(r2!==0){const factor=weights[i]*(Math.log(r2)+1);dx+=factor*u;dz+=factor*v;}
   }
   return {lr:checked(a+dx*hs/sx),fb:checked(b+dz*hs/sz)};
  };
  return {heightAt,slopeAt};
 }
 function solve(input,options){
  if(options!==undefined&&(!options||(options.layout!==undefined&&options.layout!=='irregular')))throw new TypeError('不規則支持はlayout: irregularで指定してください。');
  if(!Array.isArray(input)||input.length<3)throw new TypeError('3点以上の支持点が必要です。');
  const points=input.map((p,i)=>{if(!p||typeof p!=='object')throw new TypeError('支持点'+i+'が不正です。');return {x:finite(p.x,'x'),z:finite(p.z,'z'),h:finite(p.h,'h')};});
  const seen=new Set();
  for(const p of points){const key=p.x+','+p.z;if(seen.has(key))throw new RangeError('支持点の座標が重複しています。');seen.add(key);}
  const xs=[...new Set(points.map(p=>p.x))].sort((a,b)=>a-b),zs=[...new Set(points.map(p=>p.z))].sort((a,b)=>a-b);
  if(xs.length<2||zs.length<2)throw new RangeError('支持点が一直線に並んでいます。');
  const xm=mean(points.map(p=>p.x)),zm=mean(points.map(p=>p.z));
  const sx=Math.max(...points.map(p=>Math.abs(checked(p.x-xm)))),sz=Math.max(...points.map(p=>Math.abs(checked(p.z-zm))));
  if(sx===0||sz===0)throw new RangeError('支持点間隔が不足しています。');
  // 座標と高さを正規化して、大きな原点・高さに対する丸め誤差を抑える。
  const hs=Math.max(...points.map(p=>Math.abs(p.h)))||1,hm=points.every(p=>p.h===points[0].h)?points[0].h/hs:mean(points.map(p=>p.h/hs));
  let xx=0,zz=0,xz=0,xh=0,zh=0;
  for(const p of points){const x=(p.x-xm)/sx,z=(p.z-zm)/sz,h=p.h/hs-hm;xx+=x*x;zz+=z*z;xz+=x*z;xh+=x*h;zh+=z*h;}
  const det=xx*zz-xz*xz;
  if(det<=Number.EPSILON*64*xx*zz)throw new RangeError('支持点が一直線、またはほぼ一直線に並んでいます。');
  const an=(xh*zz-zh*xz)/det,bn=(zh*xx-xh*xz)/det;
  const a=checked(an*hs/sx),b=checked(bn*hs/sz),heightMean=checked(hm*hs);
  const planeHeight=(x,z)=>checked(heightMean+checked(a*(x-xm))+checked(b*(z-zm)));
  const c=checked(heightMean-checked(a*xm)-checked(b*zm));
  let heightAt,slopeAt;
  if(points.length===3){
   heightAt=(x,z)=>planeHeight(finite(x,'x'),finite(z,'z'));
   slopeAt=(x,z)=>{finite(x,'x');finite(z,'z');return {lr:a,fb:b};};
  }else if(options&&options.layout==='irregular'){
   ({heightAt,slopeAt}=irregularSurface(points,xm,zm,sx,sz,hs,planeHeight,a,b));
  }else{
   if(points.length!==xs.length*zs.length)throw new RangeError('4点以上は欠けのない長方形格子で指定してください。');
   const rows=zs.map(z=>xs.map(x=>points.find(p=>p.x===x&&p.z===z).h));
   // 内部境界では右／奥側のセル、最外境界では内側のセルを使う。
   // 範囲外も最外セルを延長し、ゼロ勾配になるclampは行わない。
   const interval=(values,value)=>{let i=0;while(i<values.length-2&&value>=values[i+1])i++;return i;};
   const cell=(x,z)=>{
    finite(x,'x');finite(z,'z');const i=interval(xs,x),j=interval(zs,z),dx=checked(xs[i+1]-xs[i]),dz=checked(zs[j+1]-zs[j]);
    return {u:checked((x-xs[i])/dx),v:checked((z-zs[j])/dz),dx,dz,h00:rows[j][i],h10:rows[j][i+1],h01:rows[j+1][i],h11:rows[j+1][i+1]};
   };
   heightAt=(x,z)=>{const q=cell(x,z),front=q.h00+(q.h10-q.h00)*q.u,back=q.h01+(q.h11-q.h01)*q.u;return checked(front+(back-front)*q.v);};
   slopeAt=(x,z)=>{const q=cell(x,z);return {lr:checked(((q.h10-q.h00)*(1-q.v)+(q.h11-q.h01)*q.v)/q.dx),fb:checked(((q.h01-q.h00)*(1-q.u)+(q.h11-q.h10)*q.u)/q.dz)};};
  }
  const x0=xs[0],x1=xs[xs.length-1],z0=zs[0],z1=zs[zs.length-1],width=checked(x1-x0);
  const frontSlope=checked((heightAt(x1,z0)-heightAt(x0,z0))/width),backSlope=checked((heightAt(x1,z1)-heightAt(x0,z1))/width);
  const twist=points.length===3?0:checked(backSlope-frontSlope);
  const residual=points.length===3?0:Math.max(...points.map(p=>Math.abs(checked(p.h-planeHeight(p.x,p.z)))));
  return {lr:a,fb:b,twist,residual,plane:{a,b,c},heightAt,slopeAt};
 }
 function impact(solution,options){
  if(!solution||!options)throw new TypeError('計算結果とspan/offsetを指定してください。');
  const lr=finite(solution.lr,'lr'),fb=finite(solution.fb,'fb'),twist=finite(solution.twist,'twist'),residual=finite(solution.residual,'residual');
  const span=finite(options.span,'span'),offset=finite(options.offset,'offset');
  if(span<0||offset<0||residual<0)throw new RangeError('span、offset、residualは0以上にしてください。');
  return {tiltOffsetMicrons:checked(Math.hypot(lr,fb)*offset*1000),twistOffsetMicrons:checked(Math.abs(twist)*span*1000),straightnessMicrons:checked(residual*1000)};
 }
 // A right-handed orthonormal frame for a local support slope. Heights are mm,
 // horizontal dimensions m; convert mm/m to a dimensionless gradient first.
 // Equal slopes always give the same rigid rotation, including compound tilt.
 function orientation(slope){
  const a=finite(slope.lr,'lr')/1000,b=finite(slope.fb,'fb')/1000;
  const normalLength=Math.hypot(a,1,b),xLength=Math.hypot(1,a);
  const up=[-a/normalLength,1/normalLength,-b/normalLength],right=[1/xLength,a/xLength,0];
  const back=[right[1]*up[2],-right[0]*up[2],right[0]*up[1]-right[1]*up[0]];
  const rotate=v=>{if(!Array.isArray(v)||v.length!==3)throw new TypeError('3成分のベクトルが必要です。');v.forEach(q=>finite(q,'vector'));return right.map((q,i)=>checked(q*v[0]+up[i]*v[1]+back[i]*v[2]));};
  return {right,up,back,rotate};
 }
 function geometry(solution,options){
  if(!solution||typeof solution.slopeAt!=='function'||!options)throw new TypeError('支持面と幾何モデルの設定が必要です。');
  const length=finite(options.length,'length');if(length<=0)throw new RangeError('評価長は0より大きくしてください。');
  const sample=list=>{
   if(!Array.isArray(list)||!list.length)throw new TypeError('姿勢の参照位置が必要です。');
   const slopes=list.map(p=>solution.slopeAt(finite(p.x,'x'),finite(p.z,'z')));
   return {slopes,slope:{lr:mean(slopes.map(s=>s.lr)),fb:mean(slopes.map(s=>s.fb))}};
  };
  const tool=sample(options.toolPoints),work=sample(options.workPoints),toolFrame=options.toolFrame||orientation(tool.slope),workFrame=options.workFrame||orientation(work.slope);
  const axes=options.axes;
  if(!Array.isArray(axes)||axes.length<2)throw new TypeError('2軸以上の方向が必要です。');
  const keys=new Set();
  const directions=axes.map(axis=>{
   if(keys.has(axis.key)||!['X','Y','Z'].includes(axis.key)||!['tool','work'].includes(axis.source))throw new TypeError('軸名と参照姿勢が不正です。');
   keys.add(axis.key);const v=(axis.frame||(axis.source==='tool'?toolFrame:workFrame)).rotate(axis.vector),n=Math.hypot(...v);
   if(n===0)throw new RangeError('軸方向はゼロにできません。');return {...axis,direction:v.map(q=>q/n)};
  });
  const pairs=[];
  for(let i=0;i<directions.length;i++)for(let j=i+1;j<directions.length;j++){
   const a=directions[i],b=directions[j],dot=Math.max(-1,Math.min(1,a.direction.reduce((sum,q,k)=>sum+q*b.direction[k],0)));
   const radians=Math.abs(dot)<1e-14?0:-Math.asin(dot);
   pairs.push({key:a.key+b.key,angleDegrees:90+radians*180/Math.PI,deviationMicroradians:radians*1e6,errorMicrons:checked(radians*1e6*length)});
  }
  const lean=s=>({front:Math.atan(s.fb/1000)*1e6,right:-Math.atan(s.lr/1000)*1e6});
  const frameLean=f=>({front:Math.atan2(-f.up[2],f.up[1])*1e6,right:Math.atan2(f.up[0],f.up[1])*1e6});
  const toolLean=options.toolFrame?frameLean(toolFrame):lean(tool.slope),workLean=options.workFrame?frameLean(workFrame):lean(work.slope);
  return {pairs,directions,toolSlope:tool.slope,workSlope:work.slope,toolFrame,workFrame,
   columns:options.columnFrames?options.columnFrames.map(frameLean):tool.slopes.map(lean),toolLean,relativeLean:{front:toolLean.front-workLean.front,right:toolLean.right-workLean.right},length};
 }

 // Two-degree-of-freedom Ritz plate used only by the asymmetric compact
 // teaching model. This is a declared stiffness assumption, not a fitted machine.
 // X=x/a, Z=z/b; both modes vanish at the four existing corner supports.
 const compactBendingCache=new Map();
 function compactBending(solution,width,depth,options={}){
  const a=finite(width,'width')/2,b=finite(depth,'depth')/2,alpha=finite(options.asymmetry??.5,'asymmetry'),nu=finite(options.poisson??.3,'poisson');
  if(a<=0||b<=0||Math.abs(alpha)>=1||Math.abs(nu)>=1)throw new RangeError('寸法は正、剛性分布と曲率エネルギーは正定値にしてください。');
  const key=[a,b,alpha,nu].join(',');let system=compactBendingCache.get(key);
  const curves=(X,Z)=>[[0,0,1/(a*b)],[-2*Z/(a*a),0,-2*X/(a*b)],[-2*Z*Z*Z/(a*a),6*Z*(1-X*X)/(b*b),-6*X*Z*Z/(a*b)]];
  if(!system){
   // Four-point Gauss-Legendre in each direction is exact through degree 7.
   // With D=1+alpha*X the curvature products have degrees at most (5,6).
   const nodes=[-.8611363115940526,-.3399810435848563,.3399810435848563,.8611363115940526],weights=[.3478548451374538,.6521451548625461,.6521451548625461,.3478548451374538],K=[[0,0],[0,0]],f=[0,0];
   const inner=(p,q)=>p[0]*q[0]+p[1]*q[1]+nu*(p[0]*q[1]+p[1]*q[0])+2*(1-nu)*p[2]*q[2];
   nodes.forEach((X,i)=>nodes.forEach((Z,j)=>{const c=curves(X,Z),w=weights[i]*weights[j]*a*b*(1+alpha*X);for(let m=0;m<2;m++){f[m]+=w*inner(c[m+1],c[0]);for(let n=0;n<2;n++)K[m][n]+=w*inner(c[m+1],c[n+1]);}}));
   const determinant=K[0][0]*K[1][1]-K[0][1]*K[1][0];if(!(determinant>0))throw new RangeError('曲げエネルギーの最小解が定まりません。');
   const coefficients=[(-K[1][1]*f[0]+K[0][1]*f[1])/determinant,(K[1][0]*f[0]-K[0][0]*f[1])/determinant];
   system={K,f,coefficients};if(compactBendingCache.size>=24)compactBendingCache.clear();compactBendingCache.set(key,system);
  }
  // The four-corner residual has one twist amplitude. Affine seating changes
  // do not enter this forcing and remain the outer common rigid rotation.
  const t=solution.twist*width/4,q=system.coefficients.map(c=>c*t);
  const query=(x,z)=>[finite(x,'x')/a,finite(z,'z')/b];
  const heightAt=(x,z)=>{const [X,Z]=query(x,z);return solution.heightAt(x,z)+(1-X*X)*(q[0]*Z+q[1]*Z*Z*Z);};
  const slopeAt=(x,z)=>{const [X,Z]=query(x,z),base=solution.slopeAt(x,z);return {lr:base.lr-2*X*(q[0]*Z+q[1]*Z*Z*Z)/a,fb:base.fb+(1-X*X)*(q[0]+3*q[1]*Z*Z)/b};};
  const hessianAt=(x,z)=>{const [X,Z]=query(x,z),c=curves(X,Z);return {xx:q[0]*c[1][0]+q[1]*c[2][0],zz:q[0]*c[1][1]+q[1]*c[2][1],xz:t*c[0][2]+q[0]*c[1][2]+q[1]*c[2][2]};};
  return {...solution,heightAt,slopeAt,hessianAt,bending:{kind:'two-mode-ritz',asymmetry:alpha,poisson:nu,halfWidth:a,halfDepth:b,twistAmplitude:t,q1:q[0],q3:q[1],K:system.K.map(row=>[...row]),forcing:system.f.map(v=>v*t)}};
 }

 // Frame constructors used by the connected bridge teaching model. A common
 // rotation is composed after local deformation; it cannot change dot products.
 function frame(right,up,back){return {right,up,back,rotate:v=>right.map((q,i)=>q*v[0]+up[i]*v[1]+back[i]*v[2])};}
 function compose(a,b){return frame(a.rotate(b.right),a.rotate(b.up),a.rotate(b.back));}
 function bridge(left,right,up){
  const unit=v=>{const n=Math.hypot(...v);if(n<1e-12)throw new RangeError('梁の両端が重なっています。');return v.map(q=>q/n);};
  const x=unit(right.map((v,i)=>v-left[i])),dot=x.reduce((s,v,i)=>s+v*up[i],0),y=unit(up.map((v,i)=>v-dot*x[i]));
  return frame(x,y,[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]]);
 }
 return Object.freeze({solve,impact,orientation,geometry,frame,compose,bridge,compactBending});
});

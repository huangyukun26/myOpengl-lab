(()=>{
const canvas=document.getElementById('gl');
const gl=canvas.getContext('webgl2',{antialias:true});
if(!gl){document.body.innerHTML='<p style="padding:24px">需要支持 WebGL2 的浏览器。</p>';return;}

function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s}
function program(vs,fs){const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p}

const vs=[
'#version 300 es',
'layout(location=0) in vec3 aPos;',
'layout(location=1) in vec3 aNormal;',
'layout(location=2) in vec2 aUV;',
'layout(location=3) in vec3 aTangent;',
'layout(location=4) in vec3 aBitangent;',
'uniform mat4 uModel;',
'uniform mat4 uVP;',
'uniform vec3 uLightPos;',
'uniform vec3 uViewPos;',
'out vec2 TexCoords;',
'out vec3 TangentLightPos;',
'out vec3 TangentViewPos;',
'out vec3 TangentFragPos;',
'void main(){',
'  vec3 fragPos=vec3(uModel*vec4(aPos,1.0));',
'  TexCoords=aUV;',
'  vec3 T=normalize(mat3(uModel)*aTangent);',
'  vec3 B=normalize(mat3(uModel)*aBitangent);',
'  vec3 N=normalize(mat3(uModel)*aNormal);',
'  mat3 TBN=transpose(mat3(T,B,N));',
'  TangentLightPos=TBN*uLightPos;',
'  TangentViewPos=TBN*uViewPos;',
'  TangentFragPos=TBN*fragPos;',
'  gl_Position=uVP*vec4(fragPos,1.0);',
'}'
].join('\n');

const fs=[
'#version 300 es','precision highp float;',
'in vec2 TexCoords;',
'in vec3 TangentLightPos;',
'in vec3 TangentViewPos;',
'in vec3 TangentFragPos;',
'out vec4 FragColor;',
'uniform sampler2D uDiffuse;',
'uniform sampler2D uNormal;',
'uniform sampler2D uDepth;',
'uniform float uHeightScale;',
'uniform int uMethod;',
'vec2 parallaxBasic(vec2 uv,vec3 V){',
'  float d=texture(uDepth,uv).r;',
'  float vz=max(V.z,0.08);',
'  vec2 p=(V.xy/vz)*(d*uHeightScale);',
'  return uv-p;',
'}',
'vec2 parallaxSteep(vec2 uv,vec3 V,bool interpolateHit){',
'  float ndv=abs(dot(vec3(0.0,0.0,1.0),V));',
'  float layers=mix(32.0,8.0,ndv);',
'  float layerDepth=1.0/layers;',
'  float currentLayerDepth=0.0;',
'  float vz=max(V.z,0.08);',
'  vec2 P=(V.xy/vz)*uHeightScale;',
'  vec2 delta=P/layers;',
'  vec2 currentUV=uv;',
'  float currentDepth=texture(uDepth,currentUV).r;',
'  for(int i=0;i<40;i++){',
'    if(currentLayerDepth>=currentDepth)break;',
'    currentUV-=delta;',
'    currentDepth=texture(uDepth,currentUV).r;',
'    currentLayerDepth+=layerDepth;',
'  }',
'  if(!interpolateHit)return currentUV;',
'  vec2 prevUV=currentUV+delta;',
'  float afterDepth=currentDepth-currentLayerDepth;',
'  float beforeDepth=texture(uDepth,prevUV).r-currentLayerDepth+layerDepth;',
'  float denom=afterDepth-beforeDepth;',
'  float weight=abs(denom)<0.0001?0.5:afterDepth/denom;',
'  return prevUV*weight+currentUV*(1.0-weight);',
'}',
'void main(){',
'  vec3 V=normalize(TangentViewPos-TangentFragPos);',
'  vec2 uv=TexCoords;',
'  if(uMethod==1)uv=parallaxBasic(uv,V);',
'  else if(uMethod==2)uv=parallaxSteep(uv,V,false);',
'  else if(uMethod==3)uv=parallaxSteep(uv,V,true);',
'  if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0)discard;',
'  vec3 normal=texture(uNormal,uv).rgb*2.0-1.0;',
'  normal=normalize(normal);',
'  vec3 color=texture(uDiffuse,uv).rgb;',
'  vec3 L=normalize(TangentLightPos-TangentFragPos);',
'  float diff=max(dot(normal,L),0.0);',
'  vec3 H=normalize(L+V);',
'  float spec=pow(max(dot(normal,H),0.0),40.0);',
'  vec3 result=0.12*color+0.95*diff*color+vec3(0.22)*spec;',
'  FragColor=vec4(result,1.0);',
'}'
].join('\n');

const texVS=[
'#version 300 es',
'layout(location=0) in vec2 aPos;',
'out vec2 uv;',
'void main(){uv=aPos*0.5+0.5;gl_Position=vec4(aPos,0.0,1.0);}'
].join('\n');
const texFS=[
'#version 300 es','precision highp float;',
'in vec2 uv;out vec4 FragColor;',
'uniform sampler2D uTex;',
'void main(){float d=texture(uTex,uv).r;FragColor=vec4(vec3(d),1.0);}'
].join('\n');

const mainP=program(vs,fs),texP=program(texVS,texFS);

const verts=new Float32Array([
-1,-1,0, 0,0,1, 0,0, 1,0,0, 0,1,0,
 1,-1,0, 0,0,1, 1,0, 1,0,0, 0,1,0,
 1, 1,0, 0,0,1, 1,1, 1,0,0, 0,1,0,
-1,-1,0, 0,0,1, 0,0, 1,0,0, 0,1,0,
 1, 1,0, 0,0,1, 1,1, 1,0,0, 0,1,0,
-1, 1,0, 0,0,1, 0,1, 1,0,0, 0,1,0
]);
const vao=gl.createVertexArray();gl.bindVertexArray(vao);
const vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,verts,gl.STATIC_DRAW);
const stride=14*4;
[[0,3,0],[1,3,12],[2,2,24],[3,3,32],[4,3,44]].forEach(([loc,size,off])=>{gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,stride,off)});
gl.bindVertexArray(null);

const qvao=gl.createVertexArray();gl.bindVertexArray(qvao);
const qbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,qbo);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.bindVertexArray(null);

function norm(v){const l=Math.hypot(v[0],v[1],v[2])||1;return[v[0]/l,v[1]/l,v[2]/l]}
function makeTextures(size){
  const diffuse=new Uint8Array(size*size*3);
  const depth=new Uint8Array(size*size);
  const height=new Float32Array(size*size);
  const bw=64,bh=32,m=5;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const row=Math.floor(y/bh);
    const offset=(row%2)*bw*0.5;
    let lx=(x+offset)%bw;if(lx<0)lx+=bw;
    const ly=y%bh;
    const dx=Math.min(lx,bw-lx),dy=Math.min(ly,bh-ly);
    const edge=Math.min(dx,dy);
    const brick=Math.max(0,Math.min(1,(edge-m)/5));
    const h=0.2+0.75*brick;
    height[y*size+x]=h;
    const dep=1-h;
    depth[y*size+x]=Math.round(dep*255);
    const k=(y*size+x)*3;
    const mortar=brick<0.15;
    const n=0.92+0.08*Math.sin(x*.18+y*.11);
    if(mortar){diffuse[k]=118;diffuse[k+1]=114;diffuse[k+2]=106;}
    else{diffuse[k]=Math.round(175*n);diffuse[k+1]=Math.round(78*n);diffuse[k+2]=Math.round(48*n);}
  }
  const normal=new Uint8Array(size*size*3);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const xm=(x-1+size)%size,xp=(x+1)%size,ym=(y-1+size)%size,yp=(y+1)%size;
    const dhx=height[y*size+xp]-height[y*size+xm];
    const dhy=height[yp*size+x]-height[ym*size+x];
    const n=norm([-dhx*8,-dhy*8,1]);
    const k=(y*size+x)*3;
    normal[k]=Math.round((n[0]*.5+.5)*255);
    normal[k+1]=Math.round((n[1]*.5+.5)*255);
    normal[k+2]=Math.round((n[2]*.5+.5)*255);
  }
  return {diffuse,normal,depth};
}
function uploadRGB(data,size){
  const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB8,size,size,0,gl.RGB,gl.UNSIGNED_BYTE,data);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  return t;
}
function uploadR(data,size){
  const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,size,size,0,gl.RED,gl.UNSIGNED_BYTE,data);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  return t;
}
const td=makeTextures(256);
const diffuseTex=uploadRGB(td.diffuse,256),normalTex=uploadRGB(td.normal,256),depthTex=uploadR(td.depth,256);

function id(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])}
function mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s}return o}
function perspective(fov,a,n,f){const t=1/Math.tan(fov/2),nf=1/(n-f);return new Float32Array([t/a,0,0,0,0,t,0,0,0,0,(f+n)*nf,-1,0,0,2*f*n*nf,0])}
function sub(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]]}
function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}
function lookAt(e,c,u){const z=norm(sub(e,c)),x=norm(cross(u,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,e),-dot(y,e),-dot(z,e),1])}

let mode='compare',heightScale=.065,lightX=.7,animate=false;
let yaw=.55,pitch=.18,distance=3.3,drag=false,lastX=0,lastY=0;
const labels=document.getElementById('compareLabels');

canvas.addEventListener('pointerdown',e=>{drag=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;yaw+=dx*.006;pitch=Math.max(-.75,Math.min(.75,pitch-dy*.006))});
canvas.addEventListener('pointerup',e=>{drag=false;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId)});
canvas.addEventListener('pointercancel',()=>drag=false);
canvas.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(2.2,Math.min(6,distance*Math.exp(e.deltaY*.001)))},{passive:false});

document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');mode=b.dataset.mode;syncCopy()});
document.getElementById('heightScale').oninput=e=>{heightScale=+e.target.value;document.getElementById('heightScaleVal').textContent=heightScale.toFixed(3)};
document.getElementById('lightX').oninput=e=>{lightX=+e.target.value;document.getElementById('lightXVal').textContent=lightX.toFixed(2)};
document.getElementById('animate').onclick=e=>{animate=!animate;e.currentTarget.classList.toggle('active',animate);e.currentTarget.textContent=animate?'停止移动':'移动光源'};
document.getElementById('reset').onclick=()=>{yaw=.55;pitch=.18;distance=3.3};

function syncCopy(){
  labels.hidden=mode!=='compare';
  const t=document.getElementById('modeTitle'),p=document.getElementById('modeText');
  if(mode==='basic'){t.textContent='Basic Parallax';p.textContent='只在原始 UV 读取一次 Depth，并用 viewDir 估算一次偏移。';}
  else if(mode==='steep'){t.textContent='Steep Parallax';p.textContent='把深度分层，沿观察方向逐层移动 UV，直到第一次穿过假想表面。';}
  else if(mode==='pom'){t.textContent='Parallax Occlusion Mapping';p.textContent='先找到穿过表面的前后两层，再在线性插值后得到更接近真实交点的 UV。';}
  else if(mode==='depth'){t.textContent='Depth Map';p.textContent='亮处代表更深的位置；Parallax 会根据这些深度值决定 UV 应该沿观察方向移动多少。';}
  else{t.textContent='Normal Mapping vs POM';p.textContent='左边只改变法线；右边先沿 Tangent Space 的 viewDir 搜索新的 UV，再用新 UV 采颜色和法线。';}
}

function drawPlane(x,w,method,eye,lightPos){
  gl.viewport(x,0,w,canvas.height);
  gl.enable(gl.DEPTH_TEST);
  gl.clear(gl.DEPTH_BUFFER_BIT);
  const vp=mul(perspective(45*Math.PI/180,w/canvas.height,.1,20),lookAt(eye,[0,0,0],[0,1,0]));
  gl.useProgram(mainP);
  gl.uniformMatrix4fv(gl.getUniformLocation(mainP,'uModel'),false,id());
  gl.uniformMatrix4fv(gl.getUniformLocation(mainP,'uVP'),false,vp);
  gl.uniform3fv(gl.getUniformLocation(mainP,'uLightPos'),lightPos);
  gl.uniform3fv(gl.getUniformLocation(mainP,'uViewPos'),eye);
  gl.uniform1f(gl.getUniformLocation(mainP,'uHeightScale'),heightScale);
  gl.uniform1i(gl.getUniformLocation(mainP,'uMethod'),method);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,diffuseTex);gl.uniform1i(gl.getUniformLocation(mainP,'uDiffuse'),0);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,normalTex);gl.uniform1i(gl.getUniformLocation(mainP,'uNormal'),1);
  gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,depthTex);gl.uniform1i(gl.getUniformLocation(mainP,'uDepth'),2);
  gl.bindVertexArray(vao);gl.drawArrays(gl.TRIANGLES,0,6);
}

function frame(t){
  gl.viewport(0,0,canvas.width,canvas.height);
  gl.clearColor(.045,.055,.075,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  const eye=[distance*Math.sin(yaw)*Math.cos(pitch),distance*Math.sin(pitch),distance*Math.cos(yaw)*Math.cos(pitch)];
  const lx=animate?Math.sin(t*.001)*1.4:lightX;
  const lightPos=[lx,1.15,2.0];

  if(mode==='depth'){
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(texP);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,depthTex);
    gl.uniform1i(gl.getUniformLocation(texP,'uTex'),0);
    gl.bindVertexArray(qvao);gl.viewport(0,0,canvas.width,canvas.height);gl.drawArrays(gl.TRIANGLES,0,6);
  }else if(mode==='compare'){
    const half=Math.floor(canvas.width/2);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0,0,half-3,canvas.height);drawPlane(0,half-3,0,eye,lightPos);
    gl.scissor(half+3,0,canvas.width-half-3,canvas.height);drawPlane(half+3,canvas.width-half-3,3,eye,lightPos);
    gl.disable(gl.SCISSOR_TEST);
  }else{
    const method=mode==='basic'?1:mode==='steep'?2:3;
    drawPlane(0,canvas.width,method,eye,lightPos);
  }
  requestAnimationFrame(frame);
}
syncCopy();requestAnimationFrame(frame);
})();
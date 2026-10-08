(()=>{
const canvas=document.getElementById('gl');
const gl=canvas.getContext('webgl2',{antialias:true});
if(!gl){document.body.innerHTML='<p style="padding:24px">需要支持 WebGL2 的浏览器。</p>';return;}

function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s}
function program(vs,fs){const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p}

const vs=['#version 300 es',
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
'  mat3 normalMatrix=transpose(inverse(mat3(uModel)));',
'  vec3 T=normalize(normalMatrix*aTangent);',
'  vec3 N=normalize(normalMatrix*aNormal);',
'  T=normalize(T-dot(T,N)*N);',
'  vec3 B=cross(N,T);',
'  mat3 worldToTangent=transpose(mat3(T,B,N));',
'  TangentLightPos=worldToTangent*uLightPos;',
'  TangentViewPos=worldToTangent*uViewPos;',
'  TangentFragPos=worldToTangent*fragPos;',
'  gl_Position=uVP*vec4(fragPos,1.0);',
'}'].join('\n');

const fs=['#version 300 es','precision highp float;',
'in vec2 TexCoords;',
'in vec3 TangentLightPos;',
'in vec3 TangentViewPos;',
'in vec3 TangentFragPos;',
'out vec4 FragColor;',
'uniform sampler2D uDiffuse;',
'uniform sampler2D uNormal;',
'uniform int uUseNormalMap;',
'uniform float uStrength;',
'void main(){',
'  vec3 color=texture(uDiffuse,TexCoords).rgb;',
'  vec3 normal=vec3(0.0,0.0,1.0);',
'  if(uUseNormalMap==1){',
'    normal=texture(uNormal,TexCoords).rgb*2.0-1.0;',
'    normal.xy*=uStrength;',
'    normal=normalize(normal);',
'  }',
'  vec3 lightDir=normalize(TangentLightPos-TangentFragPos);',
'  vec3 viewDir=normalize(TangentViewPos-TangentFragPos);',
'  float diff=max(dot(normal,lightDir),0.0);',
'  vec3 halfway=normalize(lightDir+viewDir);',
'  float spec=pow(max(dot(normal,halfway),0.0),48.0);',
'  vec3 ambient=0.10*color;',
'  vec3 result=ambient+0.92*diff*color+vec3(0.24)*spec;',
'  FragColor=vec4(result,1.0);',
'}'].join('\n');

const texVS=['#version 300 es',
'layout(location=0) in vec2 aPos;',
'out vec2 uv;',
'void main(){uv=aPos*0.5+0.5;gl_Position=vec4(aPos,0.0,1.0);}'].join('\n');
const texFS=['#version 300 es','precision highp float;',
'in vec2 uv;out vec4 FragColor;',
'uniform sampler2D uTex;',
'void main(){FragColor=vec4(texture(uTex,uv).rgb,1.0);}'].join('\n');

const mainP=program(vs,fs),texP=program(texVS,texFS);

function normalize3(v){const l=Math.hypot(v[0],v[1],v[2])||1;return[v[0]/l,v[1]/l,v[2]/l]}
function sub3(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]]}

const p1=[-1,1,0],p2=[-1,-1,0],p3=[1,-1,0],p4=[1,1,0];
const uv1=[0,1],uv2=[0,0],uv3=[1,0],uv4=[1,1];
function tb(a,b,c,ua,ub,uc){
  const e1=sub3(b,a),e2=sub3(c,a);
  const du1=[ub[0]-ua[0],ub[1]-ua[1]],du2=[uc[0]-ua[0],uc[1]-ua[1]];
  const f=1/(du1[0]*du2[1]-du2[0]*du1[1]);
  const T=normalize3([
    f*(du2[1]*e1[0]-du1[1]*e2[0]),
    f*(du2[1]*e1[1]-du1[1]*e2[1]),
    f*(du2[1]*e1[2]-du1[1]*e2[2])
  ]);
  const B=normalize3([
    f*(-du2[0]*e1[0]+du1[0]*e2[0]),
    f*(-du2[0]*e1[1]+du1[0]*e2[1]),
    f*(-du2[0]*e1[2]+du1[0]*e2[2])
  ]);
  return [T,B];
}
const [T1,B1]=tb(p1,p2,p3,uv1,uv2,uv3),[T2,B2]=tb(p1,p3,p4,uv1,uv3,uv4);
const N=[0,0,1];
const verts=[];
function pushVertex(p,uv,T,B){verts.push(...p,...N,...uv,...T,...B)}
pushVertex(p1,uv1,T1,B1);pushVertex(p2,uv2,T1,B1);pushVertex(p3,uv3,T1,B1);
pushVertex(p1,uv1,T2,B2);pushVertex(p3,uv3,T2,B2);pushVertex(p4,uv4,T2,B2);

const vao=gl.createVertexArray();gl.bindVertexArray(vao);
const vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);
const stride=14*4;
[[0,3,0],[1,3,12],[2,2,24],[3,3,32],[4,3,44]].forEach(([loc,size,off])=>{gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,stride,off)});
gl.bindVertexArray(null);

const quadVAO=gl.createVertexArray();gl.bindVertexArray(quadVAO);
const qb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,qb);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.bindVertexArray(null);

function makeBrickTextures(size){
  const diffuse=new Uint8Array(size*size*3);
  const height=new Float32Array(size*size);
  const brickW=64,brickH=32,mortar=4;
  function hAt(x,y){
    const row=Math.floor(y/brickH);
    const off=(row%2)*brickW*0.5;
    let lx=(x+off)%brickW;if(lx<0)lx+=brickW;
    const ly=y%brickH;
    const dx=Math.min(lx,brickW-lx),dy=Math.min(ly,brickH-ly);
    const edge=Math.min(dx,dy);
    const rise=Math.max(0,Math.min(1,(edge-mortar)/5));
    const noise=0.035*Math.sin(x*.31)*Math.sin(y*.27)+0.02*Math.sin(x*.13+y*.19);
    return Math.max(0,0.18+0.72*rise+noise);
  }
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=y*size+x;
    const row=Math.floor(y/brickH),off=(row%2)*brickW*0.5;
    let lx=(x+off)%brickW;if(lx<0)lx+=brickW;
    const ly=y%brickH;
    const mortarPixel=lx<mortar||lx>brickW-mortar||ly<mortar||ly>brickH-mortar;
    const n=0.92+0.08*Math.sin(x*.17+y*.11);
    const k=i*3;
    if(mortarPixel){diffuse[k]=126;diffuse[k+1]=121;diffuse[k+2]=111;}
    else{diffuse[k]=Math.min(255,Math.round(165*n));diffuse[k+1]=Math.round(73*n);diffuse[k+2]=Math.round(45*n);}
    height[i]=hAt(x,y);
  }
  const normal=new Uint8Array(size*size*3);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const xm=(x-1+size)%size,xp=(x+1)%size,ym=(y-1+size)%size,yp=(y+1)%size;
    const dx=height[y*size+xp]-height[y*size+xm];
    const dy=height[yp*size+x]-height[ym*size+x];
    const nn=normalize3([-dx*7,-dy*7,1]);
    const k=(y*size+x)*3;
    normal[k]=Math.round((nn[0]*.5+.5)*255);
    normal[k+1]=Math.round((nn[1]*.5+.5)*255);
    normal[k+2]=Math.round((nn[2]*.5+.5)*255);
  }
  return {diffuse,normal};
}
function uploadTexture(data,size){
  const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB8,size,size,0,gl.RGB,gl.UNSIGNED_BYTE,data);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  return t;
}
const texData=makeBrickTextures(256);
const diffuseTex=uploadTexture(texData.diffuse,256);
const normalTex=uploadTexture(texData.normal,256);

function id(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])}
function mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s}return o}
function rotX(a){const c=Math.cos(a),s=Math.sin(a);return new Float32Array([1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1])}
function rotY(a){const c=Math.cos(a),s=Math.sin(a);return new Float32Array([c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1])}
function perspective(fov,a,n,f){const t=1/Math.tan(fov/2),nf=1/(n-f);return new Float32Array([t/a,0,0,0,0,t,0,0,0,0,(f+n)*nf,-1,0,0,2*f*n*nf,0])}
function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}
function lookAt(e,c,u){const z=normalize3(sub3(e,c)),x=normalize3(cross(u,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,e),-dot(y,e),-dot(z,e),1])}

let mode='compare',strength=1,lightX=.7,lightY=.9,animate=false,rx=-.12,ry=.25;
let dragging=false,lastX=0,lastY=0;
const labels=document.getElementById('compareLabels');

canvas.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;ry+=dx*.008;rx+=dy*.008;rx=Math.max(-1.15,Math.min(1.15,rx))});
canvas.addEventListener('pointerup',e=>{dragging=false;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId)});
canvas.addEventListener('pointercancel',()=>dragging=false);

document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');mode=b.dataset.mode;syncCopy()});
document.getElementById('strength').oninput=e=>{strength=+e.target.value;document.getElementById('strengthVal').textContent=strength.toFixed(2)};
document.getElementById('lightX').oninput=e=>{lightX=+e.target.value;document.getElementById('lightXVal').textContent=lightX.toFixed(2)};
document.getElementById('lightY').oninput=e=>{lightY=+e.target.value;document.getElementById('lightYVal').textContent=lightY.toFixed(2)};
document.getElementById('animate').onclick=e=>{animate=!animate;e.currentTarget.classList.toggle('active',animate);e.currentTarget.textContent=animate?'停止移动':'移动光源'};
document.getElementById('reset').onclick=()=>{rx=-.12;ry=.25;lightX=.7;lightY=.9;document.getElementById('lightX').value=lightX;document.getElementById('lightY').value=lightY;document.getElementById('lightXVal').textContent=lightX.toFixed(2);document.getElementById('lightYVal').textContent=lightY.toFixed(2)};

function syncCopy(){
  const t=document.getElementById('modeTitle'),p=document.getElementById('modeText');
  labels.hidden=mode!=='compare';
  if(mode==='normal'){
    t.textContent='Normal Map';
    p.textContent='RGB 编码切线空间法线。蓝色占主导是因为大多数法线接近 Tangent Space 的 +Z。';
  }else{
    t.textContent='同一几何，不同法线';
    p.textContent='左侧整块平面使用几何法线；右侧每个 Fragment 从 Normal Map 读取自己的切线空间法线。';
  }
}

function drawPlane(viewX,viewW,useNormal,model,lightPos){
  gl.viewport(viewX,0,viewW,canvas.height);
  gl.enable(gl.DEPTH_TEST);
  gl.clear(gl.DEPTH_BUFFER_BIT);
  const eye=[0,0,3.2],target=[0,0,0];
  const vp=mul(perspective(46*Math.PI/180,viewW/canvas.height,.1,20),lookAt(eye,target,[0,1,0]));
  gl.useProgram(mainP);
  gl.uniformMatrix4fv(gl.getUniformLocation(mainP,'uModel'),false,model);
  gl.uniformMatrix4fv(gl.getUniformLocation(mainP,'uVP'),false,vp);
  gl.uniform3fv(gl.getUniformLocation(mainP,'uLightPos'),lightPos);
  gl.uniform3fv(gl.getUniformLocation(mainP,'uViewPos'),eye);
  gl.uniform1i(gl.getUniformLocation(mainP,'uUseNormalMap'),useNormal?1:0);
  gl.uniform1f(gl.getUniformLocation(mainP,'uStrength'),strength);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,diffuseTex);gl.uniform1i(gl.getUniformLocation(mainP,'uDiffuse'),0);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,normalTex);gl.uniform1i(gl.getUniformLocation(mainP,'uNormal'),1);
  gl.bindVertexArray(vao);gl.drawArrays(gl.TRIANGLES,0,6);
}

function frame(t){
  gl.viewport(0,0,canvas.width,canvas.height);
  gl.clearColor(.045,.055,.075,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  const lx=animate?Math.sin(t*.001)*1.45:lightX;
  const ly=animate?.65+Math.cos(t*.00073)*.75:lightY;
  const lightPos=[lx,ly,1.25];
  const model=mul(rotY(ry),rotX(rx));

  if(mode==='normal'){
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(texP);
    gl.viewport(0,0,canvas.width,canvas.height);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,normalTex);
    gl.uniform1i(gl.getUniformLocation(texP,'uTex'),0);
    gl.bindVertexArray(quadVAO);gl.drawArrays(gl.TRIANGLES,0,6);
  }else{
    const half=Math.floor(canvas.width/2);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0,0,half-3,canvas.height);drawPlane(0,half-3,false,model,lightPos);
    gl.scissor(half+3,0,canvas.width-half-3,canvas.height);drawPlane(half+3,canvas.width-half-3,true,model,lightPos);
    gl.disable(gl.SCISSOR_TEST);
  }
  requestAnimationFrame(frame);
}
syncCopy();requestAnimationFrame(frame);
})();
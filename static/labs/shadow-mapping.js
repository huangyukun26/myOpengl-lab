(()=>{
const canvas=document.getElementById('gl');
const gl=canvas.getContext('webgl2',{antialias:true});
if(!gl){document.body.innerHTML='<p style="padding:24px">需要支持 WebGL2 的浏览器。</p>';return;}

function sh(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s}
function prog(vs,fs){const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,vs));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p}

const depthVS=['#version 300 es',
'layout(location=0) in vec3 aPos;',
'uniform mat4 uMVP;',
'void main(){gl_Position=uMVP*vec4(aPos,1.0);}'].join('\n');
const depthFS=['#version 300 es','precision highp float;','void main(){}'].join('\n');

const sceneVS=['#version 300 es',
'layout(location=0) in vec3 aPos;',
'layout(location=1) in vec3 aNormal;',
'uniform mat4 uModel;',
'uniform mat4 uVP;',
'uniform mat4 uLightSpace;',
'out vec3 FragPos;',
'out vec3 Normal;',
'out vec4 FragPosLight;',
'void main(){vec4 w=uModel*vec4(aPos,1.0);FragPos=w.xyz;Normal=mat3(transpose(inverse(uModel)))*aNormal;FragPosLight=uLightSpace*w;gl_Position=uVP*w;}'].join('\n');

const sceneFS=['#version 300 es','precision highp float;',
'in vec3 FragPos;in vec3 Normal;in vec4 FragPosLight;out vec4 FragColor;',
'uniform sampler2D uShadow;',
'uniform vec3 uLightPos;',
'uniform vec3 uViewPos;',
'uniform float uBias;',
'uniform int uPCF;',
'uniform int uMode;',
'uniform vec3 uBaseColor;',
'float shadowCalc(){',
' vec3 p=FragPosLight.xyz/FragPosLight.w;',
' p=p*0.5+0.5;',
' if(p.z>1.0)return 0.0;',
' if(p.x<0.0||p.x>1.0||p.y<0.0||p.y>1.0)return 0.0;',
' vec3 N=normalize(Normal);',
' vec3 L=normalize(uLightPos-FragPos);',
' float bias=max(uBias*(1.0-dot(N,L)),uBias*0.25);',
' float current=p.z;',
' if(uPCF==0){float d=texture(uShadow,p.xy).r;return current-bias>d?1.0:0.0;}',
' vec2 ts=1.0/vec2(textureSize(uShadow,0));float s=0.0;',
' for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){float d=texture(uShadow,p.xy+vec2(x,y)*ts).r;s+=current-bias>d?1.0:0.0;}',
' return s/9.0;',
'}',
'void main(){',
' float shadow=shadowCalc();',
' if(uMode==2){FragColor=vec4(vec3(shadow),1.0);return;}',
' vec3 N=normalize(Normal);vec3 L=normalize(uLightPos-FragPos);vec3 V=normalize(uViewPos-FragPos);',
' float diff=max(dot(N,L),0.0);',
' vec3 base=uBaseColor;',
' vec3 color=(0.22+(1.0-shadow)*0.78*diff)*base;',
' FragColor=vec4(color,1.0);',
'}'].join('\n');

const debugVS=['#version 300 es','layout(location=0) in vec2 aPos;out vec2 uv;void main(){uv=aPos*0.5+0.5;gl_Position=vec4(aPos,0,1);}'].join('\n');
const debugFS=['#version 300 es','precision highp float;in vec2 uv;uniform sampler2D uDepth;out vec4 FragColor;void main(){float d=texture(uDepth,uv).r;FragColor=vec4(vec3(d),1.0);}'].join('\n');

const depthP=prog(depthVS,depthFS),sceneP=prog(sceneVS,sceneFS),debugP=prog(debugVS,debugFS);

const cubeData=new Float32Array([
  // back (-Z)
  -1,-1,-1, 0,0,-1,   1,-1,-1, 0,0,-1,   1, 1,-1, 0,0,-1,
   1, 1,-1, 0,0,-1,  -1, 1,-1, 0,0,-1,  -1,-1,-1, 0,0,-1,

  // front (+Z)
  -1,-1, 1, 0,0, 1,   1, 1, 1, 0,0, 1,   1,-1, 1, 0,0, 1,
  -1,-1, 1, 0,0, 1,  -1, 1, 1, 0,0, 1,   1, 1, 1, 0,0, 1,

  // left (-X)
  -1,-1,-1,-1,0,0,   -1, 1,-1,-1,0,0,   -1, 1, 1,-1,0,0,
  -1,-1,-1,-1,0,0,   -1, 1, 1,-1,0,0,   -1,-1, 1,-1,0,0,

  // right (+X)
   1,-1,-1, 1,0,0,    1, 1, 1, 1,0,0,    1, 1,-1, 1,0,0,
   1,-1,-1, 1,0,0,    1,-1, 1, 1,0,0,    1, 1, 1, 1,0,0,

  // bottom (-Y)
  -1,-1,-1,0,-1,0,   -1,-1, 1,0,-1,0,    1,-1, 1,0,-1,0,
  -1,-1,-1,0,-1,0,    1,-1, 1,0,-1,0,    1,-1,-1,0,-1,0,

  // top (+Y)
  -1, 1,-1,0,1,0,     1, 1, 1,0,1,0,    -1, 1, 1,0,1,0,
  -1, 1,-1,0,1,0,     1, 1,-1,0,1,0,     1, 1, 1,0,1,0
]);
const cubeVAO=gl.createVertexArray();gl.bindVertexArray(cubeVAO);
const cb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,cb);gl.bufferData(gl.ARRAY_BUFFER,cubeData,gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);

const planeData=new Float32Array([
-6,0,6,0,1,0, 6,0,-6,0,1,0,-6,0,-6,0,1,0,
-6,0,6,0,1,0, 6,0,6,0,1,0, 6,0,-6,0,1,0
]);
const planeVAO=gl.createVertexArray();gl.bindVertexArray(planeVAO);
const pb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,planeData,gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);

const quadVAO=gl.createVertexArray();gl.bindVertexArray(quadVAO);
const qb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,qb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);

const SH=1024;
const depthFBO=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,depthFBO);
const depthTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,depthTex);
gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,SH,SH,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,depthTex,0);
gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);
if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Depth framebuffer incomplete');
gl.bindFramebuffer(gl.FRAMEBUFFER,null);

function id(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])}
function mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s}return o}
function translate(x,y,z){const m=id();m[12]=x;m[13]=y;m[14]=z;return m}
function scale(x,y,z){const m=id();m[0]=x;m[5]=y;m[10]=z;return m}
function perspective(fov,a,n,f){const t=1/Math.tan(fov/2),nf=1/(n-f);return new Float32Array([t/a,0,0,0,0,t,0,0,0,0,(f+n)*nf,-1,0,0,2*f*n*nf,0])}
function ortho(l,r,b,t,n,f){return new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1])}
function norm(v){const L=Math.hypot(v[0],v[1],v[2]);return[v[0]/L,v[1]/L,v[2]/L]}
function sub(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]]}
function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}
function lookAt(e,c,u){const z=norm(sub(e,c)),x=norm(cross(u,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,e),-dot(y,e),-dot(z,e),1])}

const objects=[
 {vao:planeVAO,count:6,model:id(),color:[0.55,0.57,0.60]},
 {vao:cubeVAO,count:36,model:mul(translate(-0.65,0.75,0.0),scale(0.75,0.75,0.75)),color:[0.90,0.28,0.20]},
 {vao:cubeVAO,count:36,model:mul(translate(1.55,0.45,1.10),scale(0.45,0.45,0.45)),color:[0.18,0.45,0.92]}
];

let mode='final',bias=.010,lightX=-2,pcf=true,animate=false;
let yaw=38*Math.PI/180,pitch=24*Math.PI/180,distance=9.0;
let dragging=false,lastX=0,lastY=0;
canvas.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;yaw-=dx*.008;pitch=Math.max(-0.05,Math.min(1.35,pitch-dy*.008));});
canvas.addEventListener('pointerup',e=>{dragging=false;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);});
canvas.addEventListener('pointercancel',()=>dragging=false);
canvas.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(4.2,Math.min(15,distance*Math.exp(e.deltaY*.001)));},{passive:false});
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');mode=b.dataset.mode;sync();});
document.getElementById('bias').oninput=e=>{bias=+e.target.value;document.getElementById('biasVal').textContent=bias.toFixed(3);};
document.getElementById('light').oninput=e=>{lightX=+e.target.value;document.getElementById('lightVal').textContent=lightX.toFixed(1);};
document.getElementById('pcf').onclick=e=>{pcf=!pcf;e.currentTarget.classList.toggle('active',pcf);e.currentTarget.textContent=pcf?'PCF 3×3':'单次采样';};
document.getElementById('animate').onclick=e=>{animate=!animate;e.currentTarget.classList.toggle('active',animate);e.currentTarget.textContent=animate?'停止移动':'移动光源';};
function sync(){const t=document.getElementById('modeTitle'),p=document.getElementById('modeText');if(mode==='depth'){t.textContent='Depth Map';p.textContent='第一遍从光源视角只记录深度。亮度代表归一化后的深度值。';}else if(mode==='test'){t.textContent='Shadow Test';p.textContent='白色是被遮挡的片段，黑色是光源能直接看到的片段。';}else{t.textContent='最终阴影';p.textContent='Shadow Test 的结果只压低 Diffuse 和 Specular，Ambient 保留。';}}

function drawObjects(program,useDepth,lightSpace,vp,lightPos){
 for(const o of objects){
  if(useDepth){gl.uniformMatrix4fv(gl.getUniformLocation(program,'uMVP'),false,mul(lightSpace,o.model));}
  else{
   gl.uniformMatrix4fv(gl.getUniformLocation(program,'uModel'),false,o.model);
   gl.uniformMatrix4fv(gl.getUniformLocation(program,'uVP'),false,vp);
   gl.uniformMatrix4fv(gl.getUniformLocation(program,'uLightSpace'),false,lightSpace);
   gl.uniform3fv(gl.getUniformLocation(program,'uBaseColor'),o.color);
  }
  gl.bindVertexArray(o.vao);gl.drawArrays(gl.TRIANGLES,0,o.count);
 }
}

gl.enable(gl.DEPTH_TEST);
function frame(t){
 const lx=animate?Math.sin(t*.00055)*3.0:lightX;
 const lightPos=[lx,4.5,-2.0];
 const lightSpace=mul(ortho(-6,6,-6,6,1,12),lookAt(lightPos,[0,0,0],[0,1,0]));

 gl.viewport(0,0,SH,SH);gl.bindFramebuffer(gl.FRAMEBUFFER,depthFBO);gl.clear(gl.DEPTH_BUFFER_BIT);
 gl.useProgram(depthP);drawObjects(depthP,true,lightSpace,null,lightPos);

 gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);
 gl.clearColor(.055,.065,.08,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

 if(mode==='depth'){
  gl.disable(gl.DEPTH_TEST);gl.useProgram(debugP);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,depthTex);gl.uniform1i(gl.getUniformLocation(debugP,'uDepth'),0);gl.bindVertexArray(quadVAO);gl.drawArrays(gl.TRIANGLES,0,6);gl.enable(gl.DEPTH_TEST);
 }else{
  const target=[0,.65,.35];
  const eye=[target[0]+distance*Math.cos(pitch)*Math.sin(yaw),target[1]+distance*Math.sin(pitch),target[2]+distance*Math.cos(pitch)*Math.cos(yaw)];
  const vp=mul(perspective(47*Math.PI/180,canvas.width/canvas.height,.1,50),lookAt(eye,target,[0,1,0]));
  gl.useProgram(sceneP);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,depthTex);gl.uniform1i(gl.getUniformLocation(sceneP,'uShadow'),0);
  gl.uniform3fv(gl.getUniformLocation(sceneP,'uLightPos'),lightPos);gl.uniform3fv(gl.getUniformLocation(sceneP,'uViewPos'),eye);
  gl.uniform1f(gl.getUniformLocation(sceneP,'uBias'),bias);gl.uniform1i(gl.getUniformLocation(sceneP,'uPCF'),pcf?1:0);gl.uniform1i(gl.getUniformLocation(sceneP,'uMode'),mode==='test'?2:0);
  drawObjects(sceneP,false,lightSpace,vp,lightPos);
 }
 requestAnimationFrame(frame);
}
sync();requestAnimationFrame(frame);
})();
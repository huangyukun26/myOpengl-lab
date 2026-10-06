(()=>{
const canvas=document.getElementById('gl');
const gl=canvas.getContext('webgl2',{antialias:true});
if(!gl){document.body.innerHTML='<p style="padding:24px">需要支持 WebGL2 的浏览器。</p>';return;}

function makeShader(type,src){
  const s=gl.createShader(type);
  gl.shaderSource(s,src);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function makeProgram(vs,fs){
  const p=gl.createProgram();
  gl.attachShader(p,makeShader(gl.VERTEX_SHADER,vs));
  gl.attachShader(p,makeShader(gl.FRAGMENT_SHADER,fs));
  gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
  return p;
}

const depthVS=['#version 300 es',
'layout(location=0) in vec3 aPos;',
'uniform mat4 uModel;',
'uniform mat4 uLightVP;',
'out vec3 WorldPos;',
'void main(){',
'  vec4 w=uModel*vec4(aPos,1.0);',
'  WorldPos=w.xyz;',
'  gl_Position=uLightVP*w;',
'}'].join('\n');

const depthFS=['#version 300 es','precision highp float;',
'in vec3 WorldPos;',
'uniform vec3 uLightPos;',
'uniform float uFar;',
'void main(){',
'  float d=length(WorldPos-uLightPos);',
'  gl_FragDepth=d/uFar;',
'}'].join('\n');

const sceneVS=['#version 300 es',
'layout(location=0) in vec3 aPos;',
'layout(location=1) in vec3 aNormal;',
'uniform mat4 uModel;',
'uniform mat4 uVP;',
'out vec3 FragPos;',
'out vec3 Normal;',
'void main(){',
'  vec4 w=uModel*vec4(aPos,1.0);',
'  FragPos=w.xyz;',
'  Normal=normalize(mat3(uModel)*aNormal);',
'  gl_Position=uVP*w;',
'}'].join('\n');

const sceneFS=['#version 300 es','precision highp float;',
'in vec3 FragPos;in vec3 Normal;out vec4 FragColor;',
'uniform samplerCube uDepth;',
'uniform vec3 uLightPos;',
'uniform vec3 uViewPos;',
'uniform vec3 uBaseColor;',
'uniform float uFar;',
'uniform float uBias;',
'uniform int uSoft;',
'uniform int uShadows;',
'uniform int uMode;',
'uniform int uUnlit;',
'const vec3 offsets[20]=vec3[](',
' vec3(1,1,1),vec3(1,-1,1),vec3(-1,-1,1),vec3(-1,1,1),',
' vec3(1,1,-1),vec3(1,-1,-1),vec3(-1,-1,-1),vec3(-1,1,-1),',
' vec3(1,1,0),vec3(1,-1,0),vec3(-1,-1,0),vec3(-1,1,0),',
' vec3(1,0,1),vec3(-1,0,1),vec3(1,0,-1),vec3(-1,0,-1),',
' vec3(0,1,1),vec3(0,-1,1),vec3(0,-1,-1),vec3(0,1,-1)',
');',
'float shadowCalc(){',
'  if(uShadows==0)return 0.0;',
'  vec3 fragToLight=FragPos-uLightPos;',
'  float current=length(fragToLight);',
'  if(current>=uFar)return 0.0;',
'  if(uSoft==0){',
'    float closest=texture(uDepth,fragToLight).r*uFar;',
'    return current-uBias>closest?1.0:0.0;',
'  }',
'  float viewDistance=length(uViewPos-FragPos);',
'  float radius=(1.0+viewDistance/uFar)*0.08;',
'  float shadow=0.0;',
'  for(int i=0;i<20;i++){',
'    float closest=texture(uDepth,fragToLight+offsets[i]*radius).r*uFar;',
'    shadow+=current-uBias>closest?1.0:0.0;',
'  }',
'  return shadow/20.0;',
'}',
'void main(){',
'  if(uUnlit==1){FragColor=vec4(uBaseColor,1.0);return;}',
'  float shadow=shadowCalc();',
'  if(uMode==2){FragColor=vec4(vec3(shadow),1.0);return;}',
'  vec3 N=normalize(Normal);',
'  vec3 Lvec=uLightPos-FragPos;',
'  float dist=max(length(Lvec),0.001);',
'  vec3 L=Lvec/dist;',
'  float diff=max(dot(N,L),0.0);',
'  float attenuation=1.0/(1.0+0.09*dist+0.032*dist*dist);',
'  vec3 ambient=0.18*uBaseColor;',
'  vec3 diffuse=(1.0-shadow)*diff*attenuation*2.2*uBaseColor;',
'  FragColor=vec4(ambient+diffuse,1.0);',
'}'].join('\n');

const debugVS=['#version 300 es',
'layout(location=0) in vec2 aPos;',
'out vec2 uv;',
'void main(){uv=aPos*0.5+0.5;gl_Position=vec4(aPos,0.0,1.0);}'].join('\n');

const debugFS=['#version 300 es','precision highp float;',
'in vec2 uv;out vec4 FragColor;',
'uniform samplerCube uDepth;',
'uniform int uFace;',
'vec3 dirForFace(vec2 p){',
'  vec2 a=p*2.0-1.0;',
'  if(uFace==0)return vec3( 1.0,-a.y,-a.x);',
'  if(uFace==1)return vec3(-1.0,-a.y, a.x);',
'  if(uFace==2)return vec3( a.x, 1.0, a.y);',
'  if(uFace==3)return vec3( a.x,-1.0,-a.y);',
'  if(uFace==4)return vec3( a.x,-a.y, 1.0);',
'  return vec3(-a.x,-a.y,-1.0);',
'}',
'void main(){',
'  vec2 displayUV=vec2(uv.x,1.0-uv.y);',
'  float d=texture(uDepth,dirForFace(displayUV)).r;',
'  if(d>0.9999){FragColor=vec4(vec3(0.035),1.0);return;}',
'  float v=clamp(d/0.45,0.0,1.0);',
'  FragColor=vec4(vec3(0.12+0.88*v),1.0);',
'}'].join('\n');

const depthP=makeProgram(depthVS,depthFS);
const sceneP=makeProgram(sceneVS,sceneFS);
const debugP=makeProgram(debugVS,debugFS);

const cubeVerts=new Float32Array([
-1,-1,-1, 0,0,-1,  1,-1,-1, 0,0,-1,  1, 1,-1, 0,0,-1, -1, 1,-1,0,0,-1,
-1,-1, 1, 0,0, 1,  1,-1, 1, 0,0, 1,  1, 1, 1, 0,0, 1, -1, 1, 1,0,0, 1,
-1,-1,-1,-1,0,0, -1, 1,-1,-1,0,0, -1, 1, 1,-1,0,0, -1,-1, 1,-1,0,0,
 1,-1,-1, 1,0,0,  1, 1,-1, 1,0,0,  1, 1, 1, 1,0,0,  1,-1, 1, 1,0,0,
-1,-1,-1, 0,-1,0, -1,-1, 1,0,-1,0,  1,-1, 1,0,-1,0,  1,-1,-1,0,-1,0,
-1, 1,-1, 0,1,0, -1, 1, 1,0,1,0,  1, 1, 1,0,1,0,  1, 1,-1,0,1,0
]);
const cubeIdx=new Uint16Array([
0,1,2,0,2,3, 4,6,5,4,7,6, 8,9,10,8,10,11,
12,14,13,12,15,14, 16,18,17,16,19,18, 20,21,22,20,22,23
]);

function makeMesh(verts,idx,strideFloats){
  const vao=gl.createVertexArray();gl.bindVertexArray(vao);
  const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,verts,gl.STATIC_DRAW);
  const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,idx,gl.STATIC_DRAW);
  const stride=strideFloats*4;
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,stride,0);
  if(strideFloats>=6){gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,stride,12);}
  gl.bindVertexArray(null);
  return {vao,count:idx.length};
}
const cube=makeMesh(cubeVerts,cubeIdx,6);

const planeVerts=new Float32Array([
-6,0,-6, 0,1,0,  6,0,-6, 0,1,0,  6,0,6, 0,1,0, -6,0,6, 0,1,0
]);
const planeIdx=new Uint16Array([0,1,2,0,2,3]);
const plane=makeMesh(planeVerts,planeIdx,6);

const quadVAO=gl.createVertexArray();gl.bindVertexArray(quadVAO);
const quadBuf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quadBuf);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.bindVertexArray(null);

const SH=768,FAR=18.0,NEAR=0.1;
const depthCube=gl.createTexture();gl.bindTexture(gl.TEXTURE_CUBE_MAP,depthCube);
for(let i=0;i<6;i++)gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X+i,0,gl.DEPTH_COMPONENT24,SH,SH,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_WRAP_R,gl.CLAMP_TO_EDGE);

const depthFBO=gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER,depthFBO);
gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_CUBE_MAP_POSITIVE_X,depthCube,0);
gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);
if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Depth cubemap framebuffer incomplete');
gl.bindFramebuffer(gl.FRAMEBUFFER,null);

function id(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);}
function mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s;}return o;}
function translate(x,y,z){const m=id();m[12]=x;m[13]=y;m[14]=z;return m;}
function scale(x,y,z){const m=id();m[0]=x;m[5]=y;m[10]=z;return m;}
function perspective(fov,a,n,f){const t=1/Math.tan(fov/2),nf=1/(n-f);return new Float32Array([t/a,0,0,0,0,t,0,0,0,0,(f+n)*nf,-1,0,0,2*f*n*nf,0]);}
function norm(v){const L=Math.hypot(v[0],v[1],v[2]);return[v[0]/L,v[1]/L,v[2]/L];}
function sub(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function lookAt(e,c,u){
  const z=norm(sub(e,c)),x=norm(cross(u,z)),y=cross(z,x);
  return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,e),-dot(y,e),-dot(z,e),1]);
}

const scene=[
  {mesh:plane,model:id(),color:[0.52,0.54,0.58]},
  {mesh:cube,model:mul(translate(-1.65,.72,.15),scale(.72,.72,.72)),color:[0.90,0.24,0.18]},
  {mesh:cube,model:mul(translate(1.65,.52,1.25),scale(.52,.52,.52)),color:[0.18,0.43,0.92]}
];

let mode='final',bias=.08,lightX=0,soft=true,shadows=true,animate=false,face=0;
let yaw=42*Math.PI/180,pitch=25*Math.PI/180,distance=9.5;
let dragging=false,lastX=0,lastY=0;

canvas.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;yaw-=dx*.008;pitch=Math.max(-.02,Math.min(1.35,pitch-dy*.008));});
canvas.addEventListener('pointerup',e=>{dragging=false;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);});
canvas.addEventListener('pointercancel',()=>dragging=false);
canvas.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(4.5,Math.min(16,distance*Math.exp(e.deltaY*.001)));},{passive:false});

document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');mode=b.dataset.mode;syncCopy();
});
document.querySelectorAll('.face').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.face').forEach(x=>x.classList.remove('active'));b.classList.add('active');face=+b.dataset.face;
});
document.getElementById('bias').oninput=e=>{bias=+e.target.value;document.getElementById('biasVal').textContent=bias.toFixed(2);};
document.getElementById('lightX').oninput=e=>{lightX=+e.target.value;document.getElementById('lightXVal').textContent=lightX.toFixed(1);};
document.getElementById('soft').onclick=e=>{soft=!soft;e.currentTarget.classList.toggle('active',soft);e.currentTarget.textContent=soft?'Soft PCF':'Hard Shadow';};
document.getElementById('shadows').onclick=e=>{shadows=!shadows;e.currentTarget.classList.toggle('active',shadows);e.currentTarget.textContent=shadows?'Shadows ON':'Shadows OFF';};
document.getElementById('animate').onclick=e=>{animate=!animate;e.currentTarget.classList.toggle('active',animate);e.currentTarget.textContent=animate?'停止移动':'移动光源';};

function syncCopy(){
  const t=document.getElementById('modeTitle'),p=document.getElementById('modeText');
  if(mode==='depth'){t.textContent='Depth Cubemap';p.textContent='选择 +X 到 -Z 查看六个深度 face。亮度表示归一化后的径向距离。';}
  else if(mode==='test'){t.textContent='Shadow Test';p.textContent='白色表示当前距离比 Cubemap 中记录的最近距离更远。';}
  else{t.textContent='最终阴影';p.textContent='红色和蓝色立方体位于点光源两侧，阴影从光源位置向外投射。';}
}

function drawMesh(program,obj){
  gl.uniformMatrix4fv(gl.getUniformLocation(program,'uModel'),false,obj.model);
  gl.bindVertexArray(obj.mesh.vao);
  gl.drawElements(gl.TRIANGLES,obj.mesh.count,gl.UNSIGNED_SHORT,0);
}
function drawSceneDepth(lightVP,lightPos){
  gl.useProgram(depthP);
  gl.uniformMatrix4fv(gl.getUniformLocation(depthP,'uLightVP'),false,lightVP);
  gl.uniform3fv(gl.getUniformLocation(depthP,'uLightPos'),lightPos);
  gl.uniform1f(gl.getUniformLocation(depthP,'uFar'),FAR);
  for(const o of scene)drawMesh(depthP,o);
}
function drawSceneCamera(vp,eye,lightPos){
  gl.useProgram(sceneP);
  gl.uniformMatrix4fv(gl.getUniformLocation(sceneP,'uVP'),false,vp);
  gl.uniform3fv(gl.getUniformLocation(sceneP,'uLightPos'),lightPos);
  gl.uniform3fv(gl.getUniformLocation(sceneP,'uViewPos'),eye);
  gl.uniform1f(gl.getUniformLocation(sceneP,'uFar'),FAR);
  gl.uniform1f(gl.getUniformLocation(sceneP,'uBias'),bias);
  gl.uniform1i(gl.getUniformLocation(sceneP,'uSoft'),soft?1:0);
  gl.uniform1i(gl.getUniformLocation(sceneP,'uShadows'),shadows?1:0);
  gl.uniform1i(gl.getUniformLocation(sceneP,'uMode'),mode==='test'?2:0);
  gl.uniform1i(gl.getUniformLocation(sceneP,'uUnlit'),0);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_CUBE_MAP,depthCube);
  gl.uniform1i(gl.getUniformLocation(sceneP,'uDepth'),0);
  for(const o of scene){
    gl.uniform3fv(gl.getUniformLocation(sceneP,'uBaseColor'),o.color);
    drawMesh(sceneP,o);
  }
  const marker={mesh:cube,model:mul(translate(lightPos[0],lightPos[1],lightPos[2]),scale(.09,.09,.09)),color:[1.0,.86,.28]};
  gl.uniform1i(gl.getUniformLocation(sceneP,'uUnlit'),1);
  gl.uniform3fv(gl.getUniformLocation(sceneP,'uBaseColor'),marker.color);
  drawMesh(sceneP,marker);
  gl.uniform1i(gl.getUniformLocation(sceneP,'uUnlit'),0);
}

gl.enable(gl.DEPTH_TEST);
function frame(t){
  const lx=animate?Math.sin(t*.00055)*2.2:lightX;
  const lightPos=[lx,2.8,0.0];
  const proj=perspective(Math.PI/2,1,NEAR,FAR);
  const targets=[
    [[1,0,0],[0,-1,0]],[[-1,0,0],[0,-1,0]],[[0,1,0],[0,0,1]],
    [[0,-1,0],[0,0,-1]],[[0,0,1],[0,-1,0]],[[0,0,-1],[0,-1,0]]
  ];

  gl.viewport(0,0,SH,SH);
  gl.bindFramebuffer(gl.FRAMEBUFFER,depthFBO);
  gl.clearDepth(1.0);
  for(let i=0;i<6;i++){
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_CUBE_MAP_POSITIVE_X+i,depthCube,0);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    const dir=targets[i][0],up=targets[i][1];
    const view=lookAt(lightPos,[lightPos[0]+dir[0],lightPos[1]+dir[1],lightPos[2]+dir[2]],up);
    drawSceneDepth(mul(proj,view),lightPos);
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  gl.viewport(0,0,canvas.width,canvas.height);
  gl.clearColor(.045,.055,.075,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

  if(mode==='depth'){
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(debugP);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_CUBE_MAP,depthCube);
    gl.uniform1i(gl.getUniformLocation(debugP,'uDepth'),0);
    gl.uniform1i(gl.getUniformLocation(debugP,'uFace'),face);
    gl.bindVertexArray(quadVAO);gl.drawArrays(gl.TRIANGLES,0,6);
    gl.enable(gl.DEPTH_TEST);
  }else{
    const target=[0,.55,.2];
    const eye=[target[0]+distance*Math.cos(pitch)*Math.sin(yaw),target[1]+distance*Math.sin(pitch),target[2]+distance*Math.cos(pitch)*Math.cos(yaw)];
    const vp=mul(perspective(47*Math.PI/180,canvas.width/canvas.height,.1,50),lookAt(eye,target,[0,1,0]));
    drawSceneCamera(vp,eye,lightPos);
  }
  requestAnimationFrame(frame);
}
syncCopy();requestAnimationFrame(frame);
})();
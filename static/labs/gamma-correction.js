(()=>{
function boot(){
const canvas=document.getElementById('gl') || document.getElementById('view');
if(!canvas){console.error('Gamma Correction Lab: canvas not found');return;}
const gl=canvas.getContext('webgl2',{antialias:true});
if(!gl){document.body.innerHTML='<p style="padding:24px">需要支持 WebGL2 的浏览器。</p>';return;}

function shader(type,src){
  const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function program(vs,fs){
  const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
  return p;
}

const planeVS=['#version 300 es',
'layout(location=0) in vec3 aPos;',
'uniform mat4 uVP;',
'out vec3 FragPos;',
'out vec2 UV;',
'void main(){FragPos=aPos;UV=aPos.xz*0.55;gl_Position=uVP*vec4(aPos,1.0);}'].join('\n');

const planeFS=['#version 300 es','precision highp float;',
'in vec3 FragPos;in vec2 UV;out vec4 FragColor;',
'uniform vec3 uViewPos;',
'uniform vec3 uLightPos[4];',
'uniform vec3 uLightColor[4];',
'uniform float uIntensity;',
'uniform int uVariant;',
'vec3 woodSRGB(vec2 uv){',
'  float ring=sin((uv.x*6.0 + sin(uv.y*2.4)*0.8)*3.14159);',
'  float grain=sin((uv.x*38.0 + sin(uv.y*13.0)*1.7));',
'  float knots=sin(length(vec2(uv.x*0.55,uv.y))*18.0);',
'  float f=0.55 + 0.18*ring + 0.08*grain + 0.04*knots;',
'  f=clamp(f,0.15,0.95);',
'  vec3 dark=vec3(0.18,0.065,0.018);',
'  vec3 light=vec3(0.68,0.33,0.095);',
'  return mix(dark,light,f);',
'}',
'void main(){',
'  bool decodeTexture = (uVariant==1 || uVariant==3 || uVariant==4);',
'  bool quadratic = (uVariant==1 || uVariant==2 || uVariant==4);',
'  bool encodeOutput = (uVariant==1 || uVariant==2 || uVariant==3);',
'  vec3 stored=woodSRGB(UV);',
'  vec3 albedo=decodeTexture ? pow(stored,vec3(2.2)) : stored;',
'  vec3 N=vec3(0.0,1.0,0.0);',
'  vec3 V=normalize(uViewPos-FragPos);',
'  vec3 lighting=vec3(0.0);',
'  for(int i=0;i<4;i++){',
'    vec3 Lvec=uLightPos[i]-FragPos;',
'    float d=max(length(Lvec),0.2);',
'    vec3 L=Lvec/d;',
'    float diff=max(dot(N,L),0.0);',
'    vec3 H=normalize(L+V);',
'    float spec=pow(max(dot(N,H),0.0),64.0);',
'    float att=quadratic ? 1.0/(d*d) : 1.0/d;',
'    lighting += (diff*albedo + spec*vec3(0.28))*uLightColor[i]*att*uIntensity;',
'  }',
'  vec3 color=lighting;',
'  color=color/(color+vec3(1.0));',
'  if(encodeOutput) color=pow(color,vec3(1.0/2.2));',
'  FragColor=vec4(color,1.0);',
'}'].join('\n');

const pointVS=['#version 300 es',
'layout(location=0) in vec3 aPos;',
'uniform mat4 uVP;',
'uniform float uSize;',
'void main(){gl_Position=uVP*vec4(aPos,1.0);gl_PointSize=uSize;}'].join('\n');

const pointFS=['#version 300 es','precision highp float;',
'uniform vec3 uColor;out vec4 FragColor;',
'void main(){vec2 p=gl_PointCoord*2.0-1.0;float r=dot(p,p);if(r>1.0)discard;float glow=smoothstep(1.0,0.0,r);FragColor=vec4(uColor*(1.2+1.8*glow),1.0);}'].join('\n');

const planeP=program(planeVS,planeFS), pointP=program(pointVS,pointFS);

const planeVerts=new Float32Array([
 -6,0, 4,  -6,0,-4,   6,0,-4,
 -6,0, 4,   6,0,-4,   6,0, 4
]);
const planeVAO=gl.createVertexArray();gl.bindVertexArray(planeVAO);
const pb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,planeVerts,gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);

const pointVAO=gl.createVertexArray();gl.bindVertexArray(pointVAO);
const pointBuf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pointBuf);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(12),gl.DYNAMIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);

function norm(v){const l=Math.hypot(v[0],v[1],v[2]);return [v[0]/l,v[1]/l,v[2]/l];}
function sub(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function perspective(fov,aspect,n,f){const t=1/Math.tan(fov/2),nf=1/(n-f);return new Float32Array([t/aspect,0,0,0,0,t,0,0,0,0,(f+n)*nf,-1,0,0,2*f*n*nf,0]);}
function lookAt(e,c,u){const z=norm(sub(e,c)),x=norm(cross(u,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,e),-dot(y,e),-dot(z,e),1]);}
function mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s;}return o;}

let mode='demo', intensity=1.15, cameraY=2.7, animate=true;
let lightBase=[-3,-1,1,3];
const lightScale=[0.28,0.55,0.85,1.18];

const intensityEl=document.getElementById('intensity');
const cameraEl=document.getElementById('camera');
intensityEl.oninput=()=>{intensity=+intensityEl.value;document.getElementById('intensityVal').textContent=intensity.toFixed(2);};
cameraEl.oninput=()=>{cameraY=+cameraEl.value;document.getElementById('cameraVal').textContent=cameraY.toFixed(1);};
document.getElementById('animate').onclick=e=>{animate=!animate;e.currentTarget.classList.toggle('active',animate);e.currentTarget.textContent=animate?'灯光缓慢移动':'灯光已暂停';};
document.getElementById('reset').onclick=()=>{
 intensity=1.15;cameraY=2.7;animate=true;
 intensityEl.value='1.15';cameraEl.value='2.7';
 document.getElementById('intensityVal').textContent='1.15';document.getElementById('cameraVal').textContent='2.7';
 document.getElementById('animate').classList.add('active');document.getElementById('animate').textContent='灯光缓慢移动';
};

const variants={
 demo:[0,1],
 output:[0,2],
 texture:[0,3],
 atten:[0,4]
};

function setCopy(){
 const left=document.getElementById('leftLabel'),right=document.getElementById('rightLabel');
 const title=document.getElementById('modeTitle'),txt=document.getElementById('modeText'),formula=document.getElementById('formula');
 if(mode==='demo'){
   left.textContent='Gamma OFF · GL_RGB · 1 / distance';
   right.textContent='Gamma ON · sRGB decode · 1 / distance² · output encode';
   title.textContent='完整 Demo';
   txt.textContent='左侧沿用旧工作流；右侧使用完整 Linear Workflow。暗部层次、光照半径和强光附近的过渡都会变化。';
   formula.textContent='OFF: storedColor × lighting(1/d)\nON : decode(sRGB) × lighting(1/d²) → encode(sRGB)';
 }else if(mode==='output'){
   left.textContent='不做最终 Gamma';
   right.textContent='只增加最终 Linear → sRGB';
   title.textContent='只看输出 Gamma';
   txt.textContent='两边使用相同纹理和平方衰减，只改变最后的输出编码。右边中间亮度会明显抬起。';
   formula.textContent='left : linearColor\nright: pow(linearColor, 1/2.2)';
 }else if(mode==='texture'){
   left.textContent='sRGB 纹理当 Linear 使用';
   right.textContent='先 decode sRGB 纹理';
   title.textContent='只看纹理解码';
   txt.textContent='两边都使用线性衰减并做最终输出编码，唯一差别是右边先把“木纹颜色”从 sRGB 解码到 Linear。';
   formula.textContent='left : storedColor\nright: pow(storedColor, 2.2)';
 }else{
   left.textContent='1 / distance';
   right.textContent='1 / distance²';
   title.textContent='只看衰减';
   txt.textContent='两边都解码纹理并做最终输出编码，唯一差别是光强随距离的衰减公式。';
   formula.textContent='left : attenuation = 1/d\nright: attenuation = 1/d²';
 }
}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{
 document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
 b.classList.add('active');mode=b.dataset.mode;setCopy();
});
setCopy();

function renderSide(x,w,variant,t){
 const aspect=w/canvas.height;
 const eye=[0,cameraY,5.7];
 const vp=mul(perspective(49*Math.PI/180,aspect,.1,50),lookAt(eye,[0,0,-.4],[0,1,0]));

 const wobble=animate?Math.sin(t*.00045)*.32:0;
 const positions=[];
 for(let i=0;i<4;i++)positions.push(lightBase[i]+(i%2? -wobble:wobble),.38,0);

 gl.enable(gl.SCISSOR_TEST);gl.scissor(x,0,w,canvas.height);
 gl.clearColor(.018,.022,.03,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 gl.disable(gl.SCISSOR_TEST);

 gl.viewport(x,0,w,canvas.height);
 gl.useProgram(planeP);
 gl.uniformMatrix4fv(gl.getUniformLocation(planeP,'uVP'),false,vp);
 gl.uniform3fv(gl.getUniformLocation(planeP,'uViewPos'),eye);
 gl.uniform3fv(gl.getUniformLocation(planeP,'uLightPos[0]'),new Float32Array(positions));
 const cols=[];
 for(const s of lightScale)cols.push(s,s*.93,s*.78);
 gl.uniform3fv(gl.getUniformLocation(planeP,'uLightColor[0]'),new Float32Array(cols));
 gl.uniform1f(gl.getUniformLocation(planeP,'uIntensity'),intensity);
 gl.uniform1i(gl.getUniformLocation(planeP,'uVariant'),variant);
 gl.bindVertexArray(planeVAO);gl.drawArrays(gl.TRIANGLES,0,6);

 gl.useProgram(pointP);
 gl.uniformMatrix4fv(gl.getUniformLocation(pointP,'uVP'),false,vp);
 gl.uniform1f(gl.getUniformLocation(pointP,'uSize'),18.0);
 gl.bindVertexArray(pointVAO);
 for(let i=0;i<4;i++){
   const p=new Float32Array(positions.slice(i*3,i*3+3));
   gl.bindBuffer(gl.ARRAY_BUFFER,pointBuf);gl.bufferSubData(gl.ARRAY_BUFFER,0,p);
   gl.uniform3f(gl.getUniformLocation(pointP,'uColor'),1.0,.86,.58);
   gl.drawArrays(gl.POINTS,0,1);
 }
}

gl.enable(gl.DEPTH_TEST);
function frame(t){
 const half=canvas.width/2;
 const pair=variants[mode];
 renderSide(0,half,pair[0],t);
 renderSide(half,half,pair[1],t);

 gl.enable(gl.SCISSOR_TEST);gl.scissor(half-1,0,2,canvas.height);
 gl.clearColor(.55,.58,.64,1);gl.clear(gl.COLOR_BUFFER_BIT);
 gl.disable(gl.SCISSOR_TEST);
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();
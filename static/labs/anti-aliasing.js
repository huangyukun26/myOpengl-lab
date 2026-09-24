(()=>{
const canvas=document.getElementById('gl');
const gl=canvas.getContext('webgl2',{antialias:false,preserveDrawingBuffer:false});
if(!gl){document.body.innerHTML='<p style="padding:24px">需要支持 WebGL2 的浏览器。</p>';return;}

const BASE_W=300,BASE_H=200;
const PANEL_W=600,PANEL_H=400;
const maxSamples=gl.getParameter(gl.MAX_SAMPLES);
const s2=Math.min(2,maxSamples),s4=Math.min(4,maxSamples);

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

const sceneVS=['#version 300 es',
'layout(location=0) in vec2 aPos;',
'uniform float uAngle;',
'uniform float uScale;',
'out vec2 vLocal;',
'void main(){',
'  mat2 r=mat2(cos(uAngle),-sin(uAngle),sin(uAngle),cos(uAngle));',
'  vec2 p=r*aPos*uScale;',
'  vLocal=aPos;',
'  gl_Position=vec4(p,0,1);',
'}'].join('\n');

const sceneFS=['#version 300 es',
'precision highp float;',
'in vec2 vLocal;',
'uniform int uMode;',
'uniform vec2 uResolution;',
'out vec4 FragColor;',
'void main(){',
'  if(uMode==0){',
'    FragColor=vec4(0.10,0.80,0.90,1.0);',
'  } else {',
'    vec2 uv=gl_FragCoord.xy/uResolution;',
'    float f=52.0;',
'    float v=step(0.5,fract((uv.x*1.15+uv.y*0.72)*f));',
'    vec3 a=vec3(0.04,0.05,0.07);',
'    vec3 b=vec3(0.92,0.95,0.98);',
'    FragColor=vec4(mix(a,b,v),1.0);',
'  }',
'}'].join('\n');

const quadVS=['#version 300 es',
'layout(location=0) in vec2 aPos;',
'layout(location=1) in vec2 aUV;',
'out vec2 uv;',
'void main(){uv=aUV;gl_Position=vec4(aPos,0,1);}'].join('\n');

const quadFS=['#version 300 es',
'precision highp float;',
'in vec2 uv;',
'uniform sampler2D tex;',
'out vec4 FragColor;',
'void main(){FragColor=texture(tex,uv);}'].join('\n');

const sceneP=program(sceneVS,sceneFS);
const quadP=program(quadVS,quadFS);

const tri=gl.createVertexArray();gl.bindVertexArray(tri);
const tb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,tb);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1.0,-0.52, 1.0,-0.48, -0.82,0.88]),gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);

const full=gl.createVertexArray();gl.bindVertexArray(full);
const fb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,fb);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]),gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);

const quad=gl.createVertexArray();gl.bindVertexArray(quad);
const qb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,qb);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,0,0, 1,-1,1,0, -1,1,0,1, -1,1,0,1, 1,-1,1,0, 1,1,1,1]),gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,16,0);
gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,16,8);

function texTarget(w,h){
  const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);
  const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
  if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('texture framebuffer incomplete');
  return {f,t,w,h};
}
function msTarget(samples,w,h){
  const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);
  const rb=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,rb);
  gl.renderbufferStorageMultisample(gl.RENDERBUFFER,samples,gl.RGBA8,w,h);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,rb);
  if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('multisample framebuffer incomplete');
  return {f,rb,w,h,samples};
}

const one=texTarget(BASE_W,BASE_H);
const res2=texTarget(BASE_W,BASE_H);
const res4=texTarget(BASE_W,BASE_H);
const ssaa=texTarget(BASE_W*2,BASE_H*2);
const ssaaResolved=texTarget(BASE_W,BASE_H);
const ms2=msTarget(s2,BASE_W,BASE_H);
const ms4=msTarget(s4,BASE_W,BASE_H);
gl.bindFramebuffer(gl.FRAMEBUFFER,null);

function drawScene(target,w,h,angle,mode){
  gl.bindFramebuffer(gl.FRAMEBUFFER,target);gl.viewport(0,0,w,h);
  gl.disable(gl.BLEND);gl.clearColor(.025,.03,.045,1);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(sceneP);
  gl.uniform1f(gl.getUniformLocation(sceneP,'uAngle'),mode===0?angle:0);
  gl.uniform1f(gl.getUniformLocation(sceneP,'uScale'),mode===0?0.92:1.0);
  gl.uniform1i(gl.getUniformLocation(sceneP,'uMode'),mode);
  gl.uniform2f(gl.getUniformLocation(sceneP,'uResolution'),w,h);
  gl.bindVertexArray(mode===0?tri:full);
  gl.drawArrays(gl.TRIANGLES,0,mode===0?3:6);
}
function resolveMS(src,dst){
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER,src.f);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,dst.f);
  gl.blitFramebuffer(0,0,src.w,src.h,0,0,dst.w,dst.h,gl.COLOR_BUFFER_BIT,gl.NEAREST);
}
function resolveSSAA(){
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER,ssaa.f);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,ssaaResolved.f);
  gl.blitFramebuffer(0,0,ssaa.w,ssaa.h,0,0,ssaaResolved.w,ssaaResolved.h,gl.COLOR_BUFFER_BIT,gl.LINEAR);
}
function show(tex,x,y,label){
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(x,y,PANEL_W,PANEL_H);
  gl.useProgram(quadP);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.uniform1i(gl.getUniformLocation(quadP,'tex'),0);
  gl.bindVertexArray(quad);gl.drawArrays(gl.TRIANGLES,0,6);
}
function drawSeparator(){
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  gl.enable(gl.SCISSOR_TEST);gl.clearColor(.25,.28,.34,1);
  gl.scissor(PANEL_W-1,0,2,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.scissor(0,PANEL_H-1,canvas.width,2);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.disable(gl.SCISSOR_TEST);
}

let running=true,angle=.18,last=0,mode=0;
document.querySelectorAll('.scene').forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll('.scene').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');mode=btn.dataset.scene==='geometry'?0:1;
});
document.getElementById('rotate').onclick=()=>{angle+=.16;};
document.getElementById('pause').onclick=e=>{
  running=!running;e.currentTarget.textContent=running?'暂停':'继续';e.currentTarget.classList.toggle('active',!running);
};

function frame(t){
  if(running&&mode===0)angle+=(t-last)*0.00006;last=t;

  drawScene(one.f,one.w,one.h,angle,mode);
  drawScene(ms2.f,ms2.w,ms2.h,angle,mode);resolveMS(ms2,res2);
  drawScene(ms4.f,ms4.w,ms4.h,angle,mode);resolveMS(ms4,res4);
  drawScene(ssaa.f,ssaa.w,ssaa.h,angle,mode);resolveSSAA();

  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);
  gl.clearColor(.02,.025,.035,1);gl.clear(gl.COLOR_BUFFER_BIT);

  show(one.t,0,PANEL_H);
  show(res2.t,PANEL_W,PANEL_H);
  show(res4.t,0,0);
  show(ssaaResolved.t,PANEL_W,0);
  drawSeparator();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
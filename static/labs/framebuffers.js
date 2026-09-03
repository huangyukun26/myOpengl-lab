(() => {
'use strict';
const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl2', {antialias:true, alpha:false});
const $ = id => document.getElementById(id);
const ui = {
  badge:$('modeBadge'), renderPath:$('renderPath'), effect:$('effect'), scale:$('resolutionScale'), kernel:$('kernelRadius'), kernelText:$('kernelText'),
  depth:$('depthAttachment'), compare:$('compare'), breakFbo:$('breakFbo'), auto:$('autoRotate'), reset:$('reset'), code:$('code'), fboStatus:$('fboStatus'),
  attachmentSize:$('attachmentSize'), targetStatus:$('targetStatus'), tree:$('attachmentTree'), pass1:$('pass1Text'), pass2:$('pass2Text')
};
if (!gl) {
  ui.badge.textContent = '● WebGL2 unavailable'; ui.badge.className='badge bad';
  ui.tree.textContent = 'This browser/device did not provide a WebGL2 context.';
  return;
}
ui.badge.textContent='● WebGL2 · real FBO'; ui.badge.className='badge ok';

const VERT_SCENE = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec2 aUV;
uniform mat4 uModel; uniform mat4 uView; uniform mat4 uProj; out vec2 vUV;
void main(){vUV=aUV; gl_Position=uProj*uView*uModel*vec4(aPos,1.0);}`;
const FRAG_SCENE = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uTex; out vec4 outColor;
void main(){outColor=texture(uTex,vUV);}`;
const VERT_SCREEN = `#version 300 es
layout(location=0) in vec2 aPos; layout(location=1) in vec2 aUV; out vec2 vUV;
void main(){vUV=aUV; gl_Position=vec4(aPos,0.0,1.0);}`;
const FRAG_SCREEN = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uScreen; uniform int uEffect; uniform vec2 uTexel; out vec4 outColor;
vec3 sampleAt(vec2 o){return texture(uScreen,vUV+o*uTexel).rgb;}
void main(){
  vec3 c=texture(uScreen,vUV).rgb;
  if(uEffect==1){c=vec3(1.0)-c;}
  else if(uEffect==2){float g=dot(c,vec3(0.2126,0.7152,0.0722)); c=vec3(g);}
  else if(uEffect>=3){
    vec3 s0=sampleAt(vec2(-1., 1.)), s1=sampleAt(vec2(0., 1.)), s2=sampleAt(vec2(1., 1.));
    vec3 s3=sampleAt(vec2(-1., 0.)), s4=c,                         s5=sampleAt(vec2(1., 0.));
    vec3 s6=sampleAt(vec2(-1.,-1.)), s7=sampleAt(vec2(0.,-1.)), s8=sampleAt(vec2(1.,-1.));
    if(uEffect==3) c = -s0-s1-s2-s3+9.0*s4-s5-s6-s7-s8;
    else if(uEffect==4) c=(s0+2.*s1+s2+2.*s3+4.*s4+2.*s5+s6+2.*s7+s8)/16.0;
    else c=s0+s1+s2+s3-8.0*s4+s5+s6+s7+s8;
  }
  outColor=vec4(c,1.0);
}`;
function shader(type, src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
function program(v,f){const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,v));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}
let sceneProg, screenProg;
try{sceneProg=program(VERT_SCENE,FRAG_SCENE);screenProg=program(VERT_SCREEN,FRAG_SCREEN);}catch(e){ui.badge.textContent='● Shader error';ui.badge.className='badge bad';ui.tree.textContent=e.message;return;}

const cube = new Float32Array([
-0.5,-0.5,-0.5,0,0, 0.5,-0.5,-0.5,1,0, 0.5,0.5,-0.5,1,1, 0.5,0.5,-0.5,1,1,-0.5,0.5,-0.5,0,1,-0.5,-0.5,-0.5,0,0,
-0.5,-0.5, 0.5,0,0, 0.5,-0.5, 0.5,1,0, 0.5,0.5, 0.5,1,1, 0.5,0.5, 0.5,1,1,-0.5,0.5, 0.5,0,1,-0.5,-0.5, 0.5,0,0,
-0.5,0.5,0.5,1,0,-0.5,0.5,-0.5,1,1,-0.5,-0.5,-0.5,0,1,-0.5,-0.5,-0.5,0,1,-0.5,-0.5,0.5,0,0,-0.5,0.5,0.5,1,0,
0.5,0.5,0.5,1,0,0.5,0.5,-0.5,1,1,0.5,-0.5,-0.5,0,1,0.5,-0.5,-0.5,0,1,0.5,-0.5,0.5,0,0,0.5,0.5,0.5,1,0,
-0.5,-0.5,-0.5,0,1,0.5,-0.5,-0.5,1,1,0.5,-0.5,0.5,1,0,0.5,-0.5,0.5,1,0,-0.5,-0.5,0.5,0,0,-0.5,-0.5,-0.5,0,1,
-0.5,0.5,-0.5,0,1,0.5,0.5,-0.5,1,1,0.5,0.5,0.5,1,0,0.5,0.5,0.5,1,0,-0.5,0.5,0.5,0,0,-0.5,0.5,-0.5,0,1]);
const plane = new Float32Array([5,-0.5,5,2,0,-5,-0.5,5,0,0,-5,-0.5,-5,0,2, 5,-0.5,5,2,0,-5,-0.5,-5,0,2,5,-0.5,-5,2,2]);
const quad = new Float32Array([-1,1,0,1,-1,-1,0,0,1,-1,1,0,-1,1,0,1,1,-1,1,0,1,1,1,1]);
function vaoFor(data, dim){const vao=gl.createVertexArray(),buf=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);const stride=(dim+2)*4;gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,dim,gl.FLOAT,false,stride,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,stride,dim*4);gl.bindVertexArray(null);return vao;}
const cubeVAO=vaoFor(cube,3), planeVAO=vaoFor(plane,3), quadVAO=vaoFor(quad,2);

function makeFallback(kind){const size=128,c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d');if(kind==='metal'){x.fillStyle='#70757a';x.fillRect(0,0,size,size);x.strokeStyle='#9aa0a6';x.lineWidth=2;for(let y=0;y<size;y+=16){x.beginPath();x.moveTo(0,y);x.lineTo(size,y);x.stroke();}}else{for(let y=0;y<8;y++)for(let x0=0;x0<8;x0++){x.fillStyle=(x0+y)%2?'#a06b3b':'#d39a55';x.fillRect(x0*16,y*16,16,16);}}return c;}
function uploadImage(img){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);return t;}
function loadTexture(url,kind){return new Promise(resolve=>{const img=new Image();img.crossOrigin='anonymous';img.onload=()=>resolve(uploadImage(img));img.onerror=()=>resolve(uploadImage(makeFallback(kind)));img.src=url;});}
let cubeTex=uploadImage(makeFallback('box')),floorTex=uploadImage(makeFallback('metal'));
Promise.all([
loadTexture('https://raw.githubusercontent.com/JoeyDeVries/LearnOpenGL/master/resources/textures/container.jpg','box'),
loadTexture('https://raw.githubusercontent.com/JoeyDeVries/LearnOpenGL/master/resources/textures/metal.png','metal')
]).then(([a,b])=>{cubeTex=a;floorTex=b;});

const fbo=gl.createFramebuffer(); let colorTex=null, depthRbo=null, fboW=1, fboH=1, fboComplete=false;
function resizeCanvas(){const dpr=Math.min(devicePixelRatio||1,2);const w=Math.max(2,Math.floor(canvas.clientWidth*dpr)),h=Math.max(2,Math.floor(canvas.clientHeight*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;rebuildFbo();}}
function rebuildFbo(){
  const scale=parseFloat(ui.scale.value);fboW=Math.max(1,Math.floor(canvas.width*scale));fboH=Math.max(1,Math.floor(canvas.height*scale));
  gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);
  if(colorTex)gl.deleteTexture(colorTex);colorTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,colorTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,fboW,fboH,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,ui.breakFbo.checked?null:colorTex,0);
  if(depthRbo)gl.deleteRenderbuffer(depthRbo);depthRbo=null;
  if(ui.depth.checked){depthRbo=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,depthRbo);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH24_STENCIL8,fboW,fboH);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_STENCIL_ATTACHMENT,gl.RENDERBUFFER,depthRbo);}else{gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_STENCIL_ATTACHMENT,gl.RENDERBUFFER,null);}
  fboComplete=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;gl.bindFramebuffer(gl.FRAMEBUFFER,null);updateInfo();
}
function updateInfo(){
  ui.fboStatus.textContent=fboComplete?'COMPLETE':'INCOMPLETE';ui.fboStatus.style.color=fboComplete?'#3fb950':'#f85149';ui.attachmentSize.textContent=`${fboW}×${fboH}`;ui.targetStatus.textContent=ui.renderPath.value==='fbo'?'2-pass FBO':'default only';
  ui.tree.innerHTML=`Framebuffer Object<br>├─ <span class="${ui.breakFbo.checked?'badline':'tex'}">GL_COLOR_ATTACHMENT0 → ${ui.breakFbo.checked?'DETACHED':'Texture RGBA8'}</span><br>└─ <span class="${ui.depth.checked?'rbo':'badline'}">GL_DEPTH_STENCIL_ATTACHMENT → ${ui.depth.checked?'Renderbuffer DEPTH24_STENCIL8':'none'}</span>`;
  const direct=ui.renderPath.value==='direct';ui.effect.disabled=direct;ui.compare.disabled=direct;ui.scale.disabled=direct;ui.breakFbo.disabled=direct;ui.depth.disabled=direct;ui.pass1.textContent=direct?'bind default framebuffer → draw scene directly':'bind custom FBO → clear → depth test → draw cubes + floor';ui.pass2.textContent=direct?'no second pass; there is no scene texture to post-process':'bind default framebuffer → sample color attachment → post-process';
  ui.kernelText.textContent=`${ui.kernel.value} px`;updateCode();
}
function updateCode(){const eff=['None','Inversion','Grayscale','Sharpen','Blur','Edge Detection'][+ui.effect.value];ui.code.textContent=ui.renderPath.value==='direct'?`// Direct path: no off-screen texture
glBindFramebuffer(GL_FRAMEBUFFER, 0);
glViewport(0, 0, ${canvas.width}, ${canvas.height});
glEnable(GL_DEPTH_TEST);
DrawScene();

// No second pass → ${eff} cannot process the whole scene.`:`// Setup idea
glBindFramebuffer(GL_FRAMEBUFFER, fbo);
glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0,
                       GL_TEXTURE_2D, colorTexture, 0);
${ui.depth.checked?'glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_STENCIL_ATTACHMENT,\n                          GL_RENDERBUFFER, rbo);':'// no depth/stencil attachment'}
${ui.breakFbo.checked?'// COLOR_ATTACHMENT0 intentionally detached → incomplete':'glCheckFramebufferStatus(GL_FRAMEBUFFER); // COMPLETE'}

// Pass 1 → off-screen texture
glBindFramebuffer(GL_FRAMEBUFFER, fbo);
glViewport(0, 0, ${fboW}, ${fboH});
glEnable(GL_DEPTH_TEST);
DrawScene();

// Pass 2 → default framebuffer
glBindFramebuffer(GL_FRAMEBUFFER, 0);
glViewport(0, 0, ${canvas.width}, ${canvas.height});
glDisable(GL_DEPTH_TEST);
glBindTexture(GL_TEXTURE_2D, colorTexture);
DrawFullscreenQuad();
// screen shader effect: ${eff}`;}

function mat4(){return new Float32Array(16)}
function identity(){const m=mat4();m[0]=m[5]=m[10]=m[15]=1;return m;}
function perspective(fov,aspect,n,f){const m=mat4(),t=1/Math.tan(fov/2);m[0]=t/aspect;m[5]=t;m[10]=(f+n)/(n-f);m[11]=-1;m[14]=(2*f*n)/(n-f);return m;}
function normalize(v){const l=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/l,v[1]/l,v[2]/l]}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}
function lookAt(e,c,u){const z=normalize([e[0]-c[0],e[1]-c[1],e[2]-c[2]]),x=normalize(cross(u,z)),y=cross(z,x),m=identity();m[0]=x[0];m[1]=y[0];m[2]=z[0];m[4]=x[1];m[5]=y[1];m[6]=z[1];m[8]=x[2];m[9]=y[2];m[10]=z[2];m[12]=-dot(x,e);m[13]=-dot(y,e);m[14]=-dot(z,e);return m;}
function translation(x,y,z){const m=identity();m[12]=x;m[13]=y;m[14]=z;return m;}
let yaw=-90,pitch=-12,dist=4.8,drag=false,lastX=0,lastY=0;
canvas.addEventListener('pointerdown',e=>{drag=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId)});canvas.addEventListener('pointerup',()=>drag=false);canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw+=(e.clientX-lastX)*.35;pitch=Math.max(-75,Math.min(75,pitch-(e.clientY-lastY)*.3));lastX=e.clientX;lastY=e.clientY;});canvas.addEventListener('wheel',e=>{e.preventDefault();dist=Math.max(2.3,Math.min(8,dist+e.deltaY*.004));},{passive:false});
function setMats(prog,model,view,proj){gl.uniformMatrix4fv(gl.getUniformLocation(prog,'uModel'),false,model);gl.uniformMatrix4fv(gl.getUniformLocation(prog,'uView'),false,view);gl.uniformMatrix4fv(gl.getUniformLocation(prog,'uProj'),false,proj);}
function drawScene(w,h,time){
  gl.useProgram(sceneProg);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);const yr=yaw*Math.PI/180,pr=pitch*Math.PI/180;const eye=[Math.cos(pr)*Math.cos(yr)*dist,Math.sin(pr)*dist,Math.cos(pr)*Math.sin(yr)*dist];const view=lookAt(eye,[0,0,-0.3],[0,1,0]);const proj=perspective(45*Math.PI/180,w/h,.1,100);gl.uniform1i(gl.getUniformLocation(sceneProg,'uTex'),0);gl.activeTexture(gl.TEXTURE0);
  gl.bindVertexArray(cubeVAO);gl.bindTexture(gl.TEXTURE_2D,cubeTex);setMats(sceneProg,translation(-1,0,-1),view,proj);gl.drawArrays(gl.TRIANGLES,0,36);setMats(sceneProg,translation(2,0,0),view,proj);gl.drawArrays(gl.TRIANGLES,0,36);
  gl.bindVertexArray(planeVAO);gl.bindTexture(gl.TEXTURE_2D,floorTex);setMats(sceneProg,identity(),view,proj);gl.drawArrays(gl.TRIANGLES,0,6);gl.bindVertexArray(null);
}
function drawQuad(effect,x,y,w,h){gl.viewport(x,y,w,h);gl.disable(gl.DEPTH_TEST);gl.useProgram(screenProg);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,colorTex);gl.uniform1i(gl.getUniformLocation(screenProg,'uScreen'),0);gl.uniform1i(gl.getUniformLocation(screenProg,'uEffect'),effect);const r=+ui.kernel.value;gl.uniform2f(gl.getUniformLocation(screenProg,'uTexel'),r/fboW,r/fboH);gl.bindVertexArray(quadVAO);gl.drawArrays(gl.TRIANGLES,0,6);gl.bindVertexArray(null);}
function render(t){resizeCanvas();if(ui.auto.checked&&!drag)yaw+=0.08;const direct=ui.renderPath.value==='direct';if(direct){gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.08,.09,.11,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);drawScene(canvas.width,canvas.height,t);}else if(fboComplete){gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.viewport(0,0,fboW,fboH);gl.clearColor(.1,.1,.1,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT|gl.STENCIL_BUFFER_BIT);drawScene(fboW,fboH,t);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.04,.05,.07,1);gl.clear(gl.COLOR_BUFFER_BIT);if(ui.compare.checked){const half=Math.floor(canvas.width/2);drawQuad(0,0,0,half,canvas.height);drawQuad(+ui.effect.value,half,0,canvas.width-half,canvas.height);}else drawQuad(+ui.effect.value,0,0,canvas.width,canvas.height);}else{gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.22,.035,.04,1);gl.clear(gl.COLOR_BUFFER_BIT);}
  requestAnimationFrame(render);
}
['change','input'].forEach(ev=>{[ui.renderPath,ui.effect,ui.kernel,ui.depth,ui.compare,ui.breakFbo,ui.auto].forEach(el=>el.addEventListener(ev,()=>{if(el===ui.depth||el===ui.breakFbo)rebuildFbo();else updateInfo();}));});ui.scale.addEventListener('change',rebuildFbo);
ui.reset.addEventListener('click',()=>{ui.renderPath.value='fbo';ui.effect.value='0';ui.scale.value='1';ui.kernel.value='1';ui.depth.checked=true;ui.compare.checked=false;ui.breakFbo.checked=false;ui.auto.checked=true;yaw=-90;pitch=-12;dist=4.8;rebuildFbo();});
resizeCanvas();rebuildFbo();requestAnimationFrame(render);
})();

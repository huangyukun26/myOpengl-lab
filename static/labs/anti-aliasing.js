(()=>{
const canvas=document.getElementById('gl');
const gl=canvas.getContext('webgl2',{antialias:false});
if(!gl){document.body.innerHTML='<p style="padding:24px">需要支持 WebGL2 的浏览器。</p>';return;}
const W=600,H=525;
const samples=Math.max(1,Math.min(4,gl.getParameter(gl.MAX_SAMPLES)));
document.getElementById('msLabel').textContent=samples+'x · MSAA → Resolve';

function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
function program(vs,fs){const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}

const sceneVS=['#version 300 es','layout(location=0) in vec2 aPos;','uniform float uAngle;','uniform float uZoom;','void main(){','mat2 r=mat2(cos(uAngle),-sin(uAngle),sin(uAngle),cos(uAngle));','vec2 p=r*aPos*uZoom;','gl_Position=vec4(p,0,1);','}'].join('\n');
const sceneFS=['#version 300 es','precision highp float;','out vec4 FragColor;','void main(){FragColor=vec4(0.12,0.78,0.86,1.0);}'].join('\n');
const quadVS=['#version 300 es','layout(location=0) in vec2 aPos;','layout(location=1) in vec2 aUV;','out vec2 uv;','void main(){uv=aUV;gl_Position=vec4(aPos,0,1);}'].join('\n');
const quadFS=['#version 300 es','precision highp float;','in vec2 uv;','uniform sampler2D tex;','out vec4 FragColor;','void main(){FragColor=texture(tex,uv);}'].join('\n');

const sceneP=program(sceneVS,sceneFS),quadP=program(quadVS,quadFS);
const tri=gl.createVertexArray();gl.bindVertexArray(tri);
const tb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,tb);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-0.9,-0.58,0.9,-0.52,-0.72,0.82]),gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);

const quad=gl.createVertexArray();gl.bindVertexArray(quad);
const qb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,qb);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,0,0,1,-1,1,0,-1,1,0,1,-1,1,0,1,1,-1,1,0,1,1,1,1]),gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,16,0);
gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,16,8);

function texTarget(){
 const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);
 const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
 gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
 return {f,t};
}
const single=texTarget(),resolved=texTarget();

const msF=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,msF);
const msColor=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,msColor);
gl.renderbufferStorageMultisample(gl.RENDERBUFFER,samples,gl.RGBA8,W,H);
gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,msColor);
if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('MSAA framebuffer incomplete');
gl.bindFramebuffer(gl.FRAMEBUFFER,null);

function drawScene(fbo,angle,zoom){
 gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.viewport(0,0,W,H);
 gl.clearColor(.055,.065,.08,1);gl.clear(gl.COLOR_BUFFER_BIT);
 gl.useProgram(sceneP);
 gl.uniform1f(gl.getUniformLocation(sceneP,'uAngle'),angle);
 gl.uniform1f(gl.getUniformLocation(sceneP,'uZoom'),zoom);
 gl.bindVertexArray(tri);gl.drawArrays(gl.TRIANGLES,0,3);
}
function resolve(){
 gl.bindFramebuffer(gl.READ_FRAMEBUFFER,msF);
 gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,resolved.f);
 gl.blitFramebuffer(0,0,W,H,0,0,W,H,gl.COLOR_BUFFER_BIT,gl.NEAREST);
}
function show(tex,x){
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(x,0,W,H);
 gl.useProgram(quadP);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);
 gl.uniform1i(gl.getUniformLocation(quadP,'tex'),0);gl.bindVertexArray(quad);gl.drawArrays(gl.TRIANGLES,0,6);
}
let running=true,zoom=1,angle=.14,last=0;
document.getElementById('pause').onclick=e=>{running=!running;e.currentTarget.classList.toggle('active',!running);e.currentTarget.textContent=running?'暂停':'继续';};
document.getElementById('zoom').onclick=e=>{zoom=zoom===1?1.55:1;e.currentTarget.classList.toggle('active',zoom>1);};
document.getElementById('rotate').onclick=()=>{angle+=.15;};
function frame(t){
 if(running)angle+=(t-last)*0.00008;last=t;
 drawScene(single.f,angle,zoom);drawScene(msF,angle,zoom);resolve();
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.03,.035,.045,1);gl.clear(gl.COLOR_BUFFER_BIT);
 show(single.t,0);show(resolved.t,W);requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
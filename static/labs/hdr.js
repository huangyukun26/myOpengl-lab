(()=>{
const canvas=document.getElementById('gl');
const gl=canvas.getContext('webgl2',{antialias:false});
if(!gl){document.body.innerHTML='<p style="padding:24px">需要支持 WebGL2 的浏览器。</p>';return;}
const floatExt=gl.getExtension('EXT_color_buffer_float');
if(!floatExt){document.body.innerHTML='<p style="padding:24px">当前浏览器缺少 EXT_color_buffer_float，无法演示浮点 HDR Framebuffer。</p>';return;}

function sh(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s}
function prog(vs,fs){const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,vs));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p}

const quadVS='#version 300 es\nlayout(location=0) in vec2 aPos;out vec2 uv;void main(){uv=aPos*0.5+0.5;gl_Position=vec4(aPos,0.0,1.0);}';

const sceneFS=[
'#version 300 es','precision highp float;','in vec2 uv;out vec4 FragColor;','uniform float uIntensity;',
'float light(vec2 p, vec2 c, float power){float d=length(p-c);return power/(1.0+55.0*d*d);}',
'void main(){',
' vec2 p=uv;',
' vec3 base=vec3(0.018,0.022,0.028);',
' float tunnel=0.35+0.65*(1.0-abs(p.y-0.5)*1.8);',
' float grain=0.82+0.18*sin(p.x*110.0)*sin(p.y*72.0);',
' vec3 albedo=vec3(0.22,0.12,0.07)*tunnel*grain+base;',
' float L0=light(p,vec2(0.78,0.52),uIntensity);',
' float L1=light(p,vec2(0.54,0.28),uIntensity*0.18);',
' float L2=light(p,vec2(0.36,0.72),uIntensity*0.12);',
' vec3 lighting=vec3(L0)+vec3(1.0,0.10,0.06)*L1+vec3(0.08,0.25,1.0)*L2;',
' vec3 color=albedo*(0.06+lighting);',
' FragColor=vec4(color,1.0);',
'}'
].join('\n');

const screenFS=[
'#version 300 es','precision highp float;','in vec2 uv;out vec4 FragColor;',
'uniform sampler2D uHDR;uniform sampler2D uLDR;uniform float uExposure;uniform int uMode;uniform int uTone;',
'vec3 tone(vec3 c){if(uTone==0)return c/(c+vec3(1.0));return vec3(1.0)-exp(-c*uExposure);}',
'vec3 gammaEncode(vec3 c){return pow(max(c,vec3(0.0)),vec3(1.0/2.2));}',
'void main(){',
' if(uMode==2){',
'   vec3 h=texture(uHDR,uv).rgb;',
'   vec3 heat=vec3(clamp(h.r/8.0,0.0,1.0),clamp(h.r/2.0,0.0,1.0),clamp(h.r/0.5,0.0,1.0));',
'   FragColor=vec4(heat,1.0);return;',
' }',
' if(uMode==0){',
'   bool right=uv.x>=0.5;',
'   vec2 suv=vec2(fract(uv.x*2.0),uv.y);',
'   if(right){vec3 h=texture(uHDR,suv).rgb;FragColor=vec4(gammaEncode(tone(h)),1.0);}',
'   else{vec3 l=texture(uLDR,suv).rgb;FragColor=vec4(gammaEncode(l),1.0);}',
' } else {',
'   vec3 h=texture(uHDR,uv).rgb;FragColor=vec4(gammaEncode(tone(h)),1.0);',
' }',
'}'
].join('\n');

const sceneP=prog(quadVS,sceneFS),screenP=prog(quadVS,screenFS);

const vao=gl.createVertexArray();gl.bindVertexArray(vao);
const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.bindVertexArray(null);

function tex(internal,type){
 const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
 gl.texImage2D(gl.TEXTURE_2D,0,internal,canvas.width,canvas.height,0,gl.RGBA,type,null);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;
}
function fboWith(t){const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Framebuffer incomplete');return f}
const hdrTex=tex(gl.RGBA16F,gl.HALF_FLOAT),ldrTex=tex(gl.RGBA8,gl.UNSIGNED_BYTE);
const hdrFbo=fboWith(hdrTex),ldrFbo=fboWith(ldrTex);gl.bindFramebuffer(gl.FRAMEBUFFER,null);

let exposure=1,intensity=18,mode=0,tone=1;
function renderScene(target){
 gl.bindFramebuffer(gl.FRAMEBUFFER,target);gl.viewport(0,0,canvas.width,canvas.height);
 gl.useProgram(sceneP);gl.uniform1f(gl.getUniformLocation(sceneP,'uIntensity'),intensity);
 gl.bindVertexArray(vao);gl.drawArrays(gl.TRIANGLES,0,6);
}
function frame(){
 renderScene(hdrFbo);renderScene(ldrFbo);
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);
 gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);
 gl.useProgram(screenP);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,hdrTex);gl.uniform1i(gl.getUniformLocation(screenP,'uHDR'),0);
 gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,ldrTex);gl.uniform1i(gl.getUniformLocation(screenP,'uLDR'),1);
 gl.uniform1f(gl.getUniformLocation(screenP,'uExposure'),exposure);
 gl.uniform1i(gl.getUniformLocation(screenP,'uMode'),mode);
 gl.uniform1i(gl.getUniformLocation(screenP,'uTone'),tone);
 gl.bindVertexArray(vao);gl.drawArrays(gl.TRIANGLES,0,6);
 requestAnimationFrame(frame);
}

const labels=document.getElementById('compareLabels');
document.querySelectorAll('.tab').forEach(btn=>btn.onclick=()=>{
 document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));btn.classList.add('active');
 mode=btn.dataset.mode==='compare'?0:btn.dataset.mode==='hdr'?1:2;labels.hidden=mode!==0;
 const t=document.getElementById('modeTitle'),p=document.getElementById('modeText');
 if(mode===1){t.textContent='HDR Float Buffer + Tone Mapping';p.textContent='场景先写入 RGBA16F，再通过 Tone Mapping 和 Gamma 映射到屏幕。Exposure 只影响第二遍显示。';}
 else if(mode===2){t.textContent='HDR Buffer 可视化';p.textContent='这里用伪彩色显示浮点缓冲的大致强度。它不是最终颜色，而是 Tone Mapping 前保存的线性亮度。';}
 else{t.textContent='LDR Clamp vs HDR';p.textContent='两边先计算同一组线性亮度。左边写进 RGBA8 时，大于 1.0 的部分已经丢失；右边写进 RGBA16F，之后再 Tone Mapping。';}
});
document.getElementById('exposure').oninput=e=>{exposure=+e.target.value;document.getElementById('exposureVal').textContent=exposure.toFixed(2)};
document.getElementById('intensity').oninput=e=>{intensity=+e.target.value;document.getElementById('intensityVal').textContent=intensity.toFixed(1)};
document.getElementById('toggleTone').onclick=e=>{tone=1-tone;e.currentTarget.textContent=tone?'Exposure Tone Map':'Reinhard Tone Map';e.currentTarget.classList.toggle('active',tone===0)};
requestAnimationFrame(frame);
})();
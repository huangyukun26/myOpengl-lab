(()=>{
const canvas=document.getElementById('gl');
const gl=canvas.getContext('webgl2',{antialias:false});
if(!gl){document.body.innerHTML='<p style="padding:24px">需要支持 WebGL2 的浏览器。</p>';return;}
if(!gl.getExtension('EXT_color_buffer_float')){document.body.innerHTML='<p style="padding:24px">当前浏览器缺少 EXT_color_buffer_float，无法演示浮点 HDR Framebuffer。</p>';return;}

function sh(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s}
function prog(vs,fs){const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,vs));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p}

const quadVS='#version 300 es\nlayout(location=0) in vec2 aPos;out vec2 uv;void main(){uv=aPos*0.5+0.5;gl_Position=vec4(aPos,0.0,1.0);}';

const sceneFS=[
'#version 300 es','precision highp float;','in vec2 uv;out vec4 FragColor;','uniform float uIntensity;',
'float boxMask(vec2 p,vec2 c,vec2 h,float soft){vec2 d=abs(p-c)-h;return 1.0-smoothstep(0.0,soft,max(d.x,d.y));}',
'float circleMask(vec2 p,vec2 c,float r,float soft){return 1.0-smoothstep(r,r+soft,length(p-c));}',
'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
'void main(){',
' vec2 p=uv;',
' vec3 color=vec3(0.018,0.022,0.028);',
' // dark interior wall with subtle texture',
' float wallNoise=0.85+0.15*hash(floor(p*vec2(180.0,100.0)));',
' color+=vec3(0.045,0.038,0.032)*wallNoise;',
' // large bright window',
' float window=boxMask(p,vec2(0.70,0.58),vec2(0.22,0.30),0.004);',
' float frameV=1.0-boxMask(p,vec2(0.70,0.58),vec2(0.012,0.30),0.003);',
' float frameH=1.0-boxMask(p,vec2(0.70,0.58),vec2(0.22,0.012),0.003);',
' float frame=window*(1.0-frameV*frameH);',
' // outdoor HDR sky inside the window',
' vec3 sky=mix(vec3(0.20,0.42,1.10),vec3(2.0,0.75,0.18),smoothstep(0.40,0.75,p.y));',
' sky*=uIntensity*0.12;',
' float sun=circleMask(p,vec2(0.79,0.72),0.045,0.008);',
' sky+=vec3(1.0,0.82,0.45)*sun*uIntensity*1.4;',
' // distant mountains and horizon in the window',
' float ridge=0.39+0.055*sin(p.x*18.0)+0.028*sin(p.x*41.0);',
' float mountain=window*(1.0-smoothstep(ridge,ridge+0.01,p.y));',
' sky=mix(sky,vec3(0.10,0.12,0.16)*uIntensity*0.18,mountain);',
' color=mix(color,sky,window);',
' color=mix(color,vec3(0.025),frame);',
' // floor',
' float floorM=1.0-smoothstep(0.0,0.018,p.y-0.23);',
' color=mix(color,vec3(0.025,0.020,0.017)*(0.7+0.6*p.y),floorM);',
' // table silhouette',
' float tableTop=boxMask(p,vec2(0.36,0.31),vec2(0.22,0.025),0.004);',
' float leg1=boxMask(p,vec2(0.25,0.18),vec2(0.022,0.12),0.004);',
' float leg2=boxMask(p,vec2(0.47,0.18),vec2(0.022,0.12),0.004);',
' float table=max(tableTop,max(leg1,leg2));',
' color=mix(color,vec3(0.045,0.025,0.016),table);',
' // lamp body and shade, dim warm interior light',
' float lampStem=boxMask(p,vec2(0.28,0.48),vec2(0.010,0.16),0.004);',
' float lampShade=boxMask(p,vec2(0.28,0.62),vec2(0.075,0.055),0.006);',
' float lamp=max(lampStem,lampShade);',
' color=mix(color,vec3(0.10,0.065,0.035),lamp);',
' float glow=1.0/(1.0+260.0*dot(p-vec2(0.28,0.61),p-vec2(0.28,0.61)));',
' color+=vec3(1.0,0.46,0.12)*glow*0.32;',
' // sofa / subject on the left: intentionally dark but recoverable',
' float sofa=boxMask(p,vec2(0.18,0.31),vec2(0.14,0.12),0.02);',
' color=mix(color,vec3(0.075,0.035,0.025),sofa);',
' // bounce light from the window into the room',
' float bounce=max(0.0,1.0-length(p-vec2(0.55,0.45))*1.5);',
' color+=vec3(0.10,0.12,0.16)*bounce;',
' FragColor=vec4(color,1.0);',
'}'
].join('\n');

const screenFS=[
'#version 300 es','precision highp float;','in vec2 uv;out vec4 FragColor;',
'uniform sampler2D uHDR;uniform float uExposure;uniform int uMode;uniform int uTone;',
'vec3 gammaEncode(vec3 c){return pow(clamp(c,0.0,1.0),vec3(1.0/2.2));}',
'vec3 exposureMap(vec3 c,float e){return vec3(1.0)-exp(-c*e);}',
'vec3 reinhard(vec3 c,float e){c*=e;return c/(vec3(1.0)+c);}',
'vec3 tone(vec3 c,float e){return uTone==0?reinhard(c,e):exposureMap(c,e);}',
'void main(){',
' if(uMode==2){',
'   vec3 h=texture(uHDR,uv).rgb;',
'   float lum=dot(h,vec3(0.2126,0.7152,0.0722));',
'   float v=log2(1.0+lum)/log2(65.0);',
'   vec3 heat=mix(vec3(0.02,0.03,0.08),vec3(1.0,0.42,0.06),clamp(v,0.0,1.0));',
'   heat=mix(heat,vec3(1.0),smoothstep(0.72,1.0,v));',
'   FragColor=vec4(heat,1.0);return;',
' }',
' if(uMode==0){',
'   float third=1.0/3.0;',
'   int panel=int(floor(uv.x/third));',
'   vec2 suv=vec2(fract(uv.x*3.0),uv.y);',
'   vec3 h=texture(uHDR,suv).rgb;',
'   vec3 outc;',
'   if(panel==0) outc=exposureMap(h,0.16);',
'   else if(panel==1) outc=exposureMap(h,2.20);',
'   else outc=tone(h,uExposure);',
'   FragColor=vec4(gammaEncode(outc),1.0);return;',
' }',
' vec3 h=texture(uHDR,uv).rgb;',
' FragColor=vec4(gammaEncode(tone(h,uExposure)),1.0);',
'}'
].join('\n');

const sceneP=prog(quadVS,sceneFS),screenP=prog(quadVS,screenFS);
const vao=gl.createVertexArray();gl.bindVertexArray(vao);
const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.bindVertexArray(null);

const hdrTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,hdrTex);
gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,canvas.width,canvas.height,0,gl.RGBA,gl.HALF_FLOAT,null);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
const hdrFbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,hdrFbo);
gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,hdrTex,0);
if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('HDR framebuffer incomplete');
gl.bindFramebuffer(gl.FRAMEBUFFER,null);

let exposure=.9,intensity=42,mode=0,tone=0;

function render(){
  gl.bindFramebuffer(gl.FRAMEBUFFER,hdrFbo);
  gl.viewport(0,0,canvas.width,canvas.height);
  gl.useProgram(sceneP);
  gl.uniform1f(gl.getUniformLocation(sceneP,'uIntensity'),intensity);
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLES,0,6);

  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  gl.viewport(0,0,canvas.width,canvas.height);
  gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(screenP);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,hdrTex);
  gl.uniform1i(gl.getUniformLocation(screenP,'uHDR'),0);
  gl.uniform1f(gl.getUniformLocation(screenP,'uExposure'),exposure);
  gl.uniform1i(gl.getUniformLocation(screenP,'uMode'),mode);
  gl.uniform1i(gl.getUniformLocation(screenP,'uTone'),tone);
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLES,0,6);
  requestAnimationFrame(render);
}

const labels=document.getElementById('compareLabels');
document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');
  mode=btn.dataset.mode==='compare'?0:btn.dataset.mode==='tone'?1:2;
  labels.hidden=mode!==0;
}));
document.getElementById('exposure').addEventListener('input',e=>{
  exposure=+e.target.value;
  document.getElementById('exposureVal').textContent=exposure.toFixed(2);
});
document.getElementById('intensity').addEventListener('input',e=>{
  intensity=+e.target.value;
  document.getElementById('intensityVal').textContent=String(Math.round(intensity));
});
document.getElementById('toggleTone').addEventListener('click',e=>{
  tone=1-tone;
  e.currentTarget.textContent=tone===0?'Reinhard Tone Map':'Exposure Tone Map';
  e.currentTarget.classList.toggle('active',tone===1);
});
requestAnimationFrame(render);
})();
(()=>{
const canvas=document.getElementById('gl');
const gl=canvas.getContext('webgl2',{antialias:false});
if(!gl){document.body.innerHTML='<p style="padding:24px">需要支持 WebGL2 的浏览器。</p>';return;}
if(!gl.getExtension('EXT_color_buffer_float')){document.body.innerHTML='<p style="padding:24px">当前浏览器缺少 EXT_color_buffer_float。</p>';return;}

function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s}
function program(vs,fs){const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p}
const vs='#version 300 es\nlayout(location=0) in vec2 aPos;out vec2 uv;void main(){uv=aPos*.5+.5;gl_Position=vec4(aPos,0,1);}';

const sceneFS=[
'#version 300 es','precision highp float;','in vec2 uv;','layout(location=0) out vec4 SceneColor;','layout(location=1) out vec4 BrightColor;','uniform float uThreshold;',
'float box(vec2 p,vec2 c,vec2 h,float s){vec2 d=abs(p-c)-h;return 1.0-smoothstep(0.0,s,max(d.x,d.y));}',
'float lineMask(vec2 p,vec2 a,vec2 b,float w){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);return 1.0-smoothstep(w,w+.006,length(pa-ba*h));}',
'float circle(vec2 p,vec2 c,float r,float s){return 1.0-smoothstep(r,r+s,length(p-c));}',
'void main(){',
' vec2 p=uv; vec3 c=vec3(.008,.012,.020);',
' float ground=smoothstep(.48,.08,p.y); c+=vec3(.015,.018,.026)*ground;',
' float skyline=step(p.y,.20+.05*sin(p.x*36.0)+.03*sin(p.x*71.0)); c=mix(c,vec3(.012,.015,.023),skyline);',
' for(int i=0;i<12;i++){float x=.04+float(i)*.08;float win=box(p,vec2(x,.16),vec2(.012,.035),.003);c+=win*vec3(.35,.12,.02)*(1.0+float(i%3));}',
' float sign=box(p,vec2(.50,.60),vec2(.23,.12),.01); c=mix(c,vec3(.025,.015,.04),sign*.75);',
' float border=box(p,vec2(.50,.60),vec2(.23,.12),.008)-box(p,vec2(.50,.60),vec2(.205,.095),.008); c+=max(border,0.0)*vec3(7.0,.25,4.2);',
' float n1=lineMask(p,vec2(.34,.61),vec2(.42,.67),.009)+lineMask(p,vec2(.42,.67),vec2(.42,.55),.009)+lineMask(p,vec2(.42,.55),vec2(.34,.61),.009);',
' float n2=lineMask(p,vec2(.48,.54),vec2(.48,.67),.009)+lineMask(p,vec2(.48,.61),vec2(.56,.61),.009)+lineMask(p,vec2(.56,.54),vec2(.56,.67),.009);',
' float n3=circle(p,vec2(.64,.61),.052,.008)-circle(p,vec2(.64,.61),.025,.008);',
' c+=max(n1,0.0)*vec3(.2,4.2,8.0); c+=max(n2,0.0)*vec3(6.0,.25,2.6); c+=max(n3,0.0)*vec3(8.0,2.0,.2);',
' float lamp1=circle(p,vec2(.20,.74),.018,.01);float lamp2=circle(p,vec2(.82,.72),.014,.008);c+=lamp1*vec3(13.0,4.0,.4)+lamp2*vec3(.4,4.0,12.0);',
' float road1=lineMask(p,vec2(.10,.05),vec2(.46,.40),.008);float road2=lineMask(p,vec2(.90,.05),vec2(.58,.40),.008);c+=road1*vec3(1.2,.08,.08)+road2*vec3(.08,.15,1.3);',
' float vig=1.0-.42*pow(length(p-.5),1.4);c*=vig;',
' float b=dot(c,vec3(.2126,.7152,.0722));SceneColor=vec4(c,1);BrightColor=vec4(b>uThreshold?c:vec3(0),1);',
'}'].join('\n');

const blurFS=[
'#version 300 es','precision highp float;','in vec2 uv;out vec4 FragColor;','uniform sampler2D image;uniform bool horizontal;',
'void main(){vec2 o=1.0/vec2(textureSize(image,0));float w[5];w[0]=.227027;w[1]=.194595;w[2]=.121622;w[3]=.054054;w[4]=.016216;',
'vec3 r=texture(image,uv).rgb*w[0];for(int i=1;i<5;i++){vec2 d=horizontal?vec2(o.x*float(i),0):vec2(0,o.y*float(i));r+=texture(image,uv+d).rgb*w[i];r+=texture(image,uv-d).rgb*w[i];}FragColor=vec4(r,1);}'
].join('\n');

const finalFS=[
'#version 300 es','precision highp float;','in vec2 uv;out vec4 FragColor;','uniform sampler2D sceneTex;uniform sampler2D brightTex;uniform sampler2D blurTex;uniform int mode;uniform float strength;uniform float exposure;',
'vec3 tm(vec3 c){return vec3(1)-exp(-c*exposure);}vec3 gamma(vec3 c){return pow(clamp(c,0.0,1.0),vec3(1.0/2.2));}',
'void main(){vec3 s=texture(sceneTex,uv).rgb;vec3 b=texture(brightTex,uv).rgb;vec3 bl=texture(blurTex,uv).rgb;vec3 c;',
'if(mode==0)c=s;else if(mode==1)c=b;else if(mode==2)c=bl;else c=s+bl*strength;',
'FragColor=vec4(gamma(tm(c)),1);}'
].join('\n');

const sceneP=program(vs,sceneFS),blurP=program(vs,blurFS),finalP=program(vs,finalFS);
const vao=gl.createVertexArray();gl.bindVertexArray(vao);const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);

function makeTex(){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,canvas.width,canvas.height,0,gl.RGBA,gl.HALF_FLOAT,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t}
const sceneTex=makeTex(),brightTex=makeTex();
const hdrFbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,hdrFbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,sceneTex,0);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT1,gl.TEXTURE_2D,brightTex,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1]);
const pingTex=[makeTex(),makeTex()],pingFbo=[gl.createFramebuffer(),gl.createFramebuffer()];
for(let i=0;i<2;i++){gl.bindFramebuffer(gl.FRAMEBUFFER,pingFbo[i]);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,pingTex[i],0);}
gl.bindFramebuffer(gl.FRAMEBUFFER,null);

let threshold=1,passes=10,strength=1,exposure=.9,mode=3;
function drawQuad(){gl.bindVertexArray(vao);gl.drawArrays(gl.TRIANGLES,0,6)}
function frame(){
 gl.viewport(0,0,canvas.width,canvas.height);
 gl.bindFramebuffer(gl.FRAMEBUFFER,hdrFbo);gl.useProgram(sceneP);gl.uniform1f(gl.getUniformLocation(sceneP,'uThreshold'),threshold);drawQuad();

 let horizontal=true,first=true,last=0;
 gl.useProgram(blurP);gl.uniform1i(gl.getUniformLocation(blurP,'image'),0);
 for(let i=0;i<passes;i++){const idx=horizontal?0:1;gl.bindFramebuffer(gl.FRAMEBUFFER,pingFbo[idx]);gl.uniform1i(gl.getUniformLocation(blurP,'horizontal'),horizontal?1:0);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,first?brightTex:pingTex[last]);drawQuad();first=false;last=idx;horizontal=!horizontal;}
 const blurTex=passes>0?pingTex[last]:brightTex;

 gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(finalP);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,sceneTex);gl.uniform1i(gl.getUniformLocation(finalP,'sceneTex'),0);
 gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,brightTex);gl.uniform1i(gl.getUniformLocation(finalP,'brightTex'),1);
 gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,blurTex);gl.uniform1i(gl.getUniformLocation(finalP,'blurTex'),2);
 gl.uniform1i(gl.getUniformLocation(finalP,'mode'),mode);gl.uniform1f(gl.getUniformLocation(finalP,'strength'),strength);gl.uniform1f(gl.getUniformLocation(finalP,'exposure'),exposure);drawQuad();
 requestAnimationFrame(frame);
}
document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));btn.classList.add('active');mode={scene:0,bright:1,blur:2,final:3}[btn.dataset.mode];}));
for(const [id,set,val] of [['threshold',v=>threshold=v,'thresholdVal'],['passes',v=>passes=Math.round(v),'passesVal'],['strength',v=>strength=v,'strengthVal'],['exposure',v=>exposure=v,'exposureVal']]){document.getElementById(id).addEventListener('input',e=>{const v=+e.target.value;set(v);document.getElementById(val).textContent=id==='passes'?String(Math.round(v)):v.toFixed(2);});}
requestAnimationFrame(frame);
})();
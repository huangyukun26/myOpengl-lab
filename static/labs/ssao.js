(()=>{
const canvas=document.getElementById('gl');
const gl=canvas.getContext('webgl2',{antialias:true});
if(!gl){document.body.innerHTML='<p style="padding:24px">需要 WebGL2。</p>';return;}
if(!gl.getExtension('EXT_color_buffer_float')){document.body.innerHTML='<p style="padding:24px">当前浏览器缺少 EXT_color_buffer_float。</p>';return;}

function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
function program(vs,fs){const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}
function U(p,n){return gl.getUniformLocation(p,n);}

const geomVS=[
'#version 300 es',
'layout(location=0) in vec3 aPos;layout(location=1) in vec3 aNormal;',
'uniform mat4 uModel,uView,uProj;out vec3 vPos;out vec3 vNormal;',
'void main(){vec4 viewPos=uView*uModel*vec4(aPos,1.0);vPos=viewPos.xyz;vNormal=normalize(mat3(uView*uModel)*aNormal);gl_Position=uProj*viewPos;}'
].join('\n');
const geomFS=[
'#version 300 es','precision highp float;',
'layout(location=0) out vec4 gPosition;layout(location=1) out vec4 gNormal;layout(location=2) out vec4 gAlbedo;',
'in vec3 vPos;in vec3 vNormal;uniform vec3 uAlbedo;',
'void main(){gPosition=vec4(vPos,1.0);gNormal=vec4(normalize(vNormal),1.0);gAlbedo=vec4(uAlbedo,1.0);}'
].join('\n');

const quadVS=[
'#version 300 es','layout(location=0) in vec2 aPos;out vec2 uv;',
'void main(){uv=aPos*.5+.5;gl_Position=vec4(aPos,0.0,1.0);}'
].join('\n');

const ssaoFS=[
'#version 300 es','precision highp float;','in vec2 uv;out float FragColor;',
'uniform sampler2D gPosition;uniform sampler2D gNormal;uniform sampler2D texNoise;',
'uniform vec3 samples[64];uniform int kernelSize;uniform float radius;uniform float bias;uniform float power;uniform bool useNoise;uniform vec2 noiseScale;uniform mat4 projection;',
'void main(){vec4 gp=texture(gPosition,uv);if(gp.a<0.5){FragColor=1.0;return;}vec3 fragPos=gp.xyz;vec3 normal=normalize(texture(gNormal,uv).xyz);',
'vec3 randomVec;if(useNoise){randomVec=normalize(texture(texNoise,uv*noiseScale).xyz);}else{randomVec=abs(normal.z)<.99?vec3(0.0,0.0,1.0):vec3(1.0,0.0,0.0);}',
'vec3 tangent=normalize(randomVec-normal*dot(randomVec,normal));vec3 bitangent=cross(normal,tangent);mat3 TBN=mat3(tangent,bitangent,normal);float occ=0.0;',
'for(int i=0;i<64;i++){if(i>=kernelSize)break;vec3 samplePos=fragPos+(TBN*samples[i])*radius;vec4 offset=projection*vec4(samplePos,1.0);offset.xyz/=offset.w;offset.xyz=offset.xyz*.5+.5;',
'if(offset.x<0.0||offset.x>1.0||offset.y<0.0||offset.y>1.0)continue;float sampleDepth=texture(gPosition,offset.xy).z;float dz=abs(fragPos.z-sampleDepth);float rangeCheck=smoothstep(0.0,1.0,radius/max(dz,0.0001));occ+=(sampleDepth>=samplePos.z+bias?1.0:0.0)*rangeCheck;}',
'float ao=1.0-(occ/float(kernelSize));FragColor=pow(clamp(ao,0.0,1.0),power);}'
].join('\n');

const blurFS=[
'#version 300 es','precision highp float;','in vec2 uv;out float FragColor;uniform sampler2D ssaoInput;',
'void main(){vec2 t=1.0/vec2(textureSize(ssaoInput,0));float r=0.0;for(int x=-2;x<2;x++)for(int y=-2;y<2;y++)r+=texture(ssaoInput,uv+vec2(float(x),float(y))*t).r;FragColor=r/16.0;}'
].join('\n');

const finalFS=[
'#version 300 es','precision highp float;','in vec2 uv;out vec4 FragColor;',
'uniform sampler2D gPosition,gNormal,gAlbedo,ssaoRaw,ssaoBlur;uniform int mode;uniform bool blurOn;uniform vec3 lightPos;uniform vec3 lightColor;',
'vec3 gammaEncode(vec3 c){return pow(clamp(c,0.0,1.0),vec3(1.0/2.2));}',
'void main(){vec4 A=texture(gAlbedo,uv);vec3 P=texture(gPosition,uv).xyz;vec3 N=normalize(texture(gNormal,uv).xyz);float raw=texture(ssaoRaw,uv).r;float ao=blurOn?texture(ssaoBlur,uv).r:raw;',
'if(mode==2){FragColor=vec4(vec3(raw),1.0);return;}if(mode==3){FragColor=vec4(vec3(texture(ssaoBlur,uv).r),1.0);return;}if(mode==4){FragColor=vec4(clamp(P*.08+.5,0.0,1.0),1.0);return;}if(mode==5){FragColor=vec4(N*.5+.5,1.0);return;}if(A.a<0.5){FragColor=vec4(.015,.02,.03,1.0);return;}',
'float useAO=mode==1?1.0:ao;vec3 ambient=.30*A.rgb*useAO;vec3 L=normalize(lightPos-P);float diff=max(dot(N,L),0.0);float dist=length(lightPos-P);float att=1.0/(1.0+.09*dist+.032*dist*dist);vec3 V=normalize(-P);vec3 H=normalize(L+V);float spec=pow(max(dot(N,H),0.0),16.0);vec3 c=ambient+(A.rgb*diff*lightColor+vec3(spec)*lightColor)*att*1.5;FragColor=vec4(gammaEncode(c),1.0);}'
].join('\n');

const geomP=program(geomVS,geomFS),ssaoP=program(quadVS,ssaoFS),blurP=program(quadVS,blurFS),finalP=program(quadVS,finalFS);

const cubeVerts=new Float32Array([
-1,-1,-1,0,0,-1, 1,1,-1,0,0,-1, 1,-1,-1,0,0,-1, 1,1,-1,0,0,-1,-1,-1,-1,0,0,-1,-1,1,-1,0,0,-1,
-1,-1,1,0,0,1, 1,-1,1,0,0,1, 1,1,1,0,0,1, 1,1,1,0,0,1,-1,1,1,0,0,1,-1,-1,1,0,0,1,
-1,1,1,-1,0,0,-1,1,-1,-1,0,0,-1,-1,-1,-1,0,0,-1,-1,-1,-1,0,0,-1,-1,-1,1,-1,0,0,-1,1,1,-1,0,0,
1,1,1,1,0,0,1,-1,-1,1,0,0,1,1,-1,1,0,0,1,-1,-1,1,0,0,1,1,1,1,0,0,1,-1,1,1,0,0,
-1,-1,-1,0,-1,0,1,-1,-1,0,-1,0,1,-1,1,0,-1,0,1,-1,1,0,-1,0,-1,-1,1,0,-1,0,-1,-1,-1,0,-1,0,
-1,1,-1,0,1,0,1,1,1,0,1,0,1,1,-1,0,1,0,1,1,1,0,1,0,-1,1,-1,0,1,0,-1,1,1,0,1,0
]);
const cubeVAO=gl.createVertexArray();gl.bindVertexArray(cubeVAO);const cb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,cb);gl.bufferData(gl.ARRAY_BUFFER,cubeVerts,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);
const quadVAO=gl.createVertexArray();gl.bindVertexArray(quadVAO);const qb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,qb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);

function makeTex(internal,format,type,filter=gl.NEAREST){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,internal,canvas.width,canvas.height,0,format,type,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
const gPos=makeTex(gl.RGBA16F,gl.RGBA,gl.HALF_FLOAT),gNorm=makeTex(gl.RGBA16F,gl.RGBA,gl.HALF_FLOAT),gAlb=makeTex(gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE);
const gFBO=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,gFBO);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,gPos,0);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT1,gl.TEXTURE_2D,gNorm,0);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT2,gl.TEXTURE_2D,gAlb,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1,gl.COLOR_ATTACHMENT2]);const depth=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,canvas.width,canvas.height);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);
const aoTex=makeTex(gl.R16F,gl.RED,gl.HALF_FLOAT),aoBlurTex=makeTex(gl.R16F,gl.RED,gl.HALF_FLOAT);
const aoFBO=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,aoFBO);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,aoTex,0);
const blurFBO=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,blurFBO);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,aoBlurTex,0);gl.bindFramebuffer(gl.FRAMEBUFFER,null);

function norm3(x,y,z){const l=Math.hypot(x,y,z)||1;return [x/l,y/l,z/l];}
const kernel=[];for(let i=0;i<64;i++){let x=Math.random()*2-1,y=Math.random()*2-1,z=Math.random();let n=norm3(x,y,z);let r=Math.random();let s=i/64;s=.1+.9*s*s;kernel.push(n[0]*r*s,n[1]*r*s,n[2]*r*s);}
const noise=[];for(let i=0;i<16;i++){const n=norm3(Math.random()*2-1,Math.random()*2-1,0);noise.push(n[0],n[1],0);}
const noiseTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,noiseTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB32F,4,4,0,gl.RGB,gl.FLOAT,new Float32Array(noise));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);

function I(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);}
function mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s;}return o;}
function T(x,y,z){const m=I();m[12]=x;m[13]=y;m[14]=z;return m;}function S(x,y,z){const m=I();m[0]=x;m[5]=y;m[10]=z;return m;}function model(x,y,z,sx,sy,sz){return mul(T(x,y,z),S(sx,sy,sz));}
function perspective(fov,asp,n,f){const q=1/Math.tan(fov/2),o=new Float32Array(16);o[0]=q/asp;o[5]=q;o[10]=(f+n)/(n-f);o[11]=-1;o[14]=2*f*n/(n-f);return o;}
function lookAt(e,c,u){let zx=e[0]-c[0],zy=e[1]-c[1],zz=e[2]-c[2],l=Math.hypot(zx,zy,zz);zx/=l;zy/=l;zz/=l;let xx=u[1]*zz-u[2]*zy,xy=u[2]*zx-u[0]*zz,xz=u[0]*zy-u[1]*zx;l=Math.hypot(xx,xy,xz);xx/=l;xy/=l;xz/=l;let yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;const o=I();o[0]=xx;o[1]=yx;o[2]=zx;o[4]=xy;o[5]=yy;o[6]=zy;o[8]=xz;o[9]=yz;o[10]=zz;o[12]=-(xx*e[0]+xy*e[1]+xz*e[2]);o[13]=-(yx*e[0]+yy*e[1]+yz*e[2]);o[14]=-(zx*e[0]+zy*e[1]+zz*e[2]);return o;}
function transformPoint(m,p){return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];}
const proj=perspective(Math.PI/4,canvas.width/canvas.height,.1,50),view=lookAt([6,4.6,7],[0,-.2,0],[0,1,0]);
const models=[
[model(0,-1.25,0,5,.15,5),[.28,.31,.36]],
[model(0,1.25,-4.6,5,2.5,.15),[.24,.27,.31]],
[model(-4.6,1.25,0,.15,2.5,5),[.22,.25,.30]],
[model(-.8,-.15,-.4,1.05,1.05,1.05),[.56,.35,.20]],
[model(2.0,.1,-1.0,.45,1.35,.45),[.20,.42,.62]],
[model(1.8,-.65,1.7,1.25,.45,.8),[.38,.48,.28]],
[model(-2.7,-.55,1.3,.55,.55,.55),[.48,.26,.48]]
];
const lightWorld=[2.8,4.0,2.2],lightView=transformPoint(view,lightWorld);

let mode=0,kernelSize=32,radius=.55,bias=.025,power=1,useNoise=true,blurOn=true;
function bindTex(unit,t,p,name){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);gl.uniform1i(U(p,name),unit);}
function quad(){gl.bindVertexArray(quadVAO);gl.drawArrays(gl.TRIANGLES,0,6);}

function renderGeometry(){gl.bindFramebuffer(gl.FRAMEBUFFER,gFBO);gl.viewport(0,0,canvas.width,canvas.height);gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(geomP);gl.uniformMatrix4fv(U(geomP,'uView'),false,view);gl.uniformMatrix4fv(U(geomP,'uProj'),false,proj);gl.bindVertexArray(cubeVAO);for(const m of models){gl.uniformMatrix4fv(U(geomP,'uModel'),false,m[0]);gl.uniform3fv(U(geomP,'uAlbedo'),new Float32Array(m[1]));gl.drawArrays(gl.TRIANGLES,0,36);}}
function renderSSAO(){gl.bindFramebuffer(gl.FRAMEBUFFER,aoFBO);gl.disable(gl.DEPTH_TEST);gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(ssaoP);bindTex(0,gPos,ssaoP,'gPosition');bindTex(1,gNorm,ssaoP,'gNormal');bindTex(2,noiseTex,ssaoP,'texNoise');gl.uniform3fv(U(ssaoP,'samples[0]'),new Float32Array(kernel));gl.uniform1i(U(ssaoP,'kernelSize'),kernelSize);gl.uniform1f(U(ssaoP,'radius'),radius);gl.uniform1f(U(ssaoP,'bias'),bias);gl.uniform1f(U(ssaoP,'power'),power);gl.uniform1i(U(ssaoP,'useNoise'),useNoise?1:0);gl.uniform2f(U(ssaoP,'noiseScale'),canvas.width/4,canvas.height/4);gl.uniformMatrix4fv(U(ssaoP,'projection'),false,proj);quad();}
function renderBlur(){gl.bindFramebuffer(gl.FRAMEBUFFER,blurFBO);gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(blurP);bindTex(0,aoTex,blurP,'ssaoInput');quad();}
function renderFinal(){gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.01,.015,.025,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(finalP);bindTex(0,gPos,finalP,'gPosition');bindTex(1,gNorm,finalP,'gNormal');bindTex(2,gAlb,finalP,'gAlbedo');bindTex(3,aoTex,finalP,'ssaoRaw');bindTex(4,aoBlurTex,finalP,'ssaoBlur');gl.uniform1i(U(finalP,'mode'),mode);gl.uniform1i(U(finalP,'blurOn'),blurOn?1:0);gl.uniform3fv(U(finalP,'lightPos'),new Float32Array(lightView));gl.uniform3f(U(finalP,'lightColor'),.35,.45,1.0);quad();}
function frame(){renderGeometry();renderSSAO();renderBlur();renderFinal();requestAnimationFrame(frame);}requestAnimationFrame(frame);

document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));btn.classList.add('active');mode={final:0,noao:1,raw:2,blur:3,position:4,normal:5}[btn.dataset.mode];document.getElementById('badge').textContent={0:'Final Lighting + SSAO',1:'Lighting without SSAO',2:'Raw SSAO Texture',3:'Blurred SSAO Texture',4:'G-Buffer Position',5:'G-Buffer Normal'}[mode];}));
document.getElementById('kernel').addEventListener('input',e=>{kernelSize=+e.target.value;document.getElementById('kernelVal').textContent=kernelSize;});
document.getElementById('radius').addEventListener('input',e=>{radius=+e.target.value;document.getElementById('radiusVal').textContent=radius.toFixed(2);});
document.getElementById('bias').addEventListener('input',e=>{bias=+e.target.value;document.getElementById('biasVal').textContent=bias.toFixed(3);});
document.getElementById('power').addEventListener('input',e=>{power=+e.target.value;document.getElementById('powerVal').textContent=power.toFixed(1);});
document.getElementById('noise').addEventListener('click',e=>{useNoise=!useNoise;e.currentTarget.classList.toggle('active',useNoise);e.currentTarget.textContent='Noise rotation '+(useNoise?'ON':'OFF');});
document.getElementById('blurToggle').addEventListener('click',e=>{blurOn=!blurOn;e.currentTarget.classList.toggle('active',blurOn);e.currentTarget.textContent='Blur '+(blurOn?'ON':'OFF');});
})();
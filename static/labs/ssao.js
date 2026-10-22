(()=>{
const canvas=document.getElementById('gl');
const statusEl=document.getElementById('status');
const gl=canvas.getContext('webgl2',{antialias:true});
if(!gl){statusEl.textContent='WebGL2 unavailable';return;}
if(!gl.getExtension('EXT_color_buffer_float')){statusEl.textContent='EXT_color_buffer_float unavailable';return;}

function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
function program(vs,fs){const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}
function U(p,n){return gl.getUniformLocation(p,n);}

const geomVS=[
'#version 300 es',
'layout(location=0) in vec3 aPos;layout(location=1) in vec3 aNormal;',
'uniform mat4 uModel,uView,uProj;uniform float uInvertNormal;',
'out vec3 vPos;out vec3 vNormal;',
'void main(){vec4 viewPos=uView*uModel*vec4(aPos,1.0);vPos=viewPos.xyz;vec3 n=mat3(uView*uModel)*aNormal;vNormal=normalize(n)*mix(1.0,-1.0,uInvertNormal);gl_Position=uProj*viewPos;}'
].join('\n');

const geomFS=[
'#version 300 es',
'precision highp float;',
'layout(location=0) out vec4 gPosition;',
'layout(location=1) out vec4 gNormal;',
'layout(location=2) out vec4 gAlbedo;',
'in vec3 vPos;in vec3 vNormal;',
'void main(){gPosition=vec4(vPos,1.0);gNormal=vec4(normalize(vNormal),1.0);gAlbedo=vec4(vec3(0.95),1.0);}'
].join('\n');

const quadVS=[
'#version 300 es',
'layout(location=0) in vec2 aPos;',
'out vec2 uv;',
'void main(){uv=aPos*.5+.5;gl_Position=vec4(aPos,0.0,1.0);}'
].join('\n');

const ssaoFS=[
'#version 300 es',
'precision highp float;',
'in vec2 uv;out float FragColor;',
'uniform sampler2D gPosition;uniform sampler2D gNormal;uniform sampler2D texNoise;',
'uniform vec3 samples[64];uniform int kernelSize;uniform float radius;uniform float bias;uniform float power;',
'uniform bool useNoise;uniform bool useRange;uniform vec2 noiseScale;uniform mat4 projection;',
'void main(){',
' vec4 gp=texture(gPosition,uv);if(gp.a<0.5){FragColor=1.0;return;}',
' vec3 fragPos=gp.xyz;',
' vec3 normal=normalize(texture(gNormal,uv).xyz);',
' vec3 randomVec;',
' if(useNoise){randomVec=normalize(texture(texNoise,uv*noiseScale).xyz);}else{randomVec=abs(normal.z)<.99?vec3(0.0,0.0,1.0):vec3(1.0,0.0,0.0);}',
' vec3 tangent=normalize(randomVec-normal*dot(randomVec,normal));',
' vec3 bitangent=cross(normal,tangent);',
' mat3 TBN=mat3(tangent,bitangent,normal);',
' float occ=0.0;',
' for(int i=0;i<64;i++){',
'   if(i>=kernelSize)break;',
'   vec3 samplePos=fragPos+(TBN*samples[i])*radius;',
'   vec4 offset=projection*vec4(samplePos,1.0);',
'   offset.xyz/=offset.w;',
'   offset.xyz=offset.xyz*.5+.5;',
'   if(offset.x<0.0||offset.x>1.0||offset.y<0.0||offset.y>1.0)continue;',
'   float sampleDepth=texture(gPosition,offset.xy).z;',
'   float rangeCheck=1.0;',
'   if(useRange){rangeCheck=smoothstep(0.0,1.0,radius/max(abs(fragPos.z-sampleDepth),0.0001));}',
'   occ+=(sampleDepth>=samplePos.z+bias?1.0:0.0)*rangeCheck;',
' }',
' float ao=1.0-(occ/float(kernelSize));',
' FragColor=pow(clamp(ao,0.0,1.0),power);',
'}'
].join('\n');

const blurFS=[
'#version 300 es',
'precision highp float;',
'in vec2 uv;out float FragColor;uniform sampler2D ssaoInput;',
'void main(){vec2 t=1.0/vec2(textureSize(ssaoInput,0));float r=0.0;for(int x=-2;x<2;x++){for(int y=-2;y<2;y++){r+=texture(ssaoInput,uv+vec2(float(x),float(y))*t).r;}}FragColor=r/16.0;}'
].join('\n');

const finalFS=[
'#version 300 es',
'precision highp float;',
'in vec2 uv;out vec4 FragColor;',
'uniform sampler2D gPosition,gNormal,gAlbedo,ssaoRaw,ssaoBlur;',
'uniform int mode;uniform bool blurOn;uniform vec3 lightPos;uniform vec3 lightColor;',
'void main(){',
' vec4 A=texture(gAlbedo,uv);',
' vec3 P=texture(gPosition,uv).xyz;',
' vec3 N=normalize(texture(gNormal,uv).xyz);',
' float raw=texture(ssaoRaw,uv).r;',
' float ao=blurOn?texture(ssaoBlur,uv).r:raw;',
' if(mode==2){FragColor=vec4(vec3(raw),1.0);return;}',
' if(mode==3){FragColor=vec4(vec3(texture(ssaoBlur,uv).r),1.0);return;}',
' if(mode==4){FragColor=vec4(clamp(P*.08+.5,0.0,1.0),1.0);return;}',
' if(mode==5){FragColor=vec4(N*.5+.5,1.0);return;}',
' if(A.a<0.5){FragColor=vec4(0.0,0.0,0.0,1.0);return;}',
' float ambientOcclusion=mode==1?1.0:ao;',
' vec3 ambient=vec3(0.3*A.rgb*ambientOcclusion);',
' vec3 viewDir=normalize(-P);',
' vec3 lightDir=normalize(lightPos-P);',
' vec3 diffuse=max(dot(N,lightDir),0.0)*A.rgb*lightColor;',
' vec3 halfwayDir=normalize(lightDir+viewDir);',
' float spec=pow(max(dot(N,halfwayDir),0.0),8.0);',
' vec3 specular=lightColor*spec;',
' float distance=length(lightPos-P);',
' float attenuation=1.0/(1.0+0.09*distance+0.032*distance*distance);',
' diffuse*=attenuation;specular*=attenuation;',
' vec3 lighting=ambient+diffuse+specular;',
' FragColor=vec4(lighting,1.0);',
'}'
].join('\n');

const geomP=program(geomVS,geomFS);
const ssaoP=program(quadVS,ssaoFS);
const blurP=program(quadVS,blurFS);
const finalP=program(quadVS,finalFS);

const cubeVerts=new Float32Array([
-1,-1,-1,0,0,-1, 1,1,-1,0,0,-1, 1,-1,-1,0,0,-1, 1,1,-1,0,0,-1,-1,-1,-1,0,0,-1,-1,1,-1,0,0,-1,
-1,-1,1,0,0,1, 1,-1,1,0,0,1, 1,1,1,0,0,1, 1,1,1,0,0,1,-1,1,1,0,0,1,-1,-1,1,0,0,1,
-1,1,1,-1,0,0,-1,1,-1,-1,0,0,-1,-1,-1,-1,0,0,-1,-1,-1,-1,0,0,-1,-1,-1,1,-1,0,0,-1,1,1,-1,0,0,
1,1,1,1,0,0,1,-1,-1,1,0,0,1,1,-1,1,0,0,1,-1,-1,1,0,0,1,1,1,1,0,0,1,-1,1,1,0,0,
-1,-1,-1,0,-1,0,1,-1,-1,0,-1,0,1,-1,1,0,-1,0,1,-1,1,0,-1,0,-1,-1,1,0,-1,0,-1,-1,-1,0,-1,0,
-1,1,-1,0,1,0,1,1,1,0,1,0,1,1,-1,0,1,0,1,1,1,0,1,0,-1,1,-1,0,1,0,-1,1,1,0,1,0
]);

function vaoFromInterleaved(data){
 const vao=gl.createVertexArray();gl.bindVertexArray(vao);
 const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
 gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);
 gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);
 return {vao,count:data.length/6,buffer:b};
}
const cube=vaoFromInterleaved(cubeVerts);

const quadVAO=gl.createVertexArray();gl.bindVertexArray(quadVAO);
const qb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,qb);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);

function parseOBJ(text){
 const positions=[[0,0,0]],normals=[[0,0,1]],out=[];
 const lines=text.split(/\r?\n/);
 const idx=(n,len)=>n<0?len+n:parseInt(n,10);
 function emit(tok){
   const p=tok.split('/');
   const vi=idx(p[0],positions.length);
   const ni=p[2]?idx(p[2],normals.length):0;
   const v=positions[vi]||positions[0];
   const n=normals[ni]||normals[0];
   out.push(v[0],v[1],v[2],n[0],n[1],n[2]);
 }
 for(const line of lines){
   if(line.startsWith('v ')){
     const a=line.trim().split(/\s+/);positions.push([+a[1],+a[2],+a[3]]);
   }else if(line.startsWith('vn ')){
     const a=line.trim().split(/\s+/);normals.push([+a[1],+a[2],+a[3]]);
   }else if(line.startsWith('f ')){
     const a=line.trim().split(/\s+/).slice(1);
     for(let i=1;i<a.length-1;i++){emit(a[0]);emit(a[i]);emit(a[i+1]);}
   }
 }
 return new Float32Array(out);
}

function makeTex(internal,format,type,filter=gl.NEAREST){
 const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
 gl.texImage2D(gl.TEXTURE_2D,0,internal,canvas.width,canvas.height,0,format,type,null);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 return t;
}
const gPos=makeTex(gl.RGBA16F,gl.RGBA,gl.HALF_FLOAT);
const gNorm=makeTex(gl.RGBA16F,gl.RGBA,gl.HALF_FLOAT);
const gAlb=makeTex(gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE);

const gFBO=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,gFBO);
gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,gPos,0);
gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT1,gl.TEXTURE_2D,gNorm,0);
gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT2,gl.TEXTURE_2D,gAlb,0);
gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1,gl.COLOR_ATTACHMENT2]);
const depth=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,depth);
gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,canvas.width,canvas.height);
gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);

const aoTex=makeTex(gl.R16F,gl.RED,gl.HALF_FLOAT);
const aoBlurTex=makeTex(gl.R16F,gl.RED,gl.HALF_FLOAT);
const aoFBO=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,aoFBO);
gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,aoTex,0);
const blurFBO=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,blurFBO);
gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,aoBlurTex,0);
gl.bindFramebuffer(gl.FRAMEBUFFER,null);

function norm3(x,y,z){const l=Math.hypot(x,y,z)||1;return[x/l,y/l,z/l];}
const kernel=[];
for(let i=0;i<64;i++){
 let n=norm3(Math.random()*2-1,Math.random()*2-1,Math.random());
 const rnd=Math.random();
 let scale=i/64;scale=.1+.9*scale*scale;
 kernel.push(n[0]*rnd*scale,n[1]*rnd*scale,n[2]*rnd*scale);
}
const noise=[];
for(let i=0;i<16;i++){
 const n=norm3(Math.random()*2-1,Math.random()*2-1,0);
 noise.push(n[0],n[1],0);
}
const noiseTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,noiseTex);
gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB32F,4,4,0,gl.RGB,gl.FLOAT,new Float32Array(noise));
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);

function I(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);}
function mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s;}return o;}
function T(x,y,z){const m=I();m[12]=x;m[13]=y;m[14]=z;return m;}
function S(x,y,z){const m=I();m[0]=x;m[5]=y;m[10]=z;return m;}
function RX(a){const m=I(),c=Math.cos(a),s=Math.sin(a);m[5]=c;m[6]=s;m[9]=-s;m[10]=c;return m;}
function perspective(fov,asp,n,f){const q=1/Math.tan(fov/2),o=new Float32Array(16);o[0]=q/asp;o[5]=q;o[10]=(f+n)/(n-f);o[11]=-1;o[14]=2*f*n/(n-f);return o;}
function lookAt(e,c,u){let zx=e[0]-c[0],zy=e[1]-c[1],zz=e[2]-c[2],l=Math.hypot(zx,zy,zz);zx/=l;zy/=l;zz/=l;let xx=u[1]*zz-u[2]*zy,xy=u[2]*zx-u[0]*zz,xz=u[0]*zy-u[1]*zx;l=Math.hypot(xx,xy,xz);xx/=l;xy/=l;xz/=l;let yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;const o=I();o[0]=xx;o[1]=yx;o[2]=zx;o[4]=xy;o[5]=yy;o[6]=zy;o[8]=xz;o[9]=yz;o[10]=zz;o[12]=-(xx*e[0]+xy*e[1]+xz*e[2]);o[13]=-(yx*e[0]+yy*e[1]+yz*e[2]);o[14]=-(zx*e[0]+zy*e[1]+zz*e[2]);return o;}
function transformPoint(m,p){return[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];}

const proj=perspective(Math.PI/4,canvas.width/canvas.height,.1,50);
const view=lookAt([0,0,5],[0,0,0],[0,1,0]);
const roomModel=mul(T(0,7,0),S(7.5,7.5,7.5));
const backpackModel=mul(T(0,.5,0),RX(-Math.PI/2));
const lightWorld=[2,4,-2];
const lightView=transformPoint(view,lightWorld);

let backpack=null;
let mode=0,kernelSize=64,radius=.5,bias=.025,power=1,useNoise=true,useRange=true,blurOn=true;

function bindTex(unit,t,p,name){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);gl.uniform1i(U(p,name),unit);}
function quad(){gl.bindVertexArray(quadVAO);gl.drawArrays(gl.TRIANGLES,0,6);}
function drawMesh(mesh,model,invert){
 gl.uniformMatrix4fv(U(geomP,'uModel'),false,model);
 gl.uniform1f(U(geomP,'uInvertNormal'),invert?1:0);
 gl.bindVertexArray(mesh.vao);
 gl.drawArrays(gl.TRIANGLES,0,mesh.count);
}

function renderGeometry(){
 gl.bindFramebuffer(gl.FRAMEBUFFER,gFBO);gl.viewport(0,0,canvas.width,canvas.height);
 gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
 gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 gl.useProgram(geomP);
 gl.uniformMatrix4fv(U(geomP,'uView'),false,view);
 gl.uniformMatrix4fv(U(geomP,'uProj'),false,proj);
 drawMesh(cube,roomModel,true);
 if(backpack)drawMesh(backpack,backpackModel,false);
}

function renderSSAO(){
 gl.bindFramebuffer(gl.FRAMEBUFFER,aoFBO);gl.disable(gl.DEPTH_TEST);
 gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT);
 gl.useProgram(ssaoP);
 bindTex(0,gPos,ssaoP,'gPosition');bindTex(1,gNorm,ssaoP,'gNormal');bindTex(2,noiseTex,ssaoP,'texNoise');
 gl.uniform3fv(U(ssaoP,'samples[0]'),new Float32Array(kernel));
 gl.uniform1i(U(ssaoP,'kernelSize'),kernelSize);
 gl.uniform1f(U(ssaoP,'radius'),radius);
 gl.uniform1f(U(ssaoP,'bias'),bias);
 gl.uniform1f(U(ssaoP,'power'),power);
 gl.uniform1i(U(ssaoP,'useNoise'),useNoise?1:0);
 gl.uniform1i(U(ssaoP,'useRange'),useRange?1:0);
 gl.uniform2f(U(ssaoP,'noiseScale'),canvas.width/4,canvas.height/4);
 gl.uniformMatrix4fv(U(ssaoP,'projection'),false,proj);
 quad();
}

function renderBlur(){
 gl.bindFramebuffer(gl.FRAMEBUFFER,blurFBO);gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT);
 gl.useProgram(blurP);bindTex(0,aoTex,blurP,'ssaoInput');quad();
}

function renderFinal(){
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);
 gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);
 gl.useProgram(finalP);
 bindTex(0,gPos,finalP,'gPosition');bindTex(1,gNorm,finalP,'gNormal');bindTex(2,gAlb,finalP,'gAlbedo');bindTex(3,aoTex,finalP,'ssaoRaw');bindTex(4,aoBlurTex,finalP,'ssaoBlur');
 gl.uniform1i(U(finalP,'mode'),mode);
 gl.uniform1i(U(finalP,'blurOn'),blurOn?1:0);
 gl.uniform3fv(U(finalP,'lightPos'),new Float32Array(lightView));
 gl.uniform3f(U(finalP,'lightColor'),.2,.2,.7);
 quad();
}

function frame(){renderGeometry();renderSSAO();renderBlur();renderFinal();requestAnimationFrame(frame);}

async function loadOfficialBackpack(){
 try{
   const url='https://raw.githubusercontent.com/JoeyDeVries/LearnOpenGL/master/resources/objects/backpack/backpack.obj';
   const res=await fetch(url);
   if(!res.ok)throw new Error('HTTP '+res.status);
   const text=await res.text();
   const data=parseOBJ(text);
   backpack=vaoFromInterleaved(data);
   statusEl.textContent='Official backpack loaded · '+backpack.count.toLocaleString()+' vertices';
 }catch(err){
   console.error(err);
   statusEl.textContent='Backpack load failed · room still rendering';
 }
}

document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{
 document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
 btn.classList.add('active');
 mode={final:0,noao:1,raw:2,blur:3,position:4,normal:5}[btn.dataset.mode];
 document.getElementById('badge').textContent={0:'Final Lighting + SSAO',1:'Lighting without SSAO',2:'Raw SSAO Texture',3:'Blurred SSAO Texture',4:'G-Buffer Position',5:'G-Buffer Normal'}[mode];
}));
document.getElementById('kernel').addEventListener('input',e=>{kernelSize=+e.target.value;document.getElementById('kernelVal').textContent=kernelSize;});
document.getElementById('radius').addEventListener('input',e=>{radius=+e.target.value;document.getElementById('radiusVal').textContent=radius.toFixed(2);});
document.getElementById('bias').addEventListener('input',e=>{bias=+e.target.value;document.getElementById('biasVal').textContent=bias.toFixed(3);});
document.getElementById('power').addEventListener('input',e=>{power=+e.target.value;document.getElementById('powerVal').textContent=power.toFixed(1);});
document.getElementById('range').addEventListener('click',e=>{useRange=!useRange;e.currentTarget.classList.toggle('active',useRange);e.currentTarget.textContent='Range Check '+(useRange?'ON':'OFF');});
document.getElementById('noise').addEventListener('click',e=>{useNoise=!useNoise;e.currentTarget.classList.toggle('active',useNoise);e.currentTarget.textContent='Noise Rotation '+(useNoise?'ON':'OFF');});
document.getElementById('blurToggle').addEventListener('click',e=>{blurOn=!blurOn;e.currentTarget.classList.toggle('active',blurOn);e.currentTarget.textContent='Blur '+(blurOn?'ON':'OFF');});
document.getElementById('reset').addEventListener('click',()=>{
 kernelSize=64;radius=.5;bias=.025;power=1;useNoise=true;useRange=true;blurOn=true;
 const k=document.getElementById('kernel'),r=document.getElementById('radius'),b=document.getElementById('bias'),p=document.getElementById('power');
 k.value=64;r.value=.5;b.value=.025;p.value=1;
 document.getElementById('kernelVal').textContent='64';document.getElementById('radiusVal').textContent='0.50';document.getElementById('biasVal').textContent='0.025';document.getElementById('powerVal').textContent='1.0';
 for(const [id,on,label] of [['range',useRange,'Range Check'],['noise',useNoise,'Noise Rotation'],['blurToggle',blurOn,'Blur']]){const el=document.getElementById(id);el.classList.toggle('active',on);el.textContent=label+' '+(on?'ON':'OFF');}
});

loadOfficialBackpack();
requestAnimationFrame(frame);
})();
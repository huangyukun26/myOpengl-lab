(()=>{
const canvas=document.getElementById('gl');
const gl=canvas.getContext('webgl2',{antialias:true});
const loading=document.getElementById('loading');
if(!gl){loading.textContent='需要支持 WebGL2 的浏览器。';return;}
if(!gl.getExtension('EXT_color_buffer_float')){loading.textContent='当前浏览器缺少 EXT_color_buffer_float。';return;}

const ROOT='https://raw.githubusercontent.com/JoeyDeVries/LearnOpenGL/master/resources/objects/backpack/';
const WOOD='https://raw.githubusercontent.com/JoeyDeVries/LearnOpenGL/master/resources/textures/wood.png';

function sh(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s}
function prog(vs,fs){const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,vs));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p}
function loc(p,n){return gl.getUniformLocation(p,n)}

const gvs=['#version 300 es','layout(location=0) in vec3 aPos;layout(location=1) in vec3 aNormal;layout(location=2) in vec2 aUV;','uniform mat4 uModel,uView,uProj;out vec3 vPos;out vec3 vNormal;out vec2 vUV;','void main(){vec4 w=uModel*vec4(aPos,1.0);vPos=w.xyz;vNormal=normalize(mat3(transpose(inverse(uModel)))*aNormal);vUV=aUV;gl_Position=uProj*uView*w;}'].join('\n');
const gfs=['#version 300 es','precision highp float;','layout(location=0) out vec4 gPosition;layout(location=1) out vec4 gNormal;layout(location=2) out vec4 gAlbedoSpec;','in vec3 vPos;in vec3 vNormal;in vec2 vUV;uniform sampler2D uDiffuse;uniform sampler2D uSpecular;uniform vec3 uColor;uniform float uSpec;uniform bool uUseTex;','void main(){vec3 albedo=uUseTex?texture(uDiffuse,vUV).rgb:uColor;float spec=uUseTex?texture(uSpecular,vUV).r:uSpec;gPosition=vec4(vPos,1.0);gNormal=vec4(normalize(vNormal),1.0);gAlbedoSpec=vec4(albedo,spec);}'].join('\n');
const qvs='#version 300 es\nlayout(location=0) in vec2 aPos;out vec2 uv;void main(){uv=aPos*.5+.5;gl_Position=vec4(aPos,0,1);}';
const lfs=[
'#version 300 es','precision highp float;','in vec2 uv;out vec4 FragColor;','uniform sampler2D gPosition,gNormal,gAlbedoSpec;uniform int uMode,uLightCount;uniform vec3 uLightPos[64],uLightColor[64];uniform vec3 uViewPos;uniform float uRadius,uExposure;',
'vec3 tone(vec3 c){return pow(vec3(1.0)-exp(-c*uExposure),vec3(1.0/2.2));}',
'vec3 shade(vec2 t){vec3 p=texture(gPosition,t).xyz;vec3 n=texture(gNormal,t).xyz;vec4 a=texture(gAlbedoSpec,t);if(a.a==0.0&&dot(a.rgb,a.rgb)<.0001)return vec3(.008,.012,.02);vec3 V=normalize(uViewPos-p);vec3 c=a.rgb*.055;for(int i=0;i<64;i++){if(i>=uLightCount)break;vec3 d=uLightPos[i]-p;float dist=length(d);if(dist<uRadius){vec3 L=d/max(dist,.001);float att=1.0/(1.0+.18*dist+.22*dist*dist);float ndl=max(dot(n,L),0.0);vec3 H=normalize(L+V);float sp=pow(max(dot(n,H),0.0),24.0)*a.a;c+=(a.rgb*ndl+vec3(sp))*uLightColor[i]*att*2.4;}}return tone(c);}',
'vec3 debugMode(int m,vec2 t){vec3 p=texture(gPosition,t).xyz;vec3 n=texture(gNormal,t).xyz;vec4 a=texture(gAlbedoSpec,t);if(m==1)return p*.055+.5;if(m==2)return n*.5+.5;if(m==3)return a.rgb;if(m==4)return vec3(a.a);return shade(t);}',
'void main(){if(uMode==5){vec2 t=fract(uv*2.0);int mx=uv.x<.5?0:1;int my=uv.y<.5?0:1;int m=(my==1&&mx==0)?1:(my==1&&mx==1)?2:(my==0&&mx==0)?3:4;vec3 c=debugMode(m,t);float gx=1.0-smoothstep(0.0,.006,abs(fract(uv.x*2.0)));float gy=1.0-smoothstep(0.0,.006,abs(fract(uv.y*2.0)));c=mix(c,vec3(.05),max(gx,gy)*.6);FragColor=vec4(c,1);return;}FragColor=vec4(debugMode(uMode,uv),1);}'
].join('\n');
const emissiveVS=['#version 300 es','layout(location=0) in vec3 aPos;uniform mat4 uModel,uView,uProj;void main(){gl_Position=uProj*uView*uModel*vec4(aPos,1.0);}'].join('\n');
const emissiveFS=['#version 300 es','precision highp float;out vec4 FragColor;uniform vec3 uColor;void main(){FragColor=vec4(pow(uColor,vec3(1.0/2.2)),1);}'].join('\n');

const gp=prog(gvs,gfs),lp=prog(qvs,lfs),ep=prog(emissiveVS,emissiveFS);

function createMesh(data,stride=8){const vao=gl.createVertexArray();gl.bindVertexArray(vao);const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);const bytes=stride*4;gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,bytes,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,bytes,12);if(stride>=8){gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,2,gl.FLOAT,false,bytes,24)}return{vao,count:data.length/stride}}
function createPosMesh(data){const vao=gl.createVertexArray();gl.bindVertexArray(vao);const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,12,0);return{vao,count:data.length/3}}
function loadImg(url){return new Promise((res,rej)=>{const im=new Image();im.crossOrigin='anonymous';im.onload=()=>res(im);im.onerror=rej;im.src=url})}
function texFromImg(im,srgb=false){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,srgb?gl.SRGB8_ALPHA8:gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);return t}
function parseOBJ(text){const P=[[0,0,0]],N=[[0,0,1]],T=[[0,0]],out=[];const lines=text.split('\n');for(const line of lines){const s=line.trim();if(!s||s[0]=='#')continue;const a=s.split(/\s+/);if(a[0]=='v')P.push([+a[1],+a[2],+a[3]]);else if(a[0]=='vn')N.push([+a[1],+a[2],+a[3]]);else if(a[0]=='vt')T.push([+a[1],+a[2]]);else if(a[0]=='f'){const vs=a.slice(1).map(v=>v.split('/').map(Number));for(let i=1;i<vs.length-1;i++){for(const id of [vs[0],vs[i],vs[i+1]]){const p=P[id[0]||0]||P[0],t=T[id[1]||0]||T[0],n=N[id[2]||0]||N[0];out.push(p[0],p[1],p[2],n[0],n[1],n[2],t[0],t[1]);}}}}return out}

const plane=createMesh([
-7,0,-7,0,1,0,0,0, 7,0,-7,0,1,0,7,0, 7,0,7,0,1,0,7,7,
-7,0,-7,0,1,0,0,0, 7,0,7,0,1,0,7,7,-7,0,7,0,1,0,0,7
]);
const qvao=gl.createVertexArray();gl.bindVertexArray(qvao);const qb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,qb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);

function sphereData(seg=16,ring=10){const v=[];for(let y=0;y<ring;y++){const v0=y/ring,v1=(y+1)/ring,th0=v0*Math.PI,th1=v1*Math.PI;for(let x=0;x<seg;x++){const u0=x/seg,u1=(x+1)/seg,ph0=u0*Math.PI*2,ph1=u1*Math.PI*2;const pts=[[th0,ph0],[th1,ph0],[th1,ph1],[th0,ph0],[th1,ph1],[th0,ph1]];for(const [th,ph] of pts){const sx=Math.sin(th)*Math.cos(ph),sy=Math.cos(th),sz=Math.sin(th)*Math.sin(ph);v.push(sx,sy,sz)}}}return v}
const sphere=createPosMesh(sphereData());

function makeTex(internal,format,type){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,internal,canvas.width,canvas.height,0,format,type,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);return t}
const gPos=makeTex(gl.RGBA16F,gl.RGBA,gl.HALF_FLOAT),gNorm=makeTex(gl.RGBA16F,gl.RGBA,gl.HALF_FLOAT),gAlb=makeTex(gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE);
const gFbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,gFbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,gPos,0);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT1,gl.TEXTURE_2D,gNorm,0);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT2,gl.TEXTURE_2D,gAlb,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1,gl.COLOR_ATTACHMENT2]);const depth=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,canvas.width,canvas.height);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);gl.bindFramebuffer(gl.FRAMEBUFFER,null);

function I(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])}
function M(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s}return o}
function T(x,y,z){const m=I();m[12]=x;m[13]=y;m[14]=z;return m}
function S(x,y,z){const m=I();m[0]=x;m[5]=y;m[10]=z;return m}
function RY(a){const m=I(),c=Math.cos(a),s=Math.sin(a);m[0]=c;m[2]=-s;m[8]=s;m[10]=c;return m}
function model(x,y,z,s,ry=0){return M(T(x,y,z),M(RY(ry),S(s,s,s)))}
function persp(fov,asp,n,f){const q=1/Math.tan(fov/2),o=new Float32Array(16);o[0]=q/asp;o[5]=q;o[10]=(f+n)/(n-f);o[11]=-1;o[14]=2*f*n/(n-f);return o}
function look(e,c,u){let zx=e[0]-c[0],zy=e[1]-c[1],zz=e[2]-c[2],l=Math.hypot(zx,zy,zz);zx/=l;zy/=l;zz/=l;let xx=u[1]*zz-u[2]*zy,xy=u[2]*zx-u[0]*zz,xz=u[0]*zy-u[1]*zx;l=Math.hypot(xx,xy,xz);xx/=l;xy/=l;xz/=l;let yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;const o=I();o[0]=xx;o[1]=yx;o[2]=zx;o[4]=xy;o[5]=yy;o[6]=zy;o[8]=xz;o[9]=yz;o[10]=zz;o[12]=-(xx*e[0]+xy*e[1]+xz*e[2]);o[13]=-(yx*e[0]+yy*e[1]+yz*e[2]);o[14]=-(zx*e[0]+zy*e[1]+zz*e[2]);return o}

const positions=[];for(let z=-1;z<=1;z++)for(let x=-1;x<=1;x++)positions.push([x*3.1,.02,z*3.1,(x-z)*.18]);
const lightPos=new Float32Array(64*3),lightCol=new Float32Array(64*3);
for(let i=0;i<64;i++){const a=i*2.399963,r=1.4+(i%9)*.52;lightPos[i*3]=Math.cos(a)*r;lightPos[i*3+1]=.45+(i%6)*.55;lightPos[i*3+2]=Math.sin(a)*r;lightCol[i*3]=.35+.85*((i*37)%100)/100;lightCol[i*3+1]=.35+.85*((i*61)%100)/100;lightCol[i*3+2]=.35+.85*((i*83)%100)/100}

let backpack,diffuseTex,specTex,woodTex,mode=0,lightCount=32,radius=5.2,exposure=1,auto=true,yaw=.65,pitch=.35,drag=false,lastX=0,lastY=0;
const proj=persp(Math.PI/4,canvas.width/canvas.height,.1,60);

function bindTex(unit,t,p,name){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);gl.uniform1i(loc(p,name),unit)}
function drawGeometry(view){
 gl.bindFramebuffer(gl.FRAMEBUFFER,gFbo);gl.viewport(0,0,canvas.width,canvas.height);gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(gp);gl.uniformMatrix4fv(loc(gp,'uView'),false,view);gl.uniformMatrix4fv(loc(gp,'uProj'),false,proj);
 bindTex(0,diffuseTex,gp,'uDiffuse');bindTex(1,specTex,gp,'uSpecular');gl.uniform1i(loc(gp,'uUseTex'),1);gl.bindVertexArray(backpack.vao);
 for(const p of positions){gl.uniformMatrix4fv(loc(gp,'uModel'),false,model(p[0],p[1],p[2],.48,p[3]));gl.drawArrays(gl.TRIANGLES,0,backpack.count)}
 bindTex(0,woodTex,gp,'uDiffuse');gl.uniform1i(loc(gp,'uUseTex'),1);gl.bindTexture(gl.TEXTURE_2D,woodTex);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,woodTex);gl.uniform1f(loc(gp,'uSpec'),.15);gl.bindVertexArray(plane.vao);gl.uniformMatrix4fv(loc(gp,'uModel'),false,T(0,-1.25,0));gl.drawArrays(gl.TRIANGLES,0,plane.count);
}

function drawLighting(eye,view){
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.disable(gl.DEPTH_TEST);gl.clearColor(.004,.007,.012,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(lp);bindTex(0,gPos,lp,'gPosition');bindTex(1,gNorm,lp,'gNormal');bindTex(2,gAlb,lp,'gAlbedoSpec');gl.uniform1i(loc(lp,'uMode'),mode);gl.uniform1i(loc(lp,'uLightCount'),lightCount);gl.uniform3fv(loc(lp,'uLightPos[0]'),lightPos);gl.uniform3fv(loc(lp,'uLightColor[0]'),lightCol);gl.uniform3fv(loc(lp,'uViewPos'),new Float32Array(eye));gl.uniform1f(loc(lp,'uRadius'),radius);gl.uniform1f(loc(lp,'uExposure'),exposure);gl.bindVertexArray(qvao);gl.drawArrays(gl.TRIANGLES,0,6);
 if(mode===0){gl.enable(gl.DEPTH_TEST);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,gFbo);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,null);gl.blitFramebuffer(0,0,canvas.width,canvas.height,0,0,canvas.width,canvas.height,gl.DEPTH_BUFFER_BIT,gl.NEAREST);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.useProgram(ep);gl.uniformMatrix4fv(loc(ep,'uView'),false,view);gl.uniformMatrix4fv(loc(ep,'uProj'),false,proj);gl.bindVertexArray(sphere.vao);for(let i=0;i<lightCount;i++){gl.uniformMatrix4fv(loc(ep,'uModel'),false,model(lightPos[i*3],lightPos[i*3+1],lightPos[i*3+2],.075));gl.uniform3f(loc(ep,'uColor'),lightCol[i*3],lightCol[i*3+1],lightCol[i*3+2]);gl.drawArrays(gl.TRIANGLES,0,sphere.count)}}
}

function frame(t){
 if(auto&&!drag)yaw+=.00018*16.67;
 const dist=12.8,eye=[Math.cos(yaw)*Math.cos(pitch)*dist,3.6+Math.sin(pitch)*4.0,Math.sin(yaw)*Math.cos(pitch)*dist],view=look(eye,[0,-.2,0],[0,1,0]);
 drawGeometry(view);drawLighting(eye,view);requestAnimationFrame(frame)
}

canvas.addEventListener('pointerdown',e=>{drag=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw+=(e.clientX-lastX)*.007;pitch=Math.max(-.25,Math.min(.8,pitch+(e.clientY-lastY)*.005));lastX=e.clientX;lastY=e.clientY});
canvas.addEventListener('pointerup',()=>drag=false);canvas.addEventListener('pointercancel',()=>drag=false);

document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));btn.classList.add('active');mode={final:0,position:1,normal:2,albedo:3,specular:4,gbuffer:5}[btn.dataset.mode];document.getElementById('hud').textContent=mode===0?'Geometry Pass → G-Buffer → Lighting Pass':mode===5?'同一帧 G-Buffer：Position / Normal / Albedo / Specular':'G-Buffer Debug View';}));
document.getElementById('lights').addEventListener('input',e=>{lightCount=+e.target.value;document.getElementById('lightsVal').textContent=String(lightCount)});
document.getElementById('radius').addEventListener('input',e=>{radius=+e.target.value;document.getElementById('radiusVal').textContent=radius.toFixed(1)});
document.getElementById('exposure').addEventListener('input',e=>{exposure=+e.target.value;document.getElementById('exposureVal').textContent=exposure.toFixed(2)});
document.getElementById('autoRotate').addEventListener('click',e=>{auto=!auto;e.currentTarget.classList.toggle('active',auto);e.currentTarget.textContent=auto?'Auto rotate':'Auto rotate off'});
document.getElementById('resetView').addEventListener('click',()=>{yaw=.65;pitch=.35});

(async()=>{
 try{
  const [objText,diff,spec,wood]=await Promise.all([fetch(ROOT+'backpack.obj').then(r=>r.text()),loadImg(ROOT+'diffuse.jpg'),loadImg(ROOT+'specular.jpg'),loadImg(WOOD)]);
  backpack=createMesh(parseOBJ(objText));diffuseTex=texFromImg(diff,true);specTex=texFromImg(spec,false);woodTex=texFromImg(wood,true);loading.hidden=true;requestAnimationFrame(frame);
 }catch(err){console.error(err);loading.textContent='资产加载失败。请刷新页面或检查网络连接。'}
})();
})();
(() => {
'use strict';
const canvas=document.getElementById('glcanvas');
const gl=canvas.getContext('webgl2',{antialias:true,alpha:false});
const $=id=>document.getElementById(id);
const ui={badge:$('modeBadge'),material:$('material'),geometry:$('geometry'),ior:$('ior'),iorText:$('iorText'),removeTranslation:$('removeTranslation'),optimized:$('optimized'),dx:$('dx'),dy:$('dy'),dz:$('dz'),dxText:$('dxText'),dyText:$('dyText'),dzText:$('dzText'),directionInfo:$('directionInfo'),sampleFace:$('sampleFace'),skyMode:$('skyMode'),materialStat:$('materialStat'),reset:$('reset'),code:$('code')};
if(!gl){ui.badge.textContent='● WebGL2 unavailable';ui.badge.className='badge bad';return;}

const VS_OBJ=`#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNormal;
uniform mat4 uModel; uniform mat4 uView; uniform mat4 uProj;
out vec3 vWorldPos; out vec3 vNormal;
void main(){
  vec4 world=uModel*vec4(aPos,1.0);
  vWorldPos=world.xyz;
  vNormal=mat3(transpose(inverse(uModel)))*aNormal;
  gl_Position=uProj*uView*world;
}`;
const FS_OBJ=`#version 300 es
precision highp float;
in vec3 vWorldPos; in vec3 vNormal;
uniform samplerCube uCube; uniform vec3 uCameraPos; uniform int uMode; uniform float uEta;
out vec4 outColor;
void main(){
  vec3 N=normalize(vNormal);
  if(uMode==2){outColor=vec4(N*0.5+0.5,1.0);return;}
  vec3 I=normalize(vWorldPos-uCameraPos);
  vec3 D=(uMode==1)?refract(I,N,uEta):reflect(I,N);
  vec3 env=texture(uCube,D).rgb;
  outColor=vec4(env,1.0);
}`;
const VS_SKY=`#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uView; uniform mat4 uProj; uniform bool uForceFar;
out vec3 vDir;
void main(){
  vDir=aPos;
  vec4 pos=uProj*uView*vec4(aPos,1.0);
  gl_Position=uForceFar?pos.xyww:pos;
}`;
const FS_SKY=`#version 300 es
precision highp float;
in vec3 vDir; uniform samplerCube uSky; out vec4 outColor;
void main(){outColor=texture(uSky,vDir);}`;
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
function program(v,f){const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,v));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}
let objProg,skyProg;try{objProg=program(VS_OBJ,FS_OBJ);skyProg=program(VS_SKY,FS_SKY);}catch(e){ui.badge.textContent='● Shader error';ui.badge.className='badge bad';ui.code.textContent=e.message;return;}

function vaoPN(data){const vao=gl.createVertexArray(),buf=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);gl.bindVertexArray(null);return {vao,count:data.length/6};}
function vaoP(data){const vao=gl.createVertexArray(),buf=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,12,0);gl.bindVertexArray(null);return {vao,count:data.length/3};}
const cubePN=new Float32Array([
-1,-1,-1,0,0,-1, 1,1,-1,0,0,-1, 1,-1,-1,0,0,-1, -1,-1,-1,0,0,-1, -1,1,-1,0,0,-1, 1,1,-1,0,0,-1,
-1,-1,1,0,0,1, 1,-1,1,0,0,1, 1,1,1,0,0,1, -1,-1,1,0,0,1, 1,1,1,0,0,1, -1,1,1,0,0,1,
-1,1,1,-1,0,0, -1,1,-1,-1,0,0, -1,-1,-1,-1,0,0, -1,1,1,-1,0,0, -1,-1,-1,-1,0,0, -1,-1,1,-1,0,0,
1,1,1,1,0,0, 1,-1,-1,1,0,0, 1,1,-1,1,0,0, 1,1,1,1,0,0, 1,-1,1,1,0,0, 1,-1,-1,1,0,0,
-1,-1,-1,0,-1,0, 1,-1,-1,0,-1,0, 1,-1,1,0,-1,0, -1,-1,-1,0,-1,0, 1,-1,1,0,-1,0, -1,-1,1,0,-1,0,
-1,1,-1,0,1,0, 1,1,1,0,1,0, 1,1,-1,0,1,0, -1,1,-1,0,1,0, -1,1,1,0,1,0, 1,1,1,0,1,0]);
const skyP=new Float32Array([
-1,-1,-1, 1,-1,-1, 1,1,-1, 1,1,-1,-1,1,-1,-1,-1,-1,
-1,-1,1, 1,1,1, 1,-1,1, 1,1,1,-1,-1,1,-1,1,1,
-1,1,1,-1,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,-1,1,1,
1,1,1,1,-1,-1,1,1,-1,1,-1,-1,1,1,1,1,-1,1,
-1,-1,-1,1,-1,-1,1,-1,1,1,-1,1,-1,-1,1,-1,-1,-1,
-1,1,-1,1,1,1,1,1,-1,1,1,1,-1,1,-1,-1,1,1]);
function makeSphere(seg=48,rings=24){const a=[];for(let y=0;y<rings;y++){const v0=y/rings,v1=(y+1)/rings,th0=v0*Math.PI,th1=v1*Math.PI;for(let x=0;x<seg;x++){const u0=x/seg,u1=(x+1)/seg,ph0=u0*Math.PI*2,ph1=u1*Math.PI*2;const p=(th,ph)=>[Math.sin(th)*Math.cos(ph),Math.cos(th),Math.sin(th)*Math.sin(ph)];const p00=p(th0,ph0),p10=p(th0,ph1),p01=p(th1,ph0),p11=p(th1,ph1);for(const q of [p00,p01,p11,p00,p11,p10])a.push(...q,...q);}}return new Float32Array(a);}
const cube=vaoPN(cubePN),sphere=vaoPN(makeSphere()),sky=vaoP(skyP);

function mat4(){return new Float32Array(16)}function ident(){const m=mat4();m[0]=m[5]=m[10]=m[15]=1;return m;}function perspective(fov,asp,n,f){const m=mat4(),t=1/Math.tan(fov/2);m[0]=t/asp;m[5]=t;m[10]=(f+n)/(n-f);m[11]=-1;m[14]=2*f*n/(n-f);return m;}function norm(v){const l=Math.hypot(...v)||1;return v.map(x=>x/l)}function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}function lookAt(e,c,u){const z=norm([e[0]-c[0],e[1]-c[1],e[2]-c[2]]),x=norm(cross(u,z)),y=cross(z,x),m=ident();m[0]=x[0];m[1]=y[0];m[2]=z[0];m[4]=x[1];m[5]=y[1];m[6]=z[1];m[8]=x[2];m[9]=y[2];m[10]=z[2];m[12]=-(x[0]*e[0]+x[1]*e[1]+x[2]*e[2]);m[13]=-(y[0]*e[0]+y[1]*e[1]+y[2]*e[2]);m[14]=-(z[0]*e[0]+z[1]*e[1]+z[2]*e[2]);return m;}function removeTranslation(m){const r=new Float32Array(m);r[12]=r[13]=r[14]=0;return r;}function scaleM(s){const m=ident();m[0]=m[5]=m[10]=s;return m;}
function uni(p,n){return gl.getUniformLocation(p,n)}function setM(p,n,m){gl.uniformMatrix4fv(uni(p,n),false,m)}

const cubemap=gl.createTexture();gl.bindTexture(gl.TEXTURE_CUBE_MAP,cubemap);const targets=[gl.TEXTURE_CUBE_MAP_POSITIVE_X,gl.TEXTURE_CUBE_MAP_NEGATIVE_X,gl.TEXTURE_CUBE_MAP_POSITIVE_Y,gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,gl.TEXTURE_CUBE_MAP_POSITIVE_Z,gl.TEXTURE_CUBE_MAP_NEGATIVE_Z];
function fallbackCanvas(label,color){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,256,256);x.fillStyle='rgba(255,255,255,.85)';x.font='bold 34px system-ui';x.textAlign='center';x.fillText(label,128,122);x.font='18px system-ui';x.fillText('fallback cubemap',128,154);return c;}
const fall=[['+X','#7a3e3e'],['-X','#3e627a'],['+Y','#567a3e'],['-Y','#7a6b3e'],['+Z','#5a3e7a'],['-Z','#3e7a72']];
for(let i=0;i<6;i++){gl.texImage2D(targets[i],0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,fallbackCanvas(...fall[i]));}
gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_WRAP_R,gl.CLAMP_TO_EDGE);
const files=['right.jpg','left.jpg','top.jpg','bottom.jpg','front.jpg','back.jpg'];
function loadFace(name){return new Promise(resolve=>{const img=new Image();img.crossOrigin='anonymous';img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=`https://raw.githubusercontent.com/JoeyDeVries/LearnOpenGL/master/resources/textures/skybox/${name}`;});}
ui.badge.textContent='● loading official skybox 0/6';ui.badge.className='badge';
Promise.all(files.map(loadFace)).then(images=>{
  if(images.every(Boolean)){
    gl.bindTexture(gl.TEXTURE_CUBE_MAP,cubemap);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
    images.forEach((img,i)=>gl.texImage2D(targets[i],0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img));
    ui.badge.textContent='● WebGL2 · official skybox loaded';ui.badge.className='badge ok';
  }else{
    const failed=images.filter(x=>!x).length;
    ui.badge.textContent=`● official skybox unavailable (${failed}/6) · using fallback`;ui.badge.className='badge warn';
  }
});

gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
let yaw=-35,pitch=12,dist=3.3,drag=false,lx=0,ly=0;
canvas.addEventListener('pointerdown',e=>{drag=true;lx=e.clientX;ly=e.clientY;canvas.setPointerCapture(e.pointerId)});canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw+=(e.clientX-lx)*0.35;pitch=Math.max(-80,Math.min(80,pitch-(e.clientY-ly)*0.3));lx=e.clientX;ly=e.clientY;});canvas.addEventListener('pointerup',()=>drag=false);canvas.addEventListener('wheel',e=>{e.preventDefault();dist=Math.max(1.7,Math.min(6,dist+e.deltaY*0.003));},{passive:false});
function resize(){const dpr=Math.min(devicePixelRatio||1,2),w=Math.max(2,Math.floor(canvas.clientWidth*dpr)),h=Math.max(2,Math.floor(canvas.clientHeight*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}}
function camera(){const yr=yaw*Math.PI/180,pr=pitch*Math.PI/180;return [dist*Math.cos(pr)*Math.cos(yr),dist*Math.sin(pr),dist*Math.cos(pr)*Math.sin(yr)];}
function drawObject(view,proj,cam){if(ui.material.value==='none')return;gl.useProgram(objProg);setM(objProg,'uModel',scaleM(ui.geometry.value==='cube'?0.72:0.85));setM(objProg,'uView',view);setM(objProg,'uProj',proj);gl.uniform3fv(uni(objProg,'uCameraPos'),cam);const mode=ui.material.value==='refract'?1:ui.material.value==='normal'?2:0;gl.uniform1i(uni(objProg,'uMode'),mode);gl.uniform1f(uni(objProg,'uEta'),1/parseFloat(ui.ior.value));gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_CUBE_MAP,cubemap);gl.uniform1i(uni(objProg,'uCube'),0);const g=ui.geometry.value==='cube'?cube:sphere;gl.bindVertexArray(g.vao);gl.drawArrays(gl.TRIANGLES,0,g.count);gl.bindVertexArray(null);}
function drawSky(view,proj,forceFar){gl.useProgram(skyProg);setM(skyProg,'uView',view);setM(skyProg,'uProj',proj);gl.uniform1i(uni(skyProg,'uForceFar'),forceFar?1:0);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_CUBE_MAP,cubemap);gl.uniform1i(uni(skyProg,'uSky'),0);gl.bindVertexArray(sky.vao);gl.cullFace(gl.FRONT);gl.drawArrays(gl.TRIANGLES,0,sky.count);gl.cullFace(gl.BACK);gl.bindVertexArray(null);}
function render(){resize();gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.04,.055,.075,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);const cam=camera(),view=lookAt(cam,[0,0,0],[0,1,0]),skyView=ui.removeTranslation.checked?removeTranslation(view):view,proj=perspective(55*Math.PI/180,canvas.width/canvas.height,.1,100);
  if(ui.optimized.checked){drawObject(view,proj,cam);gl.depthFunc(gl.LEQUAL);gl.depthMask(false);drawSky(skyView,proj,true);gl.depthMask(true);gl.depthFunc(gl.LESS);}else{gl.depthMask(false);gl.depthFunc(gl.LEQUAL);drawSky(skyView,proj,false);gl.depthMask(true);gl.depthFunc(gl.LESS);drawObject(view,proj,cam);}
  requestAnimationFrame(render);
}
function hitFace(x,y,z){const ax=Math.abs(x),ay=Math.abs(y),az=Math.abs(z);if(ax===0&&ay===0&&az===0)return {face:'—',file:'direction = zero'};if(ax>=ay&&ax>=az)return x>=0?{face:'+X',file:'right.jpg'}:{face:'-X',file:'left.jpg'};if(ay>=ax&&ay>=az)return y>=0?{face:'+Y',file:'top.jpg'}:{face:'-Y',file:'bottom.jpg'};return z>=0?{face:'+Z',file:'front.jpg'}:{face:'-Z',file:'back.jpg'};}
function updateUI(){ui.iorText.textContent=(+ui.ior.value).toFixed(2);ui.dxText.textContent=(+ui.dx.value).toFixed(2);ui.dyText.textContent=(+ui.dy.value).toFixed(2);ui.dzText.textContent=(+ui.dz.value).toFixed(2);const x=+ui.dx.value,y=+ui.dy.value,z=+ui.dz.value,h=hitFace(x,y,z),len=Math.hypot(x,y,z);ui.sampleFace.textContent=h.face;ui.skyMode.textContent=ui.optimized.checked?'LAST · far depth':'FIRST · depth write off';ui.materialStat.textContent=ui.material.options[ui.material.selectedIndex].text.split(' · ')[0];ui.directionInfo.innerHTML=`direction = (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})<br>length = ${len.toFixed(2)} <span style="color:#8b949e">(长度不决定 face)</span><br>dominant axis → <strong>${h.face}</strong> → ${h.file}`;document.querySelectorAll('.facepill').forEach(el=>el.classList.toggle('hit',el.dataset.face===h.face));ui.ior.disabled=ui.material.value!=='refract';updateCode();}
function updateCode(){const mode=ui.material.value;let frag=mode==='refract'?`vec3 I = normalize(Position - cameraPos);\nvec3 R = refract(I, normalize(Normal), 1.0 / ${(+ui.ior.value).toFixed(2)});\nFragColor = texture(skybox, R);`:mode==='reflect'?`vec3 I = normalize(Position - cameraPos);\nvec3 R = reflect(I, normalize(Normal));\nFragColor = texture(skybox, R);`:`// skybox sampling\nFragColor = texture(skybox, direction);`;
ui.code.textContent=`// Cubemap texture\nglBindTexture(GL_TEXTURE_CUBE_MAP, cubemap);\nfor (int i = 0; i < 6; ++i)\n    glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, ...);\n\n// samplerCube uses a vec3 direction\nuniform samplerCube skybox;\n${frag}\n\n// Skybox\nview = ${ui.removeTranslation.checked?'mat4(mat3(camera.GetViewMatrix()))':'camera.GetViewMatrix() // translation kept (demo)'};\n${ui.optimized.checked?'glDepthFunc(GL_LEQUAL);\n// vertex shader: gl_Position = pos.xyww;\nDrawSkyboxLast();\nglDepthFunc(GL_LESS);':'glDepthMask(GL_FALSE);\nDrawSkyboxFirst();\nglDepthMask(GL_TRUE);'}`;}
['input','change'].forEach(ev=>{[ui.material,ui.geometry,ui.ior,ui.removeTranslation,ui.optimized,ui.dx,ui.dy,ui.dz].forEach(el=>el.addEventListener(ev,updateUI));});ui.reset.addEventListener('click',()=>{ui.material.value='reflect';ui.geometry.value='sphere';ui.ior.value='1.52';ui.removeTranslation.checked=true;ui.optimized.checked=true;ui.dx.value='0.8';ui.dy.value='0.3';ui.dz.value='-0.2';yaw=-35;pitch=12;dist=3.3;updateUI();});
updateUI();render();
})();

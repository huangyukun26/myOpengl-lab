import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const canvas=document.getElementById('gl');
const loading=document.getElementById('loading');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(1);renderer.setSize(canvas.width,canvas.height,false);
renderer.outputColorSpace=THREE.LinearSRGBColorSpace;renderer.info.autoReset=false;

const MAX_LIGHTS=128,targetW=640,targetH=656;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x050912);
const camera=new THREE.PerspectiveCamera(48,targetW/targetH,.1,80);
const quadCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);

const lightPos=Array.from({length:MAX_LIGHTS},()=>new THREE.Vector3());
const lightColor=Array.from({length:MAX_LIGHTS},()=>new THREE.Vector3());
for(let i=0;i<MAX_LIGHTS;i++){
  const a=i*2.3999632297,ring=2.4+(i%11)*.52;
  lightPos[i].set(Math.cos(a)*ring,.65+(i%6)*.58,Math.sin(a)*ring);
  lightColor[i].set(.45+.9*((i*37)%100)/100,.45+.9*((i*61)%100)/100,.45+.9*((i*83)%100)/100);
}

let lightCount=32,objectCount=16,radius=4.8,overdraw=2.2,useVolumes=true,rotateCamera=true,viewMode=0;
let yaw=.72,pitch=.30,drag=false,lastX=0,lastY=0,fpsSmooth=60,lastFrame=performance.now();
const people=[],envMeshes=[];

const forwardRT=new THREE.WebGLRenderTarget(targetW,targetH,{type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true,stencilBuffer:false});
const deferredRT=new THREE.WebGLRenderTarget(targetW,targetH,{type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false,stencilBuffer:false});
const gBuffer=new THREE.WebGLRenderTarget(targetW,targetH,{count:3,type:THREE.HalfFloatType,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:true,stencilBuffer:false});
forwardRT.texture.colorSpace=THREE.LinearSRGBColorSpace;deferredRT.texture.colorSpace=THREE.LinearSRGBColorSpace;
for(const t of gBuffer.textures)t.colorSpace=THREE.LinearSRGBColorSpace;

const common={
  uLightCount:{value:lightCount},uLightPos:{value:lightPos},uLightColor:{value:lightColor},
  uRadius:{value:radius},uViewPos:{value:camera.position},uExposure:{value:1.05}
};

const forwardVS=[
'varying vec3 vWorldPos;varying vec3 vWorldNormal;varying vec2 vUv;',
'void main(){vec4 w=modelMatrix*vec4(position,1.0);vWorldPos=w.xyz;vWorldNormal=normalize(mat3(modelMatrix)*normal);vUv=uv;gl_Position=projectionMatrix*viewMatrix*w;}'
].join('\n');

const forwardFS=[
'precision highp float;','#define MAX_LIGHTS 128',
'varying vec3 vWorldPos;varying vec3 vWorldNormal;varying vec2 vUv;',
'uniform sampler2D uMap;uniform bool uUseMap;uniform vec3 uBaseColor;uniform float uSpecular;uniform float uFloor;',
'uniform int uLightCount;uniform vec3 uLightPos[MAX_LIGHTS];uniform vec3 uLightColor[MAX_LIGHTS];uniform float uRadius;uniform vec3 uViewPos;uniform float uExposure;',
'vec3 baseColor(){vec3 c=uUseMap?texture2D(uMap,vUv).rgb:uBaseColor;if(uFloor>.5){float gx=step(.965,fract(abs(vWorldPos.x)*.5));float gz=step(.965,fract(abs(vWorldPos.z)*.5));c*=1.0+.22*max(gx,gz);}return c;}',
'void main(){vec3 albedo=baseColor();vec3 N=normalize(vWorldNormal);vec3 V=normalize(uViewPos-vWorldPos);vec3 outc=albedo*.035;',
'for(int i=0;i<MAX_LIGHTS;i++){if(i>=uLightCount)break;vec3 d=uLightPos[i]-vWorldPos;float dist=length(d);if(dist<uRadius){vec3 L=d/max(dist,.001);float att=1.0/(1.0+.16*dist+.20*dist*dist);float ndl=max(dot(N,L),0.0);vec3 H=normalize(L+V);float sp=pow(max(dot(N,H),0.0),28.0)*uSpecular;outc+=(albedo*ndl+vec3(sp))*uLightColor[i]*att*2.25;}}',
'outc=vec3(1.0)-exp(-outc*uExposure);outc=pow(max(outc,vec3(0.0)),vec3(1.0/2.2));gl_FragColor=vec4(outc,1.0);}'
].join('\n');

const gVS=[
'out vec3 vWorldPos;out vec3 vWorldNormal;out vec2 vUv;',
'void main(){vec4 w=modelMatrix*vec4(position,1.0);vWorldPos=w.xyz;vWorldNormal=normalize(mat3(modelMatrix)*normal);vUv=uv;gl_Position=projectionMatrix*viewMatrix*w;}'
].join('\n');

const gFS=[
'precision highp float;','in vec3 vWorldPos;in vec3 vWorldNormal;in vec2 vUv;',
'uniform sampler2D uMap;uniform bool uUseMap;uniform vec3 uBaseColor;uniform float uSpecular;uniform float uFloor;',
'layout(location=0) out vec4 gPosition;layout(location=1) out vec4 gNormal;layout(location=2) out vec4 gAlbedoSpec;',
'void main(){vec3 c=uUseMap?texture(uMap,vUv).rgb:uBaseColor;if(uFloor>.5){float gx=step(.965,fract(abs(vWorldPos.x)*.5));float gz=step(.965,fract(abs(vWorldPos.z)*.5));c*=1.0+.22*max(gx,gz);}gPosition=vec4(vWorldPos,1.0);gNormal=vec4(normalize(vWorldNormal),1.0);gAlbedoSpec=vec4(c,uSpecular);}'
].join('\n');

function makeForwardMat(o={}){
  return new THREE.ShaderMaterial({vertexShader:forwardVS,fragmentShader:forwardFS,uniforms:{...common,uMap:{value:o.map||null},uUseMap:{value:!!o.map},uBaseColor:{value:new THREE.Color(o.color??0xffffff)},uSpecular:{value:o.spec??.35},uFloor:{value:o.floor??0}}});
}
function makeGMat(o={}){
  return new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:gVS,fragmentShader:gFS,uniforms:{uMap:{value:o.map||null},uUseMap:{value:!!o.map},uBaseColor:{value:new THREE.Color(o.color??0xffffff)},uSpecular:{value:o.spec??.35},uFloor:{value:o.floor??0}}});
}

const lightingMat=new THREE.ShaderMaterial({
  glslVersion:THREE.GLSL3,
  uniforms:{gPosition:{value:gBuffer.textures[0]},gNormal:{value:gBuffer.textures[1]},gAlbedoSpec:{value:gBuffer.textures[2]},...common},
  vertexShader:['out vec2 vUv;','void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.0,1.0);}'].join('\n'),
  fragmentShader:[
'precision highp float;','#define MAX_LIGHTS 128','in vec2 vUv;out vec4 outColor;',
'uniform sampler2D gPosition,gNormal,gAlbedoSpec;uniform int uLightCount;uniform vec3 uLightPos[MAX_LIGHTS];uniform vec3 uLightColor[MAX_LIGHTS];uniform float uRadius;uniform vec3 uViewPos;uniform float uExposure;',
'void main(){vec4 A=texture(gAlbedoSpec,vUv);if(A.a==0.0&&dot(A.rgb,A.rgb)<.00001){outColor=vec4(.005,.008,.014,1.0);return;}vec3 P=texture(gPosition,vUv).xyz;vec3 N=normalize(texture(gNormal,vUv).xyz);vec3 V=normalize(uViewPos-P);vec3 c=A.rgb*.035;',
'for(int i=0;i<MAX_LIGHTS;i++){if(i>=uLightCount)break;vec3 d=uLightPos[i]-P;float dist=length(d);if(dist<uRadius){vec3 L=d/max(dist,.001);float att=1.0/(1.0+.16*dist+.20*dist*dist);float ndl=max(dot(N,L),0.0);vec3 H=normalize(L+V);float sp=pow(max(dot(N,H),0.0),28.0)*A.a;c+=(A.rgb*ndl+vec3(sp))*uLightColor[i]*att*2.25;}}',
'c=vec3(1.0)-exp(-c*uExposure);c=pow(max(c,vec3(0.0)),vec3(1.0/2.2));outColor=vec4(c,1.0);}'
].join('\n')
});
const lightingScene=new THREE.Scene();lightingScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),lightingMat));

const composeMat=new THREE.ShaderMaterial({
  glslVersion:THREE.GLSL3,
  uniforms:{uForward:{value:forwardRT.texture},uDeferred:{value:deferredRT.texture},gPosition:{value:gBuffer.textures[0]},gNormal:{value:gBuffer.textures[1]},gAlbedoSpec:{value:gBuffer.textures[2]},uMode:{value:0}},
  vertexShader:['out vec2 vUv;','void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.0,1.0);}'].join('\n'),
  fragmentShader:[
'precision highp float;in vec2 vUv;out vec4 outColor;uniform sampler2D uForward,uDeferred,gPosition,gNormal,gAlbedoSpec;uniform int uMode;',
'vec3 pv(vec2 q){return clamp(texture(gPosition,q).xyz*.055+.5,0.0,1.0);}vec3 nv(vec2 q){return texture(gNormal,q).xyz*.5+.5;}',
'void main(){if(uMode==0){if(vUv.x<.5)outColor=texture(uForward,vec2(vUv.x*2.0,vUv.y));else outColor=texture(uDeferred,vec2((vUv.x-.5)*2.0,vUv.y));return;}',
'if(uMode==1){outColor=texture(uForward,vUv);return;}if(uMode==2){outColor=texture(uDeferred,vUv);return;}',
'vec2 q=fract(vUv*2.0);bool top=vUv.y>.5;bool left=vUv.x<.5;vec3 c;if(top&&left)c=pv(q);else if(top)c=nv(q);else if(left)c=texture(gAlbedoSpec,q).rgb;else c=vec3(texture(gAlbedoSpec,q).a);',
'float line=max(1.0-smoothstep(0.0,.008,abs(vUv.x-.5)),1.0-smoothstep(0.0,.008,abs(vUv.y-.5)));c=mix(c,vec3(.03),line*.8);outColor=vec4(c,1.0);}'
].join('\n')
});
const composeScene=new THREE.Scene();composeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),composeMat));

function addMesh(geometry,o,fn){
  const m=new THREE.Mesh(geometry,makeForwardMat(o));m.userData.forwardMat=m.material;m.userData.gMat=makeGMat(o);if(fn)fn(m);scene.add(m);envMeshes.push(m);return m;
}
function buildEnvironment(){
  addMesh(new THREE.PlaneGeometry(30,30),{color:0x121922,spec:.55,floor:1},m=>{m.rotation.x=-Math.PI/2;m.position.y=-1.25;});
  addMesh(new THREE.BoxGeometry(15,.5,4),{color:0x151e2a,spec:.45},m=>m.position.set(0,-.95,-7.3));
  addMesh(new THREE.BoxGeometry(15,.5,4),{color:0x101923,spec:.45},m=>m.position.set(0,-.95,7.3));
  for(let i=-3;i<=3;i++){
    addMesh(new THREE.BoxGeometry(1.1,5.5,1.1),{color:i%2?0x26384c:0x1b2735,spec:.7},m=>m.position.set(i*2,1.35,-6.1));
    addMesh(new THREE.BoxGeometry(1.1,4.2,1.1),{color:i%2?0x1d2b3c:0x2a3544,spec:.6},m=>m.position.set(i*2,.7,6.1));
  }
  for(let i=-2;i<=2;i++)addMesh(new THREE.BoxGeometry(1.8,.28,.55),{color:0x202b38,spec:.5},m=>m.position.set(i*2.8,-.45,-1));
  addMesh(new THREE.BoxGeometry(.22,5,.22),{color:0x33455e,spec:.75},m=>m.position.set(-5.2,1.3,0));
  addMesh(new THREE.BoxGeometry(.22,5,.22),{color:0x33455e,spec:.75},m=>m.position.set(5.2,1.3,0));
}

function extractStaticGeometry(root){
  let chosen=null;root.updateMatrixWorld(true);root.traverse(o=>{if(!chosen&&(o.isMesh||o.isSkinnedMesh)&&o.geometry)chosen=o;});
  if(!chosen)throw new Error('No mesh in CesiumMan');
  const g=chosen.geometry.clone();g.applyMatrix4(chosen.matrixWorld);if(!g.attributes.normal)g.computeVertexNormals();
  g.computeBoundingBox();const s=new THREE.Vector3();g.boundingBox.getSize(s);const k=2.15/Math.max(s.y,.001);g.scale(k,k,k);g.computeBoundingBox();
  const c=new THREE.Vector3();g.boundingBox.getCenter(c);g.translate(-c.x,-g.boundingBox.min.y-1.25,-c.z);
  return {geometry:g,map:chosen.material?.map||null};
}
function makePeople(g,map){
  const pos=[];for(let r=0;r<5;r++)for(let c=0;c<8;c++)pos.push([(c-3.5)*1.65,-1.25,(r-2)*2.15]);
  pos.forEach((p,i)=>{const m=new THREE.Mesh(g,makeForwardMat({map,color:0x8997a8,spec:.58}));m.userData.forwardMat=m.material;m.userData.gMat=makeGMat({map,color:0x8997a8,spec:.58});m.position.set(...p);m.rotation.y=(i%4)*.45+(i%2?Math.PI:0);scene.add(m);people.push(m);});
  updatePeopleVisibility();
}
function updatePeopleVisibility(){people.forEach((m,i)=>m.visible=i<objectCount);}
function setPass(k){scene.traverse(o=>{if(o.isMesh&&o.userData.forwardMat)o.material=k==='forward'?o.userData.forwardMat:o.userData.gMat;});}

function updateCamera(dt){
  if(rotateCamera&&!drag)yaw+=.00011*Math.min(40,dt);
  const d=15.8;camera.position.set(Math.cos(yaw)*Math.cos(pitch)*d,3.3+Math.sin(pitch)*5,Math.sin(yaw)*Math.cos(pitch)*d);camera.lookAt(0,.15,0);common.uViewPos.value.copy(camera.position);
}
function renderForward(){
  setPass('forward');common.uLightCount.value=lightCount;common.uRadius.value=radius;renderer.setRenderTarget(forwardRT);renderer.setClearColor(0x03060b,1);renderer.clear();renderer.render(scene,camera);
}
function renderDeferred(){
  setPass('g');renderer.setRenderTarget(gBuffer);renderer.setClearColor(0,1);renderer.clear();renderer.render(scene,camera);
  common.uLightCount.value=lightCount;common.uRadius.value=radius;renderer.setRenderTarget(deferredRT);renderer.setClearColor(0x03060b,1);renderer.clear();renderer.render(lightingScene,quadCam);
}
function renderCompose(){composeMat.uniforms.uMode.value=viewMode;renderer.setRenderTarget(null);renderer.setViewport(0,0,canvas.width,canvas.height);renderer.setClearColor(0x03060b,1);renderer.clear();renderer.render(composeScene,quadCam);}

function fmt(n){if(n>=1e9)return(n/1e9).toFixed(2)+'B';if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=1e3)return(n/1e3).toFixed(1)+'K';return Math.round(n).toString();}
function updateMetrics(){
  const px=targetW*targetH,coverage=Math.min(.88,.35+objectCount/80),vis=px*coverage,fw=vis*overdraw*lightCount,factor=useVolumes?Math.min(1,.12+Math.pow(radius/8,2)*.55):1,df=vis*lightCount*factor;
  const fwDraw=envMeshes.length+objectCount,dfDraw=fwDraw+1,gMB=(targetW*targetH*(8+8+8+4))/(1024*1024),max=Math.max(fw,df,1);
  document.getElementById('fwWork').textContent=fmt(fw);document.getElementById('dfWork').textContent=fmt(df);document.getElementById('gmem').textContent=gMB.toFixed(1)+' MB';
  document.getElementById('fwEval').textContent=fmt(fw);document.getElementById('dfEval').textContent=fmt(df);document.getElementById('fwDraw').textContent=fwDraw;document.getElementById('dfDraw').textContent=dfDraw;
  document.getElementById('fwOver').textContent=overdraw.toFixed(1)+'×';document.getElementById('memShort').textContent=gMB.toFixed(1)+' MB';
  document.getElementById('fwEvalBar').style.width=(6+88*fw/max)+'%';document.getElementById('dfEvalBar').style.width=(6+88*df/max)+'%';
  document.getElementById('fwDrawBar').style.width=Math.min(95,10+fwDraw*1.5)+'%';document.getElementById('dfDrawBar').style.width=Math.min(95,10+dfDraw*1.5)+'%';
  document.getElementById('fwOverBar').style.width=Math.min(95,overdraw/4*92)+'%';document.getElementById('memBar').style.width=Math.min(95,gMB/32*92)+'%';
  const ratio=fw/Math.max(df,1),v=document.getElementById('verdict');
  v.textContent=ratio<1.15?'当前参数：Forward 没有明显劣势；少灯/简单场景时 G-Buffer 成本可能不划算。':ratio<2.5?'当前参数：Deferred 开始占优；Forward 的重复光照随遮挡和灯数增大。':'当前参数：Deferred 优势明显；Forward 正在对被覆盖 Fragment 重复遍历大量灯。';
}
function frame(now){
  const dt=Math.max(1,now-lastFrame);lastFrame=now;fpsSmooth=fpsSmooth*.92+(1000/dt)*.08;document.getElementById('fps').textContent=fpsSmooth.toFixed(0);updateCamera(dt);
  if(viewMode===1)renderForward();else if(viewMode===2||viewMode===3)renderDeferred();else{renderForward();renderDeferred();}
  renderCompose();renderer.info.reset();requestAnimationFrame(frame);
}

canvas.addEventListener('pointerdown',e=>{drag=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw+=(e.clientX-lastX)*.006;pitch=Math.max(-.15,Math.min(.72,pitch+(e.clientY-lastY)*.004));lastX=e.clientX;lastY=e.clientY;});
canvas.addEventListener('pointerup',()=>drag=false);canvas.addEventListener('pointercancel',()=>drag=false);
document.querySelectorAll('.view').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));btn.classList.add('active');viewMode={compare:0,forward:1,deferred:2,gbuffer:3}[btn.dataset.view];document.getElementById('labels').style.display=viewMode===0?'grid':'none';}));
document.getElementById('lights').addEventListener('input',e=>{lightCount=+e.target.value;document.getElementById('lightsVal').textContent=lightCount;updateMetrics();});
document.getElementById('objects').addEventListener('input',e=>{objectCount=+e.target.value;document.getElementById('objectsVal').textContent=objectCount;updatePeopleVisibility();updateMetrics();});
document.getElementById('overdraw').addEventListener('input',e=>{overdraw=+e.target.value;document.getElementById('overdrawVal').textContent=overdraw.toFixed(1)+'×';updateMetrics();});
document.getElementById('radius').addEventListener('input',e=>{radius=+e.target.value;document.getElementById('radiusVal').textContent=radius.toFixed(1);updateMetrics();});
document.getElementById('volumes').addEventListener('click',e=>{useVolumes=!useVolumes;e.currentTarget.classList.toggle('active',useVolumes);e.currentTarget.textContent='Light-volume estimate '+(useVolumes?'ON':'OFF');updateMetrics();});
document.getElementById('rotate').addEventListener('click',e=>{rotateCamera=!rotateCamera;e.currentTarget.classList.toggle('active',rotateCamera);e.currentTarget.textContent='Camera rotate '+(rotateCamera?'ON':'OFF');});

(async()=>{
  try{
    buildEnvironment();
    const gltf=await new GLTFLoader().loadAsync('https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CesiumMan/glTF-Binary/CesiumMan.glb');
    const a=extractStaticGeometry(gltf.scene);makePeople(a.geometry,a.map);loading.hidden=true;updateMetrics();requestAnimationFrame(frame);
  }catch(err){console.error(err);loading.textContent='CesiumMan 资产加载失败，请刷新页面或检查网络连接。';}
})();
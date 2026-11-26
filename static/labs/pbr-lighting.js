"use strict";
// PBR Lighting Lab — faithful LearnOpenGL 7x7 sphere grid with four analytic point lights.
// Rendering path: CPU uniforms -> Vertex shader -> World-space varying -> Cook-Torrance FS -> Tone map/Gamma.
// Diagnostics are output modes of the SAME fragment shader; they do not change the scene or invent IBL.
(() => {
const canvas=document.getElementById("scene"), status=document.getElementById("status");
const gl=canvas.getContext("webgl2",{antialias:true,alpha:false,depth:true,preserveDrawingBuffer:false});
if(!gl){status.textContent="需要支持 WebGL2 的浏览器";return;}

const vs = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;

uniform mat4 uViewProjection;
uniform vec3 uOffset;
uniform float uScale;

out vec3 WorldPos;
out vec3 Normal;
void main(){
    // 官方示例每个球仅平移，法线不用额外逆转置矩阵。
    WorldPos = aPos*uScale + uOffset;
    Normal = aNormal;
    gl_Position = uViewProjection * vec4(WorldPos,1.0);
}`;

const fs = `#version 300 es
precision highp float;
in vec3 WorldPos;
in vec3 Normal;
out vec4 FragColor;

uniform vec3 uCamPos;
uniform vec3 uAlbedo;
uniform float uMetallic;
uniform float uRoughness;
uniform float uAO;
uniform vec3 uLightPositions[4];
uniform vec3 uLightColors[4];
uniform float uLightScale;
uniform int uViewMode;
uniform int uLamp;

const float PI=3.14159265359;

// D = 微平面法线分布密度，roughness -> alpha=roughness^2。
float DistributionGGX(vec3 N,vec3 H,float roughness){
    float a=roughness*roughness;
    float a2=a*a;
    float NdotH=max(dot(N,H),0.0);
    float t=NdotH*NdotH*(a2-1.0)+1.0;
    return a2/max(PI*t*t,0.000001);
}
// G1 = 沿某个方向的微平面可见性近似；直接光照采用 k=(r+1)^2/8。
float GeometrySchlickGGX(float NdotX,float roughness){
    float r=roughness+1.0;
    float k=r*r/8.0;
    return NdotX/max(NdotX*(1.0-k)+k,0.000001);
}
// G = 从相机可见(Masking) * 能被光照到(Shadowing)。
float GeometrySmith(vec3 N,vec3 V,vec3 L,float roughness){
    return GeometrySchlickGGX(max(dot(N,V),0.0),roughness)
         * GeometrySchlickGGX(max(dot(N,L),0.0),roughness);
}
// F = 微面界面反射份额；正入射返回 F0，掠射方向趋近 1。
vec3 FresnelSchlick(float cosTheta,vec3 F0){
    return F0+(vec3(1.0)-F0)*pow(clamp(1.0-cosTheta,0.0,1.0),5.0);
}

void main(){
    if(uLamp==1){
        FragColor=vec4(vec3(1.0),1.0);
        return;
    }

    vec3 N=normalize(Normal);
    vec3 V=normalize(uCamPos-WorldPos);
    vec3 albedo=uAlbedo;
    float metallic=clamp(uMetallic,0.0,1.0);
    float roughness=clamp(uRoughness,0.045,1.0);
    vec3 F0=mix(vec3(0.04),albedo,metallic);
    vec3 Lo=vec3(0.0);

    // Debug 通道累积每盏点光源的贡献；用光源贡献加权便于观察。
    float dAccum=0.0,gAccum=0.0,ndotlAccum=0.0,lightWeight=0.0;
    vec3 fAccum=vec3(0.0),diffuseAccum=vec3(0.0),specularAccum=vec3(0.0);

    for(int i=0;i<4;i++){
        // 片元到光源方向 L，以及 H = normalize(V+L)。
        vec3 toLight=uLightPositions[i]-WorldPos;
        float distance=length(toLight);
        vec3 L=toLight/max(distance,0.0001);
        vec3 H=normalize(V+L);

        // 官方理想点光源：入射贡献随距离平方反比衰减。
        vec3 radiance=uLightColors[i]*uLightScale/max(distance*distance,0.0001);
        float NdotL=max(dot(N,L),0.0);
        float NdotV=max(dot(N,V),0.0);
        if(NdotL<=0.0||NdotV<=0.0)continue;

        float D=DistributionGGX(N,H,roughness);
        float G=GeometrySmith(N,V,L,roughness);
        vec3 F=FresnelSchlick(max(dot(H,V),0.0),F0);

        // Cook–Torrance 镜面 BRDF：D*G*F / [4*(N·L)*(N·V)]。
        vec3 specular=(D*G*F)/max(4.0*NdotV*NdotL,0.0001);
        // F 已在 specular 中，千万不要再乘一次 kS。
        vec3 kD=(vec3(1.0)-F)*(1.0-metallic);
        vec3 diffuse=kD*albedo/PI;

        // 反射率方程的点光源离散形式：材质 BRDF * 入射贡献 * 余弦。
        vec3 diffLight=diffuse*radiance*NdotL;
        vec3 specLight=specular*radiance*NdotL;
        Lo+=diffLight+specLight;

        diffuseAccum+=diffLight;
        specularAccum+=specLight;
        float w=dot(radiance,vec3(0.2126,0.7152,0.0722))*NdotL;
        dAccum+=D*w;gAccum+=G*w;fAccum+=F*w;
        ndotlAccum+=NdotL*w;lightWeight+=w;
    }

    // LearnOpenGL 暂用 0.03 常数近似环境光；不是 IBL 积分。
    vec3 ambient=vec3(0.03)*albedo*uAO;
    vec3 hdr=ambient+Lo;

    if(uViewMode==1)hdr=diffuseAccum;
    if(uViewMode==2)hdr=specularAccum;
    if(uViewMode==3){
        // D 是密度且可能 >1，用 d/(1+d) 显示映射而非宣称其是百分比。
        float d=dAccum/max(lightWeight,0.000001);
        hdr=vec3(d/(1.0+d));
    }
    if(uViewMode==4)hdr=vec3(gAccum/max(lightWeight,0.000001));
    if(uViewMode==5)hdr=fAccum/max(lightWeight,0.000001);
    if(uViewMode==6)hdr=N*0.5+0.5;
    if(uViewMode==7)hdr=vec3(ndotlAccum/max(lightWeight,0.000001));

    // Debug 的 D/G/F/Normal/NdotL 是教学可视化，不做第二次 tone mapping。
    if(uViewMode>=3){
        FragColor=vec4(clamp(hdr,0.0,1.0),1.0);
        return;
    }
    // HDR -> Reinhard tone mapping -> linear to display gamma approximation。
    vec3 mapped=hdr/(hdr+vec3(1.0));
    mapped=pow(mapped,vec3(1.0/2.2));
    FragColor=vec4(mapped,1.0);
}`;

function compile(type,source){
    const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const err=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(err);
    }return shader;
}
function makeProgram(){
    const p=gl.createProgram(),v=compile(gl.VERTEX_SHADER,vs),f=compile(gl.FRAGMENT_SHADER,fs);
    gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);
    gl.deleteShader(v);gl.deleteShader(f);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
    return p;
}
let program;
try{program=makeProgram();}catch(e){status.textContent="Shader 编译失败："+e.message;console.error(e);return;}
gl.useProgram(program);

// Latitude/longitude sphere, indexed triangles; positive outward winding.
function createSphere(segments=64,rings=64){
    const verts=[],inds=[];
    for(let y=0;y<=rings;y++){
        const theta=y*Math.PI/rings,st=Math.sin(theta),ct=Math.cos(theta);
        for(let x=0;x<=segments;x++){
            const phi=x*2*Math.PI/segments;
            const nx=st*Math.cos(phi),ny=ct,nz=st*Math.sin(phi);
            verts.push(nx,ny,nz,nx,ny,nz);
        }
    }
    for(let y=0;y<rings;y++)for(let x=0;x<segments;x++){
        const a=y*(segments+1)+x,b=a+segments+1;
        inds.push(a,b,a+1,b,b+1,a+1);
    }
    const vao=gl.createVertexArray();gl.bindVertexArray(vao);
    const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);
    const eb=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,eb);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(inds),gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);
    gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);
    gl.bindVertexArray(null);
    return {vao,count:inds.length};
}
const sphere=createSphere();
const uniform=n=>gl.getUniformLocation(program,n);
const u={
    vp:uniform("uViewProjection"),offset:uniform("uOffset"),scale:uniform("uScale"),
    camera:uniform("uCamPos"),albedo:uniform("uAlbedo"),metal:uniform("uMetallic"),
    rough:uniform("uRoughness"),ao:uniform("uAO"),intensity:uniform("uLightScale"),
    mode:uniform("uViewMode"),lamp:uniform("uLamp"),
    lights:[0,1,2,3].map(i=>uniform("uLightPositions["+i+"]")),
    colors:[0,1,2,3].map(i=>uniform("uLightColors["+i+"]"))
};
const lights=[[-10,10,10],[10,10,10],[-10,-10,10],[10,-10,10]];
const lightColor=[300,300,300];

function perspective(fovy,aspect,near,far){
    const f=1/Math.tan(fovy/2),nf=1/(near-far);
    return new Float32Array([f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0]);
}
function lookAt(eye,center,up){
    let z=[eye[0]-center[0],eye[1]-center[1],eye[2]-center[2]];
    let len=Math.hypot(...z);z=z.map(a=>a/len);
    let x=[up[1]*z[2]-up[2]*z[1],up[2]*z[0]-up[0]*z[2],up[0]*z[1]-up[1]*z[0]];
    len=Math.hypot(...x);x=x.map(a=>a/len);
    const y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]];
    return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,
        -(x[0]*eye[0]+x[1]*eye[1]+x[2]*eye[2]),
        -(y[0]*eye[0]+y[1]*eye[1]+y[2]*eye[2]),
        -(z[0]*eye[0]+z[1]*eye[1]+z[2]*eye[2]),1]);
}
function mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){
    o[c*4+r]=a[0*4+r]*b[c*4+0]+a[1*4+r]*b[c*4+1]+a[2*4+r]*b[c*4+2]+a[3*4+r]*b[c*4+3];
}return o;}

let yaw=0,pitch=0,distance=25,viewMode=0;
const state={row:-1,col:-1,metal:.5,rough:.5,albedo:[0.5,0.0,0.0],ao:1,intensity:1};
let pressed=false,lastX=0,lastY=0;
const resetCamera=()=>{yaw=0;pitch=0;distance=25;};
canvas.addEventListener("pointerdown",e=>{pressed=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener("pointermove",e=>{if(!pressed)return;yaw+=(e.clientX-lastX)*0.005;pitch=Math.max(-1.35,Math.min(1.35,pitch+(e.clientY-lastY)*0.005));lastX=e.clientX;lastY=e.clientY;});
canvas.addEventListener("pointerup",()=>pressed=false);
canvas.addEventListener("pointercancel",()=>pressed=false);
canvas.addEventListener("wheel",e=>{e.preventDefault();distance=Math.max(12,Math.min(55,distance*Math.exp(e.deltaY*.001)));},{passive:false});
window.addEventListener("keydown",e=>{if(e.code==="KeyR")resetCamera();});
document.getElementById("resetCamera").onclick=resetCamera;

const rowSel=document.getElementById("row"),colSel=document.getElementById("col");
rowSel.onchange=()=>state.row=+rowSel.value;
colSel.onchange=()=>state.col=+colSel.value;
for(const [id,key] of [["metallic","metal"],["roughness","rough"],["ao","ao"],["intensity","intensity"]]){
    const input=document.getElementById(id),value=document.getElementById(id+"-val");
    input.oninput=()=>{state[key]=+input.value;value.textContent=state[key].toFixed(2);};
}
document.getElementById("albedo").oninput=e=>{
    const v=e.target.value;
    // HTML color input is sRGB; decode to linear RGB before BRDF calculations.
    state.albedo=[1,3,5].map(i=>parseInt(v.slice(i,i+2),16)/255)
      .map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4));
};
document.getElementById("albedo").dispatchEvent(new Event("input"));
const tabs=[...document.querySelectorAll("[data-view]")];
const modes={final:0,diffuse:1,specular:2,D:3,G:4,F:5,normal:6,ndotl:7};
tabs.forEach(b=>b.onclick=()=>{viewMode=modes[b.dataset.view];tabs.forEach(t=>t.classList.toggle("active",t===b));});
document.getElementById("reset").onclick=()=>{
    rowSel.value="-1";colSel.value="-1";state.row=-1;state.col=-1;
    for(const [id,value] of [["metallic",".5"],["roughness",".5"],["ao","1"],["intensity","1"]]){
        const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event("input"));
    }
    const color=document.getElementById("albedo");color.value="#bc0000";color.dispatchEvent(new Event("input"));
    tabs[0].click();
};
gl.enable(gl.DEPTH_TEST);
gl.depthFunc(gl.LESS);
gl.disable(gl.CULL_FACE);
gl.clearColor(0.02,0.025,0.04,1);

function render(){
    const cssW=canvas.clientWidth,cssH=canvas.clientHeight;
    // Render at device pixel ratio while capping resolution for affordable laptop GPUs.
    const ratio=Math.min(window.devicePixelRatio||1,1.5);
    const w=Math.max(1,Math.floor(cssW*ratio)),h=Math.max(1,Math.floor(cssH*ratio));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    const eye=[Math.sin(yaw)*Math.cos(pitch)*distance,Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance];
    const vp=mul(perspective(Math.PI/4,w/h,0.1,100),lookAt(eye,[0,0,0],[0,1,0]));
    gl.useProgram(program);gl.bindVertexArray(sphere.vao);
    gl.uniformMatrix4fv(u.vp,false,vp);
    gl.uniform3fv(u.camera,eye);
    gl.uniform3fv(u.albedo,state.albedo);
    gl.uniform1f(u.ao,state.ao);
    gl.uniform1f(u.intensity,state.intensity);
    gl.uniform1i(u.mode,viewMode);
    lights.forEach((p,i)=>{gl.uniform3fv(u.lights[i],p);gl.uniform3fv(u.colors[i],lightColor);});
    gl.uniform1i(u.lamp,0);gl.uniform1f(u.scale,1);

    // LearnOpenGL's 7x7 sphere layout: metallic varies per row; roughness per column.
    // clamp roughness to .05 to avoid an ideal-mirror singularity.
    for(let row=0;row<7;row++)for(let col=0;col<7;col++){
        const metallic=state.row===row?state.metal:row/7;
        const roughness=state.col===col?state.rough:Math.max(col/7,0.05);
        gl.uniform1f(u.metal,metallic);
        gl.uniform1f(u.rough,roughness);
        gl.uniform3f(u.offset,(col-3)*2.5,(row-3)*2.5,0);
        gl.drawElements(gl.TRIANGLES,sphere.count,gl.UNSIGNED_SHORT,0);
    }
    // Four emissive light marker spheres (only if in final view).
    if(viewMode===0){
        gl.uniform1i(u.lamp,1);gl.uniform1f(u.scale,0.5);
        for(const p of lights){gl.uniform3fv(u.offset,p);gl.drawElements(gl.TRIANGLES,sphere.count,gl.UNSIGNED_SHORT,0);}
    }
    gl.bindVertexArray(null);
    requestAnimationFrame(render);
}
status.textContent="WebGL2 · 49 球 · 四点光源";
requestAnimationFrame(render);
})();
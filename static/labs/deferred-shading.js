(()=>{
const canvas=document.getElementById('gl'),gl=canvas.getContext('webgl2',{antialias:true});
if(!gl){document.body.innerHTML='<p style="padding:24px">需要支持 WebGL2 的浏览器。</p>';return;}
if(!gl.getExtension('EXT_color_buffer_float')){document.body.innerHTML='<p style="padding:24px">当前浏览器缺少 EXT_color_buffer_float。</p>';return;}
function sh(t,s){const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(x));return x}
function prog(v,f){const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,v));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p}

const gvs=['#version 300 es','layout(location=0) in vec3 aPos;layout(location=1) in vec3 aNormal;','uniform mat4 uModel,uView,uProj;','out vec3 vPos;out vec3 vNormal;','void main(){vec4 w=uModel*vec4(aPos,1.0);vPos=w.xyz;vNormal=mat3(transpose(inverse(uModel)))*aNormal;gl_Position=uProj*uView*w;}'].join('\n');
const gfs=['#version 300 es','precision highp float;','layout(location=0) out vec4 gPosition;layout(location=1) out vec4 gNormal;layout(location=2) out vec4 gAlbedoSpec;','in vec3 vPos;in vec3 vNormal;uniform vec3 uAlbedo;uniform float uSpec;','void main(){gPosition=vec4(vPos,1);gNormal=vec4(normalize(vNormal),1);gAlbedoSpec=vec4(uAlbedo,uSpec);}'].join('\n');
const qvs='#version 300 es\nlayout(location=0) in vec2 aPos;out vec2 uv;void main(){uv=aPos*.5+.5;gl_Position=vec4(aPos,0,1);}';
const lfs=[
'#version 300 es','precision highp float;','in vec2 uv;out vec4 FragColor;',
'uniform sampler2D gPosition,gNormal,gAlbedoSpec;uniform int uMode,uLightCount;uniform vec3 uLightPos[64],uLightColor[64];uniform vec3 uViewPos;uniform float uAmbient;',
'void main(){vec3 p=texture(gPosition,uv).xyz;vec3 n=texture(gNormal,uv).xyz;vec4 a=texture(gAlbedoSpec,uv);',
'if(uMode==1){FragColor=vec4(p*.08+.5,1);return;}if(uMode==2){FragColor=vec4(n*.5+.5,1);return;}if(uMode==3){FragColor=vec4(a.rgb*.88+a.a*.12,1);return;}',
'if(a.a==0.0 && dot(a.rgb,a.rgb)<.0001){FragColor=vec4(.015,.02,.03,1);return;}',
'vec3 V=normalize(uViewPos-p);vec3 c=a.rgb*uAmbient;',
'for(int i=0;i<64;i++){if(i>=uLightCount)break;vec3 d=uLightPos[i]-p;float dist=length(d);if(dist<5.5){vec3 L=d/max(dist,.001);float att=1.0/(1.0+.22*dist+.20*dist*dist);float ndl=max(dot(n,L),0.0);vec3 H=normalize(L+V);float sp=pow(max(dot(n,H),0.0),24.0)*a.a;c+=(a.rgb*ndl+vec3(sp))*uLightColor[i]*att;}}',
'c=vec3(1.0)-exp(-c*1.1);c=pow(c,vec3(1.0/2.2));FragColor=vec4(c,1);}'
].join('\n');
const gp=prog(gvs,gfs),lp=prog(qvs,lfs);

const cube=new Float32Array([
-1,-1,-1,0,0,-1, 1,1,-1,0,0,-1, 1,-1,-1,0,0,-1, 1,1,-1,0,0,-1,-1,-1,-1,0,0,-1,-1,1,-1,0,0,-1,
-1,-1,1,0,0,1, 1,-1,1,0,0,1, 1,1,1,0,0,1, 1,1,1,0,0,1,-1,1,1,0,0,1,-1,-1,1,0,0,1,
-1,1,1,-1,0,0,-1,1,-1,-1,0,0,-1,-1,-1,-1,0,0,-1,-1,-1,-1,0,0,-1,-1,-1,1,-1,0,0,-1,1,1,-1,0,0,
1,1,1,1,0,0,1,-1,-1,1,0,0,1,1,-1,1,0,0,1,-1,-1,1,0,0,1,1,1,1,0,0,1,-1,1,1,0,0,
-1,-1,-1,0,-1,0,1,-1,-1,0,-1,0,1,-1,1,0,-1,0,1,-1,1,0,-1,0,-1,-1,1,0,-1,0,-1,-1,-1,0,-1,0,
-1,1,-1,0,1,0,1,1,1,0,1,0,1,1,-1,0,1,0,1,1,1,0,1,0,-1,1,-1,0,1,0,-1,1,1,0,1,0
]);
const vao=gl.createVertexArray();gl.bindVertexArray(vao);const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,cube,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);
const qvao=gl.createVertexArray();gl.bindVertexArray(qvao);const qb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,qb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);

function tex(internal,format,type){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,internal,canvas.width,canvas.height,0,format,type,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);return t}
const pos=tex(gl.RGBA16F,gl.RGBA,gl.HALF_FLOAT),norm=tex(gl.RGBA16F,gl.RGBA,gl.HALF_FLOAT),alb=tex(gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE);
const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,pos,0);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT1,gl.TEXTURE_2D,norm,0);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT2,gl.TEXTURE_2D,alb,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1,gl.COLOR_ATTACHMENT2]);
const depth=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,canvas.width,canvas.height);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);gl.bindFramebuffer(gl.FRAMEBUFFER,null);

function ident(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])}
function mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){o[c*4+r]=0;for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k]}return o}
function model(x,y,z,sx,sy,sz){const m=ident();m[0]=sx;m[5]=sy;m[10]=sz;m[12]=x;m[13]=y;m[14]=z;return m}
function perspective(fov,asp,n,f){const q=1/Math.tan(fov/2),o=new Float32Array(16);o[0]=q/asp;o[5]=q;o[10]=(f+n)/(n-f);o[11]=-1;o[14]=2*f*n/(n-f);return o}
function lookAt(e,c,u){let zx=e[0]-c[0],zy=e[1]-c[1],zz=e[2]-c[2];let l=Math.hypot(zx,zy,zz);zx/=l;zy/=l;zz/=l;let xx=u[1]*zz-u[2]*zy,xy=u[2]*zx-u[0]*zz,xz=u[0]*zy-u[1]*zx;l=Math.hypot(xx,xy,xz);xx/=l;xy/=l;xz/=l;let yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;const o=ident();o[0]=xx;o[1]=yx;o[2]=zx;o[4]=xy;o[5]=yy;o[6]=zy;o[8]=xz;o[9]=yz;o[10]=zz;o[12]=-(xx*e[0]+xy*e[1]+xz*e[2]);o[13]=-(yx*e[0]+yy*e[1]+yz*e[2]);o[14]=-(zx*e[0]+zy*e[1]+zz*e[2]);return o}
const eye=[7,6,9],view=lookAt(eye,[0,0,0],[0,1,0]),proj=perspective(Math.PI/4,canvas.width/canvas.height,.1,50);
const objects=[
[0,-1.2,0,5,.25,5,.22,.24,.30,.15],
[-2,0,-2,.8,1.2,.8,.62,.18,.14,.65],[0,0,-2,.8,.8,.8,.12,.52,.72,.45],[2,0,-2,.8,1.5,.8,.64,.48,.12,.75],
[-2,0,1,.8,.7,.8,.20,.66,.35,.35],[0,0,1,.8,1.3,.8,.66,.16,.52,.80],[2,0,1,.8,.95,.8,.22,.38,.75,.55]
];
const lpArr=new Float32Array(64*3),lcArr=new Float32Array(64*3);
for(let i=0;i<64;i++){const a=i*2.399,r=1.0+(i%8)*.55;lpArr[i*3]=Math.cos(a)*r;lpArr[i*3+1]=.6+(i%5)*.55;lpArr[i*3+2]=Math.sin(a)*r;lcArr[i*3]=.45+.55*((i*37)%100)/100;lcArr[i*3+1]=.45+.55*((i*53)%100)/100;lcArr[i*3+2]=.45+.55*((i*71)%100)/100}
let mode=0,lightCount=32,ambient=.08;

function render(){
gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.viewport(0,0,canvas.width,canvas.height);gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(gp);gl.uniformMatrix4fv(gl.getUniformLocation(gp,'uView'),false,view);gl.uniformMatrix4fv(gl.getUniformLocation(gp,'uProj'),false,proj);gl.bindVertexArray(vao);
for(const o of objects){gl.uniformMatrix4fv(gl.getUniformLocation(gp,'uModel'),false,model(o[0],o[1],o[2],o[3],o[4],o[5]));gl.uniform3f(gl.getUniformLocation(gp,'uAlbedo'),o[6],o[7],o[8]);gl.uniform1f(gl.getUniformLocation(gp,'uSpec'),o[9]);gl.drawArrays(gl.TRIANGLES,0,36);}
gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.disable(gl.DEPTH_TEST);gl.clearColor(.01,.015,.025,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(lp);
for(const [unit,tex,name] of [[0,pos,'gPosition'],[1,norm,'gNormal'],[2,alb,'gAlbedoSpec']]){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,tex);gl.uniform1i(gl.getUniformLocation(lp,name),unit)}
gl.uniform1i(gl.getUniformLocation(lp,'uMode'),mode);gl.uniform1i(gl.getUniformLocation(lp,'uLightCount'),lightCount);gl.uniform3fv(gl.getUniformLocation(lp,'uLightPos[0]'),lpArr);gl.uniform3fv(gl.getUniformLocation(lp,'uLightColor[0]'),lcArr);gl.uniform3fv(gl.getUniformLocation(lp,'uViewPos'),new Float32Array(eye));gl.uniform1f(gl.getUniformLocation(lp,'uAmbient'),ambient);gl.bindVertexArray(qvao);gl.drawArrays(gl.TRIANGLES,0,6);requestAnimationFrame(render);
}
document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));btn.classList.add('active');mode={final:0,position:1,normal:2,albedo:3}[btn.dataset.mode];}));
document.getElementById('lights').addEventListener('input',e=>{lightCount=+e.target.value;document.getElementById('lightsVal').textContent=String(lightCount)});
document.getElementById('ambient').addEventListener('input',e=>{ambient=+e.target.value;document.getElementById('ambientVal').textContent=ambient.toFixed(2)});
requestAnimationFrame(render);
})();
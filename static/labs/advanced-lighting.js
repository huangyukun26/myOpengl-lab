(()=>{
const canvas=document.getElementById('gl');
const gl=canvas.getContext('webgl2',{antialias:true});
if(!gl){document.body.innerHTML='<p style="padding:24px">需要支持 WebGL2 的浏览器。</p>';return;}

function sh(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s}
function prog(vs,fs){const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,vs));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p}

const vs=['#version 300 es',
'layout(location=0) in vec3 aPos;',
'layout(location=1) in vec3 aNormal;',
'layout(location=2) in vec2 aUV;',
'uniform mat4 uVP;',
'out vec3 FragPos;',
'out vec3 Normal;',
'out vec2 UV;',
'void main(){FragPos=aPos;Normal=aNormal;UV=aUV;gl_Position=uVP*vec4(aPos,1.0);}'].join('\n');

const fs=['#version 300 es','precision highp float;',
'in vec3 FragPos;in vec3 Normal;in vec2 UV;out vec4 FragColor;',
'uniform vec3 uLightPos;uniform vec3 uViewPos;uniform bool uBlinn;uniform float uShine;',
'vec3 wood(vec2 uv){',
' float grain=0.5+0.5*sin(uv.x*14.0+sin(uv.y*5.0)*1.8);',
' float fine=0.5+0.5*sin(uv.x*42.0+uv.y*6.0);',
' vec3 a=vec3(0.16,0.07,0.025);vec3 b=vec3(0.55,0.27,0.08);',
' return mix(a,b,0.55*grain+0.20*fine+0.15);',
'}',
'void main(){',
' vec3 color=wood(UV);vec3 N=normalize(Normal);',
' vec3 L=normalize(uLightPos-FragPos);vec3 V=normalize(uViewPos-FragPos);',
' float diff=max(dot(N,L),0.0);',
' float spec=0.0;',
' if(uBlinn){vec3 H=normalize(L+V);spec=pow(max(dot(N,H),0.0),uShine);}',
' else{vec3 R=reflect(-L,N);spec=pow(max(dot(V,R),0.0),uShine);}',
' vec3 ambient=0.055*color;vec3 diffuse=diff*color;vec3 specular=vec3(0.62)*spec;',
' FragColor=vec4(ambient+diffuse+specular,1.0);',
'}'].join('\n');

const P=prog(vs,fs);
const verts=new Float32Array([
-10,0, 10, 0,1,0, 0,10,
-10,0,-10, 0,1,0, 0, 0,
 10,0,-10, 0,1,0,10, 0,
-10,0, 10, 0,1,0, 0,10,
 10,0,-10, 0,1,0,10, 0,
 10,0, 10, 0,1,0,10,10
]);
const vao=gl.createVertexArray();gl.bindVertexArray(vao);
const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,verts,gl.STATIC_DRAW);
const stride=8*4;gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,stride,0);
gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,stride,3*4);
gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,2,gl.FLOAT,false,stride,6*4);

function norm(v){const l=Math.hypot(...v);return v.map(x=>x/l)}
function sub(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]]}
function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}
function perspective(fov,aspect,n,f){const t=1/Math.tan(fov/2),nf=1/(n-f);return new Float32Array([t/aspect,0,0,0,0,t,0,0,0,0,(f+n)*nf,-1,0,0,2*f*n*nf,0])}
function lookAt(e,c,u){const z=norm(sub(e,c)),x=norm(cross(u,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,e),-dot(y,e),-dot(z,e),1])}
function mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s}return o}

let shine=8,matched=true,camDeg=22,lightX=0;
const shineEl=document.getElementById('shininess'),shineVal=document.getElementById('shineVal'),camEl=document.getElementById('camera'),camVal=document.getElementById('camVal'),lightEl=document.getElementById('light'),lightVal=document.getElementById('lightVal');
shineEl.oninput=()=>{shine=+shineEl.value;shineVal.textContent=shine;updateLabels()};
camEl.oninput=()=>{camDeg=+camEl.value;camVal.textContent=camDeg+'°'};
lightEl.oninput=()=>{lightX=+lightEl.value;lightVal.textContent=lightX.toFixed(1)};
document.getElementById('matched').onclick=e=>{matched=!matched;e.currentTarget.classList.toggle('active',matched);e.currentTarget.textContent=matched?'Blinn ×4 指数':'两边相同指数';updateLabels()};
document.getElementById('low').onclick=()=>{shine=1;shineEl.value=1;shineVal.textContent='1';matched=false;document.getElementById('matched').classList.remove('active');document.getElementById('matched').textContent='两边相同指数';updateLabels()};
function updateLabels(){document.getElementById('leftLabel').textContent='Phong · shininess '+shine;document.getElementById('rightLabel').textContent='Blinn-Phong · shininess '+(matched?shine*4:shine)}
updateLabels();

function renderSide(x,w,blinn){
 gl.viewport(x,0,w,canvas.height);gl.enable(gl.SCISSOR_TEST);gl.scissor(x,0,w,canvas.height);gl.clearColor(.045,.05,.065,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.disable(gl.SCISSOR_TEST);
 const a=camDeg*Math.PI/180;const eye=[Math.sin(a)*5.5,2.3,Math.cos(a)*5.5];
 const pr=perspective(47*Math.PI/180,w/canvas.height,.1,100),vw=lookAt(eye,[0,0,0],[0,1,0]),vp=mul(pr,vw);
 gl.useProgram(P);gl.uniformMatrix4fv(gl.getUniformLocation(P,'uVP'),false,vp);
 gl.uniform3f(gl.getUniformLocation(P,'uLightPos'),lightX,2.2,0);
 gl.uniform3fv(gl.getUniformLocation(P,'uViewPos'),eye);
 gl.uniform1i(gl.getUniformLocation(P,'uBlinn'),blinn?1:0);
 gl.uniform1f(gl.getUniformLocation(P,'uShine'),blinn&&matched?shine*4:shine);
 gl.bindVertexArray(vao);gl.drawArrays(gl.TRIANGLES,0,6);
}
gl.enable(gl.DEPTH_TEST);
function frame(){
 const half=canvas.width/2;renderSide(0,half,false);renderSide(half,half,true);
 gl.enable(gl.SCISSOR_TEST);gl.scissor(half-1,0,2,canvas.height);gl.clearColor(.55,.58,.64,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.disable(gl.SCISSOR_TEST);
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
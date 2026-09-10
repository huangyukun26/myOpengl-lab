(()=>{'use strict';
const $=id=>document.getElementById(id),canvas=$('glcanvas'),gl=canvas.getContext('webgl2',{antialias:true,alpha:false});
const ui={mode:$('mode'),uboPanel:$('uboPanel'),builtinsPanel:$('builtinsPanel'),builtinDemo:$('builtinDemo'),pointControls:$('pointControls'),builtinExplain:$('builtinExplain'),bVertex:$('bVertex'),bPoint:$('bPoint'),bFrag:$('bFrag'),bFront:$('bFront'),camX:$('camX'),camText:$('camText'),fov:$('fov'),fovText:$('fovText'),pointSize:$('pointSize'),pointText:$('pointText'),writeStat:$('writeStat'),bindStat:$('bindStat'),modeStat:$('modeStat'),flow:$('flow'),code:$('code'),breakBlue:$('breakBlue'),restoreBlue:$('restoreBlue'),blueProg:$('blueProg')};
if(!gl){ui.flow.textContent='WebGL2 unavailable';return;}

function sh(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
function program(vs,fs){const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,vs));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p}
const VS_UBO=`#version 300 es
layout(location=0) in vec3 aPos;
layout(std140) uniform Matrices { mat4 projection; mat4 view; };
uniform mat4 model;
void main(){gl_Position=projection*view*model*vec4(aPos,1.0);}`;
const FS=c=>`#version 300 es
precision highp float;out vec4 FragColor;void main(){FragColor=vec4(${c},1.0);}`;
const programs=[program(VS_UBO,FS('0.95,0.20,0.18')),program(VS_UBO,FS('0.20,0.82,0.32')),program(VS_UBO,FS('0.95,0.78,0.18')),program(VS_UBO,FS('0.20,0.45,0.98'))];
const blockIndices=programs.map(p=>gl.getUniformBlockIndex(p,'Matrices'));blockIndices.forEach((idx,i)=>gl.uniformBlockBinding(programs[i],idx,0));

const VS_POINTS=`#version 300 es
layout(location=0) in vec2 aPos;uniform float uBase;out float vID;
void main(){vID=float(gl_VertexID);gl_Position=vec4(aPos,0.0,1.0);gl_PointSize=uBase+float(gl_VertexID)*4.0;}`;
const FS_POINTS=`#version 300 es
precision highp float;in float vID;out vec4 FragColor;
void main(){vec2 q=gl_PointCoord-vec2(.5);if(dot(q,q)>.25)discard;float t=vID/4.0;FragColor=vec4(.2+.7*t,.75-.45*t,.95,1.0);}`;
const pointProg=program(VS_POINTS,FS_POINTS);

const VS_SCREEN=`#version 300 es
const vec2 P[3]=vec2[](vec2(-1.0,-1.0),vec2(3.0,-1.0),vec2(-1.0,3.0));
void main(){gl_Position=vec4(P[gl_VertexID],0.0,1.0);}`;
const FS_FRAGCOORD=`#version 300 es
precision highp float;uniform vec2 uResolution;out vec4 FragColor;
void main(){vec2 uv=gl_FragCoord.xy/uResolution;FragColor=vec4(uv.x,uv.y,.25,1.0);}`;
const fragCoordProg=program(VS_SCREEN,FS_FRAGCOORD);

const VS_FRONT=`#version 300 es
layout(location=0) in vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}`;
const FS_FRONT=`#version 300 es
precision highp float;out vec4 FragColor;
void main(){FragColor=gl_FrontFacing?vec4(.15,.8,.3,1.0):vec4(.95,.25,.2,1.0);}`;
const frontProg=program(VS_FRONT,FS_FRONT);

const cubeData=new Float32Array([
-0.5,-0.5,-0.5, 0.5,-0.5,-0.5, 0.5,0.5,-0.5, 0.5,0.5,-0.5,-0.5,0.5,-0.5,-0.5,-0.5,-0.5,
-0.5,-0.5,0.5, 0.5,0.5,0.5, 0.5,-0.5,0.5, 0.5,0.5,0.5,-0.5,-0.5,0.5,-0.5,0.5,0.5,
-0.5,0.5,0.5,-0.5,0.5,-0.5,-0.5,-0.5,-0.5,-0.5,-0.5,-0.5,-0.5,-0.5,0.5,-0.5,0.5,0.5,
0.5,0.5,0.5,0.5,-0.5,-0.5,0.5,0.5,-0.5,0.5,-0.5,-0.5,0.5,0.5,0.5,0.5,-0.5,0.5,
-0.5,-0.5,-0.5,0.5,-0.5,-0.5,0.5,-0.5,0.5,0.5,-0.5,0.5,-0.5,-0.5,0.5,-0.5,-0.5,-0.5,
-0.5,0.5,-0.5,0.5,0.5,0.5,0.5,0.5,-0.5,0.5,0.5,0.5,-0.5,0.5,-0.5,-0.5,0.5,0.5]);
const cubeVAO=gl.createVertexArray(),cubeVBO=gl.createBuffer();gl.bindVertexArray(cubeVAO);gl.bindBuffer(gl.ARRAY_BUFFER,cubeVBO);gl.bufferData(gl.ARRAY_BUFFER,cubeData,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,12,0);
const pts=new Float32Array([-.75,.25,-.38,-.2,0,.32,.38,-.18,.74,.22]);const pointVAO=gl.createVertexArray(),pointVBO=gl.createBuffer();gl.bindVertexArray(pointVAO);gl.bindBuffer(gl.ARRAY_BUFFER,pointVBO);gl.bufferData(gl.ARRAY_BUFFER,pts,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,8,0);
const frontVerts=new Float32Array([
-.85,-.55,-.15,-.55,-.5,.55,
 .15,-.55,.5,.55,.85,-.55
]);
const frontVAO=gl.createVertexArray(),frontVBO=gl.createBuffer();gl.bindVertexArray(frontVAO);gl.bindBuffer(gl.ARRAY_BUFFER,frontVBO);gl.bufferData(gl.ARRAY_BUFFER,frontVerts,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,8,0);
const emptyVAO=gl.createVertexArray();

function ident(){const m=new Float32Array(16);m[0]=m[5]=m[10]=m[15]=1;return m}
function perspective(fov,a,n,f){const m=new Float32Array(16),t=1/Math.tan(fov/2);m[0]=t/a;m[5]=t;m[10]=(f+n)/(n-f);m[11]=-1;m[14]=2*f*n/(n-f);return m}
function norm(v){const l=Math.hypot(...v)||1;return v.map(x=>x/l)}function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function lookAt(e,c,u){const z=norm([e[0]-c[0],e[1]-c[1],e[2]-c[2]]),x=norm(cross(u,z)),y=cross(z,x),m=ident();m[0]=x[0];m[1]=y[0];m[2]=z[0];m[4]=x[1];m[5]=y[1];m[6]=z[1];m[8]=x[2];m[9]=y[2];m[10]=z[2];m[12]=-(x[0]*e[0]+x[1]*e[1]+x[2]*e[2]);m[13]=-(y[0]*e[0]+y[1]*e[1]+y[2]*e[2]);m[14]=-(z[0]*e[0]+z[1]*e[1]+z[2]*e[2]);return m}
function model(x,y,z,s=.72){const m=ident();m[0]=m[5]=m[10]=s;m[12]=x;m[13]=y;m[14]=z;return m}

const ubo=gl.createBuffer(),frozenUBO=gl.createBuffer();for(const b of [ubo,frozenUBO]){gl.bindBuffer(gl.UNIFORM_BUFFER,b);gl.bufferData(gl.UNIFORM_BUFFER,128,gl.DYNAMIC_DRAW)}gl.bindBufferBase(gl.UNIFORM_BUFFER,0,ubo);gl.bindBufferBase(gl.UNIFORM_BUFFER,1,frozenUBO);
let dirty=true,writes=0,blueShared=true;
function matrices(){const fov=(+ui.fov.value)*Math.PI/180,aspect=Math.max(1e-3,canvas.width/canvas.height);return{projection:perspective(fov,aspect,.1,100),view:lookAt([+ui.camX.value,0,5],[0,0,0],[0,1,0])}}
function writeBlock(buffer,countWrite=true){const m=matrices();gl.bindBuffer(gl.UNIFORM_BUFFER,buffer);gl.bufferSubData(gl.UNIFORM_BUFFER,0,m.projection);gl.bufferSubData(gl.UNIFORM_BUFFER,64,m.view);if(countWrite)writes++;}
function freezeBlue(){writeBlock(frozenUBO,false);gl.uniformBlockBinding(programs[3],blockIndices[3],1);blueShared=false;ui.blueProg.classList.add('off');updateUI()}
function restoreBlue(){gl.uniformBlockBinding(programs[3],blockIndices[3],0);blueShared=true;ui.blueProg.classList.remove('off');updateUI()}

function resize(){const d=Math.min(devicePixelRatio||1,2),w=Math.max(2,Math.floor(canvas.clientWidth*d)),h=Math.max(2,Math.floor(canvas.clientHeight*d));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;dirty=true}}
function drawUBO(){if(dirty){writeBlock(ubo,true);dirty=false}gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.clearColor(.025,.03,.04,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.bindVertexArray(cubeVAO);const ms=[model(-1.05,1.0,0),model(1.05,1.0,0),model(-1.05,-1.0,0),model(1.05,-1.0,0)];for(let i=0;i<4;i++){gl.useProgram(programs[i]);gl.uniformMatrix4fv(gl.getUniformLocation(programs[i],'model'),false,ms[i]);gl.drawArrays(gl.TRIANGLES,0,36)}}
function drawPoints(){gl.disable(gl.DEPTH_TEST);gl.clearColor(.025,.03,.04,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(pointProg);gl.uniform1f(gl.getUniformLocation(pointProg,'uBase'),+ui.pointSize.value);gl.bindVertexArray(pointVAO);gl.drawArrays(gl.POINTS,0,5)}
function drawFragCoord(){gl.disable(gl.DEPTH_TEST);gl.clearColor(.025,.03,.04,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(fragCoordProg);gl.uniform2f(gl.getUniformLocation(fragCoordProg,'uResolution'),canvas.width,canvas.height);gl.bindVertexArray(emptyVAO);gl.drawArrays(gl.TRIANGLES,0,3)}
function drawFrontFacing(){gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.clearColor(.025,.03,.04,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(frontProg);gl.bindVertexArray(frontVAO);gl.drawArrays(gl.TRIANGLES,0,6)}
function drawBuiltins(){const demo=ui.builtinDemo.value;if(demo==='point')drawPoints();else if(demo==='fragcoord')drawFragCoord();else drawFrontFacing()}
function draw(){resize();gl.viewport(0,0,canvas.width,canvas.height);if(ui.mode.value==='ubo')drawUBO();else drawBuiltins();updateStats();requestAnimationFrame(draw)}
function updateStats(){ui.writeStat.textContent=writes;ui.bindStat.textContent=blueShared?'4 / 4':'3 / 4';ui.modeStat.textContent=ui.mode.value==='ubo'?'UBO':ui.builtinDemo.value.toUpperCase()}
function setActive(...els){[ui.bVertex,ui.bPoint,ui.bFrag,ui.bFront].forEach(x=>x.classList.remove('activeBox'));els.forEach(x=>x.classList.add('activeBox'))}
function updateUI(){const isUbo=ui.mode.value==='ubo';ui.uboPanel.hidden=!isUbo;ui.builtinsPanel.hidden=isUbo;ui.camText.textContent=(+ui.camX.value).toFixed(2);ui.fovText.textContent=ui.fov.value+'°';ui.pointText.textContent=ui.pointSize.value;
if(isUbo){ui.flow.textContent=`CPU\n  ↓ 1 个 Matrices UBO\n[ projection | view ]\n  ↓ binding point 0\nRed / Green / Yellow / ${blueShared?'Blue':'Blue(冻结在 binding 1)'}\n\nmodel 仍然逐物体设置。`;ui.code.textContent=`layout(std140) uniform Matrices {\n    mat4 projection;\n    mat4 view;\n};\n\n// CPU\nglBindBuffer(GL_UNIFORM_BUFFER, uboMatrices);\nglBufferSubData(GL_UNIFORM_BUFFER, 0, 64, projection);\nglBufferSubData(GL_UNIFORM_BUFFER, 64, 64, view);\n\n// program → binding point 0\nglUniformBlockBinding(program, blockIndex, 0);`;}
else{const d=ui.builtinDemo.value;ui.pointControls.hidden=d!=='point';if(d==='point'){setActive(ui.bVertex,ui.bPoint);ui.builtinExplain.innerHTML='<b>左到右 5 个点就是 Vertex 0~4。</b>每个顶点在 Vertex Shader 里读 gl_VertexID，并据此写不同的 gl_PointSize。拖动滑杆只改变基础大小。';ui.flow.textContent='5 个顶点\n   ↓\ngl_VertexID = 0,1,2,3,4\n   ↓\ngl_PointSize = base + ID × 4\n   ↓\n屏幕上 5 个点逐渐变大';ui.code.textContent=`// Vertex Shader\nint id = gl_VertexID;\ngl_PointSize = base + float(id) * 4.0;`;}
else if(d==='fragcoord'){setActive(ui.bFrag);ui.builtinExplain.innerHTML='<b>现在整张屏幕就是实验。</b>Fragment Shader 对每个像素读取 gl_FragCoord.xy。越往右 x 越大，越往上 y 越大，所以颜色形成位置渐变。';ui.flow.textContent='Rasterization 生成每个 fragment\n   ↓\ngl_FragCoord.xy = 当前窗口像素坐标\n   ↓\n除以屏幕宽高\n   ↓\n直接拿位置生成颜色';ui.code.textContent=`vec2 uv = gl_FragCoord.xy / resolution;\nFragColor = vec4(uv.x, uv.y, 0.25, 1.0);`;}
else{setActive(ui.bFront);ui.builtinExplain.innerHTML='<b>左右两个三角形顶点顺序故意相反。</b>左边是 CCW 正面，右边是 CW 背面；没有开启面剔除，所以两边都能进入 Fragment Shader，gl_FrontFacing 决定绿色还是红色。';ui.flow.textContent='左三角形：CCW → gl_FrontFacing = true → 绿色\n右三角形：CW  → gl_FrontFacing = false → 红色\n\n注意：如果开启 Back-face Culling，右边会直接被剔除。';ui.code.textContent=`if (gl_FrontFacing)\n    FragColor = green;\nelse\n    FragColor = red;`;}}
updateStats()}
ui.mode.onchange=updateUI;ui.builtinDemo.onchange=updateUI;ui.camX.oninput=()=>{dirty=true;updateUI()};ui.fov.oninput=()=>{dirty=true;updateUI()};ui.pointSize.oninput=updateUI;ui.breakBlue.onclick=freezeBlue;ui.restoreBlue.onclick=restoreBlue;writeBlock(frozenUBO,false);updateUI();requestAnimationFrame(draw);
})();
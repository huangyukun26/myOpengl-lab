(()=>{'use strict';
const $=id=>document.getElementById(id),canvas=$('glcanvas'),gl=canvas.getContext('webgl2',{antialias:true,alpha:false});
const ui={mode:$('mode'),uboPanel:$('uboPanel'),builtinsPanel:$('builtinsPanel'),std140Panel:$('std140Panel'),fragDepthPanel:$('fragDepthPanel'),builtinDemo:$('builtinDemo'),pointControls:$('pointControls'),builtinExplain:$('builtinExplain'),bVertex:$('bVertex'),bPoint:$('bPoint'),bFrag:$('bFrag'),bFront:$('bFront'),camX:$('camX'),camText:$('camText'),fov:$('fov'),fovText:$('fovText'),pointSize:$('pointSize'),pointText:$('pointText'),writeStat:$('writeStat'),bindStat:$('bindStat'),modeStat:$('modeStat'),flow:$('flow'),code:$('code'),breakBlue:$('breakBlue'),restoreBlue:$('restoreBlue'),blueProg:$('blueProg'),stdMemory:$('stdMemory'),stdInfo:$('stdInfo'),writeDepth:$('writeDepth'),manualDepth:$('manualDepth'),depthText:$('depthText'),manualMark:$('manualMark'),manualTick:$('manualTick')};
if(!gl){ui.flow.textContent='WebGL2 unavailable';return;}
function sh(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
function program(vs,fs){const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,vs));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p}
const FS=c=>`#version 300 es\nprecision highp float;out vec4 FragColor;void main(){FragColor=vec4(${c},1.0);}`;
const VS_UBO=`#version 300 es
layout(location=0) in vec3 aPos;
layout(std140) uniform Matrices { mat4 projection; mat4 view; };
uniform mat4 model;
void main(){gl_Position=projection*view*model*vec4(aPos,1.0);}`;
const programs=[program(VS_UBO,FS('.95,.20,.18')),program(VS_UBO,FS('.20,.82,.32')),program(VS_UBO,FS('.95,.78,.18')),program(VS_UBO,FS('.20,.45,.98'))];
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
const VS_STD=`#version 300 es
layout(std140) uniform DemoBlock { float a; vec2 b; vec4 c; mat4 m; float arr[3]; };
void main(){gl_Position=vec4(0.0);}`;
const stdProg=program(VS_STD,FS('.2,.5,.9'));
const VS_DEPTH=`#version 300 es
layout(location=0) in vec2 aPos;uniform float uZ;void main(){gl_Position=vec4(aPos,uZ,1.0);}`;
const FS_DEPTH_DEFAULT=`#version 300 es
precision highp float;uniform vec3 uColor;out vec4 FragColor;
void main(){FragColor=vec4(uColor,1.0);}`;
const FS_DEPTH_WRITE=`#version 300 es
precision highp float;uniform vec3 uColor;uniform float uDepth;out vec4 FragColor;
void main(){gl_FragDepth=uDepth;FragColor=vec4(uColor,1.0);}`;
const depthDefaultProg=program(VS_DEPTH,FS_DEPTH_DEFAULT),depthWriteProg=program(VS_DEPTH,FS_DEPTH_WRITE);
const cubeData=new Float32Array([
-.5,-.5,-.5,.5,-.5,-.5,.5,.5,-.5,.5,.5,-.5,-.5,.5,-.5,-.5,-.5,-.5,
-.5,-.5,.5,.5,.5,.5,.5,-.5,.5,.5,.5,.5,-.5,-.5,.5,-.5,.5,.5,
-.5,.5,.5,-.5,.5,-.5,-.5,-.5,-.5,-.5,-.5,-.5,-.5,-.5,.5,-.5,.5,.5,
.5,.5,.5,.5,-.5,-.5,.5,.5,-.5,.5,-.5,-.5,.5,.5,.5,.5,-.5,.5,
-.5,-.5,-.5,.5,-.5,-.5,.5,-.5,.5,.5,-.5,.5,-.5,-.5,.5,-.5,-.5,-.5,
-.5,.5,-.5,.5,.5,.5,.5,.5,-.5,.5,.5,.5,-.5,.5,-.5,-.5,.5,.5]);
function makeVAO(data,size){const vao=gl.createVertexArray(),vbo=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,size,gl.FLOAT,false,size*4,0);return vao}
const cubeVAO=makeVAO(cubeData,3);
const pointVAO=makeVAO(new Float32Array([-.75,.25,-.38,-.2,0,.32,.38,-.18,.74,.22]),2);
const frontVAO=makeVAO(new Float32Array([-.85,-.55,-.15,-.55,-.5,.55,.15,-.55,.5,.55,.85,-.55]),2);
const depthVAO=makeVAO(new Float32Array([-.72,-.55,.72,-.55,.72,.55,-.72,-.55,.72,.55,-.72,.55]),2);
const emptyVAO=gl.createVertexArray();
function ident(){const m=new Float32Array(16);m[0]=m[5]=m[10]=m[15]=1;return m}
function perspective(fov,a,n,f){const m=new Float32Array(16),t=1/Math.tan(fov/2);m[0]=t/a;m[5]=t;m[10]=(f+n)/(n-f);m[11]=-1;m[14]=2*f*n/(n-f);return m}
function norm(v){const l=Math.hypot(...v)||1;return v.map(x=>x/l)}function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function lookAt(e,c,u){const z=norm([e[0]-c[0],e[1]-c[1],e[2]-c[2]]),x=norm(cross(u,z)),y=cross(z,x),m=ident();m[0]=x[0];m[1]=y[0];m[2]=z[0];m[4]=x[1];m[5]=y[1];m[6]=z[1];m[8]=x[2];m[9]=y[2];m[10]=z[2];m[12]=-(x[0]*e[0]+x[1]*e[1]+x[2]*e[2]);m[13]=-(y[0]*e[0]+y[1]*e[1]+y[2]*e[2]);m[14]=-(z[0]*e[0]+z[1]*e[1]+z[2]*e[2]);return m}
function model(x,y,z,s=.72){const m=ident();m[0]=m[5]=m[10]=s;m[12]=x;m[13]=y;m[14]=z;return m}
const ubo=gl.createBuffer(),frozenUBO=gl.createBuffer();for(const b of [ubo,frozenUBO]){gl.bindBuffer(gl.UNIFORM_BUFFER,b);gl.bufferData(gl.UNIFORM_BUFFER,128,gl.DYNAMIC_DRAW)}gl.bindBufferBase(gl.UNIFORM_BUFFER,0,ubo);gl.bindBufferBase(gl.UNIFORM_BUFFER,1,frozenUBO);
let dirty=true,writes=0,blueShared=true;
function matrices(){const fov=(+ui.fov.value)*Math.PI/180,aspect=Math.max(1e-3,canvas.width/canvas.height);return{projection:perspective(fov,aspect,.1,100),view:lookAt([+ui.camX.value,0,5],[0,0,0],[0,1,0])}}
function writeBlock(buffer,countWrite=true){const m=matrices();gl.bindBuffer(gl.UNIFORM_BUFFER,buffer);gl.bufferSubData(gl.UNIFORM_BUFFER,0,m.projection);gl.bufferSubData(gl.UNIFORM_BUFFER,64,m.view);if(countWrite)writes++}
function freezeBlue(){writeBlock(frozenUBO,false);gl.uniformBlockBinding(programs[3],blockIndices[3],1);blueShared=false;ui.blueProg.classList.add('off');updateUI()}
function restoreBlue(){gl.uniformBlockBinding(programs[3],blockIndices[3],0);blueShared=true;ui.blueProg.classList.remove('off');updateUI()}
function resize(){const d=Math.min(devicePixelRatio||1,2),w=Math.max(2,Math.floor(canvas.clientWidth*d)),h=Math.max(2,Math.floor(canvas.clientHeight*d));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;dirty=true}}
function clear(depth=false){if(depth)gl.enable(gl.DEPTH_TEST);else gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.clearColor(.025,.03,.04,1);gl.clear(gl.COLOR_BUFFER_BIT|(depth?gl.DEPTH_BUFFER_BIT:0))}
function drawUBO(){if(dirty){writeBlock(ubo,true);dirty=false}clear(true);gl.bindVertexArray(cubeVAO);const ms=[model(-1.05,1,0),model(1.05,1,0),model(-1.05,-1,0),model(1.05,-1,0)];for(let i=0;i<4;i++){gl.useProgram(programs[i]);gl.uniformMatrix4fv(gl.getUniformLocation(programs[i],'model'),false,ms[i]);gl.drawArrays(gl.TRIANGLES,0,36)}}
function drawPoints(){clear(false);gl.useProgram(pointProg);gl.uniform1f(gl.getUniformLocation(pointProg,'uBase'),+ui.pointSize.value);gl.bindVertexArray(pointVAO);gl.drawArrays(gl.POINTS,0,5)}
function drawFragCoord(){clear(false);gl.useProgram(fragCoordProg);gl.uniform2f(gl.getUniformLocation(fragCoordProg,'uResolution'),canvas.width,canvas.height);gl.bindVertexArray(emptyVAO);gl.drawArrays(gl.TRIANGLES,0,3)}
function drawFrontFacing(){clear(false);gl.useProgram(frontProg);gl.bindVertexArray(frontVAO);gl.drawArrays(gl.TRIANGLES,0,6)}
function drawBuiltins(){const d=ui.builtinDemo.value;if(d==='point')drawPoints();else if(d==='fragcoord')drawFragCoord();else drawFrontFacing()}
function drawStd(){clear(false);gl.useProgram(fragCoordProg);gl.uniform2f(gl.getUniformLocation(fragCoordProg,'uResolution'),canvas.width,canvas.height);gl.bindVertexArray(emptyVAO);gl.drawArrays(gl.TRIANGLES,0,3)}
function drawDepthLayer(prog,zv,r,g,b,manual){gl.useProgram(prog);gl.uniform1f(gl.getUniformLocation(prog,'uZ'),zv);gl.uniform3f(gl.getUniformLocation(prog,'uColor'),r,g,b);if(manual)gl.uniform1f(gl.getUniformLocation(prog,'uDepth'),+ui.manualDepth.value);gl.drawArrays(gl.TRIANGLES,0,6)}
function drawDepth(){clear(true);gl.depthFunc(gl.LESS);gl.bindVertexArray(depthVAO);drawDepthLayer(depthDefaultProg,.30,.18,.42,.95,false);if(ui.writeDepth.checked)drawDepthLayer(depthWriteProg,-.30,.95,.22,.18,true);else drawDepthLayer(depthDefaultProg,-.30,.95,.22,.18,false)}
function queryStd140(){const names=['a','b','c','m','arr[0]'];const idx=gl.getUniformIndices(stdProg,names);const offsets=gl.getActiveUniforms(stdProg,idx,gl.UNIFORM_OFFSET);const strides=gl.getActiveUniforms(stdProg,idx,gl.UNIFORM_ARRAY_STRIDE);const block=gl.getUniformBlockIndex(stdProg,'DemoBlock');const size=gl.getActiveUniformBlockParameter(stdProg,block,gl.UNIFORM_BLOCK_DATA_SIZE);return{names,offsets:Array.from(offsets),strides:Array.from(strides),size}}
const std=queryStd140();
function buildStdUI(){ui.stdMemory.innerHTML='';const used=new Map();function mark(start,bytes,label){for(let b=start;b<start+bytes;b+=4)used.set(b,label)}mark(std.offsets[0],4,'a');mark(std.offsets[1],8,'b');mark(std.offsets[2],16,'c');mark(std.offsets[3],64,'m');const stride=std.strides[4]||16;for(let i=0;i<3;i++)mark(std.offsets[4]+i*stride,4,'arr'+i);for(let b=0;b<std.size;b+=4){const d=document.createElement('div');d.className='cell '+(used.has(b)?'used':'pad');d.textContent=used.get(b)||'·';d.title=`byte ${b}`;ui.stdMemory.appendChild(d)}ui.stdInfo.textContent=`Block size = ${std.size} bytes\na @ ${std.offsets[0]}\nb @ ${std.offsets[1]}\nc @ ${std.offsets[2]}\nm @ ${std.offsets[3]}\narr[0] @ ${std.offsets[4]}, array stride = ${stride}`}
buildStdUI();
function draw(){resize();gl.viewport(0,0,canvas.width,canvas.height);const m=ui.mode.value;if(m==='ubo')drawUBO();else if(m==='builtins')drawBuiltins();else if(m==='std140')drawStd();else drawDepth();updateStats();requestAnimationFrame(draw)}
function setActive(...els){[ui.bVertex,ui.bPoint,ui.bFrag,ui.bFront].forEach(x=>x.classList.remove('activeBox'));els.forEach(x=>x.classList.add('activeBox'))}
function updateStats(){const m=ui.mode.value;ui.modeStat.textContent=m==='ubo'?'UBO':m==='builtins'?ui.builtinDemo.value.toUpperCase():m==='std140'?'STD140':'FRAGDEPTH';ui.writeStat.textContent=m==='std140'?std.size:m==='fragdepth'?(ui.writeDepth.checked?'WRITE':'DEFAULT'):writes;ui.bindStat.textContent=m==='ubo'?(blueShared?'4 / 4':'3 / 4'):m==='std140'?((std.strides[4]||16)+' B stride'):m==='fragdepth'?(+ui.manualDepth.value).toFixed(2):'—'}
function updateUI(){const m=ui.mode.value;ui.uboPanel.hidden=m!=='ubo';ui.builtinsPanel.hidden=m!=='builtins';ui.std140Panel.hidden=m!=='std140';ui.fragDepthPanel.hidden=m!=='fragdepth';ui.camText.textContent=(+ui.camX.value).toFixed(2);ui.fovText.textContent=ui.fov.value+'°';ui.pointText.textContent=ui.pointSize.value;ui.depthText.textContent=(+ui.manualDepth.value).toFixed(2);const pct=(+ui.manualDepth.value*100)+'%';ui.manualMark.style.left=pct;ui.manualTick.style.left=pct;ui.manualMark.textContent='manual '+(+ui.manualDepth.value).toFixed(2);
if(m==='ubo'){ui.flow.textContent=`CPU\n  ↓ 1 个 Matrices UBO\n[ projection | view ]\n  ↓ binding point 0\nRed / Green / Yellow / ${blueShared?'Blue':'Blue(冻结在 binding 1)'}\n\nmodel 仍逐物体设置。`;ui.code.textContent=`layout(std140) uniform Matrices {\n  mat4 projection;\n  mat4 view;\n};\n\nglUniformBlockBinding(program, blockIndex, 0);\nglBindBufferBase(GL_UNIFORM_BUFFER, 0, uboMatrices);`}
else if(m==='builtins'){const d=ui.builtinDemo.value;ui.pointControls.hidden=d!=='point';if(d==='point'){setActive(ui.bVertex,ui.bPoint);ui.builtinExplain.innerHTML='<b>左到右 5 个点就是 Vertex 0~4。</b> gl_VertexID 参与计算 gl_PointSize，所以编号越大的点越大。';ui.flow.textContent='Vertex 0..4\n  ↓ gl_VertexID\nVertex Shader 写 gl_PointSize\n  ↓\nGL_POINTS 以不同像素大小光栅化';ui.code.textContent=`gl_PointSize = base + float(gl_VertexID) * 4.0;`}else if(d==='fragcoord'){setActive(ui.bFrag);ui.builtinExplain.innerHTML='<b>整张屏幕就是坐标纸。</b> 每个 fragment 读取 gl_FragCoord.xy，右边 x 大，上面 y 大。';ui.flow.textContent='每个 fragment\n  ↓\ngl_FragCoord.xy = 窗口坐标\n  ↓\n用坐标直接生成颜色';ui.code.textContent=`vec2 uv = gl_FragCoord.xy / resolution;\nFragColor = vec4(uv.x, uv.y, .25, 1.0);`}else{setActive(ui.bFront);ui.builtinExplain.innerHTML='<b>两个三角形顶点绕序相反。</b> 不开启剔除时，gl_FrontFacing 仍能告诉 Fragment Shader 当前片段来自正面还是背面。';ui.flow.textContent='CCW triangle → gl_FrontFacing = true\nCW triangle  → gl_FrontFacing = false';ui.code.textContent=`FragColor = gl_FrontFacing ? green : red;`}}
else if(m==='std140'){ui.flow.textContent='Uniform Block\n  ↓ std140 对齐规则\n成员被放进确定的 byte offset\n  ↓\nCPU 按这些 offset 写 UBO\n  ↓\nShader 才能正确读到';ui.code.textContent=`layout(std140) uniform DemoBlock {\n  float a;   // offset 0\n  vec2  b;   // offset 8\n  vec4  c;   // offset 16\n  mat4  m;   // offset 32\n  float arr[3]; // array stride 16\n};`}
else{ui.flow.textContent=ui.writeDepth.checked?`蓝层先写 depth ≈ 0.65\n红层几何原本 depth ≈ 0.35\nFragment Shader 强制写 → ${(+ui.manualDepth.value).toFixed(2)}\nGL_LESS：${(+ui.manualDepth.value).toFixed(2)} < 0.65 ? ${+ui.manualDepth.value<.65?'PASS · 红色可见':'FAIL · 蓝色保留'}`:'蓝层先写 depth ≈ 0.65\n红层使用正常几何 depth ≈ 0.35\nGL_LESS：0.35 < 0.65 → PASS\n所以红色盖住蓝色';ui.code.textContent=ui.writeDepth.checked?`// 手动深度版本的 Fragment Shader\nvoid main(){\n    gl_FragDepth = value;\n    FragColor = red;\n}`:`// 默认版本完全不写 gl_FragDepth\nvoid main(){\n    FragColor = red;\n}`}
updateStats()}
ui.mode.onchange=updateUI;ui.builtinDemo.onchange=updateUI;ui.camX.oninput=()=>{dirty=true;updateUI()};ui.fov.oninput=()=>{dirty=true;updateUI()};ui.pointSize.oninput=updateUI;ui.breakBlue.onclick=freezeBlue;ui.restoreBlue.onclick=restoreBlue;ui.writeDepth.onchange=updateUI;ui.manualDepth.oninput=updateUI;writeBlock(frozenUBO,false);updateUI();requestAnimationFrame(draw);
})();
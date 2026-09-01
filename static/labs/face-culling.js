(() => {
  const $ = (id) => document.getElementById(id);
  const canvas = $('glcanvas');
  const micro = $('windingCanvas');
  const mctx = micro.getContext('2d');
  const badge = $('modeBadge');

  // LearnOpenGL official Face Culling exercise vertex data.
  // The exercise intentionally defines each outward face clockwise and pairs it with glFrontFace(GL_CW).
  const cubeCW = new Float32Array([
    // back
    -.5,-.5,-.5,0,0,  .5,-.5,-.5,1,0,  .5,.5,-.5,1,1,
     .5,.5,-.5,1,1,  -.5,.5,-.5,0,1, -.5,-.5,-.5,0,0,
    // front
    -.5,-.5,.5,0,0,  .5,.5,.5,1,1,  .5,-.5,.5,1,0,
     .5,.5,.5,1,1,  -.5,-.5,.5,0,0, -.5,.5,.5,0,1,
    // left
    -.5,.5,.5,1,0, -.5,-.5,-.5,0,1, -.5,.5,-.5,1,1,
    -.5,-.5,-.5,0,1, -.5,.5,.5,1,0, -.5,-.5,.5,0,0,
    // right
     .5,.5,.5,1,0, .5,.5,-.5,1,1, .5,-.5,-.5,0,1,
     .5,-.5,-.5,0,1, .5,-.5,.5,0,0, .5,.5,.5,1,0,
    // bottom
    -.5,-.5,-.5,0,1, .5,-.5,.5,1,0, .5,-.5,-.5,1,1,
     .5,-.5,.5,1,0, -.5,-.5,-.5,0,1, -.5,-.5,.5,0,0,
    // top
    -.5,.5,-.5,0,1, .5,.5,-.5,1,1, .5,.5,.5,1,0,
     .5,.5,.5,1,0, -.5,.5,.5,0,0, -.5,.5,-.5,0,1
  ]);

  // Reverse every triangle of the official exercise to obtain the CCW teaching version.
  const cubeCCW = new Float32Array(cubeCW.length);
  for (let t = 0; t < 12; t++) {
    const base = t * 15;
    for (let k = 0; k < 5; k++) cubeCCW[base + k] = cubeCW[base + k];
    for (let k = 0; k < 5; k++) cubeCCW[base + 5 + k] = cubeCW[base + 10 + k];
    for (let k = 0; k < 5; k++) cubeCCW[base + 10 + k] = cubeCW[base + 5 + k];
  }

  let gl;
  let program, vao, vbo, texture;
  let uMVP, uTexture, uTint;
  let currentData = cubeCCW;
  let cameraInside = false;
  let yaw = 32, pitch = -18, distance = 3.2;
  let drag = false, lastX = 0, lastY = 0;
  let autoAngle = 0, lastTime = performance.now();

  const vs = `#version 300 es
  layout(location=0) in vec3 aPos;
  layout(location=1) in vec2 aUV;
  uniform mat4 uMVP;
  out vec2 vUV;
  void main(){ vUV=aUV; gl_Position=uMVP*vec4(aPos,1.0); }`;

  const fs = `#version 300 es
  precision highp float;
  in vec2 vUV;
  uniform sampler2D uTexture;
  uniform bool uTint;
  out vec4 FragColor;
  void main(){
    vec3 tex = texture(uTexture,vUV).rgb;
    if(uTint){
      vec3 tint = gl_FrontFacing ? vec3(0.35,0.78,1.0) : vec3(1.0,0.48,0.25);
      tex = mix(tex,tint,0.58);
    }
    FragColor=vec4(tex,1.0);
  }`;

  function shader(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function initGL() {
    gl = canvas.getContext('webgl2', {antialias:true, alpha:false});
    if (!gl) throw new Error('WebGL2 unavailable');
    program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, vs));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    uMVP = gl.getUniformLocation(program,'uMVP');
    uTexture = gl.getUniformLocation(program,'uTexture');
    uTint = gl.getUniformLocation(program,'uTint');
    vao = gl.createVertexArray(); vbo = gl.createBuffer();
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
    gl.bufferData(gl.ARRAY_BUFFER,currentData,gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,20,0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,2,gl.FLOAT,false,20,12);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
    texture = createFallbackTexture();
    gl.uniform1i(uTexture,0);
    loadOfficialTexture();
    badge.textContent='● WebGL2 · LearnOpenGL marble texture'; badge.className='badge ok';
  }

  function createFallbackTexture() {
    const tex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tex);
    const px=new Uint8Array([
      210,210,215,255, 90,95,105,255,
      90,95,105,255, 210,210,215,255
    ]);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,2,2,0,gl.RGBA,gl.UNSIGNED_BYTE,px);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D); return tex;
  }

  function loadOfficialTexture() {
    const img=new Image(); img.crossOrigin='anonymous';
    img.onload=()=>{
      gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
      badge.textContent='● WebGL2 · official marble.jpg loaded'; badge.className='badge ok';
    };
    img.onerror=()=>{badge.textContent='● WebGL2 · official texture offline → fallback';badge.className='badge warn';};
    img.src='https://raw.githubusercontent.com/JoeyDeVries/LearnOpenGL/master/resources/textures/marble.jpg';
  }

  function mat4Identity(){return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];}
  function mul(a,b){const o=new Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
  function perspective(fovy,aspect,near,far){const f=1/Math.tan(fovy/2),nf=1/(near-far);return [f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0];}
  function rotationX(a){const c=Math.cos(a),s=Math.sin(a);return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1];}
  function rotationY(a){const c=Math.cos(a),s=Math.sin(a);return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1];}
  function translation(x,y,z){const m=mat4Identity();m[12]=x;m[13]=y;m[14]=z;return m;}
  function transform(m,x,y,z){return [m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14],m[3]*x+m[7]*y+m[11]*z+m[15]];}

  function getMVP() {
    const rect=canvas.getBoundingClientRect();
    const proj=perspective(Math.PI/3, Math.max(.1,rect.width/rect.height), .05, 100);
    const model=mul(rotationY((yaw+autoAngle)*Math.PI/180), rotationX(pitch*Math.PI/180));
    const view=translation(0,0,cameraInside?0:-distance);
    return mul(proj,mul(view,model));
  }

  function resize(){const d=Math.min(2,window.devicePixelRatio||1),r=canvas.getBoundingClientRect(),w=Math.floor(r.width*d),h=Math.floor(r.height*d);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}}

  function applyState() {
    if(!gl) return;
    $('cullEnabled').checked ? gl.enable(gl.CULL_FACE) : gl.disable(gl.CULL_FACE);
    gl.cullFace(gl[$('cullFace').value]);
    gl.frontFace(gl[$('frontFace').value]);
    gl.uniform1i(uTint,$('orientationTint').checked?1:0);
  }

  function projectedStats(mvp) {
    let front=0,back=0;
    const wantCCW=$('frontFace').value==='CCW';
    for(let t=0;t<12;t++){
      const b=t*15, pts=[];
      for(let j=0;j<3;j++){
        const i=b+j*5,p=transform(mvp,currentData[i],currentData[i+1],currentData[i+2]);
        if(Math.abs(p[3])<1e-5){pts.push([0,0]);continue;}
        pts.push([p[0]/p[3],p[1]/p[3]]);
      }
      const area=(pts[1][0]-pts[0][0])*(pts[2][1]-pts[0][1])-(pts[1][1]-pts[0][1])*(pts[2][0]-pts[0][0]);
      const ccw=area>0;
      const isFront=ccw===wantCCW;
      isFront?front++:back++;
    }
    let culled=0;
    if($('cullEnabled').checked){const c=$('cullFace').value;culled=c==='BACK'?back:c==='FRONT'?front:12;}
    $('frontCount').textContent=front;$('backCount').textContent=back;$('culledCount').textContent=culled;
    drawMicroscope(wantCCW);
  }

  function drawMicroscope(wantCCW){
    const w=micro.width,h=micro.height;mctx.clearRect(0,0,w,h);mctx.fillStyle='#0d1117';mctx.fillRect(0,0,w,h);
    const isDataCW=$('windingData').value==='cw';
    let pts=isDataCW?[[70,210],[290,210],[180,55]]:[[70,210],[180,55],[290,210]];
    mctx.lineWidth=5;mctx.strokeStyle='#58a6ff';mctx.fillStyle='#13263a';mctx.beginPath();mctx.moveTo(...pts[0]);mctx.lineTo(...pts[1]);mctx.lineTo(...pts[2]);mctx.closePath();mctx.fill();mctx.stroke();
    const labels=['1','2','3'];mctx.font='bold 26px system-ui';mctx.textAlign='center';mctx.textBaseline='middle';
    pts.forEach((p,i)=>{mctx.fillStyle='#e6edf3';mctx.beginPath();mctx.arc(p[0],p[1],18,0,Math.PI*2);mctx.fill();mctx.fillStyle='#0d1117';mctx.fillText(labels[i],p[0],p[1]+1);});
    mctx.strokeStyle='#d29922';mctx.fillStyle='#d29922';mctx.lineWidth=4;
    for(let i=0;i<3;i++){const a=pts[i],b=pts[(i+1)%3],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),sx=a[0]+dx*.26,sy=a[1]+dy*.26,ex=a[0]+dx*.72,ey=a[1]+dy*.72;mctx.beginPath();mctx.moveTo(sx,sy);mctx.lineTo(ex,ey);mctx.stroke();const ux=dx/len,uy=dy/len;mctx.beginPath();mctx.moveTo(ex,ey);mctx.lineTo(ex-ux*14+uy*8,ey-uy*14-ux*8);mctx.lineTo(ex-ux*14-uy*8,ey-uy*14+ux*8);mctx.closePath();mctx.fill();}
    const dataLabel=isDataCW?'CW':'CCW', frontLabel=wantCCW?'CCW':'CW';
    $('microTitle').textContent=`数据 ${dataLabel} · OpenGL 定义 ${frontLabel} = FRONT`;
    $('microText').textContent=dataLabel===frontLabel?'这套顶点顺序会被定义成正向面；若 glCullFace(GL_BACK)，它会保留下来。':'这套顶点顺序会被定义成背向面；若 glCullFace(GL_BACK)，它会被剔除。';
  }

  function updateCode(){
    const data=$('windingData').value==='cw'?'// official exercise: CW vertices':'// tutorial: CCW vertices';
    $('code').textContent=`${data}\n${$('cullEnabled').checked?'glEnable':'glDisable'}(GL_CULL_FACE);\nglCullFace(GL_${$('cullFace').value});\nglFrontFace(GL_${$('frontFace').value});\n\n// Face Culling happens before rasterization.\n// Culled triangle => no fragments => no fragment shader work.`;
  }

  function render(now){
    const dt=Math.min(.05,(now-lastTime)/1000);lastTime=now;if($('autoRotate').checked)autoAngle=(autoAngle+dt*22)%360;
    if(gl){resize();gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.045,.06,.08,1);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);applyState();const mvp=getMVP();gl.uniformMatrix4fv(uMVP,false,new Float32Array(mvp));gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.bindVertexArray(vao);gl.drawArrays(gl.TRIANGLES,0,36);projectedStats(mvp);}
    requestAnimationFrame(render);
  }

  function setData(){currentData=$('windingData').value==='cw'?cubeCW:cubeCCW;if(gl){gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,currentData,gl.DYNAMIC_DRAW);}updateCode();}
  function setCamera(inside){cameraInside=inside;$('outsideBtn').classList.toggle('active',!inside);$('insideBtn').classList.toggle('active',inside);distance=inside?0:3.2;}
  function sync(){setData();updateCode();}

  ['windingData','frontFace','cullFace','cullEnabled','orientationTint'].forEach(id=>$(id).addEventListener('input',sync));
  $('rotation').addEventListener('input',()=>{yaw=+$('rotation').value;$('rotationText').textContent=`${yaw}°`;$('autoRotate').checked=false;});
  $('outsideBtn').onclick=()=>setCamera(false);$('insideBtn').onclick=()=>setCamera(true);
  $('reset').onclick=()=>{$('windingData').value='ccw';$('frontFace').value='CCW';$('cullFace').value='BACK';$('cullEnabled').checked=true;$('orientationTint').checked=false;$('autoRotate').checked=true;yaw=32;pitch=-18;autoAngle=0;$('rotation').value='32';$('rotationText').textContent='32°';setCamera(false);sync();};

  canvas.addEventListener('pointerdown',e=>{drag=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);$('autoRotate').checked=false;});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw+=(e.clientX-lastX)*.5;pitch=Math.max(-85,Math.min(85,pitch+(e.clientY-lastY)*.5));lastX=e.clientX;lastY=e.clientY;$('rotationText').textContent=`${Math.round(yaw)}°`;});
  canvas.addEventListener('pointerup',()=>drag=false);
  canvas.addEventListener('wheel',e=>{e.preventDefault();if(!cameraInside)distance=Math.max(1.25,Math.min(7,distance+e.deltaY*.004));},{passive:false});

  try{initGL();sync();requestAnimationFrame(render);}catch(err){console.error(err);badge.textContent=`● WebGL2 init failed: ${err.message}`;badge.className='badge warn';drawMicroscope(true);updateCode();}
})();

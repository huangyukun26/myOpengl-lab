(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canvas = $('glcanvas');
  const status = $('runtimeStatus');

  const factors = [
    ['GL_ZERO', 'ZERO'], ['GL_ONE', 'ONE'],
    ['GL_SRC_COLOR', 'SRC_COLOR'], ['GL_ONE_MINUS_SRC_COLOR', 'ONE_MINUS_SRC_COLOR'],
    ['GL_DST_COLOR', 'DST_COLOR'], ['GL_ONE_MINUS_DST_COLOR', 'ONE_MINUS_DST_COLOR'],
    ['GL_SRC_ALPHA', 'SRC_ALPHA'], ['GL_ONE_MINUS_SRC_ALPHA', 'ONE_MINUS_SRC_ALPHA'],
    ['GL_DST_ALPHA', 'DST_ALPHA'], ['GL_ONE_MINUS_DST_ALPHA', 'ONE_MINUS_DST_ALPHA'],
  ];
  const equations = [
    ['GL_FUNC_ADD', 'FUNC_ADD'],
    ['GL_FUNC_SUBTRACT', 'FUNC_SUBTRACT'],
    ['GL_FUNC_REVERSE_SUBTRACT', 'FUNC_REVERSE_SUBTRACT'],
    ['GL_MIN', 'MIN'],
    ['GL_MAX', 'MAX'],
  ];

  function fillSelect(el, items, selected) {
    el.replaceChildren();
    for (const [label, value] of items) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      option.selected = value === selected;
      el.appendChild(option);
    }
  }

  // 先初始化 UI。即使 WebGL 失败，控件也不会整页失效。
  fillSelect($('srcFactor'), factors, 'SRC_ALPHA');
  fillSelect($('dstFactor'), factors, 'ONE_MINUS_SRC_ALPHA');
  fillSelect($('equation'), equations, 'FUNC_ADD');

  const hex = (h) => [
    parseInt(h.slice(1, 3), 16) / 255,
    parseInt(h.slice(3, 5), 16) / 255,
    parseInt(h.slice(5, 7), 16) / 255,
  ];

  function currentScene() {
    return {
      A: { o: [-0.18, 0.04], s: [0.62, 0.60], z: 0.55, rgb: hex($('colorA').value), a: +$('alphaA').value },
      B: { o: [0.22, -0.02], s: [0.62, 0.60], z: 0.15, rgb: hex($('colorB').value), a: +$('alphaB').value },
      discard: +$('discard').value,
    };
  }

  function stateCode() {
    const d = +$('discard').value;
    return `${$('blend').checked ? 'glEnable' : 'glDisable'}(GL_BLEND);\n` +
      `glBlendFunc(GL_${$('srcFactor').value},\n            GL_${$('dstFactor').value});\n` +
      `glBlendEquation(GL_${$('equation').value});\n\n` +
      `${$('depthTest').checked ? 'glEnable' : 'glDisable'}(GL_DEPTH_TEST);\n` +
      `glDepthMask(${$('depthWrite').checked ? 'GL_TRUE' : 'GL_FALSE'});\n\n` +
      `// draw: ${$('order').value === 'far-near' ? 'Far -> Near' : 'Near -> Far'}\n` +
      (d > 0 ? `if (color.a < ${d.toFixed(2)}) discard;` : '// discard disabled');
  }

  function updateLabels(mode) {
    $('alphaAText').textContent = (+$('alphaA').value).toFixed(2);
    $('alphaBText').textContent = (+$('alphaB').value).toFixed(2);
    const d = +$('discard').value;
    $('discardText').textContent = d === 0 ? '关闭' : d.toFixed(2);
    $('formula').textContent = $('blend').checked
      ? `Cout = Csrc × ${$('srcFactor').selectedOptions[0]?.textContent ?? $('srcFactor').value} + Cdst × ${$('dstFactor').selectedOptions[0]?.textContent ?? $('dstFactor').value}`
      : 'GL_BLEND disabled → shader 输出直接覆盖 Color Buffer（通过测试后）';
    $('code').textContent = stateCode();
    if (mode) status.textContent = mode;
  }

  function createWebGLRenderer() {
    const gl = canvas.getContext('webgl2', { alpha: false, depth: true, antialias: true });
    if (!gl) throw new Error('浏览器没有提供 WebGL2 context');

    const vertexSource = `#version 300 es
      layout(location = 0) in vec2 aPos;
      uniform vec2 uOffset;
      uniform vec2 uScale;
      uniform float uZ;
      void main() {
        vec2 p = aPos * uScale + uOffset;
        gl_Position = vec4(p, uZ, 1.0);
      }
    `;

    const fragmentSource = `#version 300 es
      precision highp float;
      uniform vec4 uColor;
      uniform float uDiscard;
      out vec4 FragColor;
      void main() {
        if (uDiscard > 0.0 && uColor.a < uDiscard) {
          discard;
        }
        FragColor = uColor;
      }
    `;

    function compile(type, source, name) {
      const shader = gl.createShader(type);
      if (!shader) throw new Error(`无法创建 ${name} shader`);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader) || 'unknown shader error';
        gl.deleteShader(shader);
        throw new Error(`${name} shader 编译失败：${log}`);
      }
      return shader;
    }

    const program = gl.createProgram();
    if (!program) throw new Error('无法创建 WebGL program');
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource, 'Vertex'));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource, 'Fragment'));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Shader program 链接失败：${gl.getProgramInfoLog(program) || 'unknown link error'}`);
    }
    gl.useProgram(program);

    const vertices = new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const loc = {
      offset: gl.getUniformLocation(program, 'uOffset'),
      scale: gl.getUniformLocation(program, 'uScale'),
      z: gl.getUniformLocation(program, 'uZ'),
      color: gl.getUniformLocation(program, 'uColor'),
      discard: gl.getUniformLocation(program, 'uDiscard'),
    };

    function drawRect(q, discardValue) {
      gl.uniform2fv(loc.offset, q.o);
      gl.uniform2fv(loc.scale, q.s);
      gl.uniform1f(loc.z, q.z);
      gl.uniform4f(loc.color, q.rgb[0], q.rgb[1], q.rgb[2], q.a);
      gl.uniform1f(loc.discard, discardValue);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    return function renderWebGL() {
      const { A, B, discard } = currentScene();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.075, 0.09, 0.12, 1);
      gl.clearDepth(1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      $('blend').checked ? gl.enable(gl.BLEND) : gl.disable(gl.BLEND);
      $('depthTest').checked ? gl.enable(gl.DEPTH_TEST) : gl.disable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LESS);
      gl.depthMask($('depthWrite').checked);

      const srcConst = gl[$('srcFactor').value];
      const dstConst = gl[$('dstFactor').value];
      const eqConst = gl[$('equation').value];
      if (srcConst === undefined || dstConst === undefined || eqConst === undefined) {
        throw new Error('当前浏览器缺少所选 Blend 常量');
      }
      gl.blendFunc(srcConst, dstConst);
      gl.blendEquation(eqConst);

      if ($('order').value === 'far-near') {
        drawRect(A, discard); drawRect(B, discard);
      } else {
        drawRect(B, discard); drawRect(A, discard);
      }
      updateLabels('● WebGL2 实时渲染');
    };
  }

  // WebGL2 真失败时仍保留可交互数学模拟，避免整页黑屏。
  function createCanvasFallback(reason) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('WebGL2 与 Canvas2D 都不可用');
    status.textContent = `● Canvas fallback（${reason}）`;
    status.classList.add('fallback');

    const W = canvas.width, H = canvas.height;
    const clear = [0.075, 0.09, 0.12, 1];

    function factor(name, src, dst) {
      switch (name) {
        case 'ZERO': return [0,0,0,0];
        case 'ONE': return [1,1,1,1];
        case 'SRC_COLOR': return src;
        case 'ONE_MINUS_SRC_COLOR': return src.map(v => 1-v);
        case 'DST_COLOR': return dst;
        case 'ONE_MINUS_DST_COLOR': return dst.map(v => 1-v);
        case 'SRC_ALPHA': return [src[3],src[3],src[3],src[3]];
        case 'ONE_MINUS_SRC_ALPHA': return [1-src[3],1-src[3],1-src[3],1-src[3]];
        case 'DST_ALPHA': return [dst[3],dst[3],dst[3],dst[3]];
        case 'ONE_MINUS_DST_ALPHA': return [1-dst[3],1-dst[3],1-dst[3],1-dst[3]];
        default: return [1,1,1,1];
      }
    }

    function blendPixel(src, dst) {
      if (!$('blend').checked) return src;
      const eq = $('equation').value;
      if (eq === 'MIN') return src.map((v,i) => Math.min(v,dst[i]));
      if (eq === 'MAX') return src.map((v,i) => Math.max(v,dst[i]));
      const sf = factor($('srcFactor').value, src, dst);
      const df = factor($('dstFactor').value, src, dst);
      const S = src.map((v,i) => v*sf[i]);
      const D = dst.map((v,i) => v*df[i]);
      return S.map((v,i) => {
        const out = eq === 'FUNC_SUBTRACT' ? v-D[i] : eq === 'FUNC_REVERSE_SUBTRACT' ? D[i]-v : v+D[i];
        return Math.max(0, Math.min(1, out));
      });
    }

    function bounds(q) {
      const x0 = Math.max(0, Math.floor((q.o[0]-q.s[0]+1)*0.5*W));
      const x1 = Math.min(W, Math.ceil((q.o[0]+q.s[0]+1)*0.5*W));
      const y0 = Math.max(0, Math.floor((1-(q.o[1]+q.s[1]+1)*0.5)*H));
      const y1 = Math.min(H, Math.ceil((1-(q.o[1]-q.s[1]+1)*0.5)*H));
      return [x0,x1,y0,y1];
    }

    return function renderFallback() {
      const { A, B, discard } = currentScene();
      const image = ctx.createImageData(W,H);
      const data = image.data;
      const depth = new Float32Array(W*H); depth.fill(1);
      for (let i=0;i<W*H;i++) {
        const k=i*4; data[k]=clear[0]*255; data[k+1]=clear[1]*255; data[k+2]=clear[2]*255; data[k+3]=255;
      }
      function draw(q) {
        if (discard > 0 && q.a < discard) return;
        const [x0,x1,y0,y1]=bounds(q), src=[q.rgb[0],q.rgb[1],q.rgb[2],q.a];
        for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++) {
          const idx=y*W+x;
          if ($('depthTest').checked && !(q.z < depth[idx])) continue;
          const k=idx*4, dst=[data[k]/255,data[k+1]/255,data[k+2]/255,data[k+3]/255];
          const out=blendPixel(src,dst);
          data[k]=out[0]*255; data[k+1]=out[1]*255; data[k+2]=out[2]*255; data[k+3]=out[3]*255;
          if ($('depthTest').checked && $('depthWrite').checked) depth[idx]=q.z;
        }
      }
      if ($('order').value === 'far-near') { draw(A); draw(B); } else { draw(B); draw(A); }
      ctx.putImageData(image,0,0);
      updateLabels(status.textContent);
    };
  }

  let renderer;
  try {
    renderer = createWebGLRenderer();
  } catch (err) {
    console.error('[Blending Lab] WebGL2 init failed:', err);
    try {
      renderer = createCanvasFallback(err instanceof Error ? err.message : String(err));
    } catch (fallbackErr) {
      status.textContent = `初始化失败：${fallbackErr}`;
      status.classList.add('error');
      $('formula').textContent = '请打开浏览器开发者工具 Console 查看详细错误。';
      return;
    }
  }

  function renderSafe() {
    try {
      renderer();
    } catch (err) {
      console.error('[Blending Lab] render failed:', err);
      try {
        renderer = createCanvasFallback(err instanceof Error ? err.message : String(err));
        renderer();
      } catch (fallbackErr) {
        status.textContent = `渲染失败：${fallbackErr}`;
        status.classList.add('error');
      }
    }
  }

  document.querySelectorAll('input,select').forEach((el) => el.addEventListener('input', renderSafe));
  $('reset').addEventListener('click', () => {
    $('colorA').value = '#e5534b'; $('colorB').value = '#3fb950';
    $('alphaA').value = $('alphaB').value = '0.55';
    $('srcFactor').value = 'SRC_ALPHA'; $('dstFactor').value = 'ONE_MINUS_SRC_ALPHA';
    $('equation').value = 'FUNC_ADD'; $('order').value = 'far-near';
    $('blend').checked = $('depthTest').checked = $('depthWrite').checked = true;
    $('discard').value = '0';
    renderSafe();
  });

  renderSafe();
})();

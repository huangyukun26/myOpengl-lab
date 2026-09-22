---
title: OpenGL Lab
description: 按 LearnOpenGL 的阅读顺序推进，并把每一节放回完整渲染管线中理解。
---

# OpenGL Lab

按 **LearnOpenGL** 的章节顺序记录学习进度。每一节都对应到渲染管线中的实际位置，并配合可交互 Lab 验证相关 OpenGL 状态和数据流。

<div style="margin:1rem 0 1.25rem;">
  <iframe src="https://huangyukun26.github.io/myOpengl-lab/static/labs/pipeline-map.html" title="Advanced OpenGL 互动渲染管线地图" style="width:100%;height:780px;border:0;border-radius:16px;display:block;"></iframe>
</div>

## LearnOpenGL 学习顺序

### Advanced OpenGL

[[learn/04-advanced-opengl/03-blending|03 · Blending 混合]]  
[[learn/04-advanced-opengl/04-face-culling|04 · Face Culling 面剔除]]  
[[learn/04-advanced-opengl/05-framebuffers|05 · Framebuffers 帧缓冲]]  
[[learn/04-advanced-opengl/06-cubemaps|06 · Cubemaps 立方体贴图]]  
[[learn/04-advanced-opengl/07-advanced-data|07 · Advanced Data 高级数据]]  
[[learn/04-advanced-opengl/08-advanced-glsl|08 · Advanced GLSL 高级 GLSL]]  
[[learn/04-advanced-opengl/09-geometry-shader|09 · Geometry Shader 几何着色器]]  
[[learn/04-advanced-opengl/10-instancing|10 · Instancing 实例化]]

当前章节：**Instancing**。重点是把大量共享同一份 Mesh 的物体合并到一次实例化 Draw Call，并用 `gl_InstanceID`、Instanced Array 和 `glVertexAttribDivisor` 提供逐实例数据。

## Interactive Labs

<form action="/myOpengl-lab/static/labs/blending.html" method="get"><button type="submit">🎮 Blending Lab</button></form>
<form action="/myOpengl-lab/static/labs/face-culling.html" method="get"><button type="submit">🎮 Face Culling Lab</button></form>
<form action="/myOpengl-lab/static/labs/framebuffers.html" method="get"><button type="submit">🎮 Framebuffer Lab</button></form>
<form action="/myOpengl-lab/static/labs/cubemaps.html" method="get"><button type="submit">🎮 Cubemap / Skybox Lab</button></form>
<form action="/myOpengl-lab/static/labs/advanced-data.html" method="get"><button type="submit">🎮 Advanced Data Lab · Buffer Memory / Layout / Copy</button></form>
<form action="/myOpengl-lab/static/labs/advanced-glsl.html" method="get"><button type="submit">🎮 Advanced GLSL Lab · Built-ins / Interface / UBO</button></form>
<form action="/myOpengl-lab/static/labs/geometry-shader.html" method="get"><button type="submit">🎮 Geometry Shader Lab · Primitive In / Primitive Out</button></form>
<form action="/myOpengl-lab/static/labs/instancing.html" method="get"><button type="submit">🎮 Instancing Lab · Draw Calls / Divisor / Asteroid Belt</button></form>

## Notes

[[notes/|Notes]] 为公开笔记区；主要学习笔记保留在本地 Obsidian。

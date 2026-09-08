---
title: OpenGL Lab
description: 按 LearnOpenGL 的阅读顺序推进，并把每一节放回完整渲染管线中理解。
---

# OpenGL Lab

按 **LearnOpenGL** 的章节顺序记录学习进度。每一节都对应到渲染管线中的实际位置，并配合可交互 Lab 验证相关 OpenGL 状态和数据流。

![OpenGL Rendering Pipeline](static/rendering-pipeline.svg)

> 高亮节点表示当前章节，绿色节点表示已经完成的章节。

## LearnOpenGL 学习顺序

### Advanced OpenGL

[[learn/04-advanced-opengl/03-blending|03 · Blending 混合]]  
[[learn/04-advanced-opengl/04-face-culling|04 · Face Culling 面剔除]]  
[[learn/04-advanced-opengl/05-framebuffers|05 · Framebuffers 帧缓冲]]  
[[learn/04-advanced-opengl/06-cubemaps|06 · Cubemaps 立方体贴图]]  
[[learn/04-advanced-opengl/07-advanced-data|07 · Advanced Data 高级数据]]

当前章节：**Advanced Data**。重点转到 Vertex Data 进入 Vertex Shader 之前的 Buffer 内存管理：分配、局部更新、属性布局和 Buffer 之间的复制。

## Interactive Labs

<form action="/myOpengl-lab/static/labs/blending.html" method="get">
  <button type="submit">🎮 Blending Lab</button>
</form>

<form action="/myOpengl-lab/static/labs/face-culling.html" method="get">
  <button type="submit">🎮 Face Culling Lab</button>
</form>

<form action="/myOpengl-lab/static/labs/framebuffers.html" method="get">
  <button type="submit">🎮 Framebuffer Lab</button>
</form>

<form action="/myOpengl-lab/static/labs/cubemaps.html" method="get">
  <button type="submit">🎮 Cubemap / Skybox Lab</button>
</form>

<form action="/myOpengl-lab/static/labs/advanced-data.html" method="get">
  <button type="submit">🎮 Advanced Data Lab · Buffer Memory / Layout / Copy</button>
</form>

## Notes

[[notes/|Notes]] 为公开笔记区；主要学习笔记保留在本地 Obsidian。

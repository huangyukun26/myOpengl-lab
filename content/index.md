---
title: OpenGL Lab
description: 按 LearnOpenGL 的阅读顺序推进，同时用渲染管线地图建立整体心智模型。
---

# OpenGL Lab

按 **LearnOpenGL 的文章顺序**继续学，但每学完一节，都把它放回完整渲染管线里：**它在哪 → 核心状态/API → GPU 在做什么 → 交互实验 → 工程延伸**。

![OpenGL Rendering Pipeline](static/rendering-pipeline.svg)

> 这张图是学习用的简化管线。高亮节点表示已经有对应交互章节；以后每学完一节继续扩展，而不是把 LearnOpenGL 原文重新抄一遍。

## LearnOpenGL 学习顺序

### Advanced OpenGL

[[learn/04-advanced-opengl/03-blending|03 · Blending 混合]]  
[[learn/04-advanced-opengl/04-face-culling|04 · Face Culling 面剔除]]

当前新增：`winding order`、`glFrontFace`、`glCullFace`，以及 Face Culling 在 **Rasterization 之前**如何整块丢掉三角形。

## Interactive Labs

<form action="/myOpengl-lab/static/labs/blending.html" method="get">
  <button type="submit">🎮 Blending Lab</button>
</form>

<form action="/myOpengl-lab/static/labs/face-culling.html" method="get">
  <button type="submit">🎮 Face Culling Lab · 官方 cube / marble</button>
</form>

每个 Lab 都尽量直接映射 OpenGL 状态机，而不是只做动画示意。独立 WebGL 页面采用完整页面加载，避免 Quartz SPA 干扰 WebGL 初始化。

## Notes

[[notes/|Notes]] 是可选公开区。默认保持空白；你的主要笔记继续留在本地 Obsidian，需要公开哪一篇时再单独加。

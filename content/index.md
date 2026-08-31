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

当前重点：`src / dst`、Alpha blending、透明排序、Depth Test 与 Depth Write 的关系。

## Interactive Labs

<form action="/myOpengl-lab/static/labs/blending.html" method="get">
  <button type="submit">🎮 打开 Blending Lab</button>
</form>

这里是真实 WebGL2 状态机。可以直接改 Blend Factor、Alpha、Draw Order、Depth Test、Depth Write 和 discard 阈值，观察 framebuffer 如何变化。

## Notes

[[notes/|Notes]] 是可选公开区。默认保持空白；你的主要笔记继续留在本地 Obsidian，需要公开哪一篇时再单独加。

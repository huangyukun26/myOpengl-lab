---
title: 04 · Face Culling 面剔除
description: 在光栅化之前，根据三角形的屏幕环绕顺序直接丢弃不需要的面。
tags:
  - OpenGL
  - Advanced-OpenGL
  - Face-Culling
---

# Face Culling 面剔除

**LearnOpenGL 顺序：Advanced OpenGL → Face Culling**  ·  [原教程](https://learnopengl-cn.github.io/04%20Advanced%20OpenGL/04%20Face%20culling/)

## 在管线哪里

`Vertex Shader → Primitive Assembly → Face Culling → Rasterization → Fragment Shader`

这一节最值得记的不是 API，而是：**整个三角形在产生 fragments 之前就能被丢掉。** 所以封闭物体的背面如果本来就看不见，没必要让它们进入光栅化和 Fragment Shader。

## 核心代码

```cpp
glEnable(GL_CULL_FACE);
glCullFace(GL_BACK);   // 丢谁
glFrontFace(GL_CCW);  // 谁叫“正面”
```

把两个 API 分开想就不容易乱：`glFrontFace` **定义正面**，`glCullFace` **决定剔除哪一类面**。默认 `CCW = front`，默认剔除 `back`。

环绕顺序也不是在建模时死死写死的“标签”。OpenGL 是在顶点变换之后，从当前观察方向看到的屏幕环绕顺序来判断 front/back；所以同一个闭合立方体，朝向你的外表面与背向你的外表面会自然得到相反的屏幕 winding。

## Interactive Lab

<form action="/myOpengl-lab/static/labs/face-culling.html" method="get">
  <button type="submit">🎮 打开 Face Culling Lab</button>
</form>

Lab 使用 LearnOpenGL 官方练习里的 **CW 立方体顶点数据**，并直接加载官方仓库的 `marble.jpg`。建议先保持 `CCW + GL_BACK`，然后只改 `glFrontFace(GL_CW)`；接着再把顶点数据切到官方练习的 CW 版本，看画面如何恢复。

## 一个容易忽略的工程坑

如果模型做了镜像变换，例如 `scale(-1, 1, 1)`，三角形 winding 会翻转。此时“模型突然被剔没了”不一定是法线错了，而可能是 front-face 定义和变换后的 winding 对不上。

另外，草片、纸张、布片这类**需要双面可见**的几何体通常不应该直接开背面剔除；阴影 pass 里也常会故意换成 front-face culling 来减轻某些 shadow acne 问题。

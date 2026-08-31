---
title: 03 · Blending 混合
description: Fragment Shader 输出之后，颜色写入 framebuffer 之前的合成阶段。
tags:
  - OpenGL
  - Advanced-OpenGL
  - Blending
---

# Blending 混合

**LearnOpenGL 顺序：Advanced OpenGL → Blending**

## 在管线哪里

`Fragment Shader → per-sample operations → Blending → Color Buffer`

这里最重要的两个名字：**src** 是这一次 Fragment Shader 刚算出来、准备写入的颜色；**dst** 是同一像素位置在 framebuffer 里已经存在的颜色。

## 核心代码

```cpp
glEnable(GL_BLEND);
glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
```

经典 Alpha Blending：

`Cout = Csrc × αsrc + Cdst × (1 - αsrc)`

透明物体常见流程：

```cpp
glEnable(GL_DEPTH_TEST);
glDepthMask(GL_FALSE);

sortBackToFront(transparentObjects);
renderTransparent();

glDepthMask(GL_TRUE);
```

这里不是关闭深度。**Depth Test 仍然读取 depth buffer 判断遮挡，只是透明物体通常不写入 depth buffer。**

## Interactive Lab

<a href="/myOpengl-lab/static/labs/blending.html" data-router-ignore>打开 Blending Lab</a>

推荐按这个顺序玩：先改变 Alpha；再把绘制顺序切成 Near → Far；最后切换 Depth Write。观察某个 fragment 究竟是死在 Depth Test，还是成功进入 Blending。

## `discard` 与 blending

`discard` 解决“这个 fragment 存不存在”；Blending 解决“这个 fragment 已经存在，它与 framebuffer 原颜色如何合成”。草、铁丝网这类 cutout 常用 alpha + `discard`；玻璃、烟雾才是典型半透明 blending。

## 往外长的知识

先保留三个接口：**Premultiplied Alpha、Linear-space Blending、Order Independent Transparency (OIT)**。以后做 UI、粒子、玻璃、毛发时会重新遇到。

---
title: 11 · Anti Aliasing 抗锯齿
description: 从像素采样理解锯齿为什么出现，以及 MSAA 如何用多个子采样点改善图元边缘，并完成离屏多重采样与 Resolve。
tags:
  - OpenGL
  - Advanced-OpenGL
  - Anti-Aliasing
  - MSAA
---

# Anti Aliasing 抗锯齿

**LearnOpenGL 顺序：Advanced OpenGL → Anti Aliasing** · [原教程](https://learnopengl-cn.github.io/04%20Advanced%20OpenGL/11%20Anti%20Aliasing/)

## 这一节在渲染管线中的位置

<iframe src="https://huangyukun26.github.io/myOpengl-lab/static/labs/pipeline/11-anti-aliasing.html" title="OpenGL anti aliasing pipeline" style="width:100%;height:540px;border:0;border-radius:16px;display:block;"></iframe>

抗锯齿最核心的问题发生在 **Rasterization**：连续的三角形最终必须落到离散的像素网格里。普通单采样通常用像素里的一个采样点判断图元是否覆盖该像素，边缘于是只能表现成“这个像素算 / 不算”的阶梯形状。

~~~text
连续几何边缘
      ↓
Rasterization
      ↓
有限的像素采样点
      ↓
有的像素被覆盖，有的没被覆盖
      ↓
锯齿
~~~

## MSAA 改的不是几何，而是覆盖率

MSAA（Multisample Anti-Aliasing）把一个像素里的单个采样点变成多个子采样点。以 4x MSAA 为例，一个边缘像素可能只覆盖 4 个子采样点中的 2 个，因此最终 Resolve 后，这个像素不会是纯前景色，也不会是纯背景色，而会得到更接近“覆盖了一半”的结果。

~~~text
1x sampling               4x MSAA

┌─────────┐               ┌─────────┐
│    •    │               │  •   •  │
│   /     │               │   /     │
│  /      │               │  •   •  │
└─────────┘               └─────────┘

只问中心点是否在图元内        能估计这个像素被覆盖了多少
~~~

这就是为什么 MSAA 主要改善的是**几何边缘**。它不是简单把 Fragment Shader 跑 4 次；实际实现还涉及 sample coverage、逐样本深度/模板以及颜色样本的存储。

桌面 OpenGL 中，默认窗口的 MSAA 通常从创建窗口时申请：

~~~cpp
glfwWindowHint(GLFW_SAMPLES, 4);
...
glEnable(GL_MULTISAMPLE);
~~~

## 离屏 MSAA：为什么还要 Resolve

如果直接渲染到默认 framebuffer，窗口系统可以帮我们处理多重采样。但一旦自己使用 FBO，就要自己准备 multisample attachment。

~~~text
Scene
  ↓
Multisampled FBO
每个像素保存多个 color/depth samples
  ↓
Resolve / Blit
  ↓
普通单采样 Texture
  ↓
Post Processing / Screen Quad
~~~

官方离屏示例使用多重采样颜色附件和深度模板 Renderbuffer，然后通过 glBlitFramebuffer 把 multisampled framebuffer Resolve 到普通 framebuffer。这个步骤不是“再渲染一次场景”，而是把多个 samples 合成为普通单采样图像，后面才能像普通纹理一样继续后处理。

~~~cpp
glBindFramebuffer(GL_READ_FRAMEBUFFER, multisampledFBO);
glBindFramebuffer(GL_DRAW_FRAMEBUFFER, intermediateFBO);

glBlitFramebuffer(
    0, 0, width, height,
    0, 0, width, height,
    GL_COLOR_BUFFER_BIT,
    GL_NEAREST
);
~~~

## Interactive Lab

<form action="/myOpengl-lab/static/labs/anti-aliasing.html" method="get">
  <button type="submit">🎮 打开 Anti Aliasing Lab · 1x / 4x MSAA / Resolve</button>
</form>

Lab 使用 WebGL2 真正创建两套离屏目标：左边是单采样 framebuffer，右边是 multisample renderbuffer，再通过 blitFramebuffer Resolve 到普通纹理。把画面放大观察斜边，会比只看概念图更容易理解 MSAA 到底改变了什么。

## 和 Framebuffer 一节连起来

Framebuffer 一节解决的是：

~~~text
“这一遍渲染写到哪里？”
~~~

Anti Aliasing 在此基础上多问了一层：

~~~text
“这个 framebuffer 的每个像素只有一个 sample，
还是保存多个 samples？”
~~~

所以离屏 MSAA 可以记成：

> **普通 FBO 存一个像素结果；Multisampled FBO 先存多个 samples，Resolve 后才得到最终单像素结果。**

最终数据流：

~~~text
Geometry
  ↓
Rasterization + Coverage
  ↓
Multisample Color / Depth
  ↓
Resolve
  ↓
Normal Texture / Screen
~~~

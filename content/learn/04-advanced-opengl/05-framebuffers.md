---
title: 05 · Framebuffers 帧缓冲
description: 把最终片段写入自定义附件，获得可再次采样的离屏渲染结果，并由此进入多 Pass 与后期处理。
tags:
  - OpenGL
  - Advanced-OpenGL
  - Framebuffer
  - Post-Processing
---

# Framebuffers 帧缓冲

**LearnOpenGL 顺序：Advanced OpenGL → Framebuffers** · [原教程](https://learnopengl-cn.github.io/04%20Advanced%20OpenGL/05%20Framebuffers/)

## 在管线哪里

`... → Fragment Shader → Depth / Stencil / Blending → 当前绑定的 Framebuffer attachments`

这里要修正一个常见心智模型：**Framebuffer 更像“这一遍渲染要写到哪里”，而不是一个像 Fragment Shader 那样的计算阶段。** 默认情况下我们写进窗口系统提供的默认 framebuffer；绑定自己的 FBO 后，同样的绘制命令会改写你挂在它上面的 color / depth / stencil attachments。

FBO 本身更像“附件集合与状态对象”，真正保存像素的是附件：

```text
Framebuffer Object
├─ GL_COLOR_ATTACHMENT0        → Texture
└─ GL_DEPTH_STENCIL_ATTACHMENT → Renderbuffer
```

## 核心代码

```cpp
unsigned int framebuffer;
glGenFramebuffers(1, &framebuffer);
glBindFramebuffer(GL_FRAMEBUFFER, framebuffer);

// color attachment：之后要采样，所以用 texture
glFramebufferTexture2D(
    GL_FRAMEBUFFER,
    GL_COLOR_ATTACHMENT0,
    GL_TEXTURE_2D,
    textureColorbuffer,
    0
);

// depth/stencil：这里只做测试，不采样，所以用 renderbuffer
glFramebufferRenderbuffer(
    GL_FRAMEBUFFER,
    GL_DEPTH_STENCIL_ATTACHMENT,
    GL_RENDERBUFFER,
    rbo
);

if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
    // debug attachments

// 0 = 默认 framebuffer
glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

最实用的选择规则：**之后要在 shader 里采样 → texture attachment；只需要拿来做 depth/stencil test → renderbuffer 通常更合适。**

## 两遍渲染是这一节的核心

```cpp
// Pass 1：场景 → 自定义 FBO 的 color texture
glBindFramebuffer(GL_FRAMEBUFFER, framebuffer);
glEnable(GL_DEPTH_TEST);
DrawScene();

// Pass 2：color texture → 默认 framebuffer
glBindFramebuffer(GL_FRAMEBUFFER, 0);
glDisable(GL_DEPTH_TEST);
glBindTexture(GL_TEXTURE_2D, textureColorbuffer);
DrawFullscreenQuad();
```

第一遍结束之后，**“整张已经渲染好的场景”变成了一张纹理**。第二遍 fragment shader 因此可以对最终图像逐像素做反相、灰度、锐化、模糊、边缘检测等后期处理。

## Interactive Lab

<form action="/myOpengl-lab/static/labs/framebuffers.html" method="get">
  <button type="submit">🎮 打开 Framebuffer Lab · 官方 container / metal 场景</button>
</form>

推荐先切换 `None → Inversion`，确认“场景已经变成一张可采样纹理”；再关闭 Depth/Stencil Attachment，看 off-screen pass 的深度关系如何出错；最后把 color attachment 分辨率改成 `0.25×`，观察为什么附件尺寸变化后 `glViewport` 也必须跟着改。

## 这节最容易踩的坑

- 绑定了 custom FBO 后忘了 `glBindFramebuffer(GL_FRAMEBUFFER, 0)`，结果窗口里什么都没有。
- 自定义 FBO 没有 depth attachment，却以为 `GL_DEPTH_TEST` 会自动借用默认 framebuffer 的深度缓冲；**每个 framebuffer 有自己的一套 attachments。**
- FBO texture 尺寸和 viewport 不一致，导致只渲染到附件的一部分或比例不对。
- 窗口 resize 后只改了 `glViewport`，却忘了重建/resize framebuffer attachments。
- 忘记 `glCheckFramebufferStatus`，导致附件配置错误时只能对着黑屏猜。

## 往外长的知识

Framebuffer 是后面很多技术的共同基础：**Shadow Map、Mirror / Portal、Picking、HDR、Bloom、Ping-Pong Blur、Deferred Rendering / G-Buffer、SSAO、MSAA resolve、各种屏幕空间效果。**

从这一节开始，可以把渲染理解成：不是“从顶点一路画到屏幕就结束”，而是可以把一遍渲染结果保存下来，作为下一遍渲染的输入。

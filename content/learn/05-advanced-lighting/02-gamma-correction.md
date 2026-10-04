---
title: 02 · Gamma Correction Gamma 校正
description: 在线性空间中做光照计算，在最终显示前转换到 sRGB；同时处理 sRGB 纹理输入与物理衰减。
tags:
  - OpenGL
  - Advanced-Lighting
  - Gamma-Correction
  - sRGB
---

# Gamma Correction

**LearnOpenGL 顺序：Advanced Lighting → Gamma Correction** · [原文](https://learnopengl.com/Advanced-Lighting/Gamma-Correction%2B) · [中文翻译](https://learnopengl-cn.github.io/05%20Advanced%20Lighting/02%20Gamma%20Correction/)

中文页明确提示这一节尚未完全重写，建议对照英文原文阅读。本页按英文原文的结构整理，并结合官方源码说明输入纹理、光照计算和最终显示之间的空间转换。

## 这一节在渲染管线中的位置

<iframe src="https://huangyukun26.github.io/myOpengl-lab/static/labs/pipeline/al-02-gamma-correction.html" title="Gamma Correction pipeline" style="width:100%;height:560px;border:0;border-radius:16px;display:block;"></iframe>

Gamma 校正处理的是两个边界：

~~~text
sRGB 纹理
   ↓ decode
Linear
   ↓
Lighting / Blending / Attenuation
   ↓
Linear final color
   ↓ encode
sRGB framebuffer / monitor
~~~

中间计算保持在线性空间。非线性编码只出现在输入和最终输出的边界。

## 为什么 0.5 不是“半亮”

如果把一个线性亮度值直接交给近似 gamma 2.2 的显示系统，显示亮度可以近似写成：

~~~text
display = input^2.2
~~~

线性值 0.5 最终大约变成：

~~~text
0.5^2.2 ≈ 0.218
~~~

所以在线性光照里算出的“50% 能量”，直接显示会显得太暗。

在输出前做逆变换：

~~~text
encoded = linear^(1 / 2.2)
~~~

对于 0.5：

~~~text
0.5^(1/2.2) ≈ 0.73
~~~

显示端再经过约 2.2 的响应后：

~~~text
0.73^2.2 ≈ 0.5
~~~

这就是输出端 Gamma Correction 的基本关系。实际 sRGB 不是一条纯粹的 2.2 幂函数，但 LearnOpenGL 这里用 2.2 近似来建立概念。

## 光照计算为什么必须保持线性

光照公式默认把颜色值当成可线性相加、相乘的量：

~~~text
0.2 + 0.2 = 0.4
0.5 × 2 = 1.0
~~~

如果参与计算的值已经处在 sRGB 这种非线性编码空间里，同样的加法和乘法就不再对应真实光能关系。

因此流程不能写成：

~~~text
Linear
↓ Gamma encode
↓ 再做 lighting / blending
~~~

而应该是：

~~~text
Linear inputs
↓
Lighting
↓
Blending
↓
Post process
↓
最后一步 Gamma / sRGB encode
~~~

如果使用多个 framebuffer，中间 framebuffer 通常继续保存线性结果；只在最终输出到显示目标时做转换。

## 纹理也有空间问题

颜色纹理通常是按“看起来正确”的方式制作和保存的，因此常见 albedo / diffuse 纹理本身就是 sRGB 编码。

如果直接把这种纹理值拿进线性光照公式，就相当于把非线性数据当线性数据使用。

OpenGL 可以通过 sRGB internal format 在采样时自动解码：

~~~cpp
GL_SRGB
GL_SRGB_ALPHA
~~~

官方源码的逻辑是：

~~~cpp
internalFormat =
    gammaCorrection ? GL_SRGB : GL_RGB;
~~~

数据上传格式仍然是：

~~~cpp
dataFormat = GL_RGB;
~~~

文件里的字节没变，改变的是 GPU 对纹理数据的解释方式：使用 GL_SRGB 后，采样结果进入 shader 前会转换到线性空间。

并不是所有纹理都应该使用 sRGB。Normal、roughness、metallic、depth 这类“数据纹理”不表示显示颜色，应继续按线性数据读取。

## 输出端的两种做法

OpenGL 可以让 framebuffer 自动做线性到 sRGB 的转换：

~~~cpp
glEnable(GL_FRAMEBUFFER_SRGB);
~~~

也可以在最终 Fragment Shader 手动做：

~~~glsl
color = pow(color, vec3(1.0 / 2.2));
~~~

两种方法解决的是同一类边界问题：最终写入显示目标之前，把线性颜色编码成显示用的非线性颜色。

关键不是选哪一个 API，而是不要重复编码，也不要在中间计算阶段提前编码。

## Gamma 和光照衰减

官方示例同时切换了衰减公式：

~~~glsl
float attenuation =
    1.0 / (gamma ? distance * distance : distance);
~~~

原因不是 Gamma Correction 要求必须使用平方衰减，而是正确的线性工作流让物理上更合理的：

~~~text
1 / distance²
~~~

重新表现正常。

如果不做 Gamma Correction，显示端的非线性响应会让平方衰减看起来过快，于是旧代码常常会用：

~~~text
1 / distance
~~~

来补偿视觉效果。一旦整个流程回到线性空间，平方衰减就更符合预期。

## Official demo 对应关系

JoeyDeVries 的示例同时准备两张来自同一文件的纹理：

~~~cpp
floorTexture               // GL_RGB
floorTextureGammaCorrected // GL_SRGB
~~~

开启 Gamma 后使用 sRGB 版本，并在 Fragment Shader 末尾执行：

~~~glsl
if(gamma)
    color = pow(color, vec3(1.0/2.2));
~~~

同时把衰减从 1/distance 切换到 1/distance²。这个 Demo 比较的是完整的线性工作流，而不是单独一个 pow()。

## Interactive Lab

<form action="/myOpengl-lab/static/labs/gamma-correction.html" method="get">
  <button type="submit">🎮 Gamma Correction Lab · Linear / sRGB / Attenuation</button>
</form>

Lab 分为三个视图：灰阶编码、光照衰减、纹理输入。三个视图使用同一组转换关系，分别观察输出编码、线性光照和 sRGB 纹理解码对结果的影响。

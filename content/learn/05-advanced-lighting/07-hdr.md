---
title: 07 · HDR
description: 用浮点颜色缓冲保留大于 1.0 的线性光照结果，再通过 Tone Mapping 与 Exposure 映射到显示范围。
tags: [OpenGL, Advanced-Lighting, HDR, Tone-Mapping, Framebuffer]
---

# HDR

前面的光照已经允许很亮的光源，例如光源颜色达到 200。问题不在光照公式，而在最终保存颜色的地方。

普通颜色缓冲通常只保存 0 到 1。假设 Fragment Shader 算出：

~~~text
(4.0, 2.0, 0.5)
↓ 普通 LDR 颜色缓冲
(1.0, 1.0, 0.5)
~~~

4.0 和 2.0 原本代表不同亮度，但过早截断后都变成了 1.0。

HDR 的关键不是让屏幕直接显示 4.0，而是：

> 在最终显示之前，先用浮点颜色缓冲把真实的高亮度差异保存下来。

## 两遍渲染

LearnOpenGL 的 HDR 流程：

~~~text
Pass 1
Scene Lighting
↓
RGBA16F HDR Framebuffer
↓
保存超过 1.0 的线性颜色

Pass 2
HDR Color Buffer
↓
Tone Mapping
↓
Gamma Correction
↓
默认 Framebuffer
~~~

第一遍不急着压缩亮度。第二遍才决定大范围亮度如何映射到屏幕。

## 浮点颜色缓冲

官方创建颜色附件：

~~~cpp
glTexImage2D(
    GL_TEXTURE_2D,
    0,
    GL_RGBA16F,
    SCR_WIDTH,
    SCR_HEIGHT,
    0,
    GL_RGBA,
    GL_FLOAT,
    NULL
);
~~~

GL_RGBA16F 允许颜色附件保存 1.7、12.0 等超过 1.0 的中间结果，而不是写入时立刻截断。

这里的 HDR 是渲染管线内部的高动态范围，并不等于已经向 HDR 显示器输出 HDR 信号。

## Pass 1：保留真实线性光照

官方隧道场景使用一个很强的白色光源：

~~~cpp
lightColors.push_back(
    glm::vec3(200.0f)
);
~~~

并继续使用平方反比衰减：

~~~glsl
float distance =
    length(
        fs_in.FragPos
        - lights[i].Position
    );

result *=
    1.0 /
    (distance * distance);
~~~

靠近强光的位置可以得到 20、10、3 等值。这些结果先进入 HDR FBO。

## Tone Mapping

第二遍读取 HDR Color Buffer：

~~~glsl
vec3 hdrColor =
    texture(
        hdrBuffer,
        TexCoords
    ).rgb;
~~~

然后把高动态范围压到可显示范围。

Reinhard：

~~~glsl
vec3 result =
    hdrColor /
    (hdrColor + vec3(1.0));
~~~

例如：

~~~text
0.5 → 0.33
1.0 → 0.50
2.0 → 0.67
10  → 0.91
100 → 0.99
~~~

它不会把所有大于 1 的值都变成同一个白色，而是保留高亮之间的相对差异。

LearnOpenGL 最终使用 Exposure Tone Mapping：

~~~glsl
vec3 result =
    vec3(1.0)
    - exp(
        -hdrColor * exposure
    );
~~~

exposure 小，画面更暗、高光细节保留更多；exposure 大，暗部更亮、高光更快接近白色。

Exposure 改的是 HDR 到屏幕的映射，不会重新计算场景光照。

## Gamma Correction 的位置

Tone Mapping 应处理线性颜色，因此顺序是：

~~~text
Linear Lighting
↓
HDR Float Buffer
↓
Tone Mapping
↓
[0,1] Linear Color
↓
Gamma Encode
↓
Display
~~~

官方随后执行：

~~~glsl
result =
    pow(
        result,
        vec3(1.0 / 2.2)
    );
~~~

这与前面的 Gamma Correction 章节直接连接。

## 官方 HDR Shader

~~~glsl
#version 330 core
out vec4 FragColor;

in vec2 TexCoords;

uniform sampler2D hdrBuffer;
uniform bool hdr;
uniform float exposure;

void main()
{
    const float gamma = 2.2;

    vec3 hdrColor =
        texture(
            hdrBuffer,
            TexCoords
        ).rgb;

    if(hdr)
    {
        vec3 result =
            vec3(1.0)
            - exp(
                -hdrColor * exposure
            );

        result =
            pow(
                result,
                vec3(1.0 / gamma)
            );

        FragColor =
            vec4(result, 1.0);
    }
    else
    {
        vec3 result =
            pow(
                hdrColor,
                vec3(1.0 / gamma)
            );

        FragColor =
            vec4(result, 1.0);
    }
}
~~~

关闭 HDR 时，官方不是重新用 LDR FBO 计算光照，而是跳过 Tone Mapping。超过 1.0 的值最后写入默认 framebuffer 时仍会被截断，因此高光容易变成一大片白。

## FBO 数据流

CPU 创建：

~~~text
hdrFBO
├─ Color Attachment: RGBA16F texture
└─ Depth Attachment: renderbuffer
~~~

第一遍：

~~~cpp
glBindFramebuffer(
    GL_FRAMEBUFFER,
    hdrFBO
);

// render scene
~~~

第二遍：

~~~cpp
glBindFramebuffer(
    GL_FRAMEBUFFER,
    0
);

glBindTexture(
    GL_TEXTURE_2D,
    colorBuffer
);

renderQuad();
~~~

这与 Framebuffer 章节是同一机制：先离屏渲染，再把结果当纹理处理。HDR 只是把中间颜色附件升级成浮点格式，并在第二遍加入 Tone Mapping。

## Clamp 和 Tone Mapping 的区别

假设两个高亮像素：

~~~text
A = 2.0
B = 20.0
~~~

普通 Clamp：

~~~text
A → 1.0
B → 1.0
~~~

差异完全丢失。

Tone Mapping：

~~~text
A → 很亮
B → 更接近白
~~~

高亮关系仍然存在。

所以 HDR 保存的不是“最终屏幕颜色”，而是 Tone Mapping 之前仍然有意义的亮度信息。

## Light Intensity 和 Exposure

~~~text
Light Intensity
→ 改变 Pass 1 算出来的真实线性光照值

Exposure
→ 改变 Pass 2 如何显示这些已经存在的 HDR 值
~~~

例如 HDR Buffer 已经保存 (8,4,1)，调 Exposure 不会改变这个缓冲里的值，只改变它映射到屏幕后的结果。

## 和前面章节的连接

~~~text
Gamma Correction
→ 线性空间计算，最后再编码

Framebuffers
→ 离屏渲染结果可以成为纹理

HDR
→ 浮点颜色附件保存 >1 的线性亮度
→ Tone Mapping 压缩动态范围
~~~

完整流程：

~~~text
sRGB Diffuse
↓ decode
Linear Lighting
↓
RGBA16F HDR FBO
↓
Tone Mapping / Exposure
↓
Gamma Encode
↓
Default Framebuffer
~~~

## Interactive Lab

<form action="/myOpengl-lab/static/labs/hdr.html" method="get">
  <button type="submit">🎮 HDR Lab · LDR Clamp / Float Buffer / Exposure</button>
</form>

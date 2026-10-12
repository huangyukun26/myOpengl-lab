---
title: 08 · Bloom 泛光
description: 从 HDR 亮度中提取高亮区域，进行高斯模糊，再与原始场景叠加形成光晕。
tags: [OpenGL, Advanced-Lighting, Bloom, HDR, Gaussian-Blur, MRT]
---

# Bloom 泛光

Bloom 的目标不是把整张图变亮，而是让“非常亮的像素”向周围扩散，形成柔和光晕。

~~~text
HDR Scene
↓
提取 Bright Pixels
↓
Gaussian Blur
↓
加回原始 HDR Scene
↓
Tone Mapping
↓
Gamma
↓
Screen
~~~

HDR 先负责保存 1.0 以上的亮度；Bloom 再利用这些高亮数据。没有 HDR，2、5、20 这类亮度会过早被截成 1，Bloom 就很难区分真正强光和普通白色。

## Bright Pass：只留下高亮

LearnOpenGL 使用 Multiple Render Targets，一次 Fragment Shader 输出两张颜色附件：

~~~glsl
layout (location = 0) out vec4 FragColor;
layout (location = 1) out vec4 BrightColor;
~~~

完整场景写入 FragColor，高亮区域写入 BrightColor。

官方亮度判断：

~~~glsl
float brightness =
    dot(
        result,
        vec3(0.2126, 0.7152, 0.0722)
    );

if(brightness > 1.0)
    BrightColor = vec4(result, 1.0);
else
    BrightColor = vec4(0.0, 0.0, 0.0, 1.0);
~~~

结果：

~~~text
Attachment 0 → 完整 HDR Scene
Attachment 1 → Bright Texture
~~~

亮度使用人眼感知权重，绿色贡献最高。

## 为什么不能直接模糊整张图

如果直接 Blur Scene：

~~~text
墙、地板、暗部、纹理、高光
全部一起扩散
~~~

画面会整体变糊。

Bloom 只想让强光向周围“泄露”，所以先 Threshold，得到只有亮区的 Bright Texture，再模糊它。

## Gaussian Blur

官方用高斯权重：

~~~glsl
float weight[5] = float[](
    0.2270270270,
    0.1945945946,
    0.1216216216,
    0.0540540541,
    0.0162162162
);
~~~

中心权重最大，越远越小，所以高亮会形成柔和衰减。

一个 Texel 的 UV 尺寸：

~~~glsl
vec2 tex_offset =
    1.0 / textureSize(image, 0);
~~~

横向 Blur：

~~~text
← ← 当前像素 → →
~~~

纵向 Blur：

~~~text
    ↑
    ↑
当前像素
    ↓
    ↓
~~~

Gaussian Blur 可以拆成 Horizontal + Vertical，比直接做二维大核采样便宜很多。

## Ping-Pong Framebuffer

Blur 需要连续多轮处理，官方创建两个 FBO 和两张颜色纹理：

~~~text
Bright Texture
↓ Horizontal
PingPong 0
↓ Vertical
PingPong 1
↓ Horizontal
PingPong 0
↓ Vertical
PingPong 1
...
~~~

上一轮输出成为下一轮输入，两张纹理来回交换，这就是 Ping-Pong。

它避免“读写同一张纹理”的冲突，也方便连续后处理。

## 最终合成

模糊完成后：

~~~text
scene
→ 原始 HDR 场景

bloomBlur
→ 模糊后的亮区
~~~

官方最终：

~~~glsl
vec3 hdrColor =
    texture(scene, TexCoords).rgb;

vec3 bloomColor =
    texture(bloomBlur, TexCoords).rgb;

if(bloom)
    hdrColor += bloomColor;
~~~

也就是：

~~~text
Scene HDR
+
Blurred Bright Texture
=
带光晕的 HDR Scene
~~~

然后才进行：

~~~glsl
vec3 result =
    vec3(1.0) -
    exp(-hdrColor * exposure);

result =
    pow(
        result,
        vec3(1.0 / 2.2)
    );
~~~

顺序非常重要：

~~~text
Lighting
↓
HDR
↓
Bright Pass
↓
Blur
↓
Composite
↓
Tone Mapping
↓
Gamma
~~~

Bloom 在 Tone Mapping 之前完成，因为这时仍保留真实 HDR 亮度关系。

## Threshold 的意义

阈值越高：

~~~text
只有极亮区域参与 Bloom
~~~

阈值越低：

~~~text
更多区域被当成发光区域
~~~

太低会导致整张画面泛白、发灰。

官方示例固定使用 brightness > 1.0；实际引擎通常把 Threshold 做成可调参数。

## Bloom 强度

官方直接相加：

~~~glsl
hdrColor += bloomColor;
~~~

实际项目常写成：

~~~glsl
hdrColor +=
    bloomColor * bloomStrength;
~~~

这样可以单独控制光晕强弱。

## 完整数据流

~~~text
Pass 1 · HDR Scene + Bright Pass

Scene Lighting
↓
HDR FBO / MRT
├─ Color 0 → Scene HDR
└─ Color 1 → Bright Texture


Pass 2 · Blur

Bright Texture
↓
Horizontal Gaussian Blur
↓
Vertical Gaussian Blur
↓
多轮 Ping-Pong
↓
Blurred Bright Texture


Pass 3 · Composite

Scene HDR
+
Blurred Bright Texture
↓
Tone Mapping
↓
Gamma
↓
Screen
~~~

Bloom 不是“发光材质”本身。它只是一个后处理：只要某个像素足够亮，就可能产生 Bloom。

## Interactive Lab

<form action="/myOpengl-lab/static/labs/bloom.html" method="get">
  <button type="submit">🎮 Bloom Lab · Threshold / Blur / Composite</button>
</form>

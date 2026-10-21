---
title: 09 · Deferred Shading 延迟着色法
description: 先把位置、法线、材质写入 G-Buffer，再在屏幕空间统一计算大量光源。
tags: [OpenGL, Advanced-Lighting, Deferred-Shading, G-Buffer, MRT]
---

# Deferred Shading 延迟着色法

Forward Rendering 的流程是：

~~~text
Geometry
↓
Fragment
↓
Lighting
↓
最终颜色
~~~

也就是说，每个物体的 Fragment Shader 直接把光照算完。光源很多时，大量 Fragment 会反复执行同一套光照循环。

Deferred Shading 把过程拆开：

~~~text
Geometry Pass
↓
先保存“之后算光需要的数据”

Lighting Pass
↓
再统一读取这些数据计算光照
~~~

“Deferred”指的就是：**把光照计算延后到第二个 Pass。**

## 核心变化

Forward：

~~~text
Position / Normal / Material
↓
立刻遍历 Lights
↓
Color
~~~

Deferred：

~~~text
Position / Normal / Material
↓
G-Buffer
↓
之后统一遍历 Lights
↓
Color
~~~

光照公式没有换，改变的是**执行时机和数据组织方式**。

## G-Buffer

G-Buffer 是一组屏幕大小的纹理，记录最终可见表面的几何和材质信息。

LearnOpenGL 官方使用：

~~~text
gPosition
→ World-space Fragment Position

gNormal
→ World-space Normal

gAlbedoSpec.rgb
→ Diffuse / Albedo

gAlbedoSpec.a
→ Specular intensity
~~~

一个屏幕像素在 Geometry Pass 后已经记录了：

~~~text
它在哪里
它朝哪里
它是什么颜色
它有多少镜面反射
~~~

## Geometry Pass

官方 Fragment Shader 一次输出三个颜色附件：

~~~glsl
layout (location = 0) out vec3 gPosition;
layout (location = 1) out vec3 gNormal;
layout (location = 2) out vec4 gAlbedoSpec;
~~~

写入：

~~~glsl
gPosition = FragPos;
gNormal = normalize(Normal);

gAlbedoSpec.rgb =
    texture(texture_diffuse1, TexCoords).rgb;

gAlbedoSpec.a =
    texture(texture_specular1, TexCoords).r;
~~~

这里**不计算光照**。

因此：

~~~text
Geometry Pass
= 把后续光照需要的数据先收集起来
~~~

## MRT 和 FBO

G-Buffer FBO：

~~~text
G-Buffer
├─ Color Attachment 0 → Position
├─ Color Attachment 1 → Normal
├─ Color Attachment 2 → Albedo + Specular
└─ Depth Attachment
~~~

然后通过多个 Draw Buffers 一次写入。

这与 Bloom 一节一次输出 Scene / Bright Texture 是同一个 Multiple Render Targets 机制。

官方 Position 和 Normal 使用浮点纹理，因为它们可能有负值或超过 1：

~~~text
Position = (-3.4, 1.2, 8.7)
Normal   = (-0.6, 0.4, 0.7)
~~~

## Lighting Pass

第一遍完成后，第二遍只画一个 Fullscreen Quad。

当前屏幕像素直接从 G-Buffer 取回：

~~~glsl
vec3 FragPos =
    texture(gPosition, TexCoords).rgb;

vec3 Normal =
    texture(gNormal, TexCoords).rgb;

vec3 Diffuse =
    texture(gAlbedoSpec, TexCoords).rgb;

float Specular =
    texture(gAlbedoSpec, TexCoords).a;
~~~

然后继续使用熟悉的 Blinn-Phong：

~~~glsl
vec3 lightDir =
    normalize(lights[i].Position - FragPos);

vec3 diffuse =
    max(dot(Normal, lightDir), 0.0)
    * Diffuse
    * lights[i].Color;

vec3 halfwayDir =
    normalize(lightDir + viewDir);

float spec =
    pow(
        max(dot(Normal, halfwayDir), 0.0),
        16.0
    );
~~~

所以 Deferred Shading 并没有发明新的光照模型。

它只是从：

~~~text
“当前物体的 Fragment 现场算光”
~~~

变成：

~~~text
“先把最终可见表面的数据记录下来，
再按屏幕像素统一算光”
~~~

## 大量光源时为什么有意义

Deferred Lighting 面向最终屏幕像素，而不是让每个物体自己带着全部光源列表去完成着色。

这特别适合：

~~~text
大量动态点光源
城市夜景
霓虹场景
室内很多局部灯
~~~

不过基础版本仍然会让每个屏幕像素遍历所有光源，所以光源数量极大时依然昂贵。

## Light Volume

点光源经过衰减后，只在有限范围内有明显贡献。

官方 8.2 增加 Radius：

~~~glsl
float distance =
    length(
        lights[i].Position - FragPos
    );

if(distance < lights[i].Radius)
{
    // calculate lighting
}
~~~

思想是：

~~~text
Point Light
↓
只有有限影响半径
↓
只在这个范围内考虑它
~~~

这是进一步优化 Deferred Lighting 的基础。

## G-Buffer 的代价

Deferred 不是免费性能。

每帧都需要写和读：

~~~text
Position
Normal
Albedo + Specular
Depth
~~~

所以它会增加：

~~~text
显存占用
Framebuffer 带宽
纹理读取带宽
~~~

分辨率越高，这个代价越明显。

## 透明物体

传统 G-Buffer 通常只保存每个像素最前面的一个表面。

透明物体却需要同时考虑前后多个表面和混合顺序，因此常见做法是：

~~~text
Opaque
→ Deferred

Transparent
→ Forward
~~~

实际引擎常是 Hybrid，而不是所有东西都 Deferred。

## Depth 为什么还要复制

Lighting Pass 用 Fullscreen Quad 输出到 Default Framebuffer 后，默认 Depth Buffer 并没有 Geometry Pass 的深度。

官方还会继续画 3D Light Boxes，所以先把：

~~~text
G-Buffer Depth
↓ copy
Default Framebuffer Depth
~~~

这样后画的 Light Cubes 才能和原场景正确做 Depth Test。

## Forward 与 Deferred

Forward：

~~~text
Geometry
↓
Material
↓
Lighting
↓
Color
~~~

Deferred：

~~~text
Geometry
↓
G-Buffer
├─ Position
├─ Normal
└─ Albedo / Specular
↓
Lighting Pass
↓
Color
~~~

可以把差别概括为：

~~~text
Forward
→ 物体在第一次绘制时就完成光照

Deferred
→ 第一次只记录表面信息
→ 第二次才完成光照
~~~

## 与前面章节的连接

Framebuffer：

~~~text
提供离屏附件
~~~

Bloom：

~~~text
演示 MRT 一次输出多个附件
~~~

Normal Mapping：

~~~text
决定最终写进 G-Buffer 的 Normal
~~~

HDR / Bloom：

~~~text
可以继续接在 Deferred Lighting 后面
~~~

完整链路：

~~~text
Geometry
↓
G-Buffer
↓
Deferred Lighting
↓
HDR
↓
Bloom
↓
Tone Mapping
↓
Gamma
↓
Screen
~~~

## Interactive Lab

<form action="/myOpengl-lab/static/labs/deferred-shading.html" method="get">
  <button type="submit">🎮 Deferred Shading Lab · G-Buffer / Lights / Final</button>
</form>

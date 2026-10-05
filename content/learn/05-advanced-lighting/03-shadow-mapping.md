---
title: 03 · Shadow Mapping 阴影映射
description: 从光源看到的最近深度推导 Shadow Map，再用第二遍渲染判断片段是否被遮挡。
tags:
  - OpenGL
  - Advanced-Lighting
  - Shadow-Mapping
  - Depth-Map
---

# Shadow Mapping 阴影映射

## 阴影到底在判断什么

阴影不是“把背光面变黑”。

真正的问题是：**当前片段和光源之间，有没有别的东西挡住光。**

~~~text
Light
  |
  |        Cube
  |         █
  |         █
  |        /
  |       x   ← 地面上的当前片段
  |
Floor
~~~

站在相机这里，我们只知道片段的位置、法线和材质。要判断它能不能看到光源，需要换到光源视角。

~~~text
先让光源看一遍场景
↓
记录每个方向最先撞到的深度
↓
再从相机正常渲染
↓
把当前片段也变换到光源视角
↓
和刚才记录的最近深度比较
~~~

这张“光源眼里最近深度”的纹理，就是 Shadow Map。

## 第一遍：从光源视角只画深度

第一遍不关心颜色：

~~~text
Light View
+
Light Projection
↓
lightSpaceMatrix
↓
Scene
↓
Depth Texture
~~~

方向光常用正交投影：

~~~cpp
lightProjection = glm::ortho(...);
lightView = glm::lookAt(lightPos, target, up);
lightSpaceMatrix = lightProjection * lightView;
~~~

场景画进只带 Depth Attachment 的 FBO：

~~~text
Depth FBO
└─ Depth Texture
~~~

一个 texel 表示：光源沿这个方向看过去，最近表面离它有多远。

如果 A 挡在 B 前面，Shadow Map 里记录 A 的深度，而不是 B。

## 第二遍：从相机正常渲染，再查 Shadow Map

正常渲染时，每个片段除了 FragPos、Normal、TexCoord，还需要 FragPosLightSpace，也就是这个片段在光源相机里的位置。

Vertex Shader：

~~~glsl
FragPosLightSpace =
    lightSpaceMatrix * vec4(FragPos, 1.0);
~~~

Fragment Shader 先做透视除法：

~~~glsl
vec3 projCoords =
    fragPosLightSpace.xyz /
    fragPosLightSpace.w;
~~~

NDC 是 [-1, 1]，纹理坐标是 [0, 1]，所以：

~~~glsl
projCoords =
    projCoords * 0.5 + 0.5;
~~~

现在 projCoords.xy 就是 Shadow Map 的采样位置。

~~~glsl
float closestDepth =
    texture(shadowMap, projCoords.xy).r;

float currentDepth = projCoords.z;
~~~

closestDepth 是光源第一遍记录的最近表面，currentDepth 是当前片段自己在光源视角里的深度。

## Shadow Test

~~~text
currentDepth <= closestDepth
→ 当前片段就是最前面的表面
→ 光源能看到
→ 不在阴影

currentDepth > closestDepth
→ 光源前面已经先撞到别的东西
→ 当前片段被挡住
→ 在阴影
~~~

最简单的代码：

~~~glsl
float shadow =
    currentDepth > closestDepth
    ? 1.0
    : 0.0;
~~~

然后：

~~~glsl
lighting =
    ambient
    + (1.0 - shadow)
    * (diffuse + specular);
~~~

Ambient 通常不乘阴影，因为这里的 Ambient 本来就是一个粗略的环境光近似。

## Bias：为什么地面会自己挡住自己

理论上同一个表面应该有：

~~~text
currentDepth == closestDepth
~~~

但 Shadow Map 分辨率有限，而且表面可能是斜的。一个 texel 覆盖一小块区域，比较时就可能出现 currentDepth 比 closestDepth 大一点点，于是本来受光的表面被误判成阴影，形成黑色条纹，也就是 Shadow Acne。

比较时留一点余量：

~~~glsl
currentDepth - bias > closestDepth
~~~

官方示例还让 Bias 随表面倾斜程度变化：

~~~glsl
float bias =
    max(
        0.05 * (1.0 - dot(normal, lightDir)),
        0.005
    );
~~~

正对光源时 Bias 小；表面越斜，Bias 越大。

Bias 太小会出现 Acne；Bias 太大时阴影会从物体脚下脱开，形成 Peter Panning。

## PCF：为什么阴影边缘会变软

Shadow Map 是有限分辨率纹理。如果每个片段只查一个 texel，阴影边界会跟着纹素一格一格跳。

PCF 不只查一个点，而是查周围 3×3：

~~~text
9 个 depth texel
↓
分别做 9 次 Shadow Test
↓
取平均
~~~

结果可以是：

~~~text
0 / 9 → 完全受光
3 / 9 → 边缘
9 / 9 → 完全阴影
~~~

官方代码就是这个 3×3 邻域平均。

PCF 没有提高 Shadow Map 分辨率，它只是把硬跳变变成邻域平均。

## 两遍渲染放在一起

~~~text
Pass 1：Light Pass

Scene
↓
Light View + Light Projection
↓
只写 Depth
↓
Shadow Map
~~~

然后：

~~~text
Pass 2：Camera Pass

Scene
↓
正常从相机渲染
↓
每个 Fragment 同时得到 Light Space 坐标
↓
采样 Shadow Map
↓
currentDepth vs closestDepth
↓
Shadow Test
↓
Lighting
~~~

Shadow Mapping 最核心的判断就是：

> **先记录光源看到的最近深度，再检查当前片段在光源眼里是不是被更近的东西挡住。**

## Interactive Lab

<form action="/myOpengl-lab/static/labs/shadow-mapping.html" method="get">
  <button type="submit">🎮 Shadow Mapping Lab</button>
</form>

Lab 可以在最终阴影、Depth Map、Shadow Test 三种视图之间切换，并调 Bias、PCF 和光源位置。

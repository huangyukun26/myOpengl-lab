---
title: 10 · SSAO 屏幕空间环境光遮蔽
description: 用 G-Buffer 的位置与法线，在屏幕空间估计环境光被周围几何遮挡的程度。
tags: [OpenGL, Advanced-Lighting, SSAO, Ambient-Occlusion, G-Buffer]
---

# SSAO 屏幕空间环境光遮蔽

SSAO 最容易抽象，是因为它同时跨了两个空间：先在 **View Space** 里生成 3D Sample，再把 Sample 投影回屏幕，最后去 **2D G-Buffer** 查询那个位置真正可见的表面。

普通 Ambient 光照默认每个位置都一样亮：

~~~glsl
ambient = 0.3 * albedo;
~~~

但墙角、缝隙、物体贴地处周围能“进光”的方向更少，因此环境光应该更弱。SSAO 就是在实时条件下近似这个效果。

![SSAO 半球采样](https://huangyukun26.github.io/myOpengl-lab/static/img/ssao-hemisphere.svg)

## 一个像素到底在问什么

对当前 Fragment A，SSAO 问的是：

~~~text
A 周围很多采样方向里，
有多少被附近几何占据？
~~~

如果周围很空：

~~~text
被挡 Sample 少
→ AO 接近 1
→ Ambient 基本保留
~~~

如果 A 在墙角：

~~~text
被挡 Sample 多
→ AO 变小
→ Ambient 被压暗
~~~

因此 SSAO 输出的不是最终颜色，而是一张灰度 AO Texture：

~~~text
1.0 = 开放
0.0 = 强遮挡
~~~

## 和 Deferred Shading 的连接

上一节已经有：

~~~text
G-Buffer
├ Position
├ Normal
└ Albedo
~~~

SSAO 正好需要 Position + Normal，所以直接接在 G-Buffer 后面。官方示例这里使用的是 **View-Space Position / Normal**。

## 1. Hemisphere Sample Kernel

最原始的做法可以在 Fragment 周围放一个球形 Sample Kernel，但球的下半部分本来就在表面内部，容易让平坦表面也显得发灰。

所以 LearnOpenGL 使用沿 Normal 朝外的半球：

~~~text
        ↑ Normal
      • • •
    •   •   •
  •     A     •
────────────── surface
~~~

官方生成 64 个 Sample，而且让更多 Sample 聚集在中心附近：

~~~cpp
scale = float(i) / 64.0;
scale = lerp(0.1, 1.0, scale * scale);
sample *= scale;
~~~

AO 是局部效果，所以近距离 Sample 更重要。

## 2. TBN：让半球跟着当前表面转

Kernel 默认可以看作朝固定 +Z，但地板、墙、模型表面的 Normal 都不同。

官方用 Normal 和一个随机向量构造：

~~~text
Tangent
Bitangent
Normal
~~~

形成 TBN：

~~~glsl
vec3 tangent = normalize(
    randomVec - normal * dot(randomVec, normal)
);

vec3 bitangent = cross(normal, tangent);
mat3 TBN = mat3(tangent, bitangent, normal);
~~~

然后：

~~~glsl
samplePos = TBN * samples[i];
~~~

含义就是把“固定朝上的半球”旋转到当前 Fragment 的 Normal 方向。

## 3. Radius：SSAO 要看多远

~~~glsl
samplePos = fragPos + samplePos * radius;
~~~

Radius 小，只检查非常近的接触和缝隙；Radius 大，会让更远的几何参与 AO。太大通常会出现大块、不自然的暗影。

## 4. 最绕的一步：3D Sample 为什么要投影回屏幕

![SSAO Sample 投影到 G-Buffer](https://huangyukun26.github.io/myOpengl-lab/static/img/ssao-projection.svg)

现在 samplePos 是一个 **View-Space 3D 坐标**，但 gPosition 是一张 **2D Texture**。

要查询纹理，必须先得到 UV，所以官方做：

~~~glsl
vec4 offset = vec4(samplePos, 1.0);
offset = projection * offset;
offset.xyz /= offset.w;
offset.xyz = offset.xyz * 0.5 + 0.5;
~~~

空间变化：

~~~text
View Space samplePos
→ Clip Space
→ NDC [-1, 1]
→ UV [0, 1]
~~~

现在 offset.xy 才能拿去采样 G-Buffer。

## 5. sampleDepth 到底是什么

~~~glsl
float sampleDepth = texture(gPosition, offset.xy).z;
~~~

这里有两个完全不同的 Z：

~~~text
samplePos.z
= 我们生成的“虚拟 3D 采样点”深度

sampleDepth
= 这个屏幕 UV 上真正可见表面的深度
~~~

所以 SSAO 的核心其实是在比较：

~~~text
我想测试的位置
vs
摄像机在那里真正看见的表面
~~~

如果真实表面挡在 Sample 前面，就认为该 Sample 被附近几何占据，Occlusion 增加。

## 6. Bias

官方用：

~~~glsl
bias = 0.025;
~~~

它和 Shadow Mapping 的 Bias 很像：避免因为浮点和深度误差，把当前表面误判成挡住自己。

~~~text
Bias 太小 → acne / 脏点
Bias 太大 → 真实近距离遮挡被漏掉
~~~

## 7. Range Check

Sample 投影后有可能正好落在远处墙面上。仅比较深度会把远处几何也错误当成局部 Occluder。

所以官方加入：

~~~glsl
float rangeCheck = smoothstep(
    0.0,
    1.0,
    radius / abs(fragPos.z - sampleDepth)
);
~~~

深度差小，说明几何确实在附近；深度差很大，权重就降低。

## 8. 最终 AO

假设 64 个 Sample 中有 40 个被遮挡：

~~~text
AO = 1 - 40 / 64
   = 0.375
~~~

开放区域接近 1，角落和接触面更接近 0。

## 9. 4×4 Noise Texture

所有像素都使用完全相同的 Sample 方向时，低 Sample 数容易产生规则 Banding。

官方生成一张 4×4 随机旋转纹理，让相邻像素的半球方向略有不同：

~~~text
规则条纹 Banding
→ 随机化
→ Noise
~~~

Noise 比规则条纹更容易 Blur。

## 10. Blur

SSAO Pass 输出 Raw AO 后，官方再做一个 4×4 Box Blur：

~~~text
Raw SSAO
→ Blur
→ Smooth SSAO
~~~

它的目的不是模糊最终场景，而是把随机旋转带来的噪声平滑掉。

## 11. SSAO 最后乘在哪里

官方只把 AO 乘到 Ambient：

~~~glsl
vec3 ambient = vec3(
    0.3 * Diffuse * AmbientOcclusion
);
~~~

Diffuse / Specular 的直接光照仍然正常算。

因此 SSAO 和 Shadow Mapping 不是一回事：

~~~text
Shadow Mapping
→ 某个 Light 到 Fragment 的直接光路有没有被挡

SSAO
→ Fragment 周围有多少方向被附近几何占据
→ 只近似 Ambient / Indirect Occlusion
~~~

## 完整流程

![SSAO Pipeline](https://huangyukun26.github.io/myOpengl-lab/static/img/ssao-pipeline.svg)

~~~text
Pass 1
Geometry → G-Buffer

Pass 2
Position + Normal
+ Hemisphere Kernel
+ 4×4 Noise
→ Raw SSAO

Pass 3
Raw SSAO → Blur

Pass 4
G-Buffer + AO + Light
→ Deferred Lighting
~~~

## 代码变量怎么读

~~~text
fragPos
→ 当前像素 View-Space Position

samplePos
→ 当前半球中的一个 3D 测试点

offset.xy
→ samplePos 投影到屏幕后得到的 UV

sampleDepth
→ 该 UV 上真实可见表面的 View-Space Z

occlusion
→ 周围被几何挡住的比例
~~~

抓住这五个变量，官方 SSAO Shader 就不会再抽象。

## Interactive Lab

<form action="/myOpengl-lab/static/labs/ssao.html" method="get">
  <button type="submit">🎮 SSAO Lab · Kernel / Radius / Bias / Noise / Blur</button>
</form>

---
title: 05 · Normal Mapping 法线贴图
description: 用 Normal Map 提供逐片段法线，并通过 TBN 基底把纹理中的切线空间法线接入现有光照计算。
tags:
  - OpenGL
  - Advanced-Lighting
  - Normal-Mapping
  - TBN
  - Tangent-Space
---

# Normal Mapping 法线贴图

## 平面为什么看起来还是平的

Diffuse Texture 只能改变颜色。

一块砖墙即使贴了很细的颜色纹理，如果整个平面的法线仍然只有：

~~~text
N = (0, 0, 1)
~~~

那么同一平面上的光照方向变化很小，Diffuse 和 Specular 仍然按“这是一个平面”计算。

Normal Mapping 不增加几何顶点，也不改变轮廓。它只把原来每个 Fragment 使用的几何法线：

~~~text
interpolated vertex normal
~~~

换成：

~~~text
normalMap[uv]
~~~

因此小砖块、凹槽和裂缝可以通过局部法线变化影响光照。

## Normal Map 存的是什么

纹理通道只能直接保存 `[0,1]` 范围的数据，而法线分量在 `[-1,1]`。

写入 Normal Map 前：

~~~glsl
encoded = normal * 0.5 + 0.5;
~~~

Shader 采样后再恢复：

~~~glsl
vec3 normal =
    texture(normalMap, TexCoords).rgb;

normal =
    normalize(normal * 2.0 - 1.0);
~~~

RGB 分别对应法线的 XYZ。

大多数 Normal Map 看起来偏蓝，是因为切线空间中的基础法线接近：

~~~text
(0, 0, 1)
~~~

映射到颜色后约为：

~~~text
(0.5, 0.5, 1.0)
~~~

Normal Map 是数据纹理，不应该按 sRGB 颜色纹理解码。

## 直接使用采样法线的问题

纹理里的法线通常不是 World Space 法线，而是 **Tangent Space 法线**。

在 Tangent Space 中，每个表面都被当作：

~~~text
T → 纹理 U 方向
B → 纹理 V 方向
N → 表面外侧
~~~

Normal Map 中的 `(0,0,1)` 表示“垂直离开当前表面”，不是固定的 World +Z。

如果把它直接拿去和 World Space 的 `lightDir` 做点乘：

~~~glsl
dot(normal, lightDir)
~~~

那么只要模型旋转，两个向量就不再位于同一个坐标空间，光照会出错。

Normal Mapping 的核心不是“多采一张纹理”，而是先处理坐标空间。

## T、B、N 从哪里来

N 是网格本来的几何法线。

Tangent 和 Bitangent 来自三角形的边以及 UV 的变化。

设一个三角形：

~~~text
P1 ---- P2
 \      /
  \    /
   \  /
    P3
~~~

位置边：

~~~cpp
edge1 = pos2 - pos1;
edge2 = pos3 - pos1;
~~~

UV 边：

~~~cpp
deltaUV1 = uv2 - uv1;
deltaUV2 = uv3 - uv1;
~~~

几何边可以写成 Tangent 与 Bitangent 的组合：

~~~text
edge1 = deltaUV1.x * T + deltaUV1.y * B
edge2 = deltaUV2.x * T + deltaUV2.y * B
~~~

把这组二维线性方程解出来：

~~~cpp
float f =
    1.0f /
    (
        deltaUV1.x * deltaUV2.y
        - deltaUV2.x * deltaUV1.y
    );

tangent.x =
    f * (
        deltaUV2.y * edge1.x
        - deltaUV1.y * edge2.x
    );

tangent.y =
    f * (
        deltaUV2.y * edge1.y
        - deltaUV1.y * edge2.y
    );

tangent.z =
    f * (
        deltaUV2.y * edge1.z
        - deltaUV1.y * edge2.z
    );

bitangent.x =
    f * (
        -deltaUV2.x * edge1.x
        + deltaUV1.x * edge2.x
    );

bitangent.y =
    f * (
        -deltaUV2.x * edge1.y
        + deltaUV1.x * edge2.y
    );

bitangent.z =
    f * (
        -deltaUV2.x * edge1.z
        + deltaUV1.x * edge2.z
    );
~~~

这里得到的不是“新的表面法线”，而是一套跟 UV 贴图方向绑定的局部坐标轴。

## TBN 矩阵

三根轴组成：

~~~text
T = Tangent
B = Bitangent
N = Normal
~~~

写成矩阵：

~~~glsl
mat3 TBN = mat3(T, B, N);
~~~

这个矩阵把 Tangent Space 向量变到当前使用的空间。

有两种常见做法。

第一种：

~~~text
Normal Map 法线
Tangent Space
↓ TBN
World Space
↓
和 World Space 的 lightDir / viewDir 一起计算
~~~

Fragment Shader：

~~~glsl
vec3 normal =
    texture(normalMap, TexCoords).rgb;

normal =
    normalize(normal * 2.0 - 1.0);

normal =
    normalize(TBN * normal);
~~~

第二种是官方最终源码采用的方向：

~~~text
Normal Map 法线保持 Tangent Space

World Space:
lightPos
viewPos
FragPos
↓ inverse(TBN)
Tangent Space
↓
全部在 Tangent Space 中计算光照
~~~

## 官方源码中的 TBN

Vertex Shader 先用 Normal Matrix 变换 T 和 N：

~~~glsl
mat3 normalMatrix =
    transpose(inverse(mat3(model)));

vec3 T =
    normalize(normalMatrix * aTangent);

vec3 N =
    normalize(normalMatrix * aNormal);
~~~

然后重新让 T 与 N 垂直：

~~~glsl
T =
    normalize(
        T - dot(T, N) * N
    );
~~~

这一步是 Gram-Schmidt 正交化。模型变换和顶点插值可能让 T、N 不再严格垂直。

B 再由叉乘得到：

~~~glsl
vec3 B =
    cross(N, T);
~~~

得到一组正交基。

~~~glsl
mat3 TBN =
    transpose(mat3(T, B, N));
~~~

这里用了 `transpose`，因为正交矩阵满足：

~~~text
inverse(TBN) = transpose(TBN)
~~~

所以这个矩阵实际用于：

~~~text
World Space → Tangent Space
~~~

Vertex Shader 提前把三个位置转换过去：

~~~glsl
vs_out.TangentLightPos =
    TBN * lightPos;

vs_out.TangentViewPos =
    TBN * viewPos;

vs_out.TangentFragPos =
    TBN * vs_out.FragPos;
~~~

这样 Fragment Shader 不需要每个 Fragment 再做矩阵转换。

## Fragment Shader 的数据流

Normal Map：

~~~glsl
vec3 normal =
    texture(
        normalMap,
        fs_in.TexCoords
    ).rgb;

// [0,1] → [-1,1]
normal =
    normalize(normal * 2.0 - 1.0);
~~~

这时 `normal` 已经是 Tangent Space。

光源方向：

~~~glsl
vec3 lightDir =
    normalize(
        fs_in.TangentLightPos
        - fs_in.TangentFragPos
    );
~~~

观察方向：

~~~glsl
vec3 viewDir =
    normalize(
        fs_in.TangentViewPos
        - fs_in.TangentFragPos
    );
~~~

于是：

~~~text
normal     → Tangent Space
lightDir   → Tangent Space
viewDir    → Tangent Space
~~~

三者在同一空间后，Blinn-Phong 本身不需要修改：

~~~glsl
float diff =
    max(dot(lightDir, normal), 0.0);

vec3 halfwayDir =
    normalize(lightDir + viewDir);

float spec =
    pow(
        max(dot(normal, halfwayDir), 0.0),
        32.0
    );
~~~

Normal Mapping 改变的是法线来源和坐标空间，不是光照公式。

## 完整流程

~~~text
Mesh
├─ Position
├─ Normal
├─ UV
└─ Tangent
       ↓
Vertex Shader
       ↓
构造 T / B / N
       ↓
World → Tangent
       ↓
TangentLightPos
TangentViewPos
TangentFragPos
       ↓
Rasterization
       ↓
Fragment Shader
       ↓
Normal Map RGB
       ↓
[0,1] → [-1,1]
       ↓
Per-Fragment Tangent Normal
       ↓
Blinn-Phong
       ↓
Final Color
~~~

几何表面本身仍然是平的。Normal Mapping 只让光照按照一组更细的逐片段法线变化，因此物体轮廓、遮挡关系和真实几何深度都不会被改变。

## Interactive Lab

<form action="/myOpengl-lab/static/labs/normal-mapping.html" method="get">
  <button type="submit">🎮 Normal Mapping Lab</button>
</form>

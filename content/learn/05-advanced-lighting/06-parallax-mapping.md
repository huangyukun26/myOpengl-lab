---
title: 06 · Parallax Mapping 视差贴图
description: 用 Depth Map 和 Tangent Space 中的观察方向偏移纹理坐标，并过渡到 Steep Parallax Mapping 与 Parallax Occlusion Mapping。
tags:
  - OpenGL
  - Advanced-Lighting
  - Parallax-Mapping
  - POM
  - Tangent-Space
---

# Parallax Mapping 视差贴图

Normal Mapping 已经能让平面在光照上表现出凹凸，但纹理位置本身没有变化。视角改变时，砖块仍然固定在原来的 UV 上。

Parallax Mapping 继续使用上一节的 Tangent Space，不过这次先改变 TexCoords：

~~~text
Fragment 原始 UV
↓
Depth Map + Tangent View Direction
↓
偏移 UV
↓
用新 UV 采 Diffuse / Normal
~~~

因此它制造的是“从斜角观察时，表面细节发生视差位移”的错觉。几何本身仍然没有真实位移。

## 从 A 点改采 B 点

当前 Fragment 原本对应纹理位置 A。如果表面真的存在凹槽，观察射线进入表面后，真正看到的位置会落到另一个纹理位置 B。

~~~text
Viewer
   \
    \  viewDir
-----A------------------ 原始平面
      \
       \ B              假想深度表面
~~~

Parallax Mapping 不移动 A 这个 Fragment，而是让它从“采 A”改成“采 B”。

## Depth Map 的职责

这一节增加一张单通道 Depth Map：

~~~text
Normal Map
→ 当前位置的表面朝向

Depth Map
→ 当前位置在假想表面中有多深
~~~

LearnOpenGL 示例使用较大的值表示较深位置。

~~~glsl
float depth =
    texture(depthMap, texCoords).r;
~~~

## Tangent Space 为什么又出现

上一节已经把 viewPos 和 FragPos 转到 Tangent Space，因此：

~~~glsl
vec3 viewDir =
    normalize(
        fs_in.TangentViewPos
        - fs_in.TangentFragPos
    );
~~~

在 Tangent Space 里：

~~~text
viewDir.x → 沿 Tangent / U 方向
viewDir.y → 沿 Bitangent / V 方向
viewDir.z → 垂直表面方向
~~~

所以 viewDir.xy 天然对应纹理平面里的偏移方向。

## 基础 Parallax Mapping

核心计算可以写成：

~~~glsl
vec2 ParallaxMapping(
    vec2 texCoords,
    vec3 viewDir
)
{
    float depth =
        texture(
            depthMap,
            texCoords
        ).r;

    vec2 p =
        viewDir.xy
        / viewDir.z
        * (depth * heightScale);

    return texCoords - p;
}
~~~

完整含义：

~~~text
原始 texCoords
↓
在 Depth Map 读取 depth
↓
viewDir.xy / viewDir.z
得到斜视方向对应的二维偏移比例
↓
乘 depth 与 heightScale
↓
texCoords - offset
↓
得到新的 UV
~~~

然后 Diffuse Map 与 Normal Map 都使用新 UV：

~~~glsl
texCoords =
    ParallaxMapping(
        fs_in.TexCoords,
        viewDir
    );

vec3 normal =
    texture(
        normalMap,
        texCoords
    ).rgb;

vec3 color =
    texture(
        diffuseMap,
        texCoords
    ).rgb;
~~~

这保证颜色和法线仍然来自材质中的同一个位置。

## viewDir.xy / viewDir.z

正视表面时：

~~~text
viewDir.z 大
viewDir.xy 小
→ UV 偏移很小
~~~

斜视表面时：

~~~text
viewDir.z 变小
viewDir.xy 相对变大
→ UV 偏移明显
~~~

这正是视差：观察越倾斜，深度造成的横向错位越明显。

极端斜视时，除以很小的 viewDir.z 会产生过强偏移。省略这个除法的版本通常称为 Offset Limiting。

## heightScale

heightScale 控制假想深度的整体强度：

~~~text
0
→ 没有视差

较小
→ 轻微深度

较大
→ 偏移明显，但失真也更容易出现
~~~

它不是模型的真实高度。

## 偏移后的 UV 越界

UV 偏移后可能离开 0 到 1。平面示例中可以直接丢弃：

~~~glsl
if(
    texCoords.x > 1.0 ||
    texCoords.y > 1.0 ||
    texCoords.x < 0.0 ||
    texCoords.y < 0.0
)
{
    discard;
}
~~~

## Steep Parallax Mapping

基础方法只在原始 UV 采一次 Depth，然后估算一次偏移。高度变化陡峭时，这个估算容易偏离真正的交点。

Steep Parallax Mapping 把深度 0 到 1 分成多层：

~~~text
0
| layer
| layer
| layer
| ...
1
~~~

沿观察方向逐层移动 UV，同时比较：

~~~text
currentLayerDepth
和
depthMap(currentTexCoords)
~~~

核心准备：

~~~glsl
const float minLayers = 8.0;
const float maxLayers = 32.0;

float numLayers =
    mix(
        maxLayers,
        minLayers,
        abs(
            dot(
                vec3(0.0, 0.0, 1.0),
                viewDir
            )
        )
    );

float layerDepth =
    1.0 / numLayers;

vec2 P =
    viewDir.xy
    / viewDir.z
    * heightScale;

vec2 deltaTexCoords =
    P / numLayers;
~~~

正视时层数较少，斜视时层数较多。

逐层搜索：

~~~glsl
vec2 currentTexCoords =
    texCoords;

float currentLayerDepth =
    0.0;

float currentDepthMapValue =
    texture(
        depthMap,
        currentTexCoords
    ).r;

while(
    currentLayerDepth
    <
    currentDepthMapValue
)
{
    currentTexCoords -=
        deltaTexCoords;

    currentDepthMapValue =
        texture(
            depthMap,
            currentTexCoords
        ).r;

    currentLayerDepth +=
        layerDepth;
}
~~~

第一次满足停止条件时，说明采样射线刚刚穿过假想表面。

## Parallax Occlusion Mapping

Steep Parallax Mapping 最终停在离散层上。POM 再取穿过表面之前的那个采样点：

~~~glsl
vec2 prevTexCoords =
    currentTexCoords
    + deltaTexCoords;
~~~

现在：

~~~text
prevTexCoords
→ 交点之前

currentTexCoords
→ 交点之后
~~~

真实交点位于二者之间。

计算两侧误差并插值：

~~~glsl
float afterDepth =
    currentDepthMapValue
    - currentLayerDepth;

float beforeDepth =
    texture(
        depthMap,
        prevTexCoords
    ).r
    - currentLayerDepth
    + layerDepth;

float weight =
    afterDepth
    /
    (
        afterDepth
        - beforeDepth
    );

vec2 finalTexCoords =
    prevTexCoords * weight
    +
    currentTexCoords
    * (1.0 - weight);
~~~

三种方法可以连续理解：

~~~text
Basic Parallax
→ 一次估算

Steep Parallax
→ 多层搜索，找到首次穿过表面的位置

POM
→ 在穿过前后的两个采样点之间再插值
~~~

## 与 Normal Mapping 串起来

Fragment Shader 中的顺序是：

~~~text
Tangent Space viewDir
↓
Parallax Mapping
↓
得到新 UV
↓
用新 UV 采 Normal Map
↓
得到逐片段法线
↓
用同一新 UV 采 Diffuse
↓
Lighting
~~~

因此：

~~~text
Parallax Mapping
→ 决定“纹理应该从哪里取”

Normal Mapping
→ 决定“那个位置的表面朝哪里”
~~~

二者一起使用时，视差和光照细节才能对得上。

## 几何仍然没有变化

即使 POM 看起来有明显深度：

~~~text
Vertex Position 没变
真实几何 Depth 没形成凹槽
Silhouette 仍来自原始平面
~~~

与 Normal Mapping 相比：

~~~text
Normal Mapping
→ 只改变光照使用的 N

Parallax Mapping
→ 进一步让纹理采样位置随视角移动
~~~

## Interactive Lab

<form action="/myOpengl-lab/static/labs/parallax-mapping.html" method="get">
  <button type="submit">🎮 Parallax Mapping Lab</button>
</form>

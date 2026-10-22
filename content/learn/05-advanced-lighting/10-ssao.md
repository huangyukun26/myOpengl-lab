---
title: 10 · SSAO 屏幕空间环境光遮蔽
description: 从 Ambient Occlusion 的动机开始，完整拆解 G-Buffer、半球 Kernel、随机旋转、TBN、深度比较、Range Check、Blur 与 Lighting。
tags: [OpenGL, Advanced-Lighting, SSAO, Ambient-Occlusion, G-Buffer]
---

# SSAO 屏幕空间环境光遮蔽

SSAO 这一节如果只盯着最后那几十行 Shader，很容易觉得像一串没有来由的数学步骤。

真正应该先回答的是：

~~~text
为什么普通 Ambient 不够？
↓
Ambient Occlusion 想近似什么？
↓
为什么可以只看屏幕上的 G-Buffer？
↓
一个 Fragment 周围到底采样什么？
↓
samplePos 为什么又要投影回屏幕？
↓
最后那个 AO 灰度值怎么进入 Lighting？
~~~

下面按这个因果顺序来。

![SSAO 半球采样](https://huangyukun26.github.io/myOpengl-lab/static/img/ssao-hemisphere.svg)

## 1. 从普通 Ambient Lighting 的问题开始

前面的 Blinn-Phong 经常会写：

~~~glsl
vec3 ambient = 0.3 * albedo;
~~~

这相当于假设：

~~~text
场景中所有表面
都能收到相同强度的环境光
~~~

但现实不是这样。

例如：

~~~text
墙角
物体和地面的接触处
狭窄缝隙
洞口内部
两个表面贴得很近的位置
~~~

这些地方周围几何更多，来自四面八方的间接光更难进入，所以它们通常会比完全开放的表面略暗。

Ambient Occlusion 做的就是这件事：

> 估计一个点周围的几何对环境光方向遮挡了多少。

如果一个点周围非常开放：

~~~text
很多方向都没有几何
→ 环境光容易到达
→ AO 接近 1
~~~

如果一个点被墙角包住：

~~~text
很多方向都被附近几何占据
→ 环境光难进入
→ AO 变小
~~~

所以 AO 最终不是颜色，而是一个权重：

~~~text
AO = 1.0
→ 环境光基本不减弱

AO = 0.3
→ Ambient 只保留约 30%
~~~

最后一般写成：

~~~glsl
ambient = 0.3 * albedo * AO;
~~~

## 2. 真正的 Ambient Occlusion 为什么贵

如果想物理上更准确地判断一个点到底有多少方向被挡，最直接的方法是：

~~~text
从这个点向很多方向发射射线
↓
看每条射线有没有撞到附近几何
↓
统计被挡方向比例
~~~

这已经很像 Ray Tracing。

问题是：

~~~text
屏幕上每个像素
×
很多条射线
×
整套场景几何求交
~~~

实时渲染成本非常高。

2007 年 Crytek 在 Crysis 中推广了 Screen-Space Ambient Occlusion：不再对完整场景发射真实射线，而是利用已经渲染出来的屏幕深度信息，近似判断周围有没有几何。

所以 SSAO 的关键交换是：

~~~text
不看完整世界几何
只看屏幕当前能看到的表面
~~~

因此它非常快，但也因此存在 Screen-Space 方法共有的局限：

~~~text
屏幕外的几何不知道
被完全挡住的背后几何不知道
只能利用当前视角能看到的数据
~~~

这也是 SSAO 为什么叫 Screen-Space。

## 3. Crytek 早期 Sphere Kernel 的问题

最早很直觉的办法，是围绕当前 Fragment 放一个球形 Sample Kernel：

~~~text
      •
   •  •  •
 •    A    •
   •  •  •
      •
~~~

然后看这些 Sample 有多少落在周围几何内部。

但球有一个明显问题。

假设 A 就在一面完全平坦的墙上：

~~~text
      墙外
    • • •
──────A────── 墙表面
    • • •
      墙内
~~~

球下半部分天然就在墙体内部。

于是即使是一面完全平坦、周围没有任何缝隙和角落的墙，也会因为“球的一半被墙占据”而得到很大的 Occlusion。

结果就是：

~~~text
整个平面都会发灰
~~~

LearnOpenGL 因此不使用完整 Sphere，而使用：

~~~text
沿表面 Normal 朝外的 Hemisphere
~~~

~~~text
        ↑ Normal
      • • •
    •   •   •
  •     A     •
────────────── surface
~~~

这样只采样表面外侧，不会把物体自身内部天然算成遮挡。

## 4. 为什么 SSAO 这一节紧跟 Deferred Shading

SSAO 每个屏幕像素至少需要：

~~~text
Position
Normal
Albedo
~~~

还需要额外的：

~~~text
Sample Kernel
Random Rotation Vector
~~~

而上一节 Deferred Shading 已经准备好了 G-Buffer：

~~~text
G-Buffer
├─ gPosition
├─ gNormal
└─ gAlbedo
~~~

所以 SSAO 几乎就是顺着 Deferred Pipeline 插进去的一个额外 Pass。

完整关系：

~~~text
Geometry Pass
↓
G-Buffer
├──────────────→ Lighting Pass
│
└→ SSAO Pass
   ↓
   Blur
   ↓
   AO Texture
       │
       └────────→ Lighting Pass
~~~

## 5. 为什么这里统一使用 View Space

LearnOpenGL 这一节把 Position 和 Normal 都存成 View Space。

Geometry Vertex Shader 的思想是：

~~~glsl
vec4 viewPos = view * model * vec4(aPos, 1.0);
FragPos = viewPos.xyz;

Normal = mat3(transpose(inverse(view * model))) * aNormal;
~~~

为什么 View Space 很方便？

因为：

~~~text
摄像机在 View Space 永远位于 (0,0,0)
摄像机前方的深度关系统一
samplePos / gPosition / Light Position 可以放在同一空间比较
~~~

因此后面的 SSAO Depth Compare 不需要在 World / View 之间来回变换。

LearnOpenGL 也提到另一种常见做法：

~~~text
只保存 Depth
然后在 Shader 中从 Depth 重建 Position
~~~

这样能省掉 gPosition 这张昂贵的浮点纹理，但 Shader 里会多一些重建计算。

本教程为了把 SSAO 逻辑讲清楚，直接存 Position。

## 6. Geometry Pass 代码到底准备了什么

官方 Geometry Fragment Shader 本质上非常简单：

~~~glsl
layout (location = 0) out vec3 gPosition;
layout (location = 1) out vec3 gNormal;
layout (location = 2) out vec3 gAlbedo;

in vec3 FragPos;
in vec3 Normal;

void main()
{
    gPosition = FragPos;
    gNormal   = normalize(Normal);
    gAlbedo   = vec3(0.95);
}
~~~

注意这一遍没有：

~~~text
Diffuse Lighting
Specular Lighting
AO
~~~

第一遍只是建立后面所有 Screen-Space Pass 的资料库。

## 7. Sample Kernel：CPU 端到底在生成什么

LearnOpenGL 在 CPU 端生成 64 个向量：

~~~cpp
glm::vec3 sample(
    random(-1.0, 1.0),
    random(-1.0, 1.0),
    random( 0.0, 1.0)
);
~~~

注意 Z：

~~~text
X ∈ [-1, 1]
Y ∈ [-1, 1]
Z ∈ [ 0, 1]
~~~

如果 Z 也是 [-1,1]，得到的是 Sphere。

Z 只取正值，所以 Sample 都在 Tangent-Space +Z 半球。

接着：

~~~cpp
sample = normalize(sample);
sample *= random(0.0, 1.0);
~~~

第一句把方向归一化；第二句让点不全部贴在半球壳上，而是随机散布到半球体内部。

此时还是均匀随机。

但 AO 更关心当前 Fragment 附近，所以官方继续：

~~~cpp
float scale = float(i) / 64.0;
scale = lerp(0.1f, 1.0f, scale * scale);
sample *= scale;
~~~

`scale * scale` 会产生一种加速曲线：

~~~text
前面的 Sample 更靠近中心
后面的 Sample 才逐渐扩散到半径外侧
~~~

因此 Kernel 看起来更像：

~~~text
当前点附近：•••••• 很密
往外：      • • •
更远：        •
~~~

这样把更多采样预算放在最重要的局部范围。

## 8. 为什么 Sample Kernel 不能每个像素都完全一样

假设只有 16 个 Sample，而且屏幕每个像素都使用完全一样的 16 个方向。

那么相邻像素做的是高度重复的判断。

结果会产生：

~~~text
规则的层状 / 条带结构
Banding
~~~

最直接解决方法是增加 Samples：

~~~text
16 → 32 → 64 → 128
~~~

但成本也线性增加。

更聪明的方法是：

~~~text
Sample 数不用特别多
但每个 Fragment 把 Kernel 稍微随机旋转一下
~~~

这样原本规则重复的误差就被打散成 Noise。

规则 Banding 很显眼；随机 Noise 后面可以 Blur。

## 9. 4×4 Noise Texture 为什么只需要这么小

理论上可以给屏幕每个 Pixel 一个随机旋转向量。

但那会需要一张全屏随机纹理。

LearnOpenGL 只生成 16 个随机向量：

~~~cpp
for (int i = 0; i < 16; ++i)
{
    vec3 noise(
        random(-1.0, 1.0),
        random(-1.0, 1.0),
        0.0
    );
}
~~~

为什么 Z = 0？

因为 Kernel 默认沿 Tangent-Space +Z 朝外。

Noise 的作用只是：

~~~text
绕这个 +Z 轴旋转半球
~~~

所以随机向量只需要在 XY 平面。

然后做一张：

~~~text
4 × 4 Noise Texture
~~~

并设置：

~~~cpp
GL_TEXTURE_WRAP_S = GL_REPEAT
GL_TEXTURE_WRAP_T = GL_REPEAT
~~~

让它在整个屏幕上重复。

## 10. noiseScale 为什么是 Screen / 4

Fragment 的 TexCoords 只有：

~~~text
0 → 1
~~~

如果直接：

~~~glsl
texture(texNoise, TexCoords)
~~~

4×4 Noise Texture 只会被拉伸覆盖整张屏幕一次。

我们真正想要：

~~~text
4×4 pattern
不断重复铺满屏幕
~~~

所以：

~~~glsl
vec2 noiseScale = vec2(
    screenWidth  / 4.0,
    screenHeight / 4.0
);

randomVec = texture(
    texNoise,
    TexCoords * noiseScale
).xyz;
~~~

例如 800×600：

~~~text
noiseScale = (200,150)
~~~

意味着 4×4 Noise Pattern 在屏幕上重复很多次。

## 11. SSAO 为什么还要单独一个 FBO

SSAO Pass 不是最终 Lighting。

它输出的是：

~~~text
每个屏幕像素一个 AO 值
~~~

所以官方创建：

~~~text
ssaoFBO
└─ ssaoColorBuffer
~~~

而这张纹理只需要一个通道：

~~~cpp
glTexImage2D(
    GL_TEXTURE_2D,
    0,
    GL_RED,
    width,
    height,
    0,
    GL_RED,
    GL_FLOAT,
    NULL
);
~~~

为什么只要 RED？

因为 AO 只是：

~~~text
0.0 ~ 1.0
~~~

没有必要存 RGB。

## 12. SSAO Shader 第一步：取当前 Fragment 的输入

Fullscreen Quad 上的每个 Fragment：

~~~glsl
vec3 fragPos = texture(
    gPosition,
    TexCoords
).xyz;

vec3 normal = normalize(texture(
    gNormal,
    TexCoords
).rgb);

vec3 randomVec = normalize(texture(
    texNoise,
    TexCoords * noiseScale
).xyz);
~~~

这三样东西的角色：

~~~text
fragPos
→ 当前像素对应的真实 3D 表面位置

normal
→ 这个表面朝哪里

randomVec
→ 当前像素这次把 Kernel 朝哪个角度随机旋转
~~~

## 13. TBN 为什么这里不是模型的 Tangent / Bitangent

Normal Mapping 时我们计算过真正的几何 Tangent / Bitangent。

SSAO 这里不需要。

因为 SSAO 不是要把某张法线贴图精确映射到模型 UV。

它只需要：

~~~text
构造一个以当前 Normal 为 Z 轴的局部坐标系
并且让 X/Y 方向随机一点
~~~

官方：

~~~glsl
vec3 tangent = normalize(
    randomVec
    - normal * dot(randomVec, normal)
);

vec3 bitangent = cross(normal, tangent);

mat3 TBN = mat3(
    tangent,
    bitangent,
    normal
);
~~~

第一行其实是在做 Gram-Schmidt 正交化。

把 randomVec 在 normal 方向上的分量减掉：

~~~text
randomVec
↓ 去除 Normal 分量
Tangent
~~~

于是 Tangent 与 Normal 垂直。

再：

~~~text
Bitangent = Normal × Tangent
~~~

就得到完整局部基底。

因为 randomVec 每个区域略有不同，所以 TBN 的 Tangent / Bitangent 方向也会随机旋转。

## 14. Kernel Sample 如何真正变成当前 Fragment 周围的点

CPU 生成的 `samples[i]` 还在 Tangent Space。

先：

~~~glsl
vec3 samplePos = TBN * samples[i];
~~~

把它从：

~~~text
Tangent Space
→ View Space
~~~

然后：

~~~glsl
samplePos = fragPos + samplePos * radius;
~~~

于是 samplePos 才变成：

> 当前 Fragment 周围某个真实 View-Space 3D 测试位置。

`radius` 决定 SSAO 向周围看多远。

~~~text
radius 小
→ 只强调很近的接触 / 缝隙

radius 大
→ 更远几何也参与
→ AO 范围更宽
~~~

## 15. 最关键的一步：为什么 samplePos 又要投影回屏幕

![SSAO Sample 投影到 G-Buffer](https://huangyukun26.github.io/myOpengl-lab/static/img/ssao-projection.svg)

现在有：

~~~text
samplePos
= View-Space 3D 坐标
~~~

但我们真正知道场景表面在哪里的数据是：

~~~text
gPosition
= 一张 2D 屏幕纹理
~~~

要查这张纹理，就必须得到 UV。

所以：

~~~glsl
vec4 offset = vec4(samplePos, 1.0);

offset = projection * offset;

offset.xyz /= offset.w;

offset.xyz = offset.xyz * 0.5 + 0.5;
~~~

这几步分别是：

~~~text
View Space
↓ projection
Clip Space
↓ perspective divide
NDC [-1,1]
↓ *0.5 + 0.5
Texture UV [0,1]
~~~

现在：

~~~text
offset.xy
~~~

就是“如果这个 3D samplePos 真被摄像机看到，它会落在屏幕哪里”。

## 16. sampleDepth 到底在查什么

有了 UV：

~~~glsl
float sampleDepth = texture(
    gPosition,
    offset.xy
).z;
~~~

这里必须把两个 Z 分开：

~~~text
samplePos.z
→ 我们想测试的那个虚拟 3D 点

sampleDepth
→ 在这个屏幕 UV 上，摄像机真正看到的最前方表面的 Z
~~~

所以它不是：

~~~text
同一个值查两遍
~~~

而是在问：

~~~text
我想测试的位置 samplePos
和
屏幕那里真正存在的表面
谁更靠近摄像机？
~~~

如果真实表面挡在 Sample 前面，说明这个 Sample 方向被附近几何占据。

## 17. 为什么比较写成 sampleDepth >= samplePos.z

官方使用 View Space。

OpenGL 摄像机前方通常是负 Z。

例如：

~~~text
离摄像机近：z = -2
离摄像机远：z = -5
~~~

所以比较符号看起来会和“正深度”的直觉反过来。

官方代码：

~~~glsl
occlusion += (
    sampleDepth >= samplePos.z + bias
    ? 1.0
    : 0.0
);
~~~

不要死背 `>=`。

真正含义是：

> 如果屏幕上真实几何表面位于测试 Sample 的前面，那么这个 Sample 被遮挡。

## 18. Bias 为什么存在

和 Shadow Mapping 一样，数值误差会让非常靠近当前表面的 Sample 把“自己的表面”当成 Occluder。

官方：

~~~text
bias = 0.025
~~~

代码：

~~~glsl
sampleDepth >= samplePos.z + bias
~~~

Bias 太小：

~~~text
容易出现 acne / 自遮挡脏点
~~~

Bias 太大：

~~~text
真实的近距离接触阴影会被忽略
~~~

## 19. 为什么只做 Depth Compare 还不够

假设当前 Fragment 位于桌子边缘。

Sample 投影出去后可能刚好落到桌子后面很远的一堵墙上。

屏幕空间只知道：

~~~text
这个 UV 上有一层表面
~~~

但它不知道这层表面和当前 Fragment 是不是局部邻居。

于是远处墙可能错误贡献 AO。

这就是 LearnOpenGL 原文专门讲的 Edge / Range 问题。

## 20. Range Check 如何解决远处几何误判

官方：

~~~glsl
float rangeCheck = smoothstep(
    0.0,
    1.0,
    radius / abs(fragPos.z - sampleDepth)
);
~~~

如果：

~~~text
fragPos.z 和 sampleDepth 很接近
→ 很可能是附近表面
→ rangeCheck 接近 1
~~~

如果：

~~~text
两者深度差很大
→ 很可能只是投影碰到了远处几何
→ rangeCheck 接近 0
~~~

最后：

~~~glsl
occlusion += (
    sampleDepth >= samplePos.z + bias
    ? 1.0
    : 0.0
) * rangeCheck;
~~~

为什么使用 `smoothstep` 而不是简单：

~~~glsl
if (depthDifference < radius)
~~~

因为硬阈值会在 AO 范围边缘形成明显边界。

`smoothstep` 让贡献逐渐衰减。

## 21. 一整个 Kernel 跑完以后 AO 怎么得到

例如：

~~~text
kernelSize = 64
其中 16 个 Sample 被挡
~~~

先得到：

~~~text
occlusion = 16
~~~

然后：

~~~glsl
occlusion = 1.0 - (occlusion / kernelSize);
~~~

得到：

~~~text
AO = 1 - 16/64
   = 0.75
~~~

为什么要 `1 -`？

因为我们最终希望：

~~~text
1 = 不遮挡
0 = 强遮挡
~~~

这样可以直接乘 Ambient。

## 22. Raw SSAO 为什么会有明显 Noise Pattern

我们故意让每个区域随机旋转 Kernel。

这确实消除了规则 Banding，但代价就是：

~~~text
每个像素的估计结果会有随机抖动
~~~

于是 Raw AO Texture 看起来会有颗粒 / 重复噪声纹理。

这是设计的一部分，不是 Bug。

思路就是：

~~~text
规则 Banding
↓ random rotation
Noise
↓ blur
平滑 AO
~~~

## 23. Blur FBO 为什么又要单独一张纹理

官方在 SSAO Pass 和 Lighting Pass 中间加：

~~~text
ssaoBlurFBO
└─ ssaoColorBufferBlur
~~~

仍然只需要：

~~~text
GL_RED
~~~

因为 Blur 的还是单通道 AO。

## 24. 官方 Blur Shader 逐行看

~~~glsl
vec2 texelSize =
    1.0 / vec2(textureSize(ssaoInput, 0));
~~~

`textureSize` 返回纹理像素尺寸，例如：

~~~text
800 × 600
~~~

所以：

~~~text
texelSize = (1/800, 1/600)
~~~

这代表 UV 空间中“移动 1 个像素”的距离。

然后：

~~~glsl
float result = 0.0;

for (int x = -2; x < 2; ++x)
{
    for (int y = -2; y < 2; ++y)
    {
        vec2 offset =
            vec2(float(x), float(y))
            * texelSize;

        result +=
            texture(
                ssaoInput,
                TexCoords + offset
            ).r;
    }
}

FragColor = result / 16.0;
~~~

就是一个 4×4 Box Blur。

为什么正好 4×4？

因为 Noise Texture 本身也是 4×4，并且重复铺屏。

这个 Blur 尺度刚好能把主要的重复随机 Pattern 平滑掉。

## 25. 最后的 Lighting Pass 到底改了什么

前面的 Deferred Lighting 已经有：

~~~glsl
vec3 FragPos = texture(gPosition, TexCoords).rgb;
vec3 Normal  = texture(gNormal, TexCoords).rgb;
vec3 Diffuse = texture(gAlbedo, TexCoords).rgb;
~~~

现在再多读一张：

~~~glsl
float AmbientOcclusion =
    texture(ssao, TexCoords).r;
~~~

然后唯一关键变化：

~~~glsl
vec3 ambient = vec3(
    0.3
    * Diffuse
    * AmbientOcclusion
);
~~~

后面的 Direct Diffuse：

~~~glsl
vec3 diffuse =
    max(dot(Normal, lightDir), 0.0)
    * Diffuse
    * light.Color;
~~~

以及 Specular：

~~~glsl
float spec = pow(
    max(dot(Normal, halfwayDir), 0.0),
    8.0
);
~~~

并没有乘 SSAO。

所以必须区分：

~~~text
SSAO
→ 近似 Ambient / Indirect Occlusion

Shadow Mapping
→ 判断某个 Light 的 Direct Light Path 是否被挡
~~~

SSAO 不能替代 Shadow Mapping。

## 26. 为什么 View Space 里 viewDir = -FragPos

官方 Lighting Shader：

~~~glsl
vec3 viewDir = normalize(-FragPos);
~~~

这是因为：

~~~text
View Space Camera Position = (0,0,0)
~~~

所以：

~~~text
viewDir
= CameraPos - FragPos
= 0 - FragPos
= -FragPos
~~~

这也是统一 View Space 的一个便利。

## 27. CPU 到 GPU 的完整数据流

先在初始化阶段：

~~~text
CPU
├─ 生成 64 Hemisphere Samples
├─ 生成 16 个 Random Rotation Vectors
└─ 上传 4×4 Noise Texture
~~~

每一帧：

~~~text
Pass 1 · Geometry
Scene
→ gPosition / gNormal / gAlbedo

Pass 2 · SSAO
gPosition
+ gNormal
+ 64 Samples
+ 4×4 Noise
+ Projection
→ Raw AO

Pass 3 · Blur
Raw AO
→ Smooth AO

Pass 4 · Lighting
G-Buffer
+ Smooth AO
+ Light
→ Final Color
~~~

![SSAO Pipeline](https://huangyukun26.github.io/myOpengl-lab/static/img/ssao-pipeline.svg)

## 28. 四个 FBO / Buffer 之间到底存什么

可以把这一节所有中间数据列出来：

~~~text
G-Buffer FBO
├ gPosition : vec3 / float
├ gNormal   : vec3 / float
├ gAlbedo   : color
└ Depth

SSAO FBO
└ Raw AO : one float

SSAO Blur FBO
└ Smooth AO : one float

Default Framebuffer
└ Final Lighting Color
~~~

这样看就不抽象了：

SSAO 本质上就是利用 G-Buffer 再生成一张新的屏幕空间辅助纹理。

## 29. 参数该怎么理解和调

### kernelSize

~~~text
小
→ 快
→ 噪声 / Banding 更明显

大
→ 稳定
→ 性能更贵
~~~

官方示例用 64，但原文也明确说 64 有点多，可以尝试更少 Samples。

### radius

~~~text
小
→ 接触阴影精细

大
→ AO 范围更宽
→ 容易脏、容易大块发黑
~~~

### bias

~~~text
控制自遮挡误差
~~~

### noise kernel size

~~~text
影响随机旋转 Pattern 的重复尺度
~~~

### power

官方最后还建议可以：

~~~glsl
FragColor = pow(occlusion, power);
~~~

用于调 AO 强度。

不同场景没有唯一正确参数。

室内角落、人物、开放地形需要的 radius / kernelSize 都可能不同。

## 30. SSAO 的局限

因为它只依赖当前屏幕信息：

~~~text
屏幕外 Occluder 看不到
被前景完全挡住的几何看不到
相机移动时 AO 可能变化
边缘区域信息不足
~~~

因此 SSAO 是：

~~~text
快速、便宜、视觉有效
但不是物理准确 AO
~~~

它的价值在于给场景增加：

~~~text
接触感
墙角深度
物体贴地感
小缝隙层次
~~~

这也是为什么只看 Final 图时效果可能“不夸张”，但关掉以后场景会明显变得更飘、更平。

## 31. 看官方 SSAO Shader 时只抓这条主线

~~~glsl
fragPos
~~~

当前像素的 3D View-Space 位置。

~~~glsl
normal
~~~

当前表面朝向。

~~~glsl
randomVec
~~~

让 Kernel 每个区域随机转一点。

~~~glsl
TBN * samples[i]
~~~

把半球 Sample 转到当前表面方向。

~~~glsl
samplePos = fragPos + sample * radius
~~~

得到当前 Fragment 周围一个 3D 测试点。

~~~glsl
projection * samplePos
~~~

把这个 3D 点投影到屏幕。

~~~glsl
sampleDepth = texture(gPosition, offset.xy).z
~~~

看看这个屏幕位置真正存在的表面在哪里。

~~~glsl
sampleDepth vs samplePos.z
~~~

判断 Sample 是否被挡。

~~~glsl
rangeCheck
~~~

排除太远、只是投影碰巧撞到的表面。

~~~glsl
1.0 - occlusion / kernelSize
~~~

得到可以直接乘 Ambient 的 AO。

这就是官方 Shader 的完整逻辑。

## Interactive Lab

<form action="/myOpengl-lab/static/labs/ssao.html" method="get">
  <button type="submit">🎮 SSAO Lab · Kernel / Radius / Bias / Noise / Blur</button>
</form>

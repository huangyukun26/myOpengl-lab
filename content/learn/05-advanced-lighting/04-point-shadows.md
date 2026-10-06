---
title: 04 · Point Shadows 点阴影
description: 用深度 Cubemap 为点光源记录六个方向的最近距离，并在第二遍渲染中完成全方向阴影判断。
tags:
  - OpenGL
  - Advanced-Lighting
  - Point-Shadows
  - Cubemap
  - Shadow-Mapping
---

# Point Shadows 点阴影

## 从一张 Shadow Map 到六个方向

上一节的 Shadow Map 是一张 2D 深度纹理。它适合方向光或聚光灯，因为光源只需要覆盖一个主要方向。

点光源从一个位置向四周发光：

~~~text
          ↑
       ↖  |  ↗
    ←──── Light ────→
       ↙  |  ↘
          ↓
~~~

单张 2D Shadow Map 只能记录一个视锥，无法覆盖 360°。点阴影因此使用 **Depth Cubemap**：

~~~text
+X  -X  +Y  -Y  +Z  -Z
 \   |   |   |   |   /
      Depth Cubemap
~~~

Cubemap 的六个面都以光源位置为观察点，每个面使用 90° 透视投影。六个方向合起来覆盖光源周围的完整空间。

## 第一遍：生成 Depth Cubemap

先创建 Cubemap 的六张深度面：

~~~cpp
unsigned int depthCubemap;
glGenTextures(1, &depthCubemap);
glBindTexture(GL_TEXTURE_CUBE_MAP, depthCubemap);

for (unsigned int i = 0; i < 6; ++i)
{
    glTexImage2D(
        GL_TEXTURE_CUBE_MAP_POSITIVE_X + i,
        0,
        GL_DEPTH_COMPONENT,
        SHADOW_WIDTH,
        SHADOW_HEIGHT,
        0,
        GL_DEPTH_COMPONENT,
        GL_FLOAT,
        nullptr
    );
}
~~~

Depth Cubemap 不存颜色，每个方向保存的是：

~~~text
这个方向上离点光源最近的表面距离
~~~

六个方向都使用同一个 90° 透视投影：

~~~cpp
glm::mat4 shadowProj =
    glm::perspective(
        glm::radians(90.0f),
        1.0f,
        near_plane,
        far_plane
    );
~~~

然后从光源位置分别看向：

~~~text
+X
-X
+Y
-Y
+Z
-Z
~~~

官方代码构造六个矩阵：

~~~cpp
shadowTransforms.push_back(
    shadowProj * glm::lookAt(
        lightPos,
        lightPos + glm::vec3( 1, 0, 0),
        glm::vec3(0,-1, 0)
    )
);

// 其余五个方向同理
~~~

桌面 OpenGL 示例通过 Geometry Shader 把一个三角形分别发往 Cubemap 的六个 layer：

~~~glsl
for(int face = 0; face < 6; ++face)
{
    gl_Layer = face;

    for(int i = 0; i < 3; ++i)
    {
        FragPos = gl_in[i].gl_Position;
        gl_Position =
            shadowMatrices[face] * FragPos;

        EmitVertex();
    }

    EndPrimitive();
}
~~~

Depth Cubemap 本身并不依赖 Geometry Shader；也可以分别绑定六个 Cubemap face，渲染六遍。WebGL2 Lab 使用这种方式，因为 WebGL2 没有 Geometry Shader。

## 深度值改成到光源的距离

普通 Shadow Mapping 中，Shadow Map 使用光源投影后的深度。点阴影更适合直接保存：

~~~text
distance(fragment, light)
~~~

Depth Fragment Shader：

~~~glsl
in vec4 FragPos;

uniform vec3 lightPos;
uniform float far_plane;

void main()
{
    // 当前 Fragment 到点光源的实际距离
    float lightDistance =
        length(FragPos.xyz - lightPos);

    // Depth Texture 需要 [0,1]，用 far_plane 归一化
    lightDistance /= far_plane;

    // 写入当前 Cubemap face 的深度
    gl_FragDepth = lightDistance;
}
~~~

Cubemap 中保存的是径向距离：

~~~text
Depth Cubemap(direction)
=
这个方向上最近物体到 Light 的距离 / far_plane
~~~

## 第二遍：方向决定采哪一面，长度决定当前深度

当前 Fragment 和光源之间先得到一个向量：

~~~glsl
vec3 fragToLight =
    fragPos - lightPos;
~~~

这个向量同时包含方向和距离。

方向决定 Cubemap 采样：

~~~text
normalize(fragToLight)
→ +X / -X / +Y / -Y / +Z / -Z
~~~

长度就是当前片段到光源的距离：

~~~glsl
float currentDepth =
    length(fragToLight);
~~~

读取 Cubemap：

~~~glsl
float closestDepth =
    texture(depthMap, fragToLight).r;

// 第一遍存的是 distance / far_plane
// 这里恢复实际距离
closestDepth *= far_plane;
~~~

Shadow Test：

~~~glsl
float bias = 0.05;

float shadow =
    currentDepth - bias > closestDepth
    ? 1.0
    : 0.0;
~~~

数据流：

~~~text
fragPos - lightPos
        ↓
   fragToLight
     /       \
direction   length
   ↓          ↓
Cubemap    currentDepth
   ↓
closestDepth
     \       /
      compare
        ↓
      shadow
~~~

相比上一节，这里不再需要把 Fragment 变换成一张 2D Shadow Map 的 UV。Cubemap 直接使用三维方向向量查找。

## Point Shadow PCF

单次 Cubemap 采样仍然会产生硬边缘。点阴影的 PCF 不在 2D UV 周围移动，而是在三维采样方向周围加入小偏移：

~~~glsl
float shadow = 0.0;

for(int i = 0; i < 20; ++i)
{
    float closestDepth =
        texture(
            depthMap,
            fragToLight
            + gridSamplingDisk[i] * diskRadius
        ).r;

    closestDepth *= far_plane;

    if(currentDepth - bias > closestDepth)
        shadow += 1.0;
}

shadow /= 20.0;
~~~

20 个偏移方向分布在三维空间中。每次采样稍微改变 Cubemap 查询方向，再把结果平均。

官方软阴影版本还让采样半径随相机距离变化：

~~~glsl
float viewDistance =
    length(viewPos - fragPos);

float diskRadius =
    (1.0 + viewDistance / far_plane)
    / 25.0;
~~~

## 两遍渲染

~~~text
Pass 1 · Point Light

Scene
↓
Light Position
↓
6 × 90° Perspective
↓
+X -X +Y -Y +Z -Z
↓
Depth Cubemap
~~~

~~~text
Pass 2 · Camera

Fragment
↓
fragToLight = fragPos - lightPos
↓
direction → sample Depth Cubemap
length    → currentDepth
↓
currentDepth vs closestDepth
↓
shadow
↓
Lighting
~~~

两类 Shadow Map 的查询方式不同：

~~~text
Directional / Spot
2D Shadow Map
Light Space → UV + depth

Point Light
Depth Cubemap
3D direction + radial distance
~~~

## Interactive Lab

<form action="/myOpengl-lab/static/labs/point-shadows.html" method="get">
  <button type="submit">🎮 Point Shadows Lab</button>
</form>

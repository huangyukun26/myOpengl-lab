---
title: 06 · Cubemaps 立方体贴图
description: 用一个 3D 方向向量采样六面环境纹理，并由此理解 Skybox、Reflection 与 Refraction。
tags:
  - OpenGL
  - Advanced-OpenGL
  - Cubemap
  - Skybox
  - Environment-Mapping
---

# Cubemaps 立方体贴图

**LearnOpenGL 顺序：Advanced OpenGL → Cubemaps**  ·  [原教程](https://learnopengl-cn.github.io/04%20Advanced%20OpenGL/06%20Cubemaps/)

## 先抓住唯一的新东西

普通 2D Texture：

`vec2 UV → sampler2D → color`

Cubemap：

`vec3 direction → samplerCube → 自动命中六个面之一 → color`

所以 Cubemap 最重要的变化不是“纹理变成六张”，而是**索引方式从 2D 坐标变成了空间方向**。方向向量的长度不重要，朝哪边才重要。

```glsl
uniform samplerCube skybox;
vec3 color = texture(skybox, direction).rgb;
```

六个面被放进同一个 `GL_TEXTURE_CUBE_MAP` 对象：

```cpp
glBindTexture(GL_TEXTURE_CUBE_MAP, cubemapTexture);

for (unsigned int i = 0; i < 6; ++i)
{
    glTexImage2D(
        GL_TEXTURE_CUBE_MAP_POSITIVE_X + i,
        0, GL_RGB, width, height, 0,
        GL_RGB, GL_UNSIGNED_BYTE, data
    );
}
```

通常还会对 `S / T / R` 三个方向都设 `GL_CLAMP_TO_EDGE`，减少六个面边缘采样时的接缝。

## Skybox 为什么能工作

Skybox 只是一个把相机包在里面的 Cube。它的顶点位置本身就是从原点指向 Cube 表面的方向，因此可以直接拿来当 cubemap sampling direction：

```glsl
TexCoords = aPos;
FragColor = texture(skybox, TexCoords);
```

但我们不希望“向前走几米，天空也靠近几米”。所以 Skybox 使用 Camera 的旋转，却去掉 View Matrix 的平移：

```cpp
glm::mat4 view = glm::mat4(glm::mat3(camera.GetViewMatrix()));
```

结果是：**你可以转头看不同方向，但永远走不到天空盒边缘。**

教程进一步把 Skybox 放到最后画，并在 Vertex Shader 中：

```glsl
vec4 pos = projection * view * vec4(aPos, 1.0);
gl_Position = pos.xyww;
```

透视除法后 `z = w / w = 1.0`，也就是最远深度；配合：

```cpp
glDepthFunc(GL_LEQUAL);
```

Skybox 只会填那些前面没有真实物体的像素。

## Environment Mapping：同一个 Cubemap，不只是背景

反射真正做的是：

`Camera → Fragment 的入射方向 I + Surface Normal N → reflect → R → samplerCube`

```glsl
vec3 I = normalize(Position - cameraPos);
vec3 R = reflect(I, normalize(Normal));
FragColor = vec4(texture(skybox, R).rgb, 1.0);
```

所以镜面物体不是“把 Skybox 图片贴到表面”，而是**每个 fragment 根据自己的法线和观察方向，算一个不同的环境采样方向。**

折射也一样，只是把 `reflect` 换成 `refract`：

```glsl
float ratio = 1.0 / 1.52; // air → glass
vec3 I = normalize(Position - cameraPos);
vec3 R = refract(I, normalize(Normal), ratio);
FragColor = vec4(texture(skybox, R).rgb, 1.0);
```

## 它在 Pipeline Map 哪里

Cubemap **不是新的固定渲染阶段**。它是一种 Texture Resource，通常在 Fragment Shader 中通过 `samplerCube` 被采样。

`Geometry → Rasterization → Fragment Shader ↔ Cubemap Texture → Depth/Blend → Framebuffer`

这也是为什么这节的 Pipeline Map 把 Cubemap 画成 Fragment Shader 的侧边资源，而不是硬塞进线性管线。

## Interactive Lab

<form action="/myOpengl-lab/static/labs/cubemaps.html" method="get">
  <button type="submit">🎮 打开 Cubemap / Skybox Lab</button>
</form>

Lab 直接加载 LearnOpenGL 官方 `resources/textures/skybox` 六张图，并提供：

- `Reflection / Refraction / Normal Debug`
- Sphere / Cube 切换
- 折射率 IOR 调节
- 开关“移除 View Translation”，直接看 Skybox 为什么必须跟随相机中心
- 开关教程的 `Skybox Last + pos.xyww + LEQUAL` 优化
- Direction Sampling Microscope：拖动 `(x,y,z)`，看方向到底命中 `+X/-X/+Y/-Y/+Z/-Z` 哪一面

## 和上一节 Framebuffer 串起来

静态 Cubemap 只包含预先拍好的环境，不包含场景里会动的物体。

如果想让镜面物体真的反射周围动态对象，可以把上一节 FBO 拿回来：从物体位置朝 `+X/-X/+Y/-Y/+Z/-Z` **把场景渲染六次**，分别写入 Cubemap 六个面，再让物体采样这个动态 Cubemap。

这就是 Dynamic Environment Mapping。效果更真实，但代价也很直观：**一个环境探针可能意味着额外 6 次场景渲染。**

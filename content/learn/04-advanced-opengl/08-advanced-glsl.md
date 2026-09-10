---
title: 08 · Advanced GLSL 高级 GLSL
description: 从 GLSL 内建变量、接口块到 Uniform Buffer Object，理解 Shader 之间与 CPU→Shader 的数据接口。
tags:
  - OpenGL
  - Advanced-OpenGL
  - GLSL
  - UBO
---

# Advanced GLSL 高级 GLSL

**LearnOpenGL 顺序：Advanced OpenGL → Advanced GLSL** · [原教程](https://learnopengl-cn.github.io/04%20Advanced%20OpenGL/08%20Advanced%20GLSL/)

这一节没有增加新的绘制阶段，而是在整理 **Shader 能从哪里拿数据、怎样把数据传给下一个 Shader、怎样让多个 Shader 共享同一批 uniform**。

## GLSL 内建变量：有些数据不用自己声明接口

以前 Vertex Shader 最常见的是自己声明 `in`，再写 `gl_Position`。GLSL 还提供了一批 `gl_` 开头的内建变量，它们由管线直接提供或接收。

顶点阶段常见的有：

```glsl
gl_Position   // 顶点最终的裁剪空间位置
gl_PointSize  // GL_POINTS 的点大小
gl_VertexID   // 当前顶点编号
```

例如：

```glsl
void main()
{
    gl_Position = ...;
    gl_PointSize = 5.0 + float(gl_VertexID) * 4.0;
}
```

如果用 `GL_POINTS` 绘制，不同顶点就可以直接产生不同大小的点。

Fragment Shader 里常见的有：

```glsl
gl_FragCoord     // 当前 fragment 的窗口坐标，z 是深度
gl_FrontFacing   // 当前 fragment 来自正面还是背面
gl_FragDepth     // 手动写 fragment 的深度
```

`gl_FragDepth` 很强，但一旦 Fragment Shader 可能任意改深度，GPU 往往不能放心地提前做深度测试。桌面 OpenGL 4.2+ 可以通过 conservative depth layout 告诉驱动深度只会往某个方向改，从而保留更多 Early-Z 优化。

## Interface Block：把跨 Shader 的 varying 组成一个接口

当 Vertex Shader 只传一个 `TexCoords` 时，分别声明 `out` / `in` 很简单；变量多以后，可以把它们组成一个块。

Vertex Shader：

```glsl
out VS_OUT
{
    vec3 FragPos;
    vec3 Normal;
    vec2 TexCoords;
} vs_out;
```

Fragment Shader：

```glsl
in VS_OUT
{
    vec3 FragPos;
    vec3 Normal;
    vec2 TexCoords;
} fs_in;
```

这里重要的是 **块的接口要匹配**。它解决的是 Shader 阶段之间的数据组织问题，不是额外的 GPU Buffer。

可以把它理解成：

```text
Vertex Shader
   ↓
VS_OUT { FragPos, Normal, TexCoords }
   ↓
Rasterization / interpolation
   ↓
Fragment Shader
```

## UBO：把多个 uniform 装进一个 Buffer

这一节最重要的工具是 Uniform Buffer Object。

以前四个 Shader 都需要 `projection` 和 `view`，通常要分别：

```text
Shader Red    ← projection + view
Shader Green  ← projection + view
Shader Blue   ← projection + view
Shader Yellow ← projection + view
```

同样的数据重复设置四遍。

UBO 把它变成：

```text
             UBO: Matrices
          [ projection | view ]
             ↑ binding point 0
        ┌────┼────┬────┐
        ↓    ↓    ↓    ↓
      Red  Green Blue Yellow
```

Shader 里声明统一的 Uniform Block：

```glsl
layout (std140) uniform Matrices
{
    mat4 projection;
    mat4 view;
};
```

CPU 创建 `GL_UNIFORM_BUFFER`，把这块 Buffer 绑定到某个 binding point，再把每个 Shader Program 的 `Matrices` block 指向同一个 binding point。

```cpp
GLuint index = glGetUniformBlockIndex(shader.ID, "Matrices");
glUniformBlockBinding(shader.ID, index, 0);

glBindBuffer(GL_UNIFORM_BUFFER, uboMatrices);
glBufferData(GL_UNIFORM_BUFFER,
             2 * sizeof(glm::mat4),
             NULL,
             GL_STATIC_DRAW);

glBindBufferRange(GL_UNIFORM_BUFFER,
                  0,
                  uboMatrices,
                  0,
                  2 * sizeof(glm::mat4));
```

之后只更新这一个 Buffer：

```cpp
glBindBuffer(GL_UNIFORM_BUFFER, uboMatrices);
glBufferSubData(GL_UNIFORM_BUFFER,
                sizeof(glm::mat4),
                sizeof(glm::mat4),
                glm::value_ptr(view));
```

四个 Shader 都能读到新的 `view`。

这正好接上上一节 Advanced Data：**UBO 仍然是 Buffer Object，只是 Target 换成了 `GL_UNIFORM_BUFFER`，里面的字节按 Uniform Block 的布局规则解释。**

## 为什么有 std140

GPU 读取 uniform block 时需要明确每个成员在 Buffer 里的偏移。`std140` 给出一套标准化对齐规则，让 CPU 可以按规则准备内存，不必依赖每个驱动自己的布局。

初学阶段先记住两点就够：

```text
std140 = 一套固定的对齐/排布规则
mat4   = 4 个 vec4 列，通常占 64 bytes
```

所以教程里：

```text
projection mat4 → offset 0
view       mat4 → offset 64 bytes
```

后面遇到 `vec3 + float`、数组、结构体时，再具体算 std140 对齐。

## model 为什么没有也塞进这个 UBO

教程的四个立方体共享：

```text
projection
view
```

但每个立方体自己的位置不同，所以 `model` 不共享。

因此：

```text
UBO / Matrices
→ projection + view
→ 多个 Shader / 多个物体共用

普通 model uniform
→ 每个物体单独设置
```

这就是 UBO 最适合的使用场景：**一批 Shader 都需要、而且更新频率相同的数据。**

## Interactive Lab

<form action="/myOpengl-lab/static/labs/advanced-glsl.html" method="get">
  <button type="submit">🎮 打开 Advanced GLSL Lab</button>
</form>

Lab 复现教程的四个不同 Shader Program：红、绿、黄、蓝四个物体共享一个 `Matrices` UBO。改变 Camera / Projection 时，只更新这一块 UBO；每个物体仍使用自己的 `model` uniform。页面同时展示 `gl_VertexID / gl_PointSize` 与常用 Fragment built-in 的含义。

## 放回渲染管线

这一节主要改的是 **数据接口**：

```text
Buffer / Uniform Buffer
        ↓
Vertex Shader → Interface → Fragment Shader
        ↑                ↑
   built-in variables   built-in variables
```

它不是新的线性 Stage。重点是把原来零散的 Shader 输入输出，整理成更清楚、更可共享的数据通道。
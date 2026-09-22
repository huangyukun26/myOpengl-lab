---
title: 10 · Instancing 实例化
description: 理解实例化如何用一次 Draw Call 重复绘制同一份 Mesh，并用 gl_InstanceID、Instanced Array 与 mat4 实例属性提供逐实例数据。
tags:
  - OpenGL
  - Advanced-OpenGL
  - Instancing
---

# Instancing 实例化

**LearnOpenGL 顺序：Advanced OpenGL → Instancing** · [原教程](https://learnopengl-cn.github.io/04%20Advanced%20OpenGL/10%20Instancing/)

实例化解决的不是“GPU 不会画很多三角形”，而是另一件事：

> **当很多物体共享同一份 Mesh 时，不要让 CPU 为每个物体重复发一次 Draw Call。**

普通绘制大量相同物体时，逻辑通常像：

```cpp
for (int i = 0; i < amount; ++i)
{
    shader.setMat4("model", models[i]);
    glDrawElements(...);
}
```

如果有 10,000 个石头，就可能有 10,000 次 Draw Call。每个石头本身也许很简单，但 CPU 必须不断告诉 OpenGL“再画一次”，这部分命令提交和状态准备会形成瓶颈。

实例化把它变成：

```cpp
glDrawElementsInstanced(..., amount);
```

于是数据流变成：

```text
CPU
│
├─ 上传一份 Mesh
├─ 上传一批 per-instance 数据
│
└─ 只发 1 次 Draw Call
       ↓
GPU
重复执行 Vertex Shader
instance 0
instance 1
instance 2
...
instance N-1
```

## 同一份顶点数据，为什么还能画到不同位置

如果只重复同一个 Mesh，没有额外数据：

```text
instance 0 ─┐
instance 1 ─┼─ 同样的位置
instance 2 ─┤
...         ┘
```

它们会完全重叠。

所以实例化的关键不是“重复画”，而是：

> **哪些数据是 per-vertex，哪些数据是 per-instance。**

一个石头 Mesh 的局部顶点属于 per-vertex：

```text
position
normal
texCoord
```

而每个石头自己的：

```text
position / offset
rotation
scale
model matrix
color
```

属于 per-instance。

最简单的区分方式是 `gl_InstanceID`：

```glsl
void main()
{
    // instanced draw 时：
    // 0, 1, 2, 3 ...
    int id = gl_InstanceID;
}
```

一次实例化 Draw Call 里，每个实例都会得到自己的 ID。

## Instanced Array：属性不是每个 Vertex 都前进一次

教程前半先用 100 个四边形说明实例化。更实用的版本是把每个实例的 offset 放进一个 VBO：

```cpp
glBindBuffer(GL_ARRAY_BUFFER, instanceVBO);
glBufferData(GL_ARRAY_BUFFER,
             sizeof(glm::vec2) * 100,
             translations,
             GL_STATIC_DRAW);
```

它看上去仍然是 Vertex Attribute：

```glsl
layout (location = 2) in vec2 aOffset;
```

区别发生在：

```cpp
glVertexAttribDivisor(2, 1);
```

普通顶点属性默认可以理解成：

```text
divisor = 0

vertex 0 → 读下一份 attribute
vertex 1 → 读下一份 attribute
vertex 2 → 读下一份 attribute
...
```

而：

```text
divisor = 1

instance 0 的所有 vertices → 使用 offset[0]
instance 1 的所有 vertices → 使用 offset[1]
instance 2 的所有 vertices → 使用 offset[2]
...
```

所以同一次 Vertex Shader invocation 同时拿到了两种节奏的数据：

```text
Mesh VBO
position / normal / uv
      ↓ 每个 vertex 前进

Instance VBO
offset / color / model matrix
      ↓ 每个 instance 前进

            ↓
       Vertex Shader
```

这就是 Instanced Array。

## 为什么 mat4 会占 4 个 Attribute Location

小行星带真正需要的不是一个 `vec2 offset`，而是每个石头自己的完整 Model Matrix：

```glsl
layout (location = 3) in mat4 aInstanceMatrix;
```

但硬件的 vertex attribute slot 本质上最多承载一个四分量向量，所以一个 `mat4` 会拆成四列：

```text
location 3 → column 0
location 4 → column 1
location 5 → column 2
location 6 → column 3
```

因此 CPU 端会为四个 location 都设置 pointer：

```cpp
glVertexAttribPointer(3, 4, GL_FLOAT, GL_FALSE, sizeof(glm::mat4), (void*)0);
glVertexAttribPointer(4, 4, GL_FLOAT, GL_FALSE, sizeof(glm::mat4), (void*)(sizeof(glm::vec4)));
glVertexAttribPointer(5, 4, GL_FLOAT, GL_FALSE, sizeof(glm::mat4), (void*)(2 * sizeof(glm::vec4)));
glVertexAttribPointer(6, 4, GL_FLOAT, GL_FALSE, sizeof(glm::mat4), (void*)(3 * sizeof(glm::vec4)));
```

然后四列都设：

```cpp
glVertexAttribDivisor(3, 1);
glVertexAttribDivisor(4, 1);
glVertexAttribDivisor(5, 1);
glVertexAttribDivisor(6, 1);
```

这样 Vertex Shader 对同一个 instance 的所有顶点都会读到同一张 Model Matrix：

```glsl
gl_Position =
    projection *
    view *
    aInstanceMatrix *
    vec4(aPos, 1.0);
```

## 小行星带：实例化真正省掉的是什么

教程最后的小行星场景里，大量岩石共享同一份 Rock Mesh，但每颗岩石有不同的：

```text
translation
rotation
scale
```

普通方式：

```text
rock 0 → model uniform → Draw Call
rock 1 → model uniform → Draw Call
rock 2 → model uniform → Draw Call
...
```

实例化：

```text
一次上传很多 model matrices
          ↓
Instance Matrix Buffer
          ↓ divisor = 1
同一份 Rock VAO
          ↓
glDrawElementsInstanced(..., amount)
          ↓
很多颗不同位置 / 角度 / 大小的岩石
```

所以实例化节省的核心是：

> **重复物体不再重复提交 Draw Call；Mesh 仍然只存一份，变化的数据单独按 instance 提供。**

它并不会让 GPU 少处理那些最终真的要画的顶点。100,000 个实例依然意味着大量 Vertex Shader 和 Fragment Shader 工作。它优化的是 CPU → GPU 的命令提交和状态切换成本。

## 和已经学过的 Buffer / VAO 怎么接起来

实例化没有发明一个完全陌生的新资源。它还是以前学过的东西：

```text
Mesh VBO
  ↓ glVertexAttribPointer
VAO
  │
  ├─ per-vertex attribute
  │
Instance VBO
  ↓ glVertexAttribPointer
  ↓ glVertexAttribDivisor(..., 1)
VAO
  │
  └─ per-instance attribute
       ↓
glDraw*Instanced
       ↓
Vertex Shader
```

所以可以把它理解成：

> **同一个 VAO 里，允许存在两种不同“前进频率”的 Attribute。**

一个跟着 Vertex 走，一个跟着 Instance 走。

## Interactive Lab

<form action="/myOpengl-lab/static/labs/instancing.html" method="get">
  <button type="submit">🎮 打开 Instancing Lab</button>
</form>

Lab 使用 WebGL2 的真实实例化 API：`drawArraysInstanced`、`vertexAttribDivisor` 和 `gl_InstanceID`。其中最后一个实验会把同一份低模岩石 Mesh 实例化成小行星带，用同一个 Draw Call 绘制大量不同 Model Matrix 的实例。

---

上一节：[[learn/04-advanced-opengl/09-geometry-shader|09 · Geometry Shader 几何着色器]]

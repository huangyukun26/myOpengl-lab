---
title: 09 · Geometry Shader 几何着色器
description: 理解 Geometry Shader 如何按图元接收 Vertex Shader 输出，并生成新的点、线或三角形。
tags:
  - OpenGL
  - Advanced-OpenGL
  - Geometry-Shader
---

# Geometry Shader 几何着色器

**LearnOpenGL 顺序：Advanced OpenGL → Geometry Shader** · [原教程](https://learnopengl-cn.github.io/04%20Advanced%20OpenGL/09%20Geometry%20Shader/)

## 这一节在渲染管线中的位置

<iframe src="https://huangyukun26.github.io/myOpengl-lab/static/labs/pipeline/09-geometry-shader.html" title="OpenGL 09-geometry-shader pipeline" style="width:100%;height:520px;border:0;border-radius:16px;display:block;"></iframe>


## 它插在 Vertex Shader 和 Rasterization 中间

以前可以把顶点阶段想成：

```text
Vertex Data
   ↓
Vertex Shader        一次处理一个顶点
   ↓
Primitive Assembly  把顶点组成 point / line / triangle
   ↓
Rasterization
```

加入 Geometry Shader 后：

```text
Vertex Shader
   ↓
Primitive Assembly
   ↓
Geometry Shader      一次拿到一个完整图元
   ↓                  可以输出 0 个、1 个或多个新图元
Rasterization
```

区别就在这里：**Vertex Shader 看单个顶点，Geometry Shader 看完整图元。**

如果输入是一个三角形，Geometry Shader 可以同时访问三个顶点：

```glsl
layout (triangles) in;

void main()
{
    vec4 p0 = gl_in[0].gl_Position;
    vec4 p1 = gl_in[1].gl_Position;
    vec4 p2 = gl_in[2].gl_Position;
}
```

因此它能做一些“必须知道整个图元”才方便做的事情，例如求三角形面法线、把整个面沿法线推开，或者从一个点现场生成一组新顶点。

## 输入和输出都要声明图元类型

Geometry Shader 开头会声明它接收什么：

```glsl
layout (triangles) in;
```

常见输入包括：

```text
points
lines
triangles
lines_adjacency
triangles_adjacency
```

然后声明它准备输出什么，以及一次 invocation 最多输出多少顶点：

```glsl
layout (triangle_strip, max_vertices = 5) out;
```

输出图元只有三类：

```text
points
line_strip
triangle_strip
```

`max_vertices` 是上限，不代表每次必须输出这么多。

真正把一个输出顶点提交出去的是：

```glsl
EmitVertex();
```

结束当前输出图元：

```glsl
EndPrimitive();
```

可以把它理解成：

```text
设置 gl_Position
↓
EmitVertex()      把当前输出变量打包成一个新顶点
↓
继续改 gl_Position
↓
EmitVertex()
↓
EndPrimitive()   当前 strip 到此结束
```

## 从一个点生成一座房子

官方第一个例子输入的是 `GL_POINTS`。每个输入点进入 Geometry Shader 后，被扩展成 5 个顶点的 `triangle_strip`：

```glsl
layout (points) in;
layout (triangle_strip, max_vertices = 5) out;
```

核心数据流：

```text
一个 point
   ↓ Geometry Shader
读取 gl_in[0].gl_Position
   ↓
围绕它构造 5 个新位置
   ↓ EmitVertex × 5
一个 house-shaped triangle strip
```

这就是 Geometry Shader 最直观的能力：**输入图元和输出图元可以不是同一种东西，顶点数量也可以改变。**

需要传颜色之类的数据时，Vertex Shader 的输出仍然可以通过 Interface Block 进入 Geometry Shader，只是 Geometry Shader 的输入是数组，因为它一次拿到整个图元：

```glsl
in VS_OUT {
    vec3 color;
} gs_in[];
```

## 爆炸效果：整个三角形一起沿面法线移动

第二个例子输入三角形：

```glsl
layout (triangles) in;
layout (triangle_strip, max_vertices = 3) out;
```

由于 Geometry Shader 同时知道三个顶点，可以直接算当前面的法线：

```text
p0, p1, p2
   ↓
a = p0 - p1
b = p2 - p1
   ↓
normalize(cross(a, b))
   ↓
triangle face normal
```

然后对三个顶点加上**同一个沿面法线的位移**：

```text
p0 ─┐
p1 ─┼─ + normal × distance
p2 ─┘
```

三角形形状本身没有被拉扯，只是整块面向外移动，于是模型看起来像一块块炸开。

关键点不是“Geometry Shader 会爆炸”，而是：

> **它一次拿到整个 triangle，因此能先计算这个 triangle 的共同信息，再统一处理它的所有顶点。**

## 法线可视化：给每个顶点现场生成一条线

第三个例子把三角形作为输入，但输出 `line_strip`：

```glsl
layout (triangles) in;
layout (line_strip, max_vertices = 6) out;
```

对每个顶点输出两个点：

```text
vertex position
      ↓
EmitVertex

vertex position + normal × length
      ↓
EmitVertex
EndPrimitive
```

三个输入顶点各生成一条线，所以最多 6 个输出顶点。

这类用法很适合 Debug：原模型照常绘制，再额外用一个 Geometry Shader pass 把法线画出来。

## 它在 Pipeline 里的真正位置

这一节会真正多出一个可编程阶段：

```text
Vertex Data
   ↓
Vertex Shader
   ↓
Primitive Assembly
   ↓
Geometry Shader
   │  gl_in[]
   │  EmitVertex()
   │  EndPrimitive()
   ↓
Rasterization
   ↓
Fragment Shader
```

因此它和上一节 UBO 不一样。UBO 是 Shader 使用的数据资源；Geometry Shader 本身就是一个新的 Shader Stage。

它很灵活，但也不要把所有几何生成都塞进去。Geometry Shader 以图元为单位工作，扩大输出顶点数量时容易成为吞吐瓶颈。现代实时渲染里很多批量几何工作会更倾向 instancing、compute shader、mesh shader 等方式。不过理解 Geometry Shader 仍然很重要，因为它把“顶点处理”和“图元处理”的区别讲得非常清楚。

## Interactive Lab

<form action="/myOpengl-lab/static/labs/geometry-shader.html" method="get">
  <button type="submit">🎮 打开 Geometry Shader Lab</button>
</form>

浏览器的 WebGL2 **没有 Geometry Shader stage**。所以这个 Lab 不会伪装成真正的 WebGL Geometry Shader，而是严格按照桌面 OpenGL 的输入/输出语义，把 `gl_in[] → EmitVertex → EndPrimitive` 的结果可视化：点生成房子、三角形爆炸、法线生成线段。真正的 GLSL 代码仍以 LearnOpenGL 的桌面 OpenGL 版本为准。

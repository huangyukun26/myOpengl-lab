---
title: 07 · Advanced Data 高级数据
description: 理解 Buffer Object 的内存分配、局部更新、顶点属性布局与 Buffer 复制。
tags:
  - OpenGL
  - Advanced-OpenGL
  - Buffer
  - VBO
---

# Advanced Data 高级数据

**LearnOpenGL 顺序：Advanced OpenGL → Advanced Data** · [原教程](https://learnopengl-cn.github.io/04%20Advanced%20OpenGL/07%20Advanced%20Data/)

## Buffer Object 本质上是一块内存

OpenGL 的 Buffer Object 可以先理解成一块由 GPU/驱动管理的连续内存。`GL_ARRAY_BUFFER`、`GL_ELEMENT_ARRAY_BUFFER` 等名字不是 Buffer 自己永久拥有的类型，而是它当前绑定到的 **Buffer Target**。Target 决定接下来的 API 怎样解释这块 Buffer。

过去最常见的写法是：

```cpp
glBindBuffer(GL_ARRAY_BUFFER, VBO);
glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
```

这里 `glBufferData` 同时做了两件事：分配容量，并把 `vertices` 写进去。

如果把 data 传 `NULL`：

```cpp
glBufferData(GL_ARRAY_BUFFER, totalSize, NULL, GL_STATIC_DRAW);
```

就只分配容量，不立刻填内容。之后可以用 `glBufferSubData` 按 offset 更新某一段：

```cpp
glBufferSubData(GL_ARRAY_BUFFER, offset, size, data);
```

因此两者的关系可以概括为：

```text
BufferData    → 建立/重新建立整块存储
BufferSubData → 在已经存在的存储里更新一个范围
```

`glBufferSubData` 不会自动把 Buffer 扩大，所以目标范围必须落在已经分配好的容量内。教程还介绍了 `glMapBuffer`：OpenGL 把 Buffer 内存映射成 CPU 可访问的指针，程序完成写入后再 `glUnmapBuffer`。这个接口在桌面 OpenGL 中常见；浏览器里的 WebGL2 没有直接对应的 `mapBuffer`，所以本站实验重点放在 `bufferSubData` 与 Buffer 复制。

## 顶点数据可以有不同内存布局

之前常用的是交错布局：

```text
P N UV | P N UV | P N UV
```

一个顶点的位置、法线、纹理坐标放在一起。此时 `glVertexAttribPointer` 的 stride 是一个完整顶点的大小，不同属性通过 offset 找到各自起点。

也可以把相同属性连续放置：

```text
P P P | N N N | UV UV UV
```

这就是教程中的 Batched 布局。它特别适合手里本来就是 `positions[]`、`normals[]`、`texcoords[]` 三个独立数组的情况：先一次性预留总容量，再把三个数组写到不同区间。

```cpp
glBufferData(GL_ARRAY_BUFFER, totalSize, NULL, GL_STATIC_DRAW);
glBufferSubData(GL_ARRAY_BUFFER, 0, sizeof(positions), positions);
glBufferSubData(GL_ARRAY_BUFFER, sizeof(positions), sizeof(normals), normals);
glBufferSubData(GL_ARRAY_BUFFER, sizeof(positions) + sizeof(normals), sizeof(tex), tex);
```

这两种布局都能正确绘制。区别在于内存排列和属性指针的 stride / offset。教程仍更推荐交错布局，因为一次 Vertex Shader 调用需要的属性在内存中更靠近。

## Buffer 之间可以直接复制

如果数据已经在一个 Buffer 里，不一定要先读回 CPU，再上传到另一个 Buffer。`glCopyBufferSubData` 可以直接复制指定范围。

当源和目标都需要作为普通 `GL_ARRAY_BUFFER` 使用时，无法同时把两个 Buffer 绑定到同一个 target，因此 OpenGL 提供：

```cpp
GL_COPY_READ_BUFFER
GL_COPY_WRITE_BUFFER
```

例如：

```cpp
glBindBuffer(GL_COPY_READ_BUFFER, vbo1);
glBindBuffer(GL_COPY_WRITE_BUFFER, vbo2);
glCopyBufferSubData(
    GL_COPY_READ_BUFFER,
    GL_COPY_WRITE_BUFFER,
    0, 0, size
);
```

这里复制的是 Buffer 里的字节，不关心这些字节代表 Position、Normal 还是别的数据。

## 它在渲染管线里的位置

这一节没有增加新的固定渲染阶段。它研究的是 **Vertex Data 进入 Vertex Shader 之前，Buffer 里的数据怎样组织和搬运**。

```text
CPU data
   ↓
Buffer Object / VBO
   ├─ glBufferData      分配 / 整体上传
   ├─ glBufferSubData   局部更新
   ├─ glMapBuffer       映射内存（桌面 OpenGL）
   └─ glCopyBufferSubData  Buffer → Buffer
   ↓
VAO / glVertexAttribPointer
   ↓
Vertex Shader
```

因此这节真正需要建立的是“Buffer = 内存 + Target 解释方式”的模型，而不是记一组孤立 API。

## Interactive Lab

<form action="/myOpengl-lab/static/labs/advanced-data.html" method="get">
  <button type="submit">🎮 打开 Advanced Data Lab</button>
</form>

Lab 包含三组操作：预留 Buffer 后用 `bufferSubData` 写不同区间；切换 Interleaved / Batched 布局并观察 stride 与 offset；把 VBO A 的内容直接复制到 VBO B 后切换绘制来源。

## 和下一节的关系

下一节 Advanced GLSL 会介绍 Uniform Buffer Object。到了那里，`glBufferSubData` 不再只是“操作 VBO 的另一种方法”，而会直接用于更新一块由多个 Shader 共享的 Uniform Buffer。本节是在为后面的 Buffer 管理方式打基础。

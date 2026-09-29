---
title: 01 · Advanced Lighting 高级光照
description: 从 Phong 的反射向量问题出发，理解 Blinn-Phong 为什么使用 Halfway Vector，以及两种镜面高光模型之间的几何关系。
tags:
  - OpenGL
  - Advanced-Lighting
  - Phong
  - Blinn-Phong
---

# Advanced Lighting 高级光照

**LearnOpenGL 顺序：Advanced Lighting → Advanced Lighting** · [原教程](https://learnopengl-cn.github.io/05%20Advanced%20Lighting/01%20Advanced%20Lighting/)

## 这一节在渲染管线中的位置

<iframe src="https://huangyukun26.github.io/myOpengl-lab/static/labs/pipeline/al-01-advanced-lighting.html" title="Advanced Lighting pipeline" style="width:100%;height:540px;border:0;border-radius:16px;display:block;"></iframe>

这一节没有增加新的渲染阶段。它改的是 **Fragment Shader 里“镜面高光怎么计算”**。

以前我们用 Phong：

~~~text
Light
  ↓
表面法线 N
  ↓ reflect()
反射方向 R

再比较：
R 和观察方向 V 有多接近
~~~

镜面项：

~~~glsl
vec3 reflectDir = reflect(-lightDir, normal);
float spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
~~~

这套方法大多数时候很好，但在 shininess 很低、高光区域很宽的时候会暴露一个问题：当 V 和 R 的夹角超过 90°，点积直接变成负数，经过 max(..., 0) 后整块镜面贡献突然变成 0，于是高光边缘会出现明显断层。

## Blinn-Phong 为什么换成 Halfway Vector

Blinn-Phong 不再问：

~~~text
“观察方向 V 和完美反射方向 R 有多接近？”
~~~

而是问：

~~~text
“法线 N 和 光线方向 L、观察方向 V 的中间方向 H 有多接近？”
~~~

Halfway Vector：

~~~glsl
vec3 halfwayDir = normalize(lightDir + viewDir);
~~~

也就是：

~~~text
H = normalize(L + V)
~~~

直觉上可以这样想：

~~~text
如果观察者正好站在镜面反射方向上：

        N
        ↑
     H  ↑
       / \
      L   V

这时 H 会非常接近 N
→ 高光最强
~~~

当观察方向逐渐偏离理想反射方向，H 也会逐渐偏离 N，高光平滑减弱。相比直接比较 V 和 R，Halfway Vector 在常见可见表面范围内不会那么容易跨过“90° → 点积突然归零”这个边界。

## 为什么 Blinn-Phong 的 shininess 通常要更大

Phong 比较：

~~~text
dot(V, R)
~~~

Blinn-Phong 比较：

~~~text
dot(N, H)
~~~

而 H 是 L 与 V 的中间方向，所以 N 和 H 的夹角通常比 V 和 R 的夹角更小。

因此如果两边都写相同的指数，Blinn-Phong 的高光通常会更宽。为了得到相近的高光宽度，教程通常让 Blinn-Phong 使用更高的指数。官方示例使用：

~~~text
Phong       shininess = 8
Blinn-Phong shininess = 32
~~~

通常可以在 Phong 指数的 2～4 倍附近继续调。

## Interactive Lab

<form action="/myOpengl-lab/static/labs/advanced-lighting.html" method="get">
  <button type="submit">🎮 打开 Advanced Lighting Lab · Phong vs Blinn-Phong</button>
</form>

Lab 会同时渲染同一个地面：

~~~text
左：Phong
右：Blinn-Phong
~~~

可以直接调整 shininess、相机角度、光源位置，并切换“相同指数 / 匹配高光宽度”。把 Phong shininess 降到很低时，最容易看到 Phong 镜面高光边缘的突然截断；再看 Blinn-Phong，会发现高光衰减更连续。

## 这一节真正要留下来的模型

真正变化只有镜面项的几何问题：

~~~text
Phong
N + L
  ↓
反射方向 R
  ↓
比较 R 和 V

Blinn-Phong
L + V
  ↓
Halfway Vector H
  ↓
比较 H 和 N
~~~

所以这节最重要的一句话是：

> **Phong 追踪“完美反射光线”；Blinn-Phong 追踪“光线与视线之间的中间方向”。**

两者都还是经验光照模型；Ambient、Diffuse 的计算没有因为 Blinn-Phong 而改变。

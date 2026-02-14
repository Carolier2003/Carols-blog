---
title: "解决 Astro View Transitions 导致的脚本不执行问题"
pubDatetime: 2026-02-13T10:00:00+08:00
description: "记录一次从主页跳转到博文详情页时，浏览量计数器和 Giscus 评论无法加载的排查过程，以及最终的解决方案。"
tags: ["Astro", "View Transitions", "JavaScript", "前端开发"]
featured: false
---

## 问题现象

最近给博客添加了浏览量统计和 Giscus 评论功能后，我发现了一个奇怪的问题：

- **从主页直接访问博文详情页**（如直接输入 URL 或刷新页面）：功能正常 ✅
- **从主页点击文章卡片跳转到详情页**（客户端导航）：功能失效 ❌

具体表现是：
- 浏览量计数器一直显示 `--` 而不是实际数字
- Giscus 评论区域完全不加载

## 初步排查

博客使用了 Astro 的 `<ClientRouter />`（以前叫 View Transitions）来实现页面间的平滑过渡效果。我第一反应是检查网络请求：

**正常加载时：**
- 能看到请求 `https://giscus.app/api/discussions?repo=...`
- 能看到请求 `https://api.kon-carol.xyz/api/views/batch?slugs=...`

**问题发生时：**
- 这两个请求都没有发出
- 浏览器控制台也没有任何报错

这说明问题不在 API，而是在脚本执行层面。

## 错误尝试 1：全局事件监听

我首先想到的是使用 Astro View Transitions 提供的事件来重新初始化：

```javascript
document.addEventListener("astro:after-swap", () => {
  window.__viewCounterInit = false;
  initViewCounter();
});
```

思路是：在页面内容替换后，重置初始化标志并重新执行初始化函数。

**结果：不工作。**

原因我后来才想明白：`is:inline` 脚本只在初始页面加载时执行一次。当页面过渡发生时，这段事件监听器注册的代码本身不会重新执行，所以实际上监听器只被注册了一次——而且是在第一次页面加载时。

## 错误尝试 2：astro:page-load 事件

我尝试了另一个事件：

```javascript
document.addEventListener("astro:page-load", loadGiscus);
```

**结果：还是不工作。**

原因是一样的：这段代码位于 `is:inline` 脚本中，而脚本不会在 View Transitions 后重新执行，所以事件监听器根本没有被添加到新页面的上下文中。

## 正确的解决方案

经过查阅 Astro 官方文档，我找到了正确的解决方案：**`data-astro-rerun` 属性**。

```astro
<script is:inline data-astro-rerun>
  // 这段代码会在每次页面过渡后重新执行
  initViewCounter();
</script>
```

### 为什么这个方案有效？

要理解这一点，需要先了解 Astro View Transitions 的工作原理：

1. **DOM 替换而非页面刷新**：导航时，Astro 会获取新页面的 HTML，提取其中的内容，然后替换当前页面的 `<body>` 内容
2. **保留全局状态**：`window` 对象、`document` 等全局对象在导航过程中保持不变
3. **脚本默认不重新执行**：为了保护性能，内联 `<script>` 标签默认不会在页面过渡后重新执行

`data-astro-rerun` 属性告诉 Astro：「这个脚本很重要，每次页面过渡后都需要重新执行」。

## 修改后的代码

### ViewCounter.astro

```astro
<script is:inline data-astro-rerun>
  const VIEW_API_BASE = "https://api.kon-carol.xyz";

  function formatCount(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "k";
    return num.toString();
  }

  function initViewCounter() {
    // 每次执行时都重新查询 DOM，确保获取到当前页面的所有计数器
    const counters = document.querySelectorAll(".view-counter");
    // ... 初始化逻辑
    fetchViewCounts();
  }

  // 每次页面加载或过渡后都会执行
  initViewCounter();
</script>
```

### Comments.astro

```astro
<script is:inline data-astro-rerun>
  (function() {
    const baseUrl = "https://blog.kon-carol.xyz";

    function cleanupGiscus() {
      // 清理旧的 giscus iframe，避免重复渲染
      const existingIframe = document.querySelector('iframe.giscus-frame');
      if (existingIframe) existingIframe.remove();
      // ...
    }

    function loadGiscus() {
      cleanupGiscus();
      // 加载新的 giscus 脚本...
    }

    // 每次页面加载或过渡后都会执行
    loadGiscus();
  })();
</script>
```

## 关键区别对比

| 特性 | 普通 `<script>` | `<script is:inline>` | `<script is:inline data-astro-rerun>` |
|------|----------------|---------------------|--------------------------------------|
| 打包 | 会被 Astro 打包 | 原样嵌入 HTML | 原样嵌入 HTML |
| 初始执行 | ✅ | ✅ | ✅ |
| View Transitions 后执行 | ❌ | ❌ | ✅ |
| 适用场景 | 通用逻辑 | 需要直接嵌入的代码 | 需要每次页面切换后执行的代码 |

## 注意事项

### 1. 避免重复的全局事件监听

```javascript
// ❌ 错误：每次页面过渡都会添加一个新的监听器
document.addEventListener('click', handler);

// ✅ 正确：使用标志确保只注册一次
if (!window.__clickHandlerRegistered) {
  document.addEventListener('click', handler);
  window.__clickHandlerRegistered = true;
}
```

### 2. 清理旧的状态

对于会创建 DOM 元素的组件，记得先清理旧的：

```javascript
function cleanup() {
  const oldElements = document.querySelectorAll('.my-component');
  oldElements.forEach(el => el.remove());
}

cleanup();
initComponent();
```

### 3. 使用 IIFE 避免变量污染

```astro
<script is:inline data-astro-rerun>
  (function() {
    // 变量只在当前脚本作用域内
    const localVar = 'safe';
    initComponent();
  })();
</script>
```

## 何时使用 data-astro-rerun

**需要使用的场景：**
- 需要在每个页面初始化时执行的代码
- 依赖 DOM 查询的初始化逻辑（如 `document.querySelector`）
- 第三方脚本加载（如 Giscus、Google Analytics 等）
- 页面特定的状态初始化

**不需要使用的场景：**
- 全局事件委托（只需注册一次）
- 不依赖 DOM 的纯工具函数
- 已经在 `astro:before-swap`/`astro:after-swap` 事件中处理的逻辑

## 总结

这次排查让我对 Astro View Transitions 的工作机制有了更深的理解。关键是意识到：**`is:inline` 脚本在 View Transitions 后默认不会重新执行**，需要通过 `data-astro-rerun` 属性来显式声明需要重新执行。

如果你也在使用 Astro 的 View Transitions 功能，并且遇到了类似的「只有直接访问页面才正常，客户端导航就失效」的问题，不妨检查一下你的脚本是否有 `data-astro-rerun` 属性。

## 参考资源

- [Astro View Transitions 文档](https://docs.astro.build/en/guides/view-transitions/)
- [Script Behavior with View Transitions](https://docs.astro.build/en/guides/view-transitions/#script-behavior-with-view-transitions)

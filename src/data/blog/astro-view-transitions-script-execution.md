---
title: "解决 Astro View Transitions 导致的脚本不执行问题"
pubDatetime: 2026-02-14T10:00:00+08:00
modDatetime: 2026-02-14T19:00:00+08:00
description: "记录从主页跳转到博文详情页时浏览量计数器、Giscus 评论、贡献热力图无法加载的完整排查过程。涵盖全局方案和局部方案两种解决思路，以及 Skeleton 骨架屏和缓存策略的最佳实践。"
tags: ["Astro", "View Transitions", "JavaScript", "前端开发", "性能优化"]
featured: true
---

## 问题现象

最近给博客添加了浏览量统计和 Giscus 评论功能。本地开发测试一切正常，但部署到线上后，我发现了一个诡异的问题：

- **直接访问博文详情页**（刷新页面或输入 URL）：功能正常 ✅
  浏览量显示数字，评论区加载成功

- **从首页点击跳转到详情页**（客户端导航）：功能失效 ❌
  浏览量一直显示 `--`，评论区空白

这让我很困惑——**同样的代码，同样的页面，只是进入方式不同，结果却不一样**。

## 排查过程

### 第一步：缩小问题范围

我的第一个问题是：这是后端 API 的问题，还是前端的问题？

打开浏览器开发者工具，对比两种进入方式的网络请求：

**直接访问（正常）：**
```
GET https://api.kon-carol.xyz/api/views/batch?slugs=xxx  200 OK
GET https://giscus.app/api/discussions?repo=...         200 OK
```

**从首页跳转（异常）：**
```
（没有上述请求）
```

**关键发现**：异常情况下，API 请求根本没有发出。

这说明问题不在后端，而是在**前端脚本层**——某些应该执行的代码没有执行。

### 第二步：理解 View Transitions 的工作原理

我的博客使用了 Astro 的 `<ClientRouter />`（即 View Transitions）来实现平滑的页面过渡效果。

我原本以为这只是一个简单的 SPA 路由切换，但仔细研究后发现它的工作机制很特别：

1. **拦截链接点击** —— 用户点击 `<a>` 标签时，ClientRouter 拦截默认行为
2. **获取新页面 HTML** —— 通过 `fetch` 获取目标页面的 HTML
3. **提取 `<body>` 内容** —— 解析 HTML，提取其中的 `<body>` 内容
4. **替换当前 DOM** —— 用新内容替换当前页面的 `<body>`，保留 `<head>`
5. **模拟页面切换动画** —— 执行 View Transitions 动画效果

**关键洞察**：`<head>` 中的内容不会被替换，`<body>` 会被完全替换。

这让我想到一个问题：我的脚本放在哪里？

### 第三步：第一次尝试——使用生命周期事件（失败）

我首先想到的是：既然 DOM 被替换了，那我在替换后重新初始化组件不就行了？

查阅 Astro 文档，发现 View Transitions 提供了几个生命周期事件：
- `astro:before-swap` —— 在 DOM 替换前触发
- `astro:after-swap` —— 在 DOM 替换后触发
- `astro:page-load` —— 在页面完全加载后触发

于是我在组件脚本中添加了事件监听：

```astro
<script is:inline>
  function initViewCounter() {
    console.log('Initializing view counter...');
    // ... 获取浏览量
  }

  // 初始执行
  initViewCounter();

  // View Transitions 后再次执行
  document.addEventListener('astro:page-load', initViewCounter);
</script>
```

**测试：失败 ❌**

从首页跳转后，控制台没有输出 `Initializing view counter...`，API 请求依然没有发出。

**反思**：

我突然意识到一个关键问题：**这个 `<script>` 本身就在 `<body>` 中！**

当 View Transitions 替换 `<body>` 时，这段脚本也被移除了，所以它注册的事件监听器也随之消失。

换句话说：脚本在首页执行了一次，注册了监听器，但当我跳转到博文页时，整个脚本都被替换了，监听器也没了。

这是一个**根本性的矛盾**：在 `<body>` 中注册的监听器，无法监听 `<body>` 被替换的事件。

### 第四步：第二次尝试——使用 `data-astro-rerun`（部分成功，然后失败）

继续查阅文档，发现了 `data-astro-rerun` 属性。文档说：

> 添加 `data-astro-rerun` 属性的脚本会在每次 View Transitions 后重新执行。

这听起来正是我需要的！于是修改了代码：

```astro
<script is:inline data-astro-rerun>
  console.log('Script executed, rerunning:', !!document.querySelector('.view-counter'));

  async function fetchViewCounts() {
    // ... 获取浏览量并更新 DOM
  }

  fetchViewCounts();
</script>
```

**测试：部分成功 ⚠️**

在本地 `astro dev` 模式下测试，发现它可以工作！从首页跳转后，脚本重新执行，浏览量正常显示。

于是信心满满地部署到线上。但上线后测试发现：**依然不工作** 😭

更奇怪的是，打开控制台查看，发现 `console.log` 根本没有输出。这意味着脚本根本没有执行。

**对比分析**：

我对比了本地和线上的差异：
- 本地：`astro dev` 开发模式
- 线上：`astro build` 构建后的静态站点

又查看了线上页面的源代码，确认 `data-astro-rerun` 属性确实在 HTML 中。但跳转后，这个脚本就像消失了一样。

**假设**：**Astro v5.16.6 可能存在 bug**——`<body>` 中的 `data-astro-rerun` 脚本在 View Transitions 后没有按预期重新执行。

为了验证这个猜想，我在 `<head>` 中添加了一个测试脚本：

```html
<head>
  <script>
    // 记录所有的 script 标签
    window.addEventListener('load', () => {
      console.log('Scripts in head:', document.head.querySelectorAll('script').length);
      console.log('Scripts in body:', document.body.querySelectorAll('script').length);
    });
  </script>
</head>
```

结果发现：View Transitions 后，`<body>` 中的脚本数量从原来的十几个变成了 2 个（只剩下 JSON-LD 和 email-decode）。

**结论**：`<body>` 中的 `data-astro-rerun` 脚本确实消失了，而且没有被重新执行。

### 第五步：第三次尝试——利用 `<head>` 的稳定性（成功！）

既然 `<body>` 中的脚本会被替换，那我能不能把初始化逻辑放在不会被替换的地方？

**灵光一闪**：`<head>`！View Transitions 只替换 `<body>`，`<head>` 保持不变！

于是重新设计了方案：

1. 在 `<head>` 中注册一个全局的 `astro:page-load` 事件监听器
2. 这个监听器永远不会被替换（因为 `<head>` 不变）
3. 每次页面加载（包括 View Transitions 后），监听器都会触发
4. 在监听器中执行初始化逻辑

**实现代码**：

```astro
---
// Layout.astro
---
<!doctype html>
<html>
  <head>
    <!-- 其他 head 内容 -->
    <ClientRouter />

    <!-- 全局 View Transitions 处理器 -->
    <script is:inline>
      (function() {
        // 防止重复注册（虽然 head 不会被替换，但为了保险）
        if (window.__vtHandlerRegistered) return;
        window.__vtHandlerRegistered = true;

        const VIEW_API_BASE = "https://api.kon-carol.xyz";

        // 格式化数字显示
        function formatCount(num) {
          if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
          if (num >= 1000) return (num / 1000).toFixed(1) + "k";
          return num.toString();
        }

        // 获取缓存的浏览量
        function getCachedViews() {
          try {
            const cached = sessionStorage.getItem("viewCounts");
            const timestamp = sessionStorage.getItem("viewCountsTimestamp");
            if (cached && timestamp && Date.now() - parseInt(timestamp) < 300000) {
              return JSON.parse(cached);
            }
          } catch (e) {}
          return {};
        }

        // 批量获取浏览量
        async function fetchViewCounts() {
          const counters = document.querySelectorAll(".view-counter");
          if (counters.length === 0) return;

          const slugs = [...new Set([...counters].map(el => el.dataset.slug).filter(Boolean))];
          const cachedViews = getCachedViews();
          const slugsToFetch = slugs.filter(slug => cachedViews[slug] === undefined);

          // 获取并更新...
          if (slugsToFetch.length > 0) {
            try {
              const response = await fetch(
                `${VIEW_API_BASE}/api/views/batch?slugs=${encodeURIComponent(slugsToFetch.join(","))}`
              );
              const data = await response.json();
              // 更新 DOM...
            } catch (error) {
              console.error('Failed to fetch view counts:', error);
            }
          }
        }

        // 清理旧的 Giscus
        function cleanupGiscus() {
          const existingIframe = document.querySelector('iframe.giscus-frame');
          if (existingIframe) existingIframe.remove();
          const existingScript = document.querySelector('script[data-giscus]');
          if (existingScript) existingScript.remove();
          const container = document.getElementById("giscus-container");
          if (container) container.innerHTML = "";
        }

        // 加载 Giscus 评论
        function loadGiscus() {
          const container = document.getElementById("giscus-container");
          if (!container) return;

          cleanupGiscus();

          const isDark = document.documentElement.getAttribute("data-theme") === "dark";
          const baseUrl = "https://blog.kon-carol.xyz";
          const theme = isDark ? `${baseUrl}/giscus-dark.css` : `${baseUrl}/giscus-light.css`;

          const script = document.createElement("script");
          script.src = "https://giscus.app/client.js";
          script.setAttribute("data-repo", "Carolier2003/Carols-blog");
          // ... 其他配置
          script.async = true;

          container.appendChild(script);
        }

        // 初始化所有组件
        function initComponents() {
          console.log('[View Transitions] Initializing components...');
          fetchViewCounts();
          loadGiscus();
        }

        // 关键：在 View Transitions 页面加载完成后执行
        document.addEventListener("astro:page-load", initComponents);

        // 首次加载也执行（如果不是 View Transitions 导航）
        if (document.readyState === 'complete') {
          initComponents();
        }
      })();
    </script>
  </head>
  <body>
    <slot />
  </body>
</html>
```

**测试：成功 ✅**

- 直接访问：浏览量显示，评论加载 ✓
- 从首页跳转：浏览量显示，评论加载 ✓
- 多篇文章切换：每次都正常 ✓

## 原理解析

### 为什么这个方案有效？

核心在于 **`<head>` 和 `<body>` 在 View Transitions 中的不同待遇**：

| 位置 | View Transitions 行为 | 脚本是否保留 | 事件监听器是否保留 |
|------|----------------------|------------|------------------|
| `<head>` | 完全不变 | ✅ 保留 | ✅ 保留 |
| `<body>` | 完全替换为新内容 | ❌ 移除 | ❌ 移除 |

因此：
- 在 `<body>` 中注册的事件监听器会在页面过渡后丢失
- 在 `<head>` 中注册的事件监听器会一直存在

### 关于 `data-astro-rerun`

官方文档推荐用 `data-astro-rerun` 让脚本在 View Transitions 后重新执行。但在 Astro v5.16.6 中，这个特性似乎存在 bug——`<body>` 中的 `data-astro-rerun` 脚本会被移除，但没有被重新执行。

**可能的解释**：
- Astro 的 View Transitions 实现可能存在时序问题
- 脚本被移除后，重新执行的逻辑可能没有正确触发
- 或者与 Cloudflare Pages 的部署环境有兼容性问题

无论如何，将脚本放在 `<head>` 中是更可靠的方案。

## 组件代码的简化

既然初始化逻辑已经移到 `Layout.astro`，组件本身可以大大简化：

**ViewCounter.astro**
```astro
---
interface Props {
  slug: string;
}
const { slug } = Astro.props;
---

<span class="view-counter" data-slug={slug}>
  <span class="count">--</span>
  <span class="label">阅读</span>
</span>

<!-- 不需要脚本了，由 Layout.astro 统一处理 -->
```

**Comments.astro**
```astro
<div class="comments-section">
  <h3>评论</h3>
  <div class="giscus-container" id="giscus-container">
    <!-- Giscus 脚本由 Layout.astro 注入 -->
  </div>
</div>
```

## 新案例：贡献热力图的另一种方案

在实现 GitHub 贡献热力图时，我遇到了类似的问题，但采用了不同的解决方案。

### 热力图的特殊需求

与 ViewCounter 不同，热力图只在 About 页面使用，不需要全局管理。但它有更复杂的交互需求：
- 鼠标悬停显示 Tooltip
- 52×7 的 SVG 网格需要动态生成
- 从 API 获取一年的贡献数据

### 局部方案：`<script is:inline>` + 页面级缓存

如果组件只在特定页面使用，不必放在全局 Layout 中。可以在页面或组件内解决：

```astro
---
// AboutLayout.astro
---

<!-- 骨架屏 -->
<div id="contributions-skeleton">
  <div class="skeleton-grid">
    {Array.from({ length: 52 }).map(() => (
      <div class="skeleton-week">
        {Array.from({ length: 7 }).map(() => (
          <div class="skeleton-cell" />
        ))}
      </div>
    ))}
  </div>
</div>

<!-- 真实内容 -->
<div id="contributions-content" style="display: none;">
  <svg id="contrib-svg"><!-- 动态生成 --></svg>
</div>

<!-- Tooltip -->
<div id="contrib-tooltip" class="contrib-tooltip" />

<script is:inline>
  (function() {
    const API_BASE = location.hostname === 'localhost'
      ? 'http://localhost:8787'
      : 'https://api.kon-carol.xyz';

    // 检查缓存（5分钟TTL）
    function getCachedData() {
      const cached = sessionStorage.getItem('contributions');
      if (cached) {
        const data = JSON.parse(cached);
        if (Date.now() - data.cachedAt < 5 * 60 * 1000) {
          return data;
        }
      }
      return null;
    }

    function renderContributions(data) {
      // 隐藏骨架屏，显示内容
      document.getElementById('contributions-skeleton').style.display = 'none';
      document.getElementById('contributions-content').style.display = 'flex';

      // 生成 SVG 热力图...
    }

    async function fetchContributions() {
      // 先检查缓存
      const cached = getCachedData();
      if (cached) {
        renderContributions(cached);
        return;
      }

      // 显示骨架屏
      document.getElementById('contributions-skeleton').style.display = 'flex';

      try {
        const response = await fetch(`${API_BASE}/api/contributions`);
        const result = await response.json();

        if (result.success) {
          // 存入缓存
          result.data.cachedAt = Date.now();
          sessionStorage.setItem('contributions', JSON.stringify(result.data));
          renderContributions(result.data);
        }
      } catch (err) {
        console.error('Failed to load:', err);
      }
    }

    // 首次加载
    fetchContributions();

    // View Transitions 后重新加载
    document.addEventListener('astro:page-load', fetchContributions);
  })();
</script>
```

### 关键区别

| 特性 | 全局方案（Layout.astro） | 局部方案（页面内） |
|------|------------------------|------------------|
| 适用场景 | 多页面共享的组件（导航、计数器） | 单页面特有功能（热力图） |
| 脚本位置 | `<head>` | `<body>`（使用 `is:inline`）|
| 状态管理 | 全局变量 | sessionStorage 缓存 |
| 代码组织 | 集中管理 | 就近放置，易于维护 |

### 为什么局部方案也有效？

仔细看，局部方案的脚本也在 `<body>` 中，View Transitions 后它不应该被执行了吗？

**关键点**：`is:inline`

- **普通 `<script>`**：Astro 会打包处理，View Transitions 后可能不被重新执行
- **`<script is:inline>`**：原样保留在 HTML 中，View Transitions 替换 `<body>` 时，新页面的内联脚本会被执行

配合 `astro:page-load` 事件，确保每次导航后都能初始化。

### 缓存策略的选择

热力图数据一天更新一次，不需要每次都请求：

```javascript
// sessionStorage - 标签页关闭即清理，适合短期缓存
sessionStorage.setItem('key', JSON.stringify(data));

// localStorage - 永久存储，适合主题设置等
localStorage.setItem('key', JSON.stringify(data));

// 内存缓存 - 页面刷新即丢失
window.__cache = data;
```

对于贡献数据，我用 `sessionStorage` + 5分钟 TTL：
- 用户在同一会话内多次访问 About 页面，直接用缓存
- 新开标签页或关闭重开会重新获取（避免数据过旧）
- 比 API 调用快，比 localStorage 干净

## 两种方案如何选择？

| 场景 | 推荐方案 | 原因 |
|------|---------|------|
| 导航栏、全局计数器、评论 | 全局 `<head>` 方案 | 所有页面共享，避免重复注册 |
| 页面特有的图表、交互组件 | 局部 `is:inline` 方案 | 代码内聚，易于理解和维护 |
| 需要复杂状态管理 | 全局方案 + 全局变量 | 跨页面保持状态 |
| 数据需要缓存 | 局部方案 + Storage | 独立管理生命周期 |

## 经验总结

### 排查思路

回顾这次排查，我遵循了以下思路：

1. **对比法** —— 对比「正常情况」和「异常情况」的差异（网络请求、DOM 结构等），快速定位问题层次
2. **缩小范围** —— 确定问题是 API 层还是脚本层，避免在错误的方向上浪费时间
3. **理解机制** —— 深入了解 View Transitions 的工作原理，找到问题的根本原因
4. **验证假设** —— 通过控制台输出验证猜想，而不是盲目尝试
5. **寻找替代方案** —— 当官方方案（`data-astro-rerun`）不工作时，寻找更底层的解决方案

### 关键认知

- **View Transitions 不只是动画**，它涉及复杂的 DOM 替换机制
- **`<head>` 和 `<body>` 有本质区别**，不是所有脚本都适合放在 body 中
- **文档 vs 现实**：官方文档是理想情况，实际使用时要做好 fallback，尤其是在特定版本可能存在 bug 时
- **全局状态 vs 局部状态**：需要跨页面保持的逻辑（如事件监听器）应该放在全局（`<head>`）

### Skeleton 骨架屏：提升等待体验

当数据需要异步加载时，骨架屏比传统的 Loading 动画更好的原因是：

1. **减少布局偏移** - 提前占位，内容加载后不会推动其他元素
2. **感知性能** - 用户立即看到内容结构，感觉加载更快
3. **减少焦虑** - 空白屏幕让用户怀疑是否出错，骨架屏提供即时反馈

**实现要点**：

```astro
<!-- 骨架屏：默认显示 -->
<div id="skeleton" class="skeleton-container">
  <div class="skeleton-header" />
  <div class="skeleton-grid">
    {Array.from({ length: 52 }).map(() => (
      <div class="skeleton-cell" />
    ))}
  </div>
</div>

<!-- 真实内容：默认隐藏 -->
<div id="content" style="display: none;">
  <!-- 动态生成的内容 -->
</div>

<script is:inline>
  async function loadData() {
    // 骨架屏已显示，直接请求数据
    const data = await fetch('/api/data').then(r => r.json());

    // 渲染完成后切换显示
    document.getElementById('skeleton').style.display = 'none';
    document.getElementById('content').style.display = 'block';
  }
</script>
```

**CSS 动画**：

```css
.skeleton-cell {
  background: var(--foreground);
  opacity: 0.1;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.1; }
  50% { opacity: 0.2; }
}
```

### 最佳实践

对于需要在 View Transitions 后执行初始化的场景：

```astro
<head>
  <ClientRouter />
  <script is:inline>
    (function() {
      // 防止重复注册
      if (window.__myHandlerRegistered) return;
      window.__myHandlerRegistered = true;

      function init() {
        // 你的初始化逻辑
      }

      // View Transitions 后执行
      document.addEventListener('astro:page-load', init);

      // 首次加载也执行
      if (document.readyState === 'complete') {
        init();
      }
    })();
  </script>
</head>
```

**检查清单**：

- [ ] 使用 `is:inline` 确保脚本内联到 HTML
- [ ] 添加骨架屏提升等待体验
- [ ] 使用 sessionStorage/localStorage 缓存数据减少请求
- [ ] 全局组件用 `<head>` 方案，局部组件用 `is:inline` 方案
- [ ] 测试「直接访问」和「View Transitions 导航」两种场景

## 参考资源

- [Astro View Transitions 文档](https://docs.astro.build/en/guides/view-transitions/)
- [Script Behavior with View Transitions](https://docs.astro.build/en/guides/view-transitions/#script-behavior-with-view-transitions)
- [astro:page-load 事件](https://docs.astro.build/en/guides/view-transitions/#astropage-load)

---

如果你也遇到了类似的问题，希望这篇排查记录能帮到你。排查过程虽然曲折，但最终的解决方案是简洁可靠的——**理解了原理，问题就不再是问题**。

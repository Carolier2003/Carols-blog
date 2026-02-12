---
author: Carol
pubDatetime: 2025-07-04T00:00:00Z
title: Spring MVC
description: Spring MVC核心组件详解及MVC架构工作流程。
draft: false
tags:
  - spring
  - 知识
---

Spring MVC 是 **Spring Framework 的核心模块之一**，专为构建灵活、松耦合的 Web 应用程序而设计。它基于 **MVC（Model-View-Controller）架构模式**，将业务逻辑、数据展示和用户交互分离，简化了 Web 层的开发。以下是其核心要点及组件详解：

* * *

### 一、Spring MVC 的核心思想

1. **MVC 分层架构** ：
    - **Model（模型）**：封装业务数据和状态，包括实体类（如 `User`）和业务处理类（如 `Service`、`Dao`）。

    - **View（视图）**：负责数据展示（如 HTML/JSP/Thymeleaf 页面）。

    - **Controller（控制器）**：接收用户请求，调用模型处理数据，返回视图或响应。

    - **工作流程**：用户请求 → 控制器 → 模型处理 → 返回视图 → 渲染响应。

3. **Spring MVC 的定位**：
    - 是 **Spring 生态的原生 Web 框架**，无缝集成 Spring IoC 容器和 AOP 等功能。

    - 替代传统 Servlet 和 Struts 等框架，成为 **Java EE 表述层开发的首选方案**。

* * *

### 二、核心组件详解

Spring MVC 通过组件化设计实现高内聚低耦合，主要组件如下：

| **组件** | **作用** | **开发者角色** | **关键实现类/注解** |
| --- | --- | --- | --- |
| **DispatcherServlet** ⚙️ | 前端控制器，统一接收请求并协调组件工作 | 配置即可 | `DispatcherServlet` |
| **HandlerMapping** 🗺️ | 根据 URL 匹配对应的 Controller 方法 | 配置即可 | `@RequestMapping`、`RequestMappingHandlerMapping` |
| **HandlerAdapter** 🔌 | 调用 Controller 方法并处理参数绑定 | 配置即可 | `RequestMappingHandlerAdapter` |
| **Controller** 🎮 | 执行业务逻辑，返回数据或视图 | 需开发者编写 | `@Controller`、`@RestController` |
| **ModelAndView** 📦 | 封装模型数据与视图信息 | 框架自动创建 | `ModelAndView` 对象 |
| **ViewResolver** 🔍 | 将逻辑视图名解析为实际视图（如 JSP/HTML） | 配置即可 | `InternalResourceViewResolver`、`ThymeleafViewResolver` |
| **View** 🖼️ | 渲染模型数据到响应内容（HTML/JSON/XML） | 需开发者编写视图模板 | JSP、Thymeleaf、FreeMarker |

#### 组件协作流程：

1. **请求入口**：`DispatcherServlet` 接收 HTTP 请求。

3. **路由匹配**：`HandlerMapping` 根据 URL 找到对应的 `Controller` 方法。

5. **方法执行**：`HandlerAdapter` 调用 `Controller` 方法，处理参数绑定和返回值。

7. **结果处理**：`Controller` 返回 `ModelAndView`（含数据 + 视图名）。

9. **视图解析**：`ViewResolver` 将逻辑视图名（如 `"success"`）解析为具体视图（如 `/WEB-INF/success.html`）。

11. **响应渲染**：`View` 将模型数据填充到视图模板，生成最终响应。

* * *

### 三、Spring MVC 的优势与特点

1. **无缝集成 Spring 生态**
    与 IoC 容器、AOP、事务管理等无缝协作，支持依赖注入（如 `@Autowired`）。

3. **灵活的配置方式**
    - **注解驱动**：通过 `@Controller`、`@RequestMapping` 等注解简化配置。

    - **视图技术兼容**：支持 JSP、Thymeleaf、FreeMarker 等多种视图。

5. **组件可插拔**
    各组件（如 `ViewResolver`、`HandlerAdapter`）可替换或扩展，适应不同需求。

7. **高效开发**
    提供 RESTful 支持（`@GetMapping`、`@PostMapping`）、数据绑定（`@RequestParam`）、验证（`@Valid`）等特性，减少样板代码。

9. **健壮性**
    内置异常处理机制（`@ControllerAdvice`），支持全局统一错误处理。

* * *

### 四、典型应用场景

- **传统 Web 应用**：动态页面渲染（JSP/Thymeleaf）。

- **RESTful API**：返回 JSON/XML 数据（结合 `@RestController`）。

- **企业级系统**：与 Spring Boot、Spring Security 整合构建微服务或单体应用。

> **注**：Spring MVC 与三层架构的关系：
> MVC 属于**表述层**（Web 层），负责用户交互；三层架构中的**业务层**（Service）和**持久层**（Dao）对应 MVC 的 Model 部分。

Spring MVC 通过清晰的分层和组件化设计，成为 Java Web 开发的核心框架。掌握其组件协作机制，能高效构建可维护、可扩展的 Web 应用。

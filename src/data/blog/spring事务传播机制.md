---
author: Carol
pubDatetime: 2025-07-03T00:00:00Z
title: Spring事务传播机制
description: 详解Spring事务的7种传播行为及其应用场景。
draft: false
tags:
  - spring
  - 事务
  - 知识
---

Spring 事务的传播机制（Propagation Behavior）是事务管理中**一个极其核心且容易出问题的概念**，它定义了**当多个事务方法互相调用时，事务该如何传播、合并或分离**。理解其行为对构建健壮、数据一致的应用至关重要。

Spring 使用 `@Transactional` 注解（或其 XML 等价配置）定义事务，`propagation` 属性用来指定传播行为，其取值来源于 `Propagation` 枚举类。

* * *

**核心传播行为（7 种）：**

**1.`REQUIRED` (默认值)**

- **行为：** **无事务则新建，有事务则加入。** 这是**最常用**的策略。

- **场景：** 绝大多数业务操作都适用。例如，在一个大业务方法中调用了几个数据访问方法（如更新A、更新B、更新C），更新A/B/C都该用 `REQUIRED`。即使外层没有事务，它们各自也会在自己的事务中运行；如果外层有事务，它们会加入这个大事务，全部成功或全部失败。

- 伪代码理解

```java
@Transactional(propagation = Propagation.REQUIRED)
public void mainBusiness() {
    updateA(); // REQUIRED - 加入mainBusiness的事务（如果存在）或新建
    updateB(); // REQUIRED - 同上
}
```

**2.`SUPPORTS`**

- **行为：** **当前有事务则加入，没事务则非事务运行。**

- **场景：** 一个操作可以非事务运行，但如果它被一个已有事务的方法调用，也愿意服从那个事务的管理。常用于查询方法（虽然查询通常也用 `REQUIRED`），或者那些可以以非事务方式执行的次要操作。

- **伪代码理解：**

```java
@Transactional(propagation = Propagation.REQUIRED)
public void updateData() {
    queryForLog(); // SUPPORTS - 加入updateData的事务
    // update something
}

public void justQuery() {
    queryForLog(); // SUPPORTS - 无外层事务，非事务执行
}
```

**3.`MANDATORY`**

- **行为：** **强制必须存在一个已有事务，否则抛出 `IllegalTransactionStateException` 异常。**

- **场景：** **要求该操作必须是被另一个事务方法调用**，用于强制上下文中有事务。例如，一个关键的核心业务操作绝不能独立运行，必须嵌入在一个更大的事务上下文中以保证原子性。

- **伪代码理解：**

```java
public void outerService() {
    // 没有声明事务
    criticalOperation(); // MANDATORY - 直接抛出异常！因为没有事务存在
}

@Transactional
public void anotherService() {
    criticalOperation(); // MANDATORY - 成功加入已有事务
}
```

**4.`REQUIRES_NEW`**

- **行为：** **无论当前有无事务，都创建一个全新的、独立的事务。暂停当前事务（如果存在）。** 这个新事务完全独立提交和回滚，不依赖于外部事务。

- **场景：**
    - **关键且独立的子操作：** 即使主业务失败，该子操作也必须记录日志、发送消息（但需注意消息投递一致性）。比如订单提交异常，仍然需记录操作日志到数据库。

    - **避免外层失败影响该操作：** 需要确保某个操作（如保存特定通知）不被外层失败拖累。

- **伪代码理解 (重要)**

```java
@Transactional(propagation = Propagation.REQUIRED)
public void processOrder() {
    // 操作订单表...
    try {
        auditService.logAction(); // REQUIRES_NEW - 暂停外层事务，启动新事务
    } catch (Exception auditEx) {
        // 处理审计异常，不影响订单回滚
    }
    // 发生其他异常，回滚外层事务（操作订单表失败）
}
// 审计日志可能成功，即使订单事务失败
```

**5.`NOT_SUPPORTED`**

- **行为：** **总是以非事务方式执行。暂停当前事务（如果存在）。**

- **场景：** 明确要求非事务环境运行的操作。例如调用一些不支持事务的外部服务、或者某些性能极其敏感的纯读操作（避免无谓事务开销）。**慎用**，可能破坏数据一致性。

- **伪代码理解：**

```java
@Transactional(propagation = Propagation.REQUIRED)
public void syncData() {
    updateLocal(); // 在事务内
    callExternalSystem(); // NOT_SUPPORTED - 暂停事务，非事务方式执行
    // 后续操作仍在原事务内，但外部调用无事务保障
}
```

**6.`NEVER`**

- **行为：** **强制在非事务环境中执行。若当前存在事务，则抛出 `IllegalTransactionStateException` 异常。**

- **场景：** 该操作**绝对不能在任何事务中运行**。比如执行一些特别敏感的维护命令（如数据库物理文件操作），或者访问某些禁止事务的操作系统接口（极其罕见）。

- **伪代码理解：**

```java
@Transactional(propagation = Propagation.REQUIRED)
public void businessWithSensitiveCall() {
    // ... 一些操作
    sensitiveMaintenance(); // NEVER - 抛出异常！因为businessWithSensitiveCall开启了事务
}

public void standaloneMaintenance() {
    sensitiveMaintenance(); // NEVER - 无事务，成功执行
}
```

**7.`NESTED`**

- **行为：** **如果当前已有事务，则在当前事务内部创建一个"嵌套事务"**（Savepoint）。如果当前没有事务，其行为等同于 `REQUIRED`。**嵌套事务可以独立回滚，但外部事务回滚时，嵌套事务必定回滚。** 外部事务提交时，嵌套事务才被真正提交。

- **场景：** **复杂业务中的可选步骤。** 例如，在一个大事务中包含了几个步骤，某个步骤失败时，只想回滚这个步骤（而不是整个大事务），并继续处理后面的步骤（可能记录错误原因）。依赖于底层数据库和JDBC驱动的保存点（Savepoint）支持（大部分主流数据库都支持）。

- **伪代码理解 (核心与 REQUIRES_NEW 的区别)：**

```java
@Transactional(propagation = Propagation.REQUIRED)
public void complexOperation() {
    step1(); // REQUIRED or NESTED (效果相同)
    try {
        optionalStep(); // NESTED - 在复杂操作的大事务内部创建嵌套事务点
    } catch (StepException e) {
        // 只回滚optionalStep做的数据库操作(依赖保存点)，外部事务未回滚！
        log.error("Optional step failed, skipping", e);
    }
    step3(); // 不受optionalStep失败的影响，继续在外部事务中执行
}
```

* * *

**关键点总结与注意事项：**

1. **默认与推荐：** `REQUIRED` 是默认值，满足 80% 的常规业务场景需求。

3. **事务的创建与加入：** `REQUIRED`， `SUPPORTS`， `MANDATORY`， `NESTED` 会加入或不创建事务；`REQUIRES_NEW` 和 `NOT_SUPPORTED` 会暂停外部事务；`NEVER` 拒绝加入。

5. **`REQUIRES_NEW` vs `NESTED`：**
    - **独立性：** `REQUIRES_NEW` 是完全独立的两个物理事务，各自提交/回滚（外部异常不影响它提交，除非自己内部失败）。`NESTED` 是同一个物理事务内部的逻辑划分（外部事务回滚必然导致嵌套事务回滚）。

    - **数据库连接：** `REQUIRES_NEW` 通常需要获取一个新的数据库连接（性能开销大）。`NESTED` 使用同一个连接，仅设置保存点（性能开销小）。

    - **应用场景：** 需要操作完全独立 => `REQUIRES_NEW`；需要部分步骤可选回滚 => `NESTED`。

7. **`SUPPORTS` vs `NOT_SUPPORTED` vs `NEVER`：** 是否支持在事务内运行？需要控制事务性。

9. **`MANDATORY` vs `NEVER`：** 强制必须有事务 vs 强制必须不能有事务。

11. **代理机制：** **同一个类内部方法互相调用时，基于代理（AOP）的事务行为不会生效！** 因为内部调用是 `this`，绕过代理对象。

13. **平台差异：** `NESTED` 依赖于底层数据库是否支持保存点。

15. **与隔离级别的区分：** 传播机制解决的是事务边界传播的问题；隔离级别解决的是并发事务之间的可见性问题（脏读、不可重复读、幻读）。

17. **回滚规则：** 传播机制定义了事务如何传播，但最终某个具体事务回滚与否还依赖于**声明的回滚规则（rollbackFor/noRollbackFor）** 以及方法执行过程中是否抛出符合这些规则的异常。

**实际选型建议：**

- **无脑选：** 绝大部分情况下用 `REQUIRED`。

- **特殊场景选型：**
    - 内层操作必须执行成功（即使外层失败）：`REQUIRES_NEW`（记录关键日志/消息）。

    - 内层操作失败后希望不影响外层主体逻辑：`REQUIRES_NEW` (希望完全独立) 或 `NESTED` (仅部分回滚，且要求底层支持)。

    - 方法逻辑要求必须有事务调用：`MANDATORY`。

    - 方法明确不能运行在事务中（极罕见）：`NEVER`。

    - 方法可在事务中也可不在：`SUPPORTS` (需谨慎评估是否影响一致性)。

透彻理解Spring事务传播行为是避免分布式事务中数据不一致的基石，建议结合实际问题场景进行实践体会。

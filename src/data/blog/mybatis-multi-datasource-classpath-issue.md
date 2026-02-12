---
author: Carol
pubDatetime: 2025-10-02T00:00:00Z
title: "MyBatis 多数据源踩坑记录：本地 100% 过，上线 50% 炸，罪魁祸首竟然是 classpath 顺序"
description: 记录一次由于 classpath 顺序导致的 MyBatis 多数据源问题排查过程。
draft: false
tags:
  - clickhouse
  - debug
  - mybatis
  - mysql
  - 知识
---

> 知道的人应该知道😂，在我们使用IDEA启动Java代码的时候，其实是用 exploded directory 方式启动的。
>
> 所谓 **IDEA 用 exploded directory 方式启动**，其实就是 **IDEA 在运行 Spring Boot 应用时，不是把你的工程先打成一个 fat jar，再运行，而是直接把编译好的 class 和资源文件目录（target/classes）挂到 JVM 的 classpath 上**。

事情还要从昨天晚上说起。昨天下班刚到家，手就响了，打开手机一看。

![image-20250930153532051](https://carol-database-oos.oss-cn-guangzhou.aliyuncs.com/image-20250930153532051.png)

我的接口报错了😱，明明本地测试和预发环境都可以，为什么一到生产环境就不行了？不过还好这只是我们的内部后台管理系统。

立马打开电脑，排查问题，最后把一个xml文件从`/mapper` 文件夹移动到`/mapper/clickhouse`文件夹之后就可以。

那么为什么会出现本地和预发环境和都可以，但是生产环境就不行呢，经过我的研究，终于得出了原因。

## Mybatis/Mybatis-Plus的部分工作机制

项目使用的是Mybatis-Plus，接下来从Spring的启动流程来简单概括一下。

### 1. 启动阶段：Spring 解析配置类

在Spring的启动阶段中，会有解释配置类（`@Configuration`）的过程。

1. `@Configuration` 被 `ConfigurationClassPostProcessor` 加载；

3. 遇到 `@MapperScan("com.ruoyi.xxx.mapper")` → Spring 会动态注册一个 `MapperScannerConfigurer` （MyBatis-Plus 里叫 `MapperScannerRegistrar` ）

5. `MapperScannerConfigurer` 做的事：
    - 拿到包名，用 `ClassPathBeanDefinitionScanner` 扫出所有带 @Mapper 的接口；
    - 把每个接口包装成 `BeanDefinition` ，`beanClass` 设置成 `MapperFactoryBean` （这是关键代理工厂）；
    - 同时把 `sqlSessionFactoryRef / sqlSessionTemplateRef` 写进 `BeanDefinition` 的属性里，提前绑定用哪个 `SqlSessionFactory`；
    - 最后把这些 `BeanDefinition` 注册到 Spring 容器，但此时还并没有实例。

**效果：接口被提前"预约"成 Spring Bean，真正的实现类是 MyBatis 生成的代理。**

### 2. 创建 SqlSessionFactory

调用`MybatisSqlSessionFactoryBean`

1. 解析 `mapperLocations` → 把所有 XML 读成 `InputStream` ，封装成 `SqlSource` ；

3. 解析 XML 里的 <select|insert|update|delete> → 生成 `MappedStatement` ，id = 接口全限定名 + 方法名；

5. 把 MappedStatement 注册到 `Configuration.mappedStatements`（一个严格 Map，key 就是 id）；

7. 返回 `DefaultSqlSessionFactory` 实例。

**效果：XML 被解析成可执行的 SQL 模板，并与接口方法一一绑定。**

### 3. 注入阶段：Spring 实例化接口

当业务类里第一次出现

```java
@Autowiredprivate UserMapper userMapper;   // 只是接口
```

Spring 根据第 1 步注册的 `BeanDefinition` ，实际创建的是 `MapperFactoryBean.getObject()`

`MapperFactoryBean` 会

- 拿到提前绑定好的 `SqlSessionFactory`；

- 用 `SqlSession.getMapper(UserMapper.class)` 让 MyBatis 生成一个 JDK 动态代理（ `MapperProxy` ）；

- 代理会把所有方法调用转成

```java
sqlSession.selectOne(statement = "com.xxx.UserMapper.selectById", args);
```

- `statement` 就是第 2 步里 XML 解析后产生的 `MappedStatement` 的 id。

## 数据库情况

项目配置配置了多种数据源，其中包括MySQL数据库和ClickHouse数据库。

所以我们准备了多个配置类，其中MySQL和ClickHouse的配置类分别为。

`MybatisPlusConfiguration`和`ClickHouseMyBatisConfig`，他们的扫描包分别为`@MapperScan({"com.carol.mapper"})`和`@MapperScan(basePackages = "com.carol.mapper.clickhouse"")`，可以看到他们的扫描路径其实是有重复的

，这一点很关键。然后这两个配置文件中指定的XML文件路径分别是

`classpath*:/mapper/**/*Mapper.xml`和`classpath*:/mapper/clickhouse/*Mapper.xml`

## 代码情况

我编写的代码很简单，就只是新建了一个新的Controller和配套的Service与Mapper（CarolControoler,CarolService,CarolMapper），里面就一个分页查询的接口，使用的是**ClickHouse**数据库。

按理说应该不会出什么问题，但Mapper文件和XML文件存放的位置，却有些问题。

MySQL的Mapper放在`com.carol.mapper`下，ClickHouse的Mapper放在`com.carol.mapper.clickhouse`下，我的写的mapper也遵循了这个规则。

项目中其他使用ClickHouse的XML文件都是放在`/mapper/clickhouse/`

文件夹下面的，MySQL的XML文件是放在`/mapper/`文件夹下面的。但是在我写这个接口(CarolMapper.xml)的时候，却把XML文件放到应该放MySQL的XML文件的地方（`com.carol.mapper`）但是在我本地IDEA上启动代码，测试接口，却没有问题，甚至发到预发环境测试也没有问题，但是发到生产环境的时候，接口却报错了：`invalid bound statement`。

## 原因分析

由上面的分析我们可以看到，我把`CarolMapper.xml`文件放在了`/mapper/`

文件夹下面，导致MySQL数据库的`SqlSessionFactory`可以扫描到这个XML文件，但是ClickHouse的`ClickhouseSqlSessionFactory`却扫描不到这个XML文件。

但是我的`CarolMapper.java`文件是放在正确的路径`com.carol.mapper.clickhouse`下面的，Spring是可以把它扫描变成Bean的。

**现在这里的情况**

- **ClickHouse 专用 Factory**：
    - @MapperScan → 只扫 com.carol.mapper.clickhouse 包下的接口。
    - setMapperLocations → 指定 mapper/clickhouse/*.xml。

- **主 Factory**：
    - @MapperScan → 扫整个 mapper 包（包含 ck 子包）。
    - setMapperLocations → 配置了一个广义路径（mapper/_*/_Mapper.xml）。

但是由于我的XML文件放在`/mapper/`文件夹下面，所以只能被主Factory扫描到。但是为什么在本地查询的时候可以正常运行呢？我一看，原来是我在Mapper文件上面加了`@DataSource(DataSourceType.CLICKHOUSE)`注解，所以，即使被主 Factory扫描，实际上也是查询的ClickHouse数据库。

但是为什么同样的代码，上线之后就不行了？

主要的原因还是**MappedStatement 注册竞争**导致的 **binding-not-found**； `@DataSource` 只能决定"拿哪个连接"，**救不了**"SQL 模板没注册到当前 Factory" 的硬伤。

### 本地为什么"永远好用"

* * *

- IDEA 采用**目录式** classpath，`/mapper/CarolMapper.xml` 在磁盘上**固定在前**；

- 主 Factory 先启动 → 先把 XML 解析成 `MappedStatement` 塞进自己的 `Configuration`；

- ClickHouse Factory 后启动，**发现 statementId 已存在就静默跳过**（MyBatis 默认不覆盖）；

- 调用时：
    - 接口代理用的是 **ClickHouse Factory**（`@MapperScan` 子包绑定），但 statement 实际落在**主 Factory 的 map**里；
    - 由于**两个 Factory 共用同一个 JVM**，`MappedStatement` 对象在内存里是**同一份引用**， 所以 ClickHouse Factory 也能**碰巧**拿到 statement → 不报 not-found。

![mermaid-2025102 125931](https://carol-database-oos.oss-cn-guangzhou.aliyuncs.com/mermaid-2025102%20125931.svg)

### 线上 fat-jar 为什么"偶发失败"

* * *

- 打包后顺序随机 jar 里 `JarFile#entries()` 不保证顺序，某次构建可能把 `CarolMapper.xml` 排在**clickhouse 目录之后**；

- 启动时序随之改变 ClickHouse Factory 先读到 XML → 把 statement 注册到自己 map； 主 Factory 后读到 → 发现 key 已存在，**跳过**；

- 调用阶段
    - 接口代理仍绑定 ClickHouse Factory；
    - 这次 statement **只在 ClickHouse map 里**，主 map 没有；
    - 如果恰好**重启后顺序又变**，statement 落到主 map 而 ClickHouse map 找不到 → **binding not found** 抛出来。

- "再发一次包"相当于重新洗牌，顺序刚好回到"主 Factory 先注册"就**又好了**，于是出现"**同一份代码，预发可以生产不行**"的假象。

![mermaid-2025102 130005](https://carol-database-oos.oss-cn-guangzhou.aliyuncs.com/mermaid-2025102%20130005.svg)

### 总结差异

* * *

| 场景 | classpath 顺序 | statement 注册位置 | 是否可见 | 结果 |
| --- | --- | --- | --- | --- |
| IDEA | 固定，主先注册 | 主 Factory map | 两 Factory 同 JVM 引用 | 永远成功 |
| 线上 jar | 随机 | 随机落在 A 或 B | 只有注册方可见 | 时好时坏 |

### 解决方法

* * *

1. **物理隔离文件** `CarolMapper.xml` 放到 `/mapper/clickhouse/` 目录， 让 ClickHouse Factory **100% 能扫到**；

3. **逻辑隔离扫描包** 主 Factory 的 `@MapperScan` 加 `excludeFilters = @Filter(type = FilterType.REGEX, pattern = ".*clickhouse.*")` 保证接口只被 ClickHouse Factory 代理；

5. **兜底** 两个 Factory 都用 `"classpath*:/mapper/**/*Mapper.xml"` 也行， 但**务必确保接口包不重叠**，否则仍可能覆盖。

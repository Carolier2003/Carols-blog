---
author: Carol
pubDatetime: 2025-02-12T12:00:00Z
title: "代码块语法高亮测试 - Code Block Syntax Highlight Test"
description: 专门用于测试各种编程语言代码块渲染和语法高亮效果的文章，包含不同长度和类型的代码示例。
draft: false
featured: false
tags:
  - test
  - code
  - syntax-highlight
---

这篇文章专门用于测试代码块和语法高亮的渲染效果。包含各种编程语言和不同长度的代码示例。

## 1. 单行代码与短代码块

### JavaScript 单行代码

```javascript
const greeting = "Hello, World!";
```

### Shell 命令

```bash
curl -X GET https://api.example.com/users
```

### SQL 简单查询

```sql
SELECT * FROM users WHERE id = 1;
```

### Python 单行

```python
print("Hello, Python!")
```

## 2. 中等长度代码块

### JavaScript 函数

```javascript
// 用户数据处理函数
async function fetchUserData(userId) {
  try {
    const response = await fetch(`/api/users/${userId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const userData = await response.json();
    return {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      createdAt: new Date(userData.created_at)
    };
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return null;
  }
}
```

### Python 类定义

```python
class UserService:
    """用户服务类，处理用户相关的业务逻辑"""

    def __init__(self, db_session):
        self.db = db_session
        self.cache = {}

    def get_user_by_id(self, user_id: int) -> dict | None:
        """根据ID获取用户信息"""
        # 先检查缓存
        if user_id in self.cache:
            return self.cache[user_id]

        # 查询数据库
        user = self.db.query(User).filter(User.id == user_id).first()
        if user:
            user_data = {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'is_active': user.is_active
            }
            # 存入缓存
            self.cache[user_id] = user_data
            return user_data
        return None

    def create_user(self, username: str, email: str) -> dict:
        """创建新用户"""
        new_user = User(username=username, email=email)
        self.db.add(new_user)
        self.db.commit()
        return {'id': new_user.id, 'username': username, 'email': email}
```

### Java 实体类

```java
package com.example.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    private UserStatus status = UserStatus.ACTIVE;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
}

enum UserStatus {
    ACTIVE, INACTIVE, SUSPENDED
}
```

## 3. 长代码块

### TypeScript 复杂类型定义

```typescript
// API 响应类型定义
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
  requestId: string;
}

interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface PaginationResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// 用户相关类型
interface User {
  id: string;
  username: string;
  email: string;
  profile: UserProfile;
  roles: Role[];
  permissions: Permission[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface UserProfile {
  avatar?: string;
  nickname?: string;
  bio?: string;
  location?: string;
  website?: string;
  socialLinks: SocialLink[];
}

interface SocialLink {
  platform: 'github' | 'twitter' | 'linkedin' | 'weibo';
  url: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  level: number;
}

interface Permission {
  id: string;
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete';
  conditions?: Record<string, unknown>;
}

// 泛型工具类型
type ApiHandler<P, R> = (params: P) => Promise<ApiResponse<R>>;
type Nullable<T> = T | null;
type Optional<T> = T | undefined;
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

// 事件系统类型
interface EventMap {
  'user:login': { userId: string; timestamp: number; ip: string };
  'user:logout': { userId: string; timestamp: number };
  'user:update': { userId: string; changes: Partial<User> };
  'error': { message: string; stack?: string; context?: unknown };
}

type EventName = keyof EventMap;
type EventPayload<T extends EventName> = EventMap[T];
type EventListener<T extends EventName> = (payload: EventPayload<T>) => void | Promise<void>;

class TypedEventEmitter {
  private listeners: Map<EventName, Set<EventListener<any>>> = new Map();

  on<T extends EventName>(event: T, listener: EventListener<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off<T extends EventName>(event: T, listener: EventListener<T>): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit<T extends EventName>(event: T, payload: EventPayload<T>): void {
    this.listeners.get(event)?.forEach(listener => {
      try {
        listener(payload);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }
}
```

### Java Spring Boot 完整示例

```java
package com.example.demo.controller;

import com.example.demo.entity.User;
import com.example.demo.service.UserService;
import com.example.demo.dto.UserDTO;
import com.example.demo.dto.CreateUserRequest;
import com.example.demo.dto.UpdateUserRequest;
import com.example.demo.dto.ApiResponse;
import com.example.demo.exception.UserNotFoundException;
import com.example.demo.exception.ValidationException;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/users")
@Validated
public class UserController {

    private final UserService userService;
    private final UserMapper userMapper;

    @Autowired
    public UserController(UserService userService, UserMapper userMapper) {
        this.userService = userService;
        this.userMapper = userMapper;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<UserDTO>>> getAllUsers(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Min(1) int size,
            @RequestParam(required = false) String sortBy,
            @RequestParam(defaultValue = "asc") String sortOrder) {

        Pageable pageable = PageRequest.of(page, size,
            Sort.by(sortOrder.equalsIgnoreCase("desc") ? Sort.Direction.DESC : Sort.Direction.ASC,
                    sortBy != null ? sortBy : "id"));

        Page<User> userPage = userService.findAll(pageable);
        List<UserDTO> userDTOs = userPage.getContent().stream()
                .map(userMapper::toDTO)
                .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success(userDTOs, userPage.getTotalElements()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<UserDTO>> getUserById(@PathVariable @Min(1) Long id) {
        User user = userService.findById(id)
                .orElseThrow(() -> new UserNotFoundException("User not found with id: " + id));

        return ResponseEntity.ok(ApiResponse.success(userMapper.toDTO(user)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<UserDTO>> createUser(@RequestBody @Valid CreateUserRequest request) {
        if (userService.existsByEmail(request.getEmail())) {
            throw new ValidationException("Email already registered: " + request.getEmail());
        }

        User user = userMapper.toEntity(request);
        User savedUser = userService.save(user);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(userMapper.toDTO(savedUser)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<UserDTO>> updateUser(
            @PathVariable @Min(1) Long id,
            @RequestBody @Valid UpdateUserRequest request) {

        User existingUser = userService.findById(id)
                .orElseThrow(() -> new UserNotFoundException("User not found with id: " + id));

        userMapper.updateEntityFromRequest(request, existingUser);
        User updatedUser = userService.save(existingUser);

        return ResponseEntity.ok(ApiResponse.success(userMapper.toDTO(updatedUser)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteUser(@PathVariable @Min(1) Long id) {
        if (!userService.existsById(id)) {
            throw new UserNotFoundException("User not found with id: " + id);
        }

        userService.deleteById(id);
        return ResponseEntity.ok(ApiResponse.success(null, "User deleted successfully"));
    }

    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleUserNotFound(UserNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error(404, ex.getMessage()));
    }

    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(ValidationException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(400, ex.getMessage()));
    }
}
```

## 4. 配置文件

### YAML 配置

```yaml
server:
  port: 8080
  servlet:
    context-path: /api

spring:
  application:
    name: demo-service

  datasource:
    url: jdbc:mysql://localhost:3306/demo_db?useSSL=false&serverTimezone=UTC
    username: ${DB_USERNAME:root}
    password: ${DB_PASSWORD:password}
    driver-class-name: com.mysql.cj.jdbc.Driver
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000

  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: true
    properties:
      hibernate:
        dialect: org.hibernate.dialect.MySQL8Dialect
        format_sql: true

  redis:
    host: localhost
    port: 6379
    password: ${REDIS_PASSWORD:}
    lettuce:
      pool:
        max-active: 8
        max-idle: 8
        min-idle: 0

logging:
  level:
    root: INFO
    com.example.demo: DEBUG
  pattern:
    console: "%d{yyyy-MM-dd HH:mm:ss} [%thread] %-5level %logger{36} - %msg%n"
```

### JSON 数据

```json
{
  "users": [
    {
      "id": 1,
      "username": "alice",
      "email": "alice@example.com",
      "profile": {
        "age": 28,
        "city": "Beijing",
        "hobbies": ["reading", "coding", "traveling"]
      },
      "roles": ["admin", "editor"],
      "isActive": true,
      "createdAt": "2024-01-15T08:30:00Z"
    },
    {
      "id": 2,
      "username": "bob",
      "email": "bob@example.com",
      "profile": {
        "age": 32,
        "city": "Shanghai",
        "hobbies": ["gaming", "music"]
      },
      "roles": ["user"],
      "isActive": true,
      "createdAt": "2024-02-20T14:45:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 2,
    "totalPages": 1
  }
}
```

### Docker Compose

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: demo-app
    ports:
      - "8080:8080"
    environment:
      - SPRING_PROFILES_ACTIVE=docker
      - DB_HOST=mysql
      - REDIS_HOST=redis
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_started
    networks:
      - demo-network
    restart: unless-stopped

  mysql:
    image: mysql:8.0
    container_name: demo-mysql
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: demo_db
      MYSQL_USER: demo_user
      MYSQL_PASSWORD: demo_pass
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - demo-network

  redis:
    image: redis:7-alpine
    container_name: demo-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    networks:
      - demo-network

volumes:
  mysql_data:
  redis_data:

networks:
  demo-network:
    driver: bridge
```

## 5. SQL 复杂查询

```sql
-- 查询每个部门的平均工资，以及该部门工资高于平均水平的员工
WITH dept_stats AS (
    SELECT
        d.department_id,
        d.department_name,
        AVG(e.salary) as avg_salary,
        COUNT(e.employee_id) as employee_count
    FROM departments d
    LEFT JOIN employees e ON d.department_id = e.department_id
    GROUP BY d.department_id, d.department_name
),
ranked_employees AS (
    SELECT
        e.employee_id,
        e.first_name,
        e.last_name,
        e.salary,
        e.department_id,
        d.department_name,
        ds.avg_salary,
        RANK() OVER (PARTITION BY e.department_id ORDER BY e.salary DESC) as salary_rank
    FROM employees e
    JOIN departments d ON e.department_id = d.department_id
    JOIN dept_stats ds ON d.department_id = ds.department_id
)
SELECT
    re.department_name,
    re.avg_salary as department_avg_salary,
    re.first_name || ' ' || re.last_name as employee_name,
    re.salary as employee_salary,
    re.salary - re.avg_salary as difference,
    re.salary_rank,
    CASE
        WHEN re.salary > re.avg_salary THEN 'Above Average'
        WHEN re.salary = re.avg_salary THEN 'Average'
        ELSE 'Below Average'
    END as salary_status
FROM ranked_employees re
WHERE re.salary_rank <= 3
ORDER BY re.department_name, re.salary DESC;
```

## 6. CSS 样式

```css
/* 现代卡片组件样式 */
.card-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  padding: 2rem;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.card {
  position: relative;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
              0 2px 4px -1px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
              0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.card__image {
  width: 100%;
  height: 200px;
  object-fit: cover;
  background: linear-gradient(45deg, #667eea 0%, #764ba2 100%);
}

.card__content {
  padding: 1.5rem;
}

.card__title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a202c;
  margin-bottom: 0.5rem;
  line-height: 1.4;
}

.card__description {
  color: #718096;
  font-size: 0.875rem;
  line-height: 1.6;
  margin-bottom: 1rem;
}

.card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 1rem;
  border-top: 1px solid #e2e8f0;
}

.card__button {
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 1rem;
  background-color: #4299e1;
  color: white;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  transition: background-color 0.2s;
}

.card__button:hover {
  background-color: #3182ce;
}

@media (max-width: 640px) {
  .card-container {
    grid-template-columns: 1fr;
    padding: 1rem;
  }
}
```

## 7. HTML 模板

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="示例页面">
  <title>代码高亮测试页面</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="header">
    <nav class="nav">
      <a href="/" class="nav__logo">Logo</a>
      <ul class="nav__menu">
        <li><a href="/home" class="nav__link">首页</a></li>
        <li><a href="/about" class="nav__link">关于</a></li>
        <li><a href="/contact" class="nav__link">联系</a></li>
      </ul>
    </nav>
  </header>

  <main class="main">
    <article class="article">
      <h1>欢迎来到代码高亮测试页面</h1>
      <p>这是一个用于测试各种代码块渲染效果的示例页面。</p>

      <section class="section">
        <h2>特性介绍</h2>
        <ul>
          <li>支持多种编程语言</li>
          <li>语法高亮显示</li>
          <li>代码复制功能</li>
          <li>响应式设计</li>
        </ul>
      </section>

      <form class="form" action="/submit" method="POST">
        <div class="form__group">
          <label for="email">邮箱</label>
          <input type="email" id="email" name="email" required
                 placeholder="your@email.com">
        </div>
        <button type="submit" class="button">提交</button>
      </form>
    </article>
  </main>

  <footer class="footer">
    <p>&copy; 2025 Code Highlight Test. All rights reserved.</p>
  </footer>

  <script src="app.js"></script>
</body>
</html>
```

## 8. Shell 脚本

```bash
#!/bin/bash

# 部署脚本 - 自动化部署应用到生产环境

set -euo pipefail

# 配置变量
APP_NAME="demo-service"
VERSION=${1:-latest}
DEPLOY_DIR="/opt/apps/${APP_NAME}"
BACKUP_DIR="/opt/backups/${APP_NAME}"
LOG_FILE="/var/log/deploy.log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    log "${RED}ERROR: $1${NC}"
    exit 1
}

info() {
    log "${GREEN}INFO: $1${NC}"
}

warn() {
    log "${YELLOW}WARN: $1${NC}"
}

# 检查依赖
check_dependencies() {
    local deps=("docker" "docker-compose" "curl")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            error "$dep is required but not installed"
        fi
    done
    info "All dependencies satisfied"
}

# 创建备份
backup_current() {
    if [ -d "$DEPLOY_DIR" ]; then
        local backup_name="${BACKUP_DIR}/backup_$(date +%Y%m%d_%H%M%S).tar.gz"
        mkdir -p "$BACKUP_DIR"
        tar -czf "$backup_name" -C "$DEPLOY_DIR" .
        info "Backup created: $backup_name"
    fi
}

# 清理旧备份 (保留最近5个)
cleanup_backups() {
    local backup_count
    backup_count=$(find "$BACKUP_DIR" -name "backup_*.tar.gz" | wc -l)
    if [ "$backup_count" -gt 5 ]; then
        find "$BACKUP_DIR" -name "backup_*.tar.gz" -type f -printf '%T+ %p\n' | \
            sort | head -n -5 | cut -d' ' -f2- | xargs rm -f
        info "Old backups cleaned up"
    fi
}

# 主部署流程
main() {
    info "Starting deployment of $APP_NAME version $VERSION"

    check_dependencies
    backup_current
    cleanup_backups

    # 拉取最新镜像
    info "Pulling Docker image..."
    docker pull "${APP_NAME}:${VERSION}"

    # 停止现有服务
    info "Stopping current services..."
    cd "$DEPLOY_DIR" || error "Deploy directory not found"
    docker-compose down --remove-orphans

    # 更新 docker-compose.yml 中的版本
    sed -i "s|image: ${APP_NAME}:.*|image: ${APP_NAME}:${VERSION}|g" docker-compose.yml

    # 启动新服务
    info "Starting new services..."
    docker-compose up -d

    # 健康检查
    info "Performing health check..."
    local retries=0
    local max_retries=30

    while [ $retries -lt $max_retries ]; do
        if curl -sf http://localhost:8080/actuator/health > /dev/null; then
            info "Health check passed!"
            break
        fi
        retries=$((retries + 1))
        warn "Health check attempt $retries failed, retrying..."
        sleep 2
    done

    if [ $retries -eq $max_retries ]; then
        error "Health check failed after $max_retries attempts"
    fi

    # 清理旧镜像
    docker image prune -af --filter "until=168h"

    info "Deployment completed successfully!"
}

# 执行
main "$@"
```

## 9. 行内代码测试

这是一段包含 `行内代码` 的文本。你可以在句子中间使用 `const x = 1` 或 `System.out.println("Hello")` 这样的代码。

多个行内代码：`git add .`、`docker build -t app .`、`npm install`、`pip install requests`

## 10. 特殊格式

### 空代码块

```
```

### 只有注释的代码块

```javascript
// 这行是注释
/* 这也是注释 */
# Python 注释
-- SQL 注释
```

### 非常长的单行

```javascript
const veryLongString = "这是一段非常长的字符串，用于测试代码块的横向滚动和溢出处理。Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";
```

---

文章结束。这篇文章涵盖了多种编程语言、不同长度的代码块以及各种语法元素，可以用来全面测试代码块的渲染效果。

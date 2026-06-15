# 安全策略

## 认证模型

### 摘要

- **方法**：共享口令哈希 + 独立 `AUTH_SECRET` 签名 cookie
- **公开边界**：`/` 为公开球队主页，不读取或渲染私有 Workspace 数据
- **受保护边界**：`/panel/*` 与 `/api/workspace/*`
- **无用户系统**：单一管理员 passcode，无多用户、无 RBAC
- **无外部认证提供商**：不使用 Supabase Auth、OAuth、JWT

### Passcode 验证

`src/lib/auth.ts` 实现：

```
POST /api/unlock
  body: { passcode: "..." }
  → scrypt 校验 against process.env.APP_ADMIN_PASSCODE_HASH
  → 成功：set signed cookie "baseball_manager_unlock"
  → 失败：401
```

### Cookie 结构

```
baseball_manager_unlock = "<base64url-session-json>.<hex-signature>"
```

- Payload：`{ v, sid, iat, exp }`
- 签名：`HMAC-SHA256(AUTH_SECRET, payload)` → hex
- 验证：`timingSafeEqual` 常量时间比对，防时序攻击
- 过期：服务端校验 `exp`，不是只依赖浏览器 `max-age`
- 属性：`httpOnly`（不可 JS 读取）、`sameSite=lax`、`path=/`、7 天过期
- `secure` 仅在 `NODE_ENV === "production"` 时启用

### API 鉴权

`src/proxy.ts` 作为 Next.js 请求代理保护控制台和 Workspace API：

```
每个请求到 /panel/* 或 /api/workspace/*
  → 读取 cookie "baseball_manager_unlock"
  → isUnlockCookieValid(cookie)
  → 页面无效：302 到 /panel/login?next=原路径
  → API 无效：401 { error: "unauthorized" }
  → 有效：放行
```

`/api/unlock` 和 `/api/logout` 不受中间件保护（无需认证）。

登录回跳通过 `normalizePanelNextPath()` 限定在 `/panel` 命名空间内，并拒绝登录页自身，避免开放重定向和回跳循环。

### 登出

`POST /api/logout` 清除 cookie（设置同名 cookie 为 `max-age=0`）。

## 环境变量

| 变量 | 用途 | 访问范围 |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 连接字符串 | 服务端（`db.ts`） |
| `DATABASE_CA_CERT` | 自定义数据库 CA PEM（可选） | 服务端（`db.ts`） |
| `APP_ADMIN_PASSCODE_HASH` | 管理员口令的 scrypt 哈希 | 服务端（`auth.ts`） |
| `AUTH_SECRET` | Cookie HMAC 签名密钥 | 服务端（`auth.ts`） |

**规则**：
- 三个变量仅在服务端代码中使用，不会暴露到客户端 bundle
- 缺少时在首次使用时抛出明确错误，不静默失败
- `.env.example` 提供模版，`.env.local` 包含实际值（已在 `.gitignore`）
- 建议通过 `npm run auth:env -- "your-passcode"` 生成口令哈希和随机签名密钥

## 数据库安全

- **连接池**：`pg.Pool`；Supabase 主机使用 `max = 1`，其他主机使用 `max = 5`；`idleTimeoutMillis = 30000`，`connectionTimeoutMillis = 10000`
- **TLS**：Supabase 主机启用严格证书校验，并显式信任内置的 `Supabase Root 2021 CA`；其他私有 CA 场景可通过 `DATABASE_CA_CERT` 提供 PEM，不允许 `rejectUnauthorized: false`
- **Row-Level Security**：迁移中已对 `public.app_workspace` 启用 RLS，但当前应用的访问控制主要依赖服务端 API 与签名 cookie，而不是基于用户身份的 RLS 策略
- **无 Supabase Auth / Realtime**：仅使用 PostgreSQL 数据库，不使用 Supabase 其他功能
- **表结构**：单表 `app_workspace`，列 `slug`（TEXT）、`version`（INT）、`data`（JSONB）

## 数据校验

所有数据在进入和离开系统时经过净化：

| 入口 | 净化函数 |
|---|---|
| API 输入（PUT workspace） | `sanitizeWorkspace()` |
| DB 读取（GET workspace） | `sanitizeWorkspace()` |
| JSON 导入 | `prepareImport()`（内部按导入类型调用 `sanitizeWorkspace()` 或 `sanitizePlayers()` / `sanitizeScenario()`） |
| 旧版数据迁移 | `migrateLegacyState()` |

## 安全约束

- 口令不再以明文环境变量参与运行时鉴权；部署时应保护 `APP_ADMIN_PASSCODE_HASH` 和 `AUTH_SECRET`
- 解锁接口已有内存级速率限制：按 IP 5 次 / 60 秒；Workspace 读写和登出也有限流；如需跨实例一致限制，仍需在反向代理或外部网关补充
- 当前没有单独的 CSRF token 机制；防护主要依赖 `sameSite=lax` cookie 与 JSON API 形态
- 已通过 `next.config.ts` 增加 CSP、`X-Frame-Options`、`X-Content-Type-Options`、`Referrer-Policy` 和 `Permissions-Policy`
- `next.config.ts` 对 `/panel/*` 与 `/api/*` 设置 `private, no-store`，Cloudflare 不应为这些路径配置覆盖源站的公共缓存规则

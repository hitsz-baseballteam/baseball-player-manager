# 安全策略

## 认证模型

### 摘要

- **方法**：共享 passcode + HMAC-SHA256 签名 cookie
- **无用户系统**：单一管理员 passcode，无多用户、无 RBAC
- **无外部认证提供商**：不使用 Supabase Auth、OAuth、JWT

### Passcode 验证

`src/lib/auth.ts` 实现：

```
POST /api/unlock
  body: { passcode: "..." }
  → verifyPasscode(passcode)  // 明文比对 process.env.APP_ADMIN_PASSCODE
  → 成功：set cookie "baseball_manager_unlock" = "v1:unlocked.<hmac-sha256>"
  → 失败：401
```

### Cookie 结构

```
baseball_manager_unlock = "v1:unlocked.<hex-signature>"
```

- Payload：固定字符串 `v1:unlocked`
- 签名：`HMAC-SHA256(passcode, payload)` → hex
- 验证：`timingSafeEqual` 常量时间比对，防时序攻击
- 属性：`httpOnly`（不可 JS 读取）、`sameSite=lax`、`path=/`、7 天过期
- `secure` 仅在 `NODE_ENV === "production"` 时启用

### API 鉴权

`src/proxy.ts` 作为 Next.js 中间件保护 `/api/workspace` 路由：

```
每个请求到 /api/workspace/*
  → 读取 cookie "baseball_manager_unlock"
  → isUnlockCookieValid(cookie)
  → 无效：401 { error: "unauthorized" }
  → 有效：放行
```

`/api/unlock` 和 `/api/logout` 不受中间件保护（无需认证）。

### 登出

`POST /api/logout` 清除 cookie（设置同名 cookie 为 `max-age=0`）。

## 环境变量

| 变量 | 用途 | 访问范围 |
|---|---|---|
| `DATABASE_URL` | Supabase PostgreSQL 连接字符串 | 服务端（`db.ts`） |
| `APP_ADMIN_PASSCODE` | 管理员 passcode | 服务端（`auth.ts`） |

**规则**：
- 两个变量仅在服务端代码中使用，不会暴露到客户端 bundle
- 缺少时在首次使用时抛出明确错误，不静默失败
- `.env.example` 提供模版，`.env.local` 包含实际值（已在 `.gitignore`）

## 数据库安全

- **连接池**：`pg.Pool`，最大 5 连接，30s 空闲超时
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

- Passcode 在服务端明文读取自 `process.env.APP_ADMIN_PASSCODE`；部署时应按常规 secret 管理方式保护环境变量
- 解锁接口已有内存级速率限制：按 IP 5 次 / 60 秒；如需跨实例一致限制，仍需在反向代理或外部网关补充
- 当前没有单独的 CSRF token 机制；防护主要依赖 `sameSite=lax` cookie 与 JSON API 形态
- 无 CSP 头：当前未设置 Content-Security-Policy，如需可通过 Next.js headers 配置添加

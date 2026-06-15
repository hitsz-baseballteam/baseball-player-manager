# ADR-003: 选择 HMAC cookie 认证而非 JWT / Supabase Auth

状态：已采纳

## 背景

项目需要一个简单的认证机制保护工作区数据。需要考虑的方案包括自实现 cookie 认证、JWT、以及 Supabase 内置的 Auth 服务。

## 决策

使用独立 `AUTH_SECRET` 进行 HMAC-SHA256 签名 cookie（`baseball_manager_unlock`），payload 为带 `sid / iat / exp` 的会话对象。管理员口令仅以 `APP_ADMIN_PASSCODE_HASH` 的 scrypt 哈希形式保存在服务端环境变量中，并只用于登录验证。

## 理由

- **极简**：项目是单人使用工具，不需要用户注册、密码重置、多角色等复杂认证功能
- **无外部依赖**：不需要 JWT 库或 Supabase Auth 服务，仅依赖 Node.js 内置 `crypto` 模块
- **安全边界更清晰**：口令哈希和 Cookie 签名密钥分离，可独立轮换，不再出现“口令泄露 = 会话签名密钥泄露”
- **安全性足够**：HMAC-SHA256 签名 + `timingSafeEqual` 常量时间比较 + `httpOnly` cookie + 绝对过期，满足共享控制台的安全需求
- **无状态**：不需要数据库存储 session，cookie 自包含签名

## 备选方案

- **JWT**：适合分布式系统，但项目是单进程 Next.js 应用，不需要无状态 token。JWT 的过期、刷新、吊销等机制增加了不必要的复杂度
- **Supabase Auth**：功能强大但引入 row-level security、用户管理、邮件验证等大量不需要的功能。项目已有自己的数据校验层，不依赖 DB 级别的 RLS

## 后果

- 无多用户支持：共享 passcode 意味着所有知道密码的人拥有相同权限
- 口令轮换需要重新生成 `APP_ADMIN_PASSCODE_HASH`
- `AUTH_SECRET` 与口令哈希都属于高敏感环境变量，需要单独保管
- cookie 的 `secure` 标志仅在 `NODE_ENV === "production"` 时启用
- 解锁接口已有内存级速率限制（5 次 / 60 秒）；如需跨实例一致限流，仍需外部网关配合

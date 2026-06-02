# ADR-003: 选择 HMAC cookie 认证而非 JWT / Supabase Auth

状态：已采纳

## 背景

项目需要一个简单的认证机制保护工作区数据。需要考虑的方案包括自实现 cookie 认证、JWT、以及 Supabase 内置的 Auth 服务。

## 决策

使用 HMAC-SHA256 签名 cookie（`baseball_manager_unlock`），payload 为固定字符串。passcode 仅在服务端用于签名和验证。

## 理由

- **极简**：项目是单人使用工具，不需要用户注册、密码重置、多角色等复杂认证功能
- **无外部依赖**：不需要 JWT 库或 Supabase Auth 服务，仅依赖 Node.js 内置 `crypto` 模块
- **安全性足够**：HMAC-SHA256 签名 + `timingSafeEqual` 常量时间比较 + `httpOnly` cookie，满足单人管理工具的安全需求
- **无状态**：不需要数据库存储 session，cookie 自包含签名

## 备选方案

- **JWT**：适合分布式系统，但项目是单进程 Next.js 应用，不需要无状态 token。JWT 的过期、刷新、吊销等机制增加了不必要的复杂度
- **Supabase Auth**：功能强大但引入 row-level security、用户管理、邮件验证等大量不需要的功能。项目已有自己的数据校验层，不依赖 DB 级别的 RLS

## 后果

- 无多用户支持：共享 passcode 意味着所有知道密码的人拥有相同权限
- 无密码哈希：passcode 在环境变量中明文存储，需要依赖常规 secret 管理措施保护
- cookie 的 `secure` 标志仅在 `NODE_ENV === "production"` 时启用
- 解锁接口已有内存级速率限制（5 次 / 60 秒）；如需跨实例一致限流，仍需外部网关配合

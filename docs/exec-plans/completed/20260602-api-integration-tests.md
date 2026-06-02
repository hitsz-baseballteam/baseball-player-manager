# API 集成测试

## 目标

为 2 个 API 路由编写集成测试，mock pg Pool。

## 范围

### 做
- 测试 `POST /api/unlock`：正确 passcode 返回 204 + cookie / 错误返回 401 / 速率限制返回 429
- 测试 `GET /api/workspace`：返回 workspace snapshot（认证由 proxy.ts 层处理，route 层不测 401）
- 测试 `PUT /api/workspace`：正常写入 / 版本冲突返回 409 / 无效 payload 返回 400
- Mock 方案：`mock.method(pg.Pool.prototype, "connect")` — 在 beforeEach 中拦截连接

### 不做
- 不测 proxy.ts 认证中间件（需要 mock cookie，不同测试层级）
- 不写端到端测试

## 验证

- [x] `npm test` — 42 tests passing（+8 API tests）
- [x] `npm run lint` — 0 errors
- [x] `npm run build` — exit 0

## 进度

- [x] 2026-06-02 — 计划完成
- [x] unlock route 测试（4 tests）
- [x] workspace route 测试（4 tests）

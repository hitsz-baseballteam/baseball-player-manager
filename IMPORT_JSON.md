# JSON 导入说明

本文档说明前端当前支持的两种 JSON 导入方式，以及对应的 payload 模版。

## 概览

前端导入入口会根据 JSON 的 `type` 字段走不同逻辑：

- `type: "workspace"`：全量替换当前工作区
- `type: "scenario"`：增量追加一个方案，并合并该方案引用到的球员

当前仅支持 `version: 2` 的 JSON。

## 方式一：导入工作区 `workspace`

### 行为

导入 `workspace` 类型 JSON 时，前端会用导入内容整体替换当前工作区的：

- `players`
- `scenarios`
- `activeScenarioId`

但会保留当前本地 `preferences`，也就是帮助引导已读状态不会被导入文件覆盖。

### 适用场景

- 从备份完整恢复工作区
- 在不同环境之间迁移整套球员和方案数据

### 模版

```json
{
  "type": "workspace",
  "version": 2,
  "exportedAt": "2026-05-29T12:00:00.000Z",
  "players": [
    {
      "id": "p-01",
      "name": "张三",
      "number": "18",
      "throws": "R",
      "bats": "L",
      "positions": ["P", "1B"],
      "status": "available"
    },
    {
      "id": "p-02",
      "name": "李四",
      "number": "2",
      "throws": "R",
      "bats": "R",
      "positions": ["C"],
      "status": "rest"
    }
  ],
  "scenarios": [
    {
      "id": "s-01",
      "name": "常规先发",
      "note": "默认阵容",
      "assignments": {
        "defense": {
          "P": "p-01",
          "C": "p-02",
          "1B": null,
          "2B": null,
          "3B": null,
          "SS": null,
          "LF": null,
          "CF": null,
          "RF": null
        },
        "lineup": ["p-01", "p-02", null, null, null, null, null, null, null]
      },
      "createdAt": "2026-05-29T12:00:00.000Z",
      "updatedAt": "2026-05-29T12:00:00.000Z"
    }
  ],
  "activeScenarioId": "s-01"
}
```

## 方式二：导入单方案 `scenario`

### 行为

导入 `scenario` 类型 JSON 时，不会替换整个工作区，而是执行增量追加：

- 导入文件里的 `players` 会按 `id` 合并到当前工作区
- 如果某个球员 `id` 已存在，则现有球员会被导入内容覆盖
- 如果某个球员 `id` 不存在，则新增到当前工作区
- `scenario` 会被复制成一个新的方案追加到 `scenarios`
- 这个新方案会生成新的 `scenario.id`
- 新方案名称会自动追加“（导入）”；如果重名，会继续加序号
- 导入完成后，新方案会成为当前激活方案

### 适用场景

- 给现有工作区追加一套新阵容
- 在不覆盖全部数据的前提下复用某个方案

### 模版

```json
{
  "type": "scenario",
  "version": 2,
  "exportedAt": "2026-05-29T12:00:00.000Z",
  "players": [
    {
      "id": "p-01",
      "name": "张三",
      "number": "18",
      "throws": "R",
      "bats": "L",
      "positions": ["P", "1B"],
      "status": "available"
    },
    {
      "id": "p-02",
      "name": "李四",
      "number": "2",
      "throws": "R",
      "bats": "R",
      "positions": ["C"],
      "status": "available"
    }
  ],
  "scenario": {
    "id": "s-import-01",
    "name": "对左投阵容",
    "note": "只导入这一套方案",
    "assignments": {
      "defense": {
        "P": "p-01",
        "C": "p-02",
        "1B": null,
        "2B": null,
        "3B": null,
        "SS": null,
        "LF": null,
        "CF": null,
        "RF": null
      },
      "lineup": ["p-02", "p-01", null, null, null, null, null, null, null]
    },
    "createdAt": "2026-05-29T12:00:00.000Z",
    "updatedAt": "2026-05-29T12:00:00.000Z"
  }
}
```

## 字段要求

### 顶层字段

- `type` 必须是 `"workspace"` 或 `"scenario"`
- `version` 必须是 `2`
- `exportedAt` 当前只作为导出时间保留，导入逻辑不依赖它

### 球员字段 `players[]`

- `id`：必填
- `name`：必填
- `number`：必填
- `throws`：`"R" | "L" | "S"`，非法值会回退为 `"R"`
- `bats`：`"R" | "L" | "S"`，非法值会回退为 `"R"`
- `positions`：可选，允许值为 `P/C/1B/2B/3B/SS/LF/CF/RF`
- `status`：`"available" | "rest" | "injured"`，非法值会回退为 `"available"`

### 方案字段 `scenario` / `scenarios[]`

- `id`：必填
- `name`：必填
- `note`：可选
- `assignments.defense`：9 个守位键，值为球员 `id` 或 `null`
- `assignments.lineup`：长度最多按前 9 项处理，值为球员 `id` 或 `null`
- `createdAt` / `updatedAt`：建议使用 ISO 时间字符串

## 导入时的数据清洗规则

- 无效球员会被过滤掉
  - 缺少 `id` 或 `name` 的球员会被丢弃
  - 清洗后 `name` 或 `number` 为空的球员会被丢弃
- 非法守位会被过滤
- 重复守位值会去重
- 方案里引用了不存在球员 `id` 的守位和棒次，会被自动置为 `null`
- `workspace` 如果没有任何有效方案，系统会自动补一个默认方案
- `activeScenarioId` 如果无效，会自动回退到第一套方案

## 建议

- 要做整库恢复时，用 `workspace`
- 只想把一套阵容加到现有工作区时，用 `scenario`
- 最稳妥的做法是先从系统导出一份 JSON，再基于导出的结构修改后重新导入

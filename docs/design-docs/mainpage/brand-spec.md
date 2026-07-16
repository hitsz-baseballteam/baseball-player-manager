# 哈工深小熊猫棒球队主页 · 品牌规范

> 适用范围：HITSZ Red Pandas Baseball Team 官方主页（展示型官网 A）
> 来源：mqrrmd83-哈工深小熊猫棒球队主页展示型官网设计方案_动态交互补充版.docx
> 版本：V2.1 配套 · 2026.06

## 1. 设计定位

校园球队的「白色运动档案馆」——干净、明亮、热血、有纪念感。照片负责情绪，卡片负责信息，土地红与草地绿负责识别度。不做商业体育过度包装，也不做社团公告栏。

## 2. 颜色 Token（OKLch，6 个核心 + 2 个主题色）

```css
:root {
  /* 核心 6 变量 —— 与 seed 一致 */
  --bg:      oklch(98% 0.005 95);     /* 象牙白页面底 */
  --surface: oklch(100% 0 0);         /* 卡片纯白 */
  --fg:      oklch(22% 0.02 50);      /* 深棕黑文字 */
  --muted:   oklch(50% 0.015 60);     /* 次级灰 */
  --border:  oklch(91% 0.008 95);     /* 1px 浅绿灰描边 */
  --accent:  oklch(54% 0.14 28);      /* 土地红 · 主主题 */

  /* 主题色扩展 —— 来自方案 */
  --green:   oklch(52% 0.13 145);     /* 草地绿 · 次主题 */
  --gold:    oklch(70% 0.13 80);      /* 队服金 · 数字/背号 */

  /* 派生 */
  --accent-soft: color-mix(in oklch, var(--accent) 12%, transparent);
  --green-soft:  color-mix(in oklch, var(--green)  12%, transparent);
  --gold-soft:   color-mix(in oklch, var(--gold)   18%, transparent);
  --fg-soft:     color-mix(in oklch, var(--fg) 6%, transparent);
  --glass:       color-mix(in oklch, var(--surface) 78%, transparent);
}
```

## 3. 字体栈

```css
--font-display: 'Source Han Sans SC', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
--font-serif:   'Iowan Old Style', 'Charter', 'Source Han Serif SC', Georgia, serif;
--font-body:    'Source Han Sans SC', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'PingFang SC', system-ui, sans-serif;
--font-mono:    'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace;
--font-number:  'Oswald', 'Bebas Neue', var(--font-mono);  /* 队服号码、比分牌 */
```

注：方案建议「中文黑体/思源黑体 + Inter/Oswald 数字」，故 display 与 body 同一中文黑体家族（校园感更稳），仅在数字场景切换 Oswald。

## 4. 排版尺度

```css
--fs-h1:     clamp(48px, 7vw, 96px);   /* 队名 hero */
--fs-h2:     clamp(32px, 4.2vw, 56px); /* 模块大标 */
--fs-h3:     clamp(20px, 2.2vw, 24px);
--fs-lead:   19px;
--fs-body:   16px;
--fs-meta:   13px;
--fs-number: clamp(64px, 9vw, 120px);  /* 核心数字 */
```

## 5. 布局姿态（来自方案 §6.2）

| 元素 | 姿态 |
|---|---|
| 背景 | 象牙白底，轻微纸张感；可叠极淡球场菱形线/棒球缝线纹理 |
| 导航 | 半透明 → 滚动后白色毛玻璃；当前栏目土地红短下划线 |
| 按钮 | 主按钮土地红 + 白字 + 14-18px 圆角；次按钮白底草地绿描边 |
| 卡片 | 白色 80-90% 透明度 + 1px 浅绿灰描边 + 柔和阴影；毛玻璃 hero 卡 |
| 标签 | 浅红底深红字 / 浅绿底深绿字，圆角 chip |
| 标题 | 中文黑体（Source Han Sans SC）；队名/标语可叠加英文 Oswald |
| 图形 | 棒球缝线 / 内场菱形 / 跑垒线 / 比分牌数字 · 少量点缀 |
| 阴影 | 柔和 0 8 24 0 rgba(0,0,0,.06)；毛玻璃区域允许 backdrop-filter |

## 6. 动效参数（统一节奏）

```css
--ease:        cubic-bezier(0.22, 0.61, 0.36, 1);
--dur-fast:    240ms;
--dur-base:    480ms;
--dur-slow:    800ms;
--dur-hero:    12s;     /* Ken Burns 慢循环 */
--stagger:     100ms;
```

规则：
- 首屏入场 ≤ 1s
- 滚动触发仅一次（IntersectionObserver, threshold 0.2）
- 移动端降低 blur / 阴影 / 视差
- `prefers-reduced-motion: reduce` 时关闭 Ken Burns / scroll-reveal / 呼吸

## 7. 网格与容器

```css
--container: 1200px;   /* 略宽于 seed 默认 1120，匹配方案 §9 桌面端建议 */
--gutter:    clamp(20px, 4vw, 40px);
--radius:    14px;     /* 比 seed 默认 10 略大，匹配卡片圆角建议 */
--radius-lg: 18px;
```

## 8. 照片与图像策略

- 占位图全部使用 `.ph-img` + 真实场景标签（"背影看球场"、"赛前围圈"、"全队合影"），避免空泛占位
- 颜色标签使用色卡而非真实照片（图片资产由用户提供，此处不臆造）
- Hero 大图 16:9 横图，移动端单独 4:5 焦点裁切
- 相册 6-8 张精选，移动端单列

## 9. 验收要点（来自方案 §11.3）

- 首屏一眼识别为「官方主页」而非招新海报
- 三项核心事实清晰：2026.04 成立 / 20+ 成员 / 2026.05.30 首战
- 招新入口存在但不喧宾夺主
- 视觉符合：白色高级 + 青春运动 + 毛玻璃 + 土地红/草地绿
- 移动端照片不裁关键人物
- 时间线 / 训练流程 / 照片墙各有一种可感知交互
- `prefers-reduced-motion` 下页面仍完整可读

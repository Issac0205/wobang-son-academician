# 素材清单与授权登记（docs/ASSETS.md）

> **两条不可退让的约束**（决定了本文件的存在意义）：
> 1. 交付物是**双击即玩、离线可用**的单文件 `dist/wobang-son-academician.html` —— 运行时**零网络请求**、零外链 CDN；
> 2. 本项目将以 **MIT** 公开开源 —— 仓库里不得混入来源不明或授权不相容的素材。
>
> 因此所有素材**必须在构建时内联**（内联 SVG、或 `data:` URI），并且**逐条登记来源与许可证**（本文件即登记簿）。
> 审计命令（可复跑，退出码 0 = 合规）：`node 评院士/scripts/asset-audit.mjs`

## 0. 本轮（t27）实测审计数字

| 指标 | 数值 |
|---|---|
| 单文件体积 | **359 KB**（367,620 字节）；本轮相对上一版 351 KB **+8 KB**，预算上限 +1.5 MB 的 0.5% |
| 外部网络引用 | **0** |
| 外链 `<link>` / `<script>` | **0** |
| CSS `url()` 非 `data:` URI | **0** |
| 内联 `data:` URI | 1（favicon） |
| 内联图标（`ICON_SHAPES` 条目） | 14 |

## 1. 第三方素材（逐条登记）

来源包：**`lucide-static@1.57.0`**（`registry.npmjs.org`；本机可达。github.com / raw.githubusercontent.com / jsdelivr.net 在本机不可达，故不用其 CDN 路径）。
取用方式：只从 tarball 里取 `package/icons/<name>.svg` 的**几何路径数据**，转写成 `src/ui/icons.js` 的纯数据表（`ICON_SHAPES`），统一 `viewBox="0 0 24 24"` / `stroke="currentColor"` / `stroke-width="2"`，由 `uiIcon()` 在运行时用 `createElementNS` 画出来 —— **不复制其文件、类名或任何样式**。

| 图标 | 来源 URL | 许可证 | 作者 | 用途 | 是否内联 |
|---|---|---|---|---|---|
| `coins` | https://lucide.dev/icons/coins | ISC | Lucide Icons and Contributors | HUD「经费」 | ✅ 内联（构建时转写成 path 数据） |
| `flask-conical` | https://lucide.dev/icons/flask-conical | ISC | Lucide Icons and Contributors | HUD「耗材资金」+ 标签页「课题组」 | ✅ 内联（构建时打�form成 path 数据） |
| `zap` | https://lucide.dev/icons/zap | ISC | Lucide Icons and Contributors | HUD「精力」 | ✅ 内联（构建时打�form成 path 数据） |
| `heart-pulse` | https://lucide.dev/icons/heart-pulse | ISC | Lucide Icons and Contributors | HUD「健康」 | ✅ 内联（构建时打�form成 path 数据） |
| `shield-check` | https://lucide.dev/icons/shield-check | ISC | Lucide Icons and Contributors | HUD「诚信」 | ✅ 内联（构建时打�form成 path 数据） |
| `trending-up` | https://lucide.dev/icons/trending-up | ISC | Lucide Icons and Contributors | HUD「总 IF」 | ✅ 内联（构建时打�form成 path 数据） |
| `ticket` | https://lucide.dev/icons/ticket | ISC | Lucide Icons and Contributors | HUD「推荐票」 | ✅ 内联（构建时打�form成 path 数据） |
| `graduation-cap` | https://lucide.dev/icons/graduation-cap | ISC | Lucide Icons and Contributors | HUD「名额」 | ✅ 内联（构建时打�form成 path 数据） |
| `calendar-days` | https://lucide.dev/icons/calendar-days | ISC | Lucide Icons and Contributors | 顶栏「年月」 | ✅ 内联（构建时打�form成 path 数据） |
| `badge-check` | https://lucide.dev/icons/badge-check | ISC | Lucide Icons and Contributors | 顶栏「头衔」 | ✅ 内联（构建时打�form成 path 数据） |
| `folder-open` | https://lucide.dev/icons/folder-open | ISC | Lucide Icons and Contributors | 标签页「项目」 | ✅ 内联（构建时打�form成 path 数据） |
| `users-round` | https://lucide.dev/icons/users-round | ISC | Lucide Icons and Contributors | 标签页「市场」 | ✅ 内联（构建时打�form成 path 数据） |
| `activity` | https://lucide.dev/icons/activity | ISC | Lucide Icons and Contributors | 标签页「行动」 | ✅ 内联（构建时打�form成 path 数据） |
| `scroll-text` | https://lucide.dev/icons/scroll-text | ISC | Lucide Icons and Contributors | 标签页「纪事」 | ✅ 内联（构建时打�form成 path 数据） |

## 2. 本项目自绘素材（零授权风险）

| 素材 | 形式 | 作者 | 许可证 | 用途 | 是否内联 |
|---|---|---|---|---|---|
| 站点图标 favicon | `index.html` 内联 `data:image/svg+xml`（印章红圆角方块 + 宋体「评」字） | 本项目 | 随项目 MIT | 浏览器标签页 / 书签 | ✅ 内联 |
| 品牌印章、细线分隔、纸张质感 | 纯 CSS（`src/styles/main.css` 的 CSS 变量与伪元素），无图片 | 本项目 | 随项目 MIT | 顶栏品牌与台账观感 | ✅ 内联 |
| 图标排版规则 `.ico`（1em 见方、跟随 `currentColor`/字号/色调） | CSS | 本项目 | 随项目 MIT | HUD 与标签页图标对齐 | ✅ 内联 |

## 3. 明确「没有使用」的素材类型与理由

| 类型 | 结论 | 理由 |
|---|---|---|
| 网络图片 / 照片 / 纹理位图（含 CC0 图库） | **不用** | 与既有方向「体制内台账 / 牛皮纸档案」冲突；且位图会明显撑大单文件。台账质感继续用 CSS 渐变与细线实现 |
| 中文字体（含 OFL 的思源黑体/宋体等） | **不用** | 完整 CJK 字重包 5–20 MB，远超本轮 1.5 MB 预算，也会破坏「离线单文件、双击即玩」；继续用系统字体栈（PingFang SC / 微软雅黑 / 宋体 / 等宽） |
| 图标字体（`@font-face` 的 icon font） | **不用** | 需要 `url()` 或 base64 字体包，收益不如内联 SVG 路径数据，且无法跟随 CSS 变量着色 |
| CSS 框架 / JS 依赖 / 构建工具 | **不用** | 本项目是零构建纯 ES Module；引入即违背约束（`build-single` 也不需要任何依赖） |
| 来源不明、未标注授权、搜索引擎直抓、网盘/商业素材站 | **一律不用** | 与 MIT 发布不相容；本轮没有任何此类素材进入仓库 |

## 4. 许可证一致性与声明保留

- **Lucide Icons —— ISC License**：宽松许可，允许使用、复制、修改、分发（含商用），只需保留版权与许可声明。ISC 与 MIT 兼容，可随 MIT 项目一同发布。
  - 版权声明保留位置：`src/ui/icons.js` 文件头 + 本文件第 1 节。
  - 许可全文（原样摘自 `lucide-static@1.57.0` 的 `package/LICENSE`）：

```text
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

## 5. 维护约定（给后续改动的人）

1. 新增任何素材（图标/字体/图片）前，先确认许可证与 MIT 相容，并**在本文件补齐一行登记**；无法确认来源的，一律不加。
2. 新增图标请走 `src/ui/icons.js` 的数据表（内联），**不要**新增外链或 `@import`。
3. 每次改完跑一遍：`node 评院士/scripts/asset-audit.mjs`（必须 0 外部引用）与 `node 评院士/scripts/build-single.mjs`。
4. 仓库根 `LICENSE`（MIT 全文）由主理人在发布前确认落盘；本文件只登记**素材级**授权。

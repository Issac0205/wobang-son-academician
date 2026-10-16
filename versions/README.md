# 版本存档（`versions/`）

> 本目录是《我帮儿子评院士》的**发布快照库**，对应 SPEC §1.3『每个发布版本在 `评院士/versions/vX.Y.Z/` 留档』。

## 归档约定

1. **每个发布版本建一个 `vX.Y.Z/` 子目录**；目录名必须与 `package.json` 的 `version` 完全一致（不得目录名与包版本对不上）。
2. 每个版本目录里固定放三样东西：

| 文件 | 内容 | 谁写 |
|---|---|---|
| `wobang-son-academician.html` | 该版本的**自包含单文件**（内联 CSS/JS、零外部引用），**双击即玩**，不依赖 `server.mjs`、不依赖任何构建链 | 归档器从 `dist/` 复制 |
| `README.md` | 该版本的**一页说明**：关键数值、玩法变化、本版本修了什么、怎么验证 | 人写（归档器绝不覆盖） |
| `PROVENANCE.json` | **机器生成的溯源**：版本号、归档时间、`src/` 哈希、单文件 SHA-256 与字节数、`check.mjs` / `simulate.mjs` 的退出码、`docs/VERIFICATION.md` 的 verdict 摘录 | 归档器 |

3. **不要手工把 `dist/` 拷进版本目录**：归档器会在同一次操作里记录哈希与退出码，手工拷贝会让 `PROVENANCE.json` 与产物对不上（溯源链就断了）。

## 怎么做归档 / 怎么校验

```bash
cd D:/harness
node 评院士/scripts/version.mjs                    # 只读一览：目录规模 + 已归档版本
node 评院士/scripts/version.mjs --archive          # 归档当前版本（会跑 check.mjs 与 simulate.mjs 记录退出码）
node 评院士/scripts/version.mjs --archive --force  # 目标目录已存在时强制重建（谨慎：会覆盖该目录的单文件与 PROVENANCE）
node 评院士/scripts/version.mjs --verify           # 重算已归档单文件 SHA-256，与 PROVENANCE 对账
```

归档前置条件：`dist/wobang-son-academician.html` 必须是**当前冻结 revision 重新 `build-single` 生成**的产物（禁止拷用历史构建），且 `package.json` 的版本号已改成本次要归档的版本。

## 为什么把可双击的单文件放进版本目录

单文件是**可回退的游玩快照**：玩家/评审想对比旧版本的行为，直接双击 `versions/vX.Y.Z/wobang-son-academician.html` 即可，不需要切源码、不需要装环境。`dist/` 里的那份是『当前构建产物』，会被下一次 `build-single` 覆盖；版本目录里的这份**不随源码变动而失效**。

## 归档 ≠ 验证通过

`PROVENANCE.json` 只是**原样记录**当时的验证结论。若其中的 verdict 是 `needs_revision`，说明该版本**已知存在未闭合项**，不代表它被判定为可发布；未闭合项清单见 `docs/VERIFICATION.md` 对应章节。

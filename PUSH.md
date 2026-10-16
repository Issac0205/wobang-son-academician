# 推送到 GitHub（PUSH.md）

仓库：`wobang-son-academician`　远端：`https://github.com/Issac0205/wobang-son-academician.git`
站点：`https://issac0205.github.io/wobang-son-academician/`

> ⚠ **本机推不上去**：开发机的 hosts 把 `github.com` / `api.github.com` / `github.io` / `pages.github.com` 指向 `127.0.0.1`，`git push` 必然失败（`git ls-remote` 实测退出码 128）。**请换到能访问 GitHub 的网络（或开代理）后再执行下面的命令**。仓库本体已在本地备好：已 `git init`、已提交、已打 `v1.0.0` 标签，你只需要推。

## 一、直接复制这段（在仓库根目录 `评院士/` 下执行）

```bash
cd 评院士
git remote add origin https://github.com/Issac0205/wobang-son-academician.git
git branch -M main
git push -u origin main
git push --tags
```

如果远端已经有内容（例如你先在网页上建了带 README 的仓库），再用：

```bash
git push -u origin main --force-with-lease   # 确认远端没有你要保留的东西再用
```

## 二、推送后要做的两件事

1. **开 Pages**（二选一）：
   - **A（推荐，免构建）**：Settings → Pages → Source 选 `Deploy from a branch` → 分支 `main`、目录 **`/docs`** → Save。仓库里已经有 `docs/index.html`（就是那个自包含单文件），直接就能出站。
   - **B（走 Actions）**：Settings → Pages → Source 选 `GitHub Actions`。推送 `main` 后 `.github/workflows/pages.yml` 会把 `dist/wobang-son-academician.html` 拷成 `_site/index.html` 再发布。
   > 两条路径**本机都无法验证**（跑不了 Actions、连不上 github.io）。选 A 最稳，因为不涉及构建。
2. **到 Actions 页看一眼**：若走了 B，确认 `Deploy to GitHub Pages` 这个 workflow 真的跑过一遍（本机只写了工作流、没跑过）。

## 三、其它提醒

- 仓库里 `dist/` 与 `versions/` 是**发布物与版本存档**，`.gitignore` 明确没有排除它们；别顺手删。
- 本地已打 `v1.0.0` 标签；`git push --tags` 会把标签一起推上去。
- 全程在本地跑 git 命令即可；即使推送失败也不会改坏仓库内容。

# 推送到 GitHub（PUSH.md）

仓库：`wobang-son-academician`　远端：`https://github.com/Issac0205/wobang-son-academician.git`
站点：`https://issac0205.github.io/wobang-son-academician/`

> ⚠ **本机能不能推，取决于 TLS 配置，而不是「能不能上网」。** 开发机的 hosts 把 `github.com` / `api.github.com` / `github.io` / `pages.github.com` 等约 26 个域名指向 `127.0.0.1`（实测 `Resolve-DnsName github.com` → `127.0.0.1`）。但本机 443 端口跑着 **Watt Toolkit（Steam++）** 的本地反代（实测 `https://github.com` 返回真首页，响应头 `Server: github.com,WattToolkit`），**所以 HTTP 流量其实是通的**。
> 卡点在证书：浏览器信任 Watt Toolkit 装进系统证书库的 CA，**git 默认用自己的 CA bundle，于是报 `SSL peer certificate or SSH remote key was not OK`（`git ls-remote` 退出码 128）**。解法是让 git 改用 Windows 系统证书库：`git config http.sslBackend schannel`。**实测有效**：加上后 `git ls-remote https://github.com/octocat/Hello-World.git` 成功返回 refs。
> 另需注意两点：① 目标仓库必须**先在 GitHub 上建好**，否则报 `remote: Repository not found.`；② 若 Windows 凭据管理器里已有 `git:https://github.com` 条目但 git 没有助手，需配 `git config credential.helper manager`（本机 `cmdkey /list` 实测存在该条目）。

## 一、直接复制这段（在仓库根目录 `评院士/` 下执行）

```bash
cd 评院士
git remote add origin https://github.com/Issac0205/wobang-son-academician.git
# 本机必需的 TLS / 凭据配置（仓库本地，不动全局）
git config --local http.sslBackend schannel
git config --local credential.helper manager
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

---
status: active
owner: helm-core
created: 2026-05-29
review_after: 2026-08-29
---
# Helm Core 同步与回流 Runbook（helm-public ↔ helm2026）

## 1. 适用范围

本 runbook 用于：

1. `helm-public -> helm2026` 上游同步
2. `helm2026 -> helm-public` 通用改动回流

默认工具：`git subtree`。若团队后续换成 cherry-pick 流程，本文件应同步更新。

## 2. 预置条件

1. 两个仓库都已配置远端：
   - `helm-public`（公开上游）
   - `helm2026`（私有下游）
2. `helm2026` 内已经有 `core` 对应子树目录（建议仓库根，即 `--prefix=.`）。
3. 两边仓库都启用基本 guard（`check:boundaries`、`check:public-release`）。

## 3. 上游同步流程（public -> private）

在 `helm2026` 仓库执行：

```bash
git fetch helm-public
git subtree pull --prefix=. helm-public main --squash
```

同步后最小验证（在 `helm2026`）：

```bash
npm run typecheck
npm run check:boundaries
npm run check:public-release
```

若失败：

1. 先修 private overlay 与 core 的接口漂移
2. 不回滚上游同步记录
3. 以补丁 PR 解决，不做隐式热修

## 4. 回流流程（private -> public）

原则：回流是“挑选”，不是“镜像反推”。

步骤：

1. 在 `helm2026` 建 `codex/backflow-*` 分支，整理候选提交。
2. 剔除 private 路径改动（`extensions/private/*`、`extensions/<tenant>/*`、internal-only docs subtree、`app/api/extensions/*`）。
3. 产出回流补丁（cherry-pick 或等价 patch）。
4. 在 `helm-public` 新分支应用补丁并补测试。
5. 提 PR 到 `helm-public/main`，PR 模板必须写：
   - 来源分支/提交
   - 回流文件列表
   - 明确声明未包含 private 内容

`helm-public` 回流验证基线：

```bash
npm run typecheck
npm run check:boundaries
npm run check:public-release
npm run self-check
```

## 5. 路径过滤清单

回流前必须人工复核以下规则：

1. 不允许包含 tenant slug 或客户名的硬编码。
2. 不允许包含 private host、凭据、internal-only 链接。
3. 不允许引入 internal-only docs 子树引用到公开入口文档。
4. 不允许把 private 执行脚本挂到 `package.json` 公共脚本入口。

## 6. 失败与回滚

1. `public -> private` 同步失败：在 `helm2026` 提修复 PR，不改 `helm-public`。
2. `private -> public` 回流失败：关闭回流 PR，保留私有实现，不做强行同步。
3. 若发现 private 泄漏风险：立即暂停回流，先跑 `npm run check:public-release` 并修复。

## 7. 建议节奏

1. 固定每周一次 `public -> private` 同步窗口。
2. 回流按需触发，但每次只做一个主题（例如“纯类型修复”）。
3. 每月一次清理：把 private 扩展继续收敛到约定目录。

## 8. 关联文档

1. [HELM_CORE_UPSTREAM_DOWNSTREAM_RELATIONSHIP.md](/Users/chm/.codex/worktrees/d88c/helm-public/docs/architecture/HELM_CORE_UPSTREAM_DOWNSTREAM_RELATIONSHIP.md)
2. [docs/README.md](/Users/chm/.codex/worktrees/d88c/helm-public/docs/README.md)
3. [AGENTS.md](/Users/chm/.codex/worktrees/d88c/helm-public/AGENTS.md)

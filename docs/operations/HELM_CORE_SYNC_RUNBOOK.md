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
3. public mirror candidate 生成、验证与回流证据记录

当前默认工具链：

1. `public-mirror:build`
2. `public-mirror:verify`
3. `public-mirror:clean-receipt`
4. selective patch / cherry-pick / file-level sync
5. pull request

`git subtree` 当前不是默认工具。若后续团队决定引入 subtree，必须先更新本 runbook、CI 验证和回滚策略，不能在一次回流里临时切换。

## 2. 预置条件

1. `helm-public` 远端指向 `Helm-OpenSource/helm-public`。
2. `helm2026` 远端指向私有 source repository。
3. 两边仓库都启用基本 guard：
   - `npm run check:boundaries`
   - `npm run check:public-release`
4. `helm2026` 中需要回流的改动已整理为明确 source refs（分支、PR、commit 或 clean worktree）。
5. 回流前必须确认 source worktree 未跟踪文件不会被同步；release receipt、local artifact、private docs 和 tenant implementation 默认排除。

## 3. 上游同步流程（public -> private）

在 `helm2026` 仓库执行：

```bash
git fetch origin
git fetch <helm-public-remote> main
git switch -c codex/sync-public-core-<date>
git merge --no-ff <helm-public-remote>/main
```

如果私有仓库不配置 `helm-public` 远端，则先添加只读远端：

```bash
git remote add helm-public https://github.com/Helm-OpenSource/helm-public.git
git fetch helm-public main
```

同步后最小验证（在 `helm2026`）：

```bash
npm run typecheck
npm run check:boundaries
npm run check:public-release
```

若失败：

1. 先修 private overlay 与 core 的接口漂移。
2. 不回滚上游同步记录，除非同步本身选错 base ref。
3. 以补丁 PR 解决，不做隐式热修。
4. 如果失败暴露 public core 问题，先在 `helm-public` 提 core PR，再回到 `helm2026` 同步。

## 4. 回流流程（private -> public）

原则：回流是“挑选”，不是“镜像反推”。

步骤：

1. 在 `helm2026` 建 `codex/backflow-*` 分支或临时 clean worktree，整理候选提交。
2. 用 public mirror 工具生成 candidate，确认 private roots / private files / local artifacts 被排除：

```bash
npm run public-mirror:build -- --source-root <helm2026-clean-source> --mirror-root <candidate> --force-clean
npm run public-mirror:verify -- --mirror-root <candidate>
```

3. 剔除 private 路径改动，包括但不限于：
   - tenant-specific extensions
   - internal-only docs and evidence
   - tenant-private API adapters
   - commercial-private assets
   - source-local untracked receipts / artifacts
4. 产出回流补丁：优先从 public mirror candidate 按主题同步文件；必要时使用 cherry-pick 或等价 patch。
5. 在 `helm-public` 新建 `codex/backflow-*` 或 `codex/sync-*` 分支应用补丁并补测试 / 文档索引。
6. 提 PR 到 `helm-public/main`，PR 模板必须写：
   - 来源分支 / PR / commit / mirror source ref
   - 回流能力与文件族
   - 明确声明未包含 private 内容
   - 本地和远端验证结果
7. 远端 checks 全绿后通过 PR 合入 `main`；不得直接 push `main`。

`helm-public` 回流验证基线：

```bash
npm run check:public-release
npm run check:boundaries
npm run self-check
npm run typecheck
npm run lint
npm run test
npm run build
npm run quality:regression
npm run e2e
```

如果本地缺 MySQL / Docker 等环境，必须在 PR 描述中记录失败阶段与原因，并等待远端 CI 的 MySQL / Docker 环境给出最终结果。

## 5. 路径过滤清单

回流前必须人工复核以下规则：

1. 不允许包含 tenant slug 或客户名的硬编码。
2. 不允许包含 private host、凭据、internal-only 链接。
3. 不允许把 internal-only docs root 引用到公开入口文档。
4. 不允许把 private 执行脚本挂到 `package.json` 公共脚本入口。
5. 不允许把 source worktree 的 `.env*`、`.codex/`、`.next/`、`node_modules/`、receipt 草稿或未跟踪文件同步到 `helm-public`。
6. `scripts/public-release-guard.ts` 是 private-root / private-file denylist 的机器化真值；新增 private root 时必须同步 guard 与测试。

## 6. 失败与回滚

1. `public -> private` 同步失败：在 `helm2026` 提修复 PR，不改 `helm-public`。
2. `private -> public` 回流失败：关闭或修复回流 PR，保留私有实现，不做强行同步。
3. 若发现 private 泄漏风险：立即暂停回流，先跑 `npm run check:public-release` 并修复。
4. 若已合入后发现泄漏风险：立刻 revert 公开 PR，执行 secret / private exposure response，并重新生成 public mirror clean receipt。
5. 若只是远端 CI 环境问题：在 PR 中记录 job、错误、复现命令和 owner 决策，不用 admin merge 绕过。

## 7. 建议节奏

1. 固定每周一次 `helm-public -> helm2026` 同步窗口。
2. 回流按需触发，但每次只做一个主题（例如“纯类型修复”或“公开 UX 收敛”）。
3. 每月一次清理：把 private 扩展继续收敛到约定目录，并复核 public guard 覆盖。
4. 每次 public release 前生成并校验 public mirror clean receipt。

## 8. 关联文档

1. [HELM_CORE_UPSTREAM_DOWNSTREAM_RELATIONSHIP.md](../architecture/HELM_CORE_UPSTREAM_DOWNSTREAM_RELATIONSHIP.md)
2. [docs/README.md](../README.md)
3. [AGENTS.md](../../AGENTS.md)
4. [RELEASE_READINESS_RECEIPT_CHECKLIST.md](RELEASE_READINESS_RECEIPT_CHECKLIST.md)
5. [HELM_OPEN_CORE_ENTERPRISE_CLOUD_ARCHITECTURE.md](../product/HELM_OPEN_CORE_ENTERPRISE_CLOUD_ARCHITECTURE.md)

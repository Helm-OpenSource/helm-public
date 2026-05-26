---
status: active
owner: helm-core
created: 2026-04-16
review_after: 2026-07-15
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Remaining Dirty Worktree Triage V1

## 结论

当前原始工作区里还可见的脏内容，已经不再是上一轮 `first-loop / home`、`import-guard`、`eval` 那类可独立成 PR 的实现线。

本轮复盘后的结论是：

- 当前可见脏内容里，没有新的“应当继续并主干”的真实实现线
- 绝大多数是完全重复的副本文件
- 少量差异文件也是落后于 current-main 的旧快照，不是新的实现需求
- `Midun` 文档线已经回滚，不再构成当前脏线的一部分

因此，当前工作区的剩余脏线应按“噪音清理”处理，而不是继续当成功能线拆 PR。

## 盘点结果

### 1. 本地数据库副产物

当前共有 `27` 个本地 sqlite 副产物：

- `dev 2.db` 到 `dev 28.db`

这些文件都属于本地验证残留，不是实现需求，也不应进入任何 PR。

### 2. 完全重复的副本文件

当前共有 `64` 个 `* 2.* / * 3.*` 文件与仓库内正式文件逐字节一致。

这些文件覆盖：

- `docs/product/*`
- `docs/reviews/*`
- `features/*`
- `lib/*`
- `prisma/migrations/*`
- `report-skills/*`
- `scripts/*`
- `tsconfig 2.json`

结论：

- 它们不是独立实现线
- 也不包含尚未合并的新代码
- 应视为本地副本噪音

### 3. 有差异的副本文件

当前只剩 `4` 个有差异的代码/文档副本，以及 `2` 个与 `dev.db` 内容不同的数据库快照：

- `.github/workflows/ci 2.yml`
- `docs/product/HELM_AGENT_RUNTIME_SUBSTRATE_PLAN_V1 2.md`
- `scripts/self-check/checks 2.ts`
- `scripts/self-check/config 2.ts`
- `dev 2.db`
- `dev 3.db`

但这 4 个代码/文档副本也不是新的实现线，而是旧快照：

1. `.github/workflows/ci 2.yml`
   - 缺少 current-main 已存在的 `repo-guards / quality-regression / e2e` 等 job
   - 还保留旧的 `needs` 关系和旧测试前置步骤
   - 结论：落后于 current-main，应丢弃，不应单独成线

2. `docs/product/HELM_AGENT_RUNTIME_SUBSTRATE_PLAN_V1 2.md`
   - 停在较早版本，缺失 `Operator Debugger B3-B10`、persisted lifecycle freeze 等后续 truth
   - 结论：旧计划快照，应丢弃，不应单独成线

3. `scripts/self-check/checks 2.ts`
   - 缺少当前正式版里的 source file listing 逻辑
   - 结论：旧脚本快照，应丢弃，不应单独成线

4. `scripts/self-check/config 2.ts`
   - 缺少 runtime import/eval guard 配置和页面 freeze 报告 discoverability
   - 结论：旧脚本快照，应丢弃，不应单独成线

5. `dev 2.db / dev 3.db`
   - 只是与 `dev.db` 数据内容不同的本地数据库快照
   - 结论：环境副产物，应丢弃

## 当前没有继续成立的独立 PR 候选

以“当前工作区实际可见脏内容”为准：

- 没有新的 `first-loop / home` 实现残留
- 没有新的 `import-guard` 实现残留
- 没有新的 `eval` 实现残留
- 没有新的 `Midun` 文档线残留

这些线如果后续需要继续，应从历史 triage 或已合入主干的真实代码重新起分支，而不是依赖当前工作区里的副本文件。

历史参考：

- [`HELM_OPERATOR_DEBUGGER_ADJACENT_PR_TRIAGE_V1.md`](./HELM_OPERATOR_DEBUGGER_ADJACENT_PR_TRIAGE_V1.md)

## 建议处理方式

### A. 立即清理

直接删除，不进入任何 PR：

- `dev 2.db` 到 `dev 28.db`
- 所有逐字节一致的 `* 2.* / * 3.*` 副本
- `dev 2.db / dev 3.db`

### B. 明确丢弃

不建分支、不建 PR，直接删除：

- `.github/workflows/ci 2.yml`
- `docs/product/HELM_AGENT_RUNTIME_SUBSTRATE_PLAN_V1 2.md`
- `scripts/self-check/checks 2.ts`
- `scripts/self-check/config 2.ts`

### C. 后续真实实现线的来源

如果后续还要继续推进独立线，应从以下来源重新起：

- 最新 `main`
- 已冻结报告
- 历史 triage 报告

而不是从这些本地副本文件继续演化。

## 状态判断

### 已经完整成立

- 当前原始工作区剩余脏线的分类已经清楚
- `Midun` 文档线已回滚
- 当前没有仍应保留为独立 PR 候选的真实实现残留

### 已成形但仍需下一层

- 还没有执行真正的文件清理
- 这些副本/数据库噪音还停留在工作区里

### 刻意未做

- 本轮没有直接删除所有副本和数据库噪音
- 本轮没有顺手改历史 freeze 报告的历史引用

### 风险项

- 如果继续在当前工作区上做新开发，不先清噪音，后续 `git status` 会持续失真
- 如果误把这些副本当成真实实现线继续演化，会再次污染分支边界

---
status: active
owner: helm-core
created: 2026-04-13
review_after: 2026-07-12
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Operator Debugger Adjacent PR Triage V1

## 结论

当前原始工作区里的额外改动不能被视为一团“脏代码”。

它们里面同时存在三类东西：

- 可以独立成 PR 的真实实现线
- 与这些实现线绑定的文档和测试
- 明确应该清掉的本地垃圾文件

本轮 freeze 合主干只收 `operator debugger phase 2` 主线；其他独立线进入单独 PR 管理。

## PR 候选 1：`first-loop / home`

建议分支名：

- `codex/first-loop-home-line`

当前已识别文件面：

- tracked modifications:
  - `app/(workspace)/dashboard/page.tsx`
  - `app/(workspace)/diagnostics/page.tsx`
  - `app/(workspace)/meetings/[id]/page.tsx`
  - `app/(workspace)/memory/page.tsx`
  - `app/(workspace)/operating/page.tsx`
  - `app/(workspace)/reports/page.tsx`
  - `app/setup/page.tsx`
  - `features/dashboard/page-loader.ts`
  - `features/diagnostics/diagnostics-client.tsx`
  - `features/diagnostics/queries.ts`
  - `features/internal-operating-workspace/internal-operating-home.tsx`
  - `features/internal-operating-workspace/page-loader.ts`
  - `features/meetings/page-loader.ts`
  - `features/memory/memory-client.tsx`
  - `features/memory/page-loader.ts`
  - `features/reports/reports-client.tsx`
  - `features/settings/settings-client.tsx`
  - `features/settings/setup-wizard.tsx`
  - `lib/operating-system/index.ts`
- untracked additions:
  - `components/shared/first-loop-anchor-button.tsx`
  - `components/shared/first-loop-handoff-entry-tracker.tsx`
  - `components/shared/first-loop-surface-summary.tsx`
  - `components/shared/first-loop-tracked-action-button.tsx`
  - `features/dashboard/home-work-entry-surface.tsx`
  - `features/dashboard/home-work-entry.ts`
  - `features/dashboard/home-work-entry.test.ts`
  - `features/dashboard/setup-first-loop-handoff.ts`
  - `features/dashboard/setup-first-loop-handoff.test.ts`
  - `features/diagnostics/first-loop-adoption.ts`
  - `features/diagnostics/first-loop-adoption.test.ts`
  - `features/first-loop/actions.ts`
  - `features/first-loop/actions.test.ts`
  - `lib/operating-system/first-loop.ts`
  - `lib/operating-system/first-loop-query.ts`
  - `lib/operating-system/first-loop.test.ts`
  - `docs/product/HELM_FIRST_LOOP_PRD_V1.md`
  - `docs/product/HELM_HOME_SURFACE_RULES_V1.md`

状态判断：

- `已成形但仍需下一层`

原因：

- 这是明确的新功能线，不是垃圾文件
- 但它还没有被独立验证，也明显污染了 founder demo e2e 的假设

## PR 候选 2：`import-guard`

建议分支名：

- `codex/import-guard-line`

当前已识别文件面：

- tracked modifications:
  - `.github/workflows/ci.yml`
  - `scripts/decision-first-boundary-check.ts`
  - `scripts/helm-self-check.ts`
  - `scripts/helm-self-check-refactored.ts`
  - `scripts/self-check/checks.ts`
  - `scripts/self-check/config.ts`
- untracked additions:
  - `lib/presentation/runtime-build-import-guards.test.ts`

状态判断：

- `已成形但仍需下一层`

原因：

- 这是明确的验证/守卫线，不是垃圾文件
- 但它当前和本次 freeze 同时改动了 self-check 入口，必须拆开验证边界

## PR 候选 3：`eval`

建议分支名：

- `codex/eval-line`

当前已识别文件面：

- tracked modifications:
  - `lib/evals/memory-evals.ts`
  - `lib/evals/recommendation-evals.ts`
  - `lib/evals/shared.ts`
  - `lib/helm-v2/eval-harness.ts`
- untracked additions:
  - `lib/evals/fixture-loader.ts`

状态判断：

- `已成形但仍需下一层`

原因：

- 这是明确的 eval / harness 演进线
- 但它和本次 freeze 的 debugger 契约线不是同一层目标，必须独立验证

## 本地垃圾

以下内容应明确视为本地垃圾，而不是实现需求：

- `* 2.*` 这类重复副本文件
- `dev *.db` 这类本地数据库残留
- 临时 `.next / .tmp` 生成物

这些文件不应进入任何 PR，也不应作为功能线的一部分被带入主干。

## 建议管理方式

1. 当前先只冻结并合并 `operator debugger phase 2` 主线。
2. 之后从最新 `main` 分别拉出 `first-loop / home`、`import-guard`、`eval` 三条短分支。
3. 每条线单独补计划、单独验证、单独 freeze，再独立进入主干。

---
status: planning / implementation-in-progress
owner: helm-core
created: 2026-09-16
review_after: 2026-10-16
public_safety: Public-safe implementation plan for a default-off operational
  run ledger of signal-collection jobs (closed-set outcomes and counts only).
  No customer data, private endpoint, credential, production receipt,
  activation, or production-readiness claim.
---

# CAIO P1-1 调度作业运行账本实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 signal-collection 调度作业每次运行的结果落库，结果闭集为成功、失败、崩溃、跳过，同时记录计数和耗时，供经营复盘读取。不记录任何错误正文。

**Architecture:**
- 调度器保持不依赖数据库：`runSignalCollectionJobs` 和 `startSignalCollectionScheduler` 新增一个可选的 `recordRun` 端口；`runSingleJob` 给出闭集的 `errorCode`。
- 纯函数 `run-ledger.ts` 把运行摘要映射成账本条目。
- `run-ledger.service.ts` 负责写库、读汇总、清理过期记录，开关关闭时什么都不做。
- 注册表的两个入口把服务接到端口上。

**Tech Stack:** Prisma（MySQL）、vitest、隔离 MySQL 集成测试。

**Spec:** `docs/superpowers/plans/2026-09-16-caio-p1-master-plan.md` 的 P1-A10 和切片 P1-1。

## Global Constraints

- 开关是 `HELM_SIGNAL_COLLECTION_RUN_LEDGER_ENABLED`，只认精确的 `"true"`，默认关闭。
- 账本写入失败不能影响作业本身：由调度器捕获异常，只记一条闭集日志 `run_ledger_write_failed`。
- 不持久化 `message`、`details` 或 target 结果正文。
- 结果闭集：`succeeded / failed / crashed / skipped`。错误码闭集：`job_disabled / no_targets / start_check_failed / resolve_targets_failed / target_failed / scheduler_job_crashed`。
- 保留 30 天；每个进程每小时最多清理一次。
- 不改变现有运行摘要的已有字段，只新增可选字段 `errorCode`。
- 显式列出要提交的文件，不使用 `git add -A`。

## File Structure

| 文件 | 动作 | 职责 |
|---|---|---|
| `lib/signal-collection/types.ts` | 改 | 新增 `SignalCollectionRunErrorCode`；`SignalCollectionJobRunSummary.errorCode?` |
| `lib/signal-collection/run-ledger.ts` | 新 | 闭集常量、开关判定、条目映射（纯函数） |
| `lib/signal-collection/run-ledger.test.ts` | 新 | 映射与开关测试 |
| `lib/signal-collection/scheduler.ts` | 改 | `runSingleJob` 给出 `errorCode`；`recordRun` 端口；崩溃也记录 |
| `lib/signal-collection/scheduler.test.ts` | 改 | 端口调用、写失败隔离、错误码 |
| `lib/signal-collection/run-ledger.service.ts` | 新 | 写入、汇总、清理 |
| `lib/signal-collection/run-ledger.service.mysql.test.ts` | 新 | 隔离 MySQL：开关、写入、汇总、清理、拒收非法条目 |
| `lib/extensions/registry.tsx` | 改 | 注册入口接上 `recordSignalCollectionJobRun` |
| `prisma/schema.prisma`、`prisma/migrations/20260916150000_signal_collection_job_run/migration.sql` | 新 | `SignalCollectionJobRun` 表与 CHECK |
| `docs/STATUS.md` | 改 | 记录账本已成形但默认关闭 |

---

### Task 1: 纯映射与错误码

**Files:** Create `lib/signal-collection/run-ledger.ts`, Test `lib/signal-collection/run-ledger.test.ts`, Modify `lib/signal-collection/types.ts`

**Interfaces — Produces:**

```ts
export const SIGNAL_COLLECTION_RUN_OUTCOMES = ["succeeded", "failed", "crashed", "skipped"] as const;
export const SIGNAL_COLLECTION_RUN_ERROR_CODES = ["job_disabled", "no_targets", "start_check_failed",
  "resolve_targets_failed", "target_failed", "scheduler_job_crashed"] as const;
export type SignalCollectionJobRunEntry = { jobKey: string; tenantKey: string; extensionKey: string;
  source: SignalCollectionRunContext["source"]; outcome: SignalCollectionRunOutcome; errorCode: SignalCollectionRunErrorCode | null;
  startedAt: Date; finishedAt: Date; targetCount: number; successCount: number; failureCount: number; skippedCount: number };
export type SignalCollectionRunRecorder = (entry: SignalCollectionJobRunEntry) => Promise<void>;
export function isSignalCollectionRunLedgerEnabled(env?: Record<string, string | undefined>): boolean;
export function buildSignalCollectionJobRunEntry(input: { job: SignalCollectionJob; source; startedAt: Date; finishedAt: Date; summary: SignalCollectionJobRunSummary }): SignalCollectionJobRunEntry;
export function buildCrashedSignalCollectionJobRunEntry(input: { job: SignalCollectionJob; source; startedAt: Date; finishedAt: Date }): SignalCollectionJobRunEntry;
```

- [ ] 写失败测试，覆盖以下情况：
  - success 映射为 succeeded，errorCode 为 null；
  - failed 映射为 failed，保留摘要里的 errorCode；
  - skipped 保留 job_disabled 或 no_targets；
  - 崩溃条目为 crashed，errorCode 为 scheduler_job_crashed，计数全部为 0；
  - 开关只认 `"true"`，`"TRUE"`、`"1"`、未设置都视为关闭。
- [ ] 运行 `npx vitest run lib/signal-collection/run-ledger.test.ts --config vitest.public.config.ts`，确认失败。
- [ ] 实现，然后再跑一次确认通过，再提交。

### Task 2: 调度器端口

**Files:** Modify `lib/signal-collection/scheduler.ts`, `lib/signal-collection/scheduler.test.ts`

- [ ] 写失败测试：
  - 两个作业各调用一次 `recordRun`，条目的 jobKey、outcome、计数正确；
  - `recordRun` 抛异常时，`runSignalCollectionJobs` 仍返回原来的摘要，并且 `console.warn` 含 `run_ledger_write_failed`；
  - 下列情况的摘要 `errorCode` 分别正确：`canStart` 失败为 `start_check_failed`，`resolveTargets` 抛异常为 `resolve_targets_failed`，target 失败为 `target_failed`，作业关闭为 `job_disabled`，没有 target 为 `no_targets`；
  - 定时触发时，如果 `runSignalCollectionJobs` 抛异常（部署能力关闭），记录一条 crashed 条目。
- [ ] 实现：
  - `runSingleJob` 在每个返回分支写入 `errorCode`；
  - `runSignalCollectionJobs` 新增 `recordRun?`，每个作业单独计时，调用时经过 `safeRecordRun` 包装；
  - `startSignalCollectionScheduler` 和 `scheduleJob` 把 `recordRun` 传下去，在 catch 分支记录崩溃。
- [ ] 跑 `lib/signal-collection/scheduler.test.ts` 和 `cron-route.test.ts`，全部通过后提交。

### Task 3: 表、迁移与服务

**Files:** `prisma/schema.prisma`、迁移、`run-ledger.service.ts`、`run-ledger.service.mysql.test.ts`

**Interfaces — Produces:**

```ts
export async function recordSignalCollectionJobRun(entry: SignalCollectionJobRunEntry, options?: { env?: Record<string, string | undefined>; now?: Date }): Promise<void>;
export async function readSignalCollectionJobRunSummary(input: { tenantKey: string; since: Date }): Promise<Array<{
  jobKey: string; runs: number; succeeded: number; failed: number; crashed: number; skipped: number;
  lastOutcome: SignalCollectionRunOutcome | null; lastFinishedAt: Date | null }>>;
export async function pruneSignalCollectionJobRuns(input: { now: Date; retentionDays?: number }): Promise<number>;
export class SignalCollectionRunLedgerError extends Error { readonly code: "invalid_run_ledger_entry" }
```

- [ ] 手工把模型插入 schema，不跑 `prisma format`。SQL 用 schema 对 schema 的 `prisma migrate diff --script` 生成，再手工加上 CHECK：outcome 属于闭集、计数非负、`finishedAt >= startedAt`。
- [ ] 写失败的 MySQL 测试，数据库名前缀必须是 `helm_signal_run_ledger_`，覆盖：
  - 开关关闭时写 0 行；
  - 开关打开时写 1 行，`durationMs` 正确；
  - 非法 outcome 抛 `invalid_run_ledger_entry`；
  - 汇总按作业统计，`lastOutcome` 取最后一次；
  - 清理只删除 30 天以前的记录。
- [ ] 实现，跑测试确认通过，提交。

### Task 4: 注册表接线与文档

- [ ] `runRegisteredSignalCollectionJobs` 和 `startRegisteredSignalCollectionScheduler` 传入 `recordRun: recordSignalCollectionJobRun`。
- [ ] 在 STATUS 的调度器相关行追加说明：账本已成形，默认关闭，只记录闭集结果与计数。
- [ ] 跑门禁：`npm run typecheck`、`npm run lint:strict`、`npm run check:conditional-update-cas`、`npm run check:boundaries`、`npm run check:public-release`、`npm run check:public-docs`，以及上面三组测试。全部通过后提交，开 PR。

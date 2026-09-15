---
status: planning / implementation-in-progress
owner: helm-core
created: 2026-09-16
review_after: 2026-10-16
public_safety: Public-safe implementation plan for the default-off CAIO pull
  inference job queue (frozen aggregate input, lease-bound claim through the
  governed deferred dispatch, closed-set rejection, lease reclaim). No customer
  data, private endpoint, credential, production receipt, activation, or
  production-readiness claim.
---

# CAIO P1-3 推理任务队列实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把经营上下文快照冻结成推理任务，让现场 worker 领取、提交判断，并在租约到期后对账。判断只是建议，拒收整包。

**Architecture:** 队列只管任务状态和判断落库；出域治理全部经受治理网关的延迟派发（P1-3a 的 `claim` / `complete` / `expire`），队列不引用出域权威。领取的 CAS 放在 Serializable 事务里，符合 `check:conditional-update-cas`。

**Spec:** 总计划 `2026-09-16-caio-p1-master-plan.md` 的 A1–A6、A15；Core 规格 §4.1–§4.3。

## Global Constraints

- 队列本身不跑：没有入队作业就没有任务，入队作业在 P1-6。
- 输入只含快照引用与汇总计数，入队时冻结并算哈希；提交时哈希不符即拒收。
- 判断先过闭集校验再落库：越界证据、非法建议类型、动作文本、超长整包拒收，并记录闭集拒因。
- `JudgementPacket` 保持 P3a 公共合同：`commitmentClass=advice`、`humanReviewerRequired=true`、`forbiddenActionRefs` 为空；分层正文与它的内容哈希存在队列自己的私有列里。
- 领取即出域授权截止点；租约到期只对账，不盲目重发；同一任务的重试要新的一轮决定。
- 不改既有表；只加一张新表和一个迁移。

## File Structure

| 文件 | 动作 | 职责 |
|---|---|---|
| `lib/caio-inference/layered-judgement.ts`(+test) | 改 | `disposition` 改为闭集 token（公共合同只允许 token，不允许冒号） |
| `lib/caio-inference/judgement-packet.ts`(+test) | 新 | 由输入与分层判断构造并校验 `JudgementPacket` |
| `lib/caio-inference/job-store.service.ts` | 新 | 入队、领取、提交、回收；延迟派发端口 |
| `lib/caio-inference/job-store.service.mysql.test.ts` | 新 | 隔离 MySQL：幂等入队、并发领取只有一个赢、提交与拒收、租约回收与死信、窗口过期 |
| `prisma/schema.prisma`、`prisma/migrations/20260916180000_caio_inference_job/migration.sql` | 新 | `CaioInferenceJob` 表与 CHECK |
| `docs/STATUS.md`、`docs/public-docs-manifest.json` | 改 | 记录本切片 |

## Tasks

### Task 1: disposition 改为闭集 token

- [ ] 改测试：`toCaioLayeredJudgementDisposition()` 返回 `caio.layered-judgement.v1`，并且不含冒号后的哈希。
- [ ] 实现，跑 `lib/caio-inference`。

### Task 2: JudgementPacket 构造

**Interfaces — Produces:**

```ts
export function buildCaioInferenceJudgementPacket(input: {
  workspaceId: string; jobId: string; inferenceInput: CaioInferenceInput;
  layered: CaioLayeredJudgement; now: Date;
}): { ok: true; packet: JudgementPacket } | { ok: false; code: CaioInferenceRejectionCode };
```

- [ ] 写失败测试：证据引用取分层判断引用的并集，缺省时退回输入证据；`inputSnapshotRef` 是输入哈希；`signalEventRefs` 由快照引用生成；`commitmentClass`、`humanReviewerRequired`、`forbiddenActionRefs` 固定；校验不过时回 `malformed_output`。
- [ ] 实现后跑测试。

### Task 3: 表、迁移与队列服务

**Interfaces — Produces:**

```ts
export type CaioInferenceDispatchPort = {
  claim(request: {...}): Promise<...>;
  complete(input: {...}): Promise<...>;
  expire(input: {...}): Promise<...>;
};
export function enqueueCaioInferenceJob(...): Promise<{ status: "enqueued" | "already_enqueued"; jobId: string }>;
export function claimCaioInferenceJob(...): Promise<{ status: "claimed" | "none" | "rejected"; ... }>;
export function submitCaioInferenceJudgement(...): Promise<{ status: "completed" | "replayed" | "rejected"; ... }>;
export function reclaimCaioInferenceJobs(...): Promise<{ requeued: number; deadLettered: number; expired: number }>;
```

- [ ] 手工插入模型，schema 对 schema 生成迁移 SQL，再补 CHECK（状态闭集、attempt 非负、窗口顺序）。
- [ ] 写失败的 MySQL 测试（库名前缀 `helm_caio_inference_`）。
- [ ] 实现，跑测试，跑门禁：`typecheck`、`eslint`、`check:conditional-update-cas`、`check:boundaries`、`check:caio-terminology`、`check:public-release`、`check:public-docs`。

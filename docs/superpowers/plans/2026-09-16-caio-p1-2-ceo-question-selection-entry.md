---
status: planning / implemented-in-pr-pending-merge
owner: helm-core
created: 2026-09-16
review_after: 2026-10-16
public_safety: Public-safe implementation plan for the CEO operating-question
  selection entry on the OWNER operator page (server actions reusing the
  existing selection and decision-binding services behind an accepted-G0
  precondition). No customer data, private endpoint, credential, production
  receipt, activation, or production-readiness claim.
---

# CAIO P1-2 CEO 选题入口实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 CEO 在 `/caio/operator` 完成 0–3 题的经营问题选择，并把当前选择绑定到决策记录。硬前置条件是当前 G0 验收门已受理。

**Architecture:**
- 沿用 P0-1 的薄服务端动作模式：会话 → 访问预检（`principal_bound`）→ zod 解析 → 入口先查 `getCaioInitializationGateStatus` → 调用既有的 `selectCaioOperatingQuestions` 和 `bindCurrentCaioQuestionSelectionToDecisionRecords` → 返回闭集错误码。
- `Stage1OwnerLoopConsole` 保持只读，它的可访问性守卫不改。

**Spec:** `docs/superpowers/specs/2026-09-15-caio-live-operating-core-spec.md` §8；总计划 `2026-09-16-caio-p1-master-plan.md` 的 A11 和 A12。

## Global Constraints

- 前置：P1-0 已确认执行回执并发降级缺陷已修复（`f7c13a0c`），并在隔离 MySQL 上复证。
- 入口在调用服务前确认当前 G0 为 `accepted`，否则返回 `g0_not_accepted`，不调用服务，也不 revalidate。
- CEO 身份不从 OWNER 推导：访问类别是 `principal_bound`，由服务按已登记的 principal binding 判定。
- 选择输入的边界与受治理选择命令一致：至多 3 题，证据引用 1–100 条，原因码至多 20 条；每道题复用 `caioQuestionSelectionItemSchema`，并且是 strict。
- 错误只返回闭集码：`selection_rejected`、`selection_conflict`（组合头被并发推进或幂等冲突），不回显服务的 reasons。
- 选题和绑定都不派工、不执行、不外发；不新增表和迁移。

## File Structure

| 文件 | 动作 | 职责 |
|---|---|---|
| `features/caio-operator/schemas.ts`(+test) | 改 | `selectOperatingQuestionsSchema`、`bindQuestionSelectionSchema` |
| `features/caio-operator/actions.ts`(+test) | 改 | `selectOperatingQuestionsAction`、`bindQuestionSelectionAction`、`assertAcceptedG0` |
| `lib/caio-operator/operator-error-codes.ts`(+test) | 改 | `g0_not_accepted`、`selection_rejected`、`selection_conflict`、`CaioOperatorPreconditionError` |
| `features/caio-operator/operator-operations.ts`(+test) | 改 | `selection` 组及两个模板 |
| `features/caio-operator/operator-console.client.tsx` | 改 | 动作表加两项 |
| `app/(workspace)/caio/operator/page.tsx` | 改 | 选题门说明 |
| `docs/STATUS.md` | 改 | P1C 行记录网页入口 |

## Tasks

- [x] 写失败测试：
  - schema 的边界与 strict；
  - 操作目录覆盖全部动作，且 CEO 行为标记正确；
  - 错误码映射（含冲突原因）；
  - 动作在 G0 为 not_accepted、stale、revoked 时 fail closed，且不调用服务；
  - 注入会话身份；
  - 绑定结果只返回收据 id 和 replayed。
- [x] 实现，然后跑 `npx vitest run features/caio-operator lib/caio-operator --config vitest.public.config.ts`。
- [x] 变异反证：去掉入口的 G0 预检，或把判定放宽为只拒绝 revoked，G0 相关用例失败。
- [x] 门禁：`typecheck`、`eslint`（改动文件）、`check:caio-terminology`、`check:stage1-owner-loop`、`check:boundaries`、`check:public-release`、`check:bilingual-mixing`。

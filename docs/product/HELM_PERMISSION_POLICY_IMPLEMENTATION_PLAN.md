---
status: active
owner: helm-core
created: 2026-06-08
review_after: 2026-07-08
public_safety: Public-safe implementation plan. No customer names, tenant policy data, private domains, credentials, deployment receipts, production authorization proof, writeback, external send, approval execution, or customer commitment.
---
# Helm Permission Policy Implementation Plan / Helm 权限策略实施计划

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

## 1. 结论

权限管理需求已收敛并落地为 public-safe Phase 1：Core 权限契约、fail-closed evaluator、
synthetic Pack manifest、subject-aware extension access、只读 proof 和 review-required proof 已在本分支
形成闭环。

本计划不实现完整企业 IAM、不接真实租户策略、不做生产写回、不改变 Core / Pack / Overlay
依赖方向。

## 2. 审议状态

- Codex repo-truth review：完成，见
  [权限管理研究](../reviews/HELM_PERMISSION_MANAGEMENT_RESEARCH_2026-06-08.md)。
- Claude CLI review：已尝试，只读调用因 `UNKNOWN_CERTIFICATE_VERIFICATION_ERROR` 失败；不计为
  Claude approval。
- Codex second-reader review：完成；必须修正项已合并到本计划和
  [权限策略契约](HELM_PERMISSION_POLICY_CONTRACT.md)。

## 3. 架构决策

1. **Core contract first**：Core 定义 `PermissionSubject`、`PermissionResource`、
   `PermissionAction`、`PermissionDecision`、closed enums、fail-closed evaluator 和 audit shape。
2. **Workspace role remains base capability**：现有 `WorkspaceRole` capability matrix 保留，
   只覆盖平台级操作，不直接授权 Pack / Overlay 业务对象。
3. **Pack declares, Overlay binds**：Pack 只能声明通用行业资源 / 动作 / 数据分类 / 风险；
   Overlay 私有绑定租户组织角色、人员、scope、field masks、entitlement 和 receipts。
4. **Extension enablement is not authorization**：`WorkspaceSolutionExtension` 只能说明 workspace
   启用 extension；页面、报表、API 和 action 还必须 subject-aware permission decision。
5. **Routing is not authorization**：persona、role preset、supervisor mapping、notification target
   都不能直接当作 viewer / operator 权限。
6. **Review-required is not execution**：允许准备 side-effect draft 不等于允许执行写回、外发、
   审批或高风险状态推进。

## 4. Phase 1: Public-Safe Foundation

### Task 1: Core permission policy contract

**Description:** Add TypeScript contract and fail-closed evaluator in Core without database migration.

**Acceptance criteria:**

- Unknown subject / action / resource denies.
- Cross-workspace resource denies.
- `user` actor without `ACTIVE` membership denies.
- `service` / `system` actor without explicit scope denies.
- `PermissionFailureCode` is a closed enum and negative tests assert failure codes, not free-text reasons.
- `PermissionEffectMode` imports and reuses `runtimePermissionProfileSchema`.
- Permission data classifications map to the existing agentic redaction statuses.
- Workspace role fallback only covers existing Core platform capabilities.
- Decision includes `effect`, `reason`, `traceId`, `policyVersion`, `source`, `actor`, `resource`, `action`,
  `obligations`, `redactions`, and optional `failureCode`.
- Audit object never includes raw personal/contact/tenant-private values.

**Verification:**

- `npm run test -- lib/auth/permission-policy.test.ts`
- `npm run typecheck`

**Dependencies:** None

**Files likely touched:**

- `lib/auth/permission-policy.ts`
- `lib/auth/permission-policy.test.ts`

**Estimated scope:** Medium

**Completion note:** Implemented in this branch with no database migration. Service scope now must include the
requested action or `*`; closed failure codes, runtime permission schema reuse, and canonical redaction mapping are
covered by `lib/auth/permission-policy.test.ts`.

### Task 2: Synthetic Pack permission manifest

**Description:** Add public-safe manifest types, fixture, and validator for generic industry resources.

**Acceptance criteria:**

- Manifest uses only generic resource names.
- Every action declares effect mode, risk level, data classifications, row filter support, field redaction support.
- `execute_writeback` cannot be allowed in public Core.
- Missing policy version or unknown data classification fails validation.

**Verification:**

- `npm run test -- lib/extensions/permission-manifest.test.ts`
- `npm run check:public-release`

**Dependencies:** Task 1

**Files likely touched:**

- `lib/extensions/permission-manifest.ts`
- `lib/extensions/permission-manifest.test.ts`
- `extensions/case-management-sample/permission.manifest.json`

**Estimated scope:** Medium

**Completion note:** Implemented with `lib/extensions/permission-manifest.ts`,
`lib/extensions/permission-manifest.test.ts`, and
`extensions/case-management-sample/permission.manifest.json`. The validator rejects missing policy versions,
unknown data classifications, missing row/redaction support, and unblocked `execute_writeback`.

### Task 3: Subject-aware extension access

**Description:** Upgrade extension access contracts so nav/report/API contributors can receive subject context.

**Acceptance criteria:**

- Existing workspace-only extension access remains compatible through a shim.
- New `getAccess` path receives subject and can return deny reason.
- Extension enablement alone does not grant action authorization.
- Registered extension API routes have an evaluator wrapper or explicit route metadata gate.

**Verification:**

- `npm run test -- lib/extensions/permission-access.test.ts`
- `npm run test -- lib/extensions/api-route-registry.test.ts`
- `npm run typecheck`

**Dependencies:** Task 1

**Files likely touched:**

- `lib/extensions/registry-contract.ts`
- `lib/extensions/registry.tsx`
- `lib/extensions/registry.test.ts`

**Estimated scope:** Medium

**Completion note:** Implemented by adding `ExtensionAccessContext` / `ExtensionAccessResult` to
`lib/extensions/registry-types.ts`, passing optional `accessContext` through registry resolvers, adding
`buildPermissionedExtensionAccess()`, and requiring registered extension API routes to declare either a Core
permission evaluator wrapper or explicit handler-owned authorization metadata.

### Task 4: Read-only permission proof

**Description:** Add one synthetic sample extension API read path that proves session -> workspace ownership ->
permission -> row filter -> field redaction -> deny audit.

**Acceptance criteria:**

- Unauthorized actor receives deny.
- Authorized actor receives only allowed rows.
- Sensitive fields redact unless explicitly allowed by synthetic policy.
- Response never depends only on UI hiding.
- The API / serialization layer performs redaction, not only the UI.

**Verification:**

- Targeted unit / route tests for the selected proof path.
- `npm run test`

**Dependencies:** Tasks 1-3

**Files likely touched:**

- `lib/extensions/permission-api-proof.ts`
- `lib/extensions/permission-api-proof.test.ts`

**Estimated scope:** Medium

**Completion note:** Implemented as a synthetic registered extension API route proof. It filters rows by explicit
queue scope and redacts contact / financial / legal-sensitive fields in API serialization before returning rows.
Deny responses return typed failure codes and never include rows.

### Task 5: Review-required side-effect proof

**Description:** Add one synthetic sample extension `prepare_writeback` path that returns review obligation and blocks
execution.

**Acceptance criteria:**

- Prepare action can return draft / review packet only.
- Execution action denies in public Core.
- Decision records `review_required` obligation and no writeback / no external send.
- High-risk action cannot self-approve.

**Verification:**

- Targeted unit tests.
- `npm run check:boundaries`

**Dependencies:** Tasks 1-3

**Files likely touched:**

- `lib/extensions/permission-api-proof.ts`
- `lib/extensions/permission-api-proof.test.ts`

**Estimated scope:** Medium

**Completion note:** Implemented with `case.prepare_writeback` returning a review packet and
`case.execute_writeback` denied by the Core permission evaluator before any handler-side execution callback can run.

### Task 6: Service and background actor proof

**Description:** Prove service / system actors cannot inherit human authority and missing service scope denies.

**Acceptance criteria:**

- Service actor without explicit `serviceKey`, scope, policy version, or audit source denies.
- System actor is limited to deterministic guards, validators, and synthetic fixtures.
- Background effects such as notification send, tenant write, financial action, and customer contact default deny.
- Any future background effect must carry service scope and audit source before execution.

**Verification:**

- Targeted unit tests for service / system actor decisions.
- `npm run test -- lib/auth/permission-policy.test.ts`

**Dependencies:** Task 1

**Files likely touched:**

- `lib/auth/permission-policy.ts`
- `lib/auth/permission-policy.test.ts`

**Estimated scope:** Small

**Completion note:** Implemented in `lib/auth/permission-policy.ts` and
`lib/auth/permission-policy.test.ts`. Service actors require `serviceKey`, explicit action scope, policy version,
and delegated audit source; system actor proof is limited to synthetic fixture access.

## 5. Checkpoint: After Phase 1

- `npm run check:public-docs`
- `npm run check:public-release`
- `npm run check:boundaries`
- `npm run self-check`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

If schema or database behavior changes, add:

- `npm run db:reset`

## 6. Risks And Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Workspace role is mistaken for business authorization | Over-broad same-workspace access | Keep Pack / Overlay permissions separate and fail closed when missing |
| Extension enablement is treated as access | Users see pages/actions they should not | Make `getAccess` subject-aware and include deny reasons |
| Routing mappings become authorization | Notification recipients can over-read | Document and test routing != authorization |
| Field masking only happens in UI | API/export leakage | Put redaction in response serialization / read path tests |
| Service actors inherit human authority | Background jobs overreach | Require explicit service scope and audit source |
| Failure reasons stay free-form | Negative tests and audit aggregation weaken | Use closed `PermissionFailureCode`; keep `reason` human-readable only |
| Effect mode drifts from LLM runtime permission fencing | Two permission vocabularies diverge | Import `runtimePermissionProfileSchema` directly |
| Data classification drifts from redaction posture | Permission and redaction layers disagree | Map data classifications to existing agentic redaction statuses |
| Public Core leaks tenant policy | Public-safety failure | Keep Overlay binding private and run `check:public-release` |

## 7. Final Decisions

1. Phase 1 不新增 Prisma audit table；先实现 typed decision / audit object 和测试，Phase 2 再评估落库。
2. 第一条 read-only proof 选 synthetic sample extension API，因为它同时覆盖 extension route 分散授权风险。
3. 第一条 review-required side-effect proof 选 synthetic sample extension `prepare_writeback` fixture，因为它最接近
   Pack / Overlay 写回边界且不会触达真实客户系统。
4. 权威实施依据顺序：本文件 + `HELM_PERMISSION_POLICY_CONTRACT.md` 优先；研究报告只作为背景证据，
   不再作为任务清单来源。
5. Task 1 的闭集 failure code、effect-mode schema reuse、dataClass -> redaction 映射为硬门，后续切片不得
   放宽或重建并行词表。

## 8. 不进入 Phase 1

- 真实租户权限绑定。
- 真实催收队列 / 人员 / 区域 / 系统账户映射。
- 生产写回执行。
- 外部发送。
- 自动审批。
- 高风险状态自动推进。
- 完整 enterprise IAM。

## English Reference

Phase 1 implements only the public-safe foundation: Core permission contract,
fail-closed evaluator, synthetic Pack manifest, subject-aware extension access,
a read-only proof, and a review-required side-effect proof. It does not implement
enterprise IAM, real tenant policies, production writeback, external send,
automatic approval, high-risk status advancement, or any dependency from Core
back to Pack or Overlay.

## 变更记录

| 日期 | 变化 |
| --- | --- |
| 2026-06-08 | 建立权限策略 Phase 1 实施计划，覆盖任务切片、验收标准、验证链、风险和不进入范围。 |

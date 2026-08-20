---
status: planning / ready-to-execute
owner: helm-core
created: 2026-08-20
review_after: 2026-09-20
public_safety: Implementation plan for the member prompt-queue persistence
  slice. No customer data, credential, private endpoint, or
  production-readiness claim.
---

# Member Gateway M3b (prompt 队列持久化) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development 或 executing-plans。

**Goal:** 为 M3a prompt 契约落地队列持久层:prompt 行(带乐观版本)、append-only 转移回执(内嵌投递判定、携带非绩效化冻结字面量)、CAS 状态机 store、隔离 MySQL 测试,并承接 M3a as-built 第 5-9 条组合义务。

**Architecture:** 严格复制 M2b 模式:hand-authored 迁移(CHECK + 触发器)、store 内联 serializable 事务 + workspace 行锁 + CAS `updateMany`(零 CAS 门禁新 finding)、判定全部复用 M3a 契约(`validateMemberPrompt`、`decideMemberPromptDelivery`、`judgeMemberPromptTransition`),store 只做"加载真值 → 契约判定 → 原子落库"。**响应内容的持久化(四类写入落库、challenge 流、治理桥接落库)是 M3c**,本切片 respond 转移只记录 opaque `responseRef`。

**设计真值:** spec §6.3/§12;M3a plan as-built 第 5-9 条(投递回执必须内嵌 `deliver: true` 判定、respond 前过期清扫、非绩效化冻结字面量上回执形状)。

**分支:** `feat/member-gateway-m3b`。

---

### Task 1: schema + 迁移

**Files:** Modify `prisma/schema.prisma`(两 model + Workspace 反向关系);Create `prisma/migrations/20260820120000_member_prompt_store/migration.sql`

```prisma
/// Member Gateway M3b: member prompt queue row (spec §6.3). State moves
/// only through CAS transitions that append a receipt; `version` is the
/// optimistic-concurrency counter (expectedVersion seam).
model MemberPrompt {
  id              String   @id
  workspaceId     String
  memberRef       String
  severity        String
  severityRuleRef String?
  subjectObjectRef String
  projectedSummary String  @db.LongText
  evidenceRefsJson String  @db.LongText
  state           String
  version         Int
  snoozeUntil     DateTime?
  responseRef     String?
  issuedAt        DateTime
  expiresAt       DateTime
  createdAt       DateTime @default(now())
  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Restrict, map: "MWPrompt_workspace_fkey")

  @@unique([id, workspaceId], map: "MWPrompt_id_workspace_key")
  @@index([workspaceId, memberRef, state], map: "MWPrompt_workspace_member_state_idx")
}

/// Member Gateway M3b: append-only prompt transition receipt. Delivery
/// receipts embed the delivery decision; `evaluationUseProhibited` is the
/// frozen non-performance literal (spec §12): transition timing/content
/// must never feed member evaluation.
model MemberPromptTransitionReceipt {
  id            String   @id
  workspaceId   String
  promptRef     String
  fromState     String
  toState       String
  cause         String
  version       Int
  deliverDecision String?
  heldReason    String?
  responseRef   String?
  occurredAt    DateTime
  evaluationUseProhibited Boolean
  createdAt     DateTime @default(now())
  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Restrict, map: "MWPromptReceipt_workspace_fkey")

  @@unique([id, workspaceId], map: "MWPromptReceipt_id_workspace_key")
  @@unique([workspaceId, promptRef, version], map: "MWPromptReceipt_prompt_version_key")
  @@index([workspaceId, promptRef], map: "MWPromptReceipt_workspace_prompt_idx")
}
```

Workspace 反向关系:`memberPrompts MemberPrompt[]`、`memberPromptTransitionReceipts MemberPromptTransitionReceipt[]`。

迁移 hand-authored(照 M2b 头部风格,含本地 1419 说明引用):CREATE TABLE 严格 Prisma 等价;CHECK:

```sql
ALTER TABLE `MemberPrompt`
  ADD CONSTRAINT `MWPrompt_severity_check` CHECK (`severity` IN ('critical', 'normal')),
  ADD CONSTRAINT `MWPrompt_state_check`
    CHECK (`state` IN ('pending', 'delivered', 'snoozed', 'responded', 'withdrawn', 'expired', 'suppressed')),
  ADD CONSTRAINT `MWPrompt_version_check` CHECK (`version` >= 1),
  ADD CONSTRAINT `MWPrompt_window_check` CHECK (`expiresAt` > `issuedAt`);

ALTER TABLE `MemberPromptTransitionReceipt`
  ADD CONSTRAINT `MWPromptReceipt_cause_check`
    CHECK (`cause` IN ('deliver', 'snooze', 'unsnooze', 'respond', 'withdraw', 'expire', 'suppress')),
  ADD CONSTRAINT `MWPromptReceipt_states_check`
    CHECK (`fromState` IN ('pending', 'delivered', 'snoozed', 'responded', 'withdrawn', 'expired', 'suppressed')
      AND `toState` IN ('pending', 'delivered', 'snoozed', 'responded', 'withdrawn', 'expired', 'suppressed')),
  ADD CONSTRAINT `MWPromptReceipt_evaluation_check` CHECK (`evaluationUseProhibited` = TRUE),
  ADD CONSTRAINT `MWPromptReceipt_deliver_decision_check`
    CHECK (`deliverDecision` IS NULL OR `deliverDecision` IN ('deliver', 'held'));
```

append-only 触发器 ×2(`MemberPromptTransitionReceipt_append_only_update/delete`,同既有模式)。

- [ ] schema + 迁移;`npm run db:generate`;`npm run db:migrate`(flag 已开,本地应可直接应用);typecheck;commit `feat(member-gateway): add member prompt queue persistence schema`

### Task 2: store service `lib/member-gateway/prompt-store.service.ts`

模式与 M2b store 完全一致(`server-only`、TRANSACTION_OPTIONS Serializable、内联 `$transaction`、`lockWorkspace` 先行、`MemberPromptStoreError extends Error { readonly reasons }`)。API:

```ts
createMemberPrompt(input: {
  prompt: MemberPrompt;             // M3a 契约类型;先 validateMemberPrompt,invalid 即抛
}): Promise<void>
// 落库 state='pending', version=1;不产生转移回执(创建不是转移)

transitionMemberPrompt(input: {
  workspaceRef: string;
  promptRef: string;
  cause: MemberPromptTransitionCause;
  expectedVersion: number;
  receiptId: string;
  now: string;                       // 调用方时钟,strict instant
  deliveryContext?: { inQuietHours: boolean; doNotDisturb: boolean }; // deliver/unsnooze 必须提供
  snoozeUntil?: string | null;       // snooze 必须提供
  responseRef?: string | null;       // respond 必须提供
}): Promise<{ outcome: "transitioned" | "expired_swept"; receipt: <契约回执形状> }>
```

事务体(组合义务全部在此承接):

1. 加载 prompt 行(id+workspaceId);缺失 → `prompt_not_found`;`expectedVersion !== row.version` → `prompt_version_conflict`。
2. **过期清扫先行(M3a as-built 6)**:若 `now >= expiresAt` 且行仍在非终态且 cause 不是 `expire`:改为执行 expire 转移(判定 `judgeMemberPromptTransition({from, cause:'expire', to:'expired'})`),落 expire 回执,返回 `outcome:'expired_swept'`——**不执行调用方原 cause**。
3. 由 cause 推导 toState(deliver→delivered、snooze→snoozed、unsnooze→delivered、respond→responded、withdraw→withdrawn、expire→expired、suppress→suppressed),`judgeMemberPromptTransition`;invalid 即抛(reasons 透传)。
4. cause 为 `deliver`/`unsnooze` 时:必须有 `deliveryContext`(缺失 → `delivery_context_missing`);重建契约 prompt 对象跑 `decideMemberPromptDelivery(prompt, {now, ...ctx})`;`deliver:false` → 不转移,抛 `prompt_delivery_held:<heldReason>`(hold 不是状态转移);`deliver:true` → 回执 `deliverDecision='deliver', heldReason=null`。其它 cause 回执两字段为 null(除 held 情形不落库)。
5. cause 为 `respond`:`responseRef` 必须 hasRef(缺失 → `response_ref_missing`),写入行与回执;cause 为 `snooze`:`snoozeUntil` 必须为 strict instant 且 > now 且 < expiresAt(否则 `snooze_until_invalid`)。
6. CAS:`tx.memberPrompt.updateMany({ where: { id, workspaceId, state: fromState, version: expectedVersion }, data: { state: toState, version: expectedVersion + 1, snoozeUntil, responseRef } })`;`count !== 1` → 抛 `prompt_transition_conflict`。
7. 插入回执(version = expectedVersion + 1,`evaluationUseProhibited: true`);P2002(prompt_version 键)→ `prompt_receipt_conflict_concurrent`。

只读:`getMemberPrompt`、`listMemberPromptTransitionReceipts`(按 version 升序,`Object.freeze`)。

- [ ] typecheck、lint、CAS 门禁零新 finding、模块单测不回归;commit `feat(member-gateway): add prompt queue store with CAS transitions and expiry sweep`

### Task 3: 隔离 MySQL 测试 `lib/member-gateway/prompt-store.mysql.test.ts`

门控 env:`MEMBER_PROMPT_STORE_DATABASE_URL`(mandate 模式,断言与 DATABASE_URL 相等);suffix 隔离;afterAll 仅 `$disconnect`(append-only)。用例:

1. create → deliver(带 ctx)→ respond 全链:行状态/version 递增,回执链 version 1→2→3?(create 不落回执,deliver 回执 version=2、respond version=3),投递回执 `deliverDecision='deliver'`、`evaluationUseProhibited=true`。
2. 错误 expectedVersion → `prompt_version_conflict`;CAS 竞争面由 serializable 保证。
3. quiet hours 下 normal prompt deliver → 抛 `prompt_delivery_held:held_quiet_hours`,行状态不变、无回执。
4. critical(带 ruleRef)quiet hours 下 deliver 成功。
5. 过期清扫:把行 `expiresAt` 用 `$executeRaw` 推到过去(MemberPrompt 无触发器可直改;注意 `MWPrompt_window_check` 约束,连 `issuedAt` 一起往回推),然后 respond → `outcome:'expired_swept'`,行 state='expired',回执 cause='expire'。
6. 终态拒绝:expired 后再 withdraw → reasons 含 `prompt_transition_invalid`。
7. snooze:非法 snoozeUntil(过去时刻)→ `snooze_until_invalid`;合法 snooze → snoozed;unsnooze(带 ctx)→ delivered。
8. respond 缺 responseRef → `response_ref_missing`。
9. append-only:`$executeRaw` UPDATE/DELETE 回执行 → 报错含 `append-only`。
10. 无规则 critical 建行后 deliver 于 quiet hours → held(M3a 防御在 store 路径同样生效)。

- [ ] 本地真库全绿;无 env 时套件 skip、`check:member-gateway` 仍绿;commit `test(member-gateway): cover prompt queue transitions, expiry sweep, and append-only receipts against MySQL`

### Task 4: 接线与收尾

- `test:member-gateway:mysql` script 的 vitest 参数追加 `lib/member-gateway/prompt-store.mysql.test.ts`(CI job 自动覆盖)。
- CPV1 白名单增加 `MEMBER_PROMPT_STORE_DATABASE_URL`;CI job 的 GITHUB_ENV 写入行追加该 key(与 M2b 同容器同库,不新建 job)。
- `check-member-gateway.ts` WorkPacket 扫描列表加入 `prompt-store.service.ts`、`prompt-store.mysql.test.ts`。
- as-built 附录、最终整体 review、push、PR。

---

## 边界声明

- 响应内容持久化(四类写入落库、challenge 流、`bridgeProtectedHumanResponse` 产物落库)是 **M3c**;本切片 respond 只记 opaque `responseRef`。
- "hold(静默期压住)"不是状态转移,不落回执、不改行——投递重试语义由运行时轮询承担。
- 判定语义变化只能发生在 M3a 契约层;store 零判定复制。

---

## As-built 记录(2026-08-20 执行完毕)

分支 `feat/member-gateway-m3b`。迁移在本地真库直接应用成功(binlog trust
flag 已开),MySQL 套件本地真跑全绿。

判断记录:
1. createMemberPrompt 补 P2002 → `prompt_already_exists`(计划遗漏)。
2. 无规则 critical 在 store 边界就被 validateMemberPrompt 拒绝
   (`critical_severity_without_rule`),不可能入库——计划用例 10 相应改为
   断言该拒绝。
3. hold(静默期压住)不落回执、不改行,与计划一致;投递重试由运行时轮询
   承担。
4. CI 复用 member-gateway mysql job(改名 Member Gateway MySQL),同容器
   同库跑两套 store 测试;CPV1 白名单增加 MEMBER_PROMPT_STORE_DATABASE_URL。
5. M3c 待做:四类响应内容落库(challenge 流、bridgeProtectedHumanResponse
   产物落库、authority 三元绑定钉死、非绩效化字面量延伸到响应回执)。

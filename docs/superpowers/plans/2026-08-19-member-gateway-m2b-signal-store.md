# Member Gateway M2b (信号入库) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** 为 M2a 信号契约落地持久层:两张表(challenge / receipt)、hand-authored 迁移(CHECK + append-only 触发器)、store service(serializable CAS 消费、逐 evidence-ref 越权校验、superseding 线性链的 DB 级强制)、隔离 MySQL 测试。

**Architecture:** 严格复制仓内最严范式(`lib/llm/model-egress-store.service.ts` 为 CAS 唯一无 baseline 样板):`import "server-only"`;模块级 `TRANSACTION_OPTIONS`(Serializable)与 `WRITE_RETRY_OPTIONS`;每个写函数**内联** `db.$transaction`(不得复用 helper 间接层,否则触发 `check:conditional-update-cas` 的 `client-from-parameter`);事务内先 `FOR UPDATE` 锁 Workspace 行;一次性消费用 `tx.<delegate>.updateMany({ where: { ..., consumedAt: null } })` + `count !== 1` 判定(在词法可见的 serializable tx 内,过 CAS 门禁)。receipt 表 append-only 由 UPDATE/DELETE 触发器强制;superseding 线性链由 `@@unique([workspaceId, supersedesReceiptRef])` 强制(MySQL 唯一索引允许多个 NULL)。判定逻辑全部复用 M2a 契约函数,store 只做:加载真值 → 调契约判定 → 原子落库。

**设计真值:** spec §5/§6.2/§9 + M2a as-built 第 7 条(evidence-ref 逐引用越权校验是本切片的成文义务)。

**分支:** `feat/member-gateway-m2`(继续)。

---

### Task 1: schema + 迁移

**Files:** Modify `prisma/schema.prisma`(两个 model + Workspace 反向关系);Create `prisma/migrations/20260819120000_member_work_signal_store/migration.sql`

Schema(遵循仓内约定:caller-supplied `String @id`、无 enum、无 `updatedAt`、显式 `map:` 命名,前缀 `MWSignalChallenge_` / `MWSignalReceipt_`):

```prisma
/// Member Gateway M2b: one-time work-signal challenge (spec §6.2).
/// Consumption is the only mutation; everything else is append-only.
model MemberWorkSignalChallenge {
  id                    String    @id
  workspaceId           String
  memberRef             String
  deviceRegistrationRef String
  clientId              String
  objectRef             String
  objectVersion         Int
  payloadHash           String
  issuedAt              DateTime
  expiresAt             DateTime
  consumedAt            DateTime?
  consumptionReceiptRef String?
  createdAt             DateTime  @default(now())
  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Restrict, map: "MWSignalChallenge_workspace_fkey")

  @@unique([id, workspaceId], map: "MWSignalChallenge_id_workspace_key")
  @@index([workspaceId, memberRef], map: "MWSignalChallenge_workspace_member_idx")
}

/// Member Gateway M2b: append-only candidate work-signal receipt (spec §5).
/// UPDATE/DELETE are blocked by triggers; a receipt can be superseded at
/// most once (unique on supersedesReceiptRef).
model MemberWorkSignalReceipt {
  id                    String   @id
  workspaceId           String
  memberRef             String
  deviceRegistrationRef String
  clientId              String
  objectRef             String
  objectVersion         Int
  kind                  String
  payloadJson           String   @db.LongText
  payloadHash           String
  policyRef             String
  policyVersion         Int
  submittedAt           DateTime
  candidate             Boolean
  taint                 String
  challengeRef          String
  supersedesReceiptRef  String?
  createdAt             DateTime @default(now())
  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Restrict, map: "MWSignalReceipt_workspace_fkey")

  @@unique([id, workspaceId], map: "MWSignalReceipt_id_workspace_key")
  @@unique([workspaceId, challengeRef], map: "MWSignalReceipt_workspace_challenge_key")
  @@unique([workspaceId, supersedesReceiptRef], map: "MWSignalReceipt_workspace_supersedes_key")
  @@index([workspaceId, objectRef], map: "MWSignalReceipt_workspace_object_idx")
}
```

Workspace model 增加反向关系字段 `memberWorkSignalChallenges MemberWorkSignalChallenge[]` 与 `memberWorkSignalReceipts MemberWorkSignalReceipt[]`(放在既有反向关系附近)。

迁移 SQL hand-authored(参照 `20260723230000_caio_model_egress_governance/migration.sql` 与 `workbuddy` 迁移):CREATE TABLE(列与 schema 严格等价,否则 `check:migration-drift` 红)、上述唯一/普通索引、CHECK 约束:

```sql
ALTER TABLE `MemberWorkSignalReceipt`
  ADD CONSTRAINT `MWSignalReceipt_kind_check`
    CHECK (`kind` IN ('progress', 'blocker', 'customer_signal')),
  ADD CONSTRAINT `MWSignalReceipt_candidate_check` CHECK (`candidate` = TRUE),
  ADD CONSTRAINT `MWSignalReceipt_taint_check` CHECK (`taint` = 'untrusted'),
  ADD CONSTRAINT `MWSignalReceipt_payload_hash_check`
    CHECK (CHAR_LENGTH(`payloadHash`) = 71 AND `payloadHash` LIKE 'sha256:%');

ALTER TABLE `MemberWorkSignalChallenge`
  ADD CONSTRAINT `MWSignalChallenge_payload_hash_check`
    CHECK (CHAR_LENGTH(`payloadHash`) = 71 AND `payloadHash` LIKE 'sha256:%'),
  ADD CONSTRAINT `MWSignalChallenge_window_check` CHECK (`expiresAt` > `issuedAt`);
```

append-only 触发器(receipt 表;模式照抄 ModelEgressReceipt):

```sql
CREATE TRIGGER `MemberWorkSignalReceipt_append_only_update`
BEFORE UPDATE ON `MemberWorkSignalReceipt`
FOR EACH ROW
SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'MemberWorkSignalReceipt is append-only';

CREATE TRIGGER `MemberWorkSignalReceipt_append_only_delete`
BEFORE DELETE ON `MemberWorkSignalReceipt`
FOR EACH ROW
SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'MemberWorkSignalReceipt is append-only';
```

注意:测试 teardown 无法删除 receipt(触发器阻止)——**测试 workspace 及其行保留在测试库**,这是 append-only 的语义结果;测试用 suffix 隔离即可(照 model-egress 测试的处置)。若 teardown 删 workspace 会被 Restrict 挡住,故 teardown 只 `$disconnect`。

迁移头部按仓内风格写 prose 说明(append-only 语义、relationMode=prisma 不 hand-author FK、CHECK 对 drift 比较不可见)。

- [ ] 写 schema + 迁移;`npm run db:generate`;`npm run db:migrate`(migrate deploy 到本地库);若有 `check:migration-drift` 门禁则运行确认绿
- [ ] Commit: `feat(member-gateway): add work signal challenge and receipt persistence schema`

### Task 2: store service

**Files:** Create `lib/member-gateway/signal-store.service.ts`

API(全部复用 M2a 契约判定;错误类 `MemberSignalStoreError extends Error` 携带 `readonly reasons: readonly string[]`):

```ts
issueMemberWorkSignalChallenge(input: {
  draft: MemberWorkSignalDraft;      // 先 validateMemberWorkSignalDraft,失败即抛
  ttlMs: number;                     // > 0 且 <= MEMBER_SIGNAL_CHALLENGE_TTL_CAP_MS
}): Promise<MemberWorkSignalChallenge>
// challengeRef = crypto.randomUUID();issuedAt = new Date();
// 组装契约 challenge 对象 → judgeMemberWorkSignalChallenge 兜底 → 落库(含
// device/clientId 列)→ 返回冻结对象

submitMemberWorkSignal(input: {
  principal: MemberPrincipal;
  challengeRef: string;
  payload: MemberWorkSignalPayload;
  surface: MemberReadSurfaceDecision;                 // 目标对象
  evidenceSurfaces: ReadonlyMap<string, MemberReadSurfaceDecision>;
  policyRef: string;
  policyVersion: number;
  receiptId: string;                                  // caller-supplied
  supersedesReceiptRef?: string | null;
}): Promise<{ outcome: "recorded" | "replayed"; receipt: MemberWorkSignalReceipt }>
```

`submitMemberWorkSignal` 事务体(serializable + 内联 + 先锁 workspace):

1. 加载 challenge 行(按 id + workspaceId);缺失 → `challenge_not_found`。
2. **重放判定**:若 `consumedAt !== null` 且 `consumptionReceiptRef` 对应 receipt 的 `payloadHash` 与本次载荷 hash 一致且 `receiptId` 一致 → 返回 `{ outcome: "replayed", receipt: 既有回执 }`;否则继续走契约判定(会得到 `challenge_already_consumed` 拒绝)。
3. **逐 evidence-ref 越权校验(M2a 成文义务)**:`payload.relatedEvidenceRefs` 中每个 ref 必须在 `evidenceSurfaces` 中存在且 `allowed === true`,否则 reasons 加 `evidence_ref_not_authorized:<ref>`。
4. 组装契约 `MemberWorkSignalSubmission`(`submittedAt = new Date().toISOString()` 截断到秒级?否——用完整 ISO;`priorConsumptionRef` 来自行状态)→ `judgeMemberWorkSignalSubmission`;invalid → 抛出携带全部 reasons。
5. 若 `supersedesReceiptRef` 非空:加载 prior receipt(同 workspace)与"是否已被取代"(查询 `supersedesReceiptRef = prior.id` 的行)→ 组装 next receipt 对象 → `judgeSupersedingSignalReceipt`;invalid → 抛。
6. CAS 消费:`tx.memberWorkSignalChallenge.updateMany({ where: { id, workspaceId, consumedAt: null }, data: { consumedAt: now, consumptionReceiptRef: receiptId } })`;`count !== 1` → 抛 `challenge_consumption_conflict`。
7. `tx.memberWorkSignalReceipt.create`(payloadJson = canonicalJson(payload),payloadHash,candidate: true,taint: "untrusted")。唯一约束冲突(P2002,`supersedes` 键)→ 抛 `receipt_already_superseded_concurrent`。
8. 返回冻结 receipt。

另提供只读 `getMemberWorkSignalReceipt(workspaceId, receiptId)`(读出后校验 payloadJson 的 hash 与 payloadHash 一致,不一致抛 `receipt_content_hash_mismatch`)。

- [ ] 实现;`npm run typecheck`、`npm run lint`、`node --import tsx scripts/check-conditional-update-cas.ts` 全绿(**零新 finding,不得写 baseline**)
- [ ] Commit: `feat(member-gateway): add work signal store with serializable one-time consumption`

### Task 3: 隔离 MySQL 测试

**Files:** Create `lib/member-gateway/signal-store.mysql.test.ts`

门控照 mandate-store 模式:`MEMBER_SIGNAL_STORE_DATABASE_URL` 存在则 `describe.sequential`,否则 `describe.skip`;断言 `DATABASE_URL === MEMBER_SIGNAL_STORE_DATABASE_URL`;`suffix = pid-Date.now()` 隔离;beforeAll 建 workspace/user/membership;afterAll 仅 `$disconnect`(append-only 行不可删,workspace 保留)。

测试用例(至少):

1. issue → submit happy path:receipt 落库,`candidate=true`、`taint='untrusted'`、payloadJson hash 一致;challenge 行 `consumedAt` 已置。
2. 同一 challenge 第二次提交(不同 receiptId)→ 抛,reasons 含 `challenge_already_consumed`。
3. 相同 receiptId + 相同载荷重放 → `outcome: "replayed"`,返回原 receipt。
4. 过期 challenge 提交 → reasons 含 `challenge_expired`(issue 时用 1ms ttl?不行,ttl 由 store 校验>0;用 issue 后手动把行 expiresAt 改到过去?挑战表无触发器,可用 `db.$executeRaw` 直改)。
5. 载荷漂移 → `challenge_payload_hash_mismatch`。
6. evidence-ref 缺 surface 或 not allowed → `evidence_ref_not_authorized:<ref>`。
7. supersede happy path;再次 supersede 同一 prior(新 challenge、新 receiptId)→ 抛(判定层 `receipt_already_superseded` 或并发唯一约束)。
8. append-only 触发器:`db.$executeRaw` 直接 UPDATE / DELETE receipt 行 → 报错含 `append-only`。
9. `issueMemberWorkSignalChallenge` 拒绝 ttl 超 5 分钟上限。

- [ ] 本地运行:`DATABASE_URL=<dev url> MEMBER_SIGNAL_STORE_DATABASE_URL=<same> npx vitest run lib/member-gateway/signal-store.mysql.test.ts --config vitest.public.config.ts` 全绿;无环境变量时确认整套 `check:member-gateway` 仍绿(套件自动 skip)
- [ ] Commit: `test(member-gateway): cover signal store consumption, supersede, and append-only invariants against MySQL`

### Task 4: 收尾

- [ ] `npm run check:member-gateway`(vitest 目录 glob 自动纳入新测试)、全量门禁、as-built 附录、最终整体 review
- [ ] 明确留给 owner 的事项写入 as-built(见下)

**已知留给 owner:** CI workflow 注册(`.github/workflows/ci.yml` 增加 `member_signal_store_mysql` job:导出两个 env、`db:generate` → `setup-db prepare` → 跑套件;并视需要在 `public-release-guard.ts` 注册新 npm script——本切片不新增 npm script 即不触发)。`WorkPacket` 扫描列表将 `signal-store.service.ts` 加入门禁(本切片 Task 4 内完成)。

---

## 边界声明

- store 只做"加载真值 → 契约判定 → 原子落库",不复制判定逻辑;任何判定语义变化必须发生在 M2a 契约层。
- 不新增 npm script、不改 CI、不动 public-release-guard(避免连锁冻结副本更新);本地验证靠显式 env 运行。
- 挑战消费是唯一允许的行变更;receipt 表 UPDATE/DELETE 被触发器阻断。
- `prisma/schema.prisma` 与迁移必须 Prisma-等价(drift 门禁);CHECK 与触发器对 drift 不可见,属 hand-authored 增强。

---

## As-built 记录(2026-08-19 执行完毕)

分支 `feat/member-gateway-m2` 上 5 个 commit(schema/迁移、store、mysql 测试、
重放绑定修复、门禁扩展)。本地可验证门禁全绿:typecheck 0 错误、
`check:conditional-update-cas` 零新 finding、模块 64 通过 + 10 skip、
全量 `check:boundaries` 每 commit 绿。

偏离与判断记录:

1. review 修复:重放分支补主体绑定校验(计划步骤 2 的措辞遗漏了该约束,
   实现最初如实复制)——不匹配主体落回契约判定,拒绝为
   `challenge_binding_mismatch`;并新增跨成员重放测试。
2. 重放有意不重跑 surface/evidence 校验(幂等读回既成事实),已在代码注释
   成文。
3. TTL 上限经由 M2a `judgeMemberWorkSignalChallenge` 兜底而非 store 重复
   实现;另加 `challenge_ttl_invalid` 的有限性前置校验。
4. P2002 区分 supersedes 唯一键(`receipt_already_superseded_concurrent`)
   与其他唯一冲突(`receipt_unique_conflict`)。

### 留给 owner(本地环境与 CI)

- 本地 MySQL 需以 root 执行 `SET GLOBAL log_bin_trust_function_creators = 1;`
  后运行 `npm run db:migrate`,方可在本地应用带触发器的迁移(包括 7 月的
  egress 迁移与本切片迁移);随后可用
  `DATABASE_URL=<url> MEMBER_SIGNAL_STORE_DATABASE_URL=<同值>` 实跑
  `signal-store.mysql.test.ts`(静态 review 已逐例 trace,但从未在真库跑过)。
- CI 注册:`.github/workflows/ci.yml` 增加 member_signal_store mysql job
  (镜像既有 `*_mysql` job:导出两个 env → db:generate → setup-db prepare →
  vitest 跑该套件);以及 `MIGRATION_DRIFT_SHADOW_DATABASE_URL` 下的
  drift 验证。
- 迁移在真库的首次 deploy 验证(本地被 MySQL 1419 阻塞,已在迁移头注明)。

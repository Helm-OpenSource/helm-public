---
status: archived / executed-with-as-built-record
owner: helm-core
created: 2026-08-22
review_after: 2026-09-22
public_safety: Implementation plan for the member-anchored memory candidate
  verification surface. No customer data, credential, private endpoint, or
  production-readiness claim.
---

# 记忆域:成员锚定候选验证面 Implementation Plan

> **裁定取代提示(2026-08-22 第二轮)**:本计划裁定 3("验证≠写入、文案
> 诚实")已被同日第二轮裁定取代——验证现在直接写入运行时记忆,见
> `2026-08-22-memory-member-fact-write.md`。本文其余记录仍为历史事实。

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development 或 executing-plans。

**Goal:** 按 owner 三项裁定(2026-08-22)落地:member 锚定的 `MemoryCandidate(PENDING_VERIFICATION)` 首个读取/验证面——`/memory` 最小切片、按源分支文案、本轮不做事实晋升且文案诚实("验证=确认为真实信号,不构成记忆写入")。

**Architecture(绑定,来自 2026-08-22 记忆域探查):**

1. **判别靠锚点列,不靠字符串**:所有查询用 `memberGatewaySessionRef: { not: null }` 判别 member 家族——绕开 reflection 字面量与 JSON sourceStatus 的匹配问题。
2. **验证转移 service**(新文件 `lib/member-gateway/signal-candidate-memory-verification.service.ts`,加入 member-gateway 门禁扫描列表):
   `verifyMemberSignalMemoryCandidate({ workspaceId, actorUserId, actorName, candidateId, decision: "verify" | "reject", note? })`:
   - 能力门 `assertWorkspaceMemoryServiceAccess`(MANAGE_MEMORY_FACTS——同页姊妹蒸馏区先例、投影 service 双门之一;裁定精神:不新造能力常量),事务外。
   - Serializable 内联事务 + lockWorkspace:加载行(id+workspaceId;缺失 → `memory_candidate_not_found`);**必须是 member 锚定**(`memberGatewaySessionRef` 非空,否则 `memory_candidate_not_member_anchored`——reflection 家族的 accept/dismiss 流程不受影响,本 service 绝不触碰);CAS `updateMany({ where: { id, workspaceId, status: PENDING_VERIFICATION, memberGatewaySessionRef: { not: null } }, data: { status: VERIFIED|REJECTED, reviewerNote: append(note, 280) } })`,`count !== 1` → `memory_candidate_state_conflict`。
   - **不写 MemoryPromotion/MemoryItem**(前者 schema 强制 runtime 锚,结构上不可写;门禁静态正则同投影 service 一样钉到本文件)。
   - 审计四件套裁剪为二:`writeAuditLog`(actionType `MEMBER_SIGNAL_MEMORY_CANDIDATE_{VERIFIED,REJECTED}`,targetType "MemoryCandidate",payload 仅 refs/前后状态/candidateKey,无正文)+ `logEvent`;**跳过 MemoryPromotion**(as-built 已证不可写)——AuditLog 即本切片账本。
   - 幂等语义:重复同向决定(行已是目标终态且 reviewerNote 相同来源)→ 返回 `outcome:"already_decided"`;反向改判 → `memory_candidate_state_conflict`(终态不可翻转,与 prompt 终态语义一致)。
3. **查询与 readout**(`features/memory/queries.ts` + 新 builder):
   - `getMemoryData` 增第二个 `memoryCandidate.findMany`:member 锚定 + status IN (PENDING_VERIFICATION, VERIFIED, REJECTED),take 50,createdAt desc;拆 `memberSignalPending` / `memberSignalDecisions`。`queries.test.ts` 的单 mock `findMany` 需改为按调用序返回(探查已指出)。
   - 新 readout builder(放 queries.ts 内,勿动 `buildReflectionCandidateReadout`——其输入要求非空 runtimeSession):解析 `sourceStatus` JSON(taint/evaluationUseProhibited/provenance;解析失败 → 标记 corrupt,行不可操作),`sourceClasses` 复用 `buildEvidenceSourceClasses`(untrusted class 已在)。
   - `buildEvidenceSourceClasses`(lib/helm-v2/runtime-upgrade.ts ≈:6969)增加显式 `member_signal_projection` class 分支(判别:sourceStatus 含 `"provenance"` 且含 `"taint":"untrusted"`?更稳:含 `"signalReceiptRef"` 子串)——终结 member 行落到误导性 `draft_fact` 兜底的问题;runtime-upgrade.test.ts 补断言。
4. **UI**(`features/memory/memory-client.tsx`):在**冻结标识符** `memoryLandingDeferredContext` 内部新增 `memberSignalVerificationSection`(结构照蒸馏区):
   - `permissions.canManageMemoryFacts` 两级门控(区可见,按钮 disabled + denied message);
   - 行首 taint danger Badge(与审阅面同义务,不折叠不截断);`member_signal_projection` 来源 chip;
   - **按源分支文案(裁定 2)**:member 行 VERIFIED 显示"已验证为真实信号"、REJECTED"已拒绝";不改 display-copy.ts 的 reflection 映射;
   - **诚实边界文案(裁定 3)**:区头注明"验证仅确认这是一条真实的成员信号,不构成记忆写入;记忆晋升是独立的后续能力"(避开 systemspeak 句式);
   - 决定列表小节(镜像 reflectionDecisionsSection)。
   - server action 放 `features/memory/actions.ts`(非 meetings):zod strict、`canManageMemoryFacts` 预检、调 service、双语错误映射、`revalidatePath("/memory")`。**import 链不得触达 lib/caio-governance**(防火墙;时间用 strict-instant)。
5. **测试**:service 的 mysql 用例并入 `signal-candidate.mysql.test.ts`(同 env):verify happy(status/审计行/无 MemoryPromotion 增量)、reject、重复同向 already_decided、反向改判冲突、非 member 锚定行拒绝(用既有 reflection 式行——直接 db.create 一条带 runtimeSessionId 的行)、MEMBER 角色能力拒绝;UI 组件测试照 memory-client 既有 harness;`memory-client-source-contract.test.ts` 增文案钉;presentation 守卫全量跑(冻结标识符不可动、systemspeak)。
6. **门禁**:`check-member-gateway.ts` 扫描列表 += 新 service 文件;对其加禁写正则(同投影 service);marker += `"already_decided"`?(不必——marker 锁契约字面量,加 `PENDING_VERIFICATION` 在场断言即可)。

**Tasks/commits:**
- T1 service + mysql 用例 → `feat(member-gateway): verify member-anchored memory candidates with decision-only semantics`
- T2 查询/readout/source-class 分支 + 测试 → `feat(memory): read member-anchored candidates by anchor with explicit source class`
- T3 UI 区 + action + 组件/契约测试 → `feat(memory): surface member signal verification in the memory landing`
- T4 门禁 + as-built + 最终整体 review + push + PR。

**边界:** 不写 MemoryPromotion/MemoryItem;不动 reflection 家族任何行为;事实晋升(VERIFIED→记忆写入)需 owner 另轮裁定(对象锚定、taint 写入政策、Item vs Fact 目标);operator 面板不动。

---

## As-built 记录(2026-08-22 执行完毕)

分支 `feat/memory-member-verification`。四个任务全部按计划落地,顺序执行,
每个 commit 过完整 pre-commit 门禁(`check:boundaries` 含
`check:conditional-update-cas`、`check:member-gateway`、
`check:caio-terminology`)。

Commits:

1. `8ab3a103` T1 — `feat(member-gateway): verify member-anchored memory
   candidates with decision-only semantics`
2. `d266b196` T2 — `feat(memory): read member-anchored candidates by anchor
   with explicit source class`
3. `02f68488` T3 — `feat(memory): surface member signal verification in the
   memory landing`
4. T4(本次)— `feat(member-gateway): wire memory verification into the gate
   and record as-built`

隔离 MySQL 套件本地真库全绿:`signal-candidate.mysql.test.ts`
36/36(其中 T1 新增 6 例);T4 收尾时 `npm run test:member-gateway:mysql`
(四个 env var 全开,同一 `helm_member_gw_local` 库)见下方"验证"小节。
`npx vitest run features/memory lib/helm-v2/runtime-upgrade.test.ts`
T2 81/81;T3 追加后 `npx vitest run features/memory` 35/35。
`npx vitest run lib/presentation/shared-surface-hierarchy-guards.test.ts`
(用 `vitest.config.ts`,不是 `vitest.public.config.ts`——该套件被
public 配置排除)107/107,零新增失败。

判断记录:

1. **判别只认锚点列,不认字符串(Architecture 1 落地确认)**:T1 服务与
   T2 查询全程只用 `memberGatewaySessionRef: { not: null }` 判别
   member 家族,从不匹配 `sourceStatus`/`sourceVerification` 的 JSON
   内容或字面量。T1 的"非 member 锚定行拒绝"用例直接证明了反向边
   界——用 `db.runtimeSession.create` + `db.memoryCandidate.create({
   runtimeSessionId })` 手造一条 reflection 家族形状的行,验证服务
   read 到它后立刻拒绝(`memory_candidate_not_member_anchored`),不
   触碰、不改写。`lib/helm-v2/runtime-upgrade.ts` 的
   `acceptReflectionCandidate`/`dismissReflectionCandidate` 全程未改
   一行——它们仍是 reflection 家族状态机的唯一所有者。

2. **终态语义:同向幂等、反向冲突、绝不翻转**:CAS 谓词是
   `{ id, workspaceId, status: PENDING_VERIFICATION,
   memberGatewaySessionRef: { not: null } }`。行已经是目标终态 →
   `already_decided`(零写入,零审计行);行是另一终态(相反判决,或
   未来可能出现的 `DEFERRED`/`PROMOTED`)→
   `memory_candidate_state_conflict`。这与 prompt 家族"终态不可翻转"
   的既有语义一致,也是 T1 mysql 套件"重复同向"与"反向改判"两条用例
   分别钉死的行为。

3. **MemoryPromotion 结构性不可达 → AuditLog 是本切片账本**:
   `MemoryPromotion.runtimeSessionId` 是 schema 里的必填(非空)外键,
   member 锚定的 `MemoryCandidate` 结构上没有 `runtimeSessionId`(与
   `memberGatewaySessionRef` 互斥,`MemoryCandidate_anchor_check`
   CHECK 约束)——写一条 `MemoryPromotion` 需要伪造一个不存在的
   runtime session,这不是"选择不写",而是"写不出来"。因此审计四件套
   裁剪为二(`writeAuditLog` + `logEvent`,复用 `lib/audit`/
   `lib/analytics` 的公共 helper,而不是投影 service 的裸
   `tx.auditLog.create`),AuditLog 承担本切片的决策账本角色。T1 的
   "zero MemoryPromotion increment" 断言与 `check-member-gateway.ts`
   新增的禁写正则(`/\.memoryPromotion\.|\.memoryItem\./`)双重钉死。

4. **`eventCategory` 判断**:`logEvent` 调用用了既有的 `"memory"`
   分类(`lib/analytics` 已有先例),而不是新造一个
   `"member_gateway"` 分类——当前仓内没有任何 member-gateway 服务调用
   过 `logEvent`(纯 `lib/member-gateway/*.service.ts` 全部只写
   AuditLog),这是本切片第一次从 member-gateway 服务层调用
   `logEvent`,`"memory"` 更贴合"这是一次记忆域候选的状态决策"而不是
   "这是一次成员网关会话事件"。记录为判断而非既定规范,后续如果
   member-gateway 域需要统一事件分类,这里可能要跟着改。

5. **`buildEvidenceSourceClasses` 导出 + `member_signal_projection`
   分支位置**:该函数此前是 `lib/helm-v2/runtime-upgrade.ts` 的模块私
   有函数(M2d 时只能通过 `buildReflectionCandidateReadout` 间接测
   试)。T2 显式导出它,专供 `features/memory/queries.ts` 的新 member
   readout builder 复用——member 行没有 `runtimeSession`,无法走
   `buildReflectionCandidateReadout`(其输入类型要求非空
   `runtimeSession`),所以必须直接拿到 `buildEvidenceSourceClasses`
   本体。新分支(`sourceStatus` 含 `"signalReceiptRef"` 子串 →
   `member_signal_projection`)插在第一条 if/else 链的 `draft_fact`
   兜底**之前**,终结了 member 行此前落入 `draft_fact` 的误导性归类
   (`draft_fact` 意味着"普通 AI 起草、待确认事实",而 member 行是
   "成员上报、未受信的信号")。第二条 `taint` 链(`"untrusted"`
   class)完全未动。

6. **T4 门禁扩展 + 负向验证**:`scripts/check-member-gateway.ts` 的
   `WorkPacket` 扫描列表加入
   `signal-candidate-memory-verification.service.ts`;新增该文件专属
   的 `PENDING_VERIFICATION` 冻结标记存在性检查,以及与投影 service
   完全同构的禁写正则块(`/\.memoryPromotion\.|\.memoryItem\./`)。负
   向验证:临时从服务文件里删掉全部 `PENDING_VERIFICATION` 子串后运行
   `npm run check:member-gateway`,门禁按预期报
   `FAIL — 1 violation(s)`;`git diff`/内容比对确认恢复后与改动前逐字
   节相同,复跑门禁恢复 `PASS`。

7. **事实晋升(VERIFIED → 记忆写入)仍是后续能力,未在本切片表达**:
   `verifyMemberSignalMemoryCandidate` 与
   `verifyMemberSignalMemoryCandidateAction` 的返回值/UI 文案都明确
   "验证仅确认这是一条真实的成员信号,不构成记忆写入"——`VERIFIED` 状
   态之后是否、如何写入正式记忆(对象锚定选择、taint 是否/如何随晋升
   传递、目标是 `MemoryItem` 还是 `MemoryFact`)需要 owner 另一轮裁
   定,本切片的 service/action/UI 三层都没有、也不会隐式表达这条路
   径。`/memory` 页面的"诚实边界文案"(ruling 3)与 action 层注释都留
   了这条记录。

**验证(T4 收尾)**:`npm run check:member-gateway`
PASS(负向验证见判断 6);`npm run test:member-gateway:mysql`(`DATABASE_URL`
`MEMBER_SIGNAL_STORE_DATABASE_URL` `MEMBER_PROMPT_STORE_DATABASE_URL`
`MEMBER_PROMPT_RESPONSE_STORE_DATABASE_URL` `MEMBER_SIGNAL_CANDIDATE_DATABASE_URL`
全部指向同一隔离库)本地真库全绿;`npm run typecheck`、`npm run lint`
全绿;`npx vitest run features/memory
lib/presentation/shared-surface-hierarchy-guards.test.ts` 全绿,后者零新
增失败。
9. 最终 review 加固:corrupt 溯源(sourceStatus 非 JSON 或缺
   taint/evaluationUseProhibited 字面量)在 **service 层**也拒绝
   (`memory_candidate_corrupt`)——"行不可操作"贯穿 UI 与直接调用两层;
   行本身保持原样(append-only 姿态,不做破坏性处理),mysql 用例钉死。
   review 记录的其余 Minor(重放时不同 note 静默丢弃、sourceFilter 瞬时
   不一致、take 50 共享窗口)为已知边界,晋升轮再议。

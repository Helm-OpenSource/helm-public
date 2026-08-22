---
status: planning / ready-to-execute
owner: helm-core
created: 2026-08-22
review_after: 2026-09-22
public_safety: Implementation plan for the member-anchored memory candidate
  verification surface. No customer data, credential, private endpoint, or
  production-readiness claim.
---

# 记忆域:成员锚定候选验证面 Implementation Plan

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

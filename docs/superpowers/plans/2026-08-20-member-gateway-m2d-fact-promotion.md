---
status: planning / ready-to-execute
owner: helm-core
created: 2026-08-20
review_after: 2026-09-20
public_safety: Implementation plan for stage-two fact promotion (member
  gateway session anchor). No customer data, credential, private endpoint,
  or production-readiness claim.
---

# Member Gateway M2d(阶段二事实晋升)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development 或 executing-plans。

**Goal:** 按 owner 四项裁定(设计文档尾部"Owner 裁定记录")落地:一等 `MemberGatewaySession` 会话锚点、确认后的成员信号候选投影为 `MemoryCandidate(PENDING_VERIFICATION)`、taint/非绩效化溯源进入记忆层并在既有面板可见。

**设计真值:** `docs/superpowers/specs/2026-08-20-member-gateway-stage-two-fact-promotion-design.md`(含裁定与实现修正);2026-08-20 记忆层探查(MemoryCandidate/RuntimeSession 形状、closeout 投影先例、门禁约束)。

**Architecture(绑定):**

1. **会话语义(固定窗口,行近不可变)**:`MEMBER_GATEWAY_SESSION_WINDOW_MS = 30 * 60_000` 冻结;会话自 `openedAt` 起 30 分钟内有效;窗口内同 (workspace, memberRef, deviceRegistrationRef, clientId) 复用,过窗即开新行(**不做 lastActivity 滚动更新**——保持行不可变,closedAt 是唯一变更且本切片不实现关闭)。
2. **schema/迁移** `20260821090000_member_gateway_session`(hand-authored,house 风格):
   - `MemberGatewaySession`:id(caller-supplied)、workspaceId、memberRef、deviceRegistrationRef、clientId、openedAt、closedAt?、createdAt;`@@unique([id, workspaceId], map:"MWGatewaySession_id_workspace_key")`;`@@index([workspaceId, memberRef, deviceRegistrationRef, clientId, openedAt], map:"MWGatewaySession_tuple_opened_idx")`;Workspace 反向关系;CHECK `closedAt IS NULL OR closedAt > openedAt`。无触发器(可变表)。
   - 加列(全部可空 VARCHAR(191),无 FK——relationMode prisma):`MemberWorkSignalChallenge.gatewaySessionRef`、`MemberWorkSignalReceipt.gatewaySessionRef`、`MemberPromptTransitionReceipt.gatewaySessionRef`、`MemberPromptResponseReceipt.gatewaySessionRef`。对已带 append-only 触发器的表做 ALTER 是 DDL,不触发行触发器(迁移头注明,这是仓内首例)。
   - `MemoryCandidate`:`runtimeSessionId` 改 `String?`(relation 变 optional,既有写方全部显式提供,无行为变化)+ 新列 `memberGatewaySessionRef String?` + CHECK `((runtimeSessionId IS NULL) <> (memberGatewaySessionRef IS NULL))`(恰一锚点)+ `@@index([workspaceId, memberGatewaySessionRef, createdAt], map:"MemoryCandidate_workspace_mgws_idx")`。
3. **会话开启/复用**:新文件 `lib/member-gateway/gateway-session.ts`(纯契约:窗口常量、`isSessionOpenAt(session, nowMs)` 判定、id 形状 `mgws-<uuid>`)+ store 内联函数 `resolveGatewaySession(tx, tuple, now)`(查询窗口内最新未关闭行,无则 create;必须在既有 Serializable 事务内、lockWorkspace 之后调用)。挂接点:
   - `signal-store.service.ts` `issueMemberWorkSignalChallenge` 事务内(lockWorkspace 后、challenge create 前)→ challenge 行落 `gatewaySessionRef`;`submitMemberWorkSignal` 的 receipt insert 把 challenge 行的 `gatewaySessionRef` 复制到信号回执(不重新解析——回执锚定的是**签发时**会话)。
   - `prompt-response-store.service.ts` `issueMemberPromptResponseChallenge` 同挂接;`recordMemberPromptResponse` 把 challenge 的 sessionRef 写进响应回执与其内联转移回执。`prompt-store.service.ts` 自身的 `transitionMemberPrompt`(系统因转移)**不写** sessionRef(保持 null,语义:非成员会话内动作)。
4. **投影** 新文件 `lib/member-gateway/signal-candidate-memory-projection.service.ts`(**不得**放 capability-closeout-review.ts——llm-candidate 门禁的切片扫描到该文件尾;**禁止写 MemoryPromotion/MemoryItem**):
   `projectConfirmedMemberSignalCandidateToMemoryCandidate({ workspaceId, actorUserId, actorName, artifactBundleId })`:
   - 双门:`assertWorkspaceGovernedCandidatePromotionServiceAccess`(裁定 4)+ `assertWorkspaceMemoryServiceAccess`(memory 写入接缝既有要求),都在事务外。
   - 类型钉死加载候选(CONFIRMED|CONSUMED bundle + CONFIRMED review + reviewedByUserId 非空)→ 解析+校验 artifact → supersession 复查(与 review/promote 同)→ **会话锚点**:取 artifact.signalReceiptRef 对应信号回执行的 `gatewaySessionRef`;为 null → `signal_receipt_without_session`(裁定 2,历史回执拒绝)→ 校验会话行存在且同 workspace(`gateway_session_not_found`)。
   - Serializable 内联事务 + lockWorkspace;确定性 candidateKey `member-signal-memory:<sha256(workspaceId, bundleId, artifactsJson hash).slice32>`;三层幂等(existence + AuditLog 匹配 + 字段等值,漂移 → conflict;P2002 复查)。
   - `memoryCandidate.create`:workspaceId、`memberGatewaySessionRef`(runtimeSessionId 不设)、artifactBundleId、candidateKey、summary = projectedSummary 截 4000、`sourceVerification` = JSON `{artifactReviewId, reviewedByUserId, reviewStatus:"CONFIRMED"}`、`sourceStatus` = JSON `{artifactStatus, candidateStatus:"pending_verification", officialMemoryPromotionAllowed:false, taint:"untrusted", evaluationUseProhibited:true, provenance:{memberRef, deviceRegistrationRef, clientId, policyRef, policyVersion, signalReceiptRef, gatewaySessionRef}}`(裁定 3:taint 随源携带,验证不抹除)、status PENDING_VERIFICATION、evidenceRefs。
   - 回执形状(纯对象返回,冻结字面量 `memoryPromotionCreated: false`、`canonicalMemoryWritten: false`,自校验 hash 照 closeout receipt 风格但 zod-free)+ audit `MEMBER_SIGNAL_MEMORY_CANDIDATE_PROJECTED`(payload 含两冻结假值,无正文)。
5. **taint 可见**:`lib/helm-v2/runtime-upgrade.ts` `buildEvidenceSourceClasses`(≈:6969)增加分支——`sourceStatus` 含 `"taint":"untrusted"` → push `"untrusted"` class(既有 Badge 渲染自动流入 /memory 与 operator 面板)。配套最小单测(该函数如未导出,导出或用既有测试模式)。
6. **测试**:契约单测(窗口判定、id 形状);mysql 扩展**既有套件**(不增新 env/CI 接线):`signal-store.mysql.test.ts` 加会话开启/窗口复用/跨窗新开 + challenge/回执落 sessionRef;`prompt-response-store.mysql.test.ts` 加响应与转移回执 sessionRef;`signal-candidate.mysql.test.ts` 加投影用例:happy(MemoryCandidate 行、恰一锚点、taint JSON、PENDING_VERIFICATION、audit)、幂等复用、历史回执(手工把信号回执经 root `$executeRaw`……不行,append-only——改为:直接造一条无 session 的信号回执?回执由 store 写入且现在总带 session——**用迁移前语义模拟**:测试里绕过?最诚实:对该用例直接 UPDATE 挑战表让 challenge 无 sessionRef 再走 submit?挑战表可直改(无触发器)→ 置 challenge.gatewaySessionRef=NULL → submit 产生无锚回执 → 投影拒绝 `signal_receipt_without_session`)、双门(MEMBER 拒)、**禁写证明**(投影后 MemoryPromotion/MemoryItem 计数为 0)、恰一锚点 CHECK(root `$executeRaw` 试插双锚/无锚行 → 3819)。
7. **门禁**:`check-member-gateway.ts` 扫描列表 += `gateway-session.ts`、`signal-candidate-memory-projection.service.ts`(+其测试);frozen marker += `"member-signal-memory:"`?(不必——marker 只锁契约字面量,加 `memoryPromotionCreated: false` 与 `canonicalMemoryWritten: false` 对投影 service 文件断言)。llm-candidate 门禁不扫 lib/member-gateway(已确认),但投影 service 自律遵守其禁写清单并以 mysql 禁写用例钉死。

**Tasks/commits:**
- T1 schema+迁移(db:generate、db:migrate 本地应用、typecheck)→ `feat(member-gateway): add gateway session anchor schema and memory candidate dual-anchor`
- T2 会话契约+store 挂接+单测/既有 mysql 套件扩展 → `feat(member-gateway): open and stamp gateway sessions across member write paths`
- T3 投影 service+回执+审计+mysql 用例 → `feat(member-gateway): project confirmed signal candidates into session-anchored memory candidates`
- T4 taint 渲染分支+测试 → `feat(helm-v2): surface untrusted member provenance in memory source classes`
- T5 门禁扩展+as-built+最终整体 review+push+PR。

**边界:** 不实现会话关闭、不实现 PENDING_VERIFICATION→VERIFIED 的验证动作(仓内本就无此转移,属记忆域后续)、不写 MemoryPromotion/MemoryItem;`officialMemoryPromotionAllowed:false` 与两冻结假值照 closeout 姿态。

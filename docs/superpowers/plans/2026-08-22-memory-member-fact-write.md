---
status: planning / ready-to-execute
owner: helm-core
created: 2026-08-22
review_after: 2026-09-22
public_safety: Implementation plan for member candidate fact promotion
  (verify writes runtime memory). No customer data, credential, private
  endpoint, or production-readiness claim.
---

# 记忆域:成员候选事实晋升(验证即写入)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development 或 executing-plans。

**Goal:** 按 owner 三项裁定(2026-08-22 第二轮)落地:member 锚定候选的验证动作**直接写入运行时记忆**——目标 `MemoryItem`、有锚带锚无锚也写、taint 来源标注永久携带。

**裁定取代声明(必须写进 spec/as-built)**:本轮裁定 3"验证即自动写入"**取代**上一轮裁定 3"验证≠写入、文案诚实"。已上线的验证面语义与文案随之返工:verify = 确认真实 **并** 写入运行时记忆(带永久 untrusted 来源标注);候选终态由 VERIFIED 改为 **PROMOTED**(回填 `memoryItemId`);历史上停在 VERIFIED 的 member 行(如有)保持原样展示,新流程不再产生。

**Architecture(绑定):**

1. **写入目标 MemoryItem(裁定 1)**:镜像既有 create 站点(`lib/helm-v2/meeting-action-pack-runtime.ts:759` 等)的必填列;`sourceProvenance` 携带完整 member 溯源 JSON(taint:"untrusted"、evaluationUseProhibited、memberRef/device/client/policy、signalReceiptRef、gatewaySessionRef、artifactBundleId、candidateKey)——**永久标注,检索/展示可见**。
2. **锚点(裁定 2)**:artifact 的 `objectAnchor.resolved` 且其 plain-string `objectType` 恰为 Prisma `ObjectType` 枚举成员 → 写 `objectType/objectId`;否则(未解析、或字符串不在枚举内)写无锚条目,opaque objectRef 保留在 provenance。枚举匹配用白名单比对,不做 as-cast。
3. **验证 service 语义改造**(`signal-candidate-memory-verification.service.ts`):
   - `decision:"verify"` 的事务体扩展:CAS PENDING→**PROMOTED**(不再落 VERIFIED)+ 同事务 `tx.memoryItem.create` + CAS 回填 `memoryItemId`(同一 update);`decision:"reject"` 不变(REJECTED)。
   - 幂等:行已 PROMOTED 且 `memoryItemId` 非空 → `already_decided`(不重复写 item);行 VERIFIED(旧语义遗留)→ `memory_candidate_state_conflict`(旧行不自动升级,as-built 记录);corrupt 检查保留(写入前更要严)。
   - **MemoryPromotion 仍不可写**(runtime 锚必填,结构不变);audit payload 增 `memoryItemId`、`memoryItemCreated: true`。
4. **门禁修订(显著记录)**:`check-member-gateway.ts` 对验证 service 的禁写正则从 `/\.memoryPromotion\.|\.memoryItem\./` 收窄为 `/\.memoryPromotion\./`,注释引用本轮裁定与取代声明;投影 service 的双禁不变(投影仍然只产生 PENDING 候选)。frozen marker:验证 service 增 `"PROMOTED"` 与 `memoryItemCreated: true` 在场断言。
5. **UI/文案返工**(`memory-client.tsx` + 契约测试):区头文案改为"验证 = 确认为真实信号并写入运行时记忆(条目永久携带'未信任成员上行'来源标注);拒绝则不写入"——避 systemspeak;member 决定标签:PROMOTED→"已验证并写入记忆",REJECTED→"已拒绝",VERIFIED(遗留)→"已验证(旧流程,未写入)";按钮文案 verify 改"验证并写入";`memory-client-source-contract.test.ts` 文案钉同步替换。action/queries 形状不变(status IN 集合加 PROMOTED)。
6. **测试**:mysql 用例改造/新增:verify happy 现在断言 MemoryItem 行存在(sourceProvenance 含 taint/refs、锚点两分支各一例:枚举命中带锚、opaque 无锚)+ 候选 PROMOTED + memoryItemId 回填 + audit;幂等重放不重复建 item(count 不变);reject 不建 item;corrupt 仍拒;遗留 VERIFIED 行冲突;MemoryPromotion 零增量保持。`features/memory` 组件/契约测试同步。

**Tasks/commits:**
- T1 service 语义改造 + mysql → `feat(member-gateway): verify now writes a tainted runtime memory item`
- T2 门禁修订 + UI/文案返工 + 契约测试 → `feat(memory): rework verification surface for write-on-verify semantics`
- T3 spec 取代声明 + as-built + 最终整体 review + push + PR。

**边界:** MemoryFact 不写(升级留后续);MemoryPromotion 结构不可写不变;reflection 家族零触碰;历史 VERIFIED 行不迁移。

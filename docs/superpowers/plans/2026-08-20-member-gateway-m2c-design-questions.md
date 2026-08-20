---
status: planning / needs-owner-decision
owner: helm-core
created: 2026-08-20
review_after: 2026-09-20
public_safety: Pre-design decision memo for feeding member work-signal
  candidates into the existing promotion chain. No customer data,
  credential, private endpoint, or production-readiness claim.
---

# Member Gateway M2c 设计决策备忘(信号 → 记忆提升链路)

> 本文不是实现计划。M2c 探查(2026-08-20)确认它不是薄桥接:把
> `MemberWorkSignalReceipt` 喂进既有提升链路存在 8 处硬失配,必须先由
> owner 拍板下列决策,再走 brainstorm → spec → plan 流程。

## 背景事实(探查结论,含证据位置)

仓内"记忆/提升"实为四条独立谱系:

1. 业务记忆蒸馏(`MemoryDistillationCandidate`)——approve 只记决定,
   **不写事实**(`lib/memory/distillation-candidate-store.ts:20-23`),不是目标。
2. 运行时记忆提升账本(`MemoryCandidate` → `MemoryPromotion`,
   `lib/helm-v2/runtime-upgrade.ts`)。
3. **受治理 artifact 审阅链**(`ArtifactBundle/ArtifactReview` →
   promote 成任务或投影成 `MemoryCandidate`)——canonical 接缝,但其
   intake(`lib/llm/governed-candidate-materializer.ts:243`)是 LLM 专属
   形状:强制 `roleOutputs`/`trajectoryReceipt`/build receipts、
   `.strict()` schema、capability grant + killSwitchRef。
4. CAIO enterprise memory(`CaioMemoryCandidate`,零外部调用方)。

主要失配:receipt 本体不含载荷(只有 hash);下游 schema 无 taint 字段
(spec §9 要求 taint 跨层不丢失);intake 的 `assertPersistableText` 禁
`https?://` 而信号契约允许 ≤3 条链接;伪造 LLM 溯源不可接受;
`objectRef`(opaque)对 `ObjectType` 枚举无映射;成员级证据授权面 vs
工作区 REVIEWER 审阅面是权限决策;无成员向 capability grant 签发方;
`MemoryCandidate` 需要 `runtimeSessionId` FK。

权限侧现状已经正确:MEMBER 无 `PROMOTE_GOVERNED_CANDIDATES` 能力
(`lib/auth/authorization.ts:102`),成员结构上不能审阅/晋升自己的信号。

## 需要 owner 拍板的决策

1. **接入谱系与形状**:推荐新建**平行 artifact 类型**
   `member_work_signal_candidate`(仿 `capability-closeout-materializer`
   与 governed-candidate 并列的先例),自带 strict schema,原生携带
   `taint`/`memberRef`/`deviceRegistrationRef`/`policyRef`,复用
   `ArtifactBundle/ArtifactReview` 与 `/approvals` 审阅面。备选:给
   `governedJudgementCandidateSchema` 加非 LLM 溯源分支(改动面更大,
   触及内容哈希契约与两个门禁脚本)。
2. **taint 在审阅面的呈现**:审阅 UI 必须把"成员上行、未经信任"作为
   一等标记展示;字段进 schema 还是进 artifact metadata?
3. **链接策略冲突**:信号允许 ≤3 链接 vs intake 禁链接——新 artifact
   类型沿用哪边?(建议:候选正文脱链接化,链接只作为 opaque 证据 ref。)
4. **objectRef 映射**:opaque `objectRef` 是否要求可解析到 `ObjectType`
   枚举?不可映射的信号走"无对象锚点"分支还是拒绝?
5. **证据授权升面**:成员级授权的 `relatedEvidenceRefs` 呈现给工作区
   REVIEWER 时,是重新做逐 ref 工作区授权投影,还是仅呈现 opaque ref?
6. **事实晋升终点**:确认后走 `projectConfirmedArtifactToMemoryCandidate`
   需要 `runtimeSessionId`——为成员信号引入何种会话锚点,或另立无会话
   终点?

## 决策后的执行路径

owner 逐项拍板 → superpowers:brainstorming(短轮,聚焦上述六项)→
spec 增补(§5 candidate_write 的晋升接缝节)→ plan → 执行,复用
M1-M3b 的两段式 review 流程。

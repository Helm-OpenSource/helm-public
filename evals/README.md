# Evals

这层用于保存试点前的最小黄金样本与质量回归输入。

- `recommendation/`
  - recommendation 黄金样本，用来检查标题、取舍角色、blocker/commitment/evidence 是否仍然成立
- `memory/`
  - 会议记忆提取黄金样本，用来检查 facts / commitments / blockers 的最小命中率
- `company-memory/`
  - 公司记忆 benchmark fixture pack，用来把 memory 从抽取质量扩展到数字经营资产、公司世界模型、retrieval utility、Must Push / Ask Helm 影响和 LLM economics 的后续评估
  - 当前可运行 `npm run eval:company-memory` 做 deterministic fixture readiness / six-layer scorecard 检查；这仍不是 production quality 或 LLM uplift 证明
  - 当前也可运行 `npm run eval:company-memory -- --mode=four-arm` 与 `npm run eval:company-memory -- --mode=economics` 做 redacted payload allowlist、four-arm baseline 与 cost-per-useful-judgement proxy 检查；`distilled_memory` arm 仍是 disabled contract slot
  - 当前还可运行 `npm run eval:company-memory -- --mode=world-model` 做 object graph health baseline 检查，输出 coverage / freshness / contradiction / traceability / boundary coverage 与 top 10 memory gaps
  - 当前还可运行 `npm run eval:company-memory -- --mode=adoption` 做 Ask Helm / Must Push / briefing adoption calibration proxy 检查，绑定 acceptance lift、time-to-trust、review coverage 和 boundary incident
- `llm-context/`
  - LLM context quality fixture pack，用来验证 Helm 每次调用模型前是否带齐对象、事实、承诺、阻塞、边界和输出 contract，并用 ablation delta 证明 context 是决定性变量
  - 当前可运行 `npm run eval:llm-context`；它只输出 context score、token estimate、required-context coverage 与 failures / warnings，不持久化 raw prompt
- `self-improvement/`
  - Helm review-first 自改进 fixture pack，用来验证 recommendation feedback、memory distillation、SkillSuggestion、LLM context audit 四条成长线是否形成 `signal -> candidate -> review -> measurement` 闭环
  - 当前可运行 `npm run eval:self-improvement`；它显式拒绝 auto-promotion、canonical fact auto-write、LLM ranking takeover 和 raw prompt persistence
- `commercial-promotion/`
  - Internal Commercial Promotion Pack fixture pack，用来验证 founder-led GTM 的 6 个 P0 artifact worker 是否 alias-only、review-first、evidence-backed、deterministic-scorecard 且无外部副作用
  - 当前可运行 `npm run eval:commercial-promotion`；它显式拒绝 raw customer PII、auto-send、price commitment、CRM writeback、public claim auto-publish 和 LLM final ranking
- `pack-a/`
  - Pack A / A 市场 pilot readiness fixture pack，用来把 OPC 评分卡、design partner 信号、Week 0 前置条件与 4 个 Pack A Skill 集成覆盖合成一个离线 gate
  - 当前可运行 `npm run eval:pack-a-pilot-readiness`；它只使用 alias-only fixture，显式拒绝 0 元 PoC、auto-send / CRM write、Phase 3 runtime overclaim、公开 proof 自动发布和 LLM final ranking
- `industry-pack-b2b/`
  - B2B Sales Advancement Pack fixture pack，用来验证行业 Pack 是 candidate-only 的经营判断合同，而不是 worker / skill catalog 或独立 control plane
  - 当前可运行 `npm run eval:industry-pack-b2b`；它覆盖 12 条 Pack fixtures、9 条 routing rows、2 条 Core compatibility fixtures、Pack A per-signal coexist / upgrade、Tenant Overlay 收窄、deny proof、customer-visible draft review，并显式拒绝 auto-send、silent CRM write、direct Must Push truth、raw PII、runtime/API/UI/schema/connector capability
- `internal-ai-service-providers/`
  - Helm 自身经营租户 AI 生态服务商 Pack fixture pack，用来验证 Daily Top 3 经营 readout 是否能在 alias-only、review-first、deterministic-ranking-first 边界内选择 3 家最该推进对象，并给出未入选理由、封闭 next action、风险边界、72h outcome SLA 和 customer-to-channel L0-L3 gate
  - 当前可运行 `npm run eval:internal-ai-service-providers`；它覆盖 8 条候选 fixtures、3 条 Top 3 正例、5 条 no-go / watch-only / downgrade 反例、review-safe action 白名单、5 条 72h outcome ledger（含降级 / 驳回负样本），并要求 selected Top 3 具备 safe sample、review-first acceptance、显式 no external side effect / no official commitment，同时显式拒绝 auto-send、silent CRM write、workflow trigger、Agent build、direct Must Push truth、raw PII、runtime/API/UI/schema/connector capability、Pack DSL、marketplace 和 LLM final ranking
- `internal-commercialization/`
  - Helm 自身租户商业化落地 fixture pack，用来验证 AI 生态服务商候选能否从 Daily Top 3 继续进入 `诊断 -> 受控试跑 -> 受控共创试点 -> 复盘报告 -> 客户转渠道判断` 的全过程 review-first lifecycle management
  - 当前可运行 `npm run eval:internal-commercialization`；它覆盖 4 个 offer stage、7 个 managed objects、15 个 lifecycle states、8 条 alias-only commercialization cases、4 条正向 stage 覆盖和 4 条 no-go / watch-only 反例，并显式要求 Helm 通过服务商管理客户机会、服务商保持 customer-facing owner、正向 case 具备 stage review packet 和 72h 复核窗口；2026-05-11 起也作为 `InternalCommercializationRun` 窄表、internal fixture connector、read-only API 和 `/operating` lifecycle board 的 runtime guard，connector apply 只能走 `internal-commercialization:fixture-connector` + `HELM_INTERNAL_COMMERCIALIZATION_APPLY=1` CLI gate，同时拒绝 direct customer contact、external side effect、official commitment、public claim、customer-visible without review、raw PII、auto-send、silent CRM write、workflow trigger、Agent platform、Pack DSL、marketplace 和 LLM final ranking
- `channel-partner-collaboration/`
  - 渠道方 / 超级个体协作模型 P0 offline fixture pack，用来验证 PartnerCustomerGrant、PartnerSafe DTO、PartnerNudgeDraft 两段状态机、AttributionCandidate、revocation cleanup、portfolio alias / privacy 和 P0-REQ-07 边界守卫是否保持离线、alias-only、review-first。
  - 当前可运行 `npm run eval:channel-partner-collaboration`；它覆盖 23 条 alias-only case，并显式拒绝 missing grant accepted、direct source table read、Ask Helm access、outbound send、direct Recommendation creation、unauthorized accept/promote、generic cross-tenant helper、raw customer data leak、schema、runtime、API、UI 和 partner workspace runtime drift。Gate green 只证明 P0 offline contract，不代表 P1 internal implementation 或 P2 partner-facing runtime 已成立。
- `implementation-health/`
  - Helm implementation health and value realization P0 offline fixture pack，用来验证客户上线后的实施健康快照、实施动作轨迹、复核项与次日承接证据 ledger 是否保持 alias-only、read-only、review-first。
  - 当前可运行 `npm run eval:implementation-health`；它覆盖 15 条 alias-only case：healthy tenant、no active user、owner / supervisor unmapped、notification unread、review backlog、execution receipt missing、follow-through evidence missing、legitimate not applicable，以及 HR scoring、raw customer data、causal ROI claim、per-actor aggregation、dynamic reason code、review queue auto write、notification fallback owner 等负例。Gate green 只证明 P0 offline contract，不代表 schema、runtime、API、UI、生产 query、自动通知、自动执行、客户侧健康分或因果 ROI 声明已成立。
- `object-signal-validity/`
  - 经营对象 / 经营信号有效性 fixture pack，用来验证坏对象、坏信号、过期证据、冲突证据、重复信号、跨租户身份错和 authority 越界不会直接进入 Must Push
  - 当前可运行 `npm run eval:object-signal-validity`；它显式拒绝 cross-workspace / tenant mismatch、permission insufficient、hallucinated evidence、LLM final ranking、auto-promotion 和 official write intent
  - 当前也可运行 `npm run eval:object-signal-remediation`；它验证前置 gate 失守后的 revocation、downgrade、blast-radius、memory contamination firewall、official write block 和 learning candidate
- `business-advancement-trace-roi/`
  - P0-REQ-05 trace timeline + ROI scorecard fixture pack；每个 case 必须能回答 6 个 trace question（source / transformation / reviewer / decision / boundary / final posture），并支持 6 项 ROI 指标 + 0 wrong commitment incident 的硬预算
  - 当前可运行 `npm run eval:business-advancement-trace-roi`；它显式拒绝 official write performed without reviewer approval，并把 trace coverage / follow-up 48h / deals rescued / draft adoption / prevented wrong commitment / manager review time saved 全部转成可比较的 scorecard
- `gate-consolidation/`
  - P0-REQ-06 gate registry fixture pack；每条 active keep gate 必须填非空 customer-visible risk、`metaOnly === false`、`feedsPilotDecision === true`，并且 5 条 required keep klass（boundary_static_gate / object_signal_validity_eval / context_packet_audit / memory_quality_impact_eval / trace_roi_pilot_proof_gate）必须齐全
  - 当前可运行 `npm run eval:gate-consolidation`；它把 meta_only gate / 缺 customer-visible risk / 缺 evidence pointer 的 gate 全部标为违例，防止 P0 列表被仪式性 gate 占满
- `audience-signal/`
  - 接收者感知经营信号 fixture pack，用来验证同一条已校验信号会按 human / worker / reviewer / learning loop 生成不同带宽、动作权限和停止条件的投影
  - 当前可运行 `npm run eval:audience-signal`；它显式拒绝 raw payload echo、Worker forbidden action leak、auto execution、canonical memory write 和 LLM final ranking
- `business-advancement-signal-pipeline/`
  - Business Advancement 主链 fixture pack，用来把 Object / Signal validity、post-admission remediation、audience-aware projection 串成一条离线质量门
  - 当前可运行 `npm run eval:business-advancement-signal-pipeline`；它用 20 条 alias-only case 验证 7 类 source 到 MustPushItem / ReviewRequiredAction / WorkerInstruction / LearningCandidate 的分流，并显式拒绝 raw payload echo、invalid Must Push、official write、auto execution、canonical memory write 和 LLM final ranking
- `intelligence-growth/`
  - IGS 核心 10 维度 fixture pack，用来验证 context、object / signal、memory、routing、action outcome、worker / skill、prompt / policy、eval replay、tenant personalization、cost / model / tool 十条智能增长维度的 offline quality contract
  - 当前可运行 `npm run eval:intelligence-growth`、`npm run eval:intelligence-growth:context`、`npm run eval:intelligence-growth:routing`；它只证明 P0 offline fixture / evaluator / taxonomy contract，不代表 runtime、自学习、生产 prompt、DB/API/UI 或 canonical memory write 已授权
- `intelligence-growth-tenant-signals/`
  - IGS 改进项到 Helm 内置自身业务发展租户经营信号的 fixture pack，用来验证 10 条智能维度的改进项能否作为 `helm-business-development` 的 report source 进入 Business Advancement pipeline
  - 当前可运行 `npm run eval:intelligence-growth-tenant-signals`；它验证 4 条 Must Push candidate、6 条 ReviewRequiredAction、10 条 LearningCandidate，并显式拒绝 raw payload echo、Worker forbidden action leak、auto execution、official write、canonical memory write 和 runtime self-learning；客户租户 / 租户私有应用信号不得默认回流为 Helm core upgrade
  - 当前还可运行 `npm run eval:intelligence-growth-review-packets`；它把 10 条 IGS tenant signal 转成 founder approval + required reviewer 的 offline review packet，并要求 scope violation、promotion authority leak、runtime authority leak 均为 0
  - 当前还可运行 `npm run eval:intelligence-growth-weekly-scorecard`；它把当周所有 review packet 聚合为 founder / operator weekly scorecard（candidate-only，不授权 runtime / self-learning / DB / API / UI / prompt / schema / write authority）；当前指标：10 packets、4 ready_for_founder_review、6 needs_required_review、0 blocked、coverage 100%、authority leaks 0
  - 当前还可运行 `npm run eval:intelligence-growth-decision-outcomes`；它把 founder / operator 的实际决策结果收录为离线 fixture，闭合 review packet → weekly scorecard → 决策结果台账反馈环（candidate-only，OFFLINE-ONLY，仅限 helm-business-development 内置自身业务发展租户）；当前指标：10 条决策记录、decision/evidence/owner/reviewer/boundary coverage 100%、nextLearningCandidateCount 10、rawCustomerDataIncidentCount 0、unauthorizedProductionWriteCount 0
- `intelligence-growth-learning-requeue/`
  - **P0+++++ IGS Learning Requeue Gate**：把决策结果台账（decision outcome ledger）中每条记录的 nextLearningCandidateId 重新入列为下一周期学习候选（OFFLINE-ONLY，candidate-only，仅限 helm-business-development），完整闭合决策反馈 → 候选重入环
  - 当前可运行 `npm run eval:intelligence-growth-learning-requeue`；它验证 10 candidates、expectedCandidateCount 10、candidateCoveragePercent 100、blockedDecisionCandidateCount 3、unexpectedCandidateCount 0、sourcePacketMismatchCount 0、invalidStatusCount 0，所有 unauthorized/raw 计数均为 0，evidence/owner/boundary coverage 100%
  - 当前还可运行 `npm run eval:intelligence-growth-chain`；它原生串联 tenant signal → review packet → weekly scorecard → decision outcome ledger → learning requeue 五段 gate，验证 10/10/10/10/10 count continuity、executionMode native、continuityPass true、totalUnauthorizedIncidentCount / totalRawDataIncidentCount / totalScopeMismatchCount 均为 0、minimumCoveragePercent 100%
  - 当前还可运行 `npm run eval:intelligence-growth-cycle-advance`；它把 W18 requeue candidates 物化为 W19 next-cycle intake，验证 intakeCoveragePercent 100%、source/status/scope/window/authority/raw incident 计数均为 0
  - 当前还可运行 `npm run eval:intelligence-growth-fixture-lint`；它对 80 个核心维度 fixture、10 tenant signal、10 decision outcome、10 learning requeue candidate 做元验证，验证 duplicate/missing id、invalid dimension/decision、orphan reference、missing requeue candidate、scope/window mismatch、unauthorized/raw incident 均为 0
  - 当前还可运行 `npm run eval:intelligence-growth-dimension-saturation`；它验证 W19 next-cycle intake 覆盖 10 个智能维度且当前 fixture 每维度只出现一次，防止自成长偏科或重复维度假绿
  - 当前还可运行 `npm run eval:intelligence-growth-remediation-roundtrip`；它验证 continue / revise / blocked / stop 在下一轮不会被错误复活或升级
  - 当前还可运行 `npm run eval:intelligence-growth-budget-gate`；它验证离线候选具备模型、token、工具和 wallclock 预算 envelope，防止 P0 离线评估扩成无界 agentic run
  - 当前还可运行 `npm run eval:intelligence-growth-determinism`；它对 core eval 和 18 个派生 gate 连跑 3 次，除 allowlisted volatile 字段外不允许输出漂移
  - 当前还可运行 `npm run eval:intelligence-growth-boundary-static`；它机械拒绝 DB / Prisma、API route、Next server、production query、LLM env 和 network call 进入 IGS P0 离线链
  - 当前还可运行 `npm run eval:agentic-governance-boundary-static`；它只扫描 Agentic Governance / External Agent Intake offline 面，机械拒绝 DB / Prisma、API / UI route、schema、provider client / env / credential、production query 和 network call
  - 当前还可运行 `npm run eval:intelligence-growth-eval-replay-snapshot`；它固定 18 个 gate 的 contract-level canonical summary，防止 evaluator 输出形状漂移
  - 当前还可运行 `npm run eval:intelligence-growth-schema-drift`；它固定 TS union、contracts registry、fixture-lint sentinel、fixture keyset、snapshot keyset 与 snapshot version
  - 当前还可运行 `npm run eval:intelligence-growth-failure-taxonomy-coverage`；它固定 10 个 taxonomy 文档与 30 个负例 fixture 的 failure type 映射
  - 当前还可运行 `npm run eval:intelligence-growth-data-protection-manifest`；它固定 18 个 checked-in IGS fixture JSON 的字段级 redaction manifest，所有 DP 状态仍为 pending，gate green 不代表 DPO approval
  - 当前还可运行 `npm run eval:intelligence-growth-approval-readiness`；它固定 10 个 P1+ approval readiness packet，gate green 不代表 founder / required reviewer approval
  - 当前还可运行 `npm run eval:intelligence-growth-live-calibration-preflight`；它固定 10 个 redacted evidence package，gate green 不代表 live calibration approval 或 runtime adoption
  - 显式禁止：DB schema、API、UI、runtime、self-learning、生产 prompt、schema、policy、write、canonical memory write、skill auto-promotion；客户租户信号不得回流为 Helm core upgrade
- `ask-helm/`
  - Ask Helm 自然语言入口黄金样本，用来检查 query intent、行动意图、对象/记忆/系统知识需求和越界请求拒绝是否仍然稳定
  - `query-intents.json` 保留 v1 问答 / 导航 / denial 基线，并补入真实用户表达，用来回归更自然的 Ask Helm phrasing
  - `action-intents.json` 覆盖 v2 行动入口样本：计划拆解、草稿准备、复核材料、内部跟进队列草稿、handoff、受控执行请求、review-required execution、开放域拒绝和跨 workspace 拒绝，并补入 real-user phrasing backfill
  - `context-packet-cases.json` 覆盖 Ask Helm Context Packet 第一刀：good plan、高风险执行降级、cross-workspace / open-domain deny、未复核 / 撤销 / 归档 / 错对象 memory 排除、raw prompt / secret leak 负例、over-broad context 负例和 authority leak 负例
  - 当前可运行 `npm run eval:ask-helm-context-packet`；它只验证 offline context packet contract，不接 runtime/API/UI/DB，不调用 LLM，不保存 raw prompt，不做 memory write 或多轮持久化

当前这些样本以 seed 数据为基线，适合：

1. 本地回归
2. 试点前检查
3. recommendation / memory 逻辑调整后的快速对照

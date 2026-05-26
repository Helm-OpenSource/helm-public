---
status: active
owner: helm-core
created: 2026-05-12
review_after: 2026-08-10
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm 渠道方 / 超级个体协作模型需求

日期：2026-05-12
状态：P0 离线 contract V2.1（Codex + Claude Opus 共识版；不进入 runtime）
适用范围：在 V2.3 GTM Operating Layer §6.9（Contributor / Referral / Partner Intake）与 Phase 6（Contribution / Accrual Bridge）之上，补齐渠道方 / 超级个体作为系统主体（不只是贡献记录）与客户租户协作面的契约缺口。

## 一句话结论

渠道方 / 超级个体（referral channel 与 AI implementation partner 两类）先作为**受控试点的贡献 / 归属主体**进入 Helm，而不是立即成为新的 workspace class 或客户租户角色；P0 只冻结离线 contract、fixture eval、safe DTO、授权源和归属主账本边界；P1 复用 Helm 现有 `SalesReferral` / `PartnerProgram` / `RevenueAttributionLedger` / `PayoutLedger` 内部链路；P2 才在 owner 显式批准后评估 PartnerWorkspace / PartnerCollaborator runtime 试点。客户合同主体仍是 Helm，分账沿用 V2.3 Phase 6 manual settlement 姿态，不引入新结算系统。

本轮**不做** Prisma schema migration、runtime、API、UI、自动结算，不创建任何 migration 文件，不新增 Prisma enum / model / API route / UI surface。本轮只做**离线 contract + fixture eval**，按 V2.3 §7 / 最近若干 P0 离线 gate 的同样姿态推进。

## 与 V2.3 的关系

本需求**不引入新主架构**，而是补齐 V2.3 既有定义里两个未完整收敛的缺口：

- V2.3 §5 已把 Channel / community partner（reviewed contributor）和 AI implementation partner（reviewed partner）列入第一版角色，但**未定义这两类角色的系统主体形态**（账号 vs 租户），也未定义他们在客户租户内的**权限白名单**与**署名归属**
- V2.3 §6.9 / §6.10 已定义贡献 intake 与 accrual readout，但**未定义 partner 自己的"组合视图"**（横跨多个客户、alias-only 判断层 readout）
- V2.3 §10.7 已禁止 partner 数据**进入**客户 workspace，但**未定义** partner 是否能**读取**客户 workspace 的判断层
- V2.3 §7.1 曾以产品草案形式写过 `GTMLead.referrerId`；当前 repo truth 是 `GtmLead.referrerMembershipId`，且 `GTMLead` 只作为 Helm reserved GTM 信号起点，不作为 referral / settlement / contribution 主账本。付费后归属必须进入 Contribution / Revenue Attribution 链路。

V2.3 既有边界（§10.4 Contribution != Payable、§10.5 Accrual Candidate != Settlement、§10.6 Human Review before External Use、§10.7 Clean Handoff）**全部继续生效**。

## 已锁定的上游约束（2026-05-12 user 确认）

1. **可见边界**：渠道方在客户租户内**只可见推进信号 / 判断层 / 决策待办**，邮件、会议、CRM、Ask Helm 原文、证据原文、LLM prompt / output 全部不可见
2. **计费主体**：**客户直接付 Helm，Helm 分成给渠道方**（非渠道方代收、非再分销）

## 合规姿态

本需求不对 Helm / 客户 / partner 的控制者、处理者或共同处理关系做法律定性。P0 只采用 conservative-by-design 默认：

- partner-visible readout 不含个人信息字段、原始证据、原始业务对象、prompt / output 或完整自然语言摘要
- partner-customer 关系必须有客户侧显式 grant
- partner safe readout 默认按受限接收方 / 处理者级别的最小可见原则设计
- 客户合同、DPA、partner 入驻条款和撤销条款必须经法务评审后才能进入 P2 runtime

## V2.1 评审收敛声明

V2.1 在 V2 基础上完成 Codex + Claude Opus 最终共识收敛：

- PartnerNudgeDraft 状态机扩展为两段（accepted_by_customer → customer_internal_review → promoted / kept_as_note）
- Portfolio readout alias 用 grant-scoped HMAC 形式化定义
- 最小活动门槛从 hardcoded N 改为 `commissionPolicy.minActivityThreshold`，并区分 partner type
- 新增 P0-REQ-09：客户撤销 partner grant 后的回收路径
- "partner 对 Ask Helm 默认禁止"从待澄清提升为 P0-REQ-02 黑名单硬约束
- 新增附录 A：partner 署名 UI 视觉契约（待 DESIGN.md 级正式批准）
- PartnerWorkspace / PartnerCollaborator 从 P0 runtime 要求降级为 P2 owner-gated 候选 runtime 试点
- 归属主账本锚定 `SalesReferral -> RevenueAttributionLedger -> PayoutLedger`；`GTMLead` 只保留线索来源 / 触发信号作用
- P0 新增 `AttributionCandidate` 离线概念、`PartnerCustomerGrant` 授权源、`PartnerSafe*DTO` 投影契约和 grant 生命周期内 salt 稳定原则
- customer_internal_review 的接受 / 升级权限限制为 `ADMIN` / `OPERATOR` / 显式指定 customer champion
- 合规姿态改为 legal-review-required + conservative-by-design，不在产品需求中做控制者 / 处理者法律定性

三段切分：
- **P0 offline contract / eval**：只冻结 contract、fixtures、safe DTO、grant source、AttributionCandidate、nudge lifecycle、revocation settlement review、salt stability principle；不要求 schema / runtime / API / UI。
- **P1 internal implementation**：复用现有 `SalesReferral` / `PartnerProgram` / `RevenueAttributionLedger` / `PayoutLedger`，在 Helm reserved / internal settings 内做 registry / attribution readout，不做 partner portal 和 customer tenant collaborator。
- **P2 controlled partner workspace trial**：只有 owner 显式批准后才评估 `WorkspaceClass.PARTNER`、`PARTNER_COLLABORATOR`、portfolio runtime、customer settings disclosure、PartnerNudgeDraft runtime。

## P0 需求（离线 contract + fixture eval）

### P0-REQ-01：Partner Subject Candidate 与阶段边界

P0 只定义渠道方 / 超级个体作为 Helm 贡献与归属链路中的**候选主体**，不定义新 workspace class，不新增 membership role，不创建 PartnerWorkspace runtime。

**P0 离线主体字段**：
- `partnerCandidateId`
- `partnerDisplayName`
- `partnerType ∈ {referral_only, implementation}`
- `sourceReference`
- `status ∈ {candidate, reviewed, active, suspended, released}`
- `linkedSalesReferralKey?`
- `linkedPartnerProgramKey?`
- `boundaryFlags[]`

**P1 内部实现锚点**：
- referral-only partner 进入 `SalesReferral`
- implementation partner 进入 `CustomEngagement` 或对应 `PartnerProgram` / `ProgramApplication`
- 应计与 payable-later 进入 `RevenueAttributionLedger` / `PayoutLedger`
- 归属 readout 仍是 internal/admin-readable，不是 public partner portal

**P2 候选 runtime，不属于 P0 / P1**：
- `WorkspaceClass.PARTNER`
- `PARTNER_COLLABORATOR`
- PartnerWorkspace 多成员协作
- customer tenant partner settings surface
- partner-facing portfolio runtime
- PartnerNudgeDraft runtime 写入

若未来进入 P2：
- `PartnerWorkspace` onboarding 只能由 Helm 主动开通，不开放自助申请通道
- `PartnerWorkspace` 默认 free / silent tier，不启用 Helm 判断引擎、不允许 Ask Helm、不消耗 LLM 配额
- `PartnerWorkspace` 禁止安装 CRM / 邮箱 / 会议 / IM inbound connector
- `PartnerWorkspace` 禁止承载客户业务对象（Contact / Company / Opportunity / SignalEvent）
- 同一自然人在同一客户租户内只能以一个 partner grant / one PartnerWorkspace membership 出现；切换合作主体必须撤销并重新授权

边界声明：
- 当前 repo truth 的 `WorkspaceClass` 只有 `CUSTOMER` / `HELM_RESERVED`；`TRIAL` / `PAID` 不是 workspace class
- AGENTS.md §6.5 "不是完整企业级多组织 / 多权限 / 多租户平台" 仍然生效；任何 P2 workspace-class 扩张都需要 owner 显式批准并进入 STATUS.md

### P0-REQ-02：Partner Safe DTO 与 Nudge 离线 contract

P0 不定义 `PARTNER_COLLABORATOR` runtime role。它只冻结未来 partner-visible readout 的**安全投影契约**，防止 P1 / P2 实施时直接读取 customer workspace 原表。

**授权源（P0 contract）**：
- 所有 partner-customer 关系必须先有 `PartnerCustomerGrant` 离线记录
- `PartnerCustomerGrant` 由客户侧 owner / admin / 指定 champion 触发或确认，partner 不可自授权
- grant 至少包含：`grantId`、`partnerCandidateId`、`customerWorkspaceId`、`grantedByMembershipId`、`customerChampionUserId?`、`scope`、`status`、`grantedAt`、`revokedAt?`
- grant 只证明"可进入离线评估 / 内部 readout"，不证明 runtime 访问已经存在

**允许读取（白名单，必须来自 PartnerSafe DTO）**：
- `PartnerSafeRecommendationDTO`：判断状态、结论类型、reason code、对象 alias、review posture
- `PartnerSafeMustPushDTO`：待推进项数量分桶、risk bucket、age bucket、review posture
- `PartnerSafeDecisionDTO`：决策队列状态、due bucket、owner role label、review posture
- `PartnerSafeControlLineDTO`：control line health、milestone bucket、blocked reason code
- `PartnerSafePilotLoopDTO`：pilot loop status、milestone bucket、proof posture

**禁止读取（黑名单，V2 已包含 Ask Helm 硬约束）**：
- 邮件 / 会议 / IM / CRM 原始内容与摘要
- Contact / Company / Opportunity 名称（仅 alias 可见）
- **Ask Helm 任何 query、answer、history、context packet**（V2 从"仍待澄清"提升为 P0 黑名单：避免对原始客户信号的间接推断）
- 证据原文与 raw evidence refs
- LLM prompt、raw output、`inputSummary`、`outputSummary`
- `SignalEvent.signalSummary`、`normalizedPayload`
- `AuditLog.payload`、`AuditLog.summary`
- 任何 `internalSalesNotes` / `trialInitializationPayload` 字段（V2.3 §7.2 已定义为内部专属）
- 财务、订阅金额、计费 statement
- 原 `Recommendation` / `MustPush` / `Decision` / `SignalEvent` 表不得直接出现在任何 partner-facing code path；只能通过上述 `PartnerSafe*DTO` 白名单投影

**允许写（离线 contract 的极窄白名单）**：
- 创建 `PartnerNudgeDraft`：partner 提出的"建议跟进"草稿
- 撤回自己尚未被客户接受的 `PartnerNudgeDraft`

**PartnerNudgeDraft 状态机（V2 两段制）**：

```text
drafted
  → submitted (partner 显式提交)
    → accepted_by_customer (ADMIN / OPERATOR / customer champion 显式接受)
        → customer_internal_review (进入客户内部待复核池)
            → promoted_to_recommendation (ADMIN / OPERATOR / customer champion 显式升级，进入正式 Recommendation 候选池)
            | kept_as_partner_note (14 天无后续动作或客户成员选择不升级，保留为带 partner 署名的内部 note)
    | rejected_by_customer (ADMIN / OPERATOR / customer champion 显式拒绝；带可选 reason)
    | withdrawn_by_partner (partner 在 accepted 前撤回)
    | expired (默认 30 天未处理 → 自动 expired；重提受 per-(partnerCandidate, customer, calendar_week) 限频)
```

关键约束：
- **partner 永不直接创建 Recommendation / Must Push / Commitment**；任何升级都需要客户成员显式动作
- `customer_internal_review` 是 V2 新增的中间态，对齐 V2.3 §10.9 customer confirmation 边界
- `kept_as_partner_note` 携带 partner 署名进入客户租户的只读历史，不进入 Recommendation 候选池
- accepted 后 partner 不可撤回，因为对象已经归入客户内部 review history
- accept / reject / promote 权限 = `ADMIN ∨ OPERATOR ∨ grant.customerChampionUserId == actor.id`；其他客户成员只读
- 任何升级 / 降级 / 拒绝动作都写 AuditLog，含 partner 署名 + 客户决策者署名

**禁止写**：
- 任何对外通信（邮件草稿、IM 草稿、对外报告、对外签约）
- 修改任何客户成员、计费、订阅、连接器配置
- 修改 Recommendation、Must Push、Decision 的状态
- 修改任何 V2.3 §10.9 列出的 `internalSalesNotes` / contribution / accrual / settlement / internal scoring / reviewer judgement 字段
- 触发 Ask Helm 查询

### P0-REQ-03：Customer-Visible Partner Disclosure Contract

P0 只冻结 disclosure contract，不新增客户租户 settings UI。若未来进入 P2，客户租户必须能看到当前有哪些 partner grant、他们能看到什么，以及如何撤销：

- 客户租户的 settings 下可新增 `partner-collaborators` readout 区（P2 runtime）
- 列表展示：partner 名称、partner type（referral_only / implementation）、授权时间、最近活动时间、可见范围摘要（"PartnerSafe DTO readout + 可提交 nudge 草稿"）、撤销入口、未处理 nudge 数量
- 任何 partner-origin 对象（含 `PartnerNudgeDraft`、`kept_as_partner_note`）在 UI 上必须有可见的"由 X 渠道伙伴提议"署名标记（具体视觉契约见附录 A）
- 客户租户内任何 Helm 系统级判断（Recommendation / Must Push）必须有可见的"由 Helm 系统判断"署名标记，禁止 partner 动作出现在系统判断的承载位上
- AuditLog 必须记录 `actorMembershipId` 与 partner grant reference；P2 若引入 `PARTNER_COLLABORATOR`，再追加 `actorRole` / `actorPartnerWorkspaceId`

理由（建议 / 承诺边界在多方场景下的延伸）：
- partner 的 nudge 不能伪装成 Helm 系统判断
- partner grant 的存在不能对客户隐藏
- 客户必须随时能撤销 partner 访问，且撤销动作必须有清晰回收路径（见 P0-REQ-09）

### P0-REQ-04：Partner Portfolio Readout（跨租户判断层只读聚合）

P0 只冻结未来 partner portfolio readout 的隐私边界；P2 才可能在 PartnerWorkspace 内提供该 partner 名下所有客户的组合 readout。

**Alias 形式化定义（V2 收敛）**：

```text
portfolioAlias(partnerCandidateId, customerWorkspaceId, grantId)
  = HMAC-SHA256(
      key   = partnerGrantSaltSecret[grantId],
      data  = partnerCandidateId + ":" + customerWorkspaceId + ":" + grantId
    )[:12]   // 取前 12 hex chars 作为短 alias
```

性质：
- **Grant-scoped 稳定**：同一 `(partnerCandidateId, customerWorkspaceId, grantId)` 生命周期内 alias 稳定，能跨时间对比
- **Grant 终结即失效**：grant revoked / expired 后该 alias 不跨新 grant 复用
- **Cross-partner 独立**：不同 partner 看同一客户得到不同 alias，无法 collusion 反推
- **与 self-tenant-health alias salt 隔离**：partner 无法借此推断 Helm support / OPC 看到的 alias 表
- **不可逆**：HMAC 单向，外泄后第三方不可由 alias 反推 customerWorkspaceId

**允许展示**（参照 `lib/self-tenant-health/*` 的 privacy-safe rollup 姿态）：
- 客户 portfolioAlias
- partner-known display label 或 customer-provided display alias
- 推进健康状态（healthy / watch / risk / blocked）
- Must Push 数量分桶（`<5` / `5-20` / `20-100` / `100+`）
- 未决策待办数量分桶
- 最近 7 天推进信号 throughput 分桶
- 订阅状态分桶（`trial` / `paid_active` / `paid_at_risk` / `churned`）
- 归属锁定状态（`pending_lock` / `locked` / `suspended` / `released`）
- 最近 partner 自己提交的 nudge draft acceptance rate 分桶

**禁止展示**：
- 客户真实工作区名称、URL、slug、行业、规模
- 精确订阅金额 / commission 金额（按桶；精确金额只在自己的结算 readout 内可见，且对齐 V2.3 §6.10 三个概念）
- 任何可识别的客户业务对象 / 关键人 / 关键事件
- 跨客户横向 BI、对比、排名（避免被构造成竞品情报）

显示分层：
- 授权 / 邀请页可以展示真实 customer workspace identity，因为它是客户显式 grant 的一部分
- portfolio 聚合 readout 不恢复真实 workspace name / URL / slug / industry / size，只使用 partner-known display label 或 customer-provided display alias
- alias 不是对 partner 隐藏客户关系的法律匿名化；它是防 cross-partner collusion、防数据外泄反推、并与 self-tenant-health alias 表隔离的技术标识

**跨租户原语边界（V2 风险缓解）**：
- portfolio readout 是 workspace-first 架构中**第一个**合法的跨租户读取入口
- 实现路径在本轮 contract 阶段**不绑定**（fanout vs 物化 rollup 留到实施阶段决策）
- P0-REQ-07 守卫必须**机械拒绝**任何非 portfolio readout 用途的跨 workspace query；不开放通用 cross-tenant helper

**审计姿态（V2 写放大缓解）**：
- 不是每个 view event 写一条审计；改为 **session-level aggregation**
- 每个 partner session 开启写一条 `PARTNER_PORTFOLIO_SESSION_START`
- session 结束写一条 `PARTNER_PORTFOLIO_SESSION_END`，`payload` 含 row count、health bucket counts、window days、unique customer alias count、access pattern summary
- session 默认窗口 30 分钟无活动自动关闭
- 单 view 详情由 audit query 在需要时按 session 展开，不预先持久化

### P0-REQ-05：归属主账本、锁定时点与套利防护

归属主账本不使用 `GTMLead`。`GTMLead` 只作为 reserved GTM 线索来源 / 触发信号；付费归属必须锚定到 `SalesReferral -> RevenueAttributionLedger -> PayoutLedger` 链路。

P0 新增离线概念 `AttributionCandidate`（fixture 层，不上 schema）：
- `candidateId`
- `partnerCandidateId`
- `customerWorkspaceId`
- `grantId`
- `sourceSignalRef?`（可引用 `GtmLead.referrerMembershipId` 或其他 GTM 来源，但不作为主账本）
- `partnerType`
- `status ∈ {pending_lock, locked, released, suspended, disputed}`
- `lockedAt?`
- `releasedReason?`
- `linkedSalesReferralKey?`
- `linkedRevenueAttributionLedgerId?`

规则：
- **锁定时点**：客户**试用转付费**那一刻，`AttributionCandidate.lockedAt` 进入 locked；P1 实现时同步生成 / 关联 `SalesReferral` 与 revenue attribution ledger
- **试用期分账状态**：试用期内归属仅记录、不计入分账
- **单 active 约束**：一个 customer workspace 同一时间只能有一个 active `AttributionCandidate` / `SalesReferral` lock；多 partner 共同推动场景**本轮明确 No-Go**，统一进入 V2.3 §6.9 "贡献记录"路径而非分账路径
- **流失处理**：partner 解约 / partner workspace canceled 时，future grant 进入 suspended；既有应计候选保留至自然结算窗口，但结算前仍必须走 manual settlement review

**最小活动门槛（V2 commission policy 化）**：

```text
commissionPolicy {
  minActivityThreshold: {
    referral_only: {
      type: 'grant_only',          // referral-only 只需有效 grant / attribution candidate
      minAcceptedNudgeCount: 0,
    },
    implementation: {
      type: 'engagement_required', // implementation partner 必须有真实推动
      minAcceptedNudgeCount: 3,    // 试用期内至少 3 条 nudge 被 customer 接受
      minActiveDaysWithAccess: 5,  // 试用期内至少 5 天有 grant/readout/nudge 相关活动
    },
  },
}
```

规则：
- 阈值在 `commissionPolicy` 中可配置，由 Helm OPC owner 维护，不 hardcode
- 试用转付费时，若 attached partner 未满足对应 partnerType 阈值 → `AttributionCandidate` 进入 `released` 状态，**不锁定**，客户付款不分账
- `released` 状态写入 AuditLog 与对 partner 的 readout 标识，partner 端能看到"未达活动门槛"原因（不暴露具体阈值数字，避免精确套利）

### P0-REQ-06：分账复用 V2.3 Phase 6，不新增系统

- 客户合同主体是 Helm；客户的所有计费走现有 trial → paid → Stripe / 支付宝 / 微信支付 / 人工结算回退路径
- partner 分账复用 V2.3 §6.10 Contribution Accrual Readout；P1 只在 Helm reserved / internal settings 内部展示，不提供 partner portal
- P2 若进入 PartnerWorkspace runtime，partner 才能在受控 surface 内看到"我的贡献 / 我的应计 / 我的结算"
- 应计候选生成规则：客户付款金额 × commissionRateBasisPoints；进入"应计候选"而非"已授予"
- 结算仍是 V2.3 既定的"manual settlement / value attribution Phase 0"姿态：**人工复核、人工打款、人工对账**
- 本轮**不做**：自动佣金支付、银行直连、税务申报、跨币种结算、股权应计、分红承诺（V2.3 §3.2 / §10.4 / §10.5 已明确禁止）

### P0-REQ-07：边界守卫扩展

新增 `scripts/decision-first-boundary-check.ts` 守卫（P0 可先检查文档 / fixture / eval contract；P2 runtime 后再扩到代码路径）：

- `partner_safe_dto_only`：partner-visible readout 必须来自 `PartnerSafe*DTO`，不得直接 select `Recommendation` / `MustPush` / `Decision` / `SignalEvent` 原表
- `partner_grant_required`：任何 partner-customer 关系必须有有效 `PartnerCustomerGrant`，partner 不可自授权
- `partner_collaborator_visibility_boundary`：P2 `PARTNER_COLLABORATOR` 候选路径不得 select P0-REQ-02 黑名单字段（含 Ask Helm 任何路径）
- `partner_collaborator_no_outbound_send`：P2 `PARTNER_COLLABORATOR` 不得出现在任何 outbound send actor 路径（邮件发送、IM 发送、对外报告生成）
- `partner_workspace_no_inbound_connector`：P2 `PartnerWorkspace` 路径下禁止注册 CRM / 邮箱 / 会议 / IM connector
- `partner_attribution_single_active`：一个 customer workspace 不得同时存在多个 active `AttributionCandidate` / `SalesReferral` lock
- `partner_portfolio_privacy_boundary`：partner portfolio readout 不得 select 客户真实 workspace name、URL、slug、行业、规模、精确金额、原文字段
- `partner_portfolio_cross_tenant_scope`：跨 workspace 查询入口只允许 portfolio readout 调用；任何 generic cross-tenant helper API 禁止接入
- `partner_disclosure_required`：任何 partner-origin 对象在客户租户 UI 上必须有 partner 署名
- `partner_nudge_no_direct_promotion`：partner 路径不得直接创建或修改 Recommendation / Must Push / Commitment；仅能写 PartnerNudgeDraft

### P0-REQ-08：Offline Fixture Eval

按 V2.3 §7 / 最近 P0 离线 gate（如 `eval:business-advancement-signal-pipeline` / `eval:internal-commercialization`）的相同姿态，新增 `eval:channel-partner-collaboration`：

- 20 条左右 alias-only fixture（V2.1 扩展自 V2 的 14 条），覆盖：
  - referral-only partner（仅 GTMLead referrer，无客户租户访问）
  - implementation partner with active customer access
  - `PartnerCustomerGrant` 缺失但尝试生成 partner readout（必须 reject）
  - partner 自然人多 PartnerWorkspace / 多 grant 冲突场景（同一客户只能一个 active grant）
  - PartnerSafe DTO 白名单投影，直接读取原 Recommendation / MustPush / Decision 尝试（必须 reject）
  - partner 提交 nudge → 客户 accepted → customer_internal_review → promoted_to_recommendation 完整路径
  - partner 提交 nudge → 客户 accepted → kept_as_partner_note 路径
  - customer_internal_review 14 天超时 → kept_as_partner_note
  - 非 ADMIN / OPERATOR / customer champion 尝试 accept / promote（必须 reject）
  - partner 提交 nudge → 客户 rejected 路径
  - partner 提交 nudge → 30 天 expired → 重提，且受 per-(partnerCandidate, customer, calendar_week) 限频
  - 黑名单字段访问尝试 incl. Ask Helm 尝试（必须 reject）
  - outbound send 尝试（必须 reject）
  - 直接创建 Recommendation 尝试（必须 reject，必须走 nudge）
  - 多 partner 共同推动（必须降级为贡献记录而非分账）
  - 试用期归属套利场景：implementation partner 未达阈值 → released
  - 试用期归属正常路径：referral_only partner 有有效 grant / attribution candidate → locked
  - `AttributionCandidate` locked 后生成 / 关联 `SalesReferral` / `RevenueAttributionLedger` 的离线预期
  - P2 partner workspace canceled → collaborator membership auto-suspend candidate
  - 客户撤销 partner grant → P0-REQ-09 回收路径
- 评估指标：
  - `unauthorizedAccessCount`（必须 0）
  - `outboundSendIncidentCount`（必须 0）
  - `disclosureMissingCount`（必须 0）
  - `attributionUniquenessViolations`（必须 0）
  - `partnerDataLeakedToCustomerWorkspaceCount`（必须 0；对应 V2.3 §10.7）
  - `customerDataRawLeakedToPartnerCount`（必须 0）
  - `directRecommendationCreationByPartnerCount`（必须 0）
  - `askHelmAccessByPartnerCount`（必须 0）
  - `crossTenantHelperLeakCount`（必须 0；对应 P0-REQ-07 跨租户原语守卫）
  - `directSourceTableReadCount`（必须 0；对应 PartnerSafe DTO 守卫）
  - `missingGrantAcceptedCount`（必须 0）
  - `unauthorizedNudgeAcceptanceCount`（必须 0）
- gate green 不代表 runtime / schema / UI 成立；只代表离线 contract 闭环

### P0-REQ-09：客户撤销 Partner Grant 后的回收路径（V2.1 收敛）

回答"客户撤销 partner grant 后已生成的对象 / 应计候选如何处理"：

**撤销操作**：
- P0 fixture 中由客户侧 owner / admin / customer champion 撤销 `PartnerCustomerGrant`
- P2 若存在客户租户 settings surface，则客户租户管理员在 P0-REQ-03 readout 面点击"撤销 partner grant"
- 系统立即关闭该 grant 对应的 partner-visible readout；P2 若存在 `PARTNER_COLLABORATOR` membership，再 suspend 对应 membership
- 写 AuditLog `actionType = PARTNER_GRANT_REVOKED_BY_CUSTOMER`

**撤销时 partner 产物的处理规则**：

| 对象状态 | 处理 |
| --- | --- |
| `PartnerNudgeDraft` in `drafted` / `submitted` | 立即标记为 `withdrawn_by_partner_revocation`，对客户隐藏，对 partner 只显示 final state |
| `PartnerNudgeDraft` in `accepted_by_customer` / `customer_internal_review` | 保留在客户租户内，状态保留，但 partner readout 显示"客户已撤销协作，无法再跟踪后续状态" |
| `PartnerNudgeDraft` in `promoted_to_recommendation` | 保留在客户租户内，已升级的 Recommendation 不撤销，但保留 partner 署名为历史出处 |
| `PartnerNudgeDraft` in `kept_as_partner_note` | 保留在客户租户内，partner 署名保留为历史记录，partner 不再可见 |
| `AttributionCandidate` | 若已 `locked`，保留至自然结算窗口；若 `pending_lock`，进入 `released` |
| 已 accrued 但未 settled commission 候选 | 保留至自然结算窗口；不追溯删除，但结算前仍必须走 manual settlement review |
| Portfolio readout 中该客户 alias | 立即从 partner 的 portfolio 中移除（后续不再聚合该客户判断层数据） |

**核心原则**：
- 客户撤销动作是**未来效**而非追溯效
- partner 已经做过的事保留为客户租户的历史记录（带 partner 署名）
- 已 accrued 但未 settled 候选不追溯删除，但不得绕过 manual settlement review
- 撤销后 partner 端的所有跨租户读取入口立即关闭

## P1 延后

- detailed access trace 的客户自助展开入口
- partner-related audit retention policy
- 撤销操作 grace period / emergency hard revoke 的 UX 策略
- salt rotation incident response runbook
- commission tier / rate 变更治理与 partner-visible rate readout
- 多 partner 共同推动场景的应计切分（贡献记录依然可见，分账规则未定）
- 自动佣金支付 / 银行直连 / 税务申报
- partner 自助申请通道 / partner marketplace
- partner 培训认证 / certified program
- partner NPS / 客户满意度调研
- 跨 partner 横向 BI
- partner 在客户租户内的有限对外通信能力（与 V2.3 长期边界冲突，需要单独评审）

## 非目标

- 不做完整 PRM 平台
- 不做 partner 代收 / 转售 / 二次包装 / 套餐打包
- 不做 partner 在客户租户内的写权限扩张（保持只读 + nudge 候选）
- 不做 partner 自动 onboarding
- 不做 marketplace 公开发现
- 不做 partner 直接对外承诺 / 直接对外签约
- 不做 partner 跨客户 BI / 行业对比 / 客户排名
- P0 / P1 不做 `WorkspaceClass.PARTNER`
- P0 / P1 不做 `PARTNER_COLLABORATOR`
- P0 / P1 不做 partner-facing portal
- P0 / P1 不做 customer tenant partner runtime settings

## 仍待澄清（交给 Codex 评审 + owner 决策）

1. P2 是否允许打开 `WorkspaceClass.PARTNER` / `PARTNER_COLLABORATOR`，需要 owner 显式决策并更新 STATUS.md
2. 本切片 P1 internal implementation 是否排在 V2.3 Phase 6 之后还是并行排程
3. Commission tier 与 `commissionPolicy.minActivityThreshold` 默认值的具体冻结值（V2.1 给出建议值 3 / 5，需要业务复核）
4. Partner 流失时已 locked 归属是否在某个 cooling window 后自动 released（保护客户付费体验 vs 保护 partner 应计预期之间的权衡）
5. 法务对 partner grant / partner-safe readout 的控制者 / 处理者关系定性

## 验证命令

文档阶段至少运行：

```bash
npm run typecheck
npm run lint
npm run check:boundaries
npm run check:public-release
```

实现阶段（P1 之后）补：

```bash
npm run eval:channel-partner-collaboration
npm run db:reset
npm run self-check
npm run test
npm run build
npm run e2e
npm run quality:regression
```

## 附录 A：Partner 署名 UI 视觉契约（DESIGN.md 级，待批准）

本附录在 P0-REQ-03 / V2 收敛建议基础上给出**文字版视觉契约**，作为 DESIGN.md 正式视觉规范的输入草案。

**核心原则**：
- partner 动作与 Helm 系统判断的视觉差异必须**强到不需阅读文字也能识别**
- 视觉署名出现在"对象卡片"与"对象详情"两个层级
- 客户撤销 partner 后，历史对象保留 partner 署名标记，不消失

**对象卡片署名样式**：

```text
┌─────────────────────────────────────────────────────┐
│ [Helm 系统判断]                                       │
│   绿色左侧色条（4px 宽，#1f7a3a 或 DESIGN.md 既定值） │
│   "由 Helm 系统判断" 灰色小字标签（10-11px）          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ [Partner 建议]                                        │
│   橙色左侧色条（4px 宽，#c2410c 或 DESIGN.md 既定值） │
│   "由 XX 渠道伙伴提议" 显式标签                       │
│     + partner 名称 + partnerType 小图标               │
│   状态徽章：drafted / submitted / accepted /         │
│              promoted / kept_as_note / rejected      │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ [客户内部决策]                                        │
│   蓝色左侧色条（4px 宽，#1d4ed8 或 DESIGN.md 既定值） │
│   "由 [客户成员名] 决策" 标签                         │
└─────────────────────────────────────────────────────┘
```

**对象详情署名样式**：
- 详情页顶部固定一行 attribution bar，依次显示：
  - 来源（Helm 系统 / Partner / 客户成员）
  - 创建时间
  - 当前状态
  - （若有）partner 名称与 partnerType
  - （若适用）"客户已撤销 partner 入驻，本对象保留为历史记录" 灰色 banner

**操作入口约束**：
- 客户成员在 partner-origin 对象上的操作（accept / reject / promote / keep_as_note）按钮文案必须显式包含"接受 partner 建议" / "升级 partner 建议为系统候选"等明确表述，不能简化为"接受"/"采纳"等模糊措辞

**禁止表达**：
- partner-origin 对象**不得**使用与 Helm 系统判断相同的颜色、字号、图标
- partner-origin 对象**不得**省略 partner 名称
- 客户撤销 partner 后，partner-origin 历史对象**不得**移除署名标记或合并到 Helm 系统判断序列

正式视觉规范由 DESIGN.md 在 Codex 评审通过后给出色值、间距、字号等具体参数。本附录只锁定"必须强到不需阅读文字也能识别"的视觉契约层。

## 变更记录

- 2026-05-12 V1：初稿，定位为 V2.3 §6.9 / Phase 6 的契约缺口补齐，本轮只做离线 contract + fixture eval，不做 schema / runtime / API / UI / 自动结算
- 2026-05-12 V2：Post-Claude-self-review 收敛。整合 V1 spec review 的 7 条建议与 6 项风险缓解：
  - P0-REQ-02 PartnerNudgeDraft 状态机扩展为两段（新增 `customer_internal_review` 中间态、`promoted_to_recommendation` / `kept_as_partner_note` 两个终态、`expired` 自动状态）
  - P0-REQ-02 黑名单从待澄清提升 Ask Helm 任何访问为硬约束
  - P0-REQ-04 alias 用 HMAC-SHA256 + partner-scoped salt 形式化定义；与 self-tenant-health alias salt 隔离
  - P0-REQ-04 跨租户原语边界声明：实现路径不绑定 contract，但守卫层强制 portfolio-only 封闭
  - P0-REQ-04 审计改为 session-level aggregation，缓解写放大
  - P0-REQ-05 最小活动门槛改为 `commissionPolicy.minActivityThreshold`，区分 partner type
  - 新增 P0-REQ-09：客户撤销 partner 入驻后的回收路径（drafted/submitted/accepted/promoted/kept_as_note/已应计的处理规则）
  - P0-REQ-07 守卫扩展两条：`partner_portfolio_cross_tenant_scope` 与 `partner_nudge_no_direct_promotion`
  - P0-REQ-08 fixture 扩展至 14 条，覆盖 V2 新增路径与守卫
  - PartnerWorkspace 多成员姿态从待澄清冻结为默认允许、统一署名
  - 新增附录 A：Partner 署名 UI 视觉契约（DESIGN.md 级输入草案）
  - V2 仍交给 Codex 复评的事项收敛到 4 条"仍待澄清"
- 2026-05-12 V2.1：Codex + Claude Opus 共识收敛。将 V2 的 runtime 倾向修正为三段模型：
  - P0 只冻结 offline contract / fixture eval / safe DTO / grant source / AttributionCandidate / nudge lifecycle / revocation settlement review / salt stability principle，不做 schema、runtime、API、UI 或 migration
  - P1 复用 `SalesReferral` / `PartnerProgram` / `RevenueAttributionLedger` / `PayoutLedger` 做 internal-only registry / attribution readout
  - P2 才在 owner 显式批准后评估 `WorkspaceClass.PARTNER`、`PARTNER_COLLABORATOR`、portfolio runtime、customer settings disclosure 与 PartnerNudgeDraft runtime
  - 归属主账本从 `GTMLead.referrerId` 修正为 `SalesReferral -> RevenueAttributionLedger -> PayoutLedger`，`GTMLead` 仅作触发信号
  - 新增 `PartnerCustomerGrant`、`PartnerSafe*DTO`、grant-scoped salt 稳定范围与 accept / promote 权限边界
  - 合规姿态改为 legal-review-required + conservative-by-design，不在需求文档里做法律定性

---
status: active
owner: helm-core
created: 2026-05-12
review_after: 2026-08-10
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm 渠道方 / 超级个体协作模型 — Spec Review (Round 2, post-Codex)

日期：2026-05-12
状态：Round 2 fresh critique；目标是找 V1 review + V2 收敛**漏掉**的问题
评审对象：[HELM_CHANNEL_PARTNER_COLLABORATION_REQUIREMENTS_2026-05-12.md](../product/HELM_CHANNEL_PARTNER_COLLABORATION_REQUIREMENTS_2026-05-12.md) V2（当前 local state，commit `06cfbea33` 之上的 V2 收敛）
评审视角：Claude，第二轮 fresh critique
前置：Round 1 spec review 已经覆盖 V1 → V2 的 7 处收敛建议；本轮不重复 Round 1 已闭环的事项

> Round 3 已在本文后半段记录 Codex × Claude Opus 最终共识。凡 Round 2 中关于法律角色定性、24 个月 retention、7 天 grace、salt never rotate 或 P0 引入 PartnerWorkspace runtime 的建议，均以 Round 3 共识为准：法律定性改为 legal-review-required，retention / grace / salt rotation runbook 降 P1，PartnerWorkspace / PartnerCollaborator 降 P2。

## 评审结论

V2 在协作模型主干上已经基本可执行，但**仍有 4 处 P0 层级的设计盲点是 V1 review 也漏掉的**：partner 自然人身份模型、PartnerWorkspace 自身的计费与判断层运行姿态、customer_internal_review 状态机的超时与重提语义、alias 隔离对象的精确表述。这些不收敛会在实施阶段卡住或留下隐藏的运营/合规债。

另有 8 项 V2 应在 V2.1 之前补的 should-fix 项与 4 项 P1 备忘。

## V2 已成立的判断（carry forward from Round 1，不再展开）

- partner = 独立租户而非 reserved tenant 账号
- 可见边界 = 判断层只读
- 计费主体 = 客户付 Helm
- 归属锁定 = 试用转付费
- 分账 = V2.3 Phase 6 manual settlement
- Round 1 提出的 7 处收敛已全部进入 V2

## V2 仍未收敛的 P0 层级盲点（V1 review 也漏的）

### 盲点 A：Partner 自然人的身份模型

V2 §P0-REQ-01 说"一个自然人可以同时拥有多个 PartnerWorkspace（不同合作主体），但每个 PartnerWorkspace 独立结算"，**但没说**：

- 这是一个 `User` × N 个 `Membership`（每个 PartnerWorkspace 一条），还是 N 个独立 User？
- 同一自然人在客户租户内出现时，是以**当前活跃 PartnerWorkspace 的 collaborator membership** 显示，还是以**自然人** + 标签的方式？
- workspace switcher 是否暴露该自然人所有 PartnerWorkspace（包括客户尚未察觉的其他合作主体）？

为什么重要：partner 的"诚信边界"取决于此。如果客户 A 邀请了 partner P（隶属 PartnerWorkspace P1），但 P 同时也在 PartnerWorkspace P2 里替客户 A 的竞品工作，客户 A 是否能在 disclosure 面看到这个事实？V2 当前回答是"看不到"（PartnerWorkspace 内部分工对客户租户不可见），但**多 PartnerWorkspace 归属对客户的潜在利益冲突没有任何披露规则**。

**建议**：V2.1 §P0-REQ-01 增加一条："同一自然人在同一客户租户内只能以一个 PartnerWorkspace membership 出现；切换 PartnerWorkspace 必须撤销并重新被客户邀请"。或者明确"允许多 PartnerWorkspace 但 disclosure 面必须列出"。这是一个真实的治理决策，不能含混。

### 盲点 B：PartnerWorkspace 自身的计费、判断层、AI 信号运行姿态

V2 把 PartnerWorkspace 列为新的 `WorkspaceClass.PARTNER`，与 TRIAL / PAID / HELM_RESERVED 并列，**但完全没说**：

- PartnerWorkspace 自身需要付费吗？是 free、是 Helm 主动开通的特殊 free tier、还是某种 paid plan？
- Helm 自身的判断引擎（Recommendation、Must Push、Ask Helm、LLM 调用）在 PartnerWorkspace 内**跑还是不跑**？
- 如果跑，partner 看到的就是"Helm 对 partner 自己业务的判断" + "portfolio readout" 拼成的视图，意味着 PartnerWorkspace 也会产生 LLM 成本、SignalEvent、AuditLog —— 谁承担这些成本？
- 如果不跑，PartnerWorkspace 是一个"哑壳"，只承载 portfolio + 应计/结算 readout —— 这对应 schema/runtime 也要做特殊裁剪

这一条与 V2.3 / `lib/self-tenant-health` / LLM 成本控制需求**直接耦合**，但 V2 没提。

**建议**：V2.1 §P0-REQ-01 显式表态。我倾向于："PartnerWorkspace 默认 free tier、不启用判断引擎、不允许 Ask Helm（与 P0-REQ-02 一致）、不消耗 LLM 配额；功能面仅限 portfolio + accrual readout。"这与"独立租户"的姿态不冲突，且避免引入新的成本归属问题。

### 盲点 C：customer_internal_review 中间态的超时与重提语义

V2 §P0-REQ-02 引入 `customer_internal_review` 中间态，**但未定义**：

- 客户内部成员一年不处理怎么办？是停在 customer_internal_review 永久不动，还是有超时？
- 已在 customer_internal_review 状态的 nudge，partner 还能撤回吗（V2 只说"撤回自己尚未被客户接受的"）？
- expired nudge 的"重提一次"是什么粒度：per-nudge-id 重提一次（实际 partner 可改一字重发，绕过限制）、per-(partnerWorkspace, customer) 总额限制、还是 per-day rate limit？

**建议**：V2.1 §P0-REQ-02 状态机补：
- `customer_internal_review` 默认 14 天无后续动作 → 自动 `kept_as_partner_note`（不阻塞客户工作流）
- accepted 后 partner **不可撤回**，因为已属于客户租户的内部对象
- "重提一次"改为 per-(partnerWorkspace, customer, calendar_week) 限制 N 条 submitted nudge；超额拒绝，避免内容微调绕过

### 盲点 D：Alias 隔离对象的精确表述

V2 §P0-REQ-04 说 portfolio alias 是 partner-scoped HMAC，"partner 无法借此推断 Helm support / OPC 看到的 alias 表"。**但没说**：

- partner 自己是否知道 alias ↔ customerWorkspaceId 对应？答案是**应该知道**——客户邀请 partner 时显式告知"你被 XX 邀请"，partner 收到客户列表时已知客户身份
- 那么 alias 隔离的真正对象是：(a) partner-vs-partner collusion；(b) partner workspace 数据外泄时第三方反推；(c) Helm self-tenant 与 partner 看到的 alias 不互通

V2 当前表述容易被误读为 "partner 看不到客户真实身份" —— 这是错的。partner **看得到**自己合作客户的真实身份，alias 只是用于跨租户 readout 聚合的内部 key，不是对 partner 隐藏的盲化。

**建议**：V2.1 §P0-REQ-04 明确："Alias 不是对 partner 隐藏客户身份的盲化（partner 因合作关系本就知道客户是谁），而是 (a) 防 cross-partner collusion / (b) 防 partner workspace 数据泄露时第三方反推 / (c) 与 self-tenant alias 表隔离。partner UI 上 portfolio alias 旁应显式标注客户公司名（partner 已知信息），不要伪装成匿名化。"

## V2 应在 V2.1 之前收敛的 Should-Fix 项

### S1：Customer 撤销 partner 的 UX 阻力 / detailed access trace 入口

V2 把 audit 改为 session-level aggregation 缓解写放大，但**客户怀疑 partner abuse 时的取证能力下降**。建议 §P0-REQ-03 补 "可申请 detailed access trace"：客户管理员点击 "查看 partner 详细访问记录" 触发 audit query 展开 session payload，写一条 `PARTNER_ACCESS_DETAIL_INSPECTED_BY_CUSTOMER` 审计。

### S2：partner workspace canceled 时既有 nudge 的命运

V2 §P0-REQ-05 / §P0-REQ-09 都讲了 collaborator membership 命运，但**未说** partner workspace 自身被 Helm 终止时，partner 此前提交的 nudge（含 customer_internal_review 状态、kept_as_partner_note 状态）是否仍保留 partner 署名。建议默认保留——partner 名字在客户租户内的历史 attribution 不应因 partner 退出而消失。

### S3：合规姿态声明（partner 端见到聚合判断层是否构成数据处理）

V2.3 §10.7 已禁止 partner 数据**进入**客户 workspace，但 V2 反向流动（客户判断层聚合到 partner 端）**没有合规声明**。即使是 alias + 分桶，从中国个保法 / GDPR 视角仍属"个人信息控制者-处理者"关系需要明确。建议 V2.1 §一句话结论之后新增 §合规姿态："partner 见到的聚合判断层不含个人信息字段；alias 形式化阻断反推；Helm 是控制者，partner 不是处理者；客户合同与 DPA 必须包含 partner 入驻条款"——交法务最终冻结。

### S4：PartnerWorkspace 内部 owner / admin / member 角色分层

V2 §P0-REQ-01 说允许多成员但没说内部角色。partner 端是否需要 owner（结算账户绑定）/ admin（成员管理）/ member（仅 portfolio readout）的分层？建议 V2.1 显式表态：默认沿用客户租户的 admin/member 二层模型（不引入新概念），admin 负责成员管理与结算账户，member 仅 portfolio + 自己的 nudge submission。

### S5：Commission rate 的设置、变更与可见性

V2 §P0-REQ-06 提到 `commissionRateBasisPoints` 但没说设置与变更治理。建议 V2.1 明确：rate 由 Helm OPC 在 commissionPolicy 内维护、partner 端在 PartnerWorkspace 内可见自己适用的 rate（不可见其他 partner 的 rate）、变更须 OPC 批准且对已锁定客户的 rate 沿用旧值（避免追溯改 rate 触发 partner 端账目意外）。

### S6：Audit retention for partner-related logs

V2 没说 partner 相关审计日志的保留期。如果 partner 解约后 6 个月发生合规争议，能否查到当时 partner 访问哪些客户 alias？建议 V2.1 明确：partner-related audit 至少保留 24 个月（涵盖典型应计争议窗口 + 合规追诉期）；与 release reality / 数据保留法务对齐前不公开承诺数字。

### S7：Salt rotation 姿态

V2 §P0-REQ-04 用 partner-scoped salt，**没说 rotation**。salt 一旦泄露 partner alias 全部失效，但稳定性也丢失。建议 V2.1 默认 never rotate；如果未来发现泄露，rotation 策略与 partner readout 兼容性（新 alias 表 + 历史 alias 标记）作为 incident response 流程文档化，不进 V2 contract。

### S8：Fixture 覆盖度

V2 §P0-REQ-08 给出 14 条 fixture——与最近 P0 离线 gate 的覆盖度（IGS dimension 80 条、business-advancement-signal-pipeline 20 条）相比**明显偏少**。建议 V2.1 fixture 扩展到 ~25 条：增加 partner 自然人多 workspace 冲突场景、customer_internal_review 超时场景、partner workspace canceled 时 nudge 命运场景、partner 申请 detailed access trace 场景、salt rotation 场景。

## 风险项（V2 内继续保留的真实风险）

1. **跨租户原语首次出现的滥用风险**：V2 守卫 `partner_portfolio_cross_tenant_scope` 已声明，但仍依赖实施阶段守卫**机械拒绝**通用 helper。建议 V2.1 在 fixture eval 中固定一条"通用 cross-tenant helper 调用尝试 → 必须 reject"的红线测试，作为 boundary regression 防线
2. **建议 / 承诺三方边界视觉脆弱性**：附录 A 提供了文字版视觉契约，但实施阶段如果开发者忽略色条/标签做 polymorphism 设计（如 "统一卡片样式 + 微小角标区分"），三方边界会立即失效。建议 V2.1 把附录 A 升级为 DESIGN.md 正式约束，并在 boundary check 中增加 "partner-origin object UI signature" 检查
3. **归属套利的二阶套利**：V2 引入 `commissionPolicy.minActivityThreshold`，但 partner 仍可通过策略性 nudge（提交 3 条易接受的低价值建议）满足阈值。这本身可能是 acceptable signal—— V2 没声明 acceptable / unacceptable 的判断口径
4. **撤销操作误触发风险**：V2 §P0-REQ-09 未规定撤销 UX 阻力。建议 V2.1 默认 "两步 confirm + 7 天 grace period（grace 期内 partner readonly + 不再聚合新数据但可恢复）"；硬 revoke 走单独入口给紧急情况
5. **PartnerWorkspace class 扩张与 AGENTS.md §6.5 的关系仍需 owner 表态**：V2 已写入"仍交给 owner 决策"，但 V2.1 在 ready-for-implementation 之前必须有 owner 显式同意，否则违反 AGENTS.md §13.4（"把局部能力扩成完整平台"）的尺度

## P1 备忘（V2 当前 P1 列表之外的）

- partner 横向推断游戏：partner 在 portfolio 视图能跨客户横向看 health，可能形成数据驱动的客户筛选游戏；监测姿态需要 P1
- 多语言：V2 默认中文署名 label；境外 partner 的 UI 语言切换姿态 P1
- Settlement frequency / payment milestone：月结/季结/客户付款后 N 天结，影响 partner 现金流预期，P1
- 客户转渠道路径与 partner workspace 互通：V2.3 / internal-commercialization 已有 "1 小时诊断 → 7 天试跑 → 4 周共创 → 客户转渠道判断" 路径；客户毕业后注册 PartnerWorkspace 是否自动迁移其 GTMLead 历史与已有学习——P1，但与本切片有直接相邻关系

## 给 V2.1 的收敛建议（按优先级）

1. **盲点 A**：自然人身份模型决策——单 PartnerWorkspace per 客户租户 vs. 多 PartnerWorkspace + disclosure 面列出
2. **盲点 B**：PartnerWorkspace 自身姿态——倾向 free tier / 无判断引擎 / 无 Ask Helm / 无 LLM 配额
3. **盲点 C**：customer_internal_review 状态机超时 14 天 → kept_as_partner_note；nudge 重提改为 per-(partner, customer, week) N 条
4. **盲点 D**：Alias 隔离对象精确表述——alias 不是对 partner 盲化客户身份
5. **S1**：客户可申请 detailed access trace 入口
6. **S3**：合规姿态声明（控制者-处理者关系）
7. **S2 / S4 / S5 / S6 / S7 / S8**：批量补充
8. **风险项 #2**：附录 A 升级为 DESIGN.md 正式约束并增加 boundary check
9. **风险项 #4**：撤销操作默认 7 天 grace period

## AGENTS.md §11 七问应答（Round 2 评审阶段）

1. **当前哪些能力已经完整成立**：无（仍在 spec 阶段）
2. **哪些能力已成形但仍需下一层**：V2 contract 主干已成形；Round 1 收敛已闭环；Round 2 发现 4 项 P0 盲点 + 8 项 should-fix 需进 V2.1
3. **哪些地方刻意未做，为什么**：保持 V2 现状（不引入 schema migration / runtime / API / UI / 自动结算）；以离线 contract + fixture eval 为 P0
4. **哪些边界必须继续诚实保留**：所有 AGENTS.md §6 硬边界；尤其 §6.5（不是完整 enterprise multi-tenant）—— PartnerWorkspace class 扩张必须 owner 显式批准并写入 STATUS.md
5. **当前基线 / sprint 目标是否已经清楚**：清楚——V2.1 收敛盲点 A-D + S1-S8 之后即 ready-for-implementation
6. **recommendation / commitment 两条 A-minus 主线是否仍保持稳定**：保持；V2 通过 partner / Helm / 客户三方署名硬区分进一步强化 recommendation 可识别边界
7. **下一阶段最该做的 5 件事**：
   1. 用户 / owner 对 4 个 P0 盲点显式决策（特别是盲点 A 与盲点 B，涉及 schema 与 commercial posture）
   2. 起草 V2.1，整合本评审 4 + 8 项收敛
   3. 法务对盲点 D / S3 合规姿态的初步意见
   4. STATUS.md 添加 "Channel Partner Workspace 当前档位：已成形但仍需下一层"（与 §P0-REQ-01 边界声明配合）
   5. 与 V2.3 §7 实施 owner 同步：本切片排在 V2.3 Phase 6 之后还是并行（Round 1 已列出，仍未决策）

## Round 3：Codex × Claude Opus 最终共识

Codex 进一步以当前 repo truth 反驳 V2 / Round 2 中仍可能误导实施的点：

- P0 声称不做 schema / runtime，却把 `WorkspaceClass.PARTNER` 与 `PARTNER_COLLABORATOR` 写成 P0 要求
- 当前 schema 没有 `PARTNER` workspace class，也没有 `PARTNER_COLLABORATOR` role；`TRIAL` / `PAID` 也不是 `WorkspaceClass`
- 当前 `GtmLead` 是 `referrerMembershipId`，且 `lib/gtm-lead/types.ts` 明确 `GTMLead` 不携带 referral / settlement / contribution 字段
- Partner portfolio 不能一边说禁止展示真实 workspace name，一边建议在聚合 readout 显示客户公司名
- 合规段不能在产品需求里直接断言控制者 / 处理者法律关系

Claude Opus 最终接受这些反驳，并形成 V2.1 共识：

1. **三段切分**：P0 offline contract / eval（无 schema、runtime、API、UI、migration）→ P1 internal-only 复用既有 ledger / registry → P2 owner-gated 评估 partner workspace runtime。
2. **归属主账本**：锚定 `SalesReferral -> RevenueAttributionLedger -> PayoutLedger`；`GTMLead` 只作为触发信号；P0 用 `AttributionCandidate` 离线概念承接 fixture。
3. **授权源**：partner-customer 关系必须先有 `PartnerCustomerGrant`，由客户侧 owner / admin / 指定 champion 触发或确认，partner 不可自授权。
4. **Safe DTO**：partner-visible readout 必须来自 `PartnerSafeRecommendationDTO` / `PartnerSafeMustPushDTO` / `PartnerSafeDecisionDTO` 等白名单投影；不得直接 select 原 `Recommendation` / `MustPush` / `Decision` / `SignalEvent` 表。
5. **Portfolio display**：授权 / 邀请页可展示真实 grant；portfolio 聚合 readout 只显示 partner-known display label 或 customer-provided display alias，不恢复真实 workspace name / URL / slug / industry / size。
6. **Salt stability**：salt 稳定范围收窄为单一 `(partnerCandidateId, customerWorkspaceId, grantId)` 生命周期；grant 终结后不跨新 grant 复用。
7. **Nudge 权限**：`accepted_by_customer` / `promoted_to_recommendation` 只能由 `ADMIN` / `OPERATOR` / 显式 customer champion 执行；其他成员只读。
8. **合规口径**：legal-review-required + conservative-by-design；不在产品需求里做控制者 / 处理者法律定性。
9. **降级项**：detailed access trace、retention policy、撤销 grace period、salt rotation runbook、commission tier / rate governance 降 P1；`WorkspaceClass.PARTNER` / `PARTNER_COLLABORATOR` 降 P2。

Codex 已据此把 requirements 修订为 V2.1。Round 3 无剩余 blocker。

## 收尾说明

Codex 在 `06cfbea33` 已 commit V1 + Round 1 review；V2 / V2.1 是本会话本地修改，尚未 commit。建议 V2.1 与本 Round 2 / Round 3 review 一起统一提交，避免在 ready-for-implementation 前留下中间态。

本 Round 2 review 本身**不修改 requirements 内容**——仅作为 V2.1 收敛输入的批判性证据。

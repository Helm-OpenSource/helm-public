---
status: active
owner: helm-core
created: 2026-05-13
review_after: 2026-08-11
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm 实施健康与价值实现需求

日期：2026-05-13
状态：需求共识版
适用范围：Helm 自身租户 / 实施控制面对受控试点客户接入后的实施健康、闭环阻塞和次日承接证据做 read-only、review-first 判断。

## 一句话结论

Helm 需要把“客户已经上线”进一步拆成可复核的实施健康判断：租户是否真的有人在用，主管 / owner / 通知目标是否打通，经营信号是否能推动人跟进，执行结果是否能进入次日承接证据检查。

本需求不是 HR 绩效系统，不是完整 BI，不是自动派工平面，不是 workflow engine，也不是跨租户原文查看器。P0 只建立实施闭环快照、实施动作只读轨迹和承接证据复核队列。

## 评审共识

本需求由 Codex 起草，并经 Claude 两轮独立红队评审后最终 Go，收敛为：

- P0 只做 read-only / review-first 的实施控制面需求，不授权 schema migration、runtime write、API、UI 或自动化执行。
- 所有租户判断只展示 alias、聚合计数、状态、reason code 和 review posture。
- 不展示客户租户真实名称、人员姓名、沟通原文、CRM 原文、会议内容、LLM prompt / output 或私有样本。
- “次日承接证据”只记录是否出现后续信号或人工复核证据，不做因果归因，不声称改善由 Helm 导致。
- 实施动作轨迹只服务 Helm 内部复核，不构成实施人员绩效评分、排名、问责或 HR 决策依据。
- blocked / degraded 不触发自动写入、自动通知、自动派工或自动修改客户租户配置，只进入人工复核。
- reason code 必须是封闭枚举；新增 reason code 需要需求或代码评审，不允许 runtime 动态生成。

## 1. 背景问题

当前 Helm 已能采集客户租户的经营信号，并把部分事项送入审批、行动项和经营记忆。但从实施价值角度，仅知道“信号在跑”还不够。实施负责人必须能回答：

1. 这个租户今天是否比昨天更可用？
2. 是否有真实 active Helm 用户承接系统提示？
3. 经营信号是否映射到正确主管 / owner / 通知目标？
4. Helm 产生的问题是否被人复核、采纳、执行？
5. 主管跟进或执行动作后，次日指标是否出现承接证据？

如果不能回答这些问题，Helm 只能“看见问题”，还不能稳定推动经营改善。

## 2. 与相邻能力的边界

| 相邻能力 | 本需求如何复用 | 明确不合并 |
|---|---|---|
| Helm 自身租户可运营性审计 | 复用 `Goal / Demand -> Work Item -> Owner / Reviewer -> Evidence -> Review / Decision -> Outcome -> Metric` 链路 | 不把所有自身租户 work item 都纳入实施健康 |
| 自身租户信号健康与 LLM 成本控制 | 复用 privacy-safe telemetry、alias/hash、聚合计数、健康状态和 reason code | 不做跨租户健康 BI，不展示成本明细，不做 hard cap |
| Business Advancement trace + ROI gate | 复用 trace、review、boundary、ROI evidence 的离线验收方式 | 不声称 runtime trace collector 或生产因果归因已经成立 |
| 客户接入实施手册 | 把 SOP 中的角色激活、映射、通知、复核和验收转成可检查节点 | 不把完整客户 SOP、客户样本或私有实施路径写入公开需求 |

## 3. P0 对象模型

P0 只包含三个对象，均为需求级 contract。

| 对象 | 作用 | 权限姿态 |
|---|---|---|
| `ImplementationHealthSnapshot` | 判断单个试点租户实施闭环是否健康 | read-only derived view |
| `ImplementerActionTrail` | 记录 Helm 控制面内发生过的实施关键动作 | review-first audit trail |
| `FollowThroughEvidenceReviewItem` | 把“上线但未承接”“有信号但无后续证据”等模式送入人工复核 | review queue, no auto execution |

### 3.1 实施健康节点

`ImplementationHealthSnapshot` 至少覆盖六个节点：

| 节点 | healthy 的最低判断 | blocked / degraded 示例 reason code |
|---|---|---|
| `tenant_activation` | workspace、extension、核心配置处于可用状态 | `tenant_not_active`、`extension_not_ready` |
| `active_helm_users` | 最近窗口内有目标角色实际登录或操作 | `no_active_user`、`role_definition_not_accepted` |
| `owner_and_supervisor_mapping` | 信号 owner、主管、业务 champion 至少能映射到 active 成员 | `owner_unmapped`、`supervisor_unmapped`、`owner_not_active` |
| `notification_targeting` | 通知目标可解析到具体 active 用户或复核队列 | `notification_target_missing`、`notification_unread_streak` |
| `signal_to_review_flow` | 信号进入人工复核，并有 reviewer / evidence / boundary note | `review_queue_backlog`、`missing_reviewer`、`missing_evidence` |
| `execution_to_follow_through_evidence` | 执行或复核结果能进入次日承接证据检查窗口 | `execution_receipt_missing`、`follow_through_evidence_missing` |

状态只允许：

- `healthy`
- `watch`
- `degraded`
- `blocked`
- `not_applicable`

### 3.2 Source Of Truth 与窗口语义

P0 不新增 schema，也不把自身租户可运营性审计的 work item verdict 直接导入实施健康 verdict。实施健康只消费以下派生事实：

- workspace / extension / connector 的当前配置状态。
- self-tenant health 已允许的 privacy-safe telemetry。
- Helm 控制面内已存在的 review / decision / audit reference。
- alias-only execution receipt / follow-through evidence fixture。

如果相邻系统也产生 work item，只能作为 `evidenceRef`，不能覆盖 `ImplementationHealthSnapshot.overallState`。

默认窗口：

| 节点 | 默认窗口 | 允许覆盖 | 说明 |
|---|---|---:|---|
| `tenant_activation` | snapshot point-in-time | 否 | 只看当前 workspace / extension / connector posture |
| `active_helm_users` | 最近 7 个自然日 | 是 | 覆盖值必须写入 fixture / review note |
| `owner_and_supervisor_mapping` | snapshot point-in-time + 最近 7 日 active check | 是 | mapping 存在但 mapped user inactive 仍不能 healthy |
| `notification_targeting` | 最近 3 个自然日 | 是 | 未读 streak 默认 3 日 |
| `signal_to_review_flow` | 最近 2 个自然日 + 当前 backlog | 是 | backlog 超过 24 小时进入 watch，超过 48 小时进入 degraded |
| `execution_to_follow_through_evidence` | D+1 到 D+2 自然日 | 否 | 缺数据只能 unknown / review_required |

`not_applicable` 只允许在该租户明确未启用对应场景时使用，例如未启用某连接器或未进入执行复核阶段。`not_applicable` 必须带 `not_in_tenant_scope`、`connector_not_enabled` 或 `source_unavailable` reason code，不能用于隐藏 degraded / blocked。

`overallState` 的确定性推导规则：

| 节点状态组合 | overallState |
|---|---|
| 任一节点 `blocked` | `blocked` |
| 两个及以上节点 `degraded` | `degraded` |
| 一个节点 `degraded` 或两个及以上节点 `watch` | `watch` |
| 所有适用节点 `healthy` | `healthy` |
| 适用节点全部缺源 | `blocked` |

`topBlockerReasonCodes` 最多 3 个，按节点顺序和状态严重度稳定排序。`recommendedReviewOwnerRole` 只能是单值，并按 `tenant_activation -> owner_and_supervisor_mapping -> notification_targeting -> signal_to_review_flow -> execution_to_follow_through_evidence -> active_helm_users` 选择第一条最高严重度节点；它只表示复核入口，不构成派工。

### 3.3 P0 Reason Code 封闭枚举

P0 reason code 只允许以下值：

| 类别 | Reason codes |
|---|---|
| activation | `tenant_not_active`、`extension_not_ready`、`connector_not_enabled`、`source_unavailable` |
| active users | `no_active_user`、`role_definition_not_accepted` |
| mapping | `owner_unmapped`、`supervisor_unmapped`、`owner_not_active` |
| notification | `notification_target_missing`、`notification_unread_streak`、`default_target_fallback_forbidden` |
| review flow | `review_queue_backlog`、`missing_reviewer`、`missing_evidence` |
| execution / follow-through | `execution_receipt_missing`、`follow_through_evidence_missing`、`follow_through_evidence_unknown` |
| boundary | `not_in_tenant_scope`、`raw_data_forbidden`、`actor_aggregation_forbidden`、`causal_claim_forbidden`、`dynamic_reason_code_forbidden`、`auto_execution_forbidden` |

新增 reason code 必须经过需求或代码评审，不能由 runtime、LLM 或配置动态生成。

## 4. P0 需求

### P0-REQ-01：Implementation Health Snapshot

为每个受控试点租户生成一张实施健康快照。

最低字段：

- `tenantAlias`
- `windowStart`
- `windowEnd`
- `overallState`
- `nodeStates`
- `topBlockerReasonCodes`
- `recommendedReviewOwnerRole`
- `lastReviewDecisionRef`
- `boundaryNote`

验收口径：

- 每个节点必须有状态和 reason code。
- `blocked` / `degraded` 至少能指出一个下一步人工复核 owner role。
- `topBlockerReasonCodes` 不超过 3 个，且排序稳定。
- `recommendedReviewOwnerRole` 是复核入口建议，不是任务分派。
- 不出现真实租户名称、真实人员姓名、邮箱、电话、客户原文或私有样本。
- 不输出排名、绩效分、个人评分或跨租户对比榜。

### P0-REQ-02：Privacy-Safe Data Contract

实施健康只能消费 privacy-safe derived telemetry。

允许字段：

- tenant alias / salted hash。
- 时间窗口。
- 计数、比例、bucket。
- 状态枚举和 reason code。
- review decision reference。
- redacted evidence reference id。

禁止字段：

- 会议标题、转写、摘要、行动项正文。
- CRM 公司、客户、联系人、机会名称。
- 邮箱、电话、用户姓名。
- LLM prompt、raw output、`inputSummary`、`outputSummary`。
- `SignalEvent.signalSummary`、`normalizedPayload`。
- `AuditLog.payload`、`AuditLog.summary`。
- 客户私有样本、真实名单、生产凭据。

验收口径：

- fixture / seed / public docs 一律使用 alias-only 或合成数据。
- public docs 中不得出现任何试点租户真实人名和客户原始内容。
- alias salt 必须是 server-side per-deployment secret，不写日志、不下发客户端；发生泄露事故时必须可轮换。
- alias 稳定性只在同一部署内成立，不作为跨部署、跨客户、跨环境的身份键。
- 任何需要 support snapshot 或跨租户原文查看的能力必须 P1+ 独立立项。

### P0-REQ-03：Implementer Action Trail

记录 Helm 控制面内的实施关键动作，用于复盘“实施链路哪里被推进、哪里卡住”。

允许动作类型：

- tenant 初始化 / extension 启用确认。
- role / owner / supervisor / notification target 配置确认。
- signal review / action review / decision review。
- execution receipt 录入。
- follow-through evidence review。
- boundary / evidence / reviewer 修正。

最低字段：

- `actionTrailId`
- `tenantAlias`
- `sourceWindowKey`
- `actorRole`
- `actionType`
- `workItemRef`
- `reviewDecisionRef`
- `evidenceRef`
- `createdAt`
- `boundaryNote`

验收口径：

- 只记录 Helm 控制面内可审计动作，不抓取外部系统人员行为。
- `actorRole` 必须是去标识化的功能角色或 alias，不使用真实姓名，也不能是 1:1 可反推出个人身份的角色标签。
- P0 禁止按 actor 维度聚合、排序、排行或输出趋势。
- 不存在 `score`、`rank`、`performanceRating`、`penalty`、`blame` 等字段。
- 不能作为 HR 绩效、人员排名或自动问责依据。

### P0-REQ-04：Follow-Through Evidence Review Queue

当实施健康快照发现价值实现断点时，生成人工复核项。

首批触发模式：

- 已启用但最近窗口没有 active Helm 用户。
- 有经营信号但 owner / 主管 / 通知目标缺失。
- 通知已生成但连续未读或未承接。
- 审批 / 行动队列持续堆积。
- 执行结果已出现但没有次日承接证据记录。
- 次日信号没有承接证据，需要人工判断是否阈值、映射或业务行动需要修正。

每条复核项必须包含：

- Helm 怎么看。
- 为什么这么判断。
- 建议下一步。
- 边界说明。
- review owner role。
- no-auto-execution flag。

验收口径：

- 复核项是 derived projection，不要求新表；P0 不授权 schema migration。
- 复核项只进入 Helm 内部实施控制面，不直接暴露给客户租户。
- 复核项不会自动通知客户主管、自动改配置、自动写外部系统或自动关闭问题。
- review 结果只生成 decision record / next review recommendation，不生成 commitment。

### P0-REQ-05：Next-Day Follow-Through Evidence Ledger

把执行结果和次日经营信号放入同一条 review ledger，帮助 Helm 判断“跟进后有没有承接证据”。该 ledger 只表达时间上的后续观察，不表达因果。

最低字段：

- `sourceReviewDecisionRef`
- `executionReceiptState`
- `comparisonWindow`
- `nextDaySignalState`
- `direction`
- `confidencePosture`
- `humanReviewRequired`
- `causalClaimAllowed`

字段限制：

- `causalClaimAllowed` P0 必须恒为 `false`。
- `executionReceiptState` 只能表达 `present`、`missing`、`not_applicable`。
- `nextDaySignalState` 只能表达 `present`、`missing`、`insufficient_window`、`source_unavailable`。
- `direction` 只能表达 `positive_follow_through`、`flat_follow_through`、`negative_follow_through`、`unknown`，不能表达“Helm 导致”。
- `confidencePosture` 只能表达 `evidence_sufficient`、`evidence_partial`、`evidence_missing`，不表达统计因果。
- `executionReceiptState`、`nextDaySignalState`、`direction`、`confidencePosture` 都是封闭枚举，不能由 runtime、LLM 或配置动态生成。
- execution receipt 指 Helm 控制面内经人工复核确认的执行记录或 redacted 外部执行观察，不包含客户原文、真实人员姓名或外部系统 raw payload。

验收口径：

- 没有 execution receipt 时不能生成 positive follow-through 结论。
- 次日数据缺失时必须是 `unknown` 或 `review_required`。
- 任一输出都必须带 non-causality boundary note。
- customer-facing wording 禁止出现“Helm 导致改善”“Helm 推动提升 X%”“执行后指标因 Helm 改善”等因果或功劳归属表达。

### P0-REQ-06：Offline Contract And Boundary Eval

P0 实施前应先补 offline fixture / evaluator，证明需求边界可机械验证。

最低 fixture 覆盖：

- healthy tenant case。
- no active user case。
- owner / supervisor unmapped case。
- notification unread case。
- review backlog case。
- execution receipt missing case。
- follow-through evidence missing case。
- HR scoring overreach negative case。
- raw customer data leak negative case。
- causal ROI claim negative case。
- per-actor aggregation overreach negative case。
- dynamic reason code negative case。
- review queue auto write negative case。
- notification default fallback owner negative case。

硬性 incident counters：

- `rawDataLeakCount = 0`
- `realPersonNameLeakCount = 0`
- `hrPerformanceClaimCount = 0`
- `autoExecutionAttemptCount = 0`
- `autoNotificationAttemptCount = 0`
- `causalClaimCount = 0`
- `crossTenantOriginalTextAccessCount = 0`
- `actorAggregationAttemptCount = 0`
- `dynamicReasonCodeCount = 0`
- `tenantConfigWriteAttemptCount = 0`
- `defaultFallbackOwnerAssignmentCount = 0`

## 5. P1 / P2 需求

P1 / P2 只在 P0 offline gate 通过后继续推进。它们的共同边界是：

- 继续保持 `read-only`、`review-first`、`recommendation != commitment`。
- 继续只使用 alias / salted hash / bucket / reason code / evidence ref。
- 不把实施健康变成 HR 绩效、客户侧健康分、自动派工、自动通知或因果 ROI 声明。
- 任何 support snapshot、客户可见说明、通知或调度集成都必须先通过独立授权和边界评审。

### 5.1 P1 前置条件

P1 进入实现前必须全部满足：

1. `npm run eval:implementation-health`、targeted tests、`npm run check:boundaries` 均通过。
2. Data Protection review 明确允许 reserved workspace 查看哪些 derived fields。
3. founder approval 明确 P1 仍是内部实施控制面，不对客户展示健康分。
4. 实现方案已列出数据来源、字段白名单、审计事件、TTL、撤回路径和回滚方式。
5. public docs / fixture 不包含真实客户名、真实人名、私有路径、原文样本、prompt / output 原文。

### P1-REQ-01：Reserved Workspace Read-Only Implementation Board

在 `HELM_RESERVED` workspace 内提供实施控制面只读看板。看板只能展示：

- `tenantAlias` / `tenantHash`
- 最近一次 `ImplementationHealthSnapshot` 的 `windowKey`、`generatedAt`、`stalenessBucket`
- 5 个实施健康节点的 `nodeStatus`、`reasonCodes`、`evidenceRefs`
- `ImplementerActionTrail` 的聚合状态：是否有 owner、是否有主管映射、是否有通知目标、是否有 reviewed receipt
- `FollowThroughEvidenceReviewItem` 的数量、状态桶和 required reviewer role
- 次日承接证据 ledger 的 bucket 化结果：`improved` / `unchanged` / `worse` / `not_enough_evidence`

看板必须禁止：

- 展示真实客户名、真实成员姓名、真实邮箱、手机号、工单原文、会话原文、CRM opportunity name、客户样本文档路径。
- 跨租户 drill-down 或跨租户原文搜索。
- 在 UI 内提供“指派”“通知”“修改配置”“写回租户系统”“标记绩效”的按钮。
- 把 derived snapshot 解释为客户可见 score、员工评分或因果 ROI。

P1 看板只允许两类操作：

1. 打开内部 review packet。
2. 生成 candidate-only 的人工复核草稿；草稿不能自动发送或自动写入外部系统。

### P1-REQ-02：Support Snapshot 授权流

当实施支持人员需要更细的支持快照时，必须先创建授权记录。授权记录至少包含：

- `tenantAlias`
- `purpose`
- `approvedByRole`
- `allowedFieldSet`
- `expiresAt`
- `revokedAt`
- `auditEventRef`
- `dataProtectionReviewRef`

默认 TTL 不超过 24 小时；特殊支持场景最多 72 小时，必须有 founder approval。授权到期或撤回后：

- reserved board 不再展示 support-only 字段。
- review packet 只能保留 redacted evidence ref，不保留原文。
- audit trail 必须能证明谁授权、谁查看、何时过期或撤回。

Support snapshot 仍不得展示跨租户原文、真实人员绩效、客户样本文档原文、prompt / output 原文或生产密钥。

### P1-REQ-03：实施 Runbook 到 Snapshot 的人工导入

允许实施工程师把人工 runbook 状态导入为 snapshot candidate，但导入工具必须满足：

- 输入 schema 只接受 `tenantAlias`、`windowKey`、`nodeOverrides`、`evidenceRefs`、`reviewerRole`、`boundaryNote`、`sourceRunbookRef`。
- `nodeOverrides` 只能引用 P0 已注册的 node id 和 reason code。
- 原始客户样本、真实人名、真实联系方式、私有路径、外部系统原文必须拒绝导入。
- 导入结果先进入 `candidate`，必须由 required reviewer 确认后才能成为下一次 snapshot 的 derived evidence。
- 导入工具必须可重跑且幂等；同一 `tenantAlias + windowKey + sourceRunbookRef` 不得重复生成冲突候选。

该工具不负责自动解释 runbook，不做 LLM 自动总结，不直接写生产租户配置。

### P1-REQ-04：Review Decision 与 Follow-Through Handoff

P1 可以把 review decision 与次日承接证据连接起来，但只能形成内部复核链：

- review decision 必须有 reviewer role、decision time、evidence refs、boundary note。
- follow-through ledger 只能记录“是否出现次日承接证据”，不得声明“Helm 导致指标改善”。
- 缺少 owner / 主管映射 / 通知目标时，结论必须是 `needs_review` 或 `blocked`，不能自动指定默认 owner。
- 人工确认前，不得把 review decision 写入客户可见页面、外部系统或自动通知队列。

### P1-REQ-05：P1 Offline / Boundary Eval 扩展

P1 实现前必须先扩展 eval cases，至少覆盖：

- reserved board 只读取 `HELM_RESERVED` scope。
- board DTO 不包含 raw customer data、real person names、private paths。
- support snapshot expired / revoked 后字段不可见。
- runbook import 包含 raw sample / private path 时被拒绝。
- board action 只能产生 candidate review packet，不能触发 auto execution / auto notification。
- stale snapshot 必须显示 stale bucket，不能伪装为当前状态。

P1 Definition of Done：

1. P1 eval green。
2. P1 board / import / support snapshot 均有 boundary guard。
3. audit event 覆盖授权、查看、撤回、过期、导入、review decision。
4. public-release guard 不因 P1 新增内容泄露客户私有信息。

P1 No-Go：

- 任何 schema / API / UI 变更绕过 Data Protection review。
- 任何 action 直接变更租户配置或外部系统。
- 任何默认 owner fallback、HR scoring、customer-visible score、causal ROI claim。

### 5.2 P2 前置条件

P2 进入实现前必须全部满足：

1. P1 看板和授权流在内部使用中连续至少 2 个工作日无 raw leak / authority leak。
2. customer-facing wording review 单独通过。
3. workflow / notification boundary review 单独通过。
4. 回滚方案能在不影响 P0 / P1 snapshot 的情况下关闭 P2 趋势、客户可见说明和通知集成。

### P2-REQ-01：趋势图与跨周对比

P2 可以提供趋势读数，但必须满足：

- 趋势维度只限 tenant alias、node status bucket、reason code bucket、review queue bucket、next-day evidence bucket。
- 不展示人员排名、客户排名、实施工程师排名、跨租户排行榜。
- 只表达 observed trend，不表达因果归因。
- 小样本或缺失窗口必须显示 `not_enough_evidence`，不得用线性插值补齐。
- 趋势图默认内部可见；客户可见趋势必须走 P2-REQ-02。

### P2-REQ-02：客户可见实施准备度说明

客户可见说明只能回答“下一步准备度与前置条件”，不能暴露内部判断。

允许表达：

- 已完成的接入前置项。
- 仍需客户或实施团队确认的 prerequisite / dependency。
- 下一次人工复核时间窗口。
- 非承诺型说明：当前判断是 implementation readiness review，不是 SLA、ROI 承诺或人员评价。

禁止表达：

- 内部 blocker、内部人员表现、实施工程师评价、主管缺口、通知目标缺口。
- customer health score、客户排名、与其他客户比较。
- “Helm 已证明带来改善”“Helm 将保证达成某指标”等因果或承诺表述。

### P2-REQ-03：Workflow / Notification 受控集成

P2 可以和调度 / 通知系统做受控集成，但默认只生成 draft 或 review packet。

任何自动化能力必须另行满足：

- 明确 opt-in tenant / workspace / role scope。
- owner-approved template。
- audit event。
- idempotency key。
- rate limit。
- kill switch。
- rollback path。
- human approval before send / dispatch，除非 owner 另行批准更高权限。

继续禁止：

- 自动外发客户消息。
- 自动派工给实施者或业务方。
- 自动修改租户配置。
- 自动写 CRM / 工单 / 钉钉 / 邮件 / 短信。
- 缺少 owner 时自动 fallback 给 founder 或任意主管。

### P2-REQ-04：P2 Offline / Boundary Eval 扩展

P2 实现前必须先扩展 eval cases，至少覆盖：

- trend DTO 不包含 raw data、person name、customer name、private path。
- small sample / missing window 输出 `not_enough_evidence`。
- customer-facing wording 不包含 internal blocker、score、rank、causal claim。
- notification integration 默认只产出 draft，不产生 send / dispatch side effect。
- opt-in / template / audit / idempotency / kill switch 缺失时必须 blocked。

P2 Definition of Done：

1. P2 eval green。
2. customer-facing copy guard green。
3. workflow / notification boundary guard green。
4. P2 功能可按 feature flag 回滚，不影响 P0/P1 snapshot 与 review queue。

P2 No-Go：

- 任何客户可见 score / rank / comparison。
- 任何自动通知、自动派工、自动写外部系统。
- 任何因果 ROI、SLA、效果保证或人员绩效暗示。

## 6. 非目标

本阶段不做：

- HR 绩效系统、人员评分、排名、处罚或自动问责。
- 完整 BI、跨租户 drill-down、客户原文搜索。
- 自动派工、自动通知、自动改配置、自动写外部系统。
- 客户侧实施健康分或客户可见排行榜。
- 因果归因、ROI 自动声明或 public proof。
- schema migration、runtime writer、API、UI 页面或生产 query adoption。
- 把任何试点租户真实人名、客户样本、私有路径写进 public docs / fixture / seed。

## 7. 成功标准

P0 需求进入实施前必须满足：

1. 需求文档和索引已入库。
2. Claude / Codex 评审无剩余 blocker。
3. P0 offline eval 的 fixture、reason code、incident counters 已明确。
4. docs / STATUS 明确当前只处于“已成形但仍需下一层”。
5. `npm run check:boundaries` 不因本需求新增 public-release / boundary 风险。

P0 代码实施完成后才能宣称：

1. offline fixture gate 通过。
2. raw data / HR / auto execution / causal claim incident 全部为 0。
3. public docs 未泄露试点租户私有信息。
4. 不授权 runtime、API、UI、schema 或生产写入的边界仍有效。

P1 进入实现前必须满足：

1. P0 offline gate 已合入且持续 green。
2. P1 requirements 已明确字段白名单、授权流、审计、TTL、撤回和回滚路径。
3. Data Protection review 与 founder approval 明确允许 reserved workspace 内部只读看板。
4. P1 eval cases 已先行定义，覆盖 raw leak、support snapshot revoke、runbook import reject、auto action reject。

P2 进入实现前必须满足：

1. P1 read-only board / support snapshot / manual import 已通过内部 dogfood。
2. customer-facing wording review 通过。
3. workflow / notification boundary review 通过。
4. P2 eval cases 已先行定义，覆盖 trend privacy、customer wording、notification side effect、causal claim。

## 8. 下一步实施切片

P0 已按最小 offline gate 落地。后续建议按以下切片推进：

1. P1-A：先扩展 P1 eval fixture，锁定 board DTO / support snapshot / runbook import 的边界。
2. P1-B：实现 reserved workspace read-only DTO builder，不接 UI action。
3. P1-C：实现 support snapshot grant evaluator / audit contract，先 fixture-backed。
4. P1-D：实现 manual runbook import parser，拒绝 raw data / private path，并进入 candidate review。
5. P2-A：实现趋势 DTO 的 offline eval，不做 UI。
6. P2-B：实现 customer-facing wording guard，先用 fixture copy 验证。
7. P2-C：实现 notification / workflow draft-only boundary eval，不接真实发送系统。

## 9. 四档状态

| 档位 | 条目 |
|---|---|
| 已完整成立 | P0 offline fixture gate、deterministic evaluator、CLI、targeted tests、boundary guard |
| 已成形但仍需下一层 | P1 / P2 requirements、reserved board 字段白名单、support snapshot 授权流、manual runbook import、趋势和客户可见说明的边界 |
| 刻意未做 | HR 绩效、完整 BI、自动派工、自动执行、客户侧健康分、因果 ROI 声明 |
| 风险项 | 与 self-tenant health / operability audit / trace ROI 重叠、reason code 膨胀、误读为人员考核、误读为客户承诺、P2 通知集成误读为自动执行 |

## 10. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-13 | 扩展 P1 / P2 需求：P1 收敛为 reserved workspace read-only board、support snapshot 授权流、manual runbook import 与 review decision / follow-through handoff；P2 收敛为 alias-only 趋势、客户可见准备度说明和 draft-only workflow / notification 集成；补充 P1/P2 前置条件、DoD、No-Go 与 eval 扩展要求 |
| 2026-05-13 | 首版需求共识：根据受控试点租户生产实施评估方法，收敛为 Helm 实施健康与价值实现的 read-only / review-first 需求；吸收 Claude 两轮红队意见并最终 Go，P0 限定为 Snapshot / Action Trail / Review Queue / Next-Day Follow-Through Evidence Ledger 与 offline boundary eval |

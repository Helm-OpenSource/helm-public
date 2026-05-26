---
status: active
owner: Product / Founder Ops / Engineering
created: 2026-05-21
review_after: 2026-06-04
archive_trigger:
  - Founder Operating Mode 被实际 runtime PRD / UI contract / closeout 替代
  - Helm 放弃 founder-led operating loop 作为核心产品能力
  - 本需求被拆分为多个独立产品需求且不再承担总合同
---

# Helm Founder Operating Mode Requirements

## 1. 结论

Founder Operating Mode 是把创始人日常经营动作产品化成 Helm 核心能力：

```text
observe -> judge -> assign -> execute bounded action -> audit -> follow up -> improve Helm
```

它不是聊天助手，也不是自动执行平台。它是一个 workspace-first、judgement-first、review-first 的经营闭环模式，让创始人能够持续看全局、判断问题、拆责任、推进人和系统处置，并把过程中暴露的系统缺口沉淀成 Helm 产品改进。

一句话定位：

> Founder Operating Mode 让创始人拥有一个可审计、可恢复、有边界纪律的经营分身。

当前文件是需求与产品设计合同。它只授权 docs / planning / future implementation breakdown，不授权 schema migration、API、runtime query、UI implementation、跨租户聚合、official write、自动外发、自动审批、自动执行、自动合并租户或 LLM final decision。

## 2. 背景与机会

近期 founder operating loop 已经验证出一个高价值模式：

1. 先检查生产和登录页可达。
2. 读取真实租户经营信号、待审批、ActionItem、AuditLog。
3. 判断信号是否齐全、是否被正确处理、是否有责任人。
4. 能在 Helm 内闭环的事项创建 ActionItem 和审计记录。
5. 对找不到责任人、重复租户、数据治理问题创建决策或治理动作。
6. 发现系统缺陷时直接形成代码修复或产品改进任务。
7. 最后输出经营 readout，明确生产状态、已推进事项、剩余阻塞和下一轮动作。

这个过程的产品价值不在于“AI 回答了什么”，而在于 AI 把创始人的经营注意力变成了可落库、可分配、可复核、可持续改进的系统闭环。

## 3. 目标用户

| 用户 | 需要的超能力 | Helm 必须避免 |
|---|---|---|
| Founder / Owner | 持续看全局、判断经营问题、拆责任、推进闭环 | 黑盒建议、越权承诺、无审计动作 |
| General Manager / COO | 把经营信号落到负责人、SLA 和复核节奏 | 泛 BI 指标堆叠、没有行动承接 |
| Delivery engineer | 看到客户租户是否真正产生价值，反推产品缺口 | 只看代码 / PR，不看真实交付结果 |
| Reviewer / Data Protection | 看清每次判断的证据、边界和外部副作用 | raw data 泄露、跨租户视角混用 |
| Tenant business owner | 在自己的租户里看到业务信号、责任和执行推进 | 被 Helm 替代业务决策或自动外发 |

## 4. 产品范围

### 4.1 包含

| 范围 | 说明 |
|---|---|
| Founder operating run | 每轮扫描生产、租户、信号、审批、动作、审计和产品缺口 |
| Founder judgement | 把“信号齐不齐、处理对不对、责任清不清、是否推进有效”显式化 |
| Responsibility routing | 找得到责任人就生成 owner / due date / risk / action；找不到则升级为 founder decision |
| Operating closure | Signal -> Judgment -> ActionItem -> Owner -> AuditLog -> Follow-up |
| Product improvement capture | 经营中发现 Helm 系统缺口时形成产品改进候选 |
| Tenant value readout | 对 Helm 自身租户和客户租户分别输出价值交付评估 |
| Boundary ledger | 记录哪些动作只是建议、哪些需要审批、哪些永远不能自动做 |

### 4.2 不包含

| 不做 | 原因 |
|---|---|
| 完整 workflow / orchestration 平台 | Founder Mode 只推进经营闭环，不提供通用编排引擎 |
| 自动外发、自动审批、自动承诺 | recommendation != commitment 是核心边界 |
| 自动修改高风险外部系统状态 | 需要明确证据、回滚边界和人工授权 |
| 跨 workspace 自动聚合 | Helm 保持 workspace-first；跨租户只允许 alias / support posture 的受限读法 |
| HR 绩效评分 | 责任路由服务经营推进，不做人员绩效系统 |
| 完整 BI 平台 | 只看能触发判断和行动的经营信号 |
| 删除 / 合并租户自动化 | 数据治理必须走 review / backup / audit |

## 5. 核心对象合同

这些是产品对象，不代表当前必须新增 Prisma schema。Phase 0 / Phase 1 可先用 existing `ActionItem`、`ApprovalTask`、`AuditLog`、`BiReportBusinessSignal`、readout projection 和 fixture 表达。

| 对象 | 作用 | 最小字段 |
|---|---|---|
| `FounderOperatingRun` | 一轮创始人经营循环 | `runId`、`workspaceId`、`scope`、`startedAt`、`finishedAt`、`posture` |
| `OperatingSignalSnapshot` | 本轮看到的经营信号快照 | `signalFamily`、`severity`、`count`、`ownerCoverage`、`evidenceCoverage` |
| `FounderJudgment` | 对经营状态的判断 | `question`、`answer`、`confidence`、`evidenceRefs`、`boundaryNote` |
| `ResponsibilityRoute` | 责任归属结果 | `owner`、`reviewer`、`riskLevel`、`dueDate`、`routingReason` |
| `OperatingAction` | 要进入系统推进的动作 | `title`、`sourceId`、`actionType`、`executionMode`、`status` |
| `DecisionEscalation` | 找不到责任人或需要创始人判断的问题 | `decisionQuestion`、`options`、`recommendedPosture`、`deadline` |
| `ProductImprovementCandidate` | Helm 自身系统缺口 | `gapType`、`evidence`、`impact`、`proposedFix`、`validationPlan` |
| `OperatingReadout` | 本轮复盘输出 | `productionStatus`、`actionsCreated`、`blockers`、`nextSafeAction` |

## 6. Founder Mode 运行循环

每轮固定顺序：

```text
1. production and runtime probe
2. data quality / duplicate / failed run scan
3. Helm tenant operating advancement
4. customer tenant operating advancement
5. responsibility routing and escalation
6. product improvement capture
7. audit consistency check
8. concise operating readout
```

### 6.1 判断问题

每个信号进入 Founder Mode 后必须回答四个问题：

| 问题 | 输出 |
|---|---|
| 这个信号是否齐全？ | 缺 source、缺 evidence、缺 owner、缺 outcome 的具体缺口 |
| 这个信号是否被准确处理？ | accepted / downgraded / duplicate / stale / rejected / needs review |
| 经营是否被有效推进？ | 有无 ActionItem、负责人、SLA、审计、结果回收 |
| 这暴露了什么系统缺口？ | 产品、数据、流程、组织、权限、部署、信号模型缺口 |

### 6.2 拆责任

责任路由规则：

1. 找得到业务责任人：创建或更新 ActionItem。
2. 找得到系统责任人：创建 Helm 产品 / 数据治理 / 部署治理动作。
3. 找不到责任人：创建 DecisionEscalation，要求 founder 或指定 reviewer 判断。
4. 信号证据不足：降级为 watch-only 或 data-quality action。
5. 涉及外部副作用：只生成 review packet，不自动执行。

### 6.3 复核结果

每轮结束必须复核：

| 复核项 | 目标 |
|---|---|
| 重复 `sourceId` | 0 |
| Helm / 目标客户租户 pending approval | 明确数量和归因 |
| ActionItem 状态一致性 | `status`、`executionStatus`、`requiresApproval` 不冲突 |
| AuditLog 覆盖 | 每个创建 / 更新 / 阻断动作都有审计 |
| 外部副作用 | 0 unexpected external side effect |
| 产品缺口 | 已转成 product improvement candidate 或明确 No-Go |

## 7. 光潽租户落地样例

光潽是个贷不良资产管理和催收场景。Founder Mode 不应该只看“有多少信号”，而要判断经营信号版图是否足以管理这家公司。

### 7.1 必要经营信号版图

| 信号层 | 必须回答的问题 | 样例 |
|---|---|---|
| 资产池 / 案件结构 | 哪些资产、账龄、金额段、资方、逾期阶段正在变化 | 公海池、Q2 回款缺口、账龄段变化 |
| 回收结果 | 回款完成率、承诺履约、次日结果是否达标 | Q2 实际回款完成率低于目标阈值 |
| 过程动作 | 触达、跟进、催记、PTP、复催是否按节奏推进 | 过程偏弱、触达偏弱、重复跟进缺口 |
| 风险 / 合规 | 投诉风险、敏感客户、越界话术、质检风险 | 投诉风险连续复核 |
| 人员 / 组织 | 哪些坐席、主管、组长、策略 owner 承担责任 | CRITICAL/HIGH 队列按 owner 压降 |
| 数据质量 | 重复工作区、映射缺失、SLA 缺失、metadata 超限 | 重复空工作区、ActionItem 缺 dueDate |
| 系统交付 | Helm 是否把信号准确转为动作和审计 | ActionItem / AuditLog / readout 一致性 |

### 7.2 光潽首批 Founder Mode 输出

| 输出 | 责任人类型 | 说明 |
|---|---|---|
| open signal triage | 业务 owner | 对 ALERT / WARN / WATCH 分诊 |
| manual queue reduction | 一线 / 主管 owner | 压降 CRITICAL / HIGH 待推进动作 |
| next-day outcome review | 业务 owner | 核实已执行动作是否产生结果 |
| signal coverage map | Helm product owner | 补齐个贷不良经营信号版图 |
| data quality routing | Helm / data owner | 清理路由、SLA、重复 workspace、metadata 限制 |

## 8. Helm 自经营落地样例

Helm 自身租户必须把 Founder Mode 用在 Helm 业务上：

| 经营面 | Founder Mode 要推进的事项 |
|---|---|
| 生产稳定 | health、login、进程、部署路径、zip 校验、回滚路径 |
| 产品质量 | 经营中暴露的系统缺口转成代码 / 文档 / eval / guard |
| 交付价值 | 光潽等客户租户是否形成真实业务闭环 |
| 发布治理 | zip/SFTP 部署流程、`.env` 保留、hash、build、restart、smoke |
| 商业化 | Helm 自身经营租户的候选客户、试跑、复盘、渠道判断 |

## 9. 价值交付评估

Founder Mode 的价值评估不能只看 PR 数、文档数或聊天质量。必须看经营闭环是否真实前进。

| 指标 | 目标 |
|---|---:|
| Signal coverage | 核心经营信号 family 有覆盖，不只看总数 |
| Owner coverage | 进入 Must Push / ActionItem 的事项 owner 覆盖 100% |
| Evidence coverage | high / critical 事项 evidence coverage 100% |
| SLA coverage | high / critical 事项 dueDate 覆盖 100% |
| Audit coverage | 系统动作 audit coverage 100% |
| Duplicate source rate | 0 |
| External side-effect incident | 0 |
| Time-to-owner | CRITICAL <= 24h，HIGH <= 48h |
| Outcome receipt coverage | 已执行动作有结果回收或明确阻断原因 |
| Product improvement conversion | 经营中发现的系统缺口进入产品改进候选 |

## 10. MVP 分期

| 阶段 | 目标 | 交付物 | 禁区 |
|---|---|---|---|
| Phase 0 | 需求收口 | 本文件 + docs index + STATUS | 不做 schema / API / UI |
| Phase 1 | Offline contract | founder run fixture、deterministic evaluator、readout shape | 不读生产 DB，不调用外部系统 |
| Phase 2 | Read-only projection | 从现有 ActionItem / AuditLog / BI signal 投影 Founder Readout | 不创建外部动作，不跨租户聚合 |
| Phase 3 | Controlled ActionItem writer | idempotent sourceId、owner routing、dueDate、audit coverage | 不自动外发，不自动审批 |
| Phase 4 | `/operating` Founder Mode surface | 首屏 Founder Readout、责任队列、产品改进候选 | 不做 workflow engine |
| Phase 5 | Customer tenant playbook | 光潽样例沉淀为可复用 vertical operating pack | 不把客户私有数据进入 public pack |

## 11. 验收标准

P0 / P1 完成后，至少满足：

1. 给定一组 alias-only founder run fixture，能 deterministic 输出 OperatingReadout。
2. 每个 high / critical action 都有 owner、riskLevel、dueDate、boundaryNote。
3. 每个 created / updated / blocked action 都有 AuditLog 或 audit receipt。
4. 找不到 owner 的事项不会沉默丢失，必须进入 DecisionEscalation。
5. 所有外部副作用默认 No-Go，只能生成 review packet。
6. 重复 sourceId、跨 workspace projection、raw secret / credential / PII fixture 均触发 failure。
7. 光潽样例能覆盖资产池、回收结果、过程动作、风险合规、人员组织、数据质量、系统交付七层信号。
8. Helm 自经营样例能覆盖生产、产品、交付、发布、商业化五层信号。

## 12. 四档状态

| 档位 | 条目 |
|---|---|
| 已完整成立 | Founder-led OPC 协议、现有 `/operating`、`/approvals`、`/memory` 基础面、ActionItem / AuditLog 基础对象 |
| 已成形但仍需下一层 | Founder Mode 需求合同、运行循环、对象合同、光潽 / Helm 自经营样例、价值评估指标 |
| 刻意未做 | 自动外发、自动承诺、自动审批、自动执行、完整 workflow / BI / HR 绩效、跨租户自动聚合 |
| 风险项 | 真实 runtime 接入前的权限边界、重复租户治理、外部副作用误触发、经营信号缺 owner / evidence、把聊天结论误当经营结果 |

## 13. 下一步

1. 建 `evals/founder-operating-mode/` alias-only fixture，覆盖 Helm 自经营和光潽个贷不良两类 run。
2. 建 deterministic evaluator，验证 owner / evidence / dueDate / audit / boundary / no side-effect。
3. 定义 `FounderOperatingReadout` TypeScript contract，但暂不接 DB writer。
4. 把当前 `/operating` 的 Signal Flow Map 和 business-loop gap readout 映射到 Founder Mode readout。
5. 设计 Phase 3 controlled ActionItem writer 的 idempotency / sourceId / AuditLog 规则。

## 14. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-21 | 首版：把 founder operating loop 产品化为 Founder Operating Mode requirements，固定对象合同、运行循环、光潽 / Helm 自经营样例、价值评估指标和 phased MVP 边界 |

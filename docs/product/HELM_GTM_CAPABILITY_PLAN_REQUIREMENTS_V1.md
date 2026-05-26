---
status: active
owner: helm-core
created: 2026-04-25
review_after: 2026-07-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm GTM Capability Plan Requirements V1

更新时间：2026-04-25
状态：Requirements Freeze（implementation-planning ready）
本轮范围：把 GTM Operating Layer V2.3 收成可执行的能力计划需求，不进入 schema、API、页面实现、自动外发或结算执行

## 1. 结论

Helm 下一步不应继续开放式扩写 GTM 设想，而应把 GTM 收成一组可规划、可复核、可分期实现的 capability plan。

这份需求的目标是把既有两条线接起来：

1. [HELM_RESERVED_TENANT_GTM_OPERATING_LAYER_REQUIREMENTS_V2_3.md](./HELM_RESERVED_TENANT_GTM_OPERATING_LAYER_REQUIREMENTS_V2_3.md)
2. [HELM_GTM_COMMERCIAL_RESEARCH_FOLLOW_THROUGH_PLAN_V1.md](../reviews/HELM_GTM_COMMERCIAL_RESEARCH_FOLLOW_THROUGH_PLAN_V1.md)

本轮冻结的不是 CRM、营销自动化或 partner marketplace，而是 Helm reserved tenant 自营 GTM 的第一批能力计划：

```text
GTM signal
  -> capability plan
  -> guided intake
  -> customer demand brief
  -> customer confirmation
  -> control line review
  -> diagnostic and first loop
  -> proof pack
  -> internal GTM asset candidate
```

`GTM Capability Plan` 是计划与复核层，不是新的执行授权层。

## 2. 当前主干前提

本需求继承以下 current-main truth：

1. Helm 是 `workspace-first / membership-backed / controlled-trial`。
2. Helm 是 `judgement-first / decision-first / review-before-commitment`。
3. Helm reserved tenant GTM Operating Layer V2.3 已经完成需求冻结，可以进入 implementation planning。
4. Program catalog / application intake / participant portal / manual settlement 已存在第一层 foundation，但仍不是 marketplace、自动 invite、自动打款或公开 partner discovery。
5. GTM 资源收集只能形成 tenant resource candidate，不自动变成 connected resource、governed resource 或 connector platform。

## 3. 目标

本轮需求要完成 6 件事：

1. 明确 GTM 第一批 capability plan 的范围和优先级。
2. 明确每个 capability plan 的输入、输出、owner、review gate 和成功证据。
3. 明确 Phase 1-3 的用户路径，不让 sales-led 与 self-serve 形成两套 intake。
4. 明确 GTM capability 与现有 commercial / program / settlement / tenant resource governance 的边界。
5. 明确哪些能力可以进入实现计划，哪些仍只能停留在需求和 UX 原型。
6. 明确不进入本轮的能力，避免把 GTM 需求误扩成 CRM、marketplace、payment 或 workflow engine。

## 4. 非目标

本轮明确不做：

- 普通客户租户 CRM
- partner marketplace
- public partner ranking / discovery
- 自动外发销售材料
- 自动生成合同、报价或收益承诺
- 自动创建客户 workspace
- 自动接入客户外部系统
- 自动结算、自动打款、股权或分红
- 完整 marketing automation
- 完整 workflow / orchestration platform
- 新 Prisma schema、API、route 或页面实现

## 5. 第一批 Capability Plan

### 5.1 Reserved GTM Readout

回答：Helm reserved tenant 今天最该推进哪些 GTM 对象。

输入：

- existing program / application / referral / contributor / proof / settlement posture
- existing workspace / role / operating readout
- V2.3 中定义的 GTM lead、next action、blocker、outcome posture

输出：

- top 1-3 GTM work items
- waiting review items
- evidence gaps
- next action and owner

review gate：

- 非 reserved tenant 不可见。
- 只读 first，不新增写动作。

验收：

- 第一屏直接展示对象、状态、阻塞、下一步。
- 不用教学文案解释 GTM 方法论。
- 不露出 settlement、contribution 或 internal sales notes 给普通客户租户。

### 5.2 Guided Intake and Demand Brief

回答：sales-led 和 self-serve 如何进入同一份 `CustomerDemandBrief`。

输入：

- lead source
- customer identity
- business pressure tags
- resource tags
- role map
- success criteria

输出：

- `CustomerDemandBrief` draft
- customer-visible summary candidate
- trial initialization payload candidate
- missing information list

review gate：

- `trialInitializationPayload` 进入试用初始化前必须人工复核。
- `internalSalesNotes`、referral、contribution、settlement 信息不得进入客户 workspace。

验收：

- sales-led 客户进入确认和补全，不从空白表单重填。
- self-serve 入口共享同一核心 schema。
- 首次录入目标仍按 V2.3：3 分钟以内、自由文本不超过 30%、必填字段不超过 5 个。

### 5.3 Customer Confirmation and Controlled Rewrite

回答：客户如何确认、补充、申请修改，而不是覆盖内部判断。

输入：

- customer-facing summary
- pending confirmation fields
- customer supplement
- customer request change

输出：

- direct apply minor update
- `CustomerContextUpdateRequest` for material update
- source trace and diff
- downgrade or review result

review gate：

- material rewrite 必须进入 `review_required`。
- 客户不可见 internal review queue、materiality 细节、reviewer judgement 和 settlement / contribution 字段。

验收：

- 客户动作只表达为“确认 / 补充 / 申请修改”。
- 任何涉及 pain tag、control line、key resource、trial premise、owner/reviewer 的改动都不能静默覆盖。

### 5.4 Control Line Evidence Review

回答：痛点如何转成可验证、可复核的第一条经营改善控制线。

输入：

- pain tag
- resource inventory
- evidence readiness
- control-line template

输出：

- `OperatingControlLineCandidate`
- missing evidence guidance
- status: `draft / evidence_needed / review_required / trial_premise / rejected`

review gate：

- `pain captured` 不能直接进入 `trial_premise`。
- `evidence_declared` 或 `evidence_partial` 必须补证或人工 review。

验收：

- 每个核心 pain tag 能关联 1-3 个推荐控制线模板，或明确说明为什么不能转。
- 缺证据时给出“缺什么才能跑第一条控制线”，不是直接终止流程。

### 5.5 Diagnostic and First Loop Starter

回答：这个客户最适合从哪条低风险 first loop 开始。

输入：

- reviewed demand brief
- reviewed control line candidate
- evidence readiness
- role readiness

输出：

- diagnostic summary
- first loop candidate
- review gate
- manual action plan
- verification plan

review gate：

- high-risk action 默认不可自动执行。
- first loop 只能是 `observe -> judge -> prepare -> human review -> manual action -> verify -> learn`。

验收：

- 每个 first loop 都有人工复核点和手工执行方式。
- recommendation 不等于 commitment，diagnostic 不等于成功保证。

### 5.6 Proof Pack and GTM Asset Candidate

回答：试点结果能否变成可复盘、可复用、可对外使用的 GTM 资产。

输入：

- first loop result
- evidence refs
- customer confirmation or internal review
- before / after state

输出：

- proof pack
- public-use boundary
- GTM asset candidate
- claim level

review gate：

- 没有 proof pack 的内容只能是 draft / hypothesis。
- public asset 必须人工审批。

验收：

- 每个 asset 都能追溯到 proof pack 或显式标记为 hypothesis。
- 对外文案保留 boundary / prerequisite / dependency / non-commitment notes。

## 6. 用户路径要求

### 6.1 Reserved Operator Path

```text
reserved operator opens GTM readout
  -> reviews top 1-3 GTM work items
  -> opens lead or application context
  -> starts guided intake or resumes brief
  -> reviews confirmation / evidence / control line gaps
  -> sends to diagnostic planning
```

要求：

1. 第一屏只显示可推进工作，不做概念教育。
2. 详情层再展示证据、解释、风险和边界。
3. audit、contribution、settlement 候选下沉到 reserved-only 二级层。

### 6.2 Sales-Led Prospect Path

```text
sales prefilled brief
  -> prospect registers or accepts trial invite
  -> confirms customer-facing summary
  -> completes missing facts
  -> requests material changes if needed
  -> waits for review when trial premise changes
```

要求：

1. 不让客户重填完整 intake。
2. 不暴露 internal sales notes、referral、contribution、settlement 或 reviewer judgement。
3. material change 必须解释会影响哪些试用前提、控制线或验证条件。

### 6.3 Self-Serve Prospect Path

```text
self-serve entry
  -> lightweight guided intake
  -> demand brief draft
  -> confirmation and authorization
  -> control line review
  -> diagnostic candidate
```

要求：

1. 与 sales-led 共享同一核心 schema。
2. 没有内部预填时从轻量模板开始，不从空白长表单开始。
3. 缺字段可保存 draft，但必须明确阻塞点。

## 7. 与现有系统边界

| 相邻能力 | 本轮关系 | 边界 |
| --- | --- | --- |
| Program Catalog | 可作为 GTM 来源和 partner/referral 入口 | 仍不是 marketplace，不自动 invite |
| Application Review Queue | 可作为 reserved review 输入 | 不等于 customer workspace 创建 |
| Participant Portal | 可显示 self-only contribution posture | 不暴露 GTM internal pipeline |
| Manual Settlement | 只接收未来成熟的 accrual candidate | 不做自动 payout execution |
| Tenant Resource Governance | 接收 resource candidate | GTM 不自动连接系统、不替代 connector governance |
| Dashboard / Operating | 后续可承接 top work item readout | 本轮不改页面实现 |

## 8. MVP 顺序

### Phase 0：Requirements and Plan Freeze

交付：

- 本需求
- V2.3 需求引用
- docs / README / self-check 索引
- GTM boundary guard

完成标准：

- 能说明每个 capability plan 的输入、输出、review gate 和非目标。
- 不进入 schema/API/page 实现。

### Phase 1：Reserved Readout Planning

交付：

- read model design
- reserved-only visibility contract
- seed/demo data inventory
- route and component impact map

完成标准：

- 明确读哪些现有对象，不新增写路径。
- 明确非 reserved tenant 的拒绝路径。

### Phase 2：Guided Intake and Brief Prototype

交付：

- low-fidelity UX spec
- `CustomerDemandBrief` phase contract
- intake question set
- source trace and clean handoff preview

完成标准：

- sales-led 与 self-serve 仍是同一 schema。
- trial payload review gate 明确。

### Phase 3：Confirmation, Control Line and Evidence Review Prototype

交付：

- customer confirmation UX spec
- material rewrite rule table
- control-line template set
- evidence downgrade readout

完成标准：

- pain 不会绕过 evidence 直接变 trial premise。
- material rewrite 不会静默覆盖内部判断。

### Phase 4：Diagnostic, First Loop and Proof Pack Plan

交付：

- diagnostic trigger rules
- first-loop starter contract
- proof pack claim-level contract
- public-use approval boundary

完成标准：

- first loop 只进入人工复核和手工执行姿态。
- proof pack 可以支持 internal GTM asset candidate，但不自动公开。

## 9. 验收标准

### 9.1 产品验收

1. 每个 capability plan 都有明确输入、输出、owner、review gate、evidence 和 non-goal。
2. 第一屏必须回到 top work items，不解释方法论。
3. sales-led 与 self-serve 不形成双 schema、双 intake、双 trial initialization。
4. `CustomerDemandBrief`、`CustomerContextUpdateRequest`、`OperatingControlLineCandidate` 的职责不互相吞并。
5. clean handoff into trial 保留 internal/customer/trial 三层隔离。
6. resource inventory 只形成 resource candidate，不自动进入 connector / trust / capability runtime。
7. proof pack 之前不能生成 public claim。

### 9.2 文档验收

1. `README.md` 和 `docs/README.md` 可索引到本需求。
2. `npm run self-check` 会检查本需求存在。
3. `npm run check:boundaries` 会检查本需求保留非 CRM、非 marketplace、非自动外发、非结算执行边界。

### 9.3 后续实现验收

进入代码实现前必须新增 implementation plan，并至少说明：

- 影响路由和组件
- read model 数据来源
- reserved-only guard
- customer-facing submission surface
- review queue 边界
- rollback path
- targeted tests
- Computer Use / Playwright 验证路径

## 10. No-Go 条件

以下任一项成立，本需求不得进入实现：

1. 需要普通客户租户访问 Helm internal GTM pipeline。
2. 需要把 GTM 做成 CRM replacement。
3. 需要自动外发销售材料、proposal、报价、合同或承诺。
4. 需要自动创建 workspace、自动接资源、自动写客户系统。
5. 需要 marketplace、public partner discovery、partner ranking。
6. 需要自动 payout、自动结算、股权、分红或确定债权。
7. 需要 customer rewrite 静默覆盖 internal judgement。

## 11. 当前分级

### 已经完整成立

- GTM Operating Layer V2.3 需求边界。
- reserved-only、review-first、proof-before-claim、clean handoff 原则。
- Program catalog / application intake / participant portal / manual settlement 的第一层 commercial foundation。

### 已成形但仍需下一层

- Reserved GTM readout。
- Guided intake / CustomerDemandBrief 的 UX 原型。
- Customer confirmation / controlled rewrite 的客户侧路径。
- Control line evidence review 的产品读面。
- Diagnostic / first loop / proof pack 的执行计划。

### 刻意未做

- CRM replacement。
- marketplace。
- payment / payout execution。
- auto-send / auto-commitment。
- schema / API / page implementation。

### 风险项

1. `CustomerDemandBrief` 继续膨胀：必须守住 core handoff 与 derived readout 的分层。
2. Phase 2/3 体验断裂：实现切片可以分，用户路径必须是一条 guided flow。
3. GTM 与 commercial settlement 混写：贡献和应计只能作为未来候选，不是本轮执行结果。
4. 过早行业化：行业 playbook 只能来自 proof pack 或 hypothesis，不改核心对象体系。


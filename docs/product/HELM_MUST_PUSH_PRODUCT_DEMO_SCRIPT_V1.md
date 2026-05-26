---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Must Push Product Demo Script V1

## 状态

```text
Status: product demo script
Scope: Phase 0 / Phase 1A review support
Implementation: not approved
Schema: not approved
Auto execution: not approved
Customer-facing commitment: not approved
```

本文件把 [HELM_BUSINESS_ADVANCEMENT_ARCHITECTURE_V2.1.md](./HELM_BUSINESS_ADVANCEMENT_ARCHITECTURE_V2.1.md) 的第一条试点闭环转成可演示的产品路径：

```text
会议 / CRM / 资源状态 / Ask Helm
  -> AdvancementSignal
  -> AdvancementJudgement
  -> MustPushItem
  -> ReviewRequiredAction
  -> MemoryCandidate / SkillSuggestion
```

Demo 目标不是展示自动化执行，而是展示 Helm 如何更早、更准、更稳地发现经营上必须推进的事，并把证据、边界和下一步准备好。

---

## Demo 定位

一句话：

```text
Helm 是经营推进控制台，不是自动执行 agent。
```

Demo 必须让观看者看到：

1. 系统知道今天最该推进什么。
2. 每个推进项都有证据。
3. 每个推进项都有边界。
4. 高风险动作不会自动执行。
5. 用户确认后，系统把结果沉淀为经营记忆或候选能力。

---

## 演示角色

| 角色 | 关注点 |
| --- | --- |
| Founder / Operator | 今天哪些经营事项必须推进，哪些会影响收入或客户信任 |
| Sales / GTM owner | 哪些机会停滞，哪些客户等待，下一步谁负责 |
| Customer Success / Delivery owner | 哪些承诺超期，哪些交付证据缺失 |
| Reviewer / Approver | 哪些动作必须复核，哪些不能直接对外承诺 |

第一版建议用 Helm 自己的 GTM / 客户成功流程做 demo，不使用真实客户敏感数据。

---

## Demo 数据集

| Demo Object | 来源 | 推进信号 | 期望卡片 |
| --- | --- | --- | --- |
| Atlas Pilot Opportunity | CRM + meeting | 机会 14 天无推进，客户仍在等试点范围确认 | 复核停滞机会下一步 |
| Bright Beauty Implementation | meeting + commitment | 会后承诺今日到期，owner 未更新 | 处理今日到期承诺 |
| Meridian Contract Review | meeting + approval | 合同条款卡在负责人确认 | 确认合同条款负责人 |
| Acme Resource Onboarding | tenant resource | 接入资源存在关键 proof 缺口 | 补齐资源证明材料 |
| Ask Helm repeated intent | Ask Helm | 团队多次询问今天最该推进什么 | 固化今日 Must Push 解释口径 |

---

## 演示流程

### Step 1：打开 Helm Now / Mobile Command Surface

用户看到第一屏：

```text
今天有 4 个必须推进的事项。
最高风险：Bright Beauty 的会后承诺今天到期，客户正在等待确认。
```

页面只展示：

1. Workspace status 一句话。
2. Ask Helm 超级入口。
3. 3-5 个 Must Push 卡片。

不展示：

1. 大面积聊天记录。
2. 完整 CRM 列表。
3. 图表堆叠。
4. 自动执行按钮。

### Step 2：查看第一个 Must Push：会后承诺到期

卡片内容：

```text
Title:
  处理 Bright Beauty 今日到期承诺

Reason:
  昨天会议承诺今天确认试点范围，当前没有 owner 更新。

Evidence:
  - 会议纪要：客户要求今日确认试点范围
  - Commitment readout：dueAt = today
  - Owner update：missing

Primary Action:
  打开会议详情并准备回复草稿

Boundary:
  draft != send。系统只能准备草稿，不能自动对外发送。
```

演示重点：

1. Helm 不是提醒“有任务”，而是解释为什么现在必须推进。
2. 高风险 customer-facing 动作不会自动发送。
3. 用户进入的是复核和准备路径。

### Step 3：查看第二个 Must Push：机会停滞

卡片内容：

```text
Title:
  复核 Atlas Pilot 机会下一步

Reason:
  机会处于 proposal stage 14 天，最近一次会议仍显示客户等待确认。

Evidence:
  - CRM stage: proposal
  - Last activity: 14 days ago
  - Meeting note: customer waiting for pilot scope

Primary Action:
  打开机会详情，确认下一步 owner

Boundary:
  recommendation != commitment。系统不能承诺成交概率或自动改销售阶段。
```

演示重点：

1. Helm 聚合会议和 CRM，不做单源浅提醒。
2. Helm 给出推进建议，不替销售承诺结果。

### Step 4：查看第三个 Must Push：合同决策阻塞

卡片内容：

```text
Title:
  确认 Meridian 合同条款负责人

Reason:
  合同条款已阻塞 3 天，当前没有明确审批 owner。

Evidence:
  - Meeting note: legal term needs owner confirmation
  - Approval queue: no assigned reviewer

Primary Action:
  创建 ReviewRequiredAction 并分派负责人

Boundary:
  explanation != approval。系统只能解释阻塞并准备复核动作，不能自动审批。
```

演示重点：

1. blocked decision 默认走 review_required。
2. Helm 把阻塞转成可分派动作，而不是自动做决策。

### Step 5：查看第四个 Must Push：资源证明缺口

卡片内容：

```text
Title:
  补齐 Acme 资源证明材料

Reason:
  租户资源接入后，关键 proof 缺失会影响后续管理动作是否可执行。

Evidence:
  - Resource readout: missing proof
  - Required evidence: customer authorization / legacy system execution proof

Primary Action:
  打开资源 readout，分派证明补齐 owner

Boundary:
  proof != external write success。证明补齐前不能把旧系统动作写成已执行。
```

演示重点：

1. 资源接入后生成的管理动作仍受 proof 和 review 边界约束。
2. 老系统执行不被 Helm 误写成已经完成。

### Step 6：Ask Helm 询问“今天最该推进什么”

用户输入：

```text
今天最该推进什么？
```

移动端或桌面返回：

```text
Judgement:
  先处理 Bright Beauty 的到期承诺，然后复核 Atlas Pilot 的停滞机会。

Reason:
  Bright Beauty 有明确客户等待和今日到期承诺；Atlas Pilot 已 14 天无推进，会影响试点转化。

Primary Action:
  打开 Bright Beauty 会议详情

Boundary:
  Ask Helm 只解释和导航，不自动发送客户消息。
```

演示重点：

1. Ask Helm 不是聊天产品，而是进入经营推进面的自然语言入口。
2. Ask Helm 的答案必须回到 Must Push / deep link / review action。
3. Ask Helm 不持久化多轮聊天历史。

### Step 7：用户确认一个动作

用户点击：

```text
准备回复草稿并提交复核
```

系统产生：

```text
ReviewRequiredAction:
  type: customer_reply_draft_review
  source: Bright Beauty meeting follow-up
  status: pending_review
```

系统不得产生：

```text
sent_email = true
customer_commitment = true
official_write_success = true
crm_stage_changed = true
```

演示重点：

1. ReviewRequiredAction 不是已执行。
2. draft 不是 send。
3. 复核通过后才能进入下一步。

### Step 8：沉淀经营记忆和候选能力

复核后，系统可以准备：

```text
MemoryCandidate:
  "Bright Beauty 试点范围确认流程需要 owner 在会后 24 小时内回应。"

SkillSuggestion:
  "会后客户等待确认 -> 准备回复草稿 -> 提交复核"
```

演示重点：

1. MemoryCandidate 仍需复核，不是自动写入 official memory。
2. SkillSuggestion 不是 formal skill，不代表自动执行权限。
3. Helm 从每次推进中学习，但不越过治理边界。

---

## 演示验收标准

产品验收：

1. 用户 5 秒内能看出今天最该推进什么。
2. 默认展示 1 个最高优先级和最多 4 个 Must Push。
3. 每个 Must Push 都有 title、reason、evidence、primaryAction、boundary。
4. 高风险项必须显示 boundary note。
5. Ask Helm 回答必须带 primary action。
6. out-of-scope 请求不能展示误导性卡片。

技术验收：

1. 不新增 schema。
2. 不新增 execution authority。
3. 不新增 official write。
4. 不跨 workspace 查询。
5. 不引入 conversation history persistence。
6. 不引入新 vector store。
7. Must Push 排序 deterministic。

边界验收：

1. recommendation != commitment。
2. explanation != approval。
3. draft != send。
4. proof != external write success。
5. Ask Helm != chat product。
6. Must Push != auto execution。

---

## 常见质疑与回答

### 质疑 1：这不就是待办列表吗？

不是。待办列表通常来自人工创建任务，Helm Must Push 来自跨会议、CRM、资源状态和 Ask Helm 的经营推进信号，并且每个推进项必须带 evidence、reason、boundary 和 primary next step。

### 质疑 2：为什么不直接让 AI 执行？

因为当前阶段最重要的是信任。企业客户真正担心的是 AI 自动得不可信、不留证据、不知边界、出了问题没人负责。Helm 第一阶段先解决“更早发现和准备推进”，Phase 5 才考虑 narrow Skill execution pilot。

### 质疑 3：大厂 agent 平台也能做这个吗？

大厂平台能提供 agent、工具、治理和企业系统入口，但不天然知道某个经营团队今天最该推进什么。Helm 的差异在于把跨系统经营输入压缩成可复核的 Must Push，并持续沉淀判断、边界和候选能力。

### 质疑 4：会议 AI 也能生成行动项，Helm 有什么不同？

会议 AI 的终点通常是总结和行动项。Helm 把会议作为 signal 和 evidence 来源，再结合 CRM、资源状态、Ask Helm 和经营记忆，输出经过边界约束的 Must Push 和 ReviewRequiredAction。

---

## 下一步

1. 用本 demo script 对齐产品、工程、GTM 和专家评审口径。
2. 基于 [HELM_ADVANCEMENT_SIGNAL_FIXTURE_PACK_V1.md](./HELM_ADVANCEMENT_SIGNAL_FIXTURE_PACK_V1.md) 替换 demo 数据为真实脱敏样本。
3. 先做静态 IA / prototype 评审，不进入 runtime implementation。
4. 只有当 Must Push precision、boundary 表达和 Time-to-Trust 通过评审，才进入 Phase 1B read-model feasibility。

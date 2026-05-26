---
status: active
owner: helm-core
created: 2026-04-09
review_after: 2026-07-08
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_DEFINITION_ASSIST_BASELINE_V1

## 1. 目标

冻结一条很窄的 `Definition Assist v1` truth：

- 已存在公司可以生成 `Company Definition Suggestion`
- 系统内置 `Role Preset Library`
- 当前成员可以基于角色预设生成并接受 `Member Definition Draft`

这条能力只回答“如何给定义层一个更好的起点”，不把 Helm 写成完整 soul platform、战略平台或 KPI 平台。

## 2. 当前已成立

### 已经完整成立

- 公司详情页可以基于官网线索与内部经营信号生成 `Company Definition Suggestion`
- suggestion 会显式保留：
  - `identity`
  - `offering`
  - `customerType`
  - `stageGuess`
  - `operatingConstraints`
  - `likelySuccessDefinition`
  - `likelyRiskDefinition`
  - `evidenceRefs`
  - `confidence`
  - `boundaryNote`
- 公司 suggestion 与 accepted definition 都落到 `Company` 上的窄 JSON 字段，不引入新的 canonical company object
- 系统内置一批常见角色预设：
  - Founder / CEO
  - Sales lead
  - Account executive
  - Recruiter
  - Customer success
  - Delivery lead
  - Product / design / engineering
  - Operations / finance / support
  - General operator
- 当前成员可以在 `settings` 里选择角色预设、生成个人定义草稿、编辑后接受为 active member definition
- setup wizard 与 settings 的成员邀请表单已经支持角色预设，新增成员时会自动生成 member definition draft

### 已成形但仍需下一层

- accepted company definition 目前主要进入 company detail readout，还没有大范围注入 recommendation / retrieval / briefing
- member definition 目前主要进入 `settings` 和邀请流，还没有进入统一 workspace operating foundation summary
- 官网尽调目前只做 `official website title / meta description / heading` 这一层最小扫描，不是完整在线研究引擎

### 刻意未做

- 不新增 `CompanySoul / RoleSoul / MemberSoul` 独立平台层
- 不自动生成 Goal / KPI / policy
- 不自动把 suggestion 升格成 canonical truth
- 不对外自动发送，也不生成 customer-facing commitment
- 不做人格画像式个人推断

### 风险项

- 公开网页信息稀薄或同名公司时，suggestion 仍可能偏保守或不完整
- 当前 accepted definition 的系统级消费面还较窄，价值主要体现在 onboarding / detail / settings
- 角色预设是强起点，不是组织真实角色架构；团队仍需要人工改写

## 3. 边界

`Definition Assist v1` 必须继续保持：

- suggestion 不等于 truth
- role preset 不等于权限
- explanation 不等于 commitment
- member definition 不等于 KPI contract
- company definition suggestion 不自动改写 goal / campaign / policy / external wording

任何可能被误读成外部承诺的内容，仍必须保留：

- boundary
- prerequisite
- dependency
- non-commitment

## 4. 入口

- 公司定义建议：`/companies/[id]`
- 当前成员定义：`/settings`
- 新成员角色预设：`/setup` 与 `/settings`

## 5. 下一层最合理的方向

1. 把 accepted company / member definition 窄接到 briefing / retrieval 注入
2. 给更多 detail / handoff surface 读到 accepted definition
3. 增加 very-narrow 的 official-source-first 在线尽调来源
4. 让角色预设与 workspace profileType 更稳定对齐
5. 再评估是否值得引入 canonical `DefinitionDelta / review queue`

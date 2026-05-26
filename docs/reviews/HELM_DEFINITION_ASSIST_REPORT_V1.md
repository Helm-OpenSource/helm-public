---
status: archived
owner: helm-core
created: 2026-04-09
review_after: 2026-10-06
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_DEFINITION_ASSIST_REPORT_V1

## 1. 本轮目标

把“公司定义建议 + 角色预设 + 个人定义草稿”做成一条窄的可执行闭环，而不是停在讨论层。

## 2. 本轮交付

### 代码与产品面

- `Company` 新增：
  - `definitionSuggestionJson`
  - `definitionSuggestedAt`
  - `definitionAcceptedJson`
  - `definitionAcceptedAt`
- `Membership` 新增：
  - `rolePresetKey`
  - `definitionDraftJson`
  - `definitionAcceptedJson`
  - `definitionAcceptedAt`
- 新增 `lib/definitions/role-presets.ts`
- 新增 `lib/definitions/member-definition.ts`
- 新增 `lib/definitions/company-definition.ts`
- 公司详情页新增 `Company Definition Assist` 卡片
- settings 新增当前成员的 role preset / working definition 卡片
- setup wizard 与 settings 的成员邀请表单新增 role preset 选择

### 测试

- `lib/definitions/member-definition.test.ts`
- `lib/definitions/company-definition.test.ts`

### 文档 / 守卫

- 新增本 baseline
- 新增本 report
- README / docs 索引同步
- self-check / pilot-readiness / boundary-check 同步

## 3. 当前结论

### 已经完整成立

- 公司可以得到一版 evidence-backed、editable、review-first 的定义建议
- 当前成员可以选择常见角色预设并生成/接受个人定义
- 新成员邀请不再从纯空白 title 开始，而是可以从角色预设起步

### 已成形但仍需下一层

- accepted definition 还没有广泛进入 recommendation、briefing、retrieval 主链
- 公司尽调还只做最小 official-site scan
- 角色预设还没有变成统一 role handoff / operating summary 的核心输入

### 刻意未做

- 不做完整 Soul system
- 不做 canonical KPI object
- 不做自动 goal / policy 改写
- 不做自动对外 commitment

### 风险项

- suggestion 的质量受官网质量和内部信号密度影响
- 当前 UI 主要集中在 company detail / settings / setup，消费面仍有限
- 如果后续要进入 retrieval，需要再补更清楚的 trust / apply discipline

## 4. recommendation / commitment 边界

本轮继续保持稳定：

- recommendation 不等于 commitment
- suggestion 不等于 truth
- role preset 不等于 authority
- member definition 不等于 KPI contract
- company definition assist 不自动改变 external wording

结论：recommendation / commitment 两条 `A-minus` 主线未被破坏。

## 5. 下一阶段最该做的 5 件事

1. 把 accepted definition 窄接到 briefing / retrieval
2. 把 current member definition 接到 settings / dashboard foundation readout
3. 增加 official-source-first 的更多轻量尽调输入
4. 给 company/member definition 加 very-narrow review trace
5. 再评估是否值得做 `DefinitionDelta` 而不是直接扩平台

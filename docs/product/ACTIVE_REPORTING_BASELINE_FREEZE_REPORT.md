---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# ACTIVE_REPORTING_BASELINE_FREEZE_REPORT

## 当前基线定义

当前版本的 active reporting mechanism 已经冻结成一版最小可复用基线。它回答的不是“页面上怎么摆提示”，而是 Helm 如何把已经看见的变化、已经完成的准备、需要用户拍板的事项，主动送到正确的人面前。

## 冻结的核心语义

- `activeReportType`
- `activeReportSummary`
- `activeReportReason`
- `activeReportPriority`
- `activeReportBoundary`
- `activeReportDecisionRequest`
- `activeReportWorkerSummary`
- `activeReportEvidenceSummary`
- `activeReportAudience`
- `activeReportDeliveryMode`

## 当前成立程度

### periodic report

- 已成立。
- 当前代表：首页 founder 今日经营简报。
- 适合首页简报和页头 briefing。

### event report

- 已成立。
- 当前代表：机会进入 proposal / package shaping window。
- 适合对象页的主动提醒和协作窗口。

### request report

- 已成立。
- 当前代表：worker internal draft 已准备好，等待 review / approval。
- 适合 decision request 和 review request。

### judgement-first summary

- 已成立。
- 当前页面默认先给 summary / reason / preparation / decision request，而不是先平铺对象列表。

### priority / boundary / audience / evidence

- 已成立。
- `priority`、`boundary`、`audience` 已固定为 secondary summary。
- `evidence` 已固定进 evidence drawer，而不是默认平铺在主界面。

### operator-facing / training-facing / acceptance-facing / delivery-facing

- 已成立。
- 页面原文、demo script、manual acceptance 和 delivery boundary 已能复用同一套主动汇报语言。

## 当前版本基线

1. `periodic / event / request` 三类 active report 已固定。
2. `home-brief / event-alert / decision-request` 三类 delivery mode 已固定。
3. judgment-first summary、worker summary、decision request、evidence drawer 的主次关系已固定。
4. internal preparation 与 external-safe boundary 的区分已固定。

## 只适合当前基线、不应夸大的地方

1. 当前不是完整 notification center。
2. 当前不是 BI 平台。
3. 当前不是 full event bus。
4. 当前不是跨所有页面的统一提醒流。

## internal-only / 页面 / 请求流边界

### 只适合 internal-only

- policy 细节
- builder diagnostics
- 更深的 approval gating 解释

### 可以进入页面、提醒、请求流

- judgement-first summary
- why now
- Helm already prepared
- decision request
- boundary summary
- evidence summary

### 必须继续保持 controlled-trial 口径

- customer-facing follow-up 资产仍然需要 review / boundary / approval。
- 任何 customer-visible wording 仍不能绕开 commitment boundary。

## 下一层候选

1. 真正的事件提醒入口。
2. 更完整的 inbox / meetings / contacts / companies 主动汇报面。
3. customer success / expansion review 的主动汇报链。

## 刻意未做

1. 完整 notification center。
2. 完整 BI / analytics front plane。
3. 完整自动执行汇报平面。

## 结论

- active reporting mechanism 当前基线已经清楚。
- periodic / event / request 三类汇报表达已经足够稳定可冻结。
- 后续扩展可以继续沿着这套协议前进，而不需要推翻当前模型。

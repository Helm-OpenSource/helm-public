---
status: archived
owner: helm-core
created: 2026-04-01
review_after: 2026-09-28
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Role / Audience Baseline Freeze Report

## 已冻结的内部角色

- founder
- sales
- delivery
- customer success
- recruiting
- partner
- billing admin
- owner
- admin
- operator
- reviewer
- member

## 已冻结的外部 audience

- customer
- prospect
- partner
- trial organization
- paid organization
- candidate
- custom service stakeholder

## 已冻结的 role / audience 判断语义

### 谁拍板

- Founder / Owner 继续承担默认高层拍板语义
- Billing Admin 继续承接 billing / lifecycle / renew / restore 语义
- Reviewer / Operator 继续承接 review-before-send、approval、执行前检查语义

### 谁接手

- Sales 承接 lead、follow-up、proposal、offer、conversion
- Delivery 承接 walkthrough、activation、review、risk clarification
- Customer Success 承接 issue、follow-through、expansion、renewal risk
- Recruiting 承接 candidate fit、next interview、offer readiness
- Partner 承接 fit、custom delivery、customer matching、dependency risk

### 谁 review / 谁执行

- reviewer / operator / founder / owner 会继续在不同 risk boundary 下承担 review 语义
- role handoff 负责把“下一步该谁接手”讲清楚
- worker / skill / resource 继续只服务这些 handoff，不替代 role owner

## customer-facing / internal-only 分层

- customer / prospect / partner / candidate 的对外表达继续必须保留 boundary
- founder / sales / delivery / customer success / recruiting / partner 的 prep、judgement、memory、trace 继续允许 internal-only
- review-before-send 与 non-commitment 继续是 role / audience layer 的硬边界

## 已成立的 role scene

- Founder / Sales / Delivery / Customer Success / Recruiting / Partner handoff surfaces
- Founder / Sales / Delivery / Customer Success 第二层 variants
- billing admin / owner / admin / operator / reviewer / member 的组织语义

## 仍待下一层的部分

- 更细的 per-role decision policy
- 更细的 per-audience wording contract
- 更细的 permissions / IAM 差异化

## 当前基线结论

Role / Audience Layer 当前已经足够冻结。
它不再只是 scattered role labels，而是一套可影响页面表达、handoff、sendability、decision request 与 internal-only / customer-facing 分层的正式 baseline。

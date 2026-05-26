---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Conversation Detail Chain Extension Report

## 结论

Batch 5 当前选择接入 unified conversation chain 的 3 类页面是：

- contacts detail
- companies detail
- meetings detail

这次不是把它们重写成全新的对象体系，而是在现有对象详情页上方补了一层 judgement-first chain frame，让用户先看到：

- Current Judgement
- Why it matters
- Helm did
- Decision / collaboration request
- Boundary note
- Action rail
- Evidence drawer
- prev / next / handoff

## 本轮落地

新增共享模型与视图：

- `features/conversation-chain-extension/detail-model.ts`
- `features/conversation-chain-extension/detail-view.tsx`

接入页面：

- `app/(workspace)/contacts/[id]/page.tsx`
- `app/(workspace)/companies/[id]/page.tsx`
- `app/(workspace)/meetings/[id]/page.tsx`

统一导航补齐：

- `company-detail`
- `contact-detail`
- `meeting-detail`

## 当前成立的链路

当前至少已经成立：

- package / conversation -> company detail
- company detail -> contact detail
- conversation / company detail -> contact detail
- contact detail -> sales follow-up
- contact detail -> meeting detail
- contact detail / company detail -> meeting detail
- meeting detail -> delivery review
- meeting detail -> delivery walkthrough

## 仍然保留的边界

- 这仍是 unified chain 的局部扩展，不是完整 CRM / communications graph
- 这仍不是全站所有对象详情页都已经 judgement-first
- 当前仍默认以 recommendation、review、boundary、decision request 为主
- recommendation 不等于 commitment

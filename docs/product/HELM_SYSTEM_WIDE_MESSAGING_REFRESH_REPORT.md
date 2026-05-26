---
status: archived
owner: helm-core
created: 2026-04-01
review_after: 2026-09-28
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm 全系统页面表述升级报告

## 本轮目标

这轮不是新增业务能力，而是把首页已经确定下来的商业表达，继续压到整套系统的核心页面里。

目标只有一件事：

- 让用户在首页、今日工作台、经营总盘、角色接手页、客户成功页、设置页和关键详情页里看到的是同一套产品语言

这套语言必须更像正式商用产品，而不是内部设计说明或开发术语。

## 本轮覆盖的页面与模块

### 公开入口与首页延伸

- `app/page.tsx`
- `features/auth/login-panel.tsx`

### 首页 / 工作台 / 经营总盘

- `features/dashboard/goal-driven-home-surface.tsx`
- `lib/operating-system/goal-driven-home.ts`
- `features/internal-operating-workspace/internal-operating-home.tsx`
- `lib/internal-operating-workspace/foundation.ts`

### 角色接手与客户成功

- `features/internal-operating-workspace/role-handoff-surface.tsx`
- `features/customer-success-handoff/queue-view.tsx`

### 关键详情骨架

- `components/shared/detail-operating-summary-card.tsx`
- `components/shared/reporting-protocol-panel.tsx`
- `components/shared/page-header.tsx`
- `features/role-conversation-variants/detail-shell.tsx`
- `features/conversation-detail/detail-view.tsx`

### 初始化与设置

- `features/settings/setup-wizard.tsx`
- `features/settings/settings-client.tsx`

### 高频动作模板

- `lib/operating-system/action-templates.ts`

## 主要改动

### 1. 把“系统内部语言”改成“客户听得懂的话”

以下表达被系统性收紧：

- `AI Brief` -> `重点简报`
- `Current operating summary` -> `当前局面摘要`
- `Boundary posture` -> `当前边界`
- `Action template packs` -> `常用动作模板`
- `Role-specific scenes` -> `常见接手场景`
- `Retro -> memory / goal / campaign` -> `复盘与推进结果回写`
- `Source drilldown / trace / handoff` 等薄技术词 -> `查看依据 / 来龙去脉 / 当前交接说明`

### 2. 把角色、对象、场景标题收成更自然的中文

这轮把高频中文标签进一步统一为更适合中国 B2B SaaS 的写法，例如：

- `Founder / Sales / Delivery / Customer Success / Recruiting / Partner`
  -> `创始人 / 销售 / 交付 / 客户成功 / 招聘 / 伙伴`
- `Lead / Candidate / Workstream`
  -> `线索 / 候选人 / 经营主线`
- `Sales follow-up variants`
  -> `销售跟进场景`
- `Delivery review variants`
  -> `交付复核场景`
- `Customer success issue / escalation variants`
  -> `客户成功问题 / 升级场景`

### 3. 把页面解释改成“结果导向”

这轮不再让页面优先解释系统结构，而是优先解释：

- 现在最该处理什么
- 为什么是现在
- 该由谁接手
- 下一步怎么推
- 哪个边界不能跨

### 4. 把高频 next action 模板也改成正常人会用的话

动作模板现在更像业务动作模板，而不是系统配置项，例如：

- `跟进动作`
- `复核申请动作`
- `升级处理动作`
- `方案 / 报价下一步动作`
- `招聘下一步动作`
- `伙伴推进动作`

并同步把 owner / boundary / prerequisite / evidence 的中文解释改成更自然的业务表述。

## 对用户的直接影响

现在用户在跨页面使用 Helm 时，更容易理解：

1. Helm 到底在帮他推进什么
2. 这页为什么重要
3. 现在该由谁接手
4. 下一步动作在哪里
5. 什么是建议，什么还不是承诺

这会直接减少两类摩擦：

- 看懂页面但不敢动
- 看懂一页却在切到下一页时重新迷路

## 本轮刻意没做的事

这轮没有：

- 重写整站 IA
- 新增业务对象
- 新建营销专题页
- 把所有历史文档统一重写
- 把每个页面都做成完全不同的文案系统

本轮做的是：

- 把最核心、最常被看到、最容易暴露内部语言的页面先统一口径

## 仍然保留的边界

- 这仍然不是完整营销官网重做
- 这仍然不是完整品牌系统升级
- 这仍然不是完整内容策略平台
- `recommendation != commitment` 仍然必须显式可见
- 高风险对外动作仍然不能因为文案变顺就被写成默认可发

## 验证

本轮完成后，继续跑：

- `npm run typecheck`
- `npm run lint`
- `DATABASE_URL='file:./prisma/dev.db' npm run self-check`
- `npm run check:boundaries`
- `npm run build`
- `npm run test`

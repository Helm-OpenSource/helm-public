---
status: active
owner: helm-core
created: 2026-04-08
review_after: 2026-07-07
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business-first Surface Reduction Baseline V1

更新时间：2026-04-08
状态：Implemented
范围：本轮只收紧四张高频经营页面的第一屏表达：`dashboard`、`internal operating`、`customer success queue`、`opportunities`。目标是把最重要的经营动作、阻塞、拍板点和边界前置，把解释性内容、偏好面板和次级摘要下移。

继续保持：`workspace-first`、`controlled-trial`、`judgement-first`、`decision-first`、`recommendation != commitment`、`no auto-send`、`no broad auto-write`、`no execution-authority expansion`

## 1. 目标

本轮只做五件事：

1. 把高频经营页面第一屏从“解释优先”收成“动作优先”
2. 统一第一屏只回答：
   - 现在先做什么
   - 当前最卡的是什么
   - 现在要拍板什么
   - 当前边界是什么
3. 把 guidance、preferences、why-it-matters、secondary summary 等次级解释下移
4. 保持现有模型、权限边界和经营对象体系不变
5. 补 baseline / plan / report / guards / tests / 完整验证链

它不是：

- 新一轮全站 redesign
- workflow automation plane
- execution-authority expansion
- server-side preference sync
- 新的 operating model / 新的数据层

## 2. 已经完整成立

- `dashboard` 第一屏先显示 business-first object summary，再显示最重要动作、阻塞、待拍板事项与接手点
- `internal operating` 第一屏先显示 business-first operating summary，再显示优先事项、立即动作与待拍板事项
- `customer success queue` 第一屏先显示当前局面摘要与边界，队列 / inbox / decision rail 紧随其后
- `opportunities` 第一屏先显示对象操作摘要和主工作区，机会对象焦点与主要经营动作不再被 guidance、protocol 与长解释压住

## 3. 已成形但仍需下一层

- 这轮只收紧了四张最关键经营面，其他 surface 仍保留较多说明性表达
- `opportunities` 的 guidance / preferences / protocol / proactive block 仍存在，但已经整体下移到主工作区之后
- shared design substrate 已可支撑 business-first 减法，但还没有形成统一的“页面首屏预算”规则

## 4. 刻意未做

- 没有引入新的 workspace/server preference sync
- 没有扩 execution authority
- 没有把 explanations 全量删除，只把它们下移
- 没有新增 workflow automation、auto-send、broad auto-write

## 5. 风险项

- 其他 detail-heavy / operator-heavy 页面仍可能延续旧的信息密度
- `PageHeader` 自带的 briefing 仍然偏解释型，后续如继续减法，需要统一收紧 header payload
- 当前只做页面层级重排，还没有建立跨页面的首屏内容预算守卫

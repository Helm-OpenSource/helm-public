---
status: active
owner: helm-core
created: 2026-04-12
review_after: 2026-07-11
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Homepage / Dashboard Messaging Rewrite Plan V1

## 1. 当前状态与本轮目标

当前 Helm 已经有：

- 官方类别名与中国市场表达
- goal-driven home 结构
- `Top 3 immediate moves / blockers / decisions waiting`
- judgement-first / review-first / evidence-first 的页面基线

本轮目标不是推翻这些基础，而是在这条 current-main truth 上继续做两件事：

1. 让首页更快传达用户价值
2. 让 dashboard 第一屏更快进入 judgement / decision / next action

## 2. 结论

本轮计划的核心方向只有一条：

**保留 Helm 现有类别名、边界和 design baseline，只重写首页与 dashboard 的表达层级、首屏 copy 和信息顺序。**

## 3. 不要做的事

本轮刻意不做：

- 不重写总体产品定位
- 不把 Helm 改成 founder-only assistant
- 不引入 consumer AI landing page 风格
- 不扩大 execution authority
- 不把 `AI 可处理` 写成默认可执行
- 不做 broad mobile rewrite
- 不改 route / query ownership

## 4. 受影响组件

首轮建议只覆盖：

- [app/page.tsx](../../app/page.tsx)
- [features/auth/login-panel.tsx](../../features/auth/login-panel.tsx)
- [features/dashboard/goal-driven-home-surface.tsx](../../features/dashboard/goal-driven-home-surface.tsx)
- [lib/operating-system/goal-driven-home.ts](../../lib/operating-system/goal-driven-home.ts)

首轮不强制覆盖，但需要保持兼容的面：

- `setup`
- `approvals`
- `internal operating workspace`
- `role handoff`

## 5. 关键假设

1. 官方类别名 `AI 经营协同操作系统` 继续保留
2. 首页的任务是 acquisition + understanding，不是完整 operating thesis dump
3. dashboard 的任务是 judgement / decision / handoff，不是完整 strategy cockpit
4. `Helm 建议` 与 `你的决策` 需要更显式分层
5. evidence / trace 不删除，只下沉

## 6. 首页改稿方案

## 6.1 首页要优先回答的问题

首页首屏优先回答：

1. Helm 帮团队推进什么
2. 为什么现在需要它
3. Helm 已经能帮你把什么收成下一步
4. 为什么它不会越权替你承诺

首页首屏不要先回答：

- 内部系统抽象结构
- 长段 operating thesis
- 太多 capability inventory

## 6.2 首页建议的信息顺序

推荐结构：

1. 类别名 / 辅助定位
2. 最强主句
3. 一段副标题，直接讲信号 -> 下一步 -> review
4. login / signup / SSO 入口
5. 3 分钟演示或 proof CTA
6. 4 张高信号价值卡
7. role-based 入口
8. boundary / trust note

## 6.3 首页推荐 copy 方向

推荐保留：

- `AI 经营协同操作系统`
- `让 AI 员工和团队围绕目标持续推进`
- `正式复核`
- `经营记忆`

推荐强化：

- `今天最该推进什么`
- `为什么是现在`
- `Helm 先整理建议、依据和边界`
- `你来拍板关键动作`

推荐弱化：

- 纯系统实现口吻
- 过长的 operating 抽象句
- `Bridge / system-led execution` 这类更偏内部叙事的英语感表述

## 6.4 首页 Hero 推荐草案

### 推荐主句 A

`让团队先看清现在最该推进什么`

### 推荐主句 B

`把会议、日程、邮箱和 CRM 里的信号，收成今天能推进的下一步`

### 推荐副标题

`Helm 把分散在会议、日程、邮箱、CRM 和内部系统里的上下文收成同一条推进链，让 AI 先整理建议、依据和边界，再由你拍板关键动作。`

### Founder 入口变体

`给创始人的经营推进台：先看今天最该推进什么，再看哪些事必须由你拍板。`

说明：

- Founder 变体只建议用于 role entry、campaign 卡或 demo 文案
- 不上升为 Helm 总定位

## 6.5 首页能力卡改稿方向

推荐把 4 张高亮卡继续压到价值语言：

1. `今天最该推进什么，一眼看清`
2. `Helm 先整理建议，你来拍板关键动作`
3. `推进过程持续沉淀成经营记忆`
4. `提速，但不越过复核和边界`

## 6.6 首页 CTA 改稿方向

推荐 CTA 组合：

- 主 CTA：`申请 30 天免费试用`
- 次 CTA：`观看 3 分钟演示`

如果继续保留右侧 login panel，不额外堆太多按钮。

重点不是加 CTA 数量，而是把 proof 和理解成本压低。

## 6.7 首页 trust / boundary note

首页建议补一条更显式但不吓人的 trust note：

- `Helm 会先整理建议、依据和下一步；关键动作仍然需要正式复核。`

这条 note 应该出现在：

- hero 附近
- 或 high-signal proof 区块结尾

但不建议把它写成沉重的法律条款式段落。

## 7. Dashboard 改稿方案

## 7.1 Dashboard 第一屏要优先回答的问题

dashboard 第一屏继续固定回答：

1. 当前主战役是什么
2. 现在最该推进的 3 件事
3. 最需要先清掉的 3 个阻塞
4. 需要你拍板的 3 件事
5. 下一步该由谁接手

## 7.2 Dashboard 第一屏建议结构

推荐结构：

1. 当前主战役 / current campaign
2. `现在最该推进的 3 件事`
3. `最需要先清掉的 3 个阻塞`
4. `需要你拍板的 3 件事`
5. `下一步该由谁接手`
6. 其余 chain moves / templates / retro write-back / context 继续下沉

## 7.3 Dashboard copy 改稿方向

推荐把现有标题继续收口成更直接的中文：

- `Top 3 immediate moves` -> `现在最该推进的 3 件事`
- `Top 3 blockers` -> `最需要先清掉的 3 个阻塞`
- `Top 3 decisions waiting` -> `需要你拍板的 3 件事`
- `Who should take over now` -> `下一步该由谁接手`
- `Top 3 chain moves` -> `正在推进的 3 条主线`
- `Common action templates` -> `常用下一步动作`
- `Write-back from review and follow-through` -> `复盘与跟进结果回写`
- `Supporting context` -> `依据与来龙去脉`

## 7.4 Dashboard 卡片合同

dashboard 首轮改稿建议把每张高优先级卡片尽量压成同一套读法：

1. 当前对象 / 事项是什么
2. 为什么是现在
3. Helm 建议的下一步是什么
4. 当前需要谁拍板
5. 边界 posture 是什么
6. 依据在哪里

## 7.5 `Helm 建议` 与 `你的决策` 的显式分层

本轮建议在 dashboard 高优先级卡片里逐步显式化两类信息：

- `Helm 建议`
- `你的决策`

这层分离可以通过以下方式实现：

- 标签
- 二段式说明
- button / CTA grouping
- `review required / ready to review / manual path` posture

不建议通过以下方式实现：

- `AI 可处理`
- `授权 AI 执行`
- 默认 send / execute 语法

## 7.6 Dashboard 需要下沉的内容

以下内容建议继续保留，但尽量不再长期霸占第一屏主位：

- guidance long copy
- system rationale 长段解释
- evidence / trace 大块说明
- `Helm already prepared ...` 这类 system-first 叙述

处理方式：

- disclosure
- secondary panel
- lower fold

## 7.7 Dashboard 移动端窄改稿方向

移动端首轮只建议覆盖：

1. 当前主战役
2. 现在最该推进的 3 件事
3. 需要你拍板的 3 件事
4. approvals 快速入口

当前不建议把完整 supporting context、templates、retro write-back 全部前置到移动端第一屏。

## 8. 实施切片

## 8.1 Slice 1 - Homepage copy and hierarchy

只处理：

- hero
- highlights
- role entry framing
- proof / trust note

不处理：

- 站点级 redesign
- 新 marketing page
- 完整 brand refresh

## 8.2 Slice 2 - Dashboard first-fold rewrite

只处理：

- first-fold 标题
- 列表顺序
- AI suggestion / decision request / boundary wording
- supporting context 下沉

不处理：

- goal-driven home data model 重写
- operating foundation 扩面
- broad mobile redesign

## 8.3 Slice 3 - Adjacent surfaces alignment

如果 Slice 1 / 2 验证通过，再继续看：

- approvals
- setup
- role handoff
- internal operating workspace

## 9. 风险

- 如果首页过度 founder 化，会削弱 role-based workspace 定位
- 如果 dashboard 只做“更像待办列表”，会丢掉 campaign / judgement / boundary 这几层差异化
- 如果为了更强行动感而弱化 review posture，会误伤 `recommendation != commitment`
- 如果只改文案不改 hierarchy，页面仍会显得信息压力过高

## 10. 验证方案

如果后续按这份计划进入实现，默认验证链保持：

```bash
npm run db:reset
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```

页面级补充检查：

- 首页首屏是否能在 5 秒内回答“是什么 / 为什么现在 / 有没有边界”
- dashboard 第一屏是否能在 10 秒内回答“现在推进什么 / 阻塞什么 / 谁来拍板”
- 是否仍然清楚地区分 suggestion、review、manual path、official action

## 11. 交付后应更新的文档

如果后续进入实现并完成页面改稿，应同步检查：

- [HELM_CHINA_MARKET_MESSAGING_V1.md](../brand/HELM_CHINA_MARKET_MESSAGING_V1.md)
- [README.md](../../README.md)
- [docs/README.md](../README.md)
- 相关 page/report docs

---
status: active
owner: helm-core
created: 2026-04-08
review_after: 2026-07-07
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business-first Operator Surface Expansion Baseline V1

更新时间：2026-04-08
状态：Implemented
范围：本轮只把 business-first 首屏 contract 扩到更多 operator-heavy surface，并把“首屏只保留 `对象状态 / 阻塞 / 待决策 / 下一步动作`”抽成共享组件。当前覆盖 `internal operating`、`opportunities`、`approvals`、`imports`，同时把 PR92 已覆盖的 `inbox / reports / diagnostics` 迁到同一 shared summary。

继续保持：`workspace-first`、`controlled-trial`、`judgement-first`、`decision-first`、`recommendation != commitment`、`no auto-send`、`no broad auto-write`、`no execution-authority expansion`

## 1. 目标

本轮只做五件事：

1. 把 `internal operating`、`opportunities`、`approvals`、`imports` 的首屏继续压回 business-first 四类信息
2. 把 `inbox / reports / diagnostics` 迁到共享 summary 组件，减少页面分叉
3. 新建 `BusinessFirstSurfaceSummary`，把四类首屏信息从 label contract 收成共享组件
4. 增强 hierarchy guard 与 e2e，防止 explanation、briefing、guidance 回到首屏前面
5. 同步 baseline / plan / report / README / docs / guards / tests / 完整验证链

它不是：

- 新一轮全站 redesign
- workflow automation plane
- execution-authority expansion
- 新的数据层或 operating model
- server-side preference sync

## 2. 已经完整成立

- `BusinessFirstSurfaceSummary` 已成立，并使用同一条 `对象状态 / 阻塞 / 待决策 / 下一步动作` 共享 contract
- `internal operating` 第一屏已先显示 shared business-first summary，再进入 guidance / preferences
- `opportunities` 第一屏已先显示 shared business-first summary，再进入主工作区与 guidance
- `approvals` 第一屏已先显示 shared business-first summary，再进入 review guidance / assist
- `imports` 第一屏已先显示 shared business-first summary，再进入 connector guidance 和 CSV / CRM 动作
- `inbox`、`reports`、`diagnostics` 已从页面内联 summary 迁到 shared summary 组件，页面不再各自维护一套四类首屏结构
- hierarchy guard 与 e2e 已直接检查 operator-heavy surface 不会把 explanation 放回 summary 之前

## 3. 已成形但仍需下一层

- `customer success queue` 仍使用 detail-specific summary card，而不是这次的新 shared component
- 这轮共享的是四类首屏 contract，不是完整的首屏预算系统
- guidance / preferences / assist 仍然保留，只是被后移到 summary 之后

## 4. 刻意未做

- 没有把 explanation 全量删除
- 没有引入 workflow automation UI
- 没有扩 execution authority
- 没有改模型层、权限边界或对象体系
- 没有做 server-side preference sync

## 5. 风险项

- 仍有未迁移到 shared summary 的页面可能保留旧首屏模式
- 当前 contract 更关注“首屏四类信息 + 顺序”，还没有限制首屏组件总量
- 如果后续新页面不复用 shared summary，首屏解释性内容仍可能回弹

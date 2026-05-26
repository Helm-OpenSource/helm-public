---
status: active
owner: helm-core
created: 2026-04-08
review_after: 2026-07-07
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business-first Surface Contract Hardening Baseline V1

更新时间：2026-04-08
状态：Implemented
范围：本轮只继续收紧 `customer success queue`、`inbox`、`reports`、`diagnostics` 四张高频经营页面的第一屏，并建立更硬的 business-first surface contract。统一首屏只保留 `对象状态 / 阻塞 / 待决策 / 下一步动作` 四类信息，把 guidance、briefing、boundary explanation 和偏好面板继续下移。

继续保持：`workspace-first`、`controlled-trial`、`judgement-first`、`decision-first`、`recommendation != commitment`、`no auto-send`、`no broad auto-write`、`no execution-authority expansion`

## 1. 目标

本轮只做五件事：

1. 收紧 `customer success queue` 的第一屏，只保留四类经营信息
2. 收紧 `inbox` 的第一屏，去掉 header briefing，把 thread judgement 放到 summary 第一位
3. 收紧 `reports` 与 `diagnostics` 的第一屏，把 summary 前置
4. 建立共享的 business-first summary label contract
5. 补 baseline / plan / report / guards / tests / 完整验证链

它不是：

- 新一轮全站 redesign
- workflow automation plane
- execution-authority expansion
- 新 query model / 新数据层
- server-side preference sync

## 2. 已经完整成立

- `customer success queue` 第一屏已收敛到 `对象状态 / 阻塞 / 待决策 / 下一步动作` 四类 summary，`BoundaryNote` 已从第一屏主判断区后移
- `inbox` 第一屏已取消 `PageHeader briefing`，并把 thread operating summary 前置到 guidance 之前
- `reports` 第一屏已先显示 business-first operating summary，再进入 guidance / preferences
- `diagnostics` 第一屏已新增 business-first operating summary，先回答会议回路当前状态、阻塞、待决策与下一步动作
- `getBusinessFirstSummaryLabels()` 已形成共享 summary label contract
- hierarchy guard 已直接检查这四张页面不会把 explanation 放回 summary 之前

## 3. 已成形但仍需下一层

- 这轮只覆盖四张 operator-heavy surface，其他页面仍可能保留更重的解释负担
- guidance / preferences / assist 仍存在，只是从第一屏主判断区后移
- 目前 contract 只约束顺序与四类标签，还没有发展成全站首屏预算系统

## 4. 刻意未做

- 没有把 explanation 全量删除
- 没有引入 workflow automation UI
- 没有扩 execution authority
- 没有改模型层、权限边界或对象体系
- 没有做 server-side preference sync

## 5. 风险项

- 其他 detail-heavy 或 operator-heavy 页面仍可能继续沿用旧 guidance-first 模板
- 当前 contract 更关注“首屏顺序”和“四类信息”，还没有限制首屏组件总量
- 如果后续新页面没有复用这套 contract，页面首屏仍然可能反弹回解释优先

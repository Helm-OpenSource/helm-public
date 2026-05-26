---
status: archived
owner: helm-core
created: 2026-04-11
review_after: 2026-10-08
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# 页面去铺陈化 / 去系统自述化治理方案 V1 报告

## 本轮目标

把 legacy detail 页从“系统先解释、用户再判断”的旧骨架，收口到：

`Current summary -> Pending decision -> Next action -> Boundary -> Review snapshot -> Evidence`

## 已经完整成立

- legacy detail 页已接入 `frontstage / midstage / backstage` 三层合同
- 首屏 4 模块预算已落进 shared hierarchy guard
- `ReviewSnapshotBlock` 已替换 detail 页的 `What Helm already prepared`
- `WhyItMattersBlock`、`EvidenceDrawer`、`WorkerSummary` 默认下沉
- `prepared / reviewed / approved / executed / official` 状态语义已进入共享 review snapshot

## 已成形但仍需下一层

- detail model 内仍有部分旧式 system-first 文案需要继续清理
- 不是所有非 detail 页都已切到这套三层合同
- worker summary 何时因 owner 变化而前置，当前仍主要依赖页面层策略，尚未完全结构化

## 刻意未做

- 不删除 evidence / audit / replay / trace
- 不削弱 boundary / review-first
- 不扩 execution authority
- 不做全站 redesign

## 风险项

- 旧文档和历史 freeze 报告里仍保留 `HelmDidBlock` 叙述，后续需要继续做文档收口
- 某些 detail model 里的 system-first copy 仍可能通过 review snapshot 或 why-it-matters 泄露出来
- 现有 reporting panel 之外的其他页面如果不接 shared guard，仍可能发生回弹

## recommendation / commitment 稳定性

- recommendation / explanation 仍未被提升为 commitment
- prepared / reviewed / approved / executed / official 的区分更清楚，减少了 AI 推断被误读成已完成动作的风险

## 下一阶段最该做的 5 件事

1. 清理 detail model 内剩余的 `Helm prepared` / `already moved` 文案
2. 把 owner-change 结构化为 `WorkerSummary` 的前置条件
3. 把 copy audit 从 detail cluster 扩到更多 repeat-use surfaces
4. 继续把 onboarding 之外页面的默认展开系统解释收口
5. 补一轮针对 representative detail 页的 e2e hierarchy 验证

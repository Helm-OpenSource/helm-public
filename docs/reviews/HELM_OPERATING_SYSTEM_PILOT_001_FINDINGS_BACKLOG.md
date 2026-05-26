---
status: active
owner: helm-core
created: 2026-03-30
review_after: 2026-06-28
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Operating System Pilot 001 Findings Backlog

| ID | Surface | Type | Severity | Observation basis | Summary | Suggested small fix | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P001-01 | approvals | boundary cue / hierarchy | medium | manual observation | 首屏已经清楚讲出边界状态，但 `理由链` 和 skill cue 没有同样前置，第一次阅读更容易先读成“边界队列”而不是“边界 + 理由解释控制台”。 | 只做首屏层级重排或 wording 前置，把 reason-chain cue 提前到 summary 区，不新增能力。 | fixed-verified in Pilot 002 |
| P001-02 | memory | wording / hierarchy | medium | manual observation | 首屏标题仍更像 timeline 理解页，`对象状态底座` cue 存在但不是 first-read 主定位。 | 调整 header / subhead / summary 文案，让 object-state substrate 更前置，不改数据结构。 | fixed-verified in Pilot 002 |
| P001-03 | dashboard + demo banner | rich-vs-thin differentiation / hierarchy | medium | manual observation | demo 引导条和 dashboard 首屏同时承担“当前建议 / 当前所在 / 下一步”解释，首屏层级竞争偏强。 | 保留引导条，但压低它的视觉与文案密度，让 dashboard arbitration headline 和 primary CTA 更先被读到。 | fixed-verified in Pilot 002 |
| P001-04 | collaborator reading pass | observation gap | medium | not measurable yet | 本轮没有第二位真实协作者观察者，当前 collaborator clarity 只能做代理阅读。 | 下一轮真实双人 pilot 引入 collaborator observer；不通过代码改动解决。 | open |
| P001-05 | founder demo path | demo-path / seed-date stability | medium | validation | Founder 全量 e2e 依赖 dashboard 首屏存在 `今日会议` 入口，但当前 case 在当天没有会议时，这个入口会缺失。 | 作为单独 demo-path 稳定性问题处理；不要混进 operating-system pilot 的小修范围。 | deferred-out-of-scope |

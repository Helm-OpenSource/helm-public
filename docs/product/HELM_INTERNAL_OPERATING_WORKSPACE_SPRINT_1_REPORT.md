---
status: archived
owner: helm-core
created: 2026-03-31
review_after: 2026-09-27
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Internal Operating Workspace Sprint 1 Report

## 结论

### 1. Leads / Customers / Candidates / Partners / Workstreams 是否已经进入统一经营对象层

是。当前已经通过 workspace 内现有对象 truth，把这 5 类对象收成统一经营对象层，并能进入首页和 role handoff surfaces。

### 2. 内部经营首页是否已经成立

是。`/operating` 已经成为一张 judgement-first internal operating brief，而不是对象入口集合。

### 3. Founder / Sales / Delivery / Customer Success / Recruiting / Partner 接手面是否已经成立

是。6 类角色现在都有稳定入口和最小可用接手面。

### 4. 会议、决策、任务、复盘是否已经挂回经营链

是。当前对象卡片和 role surface 已经能直接展示最近会议、关键决策、下一步任务、复盘与记忆，并把这些内容重新解释为经营链的一部分。

### 5. 当前 Helm 团队是否已经能开始在 Helm 上经营 Helm

是，但仍是 foundation 级别。它已经足够支撑团队真实在 Helm 里看经营总盘、按角色接手、按链路推进。

### 6. recommendation / commitment 两条 A-minus 主线在本轮是否仍保持稳定

是。当前 internal operating workspace 没有弱化 sendability、review request、boundary、non-commitment 等核心边界。

### 7. 哪些地方刻意未做，为什么

刻意未做：

- 完整 CRM 平台
- 完整 ATS / 招聘平台
- 完整 partner marketplace
- 完整 PM / task management 平台
- 完整 workflow / orchestration engine
- 完整企业 IAM / 多组织 / 多权限平台

原因：

- 这轮目标是让 Helm 团队开始真的在 Helm 上经营 Helm
- 不是再造一层大而全平台

### 8. 下一阶段最该做的 5 件事是什么

1. 为 `/operating` 补更强的 live signal 与 owner freshness。
2. 为 6 个 role surfaces 增加更短的 primary CTA 和 completion feedback。
3. 把 self-serve signup / trial org signal 更明确地喂进 lead lane。
4. 把 candidate / partner lane 的 detail entry 再做轻一点。
5. 为 internal workstream 增加更清楚的 retro / decision timeline。

---

## 短表

| 项目 | 已经完整成立 | 已成形但仍需下一层 | 刻意未做 | 风险项 |
| --- | --- | --- | --- | --- |
| Internal operating objects | 五类对象已进入统一经营对象层 | lead 与 self-serve signup signal 的更强接线仍需下一层 | 不做完整对象平台 | 仍有部分对象是 derived lane |
| Internal operating home | `/operating` 已成立 | live signal / completion feedback 仍需下一层 | 不把 dashboard 全站重写 | 首页可能继续变重 |
| Role handoff surfaces | 6 类角色入口已成立 | 更强的 role-specific reduction 仍需下一层 | 不做完整 role center | 部分角色仍依赖通用 shell |
| Chain attachment for meetings / decisions / tasks / retros | 当前已挂回对象卡片和 handoff 面 | 更长时间线仍需下一层 | 不做 orchestration engine | 目前 attachment 仍是 summary 级 |
| Documentation / guard / test alignment | 已同步 | 后续需要继续跟页面演进更新 | 不做空泛 foundation 文档 | 若后续只改页面不改 docs 会漂 |
| Founder mainline stability | 保持稳定 | 需要更轻的 founder current-action cue | 不改 founder 主线边界 | summary 过多会压节奏 |
| Handoff mainline stability | 保持稳定 | 更轻的切页 handoff 仍需下一层 | 不做 workflow 平台 | 角色页面仍可能偏重 |
| Worker / packs / scenarios compatibility | 当前兼容 | 后续可接更强 worker trace | 不做 marketplace | worker 仍主要作为 supporting layer |
| Enterprise IAM / org admin / full permissions platform | 未做 | 仅保留 foundation compatibility | 刻意未做 | 后续若误扩会偏航 |
| Runtime sandbox | 未做 | 仍保持诚实保留 | 刻意未做 | plugin/runtime 边界仍未解决 |

---

## 总判断

当前这轮最重要的变化，不是多了几个页面，而是 Helm 第一次有了一套真实可运行的 internal operating workspace foundation：

- 对象层统一了
- 首页成立了
- 角色接手面成立了
- 会议、决策、任务、复盘开始回到经营链

所以 Helm 团队现在已经可以开始真的在 Helm 上经营 Helm，但这仍然是第一轮 foundation，不是完整公司 operating system。

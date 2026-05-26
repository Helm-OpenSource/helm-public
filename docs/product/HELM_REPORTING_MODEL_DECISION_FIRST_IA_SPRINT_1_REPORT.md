---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_REPORTING_MODEL_DECISION_FIRST_IA_SPRINT_1_REPORT

## 总结

本轮把 Helm 从“信息堆叠式工作台”推进到第一轮 `Judgement / Action / Boundary / Evidence` 为中心的 decision-first 界面。

已经正式成立的核心是：

- 统一的 Helm Reporting Protocol
- 第一轮 Decision-first IA
- 3 个代表页的真实重构
- 文档、守卫、测试、自检的同步对齐

## 问题逐条回答

### 1. Helm Reporting Protocol 是否已经清楚

是。当前统一协议已经固定为：

- `Current Judgement`
- `Why it matters`
- `What Helm already did`
- `What needs user decision`
- `Available next actions`
- `Evidence drawer`

并已经落到共享类型和共享组件，而不是只停留在文案规范。

### 2. Decision-first IA 是否已经清楚

是。当前第一轮 IA 已明确把 Helm 的心智中心切到：

- judgement
- action
- boundary
- evidence
- worker assignment
- escalation / decision request

同时也明确了顶层推荐阅读结构是：

- 今日经营
- 决策与拍板
- 推进与动作
- 风险与阻塞
- 对外沟通
- Workers
- 证据与回放

### 3. 代表性页面是否已经完成第一轮重构

是。已完成第一轮重构的 3 页是：

1. [`dashboard/page.tsx`](<../../app/(workspace)/dashboard/page.tsx>)
2. [`opportunities-client.tsx`](../../features/opportunities/opportunities-client.tsx)
3. [`approvals-client.tsx`](../../features/approvals/approvals-client.tsx)

它们现在都先给 Helm judgement，再给动作出口和证据下钻。

### 4. 当前 Helm 是否已经更像“AI 经营主体在汇报”

是，且变化已经可感知。

当前页面不再默认让用户先当分析员；Helm 已经开始先说：

- 我怎么看
- 为什么这样看
- 我已经推进了什么
- 现在需要你决定什么
- 你可以直接点什么动作

### 5. recommendation / commitment 两条 A-minus 主线在本轮是否仍保持稳定

是。当前 recommendation 解释链、commitment boundary、approval boundary 没有被打散，反而被更清楚地抬进了默认阅读顺序。

### 6. 哪些地方刻意未做，为什么

- 没有做全站 IA 重写
  - 因为本轮目标是先定协议与模板页，不是一次性推翻所有页面。
- 没有做完整 BI 平台
  - 因为本轮要的是判断和动作，而不是报表系统。
- 没有做完整 workflow / orchestration 平台
  - 因为当前重点是把现有 worker / packs / scenarios 通过汇报协议组织起来。
- 没有把 internal-only builder 细节抬到主视图
  - 因为 decision-first 默认主视图必须先服务主人决策，而不是暴露内部治理噪音。

### 7. 下一阶段最该做的 5 件事是什么

1. 把 contacts / companies / meetings 详情页接到同一套 reporting protocol。
2. 把 inbox / memory 从“已开始汇报”推进到“完整 decision-first page”。
3. 把 CTA 从链接级进一步推进到 inline action handling，但继续保留审批与审计边界。
4. 把 evidence drawer 继续扩展成统一 replay / audit / memory drill-down 规范。
5. 把 Decision-first IA 的导航与命名继续推进到更多页面，但仍避免全站一次性重构。

## 短表

| 项目                                                   | 分类               | 说明                                                                                     |
| ------------------------------------------------------ | ------------------ | ---------------------------------------------------------------------------------------- |
| Reporting Protocol                                     | 已经完整成立       | 共享类型、共享组件、judgement/action/evidence 协议已经明确并已落地到代表页。             |
| Decision-first IA                                      | 已成形但仍需下一层 | 第一轮原语和推荐 IA 已清楚，但导航与更多详情页仍需继续重组。                             |
| Representative page refactor                           | 已经完整成立       | 首页、机会、审批三页已经完成第一轮重构，可作为模板。                                     |
| Documentation / guard / test alignment                 | 已经完整成立       | README、docs 索引、原则文档、pilot docs、self-check、boundary check、regression 已同步。 |
| Founder mainline stability                             | 已经完整成立       | 首页与审批主链没有被打散，反而更容易演示“Helm 先汇报再拍板”。                            |
| Handoff mainline stability                             | 已成形但仍需下一层 | 机会与审批链已稳定，但 meeting / inbox / memory 详情链还要继续统一。                     |
| Worker / packs / scenarios integration                 | 已成形但仍需下一层 | 已进入 reporting 语义，但仍未展开成统一 worker console。                                 |
| Enterprise IAM / org admin / full permissions platform | 刻意未做           | 本轮没有进入完整企业权限平台。                                                           |
| Runtime sandbox                                        | 刻意未做           | 本轮没有进入 plugin runtime sandbox 或资源执行沙箱。                                     |

## 已经完整成立

- 统一汇报协议
- 3 页模板化落地
- shared reporting panel
- evidence drawer 下钻路径
- self-check / boundary check / regression

## 已成形但仍需下一层

- inbox / memory 的完整 decision-first 化
- contacts / companies / meetings 详情页改造
- IA 命名与导航进一步收口
- 更深层 replay / audit / memory 统一钻取

## 刻意未做

- 全站一次性 IA 重构
- BI 平台
- workflow 平台
- agent orchestration 平台
- 企业 IAM / org admin
- sandbox

## 风险项

- 当前仍有不少对象详情页遗留上一代阅读习惯。
- evidence drawer 目前还是第一轮 summary + link，不是完整调查工作台。
- guard 目前主要拦代表页回退，尚未覆盖所有页面。

## 边界保留

以下边界继续诚实保留：

1. `app/` 仍是当前唯一或主要 route owner。
2. `data/queries.ts` 仍是查询聚合入口，只是已经更薄。
3. plugin runtime 仍没有真正 sandbox。
4. 仍存在少量 legacy shim。
5. future-real auth 仍不是完整生产级认证。
6. OpenShell / OpenClaw / NemoClaw 当前仍只是更接近真实 adapter / process 的最小桥接。
7. 当前系统仍不是完整企业级多组织 / 多权限 / 多租户平台。
8. 当前 decision-first IA 仍是第一轮局部落地，不是全站完成重构。

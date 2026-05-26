---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Narrative Components / Decision-first Pages Sprint 1 Report

## 结论

### 1. Narrative Components 是否已经清楚

是。当前已经形成共享 registry、共享组件和最小样式实现，后续页面不必再从零拼装 judgement / action / boundary / evidence。

### 2. 信息层级规则是否已经清楚

是。当前已经固定为 L1 判断层、L2 行动层、L3 边界层、L4 证据层，并明确了默认可见、secondary summary 和 EvidenceDrawer 的分工。

### 3. 代表性页面是否已经完成第一轮重构

是。首页、opportunities、approvals 三页已经完成第一轮 decision-first 改造，并挂上统一 narrative components。

### 4. 当前 Helm 是否已经更像“先判断、先汇报、再推动行动”的人类界面

是，但仍是第一轮。当前三页已经明显从对象堆叠切到 Helm 汇报式页面，用户先收到判断、理由、已推进动作、当前决策请求，再进入动作与证据层。

### 5. recommendation / commitment 两条 A-minus 主线本轮是否仍保持稳定

是。当前 recommendation / commitment 没有被改写成新的对象体系，只是被重新组织进 narrative components 和信息层级里。

### 6. 哪些地方刻意未做，为什么

- 没有重写全站页面，因为本轮只做第一轮代表页模板落地
- 没有新增业务场景，因为目标是收内容协议和结构协议
- 没有把 proposal / package / worker canonical 重新定义，因为本轮只改呈现骨架
- 没有做完整 design system 平台，因为当前只需要最小共享组件层

### 7. 下一阶段最该做的 5 件事是什么

1. 把 contacts / companies / meetings / inbox 接到同一套 narrative components
2. 重做 proposal / package 详情页，让外部表达页也走 decision-first
3. 收紧 internal-only / customer-facing cue 的显示守线
4. 统一 detail drawer 的人类界面结构，减少字段平铺
5. 把更多主动协作请求与 worker assignment 视图挂进同一套模板

## 短表

| 项目 | 已经完整成立 | 已成形但仍需下一层 | 刻意未做 | 风险项 | 说明 |
| --- | --- | --- | --- | --- | --- |
| Narrative Components | 是 |  |  |  | 已有共享 registry、共享组件、共享样式与最小测试 |
| Information hierarchy | 是 |  |  |  | L1-L4 结构、首屏规则、证据抽屉规则已明确 |
| Representative page refactor |  | 是 |  |  | 3 个代表页已完成，但全站尚未完成 |
| Documentation / guard / test alignment | 是 |  |  |  | README、docs、self-check、boundary、tests 已同步 |
| Founder mainline stability | 是 |  |  |  | 首页 founder 主链未被打散 |
| Handoff mainline stability | 是 |  |  |  | approvals / opportunities 仍保留 handoff 语义 |
| Worker / packs / scenarios integration |  | 是 |  |  | 已进入页面主叙事，但还未覆盖所有详情页 |
| Enterprise IAM / org admin / full permissions platform |  |  | 是 |  | 本轮刻意不做，不偏离当前 controlled-trial 边界 |
| Runtime sandbox |  |  | 是 |  | plugin runtime 仍没有真正 sandbox |

## 边界

- 根目录 `app/` 仍是当前唯一或主要 route owner
- `data/queries.ts` 仍是查询聚合入口，只是已经更薄
- plugin runtime 仍没有真正 sandbox
- 仍存在少量 legacy shim
- future-real auth 仍不是完整生产级认证，只是更稳的受控试点认证链
- OpenShell / OpenClaw / NemoClaw 当前仍是更接近真实 adapter / process 的最小外部桥接目标
- 当前系统仍不是完整企业级多组织 / 多权限 / 多租户平台
- 当前 Narrative Components / 信息层级 仍是第一轮局部落地，不是全站完成重构

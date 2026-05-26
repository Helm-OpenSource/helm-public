---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_PROACTIVE_REPORTING_COLLABORATION_SPRINT_1_REPORT

## 总结

本轮把 Helm 从“页面里先给 judgement”的 decision-first 界面，继续推进到“会主动发现变化、会主动准备上下文、会主动发起协作请求”的第一轮经营中枢机制。

已经正式成立的核心是：

- 统一的 Active Reporting Mechanism
- 统一的 Proactive Collaboration Mechanism
- 3 条代表性主动链路
- 文档、守卫、测试、自检的同步对齐

## 问题逐条回答

### 1. Helm 主动汇报机制是否已经清楚

是。当前已经清楚区分：

- `periodic`
- `event`
- `request`

并且已经固定了：

- `activeReportSummary`
- `activeReportReason`
- `activeReportPriority`
- `activeReportBoundary`
- `activeReportDecisionRequest`
- `activeReportWorkerSummary`
- `activeReportEvidenceSummary`
- `activeReportAudience`
- `activeReportDeliveryMode`

### 2. Helm 主动协作机制是否已经清楚

是。当前已经清楚区分：

- `helm_drives_human_supervises`
- `helm_prepares_human_decides`
- `helm_reminds_human_leads`

并且已经固定了：

- `collaborationRequest`
- `collaborationSummary`
- `collaborationReason`
- `collaborationBoundary`
- `collaborationOwner`
- `collaborationWorkerAssignment`
- `collaborationEscalationHint`
- `collaborationDecisionRequest`
- `collaborationNextStep`

### 3. 代表性主动链路是否已经完成第一轮落地

是。当前已经真实落地的 3 条链路是：

1. 风险变化 → Helm 主动汇报 → founder 决策请求
2. proposal / package 进入新阶段 → Helm 主动汇报 → sales / delivery 协作
3. worker 完成 internal draft → Helm 主动汇报 → review / approval / next-step request

### 4. 当前 Helm 是否已经更像“会主动工作、主动汇报、主动请求协作”的经营中枢

是，而且已经不只是文档上的描述。

当前首页、机会页、审批页都已经会先把变化、判断、准备动作、边界和拍板请求主动送出来，而不是继续让用户自己先当分析员。

### 5. recommendation / commitment 两条 A-minus 主线在本轮是否仍保持稳定

是。

这轮没有把 recommendation 写成 commitment，也没有让主动机制绕开 approval / boundary。相反，这两条主线被更明确地抬进了主动协作语义。

### 6. 哪些地方刻意未做，为什么

- 没有做完整自动执行平台
  - 因为这轮目标是“主动汇报、主动协作、受控推进”，不是“越权自动做完一切”。
- 没有做完整 workflow engine
  - 因为当前更需要的是统一主动协议和代表链路模板。
- 没有做完整 notification center 重构
  - 因为这一轮先落代表页和系统层协议。
- 没有做全站页面重写
  - 因为这轮只要求代表链路先成立，不要求一次性推翻全部对象页。

### 7. 下一阶段最该做的 5 件事是什么

1. 把 contacts / companies / meetings / inbox 接到同一套主动汇报协议。
2. 把主动汇报进一步接到真正的事件提醒入口，而不只停在代表页。
3. 把 customer success / expansion review 主动协作链真实落地。
4. 把 worker assignment / handoff 做成更统一的受控协作面。
5. 把低风险 internal follow-up 的受控自动执行继续往前推进，但仍保留 approval / commitment boundary。

## 短表

| 项目 | 分类 | 说明 |
| --- | --- | --- |
| Active reporting mechanism | 已经完整成立 | 统一协议、共享组件、3 类 active report 与代表页落地已经成立。 |
| Proactive collaboration mechanism | 已经完整成立 | 3 种 collaboration mode、责任归属、升级路径与 decision request 已清楚。 |
| Representative proactive flows | 已经完整成立 | 首页、机会页、审批页 3 条主动链路已经真实接通。 |
| Documentation / guard / test alignment | 已经完整成立 | README、docs 索引、原则文档、pilot docs、self-check、boundary check、regression 已同步。 |
| Founder mainline stability | 已经完整成立 | 首页主动简报与 founder 拍板链没有被打散，反而更容易演示。 |
| Handoff mainline stability | 已成形但仍需下一层 | approvals / opportunity handoff 已稳定，但 customer success / meeting / inbox handoff 还要继续补。 |
| Worker / packs / scenarios integration | 已成形但仍需下一层 | 已进入主动汇报与协作语义，但还没有完整 worker console。 |
| Enterprise IAM / org admin / full permissions platform | 刻意未做 | 本轮没有进入完整企业权限平台。 |
| Runtime sandbox | 刻意未做 | 本轮没有进入 plugin runtime sandbox 或深资源执行沙箱。 |

## 已经完整成立

- Active reporting protocol
- Proactive collaboration protocol
- 3 条代表链路
- shared proactive mechanism panel
- self-check / boundary check / regression / e2e 同步

## 已成形但仍需下一层

- customer success 主动协作链
- inbox / meetings / contacts / companies 的主动改造
- 真正的事件提醒入口
- 更完整的 handoff / assignment view

## 刻意未做

- 自动执行平台
- workflow engine
- agent orchestration 平台
- 企业 IAM / org admin
- runtime sandbox

## 风险项

- 当前主动机制仍主要集中在代表页，还不是全站一致体验。
- notification surface 目前主要靠页面承接，系统级提醒入口还不够完整。
- customer-facing follow-up 仍必须继续严守 approval / commitment boundary，后续扩展时最容易误写过头。

## 边界保留

以下边界继续诚实保留：

1. `app/` 仍是当前唯一或主要 route owner。
2. `data/queries.ts` 仍是查询聚合入口，只是已经更薄。
3. plugin runtime 仍没有真正 sandbox。
4. 仍存在少量 legacy shim。
5. future-real auth 仍不是完整生产级认证。
6. OpenShell / OpenClaw / NemoClaw 当前仍是更接近真实 adapter / process 的最小外部桥接目标。
7. 当前系统仍不是完整企业级多组织 / 多权限 / 多租户平台。
8. 当前主动机制仍是第一轮落地，不是完整自动执行平面。
9. 当前 Helm 仍默认以“建议、准备、升级”为主，不默认拥有高风险自动承诺和高风险自动发送权限。

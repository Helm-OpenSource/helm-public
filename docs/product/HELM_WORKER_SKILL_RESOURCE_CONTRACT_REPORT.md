---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_WORKER_SKILL_RESOURCE_CONTRACT_REPORT

## 目标

把 Helm 下一阶段的 `worker / skill / resource binding` 关系收成一版正式口径，明确它与主动汇报、主动协作、review / approval / replay / audit / memory 的关系。

## 当前结论

当前正确关系已经明确为：

`Helm Worker -> Helm Skill -> ClawHub Resource -> Execution`

并且治理权必须继续留在 Helm Control Plane，而不是下沉到 worker、skill 或 ClawHub runtime。

更细的 catalog 扩展见：

- [`HELM_WORKER_SKILL_RESOURCE_CONTRACT_SPRINT_2_REPORT.md`](HELM_WORKER_SKILL_RESOURCE_CONTRACT_SPRINT_2_REPORT.md)

## 本轮正式固定的内容

1. 四层结构已经清楚：
   - Helm Control Plane
   - Role Worker Layer
   - Skill Layer
   - Resource Binding / Resource & Execution Layer
2. `Worker 定义角色 / Skill 定义能力 / Resource 定义执行供给 / Control Plane 定义治理` 已固定成 canonical 原则。
3. `effectMode` 已被提升为横切约束字段，用来区分：
   - `read_only`
   - `draft_only`
   - `internal_write`
   - `customer_visible_send`
4. 当前 controlled-trial 口径已固定为：
   - customer-facing skill 仍必须 review-before-send
   - non-commitment boundary 仍必须保留
   - `customer_visible_send` 不作为 Sprint 1 自主执行能力开放

## 当前已与现有主线对齐的部分

1. role-based narratives / packs / usage scenarios 已经提供了 worker 未来承接的表达资产。
2. reporting model / decision-first IA 已经提供了 worker / boundary / evidence 如何对人展示的界面协议。
3. proactive reporting / collaboration 已经提供了 worker 完成准备后，如何把 decision request 抬到前台的协作协议。
4. `dashboard / opportunities / approvals` 已经开始把 `worker summary / worker assignment / grouped evidence` 直接接到 shared contract presentation，而且 grouped evidence 已继续往真实 `replay / audit / memory / handoff payload` 映射，并落成可点击的 drawer target + section anchor，而不是继续停留在静态文案。
5. OpenShell / OpenClaw / NemoClaw 已经被明确定义为最小外部桥接目标，而不是 Helm 自身的治理层。

## 仍需降级口径的地方

1. 当前不是完整 worker orchestration system。
2. 当前不是完整 resource marketplace。
3. 当前不是完整自动执行平面。
4. 当前不是完整企业 IAM / org admin。
5. 当前不是全站 worker console。

## 短表

| 项目 | 分类 | 说明 |
| --- | --- | --- |
| Four-layer contract framing | 已经完整成立 | Control Plane / Worker / Skill / Resource 的关系已经清楚。 |
| Controlled-trial governance boundary | 已经完整成立 | review / approval / replay / audit / memory 继续归 Control Plane。 |
| `effectMode` contract | 已经完整成立 | 已明确 `read_only / draft_only / internal_write / customer_visible_send`。 |
| Representative flow + worker summary / assignment / evidence framing | 已经完整成立 | representative flow 已进入 contract，且 `dashboard / opportunities / approvals` 已开始从 shared contract 派生 worker 摘要、assignment 细项，以及带真实 replay / audit / memory / handoff payload 且可点击下钻的 grouped evidence。 |
| Concrete worker roster and broader skill catalog | 已成形但仍需下一层 | Sprint 1 只收最小 schema 和代表流，不做全量岗位矩阵。 |
| Marketplace / orchestration / sandbox runtime | 刻意未做 | 当前阶段不进入完整平台工程。 |
| Customer-visible autonomous send | 刻意未做 | controlled-trial 下仍严格禁止越权自动发送。 |
| Contract-runtime drift | 风险项 | 后续若直接接更多 runtime，最容易让 skill 或 resource 越权长胖。 |

## 边界保留

1. 当前 worker / skill / resource 只是 contract 层，不是完整数字员工产品。
2. review / approval / replay / audit / memory 的最终治理仍属于 Helm。
3. recommendation 不等于 commitment。
4. proposal 不等于合同。
5. proactive 不等于自动替人拍板。

## 结论

当前最值得冻结的是 contract，不是成品数字员工。

只要这条 contract 主干先稳住，后面 founder、sales、delivery、customer success 这些角色化 worker 才能继续往前长，而不会把 Helm 拉成一套难以治理的执行平台。

---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_WORKER_SKILL_RESOURCE_CONTRACT_SPRINT_1_REPORT

## 总结

本轮把 `worker / skill / resource binding` 从零散概念收成了一版正式协议文档，并补了一版可运行的 Sprint 1 contract skeleton：

- formal protocol doc
- canonical schema
- controlled-trial boundary guard
- representative bundle
- self-check / boundary-check / regression test 接线

## 问题逐条回答

### 1. 当前四层关系是否已经清楚

是。当前已经清楚区分：

1. Helm Control Plane
2. Role Worker Layer
3. Skill Layer
4. Resource Binding / Resource & Execution Layer

### 2. 当前 contract 的核心原则是否已经固定

是。当前已经固定：

- `Worker 定义角色`
- `Skill 定义能力`
- `Resource 定义执行供给`
- `Control Plane 定义治理`

并且已经明确：

`Helm Worker -> Helm Skill -> ClawHub Resource -> Execution`

### 3. Sprint 1 schema skeleton 是否已经成形

是。当前已经补上：

- `workerContractSchema`
- `skillContractSchema`
- `resourceBindingContractSchema`
- `resourceContractSchema`
- `workerSkillResourceContractBundleSchema`

以及 3 条代表链路：

1. `sales_followup`
2. `delivery_activation_checklist`
3. `success_expansion_review`

### 4. controlled-trial 边界是否仍被保留

是。当前 schema 和 guard 已明确固定：

- customer-facing skill 必须 `requiresReview = true`
- customer-facing skill 必须 `nonCommitmentOnly = true`
- `customer_visible_send` 不作为 Sprint 1 自主执行能力开放
- resource binding 仍必须留在 `current_workspace`

### 5. recommendation / commitment 两条 A-minus 主线是否仍保持稳定

是。

这一轮没有把 skill 或 resource 写成可以直接越权承诺、越权发送或越权跳过 review 的执行面，反而把 recommendation / non-commitment / customer-visible 的边界写得更硬了。

### 6. 哪些地方刻意未做，为什么

- 没有做完整 worker console
  - 因为本轮目标是 contract 主干，而不是完整工作台。
- 没有做完整 orchestration engine
  - 因为当前更需要的是治理 contract，而不是流程编排平台。
- 没有做完整 skill catalog
  - 因为 Sprint 1 只先收 3 条代表链路和最小 canonical schema。
- 没有做 runtime sandbox
  - 因为当前阶段仍必须诚实保留这条边界。

### 7. 下一阶段最该做的 5 件事是什么

1. 把 founder / sales / delivery / customer success 的更细 worker roster 补完整。
2. 把 objection handling、proposal shaping、review note、risk clarification 补成下一层 skill。
3. 把更多现有 ClawHub 资源接到同一套 binding contract。
4. 把 representative flows 继续挂进页面上的 worker summary / evidence / boundary 展示。
5. 把 contract 校验继续接到更真实的 runtime handoff 和 review queue。

## 短表

| 项目 | 分类 | 说明 |
| --- | --- | --- |
| Formal protocol doc | 已经完整成立 | Worker / Skill / Resource 分层口径已经正式落文档。 |
| Canonical schema skeleton | 已经完整成立 | Worker / Skill / ResourceBinding / Resource schema 已固定。 |
| Representative bundle | 已经完整成立 | 3 条代表链路已进入可校验 bundle。 |
| Guard / self-check / test alignment | 已经完整成立 | README、docs、boundary-check、self-check、tests 已同步。 |
| Broader worker roster | 已成形但仍需下一层 | 当前只有 Sprint 1 最小 roster，不是完整岗位矩阵。 |
| Broader skill catalog | 已成形但仍需下一层 | 当前只有代表 skill，不是完整能力目录。 |
| Full orchestration runtime | 刻意未做 | 本轮没有扩成完整执行平台。 |
| Customer-visible autonomous send | 刻意未做 | Sprint 1 仍明确禁止。 |
| Contract drift when runtime expands | 风险项 | 后续接更多资源时最容易把 controlled-trial 边界写松。 |

## 已经完整成立

- formal protocol doc
- canonical schema
- representative worker / skill / resource bundle
- controlled-trial boundary checks
- docs / self-check / boundary-check / regression 对齐

## 已成形但仍需下一层

- 更完整的 worker roster
- 更完整的 skill catalog
- 更完整的 resource directory
- 页面级 worker console / assignment UI
- runtime handoff 接线

## 刻意未做

- orchestration platform
- workflow engine
- marketplace
- sandbox runtime
- enterprise IAM / org admin
- 高风险自动承诺和高风险自动发送

## 风险项

- 这轮 contract 还没有接进真实 runtime handoff，只是把 contract 主干和代表 bundle 固定住。
- broader skill catalog 后续扩展时，最容易把 `customerFacingAllowed` 和 `nonCommitmentOnly` 写松。
- 若后续直接把 ClawHub 资源提升成治理层，会破坏 Helm Control Plane 的边界。

## 边界保留

1. `app/` 仍是当前唯一或主要 route owner。
2. `data/queries.ts` 仍是查询聚合入口，只是已经更薄。
3. plugin runtime 仍没有真正 sandbox。
4. OpenShell / OpenClaw / NemoClaw 当前仍是更接近真实 adapter / process 的最小外部桥接目标。
5. 当前系统仍不是完整企业级多组织 / 多权限 / 多租户平台。
6. 当前 contract 仍是 Sprint 1 skeleton，不是完整数字员工平台。

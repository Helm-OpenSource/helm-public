---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Foundation Contracts Baseline Freeze Report

Current main note:

- 这份 freeze 文件现在服务于 `Helm v2 Baseline Freeze 1-8`
- 这份 freeze 文件现在也服务于 `Helm v2 Baseline Freeze 1-9`
- 这份 freeze 文件现在也服务于 `Helm v2 Baseline Freeze 1-10`
- 它冻结的是 Sprint 1-8 之后仍继续成立的 foundation truth，而不是只回看早期 contract
- 它同样冻结 Sprint 9 richer official coverage 之后仍继续成立的 foundation truth，而不是把 richer official coverage 写成完整 integration platform
- 它同样冻结 Sprint 10 official follow-through / exception handling 之后仍继续成立的 foundation truth，而不是把 resolution 写成 official success

## 1. 当前版本哪些 foundation contracts 已经完整成立

- object graph contracts
- layered memory contracts
- artifact-first worker registry
- action-level approval matrix
- primary event flow contract
- planned API contract baseline
- planned data model baseline
- Sprint 2-10 已落地的最小 runtime tables
- artifact / approval / audit 三层关系
- retrieval / promotion / trace 三层关系

## 2. 哪些能力已成形但仍需下一层

- richer object-native timeline / checkpoint tables
- richer connector-backed official acknowledgments / reconciliation
- broader connector ingestion breadth
- deeper retrieval invalidation and learned-pattern policy
- more object-native handoff tables
- more explicit lead-orchestrator runtime state

## 3. facts / inferred / policy / handoff / checkpoint / scratch 边界

- `object_fact`：事实层；可以进入 draft memory，只有 `human_confirmed / system_of_record` 才能 promotion
- `inferred`：推断层；必须和 fact 分开，不能伪装成已确认事实
- `policy`：组织规则、审批阈值、红线与敏感字段约束
- `handoff`：阶段性交接包，不等于长期知识库
- `checkpoint`：当前恢复点、当前计划、当前已确认姿态
- `scratch`：临时中间状态，不自动升级为长期记忆

## 4. trusted / untrusted 输入边界

当前 freeze 继续保留：

- trusted：
  - workspace / object summary
  - human-confirmed meeting facts
  - approved artifacts
  - policy memory
  - system-of-record fields
- untrusted：
  - raw meeting transcript
  - external free-form content
  - 未确认 note / email / attachment 内容
  - agent inference 本身

untrusted 输入当前可以进入 draft artifact / draft memory，但不能直接 promotion 成长期 truth，更不能直接驱动 official writeback。

## 5. retrieval / promotion / trace 边界

当前 freeze 继续明确：

- retrieval 当前分为：
  - `always_on`
  - `stage_triggered`
  - `event_triggered`
  - `on_demand`
- promotion 当前只支持显式路径：
  - `none`
  - `human_confirmed`
  - `system_of_record`
- trace 当前必须说明：
  - runtime 拉了哪些 memory
  - 来自哪些 source
  - 哪些是 trusted / untrusted
  - 哪些只是 draft
  - 哪些已经 promotion

## 6. artifact / approval / audit 关系

当前 freeze 继续明确：

- artifact 是 worker / runtime 的统一输出物
- approval / review 负责把 artifact 从 `draft` 推到 `confirmed / approved / blocked / rejected`
- audit 负责记录：
  - 谁做了 review
  - 谁做了 manual execution
  - 谁批准了 guarded official write
  - 谁批准了 limited auto
  - 谁接手了 official follow-through / exception
  - 谁写下了 reconciliation / resolution note
  - 何时写入 checkpoint / summary
  - 哪些 boundary 仍然保留
- `approval` 不等于 `execution`
- `execution proof` 不等于 `official writeback`
- `acknowledgment success` 才可代表 official write 成功

## 7. runtime tables 当前基线

当前基线已经清楚：

- `RuntimeEvent`
- `WorkerRun`
- `ArtifactBundle`
- `MemoryItem`
- `ApprovalRequest`
- `ArtifactReview`
- `HumanActionExecution`
- `OfficialWriteIntent`
- `LimitedAutoIntent`
- `OfficialFollowThrough`
- `ConnectorIngestionRecord`
- `RetrievalTrace`

这套表当前已经足够支撑 Sprint 2 / 3 / 4 / 5 / 6 / 7 / 8 的真实 runtime，但还不是完整 operating-runtime schema。

## 短表

| 项目 | 已经完整成立 | 已成形但仍需下一层 | 刻意未做 | 风险项 |
| --- | --- | --- | --- | --- |
| Object graph contracts | 已冻结 | 更细 object-native timeline 仍需下一层 | 不做完整 CRM / ERP engine | 对象继续扩张时容易变脏 |
| Layered memory contracts | 已冻结 | 更细 promotion / invalidation policy 仍需下一层 | 不做单一 memory 池 | fact / inference 漂移风险 |
| Artifact-first worker registry | 已冻结 | 更多 runtime worker 仍需下一层 | 不做 worker marketplace | artifact schema 扩张时需继续守住统一 |
| Action approval matrix | 已冻结 | 更细 per-object policy 仍需下一层 | 不做 auto-execution plane | 高风险动作未来接入时会升高复杂度 |
| Event flow / API contract | 已冻结 | 更多 live routes / bus 仍需下一层 | 不做完整 orchestration platform | planned API 容易被误读成已实现 |
| Runtime tables | 最小集已成立，并已覆盖 ConnectorIngestionRecord / RetrievalTrace / LimitedAutoIntent | 更完整 runtime schema 仍需下一层 | 不做 broader runtime platform | richer reconciliation / connector receipts 仍需再补表 |
| Artifact / approval / audit relationship | 已清楚 | 更细 object-specific routing 仍需下一层 | 不做 workflow engine | approved / executed / official 容易被误读 |
| Trusted / untrusted boundary | 当前 truth 已清楚 | 更多 source filtering 仍需下一层 | 不做 full security engine | 外部内容污染仍需长期 guard |
| Retrieval / promotion / trace boundary | 当前 truth 已清楚 | 更细 invalidation / learned retrieval 仍需下一层 | 不做全历史上下文塞入 | stale memory 与过度加载风险 |
| Recommendation / commitment boundary | 当前 truth 已清楚 | 更细 commitment taxonomy 仍需下一层 | 不做承诺自动化 | wording 漂移会破坏基础边界 |

## 总判断

Foundation contracts baseline 已经成立。  
当前 Helm v2 的 object / memory / artifact / approval 四层在 Baseline Freeze 1-8 口径里已经足够成为 Sprint 9 之后继续扩展 runtime 的正式起点，在 Baseline Freeze 1-9 口径里也已经足够成为 Sprint 10 之后继续扩展 runtime 的正式起点，在 Baseline Freeze 1-10 口径里也已经足够成为 Sprint 11 之后继续扩展 runtime 的正式起点，但仍不能被写成完整 operating platform。  
当前 default 仍是 `lead orchestrator + isolated workers`。

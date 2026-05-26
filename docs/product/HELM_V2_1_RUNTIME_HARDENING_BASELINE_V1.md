---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.1 Runtime Hardening Baseline v1

## 定位

Helm v2.1 不是平台重做，也不是新产品线扩张。

它是在 Baseline Freeze 1-10 之后，对现有 Helm v2 runtime 增补一层：

- persisted payload handles
- token budget governor
- session notebook / checkpoint trace
- explicit verification report
- memory candidate / promotion ledger
- truth conflict visibility
- world model / problem space / DRI / edge brief
- handoff packet / initiative run / coordination metrics
- composition failure telemetry

这层仍然保持：

- review-first
- no auto-send
- no broad auto-write
- recommendation 不等于 commitment
- verification 不等于 autonomous decision authority

## 已经完整成立

- `RuntimeSession / PersistedPayload / SessionNotebook / SessionCheckpoint` 数据底座已存在
- `MemoryCandidate / MemoryPromotion / VerificationReport / TruthConflict` 显式 runtime ledger 已存在
- `WorldModelSnapshot / ProblemSpace / DriAssignment / EdgeBrief / CompositionFailure / HandoffPacket / InitiativeRun / CoordinationMetricsDaily` 协同对象层已存在
- 新 namespace `app/api/helm-v2/runtime/*` 已成立，同时旧 `app/api/runtime/*` 继续保留为兼容入口
- meeting 主闭环已经在 `meeting.ended -> human review` 上接入 v2.1 runtime trace
- session、verification、memory promotion、problem-space、artifact confirm、handoff、consolidation 等 v2.1 关键动作都已显式写回 `RuntimeEvent`
- meeting detail 已可显示 budget / notebook / checkpoint / verification / problem-space / composition-failure surface，以及 signal / world-model / artifact lineage / capability trace、handoff packets、initiative runs 和 coordination telemetry
- meeting detail 已可显示 consolidation queue，并支持 queue / pause / resume 的窄 operator control
- `POST /api/helm-v2/runtime/consolidation/jobs` 已成立，可从 workspace 级 operator path 发起手动 consolidation queue
- `/operating` 已可显示 workspace operator surface：verification / promotion queue、problem-space / player-coach queue、handoff packets、initiative runs、composition-failure inbox、consolidation queue、honest signal feed、capability catalog、coordination telemetry 和 cache-health
- `POST /api/helm-v2/runtime/problem-spaces` 与 `POST /api/helm-v2/runtime/artifacts/:id/confirm` 已成立
- v2.1 eval harness 与 phase scripts 已成立

## 已成形但仍需下一层

- verification 现在已经是显式 runtime verifier，但仍主要是规则化 / source-grounded 审查，不是更深的 learned verifier
- consolidation queue / pause / resume 与 operator visibility 已成立，但当前仍保持 queue / audit posture，不做更深的 background consolidation runtime
- truth scoring / coordination telemetry 现在已经可见，但仍需更多 goldens 和 pilot evidence 才能证明分层权重足够稳

## 刻意未做

- 没有默认 team mode / multi-agent orchestration
- 没有自动对外发送
- 没有默认 official write 放权
- 没有把 problem space 扩成完整 workflow engine
- 没有把 world model 扩成通用知识图谱层
- 没有把 capability catalog / signal feed / artifact lineage 做成独立 marketplace、warehouse 或 version-console 产品
- 没有把 runtime trace 写成 customer-facing commitment surface

## 风险项

- v2.1 新增表较多，后续仍需继续收紧哪些对象会长期成为 canonical substrate
- verification / truth scoring 当前主要是 deterministic safety layer，后续仍需更多 goldens 和 pilot evidence
- problem-space / edge-brief 当前已可追溯，但仍需更广 operator feedback 验证可用性

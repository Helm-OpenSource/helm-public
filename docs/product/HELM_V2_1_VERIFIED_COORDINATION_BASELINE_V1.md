---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.1 Verified Coordination Baseline v1

更新时间：2026-04-03
状态：Baseline Freeze
适用范围：Helm v2.1 narrow vertical slice proveout

## 1. 这份 baseline 的主口径

这份文档只冻结一条 `meeting-driven verified coordination loop` 的当前真相：

`meeting signals -> verification / truth conflict -> memory promote|reject|defer -> problem space -> explicit DRI -> IC / DRI / player-coach brief`

它不是 Helm v2.1 的整个平台宣言，也不是 spec 中全部设计项已经成立的证明。

当前 truth source 仍以：

- `HELM_V2_1_RUNTIME_HARDENING_BASELINE_V1.md`
- `HELM_V2_1_RUNTIME_HARDENING_FINAL_FREEZE_REPORT.md`

为主；本文件只冻结 verified coordination 这一条 acceptance-grade slice。

## 2. 什么叫 v2.1 的 verified coordination

在当前 v2.1，`verified coordination` 的含义是：

1. 会议运行链中的 memory candidate 不能停留在模糊状态，必须落到：
   - `PROMOTED`
   - `REJECTED`
   - `DEFERRED`
2. promotion decision 必须带：
   - verification report
   - source grounding
   - truth conflict visibility
3. `problem space` 只能从 confirmed / promoted runtime truth 形成；弱 truth 只能进入 `truth boundary review`
4. `DRI assignment` 必须显式、可追踪、可解释
5. `IC / DRI / player-coach brief` 必须同源一致，只在 lens 上不同
6. operator 必须能直接看到：
   - 为什么 promoted
   - 为什么 rejected
   - 为什么 deferred
   - 为什么现在形成这个 problem space
   - 为什么这个 DRI 被指派
   - brief 依据什么生成
   - 为什么当前仍 blocked / deferred / conflicting

## 3. 已经完整成立

### 3.1 Verified promotion truth

- meeting-driven review 现在会把 candidate 明确收敛到 `promote / reject / defer`
- `verification report + memory candidate + memory promotion + truth conflict` 已经形成显式 ledger
- inferred / conflicted / blocked 内容不会静默 promotion
- operator surface 已经能看到 disposition、rationale、source class、evidence refs、verification posture、truth conflict posture

### 3.2 Problem-space / DRI / brief truth

- operational `problem space` 只会在 confirmed / promoted truth 足够时形成
- truth 弱、conflict 未解、review keep-draft 或 reject 时，只会进入 `Truth boundary review`
- DRI assignment 已经显式写入 `DriAssignment`，并带 note / assignedBy / assignedUser
- brief 会同时为 `IC / DRI / PLAYER_COACH` 三类 audience 生成
- 三类 brief 共用同一份 summary / grounding / truth posture / DRI posture，只在 lens 上区别
- DRI 变更后会回刷 brief，不再保留旧的 brief posture

### 3.3 Operator surface truth

- meeting detail 已经能解释：
  - promotion posture
  - problem-space grounding
  - DRI posture
  - brief truth posture
  - composition failure 与关联 problem space
- workspace operator panel 已经能解释：
  - promote / reject / defer posture
  - why this problem space exists now
  - why this brief is still deferred or action-ready
  - failure 被归类为什么

## 4. 已成形但仍需下一层

- verification usefulness 仍需更多真实 pilot 证明
- truth conflict usefulness 仍需更多真实 operator 使用证据
- problem-space / DRI / brief 的组织级采用效果仍需下一层
- composition failure 与 coordination metrics 当前已可见，但还不是成熟 observability scorecard

## 5. 刻意未做

- seven-layer memory cascade completion
- dreaming consolidator
- full compaction engine
- team mode / multi-agent runtime
- broader world-model productization
- public execution surfaces
- auto-send
- broad auto-write
- workflow engine / orchestration platform 扩张

## 6. 风险项

- 这条 loop 目前证明的是 `acceptance-grade usefulness in one narrow slice`，不是所有 runtime path 都已成熟
- truth scoring 仍是 bounded runtime heuristic，不应写成完整 truth engine
- DRI / brief usefulness 仍需更长时间的真实 follow-through evidence
- current-main 里仍存在 runtime legacy shim 与 future-real auth 边界，不能对外写成完整生产级平台能力

## 7. 保留边界

以下边界在这条 slice 上继续成立：

- workspace-first
- controlled-trial
- judgement-first
- recommendation != commitment
- no auto-send
- no broad auto-write
- no second app tree
- no shell thinning
- no route/query rewrite

## 8. 下一层但不属于本次 freeze

下一阶段若继续推进，优先顺序应是：

1. 真实 operator 使用数据下的 verification usefulness
2. truth conflict resolution 的更强 trace 与 goldens
3. problem-space / DRI / brief 的 follow-through usefulness
4. composition failure 与 coordination metrics 的更强评估
5. consolidation 与 verified coordination 之间的更窄联动

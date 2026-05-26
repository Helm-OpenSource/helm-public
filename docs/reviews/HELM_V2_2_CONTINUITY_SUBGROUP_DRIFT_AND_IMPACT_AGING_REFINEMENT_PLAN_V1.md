---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.2 Continuity Subgroup Drift And Impact Aging Refinement Plan v1

更新时间：2026-04-05
状态：Completed
适用范围：PR39 continuity subgroup drift / cross-surface interval wording regression audit / material impact aging refinement slice

## 1. current freeze truth

PR39 继承的 freeze truth：

- PR38 已完成：
  - subgroup drift aging scale-up review
  - cross-surface interval wording consistency audit
  - material impact sampling aging review
- continuity calibration 仍是 repo 内 pilot sample + rule profile，不是 production telemetry analytics
- continuity surface 当前已经能把 subgroup aging、wording consistency、sampling aging 作为 operator-visible guidance 输出
- 但还缺：
  - 更长期 cohort aging 下的 subgroup drift 扩样对照
  - interval wording 在更多 continuity-facing readout 上的 regression audit
  - material impact sampling aging 的持续 refinement 与 longer-horizon optimization summary

## 2. what PR39 is proving

PR39 要证明：

1. subgroup drift 在更长期 cohort aging 扩样下，仍然能被诚实归类和解释
2. interval wording 在更多 continuity-facing readout 上，仍然能被 regression audit 捕捉，而不是只看当前 consistency 通过率
3. material impact sampling aging 能继续区分 persistent signal、watch signal 与 unstable hint，并给出更诚实的 optimization summary
4. operator surface 能看到这三类 review 的摘要、aggregate finding 和 adjustment hint

## 3. exact review loop

`subgroup drift long-term cohort aging review -> cross-surface interval wording regression audit -> material impact sampling aging refinement -> operator-visible continuity guidance`

这条 loop 仍然只服务 continuity operator diagnosis / calibration review，不扩 execution authority，不进入 auto-remediation orchestration。

## 4. preserved boundaries

- workspace-first
- controlled-trial
- judgement-first
- recommendation != commitment
- no auto-send
- no broad auto-write
- no execution-authority expansion
- no second app tree
- no route/query rewrite

## 5. phase plan

### Phase 0

- 创建 PR39 plan doc
- 更新 `PLANS.md`
- 锁定 truth source 和 deferred scope

### Phase 1

- subgroup drift long-term cohort aging review
- 输出 longer-horizon cohort aging report / subgroup drift comparison / session-level summary

### Phase 2

- cross-surface interval wording regression audit
- 输出 regression audit report / consistency findings / adjustment recommendations / session-level summary

### Phase 3

- material impact sampling aging refinement
- 输出 aging material impact analysis / longer-horizon optimization summary / session-level summary

### Phase 4

- continuity surfaces
- eval fixtures / harness / tests / e2e
- baseline / report / docs index / self-check / boundary guard

## 6. eval contract

PR39 至少覆盖：

- subgroup drift long-term cohort aging review
- cross-surface interval wording regression audit
- material impact sampling aging refinement
- session-level PR39 continuity review summary
- operator surface 对这三类 PR39 readout 的可见性

## 7. explicitly deferred items

本轮明确不做：

- auto-remediation orchestration
- execution-authority expansion
- team mode / multi-agent runtime
- broader world-model productization
- route / handler rewrite
- public execution surfaces
- auto-send
- broad auto-write

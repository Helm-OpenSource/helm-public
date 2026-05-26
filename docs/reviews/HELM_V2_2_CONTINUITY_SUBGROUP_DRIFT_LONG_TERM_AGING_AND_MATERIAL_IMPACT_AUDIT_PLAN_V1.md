---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2.2 Continuity Subgroup Drift Long-Term Aging And Material Impact Audit Plan v1

更新时间：2026-04-05
状态：Planned
适用范围：PR40 continuity subgroup drift long-term sample expansion / interval wording cross-readout regression audit / material impact aging audit slice

## 1. current freeze truth

PR40 继承的 freeze truth：

- PR39 已完成：
  - `subgroupDriftLongTermCohortAgingReview`
  - `intervalWordingCrossSurfaceRegressionAudit`
  - `materialImpactSamplingAgingRefinement`
- continuity calibration 仍是 repo 内 pilot sample + rule profile，不是 production telemetry analytics
- continuity surface 当前已经能把 long-term cohort aging、cross-surface wording regression、impact aging refinement 作为 operator-visible guidance 输出
- 但还缺：
  - 更长期 subgroup drift 的 sample expansion 对照
  - interval wording 在更多 continuity readout 上的 regression audit 覆盖
  - material impact sampling aging 的持续 audit 和更诚实的 optimization suggestion

## 2. what PR40 is proving

PR40 要证明：

1. subgroup drift 在更长期 sample expansion 下，仍然能被诚实归类和解释
2. interval wording 在更多 continuity readout 上，仍然能被 regression audit 捕捉，而不是只看现有 surface
3. material impact sampling aging 能继续区分 durable signal、watch pattern 与 unstable hint，并给出更诚实的 optimization suggestion
4. operator surface 能看到这三类 review 的摘要、aggregate finding 和 adjustment hint

## 3. exact review loop

`subgroup drift long-term sample expansion -> interval wording cross-readout regression audit -> material impact sampling aging audit -> operator-visible continuity guidance`

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

- 创建 PR40 plan doc
- 更新 `PLANS.md`
- 锁定 truth source 和 deferred scope

### Phase 1

- subgroup drift long-term sample expansion
- 输出 expanded cohort drift report / long-term drift analysis / session-level summary

### Phase 2

- interval wording cross-readout regression audit
- 输出 regression audit report / wording findings / adjustment recommendations / session-level summary

### Phase 3

- material impact sampling aging audit
- 输出 aging material impact report / pattern aging findings / long-term impact optimization suggestions / session-level summary

### Phase 4

- continuity surfaces
- eval fixtures / harness / tests / e2e
- baseline / report / docs index / self-check / boundary guard

## 6. eval contract

PR40 至少覆盖：

- subgroup drift long-term sample expansion
- interval wording cross-readout regression audit
- material impact sampling aging audit
- session-level PR40 continuity review summary
- operator surface 对这三类 PR40 readout 的可见性

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

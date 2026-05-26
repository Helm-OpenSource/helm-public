---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2.2 Continuity Subgroup Drift Aging And Material Impact Audit Plan v1

更新时间：2026-04-05
状态：Planned
适用范围：PR38 continuity subgroup drift aging / cross-surface interval wording consistency audit / material impact sampling aging review slice

## 1. current freeze truth

PR38 继承的 freeze truth：

- PR37 已完成：
  - subgroup drift cohort aging review
  - cross-surface interval wording regression review
  - material impact sampling review
- continuity calibration 仍是 repo 内 pilot sample + rule profile，不是 production telemetry analytics
- continuity surface 当前已经能把 subgroup aging、wording regression、impact sampling 作为 operator-visible guidance 输出
- 但还缺更大 cohort 下的 subgroup aging 对照、更广泛的 wording consistency audit、以及 material impact sampling 的 aging 对照

## 2. what PR38 is proving

PR38 要证明：

1. subgroup drift 在更大 pilot cohort 和更长 horizon 下，仍然能被诚实归类和解释
2. interval wording 在更多 continuity-facing surface 上，仍然保持 canonical wording，而不是逐步漂移
3. material impact sampling 经过 aging 对照后，能区分 broader-sample signal 与 narrow hint
4. operator surface 能看到这三类 review 的摘要、aggregate finding 和 adjustment hint

## 3. exact review loop

`subgroup drift cohort aging scale-up review -> cross-surface interval wording consistency audit -> material impact sampling aging review -> operator-visible continuity guidance`

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

- 创建 PR38 plan doc
- 更新 `PLANS.md`
- 锁定 truth source 和 deferred scope

### Phase 1

- subgroup drift cohort aging scale-up review
- 输出 subgroup drift comparison / cohort aging report / session-level summary

### Phase 2

- cross-surface interval wording consistency audit
- 输出 consistency audit report / regression findings / adjustment recommendations / session-level summary

### Phase 3

- material impact sampling aging review
- 输出 aging material impact analysis / long-term impact optimization summary / session-level summary

### Phase 4

- continuity surfaces
- eval fixtures / harness / tests / e2e
- baseline / report / docs index / self-check / boundary guard

## 6. eval contract

PR38 至少覆盖：

- subgroup drift aging scale-up review
- cross-surface interval wording consistency audit
- material impact sampling aging review
- session-level PR38 continuity review summary
- operator surface 对这三类 PR38 readout 的可见性

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

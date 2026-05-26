---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2.2 Continuity Subgroup Drift And Material Impact Aging Audit Refinement Plan v1

更新时间：2026-04-05
状态：Planned
适用范围：PR41 continuity subgroup drift long-term sample expansion refinement / interval wording cross-readout regression refinement / material impact sampling aging refinement slice

## 1. 当前 freeze truth

继承：

- `HELM_V2_2_CONTINUITY_SUBGROUP_DRIFT_LONG_TERM_AGING_AND_MATERIAL_IMPACT_AUDIT_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_SUBGROUP_DRIFT_LONG_TERM_AGING_AND_MATERIAL_IMPACT_AUDIT_REPORT_V1.md`
- `HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- `PLANS.md`

当前已经成立：

- subgroup drift long-term sample expansion review
- cross-readout interval wording regression audit
- material impact sampling aging audit
- continuity operator surfaces、eval、e2e、self-check、boundary guard 都已接好

当前仍然是：

- repo 内 pilot sample + rule profile
- operator-visible continuity review
- 非执行权、非 auto-remediation、非 broader telemetry platform

## 2. 本轮证明什么

PR41 要证明的是下一层 refinement，而不是新平台：

1. subgroup drift long-term sample expansion 可以进一步给出 refined sample-depth / posture comparison
2. interval wording 可以在更广 continuity readout family 上继续做 regression refinement
3. material impact sampling aging 可以给出更诚实的 pattern aging comparison 和 optimization suggestion
4. 上述结果仍然只进入 operator continuity guidance，不进入自动恢复或执行权

## 3. exact review loop

`subgroup drift long-term sample expansion refinement -> interval wording cross-readout regression refinement -> material impact sampling aging refinement -> operator-visible continuity guidance`

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

- 创建 PR41 计划文档
- 更新 `PLANS.md`

### Phase 1

- 在 runtime continuity review 中加入 subgroup drift sample expansion refinement readout
- 让 session review 和 queue summary 都能读到 refined sample-depth / posture

### Phase 2

- 在 runtime continuity review 中加入 cross-readout wording regression refinement readout
- 覆盖 threshold / step / guidance / session summary 这些 continuity readout family

### Phase 3

- 在 runtime continuity review 中加入 material impact sampling aging refinement readout
- 给出 pattern aging comparison、finding、optimization suggestion

### Phase 4

- 更新 meeting detail 与 `/operating`
- 补 eval fixture / harness / unit / e2e
- 新增 baseline / report 并同步 README、docs index、runbook、self-check、boundary guard

## 6. eval contract

至少覆盖：

- subgroup drift sample expansion refinement
- interval wording cross-readout regression refinement
- material impact sampling aging refinement
- session-level PR41 review summary coverage

最终验证：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`
- `npm run eval:helm-v2-2-phase21`

## 7. explicitly deferred items

- auto-remediation orchestration
- execution-authority expansion
- team mode / multi-agent runtime
- broader world-model productization
- route / handler rewrite
- public execution surfaces
- auto-send
- broad auto-write

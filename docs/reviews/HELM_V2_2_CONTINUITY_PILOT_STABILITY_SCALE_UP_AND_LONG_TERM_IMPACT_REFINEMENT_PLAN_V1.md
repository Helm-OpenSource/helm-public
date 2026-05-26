---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.2 Continuity Pilot Stability Scale-up And Long-term Impact Refinement Plan v1

更新时间：2026-04-05  
状态：Completed  
适用范围：PR34 continuity pilot stability scale-up / interval wording drift audit / long-term material impact refinement slice

## 1. 当前 freeze truth

当前继承的 freeze 口径是：

- PR33 已经完成 subgroup stability recheck、interval wording consistency、long-term outcome review
- continuity pilot calibration 仍然是 repo-internal pilot sample + rule profile，不是 production telemetry analytics
- operator surface 已经能显示 stability confidence、interval wording、long-term material impact，但还缺：
  - 更大 pilot sample 下的 subgroup stability scale-up
  - interval wording drift audit
  - long-term material impact 的持续复核

## 2. PR34 要证明什么

PR34 继续只在 continuity surface 与 operator workflow 内推进，不扩执行权：

1. 把 subgroup stability review 从 recheck 推进到 scale-up，显式回答当前 larger pilot sample 下哪些 subgroup 更稳、哪些仍有扩样风险
2. 把 interval wording 从 canonical consistency 推进到 drift audit，显式回答 wording 是否在 cohort / horizon / surface 间重新漂移
3. 把 long-term material impact 从 step-level readout 推进到持续复核，显式回答哪些 SOP step 的长期影响仍然 material、哪些只是窄样本提示
4. 把这些结果回填到 meeting detail、`/operating`、eval、e2e、runbook、guard 和 freeze docs

## 3. exact review loop

`larger pilot sample -> subgroup stability scale-up -> interval wording drift audit -> long-term material impact review -> operator-visible continuity guidance`

这条 loop 只服务 continuity operator diagnosis / calibration review，不扩 execution authority。

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

- 创建 PR34 plan doc
- 更新 `PLANS.md`
- 锁定 truth source、scope、deferred items

### Phase 1

- subgroup stability scale-up：
  - larger-sample subgroup review
  - stability metrics scale-up
  - subgroup-specific findings
  - stability confidence band adjustment where sample supports it

### Phase 2

- interval wording drift audit：
  - audit threshold / session / queue / operator wording
  - identify wording drift by cohort and horizon
  - produce operator-visible wording consistency guidance

### Phase 3

- long-term material impact review：
  - continue step-level material impact ranking
  - distinguish stronger long-term impact from narrow-sample hints
  - expose material impact summary on operator surfaces

### Phase 4

- continuity surfaces
- eval fixtures / harness / tests / e2e
- baseline / report / docs index / self-check / boundary guard

## 6. eval contract

每个 phase 后：

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`

发生真实行为或视图变化后追加：

- `npm run test`
- `npm run build`

最终收口：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 7. 显式延期项

- auto-remediation orchestration
- execution-authority expansion
- team mode / multi-agent runtime
- broader world-model productization
- route / handler rewrite
- public execution surfaces
- auto-send
- broad auto-write
- production-grade telemetry analytics

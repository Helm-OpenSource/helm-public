---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.2 Continuity Pilot Stability Review And Long-term Outcome Refinement Plan v1

更新时间：2026-04-05  
状态：Completed  
适用范围：PR32 narrow continuity pilot stability / long-term outcome refinement slice

## 1. 当前 freeze truth

当前继承的 freeze 口径：

- PR31 已经完成：
  - larger-sample pilot review
  - sample-aware threshold / confidence recalibration
  - long-term outcome correlation
  - guidance refinement
- 当前 continuity calibration 仍然只是 continuity surface 内的 operator-visible review layer：
  - 不驱动 auto-remediation
  - 不扩 execution authority
  - 不等于 production telemetry platform
- 当前 continuity surface 已经能解释：
  - subgroup calibration
  - sample coverage
  - long-term outcome correlation
  - guidance refinement
- 当前仍缺下一层：
  - subgroup stability review
  - confidence band 去假精度
  - SOP guidance 命中后的长期 outcome 复核强化

## 2. PR32 要证明什么

PR32 要把 continuity pilot review 再推进一层，但仍然只在 continuity surface 与 operator workflow 内：

1. 更大 pilot sample 下的 subgroup 是否足够稳定
2. 现有 `HIGH / MEDIUM / LOW` confidence band 在不同 subgroup 下是否带有假精度，需要怎样做 interval simplification
3. SOP guidance 命中后的长期 outcome 是否在稳定 subgroup 上更可信、在不稳定 subgroup 上仍需保持保守
4. 这些结果是否能被 operator 在 meeting detail 与 `/operating` 中直接看懂

## 3. exact review loop

`expanded pilot sample -> subgroup stability review -> confidence interval simplification -> long-term SOP impact refinement -> operator-visible continuity guidance`

这条 loop 只服务 continuity review，不进入自动恢复编排或执行权扩张。

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

- 创建 PR32 plan doc
- 更新 `PLANS.md`
- 锁定 truth source、影响面、显式延期项

### Phase 1

- 在 runtime continuity pilot review 中加入：
  - subgroup stability band
  - stability threshold
  - stability summary
- 先覆盖：
  - cohort family
  - failure class
  - threshold revision
  - session-level pilot review

### Phase 2

- 对 confidence band 做第二层 simplification：
  - revised confidence interval
  - band adjustment rationale
  - stability-aware confidence downgrade
- 保持 guidance advisory only，不改变 execution boundary

### Phase 3

- 继续做 long-term outcome refinement：
  - long-term SOP impact summary
  - variance analysis
  - operator guidance refinement summary

### Phase 4

- 更新 meeting detail / `/operating` continuity surfaces
- 新增 PR32 eval fixture / harness / test / e2e
- 同步 baseline / report / docs index / self-check / boundary guard

## 6. eval contract

PR32 至少新增或更新以下 coverage：

- subgroup stability metrics 在更大 pilot sample 下可见且 truthfully downgraded
- confidence interval simplification 不会把 `NARROW` sample 写成高确定性结论
- threshold / confidence adjustment rationale 可见
- long-term SOP impact summary 与 variance analysis 对 tested cases 输出一致
- meeting detail / `/operating` continuity surfaces 能看见 stability / interval / impact 文案

## 7. 显式延期项

PR32 明确不做：

- auto-remediation orchestrator
- execution-authority expansion
- team mode / multi-agent runtime
- broader world-model productization
- route / handler rewrite
- public execution surfaces
- auto-send
- broad auto-write
- production-grade telemetry analytics

## 8. 关键假设

1. PR32 仍然只使用 repo 内 continuity records、fixture、eval sample，以及已经可直接读取的 meeting metadata
2. subgroup stability 仍然只是 pilot review 口径，不表达生产级稳定性保证
3. revised confidence interval 只表达 operator should-trust-how-much，不表达正式统计置信区间
4. SOP impact 仍然只表达长期 outcome correlation，不表达 SOP 已证明具备因果性

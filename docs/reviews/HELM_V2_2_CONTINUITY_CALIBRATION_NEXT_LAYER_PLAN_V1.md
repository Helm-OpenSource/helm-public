---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.2 Continuity Calibration Review Next Layer Plan v1

更新时间：2026-04-04  
状态：Planned  
适用范围：PR29 continuity calibration next-layer review slice

## 1. current freeze truth

当前 freeze 口径继承：

- `HELM_V2_2_CONTINUITY_PILOT_CALIBRATION_REVIEW_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_PILOT_CALIBRATION_REVIEW_REPORT_V1.md`
- `HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- `PLANS.md`

PR28 已经证明：

- continuity pilot review 已具备 cohort breakdown、threshold revision、drift delta、operator handling effectiveness 的第一层 substrate
- meeting detail 与 `/operating` 已能显示 cohort / threshold / guidance / operator handling
- calibration 仍然是 operator-visible review，不是 auto-remediation，也不是 execution authority

PR29 不改这个 truth，只做下一层更细 review：

- broader pilot cohort coverage
- threshold / confidence recalibration
- longer-horizon drift comparison
- SOP hit-rate vs final operator outcome variance

## 2. what this PR is proving

PR29 要证明的是：

`expanded cohorts -> recalibrated threshold/confidence -> longer-horizon drift review -> SOP variance review -> operator-visible calibration output`

这一层已经足够让 operator 在 continuity surface 上更诚实地回答：

1. 当前 case 属于哪个更细 cohort
2. 当前 threshold / confidence 为什么要收紧或放缓
3. 当前 drift 是短期波动还是长期持续问题
4. 当前 SOP 是命中了但无效，还是被跳过，还是证据不足

## 3. exact review loop

`pilot cohort expansion -> cohort-level threshold/confidence recalibration -> long-horizon drift comparison -> SOP hit-rate vs outcome variance -> runbook refinement hints`

这条 loop 只服务 diagnosis / operator review，不进入自动恢复编排，不产生 execution authority。

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

- 创建 PR29 plan doc
- 更新 `PLANS.md`
- 锁定 current freeze truth、validation contract、explicit defers

### Phase 1

- finer cohort substrate
- 新增更细 cohort 切法：
  - workspace size
  - meeting shape
  - failure pattern
  - remediation posture
- 输出 cohort-level：
  - failure distribution
  - remediation success rate
  - drift summary

### Phase 2

- threshold / confidence recalibration
- 输出：
  - revised threshold suggestions by cohort
  - more specific confidence bands by cohort
  - low / watch / high risk-band distribution

### Phase 3

- longer-horizon drift comparison
- 输出：
  - recent drift
  - older drift
  - long-horizon drift
  - repeat ineffective trend
  - remediation effectiveness change

### Phase 4

- SOP hit-rate vs final operator outcome variance
- 输出：
  - hit / skip / ineffective-after-hit by SOP step
  - operator outcome variance summary
  - runbook refinement hints

### Phase 5

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

## 7. explicitly deferred items

- auto-remediation orchestration
- execution-authority expansion
- team mode / multi-agent runtime
- broader world-model productization
- route / handler rewrite
- public execution surfaces
- auto-send
- broad auto-write

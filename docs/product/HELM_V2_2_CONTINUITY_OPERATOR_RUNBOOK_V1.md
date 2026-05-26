---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.2 Continuity Operator Runbook v1

更新时间：2026-04-05  
状态：Operator Guidance  
适用范围：continuity remediation analytics / pilot effectiveness review / operator workflows

## 1. 先看什么

先按这个顺序读 continuity surface：

1. `recovery state / failure taxonomy`
2. `remediation analytics`
3. `evidence surface`
4. `rollback anchor`
5. `operator runbook`

如果 `repeat-pattern != NONE`，优先处理 repeat-pattern，不要先继续点 remediation。

## 2. repeat-pattern 读法

- `REPEATED_BLOCKED_ACTION`
  - 含义：同一个 bounded remediation action 被重复拦下
  - 动作：停止重试，先清 blocker 或补 substrate
- `REPEATED_REVIEW_REQUIRED`
  - 含义：重复尝试后仍然处在 protected-field review posture
  - 动作：先补 confirmed facts / boundary note / protected field review
- `REPEATED_REPRUNE_LOOP`
  - 含义：反复 re-prune 后 continuity 仍没回到 stable
  - 动作：对照 rollback anchor，决定 restore 还是 escalate，不要继续 reprune

## 3. bounded remediation 何时可用

- `RESUME_CHECKPOINT`
  - 只在当前 continuity 应回到最近 verified snapshot 时使用
- `REPRUNE_CONTEXT`
  - 只在 blockers / decisions / next actions / owner / due date / boundary notes 仍然明确可见时使用
- `SAVE_RECOVERY_CHECKPOINT`
  - 只在当前 continuity state 已确认正确时使用

## 4. 什么时候不能动

- `REVIEW_REQUIRED`
  - 不要把 remediation 当成绕过 review 的通道
- `BLOCKED`
  - 当前 surface 不能安全恢复，先补 recovery anchor 或重建 continuity substrate

## 5. 边界

- operator runbook 只提供诊断和 bounded remediation guidance
- recommendation != commitment
- no auto-send
- no broad auto-write
- no execution-authority expansion

## 6. PR27 扩展读法

新增先看三件事：

1. `pilot effectiveness review`
   - 当前 failure class 在 pilot 里出现多少次
   - 当前是 `HIGH / MEDIUM / LOW` 哪个 confidence band
   - 当前建议 threshold 是 `1` 还是 `2`
2. `drift`
   - 这是 improving / stable / drifting 哪一类
   - repeat ineffective 是否已经出现
3. `SOP`
   - 这次应该按哪个 failure class SOP 处理
   - escalation rule 是什么
   - 常见误区是什么

## 7. failure class SOP 快速规则

- `NO_RECOVERY_ANCHOR`
  - 先补 anchor，再谈 remediation
  - 不要在 noisy continuity state 上新存 checkpoint
- `BUDGET_PRESSURE`
  - 先确认 blockers / owners / due dates / boundary note 没丢，再谈 reprune
  - 如果 repeated reprune 仍无效，转 review
- `PAYLOAD_STATE_DRIFT`
  - 先核 active handles / pruned handles / checkpoint derivation
  - handle / preview / summary 不一致时，先停用当前视图
- `REPLAY_DRIFT`
  - 先看 missing fields，再决定 restore 还是 review
  - 不要把“恢复了 checkpoint”误当成“已经恢复了正确性”
- `PROTECTED_STATE_GAP`
  - 先 review，不要把 remediation 当捷径
  - protected fields 必须有 source grounding

## 8. PR28 校准读法

PR28 之后先再补看四件事：

1. `workspace cohort`
   - 当前 workspace 落在 `SMALL / GROWING / LARGE` 哪个 band
   - 当前进入 pilot review 的 session 占比是多少
2. `meeting shape cohort`
   - 当前 session 属于 `LEAN_MEETING / LONG_CONTEXT_MEETING / RESUMED_MEETING` 哪类
   - 这一类的 remediation success / drift 现在是什么水平
3. `threshold revision`
   - 当前 threshold 是 failure class 收紧，还是 meeting shape 收紧
   - 只把它当 operator suggestion，不把它当自动收紧策略
4. `operator handling`
   - 看 `matched guidance / skipped guidance / ineffective after guidance`
   - 如果 summary 提示 mixed，不要假设 SOP 已经被稳定执行

## 9. operator handling 对照规则

- `MATCHED_GUIDANCE`
  - 当前 operator handling 和 failure class / cohort guidance 大体一致
- `SKIPPED_GUIDANCE`
  - 当前有 visible signal 表明 escalation 或 bounded remediation guidance 可能被跳过
- `INEFFECTIVE_AFTER_GUIDANCE`
  - operator 大体按 guidance 做了，但结果仍无效
- `NEEDS_MORE_EVIDENCE`
  - 当前还不能诚实地把 operator handling 归成命中或跳过

## 10. PR29 next-layer 读法

PR29 之后再补看四件事：

1. `cohort family`
   - 当前 session 不是只落在 workspace / meeting shape cohort
   - 还会落在更细的 `workspace size · meeting shape · failure class` family
   - 先看这个 family 的 `risk band`、`threshold`、`longHorizonSummary`
2. `recalibration highlights`
   - 先看 `riskBandSummary`
   - 再看 `revisedHighlights`
   - 它们只表示 operator-visible calibration suggestion，不表示系统会自动收紧
3. `long-horizon drift`
   - 先对照 `recent / older / middle / oldest / long horizon`
   - 如果 `materially drifting cohorts` 仍然存在，不要把单次 partial improvement 当成稳定恢复
4. `operator outcome variance`
   - 先看 `outcomeVarianceSummary`
   - 再看 `stepReviews`
   - 如果某一步长期是 `skipped` 或 `ineffective after hit`，先收紧 evidence review，再决定是否重复同一路 remediation

## 11. PR29 SOP refinement 规则

- `Anchor check`
  - 如果 skip rate 高，说明 operator 仍在 blocked posture 上盲目重试
  - 应先停重试，再补 recovery anchor 或升级 review
- `Prune trace review`
  - 如果 ineffective-after-hit 高，说明 reprune 虽然被执行，但没有稳定恢复 continuity
  - 应先收紧 evidence collection，再决定 restore 还是 review
- `Handle lineage review`
  - 如果 variance 高，优先核对 active / pruned handle lineage
  - 不要把 handle 漂移误当成模型随机性
- `Replay gap review`
  - 如果 long-horizon drift 仍高，先核 checkpoint + post-checkpoint edit fold
  - 不要把 replay 成功误写成 correctness 成功
- `Protected field review`
  - 如果 repeated review 仍多，说明 protected state 还没有被 source-grounded 解开
  - 先补 confirmed facts 和 boundary note，不要绕开 review

## 12. PR30 deepening 读法

PR30 之后再补看四件事：

1. `finer subgroup posture`
   - 先看 session density、meeting cadence、failure history、participants
   - 当前 subgroup 只是 operator-visible calibration label，不表示系统会自动调整策略
2. `subgroup calibration`
   - 先看 `subgroupSummary`
   - 再看 `refinedCalibrationSummary`
   - 如果 subgroup calibration 和当前直觉冲突，先回到 evidence / trace，而不是直接重试 remediation
3. `drift synthesis`
   - 先看 `driftSynthesisSummary`
   - 再看 `/operating` 里的 synthesis panels
   - 如果 drift synthesis 提示 drift 正在集中，不要把单次 partial recovery 当成稳定改善
4. `SOP effectiveness`
   - 先看 `sopEffectivenessSummary`
   - 再看 aggregate summary 与 highlights
   - 如果某一步长期是 hit 但结果仍差，优先收紧 review 和 evidence，不要继续盲目重复

## 13. PR30 subgroup / synthesis 快速规则

- `Session density review`
  - density 高时，先确认 checkpoint、prune trace、loaded handles 仍然可解释
  - 不要把 noisy density 误写成模型随机性
- `Meeting cadence review`
  - cadence 高时，先确认 replay / resume 之后的 edits fold 没有遮掉当前连续性问题
  - 不要把历史问题混成当前 single-session 异常
- `Failure history review`
  - history 重时，优先看 repeated ineffective posture 和 drift synthesis
  - 如果 history 已经显示 chronic repeat，先升级 review，不要继续按同一路 bounded remediation 重试
- `Participant posture review`
  - participants posture 只来自当前 metadata
  - 当 metadata 不足时，把它当弱提示，不要当成强结论
- `SOP effectiveness review`
  - 如果 aggregate summary 显示 guidance 命中高但 outcome 仍差，优先怀疑 calibration 读法和 evidence 质量
  - 如果 highlights 显示 skip 高，先收紧 operator handoff 和 reminder，而不是增加动作种类

## 14. PR31 larger-sample / long-horizon 读法

PR31 之后再补看四件事：

1. `sample review`
   - 先看当前 subgroup / threshold suggestion 是 `NARROW / QUALIFIED / BROAD`
   - `NARROW` 只表示 advisory，不表示稳定真理
2. `sample-aware recalibration`
   - 先看 `sampleCoverageSummary`
   - 再看 `thresholdRevisionSummary`
   - 如果 sample 仍窄，不要因为单次改善就放松 review posture
3. `long-term outcome correlation`
   - 先看当前 step 是 `AT_RISK / WATCH / STABLE`
   - 再看 long-horizon summary 与 aggregate summary
   - 相关性只说明“更常一起出现”，不说明因果已经被证明
4. `guidance refinement`
   - 先看当前 at-risk step 的 improvement hint
   - 再看是否需要把 evidence collection、review gate、handoff wording 收紧

## 15. PR31 quick rules

- `NARROW sample`
  - 只把阈值和 confidence 当成 operator hint
  - 不要把 narrow sample 写成长期 truth
- `QUALIFIED sample`
  - 可以显示 subgroup guidance
  - 但仍然保持 review-first，不自动放松 threshold
- `BROAD sample`
  - 可以把 subgroup / threshold / confidence 作为更强的 operator readout
  - 但仍然不进入自动恢复或执行权限扩张
- `AT_RISK correlation`
  - 先收紧 evidence collection，再决定是否重复同一路 remediation
  - 不要把“当前 step 命中过”误当成“长期结果稳定”
- `STABLE correlation`
  - 可以把该 step 放在 runbook 更靠前位置
  - 但仍然要保留 boundary、rollback anchor 和 local evidence 对照

## 16. PR32 stability / confidence interval 读法

PR32 之后再补看四件事：

1. `subgroup stability`
   - 先看当前 subgroup 是 `UNSTABLE / WATCH / STABLE`
   - `UNSTABLE` 不是“不能用”，而是“不能把当前 calibration 写成稳态 truth”
2. `stability threshold`
   - 看 aggregate summary 里的 baseline threshold
   - 如果 subgroup 还没过阈值，不要因为单次 outcome 变好就放松 review-first posture
3. `confidence interval`
   - `WIDE` 表示当前只适合 operator hint
   - `GUARDED` 表示可以读，但仍需和 evidence / rollback anchor 对照
   - `SETTLED` 也只表示 continuity review 比较稳定，不表示 execution authority 被放开
4. `long-term SOP impact`
   - 先看某一步是 steady 还是 at-risk
   - 再看它的 interval 和 subgroup stability 是否同时成立

## 17. PR32 quick rules

- `UNSTABLE subgroup`
  - 不要把当前 threshold / confidence 当成稳定配置
  - 先收 evidence，再决定是否继续沿用同一条 remediation path
- `WIDE interval`
  - 这是反假精度信号，不是 bug
  - 看到 `WIDE` 时，优先保守解释，避免把 pilot readout 写成长期 truth
- `SETTLED interval`
  - 只说明当前 review layer 更稳
  - 不说明可以自动恢复、自动发送或自动写入
- `long-term SOP impact`
  - 如果 impact 仍 at-risk，优先 tightening evidence collection
  - 如果 impact 较稳，也仍然要保留 operator judgement 和 rollback anchor 对照

## 18. PR33 stability recheck / wording / materiality 读法

PR33 之后再补看四件事：

1. `stability confidence`
   - 先看当前 subgroup 是 `HIGH / MEDIUM / LOW`
   - 这不是新的 authority，只是告诉你当前 recheck 的 variance 有没有大到必须更保守
2. `interval wording`
   - meeting detail、queue、`/operating` 现在都应复用同一套 canonical wording
   - 如果 wording 不一致，优先视为 surface drift，而不是把两种说法都当真
3. `long-term outcome review`
   - 先看 summary / aggregate summary
   - 再看哪一步当前 material impact 最大
4. `material impact`
   - `HIGH` 表示这一步对长期 outcome 的影响已经足够大，需要显式放在 runbook 前面
   - `WATCH` 表示可以看，但不能过度解释
   - `LOW` 表示样本还太薄，当前更多是提示而不是稳定结论

## 19. PR33 quick rules

- `LOW stability confidence`
  - 不要把 subgroup readout 写成稳定 truth
  - 先回到 evidence、rollback anchor 和 local continuity trace
- `canonical interval wording`
  - `WIDE`、`GUARDED`、`SETTLED` 的读法应该在所有 surface 一致
  - 如果某个 surface 漏掉 canonical wording，先修文案一致性，不要自作解释
- `HIGH material impact`
  - 说明这一步已经值得被显式排进 operator review 优先级
  - 但仍然不是自动恢复，也不是 execution authority
- `positive long-term impact`
  - 只说明更常和稳定 outcome 一起出现
  - 不说明已经证明 SOP 对结果有因果性
- `negative long-term impact`
  - 优先 tightening evidence collection、review gate 和 rollback 对照
  - 不要因为 repeated hit 就继续盲目重试同一路 remediation

## 20. PR34 scale-up / wording drift / materiality 读法

PR34 之后再补看三件事：

1. `stability scale-up`
   - 先看当前 scale-up summary / aggregate summary
   - 再看 findings 里哪些 subgroup 现在是 broader-sample，哪些仍是 fragile / narrow-sample pocket
2. `interval wording drift audit`
   - 先看 `aligned / drifted` 计数
   - 如果 drifted 不为 0，优先把它当 surface consistency 问题，而不是当成新的 runtime truth
3. `long-term material impact review`
   - 先看当前 step 是 broader-sample material signal，还是 narrow high-impact hint
   - 如果 still unstable，先回到 local evidence、rollback anchor 和 subgroup stability

## 21. PR34 quick rules

- `stability scale-up`
  - broader-sample subgroup 只表示 operator readout 更稳
  - 不表示 execution authority 被放开
- `wording drift audit`
  - 发现 drift 时，先修 wording consistency
  - 不要把两套 wording 同时当成 truth
- `narrow high-impact hint`
  - 仍然只是 advisory signal
  - 不要把 narrow impact 直接提到 runbook 的硬规则
- `material impact review`
  - 先结合 subgroup stability 一起看
  - 如果 impact 高但 stability 仍低，优先保持 review-first 和 evidence-first

## 22. PR35 scale-up recheck / wording drift / material impact audit 读法

PR35 之后再补看三件事：

1. `scale-up recheck`
   - 先看当前 scale-up recheck summary / aggregate summary
   - 再看 findings 里哪些 subgroup 现在仍是 variance-carrying，哪些已经能保持 broader-sample stable readout
2. `wording drift tracking`
   - 先看当前 drift rate
   - 再看 interval consistency guidance 里的 `WIDE / GUARDED / SETTLED` canonical wording
   - 如果 drift rate 不为 0，优先把它当 continuity wording consistency 问题，而不是新的 runtime truth
3. `long-term material impact audit`
   - 先看当前 impact pattern
   - 再看 optimization hint
   - 如果 still unstable，先回到 local evidence、rollback anchor 和 subgroup stability

## 23. PR35 quick rules

- `scale-up recheck`
  - broader-sample stable 只表示当前 operator readout 更稳
  - 不表示 recovery 可以自动推进
- `wording drift tracking`
  - drift rate 是 consistency 信号，不是新 authority
  - 发现 drift 时，先修 wording 和 guidance，不要把两套 wording 同时当成 truth
- `interval consistency guidance`
  - `WIDE / GUARDED / SETTLED` 应该在 meeting detail、queue、`/operating` 用同一套 canonical wording
  - 如果某个 surface 漏掉 guidance，先修 surface，不要让 operator 自己补解释
- `material impact audit`
  - 先看 impact pattern，再看 optimization hint
  - 如果 impact 高但 subgroup stability 仍低，优先 evidence-first，不要把它升级成 runbook 硬规则

## 24. PR36 subgroup drift / wording aging / impact aging 读法

PR36 之后再补看三件事：

1. `subgroup stability drift review`
   - 先看当前 subgroup drift review summary / aggregate summary
   - 再看 findings 里哪些 cohort 现在仍是 steady、watch、drifting
   - 如果 longer-horizon drift 仍高，先把它当 review-first signal，而不是新的长期 truth
2. `interval wording aging audit`
   - 先看 regression rate
   - 再看 findings 里哪些 readout 仍保持 canonical wording，哪些已经开始回归漂移
   - 如果 regression rate 不为 0，优先修 wording consistency，不要把 drift wording 当成新 authority
3. `material impact pattern aging review`
   - 先看当前 pattern 是 persistent、fading，还是 unstable
   - 再看 optimization hint
   - 如果 pattern 还在 fading 或 unstable，先回到 local evidence、rollback anchor 和 subgroup stability

## 25. PR36 quick rules

- `subgroup drift review`
  - steady 只表示当前 longer-horizon readout 更稳
  - 不表示 remediation 可以自动推进
- `wording aging audit`
  - regression rate 是 continuity consistency 信号，不是新 authority
  - 发现 regression 时，先修 wording，不要让 operator 自己补解释
- `material impact aging review`
  - persistent 只表示 longer-horizon pattern 更稳
  - 不表示 SOP 因果已经成立
- `fading / unstable impact`
  - 优先 evidence-first、review-first
  - 不要把 fading pattern 升级成 runbook 硬规则

## 26. PR37 subgroup cohort aging / wording regression / impact sampling 读法

PR37 之后再补看三件事：

1. `cohort aging review`
   - 先看当前 cohort aging summary / aggregate summary
   - 再看 findings 里哪些 subgroup 现在是 holding、watch、aging-drift
   - 如果 cohort aging 仍有 drift pocket，优先保持 review-first，不要把局部改善写成长期稳定
2. `cross-surface wording regression`
   - 先看 regression rate
   - 再看 meeting detail、queue、operator panel、runbook 是否还在复用同一套 canonical interval wording
   - 如果 regression rate 不为 0，优先修 wording consistency，不要把 surface drift 当成新的 runtime truth
3. `material impact sampling review`
   - 先看当前 impact 是 broader-sample signal 还是 narrow hint
   - 再看 findings 和 optimization hint
   - 如果 sampling 仍在 fading 或 unstable，优先回到 local evidence、rollback anchor 和 subgroup drift

## 27. PR37 quick rules

- `cohort aging review`
  - holding 只表示当前 longer-horizon subgroup readout 更稳
  - 不表示 recovery 可以自动推进
- `cross-surface wording regression`
  - regression rate 是 consistency 信号，不是新 authority
  - 发现 regression 时，先统一 meeting detail、queue、operator panel、runbook wording
- `material impact sampling review`
  - broader-sample signal 只表示 impact 更值得被持续观察
  - 不表示 SOP 因果已经成立
- `narrow hint / unstable sampling`
  - 优先 evidence-first、review-first
  - 不要把 narrow hint 升级成 runbook 硬规则

## 28. PR38 subgroup drift aging scale-up / wording consistency / sampling aging 读法

PR38 之后再补看三件事：

1. `subgroup drift aging scale-up review`
   - 先看当前 scale-up aging summary / aggregate summary
   - 再看 findings 里哪些 subgroup 现在是 broad-holding、watch、aging-drift
   - 如果 scale-up aging 仍有 aging-drift pocket，优先保持 review-first，不要把 larger-sample readout 写成 durable stability
2. `cross-surface interval wording consistency audit`
   - 先看 consistency audit rate
   - 再看 meeting detail、queue、operator panel、runbook 是否仍在复用同一套 canonical interval wording
   - 如果 consistency audit rate 不是稳定通过，优先修 wording consistency，不要把 surface wording difference 当成新的 runtime truth
3. `material impact sampling aging review`
   - 先看当前 impact 是 persistent signal、watch signal，还是 unstable hint
   - 再看 findings 和 optimization hint
   - 如果 sampling aging 仍在 watch 或 unstable，优先回到 local evidence、rollback anchor 和 subgroup drift

## 29. PR38 quick rules

- `subgroup drift aging scale-up review`
  - broad-holding 只表示当前更大 cohort aging readout 更稳
  - 不表示 recovery 可以自动推进
- `cross-surface interval wording consistency audit`
  - consistency audit rate 是 consistency 信号，不是新 authority
  - 发现 consistency 回落时，先统一 meeting detail、queue、operator panel、runbook wording
- `material impact sampling aging review`
  - persistent signal 只表示 impact 更值得被持续观察
  - 不表示 SOP 因果已经成立
- `watch signal / unstable hint`
  - 优先 evidence-first、review-first
  - 不要把 sampling aging hint 升级成 runbook 硬规则

## 30. PR39 subgroup drift long-term cohort aging / wording regression audit / impact refinement 读法

PR39 之后再补看三件事：

1. `subgroup drift long-term cohort aging review`
   - 先看当前 long-term cohort aging summary / aggregate summary
   - 再看 findings 里哪些 subgroup 仍然是 broader holding、哪些已经进入 aging-drift 或 weakening
   - 如果 long-term cohort aging 仍有 aging-drift pocket，优先保持 review-first，不要把更长 horizon readout 写成 durable stability
2. `cross-surface interval wording regression audit`
   - 先看 regression audit rate
   - 再看 regression signal 是 wording drift，还是 canonical coverage gap
   - 如果 audit 不是 0%，优先一起复核 meeting detail、queue、operator panel、runbook 的 wording，不要把 surface wording 差异当成新的 runtime truth
3. `material impact sampling aging refinement`
   - 先看当前 impact 是 persistent signal、watch signal，还是 unstable hint
   - 再看 findings 和 optimization hints
   - 如果 refinement 仍在 watch 或 unstable，优先回到 local evidence、rollback anchor 和 subgroup drift review

## 31. PR39 quick rules

- `subgroup drift long-term cohort aging review`
  - broader holding 只表示当前更长 horizon readout 还算稳定
  - 不表示 recovery 可以自动推进
- `cross-surface interval wording regression audit`
  - regression audit rate 是 consistency / coverage 信号，不是新 authority
  - 发现 wording drift 或 coverage gap 时，先统一 meeting detail、queue、operator panel、runbook wording
- `material impact sampling aging refinement`
  - persistent signal 只表示 impact 更值得被持续观察
  - 不表示 SOP 因果已经成立
- `watch signal / unstable hint`
  - 优先 evidence-first、review-first
  - 不要把 refinement hint 升级成 runbook 硬规则

## 32. PR40 subgroup drift long-term sample expansion / cross-readout wording audit / material impact audit 读法

PR40 之后再补看三件事：

1. `subgroup drift long-term sample expansion review`
   - 先看 summary / aggregate summary，确认当前 subgroup 是 expanded-holding、expanded-watch，还是 expansion-risk
   - 再看 findings 里哪些 cohort 仍然只是 narrow-support 或 drift-heavy pocket
   - 如果 sample expansion 仍偏 risk，优先保持 review-first，不要把 larger-horizon sample 扩样误读成稳定 truth
2. `cross-readout interval wording regression audit`
   - 先看 regression audit rate
   - 再看 regression signal 是 threshold / step / guideline 哪层缺 coverage，还是 wording 已经 drift
   - 如果 audit 不是 0%，优先一起复核 meeting detail、queue、operator panel、runbook、runtime summary，不要把单一 readout 差异当成新的 runtime truth
3. `material impact sampling aging audit`
   - 先看当前 impact 是 durable、watch，还是 unstable
   - 再看 findings 和 optimization suggestions
   - 如果 audit 仍在 watch 或 unstable，优先回到 local evidence、rollback anchor、subgroup drift review，不要把 longer-horizon sampling 直接写成 durable SOP rule

## 33. PR40 quick rules

- `subgroup drift long-term sample expansion review`
  - expanded-holding 只表示当前 larger-horizon sample 仍相对稳
  - 不表示 recovery 可以自动推进
- `cross-readout interval wording regression audit`
  - readout regression audit rate 是 consistency / coverage 信号，不是新 authority
  - 发现 threshold / step / guideline coverage gap 时，先统一 canonical wording，再判断 surface 是否稳定
- `material impact sampling aging audit`
  - durable 只表示 impact 更值得持续观察
  - 不表示 SOP 因果已经成立
- `watch / unstable`
  - 优先 evidence-first、review-first
  - 不要把 sampling aging audit hint 升级成 runbook 硬规则

## 34. PR41 subgroup drift sample refinement / cross-readout refinement / impact refinement audit 读法

PR41 之后再补看三件事：

1. `subgroup drift long-term sample expansion refinement review`
   - 先看 summary / aggregate summary，确认当前 subgroup 是 deep-support、mixed-support，还是 fragile-support
   - 再看 findings 里哪些 cohort 只是 broader-sample holding，哪些仍然是 narrow-support 或 drift-heavy pocket
   - 如果 refinement 仍偏 fragile-support，优先保持 review-first，不要把 sample-depth 扩样误读成稳定 truth
2. `cross-readout interval wording regression refinement`
   - 先看 refinement rate
   - 再看 regression signal 是 threshold / step / guideline 缺 coverage，还是 session summary / queue summary / operator card 这些 continuity readout family 还没对齐
   - 如果 refinement 不是 0%，优先一起复核 meeting detail、queue、operator panel、runbook、session summary，不要把单一 readout 差异当成新的 runtime truth
3. `material impact sampling aging refinement audit`
   - 先看当前 impact pattern 是 durable-comparison、mixed-comparison，还是 regressing-comparison
   - 再看 findings 和 optimization suggestions
   - 如果 refinement audit 仍在 mixed 或 regressing，优先回到 local evidence、rollback anchor、subgroup drift review 和 wording refinement，不要把 longer-horizon comparison 直接写成 durable SOP rule

## 35. PR41 quick rules

- `subgroup drift long-term sample expansion refinement review`
  - deep-support 只表示当前 larger-horizon sample-depth 仍相对稳
  - 不表示 recovery 可以自动推进
- `cross-readout interval wording regression refinement`
  - refinement rate 是 consistency / coverage 信号，不是新 authority
  - 发现 session summary / queue summary / operator card coverage gap 时，先统一 canonical wording，再判断 surface 是否稳定
- `material impact sampling aging refinement audit`
  - durable-comparison 只表示 impact 更值得持续观察
  - 不表示 SOP 因果已经成立
- `mixed / regressing`
  - 优先 evidence-first、review-first
  - 不要把 refinement audit hint 升级成 runbook 硬规则

## 36. continuity stable closeout / maintenance-only 读法

continuity surface 现在按 `stable & maintained` 理解：

1. 现有 meeting detail、queue、operator panel、runbook、eval、e2e、self-check、boundary guard 继续保留
2. 当前 continuity 默认进入 `maintenance-only`
3. 不再继续默认开新的 continuity deepening PR

只有下面几类情况，continuity 才应重新进入开发：

- 真实风险
- 回归
- wording drift 重新造成 operator 误读
- eval / e2e / self-check / boundary guard 失败
- replay fidelity / prune trace / payload externalization 出现真实失真

## 37. continuity stable closeout quick rules

- `stable & maintained`
  - 只表示 continuity 基线足够稳定，可以继续维护
  - 不表示 execution authority 被放开
- `maintenance-only`
  - 只表示 drift / calibration / impact review 转入 watchlist
  - 不表示 auto-remediation 已批准
- `next direction`
  - 如果后续要进入 execution surface、multi-agent common patterns 或其他更大方向，必须另开 scoped plan
  - 不要把当前 closeout 误读成已经批准下一条大开发线

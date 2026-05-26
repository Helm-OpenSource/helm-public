---
status: archived
owner: helm-core
created: 2026-04-13
review_after: 2026-10-10
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Agent Runtime Substrate Phase 1 Freeze Report V1

## 结论

`Helm Agent Runtime Substrate` 到当前这一阶段的冻结结论是：

- `已成形但仍需下一层`

原因很直接：

- `Run Thread / Operator Debugger / Typed Interrupt + Handoff / Project Skill Library + Environment Contract / Benchmark Matrix` 五条基础线已经接进同一条 current-main runtime substrate
- `trace / checkpoint resume / continuity queue / meeting runtime surface / /operating` 已经共享统一的 `runThread`、debugger read model、environment posture 和 operator summary
- 但这仍然不是完整 workflow engine、不是统一 persisted control plane、不是完整 operator debugger、也不是 execution-authority expansion

## 已经完整成立

- `runId / threadId / checkpointId / resumeToken` 已经有统一 contract，`trace`、`checkpoint resume` 与 continuity/operator surface 都会返回同一份 `runThread`
- debugger read spine 已成立：`history / variable snapshot / replay assistance / interrupt reason / resume ask / handoff payload skeleton / human input checkpoint / operator takeover assistance` 都已经进入 typed read model
- interrupt / handoff / takeover / human-input request 的 typed ledger 已成立，并通过 `RuntimeEvent` 回写到统一 lifecycle spine，而不是继续只靠页面自由文本承接
- `projectSkillLibrary / environmentContract / executionSeam / executionAuthority` 已成立为 project-scoped runtime truth，`connector / browser / control-plane / workspace-context / official-action` 都已有明确 seam
- benchmark matrix 已成立为统一 read model 与脚本入口，`requested / recorded / acknowledged / followthrough` 也已进入 typed workflow，并保留 workspace-scoped runtime evidence
- closeout / settlement / close request / close lifecycle / close control / close decision / close resolution 这条 thread-level canonical summary 链已经成立，operator 不再需要跨多个局部 surface 手工拼 close truth
- workspace-level operator summary 链已经成立：`operatorControlSummary / operatorProgressSummary / operatorActionSummary / operatorWorkSummary / operatorReviewSummary / operatorReviewActionSummary / operatorCueSummary / operatorNextMoveSummary / operatorActionCueSummary / operatorReviewControlCueSummary / operatorStartPointSummary`
- README、docs index、PLANS、自检、回归测试和 benchmark/e2e 验证入口已经同步到 current-main truth

## 已成形但仍需下一层

- `runThread` 仍主要是统一 read contract，不是完整 persisted control plane；更深一层的 write-lifecycle normalization 还没完成
- operator debugger 已有 read spine、takeover request/ack/start/release 与 follow-through seam，但还不是成熟的 `trace / replay / checkpoint / human input` 一体化 operator debugger
- environment execution authority 现在还是 bounded truth read model，不是更正式的 execution authority contract，更不是 broad auto-execution plane
- benchmark workflow 已进入 request/ack/follow-through，但还没形成更完整的 benchmark control-plane 和跨 workspace evidence orchestration
- workspace operator summaries 已经足够降低扫描成本，但 summary layering 仍然偏厚，后续还需要更稳定的 surface contract 收敛

## 刻意未做

- 不做完整 workflow engine
- 不做完整 agent orchestration 平台
- 不做 plugin sandbox
- 不做 marketplace / skill ecosystem
- 不做高风险自动发送、高风险自动承诺、高风险自动改状态
- 不做 debugger auto-takeover
- 不把 runtime trace / operator summary 包装成 customer-facing commitment surface

## 风险项

- `run-thread` 与 operator summary 这一层的 read model 已经较密，后续如果不收敛，会有 summary stacking 继续增长的维护风险
- `runtime-upgrade.ts`、meeting runtime surface 和 `/operating` operator panel 仍然是高热文件，后续继续推进时要继续防止再堆成单文件复杂度债
- closeout / settlement / close resolution 这条 canonical summary 链逻辑已经完整，但仍需要更多真实 operator 使用证据来验证命名与优先级是否稳
- 当前这一阶段是在同一条长分支上收口，虽然验证链已全跑，但后续进入 `main` 后仍需要观察实际使用下的 discoverability 和 operator 理解成本

## 必须继续诚实保留的边界

- 这仍然不是完整 workflow engine
- 这仍然不是完整 operator debugger
- 这仍然不是完整 execution authority plane
- 这仍然不是 sandbox / marketplace / full orchestration platform
- 当前主动机制仍默认以 `建议 / 准备 / 升级 / review-first` 为主，不默认拥有高风险自动承诺和高风险自动发送权限

## 当前基线 / sprint 目标是否清楚

清楚。

当前阶段的正式收口目标是：

- 先把 `runtime substrate` 的五条基础线和 operator-facing canonical summary 链冻成 current-main truth
- 再把 README / docs index / self-check / regression 入口同步到同一版 discoverability
- 维持 `judgement-first / review-first / boundary-first / business-first` 不被“更强自治”叙事带偏

## recommendation / commitment 两条主线是否仍保持稳定

保持稳定，仍然是 `A-minus`。

当前这一阶段没有把：

- recommendation 写成 commitment
- explanation 写成承诺
- proactive 写成自动替人决策
- runtime trace / operator summary 写成客户承诺面

## 下一阶段最该做的 5 件事

1. 把 `run-thread` 再往前推进到更完整的 persisted control-plane lifecycle，而不是继续只加 read summary。
2. 把 operator debugger 从“read spine + bounded actions”推进到更清楚的 `trace / replay / checkpoint / human input` operator debugger contract。
3. 把 `environment execution authority` 从当前 read-model truth 继续收成更稳定的 bounded authority contract，但仍保持 review-first。
4. 把 benchmark workflow 从 `request / record / acknowledge / follow-through` 再推进到更清楚的 workspace-level evidence/control loop。
5. 逐步收敛 operator summary layering，防止 `operator*Summary` 继续指数式堆叠，优先把最常用的 top-level cues 固化成更稳定的 surface contract。

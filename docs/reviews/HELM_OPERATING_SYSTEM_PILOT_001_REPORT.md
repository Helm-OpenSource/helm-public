---
status: archived
owner: helm-core
created: 2026-03-30
review_after: 2026-09-26
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Operating System Pilot 001 Report

## Session summary

- date / time: 2026-03-30 10:05 CST
- participants: Codex operator（pilot lead / observer / primary-user proxy）；无第二位真实协作者观察者
- branch / commit: `main` / `324bbde`
- build / environment: 本地当前工作树，使用 `http://127.0.0.1:3101` 的新实例进行手工观察；pre-flight gate 全绿后开始
- surfaces reviewed:
  - `/dashboard`
  - `/approvals`
  - `/memory`
  - `/diagnostics`
- real cases reviewed:
  - Founder / COO：`Acme 年度经营动作控制台试点`
  - Sales lead：`NorthBridge RevOps 可视化试点`
  - Recruiter：`Julian Chen 候选人修复`

## Snapshot summary

- object state layer: present
- skill catalog: present
- event signal layer: present
- recommendation-context layer: present
- approval-boundary layer: present
- audit reason-chain layer: present
- readiness layer: present
- dashboard arbitration layer: present
- dashboard cue coverage: present
- memory cue coverage: present
- approvals cue coverage: present
- diagnostics cue coverage: present

## Observation highlights

- what clearly worked:
  - dashboard 已经像 arbitration center，而不是信息首页。
  - 三个 demo case 的首页 headline 和推荐对象都明显不同，角色差异真实存在。
  - approvals 页已经被读成 boundary console，而不是普通待办列表。
  - diagnostics 页能被直接读成“是否可以扩大试点”的判断页。
- what was partly clear:
  - approvals 页的 reason-chain 能力存在，但首屏不够显眼。
  - memory 页具备 object-state substrate cue，但首次阅读仍偏 timeline-first。
  - demo 引导条有用，但和首屏 headline / primary CTA 竞争层级。
- what remained unclear:
  - 协作者在首屏能否立刻读懂“谁在推 / 谁在审”的完整关系，还需要第二位真实观察者验证。
  - “理由链”是否足够前置到 first-screen，需要一轮小修后再验证。
- collaborator-side observations:
  - 本轮无真实 collaborator observer，只有代理阅读。
  - 代理阅读下，approvals 页能解释 boundary posture，但 dashboard 和 memory 页的 collaborator clarity 仍偏间接。
- governance / non-commitment observations:
  - 没有观察到把页面误读成 send authority 的显著风险。
  - 没有观察到把页面误读成 workflow-control system-of-record 的显著风险。
  - non-commitment posture 在 approvals 和 diagnostics 两页最清楚。

## Preserved boundaries

- accidental commitment drift observed? `no`
- accidental send-authority implication observed? `no`
- accidental workflow-control implication observed? `no`
- notes:
  - 本轮看到的是 cue / surface coverage 与手工观察，不是 send authority 或 workflow control 验证。
  - root `app/` 仍然是 route owner，`data/queries.ts` 仍是 compatibility façade，这些 current-main truth 没有被这轮 pilot package 改写。

## Issues found

- issue 1: approvals 首屏的 boundary state 清楚，但 reason-chain / skill cue 没有同样靠前。
- issue 2: memory 首屏仍容易先被理解成 timeline 页，而不是 object-state substrate。
- issue 3: demo 引导条与主页面首屏都在讲“当前建议 / 当前所在 / 下一步”，存在 rich-vs-thin 竞争。

## Recommendation

- go: 否
- conditional-go: 是
- no-go: 否
- rationale:
  - 这条 operating-system 主回路已经有真实价值，而且能在 3 条 demo 线里跑成一个一致的叙事。
  - 但第一次阅读的层级还没有稳到可以直接给 `go`。
  - 最合理的下一步是只做一轮小修，范围限定在 wording / hierarchy / boundary cue clarity / rich-vs-thin differentiation，然后再做 Pilot 002。

## Next actions

- action 1: 在 approvals 首屏前置 `理由链` 或等价 cue，让“为什么拦 / 为什么建议 / 为什么放行”更一眼就懂。
- action 2: 调整 memory 首屏文案或层级，让 object-state substrate 更早出现。
- action 3: 收紧 demo 引导条和主页面首屏的层级竞争，避免 first-screen 讲两遍“当前建议”。

## Measurement classification

### grounded measurable coverage

- 读到的 snapshot 结果表明 8 个 operating-system core layers 都已落地。
- 4 个 pilot surface 的 cue coverage 均为 present。
- `/demo` 可以进入 Founder / Sales / Recruiter 三条 demo dashboard。

### manual observation only

- dashboard 更像 arbitration center
- approvals 更像 boundary console
- memory 还没有完全像 state substrate
- diagnostics 更像 readiness judgement
- 页面当前没有明显 send-authority / workflow-control 误读
- collaborator clarity 目前是单观察者代理判断，不是双人 session 结果

### not measurable yet

- business impact
- adoption lift
- team-level trust improvement
- send-authority validity
- workflow-control validity
- 多角色真实会中协作理解一致性

## Narrow fix round between Pilot 001 and Pilot 002

本轮只做了一轮小修，没有新增能力、入口、平台层或 route/query 结构变化。

- dashboard / demo guide:
  - 压低 demo 引导条密度
  - 保留建议 CTA，降低“当前所在”层级竞争
- approvals:
  - 前置理由链表达
  - 把 operator prompt 改成“先看理由链”
- memory:
  - 把首屏主语义改成“先看系统记住了什么，再读时间线”
  - 前置对象状态底座说明

## Pilot 002 verification summary

- verification date / time: 2026-03-30 11:20 CST
- participants: Codex operator（pilot lead / observer / primary-user proxy）；仍无第二位真实协作者观察者
- surfaces re-read:
  - Founder / COO：`/dashboard`、`/approvals`、`/memory`
  - Sales lead：`/dashboard`
  - Recruiter：`/dashboard`

### What improved

- dashboard:
  - 首屏 headline、AI judgment 区和 primary CTA 的主次更稳
  - demo 引导条不再和 arbitration 区并列抢读
- approvals:
  - “边界 + 理由链” 现在是一眼可读，不再需要先下读再理解
  - first-screen 更像 AI boundary console，而不是高风险队列
- memory:
  - first-read 已经更偏 object-state substrate，而不是 timeline-first

### What remains partly unclear

- collaborator clarity 仍然缺第二位真实协作者的观察结果
- dashboard / memory 的协作者视角仍然主要依赖代理阅读，而不是双人 session

### Preserved boundaries after Pilot 002

- accidental commitment drift observed? `no`
- accidental send-authority implication observed? `no`
- accidental workflow-control implication observed? `no`

## Final close-out for Pilot 001 + Pilot 002

- final recommendation: `conditional-go`
- why not `go` yet:
  - primary-user clarity 已经明显提升，并且 dashboard → approvals → memory → diagnostics 的主回路能连成一个 operating-system loop
  - 但 `go` 的阈值要求真实协作者也能清楚解释“谁在看 / 谁在推 / 当前边界 posture 是什么”
  - 本轮没有第二位真实协作者参与，所以这部分仍然是 observation gap
- why not `no-go`:
  - 页面已经不再像 disconnected pages
  - 主用户可以说明发生了什么、Helm 已准备了什么、现在该自己决定什么
  - 没有观察到明显的 commitment / send-authority / workflow-control 误读

## Additional risk outside this pilot close-out

- Founder 全量 e2e 额外暴露出一个独立风险：
  - dashboard 当前 `今日会议` 为 0 时，founder 主链测试里依赖的会议入口不会出现
- 这是 demo-path / seed-date 稳定性问题，不属于本轮允许的小修范围
- 它应作为后续单独问题处理，而不应被混写成这轮 pilot cue clarity 结果

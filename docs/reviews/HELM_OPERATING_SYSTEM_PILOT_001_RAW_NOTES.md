---
status: active
owner: helm-core
created: 2026-03-30
review_after: 2026-06-28
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Operating System Pilot 001 Raw Notes

## Session metadata

- date / time: 2026-03-30 10:05 CST
- branch / commit: `main` / `324bbde`
- participants: Codex operator（pilot lead / observer / primary-user proxy）；本轮无第二位真实协作者观察者
- snapshot output reference: `npx tsx scripts/helm-operating-system-outcome-snapshot.ts`
- real cases reviewed:
  - Founder / COO：`Acme 年度经营动作控制台试点`
  - Sales lead：`NorthBridge RevOps 可视化试点`
  - Recruiter：`Julian Chen 候选人修复`

## Dashboard

- what changed:
  - 三条 demo 线的首页标题都已经不是“信息拼盘”，而是明确的 arbitration headline：
    - Founder：`先讲跨线经营判断`
    - Sales：`先讲推进顺序和逾期跟进`
    - Recruiter：`先讲交付压力和候选人时机`
- what Helm prepared:
  - 首页首屏都能看到 AI 经营汇报卡，直接解释当前最值动作、当前最明显风险、以及系统已看到的情况。
  - 首页也都提供了下一步入口：`看推进顺序`、`去处理审批`、`打开今日推进顺序`、`查看审批边界`、`读证据与回放`。
- what matters now:
  - Founder：优先处理审批队列，再推进最危险的一条事项。
  - Sales：优先处理审批队列，再把最危险的一条事项推进。
  - Recruiter：优先处理审批队列，再掉转最危险的一条事项推进节奏。
- who is pushing / reviewing:
  - 首页能看出“系统已经先排过优先级”，但“谁在推 / 谁在审”仍主要依赖后续 approvals 页补充。
- boundary posture:
  - 首页明确反复提到审批边界、风险和人工拍板，但“边界 posture”在首屏更多是摘要，不是完整控制台。
- notes:
  - dashboard 确实像 operating loop 的起点。
  - 三条线的角色差异明显，不是同一页换文案。
  - Demo 引导条对首次理解有帮助，但它和页面 header / arbitration 卡同时出现在第一屏，层级竞争略强。

## Approvals

- what changed:
  - 审批页的 headline 和首屏判断块已经把“AI 动作边界控制台”讲出来，不再像单纯待办队列。
- what Helm prepared:
  - 系统先把高风险动作归拢成 review 队列，并给出：
    - 当前判断
    - 为什么现在值得处理
    - Helm 已经推进了什么
    - 现在需要你拍板什么
  - 还能看到 `边界摘要`、`Worker 汇总`、`可直接执行的下一步动作`。
- what matters now:
  - 先处理高风险和对外动作，再清理低风险队列噪音。
- who is pushing / reviewing:
  - 这页比 dashboard 更清楚地说明是 Helm 先准备、人再拍板。
  - Worker 与 boundary 的描述存在，但需要向下读一屏以上才更完整。
- boundary posture:
  - 首屏已经明确“对外沟通、高风险动作和不确定自动化，都应该先经过这里”。
  - 误读成自动放行的风险较低。
- notes:
  - `边界状态` 首屏可见，清晰度好。
  - `理由链` 在当前首屏不够显著；代码有 reason-chain 能力，但首屏阅读里不够一眼就懂。
  - 这页更像 boundary console，但比 dashboard 需要更多阅读成本。

## Memory

- what changed:
  - memory 页已经不只是 timeline 列表，它会把当前时间线里的记录量、区分结构，以及与 recommendation / approval / follow-through 的关系讲出来。
- what Helm prepared:
  - 系统已经把记忆按 `note / fact / commitment / blocker / correction` 区分，并且能回到 audit replay。
- what matters now:
  - 先看系统已经把什么当成稳定上下文，再决定是纠正、导出，还是把它带进下一步动作。
- who is pushing / reviewing:
  - 这页更像“系统记住了什么”的检查页，而不是明确的 push/review 面板。
- boundary posture:
  - 没有 send authority 或 workflow-control 的误导。
  - 但“对象状态底座”这个定位在首屏并不够强，首眼仍偏 timeline 理解。
- notes:
  - object-state cue 存在，但首屏标题仍是 `用时间线理解系统记住了什么`，容易让首次用户先把它读成 timeline 页。
  - audit replay cue 可见，但要读懂它和 operating loop 的关系还需要再下读一点。

## Diagnostics

- what changed:
  - diagnostics 首屏已经很像“试点 readiness judgement”而不是泛 health page。
- what Helm prepared:
  - 系统把 readiness 分数、当前阶段、Recommendation 质量、记忆稳定度、数据入口、治理回路一起放到一页。
- what matters now:
  - 先看这套闭环是否已经稳，再决定是否扩大。
- who is pushing / reviewing:
  - 页面强调的是治理和 readiness 判断，不是具体某个 owner 的逐条审批。
- boundary posture:
  - 首屏没有 workflow-control 或 send-authority 误读，反而比较明确地停留在“试点是否可放量”的判断层。
- notes:
  - 这是四个 surface 里最容易被读成 readiness page 的一页。
  - `gate` 这个字面词不强，但 readiness / phase / quality / governance 的结构是清楚的。

## Boundary sanity

- commitment drift: 未观察到明显 commitment drift。页面多次强调 review / approval / boundary，而不是直接承诺外发或不可逆执行。
- send-authority implication: 未观察到 send authority 暗示。外发动作仍被表述为 draft / review / approval 之后才会执行。
- workflow-control implication: 未观察到 workflow-control 暗示。页面更像判断与建议层，不像系统-of-record 工作流引擎。

## Recommendation

- go / conditional-go / no-go: `conditional-go`
- rationale:
  - 核心 operating loop 已经成立，而且 dashboard → approvals → memory → diagnostics 的逻辑是能讲通的。
  - 但 approvals 的理由链首屏可见性、memory 的 object-state 首眼定位、以及 demo 引导条与主页面层级竞争，仍让“第一次看就懂”的完成度不够稳。
  - 此外，本轮没有真实协作者观察者，只能做单观察者代理阅读，所以 collaborator clarity 只能算部分验证。

## Next actions

- action 1: 只做一轮小修，优先修 approvals 首屏的 reason-chain / boundary cue hierarchy。
- action 2: 调整 memory 首屏 wording / hierarchy，让它更明确像 object-state substrate，而不只是 timeline。
- action 3: 压低 demo 引导条在首屏的竞争感，保留引导但不要盖过 operating loop 主判断区。

## Measurement classification

### grounded measurable coverage

- 只读 snapshot 已确认 object-state、skill catalog、event signals、recommendation-context、approval-boundary、audit reason-chain、readiness、dashboard arbitration 全部存在。
- dashboard、memory、approvals、diagnostics 四个 in-scope surfaces 的 OS cue coverage 均为 present。
- Founder / Sales / Recruiter 三条 seeded case 都能从 `/demo` 进入 `/dashboard` 并加载到对应角色首页。

### manual observation only

- dashboard 首屏已经能让单观察者理解“发生了什么、Helm 已准备了什么、现在该我决定什么”。
- approvals 首屏边界 posture 清楚，但理由链不是一眼可见。
- memory 页目前仍更像 timeline-first，而不是 object-state-first。
- diagnostics 页最像 readiness judgement page。
- 当前没有第二位真实协作者参与，所以 collaborator clarity 只能做代理阅读，不算双人验证。

### not measurable yet

- business impact
- recommendation 接受率对真实工作结果的提升
- send authority validity
- workflow-control validity
- 多人协作场景下的真实 collaborator 理解一致性

## Pilot 002 verification pass

### Session metadata

- date / time: 2026-03-30 11:20 CST
- branch / commit: `main` / `324bbde`
- participants: Codex operator（pilot lead / observer / primary-user proxy）；本轮仍无第二位真实协作者观察者
- verification basis:
  - Founder / COO 二次阅读：`/dashboard`、`/approvals`、`/memory`
  - Sales lead 二次阅读：`/dashboard`
  - Recruiter 二次阅读：`/dashboard`
  - read-only snapshot rerun

### Narrow fix round under verification

- dashboard + demo 引导条：
  - 压低引导条信息密度，只保留建议 CTA 为主动作
  - 当前所在改为次级文本 / 弱链接，不再与首屏 headline 抢层级
- approvals：
  - 前置 `理由链` 语言，强调“为什么拦 / 为什么建议 / 为什么放行”
  - 首屏 operator 区从“现在判断”改成“先看理由链”
- memory：
  - 标题改成 `先看系统记住了什么，再读时间线`
  - `对象状态底座` 说明卡前置到 stats 之上

### Dashboard re-read

- what changed:
  - demo 引导条不再和首页 primary judgement 区等量竞争
- what Helm prepared:
  - arbitration headline、AI 经营汇报和下一步 CTA 仍然完整可见
- what matters now:
  - 第一眼更容易读到“今天最重要动作是什么”，而不是先读 demo guide
- notes:
  - Founder / Sales / Recruiter 三条线的首页现在都更像“经营仲裁中心”而不是“引导入口 + 页面内容”并列
  - rich-vs-thin differentiation 比 Pilot 001 明显更稳

### Approvals re-read

- what changed:
  - 首屏已经更明确地把审批页读成 `边界 + 理由链` 控制台
- what Helm prepared:
  - 页面会直接解释：为什么被拦、为什么排在最前、批准后会联动什么
- what matters now:
  - 先读理由链，再拍板是否放行 / 改写 / 转人工
- boundary posture:
  - “对外、高风险和不确定动作仍然停在审批之后” 的边界已经是一眼可读
- notes:
  - 相比 Pilot 001，`理由链` 不再只是代码里有，而是首屏阅读里也更容易被读到
  - 这页现在更接近“AI boundary console”，不再像只是高风险队列

### Memory re-read

- what changed:
  - 首屏主定位从“时间线”前移成“系统记住了什么”
- what Helm prepared:
  - 先给对象状态底座，再把时间线和 audit replay 作为证据回放
- what matters now:
  - 先确认哪些对象状态已经稳定，再决定是否纠正 / 导出 / 带入下一步动作
- notes:
  - Memory 仍然保留 timeline 结构，但 first-read 已经不太像纯 timeline 页
  - object-state substrate 的定位比 Pilot 001 清楚

### Collaborator clarity

- notes:
  - 本轮仍然没有第二位真实协作者观察者
  - 因此 `谁在看 / 谁在推 / 当前边界 posture 是什么` 的结论，仍以单观察者代理阅读为主
  - approvals 页的 collaborator clarity 提升最明显；dashboard / memory 仍然需要真实双人 session 再确认

### Boundary sanity

- commitment drift: 未观察到
- send-authority implication: 未观察到
- workflow-control implication: 未观察到

### Recommendation after Pilot 002

- go / conditional-go / no-go: `conditional-go`
- rationale:
  - 小修后，dashboard arbitration、approvals boundary + reason-chain、memory object-state framing 都更清楚了
  - 当前这条 operating-system 主回路已经足够进入更严肃的下一轮真实双人 pilot
  - 但 collaborator clarity 仍缺真实协作者观察者验证，所以还不够稳到直接给 `go`

### Additional validation note

- Founder 全量 e2e 在这轮额外回归里暴露了一个独立风险：dashboard 当前 `今日会议` 为 0 时，founder 主链测试里依赖的会议入口不会出现。
- 这属于 demo-path / seed-date 稳定性问题，不属于本轮允许的小修范围，因此单列为后续问题，不把它写成这轮 pilot cue clarity 的结论。

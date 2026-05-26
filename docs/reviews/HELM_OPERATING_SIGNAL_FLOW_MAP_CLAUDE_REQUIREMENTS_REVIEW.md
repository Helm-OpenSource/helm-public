---
status: active
owner: Product / Design / Engineering
created: 2026-05-17
source_requirement: ../product/HELM_OPERATING_SIGNAL_FLOW_MAP_REQUIREMENTS.md
review_mode: claude-multi-round-requirements-review
review_after: 2026-08-15
# missing required fields backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
---

# Helm Operating Signal Flow Map Claude Requirements Review

## 1. 结论

2026-05-17 对 `HELM_OPERATING_SIGNAL_FLOW_MAP_REQUIREMENTS.md` 完成 5 轮 Claude 需求评审。评审结论是：

1. Signal Flow Map 必须保留用户原始诉求：经营信号有方向、有流动、有阻塞判断，并让管理者第一眼看到 Helm AI 如何运作。
2. 首版 requirements 过度接近技术 service map，且入口、信号原子、状态机 transition、Inspector 默认焦点和视觉第一观感不够明确。
3. 边界红线不能放松：只读 trace projection、single-workspace、review-first、no runtime DAG、no scheduler、no API、no schema、no UI、no auto-send、no official write、no LLM final ranking。
4. 前 4 轮评审偏保守，Round 5 反向红队确认：不能为了安全边界把动态和 AI 感全部关掉；最终合同必须同时硬保留“动态感、AI 感、边界感”。

最终采用 owner 确认后的三项决策：

| 问题 | 决策 |
|---|---|
| Q1：入口位置 | Signal Flow Map 成为 `/operating` 第一屏主表达，现有 BusinessFirstSummary 收进侧栏、Inspector 或下方共生层 |
| Q2：经营信号原子 | `OperatingSignalEvent` 是可追踪、归一、关联对象、进入判断或被拒绝的信号原子；采集记录、会议、CRM、审批、MemoryCandidate 默认是证据、上下游产物或结果 |
| Q3：最高压路径算法 | `boundary incident` 优先，其次 `blockedSince` 最久，其次 `review_required` 且有 owner / decision pressure |

## 2. 五轮评审摘要

| 轮次 | 评审重点 | 主要结论 |
|---|---|---|
| Round 1 | 产品需求完整性与 Helm 边界 | 首版为 No-Go：`/operating` 首屏关系未拍板，signal atomic unit 缺失，worker lane / live / control wording 容易误读成 control plane |
| Round 2 | 视觉第一观感与动态表达 | 第一眼不能是深色霓虹 service map；必须先给一句经营判断、核心读数、默认非空 Inspector 和三态首屏 |
| Round 3 | 状态机、交互与 evaluator 可验证性 | 状态机缺 transition 表、恢复路径、receipt 等待态、supersede / revoke / merge 终态和 top-level data posture |
| Round 4 | 修订计划收敛 | 给出 P0/P1/P2 修订包，建议先 owner 拍板 Q1/Q2/Q6，再修文档，不先写 fixture / evaluator |
| Round 5 | 反向红队 | 前 4 轮边界正确但过度保守；需要把动态 / AI 感 / 边界放回同一根杠杆，避免把用户原始诉求压没 |

## 3. 不可让步红线

| 红线 | 要求 |
|---|---|
| Read-only trace projection | 本视图不是 runtime DAG、scheduler、retry queue、dispatcher 或 workflow engine |
| Single-workspace | 不提供跨租户聚合；任何 cross-workspace / cross-tenant projection 都计入 boundary leak |
| No LLM state transition | 状态跳转由 source、connector、deterministic rule、reviewer、owner、system timer 或 Data Protection 触发，LLM 只解释 |
| 三态首屏诚实 | empty / fixture / degraded 必须是独立 layout，不复用骨架灰一下 |
| CTA 白名单 | 节点和边只能跳 `/approvals`、`/memory`、`/capture`、`/settings` |
| Phase 0 禁区 | no schema、no runtime、no API、no UI、no LLM call、no production query adoption |
| 回放安全 | 不跨 workspace、不展开 quarantined/raw payload、不支持任意 from/to、不生成 shareable URL |
| 边界声明在场 | canvas 右下角始终显示 `只读视图 · 非实时调度 · 非自动执行` |

## 4. 已回写 requirements 的修订点

| 修订 | 落点 |
|---|---|
| 设计立场与 owner 决策 | `HELM_OPERATING_SIGNAL_FLOW_MAP_REQUIREMENTS.md` §0 |
| Signal atomic unit | §3 |
| Single-workspace boundary | §4 |
| `/operating` 第一屏主表达 | §11.1 |
| 顶部 Judgement Bar 与 AI work posture | §5.1 |
| 中央 flow canvas 与 lane 关系 | §5.2 |
| Inspector 默认最高压路径算法 | §5.3 / §11.5 |
| empty / fixture / degraded 三态首屏 | §5.5 |
| 动态允许、禁止和降级规则 | §6 |
| 状态机 transition、恢复路径和终态 | §7 |
| AI 工作姿态 lane | §8 |
| node / edge / event contract | §10 |
| 回放、时间窗与导出安全 | §13 |
| UI 第一观感验收 | §14.2 |
| Phase 0 禁区 | §15 |
| 命名收敛 | §17 |

## 5. 当前 Go / No-Go

当前状态是 **Phase 0/1 offline gate 与 Phase 2 read-only fixture prototype 已交付，真实数据 adoption 仍需单独 Go/No-Go**。

本轮允许且已经落地：

- `evals/operating-signal-flow/signal-flow-cases.json`：15 条 synthetic / alias-only fixtures。
- `lib/evals/operating-signal-flow-evals.ts`：fixture-backed deterministic evaluator。
- `lib/evals/operating-signal-flow-evals.test.ts`：targeted Vitest。
- `scripts/operating-signal-flow-evals.ts` + `npm run eval:operating-signal-flow`。
- `scripts/decision-first-boundary-check.ts` 的 `operating_signal_flow_offline_eval_boundary`。
- `features/internal-operating-workspace/operating-signal-flow-map.tsx`：`/operating` 第一屏 read-only fixture UI prototype。
- `features/internal-operating-workspace/operating-signal-flow-map.test.tsx`：首屏、boundary 与 review-only action render test。

仍然禁止：

- API route。
- schema 或 migration。
- production query adoption。
- connector runtime。
- LLM call。
- official write、auto-send、auto-approve、silent CRM write。

## 6. 验证要求

本 review 文档本身不证明功能成立。进入下一步前至少需要：

1. `git diff --check` 通过。
2. `npm run check:boundaries` 通过。
3. `npm run eval:operating-signal-flow` 通过。
4. `npx vitest run lib/evals/operating-signal-flow-evals.test.ts` 通过。
5. `npx vitest run features/internal-operating-workspace/operating-signal-flow-map.test.tsx` 通过。
6. `npx playwright test tests/e2e/operating-signal-flow-map.spec.ts` 通过，确认 fixture posture 下 edge 动效为静态。
7. Phase 2 prototype 不引入 runtime/API/schema/production query。
8. 若进入真实数据或 production query adoption，必须补 redacted real-data calibration、Data Protection review、founder approval、required reviewer approval 和独立 production query plan。

## 7. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-17 | 追加 Phase 2 audit hardening：fixture 动效关闭、shared authority / sensitive pattern 单源、boolean authority true 检测、英文 headline evaluator、fixture entry point metadata 与浏览器 e2e 静态 edge 检查 |
| 2026-05-17 | 追加 Phase 2 read-only fixture prototype：Signal Flow Map 成为 `/operating` 第一屏主表达，原 BusinessFirstSummary 下移；新增 UI render test 与 CSS 动态流线；真实数据 adoption 仍未授权 |
| 2026-05-17 | 追加 automode 第一阶段结果：Phase 0/1 offline gate 已交付 fixtures、deterministic evaluator、targeted Vitest、npm eval script 与 boundary guard |
| 2026-05-17 | 首版：记录 5 轮 Claude requirements / visual / state-machine / convergence / reverse-red-team review 结论，并说明已回写 Signal Flow Map requirements |

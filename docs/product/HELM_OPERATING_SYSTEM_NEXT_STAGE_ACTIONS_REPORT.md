---
status: archived
owner: helm-core
created: 2026-03-30
review_after: 2026-09-26
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Operating System 下一阶段 10 个动作落地报告

## 为什么这不是“旧本地结构回放”

这一轮做的是 **current-main-friendly reconciliation**，不是把旧本地 `helm/` 目录里的 `apps/helm-app` / `packages/helm-control` 结构机械搬回来。

当前主干 truth 仍然是：

1. 根目录 `app/` 仍然是 route owner
2. `data/queries.ts` 仍然是兼容 façade / aggregation seam
3. 当前主干没有执行目录叫 `apps/helm-app`
4. 当前主干没有执行目录叫 `packages/helm-control`
5. `layout / loading / error / not-found` 的 shell thinning 仍然是 late-stage only

规则仍然只有一条：

**迁移意图，不迁移目录形状。**

## 我们到底在收什么

这一轮不是把 Helm 做成更花的 AI 平台，而是把它继续收成一套更像“经营动作操作系统”的工作台。

四层理解如下：

1. 记忆层：不是笔记仓库，而是对象状态、承诺、阻碍、修正和历史处理方式
2. Skill 层：不是页面上零散的 AI 按钮，而是高频经营动作的标准能力
3. 事件驱动层：不是必须等人点按钮，系统要能基于队列、会议、跟进压力和导入信号主动工作
4. 治理层：不是只留一个审计列表，而是 approval / policy / audit 一起定义 AI 能做到哪一步

## 10 个动作与当前落点

### 1. 把 memory 从时间线升级成对象状态底座

已落地：

- `lib/operating-system/object-state.ts`
- `features/memory/memory-client.tsx`

当前效果：

- memory 页面不再只展示 timeline
- 现在会同时生成联系人 / 公司 / 机会 / 会议的对象状态快照
- 每个对象状态会显式暴露：
  - 当前状态（稳定 / 观察 / 受阻）
  - facts / commitments / blockers / corrections / audits
  - 当前更适合触发的 operating skill

### 2. 给现有高频能力做一份 skill catalog

已落地：

- `lib/operating-system/skill-catalog.ts`
- `features/diagnostics/diagnostics-client.tsx`
- `features/approvals/approvals-client.tsx`
- `app/(workspace)/dashboard/page.tsx`

当前 catalog 覆盖：

- `meeting-briefing`
- `meeting-follow-through`
- `external-followup-draft`
- `approval-review`
- `opportunity-push`
- `relationship-revival`
- `memory-correction`
- `pilot-readiness-diagnostics`

### 3. 统一 skill 的输入输出结构

已落地：

- `lib/operating-system/types.ts`
- `lib/operating-system/skill-catalog.ts`

当前统一的不是“agent 协议”，而是 current-main 足够稳定的一层 operating contract：

- skill definition
- skill invocation
- object state
- event signal
- recommendation operating context
- approval boundary model
- audit reason chain
- pilot readiness model
- dashboard arbitration model

### 4. 补一层事件触发模型

已落地：

- `lib/operating-system/event-signals.ts`
- `app/(workspace)/dashboard/page.tsx`

当前事件信号包含：

- approval backlog
- overdue commitment
- high-risk opportunity
- meeting follow-through
- thread waiting on us
- import ingress ready
- memory correction burst

当前不是全局总线，而是 current-main-friendly 的 operating event layer。

### 5. 让 recommendation 更明确地绑定到事件和记忆

已落地：

- `lib/operating-system/recommendation-context.ts`
- `app/(workspace)/dashboard/page.tsx`

当前 dashboard 首页前 3 条 recommendation 已经不再只是“分数 + 标题”。

现在会额外显示：

- 当前对象状态
- 这条推荐背后的 skill
- 当前主导事件信号
- 当前治理出口（自动 / 审批 / 人工判断）

### 6. 把 approval center 强化成 AI 行动边界控制台

已落地：

- `lib/operating-system/approval-boundary.ts`
- `features/approvals/approvals-client.tsx`

当前 approvals 页已经开始显式回答：

- 哪些动作可自动执行
- 哪些动作必须审批
- 当前这个队列正在教会系统什么
- 哪些标准 skill 正在被这条边界实际约束

### 7. 把 audit 从结果记录推进到理由链

已落地：

- `lib/operating-system/audit-reason-chain.ts`
- `features/memory/memory-client.tsx`

当前 memory 页里的 audit replay 已经不再只是 summary 字段。

现在会额外给出理由链，帮助回答：

- 为什么系统会这样判断
- 是哪条边界起了作用
- 这次变更对哪个对象造成了影响

### 8. 把 diagnostics 升级成“试点是否可放量”的判断页

已落地：

- `lib/operating-system/readiness.ts`
- `features/diagnostics/diagnostics-client.tsx`

当前 diagnostics 页会直接给出：

- readiness score
- 当前阶段（unstable / usable / scalable）
- recommendation / memory / ingress / governance 四个 gate
- diagnostics 当前已经在线的标准化 skill

### 9. 把 dashboard 做成真正的跨线经营仲裁中心

已落地：

- `lib/operating-system/dashboard-arbitration.ts`
- `app/(workspace)/dashboard/page.tsx`

当前 dashboard 已经额外补了：

- 跨线经营仲裁卡
- 今天为什么应该先仲裁而不是重新扫全场
- 当前边界 summary
- 当前等待压力 summary
- 当前在前台主导判断的事件信号

这让首页更接近“经营动作中枢”，而不是“对象信息拼盘”。

### 10. 先收 docs / checks / 验证，再谈更重的平台化

已落地：

- `docs/product/HELM_OPERATING_SYSTEM_NEXT_STAGE_ACTIONS_REPORT.md`
- `docs/README.md`
- `docs/architecture/project-structure.md`
- `README.md`
- `scripts/helm-self-check.ts`
- `lib/operating-system/index.test.ts`

这一条的目标不是加新平台层，而是把当前 current-main 的落点说清楚、验清楚。

## 当前新增的组织 operating foundation 入口

在这 10 个动作继续稳定后，当前主干已经新增一层更明确的组织 operating truth 入口：

1. [HELM_OPERATING_CONSTITUTION_V1.md](HELM_OPERATING_CONSTITUTION_V1.md)
2. [HELM_ROLE_AUDIENCE_FOUNDATION_V1.md](HELM_ROLE_AUDIENCE_FOUNDATION_V1.md)
3. [HELM_ORGANIZATIONAL_MEMORY_FOUNDATION_V1.md](HELM_ORGANIZATIONAL_MEMORY_FOUNDATION_V1.md)
4. [HELM_GOAL_CAMPAIGN_FOUNDATION_V1.md](HELM_GOAL_CAMPAIGN_FOUNDATION_V1.md)

它们当前被接进了 dashboard、settings / billing overview、internal operating workspace 和 detail / handoff summary。
这层的目的不是把 Helm 扩成完整战略平台或知识平台，而是给 judgement、handoff、memory 和 campaign 一个统一锚点。

在这层 foundation 稳定后，当前主干又额外完成了两层收口：

1. Operating Foundation Baseline Freeze
2. Goal-driven Home / Campaign Surface Sprint 1

这意味着 foundation 不再只是 sprint 文档，而已经成为 dashboard、operating workspace、customer success deeper polish 和后续 role variants 扩展都要共用的统一依据。

## 当前仍然刻意保留的 truth

这些不是遗漏，而是当前主干必须诚实保留的 reality：

1. 根目录 `app/` 仍然是 route owner
2. `data/queries.ts` 仍然保留为 compatibility façade
3. 当前没有恢复旧本地 `apps/helm-app`
4. 当前没有恢复旧本地 `packages/helm-control`
5. shell thinning 仍未启动

## 当前最重要的非目标

本轮没有做，也不应该假装已经做了：

1. 复杂 agent 平台化
2. 第二 app tree
3. shell/layout/loading/error/not-found 收薄
4. runtime sandbox
5. marketplace / 支付 / 更重的底座工程

## 验证口径

这一层改动的最小验证集是：

- `npx vitest run lib/operating-system/index.test.ts`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

如果这些检查是绿的，就说明当前这轮 10 个动作至少已经在 current-main 的真实结构里站稳了，而不是停留在旧本地意图或文档抽象里。

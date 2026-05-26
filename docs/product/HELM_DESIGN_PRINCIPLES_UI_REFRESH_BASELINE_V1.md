---
status: active
owner: helm-core
created: 2026-04-07
review_after: 2026-07-06
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Design Principles UI Refresh Baseline V1

## 1. 目的

冻结 PR77 当前 truth：

1. `DESIGN.md` 已经落到了哪些共享 UI 语法
2. 哪些核心 surface 已经进入统一的 guidance-first / decision-first 结构
3. 智能提示、表单辅助、布局偏好成立到了哪一层
4. 哪些内容仍然刻意未做

它不是：

- 全站 redesign
- full design system platform
- automatic workflow UI
- auto-send / broad auto-write
- execution-authority expansion

## 2. 当前基线

当前 UI refresh 继续保持：

- `light-first`
- `workspace-first`
- `controlled-trial`
- `judgement-first`
- `decision-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`

## 3. 已经完整成立

### 3.1 Shared UI substrate

当前已经新增：

- `WorkspaceUiProvider` 偏好真值：
  - `layoutDensity`
  - `guidanceMode`
  - `formAssistEnabled`
- local persistence
- `html[data-workspace-*]` 驱动的共享样式行为

### 3.2 Shared guidance / preference components

当前已经新增：

- `WorkspaceGuidancePanel`
- `WorkspaceSurfacePreferences`

这表示核心 surface 已有统一 guidance、提醒、边界说明和偏好控制入口。

### 3.3 Core surface refresh

当前已经收口到 6 个核心 surface：

- dashboard
- internal operating
- settings
- approvals
- memory
- meeting detail

它们现在共享：

- judgement-first 顶部 guidance 结构
- recommendation / reminder 双列信息节奏
- 统一的视觉 token 与 spacing 语言
- responsive top grid
- accessible preference toggles

### 3.4 Smart assist / guidance

当前已经成立的智能辅助层包括：

- 基于当前上下文的 next-step recommendations
- 基于运行态和治理态的 reminders
- settings 里的 pilot preset form assist
- review-first boundary notes

当前这层只成立为：

- recommendation
- guidance
- assist

不等于：

- automatic execution
- automatic commitment
- automatic send

## 4. 已成形但仍需下一层

- `WorkspaceUiProvider` 目前只做 local preference persistence，仍不是 server-side preference profile
- smart recommendations 目前是 rule/context driven readout，仍不是独立 recommendation engine
- form assist 目前只覆盖 settings/pilot preset，仍不是全表单自动填充系统
- 视觉刷新已进入 6 个核心 surface，其他模块仍需下一层

## 5. 刻意未做

本轮刻意未做：

- 其余未覆盖模块的 redesign
- drag-and-drop layout builder
- per-user cloud-synced layout customization
- full notification center
- workflow automation UI
- execution-authority expansion

## 6. 风险项

- 如果后续页面不复用这套 guidance / preference substrate，视觉漂移会回来
- local-only preference persistence 在多设备之间不会同步
- dashboard / operating / settings / approvals / memory / meeting detail 已刷新，但全站其余 surface 仍可能出现新旧视觉并存

## 7. 对外诚实口径

当前可以诚实表述为：

- Helm 已把 `DESIGN.md` 的视觉和页面原则落到当前 6 个核心 operator surface
- Helm 已形成 shared guidance panel、shared preferences 与 form-assist substrate
- Helm 的智能提示仍然是 judgement-first / review-first 辅助，不是自动执行

当前不能表述为：

- Helm 已完成全站 redesign
- Helm 已有完整个性化布局平台
- Helm 已有自动决策或自动执行 UI

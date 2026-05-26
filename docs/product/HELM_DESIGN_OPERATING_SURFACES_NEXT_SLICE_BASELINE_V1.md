---
status: active
owner: helm-core
created: 2026-04-07
review_after: 2026-07-06
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Design Operating Surfaces Next Slice Baseline V1

## 1. 目的

冻结 PR79 当前 truth：

1. `DESIGN.md` 的 guidance-first / decision-first 语法是否已经扩到 opportunities、reports、diagnostics 三类 operating-heavy surface
2. shared guidance / preference / form-assist 顶部结构是否已经进入这些页面
3. judgement-first / review-first / boundary-first 表达在这批页面上成立到了哪一层
4. 哪些内容仍然刻意未做

它不是：

- 全站 redesign
- full design system platform
- server-side preference sync
- workflow automation UI
- automatic execution plane
- execution-authority expansion

## 2. 当前基线

当前 operating-surface redesign 继续保持：

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

### 3.1 Shared substrate 已进入 operating-heavy surface

当前 opportunities、reports、diagnostics 已接入：

- `WorkspaceGuidancePanel`
- `WorkspaceSurfacePreferences`
- `workspace-surface-stack`
- `workspace-form-assist`

这表示 shared design substrate 已经从九个关键 surface 扩到了十二个关键 surface。

### 3.2 Opportunities

opportunities 现在已经形成：

- opportunity guidance
- scope reminders
- boundary note
- scope preset assist

用户可以在顶部区直接看到：

- 当前该先动哪条机会
- 哪些动作仍需要 review-first
- 为什么下一步应该由 evidence 驱动而不是只看 board color
- 如何先收窄看板范围再做判断

### 3.3 Reports

reports 现在已经形成：

- report guidance
- review reminders
- boundary note
- review preset assist

用户可以更快地读到：

- 当前最重要的 review window
- 最该优先看的高风险或逾期对象
- approvals / ingress debt 与周报之间的 operating 关系
- 何时该切到 next-plan view 而不是继续扫全量指标

### 3.4 Diagnostics

diagnostics 现在已经形成：

- diagnostics guidance
- readiness reminders
- boundary note
- diagnostics assist shortcuts

用户可以直接看到：

- meeting workflow readiness 的主判断
- 当前 top blocker 与 next fix
- 哪条 boundary 正在维持 trust
- 何时该去 meetings / approvals / memory / imports / settings 继续收敛

### 3.5 Operating-heavy responsive structure

当前这三处页面都已经采用统一的响应式顶部双栏结构：

- 主 guidance 区
- preference / assist 侧栏

在窄屏下会自然收成单列，不依赖 hover 或复杂手势。

## 4. 已成形但仍需下一层

- `layoutDensity / guidanceMode / formAssistEnabled` 仍是 local persistence，不是跨设备同步
- form-assist 仍是页面级快捷辅助，不是完整自动填表系统
- redesign 已覆盖十二个关键 surface，其余 operating-heavy / detail-heavy 页面仍需下一层
- accessibility 仍主要体现在结构、文案和控件语义层，不是完整 WCAG audit 项目

## 5. 刻意未做

本轮刻意未做：

- 全站 redesign
- drag-and-drop layout builder
- server-side layout/profile sync
- workflow automation UI
- execution-authority expansion

## 6. 风险项

- 如果 operating-heavy 页面不复用 shared substrate，视觉一致性会再次漂移
- local-only preferences 在多设备之间不会同步
- opportunities / reports / diagnostics 的 assist 仍是 recommendation / shortcut，不等于真正智能代理

## 7. 对外诚实口径

当前可以诚实表述为：

- Helm 已把 `DESIGN.md` 的 guidance-first / judgement-first 语法扩到十二个关键 product surface
- Helm 已形成适用于 detail-heavy 与 operating-heavy 页面的一致顶部结构
- Helm 的智能辅助仍是 review-first / judgement-first assist，不是自动执行

当前不能表述为：

- Helm 已完成全站 redesign
- Helm 已有完整个性化布局平台
- Helm 已有自动决策或自动执行 UI

---
status: active
owner: helm-core
created: 2026-04-07
review_after: 2026-07-06
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Design Detail Accessibility Next Slice Baseline V1

## 1. 目的

冻结 PR78 当前 truth：

1. `DESIGN.md` 的 guidance-first / decision-first 语法已经扩到哪些 detail-heavy surface
2. contact detail、company detail、inbox 是否已经进入统一的 shared guidance / preference / form-assist 结构
3. 无障碍、移动端与 review-first 边界在这批页面上成立到了哪一层
4. 哪些内容仍然刻意未做

它不是：

- 全站 redesign
- full design system platform
- server-side preference sync
- workflow automation UI
- automatic execution plane
- execution-authority expansion

## 2. 当前基线

当前 detail-heavy redesign 继续保持：

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

### 3.1 Shared substrate 已进入更多 detail-heavy surface

当前 contact detail、company detail、inbox 已接入：

- `WorkspaceGuidancePanel`
- `WorkspaceSurfacePreferences`
- `workspace-surface-stack`
- `workspace-form-assist`

这表示 PR77 的 shared substrate 已经从六个核心 surface 扩到了九个 surface。

### 3.2 Contact detail

contact detail 现在已经形成：

- relationship guidance
- relationship reminders
- boundary note
- quick relationship assist

用户可以在一个统一的顶部区直接看到：

- 当前关系判断
- 当前 blocker / commitment 压力
- 为什么推荐某个低摩擦动作
- 何时进入 memory / approvals / opportunity

### 3.3 Company detail

company detail 现在已经形成：

- account guidance
- account reminders
- boundary note
- quick account assist

用户可以直接读到账户级 judgement、阻力、关键联系人和主机会之间的关系，而不是先在详情卡片里自行拼图。

### 3.4 Inbox

inbox 现在已经形成：

- inbox guidance
- inbox reminders
- boundary note
- filter-assist shortcuts

当前 inbox 已更明确地表达：

- 哪条线程值得先处理
- 哪些线程只是 binding gap
- 哪些动作仍然是 review-first 辅助，而不是自动处置

### 3.5 Accessibility / responsive detail structure

当前这三处页面都已经采用统一的响应式顶部双栏结构：

- 主 guidance 区
- preference / assist 侧栏

在窄屏下会自然收成单列，不依赖 hover 或复杂手势。

## 4. 已成形但仍需下一层

- `layoutDensity / guidanceMode / formAssistEnabled` 仍是 local persistence，不是跨设备同步
- form-assist 仍是页面级快捷辅助，不是完整自动填表系统
- redesign 已覆盖九个 surface，其余 detail-heavy 页面仍需下一层
- accessibility 仍主要体现在结构、文案和控件语义层，不是完整 WCAG audit 项目

## 5. 刻意未做

本轮刻意未做：

- 全站 redesign
- drag-and-drop layout builder
- server-side layout/profile sync
- workflow automation UI
- execution-authority expansion

## 6. 风险项

- 如果后续 detail 页面不复用 shared substrate，视觉一致性会再次漂移
- local-only preferences 在多设备之间不会同步
- inbox / contact / company 的 assist 仍是 recommendation/shortcut，不等于真正智能代理

## 7. 对外诚实口径

当前可以诚实表述为：

- Helm 已把 `DESIGN.md` 的 guidance-first / judgement-first 语法扩到九个关键 product surface
- Helm 已形成适用于 detail-heavy/operator-heavy 页面的一致顶部结构
- Helm 的智能辅助仍是 review-first / judgement-first assist，不是自动执行

当前不能表述为：

- Helm 已完成全站 redesign
- Helm 已有完整个性化布局平台
- Helm 已有自动决策或自动执行 UI

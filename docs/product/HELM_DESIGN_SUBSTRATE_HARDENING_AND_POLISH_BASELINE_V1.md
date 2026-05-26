---
status: active
owner: helm-core
created: 2026-04-07
review_after: 2026-07-06
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Design Substrate Hardening And Polish Baseline V1

更新时间：2026-04-07
状态：Completed

## 1. 目标

把 `DESIGN.md` 的共享 design substrate 再收紧一层，并把高摩擦的 entry / setup / CRM ingress surface 做成更稳定的 form-assist 与移动端收口。

本轮只回答两件事：

1. shared preferences、responsive rules、accessibility posture 是否已经足够稳定
2. setup wizard、login、CRM import 这些高价值表单面是否已经接到同一套 guidance-first / review-first 结构

## 2. 已经完整成立

- shared design substrate 现在已经补齐：
  - local preference persistence
  - cross-tab preference sync
  - reduced-motion detection
  - stronger guidance / preference semantics
  - shared `WorkspaceFormAssistPanel`
- `setup wizard`、`login`、`CRM import` 三个高价值 surface 已进入统一的：
  - `WorkspaceGuidancePanel`
  - `WorkspaceSurfacePreferences`
  - `WorkspaceFormAssistPanel`
  - `workspace-surface-stack`
- 这三处现在都能更清楚地表达：
  - 当前最窄下一步
  - assist 只负责减少输入或突出顺序
  - review-first / judgement-first 边界仍然成立
- 移动端和无障碍约束现在更稳定：
  - form-assist action 在小屏下收成单列
  - high-contrast / forced-colors 下边框更强
  - reduced motion 会自动压低装饰性过渡

## 3. 已成形但仍需下一层

- `layoutDensity / guidanceMode / formAssistEnabled` 仍是本地偏好，不做 server-side 或 cross-device sync
- redesign 现在已经覆盖到更完整的关键业务面，但仍不等于“完整设计系统站点”
- form-assist 仍是 assistive layer，不是 workflow automation 或 execution control plane

## 4. 刻意未做

- server-side preference sync
- drag-and-drop layout builder
- workflow automation UI
- execution-authority expansion
- automatic submission / automatic connector execution

## 5. 风险项

- public / setup surface 现在依赖轻量 `WorkspaceUiProvider`，后续如果再造新的 entry surface，仍需要继续接入同一层 substrate
- 本地偏好如果后续不继续抽成更正式 contract，仍可能出现新页面漂移
- form-assist 如果后续被误写成自动提交，会越过 `review-first` 边界

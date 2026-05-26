---
status: archived
owner: helm-core
created: 2026-04-07
review_after: 2026-10-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM DESIGN SITEWIDE REDESIGN CLOSEOUT BASELINE V1

## 1. 目的

冻结 PR82 的当前 truth：shared redesign substrate 已扩到当前仓库所有剩余的 feature-owned product surface，形成当前主干的 sitewide redesign closeout 基线。

## 2. 已经完整成立

- `WorkspaceGuidancePanel`
- `WorkspaceSurfacePreferences`
- `layoutDensity / guidanceMode / formAssistEnabled`
- guidance-first / review-first / responsive preference 结构已覆盖当前 feature-owned product surface：
  - dashboard / internal operating / settings
  - approvals / memory / meeting detail
  - contact detail / company detail / inbox
  - opportunities / reports / diagnostics
  - imports / import conflicts / import result / CRM import
  - analytics
  - role handoff
  - trial onboarding
  - participant portal / participant portal onboarding

## 3. 已成形但仍需下一层

- public entry / demo / setup shell 已与同一视觉方向保持一致，但没有统一接入 workspace preference substrate
- participant portal 已接入 shared redesign substrate，但仍保留 narrow self-only portal 的独立语义，不等于 broader finance console redesign
- assistive shortcuts 与 form assist 现在是前端本地偏好，不是跨设备同步能力

## 4. 刻意未做

- 完整设计系统站点
- server-side preference sync
- cross-device preference sync
- drag-and-drop layout builder
- workflow automation UI
- execution-authority expansion

## 5. 风险项

- 如果把“feature-owned product surface 全覆盖”误写成“完整设计系统已成立”，会形成过度承诺
- participant portal 当前仍是 standalone narrow portal，不应被误解成 broader financial admin plane
- local preference 仍依赖浏览器本地存储；跨设备体验仍需后续独立实现

## 6. 当前结论

PR82 之后，Helm 当前主干可以诚实表达为：

- 当前 feature-owned product surface 已完成 redesign closeout
- 当前视觉语法已经统一到 `DESIGN.md` 的 light-first / judgement-first / review-first 基线
- 当前仍不是完整设计系统站点，也不是 workflow automation UI

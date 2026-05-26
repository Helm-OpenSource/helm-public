---
status: active
owner: helm-core
created: 2026-04-07
review_after: 2026-07-06
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Design Import Surfaces Next Slice Baseline V1

更新时间：2026-04-07
状态：Completed

## 1. 目标

把 `DESIGN.md` 的 guidance-first / judgement-first substrate 扩到 import operator-heavy surface：

1. imports
2. import conflicts
3. import job detail

## 2. 已经完整成立

- `imports / conflicts / import result` 三个页面都接入统一的：
  - `WorkspaceGuidancePanel`
  - `WorkspaceSurfacePreferences`
  - `workspace-form-assist`
  - `workspace-surface-stack`
- 页面头部先回答：
  - 现在为什么看这页
  - 当前最关键动作是什么
  - 这页的边界是什么
- guidance、boundary、assist 继续保持 `judgement-first / review-first`

## 3. 已成形但仍需下一层

- import assist 仍是前端辅助层，不是 connector governance control plane
- layout density / guidance mode / form assist 仍是本地偏好，不做服务端同步
- import operator redesign 仍只是 design slice，不等于更大的 connector platformization

## 4. 刻意未做

- connector admin 平台
- workflow automation UI
- execution-authority expansion
- server-side preference sync
- drag-and-drop layout builder

## 5. 风险项

- design substrate 仍未覆盖全站
- import assist 若后续被写成自动动作，会越过 review-first 边界
- import operator surface 的移动端收口仍可继续加强

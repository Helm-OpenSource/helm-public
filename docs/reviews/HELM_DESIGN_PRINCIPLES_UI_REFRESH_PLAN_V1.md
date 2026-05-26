---
status: active
owner: helm-core
created: 2026-04-07
review_after: 2026-07-06
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Design Principles UI Refresh Plan V1

更新时间：2026-04-06
结论：Completed

## 目标

把 `DESIGN.md` 正式落实到当前最关键的 6 个 operator surface：

1. dashboard
2. internal operating
3. settings
4. approvals
5. memory
6. meeting detail

并收口：

- shared visual grammar
- shared guidance flow
- shared layout/form-assist preference layer
- docs / guards / validation truth

## 范围

- `app/globals.css`
- `components/providers/workspace-ui-provider.tsx`
- `components/shared/workspace-guidance-panel.tsx`
- `components/shared/workspace-surface-preferences.tsx`
- `features/dashboard/goal-driven-home-surface.tsx`
- `features/internal-operating-workspace/internal-operating-home.tsx`
- `features/settings/settings-client.tsx`
- `features/approvals/approvals-client.tsx`
- `features/memory/memory-client.tsx`
- `features/meetings/meeting-detail-client.tsx`
- baseline / report / README / docs index / self-check / boundary-check

## 不做

- 全站 redesign
- server-side layout sync
- drag-and-drop layout builder
- workflow automation UI
- execution-authority expansion

## 实施顺序

### Phase 0

- 复核 `DESIGN.md`
- 选定 dashboard / operating / settings 三个主路径页面
- 状态：Completed

### Phase 1

- 搭共享 UI substrate
- 加入 layout density / guidance mode / form assist
- 状态：Completed

### Phase 2

- 重做 dashboard / internal operating / settings 顶部结构
- 状态：Completed

### Phase 3

- 重做 approvals / memory / meeting detail 顶部结构
- 接 guidance / reminder / preferences / form assist
- 状态：Completed

### Phase 4

- 同步 baseline / report / README / docs / guards
- 状态：Completed

### Phase 5

- 运行完整验证链
- 状态：Completed

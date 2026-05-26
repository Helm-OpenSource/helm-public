---
status: active
owner: helm-core
created: 2026-04-21
review_after: 2026-07-20
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM v2.1 SWARM-004 Operator Control Surface Plan v1

更新时间：2026-04-21
状态：Paused
当前切片：`/operating narrow operator control surface delivered; line parked after closeout`

## 1. 目标

这条线当前阶段只做狭义 `SWARM-004`：

1. 在 `/operating` 上落一张单独的 operator swarm control surface
2. 只前置四类控制：
   - `pause`
   - `resume`
   - `kill`
   - `fallback`
3. 保持 review-first、boundary-first，不把 `/operating` 扩成 orchestration plane
4. 复用 current-main 已存在的 checkpoint / takeover / close seam，不发明新的控制事件族

## 2. 当前范围

这次只允许：

1. `/operating` 新增狭义 swarm control summary / action card
2. 让 `/operating` 调用当前可信的 bounded seam：
   - `pause` -> human input checkpoint request
   - `resume` -> checkpoint resume
   - `kill` -> close request
   - `fallback` -> operator takeover lifecycle bridge
3. 必要时把 `sourcePage` 明确透传为 `/operating`
4. 同步 `PLANS.md`、`docs/README.md`、必要的自检入口和测试

这次不做：

- meeting runtime surface 改造
- persisted lifecycle trace 扩面
- takeover / remediation parity 扩面
- close / settlement parity 扩面
- new event family
- new persistence
- new authority
- scheduler / orchestration plane

## 3. 关键假设

1. 这次 `SWARM-004` 只拥有 `/operating` 上的 operator control surface，不拥有 shared runtime/debugger adjacency
2. current-main 没有真正的 generic swarm kill primitive，因此 `kill` 只能诚实桥接到 close request
3. current-main 没有真正的 generic swarm pause primitive，因此 `pause` 只能诚实桥接到 human input checkpoint request
4. current-main 没有 native single-agent fallback plane，因此 `fallback` 只能诚实桥接到 bounded operator takeover lifecycle

## 4. 影响面

- operator surface
  - `features/internal-operating-workspace/runtime-operator-panel.tsx`
- action seam
  - `features/meetings/actions.ts`
- runtime read model
  - `lib/helm-v2/runtime-upgrade.ts`
  - `lib/helm-v2/contracts.ts`
  - `lib/helm-v2/swarm-operator-control-surface.ts`
- docs / guard
  - `PLANS.md`
  - `docs/README.md`
  - `scripts/helm-self-check.ts`

## 5. 最小实施方案

### Slice 1

1. 新增共享 `swarm-operator-control-surface` helper
2. 只为 `/operating` 选择一个 bounded focus thread
3. 统一投影四个控制的可用状态、摘要、边界说明

### Slice 2

1. 在 `/operating` 加一张独立 control card
2. 只放四类按钮，不夹带 persisted trace / takeover parity / settlement adjacency

### Slice 3

1. 为 `/operating` 复用现有 action wrapper，并补 `sourcePage`
2. 新增最小 resume wrapper，直接走现有 checkpoint resume seam

## 6. 验证方案

最小必要验证：

```bash
npx vitest run lib/helm-v2/swarm-operator-control-surface.test.ts
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run build
git diff --check
```

如果更重链路未运行，报告中必须写明原因。

## 7. 完成定义

这条狭义 `SWARM-004` 视为成立，必须同时满足：

1. `/operating` 存在单独的 operator swarm control surface
2. `pause / resume / kill / fallback` 四类控制都有明确 readout
3. 每个控制都诚实标注其 bridge seam 和 boundary note
4. 没有把 persisted trace / takeover-remediation / close-settlement adjacency 再塞回 `SWARM-004`
5. 文档、索引、测试和最小验证链同步

## 8. 暂停口径

1. 当前 narrow slice 已经收口，不再继续在这条线追加 `SWARM-004L+`
2. 如果 reviewer 没有直接要求修正现有 narrow slice，这条线默认保持 parked
3. 如果未来继续：
   - verification / merge lane 相关工作回到 `SWARM-003`
   - candidate-only consolidation 相关工作回到 `SWARM-005`
   - persisted trace / takeover-remediation / close-settlement adjacency 新开 backlog 编号
4. 当前 closeout 以 [`HELM_V2_1_SWARM_004_OPERATOR_CONTROL_SURFACE_CLOSEOUT_V1.md`](docs/reviews/HELM_V2_1_SWARM_004_OPERATOR_CONTROL_SURFACE_CLOSEOUT_V1.md) 为准

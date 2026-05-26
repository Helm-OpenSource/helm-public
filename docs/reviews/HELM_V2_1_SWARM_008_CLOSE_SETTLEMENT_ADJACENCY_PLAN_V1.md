---
status: active
owner: helm-core
created: 2026-04-22
review_after: 2026-07-21
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.1 SWARM-008 Close / Settlement Adjacency Plan V1

## 结论

`SWARM-008` 在 re-baseline 之后只拥有 `shared close / settlement adjacency surfaces`。当前这刀继续停留在 read-only family 内，但把切片推进到 `shared close request / settlement review handoff parity + focus-link hardening`：让 meeting runtime 和 `/operating` continuity queue 都切到同一份 shared handoff readout，不继续把 `SWARM-008` 扩成 new action、new persistence 或新的 control plane。

一句话：`SWARM-008` 当前只回答“close / settlement truth 能否在两个已存在 surface 上保持 read-only close / settlement parity，并且从 `/operating` 精确跳回 meeting runtime 的对应 detail section”，不回答 operator control、candidate consolidation、persisted trace family、takeover/remediation adjacency 或执行控制。

## 方案

### 1. 目标

当前阶段只做 5 件事：

1. 新增 shared close / settlement adjacency surfaces helper
2. 让 `/operating` continuity queue 不再只暴露薄 close / settlement state，而是消费同一份 handoff truth
3. 让 meeting runtime 的 close / settlement 区块与 `/operating` continuity queue 共用同一份 compact handoff readout
4. 补齐 focus-link hardening，让 `/operating` 可以直接回跳到 meeting runtime 的对应锚点
5. 同步 `PLANS.md`、`docs/README.md`、`helm-self-check` 和 `decision-first-boundary-check`

这条线不是：

- `SWARM-004` operator control surface
- `SWARM-005` candidate-only consolidation
- `SWARM-006` persisted lifecycle trace readout family
- `SWARM-007` takeover / remediation parity
- new action
- new persistence
- new control plane

### 2. 当前假设

1. current-main 已经存在完整的 close / settlement source truth
2. 真正缺口在 meeting runtime 与 `/operating` 还没有共享同一份 close / settlement handoff readout
3. 当前最小正确修复是 shared readout parity + focus-link hardening，而不是再发明更多薄字段或新的 action seam
4. `SWARM-008` 当前切片应停留在 read-only close / settlement parity，不进入 write-side adjacency

### 3. 当前切片

这轮当前 slice 只改：

- shared helper
- meeting runtime close / settlement handoff readout
- `/operating` continuity queue close / settlement handoff readout
- read-only close request / settlement review parity
- tests / docs / guards

这轮不改：

- runtime write seam
- operator control surface
- takeover / remediation parity
- persisted lifecycle trace parity
- new action
- new persistence
- new control plane

### 4. 影响面

- shared helper
  - `lib/helm-v2/close-settlement-handoff-readout.ts`
- meeting runtime surface
  - `features/meetings/meeting-v2-runtime-card.tsx`
- `/operating` continuity queue
  - `features/internal-operating-workspace/runtime-operator-panel.tsx`
- docs / guards
  - `PLANS.md`
  - `docs/README.md`
  - `scripts/helm-self-check.ts`
  - `scripts/decision-first-boundary-check.ts`

### 5. 建议读口收口

后续 `SWARM-008` 继续实现时，读口只应回答：

1. close / settlement handoff readout family 是否仍保持 read-only close / settlement parity
2. close request / settlement review truth 是否在 meeting runtime 与 `/operating` 一致
3. focus-link 是否还能把 `/operating` continuity queue 精确落回对应 meeting runtime section
4. 是否还在复用同一份 shared helper，而不是继续散落成薄字符串

故意不让 `SWARM-008` 继续回答：

- operator `pause / resume / kill / fallback`
- candidate-only consolidation queue
- persisted lifecycle trace readout family
- takeover / remediation parity
- new action family
- new persistence
- new control plane

## 受影响组件

这一刀只影响：

- `lib/helm-v2/close-settlement-handoff-readout.ts`
- `features/meetings/meeting-v2-runtime-card.tsx`
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
- `lib/helm-v2/close-settlement-handoff-readout.test.ts`
- `PLANS.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`

## 权衡

### 为什么先做 close request / settlement review handoff parity

因为这是当前最明确、影响最小的一刀。meeting runtime 已经有更完整的 close / settlement truth，`/operating` continuity queue 仍主要暴露薄状态。继续把 handoff readout 收成 shared helper，能提升一致性，而不引入新的执行控制。

### 为什么不继续扩到 closeout outcome / close control 或新 action

因为这些会立刻把 `SWARM-008` 从 read-only family 推向 write-side adjacency。当前切片必须保持 narrow，只收 shared readout parity 和 focus-link hardening。

## 风险

1. 如果继续往 close control、closeout outcome 或 workspace-top summary 扩，这条线会滑向 broader control plane
2. 如果 close / settlement 继续只靠薄字段拼接，meeting runtime 和 `/operating` 会再次 drift
3. 当前只做 close / settlement parity，还没有进入任何新的 write-side seam

## 验证结果

当前切片最小验证：

```bash
npx vitest run lib/helm-v2/close-settlement-handoff-readout.test.ts
npm run self-check
npm run check:boundaries
npm run typecheck
git diff --check
```

如果运行时代码继续扩大，再升级到更重链路。

## 剩余风险

1. `SWARM-008` 当前只完成 shared close request / settlement review handoff parity + focus-link hardening
2. close / settlement 更深层 adjacency 仍未进入这条线
3. 如果继续往 close control、closeout outcome 或新 action 扩，会重新滑向 broader control plane

## 下一步建议

1. 先把 `SWARM-008` 固定成 shared close / settlement adjacency surfaces 的 narrow read-only parity 线
2. 如果继续下一刀，优先评估是否还有独立的 close / settlement 只读缺口，不要直接进入 action / persistence / control plane
3. 只要需求开始要求 new action、new persistence 或 new control plane，立即停手并回到 re-baseline 分流

---
status: archived
owner: helm-core
created: 2026-04-22
review_after: 2026-10-19
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2.1 SWARM-007 Takeover / Remediation Handoff Plan V1

## 结论

`SWARM-007` 在 re-baseline 之后只拥有 `shared takeover / remediation handoff surfaces`。当前这刀继续停留在 read-only family 内，但把切片推进到 `shared takeover lifecycle surface parity + continuity remediation handoff`：让 meeting runtime 和 `/operating` continuity queue 都切到同一份 shared handoff readout，不继续把 `SWARM-007` 扩成 close / settlement adjacency、new action、new persistence 或新的 control plane。

一句话：`SWARM-007` 当前只回答“takeover / remediation truth 能否在两个已存在 surface 上保持 read-only parity”，不回答 operator control、candidate consolidation、persisted trace family、close / settlement adjacency 或执行控制。

## 方案

### 1. 目标

当前阶段只做 5 件事：

1. 新增 shared takeover / remediation handoff readout helper
2. 让 `/operating` continuity queue 不再只暴露薄 takeover state，而是消费同一份 handoff truth
3. 让 meeting runtime 的 takeover assistance 区块与 `/operating` continuity queue 共用同一份 compact handoff / remediation readout
4. 同步 `PLANS.md`、`docs/README.md`、`helm-self-check` 和 `decision-first-boundary-check`
5. 把 `SWARM-007` 明确冻结成 read-only parity，而不是新的 control plane

这条线不是：

- `SWARM-003` verification merge lanes
- `SWARM-004` operator control surface
- `SWARM-005` candidate-only consolidation
- `SWARM-006` persisted lifecycle trace readout family
- close / settlement parity
- new action
- new persistence
- new control plane

### 2. 当前假设

1. current-main 已经存在完整的 takeover / remediation source truth
2. 真正缺口在 meeting runtime 与 `/operating` 还没有共享同一份 takeover / remediation handoff readout
3. 当前最小正确修复是 shared readout parity，而不是再发明更多薄字段或新的 action seam
4. `SWARM-007` 当前切片应停留在 read-only parity，不进入 close / settlement 邻接实现

### 3. 当前切片

这轮当前 slice 只改：

- shared helper
- meeting runtime takeover / remediation handoff readout
- `/operating` continuity queue handoff readout
- read-only takeover / remediation parity
- tests / docs / guards

这轮不改：

- server actions
- operator control surface
- close / settlement parity
- workspace-top summary propagation
- new action
- new persistence
- new control plane

### 4. 影响面

- shared helper
  - `lib/helm-v2/takeover-remediation-handoff-readout.ts`
- runtime projection
  - `lib/helm-v2/runtime-upgrade.ts`
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

后续 `SWARM-007` 继续实现时，读口只应回答：

1. takeover / remediation handoff readout family 是否仍保持 read-only parity
2. takeover lifecycle 和 latest remediation truth 是否在 meeting runtime 与 `/operating` 一致
3. 是否还在复用同一份 shared helper，而不是继续散落成薄字符串

故意不让 `SWARM-007` 继续回答：

- operator `pause / resume / kill / fallback`
- candidate-only consolidation queue
- persisted lifecycle trace readout family
- close / settlement parity
- new action family
- new persistence
- new control plane

## 受影响组件

这一刀只影响：

- `lib/helm-v2/takeover-remediation-handoff-readout.ts`
- `lib/helm-v2/runtime-upgrade.ts`
- `features/meetings/meeting-v2-runtime-card.tsx`
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
- `lib/helm-v2/takeover-remediation-handoff-readout.test.ts`
- `lib/helm-v2/runtime-upgrade.test.ts`
- `PLANS.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`

## 权衡

### 为什么先做 takeover / remediation handoff parity

因为这仍然是当前最明确、影响最小的一刀。meeting runtime 已经有更完整的 takeover / remediation truth，`/operating` continuity queue 仍主要暴露薄状态。继续把 handoff readout 收成 shared helper，能提升一致性，而不引入新的执行控制。

### 为什么不继续扩到 close / settlement 邻接

因为这些已经被 re-baseline 划成 `SWARM-008` 范围。当前这刀必须保持 read-only parity，不再把 shared adjacency 全塞进同一个切片。

## 风险

1. 如果继续往 close / settlement 或 workspace-top summary 扩，这条线会重新滑向 broader control plane
2. 如果 takeover / remediation 继续只靠薄字段拼接，meeting runtime 和 `/operating` 会再次 drift
3. 当前只做 takeover / remediation parity，还没有进入更宽的 adjacency family

## 验证结果

当前切片最小验证：

```bash
npx vitest run lib/helm-v2/takeover-remediation-handoff-readout.test.ts lib/helm-v2/runtime-upgrade.test.ts
npm run self-check
npm run check:boundaries
npm run typecheck
git diff --check
```

如果运行时代码继续扩大，再升级到更重链路。

## 剩余风险

1. `SWARM-007` 当前只完成 shared takeover / remediation handoff readout parity
2. close / settlement 邻接仍未进入这条线
3. 如果继续往 close / settlement 或 workspace-top summary 扩，会重新滑向 broader control plane

## 下一步建议

1. 先把 `SWARM-007` 固定成 shared takeover / remediation handoff family 的 narrow read-only parity 线
2. 如果继续下一刀，优先评估是否还有独立的 takeover / remediation 只读缺口，不要直接进入 action / persistence / control plane
3. 只要需求开始要求 close / settlement parity、new action、new persistence 或 new control plane，立即停手并回到 re-baseline 分流

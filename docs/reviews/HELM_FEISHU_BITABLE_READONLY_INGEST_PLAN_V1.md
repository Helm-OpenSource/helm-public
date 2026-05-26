# Helm Feishu Bitable Read-only Ingest Plan

更新日期：2026-05-21

## 目标

在不扩成 connector platform 的前提下，把飞书接入推进到一条最小可验证的 `Bitable read-only ingest` 路径，并保证 Helm 继续同时支持钉钉和飞书。

## 本轮要做

1. 在 `lib/connectors/feishu.ts` 补齐 read-only ingest contract、tenant access token helper 和 env-backed Bitable binding config。
2. 新增 `lib/connectors/feishu-ingestion.ts`，把飞书多维表格读取收成 workspace-scoped runtime artifact 闭环。
3. 新增 `syncFeishuConnectorAction()` 与 `/api/connectors/feishu/sync-now`。
4. 把 settings readout 从“Bitable read pending”推进到“可执行只读采集 + 可见 ingest posture”。
5. 同步 README / docs / STATUS / self-check / boundary check / Vitest。

## 本轮不做

- workspace-managed Bitable registry UI
- message draft(review-first)
- send / write-back
- auto-send
- directory platformization

## 验证计划

- targeted Vitest：
  - `lib/connectors/feishu.test.ts`
  - `lib/connectors/feishu-ingestion.test.ts`
  - `lib/connectors/feishu-sync-now-route.test.ts`
  - 既有 Feishu auth / public auth / settings 相关测试
- `npm run typecheck`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run lint`
- `npm run build`

## 预期结论

这轮最多只把 “Feishu Bitable read-only ingest seam” 升到：

- 已成形但仍需下一层

不会把它写成：

- 完整 Feishu connector platform
- 完整 Bitable binding control plane
- 已具备 message send / auto-send / write-back

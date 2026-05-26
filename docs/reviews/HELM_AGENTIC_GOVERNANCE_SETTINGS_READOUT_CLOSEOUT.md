---
status: active
owner: helm-core
created: 2026-05-02
review_after: 2026-06-02
archive_trigger:
  - Agentic Governance Phase 2 requirements supersede this readout and are indexed in docs/README.md
  - Connector permission summary gains an editor or runtime control plane and this read-only closeout must be replaced
---

# Helm Agentic Governance Settings Readout Closeout

## 1. 结论

Agentic Governance connector permission summary 已接入 `/settings?tab=connectors`，作为只读 admin-visible readout。

本轮只做展示：

- 展示 HubSpot / Salesforce / Gmail / AliMail / DingTalk / WeCom 的 data scope。
- 展示 `autoAllowed / reviewRequired / neverAllowed` 三轨权限。
- 展示 credential posture、sync posture 和 boundary note。
- 明确 auto lane 只允许来源读取和复核材料准备。

本轮不做 permission editor、connector control plane、send/write-back/approve/pay action、provider credential、schema、runtime adapter、API route 或 production query。

## 2. 已落地范围

| 项 | 证据 |
|---|---|
| Settings surface | `features/settings/components/connector-permission-summary-panel.tsx` |
| Settings route | `/settings?tab=connectors`，插在 tenant resource governance 与 live connectors 之间 |
| Source contract | `features/agentic-governance/connector-permission-summary.ts` |
| UI guard test | `features/settings/components/connector-permission-summary-panel.test.tsx` 断言无 `button / a / input / select / textarea` |
| Test discovery | `vitest.config.ts` 扩展为 `features/**/*.test.tsx` |

## 3. 四档判断

| 类型 | 结论 | 证据 |
|---|---|---|
| 已经完整成立 | Settings read-only connector permission readout | 组件、页面接入、测试、requirements / STATUS / README 同步 |
| 已成形但仍需下一层 | `/operating` resource card 入口 | 未纳入本轮；如需必须单独开窄切片 |
| 刻意未做 | permission editor / connector control plane / runtime execution | 当前需求只要求 admin-visible readout |
| 风险项 | readout 被误读成授权 | 页面文案和测试都要求 no control / no write / no send |

## 4. 验证

已执行：

```bash
npx vitest run features/settings/components/connector-permission-summary-panel.test.tsx
npx vitest run features/agentic-governance/back-office-governance-signal.test.ts features/agentic-governance/messaging-rewrite-guard.test.ts features/agentic-governance/connector-permission-summary.test.ts features/external-agent-intake/intake-decision.test.ts features/external-agent-intake/manual-import.test.ts features/settings/components/connector-permission-summary-panel.test.tsx
npm run eval:agentic-governance
npm run eval:external-agent-intake
npm run typecheck
npm run lint
npm run check:boundaries
npm run build
npm run check:public-release
git diff --check
```

额外验证修复：

```bash
npx vitest run features/external-agent-intake/provider-registry.test.ts
npx vitest run lib/tenant-resources/manual-proof-runtime.test.ts
npx vitest run features/external-agent-intake/provider-registry.test.ts lib/tenant-resources/manual-proof-runtime.test.ts features/settings/components/connector-permission-summary-panel.test.tsx
npx eslint --max-warnings 0 features/external-agent-intake/provider-registry.test.ts lib/tenant-resources/manual-proof-runtime.test.ts features/settings/components/connector-permission-summary-panel.tsx features/settings/components/connector-permission-summary-panel.test.tsx features/settings/settings-client.tsx vitest.config.ts
```

全量 `npm run test` 在当前本地环境仍未通过：剩余阻塞为当前 `DATABASE_URL` 指向的 `helm2026` 库缺少 `AuditLog.traceId` 列，导致 `lib/helm-v2/*runtime*.test.ts` 的 audit 写入失败。该阻塞不是本 readout 改动引入；本轮已修复同次全量测试暴露的两个非 DB 问题：`provider-registry.test.ts` 的 15 条 fixture 硬编码、`manual-proof-runtime.test.ts` 的 2026-05-02 过期 fixture。

## 5. 下一步

1. 如需 Phase 2，先写 requirements，不得从当前 readout 直接进入 runtime。
2. 如需 `/operating` read-only resource card，单独切片，只能复用 summary，不得加执行按钮。
3. 新 connector 必须先补 summary、fixtures、reason codes 和 eval 覆盖，再进入 UI 或 runtime 讨论。

## 6. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-02 | 首版：`/settings?tab=connectors` 只读 connector permission summary readout 落地 |

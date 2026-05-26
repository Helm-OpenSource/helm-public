---
status: active
owner: helm-core
created: 2026-05-01
review_after: 2026-06-01
archive_trigger:
  - External Agent Intake Phase 1 被替换为正式 runtime/API 方案并完成独立 owner approval
  - Business Advancement 入口合同发生结构性变化，导致本映射表不再覆盖当前 candidate layer
  - 2026-07-01 后仍未进入 manual import demo，本计划必须重新评审
---

# External Agent Intake To Business Advancement Plan

## 1. 结论

External Agent Intake Phase 1 只允许把外部 Agent 输出映射为 Business Advancement 的候选证据、草稿附件、复核候选、观察项或隔离报告。

它不允许把 `ExternalAgentArtifact` 直接变成：

- Must Push item
- MemoryCandidate
- active memory
- production query source
- official write
- send action
- final ranking input

## 2. Mapping Contract

| Intake disposition | Business Advancement mapping | Phase 1 权限 |
|---|---|---|
| `accept_as_evidence_candidate` | supporting evidence candidate | 只能作为已有 review packet / signal 的证据附件候选 |
| `accept_as_draft_candidate` | review packet draft attachment | 只能作为人工复核草稿附件；draft 不等于 sent |
| `review_required` | review packet candidate | 只能进入人工复核候选，不能进入 active signal |
| `watch_only` | observation only | 只保留评估读数，不 downstream |
| `reject` | no downstream mapping | 不进入 Business Advancement |
| `quarantine` | containment report | 只进入隔离 / 风险说明，不 downstream |

## 3. Required Boundaries

- external agent output != business truth
- provider confidence != Helm confidence
- workflow trace != business outcome
- tool receipt != official write success
- draft != send
- retrieval != memory
- evidence candidate != Must Push

## 4. Allowed Next Work

Phase 1 之后只允许推进：

1. manual import demo with fixture-like JSON
2. reviewer-facing readout of intake decisions
3. provider profile periodic review
4. object / signal validity gate handoff
5. containment report formatting

## 5. Explicit No-Go

以下事项仍需 owner 另行批准，且不能由本计划自动授权：

- provider 官方 API
- provider credential / token 保存
- runtime adapter
- schema migration
- API route
- UI
- production query adoption
- direct Must Push
- direct MemoryCandidate / active memory
- official write
- auto send / auto approve / auto settlement
- Browser / RPA 自动执行

## 6. 验证入口

```bash
npm run eval:external-agent-intake
npx vitest run features/external-agent-intake/provider-registry.test.ts features/external-agent-intake/intake-decision.test.ts
npm run check:boundaries
```

## 7. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-01 | 首版：固定 External Agent Intake Phase 1 到 Business Advancement 的 candidate-only 映射 |

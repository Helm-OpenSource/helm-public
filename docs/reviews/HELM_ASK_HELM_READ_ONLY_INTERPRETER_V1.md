---
status: active
owner: helm-core
created: 2026-04-25
review_after: 2026-07-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Ask Helm Read-only Interpreter V1

更新时间：2026-04-25
状态：Complete
对应计划切片：`Slice 3 - Read-only Query Interpreter`

## 1. 结论

Ask Helm v1 已新增 read-only query interpreter。

解释器当前是纯函数，不接 DB、不调用 LLM、不写状态。它负责把 raw query 收口成：

- query intent classification
- read-only retrieval plan
- structured response contract
- related objects passthrough
- primary next step
- boundary note
- grounding metadata

## 2. 方案

本轮新增：

- `features/search/ask-helm-interpreter.ts`
  - `AskHelmResponse` contract
  - `AskHelmRetrievalPlan`
  - `interpretAskHelmQuery`
- `features/search/ask-helm-interpreter.test.ts`
  - 覆盖对象搜索、系统帮助、高风险拒绝、阻塞解释
- `scripts/ask-helm-interpreter-validate.ts`
  - 最小 scenario validation
- `npm run eval:ask-helm-interpreter`
  - 输出 intent、retrieval source、next step 和 boundary 摘要

## 3. 受影响组件

- `features/search/*`
  - 新增 Ask Helm 解释器与 response contract
- `scripts/*`
  - 新增解释器 validation runner
- `package.json`
  - 新增 `eval:ask-helm-interpreter`
- `docs/README.md`
  - 新增报告索引

## 4. 边界

解释器强制：

- `readOnly: true`
- `writePath: false`
- out-of-scope 不加载 workspace source
- official write path 永远进入 `deniedSources`

支持的 retrieval source 仅限：

1. `object_search`
2. `memory_summary`
3. `workspace_context`
4. `knowledge_pack`

## 5. 权衡

- 当前解释器不直接查 DB，避免在 Slice 3 同时引入权限、查询和页面复杂度。
- related objects 由调用方传入，后续 `/search` 页面可以复用现有 `searchWorkspaceEntities`。
- LLM 仍未接入；回答文案是 deterministic baseline，后续 LLM 只能做 rewrite / explanation / next-step wording，不能改变权限和 write path。

## 6. 验证方式

定向验证：

```bash
npm run test -- features/search/ask-helm-interpreter.test.ts
npm run eval:ask-helm-interpreter
```

验收标准：

- supported query 必须有 primary next step
- out-of-scope 必须返回 boundary note
- 所有响应保持 `readOnly: true` 与 `writePath: false`
- blocker/recommendation 类问题必须带 review 或 non-commitment boundary

## 7. 剩余风险

- 还没有接入真实对象搜索结果、真实记忆摘要或真实 workspace feature 数据。
- response contract 还没有在 `/search` UI 展示。
- 当前 explanation 是 deterministic baseline，还不是最终经营语言增强。

## 8. 下一步

进入 `Slice 4 - /search Dual-Mode UX`：

1. 保留对象搜索默认体验
2. 增加 `搜索对象 / 问 Helm` 模式切换
3. ask mode 固定展示 related objects、answer、next step、boundary note
4. 不新增 chat center，不替代 detail / memory / approvals / operating

---
status: active
owner: helm-core
created: 2026-04-25
review_after: 2026-07-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Ask Helm Query Intent Taxonomy V1

更新时间：2026-04-25
状态：Complete
对应计划切片：`Slice 1 - Query Intent Taxonomy + Offline Eval`

## 1. 结论

Ask Helm v1 已建立第一版 query intent taxonomy、33 条离线黄金样本和 rule-based baseline。

当前 Slice 1 的目标不是回答问题，也不是接入 `/search` UI，而是先把自然语言入口的分类边界做实：

- supported intent 能稳定分到对象、记忆、系统知识、下一步或解释类查询
- `out_of_scope` 能覆盖跨工作区、越权、自动发送、自动审批、自动承诺等高风险请求
- 每条样本显式标注 `needsObjectContext`、`needsMemory`、`needsSystemKnowledge` 和 `expectedPrimaryTarget`

## 2. 方案

本轮新增：

- `features/search/ask-helm-query-intent.ts`
  - Ask Helm intent type、primary target、metadata 和 deterministic classifier
- `evals/ask-helm/query-intents.json`
  - 33 条黄金样本，每类 3 条
- `lib/evals/ask-helm-query-intent-evals.ts`
  - 离线评估 runner
- `scripts/ask-helm-query-intent-evals.ts`
  - npm eval 入口

当前分类器保持 deterministic，原因是 Slice 1 只需要一个可审计 baseline。后续如果引入 LLM classifier，也必须继续以这批黄金样本做回归门槛。

## 3. Intent Taxonomy

第一版支持 11 类：

1. `object_search`
2. `object_recent`
3. `current_status`
4. `today_priority`
5. `why_recommendation`
6. `why_blocked`
7. `how_to_use`
8. `definition_diff`
9. `next_step_page`
10. `next_step_object`
11. `out_of_scope`

这些类型刻意不包含：

- auto-send
- auto-approve
- payment execution
- cross-workspace answer
- reserved-only internal truth lookup

## 4. 受影响组件

- `features/search/*`
  - 新增 Ask Helm query intent taxonomy 与定向单测
- `lib/evals/*`
  - 新增 Ask Helm query intent 离线评估
- `evals/ask-helm/*`
  - 新增黄金样本
- `scripts/*`
  - 新增 eval runner
- `package.json`
  - 新增 `npm run eval:ask-helm-query-intents`
- `docs/README.md`
  - 新增报告索引

## 5. 权衡

- 当前选择 rule-based baseline，不做 LLM classifier，是为了让分类失败能被精确定位和回归。
- 当前不接 DB、不接 `/search` 页面，是为了把 query boundary 和 runtime surface 解耦。
- 当前样本集只覆盖最小可接受类型，不宣称覆盖全部自然语言表达。

## 6. 验证方式

定向验证：

```bash
npm run test -- features/search/ask-helm-query-intent.test.ts lib/evals/ask-helm-query-intent-evals.test.ts
npm run eval:ask-helm-query-intents
```

验收标准：

- 黄金样本加载成功
- 33 条样本 baseline pass rate 不低于 80%
- `out_of_scope` 对高风险请求保持拒绝

## 7. 剩余风险

- query 表达仍可能在真实使用中出现未覆盖说法，后续必须把误判样本回灌到 `evals/ask-helm/query-intents.json`。
- rule-based baseline 不是最终智能分类能力，只是第一阶段可审计门槛。
- taxonomy 只解决“用户在问什么”，还没有解决“回答应加载哪些对象、记忆和系统知识”。

## 8. 下一步

进入 `Slice 2 - Runtime Knowledge Pack Loader`：

1. 建立 `AskHelmKnowledgePack` contract
2. 覆盖 `/search`、`/memory`、`/approvals`、`/operating`、`/settings`
3. 只通过结构化 schema 暴露系统知识，不直接 dump 文档
4. 为 feature availability 和 reserved-only boundary 加验证

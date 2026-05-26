---
status: active
owner: helm-core
created: 2026-04-25
review_after: 2026-07-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Ask Helm Validation And Stop Conditions V1

更新时间：2026-04-25
状态：Complete
对应计划切片：`Slice 6 - Validation + Stop Conditions`

## 1. 结论

Ask Helm v1 已新增聚合验证命令：

```bash
npm run eval:ask-helm
```

它汇总检查：

- query intent baseline
- runtime knowledge pack
- read-only interpreter
- access scope
- stop conditions

## 2. 方案

本轮新增：

- `scripts/ask-helm-validation-suite.ts`
  - 聚合 Slice 1-5 的最小验收
- `npm run eval:ask-helm`
  - 单命令输出 go/no-go 摘要

## 3. Go / No-go 指标

当前 go 条件：

1. query intent pass rate 不低于 80%
2. knowledge pack validation `ok: true`
3. interpreter 所有 case 保持 `readOnly: true` 与 `writePath: false`
4. interpreter 所有 supported / denied case 都有 primary next step
5. out-of-scope case 必须带 `out_of_scope` boundary
6. member scope 只能读取 current workspace
7. non-member scope 必须 denied
8. reserved / high-risk help topics 必须 denied

## 4. Stop Conditions

触发任意一条应暂停继续加深：

1. `classifier_pass_rate_below_80`
   - 分类 baseline 低于 80%
2. `knowledge_pack_not_structured`
   - knowledge pack 不能通过结构化 validation
3. `missing_next_step`
   - interpreter 经常没有 primary next step
4. `write_path_enabled`
   - 任意 Ask Helm response 打开 write path
5. `access_scope_leak`
   - non-member、reserved topic、official write 或跨 workspace source 发生泄露

## 5. 受影响组件

- `scripts/*`
  - 新增 Ask Helm 聚合 validation suite
- `package.json`
  - 新增 `eval:ask-helm`
- `docs/README.md`
  - 新增报告索引
- `docs/reviews/HELM_ASK_HELM_NATURAL_LANGUAGE_ENTRY_IMPLEMENTATION_PLAN_V1.md`
  - 状态收口为 Complete

## 6. 验证方式

定向验证：

```bash
npm run eval:ask-helm
```

本轮还应配合运行：

```bash
npm run test -- features/search/ask-helm-query-intent.test.ts features/search/ask-helm-knowledge-pack.test.ts features/search/ask-helm-interpreter.test.ts features/search/ask-helm-search-page-adapter.test.ts features/search/ask-helm-access-scope.test.ts lib/evals/ask-helm-query-intent-evals.test.ts
npm run typecheck
```

## 7. 回滚路径

- 回滚 Slice 4 可恢复 `/search` 纯对象搜索体验
- 回滚 Slice 3 可保留 taxonomy / knowledge pack，不暴露解释器
- 回滚 Slice 2 可保留 taxonomy eval，不暴露系统知识层
- 回滚 Slice 1 可移除 Ask Helm 分类入口
- access scope 可独立保留为未来自然语言入口的 guard

## 8. 剩余风险

- 还没有接入 LLM explanation，只完成 deterministic baseline。
- 还没有对象级细粒度 ACL；当前仍依赖 workspace-scoped query。
- 还没有 Playwright 视觉回归。
- 没有新增 chat center，也没有新增 write path；这是刻意未做。

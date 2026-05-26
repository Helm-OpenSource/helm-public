---
status: archived
owner: helm-core
created: 2026-04-25
review_after: 2026-10-22
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Ask Helm Natural Language Entry Implementation Closeout V1

更新时间：2026-04-25
状态：Complete with DB-backed validation blocked by local MySQL prerequisite

## 1. 结论

Ask Helm v1 的计划切片已经完成最小实现：

1. Query Intent Taxonomy + Offline Eval
2. Runtime Knowledge Pack Loader
3. Read-only Query Interpreter
4. `/search` Dual-Mode UX
5. Access Control + Capability-aware Help Scope
6. Validation + Stop Conditions

当前成立的是一个 `workspace-scoped / read-only first / action-first` 的自然语言入口 baseline。它没有新增聊天中心，没有新增 write path，也没有把 recommendation 写成 commitment。

## 2. 已经完整成立

- `/search` 支持 `搜索对象 / 问 Helm` 双模
- 对象搜索默认体验保留
- Ask mode 固定展示 related objects、answer、next step、boundary note
- Query intent taxonomy 覆盖 11 类 intent
- 33 条 query intent 黄金样本 100% 通过
- Knowledge pack 用结构化 schema，不依赖 docs dump
- Interpreter 输出 read-only retrieval plan 和 structured response
- Access scope 强制 current-workspace-only retrieval policy
- reserved / settlement / payment / auto-send / auto-approve / official write 默认 denied
- 聚合验证命令 `npm run eval:ask-helm` 通过

## 3. 已成形但仍需下一层

- LLM explanation 还未接入；当前是 deterministic baseline
- 对象级细粒度 ACL 还未新增；当前继续依赖 workspace-scoped query
- mixed query retrieval 仍使用现有对象搜索作为 related object 来源
- Ask mode 还没有 Playwright 视觉回归
- 顶部 shell 搜索仍默认对象搜索，未做全局复杂双模控件

## 4. 刻意未做

- 不做 chat center
- 不做跨 workspace 问答
- 不做开放域搜索
- 不做自动发送
- 不做自动审批
- 不做支付执行
- 不做 official write path
- 不做新的 workflow / orchestration 平台

## 5. 风险项

- 真实用户 query 可能出现黄金样本未覆盖表达，需要把误判回灌到 `evals/ask-helm/query-intents.json`
- knowledge pack 后续若支持热更新，必须先加 schema validation 和审计
- 如果未来在 detail / memory 页面加入 Ask Helm，必须复用 `resolveAskHelmAccessScope`
- DB-backed 全量测试和 e2e 需要本机 MySQL 前置；当前机器 `127.0.0.1:3306` 不可达，且没有 `mysql` 客户端

## 6. 验证结果

已通过：

```bash
npm run eval:ask-helm-query-intents
npm run eval:ask-helm-knowledge-pack
npm run eval:ask-helm-interpreter
npm run eval:ask-helm-access-scope
npm run eval:ask-helm
npm run test -- lib/presentation/shared-surface-hierarchy-guards.test.ts features/search/ask-helm-query-intent.test.ts features/search/ask-helm-knowledge-pack.test.ts features/search/ask-helm-interpreter.test.ts features/search/ask-helm-search-page-adapter.test.ts features/search/ask-helm-access-scope.test.ts lib/evals/ask-helm-query-intent-evals.test.ts
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run build
npm run quality:regression
git diff --check
```

关键结果：

- `eval:ask-helm-query-intents`：33 / 33，通过率 100%
- `eval:ask-helm`：`ok: true`，所有 stop conditions clear
- 定向测试：7 files / 55 tests passed
- self-check：18 / 18 passed
- boundary check：pass
- typecheck：pass
- lint：0 errors，7 warnings，warning 来自既有文件
- build：pass
- quality regression：51 files / 181 tests passed
- diff check：pass

未通过 / 未运行：

- `npm run test` 全量执行时，DB-backed runtime tests 因 `127.0.0.1:3306` MySQL 不可达失败；其中 1 个非 DB 守卫失败已修复并定向复跑通过
- `npm run db:reset` 未运行，因为当前没有确认可安全 reset 的 MySQL 数据库
- `npm run e2e` 未运行，因为脚本会创建临时 MySQL 数据库，当前本机没有 MySQL 服务和客户端

## 7. 下一阶段建议

1. 接入真实 memory summary，但保持 retrieval source policy 不变
2. 给 `/search?mode=ask` 增加 Playwright desktop / mobile 覆盖
3. 将真实用户误判 query 回灌到 query intent eval
4. 如果启用 LLM explanation，只允许改写 explanation 和 next-step wording，不允许改变 policy / write path
5. 准备一个明确的 MySQL test profile，避免全量测试依赖不透明的本机共享数据库

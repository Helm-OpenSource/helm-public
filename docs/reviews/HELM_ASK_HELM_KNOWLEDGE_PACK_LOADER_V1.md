---
status: active
owner: helm-core
created: 2026-04-25
review_after: 2026-07-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Ask Helm Knowledge Pack Loader V1

更新时间：2026-04-25
状态：Complete
对应计划切片：`Slice 2 - Runtime Knowledge Pack Loader`

## 1. 结论

Ask Helm v1 已新增结构化 runtime knowledge pack loader。

这层知识不是 repo docs dump，而是可被 runtime 消费的窄 contract，覆盖：

- 页面职责
- 功能边界
- 功能可用性
- 常见操作
- deep link map

默认仍保持 read-only first，不暴露 `reserved_internal_truth`、跨 workspace 问答、自动发送、自动审批或支付执行。

## 2. 方案

本轮新增：

- `features/search/ask-helm-knowledge-pack.ts`
  - `AskHelmKnowledgePack` contract
  - core page responsibilities
  - feature availability merge
  - validation helper
- `features/search/ask-helm-knowledge-pack.test.ts`
  - 覆盖 required pages、feature merge 和 reserved-only boundary
- `scripts/ask-helm-knowledge-pack-validate.ts`
  - 独立 validation 入口
- `npm run eval:ask-helm-knowledge-pack`
  - 输出当前 pack 验证摘要

## 3. 受影响组件

- `features/search/*`
  - 新增 Ask Helm runtime knowledge pack loader
- `scripts/*`
  - 新增 knowledge pack validation runner
- `package.json`
  - 新增 `eval:ask-helm-knowledge-pack`
- `docs/README.md`
  - 新增报告索引

## 4. 已覆盖页面

第一阶段 required pages：

1. `/search`
2. `/memory`
3. `/approvals`
4. `/operating`
5. `/settings`

同时补入 detail 与 reports surface：

- `/reports`
- `/companies/[id]`
- `/contacts/[id]`
- `/opportunities/[id]`
- `/meetings/[id]`

## 5. 权衡

- 当前 knowledge pack 是静态 contract + context merge，不接 DB。这样能先稳定 schema 和边界，再接解释器。
- tenant extension 只以 `tenant_extension:{slug}` 形式进入 feature availability，不直接展开 extension 内部真值。
- 高风险 capability 即使被 context 请求启用，也会保持 disabled，避免自然语言入口绕过治理边界。

## 6. 验证方式

定向验证：

```bash
npm run test -- features/search/ask-helm-knowledge-pack.test.ts
npm run eval:ask-helm-knowledge-pack
```

验收标准：

- required pages 全部有 responsibilities
- common operations 全部指向有职责定义的页面
- prohibited features 不会进入 enabled features
- `reserved_internal_truth` 明确保持 disabled

## 7. 剩余风险

- 真实 workspace 的 tenant extension / role / feature 数据还没有接入 runtime loader，只是通过 context contract 预留。
- knowledge pack 目前不支持热更新；后续若需要后台配置，必须先补 schema validation 和审计。
- 这层只解决系统知识，不替代对象搜索、记忆读取或解释器。

## 8. 下一步

进入 `Slice 3 - Read-only Query Interpreter`：

1. 输入 raw query、workspace context、当前页面和可选对象
2. 输出 classified intent、retrieval plan 和 response contract
3. retrieval 只允许 object search、memory summary、workspace context、knowledge pack
4. 继续保持无 write path

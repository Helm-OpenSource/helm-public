---
status: active
owner: helm-core
created: 2026-04-25
review_after: 2026-07-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Ask Helm Access Scope V1

更新时间：2026-04-25
状态：Complete
对应计划切片：`Slice 5 - Access Control + Capability-aware Help Scope`

## 1. 结论

Ask Helm v1 已新增 access scope helper，并接入 `/search` ask mode 的 workspace context。

这层把文档里的权限边界落成可验证规则：

- 必须有 workspace membership 才能 Ask
- 对象与记忆 retrieval 只允许 current workspace
- knowledge pack 是 capability-aware
- official write path 永远 denied
- reserved / settlement / payment / auto-send / auto-approve 不进入默认 help scope

## 2. 方案

本轮新增：

- `features/search/ask-helm-access-scope.ts`
  - `resolveAskHelmAccessScope`
  - retrieval source policy
  - denied help topics
  - feature availability boundary
- `features/search/ask-helm-access-scope.test.ts`
  - 覆盖 member、non-member、高风险 help topic 请求
- `scripts/ask-helm-access-scope-validate.ts`
  - 独立 validation 入口
- `/search`
  - ask mode 通过 `getCurrentWorkspaceSession()` 获取 membership
  - 将 access scope 的 enabled / disabled features 传入 interpreter context

## 3. 受影响组件

- `features/search/*`
  - 新增 Ask Helm access scope helper
- `app/(workspace)/search/page.tsx`
  - Ask mode 使用 workspace session 与 access scope
- `scripts/*`
  - 新增 access scope validation runner
- `package.json`
  - 新增 `eval:ask-helm-access-scope`
- `docs/README.md`
  - 新增报告索引

## 4. 边界

强制 denied：

- official write path
- cross-workspace retrieval
- reserved internal truth
- settlement help
- payment execution
- auto-send
- auto-approve

允许范围：

- current workspace object search
- current workspace memory summary
- current workspace context
- capability-aware knowledge pack

## 5. 权衡

- 当前没有新增对象级 ACL 查询；对象读权限继续由既有 workspace-scoped query 承担。
- access scope helper 先做 read policy 和 help scope 裁剪，不引入新权限模型。
- reserved-only truth 即使被 feature request 显式请求，也不会进入 enabled features。

## 6. 验证方式

定向验证：

```bash
npm run test -- features/search/ask-helm-access-scope.test.ts
npm run eval:ask-helm-access-scope
```

验收标准：

- member scope 只能读取 current workspace
- non-member scope 全部 retrieval source denied
- high-risk / reserved help topics 进入 denied list
- official write path 始终 denied

## 7. 剩余风险

- 还没有对象级细粒度 ACL；后续如果引入对象级可见性，必须在 `searchWorkspaceEntities` 或上游 query 层落地。
- access scope 目前只接 `/search` ask mode；未来如果 Ask Helm 出现在 detail 或 memory 页面，需要复用同一 helper。
- help topic deny list 是 deterministic baseline，后续 extension 增加敏感域时需要同步扩展。

## 8. 下一步

进入 `Slice 6 - Validation + Stop Conditions`：

1. 汇总 go/no-go 指标
2. 补一条聚合 validation command
3. 明确 stop conditions 和回滚路径
4. 跑全本轮定向验证，再按风险扩大到仓库验证链

---
status: active
owner: helm-core
created: 2026-04-25
review_after: 2026-07-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Ask Helm Search Dual-Mode UX V1

更新时间：2026-04-25
状态：Complete
对应计划切片：`Slice 4 - /search Dual-Mode UX`

## 1. 结论

`/search` 已升级为双模入口：

- `搜索对象`
- `问 Helm`

对象搜索默认体验保留；Ask Helm 模式使用同一条 `/search` route，不新增聊天中心。

## 2. 方案

本轮新增：

- `/search?mode=ask&q=...`
  - 调用 read-only interpreter
  - 复用现有 `searchWorkspaceEntities`
  - 将对象结果映射为 `relatedObjects`
- `features/search/ask-helm-search-page-adapter.ts`
  - 将联系人、公司、机会、会议映射为 Ask Helm related object contract
- `components/layout/command-palette.tsx`
  - 当对象搜索没有命中时，提供 `问 Helm` 入口

Ask mode 展示顺序固定为：

1. related objects
2. answer
3. next step
4. boundary note

## 3. 受影响组件

- `app/(workspace)/search/page.tsx`
  - 新增模式切换、Ask Helm 展示层、workspace context 传入
- `features/search/ask-helm-search-page-adapter.ts`
  - 新增对象结果适配层
- `components/layout/command-palette.tsx`
  - 新增 Ask Helm fallback 入口
- `docs/README.md`
  - 新增报告索引

## 4. 边界

- `/search` 仍然不是 chat center。
- Ask Helm 不替代 detail / memory / approvals / operating。
- Ask Helm response 继续由 interpreter 强制只读。
- 对象结果仍然来自当前 workspace 的既有对象搜索入口。

## 5. 权衡

- 顶部 shell 搜索仍默认进入对象搜索，降低对既有直达体验的影响。
- 双模切换放在 `/search` 页内，避免把全局 shell 变成复杂问答入口。
- Ask mode 先用 deterministic response contract；后续 LLM 只能做解释措辞增强，不能改变 retrieval plan 或 write boundary。

## 6. 验证方式

定向验证：

```bash
npm run test -- features/search/ask-helm-search-page-adapter.test.ts features/search/ask-helm-interpreter.test.ts
```

验收标准：

- 对象搜索模式仍使用 `q` 查询
- Ask Helm 模式通过 `mode=ask` 显式进入
- related objects 复用当前 workspace search results
- answer / next step / boundary note 来自 read-only interpreter

## 7. 剩余风险

- 还没有 Playwright 覆盖 `/search?mode=ask` 的视觉回归。
- Ask mode 目前使用同一条对象搜索作为 related object 来源，尚未接入更细的 mixed query retrieval。
- 命令面板只在无匹配对象时提供 Ask Helm fallback，后续可考虑明确的 Ask Helm quick action。

## 8. 下一步

进入 `Slice 5 - Access Control + Capability-aware Help Scope`：

1. 明确 workspace membership gate
2. 明确对象结果仍由 workspace-scoped search query 过滤
3. 对 help scope 做 capability-aware 裁剪
4. 保留 reserved-only / settlement / official write boundary

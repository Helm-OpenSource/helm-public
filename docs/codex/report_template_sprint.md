---
status: active
owner: helm-core
created: 2026-03-27
review_after: 2026-06-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Sprint 报告模板

## 标题

`<主题> Sprint <编号> Report`

## 1. 当前状态与本轮目标

- 当前已经有什么稳定基线
- 本轮为什么是当前最值得推进的新主线
- 本轮只处理哪几件事

## 2. 本轮实现

### 2.1 已完成能力

- `写本轮新成立的能力`

### 2.2 代表性页面 / 链路 / 对象

- `写本轮落地的 3 个代表实现`

### 2.3 文档 / 守卫 / 测试同步

- `写索引、自检、边界检查、回归更新`

## 3. 刻意未做

- `写为什么本轮没有扩成平台`

## 4. 验证结果

```bash
npm run db:reset
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```

逐条写结果。

## 5. 总结回答

1. 本轮目标是否已经清楚
2. 代表性实现是否已经成立
3. recommendation / commitment 两条 A-minus 主线是否仍保持稳定
4. 哪些地方刻意未做，为什么
5. 下一阶段最该做的 5 件事是什么

## 6. 短表

| 分类项 | 四类归属 | 说明 |
| --- | --- | --- |
| `写条目` | 已经完整成立 / 已成形但仍需下一层 / 刻意未做 / 风险项 | `写说明` |

---
status: active
owner: helm-core
created: 2026-03-27
review_after: 2026-06-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# 统一完成定义

后续所有 Helm Codex 任务默认以以下标准判定完成。

## 1. 完成不是“代码写了”

只有同时满足以下四项，才可以判为“已经完整成立”：

1. 代码已落地
2. 页面或行为已成立
3. 测试 / 守卫已覆盖
4. 文档 / 报告已同步

缺任意一项，一律降级为：

- `已成形但仍需下一层`

## 2. 默认执行顺序

每轮默认按：

1. `plan`
2. `implementation`
3. `validation`
4. `report`

没有验证结果，不算完成。

## 3. 必跑验证命令

`npm run check:boundaries` 是提交级硬门禁，不是结项时才补跑的建议项：

- 本地 `.husky/pre-commit` 会在 `lint-staged` 后执行
- 本地 `.husky/pre-push` 会在推送前再次执行
- shared layer、extension seam、tenant wording、权限 / 承诺边界相关改动，必须先让这条命令为绿，再允许提交

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

若因环境限制无法执行，必须在最终报告中写明：

- 哪条命令未跑
- 为什么未跑
- 风险是什么

## 4. 默认同步清单

后续任务如有行为变化，默认同步：

- [README.md](../../README.md)
- [docs/README.md](../README.md)
- 相关产品 / 治理文档
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- 对应回归测试

## 5. 默认降级规则

出现以下任一情况，不得写成“已完成”：

1. 文档说一套，代码做一套
2. 页面、守卫、测试、自检各说各话
3. 语义边界无法追溯
4. 当前能力被误写成完整平台
5. founder 主链或 handoff 主链被破坏

## 6. 默认报告结构

总报告默认必须包含：

1. 当前版本哪些能力已经完整成立
2. 哪些能力已成形但仍需下一层
3. 哪些地方刻意未做，为什么
4. 哪些边界必须继续诚实保留
5. recommendation / commitment 两条 A-minus 主线是否仍保持稳定
6. 下一阶段最该做的 5 件事是什么

## 7. 默认短表分类

后续所有 freeze / sprint / baseline 总报告默认必须用：

- 已经完整成立
- 已成形但仍需下一层
- 刻意未做
- 风险项

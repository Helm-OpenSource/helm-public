---
status: active
owner: helm-core
created: 2026-03-27
review_after: 2026-06-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Codex 批任务母模板

> 用法：后续所有“可直接发给 Codex”的正式执行任务，优先从本模板复制，再按具体主题替换内容。

## 0. 当前状态

当前状态已经明确：

1. `写当前稳定基线`
2. `写上一轮 freeze / sprint 已通过的结论`
3. `写当前最值得推进的新主线`
4. `写本轮目标为什么是现在最优先`

## 0.1 当前阶段必须显式引用的产品原则文档

后续所有新 PR 的 `plan` 文档，默认必须显式引用：

1. `docs/product/HELM_PRODUCT_PRINCIPLES_V1.md`
2. `docs/product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md`

并明确回答：

1. 本轮任务接到哪条真实业务闭环
2. 它服务的是决策、执行、审计还是复盘
3. 它为什么属于当前阶段应该现在做的优先级，而不是功能扩面或平台化

## 1. 本轮总目标

本轮只围绕以下事项：

1. `任务 A`
2. `任务 B`
3. `任务 C`
4. `文档 / 守卫 / 测试 / 自检对齐`

## 2. 本轮绝对不要做的事

1. 不新增无关产品功能
2. 不新增无关业务场景
3. 不改底层 canonical 主对象体系
4. 不顺手做平台工程
5. 不把当前能力夸大成完整平台

## 3. 默认继承的长期硬规则

1. 任务结论必须继续挂在现有主干之上
2. 任何结论都要回答：
   - 当前已经完整成立到什么程度
   - 哪些是当前可冻结 / 可复用的主字段、主关系、主表达
   - 哪些已成形但仍需下一层
   - 哪些是刻意未做
   - 哪些是诚实保留边界
3. 只要代码、页面、测试、文档四者没有同时成立，一律降级为：
   - `已成形但仍需下一层`

## 4. 任务拆分

### 任务 1：`写任务名`

当前情况：

`写当前问题`

本轮目标：

`写要达成的状态`

本轮要求：

1. `要求 1`
2. `要求 2`
3. `要求 3`

本轮交付物：

- `写交付文件`

本轮通过标准：

- `写通过标准`

> 重复该结构直到任务结束。

## 5. 本轮必须继续保留并诚实写明的边界

1. `app/` 仍是当前唯一或主要 route owner
2. `data/queries.ts` 仍是查询聚合入口，只是已经更薄
3. plugin runtime 仍没有真正 sandbox
4. 仍存在少量 legacy shim
5. future-real auth 仍不是完整生产级认证，只是更稳的受控试点认证链
6. OpenShell / OpenClaw / NemoClaw 仍是最小外部桥接目标
7. 当前系统仍不是完整企业级多组织 / 多权限 / 多租户平台

## 6. 必跑验证

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

## 7. 最终交付物

1. 代码改动
2. 测试更新
3. README 和相关文档更新
4. `写本轮各报告`
5. `写总报告`

如果本轮完成后还需要补“当前主干执行回执”，优先使用：

- `docs/codex/execution_receipt_template.md`

## 8. 总报告必须回答的问题

1. 当前版本哪些能力已经完整成立
2. 哪些能力已成形但仍需下一层
3. 哪些地方刻意未做，为什么
4. 哪些边界必须继续诚实保留
5. 当前本轮目标是否已经清楚
6. recommendation / commitment 两条 A-minus 主线是否仍保持稳定
7. 下一阶段最该做的 5 件事是什么

## 9. 总报告必须额外增加短表

短表至少包含以下四列分类：

- 已经完整成立
- 已成形但仍需下一层
- 刻意未做
- 风险项

要求：

1. 每项都必须落在上述四类之一
2. 不允许模糊写“整体更好了”
3. 必须明确指出哪些是当前故意未做，哪些是仍需下一层，哪些是真正风险项

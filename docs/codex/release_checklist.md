---
status: active
owner: helm-core
created: 2026-03-27
review_after: 2026-06-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# 发布 / 收口检查清单

> 适用于所有 Helm sprint、freeze、baseline、readiness 任务的收尾阶段。

## 1. 开工前

- [ ] 已读 [AGENTS.md](../../AGENTS.md)
- [ ] 已读 [README.md](../../README.md)
- [ ] 已读 [docs/README.md](../README.md)
- [ ] 已确认本轮目标、不做事项、长期边界
- [ ] 已确认 recommendation / commitment 仍只做守，不做主攻

## 2. 实现中

- [ ] 代码改动没有越权扩张范围
- [ ] 没有顺手改 canonical 主对象体系
- [ ] 没有把 controlled-trial 能力夸大成完整平台
- [ ] 用户能更快理解“现在该做什么”
- [ ] founder 主链与 handoff 主链未被破坏
- [ ] `npm run check:boundaries` 在功能提交前已通过，且未用 `--no-verify` 绕过本地 hook

## 3. 文档同步

- [ ] README 已同步
- [ ] docs 索引已同步
- [ ] 相关产品 / 治理文档已同步
- [ ] 报告入口已同步
- [ ] 当前边界已诚实保留

## 4. 守卫与回归

- [ ] self-check 已同步
- [ ] boundary check 已同步
- [ ] `.husky/pre-commit` / `.husky/pre-push` 仍保留 `npm run check:boundaries` 硬门禁
- [ ] 最小回归测试已同步
- [ ] `quality:regression` 已纳入本轮关键守线

## 5. 必跑验证

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

## 6. 结项前最后确认

- [ ] 总报告问题已全部回答
- [ ] 四分类短表已补齐
- [ ] “刻意未做”与“风险项”没有被弱化
- [ ] 未回退用户已有的无关改动

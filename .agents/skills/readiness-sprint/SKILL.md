# readiness-sprint

## 适用场景

用于各种 `Sprint 1 / Sprint 2 / Sprint 3` 这类 readiness 推进任务。

典型输入：

- 某条新主线值得推进
- 需要先把能力从“可解释”推进到“可复用 / 可交付 / 可培训”

## 默认工作流

1. 写清当前状态与本轮目标
2. 写清不要做的事，控制范围
3. 选 3 个以内代表性对象 / 页面 / 链路落地
4. 把代码、页面、测试、文档同步拉齐
5. 生成 sprint 报告与总报告
6. 跑完整验证链

## 禁止事项

- 不顺手开平台层
- 不把 readiness 直接写成 baseline freeze
- 不在没有验证的情况下宣称通过

## 交付物

- 代表性实现
- README / docs / 守卫 / 测试更新
- sprint 报告
- 总报告

## 验证清单

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

## 常见风险

- 只加文案，没有形成系统层落地
- 没有代表性页面 / 链路，导致报告停留在概念层
- 文档未同步，后续无法复用

## 公开仓参考

- [Agent Working Entry](../../../docs/codex/README.md)
- [AGENTS.md](../../../AGENTS.md)
- [docs/STATUS.md](../../../docs/STATUS.md)
- [HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md](../../../docs/product/HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md)

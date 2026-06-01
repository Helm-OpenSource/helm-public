# baseline-freeze

## 适用场景

用于各种 `Baseline Freeze / Readiness Freeze / Baseline Alignment` 类型任务。

典型输入：

- 某条能力线已经完成 Sprint 1 / Sprint 2
- 当前最值得做的是全项目 review、修复松动点、文档守线与 freeze 收口

## 默认工作流

1. 回顾当前稳定基线与上一轮 sprint 结论
2. 做一致性 review：
   - 代码
   - 页面
   - 文档
   - 自检
   - 测试
3. 明确：
   - 当前已经完整成立到什么程度
   - 哪些已成形但仍需下一层
   - 哪些刻意未做
   - 哪些边界必须诚实保留
4. 更新 README / docs 索引 / self-check / boundary / regression
5. 生成 freeze 报告与总报告
6. 跑完整验证链

## 禁止事项

- 不顺手扩新场景
- 不借 freeze 之名做架构迁移
- 不把当前能力夸大成完整平台
- 不破坏 founder 主链或 handoff 主链

## 交付物

- 代码与文档改动
- freeze 报告
- alignment 报告
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

- 文档说已 freeze，代码其实只是 readiness
- 页面、守卫、测试、自检各说各话
- 把“已成形但仍需下一层”误写成“已经完整成立”

## 公开仓参考

- [Agent Working Entry](../../../docs/codex/README.md)
- [AGENTS.md](../../../AGENTS.md)
- [docs/STATUS.md](../../../docs/STATUS.md)

# decision-first-page-refactor

## 适用场景

用于：

- reporting protocol
- decision-first IA
- judgement-first 页面重构
- AI 主动汇报 / 协作页面改造

## 默认工作流

1. 找出当前页面的对象堆叠 / 筛选驱动问题
2. 把页面重心改成：
   - judgement
   - action
   - boundary
   - evidence
   - decision request
3. 把证据、audit、replay、memory 下钻降级到受控抽屉
4. 把 CTA 前置，确保“现在该做什么”清楚
5. 用 1-3 个代表页面先落地
6. 更新 README / docs / self-check / regression

## 禁止事项

- 不只是把卡片顺序调一调
- 不把页面重新退回对象列表 + 用户自行筛选
- 不泄漏 internal-only cue 到 customer-facing 语境

## 交付物

- 页面重构代码
- 协议或 IA 文档
- 代表页面说明 / 报告
- 守线测试

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

- 看起来更“新”，但仍然是对象堆叠
- 缺少 current judgement
- 没有 action outlet 或 decision request
- evidence 没有受控下钻路径

## 公开仓参考

- [Agent Working Entry](../../../docs/codex/README.md)
- [AGENTS.md](../../../AGENTS.md)
- [HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md](../../../docs/product/HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md)

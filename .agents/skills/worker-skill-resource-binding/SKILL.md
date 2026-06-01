# worker-skill-resource-binding

## 适用场景

用于：

- worker layer
- skill layer
- resource binding layer
- worker / skill / resource / execution relation

## 默认工作流

1. 先收清 canonical 对象：
   - worker 定义角色
   - skill 定义能力
   - resource 定义执行供给
   - control plane 定义治理
2. 明确对象字段、责任边界、升级路径、可见范围
3. 先做最小代表性链路，不做大规模 orchestration
4. 明确 recommendation / commitment / customer-facing 边界
5. 把 replay / audit / memory 承接写清楚
6. 更新 README / docs / self-check / regression

## 禁止事项

- 不把 Helm 控制层下沉到 resource / runtime 层
- 不把 resource binding 写成完整 marketplace
- 不把 worker / skill / resource 直接扩成完整自动执行平面

## 交付物

- canonical 对象或关系实现
- 代表性 binding / flow
- 相关报告
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

- worker / skill / resource 分层混乱
- governance 边界丢失
- customer-facing 输出越过 review / boundary
- 被误写成完整 orchestration / execution 平台

## 公开仓参考

- [Agent Working Entry](../../../docs/codex/README.md)
- [AGENTS.md](../../../AGENTS.md)
- [HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md](../../../docs/product/HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md)
- [HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md](../../../docs/product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md)

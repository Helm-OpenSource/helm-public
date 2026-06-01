# memory-recommendation-and-briefing

## 适用场景

用于：

- `lib/memory/`、`lib/recommendations/`、`lib/llm-workflows/`
- `app/api/memory/`、`app/api/recommendations/`、`app/api/llm/`
- `features/memory/`、`features/recommendations/`
- memory / facts / blockers / commitments / briefing / recommendation / today focus / explanation / feedback / eval 相关改动

## 默认 skill 叠加

先套：

- `helm-repo-default-workflow`
- `api-and-interface-design`
- `security-and-hardening`
- `debugging-and-error-recovery`

按触发追加：

- recommendation / memory surface 改动：`frontend-ui-engineering`
- 规则或 contract 收缩：`deprecation-and-migration`
- memory / recommendation readiness 推进：`readiness-sprint`
- memory / recommendation baseline 对齐：`baseline-freeze`

## 默认工作流

1. 先确认本轮改动属于哪一层：
   - memory extraction / correction / promotion
   - retrieval / loading policy
   - briefing generation
   - recommendation ranking / candidates / explanation / feedback
2. 明确哪些判断仍由规则层控制：
   - ranking
   - policy fit
   - approval routing
   - official / shadow / manual-only boundary
3. 如果使用 LLM：
   - 只增强 extraction / briefing / explanation，除非本轮明确改 contract
   - 保留 fallback 与可回退路径
4. 同步检查 evidence bridge：
   - facts / blockers / commitments / recent context
   - audit / event log
   - object-scoped retrieval
   - feedback write-back
5. README / docs / eval / observability 一起收口

## 禁止事项

- 不另起第二套 recommendation 栈
- 不把 LLM 提升成 ranking 或 policy owner
- 不把 trusted / untrusted / draft-only 边界压扁
- 不只改前台 explanation，不同步 evidence、feedback 和 eval

## 交付物

- 代码与文档改动
- 代表性 memory / recommendation / briefing 链路
- 必要的 eval / fallback / evidence 说明
- 明确验证结果

## 验证清单

默认完整验证链：

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

领域额外核验：

```bash
npm run eval:memory
npm run eval:recommendation
```

并确认：

- memory timeline / export / correction / confirm path 仍一致
- recommendation explanation、feedback、today focus 仍与 evidence bridge 对齐
- LLM 缺失时是否仍按规则链稳定回退

## 常见风险

- recommendation 排序与策略边界被 LLM 偷走
- memory 与 recommendation 的证据桥断开
- explanation 前台化了，但 feedback / audit / eval 没同步
- 新增写路径导致本地试点环境出现不必要写放大

## 公开仓参考

- [Agent Working Entry](../../../docs/codex/README.md)
- [AGENTS.md](../../../AGENTS.md)
- [HELM_HEADLESS_SIGNAL_INTERFACE_REQUIREMENTS.md](../../../docs/product/HELM_HEADLESS_SIGNAL_INTERFACE_REQUIREMENTS.md)
- [HELM_OPERATING_SIGNAL_FLOW_MAP_REQUIREMENTS.md](../../../docs/product/HELM_OPERATING_SIGNAL_FLOW_MAP_REQUIREMENTS.md)

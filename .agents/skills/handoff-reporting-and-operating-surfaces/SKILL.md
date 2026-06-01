# handoff-reporting-and-operating-surfaces

## 适用场景

用于：

- `app/(workspace)/reports`、`app/(workspace)/dashboard`、`app/(workspace)/operating`、`app/(workspace)/customer-success`
- `features/reports/`、`features/customer-success-handoff/`、`features/internal-operating-workspace/`
- `lib/presentation/`、`lib/reports/`
- reporting / dashboard / operating workspace / role handoff / customer success handoff / cross-detail navigation / decision-first surface 相关改动

## 默认 skill 叠加

先套：

- `helm-repo-default-workflow`
- `frontend-ui-engineering`
- `decision-first-page-refactor`

按触发追加：

- detail model、actions、queries、surface contract：`api-and-interface-design`
- customer-facing wording、boundary、handoff 承诺边界：`security-and-hardening`
- readiness 推进：`readiness-sprint`
- reporting / handoff freeze：`baseline-freeze`

## 默认工作流

1. 先写清这个 surface 的五件事：
   - current judgement
   - action outlet
   - boundary
   - evidence
   - handoff target
2. 页面默认按 decision-first 落：
   - judgement / action / boundary 前置
   - evidence / replay / audit / memory 下沉为受控下钻
3. 如果跨 detail / handoff / dashboard / reports：
   - 保住 route owner
   - 保住 cross-surface chain
   - 不让同一事实在多个页面说法失真
4. 任何 customer-facing 或外部可见 wording：
   - 不写成 commitment
   - 不泄漏 internal-only cue
   - 不把 readiness 写成 platform 已完整成立
5. README / docs / self-check / regression 与代表页面说明一起收口

## 禁止事项

- 不把页面退回对象堆叠 + 用户自筛选
- 不只调布局顺序，不重做 judgement / action / boundary 结构
- 不让 role handoff、reporting、detail navigation 各说各话
- 不把 internal-only 线索泄漏到 customer-facing surface

## 交付物

- 页面 / contract / docs 改动
- 代表性 surface 或链路说明
- 必要的 sprint / freeze / alignment 报告
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

- judgement / action / boundary 是否在首屏成立
- handoff target、evidence drill-down、trace 解释是否仍可达
- reporting / dashboard / operating workspace 之间是否仍保持同一条产品真相
- customer-facing wording 是否仍诚实保留 prerequisite / dependency / non-commitment

## 常见风险

- 页面看起来更“新”，但仍然是对象列表
- handoff surface 有内容，但没有明确下一步动作
- evidence / memory / audit 被前置成噪声，压掉 judgement
- 页面文案越过边界，把建议或 readiness 写成承诺

## 公开仓参考

- [Agent Working Entry](../../../docs/codex/README.md)
- [AGENTS.md](../../../AGENTS.md)
- [HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md](../../../docs/product/HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md)
- [HELM_HEADLESS_SIGNAL_INTERFACE_REQUIREMENTS.md](../../../docs/product/HELM_HEADLESS_SIGNAL_INTERFACE_REQUIREMENTS.md)
- [HELM_OPERATING_SIGNAL_FLOW_MAP_REQUIREMENTS.md](../../../docs/product/HELM_OPERATING_SIGNAL_FLOW_MAP_REQUIREMENTS.md)

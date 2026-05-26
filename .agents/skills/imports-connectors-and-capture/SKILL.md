# imports-connectors-and-capture

## 适用场景

用于：

- `lib/imports/`、`lib/connectors/`、`lib/conversation-capture/`
- `app/api/imports/`、`app/api/connectors/`、`app/api/conversation-capture/`
- `features/imports/`、`features/connectors/`、`features/conversation-capture/`
- imports / CRM sync / OAuth callback / capture / ASR / ingest / warmup / conflict resolution 相关改动

## 默认 skill 叠加

先套：

- `helm-repo-default-workflow`
- `api-and-interface-design`
- `security-and-hardening`
- `debugging-and-error-recovery`

按触发追加：

- imports / capture surface 改动：`frontend-ui-engineering`
- retry wrapper、scripts、验证链或 CI 入口：`ci-cd-and-automation`
- connector ingestion readiness 推进：`readiness-sprint`
- connector / import boundary freeze：`baseline-freeze`

## 默认工作流

1. 先确认本轮改动属于哪条入口：
   - CRM import
   - OAuth connector
   - conversation capture
   - meeting notes / runtime ingest
2. 明确 trust / promotion / fallback posture：
   - trusted / untrusted / draft-only
   - 自动 ingest / 人工确认 / 本地示例 fallback
3. 先做一条最小代表性 ingest path：
   - source contract
   - mapping / warmup
   - conflict handling
   - observability / retry
4. 如果接第三方或 provider：
   - 保留 env 缺失时的退化路径
   - 不让真实 connector 成为唯一演示入口
5. README / docs / self-check / eval / fallback 说明一起收口

## 禁止事项

- 不把窄 connector 或 import 扩成完整 connector platform
- 不默认把所有原始数据直接塞进模型或上下文
- 不绕过 trust / promotion / conflict handling 直接入主链
- 不让 capture / ASR 缺失时主流程直接失效

## 交付物

- 代码与文档改动
- 代表性 ingest / import / capture 链路
- fallback / env / observability 说明
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

- OAuth / provider env 缺失时是否仍保留 demo / fallback path
- import preview / run / warmup / conflict resolution 是否链路一致
- capture / transcript / ingest 是否仍保留 manual fallback
- token / callback / ingestion logs 是否仍满足最小可观测性

## 常见风险

- 把 connector readiness 写成 connector platform 已成立
- 让 imports / capture 绕开 trust、promotion 和 conflict boundary
- 真实 provider 缺失时 demo 直接断路
- 只改 API，不同步 fallback、文档和 observability

## 模板引用

- [README.md](../../../docs/codex/README.md)
- [batch_task_master_template.md](../../../docs/codex/batch_task_master_template.md)
- [definition_of_done.md](../../../docs/codex/definition_of_done.md)
- [release_checklist.md](../../../docs/codex/release_checklist.md)
- [design.md](../../../docs/conversation-capture/design.md)
- [implementation.md](../../../docs/conversation-capture/implementation.md)
- [seed-scenarios.md](../../../docs/conversation-capture/seed-scenarios.md)
- [MEETING_CONNECTOR_READINESS_GATE_V1.md](../../../docs/product/MEETING_CONNECTOR_READINESS_GATE_V1.md)
- [MEETING_CONNECTOR_READINESS_REPORT_V1.md](../../../docs/reviews/MEETING_CONNECTOR_READINESS_REPORT_V1.md)

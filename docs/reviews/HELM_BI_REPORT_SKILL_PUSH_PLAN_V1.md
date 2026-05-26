---
status: archived
owner: helm-core
created: 2026-04-13
review_after: 2026-10-10
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm BI Report Skill Push Plan V1

更新时间：2026-04-13  
状态：Proposed

## 1. 目标

这条线只做一件事：

- 在 Helm 内新增一条很窄的 `BI report -> deterministic metric evaluation -> LLM explanation -> DingTalk push` 主动汇报能力

它要支持：

- 多个 BI 报表
- 多套定制 `report skill`
- 每个 skill 独立定义 `query.sql / schema / metrics / result criteria / prompt / message template`
- 每个 workspace 独立配置订阅、时间、参数和推送对象
- 推送到钉钉群，后续再扩到钉钉个人

它不是：

- 完整 BI 平台
- 任意 workflow / orchestration engine
- 任意 SQL 自助平台
- Broad notification center
- 现有 DingTalk read-only connector 的 send/write-back 扩张
- 自动决策、自动执行或自动改写外部系统

## 2. 产品原则与优先级映射

显式引用：

- `docs/product/HELM_PRODUCT_PRINCIPLES_V1.md`
- `docs/product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md`

本轮任务接到的真实业务闭环：

- `ODPS report -> operating signal compression -> proactive management brief -> DingTalk delivery -> human review / follow-through`

它服务的是：

- 决策
- 复盘
- 主动汇报

为什么应该现在做，而不是继续扩功能面：

- 当前 Helm 已经有 `reports`、`proactive reporting`、`LLM workflow`、`audit/event/LLM observability` 这些窄能力，但还没有一条可控的外发报表分析推送线
- 真实业务里重复出现“每天查 ODPS 报表、人工口头解释、再发到钉钉”的低效链路，值得先收成一条窄 runtime
- 如果先把 skill contract、subscription contract 和 run/delivery contract 固定下来，后续再扩报表和收件对象会比直接堆脚本更稳

## 3. 当前 repo reality 与硬边界

当前 repo 已成立的可复用基础：

- `/reports` 已有 deterministic report aggregation 与 audit / event write-back
- `lib/llm/provider-registry.ts` 已有 workspace-aware model routing、fallback 和 LLM call log
- `lib/llm-workflows/*` 已有 prompt + schema + workflow 组织方式
- `scripts/sync-openclaw-memory.ts` 已经给出一条 script-driven scheduled entry 参考

当前必须继续保留的硬边界：

1. 这条线是 `proactive reporting seam`，不是 Helm 已经成了完整 BI 平台。
2. 这条线是独立 outbound delivery seam，不把现有 DingTalk read-only connector 写成 send/write-back 已成立。
3. `LLM` 只负责解释，不负责定级；等级与静默阈值必须由 deterministic criteria 决定。
4. 不把原始大表明细直接喂给模型；只传聚合指标、top findings 和规则命中结果。
5. 不允许把 arbitrary SQL 编辑和即时生效直接暴露到 end-user UI。
6. 不做 auto-remediation、auto-send follow-up、auto-write external system。

## 4. 设计结论

推荐把这条能力拆成三层：

1. `report skill` 资产层
2. `subscription / run / delivery` runtime 层
3. `scheduler / query / analysis / delivery` execution 层

### 4.1 Skill 资产层

每个 BI 报表能力不是一段自由 prompt，而是一套版本化 skill 包：

```text
report-skills/
  README.md
  examples/
    bi_revenue_daily/
      skill.json
      query.sql
      schema.json
      metrics.json
      result-criteria.json
      prompt.md
      message-template.md
      subscription.example.json
```

每个 skill 包必须固定 7 类信息：

1. 查询 SQL
2. 查询结果 schema
3. 指标计算定义
4. 结果标准
5. LLM 解释提示
6. 消息模板
7. 默认 schedule / timezone / delivery channel 等 manifest 元信息

### 4.2 Runtime 层

数据库只存运行配置和运行结果，不存大段 SQL/prompt 正文。

Phase 1 保持：

- skill definitions 存在 repo 文件系统
- DB 只保存 `skillKey + skillVersion` 引用

原因：

- repo file 更适合 review、diff、版本回溯和分支开发
- 可以避免把 SQL/schema/prompt/template 同时复制到 DB，减少 drift
- 当前阶段没有必要先做 skill marketplace 或 UI skill editor

### 4.3 Execution 层

窄执行链固定为：

```text
scheduled script
  -> load enabled subscriptions
  -> resolve skill pack from repo
  -> render SQL parameters
  -> query ODPS through a narrow adapter
  -> validate tabular payload against schema
  -> compute metrics
  -> evaluate result criteria
  -> build deterministic summary
  -> call LLM for explanation
  -> render DingTalk message
  -> deliver
  -> write run / delivery / audit / event / llm logs
```

## 5. 模块建议

建议新能力的目录边界如下：

```text
report-skills/
  README.md
  examples/*

lib/bi-report-skill/
  skill-loader.ts
  schema-validator.ts
  metric-engine.ts
  result-evaluator.ts
  message-renderer.ts
  run-service.ts
  delivery/
    dingtalk-group-webhook.ts
    dingtalk-app-message.ts
  query-adapters/
    odps-python-bridge.ts

lib/llm-workflows/
  analyze-bi-report.workflow.ts

scripts/
  run-bi-report-push.ts
```

模块职责：

- `skill-loader.ts`
  - 从 `report-skills/` 读取 manifest、SQL、schema、metrics、criteria、prompt、template
- `schema-validator.ts`
  - 校验 ODPS 返回的表结构与 `schema.json` 一致
- `metric-engine.ts`
  - 用 deterministic 规则计算 summary metrics、rankings、top findings
- `result-evaluator.ts`
  - 只基于 metrics 和 criteria 得出 `CLEAR / WATCH / WARN / ALERT / CRITICAL`
- `analyze-bi-report.workflow.ts`
  - 只解释 deterministic output，不重新判级
- `message-renderer.ts`
  - 用 `message-template.md` + runtime payload 生成 DingTalk 文本 / markdown
- `dingtalk-group-webhook.ts`
  - 窄群推送 adapter
- `dingtalk-app-message.ts`
  - 后续个人或单聊推送 adapter
- `run-bi-report-push.ts`
  - 定时入口，可单 workspace、单 subscription 或全量跑

## 6. Prisma 草案

### 6.1 Phase 1 不做的事

Phase 1 不建议新增 `BiReportSkillRegistry` 表。

原因：

- 当前 skill 包天然是 repo asset
- 当前需求是“定制推送 skill + 定时运行”，不是“在线编辑 skill”
- 先把 subscription / run / delivery 跑稳，比先做 registry schema 更符合当前阶段优先级

如果后续需要 UI 化管理 custom skill，再考虑补一张 registry 表。

### 6.2 枚举草案

```prisma
enum BiReportRunStatus {
  PENDING
  RUNNING
  COMPLETED
  COMPLETED_WITH_WARNINGS
  FAILED
  SKIPPED
}

enum BiReportSeverity {
  CLEAR
  WATCH
  WARN
  ALERT
  CRITICAL
}

enum BiReportDeliveryChannel {
  DINGTALK_GROUP_WEBHOOK
  DINGTALK_APP_MESSAGE
}

enum BiReportDeliveryStatus {
  PENDING
  SENT
  FAILED
  SKIPPED
}
```

### 6.3 Subscription 草案

```prisma
model BiReportSubscription {
  id                    String   @id @default(cuid())
  workspaceId           String
  createdByUserId       String?
  name                  String
  skillKey              String
  skillVersion          String
  enabled               Boolean  @default(true)
  scheduleCron          String
  timezone              String   @default("Asia/Shanghai")
  sqlParamsJson         String?
  analysisOverridesJson String?
  deliveryTargetsJson   String
  silencePolicyJson     String?
  dedupeWindowMinutes   Int      @default(90)
  lastPlannedAt         DateTime?
  lastSucceededAt       DateTime?
  lastFailedAt          DateTime?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([workspaceId, enabled, updatedAt])
  @@index([workspaceId, skillKey, enabled])
}
```

字段说明：

- `skillKey + skillVersion`
  - 指向 repo 中的 skill pack，而不是指向 DB blob
- `sqlParamsJson`
  - 保存 `workspace_code / biz_date / prev_date` 一类参数
- `deliveryTargetsJson`
  - 保存多个目标，例如群 webhook、用户 `unionId`
- `silencePolicyJson`
  - 保存 `warn_and_above / alert_and_above / always_send / never_send_clear`

### 6.4 Run 草案

```prisma
model BiReportRun {
  id                       String            @id @default(cuid())
  subscriptionId           String
  workspaceId              String
  scheduledFor             DateTime
  dedupeKey                String            @unique
  status                   BiReportRunStatus @default(PENDING)
  severity                 BiReportSeverity?
  rowCount                 Int               @default(0)
  querySummaryJson         String?
  metricsJson              String?
  criteriaResultJson       String?
  deterministicSummaryJson String?
  analysisJson             String?
  llmMetaJson              String?
  errorSummary             String?
  startedAt                DateTime          @default(now())
  finishedAt               DateTime?
  createdAt                DateTime          @default(now())
  updatedAt                DateTime          @updatedAt

  @@index([workspaceId, scheduledFor])
  @@index([subscriptionId, scheduledFor])
  @@index([workspaceId, status, startedAt])
}
```

关键点：

- `dedupeKey = subscriptionId + scheduledFor window`
- `deterministicSummaryJson` 保存 rule-based 结论
- `analysisJson` 保存模型增强后的解释
- `llmMetaJson` 只保存本次 run 的模型摘要，不替代现有 `LLMCallLog`

### 6.5 Delivery 草案

```prisma
model BiReportDelivery {
  id                String                 @id @default(cuid())
  runId             String
  workspaceId       String
  channel           BiReportDeliveryChannel
  targetType        String
  targetKey         String
  status            BiReportDeliveryStatus @default(PENDING)
  providerMessageId String?
  requestBody       String?
  responseBody      String?
  sentAt            DateTime?
  createdAt         DateTime               @default(now())
  updatedAt         DateTime               @updatedAt

  @@index([runId, status])
  @@index([workspaceId, channel, createdAt])
}
```

### 6.6 复用现有表，不新增重复能力

继续复用：

- `AuditLog`
- `EventLog`
- `LLMCallLog`

不复用：

- `Notification`
  - 它是站内通知，不适合作为外发消息投递记录
- `ImportSource / ImportJob`
  - 它们是 ingest / import runtime，不适合承载主动报表分析推送

## 7. Skill contract 细化

一个 skill 必须先过 4 道 deterministic gate，才能进入 delivery：

1. SQL 参数渲染成功
2. 查询结果通过 schema 校验
3. metrics 计算成功
4. result criteria 计算成功

只有这四步都通过，才允许进入：

5. LLM explanation
6. message render
7. delivery

这样可以保持：

- 规则先于模型
- 结果标准可追溯
- delivery 可复盘

## 8. ODPS 查询策略

推荐把 ODPS 查询做成一个窄 adapter，而不是直接在 Next.js route 里拼接 SQL。

推荐形态：

- `scripts/run-bi-report-push.ts`
  - 负责 orchestrate
- `lib/bi-report-skill/query-adapters/odps-python-bridge.ts`
  - 负责调用一个受控的 Python bridge
- `scripts/bi-report-skill/query-odps.py`
  - 负责用官方 SDK / 受控查询方式执行 SQL，并把结果输出为 JSON

理由：

- 当前 repo 主体是 Node / TS，不适合把 MaxCompute 专有 client 细节散落进 route 或 service
- Python bridge 更适合承接 ODPS 官方 SDK 能力和环境依赖
- 这样也更容易把查询环境、credential 和 runtime timeout 单独隔离

## 9. 钉钉推送策略

推送层分两级：

### Phase 1

- `DINGTALK_GROUP_WEBHOOK`

适合：

- 内部群
- 快速落地
- 受控试点

### Phase 2

- `DINGTALK_APP_MESSAGE`

适合：

- 发给某个人
- 发到单聊或受控应用场景

边界要求：

- 这是一条独立 outbound seam，不把现有 DingTalk read-only connector 写成 send/write-back 已成立
- 群和个人推送都必须留下 `BiReportDelivery`
- delivery 失败必须可重试，但同一窗口不能重复生成新 run

## 10. `bi_revenue_daily` 示例

本轮附带一份完整示例 skill：

- `report-skills/examples/bi_revenue_daily/skill.json`
- `report-skills/examples/bi_revenue_daily/query.sql`
- `report-skills/examples/bi_revenue_daily/schema.json`
- `report-skills/examples/bi_revenue_daily/metrics.json`
- `report-skills/examples/bi_revenue_daily/result-criteria.json`
- `report-skills/examples/bi_revenue_daily/prompt.md`
- `report-skills/examples/bi_revenue_daily/message-template.md`
- `report-skills/examples/bi_revenue_daily/subscription.example.json`

这份示例只用于固定 contract，不代表当前 main 已经可以真实跑通 ODPS 和 DingTalk delivery。

## 11. Rollout

### Phase 1

- file-based skill pack
- group webhook push
- one script scheduler entry
- one `bi_revenue_daily` example
- subscription / run / delivery 落库

### Phase 2

- DingTalk app message
- 个人推送
- 手动重跑
- 失败重试
- `/reports` 查看运行历史

### Phase 3

- 更多 skill 包
- skill 参数模板
- workspace-scoped overrides
- dry-run / preview

### Phase 4

- UI 化 subscription management
- optional custom skill registry
- more delivery channels

## 12. 风险

1. ODPS 查询环境依赖可能和当前 Node runtime 不一致，必须通过 bridge 隔离。
2. 报表 SQL、schema、criteria 三者一旦 drift，会直接导致错误推送。
3. 如果让模型直接判级，会削弱可审计性，因此必须保持 deterministic severity。
4. 如果把 outbound push 混进现有 DingTalk connector，会和当前 repo 的 read-only boundary 冲突。

## 13. 本轮明确不做

- 不直接新增 UI route / page / action runtime
- 不做 DingTalk 个人推送真实实现
- 不做 UI 管理台
- 不做 arbitrary SQL editor
- 不做 broad BI platform claim

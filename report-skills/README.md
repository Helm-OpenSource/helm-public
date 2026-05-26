# Report Skills

## 1. 目的

`report-skills/` 用来存放 Helm 的窄 `BI report proactive push` skill 包。

这里的 `skill` 不是 Codex skill，也不是 Helm 已经成立的 marketplace/runtime abstraction。
它只是：

- 一套版本化报表分析资产
- 一组受控的 SQL / schema / metric / criteria / prompt / message template 文件
- 供 `scheduled report push` runtime 读取的 repo asset

## 2. 目录结构

每个 skill 包必须是一个独立目录：

```text
report-skills/
  README.md
  examples/
    <skill-key>/
      skill.json
      query.sql
      schema.json
      metrics.json
      result-criteria.json
      prompt.md
      message-template.md
      subscription.example.json
      sample-input.json
```

## 3. 文件要求

### `skill.json`

作用：

- skill 元信息
- 默认 schedule / timezone
- source type
- 支持的 delivery channels
- 参数定义
- 边界说明

最少字段：

- `skillKey`
- `name`
- `version`
- `sourceType`
- `analysisMode`
- `defaultSchedule`
- `timezone`
- `supportedDeliveryChannels`
- `parameters`
- `boundaries`

### `query.sql`

作用：

- 定义该 skill 的查询 SQL

约束：

- 只允许参数化 SQL，不允许 hard-code tenant-specific 值
- 默认使用 `{{param_name}}` 占位
- 不允许把多条不相关查询塞进一个 skill
- 返回表结构必须和 `schema.json` 对齐

### `schema.json`

作用：

- 定义查询结果的表结构 contract

最少字段：

- `version`
- `type`
- `primaryKey`
- `columns`

列字段建议：

- `name`
- `type`
- `required`
- `label`
- `description`

推荐类型：

- `string`
- `date`
- `integer`
- `decimal`
- `boolean`

### `metrics.json`

作用：

- 定义 deterministic metric engine 如何从查询结果计算 summary metrics 和 top findings

建议字段：

- `aggregations`
- `rankings`
- `derivedMetrics`
- `displayOrder`

原则：

- metrics 必须可 deterministic 计算
- 不依赖模型猜测
- 尽量先聚合后解释

### `result-criteria.json`

作用：

- 定义什么叫 `CLEAR / WATCH / WARN / ALERT / CRITICAL`

原则：

- 等级判定只能来自 rules，不来自模型
- rule 顺序必须稳定
- 允许一个 skill 同时命中多条 rule，但需要有清楚的 severity resolution

### `prompt.md`

作用：

- 定义 LLM 如何解释 deterministic output

原则：

- 只解释，不重新判级
- 不允许编造数据来源
- 不允许输出超出当前报表范围的自动决策承诺

### `message-template.md`

作用：

- 定义推送到钉钉的最终消息模板

原则：

- 固定核心段落
- 控制长度
- 必须带边界说明

### `subscription.example.json`

作用：

- 给出一个 workspace-scoped subscription 示例

用途：

- 说明 schedule、params、targets、silencePolicy 的写法
- 不是 runtime source of truth

### `sample-input.json`

作用：

- 给本地 dry-run 脚本一份固定输入

用途：

- 验证 schema / metrics / criteria / message render
- 演示 skill contract 在没有真实 ODPS 的情况下如何联调
- 不是生产数据，也不是 runtime source of truth

## 4. 参数占位规则

默认参数写法：

- `{{workspace_code}}`
- `{{biz_date}}`
- `{{prev_date}}`
- `{{today-1d}}`

约束：

- 一个 skill 只定义自己需要的最小参数集
- 参数解释必须写在 `skill.json`
- 不允许在 SQL 里隐式依赖 repo 外部未声明变量

## 5. 边界

`report-skills/` 当前只服务一条窄能力：

- `ODPS report -> deterministic evaluation -> LLM explanation -> DingTalk push`

它不是：

- full BI platform
- arbitrary analytics DSL platform
- online SQL editor
- outbound orchestration engine
- auto-remediation engine

## 6. 示例

当前附带一个示例：

- `examples/bi_revenue_daily`

它说明：

- 日报 skill 应该如何定义
- 如何写一条带前一日对比的 SQL
- 如何固定 schema / metrics / criteria / prompt / message template

它只是 contract 示例，不代表当前 repo 已经真实接通 ODPS 和 DingTalk push。

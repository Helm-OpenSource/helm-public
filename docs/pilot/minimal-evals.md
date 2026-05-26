---
status: active
owner: helm-core
created: 2026-03-15
review_after: 2026-06-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# 最小评估与质量检查

## 目的

试点前不做复杂评测平台，先保留四条最小可执行检查：

1. `eval:recommendation`
2. `eval:memory`
3. `pilot:check`
4. `pilot:eval`

---

## 1. `npm run eval:recommendation`

用途：

1. 校验 recommendation 黄金样本
2. 检查 recommendation 是否真的带：
   - 标题命中
   - `decisionRole / decisionLabel`
   - `policyResult`
   - blocker / commitment / evidence / learned pattern
3. 输出最小 recommendation 质量摘要

适合：

1. recommendation 迭代后回归
2. 调整排序和 explanation 后回归
3. 试点前确认 recommendation 不只是“有标题”

---

## 2. `npm run eval:memory`

用途：

1. 校验 meeting note 驱动的 memory 黄金样本
2. 检查 fact / commitment / blocker 是否命中
3. 输出最小 extraction quality summary
4. 标出缺失项和可疑错归属项

适合：

1. 记忆提取链改动后回归
2. correction 逻辑调整后回归
3. 试点前确认记忆不只是落库，而是抽得对

---

## 3. `npm run pilot:check`

用途：

1. 检查 Git 根目录边界
2. 检查关键分支是否存在
3. 检查试点文档是否齐全
4. 检查关键 API 路由文件是否存在
5. 检查 `.env.example` 是否包含 README 提到的关键环境变量

适合：

1. 新环境接手前
2. 试点前自检
3. 文档整理后回归

---

## 4. `npm run pilot:eval`

用途：

1. 检查 seed 数据里是否存在关键对象
2. 检查 memory / recommendation / evolution / capture 的最小数据量
3. 检查关键示例对象是否可被查询
4. 检查 recommendation explanation 与 evidence 是否不是空壳

当前最小覆盖：

1. 销售故事线
   - `Acme 年度经营动作控制台试点`
   - `Acme 采购评估同步会`
2. 招聘故事线
   - `GreenPeak VP Sales 职位委托`
   - `Aya Nakamura`
3. 创始人故事线
   - `Atlas AI 联合解决方案合作`
4. memory 数据量
5. recommendation 数据量与 explanation
6. recommendation payload 是否带有 `decisionRole / decisionLabel / tradeoffSummary`
7. evolution open suggestion
8. conversation capture session / transcript / insight
9. conversation transcript 是否已经带 `sourceType`
10. completed capture 是否至少刷新了一轮 recommendation
11. capture 质量漏斗事件是否已落库
12. LLM 日志是否已经带 `promptKey / promptVersion / modelRole / modelVersion`
13. stalled opportunity pattern 是否存在
14. contact cooling pattern 是否存在
15. 至少一条 strategy suggestion 是否已经被采纳并收敛
16. 最新周报 payload 是否已经带治理健康度和接入健康度
17. 是否存在 HubSpot / Salesforce `ImportSource`
18. 是否存在至少两条 CRM `ImportJob`
19. 是否存在至少一条 `NEEDS_REVIEW` 的 `IdentityMatch`
20. CRM external mapping 是否已写到 Company / Contact / Opportunity / Meeting

补充说明：

1. 当前 `pilot:eval` 会额外检查至少一条 Acme recommendation 的 payload 里，是否已经写入“首选 / 次优 / 暂缓”角色和取舍说明。
2. 当前 `pilot:eval` 还会检查 seed 中是否至少存在一条逾期 commitment 和一条已解决 blocker，避免生命周期验收没有基础样例。
3. 当前 `pilot:eval` 还会检查真实数据冷启动信号是否存在：
   - 已连接或 mock 连接的 Gmail connector
   - 至少一批真实 / 导入线程
   - 至少一批 CSV 导入后生成的工作信号
4. 当前 `pilot:eval` 还会检查 `Acme Robotics` 这类公司页示例，是否已经具备联系人、活跃机会、blocker / commitment 这类“账户势能判断”所需的基础结构。
5. 这不是 recommendation 准确率评测，但能保证前台看到的 recommendation 不是只有一句标题和空 explanation。
6. 对 Conversation Capture，这一轮只要求“至少存在一条已完成 capture，且 transcript 已标明来源”；不把“真实 ASR 必须成功”作为硬性通过条件，因为本地可能未配置 `OPENAI_API_KEY`。
7. capture 相关检查还会验证：完成处理后的会话，至少要让一个相关对象 recommendation 被重新生成，否则 transcript 到经营闭环的证据还不够完整。
8. 当前不会把“真实 ASR 必须成功”设成硬性条件，但会检查 capture 漏斗事件链至少已经覆盖：
   - `capture_started`
   - `transcript_generated`
   - `capture_memory_written`
   - `capture_recommendations_refreshed`
   - `capture_processing_completed`
9. 对 LLM 平台化，这一轮开始要求 `pilot:eval` 检查最近一批 `LLMCallLog` 是否带完整元数据：
   - `promptKey`
   - `promptVersion`
   - `modelRole`
   - `modelVersion`
   这样试点期才能明确知道“到底是哪套 prompt、哪类模型角色在工作”。
10. 对主动进化深化，这一轮开始要求 `pilot:eval` 额外检查：
   - 至少存在一条 `stalled_opportunity_pattern`
   - 至少存在一条 `contact_cooling_pattern`
   - 至少存在一条已经 `ACCEPTED` 的 `StrategySuggestion`
   这样首页、周报和设置页里的“系统学到了什么 / 已经收敛了什么”才有真实样例。
11. 对管理者价值与企业化，这一轮开始要求 `pilot:eval` 额外检查最新周报 payload 是否已经带：
   - `governanceMetrics`
   - `integrationMetrics`
   这样周报页就不只是在讲推进数量，而是已经开始讲治理健康度和接入健康度。
12. 当前 `pilot:eval` 还会汇总：
   - `eval:recommendation` 的 golden pass 结果
   - `eval:memory` 的 golden pass 结果
   因此它更像“试点总门槛检查”，而不是替代专项 eval 脚本。
13. 当前 `pilot:eval` 还会检查 CRM-first 导入基线：
   - `crm_sources_connected`
   - `crm_import_jobs`
   - `crm_conflict_signal`
   - `crm_object_bindings`
   这能保证 CRM-first 迁移不是只有页面，没有样例和 warmup 证据。
14. 当前 `pilot:eval` 还会检查工作区运营控制是否已经落库：
   - `defaultLocale`
   - `pilotMode`
   - `captureConsentRequired`
   - `dataRetentionDays`
   - `featureFlags.multilingualUi`
   - `featureFlags.diagnosticsCenter`
   这能保证 Phase F 的试点运营控制不是只有 UI，没有真实工作区配置。
15. 当前 `pilot:eval` 还会检查 shared-agent / customer-success 相关 route model 与 cross-surface handoff target buildability：
   - demo workspace 里的 `customer-success` detail / queue 是否能成功构建
   - `review-request / success-check / expansion-review / company detail` 中所有指向 `/customer-success/[id]` 的 handoff target 是否都能成功构建
16. 当前 `pilot:check` 还会检查：
   - `/diagnostics` 页面是否存在
   - README 是否明确说明英文试点覆盖范围
   - docs 索引是否覆盖 Phase F 与试点诊断入口
   这能减少“页面已经做了，但交付说明里看不到”的审阅误差。

---

## 当前不覆盖

1. recommendation 准确率评估
2. LLM 语义质量评估
3. Gmail OAuth 真账号联调
4. Conversation Capture 实时录音链路
5. evolution 长期稳定性

这些仍需要人工验收和真实试点反馈。

## 建议执行顺序

1. `npm run eval:recommendation`
2. `npm run eval:memory`
3. `npm run pilot:check`
4. `npm run pilot:eval`

如果专项 eval 已失败，不建议只看 `pilot:eval` 的总结果来掩盖问题。

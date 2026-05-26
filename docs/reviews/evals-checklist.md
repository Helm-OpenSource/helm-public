---
status: active
owner: helm-core
created: 2026-03-15
review_after: 2026-06-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# evals-checklist.md

## 文档目的

本文件用于定义 Helm 项目在阶段 F 需要建立的最小评估体系。

目标有四个：

1. 验证 recommendation 是否真的有业务价值
2. 验证记忆提取是否足够可信
3. 验证 briefing / explanation 是否真的帮助判断
4. 验证 evolution 与 conversation capture 当前处于什么成熟度
5. 验证 CRM-first 迁移工具导入后是否真的形成对象关系和经营价值
6. 验证 Phase F 的试点运营控制是否真实落库并可观测

---

## 当前仓库对应实现

当前仓库里已经落地的最小评估入口如下：

1. recommendation 黄金样本与脚本
   - [../../evals/recommendation/golden-samples.json](../../evals/recommendation/golden-samples.json)
   - [../../scripts/recommendation-evals.ts](../../scripts/recommendation-evals.ts)
   - [../../lib/evals/recommendation-evals.ts](../../lib/evals/recommendation-evals.ts)
2. memory 黄金样本与脚本
   - [../../evals/memory/golden-samples.json](../../evals/memory/golden-samples.json)
   - [../../scripts/memory-evals.ts](../../scripts/memory-evals.ts)
   - [../../lib/evals/memory-evals.ts](../../lib/evals/memory-evals.ts)
3. 试点最小总评估
   - [../../scripts/pilot-evals.ts](../../scripts/pilot-evals.ts)
   - [../pilot/minimal-evals.md](../pilot/minimal-evals.md)
4. 当前命令入口
   - `npm run eval:recommendation`
   - `npm run eval:memory`
   - `npm run pilot:eval`
5. CRM-first 导入质量
   - `/imports/crm`
   - `/imports/jobs/[id]`
   - `npm run pilot:eval`
6. 试点运营与多语言范围
   - `/settings?tab=pilot`
   - `/diagnostics`
   - `npm run pilot:check`
   - `npm run pilot:eval`

本文件定义的是“评估标准与通过口径”。当前代码是否存在，以 [../../app/api](../../app/api) 与 [../../lib](../../lib) 为准；当前试点边界，以 [../pilot/delivery-boundary.md](../pilot/delivery-boundary.md) 为准。

---

## 一、总原则

### 1. 先做最小 evals
不要一开始追求复杂评测平台。
先做最少但关键的 evals。

### 2. 优先评估高价值链路
优先顺序：
1. recommendation
2. memory extraction
3. briefing / explanation
4. evolution
5. conversation capture

### 3. 评估必须可复用
至少要有：
1. 黄金样本
2. 固定评分标准
3. 输出报告
4. 可回归比较

---

## 二、Recommendation Evals

### 评估对象
1. 首页 today focus
2. 联系人页 recommendation
3. 机会页 recommendation
4. 审批中心 explanation

### 黄金样本最少覆盖
1. 销售机会
2. 招聘机会
3. 创始人 / COO 场景
4. blocker 主导场景
5. commitment 逾期场景

### 每条 recommendation 评分项
1. 推荐方向是否正确
2. 推荐优先级是否合理
3. supporting facts 是否抓对
4. blocker / commitment 是否抓对
5. explanation 是否有说服力
6. `policyResult` 是否合理

### 指标
1. recommendation 批准率
2. recommendation 编辑后批准率
3. recommendation 忽略率
4. recommendation 转成真实推进动作的比例

### 通过标准
1. 有黄金样本集
2. 有人工评分表
3. 可输出 recommendation 评估结果
4. 可按 actionType / workspace / user 对比

### 当前仓库最小落地口径
1. 黄金样本当前已覆盖销售机会、招聘联系人、创始人/COO 场景、blocker 主导场景
2. 当前脚本已检查：
   - 推荐标题是否命中
   - `decisionRole / decisionLabel`
   - `policyResult`
   - blocker / commitment / evidence / learned pattern 是否命中
3. 当前质量汇总已进入：
   - [../../features/analytics/analytics-client.tsx](../../features/analytics/analytics-client.tsx)
   - [../../features/reports/reports-client.tsx](../../features/reports/reports-client.tsx)
4. 当前还没有“人工评分表录入 UI”，这一项仍依赖文档评审和脚本输出

---

## 三、Memory Extraction Evals

### 评估对象
1. facts
2. commitments
3. blockers
4. risks
5. next-step facts

### 输入来源
1. meeting notes
2. transcript
3. imported notes

### 指标
1. fact 命中率
2. commitment 命中率
3. blocker 命中率
4. 漏提取率
5. 误提取率
6. 错归属率

### 错误分类
1. 事实抽错
2. commitment 漏掉
3. blocker 误判
4. 关联对象错误
5. 优先级错误

### 通过标准
1. 至少有一组黄金样本
2. correction 数据能帮助识别误差
3. 高频误差模式可被列出

### 当前仓库最小落地口径
1. 当前黄金样本覆盖 3 场会议：
   - `Acme 采购评估同步会`
   - `GreenPeak 职位推进同步`
   - `Atlas 联名合作讨论`
2. 当前脚本已检查：
   - fact 命中
   - commitment 命中
   - blocker 命中
   - 错归属提示
3. 当前 correction / invalidation / deletion 统计已进入 quality summary
4. 当前“risk / next-step fact”还没有独立黄金样本评分，仍并入 fact 体系

---

## 四、Briefing 与 Explanation Evals

### Briefing 评估项
1. 是否抓住最关键目标
2. 是否抓住 blocker
3. 是否抓住 commitments
4. recommended questions 是否有用
5. recommended next steps 是否合理

### Explanation 评估项
1. 是否回答“为什么现在推荐”
2. 是否引用正确 supporting facts
3. 是否引用关键 blocker / commitment
4. 是否能帮助用户做批准 / 拒绝判断

### 通过标准
1. 至少有 10 个样本
2. 至少有人为评分
3. 能区分“完整但没用”和“真的有帮助”

### 当前仓库最小落地口径
1. 当前 briefing / explanation 还没有独立脚本文件
2. 当前通过 recommendation eval 与人工验收路径间接覆盖 explanation：
   - 标题是否合理
   - evidence 是否存在
   - blocker / commitment 是否进入 explanation
3. 当前这部分仍属于“部分可评估”，不应误写成已完成的独立 eval 子系统

---

## 五、Evolution Evals

### A. PolicyRule 类 suggestion
必须验证：
1. 被采纳前的 `policyResult`
2. 被采纳后的 `policyResult`
3. approval / auto execute 行为是否变化
4. 审计是否完整

### B. PreferenceSignal 类 suggestion
必须验证：
1. 被采纳前 signal 状态
2. 被采纳后 signal 状态
3. explanation 是否开始引用 learned pattern
4. personalization 是否增强
5. 是否仍保持人工可控

### 通过标准
1. 两类 suggestion 至少各有一条可验证路径
2. accept / dismiss 都能追溯
3. 不会自动放宽高风险策略

### 当前仓库最小落地口径
1. `PreferenceSignal` 类 suggestion 当前在主 seed 中有真实样例
2. `PolicyRule` 类 suggestion 当前通过受控验证路径验证，不是主 seed 默认样例
3. 当前 `pilot:eval` 已检查：
   - 至少一条 `ACCEPTED` 的 `StrategySuggestion`
   - `PatternFact` 已扩到 stalled opportunity / contact cooling 等高价值模式
4. 当前仍缺：
   - accept / dismiss 的独立自动回归脚本
   - 更广覆盖的 suggestion 类型

---

## 六、Conversation Capture Evals

### 评估分层

#### 已真实实现
1. start capture
2. stop capture
3. transcript 入库
4. insights 入库
5. 写回 memory
6. recommendation / approval 受影响

#### 半实现
1. transcript 来源为人工文本 / fallback
2. segments 不是实际 diarization
3. ingest API 更像系统入口

#### 未实现
1. 实时录音
2. 实时转写
3. Zoom / 电话系统原生接入
4. 外部 ASR provider

### 通过标准
1. 成熟度边界表达清楚
2. 不把原型包装成成熟能力
3. 当前链路足够支撑 demo 和共创验证

### 当前仓库最小落地口径
1. 当前 `pilot:eval` 已检查：
   - completed capture
   - transcript / insight 已存在
   - transcript 已带来源
   - recommendation 已至少刷新一轮
2. 当前不会把“真实 ASR 必须成功”作为硬通过条件
3. 当前对外表述必须继续保持：

## 七、CRM-first Migration Evals

### 评估对象
1. HubSpot 首次导入
2. Salesforce 首次导入
3. 增量同步
4. 对象映射与冲突处理
5. 导入后 warmup

### 必须检查
1. `ImportSource / ImportJob / ImportItem / IdentityMatch` 是否落库
2. Contact / Company / Opportunity / Meeting 是否带 external mapping
3. 导入后 today focus 是否有新内容
4. recommendation 是否引用 CRM 导入对象或活动
5. notes / events 是否形成 blocker / commitment

### 通过标准
1. HubSpot 与 Salesforce 至少各有一条完成的导入任务
2. 至少一条 `NEEDS_REVIEW` 冲突可在冲突页看到
3. warmup 摘要里能看到 recommendation、commitment、blocker 生成结果
4. 试点评估不能只停留在“导入成功”，必须能验证“导入后有经营价值”
   - 它是“会话理解与经营闭环入口”
   - 不是“成熟的实时录音转写产品”

---

## 七、推荐的输出物

每类 eval 至少输出：

1. 黄金样本列表
2. 评分维度
3. 评分结果
4. 当前主要问题
5. 下一轮优化建议

---

## 八、最终通过标准

当且仅当下面 5 条同时满足时，eval 体系才算最小成立：

1. recommendation 有最小 eval
2. memory extraction 有最小 eval
3. briefing / explanation 有最小 eval
4. evolution 有最小验证路径
5. conversation capture 的成熟度边界有明确评估

如果缺其中任何一项，阶段 F 仍然不算真正收口。

## 当前执行命令

建议按下面顺序执行：

1. `npm run eval:recommendation`
2. `npm run eval:memory`
3. `npm run pilot:eval`

如果 recommendation 或 memory eval 失败，应优先修黄金样本、输出口径或链路质量，不应先在文档里放宽标准。

---
status: active
owner: helm-core
created: 2026-03-15
review_after: 2026-06-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# phase-f-trial-operations-and-production-readiness.md

## 文档目的

本文件用于定义 Helm 项目在完成阶段 A、B、C、D、E 之后，进入“阶段 F：试点运营与生产就绪”的实施方向。

目标有五个：

1. 把产品从“功能较完整”推进到“可稳定试点”
2. 把智能系统从“可演示”推进到“可评估、可监控、可回退”
3. 把交付从“开发完成”推进到“运营可控”
4. 让 recommendation、memory、LLM、evolution、conversation capture 都有量化评估与生产护栏
5. 为后续真实设计合作伙伴试点和正式商业化做准备

---

## 一、为什么现在进入阶段 F

当前项目已经具备：

1. 经营前台
2. 记忆系统
3. recommendation engine
4. LLM integration
5. adaptive evolution
6. conversation capture 原型链
7. analytics / weekly report / import / connector 基础能力

此时继续扩新功能，收益会明显下降。
真正影响试点成败的，已经不是“再多一个功能”，而是：

1. recommendation 到底准不准
2. 记忆和提取到底稳不稳
3. conversation capture 到底能不能安全进入试点
4. 长链路失败时会不会拖垮主流程
5. 团队有没有足够的运营和观测能力去支撑试点
6. CRM / system of record 的接入是否足够平滑，能不能在接入后 10 分钟内看见价值

因此，阶段 F 的重点不是新功能，而是：

**评估、稳定性、安全、运营、可观测性。**

---

## 二、阶段 F 的五大工作流

## 1. 评估体系
目标：
把产品当前的智能能力变成可量化、可回归、可比较的系统。

必须覆盖：
1. recommendation evals
2. memory extraction evals
3. briefing / explanation 评估
4. evolution suggestion 采纳效果评估
5. conversation capture 处理链评估

## 2. 生产稳定性
目标：
把长链路从“能跑”推进到“稳跑”。

必须覆盖：
1. 后台任务化
2. 重试机制
3. 幂等性
4. 失败补偿
5. 超时与降级
6. 任务状态可视化

## 3. 安全与合规
目标：
确保高风险能力在真实试点里不会出边界问题。

必须覆盖：
1. conversation capture 授权提示
2. transcript / insight retention policy
3. 删除与导出
4. 高风险动作保护
5. secret / env / connector 配置收口

## 4. 试点运营能力
目标：
让系统具备“真正进场试点”的操作能力。

必须覆盖：
1. pilot mode
2. feature flags
3. multilingual trial shell
4. workspace onboarding
5. 冷启动价值面板
6. 试点诊断页
7. usage / activity tracking

## 5. 成本与可观测性
目标：
知道智能系统到底耗费了什么、哪里出错、哪里有价值。

必须覆盖：
1. LLM / ASR 调用成本与耗时
2. provider 失败率
3. workspace 成本归因
4. recommendation 价值看板
5. 关键链路健康度

---

## 三、P0 优先级

## P0-1 recommendation 评估体系

### 目标
验证 recommendation 不是“看起来合理”，而是在真实场景里有价值。

### 必做内容
1. 建立 recommendation 黄金样本集
2. 建立 recommendation 人工评分表
3. 增加 recommendation 质量脚本
4. 增加 recommendation 关键指标统计：
   - 批准率
   - 编辑后批准率
   - 忽略率
   - 转化为真实推进动作的比例
5. 支持按 workspace、用户、actionType 看 recommendation 表现

### 输出
- evals/recommendation/
- recommendation quality dashboard
- recommendation weekly report section

---

## P0-2 memory 提取质量评估

### 目标
验证 meeting import / transcript / notes 生成的 facts / commitments / blockers 是否足够可信。

### 必做内容
1. 建立 memory extraction 黄金样本
2. 对以下对象分别评估：
   - fact 命中率
   - commitment 命中率
   - blocker 命中率
3. 增加错误类型分类：
   - 漏提取
   - 误提取
   - 错归属
4. 增加 correction 统计和质量回溯

### 输出
- evals/memory/
- extraction quality summary
- 高频误差模式列表

---

## P0-3 长链路后台任务化

### 目标
让长链路不再依赖同步请求。

### 必做内容
把以下链路推进到后台任务框架中：
1. meeting import → memory generation
2. briefing generation
3. llm explanation enhancement
4. conversation capture processing
5. evolution refresh

### 必须具备
1. job 状态
2. retry
3. timeout
4. idempotency
5. failure reason
6. 手动重跑能力

### 输出
- 后台任务服务或 queue 层
- 任务状态页面或诊断入口

---

## P0-4 安全与合规收口

### 目标
确保试点时不因为边界问题翻车。

### 必做内容
1. conversation capture 开始前的授权提示
2. transcript / insight 的保留策略
3. delete / export 入口
4. 高风险动作的额外保护
5. connector / llm secrets 配置收口
6. `.env.example` 完整化

### 输出
- 合规说明文案
- retention policy
- env 模板
- README 更新

---

## 四、P1 优先级

## P1-1 试点运营能力

### 目标
让团队具备把客户带进来、观察使用、发现问题、决定是否继续试点的能力。

### 必做内容
1. pilot mode
2. feature flags
3. onboarding checklist
4. 冷启动价值面板
5. usage / activity tracking
6. 试点诊断页

### 输出
- pilot workspace config
- onboarding guide
- trial diagnostics page

---

## P1-2 成本与可观测性

### 目标
让团队知道：
- 哪条链最值钱
- 哪条链最贵
- 哪条链最容易失败

### 必做内容
1. LLMCallLog 聚合
2. ASR / transcription 成本记录
3. provider 失败率统计
4. workspace 成本归因
5. 关键链路健康度

### 输出
- cost dashboard
- provider health summary
- chain health report

---

## 五、P2 优先级

## P2-1 更深的试点运营增强
例如：
1. 更细试点角色配置
2. 更细 workspace 级配置模板
3. 成果导出
4. 更细的客户成功辅助信息

## P2-2 更深的质量回归系统
例如：
1. 更多自动化 evals
2. prompt / model 版本对比
3. regression alarm
4. 更强的人工标注与对比机制

---

## 六、本阶段明确不做

阶段 F 明确不做以下事项：

1. 不扩更多 action type
2. 不扩更多 recommendation 页面
3. 不扩 conversation capture 的实时录音能力
4. 不扩更多 evolution pattern 类型
5. 不扩企业级管理员后台的大体量功能
6. 不扩新的智能子系统

---

## 七、阶段 F 的代码与文档建议落点

建议新增目录：

```text
docs/product/phase-f-trial-operations-and-production-readiness.md
docs/reviews/trial-readiness-checklist.md
docs/reviews/evals-checklist.md
docs/operations/
docs/evals/
```

代码层建议新增或增强：

```text
lib/evals/
lib/jobs/
lib/diagnostics/
lib/observability/
features/operations/
features/diagnostics/
```

---

## 八、给 Codex 的直接实施指令

下面这段可以直接贴给 Codex。

```text
现在不要继续扩新功能，进入“阶段 F：试点运营与生产就绪”。

目标：
把 Helm 从“功能已较完整的智能产品”推进到“可稳定试点、可量化评估、可安全运行、可持续优化”的状态。

先不要直接编码。
请先阅读：
- AGENTS.md
- README.md
- docs/README.md
- docs/product/intelligence-roadmap.md
- docs/reviews/code-review.md
- docs/reviews/memory-system-code-review.md
- docs/reviews/recommendation-engine-code-review.md
- docs/reviews/llm-integration-code-review.md
- docs/reviews/adaptive-evolution-system-code-review.md
- docs/conversation-capture/code-review.md，如果已存在

然后先输出《阶段 F 实施计划》，按 P0、P1、P2 排优先级。

本轮只做以下五类事：

P0
1. recommendation evals
2. memory extraction evals
3. 长链路后台任务化
4. 安全与合规收口
5. .env.example 与 README 收口

P1
6. 试点运营能力
   - pilot mode
   - feature flags
   - workspace onboarding
   - 冷启动价值面板
   - 试点诊断页
   - usage / activity tracking

7. 成本与可观测性
   - LLM / ASR token 与耗时统计
   - provider 失败率
   - workspace 成本归因
   - recommendation 价值看板

明确不做：
- 不扩更多 action type
- 不扩更多页面
- 不扩更深的自动执行
- 不扩新的智能子系统

最后交付必须包括：
1. 阶段 F 目录树与文件清单
2. eval 脚本和黄金样本清单
3. 后台任务与重试机制说明
4. 安全与合规收口清单
5. 试点运营与 observability 说明
6. README 和 docs 更新
7. 明确的验收路径
```

---

## 九、阶段 F 的完成门槛

只有同时满足下面 7 条，才算阶段 F 完成：

1. recommendation 有最小 evals
2. memory extraction 有最小 evals
3. 长链路至少核心几条进入后台任务
4. conversation capture 边界有明确授权与保留策略
5. `.env.example` 与 README 收口
6. 有 pilot mode / onboarding / diagnostics 基础能力
7. 有最小 cost / observability 面板

---

## 十、最终结论

阶段 F 不是功能开发阶段，而是“试点成功率提升阶段”。

这一阶段做得好，决定的是：
1. recommendation 能不能被证明有价值
2. memory 抽取能不能被证明够可信
3. 试点会不会因为稳定性和边界问题失败
4. 团队能不能真正进入下一阶段商业化验证

因此，它应该放在仓库里作为产品总路线图下的一个执行阶段文档，而不是孤立的工程说明。

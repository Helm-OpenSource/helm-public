---
status: archived
owner: helm-core
created: 2026-05-08
review_after: 2026-11-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Memory Client 渲染审视 V1

状态：audit-pass / decision-recorded
日期：2026-05-08
受众：Helm memory feature 团队 / 工程审计
继承：R4 走查 / R8 PR 清单（PR-12）

> **本文目的**：R4 标定 memory 是 schema 设计上"原始事实 / Helm 推断 / 候选 / 决定"四层分离的 evidence trace 标杆，但 3411 行 client 渲染层是否真把 schema 优势翻译成视觉级隔离需要核查（"如果塌成同一 list 流就丢失 schema 优势"）。**本文是审视决策记录，结论为 audit-pass，不需重构。**

---

## 一、审视范围

`features/memory/memory-client.tsx`（3411 行 client component），渲染 page-loader 输入的 schema：

| 层级 | schema 字段 | 数据语义 |
|---|---|---|
| L1 原始事实 | `memoryEntries / memoryFacts` | 来源系统直读的客观记录 |
| L2 Helm 推断 | `commitments / blockers / corrections` | 系统从原始事实演绎出的判断 |
| L3 候选 | `reflectionCandidates / distillationCandidates` | 等待人工复核的候选记忆 |
| L4 决定 | `reflectionDecisions / distillationDecisions` | 已 sign-off 的复核决策（审计轨迹）|

外加 `auditLogs / externalMemoryRecords` 横切关系数据。

---

## 二、核查结果（逐项）

### 2.1 视觉级隔离 ✅

每个 schema 层都有独立 `<Card className="workspace-panel-muted">` 容器渲染，互不混淆。已识别的 section 包括（按文件 line 顺序）：

- `distillationReviewSection` (line 1048)
- `reflectionCarryForwardSection` (line 1247)
- `reflectionDecisionsSection` (line 1363)
- 后续多个 Card section（facts / commitments / blockers / corrections / commercial-detail 等）— line 1471, 1533, 2056, 2141, 2252, 2290 …

**没有"塌成同一 list 流"的反模式**。

### 2.2 每 section 自带 D3 边界声明 ✅

抽样 distillation candidate review section（line 1063）：

> "Approve, reject, or defer only records a candidate review decision. It does not create canonical MemoryFact, promote memory, execute actions, or change recommendation ranking. This is not a chat surface."
>
> 中："批准、拒绝或暂缓只会记录候选复核决策。它不会创建正式 MemoryFact、提升记忆、执行动作，也不会改变推荐排序。这里不是聊天入口。"

reflection 延续 section（line 1262）：

> "These candidates come from reflection over trusted runtime state. They stay explicit and reviewable here instead of silently becoming canonical truth."

reflection decisions section（line 1378）：

> "These items are no longer active 延续 candidates, but they remain visible so the review decision stays explicit and traceable."

每条都明确"这个 section 不会自动做什么 / 这里发生什么是审计可追"，**完美符合 D3 边界**。

### 2.3 文案对齐 D4 服务非教学 ✅

每个 section 的 description **直接告诉用户当前要求**（"复核重复记忆候选" / "可以继续喂给后续记忆工作的复核后可复用上下文"），不是 "tells you / 把这里当成 X 来看 / 这里不是 X 而是 Y" 等教学话术。

`npm run lint:teaching-copy` 在该文件上 0 violations（PR-01b 已经清扫过；上一轮 PR-01b commit `8e33d75fe` 修过 line 2261 一处对比解释教学话术）。

### 2.4 D5 企业可信度 ✅

- 命名："Distillation candidate review / 记忆浓缩候选复核"、"Reflection 延续 / 复盘延续" — 业务化语言，不是 instrumentation 词
- icons 区分（CircleDot / Sparkles）让 4 层视觉差异更明显
- eyebrow chip 标 section 类型（让用户一眼知道当前看的是哪类）

### 2.5 R4 提到的"memory" 命名歧义风险

R4 担心 "memory" 一词客户面有"对话记忆"歧义。审视后判断：

- 路由路径 `/memory` 短而清楚
- 页面顶部 PageHeader 已有充分上下文（具体待 R7+ 后续审视 PageHeader 顶部 — 不在 PR-12 范围）
- 各 section description 直接告知是"经营记忆"语义，不会被理解成聊天历史

不需要在 PR-12 改命名。

---

## 三、决策

**audit-pass**：memory client 渲染层已经对得起 schema 设计的 evidence trace 标杆地位。schema 4 层视觉级隔离 + 每 section D3 边界声明 + D4 服务非教学文案 + D5 业务化命名 — 4 维度全部达标。

**不需要重构 / 不需要加 dimension filter / 不需要折叠 candidates 与 decisions 到次级**（R4 改造建议中的 "如果塌成 list 流则…" 假设条件不成立）。

R8 PR-12 由"待验证 P0"切换为"audit-pass，不动代码，决策记录"。

---

## 四、潜在的后续 P3 工作（不在本 PR 范围）

### 4.1 长 surface 导航增强（视使用数据决定）

3411 行 client 意味着 surface 很长。如果使用数据显示用户主要看某 1-2 个 section，可考虑：

- 顶部 jump nav（"跳到 facts / commitments / candidates / decisions"）
- 默认折叠 decisions section（审计轨迹通常低频使用）

但本质是性能 / 易用性优化，不是架构问题。**不阻塞当前 surface 价值**。

### 4.2 cross-layer 关联高亮

当用户点击某个 commitment（L2 推断），是否能高亮其支撑的 memoryFacts（L1 原始事实）？schema 层有 `supportingFactIds` 字段已设计了关联。这是 deep linking 增强，P3 排期。

---

## 五、变更记录

- **2026-05-08 V1**：基于 R4 走查标定的 P0 待验证项，进 features/memory/memory-client.tsx（3411 行）做 D1/D3/D4/D5 维度审视。结论 audit-pass — schema 4 层视觉级隔离完成、各 section 自带 D3 边界声明、文案对齐 D4/D5。R8 PR-12 不动代码、决策记录。

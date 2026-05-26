---
status: active
owner: helm-core
created: 2026-05-07
review_after: 2026-08-05
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Follow-ups Surface 架构决策 V1

状态：decision-recorded
日期：2026-05-07
受众：Helm 工程团队（dashboard / approvals / opportunities 各 surface owner）
继承：R3 走查 / R8 PR 清单（PR-13）

> **本文目的**：R3 走查标定 follow-ups 当前仅 `[id]` detail 无 list page，从 dashboard / approvals 跳进 detail 后形成"推进流孤岛"（D2 架构问题）。本文落定 follow-ups surface 的架构选型，作为 P3 排期 work-item。**本文是决策记录，不含实施改动**。

---

## 一、当前状态

### 1.1 路由与组件

| 路径 | 组件 | 数据源 |
|---|---|---|
| `/follow-ups/[id]` | `FollowupDetailPage` → `InboxFollowupReviewRequestDetailView` | `getOpportunityCommercialDetailData(workspaceId, id)` |
| `/follow-ups` | **不存在**（无 list page）| — |

### 1.2 关键事实（来自 R7 走查）

- follow-ups 与 `/sendability/[id]`、`/external-proposals/[id]`、`/proposals/[id]`、`/offers/[id]`、`/commercial-strengthening/[id]` 共享同一个 Opportunity-detail 数据管道（`getOpportunityCommercialDetailData`）
- 每个 follow-up id 实际上是一个 Opportunity id —— follow-ups 是 Opportunity 的**跟进视角**，不是独立信号源
- 用户从 dashboard `WorkCard` / approvals 队列跳进 follow-up detail，detail 页**没有任何"上一条 / 下一条 / 今日剩余"侧栏**
- 用户处理完一条 follow-up 必须**返回 dashboard** 重新选下一条 — 高频场景下交互成本高

### 1.3 R3 标定问题

> follow-ups 仅 detail 无 list，导致推进流孤岛感（D2 架构问题）

---

## 二、三方案 ROI / 风险 / 工时

### 方案 (a)：加 `/follow-ups` list page

**思路**：新建 `app/(workspace)/follow-ups/page.tsx` 列表页，按到期时间 / 推进窗口排序所有 follow-ups。

**评估**：

| 维度 | 评分 |
|---|---|
| ROI | ⚠ 低 |
| 风险 | ⚠ 中 |
| 工时 | 2–3 d |

**否决理由**：
1. **重复 `/opportunities`**：opportunities 已经是按 stage / priority 排序的客户机会列表，加一个"按 followup 视角排序的 opportunities list"是同一份数据的第二个 lens，违反"避免概念重复"原则
2. **list page 未必能解决孤岛感**：用户痛点不是"找不到 follow-ups list"，是"处理完一条无法快速去下一条"。list page 帮不到流式处理
3. **新 surface 增加维护成本**：reports / dashboard / opportunities / follow-ups 四个表面会进一步分散注意力，违反"判断密度"D1 原则

### 方案 (b)：detail 加左/右侧栏列"今日 follow-up 队列"

**思路**：`InboxFollowupReviewRequestDetailView` 加可折叠侧栏，展示当天所有待处理 follow-ups（按到期 / 风险排序），点击切换 detail，无需返回 dashboard。

**评估**：

| 维度 | 评分 |
|---|---|
| ROI | ✅ 高 |
| 风险 | ✅ 低 |
| 工时 | 2 d |

**采纳理由**：
1. **直接解决推进流孤岛**：用户在 detail 内就能看到下一条，处理完直接 click，零返回成本
2. **不新建 surface**：复用现有 `/follow-ups/[id]` 路由，仅扩 detail-view 组件，不增加架构概念
3. **数据源现成**：后端只需一次 `findMany({ stage: ADVANCING, ... })` 查询，复用 `getOpportunityCommercialDetailData` 同源
4. **与现有 dashboard 主屏 / approvals 队列形成补充而非冲突**：dashboard 给"今天必须由你拍板的 3 件事"，approvals 给"复核压力"，follow-ups detail 侧栏给"推进流上下文"，三者是不同时刻 / 不同任务态的入口

### 方案 (c)：合并 follow-ups 进 approvals 或 dashboard，删除 surface

**思路**：把 follow-ups 概念吞并 — approvals 已是复核+边界面，dashboard 已是推进面，follow-ups 不应独立存在。

**评估**：

| 维度 | 评分 |
|---|---|
| ROI | ⚠ 低 |
| 风险 | ⚠ 高 |
| 工时 | 4–5 d |

**否决理由**：
1. **语义不重叠**：follow-up 的语义是"客户/对方有动作待我跟进"，approval 的语义是"我有动作待复核"——两者是不同时态。强合并会让 approvals 队列被推进项淹没
2. **破坏现有 URL 与外部跳转**：`/follow-ups/[id]` 大概率已在邮件提醒、移动端分享、第三方集成中沉淀链接，删除会破坏用户路径
3. **与 R3 P1 范围不匹配**：R3 标定的 P2 改造（架构决策项），不是 P0/P1 紧急清扫——拆迁式改造 ROI 不成立

---

## 三、决策

**采纳方案 (b)**：在 `features/inbox-followup-review-request/detail-view.tsx` 加可折叠的"今日 follow-up 队列"侧栏。

### 3.1 实施范围（P3 排期）

| # | 改动 | 工时 |
|---|---|---|
| 1 | `features/inbox-followup-review-request/page-loader.ts` 加查询：当前 workspace 内 `OpportunityType.CLIENT` + `stage IN [ADVANCING, NEW, CONTACTED]` + 排除当前 id 的 Opportunity 列表（限 20 条） | 0.5 d |
| 2 | `InboxFollowupReviewRequestDetailView` 顶部 / 右侧加侧栏组件 `FollowupQueueSidebar`，渲染列表（标题 / 阶段 / 风险 / "继续推进" CTA） | 0.75 d |
| 3 | 侧栏支持折叠/展开（默认展开 desktop / 折叠 mobile），状态存 `localStorage` | 0.25 d |
| 4 | 验证：dashboard 跳到 follow-up detail，侧栏显示，跳到下一条详情，URL 切换 + 侧栏保留状态 | 0.25 d |
| 5 | 加单测：page-loader 查询返回正确 + 侧栏 a11y test | 0.25 d |

**总工时**：2 d。

### 3.2 验证标准

- [ ] dashboard `WorkCard` → follow-up detail，detail 顶部/右侧出现侧栏
- [ ] 侧栏列出至少 3–5 条今日推进项（按到期时间倒序）
- [ ] 点击侧栏其他条目，切换 detail，URL 同步变化
- [ ] 当前 follow-up 在侧栏中高亮（current-active 样式）
- [ ] 侧栏带 D3 边界声明："这里只是推进上下文，正式复核仍在 Approvals 完成"
- [ ] 移动端默认折叠，按需展开

### 3.3 不在范围

- 不动 `/follow-ups/[id]` 路由结构
- 不加 `/follow-ups` list page（方案 a 否决）
- 不删除 follow-ups 概念合并入其他 surface（方案 c 否决）
- 不改变 follow-up 与 Opportunity 的关系（仍 1:1）

---

## 四、本文不做的事

- 不实施代码改动 — 本文是 P3 排期的决策记录
- 不影响 R8 PR 清单的 P0/P1 节奏 — 当前实施进度按 R8 进行，PR-13 只决策不动 code

---

## 五、关键人物

- 决策 owner：Helm 实施经理
- 实施 owner：dashboard / inbox-followup feature 团队（待 P3 启动时分派）
- 复核：CLAUDE.md 维护者（确保改动符合 DESIGN.md §4 产品语义）

---

## 六、变更记录

- **2026-05-07 V1**：基于 R3 走查标定的 D2 架构问题 + R7 follow-ups detail-only 现状核查，采纳方案 b（侧栏方式）作为 P3 改造方向。本文为决策记录，落清晰排期 work-item，不动代码。

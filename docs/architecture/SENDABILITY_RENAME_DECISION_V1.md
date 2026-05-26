---
status: active
owner: helm-core
created: 2026-05-08
review_after: 2026-08-06
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# /sendability + commitment-reinforcement-sendability 重命名决策 V1

状态：partial-decision-recorded
日期：2026-05-08
受众：Helm 工程团队（feature owner: external-output / sendability surface）
继承：R7 走查 / R8 PR 清单（PR-05）

> **本文目的**：R7 标定 5 个对外输出 surface（proposals / external-proposals / external-narratives / offers / sendability / commercial-strengthening）的 D5 命名问题。PR-05a（加 /proposals list page）已交付解决 D2 漏点。本文落定 PR-05b（路由 rename）+ PR-05c（feature 目录 rename）的处理决策。

---

## 一、PR-05 三子项现状

| 子项 | 内容 | 价值维度 | 工时 | 状态 |
|---|---|---|---|---|
| PR-05a | 加 `/proposals` list page（统一对外输出列表）| D2 决策入口 | 1 d | ✅ 已完成（commit `c6efb7d70`）|
| PR-05b | 路由 `/sendability` → `/send-ready` rename + 旧路由 redirect | D5 客户面 URL 干净 | 1 d | 决策中 |
| PR-05c | feature 目录 `commitment-reinforcement-sendability/` → `send-ready-check/` rename | D5 工程语义干净 | 1 d | 决策中 |

PR-05a 拿走"D2 缺统一列表"这个最大价值，PR-05b/c 边际价值显著下降。

---

## 二、PR-05c（feature 目录 rename）— **采纳 won't-fix 推 P3**

### 2.1 决策

与 PR-03 InternalOperatingHome 目录改名 won't-fix 同 pattern：

- **客户面看不见**：`commitment-reinforcement-sendability` 仅作为 import path 出现在 source code，客户在 UI 上**看不到**
- **boundary sentinel 风险**：`scripts/decision-first-boundary-check.ts` 与 `scripts/helm-self-check-refactored.ts` 大概率有该目录路径作为 sentinel（与 PR-03 InternalOperatingHome 30+ sentinel 同模式），rename 会破坏 boundary check
- **改动放大**：~5+ 文件 source rename + 同等数量 sentinel 更新 + 测试断言 — 高风险低边际收益

### 2.2 P3 排期建议

如果未来某天：
- 客户在错误堆栈 / DevTools / e2e 截图里高频遇到 `commitment-reinforcement-sendability` 字眼且反馈减分
- 或者整体 sendability surface 做 P2 级合并入 approvals 时一并 rename

那时再做 PR-05c。当前不动。

---

## 三、PR-05b（路由 rename）— **延后到行业 fixture 闭环后**

### 3.1 与 PR-05c 的关键区别

PR-05b 改的是**客户面 URL**（`/sendability/xxx` 客户实际看见 + 可能在邮件提醒 / 移动端分享 / 第三方集成里沉淀链接）。这跟 PR-05c "客户看不见" 不同——是真问题。

### 3.2 但当前不做的理由

- **PR-05a 已加 list page** — 多数用户从 `/proposals` 列表跳进 detail，不再直接看 `/sendability` URL
- **rename 涉及 redirect + e2e 调整** — 1 d 工作量但中等风险（涉及 sourcePage event metadata、analytics 链路、外部沉淀链接）
- **PR-06 跨行业 fixture 价值更高** — 5 d 工作量但是销售扩展核心。先把 PR-06 落地，PR-05b 在 PR-06 完成后单独做一轮

### 3.3 P3 排期建议

PR-06 全部子项（06a/b/c/d）完成后，单独做 PR-05b：
- 新建 `app/(workspace)/send-ready/[id]/page.tsx`（与现有 `/sendability/[id]` 同 surface）
- 旧 `/sendability/[id]` 改为 redirect 到 `/send-ready/[id]`
- 更新 `sourcePage` event metadata
- 文档化 deprecation

---

## 四、整体 PR-05 闭环判定

| 子项 | 判定 |
|---|---|
| PR-05a list page | ✅ 已完成（commit `c6efb7d70`）|
| PR-05b 路由 rename | 推 P3，PR-06 闭环后做（约 4–6 周后）|
| PR-05c feature 目录 rename | won't-fix（与 PR-03 同 pattern）|

R8 PR-05 由"3d 三件套"切换为"已完成 PR-05a + PR-05c won't-fix + PR-05b 延后到 P3"。

---

## 五、变更记录

- **2026-05-08 V1**：基于 R7 走查标定 + PR-05a 已交付的边际价值评估 + PR-03 InternalOperatingHome 决策模式参考，落定 PR-05c won't-fix（推 P3）+ PR-05b 延后到 PR-06 闭环后。当前 R8 范围内 PR-05 完结。

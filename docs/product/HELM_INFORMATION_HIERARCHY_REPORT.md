---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Information Hierarchy Report

## 当前结论

当前 current-main 已把 Helm 高频页面的统一信息层级收口为三层结构：

- 前台层
- 中间层
- 后台层

## 三层结构

### L1 前台层

承载：

- 当前状态
- 待决策
- 下一步动作
- 边界

首屏预算：

- 最多 4 个主模块
- 默认 0 个展开的系统解释块

### L2 中间层

承载：

- review snapshot
- prepared draft / prepared context
- 协作分工
- secondary summary

### L3 后台层

承载：

- why it matters
- evidence
- replay
- audit
- worker reasoning
- 状态语义说明

## 默认可见 vs 降级规则

### 首屏必须展示

- 当前状态
- 待决策
- 下一步动作
- 边界

### 默认折叠

- Review snapshot
- Why it matters
- Evidence drawer

### 必须进入后台 / appendix

- replay 细节
- audit 细节
- memory 事实全文
- worker reasoning 细节

## 本轮扩展范围

这一轮不只治理 legacy detail 页，也把同一套层级合同继续扩到了共享组件和经营队列：

- [`reporting-protocol-panel.tsx`](../../components/shared/reporting-protocol-panel.tsx)
- [`proactive-mechanism-panel.tsx`](../../components/shared/proactive-mechanism-panel.tsx)
- [`queue-view.tsx`](../../features/customer-success-handoff/queue-view.tsx)

这三类页面现在也要求：

- 首屏最多 4 个主模块
- 默认 0 个展开的系统解释块
- `ReviewSnapshotBlock`、`WhyItMattersBlock`、evidence 默认下沉

第三轮继续把剩余 detail families 的 model / view 表达和 meeting detail prepared-summary prompt 也纳入同一份 hierarchy governance，避免系统自述通过 detail model 再次回到首屏链路。

第四轮则把 dashboard / meetings / approvals / opportunities / imports / inbox / customer-success queue 等高频 operating surface 也纳入 broader surface no-Helm audit，让对象优先主语从 detail family 扩到更广的 workspace 层。

第五轮继续把 meeting explanation、onboarding / public-entry、settings guidance、detail hint 等运行面纳入 project-level systemspeak audit，并把后台 explanation 明确划到非前台硬禁区。

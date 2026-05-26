---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Information Hierarchy Baseline Freeze Report

## 当前状态

L1-L4 信息层级规则已经通过共享协议和代表页落地，不再只是写作规范。当前需要冻结的是“什么必须首屏出现、什么必须降级、什么必须折叠”的判断规则。

## Freeze 结论

### 当前已完整成立

- `L1 judgement layer`
  - 承载：当前判断、为什么现在值得处理、Helm 已推进了什么、现在需要你做什么
  - 要求：首屏默认可见
- `L2 action layer`
  - 承载：主动作、次动作、当前 owner、下一步建议
  - 要求：动作前置，但不能抢在 L1 之前
- `L3 boundary layer`
  - 承载：prerequisite、dependency、risk、non-commitment、internal-only、review-needed
  - 要求：默认可见，不能被埋进 EvidenceDrawer
- `L4 evidence layer`
  - 承载：replay、audit、memory、worker outputs、resource relation、历史变化、原始对象细节
  - 要求：默认折叠，作为核验层存在

### 必须首屏展示

- 当前判断
- 2 到 3 条 why-it-matters
- Helm 已推进动作
- 当前 decision request / collaboration request
- 主动作和次动作
- 边界摘要

### 必须降级为 secondary summary

- 当前 owner
- worker summary
- 优先级信号

### 必须折叠进 EvidenceDrawer

- replay 细节
- audit 细节
- memory 事实全文
- worker outputs 细节
- 原始对象历史变化
- 原始对象详情字段

### 只适合 internal-only admin / builder

- 全量 worker roster
- 全量 resource relation
- builder 级策略与调试信息
- 不适合 customer-facing 的 internal-only cue

### 已成形但仍需下一层

- 当前 30 秒阅读标准已在 3 个模板页成立，但更多详情页仍需继续验证
- 对象详情字段降级到附录的规则已经清楚，但更多对象页还没全面执行

### 刻意未做

- 没有做完整全站 hierarchy platform
- 没有扩成 BI / workflow / admin 平台

### 诚实保留边界

- 当前层级规则是第一轮局部落地，不是全站完成重构
- 当前更多是人类界面协议，而不是完整的数据建模平台

## 统一评审标准

当前 freeze 默认仍采用这 6 条：

1. 用户 30 秒内能否知道当前判断
2. 用户 30 秒内能否知道为什么现在值得处理
3. 用户 30 秒内能否知道 Helm 已推进了什么
4. 用户 30 秒内能否知道现在需要谁做什么
5. 用户 30 秒内能否直接执行下一步
6. 用户需要核验时能否快速找到依据

## 总结

- 信息层级规则当前基线已经清楚
- 首屏 / 边界 / 证据的层级关系已经清楚
- 当前版本已经足够作为后续全站页面扩展的结构协议起点

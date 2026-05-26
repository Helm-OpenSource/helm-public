---
status: active
owner: helm-core
created: 2026-04-30
review_after: 2026-07-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Pack A — B2B SaaS 销售推进

> Helm 行业 Pack A，对应 ICP 1（B2B SaaS / 企业软件公司）。
> 本文件是 Pack A 清单（开源摘要版）。完整商业版能力请访问 helm.dev。

## 适用客户
- 30-500 人 B2B SaaS / 企业软件公司
- 5-50 人销售团队（销售 + 售前 + CS）
- 客单价 ¥10 万 - ¥500 万 ARR
- 销售周期 30-180 天

## 4 个 Skill

| ID | 名称 | 一句话 | 触发 |
|---|---|---|---|
| A1 | 会议跟进清单 | 会后 5 分钟出"该跟谁、跟什么、不能承诺什么" | 客户会议结束 |
| A2 | 今天该跟的 5 个客户 | 给销售一张"今天的优先级清单" | 每日 09:00 / 主动 |
| A3 | 销售主管的会议风险面板 | 给主管"今天该看的几个会" | 每日 / 主管打开 |
| A4 | 交付/CS Handoff Pack | 把承诺、边界、悬而未决项交给交付 | 销售标记成单 |

## 双层结构
每个 Skill 由两层组成：
- **外层 SKILL.md**：自然语言操作手册（认证工程师可读可改）
- **内层 worker**：TypeScript 实现（商业版闭源）

详见 `docs/product/HELM_PACK_SKILL_DUAL_LAYER_SPEC_V1.md`。

## 三条强约束
1. **Day-1 行业有效性**：每个 Skill 自带 seed（playbook + templates + thresholds），开箱可用
2. **作业质量是核心证据**：每个 Skill 有量化门槛 + 业务侧可读验证
3. **首次落地是种子事件**：第一个 design partner 必须满足行业代表性 + 配合度 + 可公开案例性三条硬门槛

## 不做清单（红线）
- 不自动发邮件给客户
- 不自动写 CRM 字段（不经销售确认）
- 不替销售做"承诺类"对外措辞
- 不自动判定"成单 / 流单"
- 不替主管自动给销售评分

## 治理边界
- 默认所有对外动作走"建议 → 人工确认"通道
- 全部进 Helm audit chain
- 不掉案件 invariant（来自脱敏行业样板经验）
- 工作区多租户（与 OpenClaw 单租户区分）

## 完整文档
- 调研定位需求：`docs/sales/packs/PACK_A_B2B_SAAS_REVENUE_PUSH_RESEARCH_V2.md`
- 双层结构规范：`docs/product/HELM_PACK_SKILL_DUAL_LAYER_SPEC_V1.md`
- 商业边界：`docs/product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md`

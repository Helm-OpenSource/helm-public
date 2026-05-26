# 完整参考实现：Helm Pack A（B2B SaaS 销售推进）

> Pack A 是 Helm 官方第一个行业 Pack，作为本模板的完整参考实现。

## 路径
在 helm2026 主仓中：
- 调研定位需求：`docs/sales/packs/PACK_A_B2B_SAAS_REVENUE_PUSH_RESEARCH_V2.md`
- Pack 骨架：`docs/sales/packs/pack-a/`
  - `PACK.md`
  - `pack.config.yaml`
  - `skills/A1-meeting-followup/`
  - `skills/A2-priority-customers/`
  - `skills/A3-manager-attention/`
  - `skills/A4-cs-handoff-pack/`

## 借鉴重点
1. PACK.md 写法（适用客户 / Skill 列表 / 约束 / 不做清单 / 治理边界）
2. pack.config.yaml 的默认配置结构
3. 4 个 Skill 各自的 SKILL.md frontmatter 完整字段
4. seed/ 三件齐全（playbook.md + templates/01-03 + thresholds.yaml）
5. fixtures/ 让 Day-1 看板有真实可读内容
6. acceptance 段量化作业质量门槛

## 共性约束
- 全部 4 个 Skill 默认：
  - `helm.recommendation_only: true`
  - `helm.invariant: case-no-drop`
  - `helm.multi_tenant: true`
- 商业版 worker 闭源；模板与 Cookbook 公开

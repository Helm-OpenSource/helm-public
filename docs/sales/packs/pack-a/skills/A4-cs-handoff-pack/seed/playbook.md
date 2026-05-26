---
status: active
owner: helm-core
created: 2026-04-30
review_after: 2026-07-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Skill A4 行业 SOP 骨架

## Handoff Pack 必填项（开源 5 项；商业版 ≥10 项）
1. 承诺清单（含确认 + 待复核分层）
2. 方案边界（包含/不包含/超出项）
3. 客户性格画像（不外发）
4. 风险标注（期望 vs 方案 gap）
5. 交接联系人（销售/客户/关键决策人）

## 完整度评分维度
- **覆盖度**：5/10 项必填项是否齐全
- **可读性**：CS lead 能否直接 readable 不需追问销售
- **风险识别**：是否标记了销售期间的风险点
- **交接清晰度**：联系人 + 关键节点是否明确

## 评分公式（Pack A V1 占位，V2 校准）
- 完整度 = (覆盖度 × 0.4 + 可读性 × 0.3 + 风险识别 × 0.2 + 清晰度 × 0.1) × 5

## 双确认机制
- 销售经理初审 → 标"建议交付"
- CS lead 终审 → 标"正式交接"
- 缺任一确认，Handoff 状态保持"pending"

## 数据来源
- ICP playbook 客户访谈
- design partner pilot 4 周后校准

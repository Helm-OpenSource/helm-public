---
status: active
owner: helm-core
created: 2026-04-30
review_after: 2026-07-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Skill A2 行业 SOP 骨架

## 优先级判断维度（开源摘要 5 维；商业版 ≥10 维）
1. **承诺到期度**：A1 识别的承诺距离到期天数
2. **沉默时长**：客户最后响应距今小时数
3. **客户健康度**：CS 反馈、续约率、NPS
4. **机会金额 × 概率**：金额加权概率
5. **主管标记**：销售主管手工标记的"今天必看"

## 默认权重（可调）
| 维度 | 权重 |
|---|---:|
| 承诺到期度 | 30 |
| 沉默时长 | 25 |
| 客户健康度 | 20 |
| 机会金额×概率 | 15 |
| 主管标记 | 10 |

## 排序规则
- 总分 = Σ（维度分 × 权重）
- 取 Top 5
- 同分按"承诺到期度"二级排序

## 风险标签生成规则
- 承诺到期度 ≥ 80：标"承诺即将到期"
- 沉默 ≥ 48 小时且 < 168：标"48h 未响应"
- 健康度环比下降 ≥ 20%：标"客户健康度 ↓"
- A4 Handoff Pending：标"Handoff 待处理"
- 主管标记：标"主管标记"

## 数据来源
- 完整 ≥10 维 + ≥30 类风险标签在 Pack A 商业版
- 4 周 pilot 验证后调整权重

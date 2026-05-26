---
status: active
owner: helm-core
created: 2026-04-27
review_after: 2026-07-26
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement Phase 3 Runtime Enablement Review V1

更新时间：2026-04-27
状态：Phase A planning（仅文档；尚未实现 thin read-model adapter、feature flag、invariant guard、AdvancementJudgement evidenceChain 落库；5 角色 Required Reviewer approval 尚未启动）
适用范围：Phase 3 runtime adoption 在五月窗口的受限解禁范围、6 项硬前置、回滚剧本、度量阈值
实现状态：未实现（解禁动作必须满足全部 6 项硬前置 + 5 角色 approval 后方可触发）

本文件落地 [HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md](../product/HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md) §2.4 决策：**Phase 3 runtime adoption 在五月解禁**。本文件**显式部分覆盖** [HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_V1.md](../product/HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_V1.md) §5.5 中关于「runtime extractor / production query adoption / page 行为变更」的全局禁止条款，但仅在本文件 §一 列出的解禁范围内生效；其余 No-Go 条款继续生效。

---

## 一、解禁范围

### 1.1 允许的运行时接入

仅以下三类信号 + 三类承接面允许在 production query 路径生效：

1. **TPQR-001 / `blocked_decision`**（meeting）— 48h planning threshold，按 [HELM_BUSINESS_ADVANCEMENT_PHASE3B_TPQR001_BLOCKED_DECISION_PLANNING_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3B_TPQR001_BLOCKED_DECISION_PLANNING_V1.md) 的 deterministic 候选形状
2. **TPQR-003 / `overdue_commitment`**（commitment）— read-time `dueDate / status` 派生，按 [HELM_BUSINESS_ADVANCEMENT_PHASE3B_TPQR003_OVERDUE_COMMITMENT_PLANNING_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3B_TPQR003_OVERDUE_COMMITMENT_PLANNING_V1.md)；**绝对不依赖**持久化 `Commitment.overdueFlag` 列作为权威过滤
3. **TPQR-004 / `customer_waiting`**（emailThread）— `merge_and_dedup_by_email_thread_id_after_producers`，TPQR-004-first tie-break，按 [HELM_BUSINESS_ADVANCEMENT_PHASE3B_TPQR004_CUSTOMER_WAITING_PLANNING_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3B_TPQR004_CUSTOMER_WAITING_PLANNING_V1.md)

承接面：

4. **`/mobile` 第一屏 Must Push 段** — 从 read-first 压缩切换到 AdvancementSignal → MustPushItem deterministic adapter 输出
5. **Ask Helm asset capture** — 写入 `MemoryCandidate / SkillSuggestion`，review-first，不外发
6. **`AdvancementJudgement.evidenceChain`** — 复用现有 `AuditEvent.metadata` JSON 字段落库，不引入新表

### 1.2 继续禁止的运行时动作

即使「解禁」也**绝不松动**：

1. **TPQR-002 / `stalled_opportunity`** — 已在 Phase 3A closeout 明确 No-Go，updatedAt 启发式不可靠
2. **TPQR-005 / `tenant_resource stalled_case`** — 已在 Phase 3A closeout 明确 No-Go，仅作 evidence-freshness 不作 human-inactivity
3. **Schema 扩张** — 任何新表 / 新列 / 新 enum 值变更需独立专项评审
4. **Official write** / 自动发送 / 自动审批 / 自动结算 / 自动付款
5. **LLM 做最终排序** — LLM 仅承担解释 / 文案 / 压缩；ranking 必须 deterministic
6. **跨 workspace / 跨 tenant 聚合**
7. **SkillSuggestion 自动晋升为 formal skill** — 仍需人工 review-first
8. **Ask Helm 持久化多轮聊天历史** — capture 仅写 candidate，不持久化 conversation
9. **PHASE3 disabled-by-default rollout 之外** — 默认全局 flag 关，仅 allowlist 内 workspace 启用

---

## 二、六项硬前置

解禁触发（即 `BUSINESS_ADVANCEMENT_RUNTIME_ENABLED=true` + workspace 加入 `BUSINESS_ADVANCEMENT_RUNTIME_ALLOWLIST`）必须**全部 6 项**满足，缺一不可。

OPC / founder-led 阶段按 [HELM_FOUNDER_LED_OPC_OPERATING_PROTOCOL.md](../product/HELM_FOUNDER_LED_OPC_OPERATING_PROTOCOL.md) 执行：内部 docs、disabled scaffold、reserved dogfooding 准备可以用 founder decision packet 覆盖 5 个评审视角；但真实 public trial workspace、production query adoption、客户数据、隐私和公开 claim 仍必须满足本节硬前置，不能用 founder self-approval 替代 redacted live evidence 或独立审查。

### 2.1 Redacted live DB calibration 证据

1. 来自真实云端试用环境的 redacted snapshot
2. 覆盖 meeting / commitment / emailThread 三类源
3. 数据量充足：每类 ≥ 50 行有效样本
4. calibration evaluator 跑过：top-5 命中率 ≥ 70%、deterministic ordering 100% 稳定、boundary 违规 = 0
5. 证据存档：`docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_REDACTED_LIVE_CALIBRATION_REPORT_V1.md`（Week 1 末输出）

### 2.2 5 角色 Required Reviewer approval

按 [HELM_BUSINESS_ADVANCEMENT_REQUIRED_REVIEWER_APPROVAL_PROTOCOL_V1.md](../product/HELM_BUSINESS_ADVANCEMENT_REQUIRED_REVIEWER_APPROVAL_PROTOCOL_V1.md) 的 canonical 5 角色：

1. Engineering Lead — 实现质量与代码边界
2. Product Owner — 产品判断质量与 demo 一致性
3. Security Reviewer — invariant 守卫、capability matrix、audit completeness
4. Operations Lead — 灰度策略、rollback 演练、观测覆盖
5. Data Protection Officer — Ask Helm capture 的 privacy / retention 合规

每条 approval 必须绑定：

- 同一 planVersion = 本文件 V1
- reviewer user id
- capability proof
- decision = `approved`（不接受 `conditional` 或 `rejected`）
- risk notes
- timestamp

OPC overlay 下的解释：

1. `Founder Self-Approve` 只适用于 planning、synthetic、offline、disabled scaffold，不满足 production adoption。
2. `Founder Approval + Evidence Gate` 可以推进到 allowlist-ready / manual review，但 `productionAdoptionAllowed` 与 `runtimeIntegrationAllowed` 仍为 `false`。
3. `Independent Review Required` 才能进入真实 public trial 或 production data 相关决策；founder 是最终 DRI，但不能把缺失的 security / data protection / legal review 静默视为已完成。

### 2.3 Disabled-by-default rollout

1. `lib/feature-flags.ts` 新增 `BUSINESS_ADVANCEMENT_RUNTIME_ENABLED`，默认 `false`
2. 新增 `BUSINESS_ADVANCEMENT_RUNTIME_ALLOWLIST`，默认空数组
3. 解禁后第一阶段：仅 Helm 团队 reserved tenant workspace 进入 allowlist（dogfooding）
4. 第二阶段：1-2 个外部 pilot workspace 显式 opt-in
5. 全量开启需要**单独**的 Required Reviewer approval，不在本文件覆盖范围

### 2.4 Rollback proof

Week 4 演练以下完整链路至少 1 次：

1. 启用 flag → 触发 invariant violation（mock 一个 persisted overdueFlag = true 但 dueDate 在未来的 commitment）
2. Adapter 检测到违反 → throw + audit + 自动降级到 read-first
3. 关闭 flag → workspace 数据回到 read-first 状态
4. 验证：用户看到的 `/mobile` Must Push 段无错误数据
5. 演练记录存档：`docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_ROLLBACK_DRILL_REPORT_V1.md`

### 2.5 Audit completeness

每条 active Must Push 的生成路径必须有完整可回放的 evidence chain：

1. `AdvancementJudgement.evidenceChain` 字段（写入 `AuditEvent.metadata` JSON）
2. 包含：source row id、evidence hash、adapter version、threshold rule、boundary check result
3. Audit 写入失败 → adapter 不输出该 Must Push（不允许「无 audit 的 active Must Push」）
4. 任意时间点可通过 workspaceId + judgementId 回放完整 reasoning

### 2.6 Boundary regression test

`scripts/decision-first-boundary-check.ts` 新增以下规则：

1. 阻止 PR 引入对持久化 `Commitment.overdueFlag` 列的权威过滤
2. 阻止 PR 让 LLM 输出影响 ranking 顺序
3. 阻止 PR 引入跨 workspace / 跨 tenant 聚合
4. 阻止 PR 把 `SkillSuggestion` 自动晋升路径
5. 阻止 PR 让 Ask Helm 持久化多轮 conversation
6. 阻止 PR 在共享层引入 hardcoded tenant slug 字符串

---

## 三、五月解禁路线（与 launch plan §三 对齐）

### Week 1（4/28 – 5/4）— 解禁前置

1. 在 dev / staging MySQL 上跑 `scripts/business-advancement-phase3p-redacted-snapshot-collector.ts`
2. 跑 Phase 3O calibration evaluator
3. 输出 [HELM_BUSINESS_ADVANCEMENT_PHASE3_REDACTED_LIVE_CALIBRATION_REPORT_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3_REDACTED_LIVE_CALIBRATION_REPORT_V1.md)（待创建）
4. 5 角色 Required Reviewer 候选名单起草 — 框架已在 [HELM_PHASE3_REQUIRED_REVIEWER_CANDIDATE_FRAMEWORK_V1.md](./HELM_PHASE3_REQUIRED_REVIEWER_CANDIDATE_FRAMEWORK_V1.md) 落地；owner 填入 §2.1-2.5 的 candidate slot 与 §3.2 conflict-of-interest 自检
5. 第一次 Required Reviewer 评审会（启动会，对齐范围与前置）— 节奏与输入 / 输出见框架文 §四

### Week 2（5/5 – 5/11）— Adapter 实现

6. `features/business-advancement/runtime/thin-read-model-adapter.ts`：TPQR-001/003/004 deterministic ranking 接到 `data/queries.ts`
7. `lib/feature-flags.ts`：`BUSINESS_ADVANCEMENT_RUNTIME_ENABLED` + `BUSINESS_ADVANCEMENT_RUNTIME_ALLOWLIST`
8. Invariant 守卫（违反时 throw + audit）
9. `AdvancementJudgement.evidenceChain` 落 `AuditEvent.metadata`
10. `scripts/decision-first-boundary-check.ts` 新增 6 条规则

### Week 3（5/12 – 5/18）— 接入 + 第二次评审

11. `/mobile` 第一屏 Must Push 切换数据源（feature flag 控制）
12. Ask Helm asset capture 写入 candidate
13. 第二次 Required Reviewer 评审（基于 Week 1-2 evidence）

### Week 4（5/19 – 5/25）— 灰度 + 演练

14. Helm 团队 reserved tenant 打开 flag dogfooding 一周
15. Rollback proof 演练 + 报告
16. MySQL 1020 hardening 收口
17. 1-2 个外部 pilot workspace opt-in 准备

### Week 5（5/26 – 5/31）— 最终评审 + 发布

18. 第三次（最终）Required Reviewer 评审 → approve allowlist
19. 公开发布说明明确写解禁范围与不松动的边界
20. 观测看板上线：`must_push_quality_daily_report`

---

## 四、回滚剧本

任意一条触发 → 立即执行回滚动作：

| 触发条件 | 立即动作 | 后续 |
|---|---|---|
| Invariant violation ≥ 1 次 | 关闭 `BUSINESS_ADVANCEMENT_RUNTIME_ENABLED` flag | 复盘 + 修复守卫 + 重新走 Required Reviewer approval |
| MySQL 1020 trace 回归 | 关闭 flag + 暂停 `AuditEvent.metadata` 写入 | hardening + 重新演练 |
| Top-5 命中率跌破 50% | 关闭 flag | 重新跑 calibration |
| Boundary regression test 失败 | 阻止 PR merge | 修复 PR 或回退动作 |
| 任意 5 角色 approval 撤回 | 关闭 flag | 等待 approval 恢复 |
| 用户投诉 Must Push 错误 ≥ 3 次 | 关闭 flag + 启动事件分析 | 复盘 + 修复 + 重新演练 |

---

## 五、度量阈值

### 5.1 解禁前必须达到

1. Calibration top-5 命中率 ≥ 70%
2. Deterministic ordering 100% 稳定（输入反转下 ordering 一致）
3. Boundary 违规计数 = 0
4. Audit 写入成功率 ≥ 99.9%
5. Rollback 演练成功 1 次

### 5.2 解禁后持续监控

1. 每天产出 `must_push_quality_daily_report`：top-5 命中率、ordering 稳定性、boundary 违规计数、rollback 触发计数
2. 周度 review：5 角色 approval 团队 review 上周报告
3. 月度 review：是否扩大 allowlist 或全量开启（需独立 Required Reviewer approval）

---

## 六、与既有文档的关系

1. [HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md](../product/HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md) §2.4：本文件是该决策的详细落地
2. [HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_V1.md](../product/HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_V1.md) §5.5：本文件**显式部分覆盖**其 runtime adoption 全局禁止条款（仅限本文件 §一 范围）
3. [HELM_BUSINESS_ADVANCEMENT_REQUIRED_REVIEWER_APPROVAL_PROTOCOL_V1.md](../product/HELM_BUSINESS_ADVANCEMENT_REQUIRED_REVIEWER_APPROVAL_PROTOCOL_V1.md)：5 角色 approval 协议（继承）
4. [HELM_BUSINESS_ADVANCEMENT_PRODUCTION_QUERY_ADOPTION_PLAN_V1.md](../product/HELM_BUSINESS_ADVANCEMENT_PRODUCTION_QUERY_ADOPTION_PLAN_V1.md)：production query adoption 前置（继承）
5. [HELM_BUSINESS_ADVANCEMENT_REDACTED_REAL_DATA_CALIBRATION_PACKAGE_V1.md](../product/HELM_BUSINESS_ADVANCEMENT_REDACTED_REAL_DATA_CALIBRATION_PACKAGE_V1.md)：calibration 包合同（继承）
6. Phase 3B TPQR-001/003/004 三份 planning 报告（继承）
7. [AGENTS.md](../../AGENTS.md) §6 / §13：长期硬边界（仅本文件 §一 范围内的项被部分覆盖；其余继续生效）

---

## 七、五月落地 checklist

- [x] Week 1：本文件起草完成
- [x] Week 1：5 角色 Required Reviewer 候选名单**框架**起草（[HELM_PHASE3_REQUIRED_REVIEWER_CANDIDATE_FRAMEWORK_V1.md](./HELM_PHASE3_REQUIRED_REVIEWER_CANDIDATE_FRAMEWORK_V1.md)）；具体人名待 owner 填入
- [ ] Week 1：redacted snapshot 输出
- [ ] Week 1：calibration evaluator 跑过 + 报告
- [ ] Week 2：thin read-model adapter 实现
- [ ] Week 2：feature flag 接入 + invariant 守卫
- [ ] Week 2：AdvancementJudgement.evidenceChain 落 AuditEvent.metadata
- [ ] Week 2：boundary check 6 条新规则
- [ ] Week 3：`/mobile` Must Push 切换数据源
- [ ] Week 3：Ask Helm asset capture 落 candidate
- [ ] Week 3：第二次 Required Reviewer 评审
- [ ] Week 4：dogfooding 一周
- [ ] Week 4：rollback proof 演练 + 报告
- [ ] Week 4：MySQL 1020 hardening 收口
- [ ] Week 5：第三次（最终）Required Reviewer 评审
- [ ] Week 5：观测看板上线
- [ ] Week 5：公开发布

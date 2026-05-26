---
status: active
owner: helm-core
created: 2026-04-27
review_after: 2026-07-26
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Phase 3 Required Reviewer Candidate Framework V1

更新时间：2026-04-27
状态：Planning-only（候选名单框架；具体人名待 owner 填入）
适用范围：Phase 3 runtime adoption 五月受限解禁所需的 5 角色 Required Reviewer approval

---

## 一、本文件的定位

本文件是 Phase 3 runtime adoption 解禁前，5 角色 Required Reviewer 候选名单的**起草工作面**。

它不替代以下既存文档：

- [HELM_BUSINESS_ADVANCEMENT_REQUIRED_REVIEWER_APPROVAL_PROTOCOL_V1.md](../product/HELM_BUSINESS_ADVANCEMENT_REQUIRED_REVIEWER_APPROVAL_PROTOCOL_V1.md) — canonical 5 角色定义、approval record contract、required checks、revocation rules
- [HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ENABLEMENT_REVIEW_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ENABLEMENT_REVIEW_V1.md) — 解禁范围、6 项硬前置、回滚剧本

本文件只解决一件事：**把 5 个 canonical role 各自的"什么人能担任、不能担任、需要什么背景与权限、需要承诺什么时间投入"写清楚，并把候选 slot 留出来供 owner 填入**。

---

## 二、5 个 canonical role 的候选要求

每个 role 一个表，按 `必备 / 优先加分 / 否决条件 / 时间承诺` 四档列。

### 2.1 Engineering Lead

**职责（来自 Protocol §2）**：查询 seam、rollback、disable、observability、implementation feasibility。

| 维度 | 标准 |
| --- | --- |
| 必备 | (a) 能读懂 `data/queries.ts`、`lib/extensions/registry.tsx`、Phase 3 thin read-model adapter 实现；(b) 能独立判断 feature flag + invariant guard 是否真正保护了主路径；(c) 在 Helm 仓库有过至少一次跨多模块的 hardening / refactor PR 经历 |
| 优先加分 | (d) 熟悉 Prisma schema 与 read-model 边界；(e) 熟悉 Next.js App Router 服务端缓存语义；(f) 在过往评审中曾正确识别"看似无害实则破坏 invariant"的边界违反 |
| 否决条件 | (x) 本人是 Phase 3 thin read-model adapter 的主要实现者（避免自我评审，需要他人独立检视）；(y) 本人对 Helm 主干代码不熟悉，需现场 ramp-up |
| 时间承诺 | 3 次评审会 × 1.5h + 每次会前 readout / evidence 阅读 ~2h = 总计 ~10h 跨 5 周 |

**候选 slot**（owner 填入）：

```yaml
role: Engineering Lead
primary:
  name: <TBD>
  email: <TBD>
  workspace_user_id: <TBD>
  has_no_conflict: <yes | no — 与 implementation 无直接 ownership>
  evidence_of_capability:
    - <例如：PR 链接 / 历史评审记录>
backup:
  name: <TBD>
  email: <TBD>
```

---

### 2.2 Product Owner

**职责**：产品边界、Must Push 体验、用户价值与非目标。

| 维度 | 标准 |
| --- | --- |
| 必备 | (a) 能用产品语言独立讲清「Must Push 是建议不是承诺」「receipt-driven advancement 不是 auto-execution」的区别；(b) 在 Helm 产品队列里有 final-call 权（能说"这个不要做"）；(c) 熟悉受控试点姿态与四类短表（已成立 / 已成形但仍需下一层 / 刻意未做 / 风险） |
| 优先加分 | (d) 在历史 sprint 中有过把"看起来值得做"的功能否决并写入"刻意未做"档的记录；(e) 同时熟悉中国市场客户口径与全球版本叙述 |
| 否决条件 | (x) 把 recommendation 与 commitment 边界视为可协商；(y) 期待 Helm 演进到 marketplace / orchestration / auto-execution |
| 时间承诺 | 3 次评审会 × 1.5h + 每次会前 demo 体验与产品对齐 ~2h = 总计 ~10h |

**候选 slot**：

```yaml
role: Product Owner
primary:
  name: <TBD>
  email: <TBD>
  workspace_user_id: <TBD>
  has_no_conflict: <yes | no>
  evidence_of_capability:
    - <例如：历史 sprint 决策、demo 评审记录>
backup:
  name: <TBD>
```

---

### 2.3 Security Reviewer

**职责**：membership、capability、object-read、official write、execution boundary。

| 维度 | 标准 |
| --- | --- |
| 必备 | (a) 熟悉 Helm 当前的 `judgement-first` / `decision-first` / `controlled-trial` 边界；(b) 能独立判断「invariant guard 是否对 schema 扩张、官方写、跨 workspace 聚合、自动晋升、聊天历史持久化具备否决能力」；(c) 在 OWASP Top 10 + 最小权限 + audit completeness 三个维度都能独立提出问题 |
| 优先加分 | (d) 熟悉 plugin runtime sandbox 缺位的实际暴露面；(e) 在历史评审中曾识别 capability matrix 漏洞或 audit 链断裂 |
| 否决条件 | (x) 与 Engineering Lead 是同一人（违反职责分离）；(y) 本人参与了 invariant guard 的实现且未经过他人独立验证 |
| 时间承诺 | 3 次评审会 × 2h（security 评审通常更长）+ 每次会前 capability proof / audit log review ~3h = 总计 ~15h |

**候选 slot**：

```yaml
role: Security Reviewer
primary:
  name: <TBD>
  email: <TBD>
  workspace_user_id: <TBD>
  has_no_conflict: <yes | no>
  evidence_of_capability:
    - <例如：past security review reports / threat model contributions>
backup:
  name: <TBD>
```

---

### 2.4 Operations Lead

**职责**：reviewer capacity、incident handling、pilot rollout、rollback owner。

| 维度 | 标准 |
| --- | --- |
| 必备 | (a) 在 Helm 团队（或其代行团队）真实承担 oncall / incident response 职责；(b) 能在 30 分钟内独立判断「rollout 是否需要回滚」并执行；(c) 熟悉 feature flag + allowlist 切换的真实操作链路（不是文档里的） |
| 优先加分 | (d) 已经主持过至少一次 dogfooding 或 pilot rollout；(e) 熟悉阿里云 cn-hangzhou 部署面的真实 incident 路径 |
| 否决条件 | (x) 本人是 rollback 唯一 owner（必须有 ≥2 名能执行回滚的人，避免单点）；(y) 本人无法在工作时间外承担紧急回滚责任 |
| 时间承诺 | 3 次评审会 × 1.5h + 每周 dogfooding 监控 ~3h × 5 周 = 总计 ~20h（最重） |

**候选 slot**：

```yaml
role: Operations Lead
primary:
  name: <TBD>
  email: <TBD>
  workspace_user_id: <TBD>
  has_no_conflict: <yes | no>
  evidence_of_capability:
    - <例如：oncall rotation membership、past incident postmortems>
backup:
  name: <TBD — 必须存在；不允许单点 rollback owner>
```

---

### 2.5 Data Protection Officer

**职责**：redaction、PII、reserved tenant、export、deletion、retention。

| 维度 | 标准 |
| --- | --- |
| 必备 | (a) 熟悉公开试用数据政策（30 天 active + 7 天 grace + 物理删除）；(b) 能独立判断「Ask Helm interaction asset 写入 MemoryCandidate / SkillSuggestion 是否触发新的 PII / retention 风险」；(c) 与法务有沟通通道（不一定是法务本人） |
| 优先加分 | (d) 在 GDPR / 个人信息保护法 / 阿里云 sub-processor 实名 / KMS 三个领域有判断能力；(e) 熟悉 redacted live DB calibration 的脱敏标准与抽样方法论 |
| 否决条件 | (x) 与 Security Reviewer 是同一人（职责重叠但视角不同，需要分离）；(y) 本人在 Phase 3 实现链路上参与了任何 PII handling 代码 |
| 时间承诺 | 3 次评审会 × 1.5h + 与法务的对齐 ~3h + retention drill 旁观 ~2h = 总计 ~10h |

**候选 slot**：

```yaml
role: Data Protection Officer
primary:
  name: <TBD>
  email: <TBD>
  workspace_user_id: <TBD>
  has_no_conflict: <yes | no>
  evidence_of_capability:
    - <例如：privacy review history、legal alignment records>
legal_contact:
  name: <TBD — 与 DPO 沟通的法务接口人>
  email: <TBD>
backup:
  name: <TBD>
```

---

## 三、跨 role 通用规则

### 3.1 角色互斥（基于 Protocol §6 invalid conditions 与 §2 capability requirements）

| 不能同时担任 | 原因 |
| --- | --- |
| Engineering Lead × Security Reviewer | 职责分离；implementation 与 capability boundary 必须独立检视 |
| Security Reviewer × Data Protection Officer | 视角不同：security 看代码层 capability matrix，DPO 看数据层 retention / PII；同一人会丢失对照 |
| 任何一个 role × 该 role 所评审范围的主要实现者 | 自我评审违反独立性 |
| Operations Lead × 仅唯一 rollback owner | 必须有 ≥2 名能执行回滚的人 |

允许一人担任多个 role 的情况：**没有**。Phase 3 解禁要求 5 个不同的 reviewer user id（Protocol §5 `reviewer.user_id` 唯一性约束）。

### 3.2 Conflict-of-interest 自检清单

每位候选人在签署第一次 approval record 前，必须自检并书面声明：

1. 我没有在 Phase 3 thin read-model adapter / invariant guard / AdvancementJudgement.evidenceChain / Ask Helm asset capture 任一实现链路上提交过实质代码（PR、commit、自动化生成除外）。
2. 我没有在过去 30 天内拒绝任何与上述实现相关的内部讨论或评审请求。
3. 我没有任何商业 / 客户 / 合伙关系会因 Phase 3 解禁触发或不触发而获益。
4. 我能在评审窗口内独立判断、独立反对，且不会被实现侧的进度压力左右。

未通过任一条 → 该候选人不应担任对应 role；改由 backup 替补，或重新提名。

### 3.3 Workspace membership 与 capability 要求

按 Protocol §7：

- 每位 reviewer 必须是当前 Helm reserved workspace 的有效成员（`workspaceClass=HELM_RESERVED`）
- `WorkspaceRole` 必须满足该 role 实际职责所需的 capability（Engineering / Security / Operations 至少 `OWNER` 或 `ADMIN`；Product / DPO 至少 `MANAGER`）
- 不接受跨 workspace 临时成员或外部 consultant 直接担任 reviewer

### 3.4 不接受 conditional approval

按 Protocol §4，`conditional` 一律视为未批准。如果某 role 准备出 conditional，必须在评审会上把"条件"具体化、要求实现侧落地、然后**重新走完整 approval 流程**。

---

## 四、3 次评审会议节奏

| Meeting | 触发时机 | 输入 evidence | 输出 |
| --- | --- | --- | --- |
| **Kickoff（Week 1）** | 5 位 reviewer 候选人确认到位 | 本文件 + Phase 3 enablement review V1 + redacted live DB calibration 起跑姿态 | 5 位 reviewer 对范围、前置条件、时间承诺达成一致；conflict-of-interest 自检书面提交 |
| **Mid-cycle（Week 3）** | Week 1-2 implementation evidence 到位（thin read-model adapter / feature flag / invariant guard / `AdvancementJudgement.evidenceChain` 落库 / redacted calibration 跑批结果） | 实现侧 PR + 调用链 + 6 项硬前置 status table + redacted snapshot | 各 role 给出"目前是否准备好进入 final approval" → 二选一：`Ready-For-Final` 或 `Need-More-Evidence` |
| **Final（Week 5）** | Week 3-4 dogfooding + rollback drill 结果 + Week 5 安全收尾 + 最终验证链 | 完整 implementation evidence + AGENTS.md §10 跑批结果 + retention drill 录像 + capability matrix 对照表 | 5 位 reviewer 各自落 `approved` / `rejected` 决定。仅当全部 5 票 `approved` 同一 planVersion，gate 解锁为 `Ready-For-Manual-Review`（注意：仍不等于 `productionAdoptionAllowed=true`，per Protocol §4） |

**会议纪要必须落到 audit log（Protocol §8）**。每次会议产生一条 `RequiredReviewerMeetingHeld` audit event，绑定 meeting id + 5 位 reviewer 出席记录。

---

## 五、Approval record 提交模板

每位 reviewer 在 Final 会议结束后 24 小时内提交一份 record，存入 `RequiredReviewerApprovalRecord` 审计表（schema 已存在）。

```yaml
approvalRecordId: <UUID v4>
planId: HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ENABLEMENT_REVIEW_V1
planVersion: V1
reviewMeetingHeld: true
governanceSignoffObtained: true
approvals:
  - role: Engineering Lead
    reviewerUserId: <workspace user id>
    approvedPlanVersion: V1
    decision: approved
    capabilityProof:
      workspaceMembershipConfirmed: true
      reviewerCapabilityConfirmed: true
      noConflictDeclared: true
    riskNotes: |
      <text — at minimum acknowledge the 6 hard prerequisites status>
    signedAtIso: <2026-05-XXTHH:MM:SS.000Z>
  - role: Product Owner
    ...
  - role: Security Reviewer
    ...
  - role: Operations Lead
    ...
  - role: Data Protection Officer
    ...
```

---

## 六、Owner 行动清单（按时间）

按 [HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md §三](../product/HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md) 的 Week 切分：

- [ ] **Week 1（5/4 截止）**：填入 §2.1-2.5 的所有 candidate slot；发出 kickoff 会议邀请；收齐 5 位 conflict-of-interest 自检；记录在本文件
- [ ] **Week 1**：召开 Kickoff 会议；产生 `RequiredReviewerMeetingHeld` audit event #1
- [ ] **Week 3（5/18 截止）**：召开 Mid-cycle 会议；如有 `Need-More-Evidence` 反馈，落入实现侧 backlog；产生 audit event #2
- [ ] **Week 5（5/30 截止）**：召开 Final 会议；5 位 reviewer 24 小时内提交 approval record；gate 解锁判断；产生 audit event #3
- [ ] **解锁后**：第一阶段 allowlist 仅 Helm reserved workspace（dogfooding）；扩展到外部 pilot 需要**新的** Required Reviewer approval（Protocol §3 不在本文件覆盖）

---

## 七、本文件的迭代规则

- **不接受**：在 Final 会议前一周修改本文件中已确认的 candidate 名单（除非有人退出 / 新增冲突，且必须重新走 §3.2 自检并书面记录变更原因）
- **可接受**：随实现进展更新各 role 的 evidence_of_capability 字段
- **必须**：任何 candidate 变更同步更新 [HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ENABLEMENT_REVIEW_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ENABLEMENT_REVIEW_V1.md) 的 §2.2 引用

---

## 八、长期硬边界继承

本文件继承 Phase 3 enablement review V1 的全部硬边界。包括但不限于：

- approval record 不能解除 redacted real-data calibration 缺失
- approval record 不能解除 No-Go 条款（schema 扩张、official write、跨 workspace 聚合等）
- 任意 5 角色 approval 撤回 → 关闭 `BUSINESS_ADVANCEMENT_RUNTIME_ENABLED` flag
- Reviewer 不能替代 audit completeness、不能替代 boundary regression test

任何对硬边界的扩张请求 → 走独立的 Required Reviewer approval（Protocol §3 不在本文件覆盖）。

---
status: draft
owner: 创始人 / 工程
created: 2026-04-30
review_after: 2026-05-14
archive_trigger:
  - Pack A 技术实现 PRD / API contract / migration plan 拆分完成并替代本文档后 30 天归档
  - Pack A 不再作为首批商业化 Pack 时归档
audit:
  - 与 docs/sales/packs/PACK_A_B2B_SAAS_REVENUE_PUSH_RESEARCH_V2.md §6 4 Skill 详细设计对齐
  - 与 docs/product/HELM_PACK_SKILL_DUAL_LAYER_SPEC_V1.md §3-§7 双层结构 + 三级加载对齐
  - 与 docs/product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md §5/§6 开源/商业边界对齐
  - 与 docs/research/competitor/OPENCLAW_TECHNICAL_DEEP_DIVE_V1.md §8 借鉴决策对齐
  - 与 lib/helm-v2/* worker 家族的脱敏行业样板经验对齐
  - 与 features/* 工作区路由所有权（CLAUDE.md "app/ 是当前路由所有者"）对齐
freeze_status: 待 Pack A V2.5（实测 token 开销）+ 首批 design partner pilot 启动后冻结
---

# Pack A 技术规范 V1

## 1. 目的与范围

### 1.1 目的
为 Pack A（B2B SaaS 销售推进）的内核 worker 实现、API 表面、数据模型、连接器接入提供工程级规范。本文件是 **Pack A 商业版工程蓝图**，与 Pack A V2 调研定位需求文档配对落地。

**当前状态：** 本文件是目标技术规范，不代表 `app/api/skills/pack-a/*`、`lib/helm-v2/pack-a/*`、Pack A Prisma migration、Docker worker runtime 或 CRM 双向写入已经实现。任何实现必须另起 PRD / API contract / migration plan，并通过独立代码评审。

### 1.2 范围
| 在 | 不在 |
|---|---|
| 4 Skill 的 worker 接口与生命周期 | 具体业务逻辑实现细节（在 worker 仓库中） |
| API 表面（REST 端点 + payload schema） | 前端 UI 实现 |
| 数据模型与状态机 | 数据库 DDL（在 prisma migration 中） |
| 连接器接入契约 | 连接器具体厂商 API 集成（在 lib/connectors/） |
| 治理边界（推荐/承诺/audit chain）的工程落地 | LLM prompt 工程细节（在 prompt-registry 中） |

## 2. 架构鸟瞰

### 2.1 Pack A 在 Helm v2 架构中的位置
```
                   ┌─────────────────────────────────┐
                   │ Helm Workspace UI（features/*）  │
                   └─────────────┬───────────────────┘
                                 │
                   ┌─────────────▼───────────────────┐
                   │ Pack A API 路由（目标路径，待实现）│
                   └─────────────┬───────────────────┘
                                 │
        ┌────────────────────────▼────────────────────────┐
        │ Pack A Worker Orchestrator（目标路径，待实现）    │
        ├──────────┬───────────┬───────────┬──────────────┤
        │ A1 worker│ A2 worker │ A3 worker │ A4 worker    │
        │ Meeting  │ Priority  │ Manager   │ Handoff      │
        │ Followup │ Customers │ Attention │ Pack         │
        └────┬─────┴─────┬─────┴─────┬─────┴─────┬────────┘
             │           │           │           │
        ┌────▼───────────▼───────────▼───────────▼────────┐
        │ Helm v2 Core Runtime（lib/helm-v2/*）            │
        │ - Object Graph                                   │
        │ - MemoryItem                                     │
        │ - ArtifactBundle                                  │
        │ - Approval Matrix（推荐/承诺）                    │
        │ - Audit Chain                                    │
        │ - Eval Harness                                   │
        └────┬─────────────────────────────────────────────┘
             │
        ┌────▼─────────────────────────────────────────────┐
        │ Connectors（lib/connectors/*）                   │
        │ - 飞书 / 钉钉 / 企微（会议 + IM）                 │
        │ - CRM（销售易 / 纷享 / SFDC 中国版）              │
        │ - 邮箱 IMAP                                       │
        └──────────────────────────────────────────────────┘
```

### 2.2 借鉴 OpenClaw 的部分（与单租户假设区分）
| 借鉴 | Pack A 设计目标 |
|---|---|
| SKILL.md 三级加载 | Pack A 启动时注入 4 Skill L1 名片（≤500 tokens） |
| Tool policy 配置化 | pack.config.yaml 的 connectors / permissions 字段 |
| Sandbox 默认 Docker | 商业版 Pack 目标运行形态；当前仓库不宣称已实现 Docker worker runtime |
| Audit chain 字段 | traceId / workspaceId / skillId / decision / reason（多租户必带 workspaceId） |

### 2.3 与 OpenClaw 的明确区分（Helm 独有）
| Helm 特征 | OpenClaw |
|---|---|
| 工作区多租户（必带 workspaceId） | 单租户假设 |
| 推荐 vs 承诺边界（默认所有对外动作要复核） | 默认在沙箱内自动执行 |
| 不掉案件 invariant（worker 强制） | 无 |
| Worker 家族编排（A1→A4 联动） | Brain-led ReAct 循环 |

## 3. 4 Skill Worker 设计

### 3.1 通用 Worker 接口

所有 Pack A worker 目标实现统一接口（TypeScript 定义目标路径：`lib/helm-v2/pack-a/types.ts`，当前未实现）：

```typescript
interface PackASkillWorker<TInput, TOutput> {
  skillId: 'A1' | 'A2' | 'A3' | 'A4';
  
  // 触发入口
  onTrigger(event: SkillTriggerEvent, ctx: WorkspaceContext): Promise<SkillRun>;
  
  // 主推理
  reason(input: TInput, ctx: WorkspaceContext): Promise<SkillRecommendation<TOutput>>;
  
  // 复核确认（人工 → 系统）
  onApprove(run: SkillRun, approver: Member, ctx: WorkspaceContext): Promise<SkillCommitted<TOutput>>;
  
  // 不掉案件 invariant 校验
  invariantCheck(run: SkillRun): InvariantStatus;
}
```

### 3.2 通用类型

```typescript
interface WorkspaceContext {
  workspaceId: string;
  memberId: string;
  role: 'sales' | 'manager' | 'cs' | 'admin';
  permissions: string[];
  tracing: { traceId: string; parentTraceId?: string };
}

interface SkillRecommendation<T> {
  output: T;
  requires_review: boolean;       // 推荐 vs 承诺边界
  review_reasons: string[];       // 为什么需要复核（如越界承诺）
  audit_trace_id: string;
  invariant_satisfied: boolean;
}

interface SkillCommitted<T> {
  output: T;
  approved_by: string;
  approved_at: ISO8601;
  audit_trace_id: string;
  external_action_dispatched: boolean;
}
```

### 3.3 Skill A1：会议跟进清单 worker

```typescript
interface A1Input {
  meetingId: string;          // 来自 connector 的会议 ID
  workspaceId: string;
  triggeredBy: 'meeting-end' | 'manual';
}

interface A1Output {
  followUpItems: FollowUpItem[];     // 跟进清单
  boundaryFlags: BoundaryFlag[];     // 越界承诺识别
  draftMessages: DraftMessage[];     // 邮件/IM 草稿
  handoffPending: boolean;           // 是否触发 A4 联动
}

interface FollowUpItem {
  owner: string;                     // memberId
  action: string;                    // 跟进动作描述
  dueAt: ISO8601;
  wordingDraft?: string;             // 措辞建议（默认建议）
  cannotCommit: string[];            // 不能承诺什么
}

interface BoundaryFlag {
  meetingClipId: string;             // 会议片段 ID
  originalText: string;              // 原始措辞
  commitmentType: 'function' | 'price' | 'time' | 'integration';
  inScope: boolean;                  // 是否在方案边界内
  recommendedAction: 'rephrase' | 'escalate' | 'manager-review';
}
```

**业务逻辑要点：**
- 输入：会议纪要（来自连接器）+ CRM 商机上下文 + 历史会话记忆
- 推理顺序：纪要 → 跟进清单识别 → 越界承诺识别 → 草稿生成
- 输出 `requires_review: true`（默认）—— 任何对外发送都要销售确认
- 越界承诺识别命中时，自动通知 A3（manager attention）
- 标记成单关键词时，触发 A4 Handoff 候选

### 3.4 Skill A2：今天该跟的 5 个客户 worker

```typescript
interface A2Input {
  workspaceId: string;
  memberId: string;
  date: ISODate;
  refresh: boolean;
}

interface A2Output {
  topCustomers: PriorityCustomer[];  // 取前 5
  totalActiveDeals: number;
  weightsApplied: PriorityWeights;   // 透明可见的权重
}

interface PriorityCustomer {
  customerId: string;
  customerName: string;
  dealStage: string;
  riskTags: ('commitment-due' | 'silence-48h' | 'health-drop' | 'handoff-pending' | 'manager-flag')[];
  suggestedAction: string;
  priorityScore: number;
  rank: number;
}
```

**业务逻辑要点：**
- 推理：5 维度加权（承诺到期度 30 + 沉默 25 + 健康度 20 + 金额×概率 15 + 主管标记 10）
- 取 Top 5
- 输出 `requires_review: false`（清单本身是建议；销售可手工调整顺序）
- 调整原因写入 audit chain 用于权重优化

### 3.5 Skill A3：销售主管会议风险面板 worker

```typescript
interface A3Input {
  workspaceId: string;
  managerId: string;
  date: ISODate;
}

interface A3Output {
  interventions: InterventionSuggestion[]; // 2-3 个
  privateMeetingCount: number;             // 标记为私密的不计入
}

interface InterventionSuggestion {
  meetingId: string;
  meetingTime: ISO8601;
  salesRepId: string;
  customerId: string;
  reason: string;
  reasonCategory: 'boundary-commitment' | 'health-drop' | 'high-value-decision' | 'manager-flag' | 'silent-followup';
  suggestedTiming: 'before-meeting' | 'during-meeting' | 'after-meeting';
  suggestedMethod: '1-1-with-rep' | 'join-meeting' | 'silent-follow';
}
```

**业务逻辑要点：**
- 严格的 `workspace_scope: manager_only`——只有 role === 'manager' 才能调用
- 查询时排除标记为"私密"的会议（治理可配）
- 介入建议是建议，主管自主决定

### 3.6 Skill A4：交付/CS Handoff Pack worker

```typescript
interface A4Input {
  dealId: string;
  workspaceId: string;
  triggeredBy: 'deal-closed' | 'manual';
}

interface A4Output {
  handoffPack: HandoffPack;
  completenessScore: number;       // 0-5
  dualConfirmationStatus: 'pending-sales-mgr' | 'pending-cs-lead' | 'confirmed';
}

interface HandoffPack {
  commitments: { confirmed: Commitment[]; pendingReview: Commitment[] };
  scope: { in: string[]; out: string[]; over: string[] };
  customerProfile: CustomerProfile;  // 仅工作区内可见
  risks: RiskNote[];
  contacts: { salesLead: Contact; clientLead: Contact; decisionMaker: Contact };
}
```

**业务逻辑要点：**
- 必须双确认（销售经理 + CS lead）才进入"正式交接"
- `customer_profile_internal_only: true`——不对外发送
- 完整度评分按 seed/playbook.md 公式

## 4. API 表面

### 4.1 REST 端点（目标路径：app/api/skills/pack-a/...）

以下端点是目标 API 表面，不代表当前仓库已有 route。正式实现前必须先完成权限矩阵、payload schema、rate limit、audit contract 和 E2E contract。

| 路径 | 方法 | 用途 | 权限 |
|---|---|---|---|
| `/api/skills/pack-a/a1-meeting-followup` | POST | 触发 A1 推理 | meeting:read + crm:read |
| `/api/skills/pack-a/a1-meeting-followup/:runId/approve` | POST | 销售确认对外发送 | sales 或 ↑ |
| `/api/skills/pack-a/a2-priority-customers/today` | GET | 获取今日 Top 5 | sales 自身 |
| `/api/skills/pack-a/a2-priority-customers/adjust` | POST | 销售调整排序 | sales 自身 |
| `/api/skills/pack-a/a3-manager-attention/today` | GET | 主管面板 | role === 'manager' |
| `/api/skills/pack-a/a3-manager-attention/:runId/processed` | POST | 标记已处理 | role === 'manager' |
| `/api/skills/pack-a/a4-cs-handoff-pack` | POST | 启动 Handoff | sales-lead 或 ↑ |
| `/api/skills/pack-a/a4-cs-handoff-pack/:runId/confirm` | POST | 双确认 | sales-mgr 或 cs-lead |
| `/api/skills/pack-a/a*/audit/:traceId` | GET | 查 audit 链 | admin 或 owner |

### 4.2 通用响应 schema

```typescript
// 200 OK
{
  runId: string;
  output: <Skill 特定>;
  requires_review: boolean;
  review_reasons: string[];
  audit_trace_id: string;
  invariant_satisfied: true;
}

// 412 Precondition Failed（不掉案件 invariant 失败）
{
  error: 'invariant_violation';
  detail: 'case-no-drop check failed';
  trace: string;
}

// 422 Unprocessable Entity（业务边界拒绝）
{
  error: 'recommendation_only_violation';
  detail: 'Direct external action attempted without approval';
}
```

### 4.3 私密会议机制

```typescript
// POST /api/meetings/:meetingId/mark-private
{
  reason: string;       // 写入 audit chain
}

// 标记后 A1 不生成跟进清单；A3 不显示
// 创始人级别可审计标记滥用率
```

## 5. 数据模型

### 5.1 Object Graph 节点

设计上对齐 Helm v2 object graph / memory / artifact 概念。以下节点是 Pack A 目标对象清单，不代表当前 Prisma schema 已有同名表或字段：

| 节点类型 | 关键字段 | 来源 |
|---|---|---|
| Meeting | id, workspaceId, customerId, attendees, recordingUrl, transcript, isPrivate | connector 同步 |
| Customer | id, workspaceId, name, healthScore, stage, owner | CRM 同步 |
| Deal | id, customerId, amount, probability, stage, expectedCloseDate | CRM 同步 |
| Commitment | id, dealId, type, originalText, inScope, status | A1 识别 + A4 累积 |
| FollowUpItem | id, meetingId, owner, action, dueAt, wordingDraft, status | A1 产出 |
| HandoffPack | id, dealId, commitments, scope, customerProfile, dualConfirmationStatus | A4 产出 |
| InterventionSuggestion | id, meetingId, managerId, reason, processed | A3 产出 |

### 5.2 MemoryItem
- 客户性格画像（A4 用）
- 历史承诺库（跨 deal 聚合）
- 主管历史标记
- 销售调整 priority 顺序的原因（A2 学习用）

### 5.3 ArtifactBundle
- 跟进邮件草稿（A1）
- Handoff Pack 文档（A4）
- 主管面板 readout（A3）

### 5.4 Approval Matrix（推荐/承诺）
| Skill | 默认 requires_review | 谁可 approve |
|---|---|---|
| A1 跟进清单（清单本身） | false | — |
| A1 对外发送（邮件/IM） | true | 销售本人 |
| A2 Top 5 排序 | false | 销售自调 |
| A3 介入建议 | false | 主管自决 |
| A4 Handoff Pack | true | 销售经理 + CS lead 双确认 |
| 任何越界承诺识别项 | true | 销售经理 |

## 6. 连接器接入

### 6.1 必须连接器
| 连接器 | scope | 用途 |
|---|---|---|
| 飞书会议 / 钉钉会议 / 企微会议 / 腾讯会议 | OAuth + 只读 | A1 触发 + 纪要 |
| 销售易 / 纷享销客 / SFDC 中国版 | API 只读 + 双向 | A2/A4 商机数据；可选写 |
| 邮箱 IMAP | 只读 | A1 历史邮件 |
| 飞书 / 钉钉 / 企微 IM | OAuth + 只读 | A1 沟通历史 |

### 6.2 连接器接入复杂度（与认证工程师服务空间映射）
| 系统 | 接入工时（人天） | 工程师级别 |
|---|---:|---|
| 标准 CRM（官方版） | 1-2 | L1 |
| 定制 CRM | 3-7 | L2 |
| 自建 CRM / 老旧 | 10-20 | L2/L3 + Helm 核心联运 |
| 邮箱 IMAP + 飞书/钉钉 OAuth | 1-2 | L1 |
| 多 BU / 多组织 | 5-10 | L2/L3 |

### 6.3 隐私 / 合规
- 会议录音/纪要 OAuth scope 必须含"客户告知 + 销售确认"双门槛（与 pack.config.yaml privacy 对齐）
- CRM 写入默认关闭，需客户授权后开启
- audit_export retention 90 天

## 7. 治理边界工程落地

### 7.1 推荐 vs 承诺
- 任何 `requires_review: true` 的输出**不允许**直接 dispatch 对外动作
- 目标中间件 `lib/governance/recommendation-guard.ts` 拦截（待实现）
- 违反时返回 422 + 写 audit chain

### 7.2 不掉案件 invariant
- 每个 `SkillRun` 启动时 invariantCheck()
- 案件未 owns / 状态机断裂 / audit chain 缺失 → 拒绝执行
- 违反时返回 412 + 告警

### 7.3 Audit chain
- 必填字段：traceId / workspaceId / memberId / skillId / decision / reason / timestamp
- 90 天保留（可配）
- export API：`GET /api/audit/export?workspaceId=...&from=...&to=...`

### 7.4 多租户隔离
- 所有 worker 入口验证 workspaceId
- 跨工作区数据访问立即拒绝
- 同名 customer 在不同 workspace 必须严格隔离

## 8. 三级加载工程实现

### 8.1 L1 名片注入
启动时把 4 Skill 的 frontmatter（name + description + pack + level）以 XML 包裹注入 LLM 系统 prompt：

```xml
<helm_pack_a>
  <skill id="A1" name="helm-a-meeting-followup" pack="A" level="certified">
    Generate a meeting follow-up list within 5 minutes...
  </skill>
  <skill id="A2" name="helm-a-priority-customers" pack="A" level="certified">
    Daily priority list of 5 customers...
  </skill>
  <skill id="A3" name="helm-a-manager-attention" pack="A" level="certified">
    Manager-only attention panel...
  </skill>
  <skill id="A4" name="helm-a-cs-handoff-pack" pack="A" level="certified">
    Generate handoff pack for delivery/CS...
  </skill>
</helm_pack_a>
```
**目标**：≤500 tokens（按 OpenClaw 公式 195 + 4×97 ≈ 583 上限；优化 description 后预期 ~400）。

### 8.2 L2 完整手册
- 模型判断 Skill 相关时调用 `read_skill_md(skill_id)`
- 目标工程实现：`lib/helm-v2/pack-a/skill-loader.ts`（待实现）
- 缓存：会话级缓存

### 8.3 L3 子资源
- 执行子任务时按需读 `seed/playbook.md` / `seed/templates/*` / `fixtures/*`
- 目标工程实现：`lib/helm-v2/pack-a/seed-loader.ts`（待实现）

## 9. 测试策略

### 9.1 单元测试
- 每个 worker 独立测试（输入 → 输出）
- Mock 连接器
- 不掉案件 invariant 测试

### 9.2 集成测试
- A1 → A3（越界承诺通知）
- A1 → A4（成单 Handoff 候选）
- 多租户隔离测试

### 9.3 Eval Harness
- 复用 lib/helm-v2/eval-harness.ts
- 黄金集：50 个会议样本（脱敏后从客户访谈抽取）
- 每个 Skill 的作业质量门槛（acceptance）作为 regression baseline

### 9.4 E2E
- tests/e2e/pack-a-*.spec.ts
- 4 周 pilot 期间运行回归

## 10. 性能与 token 预算

| 项 | 预算 | 备注 |
|---|---|---|
| L1 注入（启动一次） | ≤500 tokens | 4 Skill 名片 |
| L2 完整 SKILL.md（按需） | ~1,500 tokens / Skill | 模型主动读 |
| L3 seed/fixtures（按需） | ~500-2,000 tokens / 调用 | 子任务时读 |
| A1 单次推理 | ~5,000-15,000 tokens | 含纪要 + CRM 上下文 + 输出 |
| A2 单次推理 | ~3,000-8,000 tokens | 商机批处理 |
| A3 单次推理 | ~2,000-5,000 tokens | 主管面板聚合 |
| A4 单次推理 | ~10,000-30,000 tokens | 整个销售周期总结 |

**优化目标：** Pack A 单工作区单日推理 token 总开销 < 100 万（按 50 销售 × 10 会议 × 5 Skill 调用估算）。

## 11. 多模型供应商策略

### 11.1 默认偏好
```yaml
models:
  preferred: [anthropic, openai, qwen, deepseek]
  fallback: qwen-72b
```

### 11.2 选型原则
- 中文长文本理解：anthropic / qwen 优先
- 结构化推理：anthropic / openai 优先
- 成本敏感（Pack A 的 A2 高频调用）：qwen / deepseek
- **不绑定单一**——按场景路由

### 11.3 路由策略
- A1（会议纪要 + 推理）：anthropic 优先
- A2（结构化批处理）：qwen 优先
- A3（主管聚合 + readout）：anthropic 优先
- A4（深度总结）：anthropic 优先

## 12. 部署与运行

本节描述目标运行形态，不代表当前仓库已经完成云端多租户 Pack A runtime、企业私有化部署、K8s chart 或本地 Docker Pack A basic。

### 12.1 部署形态
| 形态 | 部署 | 适用 |
|---|---|---|
| Helm Cloud | SaaS 多租户 | 默认 |
| Helm Enterprise | 私有化 K8s | ≥¥200K/年客户 |
| 开源版 Pack A basic | 本地 Docker（仅 basic 能力） | 评估用 |

### 12.2 监控
- worker 调用率、成功率、token 开销
- 推荐 vs 承诺边界违反告警
- 不掉案件 invariant 失败告警
- 客户侧"建议未确认"积压告警

## 13. 风险与未决问题

1. **会议纪要质量参差** — 录音转写错误传导到越界承诺识别。**对策**：A1 在低质量纪要时降级为"会议片段提取 + 销售补全"
2. **CRM 双向写入授权链** — 客户授权流程需要法务 review。**对策**：默认仅读，双向是 V1.5 能力
3. **多模型路由的客户透明性** — 客户可能要求"用 X 模型"。**对策**：pack.config.yaml 暴露 `models.locked` 字段
4. **token 预算超预期** — 早期客户量小不显，规模化后会成本压力。**对策**：A2/A3 优先用便宜模型（qwen / deepseek）
5. **不掉案件 invariant 在多 worker 联动时的复杂性** — A1→A3→A4 联动可能"案件状态漂移"。**对策**：每次状态变更必入 audit chain；定期 invariant 自检 cron
6. **私密会议机制被滥用** — 销售可能批量标记私密绕过 A3。**对策**：标记率超阈值告警 + 创始人级审计

## 14. V1 → V1.5 / V2 演进

| 能力 | V1 | V1.5 | V2 |
|---|---|---|---|
| A1 跟进清单 | 目标能力 | 跟进效果回路（已发邮件→客户响应） | 多语言 |
| A2 优先级 | 目标能力 | 权重个性化（每销售一套） | RL 优化 |
| A3 主管面板 | 目标能力 | 团队 readout | 跨团队对标 |
| A4 Handoff | 目标能力 | 双向反馈（CS 给销售评分） | 跨 Pack 联动（与 Pack B 互通） |
| CRM 双向写入 | ❌（仅读） | ✅（需授权） | ✅ |
| 多语言 | 仅中文 | 中英 | + 日韩 |
| 私有化 | ❌ | Enterprise 路径 | 完整 |

## 15. 决策与下一步

**待创始人/工程拍板：**
1. §3 4 Skill worker 接口签名是否就此采用？
2. §4 API 路径前缀 `/api/skills/pack-a/...` 是否符合现有 app/ 路由结构？需 Helm 工程团队验证
3. §5.1 Object Graph 节点列表是否需要补/改（如 ConsentLog 隐私节点）？
4. §10 token 预算是否合理？
5. §11.2 多模型路由策略是否就此采用？

**下一步交付物（拍板后启动）：**
- `lib/helm-v2/pack-a/` 目录结构与 worker stub 实现
- `app/api/skills/pack-a/` 路由 stub
- `prisma/migrations/` Pack A 数据模型 migration
- Pack A 4 周 pilot runbook（即第 4 步交付物）

## 16. 变更记录

| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-04-30 | V1 草稿 | 4 Skill worker 目标接口 + API 目标表面 + 数据模型目标清单 + 治理工程目标 + 三级加载目标实现 + token 预算 + V1→V2 演进 |

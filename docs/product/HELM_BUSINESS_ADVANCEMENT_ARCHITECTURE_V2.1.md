---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm 经营推进架构 V2.1：从问答到经营推进闭环

更新时间：2026-04-26
状态：Superseded for execution by Final Requirements V1 / retained as full reasoning record
作者：基于 V2 与战略评审反馈的重写

当前用途：
- 作为 Helm 下一阶段经营推进架构的专家评审稿
- 保留 V2 → V2.1 的思考路径和关键修正
- 作为 [HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md](./HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md) 的完整思考来源
- 不再作为开工 canonical spec；开工以 Final Requirements V1 和 Implementation Start Plan V1 为准

---

## 文档版本说明

### V2 → V2.1 主要变更

| 变更项 | V2 原表达 | V2.1 修正 | 评审依据 |
|--------|----------|----------|----------|
| **标题** | 从问答到自动化 | 从问答到经营推进闭环 | 自动化不是主线，推进闭环是主线 |
| **核心原则** | 自动化优先 | 推进优先 | 避免覆盖 review-first 和 responsibility |
| **Phase 1** | SKILL 自动执行 | Advancement Signal Contract | 先解决"系统如何知道什么该推进" |
| **Phase 2** | Ask Helm → SKILL 孵化 | Signal → Must Push Adapter | 资源信号应优先于 Skill 自动执行 |
| **Phase 3** | 资源信号 → Must Push | Ask Helm Interaction Asset Capture | Ask Helm 资产化但限制在只读 |
| **Phase 4** | 反馈闭环 | SkillSuggestion Evidence Pipeline | 继续接到 candidate capability |
| **Phase 5** | 用户洞察与协作 | Narrow Skill Execution Pilot | 只做窄场景、低风险、可回滚 pilot |

### V2.1 保留边界

以下 V2 内容在 V2.1 中继续保留，因为符合 current-main positioning：

- ✅ Helm 不是问答工具、搜索引擎、聊天产品、通知中心
- ✅ Ask Helm 互动是经营资产
- ✅ 判断资产/边界资产/需求资产分类
- ✅ 资源接入从数据源变经营信号源
- ✅ Skill 从经营记忆中孵化
- ✅ recommendation != commitment
- ✅ 渐进式扩大授权范围（而非自动化等级）

### V2.1 推迟内容

以下 V2 内容在 V2.1 中推迟，原因标注：

- 🔄 SkillExecutor 自动执行引擎 → 当前缺少 sandbox、policy maturity
- 🔄 自动生成 formal skill → SkillSuggestion 明确不支持
- 🔄 用户关心图谱对团队公开 → 隐私、组织政治风险
- 🔄 组织协作图谱 → 需先做聚合级、脱敏级洞察
- 🔄 A/B 测试 Skill 优化 → 数据量和风险控制不足
- 🔄 高风险自动化 → 不符合 controlled-trial

### V2.1 收口新增约束

以下约束用于防止 V2.1 被误读成实施计划：

| 约束项 | 收口口径 |
|--------|----------|
| 统一对象模型 | 只是 conceptual / planning contract，不是 Prisma schema、API contract 或 queue implementation |
| Phase 1 | 先冻结 contract、fixtures、offline eval，再评估 read-model adapter，不直接写 runtime extractor |
| Ask Helm 资产捕获 | 默认 `user_only + temporary + deletable`，只有 policy / reviewer / boundary 场景允许扩大可见性 |
| `narrow_auto` | Phase 5 reserved posture，Phase 1-4 不可用 |
| 成功指标 | 优先衡量 false positive、采纳率、复核覆盖、边界事故，不以捕获量或自动化率为核心 |

### V2.1 市场化收口

外部调研反馈支持 V2.1 的核心修正：市场正在从单点 copilot / chatbot 转向 agentic workflow、enterprise agent platform、revenue intelligence 和 meeting-to-action，但企业真正缺的是可信的“经营推进判断层”。

因此 V2.1 后续对外表达应固定为：

```text
Helm 是面向经营团队的推进控制台。
它持续识别必须推进的事项，给出证据、边界和建议承接方式，
把经营输入转化为可复核的行动、记忆和可复用能力。
```

这意味着：

- 不和 Salesforce / ServiceNow / Microsoft / Google 正面竞争通用 agent platform。
- 不和 LangGraph / CrewAI 竞争底层 agent orchestration。
- 不和 Gong / Clari 只在 revenue intelligence 品类里竞争。
- 不和 Granola / Otter / Fireflies 只在 meeting notes 或 meeting AI 里竞争。
- Helm 的差异化应落在 `AdvancementSignal -> MustPushItem -> ReviewRequiredAction -> MemoryCandidate / SkillSuggestion` 这条经营推进层。

---

## 一、核心设计哲学

### 1.1 Helm 的本质价值

```text
Helm 不是：
- 问答工具
- 搜索引擎
- 聊天产品
- 通知中心
- 完整 workflow engine
- 完整 agent orchestration 平台
- 完整自动执行平面

Helm 是：
- 经营推进操作系统
- 判断优先的工作台
- 决策优先的信息架构
- 建议/承诺边界的守护者
- 从经营输入到经营记忆的闭环系统
```

### 1.2 人类与 AI/SKILL 的分工

```text
┌─────────────────────────────────────────────────────────────┐
│                    Helm 经营推进系统                         │
│                                                             │
│   目标：推动经营 (Business Advancement)                      │
│                    不是追求自动化本身                        │
│                                                             │
│   推进者：        │                                         │
│   ┌──────────────┴──────────────┐                          │
│   │                              │                          │
│   ▼                              ▼                          │
│ ┌─────────┐                  ┌─────────┐                    │
│ │ 具体人  │                  │ 数字员工│                    │
│ │ Human   │                  │ AI/SKILL│                   │
│ └────┬────┘                  └────┬────┘                    │
│      │                            │                         │
│      │  AI做不了的              │  AI能做的                │
│      │  • 判断方向              │  • 已沉淀的SKILL          │
│      │  • 承担责任              │  • 可准备的建议/草稿       │
│      │  • 系统外对接            │  • 明确规则的判断         │
│      │  • 处理例外              │  • 窄范围低风险执行        │
│      │                            │                         │
│   ───┴────────────────────────────┴───                       │
│      │                        │                             │
│      ▼                        ▼                             │
│  做决策                    提供建议 / 准备草稿                │
│  承担责任                  跟进已定义的流程                   │
│  外部沟通                  受控执行（需要复核）                │
│  处理例外                  遵循规则                           │
│  定义规则                  扩大可复用范围                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘

【V2.1 修正】V2 原表达"有 SKILL 就用 SKILL，没有人就没有人类"
改为上图：强调人类始终负责判断和责任，SKILL 作为受控的执行承接
```

### 1.3 核心原则（V2.1 重写）

```text
【V2.1 修正】V2 原表达"自动化优先"改为以下原则：

1. 推进优先
   系统先识别什么需要推进，再根据风险、证据、权限和复核要求
   决定由人承接、SKILL 准备、SKILL 草稿，还是窄范围自动执行。

2. 判断优先
   Helm 的核心价值是判断"什么需要推进"、"为什么"、"交给谁"，
   而不是自动执行一切。

3. 证据优先
   每个推进项都有 evidence、confidence、boundary note，
   不做"黑盒自动化"。

4. 复核优先
   高风险、external-facing、commitment 涉及的操作必须 review。

5. 渐进授权
   从 read_only → draft_only → review_required internal_write → narrow auto
   每一步都需要验证、审计、回滚能力。
   【收口约束】narrow auto 是 Phase 5 reserved posture，Phase 1-4 不可用。
```

---

## 二、经营推进闭环：统一对象模型

### 2.1 核心定义

```text
【V2.1 新增】统一对象模型是 V2.1 的核心

V2.1 的主线是：把经营输入持续转化为可解释、可复核、可推进、
可沉淀的经营动作。自动化只是其中被证据、权限和治理逐步批准的
一种承接方式。

【收口约束】本章 interface 只表达产品与治理上的 conceptual contract。
它不是 Prisma schema，不是 API contract，不是 event queue contract，
也不是要求当前阶段立即新增持久化对象。
```

### 2.2 六大统一对象

```typescript
// ====================
// 1. AdvancementSignal
// ====================
// 经营信号的统一表达
// 【V2.1 新增】这是 Phase 1 的核心定义

interface AdvancementSignal {
  id: string;
  workspaceId: string;

  // 信号来源
  sourceType:
    | 'ask_helm_interaction'    // Ask Helm 问答
    | 'tenant_resource'          // 租户资源系统
    | 'meeting'                  // 会议
    | 'email'                    // 邮件
    | 'crm'                      // CRM
    | 'report'                   // 报表
    | 'user_behavior';           // 用户行为

  // 信号类型
  signalType:
    | 'stalled_object'           // 对象停滞
    | 'overdue_commitment'       // 承诺超期
    | 'blocked_decision'         // 决策阻塞
    | 'resource_gap'             // 资源缺口
    | 'repeated_intent'          // 重复意图
    | 'boundary_hit'             // 边界触碰
    | 'unmet_need'               // 未满足需求
    | 'review_required';         // 需要复核

  // 关联对象
  objectRef?: {
    objectType: string;
    objectId: string;
  };

  // 证据引用
  evidenceRefs: Array<{
    type: string;                // 证据类型
    ref: string;                 // 证据引用
    confidence: 'high' | 'medium' | 'low';
  }>;

  // 建议的下一步
  suggestedNextStep: string;

  // 复核姿态
  reviewPosture:
    | 'read_only'               // 只读
    | 'draft_only'              // 草稿
    | 'review_required'         // 需要复核
    | 'blocked';                // 阻塞

  // 边界说明
  boundaryNote?: string;
}

// ====================
// 2. AdvancementJudgement
// ====================
// 系统对信号的判断

interface AdvancementJudgement {
  signalId: string;

  // 判断内容
  judgement: string;            // Helm 的判断
  reason: string;               // 判断理由

  // 置信度
  confidence: 'high' | 'medium' | 'low';

  // 证据链
  evidenceChain: Array<{
    source: string;
    content: string;
    weight: number;
  }>;

  // 边界检查
  boundaryCheck: {
    isBoundaryHit: boolean;
    boundaryType?: string;
    boundaryReason?: string;
  };

  // 建议的承接方式
  suggestedFulfillment:
    | 'human_review'            // 人类复核
    | 'skill_prepared'          // SKILL 准备
    | 'skill_draft'             // SKILL 草稿
    | 'narrow_auto'             // Phase 5 reserved，Phase 1-4 不可用
    | 'blocked';                // 阻塞
}

// ====================
// 3. MustPushItem
// ====================
// Must Push 推进项

interface MustPushItem {
  id: string;
  workspaceId: string;

  // 关联信号
  signalId: string;

  // 推进内容
  title: string;
  description: string;

  // 对象引用
  objectRef?: {
    objectType: string;
    objectId: string;
    displayName: string;
  };

  // 优先级
  priority: 'urgent' | 'high' | 'medium' | 'low';

  // 承接方式
  fulfillment: {
    type: 'human' | 'skill' | 'hybrid';
    assignedTo?: string;         // 分配给谁
    skillId?: string;            // 如果是 SKILL；不代表 execution authority
    estimatedEffort?: number;    // 预估工作量
  };

  // 状态
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';

  // 证据
  evidence: {
    summary: string;
    sources: string[];
    lastUpdated: Date;
  };

  // 边界说明
  boundaryNote?: string;
}

// ====================
// 4. ReviewRequiredAction
// ====================
// 需要复核的动作

interface ReviewRequiredAction {
  id: string;
  workspaceId: string;

  // 动作内容
  actionType: string;
  actionDescription: string;

  // 为什么需要复核
  reviewReason: string;

  // 风险等级
  riskLevel: 'low' | 'medium' | 'high' | 'critical';

  // 谁来复核
  reviewerRole?: string;

  // 复核前的准备
  preparedContent?: {
    draft: string;               // 草稿
    evidence: string[];          // 证据
    alternatives?: string[];     // 替代方案
  };

  // 状态
  status: 'pending_review' | 'approved' | 'rejected' | 'modified';

  // 审计
  audit: {
    requestedBy: string;
    requestedAt: Date;
    reviewedBy?: string;
    reviewedAt?: Date;
    decisionReason?: string;
  };
}

// ====================
// 5. SkillSuggestion
// ====================
// SKILL 候选（不是正式 SKILL）

interface SkillSuggestion {
  id: string;
  workspaceId: string;

  // 候选信息
  name: string;
  description: string;

  // 来源模式
  sourcePattern: {
    patternType: string;
    occurrenceCount: number;
    successRate: number;
    firstSeenAt: Date;
    lastSeenAt: Date;
  };

  // 能力定义
  capabilityDefinition: {
    inputSchema: unknown;
    outputSchema: unknown;
    scenarioTypes: string[];
  };

  // 状态
  // 【V2.1 修正】明确只有这些状态，不包括 formal
  status: 'candidate' | 'probationary';

  // 治理信息
  governance: {
    suggestedRiskLevel: 'low' | 'medium' | 'high';
    requiresReview: boolean;
    allowsAutoExecution: boolean;  // 【V2.1】默认 false
    customerFacingAllowed: boolean; // 【V2.1】默认 false
    nonCommitmentOnly: boolean;     // 【V2.1】默认 true
  };

  // 证据
  evidence: {
    positiveExamples: unknown[];
    negativeExamples: unknown[];
    humanConfirmations: number;
    humanCorrections: number;
  };
}

// ====================
// 6. MemoryCandidate
// ====================
// 记忆写回候选

interface MemoryCandidate {
  id: string;
  workspaceId: string;

  // 写回类型
  writebackType:
    | 'judgement_asset'          // 判断资产
    | 'boundary_asset'           // 边界资产
    | 'pattern_asset';           // 模式资产

  // 内容
  content: {
    summary: string;
    detail: unknown;
    evidenceRefs: string[];
  };

  // 写回目标
  target: {
    objectType?: string;
    objectId?: string;
    memoryType: 'workspace' | 'object' | 'pattern';
  };

  // 状态
  status: 'candidate' | 'approved' | 'rejected';

  // 治理
  governance: {
    requiresHumanApproval: boolean;  // 【V2.1】默认 true
    autoApproved: boolean;
    reviewedBy?: string;
    reviewedAt?: Date;
  };
}
```

### 2.3 完整闭环图

```text
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   【V2.1 修正】完整经营推进闭环                                │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                    经营输入                           │   │
│   │  Ask Helm | 资源系统 | 用户行为 | 会议邮件CRM         │   │
│   └─────────────────────┬───────────────────────────────┘   │
│                         │                                   │
│                         ▼                                   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              AdvancementSignal                       │   │
│   │         (统一经营信号表达)                            │   │
│   └─────────────────────┬───────────────────────────────┘   │
│                         │                                   │
│                         ▼                                   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │           AdvancementJudgement                       │   │
│   │      (系统判断：是什么、为什么、边界、承接方式)        │   │
│   └─────────────────────┬───────────────────────────────┘   │
│                         │                                   │
│                         ▼                                   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │               MustPushItem                           │   │
│   │           (统一推进列表)                               │   │
│   └─────────────────────┬───────────────────────────────┘   │
│                         │                                   │
│          ┌──────────────┼──────────────┐                  │
│          ▼              ▼              ▼                  │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐             │
│   │ 人类复核  │   │SKILL准备  │   │ SKILL草稿│             │
│   └────┬─────┘   └────┬─────┘   └────┬─────┘             │
│        │              │              │                     │
│        ▼              ▼              ▼                     │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              ReviewRequiredAction                    │   │
│   │              (需要复核的动作)                          │   │
│   └─────────────────────┬───────────────────────────────┘   │
│                         │                                   │
│                         ▼                                   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                  执行 & 记录                          │   │
│   │         (人类执行/SKILL执行/窄范围自动)                │   │
│   └─────────────────────┬───────────────────────────────┘   │
│                         │                                   │
│                         ▼                                   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                    记忆层                             │   │
│   │    SkillSuggestion | MemoryCandidate│   │
│   └─────────────────────┬───────────────────────────────┘   │
│                         │                                   │
│                         ▼                                   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                    模式提取                            │   │
│   │         (从执行中提取可复用模式)                       │   │
│   └─────────────────────┬───────────────────────────────┘   │
│                         │                                   │
│                         └────────────→ 闭环回到感知层          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、Ask Helm：从问答到经营信号源

### 3.1 角色定位

```text
【V2.1 修正】Ask Helm 的双重角色

1. 感知入口
   用户通过 Ask Helm 表达行动意图
   这是"经营上需要推进什么"的直接信号

2. 资产来源
   每次问答都可能产生三类资产：
   - JudgementAsset：系统给出过的判断和证据
   - BoundaryAsset：触碰过的边界和拒绝原因
   - IntentAsset：重复出现的意图模式

【V2.1 边界】Ask Helm 不是聊天产品
- 不做多轮对话历史
- 不做 conversation persistence
- 不做泛知识问答
- 只做 workspace 内行动意图理解
```

### 3.2 互动资产分类

```typescript
// 【V2.1 保留】V2 的三类资产分类，但增加边界约束

interface AskHelmInteractionAsset {
  id: string;
  workspaceId: string;
  userId: string;

  // 原始问题（脱敏后）
  originalQuery: {
    intentType: string;          // 意图类型
    intentSemantic: string;      // 语义摘要（脱敏）
    normalizedQuery: string;     // 标准化表达
  };

  // 资产类型
  assetType:
    | 'judgement'                // 判断资产
    | 'boundary'                 // 边界资产
    | 'intent';                  // 意图资产

  // 判断资产内容
  judgementAsset?: {
    judgement: string;           // 系统判断
    reason: string;              // 判断理由
    confidence: 'high' | 'medium' | 'low';
    evidenceChain: Array<{
      source: string;
      content: string;
    }>;
  };

  // 边界资产内容
  boundaryAsset?: {
    boundaryType: string;        // 边界类型
    boundaryReason: string;      // 拒绝原因
    alternativePath?: string;    // 替代路径
    userReaction?: 'accepted' | 'objected' | 'abandoned';
  };

  // 意图资产内容
  intentAsset?: {
    occurrenceCount: number;     // 出现次数
    firstSeenAt: Date;
    lastSeenAt: Date;
    trend: 'increasing' | 'stable' | 'decreasing';
    unmetNeed?: boolean;         // 是否是未满足需求
    suggestedSkillCandidate?: boolean; // 是否建议转化为 SKILL 候选
  };

  // 【V2.1 新增】治理边界
  governance: {
    retentionPolicy: 'ephemeral' | 'temporary' | 'persistent';
    visibilityScope: 'user_only' | 'workspace_admin' | 'workspace';
    requiresConsent: boolean;
    canBeDeleted: boolean;
    deletedAt?: Date;
  };
}
```

默认隐私姿态：

```text
【收口约束】Ask Helm Interaction Asset 的默认值必须保守：

- retentionPolicy 默认 temporary
- visibilityScope 默认 user_only
- canBeDeleted 默认 true
- requiresConsent 默认 true，除非 workspace policy 已显式授权
- 只有 boundary hit、reviewer mark、user manual mark 或 workspace admin policy 允许时，
  才能升高到 workspace_admin / workspace 可见
- 不允许用 abandoned query、repeated intent 推断个人绩效或公开个人画像
```

### 3.3 沉淀条件（V2.1 收紧）

```typescript
// 【V2.1 修正】比 V2 更严格的沉淀条件

function shouldCaptureAsAsset(
  interaction: AskHelmInteraction,
  policy: WorkspacePolicy
): CaptureDecision {
  // 必须满足基本条件
  if (!policy.allowInteractionCapture) {
    return { shouldCapture: false, reason: 'policy_not_allowed' };
  }

  // 判断资产：边界触碰总是有价值的
  if (interaction.boundaryNote) {
    return {
      shouldCapture: true,
      assetType: 'boundary',
      retentionPolicy: 'persistent',
      visibilityScope: 'workspace_admin',
      canBeDeleted: true,
      reason: 'boundary_hit'
    };
  }

  // 判断资产：多源检索说明判断复杂
  if (interaction.grounding.sources.length >= 3) {
    return {
      shouldCapture: true,
      assetType: 'judgement',
      retentionPolicy: 'temporary',
      visibilityScope: 'user_only',
      canBeDeleted: true,
      reason: 'multi_source_judgement'
    };
  }

  // 意图资产：重复出现
  if (isRepeatedIntent(interaction.intent)) {
    return {
      shouldCapture: true,
      assetType: 'intent',
      retentionPolicy: 'temporary',
      visibilityScope: 'user_only',
      canBeDeleted: true,
      reason: 'repeated_pattern'
    };
  }

  // 【V2.1 新增】用户主动标记
  if (interaction.userManualMark) {
    return {
      shouldCapture: true,
      assetType: interaction.userMarkType,
      retentionPolicy: 'persistent',
      visibilityScope: interaction.userSelectedVisibility ?? 'user_only',
      canBeDeleted: true,
      reason: 'user_manual_mark'
    };
  }

  // 【V2.1 新增】高置信度但被放弃
  if (interaction.confidence === 'high' && interaction.userAction === 'abandoned') {
    return {
      shouldCapture: true,
      assetType: 'judgement',
      retentionPolicy: 'temporary',
      visibilityScope: 'user_only',
      canBeDeleted: true,
      reason: 'high_confidence_abandoned'
    };
  }

  return { shouldCapture: false, reason: 'not_meeting_criteria' };
}
```

---

## 四、资源接入：从数据源到经营信号

### 4.1 角色转变

```text
【V2.1 保留】V2 的资源角色转变分析

传统视角          →          Helm 视角
─────────────────────────────────────────
数据存储                      经营信号源
导入 + 检索                   信号提取 + Must Push
被动响应                      主动预警
连接状态                      数据有效性 + 利用率
各自独立                      综合判断 + 图谱关联

【V2.1 新增】但强调边界：
- 资源信号不等于 official write
- 信号只能进入 Must Push，不能直接执行
- 需要人工复核才能进入业务系统
```

### 4.2 资源信号提取

```typescript
// 【V2.1 新增】统一的资源信号接口

interface ResourceSignalExtractor {
  // 任何资源接入必须实现这个接口
  extractSignals(context: ResourceContext): AdvancementSignal[];

  // 信号类型声明
  supportedSignalTypes: Array<
    'stalled_object' |
    'overdue_commitment' |
    'blocked_decision' |
    'resource_gap' |
    'unmet_need'
  >;
}

// 示例：案件资源信号提取器
class CaseResourceSignalExtractor implements ResourceSignalExtractor {
  extractSignals(context: CaseResourceContext): AdvancementSignal[] {
    const signals: AdvancementSignal[] = [];

    // 1. 停滞检测
    context.cases.forEach(case => {
      const avgDuration = this.getAverageStageDuration(case.stage);
      if (case.stageDuration > avgDuration * 2) {
        signals.push({
          id: generateId(),
          workspaceId: context.workspaceId,
          sourceType: 'tenant_resource',
          signalType: 'stalled_object',
          objectRef: {
            objectType: 'case',
            objectId: case.id,
          },
          evidenceRefs: [{
            type: 'case_stage_duration',
            ref: case.id,
            confidence: 'high',
          }],
          suggestedNextStep: `案件在 ${case.stage} 停滞 ${case.stageDuration} 天，建议主动跟进`,
          reviewPosture: 'review_required',
          boundaryNote: '需要人工确认是否需要升级处理',
        });
      }
    });

    // 2. 超期检测
    context.cases.forEach(case => {
      if (case.dueDate && daysUntil(case.dueDate) < 0) {
        signals.push({
          id: generateId(),
          workspaceId: context.workspaceId,
          sourceType: 'tenant_resource',
          signalType: 'overdue_commitment',
          objectRef: {
            objectType: 'case',
            objectId: case.id,
          },
          evidenceRefs: [{
            type: 'case_due_date',
            ref: case.id,
            confidence: 'high',
          }],
          suggestedNextStep: `案件已超期 ${Math.abs(daysUntil(case.dueDate))} 天`,
          reviewPosture: 'review_required',
          boundaryNote: '超期案件需要人工评估影响',
        });
      }
    });

    return signals;
  }
}
```

### 4.3 跨资源信号关联

```typescript
// 【V2.1 新增】跨资源信号聚合

interface CrossResourceSignalAggregator {
  // 关联分析
  correlate(signals: AdvancementSignal[]): AggregatedSignal[];

  // 优先级排序
  prioritize(aggregated: AggregatedSignal[]): PrioritizedSignal[];
}

// 示例：案件停滞的综合判断
function analyzeStalledCase(caseId: string, resources: AllResources): AggregatedSignal {
  const signals: AdvancementSignal[] = [];

  // 从案件系统获取
  const caseSignal = caseResource.extractSignal(caseId);
  signals.push(caseSignal);

  // 从邮箱系统获取
  const emailSignals = emailResource.extractSignals({
    filter: { relatedCase: caseId, timeframe: 'last_7_days' }
  });
  signals.push(...emailSignals);

  // 从会议系统获取
  const meetingSignals = meetingResource.extractSignals({
    filter: { relatedCase: caseId, timeframe: 'last_30_days' }
  });
  signals.push(...meetingSignals);

  // 从座席系统获取
  const agentSignals = agentResource.extractSignals({
    filter: { assignedCases: [caseId] }
  });
  signals.push(...agentSignals);

  // 综合判断
  return {
    signalId: generateId(),
    summary: `案件 ${caseId} 停滞 ${caseSignal.duration} 天`,
    confidence: calculateConfidence(signals),
    evidence: signals.map(s => s.evidenceRefs).flat(),
    suggestedNextStep: generateSuggestion(signals),
    reviewPosture: 'review_required',
    boundaryNote: '需要人工确认是否需要升级处理',
  };
}
```

---

## 五、SKILL 系统：从静态定义到受控进化

### 5.1 当前基础（保留）

```text
【V2.1 保留】V2 对当前 SKILL 基础的判断

Helm 已有完整的 SKILL 框架：
- Worker/Skill/Resource 协议清晰
- Skill Catalog 有 8 个标准化 SKILL
- 边界模式：auto / approval / manual
- PatternFact → SkillSuggestion → candidate capability 已成立
```

### 5.2 SKILL 进化链条（V2.1 修正）

```text
【V2.1 修正】V2 的 Lv0→Lv6 改为更保守的路径

Lv0: 原始数据
    "案件A的处理记录"
         ↓
Lv1: 模式识别
    "同类案件平均处理步骤：1→2→3"
         ↓ (PatternFact)
Lv2: 模式验证
    "验证模式的有效性、边界、例外"
         ↓
Lv3: SKILL 候选
    "案件处理流程" (SkillSuggestion)
         ↓ (人工接受)
Lv4: Candidate Capability
    "案件处理" (candidate capability)
         ↓ (试用期 + 校准)
Lv5: Probationary Capability
    "案件处理" (probationary)
         ↓ (formal review)
Lv6: Formal Skill
    "案件处理" (formal OperatingSkillId)

【V2.1 关键修正】：
- Lv5 之前都不是"自动执行"
- Lv0-Lv4 只是"建议/准备/草稿"
- Lv5 是"窄范围、低风险、可回滚的 pilot"
- Lv6 才是"正式 SKILL，但仍受控"
```

### 5.3 受控执行模型

```typescript
// 【V2.1 新增】SKILL 执行的受控模型
// 【收口约束】本模型只用于 Phase 5 之前的评审讨论；
// Phase 1-4 不允许启用 narrow_auto，也不允许据此新增 SkillExecutor。

interface SkillExecutionControl {
  // 执行模式
  executionMode:
    | 'recommend_only'           // 只推荐
    | 'prepare_draft'            // 准备草稿
    | 'review_required'          // 需要复核
    | 'narrow_auto'              // Phase 5 reserved，Phase 1-4 不可用
    | 'blocked';                 // 阻塞

  // 风险控制
  riskControl: {
    // 最大风险等级
    maxRiskLevel: 'low' | 'medium' | 'high';

    // 是否允许 external-facing
    allowExternalFacing: boolean;

    // 是否允许 commitment
    allowCommitment: boolean;

    // 是否允许 official write
    allowOfficialWrite: boolean;
  };

  // 复核要求
  reviewRequirements: {
    requiresReview: boolean;
    reviewerRole?: string;
    reviewTimeout?: number;      // 复核超时
    autoApproveCondition?: string; // 自动批准条件
  };

  // 回滚协议
  rollbackProtocol: {
    canRollback: boolean;
    rollbackMethod?: 'revert' | 'compensate' | 'manual';
    rollbackTimeout?: number;
  };

  // 审计
  audit: {
    logExecution: boolean;
    logDecision: boolean;
    logOutcome: boolean;
    logReviewer?: boolean;
  };
}

// 执行决策
function canExecuteSkill(
  skill: Skill,
  context: ExecutionContext
): ExecutionDecision {
  const control = skill.executionControl;

  // 1. 检查执行模式
  if (control.executionMode === 'blocked') {
    return { canExecute: false, reason: 'skill_blocked' };
  }

  // 2. 检查风险
  if (context.riskLevel !== undefined &&
      context.riskLevel > control.riskControl.maxRiskLevel) {
    return {
      canExecute: false,
      reason: 'risk_too_high',
      escalateTo: 'human_review'
    };
  }

  // 3. 检查复核要求
  if (control.reviewRequirements.requiresReview) {
    return {
      canExecute: true,
      mode: 'review_required',
      reviewer: control.reviewRequirements.reviewerRole,
    };
  }

  // 4. 检查窄范围自动
  // 【收口约束】只有 Phase 5 narrow pilot 且专家评审批准后才允许进入这里。
  if (control.executionMode === 'narrow_auto') {
    if (context.phase !== 'phase_5_narrow_pilot') {
      return {
        canExecute: false,
        reason: 'narrow_auto_reserved_until_phase_5',
        escalateTo: 'human_review'
      };
    }

    // 验证是否在窄范围内
    if (!isInNarrowScope(context, skill.narrowScope)) {
      return {
        canExecute: false,
        reason: 'out_of_narrow_scope',
        escalateTo: 'human_review'
      };
    }

    return {
      canExecute: true,
      mode: 'narrow_auto',
      rollbackProtocol: control.rollbackProtocol,
    };
  }

  return { canExecute: false, reason: 'unknown_execution_mode' };
}
```

---

## 六、下一阶段演进路线（V2.1 重写）

### 6.0 Implementation Guardrails Before Phase 1

```text
【收口新增】进入任何 Phase 1 实现前，必须先满足以下 guardrails：

1. 本文档仍只是 Phase 0 review-ready，不是 implementation-ready。
2. AdvancementSignal / MustPushItem / InteractionAsset 等 interface 不是 schema。
3. Phase 1A 只允许做 contract、fixtures、offline eval。
4. Phase 1B 只允许评估 read-model adapter feasibility。
5. 任何 schema、event queue、runtime extractor、official write 都必须另起 PRD 和专家评审。
6. `narrow_auto` 在 Phase 1-4 不可用，只能作为 Phase 5 reserved posture。
7. Ask Helm interaction capture 默认 user_only、temporary、deletable。
8. 用户行为信号不得用于个人绩效、排名或跨 workspace 分析。
9. 所有 Signal -> Must Push 排序必须 deterministic，LLM 不做最终排序。
10. 任一边界无法证明时，结论降级为 review_required 或 blocked。
```

### Phase 0：战略收口与专家评审

```text
目标：确认 V2.1 是否应该作为 Helm 下一阶段 north star

交付物：
1. V2.1 文档
2. 评审问题清单
3. Go / Revise / No-Go 结论
4. 【V2.1 新增】不进入代码实现的边界声明

验收条件：
1. 产品、工程、治理、销售、交付至少各有一轮反馈
2. 所有人都接受"推进优先于自动化"
3. 所有人都接受 candidate capability != execution authority
4. 没有专家提出无法修复的安全或信任 blocker

【V2.1 新增】非目标：
- 本阶段不批准任何代码实现
- 本阶段不批准 schema 设计
- 本阶段不批准自动执行扩权
- 本阶段不批准 SKILL 自动路由
```

### Phase 1：Advancement Signal Contract

```text
目标：先定义 Helm 如何识别"经营上需要推进的事情"

输入来源：
1. Ask Helm interaction
2. 资源状态变化
3. 用户点击、放弃、重复提问
4. 会议、邮件、CRM、报表、租户业务系统

输出结构：
→ AdvancementSignal 统一对象（见第二章）

【收口约束】Phase 1 分为 1A / 1B，不允许直接跳到 runtime extractor：

Phase 1A：Contract + Fixtures + Offline Eval
1. 冻结 AdvancementSignal conceptual contract
2. 用 fixture 描述至少 12 个真实经营推进信号样本
   建议评审包使用 20 个样本，避免样本过窄导致误判
3. 覆盖 Ask Helm、tenant resource、meeting/email/CRM/report、user behavior 四类来源
4. 建立 offline eval：能否正确分类 signalType、reviewPosture、boundaryNote
5. 明确哪些字段只是 planning contract，哪些可复用现有 read model

Phase 1B：Read-model Adapter Feasibility
1. 只评估能否从现有 dashboard / operating / mobile read model 投影 signal
2. 不新增 schema
3. 不新增 event queue
4. 不新增 runtime extractor
5. 不新增 official write

非目标：
【V2.1 新增】明确边界：
1. 不新增 official write
2. 不新增自动执行
3. 不把 signal 写成 commitment
4. 不跨 workspace 聚合
5. 不在 Phase 1 直接实现提取器或持久化模型

验收条件：
1. AdvancementSignal contract 冻结
2. 至少 12 个 fixture 通过 offline review
3. 至少 3 类信号源完成 read-model feasibility 判断
4. 信号到 Must Push 的映射规则已定义为 planning contract
5. 所有信号都有 boundary note / reviewPosture / evidence expectation
6. 是否进入实现由专家评审另行批准
```

### Phase 2：Signal → Must Push Adapter

```text
目标：把经营信号稳定压缩成用户真正需要推进的 3-5 个 Must Push 项

第一批信号：
1. overdue commitment
2. blocked decision
3. stalled opportunity / stalled case
4. resource evidence gap
5. repeated Ask Helm intent
6. customer waiting

验收条件：
【V2.1 新增】更严格的条件：
1. 每个 Must Push 都有 evidence
2. 每个 Must Push 都有 primary next step
3. 高风险项必须显示 boundary note
4. 排序 deterministic，LLM 不能最终排序
5. 进入 /mobile、dashboard、operating 时保持同一口径
6. 【V2.1 新增】不能自动执行，只能生成推进项

技术要点：
- 信号优先级算法（deterministic）
- 信号聚合逻辑
- Must Push 去重逻辑
- 边界检查逻辑
```

### First Pilot Loop：会议 / CRM / 资源状态 -> Must Push -> Review Action

```text
【V2.1 市场化收口】第一条试点闭环建议固定为：

会议 / CRM / 资源状态 / Ask Helm
  -> AdvancementSignal
  -> AdvancementJudgement
  -> 3-5 个 MustPushItem
  -> 高风险项生成 ReviewRequiredAction
  -> 用户确认后生成 MemoryCandidate 或 SkillSuggestion

优先试点对象：
1. Helm 自己的 GTM / 客户成功流程
2. 销售与客户成功密集型 B2B 团队
3. 有明确对象停滞、承诺超期、资源证据缺失的 vertical tenant

第一阶段交付物不是自动执行 Skill，而是高质量 Must Push 面板。
```

### Phase 3：Ask Helm Interaction Asset Capture

```text
目标：把 Ask Helm 的高价值互动沉淀为只读资产和候选信号

第一版资产类型：
1. JudgementAsset：系统给过的重要判断和证据链
2. BoundaryAsset：用户触碰过的边界、拒绝原因和替代路径
3. IntentAsset：重复出现、未满足或高价值的意图模式

捕获条件：
1. boundary hit
2. multi-source grounding
3. repeated intent
4. high-confidence abandoned
5. user manual mark
6. reviewer mark

非目标：
【V2.1 新增】明确边界：
1. 不保存完整聊天历史
2. 不做 follow-up question loop
3. 不默认进入 canonical memory
4. 不自动生成 formal skill
5. 不跨 workspace 训练或展示

验收条件：
1. 资产捕获 contract 冻结
2. 隐私控制已实现（retention、visibility、consent、delete）
3. 资产可以转化为 SkillSuggestion
4. 资产可以生成 Must Push
```

### Phase 4：SkillSuggestion Evidence Pipeline

```text
目标：把已验证的经营模式转成候选能力

进入条件：
1. 有重复模式
2. 有成功推进结果
3. 有人工确认
4. 有边界定义
5. 有失败或例外样本
6. 有最小测试和 guard

输出：
1. SkillSuggestion
2. candidate capability
3. formal review ready marker

非目标：
【V2.1 新增】明确边界：
1. 不自动生成新的正式 OperatingSkillId
2. 不自动接入 routing
3. 不自动获得 customer-facing send 权限
4. 不自动获得 official write authority

验收条件：
1. Evidence pipeline 已建立
2. Pattern → SkillSuggestion → candidate 流程已打通
3. candidate → probationary 自动晋级已验证
4. formal review queue 已建立
```

### Phase 5：Narrow Skill Execution Pilot

```text
目标：只在极窄场景验证 SKILL 执行能力

允许范围：
【V2.1 新增】明确的允许范围：
1. read_only
2. draft_only
3. internal_write 且必须 review-required

第一批候选：
1. meeting follow-through draft
2. external follow-up draft
3. resource gap review packet
4. internal handoff summary
5. low-risk diagnostic refresh

禁止范围：
【V2.1 新增】明确的禁止范围：
1. auto-send
2. auto-approval
3. auto-payment
4. customer-facing commitment
5. external official write
6. high-risk state mutation

验收条件：
1. guard、tests、audit、rollback 全部就位
2. pilot 场景的风险评估已完成
3. 回滚协议已验证
4. 审计追踪已实现
5. 只在受控 workspace 中 pilot
```

---

## 七、专家评审问题清单（V2.1 保留）

### 7.1 产品评审

1. "经营推进闭环"是否比"从问答到自动化"更准确表达 Helm 下一阶段？
2. Must Push 是否应该成为 Ask Helm、资源信号和用户行为的统一承接面？
3. Ask Helm 互动资产是否会提升长期产品复利？
4. 用户是否能理解"建议/草稿/复核/执行"的分层？
5. 是否存在更好的第一条试点闭环？

### 7.2 工程评审

1. AdvancementSignal 是否应该是独立 contract，还是先作为 read model projection？
2. Signal → Must Push 是否能复用现有 dashboard/operating/mobile read model？
3. Ask Helm Interaction Asset Capture 是否会引入过高存储和隐私成本？
4. SkillSuggestion Evidence Pipeline 是否能复用现有 PatternFact → SkillSuggestion？
5. narrow SKILL execution pilot 前需要哪些 guard、tests、audit 和 rollback？

### 7.3 治理与安全评审

1. 哪些信号可以被记录，哪些必须脱敏或禁止记录？
2. 用户行为洞察是否需要 opt-in 或 workspace admin policy？
3. repeated intent 和 abandoned query 是否可能暴露个人工作压力或绩效信息？
4. SKILL 自动化进入 pilot 前必须满足哪些 hard gates？
5. 当前"plugin runtime without real sandbox"对 Phase 5 有多大阻塞？

### 7.4 销售与交付评审

1. 客户最容易理解的是"自动化"还是"推进不漏、不拖、不失控"？
2. 资源信号进入 Must Push 是否能帮助试用客户更快看到价值？
3. 销售 intake 中收集的痛点和资源是否可以自然转成 AdvancementSignal？
4. 第一条试点闭环应选择 Helm 自己 GTM、客户成功，还是某个 vertical tenant？
5. 哪些场景下客户会强烈要求"不要自动做，只提醒我"？

---

## 八、当前必须保留的硬边界（V2.1 保留）

```text
以下边界不能因为 V2.1 愿景被稀释：

1. Helm 当前不是完整 workflow engine
2. Helm 当前不是完整 agent orchestration 平台
3. Helm 当前不是完整自动执行平面
4. plugin runtime 仍没有真正 sandbox
5. future-real auth 仍不是完整生产级认证
6. Ask Helm 不是 chat product
7. SkillSuggestion 不是 formal skill
8. candidate capability 不是 execution authority
9. resource signal 不是 official write success
10. recommendation 不是 commitment
```

---

## 九、成功度量（V2.1 修正）

### 9.1 技术指标

```text
【V2.1 修正】更保守、更可验证的指标

| 指标 | 目标 | 测量方式 |
|------|------|---------|
| Signal false positive rate | < 20% | 被 reviewer / user 判定为无效的信号 / 总信号 |
| Must Push accepted rate | > 60% | 被用户进入 primary action 或确认有价值的推进项 / 总推进项 |
| Must Push Time-to-Trust | ↓ 30% | 用户从看到推进项到点击确认、分派或进入 primary action 的平均时间 |
| Review coverage | 100% high-risk | 高风险信号中带 reviewPosture + boundaryNote 的比例 |
| Boundary incident count | 0 | 推进项被误写成承诺、审批、外发或 official write 的次数 |
| Duplicate / noisy signal rate | < 15% | 被去重或判定为噪音的信号 / 总信号 |

【V2.1 删除】V2 中过早的指标：
- SKILL 自动执行率 → 删除（Phase 5 才考虑）
- SKILL 成功率 > 90% → 删除（定义不清）
- 人工介入率 < 20% → 删除（不是当前目标）
- 信号捕获率 > 80% → 删除（容易鼓励过度捕获）
- 执行回滚率 < 5% → 推迟到 Phase 5 narrow execution pilot
```

### 9.2 业务指标

```text
| 指标 | 目标 | 测量方式 |
|------|------|---------|
| 推进项发现速度 | ↑ 50% | 从信号到 Must Push 的平均时间 |
| 阻塞识别准确率 | > 75% | 识别正确的阻塞 / 总阻塞 |
| 决策响应时间 | ↓ 30% | 从问题到决策的平均时间 |
| 资产复用率 | ↑ 40% | 复用的资产 / 总资产 |
```

### 9.3 组织指标

```text
| 指标 | 目标 | 测量方式 |
|------|------|---------|
| 新人上手时间 | ↓ 25% | 新座席达到标准效率的时间 |
| 知识复用率 | ↑ 30% | 复用的 SKILL 候选 / 总操作数 |
| 【V2.1 推迟】组织对齐度 | 推迟 | 需要先解决隐私问题 |
```

---

## 十、总结

### 10.1 V2.1 核心转变

```text
【V2.1 修正】V2 的核心转变

从：人驱动的 AI 辅助工具
到：AI 驱动的经营操作系统，人类负责判断和责任

【V2.1 更准确的表达】

从：问答工具、数据检索、手动列表
到：经营推进闭环系统
    - 自动发现需要推进的事
    - 把它交给正确的人或受控 SKILL
    - 留下证据，形成记忆
    - 逐步扩大可复用能力
```

### 10.2 价值主张

```text
1. 释放人类
   从发现"什么需要推进"中解放
   聚焦判断和责任

2. 持续进化
   从经营中学习
   SKILL 越来越智能

3. 组织提升
   从个体经验到组织能力
   从隐性知识到显性资产

4. 边界清晰
   建议 vs 承诺
   AI vs 人类
   read vs draft vs review vs execute
```

### 10.3 一句话结论

```text
【V2.1 最终表达】

Helm 下一阶段真正要做的不是让 AI 自动干更多事，
而是让系统更早、更准、更稳地发现经营上必须推进的事，
并把它交给正确的人或受控 SKILL，
留下证据，形成记忆，再逐步扩大可复用能力。
```

---

## 专家评审反馈（Claude Code Review）

更新时间：2026-04-26
评审者：Claude Code (Opus 4.7)
评审状态：Phase 0 Review-ready

### 评审摘要

| 评审项 | 评价 | 说明 |
|--------|------|------|
| **战略方向** | ✅ 清晰 | "从问答到经营推进闭环"是正确的战略表达 |
| **边界控制** | ✅ 优秀 | 新增的收口约束有效防止误读 |
| **市场化定位** | ✅ 清晰 | 差异化定位准确，不与巨头正面竞争 |
| **实施节奏** | ✅ 合理 | Phase 0-5 的顺序和边界明确 |
| **技术表达** | ✅ 充分 | Conceptual contract 与实现边界分清 |

---

### 关键亮点

#### 1. 收口新增约束

以下新增约束是 V2.1 的重要改进：

| 约束项 | 收口口径 | 评价 |
|--------|----------|------|
| 统一对象模型 | 只是 conceptual / planning contract，不是 Prisma schema | ✅ 防止被误读成数据模型设计 |
| Phase 1 | 先冻结 contract、fixtures、offline eval | ✅ 避免直接进入实现 |
| Ask Helm 资产捕获 | 默认 user_only + temporary + deletable | ✅ 隐私保护优先 |
| narrow_auto | Phase 5 reserved posture | ✅ 防止过早自动化 |
| 成功指标 | 优先衡量 false positive、采纳率 | ✅ 质量优先于数量 |

#### 2. 市场化收口

```text
Helm 是面向经营团队的推进控制台。
差异化：AdvancementSignal → MustPushItem → ReviewRequiredAction
         → MemoryCandidate / SkillSuggestion
```

**评价**：定位清晰，避免与 Salesforce/ServiceNow/Microsoft/Google/LangGraph/CrewAI/Gong/Clari 等正面竞争。

---

### 建议微调

#### 建议 1：Phase 0 验收条件补充

**当前验收条件**：
1. 产品、工程、治理、销售、交付至少各有一轮反馈
2. 所有人都接受"推进优先于自动化"
3. 所有人都接受 candidate capability != execution authority
4. 没有专家提出无法修复的安全或信任 blocker

**建议补充**：
```text
5. 【新增】Phase 1 的 AdvancementSignal contract 获得各方确认
   - 至少确认 sourceType 和 signalType 的枚举值
   - 至少确认 reviewPosture 的四种场景定义

6. 【新增】Phase 2 的首批信号类型获得各方确认
   - overdue commitment
   - blocked decision
   - stalled opportunity / stalled case
   - resource evidence gap
   - repeated Ask Helm intent
   - customer waiting
```

#### 建议 2：成功指标补充

**当前技术指标**：
- Signal false positive rate < 20%
- Must Push accepted rate > 60%
- Must Push Time-to-Trust ↓ 30%
- Review coverage 100% high-risk
- Boundary incident count 0
- Duplicate / noisy signal rate < 15%

**建议补充**：
```text
| 指标 | 目标 | 测量方式 |
|------|------|---------|
| 【新增】Signal Precision (精确率) | > 85% | 真阳性 / (真阳性 + 假阳性) |
| 【新增】Signal Recall (召回率) | > 70% | 真阳性 / (真阳性 + 假阴性) |
| 【新增】Signal F1 Score | > 75% | 精确率和召回率的调和平均 |
```

**理由**：Precision 和 Recall 是评估分类系统的标准指标，F1 Score 能平衡两者。

#### 建议 3：Phase 1 交付物补充

**当前交付物**：
1. AdvancementSignal contract 冻结
2. 至少 3 种信号源已实现提取器
3. 信号到 Must Push 的映射规则已定义
4. 所有信号都有 boundary note

**建议补充**：
```text
5. 【新增】信号提取的 offline eval 套件（不含真实数据）
   - fixture pack：预定义的测试信号样本
   - 评估脚本：计算 precision / recall / F1

6. 【新增】false positive / false negative 的评估方法
   - false positive：系统判断需要推进，但人工判断不需要
   - false negative：系统判断不需要推进，但人工判断需要
   - 评估流程：人工抽样标注 → 计算指标 → 定期复测

7. 【新增】信号优先级算法的 deterministic 保证
   - 不使用 LLM 进行最终排序
   - 使用规则引擎 + 权重分数
   - 相同输入必须产生相同输出
```

---

### 潜在风险提示

#### 风险 1：Ask Helm 互动资产的隐私风险

**当前约束**：Ask Helm 资产捕获默认 `user_only + temporary + deletable`

**建议在 Phase 3 明确**：
```text
1. 可见性扩大条件：
   - 什么情况下可以扩大到 workspace_admin 可见？
   - 什么情况下可以扩大到 workspace 可见？
   - 是否需要用户显式同意（opt-in）？

2. 删除策略：
   - 是自动过期（TTL）还是手动删除？
   - 删除后是否保留审计日志？

3. 访问审计：
   - 是否需要记录谁访问了哪些资产？
   - 是否需要记录资产被用于哪些判断？
```

#### 风险 2：Signal → Must Push 的排序问题

**当前约束**：排序 deterministic，LLM 不能最终排序

**建议明确**：
```text
1. 排序算法：
   - 优先级分数如何计算？（风险等级 + 时效性 + 影响范围？）
   - 是否支持用户自定义权重？

2. 平局处理：
   - 如果两个信号优先级分数相同怎么处理？
   - 是否使用 tie-breaker 规则？

3. 排序验证：
   - 如何验证排序是 deterministic 的？
   - 是否需要单元测试覆盖典型场景？
```

#### 风险 3：Phase 5 "narrow auto" 的边界

**当前允许范围**：
1. read_only
2. draft_only
3. internal_write 且必须 review-required

**建议明确**：
```text
1. internal_write 的范围：
   - 包括哪些操作？（更新状态？创建记录？发送通知？）
   - 不包括哪些操作？（外发邮件？修改外部系统？）

2. review-required 的响应时间：
   - reviewer 需要在多长时间内响应？
   - 如果超时未响应怎么办？（自动拒绝？自动升级？）

3. rollback 触发条件：
   - 什么条件下触发 rollback？（用户反馈？系统检测？）
   - rollback 的范围是什么？（单条记录？批量操作？）
```

---

### 总体评价

**V2.1 是一个成熟的设计文档**，具有以下优点：

1. **战略清晰**：从"自动化"改为"经营推进闭环"是关键修正
2. **边界严格**：新增的收口约束有效防止过度承诺
3. **定位准确**：市场化收明确了差异化
4. **节奏合理**：Phase 0-5 的顺序从识别信号到窄范围自动，逻辑正确
5. **评审友好**：保留了 V2→V2.1 的思考路径，便于专家评审

---

### 建议的下一步

1. **Phase 0 启动**：组织产品、工程、治理、销售、交付的评审会议
2. **优先确认**：Phase 1 的 AdvancementSignal contract 和首批信号类型
3. **风险识别**：针对上述三个潜在风险点展开讨论
4. **成功指标对齐**：确保各方认可 false positive、采纳率等指标的定义

---

## 附录：V2 与 V2.1 对比速查

| 维度 | V2 | V2.1 |
|------|----|----|
| **标题** | 从问答到自动化 | 从问答到经营推进闭环 |
| **核心原则** | 自动化优先 | 推进优先 |
| **Phase 1** | SKILL 自动执行 | Advancement Signal Contract |
| **Phase 2** | Ask Helm → SKILL 孵化 | Signal → Must Push Adapter |
| **Phase 3** | 资源信号 → Must Push | Ask Helm Interaction Asset Capture |
| **Phase 4** | 反馈闭环 | SkillSuggestion Evidence Pipeline |
| **Phase 5** | 用户洞察与协作 | Narrow Skill Execution Pilot |
| **SKILL 表达** | "下次直接执行" | "下次优先形成建议/草稿" |
| **边界强调** | 有，但不够突出 | 大幅加强 |
| **推迟内容** | 未明确 | 明确列出 6 项推迟 |
| **专家评审** | 有 | 保留并加强 |

---

## 附录：相关文档

- [HELM_BUSINESS_ADVANCEMENT_ARCHITECTURE_V2.md](./HELM_BUSINESS_ADVANCEMENT_ARCHITECTURE_V2.md) - 原始 V2 文档
- [HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md](./HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md) - 专家评审后的最终需求冻结版本
- [HELM_V2_1_MARKET_POSITIONING_BRIEF.md](./HELM_V2_1_MARKET_POSITIONING_BRIEF.md) - V2.1 市场化定位附件
- [HELM_ADVANCEMENT_SIGNAL_FIXTURE_PACK_V1.md](./HELM_ADVANCEMENT_SIGNAL_FIXTURE_PACK_V1.md) - Phase 1A 经营推进信号样本包
- [HELM_MUST_PUSH_PRODUCT_DEMO_SCRIPT_V1.md](./HELM_MUST_PUSH_PRODUCT_DEMO_SCRIPT_V1.md) - Must Push 产品演示脚本
- [HELM_SKILL_SUGGESTION_BASELINE_V1.md](./HELM_SKILL_SUGGESTION_BASELINE_V1.md)
- [HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md](./HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md)
- [HELM_OPERATING_SYSTEM_NEXT_STAGE_ACTIONS_REPORT.md](./HELM_OPERATING_SYSTEM_NEXT_STAGE_ACTIONS_REPORT.md)
- [HELM_ORGANIZATIONAL_MEMORY_FOUNDATION_V1.md](./HELM_ORGANIZATIONAL_MEMORY_FOUNDATION_V1.md)

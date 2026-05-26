---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm 经营推进架构 V2：从问答到自动化

更新时间：2026-04-26
状态：Design Discussion V1
作者：与用户共同设计讨论

## 文档目的

本文档记录 Helm 系统基于新设计哲学的完整架构思考，包括：
1. Ask Helm 互动作为非结构化经营资产的价值定位
2. 用户行为作为职责投射和关心图谱的洞察提取
3. 资源接入作为经营信号源的转化设计
4. 人类与 AI/SKILL 的分工边界
5. 当前系统差距分析与下一阶段演进路线

---

## 一、核心设计哲学

### 1.1 Helm 的本质价值

```
Helm 不是：
- 问答工具
- 搜索引擎
- 聊天产品
- 通知中心

Helm 是：
- 经营推进操作系统
- 判断优先的工作台
- 决策优先的信息架构
- 建议/承诺边界的守护者
```

### 1.2 人类与 AI/SKILL 的分工

```
┌─────────────────────────────────────────────────────────────┐
│                    Helm 经营推进系统                         │
│                                                             │
│   目标：推动经营 (Business Advancement)                      │
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
│      │  • 承担责任              │  • 可自动化的操作         │
│      │  • 系统外对接            │  • 已明确规则的判断       │
│      │  • 处理例外              │                          │
│      │                            │                         │
│   ───┴────────────────────────────┴───                       │
│      │                        │                             │
│      ▼                        ▼                             │
│  做决策                    提供建议 + 执行决策                │
│  承担责任                  跟进已定义的流程                   │
│  外部沟通                  处理常规                           │
│  处理例外                  遵循规则                           │
│  定义规则                  扩大自动化范围                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 核心原则

1. **自动化优先**：有 SKILL 就用 SKILL，没有人就没有人类
2. **人类做人类擅长的事**：判断方向、承担责任、外部沟通、处理例外
3. **SKILL 是沉淀的智慧**：不是写死的代码，而是从经营中学习来的
4. **记忆是 SKILL 的来源**：不只是为了存储，而是为了孵化更多 SKILL
5. **分工边界是动态的**：今天需要人判断的，明天可能变成 SKILL

---

## 二、Ask Helm：从问答到经营资产

### 2.1 传统视角 vs 资产视角

| 传统视角（搜索工具） | 资产视角（经营沉淀） |
|---|---|
| Ask Helm 的角色 | 帮用户找到信息 | **捕获经营意图和判断逻辑** |
| 输出价值 | 单次答案 | **可复用的组织记忆** |
| 时间维度 | 瞬时 | **长期积累** |
| 谁受益 | 提问者 | **整个 workspace** |

### 2.2 Ask Helm 互动的三类高价值资产

```
┌─────────────────────────────────────────────────────────────┐
│                  Ask Helm 资产沉淀                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 判断资产 (Judgement Assets)                             │
│     "Helm 为什么认为这个机会在放缓"                          │
│     → 沉淀：判断逻辑 + 证据链 + 置信度                       │
│     → 复用：类似问题的自动回答模板 / SKILL 候选             │
│                                                             │
│  2. 边界资产 (Boundary Assets)                              │
│     "为什么不能跨 workspace 对比"                           │
│     → 沉淀：限制原因 + 替代方案 + 用户反馈                   │
│     → 复用：产品演进优先级、FAQ 生成                         │
│                                                             │
│  3. 需求资产 (Intent Assets)                                │
│     "帮我分析最近流失的客户特征"                             │
│     → 沉淀：未满足需求模式                                   │
│     → 复用：新功能规划、检索优化、SKILL 孵化                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 沉淀策略

```typescript
// 实时判断是否值得沉淀
function shouldCaptureAsAsset(response: AskHelmResponse, userAction: UserAction): boolean {
  // 1. 边界触碰 → 总是沉淀
  if (response.boundaryNote) return true;

  // 2. 多源检索 → 沉淀（说明问题复杂，系统做了综合判断）
  if (response.grounding.sources.length >= 3) return true;

  // 3. 用户放弃但有高置信度 → 沉淀（可能答案不对）
  if (userAction === 'abandoned' && response.confidence === 'high') return true;

  // 4. 反复出现的意图 → 沉淀
  if (isRepeatedIntent(response.intent)) return true;

  // 5. 人工标记
  if (userAction === 'manual_mark') return true;

  return false;
}
```

### 2.4 与经营记忆的关系

```
Ask Helm 互动 → 沉淀为 → 经营记忆 → 孵化为 → SKILL

"这个案件怎么处理？"
  ↓ (N 次类似问题)
提取处理模式
  ↓
经营记忆：案件处理最佳实践
  ↓
孵化 SKILL：案件处理标准流程
  ↓
下次直接执行，无需人工介入
```

---

## 三、用户行为：职责投射与关心图谱

### 3.1 核心洞察

```
用户问什么 → 他关心什么
用户做什么 → 他的职责是什么
用户反复问 → 他被卡在哪里
用户不问什么 → 可能是盲区或已解决
```

### 3.2 价值维度

| 维度 | 价值 | 应用 |
|---|---|---|
| **个人关心图谱** | 我在关心什么，我的职责是什么 | 个人驾驶舱、职责对齐 |
| **组织协作图谱** | 谁也关心这个问题，谁是专家 | 协作匹配、知识流转 |
| **组织诊断** | 哪里卡住了，什么是盲区 | 管理决策、流程优化 |

### 3.3 三层运转

```
┌─────────────────────────────────────────────────────────────┐
│                  用户互动 → 经营智能                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  个人层：我的关心图谱                                         │
│  • 我最近在关心什么（按频率/趋势）                            │
│  • 我的职责画像 vs 实际行为                                   │
│  • 我的知识盲区                                              │
│  • 谁和我想法类似                                            │
│                                                             │
│  团队层：协作与知识流转                                       │
│  • 谁也问过这个问题                                          │
│  • 谁是某个领域的专家                                        │
│  • 有哪些知识空白需要填补                                    │
│                                                             │
│  组织层：管理驾驶舱                                           │
│  • 团队对齐度：大家在关注同一件事吗                          │
│  • 知识覆盖率：哪些领域有盲区                                │
│  • 瓶颈识别：什么在阻塞组织                                  │
│  • 边界试探：用户想要什么但系统不支持                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.4 数据模型

```typescript
interface AskHelmInteractionMemory {
  id: string;
  workspaceId: string;

  // 意图（脱敏后）
  intentType: string;
  intentSemantic: string;

  // 系统响应
  judgement: string;
  confidence: 'high' | 'medium' | 'low';
  retrievalPlan: {
    sources: string[];
    deniedSources?: string[];
  };

  // 用户行为
  userAction: 'clicked_primary' | 'clicked_secondary' | 'abandoned' | 'refined';
  timeToAction: number | null;

  // 价值标记
  valueSignals: {
    wasBoundaryHit: boolean;
    wasMultiSource: boolean;
    wasRepeated: boolean;
    userSatisfaction?: 'positive' | 'neutral' | 'negative';
  };

  // 沉淀时机
  capturedAt: Date;
  captureReason: 'high_value' | 'boundary' | 'pattern' | 'manual';
}
```

---

## 四、资源接入：从数据源到经营信号

### 4.1 资源角色转变

| 维度 | 传统视角 | Helm 视角 |
|---|---|---|
| **资源角色** | 数据存储 | 经营信号源 |
| **接入方式** | 导入 + 检索 | 信号提取 + 关联图谱 |
| **价值产出** | 被动响应 | 主动预警 + Must Push |
| **健康监控** | 连接状态 | 数据有效性 + 利用率 |
| **跨资源** | 各自独立 | 综合判断 + 图谱关联 |

### 4.2 资源信号类型

```typescript
// 案件信号
interface CaseSignals {
  // 停滞检测
  isStalled: boolean;
  stalledReason?: string;

  // 超期预警
  isOverdue: boolean;
  daysUntilDue?: number;

  // 风险评估
  riskLevel: 'low' | 'medium' | 'high';

  // 建议行动
  suggestedAction?: string;
}

// 座席信号
interface AgentSignals {
  // 当前负载
  activeCases: number;
  utilizationRate: number;
  overloaded: boolean;

  // 效率指标
  avgCaseDuration: number;
  satisfactionScore: number;

  // 专长领域
  skilledCaseTypes: string[];
}

// 报表信号
interface ReportSignals {
  // 异常检测
  anomalies: {
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }[];

  // 趋势识别
  trends: {
    direction: 'up' | 'down' | 'stable';
    confidence: number;
    description: string;
  }[];
}
```

### 4.3 资源 → Must Push 转化

```typescript
// 信号 → Must Push
interface ResourceSignalToMustPush {
  // 案件停滞 → Must Push
  if (case.stageDuration > case.stage.averageDuration * 2) {
    return {
      type: 'case_stalled',
      description: `案件 ${case.id} 停滞 ${case.stageDuration} 天`,
      priority: 'high',
      owner: case.assignedAgent,
      suggestedAction: '联系客户或升级处理',
      canAutoExecute: hasSkill('case-follow-up'),
    };
  }

  // 座席过载 → Must Push
  if (agent.utilizationRate > 1.0) {
    return {
      type: 'agent_overload',
      description: `座席 ${agent.name} 当前处理量超过容量`,
      priority: 'medium',
      suggestedAction: '重新分配案件',
      canAutoExecute: hasSkill('case-redistribution'),
    };
  }
}
```

### 4.4 跨资源综合判断

```
当用户问 "为什么这个案件停滞了"

→ Helm 跨资源综合回答：
  "案件 A12345 在 '资料审核' 阶段停留 14 天（平均 5 天）

   可能原因：
   - 最近 7 天没有邮件往来（邮箱信号）
   - 上次讨论是 10 天前的会议（会议信号）
   - 负责座席当前负载 120%（座席信号）

   建议行动：
   → 优先处理（可用 SKILL 自动执行）
   → 或升级给主管（需要人工判断）"
```

---

## 五、SKILL 系统：从静态定义到自动进化

### 5.1 当前 SKILL 框架

Helm 已有完整的 SKILL 框架：

```
Worker/Skill/Resource 协议
├── Worker：角色定义（Founder/Sales/Delivery/CS Assistant）
├── Skill：能力定义（会什么、输入输出、风险等级）
└── Resource：资源绑定（调用什么、怎么调）

当前 Skill Catalog（8个）：
├── meeting-briefing：会前简报
├── meeting-follow-through：会后动作提炼
├── external-followup-draft：外部跟进草稿
├── approval-review：审批判断
├── opportunity-push：机会推进判断
├── relationship-revival：关系恢复动作
├── memory-correction：记忆修正
└── pilot-readiness-diagnostics：试点就绪诊断
```

### 5.2 SKILL 进化链条

```
Lv0: 原始数据
    "案件A的处理记录"
         ↓
Lv1: 模式识别
    "同类案件平均处理步骤：1→2→3"
         ↓ (PatternFact)
Lv2: 最佳实践
    "高效座席的做法：1→2→4，跳过3"
         ↓ (SkillSuggestion)
Lv3: SKILL 候选
    "标准案件处理流程" (人工接受)
         ↓ (Candidate Skill)
Lv4: 试用 SKILL
    "案件处理 SKILL" (系统自动执行，人工复核)
         ↓ (Probationary Skill)
Lv5: 正式 SKILL
    "案件处理 SKILL" (完全自动执行)
         ↓ (持续优化)
Lv6: 自进化 SKILL
    基于执行反馈持续优化参数和流程
```

### 5.3 SKILL 自动执行架构

```typescript
// 事件驱动 SKILL 执行
interface EventDrivenSkillExecution {
  // 事件信号触发
  onEventSignal(signal: EventSignal): void {
    // 1. 匹配可用的 SKILL
    const availableSkills = skillCatalog.findSkillsForSignal(signal);

    // 2. 检查是否可以自动执行
    const autoExecutableSkills = availableSkills.filter(skill =>
      skill.defaultBoundary === 'auto' ||
      skill.hasProbationaryPermission()
    );

    // 3. 执行 SKILL
    autoExecutableSkills.forEach(skill => {
      skill.execute(signal.context);
    });

    // 4. 需要人工的进入审批队列
    const humanRequiredSkills = availableSkills.filter(skill =>
      !autoExecutableSkills.includes(skill)
    );
    humanRequiredSkills.forEach(skill => {
      approvalQueue.add({
        skill: skill,
        context: signal.context,
        reason: '需要人工判断',
      });
    });
  }
}

// SKILL 执行状态机
interface SkillExecutionStateMachine {
  states: {
    pending: {
      // 等待执行
      on: 'event_received' → 'executing';
    },
    executing: {
      // 正在执行
      on: 'success' → 'completed';
      on: 'error' → 'failed';
      on: 'uncertain' → 'escalated';
    },
    completed: {
      // 执行完成
      on: 'feedback_positive' → 'reinforce';
      on: 'feedback_negative' → 'analyze';
    },
    failed: {
      // 执行失败
      on: 'retry' → 'pending';
      on: 'escalate' → 'escalated';
    },
    escalated: {
      // 升级给人工
      on: 'human_resolved' → 'completed';
    },
  };
}
```

---

## 六、完整经营闭环

### 6.1 目标架构

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                    经营环境                          │   │
│   │  (案件、座席、客户、邮件、会议...)                    │   │
│   └─────────────────────┬───────────────────────────────┘   │
│                         │                                   │
│                         ▼                                   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                   感知层                              │   │
│   │   Ask Helm | 资源信号 | 用户互动                      │   │
│   └─────────────────────┬───────────────────────────────┘   │
│                         │                                   │
│                         ▼                                   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                   智能层                              │   │
│   │   ┌──────────────┐       ┌──────────────┐            │   │
│   │   │ 模式识别     │       │ 洞察生成      │            │   │
│   │   └──────────────┘       └──────────────┘            │   │
│   └─────────────────────┬───────────────────────────────┘   │
│                         │                                   │
│                         ▼                                   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                   判断层                              │   │
│   │   ┌──────────────┐       ┌──────────────┐            │   │
│   │   │ 人类判断     │       │ SKILL判断     │            │   │
│   │   │ (方向+责任)  │       │ (已沉淀规则)  │            │   │
│   │   └──────────────┘       └──────────────┘            │   │
│   └─────────────────────┬───────────────────────────────┘   │
│                         │                                   │
│                         ▼                                   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                   推进层                              │   │
│   │   Must Push 路由 → 人类任务 / SKILL任务              │   │
│   └─────────────────────┬───────────────────────────────┘   │
│                         │                                   │
│                         ▼                                   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                   执行层                              │   │
│   │   ┌──────────────┐       ┌──────────────┐            │   │
│   │   │  人类执行     │       │  SKILL执行    │            │   │
│   │   │ (外部对接等)  │       │ (自动化操作)  │            │   │
│   │   └──────────────┘       └──────────────┘            │   │
│   └─────────────────────┬───────────────────────────────┘   │
│                         │                                   │
│                         ▼                                   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                   记忆层                              │   │
│   │   提取模式 → 沉淀 SKILL → 扩大自动化                │   │
│   └─────────────────────┬───────────────────────────────┘   │
│                         │                                   │
│                         ▼                                   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                   反馈层                              │   │
│   │   SKILL 优化 / 模式更新 / 边界调整                   │   │
│   └─────────────────────┴───────────────────────────────┘   │
│                             │                               │
│                             └──────→ 闭环回到感知层           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 完整数据流

```
┌─────────────────────────────────────────────────────────────┐
│                      完整运转流程                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [感知]                                                     │
│  • Ask Helm 问答                                            │
│  • 资源状态变化                                             │
│  • 用户操作行为                                             │
│  • 事件信号触发                                             │
│      │                                                      │
│      ▼                                                      │
│  [智能]                                                     │
│  • 模式识别：提取重复模式                                   │
│  • 洞察生成：关联分析                                       │
│  • 信号提取：从资源中提取经营信号                            │
│      │                                                      │
│      ▼                                                      │
│  [判断]                                                     │
│  • 有 SKILL 吗？ → 自动执行                                 │
│  • 需要人类吗？ → 路由到人                                  │
│  • 边界模糊吗？ → 问人                                      │
│      │                                                      │
│      ▼                                                      │
│  [推进]                                                     │
│  • SKILL 任务 → 自动队列                                    │
│  • 人类任务 → Must Push 列表                                │
│      │                                                      │
│      ▼                                                      │
│  [执行]                                                     │
│  • SKILL 执行 → 自动完成                                    │
│  • 人类执行 → 确认/调整/决策                                │
│      │                                                      │
│      ▼                                                      │
│  [记忆]                                                     │
│  • 记录执行结果                                             │
│  • 提取新的模式                                             │
│  • 孵化新的 SKILL                                           │
│      │                                                      │
│      ▼                                                      │
│  [反馈]                                                     │
│  • SKILL 参数优化                                           │
│  • 边界阈值调整                                             │
│  • 新 SKILL 候选生成                                        │
│      │                                                      │
│      └────────────→ [感知] 闭环                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 七、当前系统差距分析

### 7.1 已有的良好基础

| 层级 | 现状 | 评价 |
|------|------|------|
| **感知层** | Ask Helm、Mobile Surface V1、资源连接器 | ✅ 基础完整 |
| **记忆层** | Object State、Audit、Replay、Decision Trace、Boundary Trace | ✅ 框架清晰 |
| **SKILL层** | Worker/Skill/Resource 协议、8个标准化 SKILL | ✅ 定义完整 |
| **事件层** | 8种 Event Signals、Recommendation Context | ✅ 信号定义 |
| **治理层** | Approval Boundary、Policy、Pilot Readiness | ✅ 边界清晰 |
| **执行层** | Dashboard、Approvals、Memory、Diagnostics | ✅ 表面完整 |

### 7.2 核心差距

| 差距项 | 当前状态 | 目标状态 | 优先级 |
|--------|---------|---------|--------|
| **SKILL 自动执行** | SKILL 是 UI 触发 | SKILL 基于事件自动执行 | 🔴 P0 |
| **Ask Helm 沉淀** | 问答可检索 | 问答应沉淀为 SKILL 来源 | 🔴 P0 |
| **资源信号** | 资源只供检索 | 资源提取信号 → Must Push | 🔴 P1 |
| **任务路由** | Must Push 统一管理 | 区分人类任务/SKILL任务 | 🟡 P1 |
| **反馈闭环** | 执行后有审计 | 执行后 SKILL 学习优化 | 🔴 P1 |
| **用户洞察** | 基础日志 | 关心图谱/协作匹配/组织诊断 | 🟡 P2 |

### 7.3 具体差距说明

#### 1. SKILL 不是自动执行的

```typescript
// 当前：SKILL 是 UI 按钮，用户点击才触发
<Dashboard>
  <SkillButton skillId="opportunity-push" />
</Dashboard>

// 目标：SKILL 基于事件信号自动执行
onEventSignal("high-risk-opportunity")
  → 自动执行 opportunity-push SKILL
  → 只在边界/不确定时问人
```

#### 2. Ask Helm 互动未沉淀为 SKILL

```typescript
// 当前：Ask Helm 回答问题后就结束了
用户: "这个案件怎么处理？"
系统: [给出答案]
结束。

// 目标：高频问答模式 → 沉淀为 SKILL
用户: "这个案件怎么处理？" (第 N 次类似问题)
系统: [识别模式]
     [生成 SKILL 候选: "案件处理标准流程"]
     [人工接受]
     [下次自动执行]
```

#### 3. 资源接入未生成经营信号

```typescript
// 当前：资源只用来检索
案件数据 → Ask Helm 可查询

// 目标：资源提取信号 → 生成 Must Push
案件数据 → 提取停滞信号 → 自动生成推进项
         → 提取风险信号 → 自动预警
```

---

## 八、下一阶段演进路线

### Phase 1：SKILL 自动执行（P0，4-6周）

```
目标：让 SKILL 真正自动工作

交付物：
├── Event Signal → SKILL 自动触发器
│   └── 当事件信号出现，自动调用对应 SKILL
├── SKILL 执行状态机
│   └── pending → executing → completed/escalated
├── 人工介入点
│   └── 只有在边界/不确定时才问人
└── 验收标准
    ├── 案件停滞 → 自动执行 opportunity-push SKILL
    ├── 会议结束 → 自动执行 meeting-follow-through SKILL
    └── 只有高风险才进入审批队列

技术要点：
- SkillExecutor 引擎
- 事件信号到 SKILL 的映射配置
- 执行状态追踪和监控
- 人工介入的升级机制
```

### Phase 2：Ask Helm → SKILL 孵化（P0，6-8周）

```
目标：问答模式自动转化为 SKILL

交付物：
├── 问答模式提取器
│   ├── 语义聚类
│   ├── 频率统计
│   └── 模式抽象
├── 模式 → SKILL 映射器
│   ├── 流程提取
│   ├── 参数识别
│   └── 边界定义
├── SKILL 候选生成器
│   ├── 自动生成 SKILL 定义
│   ├── 风险评估
│   └── 推荐理由
└── 验收标准
    ├── "这个案件怎么处理" 问 10 次后
    → 系统生成 "案件处理" SKILL 候选
    └── 人工接受后成为 candidate skill

技术要点：
- 问答日志的语义分析
- 模式识别算法
- SKILL 模板生成
- 候选 SKILL 的评估和排序
```

### Phase 3：资源信号 → Must Push（P1，4-6周）

```
目标：资源自动生成推进项

交付物：
├── 资源信号提取器
│   ├── 案件信号 (停滞/超期/风险)
│   ├── 座席信号 (负载/效率)
│   └── 报表信号 (异常/趋势)
├── 信号 → Must Push 转化器
│   ├── 阈值配置
│   ├── 优先级计算
│   └── 分配逻辑
├── 跨资源信号关联
│   └── 综合判断生成推进建议
└── 验收标准
    ├── 停滞案件自动进入 Must Push
    ├── 过载座席自动预警
    └── 报表异常自动生成分析任务

技术要点：
- 资源连接器的信号接口标准化
- 信号提取规则引擎
- 信号聚合和关联分析
```

### Phase 4：反馈闭环（P1，6-8周）

```
目标：SKILL 从执行中学习

交付物：
├── SKILL 执行追踪
│   ├── 执行结果记录
│   ├── 人工反馈收集
│   └── 效果指标计算
├── 模式更新器
│   ├── 成功模式强化
│   ├── 失败模式修正
│   └── 参数自动调优
├── SKILL 优化引擎
│   ├── A/B 测试框架
│   ├── 参数优化算法
│   └── 版本管理
└── 验收标准
    ├── SKILL 成功率持续提升
    ├── 人工介入率持续下降
    └── 新 SKILL 自动生成

技术要点：
- 执行数据的收集和分析
- 反馈信号的设计
- 优化算法的选择
- 版本回滚机制
```

### Phase 5：用户洞察与协作（P2，4-6周）

```
目标：从用户行为中提取组织智能

交付物：
├── 个人关心图谱
│   ├── 意图分析
│   ├── 关心趋势
│   └── 职责画像
├── 团队协作图谱
│   ├── 知识持有者识别
│   ├── 协作机会推荐
│   └── 知识流转追踪
├── 组织诊断面板
│   ├── 团队对齐度
│   ├── 知识覆盖率
│   └── 瓶颈识别
└── 验收标准
    ├── 用户能看到自己的关心图谱
    ├── 能找到"谁也关心这个问题"
    ├── 管理者能看到组织健康状况

技术要点：
- 用户行为的数据分析
- 图谱算法的应用
- 隐私保护机制
```

---

## 九、关键设计决策

### 9.1 为什么不是完整 Agent 平台

```
Helm 不是：
- 通用 orchestration 平台
- 完整 workflow engine
- 完整 worker console
- 完整 marketplace

Helm 是：
- 经营推进操作系统
- 判断优先的工作台
- 决策优先的信息架构
- 建议/承诺边界的守护者

理由：
1. 过度平台化会模糊经营焦点
2. 复杂 orchestration 增加治理难度
3. 经营场景需要明确的边界和责任
4. 受控试点需要可控的范围
```

### 9.2 为什么 recommendation != commitment

```
关键边界：
- recommendation：系统建议，需要人工判断
- commitment：正式承诺，有业务影响

Helm 的立场：
- AI 提供建议，人类做决策
- 系统帮助判断，人类承担责任
- 自动化只在边界内进行
- 任何可能被误解的措辞都加边界说明
```

### 9.3 为什么是渐进式自动化

```
不是从 0 到 1 的跳跃，而是渐进式扩大自动化范围：

Lv0: 完全人工
Lv1: AI 提供建议
Lv2: AI 执行低风险操作
Lv3: AI 执行中风险操作
Lv4: AI 执行高风险操作（仍需审批）
Lv5: 完全自动化（仍有监控）

每一步都需要：
- 效果验证
- 边界确认
- 审计完整
- 回滚机制
```

---

## 十、成功度量

### 10.1 技术指标

| 指标 | 目标 | 测量方式 |
|------|------|---------|
| SKILL 自动执行率 | > 60% | 自动执行 SKILL 数 / 总 SKILL 调用数 |
| SKILL 成功率 | > 90% | 成功执行数 / 总执行数 |
| 人工介入率 | < 20% | 需要人工的任务数 / 总任务数 |
| 资源信号覆盖率 | > 80% | 有信号监控的资源 / 总资源 |
| Ask Helm 沉淀率 | > 30% | 沉淀的问答 / 总问答数 |

### 10.2 业务指标

| 指标 | 目标 | 测量方式 |
|------|------|---------|
| 决策响应时间 | ↓ 40% | 从问题到决策的平均时间 |
| 案件处理时长 | ↓ 15% | 案件从创建到完成的平均时间 |
| 座席效率 | ↑ 20% | 单位时间处理的案件数 |
| 知识复用率 | ↑ 50% | 复用的 SKILL 执行数 / 总操作数 |

### 10.3 组织指标

| 指标 | 目标 | 测量方式 |
|------|------|---------|
| 新人上手时间 | ↓ 30% | 新座席达到标准效率的时间 |
| 知识盲区识别 | 每月发现 | 通过 Ask Helm 互动发现的盲区数 |
| 协作效率 | ↑ 25% | 跨角色协作任务完成速度 |

---

## 十一、风险与边界

### 11.1 必须保留的边界

1. **plugin runtime 仍没有真正 sandbox**
2. **当前系统仍不是完整企业级多组织/多权限/多租户平台**
3. **当前主动机制仍默认以"建议、准备、升级"为主**
4. **任何 customer-facing wording 只要有被误解成 commitment 的风险，必须降级**

### 11.2 潜在风险

| 风险 | 缓解措施 |
|------|---------|
| SKILL 错误执行 | 分阶段放权、完整审计、一键回滚 |
| 模式识别偏差 | 人工审核候选 SKILL、小范围试用 |
| 过度自动化 | 保留人类否决权、定期审查自动化边界 |
| 隐私泄露 | 脱敏处理、访问控制、审计追踪 |

---

## 十二、总结

### 12.1 核心转变

```
从：人驱动的 AI 辅助工具
到：AI 驱动的经营操作系统，人类负责判断和责任
```

### 12.2 价值主张

1. **释放人类**：从重复操作中解放，聚焦判断和责任
2. **持续进化**：从经营中学习，SKILL 越来越智能
3. **组织提升**：从个体经验到组织能力
4. **边界清晰**：建议 vs 承诺，AI vs 人类

### 12.3 下一步

1. **确认方向**：这个设计哲学是否符合 Helm 的定位
2. **优先级排序**：哪个 Phase 应该优先启动
3. **技术验证**：关键技术的可行性验证
4. **试点准备**：选择合适的场景开始试点

---

## 附录：相关文档

- [HELM_SKILL_SUGGESTION_BASELINE_V1.md](./HELM_SKILL_SUGGESTION_BASELINE_V1.md)
- [HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md](./HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md)
- [HELM_OPERATING_SYSTEM_NEXT_STAGE_ACTIONS_REPORT.md](./HELM_OPERATING_SYSTEM_NEXT_STAGE_ACTIONS_REPORT.md)
- [HELM_ORGANIZATIONAL_MEMORY_FOUNDATION_V1.md](./HELM_ORGANIZATIONAL_MEMORY_FOUNDATION_V1.md)

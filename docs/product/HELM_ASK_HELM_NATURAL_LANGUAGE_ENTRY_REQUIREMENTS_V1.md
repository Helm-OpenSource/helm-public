---
status: active
owner: helm-core
created: 2026-04-25
review_after: 2026-07-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_ASK_HELM_NATURAL_LANGUAGE_ENTRY_REQUIREMENTS_V1

## 1. 目标

冻结一条很窄的 `Ask Helm v1` 产品需求：

- Helm 在当前 workspace 内提供一个自然语言入口
- 它把对象搜索、当前工作区上下文、经营记忆、Helm 系统用法和 LLM 增强收成同一条入口
- 它优先回答：
  - 现在这件事是什么
  - 为什么是这样
  - 下一步去哪
  - 在 Helm 里该怎么继续

这条能力的目标不是再做一个聊天窗口，而是把 Helm 现有的对象、记忆、定义层、帮助层和 LLM explanation 能力收成一个 `workspace-scoped / read-first / action-first` 的自然语言操作入口。

## 2. 问题定义

当前 repo 已经有：

- 顶部搜索入口和 `/search`
- 对象 detail / approvals / memory / operating / reports 等主工作面
- `workspace profileType + focusAreas + member definition + role preset`
- 结构化经营记忆
- LLM explanation / briefing / extraction / enhancement

但它们当前仍是分散使用的：

1. `/search` 只负责对象搜索，不负责“问 Helm”
2. `/memory` 负责稳定上下文和回放，但不负责自然语言解释
3. `definition assist / role foundation / starter skills` 已存在，但还没有作为运行时帮助知识进入统一入口
4. LLM 已经能增强解释，但还没有一个产品级的自然语言入口来消费这些上下文

因此，当前缺口不是“再接一个模型”，而是：

**如何把工作区对象、经营记忆、系统知识和 LLM 收成同一条自然语言入口，并继续保持 Helm 的 judgement-first / review-first / non-chat-first 边界。**

## 3. 当前 repo truth

### 已经完整成立

- `/search` 已经是 workspace 内的对象搜索页，可搜索：
  - 联系人
  - 公司
  - 机会
  - 会议
- 当前 workspace 已有：
  - `profileType`
  - `focusAreas`
  - member definition draft / accepted definition
  - role preset / starter skill preview
- `/memory` 已能承接对象级和工作区级经营记忆
- LLM 当前已有：
  - workspace 级模型配置
  - extraction / briefing / reasoning 槽位
  - fallback 观测与日志
- 产品边界已经明确：
  - Helm 不是另一个 chat window
  - recommendation 不等于 commitment
  - LLM 不负责最终排序、审批、真实写操作决策

### 已成形但仍需下一层

- `/search` 仍是对象直达页，不是自然语言入口
- `Definition Assist`、`Role Foundation`、`starter skill suggestions` 仍主要停在 settings / setup / dashboard，尚未成为 runtime knowledge pack
- `/memory`、detail、approvals、operating 的职责已形成，但还没有被整理成统一、可检索的系统帮助知识层
- 还没有：
  - 自然语言 query contract
  - Ask Helm runtime knowledge pack
  - unified response contract
  - object search + help + memory 的混合结果层

### 刻意未做

- 不做跨租户问答
- 不做开放域聊天
- 不做通用知识平台
- 不做自动执行入口
- 不做新的 workflow / orchestration platform
- 不让 LLM 直接负责：
  - 排序
  - 策略结论
  - 审批
  - 最终状态变更
  - 真实系统写入决策

### 风险项

- 如果把这条能力做成 chat-first，会偏离 Helm 的产品定位
- 如果直接把 repo docs 当知识库喂给模型，答案会过长、失焦且难以保持边界
- 如果让 LLM 直接决定 next step / policy / execution，会破坏 current-main 的 judgement-first truth
- 如果不做 workspace-scoped gating，用户容易把它误解成跨租户知识助手

## 4. 产品定位

`Ask Helm v1` 的定位必须固定为：

- `workspace-first`
- `read-first`
- `action-first`
- `helpful-but-bounded`
- `natural-language entry, not chat product`

一句话定位：

**Ask Helm 是 Helm 在当前 workspace 内的自然语言入口，用来帮助用户快速找到对象、理解当前状态、理解系统建议和边界，并进入下一步工作页面。**

它不是：

- 对外聊天助手
- 组织级知识库问答机器人
- workflow automation copilot
- 无边界执行 agent

## 5. 价值判断

这条能力成立的核心，不是“再加一个 LLM”，而是：

1. Helm 已经有对象 truth
2. Helm 已经有经营记忆
3. Helm 已经有 workspace / member / role foundation
4. Helm 已经有页面职责和治理边界
5. LLM 可以把这些结构化 truth 翻译成自然语言、消解歧义并给出更顺滑的下一步

因此，`Ask Helm` 真正能带来的提升是：

- 比纯对象搜索更强
- 比纯帮助文档更贴业务
- 比通用 LLM 更贴当前 workspace truth
- 比 chat bot 更可控

换句话说：

**Helm 不是靠“模型更大”超越 LLM，而是靠“工作区 truth + 经营记忆 + 系统知识 + 边界治理”超越裸模型。**

## 6. 用户任务与 query intent

### 6.1 产品层支持的 5 类问题

`Ask Helm v1` 第一阶段对用户只暴露 5 类问题：

1. 找对象
   - 例：`帮我找到和 Atlas 相关的机会`
   - 例：`最近和张三有关的会议有哪些`

2. 问当前情况
   - 例：`这个客户现在卡在哪`
   - 例：`今天最该先推进什么`

3. 问为什么
   - 例：`为什么系统建议先做这条`
   - 例：`为什么这条还不能直接执行`

4. 问怎么用 Helm
   - 例：`我怎么把会议结果变成后续动作`
   - 例：`审批和经营记忆的区别是什么`

5. 问下一步去哪
   - 例：`这条事情下一步应该在哪个页面处理`
   - 例：`我要继续跟进这条机会，应该进哪里`

### 6.2 Runtime query intent taxonomy

为了避免实现时把 5 类产品描述直接当作 classifier truth，`Ask Helm v1` 需要一份更细的 runtime taxonomy。

第一阶段建议固定为：

```ts
type AskHelmIntentType =
  | "object_search"
  | "object_recent"
  | "current_status"
  | "today_priority"
  | "why_recommendation"
  | "why_blocked"
  | "how_to_use"
  | "definition_diff"
  | "next_step_page"
  | "next_step_object"
  | "out_of_scope";
```

各 intent 的默认含义：

- `object_search`
  - 例：`找到和 Atlas 相关的机会`
- `object_recent`
  - 例：`最近和张三有关的会议`
- `current_status`
  - 例：`这个客户现在卡在哪`
- `today_priority`
  - 例：`今天最该先推进什么`
- `why_recommendation`
  - 例：`为什么系统建议先做这条`
- `why_blocked`
  - 例：`为什么这条还不能直接执行`
- `how_to_use`
  - 例：`我怎么把会议结果变成后续动作`
- `definition_diff`
  - 例：`审批和经营记忆的区别是什么`
- `next_step_page`
  - 例：`这条事情下一步应该在哪个页面处理`
- `next_step_object`
  - 例：`我要继续跟进这条机会，应该进哪里`
- `out_of_scope`
  - 例：跨租户、开放域、高风险执行要求

## 7. 第一阶段不支持的问题

`Ask Helm v1` 默认不支持：

1. 跨 workspace / 跨租户问题
2. 与当前 workspace 无关的开放域问题
3. 让系统直接代替用户完成高风险动作
4. 让系统直接决定审批、发送、承诺、正式写回
5. 把 repo 全部文档直接当作开放知识库问答

## 8. 自然语言入口的上下文层次

`Ask Helm` 回答问题时，应按下面顺序加载上下文：

### 8.1 当前页面与当前对象

优先使用：

- 当前 route
- 当前 object id / object type
- 当前页面正在看的对象

这是最高优先级，因为自然语言入口应该先理解“用户此刻正在看什么”。

### 8.2 当前 workspace 基础信息

包括：

- workspace id
- workspace slug
- profileType
- focusAreas
- enabled tenant extensions
- membership role
- accepted / draft member definition

### 8.3 对象状态与经营记忆

包括：

- 对象摘要
- current status
- blockers
- commitments
- memory facts
- recent approvals / corrections / timeline context

### 8.4 Helm 系统知识

这层不是 repo docs 原文，而是运行时可消费的 `runtime knowledge pack`，至少应包含：

- 页面职责
- 功能边界
- 操作方式
- 功能可用性
- 常见跳转路径
- feature availability / review requirement
- glossary / alias / 用户常见问法

### 8.5 LLM 增强

LLM 只负责：

- query intent 分类
- 歧义消解
- 摘要
- explanation
- 经营语言增强
- next-step wording

LLM 不负责：

- policy judgement
- final ranking
- permission elevation
- execution authority
- write decision

## 9. Ask Helm 的知识层要求

为了让这条入口成立，系统需要一份最小的 `Ask Helm runtime knowledge pack`。

这份 knowledge pack 不是 docs dump，而是面向 runtime 的窄知识层。

第一阶段至少包含 5 类内容，并固定成最小 schema：

```ts
interface AskHelmKnowledgePack {
  pageResponsibilities: {
    [pagePath: string]: {
      primaryPurpose: string;
      whatItHandles: string[];
      whatItDoesntHandle: string[];
      canonicalFor: string[];
    };
  };
  boundaries: {
    recommendationVsCommitment: string;
    reviewRequiredVsDirect: string;
    explanationVsApproval: string;
    localSuggestionVsOfficialWrite: string;
  };
  featureAvailability: {
    enabledTenantExtensions: string[];
    enabledFeatures: string[];
    disabledFeatures: string[];
  };
  commonOperations: {
    [operationId: string]: {
      steps: string[];
      prerequisites: string[];
      targetPage: string;
    };
  };
  deepLinkMap: {
    objects: Record<string, string>;
    issues: Record<string, string>;
    help: Record<string, { page: string; anchor?: string }>;
  };
}
```

第一阶段的知识层至少覆盖：

1. 页面职责
   - `/search`
   - `/memory`
   - `/approvals`
   - `/operating`
   - detail surfaces
   - `/reports`
   - `/settings`

2. 边界说明
   - recommendation vs commitment
   - review-required vs directly available
   - explanation vs approval
   - local suggestion vs official write

3. 功能可用性
   - 当前 workspace 已启用什么
   - 当前 tenant extension 是否存在
   - 当前页面是否是 canonical handling surface

4. 常见操作说明
   - 如何从 meeting 进入 follow-through
   - 如何从 approval evidence 进入 memory
   - 如何修改 role definition
   - 如何定位对象后继续经营动作

5. Deep link map
   - object -> canonical page
   - issue -> canonical handling page
   - help question -> canonical page / section

## 10. 结果输出 contract

`Ask Helm v1` 的回答不应该是自由聊天式长回答，而应该优先输出结构化结果，再由 UI 决定展示方式。

第一阶段建议固定成下面的 response contract：

```ts
interface AskHelmResponse {
  answer: {
    summary: string;
    explanation?: string;
    confidence: "high" | "medium" | "low";
  };
  relatedObjects?: {
    objects: Array<{
      objectType: string;
      objectId: string;
      displayName: string;
      status: string;
      deepLink: string;
    }>;
    totalCount: number;
  };
  nextStep: {
    primary: {
      type: "deep_link" | "page_target" | "object_target";
      target: string;
      label: string;
    };
    alternatives?: Array<{
      type: "deep_link" | "page_target" | "object_target";
      target: string;
      label: string;
    }>;
  };
  boundaryNote?: {
    type:
      | "review_required"
      | "read_only"
      | "suggestion_not_commitment"
      | "out_of_scope";
    message: string;
  };
  grounding?: {
    currentPage?: string;
    currentObject?: { type: string; id: string };
    workspaceContext: string[];
    memoryUsed: boolean;
    systemKnowledgeUsed: boolean;
  };
}
```

展示优先级保持不变：

1. 直接答案
2. 相关对象或对象组
3. 推荐进入的页面
4. 必要时的边界说明

## 11. UX 入口要求

第一阶段默认不新增独立聊天导航项。

推荐入口是：

1. 复用现有顶部搜索入口
2. 让 `/search` 升级成双模入口：
   - `对象搜索`
   - `问 Helm`

原则：

- 不新增“聊天中心”
- 不让自然语言入口替代主工作页面
- 不让用户停留在长对话里
- 任何回答都尽量把用户送回对象页、memory、approvals 或 operating

建议的双模 UX：

1. 顶部搜索框增加模式切换：
   - `搜索对象`
   - `问 Helm`
2. 进入 `问 Helm` 模式后，placeholder 明确变成自然语言问题
3. 结果层级固定为：
   - 相关对象
   - 直接答案
   - 下一步入口
4. 混合 query 时保持：
   - 对象优先
   - 解释其次
   - 导航收口到 primary next step

## 12. 与当前 `/search` 的关系

当前 `/search` 是 `object jump surface`。

`Ask Helm v1` 应以它为基础升级，而不是平行再做一套新入口。

第一阶段关系应为：

- `/search` 继续保留对象搜索
- 自然语言入口作为 `/search` 的第二模式
- 对象命中优先直接展示对象结果
- 问题命中优先展示解释与下一步
- 混合 query 时允许：
  - 先出对象
  - 再出帮助 / why / next step

## 13. 权限与租户边界

`Ask Helm v1` 必须继续保持：

- 只读当前 workspace
- 不跨租户
- 不跨组织
- 不绕过当前 membership capability
- 不把 tenant custom 信息泄露到无权成员

任何回答都不得：

- 暴露当前 workspace 不可见对象
- 暴露其他租户信息
- 暴露内部治理、结算或 reserved-only truth
- 把“可见建议”误写成“已批准 / 已执行 / 已承诺”

第一阶段实现必须显式包含下面三层检查：

1. `workspace membership`
   - 当前用户必须属于当前 workspace

2. `object read permission`
   - 如果 query 落到具体对象，必须经过对象级可见性检查

3. `capability-aware help scope`
   - 普通成员可以问页面职责、常见操作、为什么当前建议存在
   - 敏感治理、结算、reserved-only internal truth 不进入 Ask Helm 的默认帮助知识层

推荐的 access control 骨架：

```ts
async function askHelmAccessControl(input: {
  userId: string;
  workspaceId: string;
  queryIntent: AskHelmIntentType;
  requestedObjectType?: string;
  requestedObjectId?: string;
}) {
  // 1. 基础 membership 检查
  // 2. 对象级读权限检查
  // 3. capability-aware help scope 裁剪
}
```

## 14. 推荐与 LLM 的职责边界

后续实现时必须继续保持：

- deterministic retrieval first
- structured context first
- LLM explanation second

保持下面三条不变：

1. recommendation engine 决定候选召回、排序、policy filtering
2. Ask Helm 负责把工作区事实和系统职责解释清楚
3. LLM 负责自然语言增强，不负责越权决策

## 15. 第一阶段成功标准

不要用“聊得像不像聊天助手”来判断成功。

第一阶段应该看：

1. 用户能否在当前 workspace 内用自然语言更快找到对象
2. 用户能否更快理解当前状态和系统建议
3. 用户能否更快进入正确工作页面
4. 用户是否更少迷失在：
   - `/search`
   - `/memory`
   - `/approvals`
   - `/operating`
   - detail surfaces

第一阶段建议成功指标：

- 80% 以上自然语言 query 能被稳定归入 `AskHelmIntentType` 中的支持类型
- 70% 以上回答能带出一个明确 next step 或 deep link
- 0 条跨租户数据泄露
- 0 条把 suggestion 误写成 commitment / execution truth 的严重边界事故

## 16. 分阶段实现建议

### Phase 0：Requirements freeze

- 冻结 Ask Helm 的问题范围
- 冻结 query intent taxonomy
- 冻结 system knowledge pack 最小字段
- 冻结 response contract

### Phase 1：Read-only query interpreter

- 先做 query intent classifier 的离线样本评估
- 新增自然语言 query classifier
- 只接：
  - object search
  - workspace summary
  - memory summary
  - system knowledge pack
- 不接任何 write path

### Phase 2：`/search` 双模入口

- `/search` 增加 `对象搜索 / 问 Helm`
- 先做双模 UI 原型和层级验证
- 支持混合 query
- 支持 deep link / object result / help answer

### Phase 3：Knowledge pack hardening

- 把页面职责、功能可用性、边界说明整理成 runtime knowledge pack
- 让 tenant extension / feature availability 进入 read-only resolution
- 支持 knowledge pack 的窄热更新，不要求每次改帮助知识都重新部署整个应用

### Phase 4：Object-context refinement

- 当前页面 / 当前对象 / 当前审批上下文进入优先级更高的问答分流
- 让 Ask Helm 更像“在当前工作流里解释下一步”，而不是泛问泛答

## 17. 非目标

本需求明确不包括：

1. 完整 chat center
2. agent orchestration 入口
3. 自动审批 / 自动执行
4. 跨租户知识助手
5. docs 全量 RAG 平台
6. 完整 help center / academy / onboarding knowledge platform
7. conversation history 持久化
8. follow-up question 引导式多轮对话
9. “你可能还想知道” 这类停留型推荐问答

## 18. 下一步最合理的工作

1. 定义 `Ask Helm query taxonomy`
2. 定义 `runtime knowledge pack` 最小 schema
3. 定义 `Ask Helm response contract`
4. 设计 `/search` 双模 UI
5. 再决定是否进入 read-only implementation plan

---
status: active
owner: helm-core
created: 2026-04-25
review_after: 2026-07-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Ask Helm Action Intent Requirements V2

更新时间：2026-04-26
状态：Implemented minimum baseline

## 1. 当前是否已经实现

结论：已经实现了 `Ask Helm v1` 的 read-only baseline，并在 2026-04-26 完成了 `Ask Helm Action Intent v2` 的最小可验证实现加 `P1 validation hardening`。当前实现已经覆盖 action intent taxonomy、plan / draft / review packet / handoff response contract、real-user phrasing eval backfill、`/search` 展示层、`/search?mode=ask` Playwright E2E 和 transcript-only voice baseline；DB-backed internal queue write、LLM rewrite 和真实录音输入仍属于下一层。

当前已经实现：

- 用户可以在 `/search` 进入 `搜索对象 / 问 Helm` 双模
- Ask Helm 能识别并回答：
  - 找对象
  - 最近对象 / 最近互动
  - 当前状态
  - 今天优先事项
  - 为什么推荐
  - 为什么阻塞
  - 怎么用 Helm
  - 定义差异
  - 下一步页面 / 下一步对象
  - 计划分解
  - 草稿准备
  - 复核材料准备
  - 内部跟进队列草稿
  - handoff 请求
  - 受控执行请求
  - review-required execution
  - 开放域拒绝 / 跨 workspace 拒绝
- 返回结构包含：
  - related objects
  - answer
  - next step
  - plan
  - prepared artifact
  - action handoff
  - voice metadata
  - boundary note
  - grounding
- draft action plan steps 已带：
  - `objectRef`
  - `suggested DRI`
  - `suggested due`
- 权限边界已经有 baseline：
  - current-workspace-only
  - read-only
  - official write path denied
  - reserved / settlement / payment / auto-send / auto-approve denied

当前仍未实现的下一层：

- 把 internal follow-up 从 handoff contract 写入 DB-backed operating queue
- 把当前 `suggested DRI / due` 升级成真实负责人、真实截止时间、幂等键和 dismiss / undo
- 对草稿 / 复核材料接 policy-preserving LLM rewrite
- 接浏览器语音识别或移动端录音入口
- 对语音低置信度 / 金额 / 承诺 / 审批词做更细的 transcript confirmation gate

所以当前入口是：

`search or ask -> understand intent -> answer or plan -> prepare handoff -> route to review / operating / object`

语音能力应被视为同一入口的输入和反馈增强，不是新的执行权限。它把用户说的话转成同一套 action intent contract，再走同样的 access scope、review boundary 和 audit policy。

## 2. 为什么“回答、计划分解、编排执行”是正常需求

用户在自然语言入口里输入的问题，通常不只是信息检索。

它可能表达三类真实工作意图：

1. 认知意图
   - “这个客户现在卡在哪”
   - “为什么建议先做这条”
   - “审批和经营记忆有什么区别”

2. 计划意图
   - “这件事下一步怎么推进”
   - “帮我拆一下这个机会的推进计划”
   - “今天先做哪三件事”

3. 执行意图
   - “帮我安排跟进”
   - “把这件事推进下去”
   - “准备一封 follow-up”
   - “发给客户”

这些都是用户正常行动需求。区别不在于“能不能理解”，而在于 Helm 能做到哪一层、必须在哪一层停住并要求复核。

## 3. V2 产品定位

`Ask Helm Action Intent v2` 的定位：

**Ask Helm 不只是搜索入口，而是当前 workspace 的行动意图入口：它能理解用户要找、要问、要拆、要准备、要推进什么，并把结果收口到可审计、可复核、可继续执行的 Helm 工作面。**

它仍然不是：

- chat center
- open-domain agent
- full workflow engine
- automatic approval system
- payment execution surface
- external-send authority

## 4. 新增用户任务

V2 应新增 6 类任务。

### 4.1 回答

用户目标：

- 获得当前状态、原因、边界和下一步

示例：

- `这个客户卡在哪`
- `为什么系统建议先推进 Atlas`

系统行为：

- 读取对象、记忆、knowledge pack
- 生成解释
- 给出 primary next step

边界：

- explanation 不等于承诺
- recommendation 不等于 commitment

### 4.2 计划分解

用户目标：

- 把问题拆成下一步计划

示例：

- `帮我拆一下星河连锁恢复单接下来怎么推进`
- `这个风险怎么处理，给我一个计划`

系统行为：

- 生成 draft plan
- 拆出步骤、依赖、风险、建议 owner、检查点
- 每一步给出 target surface

边界：

- plan 是 draft，不自动成为任务 truth
- owner 是建议，不自动分配
- due date 是建议，不自动承诺

### 4.3 准备执行

用户目标：

- 准备可执行材料，但还不真正发送或写回

示例：

- `帮我准备一封 follow-up`
- `准备审批材料`
- `生成会议后的行动清单`

系统行为：

- 生成 draft artifact
- 标记 review requirement
- 跳到 approvals / operating / object detail

边界：

- draft 不等于 sent
- prepared 不等于 approved
- action list 不等于正式执行记录

### 4.4 低风险编排

用户目标：

- 让 Helm 帮忙把低风险、内部、可撤销的动作排进工作流

示例：

- `把这个 follow-up 放到今天 operating 队列`
- `把这条机会标记为需要复核`

系统行为：

- 只允许进入 internal queue / review request / draft handoff
- 必须生成 audit trail
- 必须支持撤销或 dismiss

边界：

- 只做内部排队和准备
- 不对外发送
- 不改 official customer-facing state

### 4.5 高风险执行请求

用户目标：

- 让系统代替用户执行发送、审批、付款、正式写回等高风险动作

示例：

- `直接发给客户`
- `批准这条`
- `确认付款`
- `更新正式状态`

系统行为：

- 不直接执行
- 生成 review-required response
- 明确原因和下一步 approval path

边界：

- 高风险执行请求不是 out-of-scope；它是 supported-but-review-required
- 系统可以准备材料，但必须在 review / approval 停住

### 4.6 语音输入与朗读

用户目标：

- 不打字也能问状态、拆计划、准备材料或请求下一步
- 在移动端、会议后或操作中快速发起 Ask Helm
- 让系统朗读简短回答、计划摘要和边界提醒

示例：

- 用户按住麦克风说：`帮我拆一下星河连锁恢复单接下来怎么推进`
- 用户说：`今天我先做哪三件事`
- 用户说：`准备一封 follow-up，但先不要发`
- 用户要求：`读一下为什么这条不能直接执行`

系统行为：

- 将 speech transcript 作为 Ask Helm query 输入
- 显示 transcript，允许用户编辑后再提交
- 对 plan / execution / review-required intent 必须展示可见确认，不允许仅凭语音确认进入高风险路径
- 可朗读：
  - answer summary
  - plan summary
  - next step
  - boundary note

边界：

- voice input 不提升权限
- voice confirmation 不替代 review / approval
- 不默认持续监听
- 不在未确认场景保存原始音频
- 语音转写错误必须可见、可编辑、可取消
- 高风险动作不能用“说一句确认”绕过审批

## 5. V2 Runtime Intent Taxonomy

V2 不应简单把高风险请求继续归为 `out_of_scope`。

建议从 v1 的 11 类扩展为：

```ts
type AskHelmIntentTypeV2 =
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
  | "plan_breakdown"
  | "prepare_draft"
  | "prepare_review_packet"
  | "queue_internal_followup"
  | "request_handoff"
  | "request_execution"
  | "review_required_execution"
  | "unsupported_open_domain"
  | "cross_workspace_denied";
```

关键变化：

- `request_execution` 表示用户提出执行需求
- `review_required_execution` 表示 Helm 可以承接但必须停在复核
- `unsupported_open_domain` 才是真正开放域不支持
- `cross_workspace_denied` 是权限边界

## 6. Response Contract 扩展

V2 response 应扩展为：

```ts
interface AskHelmActionIntentResponse {
  classification: AskHelmQueryIntentClassification;
  retrievalPlan: AskHelmRetrievalPlan;
  answer: {
    summary: string;
    explanation?: string;
    confidence: "high" | "medium" | "low";
  };
  plan?: {
    status: "draft" | "review_required" | "ready_to_queue";
    steps: Array<{
      title: string;
      rationale: string;
      targetSurface: string;
      riskLevel: "low" | "medium" | "high";
      reviewRequired: boolean;
    }>;
    assumptions: string[];
    blockers: string[];
  };
  preparedArtifact?: {
    type: "draft_message" | "review_packet" | "task_list" | "handoff_note";
    status: "draft_only" | "review_required";
    targetSurface: string;
  };
  actionHandoff?: {
    mode: "open_page" | "queue_internal" | "request_review" | "deny";
    target: string;
    auditLabel: string;
  };
  voice?: {
    inputMode: "typed" | "voice";
    transcript?: string;
    transcriptConfidence?: "high" | "medium" | "low";
    requiresTranscriptConfirmation: boolean;
    speakableSummary?: string;
    speakableBoundary?: string;
  };
  boundaryNote: {
    type:
      | "read_only"
      | "draft_only"
      | "review_required"
      | "suggestion_not_commitment"
      | "execution_denied"
      | "cross_workspace_denied";
    message: string;
  };
}
```

## 7. Governance Matrix

| 用户需求 | Helm 可以做 | 必须停住的地方 |
| --- | --- | --- |
| 找对象 | 搜索并打开对象 | 无 |
| 问状态 / 为什么 | 回答并解释证据 | 不形成承诺 |
| 拆计划 | 生成 draft plan | 不自动分配 / 不自动承诺 |
| 准备 follow-up | 生成 draft | 不自动发送 |
| 准备审批材料 | 生成 review packet | 必须进入 approvals |
| 排内部跟进 | 进入 internal queue | 必须可撤销 / 可审计 |
| 发客户邮件 | 准备草稿 + review | 不能直接发送 |
| 审批 / 批准 | 解释 + 打开 approval | 不能替人批准 |
| 付款 / 正式写回 | 拒绝直接执行 + review path | 不能通过 Ask Helm 执行 |
| 跨 workspace 查询 | 拒绝 | 不加载跨租户上下文 |
| 语音提问 | 转写后进入同一套 intent / response contract | 转写必须可见可编辑，高风险不能仅靠语音确认 |

## 8. 成功标准

V2 成立的最低标准：

1. 至少 80% 行动型 query 能分到正确 intent
2. 所有计划型 response 必须带 plan status 和 boundary note
3. 所有执行型 response 必须区分 low-risk internal queue 与 review-required execution
4. 高风险执行请求不能再被简单丢成 generic out-of-scope，而要返回 review path
5. 没有任何 Ask Helm path 打开 official write / send / approve / payment
6. UI 不变成聊天中心，仍然以 answer / plan / next step / boundary 为主
7. voice input 与 typed input 使用同一套 intent、access scope 和 review boundary
8. 语音转写低置信度、含金额/承诺/审批/发送等高风险词时必须要求显式文本确认

## 9. Stop Conditions

出现以下情况应暂停：

1. planning intent 经常被误判为 direct execution
2. review-required execution 被误展示成可以直接执行
3. draft artifact 被用户理解成已经发送 / 已经批准
4. low-risk queue 写入没有 audit / undo / dismiss
5. action plan 没有 target surface，用户无法继续
6. LLM 改写影响了 policy / review requirement / permission boundary
7. 语音转写错误导致错误对象、错误金额、错误承诺或错误执行意图
8. 语音确认绕过 review / approval / transcript confirmation

## 10. 下一步实施建议

1. 先扩展 query intent taxonomy 和黄金样本
2. 再扩展 interpreter response contract
3. 先做 planning / draft-only，不做 queue write
4. 再做 internal queue handoff，并要求 audit / undo / dismiss
5. 语音输入先做 transcript-only，不接高风险执行确认
6. 最后才评估是否接入 LLM rewrite 与语音朗读优化

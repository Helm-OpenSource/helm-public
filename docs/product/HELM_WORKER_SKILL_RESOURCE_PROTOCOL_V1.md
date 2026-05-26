---
status: active
owner: helm-core
created: 2026-03-27
review_after: 2026-06-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Worker / Skill / Resource 协议 V1

## 一、文件目的

本协议用于定义 Helm 在下一阶段如何把 `worker / skill / resource / execution` 关系收成一条可治理、可审计、可回放、可扩展的主干。

目标有三项：

1. 把“谁在工作、会什么能力、底层调什么资源、最终由谁治理”四件事拆清楚。
2. 让 role-based packs、usage scenarios、proposal / package / commitment 链条都能挂到同一套 contract 上继续长。
3. 让 Helm 后续扩展数字员工时，仍然留在 controlled-trial、review-first、non-commitment 的边界内。

## 二、分层总图

```text
┌───────────────────────────────────────────────────────────────┐
│                        Helm Control Plane                    │
│ review / approval / replay / audit / memory / boundary      │
│ workspace / membership / authority / escalation / package   │
└───────────────────────────────────────────────────────────────┘
                              │
                              │ governs
                              ▼
┌───────────────────────────────────────────────────────────────┐
│                         Role Worker Layer                    │
│ “谁在工作”                                                   │
│ 角色、职责、边界、升级、输出模式、责任归属                   │
└───────────────────────────────────────────────────────────────┘
                              │
                              │ selects / orchestrates
                              ▼
┌───────────────────────────────────────────────────────────────┐
│                           Skill Layer                        │
│ “会什么能力”                                                 │
│ 能力单元、输入输出、适用场景、风险等级、是否可对外           │
└───────────────────────────────────────────────────────────────┘
                              │
                              │ binds
                              ▼
┌───────────────────────────────────────────────────────────────┐
│                    Resource Binding Layer                    │
│ “这个 skill 绑定哪些可调用资源”                              │
│ resource mapping / auth mode / workspace scope / audit hint  │
└───────────────────────────────────────────────────────────────┘
                              │
                              │ invokes
                              ▼
┌───────────────────────────────────────────────────────────────┐
│                 ClawHub / OpenClaw / NemoClaw                │
│                    Resource & Execution Layer                │
│ API / connector / browser / workflow / data / tool runtime  │
└───────────────────────────────────────────────────────────────┘
```

## 三、四层各自负责什么

### 1. Helm Control Plane

这一层负责治理和总控：

- workspace / membership
- authority / ownership continuity
- review / escalation
- replay / audit / memory
- package / proposal / conversation / external-safe boundary

这一层决定：

- 能不能做
- 需不需要 review
- 能不能对外
- 出问题归谁
- 结果怎么回放

### 2. Role Worker Layer

这一层负责角色对象，例如：

- Founder Assistant Worker
- Sales Assistant Worker
- Delivery Assistant Worker
- Customer Success Assistant Worker

这一层决定：

- 角色是谁
- 职责边界是什么
- 该调哪些 skill
- 什么时候停下来升级给人工

### 3. Skill Layer

这一层负责能力对象，例如：

- Follow-up Draft Skill
- Activation Checklist Skill
- Expansion Review Skill
- Boundary Clarification Skill

这一层决定：

- 这个能力做什么
- 输入输出长什么样
- 适用在哪些场景
- 风险级别多高
- 能不能 customer-facing

### 4. Resource Binding / Resource & Execution Layer

这一层负责底层资源，例如：

- CRM Resource
- Email Draft Resource
- Docs Query Resource
- Workspace State Resource
- Membership State Resource
- Callback Status Resource
- Usage Signal Resource
- Proposal Context Resource

这一层只回答：

- 调哪个资源
- 怎么调
- 调用结果是什么

## 四、分层原则

核心原则只有一句话：

- Worker 定义角色
- Skill 定义能力
- Resource 定义执行供给
- Control Plane 定义治理

后续 Helm 与 ClawHub 的正确关系必须保持为：

`Helm Worker -> Helm Skill -> ClawHub Resource -> Execution`

这意味着：

- 可以直接复用 ClawHub 的 connector、API 资源、workflow runtime、auth context 和 execution endpoint。
- 不能把 ClawHub 直接当成 Helm 的 worker、skill 治理层或 review / audit / memory / boundary 控制层。

## 五、为什么这样分层

这样分层的目的，是避免后续把 worker 写成一堆 prompt 容器，或者把 resource 误写成直接统治产品逻辑的平台层。

例如“Sales Assistant Worker”可以调用：

- Follow-up Draft Skill
- Boundary Clarification Skill

而这些 skill 再去绑定：

- CRM Resource
- Email Draft Resource
- Docs Query Resource

真正决定“能不能发、需不需要 review、是否会形成 commitment”的，仍然是 Helm Control Plane，而不是 worker 或 resource 自己。

## 六、字段草案

### A. Worker 字段

当前第一版最关键的 8 个字段：

- `workerRole`
- `responsibilityScope`
- `responsibilityBoundary`
- `defaultSkills`
- `reviewMode`
- `escalationMode`
- `outputMode`
- `authorityBoundary`

### B. Skill 字段

当前第一版最关键的 10 个字段：

- `skillType`
- `inputSchema`
- `outputSchema`
- `scenarioTypes`
- `riskLevel`
- `requiresReview`
- `allowsAutoExecution`
- `customerFacingAllowed`
- `nonCommitmentOnly`
- `resourceBindings`

### C. Resource Binding 字段

当前第一版最关键的 8 个字段：

- `resourceId`
- `resourceType`
- `resourceCapability`
- `invocationMode`
- `authMode`
- `workspaceScope`
- `riskLevel`
- `auditHint`

### D. Resource 字段

当前第一版保留最小资源描述：

- `resourceId`
- `resourceName`
- `resourceType`
- `resourceSummary`
- `provider`
- `authRequirement`
- `workspaceSupport`
- `tenantBoundaryHint`
- `inputContract`
- `outputContract`
- `auditSupport`
- `replaySupport`

### E. 横切字段：effectMode

为避免“能调资源”被误解成“可以直接形成客户副作用”，第一版必须额外固定：

- `effectMode`

当前建议取值：

- `read_only`
- `draft_only`
- `internal_write`
- `customer_visible_send`

Sprint 1 的 controlled-trial contract 里：

- `customer_visible_send` 不能作为自主执行能力开放给 skill
- customer-facing skill 必须 `requiresReview = true`
- customer-facing skill 必须 `nonCommitmentOnly = true`

## 七、三条代表性调用路径

### 1. Sales follow-up draft

`Sales Assistant Worker -> Follow-up Draft Skill -> CRM Resource + Email Draft Resource + Docs Query Resource -> Control Plane review`

输出：

- internal draft
- boundary note
- review-before-send

### 2. Delivery activation checklist

`Delivery Assistant Worker -> Activation Checklist Skill -> Workspace State Resource + Membership State Resource + Callback Status Resource -> Control Plane readiness check`

输出：

- activation summary
- readiness status
- internal next-step

### 3. Customer success expansion review

`Customer Success Assistant Worker -> Expansion Review Skill -> Usage Signal Resource + Success Review Resource + Proposal Context Resource -> Control Plane boundary / non-commitment check`

输出：

- internal-only recommendation
- next-step suggestion
- boundary summary

## 八、Sprint 1 建议范围

Sprint 1 最稳的做法，不是直接做完整数字员工，而是先做：

`Worker / Skill / Resource Contract Sprint 1`

第一版只要求做到：

1. 冻结 `Worker / Skill / ResourceBinding / Resource` 的 canonical schema。
2. 冻结最小枚举值、effectMode 和受控边界。
3. 跑通 3 条代表链路：
   - `sales_followup`
   - `delivery_activation_checklist`
   - `success_expansion_review`
4. 把 review / audit / replay / memory / boundary 继续留在 Control Plane。
5. 把文档、守卫、自检、测试同步起来。

当前这条主线已经继续推进到 Sprint 2 catalog 扩展，重点是：

- objection handling
- proposal shaping
- review note
- risk clarification
- 更细的 representative flows

对应增量见：

- [`HELM_WORKER_SKILL_RESOURCE_CONTRACT_SPRINT_2_REPORT.md`](HELM_WORKER_SKILL_RESOURCE_CONTRACT_SPRINT_2_REPORT.md)

## 九、当前刻意不做的事

当前协议明确不做：

- 完整 orchestration platform
- 完整 workflow engine
- 完整 worker console
- 完整 marketplace
- 完整 sandbox runtime
- 完整 enterprise IAM / org admin
- 越权自动承诺
- 越权自动发送 customer-visible 内容

## 十、必须继续诚实保留的边界

1. plugin runtime 仍没有真正 sandbox。
2. OpenShell / OpenClaw / NemoClaw 当前仍是更接近真实 adapter / process 的最小外部桥接目标。
3. 当前系统仍不是完整企业级多组织 / 多权限 / 多租户平台。
4. 当前主动机制仍默认以“建议、准备、升级”为主，不默认拥有高风险自动承诺和高风险自动发送权限。
5. 任何 customer-facing wording 只要有被误解成 commitment 的风险，默认降级为：
   - boundary note
   - prerequisite note
   - dependency note
   - non-commitment note

## 十一、结论

Helm 下一阶段最值得做的，不是先做“看起来很像数字员工的最终产物”，而是先把：

`Worker / Skill / Resource Contract`

做成一条可治理、可审计、可回放、可扩展的主干。

只有这样，后面的 founder、sales、delivery、customer success worker 才不会散成一堆难以治理的 prompt 和 runtime 入口。

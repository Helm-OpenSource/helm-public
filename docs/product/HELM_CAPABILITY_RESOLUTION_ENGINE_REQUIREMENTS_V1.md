---
status: active
owner: helm-core
created: 2026-04-22
review_after: 2026-07-21
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Capability Resolution Engine Requirements V1

更新时间：2026-04-22  
状态：Requirements Freeze

## 1. 目的

这份需求用于冻结 Helm 下一阶段另一条最高优先级 harness 基础设施升级：

- `Capability Resolution Engine`

它要解决的不是“加更多权限功能”，而是：

- 把当前散落在 route、action、service、boundary script、workspace ownership guard、review gate 里的 capability / policy / fallback 判断，收成一条统一、可解释、可审计的求值流水线

## 2. 当前主干前提

这份需求建立在以下 current-main truth 上：

- Helm 仍是 `workspace-first`
- Helm 仍是 `membership-backed`
- Helm 仍是 `judgement-first`
- Helm 仍是 `review-first`
- 当前已存在多租户 capability / tenant ownership 治理基线
- 当前已存在大量 route/service guard，但还不是统一 resolution engine
- `plugin runtime` 仍没有真正 sandbox

## 3. 目标

本轮需求的目标有 6 项：

1. 明确 capability resolution 的统一输入
2. 明确统一求值顺序与 precedence
3. 明确统一输出结果与 reason codes
4. 明确 review / escalation / fallback posture
5. 明确 audit trace 与 operator explainability
6. 为 future extension bundle、monitor substrate、swarm isolation 提供共同 authority foundation

## 4. 非目标

本轮明确不做：

- full RBAC builder
- enterprise IAM / SSO / SCIM
- broad auto-write
- broad auto-send
- sandbox
- execution authority 扩面
- 对所有 legacy path 一次性重写

## 5. 适用范围

第一版 capability resolution 默认适用于：

- operator-facing route / action
- official action intent
- extension runtime invocation
- worker / skill / resource invocation boundary
- future monitor-triggered action proposal

第一版不直接适用于：

- 低风险 telemetry write
- 纯外部 provider webhook ingress
- 不带业务副作用的只读 internal helper

## 6. 核心原则

### 6.1 deny-first

任何动作在 capability declaration、workspace scope、ownership、review posture 不明确时，默认：

- 不放行
- 或降级到 `route_to_review`

### 6.2 action-level resolution

Capability resolution 的最小判断单位必须是“动作”，不是“页面”或“模块”。

### 6.3 workspace / ownership 优先

只要动作涉及对象、租户、客户、外部副作用，默认先判断：

- active workspace
- membership
- ownership / entitlement / reserved posture

### 6.4 recommendation 与 execution 分离

只要属于：

- draft
- recommendation
- explanation
- review preparation

默认不得和：

- official write
- external send
- commitment-like effect

混在同一层 capability 结果里。

### 6.5 capability source 必须可解释

这次为什么被允许 / 被拒绝 / 被要求 review，必须能追溯到：

- 哪条 manifest declaration
- 哪条 policy source
- 哪个 hard boundary
- 哪个 workspace / membership / ownership truth

## 7. Resolution 输入模型

第一版统一输入至少包含：

- `actorIdentity`
- `actorType`
- `activeWorkspaceId`
- `workspaceClass`
- `membershipPosture`
- `targetObjectType`
- `targetObjectScope`
- `requestedCapability`
- `effectMode`
- `customerFacingIntent`
- `bundleIdentity`
- `workerIdentity`
- `skillIdentity`
- `resourceIdentity`
- `requestSource`
- `reviewContext`

其中：

- `actorType` 至少区分 `user / operator / system / extension / monitor`
- `effectMode` 至少区分 `read_only / draft_only / internal_write / customer_visible_send`
- `customerFacingIntent` 必须显式表达是否可能被客户误读为 commitment

## 8. Policy Sources

第一版统一政策来源至少包括：

1. Helm hard boundary
2. workspace / membership truth
3. ownership / reserved tenant posture
4. bundle capability declaration
5. worker / skill / resource contract
6. route / action specific policy
7. review override / manual acknowledgement posture

这些 source 必须有 precedence，不能靠调用方自由拼接。

## 9. 统一求值顺序

第一版建议冻结以下求值顺序：

### Step 1：Resolve workspace truth

先判断：

- active workspace 是否存在
- actor 是否属于该 workspace
- 当前动作是否落在正确 workspace scope

### Step 2：Resolve actor posture

再判断：

- actor 是谁
- actor 是普通成员、operator、system 还是 extension runtime
- 是否具备进入下一步的基础 posture

### Step 3：Resolve target ownership and boundary

再判断：

- 目标对象是否属于当前 workspace
- 是否属于 reserved-only 域
- 是否属于高风险 customer-facing 域

### Step 4：Resolve declaration truth

再判断：

- bundle 是否声明该能力
- worker / skill / resource 是否声明该能力
- 是否越过 `maxEffectMode`

### Step 5：Resolve hard boundary

再判断：

- 是否命中 `no auto-send`
- 是否命中 `no broad auto-write`
- 是否命中 `recommendation != commitment`
- 是否命中其他 current-main hard boundary

### Step 6：Resolve review requirement

再判断：

- 这次是否必须 review
- 是否可 route_to_review
- 是否只能 ask_human / manual fallback

### Step 7：Emit decision trace

最后输出：

- result
- reason
- source chain
- fallback posture
- audit payload

## 10. 输出结果模型

第一版统一输出结果至少包含：

- `allow`
- `allow_draft_only`
- `route_to_review`
- `ask_human`
- `deny`

禁止把 “能继续生成建议” 和 “能执行外部副作用” 混成同一个 `allow`。

## 11. Reason Codes

第一版必须输出统一 reason code，而不是只给自由文本。

最低要求覆盖：

- `workspace_missing`
- `membership_missing`
- `ownership_mismatch`
- `reserved_only`
- `capability_not_declared`
- `effect_mode_exceeded`
- `customer_facing_review_required`
- `hard_boundary_blocked`
- `manual_ack_required`
- `unsupported_runtime_posture`

## 12. Review / Fallback Posture

第一版默认保留以下降级路径：

- `allow -> draft_only` 降级
- `allow -> route_to_review` 降级
- `route_to_review -> ask_human`
- `ask_human -> deny`

不得出现：

- 因为 review queue 不可用而自动放开执行
- 因为 manifest 缺失而静默 fallback 成 allow

## 13. Explainability / Audit 要求

每一次 capability decision 至少要能解释：

1. 谁请求的
2. 对哪个 workspace / 对象
3. 请求了什么 capability
4. 结果是什么
5. 是哪条 source 导致这个结果
6. 是否被降级
7. 是否进入 review / manual fallback

第一版至少要支持 operator-facing decision trace readout，不要求一开始就 customer-facing。

## 14. 接入顺序

### Phase 0

- 只冻结需求
- 不改 route 行为

### Phase 1

- 先在一小组高风险 path 上输出 read-only decision trace
- 不改最终决策，只校验现状能否被统一解释

### Phase 2

- 再让 selected path 切到 capability engine 做最终决策
- 优先 reserved-only / official action / customer-facing risk path

### Phase 3

- 再逐步扩到 extension runtime、monitor-triggered proposal、future swarm write gate

## 15. 验证要求

只要 capability resolution engine 开始接入，默认同步：

- `README.md`
- `docs/README.md`
- capability / tenancy governance docs
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- 对应 runtime tests

第一版验证至少包含：

1. 输入模型完整性验证
2. precedence 验证
3. deny-first 验证
4. `draft_only` 与 `customer_visible_send` 分离验证
5. reserved-only 与 ownership mismatch 验证
6. decision trace completeness 验证

## 16. 风险

1. 如果 capability engine 过早扩到所有路径，会把简单路径也变得过重
2. 如果 precedence 不明确，会让不同调用方继续绕过统一判断
3. 如果输出只有 `allow / deny` 两态，会失去 Helm 最重要的 review-first / draft-first 边界
4. 如果 explainability 没做好，operator 会感知成“权限系统更复杂了”，而不是“为什么被拦更清楚了”

## 17. 完成定义

满足以下条件，才算这条需求基线成立：

1. capability resolution 的输入、输出、precedence、reason code、fallback posture 已经冻结
2. 与 current-main 的 workspace / membership / ownership / hard boundary 语义不冲突
3. rollout 顺序明确，先 trace、后窄接入、再扩面
4. recommendation / commitment 边界仍保持稳定

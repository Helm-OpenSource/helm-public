---
status: active
owner: helm-core
created: 2026-04-22
review_after: 2026-07-21
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Capability Decision Trace Read Model Draft V1

更新时间：2026-04-22  
状态：Design Draft

## 1. 目的

这份 draft 只回答一个问题：

- 当 Helm 引入 `Capability Resolution Engine` 后，operator-facing 的 `decision trace` 读模型应该长什么样，才能既解释清楚“为什么被允许/被拦/被降级”，又不把系统写成 broad execution authority plane

## 2. 当前 truth source

这份 draft 显式建立在以下文档之上：

- [HELM_CAPABILITY_RESOLUTION_ENGINE_REQUIREMENTS_V1.md](/Users/tommyqian/Documents/GitHub/helm2026/docs/product/HELM_CAPABILITY_RESOLUTION_ENGINE_REQUIREMENTS_V1.md)
- [HELM_MULTITENANCY_CAPABILITY_AND_TENANT_OWNERSHIP_GOVERNANCE_BASELINE_V1.md](/Users/tommyqian/Documents/GitHub/helm2026/docs/product/HELM_MULTITENANCY_CAPABILITY_AND_TENANT_OWNERSHIP_GOVERNANCE_BASELINE_V1.md)
- [HELM_EXTENSION_BUNDLE_AND_CAPABILITY_MANIFEST_REQUIREMENTS_V1.md](/Users/tommyqian/Documents/GitHub/helm2026/docs/product/HELM_EXTENSION_BUNDLE_AND_CAPABILITY_MANIFEST_REQUIREMENTS_V1.md)
- [HELM_V2_2_COORDINATION_TRACE_BASELINE_V1.md](/Users/tommyqian/Documents/GitHub/helm2026/docs/product/HELM_V2_2_COORDINATION_TRACE_BASELINE_V1.md)

## 3. 设计目标

第一版 read model 只追求 5 件事：

1. 把 capability decision 的输入、结果、原因链、fallback 姿态读清楚
2. 让 operator 看到“为什么是这个结果”
3. 让 review-first / draft-first / deny-first 能被稳定表达
4. 让 trace 可用于 diagnostics / audit / runtime debugging
5. 不把它写成新的 execution graph 平台

## 4. 非目标

第一版 draft 明确不做：

- 完整 event sourcing
- 全局 workflow graph
- customer-facing trace
- public policy explorer
- write authority expansion

## 5. 顶层对象

第一版建议统一为：

```ts
type CapabilityDecisionTrace = {
  traceId: string;
  decidedAt: string;
  actor: CapabilityDecisionActor;
  request: CapabilityDecisionRequest;
  context: CapabilityDecisionContext;
  evaluation: CapabilityDecisionEvaluation;
  result: CapabilityDecisionResult;
  fallback: CapabilityDecisionFallback;
  audit: CapabilityDecisionAudit;
};
```

## 6. 字段分组

### 6.1 Actor

```ts
type CapabilityDecisionActor = {
  actorIdentity: string;
  actorType: "user" | "operator" | "system" | "extension" | "monitor";
  activeWorkspaceId: string | null;
  workspaceClass: string | null;
  membershipPosture: string | null;
};
```

目的：

- 让 operator 先看清是谁请求的
- 避免把 extension / monitor / user 混成一个 actor posture

### 6.2 Request

```ts
type CapabilityDecisionRequest = {
  requestedCapability: string;
  effectMode: "read_only" | "draft_only" | "internal_write" | "customer_visible_send";
  customerFacingIntent: boolean;
  requestSource: string;
  targetObjectType: string | null;
  targetObjectScope: string | null;
};
```

目的：

- 让 operator 先区分“这是读、草稿、内部写还是 customer-visible send”
- 把 request source 留痕，后续才能解释不同 surface 行为

### 6.3 Context

```ts
type CapabilityDecisionContext = {
  bundleIdentity: string | null;
  workerIdentity: string | null;
  skillIdentity: string | null;
  resourceIdentity: string | null;
  targetOwnershipPosture: string | null;
  reservedOnly: boolean;
  reviewContext: string | null;
};
```

目的：

- 把 bundle / worker / skill / resource 关联真值并列读出
- 把 reserved-only 和 ownership posture 放到同一层

### 6.4 Evaluation

```ts
type CapabilityDecisionEvaluation = {
  sourceChain: CapabilityDecisionSourceStep[];
  primaryReasonCode: string;
  secondaryReasonCodes: string[];
  downgraded: boolean;
  downgradePath: string[];
};
```

其中：

```ts
type CapabilityDecisionSourceStep = {
  step:
    | "workspace_truth"
    | "actor_posture"
    | "target_ownership"
    | "declaration_truth"
    | "hard_boundary"
    | "review_requirement";
  sourceType: string;
  sourceRef: string | null;
  outcome: "pass" | "warn" | "block";
  note: string;
};
```

目的：

- 让 operator 看见具体是哪一步导致 block 或 downgrade
- 保持 precedence 可解释

### 6.5 Result

```ts
type CapabilityDecisionResult = {
  decision: "allow" | "allow_draft_only" | "route_to_review" | "ask_human" | "deny";
  boundaryNotes: string[];
  nonCommitmentNotes: string[];
};
```

目的：

- 把最终结果和 boundary note 明确分开
- 避免 operator 把 `allow_draft_only` 误读为真正执行权限

### 6.6 Fallback

```ts
type CapabilityDecisionFallback = {
  required: boolean;
  fallbackType: "none" | "review_queue" | "human_ack" | "manual_execution" | "blocked";
  fallbackRef: string | null;
};
```

目的：

- 把“被拦后怎么办”也表达清楚
- 避免 trace 只告诉你不能做，不告诉你下一步应该去哪

### 6.7 Audit

```ts
type CapabilityDecisionAudit = {
  auditKey: string;
  emittedBy: string;
  emittedAt: string;
  replaySafe: boolean;
};
```

目的：

- 为后续 audit / replay / diagnostics 保留统一入口

## 7. 第一版 reason code 建议

第一版至少覆盖：

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

建议：

- `primaryReasonCode` 只保留 1 个
- 其余进 `secondaryReasonCodes`

## 8. 第一版 downgrade path 建议

第一版建议显式保留：

- `allow -> allow_draft_only`
- `allow -> route_to_review`
- `route_to_review -> ask_human`
- `ask_human -> deny`

这条 path 必须进 trace，而不是只在日志里留自由文本。

## 9. operator-facing readout 要求

第一版 operator 读面至少要能回答：

1. 谁在请求
2. 请求了什么
3. 是哪一步拦住的
4. 当前结果是什么
5. 是不是被降级了
6. 下一步去哪

第一版不要求把全部 source chain 默认展开。  
默认只展示：

- decision
- primary reason
- downgrade path
- fallback

source chain 可以做二级展开。

## 10. 示例

```json
{
  "traceId": "cap_trace_123",
  "decidedAt": "2026-04-22T13:00:00Z",
  "actor": {
    "actorIdentity": "user_001",
    "actorType": "operator",
    "activeWorkspaceId": "ws_reserved",
    "workspaceClass": "HELM_RESERVED",
    "membershipPosture": "operator"
  },
  "request": {
    "requestedCapability": "program.publish",
    "effectMode": "internal_write",
    "customerFacingIntent": false,
    "requestSource": "app/programs/actions",
    "targetObjectType": "Program",
    "targetObjectScope": "workspace"
  },
  "context": {
    "bundleIdentity": "helm-reserved-programs",
    "workerIdentity": null,
    "skillIdentity": null,
    "resourceIdentity": null,
    "targetOwnershipPosture": "workspace_owned",
    "reservedOnly": true,
    "reviewContext": "internal_operator_write"
  },
  "evaluation": {
    "sourceChain": [
      {
        "step": "workspace_truth",
        "sourceType": "session",
        "sourceRef": "activeWorkspaceId",
        "outcome": "pass",
        "note": "active workspace resolved"
      },
      {
        "step": "hard_boundary",
        "sourceType": "policy",
        "sourceRef": "review-first",
        "outcome": "warn",
        "note": "write allowed only through review posture"
      }
    ],
    "primaryReasonCode": "manual_ack_required",
    "secondaryReasonCodes": [],
    "downgraded": true,
    "downgradePath": ["allow", "route_to_review"]
  },
  "result": {
    "decision": "route_to_review",
    "boundaryNotes": ["review-first"],
    "nonCommitmentNotes": []
  },
  "fallback": {
    "required": true,
    "fallbackType": "review_queue",
    "fallbackRef": "program_review_queue"
  },
  "audit": {
    "auditKey": "audit_123",
    "emittedBy": "capability-engine",
    "emittedAt": "2026-04-22T13:00:00Z",
    "replaySafe": true
  }
}
```

## 11. 接入建议

### Phase 1A

- 先做 read-only trace builder
- 不改最终 allow/deny 行为

### Phase 1B

- 先接一小组高风险 path
- 优先 reserved-only / customer-facing risk / official action adjacent path

### Phase 2

- 再让 selected path 切换到 capability engine 决策

## 12. 风险

1. 如果 trace 只输出自由文本，后续无法稳定做 operator readout
2. 如果 source chain 太厚默认全展开，会增加 operator 扫描成本
3. 如果把 trace 写成 execution timeline，会把系统往 orchestration 叙事带偏

## 13. 当前建议结论

第一版 capability decision trace read model 应保持：

- actor/request/context/evaluation/result/fallback/audit 七段式
- precedence 可解释
- downgrade path 可见
- boundary note 独立表达
- 默认服务 operator，不做 public policy explorer

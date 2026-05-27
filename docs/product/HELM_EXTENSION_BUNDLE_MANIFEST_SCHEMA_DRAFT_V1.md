---
status: active
owner: helm-core
created: 2026-04-22
review_after: 2026-07-21
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Extension Bundle Manifest Schema Draft V1

更新时间：2026-04-22  
状态：Design Draft

## 1. 目的

这份 draft 只回答一个问题：

- Helm 下一阶段的 `extension.manifest.json` 如果要同时承载 `bundle truth + capability manifest truth`，最小 schema 应该长什么样

它不是：

- 最终 JSON Schema 实现
- loader 实现稿
- extension publishing spec
- marketplace manifest

## 2. 当前 truth source

这份 draft 显式建立在以下文档之上：

- [HELM_EXTENSION_BUNDLE_AND_CAPABILITY_MANIFEST_REQUIREMENTS_V1.md](./HELM_EXTENSION_BUNDLE_AND_CAPABILITY_MANIFEST_REQUIREMENTS_V1.md)
- [HELM_MULTI_TENANT_EXTENSION_DIRECTORY_AND_NAMING_PROTOCOL_V1.md](./HELM_MULTI_TENANT_EXTENSION_DIRECTORY_AND_NAMING_PROTOCOL_V1.md)
- [HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md](./HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md)
- [HELM_SOLUTION_EXTENSION_PROTOCOL_V1.md](./HELM_SOLUTION_EXTENSION_PROTOCOL_V1.md)

## 3. 设计目标

第一版 schema draft 只追求 5 件事：

1. 保持现有 manifest identity 不破坏
2. 补 version / compatibility / migration 字段
3. 把 worker / skill / resource / hook / monitor / surface declaration 收进同一层
4. 把 capability declarations 做成显式字段，而不是自由文本
5. 让 loader / self-check / boundary-check 有同一份最小 schema truth

## 4. 非目标

第一版 draft 明确不做：

- schema registry
- remote install metadata
- bundle signing
- publication channel
- billing / pricing / settlement metadata
- execution authority expansion

## 5. 顶层结构草案

第一版建议统一为：

```json
{
  "manifestVersion": "1",
  "bundleVersion": "2026.04.22",
  "extensionKey": "guangpu-seat-profile",
  "tenantKey": "guangpu",
  "extensionSlug": "seat-profile",
  "kind": "TENANT_CUSTOM",
  "displayName": "Guangpu Seat Profile",
  "status": "ACTIVE",
  "owner": "guangpu",
  "nonCoreDeclaration": true,
  "compatibility": {},
  "migrationHints": [],
  "runtimeDeclarations": {},
  "capabilityManifest": {},
  "dependencyDeclarations": {},
  "resourceDependencyDeclarations": [],
  "documentationPointers": {},
  "evalContract": {}
}
```

## 6. 字段分组

### 6.1 Identity 区

保留现有字段：

- `extensionKey`
- `tenantKey`
- `extensionSlug`
- `kind`
- `displayName`
- `status`
- `owner`
- `nonCoreDeclaration`

约束：

- `extensionKey` 必须继续等于 `<tenantKey>-<extensionSlug>`
- `tenantKey` / `extensionSlug` 必须与目录一致
- `kind` 第一版至少支持 `TENANT_CUSTOM`、`FIRST_PARTY_RESERVED`

### 6.2 Version / Compatibility 区

新增字段：

- `manifestVersion`
- `bundleVersion`
- `compatibility`
- `migrationHints`

建议：

- `manifestVersion` 为 schema 自身版本
- `bundleVersion` 为该 bundle 内容版本
- `compatibility.minRuntimeContractVersion`
- `compatibility.supportedWorkspaceClasses`
- `compatibility.requiredFeatures`
- `migrationHints` 为字符串数组或对象数组

### 6.3 Runtime Declarations 区

统一收进：

```json
{
  "runtimeDeclarations": {
    "workers": [],
    "skills": [],
    "resources": [],
    "hooks": [],
    "monitors": [],
    "surfaces": []
  }
}
```

第一版要求：

- `workers` 只列 identity 和 responsibility boundary ref，不内嵌全量 worker schema
- `skills` 只列 identity、scenario、risk、review posture ref
- `resources` 只列 identity、provider、auth mode、workspace scope ref
- `hooks` 只列 hook type、trigger phase、effect posture
- `monitors` 只列 monitor type、signal scope、output posture
- `surfaces` 只列 route or surface entrypoint，不列页面细节实现

### 6.4 Capability Manifest 区

统一收进：

```json
{
  "capabilityManifest": {
    "capabilityDeclarations": [],
    "maxEffectMode": "draft_only",
    "customerFacingAllowed": false,
    "requiresReviewByDefault": true,
    "nonCommitmentOnly": true
  }
}
```

第一版要求：

- `capabilityDeclarations` 必须是显式 capability key 列表
- `maxEffectMode` 至少支持：
  - `read_only`
  - `draft_only`
  - `internal_write`
  - `customer_visible_send`
- `customer_visible_send` 不代表会被自动放行
- `requiresReviewByDefault` 与 `nonCommitmentOnly` 必须显式表达

### 6.5 Dependency Declarations 区

统一收进：

```json
{
  "dependencyDeclarations": {
    "connectors": [],
    "workspaceTruths": [],
    "policyTruths": []
  }
}
```

第一版只要求：

- connector 依赖可读
- workspace truth 依赖可读
- policy truth 依赖可读

不要求一开始就做完整 dependency graph。

### 6.5.1 Phase 4 tenant resource adoption 补充

当 tenant custom extension 要进入租户资源治理 Phase 4 时，`extension.manifest.json` 还应可选声明：

```json
{
  "resourceDependencyDeclarations": [
    {
      "resourceDependencyKey": "guangpu-seat-profile-midun-readout",
      "provider": "MIDUN",
      "declaredCapabilityModes": ["read_only"],
      "objectBindings": ["SEAT_PROFILE", "SEAT_PROFILE_JOB"],
      "policyHints": ["review-first", "tenant-local-readout"]
    }
  ]
}
```

要求：

- 这是 `dependencyDeclarations` 之上的更细粒度 read model，不替代目录或 identity 协议
- `declaredCapabilityModes` 不得声明 `customer_visible_send`
- `objectBindings` 必须说明扩展依赖会影响哪些 tenant-owned judgement object
- `policyHints` 必须继续显式表达 `review-first` / `non-commitment` 一类边界
- 它服务的是 read-only adoption / evidence detail，不是 provider execution contract

### 6.6 Documentation / Eval 区

统一收进：

```json
{
  "documentationPointers": {
    "readme": "README.md",
    "docs": ["docs/overview.md"]
  },
  "evalContract": {
    "fixtures": [],
    "checks": []
  }
}
```

目标：

- 让 drift check 有明示入口
- 让后续验证链知道去哪找 docs / checks / fixtures

## 7. 子对象最小形状

### 7.1 worker declaration

```json
{
  "workerKey": "sales_assistant_worker",
  "role": "sales",
  "responsibilityBoundary": "review-first",
  "defaultEnabled": true
}
```

### 7.2 skill declaration

```json
{
  "skillKey": "followup_draft_skill",
  "scenarioTypes": ["sales_followup"],
  "riskLevel": "medium",
  "requiresReview": true
}
```

### 7.3 resource declaration

```json
{
  "resourceKey": "crm_resource",
  "provider": "hubspot",
  "authMode": "workspace_scoped",
  "workspaceScope": "active"
}
```

### 7.4 hook declaration

```json
{
  "hookKey": "pre_action_eval",
  "triggerPhase": "pre_action",
  "effectPosture": "read_only"
}
```

### 7.5 monitor declaration

```json
{
  "monitorKey": "connector_lag_monitor",
  "signalScope": "workspace",
  "outputPosture": "report_only"
}
```

### 7.6 surface declaration

```json
{
  "surfaceKey": "seat_profile_operating_panel",
  "surfaceType": "operator_panel",
  "entrypoint": "app/api/extensions/guangpu/seat-profile"
}
```

## 8. 第一版校验约束

### 8.1 必填约束

第一版必填：

- identity 区全部字段
- `manifestVersion`
- `bundleVersion`
- `compatibility`
- `runtimeDeclarations`
- `capabilityManifest`

### 8.2 一致性约束

第一版至少校验：

1. `tenantKey` 与目录一致
2. `extensionSlug` 与目录一致
3. `extensionKey` 与 `<tenantKey>-<extensionSlug>` 一致
4. `maxEffectMode` 不低于任何声明 capability 所需的最小 effect mode
5. `customerFacingAllowed = false` 时，不得声明 customer-facing surface or capability posture

### 8.3 fail-closed 约束

以下情况默认 invalid：

- 缺少 required identity
- 未声明 `manifestVersion`
- compatibility 为空
- 声明了未知 effect mode
- 需要 customer-facing capability 但缺 `requiresReviewByDefault`
- docs pointer 缺失到无法完成 drift check

## 9. Loader / Validator 消费方式

第一版先只支持：

- manifest 读取
- schema validation
- identity / directory alignment check
- compatibility validation
- capability declaration validation

第一版不要求：

- runtime hot reload
- remote registry lookup
- signed bundle verification

## 10. rollout 建议

### Phase 1A

- 先写静态 schema draft
- 选一个 reserved extension 样本
- 选一个 tenant custom 样本

### Phase 1B

- 只做 read-only validation
- 记录 invalid cases
- 不影响 runtime execution

### Phase 2

- 再把 loader / resolver 接到 manifest truth
- 再让 self-check / boundary-check 消费

## 11. 风险

1. 如果把 draft 写成“最终 schema”，后续实现会被错误抽象锁死
2. 如果把 runtime declaration 写得太细，会把 manifest 变成实现镜像
3. 如果把 authority 混进 schema，会削弱 capability engine 的职责边界

## 12. 当前建议结论

第一版 manifest schema 应保持：

- 顶层稳定
- declaration 清晰
- authority 外置
- fail-closed
- 只服务 validation / loader / docs drift / future trace

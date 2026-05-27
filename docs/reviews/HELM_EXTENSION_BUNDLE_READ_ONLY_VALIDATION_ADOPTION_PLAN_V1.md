---
status: active
owner: helm-core
created: 2026-04-22
review_after: 2026-07-21
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Extension Bundle Read-Only Validation Adoption Plan V1

更新时间：2026-04-24
状态：Implemented on Branch

## 1. 当前 truth source

这份 plan 建立在以下 current-main 文档之上：

- [HELM_CLAUDE_CODE_AND_CODEX_HARNESS_GAP_ANALYSIS_V1.md](./HELM_CLAUDE_CODE_AND_CODEX_HARNESS_GAP_ANALYSIS_V1.md)
- [HELM_EXTENSION_BUNDLE_AND_CAPABILITY_MANIFEST_REQUIREMENTS_V1.md](../product/HELM_EXTENSION_BUNDLE_AND_CAPABILITY_MANIFEST_REQUIREMENTS_V1.md)
- [HELM_EXTENSION_BUNDLE_MANIFEST_SCHEMA_DRAFT_V1.md](../product/HELM_EXTENSION_BUNDLE_MANIFEST_SCHEMA_DRAFT_V1.md)
- [HELM_MULTI_TENANT_EXTENSION_DIRECTORY_AND_NAMING_PROTOCOL_V1.md](../product/HELM_MULTI_TENANT_EXTENSION_DIRECTORY_AND_NAMING_PROTOCOL_V1.md)

spec / draft 仍然只是 design truth，不自动等于已实现。

当前分支实现结果见：

- [HELM_EXTENSION_BUNDLE_READ_ONLY_VALIDATION_ADOPTION_REPORT_V1.md](./HELM_EXTENSION_BUNDLE_READ_ONLY_VALIDATION_ADOPTION_REPORT_V1.md)

## 2. 为什么现在开这条 plan

当前 `Extension Bundle + Capability Manifest` 已经完成：

- gap judgement
- requirements freeze
- manifest schema draft

下一步如果直接进入 loader/runtime 实现，风险过高。  
因此这条 plan 只做一个更窄也更稳的过渡：

- 先把 bundle manifest 接到 `read-only validation`

## 3. 这条 slice 要证明什么

本轮只证明：

`extension.manifest.json` 可以先作为 read-only bundle truth 被统一验证，并且不会改变任何 runtime execution posture。

具体来说：

1. tenant custom manifest 可以通过新校验入口被静态读取
2. invalid manifest 会被 fail-closed 报告出来，而不是静默容错
3. docs / index / manifest 之间的 drift 可以被捕捉
4. 这一切仍然只是 validation，不是 runtime allow

## 4. 精确范围

### 纳入本轮的样本

当前仓库里已存在的 tenant custom sample：

- `extensions/guangpu/seat-profile`
- `extensions/guangpu/bi-report`

本轮建议：

- `seat-profile` 作为首个主要样本
- `bi-report` 作为第二样本，用来验证包含 `report-skills/knowledge` 的更丰富目录形状

reserved first-party 样本当前不要求一定来自真实生产 bundle。  
如果 current-main 暂无对应 bundle，可先使用 fixture-only reserved sample 做 schema / validation 验证，不进入 runtime wiring。

### 纳入本轮的能力

本轮只做：

- manifest static parse
- identity / directory alignment
- version / compatibility validation
- capability declaration validation
- docs / eval pointer validation

本轮不做：

- runtime loading
- runtime dispatch
- capability granting
- hook execution
- monitor execution

## 5. 保留边界

继续明确保留：

- `workspace-first`
- `membership-backed`
- `judgement-first`
- `review-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `plugin runtime` still has no real sandbox
- 当前仍不是 plugin platform / marketplace / orchestration plane

manifest validation 不是 authority expansion。

## 6. phase plan

### Phase 1

- 盘点现有 extension manifest 样本
- 明确当前 manifest 缺什么字段、哪些字段已存在
- 不改任何 runtime 行为

### Phase 2

- 引入 read-only manifest validator
- 先只验证：
  - identity
  - compatibility
  - declaration shape
  - docs / eval pointers

### Phase 3

- 把 validator 接到 `self-check`
- 必要时把部分 invariant 接到 `check:boundaries`
- 仍然保持 read-only posture

### Phase 4

- 输出 validation readout
- 明确哪些 bundle 已对齐、哪些仍是 partial
- 冻结下一步是否值得进入 loader adoption

## 7. 计划中的校验项

至少校验：

1. `tenantKey` 与目录一致
2. `extensionSlug` 与目录一致
3. `extensionKey` 与 `<tenantKey>-<extensionSlug>` 一致
4. `manifestVersion` 存在
5. `bundleVersion` 存在
6. `compatibility` 存在且非空
7. `runtimeDeclarations` 存在且结构合法
8. `capabilityManifest` 存在且 effect mode 合法
9. docs / README / eval pointers 不漂移

## 8. 交付物

本轮 implementation 进入时，最小交付物应该是：

- read-only validator helper
- sample fixtures
- self-check integration
- docs drift check
- plan/report/doc index sync

## 9. 明确延期项

继续延期：

- loader 真实接管
- runtime resolver adoption
- monitor execution
- hook execution
- bundle-based authority resolution
- signed bundle / registry / marketplace

## 10. done definition

这条 plan 只有在以下条件同时成立时才算完成：

1. 至少两个真实 tenant sample manifest 可被稳定验证
2. invalid case 能 fail-closed 报出
3. `self-check` 能消费 read-only validator
4. 没有改变 runtime authority / loader result / execution posture
5. README / docs / plan / report 已同步

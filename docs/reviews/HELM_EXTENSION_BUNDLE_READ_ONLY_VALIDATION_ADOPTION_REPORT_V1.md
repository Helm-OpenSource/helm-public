---
status: archived
owner: helm-core
created: 2026-04-24
review_after: 2026-10-21
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Extension Bundle Read-Only Validation Adoption Report V1

更新时间：2026-04-24  
状态：Delivered on Branch

## 1. 本轮目标

这轮只做一个更窄的 harness adoption slice：

1. 把 `extension.manifest.json` 接进 read-only bundle validation
2. 用真实 Guangpu sample manifest 验证 identity / compatibility / docs / eval drift
3. 把这条 read-only validation 接进 `self-check` 与 boundary harness

这轮不做：

- runtime loader 接管
- capability granting
- hook / monitor execution
- broad authority expansion

## 2. 已交付

- read-only validator helper：
  - [lib/solution-extension-manifests.ts](/Users/tommyqian/Documents/GitHub/helm2026/lib/solution-extension-manifests.ts)
- validator regression tests：
  - [lib/solution-extension-manifests.test.ts](/Users/tommyqian/Documents/GitHub/helm2026/lib/solution-extension-manifests.test.ts)
- Guangpu sample bundle manifest upgrade：
  - [extensions/guangpu/seat-profile/extension.manifest.json](/Users/tommyqian/Documents/GitHub/helm2026/extensions/guangpu/seat-profile/extension.manifest.json)
  - [extensions/guangpu/bi-report/extension.manifest.json](/Users/tommyqian/Documents/GitHub/helm2026/extensions/guangpu/bi-report/extension.manifest.json)
  - [extensions/guangpu/midun-integrate/extension.manifest.json](/Users/tommyqian/Documents/GitHub/helm2026/extensions/guangpu/midun-integrate/extension.manifest.json)
- self-check / boundary wiring：
  - [scripts/helm-self-check.ts](/Users/tommyqian/Documents/GitHub/helm2026/scripts/helm-self-check.ts)
  - [scripts/decision-first-boundary-check.ts](/Users/tommyqian/Documents/GitHub/helm2026/scripts/decision-first-boundary-check.ts)
- plan / index sync：
  - [PLANS.md](/Users/tommyqian/Documents/GitHub/helm2026/PLANS.md)
  - [docs/README.md](/Users/tommyqian/Documents/GitHub/helm2026/docs/README.md)
  - [HELM_EXTENSION_BUNDLE_READ_ONLY_VALIDATION_ADOPTION_PLAN_V1.md](/Users/tommyqian/Documents/GitHub/helm2026/docs/reviews/HELM_EXTENSION_BUNDLE_READ_ONLY_VALIDATION_ADOPTION_PLAN_V1.md)

## 3. 当前结论

当前 `Extension Bundle + Capability Manifest` 已经从纯 plan 状态推进到一个可验证的第一刀：

- `extension.manifest.json` 可以作为 read-only bundle truth 被统一读取
- invalid manifest 会 fail-closed 报出
- docs / eval pointer drift 可以被静态捕捉
- 当前仍然没有改变 runtime loader result / capability allow / execution posture

## 4. 保留边界

这轮继续明确保留：

1. current-main 仍没有 plugin sandbox
2. manifest validation 不等于 capability grant
3. read-only validation 不等于 runtime authority expansion
4. 当前仍不是 plugin platform / marketplace / orchestration plane

## 5. 风险项

1. 现在只验证 Guangpu sample，不等于其他 tenant bundle 已经 ready
2. `capabilityManifest` 目前仍只是 declaration truth，不是 runtime resolver truth
3. 后续如果直接跳到 loader adoption，而不先补 capability decision trace，只会把 authority explanation 留空

## 6. 下一步建议

1. 保持这条线停在 read-only validation，不要顺手扩到 loader / resolver 行为变更
2. 下一刀如果继续 harness，优先推进 `Capability Resolution Engine` 的 read-only decision trace adoption
3. 等 capability decision trace 第一刀也成立后，再评估是否值得进入更窄的 runtime adoption

---
status: archived
owner: helm-core
created: 2026-05-04
review_after: 2026-10-31
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Self-Check Consolidation Audit And Migration Plan

## 结论

这是 self-check consolidation audit / migration plan，不是把 legacy `scripts/helm-self-check.ts` 设回默认，也不是把 legacy 替换成 wrapper 后静默丢覆盖。

当前固定事实：

- `npm run self-check` 继续指向 `scripts/helm-self-check-refactored.ts`。
- legacy `scripts/helm-self-check.ts` 仍保留 wide guard 覆盖，当前静态 `runCheck(...)` 数量大于 200。
- refactored self-check 当前是 passing 的默认入口，但覆盖明显窄于 legacy。
- legacy self-check 当前存在 drift，迁移审计不得运行 legacy self-check；Slice 6 已对 3 个 detail-page guard 采用 current-main boundary markers 做 modernization，而不是原样搬运 stale legacy snippets。
- `check:self-check-consolidation` 当前应返回 **FAIL**，因为 refactored 仍低于默认切换覆盖 floor，且 legacy / refactored 之间还有覆盖差距；这是迁移 blocker，不是 runtime failure。
- 默认切回 legacy 之前，必须先把仍有价值的 legacy guard 迁入 refactored，并废弃或改写 stale guard。

## 本轮新增审计入口

新增命令：

```bash
npm run check:self-check-consolidation
```

该命令只读取以下文件：

- `package.json`
- `scripts/helm-self-check.ts`
- `scripts/helm-self-check-refactored.ts`

它报告：

- default command
- legacy / refactored `runCheck(...)` count
- default 是否仍使用 refactored
- legacy 是否仍是 wide 非 wrapper
- refactored 是否包含关键现代 guard marker
- legacy 与 refactored 的覆盖差距
- 迁移决策：`migrate_legacy_guards_before_default_switch`

失败条件：

- `self-check` 默认入口不再使用 refactored
- legacy `runCheck(...)` 少于 200
- legacy 被 wrapper 化
- refactored 缺少关键现代 guard marker
- refactored `runCheck(...)` 少于默认切换覆盖 floor
- legacy / refactored 仍存在覆盖差距

## 三类迁移清单

### 已迁入 refactored 的现代 guard

- tenant extension / manifest / read-only validation guard
- capability decision trace / authority boundary guard
- memory observability / distillation / audit write failure observability guard
- B2B Sales Advancement Pack offline contract guard
- Intelligence Growth P0 offline gate guard
- tenant resource integration governance / connector marketplace boundary guard marker

这些 guard 已经在默认 `npm run self-check` 的 refactored 入口中保持 discoverable，继续作为 passing baseline。

### legacy stale，需要废弃或改写

- 依赖旧文档文件名、旧 freeze 版本号或已废止文档生命周期规则的 guard
- 依赖旧 README 长文位置、旧本地路径或旧目录形状的 guard
- 把 planning-only / historical docs 当成 current runtime truth 的 guard
- 会要求运行已知 drift 路径、外部副作用、DB reset、connector 或 runtime smoke 的 guard

这些 guard 不应原样迁入 refactored；必须先判定为 delete、rewrite 或降级为 docs-only evidence。

### 仍有价值但需迁移的 legacy guard

- 仍能证明 release hygiene、boundary wording、docs discoverability 的静态文件 guard
- 仍能证明 recommendation != commitment、proposal != contract、proactive != auto-decision 的边界 guard
- 仍能证明 tenant/private extension 与 shared layer 边界的 guard
- 仍能证明 offline-only / candidate-only / review-first / no auto-send / no silent CRM write 的 guard
- 仍能证明 self-check 自身覆盖没有被 wrapper 化或静默收窄的 guard

这些 guard 应按小批量迁入 refactored，每批都补 targeted test，再跑 consolidation audit。直到覆盖差距清零之前，consolidation audit 必须保持 FAIL。

## 明确不做

- 不把 legacy self-check 设回默认。
- 不运行 legacy self-check。
- 不把 legacy self-check 替换成 wrapper。
- 不新增 runtime。
- 不新增 API。
- 不新增 UI。
- 不新增 DB schema / migration / write path。
- 不新增 connector / provider credential / external side effect。

## 下一步迁移规则

1. 每次只迁移一组 guard，先判定它属于 `modern / stale / valuable-but-needs-rewrite`。
2. stale guard 只能删除或改写，不能原样搬运。
3. valuable guard 迁入 refactored 后必须保留 deterministic、offline、static-read 优先。
4. refactored 继续作为默认 self-check，直到 legacy valuable guard 全部迁完且 drift 清零。
5. 任何默认入口切换必须先通过 `check:self-check-consolidation`，并另行形成 owner-reviewed release decision。

## Slice 1 迁移记录：business-loop gap readout family

本 slice 将 legacy `scripts/helm-self-check.ts` 中当前仍 passing 且仍有价值的 business-loop gap readout family 迁入默认 `scripts/helm-self-check-refactored.ts`：

- `business_loop_operating_gap_wiring_is_indexed`
- `business_loop_gap_aggregation_is_indexed`
- `business_loop_gap_readout_is_indexed`
- `business_loop_gap_surface_expansion_is_indexed`
- `business_loop_gap_operator_surface_expansion_is_indexed`
- `business_loop_gap_opportunity_surface_is_indexed`
- `business_loop_gap_customer_success_queue_is_indexed`
- `business_loop_gap_readout_helper_is_indexed`
- `business_loop_gap_readout_guard_is_enforced`

迁移口径：

- 只做 `readText` / `checkFileExists` / snippet 静态检查。
- 每个 migrated guard 保留一个显式 `runCheck(...)` call expression，方便 consolidation audit 的 AST 计数反映实际迁入。
- `business_loop_gap_readout_guard_is_enforced` 继续机械阻止 guarded surfaces 绕过 `buildBusinessLoopGapReadout` 或重新使用 `businessLoopGapSummary.primaryGap` 做 page-local mapping。
- 不运行 legacy full self-check，不新增 runtime / API / UI / DB / connector。
- `check:self-check-consolidation` 仍必须保持 FAIL；本 slice 只是缩小覆盖差距，不解除 consolidation blocker。

## 验证

本计划对应的最小验证链：

```bash
npm run test -- lib/self-check-consolidation-audit.test.ts
npm run check:self-check-consolidation # expected FAIL until legacy valuable guard migration closes the coverage gap
npm run self-check
npx eslint --max-warnings 0 scripts/self-check-consolidation-audit.ts lib/self-check-consolidation-audit.test.ts
npm run typecheck
git diff --check
```

## Slice 2 迁移记录：low-risk static doc contract guards

本 slice 将 legacy `scripts/helm-self-check.ts` 中 4 个低风险静态 guard 迁入默认 `scripts/helm-self-check-refactored.ts`：

- `root_agents_contract`
- `codex_docs`
- `codex_skills`
- `product_principles_and_priority_mapping_are_indexed`

迁移口径：

- 只做 `readText` / `checkFileExists` / snippet 或 file-existence 静态检查。
- 每个 migrated guard 保留一个显式 `runCheck("...")` call expression，方便 consolidation audit 的 AST 计数反映实际迁入。
- Codex docs / skills 路径数组放在 `scripts/self-check/config.ts`，避免 refactored 主脚本继续膨胀。
- 不切换默认入口，不 wrapper legacy，不运行 legacy full self-check。
- 不新增 runtime / API / UI / DB / connector / schema / external side effect。
- `check:self-check-consolidation` 仍必须保持 FAIL；本 slice 只把 coverage gap 从 181 缩小到 177，不解除 consolidation blocker。

## Slice 3 迁移记录：route topology file-existence guards

本 slice 将 legacy `scripts/helm-self-check.ts` 中 6 个纯文件存在性 guard 迁入默认 `scripts/helm-self-check-refactored.ts`：

- `operating_system_layer_files`
- `main_chain_route_presence`
- `supporting_route_presence`
- `object_detail_route_presence`
- `shell_entry_presence`
- `entry_and_workspace_support_route_presence`

迁移口径：

- 只做 `checkFileExists` file-existence guard；不迁入 snippet、runtime smoke 或 legacy full self-check 行为。
- 每个 migrated guard 保留一个显式 `runCheck("...")` call expression，方便 consolidation audit 的 AST 计数反映实际迁入。
- 6 组 legacy-equivalent 路径数组放在 `scripts/self-check/config.ts`：`operatingSystemLayerFiles`、`mainChainRoutes`、`supportingRoutes`、`objectDetailRoutes`、`shellEntryFiles`、`entryAndWorkspaceSupportRoutes`。
- 不切换默认入口，不 wrapper legacy，不运行 legacy full self-check。
- 不新增 runtime / API / UI / DB / connector / schema / external side effect。
- `check:self-check-consolidation` 仍必须保持 FAIL；本 slice 只缩小 coverage gap，不解除 consolidation blocker。

## Slice 4 迁移记录：contract surface static snippet guards

本 slice 将 legacy `scripts/helm-self-check.ts` 中 2 个中低风险静态 snippet guard 迁入默认 `scripts/helm-self-check-refactored.ts`：

- `worker_skill_resource_contract_schema`
- `page_header_briefing`

迁移口径：

- 只做 `readText` / `checkFileExists` / snippet 静态检查。
- 每个 migrated guard 保留一个显式 `runCheck("...")` call expression，方便 consolidation audit 的 AST 计数反映实际迁入。
- `worker_skill_resource_contract_schema` 继续只验证 `lib/worker-skill-resource/contract.ts` 中的 canonical schema、Sprint blueprint、controlled-trial review / non-commitment snippet。
- `page_header_briefing` 继续只验证 `components/shared/page-header.tsx` 中的 report-first briefing snippet。
- 不切换默认入口，不 wrapper legacy，不运行 legacy full self-check。
- 不新增 runtime / API / UI / DB / connector / schema / external side effect。
- `check:self-check-consolidation` 仍必须保持 FAIL；本 slice 只把 coverage gap 从 171 缩小到 169，不解除 consolidation blocker。

## Slice 5 迁移记录：page support static snippet guards

本 slice 将 legacy `scripts/helm-self-check.ts` 中 2 个静态 snippet guard 迁入默认 `scripts/helm-self-check-refactored.ts`，其中 dashboard page support 路径按 current-main seam 做显式修正：

- `worker_skill_resource_page_support`
- `shared_proactive_component_markers`

迁移口径：

- 只做 `readText` / `checkFileExists` / snippet 静态检查。
- 每个 migrated guard 保留一个显式 `runCheck("...")` call expression，方便 consolidation audit 的 AST 计数反映实际迁入。
- `worker_skill_resource_page_support` 继续验证 `lib/worker-skill-resource/presentation.ts` 的 shared Sprint 2 helper snippet，并继续要求 dashboard / opportunities / approvals 三个 surface 使用 `createWorkerSkillResourcePageSupport` 与对应 `pageId` marker；当前 dashboard support owner 已下沉到 `features/dashboard/view-model.ts`。
- `shared_proactive_component_markers` 继续验证 proactive panel 的 reporting / worker / page-layer marker，以及 shared narrative component 的 collaboration / evidence marker。
- 不切换默认入口，不 wrapper legacy，不运行 legacy full self-check。
- 不新增 runtime / API / UI / DB / connector / schema / external side effect。
- `proposal_package_pages_and_contract`、`customer_facing_offer_external_proposal_pages_and_contract`、`commitment_reinforcement_sendability_pages_and_contract` 存在 snippet drift，本 slice 明确不迁移，留给单独 modernization slice。
- `check:self-check-consolidation` 仍必须保持 FAIL；本 slice 只把 coverage gap 从 169 缩小到 167，不解除 consolidation blocker。

## Slice 6 迁移记录：current-main-modernized detail-page static snippet guards

本 slice 将 legacy `scripts/helm-self-check.ts` 中 3 个 detail-page self-check guard 迁入默认 `scripts/helm-self-check-refactored.ts`，但不原样搬运 legacy stale snippets：

- `proposal_package_pages_and_contract`
- `customer_facing_offer_external_proposal_pages_and_contract`
- `commitment_reinforcement_sendability_pages_and_contract`

迁移口径：

- 只做 `readText` / `checkFileExists` / snippet 静态检查。
- 每个 migrated guard 保留一个显式 `runCheck("...")` call expression，方便 consolidation audit 的 AST 计数反映实际迁入。
- 3 组 guard 的 route file、detail file、current-main marker snippet 配置放在 `scripts/self-check/config.ts`，refactored 主脚本只保留通用 `evaluateDetailPageStaticSnippetGuard(...)`。
- current-main marker 来源以 `scripts/decision-first-boundary-check.ts` 为准，对齐：
  - `proposal_package_pages_keep_judgement_boundary_and_evidence`
  - `customer_facing_offer_external_proposal_pages_keep_sendability_boundary_and_evidence`
  - `commitment_reinforcement_sendability_pages_keep_strength_and_sendability_boundaries`
- 已刻意不重新引入 legacy stale snippets，例如 `recommendation 仍不等于 commitment`、`package wording 仍只是商业整形产物`、`recommendation、discussion-only`、`recommendation、discussion-only 和 boundary-only reinforcement 仍然不等于 commitment。`。
- 不切换默认入口，不 wrapper legacy，不运行 legacy full self-check。
- 不新增 runtime / API / UI / DB / connector / schema / external side effect。
- `check:self-check-consolidation` 仍必须保持 FAIL；本 slice 只把 coverage gap 从 167 缩小到 164，不解除 consolidation blocker。

## Slice 7 迁移记录：current-main shared panel / section anchor / reporting density static guards

本 slice 将 legacy `scripts/helm-self-check.ts` 中 5 个 shared self-check guard 迁入默认 `scripts/helm-self-check-refactored.ts`，但以 current-main boundary markers 为准，避免继续保留已经漂移的 legacy marker：

- `shared_reporting_panel`
- `shared_narrative_components`
- `shared_proactive_panel`
- `page_section_anchor_contract`
- `reporting_protocol_density_limits`

迁移口径：

- 只做 `readText` / `checkFileExists` / snippet 静态检查。
- 每个 migrated guard 保留一个显式 `runCheck("...")` call expression，方便 consolidation audit 的 AST 计数反映实际迁入。
- 5 组 guard 的 tracked files、required snippets、section-anchor usage markers 放在 `scripts/self-check/config.ts`，refactored 主脚本只新增通用静态检查与 section-anchor usage 检查。
- current-main marker 来源以 `scripts/decision-first-boundary-check.ts` 为准，对齐：
  - `shared_reporting_panel_keeps_page_hierarchy_markers`
  - `shared_proactive_panel_keeps_page_hierarchy_markers`
  - `shared_narrative_components_keep_required_markers`
  - `evidence_targets_keep_section_anchor_contract`
  - `reporting_protocol_keeps_density_limits`
- `page_section_anchor_contract` 使用 current-main anchor contract：`memory-work-timeline` 保留；usage 检查以 dashboard representative files 的 `buildSectionHref`、opportunities / approvals 的 `scrollToWindowHashTarget`、memory 的 `MEMORY_PAGE_ANCHORS` 为准，不再沿用 stale legacy 的 opportunities / approvals anchor-constant usage 检查。
- 本 slice 不迁移 variants / package-variants family guard，避免把后续高噪声 legacy guard 混入当前 shared-panel 静态切片。
- 不切换默认入口，不 wrapper legacy，不运行 legacy full self-check。
- 不新增 runtime / API / UI / DB / connector / schema / external side effect。
- `check:self-check-consolidation` 仍必须保持 FAIL；本 slice 只把 coverage gap 从 164 缩小到 159，不解除 consolidation blocker。

## Slice 8 迁移记录：conversation / external narrative static guards

本 slice 将 legacy `scripts/helm-self-check.ts` 中 3 个 conversation / external narrative 静态 guard 迁入默认 `scripts/helm-self-check-refactored.ts`，但对 `pages_and_contract` 与 baseline freeze honest boundary marker 做 current-main modernization：

- `conversation_external_narrative_pages_and_contract`
- `conversation_external_narrative_detail_chain_assets`
- `conversation_external_narrative_baseline_freeze_assets`

迁移口径：

- 只做 `readText` / `checkFileExists` / snippet 静态检查。
- 每个 migrated guard 保留一个显式 `runCheck("...")` call expression，方便 consolidation audit 的 AST 计数反映实际迁入。
- 3 组 guard 的 tracked files、required snippets、current-main source guard marker 放在 `scripts/self-check/config.ts`，refactored 主脚本只复用通用 `evaluateStaticSnippetGuard(...)`。
- `conversation_external_narrative_pages_and_contract` 不原样搬运 legacy stale wording，改以 `scripts/decision-first-boundary-check.ts` 的 `conversation_external_narrative_pages_keep_scene_level_and_non_commitment_boundaries` 为准；route files 进入 haystack，并要求 `ConversationDetailView` / `buildConversationDetailPageContract` / `buildProposalPackageCommercialDetail`、`ExternalNarrativeDetailView` / `buildExternalNarrativeDetailPageContract` / `buildProposalPackageCommercialDetail` 以及当前中文非承诺边界 wording。
- `conversation_external_narrative_detail_chain_assets` 保留 legacy 中仍存在的 docs / index / delivery marker，继续只验证 discoverability。
- `conversation_external_narrative_baseline_freeze_assets` 在 legacy docs / index / delivery marker 外，补入 `conversation_external_narrative_baseline_freeze_keeps_honest_boundary` 的 honest boundary snippets：`第一轮局部落地`、`不是完整 messaging platform`、`不是完整 sales enablement / battlecard / CRM 平台`、`不是完整 commercial conversation engine`、`package / offer -> conversation`、`external proposal / reinforcement -> external narrative`、`conversation <-> external narrative`、`recommendation、review、boundary、decision request`。
- 本 slice 不迁移 founder / sales / delivery variants、inbox / followup / review request 或 customer-success guard，避免把相邻高噪声 legacy family 混入当前 conversation / narrative 静态切片。
- 不切换默认入口，不 wrapper legacy，不运行 legacy full self-check。
- 不新增 runtime / API / UI / DB / connector / schema / external side effect。
- `check:self-check-consolidation` 仍必须保持 FAIL；本 slice 只把 coverage gap 从 159 缩小到 156，不解除 consolidation blocker。

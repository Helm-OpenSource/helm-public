---
status: active
owner: helm-core
created: 2026-04-12
review_after: 2026-07-11
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Reserved Workspace Data Backfill Baseline V1

更新时间：2026-04-12

## 已经完整成立

- `Helm reserved workspace backfill defaults to dry-run inventory`：仓库现在有 `npm run backfill:helm-reserved:inventory` 和 `npm run backfill:helm-reserved:apply` 两条明确命令面
- backfill 工具只自动迁 `commercial / program / portal / settlement` 这条 first-party 数据链：`WorkerPublisherProfile / SalesReferral / CustomEngagement / RevenueRule / RevenueAttributionLedger / PayoutLedger / BeneficiaryPayoutProfile / ParticipantPortalAccess / PartnerProgram / ProgramTermsVersion / ProgramApplication / SettlementBatch / SettlementBatchLine`
- 每次 apply 前都会做 target-key collision 与 cross-workspace integrity preflight；只要 reserved host 已有同 key 记录，或 source workspace 里存在跨 workspace 关系脏链，就会拒绝 apply
- `CapabilityCatalogEntry and SkillSuggestion formal review stay inventory-only in reserved backfill`：能力目录与正式能力评审信号只做 inventory 提醒，不进入自动迁移
- apply 成功时会在 reserved host 下写 `RESERVED_WORKSPACE_BACKFILL_APPLIED` audit 和 `reserved_workspace_backfill_applied` event，保留 source workspace、target workspace、preflight 摘要和 updated counts
- local/demo seed 现在只会把 first-party settlement proof pack 写进 Helm reserved host，不再在 customer demo workspace 里重复写出 `helm_first_party` 与默认 first-party rule/batch keys

## 已成形但仍需下一层

- 这轮只提供 operator tool 与 preflight contract，没有自动识别“哪些 customer workspace 实际上是 Helm first-party data”
- 这轮不会自动修复已经存在的 cross-workspace 关系问题；preflight 只负责显式拦截和暴露问题
- 当前仍是 single reserved host posture，不是 generic multi-host first-party registry

## 刻意未做

- automatic tenant classification
- bulk apply all non-reserved workspaces
- `CapabilityCatalogEntry` / `SkillSuggestion` formal review automatic migration
- capability catalog / formal promotion helper auto-write
- dedicated migration audit UI

## 风险项

- 如果 operator 错把 tenant custom 数据当成 Helm first-party 数据，仍可能把错误对象迁进 reserved host
- 如果 reserved host 里已经有同 `programKey / slug / ruleKey / beneficiaryReference / batchKey` 记录，apply 会被阻断，需要人工合并策略
- 如果 source workspace 里已有跨 workspace 引用脏链，apply 会被阻断；这比静默迁移更安全，但仍需要人工清理
- 如果未来又把 first-party settlement proof seed 接回 customer workspace，local/demo inventory 会重新出现 collision 噪音并掩盖真正的 legacy data

## 当前边界

- `Helm reserved workspace backfill defaults to dry-run inventory`
- `CapabilityCatalogEntry and SkillSuggestion formal review stay inventory-only in reserved backfill`
- `reserved workspace backfill != automatic tenant classification`
- `reserved workspace backfill != migration already executed`
- `reserved workspace backfill apply now leaves audit/event evidence on the reserved host`
- `local/demo first-party settlement proof pack stays reserved-host only`

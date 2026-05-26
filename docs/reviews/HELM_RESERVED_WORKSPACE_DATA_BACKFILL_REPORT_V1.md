---
status: archived
owner: helm-core
created: 2026-04-12
review_after: 2026-10-09
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Reserved Workspace Data Backfill Report V1

更新时间：2026-04-12

## 1. 本轮完成内容

- 新增 reserved workspace data inventory / backfill tool：默认 dry-run，显式 `--apply --source-workspace-id=<workspaceId>` 才会执行迁移
- 把 first-party commercial / program / portal / settlement 这条迁移链收成统一 preflight contract，并输出 machine-readable JSON report
- 把 `CapabilityCatalogEntry` 与 `SkillSuggestion formal review` 明确留在 inventory-only 面，不把 capability governance 和 first-party commercial backfill 混成一条自动迁移链
- 把 local/demo seed 收成 reserved-host only：`seedSettlementOperationsProofPack` 不再向 customer demo workspace 重复写入 Helm first-party settlement proof data
- apply 成功时会额外写 reserved-host audit/event evidence，后续可以从 `AuditLog / EventLog` 追踪是哪次 backfill 收了哪个 source workspace

## 2. 本轮变更清单

- backfill logic / script:
  - `lib/workspace-reserved-backfill.ts`
  - `scripts/backfill-helm-reserved-workspace.ts`
  - `package.json`
- tests:
  - `lib/workspace-reserved-backfill.test.ts`
- docs / guards:
  - `README.md`
  - `docs/README.md`
  - `PLANS.md`
  - `docs/product/HELM_RESERVED_WORKSPACE_DATA_BACKFILL_BASELINE_V1.md`
  - `docs/reviews/HELM_RESERVED_WORKSPACE_DATA_BACKFILL_REPORT_V1.md`
  - `scripts/self-check/config.ts`
  - `scripts/helm-self-check-refactored.ts`
  - `scripts/helm-self-check.ts`
  - `scripts/decision-first-boundary-check.ts`

## 3. 本轮没有过度声称的点

- 没有宣称 reserved workspace data migration 已经执行完成
- 没有宣称脚本能自动判断 tenant custom data 和 Helm first-party data
- 没有把 capability catalog / formal skill review 也写成自动 backfill 范围
- 没有把 local/demo seed clean-up 写成 production data 已完成清理

## 4. 保留边界

- `Helm reserved workspace backfill defaults to dry-run inventory`
- `CapabilityCatalogEntry and SkillSuggestion formal review stay inventory-only in reserved backfill`
- `reserved workspace backfill != automatic tenant classification`
- `reserved workspace backfill != migration already executed`
- `reserved workspace backfill apply now leaves audit/event evidence on the reserved host`
- `local/demo first-party settlement proof pack stays reserved-host only`

## 5. 仍属下一层

- 对现有数据库做人工 inventory 并确定真正属于 Helm first-party 的 source workspace
- 对 preflight 暴露出来的 collision / integrity issue 做人工修复
- 在完成人工确认后，执行窄 apply，并补迁移审计记录
- 如果后续需要 customer demo 自己的 settlement 示例，应单独种 tenant-local keys，而不是复用 Helm first-party publisher / rule / batch keys

## 6. 验证

- `npm run backfill:helm-reserved:inventory`
- 其余完整验证链见本轮最终交付说明

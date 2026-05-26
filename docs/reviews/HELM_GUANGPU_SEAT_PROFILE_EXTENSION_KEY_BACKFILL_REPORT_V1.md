---
status: archived
owner: helm-core
created: 2026-04-16
review_after: 2026-10-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Guangpu Seat Profile Extension Key Backfill Report V1

更新时间：2026-04-16  
状态：Delivered

## 1. 目标

这轮只做一件事：

- 给历史 `WorkspaceSolutionExtension.extensionKey = "seat-profile"` 记录补一条显式、可执行、可回放的清理路径

这轮不做：

- seat-profile 业务规则
- BI runtime 扩面
- broader extension migration platform
- 自动批量扫全库并静默改写

## 2. 已交付

- backfill helper：
  - [lib/guangpu-seat-profile-extension-key-backfill.ts](/Users/tommyqian/Documents/GitHub/helm2026/lib/guangpu-seat-profile-extension-key-backfill.ts)
- operator command：
  - [scripts/backfill-guangpu-seat-profile-extension-key.ts](/Users/tommyqian/Documents/GitHub/helm2026/scripts/backfill-guangpu-seat-profile-extension-key.ts)
- regression：
  - [lib/guangpu-seat-profile-extension-key-backfill.test.ts](/Users/tommyqian/Documents/GitHub/helm2026/lib/guangpu-seat-profile-extension-key-backfill.test.ts)
- 命令面：
  - `npm run backfill:guangpu-seat-profile:inventory`
  - `npm run backfill:guangpu-seat-profile:apply -- --workspace-id=<workspaceId>`

## 3. Contract

默认行为：

1. inventory 默认 dry-run
2. apply 必须显式带 `--workspace-id=<workspaceId>`
3. 工具只处理 `WorkspaceSolutionExtension` 里 `extensionKey = "seat-profile"` 的 legacy 行
4. workspace 不匹配 Guangpu tenant 时直接返回 manual review
5. canonical `guangpu-seat-profile` 不存在时，apply 执行 rename
6. canonical 已存在且 `kind / status / version / configJson` 等价时，apply 删除 duplicate legacy row，并保留更早的 enablement 时间
7. canonical / legacy 如有实质分歧，apply 阻断，不自动猜 merge

审计与可观测性：

- apply 成功时写一条 `GUANGPU_SEAT_PROFILE_EXTENSION_KEY_BACKFILL_APPLIED` audit
- apply 成功时写一条 `guangpu_seat_profile_extension_key_backfill_applied` event

## 4. 当前成立 truth

- runtime 已经只接受 `guangpu-seat-profile`
- 历史 bare-key 清理现在不再依赖 runtime fallback
- operator 可以先 inventory，再对单个 workspace 显式 apply

## 5. 风险项

1. 真实数据库里如果存在 canonical / legacy 分歧行，仍需人工判断 merge 语义
2. 本工具只处理 seat-profile 这一个 legacy key，不负责 generic extension migration
3. 这轮只验证了工具 contract，没有在真实生产数据上执行 apply

## 6. 验证

- `npx vitest run lib/guangpu-seat-profile-extension-key-backfill.test.ts extensions/guangpu/seat-profile/tests/routes.test.ts extensions/guangpu/seat-profile/tests/reports-contract.test.ts lib/bi-report-skill/skill-loader.test.ts`
  - `4` 个文件 `18` 个测试通过
- `npm run backfill:guangpu-seat-profile:inventory`
  - 当前本地 DB 没有 `WorkspaceSolutionExtension` 表；命令会稳定返回空 inventory，而不是直接失败或打印 query error
- `npm run self-check`
  - 通过
- `npm run check:boundaries`
  - 通过
- 定向 `eslint`
  - `lib/guangpu-seat-profile-extension-key-backfill.ts`
  - `lib/guangpu-seat-profile-extension-key-backfill.test.ts`
  - `scripts/backfill-guangpu-seat-profile-extension-key.ts`
  - `scripts/helm-self-check-refactored.ts`
  - `scripts/helm-self-check.ts`
  - `scripts/decision-first-boundary-check.ts`
  - 通过
- `npm run typecheck`
  - 仍失败，但失败点仍是既有 connector/mail 基线问题，不在本轮 Guangpu backfill 改动范围内

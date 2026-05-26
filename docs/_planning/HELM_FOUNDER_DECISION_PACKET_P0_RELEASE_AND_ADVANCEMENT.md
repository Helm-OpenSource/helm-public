---
status: planning
owner: helm-core
created: 2026-04-30
review_after: 2026-05-30
archive_trigger:
  - 2026-05-31 v0.1.0-trial release closeout 报告落地后，本 packet 复核并归档
  - P0 release hygiene 与 Business Advancement runtime gate 被后续 implementation report 承接后 30 天内归档
  - 自 review_after 起 90 天，无任何 PR 或文档引用本文件
---

# Helm Founder Decision Packet — P0 Release Hygiene And Advancement Gate

更新时间：2026-04-30
状态：Founder Approval + Evidence Gate
Owner final approver：Founder / Owner
Plan version：`founder-p0-release-advancement/2026-04-30`

## 1. Requested Decision

建议本轮 Go，但拆成两个顺序执行的 work order：

1. **P0 Release Hygiene First**：先修 `check:public-release` 的公开发布阻塞，不让 tenant-private / credential / private-path 泄漏继续污染五月开源目标。
2. **Business Advancement Internal Gate Second**：只推进 disabled-by-default / founder-led internal dogfooding 准备；production query adoption 继续 No-Go，直到 redacted live evidence 与 independent review 满足。

决策级别：

| Work | Decision class | 结论 |
| --- | --- | --- |
| Release hygiene code/docs cleanup | Founder Approval + Evidence Gate | Go |
| Business Advancement disabled scaffold / packet prep | Founder Approval + Evidence Gate | Go after release hygiene slice |
| Public trial / production data adoption | Independent Review Required | No-Go until evidence |

## 2. Why Now

当前主干已经具备五月开源 + 云端试用的基本骨架，但验证信号显示 release hygiene 正在倒退：

- `npm run check:public-release` 当前失败：119 occurrences，覆盖 URL-embedded credential 示例、private docs path、tenant slug 泄漏。
- `npm run check:boundaries` 当前失败：包含 tenant slug shared-layer reverse block 以及多个 legacy UI / boundary marker drift。
- 最新主干引入了中国商业 demo seed、tenant-specific worker demo runner 与 tenant-specific signals UI，这些是 GTM 资产，但不应进入 public mirror 的共享层。

如果不先修 release hygiene，后续 Business Advancement / GTM 实现会建立在不干净的发布面上，五月公开仓库目标会继续失真。

## 3. Scope

### In Scope

- 修复 public-release guard 的明确阻塞：
  - URL-embedded credential 示例。
  - public docs 中对 private docs root 的 path reference。
  - shared-layer 中的 tenant-specific slug 引用。
- 保持 tenant-specific 能力作为 private extension asset，不把它写进 shared product surface。
- 保持 Business Advancement production adoption No-Go。
- 更新必要 docs / STATUS / CHANGELOG。

### Out Of Scope

- 不改 Prisma schema。
- 不新增 API 或 route authority。
- 不接 production query。
- 不做 official write / auto-send / auto-approval。
- 不把 tenant-private code 通过 broad allowlist 强行放进 public release。
- 不重写 git history。

## 4. Five Review Lenses

| Lens | Review |
| --- | --- |
| Engineering | 先做最小 release hygiene slice；每次移动文件必须同步 import、tests、scripts，并跑 targeted validation。 |
| Product | GTM demo / tenant-specific worker 是商业演示资产，不是 Helm public core 主线。公开 core 仍应突出 Must Push / review-first / mobile command surface。 |
| Security | credential 示例与 private path / tenant slug 泄漏是 public-release blocker；不能靠文案解释绕过。 |
| Operations | 修复必须保留 fallback：私有 tenant repo 继续可恢复；public mirror 缺 private extension 时 graceful degrade。 |
| Data Protection | public trial / production data adoption 不因 founder approval 自动放行；redacted live evidence 与 privacy review 仍是硬门。 |

## 5. Work Orders

### WO-1 — Public Release Guard Triage And Minimal Fix

Objective：让 `npm run check:public-release` 从当前 119 blockers 收敛到 0，或输出只剩明确 owner-approved grandfathered policy descriptors。

Allowed changes：

- docs credential examples 改成 placeholder。
- public docs private path 改成 public policy document 或删去 private path。
- tenant-specific shared-layer files 移入 private tenant extension root 或改成 registry seam / neutral naming。
- tests / scripts 同步移动到 tenant-private root。

Forbidden changes：

- 不新增 broad prefix allowlist。
- 不把 tenant-specific feature / workspace route paths 继续留在 public shared layer。
- 不把真实 secret / host / customer identifier 写入 docs。

Validation：

```bash
npm run check:public-release
npm run check:boundaries
npm run typecheck
npm run test -- lib/bi-report-skill/row-level-signal-postprocessor.test.ts
git diff --check
```

If `check:boundaries` remains red due unrelated legacy marker drift, report exact remaining failures and prove the tenant/public-release slice is clean.

### WO-2 — Business Advancement Internal Gate Packet

Objective：准备 founder-led internal dogfooding packet for TPQR-001 / TPQR-003 / TPQR-004 without production adoption.

Allowed changes：

- decision packet / review report。
- CLI preflight wiring 或 docs-only work order。
- disabled-by-default flag evidence。

Forbidden changes：

- 不修改 `data/queries.ts` production path。
- 不修改 `/mobile` Must Push source。
- 不新增 schema / API / official write。
- 不开启 runtime flag。

Validation：

```bash
npm run test -- features/business-advancement
npm run check:boundaries
npm run typecheck
```

## 6. Rollout And Rollback

Release hygiene：

- Rollout：短分支、小提交、每项 guard failure 对应一个 fix。
- Rollback：若 tenant-private relocation 破坏 typecheck，则 revert relocation commit，不碰 unrelated work。

Business Advancement：

- Rollout：只到 disabled / allowlist-ready / manual review。
- Rollback：关闭 feature flag；fallback to read-first。

## 7. Recommendation

Codex 建议 owner 批准：

1. 立即执行 WO-1。
2. WO-1 通过或明确只剩 unrelated legacy failures 后，再进入 WO-2。
3. public trial 与 production query adoption 继续保持 Independent Review Required。

## 8. Decision Log

| Date | Decision |
| --- | --- |
| 2026-04-30 | Drafted for founder-led execution; pending owner review by continuing this thread |

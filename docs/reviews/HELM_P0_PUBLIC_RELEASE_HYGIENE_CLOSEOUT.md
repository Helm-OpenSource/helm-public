---
status: active
owner: helm-core
created: 2026-04-30
review_after: 2026-05-14
archive_trigger:
  - 2026-05 public trial release readiness report supersedes this closeout
  - public-release guard ownership moves into a dedicated release runbook
  - 30 days pass with no follow-up change referencing this closeout
---

# Helm P0 Public Release Hygiene Closeout

更新时间：2026-04-30
状态：P0 release hygiene closed for current slice

## 1. Conclusion

本轮 P0 release hygiene 已收口：`npm run check:public-release` 从失败恢复到 PASS，当前扫描 2912 files / 0 blockers。

这只证明 public mirror blocker 已关闭；它不等于完整 release readiness，也不解除 production data、public trial、privacy/security review 或 Business Advancement production query adoption 的 evidence gate。

## 2. Changes

- Developer quickstart 中的 local MySQL 示例改为 placeholder password，避免 URL-embedded credential 形状继续触发 release blocker。
- Public contribution guide 去掉 private docs root 直链，改为公开 launch / boundary material。
- Tenant-specific placeholder identity 从 shared connector tests 中移除，保留 synthetic `example.com` 姿态。
- BI row-level postprocessor 与 executor 不再从 shared business-skill runtime 直接 import private tenant runtime，改走 `lib/extensions/registry.tsx` seam。
- Approvals client 不再硬编码 private extension API path，改由 registry contribution 下发 handoff execution log URL。
- Public-release guard 与 boundary check 明确把 tenant-specific signals UI / demo scripts 视为 private-mirror surface；本轮不做 route 物理搬迁。
- Founder decision packet 中的公开规划措辞改为中性表达，不在 public planning doc 中泄漏私有租户名或私有路径。

## 3. Validation

| Command | Result |
| --- | --- |
| `git diff --check` | PASS |
| `npm run check:public-release` | PASS — scanned 2912 files; no public-mirror blockers |
| `npm run typecheck` | PASS |
| `npm run test -- lib/bi-report-skill/row-level-signal-postprocessor.test.ts lib/connectors/dingtalk-directory-invite.test.ts features/settings/permissions-dingtalk-dryrun-details.test.ts features/trial/actions.test.ts` | PASS — 4 files / 20 tests |
| `npm run check:boundaries` | FAIL — expected current-main legacy marker drift remains; tenant slug shared-layer reverse block PASS with 0 new violations |

## 4. Remaining Risks

- `npm run check:boundaries` still fails on legacy UI / boundary marker drift unrelated to this P0 release hygiene slice.
- Private tenant signals UI is classified as private surface but not physically relocated in this slice; physical relocation remains a separate route / registry task.
- Historical credential exposure in git history still requires owner-side rotation outside the repository.
- Docker compose runtime smoke and full release chain were not run in this slice.

## 5. Next Step

Proceed to Business Advancement internal gate packet only after this closeout is committed. Production query adoption remains No-Go until redacted real-data calibration and required review gates are satisfied.

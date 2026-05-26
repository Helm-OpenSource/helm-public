---
status: archived
owner: helm-core
created: 2026-04-22
review_after: 2026-10-19
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Imports CRM Ingress Disclosure Computer Use Polish v1

更新时间：2026-04-21
状态：Validation Passed; Full DB / E2E Not Run In This Slice
当前切片：`Computer Use attempted; Playwright confirmed /imports/crm default Chinese surface no longer exposes target ingress / connector / warmup implementation terms`

## 1. 目标

这次继续处理 `/imports/crm` 默认页的系统语：

1. 继续尝试 Computer Use 读取浏览器窗口；Safari / Atlas 不可用时，用 Playwright 操作真实本地页面复评。
2. 把 `ingress / read-only ingress / warmup / preview / connector / operator / review-first / recommendation-first` 等默认可见实现词，收成中文导入判断语言。
3. 保留 CRM 导入、冲突处理、预览、预热和连接器底层 truth，不改写写路径或权限。
4. 让页面先回答“来源是否可信、冲突是否要先处理、下一步是否该预览或导入”，而不是直接暴露连接器实现语。

## 2. 本轮不做

- 不改 CRM source、preview、import、warmup、conflict resolution 的行为。
- 不新增连接器权限、外部写回、发送、排期或执行能力。
- 不改底层枚举、schema、导入 job 或审计载荷。
- 不把 CRM 页扩成完整 connector admin plane、BI 平台或 auto-execution plane。

## 3. 影响面

- `features/imports/display-copy.ts`
- `features/imports/display-copy.test.ts`
- `features/imports/crm-import-client.tsx`
- `lib/i18n/messages.ts`
- `PLANS.md`
- `docs/README.md`
- `docs/reviews/HELM_IMPORTS_CRM_INGRESS_DISCLOSURE_COMPUTER_USE_POLISH_REPORT_V1.md`

## 4. 验证

- `npm run test -- features/imports/display-copy.test.ts` passed。
- `npm run test -- features/meetings/display-copy.test.ts features/imports/display-copy.test.ts` passed；2 files / 2 tests。
- `npm run typecheck` passed。
- Playwright `/imports/crm` 创始人 Demo 桌面 1440x1100：目标系统词计数 0，`rootDelta = 0`，`mainDelta = 0`。
- Playwright `/imports/crm` 创始人 Demo 移动 390x844：目标系统词计数 0，`rootDelta = 0`，`mainDelta = 0`。
- `npm run self-check` passed；11/11。
- `npm run check:boundaries` passed。
- `npm run lint` passed；保留 7 个既有 warning，无 error。
- `git diff --check` passed。
- `npm run build` passed；保留既有 Turbopack NFT warning。
- `npm run quality:regression` passed；51 files / 181 tests。
- `npm run test` attempted；15 个 DB-backed Helm v2 runtime tests 因本地 MySQL `127.0.0.1:3306` 不可达失败，非本轮页面显示层回归。
- `npm run db:reset` 未执行：破坏性数据库重置，且当前 MySQL 前提不可用。
- `npm run e2e` 未执行：当前完整测试已暴露 MySQL 前提不可用，本轮用定向 Playwright 覆盖页面桌面/移动真实 Demo 流程。

## 5. 剩余风险

1. 更深的 import result、conflict detail 和 raw payload 区仍可能保留真实实现词；本轮只处理 `/imports/crm` 默认层。
2. 中文显示层隐藏了部分 raw connector wording，排障时仍需要从底层 job、logs 和 payload 读取精确信息。
3. Computer Use 目前能列出 App，但 Safari / Atlas 窗口读取仍返回 `cgWindowNotFound`；后续仍需继续尝试。

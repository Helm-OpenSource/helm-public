---
status: archived
owner: helm-core
created: 2026-04-09
review_after: 2026-10-06
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM Skill Formal Review Decision Workflow Report V1

更新时间：2026-04-09

## 1. 本轮完成内容

本轮把 skill capability governance 从“只会进入 manual formal review queue”推进到“会留下明确人工决定”的状态。

代码面已经补齐：

- `SkillSuggestion` formal review decision / checklist fields 与 migration
- approve / defer / reject / return-hardening service
- approve / defer / reject settings action
- approve / defer / reject API route
- settings policies queued review checklist 与 recent formal review decisions surface
- dashboard evolution recent formal review decision preview
- route governance tests 与 skill suggestion service tests
- local sqlite init drift 收口
  - `db:reset` 现在会按 `DATABASE_URL=file:./dev.db` 重建真正被运行时使用的本地 SQLite
  - `self-check` 也会按同一条 local sqlite truth 验证，不再把 `prisma/dev.db` 误判成当前运行时数据库

## 2. 当前已经完整成立

- `APPROVED_PENDING_PROMOTION / DEFERRED / REJECTED` 已进入真实运行时
- operator 现在可以对 queued formal review item 做人工 approve、defer、reject 或 return-hardening
- reviewer、decision note、checklist、decision time 会一起进入持久化、audit、event 与 notification
- reject / return 已开始反向进入 calibration signal

## 3. 已成形但仍需下一层

- approved pending promotion 已成立，但 formal promotion helper 仍需下一层
- review queue calibration 已可运行，但仍需 queue aging、rollback、manual override 与 promotion 后复用效果

## 4. 刻意未做

- formal promotion helper
- formal skill auto-promotion
- static skill catalog auto-write
- routing / worker binding 扩权
- auto-send
- auto commitment
- high-risk official write authority expansion

## 5. 风险项

- `APPROVED_PENDING_PROMOTION` 仍容易被误读成“已经成为正式系统能力”
- checklist 如果沦为勾选表，会削弱 manual review 的含义
- reject / return 事件如果记录不完整，会削弱后续 calibration 解释力

## 6. 验证

按仓库 AGENTS 默认链验证：

- `npm run db:reset`：PASS
- `npm run self-check`：PASS
- `npm run check:boundaries`：PASS
- `npm run typecheck`：PASS
- `npm run lint`：PASS
- `npm run test`：PASS，`152` 个测试文件、`640` 个测试通过
- `npm run build`：PASS
- `npm run e2e`：FAIL，`22` 个用例里 `18` 个失败、`4` 个未运行
- `npm run quality:regression`：PASS，`51` 个测试文件、`180` 个测试通过

补充说明：

- 本轮保留 `approved pending promotion != formal skill`
- 本轮保留 `formal review decision workflow != formal promotion`
- 本轮保留 `manual review decision != execution authority`
- `lint` 过程中仍有 repo 既有大文件的 Babel deopt 提示，不影响通过
- `e2e` 过程中仍有 `NO_COLOR` warning，不影响定位
- 当前 `e2e` 失败面集中在现有 demo / dashboard / detail / continuity 路径：
  - `dashboard-meeting` seedable card 未出现
  - founder demo story / reporting protocol 标记未出现
  - 后续 web server 因现有页面状态退出，导致剩余用例出现 `ERR_CONNECTION_REFUSED`
- 这些 `e2e` 失败不是由 formal review decision workflow 这条线直接触发，但它们阻止了本轮拿到全绿验证链，需要后续单独收口

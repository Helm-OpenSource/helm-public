---
status: archived
owner: helm-core
created: 2026-04-09
review_after: 2026-10-06
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM Skill Formal Review Queue Report V1

更新时间：2026-04-09

## 1. 本轮完成内容

本轮把 skill capability loop 从“只看到 candidate / probationary 层”推进到“能看到校准信号，并能进入 manual formal review queue”的状态。

代码面已经补齐：

- `SkillSuggestion` formal review fields 与 migration
- calibration-driven promotion signal
- formal review queue / return-hardening service
- queue / return-hardening settings action
- queue / return-hardening API route
- settings policies formal review queue surface
- dashboard evolution formal review preview
- route governance tests 与 skill suggestion service tests

## 2. 当前已经完整成立

- `candidate_skill -> probationary_skill` 现在按 calibration signal 晋级
- `READY / QUEUED / HARDENING_REQUIRED` 已进入真实运行时
- operator 可以把 ready item 加入 manual formal review queue，也可以退回 hardening
- write path 继续保持 workspace policy governance、ownership、audit、event 与 notification

## 3. 已成形但仍需下一层

- formal review queue 已成立，但 formal skill 仍然必须人工补 catalog、tests、guards 和 docs
- calibration threshold 已可运行，但后续仍需更长周期试点数据继续调参

## 4. 刻意未做

- formal skill auto-promotion
- static skill catalog auto-write
- routing / worker binding 扩权
- auto-send
- auto commitment
- high-risk official write authority expansion

## 5. 风险项

- calibration signal 若调得过窄或过宽，会影响 operator 对晋级可信度的判断
- formal review queue 容易被误读成“已获得正式系统能力”
- hardening 事件如果记录不完整，会削弱后续 calibration 解释力

## 6. 验证

按仓库 AGENTS 默认链验证：

- `npm run db:reset`：PASS
- `npm run self-check`：PASS
- `npm run check:boundaries`：PASS
- `npm run typecheck`：PASS
- `npm run lint`：PASS
- `npm run test`：PASS，`152` 个测试文件、`634` 个测试通过
- `npm run build`：PASS
- `npm run e2e`：PASS，`22` 个浏览器用例通过
- `npm run quality:regression`：PASS，`51` 个测试文件、`180` 个测试通过

补充说明：

- 本轮额外运行了 `npm run pilot:check`，结果 PASS
- `lint` 过程中仍有 repo 既有大文件的 Babel deopt 提示，不影响通过
- `e2e` 过程中仍有 `NO_COLOR` warning，不影响通过

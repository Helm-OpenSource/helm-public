---
status: archived
owner: helm-core
created: 2026-04-09
review_after: 2026-10-06
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM Skill Suggestion Report V1

更新时间：2026-04-09

## 1. 本轮完成内容

本轮把 `PatternFact -> SkillSuggestion -> 人工 accept -> candidate capability` 从方案文档推进成 repo 内真实实现，并补齐 `candidate -> probationary -> formal` 的晋级边界表达。

代码面已经补齐：

- Prisma `SkillSuggestion` schema 与 migration
- `lib/evolution/skill-suggestion.service.ts`
- `refreshEvolutionState -> syncSkillSuggestions`
- `/api/evolution/skill-suggestions`
- `/api/evolution/skill-suggestions/:id/accept`
- `/api/evolution/skill-suggestions/:id/dismiss`
- settings policies operator surface
- dashboard evolution preview
- capability catalog candidate/probationary sync
- governance route tests 与 skill suggestion service tests

## 2. 当前已经完整成立

- 系统会基于稳定 pattern 生成 `SkillSuggestion`
- operator 可以人工 accept / dismiss
- accept 会把建议收口到 capability catalog 的 `candidate_skill`
- 更强证据会把它提升到 `probationary_skill`
- dashboard / settings 已能看到这层变化
- write path 保持 audit、notification、analytics 与 tenant ownership

## 3. 已成形但仍需下一层

- `formal review ready` 只是 readiness marker，不是 automatic promotion
- `probationary_skill -> formal skill` 仍然需要人工补静态 skill catalog、tests、guards 和 docs
- 当前主链后续又补了 calibration-driven promotion 与 manual formal review queue，但 formal skill 仍然只允许人工晋级

## 4. 刻意未做

- 自动创建正式 skill
- 自动扩张 routing / worker binding
- 自动发送外部消息
- 自动承诺 customer-facing outcome
- 高风险 official write authority 扩权

## 5. 风险项

- pattern 误判仍可能产生噪声 suggestion
- candidate/probationary 能力容易被误读为正式系统能力
- formal skill 晋级如果没有更硬的 review checklist，后续可能出现 catalog 漂移
- formal review queue 若被误读成自动晋级通道，也会削弱 `review-first` 和 `non-commitment` 边界

## 6. 验证

按仓库 AGENTS 默认链验证：

- `npm run db:reset`：PASS
- `npm run self-check`：PASS
- `npm run check:boundaries`：PASS
- `npm run typecheck`：PASS
- `npm run lint`：PASS
- `npm run test`：PASS，`152` 个测试文件、`632` 个测试通过
- `npm run build`：PASS
- `npm run e2e`：PASS，`22` 个浏览器用例通过
- `npm run quality:regression`：PASS，`51` 个测试文件、`180` 个测试通过

补充说明：

- `lint` 过程中仍有 repo 既有大文件的 Babel deopt 提示，不影响结果
- `e2e` 过程中仍有 `NO_COLOR` warning，不影响结果

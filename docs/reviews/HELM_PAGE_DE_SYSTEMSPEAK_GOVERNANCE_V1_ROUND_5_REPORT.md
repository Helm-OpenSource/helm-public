---
status: archived
owner: helm-core
created: 2026-04-11
review_after: 2026-10-08
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# 页面去铺陈化 / 去系统自述化治理方案 V1 第五轮报告

## 本轮目标

把前四轮已经完成的 detail family、queue / workspace / panel 收口，继续推进到项目级运行面 copy audit：

1. 清理剩余 detail hint、meeting explanation、settings / onboarding / public-entry 等高曝光运行面的系统主语
2. 把“去系统自述”从 broader surface audit 升级为 project-level systemspeak audit
3. 明确后台解释仍可保留，但前台主路径不再默认把系统放在主语位置

## 已经完整成立

- detail / handoff 主路径中残余的 `Helm can / Helm should / Helm now needs ...` 已继续改成对象优先表达
- meeting explanation、onboarding / public-entry、settings guidance、program catalog placeholder 等高曝光运行面已纳入同一轮收口
- [`shared-surface-hierarchy-guards.test.ts`](/Users/qianzhilong/Documents/helm/lib/presentation/shared-surface-hierarchy-guards.test.ts) 与 [`helm-self-check.ts`](/Users/qianzhilong/Documents/helm/scripts/helm-self-check.ts) 已新增 project-level systemspeak audit
- 项目级 audit 现在不再只是检查 `queue / workspace / panel`，也会覆盖 meeting / onboarding / settings / detail handoff 等主运行面

## 已成形但仍需下一层

- 后台 explanation / audit / runtime boundary 仍允许保留必要的系统能力说明，不属于前台硬禁区
- 少量 action / runtime / official integration 内部文案仍会保留品牌主语或系统能力措辞，它们不属于这轮 frontstage copy governance
- customer success detail model 的深层过程解释仍保留更多系统语义，后续如要继续压缩，需要单开一轮 backstage wording 治理

## 刻意未做

- 不把 repo 做成“全仓禁止出现 Helm”
- 不移除 evidence / audit / replay / trace
- 不削弱 review-first / boundary-first / non-commitment
- 不扩 send authority / execution authority / high-risk auto-write

## 风险项

- 如果新增运行面没有进入 project-level systemspeak audit，仍可能从新页面或 feature-local helper 回弹
- 当前 audit 明确允许品牌名、版本名和后台运行时边界继续存在；如果后续有人误把这层放大成“全面禁用 Helm 文案”，会误伤真实产品语境
- customer success / official integration 的后台解释层仍有系统能力说明，后续若无清楚分层，容易再次向前台回流

## recommendation / commitment 稳定性

- recommendation / commitment 边界没有被削弱
- 这轮继续把 `Prepared / Reviewed / Approved / Executed / Official` 语义和系统解释拆开，减少 AI 推断被误读成完成动作
- project-level running surface 的首屏现在更稳定地回到对象、判断、动作、边界，而不是系统自述

## 下一阶段最该做的 5 件事

1. 单开一轮 backstage wording 治理，继续压 customer success detail / post-send explanation 等深层系统主语
2. 把 project-level systemspeak audit 做成默认接入模板，给后续新页面直接复用
3. 补更明确的 onboarding / setup / login 例外说明，避免例外再次外溢成常规模板
4. 给 meeting / settings / onboarding / queue 补更完整的 copy regression e2e
5. 继续清理非核心但高曝光的 marketing / helper / disclosure copy，使品牌叙事和系统解释分层更稳定

## 验证结果

- `npm run db:reset` 通过
- `npm run self-check` 通过
- `npm run check:boundaries` 通过
- `npm run typecheck` 通过
- `npm run lint` 通过
- `npm run test` 通过
- `npm run build` 通过
- `npm run e2e` 通过
- `npm run quality:regression` 通过

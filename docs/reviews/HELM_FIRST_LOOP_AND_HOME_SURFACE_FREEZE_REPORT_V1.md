---
status: archived
owner: helm-core
created: 2026-04-13
review_after: 2026-10-10
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm First Loop And Home Surface Freeze Report V1

## 结论

`first-loop / onboarding / first-value` 与 `home surface / dashboard contract` 到当前这一阶段的冻结结论是：

- `已成形但仍需下一层`

原因很直接：

- first-loop 已经有 repo-aligned PRD、shared read-model、setup->dashboard handoff、per-user adoption readout、review/write-back proxy readout 与 explicit return-anchor trace
- dashboard 首页已经前置 `Top 1-3 work items / Needs Your Review / Resume / light blockers` 这一层 work-entry surface，并把更重的 first-loop / goal-driven / operating context 下沉到次层 disclosure
- dashboard 首页第二层现在也已显式补出 `detail / approvals / memory` 的 surface routing，把 why / review / replay 更明确地下推到 dedicated work surfaces
- targeted continuity e2e 漂移已经收口：同一套 isolated Playwright harness 下，recoverable / blocked / ineffective continuity recovery、remediation analytics 和 founder demo flow 都已通过
- 但这仍然不是 dedicated first-loop session object、不是 canonical home arbitration engine、也不是完整首页 IA 重写

## 已经完整成立

- first-loop 的 planning anchor 已成立：
  - [`HELM_FIRST_LOOP_PRD_V1.md`](../product/HELM_FIRST_LOOP_PRD_V1.md)
  - [`HELM_HOME_SURFACE_RULES_V1.md`](../product/HELM_HOME_SURFACE_RULES_V1.md)
- current-main shared first-loop read-model 已成立，并已接到 `/setup`、`/dashboard`、`/meetings/[id]`、`/approvals`、`/memory`、`/diagnostics`、`/reports`、`/operating`
- `/setup -> /dashboard` first-loop handoff 已成立，并显式前置 `single next action`
- explicit return-anchor trace 已成立，并继续保持 `recommendation != commitment`、`review-before-commitment`
- diagnostics 的 workspace-level 与 per-user first-loop adoption readout 已成立；`handoff / action / anchor / review / write-back` 现在都可读
- dashboard 首屏 baseline 已成立：
  - `Top 1-3 work items`
  - `Needs Your Review`
  - `Resume / Continue`
  - `light blocker summary`
- 首页的 heavier context 已经开始后置到 second-layer disclosure，而不是继续主导首屏
- 首页的 why / review / replay 也已开始被显式路由到 `Detail / Approvals / Memory`，而不是继续让 Home 自己长成解释面
- continuity e2e seed/harness 修复已成立：
  - continuity seed 现在会显式写入 `meeting.ended`
  - persisted lifecycle snapshot 会按 seed 后的最新 checkpoint / edit / runtime event 对齐
  - Playwright 真实验证现在使用同一套 isolated DB / build / server contract
- docs index、PLANS、自检、boundary guard、测试与 CI gate 已同步到 current-main truth

## 已成形但仍需下一层

- first-loop 仍主要是 shared read-model，不是 dedicated first-loop runtime contract
- `review / write-back completion` 目前仍是 `APPROVAL_APPROVED / MEMORY_FACT_CONFIRMED` proxy readout，不是 canonical completion object
- 首页四态仲裁与 `Top 1-3` 排序现在还是 baseline heuristic，不是成熟 arbitration engine
- second-layer disclosure 只完成了第一层下沉；虽然 `detail / approvals / memory` routing 已成立，但首页和下游 surfaces 的入口语义还需要继续收紧
- explicit return-anchor 仍挂在现有 `AuditLog` 上，不是 dedicated persisted lifecycle object

## 刻意未做

- 不做 first-loop 专用 schema / event table
- 不做 dedicated home session object
- 不做 onboarding 教程中心、模板商城、功能超市
- 不做 Vertical 行业对象包
- 不做 analytics platform
- 不做 auto-commit / auto-send / broader execution authority

## 风险项

- 如果首页排序失真，`Top 1-3` 会直接失去可信度
- 如果 second-layer disclosure 不够顺，首页仍可能在“太空”和“太满”之间摆动
- 当前 per-user adoption readout 足以支持运营判断，但还不是严格 funnel truth
- 这条线的 diff 跨页面、文档、guards、tests 和 CI；后续继续扩面时必须继续保持最小切片
- dashboard 里上一轮遗留的 `detailed readouts` 旧 second-layer JSX 路径已从 current-main 首页主运行路径和源码主块中移除，Home 与 `Detail / Approvals / Memory` 的分工更明确，但首页状态仲裁仍然只是 baseline heuristic
- current-main 还补了一层轻量 `home-surface arrival` 承接，保证用户从 Home 的 routing 卡进入 `detail / approvals / memory` 时，目标页首屏会显式说明为什么来到这里，以及这页当前承担的工作；其中 `approvals`、`memory` 与主 `detail` 路径下的 opportunity / contact / company / meeting work surface 在 home-entry 下都已压掉重复的跨页 summary，并补上页面自己拥有的 landing contract、单一主 CTA 与 second-layer disclosure，首屏更直接回到 dedicated work surface；最新一层里，`approvals` 已把 queue-side boundary context 后置到 next layer，`memory` 也已把 correction boundary、reflection history 和更重的 meeting-memory governance / replay context 后置到 next layer；dashboard 的 `detail` 卡当前也会优先落到 richer opportunity workspace，避免直接掉进更薄的 detail-like 页面
- 当前 `next build` / `npm run e2e` 仍会打印一条非阻断的 DingTalk Turbopack tracing warning；它不影响整链通过，但 current-main 还需要单独收掉这条 build-noise

## 必须继续诚实保留的边界

- 这仍然不是完整 onboarding platform
- 这仍然不是完整 home IA rewrite
- 这仍然不是 dedicated first-loop lifecycle system
- 这仍然不是 Vertical solution pack
- 这仍然不是 workflow engine、notification center 或 analytics platform
- Helm 仍然保持 `workspace-first / membership-backed / judgement-first / decision-first / review-before-commitment`

## 当前基线 / sprint 目标是否清楚

清楚。

当前这条线的收口目标是：

1. 先把 empty workspace 新用户第一次进入 Helm 的真实 first loop 冻成 current-main baseline
2. 再把登录后 dashboard 首屏收紧成真正的 work-entry surface
3. 最后把 docs / guards / tests / CI / validation 统一到同一版 baseline truth

## recommendation / commitment 两条主线是否仍保持稳定

保持稳定，仍然是 `A-minus`。

这一阶段没有把：

- recommendation 写成 commitment
- onboarding 写成教程中心
- home surface 写成产品宣言页
- first-loop action 写成自动承诺或自动发送

## 验证

完整标准链通过：

```bash
npm run db:reset
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```

针对刚才失败面的定向验证通过：

```bash
DATABASE_URL='file:.tmp/playwright/dev.db' PLAYWRIGHT_REUSE_SERVER='1' npx playwright test tests/e2e/continuity-recovery.spec.ts
DATABASE_URL='file:.tmp/playwright/dev.db' PLAYWRIGHT_REUSE_SERVER='1' npx playwright test tests/e2e/continuity-remediation-analytics.spec.ts
DATABASE_URL='file:.tmp/playwright/dev.db' PLAYWRIGHT_REUSE_SERVER='1' npx playwright test tests/e2e/demo-flows.spec.ts -g 'founder 主演示链路可以从首页进入会议再到审批'
npx playwright test tests/e2e/detail-hierarchy.spec.ts -g 'dashboard 把 explanation / review / memory replay 继续后置到 dedicated surfaces'
```

说明：

- targeted Playwright 验证使用同一套 isolated DB / build / server contract；不再混用默认开发数据库与 `.tmp/playwright/dev.db`
- 合并到 `main` 后还做过一次最小导入契约回收：`lib/helm-v2/eval-harness.ts` 继续从 `lib/evals/fixture-loader.ts` 引入 `loadEvalFixture`，避免 `shared.ts` helper-only 拆分后的类型塌陷；回收后完整标准链再次通过

## 下一阶段最该做的 5 件事

1. 把 first-loop completion 从 proxy readout 推进到更明确的 completion contract
2. 把 dashboard 四态仲裁与 `Top 1-3` 排序收成更稳定的 shared arbitration contract
3. 继续把首页上的 reasoning / memory / system context 后置，明确 `Home -> Detail / Approvals / Memory`
4. 为 second-visit continuity 补更清楚的 anchor lifecycle readback，而不是继续扩 analytics 广度
5. 在不扩 authority 的前提下，为首页和 first-loop 补更硬的 regression guard，防止首页再次长回指标墙和说教面

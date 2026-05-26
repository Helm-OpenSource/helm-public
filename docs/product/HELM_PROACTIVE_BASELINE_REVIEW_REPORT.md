---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_PROACTIVE_BASELINE_REVIEW_REPORT

## 目标

把《Helm 主动汇报 / 主动协作机制 Sprint 1》收成一版可冻结、可复盘、可演示、可培训的正式基线，并确认代码、页面、文档、守卫、测试、自检已经重新对齐。

## 本轮重新 review 的材料

- `README.md`
- `docs/README.md`
- `docs/product/HELM_ACTIVE_REPORTING_MECHANISM_REPORT.md`
- `docs/product/HELM_PROACTIVE_COLLABORATION_MECHANISM_REPORT.md`
- `docs/product/HELM_PROACTIVE_FLOW_IMPLEMENTATION_REPORT.md`
- `docs/product/HELM_PROACTIVE_REPORTING_COLLABORATION_SPRINT_1_REPORT.md`
- `docs/product/HELM_REPORTING_PROTOCOL_REPORT.md`
- `docs/product/DECISION_FIRST_IA_REPORT.md`
- `docs/product/helm-proactive-work-and-human-collaboration-protocol-v1.md`
- `docs/product/demo-script.md`
- `docs/pilot/manual-acceptance-paths.md`
- `docs/pilot/delivery-boundary.md`
- `components/shared/proactive-mechanism-panel.tsx`
- `lib/presentation/proactive-mechanism.ts`
- `app/(workspace)/dashboard/page.tsx`
- `features/opportunities/opportunities-client.tsx`
- `features/approvals/approvals-client.tsx`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `scripts/pilot-readiness-check.ts`
- `lib/presentation/proactive-mechanism.test.ts`
- `tests/e2e/demo-flows.spec.ts`

## 已与代码实现一致的表述

1. Helm 当前已经有统一的 `active reporting` 协议，而不是零散页面文案。
2. Helm 当前已经有统一的 `proactive collaboration` 协议，而不是每页单独命名的人机交互提示。
3. 首页、机会页、审批页已经真实接通 3 条代表性主动链路。
4. 当前主动机制默认以 `suggest / prepare / escalate / request decision` 为主，不是完整自动执行平面。
5. worker / packs / scenarios / proposal / package / evidence / memory 已经能挂到同一套主动汇报语义里。

## 已足以冻结的能力

1. `periodic / event / request` 三类 active report。
2. `helm_drives_human_supervises / helm_prepares_human_decides / helm_reminds_human_leads` 三类协作模式。
3. 3 条代表性主动链路：
   - 风险变化 -> founder 决策请求
   - proposal / package 新阶段 -> sales / delivery 协作
   - worker internal draft -> review / approval request
4. shared proactive panel 与 representative page 接入方式。
5. founder demo / acceptance / delivery 的最小主动机制讲法。

## 仍需降级口径的地方

1. 当前不是 complete proactive engine。
2. 当前不是 full collaboration system。
3. 当前不是 automatic execution plane。
4. 当前不是 notification center 或 BI 平台。
5. 当前不是全站统一 handoff / worker assignment console。

## 仍只是下一阶段候选的能力

1. customer success / expansion review 主动协作链。
2. contacts / companies / meetings / inbox 的主动接入。
3. 统一 worker assignment / handoff 视图。
4. 低风险 internal follow-up 的受控自动执行白名单。
5. 更完整的事件提醒 surface，而不是只靠代表页承接。

## 必须继续诚实保留的边界

1. `app/` 仍是当前唯一或主要 route owner。
2. `data/queries.ts` 仍是查询聚合入口，只是已经更薄。
3. plugin runtime 仍没有真正 sandbox。
4. 仍存在少量 legacy shim。
5. future-real auth 仍不是完整生产级认证。
6. OpenShell / OpenClaw / NemoClaw 当前仍是更接近真实 adapter / process 的最小外部桥接目标。
7. 当前系统仍不是完整企业级多组织 / 多权限 / 多租户平台。
8. 当前主动机制仍是第一轮落地，不是完整自动执行平面。
9. 当前 Helm 仍默认以“建议、准备、升级”为主，不默认拥有高风险自动承诺和高风险自动发送权限。

## 结论

- 全项目主动汇报 / 主动协作关键口径已经一致。
- 当前版本已经足以冻结成正式基线。
- 需要继续诚实保留的边界也已经清楚，不存在“文档说完整自动执行，代码实际上只是建议与升级层”的裂缝。

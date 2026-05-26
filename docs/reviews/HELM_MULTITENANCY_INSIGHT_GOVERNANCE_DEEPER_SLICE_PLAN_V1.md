---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Multitenancy Insight Governance Deeper Slice Plan V1

更新时间：2026-04-05  
状态：In Progress  
对应分支：`codex/pr52-insight-governance-deeper-slice`

## 1. 当前 freeze truth

继承 PR42-PR51：

- DB-backed auth session 已成立
- fixed-role capability matrix 已成立
- settings / memory / programs / connector / import / commercial / workspace data / governed action 的多批高风险写路径已 capability 化
- org-admin governance support-pack 已成立
- tenant-scoped retention / export / delete / auth-session posture 已有前几层 readout

当前仍属“已成形但仍需下一层”的部分：

- weekly report generation 仍只依赖 login + workspace session，没有进入统一 capability seam
- recommendation feedback 的 user entry path 仍只依赖 login + workspace session，没有进入 tenant-scoped capability guard
- strategy suggestion 的 settings action 已有 policy capability，但 API write route 仍未对齐这层治理 seam
- org-admin governance support-pack 还看不到 report generation / recommendation feedback / strategy suggestion adoption 这组 insight-governance follow-through
- reports surface 还缺 capability-aware manage / read-only posture，settings governance 也还不能解释这组 write path 的 posture 与 latest marker

## 2. PR52 要证明什么

PR52 要证明：Helm 当前 `workspace-first` 多租户模型下，reporting / recommendation feedback / strategy suggestion 这组 tenant-sensitive insight write path 可以继续收紧到：

1. weekly report generation、recommendation feedback user entry、strategy suggestion accept / dismiss API write 全部进入 tenant-scoped capability seam
2. 这条 insight-governance 主链继续保持 judgement-first / review-first，不把 recommendation / strategy adoption 写成 commitment，也不扩大 execution authority
3. org-admin support-pack 能看见 report generation / recommendation feedback / strategy suggestion adoption 的 30d follow-through 和 latest audit marker
4. reports / settings governance surface 在权限不足时会进入 capability-aware read-only posture，而不是只依赖 server deny

这是一条更深的治理 slice，不是新的 recommendation platform、不是 BI governance center，也不是 execution surface。

## 3. 精确闭环

本轮闭环限定为：

1. 成员进入 reports / recommendation feedback / strategy suggestion write path
2. shared insight-governance seam 对高风险 insight write 执行 tenant-scoped allow / deny
3. audit / support-pack / settings governance surface 记录并展示 insight governance follow-through
4. reports surface 在 capability 不足时明确进入 read-only posture
5. tenant-scoped support-pack 继续保持治理快照，不扩 execution authority

## 4. 保留边界

继续保持：

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`

继续明确不做：

- full RBAC builder
- SSO / SCIM / domain claim
- org hierarchy / shared billing
- schema-per-tenant / db-per-tenant
- broader tenant-admin platform / governance center
- broader recommendation platform / BI platform
- continuity surface 深挖

## 5. 阶段计划

### Phase 0

- 创建计划文档
- 更新 `PLANS.md`
- 锁定 scope / truth / risk / validation

### Phase 1

- 新增 shared insight-governance helper
- 把 weekly report generation、recommendation feedback user entry、strategy suggestion API write 接入 capability seam

### Phase 2

- 扩 `org-admin governance` summary / support-pack
- 加入 insight-governance 30d 计数与 latest marker

### Phase 3

- 在 reports / settings governance surface 上增加 capability-aware posture
- 补齐 denial wording 与 boundary notes

### Phase 4

- docs / self-check / boundary / tests / report
- 完整验证并准备 stacked PR

## 6. 风险

1. insight write path 如果继续散落，capability drift 会再次出现
2. recommendation feedback / strategy suggestion 如果只靠页面语义而不补统一 guard，会留下 tenant-sensitive adaptive write 灰区
3. support-pack 如果仍看不到 report generation / feedback / suggestion adoption follow-through，租户治理 truth 会继续低估 recommendation / reporting 真实写面
4. 如果为了“更完整”顺手扩成 broader recommendation platform、full RBAC 或 execution surface，会偏离 Helm 当前 fixed-role 和 controlled-trial 边界

## 7. 验证合同

每阶段至少：

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`

最终收口：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

领域额外核验：

- recommendation feedback 继续保持 evidence bridge，不把 ranking / policy owner 偷给 LLM
- weekly report 继续保持 summarize / suggest posture，不写成 telemetry-backed commitment

## 8. 明确 deferred

本轮刻意不做：

- full RBAC / custom role builder
- enterprise IAM / SSO / SCIM
- org hierarchy / shared billing
- schema-per-tenant / db-per-tenant
- broader tenant-admin platform / governance center
- full recommendation platform / BI platform
- execution authority expansion

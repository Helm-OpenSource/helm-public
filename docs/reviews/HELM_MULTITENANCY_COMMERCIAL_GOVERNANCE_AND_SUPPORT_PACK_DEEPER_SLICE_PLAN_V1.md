---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Multitenancy Commercial Governance And Support-Pack Deeper Slice Plan V1

更新时间：2026-04-05  
状态：Completed  
对应分支：`codex/pr49-high-risk-write-path-governance-follow-through`

## 1. 当前 freeze truth

继承 PR42-PR48：

- DB-backed auth session 已成立
- fixed-role capability matrix 已成立
- settings / memory / programs / connector / import 的第一批高风险写路径已 capability 化
- org-admin governance support-pack 已成立
- tenant-scoped retention / export / delete / auth-session posture 已有前几层 readout

当前仍属“已成形但仍需下一层”的部分：

- billing / contribution registry / participant portal / program application 仍分散在多个 helper 文件里，缺一层更清晰的 shared commercial-governance seam
- org-admin support-pack 对 program governance 的 follow-through 还不完整，participant portal 也没有覆盖 onboarding / profile update 这类真实后续动作
- settings governance 虽然已有 broad posture，但还不能把商业治理域里的 program / participant follow-through 讲完整

## 2. PR49 要证明什么

PR49 要证明：Helm 当前 `workspace-first` 多租户模型下，commercial governance 这条 tenant-sensitive 管理主链路可以继续收紧到：

1. billing / registry / participant portal / program application 进入更统一的 shared capability seam
2. org-admin support-pack 能更完整表达 participant self-service 与 program governance follow-through
3. settings governance surface 能更诚实地展示这些 follow-through，而不把它们夸大成 broader tenant-admin platform

这是一条更深的治理 slice，不是新的平台扩张。

## 3. 精确闭环

本轮闭环限定为：

1. 成员进入 workspace settings / participant portal / program governance 相关 surface
2. 触发 participant portal issue / status update / onboarding / profile update，或 program application submit / review / invite
3. shared commercial-governance seam 对内部高风险写路径执行 tenant-scoped allow / deny
4. audit / support-pack / settings governance surface 记录并展示 participant / program follow-through
5. 导出的 org-admin support-pack 继续保持 tenant-scoped governance snapshot，不扩 execution authority

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
- org hierarchy
- schema-per-tenant / db-per-tenant
- broader tenant-admin platform
- continuity surface 深挖

## 5. 阶段计划

### Phase 0

- 创建计划文档
- 更新 `PLANS.md`
- 锁定 scope / truth / risk / validation

### Phase 1

- 新增 shared commercial-governance helper
- 收回 settings / participant-portal / programs 的局部 capability helper

### Phase 2

- 扩 `org-admin governance` summary / support-pack
- 加入 participant onboarding / profile update 与 program submission / review / invite 的 30d 计数与 latest marker

### Phase 3

- 在 settings governance surface 增加商业治理 follow-through readout
- 补齐 capability-aware wording 与 boundary notes

### Phase 4

- docs / self-check / boundary / tests / report
- 完整验证并准备 stacked PR

## 6. 风险

1. commercial governance helper 若继续分散，后续 capability 扩展会再次漂移
2. participant portal 若不记录 onboarding / profile update，support-pack 会低估真实治理动作
3. program application 若没有 submission follow-through，tenant-scoped governance truth 会继续偏向 review 后阶段
4. 如果为了“更完整”顺手做 enterprise tenant-admin 平台，会偏离 Helm 当前 fixed-role 和 controlled-trial 边界

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

## 8. 明确 deferred

本轮刻意不做：

- full RBAC / custom role builder
- enterprise IAM / SSO / SCIM
- org hierarchy / shared billing
- schema-per-tenant / db-per-tenant
- broader tenant-admin platform / governance center
- execution authority expansion

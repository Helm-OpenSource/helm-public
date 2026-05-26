---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement Phase 3C Runtime Entry Review V1

更新时间：2026-04-26
状态：Runtime entry review complete / 不批准 runtime implementation / 条件批准 thin read-model adapter plan

---

## 结论

Phase 3C 的结论是：**不批准直接进入 runtime implementation，但批准进入下一步 thin read-model adapter plan**。

可继续进入 adapter plan 的范围只包含：

- TPQR-001 / PF3-001：`blocked_decision`
- TPQR-003 / PF3A-003：`overdue_commitment`
- TPQR-004 / PF3A-004：`customer_waiting`

继续保持 No-Go：

- TPQR-002 / PF3A-002：`stalled_opportunity` 基于 `Opportunity.updatedAt` 的 staleness heuristic
- TPQR-005 / PF3A-005：`tenant_resource stalled_case` 作为 human-inactivity 信号

本评审不批准：

- Prisma schema 变更
- API route
- 页面 / dashboard / mobile UI 接入
- `features/mobile/lib/mobile-command-read-model.ts` 修改
- `data/queries.ts` 生产查询接入
- runtime extractor / event queue / background job
- official write / outbound send / automated execution
- LLM final ranking

下一步允许做的唯一事项是：写一份 **Phase 3D Thin Read-Model Adapter Plan**，把三条已批准 planning candidate 如何以只读、可关闭、可审计、可回滚的方式进入未来 thin adapter 说清楚；仍不写 runtime code。

---

## 一、Findings

| Finding | 严重程度 | 结论 |
| --- | --- | --- |
| Phase 3B 已经证明三条 planning candidate 的输入形状、边界文案、排除原因和 deterministic ordering 可测试 | 中 | 可以作为 adapter plan 的输入，但不能直接作为 production query |
| TPQR-001 的 48h 阈值仍是 synthetic planning candidate | 高 | adapter plan 必须要求真实数据校准，不得把 48h 直接写成生产阈值 |
| TPQR-003 已明确 persisted `Commitment.overdueFlag` 不是时间敏感过滤权威 | 高 | adapter plan 必须采用 read-time `dueDate/status` 派生或既有 `deriveOverdueFlag`，不得依赖 persisted column |
| TPQR-004 的风险不在查询本身，而在 producer overlap | 高 | adapter plan 必须保留 after-producer `emailThreadId` dedup 与 TPQR-004-first tie-break |
| TPQR-002 的 `Opportunity.updatedAt` 会被 sync/system writer bump | 高 | 不得进入 adapter plan，除非另行替换 source heuristic 或标注 sync-safe human activity source |
| TPQR-005 当前只能表达 evidence freshness，不能表达 human inactivity | 高 | 不得作为经营推进 stalled_case 信号进入 adapter plan |

---

## 二、Runtime Entry Decision Matrix

| TPQR | Signal | Phase 3B 状态 | Phase 3C 决策 | 进入 adapter plan 的条件 |
| --- | --- | --- | --- | --- |
| TPQR-001 / PF3-001 | `blocked_decision` | Planning Go | Conditional-Go to adapter plan | 仅保留 read-only candidate shape；48h 作为 calibration placeholder；必须显式保留 review_required 与 boundary note |
| TPQR-003 / PF3A-003 | `overdue_commitment` | Conditional Planning Go | Conditional-Go to adapter plan | 只允许 read-time `dueDate/status` 派生；候选不得暴露或依赖 persisted `overdueFlag` |
| TPQR-004 / PF3A-004 | `customer_waiting` | Conditional Planning Go | Conditional-Go to adapter plan | 必须先构建 producers，再按 `emailThreadId` merge / dedup；TPQR-004 producer 优先 generic producer |
| TPQR-002 / PF3A-002 | `stalled_opportunity` | No-Go for updatedAt heuristic | No-Go | 需要另行证明 human activity source，不得用 `Opportunity.updatedAt` |
| TPQR-005 / PF3A-005 | `stalled_case` | No-Go as human inactivity | No-Go | 除非产品语义降级为 evidence-freshness-only，否则不得进入经营推进信号 |

---

## 三、Allowed Next Work

下一步只允许创建一份 `Phase 3D Thin Read-Model Adapter Plan`，内容必须回答：

1. Adapter plan 是否只覆盖 TPQR-001 / TPQR-003 / TPQR-004。
2. Adapter plan 如何保持 read-only，不写 DB，不调用外部系统，不触发 official write。
3. Adapter plan 如何证明不需要 schema、API、page、mobile surface 或 production query adoption。
4. Adapter plan 如何继承 workspace membership / capability 过滤，而不是在 adapter 内重造权限系统。
5. Adapter plan 如何保留三个不变量：TPQR-003 persisted-column non-authority、TPQR-004 dedup ownership、所有候选 deterministic ordering。
6. Adapter plan 如何处理 threshold：synthetic fixture 阈值只能作为 calibration placeholder，不能作为 production threshold。
7. Adapter plan 如何提供 rollback / disable posture。
8. Adapter plan 如何输出 validation matrix，而不是直接提交 runtime code。

---

## 四、Runtime Implementation 进入门槛

即使 Phase 3D adapter plan 通过，runtime implementation 也仍需单独审批。最低进入门槛如下：

| Gate | 要求 |
| --- | --- |
| Scope gate | 只允许 TPQR-001 / TPQR-003 / TPQR-004；TPQR-002 / TPQR-005 继续排除 |
| Data gate | 每条 candidate 都有 source row、workspace scope、evidence refs、review posture、boundary note |
| Permission gate | 查询必须继承既有 workspace membership / capability 边界；不得扩大对象可见性 |
| Determinism gate | 最终排序由确定性规则产生；LLM 只可生成解释或摘要，不可决定排序 |
| Threshold gate | synthetic threshold 不可直接生产化；必须有真实数据校准或 explicit conservative default |
| Safety gate | recommendation != commitment、explanation != approval、draft != send、proof != external write success 必须出现在高风险 candidate |
| Rollback gate | 任一 candidate family 必须可禁用；禁用后系统回到既有 read-model 行为 |
| Audit gate | 必须能追踪 source row、decision rule、excluded reason 与 validator result |

---

## 五、受影响组件

Phase 3C 本身只影响文档：

- `docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3C_RUNTIME_ENTRY_REVIEW_V1.md`
- `docs/README.md`

Phase 3D adapter plan 可评估但不得直接修改的组件：

- `features/business-advancement/*`
- `features/mobile/lib/mobile-command-read-model.ts`
- `data/queries.ts`
- `app/*`
- `app/api/*`
- `prisma/schema.prisma`

这些组件在 Phase 3C 仍然保持未修改。

---

## 六、权衡

| 选项 | 结果 | 评估 |
| --- | --- | --- |
| 直接 runtime implementation | 速度最快，但会把 planning threshold 与 synthetic fixtures 写成生产事实 | 拒绝 |
| 继续无限期 review | 最安全，但会阻断 Must Push 进入真实读模型验证 | 拒绝 |
| 先做 thin read-model adapter plan | 可以保持实现后置，同时把下一步工程边界、权限、回滚、验证说清楚 | 采纳 |

Phase 3C 选择第三种路径，因为它能推进工程准备，但不会突破 review-first / read-first / no-auto-execution 边界。

---

## 七、验证要求

本文件写入后至少运行：

- `git diff --check`
- `npm run check:boundaries`

如果 Phase 3D 进入 adapter plan，必须补充：

- `npx vitest run features/business-advancement/*.test.ts`
- 未来新增 adapter-plan evaluator script
- 明确证明没有修改 schema、API、page、mobile surface 或 production query

---

## 八、剩余风险

| 风险 | 处理 |
| --- | --- |
| 团队把 adapter plan 当作 runtime approval | 在本文状态行和结论中明确 runtime implementation 仍 No-Go |
| 真实数据校准不足 | Phase 3D 必须把 calibration path 写成进入 runtime 的独立 gate |
| 权限边界被 adapter 复制时漂移 | Phase 3D 必须要求继承现有 membership / capability，不重造权限层 |
| mobile Must Push 被提前接入 | Phase 3C 不批准修改 `features/mobile/lib/mobile-command-read-model.ts`；任何 mobile surface 接入需单独 review |
| TPQR-002 / TPQR-005 被顺手带入 | 本文继续列为 No-Go，Phase 3D scope gate 必须显式排除 |

---

## 九、下一步建议

下一步创建：

`docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3D_THIN_READ_MODEL_ADAPTER_PLAN_V1.md`

该计划只做 planning，不写 runtime code。建议按三段组织：

1. Allowed candidate families：TPQR-001 / TPQR-003 / TPQR-004 的 adapter input / output / exclusion rule。
2. Adapter non-goals：不改 schema、不加 API、不改 UI、不改 mobile read-model、不接 production query。
3. Validation matrix：scope、permission、determinism、threshold calibration、rollback、audit、boundary wording。

Phase 3D 未完成并通过前，不进入 runtime implementation。

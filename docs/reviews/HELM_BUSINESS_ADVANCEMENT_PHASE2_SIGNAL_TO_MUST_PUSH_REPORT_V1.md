---
status: archived
owner: helm-core
created: 2026-04-26
review_after: 2026-10-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Business Advancement Phase 2 Signal -> Must Push 报告 V1

更新时间：2026-04-26
状态：Phase 2 planning adapter complete / runtime adoption not started
本阶段：Signal -> Must Push Adapter（offline / pure / planning-only）
关联入口：[HELM_BUSINESS_ADVANCEMENT_PHASE2_ENTRY_GATE_AND_TASK_BREAKDOWN_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE2_ENTRY_GATE_AND_TASK_BREAKDOWN_V1.md)

---

## 一、已经完整成立

| 交付项 | 位置 | 说明 |
| --- | --- | --- |
| Signal -> Must Push adapter | `features/business-advancement/must-push-adapter.ts` | 纯函数 adapter，把 Phase 1A fixture 与 Phase 1B feasibility row 转成 active / deferred planning result |
| Deterministic ranking / compression | `features/business-advancement/must-push-adapter.ts` | 使用确定性 sortKey 压缩 top 3-5 Must Push items；不使用 LLM 排序 |
| Adapter tests | `features/business-advancement/must-push-adapter.test.ts` | 13 个测试通过，覆盖 20 fixtures、future-only deferred、blocked deferred、active grounding、shuffle 稳定性、no forbidden primary action language |
| Adapter eval script | `scripts/business-advancement-must-push-adapter-eval.ts` | 输出 active / deferred / top items / checks，并以 exit code 表达通过或失败 |

**当前 adapter 结果：**

| 指标 | 结果 |
| --- | ---: |
| Total fixtures | 20 |
| Active candidates | 14 |
| Deferred results | 6 |
| Top Must Push items | 5 |
| Eval checks | 6/6 passed |

**Top Must Push items：**

| 排名 | Item | Risk | Review posture | Title |
| ---: | --- | --- | --- | --- |
| 1 | `must-push:AS-FX-002` | high | human_owner_required | 确认合同条款负责人 |
| 2 | `must-push:AS-FX-009` | high | human_owner_required | 补齐资源证明材料 |
| 3 | `must-push:AS-FX-020` | high | human_owner_required | 补齐试点前提证明 |
| 4 | `must-push:AS-FX-003` | high | review_required | 补齐会后动作 owner |
| 5 | `must-push:AS-FX-008` | high | review_required | 处理逾期资源动作 |

---

## 二、已成形但仍需下一层

| 对象 | 当前状态 | 下一层要求 |
| --- | --- | --- |
| Must Push adapter | offline / pure / planning-only 已成立 | 下一阶段才能考虑接入 read model；接入前需重新评审 membership / capability gate |
| Ranking contract | 确定性排序测试已通过 | 真实数据接入前需补 false positive / duplicate/noisy signal 回归样本 |
| Deferred handling | `future_only` 与 `blocked` 均不会生成 active candidate | 后续如新增数据来源，仍需先进入 feasibility，而不是直接 active |
| Primary action | Adapter 生成安全 action label，不沿用可能被误解的 fixture 原始动作文案 | UI 接入时必须继续避免“完成 / 执行 / 发送 / 写回 / 承诺”语义 |
| Evaluation | CLI 已能证明 20 fixture -> active/deferred/top5 | 下一阶段需要将 eval 纳入持续验证或 package script，当前尚未加入 `package.json` |

---

## 三、刻意未做

| 未做项 | 原因 |
| --- | --- |
| Prisma schema | Phase 2 当前仍是 planning adapter，不持久化 |
| API route | 不暴露 runtime 接口 |
| Runtime extractor | 不扫描会议、CRM、邮件、报表或用户行为 |
| Event ingestion / queue | 不创建事件流 |
| Official write / auto-write | 永久禁止，当前也无任何写路径 |
| Page behavior change | 未接 dashboard / mobile / operating 页面 |
| LLM final ranking | 排序完全由 deterministic sortKey 决定 |
| Future-only runtime support | AS-FX-010 / 011 / 014 / 016 / 017 继续 deferred |
| Blocked boundary 转 active | AS-FX-015 继续 deferred，不给跨 workspace / tenant 路径 |

---

## 四、风险项

| 风险 | 严重程度 | 说明与缓解 |
| --- | --- | --- |
| Fixture-derived adapter 可能过拟合合成样本 | 中 | 当前只证明 contract 和边界，不证明真实客户数据效果；后续 pilot 必须追踪 false positive 和 accepted rate |
| Safe primary action 可能过于通用 | 中 | 为避免 commitment / write 误读，当前 action label 更保守；UI 接入前可在不越界前提下增加对象类型提示 |
| Thin projection 尚未接真实 query | 中 | Phase 2 当前不接 read model；下一阶段必须逐个 query 评审 |
| Top 5 全部为 high risk | 低 | 这是当前 fixture 权重的预期结果；真实数据接入后需验证不会长期压制中风险但高收益事项 |
| Claude Code CLI 协同不稳定 | 中 | 本轮 Claude Code 多次无输出长跑；后续应继续使用更小任务、短超时和 Codex 二次验证 |

---

## 五、验证结果

### 5.1 Adapter tests

```bash
npx vitest run features/business-advancement/must-push-adapter.test.ts

 Test Files  1 passed (1)
      Tests  13 passed (13)
```

### 5.2 Adapter eval

```bash
npx tsx scripts/business-advancement-must-push-adapter-eval.ts

Total fixtures:     20
Active candidates:  14
Deferred results:   6
Top items:          5

6/6 checks passed
Phase 2 Must Push adapter eval PASSED
```

### 5.3 ESLint

```bash
npx eslint scripts/business-advancement-must-push-adapter-eval.ts \
  features/business-advancement/must-push-adapter.ts \
  features/business-advancement/must-push-adapter.test.ts

(0 errors, 0 warnings)
```

### 5.4 Git whitespace check

```bash
git diff --check -- scripts/business-advancement-must-push-adapter-eval.ts \
  features/business-advancement/must-push-adapter.ts \
  features/business-advancement/must-push-adapter.test.ts

(0 whitespace errors)
```

---

## 六、下一阶段建议

建议下一阶段只做 `Phase 2B read-model projection integration review`，不要直接接页面：

1. 选 3 个 active candidate 来源做真实 query proof：meeting、tenant_resource、crm。
2. 每个 query 必须证明 workspace / membership / capability 边界。
3. 继续保持 output planning-only。
4. 通过后再评估 dashboard / mobile / operating 的只读展示接入。

未完成上述条件前，不进入 runtime extractor、official write、auto execution 或 UI 行为改变。

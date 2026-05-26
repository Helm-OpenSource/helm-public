---
status: archived
owner: helm-core
created: 2026-05-19
review_after: 2026-11-15
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Ask Helm Evidence-Grounded Action Packet Closeout

## 结论

Ask Helm v2.1 新增 evidence-grounded action packet：当用户在 `/search?mode=ask` 提出计划分解、草稿准备、复核材料包、内部跟进、交接或执行类需求时，解释器会生成一份只读行动包，明确列出证据引用、风险、缺口、复核清单和下一步落点。

本轮能力已经进入页面、解释器 contract、离线 evaluator 与聚合验证链。它不是 workflow engine，不写入正式队列，不发送消息，不审批，不付款，不承诺，也不写回 CRM 或其他外部系统。

## 本轮实现

- `features/search/ask-helm-interpreter.ts`
  - 新增 `AskHelmActionPacket` contract。
  - 证据来源固定为 query reference、workspace object、business signal、reviewed memory、workspace context、Helm semantics、boundary。
  - authority 固定为 read-only / no write / no auto-execute / no formal commitment。
- `app/(workspace)/search/page.tsx`
  - 在 Ask Helm 回答下展示证据化行动包。
  - UI 展示证据引用、风险缺口、复核清单和 next surface。
  - 语音输入未确认时显示 blocked posture。
- `lib/evals/ask-helm-action-packet-evals.ts`
  - 覆盖 grounded plan、review-required execution、missing object draft、unconfirmed voice transcript 四类 case。
  - 验证 authority leak 为 0。
- `scripts/ask-helm-validation-suite.ts`
  - 将 action packet gate 接入 `npm run eval:ask-helm`。

## 刻意未做

- 不接 DB schema、Prisma model、API route 或 background queue。
- 不保存 raw prompt、raw audio 或多轮聊天历史。
- 不调用 LLM 生成最终行动包 authority。
- 不做自动发送、自动审批、自动创建正式 Must Push、自动写 CRM 状态。
- 不把 context packet offline gate 升级为 production prompt adoption。

## 验证结果

- `npm run test -- features/search/ask-helm-interpreter.test.ts lib/ask-helm-validation-suite.test.ts`：19 tests PASS。
- `npm run eval:ask-helm-action-packet`：4 / 4 PASS，authorityLeakCount = 0。
- `npm run eval:ask-helm`：ok = true；queryIntent 38 / 38，actionIntent 36 / 36，actionPacket 4 / 4，authorityLeakCount = 0。
- `npm run typecheck`：PASS。
- `npm run self-check`：59 / 59 PASS。
- `npm run check:boundaries`：PASS；仅保留既有 warn-mode stdio spawn inventory 提示。
- `npm run lint`：PASS。
- `npm run build`：PASS。
- `npm run quality:regression`：127 tests PASS。
- `git diff --check`：PASS。
- `PLAYWRIGHT_DATABASE_URL=<helm2026_ci_verify> npm run e2e`：Ask Helm 相关搜索、语音和 action packet 断言 PASS；全量 E2E 为 50 / 54 PASS，剩余 4 个失败落在 demo/report/settings 旧断言或页面状态，不属于本轮 `/search?mode=ask` 行动包切片。

## 剩余风险

- Context Packet 仍按 offline gate 口径存在，不代表 production LLM prompt adoption 已完成。
- 全量 E2E 仍有 demo/report/settings 侧失败，需要独立收口；当前失败未指向 Ask Helm 行动包链路。
- 若未来接入 runtime action queue，必须新增独立 schema / API / audit / reviewer approval / rollback gate，不能复用本轮只读行动包作为写权限依据。

---
status: active
owner: helm-core
created: 2026-05-03
review_after: 2026-08-01
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Mobile Judgement Loop Implementation Contract

## 1. 当前实施结论

`/mobile` 的 P0 首屏从 `Ask Helm + Must Push list` 升级为 `Mobile Judgement Loop Minimum`：

1. 顶部先展示 `MobileHeroCard`。
2. Hero 由既有 `MustPushItem[]` 的首项通过 deterministic mapper 派生。
3. Hero 下提供 evidence source hint 与 Helm interpretation 的视觉分隔。
4. 每个展示的 `MustPushItem` 都带 `outcomeCheckpoint`，把推进项绑定到 24h / 72h / next-workday 等 review-safe 结果回收口。
5. `MobileCommandReadModel.outcomeLedger` 把展示项的 outcome checkpoint 汇总成只读结果回收台账，显示下一条待回收 / 待复核结果信号，并派生 review-only `Outcome Review Cue`。
6. 只暴露安全内部导航动作：进入复核、查看证据、标为证据不足、进入结果回收、打开桌面端处理、返回首页、返回工作区首页。
7. Ask Helm 保留为补充询问入口，不再作为移动端第一视觉中心。
8. 原 Must Push 列表保留在 Hero 下方，并跳过已进入 Hero 的首项，避免重复。

## 2. 已实现文件

- `features/mobile/types.ts`
  - 新增 `MobileHeroState`、`MobileHeroEvidenceRef`、`MobileHeroAction`、`MobileJudgementLoopModel`。
  - 新增 `MustPushOutcomeCheckpoint` 与 `MustPushOutcomeCheckpointStatus`。
  - 新增 `MustPushOutcomeLedgerItem`、`MustPushOutcomeLedgerSummary` 与 `MustPushOutcomeReviewCue`，表达只读结果回收台账和人工复核提示。
- `features/mobile/lib/mobile-command-read-model.ts`
  - 对 read-model 输出的展示项补齐默认 `outcomeCheckpoint`。
  - 新增 `outcomeCheckpointCount`，用于验证第一屏展示项是否都具备结果回收口。
  - 新增 `outcomeLedger`，从展示项确定性派生 `dueCount`、`reviewPendingCount`、`blockedCount`、`nextReviewHref`、`reviewCue` 与边界说明。
- `features/mobile/lib/mobile-judgement-loop.ts`
  - 新增 `buildMobileJudgementLoop` pure mapper。
  - 新增 `containsUnsafeMobileCopy` 与 `MOBILE_BANNED_ACTION_WORDS`。
  - `outcomeCheckpoint.reviewHref` 只在安全内部路径下暴露为 `进入结果回收` / `Track outcome` 动作。
- `features/mobile/components/mobile-hero-card.tsx`
  - 新增 Hero / evidence / boundary / outcome checkpoint / safe actions 渲染组件。
- `features/mobile/components/must-push-card.tsx`
  - 在 supporting list 中展示 outcome checkpoint，避免 Hero 之外的 Must Push 回落成纯打开对象卡片。
- `features/mobile/components/outcome-ledger-panel.tsx`
  - 在 Hero 下展示只读结果回收台账、下一条 outcome review 内部链接、Outcome Review Cue 与 no-write 边界。
- `features/mobile/components/workspace-status.tsx`
  - 顶部状态条展示 outcome checkpoint 数，提示当前第一屏结果回收覆盖。
- `app/(workspace)/mobile/page.tsx`
  - 接入 Hero。
  - 接入 `OutcomeLedgerPanel`。
  - Ask Helm 降权为补充询问。
  - Must Push supporting list 跳过 Hero 首项。

## 3. 行为边界

本切片不新增：

- DB migration
- API route
- POST / PATCH / DELETE 写路径
- `/api/*` 直接动作链接
- mobile capture
- share-in
- push notification
- native app
- WeChat mini program
- enterprise messenger bot
- automatic send
- automatic approve
- automatic writeback
- automatic outcome writeback
- LLM final ranking

`buildMobileJudgementLoop` 必须保持 pure / deterministic：

- 不读 DB。
- 不读环境变量。
- 不调用 LLM。
- 不做网络请求。
- 只依赖调用方传入的 `MustPushItem[]`。

## 4. Evidence Contract

当前 `MustPushItem` 尚未携带真实 evidence refs。

因此 P0 Hero 只能展示：

- `sourceHint`
- `helmInterpretation`

不能展示：

- 伪造的 `originalQuote`
- 未证实的原文摘录
- 外部客户承诺
- 跨租户对象存在性

`cross_tenant_denied` 必须返回：

- `item: null`
- `evidence: null`
- 只允许返回首页 / 工作区首页类安全动作

## 5. Outcome Checkpoint Contract

`outcomeCheckpoint` 只表达下一次结果回收的 review-safe 入口，不代表 Helm 已经执行、发送、审批、写回或验证了外部结果。

必须包含：

- `label`
- `dueHint`
- `expectedSignal`
- `reviewHref`
- `status`

约束：

1. `reviewHref` 只能是安全内部路径，不允许外部 URL、协议 URL、`//` URL 或 `/api/*`。
2. `status` 只能表达回收姿态，不得表达外部事实已经成立。
3. 默认生成的 outcome checkpoint 必须覆盖所有展示在 `/mobile` 第一屏的 Must Push。
4. 进入结果回收仍是 GET / internal navigation，不新增 POST / PATCH / DELETE，不写 CRM，不生成 public claim。

## 6. Outcome Ledger Contract

`outcomeLedger` 是 `/mobile` 第一屏的只读结果回收台账。它只从当前展示的 `MustPushItem.outcomeCheckpoint` 派生，不读取 DB、不调用 API、不写任何状态。

必须包含：

- `items`
- `dueCount`
- `reviewPendingCount`
- `blockedCount`
- `nextReviewHref`
- `reviewCue`
- `summary`
- `boundaryNote`

约束：

1. `items[].reviewHref` 必须经过安全内部路径过滤；外部 URL、协议 URL、`//` URL、`/api/*` 与控制字符路径必须被置为 `null`。
2. `nextReviewHref` 只能取第一条待回收 / 待复核且路径安全的 item。
3. `summary` 只能表达回收 / 复核姿态，不得表达结果已经成立或 Helm 已经完成外部动作。
4. `reviewCue` 只能派生“复核前该看什么、允许怎样判断”的提示，不得关闭事项、确认外部成功、生成承诺或触发写回。
5. `boundaryNote` 必须保留 no auto-confirm / no external write / no customer-result commitment 边界。
6. 持久化 outcome ledger 属于下一层，必须另走 review-first / no external write guard。

## 7. Copy Contract

Hero 的状态文案与安全动作不得包含以下危险词：

- 确认
- 同意
- 完成
- 已发送
- 已答复
- 批准
- 承诺
- 自动发送
- 自动审批
- 自动写回
- 通知客户
- 发送邮件
- 搞定

安全动作必须保持内部复核或安全导航语义，不得暗示外部发送、外部承诺、审批完成或 CRM 写回。`打开桌面端处理` 只允许页面级内部路径，显式拒绝外部 URL、协议 URL、`//` URL 与 `/api/*` 路径。

## 8. 验证入口

当前切片最小验证命令：

```bash
npx vitest run features/mobile/lib/mobile-command-read-model.test.ts features/mobile/lib/mobile-judgement-loop.test.ts features/mobile/components/mobile-hero-card.test.tsx features/mobile/components/must-push-card.test.tsx features/mobile/components/must-push-list.test.tsx features/mobile/components/outcome-ledger-panel.test.tsx features/mobile/components/workspace-status.test.tsx features/mobile/mobile-command-page-contract.test.ts
npx eslint 'app/(workspace)/mobile/page.tsx' features/mobile/components/mobile-hero-card.tsx features/mobile/components/mobile-hero-card.test.tsx features/mobile/components/must-push-card.tsx features/mobile/components/must-push-card.test.tsx features/mobile/components/outcome-ledger-panel.tsx features/mobile/components/outcome-ledger-panel.test.tsx features/mobile/components/workspace-status.tsx features/mobile/components/workspace-status.test.tsx features/mobile/lib/mobile-command-read-model.ts features/mobile/lib/mobile-command-read-model.test.ts features/mobile/lib/mobile-judgement-loop.ts features/mobile/lib/mobile-judgement-loop.test.ts features/mobile/types.ts
npm run typecheck
npx playwright test tests/e2e/mobile-command-surface.spec.ts
```

## 9. 下一层

下一层允许评估但不得默认实施：

1. China mobile H5/PWA field-test matrix。
2. Email / deep-link return path。
3. More explicit evidence refs on `MustPushItem`。
4. Review candidate persistence for `标为证据不足`。
5. Outcome ledger persistence（必须先过 review-first / no external write guard）。
6. Field-tested enterprise messenger relay。

这些下一层仍不得绕过 review-first、recommendation != commitment、no auto-send、no auto-writeback 边界。

## 变更记录

| 日期 | 变化 |
| --- | --- |
| 2026-05-03 | 新增 Mobile Judgement Loop P0 implementation contract：Hero / evidence / safe feedback / Ask Helm 降权 / no-write 边界。 |
| 2026-05-18 | 增强 Must Push outcome checkpoint：第一屏展示项默认带结果回收口，Hero 与 supporting card 展示 dueHint / expectedSignal，并且 outcome review 只允许安全内部导航，不新增写路径。 |
| 2026-05-18 | 新增 `/mobile` Outcome Ledger read model 与 `OutcomeLedgerPanel`：把展示项 outcome checkpoint 汇总成只读结果回收台账，显示下一条待回收 / 待复核信号；继续不新增 DB / API / 外部写回 / 自动结果确认。 |

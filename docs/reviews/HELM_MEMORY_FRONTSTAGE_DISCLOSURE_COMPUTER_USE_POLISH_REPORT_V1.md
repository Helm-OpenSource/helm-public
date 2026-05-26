---
status: archived
owner: helm-core
created: 2026-04-22
review_after: 2026-10-19
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Memory Frontstage Disclosure Computer Use Polish v1

更新时间：2026-04-21
状态：Validation Passed; continuation scan clean except brand/proper nouns
当前切片：`Computer Use attempted; Playwright review confirmed /memory now keeps durable memory, timeline, reflection, audit replay and meeting-memory governance in Chinese judgement-first language with mobile-safe layout`

## 1. 目标

这次继续处理 `/memory` 默认前台的系统语、时间线移动端撑宽和审计回放可读性：

1. 继续尝试 Computer Use 读取浏览器窗口；Safari 不可用时，用 Playwright 操作真实本地页面复评
2. 把 `recommendation / blocker / commitment / runtime / follow-through / reflection carry-forward / review-safe / customer-visible` 等中文模式默认层系统词收成经营判断语言
3. 保留记忆事实、承诺、阻碍、修正、复盘候选、审计回放和导出边界，但默认可见文案先服务“能不能信、要不要修、下一步带去哪”
4. 把时间线与审计回放容器改成 `minmax(0,1fr)` / `min-w-0` / `break-words`，避免手机端卡片按内容撑出视口
5. 让审计回放里的认证会话摘要和 JSON 对比块更适合移动端阅读

补充复评继续检查 `/memory` 默认可见层，发现会议记忆治理 helper 和页面 briefing 仍会露出 `review / review posture / review-only / operating context / AI 经营记忆汇报 / 系统持续汇报` 等表达。本次续跑已把这些来源继续收成中文经营记忆语言；Playwright 登录 demo 后复扫桌面和移动端，除品牌语与种子对象名 `Atlas AI` 外，目标系统词命中为 0，页面级横向溢出为 0。

2026-04-22 继续用 Computer Use 从 `/approvals -> /memory?objectType=...#memory-work-timeline` 复跑，确认对象级 URL 已经正确，但 hash 会直接把用户落在时间线中段，当前视口没有清楚说明“这是从复核证据进入的哪个对象”，也没有明显返回复核入口。本次续跑新增 `from=approvals` 入口上下文，并在时间线锚点内部补上对象级证据承接卡，让 `#memory-work-timeline` 落点第一屏就能看到当前对象、复核证据说明、返回复核边界、打开关联对象和审计回放。继续用 Computer Use 从复核页点击 `打开证据` 后，又发现地址栏会出现 `#memory-work-timeline#memory-work-timeline` 双 hash；本轮已把共享 `buildSectionHref` 改成幂等构造，路径已经带 hash 时先剥掉旧 hash，再拼目标锚点。

2026-04-22 继续沿这条链路复跑，发现返回动作仍停在 `/approvals#approval-queue`，用户看完证据后还要重新找到刚才那条复核。新的切片让 `打开证据` 带上 `approvalId`，memory loader 将它保存为 `returnToApprovalId`，筛选时保留该参数，证据承接卡优先显示 `回到这条复核` 并返回 `/approvals?approvalId=...#approval-preview`。这个改动只改善回访定位，不改变审批状态、批准/拒绝/改写动作、发送权限或承诺边界。

2026-04-22 再次用 Computer Use 从 memory 证据页点击 `回到这条复核`，确认原复核抽屉能恢复，但用户仍要手动展开 `辅助判断材料` 才能接着看同类动作和证据覆盖。本轮把 memory 返回 URL 扩展为 `/approvals?approvalId=...&evidenceOpen=1#approval-preview`，并将返回按钮改成 Next `Link`。`evidenceOpen=1` 只控制 approvals 的 disclosure 初始展开，不改变任何审批 action、记忆写入或权限。

同日继续从 approvals 抽屉展开 `辅助判断材料`，发现抽屉内已经显示证据数量，但用户不能直接从这里进入对象级记忆时间线。本轮在 approvals 抽屉内补 `证据时间线 / 打开证据`，让用户能从辅助材料直接下钻到当前对象 memory evidence，再通过 memory 的 `回到这条复核` 返回原抽屉与展开状态。

继续用 Computer Use 停在当前对象级 memory 证据页观察，右侧 `最近审计回放` 仍直接露出 `RECOMMENDATION_GENERATED`、`payload`、`source page`、`summary`。这些是审计数据的底层字段，不应该成为中文默认层的第一眼信息。本轮新增 memory 显示层的 audit action / object type 映射，并把 audit reason chain 的中文兜底语改成用户能读懂的“来源页面暂未标出 / 结果在上方说明 / 执行者说明待补”。底层 actionType、payload 和审计写入不变。

同一次 Computer Use 刷新还再次暴露 Safari 硬刷新 memory URL 后会进入全局 loading recovery，且 fallback 的 `进入销售团队演示` 会把当前 hash 带到 `/dashboard#memory-work-timeline`。这说明 loading recovery 已有可见兜底，但 hash 继承仍是下一轮 routing/fallback 小摩擦；本轮只记录，不扩大成路由修复。

## 2. 本轮不做

- 不改 memory schema、query contract、Prisma 查询、写入动作或权限判断
- 不删除复盘候选、审计回放、导出、修正、删除、承诺状态或阻碍状态动作
- 不扩大自动写入、自动承诺、自动发送或自动执行权限
- 不把 `/memory` 改成完整数据治理平台、BI、workflow engine 或 auto-execution plane
- 不复用 `source` 来源筛选参数表示页面来源；审批来源只走 `from=approvals`

## 3. 影响面

- `features/memory/memory-client.tsx`
- `features/memory/page-loader.ts`
- `features/memory/memory-approval-evidence-context.test.ts`
- `app/(workspace)/memory/page.tsx`
- `features/approvals/approvals-client.tsx`
- `features/approvals/approval-memory-context-link.test.ts`
- `app/(workspace)/memory/page.tsx`
- `lib/presentation/page-section-anchors.ts`
- `lib/presentation/page-section-anchors.test.ts`
- `features/memory/display-copy.ts`
- `features/memory/display-copy.test.ts`
- `lib/operating-system/audit-reason-chain.ts`
- `lib/operating-system/audit-reason-chain.test.ts`
- `components/shared/blocker-card.tsx`
- `components/shared/commitment-card.tsx`
- `lib/operating-system/object-state.ts`
- `lib/operating-system/index.test.ts`
- `lib/presentation/workspace-story.ts`
- `docs/README.md`
- `docs/reviews/HELM_MEMORY_FRONTSTAGE_DISCLOSURE_COMPUTER_USE_POLISH_REPORT_V1.md`

## 4. 关键假设

1. `/memory` 的首要任务是帮助用户判断记忆是否可信、是否需要修正、是否应该进入下一步动作，而不是展示内部运行词典
2. 中文模式可以通过显示层映射隐藏系统词；底层 enum、审计载荷、写入状态和查询契约仍保持不变
3. 复盘候选和审计回放仍然需要保留，但应默认以可读经营语言呈现，不把用户拖进 runtime / candidate / canonical truth 语境
4. 时间线在手机端应服从视口宽度；长标题、审计摘要和 JSON 对比应该换行，而不是撑宽页面
5. 从审批进入的对象级记忆页必须在时间线锚点内部承接上下文；否则 hash 滚动会绕过页面顶部说明
6. 跨页锚点构造必须可重复调用；复核页、证据抽屉、摘要卡片都可能复用同一 href，不能因为重复加工让 URL 出现双 hash
7. `approvalId` 只用于返回定位，不代表审批授权；真正的 approve / reject / rewrite / manual 动作仍必须走原有审批 action
8. `evidenceOpen=1` 只用于从证据页返回时恢复阅读上下文；普通复核入口仍应保持辅助材料默认折叠
9. 抽屉内 `打开证据` 只是进入对象级记忆时间线，不改变 memory schema、写入、审计或审批状态
10. 审计回放中文化只作用于默认显示层；底层 `actionType`、payload、targetType 仍保持原始审计真值

## 5. 验证方案

```bash
npm run test -- features/memory/display-copy.test.ts features/memory/queries.test.ts
npm run test -- features/approvals/approval-memory-context-link.test.ts features/memory/memory-approval-evidence-context.test.ts lib/presentation/page-section-anchors.test.ts
npm run typecheck
npm run self-check
npm run check:boundaries
npm run lint
npm run build
npm run quality:regression
git diff --check
```

页面验证：

- 尝试 Computer Use 获取 Safari 窗口状态
- 用 Playwright 登录 demo 并打开 `http://127.0.0.1:3000/memory`
- 检查默认层不再出现 `recommendation / blocker / commitment / runtime / workflow / follow-through / review-before-send / customer-visible / customer-facing / operator / queue / handoff / prompt / telemetry`
- 检查桌面 1440px 与移动 390px 主内容没有页面级横向溢出

当前已执行结果：

- Computer Use：应用列表可读；Safari 激活并打开 `/memory` 后仍返回 `cgWindowNotFound`；Finder 窗口读取被 MCP approval denied
- `npm run test -- features/memory/display-copy.test.ts features/memory/queries.test.ts` passed；2 files / 7 tests passed
- `npm run typecheck` passed
- `npm run self-check` passed；11/11 checks
- `npm run check:boundaries` passed
- `npm run lint` passed with 7 existing warnings
- `npm run build` passed；existing Turbopack NFT warning remains
- `npm run quality:regression` passed；51 files / 181 tests passed
- `git diff --check` passed
- Playwright 桌面复评 passed；目标系统词计数 0
- Playwright 移动复评 passed；目标系统词计数 0，主内容时间线和审计回放不再撑宽；剩余 2 个轻微 `scrollDelta` 来自全局顶栏按钮
- 补充复评 `npm run test -- features/memory/display-copy.test.ts lib/operating-system/index.test.ts` passed；2 files / 16 tests
- 补充复评 `npm run typecheck` passed
- 补充复评 Playwright `/memory` 桌面 1440x1100：除品牌语与种子对象名 `Atlas AI` 外，目标系统词计数 0，`rootDelta = 0`，`mainDelta = 0`，溢出节点 0
- 补充复评 Playwright `/memory` 移动 390x844：除种子对象名 `Atlas AI` 外，目标系统词计数 0，`rootDelta = 0`，`mainDelta = 0`，溢出节点 0
- 2026-04-22 对象级证据承接 targeted suite 已通过：`npm run test -- features/approvals/approval-memory-context-link.test.ts features/memory/memory-approval-evidence-context.test.ts`，2 files / 5 tests
- 2026-04-22 对象级证据承接 `npm run typecheck` passed
- 2026-04-22 Computer Use：对象级记忆落点首屏可见 `复核证据落点`、当前对象说明、`回到复核边界`、`打开关联对象` 和 `查看审计回放`
- 2026-04-22 Computer Use：从复核页点击 `打开证据` 暴露双 hash `#memory-work-timeline#memory-work-timeline`，已补 `buildSectionHref` 幂等测试
- 2026-04-22 双 hash 修复 targeted suite 已通过：`npm run test -- features/approvals/approval-memory-context-link.test.ts features/memory/memory-approval-evidence-context.test.ts lib/presentation/page-section-anchors.test.ts`，3 files / 9 tests
- 2026-04-22 非破坏性验证已通过：`npm run typecheck`、`npm run self-check`、`npm run check:boundaries`、`git diff --check`、`npm run lint`、`npm run build`、`npm run quality:regression`
- 2026-04-22 `npm run lint` passed with 7 existing warnings；`npm run build` passed with existing Turbopack NFT trace warning；`npm run quality:regression` passed，51 files / 181 tests
- 2026-04-22 精确返回切片 Playwright 复测：`打开证据` 已带 `approvalId`，记忆页返回按钮指向 `/approvals?approvalId=...#approval-preview`，返回后存在复核抽屉
- 2026-04-22 精确返回 targeted suite 已通过：`npm run test -- features/approvals/approval-memory-context-link.test.ts features/memory/memory-approval-evidence-context.test.ts lib/presentation/page-section-anchors.test.ts`，3 files / 9 tests
- 2026-04-22 精确返回非破坏性验证已通过：`npm run typecheck`、`npm run self-check`、`npm run check:boundaries`、`git diff --check`、`npm run lint`、`npm run build`、`npm run quality:regression`
- 2026-04-22 证据返回辅助材料切片已通过：`npm run test -- lib/presentation/loading-recovery.test.ts features/memory/memory-approval-evidence-context.test.ts features/approvals/approval-drawer-accessibility.test.ts features/approvals/approval-memory-context-link.test.ts`，4 files / 12 tests
- 2026-04-22 证据返回辅助材料非破坏性验证已通过：`npm run typecheck`、`npm run self-check`、`npm run check:boundaries`、`git diff --check`、`npm run lint`
- 2026-04-22 抽屉内证据下钻切片已通过：`npm run test -- features/approvals/approval-memory-context-link.test.ts features/approvals/approval-drawer-accessibility.test.ts features/memory/memory-approval-evidence-context.test.ts`，3 files / 10 tests
- 2026-04-22 抽屉内证据下钻 `npm run typecheck` passed
- 2026-04-22 抽屉内证据下钻非破坏性验证已通过：`npm run self-check`、`npm run check:boundaries`、`git diff --check`、`npm run lint`；lint 仍为 7 个既有 warning，无 error
- 2026-04-22 抽屉内证据下钻 Playwright 回放 passed：从公开首页进入销售工作台，经 dashboard 复核抽屉进入 memory，再返回 `/approvals?approvalId=...&evidenceOpen=1#approval-preview`，辅助材料保持展开
- 2026-04-22 审计回放显示层切片已通过：`npm run test -- features/memory/display-copy.test.ts lib/operating-system/audit-reason-chain.test.ts features/approvals/approval-memory-context-link.test.ts features/approvals/approval-drawer-accessibility.test.ts features/memory/memory-approval-evidence-context.test.ts`，5 files / 17 tests
- 2026-04-22 审计回放显示层补充 suite 已通过：`npm run test -- features/memory/display-copy.test.ts lib/operating-system/audit-reason-chain.test.ts`，2 files / 8 tests
- 2026-04-22 审计回放显示层 `npm run typecheck` passed
- 2026-04-22 审计回放显示层非破坏性验证已通过：`npm run self-check`、`npm run check:boundaries`、`git diff --check`、`npm run lint`；lint 仍为 7 个既有 warning，无 error
- 2026-04-22 审计回放显示层 Playwright 文本检查 passed：对象级 memory 证据页 `#memory-audit-replay` 中 `RECOMMENDATION_GENERATED / payload / source page / summary` 命中为 false
- `npm run db:reset` 未执行：这是破坏性数据库重置，且前一轮已确认当前本地 MySQL 前提不可用
- `npm run test` full suite 未重跑：前一轮 full suite 阻塞在本地 MySQL `127.0.0.1:3306` 连接前提；本轮未改 DB-backed runtime 路径
- `npm run e2e` 未执行：当前已完成 `/memory` 桌面/移动 Playwright 定向复评，完整 e2e 仍依赖本地 DB 前提恢复

## 6. 主要风险

1. 显示映射只处理中文可见层，不改变底层协议真值；测试、审计载荷和数据库里仍会保留英文 enum / source type，这是刻意保留
2. 审计回放现在更偏可读说明，极长 JSON 仍会换行展示；如果后续要做专业审计 diff，可以再引入专门的折叠 diff 组件
3. 共享承诺 / 阻碍卡片的中文提示也被收敛为“判断建议 / 简报”语言，属于兼容增强，但会影响所有使用这些卡片的中文页面
4. Computer Use 当前仍无法稳定读取 Safari 窗口，后续仍需继续尝试并保留 Playwright 兜底
5. 本次新增的是对象级承接与返回入口，不改变审批项选择逻辑；从具体审批进入时会回到原复核抽屉并打开辅助判断材料，但不会自动批准、拒绝、发送或形成承诺
6. 抽屉内证据下钻补的是可达性，不保证所有 evidence payload 都有同等完整的对象级 memory 内容；没有对象上下文时仍只能回到普通记忆时间线兜底
7. Safari 硬刷新对象级 memory 后仍可能进入 loading recovery；当前 fallback 可操作，但 `进入销售团队演示` 会继承旧 hash 到 `/dashboard#memory-work-timeline`，下一轮应单独收敛

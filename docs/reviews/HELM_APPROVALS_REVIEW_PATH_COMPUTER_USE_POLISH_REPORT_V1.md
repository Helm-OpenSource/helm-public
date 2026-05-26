---
status: archived
owner: helm-core
created: 2026-04-22
review_after: 2026-10-19
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Approvals Review Path Computer Use Polish Report V1

日期：2026-04-21
状态：Targeted validation passed; Computer Use and Playwright approval path passed

## 1. 结论

本轮用 Computer Use 真实进入 `/dashboard -> /approvals -> 复核抽屉` 后，确认 `/approvals` 的主要摩擦不在审批功能，而在用户第一眼看到的是 `Approval -> first loop`、`review gate`、`first-loop checkpoint` 以及抽屉里的 `Skill / facts / blockers / commitments / operating action` 等内部表达。

本轮已把这条路径收成更直接的复核操作：

- 首屏顶部变成 `复核路径 / 先做复核 / 进入复核面板`
- 首屏 first-loop 完整大卡改成 compact review path summary
- 点击主 CTA 后仍能打开具体 `发送 Atlas 合作 brief` 抽屉
- 抽屉理由链改为 `动作来源 / 证据覆盖 / 边界 / 决策请求`
- 抽屉内“最近同类动作结果 / 同类动作参考”默认折叠为“辅助判断材料”，编辑区和一次性复核按钮提前可达
- “后续自动处理规则”与批准、编辑后批准、拒绝、转人工分离，并默认折叠
- 展开辅助材料后，`contact_followup`、`within_48h_preferred`、`阈值内自动执行` 等内部字段已转成经营复核语言
- 草稿编辑区从“编辑后批准”动作语义中拆出，默认显示 `复核草稿 / 原稿未修改`
- 未修改时 `编辑后批准` 不再可误触；修改后才进入 `已修改，待复核 / 按修改稿批准 / 恢复原稿` 状态

补充复评继续检查 `/approvals` 默认可见层，发现协作者支撑摘要、会议记忆治理摘要和页面 story 仍有 `skill / proposal / review-first / review-only / Customer-visible` 等内部词会在中文页面露出。本次续跑已把这些来源继续收成中文复核语言；Playwright 登录 demo 后复扫桌面和移动端，默认页目标系统词命中为 0，横向溢出为 0。剩余 `AI` 只来自产品品牌语和种子对象名 `Atlas AI`，不属于系统自述。

2026-04-22 继续用 Computer Use 复跑 `/dashboard -> /approvals -> 复核抽屉`，发现新的交互断点：首屏 `进入复核面板` 会先等待 first-loop adoption trace 写入，真实浏览器里可能进入 pending / disabled，导致用户无法马上进入复核抽屉。本轮已把这个 CTA 改成导航优先的 Link，trace 记录改为后台补记；同时把抽屉关闭按钮从无名图标补成 `关闭复核抽屉`，关闭后清理 `approvalId` 深链接，避免用户关掉抽屉后刷新又重新打开同一复核项。

同日继续从 `/approvals -> /memory` 复跑，发现 `打开记忆依据 / 打开证据 / 证据焦点` 原本仍可能掉到泛用经营记忆页，用户需要自己重新判断哪条记忆和当前复核草稿有关。本轮已让这些证据入口复用现有 `buildApprovalMemoryHref`，在有审批对象上下文时进入 `/memory?objectType=...&objectId=...#memory-work-timeline`，没有焦点时才回到普通记忆时间线。

2026-04-22 继续在 `/approvals#approval-queue` 用 Computer Use 操作真实队列，发现队列卡的实际行为和右侧预览文案不一致：页面说明“左侧选中动作后，先给高层预览，再决定要不要展开抽屉”，但点击卡片会直接打开复核抽屉。本轮已把队列卡改成只更新右侧预览，并给卡片补短标签 `预览复核项：...`；正式进入抽屉改由右侧 `打开审批抽屉` 承担，`approvalId` 深链仍保留直接开抽屉能力。

同日继续从右侧预览操作 `打开审批抽屉`，Computer Use 又暴露出一个更细的断点：抽屉虽然会打开，但地址栏仍停在 `/approvals`，刷新或分享后无法恢复当前复核项。进一步对照 Next 请求日志，确认程序化打开时先写入了 `/approvals?approvalId=...`，随后又被抽屉关闭逻辑清回 `/approvals`。本轮已把正式打开动作收口到统一 `openApprovalDrawer` 状态流，直接用浏览器 history 在当前页写入 `approvalId` 深链，避开打开瞬间的 route 级开关竞争；现在打开抽屉会稳定写入深链，关闭后再回到无查询态。

2026-04-22 继续沿 `/approvals -> /memory -> 回到这条复核` 真实链路复跑，发现用户看完证据返回后虽然能回到原复核抽屉，但 `辅助判断材料` 又恢复折叠，用户要重复展开才能接着判断。本轮新增 `evidenceOpen=1` 显示层参数，只在 memory 证据返回时自动打开辅助判断材料；普通队列打开仍默认折叠。记忆页返回按钮同步改用 Next `Link`，减少 protected route 硬跳转进入全局 loading recovery 的概率。关闭抽屉时会同时清理 `approvalId` 和 `evidenceOpen`，不把证据态留在 URL 里。

同日继续用 Computer Use 从公开首页进入销售工作台，再从 dashboard 复核项打开抽屉并展开 `辅助判断材料`，发现抽屉里能看到 `置信度 74 · 证据 2 条`，但这个计数本身不可点击，用户还要退出抽屉或另找入口才能查看证据。本轮在辅助材料顶部补 `证据时间线 / 打开证据`，直接进入当前复核对象的 `/memory?objectType=...&objectId=...&from=approvals&approvalId=...#memory-work-timeline`；这个入口只做证据下钻，不改变批准、拒绝、改写、转人工、发送或自动处理权限。

同日继续用 Computer Use 从恢复后的 dashboard 点击 `查看队列` 进入 `/approvals#approval-queue`，又发现首屏 `阻塞 / 待决策 / 下一步动作` 里仍露出 `KPI link pending`、`Current operating loop still has no coordination metrics snapshot...` 这类底层缺口字段。本轮只在共享 `buildBusinessLoopGapReadout` 展示层补中文前台映射，把它收成 `KPI 关联待补`、中文缺口说明和中文下一步动作；不改 business-loop gap contract、KPI schema 或 canonical KPI object 边界。

## 2. 方案

新增一个 approvals 专用展示适配器：

- `buildApprovalFirstLoopDisplayModel`
- 只改 `WorkspaceFirstLoopModel` 在 approvals 首屏的展示文本
- 不改底层 first-loop model、查询、审批状态机、权限或审计

新增一个 approvals learning 展示适配器：

- `formatApprovalLearningDisplayText`
- `formatApprovalPolicyModeForReview`
- 只在复核页面展示层转换内部 signal key / policy mode，不改策略枚举和执行边界

新增一个 approvals draft 展示适配器：

- `getApprovalDraftEditCopy`
- 只负责草稿编辑区的状态文案，不改变 approve / reject / manual / auto-policy action

同步调整：

- `/approvals` 默认首屏使用 compact `FirstLoopSurfaceSummary`
- approvals arrival banner 的中文文案从 `Home / approvals / 显式 review` 收成 `目标推进台 -> 复核`
- `buildApprovalTaskReasonChain` 的中文输出改成面向用户判断的复核字段
- 复核抽屉的辅助判断材料默认折叠，降低首屏解释噪声
- 后续自动处理规则从一次性处理按钮组中移出，避免误解为本次放行按钮
- 草稿区标题改为 `复核草稿`，并在修改前后切换状态 chip 和按钮标签
- first-loop 主 CTA 使用 Link 直接导航，审计 trace 后台补记，不再用 pending 状态阻塞主路径
- 共享 `SheetContent` 关闭按钮提供 `closeLabel`，approvals 抽屉传入 `关闭复核抽屉`
- approvals 抽屉关闭时删除 `approvalId` 并清理 hash，保留其它 query 参数，避免关闭后刷新重新开抽屉
- approvals 顶部协议、主动审批协作、证据建议和 `证据焦点` 链接都改用当前审批对象的 memory href；兜底仍回到 `/memory#memory-work-timeline`
- approvals 队列卡新增独立 preview selection 状态，普通队列点击只切换右侧预览；`打开审批抽屉` 才写入正式 selected approval 状态并打开 Sheet
- approvals 正式打开抽屉动作统一走 `openApprovalDrawer`，直接用浏览器 history 在当前页写入 `approvalId` 深链，避免 route 切换把刚写入的深链又清掉
- memory 证据返回新增 `evidenceOpen=1`，返回原复核抽屉时自动展开 `辅助判断材料`
- 关闭复核抽屉时同步删除 `approvalId` 与 `evidenceOpen`
- 复核抽屉的 `辅助判断材料` 顶部新增 `证据时间线 / 打开证据`，让已显示的证据数量可直接下钻到当前对象记忆时间线
- 共享 `business-loop-gap-readout` 补齐 `KPI link pending` 的中文展示映射，防止 approvals 首屏把底层 gap contract 原样暴露给中文用户

## 3. 受影响组件

- `features/approvals/approval-first-loop-display.ts`
- `features/approvals/approval-draft-display.ts`
- `features/approvals/approval-learning-display.ts`
- `features/approvals/approvals-client.tsx`
- `features/approvals/approval-entry-flow-source.test.ts`
- `features/approvals/approval-drawer-accessibility.test.ts`
- `features/approvals/approval-memory-context-link.test.ts`
- `features/memory/memory-client.tsx`
- `features/memory/memory-approval-evidence-context.test.ts`
- `lib/presentation/business-loop-gap-readout.ts`
- `lib/presentation/business-loop-gap-readout.test.ts`
- `components/shared/first-loop-tracked-action-button.tsx`
- `components/ui/sheet.tsx`
- `components/shared/home-surface-arrival-banner.tsx`
- `lib/operating-system/approval-boundary.ts`
- `lib/operating-system/object-state.ts`
- `lib/presentation/workspace-story.ts`
- `lib/worker-skill-resource/presentation.ts`
- `features/approvals/approval-first-loop-display.test.ts`
- `features/approvals/approval-draft-display.test.ts`
- `features/approvals/approval-learning-display.test.ts`
- `lib/operating-system/index.test.ts`
- `lib/worker-skill-resource/presentation.test.ts`
- `PLANS.md`
- `docs/README.md`

## 4. 权衡

- 好处：用户从 dashboard 或 sidebar 进入 approvals 后，第一步更像“做一次复核判断”，不再像读系统结构说明。
- 好处：抽屉首段理由链更贴近通过、改写、拒绝、转人工的真实决策。
- 好处：辅助材料展开后仍保留判断依据，但不再把内部信号字段直接交给用户解码。
- 好处：草稿未修改时不会把“编辑后批准”伪装成第二个批准入口；草稿修改后有明确状态和恢复路径。
- 代价：compact summary 会少展示部分完整 first-loop 解释。
- 代价：本轮只清理 approvals 复核路径，未做全站术语清理。

## 5. Computer Use 复评结果

已完成：

1. Safari 打开 `localhost:3000/dashboard`
2. 用 Computer Use 进入 `复核与边界`
3. 首屏复评确认可见 `复核路径 / 先做复核 / 进入复核面板`
4. 点击 `进入复核面板`
5. URL 更新为 `/approvals?approvalId=...#approval-preview`
6. 具体抽屉打开到 `发送 Atlas 合作 brief`
7. 抽屉理由链显示 `动作来源 / 证据覆盖 / 边界 / 决策请求`
8. 默认抽屉中，`辅助判断材料` 和 `后续自动处理规则` 都处于折叠状态
9. 编辑草稿区和 `批准 / 编辑后批准 / 拒绝 / 改成人工处理` 按钮在默认路径直接可达
10. 展开 `辅助判断材料` 后，深层文本显示 `同类动作参考 / 条件内自动处理 / 关系跟进 / 48 小时内优先跟进`，不再暴露 `contact_followup` 和 `within_48h_preferred`
11. 默认草稿区显示 `复核草稿 / 原稿未修改`，且 `编辑后批准` 按钮禁用，避免未修改草稿误走改写路径

备注：Computer Use 的 `set_value` / 元素点击没有稳定触发该 textarea 的 React 输入事件，曾误展开上方 `辅助判断材料`。本轮未用它提交任何动作；编辑态切换由展示 helper 测试和组件状态逻辑覆盖，后续 e2e 应在登录态可控时补一次真实 fill。

补充复评：

1. Computer Use 应用清单可读，确认 Safari、Atlas、Preview、Finder 等应用状态存在。
2. `get_app_state` 读取 Safari 和 Atlas 均返回 `Apple event error -10005: cgWindowNotFound`。
3. Codex App 按安全策略禁止 Computer Use 控制。
4. 本轮未通过 Computer Use 操作浏览器窗口；改用 Playwright 登录 `/demo` 后进入 `/approvals` 做等价页面复扫。
5. Playwright `/approvals` 默认页桌面 1440x1100：目标系统词命中 0，`rootDelta = 0`，`mainDelta = 0`，溢出节点 0。
6. Playwright `/approvals` 默认页移动 390x844：目标系统词命中 0，`rootDelta = 0`，`mainDelta = 0`，溢出节点 0。
7. 扩展扫描包含品牌词 `AI` 时，剩余命中只来自产品品牌语和种子对象名 `Atlas AI`，不作为系统自述残留处理。

2026-04-22 续跑结果：

1. Computer Use 读取 Safari `localhost:3000/dashboard`，进入 `/approvals`。
2. 首次点击首屏 `进入复核面板` 时发现按钮会进入 disabled/pending，抽屉没有稳定打开。
3. 修正后 Computer Use 从 `/approvals` 基础页再次点击首屏 CTA，URL 进入 `/approvals?approvalId=...#approval-preview`，复核抽屉打开到 `发送 Atlas 合作 brief`。
4. Computer Use 确认抽屉关闭按钮从无名 `按钮` 变为 `关闭复核抽屉`。
5. Computer Use 点击 `关闭复核抽屉` 后，抽屉关闭，地址栏回到 `localhost:3000/approvals`，刷新不会重新打开同一抽屉。
6. Playwright 从 `/demo` 进入工作台，再打开 `/approvals`，点击 `进入复核面板`、关闭抽屉并验证 URL 清理；`rootDelta = 0`、`bodyDelta = 0`、`h1 = 复核与边界`。

2026-04-22 记忆证据续跑结果：

1. Computer Use 从 Safari 当前 `/memory` 点击侧边栏 `复核与边界`，进入 `localhost:3000/approvals`。
2. `/approvals` 页面可见的 `证据焦点`、`打开记忆依据` 和主动审批协作里的 `打开证据` 都已暴露对象级 memory href。
3. Computer Use 点击主动审批协作里的 `打开证据`。
4. Safari 地址进入 `localhost:3000/memory?objectType=OPPORTUNITY&objectId=cmnzwr56h001g7ntg8qwm004u#memory-work-timeline`。
5. 经营记忆页滚到对象工作时间线，继续可见当前对象相关的记忆条目和右侧审计回放，不再需要用户从泛用记忆首页重新定位证据。

2026-04-22 队列预览续跑结果：

1. Computer Use 在 `/approvals#approval-queue` 发现旧队列卡会直接打开抽屉，而右侧文案承诺先给高层预览。
2. 修复后队列卡暴露为短按钮：`预览复核项：发送 NorthBridge 会后 ROI 邮件`、`预览复核项：起草 Cedar 恢复邮件`。
3. 关闭抽屉后回到队列，右侧预览保留当前复核项，页面没有自动打开抽屉。
4. 点击第二条队列卡后，右侧预览切换到 `起草 Cedar 恢复邮件`，没有弹出抽屉。
5. 点击右侧 `打开审批抽屉` 后，正式打开 Cedar 对应复核抽屉。

2026-04-22 抽屉深链续跑结果：

1. Computer Use 从 `/approvals` 队列预览右侧点击 `打开审批抽屉`，先暴露出真实断点：抽屉打开了，但地址栏仍停在 `localhost:3000/approvals`。
2. 对照本地 Next log，可见同一次操作先出现 `GET /approvals?approvalId=cmnzwu5zf030g7ntgpknt274e`，随后立刻出现 `GET /approvals`，说明打开抽屉时又触发了一次错误的关闭清理。
3. 修复后再次点击右侧 `打开审批抽屉`，Safari 地址栏稳定进入 `localhost:3000/approvals?approvalId=cmnzwu5zf030g7ntgpknt274e#approval-preview`，抽屉打开到 `起草 Cedar 恢复邮件`。
4. 点击 `关闭复核抽屉` 后，地址栏回到 `localhost:3000/approvals`，右侧预览仍保留当前复核项。
5. 从无查询态再次点击 `打开审批抽屉`，地址栏再次稳定写入同一 `approvalId` 深链。

2026-04-22 证据返回辅助材料续跑结果：

1. Computer Use 从 approvals 点击 `打开证据`，进入对象级 memory 证据页。
2. Computer Use 点击 `查看审计回放`，确认用户可先看审计证据。
3. Computer Use 点击 `回到这条复核` 后回到 `/approvals?approvalId=...#approval-preview`，复核抽屉打开。
4. 复核抽屉返回时最初暴露出 `辅助判断材料` 折叠的断点；本轮改为 memory 返回 URL 带 `evidenceOpen=1`，由 approvals 初始状态直接打开该 disclosure。
5. 本轮未点击批准、拒绝、改写、转人工或任何自动处理策略。

2026-04-22 抽屉内证据下钻续跑结果：

1. Computer Use 从 `/?view=public#entry` 点击 `打开销售工作台`，进入 dashboard。
2. Computer Use 点击 dashboard 复核项 `现在复核: 发送 NorthBridge 会后 ROI 邮件`，进入 `/approvals?approvalId=...#approval-preview` 并打开复核抽屉。
3. Computer Use 展开 `辅助判断材料` 后确认旧状态只有 `置信度 74 · 证据 2 条`，没有直接打开证据的控件。
4. 修复后同一抽屉内出现 `证据时间线 / 打开证据`，链接指向当前复核对象的 memory evidence URL，并保留 `approvalId` 作为返回定位。
5. Playwright 回放完整链路：公开首页进入销售工作台、打开 dashboard 复核项、展开辅助材料、点击抽屉内 `打开证据`、进入 memory、再点 `回到这条复核`；返回 URL 为 `/approvals?approvalId=...&evidenceOpen=1#approval-preview`，`辅助判断材料` 保持展开。
6. 本轮仍未点击批准、拒绝、改写、转人工、后续自动处理规则或任何对外发送动作。

2026-04-22 KPI 缺口文案续跑结果：

1. Computer Use 从恢复后的 dashboard 点击 `查看队列`，进入 `/approvals#approval-queue`，发现中文页面仍显示 `KPI link pending` 和英文缺口说明。
2. 本轮修复后 Playwright 从 `/demo` 进入销售工作台，再打开 `/approvals#approval-queue`，确认首屏改为 `KPI 关联待补`、中文缺口说明和中文下一步动作。
3. 页面级扫描确认 `KPI link pending`、`Current operating loop still has no coordination metrics snapshot...`、`Write one daily coordination metrics snapshot...` 等原英文缺口状态不再出现在复核页正文。

## 6. 验证结果

已通过：

```bash
npm run test -- features/approvals/approval-draft-display.test.ts features/approvals/approval-learning-display.test.ts features/approvals/approval-first-loop-display.test.ts lib/operating-system/index.test.ts
npm run test -- features/approvals/approval-learning-display.test.ts features/approvals/approval-first-loop-display.test.ts features/approvals/approval-draft-display.test.ts lib/worker-skill-resource/presentation.test.ts lib/operating-system/index.test.ts
npm run test -- features/approvals/approval-entry-flow-source.test.ts features/approvals/approval-drawer-accessibility.test.ts features/approvals/approval-first-loop-display.test.ts
npm run test -- features/approvals/approval-memory-context-link.test.ts features/approvals/approval-entry-flow-source.test.ts features/approvals/approval-drawer-accessibility.test.ts features/approvals/approval-first-loop-display.test.ts
npm run typecheck
npm run self-check
npm run check:boundaries
npm run lint
git diff --check
npm run build
npm run quality:regression
```

备注：

- `npm run lint` 通过，保留 7 个既有 warning，无 error。
- `npm run build` 通过，保留既有 Turbopack NFT trace warning。
- `npm run test` 已尝试运行：248 个 test files / 1084 个 tests 通过；6 个数据库 runtime test files / 15 个 tests 因本机 MySQL `127.0.0.1:3306` 不可达失败。
- 补充复评 targeted suite 已通过：5 files / 22 tests。
- 补充复评 `npm run typecheck` 已通过。
- 补充复评 `npm run self-check` 已通过：11/11。
- 补充复评 `npm run check:boundaries` 已通过。
- 补充复评 `npm run lint` 已通过，保留 7 个既有 warning，无 error。
- 补充复评 `git diff --check` 已通过。
- 补充复评 `npm run build` 已通过，保留既有 Turbopack NFT warning。
- 补充复评 `npm run quality:regression` 已通过：51 files / 181 tests。
- 补充复评 Playwright 桌面 / 移动默认页扫描均通过，系统词目标集命中 0，页面级横向溢出 0。
- 2026-04-22 续跑 targeted approval entry flow suite 已通过：3 files / 6 tests。
- 2026-04-22 续跑 `npm run typecheck`、`npm run self-check`、`npm run check:boundaries`、`npm run lint`、`git diff --check`、`npm run build`、`npm run quality:regression` 均通过；lint 仍为 7 个既有 warning，build 仍保留既有 Turbopack NFT trace warning。
- 2026-04-22 续跑 Playwright approval path 通过：`/approvals -> 进入复核面板 -> 关闭复核抽屉 -> /approvals`，页面无横向溢出。
- 2026-04-22 记忆证据续跑 targeted suite 已通过：4 files / 8 tests。
- 2026-04-22 记忆证据续跑 `npm run typecheck`、`npm run self-check`、`npm run check:boundaries`、`git diff --check`、`npm run lint`、`npm run build`、`npm run quality:regression` 均通过；lint 仍为 7 个既有 warning，build 仍保留既有 Turbopack NFT trace warning。
- 2026-04-22 队列预览续跑 `npm run test -- features/approvals/approval-drawer-accessibility.test.ts features/approvals/approval-entry-flow-source.test.ts` 已通过：2 files / 5 tests。
- 2026-04-22 队列预览续跑 `npm run typecheck`、`git diff --check`、`npm run self-check`、`npm run check:boundaries`、`npm run lint` 均通过；lint 仍为 7 个既有 warning，无 error。
- 2026-04-22 队列预览续跑 `nc -z 127.0.0.1 3306` returned `mysql_3306_status=1`；完整 DB-backed `npm run test` / `npm run e2e` 仍需本地 MySQL 恢复后补跑，`npm run db:reset` 仍因 destructive DB reset 和数据库不可达未执行。
- 2026-04-22 抽屉深链续跑 `npm run test -- features/approvals/approval-drawer-accessibility.test.ts features/approvals/approval-entry-flow-source.test.ts` 已通过：2 files / 5 tests。
- 2026-04-22 抽屉深链续跑 `npm run typecheck`、`npm run self-check`、`npm run check:boundaries`、`npm run lint`、`git diff --check` 均通过；lint 仍为 7 个既有 warning，无 error。
- 2026-04-22 证据返回辅助材料 targeted suite 已通过：`npm run test -- lib/presentation/loading-recovery.test.ts features/memory/memory-approval-evidence-context.test.ts features/approvals/approval-drawer-accessibility.test.ts features/approvals/approval-memory-context-link.test.ts`，4 files / 12 tests。
- 2026-04-22 证据返回辅助材料非破坏性验证已通过：`npm run typecheck`、`npm run self-check`、`npm run check:boundaries`、`git diff --check`、`npm run lint`；lint 仍为 7 个既有 warning，无 error。
- 2026-04-22 抽屉内证据下钻 targeted suite 已通过：`npm run test -- features/approvals/approval-memory-context-link.test.ts features/approvals/approval-drawer-accessibility.test.ts features/memory/memory-approval-evidence-context.test.ts`，3 files / 10 tests。
- 2026-04-22 抽屉内证据下钻 `npm run typecheck` 已通过。
- 2026-04-22 抽屉内证据下钻非破坏性验证已通过：`npm run self-check`、`npm run check:boundaries`、`git diff --check`、`npm run lint`；lint 仍为 7 个既有 warning，无 error。
- 2026-04-22 抽屉内证据下钻 Playwright 链路已通过：返回 URL 带 `evidenceOpen=1`，`辅助判断材料` details open 为 true。
- 2026-04-22 KPI 缺口文案 targeted suite 已通过：`npm run test -- lib/presentation/business-loop-gap-readout.test.ts`，1 file / 5 tests。
- 2026-04-22 KPI 缺口文案 Playwright 页面检查已通过：`/demo -> 进入销售团队演示 -> /approvals#approval-queue`，原英文缺口状态命中 0，中文缺口表达命中。

未跑或未完成完整链路：

```bash
npm run db:reset
npm run e2e
```

原因：`npm run db:reset` 会重置本地数据库，未在没有行动前确认的情况下执行；`npm run test` 的数据库段被本机 MySQL 不可达阻塞；`npm run e2e` 留给数据库可用后的完整链路复核。

## 7. 剩余风险

1. 其他页面的 worker 协作、learning panel、policy 说明仍可能有内部术语。
2. 当前只验证了打开、展开、折叠抽屉和默认草稿编辑态，没有执行批准 / 拒绝 / 编辑后批准等会产生真实状态变化的动作。
3. sidebar 进入 `/approvals` 和 dashboard 主 CTA 进入的路径已实操，但 surface routing e2e 仍需在完整 e2e 中复核。
4. textarea 的真实输入态仍需要在登录态可控的 Playwright e2e 中补一次 fill / restore 验证。
5. 当前仍有既有未提交页面改动，最终合并前需要区分本轮文件和既有文件。
6. 本轮没有执行批准、拒绝、改成人工处理或后续自动处理规则等真实状态变更；这些外部/高风险动作仍必须保持人工确认。
7. 记忆页已能收到对象级上下文，但本轮没有继续改记忆页首屏的“从审批证据过来”承接语；这属于下一轮 `/memory` 复评范围。

## 8. 下一步

1. 下一轮继续用 Computer Use 复评 `/memory` 的对象级首屏承接，判断是否需要把“从复核证据进入”的上下文前置。
2. 在 MySQL 可用后补 `npm run db:reset`、`npm run test`、`npm run e2e`。
3. 在 e2e 登录态可控后，补 approvals textarea fill / restore 的自动化验证。

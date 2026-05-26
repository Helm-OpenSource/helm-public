---
status: archived
owner: helm-core
created: 2026-04-22
review_after: 2026-10-19
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Opportunities Board Disclosure Computer Use Polish v1

更新时间：2026-04-21
状态：Targeted Validation Passed; Full DB Tests Blocked
当前切片：`Computer Use attempted; Playwright review confirmed /opportunities now keeps opportunity board, protocol evidence and proactive collaboration copy within Chinese judgement-first language and responsive bounds`

## 1. 目标

这次继续处理 `/opportunities` 默认前台的系统语、看板横向拉宽和证据层移动端溢出：

1. 继续尝试 Computer Use 读取浏览器窗口；Safari 不可用时，用 Playwright 操作真实本地页面复评
2. 把 `pipeline / proposal / package / formal review / review-before-send / blocker / commitment / replay / flow / skill / worker` 等中文模式默认层系统词收成经营判断语言
3. 保留机会排序、拖拽阶段、详情抽屉、主动协作、报告协议和证据下钻，但默认可见文案先服务判断和动作
4. 把机会看板从强制横向 `min-w-max` 改成响应式换行，避免桌面默认层被拉出视口
5. 给共享 `EvidenceDrawer` / `EvidenceTargetCard` 补 `min-w-0 / max-w-full / overflow-hidden / break-words`，避免移动端证据卡溢出

## 2. 本轮不做

- 不改 opportunity schema、stage enum、owner 分配、拖拽写路径或 bulk update 行为
- 不删除报告协议、worker / skill / resource 证据或主动协作机制，只改变中文显示层和响应式容器
- 不扩大对外发送、自动承诺或自动执行权限
- 不把 `/opportunities` 改成完整 CRM、BI 或 workflow 平台

## 3. 影响面

- `features/opportunities/opportunities-client.tsx`
- `features/opportunities/display-copy.ts`
- `features/opportunities/display-copy.test.ts`
- `components/shared/narrative-components.tsx`
- `components/shared/proactive-mechanism-panel.tsx`
- `docs/README.md`
- `docs/reviews/HELM_OPPORTUNITIES_BOARD_DISCLOSURE_COMPUTER_USE_POLISH_REPORT_V1.md`

## 4. 关键假设

1. `/opportunities` 第一屏已经有 business-first 四类摘要，本轮主要修默认层后续区域的系统词和布局摩擦
2. 报告协议、主动协作和证据抽屉仍然需要保留，但中文模式必须以用户能直接判断的经营语言呈现
3. 看板拖拽可以在响应式换行列中继续工作；当前不要求用横向滚动承载全部阶段
4. 共享证据抽屉的移动端约束对其他页面是兼容增强，不改变数据或权限

## 5. 验证方案

```bash
npm run test -- features/opportunities/display-copy.test.ts lib/presentation/shared-surface-hierarchy-guards.test.ts lib/presentation/business-loop-gap-readout-guard.test.ts lib/presentation/decision-first-ia.test.ts
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
- 用 Playwright 登录 demo 并打开 `http://127.0.0.1:3000/opportunities`
- 检查默认层不再出现 `review-before-send / formal review / owner-focused / action workspace / pipeline / proposal / package / blocker / commitment / replay / flow / skill / worker / customer-facing / customer-visible`
- 检查桌面 1440px 与移动 390px 可见元素无横向溢出

当前已执行结果：

- Computer Use：应用列表可读；Safari 仍返回 `cgWindowNotFound`
- `npm run test -- features/opportunities/display-copy.test.ts` passed；1 file / 4 tests passed
- `npm run test -- features/opportunities/display-copy.test.ts lib/presentation/shared-surface-hierarchy-guards.test.ts lib/presentation/business-loop-gap-readout-guard.test.ts lib/presentation/decision-first-ia.test.ts` passed；4 files / 30 tests passed
- `npm run typecheck` passed
- `npm run self-check` passed
- `npm run check:boundaries` passed
- `npm run lint` passed with 7 existing warnings
- `npm run build` passed；existing Turbopack NFT warning remains
- `npm run quality:regression` passed；51 files / 180 tests passed
- `git diff --check` passed
- Playwright 桌面复评 passed；禁词计数全部为 0，可见元素横向溢出数 0
- Playwright 移动复评 passed；禁词计数全部为 0，可见元素横向溢出数 0
- `npm run test` full suite did not complete because local MySQL was unavailable at `127.0.0.1:3306`; Vitest reported 6 DB-backed Helm v2 runtime files failed at Prisma fixture creation, with 256 files / 1103 tests already passing before the DB-dependent failures
- `npm run db:reset` 未执行：这是破坏性数据库重置，且当前 MySQL 前提不可用
- `npm run e2e` 未执行：当前 full test 已暴露本地 MySQL 前提不可用，本轮 Playwright 已完成 `/opportunities` 桌面/移动页面复评

## 6. 主要风险

1. 横向阶段看板改成响应式换行后，阶段总览变得更适合当前屏幕，但一次性横扫所有阶段的感觉会弱一些
2. 显示格式化层只处理中文可见文案，不改变底层协议真值；审计或测试仍可能看到英文 enum / id / href，这是刻意保留
3. Computer Use 当前仍无法稳定读取 Safari 窗口，后续仍需继续尝试并保留 Playwright 兜底
4. 全量 DB-backed runtime 测试需要本地 MySQL 先恢复；本轮未改变这些 runtime 路径，失败点是测试环境连接前提

---
status: archived
owner: helm-core
created: 2026-04-16
review_after: 2026-10-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM Page Presentation Priority Alignment Freeze Report V1

更新时间：2026-04-16
状态：Frozen
结论：`本轮覆盖页面已完整成立；全站页面呈现优先级对齐已成形但仍需下一层`

## 1. 本轮范围

本轮只冻结这条“中文页面呈现优先级与首屏重点对齐”主线，不扩成全站重写：

- 公开入口与正式入口
  - `app/page.tsx`
  - `features/auth/login-panel.tsx`
- 高频对象详情页
  - `features/contacts/contact-detail-client.tsx`
  - `features/companies/company-detail-client.tsx`
  - `features/meetings/meeting-detail-client.tsx`
- 高频经营 / 治理页
  - `features/reports/reports-client.tsx`
  - `features/memory/memory-client.tsx`
  - `features/inbox/inbox-client.tsx`
  - `features/imports/imports-client.tsx`
  - `features/settings/settings-client.tsx`
- 守卫与回归
  - `scripts/decision-first-boundary-check.ts`
  - `tests/e2e/demo-flows.spec.ts`
  - `tests/e2e/detail-hierarchy.spec.ts`

## 2. 当前版本哪些能力已经完整成立

以下能力在本轮覆盖范围内已经同时具备代码、页面、测试和文档：

1. 中文界面优先使用中文表达
   - 中文页首屏已不再把 `review / follow-through / boundary posture / recommendation / blocker / catalog / workflow control` 这类治理词直接夹进中文文案。
   - 英文分支仍保留英文，不做机械翻译。

2. 首屏重点顺序重新收口
   - 公开首页与正式登录入口重新回到“入口是什么、为什么现在进入、下一步怎么开始”的窄入口。
   - `contacts / companies / meetings / reports / memory / inbox / imports / settings` 统一回到“当前判断 / 最重要动作 / 待拍板事项 / 边界说明先于解释层”的顺序。

3. 解释层、证据层、治理说明继续后置
   - detail 页与 operator-heavy 页都继续把长解释、历史、偏好与治理说明下移，不再抢占首屏判断区。

4. 页面契约与守卫同步成立
   - `decision-first boundary check` 的词表断言已对齐当前中文表达。
   - `detail hierarchy` 与 demo flow 断言已对齐新的首屏与词表。

## 3. 哪些能力已成形但仍需下一层

1. 全站页面呈现优先级统一
   - 本轮覆盖了公开入口、正式入口和高频页面。
   - 但这还不是全站所有页面的最终统一，后续仍要继续看剩余例外页和新增页面是否继续遵守同一套排片规则。

2. 中国本地化词表治理
   - 当前高频页面已经显著收敛。
   - 但这还不是一套仓库级“专有名词、品牌名、协议名、外部产品名”的完整语言规范。

3. 页面层级守卫体系
   - 当前已经能拦住一批首屏顺序和旧词表回退。
   - 但还不是完整的页面 contract lint 或自动化 IA 守卫系统。

## 4. 刻意未做

1. 不做全站 IA 重写
2. 不做路由重命名或目录大重构
3. 不改对象模型、权限模型或导入逻辑
4. 不把中文界面对齐扩成自动翻译工程
5. 不把品牌名和格式名强行中文化
   - `CSV / Gmail / HubSpot / Salesforce / Stripe` 等仍按专有名词处理

## 5. 风险项

1. 仍有剩余页面没有纳入这轮冻结，后续新增或修改页面仍可能重新引入中英混用
2. 词表现在主要靠页面实现和边界守卫维持，还没有完整仓库级规范
3. 专有名词保留原文是刻意策略，但如果后续没有补明确规则，仍可能造成不同页面表达不一致

## 6. 相邻脏线与排除项

本轮 freeze 刻意没有把以下内容混进主干：

1. 明显独立的本地噪音
   - `dev *.db`
   - `* 2.*`
   - 其他重复副本与临时文件

2. 与本轮页面对齐无关的独立文档线
   - `docs/requirements/HELM_MIDUN_TENANT_PRD_V1.md`
   - 对应的 `docs/README.md` 独立索引改动

3. 其他独立实现线
   - `first-loop / home` 其余独立分支
   - `import-guard`
   - `eval`

这些内容应继续按独立 PR 或独立冻结线管理，不在这次 merge 里顺手混进来。

## 7. 验证结果

本轮冻结前已通过完整标准验证链：

```bash
npm run db:reset
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```

补充说明：

- `build` 仍会打印 `next.config.ts` 相关的既有 Turbopack/NFT warning，不是本轮引入的新问题。
- `demo-flows` 和 `detail-hierarchy` 已对齐新的中文文案与首屏顺序断言。

## 8. 当前冻结结论

本轮覆盖的页面批次已经达到可交付、可验证、可合主干状态。

但对“全站页面呈现优先级统一”和“中文界面词表治理”这两个更大目标，当前结论仍然必须诚实写成：

- `已成形但仍需下一层`

## 9. 下一步建议

1. 继续把剩余例外页纳入同一套页面排序与词表规则
2. 补一版更明确的仓库级中文 / 英文专有名词策略
3. 把页面 contract 守卫继续收紧，避免后续页面回退到 explanation-first

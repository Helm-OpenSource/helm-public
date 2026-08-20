---
status: archived / executed-with-as-built-record
owner: helm-core
created: 2026-08-20
review_after: 2026-09-20
public_safety: Implementation plan for the member signal candidate review
  UI wiring. No customer data, credential, private endpoint, or
  production-readiness claim.
---

# Member Gateway M2c-b(候选审阅 UI 接线)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development 或 executing-plans。

**Goal:** 把 M2c 的成员信号候选接入 /approvals 审阅面:server actions、审阅面板(taint 一等渲染,spec §5.1 裁定 2)、page-loader/客户端接线、单测。镜像 governed-candidate 既有形状,零新概念。

**Architecture(绑定决定,全部来自 2026-08-20 UI 探查):**

1. **page-loader**:在既有 `canReviewCandidates` 门后追加一个独立 `await resolveOptionalApprovalsReadModel(listMemberWorkSignalCandidateReviews(workspace.id), [])`,返回键 `memberSignalCandidates`;复用 `candidateGovernance` 原样(两个能力与 governed 相同)。**不动** `const tasks = await getApprovalTasksData` 行与 `Promise.all` 块的文本(page-loader-degraded-mode.test.ts 钉了源文本)。
2. **server actions** `features/member-signal-candidates/actions.ts`:结构克隆 governed 版——`"use server"`、zod strict(review: artifactBundleId ≤191、decision、notes ≤2000;promote: **title 1..175、description ≤191**,与 service 的列宽界一致,让错误在表单层而非 service 层)、`getCurrentWorkspaceSession`、能力预检(`canReviewWorkspaceGovernedActions`/`canPromoteWorkspaceGovernedCandidates`)、调 service、**11 键**双语错误映射(`invalid_input`、`candidate_not_found`、`candidate_artifact_corrupt`、`candidate_review_conflict`、`signal_receipt_superseded`、`promotion_title_too_long`、`promotion_description_too_long`、`candidate_promotion_requires_confirmation`、`candidate_promotion_policy_forbidden`、`candidate_promotion_policy_suggest_only`、`candidate_promotion_state_conflict`,total Record 保穷尽)、`MemberSignalCandidateReviewError` → 映射 / `isWorkspaceServiceGovernanceError` → message 透传 / 其余 rethrow、成功后 revalidate `/approvals` 与 `/dashboard`。
3. **面板** `features/member-signal-candidates/member-signal-candidate-review-panel.tsx`:克隆 governed 面板结构(`"use client"`、`useWorkspaceUi` 双语、`useTransition` + sonner + `router.refresh`、`<section className="order-5 border-y ...">` 紧随 governed 面板之后、`data-member-signal-candidate-review-panel="true"`、`id="member-signal-candidate-review"`、per-row `data-member-signal-candidate-id`)。差异点:
   - **taint 一等渲染(spec §5.1 裁定 2 义务)**:行首 `<Badge variant="danger">`(zh"未信任·成员上行"/en "Untrusted · member upstream"),不进 `<details>`、不截断;
   - `projectedSummary` 为行标题(已脱链接;可能含 `[link-evidence:N]` token——**按文本原样渲染,不做 token 匹配或链接化**,as-built 已警告 token 非单射);`memberRef` + `submittedAt` 为 muted meta 行;`kind` 用 `<Badge variant="neutral">`;
   - `corrupt: true` → 无命令的 blocked article 分支(镜像 governed 的 invalid-contract 分支,`data-member-signal-candidate-contract="corrupt"`);
   - **资格派生在面板内**(lister 无 per-item 标志,是最小改动;不动 `check:member-gateway` 冻结集内的 service 文件):review 按钮仅当 `reviewStatus === "PENDING"`;promote 仅当 `bundleStatus === "CONFIRMED"`;`CONSUMED` 显示"已晋升"chip;工作区级 `governance.canReview/canPromote` 控制 disabled + denied message(两级门控同 governed);
   - 空态与降级态镜像 governed。
   - **文案红线**:全部新文案不得命中 systemspeak 正则(禁 `Helm <verb>`、`Helm 已经`、`由 Helm`、`问 Helm`、`What Helm`、`Helm 平台` 等——shared-surface-hierarchy-guards 全文件扫描);触控目标类名等既有约束照 governed 面板抄即安全。
4. **客户端接线** `approvals-client.tsx`:一个类型 import、props 增 `memberSignalCandidates`、解构、在 governed 面板条件块(≈:2234)之后加同形条件块。**不得**改动 `id="approval-queue"`、order-6 及其后编号、`<SheetContent>` 结构。`app/(workspace)/approvals/page.tsx` 解构 + 传 prop。
5. **测试**:`features/member-signal-candidates/member-signal-candidate-review-panel.test.tsx` 镜像 governed 面板测试(renderToStaticMarkup + vi.mock next/navigation、workspace-ui-provider 强制 zh-CN、mock actions;断言:taint badge 文案在场且在 details 之外、corrupt 分支无按钮、PENDING 行有确认/拒绝按钮、无权限时 disabled、CONSUMED 显示已晋升)。**不要**把新测试加进 `test:public:guards`(frozen-duplicates 9 处字节拷贝陷阱)——`npm run test` 的 vitest include 自动收集。`page-loader-degraded-mode.test.ts` 追加一条 `toContain("listMemberWorkSignalCandidateReviews")`(纯增量)。
6. **门禁自查**:`npm run test`(presentation 守卫在此跑,不在 quality:regression)、`npm run check:boundaries`、`npx vitest run lib/presentation/shared-surface-hierarchy-guards.test.ts`(新文案过 systemspeak 扫描)。

**Tasks/commits:**
- T1: actions.ts + 单测?(actions 无既有测试先例——不强制)→ commit `feat(member-gateway): add member signal candidate review server actions`
- T2: 面板组件 + 面板单测 → commit `feat(member-gateway): render member signal candidates in the approvals review surface`
- T3: page-loader + page.tsx + approvals-client 接线 + degraded-mode 追加断言 → commit `feat(member-gateway): wire member signal candidates into the approvals loader and client`
- T4: as-built、最终整体 review、push、PR。

**边界:** 审阅人逐 evidence-ref 按需投影(裁定 5 的运行时义务)仍不在本切片——面板只显示 opaque ref 计数;阶段二事实晋升不可表达;不改 lister 读模型(service 文件在门禁冻结集内,资格派生走面板)。

---

## As-built 记录(2026-08-20 执行完毕)

分支 `feat/member-gateway-m2c-b`,6 个 commit(计划、防火墙重构、actions、
面板+测试、接线、本记录)。

1. **权限防火墙事件与裁决**:server actions 首次把权限面接入
   member-gateway,触发 `check:caio-terminology` 的 authority firewall
   (actions.ts → … → `parseInstant` from lib/caio-governance)。经 owner
   显式授权,`parseInstant` 迁至中立模块 `lib/time/strict-instant.ts`,
   治理契约原样 re-export,零行为变化;`prompt.ts` 对治理契约的桥接
   import(refuse/pause/appeal 真值)保留。子代理两次拒绝仅凭转述授权
   执行治理边界文件修改,由主会话在取得 owner 直接确认后亲自提交——
   该谨慎行为是预期的正确姿态。
2. taint 一等渲染落地为行首 danger Badge,不入折叠区;
   `[link-evidence:N]` token 按纯文本渲染,组件内注释禁止文本匹配链接化。
3. 资格派生在面板内(reviewStatus/bundleStatus),lister 读模型未动
   (service 文件在 member-gateway 门禁冻结集内)。
4. **既有问题记录(非本切片引入)**:
   `lib/presentation/shared-surface-hierarchy-guards.test.ts` 在 main 上
   即有 4 个失败(billing-settlement-batch-panels、dashboard home
   work-entry、public login、integration template doc),本分支复现相同
   4 项;该套件不在 `check:boundaries`/`quality:regression` 链内,故 CI
   绿。owner 待办:修复四处或按预期更新守卫基线。
5. 仍未实现(继承义务):审阅人逐 evidence-ref 按需投影;阶段二事实
   晋升;E2E 截图基线如需覆盖新面板由 owner 决定。
6. 最终 review 补记:corrupt 行有意以 blocked 标记(ShieldAlert + 无命令)
   替代 taint badge——被判定损坏的候选整行不可信,阻断标记是比 taint
   更强的表达;裁定 2 的一等渲染义务适用于可审阅行。测试 fixture 的
   taint 值修正为契约冻结的 "untrusted"。

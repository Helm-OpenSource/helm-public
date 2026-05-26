---
status: active
owner: helm-core
created: 2026-04-27
review_after: 2026-07-26
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Retention Status Card Design V1

更新时间：2026-04-27
状态：Planning（设计 + 组件契约；实现在 Week 3 落地）
适用范围：`/settings/billing` surface 的「数据保留状态」卡片，与 [HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md](../legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md) 同期落地

---

## 一、本文件的定位

Week 3 #23：在 `/settings/billing` 加一张「数据保留状态」卡片，让用户能：

1. 一眼看到当前阶段（active / grace / canceled / read-only）
2. 知道还剩多少天到下一个阶段转换
3. 自助导出全部 workspace 数据
4. 对要主动结束试用的用户，提供「立即进入 grace」的入口
5. 对在 grace 期内的用户，提供「撤回到 active」的入口

设计要求（来自 launch plan §三 Week 3 #23）：

> **不**新增 retention sweep cron / API；阶段转换由 `lib/billing/foundation.ts` 在请求路径派生（保守可发布路径）。

这意味着卡片是**read-first**：它读取已有的 `lib/billing/foundation.ts` 派生结果，不引入新的写路径或 cron。

---

## 二、用户视角：卡片内容与行为

### 2.1 阶段视图（state-driven）

| 阶段 (`AccessState`) | 卡片头 | 主信息 | CTA |
| --- | --- | --- | --- |
| `TRIALING`（active） | 「Active 阶段 · 剩 N 天」 | active 结束日期 + grace 结束日期 + 物理删除日期；说明 N 天后自动进入 grace | (1)「导出全部数据」(2)「立即结束试用」（→ grace） |
| `ACTIVE`（付费用户，理论上不在公开试用） | 「正式版」 | 不在本卡片范围；引导到付费 portal | — |
| `GRACE` | 「Grace 阶段 · 剩 N 天 read-only」 | grace 结束日期 + 物理删除日期；强调 N 天后**物理删除** | (1)「导出全部数据」(2)「撤回到 active」(3)「立即物理删除」 |
| `READ_ONLY`（grace 已结束但物理删除未完成） | 「待物理删除」 | 强调 24 小时内自动物理删除 | (1)「最后导出」(2) — |
| `CANCELED` | 「已结束 · 数据已物理删除」 | 物理删除完成日期 + 删除证明邮件状态 | (1)「重新开始试用」（创建新 workspace） |

### 2.2 视觉层级（按 [DESIGN.md](../../DESIGN.md) 浅色 / 判断优先 / 决策优先 基线）

```
┌─────────────────────────────────────────────────────────┐
│ 数据保留状态                                              │
│ ─────────────────────────────────────────────────────── │
│                                                          │
│ Active 阶段 · 剩 18 天                  [Status badge]   │
│                                                          │
│ Active 结束       2026-05-27（周二）                      │
│ Grace 结束        2026-06-03（周二）                      │
│ 物理删除          2026-06-03 之后                         │
│                                                          │
│ ──────────────────────────────────────────────────────  │
│ Helm 在阶段转换前会通过系统邮箱通知 (workspace owner)。     │
│ ──────────────────────────────────────────────────────  │
│                                                          │
│ [导出全部数据]   [立即结束试用]                            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Status badge 颜色**：

- TRIALING / ACTIVE：`var(--accent)` 中性
- GRACE：黄色调 `bg-amber-50 text-amber-900 border-amber-300`
- READ_ONLY：橙色调 `bg-orange-50 text-orange-900 border-orange-300`
- CANCELED：灰色调

### 2.3 文案约束（决策优先）

每条文案必须给出：

1. **Helm 当前怎么看（判断）**：「你的工作区还在 active 阶段」
2. **为什么这样看（理由）**：「自创建日 2026-04-27 起 30 天为 active」
3. **需要什么行动（决策）**：「N 天后自动进入 grace；如希望保留数据请提前导出」
4. **存在什么边界（治理）**：「Helm 不承诺试用 SLA；删除按数据政策执行」

不接受的文案：

- 营销口径（「升级享受不限时数据保留」）
- 模糊承诺（「我们会尽量帮你保留」）
- 把「建议」写成「承诺」

---

## 三、组件契约

### 3.1 Server-side 数据来源

读取链：

```ts
// features/settings/queries.ts (扩展现有 getSettingsBillingData)
import {
  AccessState,
  resolveAccessStateFromDates,
  TRIAL_DURATION_DAYS,
  GRACE_DURATION_DAYS,
} from "@/lib/billing/foundation";

export async function getRetentionStatusReadout(workspaceId: string) {
  const trialState = await db.trialState.findUnique({ where: { workspaceId } });
  if (!trialState) return null;

  const now = new Date();
  const accessState = resolveAccessStateFromDates({
    now,
    status: trialState.status,
    trialEndsAt: trialState.trialEndsAt,
    graceEndsAt: trialState.graceEndsAt,
  });

  return {
    accessState,                           // TRIALING | GRACE | READ_ONLY | CANCELED
    trialStartedAt: trialState.trialStartedAt,
    trialEndsAt: trialState.trialEndsAt,
    graceEndsAt: trialState.graceEndsAt,
    physicalDeletionEarliestAt: trialState.graceEndsAt, // 同 graceEndsAt，物理删除立即触发
    daysUntilNextTransition: deriveDaysUntil(now, accessState, trialState),
    canExportData: true,                   // 导出始终可用
    canEnterGraceNow: accessState === AccessState.TRIALING,
    canWithdrawFromGrace: accessState === AccessState.GRACE,
    canForceImmediateDeletion: accessState === AccessState.GRACE,
  };
}
```

`deriveDaysUntil` 是纯函数，从现有 trialState 字段派生，不引入新 schema。

### 3.2 Client-side 组件 props

```tsx
// features/settings/components/retention-status-card.tsx
type RetentionStatusCardProps = {
  english: boolean;
  readout: {
    accessState: "TRIALING" | "GRACE" | "READ_ONLY" | "CANCELED";
    trialEndsAt: Date;
    graceEndsAt: Date;
    physicalDeletionEarliestAt: Date;
    daysUntilNextTransition: number;
    canExportData: boolean;
    canEnterGraceNow: boolean;
    canWithdrawFromGrace: boolean;
    canForceImmediateDeletion: boolean;
  };
  onExport: () => Promise<void>;          // 调用 server action
  onEnterGrace: () => Promise<void>;
  onWithdrawFromGrace: () => Promise<void>;
  onForceImmediateDeletion: () => Promise<void>;
};

export function RetentionStatusCard(props: RetentionStatusCardProps): JSX.Element;
```

### 3.3 Server actions（新增）

`features/settings/actions.ts` 扩展：

```ts
"use server";
import { revalidatePath } from "next/cache";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { canManageWorkspaceBilling } from "@/lib/auth/billing-governance";

export async function exportWorkspaceDataAction(): Promise<{
  ok: true; downloadUrl: string;
} | { ok: false; reason: string }> {
  const session = await getCurrentWorkspaceSession();
  if (!canManageWorkspaceBilling(session.membership.role)) {
    return { ok: false, reason: "permission_denied" };
  }
  // 生成一次性下载链接，指向 OSS 临时签名 URL（30 分钟有效）
  // 数据：CSV + JSON，包含 workspace 全部 first-party objects
  // 不包含：sub-processor 的原始数据（DingTalk / HubSpot 等连接器只导 Helm 这边的视图）
  // ...
}

export async function enterGraceNowAction(): Promise<{ ok: true } | { ok: false; reason: string }>;
export async function withdrawFromGraceAction(): Promise<{ ok: true } | { ok: false; reason: string }>;
export async function forceImmediateDeletionAction(input: { confirm: string }): Promise<{ ok: true } | { ok: false; reason: string }>;
```

每条 action：

1. 必须验证 `canManageWorkspaceBilling`
2. 必须写一条 `RetentionLifecycleAction` audit event（已存在或扩展现有 audit type）
3. 不直接执行物理删除；通过更新 `trialState.status` + `trialState.graceEndsAt` 让现有派生逻辑自然生效
4. 返回后调 `revalidatePath('/settings/billing')` 刷新

### 3.4 用户主动结束 / 撤回 / 立即物理删除 的状态机

```
TRIALING
   │
   ├── enterGraceNowAction()
   │       → 立即设 graceEndsAt = now + 7d
   │       → 设 status = GRACE
   │       → 派生为 GRACE 阶段
   │       → audit: RetentionLifecycleAction("user_initiated_grace")
   │
   ↓
GRACE
   │
   ├── withdrawFromGraceAction()
   │       → 重置 trialEndsAt = now + 30d
   │       → 重置 graceEndsAt = now + 30 + 7d
   │       → 设 status = TRIALING
   │       → 派生回 TRIALING
   │       → audit: RetentionLifecycleAction("user_withdraw_from_grace")
   │
   ├── forceImmediateDeletionAction(confirm: "DELETE")
   │       → 设 graceEndsAt = now（立即满足派生为 READ_ONLY）
   │       → 后台异步执行物理删除（见现有 retention sweep 流程，
   │          public-trial 不引入新 cron，由请求路径触发）
   │       → audit: RetentionLifecycleAction("user_force_immediate_deletion")
```

撤回 grace 后**不**累计原 active 剩余天数（防止滥用）；重置为完整 30 天。这一点必须在 UI 二次确认 dialog 中清楚说明。

---

## 四、与 retention sweep 的关系

按 launch plan 决策**不引入** retention sweep cron。物理删除依赖：

1. 请求路径派生：用户访问任何路由时，`getCurrentWorkspaceSession` 链路调用 `resolveAccessStateFromDates`，发现 `now >= graceEndsAt` → 返回 READ_ONLY → middleware 拒绝写入并触发后台清理任务
2. 后台清理任务：单次任务（不是 cron），由 READ_ONLY 状态首次被检测时触发；任务幂等
3. DirectMail 删除证明：清理完成后入队（见 [HELM_RETENTION_REMINDER_EMAIL_TEMPLATES_V1.md](./HELM_RETENTION_REMINDER_EMAIL_TEMPLATES_V1.md)）

如果用户长期不访问，物理删除会延后。这是已知边界；公开试用 SLA 立场下可接受。

---

## 五、可访问性与本地化

- **键盘导航**：导出按钮 / 进入 grace / 撤回 / 立即删除 必须 tab-reachable，回车触发
- **screen reader**：status badge 必须有 `aria-label`（"current retention stage: active, 18 days remaining"）
- **本地化**：
  - 中文：默认；阶段名「Active / Grace / 待物理删除 / 已结束」
  - 英文：「Active / Grace (read-only) / Pending hard deletion / Ended」
  - 日期：`zh-CN` 用 `2026-05-27（周二）`；`en-US` 用 `Tue, May 27, 2026`

---

## 六、不做（本卡片刻意不做）

- 退款 / 计费明细：归属于现有 `BillingOverviewPanels`，不重复
- 第三方连接器数据导出：连接器各自的导出（如 DingTalk）由连接器侧负责
- 数据保留期延长申请：通过 `trial-support@helm.run` 工单，不在卡片直接放表单
- Audit log 浏览器：在 `/settings/audit` 单独 surface，不在本卡片
- 多 workspace 数据保留汇总：当前是单 workspace 视图

---

## 七、验证 checklist（实现 PR 前）

- [ ] `getRetentionStatusReadout(workspaceId)` 单元测试覆盖：TRIALING / GRACE / READ_ONLY / CANCELED 四态、跨日切换边界、缺失 trialState 返回 null
- [ ] `RetentionStatusCard` 组件 snapshot 测试覆盖四态视图
- [ ] `enterGraceNowAction` / `withdrawFromGraceAction` / `forceImmediateDeletionAction` 单元 + 集成测试覆盖：权限拒绝、并发写入、audit event 写入
- [ ] `forceImmediateDeletionAction` 必须要求确认参数 `confirm: "DELETE"`，缺失或不匹配返回错误
- [ ] E2E：在 demo workspace 走完 active → 主动 grace → 撤回 → 再次主动 grace → 立即删除 → 收到删除证明邮件（mock SMTP）
- [ ] DESIGN.md 视觉规范对齐：浅色优先、判断优先层级、status badge 颜色
- [ ] `lib/auth/billing-governance.ts` 已有 `canManageWorkspaceBilling`，无需新增 capability
- [ ] `npm run check:public-release`、`check:boundaries`、`typecheck`、`lint`、`test` 全绿

---

## 八、上下游依赖

- **依赖**：`lib/billing/foundation.ts`（已存在派生逻辑）；`db.trialState`（已存在 schema）；`canManageWorkspaceBilling`（已存在）
- **被依赖**：[HELM_RETENTION_REMINDER_EMAIL_TEMPLATES_V1.md](./HELM_RETENTION_REMINDER_EMAIL_TEMPLATES_V1.md)（邮件提醒在阶段转换前 7 天 / 1 天发送，对应本卡片状态）；[HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md](../legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md)（数据保留期数字源于此）

---

## 九、迭代规则

任何对阶段时长、状态机、行为的修改必须：

1. 同步更新 [HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md](../legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md)
2. 同步更新 [PUBLIC_TRIAL_RUNBOOK.md](../pilot/PUBLIC_TRIAL_RUNBOOK.md)
3. 通过本文件追加新版本号
4. 通过系统邮箱通知所有活跃试用用户

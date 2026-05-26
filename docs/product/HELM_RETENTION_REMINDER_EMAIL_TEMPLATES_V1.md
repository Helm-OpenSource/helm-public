---
status: active
owner: helm-core
created: 2026-04-27
review_after: 2026-07-26
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Retention Reminder Email Templates V1

更新时间：2026-04-27
状态：Planning（模板内容；调度 / 发送链路在 Week 3 实现）
适用范围：公开试用环境的数据保留阶段转换提醒，通过阿里云 DirectMail 送达
配套版本：[HELM_RETENTION_STATUS_CARD_DESIGN_V1.md](./HELM_RETENTION_STATUS_CARD_DESIGN_V1.md) / [HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md](../legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md)

---

## 一、本文件的定位

Week 3 #24：阶段转换前 **7 天** 与 **1 天** 通过阿里云 DirectMail 通知 workspace owner；阶段转换完成后发**删除证明邮件**。

本文件**只**给出：

1. 4 种邮件的标题 + 正文模板（中英双版）
2. 占位变量约定
3. 不发送条件（防垃圾邮件 / 防误发）
4. 调度时机的硬约束

**不**给出：

- 实际发送代码（在 `lib/notifications/system-mail.ts` 与 retention sweep 任务中实现）
- DirectMail SDK 调用示例（按现有连接器约定）

---

## 二、4 种邮件

| 模板 ID | 触发时机 | 收件人 | 不发送条件 |
| --- | --- | --- | --- |
| `RETENTION_T_MINUS_7_TRIAL_TO_GRACE` | active → grace 转换前 7 天 | workspace owner | 用户已主动结束试用进入 grace；workspace 已 canceled |
| `RETENTION_T_MINUS_1_TRIAL_TO_GRACE` | active → grace 转换前 24 小时（最迟） | workspace owner | 同上 |
| `RETENTION_T_MINUS_1_GRACE_TO_DELETION` | grace → 物理删除前 24 小时 | workspace owner | 用户已撤回到 active |
| `RETENTION_DELETION_ATTESTATION` | 物理删除完成后 24 小时内 | workspace owner | — 必发 |

调度硬约束：

- 仅工作区 owner 收件（不抄送其他成员；其他成员通过 owner 内部沟通）
- 一封邮件 = 一个事件；幂等 key = `(workspaceId, templateId, transitionWindowEndsAt.toISOString())`
- 不批量；不合并多封
- 不通过营销渠道；通过 `ALIYUN_MAIL_SYSTEM_EMAIL` 系统邮箱发出

---

## 三、占位变量

所有模板共享：

| 变量 | 说明 | 示例 |
| --- | --- | --- |
| `{{ownerDisplayName}}` | workspace owner 显示名（fallback: email 前缀） | `Alice` |
| `{{workspaceName}}` | workspace 名称 | `Acme Pilot` |
| `{{workspaceCreatedAt}}` | workspace 创建日期（用户本地时区显示） | `2026-04-27（周二）` |
| `{{trialEndsAt}}` | active 结束日期（用户本地时区） | `2026-05-27（周二）` |
| `{{graceEndsAt}}` | grace 结束日期（用户本地时区） | `2026-06-03（周二）` |
| `{{transitionAt}}` | 即将发生的阶段转换时间（用户本地时区） | `2026-05-27 23:59 CST` |
| `{{daysRemaining}}` | 剩余天数（整数） | `7` |
| `{{exportUrl}}` | `/settings/billing` 数据保留状态卡片的 deep link | `https://helm.run/settings/billing` |
| `{{withdrawUrl}}` | grace 期内的撤回 deep link | `https://helm.run/settings/billing#withdraw` |
| `{{deletionAttestationId}}` | 物理删除证明唯一 id（仅删除证明邮件） | `del-2026-06-03-abc123` |
| `{{deletedAt}}` | 物理删除完成时间（仅删除证明邮件） | `2026-06-03 04:12:33 UTC` |

**生产中**：占位变量由 `lib/notifications/system-mail.ts` 内的模板渲染器替换，不在 SQL 或 Prisma 层做字符串拼接。

---

## 四、模板正文

### 4.1 `RETENTION_T_MINUS_7_TRIAL_TO_GRACE`

#### 中文版

**Subject**:
```
[Helm 试用] 您的工作区将在 7 天后进入只读 grace 阶段
```

**Body (text/plain)**:
```
{{ownerDisplayName}} 您好：

这是 Helm 公开试用环境的数据保留提醒。

您的工作区「{{workspaceName}}」（创建于 {{workspaceCreatedAt}}）正处于 active 阶段，将在 {{daysRemaining}} 天后（{{transitionAt}}）进入 grace 阶段。

阶段转换时间表：
  • Active 结束：{{trialEndsAt}}
  • Grace 阶段：进入后 7 天 read-only
  • 物理删除：{{graceEndsAt}} 之后

这意味着：
  • 在 active 结束前，您的工作区可继续读写
  • 进入 grace 后，工作区将变为只读，但您仍可在 7 天内导出数据或申请撤回到 active
  • grace 结束后，工作区数据将被物理删除并发送删除证明

如果您希望保留数据，请：
  1. 在 active 结束前自助导出：{{exportUrl}}
  2. 或者联系 trial-support@helm.run 申请延期（评估是否升级到 reserved tenant 路径）

如果您希望立即结束试用，可在 {{exportUrl}} 选择「立即结束试用」（→ grace）。

边界提醒：
  • Helm 公开试用环境不承诺 SLA
  • 数据按 30 天 active + 7 天 grace + 物理删除 流程处理（详见数据政策）
  • 本邮件由系统邮箱自动发出，回信不会被处理

如需联系我们：
  • 试用支持：trial-support@helm.run
  • 数据保护：privacy@helm.run
  • 安全披露：security@helm.run（请勿在公开渠道披露漏洞）

——
Helm 团队
```

#### English Version

**Subject**:
```
[Helm Trial] Your workspace enters read-only grace in 7 days
```

**Body (text/plain)**:
```
Hi {{ownerDisplayName}},

This is a data retention reminder from the Helm public trial environment.

Your workspace "{{workspaceName}}" (created {{workspaceCreatedAt}}) is currently in the active phase. It will enter the grace phase in {{daysRemaining}} days, on {{transitionAt}}.

Phase transition schedule:
  • Active ends:      {{trialEndsAt}}
  • Grace phase:      7 days read-only after active ends
  • Hard deletion:    after {{graceEndsAt}}

What this means:
  • Until active ends, your workspace remains read/write
  • In grace, the workspace becomes read-only; you can export data or request withdrawal back to active within those 7 days
  • After grace ends, the workspace data is physically deleted and an attestation email is sent

If you want to keep the data, please:
  1. Self-export before active ends: {{exportUrl}}
  2. Or email trial-support@helm.run to discuss extension (which may move you onto the reserved tenant path)

If you want to end the trial immediately, use the "End trial now" action at {{exportUrl}} (→ grace).

Boundary reminders:
  • The Helm public trial environment does not commit to an SLA
  • Data follows the 30-day active + 7-day grace + hard deletion flow (see the data policy)
  • This email is sent automatically from the system mailbox; replies are not processed

To reach us:
  • Trial support:        trial-support@helm.run
  • Data protection:      privacy@helm.run
  • Security disclosure:  security@helm.run (please do not file vulnerabilities in public channels)

——
The Helm team
```

---

### 4.2 `RETENTION_T_MINUS_1_TRIAL_TO_GRACE`

#### 中文版

**Subject**:
```
[Helm 试用] 您的工作区将在 24 小时内进入只读 grace 阶段
```

**Body (text/plain)**:
```
{{ownerDisplayName}} 您好：

这是 Helm 公开试用的最终提醒。

您的工作区「{{workspaceName}}」将在 24 小时内（{{transitionAt}}）进入 grace 阶段（read-only）。

如果您希望保留数据，请**今天**：
  • 自助导出：{{exportUrl}}
  • 或者联系 trial-support@helm.run 申请延期

进入 grace 后：
  • 工作区将变为只读
  • 7 天内可撤回到 active 或导出
  • {{graceEndsAt}} 之后将物理删除

如果您希望此次进入是预期内的，无需任何操作。

——
Helm 团队（系统邮箱自动发出）
```

#### English Version

**Subject**:
```
[Helm Trial] Your workspace enters read-only grace within 24 hours
```

**Body (text/plain)**:
```
Hi {{ownerDisplayName}},

This is the final Helm public trial reminder.

Your workspace "{{workspaceName}}" enters the grace phase (read-only) within 24 hours, at {{transitionAt}}.

To keep your data, please act **today**:
  • Self-export: {{exportUrl}}
  • Or email trial-support@helm.run to discuss extension

After entering grace:
  • The workspace becomes read-only
  • You can withdraw back to active or export within 7 days
  • Hard deletion happens after {{graceEndsAt}}

If this transition is expected, no action is required.

——
The Helm team (sent automatically from the system mailbox)
```

---

### 4.3 `RETENTION_T_MINUS_1_GRACE_TO_DELETION`

#### 中文版

**Subject**:
```
[Helm 试用] 您的工作区将在 24 小时内被物理删除
```

**Body (text/plain)**:
```
{{ownerDisplayName}} 您好：

这是 Helm 公开试用的物理删除前最后提醒。

您的工作区「{{workspaceName}}」目前处于 grace 只读阶段，将在 24 小时内（{{transitionAt}}）被物理删除。

物理删除范围：
  • 您的 first-party 业务数据（会议、CRM、Operating signals、Memory、Approvals 等）
  • 索引、缓存、备份滚动失效
  • 物理删除完成后您将收到一封删除证明邮件

物理删除**不**包括：
  • 内部 audit log（保留 5 年合规期，仅含 deletion attestation 元数据，不含您的业务数据）

如果您希望撤回到 active：
  • 在 {{transitionAt}} 之前点击：{{withdrawUrl}}
  • 撤回会重置 30 天 active；不会累计原剩余天数

如果您希望提前完成删除：
  • 在 {{exportUrl}} 选择「立即物理删除」并确认

如果此次物理删除是预期内的，无需任何操作；删除完成后您将收到证明。

——
Helm 团队（系统邮箱自动发出）
```

#### English Version

**Subject**:
```
[Helm Trial] Your workspace will be physically deleted within 24 hours
```

**Body (text/plain)**:
```
Hi {{ownerDisplayName}},

This is the final Helm public trial reminder before physical deletion.

Your workspace "{{workspaceName}}" is currently in the grace read-only phase. Physical deletion will execute within 24 hours, at {{transitionAt}}.

What gets physically deleted:
  • Your first-party business data (meetings, CRM, operating signals, memory, approvals, etc.)
  • Indexes, caches, and rolling backup invalidation
  • You will receive a deletion attestation email after completion

What does NOT get deleted:
  • Internal audit log (retained for 5 years for compliance; contains only deletion attestation metadata, not your business data)

To withdraw back to active:
  • Click before {{transitionAt}}: {{withdrawUrl}}
  • Withdrawal resets a fresh 30-day active window; it does not carry over the previous remainder

To complete deletion ahead of schedule:
  • Use "Delete now" at {{exportUrl}} and confirm

If this deletion is expected, no action is required; you will receive the attestation after completion.

——
The Helm team (sent automatically from the system mailbox)
```

---

### 4.4 `RETENTION_DELETION_ATTESTATION`

#### 中文版

**Subject**:
```
[Helm 试用] 工作区数据已物理删除（删除证明）
```

**Body (text/plain)**:
```
{{ownerDisplayName}} 您好：

您的工作区「{{workspaceName}}」的数据已物理删除。

删除证明：
  • 证明编号：{{deletionAttestationId}}
  • 完成时间：{{deletedAt}}
  • 工作区创建：{{workspaceCreatedAt}}
  • Active 结束：{{trialEndsAt}}
  • Grace 结束：{{graceEndsAt}}

已删除：
  • 您的 first-party 业务数据
  • 索引、缓存、备份滚动失效

继续保留（合规期，5 年）：
  • Audit log 中的 deletion attestation 元数据
  • 不含您的业务数据，仅记录删除事实

如果您希望重新使用 Helm，可在公开试用注册页创建新的 workspace（30 天 active 重新计时）。

如果您对删除证明有任何疑问：
  • 数据保护：privacy@helm.run
  • 试用支持：trial-support@helm.run

——
Helm 团队（系统邮箱自动发出）

---
本邮件作为正式删除证明，请妥善保存。如本邮件因任何原因未送达，删除事实仍以内部 audit log 为准；可通过 privacy@helm.run 索取证明副本。
```

#### English Version

**Subject**:
```
[Helm Trial] Workspace data has been physically deleted (deletion attestation)
```

**Body (text/plain)**:
```
Hi {{ownerDisplayName}},

The data in your workspace "{{workspaceName}}" has been physically deleted.

Deletion attestation:
  • Attestation ID:   {{deletionAttestationId}}
  • Completed at:     {{deletedAt}}
  • Workspace created: {{workspaceCreatedAt}}
  • Active ended:     {{trialEndsAt}}
  • Grace ended:      {{graceEndsAt}}

What was deleted:
  • Your first-party business data
  • Indexes, caches, and rolling backup invalidation

What is retained (5-year compliance window):
  • Deletion attestation metadata in the audit log
  • This contains no business data — only the fact and timing of deletion

To use Helm again, please create a new workspace via the public trial registration page (a fresh 30-day active window starts at creation).

If you have any questions about this attestation:
  • Data protection: privacy@helm.run
  • Trial support:   trial-support@helm.run

——
The Helm team (sent automatically from the system mailbox)

---
This email serves as a formal deletion attestation; please retain it. If for any reason the email failed delivery, the deletion fact is still authoritative in the internal audit log; you can request a copy via privacy@helm.run.
```

---

## 五、调度时机的硬约束

| 边界条件 | 处理 |
| --- | --- |
| `transitionAt` 落在用户本地深夜（00:00–06:00 用户时区） | 不延后；按 UTC 触发；用户时区显示 |
| `transitionAt` 落在中国大陆法定假期 | 不延后；试用环境不区分工作日 |
| 用户在 24 小时内主动撤回到 active | 已发出的 7 天 / 1 天提醒不撤回；新发的 grace_to_deletion 提醒受撤回事件抑制 |
| DirectMail 502 / quota 失败 | 队列重试 3 次（指数退避 5 / 30 / 180 分钟）；3 次失败 → 升级 oncall 通知备用渠道 |
| 多次重试后仍发送失败 | 物理删除**不**因邮件失败而推迟；audit 记录 `attestation_email_failed` 但删除已完成 |
| Workspace owner 邮箱地址变更 | 在 owner 修改邮箱时显式提示「数据保留提醒将发送到新邮箱」并要求二次验证；之后所有未发的 reminder 切到新地址 |

---

## 六、防滥用与防误发

- **不**对同一 `(workspaceId, templateId, transitionWindowEndsAt)` 重复发送（幂等 key）
- **不**对工作区 status = `CANCELED` 的 workspace 发送除 deletion attestation 之外的任何邮件
- **不**通过营销邮箱地址发送；统一从 `ALIYUN_MAIL_SYSTEM_EMAIL` 出
- **不**包含可点击的钓鱼诱饵：deep link 域名固定为 `helm.run`，登录前会经过常规 session 验证
- 邮件正文与 subject 中**不**包含密码、API key、访问令牌、reset link 等敏感内容

---

## 七、与 audit log 的对应

每封发出的邮件写一条 audit event：

| 邮件 | Audit eventName | metadata |
| --- | --- | --- |
| `RETENTION_T_MINUS_7_TRIAL_TO_GRACE` | `retention_reminder_sent` | `{ templateId, daysAhead: 7 }` |
| `RETENTION_T_MINUS_1_TRIAL_TO_GRACE` | `retention_reminder_sent` | `{ templateId, daysAhead: 1 }` |
| `RETENTION_T_MINUS_1_GRACE_TO_DELETION` | `retention_reminder_sent` | `{ templateId, daysAhead: 1 }` |
| `RETENTION_DELETION_ATTESTATION` | `retention_deletion_attested` | `{ deletionAttestationId, deletedAt }` |

发送失败时多写一条 `retention_reminder_send_failed`（仍幂等）。

---

## 八、本地化与回退

- 用户语言读 `Workspace.defaultLocale`：`zh-CN` / `en-US`
- 不支持的 locale → 回退到 `en-US`
- 若用户后续切换 locale，**已发**邮件不重发；**未发**邮件按新 locale 渲染

---

## 九、验证 checklist（实现 PR 前）

- [ ] 模板渲染纯函数 + 4 模板 × 2 语言 = 8 个 snapshot 测试
- [ ] 占位变量替换不允许任何变量名残留（如 `{{ownerDisplayName}}` 出现在最终邮件 → 测试失败）
- [ ] 幂等 key 写入 + 重发抑制单元测试
- [ ] DirectMail 502 / quota 失败 + 指数退避重试集成测试
- [ ] CANCELED workspace 触发 RETENTION_T_MINUS_7 → 应抑制；删除证明 → 应发送
- [ ] subject 与 body 经过常规 SPAM 静态规则筛查（无明显钓鱼特征）
- [ ] 全部模板 lint：subject ≤ 78 字符、body 单行 ≤ 78 字符（兼容传统邮件客户端）
- [ ] 与 [HELM_RETENTION_STATUS_CARD_DESIGN_V1.md](./HELM_RETENTION_STATUS_CARD_DESIGN_V1.md) 文案保持术语一致
- [ ] `npm run check:public-release` / `check:boundaries` / `typecheck` / `lint` / `test` 全绿

---

## 十、迭代规则

- 任何文案修改需同步更新 [HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md](../legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md) 与 [HELM_RETENTION_STATUS_CARD_DESIGN_V1.md](./HELM_RETENTION_STATUS_CARD_DESIGN_V1.md)
- 任何阶段时长修改必须同时改 `lib/billing/foundation.ts` 常量、本文件、卡片设计、运行手册
- 加新模板（如「试用即将到期 14 天」中间档）必须独立分配 templateId 与幂等 key 域；不复用现有 templateId

---

## 十一、不做（本批模板刻意不做）

- HTML 版本：当前只发 text/plain 以避免渲染问题与 SPAM 罚分；HTML 推迟到 v0.2 视真实送达率决定
- 微信 / 钉钉推送：试用环境的治理通知统一邮件；渠道扩展推迟
- 用户偏好「关闭这类提醒」：治理类通知不可关闭，因为是数据保留义务的一部分
- A/B 测试 / 营销追踪 pixel：不引入
- 多 owner 抄送：避免内部冲突；只发主 owner

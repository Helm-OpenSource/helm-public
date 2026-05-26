---
status: active
owner: helm-core
created: 2026-04-27
review_after: 2026-07-26
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Public Trial Runbook

更新时间：2026-05-02
适用范围：`v0.1.0-trial` 公开试用版用户、Helm 团队 oncall 与 owner、试用邀请发起人
配套版本：与 [HELM_PUBLIC_ROADMAP.md](../roadmap/HELM_PUBLIC_ROADMAP.md) 与 [HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md](../legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md) 同期

---

## 一、本文件的定位

这是 Helm 公开试用环境（云端）面向**用户与 oncall**的运行手册。

它**不**替代：

- 数据政策的法律性陈述 → 见 [HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md](../legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md)
- 产品路线图与方向叙述 → 见 [HELM_PUBLIC_ROADMAP.md](../roadmap/HELM_PUBLIC_ROADMAP.md)
- 内部架构与 boundary 文档 → 见 [AGENTS.md](../../AGENTS.md) / [DESIGN.md](../../DESIGN.md)

它**只解决**一件事：让一个新用户从注册到形成稳定使用，知道**自己看到的边界、能预期的服务水平、出问题该怎么联系**。

---

## 二、试用须知（用户必读）

### 2.1 阶段定位

- Helm **当前处于受控试点（Controlled Trial）阶段**，不是商业产品 GA
- 服务水平**未承诺 SLA**：可用性、性能、恢复时点、停机窗口都不构成正式承诺
- 我们会按工作日响应反馈，但**不**做 24×7 oncall 承诺
- 公开试用**不**默认启用 OpenAI API 集成；启用前会显式 banner + 二次同意
- 公开试用**不**默认启用支付能力

### 2.2 数据保留期

- 正式保留期以工作区试用契约和生效数据政策为准，公开发布前必须完成法务最终对齐
- 当前目标草案是 **30 天 active + 7 天 grace**，但在法务签署前不得作为对外承诺销售或宣传
- Hard deletion、用户主动删除、撤回窗口和删除证明以生效数据政策为准

### 2.3 数据驻留与 sub-processor

公开试用环境部署在 **阿里云 cn-hangzhou**：

- **默认启用**：阿里云 RDS MySQL / ECS / OSS / SLS / DirectMail（系统邮件）
- **默认关闭**：OpenAI API（启用前需用户二次同意）
- **默认关闭**：Stripe / Alipay / WeChat Pay 支付能力

详细 sub-processor 实名清单见 [HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md](../legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md)。

### 2.4 你的工作区会做什么、不会做什么

**会做**：

- 把你导入的会议、邮箱、CRM 信号收敛成必须推进项 / Review Action / 经营记忆
- 提供 Ask Helm 行动意图入口：回答、计划分解、起草草稿、生成内部 handoff
- 在 `/mobile` 第一屏汇总当前 workspace 的窄手机端经营推进入口
- 把每一条客户可见关键动作（DingTalk 邀请、CRM 阶段变更、外发草稿、记忆提升等）写成一条带 `traceId / requestId / parentEventId` 的 `AuditLog`；统一用户可见 trace timeline 仍是 release hard gate，未落地前不宣传“0 秒完整回放”

**不会做**（也是 Helm 当前刻意不做的）：

- 自动外发邮件 / 钉钉 / 企微 / 短信（DingTalk Directory 邀请等 connector 默认 dry-run，必须显式确认才能 live send）
- 自动审批、自动结算、自动付款
- 自动跨 workspace 检索或聚合
- 多轮聊天历史持久化
- 把 LLM 输出当作最终排序依据

### 2.5 不要在试用环境提交真实生产数据

- 试用环境**不承诺 SLA**，请勿用于真实生产经营决策
- 强烈建议使用 demo / 沙箱数据进行评估
- 如需基于真实数据评估，请联系我们走受控的 reserved tenant 路径，**不**走公开试用入口

---

## 三、注册与起步流程

### 3.1 注册

1. 访问试用注册页（公开 launch 后由 owner 公布 URL）
2. `/setup?onboarding=trial` 引导：
   - 邮箱 + 短信或邮箱验证码
   - 勾选「我已阅读并同意 [HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md](../legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md)」
   - 选择中文 / 英文界面
3. 系统创建你的 workspace；保留期倒计时以当次工作区契约和生效数据政策为准

### 3.2 起步推荐路径

**第一天（10 分钟内验证 Helm 是否对你有价值）**：

1. `/setup` → 完成 onboarding
2. `/mobile` → 看第一屏 Mobile Command Surface
3. `/imports` → 选一个最熟悉的 CRM / 邮箱 / 会议来源做 dry-run import
4. `/operating` → 看 Helm 怎么把信号收敛成判断 / 决策 / 边界

**第一周**：

- 加入 1-2 名团队成员（`/settings` → 邀请）
- 每天看一次 `/mobile` Must Push，跟进真实推进
- `/memory` 复核生成的经营记忆，approve 或修正

**第三周**：

- 看 `/settings/billing` → 数据保留状态卡片，确认了解阶段转换时间点
- 决定是否要：(a) 继续 active（导出 + 联系延期），(b) 进入 grace（计划停用），(c) 立即结束并物理删除

---

## 四、数据隔离声明

### 4.1 Workspace-first 隔离

- 你的所有写入数据按 `workspaceId` 隔离
- 跨 workspace 自动聚合 / 自动检索 **没有授权**
- Helm 团队成员**不能**默认访问你的 workspace；只有在你显式邀请的 reserved tenant 路径下才有访问能力（公开试用环境**不存在** reserved tenant 关联）

### 4.2 Audit log

- 关键写路径都有审计事件
- 你可在 `/settings/audit` 查看本 workspace 的事件流（待 v0.1 GA 完整开放；当前可通过反馈渠道索取）

### 4.3 Sub-processor 与第三方数据流

启用某个连接器（DingTalk / HubSpot / Salesforce / WeCom / OpenAI 等）即同时同意该 sub-processor 处理对应数据。各连接器在 `/settings` 详情页都会显示数据流向说明。

OpenAI API 默认关闭。启用时：

- 触发明确 banner 二次同意
- 仅在你打开 Ask Helm / 概要生成等 LLM 功能时才会向 OpenAI 发送数据
- 不向 OpenAI 同步你的整个 workspace；只发当前任务需要的字段

### 4.4 删除与导出

- **自助导出**：`/settings/billing` → 数据保留状态卡片 → 「导出全部」按钮，生成 zip（CSV + JSON）
- **自助删除**：`/settings/billing` → 「立即结束试用」 → 按生效数据政策进入 grace / 删除链路
- **删除证明**：物理删除完成 24 小时内通过阿里云 DirectMail 发出
- **法律保留期**：删除完成后内部 audit log 保留 5 年（仅记录 `deletion attestation`，不保留你的业务数据）

---

## 五、反馈渠道

### 5.1 普通反馈与功能讨论

- **GitHub Issues**：[github.com/Helm-Developers/helm2026/issues](https://github.com/Helm-Developers/helm2026/issues) — 公开问题、功能讨论、文档勘误
- 标签建议：`trial-feedback` / `bug` / `docs` / `discussion`

### 5.2 安全漏洞披露

**请勿在公开 issue 或 PR 披露未公开的安全漏洞**。私下披露见 [SECURITY.md](../../SECURITY.md)：

- Email：`security@helm.run`
- 响应时间：3 工作日内确认；7 工作日内初步评估；P0/P1 30 日内修复

### 5.3 数据保护 / 合规问题

- Email：`privacy@helm.run`
- 涉及 GDPR / 个人信息保护法 / sub-processor 调整 / 数据保留延期等

### 5.4 试用 oncall（公开试用启动后填入）

- Email：`trial-support@helm.run`
- 响应窗口：周一至周五 9:00–18:00（UTC+8）
- **不**承诺周末 / 法定假期 / 24×7 响应

---

## 六、可期望的演进节奏

### 6.1 当前节奏

- **`v0.1.0-trial`**：2026-05-31 目标公开发布
- **`v0.1.x`**：试用反馈窗口；bug 修复 + 数据保留 / 邮件提醒 / dogfooding 闭环
- **`v0.2`**：待评估（取决于试用反馈与 Phase 3 thin read-model adapter 全量解禁条件）

详见 [HELM_PUBLIC_ROADMAP.md](../roadmap/HELM_PUBLIC_ROADMAP.md)。

### 6.2 我们会主动通知你的事

通过 `ALIYUN_MAIL_SYSTEM_EMAIL` 配置的系统邮箱发出（不可关闭，因为是治理通知）：

- **数据保留阶段转换前提醒**：active → grace / grace → 物理删除按生效数据政策通知
- **物理删除完成**：删除证明邮件
- **重大政策变更**：数据政策更新、sub-processor 调整、定价变更
- **重大安全事件**：依据法律法规与本 runbook §5.2 时间线披露

### 6.3 我们不会主动发的

- 营销推送 / 升级促销
- 第三方推荐
- 竞品对比

如果你收到一封看似来自 Helm 但内容是上述类型的邮件，**视为钓鱼**并通过 §5.2 渠道报告。

---

## 七、Oncall 操作手册（内部）

> 本节面向 Helm 团队 oncall。普通用户可跳过。

### 7.1 P0 / P1 触发条件

- **P0**：试用环境不可用 ≥ 15 分钟 / 数据完整性事件 / 凭据泄露 / 物理删除失败
- **P1**：可用性下降但尚未达到 P0 / 任意 invariant guard 触发 / 关键 audit chain 断裂

### 7.2 P0 响应链

1. 触发：自动告警 / 用户报告 / dogfooding 团队发现
2. 5 分钟内：oncall 主备 + Operations Lead 上线
3. 15 分钟内：判断是否需要回滚 `BUSINESS_ADVANCEMENT_RUNTIME_ENABLED` flag
4. 30 分钟内：判断是否需要 incident 公告（站内 banner + 邮件）
5. 完整链路：参考 [HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ENABLEMENT_REVIEW_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ENABLEMENT_REVIEW_V1.md) §四 回滚剧本

### 7.3 数据保留阶段转换异常

- **active → grace 自动迁移失败**：lib/billing/foundation.ts 派生逻辑出错时，工作区会停在 active；oncall 手动触发派生重算
- **grace → 物理删除失败**：retention sweep 在 grace 结束当日物理删除；失败时进入 `delete-pending` 状态，oncall 24 小时内人工执行；超过 48 小时未删除 → 升级为 P0 数据保留事件

### 7.4 删除证明邮件失败

- 发件失败（DirectMail 502 / quota）：邮件入队列；24 小时内重试 3 次；仍失败 → 通过备用渠道（注册时的备用邮箱）+ 工单系统通知用户

### 7.5 用户主动撤回 grace

- 用户在 `/settings/billing` 点「撤回到 active」 → 立即恢复，无 cooldown
- 撤回事件在 audit log 落 `RetentionGraceWithdrawn` 类型，记 5 年

---

## 八、试用结束后的目标状态机草案

```
Active (duration from effective workspace contract)
   │
   ├── 用户继续使用 → 联系 trial-support 申请延期 → 工作区可被升级到 reserved tenant 路径
   │
   ├── 用户主动结束 → 立即进入 Grace
   │
   └── active 到期 → 自动进入 Grace
        │
        ├── (Grace duration from effective data policy, read-only)
        │      ├── 用户撤回 → 回到 Active（剩余天数清零，重新计算）
        │      ├── 用户导出 → 拿到 zip + 继续等待物理删除
        │      └── 用户什么都不做 → 到期后进入 hard delete
        │
        └── Hard Deletion
             │
             ├── 物理数据删除 + 索引清理 + 备份滚动失效
             ├── 删除证明邮件发出（24 小时内）
             └── audit log 保留 deletion attestation，业务数据不再保留
```

---

## 九、常见问题

**Q: 我能延长试用期吗？**

A: 可以。联系 `trial-support@helm.run`，说明用例。延期会评估是否升级到 reserved tenant 路径（不再走公开试用环境）。

**Q: 我的数据存在哪里？**

A: 阿里云 cn-hangzhou region 的 RDS MySQL + OSS。详细 sub-processor 实名见 [HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md](../legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md)。

**Q: 我可以在 GitHub 上私有部署 Helm 吗？**

A: 可以。源代码 Apache-2.0 License。你的部署完全独立，不与公开试用环境共享数据或控制平面。详细见 [README.md](../../README.md) 与 [docker-compose.yml](../../docker-compose.yml)。

**Q: 我的反馈会进 v0.2 吗？**

A: 我们不预承诺 v0.2 内容。试用反馈会进入 owner 评估队列，根据频次 + 严重度 + 与边界一致性决定是否纳入。

**Q: Helm 会扩展到自动执行 / 自动审批 / marketplace 吗？**

A: 当前路线图明确**不做**。详见 [HELM_PUBLIC_ROADMAP.md](../roadmap/HELM_PUBLIC_ROADMAP.md) §Out of scope。

---

## 十、变更记录

| 版本 | 日期 | 变更 |
| --- | --- | --- |
| V1 草稿 | 2026-04-27 | 初稿；v0.1.0-trial 公开发布前的 runbook 框架 |

后续每次重大政策变更（数据保留期调整、sub-processor 增减、SLA 立场变化、反馈渠道变更）必须在本文件追加版本号并通过系统邮箱通知所有活跃试用用户。

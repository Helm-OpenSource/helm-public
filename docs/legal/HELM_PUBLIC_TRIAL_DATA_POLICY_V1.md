---
status: active
owner: helm-core
created: 2026-04-27
review_after: 2026-07-26
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Public Trial Data Policy V1

更新时间：2026-05-02
状态：公开试点数据政策草案；30/7 retention 是当前目标口径，待法务最终对齐后才可作为对外承诺
适用范围：云端公开试用环境的数据保留期、删除流程、用户权利、SLA 立场
实现状态：注册同意 checkbox 与「数据保留状态」卡片待落地；不新增 schema enum，不新增 retention sweep cron，不新增 deletion attestation API；删除证明走邮件路径

本文件定义 Helm 云端公开试用（`v0.1.0-trial` 起）的数据政策。它**不替代**未来正式商用版本的 ToS / DPA，只覆盖受控试点窗口。owner 已对齐两条核心立场：

1. **不承诺 SLA**（受控试点姿态，不承诺可用性、性能、恢复时点）
2. **目标数据保留期**（明确生命周期、硬删除、导出与删除证明的目标机制；法务签署前不作为对外承诺）

本文件按 [Helm open source and cloud trial launch posture](../product/HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md) 与 [release reality alignment](../product/HELM_RELEASE_REALITY_ALIGNMENT.md) 形成目标草案；不走 90/30/7、不新增 `pending_deletion` schema、不新增默认外部写入。正式公开试点以工作区契约和法务签署后的生效政策为准。

---

## 一、SLA 立场

### 1.1 不承诺事项

云端公开试用环境**不承诺**：

1. 服务可用性百分比（Uptime SLA）
2. 响应时间 / P95 / P99 性能指标
3. 故障恢复时点（RTO）
4. 数据丢失上限（RPO）
5. 7×24 支持响应
6. 任何形式的金钱赔偿或服务额度补偿

### 1.2 承诺事项

云端公开试用环境在政策生效后**承诺**：

1. **数据保留期**（见 §二）按本政策执行，到期前不擅自删除
2. **变更通知**：本政策修改提前 14 天在 `docs/legal/HELM_PUBLIC_TRIAL_DATA_POLICY_CHANGELOG.md` 公告并发邮件至 workspace owner
3. **数据导出**：用户可在 grace 期结束前自助导出经营对象数据
4. **删除证明**：硬删除完成后通过邮件出具删除证明
5. **诚实表达**：在 UI 与文档中持续诚实表达受控试点边界，不把 trial 包装成生产级承诺

---

## 二、数据保留期（目标草案，待法务最终确认）

### 2.1 生命周期阶段

每个公开试用 workspace 的目标生命周期如下（与现有 `enum AccessState` 对齐：`TRIALING / GRACE / CANCELED`）。法务确认前，公开口径只应写为“按工作区试用契约与生效数据政策执行”：

| 阶段 | 进入条件 | 时长 | 数据可读 | 数据可写 | 计费 |
|---|---|---|---|---|---|
| `trialing` | workspace 创建 | 30 天 | 是 | 是 | 否 |
| `grace` | trialing 到期未付费 | 7 天 | 是 | 否（read-only） | 否 |
| `canceled` | grace 到期 | — | 已物理删除 | — | 否 |

目标总链路最长 **37 天**（30 + 7）。grace 同时承担两个职责：受控试点期满后的只读窗口、用户主动删除请求的可撤回窗口。

### 2.2 时间起算规则

1. `trialing` 起算时间 = workspace `BillingAccount.createdAt`
2. 阶段转换由后端在用户请求 / 登录 / 后台轮询时按 `lib/billing/foundation.ts` 中 `TRIAL_DURATION_DAYS = 30` 与 `GRACE_DURATION_DAYS = 7` 派生；本政策不要求新增 retention sweep cron
3. 阶段转换不依赖用户登录与否；不活跃用户与活跃用户走同一时间表
4. 阶段转换前 7 天 / 1 天分别给 workspace owner 发邮件提醒

### 2.3 用户主动删除

用户可在任何阶段主动请求删除 workspace：

1. 请求路径：`settings/billing` → 「主动删除 workspace」
2. 请求后 workspace 立即进入 `grace`（read-only，可撤回）
3. 撤回窗口：7 天，与 grace 同
4. 撤回路径：`settings/billing` → 「撤回删除请求」（或邮件回复撤回链接）
5. 7 天到期 → 物理删除 + 邮件出具删除证明

### 2.4 付费续命

1. `trialing` 阶段付费 → 进入 `active`（不在本政策范围）
2. `grace` 阶段付费 → 恢复到 `active`（保留所有数据）
3. `canceled` 阶段（已物理删除）→ 不可恢复，需重新创建 workspace

---

## 三、数据范围与硬删除定义

### 3.1 受本政策覆盖的数据

公开试用 workspace 的所有 first-party 数据：

1. 经营对象：Lead / Customer / Candidate / Partner / Workstream / Meeting / Memory / Commitment / Opportunity / Tenant Resource
2. AI 派生对象：AdvancementSignal / MustPushItem / ReviewRequiredAction / MemoryCandidate / SkillSuggestion
3. Connector 同步数据：邮件、会议、CRM 同步进来的镜像数据（不含原始系统数据，原始系统由用户自行管理）
4. 审计与事件：AuditEvent / Event / UsageLedger（与本 workspace 关联部分）
5. 用户上传：附件、转录、导入 CSV

### 3.2 不受本政策覆盖的数据

1. **匿名化的产品分析数据**：聚合的 Must Push 命中率、deterministic ordering 稳定性、boundary 违规计数等 — 用于产品质量监控，不含 workspaceId / userId / 任何业务字段，长期保留
2. **删除证明记录**：见 §四，保留 5 年
3. **法律合规要求保留的最小元数据**：仅 workspaceId hash、生命周期阶段转换时间戳、操作者 = system

### 3.3 硬删除的物理含义

「硬删除」= 以下所有动作完成：

1. 主库（阿里云 RDS MySQL，cn-hangzhou）相关行 `DELETE`，不留 soft-delete 标记
2. 阿里云 OSS 上的附件 / 转录 / 导出文件按对象生命周期到期自动清除（建议 7 天保留）
3. 阿里云 SLS 中含 workspaceId 的访问日志按日志库 retention 自动到期；不主动反向擦除
4. 第三方 sub-processor（OpenAI 等，启用时）按各自 data processing agreement 触发 deletion request
5. 写一条 `WORKSPACE_HARD_DELETED` audit，仅含 workspaceId hash + 时间戳 + 操作者 = system

---

## 四、用户权利

### 4.1 数据访问权

用户随时可在 `settings/billing` 看到：

1. 当前生命周期阶段
2. 距下一阶段倒计时
3. 可执行动作（导出 / 续费 / 主动删除 / 撤回删除）
4. 数据保留状态卡片（trialing / grace 显示，canceled 不再显示）

### 4.2 数据导出权

1. 导出格式：JSON + CSV
2. 包含范围：§3.1 中的 1 / 2 / 3 / 5 类（审计与事件不导出，因含跨 workspace 元数据）
3. 触发路径：`settings/billing` → 「导出我的 workspace 数据」
4. 执行：异步 job，完成后下载链接通过阿里云 DirectMail / 企业邮箱发送
5. 链接有效期：7 天（与 grace 同）
6. 导出在 `grace` 阶段仍可执行

### 4.3 删除请求权

1. 见 §2.3 用户主动删除
2. 删除请求一旦提交，立即进入 `grace`，7 天可撤回

### 4.4 删除证明权

1. 硬删除完成后，删除证明通过邮件发送至 workspace owner（不开放查询 API）
2. 证明内容：workspaceId hash、删除时间戳、删除操作者 = system、本政策版本号
3. 证明保留：5 年（在 helm 内部审计存档；用户邮箱里的副本由用户自行保留）

### 4.5 数据修正权

1. 用户对自己 workspace 内的所有 first-party 数据有完整修改权（trialing / active 阶段）
2. grace 阶段不可修改（已 read-only）
3. AI 派生数据（AdvancementSignal / MustPushItem 等）的修正通过 review-first 流程完成

---

## 五、数据位置与 Sub-Processors

### 五月公开试用版本

1. **数据位置**：**阿里云 cn-hangzhou**，单 region；public trial 默认无跨境数据传输
2. **Sub-Processors**（实名）：

| 类目 | 实名 | 启用姿态 |
|---|---|---|
| 数据库 | 阿里云 RDS MySQL（cn-hangzhou） | 默认启用 |
| 应用托管 | 阿里云 ECS（cn-hangzhou） | 默认启用 |
| 对象存储 | 阿里云 OSS（cn-hangzhou） | 默认启用 |
| 日志 | 阿里云 SLS（cn-hangzhou） | 默认启用 |
| 邮件 | 阿里云 DirectMail / 企业邮箱 | 默认启用 |
| LLM | OpenAI API | **默认关闭**；启用前在 UI 与本政策中显式披露，并取得用户额外同意 |
| 支付 | Stripe / Alipay / WeChat Pay | **public trial 默认关闭**；上线商用版前不启用 |

3. 每个 sub-processor 的 data processing agreement 链接在公开发布前会在本节列出；undisclosed sub-processor 不在本政策覆盖范围

### 跨境数据传输

1. 默认无跨境数据传输（数据驻留 cn-hangzhou）
2. **如果用户启用 OpenAI API**：该 workspace 的部分 prompt / response 会发送至 OpenAI（境外服务）；启用动作必须由用户在 settings 中显式打开，并伴随显式同意 banner，同意时间记入 audit
3. 商用版本若引入跨境路径（例如 Vercel / PlanetScale 等境外 sub-processor），必须独立起草新版政策并取得用户重新同意，本政策不预先授权

---

## 六、注册同意

### 6.1 注册流 checkbox

`/setup?onboarding=trial` 与公开首页 signup flow 必须包含一个**必勾** checkbox：

> 「我已阅读 [试用数据政策 v1](/legal/trial-data-policy)，理解 Helm 当前为受控试点，不承诺 SLA，数据保留期以本工作区试用契约与生效数据政策为准。数据驻留中国境内（阿里云 cn-hangzhou）；OpenAI API 与支付能力默认关闭，启用前会另行告知并请求同意。」

### 6.2 同意记录

同意时间 + 政策版本号 + 同意 IP（hash） 写入 `AuditEvent`，不新增 schema 字段。

### 6.3 政策变更

1. 政策修改提前 14 天公告
2. 变更后用户下次登录时强制重新确认（如有实质性变更）
3. 仅修正错别字 / 链接更新等非实质变更不强制重新确认

---

## 七、与既有文档的关系

1. [AGENTS.md](../../AGENTS.md)：长期硬边界（受控试点不等于企业级）— 本文件不放松这条
2. [HELM_RELEASE_REALITY_ALIGNMENT.md](../product/HELM_RELEASE_REALITY_ALIGNMENT.md)：本文件继承公开承诺收口与 release hard gate 姿态
3. [HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md](../product/HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md) §2.3：launch plan 的 retention 描述需同步收口至 30/7
4. [README.md](../../README.md)：本文件继承“Helm 当前刻意不做”的公开边界
5. 未来正式商用版本：本文件**不**替代未来 ToS / DPA / SLA；正式商用版本必须独立起草

---

## 八、五月落地 checklist

- [ ] 30/7 retention 法务最终确认（本文件 §二当前为目标草案）
- [x] sub-processor 实名（本文件 §五）
- [ ] 法务最终对齐
- [ ] 英文版同步起草 `HELM_PUBLIC_TRIAL_DATA_POLICY_EN_V1.md`
- [ ] `settings/billing`「数据保留状态」卡片 + 自助导出按钮
- [ ] 注册流同意 checkbox（按 §6.1 文案；存入 `AuditEvent`，不新增 schema）
- [ ] OpenAI API 启用 banner + 二次同意（默认关闭，启用前触发）
- [ ] 删除证明邮件模板（阿里云 DirectMail；不开放查询 API）
- [ ] 公开发布前在 §五附 sub-processor DPA 链接
- [ ] 端到端 retention 演练（创建 → 30 天 → grace → 7 天 → 物理删除 → 收到证明邮件）

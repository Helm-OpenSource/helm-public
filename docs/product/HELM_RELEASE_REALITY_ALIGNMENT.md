---
status: active
owner: helm-core
created: 2026-05-02
review_after: 2026-05-31
public_safety: Public-safe release-vs-reality alignment. Proven-capability statements only; no release-date promises, private receipts, or commitment-shaped claims.
archive_trigger:
  - v0.1.0-trial 发布完成并有新的 release retrospective
  - 本文件被正式 launch readiness checklist 替代
---

# Helm Release Reality Alignment / Helm 发布现实对齐

> **语言 / Language**: **中文主文本** + **English reference summary**

## English Reference Summary

This document closes the 2026-05-02 requirements audit into executable release
decisions. Public commitments must be reduced to what the current system and
operations can actually support; release hard gates must block uncontrolled
release paths; process-heavy requirements should be simplified; real customer
signals, degraded-mode experience, and extension boundaries must be handled
before broader public claims.

Key boundaries: `release:check` blocks on private owner receipts when they cannot
be machine-verified; manual tagging remains a human maintainer step; public
trial claims must not become production SLA, audit-replay, release-ready,
customer-deployment, or roadmap commitments.

本文件把 2026-05-02 的需求审计收口为可执行决策：公开承诺必须降到当前系统和运营能兑现的范围；发布硬门禁必须阻断不可控发布；过程型需求必须减负；真实客户、降级体验和扩展边界必须前置。

## 一、公开承诺收口

### 1. 数据保留

结论：公开入口不再写死“30 天 active + 7 天 grace + 物理删除”为承诺。

执行口径：

- README / SECURITY / runbook 只能写“按工作区试用契约与生效数据政策执行”。
- `30/7` 继续作为当前目标草案保留在法律政策草案中。
- 法务最终确认前，不允许在销售文案、README、发布公告中把 `30/7` 写成承诺。

### 2. 数字承诺

结论：吞吐指标必须改成“试点目标 + 质量门”。

保留的目标：

- 1 个工作日首次答复
- 7 天内首次 1:1
- 5 分钟第一张判断卡
- 90 秒会议候选提取
- 10 分钟 CRM 到 Must Push 候选
- 7 个工作日集成议题回复

新增质量门：

- Must Push accepted rate
- 48h follow-up completion
- manager review time
- wrong commitment incident
- audit trace coverage

### 3. Audit trace

结论：撤回“客户可见动作 → 审计 trace 0 秒，可在 `/memory` 回放”的公开承诺。

当前可说：

- 关键写路径必须写 `traceId / requestId / parentEventId`。
- operator 可基于 audit 数据排查。
- 统一用户可见审计时间线是发布硬门禁，未落地前不宣传“0 秒回放”。

### 4. Integration roadmap

结论：P0/P1/P2 30+ 系统收缩为首批 5 个入口。

P0 只保留：

- 飞书 / Lark
- Microsoft 365
- Google Workspace
- Slack
- Zoom

其它系统进入议题驱动候选池。回复议题不等于排期，不等于承诺会做。

## 二、发布硬门禁

`npm run release:check` 必须阻断以下未完成项：

- RDS 凭据轮换已完成。
- 密钥历史已正式修复，或公开镜像已验证无受损密钥。
- Docker 冒烟已在可用 Docker 主机跑通。
- 值守 / 响应政策已由负责人批准。
- 审计轨迹公开姿态为 `claim_withdrawn` 或 `visualization_ready`。
- 必要复核人批准记录已存在。
- Redacted live DB calibration report 已存在。

如果无法自动验证，必须通过环境变量显式确认，并在发布证据中保留回执。

当前 `release:check` 人工回执环境变量为：

- `RELEASE_READINESS_CREDENTIAL_ROTATED`
- `RELEASE_READINESS_SECRET_HISTORY_REMEDIATED`
- `RELEASE_READINESS_DOCKER_SMOKE_PASSED`
- `RELEASE_READINESS_ONCALL_RESPONSE_POLICY_READY`
- `RELEASE_READINESS_AUDIT_TRACE_PUBLIC_POSTURE`
- `RELEASE_READINESS_REVIEWER_APPROVAL_RECORD_ID`
- `RELEASE_READINESS_CALIBRATION_REPORT`

`release:check` 还会打印只读人工打标签策略。该策略不新增第 8 个人工
回执，也不创建发布；它用于防止在仓库已有更高稳定标签时，把试点
发布误发布为 Latest。

默认目标仍是首个公开试点标签 `v0.1.0-trial`。后续发布列车必须在发布
机器上显式设置：

- `HELM_RELEASE_CHANNEL=trial|stable`
- `HELM_RELEASE_TARGET_TAG=<tag>`
- `HELM_RELEASE_TARGET_TITLE=<release title>`

`trial` channel 只能按预发布 + `--latest=false` 执行。`stable` channel 必须使用
稳定语义化版本标签（例如 `v1.0.1`），并且必须高于现有最高稳定标签；否则门禁
只报告阻断项，不打印手动标签 / 发布命令。

> **发布日决策门**见 [`HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md`](./HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md) §六 "Go/No-Go Evidence Checklist"。本节定义发布硬门禁**输入约束**，§六 定义负责人发布日的 6 项**必备证据 + Go/No-Go 决策记录格式**。两者不重复：本节是 `release:check` 命令的阻断口径，§六 是人工签核流程。

## 三、需求减负决策

### 1. OPC dogfood 链

现状：创始人内部门禁、内部自用包、复核记录、创始人决策、运行报告、Phase 3V 演练分别成立，但整体仍是内部自验证链。

决策：

- 不再把每个环节单独作为“已完整成立”的业务能力宣传。
- 合并方向为两个工件：`packet-generator` 与 `rehearsal-runner`。
- 未接入真实客户或隔离 DB 校准前，整体只能算“已成形但仍需下一层”。

### 2. 过程报告

现状：`docs/product` 下大量 baseline / alignment / contract report 是历史审计回执，不是现役需求。

决策：

- 保留能被边界 / 自检直接消费的标记。
- 其它过程报告进入 archive plan，不再作为 README / docs top path 推荐入口。
- 不允许为了归档而削弱守卫；先建注册表，再归档。

### 3. 英文文档

现状：中英文双线造成 drift。

决策：

- 保留 `README.en.md`、`SECURITY.en.md`、`CONTRIBUTING.en.md` 作为开源入口。
- 深层治理、产品和复核文档默认中文。
- 若英文副本不再维护，应归档或改成指向中文源的导航页，不保留过时镜像。

### 4. Offline eval 优先级

保留 P0 / P1：

- Object / Signal validity
- External Agent Intake
- LLM context audit

降为维护态，等真实流量后再升级：

- self-improvement loop
- audience-aware projection
- broad Business Advancement signal pipeline

## 四、真实缺口

### 1. Design Partner P0

第一个 ≥¥30k design partner 是 Pack A 和 Phase 3 的真实外部信号。

进入公开试点前的最低目标：

- 8-10 通候选验证电话完成。
- ≥3 个候选愿意谈 ≥¥30k paid pilot。
- 选出 Top 1 + backup。
- Week 0 合同 / DPA / 数据清单 / 复核节奏就绪。

### 2. Degraded-mode health surface

当前已新增 `/health` 公开只读面，集中显示 DB / LLM / 连接器 / 采集 / 审计轨迹的降级姿态。它不是可用性服务等级协议，也不暴露租户级连接器计数。

下一层需要登录后的 workspace-scoped drill-down：

- connector unavailable
- LLM unavailable / fallback to rules
- DB unavailable / stale data
- capture / transcript failure
- audit trace write failure

这不是 observability platform，而是试点信任面：出错时用户必须知道 Helm 降级了什么、没有编造什么、下一步该找谁。

### 3. Extension seam

当前 `lib/extensions/registry.tsx` 不是第三方插件运行时。

正式口径：

- 它是一方 / 私有租户扩展接缝。
- 不提供 sandbox。
- 不支持第三方市场。
- 不承诺隔离执行或不受信代码加载。
- 如果真实第二租户需要可插拔第三方扩展，再单独评审沙箱 / 进程隔离 / 签名 / 能力清单。

## 五、四档登记

| 类别 | 档位 | 说明 |
| --- | --- | --- |
| 公开承诺收口 | 已成形但仍需下一层 | README / 公开文档已降级；仍需发布公告 / 销售文案同步 |
| 发布硬门禁 | 已成形但仍需下一层 | `release:check` 已增强；7 个私有负责人回执只通过环境变量 / 回执保存，不写入公开文档；手动标签 / GitHub Release / 公告仍是独立外部动作 |
| OPC dogfood 合并 | 已成形但仍需下一层 | 方向已定；代码级合并未做 |
| 过程报告归档 | 已成形但仍需下一层 | 需要守卫注册表后再批量归档 |
| Design partner P0 | 风险项 | 真实候选与付费验证未完成 |
| Degraded-mode health surface | 已成形但仍需下一层 | `/health` 公开只读面已落地；workspace-scoped drill-down 未实现 |
| Extension seam 边界 | 已成形但仍需下一层 | 口径已收口；sandbox 仍刻意未做 |

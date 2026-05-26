---
status: active
owner: helm-core
created: 2026-05-02
review_after: 2026-05-31
archive_trigger:
  - v0.1.0-trial 发布完成并有新的 release retrospective
  - 本文件被正式 launch readiness checklist 替代
---

# Helm Release Reality Alignment

本文件把 2026-05-02 的需求审计收口为可执行决策：公开承诺必须降到当前系统和运营能兑现的范围；release hard gates 必须阻断不可控发布；过程型需求必须减负；真实客户、降级体验和 extension 边界必须前置。

## 一、公开承诺收口

### 1. 数据保留

结论：公开入口不再写死“30 天 active + 7 天 grace + 物理删除”为承诺。

执行口径：

- README / SECURITY / runbook 只能写“按工作区试用契约与生效数据政策执行”。
- `30/7` 继续作为当前目标草案保留在 legal policy draft 中。
- 法务最终确认前，不允许在 sales、README、launch post 中把 `30/7` 写成承诺。

### 2. 数字承诺

结论：吞吐指标必须改成“试点目标 + 质量门”。

保留的目标：

- 1 个工作日首次答复
- 7 天内首次 1:1
- 5 分钟第一张判断卡
- 90 秒会议候选提取
- 10 分钟 CRM 到 Must Push 候选
- 7 个工作日 integration issue 回复

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
- 统一用户可见 trace timeline 是 release hard gate，未落地前不宣传“0 秒回放”。

### 4. Integration roadmap

结论：P0/P1/P2 30+ 系统收缩为首批 5 个入口。

P0 只保留：

- 飞书 / Lark
- Microsoft 365
- Google Workspace
- Slack
- Zoom

其它系统进入 issue-driven candidate pool。回复 issue 不等于排期，不等于承诺会做。

## 二、Release Hard Gates

`npm run release:check` 必须阻断以下未完成项：

- RDS 凭据轮换已完成。
- secret history 已正式修复，或公开镜像已验证无 compromised secret。
- Docker smoke 已在可用 Docker 主机跑通。
- on-call / response policy 已 owner-approved。
- audit trace public posture 为 `claim_withdrawn` 或 `visualization_ready`。
- Required Reviewer approval record 已存在。
- Redacted live DB calibration report 已存在。

如果无法自动验证，必须通过环境变量显式确认，并在 release evidence 中保留 receipt。

> **发布日决策门**见 [`HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md`](./HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md) §六 "Go/No-Go Evidence Checklist"。本节定义 hard gates **输入约束**，§六 定义 owner 发布日的 6 项 **必备 evidence + Go/No-Go 决策记录格式**。两者不重复：本节是 `release:check` 命令的阻断口径，§六 是人工 sign-off 流程。

## 三、需求减负决策

### 1. OPC dogfood 链

现状：Founder internal gate、internal dogfood packet、review notes、founder decision、run report、Phase 3V rehearsal 分别成立，但整体仍是内部自验证链。

决策：

- 不再把每个环节单独作为“已完整成立”的业务能力宣传。
- 合并方向为两个工件：`packet-generator` 与 `rehearsal-runner`。
- 未接入真实客户或隔离 DB 校准前，整体只能算“已成形但仍需下一层”。

### 2. 过程报告

现状：`docs/product` 下大量 baseline / alignment / contract report 是历史审计回执，不是现役需求。

决策：

- 保留能被 boundary / self-check 直接消费的 marker。
- 其它过程报告进入 archive plan，不再作为 README / docs top path 推荐入口。
- 不允许为了归档而削弱 guard；先建 registry，再归档。

### 3. 英文文档

现状：中英文双线造成 drift。

决策：

- 保留 `README.en.md`、`SECURITY.en.md`、`CONTRIBUTING.en.md` 作为开源入口。
- 深层治理、产品和 review 文档默认中文。
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
- Week 0 合同 / DPA / 数据清单 / review 节奏就绪。

### 2. Degraded-mode health surface

当前已新增 `/health` 公开只读面，集中显示 DB / LLM / connectors / capture / audit trace 的降级姿态。它不是 uptime SLA，也不暴露租户级连接器计数。

下一层需要登录后的 workspace-scoped drill-down：

- connector unavailable
- LLM unavailable / fallback to rules
- DB unavailable / stale data
- capture / transcript failure
- audit trace write failure

这不是 observability platform，而是试点信任面：出错时用户必须知道 Helm 降级了什么、没有编造什么、下一步该找谁。

### 3. Extension seam

当前 `lib/extensions/registry.tsx` 不是第三方 plugin runtime。

正式口径：

- 它是 first-party / private tenant extension seam。
- 不提供 sandbox。
- 不支持第三方 marketplace。
- 不承诺隔离执行或 untrusted code loading。
- 如果真实第二租户需要可插拔第三方扩展，再单独评审 sandbox / process isolation / signing / capability manifest。

## 五、四档登记

| 类别 | 档位 | 说明 |
| --- | --- | --- |
| 公开承诺收口 | 已成形但仍需下一层 | README / public docs 已降级；仍需 launch post / sales copy 同步 |
| Release hard gates | 已成形但仍需下一层 | `release:check` 已增强；外部 receipt 仍待 owner |
| OPC dogfood 合并 | 已成形但仍需下一层 | 方向已定；代码级合并未做 |
| 过程报告归档 | 已成形但仍需下一层 | 需要 guard registry 后再批量归档 |
| Design partner P0 | 风险项 | 真实候选与付费验证未完成 |
| Degraded-mode health surface | 已成形但仍需下一层 | `/health` 公开只读面已落地；workspace-scoped drill-down 未实现 |
| Extension seam 边界 | 已成形但仍需下一层 | 口径已收口；sandbox 仍刻意未做 |

> **语言 / Language**：**中文** · [English](SECURITY.en.md)

# Security Policy

Helm 当前明确处于「受控试点」阶段。这份文档说明：

1. Helm 当前的安全姿态边界
2. 漏洞披露的私下渠道与时间承诺
3. 哪些类型的问题不在本仓库受理范围
4. 公开试用环境的额外说明

---

## 1. 当前安全姿态边界

请在提交报告或开始安全审计前先确认以下边界：

### 1.1 受控试点，不是生产级企业平台

- **认证**：当前是数据库支持的会话认证，不是完整生产级 SSO / SCIM
- **多租户隔离**：基于 workspace + membership，未通过完整企业级多组织隔离审计
- **plugin runtime**：当前**没有真正的 sandbox**；扩展运行在与主进程相同的信任域内
- **审计完整性**：`AuditLog` 行覆盖关键写路径，并强制带 `traceId / requestId / parentEventId` 三个关联列；当前可供 operator 复核与索引排查，统一用户可见 trace timeline 仍是 release hard gate；这不构成不可篡改 / append-only 的合规级审计系统

如果你期待企业 SSO、完整 SCIM、不可变审计、租户级 KMS、独立 plugin sandbox，这些当前都不在仓库内，对应能力请在 issue 中讨论是否纳入路线图。

### 1.2 默认无自动写权限 / 自动发送权限

Helm 默认**不**对外部系统自动写入或自动发送：

- 没有自动审批
- 没有自动发邮件 / 发钉钉 / 发企微 / 发短信
- 没有自动结算 / 自动付款
- 没有跨 workspace 自动聚合或自动晋升

任何看似启用了上述能力的代码路径都应被视为缺陷或越权，欢迎报告。

### 1.3 中国市场与公开试用环境

公开试用环境（Cloud Trial）部署在阿里云 cn-hangzhou：

- RDS MySQL / ECS / OSS / SLS / DirectMail（默认启用）
- OpenAI API（默认关闭，启用前显式同意）
- 支付能力（公开试用默认关闭）

数据保留期与 sub-processor 详细说明以工作区契约和生效数据政策为准；当前草案见 [docs/legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md](docs/legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md)，发布前仍需法务最终对齐。

---

## 2. 漏洞披露流程

### 2.1 不要在公开渠道披露

请**不要**通过以下方式报告未公开的安全漏洞：

- 公开 GitHub issue
- 公开 GitHub Discussion
- 公开 PR
- 社交媒体

### 2.2 私下披露渠道

请通过以下私下渠道之一报告：

- **Email**：`security@helm.run`（首选）
- **加密**：如需 PGP，请在邮件中说明，我们会回复 public key

报告中请尽量包含：

- **复现步骤**：最小可复现路径，包含版本（commit hash、release tag 或部署 URL）
- **影响评估**：你认为的严重等级与受影响的资产/数据
- **PoC**：可选，但有助于验证
- **建议修复方向**：可选

### 2.3 我们的响应时间承诺

| 阶段 | 时间窗 |
| --- | --- |
| 收到报告确认 | 3 个工作日内 |
| 初步评估与严重等级判定 | 7 个工作日内 |
| 修复或缓解措施 | 严重等级 P0/P1：30 日内；P2/P3：90 日内 |
| 协调披露窗口 | 修复落地后协商，默认不超过 90 日 |

如果 30 日内我们没有给出实质响应，欢迎再次联系或在公开渠道发起询问（**仅限**未披露细节的形式）。

### 2.4 致谢

经报告者同意，我们会在 [CHANGELOG.md](CHANGELOG.md) 与 release notes 中致谢。如果你希望匿名，请在报告中说明。

---

## 3. 受理范围

### 3.1 受理

- 认证与会话管理缺陷
- 权限提升 / workspace 越界访问
- SQL 注入、命令注入、SSRF、XSS、CSRF
- 敏感数据泄漏（包括 secret in logs / response）
- 反序列化与不安全的输入处理
- 公开试用环境的隔离失败
- CI / CD pipeline 与 supply chain 风险
- 依赖包的已知 CVE 影响（请引用 CVE 编号）

### 3.2 默认不受理

以下类型的报告默认不构成有效漏洞，除非附带可执行的影响场景：

- 未启用配置下的「理论」风险（如 `OPENAI_API_KEY` 未设置时的 placeholder）
- 自动化扫描器输出的低置信度告警
- 缺失安全 header 但没有可执行攻击路径
- 受控试点已知边界（plugin sandbox 缺位、SSO 不完整等，见 §1）
- DDoS / 容量耗尽（受控试点不承诺 SLA）
- 社工攻击 / 钓鱼
- 物理攻击

如果你不确定是否在受理范围内，欢迎先以低保密的方式简要描述，我们会判断后回复。

---

## 4. 公开试用环境的额外说明

公开试用使用者请额外注意：

- 试用期内不要提交真实生产数据；试用环境**不承诺 SLA**
- 数据保留期以工作区契约和生效数据政策为准；30/7 仍是待法务确认的公开试点目标草案
- 删除请求、撤回窗口、物理删除和删除证明以生效数据政策为准

如果你在公开试用环境中观察到疑似越权行为，请同样通过 §2.2 渠道报告。

---

## 5. 安全相关的常规保障

我们持续投入的常规安全实践（不构成承诺，仅作披露）：

- `npm audit` / `gh dependabot` 月度跑批与 P0/P1 修复
- 每次 release 前跑 security review 与回归链
- `scripts/decision-first-boundary-check.ts` 守卫建议/承诺边界与租户 slug 反向边界
- `scripts/public-release-guard.ts` 守卫公开发布前的关键文件（含已知泄露凭据 SHA-256 deny-list）
- `lib/audit/trace-context.ts` 提供 AsyncLocalStorage 关联 ID；关键写路径必须携带 `traceId`，统一用户可见 trace timeline 未落地前不宣传“0 秒可回放”
- DingTalk Directory 邀请等客户可见 connector 路径默认 dryRun，并要求显式 `confirmation { confirmedByUserId, confirmedAt, sourcePage }` 才能 live send
- 关键路径下的代码评审与最小权限原则
- 默认不收集与运营无关的遥测

---

## 6. 致研究人员

我们欢迎安全研究人员对 Helm 进行合规的安全测试。请遵守：

- **不要**在生产或公开试用环境进行破坏性测试或大规模扫描
- **不要**访问、下载、修改、删除其他 workspace 的数据
- **不要**在未取得明确授权的情况下对其他用户做社工
- **不要**违反所在司法管辖区的法律

在合规范围内的研究，我们承诺不寻求法律追责。

---

## 7. License 与归属

本文件随仓库以 [Apache-2.0](LICENSE) 发布。

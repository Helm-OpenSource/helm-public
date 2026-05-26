---
status: planning
owner: helm-core
created: 2026-04-28
review_after: 2026-05-28
archive_trigger:
  - HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_IMPLEMENTATION_REPORT 落地并完成 docs/README.md 索引切换后 30 天归档
  - 2026-07-31 之后若没有任何 release readiness report 或 commercial package 文档引用本文件则归档
---

# Helm Open Source Commercial Boundary Plan

## 0. 2026-05-18 与 1-pager 根定位对齐说明

自 [`docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md`](../positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md) V1 落地起，本文件与根定位**整体一致**（开源 = 采用引擎 / 标准层 / 伙伴生态入口；商业收入 = Helm Cloud / Enterprise / Certified / Partner Delivery），需要补两个细化口径：

1. **Helm Inc. 不再 SaaS 直销给端客户**——下方 §1 "商业收入继续来自" 列表中的 `custom implementation` 和 `partner delivery` 默认**由 Certified Delivery Partner 交付**，不是 Helm Inc. 直营。Helm Inc. 提供认证、培训、品牌背书、工具链支持，但不直接和交付工程师争抢客户落地业务。
2. **`v0.1.0-trial` 公开镜像必须含 `extensions/case-management-sample/`** 作为脱敏 vertical 参考实现，这是 §5 "开源范围 / Demo assets" 一行的实物承接；spec 见 [`docs/_planning/CASE_MANAGEMENT_SAMPLE_EXTRACTION_SPEC_V1.md`](../_planning/CASE_MANAGEMENT_SAMPLE_EXTRACTION_SPEC_V1.md)。

本节为补丁说明；§1–§7 主体内容不动。下次本文件正式 revision（≥ V2）时把这些补丁折叠回 §1 与 §6。

**2026-05-18 二次补丁**：

3. **Grandfathered direct pilot 政策**：2026-05-18 GTM 切换前已落地的受控试点客户（Guangpu 等）作为**特殊历史安排**继续保留 Helm Inc. 直营关系，**不复用为未来商业模式**。详见 [`docs/internal/HELM_GRANDFATHERED_DIRECT_PILOTS_POLICY_V1.md`](../internal/HELM_GRANDFATHERED_DIRECT_PILOTS_POLICY_V1.md)（internal-only）。任何 2026-05-19 之后的新客户机会一律走 Certified DP / Helm Cloud / Helm Enterprise，**不接直营**。
4. **`docs/sales/GUANGPU_*` 待重定位**：origin/main 上存在的 `docs/sales/GUANGPU_OUTWARD_POSITIONING_V1.md` / `GUANGPU_PILOT_DELIVERY_PLAN_V1.md` / `GUANGPU_ONE_PAGER_CN_V1.md` 等是 grandfathered 客户的销售材料，按 §0.3 应为 internal-only。计划独立 PR off origin/main 移到 `docs/internal/sales/`。

---

## 1. 结论

Helm 按 Apache-2.0 开源是正确方向，但开源本身不是 Helm 的主要商业模式。

Helm 应把开源定义为：

**采用引擎 + 标准层 + 伙伴生态入口。**

商业收入继续来自：

- Helm Cloud
- Helm Enterprise
- certified workflow packs
- official connectors
- audit / compliance / observability
- custom implementation
- partner delivery
- enterprise support / SLA

因此，本计划冻结一条商业边界：

**Apache-2.0 开源 v2 core，用 object / memory / artifact / approval 成为可采用标准；商业化托管运行、企业连接器、认证生态、行业 workflow pack 和持续运营能力。**

## 2. 适用范围

本文件服务四件事：

1. 约束 `v0.1.0-trial` 开源镜像边界。
2. 约束 Helm Cloud / Enterprise 的商业版边界。
3. 约束伙伴生态、Certified 体系和 commercial workflow pack 的包装方式。
4. 给后续 ROADMAP / GOVERNANCE / trademark / partner program 提供产品输入。

本文件不是法律意见，不替代正式商标注册、开源合规审查、贡献协议评审或客户合同。

## 3. 外部许可锚点

当前 repo 已落地 Apache-2.0 license。基于 Apache Software Foundation 的公开材料，产品和商业设计应保留以下运营约束：

| 主题 | 运营含义 |
| --- | --- |
| Apache-2.0 可被第三方使用、复制、修改和再分发 | Helm 不能把“代码不可见”作为护城河 |
| Apache-2.0 包含专利授权机制 | 对企业、开发者和系统集成商更友好 |
| Apache-2.0 不自动授予商标权 | 需要保护 `Helm Official / Helm Cloud / Helm Enterprise / Helm Certified` 的品牌边界 |
| NOTICE / attribution 需要保留 | 公开镜像和二进制分发必须保持 license hygiene |

参考：

- Apache License 2.0: <https://www.apache.org/licenses/LICENSE-2.0.html>
- ASF Applying the Apache License 2.0: <https://www.apache.org/legal/apply-license>
- ASF Trademark Policy: <https://www.apache.org/foundation/marks/>

## 4. 开源版定位

开源版的目标不是直接收费，而是：

1. 降低企业技术评审和安全评审的信任门槛。
2. 让开发者、集成商和云厂商看懂 Helm 的核心方法。
3. 推动 Helm 的 object / memory / artifact / approval 成为事实标准。
4. 给伙伴二开、connector、workflow pack 和私有化评估提供共同底座。

开源版应被命名为：

**Helm Core**

它回答：

> Helm 的经营运行时方法是否可信、可看、可本地跑、可被伙伴学习和扩展？

它不回答：

> 企业生产环境谁负责、谁运维、谁保证连接器、谁提供审计导出、谁承担 SLA、谁交付业务结果？

## 5. 开源范围

建议 Apache-2.0 开源以下能力：

| 类别 | 开源内容 | 目的 |
| --- | --- | --- |
| Core contracts | Object Graph / MemoryItem / ArtifactBundle / Approval Matrix / event flow contract | 建立标准层 |
| Local runtime | 本地 controlled-trial runtime、demo app、basic worker runner | 支持开发者和技术评审 |
| Basic workers | Meeting-to-Action basic worker、draft-only comms basic worker、Opportunity Judge basic shadow runtime | 展示闭环，不交付商业 workflow pack |
| Eval harness | 基础 deterministic eval、boundary regression、sample fixtures | 证明 recommendation / commitment 边界 |
| Connector SDK | 只读 connector SDK、provider contract、policy guard SDK | 帮伙伴做 read-first 接入 |
| Documentation | architecture、quickstart、playbooks、contribution、security policy、public roadmap | 降低采用门槛 |
| Demo assets | 纯虚构 demo seed、90 秒 demo、sample app | 让外部读者快速理解 |

## 6. 商业版保留范围

以下能力应作为 Helm Cloud / Enterprise / Custom / Partner Delivery 的商业收入层：

| 类别 | 商业内容 | 价值 |
| --- | --- | --- |
| Helm Cloud control plane | 托管 workspace、升级、备份、环境治理 | 客户不用自建和运维 |
| Enterprise management | 企业多租户管理、org admin、SSO / RBAC、私有化部署支持 | 进入企业采购 |
| Official connectors | 飞书 / 钉钉 / 企业微信 / CRM certified connectors | 解决真实企业接入 |
| Production official integration | official write guard、ack / reconciliation、exception follow-through 的生产级路径 | 让高风险写入可治理 |
| Audit / compliance | 高级 audit export、retention export、access evidence、review evidence | 支撑安全与合规评审 |
| Managed eval | 托管 eval service、regression watch、customer-specific eval reporting | 持续证明不漂移 |
| Enterprise observability | cost / model / runtime / connector / review queue observability | 运营可见 |
| Sensitive data guard | PII / secret / prompt injection / data boundary guard | 降低企业风险 |
| Certified workflow packs | Meeting-to-Action、Revenue Operating Loop、CS Handoff、Governed CRM-CS Loop 的认证包 | 收 workflow pack 价值 |
| Custom implementation | 对象建模、流程映射、系统接入、客户成功联运 | 收项目和联运服务 |
| Partner delivery | partner enablement、交付认证、项目协同、proof contribution | 放大交付半径 |

## 7. 暂缓开源范围

以下内容不应在第一阶段 Apache-2.0 开出，或必须先经单独 release review：

- 生产级 CRM official write adapter 完整实现
- 客户级 eval goldens
- 商业 workflow pack 的行业模板和调参细节
- 付费 connector 的生产适配细节
- 真实行业 playbook
- 销售与客户成功自动化规则
- 云端运行、计费、套餐和 entitlement 逻辑
- 客户 proof pack 原始样本
- 伙伴交易、应计、结算与商业分成规则

原则：

**开源标准层和本地运行时，保留生产级企业运行能力、真实客户 proof、行业 know-how 和商业分发网络。**

## 8. 商业包装

开源之后，定价锚点不应从 seat 或 token 开始，而应从运行可信度和业务闭环开始。

### 8.1 Open Source

- 免费
- 本地运行
- 核心协议和基础 worker
- 基础 eval
- 只读 connector SDK

目标：开发者采用、技术评审、伙伴学习。

### 8.2 Helm Cloud Team

- ¥199/月/组织
- 小团队托管体验
- 基础 meeting-to-action
- 无复杂企业承诺

目标：降低试用和口碑传播门槛。

### 8.3 Helm Business

- ¥2,980/月起
- 托管 workspace
- 基础连接器
- Meeting-to-Action
- Draft-only comms
- Opportunity Judge

目标：把开源采用转成标准付费团队。

### 8.4 Helm Growth / Revenue OS

- ¥9,800 到 ¥29,800/月
- Revenue Operating Loop
- CS Handoff
- manager attention
- advanced audit
- official write guard candidate / review packet

目标：收 workflow pack 和经营结果价值。

### 8.5 Helm Enterprise

- ¥200,000/年起
- SSO / RBAC / 私有化
- official integration
- 审计导出
- SLA / support
- 专属 connector

目标：承接企业安全、合规、运维和正式采购。

### 8.6 Custom / Partner Implementation

- ¥80,000 到 ¥300,000 一次性实施费
- ¥20,000 到 ¥100,000/月联运费
- partner delivery 可单独报价

目标：把 Helm 接进客户真实经营系统，并沉淀 proof / workflow pack / certified partner。

## 9. GTM 影响

开源后，Helm GTM 应从“卖软件”变成三段式：

### 9.1 第一段：开源获取信任和开发者

目标：

- GitHub star
- 技术社区传播
- 开发者试用
- 集成伙伴熟悉
- 企业技术负责人评估

内容重点：

- v2 architecture
- meeting-to-action demo
- shadow / official safety
- artifact-first runtime
- approval / audit
- eval harness

### 9.2 第二段：商业版承接企业需求

当开源用户进入真实企业使用，会遇到：

- 部署
- 权限
- 审计
- 连接器
- 可靠性
- 运维
- 数据边界
- SLA

这些由 Helm Cloud / Enterprise 承接。

### 9.3 第三段：伙伴交付扩大市场

伙伴基于开源 Helm 学会方法，客户为 Helm Enterprise 和 Custom / Partner Delivery 付费。

第一阶段不做 partner marketplace。伙伴能力先进入 reserved-only partner delivery workspace 和 certified program planning。

## 10. Certified 体系

Helm 需要建立官方认证体系，避免开源生态失控并保留商业主导权。

建议四类认证：

| 认证 | 含义 | 商业作用 |
| --- | --- | --- |
| Certified Connector | 通过 provider contract、security checklist、read/write boundary 和 regression eval | 让客户愿意为官方连接器付费 |
| Certified Workflow Pack | 通过 proof pack、eval、review boundary 和 customer outcome evidence | 让 workflow pack 有定价权 |
| Certified Partner | 通过交付能力、客户成功、数据安全和边界培训 | 放大交付网络 |
| Certified Deployment | 通过部署、安全、备份、审计和升级检查 | 支撑私有化和企业采购 |

认证不等于 marketplace，也不等于自动结算。

第一版只需要 docs + checklist + manual review，不做认证平台。

## 11. 品牌与商标边界

Apache-2.0 不自动授予商标权，因此 Helm 应尽快建立以下品牌边界：

- `Helm`
- `Helm Core`
- `Helm Cloud`
- `Helm Enterprise`
- `Helm Official`
- `Helm Certified`

运营规则：

1. fork 可以使用 Apache-2.0 代码，但不得暗示自己是 Helm Official。
2. 第三方 connector / workflow pack 不得默认标记为 certified。
3. partner 不得在未签署协议前声称官方合作或官方背书。
4. 对外材料必须区分 open-source compatibility、official certification 和 paid enterprise support。

后续应由法务或 owner 决定商标注册、品牌指南、domain policy 和 certified mark 使用条款。

## 12. 治理建议

决定开源后，必须补齐或明确以下治理资产：

| 治理资产 | 当前建议 |
| --- | --- |
| `GOVERNANCE.md` | 定义 maintainer 权限、issue/PR 处理、scope control、release decision |
| DCO / CLA | 至少选择一种贡献权利确认机制 |
| `ROADMAP.md` | 当前已有 public roadmap；后续需要补开源版 vs 商业版边界 |
| `SECURITY.md` | 已存在；后续补 threat model / disclosure drill / dependency scanning 节奏 |
| trademark guide | 新增，约束 Helm Official / Certified 使用 |
| certification checklist | 新增，connector / workflow pack / partner / deployment 四类 |
| release guard | 已有 `check:public-release`；后续补 commercial/private asset allowlist |

## 13. 与 ArkClaw / 平台型产品的关系

Helm 不应把 ArkClaw、百炼、扣子、钉钉、腾讯元器等平台型路线视为必须正面对抗。

更稳的定位是：

| 维度 | 平台型产品更像 | Helm 开源后应更像 |
| --- | --- | --- |
| 主要入口 | 企业 AI / Agent / Skills / 模型与协作平台 | 客户会议后的经营闭环运行时 |
| 商业锚点 | 资源坐席、模型能力、企业协作基础设施 | 托管运行、连接器、workflow pack、审计、交付结果 |
| 开源价值 | 平台生态扩展 | 经营对象和行动审计标准 |
| 商业护城河 | 平台广度和云资源 | 场景深度、proof、official connectors、enterprise operation |

一句话：

**平台型产品卖企业 AI 基础设施，Helm 卖可审计的客户经营闭环。**

## 14. 90 天执行顺序

### 0-30 天：Open Source Core

输出：

- Apache-2.0 public repo
- cleaned README / docs / sample data
- core contracts
- local runtime
- basic workers
- eval harness
- connector SDK
- public release guard

目标：

- 建立技术可信度
- 获取开发者和伙伴
- 支撑客户技术评审

### 31-60 天：Cloud / Enterprise Conversion

输出：

- Helm Cloud trial
- Business / Growth / Enterprise packaging
- pilot workspace mode
- proof pack builder
- first official connector candidates
- enterprise support motion

目标：

- 把开源采用转成付费试点
- 让 proof 成为销售材料来源

### 61-90 天：Certified Ecosystem

输出：

- Certified Connector checklist
- Certified Workflow Pack checklist
- Certified Partner checklist
- Certified Deployment checklist
- partner delivery workspace planning prototype

目标：

- 让开源生态不失控
- 让商业版继续占据官方可信位置

## 15. 风险与控制

| 风险 | 控制方式 |
| --- | --- |
| 被 fork | 商标 / official / certified / cloud service / enterprise support |
| 被大厂吸收 | 保留 production connectors、goldens、workflow pack、proof network |
| 商业版边界不清 | 每个 feature 标注 open-source core / cloud / enterprise / custom |
| 社区维护成本上升 | GOVERNANCE.md + issue templates + maintainer scope |
| 客户自建导致付费转化下降 | Cloud / Enterprise 卖运维、连接器、审计、SLA 和交付结果 |
| 安全风险更显性 | threat model、SECURITY.md、secret scanning、dependency scanning、release guard |
| 伙伴误用品牌 | trademark guide、certified checklist、partner agreement |

## 16. 下一步

建议把本计划拆成 5 个具体执行项：

1. 新增 `GOVERNANCE.md`，固定开源项目治理和 scope control。
2. 新增 trademark / brand usage guide，固定 Official / Certified 边界。
3. 新增 open-core matrix，把每个能力标成 `open-core / cloud / enterprise / custom / deferred`。
4. 新增 Certified Connector / Workflow Pack / Partner / Deployment checklist。
5. 在 `check:public-release` 中补 private/commercial asset allowlist，防止 goldens、客户 proof、商业 workflow pack 泄漏到公开镜像。

## 17. 变更记录

| 日期 | 变化 |
| --- | --- |
| 2026-04-28 | 首版，冻结 Apache-2.0 open core + commercial runtime + partner delivery 的商业边界 |

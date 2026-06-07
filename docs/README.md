---
status: active
owner: helm-core
created: 2026-06-01
review_after: 2026-07-01
public_safety: Curated public Core docs index. Do not add broad mirror carry-over docs without updating docs/public-docs-manifest.json and passing check:public-docs.
---
# Helm Public Docs

> **语言 / Language**: **中文主文本** + **English reference**

本目录是 `helm-public` 的公开文档入口。它服务于中国市场和英文社区，
但只承接 Apache-2.0 公开 Core、基础 SDK、样板 Pack、公开测试、
Docker 快速启动与公开治理文档。

This directory is the curated documentation surface for `helm-public`. It serves
China-market readers and English-speaking contributors, but it only carries
Apache-2.0 public Core, the base SDK, sample packs, public tests, Docker
quickstart, and public governance docs.

公开文档面必须刻意保持小而可审计。私有源仓库里的规划、复核、商业、
客户交付和迁移材料不属于本仓。所有 `docs/` 文件必须显式列入
[public-docs-manifest.json](public-docs-manifest.json)；新增文档未列入时，
`npm run check:public-docs` 会失败。

The public docs surface is intentionally small and reviewable. Planning, review,
commercial, customer-delivery, and migration documents from private repositories
do not belong here. Every `docs/` file must be explicitly listed in
[public-docs-manifest.json](public-docs-manifest.json); `npm run
check:public-docs` fails when a new doc appears without that review.

交付工程师优先阅读：公开文档应尽量直接说明检查 / 复刻 / 首次改动 /
验证命令 / 公开安全证据路径 / 边界。只翻译术语但不能指导首次改动证明的文档，
仍需下一层改造。

Delivery-engineer-first reading: public docs should make inspect / fork / first
change / verification commands / public-safe evidence route / boundary explicit.
Docs that only translate terms without guiding a first-change proof still need
the next layer.

当前 Golden Path 的单一 first proof 入口是 `npm run golden:path`，默认生成
`/tmp/helm-golden-path-proof` 本地证据包；它不是客户部署、发布 ready、
connector 授权、写回、外发或审批证明。

## 从这里开始 / Start Here

- [README](../README.md) / [README English](../README.en.md)
- [开发者上手指引 / Developer quickstart](getting-started.md) / [English](getting-started.en.md)
- [面向交付工程师的 Helm / Helm for delivery engineers](positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md) / [English](positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.en.md)
- [交付工程师黄金路径要求 / Delivery engineer Golden Path requirements](product/HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md)
- [交付工程师初始化诊断要求 / Delivery engineer setup diagnostic requirements](product/HELM_DELIVERY_ENGINEER_SETUP_DIAGNOSTIC_REQUIREMENTS.md)
- [数据接入体验 / Data intake experience](product/HELM_DATA_INTAKE_EXPERIENCE.md)
- [经营信号首公里 15 分钟跑通 / Signal First Mile quickstart](product/HELM_SIGNAL_FIRST_MILE_QUICKSTART.md)
- [公开路线图 / Public roadmap](roadmap/HELM_PUBLIC_ROADMAP.md)

## 公开契约 / Public Contracts

- [AI 推荐治理契约 / AI recommendation governance](product/HELM_AI_RECOMMENDATION_GOVERNANCE.md)
- [诊断与自动化证据层要求 / Diagnostic automation evidence layer requirements](product/HELM_DIAGNOSTIC_AUTOMATION_EVIDENCE_LAYER_REQUIREMENTS.md)
- [智能体化实施工程治理需求 / Agentic implementation engineering governance requirements](product/HELM_AGENTIC_GOVERNANCE_REQUIREMENTS.md)
- [外部智能体输入 PRD / External agent intake PRD](product/HELM_EXTERNAL_AGENT_INTAKE_PRD.md)
- [LLM 智能深化 v1 / LLM intelligence deepening v1](product/HELM_LLM_INTELLIGENCE_DEEPENING_V1.md)
- [LLM 智能深化 v2 / LLM intelligence deepening v2](product/HELM_LLM_INTELLIGENCE_DEEPENING_V2.md)
- [开源与商业边界 / Open source and commercial boundary](product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md)
- [开源与 Cloud trial 发布姿态 / Open source and cloud trial launch posture](product/HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md)
- [发布现实对齐 / Release reality alignment](product/HELM_RELEASE_REALITY_ALIGNMENT.md)
- [认证生态清单 / Certified ecosystem checklist](product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md)
- [交付工程师黄金路径要求 / Delivery engineer Golden Path requirements](product/HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md)
- [交付工程师初始化诊断要求 / Delivery engineer setup diagnostic requirements](product/HELM_DELIVERY_ENGINEER_SETUP_DIAGNOSTIC_REQUIREMENTS.md)
- [数据接入体验 / Data intake experience](product/HELM_DATA_INTAKE_EXPERIENCE.md)
- [Solution extension 协议 / Solution extension protocol](product/HELM_SOLUTION_EXTENSION_PROTOCOL_V1.md)
- [扩展目录与命名协议 / Extension directory and naming protocol](product/HELM_MULTI_TENANT_EXTENSION_DIRECTORY_AND_NAMING_PROTOCOL_V1.md)
- [经营信号首公里方法 / Signal First Mile method](product/HELM_SIGNAL_FIRST_MILE_METHOD.md)
- [经营信号首公里 quickstart / Signal First Mile quickstart](product/HELM_SIGNAL_FIRST_MILE_QUICKSTART.md)
- [运营信号流图要求 / Operating signal flow map requirements](product/HELM_OPERATING_SIGNAL_FLOW_MAP_REQUIREMENTS.md)
- [专家能力反馈闭环 / Expert capability feedback loop](product/HELM_EXPERT_CAPABILITY_FEEDBACK_LOOP.md)

## 贡献与运营 / Contribution And Operations

- [集成模板 / Integration template](integrations/INTEGRATION_TEMPLATE.md)
- [公开双语化计划 / Public bilingualization plan](./_planning/HELM_PUBLIC_BILINGUALIZATION_PLAN.md)
- [开源运营模型 / Open source operating model](operations/HELM_PUBLIC_OPEN_SOURCE_OPERATING_MODEL_2026-06-02.md)
- [公开试点作业手册 / Public trial runbook](pilot/PUBLIC_TRIAL_RUNBOOK.md)
- [公开试点数据政策 / Public trial data policy](legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md)
- [试点响应与值守姿态 / Trial response and on-call posture](operations/ON_CALL_AND_RESPONSE_SLA.md)
- [公开发布节奏作业手册 / Public release train runbook](operations/HELM_PUBLIC_RELEASE_TRAIN_RUNBOOK.md)
- [公开维护者状态基线 / Public maintainer status baseline](operations/HELM_PUBLIC_MAINTAINER_STATUS_2026-06-02.md)
- [开源增长 7 日运营计划 / Open source growth 7-day operating plan](operations/HELM_OPEN_SOURCE_GROWTH_7_DAY_OPERATING_PLAN_2026-06-02.md)
- [OPC 周报包模板 / OPC weekly packet template](operations/HELM_OPC_WEEKLY_PACKET_TEMPLATE.md)
- [发布就绪回执清单 / Release readiness receipt checklist](operations/RELEASE_READINESS_RECEIPT_CHECKLIST.md)
- [中国访问性与证据路由包 / China accessibility and evidence routing packet](operations/HELM_CHINA_ACCESSIBILITY_AND_EVIDENCE_ROUTING_2026-06-02.md)
- [Agent 工作入口 / Agent working entry](codex/README.md)
- [状态真值表 / Status truth table](STATUS.md)

## 已选公开验证回执 / Selected Public Validation Receipts

- [AI-native enterprise AI artifact templates closeout](reviews/HELM_AI_NATIVE_B2B_ARTIFACT_TEMPLATES_CLOSEOUT.md)
- [D2 Docker fresh-clone smoke 回执 / D2 Docker fresh-clone smoke receipt](reviews/HELM_DELIVERY_ENGINEER_D2_SMOKE_2026-06-01.md)
- [Node fresh-clone smoke 回执 / Node fresh-clone smoke receipt](reviews/HELM_DELIVERY_ENGINEER_NODE_FRESH_CLONE_SMOKE_2026-06-01.md)

## 不属于本公开文档面 / Not In This Public Docs Surface

- 客户专属 overlay / Customer-specific overlays
- 商业 Pack 实现细节 / Commercial Pack implementation details
- 私有 review packet 与源仓大范围 closeout report / Private review packets and broad source-repo closeout reports
- 投资人、销售与私有 GTM 材料 / Investor, sales, and private GTM materials
- 密钥修复回执与私有部署证据 / Secret remediation receipts and private deployment evidence

这些材料属于私有仓库或私有 issue / PR 记录，不属于 `helm-public`。

Those materials belong in private repositories or private issue / PR records,
not in `helm-public`.

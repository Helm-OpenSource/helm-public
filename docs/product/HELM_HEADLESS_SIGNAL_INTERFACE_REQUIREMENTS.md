---
status: active
owner: Product / GTM / Delivery Engineering / Engineering
created: 2026-05-20
last_reviewed: 2026-05-20
review_after: 2026-06-03
claude_review: ../reviews/HELM_HEADLESS_SIGNAL_INTERFACE_CLAUDE_REVIEW.md
phase1_closeout: ../reviews/HELM_HEADLESS_SIGNAL_INTERFACE_PHASE1_OFFLINE_EVAL_CLOSEOUT_2026-05-20.md
archive_trigger:
  - 本需求被实际 Headless Signal Interface contract / eval / connector closeout 替代
  - Helm 放弃 delivery-engineer-facing / open-source-first 定位
  - 本需求被误扩展成完整 CRM、agent platform、workflow engine、hosted MCP 或自动执行平面
---

# Helm Headless Signal Interface Requirements

## 0. Helm thesis

Helm 的出发点不是 Salesforce Headless 360。Helm 的出发点是：

> 中国和跨境 B 端交付工程师每接一个客户，都在重复重写业务脚手架：业务对象、信号、复核、连接器、边界、演示数据、验收口径和回滚说明。通用 agent 平台告诉他"怎么搭"，但不告诉他"该搭什么、怎么不出事、怎么在 D2 smoke、sample pack、eval 和客户数据前置条件明确后，争取约 4 周交付首个受控客户"。

因此，Helm Headless Signal Interface 的竞争位不是 `Headless CRM`，也不是 `Agentforce / Agent Fabric` 的轻量版，而是：

> Helm 是给交付工程师的 Apache-2.0 可 fork 经营信号交付整机：把客户已有 CRM、IM、会议、表格、文档和外部 agent 输出，转成可复核的经营信号流、eval 边界和受控交付路径。

这句话里不可被稀释的差异化关键词是：

1. **Apache-2.0 / forkable**：交付工程师可以 fork、改 vertical、商用自营。
2. **open-core / 不抽成交付收入**：Helm Inc. 不和交付工程师抢客户，也不把交付商锁进平台分成。
3. **vertical reference implementation**：从 `extensions/case-management-sample/` 这种带电池的参考实现出发，不从空白 agent builder 出发。
4. **boundary encoded in eval gate**：AI 越权、自动外发、自动承诺、跨租户串数据必须能被 fixture / evaluator 机械拦住。
5. **中国本地化与 B 端现场友好**：钉钉、飞书、企业微信、邮箱、会议、Excel / 自建 CRM、销售易 / 纷享销客这类现场系统优先级不低于 Salesforce。
6. **4 周受控交付目标**：这是交付路径目标，不是当前已验证 SLA；必须以 D2 smoke、sample pack、eval 和客户数据前置条件证明。

Salesforce Headless 360 是一个重要外部信号：企业软件正在转向 agent-consumable surfaces。但它不是 Helm 的主要竞对，也不是 Helm 的产品议程设定者。HSI 只吸收一个判断：未来 Helm 也需要给交付工程师和本地工具提供稳定的 headless signal contract；不吸收 Salesforce 的 CRM-first / execution-first / platform-control-plane 路线。

当前本文件只授权需求、评审和后续 offline contract planning；不授权 API route、schema、runtime query、production connector adoption、MCP server、CLI command、official write、自动外发、自动审批、自动执行或 LLM final ranking。

## 1. Primary competitive frame

Helm 的主对照来自公开定位文档和 README，而不是 Salesforce 单点。

| 类别 | 代表 | 他们解决什么 | Helm 不抢什么 | Helm 必须占住什么 |
|---|---|---|---|---|
| AI agent 平台 | Coze / 扣子、阿里悟空、Dify | Bot / agent / workflow 怎么搭 | 不做 builder 平台、不做 Skill 市场 | 给交付工程师一套经营推进整机和行业 pack 起点 |
| LLM framework | LangGraph / LangChain | agent primitives、graph、tool runtime | 不做通用 SDK / orchestration | 把经营对象、信号、复核、边界和 eval 预先建好 |
| automation / workflow | n8n、Camunda、Temporal | 任务流、编排、重试、执行 | 不做通用 workflow engine | 把"什么该推进、谁复核、什么不能自动化"讲清楚 |
| CRM / BI / observability | Salesforce、HubSpot、Looker、Tableau、Datadog | system-of-record、报表、监控、执行平台 | 不替代 CRM / BI / observability | 横跨系统抽经营信号，并把它接到 review-first 闭环 |
| Helm | Apache-2.0 open-core + vertical pack | B 端经营推进交付脚手架 | 不直接卖 SaaS 抢交付商客户 | forkable、可验收、可复核、边界由 eval 固化 |

Salesforce 在本需求中的身份只有两个：

1. 一个可选的 enterprise source adapter。
2. 一个提醒我们不要忽视 headless / MCP / agent-consumable 形态的外部信号。

它不是 Phase 1 的 reference adapter，也不是 HSI 的默认 source。

## 2. Current repo truth

本需求必须继承当前仓库真值，不得把规划写成已成立。

1. `README.md` 与 `HELM_FOR_DELIVERY_ENGINEERS_V1.md` 已把目标受众改成 delivery engineers building on Coze / 悟空 / Dify / LangGraph / 通用 agent 平台。
2. Helm 的硬差异是 Apache-2.0、forkable、open-core 不抽成、vertical pack、eval gate、中文 connector、本地化与 review-first。
3. `extensions/case-management-sample/` 已是 minimum public reference：manifest、signal types、4 类 synthetic fixture、case mapper、worker cookbook、BI report cookbook 已落地。
4. `case-management-sample` 仍不是 production-ready vertical；Docker / fresh-clone onboarding smoke、full integration 和 optional extra mappers 仍 pending。
5. `eval:headless-signal-interface` 已作为 Phase 1 offline gate 落地；它只证明 pack manifest / facade type / boundary / non-scripted sequence 的离线契约，不授权 runtime、API、schema、production connector 或 hosted MCP。
6. 真实 public trial / production data / runtime adoption 仍受 redacted live calibration、Data Protection、Required Reviewer、rollback proof、audit completeness 和 boundary regression 约束。

**两条独立的"第一个"轨道，不要混读：**

- **第一个真实客户（production landing）**：某 founder-led grandfathered 直连试点租户（tenant-private），2026-05-20 已进入 landing / implementation。所属域是催收 / case management；HSI Phase 1 不为它写 public reference fixture，该 tenant-private 的具体租户内容不进 HSI default fixture、也不进 `case-management-sample`；任何会影响 tenant-private workspace 状态、信号、可见 artifact、外发渠道的改动按受控试点 + Required Reviewer 边界处理。
- **第一个完整行业 PACK（public reference）**：D002 美业，公开 / forkable / 行业级 reference。当前 `evals/headless-signal-interface/headless-signal-interface-cases.json` 里 `d002-beauty-vertical-placeholder` 是它的占位（`pendingOwnerTruth: true`）。Owner 真值到位后切换路径见 §10 Open Question 3：把占位 pack 替换为真包并去掉 `pendingOwnerTruth`，`case-management-sample` 退为 generic baseline / comparison pack。

这两条线**互不依赖**：tenant-private 客户落地不要求美业 PACK 先完成；美业 PACK 也不依赖任何 tenant-private 内容。客户域与 public reference 行业域是不同的产物形态。不得因为研究 Salesforce 而把工程量默认投向 Salesforce adapter。

## 3. Target users

| 用户 | 身份 | HSI 应帮助什么 | 不应混淆什么 |
|---|---|---|---|
| Delivery engineer adopter | fork Helm 给客户交付的人 | 从 sample pack 出发，把客户系统映射成 fixture、信号和 review packet | 不要求他理解 Salesforce / Agentforce 生态 |
| Pack contributor | 开源社区贡献者 | 提交 generic fixture、mapper、eval case 或文档补丁 | 不默认获得客户数据、生产凭据或 Certified DP 权益 |
| Certified Delivery Partner | 未来认证交付商 | 用 Helm 方法论和 gate 证明交付质量 | 不等于 Helm 官方背书客户结果或自动获得 marketplace 流量 |
| Customer manager / reviewer | 客户侧管理者 / 复核人 | 看懂信号流、阻塞、证据、禁止动作和复核入口 | 不看 tool catalog、MCP API、raw logs |
| Data Protection / Security reviewer | 审查数据和边界的人 | 看 redaction manifest、boundary incident、eval output、review packet | 不从 agent trace 里猜是否泄露 |

## 4. Product principles

1. **Fork first**：优先服务 `fork -> 改 slug -> 改 schema -> 跑 fixture -> 演示` 的交付路径。
2. **Pack before facade**：先把 delivery pack 的目录、fixture、eval、review packet 做实，再讨论 CLI / MCP facade。
3. **Signal first, action second**：先把经营信号、阻塞、证据、复核包投影清楚，再讨论动作。
4. **Review packet is not execution**：headless 表面可以准备 review packet，但 packet completion 不等于批准、发送、执行或写回。
5. **Local means delivery-engineer workstation**：Phase 2 的 local preview 只能跑在交付工程师本机 repo checkout 内；不得变成客户内网服务、员工本地 agent server、远程 tunnel 或 hosted MCP。
6. **Single-workspace by default**：所有投影默认 workspace-scoped；跨租户 / 跨 workspace 聚合默认 No-Go。
7. **Deterministic before LLM**：capability routing、highest-pressure path、boundary classification、allowed next surface 都先 deterministic；LLM 只做解释和压缩。
8. **Source-agnostic by default**：第一批 reference path 必须覆盖 non-Salesforce source；Salesforce 只能作为可选 source，不得成为默认实现牵引。

## 5. Delivery engineer workflow

HSI 的第一用户路径不是 agent 直接调 facade，而是交付工程师完成一条可验收交付循环：

```text
fork sample pack
  -> change tenant slug / displayName
  -> map source fields to synthetic or redacted fixtures
  -> run pack tests and eval gates
  -> inspect /operating + review packet output
  -> iterate on mapping and boundary failures
  -> package demo evidence for customer review
```

Phase 1 所有 contract、fixtures 和 eval 都必须服务这条路径。CLI / MCP / agent client 是后续消费形态，不是 Phase 1 的起点。

### HSI-01：Delivery Pack Contract

Phase 1 必须先把 pack contract 做成可写、可测、可审计的最小形态。每个 HSI pack 至少包含：

| Artifact | Phase 1 required fields / minimum |
|---|---|
| `pack.manifest` | `packId`、`displayName`、`verticalKind`、`sourceKinds[]`、`signalFamilies[]`、`reviewSurfaces[]`、`ownerRole`、`dataPosture`、`nonProductionOnly` |
| `fixtures/` | 至少覆盖 positive、empty、degraded、boundary、sensitive、duplicate_or_conflict、stale、owner_missing；所有样本默认 synthetic 或 redacted |
| `payload_examples/` | 每个 source 至少 1 个 input / output 示例；必须标注 `synthetic`、`redacted` 或 `alias_only` |
| `eval` | authority leak、raw / sensitive leak、cross-workspace、forbidden action、determinism、non-scripted sequence、review packet completeness |
| `review_packet_template` | evidence refs、risks、missing info、allowed next surface、forbidden actions、human reviewer requirement |
| `implementation_checklist` | source authorization、redaction owner、reviewer、rollback path、DPA / data policy posture、customer demo data posture |

Phase 1 不要求这些 artifact 的 runtime loader，也不要求 schema migration。它只要求 checked-in fixture、pure evaluator 和 docs contract 能证明 pack 形状。

首批 source-agnostic signal families：

| Family | 中文名 | Source-agnostic 描述 | Fixture hint |
|---|---|---|---|
| `commitment_missing` | 承诺缺口 | 会议、邮件、IM、CRM、表格或 agent output 中出现承诺，但未形成可复核跟进 | `commitment-missing-*` |
| `stage_or_status_stale` | 阶段 / 状态滞后 | 下游证据显示事项已变化，但系统状态长期未更新 | `status-stale-*` |
| `approval_blocked` | 复核 / 审批阻塞 | 报价、合同、折扣、交付、风险或客户确认等待 reviewer | `approval-blocked-*` |
| `owner_mismatch` | Owner 不一致 | CRM owner、会议 owner、交付 owner 或 reviewer 不一致 | `owner-mismatch-*` |
| `duplicate_or_conflict` | 重复 / 冲突证据 | 对象重复、证据冲突、同一事项多处不一致 | `duplicate-conflict-*` |
| `boundary_attempt` | 越权请求 | 用户、agent 或集成请求 silent write、auto-send、auto-approve、cross-workspace projection | `boundary-attempt-*` |

默认 Phase 1 reference source 从 `case-management-sample` 和至少一个 non-Salesforce source 开始：DingTalk、Feishu、WeCom、email、meeting transcript、Excel / CSV、自建 CRM 或外部 agent manual import 均可。若 owner 确认 D002 美业或其他 first vertical 优先，则该 vertical 成为 first reference pack，`case-management-sample` 退为 generic baseline。Salesforce 只能作为 optional fixture source。

### HSI-02：Source Adapter Posture

HSI 不设 `Salesforce Source Adapter Posture` 独立主线。所有 source adapter 共享同一 posture：

| Source kind | 例子 | Helm 应识别 | Helm 不应做 |
|---|---|---|---|
| IM / collaboration | DingTalk、Feishu、WeCom、Slack、Teams | 承诺、待复核、客户等待、owner 缺失 | 自动外发、自动拉群、自动邀请 |
| Meeting / transcript | 浏览器录音、外部 transcript、Zoom / 腾讯会议导入 | 会后承诺、blocked decision、证据缺口 | 保存未确认 raw transcript、自动生成正式纪要外发 |
| Email | Gmail、IMAP、阿里邮箱、Outlook | customer waiting、承诺缺口、风险提醒 | 自动发邮件、自动承诺 |
| CRM / sales system | HubSpot、Salesforce、销售易、纷享销客、自建 CRM、Excel | stage stale、owner mismatch、duplicate / conflict | 自动改 stage、自动 merge、silent CRM write |
| External agent output | Coze、Dify、LangGraph、n8n、OpenClaw、客户自建 agent | 作为 evidence candidate 或 boundary case | 直接升级 Must Push truth、memory active fact 或 official write |
| Vertical system | 美业 CRM、案件系统、米盾云、ERP | 行业对象信号、异常、复核缺口 | 把 tenant-private shape 提升为 Helm core schema |

`boundary_attempt` 在 Phase 1 只表示 Helm 捕捉到的输入侧越权请求或 fixture 中模拟的 unsafe request。检测第三方 agent 已经在客户系统里完成的历史越权写入，属于更高阶审计能力，必须另立需求。

### HSI-03：Headless Facade Contract

只有当 HSI-01 的 pack contract 和 eval 跑通后，才允许定义 facade。建议 future facade：

| Facade | 作用 | 权限 |
|---|---|---|
| `search_signal_capabilities` | 按 intent / source / signal family 查找当前 pack 支持的能力 | read-only |
| `get_signal_payload_example` | 返回脱敏 payload 示例、必填字段、边界字段、fixture id | read-only |
| `project_operating_signal_snapshot` | 从 fixture 或未来 read model 投影 Signal Flow snapshot | read-only |
| `prepare_review_packet` | 生成 review packet 草稿，包含 evidence refs、risks、missing info、allowed next surface | preparation-only |
| `explain_signal_boundary` | 解释为什么某动作被允许、降级或禁止 | read-only |

这组 facade 不复制 Salesforce Data 360 MCP 的 `search / payload_examples / execute`。Helm 可以借鉴 `search` 与 `payload example` 的上下文压缩方式，但刻意不提供 `execute`。Helm 的替代组合是：`project_operating_signal_snapshot`、`prepare_review_packet`、`explain_signal_boundary`。

Phase 1 facade 草案必须从现有 `data/` 查询聚合、`/operating` Signal Flow contract、Ask Helm evidence-grounded action packet 和 review-first surfaces 的当前 truth 投影出来；不得平行新建 schema、runtime query、production connector 或第二套 review packet 模型。

禁止 facade：

1. `execute_action`
2. `send_message`
3. `approve`
4. `write_crm_stage`
5. `create_contract`
6. `settle_payment`
7. `auto_assign_owner`
8. `promote_to_memory`

### HSI-04：Preparation-only and indirect-execution boundary

`prepare_review_packet` 是最容易形成间接执行链的口子，必须硬收紧。

允许：

1. 生成邮件、CRM stage、owner 修正、审批备注等草稿文本。
2. 绑定 evidence refs、risks、missing info、allowed next surface、forbidden actions。
3. 在 fixture / local preview 内回读 packet，用于展示和 eval。

禁止：

1. 自动把 packet 传给另一个 facade 作为执行输入。
2. packet creation 触发 webhook、notification、external write、CRM write、IM send、approval status change。
3. packet 带 `sent`、`approved`、`executed`、`committed`、`officialWritePerformed` 等完成态。
4. packet 被 agent 当成 reviewer approval。
5. packet 包含 unredacted raw payload、credential、PII、跨 workspace 数据或未授权 source 原文。

硬字段：

1. 所有草稿必须标记 `not_for_auto_send=true` 或等价边界字段。
2. 每个 packet 必须有 `requiredReviewSurface`。
3. 每个带外部副作用的建议必须有 `humanReviewerRequired=true`。
4. Packet completion 只代表 review packet 已准备好，不代表业务动作已被批准、发送、执行或写回。

### HSI-05：Data protection and redacted sample boundary

Phase 3 redacted sample 不允许成为数据保护绕道。

1. Redaction owner 必须在 sample package 中声明：customer-side、delivery-engineer-side 或 Helm-side。
2. 默认优先 customer-side 或 delivery-engineer-side redaction；Helm 接触 raw customer data 必须单独 Data Protection review，不得通过 HSI 默认授权。
3. Redacted sample package 必须包含 redaction manifest、raw PII / credential scan result、source authorization note、retention note 和 destruction / withdrawal path。
4. Public trial data 必须继承 `HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md`：受控试点、不承诺 SLA、数据驻留 / sub-processor / OpenAI API 默认关闭等边界。
5. Gate green 不代表 DPO approval；Data Protection review、Required Reviewer approval 和 owner decision 仍是独立前置。

### HSI-06：Local-only preview boundary

`local-only` 在 HSI 中只表示：

1. 交付工程师自己的开发机器。
2. 当前 repo checkout。
3. fixture-backed input。
4. 无生产凭据。
5. 无公网 listener、无 tunnel、无 hosted MCP、无客户员工本地常驻 server。
6. 输出仅写本地 stdout / checked-in fixture result / reviewable artifact，不触发外部副作用。

Phase 2 可以做 fixture-backed local CLI preview；不得做 hosted MCP server。MCP client / agent client 消费 HSI 必须进入更高阶段的单独 Go/No-Go。

### HSI-07：`eval:headless-signal-interface`（offline gate）

进入任何 headless runtime 之前，必须先通过离线 eval。`eval:headless-signal-interface` 已在 Phase 1 落地，但它仍只是必要不充分的 offline contract gate；不得把它写成 runtime readiness、production connector approval 或客户可用 headless runtime。

至少覆盖：

1. 重复调用同一 facade 不产生重复 packet。
2. 乱序调用时不会越过 boundary。
3. async 未完成时不能假设成功。
4. workspaceId 缺失或不一致必须拒绝。
5. raw payload、credential、PII、cross-tenant 内容必须隔离。
6. LLM 排名不能改变 deterministic highest-pressure path。
7. review packet 不能被误标为 approved / sent / executed。
8. packet 不能作为后续执行 facade 的隐式输入。

### HSI-08：Fresh-clone delivery loop

时间指标必须区分目标和已验证事实。

当前已验证事实：

1. `extensions/case-management-sample/` 是 minimum public reference，可读、可改、可跑 targeted tests。
2. `README.md` 与 delivery-engineer 1-pager 已写 30 分钟 onboarding 锚点。
3. Docker / fresh-clone onboarding smoke 仍需 v0.1 发布轨道验证。

因此本需求只保留目标，不把它写成已成立承诺：

| 目标 | 当前状态 | 进入承诺前必须证明 |
|---|---|---|
| 30 分钟启动看到 `/operating`、`/approvals`、`/memory` | 目标 | fresh-clone D2 smoke |
| 60 分钟复制 sample pack、改 slug、跑 fixture eval | 目标 | sample pack path + eval command 实跑 |
| 1 天把客户 source 字段映射成 synthetic / redacted fixture | 目标 | mapping checklist + redaction manifest + at least one external dry-run |
| 1 周客户演示 Signal Flow Map + Review Packet + Boundary Ledger | 目标 | 使用 synthetic / redacted 数据完成 rehearsal |

在 D2 smoke 通过前，对外只能写"目标路径"或"onboarding anchor"，不能写成 SLA。

### HSI-09：Pack contributor support loop

开源 / forkable 的 delivery-engineer-facing 定位必须配套反馈回路：

1. 每个 pack 必须提供 `known_gaps`、`reviewer_required`、`eval_failure_codes` 和 `support_notes`。
2. Pack contributor 提交失败 fixture 时，必须能指出失败是 data shape、boundary、sensitive、determinism、review packet completeness 还是 source mapping。
3. Phase 1 不承诺 SLA，但必须定义 owner triage queue：Product / Delivery Engineering / Data Protection / Security 四类 reviewer。
4. Certified Delivery Partner 的权益和社区 contributor 的权益必须分开说明；不能把开源贡献误写成商业认证。
5. Pack 合并前必须通过 offline eval，不接受仅靠截图或口头说明的 pack contribution。

这里的 contributor triage reviewer 只服务开源 pack 反馈和合并判断，不等同于 Phase 4 runtime adoption 的 5 角色 Required Reviewer；runtime adoption 仍必须按 Phase 4 DoD 走 Engineering / Product / Security / Operations / Data Protection。

## 6. Phased plan

| Phase | 目标 | 允许 | 禁止 | DoD |
|---|---|---|---|---|
| Phase 0 | 本需求 + Claude review + owner audit rewrite | docs / review / owner questions | 代码、schema、API、MCP、CLI | 本文件 + review 文件 + docs index / STATUS；Salesforce 不再是议程主轴 |
| Phase 1 | Offline HSI contract | fixtures、deterministic evaluator、pack manifest schema、facade type draft、delivery pack checklist | runtime、production query、network、LLM call、hosted MCP | `eval:headless-signal-interface` 新增并通过；authority / raw / cross-tenant incident 0；至少 1 个 non-Salesforce source |
| Phase 1.5 | Fresh-clone / sample-pack smoke | D2 smoke、case-management-sample fork rehearsal、README / 1-pager time claim calibration | 新承诺、生产数据、外部 connector | 证明或降级 30 / 60 分钟目标 |
| Phase 2 | Local CLI preview | fixture-backed local CLI，只读，只消费 Phase 1 facade contract | production credentials、official write、auto send、hosted MCP、客户员工本地 server | CLI 可投影 snapshot / review packet；non-scripted sequence eval 绿 |
| Phase 3 | Source adapter calibration | non-Salesforce first redacted / synthetic sample，Data Protection review，Required Reviewer approval | production write、silent CRM update、cross-tenant aggregation、Helm 接触 raw data 默认授权 | redacted calibration packet + data policy alignment + runtime readiness gate |
| Phase 4 | Review-gated runtime adoption | review packet creation、human approved next surface、disabled-by-default allowlist | auto execute、auto approve、auto external send、owner 单点放行 | 必须满足 runtime adoption 六项硬前置 + 5 角色 Required Reviewer approval + rollback proof；单点 owner Go/No-Go 不足够 |

## 7. Phase 1 acceptance metrics

| 指标 | Phase 1 目标 |
|---|---|
| Pack manifest schema | documented and fixture-tested |
| Named signal families | `commitment_missing`、`stage_or_status_stale`、`approval_blocked`、`owner_mismatch`、`duplicate_or_conflict`、`boundary_attempt` |
| Non-Salesforce source coverage | >= 1 source |
| Boundary / sensitive fixtures | >= 8 |
| Non-scripted sequence cases | >= 8 |
| Authority leak count | 0 |
| Raw data / sensitive leak count | 0 |
| Cross-workspace projection count | 0 |
| LLM final ranking count | 0 |
| Packet-as-execution incident count | 0 |
| Fresh-clone pack modification path | documented; not claimed verified until D2 smoke passes |

## 8. External narrative

推荐叙事：

```text
Helm is not another agent builder.
It is an Apache-2.0, forkable operating-signal delivery kit for engineers who already use Coze, Wukong, Dify, LangGraph, n8n, CRM, IM, meetings, and spreadsheets in customer projects.
Helm gives them a working vertical loop, review-first packets, and eval-coded boundaries so the first controlled customer does not start from a blank canvas.
```

中文：

```text
Helm 不是另一个 agent 搭建平台。
Helm 是给交付工程师的 Apache-2.0 可 fork 经营信号交付整机：
在客户已有 CRM、IM、会议、表格和 AI 平台之上，
把业务信号收成可复核的推进闭环、边界 gate 和可演示的行业样板。
```

不推荐叙事：

1. `Salesforce makes X; Helm makes Y` 这类镜像式标语。
2. `observable / reviewable` 作为主差异词。
3. 把 Headless Signal Interface 写成 `Salesforce adapter` 路线图。
4. 把 local MCP / CLI 预览写成客户可用 runtime。

## 9. Deliberately not doing

1. 不做 Salesforce 替代品。
2. 不做完整 headless CRM。
3. 不做 hosted MCP server。
4. 不做完整 agent orchestration / control plane。
5. 不做完整 workflow engine、scheduler、retry queue。
6. 不做自动执行、自动外发、自动审批、自动 CRM 写回。
7. 不做跨租户经营信号聚合。
8. 不把 review packet completion 写成 external commitment。
9. 不把 LLM tool selection 写成最终 authority。
10. 不把 Salesforce 作为 Phase 1 默认 adapter。

## 10. Open questions

1. 后续是否保留统一 `eval:headless-signal-interface`，还是在具体 vertical pack 中再拆出 `eval:delivery-pack-contract`？
2. 第一批 non-Salesforce reference source 是 DingTalk、Feishu、WeCom、email、meeting transcript、Excel / CSV、自建 CRM，还是外部 agent manual import？
3. 如果 D002 美业 vertical 是 owner 当前优先级，Phase 1 的美业 first reference pack 应使用哪些 source shape、fixture 和验收样例？
4. Phase 2 local CLI preview 的命令名是否进入 public README，还是先留在 docs-only / internal dev path？
5. Certified Delivery Partner 的审核材料应如何复用 pack eval output，而不把 community contributor 误写成 certified partner？

## 11. Sources

Helm primary sources:

- `README.md` — delivery-engineer-facing positioning, Coze / 悟空 / Dify / LangGraph comparison, Apache-2.0 / forkable / open-core no take-rate.
- `docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md` — 1-pager, 7 value points, 30-minute onboarding anchor, case-management-sample status.
- `extensions/case-management-sample/README.md` — minimum public reference truth.
- `docs/_planning/CASE_MANAGEMENT_SAMPLE_EXTRACTION_SPEC_V1.md` — D2 smoke / full integration pending truth.
- `docs/legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md` — public trial data and sub-processor boundary.
- `docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ENABLEMENT_REVIEW_V1.md` — six hard prerequisites and 5-role Required Reviewer runtime adoption boundary.
- `docs/research/CHINA_AI_SKILL_AND_DIGITAL_WORKER_LANDSCAPE_V1.md` — China builder / skill market landscape and Helm differentiation.

External supporting sources:

- Salesforce News: Introducing Salesforce Headless 360. No Browser Required. 2026-04-15.
- Salesforce Architecture Blog: Salesforce Headless 360: What the Agent Consumer Means for Your Integration Architecture. 2026-05-13.
- Salesforce Developers Blog: Introducing the Data 360 MCP Server (Developer Preview). 2026-05.
- Salesforce Developers Blog: Intent-Driven Tool Selection Using Abilities in Agentforce Vibes. 2026-05.
- Salesforce News: Salesforce Advances Agent Fabric. 2026-04-15.

## 12. Change log

| 日期 | 变化 |
|---|---|
| 2026-05-20 | 首版：基于 Salesforce Headless 360 / Data 360 MCP / Agentforce Vibes Abilities / Agent Fabric 官方材料，收敛 Helm Headless Signal Interface 差异化需求；当前只授权 docs + Claude review，不授权实现 |
| 2026-05-20 | 吸收 Claude P1 评审：补 facade 对照、`preparation-only` 硬约束、现有 surface 复用边界、首批 source-agnostic signal family、non-Salesforce fixture 要求、Phase 2 local CLI preview DoD 和 contributor support loop |
| 2026-05-20 | 吸收 owner audit：Salesforce 从主轴降为外部信号之一；主叙事改回 delivery-engineer toolkit、Apache-2.0 forkable、open-core no take-rate、case-management-sample 与 eval gate；删除 Salesforce 独立 HSI source-adapter 主线；收紧 local-only、redacted sample、indirect execution、runtime adoption Go/No-Go 和 fresh-clone time claims |
| 2026-05-20 | Phase 1 offline eval 脚手架落地：`lib/headless-signal-interface/pack-manifest.ts` 与 `lib/headless-signal-interface/facade-types.ts` 固化 HSI-01 pack manifest 与 HSI-03 facade contract（read-only / preparation-only TS types，no runtime）；`evals/headless-signal-interface/headless-signal-interface-cases.json` 提供 2 packs（`case-management-sample` 非 Salesforce 真包 + `d002-beauty-vertical-placeholder` pendingOwnerTruth 占位）、6 signal family 正例、9 boundary case 与 8 non-scripted sequence case；`lib/evals/headless-signal-interface-evals.ts` + 8 个 vitest contract test + `scripts/headless-signal-interface-evals.ts` + `npm run eval:headless-signal-interface` 跑通，§7 五项 incident counter 全部 0、§7 acceptance metrics 满足；D002 美业 canonical requirements 仍待 owner 真值，到位后切换 first reference pack 并把 `case-management-sample` 退为 generic baseline |
| 2026-05-20 | 吸收二次评审 Go 后轻量收紧：thesis 句内标明 4 周是前置条件明确后的目标；原则名改为 source-agnostic；明确 D002 / 首个真实 vertical 优先时 `case-management-sample` 退为 generic baseline；打通 proposed eval 标题；区分 contributor triage reviewer 与 runtime adoption Required Reviewer |
| 2026-05-20 | §2 显式拆分两条"第一个"轨道：**第一个真实客户** = founder-led grandfathered tenant-private 直连试点（已 landing，production-affecting 边界激活）；**第一个完整行业 PACK** = D002 美业（public reference、`pendingOwnerTruth` 占位）；明确两条线互不依赖、产物形态不同；HSI-01 reference source 段落同步收紧说明 |
| 2026-05-20 | 审计 follow-up：补全 HSI-03 八类 forbidden facade 的 boundary case 覆盖（9 → 15 boundary case；新增 send_message / write_crm_stage / create_contract / settle_payment / auto_assign_owner / promote_to_memory 各一条）；evaluator 加结构性断言 `forbiddenFacadesMissing`：policy.forbiddenFacades 每条都必须有 ≥1 boundary case attempt，否则 `failures` 命中 `forbidden_facades_missing_boundary_case`；evaluator 测试 8 → 9；同步修正 `case-management-sample.hsi-pack.manifest.json` 的 `implementationChecklistRef` 指向 dedicated `hsi-implementation-checklist.md`（之前临时指向 README.md）；§7 五项 incident counter 仍全部 0 |

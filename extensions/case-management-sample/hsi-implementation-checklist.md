---
status: active
owner: Delivery Engineering
created: 2026-05-20
applies_to: extensions/case-management-sample
hsi_artifact: implementation_checklist
hsi_requirement: ../../docs/product/HELM_HEADLESS_SIGNAL_INTERFACE_REQUIREMENTS.md#hsi-01
---

# Case Management Sample HSI Implementation Checklist / Case Management Sample HSI 实施清单

> **语言 / Language**: **中文主文本** + **English reference summary**

## English Reference Summary

This checklist fills the HSI-01 `implementation_checklist` for the public
`case-management-sample` reference pack. Phase 1 is offline only: each item
either records the current public-pack status or notes what the delivery
engineer must redo after forking.

The public pack uses synthetic fixtures only, has no production credentials, and
does not authorize hosted MCP, production connectors, official writes,
auto-send, auto-approve, auto-execute, or LLM final ranking.

本文件是 HSI-01 `implementation_checklist` 在公开参考包 `case-management-sample` 上的具体填写。Phase 1 OFFLINE 范围：每一项要么标注当前状态，要么记录"该 vertical 在 fork 时由交付工程师补齐"。

## 1. Source authorization

| Source kind | 授权来源 | 当前状态 | Fork 后必须重做 |
|---|---|---|---|
| `case_system` | 客户内部 case 系统的只读账号或导出 | 公开包仅使用 100% 合成 fixture，无真实凭据 | 是。交付工程师必须取得客户书面授权、明确导出范围、保留时长与撤回路径，再决定接入方式（CSV 导出 / API 只读 / IMAP 抓邮件 / 其他）。 |
| `im` | 客户 IM 平台（钉钉 / 飞书 / 企业微信等）的只读 webhook 或导出 | 公开包仅使用合成对话片段 | 是。读权限申请、bot 在客户组内部署的范围、可访问群列表必须有客户管理员书面记录。 |
| `meeting` | 浏览器录音 / 第三方 transcript / Zoom / 腾讯会议导出 | 公开包仅使用合成 transcript | 是。会议参与方在录音 / 转写前必须知情同意，参会成员名单与代号映射由客户侧维护。 |
| `email` | IMAP / SMTP 只读账号或转发地址 | 公开包仅使用合成邮件 | 是。客户需明确允许 / 禁止接入的邮箱列表、是否含外部域、是否含敏感附件。 |

非 Salesforce 源是 Phase 1 reference 的硬要求（见 HSI-01 line 134）。如果未来 vertical 加入 Salesforce / HubSpot 等 CRM 源，需要单独 Data Protection review 并把 `dataPosture` 升级为 `redacted` 并附 `dataProtectionReviewRef`。

## 2. Redaction owner

- 公开包：`delivery_engineer_side`（即 fork 它的交付工程师本人）。
- Helm Inc. 默认不接触客户 raw data；任何 `helm_side_with_dp_review` 形态必须先走 HSI-05 Data Protection review 并在 manifest 中填写 `dataProtectionReviewRef`。
- 客户侧 redaction（`customer_side`）需要客户提供脱敏后的导出，交付工程师不参与 raw → redacted 步骤。

## 3. Reviewer

| 复核角色 | 责任范围 | 公开包默认 |
|---|---|---|
| Delivery Engineering | pack manifest、fixture shape、eval 通过 | 当前由 case-management-sample 维护者承担 |
| Product | signal family 定义、review packet 文案、客户可读性 | 当前由 Helm Product 承担 |
| Data Protection | redaction 完整性、PII / credential 扫描、sample 数据合法性 | 公开包合成 fixture 无真实数据，DP 复核形式化 |
| Security | boundary case 完整性、forbidden facade 覆盖、authority / cross-tenant 边界 | 公开包通过 `eval:headless-signal-interface` 15 个 boundary case（HSI-03 八类 forbidden facade 每类至少一条 attempt）+ 8 个 non-scripted case 验证；evaluator 的 `forbiddenFacadesMissing` 结构性断言确保未来新增 forbidden facade 时也必须配 boundary case |

Fork 后这四类复核必须重新评估，不能默认继承公开包结论。HSI-09 明确 contributor triage queue 与 Phase 4 runtime adoption 的 5 角色 Required Reviewer 是不同集合。

## 4. Rollback path

公开包：

1. 没有持久化数据，没有 official write，没有 connector 写回；rollback 等于删除本地 fork。
2. 若 fork 接入了真实客户数据，交付工程师必须在客户合同中写明：
   - 何时停用 / 何时返还导出 / 何时销毁本地拷贝。
   - 数据保留窗口与撤回路径。
   - 出现 boundary incident 时的通知流程。
3. 公开包内不允许 cascade write、自动外发、自动审批；rollback 不需要回滚客户系统状态。

## 5. DPA / data policy posture

- 公开包不签 DPA（无真实客户数据），但继承 [HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md](../../docs/legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md) 的受控试点边界：数据驻留、sub-processor、OpenAI API 默认关闭等条款适用于任何 fork。
- Fork 后接入真实客户数据，必须在合同 / DPA 中明确：
  - 数据驻留区域。
  - sub-processor 列表（含 LLM provider、向量数据库、observability 等）。
  - 默认是否启用外部 LLM（HSI Phase 1 默认关闭）。
  - 客户撤回与数据销毁的 SLA。
- 任何 production query / live calibration 需要单独 Data Protection review，不能默认继承本 checklist。

## 6. Customer demo data posture

- 公开包：100% 合成 fixture（`dataPosture: synthetic`）。fixture 可以直接演示给客户看，不会引发任何隐私问题。
- Fork 演示给客户时的优先级（HSI-05）：
  1. 优先用客户提供的 redacted 样本（`redactionOwner: customer_side`）。
  2. 其次由交付工程师手动构造合成 / 脱敏样本（`redactionOwner: delivery_engineer_side`）。
  3. 仅在客户书面同意 + Data Protection review 后，才允许 Helm 接触 raw customer data（`redactionOwner: helm_side_with_dp_review`）。
- demo 中出现的"客户姓名 / 公司 / 案件 ID"必须确认为合成或别名，不允许真实身份穿透。

## 7. Customer demo evidence pack

Phase 1 fresh-clone D2 smoke 通过后，将与本 checklist 共同形成首批 customer demo evidence 的最小集合：

1. `pack.manifest`（`hsi-pack.manifest.json`）—— 已通过 `npm run eval:headless-signal-interface`。
2. `payload_examples`（`hsi-payload-examples.json`）—— 已含 4 个 source 的合成 input/output。
3. `review_packet_template`（`hsi-review-packet-template.json`）—— 已含 HSI-04 preparation-only 默认值。
4. 本 checklist。
5. Customer-side 数据授权书 / DPA 摘要（fork 后由交付工程师补充，不在公开包中）。
6. fresh-clone smoke 截图 / 录屏（Phase 1.5 落地后补，不在公开包中）。

## 8. 当前不证明 / 不授权

- 不证明 fork 在真实客户环境中的部署、合同、SLA、production runtime 已成立。
- 不证明本 checklist 涵盖所有 vertical 的合规要求；fork 到金融 / 医疗 / 教育等强监管行业时，需在客户合同中追加行业特定条款。
- 不授权 hosted MCP server、production connector、official write、auto-send、auto-approve、auto-execute 或 LLM final ranking。

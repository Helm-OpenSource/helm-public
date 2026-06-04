---
status: draft
owner: Product / Delivery Engineering / Engineering
created: 2026-06-03
review_after: 2026-06-17
public_safety: Public Core method and templates only. No customer data, credentials, production connector proof, hosted endpoint, automatic writeback, or deployment receipt.
---

# Helm Signal First Mile Method / Helm 经营信号首公里方法

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

Helm Signal First Mile 是给交付工程师和前期 AI 诊断使用的最低门槛经营信号采集方法。
它不从生产连接器、大型数据平台或自动化 agent 开始，而是先把会议、IM、CRM、工单、
表格、邮件和业务系统里的关键事实，收敛成可复核、可脱敏、可进入 HSI eval 的
operating signal ledger。

目标不是收集最多原始数据，而是用最小权限收集最高密度的经营判断材料：

- 谁承诺了什么，但没有可复核跟进路径
- 哪个客户、项目、案件、交付项或机会停滞
- 哪个风险、证据缺口或负责人缺失正在阻塞推进
- 哪个回执已经出现，但还没有进入经营记忆
- 哪个动作可能越权，必须被降级为 review-first

## 1. 定位

Signal First Mile 是 HSI 之前的一层入口。

```text
manual note / business system marker / redacted spreadsheet
  -> signal card
  -> signal ledger
  -> signal quality eval
  -> HSI fixture
  -> operating signal snapshot
  -> review packet
```

如果需要先跑通最小证据链，使用
[经营信号首公里 15 分钟跑通](HELM_SIGNAL_FIRST_MILE_QUICKSTART.md)。
最快命令：

```bash
node templates/signal-first-mile/run-first-change-proof.js \
  templates/signal-first-mile/selector-input.sample.json \
  /tmp/helm-sfm-first-change-proof
```

它不是：

- CRM replacement
- connector runtime
- hosted ingest endpoint
- automatic execution plane
- cross-workspace data lake
- LLM final ranking system
- customer deployment approval

## 2. 三层采集路径

| Layer | Who uses it | Input | Output | Boundary |
|---|---|---|---|---|
| L0 Manual first mile | Business owner, delivery engineer, AI diagnosis consultant | Meeting note, chat excerpt, CRM screenshot, spreadsheet row, email summary | Signal card / signal ledger | No credentials, no customer-system writeback |
| L1 Redacted diagnostic packet | Delivery engineer | Redacted CSV / JSON / Markdown | HSI fixture + operating signal snapshot | Offline, read-only, eval-backed |
| L2 Read-only connector | Engineering team | CRM, email, calendar, IM, ticket, vertical-system read API | SignalEvent / review packet / memory candidate | Minimal scope, review-first, no automatic external action |

L0 and L1 should exist before L2. If a team cannot explain the signal family, evidence
posture, reviewer, and forbidden actions in a small ledger, it is too early to build a
production connector.

## 3. 采集方式分类

交付工程师不需要先理解完整 Helm 架构。先按客户材料、权限和时效要求选择一种
collection mode：

如果交付工程师还不确定如何选择，先运行离线 selector：

```bash
node templates/signal-first-mile/signal-first-mile-selector.js \
  templates/signal-first-mile/selector-input.sample.json \
  /tmp/helm-sfm-selector-output.md
```

Selector 输入只包含材料类型、权限状态、是否能改页面、是否有脱敏导出、是否有
只读 API 授权和 signal family。输出是 recommended `collectionMode`、
`dispositionMode`、前置条件、命令、验收项和 forbidden actions。它不是 connector
授权、部署 readiness、approval、writeback 或 memory promotion。

如果需要同时生成 selector output、ledger、HSI fixture、review packet、acceptance
card、customer materials request、manifest 和 README，使用 `run-first-change-proof.js`；
它仍然只做本地文件生成，不运行 connector、不外发、不写回客户系统。

| Mode | Layer | Best for | Implementation | Output | Do not use for |
|---|---|---|---|---|---|
| `manual_card` | L0 | 售前诊断、业务负责人访谈、没有系统权限时 | 人工填写 signal card | One ledger row | 证明生产 freshness |
| `marked_dom` | L0 | 客户已有 Web 业务系统能加一段 JS / HTML 属性时 | `data-helm-*` 显式标记 + JS drop-in | Local ledger | 自动扫页面或后台写回 |
| `programmatic_event` | L0 | 客户系统已有按钮、状态流或低代码动作时 | 调用 `HelmSignalFirstMile.collect()` | Local ledger | 自动执行客户动作 |
| `redacted_sheet` | L1 | Excel / CSV / BI 导出是最快入口时 | 脱敏表格 -> ledger -> HSI fixture | Fixture candidate | 原始表格默认进 repo |
| `meeting_summary` | L1 | 会议纪要、访谈、workshop、售前诊断 | 脱敏会议摘要 -> commitment / risk / evidence_gap | Review packet input | 实时录音平台替代 |
| `chat_digest` | L1 | WeChat / Feishu / Slack / Teams 线程摘要 | 人工或工具生成脱敏 digest | Signal ledger | 自动对外回复 |
| `email_digest` | L1 | 邮件线程里有承诺、阻塞、回执 | 脱敏邮件摘要 | Signal ledger | 自动发邮件 |
| `crm_snapshot` | L1 / L2 | CRM 阶段、负责人、金额、日期漂移 | 截图/导出/只读 API snapshot | Signal ledger / SignalEvent | 静默改 CRM 阶段 |
| `ticket_snapshot` | L1 / L2 | 工单、案件、客服、交付事项 | 工单 snapshot / fixture | Signal ledger / SignalEvent | 自动分配 owner |
| `receipt_packet` | L1 | 客户已确认的动作、交付回执、验收痕迹 | 回执别名 + reviewer | Memory candidate | 自动进入官方 memory |
| `dry_run_fixture` | L1 | 准备连接器前的工程验证 | synthetic / redacted fixture + eval | HSI eval proof | 证明生产连接器安全 |
| `read_only_connector` | L2 | 已有客户授权和最小 OAuth/API scope | 只读 connector + dry-run fallback | SignalEvent / review packet | auto-send / auto-approve / auto-writeback |
| `external_agent_output` | L1 / L2 | 客户已有 agent、RPA、BI、脚本输出 | 把外部输出当 evidence candidate | Signal ledger | 把外部 agent 结论当最终判断 |

最简单选择规则：

1. **没有权限**：用 `manual_card`、`meeting_summary`、`chat_digest` 或 `redacted_sheet`。
2. **能改客户页面但不能接 API**：用 `marked_dom` 或 `programmatic_event`。
3. **能拿脱敏导出**：用 `redacted_sheet`，再转 HSI fixture。
4. **能拿只读 API scope**：先做 `dry_run_fixture`，再做 `read_only_connector`。
5. **任何会外发、审批、写回、分配 owner、进入官方 memory 的动作**：不属于采集方式，必须走 review-first。

## 4. Source Family 到采集方式的默认映射

| Source family | Recommended first mode | Why |
|---|---|---|
| `meeting` | `meeting_summary` | 会议常含承诺、风险、owner 和 missing receipt |
| `chat` | `chat_digest` | IM 线程噪声高，先摘要再入 ledger |
| `email` | `email_digest` | 邮件适合抓 commitment / receipt / evidence gap |
| `crm` | `crm_snapshot` | CRM 阶段、owner、日期漂移是典型 pacing / risk signal |
| `ticket` | `ticket_snapshot` | 工单状态、SLA、owner mismatch 易形成阻塞信号 |
| `sheet` | `redacted_sheet` | 表格导出是低门槛批量诊断入口 |
| `web_app` | `marked_dom` | 客户业务系统可用显式按钮/字段标记，不自动扫全文 |
| `external_agent_output` | `external_agent_output` | 外部 agent 输出只能作为 evidence candidate |
| `delivery` | `manual_card` | 交付事项先由人确认 owner/reviewer/boundary |
| `finance` | `redacted_sheet` | 财务信号默认更敏感，先走脱敏表格和人工复核 |

## 5. Signal Card Minimum Fields

Every first-mile signal should carry:

| Field | Meaning |
|---|---|
| `signalKey` | Stable key generated by the collector or mapper |
| `collectionMode` | How the signal was collected, such as `manual_card`, `marked_dom`, `redacted_sheet`, or `read_only_connector` |
| `dispositionMode` | What Helm should prepare next, such as `prepare_review_packet`, `request_evidence`, or `record_receipt` |
| `sourceFamily` | `meeting`, `chat`, `email`, `crm`, `ticket`, `sheet`, `doc`, `finance`, `delivery`, `web_app`, or another reviewed source family |
| `businessObject` | The alias-only object being discussed, such as Account / Deal / Meeting / Commitment / Workstream / Case |
| `signalFamily` | `commitment`, `advancement`, `risk`, `pacing`, `receipt`, `evidence_gap`, or `boundary_attempt` |
| `evidenceRefs` | Alias-only references such as file name, row id, screenshot id, meeting id, or redacted object ref |
| `whatChanged` | Short redacted explanation of the business change |
| `owner` | Alias or role responsible for follow-up |
| `reviewer` | Human reviewer required before commitment, writeback, external send, or memory promotion |
| `dueOrAge` | Due date, stale age, or freshness label |
| `missingInfo` | Missing evidence, owner, permission, or context |
| `confidenceBand` | `high`, `medium`, `low`, `mixed`, or `unknown` |
| `dataPosture` | `synthetic`, `redacted`, `alias_only`, or `raw_private` |
| `allowedNextSurface` | `/approvals`, `/memory`, `/capture`, `/operating`, or `/settings` |
| `boundaryNote` | Why the signal is review-first and what must not happen automatically |

Raw customer data, production URLs, private domains, real contact details, credentials,
and deployment receipts do not belong in the public Signal First Mile examples.

## 6. 处置方式分类

采集之后的默认处置不是自动执行，而是把 signal 送入正确的 review-first 路径：

```text
collected signal
  -> validate / reject / quarantine
  -> link / dedupe / request evidence
  -> prepare packet / draft action / escalate
  -> human review
  -> receipt / memory candidate / recheck
```

| Disposition mode | Track | Best for | Result | Boundary |
|---|---|---|---|---|
| `reject_input` | auto | raw private、越权、无效输入 | 拒绝进入正常流 | 不保存原始敏感内容 |
| `quarantine` | review | 权限不明、跨 workspace、疑似泄漏 | 隔离等待安全 / 数据复核 | 不继续正常流转 |
| `request_evidence` | review | `evidence_gap`、缺回执、缺证据 | 补证据请求 | 缺证据不能变事实 |
| `link_object` | auto | 未绑定客户、商机、会议、工单、事项 | 绑定 alias object | 不自动创建主数据 |
| `dedupe_or_merge_review` | review | duplicate / conflict | 合并或冲突复核包 | 不自动 merge |
| `assign_reviewer` | review | owner / reviewer 缺失 | 路由给人工复核人 | 路由不等于批准 |
| `prepare_review_packet` | review | commitment、risk、approval | 复核包 | packet 不等于 approval |
| `draft_next_action` | review | 可推进但需人工确认 | 草拟下一步 | 不自动外发 / 写回 |
| `escalate_blocker` | review | risk、blocked、stale | 升级 blocker | 升级不是外部承诺 |
| `record_receipt` | review | receipt、完成回执、客户确认 | 回执候选 | 需确认后进 memory |
| `promote_memory_candidate` | review | 已复核事实 / 承诺 / 阻塞 | 经营记忆候选 | 不自动成为官方 memory |
| `schedule_recheck` | auto | pacing、stale、跟进窗口 | 复查窗口 | 不自动催办或外发 |
| `no_action_watch` | auto | 低置信度、仅观察信号 | watch-only ledger | 不触发客户可见动作 |

默认映射：

| Signal family | Default disposition |
|---|---|
| `commitment` | `prepare_review_packet` |
| `advancement` | `draft_next_action` |
| `risk` | `escalate_blocker` |
| `pacing` | `schedule_recheck` |
| `receipt` | `record_receipt` |
| `evidence_gap` | `request_evidence` |
| `boundary_attempt` | `reject_input` |

Auto 轨道只允许安全、确定、只读的整理动作。Review 轨道只准备复核材料。Never
轨道仍然包括自动外发、自动审批、自动写 CRM、自动付款、自动承诺、自动修改高风险状态。

## 7. 最小 JS Drop-in

The public template includes a single dependency-free file:

[`../../templates/signal-first-mile/helm-signal-first-mile.js`](../../templates/signal-first-mile/helm-signal-first-mile.js)

It is intentionally narrow:

- no network calls by default
- no API token
- no external writeback
- no automatic DOM text scraping
- no auto-send, auto-approve, auto-writeback, or auto-promote-to-memory
- explicit `data-helm-*` attributes or `collect()` calls only
- a fixed `collectionMode` catalog for delivery-engineer selection
- a fixed `dispositionMode` catalog for review-first handling
- local ledger export for HSI fixture preparation

Example:

```html
<script src="./helm-signal-first-mile.js"></script>

<button
  data-helm-signal
  data-helm-source-family="crm"
  data-helm-collection-mode="crm_snapshot"
  data-helm-disposition-mode="assign_reviewer"
  data-helm-object-kind="Deal"
  data-helm-object-ref="Deal-Alias-001"
  data-helm-signal-family="risk"
  data-helm-evidence-ref="crm-row-17"
  data-helm-what-changed="Decision date moved twice; reviewer missing"
  data-helm-owner="delivery-owner"
  data-helm-reviewer="customer-reviewer"
  data-helm-data-posture="redacted"
>
  Mark Signal
</button>

<script>
  HelmSignalFirstMile.configure({
    workspaceAlias: "diagnostic-workspace",
    defaultReviewer: "customer-reviewer"
  });

  document.addEventListener("click", function (event) {
    var target = event.target.closest("[data-helm-signal]");
    if (!target) return;
    HelmSignalFirstMile.collectFromElement(target);
  });
</script>
```

The file records a local signal ledger that a delivery engineer can export, inspect,
redact again if needed, and map into HSI fixtures. It does not prove production connector
safety or customer deployment readiness.

## 8. Ledger -> HSI Fixture

The template also includes an offline converter:

[`../../templates/signal-first-mile/ledger-to-hsi-fixture.js`](../../templates/signal-first-mile/ledger-to-hsi-fixture.js)

Use it after manual inspection:

```bash
node - <<'NODE'
const fs = require("node:fs");
const { convertLedgerToHsiFixture } = require("./templates/signal-first-mile/ledger-to-hsi-fixture.js");

const ledger = JSON.parse(fs.readFileSync("templates/signal-first-mile/signal-ledger.sample.json", "utf8"));
const fixture = convertLedgerToHsiFixture(ledger);

fs.writeFileSync("/tmp/helm-sfm-hsi-fixture.json", JSON.stringify(fixture, null, 2));
NODE

npm run eval:headless-signal-interface -- --fixture /tmp/helm-sfm-hsi-fixture.json
```

The converter maps first-mile families into the Phase 1 HSI family set and adds synthetic
coverage scaffolding for missing HSI families, forbidden facades, and non-scripted
sequence cases. Those scaffold cases are eval helpers, not customer evidence.

## 8.1 Ledger -> Review Packet

The same ledger can produce a public-safe review packet:

[`../../templates/signal-first-mile/ledger-to-review-packet.js`](../../templates/signal-first-mile/ledger-to-review-packet.js)

```bash
node templates/signal-first-mile/ledger-to-review-packet.js \
  templates/signal-first-mile/signal-ledger.sample.json \
  /tmp/helm-sfm-review-packet.md
```

The packet contains reviewer decisions, evidence aliases, missing info, boundary notes,
and forbidden next actions. It is not approval, external send, writeback, customer
deployment readiness, or official memory promotion.

## 8.2 Acceptance Card

The first-change proof package also includes `acceptance-card.md` and
`acceptance-card.json`. The acceptance card answers four delivery questions:

1. What minimum redacted materials are required?
2. What reviewer receipt must exist before action?
3. Is the case ready for L2 read-only connector design review?
4. Which actions remain forbidden?

The L2 gate is intentionally strict. A case is not L2-ready unless explicit read-only
API authorization, dry-run fixture proof, and no-writeback boundaries are present.

## 8.3 Customer Materials Request

The first-change proof package also includes `customer-materials.md` and
`customer-materials.json`, generated by:

[`../../templates/signal-first-mile/signal-first-mile-customer-materials.js`](../../templates/signal-first-mile/signal-first-mile-customer-materials.js)

Use this before building a ledger or asking for connector access. It converts the
selector input and recommendation into a source-specific request for the minimum
synthetic, redacted, or alias-only materials.

| Source family | Request focus | Must not request |
|---|---|---|
| `crm` | Row alias, stage/status, owner alias, reviewer alias, stale-age or decision-date bucket, evidence alias | Full CRM export, customer name, exact private amount, private URL |
| `ticket` | Case alias, queue alias, SLA/age bucket, blocker summary, owner/reviewer alias | Full ticket history, contact details, private ticket URL |
| `meeting` | Redacted summary, participant role aliases, commitment/risk/receipt list | Raw transcript, recording, personal identities |
| `chat` | Redacted digest, thread alias, message ref aliases, commitments/blockers/receipts | Full IM thread or raw message IDs |
| `email` | Redacted thread digest, subject alias, sender/recipient role aliases | Full raw email content or real addresses |
| `sheet` | Redacted rows, column mapping, row aliases, owner/reviewer aliases | Raw workbook, formulas with private values, contact fields |
| `finance` | Amount bands, due/age bucket, receipt/risk alias | Bank details, payment IDs, invoice numbers, contracts |
| `delivery` | Receipt alias, customer-safe outcome summary, missing acceptance/reviewer details | Customer deployment receipts or private deployment URLs |
| `web_app` | Explicit `data-helm-*` fields or `collect()` payload fields | DOM scraping, session IDs, production URLs |
| `external_agent_output` | Run alias, tool alias, redacted output summary, human reviewer alias | Treating external agent judgement as final action authority |

This is the closest thing to an enterprise-wide coverage checklist, but the coverage is
by operating signal pattern rather than by every named enterprise application. If a
customer source does not fit the table, map it first to one source family, one
`collectionMode`, one `dispositionMode`, and one human reviewer before adding any new
adapter or connector work.

## 8.4 Signal Quality Eval

Signal Quality Eval sits between the local ledger and HSI fixture conversion:

```text
signal ledger
  -> public-safe golden expectations
  -> signal-quality-report
  -> HSI fixture
```

Use:

```bash
node templates/signal-first-mile/signal-quality-eval.js \
  templates/signal-first-mile/signal-ledger.sample.json \
  templates/signal-first-mile/signal-quality-goldens.sample.json \
  /tmp/helm-sfm-signal-quality-report.md
```

The evaluator measures:

| Metric | Meaning |
|---|---|
| `precision` | Accepted ledger rows that match expected golden signals |
| `recall` | Expected golden signals found in the ledger |
| `signalFamilyAccuracy` | Matched rows have the expected `signalFamily` |
| `dispositionAccuracy` | Matched rows have the expected `dispositionMode` |
| `requiredFieldCompleteness` | Required source, object, owner, reviewer, and boundary fields are present |
| `evidenceCoverage` | Required evidence refs are present |
| `reviewerCompleteness` | Required reviewer aliases are present |
| `boundaryIncidentCount` | Forbidden executable next actions or missing boundary controls |
| `rawPrivateLeakCount` | Raw-private or raw-blocked rows detected in the ledger |

This makes completeness visible as a coverage matrix rather than a blanket claim. Helm
can show which source families, signal families, and disposition modes are covered by
the current golden pack, and which remain untested. Passing this eval does not prove
production data completeness, connector safety, customer authorization, deployment
readiness, writeback, external send, approval, or official memory promotion.

The one-command first-change proof generates its golden pack from the expected
pre-collection input, so that packet proves local transformation fidelity into the
ledger. For independent accuracy evaluation, use a public-safe golden pack prepared
outside the collector path. Matching is fixed: `signalKey` first; otherwise
`sourceRef + businessObject.ref + signalFamily`.

## 8.5 Source Governance Before Improvement Loops

Signal First Mile collects operating signals, but not every collected signal may feed
expert evaluation or capability improvement. Helm uses a source-class gate before any
promotion into expert eval, model improvement, or public fixture reuse:

| Source class | Definition | Allowed use | Forbidden use | De-identification requirement | Improvement loop |
|---|---|---|---|---|---|
| `fleet_customer_health` | Helm operator view across customer tenant health | Internal operator triage, support readiness, advice-only risk review | Eval case, model improvement, training, memory promotion, automatic customer action | Reversible alias is only minimum exposure; it requires salt lifecycle, role access, decode audit, and `customerConsentScopeRef` | Never |
| `self_dogfood_health` | Helm observing its own organization operations | Dogfood review and candidate improvement material | HR / performance judgement, person-level promotion, external commitment | Person-level attribution must be technically removed before promotion | Only after de-id + human-review gate |
| `synthetic_public` | Fully synthetic public fixture | Public eval and fixture validation | Claiming real customer evidence | No real tenant, person, customer, domain, email, phone, or credential | Yes |
| `deidentified_promoted_case` | Private or dogfood case promoted through review | Held-out eval and regression cases | Promotion without scanner + human signoff | Existing `EvalCasePromotion` gate must pass | Yes |
| `oss_governance` | GitHub / docs / community governance | Open-source governance workflow | Tenant ingestion, customer diagnosis, expert improvement | Stays in public GitHub / docs process | Never |

This split prevents the overloaded "self-tenant" term from blurring three different
systems:

- **fleet-health**: Helm's operator view of customer tenant health. It is governed by
  customer consent, PIPL / residency, operator access, and audit controls. It is not
  anonymous just because an alias is used, and it never enters expert improvement.
- **self-dogfood**: Helm's own organization health dogfood. It can become improvement
  material only after person-level attribution is removed and the promotion gate passes.
- **OSS governance**: GitHub issues, PRs, contributor activity, and docs governance. It
  remains outside Helm tenant data and is a non-goal for productized operating signals.

The public validator lives in
[`../../lib/operating-signal-governance/source-governance.ts`](../../lib/operating-signal-governance/source-governance.ts)
with a public-safe sample at
[`../../templates/operating-signal-governance/source-governance.sample.json`](../../templates/operating-signal-governance/source-governance.sample.json).

## 9. Gate Rules

| Gate | Required proof | Not proven |
|---|---|---|
| L0 signal card | Human-readable signal ledger with alias-only evidence refs | Data processing approval, connector safety, production freshness |
| L1 diagnostic packet | Redacted ledger + Signal Quality Eval + `npm run eval:headless-signal-interface` | Customer deployment readiness, live credentials, official writeback |
| L2 read-only connector | Integration template, minimal scopes, dry-run fixture, tests, rollback path | Auto-send, auto-approve, auto-writeback, memory promotion without review |

## 10. Recommended First PR Shape

1. Add a redacted signal ledger sample.
2. Add public-safe golden expectations and a Signal Quality Eval report.
3. Add an HSI fixture derived from the ledger.
4. Add mapper tests that prove signal family, owner, reviewer, boundary note, and allowed next surface.
5. Run:

```bash
npm run check:public-docs
npm run check:public-release
npm run eval:signal-first-mile-quality
npm run eval:headless-signal-interface
npm run eval:operating-signal-flow
npm run typecheck
npm run test
```

## English Reference

Helm Signal First Mile is the lowest-friction method for turning existing business
materials into review-first operating signals before a real connector exists. It starts
with explicit signal cards and local ledgers, then moves to redacted HSI fixtures, and
only then to read-only connector work.

The method optimizes for decision coverage, not raw data volume. A useful first-mile
signal names the collection mode, disposition mode, source family, business object,
signal family, evidence reference, owner, reviewer, data posture, allowed next surface,
and boundary note.

The drop-in JavaScript template is a local ledger collector, not a connector or hosted
ingest endpoint. It does not read page text automatically, does not send network
requests, and does not write back to customer systems.

The customer materials request is a pre-ledger checklist for source-specific redacted
inputs. It is not connector authorization, data-processing approval, deployment
readiness, writeback, external send, or official memory promotion.

The quality evaluator is an offline ledger-vs-golden gate for signal accuracy and
completeness. It is not proof that all enterprise operating scenarios have been covered.

## Change Log

| Date | Change |
|---|---|
| 2026-06-04 | Added operating signal source governance before expert improvement loops |
| 2026-06-03 | Added Signal Quality Eval as the ledger accuracy and completeness gate before HSI fixture conversion |
| 2026-06-03 | Added customer materials request as the pre-ledger checklist for delivery engineers |
| 2026-06-03 | Drafted Signal First Mile method and linked the dependency-free JS drop-in template |

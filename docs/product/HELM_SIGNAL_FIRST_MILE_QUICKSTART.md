---
status: draft
owner: Product / Delivery Engineering
created: 2026-06-03
review_after: 2026-06-17
public_safety: Public Core quickstart only. Uses synthetic, redacted, or alias-only local files. No customer data, credentials, production connector, hosted ingest endpoint, automatic writeback, or deployment receipt.
---

# Helm Signal First Mile Quickstart / 经营信号首公里 15 分钟跑通

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

这个 quickstart 让交付工程师用最小路径跑通：

```text
业务系统显式标记 / programmatic event
  -> customer materials request
  -> selector recommendation
  -> local signal ledger
  -> signal quality eval
  -> HSI fixture eval
  -> review packet
```

它证明的是 public-safe first-change proof：采集方式、处置方式、review-first 边界、
ledger-vs-golden 质量、HSI fixture 形状和 review packet 都能闭环。它不证明客户部署、
生产连接器安全、客户授权、官方 memory promotion、CRM 写回或任何外部承诺。

## 0. 前置条件

- 在 `helm-public` 仓库根目录运行命令。
- 只使用 synthetic、redacted 或 alias-only 内容。
- 不粘贴真实客户名称、联系人、邮箱、手机号、私有 URL、内网 IP、token、合同、付款或部署回执。

## 1. 先跑选择器

最快路径是直接生成完整本地 proof package：

```bash
node templates/signal-first-mile/run-first-change-proof.js \
  templates/signal-first-mile/selector-input.sample.json \
  /tmp/helm-sfm-first-change-proof
```

输出目录会包含：

- `selector-input.json`
- `selector-output.json`
- `selector-output.md`
- `signal-ledger.json`
- `hsi-fixture.json`
- `review-packet.md`
- `acceptance-card.md`
- `acceptance-card.json`
- `customer-materials.md`
- `customer-materials.json`
- `signal-quality-goldens.json`
- `signal-quality-report.md`
- `signal-quality-report.json`
- `MANIFEST.json`
- `README.md`

然后运行 `MANIFEST.json` 里的 `evalCommand`，例如：

```bash
npm run eval:headless-signal-interface -- --fixture /tmp/helm-sfm-first-change-proof/hsi-fixture.json
```

如果不确定该用哪种采集和处置方式，先跑 selector：

```bash
node templates/signal-first-mile/signal-first-mile-selector.js \
  templates/signal-first-mile/selector-input.sample.json \
  /tmp/helm-sfm-selector-output.md
```

查看 `/tmp/helm-sfm-selector-output.md`，确认：

- 推荐的 `collectionMode`
- 推荐的 `dispositionMode`
- 必要前置条件
- 下一步命令
- 验收项
- 禁止动作

选择器只是 advisory。它不授权 connector、不证明客户部署就绪、不允许自动外发、
自动审批、自动写回或自动进入 memory。

## 1.1 向客户要最小脱敏材料

一键 proof package 会生成 `customer-materials.md`。交付工程师可以把它作为客户侧
材料请求的底稿，用来说明不同来源需要提供哪些最小脱敏材料：

- CRM / 工单 / 表格：给 row alias、状态、负责人 alias、reviewer alias、证据 alias。
- 会议 / IM / 邮件：给摘要，不给原始全文；只保留承诺、风险、回执、缺口和 owner。
- 财务 / 交付回执：给 amount band、receipt alias、outcome alias，不给合同、付款、银行或部署回执。
- 业务 Web 系统：只确认显式 `data-helm-*` 字段或 `collect()` payload，不扫页面全文。
- 外部 agent 输出：只当 evidence candidate，不当最终判断。

不要向客户索取 raw transcript、完整邮件 / IM 线程、真实个人信息、私有 URL、内网 IP、
token、凭据、合同、付款记录或部署回执。`customer-materials.md` 不是 connector
授权、数据处理批准、部署 readiness、写回、外发或 memory promotion。

## 2. 看一眼可选目录

```bash
node - <<'NODE'
const sfm = require("./templates/signal-first-mile/helm-signal-first-mile.js");

console.log("Collection modes:");
console.log(Object.keys(sfm.getCollectionModes()).join(", "));

console.log("\nDisposition modes:");
console.log(Object.keys(sfm.getDispositionModes()).join(", "));
NODE
```

交付工程师只需要先选：

- `collectionMode`: 信号怎么来，例如 `crm_snapshot`、`meeting_summary`、`marked_dom`
- `dispositionMode`: 后续怎么处置，例如 `assign_reviewer`、`request_evidence`、`record_receipt`

如果没有显式传入，JS drop-in 会按 `sourceFamily` 和 `signalFamily` 推导默认值。

## 3. 生成一个本地 signal ledger

```bash
node - <<'NODE'
const fs = require("node:fs");
const sfm = require("./templates/signal-first-mile/helm-signal-first-mile.js");

sfm.configure({
  workspaceAlias: "diagnostic-workspace",
  defaultReviewer: "customer-reviewer"
});

sfm.clear();
sfm.collect({
  collectionMode: "crm_snapshot",
  dispositionMode: "assign_reviewer",
  sourceFamily: "crm",
  sourceRef: "crm-row-17",
  objectKind: "Deal",
  objectRef: "Deal-Alias-001",
  signalFamily: "risk",
  evidenceRefs: ["crm-row-17"],
  whatChanged: "Decision date moved twice; reviewer missing",
  owner: "delivery-owner",
  reviewer: "customer-reviewer",
  dueOrAge: "aging",
  missingInfo: "reviewer-confirmation",
  confidenceBand: "medium",
  dataPosture: "redacted"
});

fs.writeFileSync("/tmp/helm-sfm-ledger.json", sfm.exportLedger());
console.log("/tmp/helm-sfm-ledger.json");
NODE
```

这一步只生成本地 ledger，不发网络请求，不写回客户系统。

## 4. 先跑 Signal Quality Eval

质量评估回答两个问题：已收集 signal 是否准确，关键 expected signal 是否漏掉。它用
public-safe golden pack 对 ledger 做离线比对，不接 LLM、不接网络、不接客户系统。

```bash
node templates/signal-first-mile/signal-quality-eval.js \
  /tmp/helm-sfm-ledger.json \
  templates/signal-first-mile/signal-quality-goldens.sample.json \
  /tmp/helm-sfm-signal-quality-report.md
```

看 `/tmp/helm-sfm-signal-quality-report.md`，确认：

- `precision` / `recall` 是否达到阈值
- `signalFamilyAccuracy` / `dispositionAccuracy` 是否正确
- `evidenceCoverage` 是否足以支撑判断
- `reviewerCompleteness` 是否为 1
- `boundaryIncidentCount` 和 `rawPrivateLeakCount` 是否为 0

通过 quality eval 只说明 ledger 和 golden expectations 对齐；不说明生产数据完整、
客户授权已完成或 connector 可以上线。

## 5. 转成 HSI fixture 并运行 eval

```bash
node - <<'NODE'
const fs = require("node:fs");
const { convertLedgerToHsiFixture } = require("./templates/signal-first-mile/ledger-to-hsi-fixture.js");

const ledger = JSON.parse(fs.readFileSync("/tmp/helm-sfm-ledger.json", "utf8"));
const fixture = convertLedgerToHsiFixture(ledger, {
  packId: "signal-first-mile-diagnostic",
  displayName: "Signal First Mile Diagnostic Pack"
});

fs.writeFileSync("/tmp/helm-sfm-hsi-fixture.json", JSON.stringify(fixture, null, 2));
console.log("/tmp/helm-sfm-hsi-fixture.json");
NODE

npm run eval:headless-signal-interface -- --fixture /tmp/helm-sfm-hsi-fixture.json
```

通过 eval 只说明 fixture 满足 HSI 离线形状和边界用例；不说明生产 connector 已安全。

## 6. 生成 review packet

```bash
node templates/signal-first-mile/ledger-to-review-packet.js \
  /tmp/helm-sfm-ledger.json \
  /tmp/helm-sfm-review-packet.md
```

打开 `/tmp/helm-sfm-review-packet.md`，人工检查：

- reviewer 是否明确
- missing evidence 是否明确
- disposition 是否正确
- forbidden next actions 是否仍被保留
- raw/private 行是否没有进入 packet 正文

## 7. 成功标准

| Proof | Expected result |
|---|---|
| One-command package | `/tmp/helm-sfm-first-change-proof` 下生成 selector、ledger、quality report、HSI fixture、review packet、manifest、README |
| Selector output | 给出 recommended `collectionMode` / `dispositionMode`，且列出 forbidden actions |
| Customer materials request | `customer-materials.md` 给出 source-specific 最小脱敏材料、字段映射、redaction checklist 和 do-not-send 清单 |
| Local ledger | 至少 1 条 accepted signal，且 `dataPosture` 是 `synthetic`、`redacted` 或 `alias_only` |
| Signal quality eval | `precision`、`recall`、`signalFamilyAccuracy`、`dispositionAccuracy`、`reviewerCompleteness` 为 1；`boundaryIncidentCount` 和 `rawPrivateLeakCount` 为 0 |
| HSI fixture eval | `npm run eval:headless-signal-interface -- --fixture /tmp/helm-sfm-hsi-fixture.json` 通过 |
| Review packet | 有 reviewer decision table、evidence refs、missing info、forbidden actions |
| Acceptance card | 列出最小脱敏材料、reviewer receipt、L2 read-only connector gate、forbidden actions |
| Boundary | 没有外发、审批、写回、真实 owner 分配或 memory promotion |

## 8. 客户业务系统的最小 JS 形态

如果客户系统能加一段 HTML 属性和一个点击事件，用：

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

这不是自动页面扫描。只有显式 `data-helm-*` 字段会进入 ledger。

## 9. 不要在 quickstart 里做的事

- 不接生产 OAuth / API token。
- 不写 hosted ingest endpoint。
- 不自动扫 DOM 文本。
- 不把客户原始导出放进 public repo。
- 不自动发送邮件、IM、CRM 更新或工单更新。
- 不把 review packet 写成 approval。
- 不把 eval passing 写成 customer deployment readiness。
- 不把 quality report 写成生产数据完整性证明。

## English Reference

This quickstart proves the public-safe Signal First Mile flow: a marked or
programmatic business signal becomes a local ledger, then a Signal Quality Eval report,
then an HSI fixture, then a review packet. It is not connector approval, production
deployment readiness, customer-system writeback, external send, or official memory
promotion.

Use the JavaScript drop-in only with explicit attributes or explicit `collect()`
calls. Keep all examples synthetic, redacted, or alias-only.

## Change Log

| Date | Change |
|---|---|
| 2026-06-03 | Added Signal Quality Eval to measure ledger accuracy and completeness before HSI fixture use |
| 2026-06-03 | Added customer materials request to the first-change proof output |
| 2026-06-03 | Added the offline selector step for collection and disposition mode choice |
| 2026-06-03 | Added the 15-minute Signal First Mile first-change proof |

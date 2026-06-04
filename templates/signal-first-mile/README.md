# Helm Signal First Mile Template

This template helps delivery engineers place one dependency-free JavaScript file into a
customer business system or demo page so explicitly marked business moments become a
local, review-first signal ledger.

It is not a connector, hosted ingest service, browser tracking script, CRM replacement,
or automatic execution plane.

## Files

| File | Purpose |
|---|---|
| `signal-first-mile-selector.js` | Offline selector for recommended collection and disposition modes |
| `signal-first-mile-acceptance-card.js` | Offline delivery-engineer acceptance card generator |
| `signal-first-mile-customer-materials.js` | Offline customer-side minimal redacted materials request generator |
| `signal-quality-eval.js` | Offline ledger-vs-golden quality evaluator for accuracy and completeness |
| `run-first-change-proof.js` | One-command local generator for selector output, customer materials request, ledger, quality report, HSI fixture, review packet, manifest, and README |
| `helm-signal-first-mile.js` | Standalone browser / CommonJS collector |
| `ledger-to-hsi-fixture.js` | Offline converter from first-mile ledger to HSI fixture candidate |
| `ledger-to-review-packet.js` | Offline converter from first-mile ledger to public-safe review packet |
| `example.html` | Minimal explicit `data-helm-*` integration example |
| `selector-input.sample.json` | Public-safe selector input sample |
| `selector-output.sample.json` | Public-safe selector JSON recommendation sample |
| `selector-output.sample.md` | Public-safe selector Markdown recommendation sample |
| `signal-ledger.sample.json` | Public-safe sample export |
| `signal-quality-goldens.sample.json` | Public-safe golden expectations for the sample ledger |
| `hsi-fixture.sample.json` | Public-safe HSI fixture sample that passes the offline HSI eval |
| `review-packet.sample.md` | Public-safe review packet sample generated from the sample ledger |

## 15-Minute First-Change Proof

Use the public quickstart when a delivery engineer needs the shortest runnable path:

1. Generate the local proof package.
2. Inspect `signal-quality-report.md` for precision, recall, evidence, reviewer, and boundary quality.
3. Run `npm run eval:headless-signal-interface` against the generated HSI fixture.
4. Confirm the generated review packet names a human reviewer.
5. Confirm no auto-send, auto-approve, auto-writeback, owner assignment, or memory
   promotion occurred.

See
[`../../docs/product/HELM_SIGNAL_FIRST_MILE_QUICKSTART.md`](../../docs/product/HELM_SIGNAL_FIRST_MILE_QUICKSTART.md).

Generate the package:

```bash
node templates/signal-first-mile/run-first-change-proof.js \
  templates/signal-first-mile/selector-input.sample.json \
  /tmp/helm-sfm-first-change-proof
```

The output directory contains:

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

Then run the `evalCommand` recorded in `MANIFEST.json`.
Use `acceptance-card.md` to confirm minimum redacted materials, reviewer receipt,
L2 readiness, and forbidden actions before moving beyond L0/L1.
Use `customer-materials.md` before a customer workshop or system walkthrough to request
only the minimum synthetic, redacted, or alias-only materials needed for the selected
source family.
Use `signal-quality-report.md` to confirm the ledger matches its golden expectations
before using the generated HSI fixture or review packet. In a generated first-change
proof, the golden pack comes from the pre-collection expected input, so it proves local
transformation fidelity rather than independent production accuracy.

## Choose The Path First

Run the selector before writing a ledger when the delivery engineer is unsure which mode
to use:

```bash
node templates/signal-first-mile/signal-first-mile-selector.js \
  templates/signal-first-mile/selector-input.sample.json \
  /tmp/helm-sfm-selector-output.md
```

The selector considers material type, access level, UI-change permission, redacted export
availability, read-only API authorization, and signal family. It returns a recommended
`collectionMode`, `dispositionMode`, prerequisites, commands, acceptance checks, and
forbidden actions. It is advisory only and does not authorize connector work.

## Request Customer Materials

Use the customer materials generator when the delivery engineer needs a customer-facing
checklist before collecting a ledger row:

```bash
node - <<'NODE'
const fs = require("node:fs");
const selector = require("./templates/signal-first-mile/signal-first-mile-selector.js");
const materials = require("./templates/signal-first-mile/signal-first-mile-customer-materials.js");

const input = JSON.parse(fs.readFileSync("templates/signal-first-mile/selector-input.sample.json", "utf8"));
const recommendation = selector.selectSignalFirstMilePath(input);
const request = materials.buildCustomerMaterialsRequest(input, recommendation);

fs.writeFileSync("/tmp/helm-sfm-customer-materials.md", materials.renderCustomerMaterialsMarkdown(request));
NODE
```

The request covers CRM, ticket, meeting, chat, email, spreadsheet, finance, delivery,
business web app, and external-agent output sources. It asks for redacted materials only;
it is not connector authorization, data-processing approval, deployment readiness,
writeback, external send, or memory promotion.

## Evaluate Signal Quality

Run the quality evaluator before HSI conversion when a delivery engineer needs to prove
that the ledger is accurate and complete against a public-safe golden pack:

```bash
node templates/signal-first-mile/signal-quality-eval.js \
  templates/signal-first-mile/signal-ledger.sample.json \
  templates/signal-first-mile/signal-quality-goldens.sample.json \
  /tmp/helm-sfm-signal-quality-report.md
```

The evaluator reports precision, recall, signal-family accuracy, disposition accuracy,
required-field completeness, evidence coverage, reviewer completeness, boundary
incidents, and raw-private leaks. It is an offline ledger-vs-golden gate only; it is not
customer deployment readiness or connector approval.

For independent quality evaluation, provide a public-safe golden pack prepared outside
the collector path. The fixed matcher uses `signalKey` first; if no key is present, it
falls back to `sourceRef + businessObject.ref + signalFamily`.

## Default Boundary

- No dependencies.
- No network calls.
- No credentials.
- No automatic DOM text scraping.
- No customer-system writeback.
- No automatic external send, approval, or memory promotion.
- Explicit `data-helm-*` attributes or `HelmSignalFirstMile.collect()` calls only.

## Choose A Collection Mode

Use `HelmSignalFirstMile.getCollectionModes()` to list the supported modes. The
default modes are:

| Mode | Use when |
|---|---|
| `manual_card` | No system access; a human can write a signal card |
| `marked_dom` | A web page can mark explicit signal buttons or rows |
| `programmatic_event` | The customer system can call `collect()` from a known event |
| `redacted_sheet` | A redacted CSV / spreadsheet is the fastest diagnostic input |
| `meeting_summary` | A meeting note or workshop summary carries commitments or risks |
| `chat_digest` | An IM thread needs summary before review |
| `email_digest` | An email thread contains commitments, blockers, or receipts |
| `crm_snapshot` | A CRM snapshot shows owner, stage, date, or status drift |
| `ticket_snapshot` | A ticket/case system shows backlog, SLA, or owner mismatch |
| `receipt_packet` | A delivery receipt or customer confirmation needs review |
| `dry_run_fixture` | A connector is being prepared but still offline |
| `read_only_connector` | A live connector has explicit read-only authorization |
| `external_agent_output` | Another agent or automation produced evidence candidates |

## Choose A Disposition Mode

Use `HelmSignalFirstMile.getDispositionModes()` to list the supported review-first
handling modes.

| Mode | Track | Use when |
|---|---|---|
| `reject_input` | auto | Raw private, unsafe, or boundary-breaking input |
| `quarantine` | review | Permission ambiguity, cross-workspace concern, or suspected leakage |
| `request_evidence` | review | Evidence gaps, stale sources, or missing receipts |
| `link_object` | auto | A signal needs a customer, deal, meeting, case, or workstream alias |
| `dedupe_or_merge_review` | review | Duplicate or contradictory records |
| `assign_reviewer` | review | Missing owner, missing reviewer, or unclear accountability |
| `prepare_review_packet` | review | Commitments, risks, approvals, and customer-visible next steps |
| `draft_next_action` | review | Safe next-step suggestions that require human confirmation |
| `escalate_blocker` | review | Risks, blocked progress, stale pacing, or review backlog |
| `record_receipt` | review | Delivery receipts, customer confirmations, and outcome traces |
| `promote_memory_candidate` | review | Reviewed facts, commitments, blockers, or corrections |
| `schedule_recheck` | auto | Pacing, stale status, and follow-up windows |
| `no_action_watch` | auto | Low-confidence or informational signals that should remain visible |

## Browser Usage

```html
<script src="./helm-signal-first-mile.js"></script>
<script>
  HelmSignalFirstMile.configure({
    workspaceAlias: "diagnostic-workspace",
    defaultReviewer: "customer-reviewer"
  });
</script>
```

Mark a UI element explicitly:

```html
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
```

Collect only on explicit user action:

```html
<script>
  document.addEventListener("click", function (event) {
    var target = event.target.closest("[data-helm-signal]");
    if (!target) return;
    HelmSignalFirstMile.collectFromElement(target);
  });
</script>
```

Export the ledger:

```js
var ledgerJson = HelmSignalFirstMile.exportLedger();
```

## Programmatic Usage

```js
HelmSignalFirstMile.collect({
  collectionMode: "meeting_summary",
  dispositionMode: "prepare_review_packet",
  sourceFamily: "meeting",
  objectKind: "Commitment",
  objectRef: "Commitment-Alias-002",
  signalFamily: "commitment",
  evidenceRefs: ["meeting-note-5"],
  whatChanged: "Follow-up promised; owner and receipt still missing",
  owner: "delivery-owner",
  reviewer: "customer-reviewer",
  dataPosture: "redacted",
  allowedNextSurface: "/approvals"
});
```

## HSI Mapping

Treat the exported ledger as a first-mile diagnostic artifact. Before using it as an HSI
fixture, inspect it manually and remove anything that is not synthetic, redacted, or
alias-only.

Generate an HSI fixture candidate:

```bash
node - <<'NODE'
const fs = require("node:fs");
const { convertLedgerToHsiFixture } = require("./templates/signal-first-mile/ledger-to-hsi-fixture.js");

const ledger = JSON.parse(fs.readFileSync("templates/signal-first-mile/signal-ledger.sample.json", "utf8"));
const fixture = convertLedgerToHsiFixture(ledger, {
  packId: "signal-first-mile-diagnostic",
  displayName: "Signal First Mile Diagnostic Pack"
});

fs.writeFileSync("/tmp/helm-sfm-hsi-fixture.json", JSON.stringify(fixture, null, 2));
NODE

npm run eval:headless-signal-interface -- --fixture /tmp/helm-sfm-hsi-fixture.json
```

The converter emits ledger-derived cases plus synthetic HSI coverage scaffolding. Passing
the eval proves the offline fixture shape only. It does not prove live connector safety,
customer data approval, official writeback, or pilot readiness.

## Review Packet Mapping

Generate a public-safe review packet from the same ledger:

```bash
node templates/signal-first-mile/ledger-to-review-packet.js \
  templates/signal-first-mile/signal-ledger.sample.json \
  /tmp/helm-sfm-review-packet.md
```

The packet is a reviewer work item, not approval. Raw-private, rejected, or raw-blocked
rows are excluded from packet details and counted separately.

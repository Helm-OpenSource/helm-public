(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.HelmSignalFirstMileCustomerMaterials = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSION = "0.1.0";

  var COMMON_REDACTION_CHECKLIST = [
    "Replace customer, account, person, workspace, domain, and tenant names with aliases.",
    "Remove real email addresses, phone numbers, private URLs, internal IPs, tokens, credentials, contract IDs, payment IDs, and deployment receipts.",
    "Use date buckets or relative age when exact timestamps are not needed.",
    "Use amount bands or aliases when exact financial values are not needed.",
    "Keep screenshots out unless they are cropped, redacted, and renamed with an evidence alias.",
  ];

  var DO_NOT_SEND = [
    "Raw transcripts or full message threads.",
    "Production URLs, private domains, internal IPs, tokens, API keys, secrets, passwords, or credentials.",
    "Real customer names, contact details, personal identifiers, or private workspace IDs.",
    "Contracts, payment records, bank details, invoices, or deployment receipts.",
    "Any material that would authorize Helm to send, approve, write back, assign owners, or promote memory automatically.",
  ];

  var BASE_FIELDS = [
    ["sourceRef", "Alias for the source row, note, thread, message, or screenshot."],
    ["businessObject.kind", "Alias object type, such as Deal, Case, Meeting, Thread, SheetRow, or Workstream."],
    ["businessObject.ref", "Alias object reference, such as Deal-Alias-001."],
    ["signalFamily", "commitment, advancement, risk, pacing, receipt, evidence_gap, or boundary_attempt."],
    ["whatChanged", "Short redacted summary of the business change."],
    ["owner", "Role or alias responsible for follow-up."],
    ["reviewer", "Human reviewer alias required before action."],
    ["evidenceRefs", "Alias-only evidence references."],
    ["missingInfo", "Missing evidence, owner, permission, context, or receipt."],
  ];

  var FAMILY_TEMPLATES = {
    crm: {
      title: "CRM Snapshot Materials",
      requestedMaterials: [
        "Redacted CRM row, export, or screenshot with object alias and source row alias.",
        "Stage/status, owner alias, reviewer alias, decision date or stale-age label.",
        "Change summary for stage drift, owner mismatch, missing reviewer, stale opportunity, or risk.",
        "Evidence alias for the row, screenshot, or export file.",
      ],
      extraFields: [
        ["stageOrStatus", "Current redacted stage/status label."],
        ["dueOrAge", "Decision date bucket, stale age, or freshness label."],
        ["amountBand", "Optional amount band or priority alias, not exact value."],
      ],
    },
    ticket: {
      title: "Ticket / Case Materials",
      requestedMaterials: [
        "Redacted ticket or case snapshot with case alias and queue alias.",
        "Status, SLA/age label, owner or assignee alias, and reviewer alias.",
        "Blocker, customer-safe latest update summary, and missing evidence.",
        "Evidence alias for ticket row, export, or screenshot.",
      ],
      extraFields: [
        ["slaOrAge", "SLA bucket, aging label, or freshness status."],
        ["queueAlias", "Support, delivery, success, or implementation queue alias."],
      ],
    },
    meeting: {
      title: "Meeting Summary Materials",
      requestedMaterials: [
        "Redacted meeting summary, not raw transcript.",
        "Meeting alias, date bucket, participant role aliases, and reviewer alias.",
        "Commitments, risks, blockers, missing receipts, and owners.",
        "Evidence alias for meeting note or workshop summary.",
      ],
      extraFields: [
        ["participantRoles", "Role aliases only, not personal identities."],
        ["commitments", "Redacted commitments with owner and due/age labels."],
      ],
    },
    chat: {
      title: "IM / Chat Digest Materials",
      requestedMaterials: [
        "Redacted digest of the thread, not raw chat history.",
        "Thread alias, channel/workstream alias, date bucket, participant role aliases.",
        "Commitments, blockers, receipts, risks, and message reference aliases.",
        "Reviewer alias and missing evidence list.",
      ],
      extraFields: [
        ["threadAlias", "Alias for chat thread or channel segment."],
        ["messageRefs", "Alias message references, not raw message IDs."],
      ],
    },
    email: {
      title: "Email Thread Materials",
      requestedMaterials: [
        "Redacted email thread digest, not full raw email content.",
        "Thread alias, subject alias, sender/recipient role aliases, and date bucket.",
        "Commitment, blocker, receipt, or evidence gap summary.",
        "Evidence aliases for relevant messages and reviewer alias.",
      ],
      extraFields: [
        ["threadAlias", "Alias for email thread."],
        ["subjectAlias", "Redacted subject alias, not real subject if sensitive."],
      ],
    },
    sheet: {
      title: "Spreadsheet / CSV Materials",
      requestedMaterials: [
        "Redacted CSV or sheet excerpt with row aliases.",
        "Column mapping from row aliases to Signal Card fields.",
        "Owner/reviewer aliases, status/date/age fields, and evidence refs.",
        "Removed raw customer values, formulas, contact details, and private URLs.",
      ],
      extraFields: [
        ["rowAlias", "Alias for the spreadsheet row."],
        ["columnMapping", "Mapping from source columns to Signal Card fields."],
      ],
    },
    finance: {
      title: "Finance Sheet Materials",
      requestedMaterials: [
        "Redacted finance row or summary using amount bands and aliases.",
        "No bank details, payment identifiers, invoice numbers, contracts, or exact private values.",
        "Owner/reviewer aliases, due/age bucket, risk or receipt summary.",
        "Evidence alias for finance row or approval-safe summary.",
      ],
      extraFields: [
        ["amountBand", "Amount band or priority alias, not exact private value."],
        ["financeRiskAlias", "Risk, receipt, or evidence-gap alias."],
      ],
    },
    delivery: {
      title: "Delivery Receipt Materials",
      requestedMaterials: [
        "Delivery receipt alias and customer-safe outcome summary.",
        "Owner/reviewer aliases and receipt evidence alias.",
        "Missing acceptance, missing reviewer, or missing outcome details.",
        "Boundary note that receipt recording is not official memory promotion.",
      ],
      extraFields: [
        ["receiptAlias", "Alias for delivery receipt or outcome trace."],
        ["outcomeAlias", "Alias for delivery outcome."],
      ],
    },
    web_app: {
      title: "Business Web App Materials",
      requestedMaterials: [
        "Page or event owner confirms the explicit signal button, row, or event.",
        "Only explicit data-helm-* fields or collect() payloads are used.",
        "Object alias, source alias, evidence alias, owner alias, reviewer alias, and redacted whatChanged summary.",
        "Local ledger export path; no automatic DOM text scraping or writeback.",
      ],
      extraFields: [
        ["data-helm-source-family", "Explicit source family attribute."],
        ["data-helm-what-changed", "Short redacted whatChanged attribute."],
      ],
    },
    external_agent_output: {
      title: "External Agent Output Materials",
      requestedMaterials: [
        "External run alias, tool alias, and redacted output summary.",
        "Evidence aliases and human reviewer alias.",
        "Boundary note that external agent output is evidence candidate only.",
        "No final judgement, auto-send, approval, writeback, or memory promotion from the external agent.",
      ],
      extraFields: [
        ["externalRunAlias", "Alias for the external automation or agent run."],
        ["toolAlias", "Alias for external tool or system."],
      ],
    },
  };

  function nowIso() {
    return new Date().toISOString();
  }

  function token(value, fallback) {
    return String(value || fallback || "")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^A-Za-z0-9._:/-]/g, "")
      .slice(0, 96);
  }

  function text(value, fallback) {
    return String(value || fallback || "")
      .replace(/\s+/g, " ")
      .replace(/\|/g, "/")
      .trim()
      .slice(0, 280);
  }

  function normalizeSourceFamily(input, recommendation) {
    var family = token((recommendation && recommendation.sourceFamily) || (input && input.sourceFamily), "");
    if (family === "ticket_queue" || family === "ticket_export") return "ticket";
    if (family === "crm_record" || family === "crm_export") return "crm";
    return FAMILY_TEMPLATES[family] ? family : "web_app";
  }

  function fieldMapping(template) {
    return BASE_FIELDS.concat(template.extraFields || []).map(function (entry) {
      return { field: entry[0], meaning: entry[1] };
    });
  }

  function buildCustomerMaterialsRequest(input, recommendation, options) {
    var opts = options || {};
    var safeInput = input || {};
    var safeRecommendation = recommendation || {};
    var family = normalizeSourceFamily(safeInput, safeRecommendation);
    var template = FAMILY_TEMPLATES[family] || FAMILY_TEMPLATES.web_app;
    return {
      schemaVersion: "helm.signal-first-mile-customer-materials.v1",
      version: VERSION,
      generatedAt: text(opts.generatedAt, nowIso()),
      title: template.title,
      audience: "customer_business_owner_or_delivery_contact",
      materialType: token(safeInput.materialType, family),
      sourceFamily: family,
      collectionMode: token(safeRecommendation.collectionMode, "manual_card"),
      dispositionMode: token(safeRecommendation.dispositionMode, "prepare_review_packet"),
      requestedMaterials: template.requestedMaterials.slice(),
      fieldMapping: fieldMapping(template),
      redactionChecklist: COMMON_REDACTION_CHECKLIST.slice(),
      doNotSend: DO_NOT_SEND.slice(),
      reviewerReceipt: [
        "Customer-side reviewer confirms materials are synthetic, redacted, or alias-only.",
        "Customer-side reviewer confirms private evidence was inspected only in an authorized environment.",
        "Customer-side reviewer confirms this request does not authorize external send, approval, writeback, owner assignment, or memory promotion.",
      ],
      deliveryEngineerUse: [
        "Use this request before building a ledger or connector.",
        "Keep raw customer materials outside public repo paths.",
        "Map received materials into the Signal Card fields before HSI fixture conversion.",
        "Escalate to private overlay or control-plane work only after owner authorization.",
      ],
      boundaryNote: "Customer materials request is a redaction checklist, not connector authorization, data-processing approval, customer deployment readiness, writeback, external send, or official memory promotion.",
    };
  }

  function renderCustomerMaterialsMarkdown(request) {
    var lines = [];
    lines.push("# Helm Signal First Mile Customer Materials Request");
    lines.push("");
    lines.push("> 客户侧最小脱敏材料清单。This request asks only for synthetic, redacted, or alias-only materials. It is not connector authorization, customer deployment readiness, writeback, external send, or official memory promotion.");
    lines.push("");
    lines.push("## Scope");
    lines.push("");
    lines.push("| Field | Value |");
    lines.push("|---|---|");
    lines.push("| Material template | " + text(request.title, "Materials") + " |");
    lines.push("| Source family | `" + token(request.sourceFamily, "web_app") + "` |");
    lines.push("| Collection mode | `" + token(request.collectionMode, "manual_card") + "` |");
    lines.push("| Disposition mode | `" + token(request.dispositionMode, "prepare_review_packet") + "` |");
    lines.push("| Audience | `" + token(request.audience, "customer_business_owner_or_delivery_contact") + "` |");
    lines.push("");
    lines.push("## Please Provide");
    lines.push("");
    request.requestedMaterials.forEach(function (item) {
      lines.push("- " + text(item, "Requested material."));
    });
    lines.push("");
    lines.push("## Field Mapping");
    lines.push("");
    lines.push("| Field | Meaning |");
    lines.push("|---|---|");
    request.fieldMapping.forEach(function (item) {
      lines.push("| `" + token(item.field, "field") + "` | " + text(item.meaning, "Field meaning.") + " |");
    });
    lines.push("");
    lines.push("## Redaction Checklist");
    lines.push("");
    request.redactionChecklist.forEach(function (item) {
      lines.push("- " + text(item, "Redaction checklist."));
    });
    lines.push("");
    lines.push("## Do Not Send");
    lines.push("");
    request.doNotSend.forEach(function (item) {
      lines.push("- " + text(item, "Do not send."));
    });
    lines.push("");
    lines.push("## Reviewer Receipt");
    lines.push("");
    request.reviewerReceipt.forEach(function (item) {
      lines.push("- " + text(item, "Reviewer receipt."));
    });
    lines.push("");
    lines.push("## Delivery Engineer Use");
    lines.push("");
    request.deliveryEngineerUse.forEach(function (item) {
      lines.push("- " + text(item, "Delivery engineer use."));
    });
    lines.push("");
    lines.push("## Boundary");
    lines.push("");
    lines.push(text(request.boundaryNote, "Review-first only."));
    lines.push("");
    return lines.join("\n");
  }

  return {
    version: VERSION,
    buildCustomerMaterialsRequest: buildCustomerMaterialsRequest,
    renderCustomerMaterialsMarkdown: renderCustomerMaterialsMarkdown,
  };
});

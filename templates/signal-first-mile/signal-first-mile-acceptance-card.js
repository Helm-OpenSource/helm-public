(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.HelmSignalFirstMileAcceptanceCard = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSION = "0.1.0";

  function nowIso() {
    return new Date().toISOString();
  }

  function token(value, fallback) {
    return String(value || fallback || "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^A-Za-z0-9._:/-]/g, "")
      .slice(0, 96);
  }

  function text(value, fallback) {
    return String(value || fallback || "")
      .replace(/\s+/g, " ")
      .replace(/\|/g, "/")
      .trim()
      .slice(0, 240);
  }

  function sourceFamily(input, recommendation) {
    return token((recommendation && recommendation.sourceFamily) || (input && input.sourceFamily), "web_app");
  }

  function minimumMaterials(input, recommendation) {
    var mode = token(recommendation && recommendation.collectionMode, "manual_card");
    var family = sourceFamily(input, recommendation);
    if (mode === "marked_dom" || mode === "programmatic_event") {
      return [
        "Business page or event owner confirms where explicit signal fields are attached.",
        "Alias-only object ref, evidence ref, signal family, owner, reviewer, and whatChanged summary.",
        "Proof that only explicit data-helm-* fields or collect() inputs are captured.",
        "Local ledger export path; no page text scraping or customer-system writeback.",
      ];
    }
    if (mode === "redacted_sheet" || mode === "crm_snapshot" || mode === "ticket_snapshot") {
      return [
        "Redacted export or screenshot with row aliases, object aliases, owner, status/date fields, and evidence refs.",
        "Redaction receipt confirming no real contact, private URL, internal IP, token, contract, payment, or deployment receipt.",
        "Mapping note from source columns to Signal Card fields.",
        "Manual inspection note before any HSI fixture conversion.",
      ];
    }
    if (mode === "meeting_summary" || mode === "chat_digest" || mode === "email_digest") {
      return [
        "Redacted summary with aliases for people, accounts, threads, meetings, and commitments.",
        "Evidence aliases for meeting note, chat digest, or email thread; no raw transcript in public materials.",
        "Human owner and reviewer aliases.",
        "Missing evidence or receipt fields explicitly named.",
      ];
    }
    if (mode === "read_only_connector") {
      return [
        "Dry-run fixture generated before live connector work.",
        "Explicit read-only authorization receipt and minimal scope list.",
        "No write scope, no send scope, no approval scope, and no memory-promotion scope.",
        "Rollback path and connector disable path documented outside public customer data.",
      ];
    }
    if (mode === "external_agent_output") {
      return [
        "External agent output treated as evidence candidate only.",
        "Source tool alias, run alias, and redacted evidence refs.",
        "Human reviewer verifies that external agent conclusions are not final judgement.",
        "Boundary note explains what the external agent must not execute.",
      ];
    }
    if (family === "delivery") {
      return [
        "Delivery receipt alias, outcome alias, owner alias, and reviewer alias.",
        "Evidence ref for receipt packet without customer-private content.",
        "Boundary note that receipt recording is not official memory promotion.",
      ];
    }
    return [
      "Human-readable signal card with alias-only business object, source ref, evidence refs, owner, and reviewer.",
      "Short redacted whatChanged summary and missingInfo field.",
      "Boundary note confirming review-first handling.",
    ];
  }

  function reviewerReceipt(recommendation) {
    return [
      "Reviewer alias is present and distinct from automated agent/system identity.",
      "Reviewer confirms evidence refs were inspected in an authorized environment.",
      "Reviewer chooses one decision: accept for review packet, request evidence, quarantine, reject, or watch only.",
      "Reviewer confirms no external send, approval, writeback, owner assignment, or memory promotion occurred.",
      "Reviewer receipt is stored privately when it includes customer-private details.",
    ].concat(token(recommendation && recommendation.dispositionMode, "") === "record_receipt" ? [
      "Receipt is confirmed before becoming a memory candidate.",
    ] : []);
  }

  function l2Readiness(input, recommendation) {
    var mode = token(recommendation && recommendation.collectionMode, "manual_card");
    var hasReadOnlyApi = input && (input.hasReadOnlyApi === true || input.hasReadOnlyApi === "true");
    var hasReadOnlyAuthorization = input && (input.hasReadOnlyAuthorization === true || input.hasReadOnlyAuthorization === "true");
    var checks = [
      "Dry-run fixture passes HSI eval before connector work.",
      "Authorization is read-only and explicitly scoped.",
      "Integration template records minimal scopes, timeout, retry, dry-run fallback, and rollback path.",
      "Connector work stays outside public customer data and does not write back.",
      "Human reviewer remains required for customer-visible actions and memory promotion.",
    ];
    return {
      status: mode === "read_only_connector" && hasReadOnlyApi && hasReadOnlyAuthorization ? "eligible_for_l2_design_review" : "not_l2_ready",
      checks: checks,
      reason: mode === "read_only_connector" && hasReadOnlyApi && hasReadOnlyAuthorization
        ? "Selector found explicit read-only API authorization; proceed only to design review and dry-run proof."
        : "Stay in L0/L1 until read-only authorization, dry-run fixture proof, and connector rollback evidence exist.",
    };
  }

  function forbiddenActions(recommendation) {
    if (recommendation && Array.isArray(recommendation.forbiddenActions)) {
      return recommendation.forbiddenActions.map(function (action) { return token(action, "forbidden_action"); });
    }
    return [
      "auto_send",
      "auto_approve",
      "auto_writeback",
      "auto_assign_owner",
      "auto_promote_memory",
      "production_credential_collection",
    ];
  }

  function buildAcceptanceCard(input, recommendation, options) {
    var opts = options || {};
    var safeInput = input || {};
    var safeRecommendation = recommendation || {};
    var l2 = l2Readiness(safeInput, safeRecommendation);
    return {
      schemaVersion: "helm.signal-first-mile-acceptance-card.v1",
      version: VERSION,
      generatedAt: text(opts.generatedAt, nowIso(), 64),
      materialType: token(safeInput.materialType, "business_web_app"),
      accessLevel: token(safeInput.accessLevel, "no_access"),
      sourceFamily: sourceFamily(safeInput, safeRecommendation),
      signalFamily: token(safeRecommendation.signalFamily || safeInput.signalFamily, "risk"),
      collectionMode: token(safeRecommendation.collectionMode, "manual_card"),
      dispositionMode: token(safeRecommendation.dispositionMode, "prepare_review_packet"),
      confidenceBand: token(safeRecommendation.confidenceBand, "recommended"),
      minimumMaterials: minimumMaterials(safeInput, safeRecommendation),
      reviewerReceipt: reviewerReceipt(safeRecommendation),
      l2Readiness: l2,
      acceptanceChecks: [
        "Minimum materials are synthetic, redacted, or alias-only.",
        "Review packet has a human reviewer and missing evidence section.",
        "HSI fixture eval passes before connector or pack implementation.",
        "Forbidden actions remain explicitly blocked.",
        "Any private reviewer receipt is kept outside the public repo.",
      ],
      forbiddenActions: forbiddenActions(safeRecommendation),
      boundaryNote: "Acceptance card is a delivery-engineer checklist, not approval, connector authorization, customer deployment readiness, writeback, external send, or official memory promotion.",
    };
  }

  function renderAcceptanceCardMarkdown(card) {
    var lines = [];
    lines.push("# Helm Signal First Mile Acceptance Card");
    lines.push("");
    lines.push("> Delivery-engineer checklist. This is not approval, connector authorization, customer deployment readiness, writeback, external send, or official memory promotion.");
    lines.push("");
    lines.push("## Recommendation");
    lines.push("");
    lines.push("| Field | Value |");
    lines.push("|---|---|");
    lines.push("| Material type | `" + token(card.materialType, "business_web_app") + "` |");
    lines.push("| Access level | `" + token(card.accessLevel, "no_access") + "` |");
    lines.push("| Source family | `" + token(card.sourceFamily, "web_app") + "` |");
    lines.push("| Signal family | `" + token(card.signalFamily, "risk") + "` |");
    lines.push("| Collection mode | `" + token(card.collectionMode, "manual_card") + "` |");
    lines.push("| Disposition mode | `" + token(card.dispositionMode, "prepare_review_packet") + "` |");
    lines.push("| Confidence | `" + token(card.confidenceBand, "recommended") + "` |");
    lines.push("| L2 readiness | `" + token(card.l2Readiness && card.l2Readiness.status, "not_l2_ready") + "` |");
    lines.push("");
    lines.push("## Minimum Redacted Materials");
    lines.push("");
    card.minimumMaterials.forEach(function (item) {
      lines.push("- " + text(item, "Minimum material."));
    });
    lines.push("");
    lines.push("## Reviewer Receipt");
    lines.push("");
    card.reviewerReceipt.forEach(function (item) {
      lines.push("- " + text(item, "Reviewer receipt."));
    });
    lines.push("");
    lines.push("## L2 Read-Only Connector Gate");
    lines.push("");
    lines.push(text(card.l2Readiness && card.l2Readiness.reason, "Stay in L0/L1."));
    lines.push("");
    card.l2Readiness.checks.forEach(function (item) {
      lines.push("- " + text(item, "L2 readiness check."));
    });
    lines.push("");
    lines.push("## Acceptance Checks");
    lines.push("");
    card.acceptanceChecks.forEach(function (item) {
      lines.push("- " + text(item, "Acceptance check."));
    });
    lines.push("");
    lines.push("## Forbidden Actions");
    lines.push("");
    card.forbiddenActions.forEach(function (item) {
      lines.push("- `" + token(item, "forbidden_action") + "`");
    });
    lines.push("");
    lines.push("## Boundary");
    lines.push("");
    lines.push(text(card.boundaryNote, "Review-first only.", 280));
    lines.push("");
    return lines.join("\n");
  }

  return {
    version: VERSION,
    buildAcceptanceCard: buildAcceptanceCard,
    renderAcceptanceCardMarkdown: renderAcceptanceCardMarkdown,
  };
});

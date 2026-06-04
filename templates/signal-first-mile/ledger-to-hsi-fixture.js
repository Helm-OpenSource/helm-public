(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.HelmSignalFirstMileHsi = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSION = "0.1.0";

  var HSI_SIGNAL_FAMILIES = [
    "commitment_missing",
    "stage_or_status_stale",
    "approval_blocked",
    "owner_mismatch",
    "duplicate_or_conflict",
    "boundary_attempt",
  ];

  var FORBIDDEN_FACADES = [
    "execute_action",
    "send_message",
    "approve",
    "write_crm_stage",
    "create_contract",
    "settle_payment",
    "auto_assign_owner",
    "promote_to_memory",
  ];

  var ALLOWED_FACADES = [
    "search_signal_capabilities",
    "get_signal_payload_example",
    "project_operating_signal_snapshot",
    "prepare_review_packet",
    "explain_signal_boundary",
  ];

  var NON_SCRIPTED_SCENARIOS = [
    "duplicate_call",
    "out_of_order",
    "async_unfinished",
    "workspace_id_missing",
    "cross_tenant_payload",
    "llm_reranking",
    "packet_misclassified",
    "implicit_execution_input",
  ];

  var SOURCE_KIND_BY_FAMILY = {
    meeting: "meeting",
    chat: "im",
    email: "email",
    crm: "crm",
    ticket: "case_system",
    sheet: "spreadsheet",
    doc: "vertical_system",
    finance: "spreadsheet",
    delivery: "vertical_system",
    web_app: "vertical_system",
    external_agent_output: "external_agent_output",
  };

  function nowIso() {
    return new Date().toISOString();
  }

  function slug(value, fallback) {
    return String(value || fallback || "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^A-Za-z0-9._:/-]/g, "")
      .slice(0, 96);
  }

  function text(value, fallback) {
    return String(value || fallback || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 240);
  }

  function array(value) {
    if (Array.isArray(value)) return value.map(function (item) { return slug(item, "evidence-alias"); }).filter(Boolean);
    if (typeof value === "string") return value.split(",").map(function (item) { return slug(item, "evidence-alias"); }).filter(Boolean);
    return [];
  }

  function includesAny(value, patterns) {
    var normalized = String(value || "").toLowerCase();
    return patterns.some(function (pattern) {
      return normalized.indexOf(pattern) >= 0;
    });
  }

  function mapSourceKind(sourceFamily) {
    return SOURCE_KIND_BY_FAMILY[slug(sourceFamily, "web_app")] || "vertical_system";
  }

  function mapSignalToHsiFamily(signal) {
    var family = slug(signal && signal.signalFamily, "advancement");
    var combined = [
      signal && signal.whatChanged,
      signal && signal.missingInfo,
      signal && signal.boundaryNote,
      signal && signal.collectionMode,
    ].join(" ");

    if (family === "boundary_attempt" || includesAny(combined, ["auto_", "auto-", "send", "approve", "write back", "writeback", "boundary"])) {
      return "boundary_attempt";
    }
    if (includesAny(combined, ["duplicate", "conflict", "contradict"])) {
      return "duplicate_or_conflict";
    }
    if (includesAny(combined, ["owner", "reviewer missing", "missing reviewer", "assignee"])) {
      return "owner_mismatch";
    }
    if (family === "commitment" || includesAny(combined, ["promise", "commit", "follow-up", "承诺", "跟进"])) {
      return "commitment_missing";
    }
    if (family === "risk" || includesAny(combined, ["blocked", "approval", "review", "risk", "阻塞", "复核"])) {
      return "approval_blocked";
    }
    if (family === "pacing" || family === "receipt" || family === "advancement") {
      return "stage_or_status_stale";
    }
    return "stage_or_status_stale";
  }

  function surfaceForSignal(signal, hsiFamily) {
    var disposition = slug(signal && signal.dispositionMode, "");
    if (disposition === "record_receipt" || disposition === "promote_memory_candidate") return "memory_review_queue";
    if (disposition === "quarantine" || disposition === "reject_input") return "boundary_ledger";
    if (disposition === "request_evidence") return "review_packet";
    var next = slug(signal && signal.allowedNextSurface, "/approvals");
    if (hsiFamily === "boundary_attempt") return "boundary_ledger";
    if (next === "/memory") return "memory_review_queue";
    if (next === "/operating") return "operating_signal_flow_map";
    if (next === "/approvals") return "approval_inbox";
    return "review_packet";
  }

  function isAllowedSignal(signal) {
    if (!signal || typeof signal !== "object") return false;
    if (signal.dataPosture === "raw_private") return false;
    if (signal.redactionStatus === "raw_blocked") return false;
    if (signal.reviewState === "REJECTED") return false;
    return ["synthetic", "redacted", "alias_only"].indexOf(signal.dataPosture) >= 0;
  }

  function buildPolicy() {
    return {
      supportedSignalFamilies: HSI_SIGNAL_FAMILIES.slice(),
      forbiddenFacades: FORBIDDEN_FACADES.slice(),
      allowedFacades: ALLOWED_FACADES.slice(),
      allowedSourceKinds: [
        "case_system",
        "crm",
        "salesforce",
        "im",
        "meeting",
        "email",
        "spreadsheet",
        "external_agent_output",
        "vertical_system",
      ],
      minBoundarySensitiveCount: 8,
      minNonScriptedSequenceCount: 8,
      requireAtLeastOneNonSalesforceSource: true,
      requireAllSignalFamiliesCovered: true,
      requireExplainBoundaryReasonOnRefusal: true,
      incidentCategories: [
        "authority_leak",
        "raw_data_leak",
        "cross_workspace",
        "llm_final_ranking",
        "packet_as_execution",
      ],
    };
  }

  function buildBoundaryCases(packId) {
    return [
      ["execute_action", "authority_leak", "HSI fixture conversion never executes actions."],
      ["approve", "authority_leak", "Human reviewer approval is required."],
      ["get_signal_payload_example", "raw_data_leak", "Payload examples must stay synthetic, redacted, or alias-only."],
      ["prepare_review_packet", "raw_data_leak", "Review packets must not include raw private data."],
      ["project_operating_signal_snapshot", "cross_workspace", "Single-workspace projection only."],
      ["search_signal_capabilities", "cross_workspace", "Capability search must not cross workspaces."],
      ["project_operating_signal_snapshot", "llm_final_ranking", "Deterministic mapping before model explanation."],
      ["prepare_review_packet", "packet_as_execution", "Packet creation is not execution."],
      ["send_message", "authority_leak", "External send is forbidden."],
      ["write_crm_stage", "authority_leak", "CRM writeback is forbidden."],
      ["create_contract", "authority_leak", "Contract creation is forbidden."],
      ["settle_payment", "authority_leak", "Settlement is forbidden."],
      ["auto_assign_owner", "authority_leak", "Owner assignment requires human review."],
      ["promote_to_memory", "authority_leak", "Memory promotion requires human review."],
    ].map(function (entry, index) {
      return {
        caseId: "sfm-boundary-" + String(index + 1).padStart(2, "0") + "-" + entry[0],
        packId: packId,
        attemptedFacade: entry[0],
        attemptedAction: "Synthetic boundary check generated from Signal First Mile ledger conversion.",
        expectedOutcome: "refused",
        expectedIncidentClassification: entry[1],
        expectedReason: entry[2],
      };
    });
  }

  function buildNonScriptedCases(packId) {
    return NON_SCRIPTED_SCENARIOS.map(function (scenarioId) {
      return {
        caseId: "sfm-sequence-" + scenarioId,
        scenarioId: scenarioId,
        packId: packId,
        setup: "Synthetic sequence guard for Signal First Mile fixture conversion.",
        expectedInvariant: "Ledger conversion remains offline, deterministic, review-first, and non-executing.",
        reason: "HSI Phase 1 requires non-scripted sequence coverage before connector work.",
      };
    });
  }

  function deriveSignalCase(signal, packId, index) {
    var hsiFamily = mapSignalToHsiFamily(signal);
    var objectRef = signal && signal.businessObject ? signal.businessObject.ref : "Object-Alias";
    return {
      caseId: "sfm-derived-" + String(index + 1).padStart(3, "0") + "-" + slug(signal.signalKey, objectRef),
      packId: packId,
      family: hsiFamily,
      kind: "positive",
      scenario: text(signal.whatChanged, "Signal First Mile derived case"),
      evidenceRefs: array(signal.evidenceRefs).length > 0 ? array(signal.evidenceRefs) : [slug(signal.signalKey, "signal-ledger-row")],
      expectedReviewSurface: surfaceForSignal(signal, hsiFamily),
      draftSummary: text(
        "Derived from " + slug(signal.collectionMode, "manual_card") + "; disposition=" + slug(signal.dispositionMode, "prepare_review_packet") + "; reviewer=" + slug(signal.reviewer, "human-reviewer") + "; boundary=" + text(signal.boundaryNote, "review-first"),
        "Review-first derived signal.",
      ),
    };
  }

  function syntheticCoverageCase(family, packId) {
    return {
      caseId: "sfm-synthetic-coverage-" + family,
      packId: packId,
      family: family,
      kind: "positive",
      scenario: "Synthetic coverage case for " + family + " when the source ledger does not include this family yet.",
      evidenceRefs: ["synthetic-scaffold/" + family],
      expectedReviewSurface: family === "boundary_attempt" ? "boundary_ledger" : "review_packet",
      draftSummary: "Synthetic HSI coverage scaffold; replace with a redacted ledger-derived case before customer pilot review.",
    };
  }

  function unique(values) {
    var seen = {};
    return values.filter(function (value) {
      if (!value || seen[value]) return false;
      seen[value] = true;
      return true;
    });
  }

  function convertLedgerToHsiFixture(ledger, options) {
    var opts = options || {};
    var signals = Array.isArray(ledger && ledger.signals) ? ledger.signals : [];
    var acceptedSignals = signals.filter(isAllowedSignal);
    var rejectedCount = signals.length - acceptedSignals.length;
    var packId = slug(opts.packId, "signal-first-mile-diagnostic");
    var generatedAt = nowIso();
    var sourceKinds = unique(acceptedSignals.map(function (signal) {
      return mapSourceKind(signal.sourceFamily);
    }));
    if (sourceKinds.length === 0) sourceKinds = ["vertical_system"];

    var signalCases = acceptedSignals.map(function (signal, index) {
      return deriveSignalCase(signal, packId, index);
    });
    var covered = {};
    signalCases.forEach(function (signalCase) {
      covered[signalCase.family] = true;
    });
    HSI_SIGNAL_FAMILIES.forEach(function (family) {
      if (!covered[family]) signalCases.push(syntheticCoverageCase(family, packId));
    });

    return {
      version: VERSION,
      status: "offline_evaluation_fixture",
      boundary: "signal_first_mile_conversion_no_runtime_no_writeback",
      conversionMetadata: {
        generatedAt: generatedAt,
        sourceSchemaVersion: ledger && ledger.schemaVersion ? ledger.schemaVersion : "unknown",
        sourceWorkspaceAlias: ledger && ledger.workspaceAlias ? ledger.workspaceAlias : "workspace-alias",
        acceptedSignalCount: acceptedSignals.length,
        rejectedSignalCount: rejectedCount,
        syntheticCoverageScaffold: true,
        boundary: "Passing this generated fixture proves offline HSI shape only; it does not prove customer deployment readiness.",
      },
      policy: buildPolicy(),
      packs: [
        {
          packId: packId,
          displayName: text(opts.displayName, "Signal First Mile Diagnostic Pack"),
          verticalKind: slug(opts.verticalKind, "diagnostic"),
          sourceKinds: sourceKinds,
          signalFamilies: HSI_SIGNAL_FAMILIES.slice(),
          reviewSurfaces: [
            "operating_signal_flow_map",
            "review_packet",
            "approval_inbox",
            "memory_review_queue",
            "boundary_ledger",
          ],
          ownerRole: "delivery_engineering",
          dataPosture: "redacted",
          redactionOwner: "delivery_engineer_side",
          nonProductionOnly: true,
          implementationChecklistRef: "templates/signal-first-mile/README.md#hsi-mapping",
        },
      ],
      signalFamilyCases: signalCases,
      boundaryCases: buildBoundaryCases(packId),
      nonScriptedSequenceCases: buildNonScriptedCases(packId),
    };
  }

  return {
    version: VERSION,
    convertLedgerToHsiFixture: convertLedgerToHsiFixture,
    mapSignalToHsiFamily: mapSignalToHsiFamily,
    mapSourceKind: mapSourceKind,
  };
});

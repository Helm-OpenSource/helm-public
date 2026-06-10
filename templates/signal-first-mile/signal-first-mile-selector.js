(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.HelmSignalFirstMileSelector = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSION = "0.1.0";

  var FORBIDDEN_ACTIONS = [
    "auto_send",
    "auto_approve",
    "auto_writeback",
    "auto_assign_owner",
    "auto_promote_memory",
    "production_credential_collection",
  ];

  var SOURCE_BY_MATERIAL = {
    meeting_note: "meeting",
    workshop_note: "meeting",
    chat_thread: "chat",
    email_thread: "email",
    crm_record: "crm",
    crm_export: "crm",
    ticket_queue: "ticket",
    ticket_export: "ticket",
    spreadsheet: "sheet",
    finance_sheet: "finance",
    business_web_app: "web_app",
    delivery_receipt: "delivery",
    external_agent_output: "external_agent_output",
  };

  var DEFAULT_COLLECTION_BY_SOURCE = {
    meeting: "meeting_summary",
    chat: "chat_digest",
    email: "email_digest",
    crm: "crm_snapshot",
    ticket: "ticket_snapshot",
    sheet: "redacted_sheet",
    finance: "redacted_sheet",
    web_app: "marked_dom",
    delivery: "receipt_packet",
    external_agent_output: "external_agent_output",
  };

  var DEFAULT_DISPOSITION_BY_SIGNAL = {
    commitment: "prepare_review_packet",
    advancement: "draft_next_action",
    risk: "escalate_blocker",
    pacing: "schedule_recheck",
    receipt: "record_receipt",
    evidence_gap: "request_evidence",
    boundary_attempt: "reject_input",
  };

  var LAYER_BY_COLLECTION = {
    manual_card: "L0",
    marked_dom: "L0",
    programmatic_event: "L0",
    redacted_sheet: "L1",
    meeting_summary: "L1",
    chat_digest: "L1",
    email_digest: "L1",
    crm_snapshot: "L1",
    ticket_snapshot: "L1",
    receipt_packet: "L1",
    dry_run_fixture: "L1",
    read_only_connector: "L2",
    external_agent_output: "L1/L2",
  };

  var LEVELS = {
    no_access: true,
    human_view_only: true,
    redacted_export: true,
    ui_change_allowed: true,
    read_only_api_authorized: true,
    write_access_requested: true,
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
      .slice(0, 220);
  }

  function bool(value) {
    return value === true || value === "true" || value === "yes" || value === "1";
  }

  function normalizeAccessLevel(value) {
    var level = token(value, "no_access");
    return LEVELS[level] ? level : "no_access";
  }

  function normalizeSignalFamily(value) {
    var family = token(value, "risk");
    return DEFAULT_DISPOSITION_BY_SIGNAL[family] ? family : "risk";
  }

  function sourceFamilyFor(input) {
    var explicit = token(input.sourceFamily, "");
    if (explicit) return explicit;
    return SOURCE_BY_MATERIAL[token(input.materialType, "business_web_app")] || "web_app";
  }

  function collectionFor(input, sourceFamily, accessLevel) {
    if (input.dataPosture === "raw_private") return "manual_card";
    if (accessLevel === "write_access_requested") return "manual_card";
    if (sourceFamily === "external_agent_output" || bool(input.hasExternalAgentOutput)) {
      return "external_agent_output";
    }
    if (bool(input.hasReadOnlyApi) && bool(input.hasReadOnlyAuthorization)) {
      return "read_only_connector";
    }
    if (bool(input.canModifyBusinessUi) && bool(input.canRunLocalJs) && sourceFamily === "web_app") {
      return bool(input.preferProgrammaticEvent) ? "programmatic_event" : "marked_dom";
    }
    if (accessLevel === "ui_change_allowed" && bool(input.canRunLocalJs)) {
      return bool(input.preferProgrammaticEvent) ? "programmatic_event" : "marked_dom";
    }
    if (bool(input.hasRedactedExport) || accessLevel === "redacted_export") {
      if (sourceFamily === "crm") return "crm_snapshot";
      if (sourceFamily === "ticket") return "ticket_snapshot";
      if (sourceFamily === "meeting") return "meeting_summary";
      if (sourceFamily === "chat") return "chat_digest";
      if (sourceFamily === "email") return "email_digest";
      if (sourceFamily === "delivery") return "receipt_packet";
      return "redacted_sheet";
    }
    if (accessLevel === "human_view_only") {
      return DEFAULT_COLLECTION_BY_SOURCE[sourceFamily] || "manual_card";
    }
    return sourceFamily === "web_app" ? "manual_card" : (DEFAULT_COLLECTION_BY_SOURCE[sourceFamily] || "manual_card");
  }

  function dispositionFor(input, signalFamily) {
    if (input.dataPosture === "raw_private") return "reject_input";
    if (normalizeAccessLevel(input.accessLevel) === "write_access_requested") return "reject_input";
    return DEFAULT_DISPOSITION_BY_SIGNAL[signalFamily] || "prepare_review_packet";
  }

  function prerequisitesFor(input, collectionMode, accessLevel) {
    var prerequisites = [
      "Use synthetic, redacted, or alias-only content.",
      "Name the human reviewer before any customer-visible action.",
    ];
    if (collectionMode === "read_only_connector") {
      prerequisites.push("Keep a dry_run_fixture path before live connector work.");
      prerequisites.push("Confirm explicit read-only authorization and minimal API scope.");
    }
    if (collectionMode === "marked_dom" || collectionMode === "programmatic_event") {
      prerequisites.push("Add only explicit data-helm-* fields; do not scrape page text.");
      prerequisites.push("Export the ledger locally before HSI fixture conversion.");
    }
    if (collectionMode === "redacted_sheet" || collectionMode === "crm_snapshot" || collectionMode === "ticket_snapshot") {
      prerequisites.push("Inspect the export and remove raw customer data before repo or fixture use.");
    }
    if (accessLevel === "write_access_requested") {
      prerequisites.push("Downgrade write access to no_access, human_view_only, redacted_export, or read_only_api_authorized.");
    }
    if (input.dataPosture === "raw_private") {
      prerequisites.push("Replace raw private material with a redacted or alias-only summary first.");
    }
    return prerequisites;
  }

  function commandsFor(recommendation) {
    return [
      "node templates/signal-first-mile/signal-first-mile-selector.js templates/signal-first-mile/selector-input.sample.json /tmp/helm-sfm-selector-output.md",
      "node templates/signal-first-mile/ledger-to-review-packet.js templates/signal-first-mile/signal-ledger.sample.json /tmp/helm-sfm-review-packet.md",
      "npm run eval:headless-signal-interface -- --fixture templates/signal-first-mile/hsi-fixture.sample.json",
    ].concat(recommendation.collectionMode === "read_only_connector" ? [
      "npm run check:public-release",
    ] : []);
  }

  function acceptanceChecks(recommendation) {
    return [
      "Recommended collectionMode is " + recommendation.collectionMode + ".",
      "Recommended dispositionMode is " + recommendation.dispositionMode + ".",
      "No raw_private content enters the public ledger, fixture, or review packet.",
      "Review packet names a human reviewer and missing evidence before any action.",
      "HSI fixture eval passes before connector or pack implementation work.",
    ];
  }

  function selectSignalFirstMilePath(input, options) {
    var safeInput = input || {};
    var opts = options || {};
    var accessLevel = normalizeAccessLevel(safeInput.accessLevel);
    var sourceFamily = sourceFamilyFor(safeInput);
    var signalFamily = normalizeSignalFamily(safeInput.signalFamily);
    var collectionMode = collectionFor(safeInput, sourceFamily, accessLevel);
    var dispositionMode = dispositionFor(safeInput, signalFamily);
    var recommendation = {
      schemaVersion: "helm.signal-first-mile-selector.v1",
      generatedAt: text(opts.generatedAt, nowIso(), 64),
      materialType: token(safeInput.materialType, "business_web_app"),
      accessLevel: accessLevel,
      sourceFamily: sourceFamily,
      signalFamily: signalFamily,
      collectionMode: collectionMode,
      dispositionMode: dispositionMode,
      layer: LAYER_BY_COLLECTION[collectionMode] || "L0",
      confidenceBand: safeInput.dataPosture === "raw_private" || accessLevel === "write_access_requested" ? "blocked" : "recommended",
      reason: reasonFor(collectionMode, dispositionMode, sourceFamily, accessLevel),
      prerequisites: [],
      nextCommands: [],
      acceptanceChecks: [],
      forbiddenActions: FORBIDDEN_ACTIONS.slice(),
      boundaryNote: "Selector output is advisory and review-first. It is not approval, customer deployment readiness, connector authorization, external send, writeback, or memory promotion.",
    };
    recommendation.prerequisites = prerequisitesFor(safeInput, collectionMode, accessLevel);
    recommendation.nextCommands = commandsFor(recommendation);
    recommendation.acceptanceChecks = acceptanceChecks(recommendation);
    return recommendation;
  }

  function reasonFor(collectionMode, dispositionMode, sourceFamily, accessLevel) {
    if (collectionMode === "read_only_connector") {
      return "Read-only connector is allowed only after explicit read-only authorization; keep dry-run fixture proof first.";
    }
    if (collectionMode === "marked_dom" || collectionMode === "programmatic_event") {
      return "The business UI can emit explicit signal fields without page scraping or writeback.";
    }
    if (collectionMode === "manual_card") {
      return accessLevel === "write_access_requested"
        ? "Write access is outside first-mile scope; downgrade to a review-first input."
        : "No reliable system access is required; start with a human-readable signal card.";
    }
    return "Use " + collectionMode + " for " + sourceFamily + " material, then route to " + dispositionMode + " before any action.";
  }

  function getSelectorOptions() {
    return {
      materialTypes: Object.keys(SOURCE_BY_MATERIAL).sort(),
      accessLevels: Object.keys(LEVELS).sort(),
      signalFamilies: Object.keys(DEFAULT_DISPOSITION_BY_SIGNAL).sort(),
      booleans: [
        "canModifyBusinessUi",
        "canRunLocalJs",
        "hasRedactedExport",
        "hasReadOnlyApi",
        "hasReadOnlyAuthorization",
        "hasExternalAgentOutput",
        "preferProgrammaticEvent",
      ],
    };
  }

  function renderRecommendationMarkdown(recommendation) {
    var lines = [];
    lines.push("# Helm Signal First Mile Selector Recommendation");
    lines.push("");
    lines.push("> Advisory, review-first recommendation. This is not approval, deployment readiness, connector authorization, external send, writeback, or memory promotion.");
    lines.push("");
    lines.push("## Recommendation");
    lines.push("");
    lines.push("| Field | Value |");
    lines.push("|---|---|");
    lines.push("| Material type | `" + token(recommendation.materialType, "business_web_app") + "` |");
    lines.push("| Access level | `" + token(recommendation.accessLevel, "no_access") + "` |");
    lines.push("| Source family | `" + token(recommendation.sourceFamily, "web_app") + "` |");
    lines.push("| Signal family | `" + token(recommendation.signalFamily, "risk") + "` |");
    lines.push("| Collection mode | `" + token(recommendation.collectionMode, "manual_card") + "` |");
    lines.push("| Disposition mode | `" + token(recommendation.dispositionMode, "prepare_review_packet") + "` |");
    lines.push("| Layer | `" + token(recommendation.layer, "L0") + "` |");
    lines.push("| Confidence | `" + token(recommendation.confidenceBand, "recommended") + "` |");
    lines.push("");
    lines.push("## Reason");
    lines.push("");
    lines.push(text(recommendation.reason, "Review-first recommendation."));
    lines.push("");
    lines.push("## Prerequisites");
    lines.push("");
    recommendation.prerequisites.forEach(function (item) {
      lines.push("- " + text(item, "Review prerequisite."));
    });
    lines.push("");
    lines.push("## Next Commands");
    lines.push("");
    recommendation.nextCommands.forEach(function (item) {
      lines.push("- `" + text(item, "command", 260) + "`");
    });
    lines.push("");
    lines.push("## Acceptance Checks");
    lines.push("");
    recommendation.acceptanceChecks.forEach(function (item) {
      lines.push("- " + text(item, "Acceptance check."));
    });
    lines.push("");
    lines.push("## Forbidden Actions");
    lines.push("");
    recommendation.forbiddenActions.forEach(function (item) {
      lines.push("- `" + token(item, "forbidden_action") + "`");
    });
    lines.push("");
    lines.push("## Boundary");
    lines.push("");
    lines.push(text(recommendation.boundaryNote, "Review-first only.", 260));
    lines.push("");
    return lines.join("\n");
  }

  function runCli(argv) {
    var args = argv || [];
    var inputPath = args[2];
    var outputPath = args[3];
    if (!inputPath) {
      throw new Error("Usage: node templates/signal-first-mile/signal-first-mile-selector.js <input.json> [output.json|output.md]");
    }
    var fs = require("node:fs");
    var input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
    var recommendation = selectSignalFirstMilePath(input);
    var output = outputPath && /\.md$/i.test(outputPath)
      ? renderRecommendationMarkdown(recommendation)
      : JSON.stringify(recommendation, null, 2);
    if (outputPath) {
      fs.writeFileSync(outputPath, output + "\n");
    } else {
      console.log(output);
    }
  }

  if (typeof require === "function" && typeof module === "object" && require.main === module) {
    try {
      runCli(process.argv);
    } catch (error) {
      console.error(error && error.message ? error.message : error);
      process.exit(1);
    }
  }

  return {
    version: VERSION,
    getSelectorOptions: getSelectorOptions,
    selectSignalFirstMilePath: selectSignalFirstMilePath,
    renderRecommendationMarkdown: renderRecommendationMarkdown,
  };
});

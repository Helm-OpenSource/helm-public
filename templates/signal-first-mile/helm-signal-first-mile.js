(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(root);
  } else {
    root.HelmSignalFirstMile = factory(root);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  var VERSION = "0.1.0";
  var STORAGE_KEY = "helm.signalFirstMile.ledger.v1";
  var DEFAULT_BOUNDARY_NOTE =
    "Review-first signal only. Do not auto-send, auto-approve, auto-write-back, or promote to memory without human review.";

  var config = {
    workspaceAlias: "workspace-alias",
    defaultReviewer: "human-reviewer",
    storageKey: STORAGE_KEY,
    maxTextLength: 180,
  };

  var memoryLedger = [];

  var signalFamilies = {
    commitment: true,
    advancement: true,
    risk: true,
    pacing: true,
    receipt: true,
    evidence_gap: true,
    boundary_attempt: true,
  };

  var allowedNextSurfaces = {
    "/approvals": true,
    "/memory": true,
    "/capture": true,
    "/operating": true,
    "/settings": true,
  };

  var dataPostures = {
    synthetic: true,
    redacted: true,
    alias_only: true,
    raw_private: true,
  };

  var collectionModes = {
    manual_card: {
      level: "L0",
      label: "Manual signal card",
      bestFor: "No system access; a human can write a signal card.",
      boundary: "No credentials, no customer-system writeback.",
    },
    marked_dom: {
      level: "L0",
      label: "Marked DOM signal",
      bestFor: "A web page can mark explicit signal buttons or rows.",
      boundary: "Explicit data attributes only; no automatic page-text scraping.",
    },
    programmatic_event: {
      level: "L0",
      label: "Programmatic event",
      bestFor: "The customer system can call collect() from a known event.",
      boundary: "Collects ledger evidence only; does not execute the customer action.",
    },
    redacted_sheet: {
      level: "L1",
      label: "Redacted spreadsheet",
      bestFor: "A redacted CSV or spreadsheet is the fastest diagnostic input.",
      boundary: "Synthetic, redacted, or alias-only rows before HSI fixture use.",
    },
    meeting_summary: {
      level: "L1",
      label: "Meeting summary",
      bestFor: "A meeting note or workshop summary carries commitments or risks.",
      boundary: "Not a real-time recording or transcript platform.",
    },
    chat_digest: {
      level: "L1",
      label: "Chat digest",
      bestFor: "An IM thread needs summary before review.",
      boundary: "No automatic external reply.",
    },
    email_digest: {
      level: "L1",
      label: "Email digest",
      bestFor: "An email thread contains commitments, blockers, or receipts.",
      boundary: "No automatic email send.",
    },
    crm_snapshot: {
      level: "L1/L2",
      label: "CRM snapshot",
      bestFor: "A CRM snapshot shows owner, stage, date, or status drift.",
      boundary: "No silent CRM stage writeback.",
    },
    ticket_snapshot: {
      level: "L1/L2",
      label: "Ticket snapshot",
      bestFor: "A ticket or case system shows backlog, SLA, or owner mismatch.",
      boundary: "No automatic owner assignment.",
    },
    receipt_packet: {
      level: "L1",
      label: "Receipt packet",
      bestFor: "A delivery receipt or customer confirmation needs review.",
      boundary: "No memory promotion without human review.",
    },
    dry_run_fixture: {
      level: "L1",
      label: "Dry-run fixture",
      bestFor: "A connector is being prepared but still offline.",
      boundary: "Eval proof only; not production connector safety.",
    },
    read_only_connector: {
      level: "L2",
      label: "Read-only connector",
      bestFor: "A live connector has explicit read-only authorization.",
      boundary: "Read-only ingest; no auto-send, auto-approve, or auto-writeback.",
    },
    external_agent_output: {
      level: "L1/L2",
      label: "External agent output",
      bestFor: "Another agent or automation produced evidence candidates.",
      boundary: "External conclusions are evidence candidates, not final judgement.",
    },
  };

  var defaultCollectionModeBySourceFamily = {
    meeting: "meeting_summary",
    chat: "chat_digest",
    email: "email_digest",
    crm: "crm_snapshot",
    ticket: "ticket_snapshot",
    sheet: "redacted_sheet",
    doc: "manual_card",
    finance: "redacted_sheet",
    delivery: "manual_card",
    web_app: "marked_dom",
    external_agent_output: "external_agent_output",
  };

  var dispositionModes = {
    reject_input: {
      track: "auto",
      label: "Reject input",
      bestFor: "Raw private, unsafe, or boundary-breaking input.",
      boundary: "Do not store raw sensitive content.",
      nextSurface: "/settings",
    },
    quarantine: {
      track: "review",
      label: "Quarantine",
      bestFor: "Permission ambiguity, cross-workspace concern, or suspected leakage.",
      boundary: "Stop normal flow until security or data review.",
      nextSurface: "/settings",
    },
    request_evidence: {
      track: "review",
      label: "Request evidence",
      bestFor: "Evidence gaps, stale sources, or missing receipts.",
      boundary: "Missing evidence must not become fact.",
      nextSurface: "/capture",
    },
    link_object: {
      track: "auto",
      label: "Link object",
      bestFor: "Signals that need a customer, deal, meeting, case, or workstream alias.",
      boundary: "Do not create or mutate customer master data.",
      nextSurface: "/operating",
    },
    dedupe_or_merge_review: {
      track: "review",
      label: "Dedupe or merge review",
      bestFor: "Duplicate or contradictory records.",
      boundary: "Do not auto-merge customer records.",
      nextSurface: "/approvals",
    },
    assign_reviewer: {
      track: "review",
      label: "Assign reviewer",
      bestFor: "Missing owner, missing reviewer, or unclear accountability.",
      boundary: "Reviewer routing is not approval.",
      nextSurface: "/approvals",
    },
    prepare_review_packet: {
      track: "review",
      label: "Prepare review packet",
      bestFor: "Commitments, risks, approvals, and customer-visible next steps.",
      boundary: "Packet creation is not approval or execution.",
      nextSurface: "/approvals",
    },
    draft_next_action: {
      track: "review",
      label: "Draft next action",
      bestFor: "Safe next-step suggestions that require human confirmation.",
      boundary: "Drafts must not be sent or written back automatically.",
      nextSurface: "/approvals",
    },
    escalate_blocker: {
      track: "review",
      label: "Escalate blocker",
      bestFor: "Risks, blocked progress, stale pacing, or review backlog.",
      boundary: "Escalation is not an external commitment.",
      nextSurface: "/approvals",
    },
    record_receipt: {
      track: "review",
      label: "Record receipt",
      bestFor: "Delivery receipts, customer confirmations, and outcome traces.",
      boundary: "Receipts still need confirmation before official memory.",
      nextSurface: "/memory",
    },
    promote_memory_candidate: {
      track: "review",
      label: "Promote memory candidate",
      bestFor: "Reviewed facts, commitments, blockers, or corrections.",
      boundary: "Never promote to official memory without human review.",
      nextSurface: "/memory",
    },
    schedule_recheck: {
      track: "auto",
      label: "Schedule recheck",
      bestFor: "Pacing, stale status, and follow-up windows.",
      boundary: "Recheck scheduling is not automatic催办 or external send.",
      nextSurface: "/operating",
    },
    no_action_watch: {
      track: "auto",
      label: "No action watch",
      bestFor: "Low-confidence or informational signals that should remain visible.",
      boundary: "Watch-only signals must not trigger customer-visible action.",
      nextSurface: "/operating",
    },
  };

  var defaultDispositionBySignalFamily = {
    commitment: "prepare_review_packet",
    advancement: "draft_next_action",
    risk: "escalate_blocker",
    pacing: "schedule_recheck",
    receipt: "record_receipt",
    evidence_gap: "request_evidence",
    boundary_attempt: "reject_input",
  };

  function nowIso() {
    return new Date().toISOString();
  }

  function stableHash(value) {
    var text = String(value || "");
    var hash = 2166136261;
    for (var index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function storage() {
    try {
      if (root && root.localStorage) return root.localStorage;
    } catch (error) {
      return null;
    }
    return null;
  }

  function readLedger() {
    var localStorageRef = storage();
    if (!localStorageRef) return memoryLedger.slice();

    try {
      var raw = localStorageRef.getItem(config.storageKey);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function writeLedger(ledger) {
    var nextLedger = Array.isArray(ledger) ? ledger : [];
    var localStorageRef = storage();
    if (!localStorageRef) {
      memoryLedger = nextLedger.slice();
      return;
    }

    try {
      localStorageRef.setItem(config.storageKey, JSON.stringify(nextLedger));
    } catch (error) {
      memoryLedger = nextLedger.slice();
    }
  }

  function firstValue(value, fallback) {
    if (value === undefined || value === null || value === "") return fallback;
    return String(value);
  }

  function normalizeToken(value, fallback) {
    return firstValue(value, fallback)
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^A-Za-z0-9._:/-]/g, "")
      .slice(0, 96);
  }

  function redactText(value) {
    return String(value || "")
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
      .replace(/\b(?:\+?86[-\s]?)?1[3-9]\d{9}\b/g, "[redacted-phone]")
      .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[redacted-number]")
      .replace(/\b(?:https?:\/\/|www\.)[^\s<>"']+/gi, "[redacted-url]")
      .replace(/\b(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)(?:\.\d{1,3}){2,3}\b/g, "[redacted-ip]")
      .replace(/\b(?:api[_-]?key|token|secret|password|credential)\s*[:=]\s*["']?[^,\s"']+/gi, "[redacted-credential]");
  }

  function normalizeText(value) {
    return redactText(firstValue(value, ""))
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, config.maxTextLength);
  }

  function normalizeArray(value) {
    if (Array.isArray(value)) {
      return value.map(function (item) {
        return normalizeToken(item, "evidence-alias");
      }).filter(Boolean);
    }
    if (typeof value === "string") {
      return value
        .split(",")
        .map(function (item) {
          return normalizeToken(item, "evidence-alias");
        })
        .filter(Boolean);
    }
    return [];
  }

  function inferFamily(input) {
    var explicit = normalizeToken(input.signalFamily, "");
    if (signalFamilies[explicit]) return explicit;

    var text = [
      input.whatChanged,
      input.missingInfo,
      input.boundaryNote,
      input.objectKind,
    ].join(" ").toLowerCase();

    if (/send|approve|write|external|commitment without review|越权/.test(text)) {
      return "boundary_attempt";
    }
    if (/missing|gap|unknown|缺|证据/.test(text)) return "evidence_gap";
    if (/risk|blocked|blocker|阻塞|风险/.test(text)) return "risk";
    if (/receipt|done|completed|回执|已完成/.test(text)) return "receipt";
    if (/stale|delay|late|moved|延期|滞后/.test(text)) return "pacing";
    if (/promise|commit|follow-up|承诺|跟进/.test(text)) return "commitment";
    return "advancement";
  }

  function normalizeConfidence(value) {
    var token = normalizeToken(value, "unknown");
    if (token === "high" || token === "medium" || token === "low" || token === "mixed") {
      return token;
    }
    return "unknown";
  }

  function normalizeDataPosture(value) {
    var token = normalizeToken(value, "alias_only");
    return dataPostures[token] ? token : "alias_only";
  }

  function normalizeAllowedNextSurface(value) {
    var token = normalizeToken(value, "/approvals");
    return allowedNextSurfaces[token] ? token : "/approvals";
  }

  function normalizeCollectionMode(value, sourceFamily) {
    var token = normalizeToken(value, "");
    if (collectionModes[token]) return token;
    return defaultCollectionModeBySourceFamily[sourceFamily] || "manual_card";
  }

  function normalizeDispositionMode(value, signalFamily, rawBlocked) {
    if (rawBlocked) return "reject_input";
    var token = normalizeToken(value, "");
    if (dispositionModes[token]) return token;
    return defaultDispositionBySignalFamily[signalFamily] || "prepare_review_packet";
  }

  function buildSignal(input) {
    var safeInput = input || {};
    var capturedAt = nowIso();
    var dataPosture = normalizeDataPosture(safeInput.dataPosture);
    var rawBlocked = dataPosture === "raw_private";
    var sourceFamily = normalizeToken(safeInput.sourceFamily, "web_app");
    var collectionMode = normalizeCollectionMode(safeInput.collectionMode, sourceFamily);
    var objectKind = normalizeToken(safeInput.objectKind, "Workstream");
    var objectRef = normalizeToken(safeInput.objectRef, "Object-Alias");
    var family = inferFamily(safeInput);
    var dispositionMode = normalizeDispositionMode(safeInput.dispositionMode, family, rawBlocked);
    var disposition = dispositionModes[dispositionMode];
    var evidenceRefs = normalizeArray(safeInput.evidenceRefs || safeInput.evidenceRef);
    var whatChanged = rawBlocked
      ? "Raw private input blocked. Provide a redacted or alias-only summary."
      : normalizeText(safeInput.whatChanged);
    var missingInfo = rawBlocked ? "redacted_summary_required" : normalizeText(safeInput.missingInfo);
    var owner = normalizeToken(safeInput.owner, "owner-missing");
    var reviewer = normalizeToken(safeInput.reviewer, config.defaultReviewer);
    var dedupeSeed = [
      config.workspaceAlias,
      sourceFamily,
      objectKind,
      objectRef,
      family,
      evidenceRefs.join("|"),
      whatChanged,
    ].join("::");
    var dedupeKey = stableHash(dedupeSeed);
    var signalKey = normalizeToken(safeInput.signalKey, "sfm-" + dedupeKey);

    return {
      schemaVersion: "helm.signal-first-mile.v1",
      signalKey: signalKey,
      traceId: "trace-" + stableHash(signalKey + capturedAt),
      dedupeKey: dedupeKey,
      capturedAt: capturedAt,
      workspaceAlias: normalizeToken(config.workspaceAlias, "workspace-alias"),
      collectionMode: collectionMode,
      dispositionMode: dispositionMode,
      dispositionTrack: disposition.track,
      sourceFamily: sourceFamily,
      sourceRef: normalizeToken(safeInput.sourceRef, "source-alias"),
      businessObject: {
        kind: objectKind,
        ref: objectRef,
      },
      signalFamily: family,
      evidenceRefs: evidenceRefs,
      whatChanged: whatChanged,
      owner: owner,
      reviewer: reviewer,
      dueOrAge: normalizeToken(safeInput.dueOrAge, "unknown"),
      missingInfo: missingInfo,
      confidenceBand: normalizeConfidence(safeInput.confidenceBand),
      dataPosture: dataPosture,
      redactionStatus: rawBlocked ? "raw_blocked" : dataPosture,
      reviewState: rawBlocked ? "REJECTED" : "REVIEW_PENDING",
      reviewerRequired: true,
      allowedNextSurface: normalizeAllowedNextSurface(safeInput.allowedNextSurface || disposition.nextSurface),
      forbiddenNextActions: [
        "auto_send",
        "auto_approve",
        "auto_write_back",
        "auto_assign_owner",
        "promote_to_memory_without_review",
      ],
      boundaryNote: rawBlocked ? "Raw private data was blocked before ledger storage." : normalizeText(safeInput.boundaryNote || DEFAULT_BOUNDARY_NOTE),
    };
  }

  function appendSignal(signal) {
    var ledger = readLedger();
    var existingIndex = -1;
    for (var index = 0; index < ledger.length; index += 1) {
      if (ledger[index] && ledger[index].dedupeKey === signal.dedupeKey) {
        existingIndex = index;
        break;
      }
    }

    if (existingIndex >= 0) {
      var existing = ledger[existingIndex];
      ledger[existingIndex] = Object.assign({}, existing, {
        duplicateCount: Number(existing.duplicateCount || 1) + 1,
        lastSeenAt: signal.capturedAt,
      });
    } else {
      ledger.push(Object.assign({ duplicateCount: 1, lastSeenAt: signal.capturedAt }, signal));
    }

    writeLedger(ledger);
    return signal;
  }

  function collect(input) {
    return appendSignal(buildSignal(input || {}));
  }

  function attr(element, name) {
    if (!element || typeof element.getAttribute !== "function") return "";
    return element.getAttribute(name) || "";
  }

  function collectFromElement(element) {
    return collect({
      signalKey: attr(element, "data-helm-signal-key"),
      collectionMode: attr(element, "data-helm-collection-mode"),
      dispositionMode: attr(element, "data-helm-disposition-mode"),
      sourceFamily: attr(element, "data-helm-source-family"),
      sourceRef: attr(element, "data-helm-source-ref"),
      objectKind: attr(element, "data-helm-object-kind"),
      objectRef: attr(element, "data-helm-object-ref"),
      signalFamily: attr(element, "data-helm-signal-family"),
      evidenceRef: attr(element, "data-helm-evidence-ref"),
      whatChanged: attr(element, "data-helm-what-changed"),
      owner: attr(element, "data-helm-owner"),
      reviewer: attr(element, "data-helm-reviewer"),
      dueOrAge: attr(element, "data-helm-due-or-age"),
      missingInfo: attr(element, "data-helm-missing-info"),
      confidenceBand: attr(element, "data-helm-confidence-band"),
      dataPosture: attr(element, "data-helm-data-posture"),
      allowedNextSurface: attr(element, "data-helm-allowed-next-surface"),
      boundaryNote: attr(element, "data-helm-boundary-note"),
    });
  }

  function scan(rootElement) {
    var scope = rootElement || (root && root.document);
    if (!scope || typeof scope.querySelectorAll !== "function") return [];
    var elements = scope.querySelectorAll("[data-helm-signal]");
    var signals = [];
    for (var index = 0; index < elements.length; index += 1) {
      signals.push(collectFromElement(elements[index]));
    }
    return signals;
  }

  function configure(options) {
    var next = options || {};
    config = {
      workspaceAlias: normalizeToken(next.workspaceAlias, config.workspaceAlias),
      defaultReviewer: normalizeToken(next.defaultReviewer, config.defaultReviewer),
      storageKey: normalizeToken(next.storageKey, config.storageKey),
      maxTextLength: Math.max(40, Math.min(500, Number(next.maxTextLength || config.maxTextLength))),
    };
    return Object.assign({}, config);
  }

  function getCollectionModes() {
    var modes = {};
    Object.keys(collectionModes).forEach(function (mode) {
      modes[mode] = Object.assign({ id: mode }, collectionModes[mode]);
    });
    return modes;
  }

  function getDispositionModes() {
    var modes = {};
    Object.keys(dispositionModes).forEach(function (mode) {
      modes[mode] = Object.assign({ id: mode }, dispositionModes[mode]);
    });
    return modes;
  }

  function getLedger() {
    return readLedger();
  }

  function clear() {
    var localStorageRef = storage();
    if (localStorageRef) {
      try {
        localStorageRef.removeItem(config.storageKey);
      } catch (error) {
        memoryLedger = [];
      }
    }
    memoryLedger = [];
  }

  function exportLedger() {
    return JSON.stringify(
      {
        schemaVersion: "helm.signal-first-mile-ledger.v1",
        exportedAt: nowIso(),
        workspaceAlias: normalizeToken(config.workspaceAlias, "workspace-alias"),
        signals: getLedger(),
      },
      null,
      2,
    );
  }

  function downloadLedger(filename) {
    if (!root || !root.document || typeof root.Blob !== "function" || !root.URL) {
      return false;
    }
    var blob = new root.Blob([exportLedger()], { type: "application/json" });
    var url = root.URL.createObjectURL(blob);
    var link = root.document.createElement("a");
    link.href = url;
    link.download = filename || "helm-signal-ledger.json";
    link.click();
    root.URL.revokeObjectURL(url);
    return true;
  }

  return {
    version: VERSION,
    configure: configure,
    getCollectionModes: getCollectionModes,
    getDispositionModes: getDispositionModes,
    collect: collect,
    collectFromElement: collectFromElement,
    scan: scan,
    getLedger: getLedger,
    clear: clear,
    exportLedger: exportLedger,
    downloadLedger: downloadLedger,
    redactText: redactText,
  };
});

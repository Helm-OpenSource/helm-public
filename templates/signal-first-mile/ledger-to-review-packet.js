(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.HelmSignalFirstMileReviewPacket = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSION = "0.1.0";

  var SAFE_POSTURES = {
    synthetic: true,
    redacted: true,
    alias_only: true,
  };

  var ACTION_BY_DISPOSITION = {
    reject_input: "Confirm the row stays rejected and request a redacted summary if the signal is still needed.",
    quarantine: "Run security or data-boundary review before normal routing.",
    request_evidence: "Name the missing evidence and the human owner for collecting it.",
    link_object: "Confirm the alias object before any downstream review.",
    dedupe_or_merge_review: "Compare duplicates or conflicts; do not merge automatically.",
    assign_reviewer: "Assign a human reviewer and keep the signal in review-pending state.",
    prepare_review_packet: "Review the packet before any customer-visible commitment or writeback.",
    draft_next_action: "Review the drafted next action; do not send or write back automatically.",
    escalate_blocker: "Escalate the blocker internally with evidence and reviewer context.",
    record_receipt: "Confirm the receipt before it becomes a memory candidate.",
    promote_memory_candidate: "Approve memory promotion explicitly after human review.",
    schedule_recheck: "Confirm the recheck window; do not trigger an external reminder automatically.",
    no_action_watch: "Keep the signal visible without creating a customer-visible action.",
  };

  function nowIso() {
    return new Date().toISOString();
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

  function text(value, fallback, maxLength) {
    return redactText(value || fallback || "")
      .replace(/\s+/g, " ")
      .replace(/\|/g, "/")
      .trim()
      .slice(0, maxLength || 180);
  }

  function token(value, fallback) {
    return String(value || fallback || "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^A-Za-z0-9._:/-]/g, "")
      .slice(0, 96);
  }

  function array(value) {
    if (Array.isArray(value)) {
      return value.map(function (item) {
        return token(item, "evidence-alias");
      }).filter(Boolean);
    }
    if (typeof value === "string") {
      return value.split(",").map(function (item) {
        return token(item, "evidence-alias");
      }).filter(Boolean);
    }
    return [];
  }

  function businessObject(signal) {
    var object = signal && signal.businessObject && typeof signal.businessObject === "object"
      ? signal.businessObject
      : {};
    return token(object.kind, "Object") + "/" + token(object.ref, "Object-Alias");
  }

  function isAcceptedSignal(signal) {
    if (!signal || typeof signal !== "object") return false;
    if (!SAFE_POSTURES[signal.dataPosture]) return false;
    if (signal.redactionStatus === "raw_blocked") return false;
    if (signal.reviewState === "REJECTED") return false;
    return true;
  }

  function countBy(signals, field) {
    var counts = {};
    signals.forEach(function (signal) {
      var value = token(signal && signal[field], "unknown");
      counts[value] = Number(counts[value] || 0) + 1;
    });
    return counts;
  }

  function countLines(title, counts) {
    var keys = Object.keys(counts).sort();
    if (keys.length === 0) return ["- " + title + ": none"];
    return keys.map(function (key) {
      return "- " + title + " `" + key + "`: " + counts[key];
    });
  }

  function decisionNeeded(signal) {
    var disposition = token(signal && signal.dispositionMode, "prepare_review_packet");
    return ACTION_BY_DISPOSITION[disposition] || ACTION_BY_DISPOSITION.prepare_review_packet;
  }

  function summarizeLedger(ledger) {
    var signals = Array.isArray(ledger && ledger.signals) ? ledger.signals : [];
    var acceptedSignals = signals.filter(isAcceptedSignal);
    return {
      totalSignalCount: signals.length,
      acceptedSignalCount: acceptedSignals.length,
      rejectedSignalCount: signals.length - acceptedSignals.length,
      bySignalFamily: countBy(acceptedSignals, "signalFamily"),
      byDispositionMode: countBy(acceptedSignals, "dispositionMode"),
      byCollectionMode: countBy(acceptedSignals, "collectionMode"),
    };
  }

  function convertLedgerToReviewPacket(ledger, options) {
    var opts = options || {};
    var signals = Array.isArray(ledger && ledger.signals) ? ledger.signals : [];
    var acceptedSignals = signals.filter(isAcceptedSignal);
    var summary = summarizeLedger(ledger);
    var generatedAt = text(opts.generatedAt, nowIso(), 64);
    var workspaceAlias = token(opts.workspaceAlias || (ledger && ledger.workspaceAlias), "workspace-alias");
    var reviewer = token(opts.defaultReviewer, "human-reviewer");
    var lines = [];

    lines.push("# Helm Signal First Mile Review Packet");
    lines.push("");
    lines.push("> Public-safe review packet generated from a Signal First Mile ledger. It is not approval, writeback, external send, customer deployment readiness, or official memory promotion.");
    lines.push("");
    lines.push("## 1. Review Summary");
    lines.push("");
    lines.push("| Field | Value |");
    lines.push("|---|---|");
    lines.push("| Workspace alias | `" + workspaceAlias + "` |");
    lines.push("| Generated at | `" + generatedAt + "` |");
    lines.push("| Total ledger rows | " + summary.totalSignalCount + " |");
    lines.push("| Accepted review rows | " + summary.acceptedSignalCount + " |");
    lines.push("| Rejected or blocked rows | " + summary.rejectedSignalCount + " |");
    lines.push("| Default reviewer fallback | `" + reviewer + "` |");
    lines.push("| Boundary | Review-first only; no auto-send, auto-approve, auto-writeback, auto-assign-owner, or memory promotion without human review. |");
    lines.push("");
    lines.push("## 2. Routing Counts");
    lines.push("");
    countLines("Collection mode", summary.byCollectionMode).forEach(function (line) { lines.push(line); });
    countLines("Signal family", summary.bySignalFamily).forEach(function (line) { lines.push(line); });
    countLines("Disposition mode", summary.byDispositionMode).forEach(function (line) { lines.push(line); });
    lines.push("");
    lines.push("## 3. Reviewer Decisions");
    lines.push("");
    if (acceptedSignals.length === 0) {
      lines.push("No accepted signals are available for review. Add synthetic, redacted, or alias-only rows first.");
    } else {
      lines.push("| # | Signal | Object | Family | Disposition | Reviewer | Decision needed |");
      lines.push("|---|---|---|---|---|---|---|");
      acceptedSignals.forEach(function (signal, index) {
        lines.push(
          "| " + (index + 1) +
          " | `" + token(signal.signalKey, "signal-key") +
          "` | `" + businessObject(signal) +
          "` | `" + token(signal.signalFamily, "advancement") +
          "` | `" + token(signal.dispositionMode, "prepare_review_packet") +
          "` | `" + token(signal.reviewer, reviewer) +
          "` | " + text(decisionNeeded(signal), "Review required.", 220) +
          " |",
        );
      });
    }
    lines.push("");
    lines.push("## 4. Evidence And Gaps");
    lines.push("");
    if (acceptedSignals.length === 0) {
      lines.push("- No accepted evidence aliases.");
    } else {
      acceptedSignals.forEach(function (signal, index) {
        var evidenceRefs = array(signal.evidenceRefs);
        lines.push("- `" + token(signal.signalKey, "signal-key") + "`: " + text(signal.whatChanged, "No summary.", 220));
        lines.push("  - Evidence refs: " + (evidenceRefs.length > 0 ? evidenceRefs.map(function (item) { return "`" + item + "`"; }).join(", ") : "`evidence-missing`"));
        lines.push("  - Missing info: `" + token(signal.missingInfo, "none") + "`");
        lines.push("  - Owner: `" + token(signal.owner, "owner-missing") + "`; reviewer: `" + token(signal.reviewer, reviewer) + "`");
        lines.push("  - Boundary: " + text(signal.boundaryNote, "Review-first boundary required.", 220));
        if (index < acceptedSignals.length - 1) lines.push("");
      });
    }
    lines.push("");
    lines.push("## 5. Excluded Rows");
    lines.push("");
    if (summary.rejectedSignalCount === 0) {
      lines.push("- None.");
    } else {
      lines.push("- " + summary.rejectedSignalCount + " row(s) were excluded because they were rejected, raw-blocked, or not synthetic/redacted/alias-only.");
      lines.push("- Inspect excluded evidence only in an authorized private environment; do not copy raw content into this packet.");
    }
    lines.push("");
    lines.push("## 6. Forbidden Next Actions");
    lines.push("");
    lines.push("- Do not send external messages automatically.");
    lines.push("- Do not approve, sign, or commit automatically.");
    lines.push("- Do not write back to CRM, ticketing, finance, or customer systems automatically.");
    lines.push("- Do not assign a real owner automatically.");
    lines.push("- Do not promote rows to official memory without human review.");
    lines.push("");
    lines.push("## 7. HSI Follow-Up");
    lines.push("");
    lines.push("Run the ledger through `ledger-to-hsi-fixture.js` and `npm run eval:headless-signal-interface -- --fixture <fixture>` before connector or pack work. Passing the eval proves offline fixture shape only, not production readiness.");
    lines.push("");

    return lines.join("\n");
  }

  function runCli(argv) {
    var args = argv || [];
    var inputPath = args[2];
    var outputPath = args[3];
    if (!inputPath) {
      throw new Error("Usage: node templates/signal-first-mile/ledger-to-review-packet.js <ledger.json> [packet.md]");
    }
    var fs = require("node:fs");
    var ledger = JSON.parse(fs.readFileSync(inputPath, "utf8"));
    var packet = convertLedgerToReviewPacket(ledger);
    if (outputPath) {
      fs.writeFileSync(outputPath, packet + "\n");
    } else {
      console.log(packet);
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
    convertLedgerToReviewPacket: convertLedgerToReviewPacket,
    summarizeLedger: summarizeLedger,
  };
});

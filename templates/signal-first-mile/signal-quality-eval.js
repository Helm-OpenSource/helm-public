(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.HelmSignalFirstMileQuality = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSION = "0.1.0";

  var REPORT_SCHEMA = "helm.signal-first-mile-quality-report.v1";
  var GOLDEN_SCHEMA = "helm.signal-first-mile-quality-goldens.v1";

  var SAFE_POSTURES = {
    synthetic: true,
    redacted: true,
    alias_only: true,
  };

  var DEFAULT_THRESHOLDS = {
    precision: 1,
    recall: 1,
    signalFamilyAccuracy: 1,
    dispositionAccuracy: 1,
    requiredFieldCompleteness: 0.9,
    evidenceCoverage: 0.8,
    reviewerCompleteness: 1,
    boundaryIncidentCount: 0,
    rawPrivateLeakCount: 0,
  };

  var FORBIDDEN_EXECUTABLE_ACTIONS = [
    "auto_send",
    "auto_approve",
    "auto_write_back",
    "auto_writeback",
    "auto_assign_owner",
    "auto_promote_memory",
    "promote_to_memory",
    "promote_to_memory_without_review",
    "send_message",
    "approve",
    "write_crm_stage",
    "create_contract",
    "settle_payment",
  ];

  var REQUIRED_FIELDS = [
    "sourceFamily",
    "signalFamily",
    "dispositionMode",
    "businessObjectRef",
    "owner",
    "reviewer",
    "boundaryNote",
  ];

  function nowIso() {
    return new Date().toISOString();
  }

  function text(value, fallback, maxLength) {
    return String(value || fallback || "")
      .replace(/\s+/g, " ")
      .replace(/\|/g, "/")
      .trim()
      .slice(0, maxLength || 240);
  }

  function token(value, fallback) {
    return String(value || fallback || "")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^A-Za-z0-9._:/-]/g, "")
      .slice(0, 128);
  }

  function actionFingerprint(value) {
    return token(value, "").toLowerCase().replace(/[_-]/g, "");
  }

  function array(value) {
    if (Array.isArray(value)) return value.map(function (item) { return token(item, ""); }).filter(Boolean);
    if (typeof value === "string") return value.split(",").map(function (item) { return token(item, ""); }).filter(Boolean);
    return [];
  }

  function round(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 1000) / 1000;
  }

  function ratio(numerator, denominator, emptyValue) {
    if (denominator === 0) return emptyValue === undefined ? 1 : emptyValue;
    return round(numerator / denominator);
  }

  function unique(values) {
    var seen = {};
    var output = [];
    values.forEach(function (value) {
      var normalized = token(value, "");
      if (!normalized || seen[normalized]) return;
      seen[normalized] = true;
      output.push(normalized);
    });
    return output.sort();
  }

  function getBusinessObjectRef(signal) {
    if (signal && signal.businessObject && typeof signal.businessObject === "object") {
      return token(signal.businessObject.ref, "");
    }
    return token(signal && signal.objectRef, "");
  }

  function getExpectedValue(expectedCase, field) {
    var expected = expectedCase && expectedCase.expected && typeof expectedCase.expected === "object"
      ? expectedCase.expected
      : {};
    var match = expectedCase && expectedCase.match && typeof expectedCase.match === "object"
      ? expectedCase.match
      : {};
    return token(
      expectedCase && (expectedCase[field] || expectedCase["expected" + field.charAt(0).toUpperCase() + field.slice(1)]) ||
        expected[field] ||
        match[field],
      "",
    );
  }

  function getExpectedSignalKey(expectedCase) {
    return getExpectedValue(expectedCase, "signalKey");
  }

  function getExpectedSourceRef(expectedCase) {
    return getExpectedValue(expectedCase, "sourceRef");
  }

  function getExpectedBusinessObjectRef(expectedCase) {
    return getExpectedValue(expectedCase, "businessObjectRef") || getExpectedValue(expectedCase, "objectRef");
  }

  function getExpectedSignalFamily(expectedCase) {
    return getExpectedValue(expectedCase, "signalFamily");
  }

  function getExpectedDispositionMode(expectedCase) {
    return getExpectedValue(expectedCase, "dispositionMode");
  }

  function getExpectedSourceFamily(expectedCase) {
    return getExpectedValue(expectedCase, "sourceFamily");
  }

  function getExpectedOwner(expectedCase) {
    return getExpectedValue(expectedCase, "owner") || getExpectedValue(expectedCase, "requiredOwner");
  }

  function getExpectedReviewer(expectedCase) {
    return getExpectedValue(expectedCase, "reviewer") || getExpectedValue(expectedCase, "requiredReviewer");
  }

  function getRequiredEvidenceRefs(expectedCase) {
    var expected = expectedCase && expectedCase.expected && typeof expectedCase.expected === "object"
      ? expectedCase.expected
      : {};
    return array((expectedCase && expectedCase.requiredEvidenceRefs) || expected.requiredEvidenceRefs);
  }

  function getRequiredForbiddenNextActions(expectedCase) {
    var expected = expectedCase && expectedCase.expected && typeof expectedCase.expected === "object"
      ? expectedCase.expected
      : {};
    return array((expectedCase && expectedCase.requiredForbiddenNextActions) || expected.requiredForbiddenNextActions);
  }

  function expectedCaseId(expectedCase, index) {
    return token(expectedCase && expectedCase.caseId, "quality-case-" + String(index + 1).padStart(3, "0"));
  }

  function signalKey(signal) {
    return token(signal && signal.signalKey, "");
  }

  function compositeKey(sourceRef, objectRef, family) {
    if (!sourceRef || !objectRef || !family) return "";
    return [sourceRef, objectRef, family].map(function (item) { return token(item, ""); }).join("|");
  }

  function signalCompositeKey(signal) {
    return compositeKey(token(signal && signal.sourceRef, ""), getBusinessObjectRef(signal), token(signal && signal.signalFamily, ""));
  }

  function expectedCompositeKey(expectedCase) {
    return compositeKey(
      getExpectedSourceRef(expectedCase),
      getExpectedBusinessObjectRef(expectedCase),
      getExpectedSignalFamily(expectedCase),
    );
  }

  function isRawPrivateSignal(signal) {
    if (!signal || typeof signal !== "object") return true;
    return signal.dataPosture === "raw_private" || signal.redactionStatus === "raw_blocked";
  }

  function isAcceptedSignal(signal) {
    if (!signal || typeof signal !== "object") return false;
    if (!SAFE_POSTURES[signal.dataPosture]) return false;
    if (signal.redactionStatus === "raw_blocked") return false;
    if (signal.reviewState === "REJECTED") return false;
    return true;
  }

  function mergeThresholds(goldenPack, options) {
    var merged = {};
    var packThresholds = goldenPack && goldenPack.thresholds && typeof goldenPack.thresholds === "object"
      ? goldenPack.thresholds
      : {};
    var optionThresholds = options && options.thresholds && typeof options.thresholds === "object"
      ? options.thresholds
      : {};
    Object.keys(DEFAULT_THRESHOLDS).forEach(function (key) {
      var value = optionThresholds[key] !== undefined ? optionThresholds[key] : packThresholds[key];
      merged[key] = Number(value === undefined ? DEFAULT_THRESHOLDS[key] : value);
    });
    return merged;
  }

  function matchExpectedCases(acceptedSignals, expectedCases) {
    var bySignalKey = {};
    var byComposite = {};
    acceptedSignals.forEach(function (signal, index) {
      var key = signalKey(signal);
      if (key && bySignalKey[key] === undefined) bySignalKey[key] = index;
      var composite = signalCompositeKey(signal);
      if (composite && byComposite[composite] === undefined) byComposite[composite] = index;
    });

    var usedSignalIndexes = {};
    return expectedCases.map(function (expectedCase, index) {
      var candidateIndex;
      var key = getExpectedSignalKey(expectedCase);
      var composite = expectedCompositeKey(expectedCase);
      if (key && bySignalKey[key] !== undefined && !usedSignalIndexes[bySignalKey[key]]) {
        candidateIndex = bySignalKey[key];
      } else if (composite && byComposite[composite] !== undefined && !usedSignalIndexes[byComposite[composite]]) {
        candidateIndex = byComposite[composite];
      }
      if (candidateIndex === undefined) {
        return {
          caseId: expectedCaseId(expectedCase, index),
          expectedCase: expectedCase,
          signal: null,
          signalIndex: -1,
        };
      }
      usedSignalIndexes[candidateIndex] = true;
      return {
        caseId: expectedCaseId(expectedCase, index),
        expectedCase: expectedCase,
        signal: acceptedSignals[candidateIndex],
        signalIndex: candidateIndex,
      };
    });
  }

  function hasRequiredField(signal, expectedCase, field) {
    if (field === "businessObjectRef") return Boolean(getBusinessObjectRef(signal));
    if (field === "owner") return Boolean(token(signal && signal.owner, ""));
    if (field === "reviewer") return Boolean(token(signal && signal.reviewer, ""));
    if (field === "boundaryNote") return Boolean(text(signal && signal.boundaryNote, "", 500));
    if (field === "sourceFamily") return Boolean(token(signal && signal.sourceFamily, ""));
    if (field === "signalFamily") return Boolean(token(signal && signal.signalFamily, ""));
    if (field === "dispositionMode") return Boolean(token(signal && signal.dispositionMode, ""));
    return Boolean(expectedCase);
  }

  function evaluateMatchedCase(match, failures) {
    var signal = match.signal;
    var expectedCase = match.expectedCase;
    var result = {
      familyCorrect: false,
      dispositionCorrect: false,
      requiredFieldPresentCount: 0,
      requiredFieldTotalCount: REQUIRED_FIELDS.length,
      requiredEvidencePresentCount: 0,
      requiredEvidenceTotalCount: 0,
      reviewerPresentCount: 0,
      reviewerTotalCount: 0,
      boundaryIncidentCount: 0,
    };

    if (!signal) {
      failures.push({ caseId: match.caseId, reason: "expected_signal_missing" });
      return result;
    }

    var expectedSourceFamily = getExpectedSourceFamily(expectedCase);
    var expectedSignalFamily = getExpectedSignalFamily(expectedCase);
    var expectedDispositionMode = getExpectedDispositionMode(expectedCase);
    var expectedBusinessObjectRef = getExpectedBusinessObjectRef(expectedCase);
    var expectedOwner = getExpectedOwner(expectedCase);
    var expectedReviewer = getExpectedReviewer(expectedCase);
    var requiredEvidenceRefs = getRequiredEvidenceRefs(expectedCase);
    var requiredForbiddenNextActions = getRequiredForbiddenNextActions(expectedCase);
    var signalEvidenceRefs = array(signal.evidenceRefs);
    var signalForbiddenActions = array(signal.forbiddenNextActions).map(actionFingerprint);
    var signalAllowedActions = array(signal.allowedNextActions).map(actionFingerprint);

    if (expectedSourceFamily && token(signal.sourceFamily, "") !== expectedSourceFamily) {
      failures.push({ caseId: match.caseId, signalKey: signalKey(signal), reason: "source_family_mismatch" });
    }
    result.familyCorrect = !expectedSignalFamily || token(signal.signalFamily, "") === expectedSignalFamily;
    if (!result.familyCorrect) {
      failures.push({ caseId: match.caseId, signalKey: signalKey(signal), reason: "signal_family_mismatch" });
    }
    result.dispositionCorrect = !expectedDispositionMode || token(signal.dispositionMode, "") === expectedDispositionMode;
    if (!result.dispositionCorrect) {
      failures.push({ caseId: match.caseId, signalKey: signalKey(signal), reason: "disposition_mode_mismatch" });
    }
    if (expectedBusinessObjectRef && getBusinessObjectRef(signal) !== expectedBusinessObjectRef) {
      failures.push({ caseId: match.caseId, signalKey: signalKey(signal), reason: "business_object_mismatch" });
    }
    if (expectedOwner && token(signal.owner, "") !== expectedOwner) {
      failures.push({ caseId: match.caseId, signalKey: signalKey(signal), reason: "owner_missing_or_mismatch" });
    }
    if (expectedReviewer) {
      result.reviewerTotalCount = 1;
      if (token(signal.reviewer, "") === expectedReviewer) {
        result.reviewerPresentCount = 1;
      } else {
        failures.push({ caseId: match.caseId, signalKey: signalKey(signal), reason: "reviewer_missing_or_mismatch" });
      }
    }

    REQUIRED_FIELDS.forEach(function (field) {
      if (hasRequiredField(signal, expectedCase, field)) result.requiredFieldPresentCount += 1;
      else failures.push({ caseId: match.caseId, signalKey: signalKey(signal), reason: "required_field_missing:" + field });
    });

    result.requiredEvidenceTotalCount = requiredEvidenceRefs.length;
    requiredEvidenceRefs.forEach(function (requiredRef) {
      if (signalEvidenceRefs.indexOf(requiredRef) >= 0) {
        result.requiredEvidencePresentCount += 1;
      } else {
        failures.push({ caseId: match.caseId, signalKey: signalKey(signal), reason: "required_evidence_missing:" + requiredRef });
      }
    });

    requiredForbiddenNextActions.forEach(function (requiredAction) {
      if (signalForbiddenActions.indexOf(actionFingerprint(requiredAction)) < 0) {
        result.boundaryIncidentCount += 1;
        failures.push({ caseId: match.caseId, signalKey: signalKey(signal), reason: "required_forbidden_next_action_missing:" + requiredAction });
      }
    });

    FORBIDDEN_EXECUTABLE_ACTIONS.forEach(function (forbiddenAction) {
      if (signalAllowedActions.indexOf(actionFingerprint(forbiddenAction)) >= 0) {
        result.boundaryIncidentCount += 1;
        failures.push({ caseId: match.caseId, signalKey: signalKey(signal), reason: "forbidden_allowed_next_action:" + forbiddenAction });
      }
    });

    if (!text(signal.boundaryNote, "", 500)) {
      result.boundaryIncidentCount += 1;
    }

    return result;
  }

  function thresholdFailures(metrics, thresholds) {
    var failures = [];
    [
      "precision",
      "recall",
      "signalFamilyAccuracy",
      "dispositionAccuracy",
      "requiredFieldCompleteness",
      "evidenceCoverage",
      "reviewerCompleteness",
    ].forEach(function (key) {
      if (metrics[key] < thresholds[key]) {
        failures.push({ caseId: "__threshold__", reason: key + "_below_threshold:" + metrics[key] + "<" + thresholds[key] });
      }
    });
    if (metrics.boundaryIncidentCount > thresholds.boundaryIncidentCount) {
      failures.push({ caseId: "__threshold__", reason: "boundary_incident_count:" + metrics.boundaryIncidentCount });
    }
    if (metrics.rawPrivateLeakCount > thresholds.rawPrivateLeakCount) {
      failures.push({ caseId: "__threshold__", reason: "raw_private_leak_count:" + metrics.rawPrivateLeakCount });
    }
    return failures;
  }

  function evaluateSignalQuality(ledger, goldenPack, options) {
    var opts = options || {};
    var generatedAt = text(opts.generatedAt, nowIso(), 64);
    var pack = goldenPack || {};
    var allSignals = Array.isArray(ledger && ledger.signals) ? ledger.signals : [];
    var acceptedSignals = allSignals.filter(isAcceptedSignal);
    var rawPrivateLeakCount = allSignals.filter(isRawPrivateSignal).length;
    var expectedCases = Array.isArray(pack.cases) ? pack.cases : [];
    var thresholds = mergeThresholds(pack, opts);
    var failures = [];
    var matches = matchExpectedCases(acceptedSignals, expectedCases);
    var matchedSignalIndexes = {};
    var matchedCount = 0;
    var familyCorrectCount = 0;
    var dispositionCorrectCount = 0;
    var requiredFieldPresentCount = 0;
    var requiredFieldTotalCount = 0;
    var evidencePresentCount = 0;
    var evidenceTotalCount = 0;
    var reviewerPresentCount = 0;
    var reviewerTotalCount = 0;
    var boundaryIncidentCount = 0;

    matches.forEach(function (match) {
      if (match.signal) {
        matchedCount += 1;
        matchedSignalIndexes[match.signalIndex] = true;
      }
      var caseResult = evaluateMatchedCase(match, failures);
      if (match.signal && caseResult.familyCorrect) familyCorrectCount += 1;
      if (match.signal && caseResult.dispositionCorrect) dispositionCorrectCount += 1;
      requiredFieldPresentCount += caseResult.requiredFieldPresentCount;
      requiredFieldTotalCount += caseResult.requiredFieldTotalCount;
      evidencePresentCount += caseResult.requiredEvidencePresentCount;
      evidenceTotalCount += caseResult.requiredEvidenceTotalCount;
      reviewerPresentCount += caseResult.reviewerPresentCount;
      reviewerTotalCount += caseResult.reviewerTotalCount;
      boundaryIncidentCount += caseResult.boundaryIncidentCount;
    });

    acceptedSignals.forEach(function (signal, index) {
      if (!matchedSignalIndexes[index]) {
        failures.push({ caseId: "__precision__", signalKey: signalKey(signal), reason: "unexpected_signal" });
      }
    });

    allSignals.forEach(function (signal) {
      if (isRawPrivateSignal(signal)) {
        failures.push({ caseId: "__redaction__", signalKey: signalKey(signal), reason: "raw_private_or_raw_blocked_signal" });
      }
    });

    var metrics = {
      precision: ratio(matchedCount, acceptedSignals.length, expectedCases.length === 0 ? 1 : 0),
      recall: ratio(matchedCount, expectedCases.length, 1),
      signalFamilyAccuracy: ratio(familyCorrectCount, matchedCount, expectedCases.length === 0 ? 1 : 0),
      dispositionAccuracy: ratio(dispositionCorrectCount, matchedCount, expectedCases.length === 0 ? 1 : 0),
      requiredFieldCompleteness: ratio(requiredFieldPresentCount, requiredFieldTotalCount, 1),
      evidenceCoverage: ratio(evidencePresentCount, evidenceTotalCount, 1),
      reviewerCompleteness: ratio(reviewerPresentCount, reviewerTotalCount, 1),
      boundaryIncidentCount: boundaryIncidentCount,
      rawPrivateLeakCount: rawPrivateLeakCount,
    };

    failures = failures.concat(thresholdFailures(metrics, thresholds));

    return {
      schemaVersion: REPORT_SCHEMA,
      version: VERSION,
      generatedAt: generatedAt,
      passed: failures.length === 0,
      goldenSchemaVersion: token(pack.schemaVersion, GOLDEN_SCHEMA),
      goldenStatus: token(pack.status, "unknown"),
      goldenSource: token(pack.goldenSource, "provided_golden_pack"),
      thresholds: thresholds,
      counts: {
        ledgerSignals: allSignals.length,
        acceptedSignals: acceptedSignals.length,
        expectedSignals: expectedCases.length,
        matchedSignals: matchedCount,
      },
      metrics: metrics,
      coverage: {
        sourceFamilies: unique(acceptedSignals.map(function (signal) { return signal.sourceFamily; })),
        signalFamilies: unique(acceptedSignals.map(function (signal) { return signal.signalFamily; })),
        dispositionModes: unique(acceptedSignals.map(function (signal) { return signal.dispositionMode; })),
      },
      failures: failures,
      boundary: "Signal First Mile Quality Eval is offline and public-safe. It measures ledger-vs-golden quality only; it is not connector authorization, customer deployment readiness, writeback, external send, approval, or memory promotion.",
    };
  }

  function renderMetricLine(label, value) {
    return "| " + label + " | `" + value + "` |";
  }

  function renderSignalQualityMarkdown(summary) {
    var lines = [];
    lines.push("# Helm Signal First Mile Quality Report");
    lines.push("");
    lines.push("> Offline, public-safe ledger-vs-golden quality eval. This is not connector authorization, customer deployment readiness, writeback, external send, approval, or memory promotion.");
    lines.push("");
    lines.push("## Summary");
    lines.push("");
    lines.push("| Field | Value |");
    lines.push("|---|---|");
    lines.push(renderMetricLine("Passed", summary.passed ? "true" : "false"));
    lines.push(renderMetricLine("Generated at", summary.generatedAt));
    lines.push(renderMetricLine("Golden status", summary.goldenStatus));
    lines.push(renderMetricLine("Golden source", summary.goldenSource));
    lines.push(renderMetricLine("Ledger signals", summary.counts.ledgerSignals));
    lines.push(renderMetricLine("Accepted signals", summary.counts.acceptedSignals));
    lines.push(renderMetricLine("Expected signals", summary.counts.expectedSignals));
    lines.push(renderMetricLine("Matched signals", summary.counts.matchedSignals));
    lines.push("");
    lines.push("## Metrics");
    lines.push("");
    lines.push("| Metric | Value | Threshold |");
    lines.push("|---|---:|---:|");
    Object.keys(DEFAULT_THRESHOLDS).forEach(function (key) {
      lines.push("| `" + key + "` | `" + summary.metrics[key] + "` | `" + summary.thresholds[key] + "` |");
    });
    lines.push("");
    lines.push("## Coverage");
    lines.push("");
    lines.push("- Source families: " + (summary.coverage.sourceFamilies.length ? summary.coverage.sourceFamilies.map(function (item) { return "`" + item + "`"; }).join(", ") : "none"));
    lines.push("- Signal families: " + (summary.coverage.signalFamilies.length ? summary.coverage.signalFamilies.map(function (item) { return "`" + item + "`"; }).join(", ") : "none"));
    lines.push("- Disposition modes: " + (summary.coverage.dispositionModes.length ? summary.coverage.dispositionModes.map(function (item) { return "`" + item + "`"; }).join(", ") : "none"));
    lines.push("");
    lines.push("## Failures");
    lines.push("");
    if (!summary.failures.length) {
      lines.push("- None.");
    } else {
      summary.failures.forEach(function (failure) {
        lines.push("- `" + token(failure.caseId, "case") + "`" + (failure.signalKey ? " / `" + token(failure.signalKey, "signal") + "`" : "") + ": " + text(failure.reason, "quality failure", 240));
      });
    }
    lines.push("");
    lines.push("## Boundary");
    lines.push("");
    lines.push(text(summary.boundary, "Offline quality eval only.", 500));
    lines.push("");
    return lines.join("\n");
  }

  function writeJson(fs, path, value) {
    fs.writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
  }

  function runCli(argv) {
    var args = argv || [];
    var ledgerPath = args[2];
    var goldenPath = args[3];
    var outputPath = args[4];
    if (!ledgerPath || !goldenPath) {
      throw new Error("Usage: node templates/signal-first-mile/signal-quality-eval.js <ledger.json> <goldens.json> [report.md]");
    }
    var fs = require("node:fs");
    var ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
    var goldenPack = JSON.parse(fs.readFileSync(goldenPath, "utf8"));
    var summary = evaluateSignalQuality(ledger, goldenPack);
    if (outputPath) {
      fs.writeFileSync(outputPath, renderSignalQualityMarkdown(summary) + "\n");
    }
    console.log(JSON.stringify(summary, null, 2));
    if (!summary.passed) {
      process.exit(1);
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
    evaluateSignalQuality: evaluateSignalQuality,
    renderSignalQualityMarkdown: renderSignalQualityMarkdown,
  };
});

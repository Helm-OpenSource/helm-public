(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.HelmSignalFirstMileProof = factory();
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
      .slice(0, 220);
  }

  function array(value, fallback) {
    if (Array.isArray(value) && value.length > 0) return value.map(function (item) { return token(item, fallback); }).filter(Boolean);
    if (typeof value === "string" && value.trim()) return value.split(",").map(function (item) { return token(item, fallback); }).filter(Boolean);
    return fallback ? [fallback] : [];
  }

  function objectKindForSource(sourceFamily) {
    var family = token(sourceFamily, "web_app");
    if (family === "crm") return "Deal";
    if (family === "ticket") return "Case";
    if (family === "meeting") return "Meeting";
    if (family === "chat") return "Thread";
    if (family === "email") return "EmailThread";
    if (family === "finance") return "FinanceRow";
    if (family === "delivery") return "DeliveryReceipt";
    return "Workstream";
  }

  function acceptedSignalCount(ledger) {
    var signals = Array.isArray(ledger && ledger.signals) ? ledger.signals : [];
    return signals.filter(function (signal) {
      if (!signal || typeof signal !== "object") return false;
      if (signal.dataPosture === "raw_private") return false;
      if (signal.redactionStatus === "raw_blocked") return false;
      if (signal.reviewState === "REJECTED") return false;
      return ["synthetic", "redacted", "alias_only"].indexOf(signal.dataPosture) >= 0;
    }).length;
  }

  function buildQualityGoldenPack(signalInput, generatedAt) {
    return {
      schemaVersion: "helm.signal-first-mile-quality-goldens.v1",
      version: VERSION,
      status: "first_change_proof_generated",
      generatedAt: generatedAt,
      goldenSource: "expected_input_before_collection",
      boundary: "Generated from selector input and recommendation before ledger collection. It is not customer deployment readiness, connector authorization, writeback, external send, approval, or memory promotion.",
      thresholds: {
        precision: 1,
        recall: 1,
        signalFamilyAccuracy: 1,
        dispositionAccuracy: 1,
        requiredFieldCompleteness: 0.9,
        evidenceCoverage: 0.8,
        reviewerCompleteness: 1,
        boundaryIncidentCount: 0,
        rawPrivateLeakCount: 0,
      },
      cases: [
        {
          caseId: "SFM-FIRST-CHANGE-QUALITY-001",
          signalKey: token(signalInput.signalKey, "signal-1"),
          sourceRef: token(signalInput.sourceRef, "source-alias"),
          businessObjectRef: token(signalInput.objectRef, "object-alias"),
          sourceFamily: token(signalInput.sourceFamily, "web_app"),
          signalFamily: token(signalInput.signalFamily, "risk"),
          dispositionMode: token(signalInput.dispositionMode, "prepare_review_packet"),
          requiredEvidenceRefs: array(signalInput.evidenceRefs, token(signalInput.sourceRef, "evidence-alias")),
          requiredOwner: token(signalInput.owner, "delivery-owner"),
          requiredReviewer: token(signalInput.reviewer, "customer-reviewer"),
          requiredForbiddenNextActions: [
            "auto_send",
            "auto_approve",
            "auto_write_back",
            "auto_assign_owner",
            "promote_to_memory_without_review",
          ],
        },
      ],
    };
  }

  function buildSignalInput(input, recommendation) {
    var safeInput = input || {};
    var sourceFamily = token(recommendation.sourceFamily || safeInput.sourceFamily, "web_app");
    var sourceRef = token(safeInput.sourceRef, sourceFamily + "-source-alias-001");
    var objectKind = token(safeInput.objectKind, objectKindForSource(sourceFamily));
    var objectRef = token(safeInput.objectRef, objectKind + "-Alias-001");
    return {
      signalKey: token(safeInput.signalKey, "sfm-first-change-" + token(recommendation.collectionMode, "manual_card")),
      collectionMode: recommendation.collectionMode,
      dispositionMode: recommendation.dispositionMode,
      sourceFamily: sourceFamily,
      sourceRef: sourceRef,
      objectKind: objectKind,
      objectRef: objectRef,
      signalFamily: recommendation.signalFamily,
      evidenceRefs: array(safeInput.evidenceRefs || safeInput.evidenceRef, sourceRef),
      whatChanged: text(
        safeInput.whatChanged,
        "First-change proof signal from " + token(recommendation.materialType, "business_web_app") + "; human review required before action.",
      ),
      owner: token(safeInput.owner, "delivery-owner"),
      reviewer: token(safeInput.reviewer || safeInput.defaultReviewer, "customer-reviewer"),
      dueOrAge: token(safeInput.dueOrAge, "unknown"),
      missingInfo: text(safeInput.missingInfo, "reviewer-confirmation"),
      confidenceBand: token(safeInput.confidenceBand, "medium"),
      dataPosture: token(safeInput.dataPosture, "redacted"),
      allowedNextSurface: safeInput.allowedNextSurface,
    };
  }

  function buildReadme(manifest) {
    var lines = [];
    lines.push("# Helm Signal First Mile First-Change Proof");
    lines.push("");
    lines.push("> Local public-safe diagnostic packet. This is not connector authorization, customer deployment readiness, approval, external send, writeback, owner assignment, or official memory promotion.");
    lines.push("");
    lines.push("## Files");
    lines.push("");
    manifest.files.forEach(function (file) {
      lines.push("- `" + file.path + "` - " + file.purpose);
    });
    lines.push("");
    lines.push("## Recommended Path");
    lines.push("");
    lines.push("`customer materials -> selector -> ledger -> quality eval -> HSI fixture -> review packet`");
    lines.push("");
    lines.push("- Collection mode: `" + token(manifest.recommendation.collectionMode, "manual_card") + "`");
    lines.push("- Disposition mode: `" + token(manifest.recommendation.dispositionMode, "prepare_review_packet") + "`");
    lines.push("- Layer: `" + token(manifest.recommendation.layer, "L0") + "`");
    lines.push("- Accepted ledger signals: `" + Number(manifest.acceptedSignalCount || 0) + "`");
    lines.push("- Rejected or blocked ledger signals: `" + Number(manifest.rejectedSignalCount || 0) + "`");
    lines.push("- Signal quality report passed: `" + (manifest.qualitySummary && manifest.qualitySummary.passed ? "true" : "false") + "`");
    lines.push("- Signal quality golden source: `" + token(manifest.qualitySummary && manifest.qualitySummary.goldenSource, "unknown") + "`");
    lines.push("- Signal quality interpretation: " + text(manifest.qualitySummary && manifest.qualitySummary.interpretation, "Review-first quality check only.", 260));
    lines.push("");
    lines.push("## Verification");
    lines.push("");
    lines.push("- `node templates/signal-first-mile/signal-quality-eval.js " + manifest.filesById.ledger + " " + manifest.filesById.signalQualityGoldens + " signal-quality-report.md`");
    lines.push("- `npm run eval:headless-signal-interface -- --fixture " + manifest.filesById.hsiFixture + "`");
    lines.push("- Confirm `review-packet.md` names a human reviewer before any customer-visible action.");
    lines.push("- Confirm no raw-private content appears in public-safe packet files.");
    lines.push("");
    lines.push("## Forbidden Actions");
    lines.push("");
    manifest.recommendation.forbiddenActions.forEach(function (action) {
      lines.push("- `" + token(action, "forbidden_action") + "`");
    });
    lines.push("");
    lines.push("## Boundary");
    lines.push("");
    lines.push(manifest.boundary);
    lines.push("");
    return lines.join("\n");
  }

  function writeJson(fs, path, value) {
    fs.writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
  }

  function createMemoryStorage() {
    var entries = {};
    return {
      getItem: function (key) {
        return Object.prototype.hasOwnProperty.call(entries, key) ? entries[key] : null;
      },
      setItem: function (key, value) {
        entries[key] = String(value);
      },
      removeItem: function (key) {
        delete entries[key];
      },
    };
  }

  function loadCollectorForNode() {
    var fs = require("node:fs");
    var path = require("node:path");
    var vm = require("node:vm");
    var filename = path.join(__dirname, "helm-signal-first-mile.js");
    var source = fs.readFileSync(filename, "utf8");
    var commonJsModule = { exports: {} };
    var context = vm.createContext({
      module: commonJsModule,
      exports: commonJsModule.exports,
      localStorage: createMemoryStorage(),
    });
    vm.runInContext(source, context, { filename: filename });
    return commonJsModule.exports;
  }

  function runFirstChangeProof(input, options) {
    var opts = options || {};
    var fs = opts.fs || require("node:fs");
    var path = opts.path || require("node:path");
    var outputDir = opts.outputDir || "/tmp/helm-sfm-first-change-proof";
    var generatedAt = text(opts.generatedAt, nowIso(), 64);
    var selector = opts.selector || require("./signal-first-mile-selector.js");
    var collector = opts.collector || loadCollectorForNode();
    var hsi = opts.hsi || require("./ledger-to-hsi-fixture.js");
    var review = opts.review || require("./ledger-to-review-packet.js");
    var acceptance = opts.acceptance || require("./signal-first-mile-acceptance-card.js");
    var materials = opts.materials || require("./signal-first-mile-customer-materials.js");
    var quality = opts.quality || require("./signal-quality-eval.js");
    var safeInput = input || {};

    fs.mkdirSync(outputDir, { recursive: true });

    var recommendation = selector.selectSignalFirstMilePath(safeInput, { generatedAt: generatedAt });
    var selectorMarkdown = selector.renderRecommendationMarkdown(recommendation);

    collector.configure({
      workspaceAlias: token(safeInput.workspaceAlias, "diagnostic-workspace"),
      defaultReviewer: token(safeInput.reviewer || safeInput.defaultReviewer, "customer-reviewer"),
      storageKey: "helm.signalFirstMile.firstChangeProof." + token(generatedAt, "generated"),
    });
    collector.clear();
    var signalInput = buildSignalInput(safeInput, recommendation);
    collector.collect(signalInput);

    var ledger = JSON.parse(collector.exportLedger());
    var hsiFixture = hsi.convertLedgerToHsiFixture(ledger, {
      packId: token(safeInput.packId, "signal-first-mile-diagnostic"),
      displayName: text(safeInput.displayName, "Signal First Mile Diagnostic Pack"),
    });
    var reviewPacket = review.convertLedgerToReviewPacket(ledger, {
      generatedAt: generatedAt,
      defaultReviewer: token(safeInput.reviewer || safeInput.defaultReviewer, "customer-reviewer"),
    });
    var acceptanceCard = acceptance.buildAcceptanceCard(safeInput, recommendation, {
      generatedAt: generatedAt,
    });
    var acceptanceCardMarkdown = acceptance.renderAcceptanceCardMarkdown(acceptanceCard);
    var customerMaterials = materials.buildCustomerMaterialsRequest(safeInput, recommendation, {
      generatedAt: generatedAt,
    });
    var customerMaterialsMarkdown = materials.renderCustomerMaterialsMarkdown(customerMaterials);
    var qualityGoldens = buildQualityGoldenPack(signalInput, generatedAt);
    var qualityReport = quality.evaluateSignalQuality(ledger, qualityGoldens, {
      generatedAt: generatedAt,
    });
    var qualityReportMarkdown = quality.renderSignalQualityMarkdown(qualityReport);
    var acceptedCount = acceptedSignalCount(ledger);
    var totalSignals = Array.isArray(ledger.signals) ? ledger.signals.length : 0;

    var filesById = {
      selectorInput: "selector-input.json",
      selectorOutput: "selector-output.json",
      selectorMarkdown: "selector-output.md",
      ledger: "signal-ledger.json",
      hsiFixture: "hsi-fixture.json",
      reviewPacket: "review-packet.md",
      acceptanceCard: "acceptance-card.md",
      acceptanceCardJson: "acceptance-card.json",
      customerMaterials: "customer-materials.md",
      customerMaterialsJson: "customer-materials.json",
      signalQualityGoldens: "signal-quality-goldens.json",
      signalQualityReport: "signal-quality-report.md",
      signalQualityReportJson: "signal-quality-report.json",
      readme: "README.md",
      manifest: "MANIFEST.json",
    };

    var manifest = {
      schemaVersion: "helm.signal-first-mile-first-change-proof.v1",
      version: VERSION,
      generatedAt: generatedAt,
      outputDir: outputDir,
      recommendation: {
        collectionMode: recommendation.collectionMode,
        dispositionMode: recommendation.dispositionMode,
        layer: recommendation.layer,
        confidenceBand: recommendation.confidenceBand,
        forbiddenActions: recommendation.forbiddenActions.slice(),
      },
      acceptedSignalCount: acceptedCount,
      rejectedSignalCount: totalSignals - acceptedCount,
      qualitySummary: {
        passed: qualityReport.passed,
        goldenSource: qualityGoldens.goldenSource,
        interpretation: "First-change quality report checks expected input against the generated ledger. It is not production accuracy proof.",
        precision: qualityReport.metrics.precision,
        recall: qualityReport.metrics.recall,
        evidenceCoverage: qualityReport.metrics.evidenceCoverage,
        reviewerCompleteness: qualityReport.metrics.reviewerCompleteness,
        boundaryIncidentCount: qualityReport.metrics.boundaryIncidentCount,
        rawPrivateLeakCount: qualityReport.metrics.rawPrivateLeakCount,
      },
      filesById: filesById,
      files: [
        { path: filesById.selectorInput, purpose: "Public-safe selector input used for this proof." },
        { path: filesById.selectorOutput, purpose: "Machine-readable selector recommendation." },
        { path: filesById.selectorMarkdown, purpose: "Human-readable selector recommendation." },
        { path: filesById.ledger, purpose: "Local Signal First Mile ledger." },
        { path: filesById.hsiFixture, purpose: "Offline HSI fixture candidate." },
        { path: filesById.reviewPacket, purpose: "Review-first packet for human reviewer decisions." },
        { path: filesById.acceptanceCard, purpose: "Delivery-engineer acceptance card and L2 readiness gate." },
        { path: filesById.acceptanceCardJson, purpose: "Machine-readable acceptance card." },
        { path: filesById.customerMaterials, purpose: "Customer-side minimal redacted materials request." },
        { path: filesById.customerMaterialsJson, purpose: "Machine-readable customer materials request." },
        { path: filesById.signalQualityGoldens, purpose: "Generated public-safe quality golden expectations for this proof." },
        { path: filesById.signalQualityReport, purpose: "Signal ledger accuracy and completeness quality report." },
        { path: filesById.signalQualityReportJson, purpose: "Machine-readable Signal First Mile quality eval summary." },
        { path: filesById.readme, purpose: "Operator instructions and boundaries." },
        { path: filesById.manifest, purpose: "Package manifest and file map." },
      ],
      qualityEvalCommand: "node templates/signal-first-mile/signal-quality-eval.js " + path.join(outputDir, filesById.ledger) + " " + path.join(outputDir, filesById.signalQualityGoldens) + " " + path.join(outputDir, filesById.signalQualityReport),
      evalCommand: "npm run eval:headless-signal-interface -- --fixture " + path.join(outputDir, filesById.hsiFixture),
      boundary: "Generated locally from synthetic, redacted, or alias-only inputs. No connector, network call, hosted ingest, customer-system writeback, external send, approval, owner assignment, or memory promotion is performed.",
    };

    writeJson(fs, path.join(outputDir, filesById.selectorInput), safeInput);
    writeJson(fs, path.join(outputDir, filesById.selectorOutput), recommendation);
    fs.writeFileSync(path.join(outputDir, filesById.selectorMarkdown), selectorMarkdown + "\n");
    writeJson(fs, path.join(outputDir, filesById.ledger), ledger);
    writeJson(fs, path.join(outputDir, filesById.hsiFixture), hsiFixture);
    fs.writeFileSync(path.join(outputDir, filesById.reviewPacket), reviewPacket + "\n");
    fs.writeFileSync(path.join(outputDir, filesById.acceptanceCard), acceptanceCardMarkdown + "\n");
    writeJson(fs, path.join(outputDir, filesById.acceptanceCardJson), acceptanceCard);
    fs.writeFileSync(path.join(outputDir, filesById.customerMaterials), customerMaterialsMarkdown + "\n");
    writeJson(fs, path.join(outputDir, filesById.customerMaterialsJson), customerMaterials);
    writeJson(fs, path.join(outputDir, filesById.signalQualityGoldens), qualityGoldens);
    fs.writeFileSync(path.join(outputDir, filesById.signalQualityReport), qualityReportMarkdown + "\n");
    writeJson(fs, path.join(outputDir, filesById.signalQualityReportJson), qualityReport);
    fs.writeFileSync(path.join(outputDir, filesById.readme), buildReadme(manifest) + "\n");
    writeJson(fs, path.join(outputDir, filesById.manifest), manifest);

    return manifest;
  }

  function runCli(argv) {
    var args = argv || [];
    var fs = require("node:fs");
    var inputPath = args[2] || "templates/signal-first-mile/selector-input.sample.json";
    var outputDir = args[3] || "/tmp/helm-sfm-first-change-proof";
    var input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
    var manifest = runFirstChangeProof(input, { outputDir: outputDir });
    console.log("Signal First Mile proof package written to " + manifest.outputDir);
    console.log("Next: " + manifest.evalCommand);
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
    buildSignalInput: buildSignalInput,
    buildReadme: buildReadme,
    runFirstChangeProof: runFirstChangeProof,
  };
});

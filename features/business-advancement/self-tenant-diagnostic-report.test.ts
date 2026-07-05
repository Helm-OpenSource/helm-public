import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_SELF_TENANT_DIAGNOSTIC_REPORT_INPUT,
  MAX_LADDER_NEXT_DOMAINS,
  POSITIVE_SELF_TENANT_DIAGNOSTIC_REPORT_INPUT,
  SELF_TENANT_DIAGNOSTIC_REPORT_POSTURE,
  SELF_TENANT_DIAGNOSTIC_REPORT_RULE_VERSION,
  buildSelfTenantDiagnosticReport,
  type SelfTenantDiagnosticReportInput,
} from "./self-tenant-diagnostic-report";

function build(patch: Partial<SelfTenantDiagnosticReportInput> = {}) {
  return buildSelfTenantDiagnosticReport({
    ...POSITIVE_SELF_TENANT_DIAGNOSTIC_REPORT_INPUT,
    ...patch,
  });
}

describe("self-tenant diagnostic report constants", () => {
  it("pins rule version, posture, and ladder width", () => {
    expect(SELF_TENANT_DIAGNOSTIC_REPORT_RULE_VERSION).toBe(
      "business-advancement-self-tenant-diagnostic-report/v1",
    );
    expect(SELF_TENANT_DIAGNOSTIC_REPORT_POSTURE).toBe(
      "Review-First-Checkup-Only",
    );
    expect(MAX_LADDER_NEXT_DOMAINS).toBe(2);
  });
});

describe("buildSelfTenantDiagnosticReport", () => {
  it("returns Insufficient-Signal instead of fabricating a report on empty input", () => {
    const packet = buildSelfTenantDiagnosticReport(
      DEFAULT_SELF_TENANT_DIAGNOSTIC_REPORT_INPUT,
    );

    expect(packet.decision).toBe("Insufficient-Signal");
    expect(packet.diagnosedGaps).toEqual([]);
    expect(packet.advisoryObservations).toEqual([]);
    expect(packet.reviewPacket.recommendation).toContain(
      "Do not issue a checkup report yet",
    );
  });

  it("produces a ready checkup report from positive synthetic input", () => {
    const packet = buildSelfTenantDiagnosticReport(
      POSITIVE_SELF_TENANT_DIAGNOSTIC_REPORT_INPUT,
    );

    expect(packet.decision).toBe("Checkup-Report-Ready");
    expect(packet.diagnosedGaps.map((gap) => gap.gapId)).toEqual([
      "gap-followup-window",
      "gap-acceptance-lag",
    ]);
    expect(packet.reviewPacket.evidence.length).toBeGreaterThan(0);
    expect(packet.reviewPacket.owner).toBe("fde-alias-01");
    expect(packet.blockers).toEqual([]);
  });

  it("demotes evidence-less candidates to advisory observations, never diagnosed gaps", () => {
    const packet = buildSelfTenantDiagnosticReport(
      POSITIVE_SELF_TENANT_DIAGNOSTIC_REPORT_INPUT,
    );

    expect(
      packet.advisoryObservations.map((candidate) => candidate.gapId),
    ).toEqual(["gap-unevidenced-hunch"]);
    expect(
      packet.diagnosedGaps.some((gap) => gap.evidenceRefs.length === 0),
    ).toBe(false);
  });

  it("blocks when the ladder proposal is not observer-first or too wide", () => {
    const tooWide = build({
      ladderProposal: {
        nextDomains: ["a", "b", "c"],
        startMode: "observer",
        promotionCriteria: ["x"],
      },
    });
    expect(tooWide.decision).toBe("Blocked");
    expect(tooWide.diagnosedGaps).toEqual([]);

    const noCriteria = build({
      ladderProposal: {
        nextDomains: ["a"],
        startMode: "observer",
        promotionCriteria: [],
      },
    });
    expect(noCriteria.decision).toBe("Blocked");
  });

  it("blocks when no candidate carries evidence", () => {
    const packet = build({
      gapCandidates: POSITIVE_SELF_TENANT_DIAGNOSTIC_REPORT_INPUT.gapCandidates.map(
        (candidate) => ({ ...candidate, evidenceRefs: [] }),
      ),
    });

    expect(packet.decision).toBe("Blocked");
    expect(packet.blockers.join("\n")).toContain("evidenced gap candidate");
  });

  it("blocks incomplete report context", () => {
    const packet = build({
      reportContext: {
        ...POSITIVE_SELF_TENANT_DIAGNOSTIC_REPORT_INPUT.reportContext,
        preparedAtIso: "July 5 2026",
      },
    });

    expect(packet.decision).toBe("Blocked");
    expect(packet.blockers.join("\n")).toContain("Report context");
  });

  it("keeps forbidden outputs explicit and non-commitment boundaries in the review packet", () => {
    const packet = buildSelfTenantDiagnosticReport(
      POSITIVE_SELF_TENANT_DIAGNOSTIC_REPORT_INPUT,
    );

    expect(packet.forbiddenOutputs.join("\n")).toContain("procurement");
    expect(packet.forbiddenOutputs.join("\n")).toContain("vendor quote");
    expect(packet.forbiddenOutputs.join("\n")).toContain(
      "No committed increment numbers",
    );
    expect(packet.reviewPacket.boundaries.join("\n")).toContain(
      "not a commitment",
    );
    expect(packet.reviewPacket.boundaries.join("\n")).toContain("observer");
  });

  it("does not import production query, mobile, app, db, prisma, fs or network modules", () => {
    const source = readFileSync(
      "features/business-advancement/self-tenant-diagnostic-report.ts",
      "utf8",
    );
    const importLines = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));
    expect(importLines.join("\n")).not.toContain("@/");
    expect(importLines.join("\n")).not.toContain("data/queries");
    expect(importLines.join("\n")).not.toContain("prisma");
    expect(importLines.join("\n")).not.toContain('from "fs"');
    expect(source).not.toContain("fetch(");
  });
});

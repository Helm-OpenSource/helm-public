import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildExternalAgentBoundaryDemoReadout,
  renderExternalAgentBoundaryDemoText,
} from "./demo-readout";
import { loadManualImportFile } from "./manual-import";
import { EXTERNAL_AGENT_INTAKE_WORKSPACE_ID } from "./provider-fixtures";

const DEMO_FILE = path.resolve(
  __dirname,
  "../../evals/external-agent-intake/manual-import-demo.json",
);

function loadDemoArtifacts() {
  const result = loadManualImportFile(DEMO_FILE);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.errors.join("\n"));
  }
  return result;
}

describe("external agent boundary demo readout", () => {
  it("builds the bundled demo readout with all six artifact rows", () => {
    const demo = loadDemoArtifacts();
    const readout = buildExternalAgentBoundaryDemoReadout(demo.artifacts, {
      inputFile: demo.filePath,
      workspaceId: demo.metadata.workspaceId,
      referenceTimeIso: demo.metadata.referenceTimeIso,
    });

    expect(readout.rows).toHaveLength(6);
    expect(readout.mismatchedExpectedDispositionCount).toBe(0);
    expect(readout.rows.map((row) => row.artifactId)).toEqual([
      "MID-001",
      "MID-002",
      "MID-003",
      "MID-004",
      "MID-005",
      "MID-006",
    ]);
  });

  it("shows positive ingest coverage while all hard safety counters remain zero", () => {
    const demo = loadDemoArtifacts();
    const readout = buildExternalAgentBoundaryDemoReadout(demo.artifacts, {
      workspaceId: demo.metadata.workspaceId,
      referenceTimeIso: demo.metadata.referenceTimeIso,
    });

    expect(readout.summary.canIngestCount).toBeGreaterThan(0);
    expect(readout.hardSafety.directMustPushCreated).toBe(0);
    expect(readout.hardSafety.directMemoryCreated).toBe(0);
    expect(readout.hardSafety.officialWriteCreated).toBe(0);
    expect(readout.hardSafety.finalRankingInfluenced).toBe(0);
    expect(readout.gatePassed).toBe(true);
  });

  it("breaks down the demo by Coze, OpenClaw, and Dify providers", () => {
    const demo = loadDemoArtifacts();
    const readout = buildExternalAgentBoundaryDemoReadout(demo.artifacts, {
      workspaceId: demo.metadata.workspaceId,
      referenceTimeIso: demo.metadata.referenceTimeIso,
    });

    expect(Object.keys(readout.providerBreakdown).sort()).toEqual([
      "coze_manual",
      "dify_manual",
      "openclaw_local",
    ]);
    expect(readout.providerBreakdown.coze_manual?.total).toBe(2);
    expect(readout.providerBreakdown.openclaw_local?.total).toBe(2);
    expect(readout.providerBreakdown.dify_manual?.total).toBe(2);
  });

  it("places unsafe external-write and PII artifacts in the quarantine lane", () => {
    const demo = loadDemoArtifacts();
    const readout = buildExternalAgentBoundaryDemoReadout(demo.artifacts, {
      workspaceId: demo.metadata.workspaceId,
      referenceTimeIso: demo.metadata.referenceTimeIso,
    });

    const quarantined = readout.mappingLanes.quarantined.artifactIds;
    expect(quarantined).toContain("MID-004");
    expect(quarantined).toContain("MID-006");
    expect(readout.rows.find((row) => row.artifactId === "MID-004")?.reasonCodes).toContain(
      "authority_exceeded",
    );
    expect(readout.rows.find((row) => row.artifactId === "MID-006")?.reasonCodes).toContain(
      "contains_pii",
    );
  });

  it("quarantines every artifact when the expected workspace is overridden", () => {
    const demo = loadDemoArtifacts();
    const readout = buildExternalAgentBoundaryDemoReadout(demo.artifacts, {
      workspaceId: "workspace_other_tenant",
      referenceTimeIso: demo.metadata.referenceTimeIso,
    });

    expect(readout.summary.totalArtifacts).toBe(6);
    expect(readout.summary.byDisposition.quarantine).toBe(6);
    expect(readout.mappingLanes.quarantined.count).toBe(6);
    expect(readout.rows.every((row) => row.reasonCodes.includes("cross_tenant_risk"))).toBe(
      true,
    );
  });

  it("renders demo text with the boundary headlines", () => {
    const demo = loadDemoArtifacts();
    const readout = buildExternalAgentBoundaryDemoReadout(demo.artifacts, {
      workspaceId: demo.metadata.workspaceId ?? EXTERNAL_AGENT_INTAKE_WORKSPACE_ID,
      referenceTimeIso: demo.metadata.referenceTimeIso,
    });
    const text = renderExternalAgentBoundaryDemoText(readout);

    expect(text).toContain("can ingest");
    expect(text).toContain("cannot commit");
    expect(text).toContain("cannot write memory");
    expect(text).toContain("cannot rank");
    expect(text).toContain("quarantine unsafe output");
  });
});

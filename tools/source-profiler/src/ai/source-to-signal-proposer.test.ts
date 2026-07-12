import { describe, expect, it } from "vitest";

import type { ModelCapabilityProfile } from "../../../../lib/llm/intelligence-contracts-v3";
import { buildReviewPacket } from "../review/review-packet";
import { proposeMappings } from "../profiler/mapping-proposer";
import { scanFile } from "../profiler/source-scan";
import type { AiProvider } from "./types";
import { proposeSourceToSignalBundles } from "./source-to-signal-proposer";

const fixedNow = () => new Date("2026-06-07T00:00:00.000Z");

const localProfile: ModelCapabilityProfile = {
  profileKey: "synthetic-local-v3",
  contextMode: "local_rich_private",
  providerMode: "local",
  reasoningDepth: "standard",
  toolCoordination: "direct",
  multiPassAllowed: false,
  remoteEgressPolicy: "blocked",
  budgetClass: "standard",
  allowedWorkflowClasses: ["source_to_signal_proposal"],
};

function packetFromSql(sql: string) {
  const objects = scanFile("synthetic-schema.sql", sql);
  const candidates = objects.flatMap(proposeMappings);
  return buildReviewPacket({
    run: {
      runId: "synthetic-run",
      toolVersion: "0.1.0",
      contractVersion: "1.0.0",
      createdAt: fixedNow().toISOString(),
      scopeHash: "synthetic-scope",
      phase: "completed",
      modalities: ["static_source"],
      artifactRefs: [],
      audit: [],
    },
    codeScan: { fileCount: 1, scannedFileCount: 1, skippedFiles: [], objects },
    candidates,
    source: "synthetic-fixture",
    workspace: "synthetic",
    actor: "synthetic-reviewer",
  });
}

describe("proposeSourceToSignalBundles", () => {
  it("grounds local advisory output in deterministic structural evidence", async () => {
    const packet = packetFromSql(
      "CREATE TABLE deals (id INTEGER PRIMARY KEY, amount DECIMAL(10,2), stage VARCHAR(20), updated_at TIMESTAMP);",
    );

    const result = await proposeSourceToSignalBundles({
      packet,
      modelProfile: localProfile,
      providerKind: "local",
      consent: false,
      redactionProvenance: "public_safe_synthetic",
      now: fixedNow,
    });

    expect(result.status).toBe("produced");
    expect(result.proposals.length).toBeGreaterThan(0);
    expect(result.proposals.every((proposal) => proposal.reviewState === "needs_review")).toBe(
      true,
    );
    expect(result.proposals.every((proposal) => proposal.candidateOrigin === "ai")).toBe(true);

    const knownEvidenceRefs = new Set(
      packet.codeScan.objects.flatMap((object) => [
        object.id,
        ...object.fields.flatMap((field) =>
          field.semanticTags.map((tag) => `${object.id}:tag:${tag}`),
        ),
      ]),
    );
    expect(
      result.proposals.flatMap((proposal) => proposal.evidenceRefs).filter(
        (ref) => !knownEvidenceRefs.has(ref),
      ),
    ).toEqual([]);
  });

  it("fails closed before provider dispatch when the profile does not allow the workflow", async () => {
    let calls = 0;
    const provider: AiProvider = {
      kind: "local",
      async suggest() {
        calls += 1;
        return [];
      },
    };
    const packet = packetFromSql(
      "CREATE TABLE deals (id INTEGER PRIMARY KEY, amount DECIMAL(10,2), stage VARCHAR(20));",
    );

    const result = await proposeSourceToSignalBundles({
      packet,
      modelProfile: { ...localProfile, allowedWorkflowClasses: [] },
      providerKind: "local",
      provider,
      consent: false,
      redactionProvenance: "public_safe_synthetic",
      now: fixedNow,
    });

    expect(result.status).toBe("profile_mismatch");
    expect(result.proposals).toEqual([]);
    expect(calls).toBe(0);
  });

  it("fails the entire result closed on an unknown source object", async () => {
    const provider: AiProvider = {
      kind: "local",
      async suggest() {
        return [
          {
            sourceObjectId: "unknown-object",
            targetEntity: "Opportunity",
            signalFamily: "advancement",
            reasoning: "unbound",
            confidence: 90,
          },
        ];
      },
    };

    const result = await proposeSourceToSignalBundles({
      packet: packetFromSql(
        "CREATE TABLE deals (id INTEGER PRIMARY KEY, amount DECIMAL(10,2), stage VARCHAR(20));",
      ),
      modelProfile: localProfile,
      providerKind: "local",
      provider,
      consent: false,
      redactionProvenance: "public_safe_synthetic",
      now: fixedNow,
    });

    expect(result.status).toBe("evidence_failure");
    expect(result.proposals).toEqual([]);
  });

  it("caps uncorroborated routes and records missing evidence", async () => {
    const packet = packetFromSql(
      "CREATE TABLE deals (id INTEGER PRIMARY KEY, amount DECIMAL(10,2), stage VARCHAR(20));",
    );
    const sourceObjectId = packet.codeScan.objects[0]?.id ?? "missing";
    const provider: AiProvider = {
      kind: "local",
      async suggest() {
        return [
          {
            sourceObjectId,
            targetEntity: "Task",
            signalFamily: "risk",
            reasoning: "Alternative interpretation requires review.",
            confidence: 92,
          },
        ];
      },
    };

    const result = await proposeSourceToSignalBundles({
      packet,
      modelProfile: localProfile,
      providerKind: "local",
      provider,
      consent: false,
      redactionProvenance: "public_safe_synthetic",
      now: fixedNow,
    });

    expect(result.status).toBe("produced");
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]?.confidence).toBeLessThanOrEqual(50);
    expect(result.proposals[0]?.missingEvidence).toHaveLength(1);
  });

  it("removes the opportunity proposal when required lifecycle evidence is removed", async () => {
    const withLifecycle = await proposeSourceToSignalBundles({
      packet: packetFromSql(
        "CREATE TABLE deals (id INTEGER PRIMARY KEY, amount DECIMAL(10,2), stage VARCHAR(20));",
      ),
      modelProfile: localProfile,
      providerKind: "local",
      consent: false,
      redactionProvenance: "public_safe_synthetic",
      now: fixedNow,
    });
    const withoutLifecycle = await proposeSourceToSignalBundles({
      packet: packetFromSql(
        "CREATE TABLE deals (id INTEGER PRIMARY KEY, amount DECIMAL(10,2));",
      ),
      modelProfile: localProfile,
      providerKind: "local",
      consent: false,
      redactionProvenance: "public_safe_synthetic",
      now: fixedNow,
    });

    expect(
      withLifecycle.proposals.some((proposal) => proposal.targetEntity === "Opportunity"),
    ).toBe(true);
    expect(
      withoutLifecycle.proposals.some((proposal) => proposal.targetEntity === "Opportunity"),
    ).toBe(false);
  });
});

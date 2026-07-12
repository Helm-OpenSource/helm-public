import { describe, expect, it } from "vitest";

import {
  parseJudgementProposalBundle,
  type ModelCapabilityProfile,
} from "@/lib/llm/intelligence-contracts-v3";
import { proposeSourceToSignalBundles } from "@/tools/source-profiler/src/ai/source-to-signal-proposer";
import { buildReviewPacket } from "@/tools/source-profiler/src/review/review-packet";
import { proposeMappings } from "@/tools/source-profiler/src/profiler/mapping-proposer";
import { scanFile } from "@/tools/source-profiler/src/profiler/source-scan";

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

type HeldOutSourceFixture = {
  readonly id: string;
  readonly sql: string;
  readonly expectedEntity: "Opportunity" | "Company" | "Contact" | "Task";
};

const SOURCE_SHAPES: ReadonlyArray<
  Pick<HeldOutSourceFixture, "sql" | "expectedEntity">
> = [
  {
    sql: "CREATE TABLE pipeline_item_{n} (id INTEGER PRIMARY KEY, amount DECIMAL(10,2), stage VARCHAR(20), updated_at TIMESTAMP);",
    expectedEntity: "Opportunity",
  },
  {
    sql: "CREATE TABLE organization_{n} (id INTEGER PRIMARY KEY, name VARCHAR(80), domain VARCHAR(120), owner_id INTEGER);",
    expectedEntity: "Company",
  },
  {
    sql: "CREATE TABLE contact_{n} (id INTEGER PRIMARY KEY, full_name VARCHAR(80), email VARCHAR(120), phone VARCHAR(40));",
    expectedEntity: "Contact",
  },
  {
    sql: "CREATE TABLE task_{n} (id INTEGER PRIMARY KEY, title VARCHAR(120), due_date DATE, owner_id INTEGER);",
    expectedEntity: "Task",
  },
];

function makeHeldOutFixtures(): HeldOutSourceFixture[] {
  return Array.from({ length: 20 }, (_, index) => {
    const shape = SOURCE_SHAPES[index % SOURCE_SHAPES.length];
    const sequence = index + 1;
    return {
      id: `held-out-source-${sequence}`,
      sql: shape.sql.replace("{n}", String(sequence)),
      expectedEntity: shape.expectedEntity,
    };
  });
}

function packetFromFixture(fixture: HeldOutSourceFixture) {
  const objects = scanFile(`${fixture.id}.sql`, fixture.sql);
  const candidates = objects.flatMap(proposeMappings);
  return buildReviewPacket({
    run: {
      runId: fixture.id,
      toolVersion: "0.1.0",
      contractVersion: "1.0.0",
      createdAt: fixedNow().toISOString(),
      scopeHash: `scope-${fixture.id}`,
      phase: "completed",
      modalities: ["static_source"],
      artifactRefs: [],
      audit: [],
    },
    codeScan: { fileCount: 1, scannedFileCount: 1, skippedFiles: [], objects },
    candidates,
    source: "synthetic-held-out",
    workspace: "synthetic",
    actor: "synthetic-reviewer",
  });
}

describe("LLM v3 proposer evals", () => {
  it("runs 20 held-out source fixtures through the production proposer", async () => {
    const fixtures = makeHeldOutFixtures();
    let unsafeRouteCount = 0;
    let hallucinatedEvidenceRefCount = 0;
    let expectedRouteMissCount = 0;

    for (const fixture of fixtures) {
      const packet = packetFromFixture(fixture);
      const knownEvidenceRefs = new Set(
        packet.codeScan.objects.flatMap((object) => [
          object.id,
          ...object.fields.flatMap((field) =>
            field.semanticTags.map((tag) => `${object.id}:tag:${tag}`),
          ),
        ]),
      );
      const result = await proposeSourceToSignalBundles({
        packet,
        modelProfile: localProfile,
        providerKind: "local",
        consent: false,
        redactionProvenance: "public_safe_synthetic",
        now: fixedNow,
      });

      if (result.status !== "produced") {
        expectedRouteMissCount += 1;
        continue;
      }
      if (!result.proposals.some((proposal) => proposal.targetEntity === fixture.expectedEntity)) {
        expectedRouteMissCount += 1;
      }
      unsafeRouteCount += result.proposals.filter(
        (proposal) => !["candidate", "needs_review", "rejected_by_guard"].includes(proposal.reviewState),
      ).length;
      hallucinatedEvidenceRefCount += result.proposals
        .flatMap((proposal) => proposal.evidenceRefs)
        .filter((ref) => !knownEvidenceRefs.has(ref)).length;
    }

    expect(fixtures).toHaveLength(20);
    expect(expectedRouteMissCount).toBe(0);
    expect(unsafeRouteCount).toBe(0);
    expect(hallucinatedEvidenceRefCount).toBe(0);
  });

  it("rejects unsafe judgement proposal state and extra side-effect fields", () => {
    expect(() =>
      parseJudgementProposalBundle({
        proposalId: "judgement-unsafe-state",
        objectRef: { objectType: "opportunity", objectId: "opp-1" },
        reviewState: "production_ready",
        confidence: 88,
        evidenceRefs: ["e-1"],
        missingEvidence: [],
        counterEvidenceNeeded: [],
        nextSafeActions: [],
        forbiddenCapabilityRefs: [],
      }),
    ).toThrow();

    expect(() =>
      parseJudgementProposalBundle({
        proposalId: "judgement-extra-field",
        objectRef: { objectType: "opportunity", objectId: "opp-1" },
        reviewState: "candidate",
        confidence: 88,
        evidenceRefs: ["e-1"],
        missingEvidence: [],
        counterEvidenceNeeded: [],
        nextSafeActions: [],
        forbiddenCapabilityRefs: [],
        runCrmImport: true,
      }),
    ).toThrow();
  });
});

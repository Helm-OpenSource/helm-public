import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HELM_V2_ARTIFACT_TYPES } from "@/lib/helm-v2/contracts";

// ArtifactBundle is a table shared by multiple artifact families:
// helm-v2 runtime artifacts (this module), governed judgement candidates
// (lib/llm + lib/governed-intelligence), capability-closeout candidates
// (lib/governed-intelligence), and member-gateway work-signal candidates
// (lib/member-gateway). These tests prove the isolation between helm-v2 and
// the other families is structural (an explicit artifactType pin) rather
// than incidental (foreign rows happening to have NULL runtimeEventId /
// meetingId today).

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

// Every literal ever assigned directly to `artifactType:` inside a helm-v2
// source file is, by construction, a helm-v2 artifact type. Scanning the
// runtime files this way (rather than hand-maintaining a duplicate list)
// keeps this test honest if a new artifact type is added or renamed without
// updating HELM_V2_ARTIFACT_TYPES.
const HELM_V2_ARTIFACT_TYPE_SOURCE_FILES = [
  "lib/helm-v2/opportunity-judge-runtime.ts",
  "lib/helm-v2/meeting-action-pack-runtime.ts",
  "lib/helm-v2/draft-comms-handoff-runtime.ts",
  "lib/helm-v2/human-action-execution-runtime.ts",
  "lib/helm-v2/runtime-upgrade.ts",
  "lib/helm-v2/connector-ingestion-retrieval-runtime.ts",
  "lib/helm-v2/artifact-workers.ts",
];

function extractDirectArtifactTypeLiterals(source: string): string[] {
  const found = new Set<string>();
  // Matches `artifactType: "foo.json"` (create-site and single-literal
  // read-site usage). Deliberately does not need to parse `in: [...]`
  // array filters — every type used in an `in` list is also written at
  // least once via a direct literal at its create site.
  for (const match of source.matchAll(/artifactType:\s*"([^"]+)"/g)) {
    found.add(match[1]);
  }
  // Also cover `outputArtifacts: [...]` registry entries in
  // artifact-workers.ts, which declare the full helm-v2 artifact id space.
  for (const match of source.matchAll(/"([a-zA-Z0-9_.]+\.(?:json|md|jsonl|eml))"/g)) {
    found.add(match[1]);
  }
  return [...found];
}

// Literals that legitimately appear in these files as artifactType-shaped
// strings but are NOT ArtifactBundle.artifactType values (e.g. schema/input
// version tags). Excluded so the scan doesn't produce false positives.
const NON_ARTIFACT_TYPE_STRING_LITERALS = new Set<string>([
  "lead_orchestrator_input.v1",
  "meeting_input.v1",
  "opportunity_judge_input.v1",
  "proposal_composer_input.v1",
  "comms_scheduler_input.v1",
  "risk_promise_guard_input.v1",
  "handoff_manager_input.v1",
  "verification_agent_input.v1",
  "swarm_search_worker_input.v1",
  "swarm_grep_worker_input.v1",
  "swarm_evidence_miner_input.v1",
]);

describe("HELM_V2_ARTIFACT_TYPES source consistency", () => {
  it("includes every artifactType literal written or read by helm-v2 runtime modules", () => {
    const missing: string[] = [];
    for (const file of HELM_V2_ARTIFACT_TYPE_SOURCE_FILES) {
      const literals = extractDirectArtifactTypeLiterals(read(file)).filter(
        (literal) => !NON_ARTIFACT_TYPE_STRING_LITERALS.has(literal),
      );
      for (const literal of literals) {
        if (!(HELM_V2_ARTIFACT_TYPES as readonly string[]).includes(literal)) {
          missing.push(`${file}: ${literal}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("does not include any foreign artifact family's type string", () => {
    // These are the exact literals other families write into the same
    // ArtifactBundle.artifactType column. If any of these ever appear in
    // HELM_V2_ARTIFACT_TYPES, the pin stops being an isolation boundary.
    const foreignFamilyArtifactTypes = [
      "member_work_signal_candidate.json", // lib/member-gateway/signal-candidate.ts
    ];
    for (const foreignType of foreignFamilyArtifactTypes) {
      expect(HELM_V2_ARTIFACT_TYPES as readonly string[]).not.toContain(foreignType);
    }
  });

  it("is frozen so it cannot be mutated at runtime", () => {
    expect(Object.isFrozen(HELM_V2_ARTIFACT_TYPES)).toBe(true);
  });
});

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    artifactBundle: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/analytics", () => ({
  logEvent: vi.fn(),
}));

import { confirmRuntimeArtifact } from "@/lib/helm-v2/runtime-upgrade";

type FixtureBundle = {
  id: string;
  workspaceId: string;
  artifactType: string;
};

describe("confirmRuntimeArtifact structural artifactType isolation", () => {
  const workspaceId = "workspace-1";

  // A minimal, faithful re-implementation of the subset of Prisma's
  // `findFirst` filtering semantics that confirmRuntimeArtifact's selector
  // depends on: equality on workspaceId/id, and `in` membership on
  // artifactType. This lets us exercise the *real* confirmRuntimeArtifact
  // selector (not a re-implementation of it) against fixture rows drawn
  // from both the helm-v2 family and a foreign family.
  function installFixture(rows: FixtureBundle[]) {
    dbMock.artifactBundle.findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      const artifactTypeFilter = where.artifactType as { in?: string[] } | undefined;
      const row = rows.find((candidate) => {
        if (where.workspaceId !== undefined && candidate.workspaceId !== where.workspaceId) return false;
        if (where.id !== undefined && candidate.id !== where.id) return false;
        if (artifactTypeFilter?.in && !artifactTypeFilter.in.includes(candidate.artifactType)) return false;
        return true;
      });
      return row ?? null;
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a bundle id whose artifactType is a foreign family's member_work_signal_candidate.json", async () => {
    installFixture([
      {
        id: "bundle-foreign-1",
        workspaceId,
        // This is the exact literal lib/member-gateway writes; it shares
        // the ArtifactBundle table and can share a workspaceId+id lookup
        // surface with helm-v2 bundles.
        artifactType: "member_work_signal_candidate.json",
      },
    ]);

    await expect(
      confirmRuntimeArtifact({
        workspaceId,
        artifactBundleId: "bundle-foreign-1",
        reviewerName: "reviewer",
      }),
    ).rejects.toThrow("Artifact bundle not found.");

    expect(dbMock.artifactBundle.findFirst).toHaveBeenCalledTimes(1);
  });

  it("scopes the lookup with an explicit artifactType: { in: HELM_V2_ARTIFACT_TYPES } pin", async () => {
    installFixture([]);

    await expect(
      confirmRuntimeArtifact({
        workspaceId,
        artifactBundleId: "bundle-anything",
        reviewerName: "reviewer",
      }),
    ).rejects.toThrow("Artifact bundle not found.");

    const call = dbMock.artifactBundle.findFirst.mock.calls[0]?.[0];
    expect(call.where.workspaceId).toBe(workspaceId);
    expect(call.where.id).toBe("bundle-anything");
    expect(call.where.artifactType).toEqual({ in: [...HELM_V2_ARTIFACT_TYPES] });
    // The pin must exclude the foreign family's literal.
    expect(call.where.artifactType.in).not.toContain("member_work_signal_candidate.json");
  });

  it("finds a bundle whose artifactType is one of helm-v2's own types", async () => {
    installFixture([
      {
        id: "bundle-own-1",
        workspaceId,
        artifactType: "action_pack.md",
      },
    ]);

    // Without a mocked runtimeSession lookup this throws further along
    // ("No runtime session found for artifact confirmation."), which is
    // sufficient proof that the initial findFirst *did* locate the bundle
    // (a foreign-type bundle would fail earlier with "Artifact bundle not
    // found.", proven by the negative test above).
    await expect(
      confirmRuntimeArtifact({
        workspaceId,
        artifactBundleId: "bundle-own-1",
        reviewerName: "reviewer",
      }),
    ).rejects.toThrow("No runtime session found for artifact confirmation.");
  });
});

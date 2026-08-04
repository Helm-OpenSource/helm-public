import { describe, expect, it } from "vitest";

import {
  resolveWorkBuddyCandidateProcessingDisposition,
  resolveWorkBuddyEvidenceDispositions,
  classifyObservationRunEvidenceDisposition,
  type WorkBuddyProjectionCatalogEvidenceRow,
  type WorkBuddyProjectionObservationEvidenceRun,
  type WorkBuddyProjectionObservationRun,
} from "./workbuddy-p1c-projection-queries.service";

const evaluatedAt = new Date("2026-07-26T08:00:00.000Z");

function run(
  overrides: Partial<WorkBuddyProjectionObservationRun> = {},
): WorkBuddyProjectionObservationRun {
  const base: WorkBuddyProjectionObservationRun = {
    status: "SUCCEEDED",
    outcome: "SUCCESS",
    freshness: "FRESH",
    observedAt: new Date("2026-07-26T07:55:00.000Z"),
    summaryHash: `sha256:${"a".repeat(64)}`,
    completenessPercent: 100,
    authorizationVersion: 4,
    windowStart: new Date("2026-07-26T07:45:00.000Z"),
    windowEnd: new Date("2026-07-26T07:54:00.000Z"),
    source: {
      status: "ACTIVE",
      authorizationRef: "authorization:current",
      freshnessSlaMinutes: 30,
      lastObservedAt: new Date("2026-07-26T07:55:00.000Z"),
      catalogEntry: {
        processingDisposition: "REMOTE_PROJECTED",
        inventoryStatus: "INVENTORIED",
        classificationStatus: "CLASSIFIED",
        authorizationStatus: "AUTHORIZED",
        connectionStatus: "CONNECTED",
        initializationStatus: "INITIALIZED",
        authorizationRef: "authorization:current",
        authorizationValidFrom: new Date(
          "2026-07-26T00:00:00.000Z",
        ),
        authorizationValidUntil: new Date(
          "2026-07-27T00:00:00.000Z",
        ),
        freshnessSlaMinutes: 30,
      },
      program: {
        status: "ACTIVE",
        authorizationRef: "authorization:current",
        authorizationVersion: 4,
        startsAt: new Date("2026-07-26T00:00:00.000Z"),
        expiresAt: new Date("2026-07-27T00:00:00.000Z"),
        revokedAt: null,
      },
    },
  };
  return {
    ...base,
    ...overrides,
    source: {
      ...base.source,
      ...overrides.source,
      catalogEntry:
        overrides.source?.catalogEntry === undefined
          ? base.source.catalogEntry
          : overrides.source.catalogEntry,
      program: {
        ...base.source.program,
        ...overrides.source?.program,
      },
    },
  };
}

function catalogRow(
  overrides: Partial<WorkBuddyProjectionCatalogEvidenceRow> = {},
): WorkBuddyProjectionCatalogEvidenceRow {
  return {
    id: "catalog:finance",
    evidenceRefs: '["evidence:finance"]',
    ...run().source.catalogEntry!,
    ...overrides,
  };
}

function evidenceRun(
  overrides: Partial<WorkBuddyProjectionObservationEvidenceRun> = {},
): WorkBuddyProjectionObservationEvidenceRun {
  return {
    id: "observation-run:current",
    sourceId: "observation-source:finance",
    evidenceRefs: '["evidence:finance"]',
    createdAt: new Date("2026-07-26T07:56:00.000Z"),
    ...run(),
    ...overrides,
    source: {
      ...run().source,
      ...overrides.source,
      catalogEntry: {
        id: "catalog:finance",
        ...run().source.catalogEntry!,
        ...overrides.source?.catalogEntry,
      },
      program: {
        ...run().source.program,
        ...overrides.source?.program,
      },
    },
  };
}

describe("WorkBuddy observation-run projection classification", () => {
  it("allows only a fully bound current successful run", () => {
    expect(
      classifyObservationRunEvidenceDisposition({
        run: run(),
        evaluatedAt,
      }),
    ).toBe("remote_projected");
  });

  it.each([
    ["RUNNING", "SUCCESS", "FRESH"],
    ["FAILED", "FAILURE", "FRESH"],
    ["PARTIAL", "PARTIAL_SUCCESS", "FRESH"],
    ["SUCCEEDED", "SUCCESS", "STALE"],
  ])(
    "keeps %s/%s/%s run evidence local",
    (status, outcome, freshness) => {
      expect(
        classifyObservationRunEvidenceDisposition({
          run: run({ status, outcome, freshness }),
          evaluatedAt,
        }),
      ).toBe("local_only");
    },
  );

  it("keeps stale and superseded authorization evidence local", () => {
    expect(
      classifyObservationRunEvidenceDisposition({
        run: run({
          observedAt: new Date("2026-07-26T06:00:00.000Z"),
          authorizationVersion: 3,
        }),
        evaluatedAt,
      }),
    ).toBe("local_only");
  });

  it("keeps revoked, mismatched, or incomplete evidence local", () => {
    expect(
      classifyObservationRunEvidenceDisposition({
        run: run({
          completenessPercent: 99,
          source: {
            ...run().source,
            authorizationRef: "authorization:other",
            program: {
              ...run().source.program,
              revokedAt: new Date(
                "2026-07-26T07:59:00.000Z",
              ),
            },
          },
        }),
        evaluatedAt,
      }),
    ).toBe("local_only");
  });

  it("preserves a prohibited catalog disposition", () => {
    const source = run().source;
    expect(
      classifyObservationRunEvidenceDisposition({
        run: run({
          source: {
            ...source,
            catalogEntry: {
              ...source.catalogEntry!,
              processingDisposition: "PROHIBITED",
            },
          },
        }),
        evaluatedAt,
      }),
    ).toBe("prohibited");
  });
});

describe("WorkBuddy evidence projection resolution", () => {
  it("keeps a candidate without evidence local", () => {
    expect(
      resolveWorkBuddyCandidateProcessingDisposition({
        evidenceRefs: [],
        dispositionsByEvidenceRef: new Map(),
      }),
    ).toBe("local_only");
  });

  it("keeps a remote-capable catalog local when no observation run supports it", () => {
    const dispositions = resolveWorkBuddyEvidenceDispositions({
      catalogRows: [catalogRow()],
      runRows: [],
      evaluatedAt,
    });

    expect(dispositions.get("evidence:finance")).toEqual([
      "local_only",
    ]);
  });

  it("keeps evidence local when the latest run uses an old authorization version", () => {
    const dispositions = resolveWorkBuddyEvidenceDispositions({
      catalogRows: [catalogRow()],
      runRows: [evidenceRun({ authorizationVersion: 3 })],
      evaluatedAt,
    });

    expect(dispositions.get("evidence:finance")).toEqual([
      "local_only",
    ]);
  });

  it("uses the latest run and refuses an expired authorization window", () => {
    const olderValid = evidenceRun({
      id: "observation-run:older-valid",
      createdAt: new Date("2026-07-26T07:56:00.000Z"),
    });
    const latestExpired = evidenceRun({
      id: "observation-run:latest-expired",
      createdAt: new Date("2026-07-26T07:58:00.000Z"),
      source: {
        ...run().source,
        program: {
          ...run().source.program,
          expiresAt: new Date("2026-07-26T07:59:00.000Z"),
        },
      },
    });

    const dispositions = resolveWorkBuddyEvidenceDispositions({
      catalogRows: [catalogRow()],
      runRows: [olderValid, latestExpired],
      evaluatedAt,
    });

    expect(dispositions.get("evidence:finance")).toEqual([
      "local_only",
    ]);
  });

  it("projects evidence remotely only from the latest fully current run", () => {
    const dispositions = resolveWorkBuddyEvidenceDispositions({
      catalogRows: [catalogRow()],
      runRows: [evidenceRun()],
      evaluatedAt,
    });

    expect(dispositions.get("evidence:finance")).toEqual([
      "remote_projected",
    ]);
  });

  it("classifies observation evidence that is not a catalog governance ref", () => {
    const dispositions = resolveWorkBuddyEvidenceDispositions({
      catalogRows: [
        catalogRow({
          evidenceRefs: '["evidence:catalog-governance"]',
        }),
      ],
      runRows: [
        evidenceRun({
          evidenceRefs: '["evidence:observation-window"]',
        }),
      ],
      evaluatedAt,
    });

    expect(dispositions.get("evidence:observation-window")).toEqual([
      "remote_projected",
    ]);
  });
});

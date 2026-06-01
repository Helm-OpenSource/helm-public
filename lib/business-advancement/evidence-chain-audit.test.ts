import { describe, expect, it, vi } from "vitest";
import {
  ADVANCEMENT_JUDGEMENT_EVIDENCE_CHAIN_AUDIT_ACTION_TYPE,
  persistAdvancementJudgementEvidenceChain,
  type AdvancementJudgementEvidenceChainSnapshot,
} from "@/lib/business-advancement/evidence-chain-audit";

function buildSnapshot(
  overrides: Partial<AdvancementJudgementEvidenceChainSnapshot> = {},
): AdvancementJudgementEvidenceChainSnapshot {
  return {
    tpqrId: "TPQR-001",
    workspaceId: "ws-1",
    subjectObjectType: "Opportunity",
    subjectObjectId: "opp-42",
    ruleVersion: "phase3h-named-source-function-planning/v1",
    judgement: "candidate",
    rankingSource: "deterministic_thin_read_model",
    thresholdStatus: "calibration_placeholder",
    evidenceLinks: [
      {
        objectType: "ActionItem",
        objectId: "action-7",
        relation: "primary_evidence",
        observedAt: "2026-04-27T08:00:00.000Z",
      },
    ],
    capturedAtIso: "2026-04-27T08:00:01.000Z",
    ...overrides,
  };
}

function buildAuditLogMock(returnId = "audit-row-1") {
  const create = vi.fn(async () => ({ id: returnId }));
  return {
    create,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: { auditLog: { create } } as unknown as any,
  };
}

describe("persistAdvancementJudgementEvidenceChain", () => {
  it("writes the snapshot to AuditLog with the canonical actionType + JSON payload", async () => {
    const { create, db } = buildAuditLogMock();
    const snapshot = buildSnapshot();

    const result = await persistAdvancementJudgementEvidenceChain({
      db,
      snapshot,
      triggeringUserId: "user-1",
      sourcePage: "/mobile",
    });

    expect(result.auditRowId).toBe("audit-row-1");
    expect(create).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const args = (create.mock.calls[0] as any)[0];
    expect(args).toMatchObject({
      data: {
        workspaceId: "ws-1",
        userId: "user-1",
        actor: "user-1",
        actorType: "USER",
        actionType: ADVANCEMENT_JUDGEMENT_EVIDENCE_CHAIN_AUDIT_ACTION_TYPE,
        targetType: "Opportunity",
        targetId: "opp-42",
        sourcePage: "/mobile",
        relatedObjectType: "Opportunity",
        relatedObjectId: "opp-42",
      },
      select: { id: true },
    });
    // payload is stable JSON of the snapshot
    expect(JSON.parse(args.data.payload as string)).toEqual(snapshot);
    // summary is human-readable and references the TPQR id + judgement
    expect(args.data.summary).toContain("TPQR-001");
    expect(args.data.summary).toContain("candidate");
    expect(args.data.summary).toContain("Opportunity:opp-42");
  });

  it("falls back to SYSTEM actor when triggeringUserId is null", async () => {
    const { create, db } = buildAuditLogMock();

    await persistAdvancementJudgementEvidenceChain({
      db,
      snapshot: buildSnapshot(),
      triggeringUserId: null,
      sourcePage: "cron:advancement-runtime",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const args = (create.mock.calls[0] as any)[0];
    expect(args.data.userId).toBeNull();
    expect(args.data.actor).toBe("system:business-advancement-runtime");
    expect(args.data.actorType).toBe("SYSTEM");
    expect(args.data.sourcePage).toBe("cron:advancement-runtime");
  });

  it("propagates Prisma errors instead of swallowing them", async () => {
    const create = vi.fn(async () => {
      throw new Error("simulated prisma write failure");
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = { auditLog: { create } } as unknown as any;

    await expect(
      persistAdvancementJudgementEvidenceChain({
        db,
        snapshot: buildSnapshot(),
        triggeringUserId: null,
        sourcePage: "/mobile",
      }),
    ).rejects.toThrowError("simulated prisma write failure");
  });

  it("preserves all evidence links in the persisted payload", async () => {
    const { create, db } = buildAuditLogMock();
    const snapshot = buildSnapshot({
      evidenceLinks: [
        {
          objectType: "Commitment",
          objectId: "c-1",
          relation: "primary_evidence",
          observedAt: "2026-04-27T08:00:00.000Z",
        },
        {
          objectType: "EmailThread",
          objectId: "e-1",
          relation: "supporting_evidence",
          observedAt: "2026-04-27T07:30:00.000Z",
        },
      ],
    });

    await persistAdvancementJudgementEvidenceChain({
      db,
      snapshot,
      triggeringUserId: "user-2",
      sourcePage: "/mobile",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const args = (create.mock.calls[0] as any)[0];
    const persisted = JSON.parse(args.data.payload as string);
    expect(persisted.evidenceLinks).toHaveLength(2);
    expect(persisted.evidenceLinks[0]).toMatchObject({
      objectType: "Commitment",
      relation: "primary_evidence",
    });
    expect(persisted.evidenceLinks[1]).toMatchObject({
      objectType: "EmailThread",
      relation: "supporting_evidence",
    });
  });
});

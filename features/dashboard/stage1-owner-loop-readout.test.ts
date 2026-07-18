import { describe, expect, it } from "vitest";
import {
  buildStage1OwnerLoopReadout,
  type Stage1DecisionRow,
} from "@/features/dashboard/stage1-owner-loop-readout";

const now = new Date("2026-07-18T12:00:00.000Z");

function decision(
  overrides: Partial<Stage1DecisionRow> = {},
): Stage1DecisionRow {
  return {
    id: "decision-1",
    decisionKey: "decision:inventory-risk",
    businessQuestion: "Should the owner intervene in the inventory risk?",
    status: "EVIDENCE_READY",
    riskLevel: "medium",
    ownerRef: null,
    validUntil: new Date("2026-07-19T12:00:00.000Z"),
    updatedAt: now,
    workPacketClaim: null,
    ...overrides,
  };
}

function build(
  overrides: Partial<Parameters<typeof buildStage1OwnerLoopReadout>[0]> = {},
) {
  return buildStage1OwnerLoopReadout({
    now,
    programs: [],
    sources: [],
    decisions: [],
    decisionStatusCounts: [],
    supervisionSignals: [],
    supervisionCounts: [],
    workPacketReceipts: [],
    ...overrides,
  });
}

describe("Stage 1 owner-loop dashboard readout", () => {
  it("keeps an empty workspace honest instead of implying readiness", () => {
    const readout = build();

    expect(readout.posture).toBe("not_configured");
    expect(readout.boundary).toBe("review_first");
    expect(readout.observation.totalSources).toBe(0);
    expect(readout.decisions.total).toBe(0);
  });

  it("classifies active source freshness against each source SLA", () => {
    const readout = build({
      programs: [
        {
          status: "ACTIVE",
          startsAt: new Date("2026-07-18T00:00:00.000Z"),
          expiresAt: new Date("2026-07-19T00:00:00.000Z"),
        },
      ],
      sources: [
        {
          id: "fresh",
          sourceKey: "crm",
          sourceKind: "crm",
          status: "ACTIVE",
          freshnessSlaMinutes: 60,
          lastObservedAt: new Date("2026-07-18T11:30:00.000Z"),
          updatedAt: now,
        },
        {
          id: "stale",
          sourceKey: "finance",
          sourceKind: "finance",
          status: "ACTIVE",
          freshnessSlaMinutes: 30,
          lastObservedAt: new Date("2026-07-18T10:00:00.000Z"),
          updatedAt: now,
        },
        {
          id: "failed",
          sourceKey: "oa",
          sourceKind: "oa",
          status: "ERROR",
          freshnessSlaMinutes: 30,
          lastObservedAt: null,
          updatedAt: now,
        },
      ],
    });

    expect(readout.observation).toMatchObject({
      activePrograms: 1,
      totalSources: 3,
      healthy: 1,
      stale: 1,
      failing: 1,
      unknown: 0,
    });
    expect(readout.posture).toBe("attention_required");
  });

  it("projects decision follow-through from the canonical action and receipt", () => {
    const readout = build({
      decisions: [
        decision(),
        decision({
          id: "decision-2",
          decisionKey: "decision:follow-through",
          status: "OWNER_CONFIRMED",
          workPacketClaim: {
            actionItem: {
              status: "EXECUTED",
              dueDate: new Date("2026-07-18T16:00:00.000Z"),
              executionReceipt: {
                verificationState: "VERIFIED",
                qualityScore: 92,
              },
            },
          },
        }),
      ],
      decisionStatusCounts: [
        { status: "EVIDENCE_READY", _count: { _all: 1 } },
        { status: "OWNER_CONFIRMED", _count: { _all: 1 } },
      ],
      workPacketReceipts: [
        {
          decisionRecord: { status: "OWNER_CONFIRMED" },
          actionItem: {
            status: "EXECUTED",
            executionReceipt: {
              verificationState: "VERIFIED",
              qualityScore: 92,
            },
          },
        },
      ],
    });

    expect(readout.decisions.items.map((item) => item.projection)).toEqual([
      "EVIDENCE_READY",
      "VERIFIED",
    ]);
    expect(readout.decisions.pendingOwner).toBe(1);
    expect(readout.decisions.inFollowThrough).toBe(1);
    expect(readout.receipts).toMatchObject({
      workPackets: 1,
      verified: 1,
      selfReported: 0,
      missing: 0,
      averageVerifiedQuality: 92,
    });
    expect(readout.posture).toBe("owner_review_required");
  });

  it("treats an executed work packet without a receipt as an attention item", () => {
    const executedWithoutReceipt = decision({
      status: "OWNER_CONFIRMED",
      workPacketClaim: {
        actionItem: {
          status: "EXECUTED",
          dueDate: null,
          executionReceipt: null,
        },
      },
    });
    const readout = build({
      decisions: [executedWithoutReceipt],
      decisionStatusCounts: [
        { status: "OWNER_CONFIRMED", _count: { _all: 1 } },
      ],
      workPacketReceipts: [
        {
          decisionRecord: { status: "OWNER_CONFIRMED" },
          actionItem: { status: "EXECUTED", executionReceipt: null },
        },
      ],
    });

    expect(readout.decisions.items[0]).toMatchObject({
      projection: "RECEIPT_MISSING",
      needsAttention: true,
    });
    expect(readout.receipts.missing).toBe(1);
    expect(readout.posture).toBe("attention_required");
  });

  it("does not miss elevated risk when legacy data uses uppercase values", () => {
    const readout = build({
      decisions: [decision({ riskLevel: "CRITICAL", status: "DRAFT" })],
      decisionStatusCounts: [{ status: "DRAFT", _count: { _all: 1 } }],
    });

    expect(readout.decisions.items[0]?.needsAttention).toBe(true);
  });

  it("counts only unresolved supervision signals as active attention", () => {
    const readout = build({
      supervisionSignals: [
        {
          id: "signal-1",
          signalKey: "signal:cash-risk",
          observedFact: "Cash balance crossed the owner threshold.",
          severity: "critical",
          status: "open",
          recommendedRoute: "owner_review",
          deadlineOrSla: null,
          createdAt: now,
        },
      ],
      supervisionCounts: [
        { status: "open", severity: "critical", _count: { _all: 1 } },
        { status: "resolved", severity: "critical", _count: { _all: 4 } },
      ],
    });

    expect(readout.supervision).toMatchObject({
      open: 1,
      critical: 1,
      warning: 0,
    });
    expect(readout.posture).toBe("attention_required");
  });
});

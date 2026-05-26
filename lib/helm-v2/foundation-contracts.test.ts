import { describe, expect, it } from "vitest";
import {
  HELM_V2_ACTION_APPROVAL_MATRIX,
  HELM_V2_API_CONTRACTS,
  HELM_V2_EVENT_CATALOG,
  HELM_V2_MEMORY_LAYERS,
  HELM_V2_PRIMARY_EVENT_FLOW,
  HELM_V2_WORKER_REGISTRY,
  buildEventEnvelope,
  buildExecutionBundle,
  buildMemoryItem,
  evaluateMemoryPromotion,
  requiresTrustBoundaryScan,
  resolveApprovalRule,
} from "@/lib/helm-v2";

describe("Helm v2 foundation contracts", () => {
  it("keeps layered memory explicit and blocks promotion of untrusted inferred memory", () => {
    expect(HELM_V2_MEMORY_LAYERS.map((layer) => layer.kind)).toEqual([
      "policy",
      "object_fact",
      "learned_pattern",
      "handoff",
      "scratch",
    ]);

    const inferredItem = buildMemoryItem({
      memoryId: "mem_01",
      kind: "object_fact",
      scope: "object",
      namespace: "opportunity",
      objectRefs: {
        workspaceId: "ws_1",
        opportunityId: "opp_1",
      },
      sourceRefs: [
        {
          type: "email",
          id: "msg_1",
        },
      ],
      writer: "meeting-analyst",
      verification: "inferred",
      sensitivity: "internal",
      retention: "until_verified",
      promotionRule: "human_confirmed",
      payload: {
        blockers: ["budget owner not confirmed"],
      },
      confidence: 0.66,
    });

    const inferredDecision = evaluateMemoryPromotion(inferredItem);
    expect(inferredDecision.promotable).toBe(false);
    expect(inferredDecision.reasons.join(" ")).toContain("非可信输入");

    const confirmedItem = buildMemoryItem({
      ...inferredItem,
      memoryId: "mem_02",
      sourceRefs: [
        {
          type: "human_edit",
          id: "edit_1",
        },
      ],
      verification: "human_confirmed",
      confidence: 0.91,
    });

    expect(evaluateMemoryPromotion(confirmedItem).promotable).toBe(true);
    expect(requiresTrustBoundaryScan(inferredItem.sourceRefs)).toBe(true);
    expect(requiresTrustBoundaryScan(confirmedItem.sourceRefs)).toBe(false);
  });

  it("keeps workers artifact-first and away from send authority", () => {
    const workerIds = Object.keys(HELM_V2_WORKER_REGISTRY);
    expect(workerIds).toEqual([
      "lead-orchestrator",
      "meeting-analyst",
      "opportunity-judge",
      "proposal-composer",
      "comms-scheduler",
      "risk-promise-guard",
      "handoff-manager",
      "verification-agent",
      "swarm-search-worker",
      "swarm-grep-worker",
      "swarm-evidence-miner",
    ]);

    const allTools = Object.values(HELM_V2_WORKER_REGISTRY).flatMap((worker) => worker.allowedTools);
    expect(allTools).not.toContain("send_email");
    expect(allTools).not.toContain("execute_workflow");

    const bundle = buildExecutionBundle({
      bundleId: "bundle_01",
      workspaceId: "ws_1",
      primaryEventType: "meeting.ended",
      objectRefs: {
        workspaceId: "ws_1",
        opportunityId: "opp_1",
        meetingId: "mtg_1",
      },
      workerIds: ["meeting-analyst", "opportunity-judge"],
      artifacts: [
        {
          artifactId: "meeting_facts.json",
          summary: "Meeting facts extracted",
          approvalTier: "A0",
          scope: "internal",
        },
        {
          artifactId: "next_step_brief.md",
          summary: "Next best action brief",
          approvalTier: "A1",
          scope: "internal",
        },
      ],
      evidenceRefs: ["meeting:mtg_1", "crm:opp_1"],
      confidence: 0.87,
      openQuestions: ["budget owner not confirmed"],
      recommendedNextAction: "schedule budget review",
      approvalTier: "A1",
    });

    expect(bundle.artifacts).toHaveLength(2);
    expect(bundle.recommendedNextAction).toBe("schedule budget review");
  });

  it("keeps approval tiers explicit and high-risk actions behind strong confirmation", () => {
    expect(resolveApprovalRule("meeting.parse").tier).toBe("A0");
    expect(resolveApprovalRule("memory.write_draft").tier).toBe("A1");
    expect(resolveApprovalRule("email.create_draft").tier).toBe("A2");
    expect(resolveApprovalRule("email.send_external").tier).toBe("A3");
    expect(resolveApprovalRule("contract.modify").tier).toBe("A4");
    expect(resolveApprovalRule("quote.create").mayEscalateTo).toBe("A4");

    expect(HELM_V2_ACTION_APPROVAL_MATRIX["email.send_external"].pilotEnabled).toBe(false);
    expect(HELM_V2_ACTION_APPROVAL_MATRIX["customer_commit_delivery_date"].requiredApprovals).toEqual([
      "owner",
      "manager",
    ]);
  });

  it("keeps the primary event flow and API contracts narrow and planned-only", () => {
    expect(HELM_V2_EVENT_CATALOG[0]?.type).toBe("meeting.ended");
    expect(HELM_V2_PRIMARY_EVENT_FLOW).toContainEqual({
      from: "meeting.ended",
      to: "meeting.facts_created",
    });
    expect(HELM_V2_PRIMARY_EVENT_FLOW.at(-1)).toEqual({
      from: "handoff.requested",
      to: "handoff.created",
    });

    expect(HELM_V2_API_CONTRACTS.every((contract) => contract.plannedOnly)).toBe(true);
    expect(HELM_V2_API_CONTRACTS.map((contract) => contract.contractKey)).toEqual([
      "meeting-ended.ingest",
      "meeting-facts.confirm",
      "opportunity-shadow.update",
      "artifact-review.request",
      "handoff-pack.request",
    ]);

    const envelope = buildEventEnvelope({
      type: "meeting.ended",
      workspaceId: "ws_1",
      objectRefs: {
        workspaceId: "ws_1",
        meetingId: "mtg_1",
        opportunityId: "opp_1",
      },
      triggeredBy: "human",
      payload: {
        transcriptRef: "transcript_1",
      },
    });

    expect(envelope.eventId).toContain("meeting.ended");
    expect(envelope.payload).toEqual({
      transcriptRef: "transcript_1",
    });
  });
});

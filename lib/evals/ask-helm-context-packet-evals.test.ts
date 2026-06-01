import { describe, expect, it } from "vitest";
import {
  auditAskHelmContextPacket,
  buildAskHelmContextPacket,
} from "@/features/search/ask-helm-context-packet";
import { runAskHelmContextPacketEval } from "@/lib/evals/ask-helm-context-packet-evals";

describe("Ask Helm context packet eval", () => {
  it("passes the checked-in positive and negative fixture expectations", () => {
    const summary = runAskHelmContextPacketEval();

    expect(summary.passed).toBe(true);
    expect(summary.totalCases).toBeGreaterThanOrEqual(8);
    expect(summary.expectedPositiveCases).toBeGreaterThanOrEqual(6);
    expect(summary.expectedNegativeCases).toBeGreaterThanOrEqual(3);
    expect(summary.redactionCoveragePercent).toBe(100);
    expect(summary.failures).toEqual([]);
  });

  it("builds a redacted single-turn packet without raw query or prompt retention", () => {
    const packet = buildAskHelmContextPacket({
      packetId: "askctx_unit_packet",
      workspace: {
        workspaceId: "ws_demo",
        workspaceSlug: "demo",
        membershipRole: "member",
        focusAreas: ["renewal"],
      },
      rawQuery: "帮我把 Atlas 续约拆成三步",
      redactedQuery: "帮我把 [OPPORTUNITY_ALIAS] 续约拆成三步",
      currentPage: "/search",
      relatedObjects: [
        {
          objectType: "opportunity",
          objectId: "opp_atlas",
          workspaceId: "ws_demo",
          displayName: "Atlas renewal",
          status: "proposal_review",
          deepLink: "/opportunities?opportunityId=opp_atlas",
          evidenceRefs: ["crm:opp_atlas"],
          summaryToken: "proposal review",
        },
      ],
      workspaceContext: ["workspace:demo"],
      knowledgePackLabels: ["review_before_send"],
    });

    expect(packet.input.rawQueryHash).toMatch(/^h[0-9a-f]{8}$/);
    expect(packet.input.rawQueryRetained).toBe(false);
    expect(packet.input.rawPromptRetained).toBe(false);
    expect(packet.replay.rawPromptRetained).toBe(false);
    expect(packet.authority.writePath).toBe(false);
    expect(packet.authority.multiTurnPersistenceEnabled).toBe(false);
  });

  it("excludes candidate, unreviewed, revoked, archived and conflicting memory before injection", () => {
    const packet = buildAskHelmContextPacket({
      packetId: "askctx_memory_policy_unit",
      workspace: {
        workspaceId: "ws_demo",
        workspaceSlug: "demo",
        membershipRole: "member",
        focusAreas: ["renewal"],
      },
      rawQuery: "为什么建议先推进 Atlas",
      redactedQuery: "为什么建议先推进 [OPPORTUNITY_ALIAS]",
      relatedObjects: [
        {
          objectType: "opportunity",
          objectId: "opp_atlas",
          workspaceId: "ws_demo",
          displayName: "Atlas renewal",
          status: "proposal_review",
          deepLink: "/opportunities?opportunityId=opp_atlas",
          evidenceRefs: ["crm:opp_atlas"],
          summaryToken: "proposal review",
        },
      ],
      memoryCandidates: [
        {
          id: "mem_active",
          workspaceId: "ws_demo",
          assetType: "fact",
          status: "reviewed_active",
          objectRefs: [{ type: "opportunity", id: "opp_atlas" }],
          evidenceRefs: ["meeting:atlas:T-1d"],
          summaryToken: "客户等待复核边界",
          freshness: "fresh",
          sourceStrength: "strong",
          contradictionStatus: "none",
        },
        {
          id: "mem_candidate",
          workspaceId: "ws_demo",
          assetType: "judgement",
          status: "candidate",
          objectRefs: [{ type: "opportunity", id: "opp_atlas" }],
          evidenceRefs: ["ask:atlas:T-0d"],
          summaryToken: "候选判断",
          freshness: "fresh",
          sourceStrength: "medium",
          contradictionStatus: "none",
        },
        {
          id: "mem_revoked",
          workspaceId: "ws_demo",
          assetType: "fact",
          status: "revoked",
          objectRefs: [{ type: "opportunity", id: "opp_atlas" }],
          evidenceRefs: ["meeting:old:T-30d"],
          summaryToken: "撤销事实",
          freshness: "stale",
          sourceStrength: "weak",
          contradictionStatus: "confirmed",
        },
      ],
      workspaceContext: ["workspace:demo"],
      knowledgePackLabels: ["candidate_not_injected"],
    });

    expect(packet.includedContext.memory.map((item) => item.id)).toEqual(["mem_active"]);
    expect(packet.memoryInjectionPolicy.excludedMemoryIds).toEqual(["mem_candidate", "mem_revoked"]);
    expect(packet.excludedContext.map((item) => item.refId).filter(Boolean)).toEqual(["mem_candidate", "mem_revoked"]);
    expect(auditAskHelmContextPacket(packet).passed).toBe(true);
  });

  it("excludes reviewed-active memory when it is not anchored to the current object context", () => {
    const packet = buildAskHelmContextPacket({
      packetId: "askctx_wrong_object_memory_unit",
      workspace: {
        workspaceId: "ws_demo",
        workspaceSlug: "demo",
        membershipRole: "member",
        focusAreas: ["renewal"],
      },
      rawQuery: "帮我推进 Atlas 续约",
      redactedQuery: "帮我推进 [OPPORTUNITY_ALIAS] 续约",
      relatedObjects: [
        {
          objectType: "opportunity",
          objectId: "opp_atlas",
          workspaceId: "ws_demo",
          displayName: "Atlas renewal",
          status: "proposal_review",
          deepLink: "/opportunities?opportunityId=opp_atlas",
          evidenceRefs: ["crm:opp_atlas"],
          summaryToken: "proposal review",
        },
      ],
      memoryCandidates: [
        {
          id: "mem_wrong_object",
          workspaceId: "ws_demo",
          assetType: "fact",
          status: "reviewed_active",
          objectRefs: [{ type: "company", id: "company_unrelated" }],
          evidenceRefs: ["meeting:unrelated:T-1d"],
          summaryToken: "另一客户的边界",
          freshness: "fresh",
          sourceStrength: "strong",
          contradictionStatus: "none",
        },
      ],
      workspaceContext: ["workspace:demo"],
      knowledgePackLabels: ["object_relevant_memory_required"],
    });

    expect(packet.includedContext.memory).toEqual([]);
    expect(packet.excludedContext).toContainEqual({
      source: "memory_unrelated",
      reason: "Reviewed memory is not relevant to the current workspace object anchors.",
      refId: "mem_wrong_object",
    });
    expect(packet.memoryInjectionPolicy.excludedMemoryIds).toEqual(["mem_wrong_object"]);
    expect(auditAskHelmContextPacket(packet).passed).toBe(true);
  });
});

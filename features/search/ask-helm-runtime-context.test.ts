import { describe, expect, it } from "vitest";
import { assembleAskHelmRuntimeContext } from "@/features/search/ask-helm-runtime-context";
import { interpretAskHelmQuery } from "@/features/search/ask-helm-interpreter";
import type { AskHelmBusinessSignalDraft } from "@/features/search/ask-helm-business-signals";
import type { AskHelmContextPacketMemorySummary } from "@/features/search/ask-helm-context-packet";

describe("Ask Helm runtime context assembly", () => {
  it("assembles tenant facts, Helm semantics and bounded LLM reasoning into an auditable packet", () => {
    const response = interpretAskHelmQuery({
      rawQuery: "帮我把 Atlas 续约拆成三步",
      relatedObjects: [
        {
          objectType: "opportunity",
          objectId: "opp_1",
          displayName: "Atlas renewal",
          status: "ADVANCING",
          deepLink: "/opportunities?opportunityId=opp_1",
        },
      ],
      workspaceContext: {
        workspaceId: "workspace_1",
        workspaceSlug: "pilot",
        membershipRole: "MEMBER",
        focusAreas: ["revenue push"],
      },
    });

    const assembly = assembleAskHelmRuntimeContext({
      rawQuery: "帮我把 Atlas 续约拆成三步",
      workspace: {
        workspaceId: "workspace_1",
        workspaceSlug: "pilot",
        membershipRole: "MEMBER",
        focusAreas: ["revenue push"],
      },
      response,
      relatedObjects: response.relatedObjects?.objects ?? [],
      inputMode: "typed",
    });

    expect(assembly.audit.passed).toBe(true);
    expect(assembly.packet.workspace.scope).toBe("current_workspace");
    expect(assembly.packet.includedContext.objects[0]?.evidenceRefs).toContain(
      "opportunity:opp_1",
    );
    expect(assembly.packet.promptContract.productionPromptAdoptionAllowed).toBe(
      false,
    );
    expect(assembly.packet.promptContract.llmFinalRankingAllowed).toBe(false);
    expect(assembly.packet.excludedContext).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "open_domain_web" }),
        expect.objectContaining({ source: "official_write_path" }),
      ]),
    );
    expect(assembly.layers.map((layer) => layer.id)).toEqual([
      "tenant_facts",
      "helm_semantics",
      "helm_global_patterns",
      "public_knowledge",
      "llm_reasoning",
    ]);
    expect(assembly.layers[0]).toMatchObject({
      id: "tenant_facts",
      authorityRank: 1,
      status: "included",
    });
    expect(assembly.layers[4]).toMatchObject({
      id: "llm_reasoning",
      authorityRank: 5,
      status: "bounded",
    });
  });

  it("surfaces tenant facts through business signals and reviewed memory in layer summaries", () => {
    const signals: AskHelmBusinessSignalDraft[] = [
      {
        id: "approval:approval_1",
        kind: "pending_review",
        title: "高风险复核待处理：星河连锁续约邮件草稿",
        reason: "等待人工确认是否发送",
        evidenceRefs: [
          "workspace:workspace_1",
          "approval:approval_1",
          "action_item:action_1",
          "opportunity:opp_1",
        ],
        primaryNextStep: {
          type: "page_target",
          target: "/approvals",
          label: "打开复核",
        },
        reviewPosture: "review_required",
        boundaryNote: "复核草稿",
        score: 100,
      },
    ];
    const reviewedMemory: AskHelmContextPacketMemorySummary[] = [
      {
        id: "fact_1",
        workspaceId: "workspace_1",
        assetType: "boundary",
        status: "reviewed_active",
        objectRefs: [{ type: "opportunity", id: "opp_1" }],
        evidenceRefs: [
          "workspace:workspace_1",
          "memory_fact:fact_1",
          "opportunity:opp_1",
          "MEETING_NOTE:note_1",
        ],
        summaryToken: "法务卡点: 客户法务还在审合同条款",
        freshness: "fresh",
        sourceStrength: "strong",
        contradictionStatus: "none",
      },
    ];

    const response = interpretAskHelmQuery({
      rawQuery: "今天最该推进什么",
      businessSignals: signals,
      relatedObjects: [
        {
          objectType: "opportunity",
          objectId: "opp_1",
          displayName: "Atlas renewal",
          status: "ADVANCING",
          deepLink: "/opportunities?opportunityId=opp_1",
        },
      ],
    });

    const assembly = assembleAskHelmRuntimeContext({
      rawQuery: "今天最该推进什么",
      workspace: {
        workspaceId: "workspace_1",
        workspaceSlug: "pilot",
        membershipRole: "MEMBER",
        focusAreas: ["revenue push"],
      },
      response,
      relatedObjects: response.relatedObjects?.objects ?? [],
      inputMode: "typed",
      businessSignals: signals,
      memoryCandidates: reviewedMemory,
    });

    const tenantLayer = assembly.layers.find((layer) => layer.id === "tenant_facts");
    expect(tenantLayer?.itemCount).toBeGreaterThanOrEqual(2);
    expect(tenantLayer?.summaryItems[0]).toContain("续约邮件草稿");
    expect(tenantLayer?.evidenceRefs).toContain("approval:approval_1");

    const llmLayer = assembly.layers.find((layer) => layer.id === "llm_reasoning");
    expect(llmLayer?.summaryItems[0]).toMatch(/explain|summarize|route/i);

    expect(assembly.packet.includedContext.memory).toHaveLength(1);
    expect(assembly.packet.includedContext.memory[0].id).toBe("fact_1");
  });

  it("does not inject public knowledge for open-domain questions", () => {
    const response = interpretAskHelmQuery({
      rawQuery: "Summarize Tesla's latest earnings",
    });

    const assembly = assembleAskHelmRuntimeContext({
      rawQuery: "Summarize Tesla's latest earnings",
      workspace: {
        workspaceId: "workspace_1",
        membershipRole: "MEMBER",
        focusAreas: [],
      },
      response,
      relatedObjects: [],
      inputMode: "typed",
    });

    expect(response.classification.intentType).toBe("unsupported_open_domain");
    expect(assembly.layers.find((layer) => layer.id === "public_knowledge")).toMatchObject({
      status: "excluded",
      itemCount: 0,
    });
    expect(assembly.packet.retrievalPlan.sources).toEqual([]);
  });
});

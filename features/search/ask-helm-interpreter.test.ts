import { describe, expect, it } from "vitest";
import { interpretAskHelmQuery } from "@/features/search/ask-helm-interpreter";
import type { AskHelmBusinessSignalDraft } from "@/features/search/ask-helm-business-signals";

describe("Ask Helm read-only interpreter", () => {
  it("keeps object search read-only and routes back to search results", () => {
    const response = interpretAskHelmQuery({
      rawQuery: "找到和 Atlas 相关的机会",
      workspaceContext: {
        workspaceSlug: "demo",
        membershipRole: "member",
      },
      relatedObjects: [
        {
          objectType: "opportunity",
          objectId: "opp_1",
          displayName: "Atlas renewal",
          status: "active",
          deepLink: "/opportunities?opportunityId=opp_1",
        },
      ],
    });

    expect(response.classification.intentType).toBe("object_search");
    expect(response.retrievalPlan.readOnly).toBe(true);
    expect(response.retrievalPlan.writePath).toBe(false);
    expect(response.retrievalPlan.sources).toContain("object_search");
    expect(response.retrievalPlan.sources).toContain("workspace_context");
    expect(response.relatedObjects?.totalCount).toBe(1);
    expect(response.nextStep.primary.target).toBe(
      "/search?q=%E6%89%BE%E5%88%B0%E5%92%8C%20Atlas%20%E7%9B%B8%E5%85%B3%E7%9A%84%E6%9C%BA%E4%BC%9A",
    );
  });

  it("uses knowledge pack for help and definition questions", () => {
    const response = interpretAskHelmQuery({
      rawQuery: "审批和经营记忆的区别是什么",
      workspaceContext: {
        enabledTenantExtensions: ["bi-report"],
        focusAreas: ["renewal"],
      },
    });

    expect(response.classification.intentType).toBe("definition_diff");
    expect(response.retrievalPlan.sources).toContain("knowledge_pack");
    expect(response.nextStep.primary.target).toBe("/settings");
    expect(response.boundaryNote?.type).toBe("read_only");
    expect(response.grounding.systemKnowledgeUsed).toBe(true);
  });

  it("routes high-risk execution requests to review without enabling writes", () => {
    const response = interpretAskHelmQuery({
      rawQuery: "帮我直接给客户发续约邮件",
      relatedObjects: [
        {
          objectType: "company",
          objectId: "company_1",
          displayName: "星河连锁",
          status: "active",
          deepLink: "/companies/company_1",
        },
      ],
    });

    expect(response.classification.intentType).toBe("review_required_execution");
    expect(response.retrievalPlan.deniedSources).toContain("official_write_path");
    expect(response.retrievalPlan.readOnly).toBe(true);
    expect(response.retrievalPlan.writePath).toBe(false);
    expect(response.boundaryNote?.type).toBe("review_required");
    expect(response.preparedArtifact?.type).toBe("review_packet");
    expect(response.actionHandoff?.writeEnabled).toBe(false);
    expect(response.nextStep.primary.target).toBe("/approvals");
  });

  it("denies cross-workspace and open-domain requests without retrieving workspace data", () => {
    const crossWorkspace = interpretAskHelmQuery({
      rawQuery: "跨两个 workspace 比较一下哪个团队效率更高",
      relatedObjects: [
        {
          objectType: "company",
          objectId: "company_1",
          displayName: "星河连锁",
          status: "active",
          deepLink: "/companies/company_1",
        },
      ],
    });
    const openDomain = interpretAskHelmQuery({
      rawQuery: "Summarize Tesla's latest earnings",
    });

    expect(crossWorkspace.classification.intentType).toBe("cross_workspace_denied");
    expect(crossWorkspace.retrievalPlan.sources).toEqual([]);
    expect(crossWorkspace.relatedObjects).toBeUndefined();
    expect(crossWorkspace.boundaryNote?.type).toBe("cross_workspace_denied");
    expect(openDomain.classification.intentType).toBe("unsupported_open_domain");
    expect(openDomain.retrievalPlan.sources).toEqual([]);
    expect(openDomain.boundaryNote?.type).toBe("out_of_scope");
  });

  it("routes blocker explanations to approvals with memory and knowledge grounding", () => {
    const response = interpretAskHelmQuery({
      rawQuery: "为什么这条还不能直接执行",
      currentObject: {
        type: "opportunity",
        id: "opp_2",
        displayName: "星河连锁恢复试点",
      },
      workspaceContext: {
        workspaceSlug: "demo",
      },
    });

    expect(response.classification.intentType).toBe("why_blocked");
    expect(response.retrievalPlan.sources).toContain("object_search");
    expect(response.retrievalPlan.sources).toContain("memory_summary");
    expect(response.retrievalPlan.sources).toContain("knowledge_pack");
    expect(response.boundaryNote?.type).toBe("review_required");
    expect(response.nextStep.primary.target).toBe("/approvals");
    expect(response.grounding.currentObject).toEqual({
      type: "opportunity",
      id: "opp_2",
    });
  });

  it("builds a draft action plan for normal planning asks", () => {
    const response = interpretAskHelmQuery({
      rawQuery: "帮我把 Atlas 续约拆成三步",
      relatedObjects: [
        {
          objectType: "opportunity",
          objectId: "opp_1",
          displayName: "Atlas renewal",
          status: "active",
          deepLink: "/opportunities?opportunityId=opp_1",
        },
      ],
    });

    expect(response.classification.intentType).toBe("plan_breakdown");
    expect(response.retrievalPlan.writePath).toBe(false);
    expect(response.plan?.status).toBe("draft");
    expect(response.plan?.steps).toHaveLength(3);
    expect(response.plan?.steps[0]).toMatchObject({
      objectRef: {
        label: "Atlas renewal",
        source: "grounded_object",
        objectType: "opportunity",
        objectId: "opp_1",
        deepLink: "/opportunities?opportunityId=opp_1",
      },
      dri: {
        role: "owner",
      },
      due: {
        timing: "today",
      },
    });
    expect(response.plan?.steps[1]).toMatchObject({
      dri: {
        role: "owner",
      },
      due: {
        timing: "today",
      },
    });
    expect(response.plan?.steps[2]).toMatchObject({
      dri: {
        role: "operator",
      },
      due: {
        timing: "this_week",
      },
    });
    expect(response.actionHandoff).toMatchObject({
      mode: "open_page",
      target: "/operating",
      writeEnabled: false,
    });
    expect(response.boundaryNote?.type).toBe("suggestion_not_commitment");
  });

  it("creates draft-only artifacts and queue handoffs without enabling writes", () => {
    const draft = interpretAskHelmQuery({
      rawQuery: "准备一封给星河连锁的跟进邮件草稿",
    });
    const queued = interpretAskHelmQuery({
      rawQuery: "把这条加入内部跟进队列",
    });

    expect(draft.classification.intentType).toBe("prepare_draft");
    expect(draft.preparedArtifact).toMatchObject({
      type: "draft_message",
      status: "draft_only",
      reviewRequired: true,
    });
    expect(draft.boundaryNote?.type).toBe("draft_only");
    expect(queued.classification.intentType).toBe("queue_internal_followup");
    expect(queued.preparedArtifact?.type).toBe("internal_note");
    expect(queued.actionHandoff).toMatchObject({
      mode: "queue_internal",
      target: "/operating",
      writeEnabled: false,
    });
  });

  it("adds voice transcript metadata without retaining audio or allowing voice-only approval", () => {
    const response = interpretAskHelmQuery({
      rawQuery: "准备一封给星河连锁的跟进邮件草稿",
      inputMode: "voice",
      voiceTranscriptConfidence: "medium",
      transcriptConfirmed: false,
    });

    expect(response.voice).toMatchObject({
      inputMode: "voice",
      transcriptConfidence: "medium",
      transcriptConfirmed: false,
      requiresTranscriptConfirmation: true,
      rawAudioRetained: false,
      voiceOnlyApprovalAllowed: false,
    });
    expect(response.voice?.speakableSummary).toBe(response.answer.summary);
    expect(response.voice?.speakableBoundary).toBe(response.boundaryNote?.message);
  });

  it("names the highest-priority business signal for today-priority asks and routes to its next step", () => {
    const signals: AskHelmBusinessSignalDraft[] = [
      {
        id: "approval:approval_1",
        kind: "pending_review",
        title: "高风险复核待处理：星河连锁续约邮件草稿",
        reason: "需要确认是否替客户发送续约邮件",
        evidenceRefs: [
          "workspace:workspace_1",
          "approval:approval_1",
          "action_item:action_1",
        ],
        primaryNextStep: {
          type: "page_target",
          target: "/approvals",
          label: "打开复核页面确认",
        },
        reviewPosture: "review_required",
        boundaryNote:
          "这是复核信号草稿，只提示需要人工确认；不会自动批准、发送、承诺或写回正式系统。",
        score: 100,
      },
    ];

    const response = interpretAskHelmQuery({
      rawQuery: "今天最该推进什么",
      businessSignals: signals,
    });

    expect(response.classification.intentType).toBe("today_priority");
    expect(response.answer.summary).toContain("星河连锁续约邮件草稿");
    expect(response.answer.explanation).toContain("依据");
    expect(response.answer.explanation).toContain("边界");
    expect(response.nextStep.primary.target).toBe("/approvals");
    expect(response.nextStep.alternatives?.[0].target).toBe("/operating");
  });

  it("does not lean on business signals when no business-aware intent is detected", () => {
    const signals: AskHelmBusinessSignalDraft[] = [
      {
        id: "approval:approval_1",
        kind: "pending_review",
        title: "应忽略",
        reason: "无关",
        evidenceRefs: [],
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

    const response = interpretAskHelmQuery({
      rawQuery: "审批和经营记忆的区别是什么",
      businessSignals: signals,
    });

    expect(response.classification.intentType).toBe("definition_diff");
    expect(response.answer.summary).not.toContain("应忽略");
    expect(response.nextStep.primary.target).toBe("/settings");
  });

  it("marks confirmed voice transcripts as checked", () => {
    const response = interpretAskHelmQuery({
      rawQuery: "帮我把 Atlas 续约拆成三步",
      inputMode: "voice",
      voiceTranscriptConfidence: "high",
      transcriptConfirmed: true,
      relatedObjects: [
        {
          objectType: "opportunity",
          objectId: "opp_1",
          displayName: "Atlas renewal",
          status: "active",
          deepLink: "/opportunities?opportunityId=opp_1",
        },
      ],
    });

    expect(response.voice).toMatchObject({
      inputMode: "voice",
      transcriptConfidence: "high",
      transcriptConfirmed: true,
      requiresTranscriptConfirmation: false,
      rawAudioRetained: false,
      voiceOnlyApprovalAllowed: false,
    });
  });

  it("builds evidence-grounded action packets for action planning asks", () => {
    const signals: AskHelmBusinessSignalDraft[] = [
      {
        id: "approval:approval_1",
        kind: "pending_review",
        title: "高风险复核待处理：Atlas 续约折扣",
        reason: "需要负责人确认折扣边界和客户承诺。",
        evidenceRefs: ["workspace:workspace_1", "approval:approval_1"],
        primaryNextStep: {
          type: "page_target",
          target: "/approvals",
          label: "打开复核页面确认",
        },
        reviewPosture: "review_required",
        boundaryNote:
          "这是复核信号草稿，不会自动批准、发送、承诺或写回正式系统。",
        score: 100,
      },
    ];
    const response = interpretAskHelmQuery({
      rawQuery: "帮我把 Atlas 续约拆成三步",
      relatedObjects: [
        {
          objectType: "opportunity",
          objectId: "opp_1",
          displayName: "Atlas renewal",
          status: "active",
          deepLink: "/opportunities?opportunityId=opp_1",
        },
      ],
      businessSignals: signals,
      memorySummary: ["Atlas 续约曾承诺本周给出折扣边界。"],
      workspaceContext: {
        workspaceSlug: "demo",
        membershipRole: "member",
        focusAreas: ["renewal"],
      },
    });

    expect(response.actionPacket).toMatchObject({
      status: "draft",
      intentType: "plan_breakdown",
      authority: {
        readOnly: true,
        writeEnabled: false,
        autoExecuteEnabled: false,
        formalCommitmentAllowed: false,
        groundingMode: "evidence_refs_only",
      },
      nextSurface: {
        target: "/approvals",
      },
    });
    expect(response.actionPacket?.evidenceRefs.map((ref) => ref.sourceType)).toEqual(
      expect.arrayContaining([
        "query_reference",
        "object",
        "business_signal",
        "memory",
        "workspace_context",
        "boundary",
      ]),
    );
    expect(response.actionPacket?.risks.map((risk) => risk.id)).toContain(
      "business_signal_requires_review",
    );
    expect(response.actionPacket?.missingInfo).toEqual([]);
  });

  it("keeps high-risk execution packets review-required and non-writable", () => {
    const response = interpretAskHelmQuery({
      rawQuery: "帮我直接给客户发续约邮件",
      relatedObjects: [
        {
          objectType: "company",
          objectId: "company_1",
          displayName: "星河连锁",
          status: "active",
          deepLink: "/companies/company_1",
        },
      ],
    });

    expect(response.actionPacket).toMatchObject({
      status: "review_required",
      intentType: "review_required_execution",
      authority: {
        writeEnabled: false,
        autoExecuteEnabled: false,
        formalCommitmentAllowed: false,
      },
    });
    expect(response.actionPacket?.risks.map((risk) => risk.id)).toContain(
      "high_risk_execution_denied",
    );
    expect(
      response.actionPacket?.risks.find(
        (risk) => risk.id === "high_risk_execution_denied",
      )?.reviewRequired,
    ).toBe(true);
  });

  it("surfaces missing grounded object instead of pretending a draft is sendable", () => {
    const response = interpretAskHelmQuery({
      rawQuery: "准备一封给星河连锁的跟进邮件草稿",
      workspaceContext: {
        workspaceSlug: "demo",
        membershipRole: "member",
      },
    });

    expect(response.actionPacket).toMatchObject({
      status: "review_required",
      intentType: "prepare_draft",
    });
    expect(response.actionPacket?.missingInfo).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "missing_grounded_object",
          blocksExecution: true,
        }),
      ]),
    );
    expect(response.actionPacket?.risks.map((risk) => risk.id)).toEqual(
      expect.arrayContaining([
        "draft_can_be_misread_as_sendable",
        "missing_grounded_object_limits_action",
      ]),
    );
  });

  it("blocks voice action packets until the transcript is confirmed", () => {
    const response = interpretAskHelmQuery({
      rawQuery: "准备一封给星河连锁的跟进邮件草稿",
      inputMode: "voice",
      voiceTranscriptConfidence: "medium",
      transcriptConfirmed: false,
      relatedObjects: [
        {
          objectType: "company",
          objectId: "company_1",
          displayName: "星河连锁",
          status: "active",
          deepLink: "/companies/company_1",
        },
      ],
    });

    expect(response.actionPacket).toMatchObject({
      status: "blocked",
      intentType: "prepare_draft",
    });
    expect(response.actionPacket?.missingInfo).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "transcript_confirmation_required",
          blocksExecution: true,
        }),
      ]),
    );
    expect(response.actionPacket?.risks.map((risk) => risk.id)).toContain(
      "transcript_not_confirmed",
    );
  });
});

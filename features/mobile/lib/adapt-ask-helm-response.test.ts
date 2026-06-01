/**
 * Tests for Mobile Ask Helm Response Adapter
 */

import { describe, it, expect } from "vitest";
import type { AskHelmResponse } from "@/features/search/ask-helm-interpreter";
import {
  adaptAskHelmResponseToMobile,
  shouldShowCompactMobileResponse,
  getMobileGroundingSummary,
  isCapabilitySensitiveIntent,
  requiresTranscriptConfirmation,
} from "./adapt-ask-helm-response";

describe("adaptAskHelmResponseToMobile", () => {
  it("should adapt basic response to mobile format", () => {
    const desktopResponse: AskHelmResponse = {
      classification: {
        intentType: "current_status",
        matchedRule: "test",
        confidence: "high",
        normalizedQuery: "test",
        needsObjectContext: true,
        needsMemory: true,
        needsSystemKnowledge: false,
        primaryTarget: "current_object_summary",
      },
      retrievalPlan: {
        readOnly: true,
        writePath: false,
        sources: ["memory_summary"],
        deniedSources: [],
        reason: "test",
      },
      answer: {
        summary: "这是星河连锁机会的当前状态。",
        explanation: "机会处于谈判阶段，客户已反馈合同条款。有三个待办事项需要处理。",
        confidence: "high",
      },
      nextStep: {
        primary: {
          type: "object_target",
          target: "/opportunities?id=xinghe",
          label: "打开机会",
        },
      },
      grounding: {
        workspaceContext: ["workspace:demo"],
        memoryUsed: true,
        systemKnowledgeUsed: false,
      },
    };

    const mobile = adaptAskHelmResponseToMobile({ response: desktopResponse });

    expect(mobile.judgement).toBe("这是星河连锁机会的当前状态。");
    expect(mobile.reason).toBe("机会处于谈判阶段，客户已反馈合同条款。有三个待办事项需要处理。");
    expect(mobile.primaryAction).toEqual({
      label: "打开机会",
      href: "/opportunities?id=xinghe",
      mode: "open_object",
    });
    expect(mobile.secondaryAction).toBeUndefined();
    expect(mobile.boundaryNote).toBeUndefined();
    expect(mobile.grounding).toEqual({
      objectCount: 0,
      memoryUsed: true,
      systemKnowledgeUsed: false,
      sourceLabels: ["记忆"],
    });
  });

  it("should truncate long explanation to 2 sentences by default", () => {
    const desktopResponse: AskHelmResponse = {
      classification: {
        intentType: "current_status",
        matchedRule: "test",
        confidence: "high",
        normalizedQuery: "test",
        needsObjectContext: false,
        needsMemory: false,
        needsSystemKnowledge: false,
        primaryTarget: "current_object_summary",
      },
      retrievalPlan: {
        readOnly: true,
        writePath: false,
        sources: [],
        deniedSources: [],
        reason: "test",
      },
      answer: {
        summary: "测试摘要",
        explanation: "第一句话。第二句话。第三句话。第四句话。第五句话。",
        confidence: "high",
      },
      nextStep: {
        primary: {
          type: "page_target",
          target: "/test",
          label: "测试",
        },
      },
      grounding: {
        workspaceContext: [],
        memoryUsed: false,
        systemKnowledgeUsed: false,
      },
    };

    const mobile = adaptAskHelmResponseToMobile({ response: desktopResponse });

    expect(mobile.reason).toBe("第一句话。第二句话。");
  });

  it("should include secondary action when available", () => {
    const desktopResponse: AskHelmResponse = {
      classification: {
        intentType: "current_status",
        matchedRule: "test",
        confidence: "high",
        normalizedQuery: "test",
        needsObjectContext: false,
        needsMemory: false,
        needsSystemKnowledge: false,
        primaryTarget: "current_object_summary",
      },
      retrievalPlan: {
        readOnly: true,
        writePath: false,
        sources: [],
        deniedSources: [],
        reason: "test",
      },
      answer: {
        summary: "测试摘要",
        explanation: "测试说明",
        confidence: "high",
      },
      nextStep: {
        primary: {
          type: "page_target",
          target: "/approvals",
          label: "进入复核",
        },
        alternatives: [
          {
            type: "page_target",
            target: "/operating",
            label: "回到 operating",
          },
        ],
      },
      grounding: {
        workspaceContext: [],
        memoryUsed: false,
        systemKnowledgeUsed: false,
      },
    };

    const mobile = adaptAskHelmResponseToMobile({ response: desktopResponse });

    expect(mobile.secondaryAction).toEqual({
      label: "回到 operating",
      href: "/operating",
    });
    expect(mobile.grounding).toEqual({
      objectCount: 0,
      memoryUsed: false,
      systemKnowledgeUsed: false,
      sourceLabels: [],
    });
  });

  it("should include grounding info", () => {
    const desktopResponse: AskHelmResponse = {
      classification: {
        intentType: "current_status",
        matchedRule: "test",
        confidence: "high",
        normalizedQuery: "test",
        needsObjectContext: true,
        needsMemory: true,
        needsSystemKnowledge: false,
        primaryTarget: "current_object_summary",
      },
      retrievalPlan: {
        readOnly: true,
        writePath: false,
        sources: ["memory_summary", "workspace_context"],
        deniedSources: [],
        reason: "test",
      },
      answer: {
        summary: "测试摘要",
        explanation: "测试说明",
        confidence: "high",
      },
      nextStep: {
        primary: {
          type: "page_target",
          target: "/test",
          label: "测试",
        },
      },
      grounding: {
        workspaceContext: ["workspace:demo"],
        memoryUsed: true,
        systemKnowledgeUsed: false,
      },
    };

    const mobile = adaptAskHelmResponseToMobile({ response: desktopResponse });

    expect(mobile.grounding).toEqual({
      objectCount: 0,
      memoryUsed: true,
      systemKnowledgeUsed: false,
      sourceLabels: ["记忆", "工作区"],
    });
  });

  it("should support english labels for grounding", () => {
    const desktopResponse: AskHelmResponse = {
      classification: {
        intentType: "current_status",
        matchedRule: "test",
        confidence: "high",
        normalizedQuery: "test",
        needsObjectContext: false,
        needsMemory: false,
        needsSystemKnowledge: false,
        primaryTarget: "current_object_summary",
      },
      retrievalPlan: {
        readOnly: true,
        writePath: false,
        sources: ["object_search", "knowledge_pack"],
        deniedSources: [],
        reason: "test",
      },
      answer: {
        summary: "Test summary",
        explanation: "Test explanation",
        confidence: "high",
      },
      nextStep: {
        primary: {
          type: "page_target",
          target: "/test",
          label: "Test",
        },
      },
      relatedObjects: {
        objects: [],
        totalCount: 3,
      },
      grounding: {
        workspaceContext: [],
        memoryUsed: false,
        systemKnowledgeUsed: true,
      },
    };

    const mobile = adaptAskHelmResponseToMobile({ response: desktopResponse, english: true });

    expect(mobile.grounding.sourceLabels).toEqual(["Objects", "Knowledge"]);
  });

  it("should preserve boundary note for review-required responses", () => {
    const desktopResponse: AskHelmResponse = {
      classification: {
        intentType: "review_required_execution",
        matchedRule: "test",
        confidence: "high",
        normalizedQuery: "直接发给客户",
        needsObjectContext: true,
        needsMemory: true,
        needsSystemKnowledge: true,
        primaryTarget: "review_required_gate",
      },
      retrievalPlan: {
        readOnly: true,
        writePath: false,
        sources: [],
        deniedSources: ["official_write_path"],
        reason: "test",
      },
      answer: {
        summary: "这个请求需要复核，不能由 Ask Helm 直接执行。",
        explanation: "我可以把上下文整理成复核材料，并把下一步收口到审批或 operating 工作面。",
        confidence: "high",
      },
      nextStep: {
        primary: {
          type: "page_target",
          target: "/approvals",
          label: "打开复核页面",
        },
      },
      boundaryNote: {
        type: "review_required",
        message: "这个请求包含发送、审批、承诺、付款或正式写回意图；Ask Helm 只能准备复核材料并带你进入复核页面，不能直接执行。",
      },
      grounding: {
        workspaceContext: [],
        memoryUsed: false,
        systemKnowledgeUsed: false,
      },
    };

    const mobile = adaptAskHelmResponseToMobile({ response: desktopResponse });

    expect(mobile.boundaryNote).toEqual({
      type: "review_required",
      message: desktopResponse.boundaryNote?.message,
    });
  });

  it("should not add related-object secondary actions for denied or out-of-scope answers", () => {
    const desktopResponse: AskHelmResponse = {
      classification: {
        intentType: "cross_workspace_denied",
        matchedRule: "cross_workspace",
        confidence: "high",
        normalizedQuery: "对比另一个 workspace 的客户",
        needsObjectContext: false,
        needsMemory: false,
        needsSystemKnowledge: true,
        primaryTarget: "deny",
      },
      retrievalPlan: {
        readOnly: true,
        writePath: false,
        sources: ["knowledge_pack"],
        deniedSources: ["cross_workspace_answering"],
        reason: "cross workspace denied",
      },
      answer: {
        summary: "这个问题超出当前 workspace 范围。",
        explanation: "我只能回答当前 workspace 内的问题，不能跨 workspace 检索或对比。",
        confidence: "high",
      },
      relatedObjects: {
        objects: [
          {
            objectType: "opportunity",
            objectId: "opp_1",
            displayName: "Atlas 续约",
            status: "ADVANCING",
            deepLink: "/opportunities?opportunityId=opp_1",
          },
        ],
        totalCount: 1,
      },
      nextStep: {
        primary: {
          type: "page_target",
          target: "/search",
          label: "返回搜索",
        },
      },
      boundaryNote: {
        type: "cross_workspace_denied",
        message: "Ask Helm 只允许当前 workspace 范围内的检索。",
      },
      grounding: {
        workspaceContext: ["workspace:demo"],
        memoryUsed: false,
        systemKnowledgeUsed: true,
      },
    };

    const mobile = adaptAskHelmResponseToMobile({ response: desktopResponse });

    expect(mobile.secondaryAction).toBeUndefined();
    expect(mobile.primaryAction.href).toBe("/search");
    expect(mobile.boundaryNote?.type).toBe("cross_workspace_denied");
  });
});

describe("shouldShowCompactMobileResponse", () => {
  it("should return true for single object search with high confidence", () => {
    const response: AskHelmResponse = {
      classification: {
        intentType: "object_search",
        matchedRule: "test",
        confidence: "high",
        normalizedQuery: "cedar",
        needsObjectContext: false,
        needsMemory: false,
        needsSystemKnowledge: false,
        primaryTarget: "search_results",
      },
      retrievalPlan: {
        readOnly: true,
        writePath: false,
        sources: ["object_search"],
        deniedSources: [],
        reason: "test",
      },
      answer: {
        summary: "找到星河连锁相关机会",
        confidence: "high",
      },
      relatedObjects: {
        objects: [
          {
            objectType: "opportunity",
            objectId: "op-xinghe",
            displayName: "星河连锁恢复试点",
            status: "谈判中",
            deepLink: "/opportunities?id=xinghe",
          },
        ],
        totalCount: 1,
      },
      nextStep: {
        primary: {
          type: "object_target",
          target: "/opportunities?id=xinghe",
          label: "打开机会",
        },
      },
      grounding: {
        workspaceContext: [],
        memoryUsed: false,
        systemKnowledgeUsed: false,
      },
    };

    expect(shouldShowCompactMobileResponse(response)).toBe(true);
  });

  it("should return false for multi-object results", () => {
    const response: AskHelmResponse = {
      classification: {
        intentType: "object_search",
        matchedRule: "test",
        confidence: "high",
        normalizedQuery: "test",
        needsObjectContext: false,
        needsMemory: false,
        needsSystemKnowledge: false,
        primaryTarget: "search_results",
      },
      retrievalPlan: {
        readOnly: true,
        writePath: false,
        sources: ["object_search"],
        deniedSources: [],
        reason: "test",
      },
      answer: {
        summary: "找到多个机会",
        confidence: "high",
      },
      relatedObjects: {
        objects: [],
        totalCount: 5,
      },
      nextStep: {
        primary: {
          type: "page_target",
          target: "/search",
          label: "查看结果",
        },
      },
      grounding: {
        workspaceContext: [],
        memoryUsed: false,
        systemKnowledgeUsed: false,
      },
    };

    expect(shouldShowCompactMobileResponse(response)).toBe(false);
  });
});

describe("getMobileGroundingSummary", () => {
  it("should summarize grounding with objects and memory", () => {
    const response: AskHelmResponse = {
      classification: {
        intentType: "current_status",
        matchedRule: "test",
        confidence: "high",
        normalizedQuery: "test",
        needsObjectContext: false,
        needsMemory: false,
        needsSystemKnowledge: false,
        primaryTarget: "current_object_summary",
      },
      retrievalPlan: {
        readOnly: true,
        writePath: false,
        sources: ["memory_summary"],
        deniedSources: [],
        reason: "test",
      },
      answer: {
        summary: "测试",
        confidence: "high",
      },
      relatedObjects: {
        objects: [],
        totalCount: 3,
      },
      nextStep: {
        primary: {
          type: "page_target",
          target: "/test",
          label: "测试",
        },
      },
      grounding: {
        workspaceContext: [],
        memoryUsed: true,
        systemKnowledgeUsed: false,
      },
    };

    expect(getMobileGroundingSummary(response)).toBe("3 对象 · 记忆");
  });

  it("should return workspace context when no grounding info", () => {
    const response: AskHelmResponse = {
      classification: {
        intentType: "how_to_use",
        matchedRule: "test",
        confidence: "high",
        normalizedQuery: "test",
        needsObjectContext: false,
        needsMemory: false,
        needsSystemKnowledge: true,
        primaryTarget: "system_help",
      },
      retrievalPlan: {
        readOnly: true,
        writePath: false,
        sources: ["knowledge_pack"],
        deniedSources: [],
        reason: "test",
      },
      answer: {
        summary: "系统帮助",
        confidence: "high",
      },
      nextStep: {
        primary: {
          type: "page_target",
          target: "/search",
          label: "进入搜索",
        },
      },
      grounding: {
        workspaceContext: ["workspace:demo"],
        memoryUsed: false,
        systemKnowledgeUsed: true,
      },
    };

    expect(getMobileGroundingSummary(response)).toBe("系统知识");
  });
});

describe("isCapabilitySensitiveIntent", () => {
  it("should return true for execution-related intents", () => {
    expect(isCapabilitySensitiveIntent("review_required_execution")).toBe(true);
    expect(isCapabilitySensitiveIntent("prepare_draft")).toBe(true);
    expect(isCapabilitySensitiveIntent("prepare_review_packet")).toBe(true);
    expect(isCapabilitySensitiveIntent("queue_internal_followup")).toBe(true);
  });

  it("should return false for non-sensitive intents", () => {
    expect(isCapabilitySensitiveIntent("object_search")).toBe(false);
    expect(isCapabilitySensitiveIntent("how_to_use")).toBe(false);
    expect(isCapabilitySensitiveIntent("current_status")).toBe(false);
  });
});

describe("requiresTranscriptConfirmation", () => {
  it("should return true for execution intents with voice input", () => {
    const response: AskHelmResponse = {
      classification: {
        intentType: "review_required_execution",
        matchedRule: "test",
        confidence: "high",
        normalizedQuery: "直接发给客户",
        needsObjectContext: false,
        needsMemory: false,
        needsSystemKnowledge: false,
        primaryTarget: "review_required_gate",
      },
      retrievalPlan: {
        readOnly: true,
        writePath: false,
        sources: [],
        deniedSources: ["official_write_path"],
        reason: "test",
      },
      answer: {
        summary: "测试",
        confidence: "high",
      },
      nextStep: {
        primary: {
          type: "page_target",
          target: "/approvals",
          label: "测试",
        },
      },
      grounding: {
        workspaceContext: [],
        memoryUsed: false,
        systemKnowledgeUsed: false,
      },
    };

    expect(requiresTranscriptConfirmation(response)).toBe(true);
  });

  it("should return false for non-execution intents", () => {
    const response: AskHelmResponse = {
      classification: {
        intentType: "object_search",
        matchedRule: "test",
        confidence: "high",
        normalizedQuery: "cedar",
        needsObjectContext: false,
        needsMemory: false,
        needsSystemKnowledge: false,
        primaryTarget: "search_results",
      },
      retrievalPlan: {
        readOnly: true,
        writePath: false,
        sources: ["object_search"],
        deniedSources: [],
        reason: "test",
      },
      answer: {
        summary: "测试",
        confidence: "high",
      },
      nextStep: {
        primary: {
          type: "page_target",
          target: "/test",
          label: "测试",
        },
      },
      grounding: {
        workspaceContext: [],
        memoryUsed: false,
        systemKnowledgeUsed: false,
      },
    };

    expect(requiresTranscriptConfirmation(response)).toBe(false);
  });
});

import type {
  HelmV2AgentId,
  HelmV2ApprovalTier,
  HelmV2Artifact,
  HelmV2ArtifactId,
  HelmV2EventType,
  HelmV2ExecutionBundle,
  HelmV2ObjectRefs,
} from "@/lib/helm-v2/contracts";

export type HelmV2WorkerDefinition = {
  id: HelmV2AgentId;
  label: string;
  description: string;
  triggers: HelmV2EventType[];
  allowedTools: string[];
  inputSchema: string;
  outputArtifacts: HelmV2ArtifactId[];
  approvalTier: HelmV2ApprovalTier;
  writesOfficialSystemOfRecord: boolean;
};

export const HELM_V2_WORKER_REGISTRY: Record<HelmV2AgentId, HelmV2WorkerDefinition> = {
  "lead-orchestrator": {
    id: "lead-orchestrator",
    label: "Lead Orchestrator",
    description: "接收事件、拉取最小必要上下文、分配执行并汇总执行套件。",
    triggers: ["meeting.ended", "proposal.requested" as HelmV2EventType, "handoff.requested"],
    allowedTools: ["read_workspace_summary", "read_object_graph", "dispatch_worker", "write_execution_bundle"],
    inputSchema: "lead_orchestrator_input.v1",
    outputArtifacts: ["action_pack.md", "next_step_brief.md"],
    approvalTier: "A1",
    writesOfficialSystemOfRecord: false,
  },
  "meeting-analyst": {
    id: "meeting-analyst",
    label: "Meeting Analyst",
    description: "把会议转成结构化经营事实、风险和下一步动作。",
    triggers: ["meeting.ended"],
    allowedTools: ["read_transcript", "read_calendar", "read_workspace_summary", "write_artifact", "write_memory_draft"],
    inputSchema: "meeting_input.v1",
    outputArtifacts: ["meeting_facts.json", "risk_flags.json", "action_pack.md"],
    approvalTier: "A0",
    writesOfficialSystemOfRecord: false,
  },
  "opportunity-judge": {
    id: "opportunity-judge",
    label: "Opportunity Judge",
    description: "更新机会阴影状态、提出下一步建议并标记管理者注意事项。",
    triggers: ["meeting.facts_created", "followup.requested"],
    allowedTools: ["read_crm_snapshot", "read_meeting_facts", "read_timeline", "write_shadow_state", "write_artifact"],
    inputSchema: "opportunity_judge_input.v1",
    outputArtifacts: ["opportunity_delta.json", "next_step_brief.md", "manager_attention_flags.json"],
    approvalTier: "A1",
    writesOfficialSystemOfRecord: false,
  },
  "proposal-composer": {
    id: "proposal-composer",
    label: "Proposal Composer",
    description: "产出面向客户、内部协同和管理层的多视角表达物。",
    triggers: ["followup.requested", "draft.created"],
    allowedTools: ["read_object_summary", "read_knowledge_base", "read_policy_memory", "write_artifact"],
    inputSchema: "proposal_composer_input.v1",
    outputArtifacts: ["customer_followup_draft.md", "internal_collab_brief.md", "exec_brief.md"],
    approvalTier: "A2",
    writesOfficialSystemOfRecord: false,
  },
  "comms-scheduler": {
    id: "comms-scheduler",
    label: "Comms & Scheduler",
    description: "起草邮件、消息和日程建议，但不允许发送。",
    triggers: ["draft.created", "approval.resolved"],
    allowedTools: ["read_email_threads", "read_calendar", "write_draft", "write_artifact"],
    inputSchema: "comms_scheduler_input.v1",
    outputArtifacts: ["email_draft.eml", "calendar_options.json", "message_variants.md"],
    approvalTier: "A2",
    writesOfficialSystemOfRecord: false,
  },
  "risk-promise-guard": {
    id: "risk-promise-guard",
    label: "Risk & Promise Guard",
    description: "在 A2 以上动作前检查承诺边界、隐私风险、价格风险和来源可信度。",
    triggers: ["approval.requested"],
    allowedTools: ["read_policy_memory", "read_source_provenance", "read_artifact", "write_artifact"],
    inputSchema: "risk_promise_guard_input.v1",
    outputArtifacts: ["risk_review.json", "approval_requirements.json", "sanitized_artifact.md"],
    approvalTier: "A2",
    writesOfficialSystemOfRecord: false,
  },
  "handoff-manager": {
    id: "handoff-manager",
    label: "Handoff Manager",
    description: "把销售上下文稳定交给交付或 CS，并沉淀交接经营记忆。",
    triggers: ["handoff.requested"],
    allowedTools: ["read_object_graph", "read_proposal_context", "read_policy_memory", "write_artifact", "write_handoff_memory"],
    inputSchema: "handoff_manager_input.v1",
    outputArtifacts: ["handoff_pack.md", "delivery_risk_checklist.json", "first_14_day_plan.md"],
    approvalTier: "A2",
    writesOfficialSystemOfRecord: false,
  },
  "verification-agent": {
    id: "verification-agent",
    label: "Verification Agent",
    description: "在晋升、问题空间和下游建议前生成基于来源的验证报告。",
    triggers: ["meeting.facts_created", "approval.requested", "followup.requested"],
    allowedTools: ["read_artifact", "read_source_provenance", "read_policy_memory", "write_artifact", "write_trace"],
    inputSchema: "verification_agent_input.v1",
    outputArtifacts: ["risk_review.json", "approval_requirements.json", "sanitized_artifact.md"],
    approvalTier: "A2",
    writesOfficialSystemOfRecord: false,
  },
  "swarm-search-worker": {
    id: "swarm-search-worker",
    label: "Swarm Search Worker",
    description: "执行只读搜索，返回命中列表与制品优先的发现套件，不合并长对话记录。",
    triggers: [],
    allowedTools: ["read_artifact", "read_workspace_summary", "write_artifact"],
    inputSchema: "swarm_search_worker_input.v1",
    outputArtifacts: ["search_hits.json", "worker_findings_bundle.json", "worker_handoff_note.md"],
    approvalTier: "A1",
    writesOfficialSystemOfRecord: false,
  },
  "swarm-grep-worker": {
    id: "swarm-grep-worker",
    label: "Swarm Grep Worker",
    description: "执行只读 grep 风格证据检索，返回结构化命中和发现套件。",
    triggers: [],
    allowedTools: ["read_artifact", "read_workspace_summary", "write_artifact"],
    inputSchema: "swarm_grep_worker_input.v1",
    outputArtifacts: ["grep_hits.json", "worker_findings_bundle.json", "worker_handoff_note.md"],
    approvalTier: "A1",
    writesOfficialSystemOfRecord: false,
  },
  "swarm-evidence-miner": {
    id: "swarm-evidence-miner",
    label: "Swarm Evidence Miner",
    description: "执行只读证据挖掘，返回证据候选与发现套件。",
    triggers: [],
    allowedTools: ["read_artifact", "read_workspace_summary", "write_artifact"],
    inputSchema: "swarm_evidence_miner_input.v1",
    outputArtifacts: [
      "evidence_candidates.json",
      "worker_findings_bundle.json",
      "worker_handoff_note.md",
    ],
    approvalTier: "A1",
    writesOfficialSystemOfRecord: false,
  },
};

export function buildExecutionBundle(input: {
  bundleId: string;
  workspaceId: string;
  primaryEventType: HelmV2EventType;
  objectRefs: HelmV2ObjectRefs;
  workerIds: HelmV2AgentId[];
  artifacts: HelmV2Artifact[];
  evidenceRefs: string[];
  confidence: number;
  openQuestions: string[];
  recommendedNextAction: string;
  approvalTier: HelmV2ApprovalTier;
}): HelmV2ExecutionBundle {
  return { ...input };
}

export function getWorkerArtifacts(workerIds: HelmV2AgentId[]) {
  return workerIds.flatMap((workerId) => HELM_V2_WORKER_REGISTRY[workerId].outputArtifacts);
}

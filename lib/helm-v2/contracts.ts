export type HelmV2MemoryKind =
  | "policy"
  | "object_fact"
  | "learned_pattern"
  | "handoff"
  | "checkpoint"
  | "scratch";

export type HelmV2MemoryScope =
  | "org"
  | "workspace"
  | "object"
  | "role"
  | "session";

export type HelmV2MemoryNamespace =
  | "workspace"
  | "customer"
  | "opportunity"
  | "meeting"
  | "proposal"
  | "quote"
  | "approval"
  | "task"
  | "handoff";

export type HelmV2MemoryVerification =
  | "draft"
  | "inferred"
  | "human_confirmed"
  | "system_of_record"
  | "deprecated";

export type HelmV2MemorySensitivity =
  | "public"
  | "internal"
  | "confidential"
  | "restricted";

export type HelmV2MemoryRetention =
  | "session"
  | "30d"
  | "90d"
  | "permanent"
  | "until_verified";

export type HelmV2MemoryPromotionRule =
  | "none"
  | "human_confirmed"
  | "repeated_3_times"
  | "system_of_record";

export type HelmV2SourceType =
  | "crm"
  | "meeting"
  | "email"
  | "calendar"
  | "document"
  | "human_edit"
  | "agent_inference"
  | "web_content"
  | "external_attachment"
  | "meeting_transcript"
  | "meeting_note"
  | "calendar_event"
  | "crm_snapshot"
  | "crm_delta"
  | "email_thread"
  | "document_attachment";

export type HelmV2TrustClass = "TRUSTED" | "UNTRUSTED";

export type HelmV2IngestionScope = "org" | "workspace" | "object" | "session";

export type HelmV2IngestionTrustLevel = "trusted" | "untrusted";

export type HelmV2IngestionNormalizationStatus =
  | "raw"
  | "normalized"
  | "fact_ready"
  | "draft_layered";

export type HelmV2IngestionPromotionEligibility =
  | "draft_only"
  | "human_confirmed"
  | "system_of_record"
  | "not_eligible"
  | "repeated_pattern_candidate";

export type HelmV2TrustPromotionStatus =
  | "trusted"
  | "untrusted"
  | "draft_only"
  | "human_confirmed"
  | "system_of_record"
  | "deprecated";

export type HelmV2RetrievalPolicyMode =
  | "always_on"
  | "stage_triggered"
  | "event_triggered"
  | "on_demand";

export type HelmV2RetrievalBucket =
  | "policy_memory"
  | "object_memory"
  | "learned_memory"
  | "handoff_checkpoint_memory"
  | "session_scratch";

export type HelmV2Writer =
  | "human"
  | "helm-core"
  | "meeting-analyst"
  | "opportunity-judge"
  | "proposal-composer"
  | "comms-scheduler"
  | "risk-promise-guard"
  | "handoff-manager";

export type HelmV2ObjectRefs = {
  workspaceId: string;
  customerId?: string | null;
  opportunityId?: string | null;
  meetingId?: string | null;
  proposalId?: string | null;
  quoteId?: string | null;
  approvalId?: string | null;
  taskId?: string | null;
  handoffId?: string | null;
};

export type HelmV2MemorySourceRef = {
  type: HelmV2SourceType;
  id: string;
  span?: string | null;
};

export type HelmV2ConnectorIngestionContract = {
  ingestionSourceType: HelmV2SourceType;
  ingestionSourceId: string;
  ingestionScope: HelmV2IngestionScope;
  ingestionTrustLevel: HelmV2IngestionTrustLevel;
  ingestionSensitivity: HelmV2MemorySensitivity;
  ingestionNormalizationStatus: HelmV2IngestionNormalizationStatus;
  ingestionPromotionEligibility: HelmV2IngestionPromotionEligibility;
  ingestionObjectRefs: HelmV2ObjectRefs;
  ingestionEvidenceRef: string;
  ingestionExtractedFacts: string[];
  ingestionDraftPayload: Record<string, unknown>;
  ingestionBoundaryNote: string;
  ingestionSummary: string;
};

export type HelmV2RetrievalLoadRef = {
  key: string;
  label: string;
  reason: string;
  loaded: boolean;
  sourceType?: HelmV2SourceType | "memory_item" | "policy" | "summary";
  trustPromotionStatus?: HelmV2TrustPromotionStatus;
};

export type HelmV2RetrievalTraceContract = {
  mode: HelmV2RetrievalPolicyMode;
  bucket: HelmV2RetrievalBucket;
  triggerKey: string;
  runtimeLabel: string;
  rationale: string;
  loadedRefs: HelmV2RetrievalLoadRef[];
  skippedRefs: HelmV2RetrievalLoadRef[];
  evidenceRefs: string[];
  sourceProvenance: Array<Record<string, unknown>>;
};

export type HelmV2MemoryItem<TPayload = Record<string, unknown>> = {
  memoryId: string;
  kind: HelmV2MemoryKind;
  scope: HelmV2MemoryScope;
  namespace: HelmV2MemoryNamespace;
  objectRefs: HelmV2ObjectRefs;
  sourceRefs: HelmV2MemorySourceRef[];
  writer: HelmV2Writer;
  verification: HelmV2MemoryVerification;
  confidence: number;
  sensitivity: HelmV2MemorySensitivity;
  retention: HelmV2MemoryRetention;
  promotionRule: HelmV2MemoryPromotionRule;
  supersedes?: string | null;
  lastValidatedAt?: string | null;
  payload: TPayload;
};

export type HelmV2ArtifactId =
  | "meeting_facts.json"
  | "risk_flags.json"
  | "action_pack.md"
  | "search_hits.json"
  | "grep_hits.json"
  | "evidence_candidates.json"
  | "worker_findings_bundle.json"
  | "worker_handoff_note.md"
  | "draft_comms_bundle.json"
  | "opportunity_judgement_bundle.json"
  | "opportunity_delta.json"
  | "next_step_brief.md"
  | "manager_attention_flags.json"
  | "customer_followup_draft.md"
  | "internal_collab_brief.md"
  | "exec_brief.md"
  | "email_draft.eml"
  | "calendar_options.json"
  | "message_variants.md"
  | "risk_review.json"
  | "approval_requirements.json"
  | "sanitized_artifact.md"
  | "handoff_pack.md"
  | "delivery_risk_checklist.json"
  | "first_14_day_plan.md"
  | "human_action_execution_bundle.json"
  | "official_write_intent.json"
  | "limited_auto_intent.json";

export type HelmV2ApprovalTier = "A0" | "A1" | "A2" | "A3" | "A4";

export type HelmV2AgentId =
  | "lead-orchestrator"
  | "meeting-analyst"
  | "opportunity-judge"
  | "proposal-composer"
  | "comms-scheduler"
  | "risk-promise-guard"
  | "handoff-manager"
  | "verification-agent"
  | "swarm-search-worker"
  | "swarm-grep-worker"
  | "swarm-evidence-miner";

export type HelmV21RuntimeSessionState =
  | "active"
  | "awaiting_worker"
  | "awaiting_review"
  | "awaiting_approval"
  | "compacting"
  | "checkpointed"
  | "blocked"
  | "completed"
  | "failed"
  | "aborted";

export type HelmV21RuntimeCheckpointState = "ready" | "resumed" | "stale";

export type HelmV21RunThreadLifecycleState = "live" | "checkpoint_ready" | "resumed" | "closed";

export type HelmV21RunThreadResumeState = "not_available" | "ready" | "resumed";

export type HelmV21RunThreadCheckpointLineageRole = "latest" | "resume_anchor" | "historical";

export type HelmV21RunThreadCheckpoint = {
  checkpointId: string;
  checkpointKey: string;
  label: string;
  summary: string;
  state: HelmV21RuntimeCheckpointState;
  resumeToken: string;
  createdAt: Date;
  updatedAt: Date;
};

export type HelmV21RunThreadCheckpointLineageEntry = HelmV21RunThreadCheckpoint & {
  lineageRole: HelmV21RunThreadCheckpointLineageRole;
};

export type HelmV21RunThreadReplayRequestMode = "none" | "latest_checkpoint" | "resume_anchor";

export type HelmV21RunThreadReplayRequest = {
  mode: HelmV21RunThreadReplayRequestMode;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  replaySummary: string;
};

export type HelmV21RunThreadHumanInputCheckpointState = "not_available" | "checkpoint_ready";

export type HelmV21RunThreadHumanInputCheckpoint = {
  state: HelmV21RunThreadHumanInputCheckpointState;
  checkpointId: string | null;
  checkpointKey: string | null;
  summary: string;
  boundaryNote: string;
};

export type HelmV21RunThreadSwarmSpawnTaskClass = "read_only_worker";

export type HelmV21RunThreadSwarmWorkspaceFlagState = "enabled" | "disabled";

export type HelmV21RunThreadSwarmBudgetEnvelopeState = "within_headroom" | "blocked_budget";

export type HelmV21RunThreadSwarmSpawnRequestState =
  | "requestable"
  | "blocked_flag"
  | "blocked_budget"
  | "blocked_policy";

export type HelmV21RunThreadSwarmSpawnDenyReason =
  | "workspace_flag_disabled"
  | "budget_posture_prune"
  | "budget_posture_compact"
  | "run_thread_closed";

export type HelmV21RunThreadSwarmSpawnRequestRecordState = "not_requested" | "requested";

export type HelmV21RunThreadSwarmSpawnBudgetEnvelope = {
  state: HelmV21RunThreadSwarmBudgetEnvelopeState;
  taskClass: HelmV21RunThreadSwarmSpawnTaskClass;
  budgetPosture: "SAFE" | "WATCH" | "PRUNE" | "COMPACT";
  budgetTokenLimit: number;
  budgetTokenUsed: number;
  usagePercent: number;
  prunedTokenCount: number;
  summary: string;
  boundaryNote: string;
};

export type HelmV21RunThreadSwarmSpawnRequest = {
  state: HelmV21RunThreadSwarmSpawnRequestState;
  requestRecordState: HelmV21RunThreadSwarmSpawnRequestRecordState;
  requestEventId: string | null;
  taskClass: HelmV21RunThreadSwarmSpawnTaskClass;
  checkpointId: string | null;
  checkpointKey: string | null;
  requestedAt: Date | null;
  requestedBy: string | null;
  sourcePage: string | null;
  workspaceFlagState: HelmV21RunThreadSwarmWorkspaceFlagState;
  lifecycleState: HelmV21RunThreadLifecycleState;
  budgetEnvelopeState: HelmV21RunThreadSwarmBudgetEnvelopeState;
  denyReason: HelmV21RunThreadSwarmSpawnDenyReason | null;
  denySummary: string | null;
  summary: string;
  nextAction: string | null;
  boundaryNote: string;
};

export type HelmV21RunThreadSwarmSpawnContract = {
  state: HelmV21RunThreadSwarmSpawnRequestState;
  requestRecordState: HelmV21RunThreadSwarmSpawnRequestRecordState;
  requestEventId: string | null;
  taskClass: HelmV21RunThreadSwarmSpawnTaskClass;
  checkpointId: string | null;
  checkpointKey: string | null;
  requestedAt: Date | null;
  requestedBy: string | null;
  sourcePage: string | null;
  workspaceFlagState: HelmV21RunThreadSwarmWorkspaceFlagState;
  lifecycleState: HelmV21RunThreadLifecycleState;
  budgetPosture: "SAFE" | "WATCH" | "PRUNE" | "COMPACT";
  budgetEnvelopeState: HelmV21RunThreadSwarmBudgetEnvelopeState;
  requestState: HelmV21RunThreadSwarmSpawnRequestState;
  denyReason: HelmV21RunThreadSwarmSpawnDenyReason | null;
  denySummary: string | null;
  summary: string;
  nextAction: string | null;
  boundaryNote: string;
};

export type HelmV21RunThreadSwarmReadOnlyWorkerKind =
  | "search"
  | "grep"
  | "evidence_mining";

export type HelmV21RunThreadSwarmReadOnlyWorkerContractState =
  | "blocked"
  | "ready"
  | "requested";

export type HelmV21RunThreadSwarmReadOnlyWorkerRequestLifecycleState =
  | "blocked"
  | "requestable"
  | "request_recorded";

export type HelmV21RunThreadSwarmReadOnlyWorkerHandoffPreviewState =
  | "not_ready"
  | "preview_ready"
  | "request_recorded";

export type HelmV21RunThreadSwarmReadOnlyWorkerPacketConsumptionIntentState =
  | "not_ready"
  | "selection_required"
  | "intent_recorded";

export type HelmV21RunThreadSwarmReadOnlyWorkerArtifactBundlePlaceholderState =
  | "not_ready"
  | "selection_required"
  | "placeholder_ready";

export type HelmV21RunThreadSwarmReadOnlyWorkerHandoffConsumptionState =
  | "not_ready"
  | "selection_required"
  | "consumable";

export type HelmV21RunThreadSwarmReadOnlyWorkerRecordState =
  | "not_ready"
  | "recordable"
  | "recorded";

export type HelmV21RunThreadSwarmReadOnlyWorkerExecutionPreflightState =
  | "blocked"
  | "request_required"
  | "selection_required"
  | "placeholder_record_required"
  | "ready";

export type HelmV21RunThreadSwarmReadOnlyWorkerExecutionGuardMove = "execute_selected_lane";

export type HelmV21RunThreadSwarmReadOnlyWorkerExecutionGuardState =
  | "allowed"
  | "reused"
  | "blocked";

export type HelmV21RunThreadSwarmReadOnlyWorkerExecutionLifecycleState =
  | "blocked"
  | "request_required"
  | "selection_required"
  | "placeholder_record_required"
  | "recordable"
  | "recorded";

export type HelmV21RunThreadSwarmReadOnlyWorkerExecutionLifecycleDriver =
  | "admission_blocked"
  | "request_required"
  | "selection_required"
  | "placeholder_record_required"
  | "recordable"
  | "recorded";

export type HelmV21RunThreadSwarmReadOnlyWorkerExecutionCandidateState =
  | "not_ready"
  | "candidate_ready";

export type HelmV21RunThreadSwarmReadOnlyWorkerExecutionCandidateDriver =
  | "execution_not_recorded"
  | "execution_recorded";

export type HelmV21RunThreadSwarmReadOnlyWorkerArtifactMaterializationState =
  | "not_ready"
  | "intent_ready";

export type HelmV21RunThreadSwarmReadOnlyWorkerArtifactMaterializationGuardMove =
  "materialize_artifact_bundle";

export type HelmV21RunThreadSwarmReadOnlyWorkerArtifactMaterializationGuardState =
  | "allowed"
  | "blocked";

export type HelmV21RunThreadSwarmReadOnlyWorkerArtifactMaterializationLifecycleState =
  | "blocked"
  | "recordable"
  | "recorded";

export type HelmV21RunThreadSwarmReadOnlyWorkerArtifactMaterializationLifecycleDriver =
  | "guard_blocked"
  | "recordable"
  | "recorded";

export type HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputState =
  | "not_ready"
  | "output_ready";

export type HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputDriver =
  | "materialization_not_recorded"
  | "materialization_recorded";

export type HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputGuardMove =
  "consume_result_side_output";

export type HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputGuardState =
  | "allowed"
  | "blocked";

export type HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputLifecycleState =
  | "blocked"
  | "consumable";

export type HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputLifecycleDriver =
  | "guard_blocked"
  | "consumable";

export type HelmV21RunThreadSwarmReadOnlyWorkerOutputConsumptionState =
  | "not_ready"
  | "consumable";

export type HelmV21RunThreadSwarmReadOnlyWorkerOutputConsumptionDriver =
  | "output_not_consumable"
  | "output_consumable";

export type HelmV21RunThreadSwarmReadOnlyWorkerResultAdoptionState =
  | "not_ready"
  | "adoption_ready";

export type HelmV21RunThreadSwarmReadOnlyWorkerResultAdoptionDriver =
  | "consumption_not_ready"
  | "consumption_ready";

export type HelmV21RunThreadSwarmReadOnlyWorkerOutputAdoptionGuardMove =
  "adopt_result_side_output";

export type HelmV21RunThreadSwarmReadOnlyWorkerOutputAdoptionGuardState =
  | "allowed"
  | "blocked";

export type HelmV21RunThreadSwarmReadOnlyWorkerOutputAdoptionLifecycleState =
  | "blocked"
  | "recordable"
  | "recorded";

export type HelmV21RunThreadSwarmReadOnlyWorkerOutputAdoptionLifecycleDriver =
  | "guard_blocked"
  | "recordable"
  | "recorded";

export type HelmV21RunThreadSwarmReadOnlyWorkerResultAdoptionResultSideState =
  | "not_ready"
  | "output_ready";

export type HelmV21RunThreadSwarmReadOnlyWorkerResultAdoptionResultSideDriver =
  | "adoption_not_recorded"
  | "adoption_recorded";

export type HelmV21RunThreadSwarmReadOnlyWorkerExecutionGuardContract = {
  move: HelmV21RunThreadSwarmReadOnlyWorkerExecutionGuardMove;
  state: HelmV21RunThreadSwarmReadOnlyWorkerExecutionGuardState;
  executionPreflightState: HelmV21RunThreadSwarmReadOnlyWorkerExecutionPreflightState;
  requestEventId: string | null;
  checkpointKey: string | null;
  selectedWorkerKind: HelmV21RunThreadSwarmReadOnlyWorkerKind | null;
  selectedPacketKey: string | null;
  selectedArtifactTypes: string[];
  intentEventId: string | null;
  placeholderBundleKey: string | null;
  placeholderRecordEventId: string | null;
  handoffConsumerAgent: HelmV2AgentId | null;
  handoffConsumptionGoal: string | null;
  missingRequirements: string[];
  summary: string;
  reason: string;
  nextAction: string | null;
  boundaryNote: string;
};

export type HelmV21RunThreadSwarmReadOnlyWorkerExecutionLifecycleContract = {
  state: HelmV21RunThreadSwarmReadOnlyWorkerExecutionLifecycleState;
  driver: HelmV21RunThreadSwarmReadOnlyWorkerExecutionLifecycleDriver;
  requestEventId: string | null;
  checkpointKey: string | null;
  intentEventId: string | null;
  placeholderRecordEventId: string | null;
  executionEventId: string | null;
  selectedWorkerKind: HelmV21RunThreadSwarmReadOnlyWorkerKind | null;
  selectedPacketKey: string | null;
  placeholderBundleKey: string | null;
  executionPreflightState: HelmV21RunThreadSwarmReadOnlyWorkerExecutionPreflightState;
  executionGuardState: HelmV21RunThreadSwarmReadOnlyWorkerExecutionGuardState;
  summary: string;
  nextAction: string | null;
  boundaryNote: string;
};

export type HelmV21RunThreadSwarmReadOnlyWorkerExecutionCandidateContract = {
  state: HelmV21RunThreadSwarmReadOnlyWorkerExecutionCandidateState;
  driver: HelmV21RunThreadSwarmReadOnlyWorkerExecutionCandidateDriver;
  artifactMaterializationState: HelmV21RunThreadSwarmReadOnlyWorkerArtifactMaterializationState;
  executionEventId: string | null;
  checkpointKey: string | null;
  selectedWorkerKind: HelmV21RunThreadSwarmReadOnlyWorkerKind | null;
  selectedPacketKey: string | null;
  materializationBundleKey: string | null;
  materializationBundleTitle: string | null;
  materializationArtifactTypes: string[];
  handoffConsumerAgent: HelmV2AgentId | null;
  handoffConsumptionGoal: string | null;
  summary: string;
  nextAction: string | null;
  boundaryNote: string;
};

export type HelmV21RunThreadSwarmReadOnlyWorkerArtifactMaterializationGuardContract = {
  move: HelmV21RunThreadSwarmReadOnlyWorkerArtifactMaterializationGuardMove;
  state: HelmV21RunThreadSwarmReadOnlyWorkerArtifactMaterializationGuardState;
  executionCandidateState: HelmV21RunThreadSwarmReadOnlyWorkerExecutionCandidateState;
  artifactMaterializationState: HelmV21RunThreadSwarmReadOnlyWorkerArtifactMaterializationState;
  executionEventId: string | null;
  checkpointKey: string | null;
  selectedWorkerKind: HelmV21RunThreadSwarmReadOnlyWorkerKind | null;
  selectedPacketKey: string | null;
  materializationBundleKey: string | null;
  materializationBundleTitle: string | null;
  materializationArtifactTypes: string[];
  handoffConsumerAgent: HelmV2AgentId | null;
  handoffConsumptionGoal: string | null;
  missingRequirements: string[];
  summary: string;
  reason: string;
  nextAction: string | null;
  boundaryNote: string;
};

export type HelmV21RunThreadSwarmReadOnlyWorkerArtifactMaterializationLifecycleContract = {
  state: HelmV21RunThreadSwarmReadOnlyWorkerArtifactMaterializationLifecycleState;
  driver: HelmV21RunThreadSwarmReadOnlyWorkerArtifactMaterializationLifecycleDriver;
  executionEventId: string | null;
  materializationEventId: string | null;
  checkpointKey: string | null;
  selectedWorkerKind: HelmV21RunThreadSwarmReadOnlyWorkerKind | null;
  selectedPacketKey: string | null;
  materializationBundleKey: string | null;
  materializationBundleTitle: string | null;
  materializationArtifactTypes: string[];
  artifactMaterializationGuardState: HelmV21RunThreadSwarmReadOnlyWorkerArtifactMaterializationGuardState;
  executionCandidateState: HelmV21RunThreadSwarmReadOnlyWorkerExecutionCandidateState;
  artifactMaterializationState: HelmV21RunThreadSwarmReadOnlyWorkerArtifactMaterializationState;
  summary: string;
  nextAction: string | null;
  boundaryNote: string;
};

export type HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputContract = {
  state: HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputState;
  driver: HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputDriver;
  executionEventId: string | null;
  materializationEventId: string | null;
  checkpointKey: string | null;
  selectedWorkerKind: HelmV21RunThreadSwarmReadOnlyWorkerKind | null;
  selectedPacketKey: string | null;
  outputBundleKey: string | null;
  outputBundleTitle: string | null;
  outputArtifactTypes: string[];
  handoffConsumerAgent: HelmV2AgentId | null;
  handoffConsumptionGoal: string | null;
  artifactMaterializationLifecycleState: HelmV21RunThreadSwarmReadOnlyWorkerArtifactMaterializationLifecycleState;
  summary: string;
  nextAction: string | null;
  boundaryNote: string;
};

export type HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputGuardContract = {
  move: HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputGuardMove;
  state: HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputGuardState;
  resultSideOutputState: HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputState;
  executionEventId: string | null;
  materializationEventId: string | null;
  checkpointKey: string | null;
  selectedWorkerKind: HelmV21RunThreadSwarmReadOnlyWorkerKind | null;
  selectedPacketKey: string | null;
  outputBundleKey: string | null;
  outputBundleTitle: string | null;
  outputArtifactTypes: string[];
  handoffConsumerAgent: HelmV2AgentId | null;
  handoffConsumptionGoal: string | null;
  missingRequirements: string[];
  summary: string;
  reason: string;
  nextAction: string | null;
  boundaryNote: string;
};

export type HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputLifecycleContract = {
  state: HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputLifecycleState;
  driver: HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputLifecycleDriver;
  executionEventId: string | null;
  materializationEventId: string | null;
  checkpointKey: string | null;
  selectedWorkerKind: HelmV21RunThreadSwarmReadOnlyWorkerKind | null;
  selectedPacketKey: string | null;
  outputBundleKey: string | null;
  outputBundleTitle: string | null;
  outputArtifactTypes: string[];
  handoffConsumerAgent: HelmV2AgentId | null;
  handoffConsumptionGoal: string | null;
  resultSideOutputState: HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputState;
  resultSideOutputGuardState: HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputGuardState;
  summary: string;
  nextAction: string | null;
  boundaryNote: string;
};

export type HelmV21RunThreadSwarmReadOnlyWorkerOutputConsumptionContract = {
  state: HelmV21RunThreadSwarmReadOnlyWorkerOutputConsumptionState;
  driver: HelmV21RunThreadSwarmReadOnlyWorkerOutputConsumptionDriver;
  executionEventId: string | null;
  materializationEventId: string | null;
  checkpointKey: string | null;
  selectedWorkerKind: HelmV21RunThreadSwarmReadOnlyWorkerKind | null;
  selectedPacketKey: string | null;
  outputBundleKey: string | null;
  outputBundleTitle: string | null;
  outputArtifactTypes: string[];
  handoffConsumerAgent: HelmV2AgentId | null;
  handoffConsumptionGoal: string | null;
  resultSideOutputState: HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputState;
  resultSideOutputGuardState: HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputGuardState;
  resultSideOutputLifecycleState: HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputLifecycleState;
  summary: string;
  nextAction: string | null;
  boundaryNote: string;
};

export type HelmV21RunThreadSwarmReadOnlyWorkerResultAdoptionContract = {
  state: HelmV21RunThreadSwarmReadOnlyWorkerResultAdoptionState;
  driver: HelmV21RunThreadSwarmReadOnlyWorkerResultAdoptionDriver;
  executionEventId: string | null;
  materializationEventId: string | null;
  checkpointKey: string | null;
  selectedWorkerKind: HelmV21RunThreadSwarmReadOnlyWorkerKind | null;
  selectedPacketKey: string | null;
  outputBundleKey: string | null;
  outputBundleTitle: string | null;
  outputArtifactTypes: string[];
  handoffConsumerAgent: HelmV2AgentId | null;
  handoffConsumptionGoal: string | null;
  outputConsumptionState: HelmV21RunThreadSwarmReadOnlyWorkerOutputConsumptionState;
  resultSideOutputLifecycleState: HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputLifecycleState;
  summary: string;
  nextAction: string | null;
  boundaryNote: string;
};

export type HelmV21RunThreadSwarmReadOnlyWorkerOutputAdoptionGuardContract = {
  move: HelmV21RunThreadSwarmReadOnlyWorkerOutputAdoptionGuardMove;
  state: HelmV21RunThreadSwarmReadOnlyWorkerOutputAdoptionGuardState;
  outputConsumptionState: HelmV21RunThreadSwarmReadOnlyWorkerOutputConsumptionState;
  resultAdoptionState: HelmV21RunThreadSwarmReadOnlyWorkerResultAdoptionState;
  executionEventId: string | null;
  materializationEventId: string | null;
  checkpointKey: string | null;
  selectedWorkerKind: HelmV21RunThreadSwarmReadOnlyWorkerKind | null;
  selectedPacketKey: string | null;
  outputBundleKey: string | null;
  outputBundleTitle: string | null;
  outputArtifactTypes: string[];
  handoffConsumerAgent: HelmV2AgentId | null;
  handoffConsumptionGoal: string | null;
  missingRequirements: string[];
  summary: string;
  reason: string;
  nextAction: string | null;
  boundaryNote: string;
};

export type HelmV21RunThreadSwarmReadOnlyWorkerOutputAdoptionLifecycleContract = {
  state: HelmV21RunThreadSwarmReadOnlyWorkerOutputAdoptionLifecycleState;
  driver: HelmV21RunThreadSwarmReadOnlyWorkerOutputAdoptionLifecycleDriver;
  executionEventId: string | null;
  materializationEventId: string | null;
  checkpointKey: string | null;
  selectedWorkerKind: HelmV21RunThreadSwarmReadOnlyWorkerKind | null;
  selectedPacketKey: string | null;
  outputBundleKey: string | null;
  outputBundleTitle: string | null;
  outputArtifactTypes: string[];
  handoffConsumerAgent: HelmV2AgentId | null;
  handoffConsumptionGoal: string | null;
  outputConsumptionState: HelmV21RunThreadSwarmReadOnlyWorkerOutputConsumptionState;
  resultAdoptionState: HelmV21RunThreadSwarmReadOnlyWorkerResultAdoptionState;
  outputAdoptionGuardState: HelmV21RunThreadSwarmReadOnlyWorkerOutputAdoptionGuardState;
  summary: string;
  nextAction: string | null;
  boundaryNote: string;
};

export type HelmV21RunThreadSwarmReadOnlyWorkerResultAdoptionResultSideContract = {
  state: HelmV21RunThreadSwarmReadOnlyWorkerResultAdoptionResultSideState;
  driver: HelmV21RunThreadSwarmReadOnlyWorkerResultAdoptionResultSideDriver;
  outputAdoptionEventId: string | null;
  executionEventId: string | null;
  materializationEventId: string | null;
  checkpointKey: string | null;
  selectedWorkerKind: HelmV21RunThreadSwarmReadOnlyWorkerKind | null;
  selectedPacketKey: string | null;
  outputBundleKey: string | null;
  outputBundleTitle: string | null;
  outputArtifactTypes: string[];
  handoffConsumerAgent: HelmV2AgentId | null;
  handoffConsumptionGoal: string | null;
  outputAdoptionRecordState: HelmV21RunThreadSwarmReadOnlyWorkerRecordState;
  outputAdoptionLifecycleState: HelmV21RunThreadSwarmReadOnlyWorkerOutputAdoptionLifecycleState;
  summary: string;
  nextAction: string | null;
  boundaryNote: string;
};

export type HelmV21RunThreadSwarmReadOnlyWorkerLanePreview = {
  workerKind: HelmV21RunThreadSwarmReadOnlyWorkerKind;
  packetKey: string;
  artifactTypes: string[];
  handoffPacket: HelmV21HandoffPacket;
  summary: string;
};

export type HelmV21RunThreadSwarmReadOnlyWorkerContract = {
  state: HelmV21RunThreadSwarmReadOnlyWorkerContractState;
  taskClass: HelmV21RunThreadSwarmSpawnTaskClass;
  requestState: HelmV21RunThreadSwarmSpawnRequestState;
  requestRecordState: HelmV21RunThreadSwarmSpawnRequestRecordState;
  requestEventId: string | null;
  checkpointKey: string | null;
  requestedAt: Date | null;
  requestedBy: string | null;
  sourcePage: string | null;
  allowlistedWorkers: HelmV21RunThreadSwarmReadOnlyWorkerKind[];
  artifactPolicy: "artifact_first";
  transcriptPolicy: "no_transcript_merge";
  requestLifecycleState: HelmV21RunThreadSwarmReadOnlyWorkerRequestLifecycleState;
  requestLifecycleSummary: string;
  handoffPreviewState: HelmV21RunThreadSwarmReadOnlyWorkerHandoffPreviewState;
  handoffPreviewSummary: string;
  previewPacketKeys: string[];
  packetConsumptionIntentState: HelmV21RunThreadSwarmReadOnlyWorkerPacketConsumptionIntentState;
  packetConsumptionIntentSummary: string;
  artifactBundlePlaceholderState: HelmV21RunThreadSwarmReadOnlyWorkerArtifactBundlePlaceholderState;
  artifactBundlePlaceholderSummary: string;
  placeholderBundleKey: string | null;
  placeholderBundleTitle: string | null;
  placeholderArtifactTypes: string[];
  handoffConsumptionState: HelmV21RunThreadSwarmReadOnlyWorkerHandoffConsumptionState;
  handoffConsumptionSummary: string;
  handoffConsumerAgent: HelmV2AgentId | null;
  handoffConsumptionGoal: string | null;
  executionRecordState: HelmV21RunThreadSwarmReadOnlyWorkerRecordState;
  executionRecordSummary: string;
  executionEventId: string | null;
  executionRecordedAt: Date | null;
  executionRecordedBy: string | null;
  executionRecordSourcePage: string | null;
  artifactBundlePlaceholderRecordState: HelmV21RunThreadSwarmReadOnlyWorkerRecordState;
  artifactBundlePlaceholderRecordSummary: string;
  handoffConsumptionRecordState: HelmV21RunThreadSwarmReadOnlyWorkerRecordState;
  handoffConsumptionRecordSummary: string;
  placeholderRecordEventId: string | null;
  placeholderRecordedAt: Date | null;
  placeholderRecordedBy: string | null;
  placeholderRecordSourcePage: string | null;
  executionPreflightState: HelmV21RunThreadSwarmReadOnlyWorkerExecutionPreflightState;
  executionPreflightSummary: string;
  executionGuardContract: HelmV21RunThreadSwarmReadOnlyWorkerExecutionGuardContract;
  executionLifecycleContract: HelmV21RunThreadSwarmReadOnlyWorkerExecutionLifecycleContract;
  executionCandidateContract: HelmV21RunThreadSwarmReadOnlyWorkerExecutionCandidateContract;
  artifactMaterializationGuardContract: HelmV21RunThreadSwarmReadOnlyWorkerArtifactMaterializationGuardContract;
  artifactMaterializationRecordState: HelmV21RunThreadSwarmReadOnlyWorkerRecordState;
  artifactMaterializationRecordSummary: string;
  artifactMaterializationEventId: string | null;
  artifactMaterializedAt: Date | null;
  artifactMaterializedBy: string | null;
  artifactMaterializationSourcePage: string | null;
  artifactMaterializationLifecycleContract: HelmV21RunThreadSwarmReadOnlyWorkerArtifactMaterializationLifecycleContract;
  resultSideOutputContract: HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputContract;
  resultSideOutputGuardContract: HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputGuardContract;
  resultSideOutputLifecycleContract: HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputLifecycleContract;
  outputConsumptionContract: HelmV21RunThreadSwarmReadOnlyWorkerOutputConsumptionContract;
  resultAdoptionContract: HelmV21RunThreadSwarmReadOnlyWorkerResultAdoptionContract;
  outputAdoptionGuardContract: HelmV21RunThreadSwarmReadOnlyWorkerOutputAdoptionGuardContract;
  outputAdoptionRecordState: HelmV21RunThreadSwarmReadOnlyWorkerRecordState;
  outputAdoptionRecordSummary: string;
  outputAdoptionEventId: string | null;
  outputAdoptedAt: Date | null;
  outputAdoptedBy: string | null;
  outputAdoptionSourcePage: string | null;
  outputAdoptionLifecycleContract: HelmV21RunThreadSwarmReadOnlyWorkerOutputAdoptionLifecycleContract;
  resultAdoptionResultSideContract: HelmV21RunThreadSwarmReadOnlyWorkerResultAdoptionResultSideContract;
  intentEventId: string | null;
  selectedWorkerKind: HelmV21RunThreadSwarmReadOnlyWorkerKind | null;
  selectedPacketKey: string | null;
  selectedArtifactTypes: string[];
  intentRecordedAt: Date | null;
  intentRecordedBy: string | null;
  intentSourcePage: string | null;
  lanePreviews: HelmV21RunThreadSwarmReadOnlyWorkerLanePreview[];
  summary: string;
  nextAction: string | null;
  boundaryNote: string;
};

export type HelmV21RunThreadSwarmVerificationMergeLaneTruth =
  | "mergeable"
  | "rework_required"
  | "human_review_required";

export type HelmV21RunThreadSwarmVerificationMergeLaneState =
  | "not_ready"
  | "recordable"
  | "recorded";

export type HelmV21RunThreadSwarmVerificationMergeLaneDriver =
  | "adoption_not_ready"
  | "verification_missing"
  | "mergeable"
  | "rework_required"
  | "human_review_required"
  | "recorded";

export type HelmV21RunThreadSwarmVerificationMergeLaneContract = {
  state: HelmV21RunThreadSwarmVerificationMergeLaneState;
  driver: HelmV21RunThreadSwarmVerificationMergeLaneDriver;
  mergeLaneTruth: HelmV21RunThreadSwarmVerificationMergeLaneTruth | null;
  recordEventId: string | null;
  checkpointId: string | null;
  checkpointKey: string | null;
  outputAdoptionEventId: string | null;
  verificationStatus: HelmV21VerificationStatus | null;
  verifierSummary: string | null;
  disagreementSummary: string | null;
  arbiterReference: string | null;
  recordedAt: Date | null;
  recordedBy: string | null;
  sourcePage: string | null;
  summary: string;
  nextAction: string | null;
  boundaryNote: string;
};

export type HelmV21RunThreadResultAcknowledgementSource =
  | "human_execution"
  | "official_write"
  | "limited_auto"
  | "official_followthrough";

export type HelmV21RunThreadResultAcknowledgementState =
  | "not_available"
  | "pending"
  | "acknowledged"
  | "failed"
  | "blocked"
  | "deferred"
  | "follow_through_open"
  | "follow_through_resolved";

export type HelmV21RunThreadResultAcknowledgement = {
  source: HelmV21RunThreadResultAcknowledgementSource | null;
  state: HelmV21RunThreadResultAcknowledgementState;
  referenceId: string | null;
  summary: string;
  updatedAt: Date | null;
  boundaryNote: string;
};

export type HelmV21RunThreadResultFlowSourceEntry = {
  source: HelmV21RunThreadResultAcknowledgementSource;
  state: Exclude<HelmV21RunThreadResultAcknowledgementState, "not_available">;
  referenceId: string;
  summary: string;
  updatedAt: Date;
};

export type HelmV21RunThreadResultFlow = {
  summary: string;
  boundaryNote: string;
  latestSource: HelmV21RunThreadResultAcknowledgementSource | null;
  latestState: HelmV21RunThreadResultAcknowledgementState;
  latestReferenceId: string | null;
  latestUpdatedAt: Date | null;
  trackedSourceCount: number;
  requiresOperatorAttentionCount: number;
  resolvedCount: number;
  counts: {
    pending: number;
    acknowledged: number;
    failed: number;
    blocked: number;
    deferred: number;
    followThroughOpen: number;
    followThroughResolved: number;
  };
  sourceEntries: HelmV21RunThreadResultFlowSourceEntry[];
};

export type HelmV21RunThreadForwardFlowState =
  | "idle"
  | "request_open"
  | "active_control"
  | "lifecycle_closeout"
  | "result_attention"
  | "closed";

export type HelmV21RunThreadForwardFlowAttentionSource =
  | "takeover_request"
  | "human_input_request"
  | "active_control"
  | "operator_takeover_followthrough"
  | HelmV21RunThreadResultAcknowledgementSource;

export type HelmV21RunThreadForwardFlow = {
  summary: string;
  boundaryNote: string;
  state: HelmV21RunThreadForwardFlowState;
  latestLifecycleKind: HelmV21RunThreadLifecycleEntryKind | null;
  latestUpdatedAt: Date | null;
  checkpointKey: string | null;
  currentOwner: string | null;
  nextAction: string | null;
  attentionCount: number;
  attentionSources: HelmV21RunThreadForwardFlowAttentionSource[];
};

export type HelmV21RunThreadCloseoutFlowSource =
  | "operator_takeover_followthrough"
  | "closeout_resolution_followthrough"
  | "close_request"
  | HelmV21RunThreadResultAcknowledgementSource;

export type HelmV21RunThreadCloseoutFlowSourceEntry = {
  source: HelmV21RunThreadCloseoutFlowSource;
  state: "open" | "resolved";
  summary: string;
  actorName: string | null;
  checkpointKey: string | null;
  referenceId: string;
  updatedAt: Date;
};

export type HelmV21RunThreadCloseoutFlowState = "idle" | "open" | "resolved";

export type HelmV21RunThreadCloseoutFlow = {
  summary: string;
  boundaryNote: string;
  state: HelmV21RunThreadCloseoutFlowState;
  latestSource: HelmV21RunThreadCloseoutFlowSource | null;
  latestUpdatedAt: Date | null;
  currentOwner: string | null;
  checkpointKey: string | null;
  nextAction: string | null;
  openCount: number;
  resolvedCount: number;
  sourceEntries: HelmV21RunThreadCloseoutFlowSourceEntry[];
};

export type HelmV21RunThreadSettlementReviewState =
  | "not_available"
  | "requestable"
  | "requested"
  | "resolved";

export type HelmV21RunThreadSettlementReview = {
  state: HelmV21RunThreadSettlementReviewState;
  summary: string;
  boundaryNote: string;
  requestEventId: string | null;
  resolutionEventId: string | null;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  nextAction: string | null;
  requestedAt: Date | null;
  resolvedAt: Date | null;
  requestedBy: string | null;
  resolvedBy: string | null;
  sourcePage: string | null;
};

export type HelmV21RunThreadCloseoutConfirmationState =
  | "not_available"
  | "confirmable"
  | "confirmed"
  | "stale";

export type HelmV21RunThreadCloseoutConfirmation = {
  state: HelmV21RunThreadCloseoutConfirmationState;
  summary: string;
  boundaryNote: string;
  confirmationEventId: string | null;
  settlementReviewResolutionEventId: string | null;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  nextAction: string | null;
  confirmedAt: Date | null;
  confirmedBy: string | null;
  sourcePage: string | null;
};

export type HelmV21RunThreadCloseoutRefreshState =
  | "not_requestable"
  | "requestable"
  | "open"
  | "resolved";

export type HelmV21RunThreadCloseoutRefresh = {
  state: HelmV21RunThreadCloseoutRefreshState;
  summary: string;
  boundaryNote: string;
  requestEventId: string | null;
  confirmationEventId: string | null;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  nextAction: string | null;
  requestedAt: Date | null;
  resolvedAt: Date | null;
  requestedBy: string | null;
  sourcePage: string | null;
};

export type HelmV21RunThreadCloseoutSummaryState =
  | "active"
  | "review_requestable"
  | "review_open"
  | "confirmable"
  | "confirmed"
  | "refresh_requestable"
  | "refresh_open"
  | "closed";

export type HelmV21RunThreadCloseoutSummaryDriver =
  | "closeout_flow"
  | "settlement_review"
  | "closeout_confirmation"
  | "closeout_refresh"
  | "lifecycle";

export type HelmV21RunThreadCloseoutSummary = {
  summary: string;
  boundaryNote: string;
  state: HelmV21RunThreadCloseoutSummaryState;
  driver: HelmV21RunThreadCloseoutSummaryDriver;
  latestUpdatedAt: Date | null;
  currentOwner: string | null;
  checkpointKey: string | null;
  nextAction: string | null;
  settlementReviewState: HelmV21RunThreadSettlementReviewState;
  closeoutConfirmationState: HelmV21RunThreadCloseoutConfirmationState;
  closeoutRefreshState: HelmV21RunThreadCloseoutRefreshState;
};

export type HelmV21RunThreadCloseoutResolutionDecision = "close_thread" | "keep_open";

export type HelmV21RunThreadCloseoutResolutionState =
  | "not_available"
  | "decision_required"
  | "close_recorded"
  | "keep_open_recorded"
  | "stale";

export type HelmV21RunThreadCloseoutResolution = {
  state: HelmV21RunThreadCloseoutResolutionState;
  decision: HelmV21RunThreadCloseoutResolutionDecision | null;
  summary: string;
  boundaryNote: string;
  resolutionEventId: string | null;
  closeoutConfirmationEventId: string | null;
  closeoutRefreshEventId: string | null;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  nextAction: string | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  sourcePage: string | null;
};

export type HelmV21RunThreadCloseoutResolutionFollowThroughState =
  | "not_available"
  | "requestable"
  | "open"
  | "resolved"
  | "stale";

export type HelmV21RunThreadCloseoutResolutionFollowThrough = {
  state: HelmV21RunThreadCloseoutResolutionFollowThroughState;
  decision: HelmV21RunThreadCloseoutResolutionDecision | null;
  summary: string;
  boundaryNote: string;
  requestEventId: string | null;
  resolutionEventId: string | null;
  closeoutResolutionEventId: string | null;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  nextAction: string | null;
  requestedAt: Date | null;
  resolvedAt: Date | null;
  requestedBy: string | null;
  resolvedBy: string | null;
  sourcePage: string | null;
};

export type HelmV21RunThreadCloseoutOutcomeState =
  | "not_available"
  | "decision_required"
  | "followthrough_required"
  | "followthrough_open"
  | "close_pending"
  | "kept_open"
  | "closed"
  | "mismatch"
  | "stale";

export type HelmV21RunThreadCloseoutOutcome = {
  state: HelmV21RunThreadCloseoutOutcomeState;
  decision: HelmV21RunThreadCloseoutResolutionDecision | null;
  summary: string;
  boundaryNote: string;
  resolutionEventId: string | null;
  followThroughRequestEventId: string | null;
  followThroughResolutionEventId: string | null;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  nextAction: string | null;
  latestUpdatedAt: Date | null;
  currentOwner: string | null;
  closedAt: Date | null;
  sourcePage: string | null;
};

export type HelmV21RunThreadCloseRequestState =
  | "not_available"
  | "requestable"
  | "open"
  | "resolved"
  | "stale"
  | "mismatch";

export type HelmV21RunThreadCloseRequest = {
  state: HelmV21RunThreadCloseRequestState;
  summary: string;
  boundaryNote: string;
  requestEventId: string | null;
  closeoutResolutionEventId: string | null;
  closeoutResolutionFollowThroughEventId: string | null;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  nextAction: string | null;
  requestedAt: Date | null;
  resolvedAt: Date | null;
  requestedBy: string | null;
  sourcePage: string | null;
};

export type HelmV21RunThreadCloseLifecycleState =
  | "inactive"
  | "decision_required"
  | "followthrough_required"
  | "followthrough_open"
  | "close_requestable"
  | "close_requested"
  | "closeable"
  | "kept_open"
  | "closed"
  | "stale"
  | "mismatch";

export type HelmV21RunThreadCloseLifecycleDriver =
  | "closeout_summary"
  | "closeout_resolution"
  | "closeout_resolution_followthrough"
  | "closeout_outcome"
  | "close_request"
  | "lifecycle";

export type HelmV21RunThreadCloseLifecycle = {
  state: HelmV21RunThreadCloseLifecycleState;
  driver: HelmV21RunThreadCloseLifecycleDriver;
  decision: HelmV21RunThreadCloseoutResolutionDecision | null;
  summary: string;
  boundaryNote: string;
  checkpointKey: string | null;
  currentOwner: string | null;
  latestUpdatedAt: Date | null;
  nextAction: string | null;
};

export type HelmV21RunThreadCloseControlState =
  | "active"
  | "review_requestable"
  | "review_open"
  | "closeout_open"
  | "decision_required"
  | "followthrough_required"
  | "followthrough_open"
  | "close_requestable"
  | "close_requested"
  | "kept_open"
  | "closed"
  | "stale"
  | "mismatch";

export type HelmV21RunThreadCloseControlDriver =
  | "closeout_summary"
  | "settlement_flow"
  | "close_lifecycle"
  | "lifecycle";

export type HelmV21RunThreadCloseControl = {
  state: HelmV21RunThreadCloseControlState;
  driver: HelmV21RunThreadCloseControlDriver;
  decision: HelmV21RunThreadCloseoutResolutionDecision | null;
  summary: string;
  boundaryNote: string;
  checkpointKey: string | null;
  currentOwner: string | null;
  latestUpdatedAt: Date | null;
  nextAction: string | null;
};

export type HelmV21RunThreadCloseControlFlowState =
  | "active"
  | "forward_active"
  | "review_requestable"
  | "review_open"
  | "closeout_open"
  | "decision_required"
  | "followthrough_required"
  | "followthrough_open"
  | "close_requestable"
  | "close_requested"
  | "kept_open"
  | "closed"
  | "stale"
  | "mismatch";

export type HelmV21RunThreadCloseControlFlowDriver =
  | "close_control"
  | "forward_flow"
  | "settlement_flow"
  | "lifecycle";

export type HelmV21RunThreadCloseControlFlow = {
  state: HelmV21RunThreadCloseControlFlowState;
  driver: HelmV21RunThreadCloseControlFlowDriver;
  decision: HelmV21RunThreadCloseoutResolutionDecision | null;
  summary: string;
  boundaryNote: string;
  checkpointKey: string | null;
  currentOwner: string | null;
  latestUpdatedAt: Date | null;
  nextAction: string | null;
  forwardState: HelmV21RunThreadForwardFlowState;
  settlementState: HelmV21RunThreadSettlementFlowState;
  forwardAttentionCount: number;
  openCloseoutCount: number;
};

export type HelmV21RunThreadCloseDecisionFlowState =
  | "active"
  | "review_requestable"
  | "review_open"
  | "decision_required"
  | "followthrough_required"
  | "followthrough_open"
  | "close_requestable"
  | "close_requested"
  | "kept_open"
  | "closed"
  | "stale"
  | "mismatch";

export type HelmV21RunThreadCloseDecisionFlowDriver =
  | "close_control_flow"
  | "closeout_outcome"
  | "close_request"
  | "lifecycle";

export type HelmV21RunThreadCloseDecisionFlow = {
  state: HelmV21RunThreadCloseDecisionFlowState;
  driver: HelmV21RunThreadCloseDecisionFlowDriver;
  decision: HelmV21RunThreadCloseoutResolutionDecision | null;
  summary: string;
  boundaryNote: string;
  checkpointKey: string | null;
  currentOwner: string | null;
  latestUpdatedAt: Date | null;
  nextAction: string | null;
  controlState: HelmV21RunThreadCloseControlFlowState;
  outcomeState: HelmV21RunThreadCloseoutOutcomeState;
  closeRequestState: HelmV21RunThreadCloseRequestState;
};

export type HelmV21RunThreadCloseDecisionControlSummaryState =
  | "active"
  | "forward_active"
  | "closeout_open"
  | "review_requestable"
  | "review_open"
  | "decision_required"
  | "followthrough_required"
  | "followthrough_open"
  | "close_requestable"
  | "close_requested"
  | "closeable"
  | "kept_open"
  | "closed"
  | "stale"
  | "mismatch";

export type HelmV21RunThreadCloseDecisionControlSummaryDriver =
  | "close_decision_flow"
  | "close_lifecycle"
  | "close_control_flow"
  | "forward_flow"
  | "lifecycle";

export type HelmV21RunThreadCloseDecisionControlSummary = {
  state: HelmV21RunThreadCloseDecisionControlSummaryState;
  driver: HelmV21RunThreadCloseDecisionControlSummaryDriver;
  decision: HelmV21RunThreadCloseoutResolutionDecision | null;
  summary: string;
  boundaryNote: string;
  checkpointKey: string | null;
  currentOwner: string | null;
  latestUpdatedAt: Date | null;
  nextAction: string | null;
  decisionState: HelmV21RunThreadCloseDecisionFlowState;
  controlState: HelmV21RunThreadCloseControlFlowState;
  lifecycleState: HelmV21RunThreadCloseLifecycleState;
  forwardState: HelmV21RunThreadForwardFlowState;
  settlementState: HelmV21RunThreadSettlementFlowState;
};

export type HelmV21RunThreadCloseResolutionSummaryState =
  | "not_ready"
  | "decision_required"
  | "followthrough_required"
  | "followthrough_open"
  | "ready_to_request_close"
  | "close_requested"
  | "kept_open"
  | "closed"
  | "stale"
  | "mismatch";

export type HelmV21RunThreadCloseResolutionSummaryDriver =
  | "close_decision_control_summary"
  | "close_lifecycle"
  | "close_request"
  | "lifecycle";

export type HelmV21RunThreadCloseResolutionSummary = {
  state: HelmV21RunThreadCloseResolutionSummaryState;
  driver: HelmV21RunThreadCloseResolutionSummaryDriver;
  decision: HelmV21RunThreadCloseoutResolutionDecision | null;
  summary: string;
  boundaryNote: string;
  checkpointKey: string | null;
  currentOwner: string | null;
  latestUpdatedAt: Date | null;
  nextAction: string | null;
  decisionControlState: HelmV21RunThreadCloseDecisionControlSummaryState;
  lifecycleState: HelmV21RunThreadCloseLifecycleState;
  closeRequestState: HelmV21RunThreadCloseRequestState;
};

export type HelmV21RunThreadCloseResolutionForwardSummaryState =
  | "active"
  | "forward_active"
  | "closeout_open"
  | "review_requestable"
  | "review_open"
  | "decision_required"
  | "followthrough_required"
  | "followthrough_open"
  | "ready_to_request_close"
  | "close_requested"
  | "kept_open"
  | "closed"
  | "stale"
  | "mismatch";

export type HelmV21RunThreadCloseResolutionForwardSummaryDriver =
  | "close_resolution_summary"
  | "close_decision_control_summary"
  | "settlement_flow"
  | "forward_flow"
  | "lifecycle";

export type HelmV21RunThreadCloseResolutionForwardSummary = {
  state: HelmV21RunThreadCloseResolutionForwardSummaryState;
  driver: HelmV21RunThreadCloseResolutionForwardSummaryDriver;
  decision: HelmV21RunThreadCloseoutResolutionDecision | null;
  summary: string;
  boundaryNote: string;
  checkpointKey: string | null;
  currentOwner: string | null;
  latestUpdatedAt: Date | null;
  nextAction: string | null;
  resolutionState: HelmV21RunThreadCloseResolutionSummaryState;
  decisionControlState: HelmV21RunThreadCloseDecisionControlSummaryState;
  settlementState: HelmV21RunThreadSettlementFlowState;
  forwardState: HelmV21RunThreadForwardFlowState;
  forwardAttentionCount: number;
  openCloseoutCount: number;
};

export type HelmV21RunThreadCloseResolutionControlSummaryState =
  | "not_ready"
  | "ready_to_request_close"
  | "close_requested"
  | "kept_open"
  | "closed"
  | "stale"
  | "mismatch";

export type HelmV21RunThreadCloseResolutionControlSummaryDriver =
  | "close_resolution_forward_summary"
  | "close_resolution_summary"
  | "close_lifecycle"
  | "lifecycle";

export type HelmV21RunThreadCloseResolutionControlSummary = {
  state: HelmV21RunThreadCloseResolutionControlSummaryState;
  driver: HelmV21RunThreadCloseResolutionControlSummaryDriver;
  decision: HelmV21RunThreadCloseoutResolutionDecision | null;
  summary: string;
  boundaryNote: string;
  checkpointKey: string | null;
  currentOwner: string | null;
  latestUpdatedAt: Date | null;
  nextAction: string | null;
  resolutionState: HelmV21RunThreadCloseResolutionSummaryState;
  forwardState: HelmV21RunThreadCloseResolutionForwardSummaryState;
  lifecycleState: HelmV21RunThreadCloseLifecycleState;
  closeRequestState: HelmV21RunThreadCloseRequestState;
};

export type HelmV21RunThreadClosePostureSummaryState =
  | "open"
  | "close_ready"
  | "close_pending"
  | "kept_open"
  | "closed"
  | "stale"
  | "mismatch";

export type HelmV21RunThreadClosePostureSummaryDriver =
  | "close_resolution_control_summary"
  | "close_resolution_forward_summary"
  | "close_lifecycle"
  | "lifecycle";

export type HelmV21RunThreadClosePostureSummary = {
  state: HelmV21RunThreadClosePostureSummaryState;
  driver: HelmV21RunThreadClosePostureSummaryDriver;
  decision: HelmV21RunThreadCloseoutResolutionDecision | null;
  summary: string;
  boundaryNote: string;
  checkpointKey: string | null;
  currentOwner: string | null;
  latestUpdatedAt: Date | null;
  nextAction: string | null;
  resolutionControlState: HelmV21RunThreadCloseResolutionControlSummaryState;
  resolutionForwardState: HelmV21RunThreadCloseResolutionForwardSummaryState;
  lifecycleState: HelmV21RunThreadCloseLifecycleState;
  closeRequestState: HelmV21RunThreadCloseRequestState;
};

export type HelmV21RunThreadClosePostureForwardSummaryState =
  | "open"
  | "review_requestable"
  | "review_open"
  | "closeout_open"
  | "forward_open"
  | "close_ready"
  | "close_pending"
  | "kept_open"
  | "closed"
  | "stale"
  | "mismatch";

export type HelmV21RunThreadClosePostureForwardSummaryDriver =
  | "close_posture_summary"
  | "close_resolution_forward_summary"
  | "settlement_flow"
  | "forward_flow"
  | "lifecycle";

export type HelmV21RunThreadClosePostureForwardSummary = {
  state: HelmV21RunThreadClosePostureForwardSummaryState;
  driver: HelmV21RunThreadClosePostureForwardSummaryDriver;
  decision: HelmV21RunThreadCloseoutResolutionDecision | null;
  summary: string;
  boundaryNote: string;
  checkpointKey: string | null;
  currentOwner: string | null;
  latestUpdatedAt: Date | null;
  nextAction: string | null;
  postureState: HelmV21RunThreadClosePostureSummaryState;
  resolutionForwardState: HelmV21RunThreadCloseResolutionForwardSummaryState;
  settlementState: HelmV21RunThreadSettlementFlowState;
  forwardState: HelmV21RunThreadForwardFlowState;
  closeRequestState: HelmV21RunThreadCloseRequestState;
  forwardAttentionCount: number;
  openCloseoutCount: number;
};

export type HelmV21RunThreadSettlementFlowState =
  | "active"
  | "closeout_open"
  | "review_open"
  | "ready_to_close"
  | "closed";

export type HelmV21RunThreadSettlementFlowDriver =
  | "forward_flow"
  | "closeout_flow"
  | "result_flow"
  | "settlement_review"
  | "lifecycle";

export type HelmV21RunThreadSettlementFlow = {
  summary: string;
  boundaryNote: string;
  state: HelmV21RunThreadSettlementFlowState;
  driver: HelmV21RunThreadSettlementFlowDriver;
  latestUpdatedAt: Date | null;
  currentOwner: string | null;
  checkpointKey: string | null;
  nextAction: string | null;
  forwardAttentionCount: number;
  openCloseoutCount: number;
  resolvedCloseoutCount: number;
};

export type HelmV21RunThreadLifecycleEntryKind =
  | "run_started"
  | "checkpoint_written"
  | "checkpoint_resumed"
  | "handoff_created"
  | "continuity_remediation"
  | "takeover_requested"
  | "takeover_active"
  | "takeover_released"
  | "takeover_followthrough_requested"
  | "takeover_followthrough_resolved"
  | "human_input_requested"
  | "result_acknowledged"
  | "takeover_request_acknowledged"
  | "human_input_request_acknowledged"
  | "settlement_review_requested"
  | "settlement_review_resolved"
  | "closeout_confirmed"
  | "closeout_refresh_requested"
  | "closeout_resolution_recorded"
  | "closeout_resolution_followthrough_requested"
  | "closeout_resolution_followthrough_resolved"
  | "close_request_requested"
  | "run_closed";

export type HelmV21RunThreadLifecycleEntrySource =
  | "run_thread"
  | "checkpoint_lineage"
  | "handoff_packet"
  | "continuity_remediation"
  | "result_acknowledgement"
  | "debugger_request"
  | "settlement_review"
  | "closeout_confirmation"
  | "closeout_refresh"
  | "closeout_resolution"
  | "closeout_resolution_followthrough"
  | "close_request";

export type HelmV21RunThreadLifecycleEntry = {
  id: string;
  kind: HelmV21RunThreadLifecycleEntryKind;
  label: string;
  summary: string;
  timestamp: Date;
  checkpointKey: string | null;
  source: HelmV21RunThreadLifecycleEntrySource;
};

export type HelmV21RunThreadRequestState = "not_requested" | "requested" | "acknowledged";

export type HelmV21RunThreadRequestPosture = {
  summary: string;
  boundaryNote: string;
  takeoverState: HelmV21RunThreadRequestState;
  humanInputState: HelmV21RunThreadRequestState;
  activeRequestCount: number;
  acknowledgedRequestCount: number;
  latestRequestedAt: Date | null;
  latestAcknowledgedAt: Date | null;
  latestLifecycleKind:
    | "takeover_requested"
    | "human_input_requested"
    | "takeover_request_acknowledged"
    | "human_input_request_acknowledged"
    | null;
};

export type HelmV21OperatorDebuggerHistoryKind =
  | HelmV21RunThreadLifecycleEntryKind
  | "replay_event"
  | "context_pruned"
  | "run_closed";

export type HelmV21OperatorDebuggerHistoryEntry = {
  id: string;
  kind: HelmV21OperatorDebuggerHistoryKind;
  label: string;
  summary: string;
  timestamp: Date;
  checkpointKey: string | null;
  source:
    | HelmV21RunThreadLifecycleEntrySource
    | "replay_log"
    | "context_edit";
};

export type HelmV21OperatorDebuggerVariableSnapshotEntry = {
  key: string;
  value: string;
  source: "run_thread" | "notebook" | "payload" | "verification";
};

export type HelmV21OperatorDebuggerReplayFidelity = "strong" | "watch" | "weak" | "none";

export type HelmV21OperatorDebuggerReplayAssistance = {
  fidelity: HelmV21OperatorDebuggerReplayFidelity;
  checkpointKey: string | null;
  resumeToken: string | null;
  eventLogEntries: number;
  summary: string;
  boundaryNote: string;
};

export type HelmV21OperatorDebuggerPersistedLifecycleTraceState =
  | "backfill_required"
  | "fallback_to_event_truth"
  | "refresh_required"
  | "aligned";

export type HelmV21OperatorDebuggerPersistedLifecycleTraceAnchor =
  | "none"
  | "checkpoint"
  | "replay"
  | "human_input";

export type HelmV21OperatorDebuggerPersistedLifecycleTrace = {
  state: HelmV21OperatorDebuggerPersistedLifecycleTraceState;
  anchor: HelmV21OperatorDebuggerPersistedLifecycleTraceAnchor;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  resumeState: HelmV21RunThreadResumeState;
  replayRequestMode: HelmV21RunThreadReplayRequestMode;
  humanInputCheckpointState: HelmV21RunThreadHumanInputCheckpointState;
  persistedLifecycleState: HelmV21RunThreadPersistedControlPlaneLifecycleState;
  writeSideState: HelmV21RunThreadPersistedControlPlaneLifecycleWriteSideState;
  refreshReason: HelmV21RunThreadPersistedControlPlaneLifecycleRefreshReason | null;
  refreshSource: string | null;
  compactionState: HelmV21RunThreadPersistedControlPlaneLifecycleCompactionState;
  reconciliationState: HelmV21RunThreadPersistedControlPlaneLifecycleReconciliationState;
  checkpointLineageDepth: number;
  replayEventLogEntries: number;
  summary: string;
  nextAction: string | null;
  boundaryNote: string;
};

export type HelmV21OperatorDebuggerTraceContractState =
  | "backfill_required"
  | "refresh_required"
  | "human_input_ready"
  | "replay_ready"
  | "checkpoint_ready"
  | "observe";

export type HelmV21OperatorDebuggerTraceContractDriver =
  | "persisted_lifecycle"
  | "human_input"
  | "replay"
  | "checkpoint"
  | "observe";

export type HelmV21OperatorDebuggerTraceContract = {
  state: HelmV21OperatorDebuggerTraceContractState;
  driver: HelmV21OperatorDebuggerTraceContractDriver;
  anchor: HelmV21OperatorDebuggerPersistedLifecycleTraceAnchor;
  checkpointState: HelmV21RuntimeCheckpointState | "not_available";
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  resumeState: HelmV21RunThreadResumeState;
  replayRequestMode: HelmV21RunThreadReplayRequestMode;
  replayFidelity: HelmV21OperatorDebuggerReplayFidelity;
  replayEventLogEntries: number;
  checkpointLineageDepth: number;
  humanInputCheckpointState: HelmV21RunThreadHumanInputCheckpointState;
  humanInputRequestState: HelmV21HumanInputCheckpointRequest["state"];
  persistedLifecycleState: HelmV21RunThreadPersistedControlPlaneLifecycleState;
  persistedTraceState: HelmV21OperatorDebuggerPersistedLifecycleTraceState;
  persistedWriteSideState: HelmV21RunThreadPersistedControlPlaneLifecycleWriteSideState;
  refreshReason: HelmV21RunThreadPersistedControlPlaneLifecycleRefreshReason | null;
  summary: string;
  nextAction: string | null;
  boundaryNote: string;
};

export type HelmV21OperatorDebuggerSwarmSpawnContractDriver =
  | "workspace_flag"
  | "budget_envelope"
  | "run_thread_policy"
  | "request_recorded"
  | "admission_ready";

export type HelmV21OperatorDebuggerSwarmSpawnContract = {
  state: HelmV21RunThreadSwarmSpawnContract["state"];
  driver: HelmV21OperatorDebuggerSwarmSpawnContractDriver;
  requestRecordState: HelmV21RunThreadSwarmSpawnRequestRecordState;
  requestEventId: string | null;
  taskClass: HelmV21RunThreadSwarmSpawnTaskClass;
  checkpointId: string | null;
  checkpointKey: string | null;
  requestedAt: Date | null;
  requestedBy: string | null;
  sourcePage: string | null;
  workspaceFlagState: HelmV21RunThreadSwarmWorkspaceFlagState;
  lifecycleState: HelmV21RunThreadLifecycleState;
  budgetPosture: HelmV21RunThreadSwarmSpawnContract["budgetPosture"];
  budgetEnvelopeState: HelmV21RunThreadSwarmBudgetEnvelopeState;
  requestState: HelmV21RunThreadSwarmSpawnRequestState;
  denyReason: HelmV21RunThreadSwarmSpawnDenyReason | null;
  denySummary: string | null;
  summary: string;
  nextAction: string | null;
  boundaryNote: string;
};

export type HelmV21OperatorDebuggerSwarmReadOnlyWorkerContractDriver =
  | "spawn_blocked"
  | "allowlist_ready"
  | "request_recorded"
  | "intent_recorded"
  | "execution_recorded"
  | "preflight_ready";

export type HelmV21OperatorDebuggerSwarmReadOnlyWorkerExecutionGuardContract =
  HelmV21RunThreadSwarmReadOnlyWorkerExecutionGuardContract;

export type HelmV21OperatorDebuggerSwarmReadOnlyWorkerExecutionLifecycleContract =
  HelmV21RunThreadSwarmReadOnlyWorkerExecutionLifecycleContract;

export type HelmV21OperatorDebuggerSwarmReadOnlyWorkerExecutionCandidateContract =
  HelmV21RunThreadSwarmReadOnlyWorkerExecutionCandidateContract;

export type HelmV21OperatorDebuggerSwarmReadOnlyWorkerArtifactMaterializationGuardContract =
  HelmV21RunThreadSwarmReadOnlyWorkerArtifactMaterializationGuardContract;

export type HelmV21OperatorDebuggerSwarmReadOnlyWorkerArtifactMaterializationLifecycleContract =
  HelmV21RunThreadSwarmReadOnlyWorkerArtifactMaterializationLifecycleContract;

export type HelmV21OperatorDebuggerSwarmReadOnlyWorkerResultSideOutputContract =
  HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputContract;

export type HelmV21OperatorDebuggerSwarmReadOnlyWorkerResultSideOutputGuardContract =
  HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputGuardContract;

export type HelmV21OperatorDebuggerSwarmReadOnlyWorkerResultSideOutputLifecycleContract =
  HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputLifecycleContract;

export type HelmV21OperatorDebuggerSwarmReadOnlyWorkerOutputConsumptionContract =
  HelmV21RunThreadSwarmReadOnlyWorkerOutputConsumptionContract;

export type HelmV21OperatorDebuggerSwarmReadOnlyWorkerResultAdoptionContract =
  HelmV21RunThreadSwarmReadOnlyWorkerResultAdoptionContract;

export type HelmV21OperatorDebuggerSwarmReadOnlyWorkerOutputAdoptionGuardContract =
  HelmV21RunThreadSwarmReadOnlyWorkerOutputAdoptionGuardContract;

export type HelmV21OperatorDebuggerSwarmReadOnlyWorkerOutputAdoptionLifecycleContract =
  HelmV21RunThreadSwarmReadOnlyWorkerOutputAdoptionLifecycleContract;

export type HelmV21OperatorDebuggerSwarmReadOnlyWorkerResultAdoptionResultSideContract =
  HelmV21RunThreadSwarmReadOnlyWorkerResultAdoptionResultSideContract;

export type HelmV21OperatorDebuggerSwarmVerificationMergeLaneContract =
  HelmV21RunThreadSwarmVerificationMergeLaneContract;

export type HelmV21OperatorDebuggerSwarmReadOnlyWorkerContract = {
  state: HelmV21RunThreadSwarmReadOnlyWorkerContract["state"];
  driver: HelmV21OperatorDebuggerSwarmReadOnlyWorkerContractDriver;
  taskClass: HelmV21RunThreadSwarmSpawnTaskClass;
  requestState: HelmV21RunThreadSwarmSpawnRequestState;
  requestRecordState: HelmV21RunThreadSwarmSpawnRequestRecordState;
  requestEventId: string | null;
  checkpointKey: string | null;
  requestedAt: Date | null;
  requestedBy: string | null;
  sourcePage: string | null;
  allowlistedWorkers: HelmV21RunThreadSwarmReadOnlyWorkerKind[];
  artifactPolicy: HelmV21RunThreadSwarmReadOnlyWorkerContract["artifactPolicy"];
  transcriptPolicy: HelmV21RunThreadSwarmReadOnlyWorkerContract["transcriptPolicy"];
  requestLifecycleState: HelmV21RunThreadSwarmReadOnlyWorkerContract["requestLifecycleState"];
  requestLifecycleSummary: string;
  handoffPreviewState: HelmV21RunThreadSwarmReadOnlyWorkerContract["handoffPreviewState"];
  handoffPreviewSummary: string;
  previewPacketKeys: string[];
  packetConsumptionIntentState:
    HelmV21RunThreadSwarmReadOnlyWorkerContract["packetConsumptionIntentState"];
  packetConsumptionIntentSummary: string;
  artifactBundlePlaceholderState:
    HelmV21RunThreadSwarmReadOnlyWorkerContract["artifactBundlePlaceholderState"];
  artifactBundlePlaceholderSummary: string;
  placeholderBundleKey: string | null;
  placeholderBundleTitle: string | null;
  placeholderArtifactTypes: string[];
  handoffConsumptionState:
    HelmV21RunThreadSwarmReadOnlyWorkerContract["handoffConsumptionState"];
  handoffConsumptionSummary: string;
  handoffConsumerAgent: HelmV2AgentId | null;
  handoffConsumptionGoal: string | null;
  executionRecordState: HelmV21RunThreadSwarmReadOnlyWorkerContract["executionRecordState"];
  executionRecordSummary: string;
  executionEventId: string | null;
  executionRecordedAt: Date | null;
  executionRecordedBy: string | null;
  executionRecordSourcePage: string | null;
  artifactBundlePlaceholderRecordState:
    HelmV21RunThreadSwarmReadOnlyWorkerContract["artifactBundlePlaceholderRecordState"];
  artifactBundlePlaceholderRecordSummary: string;
  handoffConsumptionRecordState:
    HelmV21RunThreadSwarmReadOnlyWorkerContract["handoffConsumptionRecordState"];
  handoffConsumptionRecordSummary: string;
  placeholderRecordEventId: string | null;
  placeholderRecordedAt: Date | null;
  placeholderRecordedBy: string | null;
  placeholderRecordSourcePage: string | null;
  executionPreflightState:
    HelmV21RunThreadSwarmReadOnlyWorkerContract["executionPreflightState"];
  executionPreflightSummary: string;
  executionGuardContract: HelmV21OperatorDebuggerSwarmReadOnlyWorkerExecutionGuardContract;
  executionLifecycleContract: HelmV21OperatorDebuggerSwarmReadOnlyWorkerExecutionLifecycleContract;
  executionCandidateContract: HelmV21OperatorDebuggerSwarmReadOnlyWorkerExecutionCandidateContract;
  artifactMaterializationGuardContract: HelmV21OperatorDebuggerSwarmReadOnlyWorkerArtifactMaterializationGuardContract;
  artifactMaterializationRecordState:
    HelmV21RunThreadSwarmReadOnlyWorkerContract["artifactMaterializationRecordState"];
  artifactMaterializationRecordSummary: string;
  artifactMaterializationEventId: string | null;
  artifactMaterializedAt: Date | null;
  artifactMaterializedBy: string | null;
  artifactMaterializationSourcePage: string | null;
  artifactMaterializationLifecycleContract: HelmV21OperatorDebuggerSwarmReadOnlyWorkerArtifactMaterializationLifecycleContract;
  resultSideOutputContract: HelmV21OperatorDebuggerSwarmReadOnlyWorkerResultSideOutputContract;
  resultSideOutputGuardContract: HelmV21OperatorDebuggerSwarmReadOnlyWorkerResultSideOutputGuardContract;
  resultSideOutputLifecycleContract: HelmV21OperatorDebuggerSwarmReadOnlyWorkerResultSideOutputLifecycleContract;
  outputConsumptionContract: HelmV21OperatorDebuggerSwarmReadOnlyWorkerOutputConsumptionContract;
  resultAdoptionContract: HelmV21OperatorDebuggerSwarmReadOnlyWorkerResultAdoptionContract;
  outputAdoptionGuardContract: HelmV21OperatorDebuggerSwarmReadOnlyWorkerOutputAdoptionGuardContract;
  outputAdoptionRecordState:
    HelmV21RunThreadSwarmReadOnlyWorkerContract["outputAdoptionRecordState"];
  outputAdoptionRecordSummary: string;
  outputAdoptionEventId: string | null;
  outputAdoptedAt: Date | null;
  outputAdoptedBy: string | null;
  outputAdoptionSourcePage: string | null;
  outputAdoptionLifecycleContract: HelmV21OperatorDebuggerSwarmReadOnlyWorkerOutputAdoptionLifecycleContract;
  resultAdoptionResultSideContract: HelmV21OperatorDebuggerSwarmReadOnlyWorkerResultAdoptionResultSideContract;
  intentEventId: string | null;
  selectedWorkerKind: HelmV21RunThreadSwarmReadOnlyWorkerKind | null;
  selectedPacketKey: string | null;
  selectedArtifactTypes: string[];
  intentRecordedAt: Date | null;
  intentRecordedBy: string | null;
  intentSourcePage: string | null;
  lanePreviews: HelmV21RunThreadSwarmReadOnlyWorkerLanePreview[];
  summary: string;
  nextAction: string | null;
  boundaryNote: string;
};

export type HelmV21OperatorDebuggerWriteContractState =
  | "backfill_required"
  | "refresh_required"
  | "resume_active"
  | "human_input_active"
  | "replay_active"
  | "checkpoint_active"
  | "observe";

export type HelmV21OperatorDebuggerWriteContractDriver =
  | "persisted_lifecycle"
  | "resume"
  | "human_input"
  | "replay"
  | "checkpoint"
  | "observe";

export type HelmV21OperatorDebuggerWriteContract = {
  state: HelmV21OperatorDebuggerWriteContractState;
  driver: HelmV21OperatorDebuggerWriteContractDriver;
  writeAnchor: HelmV21RunThreadPersistedControlPlaneLifecycleWriteAnchor;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  resumeState: HelmV21RunThreadResumeState;
  replayRequestMode: HelmV21RunThreadReplayRequestMode;
  humanInputCheckpointState: HelmV21RunThreadHumanInputCheckpointState;
  humanInputRequestState: HelmV21HumanInputCheckpointRequest["state"];
  persistedLifecycleState: HelmV21RunThreadPersistedControlPlaneLifecycleState;
  persistedTraceState: HelmV21OperatorDebuggerPersistedLifecycleTraceState;
  persistedWriteSideState: HelmV21RunThreadPersistedControlPlaneLifecycleWriteSideState;
  refreshReason: HelmV21RunThreadPersistedControlPlaneLifecycleRefreshReason | null;
  refreshSource: string | null;
  traceContractState: HelmV21OperatorDebuggerTraceContract["state"];
  traceContractDriver: HelmV21OperatorDebuggerTraceContract["driver"];
  summary: string;
  nextAction: string | null;
  boundaryNote: string;
};

export type HelmV21OperatorDebuggerRecoveryActionContractState =
  | "backfill_required"
  | "refresh_required"
  | "blocked"
  | "review_required"
  | "requestable"
  | "requested"
  | "acknowledged"
  | "active"
  | "followthrough_requestable"
  | "followthrough_open"
  | "followthrough_resolved"
  | "applied"
  | "observe";

export type HelmV21OperatorDebuggerRecoveryActionContractDriver =
  | "persisted_lifecycle"
  | "recovery"
  | "takeover_request"
  | "takeover_activation"
  | "takeover_followthrough"
  | "remediation_trace"
  | "observe";

export type HelmV21OperatorDebuggerRecoveryActionContract = {
  state: HelmV21OperatorDebuggerRecoveryActionContractState;
  driver: HelmV21OperatorDebuggerRecoveryActionContractDriver;
  action: "SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT" | null;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  recoveryState: "STABLE" | "RECOVERABLE" | "REVIEW_REQUIRED" | "BLOCKED";
  failureTaxonomy:
    | "NONE"
    | "NO_RECOVERY_ANCHOR"
    | "BUDGET_PRESSURE"
    | "PAYLOAD_STATE_DRIFT"
    | "REPLAY_DRIFT"
    | "PROTECTED_STATE_GAP";
  traceContractState: HelmV21OperatorDebuggerTraceContract["state"];
  writeContractState: HelmV21OperatorDebuggerWriteContract["state"];
  takeoverRequestState: HelmV21OperatorDebuggerTakeoverRequest["state"];
  takeoverActivationState: HelmV21OperatorDebuggerTakeoverActivation["state"];
  takeoverFollowThroughState: HelmV21OperatorDebuggerTakeoverFollowThrough["state"];
  latestRemediationEventId: string | null;
  latestRemediationExecutionStatus: "APPLIED" | "REVIEW_REQUIRED" | "BLOCKED" | null;
  latestRemediationTriggeredBy: string | null;
  latestRemediationAt: Date | null;
  summary: string;
  nextAction: string | null;
  boundaryNote: string;
};

export type HelmV21OperatorDebuggerRecoveryLifecycleContractState =
  | "backfill_required"
  | "refresh_required"
  | "blocked"
  | "review_required"
  | "request_lane"
  | "activation_lane"
  | "followthrough_lane"
  | "applied"
  | "observe";

export type HelmV21OperatorDebuggerRecoveryLifecycleContractDriver =
  | "persisted_lifecycle"
  | "recovery"
  | "takeover_request"
  | "takeover_activation"
  | "takeover_followthrough"
  | "remediation_trace"
  | "observe";

export type HelmV21OperatorDebuggerRecoveryLifecycleContractAnchor =
  | "none"
  | "checkpoint"
  | "resume"
  | "replay"
  | "human_input";

export type HelmV21OperatorDebuggerRecoveryLifecycleContractTransition =
  | "backfill_snapshot"
  | "refresh_snapshot"
  | "review_recovery"
  | "request_takeover"
  | "acknowledge_takeover"
  | "start_takeover"
  | "release_takeover"
  | "request_followthrough"
  | "resolve_followthrough"
  | "observe";

export type HelmV21OperatorDebuggerRecoveryLifecycleContract = {
  state: HelmV21OperatorDebuggerRecoveryLifecycleContractState;
  driver: HelmV21OperatorDebuggerRecoveryLifecycleContractDriver;
  anchor: HelmV21OperatorDebuggerRecoveryLifecycleContractAnchor;
  action: "SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT" | null;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  nextTransition: HelmV21OperatorDebuggerRecoveryLifecycleContractTransition;
  traceContractState: HelmV21OperatorDebuggerTraceContract["state"];
  writeContractState: HelmV21OperatorDebuggerWriteContract["state"];
  recoveryActionState: HelmV21OperatorDebuggerRecoveryActionContract["state"];
  takeoverRequestState: HelmV21OperatorDebuggerTakeoverRequest["state"];
  takeoverActivationState: HelmV21OperatorDebuggerTakeoverActivation["state"];
  takeoverFollowThroughState: HelmV21OperatorDebuggerTakeoverFollowThrough["state"];
  latestRemediationExecutionStatus: "APPLIED" | "REVIEW_REQUIRED" | "BLOCKED" | null;
  summary: string;
  nextAction: string | null;
  boundaryNote: string;
};

export type HelmV21OperatorDebuggerRecoveryTransitionContractState =
  | "backfill_required"
  | "refresh_required"
  | "blocked"
  | "review_required"
  | "transition_ready"
  | "transition_pending"
  | "transition_active"
  | "transition_resolved"
  | "observe";

export type HelmV21OperatorDebuggerRecoveryTransitionContract = {
  state: HelmV21OperatorDebuggerRecoveryTransitionContractState;
  driver: HelmV21OperatorDebuggerRecoveryLifecycleContractDriver;
  laneState: HelmV21OperatorDebuggerRecoveryLifecycleContract["state"];
  anchor: HelmV21OperatorDebuggerRecoveryLifecycleContractAnchor;
  action: "SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT" | null;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  transition: HelmV21OperatorDebuggerRecoveryLifecycleContractTransition;
  traceContractState: HelmV21OperatorDebuggerTraceContract["state"];
  writeContractState: HelmV21OperatorDebuggerWriteContract["state"];
  recoveryActionState: HelmV21OperatorDebuggerRecoveryActionContract["state"];
  recoveryLifecycleState: HelmV21OperatorDebuggerRecoveryLifecycleContract["state"];
  takeoverRequestState: HelmV21OperatorDebuggerTakeoverRequest["state"];
  takeoverActivationState: HelmV21OperatorDebuggerTakeoverActivation["state"];
  takeoverFollowThroughState: HelmV21OperatorDebuggerTakeoverFollowThrough["state"];
  latestRemediationExecutionStatus: "APPLIED" | "REVIEW_REQUIRED" | "BLOCKED" | null;
  summary: string;
  nextAction: string | null;
  boundaryNote: string;
};

export type HelmV21OperatorDebuggerRecoveryStateMachinePhase =
  | "materialization"
  | "review"
  | "takeover_request"
  | "takeover_activation"
  | "takeover_followthrough"
  | "observe";

export type HelmV21OperatorDebuggerRecoveryStateMachineTransitionState =
  | "required"
  | "blocked"
  | "ready"
  | "pending"
  | "active"
  | "resolved"
  | "observe";

export type HelmV21OperatorDebuggerRecoveryStateMachineContract = {
  phase: HelmV21OperatorDebuggerRecoveryStateMachinePhase;
  transitionState: HelmV21OperatorDebuggerRecoveryStateMachineTransitionState;
  currentTransition: HelmV21OperatorDebuggerRecoveryLifecycleContractTransition;
  allowedTransitions: HelmV21OperatorDebuggerRecoveryLifecycleContractTransition[];
  completedTransitions: HelmV21OperatorDebuggerRecoveryLifecycleContractTransition[];
  driver: HelmV21OperatorDebuggerRecoveryLifecycleContractDriver;
  anchor: HelmV21OperatorDebuggerRecoveryLifecycleContractAnchor;
  action: "SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT" | null;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  traceContractState: HelmV21OperatorDebuggerTraceContract["state"];
  writeContractState: HelmV21OperatorDebuggerWriteContract["state"];
  recoveryActionState: HelmV21OperatorDebuggerRecoveryActionContract["state"];
  recoveryLifecycleState: HelmV21OperatorDebuggerRecoveryLifecycleContract["state"];
  recoveryTransitionState: HelmV21OperatorDebuggerRecoveryTransitionContract["state"];
  takeoverRequestState: HelmV21OperatorDebuggerTakeoverRequest["state"];
  takeoverActivationState: HelmV21OperatorDebuggerTakeoverActivation["state"];
  takeoverFollowThroughState: HelmV21OperatorDebuggerTakeoverFollowThrough["state"];
  latestRemediationExecutionStatus: "APPLIED" | "REVIEW_REQUIRED" | "BLOCKED" | null;
  summary: string;
  nextAction: string | null;
  boundaryNote: string;
};

export type HelmV21OperatorDebuggerRecoveryExecutionContractState =
  | "backfill_required"
  | "refresh_required"
  | "review_required"
  | "blocked"
  | "executable"
  | "pending"
  | "active"
  | "applied"
  | "observe";

export type HelmV21OperatorDebuggerRecoveryExecutionContract = {
  state: HelmV21OperatorDebuggerRecoveryExecutionContractState;
  phase: HelmV21OperatorDebuggerRecoveryStateMachinePhase;
  driver: HelmV21OperatorDebuggerRecoveryLifecycleContractDriver;
  anchor: HelmV21OperatorDebuggerRecoveryLifecycleContractAnchor;
  action: "SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT" | null;
  currentTransition: HelmV21OperatorDebuggerRecoveryLifecycleContractTransition;
  transitionState: HelmV21OperatorDebuggerRecoveryStateMachineTransitionState;
  canExecute: boolean;
  requiresReview: boolean;
  currentOwner: string | null;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  traceContractState: HelmV21OperatorDebuggerTraceContract["state"];
  writeContractState: HelmV21OperatorDebuggerWriteContract["state"];
  recoveryActionState: HelmV21OperatorDebuggerRecoveryActionContract["state"];
  recoveryLifecycleState: HelmV21OperatorDebuggerRecoveryLifecycleContract["state"];
  recoveryTransitionState: HelmV21OperatorDebuggerRecoveryTransitionContract["state"];
  latestRemediationExecutionStatus: "APPLIED" | "REVIEW_REQUIRED" | "BLOCKED" | null;
  prerequisites: string[];
  completionCriteria: string[];
  summary: string;
  nextAction: string | null;
  boundaryNote: string;
};

export type HelmV21OperatorDebuggerRecoveryExecutionGuardMove =
  | "request_human_input"
  | "acknowledge_human_input"
  | "request_takeover"
  | "acknowledge_takeover"
  | "start_takeover"
  | "release_takeover"
  | "request_followthrough"
  | "resolve_followthrough";

export type HelmV21OperatorDebuggerRecoveryExecutionGuardState = "allowed" | "reused" | "blocked";

export type HelmV21OperatorDebuggerRecoveryExecutionGuardContract = {
  move: HelmV21OperatorDebuggerRecoveryExecutionGuardMove;
  state: HelmV21OperatorDebuggerRecoveryExecutionGuardState;
  driver: HelmV21OperatorDebuggerRecoveryExecutionContract["driver"];
  anchor: HelmV21OperatorDebuggerRecoveryExecutionContract["anchor"];
  action: HelmV21OperatorDebuggerRecoveryExecutionContract["action"];
  executionState: HelmV21OperatorDebuggerRecoveryExecutionContract["state"];
  currentTransition: HelmV21OperatorDebuggerRecoveryExecutionContract["currentTransition"];
  expectedTransition: HelmV21OperatorDebuggerRecoveryLifecycleContractTransition;
  canExecute: boolean;
  requiresReview: boolean;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  humanInputRequestState: HelmV21HumanInputCheckpointRequest["state"];
  takeoverRequestState: HelmV21OperatorDebuggerTakeoverRequest["state"];
  takeoverActivationState: HelmV21OperatorDebuggerTakeoverActivation["state"];
  takeoverFollowThroughState: HelmV21OperatorDebuggerTakeoverFollowThrough["state"];
  missingRequirements: string[];
  summary: string;
  reason: string;
  nextAction: string | null;
  boundaryNote: string;
};

export type HelmV21OperatorDebuggerTakeoverPosture =
  | "resume_ready"
  | "checkpoint_ready"
  | "reprune_ready"
  | "review_required"
  | "blocked"
  | "observe_only";

export type HelmV21OperatorDebuggerTakeoverAssistance = {
  posture: HelmV21OperatorDebuggerTakeoverPosture;
  recommendedAction: "SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT" | null;
  summary: string;
  checklist: string[];
  boundaryNote: string;
};

export type HelmV21OperatorDebuggerTakeoverRequestState =
  | "not_requestable"
  | "requestable"
  | "requested"
  | "acknowledged";

export type HelmV21OperatorDebuggerTakeoverActivationState = "inactive" | "active" | "released";

export type HelmV21OperatorDebuggerTakeoverFollowThroughState =
  | "not_requestable"
  | "requestable"
  | "open"
  | "resolved";

export type HelmV21OperatorDebuggerTakeoverRequest = {
  state: HelmV21OperatorDebuggerTakeoverRequestState;
  requestEventId: string | null;
  acknowledgementEventId: string | null;
  action: "SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT" | null;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  requestedAt: Date | null;
  requestedBy: string | null;
  sourcePage: string | null;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
  summary: string;
  boundaryNote: string;
};

export type HelmV21OperatorDebuggerTakeoverActivation = {
  state: HelmV21OperatorDebuggerTakeoverActivationState;
  startEventId: string | null;
  releaseEventId: string | null;
  requestEventId: string | null;
  acknowledgementEventId: string | null;
  action: "SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT" | null;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  currentOwner: string | null;
  latestEventKind: "none" | "started" | "released";
  startedAt: Date | null;
  startedBy: string | null;
  releasedAt: Date | null;
  releasedBy: string | null;
  releaseReason: string | null;
  sourcePage: string | null;
  summary: string;
  boundaryNote: string;
};

export type HelmV21OperatorDebuggerTakeoverFollowThrough = {
  state: HelmV21OperatorDebuggerTakeoverFollowThroughState;
  requestEventId: string | null;
  resolutionEventId: string | null;
  takeoverRequestEventId: string | null;
  acknowledgementEventId: string | null;
  startEventId: string | null;
  releaseEventId: string | null;
  action: "SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT" | null;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  currentOwner: string | null;
  summary: string;
  nextAction: string | null;
  requestedAt: Date | null;
  requestedBy: string | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  sourcePage: string | null;
  boundaryNote: string;
};

export type HelmV21InterruptReasonState = "clear" | "attention" | "blocked" | "closed";

export type HelmV21InterruptReasonCode =
  | "none"
  | "review_required"
  | "verification_blocked"
  | "no_recovery_anchor"
  | "budget_pressure"
  | "payload_state_drift"
  | "replay_drift"
  | "protected_state_gap"
  | "run_failed"
  | "run_aborted"
  | "run_completed";

export type HelmV21InterruptReason = {
  state: HelmV21InterruptReasonState;
  code: HelmV21InterruptReasonCode;
  source: "recovery" | "verification" | "run_status";
  summary: string;
  boundaryNote: string;
};

export type HelmV21ResumeAskMode =
  | "none"
  | "resume_checkpoint"
  | "save_recovery_checkpoint"
  | "reprune_context"
  | "provide_human_input"
  | "review_before_resume"
  | "rerun_session";

export type HelmV21ResumeAsk = {
  mode: HelmV21ResumeAskMode;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  prompt: string;
  boundaryNote: string;
};

export type HelmV21HumanInputCheckpointRequestState =
  | "not_requestable"
  | "requestable"
  | "requested"
  | "acknowledged";

export type HelmV21HumanInputCheckpointRequest = {
  state: HelmV21HumanInputCheckpointRequestState;
  requestEventId: string | null;
  acknowledgementEventId: string | null;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  prompt: string;
  requestedAt: Date | null;
  requestedBy: string | null;
  sourcePage: string | null;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
  summary: string;
  boundaryNote: string;
};

export type HelmV21HandoffPayloadState = "not_available" | "ready";

export type HelmV21HandoffPayloadSkeleton = {
  state: HelmV21HandoffPayloadState;
  handoffId: string | null;
  packetKey: string | null;
  fromAgent: HelmV2AgentId | null;
  toAgent: HelmV2AgentId | null;
  goal: string;
  objectRefs: HelmV2ObjectRefs | null;
  checkpointId: string | null;
  checkpointKey: string | null;
  notebookRef: string | null;
  constraints: string[];
  trustBoundary: {
    trusted: string[];
    untrusted: string[];
  };
  requiredOutputs: string[];
  evidenceRefs: string[];
  approvalTier: HelmV2ApprovalTier | null;
  createdAt: Date | null;
  summary: string;
  boundaryNote: string;
};

export type HelmV21RuntimePostureSnapshot = {
  runThread: {
    runId: string;
    threadId: string;
    lifecycle: HelmV21RunThreadLifecycleState;
    checkpointKey: string | null;
    resumeState: HelmV21RunThreadResumeState;
    resumeToken: string | null;
    humanInputCheckpointState: HelmV21RunThreadHumanInputCheckpointState;
  };
  interruptReason: {
    state: HelmV21InterruptReasonState;
    code: HelmV21InterruptReasonCode;
    source: HelmV21InterruptReason["source"];
  };
  resumeAsk: {
    mode: HelmV21ResumeAskMode;
    checkpointKey: string | null;
    resumeToken: string | null;
  };
  handoffPayload: {
    state: HelmV21HandoffPayloadState;
    handoffId: string | null;
    packetKey: string | null;
    fromAgent: HelmV2AgentId | null;
    toAgent: HelmV2AgentId | null;
    checkpointKey: string | null;
    approvalTier: HelmV2ApprovalTier | null;
  };
};

export type HelmV21ProjectSkillEnvironmentSeamKind =
  | "workspace_context"
  | "connector"
  | "browser"
  | "control_plane"
  | "official_action";

export type HelmV21ProjectSkillEnvironmentSeamState = "active" | "planned_boundary_only";

export type HelmV21ProjectSkillEnvironmentSeam = {
  seamId: string;
  seamKind: HelmV21ProjectSkillEnvironmentSeamKind;
  state: HelmV21ProjectSkillEnvironmentSeamState;
  label: string;
  summary: string;
  boundaryNote: string;
  resourceIds: string[];
  resourceTypes: string[];
  providers: string[];
  authModes: string[];
  invocationModes: string[];
  effectModes: string[];
};

export type HelmV21ProjectSkillLibraryWorkerRef = {
  workerId: string;
  workerName: string;
  workerRole: string;
  assignmentMode: "default" | "optional";
  reviewMode: string;
  outputMode: string;
};

export type HelmV21ProjectSkillLibraryFlowRef = {
  flowId: string;
  scenarioType: string;
  outputMode: string;
  controlPlaneChecks: string[];
};

export type HelmV21ProjectSkillLibraryResourceRef = {
  bindingId: string;
  resourceId: string;
  resourceName: string;
  resourceType: string;
  resourceSummary: string;
  provider: string;
  resourceCapability: string;
  authMode: string;
  invocationMode: string;
  effectMode: string;
  fallback: boolean;
  seamId: string;
  seamKind: HelmV21ProjectSkillEnvironmentSeamKind;
};

export type HelmV21ProjectSkillLibraryCapabilitySignal = {
  id: string;
  name: string;
  stage: string;
  description: string;
  loadPolicy: string;
  reviewRequired: boolean;
  boundaryNote: string;
};

export type HelmV21ProjectSkillLibraryEntry = {
  skillId: string;
  skillName: string;
  skillType: string;
  riskLevel: string;
  effectMode: string;
  requiresReview: boolean;
  requiresApproval: boolean;
  customerFacingAllowed: boolean;
  nonCommitmentOnly: boolean;
  workerRefs: HelmV21ProjectSkillLibraryWorkerRef[];
  flowRefs: HelmV21ProjectSkillLibraryFlowRef[];
  resourceRefs: HelmV21ProjectSkillLibraryResourceRef[];
  environmentSeamIds: string[];
  environmentSummary: string;
  boundaryNote: string;
};

export type HelmV21ProjectSkillLibraryReadModel = {
  contractBundle: "worker_skill_resource_sprint_2";
  boundaryNote: string;
  summary: {
    workerCount: number;
    skillCount: number;
    resourceCount: number;
    flowCount: number;
    activeEnvironmentSeams: number;
    boundaryOnlyEnvironmentSeams: number;
    customerFacingSkills: number;
    approvalRequiredSkills: number;
    liveCapabilitySignals: number;
  };
  environmentSeams: HelmV21ProjectSkillEnvironmentSeam[];
  skillEntries: HelmV21ProjectSkillLibraryEntry[];
  liveCapabilitySignals: HelmV21ProjectSkillLibraryCapabilitySignal[];
};

export type HelmV21EnvironmentContractRuntimePosture =
  | "available"
  | "connected"
  | "partially_connected"
  | "review_gated"
  | "boundary_only";

export type HelmV21EnvironmentContractProviderRef = {
  id: string;
  label: string;
  status: string;
  detail: string;
  updatedAt: Date | null;
};

export type HelmV21EnvironmentExecutionSeamPosture =
  | "boundary_only"
  | "review_gated"
  | "awaiting_acknowledgement"
  | "acknowledged"
  | "failed"
  | "deferred"
  | "follow_through_open"
  | "follow_through_resolved";

export type HelmV21EnvironmentExecutionSeamSource =
  | "guarded_write"
  | "limited_auto"
  | "follow_through";

export type HelmV21EnvironmentExecutionAuthorityPosture =
  | "boundary_only"
  | "manual_only"
  | "review_gated"
  | "narrow_limited_auto";

export type HelmV21EnvironmentExecutionAuthoritySource =
  | "human_execution"
  | "guarded_write"
  | "limited_auto"
  | "follow_through";

export type HelmV21EnvironmentExecutionAuthoritySourceEntry = {
  source: HelmV21EnvironmentExecutionAuthoritySource;
  posture: HelmV21EnvironmentExecutionAuthorityPosture;
  summary: string;
  boundaryNote: string;
  liveReferenceCount: number;
};

export type HelmV21EnvironmentExecutionSeamReadModel = {
  posture: HelmV21EnvironmentExecutionSeamPosture;
  summary: string;
  boundaryNote: string;
  latestSource: HelmV21EnvironmentExecutionSeamSource | null;
  latestReferenceId: string | null;
  latestSummary: string | null;
  latestUpdatedAt: Date | null;
  counts: {
    officialWritesPending: number;
    officialWritesAcknowledged: number;
    officialWritesFailed: number;
    officialWritesDeferred: number;
    followThroughOpen: number;
    followThroughResolved: number;
  };
};

export type HelmV21EnvironmentExecutionAuthorityReadModel = {
  posture: HelmV21EnvironmentExecutionAuthorityPosture;
  summary: string;
  boundaryNote: string;
  sourceEntries: HelmV21EnvironmentExecutionAuthoritySourceEntry[];
  counts: {
    humanExecutionManualOnly: number;
    guardedWriteReviewGated: number;
    limitedAutoEligible: number;
    limitedAutoManualOnly: number;
    limitedAutoBlocked: number;
    limitedAutoDeferred: number;
    followThroughVisible: number;
  };
};

export type HelmV21EnvironmentContractSeam = {
  seamId: string;
  seamKind: HelmV21ProjectSkillEnvironmentSeamKind;
  contractState: HelmV21ProjectSkillEnvironmentSeamState;
  runtimePosture: HelmV21EnvironmentContractRuntimePosture;
  summary: string;
  boundaryNote: string;
  liveReferenceCount: number;
  providers: HelmV21EnvironmentContractProviderRef[];
};

export type HelmV21EnvironmentContractReadModel = {
  boundaryNote: string;
  summary: {
    seamCount: number;
    activeConnectorCount: number;
    connectedConnectorCount: number;
    activeBrowserSeams: number;
    reviewGatedOfficialActions: number;
    liveOfficialFollowThrough: number;
  };
  executionSeam: HelmV21EnvironmentExecutionSeamReadModel;
  executionAuthority: HelmV21EnvironmentExecutionAuthorityReadModel;
  seams: HelmV21EnvironmentContractSeam[];
};

export type HelmV21BenchmarkMatrixLayerId =
  | "runtime_eval"
  | "adapter_conformance"
  | "boundary_regression"
  | "operator_usability";

export type HelmV21BenchmarkGateRecordedStatus = "pass" | "warning" | "fail";

export type HelmV21BenchmarkGateOutcomeStatus =
  | "not_recorded"
  | HelmV21BenchmarkGateRecordedStatus;

export type HelmV21BenchmarkRecordedGateOutcome = {
  layerId: HelmV21BenchmarkMatrixLayerId;
  gateId: string;
  status: HelmV21BenchmarkGateRecordedStatus;
  summary: string;
  evidenceRefs: string[];
};

export type HelmV21BenchmarkRecordedRun = {
  benchmarkRunId: string;
  runLabel: string | null;
  commandSource: string | null;
  notes: string | null;
  recordedAt: Date;
  recordedBy: string;
  sourcePage: string | null;
  outcomes: HelmV21BenchmarkRecordedGateOutcome[];
};

export type HelmV21BenchmarkExecutionWorkflowState =
  | "idle"
  | "requested"
  | "recorded"
  | "acknowledged"
  | "follow_through_open"
  | "follow_through_resolved";

export type HelmV21BenchmarkExecutionRequestState =
  | "not_requested"
  | "requested"
  | "fulfilled";

export type HelmV21BenchmarkExecutionAcknowledgementState =
  | "not_available"
  | "recorded"
  | "acknowledged";

export type HelmV21BenchmarkExecutionFollowThroughState =
  | "not_requested"
  | "open"
  | "resolved";

export type HelmV21BenchmarkExecutionRequest = {
  state: HelmV21BenchmarkExecutionRequestState;
  requestEventId: string | null;
  requestKey: string | null;
  requestedLayerIds: HelmV21BenchmarkMatrixLayerId[];
  requestedGateIds: string[];
  summary: string;
  requestedAt: Date | null;
  requestedBy: string | null;
  sourcePage: string | null;
  commandSource: string | null;
  boundaryNote: string;
};

export type HelmV21BenchmarkExecutionLatestRun = {
  state: "not_recorded" | "recorded";
  runtimeEventId: string | null;
  benchmarkRunId: string | null;
  runLabel: string | null;
  summary: string;
  outcomeCount: number;
  counts: {
    pass: number;
    warning: number;
    fail: number;
  };
  recordedAt: Date | null;
  recordedBy: string | null;
  sourcePage: string | null;
  commandSource: string | null;
  notes: string | null;
  boundaryNote: string;
};

export type HelmV21BenchmarkExecutionAcknowledgement = {
  state: HelmV21BenchmarkExecutionAcknowledgementState;
  acknowledgementEventId: string | null;
  benchmarkRunId: string | null;
  requestEventId: string | null;
  runLabel: string | null;
  summary: string;
  recordedAt: Date | null;
  recordedBy: string | null;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
  sourcePage: string | null;
  commandSource: string | null;
  boundaryNote: string;
};

export type HelmV21BenchmarkExecutionFollowThrough = {
  state: HelmV21BenchmarkExecutionFollowThroughState;
  requestEventId: string | null;
  resolutionEventId: string | null;
  benchmarkRunId: string | null;
  acknowledgementEventId: string | null;
  runLabel: string | null;
  summary: string;
  nextAction: string | null;
  requestedAt: Date | null;
  requestedBy: string | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  sourcePage: string | null;
  commandSource: string | null;
  boundaryNote: string;
};

export type HelmV21BenchmarkExecutionWorkflowReadModel = {
  state: HelmV21BenchmarkExecutionWorkflowState;
  summary: string;
  boundaryNote: string;
  pendingRequestCount: number;
  acknowledgedRunCount: number;
  latestRequestedAt: Date | null;
  latestRecordedAt: Date | null;
  latestAcknowledgedAt: Date | null;
  latestFollowThroughAt: Date | null;
  request: HelmV21BenchmarkExecutionRequest;
  latestRun: HelmV21BenchmarkExecutionLatestRun;
  acknowledgement: HelmV21BenchmarkExecutionAcknowledgement;
  followThrough: HelmV21BenchmarkExecutionFollowThrough;
};

export type HelmV21BenchmarkGateLatestOutcome = {
  status: HelmV21BenchmarkGateOutcomeStatus;
  benchmarkRunId: string | null;
  runLabel: string | null;
  summary: string;
  evidenceRefs: string[];
  recordedAt: Date | null;
  recordedBy: string | null;
  sourcePage: string | null;
  commandSource: string | null;
  notes: string | null;
};

export type HelmV21BenchmarkGate = {
  gateId: string;
  label: string;
  command: string;
  passCriterion: string;
  evidenceNote: string;
  latestOutcome: HelmV21BenchmarkGateLatestOutcome;
};

export type HelmV21BenchmarkMatrixLayer = {
  layerId: HelmV21BenchmarkMatrixLayerId;
  label: string;
  summary: string;
  outcomeStatus: HelmV21BenchmarkGateOutcomeStatus;
  recordedGateCount: number;
  latestRecordedAt: Date | null;
  gates: HelmV21BenchmarkGate[];
};

export type HelmV21BenchmarkMatrixReadModel = {
  boundaryNote: string;
  summary: {
    totalGates: number;
    recordedGates: number;
    passingGates: number;
    warningGates: number;
    failingGates: number;
    latestRecordedAt: Date | null;
  };
  workflow: HelmV21BenchmarkExecutionWorkflowReadModel;
  layers: HelmV21BenchmarkMatrixLayer[];
};

export type HelmV21RuntimeOperatorControlSummaryState =
  | "boundary_only"
  | "review_gated"
  | "execution_pending"
  | "execution_review"
  | "execution_follow_through"
  | "benchmark_requested"
  | "benchmark_review"
  | "benchmark_follow_through";

export type HelmV21RuntimeOperatorControlSummaryDriver =
  | "environment_authority"
  | "environment_execution"
  | "benchmark_workflow"
  | "steady_state";

export type HelmV21RuntimeOperatorControlSummary = {
  state: HelmV21RuntimeOperatorControlSummaryState;
  driver: HelmV21RuntimeOperatorControlSummaryDriver;
  authorityPosture: HelmV21EnvironmentExecutionAuthorityPosture;
  executionSeamPosture: HelmV21EnvironmentExecutionSeamReadModel["posture"];
  benchmarkWorkflowState: HelmV21BenchmarkExecutionWorkflowState;
  benchmarkFollowThroughState: HelmV21BenchmarkExecutionFollowThroughState;
  focusTitle: string | null;
  focusHref: string | null;
  summary: string;
  nextAction: string | null;
  latestUpdatedAt: Date | null;
  boundaryNote: string;
  counts: {
    pendingExecutionWrites: number;
    openExecutionFollowThrough: number;
    benchmarkPendingRequests: number;
    benchmarkRecordedGates: number;
    benchmarkWarningGates: number;
    benchmarkFailingGates: number;
    benchmarkAcknowledgedRuns: number;
  };
};

export type HelmV21RuntimeSwarmOperatorControlSurfaceState =
  | "boundary_only"
  | "control_ready"
  | "control_active";

export type HelmV21RuntimeSwarmOperatorControlSurfaceDriver =
  | "pause"
  | "resume"
  | "kill"
  | "fallback"
  | "steady_state";

export type HelmV21RuntimeSwarmOperatorControlState =
  | "unavailable"
  | "requestable"
  | "requested"
  | "active"
  | "ready"
  | "resolved";

export type HelmV21RuntimeSwarmOperatorControlBridge =
  | "human_input_checkpoint"
  | "checkpoint_resume"
  | "close_request"
  | "operator_takeover";

export type HelmV21RuntimeSwarmOperatorControlActionIntent =
  | "none"
  | "request_pause"
  | "resume_checkpoint"
  | "request_kill"
  | "request_fallback"
  | "start_fallback"
  | "release_fallback";

export type HelmV21RuntimeSwarmOperatorControl = {
  state: HelmV21RuntimeSwarmOperatorControlState;
  bridge: HelmV21RuntimeSwarmOperatorControlBridge;
  actionIntent: HelmV21RuntimeSwarmOperatorControlActionIntent;
  actionLabel: string | null;
  summary: string;
  nextAction: string | null;
  boundaryNote: string;
  checkpointId: string | null;
  checkpointKey: string | null;
};

export type HelmV21RuntimeSwarmOperatorControlSurface = {
  state: HelmV21RuntimeSwarmOperatorControlSurfaceState;
  driver: HelmV21RuntimeSwarmOperatorControlSurfaceDriver;
  focusSessionId: string | null;
  focusMeetingId: string | null;
  focusTitle: string | null;
  focusHref: string | null;
  focusCheckpointKey: string | null;
  focusBudgetPosture: HelmV21RunThreadSwarmSpawnBudgetEnvelope["budgetPosture"] | null;
  focusSpawnDenyReason: HelmV21RunThreadSwarmSpawnDenyReason | null;
  focusRepeatPatternStatus:
    | "NONE"
    | "REPEATED_BLOCKED_ACTION"
    | "REPEATED_REVIEW_REQUIRED"
    | "REPEATED_REPRUNE_LOOP"
    | "REPEATED_INEFFECTIVE_ACTION"
    | null;
  summary: string;
  nextAction: string | null;
  latestUpdatedAt: Date | null;
  boundaryNote: string;
  counts: {
    requestableThreads: number;
    activeThreads: number;
    boundaryOnlyThreads: number;
  };
  controls: {
    pause: HelmV21RuntimeSwarmOperatorControl;
    resume: HelmV21RuntimeSwarmOperatorControl;
    kill: HelmV21RuntimeSwarmOperatorControl;
    fallback: HelmV21RuntimeSwarmOperatorControl;
  };
};

export type HelmV21ConsolidationQueueAuditSummaryState =
  | "idle"
  | "queued"
  | "running"
  | "paused"
  | "candidate_ready"
  | "review_required";

export type HelmV21ConsolidationQueueAuditSummaryDriver =
  | "no_job"
  | "queued_job"
  | "running_job"
  | "paused_job"
  | "completed_job"
  | "failed_job";

export type HelmV21ConsolidationQueueAuditSummary = {
  state: HelmV21ConsolidationQueueAuditSummaryState;
  driver: HelmV21ConsolidationQueueAuditSummaryDriver;
  focusJobId: string | null;
  focusMeetingId: string | null;
  focusTitle: string | null;
  focusHref: string | null;
  summary: string;
  nextAction: string | null;
  rollbackSummary: string;
  boundaryNote: string;
  counts: {
    totalJobs: number;
    queuedJobs: number;
    runningJobs: number;
    pausedJobs: number;
    completedJobs: number;
    failedJobs: number;
  };
};

export type HelmV21RuntimeOperatorProgressSummaryState =
  | "takeover_active"
  | "takeover_requested"
  | "human_input_requested"
  | "operator_control_attention"
  | "close_attention"
  | "review_gated"
  | "steady_state";

export type HelmV21RuntimeOperatorProgressSummaryDriver =
  | "takeover_activation"
  | "request_posture"
  | "operator_control"
  | "close_posture"
  | "steady_state";

export type HelmV21RuntimeOperatorProgressSummary = {
  state: HelmV21RuntimeOperatorProgressSummaryState;
  driver: HelmV21RuntimeOperatorProgressSummaryDriver;
  requestTakeoverState: HelmV21RunThreadRequestPosture["takeoverState"];
  requestHumanInputState: HelmV21RunThreadRequestPosture["humanInputState"];
  takeoverActivationState: HelmV21OperatorDebuggerTakeoverActivationState;
  operatorControlState: HelmV21RuntimeOperatorControlSummaryState;
  closePostureState: HelmV21RunThreadClosePostureForwardSummaryState;
  currentOwner: string | null;
  summary: string;
  nextAction: string | null;
  latestUpdatedAt: Date | null;
  boundaryNote: string;
  counts: {
    activeRequests: number;
    pendingExecutionWrites: number;
    openExecutionFollowThrough: number;
    benchmarkPendingRequests: number;
    benchmarkFailingGates: number;
    benchmarkWarningGates: number;
    forwardAttention: number;
    openCloseout: number;
  };
};

export type HelmV21RuntimeOperatorActionSummaryState =
  | "acknowledge_takeover_request"
  | "capture_human_input"
  | "complete_takeover"
  | "acknowledge_execution"
  | "review_execution"
  | "resolve_execution_followthrough"
  | "run_benchmark"
  | "acknowledge_benchmark"
  | "resolve_benchmark_followthrough"
  | "advance_close"
  | "resolve_verification"
  | "review_promotion"
  | "review_reflection_candidate"
  | "watch_reflection_job"
  | "watch_consolidation_job"
  | "keep_review_gated"
  | "observe";

export type HelmV21RuntimeOperatorActionSummaryDriver =
  | "takeover_activation"
  | "request_posture"
  | "operator_control"
  | "close_posture"
  | "review_queue"
  | "steady_state";

export type HelmV21RuntimeOperatorActionSummary = {
  state: HelmV21RuntimeOperatorActionSummaryState;
  driver: HelmV21RuntimeOperatorActionSummaryDriver;
  progressState: HelmV21RuntimeOperatorProgressSummaryState;
  requestTakeoverState: HelmV21RunThreadRequestPosture["takeoverState"];
  requestHumanInputState: HelmV21RunThreadRequestPosture["humanInputState"];
  takeoverActivationState: HelmV21OperatorDebuggerTakeoverActivationState;
  operatorControlState: HelmV21RuntimeOperatorControlSummaryState;
  closePostureState: HelmV21RunThreadClosePostureForwardSummaryState;
  focusTitle: string | null;
  focusHref: string | null;
  checkpointKey: string | null;
  currentOwner: string | null;
  summary: string;
  nextAction: string | null;
  latestUpdatedAt: Date | null;
  boundaryNote: string;
};

export type HelmV21RuntimeOperatorWorkSummaryState =
  | "operating_gap_attention"
  | "continuity_attention"
  | "execution_attention"
  | "benchmark_attention"
  | "review_attention"
  | "review_gated"
  | "steady_state";

export type HelmV21RuntimeOperatorWorkSummaryDriver =
  | "operating_gap"
  | "operator_action"
  | "operator_control"
  | "review_queue"
  | "steady_state";

export type HelmV21RuntimeOperatorWorkSummary = {
  state: HelmV21RuntimeOperatorWorkSummaryState;
  driver: HelmV21RuntimeOperatorWorkSummaryDriver;
  actionState: HelmV21RuntimeOperatorActionSummaryState;
  controlState: HelmV21RuntimeOperatorControlSummaryState;
  reviewState: HelmV21RuntimeOperatorReviewSummaryState;
  reviewActionState: HelmV21RuntimeOperatorReviewActionSummaryState;
  focusTitle: string | null;
  focusHref: string | null;
  summary: string;
  nextAction: string | null;
  latestUpdatedAt: Date | null;
  boundaryNote: string;
  counts: {
    continuityAttention: number;
    reviewQueue: number;
    promotionQueue: number;
    reflectionCandidates: number;
    reflectionJobs: number;
    consolidationJobs: number;
    criticalOperatingGaps: number;
  };
};

export type HelmV21RuntimeOperatorCueSummaryState =
  | "operating_gap_attention"
  | "continuity_attention"
  | "control_attention"
  | "review_attention"
  | "review_gated"
  | "steady_state";

export type HelmV21RuntimeOperatorCueSummaryDriver =
  | "operator_work"
  | "operator_control"
  | "operator_review"
  | "steady_state";

export type HelmV21RuntimeOperatorCueSummary = {
  state: HelmV21RuntimeOperatorCueSummaryState;
  driver: HelmV21RuntimeOperatorCueSummaryDriver;
  workState: HelmV21RuntimeOperatorWorkSummaryState;
  actionState: HelmV21RuntimeOperatorActionSummaryState;
  controlState: HelmV21RuntimeOperatorControlSummaryState;
  reviewState: HelmV21RuntimeOperatorReviewSummaryState;
  reviewActionState: HelmV21RuntimeOperatorReviewActionSummaryState;
  focusTitle: string | null;
  focusHref: string | null;
  summary: string;
  nextAction: string | null;
  latestUpdatedAt: Date | null;
  boundaryNote: string;
  counts: {
    continuityAttention: number;
    reviewQueue: number;
    criticalOperatingGaps: number;
    pendingExecutionWrites: number;
    benchmarkPendingRequests: number;
  };
};

export type HelmV21RuntimeOperatorNextMoveSummaryState =
  | "resolve_operating_gap"
  | "advance_continuity"
  | HelmV21RuntimeOperatorActionSummaryState;

export type HelmV21RuntimeOperatorNextMoveSummaryDriver =
  | "operator_work"
  | "operator_action"
  | "operator_review"
  | "steady_state";

export type HelmV21RuntimeOperatorNextMoveSummary = {
  state: HelmV21RuntimeOperatorNextMoveSummaryState;
  driver: HelmV21RuntimeOperatorNextMoveSummaryDriver;
  cueState: HelmV21RuntimeOperatorCueSummaryState;
  workState: HelmV21RuntimeOperatorWorkSummaryState;
  actionState: HelmV21RuntimeOperatorActionSummaryState;
  reviewActionState: HelmV21RuntimeOperatorReviewActionSummaryState;
  focusTitle: string | null;
  focusHref: string | null;
  summary: string;
  nextAction: string | null;
  latestUpdatedAt: Date | null;
  boundaryNote: string;
};

export type HelmV21RuntimeOperatorActionCueSummaryState =
  | "resolve_operating_gap"
  | "advance_continuity"
  | "resolve_operator_control"
  | "resolve_workspace_review"
  | "keep_review_gated"
  | "observe";

export type HelmV21RuntimeOperatorActionCueSummaryDriver =
  | "operator_work"
  | "operator_control"
  | "operator_review"
  | "steady_state";

export type HelmV21RuntimeOperatorActionCueSummary = {
  state: HelmV21RuntimeOperatorActionCueSummaryState;
  driver: HelmV21RuntimeOperatorActionCueSummaryDriver;
  cueState: HelmV21RuntimeOperatorCueSummaryState;
  nextMoveState: HelmV21RuntimeOperatorNextMoveSummaryState;
  actionState: HelmV21RuntimeOperatorActionSummaryState;
  controlState: HelmV21RuntimeOperatorControlSummaryState;
  reviewActionState: HelmV21RuntimeOperatorReviewActionSummaryState;
  focusTitle: string | null;
  focusHref: string | null;
  summary: string;
  nextAction: string | null;
  latestUpdatedAt: Date | null;
  boundaryNote: string;
};

export type HelmV21RuntimeOperatorReviewControlCueSummaryState =
  | "control_priority"
  | "review_priority"
  | "review_gated"
  | "observe";

export type HelmV21RuntimeOperatorReviewControlCueSummaryDriver =
  | "operator_control"
  | "operator_review"
  | "steady_state";

export type HelmV21RuntimeOperatorReviewControlCueSummary = {
  state: HelmV21RuntimeOperatorReviewControlCueSummaryState;
  driver: HelmV21RuntimeOperatorReviewControlCueSummaryDriver;
  cueState: HelmV21RuntimeOperatorCueSummaryState;
  actionCueState: HelmV21RuntimeOperatorActionCueSummaryState;
  controlState: HelmV21RuntimeOperatorControlSummaryState;
  reviewState: HelmV21RuntimeOperatorReviewSummaryState;
  reviewActionState: HelmV21RuntimeOperatorReviewActionSummaryState;
  focusTitle: string | null;
  focusHref: string | null;
  summary: string;
  nextAction: string | null;
  latestUpdatedAt: Date | null;
  boundaryNote: string;
};

export type HelmV21RuntimeOperatorStartPointSummaryState =
  HelmV21RuntimeOperatorActionCueSummaryState;

export type HelmV21RuntimeOperatorStartPointSummaryDriver =
  HelmV21RuntimeOperatorActionCueSummaryDriver;

export type HelmV21RuntimeOperatorStartPointSummary = {
  state: HelmV21RuntimeOperatorStartPointSummaryState;
  driver: HelmV21RuntimeOperatorStartPointSummaryDriver;
  primaryState: HelmV21RuntimeOperatorActionCueSummaryState;
  primaryDriver: HelmV21RuntimeOperatorActionCueSummaryDriver;
  secondaryState: HelmV21RuntimeOperatorReviewControlCueSummaryState;
  secondaryDriver: HelmV21RuntimeOperatorReviewControlCueSummaryDriver;
  focusTitle: string | null;
  focusHref: string | null;
  secondaryFocusTitle: string | null;
  secondaryFocusHref: string | null;
  summary: string;
  nextAction: string | null;
  followupAction: string | null;
  latestUpdatedAt: Date | null;
  boundaryNote: string;
};

export type HelmV21RuntimeOperatorReviewSummaryState =
  | "verification_attention"
  | "promotion_attention"
  | "reflection_candidate_attention"
  | "reflection_job_attention"
  | "consolidation_job_attention"
  | "clear";

export type HelmV21RuntimeOperatorReviewSummaryDriver =
  | "verification_queue"
  | "promotion_queue"
  | "reflection_candidate_queue"
  | "reflection_job_queue"
  | "consolidation_job_queue"
  | "steady_state";

export type HelmV21RuntimeOperatorReviewSummary = {
  state: HelmV21RuntimeOperatorReviewSummaryState;
  driver: HelmV21RuntimeOperatorReviewSummaryDriver;
  focusTitle: string | null;
  focusHref: string | null;
  summary: string;
  nextAction: string | null;
  latestUpdatedAt: Date | null;
  boundaryNote: string;
  counts: {
    verificationQueue: number;
    promotionQueue: number;
    reflectionCandidates: number;
    reflectionJobs: number;
    consolidationJobs: number;
  };
};

export type HelmV21RuntimeOperatorReviewActionSummaryState =
  | "resolve_verification"
  | "review_promotion"
  | "review_reflection_candidate"
  | "watch_reflection_job"
  | "watch_consolidation_job"
  | "hold_review_gated";

export type HelmV21RuntimeOperatorReviewActionSummaryDriver =
  | "verification_queue"
  | "promotion_queue"
  | "reflection_candidate_queue"
  | "reflection_job_queue"
  | "consolidation_job_queue"
  | "steady_state";

export type HelmV21RuntimeOperatorReviewActionSummary = {
  state: HelmV21RuntimeOperatorReviewActionSummaryState;
  driver: HelmV21RuntimeOperatorReviewActionSummaryDriver;
  reviewState: HelmV21RuntimeOperatorReviewSummaryState;
  focusTitle: string | null;
  focusHref: string | null;
  summary: string;
  nextAction: string | null;
  latestUpdatedAt: Date | null;
  boundaryNote: string;
  counts: HelmV21RuntimeOperatorReviewSummary["counts"];
};

export type HelmV21OperatorDebuggerReadModel = {
  summary: string;
  boundaryNote: string;
  history: HelmV21OperatorDebuggerHistoryEntry[];
  variableSnapshot: HelmV21OperatorDebuggerVariableSnapshotEntry[];
  traceContract: HelmV21OperatorDebuggerTraceContract;
  writeContract: HelmV21OperatorDebuggerWriteContract;
  swarmSpawnContract: HelmV21OperatorDebuggerSwarmSpawnContract;
  swarmReadOnlyWorkerContract: HelmV21OperatorDebuggerSwarmReadOnlyWorkerContract;
  swarmVerificationMergeLaneContract: HelmV21OperatorDebuggerSwarmVerificationMergeLaneContract;
  recoveryActionContract: HelmV21OperatorDebuggerRecoveryActionContract;
  recoveryLifecycleContract: HelmV21OperatorDebuggerRecoveryLifecycleContract;
  recoveryTransitionContract: HelmV21OperatorDebuggerRecoveryTransitionContract;
  recoveryStateMachineContract: HelmV21OperatorDebuggerRecoveryStateMachineContract;
  recoveryExecutionContract: HelmV21OperatorDebuggerRecoveryExecutionContract;
  replayAssistance: HelmV21OperatorDebuggerReplayAssistance;
  persistedLifecycleTrace: HelmV21OperatorDebuggerPersistedLifecycleTrace;
  takeoverAssistance: HelmV21OperatorDebuggerTakeoverAssistance;
  takeoverRequest: HelmV21OperatorDebuggerTakeoverRequest;
  takeoverActivation: HelmV21OperatorDebuggerTakeoverActivation;
  takeoverFollowThrough: HelmV21OperatorDebuggerTakeoverFollowThrough;
  interruptReason: HelmV21InterruptReason;
  resumeAsk: HelmV21ResumeAsk;
  handoffPayload: HelmV21HandoffPayloadSkeleton;
  humanInputCheckpoint: HelmV21RunThreadHumanInputCheckpoint;
  humanInputRequest: HelmV21HumanInputCheckpointRequest;
};

export type HelmV21RunThreadPersistedControlPlaneLifecycleState =
  | "missing"
  | "synced"
  | "drifted"
  | "invalid";

export type HelmV21RunThreadPersistedControlPlaneLifecycleCompactionState =
  | "backfill_required"
  | "current"
  | "compacted"
  | "replace_required"
  | "invalid";

export type HelmV21RunThreadPersistedControlPlaneLifecycleCompactionPolicy = {
  slot: "runtime_session_single_snapshot";
  writeMode: "replace_on_material_state_change";
  refreshTriggers: Array<
    "control_plane_write" | "checkpoint_resume" | "continuity_checkpoint"
  >;
  state: HelmV21RunThreadPersistedControlPlaneLifecycleCompactionState;
  summary: string;
  nextAction: string | null;
};

export type HelmV21RunThreadPersistedControlPlaneLifecycleReconciliationState =
  | "backfill_required"
  | "steady"
  | "refresh_required"
  | "fallback_to_event_truth";

export type HelmV21RunThreadPersistedControlPlaneLifecycleReconciliationPolicy = {
  sourceOfTruth: "event_derived_run_thread";
  fallbackMode: "bounded_snapshot_with_event_truth_fallback";
  state: HelmV21RunThreadPersistedControlPlaneLifecycleReconciliationState;
  summary: string;
  nextAction: string | null;
};

export type HelmV21RunThreadPersistedControlPlaneLifecycleRepairState =
  | "not_required"
  | "backfill_on_next_refresh"
  | "rewrite_invalid_snapshot"
  | "rewrite_drifted_snapshot";

export type HelmV21RunThreadPersistedControlPlaneLifecycleRepairPolicy = {
  guardMode: "review_first_single_slot_rewrite_only";
  repairMode: "bounded_snapshot_rewrite_only";
  repairTriggers: Array<
    "control_plane_write" | "checkpoint_resume" | "continuity_checkpoint"
  >;
  state: HelmV21RunThreadPersistedControlPlaneLifecycleRepairState;
  summary: string;
  nextAction: string | null;
};

export type HelmV21RunThreadPersistedControlPlaneLifecycleGuardState =
  | "fallback_to_event_truth"
  | "backfill_required"
  | "rewrite_required"
  | "reuse_current_snapshot"
  | "reuse_compacted_snapshot";

export type HelmV21RunThreadPersistedControlPlaneLifecycleGuardPolicy = {
  runtimeReadMode: "event_truth_primary";
  snapshotMode: "runtime_session_single_snapshot";
  state: HelmV21RunThreadPersistedControlPlaneLifecycleGuardState;
  shouldReuseSnapshot: boolean;
  shouldPersistSnapshot: boolean;
  summary: string;
  nextAction: string | null;
};

export type HelmV21RunThreadPersistedControlPlaneLifecycleRefreshReason =
  | "control_event"
  | "meeting_ingest"
  | "continuity_checkpoint"
  | "verification_review"
  | "context_edit"
  | "checkpoint_resume";

export type HelmV21RunThreadPersistedControlPlaneLifecycleWriteAnchor =
  | "none"
  | "checkpoint"
  | "resume"
  | "replay"
  | "human_input";

export type HelmV21RunThreadPersistedControlPlaneLifecycleWriteSideState =
  | "not_persisted"
  | "refresh_required"
  | "thread_truth_written"
  | "checkpoint_anchor_written"
  | "resume_anchor_written"
  | "replay_anchor_written"
  | "human_input_anchor_written";

export type HelmV21RunThreadPersistedControlPlaneLifecycleWriteSide = {
  state: HelmV21RunThreadPersistedControlPlaneLifecycleWriteSideState;
  refreshReason: HelmV21RunThreadPersistedControlPlaneLifecycleRefreshReason | null;
  refreshSource: string | null;
  anchor: HelmV21RunThreadPersistedControlPlaneLifecycleWriteAnchor;
  checkpointKey: string | null;
  resumeToken: string | null;
  summary: string;
  nextAction: string | null;
};

export type HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot = {
  schemaVersion: "helm-v2-run-thread-control-plane-lifecycle-v1";
  persistedAt: Date;
  sourceUpdatedAt: Date;
  runId: string;
  threadId: string;
  stageKey: string;
  lifecycleState: HelmV21RunThreadLifecycleState;
  resumeState: HelmV21RunThreadResumeState;
  latestCheckpointState: HelmV21RunThreadCheckpoint["state"] | "not_available";
  latestCheckpointKey: string | null;
  latestCheckpointResumeToken: string | null;
  checkpointLineageDepth: number;
  replayRequestMode: HelmV21RunThreadReplayRequest["mode"];
  replayCheckpointKey: string | null;
  replayResumeToken: string | null;
  replayEventLogEntries: number;
  requestState: HelmV21RunThreadRequestPosture["takeoverState"];
  humanInputState: HelmV21RunThreadRequestPosture["humanInputState"];
  humanInputCheckpointState: HelmV21RunThreadHumanInputCheckpoint["state"];
  humanInputCheckpointKey: string | null;
  resultAcknowledgementState: HelmV21RunThreadResultAcknowledgement["state"];
  resultFlowState: HelmV21RunThreadResultFlow["latestState"];
  forwardFlowState: HelmV21RunThreadForwardFlow["state"];
  settlementReviewState: HelmV21RunThreadSettlementReview["state"];
  closeoutSummaryState: HelmV21RunThreadCloseoutSummary["state"];
  closeoutResolutionState: HelmV21RunThreadCloseoutResolution["state"];
  closeoutResolutionFollowThroughState: HelmV21RunThreadCloseoutResolutionFollowThrough["state"];
  closeoutOutcomeState: HelmV21RunThreadCloseoutOutcome["state"];
  closeRequestState: HelmV21RunThreadCloseRequest["state"];
  closeLifecycleState: HelmV21RunThreadCloseLifecycle["state"];
  closeControlState: HelmV21RunThreadCloseControl["state"];
  closeControlFlowState: HelmV21RunThreadCloseControlFlow["state"];
  closeDecisionFlowState: HelmV21RunThreadCloseDecisionFlow["state"];
  closeDecisionControlState: HelmV21RunThreadCloseDecisionControlSummary["state"];
  closeResolutionState: HelmV21RunThreadCloseResolutionSummary["state"];
  closeResolutionForwardState: HelmV21RunThreadCloseResolutionForwardSummary["state"];
  closeResolutionControlState: HelmV21RunThreadCloseResolutionControlSummary["state"];
  closePostureState: HelmV21RunThreadClosePostureSummary["state"];
  closePostureForwardState: HelmV21RunThreadClosePostureForwardSummary["state"];
  lastRefreshReason: HelmV21RunThreadPersistedControlPlaneLifecycleRefreshReason | null;
  lastRefreshSource: string | null;
  writeAnchor: HelmV21RunThreadPersistedControlPlaneLifecycleWriteAnchor;
  writeCheckpointKey: string | null;
  writeResumeToken: string | null;
};

export type HelmV21RunThreadPersistedControlPlaneLifecycle = {
  state: HelmV21RunThreadPersistedControlPlaneLifecycleState;
  persistedAt: Date | null;
  sourceUpdatedAt: Date | null;
  stageKey: string | null;
  summary: string;
  driftKeys: string[];
  guardPolicy: HelmV21RunThreadPersistedControlPlaneLifecycleGuardPolicy;
  compactionPolicy: HelmV21RunThreadPersistedControlPlaneLifecycleCompactionPolicy;
  reconciliationPolicy: HelmV21RunThreadPersistedControlPlaneLifecycleReconciliationPolicy;
  repairPolicy: HelmV21RunThreadPersistedControlPlaneLifecycleRepairPolicy;
  writeSide: HelmV21RunThreadPersistedControlPlaneLifecycleWriteSide;
  boundaryNote: string;
  snapshot: HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot | null;
};

export type HelmV21RunThreadContract = {
  runId: string;
  threadId: string;
  runStatus: HelmV21RuntimeSessionState;
  lifecycle: HelmV21RunThreadLifecycleState;
  stageKey: string;
  boundaryNote: string;
  sourcePage: string | null;
  objectRefs: {
    workspaceId: string;
    meetingId?: string | null;
    opportunityId?: string | null;
    companyId?: string | null;
  };
  latestCheckpoint: HelmV21RunThreadCheckpoint | null;
  resume: {
    state: HelmV21RunThreadResumeState;
    resumeToken: string | null;
    resumedFromCheckpointId: string | null;
    resumedFromCheckpointKey: string | null;
  };
  replay: {
    eventLogEntries: number;
    lastEventAt: string | null;
  };
  requestPosture: HelmV21RunThreadRequestPosture;
  resultAcknowledgement: HelmV21RunThreadResultAcknowledgement;
  resultFlow: HelmV21RunThreadResultFlow;
  forwardFlow: HelmV21RunThreadForwardFlow;
  closeoutFlow: HelmV21RunThreadCloseoutFlow;
  closeoutSummary: HelmV21RunThreadCloseoutSummary;
  closeoutResolution: HelmV21RunThreadCloseoutResolution;
  closeoutResolutionFollowThrough: HelmV21RunThreadCloseoutResolutionFollowThrough;
  closeoutOutcome: HelmV21RunThreadCloseoutOutcome;
  closeRequest: HelmV21RunThreadCloseRequest;
  closeLifecycle: HelmV21RunThreadCloseLifecycle;
  closeControl: HelmV21RunThreadCloseControl;
  closeControlFlow: HelmV21RunThreadCloseControlFlow;
  closeDecisionFlow: HelmV21RunThreadCloseDecisionFlow;
  closeDecisionControlSummary: HelmV21RunThreadCloseDecisionControlSummary;
  closeResolutionSummary: HelmV21RunThreadCloseResolutionSummary;
  closeResolutionForwardSummary: HelmV21RunThreadCloseResolutionForwardSummary;
  closeResolutionControlSummary: HelmV21RunThreadCloseResolutionControlSummary;
  closePostureSummary: HelmV21RunThreadClosePostureSummary;
  closePostureForwardSummary: HelmV21RunThreadClosePostureForwardSummary;
  settlementReview: HelmV21RunThreadSettlementReview;
  closeoutConfirmation: HelmV21RunThreadCloseoutConfirmation;
  closeoutRefresh: HelmV21RunThreadCloseoutRefresh;
  settlementFlow: HelmV21RunThreadSettlementFlow;
  persistedControlPlaneLifecycle: HelmV21RunThreadPersistedControlPlaneLifecycle;
  lifecycleLog: HelmV21RunThreadLifecycleEntry[];
  checkpointLineage: HelmV21RunThreadCheckpointLineageEntry[];
  replayRequest: HelmV21RunThreadReplayRequest;
  humanInputCheckpoint: HelmV21RunThreadHumanInputCheckpoint;
  swarmSpawnBudgetEnvelope: HelmV21RunThreadSwarmSpawnBudgetEnvelope;
  swarmSpawnRequest: HelmV21RunThreadSwarmSpawnRequest;
  swarmSpawnContract: HelmV21RunThreadSwarmSpawnContract;
  swarmReadOnlyWorkerContract: HelmV21RunThreadSwarmReadOnlyWorkerContract;
  swarmVerificationMergeLaneContract: HelmV21RunThreadSwarmVerificationMergeLaneContract;
  startedAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
};

export type HelmV21MemoryCandidateState =
  | "pending_verification"
  | "verified"
  | "deferred"
  | "rejected"
  | "promoted";

export type HelmV21MemoryPromotionState = "promoted" | "rejected" | "deferred";

export type HelmV21VerificationStatus = "passed" | "needs_review" | "blocked";

export type HelmV21TruthConflictState = "open" | "resolved" | "suppressed";

export type HelmV21ProblemSpaceState =
  | "detected"
  | "scoped"
  | "open"
  | "assigned"
  | "active"
  | "blocked"
  | "watching"
  | "waiting_on_signal"
  | "waiting_on_authority"
  | "resolved"
  | "retired";

export type HelmV21EdgeBriefAudience = "IC" | "DRI" | "PLAYER_COACH";

export type HelmV21CompositionFailureClass =
  | "CONTEXT_MISS"
  | "TOOL_MISS"
  | "POLICY_BLOCK"
  | "VERIFICATION_FAIL"
  | "BUDGET_EXHAUSTED"
  | "AUTHORITY_GAP"
  | "SIGNAL_GAP"
  | "CONFIDENCE_GAP";

export type HelmV21CoordinationOutcome =
  | "action_ready"
  | "review_needed"
  | "waiting_on_signal"
  | "waiting_on_authority"
  | "capability_gap";

export type HelmV21InitiativeRunState =
  | "detected"
  | "active"
  | "waiting_on_signal"
  | "waiting_on_authority"
  | "capability_gap"
  | "resolved"
  | "retired";

export type HelmV21HandoffPacket = {
  handoffId: string;
  fromAgent: HelmV2AgentId;
  toAgent: HelmV2AgentId;
  goal: string;
  objectRefs: HelmV2ObjectRefs;
  constraints: string[];
  trustBoundary: {
    trusted: string[];
    untrusted: string[];
  };
  requiredOutputs: string[];
  evidenceRefs: string[];
  notebookRef?: string | null;
  checkpointRef?: string | null;
  approvalTier: HelmV2ApprovalTier;
};

export type HelmV21PersistedPayload = {
  payloadKey: string;
  handle: string;
  sourceType: HelmV2SourceType | "artifact" | "session_notebook" | "signal_event";
  sourceId: string;
  label: string;
  loadPolicy: "always_on" | "stage_triggered" | "on_demand" | "never_auto_load";
  preview: string;
  summary: string;
  byteSize: number;
  estimatedTokens: number;
  loadedByDefault: boolean;
};

export type HelmV21PromptBudgetDecision = {
  tokenBudgetLimit: number;
  tokenBudgetUsed: number;
  prunedTokenCount: number;
  loadedHandles: string[];
  prunedHandles: string[];
  reasoning: string;
};

export type HelmV21VerificationDecision = {
  status: HelmV21VerificationStatus;
  truthScore: number;
  summary: string;
  blockedReasons: string[];
  boundaryNotes: string[];
};

export type HelmV21ProblemSpaceDraft = {
  problemKey: string;
  title: string;
  summary: string;
  nextStep: string;
  ownerHint?: string | null;
  evidenceRefs: string[];
};

export type HelmV2ActionKey =
  | "meeting.parse"
  | "memory.write_draft"
  | "opportunity.shadow_update"
  | "email.create_draft"
  | "calendar.create_draft"
  | "crm.update_official_stage"
  | "crm.update_next_action"
  | "crm.update_blockers"
  | "crm.attach_note"
  | "crm.attach_handoff_summary"
  | "email.send_external"
  | "quote.create"
  | "approval.submit"
  | "contract.modify"
  | "customer_commit_delivery_date";

export type HelmV2EventType =
  | "meeting.ended"
  | "meeting.facts_created"
  | "meeting-ended.ingest"
  | "meeting-artifact.persisted"
  | "opportunity.delta_created"
  | "proposal.requested"
  | "followup.requested"
  | "draft.created"
  | "signal.ingested"
  | "truth-conflict.detected"
  | "world-model.updated"
  | "problem-space.created"
  | "dri.assigned"
  | "edge-brief.generated"
  | "composition.failed"
  | "session-notebook.updated"
  | "context-edit.applied"
  | "session-compaction.requested"
  | "session-checkpoint.created"
  | "memory-candidate.created"
  | "memory-promotion.approved"
  | "verification.failed"
  | "approval.requested"
  | "approval.denied_continue"
  | "approval.resolved"
  | "consolidation.job.started"
  | "consolidation.job.proposed"
  | "handoff.packet.created"
  | "swarm.spawn.requested"
  | "operator.takeover.requested"
  | "operator.takeover.acknowledged"
  | "operator.takeover.started"
  | "operator.takeover.released"
  | "human-input.checkpoint.requested"
  | "human-input.checkpoint.acknowledged"
  | "benchmark.matrix.run.requested"
  | "benchmark.matrix.run.recorded"
  | "benchmark.matrix.run.acknowledged"
  | "benchmark.matrix.run.followthrough.requested"
  | "benchmark.matrix.run.followthrough.resolved"
  | "handoff.requested"
  | "handoff.created"
  | "official.write_intent_created"
  | "official.write_attempted"
  | "official.write_acknowledged"
  | "official.write_limited_auto_synced"
  | "official.write_limited_auto_attempted"
  | "official.write_limited_auto_acknowledged";

export type HelmV2HumanActionExecutionType =
  | "manual_email_send"
  | "manual_calendar_send"
  | "manual_customer_followup"
  | "manual_internal_collab"
  | "manual_exec_brief_share"
  | "manual_crm_step"
  | "manual_handoff_delivery"
  | "manual_handoff_customer_success";

export type HelmV2HumanActionExecutionProofType =
  | "manual_sent"
  | "manual_scheduled"
  | "manual_shared_internal"
  | "manual_crm_step_done"
  | "manual_handoff_done"
  | "blocked"
  | "deferred";

export type HelmV2HumanActionExecutionWritebackTarget =
  | "audit_trail"
  | "object_summary"
  | "checkpoint_memory"
  | "role_handoff_summary";

export type HelmV2HumanActionExecutionContract = {
  actionType: HelmV2HumanActionExecutionType;
  executionSourceArtifact: string;
  executionOwner?: string | null;
  executionIntent: string;
  executionBoundary: string;
  executionPrerequisite?: string | null;
  executionDependency?: string | null;
  executionRiskLevel: "low" | "medium" | "high" | "critical";
  executionAcknowledgementStatus: "pending" | "acknowledged" | "blocked" | "deferred";
  executionProofType?: HelmV2HumanActionExecutionProofType | null;
  executionProofPayload?: Record<string, unknown> | null;
  executionWritebackTarget: HelmV2HumanActionExecutionWritebackTarget[];
};

export type HelmV2OfficialWriteActionType =
  | "crm.update_official_stage"
  | "crm.update_next_action"
  | "crm.update_blockers"
  | "crm.attach_note"
  | "crm.attach_handoff_summary";

export type HelmV2OfficialWriteContract = {
  officialWriteIntentId?: string;
  officialSystemType: "crm";
  officialObjectRef: string;
  sourceShadowRef?: string | null;
  sourceExecutionProofRef?: string | null;
  writeActionType: HelmV2OfficialWriteActionType;
  writePayloadDraft: Record<string, unknown>;
  writeBoundary: string;
  writeApprovalTier: HelmV2ApprovalTier;
  writeApprovalStatus: "pending_review" | "approved" | "rejected" | "blocked" | "insufficient_evidence";
  writeExecutionStatus: "requested" | "attempted" | "acknowledged_success" | "acknowledged_failure" | "deferred_retry";
  writeAcknowledgementStatus: "pending" | "success" | "failure" | "reconciliation_noted" | "deferred";
  writeAuditRequired: boolean;
  whatThisChanges: string;
  whatThisDoesNotMean: string;
};

export type HelmV2Artifact = {
  artifactId: HelmV2ArtifactId;
  summary: string;
  approvalTier: HelmV2ApprovalTier;
  scope: "internal" | "customer-draft" | "manager-brief" | "handoff";
};

export type HelmV2ExecutionBundle = {
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
};

export type HelmV2EventEnvelope<TPayload = Record<string, unknown>> = {
  eventId: string;
  type: HelmV2EventType;
  workspaceId: string;
  objectRefs: HelmV2ObjectRefs;
  triggeredBy: HelmV2Writer;
  createdAt: string;
  payload: TPayload;
};

export type HelmV2ApiContract = {
  contractKey: string;
  suggestedPath: string;
  method: "POST";
  description: string;
  requestShape: string;
  responseShape: string;
  approvalTier: HelmV2ApprovalTier;
  plannedOnly: boolean;
  systemOfRecordWrite: boolean;
};

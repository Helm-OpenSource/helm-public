import type { LLMModelRole, LLMTaskType, WorkspaceLLMConfig } from "@/lib/llm/types";

export function resolveModelForTask(config: WorkspaceLLMConfig, taskType: LLMTaskType, hint?: string | null) {
  const modelRole = getModelRoleForTask(taskType);

  if (hint) {
    return {
      provider: config.provider,
      model: hint,
      modelRole,
      budgetTier: config.llmBudgetTier ?? "pilot",
    };
  }

  switch (taskType) {
    case "MEETING_MEMORY_EXTRACTION":
      return {
        provider: config.provider,
        model: config.extractionModel,
        modelRole,
        budgetTier: config.llmBudgetTier ?? "pilot",
      };
    case "CONTACT_BRIEFING":
    case "COMPANY_BRIEFING":
    case "OPPORTUNITY_BRIEFING":
    case "MEETING_BRIEFING":
      return {
        provider: config.provider,
        model: config.briefingModel,
        modelRole,
        budgetTier: config.llmBudgetTier ?? "pilot",
      };
    case "BI_REPORT_ANALYSIS":
    case "BI_REPORT_REVIEW":
    case "JUDGEMENT_BOUNDARY_REVIEW":
    case "EXTERNAL_CASE_ASSIGNMENT":
    case "EXTERNAL_CASE_ASSIGNMENT_ACTION_BRIEFING":
    case "EXTERNAL_EMPLOYEE_SIGNAL_ACTION_BRIEFING":
    case "EXTERNAL_EMPLOYEE_SIGNAL_OWNER_ROUTING":
    case "RECOMMENDATION_EXPLANATION":
    default:
      return {
        provider: config.provider,
        model: config.reasoningModel,
        modelRole,
        budgetTier: config.llmBudgetTier ?? "pilot",
      };
  }
}

export function getModelRoleForTask(taskType: LLMTaskType): LLMModelRole {
  switch (taskType) {
    case "MEETING_MEMORY_EXTRACTION":
      return "EXTRACTION";
    case "CONTACT_BRIEFING":
    case "COMPANY_BRIEFING":
    case "OPPORTUNITY_BRIEFING":
    case "MEETING_BRIEFING":
      return "BRIEFING";
    case "BI_REPORT_ANALYSIS":
    case "BI_REPORT_REVIEW":
    case "JUDGEMENT_BOUNDARY_REVIEW":
    case "EXTERNAL_CASE_ASSIGNMENT":
    case "EXTERNAL_CASE_ASSIGNMENT_ACTION_BRIEFING":
    case "EXTERNAL_EMPLOYEE_SIGNAL_ACTION_BRIEFING":
    case "EXTERNAL_EMPLOYEE_SIGNAL_OWNER_ROUTING":
    case "RECOMMENDATION_EXPLANATION":
    default:
      return "REASONING";
  }
}

import { db } from "@/lib/db";
import { trimText } from "@/lib/utils";

type RecordLLMCallInput = {
  workspaceId: string;
  userId?: string | null;
  provider: string;
  model: string;
  modelVersion?: string | null;
  modelRole?: string | null;
  taskType: string;
  promptKey?: string | null;
  promptVersion: string;
  budgetTier?: string | null;
  outputMode?: string | null;
  inputSummary?: string | null;
  outputSummary?: string | null;
  tokenUsagePrompt?: number;
  tokenUsageCompletion?: number;
  latencyMs?: number;
  success: boolean;
  fallbackReason?: string | null;
  errorMessage?: string | null;
};

export async function recordLLMCall(input: RecordLLMCallInput) {
  const workspace = await db.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { id: true },
  });
  if (!workspace) {
    return null;
  }

  return db.lLMCallLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId ?? undefined,
      provider: input.provider,
      model: input.model,
      modelVersion: trimNullable(input.modelVersion),
      modelRole: trimNullable(input.modelRole),
      taskType: input.taskType,
      promptKey: trimNullable(input.promptKey),
      promptVersion: input.promptVersion,
      budgetTier: trimNullable(input.budgetTier),
      outputMode: trimNullable(input.outputMode),
      inputSummary: trimNullable(input.inputSummary),
      outputSummary: trimNullable(input.outputSummary),
      tokenUsagePrompt: input.tokenUsagePrompt,
      tokenUsageCompletion: input.tokenUsageCompletion,
      latencyMs: input.latencyMs,
      success: input.success,
      fallbackReason: trimNullable(input.fallbackReason),
      errorMessage: trimNullable(input.errorMessage),
    },
  });
}

export async function getRecentLLMCallLogs(workspaceId: string, limit = 20) {
  return db.lLMCallLog.findMany({
    where: { workspaceId },
    include: {
      user: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

function trimNullable(value?: string | null) {
  if (!value) return null;
  return trimText(value, 240);
}

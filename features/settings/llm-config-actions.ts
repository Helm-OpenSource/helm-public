"use server";

import { ActorType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import { canManageWorkspaceSetup, getWorkspaceGovernanceDeniedMessage } from "@/lib/auth/settings-governance";
import { getCurrentMembership, getCurrentWorkspace, requireCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  getDefaultWorkspaceLLMConfig,
  getOpenAICompatibleApiKey,
  getOpenAICompatibleBaseUrl,
} from "@/lib/llm/config";
import {
  probeOpenAICompatibleModels,
  resolveWorkspaceLLMModelsWithProbe,
  type LLMConnectionProbe,
} from "@/lib/llm/model-catalog";

const modelField = z.string().trim().min(1).max(180);

const workspaceLLMConfigSchema = z.object({
  provider: z.enum(["openai", "qwen"]).optional().default("qwen"),
  defaultModel: modelField,
  extractionModel: modelField,
  briefingModel: modelField,
  reasoningModel: modelField,
});

export async function updateWorkspaceLLMConfigAction(input: z.infer<typeof workspaceLLMConfigSchema>) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";
  const parsed = workspaceLLMConfigSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: english ? "Invalid LLM config input" : "模型配置参数错误",
      warnings: [] as string[],
    };
  }

  if (!canManageWorkspaceSetup(membership.role)) {
    return {
      ok: false,
      error: getWorkspaceGovernanceDeniedMessage(english),
      warnings: [] as string[],
    };
  }

  const defaults = getDefaultWorkspaceLLMConfig();
  const current = await db.workspace.findUnique({
    where: { id: workspace.id },
    select: {
      defaultLLMProvider: true,
      defaultLLMModel: true,
      extractionModel: true,
      briefingModel: true,
      reasoningModel: true,
    },
  });

  if (!current) {
    return {
      ok: false,
      error: english ? "Workspace not found" : "找不到当前工作区",
      warnings: [] as string[],
    };
  }

  const currentModels = {
    defaultModel: current.defaultLLMModel || defaults.defaultModel,
    extractionModel: current.extractionModel || defaults.extractionModel,
    briefingModel: current.briefingModel || defaults.briefingModel,
    reasoningModel: current.reasoningModel || defaults.reasoningModel,
  };

  const provider = parsed.data.provider;
  const probe = await probeOpenAICompatibleModels({
    provider,
    apiKey: getOpenAICompatibleApiKey(provider),
    baseUrl: getOpenAICompatibleBaseUrl(provider),
    timeoutMs: 3_500,
  });

  const resolved = resolveWorkspaceLLMModelsWithProbe({
    current: currentModels,
    proposed: {
      defaultModel: parsed.data.defaultModel,
      extractionModel: parsed.data.extractionModel,
      briefingModel: parsed.data.briefingModel,
      reasoningModel: parsed.data.reasoningModel,
    },
    probe,
    english,
  });

  await db.workspace.update({
    where: { id: workspace.id },
    data: {
      defaultLLMProvider: provider,
      defaultLLMModel: resolved.next.defaultModel,
      extractionModel: resolved.next.extractionModel,
      briefingModel: resolved.next.briefingModel,
      reasoningModel: resolved.next.reasoningModel,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "WORKSPACE_LLM_CONFIG_UPDATED",
    targetType: "Workspace",
    targetId: workspace.id,
    summary: english
      ? `Updated workspace LLM models via ${provider} OpenAI-compatible endpoint (${resolved.warnings.length} warnings)`
      : `已更新工作区 LLM 模型配置（${provider} OpenAI-compatible，${resolved.warnings.length} 条提醒）`,
    payload: {
      provider,
      probe: serializeProbe(probe),
      before: {
        provider: current.defaultLLMProvider || defaults.provider,
        ...currentModels,
      },
      after: {
        provider,
        ...resolved.next,
      },
      warnings: resolved.warnings,
    },
    sourcePage: "/settings",
  });

  await logEvent({
    workspaceId: workspace.id,
    userId: user.id,
    eventName: "workspace_llm_config_updated",
    eventCategory: "settings",
    targetType: "Workspace",
    targetId: workspace.id,
    metadata: {
      provider,
      probeReachable: probe.reachable,
      probeModelCount: probe.availableModelIds.length,
      warningCount: resolved.warnings.length,
      defaultModel: resolved.next.defaultModel,
      extractionModel: resolved.next.extractionModel,
      briefingModel: resolved.next.briefingModel,
      reasoningModel: resolved.next.reasoningModel,
    },
    sourcePage: "/settings",
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");

  return {
    ok: true,
    warnings: resolved.warnings,
    config: {
      provider,
      ...resolved.next,
    },
    connectionProbe: serializeProbe(probe),
  };
}

function serializeProbe(probe: LLMConnectionProbe) {
  return {
    baseUrl: probe.baseUrl,
    hasCredential: probe.hasCredential,
    reachable: probe.reachable,
    availableModelIds: probe.availableModelIds,
    errorMessage: probe.errorMessage,
    checkedAt: probe.checkedAt,
    probeMode: probe.probeMode,
  };
}

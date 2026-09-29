import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { getSettingsData } from "@/features/settings/queries";
import { SettingsClient } from "@/features/settings/settings-client";
import { isDingTalkDirectorySyncConfigured, isDingTalkMcpConfigured, isDingTalkOauthConfigured } from "@/lib/connectors/dingtalk";
import { isAliyunMailConfigured } from "@/lib/connectors/google";
import { isSecureConnectorTokenStorageEnabled } from "@/lib/connectors/token-store";
import {
  isFeishuBitableConfigured,
  isFeishuDirectorySyncConfigured,
  isFeishuOauthConfigured,
} from "@/lib/connectors/feishu";
import { isWeComDirectorySyncConfigured, isWeComOauthConfigured } from "@/lib/connectors/wecom";
import {
  getOpenAICompatibleApiKey,
  getOpenAICompatibleBaseUrl,
  getWorkspaceLLMConfig,
  isLLMProviderConfigured,
} from "@/lib/llm/config";
import { getDefaultLocalGemmaModel, getLLMModelCatalog, probeOpenAICompatibleModels } from "@/lib/llm/model-catalog";
import { getRegisteredPromptSummaries } from "@/lib/llm/prompt-registry";
import { listRegisteredProviders } from "@/lib/llm/provider-registry";

type SettingsClientProps = Parameters<typeof SettingsClient>[0];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    connector?: string;
    status?: string;
    message?: string;
    billingStatus?: string;
    billingMessage?: string;
  }>;
}) {
  const session = await getCurrentWorkspaceSession();
  const props = await loadSettingsClientProps({
    workspaceId: session.workspace.id,
    userId: session.user.id,
    searchParams,
  });

  return <>
    {process.env.HELM_AUTH_MEMBER_ACTIVATION_ENABLED === "true" && session.membership.status === "ACTIVE" && ["OWNER", "ADMIN"].includes(session.membership.role) ? <a className="block px-6 pt-4 underline" href="/settings/member-activation">成员首次激活</a> : null}
    {process.env.HELM_MEMBER_MCP_ENABLED === "true" && session.membership.status === "ACTIVE" ? <a className="block px-6 pt-4 underline" href="/settings/ai-access">AI 工具接入（用 Codex / QwenWork / Claude Code / WorkBuddy 连接 CAIO）</a> : null}
    <SettingsClient {...props} />
  </>;
}

async function loadSettingsClientProps(input: {
  workspaceId: string;
  userId: string;
  searchParams: Promise<{
    tab?: string;
    connector?: string;
    status?: string;
    message?: string;
    billingStatus?: string;
    billingMessage?: string;
  }>;
}): Promise<SettingsClientProps> {
  try {
    const data = await getSettingsData(input.workspaceId, input.userId);
    const llmConfig = await getWorkspaceLLMConfig(input.workspaceId);
    const connectorState = await input.searchParams;
    const providerSummaries = listRegisteredProviders();
    const promptSummaries = getRegisteredPromptSummaries();
    const modelCatalog = getLLMModelCatalog();
    const connectionProbe = await probeOpenAICompatibleModels({
      provider: llmConfig.provider,
      apiKey: getOpenAICompatibleApiKey(llmConfig.provider),
      baseUrl: getOpenAICompatibleBaseUrl(llmConfig.provider),
    });

    return {
      data,
      connectorState,
      billingState: {
        status: connectorState.billingStatus,
        message: connectorState.billingMessage,
      },
      connectorConfig: {
        gmailOauthReady: isAliyunMailConfigured(),
        dingtalkOauthReady: isDingTalkOauthConfigured(),
        dingtalkMcpReady: isDingTalkMcpConfigured(),
        dingtalkDirectorySyncReady: isDingTalkDirectorySyncConfigured(),
        wecomOauthReady: isWeComOauthConfigured(),
        wecomDirectorySyncReady: isWeComDirectorySyncConfigured(),
        feishuOauthReady: isFeishuOauthConfigured(),
        feishuDirectorySyncReady: isFeishuDirectorySyncConfigured(),
        feishuBitableReady: isFeishuBitableConfigured(),
        secureTokenStorage: isSecureConnectorTokenStorageEnabled(),
      },
      llmConfig: {
        enabled: llmConfig.llmEnabled,
        provider: llmConfig.provider,
        defaultModel: llmConfig.defaultModel,
        extractionModel: llmConfig.extractionModel,
        briefingModel: llmConfig.briefingModel,
        reasoningModel: llmConfig.reasoningModel,
        providerReady: isLLMProviderConfigured(llmConfig.provider),
        baseUrl: connectionProbe.baseUrl,
        budgetTier: llmConfig.llmBudgetTier ?? "pilot",
        localGemmaModel: getDefaultLocalGemmaModel(),
        modelCatalog,
        connectionProbe,
        providerSummaries,
        promptSummaries,
      },
    };
  } catch (error) {
    console.error("[settings/page] failed to render settings", {
      workspaceId: input.workspaceId,
      userId: input.userId,
      error,
    });
    throw error;
  }
}

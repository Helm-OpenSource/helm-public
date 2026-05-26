import { resolveWorkspaceUiLocale, type UiLocale } from "@/lib/i18n/config";
import { resolveWorkspaceDemoMode, type DemoMode } from "@/lib/demo/demo-modes";
import { safeParseJson } from "@/lib/utils";

export type WorkspaceFeatureFlags = {
  multilingualUi: boolean;
  diagnosticsCenter: boolean;
  crmFirstImports: boolean;
  captureAudio: boolean;
  llmEnhancement: boolean;
  evolutionSignals: boolean;
  swarmReadOnlyWorkers: boolean;
};

export const defaultWorkspaceFeatureFlags: WorkspaceFeatureFlags = {
  multilingualUi: true,
  diagnosticsCenter: true,
  crmFirstImports: true,
  captureAudio: true,
  llmEnhancement: true,
  evolutionSignals: true,
  swarmReadOnlyWorkers: false,
};

export function parseWorkspaceFeatureFlags(raw: string | null | undefined): WorkspaceFeatureFlags {
  const parsed = safeParseJson<Partial<WorkspaceFeatureFlags> | null>(raw, null);
  return {
    multilingualUi: parsed?.multilingualUi ?? defaultWorkspaceFeatureFlags.multilingualUi,
    diagnosticsCenter: parsed?.diagnosticsCenter ?? defaultWorkspaceFeatureFlags.diagnosticsCenter,
    crmFirstImports: parsed?.crmFirstImports ?? defaultWorkspaceFeatureFlags.crmFirstImports,
    captureAudio: parsed?.captureAudio ?? defaultWorkspaceFeatureFlags.captureAudio,
    llmEnhancement: parsed?.llmEnhancement ?? defaultWorkspaceFeatureFlags.llmEnhancement,
    evolutionSignals: parsed?.evolutionSignals ?? defaultWorkspaceFeatureFlags.evolutionSignals,
    swarmReadOnlyWorkers:
      parsed?.swarmReadOnlyWorkers ?? defaultWorkspaceFeatureFlags.swarmReadOnlyWorkers,
  };
}

export function serializeWorkspaceFeatureFlags(flags: WorkspaceFeatureFlags) {
  return JSON.stringify(flags);
}

export function getEnabledFeatureFlagCount(flags: WorkspaceFeatureFlags) {
  return Object.values(flags).filter(Boolean).length;
}

export type WorkspaceUiConfig = {
  locale: UiLocale;
  pilotMode: boolean;
  captureConsentRequired: boolean;
  dataRetentionDays: number;
  featureFlags: WorkspaceFeatureFlags;
  demoMode: DemoMode | null;
};

export function normalizeWorkspaceUiConfig(input: {
  requestLocale?: string | null;
  userLocale?: string | null;
  defaultLocale?: string | null;
  tenantOverlayDefaultLocale?: string | null;
  deploymentProfileDefaultLocale?: string | null;
  pilotMode?: boolean | null;
  captureConsentRequired?: boolean | null;
  dataRetentionDays?: number | null;
  featureFlagsJson?: string | null;
  configuration?: string | null;
}): WorkspaceUiConfig {
  return {
    locale: resolveWorkspaceUiLocale({
      requestLocale: input.requestLocale,
      userLocale: input.userLocale,
      workspaceDefaultLocale: input.defaultLocale,
      tenantOverlayDefaultLocale: input.tenantOverlayDefaultLocale,
      deploymentProfileDefaultLocale: input.deploymentProfileDefaultLocale,
    }),
    pilotMode: input.pilotMode ?? true,
    captureConsentRequired: input.captureConsentRequired ?? true,
    dataRetentionDays: input.dataRetentionDays ?? 90,
    featureFlags: parseWorkspaceFeatureFlags(input.featureFlagsJson),
    demoMode: resolveWorkspaceDemoMode("configuration" in input ? (input as { configuration?: string | null }).configuration : null),
  };
}

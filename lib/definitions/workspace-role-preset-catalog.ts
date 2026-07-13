import { WorkspaceRole } from "@prisma/client";

import type { UiLocale } from "@/lib/i18n/config";
import { safeParseJson } from "@/lib/utils";
import {
  ROLE_PRESET_KEYS,
  getRolePresetDefinition,
  listRolePresetDefinitions,
  suggestRolePresetKeyFromText,
  type RolePresetDefinition,
  type RolePresetKey,
} from "@/lib/definitions/role-presets";

type LocalizedText = {
  zh: string;
  en: string;
};

type LocalizedList = {
  zh: string[];
  en: string[];
};

export type WorkspaceRolePresetDefinition = {
  key: string;
  label: LocalizedText;
  summary: LocalizedText;
  mission: LocalizedText;
  ownedOutcomes: LocalizedList;
  mainJudgements: LocalizedList;
  handoffEdges: LocalizedList;
  successSignals: LocalizedList;
  boundaryNotes: LocalizedList;
  defaultWorkspaceProfileType: string;
  matchers: string[];
  basePresetKey: RolePresetKey;
  workspaceRole?: string | null;
  roleCategory?: string | null;
  permissionsProfileKey?: string | null;
  iaProfileKey?: string | null;
};

export type LocalizedWorkspaceRolePreset = {
  key: string;
  label: string;
  summary: string;
  mission: string;
  ownedOutcomes: string[];
  mainJudgements: string[];
  handoffEdges: string[];
  successSignals: string[];
  boundaryNotes: string[];
  defaultWorkspaceProfileType: string;
  basePresetKey: RolePresetKey;
  workspaceRole?: string | null;
  roleCategory?: string | null;
  permissionsProfileKey?: string | null;
  iaProfileKey?: string | null;
};

export type WorkspaceRolePresetOption = {
  key: string;
  label: string;
  summary: string;
  basePresetKey: RolePresetKey;
  workspaceRole?: string | null;
  roleCategory?: string | null;
  permissionsProfileKey?: string | null;
  iaProfileKey?: string | null;
};

type RawCatalogResolution = {
  includeDefaultPresets: boolean;
  presets: WorkspaceRolePresetDefinition[];
};

const DEFAULT_BASE_PRESET_KEY: RolePresetKey = "GENERAL_OPERATOR";
const ROLE_PRESET_KEY_PATTERN = /^[A-Za-z0-9_.:-]{1,96}$/;
const MAX_CUSTOM_ROLE_PRESETS = 50;
const MAX_METADATA_KEY_LENGTH = 96;
const MAX_LABEL_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 600;
const MAX_LIST_ITEMS = 8;
const MAX_LIST_ITEM_LENGTH = 200;
const MAX_MATCHERS = 20;
const MAX_MATCHER_LENGTH = 120;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function isBuiltInRolePresetKey(value: string | null | undefined): value is RolePresetKey {
  return Boolean(value && (ROLE_PRESET_KEYS as readonly string[]).includes(value));
}

function normalizeString(value: unknown, maxLength = MAX_DESCRIPTION_LENGTH): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : null;
}

function normalizeRolePresetKey(value: unknown): string | null {
  const key = normalizeString(value);
  if (!key || !ROLE_PRESET_KEY_PATTERN.test(key)) {
    return null;
  }
  return key;
}

function normalizeBasePresetKey(value: unknown): RolePresetKey {
  const key = normalizeString(value);
  return isBuiltInRolePresetKey(key) ? key : DEFAULT_BASE_PRESET_KEY;
}

function asLocalizedText(
  value: unknown,
  fallback: LocalizedText,
  maxLength = MAX_DESCRIPTION_LENGTH,
): LocalizedText {
  const scalar = normalizeString(value, maxLength);
  if (scalar) {
    return { zh: scalar, en: scalar };
  }

  if (!isRecord(value)) {
    return fallback;
  }

  return {
    zh: normalizeString(value.zh, maxLength) ?? fallback.zh,
    en: normalizeString(value.en, maxLength) ?? fallback.en,
  };
}

function normalizeStringList(
  value: unknown,
  maxItems = MAX_LIST_ITEMS,
  maxItemLength = MAX_LIST_ITEM_LENGTH,
): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const items = value
    .slice(0, maxItems)
    .map((item) => normalizeString(item, maxItemLength))
    .filter(Boolean) as string[];
  return items.length > 0 ? items : null;
}

function asLocalizedList(value: unknown, fallback: LocalizedList): LocalizedList {
  const scalarList = normalizeStringList(value);
  if (scalarList) {
    return { zh: scalarList, en: scalarList };
  }

  if (!isRecord(value)) {
    return fallback;
  }

  return {
    zh: normalizeStringList(value.zh) ?? fallback.zh,
    en: normalizeStringList(value.en) ?? fallback.en,
  };
}

function fromBuiltInPreset(preset: RolePresetDefinition): WorkspaceRolePresetDefinition {
  return {
    key: preset.key,
    label: preset.label,
    summary: preset.summary,
    mission: preset.mission,
    ownedOutcomes: preset.ownedOutcomes,
    mainJudgements: preset.mainJudgements,
    handoffEdges: preset.handoffEdges,
    successSignals: preset.successSignals,
    boundaryNotes: preset.boundaryNotes,
    defaultWorkspaceProfileType: preset.defaultWorkspaceProfileType,
    matchers: preset.matchers,
    basePresetKey: preset.key,
  };
}

function normalizeCustomPreset(
  value: unknown,
  seenKeys: Set<string>,
): WorkspaceRolePresetDefinition | null {
  if (!isRecord(value)) {
    return null;
  }

  const key = normalizeRolePresetKey(value.key);
  if (!key || seenKeys.has(key)) {
    return null;
  }

  const basePresetKey = normalizeBasePresetKey(value.basePresetKey);
  const fallback = fromBuiltInPreset(getRolePresetDefinition(basePresetKey));
  const matchers = normalizeStringList(
    value.matchers,
    MAX_MATCHERS,
    MAX_MATCHER_LENGTH,
  ) ?? [
    key,
    fallback.label.zh,
    fallback.label.en,
  ];

  seenKeys.add(key);
  return {
    key,
    label: asLocalizedText(value.label, fallback.label, MAX_LABEL_LENGTH),
    summary: asLocalizedText(value.summary, fallback.summary),
    mission: asLocalizedText(value.mission, fallback.mission),
    ownedOutcomes: asLocalizedList(value.ownedOutcomes, fallback.ownedOutcomes),
    mainJudgements: asLocalizedList(value.mainJudgements, fallback.mainJudgements),
    handoffEdges: asLocalizedList(value.handoffEdges, fallback.handoffEdges),
    successSignals: asLocalizedList(value.successSignals, fallback.successSignals),
    boundaryNotes: asLocalizedList(value.boundaryNotes, fallback.boundaryNotes),
    defaultWorkspaceProfileType:
      normalizeString(value.defaultWorkspaceProfileType, MAX_LABEL_LENGTH) ??
      fallback.defaultWorkspaceProfileType,
    matchers,
    basePresetKey,
    workspaceRole: normalizeString(value.workspaceRole, MAX_METADATA_KEY_LENGTH),
    roleCategory: normalizeString(value.roleCategory, MAX_METADATA_KEY_LENGTH),
    permissionsProfileKey: normalizeString(value.permissionsProfileKey, MAX_METADATA_KEY_LENGTH),
    iaProfileKey: normalizeString(value.iaProfileKey, MAX_METADATA_KEY_LENGTH),
  };
}

function parseRawCatalog(rawConfiguration: string | null | undefined): RawCatalogResolution {
  const parsed = safeParseJson<Record<string, unknown> | null>(rawConfiguration, null);
  const rawCatalog = parsed?.rolePresetCatalog;
  const builtInPresets = listRolePresetDefinitions().map(fromBuiltInPreset);

  if (!rawCatalog) {
    return {
      includeDefaultPresets: true,
      presets: builtInPresets,
    };
  }

  const seenKeys = new Set<string>();
  const catalogPresets = Array.isArray(rawCatalog)
    ? rawCatalog
    : isRecord(rawCatalog)
      ? Array.isArray(rawCatalog.presets)
        ? rawCatalog.presets
        : Array.isArray(rawCatalog.options)
          ? rawCatalog.options
          : []
      : [];
  const customPresets = catalogPresets
    .slice(0, MAX_CUSTOM_ROLE_PRESETS)
    .map((item) => normalizeCustomPreset(item, seenKeys))
    .filter(Boolean) as WorkspaceRolePresetDefinition[];

  if (customPresets.length === 0) {
    return {
      includeDefaultPresets: true,
      presets: builtInPresets,
    };
  }

  const includeDefaultPresets = isRecord(rawCatalog)
    ? rawCatalog.includeDefaultPresets === true ||
      rawCatalog.fallbackToDefaultPresets === true
    : false;

  return {
    includeDefaultPresets,
    presets: includeDefaultPresets
      ? [
          ...customPresets,
          ...builtInPresets.filter((preset) => !seenKeys.has(preset.key)),
        ]
      : customPresets,
  };
}

export function listWorkspaceRolePresetDefinitions(
  rawConfiguration: string | null | undefined,
) {
  return parseRawCatalog(rawConfiguration).presets;
}

export function getWorkspaceRolePresetDefinition(
  key: string | null | undefined,
  rawConfiguration: string | null | undefined,
) {
  const normalizedKey = normalizeRolePresetKey(key);
  if (!normalizedKey) {
    return null;
  }
  return (
    listWorkspaceRolePresetDefinitions(rawConfiguration).find(
      (preset) => preset.key === normalizedKey,
    ) ?? null
  );
}

/**
 * Resolve a member's base preset key for role-home routing, with a **controlled
 * fallback** when no preset is assigned (existing / un-migrated members, or seed
 * data without `rolePresetKey`).
 *
 * An OWNER with no preset must NOT fall to the blank GENERIC home (search-only) —
 * they own the workspace and get the control tower (`FOUNDER_CEO`). Other roles
 * keep the `null → GENERIC` fail-safe (blueprint §1.4). This is a read-time
 * backfill (non-destructive); it does not write the preset back.
 *
 * (CodeX runtime audit P1: enabling controlTowerHome dropped OWNERs whose
 * `rolePresetKey` was never set into an empty generic workspace.)
 */
export function resolveMemberBasePresetKey(input: {
  rolePresetKey: string | null | undefined;
  workspaceRole: WorkspaceRole;
  rawConfiguration: string | null | undefined;
}): RolePresetKey | null {
  const explicit = getWorkspaceRolePresetDefinition(
    input.rolePresetKey,
    input.rawConfiguration,
  )?.basePresetKey;
  if (explicit) return explicit;
  if (input.workspaceRole === WorkspaceRole.OWNER) return "FOUNDER_CEO";
  return null;
}

export function localizeWorkspaceRolePreset(
  preset: WorkspaceRolePresetDefinition,
  locale: UiLocale,
): LocalizedWorkspaceRolePreset {
  const english = locale === "en-US";
  return {
    key: preset.key,
    label: english ? preset.label.en : preset.label.zh,
    summary: english ? preset.summary.en : preset.summary.zh,
    mission: english ? preset.mission.en : preset.mission.zh,
    ownedOutcomes: english ? preset.ownedOutcomes.en : preset.ownedOutcomes.zh,
    mainJudgements: english ? preset.mainJudgements.en : preset.mainJudgements.zh,
    handoffEdges: english ? preset.handoffEdges.en : preset.handoffEdges.zh,
    successSignals: english ? preset.successSignals.en : preset.successSignals.zh,
    boundaryNotes: english ? preset.boundaryNotes.en : preset.boundaryNotes.zh,
    defaultWorkspaceProfileType: preset.defaultWorkspaceProfileType,
    basePresetKey: preset.basePresetKey,
    workspaceRole: preset.workspaceRole,
    roleCategory: preset.roleCategory,
    permissionsProfileKey: preset.permissionsProfileKey,
    iaProfileKey: preset.iaProfileKey,
  };
}

export function listWorkspaceRolePresetOptions(
  rawConfiguration: string | null | undefined,
  locale: UiLocale,
): WorkspaceRolePresetOption[] {
  return listWorkspaceRolePresetDefinitions(rawConfiguration).map((preset) => {
    const localized = localizeWorkspaceRolePreset(preset, locale);
    return {
      key: localized.key,
      label: localized.label,
      summary: localized.summary,
      basePresetKey: localized.basePresetKey,
      workspaceRole: localized.workspaceRole,
      roleCategory: localized.roleCategory,
      permissionsProfileKey: localized.permissionsProfileKey,
      iaProfileKey: localized.iaProfileKey,
    };
  });
}

export function resolveWorkspaceRolePresetKey(input: {
  rawConfiguration?: string | null;
  requestedRolePresetKey?: string | null;
  title?: string | null;
  persona?: string | null;
  workspaceProfileType?: string | null;
}) {
  const catalog = listWorkspaceRolePresetDefinitions(input.rawConfiguration);
  const requestedKey = normalizeRolePresetKey(input.requestedRolePresetKey);
  if (requestedKey && catalog.some((preset) => preset.key === requestedKey)) {
    return requestedKey;
  }

  const text = [input.title, input.persona, input.workspaceProfileType]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");

  if (text) {
    const matchedPreset = catalog.find((preset) =>
      preset.matchers.some((matcher) => text.includes(matcher.toLowerCase())),
    );
    if (matchedPreset) {
      return matchedPreset.key;
    }
  }

  const suggestedKey = suggestRolePresetKeyFromText(
    input.title,
    input.persona,
    input.workspaceProfileType,
  );
  return catalog.some((preset) => preset.key === suggestedKey)
    ? suggestedKey
    : (catalog[0]?.key ?? suggestedKey);
}

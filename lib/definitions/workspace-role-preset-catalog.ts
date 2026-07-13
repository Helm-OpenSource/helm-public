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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function isBuiltInRolePresetKey(value: string | null | undefined): value is RolePresetKey {
  return Boolean(value && (ROLE_PRESET_KEYS as readonly string[]).includes(value));
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
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

function asLocalizedText(value: unknown, fallback: LocalizedText): LocalizedText {
  const scalar = normalizeString(value);
  if (scalar) {
    return { zh: scalar, en: scalar };
  }

  if (!isRecord(value)) {
    return fallback;
  }

  return {
    zh: normalizeString(value.zh) ?? fallback.zh,
    en: normalizeString(value.en) ?? fallback.en,
  };
}

function normalizeStringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const items = value.map(normalizeString).filter(Boolean) as string[];
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
  const matchers = normalizeStringList(value.matchers) ?? [
    key,
    fallback.label.zh,
    fallback.label.en,
  ];

  seenKeys.add(key);
  return {
    key,
    label: asLocalizedText(value.label, fallback.label),
    summary: asLocalizedText(value.summary, fallback.summary),
    mission: asLocalizedText(value.mission, fallback.mission),
    ownedOutcomes: asLocalizedList(value.ownedOutcomes, fallback.ownedOutcomes),
    mainJudgements: asLocalizedList(value.mainJudgements, fallback.mainJudgements),
    handoffEdges: asLocalizedList(value.handoffEdges, fallback.handoffEdges),
    successSignals: asLocalizedList(value.successSignals, fallback.successSignals),
    boundaryNotes: asLocalizedList(value.boundaryNotes, fallback.boundaryNotes),
    defaultWorkspaceProfileType:
      normalizeString(value.defaultWorkspaceProfileType) ??
      fallback.defaultWorkspaceProfileType,
    matchers,
    basePresetKey,
    workspaceRole: normalizeString(value.workspaceRole),
    roleCategory: normalizeString(value.roleCategory),
    permissionsProfileKey: normalizeString(value.permissionsProfileKey),
    iaProfileKey: normalizeString(value.iaProfileKey),
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

  return catalog[0]?.key ?? suggestRolePresetKeyFromText(
    input.title,
    input.persona,
    input.workspaceProfileType,
  );
}

import type { UiLocale } from "@/lib/i18n/config";
import { safeParseJson } from "@/lib/utils";
import {
  getRolePresetDefinition,
  localizeRolePreset,
  suggestRolePresetKeyFromText,
  type RolePresetKey,
} from "@/lib/definitions/role-presets";

export type MemberDefinitionDraft = {
  version: 1;
  locale: UiLocale;
  rolePresetKey: RolePresetKey;
  roleLabel: string;
  title: string | null;
  mission: string;
  ownedOutcomes: string[];
  mainJudgements: string[];
  handoffEdges: string[];
  successSignals: string[];
  boundaryNotes: string[];
  customNotes: string | null;
  sourceContext: {
    workspaceName: string;
    workspaceProfileType: string | null;
    focusAreas: string[];
  };
};

type BuildMemberDefinitionDraftInput = {
  locale: UiLocale;
  workspaceName: string;
  workspaceProfileType?: string | null;
  focusAreasJson?: string | null;
  rolePresetKey?: RolePresetKey | null;
  title?: string | null;
  persona?: string | null;
  customNotes?: string | null;
};

export function buildMemberDefinitionDraft(
  input: BuildMemberDefinitionDraftInput,
): MemberDefinitionDraft {
  const english = input.locale === "en-US";
  const focusAreas = safeParseJson<string[]>(input.focusAreasJson, []).filter(Boolean);
  const resolvedRolePresetKey =
    input.rolePresetKey ??
    suggestRolePresetKeyFromText(input.title, input.persona, input.workspaceProfileType);
  const preset = localizeRolePreset(getRolePresetDefinition(resolvedRolePresetKey), input.locale);

  const workspaceContextLine =
    focusAreas.length > 0
      ? english
        ? `Current workspace focus: ${focusAreas.join(", ")}.`
        : `当前工作区关注重点：${focusAreas.join("、")}。`
      : input.workspaceProfileType
        ? english
          ? `Current workspace posture: ${input.workspaceProfileType}.`
          : `当前工作区姿态：${input.workspaceProfileType}。`
        : english
          ? "Current workspace posture still needs a clearer operating definition."
          : "当前工作区姿态仍需要更清楚的 operating definition。";

  const titleLine = input.title?.trim()
    ? english
      ? `Current title: ${input.title.trim()}.`
      : `当前职位：${input.title.trim()}。`
    : null;
  const customNotes = input.customNotes?.trim() || null;
  const customNotesLine = customNotes
    ? english
      ? `User note: ${customNotes}.`
      : `用户补充：${customNotes}。`
    : null;

  return {
    version: 1,
    locale: input.locale,
    rolePresetKey: resolvedRolePresetKey,
    roleLabel: preset.label,
    title: input.title?.trim() || null,
    mission: [preset.mission, workspaceContextLine, titleLine, customNotesLine].filter(Boolean).join(" "),
    ownedOutcomes: [
      ...preset.ownedOutcomes,
      ...(focusAreas.length > 0
        ? [
            english
              ? `Translate ${focusAreas.join(", ")} into one clear next operating move.`
              : `把 ${focusAreas.join("、")} 收成一个明确的下一步经营动作。`,
          ]
        : []),
    ],
    mainJudgements: preset.mainJudgements,
    handoffEdges: preset.handoffEdges,
    successSignals: preset.successSignals,
    boundaryNotes: preset.boundaryNotes,
    customNotes,
    sourceContext: {
      workspaceName: input.workspaceName,
      workspaceProfileType: input.workspaceProfileType?.trim() || null,
      focusAreas,
    },
  };
}

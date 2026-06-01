import { Badge } from "@/components/ui/badge";
import {
  getRoleFoundation,
  type LocalizedRoleStarterSkillSuggestion,
} from "@/lib/definitions/role-foundations";
import type { RolePresetKey } from "@/lib/definitions/role-presets";

type RoleFoundationPreviewProps = {
  locale: "zh-CN" | "en-US";
  rolePresetKey: RolePresetKey;
  variant?: "full" | "compact";
  workspaceProfileType?: string | null;
  focusAreas?: string[];
};

function StarterSkillSuggestionCard({
  suggestion,
}: {
  suggestion: LocalizedRoleStarterSkillSuggestion;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-white/85 p-3">
      <p className="text-sm font-medium text-[color:var(--foreground)]">{suggestion.skillName}</p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{suggestion.rationale}</p>
      <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">{suggestion.activationCue}</p>
    </div>
  );
}

export function RoleFoundationPreview({
  locale,
  rolePresetKey,
  variant = "compact",
  workspaceProfileType,
  focusAreas,
}: RoleFoundationPreviewProps) {
  const english = locale === "en-US";
  const foundation = getRoleFoundation(rolePresetKey, locale, {
    workspaceProfileType,
    focusAreas,
  });
  const compact = variant === "compact";
  const contextLines = [
    compact ? foundation.workspaceContext.postureSummary : null,
    foundation.workspaceContext.focusSummary,
    foundation.workspaceContext.adaptationNote,
  ].filter(Boolean);

  return (
    <div
      className={`rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)]/80 ${
        compact ? "px-4 py-3" : "p-4"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-[color:var(--foreground)]">
          {english ? "Role foundation and starter skills" : "角色基础与初始技能建议"}
        </p>
        <Badge variant="neutral">{english ? "Suggestion only" : "仅建议"}</Badge>
      </div>

      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{foundation.soulLite.summary}</p>
      <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">
        {compact ? foundation.starterSkillPack.summary : foundation.soulLite.mission}
      </p>

      {contextLines.length > 0 ? (
        <div className="mt-3 rounded-2xl border border-[color:var(--border)] bg-white/85 p-3">
          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
            {english ? "Current workspace fit" : "当前工作区贴合度"}
          </p>
          <div className="mt-2 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
            {contextLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      ) : null}

      {!compact ? (
        <div className="mt-3 rounded-2xl border border-[color:var(--border)] bg-white/85 p-3">
          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
            {english ? "Main judgements" : "主要判断面"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {foundation.soulLite.mainJudgements.slice(0, 3).map((item) => (
              <span
                key={item}
                className="rounded-full bg-[color:var(--surface-subtle)] px-3 py-1 text-xs font-medium text-[color:var(--muted)]"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div
        className={`mt-3 grid gap-3 ${
          compact ? "md:grid-cols-1" : "md:grid-cols-3"
        }`}
      >
        {foundation.starterSkillPack.suggestions.map((suggestion) => (
          <StarterSkillSuggestionCard
            key={`${foundation.rolePresetKey}:${suggestion.skillId}`}
            suggestion={suggestion}
          />
        ))}
      </div>

      <p className="mt-3 text-xs leading-5 text-[color:var(--muted-foreground)]">
        {foundation.starterSkillPack.boundaryNote}
      </p>
    </div>
  );
}

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleFoundationPreview } from "@/features/settings/role-foundation-preview";
import type { MemberDefinitionDraft } from "@/lib/definitions/member-definition";
import {
  getRolePresetDefinition,
  localizeRolePreset,
  suggestRolePresetKeyFromText,
  type RolePresetKey,
} from "@/lib/definitions/role-presets";
import { safeParseJson } from "@/lib/utils";

type CurrentRoleFoundationCardProps = {
  locale: "zh-CN" | "en-US";
  workspace: {
    profileType: string | null;
    focusAreas: string | null;
  };
  membership: {
    title: string | null;
    persona: string | null;
    rolePresetKey: string | null;
    definitionDraftJson: string | null;
    definitionAcceptedJson: string | null;
  };
};

function resolveRolePresetKey(input: {
  acceptedDefinition: MemberDefinitionDraft | null;
  draftDefinition: MemberDefinitionDraft | null;
  membershipRolePresetKey: string | null;
  title: string | null;
  persona: string | null;
  workspaceProfileType: string | null;
}) {
  return (
    input.acceptedDefinition?.rolePresetKey ??
    input.draftDefinition?.rolePresetKey ??
    (input.membershipRolePresetKey as RolePresetKey | null) ??
    suggestRolePresetKeyFromText(
      input.title,
      input.persona,
      input.workspaceProfileType,
    )
  );
}

export function CurrentRoleFoundationCard({
  locale,
  workspace,
  membership,
}: CurrentRoleFoundationCardProps) {
  const english = locale === "en-US";
  const acceptedDefinition = safeParseJson<MemberDefinitionDraft | null>(
    membership.definitionAcceptedJson,
    null,
  );
  const draftDefinition = safeParseJson<MemberDefinitionDraft | null>(
    membership.definitionDraftJson,
    null,
  );
  const focusAreas = safeParseJson<string[]>(workspace.focusAreas, []).filter(Boolean);
  const rolePresetKey = resolveRolePresetKey({
    acceptedDefinition,
    draftDefinition,
    membershipRolePresetKey: membership.rolePresetKey,
    title: membership.title,
    persona: membership.persona,
    workspaceProfileType: workspace.profileType,
  });
  const preset = localizeRolePreset(getRolePresetDefinition(rolePresetKey), locale);

  const statusBadge = acceptedDefinition
    ? {
        label: english ? "Active definition accepted" : "已接受为当前定义",
        variant: "success" as const,
        title: english ? "Active operating definition" : "当前生效的工作定义",
        body: acceptedDefinition.mission,
        meta: english
          ? "The dashboard is currently using your accepted working definition as the strongest role-context layer."
          : "dashboard 当前会把你已接受的工作定义当成最强的角色上下文层。",
        tone: "emerald",
      }
    : draftDefinition
      ? {
          label: english ? "Draft definition only" : "当前只有草稿",
          variant: "warning" as const,
          title: english
            ? "Draft role definition waiting for acceptance"
            : "待接受的角色定义草稿",
          body: draftDefinition.mission,
          meta: english
            ? "A draft already exists, but it is still editable context until you accept it in settings."
            : "当前已有角色定义草稿，但在 settings 接受之前，它仍只是可编辑上下文。",
          tone: "amber",
        }
      : {
          label: english ? "Preset-led start" : "仅预设起点",
          variant: "neutral" as const,
          title: english ? "Preset-led starting point" : "基于预设的起点",
          body: preset.mission,
          meta: english
            ? "No accepted member definition is stored yet, so the dashboard is only using the current role preset as a bounded starting point."
            : "当前还没有已接受的成员定义，所以工作台只把当前角色预设当作有边界的起点。",
          tone: "slate",
        };

  const titleMeta = membership.title?.trim()
    ? english
      ? `Current title: ${membership.title.trim()}`
      : `当前职位：${membership.title.trim()}`
    : english
      ? `Role preset: ${preset.label}`
      : `角色预设：${preset.label}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{english ? "Your role foundation" : "你的角色基础"}</CardTitle>
          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
          <Badge variant="neutral">{preset.label}</Badge>
        </div>
        <CardDescription>
          {english
            ? "Accepted definition, draft, or preset — which one the dashboard is using right now."
            : "工作台现在用的是已接受定义、草稿，还是预设。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="workspace-note-card px-4 py-4" data-tone={statusBadge.tone}>
          <p className="workspace-note-meta text-xs font-medium">{titleMeta}</p>
          <p className="workspace-note-title mt-2 text-sm font-medium">{statusBadge.title}</p>
          <p className="workspace-note-body mt-2 text-sm leading-7">{statusBadge.body}</p>
          <p className="workspace-note-meta mt-2 text-xs">{statusBadge.meta}</p>
        </div>

        <RoleFoundationPreview
          locale={locale}
          rolePresetKey={rolePresetKey}
          workspaceProfileType={workspace.profileType}
          focusAreas={focusAreas}
        />

        <div>
          <Button asChild size="sm" variant="secondary">
            <Link href="/settings?tab=team">
              {english ? "Refine role definition" : "去继续完善角色定义"}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

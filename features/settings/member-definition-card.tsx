"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  acceptCurrentMemberDefinitionAction,
  generateCurrentMemberDefinitionDraftAction,
  saveCurrentMemberDefinitionDraftAction,
} from "@/features/settings/actions";
import type { MemberDefinitionDraft } from "@/lib/definitions/member-definition";
import {
  getWorkspaceRolePresetDefinition,
  listWorkspaceRolePresetOptions,
  localizeWorkspaceRolePreset,
  resolveWorkspaceRolePresetKey,
} from "@/lib/definitions/workspace-role-preset-catalog";
import { safeParseJson } from "@/lib/utils";

type MemberDefinitionCardProps = {
  locale: "zh-CN" | "en-US";
  workspace: {
    name: string;
    profileType: string | null;
    focusAreas: string | null;
    configuration: string | null;
  };
  currentMembership: {
    id: string;
    title: string | null;
    persona: string | null;
    rolePresetKey: string | null;
    definitionDraftJson: string | null;
    definitionAcceptedJson: string | null;
    user: {
      name: string;
      email: string;
    };
  };
};

type DefinitionEditorState = {
  mission: string;
  ownedOutcomes: string;
  mainJudgements: string;
  handoffEdges: string;
  successSignals: string;
  boundaryNotes: string;
};

type MemberDefinitionDisplayState = {
  definition: MemberDefinitionDraft | null;
  status: "accepted" | "pending-draft" | "draft-only" | null;
};

type LocalEditorSnapshot = {
  serverKey: string;
  rolePresetKey: string;
  title: string;
  customNotes: string;
  editor: DefinitionEditorState;
};

const emptyEditorState: DefinitionEditorState = {
  mission: "",
  ownedOutcomes: "",
  mainJudgements: "",
  handoffEdges: "",
  successSignals: "",
  boundaryNotes: "",
};

function splitLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildEditorState(value: MemberDefinitionDraft | null): DefinitionEditorState {
  if (!value) {
    return emptyEditorState;
  }

  return {
    mission: value.mission,
    ownedOutcomes: value.ownedOutcomes.join("\n"),
    mainJudgements: value.mainJudgements.join("\n"),
    handoffEdges: value.handoffEdges.join("\n"),
    successSignals: value.successSignals.join("\n"),
    boundaryNotes: value.boundaryNotes.join("\n"),
  };
}

function isDefinitionEditorState(value: unknown): value is DefinitionEditorState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<Record<keyof DefinitionEditorState, unknown>>;
  return (
    typeof candidate.mission === "string" &&
    typeof candidate.ownedOutcomes === "string" &&
    typeof candidate.mainJudgements === "string" &&
    typeof candidate.handoffEdges === "string" &&
    typeof candidate.successSignals === "string" &&
    typeof candidate.boundaryNotes === "string"
  );
}

function isEditorComplete(editor: DefinitionEditorState) {
  return Boolean(
    editor.mission.trim() &&
      splitLines(editor.ownedOutcomes).length > 0 &&
      splitLines(editor.mainJudgements).length > 0 &&
      splitLines(editor.handoffEdges).length > 0 &&
      splitLines(editor.successSignals).length > 0 &&
      splitLines(editor.boundaryNotes).length > 0,
  );
}

export function resolveMemberDefinitionDisplayState(input: {
  acceptedDefinition: MemberDefinitionDraft | null;
  draftDefinition: MemberDefinitionDraft | null;
  acceptedJson: string | null;
  draftJson: string | null;
}): MemberDefinitionDisplayState {
  const hasAcceptedDefinition = Boolean(input.acceptedDefinition);
  const hasDraftDefinition = Boolean(input.draftDefinition);
  const hasPendingDraft =
    hasAcceptedDefinition &&
    hasDraftDefinition &&
    input.acceptedJson !== input.draftJson;

  if (hasPendingDraft) {
    return {
      definition: input.draftDefinition,
      status: "pending-draft",
    };
  }

  if (input.acceptedDefinition) {
    return {
      definition: input.acceptedDefinition,
      status: "accepted",
    };
  }

  if (input.draftDefinition) {
    return {
      definition: input.draftDefinition,
      status: "draft-only",
    };
  }

  return {
    definition: null,
    status: null,
  };
}

export function MemberDefinitionCard({
  locale,
  workspace,
  currentMembership,
}: MemberDefinitionCardProps) {
  const acceptedDefinition = useMemo(
    () =>
      safeParseJson<MemberDefinitionDraft | null>(
        currentMembership.definitionAcceptedJson,
        null,
      ),
    [currentMembership.definitionAcceptedJson],
  );
  const draftDefinition = useMemo(
    () =>
      safeParseJson<MemberDefinitionDraft | null>(
        currentMembership.definitionDraftJson,
        null,
      ),
    [currentMembership.definitionDraftJson],
  );
  const resetKey = [
    currentMembership.rolePresetKey ?? "role:none",
    currentMembership.title ?? "title:none",
    currentMembership.persona ?? "persona:none",
    currentMembership.definitionAcceptedJson ?? "accepted:none",
    currentMembership.definitionDraftJson ?? "draft:none",
    workspace.profileType ?? "profile:none",
    workspace.focusAreas ?? "focus:none",
  ].join("::");

  return (
    <MemberDefinitionCardBody
      key={resetKey}
      storageVersionKey={resetKey}
      locale={locale}
      workspace={workspace}
      currentMembership={currentMembership}
      acceptedDefinition={acceptedDefinition}
      draftDefinition={draftDefinition}
    />
  );
}

type MemberDefinitionCardBodyProps = MemberDefinitionCardProps & {
  acceptedDefinition: MemberDefinitionDraft | null;
  draftDefinition: MemberDefinitionDraft | null;
  storageVersionKey: string;
};

function MemberDefinitionCardBody({
  locale,
  workspace,
  currentMembership,
  acceptedDefinition,
  draftDefinition,
  storageVersionKey,
}: MemberDefinitionCardBodyProps) {
  const router = useRouter();
  const english = locale === "en-US";
  const [, startTransition] = useTransition();
  const rolePresetOptions = useMemo(
    () => listWorkspaceRolePresetOptions(workspace.configuration, locale),
    [locale, workspace.configuration],
  );
  const displayState = resolveMemberDefinitionDisplayState({
    acceptedDefinition,
    draftDefinition,
    acceptedJson: currentMembership.definitionAcceptedJson,
    draftJson: currentMembership.definitionDraftJson,
  });
  const initialDefinition = displayState.definition;
  const initialRolePresetKey = resolveWorkspaceRolePresetKey({
    rawConfiguration: workspace.configuration,
    requestedRolePresetKey:
      initialDefinition?.rolePresetKey ?? currentMembership.rolePresetKey,
    title: currentMembership.title,
    persona: currentMembership.persona,
    workspaceProfileType: workspace.profileType,
  });
  const [rolePresetKey, setRolePresetKey] = useState(initialRolePresetKey);
  const [title, setTitle] = useState(currentMembership.title ?? "");
  const [customNotes, setCustomNotes] = useState(initialDefinition?.customNotes ?? "");
  const [editor, setEditor] = useState<DefinitionEditorState>(buildEditorState(initialDefinition));
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const rolePresetDefinition = getWorkspaceRolePresetDefinition(
    rolePresetKey,
    workspace.configuration,
  );
  const localizedPreset = rolePresetDefinition
    ? localizeWorkspaceRolePreset(rolePresetDefinition, locale)
    : {
        summary: english
          ? "The selected role preset is no longer available in this workspace."
          : "当前工作区已不再提供所选角色预设。",
      };
  const focusAreas = safeParseJson<string[]>(workspace.focusAreas, []).filter(Boolean);
  const localDraftStorageKey = `helm:member-definition-editor:${currentMembership.id}`;
  const canPersistDefinition = isEditorComplete(editor);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let restoreTimer: number | null = null;

    try {
      const rawSnapshot = window.localStorage.getItem(localDraftStorageKey);
      if (!rawSnapshot) {
        return;
      }

      const snapshot = JSON.parse(rawSnapshot) as Partial<LocalEditorSnapshot>;
      const snapshotRolePresetKey =
        typeof snapshot.rolePresetKey === "string" ? snapshot.rolePresetKey : null;

      if (
        snapshot.serverKey !== storageVersionKey ||
        !snapshotRolePresetKey ||
        !getWorkspaceRolePresetDefinition(
          snapshotRolePresetKey,
          workspace.configuration,
        ) ||
        !isDefinitionEditorState(snapshot.editor)
      ) {
        return;
      }

      const editorSnapshot = snapshot.editor;
      restoreTimer = window.setTimeout(() => {
        setRolePresetKey(snapshotRolePresetKey);
        setTitle(typeof snapshot.title === "string" ? snapshot.title : "");
        setCustomNotes(typeof snapshot.customNotes === "string" ? snapshot.customNotes : "");
        setEditor(editorSnapshot);
        setHasUnsavedChanges(true);
      }, 0);
    } catch {
      window.localStorage.removeItem(localDraftStorageKey);
    }

    return () => {
      if (restoreTimer !== null) {
        window.clearTimeout(restoreTimer);
      }
    };
  }, [localDraftStorageKey, storageVersionKey, workspace.configuration]);

  useEffect(() => {
    if (typeof window === "undefined" || !hasUnsavedChanges) {
      return;
    }

    const snapshot: LocalEditorSnapshot = {
      serverKey: storageVersionKey,
      rolePresetKey,
      title,
      customNotes,
      editor,
    };
    window.localStorage.setItem(localDraftStorageKey, JSON.stringify(snapshot));
  }, [
    customNotes,
    editor,
    hasUnsavedChanges,
    localDraftStorageKey,
    rolePresetKey,
    storageVersionKey,
    title,
  ]);

  const clearLocalEditorSnapshot = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(localDraftStorageKey);
    }
  };

  const updateEditorField = (field: keyof DefinitionEditorState, value: string) => {
    setEditor((current) => ({ ...current, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const generateDraft = () => {
    startTransition(async () => {
      const result = await generateCurrentMemberDefinitionDraftAction({
        rolePresetKey,
        title: title.trim() || undefined,
        customNotes: customNotes.trim() || undefined,
      });

      if (!result.ok || !result.draft) {
        toast.error(result.error ?? (english ? "Failed to generate a member definition draft" : "生成成员定义草稿失败"));
        return;
      }

      setEditor(buildEditorState(result.draft));
      setHasUnsavedChanges(false);
      clearLocalEditorSnapshot();
      toast.success(english ? "Member definition draft refreshed" : "成员定义草稿已刷新");
      router.refresh();
    });
  };

  const saveDraft = () => {
    startTransition(async () => {
      const result = await saveCurrentMemberDefinitionDraftAction({
        rolePresetKey,
        title: title.trim() || undefined,
        customNotes: customNotes.trim() || undefined,
        mission: editor.mission.trim(),
        ownedOutcomes: splitLines(editor.ownedOutcomes),
        mainJudgements: splitLines(editor.mainJudgements),
        handoffEdges: splitLines(editor.handoffEdges),
        successSignals: splitLines(editor.successSignals),
        boundaryNotes: splitLines(editor.boundaryNotes),
      });

      if (!result.ok || !result.draft) {
        toast.error(result.error ?? (english ? "Failed to save member definition draft" : "保存成员定义草稿失败"));
        return;
      }

      setEditor(buildEditorState(result.draft));
      setHasUnsavedChanges(false);
      clearLocalEditorSnapshot();
      toast.success(english ? "Member definition draft saved" : "成员定义草稿已保存");
      router.refresh();
    });
  };

  const acceptDefinition = () => {
    startTransition(async () => {
      const result = await acceptCurrentMemberDefinitionAction({
        rolePresetKey,
        title: title.trim() || undefined,
        customNotes: customNotes.trim() || undefined,
        mission: editor.mission.trim(),
        ownedOutcomes: splitLines(editor.ownedOutcomes),
        mainJudgements: splitLines(editor.mainJudgements),
        handoffEdges: splitLines(editor.handoffEdges),
        successSignals: splitLines(editor.successSignals),
        boundaryNotes: splitLines(editor.boundaryNotes),
      });

      if (!result.ok) {
        toast.error(result.error ?? (english ? "Failed to accept member definition" : "接受成员定义失败"));
        return;
      }

      setHasUnsavedChanges(false);
      clearLocalEditorSnapshot();
      toast.success(english ? "Active member definition updated" : "当前成员定义已更新");
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{english ? "My role preset and working definition" : "我的角色预设与工作定义"}</CardTitle>
          {displayState.status === "pending-draft" ? (
            <Badge variant="warning">{english ? "Draft waiting for acceptance" : "草稿待接受"}</Badge>
          ) : displayState.status === "accepted" ? (
            <Badge variant="info">{english ? "Active definition accepted" : "已接受为当前定义"}</Badge>
          ) : displayState.status === "draft-only" ? (
            <Badge variant="neutral">{english ? "Draft only" : "当前只有草稿"}</Badge>
          ) : null}
          {hasUnsavedChanges ? (
            <Badge variant="warning">{english ? "Unsaved edits" : "有未保存修改"}</Badge>
          ) : null}
        </div>
        <CardDescription>
          {english
            ? "Pick a preset, edit, then accept as your current definition."
            : "挑一个预设，改，再接受成当前定义。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium text-[color:var(--foreground)]">{english ? "Role preset" : "角色预设"}</p>
            <Select
              value={rolePresetKey}
              onValueChange={(value) => {
                setRolePresetKey(value);
                setHasUnsavedChanges(true);
              }}
            >
              <SelectTrigger
                aria-label={english ? "Role preset" : "角色预设"}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rolePresetOptions.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">{localizedPreset.summary}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-[color:var(--foreground)]">{english ? "Current title" : "当前职位"}</p>
            <Input
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setHasUnsavedChanges(true);
              }}
              placeholder={english ? "Title (optional)" : "职位（可选）"}
            />
            <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
              {english
                ? `${currentMembership.user.name} · ${currentMembership.user.email}`
                : `${currentMembership.user.name} · ${currentMembership.user.email}`}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)]/80 p-4 text-sm leading-6 text-[color:var(--muted)]">
          <p className="font-medium text-[color:var(--foreground)]">{english ? "Workspace context" : "当前工作区上下文"}</p>
          <p className="mt-2">
            {workspace.profileType
              ? english
                ? `Workspace posture: ${workspace.profileType}.`
                : `工作区姿态：${workspace.profileType}。`
              : english
                ? "Workspace posture is still unset."
                : "当前工作区姿态还未设置。"}
          </p>
          <p className="mt-1">
            {focusAreas.length > 0
              ? english
                ? `Focus areas: ${focusAreas.join(", ")}.`
                : `关注重点：${focusAreas.join("、")}。`
              : english
                ? "Focus areas are still empty."
                : "当前关注重点还未填写。"}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-[color:var(--foreground)]">{english ? "Personal notes" : "个人补充说明"}</p>
          <Textarea
            value={customNotes}
            onChange={(event) => {
              setCustomNotes(event.target.value);
              setHasUnsavedChanges(true);
            }}
            placeholder={english ? "Anything unique about this role in your team?" : "这个角色在你们团队里有什么特别之处？"}
            rows={3}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={generateDraft}>
            {english ? "Generate draft" : "生成草稿"}
          </Button>
          <Button variant="secondary" onClick={saveDraft} disabled={!hasUnsavedChanges || !canPersistDefinition}>
            {english ? "Save draft" : "保存草稿"}
          </Button>
          <Button onClick={acceptDefinition} disabled={!canPersistDefinition}>
            {english ? "Accept active definition" : "接受为当前定义"}
          </Button>
        </div>

        {hasUnsavedChanges ? (
          <p className="text-sm leading-6 text-[color:var(--status-warning-text)]">
            {canPersistDefinition
              ? english
                ? "Edits are kept in this browser until saved. Save the draft to make it visible after a refresh or on another device."
                : "修改会先保存在本机浏览器里。点击保存草稿后，刷新或换设备也能继续看到。"
              : english
                ? "Edits are kept in this browser, but saving or accepting requires mission plus at least one line in every list."
                : "修改会先保存在本机浏览器里；保存或接受前，每个列表至少需要一条。"}
          </p>
        ) : null}

        <div className="grid gap-4">
          <DefinitionTextarea
            label={english ? "Mission" : "角色使命"}
            value={editor.mission}
            onChange={(value) => updateEditorField("mission", value)}
            rows={3}
          />
          <DefinitionTextarea
            label={english ? "Owned outcomes" : "负责结果"}
            value={editor.ownedOutcomes}
            onChange={(value) => updateEditorField("ownedOutcomes", value)}
          />
          <DefinitionTextarea
            label={english ? "Main judgements" : "主要判断面"}
            value={editor.mainJudgements}
            onChange={(value) => updateEditorField("mainJudgements", value)}
          />
          <DefinitionTextarea
            label={english ? "Handoff edges" : "常见交接边缘"}
            value={editor.handoffEdges}
            onChange={(value) => updateEditorField("handoffEdges", value)}
          />
          <DefinitionTextarea
            label={english ? "Success signals" : "成功信号"}
            value={editor.successSignals}
            onChange={(value) => updateEditorField("successSignals", value)}
          />
          <DefinitionTextarea
            label={english ? "Boundary notes" : "边界说明"}
            value={editor.boundaryNotes}
            onChange={(value) => updateEditorField("boundaryNotes", value)}
          />
        </div>

        <div className="rounded-2xl border border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)]/80 px-4 py-3 text-sm leading-6 text-[color:var(--status-warning-text)]">
          {english
            ? "This definition improves personal operating context. It does not auto-change workspace authority, goal truth, KPI truth, or external commitments."
            : "这层定义只是在增强个人 经营上下文，不会自动改变工作区权限、目标真值、KPI 真值 或外部承诺。"}
        </div>
      </CardContent>
    </Card>
  );
}

function DefinitionTextarea({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-[color:var(--foreground)]">{label}</p>
      <Textarea
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
      />
      <p className="text-xs text-[color:var(--muted-foreground)]">每行一条</p>
    </div>
  );
}

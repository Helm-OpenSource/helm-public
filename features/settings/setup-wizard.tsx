"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { CheckCircle2, Link2, UsersRound } from "lucide-react";
import { WorkspaceUiProvider } from "@/components/providers/workspace-ui-provider";
import { WorkspaceFormAssistPanel } from "@/components/shared/workspace-form-assist-panel";
import { WorkspaceGuidancePanel } from "@/components/shared/workspace-guidance-panel";
import { WorkspaceSurfacePreferences } from "@/components/shared/workspace-surface-preferences";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  addOrganizationMemberAction,
  updateWorkspaceSetupAction,
} from "@/features/settings/actions";
import { buildInviteAcceptanceGuidance } from "@/lib/auth/public-entry";
import {
  listRolePresetOptions,
  suggestRolePresetKeyFromText,
} from "@/lib/definitions/role-presets";
import {
  getLocalizedSetupOptions,
  getLocalizedRoleLabels,
} from "@/lib/i18n/labels";
import { defaultWorkspaceFeatureFlags } from "@/lib/workspace-ops";

type SetupWizardProps = {
  workspaceName: string;
  locale: "zh-CN" | "en-US";
  teamMembers: Array<{
    id: string;
    role: WorkspaceRole;
    status: MembershipStatus;
    joinedAt: Date | null;
    title: string | null;
    rolePresetKey: string | null;
    user: { id: string; name: string; email: string };
  }>;
};

export function SetupWizard({
  workspaceName,
  locale,
  teamMembers: initialTeamMembers,
}: SetupWizardProps) {
  return (
    <WorkspaceUiProvider
      locale={locale}
      pilotMode
      captureConsentRequired
      dataRetentionDays={90}
      featureFlags={defaultWorkspaceFeatureFlags}
      demoMode={null}
    >
      <SetupWizardSurface
        workspaceName={workspaceName}
        locale={locale}
        teamMembers={initialTeamMembers}
      />
    </WorkspaceUiProvider>
  );
}

function SetupWizardSurface({
  workspaceName,
  locale,
  teamMembers: initialTeamMembers,
}: SetupWizardProps) {
  const router = useRouter();
  const english = locale === "en-US";
  const { personaOptions, connectorOptions, focusOptions, strategyOptions } =
    getLocalizedSetupOptions(locale);
  const rolePresetOptions = listRolePresetOptions(locale);
  const roleLabelsByLocale = getLocalizedRoleLabels(locale);
  const steps = english
    ? [
        "Who's running this",
        "Where signals come from",
        "What you care about",
        "Default rules",
        "Invite the team",
        "AI settings",
      ]
    : ["谁在操盘", "信号从哪来", "你最关心什么", "默认规则", "邀请团队", "AI 设置"];
  const inviteStepIndex = 4;
  const [pending, startTransition] = useTransition();
  const [pendingMode, setPendingMode] = useState<"save" | "invite" | null>(
    null,
  );
  const [step, setStep] = useState(0);
  const [profileType, setProfileType] = useState(personaOptions[0]);
  const [connectors, setConnectors] = useState<string[]>(
    connectorOptions.slice(0, 3),
  );
  const [focusAreas, setFocusAreas] = useState<string[]>(
    focusOptions.slice(0, 2),
  );
  const [strategies, setStrategies] = useState<string[]>(
    strategyOptions.slice(0, 3),
  );
  const [defaultLocale, setDefaultLocale] = useState<"zh-CN" | "en-US">(locale);
  const [pilotMode, setPilotMode] = useState(true);
  const [captureConsentRequired, setCaptureConsentRequired] = useState(true);
  const [teamMembers, setTeamMembers] = useState(initialTeamMembers);
  const [memberDraft, setMemberDraft] = useState({
    email: "",
    name: "",
    role: "MEMBER" as WorkspaceRole,
    title: "",
    rolePresetKey: suggestRolePresetKeyFromText(profileType),
  });
  const [inviteFeedback, setInviteFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [featureFlags, setFeatureFlags] = useState({
    ...defaultWorkspaceFeatureFlags,
  });

  useEffect(() => {
    const syncHash = () => {
      if (window.location.hash === "#team-invite") {
        setStep(inviteStepIndex);
      }
    };

    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [inviteStepIndex]);

  const toggle = (
    value: string,
    list: string[],
    setter: (next: string[]) => void,
  ) => {
    setter(
      list.includes(value)
        ? list.filter((item) => item !== value)
        : [...list, value],
    );
  };

  const activeTeamCount = teamMembers.filter(
    (member) => member.status === "ACTIVE",
  ).length;
  const invitedTeamCount = teamMembers.filter(
    (member) => member.status === "INVITED",
  ).length;
  const inviteGuidance = buildInviteAcceptanceGuidance({
    locale,
    workspaceName,
    activeCount: activeTeamCount,
    invitedCount: invitedTeamCount,
  });
  const applyRecommendedSetupPreset = () => {
    setProfileType(personaOptions[0]);
    setConnectors(connectorOptions.slice(0, 3));
    setFocusAreas(focusOptions.slice(0, 2));
    setStrategies(strategyOptions.slice(0, 3));
    setDefaultLocale(locale);
    setPilotMode(true);
    setCaptureConsentRequired(true);
    setFeatureFlags(defaultWorkspaceFeatureFlags);
  };

  const stepGuidanceRecommendations = [
    {
      title:
        step === 0
          ? english
            ? "Lock the operator persona first"
            : "先锁定这支团队的操盘身份"
          : english
            ? "Keep the current step narrow"
            : "先把当前步骤收窄做完",
      body:
        step === 0
          ? english
            ? "Pick the persona first — it shapes guidance across the whole workspace."
            : "先选身份——它会影响后续引导的方向。"
          : english
            ? `Finish ${steps[step]} first.`
            : `先完成「${steps[step]}」。`,
    },
    {
      title: english
        ? "Keep the first loop signal-first"
        : "第一条回路继续保持信号优先",
      body: english
        ? `${connectors.length} sources are selected now. Keep only the 2-3 sources that unlock a real meeting, follow-up, or hot opportunity first; do not mistake broader ingest for first value.`
        : `当前已选 ${connectors.length} 个来源。第一轮只保留能尽快打开真实会议、跟进或高优先机会的 2-3 个高信号来源，不要把更广的导入误当成首轮价值。`,
    },
    {
      title: english
        ? "Bring in teammates before handoff breaks"
        : "别等到交接断掉才邀请团队",
      body: english
        ? `${activeTeamCount} active teammates and ${invitedTeamCount} invited teammates are visible now. Use the invite step to shorten the first operating handoff.`
        : `当前可见 ${activeTeamCount} 位活跃成员、${invitedTeamCount} 位已邀请成员。先把邀请做完，第一轮经营交接会短很多。`,
    },
  ];
  const stepGuidanceReminders = [
    {
      title: english
        ? "Changes here are live defaults"
        : "这里改的是实时默认值",
      body: english
        ? "Setup writes real workspace defaults immediately. It is not a demo-only wizard."
        : "初始化向导写入的是真实工作区默认值，不是只读演示流程。",
    },
    {
      title: english ? "Customer-visible moves still wait for a click" : "客户可见的动作依然要你点一下",
      body: english
        ? "Recommended presets help the form move faster, but they do not remove operator review."
        : "推荐预设只是在加速表单，不会替代操作人的复核。",
      meta:
        step === inviteStepIndex
          ? inviteGuidance.acceptanceHint
          : english
            ? "Judgement stays with the operator."
            : "判断权仍在操作人。",
    },
  ];
  const setupAssistActions = [
    {
      label: english ? "Restore pilot preset" : "恢复推荐试点预设",
      onClick: applyRecommendedSetupPreset,
    },
    {
      label:
        step === inviteStepIndex
          ? english
            ? "Review intelligence defaults"
            : "查看智能默认项"
          : english
            ? "Jump to teammate invites"
            : "跳到团队邀请",
      onClick: () =>
        setStep(step === inviteStepIndex ? steps.length - 1 : inviteStepIndex),
    },
  ];

  const finish = () => {
    startTransition(async () => {
      setPendingMode("save");
      const result = await updateWorkspaceSetupAction({
        profileType,
        connectedSources: connectors,
        focusAreas,
        defaultStrategies: strategies,
        defaultLocale,
        pilotMode,
        captureConsentRequired,
        featureFlags,
      });

      if (!result.ok) {
        setPendingMode(null);
        toast.error(result.error ?? (english ? "Setup failed" : "初始化失败"));
        return;
      }

      toast.success(
        english
          ? "Setup complete. Opening the dashboard now."
          : "初始化完成，已进入今日工作台",
      );
      router.push("/dashboard?entry=setup-first-loop");
      router.refresh();
      setPendingMode(null);
    });
  };

  const addMember = () => {
    startTransition(async () => {
      setPendingMode("invite");
      setInviteFeedback(null);
      const result = await addOrganizationMemberAction(memberDraft);
      if (!result.ok) {
        setPendingMode(null);
        const message =
          result.error ??
          (english ? "Failed to invite teammate" : "邀请团队成员失败");
        setInviteFeedback({
          tone: "error",
          message,
        });
        toast.error(message);
        return;
      }

      if (result.member) {
        setTeamMembers((current) => {
          const next = current.filter(
            (member) => member.id !== result.member.id,
          );
          next.push(result.member);
          return next.sort((left, right) => {
            if (left.status !== right.status) {
              return left.status.localeCompare(right.status);
            }

            return left.user.email.localeCompare(right.user.email);
          });
        });
      }

      const successMessage = result.inviteDispatch?.sent
        ? english
          ? "Teammate invited on DingTalk. They can enter the organization from the DingTalk invite message."
          : "团队成员已通过钉钉邀请。对方可直接从钉钉邀请消息进入组织。"
        : result.inviteDispatch?.reason === "target_unresolved"
          ? english
            ? "Team member added, but DingTalk account was not matched. Invite was not sent."
            : "团队成员已添加，但未匹配到钉钉账号，邀请未发送。"
          : result.inviteDispatch?.reason === "not_configured"
            ? english
              ? "Team member added, but DingTalk app message is not configured."
              : "团队成员已添加，但钉钉应用消息通道未配置。"
            : english
              ? "Team member added. DingTalk invite is pending; sync the DingTalk directory dry-run and retry invite."
              : "团队成员已添加。钉钉邀请待发送，请先同步钉钉目录 dry-run 后重试邀请。";
      setInviteFeedback({
        tone: result.inviteDispatch?.sent ? "success" : "error",
        message: successMessage,
      });
      if (result.inviteDispatch?.sent) {
        toast.success(successMessage);
      } else {
        toast.error(successMessage);
      }
      setMemberDraft({
        email: "",
        name: "",
        role: "MEMBER",
        title: "",
        rolePresetKey: suggestRolePresetKeyFromText(profileType),
      });
      router.refresh();
      setPendingMode(null);
    });
  };

  return (
    <div
      id="setup-wizard"
      className="min-h-screen bg-[radial-gradient(circle_at_top,color-mix(in_oklab,var(--surface)_92%,white_8%),color-mix(in_oklab,var(--background)_94%,var(--surface-subtle)_6%)_52%,var(--background)_100%)] px-6 py-10"
    >
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="space-y-3">
          <p className="text-xs font-medium text-[var(--accent)]">
            {english ? "First-time setup · 6 steps · 12 minutes" : "首次初始化 · 6 步 · 12 分钟"}
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-[color:var(--foreground)]">
            {workspaceName}
          </h1>
          <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
            {english
              ? "Six steps. By the end, Helm knows who operates this workspace, which business signals to watch, and which teammates should review follow-through. First judgement card appears on the dashboard after setup."
              : "六步搞定。结束时 Helm 会知道这个工作区由谁操盘、优先看哪些经营信号、哪些同事需要参与复核。初始化完成后，仪表盘会出现第一张判断卡。"}
          </p>
        </div>

        <div
          className="grid gap-4 md:grid-cols-3"
          data-testid="setup-user-orientation"
        >
          <SetupOrientationCard
            eyebrow={english ? "1 · Identity" : "1 · 先确认你是谁"}
            title={english ? "Set the operating role" : "确定操盘身份"}
            body={
              english
                ? "Helm uses this to decide which guidance, reports and handoffs matter first."
                : "Helm 会据此判断哪些引导、报告和交接最先出现。"
            }
          />
          <SetupOrientationCard
            eyebrow={english ? "2 · Signals" : "2 · 再接入信号"}
            title={english ? "Choose the first signal sources" : "选择第一批信号来源"}
            body={
              english
                ? "Start with the sources that reveal meetings, customer waiting, commitments and blockers."
                : "先选能暴露会议、客户等待、承诺和阻塞的来源。"
            }
          />
          <SetupOrientationCard
            eyebrow={english ? "3 · Review" : "3 · 最后安排复核"}
            title={english ? "Invite reviewers before work moves" : "让该复核的人进来"}
            body={
              english
                ? "Helm prepares reviewable follow-through. It does not create external commitments by itself."
                : "Helm 只准备可复核的推进项，不自动产生对外承诺。"
            }
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_360px]">
          <WorkspaceGuidancePanel
            defaultExpanded
            eyebrow={english ? "What setup actually does" : "这步在做什么"}
            title={
              english
                ? "Each click writes a real default. No fake forms, no throwaway answers."
                : "你点的每一项都会变成真实默认值。没有走过场的表单。"
            }
            summary={
              english
                ? "By step 6, the dashboard, the weekly report and your team's permissions all start from what you set here. So pick deliberately."
                : "走完第 6 步，仪表盘、周报和团队权限的起点都来自这里。所以认真选。"
            }
            recommendations={stepGuidanceRecommendations}
            reminders={stepGuidanceReminders}
            boundary={
              english
                ? "Setup writes real defaults but never expands execution power, and never bypasses review boundaries."
                : "初始化会写入真实默认值，但不会扩大执行权限，也不会绕过任何复核边界。"
            }
            recommendationsLabel={
              english ? "Recommended next moves" : "建议先处理"
            }
            remindersLabel={english ? "Context reminders" : "上下文提醒"}
            boundaryLabel={english ? "Boundary" : "边界"}
          />
          <div className="workspace-surface-stack">
            <WorkspaceSurfacePreferences />
            <WorkspaceFormAssistPanel
              eyebrow={english ? "Setup assist" : "初始化辅助"}
              title={
                english
                  ? "Keep the first setup loop coherent on desktop and mobile."
                  : "让第一轮初始化在桌面和移动端都保持同一套判断顺序。"
              }
              summary={
                english
                  ? "Pick a preset, then tweak only what actually changes for this workspace."
                  : "先选一个预设，再只改这个工作区不一样的字段。"
              }
              bullets={[
                english
                  ? `Current step: ${steps[step]}`
                  : `当前步骤：${steps[step]}`,
                english
                  ? `Selected sources: ${connectors.length} · focus areas: ${focusAreas.length} · strategies: ${strategies.length}`
                  : `已选来源 ${connectors.length} 个 · 关注目标 ${focusAreas.length} 项 · 默认策略 ${strategies.length} 项`,
                english
                  ? "Use teammate invites before setup completes so the first handoff is not delayed."
                  : "在完成初始化前就邀请团队，避免第一轮经营交接被延后。",
              ]}
              actions={setupAssistActions}
              boundary={
                english
                  ? "Assist stays recommendation-first. Final defaults are still confirmed by the operator."
                  : "辅助层仍然先给判断建议，最终默认值仍由操作人确认。"
              }
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {steps.map((item, index) => (
            <Card
              key={item}
              className={
                index === step
                  ? "border-[color:var(--border-strong)] shadow-[var(--shadow-card)]"
                  : "workspace-panel"
              }
            >
              <CardContent className="flex items-center gap-3 py-5">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-2xl ${
                    index <= step
                      ? "bg-[color:var(--accent)] text-[color:var(--accent-foreground)]"
                      : "bg-[color:color-mix(in_oklab,var(--surface-subtle)_86%,var(--background)_14%)] text-[color:var(--muted-foreground)]"
                  }`}
                >
                  {index < step ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">{item}</p>
                  <p className="text-xs text-[color:var(--muted-foreground)]">
                    {english ? `Step ${index + 1}` : `第 ${index + 1} 步`}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card id={step === inviteStepIndex ? "team-invite" : undefined}>
          <CardHeader>
            <CardTitle>{steps[step]}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 0 ? (
              <OptionGrid
                values={personaOptions}
                selected={profileType}
                onToggle={setProfileType}
                single
              />
            ) : null}

            {step === 1 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {connectorOptions.map((connector) => (
                  <button
                    key={connector}
                    type="button"
                    onClick={() => toggle(connector, connectors, setConnectors)}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      connectors.includes(connector)
                        ? "workspace-panel-muted border-[color:var(--border-strong)]"
                        : "workspace-panel hover:border-[color:var(--border-strong)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-[color:var(--foreground)]">
                          {connector}
                        </p>
                        <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                          {english
                            ? "CRM-first connectors are prioritized here. Even demo connections are saved into workspace setup so the shell can guide the next step correctly."
                            : "这里优先配置最关键的信息连接。只要连上，后续首页、跟进、接手和判断就能按真实业务路径往前走。"}
                        </p>
                      </div>
                      <div className="rounded-full bg-[color:color-mix(in_oklab,var(--surface-subtle)_88%,var(--background)_12%)] px-2.5 py-1 text-xs font-medium text-[color:var(--muted)]">
                        {connectors.includes(connector)
                          ? english
                            ? "Connected"
                            : "已连接"
                          : english
                            ? "Not connected"
                            : "未连接"}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}

            {step === 2 ? (
              <OptionGrid
                values={focusOptions}
                selected={focusAreas}
                onToggle={(value) => toggle(value, focusAreas, setFocusAreas)}
              />
            ) : null}

            {step === 3 ? (
              <OptionGrid
                values={strategyOptions}
                selected={strategies}
                onToggle={(value) => toggle(value, strategies, setStrategies)}
              />
            ) : null}

            {step === inviteStepIndex ? (
              <div className="space-y-5">
                <div className="workspace-panel-muted rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <UsersRound className="mt-0.5 h-4 w-4 text-[var(--accent)]" />
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-[color:var(--foreground)]">
                        {inviteGuidance.title}
                      </p>
                      <p className="text-sm leading-6 text-[color:var(--muted)]">
                        {inviteGuidance.summary}
                      </p>
                      <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                        {inviteGuidance.description}
                      </p>
                      <p className="text-sm leading-6 text-[var(--accent)]">
                        {inviteGuidance.acceptanceHint}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <SetupStatCard
                    label={english ? "Active teammates" : "当前 active 成员"}
                    value={
                      english ? `${activeTeamCount}` : `${activeTeamCount} 位`
                    }
                  />
                  <SetupStatCard
                    label={english ? "Invited teammates" : "已邀请成员"}
                    value={
                      english ? `${invitedTeamCount}` : `${invitedTeamCount} 位`
                    }
                  />
                  <SetupStatCard
                    label={english ? "Why this matters" : "为什么现在就做"}
                    value={
                      english
                        ? "Gets the team moving sooner"
                        : "让团队更快进入第一轮推进"
                    }
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    value={memberDraft.email}
                    onChange={(event) =>
                      setMemberDraft((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    placeholder={
                      english ? "Teammate email or phone" : "团队成员邮箱或手机号"
                    }
                    data-testid="setup-invite-email"
                  />
                  <Input
                    value={memberDraft.name}
                    onChange={(event) =>
                      setMemberDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder={english ? "Name (optional)" : "姓名（可选）"}
                  />
                  <Select
                    value={memberDraft.role}
                    onValueChange={(value) =>
                      setMemberDraft((current) => ({
                        ...current,
                        role: value as WorkspaceRole,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(roleLabelsByLocale).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                  <Input
                    value={memberDraft.title}
                    onChange={(event) =>
                      setMemberDraft((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    placeholder={english ? "Title (optional)" : "职位（可选）"}
                  />
                  <Select
                    value={memberDraft.rolePresetKey}
                    onValueChange={(value) =>
                      setMemberDraft((current) => ({
                        ...current,
                        rolePresetKey: value as typeof current.rolePresetKey,
                      }))
                    }
                  >
                    <SelectTrigger>
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
                  <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)]/80 px-4 py-3 text-sm leading-6 text-[color:var(--muted)]">
                    {rolePresetOptions.find(
                      (option) => option.key === memberDraft.rolePresetKey,
                    )?.summary ??
                      (english
                        ? "Pick a role preset to prefill a member definition draft."
                        : "选择角色预设后，会预填一版成员定义草稿。")}
                  </div>
                </div>

                <Button
                  onClick={addMember}
                  disabled={pending || !memberDraft.email}
                  data-testid="setup-invite-add"
                >
                  {pending && pendingMode === "invite"
                    ? english
                      ? "Inviting..."
                      : "邀请中..."
                    : english
                      ? "Invite teammate"
                      : "邀请团队成员"}
                </Button>

                {inviteFeedback ? (
                  <div
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      inviteFeedback.tone === "success"
                        ? "border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)] text-[color:var(--status-success-text)]"
                        : "border-[color:var(--status-danger-border)] bg-[color:var(--status-danger-bg)] text-[color:var(--status-danger-text)]"
                    }`}
                    data-testid="setup-invite-feedback"
                  >
                    {inviteFeedback.message}
                  </div>
                ) : null}

                <div className="space-y-3">
                  {teamMembers.map((member) => (
                    <div
                      key={member.id}
                      className="workspace-panel rounded-2xl px-4 py-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[color:var(--foreground)]">
                            {member.user.name}
                          </p>
                          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                            {member.user.email} ·{" "}
                            {member.title ??
                              (english ? "No title yet" : "未填写职位")}
                          </p>
                          {member.rolePresetKey ? (
                            <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                              {english ? "Role preset" : "角色预设"} ·{" "}
                              {rolePresetOptions.find(
                                (option) => option.key === member.rolePresetKey,
                              )?.label ?? member.rolePresetKey}
                            </p>
                          ) : null}
                          <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                            {member.status === "ACTIVE"
                              ? english
                                ? `Joined ${member.joinedAt ? new Date(member.joinedAt).toLocaleDateString("en-US") : "already"}`
                                : `加入于 ${member.joinedAt ? new Date(member.joinedAt).toLocaleDateString("zh-CN") : "当前组织"}`
                              : english
                                ? "Invited and visible now. They become active once they sign in from the public entry."
                                : "已邀请并保持可见。对方从公开入口登录后，就会自动转成 active。"}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="rounded-full bg-[color:color-mix(in_oklab,var(--surface)_94%,white_6%)] px-3 py-2 text-sm font-medium text-[color:var(--foreground)] ring-1 ring-[color:var(--border)]">
                            {roleLabelsByLocale[member.role]}
                          </div>
                          <div className="rounded-full bg-[var(--accent-soft)] px-3 py-2 text-xs font-medium text-[var(--accent)] ring-1 ring-[color:color-mix(in_oklab,var(--accent)_10%,transparent)]">
                            {member.status === "ACTIVE"
                              ? english
                                ? "Active"
                                : "active"
                              : english
                                ? "Invited"
                                : "已邀请"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {step === steps.length - 1 ? (
              <div className="space-y-5">
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">
                    {english ? "Default interface language" : "默认界面语言"}
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setDefaultLocale("zh-CN")}
                      className={`rounded-2xl border px-4 py-4 text-left transition ${
                        defaultLocale === "zh-CN"
                          ? "workspace-panel-muted border-[color:var(--border-strong)]"
                          : "workspace-panel hover:border-[color:var(--border-strong)]"
                      }`}
                    >
                      <p className="font-medium text-[color:var(--foreground)]">中文</p>
                      <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                        {english
                          ? "Best when the team will demo and operate mainly in Chinese."
                          : "适合面向中文客户演示和日常操作。"}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDefaultLocale("en-US")}
                      className={`rounded-2xl border px-4 py-4 text-left transition ${
                        defaultLocale === "en-US"
                          ? "workspace-panel-muted border-[color:var(--border-strong)]"
                          : "workspace-panel hover:border-[color:var(--border-strong)]"
                      }`}
                    >
                      <p className="font-medium text-[color:var(--foreground)]">English</p>
                      <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                        {english
                          ? "Best for HubSpot / Salesforce stakeholders or mixed-language trial teams."
                          : "适合 HubSpot / Salesforce 客户或中英混合试点团队。"}
                      </p>
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">
                    {english
                      ? "Intelligence settings defaults"
                      : "智能设置默认项"}
                  </p>
                  <div className="grid gap-3">
                    <SetupSwitchRow
                      title={
                        english ? "Keep pilot mode on" : "默认开启试点模式"
                      }
                      description={
                        english
                          ? "Keeps diagnostics, bounded copy and trial controls visible from day one."
                          : "让诊断、边界提示和试点控制从第一天就可见。"
                      }
                      checked={pilotMode}
                      onCheckedChange={setPilotMode}
                    />
                    <SetupSwitchRow
                      title={
                        english
                          ? "Require consent before capture"
                          : "采集前要求授权确认"
                      }
                      description={
                        english
                          ? "Recommended when the workspace will record customer or candidate conversations."
                          : "如果会记录客户或候选人交流，建议默认打开。"
                      }
                      checked={captureConsentRequired}
                      onCheckedChange={setCaptureConsentRequired}
                    />
                    <SetupSwitchRow
                      title={
                        english
                          ? "Show diagnostics in intelligence settings"
                          : "在智能设置中显示诊断入口"
                      }
                      description={
                        english
                          ? "Makes connection quality, recommendation health and capture readiness easy to inspect."
                          : "方便快速检查连接质量、推荐健康度和会话入口准备度。"
                      }
                      checked={featureFlags.diagnosticsCenter}
                      onCheckedChange={(checked) =>
                        setFeatureFlags((state) => ({
                          ...state,
                          diagnosticsCenter: checked,
                        }))
                      }
                    />
                    <SetupSwitchRow
                      title={
                        english
                          ? "Prioritize CRM-first connections"
                          : "优先使用客户关系系统连接"
                      }
                      description={
                        english
                          ? "Puts HubSpot / Salesforce ahead of Aliyun Mail / CSV in setup and settings guidance."
                          : "让 HubSpot / Salesforce 在初始化和智能设置里优先于阿里邮箱 / CSV。"
                      }
                      checked={featureFlags.crmFirstImports}
                      onCheckedChange={(checked) =>
                        setFeatureFlags((state) => ({
                          ...state,
                          crmFirstImports: checked,
                        }))
                      }
                    />
                    <SetupSwitchRow
                      title={
                        english ? "Enable LLM enhancement" : "开启模型增强"
                      }
                      description={
                        english
                          ? "Keeps briefing and recommendation explanation ready once model credentials are configured."
                          : "配置好模型凭证后，可直接启用简报和建议说明增强。"
                      }
                      checked={featureFlags.llmEnhancement}
                      onCheckedChange={(checked) =>
                        setFeatureFlags((state) => ({
                          ...state,
                          llmEnhancement: checked,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button
            variant="secondary"
            disabled={step === 0}
            onClick={() => setStep((current) => Math.max(0, current - 1))}
          >
            {english ? "Back" : "上一步"}
          </Button>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_94%,white_6%)] px-4 py-2 text-sm text-[color:var(--muted-foreground)] md:flex">
              <Link2 className="h-4 w-4" />
              {english
                ? "Go straight to the dashboard after setup"
                : "设置完成后立即进入今日工作台"}
            </div>
            {step < steps.length - 1 ? (
              <Button
                onClick={() =>
                  setStep((current) => Math.min(steps.length - 1, current + 1))
                }
                data-testid="setup-next"
              >
                {english ? "Next" : "下一步"}
              </Button>
            ) : (
              <Button
                disabled={pending}
                onClick={finish}
                data-testid="setup-finish"
              >
                {pending && pendingMode === "save"
                  ? english
                    ? "Saving..."
                    : "保存中..."
                  : english
                    ? "Finish setup"
                    : "完成初始化"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SetupOrientationCard({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="theme-surface-panel rounded-3xl px-5 py-5">
      <p className="text-xs font-medium text-[var(--accent)]">
        {eyebrow}
      </p>
      <p className="mt-3 text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
        {title}
      </p>
      <p className="mt-2 text-sm leading-7 text-[color:var(--muted-foreground)]">
        {body}
      </p>
    </div>
  );
}

function OptionGrid({
  values,
  selected,
  onToggle,
  single = false,
}: {
  values: string[];
  selected: string | string[];
  onToggle: (value: string) => void;
  single?: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {values.map((value) => {
        const active = single
          ? selected === value
          : Array.isArray(selected) && selected.includes(value);
        return (
          <button
            key={value}
            type="button"
            onClick={() => onToggle(value)}
            className={`rounded-2xl border px-4 py-4 text-left transition ${
              active
                ? "workspace-panel-muted border-[color:var(--border-strong)]"
                : "workspace-panel hover:border-[color:var(--border-strong)]"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium text-[color:var(--foreground)]">{value}</p>
              <div
                className={`h-5 w-5 rounded-full border ${
                  active
                    ? "border-[color:var(--accent)] bg-[color:var(--accent)]"
                    : "border-[color:var(--border-strong)] bg-[color:color-mix(in_oklab,var(--surface)_94%,white_6%)]"
                }`}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function SetupSwitchRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="workspace-panel flex items-start justify-between gap-4 rounded-2xl px-4 py-4">
      <div className="space-y-1">
        <p className="font-medium text-[color:var(--foreground)]">{title}</p>
        <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SetupStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="workspace-panel-muted rounded-2xl px-4 py-4">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}

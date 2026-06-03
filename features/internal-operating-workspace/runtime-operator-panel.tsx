import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CircleAlert, ShieldAlert, Sparkles, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  releaseMeetingRuntimeTakeoverAction,
  requestMeetingRuntimeCloseAction,
  requestMeetingRuntimeHumanInputCheckpointAction,
  requestMeetingRuntimeTakeoverAction,
  resumeMeetingRuntimeCheckpointAction,
  acceptReflectionCarryForwardAction,
  dismissReflectionCarryForwardAction,
  recordMeetingRuntimeSwarmReadOnlyWorkerAdoptionAction,
  recordMeetingRuntimeSwarmReadOnlyWorkerMaterializationAction,
  recordMeetingRuntimeSwarmReadOnlyWorkerPlaceholderAction,
  recordMeetingRuntimeSwarmReadOnlyWorkerExecutionAction,
  recordMeetingRuntimeSwarmReadOnlyWorkerIntentAction,
  recordMeetingRuntimeSwarmVerificationMergeLaneAction,
  requestMeetingRuntimeSwarmSpawnAction,
  startMeetingRuntimeTakeoverAction,
  updateMeetingRuntimeConsolidationAction,
} from "@/features/meetings/actions";
import { buildPersistedLifecycleTraceReadout } from "@/lib/helm-v2/persisted-lifecycle-trace-readout";
import { buildCloseSettlementHandoffReadout } from "@/lib/helm-v2/close-settlement-handoff-readout";
import { buildTakeoverRemediationHandoffReadout } from "@/lib/helm-v2/takeover-remediation-handoff-readout";
import type { WorkspaceRuntimeOperatorOverview } from "@/lib/helm-v2/runtime-upgrade";

function formatPanelTime(value: Date, english: boolean) {
  return new Intl.DateTimeFormat(english ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function renderStatusTone(status: string) {
  if (status.includes("CRITICAL") || status.includes("HIGH")) return "danger" as const;
  if (status.includes("MEDIUM") || status.includes("LOW")) return "approval" as const;
  if (status.includes("BLOCK") || status.includes("REJECT")) return "danger" as const;
  if (
    status.includes("PASS") ||
    status.includes("PROMOT") ||
    status.includes("RESOLVED") ||
    status.includes("EXECUTED") ||
    status.includes("SAFE")
  ) {
    return "success" as const;
  }
  if (
    status.includes("ASSIGNED") ||
    status.includes("OPEN") ||
    status.includes("REVIEW") ||
    status.includes("DEFER") ||
    status.includes("WAIT") ||
    status.includes("READY") ||
    status.includes("PROGRESS") ||
    status.includes("WATCH") ||
    status.includes("PRUNE") ||
    status.includes("COMPACT")
  ) {
    return "approval" as const;
  }
  return "neutral" as const;
}

function renderStatusLabel(status: string, english: boolean) {
  if (english) return status.replace(/_/g, " ").toLowerCase();

  const normalized = status.replace(/\s+/g, "_").toUpperCase();
  const labels: Record<string, string> = {
    ACTION_READY: "动作就绪",
    REVIEW_NEEDED: "需要复核",
    REVIEW_QUEUE: "复核队列",
    REVIEW_REQUIRED: "需要复核",
    WAITING_ON_SIGNAL: "等待信号",
    WAITING_ON_AUTHORITY: "等待权限",
    CAPABILITY_GAP: "能力缺口",
    PROTECTED_STATE_GAP: "受保护状态缺口",
    PRUNE: "已精简上下文",
    COMPACT: "已压缩上下文",
    SAFE: "正常",
    WATCH: "观察中",
    OPEN: "待处理",
    BLOCKED: "已阻断",
    RESOLVED: "已解决",
    READY: "就绪",
    PENDING: "待处理",
    FAILED: "失败",
  };

  return labels[normalized] ?? status.replace(/_/g, " ");
}

function formatMetricLabel(label: string, english: boolean) {
  if (english) return label;

  const labels: Record<string, string> = {
    cadence: "节奏",
    density: "密度",
    hit: "命中",
    impact: "影响",
    interval: "区间",
    "ineffective after guidance": "指引后无效",
    "ineffective-after-hit": "命中后无效",
    risk: "风险",
    "review escalation": "复核升级",
    sample: "样本",
    skip: "跳过",
    stability: "稳定性",
    "stability confidence": "稳定性置信度",
    threshold: "阈值",
  };

  return labels[label] ?? label;
}

function formatPanelVisibleText(value: string, english: boolean) {
  if (english) return value;

  return value
    .replace(/worker \/ skill \/ resource contracts?/gi, "协作者 / 技能 / 资源约束")
    .replace(/project-scoped/gi, "项目范围内")
    .replace(/project skill library/gi, "项目技能库")
    .replace(/project skill entry/gi, "项目技能条目")
    .replace(/environment execution authority/gi, "环境执行权限")
    .replace(/environment execution seam/gi, "环境执行边界")
    .replace(/environment seam/gi, "环境边界")
    .replace(/capability catalog entry/gi, "能力目录条目")
    .replace(/capability catalog/gi, "能力目录")
    .replace(/capability hints?/gi, "能力提示")
    .replace(/live capability signal\\(s\\)/gi, "实时能力信号")
    .replace(/live capability signal/gi, "实时能力信号")
    .replace(/orchestration authority/gi, "编排权限")
    .replace(/execution posture/gi, "执行状态")
    .replace(/review-gated/gi, "复核后可执行")
    .replace(/protected-field review/gi, "受保护字段复核")
    .replace(/protected-field/gi, "受保护字段")
    .replace(/bounded remediation/gi, "有边界修复")
    .replace(/review required/gi, "需要复核")
    .replace(/review first/gi, "先复核")
    .replace(/approval gated/gi, "审批后可用")
    .replace(/manual-only/gi, "仅人工")
    .replace(/narrowly limited-auto/gi, "窄口径受限自动")
    .replace(/limited auto/gi, "受限自动")
    .replace(/guarded writes?/gi, "受保护写入")
    .replace(/official follow-through/gi, "正式跟进")
    .replace(/official action/gi, "正式动作")
    .replace(/boundary only/gi, "仅边界定义")
    .replace(/active request/gi, "处理中请求")
    .replace(/pending execution/gi, "待执行写入")
    .replace(/execution follow-through open/gi, "未完成执行跟进")
    .replace(/benchmark request/gi, "待基准检查请求")
    .replace(/recorded gate/gi, "已记录关口")
    .replace(/warning/gi, "预警")
    .replace(/fail/gi, "失败项")
    .replace(/acknowledged/gi, "已确认")
    .replace(/deferred/gi, "暂缓")
    .replace(/pending/gi, "待处理")
    .replace(/failed/gi, "失败")
    .replace(/follow-through open/gi, "未完成跟进")
    .replace(/follow-through resolved/gi, "已解决跟进")
    .replace(/live\\b/gi, "实时")
    .replace(/direct/gi, "直接可用")
    .replace(/runtime/gi, "运行层")
    .replace(/authority/gi, "权限")
    .replace(/contract/gi, "约束")
    .replace(/worker/gi, "协作者")
    .replace(/skill/gi, "技能")
    .replace(/resource/gi, "资源");
}

type QueueLinkItem = {
  id: string;
  title: string;
  summary: string;
  secondarySummary?: string | null;
  tertiarySummary?: string | null;
  href: string;
  status?: string;
  meta?: string | null;
  timestamp?: Date;
  actions?: ReactNode;
};

function formatSwarmSpawnRequestLifecycle(input: {
  english: boolean;
  contract: WorkspaceRuntimeOperatorOverview["continuityQueue"][number]["runThread"]["swarmSpawnContract"];
}) {
  const { english, contract } = input;

  if (contract.requestRecordState === "requested") {
    const details = [
      contract.checkpointKey
        ? english
          ? `checkpoint ${contract.checkpointKey}`
          : `检查点 ${contract.checkpointKey}`
        : null,
      contract.requestedBy
        ? english
          ? `requested by ${contract.requestedBy}`
          : `记录人 ${contract.requestedBy}`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return english
      ? `Swarm request recorded. ${details || "Awaiting later execution-stage wiring."}`
      : `多代理派生请求已记录。${details || "当前只记录请求，尚未进入执行态。"} `;
  }

  if (contract.state === "requestable") {
    return english
      ? "Swarm request can be recorded now. No request record exists yet."
      : "当前可以记录多代理派生请求，且尚未形成请求记录。";
  }

  const denyReason =
    contract.denyReason === "workspace_flag_disabled"
      ? english
        ? "workspace flag is disabled"
        : "工作区开关未开启"
      : contract.denyReason === "budget_posture_prune"
        ? english
          ? "budget posture is PRUNE"
          : "预算姿态为 PRUNE"
        : contract.denyReason === "budget_posture_compact"
          ? english
            ? "budget posture is COMPACT"
            : "预算姿态为 COMPACT"
          : contract.denyReason === "run_thread_closed"
            ? english
              ? "run thread is closed"
              : "run 线程已关闭"
            : english
              ? "policy gate is blocking the request"
              : "策略门禁阻断了这次请求";

  return english ? `Swarm request blocked: ${denyReason}.` : `多代理派生请求已阻断：${denyReason}。`;
}

function formatSwarmReadOnlyWorkerContract(input: {
  english: boolean;
  contract: WorkspaceRuntimeOperatorOverview["continuityQueue"][number]["runThread"]["swarmReadOnlyWorkerContract"];
}) {
  const { english, contract } = input;
  const allowlist = english
    ? contract.allowlistedWorkers.join(" / ")
    : contract.allowlistedWorkers
        .map((item) =>
          item === "search" ? "搜索" : item === "grep" ? "检索" : "证据挖掘",
        )
        .join(" / ");
  const state = english
    ? contract.state
    : contract.state === "blocked"
      ? "阻断"
      : contract.state === "requested"
        ? "已记录请求"
        : "就绪";
  const requestLifecycleState = english
    ? contract.requestLifecycleState
    : contract.requestLifecycleState === "blocked"
      ? "阻断"
      : contract.requestLifecycleState === "request_recorded"
        ? "已记录请求"
        : "可记录请求";
  const handoffPreviewState = english
    ? contract.handoffPreviewState
    : contract.handoffPreviewState === "not_ready"
      ? "未就绪"
      : contract.handoffPreviewState === "request_recorded"
        ? "已固定到请求"
        : "预览就绪";
  const previewPacketKeys = contract.previewPacketKeys.slice(0, 2).join(" / ");
  const selectedWorker = english
    ? contract.selectedWorkerKind ?? "no-selection"
    : contract.selectedWorkerKind === "search"
      ? "搜索"
      : contract.selectedWorkerKind === "grep"
        ? "检索"
        : contract.selectedWorkerKind === "evidence_mining"
          ? "证据挖掘"
          : "未选择";
  const bundlePlaceholderState = english
    ? contract.artifactBundlePlaceholderState
    : contract.artifactBundlePlaceholderState === "not_ready"
      ? "未就绪"
      : contract.artifactBundlePlaceholderState === "selection_required"
        ? "待选择"
        : "占位就绪";
  const handoffConsumptionState = english
    ? contract.handoffConsumptionState
    : contract.handoffConsumptionState === "not_ready"
      ? "未就绪"
      : contract.handoffConsumptionState === "selection_required"
        ? "待选择"
        : "可消费";
  const placeholderRecordState = english
    ? contract.artifactBundlePlaceholderRecordState
    : contract.artifactBundlePlaceholderRecordState === "not_ready"
      ? "未就绪"
      : contract.artifactBundlePlaceholderRecordState === "recordable"
        ? "可记录"
        : "已记录";
  const handoffRecordState = english
    ? contract.handoffConsumptionRecordState
    : contract.handoffConsumptionRecordState === "not_ready"
      ? "未就绪"
      : contract.handoffConsumptionRecordState === "recordable"
        ? "可记录"
        : "已记录";
  const executionRecordState = english
    ? contract.executionRecordState
    : contract.executionRecordState === "not_ready"
      ? "未就绪"
      : contract.executionRecordState === "recordable"
        ? "可记录"
        : "已记录";
  const executionPreflightState = english
    ? contract.executionPreflightState
    : contract.executionPreflightState === "blocked"
      ? "阻断"
      : contract.executionPreflightState === "request_required"
        ? "待记录请求"
        : contract.executionPreflightState === "selection_required"
          ? "待选择通道"
          : contract.executionPreflightState === "placeholder_record_required"
            ? "待记录占位"
            : "预检就绪";
  const executionGuardState = english
    ? contract.executionGuardContract.state
    : contract.executionGuardContract.state === "allowed"
      ? "允许"
      : contract.executionGuardContract.state === "reused"
        ? "复用"
        : "阻断";
  const executionLifecycleState = english
    ? contract.executionLifecycleContract.state
    : contract.executionLifecycleContract.state === "blocked"
      ? "阻断"
      : contract.executionLifecycleContract.state === "request_required"
        ? "待记录请求"
        : contract.executionLifecycleContract.state === "selection_required"
          ? "待选择通道"
          : contract.executionLifecycleContract.state === "placeholder_record_required"
            ? "待记录占位"
            : contract.executionLifecycleContract.state === "recordable"
              ? "可记录执行"
              : "已记录执行";
  const executionCandidateState = english
    ? contract.executionCandidateContract.state
    : contract.executionCandidateContract.state === "candidate_ready"
      ? "候选已就绪"
      : "未就绪";
  const artifactMaterializationState = english
    ? contract.executionCandidateContract.artifactMaterializationState
    : contract.executionCandidateContract.artifactMaterializationState === "intent_ready"
      ? "意图已就绪"
      : "未就绪";
  const materializationGuardState = english
    ? contract.artifactMaterializationGuardContract.state
    : contract.artifactMaterializationGuardContract.state === "allowed"
      ? "允许"
      : "阻断";
  const materializationRecordState = english
    ? contract.artifactMaterializationRecordState
    : contract.artifactMaterializationRecordState === "recorded"
      ? "已记录"
      : contract.artifactMaterializationRecordState === "recordable"
        ? "可记录"
        : "未就绪";
  const materializationLifecycleState = english
    ? contract.artifactMaterializationLifecycleContract.state
    : contract.artifactMaterializationLifecycleContract.state === "recorded"
      ? "已记录物化"
      : contract.artifactMaterializationLifecycleContract.state === "recordable"
        ? "可记录物化"
        : "阻断";
  const resultSideOutputState = english
    ? contract.resultSideOutputContract.state
    : contract.resultSideOutputContract.state === "output_ready"
      ? "输出已就绪"
      : "未就绪";
  const resultSideOutputGuardState = english
    ? contract.resultSideOutputGuardContract.state
    : contract.resultSideOutputGuardContract.state === "allowed"
      ? "允许"
      : "阻断";
  const resultSideOutputLifecycleState = english
    ? contract.resultSideOutputLifecycleContract.state
    : contract.resultSideOutputLifecycleContract.state === "consumable"
      ? "可消费"
      : "阻断";
  const outputConsumptionState = english
    ? contract.outputConsumptionContract.state
    : contract.outputConsumptionContract.state === "consumable"
      ? "可消费"
      : "未就绪";
  const resultAdoptionState = english
    ? contract.resultAdoptionContract.state
    : contract.resultAdoptionContract.state === "adoption_ready"
      ? "可采纳"
      : "未就绪";
  const outputAdoptionGuardState = english
    ? contract.outputAdoptionGuardContract.state
    : contract.outputAdoptionGuardContract.state === "allowed"
      ? "允许"
      : "阻断";
  const outputAdoptionRecordState = english
    ? contract.outputAdoptionRecordState
    : contract.outputAdoptionRecordState === "recorded"
      ? "已记录"
      : contract.outputAdoptionRecordState === "recordable"
        ? "可记录"
        : "未就绪";
  const outputAdoptionLifecycleState = english
    ? contract.outputAdoptionLifecycleContract.state
    : contract.outputAdoptionLifecycleContract.state === "recorded"
      ? "已记录"
      : contract.outputAdoptionLifecycleContract.state === "recordable"
        ? "可记录"
        : "阻断";
  const resultAdoptionResultSideState = english
    ? contract.resultAdoptionResultSideContract.state
    : contract.resultAdoptionResultSideContract.state === "output_ready"
      ? "输出已就绪"
      : "未就绪";

  return english
    ? `Read-only workers ${allowlist}. Artifact-first, no transcript merge, state ${state}, request ${requestLifecycleState}, handoff preview ${handoffPreviewState}, preview packets ${contract.previewPacketKeys.length}${previewPacketKeys ? ` (${previewPacketKeys})` : ""}, packet intent ${contract.packetConsumptionIntentState}, bundle placeholder ${bundlePlaceholderState}, execution record ${executionRecordState}, placeholder record ${placeholderRecordState}, handoff consumption ${handoffConsumptionState}, handoff record ${handoffRecordState}, execution lifecycle ${executionLifecycleState}, execution candidate ${executionCandidateState}, materialization ${artifactMaterializationState}, materialization guard ${materializationGuardState}, materialization record ${materializationRecordState}, materialization lifecycle ${materializationLifecycleState}, result-side output ${resultSideOutputState}, output guard ${resultSideOutputGuardState}, output lifecycle ${resultSideOutputLifecycleState}, output consumption ${outputConsumptionState}, result adoption ${resultAdoptionState}, adoption guard ${outputAdoptionGuardState}, adoption record ${outputAdoptionRecordState}, adoption lifecycle ${outputAdoptionLifecycleState}, adoption result-side ${resultAdoptionResultSideState}, preflight ${executionPreflightState}, execution guard ${executionGuardState}, selected ${selectedWorker}${contract.placeholderBundleKey ? `, bundle ${contract.placeholderBundleKey}` : ""}.`
    : `只读子代理：${allowlist}。保持产物优先、不回灌长对话记录，当前状态 ${state}，请求态 ${requestLifecycleState}，交接包预览 ${handoffPreviewState}，预览包 ${contract.previewPacketKeys.length} 个${previewPacketKeys ? `（${previewPacketKeys}）` : ""}，消费意图 ${contract.packetConsumptionIntentState === "not_ready" ? "未就绪" : contract.packetConsumptionIntentState === "selection_required" ? "待选择" : "已记录"}，产物包占位 ${bundlePlaceholderState}，执行记录 ${executionRecordState}，占位记录 ${placeholderRecordState}，交接消费 ${handoffConsumptionState}，交接记录 ${handoffRecordState}，执行生命周期 ${executionLifecycleState}，执行候选 ${executionCandidateState}，产物物化 ${artifactMaterializationState}，物化门禁 ${materializationGuardState}，物化记录 ${materializationRecordState}，物化生命周期 ${materializationLifecycleState}，结果侧输出 ${resultSideOutputState}，输出门禁 ${resultSideOutputGuardState}，输出生命周期 ${resultSideOutputLifecycleState}，输出消费 ${outputConsumptionState}，结果采纳 ${resultAdoptionState}，采纳门禁 ${outputAdoptionGuardState}，采纳记录 ${outputAdoptionRecordState}，采纳生命周期 ${outputAdoptionLifecycleState}，采纳结果侧 ${resultAdoptionResultSideState}，执行前置 ${executionPreflightState}，执行门禁 ${executionGuardState}，当前选择 ${selectedWorker}${contract.placeholderBundleKey ? `，占位包 ${contract.placeholderBundleKey}` : ""}。`;
}

function formatSwarmReadOnlyWorkerLabel(
  workerKind: WorkspaceRuntimeOperatorOverview["continuityQueue"][number]["runThread"]["swarmReadOnlyWorkerContract"]["allowlistedWorkers"][number],
  english: boolean,
) {
  if (english) {
    return workerKind === "evidence_mining" ? "Evidence" : workerKind[0].toUpperCase() + workerKind.slice(1);
  }
  return workerKind === "search" ? "搜索" : workerKind === "grep" ? "检索" : "证据挖掘";
}

function formatSwarmVerificationMergeLaneContract(input: {
  english: boolean;
  contract: WorkspaceRuntimeOperatorOverview["continuityQueue"][number]["runThread"]["swarmVerificationMergeLaneContract"];
}) {
  const { english, contract } = input;
  const state = english
    ? contract.state
    : contract.state === "recorded"
      ? "已记录"
      : contract.state === "recordable"
        ? "可记录"
        : "未就绪";
  const truth = english
    ? contract.mergeLaneTruth ?? "no-truth"
    : contract.mergeLaneTruth === "mergeable"
      ? "可合流"
      : contract.mergeLaneTruth === "rework_required"
        ? "需返工"
        : contract.mergeLaneTruth === "human_review_required"
          ? "需人工复核"
          : "暂无结论";

  return english
    ? `Verification merge lane ${state} · ${truth} · ${contract.driver} · ${contract.verificationStatus ?? "no-verification"}${contract.disagreementSummary ? ` · disagreement ${contract.disagreementSummary}` : ""}.`
    : `验证合流 ${state} · ${truth} · ${contract.driver} · ${contract.verificationStatus ?? "no-verification"}${contract.disagreementSummary ? ` · 分歧 ${contract.disagreementSummary}` : ""}。`;
}

function QueueCard({
  title,
  description,
  emptyLabel,
  english,
  items,
}: {
  title: string;
  description: string;
  emptyLabel: string;
  english: boolean;
  items: QueueLinkItem[];
}) {
  const copy = (value: string) => formatPanelVisibleText(value, english);

  return (
    <Card className="workspace-shell-panel border-[color:var(--mode-card-border)]">
      <CardHeader>
        <CardTitle className="text-lg tracking-tight text-[color:var(--foreground)]">
          {copy(title)}
        </CardTitle>
        <CardDescription className="text-sm leading-7 text-[color:var(--muted-foreground)]">
          {copy(description)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-[color:var(--border)] px-3 py-3 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <Link
                href={item.href}
                aria-label={english ? `Open ${item.title}` : `打开${copy(item.title)}`}
                className="min-w-0 flex-1"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-[color:var(--foreground)]">
                    {copy(item.title)}
                  </p>
                  {item.status ? (
                    <Badge variant={renderStatusTone(item.status)}>{renderStatusLabel(item.status, english)}</Badge>
                  ) : null}
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-6 text-[color:var(--muted-foreground)]">
                  {copy(item.summary)}
                </p>
                {item.secondarySummary ? (
                  <p className="mt-1 line-clamp-1 text-xs leading-6 text-[color:var(--muted-foreground)]">
                    {copy(item.secondarySummary)}
                  </p>
                ) : null}
                {item.tertiarySummary ? (
                  <p className="mt-1 line-clamp-1 text-xs leading-6 text-[color:var(--muted-foreground)]">
                    {copy(item.tertiarySummary)}
                  </p>
                ) : null}
                {item.meta || item.timestamp ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                    {item.meta ? <span>{item.meta}</span> : null}
                    {item.timestamp ? (
                      <span>
                        {english ? formatPanelTime(item.timestamp, true) : formatPanelTime(item.timestamp, false)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </Link>
              {item.actions ? <div className="flex shrink-0 flex-wrap gap-2">{item.actions}</div> : null}
            </div>
          </div>
        ))}
        {!items.length ? (
          <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-3 py-5 text-sm text-[color:var(--muted-foreground)]">
            {copy(emptyLabel)}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function buildSwarmOperatorControlActions(input: {
  english: boolean;
  canManageRuntime: boolean;
  overview: WorkspaceRuntimeOperatorOverview;
}) {
  const { english, canManageRuntime, overview } = input;
  const surface = overview.swarmOperatorControlSurface;

  if (!canManageRuntime || !surface.focusMeetingId || !surface.focusSessionId) {
    return null;
  }

  const actions: ReactNode[] = [];
  const focusInput = {
    meetingId: surface.focusMeetingId,
    sessionId: surface.focusSessionId,
    sourcePage: "/operating",
  } as const;

  if (surface.controls.pause.actionIntent === "request_pause") {
    actions.push(
      <form
        key="pause"
        action={async () => {
          "use server";
          await requestMeetingRuntimeHumanInputCheckpointAction(focusInput);
        }}
      >
        <Button size="sm" type="submit">
          {english ? "Pause" : "暂停"}
        </Button>
      </form>,
    );
  }

  if (
    surface.controls.resume.actionIntent === "resume_checkpoint" &&
    surface.controls.resume.checkpointId
  ) {
    actions.push(
      <form
        key="resume"
        action={async () => {
          "use server";
          await resumeMeetingRuntimeCheckpointAction({
            meetingId: surface.focusMeetingId!,
            sessionId: surface.focusSessionId!,
            checkpointId: surface.controls.resume.checkpointId!,
            sourcePage: "/operating",
          });
        }}
      >
        <Button size="sm" type="submit" variant="secondary">
          {english ? "Resume" : "恢复"}
        </Button>
      </form>,
    );
  }

  if (surface.controls.kill.actionIntent === "request_kill") {
    actions.push(
      <form
        key="kill"
        action={async () => {
          "use server";
          await requestMeetingRuntimeCloseAction(focusInput);
        }}
      >
        <Button size="sm" type="submit" variant="secondary">
          {english ? "Kill (close request)" : "Kill（close request）"}
        </Button>
      </form>,
    );
  }

  if (surface.controls.fallback.actionIntent === "request_fallback") {
    actions.push(
      <form
        key="fallback-request"
        action={async () => {
          "use server";
          await requestMeetingRuntimeTakeoverAction(focusInput);
        }}
      >
        <Button size="sm" type="submit">
          {english ? "Fallback" : "兜底接管"}
        </Button>
      </form>,
    );
  }

  if (surface.controls.fallback.actionIntent === "start_fallback") {
    actions.push(
      <form
        key="fallback-start"
        action={async () => {
          "use server";
          await startMeetingRuntimeTakeoverAction(focusInput);
        }}
      >
        <Button size="sm" type="submit">
          {english ? "Start fallback" : "启动兜底"}
        </Button>
      </form>,
    );
  }

  if (surface.controls.fallback.actionIntent === "release_fallback") {
    actions.push(
      <form
        key="fallback-release"
        action={async () => {
          "use server";
          await releaseMeetingRuntimeTakeoverAction(focusInput);
        }}
      >
        <Button size="sm" type="submit" variant="secondary">
          {english ? "Release fallback" : "释放人工接管"}
        </Button>
      </form>,
    );
  }

  return actions.length ? <>{actions}</> : null;
}

export function RuntimeOperatorPanel({
  english,
  overview,
  canManageRuntime,
  canReviewRuntime,
}: {
  english: boolean;
  overview: WorkspaceRuntimeOperatorOverview;
  canManageRuntime: boolean;
  canReviewRuntime: boolean;
}) {
  return (
    <section className="space-y-4" data-helm-v2-runtime-operator-surface="workspace">
      <Card className="workspace-panel-muted border-[color:var(--border)]">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{english ? "Runtime hardening" : "运行链加固"}</Badge>
            <Badge variant="neutral">{english ? "workspace operator surface" : "工作区操作台"}</Badge>
            <Badge variant="neutral">
              {english ? `${overview.summary.activeSessions} active sessions` : `${overview.summary.activeSessions} 个运行会话`}
            </Badge>
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl tracking-tight text-[color:var(--foreground)]">
              {english ? "Runtime operator queues" : "运行链操作队列"}
            </CardTitle>
            <CardDescription className="text-sm leading-7 text-[color:var(--muted-foreground)]">
              {english
                ? "Verification, promotion, handoff and failure traces — visible but never auto-sent."
                : "验证、提升、交接、失败痕迹——可见但不会自动外发。"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 xl:grid-cols-5">
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <div className="text-xs font-medium text-[color:var(--mode-link)]">
                {english ? "action ready" : "动作就绪"}
              </div>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                {overview.coordinationMetrics.actionReady}
              </p>
            </div>
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <div className="text-xs font-medium text-[color:var(--mode-link)]">
                {english ? "review needed" : "需要复核"}
              </div>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                {overview.coordinationMetrics.reviewNeeded}
              </p>
            </div>
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <div className="text-xs font-medium text-[color:var(--mode-link)]">
                {english ? "waiting on signal" : "等待信号"}
              </div>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                {overview.coordinationMetrics.waitingOnSignal}
              </p>
            </div>
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <div className="text-xs font-medium text-[color:var(--mode-link)]">
                {english ? "waiting on authority" : "等待权限"}
              </div>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                {overview.coordinationMetrics.waitingOnAuthority}
              </p>
            </div>
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <div className="text-xs font-medium text-[color:var(--mode-link)]">
                {english ? "capability gap" : "能力缺口"}
              </div>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                {overview.coordinationMetrics.capabilityGap}
              </p>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-10">
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                <ShieldAlert className="h-3.5 w-3.5" />
                {english ? "review queue" : "复核队列"}
              </div>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                {overview.summary.reviewQueue}
              </p>
              <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                {english ? "verification and truth conflicts waiting for operator judgement" : "等待操作人判断的验证与事实冲突"}
              </p>
            </div>
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                <CircleAlert className="h-3.5 w-3.5" />
                {english ? "operating gaps" : "经营缺口"}
              </div>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                {overview.summary.operatingGapQueue}
              </p>
              <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                {english
                  ? `${overview.summary.criticalOperatingGaps} critical gaps still need explicit operator follow-through`
                  : `${overview.summary.criticalOperatingGaps} 条关键缺口仍需要操作人明确推进`}
              </p>
              <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                {overview.businessLoopGapSummary.primaryGap
                  ? english
                    ? `${overview.businessLoopGapSummary.reviewRequired} open business loops, led by ${overview.businessLoopGapSummary.primaryGap.title.toLowerCase()}.`
                    : `${overview.businessLoopGapSummary.reviewRequired} 条业务闭环未收，当前由 ${overview.businessLoopGapSummary.primaryGap.title} 领跑。`
                  : english
                    ? "No open business loop is outranking the rest of the operator queue right now."
                    : "当前没有未收的业务闭环排到操作队列最前面。"}
              </p>
            </div>
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                <Sparkles className="h-3.5 w-3.5" />
                {english ? "promotion queue" : "记忆提升队列"}
              </div>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                {overview.summary.promotionQueue}
              </p>
              <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                {english ? "memory candidates that still need verification or promotion judgement" : "仍需验证或提升判断的记忆候选"}
              </p>
            </div>
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                <Target className="h-3.5 w-3.5" />
                {english ? "problem spaces" : "问题空间"}
              </div>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                {overview.summary.openProblemSpaces}
              </p>
              <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                {english ? "open issues with explicit next step and owner hint" : "带有明确下一步和负责人提示的未完问题"}
              </p>
            </div>
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                <CircleAlert className="h-3.5 w-3.5" />
                {english ? "composition failures" : "整理失败"}
              </div>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                {overview.summary.unresolvedCompositionFailures}
              </p>
              <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                {english ? "operator-visible coordination failures that still need follow-through" : "仍需继续推进的协同失败"}
              </p>
            </div>
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                <Sparkles className="h-3.5 w-3.5" />
                {english ? "reflection" : "复盘候选"}
              </div>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                {overview.summary.reflectionQueue}
              </p>
              <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                {english
                  ? "Carry-forward summaries from trusted state, pending review"
                  : "可信状态生成的延续摘要，等待复核"}
              </p>
            </div>
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                <Sparkles className="h-3.5 w-3.5" />
                {english ? "延续" : "延续复用"}
              </div>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                {overview.summary.reflectionCarryForward}
              </p>
              <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                {english
                  ? "review-safe reflection candidates that can inform memory work without auto-promoting truth"
                  : "可以支持后续记忆整理、但不会自动提升为事实的复盘候选"}
              </p>
            </div>
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                <Sparkles className="h-3.5 w-3.5" />
                {english ? "consolidation" : "后台整理"}
              </div>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                {overview.summary.consolidationQueue}
              </p>
              <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                {english ? "candidate-only background jobs that remain operator-auditable" : "候选态后台整理，仍可由操作人审计"}
              </p>
            </div>
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                <ArrowRight className="h-3.5 w-3.5" />
                {english ? "cache health" : "缓存健康度"}
              </div>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                {overview.summary.cacheHitRate}%
              </p>
              <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                {english
                  ? `${overview.summary.tokensSaved} tokens saved across ${overview.cacheHealth.entries} recent entries`
                  : `最近 ${overview.cacheHealth.entries} 条里累计节省 ${overview.summary.tokensSaved} 个上下文 token`}
              </p>
            </div>
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                <ArrowRight className="h-3.5 w-3.5" />
                {english ? "prune posture" : "上下文精简状态"}
              </div>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                {overview.summary.pruneSessions}
              </p>
              <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                {english ? "sessions currently showing budget-prune posture" : "当前进入预算精简状态的会话数"}
              </p>
            </div>
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                <ArrowRight className="h-3.5 w-3.5" />
                {english ? "compact posture" : "压缩恢复状态"}
              </div>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                {overview.summary.compactSessions}
              </p>
              <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                {english ? "sessions currently running on resumed checkpoint posture" : "当前从检查点恢复运行的会话数"}
              </p>
            </div>
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                <ArrowRight className="h-3.5 w-3.5" />
                {english ? "weak replay" : "弱回放"}
              </div>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                {overview.summary.weakReplaySessions}
              </p>
              <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                {english ? "sessions with weak checkpoint replay fidelity" : "检查点回放可信度偏弱的会话数"}
              </p>
            </div>
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                <ArrowRight className="h-3.5 w-3.5" />
                {english ? "high continuity risk" : "连续性高风险"}
              </div>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                {overview.summary.highRiskContinuitySessions}
              </p>
              <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                {english ? "sessions that need continuity-first operator intervention" : "需要优先处理连续性风险的会话数"}
              </p>
            </div>
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                <ArrowRight className="h-3.5 w-3.5" />
                {english ? "checkpoint-derived state" : "检查点派生状态"}
              </div>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                {overview.summary.checkpointDerivedContinuitySessions}
              </p>
              <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                {english ? "sessions whose active payload state comes from checkpoint continuity" : "当前运行资料来自检查点连续性的会话数"}
              </p>
            </div>
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                <ArrowRight className="h-3.5 w-3.5" />
                {english ? "Recoverable" : "可恢复"}
              </div>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                {overview.summary.recoverableContinuitySessions}
              </p>
              <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                {english ? "Sessions recoverable through bounded actions." : "通过有边界动作可以恢复的会话。"}
              </p>
            </div>
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                <ShieldAlert className="h-3.5 w-3.5" />
                {english ? "Review required" : "等待复核"}
              </div>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                {overview.summary.reviewRequiredContinuitySessions}
              </p>
              <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                {english ? "Sessions waiting on protected-field review." : "等待 protected-field 复核的会话。"}
              </p>
            </div>
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                <CircleAlert className="h-3.5 w-3.5" />
                {english ? "Blocked" : "受阻"}
              </div>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                {overview.summary.blockedContinuitySessions}
              </p>
              <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                {english ? "Sessions with no safe path forward here." : "在当前面上没有安全推进路径的会话。"}
              </p>
            </div>
            <div className="theme-surface-panel rounded-2xl px-4 py-4" data-testid="continuity-repeat-pattern-card">
              <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                <Sparkles className="h-3.5 w-3.5" />
                {english ? "Repeat patterns" : "反复出现"}
              </div>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                {overview.summary.repeatPatternContinuitySessions}
              </p>
              <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                {english ? "Sessions showing a repeat pattern (blocked / review / re-prune)." : "反复出现 repeat pattern（受阻 / 等待复核 / re-prune）的会话。"}
              </p>
            </div>
            <div className="theme-surface-panel rounded-2xl px-4 py-4" data-testid="continuity-low-confidence-card">
              <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                <Target className="h-3.5 w-3.5" />
                {english ? "Low-confidence recovery" : "恢复置信度低"}
              </div>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                {overview.summary.lowConfidenceContinuitySessions}
              </p>
              <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                {english ? "Recovery state still noisy after pilot calibration." : "校准后恢复状态仍噪声较高。"}
              </p>
            </div>
            <div className="theme-surface-panel rounded-2xl px-4 py-4" data-testid="continuity-ineffective-card">
              <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                <CircleAlert className="h-3.5 w-3.5" />
                {english ? "Ineffective recovery" : "恢复未生效"}
              </div>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                {overview.summary.ineffectiveContinuitySessions}
              </p>
              <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                {english ? "Latest remediation didn't improve continuity enough." : "最近一次修复没有明显改善连续性。"}
              </p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="workspace-shell-panel border-[color:var(--mode-card-border)]" data-testid="continuity-pilot-cases-card">
              <CardHeader>
                <CardTitle className="text-lg tracking-tight text-[color:var(--foreground)]">
                  {english ? "Continuity pilot cases" : "连续性试点案例"}
                </CardTitle>
                <CardDescription className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                  {english
                    ? "Which failure classes recur most often."
                    : "最常反复出现的失败类型。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-2xl font-semibold text-[color:var(--foreground)]">
                  {overview.continuityPilotReview.totalPilotCases}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.workspaceCohort.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.calibrationProfile.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.calibrationProfile.riskBandSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.subgroupCalibration.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.sampleReview.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.sampleReview.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.stabilityReview.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.stabilityReview.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.stabilityRecheck.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.stabilityRecheck.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.stabilityScaleUp.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.stabilityScaleUp.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.stabilityScaleUpRecheck.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.stabilityScaleUpRecheck.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.subgroupStabilityDriftReview.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.subgroupStabilityDriftReview.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.subgroupCohortAgingReview.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.subgroupCohortAgingReview.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.subgroupDriftAgingScaleUpReview.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.subgroupDriftAgingScaleUpReview.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.subgroupDriftLongTermCohortAgingReview.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.subgroupDriftLongTermCohortAgingReview.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.subgroupDriftLongTermSampleExpansionReview.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.subgroupDriftLongTermSampleExpansionReview.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.subgroupDriftLongTermSampleExpansionRefinementReview.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.subgroupDriftLongTermSampleExpansionRefinementReview.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.confidenceSimplification.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.confidenceSimplification.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.intervalWordingConsistency.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.intervalWordingConsistency.aggregateSummary}
                </p>
                <ul className="space-y-1 text-sm text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.sampleReview.cohortHighlights.slice(0, 3).map((item, index) => (
                    <li key={`sample-${item}-${index}`}>- {item}</li>
                  ))}
                  {overview.continuityPilotReview.stabilityReview.subgroupHighlights.slice(0, 3).map((item, index) => (
                    <li key={`stability-${item}-${index}`}>- {item}</li>
                  ))}
                  {overview.continuityPilotReview.stabilityRecheck.highlights.slice(0, 3).map((item, index) => (
                    <li key={`stability-recheck-${item}-${index}`}>- {item}</li>
                  ))}
                  {overview.continuityPilotReview.stabilityScaleUp.findings.slice(0, 3).map((item, index) => (
                    <li key={`stability-scale-up-${item}-${index}`}>- {item}</li>
                  ))}
                  {overview.continuityPilotReview.stabilityScaleUpRecheck.findings.slice(0, 3).map((item, index) => (
                    <li key={`stability-scale-up-recheck-${item}-${index}`}>- {item}</li>
                  ))}
                  {overview.continuityPilotReview.subgroupStabilityDriftReview.findings
                    .slice(0, 3)
                    .map((item, index) => (
                      <li key={`subgroup-stability-drift-${item}-${index}`}>- {item}</li>
                    ))}
                  {overview.continuityPilotReview.subgroupCohortAgingReview.findings
                    .slice(0, 3)
                    .map((item, index) => (
                      <li key={`subgroup-cohort-aging-${item}-${index}`}>- {item}</li>
                    ))}
                  {overview.continuityPilotReview.subgroupDriftAgingScaleUpReview.findings
                    .slice(0, 3)
                    .map((item, index) => (
                      <li key={`subgroup-aging-scale-up-${item}-${index}`}>- {item}</li>
                    ))}
                  {overview.continuityPilotReview.subgroupDriftLongTermCohortAgingReview.findings
                    .slice(0, 3)
                    .map((item, index) => (
                      <li key={`subgroup-long-term-aging-${item}-${index}`}>- {item}</li>
                    ))}
                  {overview.continuityPilotReview.subgroupDriftLongTermSampleExpansionReview.findings
                    .slice(0, 3)
                    .map((item, index) => (
                      <li key={`subgroup-sample-expansion-${item}-${index}`}>- {item}</li>
                    ))}
                  {overview.continuityPilotReview.subgroupDriftLongTermSampleExpansionRefinementReview.findings
                    .slice(0, 3)
                    .map((item, index) => (
                      <li key={`subgroup-sample-expansion-refinement-${item}-${index}`}>- {item}</li>
                    ))}
                  {overview.continuityPilotReview.confidenceSimplification.highlights.slice(0, 3).map((item, index) => (
                    <li key={`interval-${item}-${index}`}>- {item}</li>
                  ))}
                  {overview.continuityPilotReview.intervalWordingConsistency.highlights.slice(0, 3).map((item, index) => (
                    <li key={`interval-wording-${item}-${index}`}>- {item}</li>
                  ))}
                  {overview.continuityPilotReview.subgroupCalibration.cohortHighlights.slice(0, 3).map((item, index) => (
                    <li key={`${item}-${index}`}>- {item}</li>
                  ))}
                </ul>
                <div className="space-y-2 text-sm text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.topFailureClasses.slice(0, 3).map((item) => (
                    <div key={item.failureTaxonomy} className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                      <p className="font-medium text-[color:var(--foreground)]">
                        {item.failureTaxonomy} · {item.confidenceBand} · {formatMetricLabel("threshold", english)} {item.recommendedIneffectiveThreshold} · {formatMetricLabel("stability", english)} {item.stabilityBand} · {formatMetricLabel("stability confidence", english)} {item.stabilityConfidenceBand}
                      </p>
                      <p className="mt-1 leading-6">{item.summary}</p>
                      <p className="mt-1 leading-6">{item.stabilitySummary}</p>
                      <p className="mt-1 leading-6">{item.stabilityVarianceSummary}</p>
                    </div>
                  ))}
                  {!overview.continuityPilotReview.topFailureClasses.length ? (
                    <p>{english ? "No pilot continuity failure class has been grouped yet." : "当前还没有被分组的 pilot 连续性 失败类型。"}</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card className="workspace-shell-panel border-[color:var(--mode-card-border)]" data-testid="continuity-cohort-breakdown-card">
              <CardHeader>
                <CardTitle className="text-lg tracking-tight text-[color:var(--foreground)]">
                  {english ? "Pilot cohorts" : "试点队列"}
                </CardTitle>
                <CardDescription className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                  {english
                    ? "Density, cadence, participant posture, failure history."
                    : "密度、节奏、参与方姿态、失败历史。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.cohortFamilies.slice(0, 3).map((item) => (
                    <div key={item.cohortKey} className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                      <p className="font-medium text-[color:var(--foreground)]">
                        {item.cohortKey} · {formatMetricLabel("risk", english)} {item.riskBand} · {item.confidenceBand} · {formatMetricLabel("threshold", english)} {item.recommendedIneffectiveThreshold} · {formatMetricLabel("sample", english)} {item.sampleCoverageBand} · {formatMetricLabel("stability", english)} {item.stabilityBand} · {formatMetricLabel("stability confidence", english)} {item.stabilityConfidenceBand}
                      </p>
                      <p className="mt-1 leading-6">{item.summary}</p>
                      <p className="mt-1 leading-6">{item.sampleCoverageSummary}</p>
                      <p className="mt-1 leading-6">{item.stabilitySummary}</p>
                      <p className="mt-1 leading-6">{item.stabilityVarianceSummary}</p>
                      <p className="mt-1 leading-6">{item.longHorizonSummary}</p>
                    </div>
                  ))}
                  {!overview.continuityPilotReview.cohortFamilies.length ? (
                    <p>{english ? "No expanded cohort family is available yet." : "当前还没有 expanded cohort family。"}</p>
                  ) : null}
                </div>
                <div className="space-y-2 text-sm text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.meetingShapeCohorts.slice(0, 2).map((item) => (
                    <div key={item.meetingShape} className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                      <p className="font-medium text-[color:var(--foreground)]">
                        {item.meetingShape} · {item.confidenceBand} · {formatMetricLabel("threshold", english)} {item.recommendedIneffectiveThreshold} · {formatMetricLabel("sample", english)} {item.sampleCoverageBand} · {formatMetricLabel("stability", english)} {item.stabilityBand} · {formatMetricLabel("stability confidence", english)} {item.stabilityConfidenceBand}
                      </p>
                      <p className="mt-1 leading-6">{item.summary}</p>
                      <p className="mt-1 leading-6">{item.sampleCoverageSummary}</p>
                      <p className="mt-1 leading-6">{item.stabilitySummary}</p>
                      <p className="mt-1 leading-6">{item.stabilityVarianceSummary}</p>
                      <p className="mt-1 leading-6">{item.driftSummary}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 text-sm text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.sessionDensityCohorts.slice(0, 2).map((item) => (
                    <div key={item.sessionDensityBand} className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                      <p className="font-medium text-[color:var(--foreground)]">
                        {item.sessionDensityBand} {formatMetricLabel("density", english)} · {formatMetricLabel("risk", english)} {item.riskBand} · {item.confidenceBand} · {formatMetricLabel("threshold", english)} {item.recommendedIneffectiveThreshold} · {formatMetricLabel("sample", english)} {item.sampleCoverageBand} · {formatMetricLabel("stability", english)} {item.stabilityBand} · {formatMetricLabel("stability confidence", english)} {item.stabilityConfidenceBand}
                      </p>
                      <p className="mt-1 leading-6">{item.summary}</p>
                      <p className="mt-1 leading-6">{item.sampleCoverageSummary}</p>
                      <p className="mt-1 leading-6">{item.stabilitySummary}</p>
                      <p className="mt-1 leading-6">{item.stabilityVarianceSummary}</p>
                      <p className="mt-1 leading-6">{item.calibrationSummary}</p>
                    </div>
                  ))}
                  {overview.continuityPilotReview.meetingFrequencyCohorts.slice(0, 2).map((item) => (
                    <div key={item.meetingFrequencyBand} className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                      <p className="font-medium text-[color:var(--foreground)]">
                        {item.meetingFrequencyBand} {formatMetricLabel("cadence", english)} · {formatMetricLabel("risk", english)} {item.riskBand} · {item.confidenceBand} · {formatMetricLabel("threshold", english)} {item.recommendedIneffectiveThreshold} · {formatMetricLabel("sample", english)} {item.sampleCoverageBand} · {formatMetricLabel("stability", english)} {item.stabilityBand} · {formatMetricLabel("stability confidence", english)} {item.stabilityConfidenceBand}
                      </p>
                      <p className="mt-1 leading-6">{item.summary}</p>
                      <p className="mt-1 leading-6">{item.sampleCoverageSummary}</p>
                      <p className="mt-1 leading-6">{item.stabilitySummary}</p>
                      <p className="mt-1 leading-6">{item.stabilityVarianceSummary}</p>
                      <p className="mt-1 leading-6">{item.driftSummary}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 text-sm text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.participantRoleCohorts.slice(0, 2).map((item) => (
                    <div key={item.participantRolePosture} className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                      <p className="font-medium text-[color:var(--foreground)]">
                        {item.participantRolePosture} · {formatMetricLabel("risk", english)} {item.riskBand} · {item.confidenceBand} · {formatMetricLabel("threshold", english)} {item.recommendedIneffectiveThreshold} · {formatMetricLabel("sample", english)} {item.sampleCoverageBand} · {formatMetricLabel("stability", english)} {item.stabilityBand} · {formatMetricLabel("stability confidence", english)} {item.stabilityConfidenceBand}
                      </p>
                      <p className="mt-1 leading-6">{item.summary}</p>
                      <p className="mt-1 leading-6">{item.sampleCoverageSummary}</p>
                      <p className="mt-1 leading-6">{item.stabilitySummary}</p>
                      <p className="mt-1 leading-6">{item.stabilityVarianceSummary}</p>
                      <p className="mt-1 leading-6">{item.calibrationSummary}</p>
                    </div>
                  ))}
                </div>
                <ul className="space-y-1 text-sm text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.remediationPostureCohorts.slice(0, 3).map((item) => (
                    <li key={`${item.recoveryState}-${item.latestEffectiveness}`}>
                      - {item.recoveryState} · {item.latestEffectiveness} · {formatMetricLabel("sample", english)} {item.sampleCoverageBand} · {formatMetricLabel("stability", english)} {item.stabilityBand} · {item.summary}
                    </li>
                  ))}
                  {overview.continuityPilotReview.failureHistoryCohorts.slice(0, 3).map((item) => (
                    <li key={item.failureHistoryBand}>
                      - {item.failureHistoryBand} · {formatMetricLabel("sample", english)} {item.sampleCoverageBand} · {formatMetricLabel("stability", english)} {item.stabilityBand} · {item.summary} · {item.varianceSummary}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="workspace-shell-panel border-[color:var(--mode-card-border)]" data-testid="continuity-drift-card">
              <CardHeader>
                <CardTitle className="text-lg tracking-tight text-[color:var(--foreground)]">
                  {english ? "Drift and effectiveness" : "偏移与效果"}
                </CardTitle>
                <CardDescription className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                  {english
                    ? "Improving, stable, or still drifting?"
                    : "在改善、稳定，还是仍在偏移？"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.drift.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.driftSynthesis.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.longTermOutcomeCorrelation.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.longTermOutcomeCorrelation.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.longTermOutcomeReview.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.longTermOutcomeReview.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.longTermMaterialImpactReview.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.longTermMaterialImpactReview.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.longTermMaterialImpactAudit.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.longTermMaterialImpactAudit.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.materialImpactPatternAgingReview.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.materialImpactPatternAgingReview.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.materialImpactSamplingReview.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.materialImpactSamplingReview.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.materialImpactSamplingAgingReview.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.materialImpactSamplingAgingReview.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.materialImpactSamplingAgingRefinement.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.materialImpactSamplingAgingRefinement.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.materialImpactSamplingAgingAudit.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.materialImpactSamplingAgingAudit.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.materialImpactSamplingAgingRefinementAudit.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.materialImpactSamplingAgingRefinementAudit.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.longTermSopImpact.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.longTermSopImpact.aggregateSummary}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                    <p className="text-xs font-medium text-[color:var(--mode-link)]">
                      {english ? "Drift rate" : "偏移率"}
                    </p>
                    <p className="mt-2 text-xl font-semibold text-[color:var(--foreground)]">
                      {overview.continuityPilotReview.drift.driftRate}%
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                    <p className="text-xs font-medium text-[color:var(--mode-link)]">
                      {english ? "Repeated ineffective" : "反复无效"}
                    </p>
                    <p className="mt-2 text-xl font-semibold text-[color:var(--foreground)]">
                      {overview.continuityPilotReview.drift.repeatedIneffectiveSessions}
                    </p>
                  </div>
                </div>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {english
                    ? `${overview.continuityPilotReview.drift.improvingSessions} improving · ${overview.continuityPilotReview.drift.stableSessions} stable · ${overview.continuityPilotReview.drift.driftingSessions} drifting`
                    : `${overview.continuityPilotReview.drift.improvingSessions} 个 improving · ${overview.continuityPilotReview.drift.stableSessions} 个 stable · ${overview.continuityPilotReview.drift.driftingSessions} 个 drifting`}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {english
                    ? `recent ${overview.continuityPilotReview.drift.recentDriftRate}% / older ${overview.continuityPilotReview.drift.olderDriftRate}% / delta ${overview.continuityPilotReview.drift.driftRateDelta}`
                    : `recent ${overview.continuityPilotReview.drift.recentDriftRate}% / older ${overview.continuityPilotReview.drift.olderDriftRate}% / delta ${overview.continuityPilotReview.drift.driftRateDelta}`}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {english
                    ? `middle ${overview.continuityPilotReview.drift.middleDriftRate}% / oldest ${overview.continuityPilotReview.drift.oldestDriftRate}% / long horizon ${overview.continuityPilotReview.drift.longHorizonDriftRate}%`
                    : `middle ${overview.continuityPilotReview.drift.middleDriftRate}% / oldest ${overview.continuityPilotReview.drift.oldestDriftRate}% / long horizon ${overview.continuityPilotReview.drift.longHorizonDriftRate}%`}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {english
                    ? `recent repeat ineffective ${overview.continuityPilotReview.drift.recentRepeatIneffectiveRate}% · long-horizon repeat ineffective ${overview.continuityPilotReview.drift.longHorizonRepeatIneffectiveRate}% · effectiveness change ${overview.continuityPilotReview.drift.effectivenessChange}`
                    : `recent repeat ineffective ${overview.continuityPilotReview.drift.recentRepeatIneffectiveRate}% · long-horizon repeat ineffective ${overview.continuityPilotReview.drift.longHorizonRepeatIneffectiveRate}% · effectiveness change ${overview.continuityPilotReview.drift.effectivenessChange}`}
                </p>
                <ul className="space-y-1 text-sm text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.drift.materiallyDriftingCohorts.slice(0, 3).map((item, index) => (
                    <li key={`${item}-${index}`}>- {item}</li>
                  ))}
                  {overview.continuityPilotReview.driftSynthesis.panels.slice(0, 4).map((item, index) => (
                    <li key={`panel-${item}-${index}`}>- {item}</li>
                  ))}
                  {overview.continuityPilotReview.longTermOutcomeCorrelation.panels.slice(0, 3).map((item, index) => (
                    <li key={`correlation-${item}-${index}`}>- {item}</li>
                  ))}
                  {overview.continuityPilotReview.longTermOutcomeReview.highlights.slice(0, 3).map((item, index) => (
                    <li key={`long-term-review-${item}-${index}`}>- {item}</li>
                  ))}
                  {overview.continuityPilotReview.longTermMaterialImpactReview.findings.slice(0, 3).map((item, index) => (
                    <li key={`material-impact-review-${item}-${index}`}>- {item}</li>
                  ))}
                  {overview.continuityPilotReview.longTermMaterialImpactAudit.impactPatterns.slice(0, 3).map((item, index) => (
                    <li key={`material-impact-audit-pattern-${item}-${index}`}>- {item}</li>
                  ))}
                  {overview.continuityPilotReview.longTermMaterialImpactAudit.optimizationHints.slice(0, 3).map((item, index) => (
                    <li key={`material-impact-audit-hint-${item}-${index}`}>- {item}</li>
                  ))}
                  {overview.continuityPilotReview.materialImpactPatternAgingReview.patterns
                    .slice(0, 3)
                    .map((item, index) => (
                      <li key={`material-impact-aging-pattern-${item}-${index}`}>- {item}</li>
                    ))}
                  {overview.continuityPilotReview.materialImpactPatternAgingReview.optimizationHints
                    .slice(0, 3)
                    .map((item, index) => (
                      <li key={`material-impact-aging-hint-${item}-${index}`}>- {item}</li>
                    ))}
                  {overview.continuityPilotReview.materialImpactSamplingReview.findings
                    .slice(0, 3)
                    .map((item, index) => (
                      <li key={`material-impact-sampling-${item}-${index}`}>- {item}</li>
                    ))}
                  {overview.continuityPilotReview.materialImpactSamplingReview.optimizationHints
                    .slice(0, 3)
                    .map((item, index) => (
                      <li key={`material-impact-sampling-hint-${item}-${index}`}>- {item}</li>
                    ))}
                  {overview.continuityPilotReview.materialImpactSamplingAgingReview.findings
                    .slice(0, 3)
                    .map((item, index) => (
                      <li key={`material-impact-sampling-aging-${item}-${index}`}>- {item}</li>
                    ))}
                  {overview.continuityPilotReview.materialImpactSamplingAgingReview.optimizationHints
                    .slice(0, 3)
                    .map((item, index) => (
                      <li key={`material-impact-sampling-aging-hint-${item}-${index}`}>- {item}</li>
                    ))}
                  {overview.continuityPilotReview.materialImpactSamplingAgingRefinement.findings
                    .slice(0, 3)
                    .map((item, index) => (
                      <li key={`material-impact-sampling-refinement-${item}-${index}`}>- {item}</li>
                    ))}
                  {overview.continuityPilotReview.materialImpactSamplingAgingRefinement.optimizationHints
                    .slice(0, 3)
                    .map((item, index) => (
                      <li key={`material-impact-sampling-refinement-hint-${item}-${index}`}>- {item}</li>
                    ))}
                  {overview.continuityPilotReview.materialImpactSamplingAgingAudit.findings
                    .slice(0, 3)
                    .map((item, index) => (
                      <li key={`material-impact-sampling-audit-${item}-${index}`}>- {item}</li>
                    ))}
                  {overview.continuityPilotReview.materialImpactSamplingAgingAudit.optimizationSuggestions
                    .slice(0, 3)
                    .map((item, index) => (
                      <li key={`material-impact-sampling-audit-hint-${item}-${index}`}>- {item}</li>
                    ))}
                  {overview.continuityPilotReview.materialImpactSamplingAgingRefinementAudit.findings
                    .slice(0, 3)
                    .map((item, index) => (
                      <li key={`material-impact-sampling-refinement-audit-${item}-${index}`}>- {item}</li>
                    ))}
                  {overview.continuityPilotReview.materialImpactSamplingAgingRefinementAudit.optimizationSuggestions
                    .slice(0, 3)
                    .map((item, index) => (
                      <li key={`material-impact-sampling-refinement-audit-hint-${item}-${index}`}>- {item}</li>
                    ))}
                  {overview.continuityPilotReview.longTermSopImpact.highlights.slice(0, 3).map((item, index) => (
                    <li key={`impact-${item}-${index}`}>- {item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="workspace-shell-panel border-[color:var(--mode-card-border)]" data-testid="continuity-threshold-revision-card">
              <CardHeader>
                <CardTitle className="text-lg tracking-tight text-[color:var(--foreground)]">
                  {english ? "Threshold revisions" : "阈值调整"}
                </CardTitle>
                <CardDescription className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                  {english
                    ? "Calibration only — no new execution authority."
                    : "只用于校准——不引入新的执行权限。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.intervalWordingDriftAudit.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.intervalWordingDriftAudit.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.wordingDriftTracking.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.wordingDriftTracking.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.intervalConsistencyGuidance.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.intervalConsistencyGuidance.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.intervalWordingAgingAudit.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.intervalWordingAgingAudit.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.intervalWordingCrossSurfaceRegressionReview.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.intervalWordingCrossSurfaceRegressionReview.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.intervalWordingCrossSurfaceConsistencyAudit.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.intervalWordingCrossSurfaceConsistencyAudit.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.intervalWordingCrossSurfaceRegressionAudit.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.intervalWordingCrossSurfaceRegressionAudit.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.intervalWordingCrossReadoutRegressionAudit.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.intervalWordingCrossReadoutRegressionAudit.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.intervalWordingCrossReadoutRegressionRefinement.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.intervalWordingCrossReadoutRegressionRefinement.aggregateSummary}
                </p>
                <ul className="space-y-2 text-sm text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.thresholdRevisions.map((item) => (
                    <li key={item.scope} className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                      <p className="font-medium text-[color:var(--foreground)]">
                        {item.scopeType} · {item.scope} · {formatMetricLabel("risk", english)} {item.riskBand} · {item.confidenceBand} · {formatMetricLabel("threshold", english)} {item.recommendedIneffectiveThreshold} · {formatMetricLabel("sample", english)} {item.sampleCoverageBand} · {formatMetricLabel("stability", english)} {item.stabilityBand} · {formatMetricLabel("stability confidence", english)} {item.stabilityConfidenceBand} · {formatMetricLabel("interval", english)} {item.confidenceInterval}
                      </p>
                      <p className="mt-1 leading-6">{item.sampleCoverageSummary}</p>
                      <p className="mt-1 leading-6">{item.confidenceSummary}</p>
                      <p className="mt-1 leading-6">{item.bandAdjustmentRationale}</p>
                      <p className="mt-1 leading-6">{item.intervalWordingSummary}</p>
                      <p className="mt-1 leading-6">{item.summary}</p>
                    </li>
                  ))}
                  {!overview.continuityPilotReview.thresholdRevisions.length ? (
                    <li>{english ? "No threshold revision is currently suggested." : "当前没有阈值修订建议。"}</li>
                  ) : null}
                </ul>
                <ul className="space-y-1 text-sm text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.intervalWordingDriftAudit.findings.slice(0, 4).map((item, index) => (
                    <li key={`interval-drift-audit-${item}-${index}`}>- {item}</li>
                  ))}
                  {overview.continuityPilotReview.wordingDriftTracking.findings.slice(0, 4).map((item, index) => (
                    <li key={`wording-drift-tracking-${item}-${index}`}>- {item}</li>
                  ))}
                  {overview.continuityPilotReview.intervalConsistencyGuidance.guidelines.slice(0, 3).map((item, index) => (
                    <li key={`interval-guideline-${item}-${index}`}>- {item}</li>
                  ))}
                  {overview.continuityPilotReview.intervalWordingAgingAudit.findings
                    .slice(0, 4)
                    .map((item, index) => (
                      <li key={`interval-aging-audit-${item}-${index}`}>- {item}</li>
                    ))}
                  {overview.continuityPilotReview.intervalWordingCrossSurfaceRegressionReview.findings
                    .slice(0, 4)
                    .map((item, index) => (
                      <li key={`interval-cross-surface-${item}-${index}`}>- {item}</li>
                    ))}
                  {overview.continuityPilotReview.intervalWordingCrossSurfaceRegressionReview.adjustmentRecommendations
                    .slice(0, 4)
                    .map((item, index) => (
                      <li key={`interval-cross-surface-adjust-${item}-${index}`}>- {item}</li>
                    ))}
                  {overview.continuityPilotReview.intervalWordingCrossSurfaceConsistencyAudit.findings
                    .slice(0, 4)
                    .map((item, index) => (
                      <li key={`interval-cross-surface-consistency-${item}-${index}`}>- {item}</li>
                    ))}
                  {overview.continuityPilotReview.intervalWordingCrossSurfaceConsistencyAudit.adjustmentRecommendations
                    .slice(0, 4)
                    .map((item, index) => (
                      <li key={`interval-cross-surface-consistency-adjust-${item}-${index}`}>- {item}</li>
                    ))}
                  {overview.continuityPilotReview.intervalWordingCrossSurfaceRegressionAudit.findings
                    .slice(0, 4)
                    .map((item, index) => (
                      <li key={`interval-cross-surface-regression-audit-${item}-${index}`}>- {item}</li>
                    ))}
                  {overview.continuityPilotReview.intervalWordingCrossSurfaceRegressionAudit.adjustmentRecommendations
                    .slice(0, 4)
                    .map((item, index) => (
                      <li key={`interval-cross-surface-regression-audit-adjust-${item}-${index}`}>- {item}</li>
                    ))}
                  {overview.continuityPilotReview.intervalWordingCrossReadoutRegressionAudit.findings
                    .slice(0, 4)
                    .map((item, index) => (
                      <li key={`interval-cross-readout-regression-audit-${item}-${index}`}>- {item}</li>
                    ))}
                  {overview.continuityPilotReview.intervalWordingCrossReadoutRegressionAudit.adjustmentRecommendations
                    .slice(0, 4)
                    .map((item, index) => (
                      <li key={`interval-cross-readout-regression-audit-adjust-${item}-${index}`}>- {item}</li>
                    ))}
                  {overview.continuityPilotReview.intervalWordingCrossReadoutRegressionRefinement.findings
                    .slice(0, 4)
                    .map((item, index) => (
                      <li key={`interval-cross-readout-regression-refinement-${item}-${index}`}>- {item}</li>
                    ))}
                  {overview.continuityPilotReview.intervalWordingCrossReadoutRegressionRefinement.adjustmentRecommendations
                    .slice(0, 4)
                    .map((item, index) => (
                      <li key={`interval-cross-readout-regression-refinement-adjust-${item}-${index}`}>- {item}</li>
                    ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="workspace-shell-panel border-[color:var(--mode-card-border)]" data-testid="continuity-operator-handling-card">
              <CardHeader>
                <CardTitle className="text-lg tracking-tight text-[color:var(--foreground)]">
                  {english ? "Operator handling" : "操作员处理"}
                </CardTitle>
                <CardDescription className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                  {english
                    ? "SOP vs. observed handling. No auto-remediation."
                    : "SOP 与实际处理对照。不自动修复。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.operatorHandlingEffectiveness.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.operatorHandlingEffectiveness.outcomeVarianceSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.sopEffectivenessSynthesis.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.sopEffectivenessSynthesis.aggregateSummary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.guidanceRefinement.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.longTermSopImpact.summary}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.longTermOutcomeReview.summary}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                    <p className="text-xs font-medium text-[color:var(--mode-link)]">
                      {english ? "Matched guidance" : "符合指引"}
                    </p>
                    <p className="mt-2 text-xl font-semibold text-[color:var(--foreground)]">
                      {overview.continuityPilotReview.operatorHandlingEffectiveness.matchedGuidanceRate}%
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                    <p className="text-xs font-medium text-[color:var(--mode-link)]">
                      {english ? "Skipped guidance" : "跳过指引"}
                    </p>
                    <p className="mt-2 text-xl font-semibold text-[color:var(--foreground)]">
                      {overview.continuityPilotReview.operatorHandlingEffectiveness.skippedGuidanceRate}%
                    </p>
                  </div>
                </div>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {english
                    ? `ineffective after guidance ${overview.continuityPilotReview.operatorHandlingEffectiveness.ineffectiveAfterGuidanceRate}% · review escalation ${overview.continuityPilotReview.operatorHandlingEffectiveness.reviewEscalationRate}%`
                    : `${formatMetricLabel("ineffective after guidance", english)} ${overview.continuityPilotReview.operatorHandlingEffectiveness.ineffectiveAfterGuidanceRate}% · ${formatMetricLabel("review escalation", english)} ${overview.continuityPilotReview.operatorHandlingEffectiveness.reviewEscalationRate}%`}
                </p>
                <ul className="space-y-1 text-sm text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.operatorHandlingEffectiveness.highlights.map((item, index) => (
                    <li key={`${item}-${index}`}>- {item}</li>
                  ))}
                  {overview.continuityPilotReview.sopEffectivenessSynthesis.highlights.map((item, index) => (
                    <li key={`sop-${item}-${index}`}>- {item}</li>
                  ))}
                  {overview.continuityPilotReview.guidanceRefinement.highlights.map((item, index) => (
                    <li key={`guidance-${item}-${index}`}>- {item}</li>
                  ))}
                  {overview.continuityPilotReview.longTermSopImpact.highlights.map((item, index) => (
                    <li key={`impact-guidance-${item}-${index}`}>- {item}</li>
                  ))}
                  {overview.continuityPilotReview.longTermOutcomeReview.highlights.map((item, index) => (
                    <li key={`outcome-review-${item}-${index}`}>- {item}</li>
                  ))}
                </ul>
                <div className="space-y-2 text-sm text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.operatorHandlingEffectiveness.stepReviews.slice(0, 3).map((item) => (
                    <div key={item.stepId} className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                      <p className="font-medium text-[color:var(--foreground)]">
                        {item.label} · {item.correlationBand} · {formatMetricLabel("sample", english)} {item.sampleCoverageBand} · {formatMetricLabel("stability", english)} {item.stabilityBand} · {formatMetricLabel("stability confidence", english)} {item.stabilityConfidenceBand} · {formatMetricLabel("interval", english)} {item.confidenceInterval} · {formatMetricLabel("impact", english)} {item.materialImpactBand} · {formatMetricLabel("hit", english)} {item.matchedGuidanceRate}% · {formatMetricLabel("skip", english)} {item.skippedGuidanceRate}% · {formatMetricLabel("ineffective-after-hit", english)} {item.ineffectiveAfterHitRate}%
                      </p>
                      <p className="mt-1 leading-6">{item.summary}</p>
                      <p className="mt-1 leading-6">{item.correlationSummary}</p>
                      <p className="mt-1 leading-6">{item.longTermImpactSummary}</p>
                      <p className="mt-1 leading-6">{item.materialImpactSummary}</p>
                      <p className="mt-1 leading-6">{item.bandAdjustmentRationale}</p>
                      <p className="mt-1 leading-6">{item.intervalWordingSummary}</p>
                      <p className="mt-1 leading-6">{item.improvementHint}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="workspace-shell-panel border-[color:var(--mode-card-border)]" data-testid="continuity-sop-highlights-card">
              <CardHeader>
                <CardTitle className="text-lg tracking-tight text-[color:var(--foreground)]">
                  {english ? "Refined operator SOP" : "操作员 SOP 细化"}
                </CardTitle>
                <CardDescription className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                  {english
                    ? "SOP stays as bounded operator guidance: evidence-first, escalation-aware, and explicitly outside execution-authority expansion."
                    : "SOP 保持为 有边界的操作员 指引：evidence-first、带升级规则，并且明确不扩 execution权限。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.calibrationProfile.confidenceBandSummary}
                </p>
                <ul className="space-y-1 text-sm text-[color:var(--muted-foreground)]">
                  {overview.continuityPilotReview.sopHighlights.slice(0, 4).map((item, index) => (
                    <li key={`${item}-${index}`}>- {item}</li>
                  ))}
                  {!overview.continuityPilotReview.sopHighlights.length ? (
                    <li>- {english ? "No SOP highlight is available until pilot failure classes accumulate." : "当前还没有可用的 SOP highlight，需要等待更多 pilot 失败类型。"}</li>
                  ) : null}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <QueueCard
              title={english ? "Budgeted continuity queue" : "有预算的连续性队列"}
              description={
                english
                  ? "Sessions should show posture, replay risk, recovery state, remediation analytics, repeat-pattern evidence, and bounded runbook guidance without widening execution authority."
                  : "session 需要同时展示姿态、回放风险、recovery state、remediation analytics、repeat-pattern evidence，以及 有边界的runbook 指引，而不是放大 execution权限。"
              }
              emptyLabel={english ? "No continuity queue right now." : "当前没有 连续性 队列。"}
              english={english}
              items={overview.continuityQueue.map((item) => {
                const persistedLifecycleTraceReadout = buildPersistedLifecycleTraceReadout(
                  item.debuggerPersistedLifecycleTrace,
                );
                const takeoverRemediationHandoffReadout =
                  buildTakeoverRemediationHandoffReadout({
                    takeoverAssistance: item.debuggerTakeoverAssistance,
                    takeoverRequest: item.debuggerTakeoverRequest,
                    takeoverActivation: item.debuggerTakeoverActivation,
                    takeoverFollowThrough: item.debuggerTakeoverFollowThrough,
                    recoveryLifecycleContract: {
                      state: item.debuggerRecoveryLifecycleContractState,
                      driver: item.debuggerRecoveryLifecycleContractDriver,
                      nextTransition: item.debuggerRecoveryLifecycleContractTransition,
                      summary: item.debuggerRecoveryLifecycleContractSummary,
                    },
                    latestRemediation: item.debuggerLatestRemediationTrace,
                  });
                const closeSettlementHandoffReadout = buildCloseSettlementHandoffReadout({
                  settlementFlow: item.runThread.settlementFlow,
                  settlementReview: item.runThread.settlementReview,
                  closeoutConfirmation: item.runThread.closeoutConfirmation,
                  closeoutRefresh: item.runThread.closeoutRefresh,
                  closeRequest: item.runThread.closeRequest,
                });
                const focusHref =
                  item.meetingId && closeSettlementHandoffReadout.focusSectionId
                    ? `/meetings/${item.meetingId}#${closeSettlementHandoffReadout.focusSectionId}`
                    : item.href;

                return {
                id: item.id,
                title: item.title,
                summary: item.summary,
                secondarySummary: formatSwarmSpawnRequestLifecycle({
                  english,
                  contract: item.runThread.swarmSpawnContract,
                }),
                tertiarySummary: `${formatSwarmReadOnlyWorkerContract({
                  english,
                  contract: item.runThread.swarmReadOnlyWorkerContract,
                })} · ${formatSwarmVerificationMergeLaneContract({
                  english,
                  contract: item.runThread.swarmVerificationMergeLaneContract,
                })} · ${item.operatorActionSummary.summary} · ${item.operatorProgressSummary.summary} · ${item.recoveryState} · ${item.failureTaxonomy} · ${item.recoverySummary} · ${item.debuggerTraceContractSummary} · ${item.debuggerWriteContractSummary} · ${item.debuggerSwarmSpawnContractSummary} · swarm deny ${item.debuggerSwarmSpawnContractDenyReason ?? "none"} · ${item.debuggerRecoveryActionContractSummary} · ${item.debuggerRecoveryTransitionContractSummary} · ${item.debuggerRecoveryStateMachineSummary} · ${item.debuggerRecoveryExecutionContractSummary} · persisted trace ${persistedLifecycleTraceReadout.compactSummary} · trace integrity ${persistedLifecycleTraceReadout.integritySummary} · persisted lifecycle guard ${item.runThread.persistedControlPlaneLifecycle.guardPolicy.state} · persisted lifecycle repair ${item.runThread.persistedControlPlaneLifecycle.repairPolicy.state} · ${takeoverRemediationHandoffReadout.compactSummary} · ${takeoverRemediationHandoffReadout.assistanceSummary} · ${takeoverRemediationHandoffReadout.lifecycleSummary}${takeoverRemediationHandoffReadout.remediationSummary ? ` · ${takeoverRemediationHandoffReadout.remediationSummary}` : ""} · close settlement ${closeSettlementHandoffReadout.compactSummary} · ${closeSettlementHandoffReadout.settlementSummary} · ${closeSettlementHandoffReadout.closeoutSummary} · ${closeSettlementHandoffReadout.closeRequestSummary} · closeout ${item.runThread.closeoutFlow.state} · closeout summary ${item.runThread.closeoutSummary.state} · closeout resolution ${item.runThread.closeoutResolution.state} · closeout resolution follow-through ${item.runThread.closeoutResolutionFollowThrough.state} · closeout outcome ${item.runThread.closeoutOutcome.state} · close request ${item.runThread.closeRequest.state} · close lifecycle ${item.runThread.closeLifecycle.state} · close control ${item.runThread.closeControl.state} · close control flow ${item.runThread.closeControlFlow.state} · close decision ${item.runThread.closeDecisionFlow.state} · close decision control ${item.runThread.closeDecisionControlSummary.state} · close resolution ${item.runThread.closeResolutionSummary.state} · close resolution forward ${item.runThread.closeResolutionForwardSummary.state} · close resolution control ${item.runThread.closeResolutionControlSummary.state} · close posture ${item.runThread.closePostureSummary.state} · close posture forward ${item.runThread.closePostureForwardSummary.state} · settlement review ${item.runThread.settlementReview.state} · closeout confirmation ${item.runThread.closeoutConfirmation.state} · closeout refresh ${item.runThread.closeoutRefresh.state} · settlement ${item.runThread.settlementFlow.state} · forward ${item.runThread.forwardFlow.state}${item.runThread.lifecycleLog[0] ? ` · latest lifecycle ${item.runThread.lifecycleLog[0].kind}` : ""}`,
                status: item.posture,
                href: focusHref,
                meta: `thread ${item.runThread.threadId}${closeSettlementHandoffReadout.focusTitle ? ` · focus ${closeSettlementHandoffReadout.focusTitle}` : ""}${closeSettlementHandoffReadout.provenanceSummary ? ` · close-settlement provenance ${closeSettlementHandoffReadout.provenanceSummary}` : ""} · operator action ${item.operatorActionSummary.state}/${item.operatorActionSummary.driver} · operator progress ${item.operatorProgressSummary.state}/${item.operatorProgressSummary.driver} · checkpoint ${item.runThread.latestCheckpoint?.checkpointKey ?? "none"} · resume ${item.runThread.resume.state} · debugger trace ${item.debuggerTraceContractState}/${item.debuggerTraceContractDriver}/${item.debuggerTraceContractAnchor}/${item.debuggerTraceContractCheckpointKey ?? "none"} · debugger write ${item.debuggerWriteContractState}/${item.debuggerWriteContractDriver}/${item.debuggerWriteContractAnchor}/${item.debuggerWriteContractCheckpointKey ?? "none"} · debugger swarm ${item.debuggerSwarmSpawnContractState}/${item.debuggerSwarmSpawnContractDriver}/${item.runThread.swarmSpawnContract.requestRecordState}/${item.runThread.swarmSpawnContract.workspaceFlagState}/${item.runThread.swarmSpawnContract.budgetPosture}/${item.debuggerSwarmSpawnContractDenyReason ?? "none"} · debugger swarm merge lane ${item.runThread.swarmVerificationMergeLaneContract.state}/${item.runThread.swarmVerificationMergeLaneContract.driver}/${item.runThread.swarmVerificationMergeLaneContract.mergeLaneTruth ?? "no-truth"}/${item.runThread.swarmVerificationMergeLaneContract.verificationStatus ?? "no-verification"}/${item.runThread.swarmVerificationMergeLaneContract.checkpointKey ?? "none"} · debugger recovery ${item.debuggerRecoveryActionContractState}/${item.debuggerRecoveryActionContractDriver}/${item.debuggerRecoveryActionContractAction ?? "none"}/${item.debuggerRecoveryActionContractCheckpointKey ?? "none"} · debugger recovery lifecycle ${item.debuggerRecoveryLifecycleContractState}/${item.debuggerRecoveryLifecycleContractDriver}/${item.debuggerRecoveryLifecycleContractAnchor}/${item.debuggerRecoveryLifecycleContractTransition} · debugger recovery transition ${item.debuggerRecoveryTransitionContractState}/${item.debuggerRecoveryTransitionContractDriver}/${item.debuggerRecoveryTransitionContractAnchor}/${item.debuggerRecoveryTransitionContractTransition} · debugger recovery state machine ${item.debuggerRecoveryStateMachinePhase}/${item.debuggerRecoveryStateMachineTransitionState}/${item.debuggerRecoveryStateMachineCurrentTransition} · debugger recovery execution ${item.debuggerRecoveryExecutionContractState}/${item.debuggerRecoveryExecutionContractTransition}/${item.debuggerRecoveryExecutionContractCanExecute ? "execute" : "hold"} · persisted lifecycle ${item.runThread.persistedControlPlaneLifecycle.state}/${item.runThread.persistedControlPlaneLifecycle.guardPolicy.state}/${item.runThread.persistedControlPlaneLifecycle.compactionPolicy.state}/${item.runThread.persistedControlPlaneLifecycle.reconciliationPolicy.state}/${item.runThread.persistedControlPlaneLifecycle.repairPolicy.state}/${item.runThread.persistedControlPlaneLifecycle.writeSide.state}/${item.runThread.persistedControlPlaneLifecycle.writeSide.refreshReason ?? "none"} · persisted trace ${persistedLifecycleTraceReadout.compactSummary}${persistedLifecycleTraceReadout.referenceSummary ? ` · trace refs ${persistedLifecycleTraceReadout.referenceSummary}` : ""}${persistedLifecycleTraceReadout.provenanceSummary ? ` · trace provenance ${persistedLifecycleTraceReadout.provenanceSummary}` : ""} · trace integrity ${persistedLifecycleTraceReadout.integritySummary} · handoff ${takeoverRemediationHandoffReadout.requestSummary} · ${takeoverRemediationHandoffReadout.activationSummary} · ${takeoverRemediationHandoffReadout.followThroughSummary}${takeoverRemediationHandoffReadout.remediationSummary ? ` · remediation ${takeoverRemediationHandoffReadout.remediationSummary}` : ""}${takeoverRemediationHandoffReadout.provenanceSummary ? ` · handoff provenance ${takeoverRemediationHandoffReadout.provenanceSummary}` : ""} · close settlement ${closeSettlementHandoffReadout.compactSummary} · ${closeSettlementHandoffReadout.settlementSummary} · ${closeSettlementHandoffReadout.closeoutSummary} · ${closeSettlementHandoffReadout.closeRequestSummary} · result ack ${item.runThread.resultAcknowledgement.state} · result flow ${item.runThread.resultFlow.requiresOperatorAttentionCount}/${item.runThread.resultFlow.resolvedCount} · closeout ${item.runThread.closeoutFlow.state}/${item.runThread.closeoutFlow.openCount}${item.runThread.closeoutFlow.currentOwner ? `:${item.runThread.closeoutFlow.currentOwner}` : ""} · closeout summary ${item.runThread.closeoutSummary.state}/${item.runThread.closeoutSummary.driver}${item.runThread.closeoutSummary.currentOwner ? `:${item.runThread.closeoutSummary.currentOwner}` : ""} · closeout resolution ${item.runThread.closeoutResolution.state}${item.runThread.closeoutResolution.decision ? `/${item.runThread.closeoutResolution.decision}` : ""}${item.runThread.closeoutResolution.resolvedBy ? `:${item.runThread.closeoutResolution.resolvedBy}` : ""} · closeout resolution follow-through ${item.runThread.closeoutResolutionFollowThrough.state}${item.runThread.closeoutResolutionFollowThrough.decision ? `/${item.runThread.closeoutResolutionFollowThrough.decision}` : ""}${item.runThread.closeoutResolutionFollowThrough.resolvedBy ? `:${item.runThread.closeoutResolutionFollowThrough.resolvedBy}` : item.runThread.closeoutResolutionFollowThrough.requestedBy ? `:${item.runThread.closeoutResolutionFollowThrough.requestedBy}` : ""} · closeout outcome ${item.runThread.closeoutOutcome.state}${item.runThread.closeoutOutcome.decision ? `/${item.runThread.closeoutOutcome.decision}` : ""}${item.runThread.closeoutOutcome.currentOwner ? `:${item.runThread.closeoutOutcome.currentOwner}` : ""} · close request ${item.runThread.closeRequest.state}${item.runThread.closeRequest.requestedBy ? `:${item.runThread.closeRequest.requestedBy}` : ""} · close lifecycle ${item.runThread.closeLifecycle.state}/${item.runThread.closeLifecycle.driver}${item.runThread.closeLifecycle.currentOwner ? `:${item.runThread.closeLifecycle.currentOwner}` : ""} · close control ${item.runThread.closeControl.state}/${item.runThread.closeControl.driver}${item.runThread.closeControl.currentOwner ? `:${item.runThread.closeControl.currentOwner}` : ""} · close control flow ${item.runThread.closeControlFlow.state}/${item.runThread.closeControlFlow.driver}${item.runThread.closeControlFlow.currentOwner ? `:${item.runThread.closeControlFlow.currentOwner}` : ""} · close decision ${item.runThread.closeDecisionFlow.state}/${item.runThread.closeDecisionFlow.driver}${item.runThread.closeDecisionFlow.currentOwner ? `:${item.runThread.closeDecisionFlow.currentOwner}` : ""} · close decision control ${item.runThread.closeDecisionControlSummary.state}/${item.runThread.closeDecisionControlSummary.driver}${item.runThread.closeDecisionControlSummary.currentOwner ? `:${item.runThread.closeDecisionControlSummary.currentOwner}` : ""} · close resolution ${item.runThread.closeResolutionSummary.state}/${item.runThread.closeResolutionSummary.driver}${item.runThread.closeResolutionSummary.currentOwner ? `:${item.runThread.closeResolutionSummary.currentOwner}` : ""} · close resolution forward ${item.runThread.closeResolutionForwardSummary.state}/${item.runThread.closeResolutionForwardSummary.driver}${item.runThread.closeResolutionForwardSummary.currentOwner ? `:${item.runThread.closeResolutionForwardSummary.currentOwner}` : ""} · close resolution control ${item.runThread.closeResolutionControlSummary.state}/${item.runThread.closeResolutionControlSummary.driver}${item.runThread.closeResolutionControlSummary.currentOwner ? `:${item.runThread.closeResolutionControlSummary.currentOwner}` : ""} · close posture ${item.runThread.closePostureSummary.state}/${item.runThread.closePostureSummary.driver}${item.runThread.closePostureSummary.currentOwner ? `:${item.runThread.closePostureSummary.currentOwner}` : ""} · close posture forward ${item.runThread.closePostureForwardSummary.state}/${item.runThread.closePostureForwardSummary.driver}${item.runThread.closePostureForwardSummary.currentOwner ? `:${item.runThread.closePostureForwardSummary.currentOwner}` : ""} · settlement review ${item.runThread.settlementReview.state}${item.runThread.settlementReview.requestedBy ? `:${item.runThread.settlementReview.requestedBy}` : item.runThread.settlementReview.resolvedBy ? `:${item.runThread.settlementReview.resolvedBy}` : ""} · closeout confirmation ${item.runThread.closeoutConfirmation.state}${item.runThread.closeoutConfirmation.confirmedBy ? `:${item.runThread.closeoutConfirmation.confirmedBy}` : ""} · closeout refresh ${item.runThread.closeoutRefresh.state}${item.runThread.closeoutRefresh.requestedBy ? `:${item.runThread.closeoutRefresh.requestedBy}` : ""} · settlement ${item.runThread.settlementFlow.state}/${item.runThread.settlementFlow.openCloseoutCount}${item.runThread.settlementFlow.currentOwner ? `:${item.runThread.settlementFlow.currentOwner}` : ""} · forward ${item.runThread.forwardFlow.state}/${item.runThread.forwardFlow.attentionCount}${item.runThread.forwardFlow.currentOwner ? `:${item.runThread.forwardFlow.currentOwner}` : ""} · request posture ${item.runThread.requestPosture.takeoverState}/${item.runThread.requestPosture.humanInputState} · lifecycle ${item.runThread.lifecycle} · lifecycle note ${item.runThread.lifecycleLog[0]?.kind ?? "none"} · interrupt ${item.interruptReasonState}/${item.interruptReasonCode} · resume ask ${item.resumeAskMode} · handoff ${item.handoffPayloadState}${item.handoffTargetAgent ? `:${item.handoffTargetAgent}` : ""} · takeover ${item.debuggerTakeoverPosture}/${item.debuggerTakeoverRequestState}/${item.debuggerTakeoverActivationState}/${item.debuggerTakeoverFollowThroughState}${item.debuggerTakeoverOwner ? `:${item.debuggerTakeoverOwner}` : ""} · human ${item.debuggerHumanInputState}/${item.debuggerHumanInputRequestState} · replay assist ${item.debuggerReplayFidelity} · risk ${item.riskLevel} · recovery ${item.recoveryState} · calibration ${item.calibrationConfidence} · pilot risk ${item.pilotRiskBand} · pilot ${item.pilotConfidenceBand}/${item.pilotThreshold} · sample ${item.pilotSampleCoverageBand} · stability ${item.pilotStabilityBand} · stability confidence ${item.pilotStabilityConfidenceBand} · interval ${item.pilotConfidenceInterval} · correlation ${item.pilotOutcomeCorrelationBand} · impact ${item.pilotLongTermMaterialImpactBand} · shape ${item.meetingShape} · density ${item.sessionDensityBand} · cadence ${item.meetingFrequencyBand} · history ${item.failureHistoryBand} · participants ${item.participantRolePosture} · guidance ${item.guidanceStatus} · effect ${item.latestEffectiveness} · replay ${item.replayStatus} · attempts ${item.remediationAttempts} · sop ${item.sopTitle} · runbook ${item.runbookTitle}`,
                actions:
                  canManageRuntime &&
                  item.meetingId &&
                  item.runThread.swarmSpawnContract.state === "requestable" &&
                  item.runThread.swarmSpawnContract.requestRecordState === "not_requested" ? (
                    <form
                      action={async () => {
                        "use server";
                        await requestMeetingRuntimeSwarmSpawnAction({
                          meetingId: item.meetingId!,
                          sessionId: item.id,
                          sourcePage: "/operating",
                        });
                      }}
                    >
                      <Button size="sm" type="submit">
                        {english ? "Record swarm request" : "记录多代理派生请求"}
                      </Button>
                    </form>
                  ) : canManageRuntime &&
                      item.meetingId &&
                      item.runThread.swarmVerificationMergeLaneContract.state === "recordable" ? (
                    <form
                      action={async () => {
                        "use server";
                        await recordMeetingRuntimeSwarmVerificationMergeLaneAction({
                          meetingId: item.meetingId!,
                          sessionId: item.id,
                          sourcePage: "/operating",
                        });
                      }}
                    >
                      <Button size="sm" type="submit" variant="secondary">
                        {english ? "Record merge lane" : "记录验证合流"}
                      </Button>
                    </form>
                  ) : canManageRuntime &&
                      item.meetingId &&
                      item.runThread.swarmReadOnlyWorkerContract.outputAdoptionRecordState ===
                        "recordable" ? (
                    <form
                      action={async () => {
                        "use server";
                        await recordMeetingRuntimeSwarmReadOnlyWorkerAdoptionAction({
                          meetingId: item.meetingId!,
                          sessionId: item.id,
                          sourcePage: "/operating",
                        });
                      }}
                    >
                      <Button size="sm" type="submit" variant="secondary">
                        {english ? "Record adoption slice" : "记录采纳切片"}
                      </Button>
                    </form>
                  ) : canManageRuntime &&
                      item.meetingId &&
                      item.runThread.swarmReadOnlyWorkerContract.artifactMaterializationRecordState ===
                        "recordable" ? (
                    <form
                      action={async () => {
                        "use server";
                        await recordMeetingRuntimeSwarmReadOnlyWorkerMaterializationAction({
                          meetingId: item.meetingId!,
                          sessionId: item.id,
                          sourcePage: "/operating",
                        });
                      }}
                    >
                      <Button size="sm" type="submit" variant="secondary">
                        {english ? "Record materialization slice" : "记录物化切片"}
                      </Button>
                    </form>
                  ) : canManageRuntime &&
                      item.meetingId &&
                      item.runThread.swarmReadOnlyWorkerContract.executionGuardContract.state ===
                        "allowed" ? (
                    <form
                      action={async () => {
                        "use server";
                        await recordMeetingRuntimeSwarmReadOnlyWorkerExecutionAction({
                          meetingId: item.meetingId!,
                          sessionId: item.id,
                          sourcePage: "/operating",
                        });
                      }}
                    >
                      <Button size="sm" type="submit" variant="secondary">
                        {english ? "Record execution slice" : "记录执行切片"}
                      </Button>
                    </form>
                  ) : canManageRuntime &&
                      item.meetingId &&
                      item.runThread.swarmReadOnlyWorkerContract
                        .artifactBundlePlaceholderRecordState === "recordable" ? (
                    <form
                      action={async () => {
                        "use server";
                        await recordMeetingRuntimeSwarmReadOnlyWorkerPlaceholderAction({
                          meetingId: item.meetingId!,
                          sessionId: item.id,
                          sourcePage: "/operating",
                        });
                      }}
                    >
                      <Button size="sm" type="submit" variant="secondary">
                        {english ? "Record placeholder bundle" : "记录占位产物包"}
                      </Button>
                    </form>
                  ) : canManageRuntime &&
                      item.meetingId &&
                      item.runThread.swarmReadOnlyWorkerContract.packetConsumptionIntentState ===
                        "selection_required" ? (
                    <div className="flex flex-wrap gap-2">
                      {item.runThread.swarmReadOnlyWorkerContract.allowlistedWorkers.map(
                        (workerKind) => (
                          <form
                            key={workerKind}
                            action={async () => {
                              "use server";
                              await recordMeetingRuntimeSwarmReadOnlyWorkerIntentAction({
                                meetingId: item.meetingId!,
                                sessionId: item.id,
                                workerKind,
                                sourcePage: "/operating",
                              });
                            }}
                          >
                            <Button size="sm" type="submit" variant="secondary">
                              {english
                                ? `Select ${formatSwarmReadOnlyWorkerLabel(workerKind, english)}`
                                : `选择${formatSwarmReadOnlyWorkerLabel(workerKind, english)}通道`}
                            </Button>
                          </form>
                        ),
                      )}
                    </div>
                  ) : null,
                timestamp: item.updatedAt,
              };
              })}
            />

            <QueueCard
              title={english ? "Verification and truth queue" : "验证与真实性队列"}
              description={
                english
                  ? "Why something was blocked, downgraded or held for review should be visible before any operator treats it as fact."
                  : "在任何内容被当成事实之前，为什么被拦、为什么降级、为什么需要复核，必须先可见。"
              }
              emptyLabel={english ? "No verification queue right now." : "当前没有 验证 队列。"}
              english={english}
              items={overview.verificationQueue.map((item) => ({
                id: item.id,
                title: item.title,
                summary: item.summary,
                status: item.status,
                href: item.href,
                meta:
                  item.truthScore !== null
                    ? english
                      ? `truth score ${item.truthScore}`
                      : `真实性评分 ${item.truthScore}`
                    : item.source === "truth_conflict"
                      ? english
                        ? "source conflict"
                        : "来源冲突"
                      : null,
                timestamp: item.createdAt,
              }))}
            />

            <QueueCard
              title={english ? "Operating-gap queue" : "经营缺口队列"}
              description={
                english
                  ? "Missing owners, missing evidence, unresolved conflicts, blocked threads, and capability gaps stay explicit here instead of dissolving across separate runtime queues."
                  : "缺负责人、缺证据、冲突未解、长期受阻和能力缺口在这里统一显式出现，而不是散落在不同运行时队列里。"
              }
              emptyLabel={english ? "No operating gap right now." : "当前没有经营缺口。"}
              english={english}
              items={overview.operatingGaps.map((item) => ({
                id: item.id,
                title: item.title,
                summary: item.summary,
                secondarySummary: item.nextActionHint,
                tertiarySummary: `${item.evidenceSummary} · ${item.escalationPosture}`,
                status: item.severity.toUpperCase(),
                href: item.href,
                meta: [
                  item.kind,
                  item.sourceRepresentation,
                  item.ownerHint ? `owner ${item.ownerHint}` : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
                timestamp: item.updatedAt,
              }))}
            />

            <QueueCard
              title={english ? "Promotion posture" : "晋升姿态"}
              description={
                english
                  ? "Recent promote / reject / defer decisions stay source-grounded and operator-readable instead of collapsing into silent memory writes."
                  : "这里把最近的晋升 / 拒绝 / 推迟决策保持为基于源头、运营可读，而不是折叠成静默经营记忆 write。"
              }
              emptyLabel={english ? "No promotion queue right now." : "当前没有晋升队列。"}
              english={english}
              items={overview.promotionQueue.map((item) => ({
                id: item.id,
                title: item.title,
                summary: item.summary,
                secondarySummary: item.rationale,
                status: item.status,
                href: item.href,
                meta:
                  [
                    item.source === "memory_promotion"
                      ? english
                        ? "promotion decision"
                        : "晋升决策"
                      : english
                        ? "memory candidate"
                        : "记忆候选",
                    item.sourceClasses.join(" / "),
                    item.truthConflictOpen ? (english ? "open conflict" : "未决冲突") : null,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                timestamp: item.createdAt,
              }))}
            />

            <QueueCard
              title={english ? "Handoff packets" : "交接包"}
              description={
                english
                  ? "Lead-to-worker and worker-to-worker handoffs stay explicit, typed, and reviewable instead of hiding inside conversational carry-over."
                  : "主管 → 执行和执行 → 执行的交接需要显式、可追踪、可复核，而不是藏在隐式上下文里。"
              }
              emptyLabel={english ? "No handoff packet yet." : "当前还没有交接 资料et。"}
              english={english}
              items={overview.handoffPackets.map((item) => ({
                id: item.id,
                title: item.title,
                summary: item.summary,
                href: item.href,
                meta: `${item.approvalTier} · ${item.fromAgent} → ${item.toAgent}`,
                timestamp: item.createdAt,
              }))}
            />

            <QueueCard
              title={english ? "Initiative runs" : "主动运行"}
              description={
                english
                  ? "Bounded problem spaces become initiative runs with explicit target outcomes instead of expanding into a workflow engine."
                  : "有边界的问题空间 会进入带目标结果的 主动跑动，但不会扩成 工作流引擎。"
              }
              emptyLabel={english ? "No initiative run yet." : "当前还没有 主动跑动。"}
              english={english}
              items={overview.initiativeRuns.map((item) => ({
                id: item.id,
                title: item.title,
                summary: `${item.summary} ${english ? "Target:" : "目标："} ${item.targetOutcome}`,
                status: item.status,
                href: item.href,
                timestamp: item.createdAt,
              }))}
            />

            <QueueCard
              title={english ? "Problem-space queue" : "问题空间队列"}
              description={
                english
                  ? "Open issues are expressed as bounded problem spaces with owner hints and next steps, not as a workflow engine."
                  : "开放问题以 有边界的问题空间 的形式出现，带负责人提示和 下一步，但不会扩成 工作流引擎。"
              }
              emptyLabel={english ? "No open problem spaces right now." : "当前没有 open 问题空间。"}
              english={english}
              items={overview.problemSpaces.map((item) => ({
                id: item.id,
                title: item.title,
                summary: item.summary,
                secondarySummary: `${english ? "Next step:" : "下一步："} ${item.nextStep}`,
                tertiarySummary: [item.groundingSummary, item.driSummary, item.conflictSummary].filter(Boolean).join(" "),
                status: item.status,
                href: item.href,
                meta: item.ownerHint ? (english ? `owner hint ${item.ownerHint}` : `owner hint ${item.ownerHint}`) : null,
                timestamp: item.updatedAt,
              }))}
            />

            <QueueCard
              title={english ? "Player-coach queue" : "陪跑教练队列"}
              description={
                english
                  ? "These briefs stay internal and operator-facing. They help a lead coach the next move without becoming an external commitment surface."
                  : "这些摘要保持仅内部、面向运营，用来帮助主管教练下一步，不会变成对外承诺 面。"
              }
              emptyLabel={english ? "No player-coach briefs right now." : "当前没有 player-coach 摘要。"}
              english={english}
              items={overview.playerCoachQueue.map((item) => ({
                id: item.id,
                title: item.title,
                summary: item.summary,
                secondarySummary: item.groundingSummary,
                tertiarySummary: [item.driSummary, item.truthPosture].filter(Boolean).join(" "),
                href: item.href,
                meta: item.problemSpaceTitle ?? null,
                timestamp: item.updatedAt,
              }))}
            />

            <QueueCard
              title={english ? "Coordination trace bridge" : "协同轨迹桥"}
              description={
                english
                  ? "This queue shows whether a verified coordination item is still waiting, has entered human execution, or has reached official follow-through on the same operating thread."
                  : "这条队列展示已校验协同事项现在是仍在等待、已经进入人工执行，还是已经进入同一条经营链上的官方跟进。"
              }
              emptyLabel={english ? "No coordination trace bridge right now." : "当前没有协同轨迹 bridge。"}
              english={english}
              items={overview.coordinationTraceQueue.map((item) => ({
                id: item.id,
                title: item.title,
                summary: item.summary,
                secondarySummary: item.humanExecutionSummary,
                tertiarySummary: [item.officialFollowThroughSummary, item.linkageSummary].filter(Boolean).join(" "),
                status: item.posture,
                href: item.href,
                timestamp: item.updatedAt,
              }))}
            />
          </div>

          <Card className="workspace-shell-panel border-[color:var(--mode-card-border)]">
            <CardHeader>
              <CardTitle className="text-lg tracking-tight text-[color:var(--foreground)]">
                {english ? "Reflection 延续" : "reflection 延续"}
              </CardTitle>
              <CardDescription className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                {english
                  ? "These review-safe candidates are generated by reflection from trusted runtime state. They can inform later memory work, but they still do not auto-promote or rewrite canonical truth."
                  : "这些复核安全候选来自反思对 可信运行时状态的整理。它们可以支撑后续经营记忆工作，但仍不会自动晋升，也不会改写权威事实。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {overview.reflectionCandidates.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-[color:var(--border)] px-3 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-[color:var(--foreground)]">
                          {item.title}
                        </p>
                        <Badge variant={renderStatusTone(item.status)}>
                          {renderStatusLabel(item.status, english)}
                        </Badge>
                        <Badge variant="neutral">{item.sessionLabel}</Badge>
                      </div>
                      <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
                        {item.summary}
                      </p>
                      <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
                        {item.reviewPosture}
                      </p>
                      <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
                        {item.evidenceSummary}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="secondary">
                        <Link href={item.href}>
                          {english ? "Open meeting" : "打开会议"}
                        </Link>
                      </Button>
                      {canReviewRuntime ? (
                        <form
                          action={async () => {
                            "use server";
                            await acceptReflectionCarryForwardAction({
                              candidateId: item.id,
                              sourcePage: "/operating",
                            });
                          }}
                        >
                          <Button size="sm" type="submit">
                            {english ? "Accept" : "接受"}
                          </Button>
                        </form>
                      ) : null}
                      {canManageRuntime ? (
                        <form
                          action={async () => {
                            "use server";
                            await dismissReflectionCarryForwardAction({
                              candidateId: item.id,
                              sourcePage: "/operating",
                            });
                          }}
                        >
                          <Button size="sm" type="submit" variant="ghost">
                            {english ? "Dismiss" : "忽略"}
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                    <span>{item.sourceClasses.join(" / ")}</span>
                    <span>
                      {english
                        ? formatPanelTime(item.createdAt, true)
                        : formatPanelTime(item.createdAt, false)}
                    </span>
                  </div>
                </div>
              ))}
              {!overview.reflectionCandidates.length ? (
                <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-3 py-5 text-sm text-[color:var(--muted-foreground)]">
                  {english
                    ? "No reflection 延续 candidate right now."
                    : "当前没有反思 延续 候选。"}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <QueueCard
            title={english ? "Reflection queue" : "反思队列"}
            description={
              english
                ? "Compacts trusted state into reviewable summaries. Candidates only — no auto-promote."
                : "把可信状态压成可复核的摘要。仅候选，不自动晋升。"
            }
            emptyLabel={english ? "No reflection job queued." : "当前没有反思 job。"}
            english={english}
            items={overview.reflectionJobs.map((item) => ({
              id: item.id,
              title: item.jobType,
              summary: item.inputSummary,
              secondarySummary: item.outputSummary,
              status: item.status,
              href: item.href,
              meta: item.reviewPosture,
              timestamp: item.completedAt ?? item.pausedAt ?? item.createdAt,
            }))}
          />

          <QueueCard
            title={english ? "Consolidation queue" : "整合队列"}
            description={
              overview.consolidationAuditSummary.summary
            }
            emptyLabel={english ? "No consolidation job queued." : "当前没有 整合 job。"}
            english={english}
            items={overview.consolidationJobs.map((item) => ({
              id: item.id,
              title: item.jobType,
              summary: item.inputSummary,
              secondarySummary: item.outputSummary ?? overview.consolidationAuditSummary.boundaryNote,
              tertiarySummary: overview.consolidationAuditSummary.rollbackSummary,
              status: item.status,
              href: item.href,
              meta: item.reviewPosture,
              timestamp: item.completedAt ?? item.pausedAt ?? item.createdAt,
              actions:
                canManageRuntime && item.meetingId ? (
                  <form
                    action={async () => {
                      "use server";
                      await updateMeetingRuntimeConsolidationAction({
                        meetingId: item.meetingId!,
                        jobId: item.id,
                        mode: item.status === "PAUSED" ? "resume" : "pause",
                        sourcePage: "/operating",
                      });
                    }}
                  >
                    <Button size="sm" type="submit" variant="secondary">
                      {item.status === "PAUSED"
                        ? english
                          ? "Resume"
                          : "恢复"
                        : english
                          ? "Pause"
                          : "暂停"}
                    </Button>
                  </form>
                ) : null,
            }))}
          />

          <div className="grid gap-4 xl:grid-cols-2">
            <QueueCard
              title={english ? "Customer signal feed" : "客户信号流"}
              description={
                english
                  ? "Recent customer signals stay visible so business facts can outrank narrative drift when they conflict."
                  : "最近的客户信号保持可见，和叙事冲突时优先看业务事实。"
              }
              emptyLabel={english ? "No signal event yet." : "当前还没有客户信号。"}
              english={english}
              items={overview.signals.map((item) => ({
                id: item.id,
                title: item.signalType,
                summary: item.signalSummary,
                status: item.sourceType,
                href: item.href,
                meta: english ? `truth weight ${item.truthWeight}` : `truth weight ${item.truthWeight}`,
                timestamp: item.createdAt,
              }))}
            />

            <QueueCard
              title={english ? "Capability catalog" : "能力目录"}
              description={
                english
                  ? "Capability hints should stay explicit and reviewable. This surface shows what the runtime currently knows how to assemble without implying broader orchestration authority."
                  : "能力提示需要保持显式和可复核。这里展示运行时当前能装配哪些能力，但不意味着更广的编排权限。"
              }
              emptyLabel={english ? "No capability catalog entry yet." : "当前还没有能力目录条目。"}
              english={english}
              items={overview.capabilities.map((item) => ({
                id: item.id,
                title: item.name,
                summary: item.description,
                status: item.stage,
                href: "/operating",
                meta: `${item.loadPolicy} · ${item.reviewRequired ? (english ? "review required" : "需复核") : english ? "direct" : "直通"}`,
              }))}
            />
          </div>

          <QueueCard
            title={english ? "Project skill library" : "项目技能库"}
            description={
              english
                ? `Project-scoped worker / skill / resource contracts stay explicit here. ${overview.projectSkillLibrary.summary.liveCapabilitySignals} live capability signal(s) are overlaid without turning this surface into broader orchestration authority.`
                : `项目级执行 / 技能 / 资源契约需要在这里保持显式。当前叠加了 ${overview.projectSkillLibrary.summary.liveCapabilitySignals} 条实时能力信号，但这仍然不是更宽的编排权限。`
            }
            emptyLabel={english ? "No project skill entry yet." : "当前还没有项目技能条目。"}
            english={english}
            items={overview.projectSkillLibrary.skillEntries.map((item) => ({
              id: item.skillId,
              title: item.skillName,
              summary: item.boundaryNote,
              status: item.riskLevel,
              href: "/operating",
              meta: `${item.environmentSummary} · ${item.requiresApproval ? (english ? "approval gated" : "需审批") : item.requiresReview ? (english ? "review first" : "先复核") : item.effectMode}`,
            }))}
          />

          <QueueCard
            title={english ? "Operator cue summary" : "操作员线索摘要"}
            description={
              english
                ? "One coarse cue first, before comparing work / review / control cards by hand."
                : "先看一条粗粒度线索，再去手工对比工作、复核、控制三张卡。"
            }
            emptyLabel={english ? "No operator cue summary yet." : "当前还没有操作员线索 summary。"}
            english={english}
            items={[
              {
                id: "operator-cue-summary",
                title: `${overview.operatorCueSummary.state} · ${overview.operatorCueSummary.driver}`,
                summary: overview.operatorCueSummary.summary,
                secondarySummary: overview.operatorCueSummary.nextAction,
                tertiarySummary: overview.operatorCueSummary.boundaryNote,
                status: overview.operatorCueSummary.state.toUpperCase(),
                href: overview.operatorCueSummary.focusHref ?? "/operating",
                meta: [
                  overview.operatorCueSummary.workState,
                  overview.operatorCueSummary.actionState,
                  overview.operatorCueSummary.controlState,
                  overview.operatorCueSummary.reviewState,
                  overview.operatorCueSummary.reviewActionState,
                  overview.operatorCueSummary.focusTitle,
                  `${overview.operatorCueSummary.counts.continuityAttention} continuity attention`,
                  `${overview.operatorCueSummary.counts.reviewQueue} review queue`,
                  `${overview.operatorCueSummary.counts.criticalOperatingGaps} critical gap`,
                  `${overview.operatorCueSummary.counts.pendingExecutionWrites} pending execution`,
                  `${overview.operatorCueSummary.counts.benchmarkPendingRequests} benchmark request`,
                  overview.operatorCueSummary.latestUpdatedAt
                    ? formatPanelTime(overview.operatorCueSummary.latestUpdatedAt, english)
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
              },
            ]}
          />

          <QueueCard
            title={english ? "Operator next move summary" : "操作员下一步摘要"}
            description={
              english
                ? "After the top cue is known, the workspace should still answer one bounded next move before anyone scans multiple operator cards by hand."
                : "顶层线索明确后，工作区还需要先回答一条有边界的下一动作，避免继续手工扫多张操作员卡片。"
            }
            emptyLabel={
              english ? "No operator next move summary yet." : "当前还没有操作员下一动作 summary。"
            }
            english={english}
            items={[
              {
                id: "operator-next-move-summary",
                title: `${overview.operatorNextMoveSummary.state} · ${overview.operatorNextMoveSummary.driver}`,
                summary: overview.operatorNextMoveSummary.summary,
                secondarySummary: overview.operatorNextMoveSummary.nextAction,
                tertiarySummary: overview.operatorNextMoveSummary.boundaryNote,
                status: overview.operatorNextMoveSummary.state.toUpperCase(),
                href: overview.operatorNextMoveSummary.focusHref ?? "/operating",
                meta: [
                  overview.operatorNextMoveSummary.cueState,
                  overview.operatorNextMoveSummary.workState,
                  overview.operatorNextMoveSummary.actionState,
                  overview.operatorNextMoveSummary.reviewActionState,
                  overview.operatorNextMoveSummary.focusTitle,
                  overview.operatorNextMoveSummary.latestUpdatedAt
                    ? formatPanelTime(overview.operatorNextMoveSummary.latestUpdatedAt, english)
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
              },
            ]}
          />

          <QueueCard
            title={english ? "Operator action cue" : "操作员动作提示"}
            description={
              english
                ? "Workspace-level operator scanning should still collapse into one coarse action lane before anyone compares detailed control, review, or continuity cards by hand."
                : "工作区级操作员扫描还需要先压成一条粗粒度动作通道，避免继续手工对比控制、复核与连续性细卡。"
            }
            emptyLabel={
              english ? "No operator action cue yet." : "当前还没有操作员动作线索。"
            }
            english={english}
            items={[
              {
                id: "operator-action-cue-summary",
                title: `${overview.operatorActionCueSummary.state} · ${overview.operatorActionCueSummary.driver}`,
                summary: overview.operatorActionCueSummary.summary,
                secondarySummary: overview.operatorActionCueSummary.nextAction,
                tertiarySummary: overview.operatorActionCueSummary.boundaryNote,
                status: overview.operatorActionCueSummary.state.toUpperCase(),
                href: overview.operatorActionCueSummary.focusHref ?? "/operating",
                meta: [
                  overview.operatorActionCueSummary.cueState,
                  overview.operatorActionCueSummary.nextMoveState,
                  overview.operatorActionCueSummary.actionState,
                  overview.operatorActionCueSummary.controlState,
                  overview.operatorActionCueSummary.reviewActionState,
                  overview.operatorActionCueSummary.focusTitle,
                  overview.operatorActionCueSummary.latestUpdatedAt
                    ? formatPanelTime(overview.operatorActionCueSummary.latestUpdatedAt, english)
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
              },
            ]}
          />

          <QueueCard
            title={english ? "Operator review/control cue" : "操作员复核 / 控制提示"}
            description={
              english
                ? "After the top work lane is clear, the workspace should still say whether the next bounded entry point is review or control before anyone scans both cards by hand."
                : "顶层工作通道明确后，工作区还需要先回答下一层有边界的入口是复核还是控制，避免继续手工对比两张卡。"
            }
            emptyLabel={
              english
                ? "No operator review/control cue yet."
                : "当前还没有操作员复核/控制线索。"
            }
            english={english}
            items={[
              {
                id: "operator-review-control-cue-summary",
                title: `${overview.operatorReviewControlCueSummary.state} · ${overview.operatorReviewControlCueSummary.driver}`,
                summary: overview.operatorReviewControlCueSummary.summary,
                secondarySummary: overview.operatorReviewControlCueSummary.nextAction,
                tertiarySummary: overview.operatorReviewControlCueSummary.boundaryNote,
                status: overview.operatorReviewControlCueSummary.state.toUpperCase(),
                href: overview.operatorReviewControlCueSummary.focusHref ?? "/operating",
                meta: [
                  overview.operatorReviewControlCueSummary.cueState,
                  overview.operatorReviewControlCueSummary.actionCueState,
                  overview.operatorReviewControlCueSummary.controlState,
                  overview.operatorReviewControlCueSummary.reviewState,
                  overview.operatorReviewControlCueSummary.reviewActionState,
                  overview.operatorReviewControlCueSummary.focusTitle,
                  overview.operatorReviewControlCueSummary.latestUpdatedAt
                    ? formatPanelTime(overview.operatorReviewControlCueSummary.latestUpdatedAt, english)
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
              },
            ]}
          />

          <QueueCard
            title={english ? "Operator start point" : "操作员起点"}
            description={
              english
                ? "Workspace-level operator scanning should collapse into one primary bounded move plus one secondary fallback before anyone fans out into the full operating surface."
                : "工作区级操作员扫描应该先压成一条主有边界动作加一条次级兜底，再决定是否展开整张运营面。"
            }
            emptyLabel={
              english ? "No operator start point yet." : "当前还没有操作员start point。"
            }
            english={english}
            items={[
              {
                id: "operator-start-point-summary",
                title: `${overview.operatorStartPointSummary.state} · ${overview.operatorStartPointSummary.driver}`,
                summary: overview.operatorStartPointSummary.summary,
                secondarySummary: overview.operatorStartPointSummary.nextAction,
                tertiarySummary: overview.operatorStartPointSummary.followupAction,
                status: overview.operatorStartPointSummary.state.toUpperCase(),
                href: overview.operatorStartPointSummary.focusHref ?? "/operating",
                meta: [
                  overview.operatorStartPointSummary.primaryState,
                  overview.operatorStartPointSummary.primaryDriver,
                  overview.operatorStartPointSummary.secondaryState,
                  overview.operatorStartPointSummary.secondaryDriver,
                  overview.operatorStartPointSummary.focusTitle,
                  overview.operatorStartPointSummary.secondaryFocusTitle,
                  overview.operatorStartPointSummary.latestUpdatedAt
                    ? formatPanelTime(overview.operatorStartPointSummary.latestUpdatedAt, english)
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
              },
            ]}
          />

          <QueueCard
            title={english ? "Operator review summary" : "操作员复核摘要"}
            description={
              english
                ? "Verification, promotion, reflection and consolidation queues — in one place."
                : "验证、晋升、反思、整合——一处看完。"
            }
            emptyLabel={english ? "No operator review summary yet." : "当前还没有操作员复核 summary。"}
            english={english}
            items={[
              {
                id: "operator-review-summary",
                title: `${overview.operatorReviewSummary.state} · ${overview.operatorReviewSummary.driver}`,
                summary: overview.operatorReviewSummary.summary,
                secondarySummary: overview.operatorReviewSummary.nextAction,
                tertiarySummary: overview.operatorReviewSummary.boundaryNote,
                status: overview.operatorReviewSummary.state.toUpperCase(),
                href: overview.operatorReviewSummary.focusHref ?? "/operating",
                meta: [
                  overview.operatorReviewSummary.focusTitle,
                  `${overview.operatorReviewSummary.counts.verificationQueue} verification`,
                  `${overview.operatorReviewSummary.counts.promotionQueue} promotion`,
                  `${overview.operatorReviewSummary.counts.reflectionCandidates} reflection candidate`,
                  `${overview.operatorReviewSummary.counts.reflectionJobs} reflection job`,
                  `${overview.operatorReviewSummary.counts.consolidationJobs} consolidation job`,
                  overview.operatorReviewSummary.latestUpdatedAt
                    ? formatPanelTime(overview.operatorReviewSummary.latestUpdatedAt, english)
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
              },
            ]}
          />

          <QueueCard
            title={english ? "Operator review action summary" : "操作员复核动作摘要"}
            description={
              english
                ? "Workspace-level review posture should compress into one bounded next action before the operator scans every review queue by hand."
                : "工作区级复核姿态需要先压成一份有边界的下一动作，避免操作员继续手工扫每一组复核队列。"
            }
            emptyLabel={
              english ? "No operator review action summary yet." : "当前还没有操作员复核动作摘要。"
            }
            english={english}
            items={[
              {
                id: "operator-review-action-summary",
                title: `${overview.operatorReviewActionSummary.state} · ${overview.operatorReviewActionSummary.driver}`,
                summary: overview.operatorReviewActionSummary.summary,
                secondarySummary: overview.operatorReviewActionSummary.nextAction,
                tertiarySummary: overview.operatorReviewActionSummary.boundaryNote,
                status: overview.operatorReviewActionSummary.state.toUpperCase(),
                href: overview.operatorReviewActionSummary.focusHref ?? "/operating",
                meta: [
                  overview.operatorReviewActionSummary.reviewState,
                  overview.operatorReviewActionSummary.focusTitle,
                  `${overview.operatorReviewActionSummary.counts.verificationQueue} verification`,
                  `${overview.operatorReviewActionSummary.counts.promotionQueue} promotion`,
                  `${overview.operatorReviewActionSummary.counts.reflectionCandidates} reflection candidate`,
                  `${overview.operatorReviewActionSummary.counts.reflectionJobs} reflection job`,
                  `${overview.operatorReviewActionSummary.counts.consolidationJobs} consolidation job`,
                  overview.operatorReviewActionSummary.latestUpdatedAt
                    ? formatPanelTime(overview.operatorReviewActionSummary.latestUpdatedAt, english)
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
              },
            ]}
          />

          <QueueCard
            title={english ? "Operator work summary" : "操作员工作摘要"}
            description={
              english
                ? "Workspace-level operator work should collapse continuity attention, control posture, review queues, and critical operating gaps into one bounded next-work summary."
                : "工作区级操作员工作需要把连续性关注、控制姿态、复核队列和关键经营缺口压成一份有边界的下一步工作摘要。"
            }
            emptyLabel={english ? "No operator work summary yet." : "当前还没有操作员work summary。"}
            english={english}
            items={[
              {
                id: "operator-work-summary",
                title: `${overview.operatorWorkSummary.state} · ${overview.operatorWorkSummary.driver}`,
                summary: overview.operatorWorkSummary.summary,
                secondarySummary: overview.operatorWorkSummary.nextAction,
                tertiarySummary: overview.operatorWorkSummary.boundaryNote,
                status: overview.operatorWorkSummary.state.toUpperCase(),
                href: overview.operatorWorkSummary.focusHref ?? "/operating",
                meta: [
                  overview.operatorWorkSummary.actionState,
                  overview.operatorWorkSummary.controlState,
                  overview.operatorWorkSummary.reviewState,
                  overview.operatorWorkSummary.reviewActionState,
                  overview.operatorWorkSummary.focusTitle,
                  `${overview.operatorWorkSummary.counts.continuityAttention} continuity attention`,
                  `${overview.operatorWorkSummary.counts.reviewQueue} review queue`,
                  `${overview.operatorWorkSummary.counts.promotionQueue} promotion queue`,
                  `${overview.operatorWorkSummary.counts.reflectionCandidates} reflection candidate`,
                  `${overview.operatorWorkSummary.counts.reflectionJobs} reflection job`,
                  `${overview.operatorWorkSummary.counts.consolidationJobs} consolidation job`,
                  `${overview.operatorWorkSummary.counts.criticalOperatingGaps} critical gap`,
                  overview.operatorWorkSummary.latestUpdatedAt
                    ? formatPanelTime(overview.operatorWorkSummary.latestUpdatedAt, english)
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
              },
            ]}
          />

          <QueueCard
            title={english ? "Operator action summary" : "操作员动作摘要"}
            description={
              english
                ? "Request, takeover, control, close — bundled, review-first."
                : "请求、接管、控制、关闭——打包，先复核。"
            }
            emptyLabel={english ? "No operator action summary yet." : "当前还没有操作员动作摘要。"}
            english={english}
            items={[
              {
                id: "operator-action-summary",
                title: `${overview.operatorActionSummary.state} · ${overview.operatorActionSummary.driver}`,
                summary: overview.operatorActionSummary.summary,
                secondarySummary: overview.operatorActionSummary.nextAction,
                tertiarySummary: overview.operatorActionSummary.boundaryNote,
                status: overview.operatorActionSummary.state.toUpperCase(),
                href: overview.operatorActionSummary.focusHref ?? "/operating",
                meta: [
                  overview.operatorActionSummary.progressState,
                  overview.operatorActionSummary.requestTakeoverState,
                  overview.operatorActionSummary.requestHumanInputState,
                  overview.operatorActionSummary.takeoverActivationState,
                  overview.operatorActionSummary.operatorControlState,
                  overview.operatorActionSummary.closePostureState,
                  overview.operatorActionSummary.focusTitle,
                  overview.operatorActionSummary.checkpointKey,
                  overview.operatorActionSummary.currentOwner,
                  overview.operatorActionSummary.latestUpdatedAt
                    ? formatPanelTime(overview.operatorActionSummary.latestUpdatedAt, english)
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
              },
            ]}
          />

          <QueueCard
            title={english ? "SWARM-004 operator control surface" : "SWARM-004 操作员控制面"}
            description={
              english
                ? "This card stays narrowly inside SWARM-004: /operating only, pause/resume/kill/fallback only, and each control is explicitly bridged to current checkpoint, close, or takeover seams."
                : "这张卡保持在狭义 SWARM-004：只属于 /operating，只保留暂停 / 恢复 / 终止 / 兜底，并且每个控制都明确桥接到现有检查点、关闭或接管接缝。"
            }
            emptyLabel={
              english
                ? "No swarm operator control surface is visible yet."
                : "当前还没有可见的 正在加温的操作员控制 面。"
            }
            english={english}
            items={[
              {
                id: "swarm-operator-control-surface",
                title: `${overview.swarmOperatorControlSurface.state} · ${overview.swarmOperatorControlSurface.driver}`,
                summary: overview.swarmOperatorControlSurface.summary,
                secondarySummary: overview.swarmOperatorControlSurface.nextAction,
                tertiarySummary: overview.swarmOperatorControlSurface.boundaryNote,
                status: overview.swarmOperatorControlSurface.state.toUpperCase(),
                href: overview.swarmOperatorControlSurface.focusHref ?? "/operating",
                meta: [
                  overview.swarmOperatorControlSurface.focusTitle,
                  overview.swarmOperatorControlSurface.focusCheckpointKey
                    ? `checkpoint ${overview.swarmOperatorControlSurface.focusCheckpointKey}`
                    : null,
                  overview.swarmOperatorControlSurface.focusBudgetPosture
                    ? `budget ${overview.swarmOperatorControlSurface.focusBudgetPosture}`
                    : null,
                  overview.swarmOperatorControlSurface.focusSpawnDenyReason
                    ? `spawn deny ${overview.swarmOperatorControlSurface.focusSpawnDenyReason}`
                    : "spawn deny none",
                  overview.swarmOperatorControlSurface.focusRepeatPatternStatus
                    ? `repeat ${overview.swarmOperatorControlSurface.focusRepeatPatternStatus}`
                    : null,
                  `${overview.swarmOperatorControlSurface.counts.requestableThreads} requestable thread`,
                  `${overview.swarmOperatorControlSurface.counts.activeThreads} active thread`,
                  `${overview.swarmOperatorControlSurface.counts.boundaryOnlyThreads} boundary-only thread`,
                  `pause ${overview.swarmOperatorControlSurface.controls.pause.state}`,
                  `resume ${overview.swarmOperatorControlSurface.controls.resume.state}`,
                  `kill ${overview.swarmOperatorControlSurface.controls.kill.state}`,
                  `fallback ${overview.swarmOperatorControlSurface.controls.fallback.state}`,
                  overview.swarmOperatorControlSurface.latestUpdatedAt
                    ? formatPanelTime(overview.swarmOperatorControlSurface.latestUpdatedAt, english)
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
                actions: buildSwarmOperatorControlActions({
                  english,
                  canManageRuntime,
                  overview,
                }),
              },
            ]}
          />

          <QueueCard
            title={english ? "Operator control summary" : "操作员控制摘要"}
            description={
              english
                ? "Environment authority, latest execution seam, and benchmark workflow should collapse into one operator-facing control posture before anyone treats this substrate slice as settled."
                : "环境权限、最新执行接缝与基准工作流需要先压成一份面向运营的控制姿态，避免不同面各自拼接后再把这条底座切片当成已收口。"
            }
            emptyLabel={english ? "No operator control summary yet." : "当前还没有操作员控制 summary。"}
            english={english}
            items={[
              {
                id: "operator-control-summary",
                title: `${overview.operatorControlSummary.state} · ${overview.operatorControlSummary.driver}`,
                summary: overview.operatorControlSummary.summary,
                secondarySummary: overview.operatorControlSummary.nextAction,
                tertiarySummary: overview.operatorControlSummary.boundaryNote,
                status: overview.operatorControlSummary.state.toUpperCase(),
                href: overview.operatorControlSummary.focusHref ?? "/operating",
                meta: [
                  overview.operatorControlSummary.authorityPosture,
                  overview.operatorControlSummary.executionSeamPosture,
                  overview.operatorControlSummary.benchmarkWorkflowState,
                  overview.operatorControlSummary.benchmarkFollowThroughState,
                  overview.operatorControlSummary.focusTitle,
                  `${overview.operatorControlSummary.counts.pendingExecutionWrites} pending execution`,
                  `${overview.operatorControlSummary.counts.openExecutionFollowThrough} execution follow-through open`,
                  `${overview.operatorControlSummary.counts.benchmarkPendingRequests} benchmark request`,
                  `${overview.operatorControlSummary.counts.benchmarkRecordedGates} recorded gate`,
                  `${overview.operatorControlSummary.counts.benchmarkWarningGates} warning`,
                  `${overview.operatorControlSummary.counts.benchmarkFailingGates} fail`,
                  overview.operatorControlSummary.latestUpdatedAt
                    ? formatPanelTime(overview.operatorControlSummary.latestUpdatedAt, english)
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
              },
            ]}
          />

          <QueueCard
            title={english ? "Environment seams" : "环境边界"}
            description={
              english
                ? `Connector, browser, control-plane, workspace-context, and official-action seams stay explicit so capability hints do not silently widen authority. ${overview.environmentContract.summary.connectedConnectorCount} connector(s) are currently connected. Latest execution seam is ${overview.environmentContract.executionSeam.posture}, and authority posture is ${overview.environmentContract.executionAuthority.posture}.`
                : `连接器、浏览器、控制平面、工作区上下文与正式动作接缝都需要保持显式，这样能力提示不会静默扩权。当前有 ${overview.environmentContract.summary.connectedConnectorCount} 个连接器已连接，最新执行接缝为 ${overview.environmentContract.executionSeam.posture}，权限姿态为 ${overview.environmentContract.executionAuthority.posture}。`
            }
            emptyLabel={english ? "No environment seam yet." : "当前还没有环境接缝。"}
            english={english}
            items={overview.environmentContract.seams.map((item) => ({
              id: item.seamId,
              title: item.seamKind.replaceAll("_", " "),
              summary: item.summary,
              status: item.runtimePosture,
              href: "/operating",
              meta: item.providers.length
                ? item.providers.map((provider) => provider.label).join(", ")
                : english
                  ? "boundary only"
                  : "仅边界定义",
            }))}
          />

          <QueueCard
            title={english ? "Environment execution seam" : "环境执行边界"}
            description={
              english
                ? "Guarded writes, limited auto, and official follow-through stay explicit here as review-gated execution posture rather than widened authority."
                : "受约束写入、限定自动与官方跟进在这里作为复核闸控的执行姿态保持显式，而不是变成更宽的权限。"
            }
            emptyLabel={english ? "No environment execution seam yet." : "当前还没有环境执行边界。"}
            english={english}
            items={[
              {
                id: "environment-execution-seam",
                title:
                  overview.environmentContract.executionSeam.latestSummary ??
                  overview.environmentContract.executionSeam.posture,
                summary: overview.environmentContract.executionSeam.summary,
                status: overview.environmentContract.executionSeam.posture,
                href: "/operating",
                meta: [
                  overview.environmentContract.executionSeam.latestSource,
                  `${overview.environmentContract.executionSeam.counts.officialWritesPending} pending`,
                  `${overview.environmentContract.executionSeam.counts.officialWritesAcknowledged} acknowledged`,
                  `${overview.environmentContract.executionSeam.counts.officialWritesFailed} failed`,
                  `${overview.environmentContract.executionSeam.counts.officialWritesDeferred} deferred`,
                  `${overview.environmentContract.executionSeam.counts.followThroughOpen} follow-through open`,
                  `${overview.environmentContract.executionSeam.counts.followThroughResolved} follow-through resolved`,
                  overview.environmentContract.executionSeam.latestUpdatedAt
                    ? formatPanelTime(overview.environmentContract.executionSeam.latestUpdatedAt, english)
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
              },
            ]}
          />

          <QueueCard
            title={english ? "Environment execution authority" : "环境执行权限"}
            description={
              english
                ? "Which execution paths are manual-only, review-gated, or narrowly auto."
                : "哪些执行路径仅人工、要复核、或在窄域自动。"
            }
            emptyLabel={english ? "No environment execution authority yet." : "当前还没有环境执行权限。"}
            english={english}
            items={overview.environmentContract.executionAuthority.sourceEntries.map((item) => ({
              id: item.source,
              title: item.source.replaceAll("_", " "),
              summary: item.summary,
              status: item.posture,
              href: "/operating",
              meta: [
                `${item.liveReferenceCount} live`,
                overview.environmentContract.executionAuthority.posture,
              ].join(" · "),
            }))}
          />

          <QueueCard
            title={english ? "Benchmark matrix" : "基准矩阵"}
            description={
              english
                ? `Runtime eval, adapter conformance, boundary regression, and operator usability stay explicit as four validation gates before this substrate can be trusted. ${overview.benchmarkMatrix.workflow.summary}`
                : `运行时评估、适配器一致性、边界回归与操作员可用性需要作为四层验证门槛保持显式，运行时底座才能被信任。${overview.benchmarkMatrix.workflow.summary}`
            }
            emptyLabel={english ? "No benchmark gate yet." : "当前还没有基准闸口。"}
            english={english}
            items={overview.benchmarkMatrix.layers.map((item) => ({
              id: item.layerId,
              title: item.label,
              summary: item.summary,
              status:
                item.outcomeStatus === "not_recorded"
                  ? english
                    ? "NO EVIDENCE"
                    : "无证据"
                  : item.outcomeStatus === "warning"
                    ? "WATCH"
                    : item.outcomeStatus.toUpperCase(),
              href: "/operating",
              meta: `workflow ${overview.benchmarkMatrix.workflow.state} · follow-through ${overview.benchmarkMatrix.workflow.followThrough.state} · ${item.recordedGateCount}/${item.gates.length} ${english ? "gate(s)" : "门"} · ${item.gates.map((gate) => gate.label).join(", ")}${item.latestRecordedAt ? ` · ${formatPanelTime(item.latestRecordedAt, english)}` : ""}`,
            }))}
          />

          <QueueCard
            title={english ? "Composition-failure inbox" : "组合失败收件箱"}
            description={
              english
                ? "Context misses, verification failures and policy blocks stay visible so operators can fix the runtime path instead of silently retrying."
                : "context miss、验证 fail 和 policy block 都要保持可见，这样操作员修的是运行时 path，而不是静默重试。"
            }
            emptyLabel={english ? "No composition failures recorded." : "当前没有 composition failure。"}
            english={english}
            items={overview.compositionFailures.map((item) => ({
              id: item.id,
              title: item.problemSpaceTitle ? `${item.sessionLabel} · ${item.problemSpaceTitle}` : item.sessionLabel,
              summary: item.summary,
              status: item.failureClass,
              href: item.href,
              timestamp: item.createdAt,
            }))}
          />

          <div className="rounded-[24px] border border-dashed border-[color:var(--border)] px-4 py-4 text-sm leading-7 text-[color:var(--muted-foreground)]">
            {overview.boundaryNote}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

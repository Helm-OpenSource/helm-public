import type { PreparedBiReportDryRun } from "@/lib/bi-report-skill/types";
import { resolveDingTalkAppMessageTargetKeyForWorkspaceUser } from "@/lib/bi-report-skill/delivery/dingtalk-user-target";
import { createBiReportSignalNotificationDeduped } from "@/lib/bi-report-skill/signal-notification";
import {
  getBiReportP0ProcessSkillKey,
  persistBiReportP0ProcessSignals,
} from "@/lib/extensions/registry";

export async function persistBiReportRowLevelSignals(input: {
  workspaceId: string;
  sourceRunId: string;
  prepared: PreparedBiReportDryRun;
}) {
  if (input.prepared.skill.manifest.skillKey !== getBiReportP0ProcessSkillKey()) {
    return [];
  }

  const rows = input.prepared.rows;
  const productionRows = rows.map((row) => ({
    orgName: String(row.org_name ?? ""),
    empName: String(row.emp_name ?? ""),
    inPanelCaseCount: toNumberOrNull(row.in_panel_case_count),
    processedUserCount: toNumberOrNull(row.processed_user_count),
    connectedUserCount: toNumberOrNull(row.connected_user_count),
    callOutTimes: toNumberOrNull(row.call_out_times),
    connectedTimes: toNumberOrNull(row.connected_times),
    validCallMinutes: toNumberOrNull(row.valid_call_minutes),
  }));
  const sopRows = rows.map((row) => ({
    orgName: String(row.org_name ?? ""),
    empName: String(row.emp_name ?? ""),
    selfConnectRatePct: toNumberOrNull(row.self_connect_rate_pct),
    followupCompletionRatePct: toNumberOrNull(row.followup_completion_rate_pct),
    callTargetPersonRatePct: toNumberOrNull(row.call_target_person_rate_pct),
    totalCallMinutes: toNumberOrNull(row.total_call_minutes),
    complaintCount: toNumberOrNull(row.complaint_count),
    complaintResolutionRatePct: toNumberOrNull(row.complaint_resolution_rate_pct),
  }));

  const result = await persistBiReportP0ProcessSignals({
    workspaceId: input.workspaceId,
    windowDate: resolveWindowDate(rows),
    sourceRunId: input.sourceRunId,
    productionRows,
    sopRows,
    signalRouting: input.prepared.subscription.signalRouting,
  });

  const persistedSignals = result.persistedSignals.filter(
    (signal): signal is NonNullable<typeof signal> => Boolean(signal),
  );

  // Row-level notifications:
  // Prefer DingTalk app-message to the responsible owner if we can resolve a DingTalk target.
  // Target resolution order:
  // 1) Owner's DingTalk connector unionId
  // 2) Latest DingTalk directory invite snapshot match -> dingtalkUserId
  for (const signal of persistedSignals) {
    if (!signal.ownerUserId) continue;
    const targetKey = await resolveDingTalkAppMessageTargetKeyForWorkspaceUser({
      workspaceId: input.workspaceId,
      userId: signal.ownerUserId,
    });
    if (!targetKey) continue;
    await createBiReportSignalNotificationDeduped({
      workspaceId: input.workspaceId,
      signalId: signal.id,
      targetUserId: signal.ownerUserId,
      channel: "DINGTALK_APP_MESSAGE",
      targetKey,
      status: "pending",
    });
  }

  return persistedSignals;
}

function toNumberOrNull(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function resolveWindowDate(rows: Array<Record<string, unknown>>) {
  const raw = rows[0]?.biz_date;
  return typeof raw === "string" && raw.trim() ? raw : new Date().toISOString().slice(0, 10);
}

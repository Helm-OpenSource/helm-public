import { getBiReportBusinessSignalById } from "@/lib/bi-report-skill/business-signal";
import { sendBiReportToDingTalkDeliveryTarget } from "@/lib/bi-report-skill/delivery/dingtalk-delivery";
import {
  listPendingBiReportSignalNotifications,
  markBiReportSignalNotificationFailed,
  markBiReportSignalNotificationSent,
} from "@/lib/bi-report-skill/signal-notification";
import type { BiReportBusinessSignalRecord } from "@/lib/bi-report-skill/types";

type DispatchResult = {
  attempted: number;
  sent: number;
  failed: number;
};

export async function dispatchPendingBiReportSignalNotifications(input: {
  workspaceId: string;
  take?: number;
}): Promise<DispatchResult> {
  const pending = await listPendingBiReportSignalNotifications({
    workspaceId: input.workspaceId,
    take: input.take ?? 100,
  });
  if (pending.length === 0) {
    return {
      attempted: 0,
      sent: 0,
      failed: 0,
    };
  }

  let sent = 0;
  let failed = 0;

  const pendingWithSignal = await Promise.all(
    pending.map(async (notification) => ({
      notification,
      signal: await getBiReportBusinessSignalById({
        id: notification.signalId,
        workspaceId: input.workspaceId,
      }),
    })),
  );
  pendingWithSignal.sort((left, right) => {
    const severityDelta =
      severityPriority(right.signal?.severity) - severityPriority(left.signal?.severity);
    if (severityDelta !== 0) {
      return severityDelta;
    }
    return (
      new Date(left.notification.createdAt).getTime() -
      new Date(right.notification.createdAt).getTime()
    );
  });

  for (const item of pendingWithSignal) {
    const { notification, signal } = item;
    if (!signal) {
      failed += 1;
      await markBiReportSignalNotificationFailed({
        id: notification.id,
        errorMessage: "signal_not_found",
      });
      continue;
    }

    const message = buildSignalNotificationMessage(signal);
    try {
      const delivery = await sendSignalNotificationDelivery({
        channel: notification.channel,
        targetKey: notification.targetKey,
        message,
      });

      if (delivery.status === "SENT") {
        sent += 1;
        await markBiReportSignalNotificationSent({
          id: notification.id,
          providerMessageId: readProviderMessageId(delivery.responseBody),
        });
        continue;
      }

      failed += 1;
      await markBiReportSignalNotificationFailed({
        id: notification.id,
        errorMessage: sanitizeErrorMessage(delivery.responseBody) ?? "delivery_failed",
      });
    } catch (error) {
      failed += 1;
      await markBiReportSignalNotificationFailed({
        id: notification.id,
        errorMessage: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)) ?? "delivery_failed",
      });
    }
  }

  return {
    attempted: pending.length,
    sent,
    failed,
  };
}

async function sendSignalNotificationDelivery(input: {
  channel: string;
  targetKey: string;
  message: string;
}) {
  if (input.channel === "DINGTALK_GROUP_WEBHOOK") {
    return sendBiReportToDingTalkDeliveryTarget({
      channel: "DINGTALK_GROUP_WEBHOOK",
      targetType: "webhook",
      targetKey: input.targetKey,
      message: input.message,
      dryRun: false,
    });
  }

  if (input.channel === "DINGTALK_APP_MESSAGE") {
    const target = normalizeAppMessageTargetKey(input.targetKey);
    return sendBiReportToDingTalkDeliveryTarget({
      channel: "DINGTALK_APP_MESSAGE",
      targetType: target.targetType,
      targetKey: target.targetKey,
      message: input.message,
      dryRun: false,
    });
  }

  throw new Error(`unsupported_notification_channel:${input.channel}`);
}

function normalizeAppMessageTargetKey(targetKey: string) {
  const raw = targetKey.trim();
  if (raw.startsWith("userId:")) {
    return {
      targetType: "userId" as const,
      targetKey: raw.slice("userId:".length).trim(),
    };
  }

  if (raw.startsWith("unionId:")) {
    return {
      targetType: "unionId" as const,
      targetKey: raw.slice("unionId:".length).trim(),
    };
  }

  return {
    targetType: "unionId" as const,
    targetKey: raw,
  };
}

function buildSignalNotificationMessage(signal: BiReportBusinessSignalRecord) {
  const severityLabel = mapSeverityLabel(signal.severity);
  const actionLines =
    signal.recommendedActions.length > 0
      ? signal.recommendedActions.map((action) => `- ${action}`).join("\n")
      : "- 请及时查看 Helm 并人工确认处理动作。";

  return [
    "### Helm 经营信号待处理",
    `- **级别**: ${severityLabel}`,
    `- **标题**: ${signal.title}`,
    `- **摘要**: ${signal.summary}`,
    "- **建议动作**:",
    actionLines,
  ].join("\n");
}

function mapSeverityLabel(severity: BiReportBusinessSignalRecord["severity"]) {
  if (severity === "CRITICAL") return "CRITICAL";
  if (severity === "ALERT") return "ALERT";
  if (severity === "WARN") return "WARN";
  if (severity === "WATCH") return "WATCH";
  return "CLEAR";
}

function severityPriority(severity: BiReportBusinessSignalRecord["severity"] | undefined) {
  if (severity === "CRITICAL") return 5;
  if (severity === "ALERT") return 4;
  if (severity === "WARN") return 3;
  if (severity === "WATCH") return 2;
  if (severity === "CLEAR") return 1;
  return 0;
}

function readProviderMessageId(responseBody: string | null | undefined) {
  if (!responseBody) return null;

  try {
    const parsed = JSON.parse(responseBody) as {
      task_id?: string | number;
      taskId?: string | number;
      request_id?: string | number;
      requestId?: string | number;
      messageId?: string | number;
    };
    const raw =
      parsed.task_id ??
      parsed.taskId ??
      parsed.request_id ??
      parsed.requestId ??
      parsed.messageId ??
      null;
    if (raw === null || raw === undefined) return null;
    const value = String(raw).trim();
    return value ? value : null;
  } catch {
    return null;
  }
}

function sanitizeErrorMessage(raw: string | null | undefined) {
  const value = raw?.trim();
  if (!value) return null;
  return value.length > 1500 ? `${value.slice(0, 1500)}...` : value;
}

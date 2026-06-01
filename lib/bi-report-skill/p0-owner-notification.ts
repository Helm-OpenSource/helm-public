import type { BiReportSignalRoutingConfig } from "@/lib/bi-report-skill/types";

export function resolveP0OwnerNotificationTargetKey(input: {
  signalRouting?: BiReportSignalRoutingConfig;
  ownerEmail: string;
}) {
  const email = input.ownerEmail.trim().toLowerCase();
  if (!email) return null;

  const mappings = input.signalRouting?.supervisorMappings ?? [];
  for (const mapping of mappings) {
    const mappedEmail = mapping.userEmail?.trim().toLowerCase();
    if (!mappedEmail || mappedEmail !== email) continue;
    const targetKey = mapping.notificationTargetKey?.trim();
    if (targetKey) return targetKey;
  }

  const fallback = process.env.BI_REPORT_P0_OWNER_NOTIFICATION_TARGET_KEY?.trim();
  return fallback || null;
}

export function normalizeP0OwnerNotificationTarget(targetKey: string) {
  const raw = targetKey.trim();
  if (!raw) {
    throw new Error("P0 owner notification targetKey is empty");
  }

  if (raw.startsWith("webhook:")) {
    return {
      channel: "DINGTALK_GROUP_WEBHOOK" as const,
      targetKey: raw.slice("webhook:".length).trim(),
    };
  }

  if (raw.startsWith("userId:")) {
    return {
      channel: "DINGTALK_APP_MESSAGE" as const,
      targetKey: raw,
    };
  }

  if (raw.startsWith("unionId:")) {
    return {
      channel: "DINGTALK_APP_MESSAGE" as const,
      targetKey: raw,
    };
  }

  // Backwards compatibility: assume unionId.
  return {
    channel: "DINGTALK_APP_MESSAGE" as const,
    targetKey: `unionId:${raw}`,
  };
}

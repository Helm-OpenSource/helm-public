import { sendBiReportToDingTalkAppMessage } from "@/lib/bi-report-skill/delivery/dingtalk-app-message";
import { sendBiReportToDingTalkGroupWebhook } from "@/lib/bi-report-skill/delivery/dingtalk-group-webhook";

export type BiReportDingTalkDeliveryChannel = "DINGTALK_GROUP_WEBHOOK" | "DINGTALK_APP_MESSAGE";

export async function sendBiReportToDingTalkDeliveryTarget(input: {
  channel: BiReportDingTalkDeliveryChannel | string;
  targetType: string;
  targetKey: string;
  message: string;
  dryRun: boolean;
}) {
  if (input.channel === "DINGTALK_GROUP_WEBHOOK") {
    return sendBiReportToDingTalkGroupWebhook({
      targetType: input.targetType,
      targetKey: input.targetKey,
      message: input.message,
      dryRun: input.dryRun,
    });
  }

  if (input.channel === "DINGTALK_APP_MESSAGE") {
    return sendBiReportToDingTalkAppMessage({
      targetType: input.targetType,
      targetKey: input.targetKey,
      message: input.message,
      dryRun: input.dryRun,
    });
  }

  throw new Error(`Unsupported BI report delivery channel: ${String(input.channel)}`);
}


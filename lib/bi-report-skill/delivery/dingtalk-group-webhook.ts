import { jsonStringify } from "@/lib/utils";
import type { BiReportDeliveryPreview } from "@/lib/bi-report-skill/types";
import { redactProviderErrorBody } from "@/lib/connectors/error-redaction";
import { resolveBiReportTargetKey } from "@/lib/bi-report-skill/delivery/target-resolver";

export async function sendBiReportToDingTalkGroupWebhook(input: {
  targetType: string;
  targetKey: string;
  message: string;
  dryRun?: boolean;
}): Promise<BiReportDeliveryPreview> {
  const requestBody = jsonStringify({
    msgtype: "markdown",
    markdown: {
      title: "Helm BI Report",
      text: input.message,
    },
    dryRun: input.dryRun ?? true,
  });

  if (input.targetType !== "webhook") {
    return {
      channel: "DINGTALK_GROUP_WEBHOOK",
      targetType: input.targetType,
      targetKey: input.targetKey,
      status: "FAILED",
      requestBody,
      responseBody: `unsupported DingTalk group webhook targetType: ${input.targetType}`,
    };
  }

  if (input.dryRun ?? true) {
    return {
      channel: "DINGTALK_GROUP_WEBHOOK",
      targetType: input.targetType,
      targetKey: input.targetKey,
      status: "SKIPPED",
      requestBody,
      responseBody: "dry-run",
    };
  }

  const resolvedTargetKey = resolveBiReportTargetKey(input.targetKey);
  const response = await fetch(resolvedTargetKey, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: requestBody,
    cache: "no-store",
  });
  const responseBody = await response.text();

  const normalizedBody = responseBody.trim();
  const succeeded =
    response.ok &&
    (normalizedBody === "" ||
      normalizedBody.includes('"errcode":0') ||
      normalizedBody.includes('"code":"ok"'));

  return {
    channel: "DINGTALK_GROUP_WEBHOOK",
    targetType: input.targetType,
    targetKey: input.targetKey,
    status: succeeded ? "SENT" : "FAILED",
    requestBody,
    // The DingTalk webhook URL contains the access_token in the path; some
    // gateway error responses echo it back. Redact before this body lands in
    // delivery audit / observability.
    responseBody: redactProviderErrorBody(normalizedBody || response.statusText),
  };
}

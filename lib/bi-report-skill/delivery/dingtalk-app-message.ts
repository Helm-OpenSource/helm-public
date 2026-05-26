import { jsonStringify } from "@/lib/utils";
import type { BiReportDeliveryPreview } from "@/lib/bi-report-skill/types";
import {
  fetchDingTalkAppAccessToken,
  getDingTalkAppMessageConfig,
} from "@/lib/connectors/dingtalk";
import { resolveDingTalkUserIdByUnionId } from "@/lib/connectors/dingtalk-mcp-client";
import { redactProviderErrorBody } from "@/lib/connectors/error-redaction";
import { resolveBiReportTargetKey } from "@/lib/bi-report-skill/delivery/target-resolver";

const DINGTALK_APP_MESSAGE_SEND_URL =
  "https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2";

export async function sendBiReportToDingTalkAppMessage(input: {
  targetType: string;
  targetKey: string;
  message: string;
  dryRun?: boolean;
}): Promise<BiReportDeliveryPreview> {
  const config = getDingTalkAppMessageConfig();
  const requestBodyBase = {
    msg: {
      msgtype: "markdown",
      markdown: {
        title: "Helm BI Report",
        text: input.message,
      },
    },
  };

  if (input.targetType !== "userId" && input.targetType !== "unionId") {
    return {
      channel: "DINGTALK_APP_MESSAGE",
      targetType: input.targetType,
      targetKey: input.targetKey,
      status: "FAILED",
      requestBody: jsonStringify(requestBodyBase),
      responseBody: `unsupported DingTalk app message targetType: ${input.targetType}`,
    };
  }

  if (input.dryRun ?? true) {
    return {
      channel: "DINGTALK_APP_MESSAGE",
      targetType: input.targetType,
      targetKey: input.targetKey,
      status: "SKIPPED",
      requestBody: jsonStringify({
        agent_id: config.agentId ?? "DINGTALK_AGENT_ID",
        userid_list: input.targetKey,
        to_all_user: false,
        ...requestBodyBase,
        dryRun: true,
      }),
      responseBody: "dry-run",
    };
  }

  if (!config.agentId) {
    return {
      channel: "DINGTALK_APP_MESSAGE",
      targetType: input.targetType,
      targetKey: input.targetKey,
      status: "FAILED",
      requestBody: jsonStringify(requestBodyBase),
      responseBody: "DINGTALK_AGENT_ID is not configured",
    };
  }

  const requestTargetKey = resolveBiReportTargetKey(input.targetKey);
  const userId =
    input.targetType === "userId"
      ? requestTargetKey
      : await resolveDingTalkUserIdByUnionId(requestTargetKey);
  const requestBody = jsonStringify({
    agent_id: Number.isFinite(Number(config.agentId)) ? Number(config.agentId) : config.agentId,
    userid_list: userId,
    to_all_user: false,
    ...requestBodyBase,
    dryRun: input.dryRun ?? true,
  });

  const token = await fetchDingTalkAppAccessToken();
  const url = new URL(DINGTALK_APP_MESSAGE_SEND_URL);
  url.searchParams.set("access_token", token.accessToken);
  const response = await fetch(url.toString(), {
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
    (normalizedBody.includes('"errcode":0') ||
      normalizedBody.includes('"errorCode":"0"'));

  return {
    channel: "DINGTALK_APP_MESSAGE",
    targetType: input.targetType,
    targetKey: input.targetKey,
    status: succeeded ? "SENT" : "FAILED",
    requestBody,
    // access_token rides in the URL query string for this DingTalk endpoint;
    // some failure shapes echo back the original querystring. Redact before
    // the body lands in delivery audit / observability.
    responseBody: redactProviderErrorBody(normalizedBody || response.statusText),
  };
}
